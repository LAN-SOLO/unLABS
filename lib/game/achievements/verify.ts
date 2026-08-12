/**
 * Server-side achievement verification
 * ====================================
 *
 * Anti-cheat backstop for the reserve-burn claim path. The
 * `achievement_progress` table is written by the client (RLS-scoped, but
 * value-wise client-asserted), so "progress >= target" checked against
 * that table is circular: a hostile client can write `progress = target`
 * and then claim. For every branch whose evaluate() source has a
 * server-authoritative mirror in the DB, this module re-derives the
 * progress from rows the client cannot forge:
 *
 *   - construction  → count(production_jobs where status='claimed')
 *                     (catalog evaluate: `s.craftedJobCount` — lifetime
 *                     total of claimed jobs, no recipe/date filter)
 *   - breadth       → count(distinct recipe_id where status='claimed')
 *                     (catalog evaluate: `s.craftedRecipeIds.size`)
 *   - trade         → balances.total_spent
 *                     (catalog evaluate: `s.totalSpent`; total_spent is
 *                     maintained by the unsc_burn/unsc_spend RPCs and is
 *                     server-authoritative since the RPC hardening)
 *
 * Branches resource / energy / exploration (and future anomaly / relic /
 * cosmic / ai) evaluate tick-local state (lifetime resource counters,
 * resonance discoveries) that never lands in a server-authoritative
 * table — they return `verifiable: false` and stay on the legacy
 * progress-row trust path.
 *
 * Failure posture: if a verification query errors (network, transient DB
 * failure), we log and return `verifiable: false` — degrading to the
 * legacy behavior instead of locking honest players out of claims. The
 * queries are RLS-scoped selects on the caller's own rows, so an attacker
 * cannot deliberately trigger this fallback.
 *
 * Kept outside the "use server" action file so unit tests can import the
 * decision logic with a mock Supabase client (importing the action module
 * would drag in `next/headers`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Achievement } from "./types";

export interface BranchVerification {
  /** True when this branch can be re-derived from server-authoritative rows. */
  verifiable: boolean;
  /** Only meaningful when `verifiable` — true when DB state meets the target. */
  satisfied: boolean;
}

const NOT_VERIFIABLE: BranchVerification = { verifiable: false, satisfied: false };

/**
 * Re-derive an achievement's progress from server-authoritative tables.
 * Thresholds are identical to the catalog `evaluate()` semantics, so an
 * honest player who legitimately crossed the target always passes.
 */
export async function verifyBranchServerSide(
  supabase: SupabaseClient,
  userId: string,
  achievement: Achievement,
): Promise<BranchVerification> {
  switch (achievement.branch) {
    case "construction": {
      // evaluate: s.craftedJobCount — lifetime count of claimed jobs.
      const res = await supabase
        .from("production_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "claimed");
      if (res.error) {
        console.warn(
          `[ach-verify] construction count failed for ${achievement.id}: ${res.error.message}`,
        );
        return NOT_VERIFIABLE;
      }
      return { verifiable: true, satisfied: (res.count ?? 0) >= achievement.target };
    }

    case "breadth": {
      // evaluate: s.craftedRecipeIds.size — distinct recipes ever claimed.
      // PostgREST has no `count(distinct …)`, so fetch the recipe_id column
      // and dedupe here (row volume is bounded by lifetime crafts).
      const res = await supabase
        .from("production_jobs")
        .select("recipe_id")
        .eq("user_id", userId)
        .eq("status", "claimed");
      if (res.error) {
        console.warn(
          `[ach-verify] breadth query failed for ${achievement.id}: ${res.error.message}`,
        );
        return NOT_VERIFIABLE;
      }
      const rows = (res.data ?? []) as Array<{ recipe_id: string }>;
      const distinct = new Set(rows.map((r) => r.recipe_id));
      return { verifiable: true, satisfied: distinct.size >= achievement.target };
    }

    case "trade": {
      // evaluate: s.totalSpent — lifetime _unSC spent (balances.total_spent,
      // written exclusively by the spend/burn RPCs → server-authoritative).
      const res = await supabase
        .from("balances")
        .select("total_spent")
        .eq("user_id", userId)
        .maybeSingle();
      if (res.error) {
        console.warn(`[ach-verify] trade query failed for ${achievement.id}: ${res.error.message}`);
        return NOT_VERIFIABLE;
      }
      const row = res.data as { total_spent: number | string } | null;
      // No balance row ⇒ the user never spent anything ⇒ verifiably short.
      const totalSpent = row ? Number(row.total_spent) : 0;
      return { verifiable: true, satisfied: totalSpent >= achievement.target };
    }

    // resource / energy / exploration (+ future branches): evaluate() reads
    // tick-local lifetime counters or the client-side discovery log — no
    // server-authoritative mirror exists. Documented residual trust surface.
    default:
      return NOT_VERIFIABLE;
  }
}

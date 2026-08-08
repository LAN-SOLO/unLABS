"use server";

/**
 * Kernel Recompile (prestige) server actions
 * ==========================================
 *
 * Client half of the long-horizon _unSC sink. The level itself is
 * server-authoritative: `prestige_state` has SELECT-only RLS and the only
 * mutation path is the SECURITY DEFINER RPC `kernel_recompile()`
 * (supabase/migrations/20260808000003_kernel_recompile.sql), which gates on
 * `quest_state.flags.ENDGAME_UNLOCKED`, burns 500 × 2^level _unSC and
 * increments the level atomically (cap: 20).
 *
 *   - getPrestige — read the current level (0 when no row yet) and derive
 *                   multiplier / next cost client-side for display
 *   - recompile  — invoke the RPC and map its error_message onto typed codes
 *
 * The multiplier mapping (1.5^level) lives in lib/game/tickEngine.ts so the
 * tick loop and this action agree on one formula.
 */

import { createClient } from "@/lib/supabase/server";
import { prestigeMultiplier } from "@/lib/game/tickEngine";

/** DB-side level cap (mirrors kernel_recompile()'s `v_level >= 20` check). */
const MAX_PRESTIGE_LEVEL = 20;

/** Cost of the NEXT recompile from `level` (mirrors `500 * power(2, level)`). */
const recompileCost = (level: number) => 500 * 2 ** level;

// ── getPrestige ───────────────────────────────────────────────────────

export interface PrestigeStateResult {
  ok: boolean;
  /** Current prestige level (0 when the player never recompiled). */
  level: number;
  /** Production multiplier derived from the level (1.5^level). */
  multiplier: number;
  /** _unSC cost of the next recompile (500 × 2^level). */
  nextCost: number;
  /** True when the DB-side cap (20) is reached. */
  atMaxLevel: boolean;
  error?: "not_authenticated" | "read_failed";
}

export async function getPrestige(): Promise<PrestigeStateResult> {
  const fail = (error: NonNullable<PrestigeStateResult["error"]>): PrestigeStateResult => ({
    ok: false,
    level: 0,
    multiplier: 1,
    nextCost: recompileCost(0),
    atMaxLevel: false,
    error,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated");

  const { data, error } = await supabase
    .from("prestige_state")
    .select("level")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return fail("read_failed");

  // No row simply means level 0 — the RPC creates the row on first recompile.
  const level = data?.level ?? 0;
  return {
    ok: true,
    level,
    multiplier: prestigeMultiplier(level),
    nextCost: recompileCost(level),
    atMaxLevel: level >= MAX_PRESTIGE_LEVEL,
  };
}

// ── recompile ─────────────────────────────────────────────────────────

export interface RecompileResult {
  ok: boolean;
  /** Prestige level after the call (unchanged on failure). */
  level: number;
  /** _unSC burned by this recompile (0 when nothing was charged). */
  cost: number;
  /** Available _unSC after the burn (best-known value on failure). */
  newBalance: number;
  /** Production multiplier for `level` (1.5^level). */
  multiplier: number;
  error?:
    | "unauthorized"
    | "endgame_locked"
    | "max_level"
    | "not_found"
    | "insufficient_funds"
    | "rpc_failed"
    | "rpc_no_row";
}

export async function recompile(): Promise<RecompileResult> {
  const fail = (
    error: NonNullable<RecompileResult["error"]>,
    extras?: Partial<RecompileResult>,
  ): RecompileResult => ({
    ok: false,
    level: 0,
    cost: 0,
    newBalance: 0,
    multiplier: 1,
    ...extras,
    error,
  });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kernel_recompile");
  if (error) return fail("rpc_failed");

  // RPCs that `RETURNS TABLE` surface as an array; take the first row
  // (same unwrapping as awardFromReserve in lib/game/economy.ts).
  const rows = (Array.isArray(data) ? data : []) as Array<{
    success: boolean;
    new_level: number;
    cost: number | string;
    new_available: number | string;
    error_message: string | null;
  }>;
  const row = rows[0];
  if (!row) return fail("rpc_no_row");

  if (!row.success) {
    const msg = row.error_message ?? "rpc_failed";
    const code: NonNullable<RecompileResult["error"]> =
      msg === "unauthorized"
        ? "unauthorized"
        : msg === "endgame_locked"
          ? "endgame_locked"
          : msg === "max_level"
            ? "max_level"
            : msg === "not_found"
              ? "not_found"
              : msg === "insufficient_funds"
                ? "insufficient_funds"
                : "rpc_failed";
    const level = Number(row.new_level ?? 0);
    return fail(code, {
      level,
      cost: Number(row.cost ?? 0),
      newBalance: Number(row.new_available ?? 0),
      multiplier: prestigeMultiplier(level),
    });
  }

  const level = Number(row.new_level);
  return {
    ok: true,
    level,
    cost: Number(row.cost),
    newBalance: Number(row.new_available),
    multiplier: prestigeMultiplier(level),
  };
}

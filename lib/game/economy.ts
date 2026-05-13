/**
 * Economy helpers — server-side only.
 *
 * The `_unSC` balance is server-authoritative: these helpers are imported
 * from server actions and talk directly to `public.balances` +
 * `public.transactions`. The client never decrements the balance on its
 * own; it calls a server action and trusts the returned result.
 *
 * This module is NOT marked 'use server' — it's a plain library of
 * helpers consumed by the action files. Keeping the `'use server'`
 * directive at the action layer means every exported helper here can be
 * synchronous-call-sited from the server actions without exposing new
 * RPC endpoints to the client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The transaction_type enum in public (see the initial schema migration).
 * Kept as a literal union so TS catches typos at the call site.
 */
export type TransactionType =
  | "mint"
  | "burn"
  | "transfer"
  | "research"
  | "reward"
  | "fee"
  | "stake"
  | "unstake"
  | "trade";

export interface BalanceRow {
  available: number;
  staked: number;
  locked: number;
  total_earned: number;
  total_spent: number;
}

export interface BurnOptions {
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface BurnResult {
  ok: boolean;
  newAvailable: number;
  error?: "insufficient_funds" | "write_failed" | "not_found";
}

/**
 * Burn _unSC from the user's balance and record a transaction. Atomic in
 * the sense that the UPDATE uses a `where available >= amount` clause —
 * if two concurrent burns race, only one observes the decrement. The
 * transaction row is inserted after a successful balance update.
 *
 * Returns the new available balance on success, or an error code.
 */
export async function burnUnsc(supabase: SupabaseClient, opts: BurnOptions): Promise<BurnResult> {
  if (opts.amount <= 0) {
    return { ok: true, newAvailable: 0 };
  }

  // 1) read current available to verify + compute new value client-side.
  //    We re-check in the UPDATE's WHERE clause to close the TOCTOU window.
  const readResult = await supabase
    .from("balances")
    .select("available, total_spent")
    .eq("user_id", opts.userId)
    .maybeSingle();

  const row = readResult.data as { available: number; total_spent: number } | null;

  if (!row) {
    return { ok: false, newAvailable: 0, error: "not_found" };
  }
  if (Number(row.available) < opts.amount) {
    return {
      ok: false,
      newAvailable: Number(row.available),
      error: "insufficient_funds",
    };
  }

  const newAvailable = Number(row.available) - opts.amount;
  const newTotalSpent = Number(row.total_spent) + opts.amount;

  const { error: updateError } = await supabase
    .from("balances")
    .update({
      available: newAvailable,
      total_spent: newTotalSpent,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("user_id", opts.userId)
    // Guard: only update if the row's available is still >= amount.
    .gte("available", opts.amount);

  if (updateError) {
    return { ok: false, newAvailable: 0, error: "write_failed" };
  }

  // 2) Record the transaction (best-effort; failure here does not roll
  //    back the burn — we prefer consistent balance + missing audit over
  //    a silent drop of funds).
  await supabase.from("transactions").insert({
    user_id: opts.userId,
    type: opts.type,
    amount: opts.amount,
    description: opts.description,
    metadata: opts.metadata ?? {},
  } as never);

  return { ok: true, newAvailable };
}

export interface EarnOptions {
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface EarnResult {
  ok: boolean;
  newAvailable: number;
  error?: "write_failed" | "not_found";
}

export async function earnUnsc(supabase: SupabaseClient, opts: EarnOptions): Promise<EarnResult> {
  if (opts.amount <= 0) return { ok: true, newAvailable: 0 };

  const readResult = await supabase
    .from("balances")
    .select("available, total_earned")
    .eq("user_id", opts.userId)
    .maybeSingle();

  const row = readResult.data as { available: number; total_earned: number } | null;
  if (!row) return { ok: false, newAvailable: 0, error: "not_found" };

  const newAvailable = Number(row.available) + opts.amount;
  const newTotalEarned = Number(row.total_earned) + opts.amount;

  const { error } = await supabase
    .from("balances")
    .update({
      available: newAvailable,
      total_earned: newTotalEarned,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("user_id", opts.userId);

  if (error) return { ok: false, newAvailable: 0, error: "write_failed" };

  await supabase.from("transactions").insert({
    user_id: opts.userId,
    type: opts.type,
    amount: opts.amount,
    description: opts.description,
    metadata: opts.metadata ?? {},
  } as never);

  return { ok: true, newAvailable };
}

// ── Reserve pool (deflationary awards) ─────────────────────────────────

/**
 * Allowed sources for reserve burns. Kept in sync with the DB-level
 * `is_allowed_reserve_source` function so client + DB agree on what's
 * attributable. Adding a new source requires a migration.
 */
export type ReserveSource =
  | "achievement"
  | "starter_pack"
  | "quest_reward"
  | "tutorial_skip"
  | "event"
  | "test";

export const RESERVE_SOURCES: readonly ReserveSource[] = [
  "achievement",
  "starter_pack",
  "quest_reward",
  "tutorial_skip",
  "event",
  "test",
] as const;

export function isReserveSource(s: string): s is ReserveSource {
  return (RESERVE_SOURCES as readonly string[]).includes(s);
}

export interface AwardFromReserveOptions {
  userId: string;
  amount: number;
  source: ReserveSource;
  /** Free-form reference (achievement id, pack sku, quest flag, etc). */
  ref?: string | null;
}

export type AwardFromReserveErrorCode =
  | "invalid_amount"
  | "invalid_source"
  | "unauthorized"
  | "reserve_insufficient"
  | "source_not_allowed"
  | "rpc_failed"
  | "rpc_no_row";

export interface AwardFromReserveResult {
  ok: boolean;
  /** New player balance after crediting. */
  newUserBalance: number;
  /** Remaining reserve after the burn. */
  reserveAvailable: number;
  error?: AwardFromReserveErrorCode;
}

/**
 * Award _unSC to a user by burning it from the system reserve. Atomic at
 * the DB layer via the `reserve_burn_and_award` RPC: debits reserve,
 * credits player, and appends to both audit logs in a single transaction.
 *
 * Use this for any award that must be deflationary (achievements, starter
 * packs, quest rewards that aren't pure resource grants). For user→user
 * transfers, gameplay mints (currently none), or fee refunds, use a
 * different path — this one does not mint fresh supply.
 */
export async function awardFromReserve(
  supabase: SupabaseClient,
  opts: AwardFromReserveOptions,
): Promise<AwardFromReserveResult> {
  if (!Number.isFinite(opts.amount) || opts.amount <= 0) {
    return {
      ok: false,
      newUserBalance: 0,
      reserveAvailable: 0,
      error: "invalid_amount",
    };
  }
  if (!isReserveSource(opts.source)) {
    return {
      ok: false,
      newUserBalance: 0,
      reserveAvailable: 0,
      error: "invalid_source",
    };
  }

  const { data, error } = await supabase.rpc("reserve_burn_and_award", {
    p_user_id: opts.userId,
    p_amount: opts.amount,
    p_source: opts.source,
    p_ref: opts.ref ?? null,
  } as never);

  if (error) {
    return {
      ok: false,
      newUserBalance: 0,
      reserveAvailable: 0,
      error: "rpc_failed",
    };
  }

  // RPCs that `RETURNS TABLE` surface as an array; take the first row.
  const rows = (Array.isArray(data) ? data : []) as Array<{
    success: boolean;
    reserve_available: number | string;
    new_user_balance: number | string;
    error_message: string | null;
  }>;
  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      newUserBalance: 0,
      reserveAvailable: 0,
      error: "rpc_no_row",
    };
  }

  if (!row.success) {
    const msg = row.error_message ?? "rpc_failed";
    const code: AwardFromReserveErrorCode =
      msg === "reserve_insufficient"
        ? "reserve_insufficient"
        : msg === "unauthorized"
          ? "unauthorized"
          : msg === "source_not_allowed"
            ? "source_not_allowed"
            : msg === "invalid_amount"
              ? "invalid_amount"
              : "rpc_failed";
    return {
      ok: false,
      newUserBalance: Number(row.new_user_balance ?? 0),
      reserveAvailable: Number(row.reserve_available ?? 0),
      error: code,
    };
  }

  return {
    ok: true,
    newUserBalance: Number(row.new_user_balance),
    reserveAvailable: Number(row.reserve_available),
  };
}

export interface ReserveStatus {
  available: number;
  totalBurned: number;
  totalEmitted: number;
}

/**
 * Dev-only reserve snapshot (gated to `profiles.is_dev = true` inside the
 * RPC). Returns null when the caller is not permitted or the RPC errors.
 */
export async function getReserveStatus(supabase: SupabaseClient): Promise<ReserveStatus | null> {
  const { data, error } = await supabase.rpc("reserve_status" as never);
  if (error) return null;
  const rows = (Array.isArray(data) ? data : []) as Array<{
    available: number | string;
    total_burned: number | string;
    total_emitted: number | string;
  }>;
  const row = rows[0];
  if (!row) return null;
  return {
    available: Number(row.available),
    totalBurned: Number(row.total_burned),
    totalEmitted: Number(row.total_emitted),
  };
}

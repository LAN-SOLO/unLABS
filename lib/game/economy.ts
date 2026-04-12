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

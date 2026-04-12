"use server";

/**
 * Economy server actions — read-only surfaces for the /lab UI.
 *
 * Mutations (burns / earns) live in production.ts where they are gated
 * behind recipe or quest logic. Direct player-initiated burns are not
 * exposed — there's no free-form "burn 10 unsc" endpoint, and shouldn't
 * be until there's a gameplay reason.
 */

import { createClient } from "@/lib/supabase/server";

export interface BalanceSnapshot {
  available: number;
  staked: number;
  locked: number;
  totalEarned: number;
  totalSpent: number;
}

export interface BalanceResult {
  ok: boolean;
  balance: BalanceSnapshot | null;
  error?: string;
}

export async function getBalance(): Promise<BalanceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, balance: null, error: "not_authenticated" };

  const result = await supabase
    .from("balances")
    .select("available, staked, locked, total_earned, total_spent")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = result.data as {
    available: number;
    staked: number;
    locked: number;
    total_earned: number;
    total_spent: number;
  } | null;

  if (!row) return { ok: false, balance: null, error: "not_found" };

  return {
    ok: true,
    balance: {
      available: Number(row.available),
      staked: Number(row.staked),
      locked: Number(row.locked),
      totalEarned: Number(row.total_earned),
      totalSpent: Number(row.total_spent),
    },
  };
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface LedgerResult {
  ok: boolean;
  entries: LedgerEntry[];
  error?: string;
}

export async function getLedger(limit = 20): Promise<LedgerResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, entries: [], error: "not_authenticated" };

  const result = await supabase
    .from("transactions")
    .select("id, type, amount, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows =
    (result.data as Array<{
      id: string;
      type: string;
      amount: number;
      description: string | null;
      created_at: string;
    }> | null) ?? [];

  return {
    ok: true,
    entries: rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      description: r.description,
      createdAt: r.created_at,
    })),
  };
}

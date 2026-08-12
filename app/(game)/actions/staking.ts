"use server";

/**
 * Staking server actions
 * ======================
 *
 * Client half of the _unSC staking system. All mutations are
 * SECURITY DEFINER RPCs keyed on auth.uid()
 * (supabase/migrations/20260812000002_staking.sql):
 *
 *   - unsc_stake(p_amount)    — available → staked, (re)starts a 7-day lock
 *   - unsc_unstake(p_amount)  — staked → available once the lock expired
 *   - stake_claim_rewards()   — 0.5% per FULL day since last_claim_at,
 *                               reserve-funded (source 'staking')
 *
 * `staking_state` is SELECT-only under RLS, so lock timestamps and claim
 * anchors cannot be forged from the client.
 *
 * These actions stay thin: accrual math, row unwrapping, and error
 * mapping live in lib/game/staking.ts (pure, unit-tested — a
 * "use server" module may only export async functions).
 */

import { createClient } from "@/lib/supabase/server";
import {
  CLAIM_ERROR_CODES,
  STAKE_ERROR_CODES,
  STAKING_DAILY_RATE_PCT,
  UNSTAKE_ERROR_CODES,
  computePending,
  mapStakeError,
  normalizeStakeAmount,
  unwrapStakeRow,
  type ClaimRpcRow,
  type StakeRpcRow,
  type UnstakeRpcRow,
} from "@/lib/game/staking";

// ── getStakingStatus ──────────────────────────────────────────────────

export interface StakingStatusResult {
  ok: boolean;
  /** _unSC available for staking. */
  available: number;
  /** _unSC currently staked. */
  staked: number;
  /** ISO timestamp until which unstaking is refused (null = no lock). */
  lockUntil: string | null;
  /** ISO timestamp of the reward claim anchor (null before first stake). */
  lastClaimAt: string | null;
  /** Full days accrued since lastClaimAt (display estimate). */
  pendingDays: number;
  /** floor(staked × 0.005 × pendingDays) — what a claim would pay now. */
  pendingReward: number;
  /** True while lockUntil is in the future. */
  locked: boolean;
  /** Reward rate in percent per full day (0.5). */
  dailyRatePct: number;
  error?: "not_authenticated" | "not_found" | "read_failed";
}

export async function getStakingStatus(): Promise<StakingStatusResult> {
  const fail = (error: NonNullable<StakingStatusResult["error"]>): StakingStatusResult => ({
    ok: false,
    available: 0,
    staked: 0,
    lockUntil: null,
    lastClaimAt: null,
    pendingDays: 0,
    pendingReward: 0,
    locked: false,
    dailyRatePct: STAKING_DAILY_RATE_PCT,
    error,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated");

  const balanceRes = await supabase
    .from("balances")
    .select("available, staked")
    .eq("user_id", user.id)
    .maybeSingle();
  if (balanceRes.error) return fail("read_failed");
  const balance = balanceRes.data as { available: number | string; staked: number | string } | null;
  if (!balance) return fail("not_found");

  // No staking_state row simply means the player never staked — the RPC
  // creates it on first stake.
  const stateRes = await supabase
    .from("staking_state")
    .select("lock_until, last_claim_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (stateRes.error) return fail("read_failed");
  const state = stateRes.data as { lock_until: string | null; last_claim_at: string } | null;

  const staked = Number(balance.staked);
  const lockUntil = state?.lock_until ?? null;
  const lastClaimAt = state?.last_claim_at ?? null;
  const { pendingDays, pendingReward } = computePending(staked, lastClaimAt);

  return {
    ok: true,
    available: Number(balance.available),
    staked,
    lockUntil,
    lastClaimAt,
    pendingDays,
    pendingReward,
    locked: lockUntil !== null && new Date(lockUntil).getTime() > Date.now(),
    dailyRatePct: STAKING_DAILY_RATE_PCT,
  };
}

// ── stake ─────────────────────────────────────────────────────────────

export interface StakeResult {
  ok: boolean;
  /** Available _unSC after the stake (best-known value on failure). */
  newAvailable: number;
  /** Staked _unSC after the stake (best-known value on failure). */
  newStaked: number;
  /** New lock expiry (7 days from now on success). */
  lockUntil: string | null;
  /**
   * Reward auto-claimed BEFORE this stake, when at least 1 _unSC of
   * full-day rewards was pending. The DB keeps the claim anchor when a
   * stake tops up an existing position, but rewards are always computed
   * on the CURRENT staked amount — claiming first prevents the pending
   * days from being retroactively boosted by the new deposit.
   */
  claimedFirst?: number;
  error?:
    | "invalid_amount"
    | "unauthorized"
    | "not_found"
    | "insufficient_funds"
    | "rpc_failed"
    | "rpc_no_row";
}

/**
 * Stake `amount` _unSC (fractions floored — see normalizeStakeAmount).
 * (Re)starts the 7-day unstake lock.
 */
export async function stake(amount: number): Promise<StakeResult> {
  const fail = (
    error: NonNullable<StakeResult["error"]>,
    extras?: Partial<StakeResult>,
  ): StakeResult => ({
    ok: false,
    newAvailable: 0,
    newStaked: 0,
    lockUntil: null,
    ...extras,
    error,
  });

  const whole = normalizeStakeAmount(amount);
  if (whole === null) return fail("invalid_amount");

  const supabase = await createClient();

  // Settle pending full-day rewards before the position grows (see
  // StakeResult.claimedFirst). A failed auto-claim (e.g. the reserve ran
  // dry) does not block the stake — the reward simply stays pending and
  // remains capped by the reserve at whatever later claim settles it.
  let claimedFirst: number | undefined;
  const status = await getStakingStatus();
  if (status.ok && status.pendingReward >= 1) {
    const claim = await supabase.rpc("stake_claim_rewards");
    const claimRow = claim.error ? null : unwrapStakeRow<ClaimRpcRow>(claim.data);
    if (claimRow?.success) claimedFirst = Number(claimRow.reward);
  }

  const { data, error } = await supabase.rpc("unsc_stake", { p_amount: whole });
  if (error) return fail("rpc_failed", { claimedFirst });

  const row = unwrapStakeRow<StakeRpcRow>(data);
  if (!row) return fail("rpc_no_row", { claimedFirst });

  if (!row.success) {
    return fail(mapStakeError(row.error_message, STAKE_ERROR_CODES, "rpc_failed"), {
      newAvailable: Number(row.new_available ?? 0),
      newStaked: Number(row.new_staked ?? 0),
      claimedFirst,
    });
  }

  return {
    ok: true,
    newAvailable: Number(row.new_available),
    newStaked: Number(row.new_staked),
    lockUntil: row.lock_until ?? null,
    claimedFirst,
  };
}

// ── unstake ───────────────────────────────────────────────────────────

export interface UnstakeResult {
  ok: boolean;
  /** Available _unSC after the unstake (best-known value on failure). */
  newAvailable: number;
  /** Staked _unSC after the unstake (best-known value on failure). */
  newStaked: number;
  /** Populated on the `locked` error so the UI can show the expiry. */
  lockUntil: string | null;
  error?:
    | "invalid_amount"
    | "unauthorized"
    | "locked"
    | "not_found"
    | "insufficient_staked"
    | "rpc_failed"
    | "rpc_no_row";
}

/** Unstake `amount` _unSC (fractions floored) once the 7-day lock expired. */
export async function unstake(amount: number): Promise<UnstakeResult> {
  const fail = (
    error: NonNullable<UnstakeResult["error"]>,
    extras?: Partial<UnstakeResult>,
  ): UnstakeResult => ({
    ok: false,
    newAvailable: 0,
    newStaked: 0,
    lockUntil: null,
    ...extras,
    error,
  });

  const whole = normalizeStakeAmount(amount);
  if (whole === null) return fail("invalid_amount");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unsc_unstake", { p_amount: whole });
  if (error) return fail("rpc_failed");

  const row = unwrapStakeRow<UnstakeRpcRow>(data);
  if (!row) return fail("rpc_no_row");

  if (!row.success) {
    const code = mapStakeError(row.error_message, UNSTAKE_ERROR_CODES, "rpc_failed");

    // The unstake RPC doesn't return the lock expiry — fetch it so the
    // caller can render "locked until …" without a second round-trip.
    let lockUntil: string | null = null;
    if (code === "locked") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const stateRes = await supabase
          .from("staking_state")
          .select("lock_until")
          .eq("user_id", user.id)
          .maybeSingle();
        const state = stateRes.data as { lock_until: string | null } | null;
        lockUntil = state?.lock_until ?? null;
      }
    }

    return fail(code, {
      newAvailable: Number(row.new_available ?? 0),
      newStaked: Number(row.new_staked ?? 0),
      lockUntil,
    });
  }

  return {
    ok: true,
    newAvailable: Number(row.new_available),
    newStaked: Number(row.new_staked),
    lockUntil: null,
  };
}

// ── claimStakingRewards ───────────────────────────────────────────────

export interface ClaimStakingResult {
  ok: boolean;
  /** _unSC credited by this claim (0 on failure). */
  reward: number;
  /** Full days this claim settled (the anchor advanced by exactly this). */
  daysSettled: number;
  /** Available _unSC after the credit (0 on failure). */
  newBalance: number;
  error?:
    | "unauthorized"
    | "nothing_staked"
    | "nothing_accrued"
    | "reserve_insufficient"
    | "source_not_allowed"
    | "award_failed"
    | "rpc_failed"
    | "rpc_no_row";
}

/**
 * Claim accrued staking rewards: 0.5% of the staked amount per full day
 * since last_claim_at, paid from the deflationary reserve. The anchor
 * advances by exactly the settled days, so fractional-day remainders
 * keep accruing.
 */
export async function claimStakingRewards(): Promise<ClaimStakingResult> {
  const fail = (
    error: NonNullable<ClaimStakingResult["error"]>,
    extras?: Partial<ClaimStakingResult>,
  ): ClaimStakingResult => ({
    ok: false,
    reward: 0,
    daysSettled: 0,
    newBalance: 0,
    ...extras,
    error,
  });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stake_claim_rewards");
  if (error) return fail("rpc_failed");

  const row = unwrapStakeRow<ClaimRpcRow>(data);
  if (!row) return fail("rpc_no_row");

  if (!row.success) {
    return fail(mapStakeError(row.error_message, CLAIM_ERROR_CODES, "rpc_failed"), {
      daysSettled: Number(row.days_settled ?? 0),
    });
  }

  return {
    ok: true,
    reward: Number(row.reward),
    daysSettled: Number(row.days_settled),
    newBalance: Number(row.new_available),
  };
}

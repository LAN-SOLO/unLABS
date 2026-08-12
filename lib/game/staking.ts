/**
 * Staking helpers — pure domain logic for the _unSC staking system.
 *
 * The DB side lives in supabase/migrations/20260812000002_staking.sql:
 * single-pot staking on `balances.staked`, a 7-day lock that restarts on
 * every stake, and rewards of 0.5% of the staked amount per FULL elapsed
 * day since `staking_state.last_claim_at`, paid from the deflationary
 * reserve (source 'staking') on claim.
 *
 * This module is NOT marked 'use server' — it's a plain library consumed
 * by app/(game)/actions/staking.ts (same split as lib/game/economy.ts).
 * Keeping the row-unwrapping / error-mapping / accrual math here means it
 * can be unit-tested without booting the Next.js server-action runtime
 * (which drags in next/headers via lib/supabase/server).
 */

// ── Constants ─────────────────────────────────────────────────────────

/** Reward rate in percent per full staked day (mirrors `0.005` in the SQL). */
export const STAKING_DAILY_RATE_PCT = 0.5;

/** Same rate as a fraction, for arithmetic. */
export const STAKING_DAILY_RATE = STAKING_DAILY_RATE_PCT / 100;

const MS_PER_DAY = 86_400_000;

// ── Accrual math ──────────────────────────────────────────────────────

export interface PendingRewards {
  /** Full days elapsed since the claim anchor (never negative). */
  pendingDays: number;
  /** floor(staked × 0.005 × pendingDays) — mirrors stake_claim_rewards(). */
  pendingReward: number;
}

/**
 * Client-side mirror of the accrual computed by `stake_claim_rewards()`:
 * full days since `lastClaimAt`, floored, and the floored reward on the
 * CURRENT staked amount. Purely informational — the DB recomputes with
 * its own clock on claim, so treat this as a display estimate.
 */
export function computePending(
  staked: number,
  lastClaimAt: string | Date | null | undefined,
  now: Date = new Date(),
): PendingRewards {
  const none: PendingRewards = { pendingDays: 0, pendingReward: 0 };
  if (!lastClaimAt || !Number.isFinite(staked) || staked <= 0) return none;

  const anchor = lastClaimAt instanceof Date ? lastClaimAt : new Date(lastClaimAt);
  const anchorMs = anchor.getTime();
  if (Number.isNaN(anchorMs)) return none;

  const days = Math.floor((now.getTime() - anchorMs) / MS_PER_DAY);
  if (days < 1) return none;

  return {
    pendingDays: days,
    pendingReward: Math.floor(staked * STAKING_DAILY_RATE * days),
  };
}

// ── Amount validation ─────────────────────────────────────────────────

/**
 * Normalize a caller-supplied stake/unstake amount.
 *
 * _unSC stake movements are whole tokens: fractional inputs are FLOORED
 * (never rounded up — the action must not move more than the caller
 * asked for). Non-finite values and anything that floors to <= 0 are
 * rejected with `null`, mirroring the RPCs' `invalid_amount` guard so we
 * never burn a round-trip on an amount the DB would refuse anyway.
 */
export function normalizeStakeAmount(amount: number): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const whole = Math.floor(amount);
  return whole > 0 ? whole : null;
}

// ── RPC row unwrapping ────────────────────────────────────────────────

/** Row returned by `unsc_stake` (RETURNS TABLE ⇒ arrives as an array). */
export interface StakeRpcRow {
  success: boolean;
  new_available: number | string;
  new_staked: number | string;
  lock_until: string | null;
  error_message: string | null;
}

/** Row returned by `unsc_unstake`. */
export interface UnstakeRpcRow {
  success: boolean;
  new_available: number | string;
  new_staked: number | string;
  error_message: string | null;
}

/** Row returned by `stake_claim_rewards`. */
export interface ClaimRpcRow {
  success: boolean;
  reward: number | string;
  days_settled: number;
  new_available: number | string;
  error_message: string | null;
}

/**
 * Unwrap the first row of a `RETURNS TABLE` RPC payload (the same
 * pattern as `firstRpcRow` in lib/game/economy.ts): PostgREST surfaces
 * these as arrays; a non-array or empty payload yields `null`.
 */
export function unwrapStakeRow<T>(data: unknown): T | null {
  if (!Array.isArray(data)) return null;
  return (data[0] as T) ?? null;
}

// ── Error mapping ─────────────────────────────────────────────────────

/** `error_message` values `unsc_stake` can emit. */
export const STAKE_ERROR_CODES = [
  "unauthorized",
  "invalid_amount",
  "not_found",
  "insufficient_funds",
] as const;

/** `error_message` values `unsc_unstake` can emit. */
export const UNSTAKE_ERROR_CODES = [
  "unauthorized",
  "invalid_amount",
  "locked",
  "not_found",
  "insufficient_staked",
] as const;

/**
 * `error_message` values `stake_claim_rewards` can emit. The reserve
 * codes (`reserve_insufficient`, `source_not_allowed`) are passed
 * through verbatim from `reserve_burn_and_award`; `award_failed` is the
 * claim RPC's own fallback when the award fails without a message.
 */
export const CLAIM_ERROR_CODES = [
  "unauthorized",
  "nothing_staked",
  "nothing_accrued",
  "reserve_insufficient",
  "source_not_allowed",
  "award_failed",
] as const;

/**
 * Map a DB `error_message` onto a typed code: known messages pass
 * through, anything unknown (or missing) collapses to `fallback` so a
 * new DB-side message can never widen the action's error union.
 */
export function mapStakeError<C extends string, F extends string>(
  message: string | null | undefined,
  known: readonly C[],
  fallback: F,
): C | F {
  if (message && (known as readonly string[]).includes(message)) return message as C;
  return fallback;
}

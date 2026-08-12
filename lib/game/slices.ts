/**
 * Slice manipulation helpers — pure domain logic for merge / split / swap.
 *
 * The DB side lives in supabase/migrations/20260812000004_slice_ops.sql:
 * SECURITY DEFINER RPCs `slice_merge`, `slice_split`, `slice_swap` that
 * burn a flat _unSC fee via `unsc_burn`, shuffle power between slices of
 * player-owned crystals, and never create power — merging retains 90% of
 * the absorbed slice, splitting retains 95% across both halves. The
 * `update_crystal_stats` trigger keeps `total_power` / `slice_count`
 * fresh after every mutation.
 *
 * This module is NOT marked 'use server' — it's a plain library consumed
 * by app/(game)/actions/slices.ts and the `slice` terminal command (same
 * split as lib/game/staking.ts). Keeping the preview math / row
 * unwrapping / error mapping here means it can be unit-tested without
 * booting the Next.js server-action runtime.
 */

// ── Constants ─────────────────────────────────────────────────────────

/** Flat _unSC fee burned by `slice_merge` (mirrors `unsc_burn(10, …)`). */
export const SLICE_MERGE_FEE = 10;

/** Flat _unSC fee burned by `slice_split` (mirrors `unsc_burn(10, …)`). */
export const SLICE_SPLIT_FEE = 10;

/** Flat _unSC fee burned by `slice_swap` (mirrors `unsc_burn(15, …)`). */
export const SLICE_SWAP_FEE = 15;

/** Fraction of the absorbed slice a merge keeps (mirrors `* 0.9`). */
export const SLICE_MERGE_RETENTION = 0.9;

/** Fraction of the source each split half keeps (mirrors `* 0.475`). */
export const SLICE_SPLIT_HALF_RETENTION = 0.475;

/** Slices per crystal — positions are 1..30 (mint initializes all 30). */
export const SLICES_PER_CRYSTAL = 30;

/** DB-side cap on a single slice's power (`slices_power_bounds`). */
export const SLICE_POWER_CAP = 100;

// ── Preview math ──────────────────────────────────────────────────────

/**
 * Round to 2 decimals, half away from zero — the same convention as
 * Postgres `round(numeric, 2)`. For the negative-free power domain this
 * equals JS `Math.round` on cents; use the compute*Preview helpers when
 * mirroring an RPC exactly (they avoid binary-float drift by working on
 * integer cents).
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** DB powers carry 2 decimals — lift onto integer cents without drift. */
const toCents = (value: number): number => Math.round(value * 100);

/**
 * Power of the kept slice after a merge: `round2(keep + absorb * 0.9)`.
 *
 * Mirrors `round((v_keep.power + v_absorb.power * 0.9)::numeric, 2)` in
 * `slice_merge` EXACTLY: Postgres computes in decimal `numeric`, so a
 * naive float chain (`2.0 + 1.15 * 0.9 → 3.0349999…` → rounds DOWN to
 * 3.03 instead of 3.04) would drift on half-cent boundaries. Working on
 * integer tenth-of-cents keeps the halfway cases exact.
 */
export function computeMergePreview(keepPower: number, absorbPower: number): number {
  // keep×10 + absorb×9 in tenth-of-cents (both inputs have 2 decimals).
  const tenthCents = toCents(keepPower) * 10 + toCents(absorbPower) * 9;
  return Math.round(tenthCents / 10) / 100;
}

/**
 * Power of EACH half after a split: `round2(power * 0.475)`.
 *
 * Mirrors `round((v_source.power * 0.475)::numeric, 2)` in `slice_split`
 * with the same integer-scaled arithmetic as computeMergePreview. A
 * result of 0 corresponds to the RPC's `too_small_to_split` guard
 * (`v_half <= 0`).
 */
export function computeSplitPreview(power: number): number {
  // power × 475 in hundred-thousandths; n/1000 halfway points (k + 0.5)
  // are exact binary floats, so Math.round matches numeric round.
  const scaled = toCents(power) * 475;
  return Math.round(scaled / 1000) / 100;
}

// ── Position validation ───────────────────────────────────────────────

/**
 * Normalize a caller-supplied slice position: coerce with `Number()`,
 * then require an integer in 1..SLICES_PER_CRYSTAL. Anything else is
 * rejected with `null` so we never burn a round-trip on a position the
 * DB has no slice for anyway.
 */
export function normalizeSlicePosition(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return n >= 1 && n <= SLICES_PER_CRYSTAL ? n : null;
}

// ── RPC row unwrapping ────────────────────────────────────────────────

/** Row returned by `slice_merge` (RETURNS TABLE ⇒ arrives as an array). */
export interface MergeRpcRow {
  success: boolean;
  new_power: number | string;
  fee: number | string;
  error_message: string | null;
}

/** Row returned by `slice_split`. */
export interface SplitRpcRow {
  success: boolean;
  half_power: number | string;
  fee: number | string;
  error_message: string | null;
}

/** Row returned by `slice_swap`. */
export interface SwapRpcRow {
  success: boolean;
  fee: number | string;
  error_message: string | null;
}

/**
 * Unwrap the first row of a `RETURNS TABLE` RPC payload (the same
 * pattern as `unwrapStakeRow` in lib/game/staking.ts): PostgREST
 * surfaces these as arrays; a non-array or empty payload yields `null`.
 */
export function unwrapSliceRow<T>(data: unknown): T | null {
  if (!Array.isArray(data)) return null;
  return (data[0] as T) ?? null;
}

// ── Error mapping ─────────────────────────────────────────────────────

/**
 * Codes shared by all three RPCs: the auth/self-target guards plus the
 * `assert_slice_op_allowed` ownership/listing gate, the active-slice
 * lookups, and `insufficient_funds` passed through from `unsc_burn`.
 */
const SHARED_SLICE_ERROR_CODES = [
  "unauthorized",
  "same_slice",
  "crystal_not_found",
  "not_owner",
  "listed",
  "slice_not_active",
  "insufficient_funds",
] as const;

/** `error_message` values `slice_merge` can emit. */
export const MERGE_ERROR_CODES = [...SHARED_SLICE_ERROR_CODES, "merge_overflow"] as const;

/** `error_message` values `slice_split` can emit. */
export const SPLIT_ERROR_CODES = [
  ...SHARED_SLICE_ERROR_CODES,
  "no_inactive_target",
  "too_small_to_split",
] as const;

/** `error_message` values `slice_swap` can emit. */
export const SWAP_ERROR_CODES = [...SHARED_SLICE_ERROR_CODES] as const;

/**
 * Map a DB `error_message` onto a typed code: known messages pass
 * through, anything unknown (or missing — e.g. `burn_failed`, or a
 * future DB-side message) collapses to `fallback` so a new code can
 * never widen an action's error union.
 */
export function mapSliceError<C extends string, F extends string>(
  message: string | null | undefined,
  known: readonly C[],
  fallback: F,
): C | F {
  if (message && (known as readonly string[]).includes(message)) return message as C;
  return fallback;
}

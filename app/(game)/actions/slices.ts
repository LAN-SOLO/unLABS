"use server";

/**
 * Slice manipulation server actions
 * =================================
 *
 * Client half of the slice-ops layer. All mutations are SECURITY DEFINER
 * RPCs keyed on auth.uid()
 * (supabase/migrations/20260812000004_slice_ops.sql):
 *
 *   - slice_merge(id, keep, absorb) — absorb → keep at 90% retention,
 *                                     absorb slot goes inactive; 10 _unSC
 *   - slice_split(id, src, target)  — reactivates an INACTIVE slot with
 *                                     47.5% of the source each; 10 _unSC
 *   - slice_swap(a, posA, b, posB)  — swaps slices between two OWNED
 *                                     crystals; 15 _unSC
 *
 * Direct UPDATE/DELETE on `slices` is closed under RLS (value forgery
 * now that the marketplace prices crystals by total_power), and the
 * `update_crystal_stats` trigger keeps total_power/slice_count fresh —
 * these actions never recompute crystal stats themselves.
 *
 * These actions stay thin: preview math, row unwrapping, and error
 * mapping live in lib/game/slices.ts (pure, unit-tested — a
 * "use server" module may only export async functions).
 */

import { createClient } from "@/lib/supabase/server";
import {
  MERGE_ERROR_CODES,
  SPLIT_ERROR_CODES,
  SWAP_ERROR_CODES,
  mapSliceError,
  normalizeSlicePosition,
  round2,
  unwrapSliceRow,
  type MergeRpcRow,
  type SplitRpcRow,
  type SwapRpcRow,
} from "@/lib/game/slices";

// ── getCrystalSlices ──────────────────────────────────────────────────

export interface SliceView {
  /** 1..30 slot position within the crystal. */
  position: number;
  /** Slice power (2 decimals; 0-power slots only exist while inactive). */
  power: number;
  /** Inactive slots are merge leftovers — split targets. */
  isActive: boolean;
  /** Display hue (nullable in the schema). */
  hue: number | null;
}

export interface CrystalSlicesResult {
  ok: boolean;
  /** All slices of the crystal, sorted by position (empty on failure). */
  slices: SliceView[];
  /** Sum of ACTIVE slice power, rounded to 2 decimals (= total_power). */
  totalPower: number;
  error?: "not_authenticated" | "read_failed";
}

/**
 * Read the slices of one of the CALLER'S crystals (RLS only exposes
 * slices of own crystals, so foreign ids simply come back empty).
 */
export async function getCrystalSlices(crystalId: string): Promise<CrystalSlicesResult> {
  const fail = (error: NonNullable<CrystalSlicesResult["error"]>): CrystalSlicesResult => ({
    ok: false,
    slices: [],
    totalPower: 0,
    error,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated");

  const { data, error } = await supabase
    .from("slices")
    .select("position, power, is_active, hue")
    .eq("crystal_id", crystalId)
    .order("position", { ascending: true });
  if (error) return fail("read_failed");

  // Numeric columns arrive as strings over the wire — coerce here so the
  // command layer can format without re-checking.
  const slices: SliceView[] = (data ?? []).map((row) => ({
    position: Number(row.position),
    power: Number(row.power),
    isActive: Boolean(row.is_active),
    hue: row.hue === null ? null : Number(row.hue),
  }));

  const totalPower = round2(slices.reduce((sum, s) => (s.isActive ? sum + s.power : sum), 0));

  return { ok: true, slices, totalPower };
}

// ── mergeSlices ───────────────────────────────────────────────────────

export interface MergeSlicesResult {
  ok: boolean;
  /** Power of the kept slice after the merge (0 on failure). */
  newPower: number;
  /** _unSC burned by this merge (0 when nothing was charged). */
  fee: number;
  error?: "invalid_position" | (typeof MERGE_ERROR_CODES)[number] | "rpc_failed" | "rpc_no_row";
}

/**
 * Merge the slice at `posAbsorb` into the one at `posKeep` (both must be
 * active). The kept slice gains 90% of the absorbed power; the absorbed
 * slot goes inactive (a later split can reactivate it). Burns 10 _unSC.
 */
export async function mergeSlices(
  crystalId: string,
  posKeep: number,
  posAbsorb: number,
): Promise<MergeSlicesResult> {
  const fail = (
    error: NonNullable<MergeSlicesResult["error"]>,
    extras?: Partial<MergeSlicesResult>,
  ): MergeSlicesResult => ({ ok: false, newPower: 0, fee: 0, ...extras, error });

  const keep = normalizeSlicePosition(posKeep);
  const absorb = normalizeSlicePosition(posAbsorb);
  if (keep === null || absorb === null) return fail("invalid_position");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("slice_merge", {
    p_crystal_id: crystalId,
    p_pos_keep: keep,
    p_pos_absorb: absorb,
  });
  if (error) return fail("rpc_failed");

  const row = unwrapSliceRow<MergeRpcRow>(data);
  if (!row) return fail("rpc_no_row");

  if (!row.success) {
    return fail(mapSliceError(row.error_message, MERGE_ERROR_CODES, "rpc_failed"), {
      fee: Number(row.fee ?? 0),
    });
  }

  return { ok: true, newPower: Number(row.new_power), fee: Number(row.fee) };
}

// ── splitSlice ────────────────────────────────────────────────────────

export interface SplitSliceResult {
  ok: boolean;
  /** Power of EACH half after the split (0 on failure). */
  halfPower: number;
  /** _unSC burned by this split (0 when nothing was charged). */
  fee: number;
  error?: "invalid_position" | (typeof SPLIT_ERROR_CODES)[number] | "rpc_failed" | "rpc_no_row";
}

/**
 * Split the active slice at `posSource` onto the INACTIVE slot at
 * `posTarget` (a merge leftover): both end up with 47.5% of the source
 * (95% retained overall), the target reactivates with the source's
 * color. Burns 10 _unSC.
 */
export async function splitSlice(
  crystalId: string,
  posSource: number,
  posTarget: number,
): Promise<SplitSliceResult> {
  const fail = (
    error: NonNullable<SplitSliceResult["error"]>,
    extras?: Partial<SplitSliceResult>,
  ): SplitSliceResult => ({ ok: false, halfPower: 0, fee: 0, ...extras, error });

  const source = normalizeSlicePosition(posSource);
  const target = normalizeSlicePosition(posTarget);
  if (source === null || target === null) return fail("invalid_position");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("slice_split", {
    p_crystal_id: crystalId,
    p_pos_source: source,
    p_pos_target: target,
  });
  if (error) return fail("rpc_failed");

  const row = unwrapSliceRow<SplitRpcRow>(data);
  if (!row) return fail("rpc_no_row");

  if (!row.success) {
    return fail(mapSliceError(row.error_message, SPLIT_ERROR_CODES, "rpc_failed"), {
      fee: Number(row.fee ?? 0),
    });
  }

  return { ok: true, halfPower: Number(row.half_power), fee: Number(row.fee) };
}

// ── swapSlices ────────────────────────────────────────────────────────

export interface SwapSlicesResult {
  ok: boolean;
  /** _unSC burned by this swap (0 when nothing was charged). */
  fee: number;
  error?: "invalid_position" | (typeof SWAP_ERROR_CODES)[number] | "rpc_failed" | "rpc_no_row";
}

/**
 * Swap the active slices at (`crystalA`, `posA`) and (`crystalB`,
 * `posB`) — both crystals must be owned by the caller and unlisted.
 * Power AND color move together. Burns 15 _unSC.
 */
export async function swapSlices(
  crystalA: string,
  posA: number,
  crystalB: string,
  posB: number,
): Promise<SwapSlicesResult> {
  const fail = (
    error: NonNullable<SwapSlicesResult["error"]>,
    extras?: Partial<SwapSlicesResult>,
  ): SwapSlicesResult => ({ ok: false, fee: 0, ...extras, error });

  const a = normalizeSlicePosition(posA);
  const b = normalizeSlicePosition(posB);
  if (a === null || b === null) return fail("invalid_position");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("slice_swap", {
    p_crystal_a: crystalA,
    p_pos_a: a,
    p_crystal_b: crystalB,
    p_pos_b: b,
  });
  if (error) return fail("rpc_failed");

  const row = unwrapSliceRow<SwapRpcRow>(data);
  if (!row) return fail("rpc_no_row");

  if (!row.success) {
    return fail(mapSliceError(row.error_message, SWAP_ERROR_CODES, "rpc_failed"), {
      fee: Number(row.fee ?? 0),
    });
  }

  return { ok: true, fee: Number(row.fee) };
}

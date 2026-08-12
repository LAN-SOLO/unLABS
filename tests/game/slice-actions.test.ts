import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  MERGE_ERROR_CODES,
  SLICE_MERGE_FEE,
  SLICE_SPLIT_FEE,
  SLICE_SWAP_FEE,
  SPLIT_ERROR_CODES,
  SWAP_ERROR_CODES,
  computeMergePreview,
  computeSplitPreview,
  mapSliceError,
  normalizeSlicePosition,
  round2,
  unwrapSliceRow,
} from "@/lib/game/slices";

/**
 * The RPCs themselves (locking, RLS closure, burn wiring, the
 * update_crystal_stats trigger) are covered by the DB-side migration
 * (20260812000004_slice_ops.sql); these tests cover the TypeScript side:
 * preview math (including agreement with SQL `round(numeric, 2)` on
 * half-cent boundaries), position validation, row unwrapping, error
 * mapping with per-RPC code-set isolation, and the action wiring.
 *
 * The actions import lib/supabase/server (→ next/headers), so the client
 * factory is mocked wholesale; the mock fns live in vi.hoisted() because
 * vi.mock factories are hoisted above imports.
 */

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    rpc: h.rpc,
    from: h.from,
  }),
}));

import { getCrystalSlices, mergeSlices, splitSlice, swapSlices } from "@/app/(game)/actions/slices";

// ── Mock plumbing ─────────────────────────────────────────────────────

function authAs(userId: string | null) {
  h.getUser.mockResolvedValue({ data: { user: userId ? { id: userId } : null } });
}

/** Minimal select().eq().order() chain for the `slices` table. */
function slicesTable(result: { data: unknown; error?: unknown }) {
  h.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        order: async () => ({ data: result.data, error: result.error ?? null }),
      }),
    }),
  }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  authAs("u1");
  slicesTable({ data: [] });
  h.rpc.mockResolvedValue({ data: null, error: { message: "no rpc mock set" } });
});

// ── Preview math ──────────────────────────────────────────────────────

describe("computeMergePreview", () => {
  it("keeps 90% of the absorbed slice, rounded to 2 decimals", () => {
    // 2.5 + 1.0 × 0.9 = 3.4
    expect(computeMergePreview(2.5, 1.0)).toBe(3.4);
    // 0.01 absorbed → 0.009 → rounds to 0.01
    expect(computeMergePreview(1.0, 0.01)).toBe(1.01);
  });

  it("matches SQL round(numeric, 2) on half-cent boundaries", () => {
    // 2.00 + 1.15 × 0.9 = 3.035 — SQL numeric rounds half away from zero
    // to 3.04, while the naive float chain lands on 3.0349999… → 3.03.
    expect(2.0 + 1.15 * 0.9).toBeCloseTo(3.0349999999999997, 12);
    expect(computeMergePreview(2.0, 1.15)).toBe(3.04);
    // 0.30 + 0.05 × 0.9 = 0.345 → 0.35 (not 0.34)
    expect(computeMergePreview(0.3, 0.05)).toBe(0.35);
  });

  it("never creates power (result ≤ keep + absorb)", () => {
    for (const [keep, absorb] of [
      [2.4, 2.4],
      [0.01, 0.01],
      [72.5, 10.33],
    ] as const) {
      expect(computeMergePreview(keep, absorb)).toBeLessThanOrEqual(round2(keep + absorb));
    }
  });
});

describe("computeSplitPreview", () => {
  it("gives each half 47.5% of the source, rounded to 2 decimals", () => {
    // 2.40 × 0.475 = 1.14 exactly
    expect(computeSplitPreview(2.4)).toBe(1.14);
    // 1.15 × 0.475 = 0.54625 → 0.55
    expect(computeSplitPreview(1.15)).toBe(0.55);
  });

  it("matches SQL round(numeric, 2) on half-cent boundaries", () => {
    // 0.20 × 0.475 = 0.095 → SQL rounds half away from zero to 0.10
    expect(computeSplitPreview(0.2)).toBe(0.1);
    // 0.02 × 0.475 = 0.0095 → 0.01
    expect(computeSplitPreview(0.02)).toBe(0.01);
  });

  it("returns 0 for powers the RPC rejects as too_small_to_split", () => {
    // 0.01 × 0.475 = 0.00475 → round2 → 0 → DB guard `v_half <= 0`
    expect(computeSplitPreview(0.01)).toBe(0);
    expect(computeSplitPreview(0)).toBe(0);
  });
});

describe("round2", () => {
  it("rounds to 2 decimals, half away from zero for positive values", () => {
    expect(round2(1.005000001)).toBe(1.01);
    expect(round2(3.115000001)).toBe(3.12);
    expect(round2(2.104)).toBe(2.1);
  });
});

// ── Position validation ───────────────────────────────────────────────

describe("normalizeSlicePosition", () => {
  it("accepts integers 1..30, coercing numeric strings", () => {
    expect(normalizeSlicePosition(1)).toBe(1);
    expect(normalizeSlicePosition(30)).toBe(30);
    expect(normalizeSlicePosition("7")).toBe(7);
  });

  it("rejects out-of-range, fractional, and non-numeric values", () => {
    for (const bad of [0, 31, -3, 1.5, "4.2", "x", "", null, undefined, Number.NaN]) {
      expect(normalizeSlicePosition(bad)).toBeNull();
    }
  });
});

// ── Row unwrapping ────────────────────────────────────────────────────

describe("unwrapSliceRow", () => {
  it("returns the first row of an array payload", () => {
    expect(unwrapSliceRow([{ success: true }, { success: false }])).toEqual({ success: true });
  });

  it("returns null for empty arrays and non-array payloads", () => {
    expect(unwrapSliceRow([])).toBeNull();
    expect(unwrapSliceRow(null)).toBeNull();
    expect(unwrapSliceRow({ success: true })).toBeNull();
  });
});

// ── Error mapping ─────────────────────────────────────────────────────

describe("mapSliceError", () => {
  it("passes known codes through for each RPC's code set", () => {
    for (const c of MERGE_ERROR_CODES)
      expect(mapSliceError(c, MERGE_ERROR_CODES, "rpc_failed")).toBe(c);
    for (const c of SPLIT_ERROR_CODES)
      expect(mapSliceError(c, SPLIT_ERROR_CODES, "rpc_failed")).toBe(c);
    for (const c of SWAP_ERROR_CODES)
      expect(mapSliceError(c, SWAP_ERROR_CODES, "rpc_failed")).toBe(c);
  });

  it("collapses unknown or missing messages to the fallback", () => {
    expect(mapSliceError("burn_failed", MERGE_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
    expect(mapSliceError(null, MERGE_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
    expect(mapSliceError(undefined, SWAP_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
  });

  it("keeps codes isolated per set (no cross-RPC leakage)", () => {
    // merge_overflow is merge-only
    expect(mapSliceError("merge_overflow", SPLIT_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
    expect(mapSliceError("merge_overflow", SWAP_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
    // no_inactive_target / too_small_to_split are split-only
    expect(mapSliceError("no_inactive_target", MERGE_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
    expect(mapSliceError("too_small_to_split", SWAP_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
  });

  it("agrees with the exported fee constants", () => {
    expect(SLICE_MERGE_FEE).toBe(10);
    expect(SLICE_SPLIT_FEE).toBe(10);
    expect(SLICE_SWAP_FEE).toBe(15);
  });
});

// ── getCrystalSlices ──────────────────────────────────────────────────

describe("getCrystalSlices", () => {
  it("fails with not_authenticated when there is no user", async () => {
    authAs(null);
    const r = await getCrystalSlices("c1");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not_authenticated");
  });

  it("fails with read_failed when the query errors", async () => {
    slicesTable({ data: null, error: { message: "boom" } });
    const r = await getCrystalSlices("c1");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("read_failed");
  });

  it("coerces numeric strings and sums only ACTIVE slices into totalPower", async () => {
    slicesTable({
      // numeric columns arrive as strings over the wire — must coerce
      data: [
        { position: 1, power: "2.40", is_active: true, hue: "120" },
        { position: 2, power: "1.15", is_active: false, hue: null },
        { position: 3, power: "0.55", is_active: true, hue: 240 },
      ],
    });
    const r = await getCrystalSlices("c1");
    expect(r.ok).toBe(true);
    expect(r.slices).toEqual([
      { position: 1, power: 2.4, isActive: true, hue: 120 },
      { position: 2, power: 1.15, isActive: false, hue: null },
      { position: 3, power: 0.55, isActive: true, hue: 240 },
    ]);
    // 2.40 + 0.55 — the inactive 1.15 does not count
    expect(r.totalPower).toBe(2.95);
  });

  it("returns ok with empty slices for an unknown/foreign crystal (RLS)", async () => {
    slicesTable({ data: [] });
    const r = await getCrystalSlices("someone-elses");
    expect(r.ok).toBe(true);
    expect(r.slices).toEqual([]);
    expect(r.totalPower).toBe(0);
  });
});

// ── mergeSlices ───────────────────────────────────────────────────────

describe("mergeSlices", () => {
  it("rejects invalid positions without touching the RPC", async () => {
    for (const [keep, absorb] of [
      [0, 5],
      [5, 31],
      [1.5, 2],
      [Number.NaN, 2],
    ] as const) {
      const r = await mergeSlices("c1", keep, absorb);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("invalid_position");
    }
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("calls slice_merge with the right params and unwraps the row", async () => {
    h.rpc.mockImplementation(async (name: string, params: unknown) => {
      expect(name).toBe("slice_merge");
      expect(params).toEqual({ p_crystal_id: "c1", p_pos_keep: 4, p_pos_absorb: 7 });
      return {
        data: [{ success: true, new_power: "3.10", fee: "10", error_message: null }],
        error: null,
      };
    });
    const r = await mergeSlices("c1", 4, 7);
    expect(r).toEqual({ ok: true, newPower: 3.1, fee: 10 });
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("maps DB error_message to typed codes and keeps the reported fee", async () => {
    const cases: Array<[string, string]> = [
      ["unauthorized", "unauthorized"],
      ["same_slice", "same_slice"],
      ["crystal_not_found", "crystal_not_found"],
      ["not_owner", "not_owner"],
      ["listed", "listed"],
      ["slice_not_active", "slice_not_active"],
      ["merge_overflow", "merge_overflow"],
      ["insufficient_funds", "insufficient_funds"],
      // split-only and unsc_burn-internal codes collapse to rpc_failed
      ["no_inactive_target", "rpc_failed"],
      ["burn_failed", "rpc_failed"],
    ];
    for (const [dbMsg, expected] of cases) {
      h.rpc.mockResolvedValue({
        data: [{ success: false, new_power: 0, fee: 10, error_message: dbMsg }],
        error: null,
      });
      const r = await mergeSlices("c1", 4, 7);
      expect(r.ok).toBe(false);
      expect(r.error).toBe(expected);
      expect(r.fee).toBe(10);
      expect(r.newPower).toBe(0);
    }
  });

  it("returns rpc_failed on transport error and rpc_no_row on empty payload", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "network" } });
    expect((await mergeSlices("c1", 1, 2)).error).toBe("rpc_failed");
    h.rpc.mockResolvedValue({ data: [], error: null });
    expect((await mergeSlices("c1", 1, 2)).error).toBe("rpc_no_row");
  });
});

// ── splitSlice ────────────────────────────────────────────────────────

describe("splitSlice", () => {
  it("rejects invalid positions without touching the RPC", async () => {
    const r = await splitSlice("c1", 0, 5);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_position");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("calls slice_split with the right params and unwraps the row", async () => {
    h.rpc.mockImplementation(async (name: string, params: unknown) => {
      expect(name).toBe("slice_split");
      expect(params).toEqual({ p_crystal_id: "c1", p_pos_source: 4, p_pos_target: 9 });
      return {
        data: [{ success: true, half_power: "1.02", fee: 10, error_message: null }],
        error: null,
      };
    });
    const r = await splitSlice("c1", 4, 9);
    expect(r).toEqual({ ok: true, halfPower: 1.02, fee: 10 });
  });

  it("maps its own codes; merge-only codes collapse to rpc_failed", async () => {
    const cases: Array<[string, string]> = [
      ["no_inactive_target", "no_inactive_target"],
      ["too_small_to_split", "too_small_to_split"],
      ["listed", "listed"],
      ["insufficient_funds", "insufficient_funds"],
      ["merge_overflow", "rpc_failed"],
    ];
    for (const [dbMsg, expected] of cases) {
      h.rpc.mockResolvedValue({
        data: [{ success: false, half_power: 0, fee: 10, error_message: dbMsg }],
        error: null,
      });
      const r = await splitSlice("c1", 4, 9);
      expect(r.ok).toBe(false);
      expect(r.error).toBe(expected);
      expect(r.fee).toBe(10);
    }
  });

  it("returns rpc_failed / rpc_no_row on transport failures", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "network" } });
    expect((await splitSlice("c1", 1, 2)).error).toBe("rpc_failed");
    h.rpc.mockResolvedValue({ data: [], error: null });
    expect((await splitSlice("c1", 1, 2)).error).toBe("rpc_no_row");
  });
});

// ── swapSlices ────────────────────────────────────────────────────────

describe("swapSlices", () => {
  it("rejects invalid positions without touching the RPC", async () => {
    const r = await swapSlices("cA", 3, "cB", 99);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_position");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("calls slice_swap with both crystal/position pairs and unwraps the row", async () => {
    h.rpc.mockImplementation(async (name: string, params: unknown) => {
      expect(name).toBe("slice_swap");
      expect(params).toEqual({ p_crystal_a: "cA", p_pos_a: 3, p_crystal_b: "cB", p_pos_b: 7 });
      return {
        data: [{ success: true, fee: "15", error_message: null }],
        error: null,
      };
    });
    const r = await swapSlices("cA", 3, "cB", 7);
    expect(r).toEqual({ ok: true, fee: 15 });
  });

  it("maps shared codes; merge/split-only codes collapse to rpc_failed", async () => {
    const cases: Array<[string, string]> = [
      ["same_slice", "same_slice"],
      ["not_owner", "not_owner"],
      ["listed", "listed"],
      ["slice_not_active", "slice_not_active"],
      ["insufficient_funds", "insufficient_funds"],
      ["merge_overflow", "rpc_failed"],
      ["no_inactive_target", "rpc_failed"],
    ];
    for (const [dbMsg, expected] of cases) {
      h.rpc.mockResolvedValue({
        data: [{ success: false, fee: 15, error_message: dbMsg }],
        error: null,
      });
      const r = await swapSlices("cA", 3, "cB", 7);
      expect(r.ok).toBe(false);
      expect(r.error).toBe(expected);
      expect(r.fee).toBe(15);
    }
  });

  it("returns rpc_failed / rpc_no_row on transport failures", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "network" } });
    expect((await swapSlices("cA", 1, "cB", 2)).error).toBe("rpc_failed");
    h.rpc.mockResolvedValue({ data: [], error: null });
    expect((await swapSlices("cA", 1, "cB", 2)).error).toBe("rpc_no_row");
  });
});

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAchievement } from "@/lib/game/achievements";
import { verifyBranchServerSide } from "@/lib/game/achievements/verify";
import type { Achievement } from "@/lib/game/achievements/types";

/**
 * Unit tests for the server-side achievement verification (anti-cheat
 * backstop in claimAchievement). Mirrors the mock pattern of
 * tests/game/economy-reserve.test.ts: no live DB — we mock the PostgREST
 * query builder and assert on filters + decision logic.
 */

// ── Mock query builder ────────────────────────────────────────────────

interface MockResult {
  data?: unknown;
  count?: number | null;
  error?: { message: string } | null;
}

interface MockBuilder extends PromiseLike<MockResult> {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  /** Recorded [column, value] pairs from every eq() call. */
  eqCalls: Array<[string, unknown]>;
}

/** Chainable thenable mimicking supabase-js query builders. */
function mockQuery(result: MockResult): MockBuilder {
  const resolved: MockResult = {
    data: result.data ?? null,
    count: result.count ?? null,
    error: result.error ?? null,
  };
  const eqCalls: Array<[string, unknown]> = [];
  const builder: MockBuilder = {
    eqCalls,
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    }),
    maybeSingle: vi.fn(async () => ({ data: resolved.data, error: resolved.error })),
    then: <T, U>(
      onfulfilled?: ((value: MockResult) => T | PromiseLike<T>) | null,
      onrejected?: ((reason: unknown) => U | PromiseLike<U>) | null,
    ) => Promise.resolve(resolved).then(onfulfilled, onrejected),
  };
  return builder;
}

function mockSupabase(tables: Record<string, MockBuilder>): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      const builder = tables[table];
      if (!builder) throw new Error(`unexpected table: ${table}`);
      return builder;
    }),
  } as unknown as SupabaseClient;
}

function mustGet(id: string): Achievement {
  const a = getAchievement(id);
  if (!a) throw new Error(`achievement ${id} missing from catalog`);
  return a;
}

// ── construction ──────────────────────────────────────────────────────

describe("verifyBranchServerSide — construction", () => {
  const tinkerer = mustGet("construction.tinkerer.t1"); // target: 3 claimed jobs

  it("is satisfied when claimed-job count meets the target", async () => {
    const jobs = mockQuery({ count: 3 });
    const supabase = mockSupabase({ production_jobs: jobs });
    const r = await verifyBranchServerSide(supabase, "u1", tinkerer);
    expect(r).toEqual({ verifiable: true, satisfied: true });
    // Filters: own rows, claimed only — no date/recipe filter (lifetime count).
    expect(jobs.eqCalls).toEqual([
      ["user_id", "u1"],
      ["status", "claimed"],
    ]);
    expect(jobs.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
  });

  it("is unsatisfied below the target, whatever the progress row claims", async () => {
    const supabase = mockSupabase({ production_jobs: mockQuery({ count: 2 }) });
    const r = await verifyBranchServerSide(supabase, "u1", tinkerer);
    expect(r).toEqual({ verifiable: true, satisfied: false });
  });

  it("treats a null count as zero", async () => {
    const supabase = mockSupabase({ production_jobs: mockQuery({ count: null }) });
    const r = await verifyBranchServerSide(supabase, "u1", tinkerer);
    expect(r).toEqual({ verifiable: true, satisfied: false });
  });

  it("degrades to not-verifiable on query error (fail open to legacy path)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supabase = mockSupabase({
      production_jobs: mockQuery({ error: { message: "network" } }),
    });
    const r = await verifyBranchServerSide(supabase, "u1", tinkerer);
    expect(r).toEqual({ verifiable: false, satisfied: false });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("uses the tier target (t3 needs 30 jobs)", async () => {
    const t3 = mustGet("construction.tinkerer.t3");
    expect(t3.target).toBe(30);
    const supabase = mockSupabase({ production_jobs: mockQuery({ count: 29 }) });
    const r = await verifyBranchServerSide(supabase, "u1", t3);
    expect(r).toEqual({ verifiable: true, satisfied: false });
  });
});

// ── breadth ───────────────────────────────────────────────────────────

describe("verifyBranchServerSide — breadth", () => {
  const jack = mustGet("breadth.jack_of_all_trades.t1"); // target: 2 distinct recipes

  it("counts distinct recipes, not rows", async () => {
    // 4 claimed jobs but only 1 distinct recipe -> unsatisfied.
    const rows = [
      { recipe_id: "energy_cell" },
      { recipe_id: "energy_cell" },
      { recipe_id: "energy_cell" },
      { recipe_id: "energy_cell" },
    ];
    const supabase = mockSupabase({ production_jobs: mockQuery({ data: rows }) });
    const r = await verifyBranchServerSide(supabase, "u1", jack);
    expect(r).toEqual({ verifiable: true, satisfied: false });
  });

  it("is satisfied with enough distinct recipes", async () => {
    const jobs = mockQuery({
      data: [{ recipe_id: "energy_cell" }, { recipe_id: "coolant" }, { recipe_id: "energy_cell" }],
    });
    const supabase = mockSupabase({ production_jobs: jobs });
    const r = await verifyBranchServerSide(supabase, "u1", jack);
    expect(r).toEqual({ verifiable: true, satisfied: true });
    expect(jobs.eqCalls).toEqual([
      ["user_id", "u1"],
      ["status", "claimed"],
    ]);
  });

  it("handles an empty job list", async () => {
    const supabase = mockSupabase({ production_jobs: mockQuery({ data: [] }) });
    const r = await verifyBranchServerSide(supabase, "u1", jack);
    expect(r).toEqual({ verifiable: true, satisfied: false });
  });

  it("degrades to not-verifiable on query error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supabase = mockSupabase({
      production_jobs: mockQuery({ error: { message: "boom" } }),
    });
    const r = await verifyBranchServerSide(supabase, "u1", jack);
    expect(r).toEqual({ verifiable: false, satisfied: false });
    warn.mockRestore();
  });
});

// ── trade ─────────────────────────────────────────────────────────────

describe("verifyBranchServerSide — trade", () => {
  const novice = mustGet("trade.novice.t1"); // target: 50 spent

  it("is satisfied when balances.total_spent meets the target", async () => {
    const balances = mockQuery({ data: { total_spent: 50 } });
    const supabase = mockSupabase({ balances });
    const r = await verifyBranchServerSide(supabase, "u1", novice);
    expect(r).toEqual({ verifiable: true, satisfied: true });
    expect(balances.eqCalls).toEqual([["user_id", "u1"]]);
    expect(balances.maybeSingle).toHaveBeenCalled();
  });

  it("coerces numeric strings (Postgres numeric over the wire)", async () => {
    const supabase = mockSupabase({ balances: mockQuery({ data: { total_spent: "150.5" } }) });
    const r = await verifyBranchServerSide(supabase, "u1", novice);
    expect(r).toEqual({ verifiable: true, satisfied: true });
  });

  it("is unsatisfied below the target", async () => {
    const supabase = mockSupabase({ balances: mockQuery({ data: { total_spent: 49.99 } }) });
    const r = await verifyBranchServerSide(supabase, "u1", novice);
    expect(r).toEqual({ verifiable: true, satisfied: false });
  });

  it("treats a missing balance row as zero spent (verifiably short)", async () => {
    const supabase = mockSupabase({ balances: mockQuery({ data: null }) });
    const r = await verifyBranchServerSide(supabase, "u1", novice);
    expect(r).toEqual({ verifiable: true, satisfied: false });
  });

  it("degrades to not-verifiable on query error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supabase = mockSupabase({ balances: mockQuery({ error: { message: "boom" } }) });
    const r = await verifyBranchServerSide(supabase, "u1", novice);
    expect(r).toEqual({ verifiable: false, satisfied: false });
    warn.mockRestore();
  });
});

// ── non-verifiable branches ───────────────────────────────────────────

describe("verifyBranchServerSide — client-trusted branches", () => {
  it.each(["resource.dabbler.t1", "energy.first_spark.t1", "exploration.first_glimpse.t1"])(
    "%s returns not-verifiable without touching the DB",
    async (id) => {
      const from = vi.fn();
      const supabase = { from } as unknown as SupabaseClient;
      const r = await verifyBranchServerSide(supabase, "u1", mustGet(id));
      expect(r).toEqual({ verifiable: false, satisfied: false });
      expect(from).not.toHaveBeenCalled();
    },
  );
});

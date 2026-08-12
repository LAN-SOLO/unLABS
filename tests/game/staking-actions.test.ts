import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  CLAIM_ERROR_CODES,
  STAKE_ERROR_CODES,
  STAKING_DAILY_RATE_PCT,
  UNSTAKE_ERROR_CODES,
  computePending,
  mapStakeError,
  normalizeStakeAmount,
  unwrapStakeRow,
} from "@/lib/game/staking";

/**
 * The RPCs themselves (locking, reserve funding, anchor semantics) are
 * covered by the DB-side migration; these tests cover the TypeScript
 * side: accrual math, amount validation, row unwrapping, error mapping,
 * and the action wiring (parameters, claim-before-stake, `locked`
 * lock_until lookup).
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

import {
  claimStakingRewards,
  getStakingStatus,
  stake,
  unstake,
} from "@/app/(game)/actions/staking";

// ── Mock plumbing ─────────────────────────────────────────────────────

const DAY = 86_400_000;

function authAs(userId: string | null) {
  h.getUser.mockResolvedValue({ data: { user: userId ? { id: userId } : null } });
}

/** Minimal select().eq().maybeSingle() chain keyed by table name. */
function tables(rows: Record<string, { data: unknown; error?: unknown }>) {
  h.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: rows[table]?.data ?? null,
          error: rows[table]?.error ?? null,
        }),
      }),
    }),
  }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  authAs("u1");
  tables({});
  h.rpc.mockResolvedValue({ data: null, error: { message: "no rpc mock set" } });
});

// ── Pure helpers ──────────────────────────────────────────────────────

describe("computePending", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("returns zero before the first full day has elapsed", () => {
    const anchor = new Date(now.getTime() - DAY + 1).toISOString();
    expect(computePending(1000, anchor, now)).toEqual({ pendingDays: 0, pendingReward: 0 });
  });

  it("floors to full days and applies 0.5% per day", () => {
    const anchor = new Date(now.getTime() - 2.9 * DAY).toISOString();
    // 2 full days × 0.5% × 1000 = 10
    expect(computePending(1000, anchor, now)).toEqual({ pendingDays: 2, pendingReward: 10 });
  });

  it("floors the reward (sub-1 rewards stay at 0 tokens)", () => {
    const anchor = new Date(now.getTime() - 1 * DAY).toISOString();
    // 100 × 0.005 × 1 = 0.5 → floor 0
    expect(computePending(100, anchor, now)).toEqual({ pendingDays: 1, pendingReward: 0 });
    // 350 × 0.005 × 1 = 1.75 → floor 1
    expect(computePending(350, anchor, now)).toEqual({ pendingDays: 1, pendingReward: 1 });
  });

  it("returns zero for missing anchor, invalid anchor, or nothing staked", () => {
    const anchor = new Date(now.getTime() - 5 * DAY).toISOString();
    expect(computePending(1000, null, now)).toEqual({ pendingDays: 0, pendingReward: 0 });
    expect(computePending(1000, "not-a-date", now)).toEqual({ pendingDays: 0, pendingReward: 0 });
    expect(computePending(0, anchor, now)).toEqual({ pendingDays: 0, pendingReward: 0 });
    expect(computePending(Number.NaN, anchor, now)).toEqual({ pendingDays: 0, pendingReward: 0 });
  });

  it("clamps a future anchor to zero instead of going negative", () => {
    const anchor = new Date(now.getTime() + 3 * DAY).toISOString();
    expect(computePending(1000, anchor, now)).toEqual({ pendingDays: 0, pendingReward: 0 });
  });

  it("agrees with the exported rate constant", () => {
    expect(STAKING_DAILY_RATE_PCT).toBe(0.5);
  });
});

describe("normalizeStakeAmount", () => {
  it("floors fractional amounts", () => {
    expect(normalizeStakeAmount(10.9)).toBe(10);
    expect(normalizeStakeAmount(7)).toBe(7);
  });

  it("rejects non-finite, non-positive, and sub-1 amounts", () => {
    for (const bad of [
      0,
      -5,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(normalizeStakeAmount(bad)).toBeNull();
    }
  });
});

describe("unwrapStakeRow", () => {
  it("returns the first row of an array payload", () => {
    expect(unwrapStakeRow([{ success: true }, { success: false }])).toEqual({ success: true });
  });

  it("returns null for empty arrays and non-array payloads", () => {
    expect(unwrapStakeRow([])).toBeNull();
    expect(unwrapStakeRow(null)).toBeNull();
    expect(unwrapStakeRow({ success: true })).toBeNull();
  });
});

describe("mapStakeError", () => {
  it("passes known codes through for each RPC's code set", () => {
    for (const c of STAKE_ERROR_CODES)
      expect(mapStakeError(c, STAKE_ERROR_CODES, "rpc_failed")).toBe(c);
    for (const c of UNSTAKE_ERROR_CODES)
      expect(mapStakeError(c, UNSTAKE_ERROR_CODES, "rpc_failed")).toBe(c);
    for (const c of CLAIM_ERROR_CODES)
      expect(mapStakeError(c, CLAIM_ERROR_CODES, "rpc_failed")).toBe(c);
  });

  it("collapses unknown or missing messages to the fallback", () => {
    expect(mapStakeError("something_new", STAKE_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
    expect(mapStakeError(null, STAKE_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
    expect(mapStakeError(undefined, CLAIM_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
    // codes are not shared across sets: `locked` is unstake-only
    expect(mapStakeError("locked", STAKE_ERROR_CODES, "rpc_failed")).toBe("rpc_failed");
  });
});

// ── getStakingStatus ──────────────────────────────────────────────────

describe("getStakingStatus", () => {
  it("fails with not_authenticated when there is no user", async () => {
    authAs(null);
    const r = await getStakingStatus();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not_authenticated");
  });

  it("fails with not_found when there is no balances row", async () => {
    tables({ balances: { data: null } });
    const r = await getStakingStatus();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not_found");
  });

  it("derives pending rewards and lock state from balances + staking_state", async () => {
    const lockUntil = new Date(Date.now() + 3 * DAY).toISOString();
    const lastClaimAt = new Date(Date.now() - 2.5 * DAY).toISOString();
    tables({
      // numeric columns arrive as strings over the wire — must coerce
      balances: { data: { available: "150", staked: "1000" } },
      staking_state: { data: { lock_until: lockUntil, last_claim_at: lastClaimAt } },
    });
    const r = await getStakingStatus();
    expect(r).toEqual({
      ok: true,
      available: 150,
      staked: 1000,
      lockUntil,
      lastClaimAt,
      pendingDays: 2,
      pendingReward: 10,
      locked: true,
      dailyRatePct: 0.5,
    });
  });

  it("treats a missing staking_state row as never-staked (no lock, nothing pending)", async () => {
    tables({ balances: { data: { available: 500, staked: 0 } } });
    const r = await getStakingStatus();
    expect(r.ok).toBe(true);
    expect(r.lockUntil).toBeNull();
    expect(r.lastClaimAt).toBeNull();
    expect(r.pendingDays).toBe(0);
    expect(r.pendingReward).toBe(0);
    expect(r.locked).toBe(false);
  });

  it("reports an expired lock as not locked", async () => {
    tables({
      balances: { data: { available: 0, staked: 100 } },
      staking_state: {
        data: {
          lock_until: new Date(Date.now() - DAY).toISOString(),
          last_claim_at: new Date().toISOString(),
        },
      },
    });
    const r = await getStakingStatus();
    expect(r.ok).toBe(true);
    expect(r.locked).toBe(false);
  });

  it("fails with read_failed when a query errors", async () => {
    tables({ balances: { data: null, error: { message: "boom" } } });
    const r = await getStakingStatus();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("read_failed");
  });
});

// ── stake ─────────────────────────────────────────────────────────────

describe("stake", () => {
  /** Status backdrop with nothing pending, so no auto-claim fires. */
  function nothingPending() {
    tables({ balances: { data: { available: 500, staked: 0 } } });
  }

  it("rejects invalid amounts without touching the RPC", async () => {
    for (const bad of [0, -1, 0.4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = await stake(bad);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("invalid_amount");
    }
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("floors the amount, calls unsc_stake, and unwraps the row", async () => {
    nothingPending();
    const lockUntil = new Date(Date.now() + 7 * DAY).toISOString();
    h.rpc.mockImplementation(async (name: string, params: unknown) => {
      expect(name).toBe("unsc_stake");
      expect(params).toEqual({ p_amount: 100 });
      return {
        data: [
          {
            success: true,
            new_available: "400",
            new_staked: "100",
            lock_until: lockUntil,
            error_message: null,
          },
        ],
        error: null,
      };
    });
    const r = await stake(100.7);
    expect(r).toEqual({
      ok: true,
      newAvailable: 400,
      newStaked: 100,
      lockUntil,
      claimedFirst: undefined,
    });
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("claims pending full-day rewards BEFORE staking and reports claimedFirst", async () => {
    // 1000 staked, anchor 3 days back → pendingReward 15 ≥ 1
    tables({
      balances: { data: { available: 200, staked: 1000 } },
      staking_state: {
        data: {
          lock_until: null,
          last_claim_at: new Date(Date.now() - 3 * DAY).toISOString(),
        },
      },
    });
    const calls: string[] = [];
    h.rpc.mockImplementation(async (name: string) => {
      calls.push(name);
      if (name === "stake_claim_rewards") {
        return {
          data: [
            {
              success: true,
              reward: "15",
              days_settled: 3,
              new_available: 215,
              error_message: null,
            },
          ],
          error: null,
        };
      }
      return {
        data: [
          {
            success: true,
            new_available: 115,
            new_staked: 1100,
            lock_until: "2026-08-19T00:00:00Z",
            error_message: null,
          },
        ],
        error: null,
      };
    });
    const r = await stake(100);
    expect(calls).toEqual(["stake_claim_rewards", "unsc_stake"]);
    expect(r.ok).toBe(true);
    expect(r.claimedFirst).toBe(15);
    expect(r.newStaked).toBe(1100);
  });

  it("skips the auto-claim when the pending reward floors to 0", async () => {
    // 100 staked × 0.5% × 1 day = 0.5 → floor 0 → no claim call
    tables({
      balances: { data: { available: 500, staked: 100 } },
      staking_state: {
        data: { lock_until: null, last_claim_at: new Date(Date.now() - DAY).toISOString() },
      },
    });
    h.rpc.mockResolvedValue({
      data: [
        {
          success: true,
          new_available: 450,
          new_staked: 150,
          lock_until: null,
          error_message: null,
        },
      ],
      error: null,
    });
    await stake(50);
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith("unsc_stake", { p_amount: 50 });
  });

  it("still stakes when the auto-claim fails, without claimedFirst", async () => {
    tables({
      balances: { data: { available: 200, staked: 1000 } },
      staking_state: {
        data: { lock_until: null, last_claim_at: new Date(Date.now() - 3 * DAY).toISOString() },
      },
    });
    h.rpc.mockImplementation(async (name: string) => {
      if (name === "stake_claim_rewards") {
        return {
          data: [
            {
              success: false,
              reward: 0,
              days_settled: 3,
              new_available: 0,
              error_message: "reserve_insufficient",
            },
          ],
          error: null,
        };
      }
      return {
        data: [
          {
            success: true,
            new_available: 100,
            new_staked: 1100,
            lock_until: null,
            error_message: null,
          },
        ],
        error: null,
      };
    });
    const r = await stake(100);
    expect(r.ok).toBe(true);
    expect(r.claimedFirst).toBeUndefined();
  });

  it("maps DB error_message to typed codes and keeps reported balances", async () => {
    nothingPending();
    h.rpc.mockResolvedValue({
      data: [
        {
          success: false,
          new_available: 30,
          new_staked: 5,
          lock_until: null,
          error_message: "insufficient_funds",
        },
      ],
      error: null,
    });
    const r = await stake(100);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("insufficient_funds");
    expect(r.newAvailable).toBe(30);
    expect(r.newStaked).toBe(5);
  });

  it("returns rpc_failed on transport error and rpc_no_row on empty payload", async () => {
    nothingPending();
    h.rpc.mockResolvedValue({ data: null, error: { message: "network" } });
    expect((await stake(10)).error).toBe("rpc_failed");
    h.rpc.mockResolvedValue({ data: [], error: null });
    expect((await stake(10)).error).toBe("rpc_no_row");
  });
});

// ── unstake ───────────────────────────────────────────────────────────

describe("unstake", () => {
  it("rejects invalid amounts without touching the RPC", async () => {
    const r = await unstake(-3);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_amount");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("floors the amount, calls unsc_unstake, and unwraps the row", async () => {
    h.rpc.mockImplementation(async (name: string, params: unknown) => {
      expect(name).toBe("unsc_unstake");
      expect(params).toEqual({ p_amount: 40 });
      return {
        data: [{ success: true, new_available: "540", new_staked: "60", error_message: null }],
        error: null,
      };
    });
    const r = await unstake(40.9);
    expect(r).toEqual({ ok: true, newAvailable: 540, newStaked: 60, lockUntil: null });
  });

  it("maps `locked` and fetches lock_until from staking_state for the result", async () => {
    const lockUntil = new Date(Date.now() + 5 * DAY).toISOString();
    tables({ staking_state: { data: { lock_until: lockUntil } } });
    h.rpc.mockResolvedValue({
      data: [{ success: false, new_available: 0, new_staked: 0, error_message: "locked" }],
      error: null,
    });
    const r = await unstake(10);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("locked");
    expect(r.lockUntil).toBe(lockUntil);
  });

  it("maps insufficient_staked and keeps reported balances", async () => {
    h.rpc.mockResolvedValue({
      data: [
        { success: false, new_available: 10, new_staked: 5, error_message: "insufficient_staked" },
      ],
      error: null,
    });
    const r = await unstake(100);
    expect(r).toEqual({
      ok: false,
      newAvailable: 10,
      newStaked: 5,
      lockUntil: null,
      error: "insufficient_staked",
    });
  });

  it("returns rpc_failed / rpc_no_row on transport failures", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "network" } });
    expect((await unstake(1)).error).toBe("rpc_failed");
    h.rpc.mockResolvedValue({ data: [], error: null });
    expect((await unstake(1)).error).toBe("rpc_no_row");
  });
});

// ── claimStakingRewards ───────────────────────────────────────────────

describe("claimStakingRewards", () => {
  it("unwraps a successful claim with numeric coercion", async () => {
    h.rpc.mockImplementation(async (name: string) => {
      expect(name).toBe("stake_claim_rewards");
      return {
        data: [
          {
            success: true,
            reward: "25",
            days_settled: 5,
            new_available: "325.5",
            error_message: null,
          },
        ],
        error: null,
      };
    });
    const r = await claimStakingRewards();
    expect(r).toEqual({ ok: true, reward: 25, daysSettled: 5, newBalance: 325.5 });
  });

  it("maps its own and the passed-through reserve error codes", async () => {
    const cases: Array<[string, string]> = [
      ["nothing_staked", "nothing_staked"],
      ["nothing_accrued", "nothing_accrued"],
      ["unauthorized", "unauthorized"],
      ["reserve_insufficient", "reserve_insufficient"],
      ["source_not_allowed", "source_not_allowed"],
      ["award_failed", "award_failed"],
      ["something_weird", "rpc_failed"],
    ];
    for (const [dbMsg, expected] of cases) {
      h.rpc.mockResolvedValue({
        data: [
          { success: false, reward: 0, days_settled: 2, new_available: 0, error_message: dbMsg },
        ],
        error: null,
      });
      const r = await claimStakingRewards();
      expect(r.ok).toBe(false);
      expect(r.error).toBe(expected);
      expect(r.daysSettled).toBe(2);
      expect(r.reward).toBe(0);
    }
  });

  it("returns rpc_failed / rpc_no_row on transport failures", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "network" } });
    expect((await claimStakingRewards()).error).toBe("rpc_failed");
    h.rpc.mockResolvedValue({ data: [], error: null });
    expect((await claimStakingRewards()).error).toBe("rpc_no_row");
  });
});

import { describe, it, expect } from "vitest";

import {
  CONTRACTS_PER_DAY,
  REROLL_COST,
  STREAK_INSURANCE_COST,
  STREAK_INSURANCE_DAYS,
  STREAK_MILESTONES,
  milestoneFor,
  rollStreak,
  selectDailyContracts,
  selectRerollReplacement,
  utcDayKey,
  type DailyContract,
  type StreakSnapshot,
} from "@/lib/game/daily/engine";
import { DAILY_CONTRACT_TEMPLATES } from "@/lib/game/daily/templates";

// ── Template catalog invariants ───────────────────────────────────────

describe("DAILY_CONTRACT_TEMPLATES", () => {
  it("has ~15 templates with unique ids", () => {
    expect(DAILY_CONTRACT_TEMPLATES.length).toBeGreaterThanOrEqual(15);
    const ids = DAILY_CONTRACT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps payouts within 10–20 _unSC", () => {
    for (const t of DAILY_CONTRACT_TEMPLATES) {
      expect(t.payout).toBeGreaterThanOrEqual(10);
      expect(t.payout).toBeLessThanOrEqual(20);
    }
  });

  it("has a craft_count majority (>= 8)", () => {
    const craftCount = DAILY_CONTRACT_TEMPLATES.filter(
      (t) => t.objective.type === "craft_count",
    ).length;
    expect(craftCount).toBeGreaterThanOrEqual(8);
  });

  it("restricts resource_threshold objectives to the lowest payout tier (10)", () => {
    for (const t of DAILY_CONTRACT_TEMPLATES) {
      if (t.objective.type === "resource_threshold") {
        expect(t.payout).toBe(10);
      }
    }
  });

  it("only uses objective types the mission vocabulary can evaluate", () => {
    const allowed = new Set(["craft_count", "command", "resource_threshold"]);
    for (const t of DAILY_CONTRACT_TEMPLATES) {
      expect(allowed.has(t.objective.type)).toBe(true);
      expect(t.objective.targetValue).toBeGreaterThan(0);
      expect(t.weight).toBeGreaterThan(0);
    }
  });
});

// ── selectRerollReplacement ───────────────────────────────────────────

describe("selectRerollReplacement", () => {
  const userId = "user-reroll";
  const dayKey = "2026-08-08";

  it("is deterministic for the same inputs", () => {
    const a = selectRerollReplacement(userId, dayKey, 1);
    const b = selectRerollReplacement(userId, dayKey, 1);
    expect(a).toEqual(b);
  });

  it("never returns one of the day's original contracts", () => {
    const originalIds = new Set(selectDailyContracts(userId, dayKey).map((c) => c.id));
    for (let slot = 0; slot < CONTRACTS_PER_DAY; slot++) {
      const replacement = selectRerollReplacement(userId, dayKey, slot);
      expect(originalIds.has(replacement.id)).toBe(false);
      expect(replacement.slot).toBe(slot);
      expect(replacement.dayKey).toBe(dayKey);
      expect(replacement.contractId).toBe(`${dayKey}:${replacement.id}`);
    }
  });
});

// ── utcDayKey ─────────────────────────────────────────────────────────

describe("utcDayKey", () => {
  it("formats YYYY-MM-DD in UTC", () => {
    expect(utcDayKey(new Date("2026-08-07T12:34:56Z"))).toBe("2026-08-07");
  });

  it("rolls over exactly at UTC midnight", () => {
    expect(utcDayKey(new Date("2026-08-07T23:59:59Z"))).toBe("2026-08-07");
    expect(utcDayKey(new Date("2026-08-08T00:00:00Z"))).toBe("2026-08-08");
  });

  it("ignores local timezone offsets (pure UTC)", () => {
    // 01:30+02:00 is 23:30Z of the previous day.
    expect(utcDayKey(new Date("2026-08-08T01:30:00+02:00"))).toBe("2026-08-07");
  });
});

// ── selectDailyContracts ──────────────────────────────────────────────

describe("selectDailyContracts", () => {
  const templateIds = new Set(DAILY_CONTRACT_TEMPLATES.map((t) => t.id));

  it("returns exactly CONTRACTS_PER_DAY contracts from the catalog", () => {
    const picks = selectDailyContracts("user-a", "2026-08-07");
    expect(picks).toHaveLength(CONTRACTS_PER_DAY);
    for (const c of picks) {
      expect(templateIds.has(c.id)).toBe(true);
      expect(c.contractId).toBe(`2026-08-07:${c.id}`);
      expect(c.dayKey).toBe("2026-08-07");
    }
    expect(picks.map((c) => c.slot)).toEqual([0, 1, 2]);
  });

  it("is deterministic: same userId + dayKey yields identical selections", () => {
    const a = selectDailyContracts("user-a", "2026-08-07");
    const b = selectDailyContracts("user-a", "2026-08-07");
    expect(a).toEqual(b);
  });

  it("never selects duplicates within a day", () => {
    const users = ["user-a", "user-b", "u3", "artnorama", "x"];
    const days = ["2026-08-07", "2026-08-08", "2026-12-31", "2027-01-01"];
    for (const u of users) {
      for (const d of days) {
        const ids = selectDailyContracts(u, d).map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("usually differs between users and between days", () => {
    // Not guaranteed per single day (hash collisions on small pools are
    // legitimate), but across a sample the selections must diverge.
    const days = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"];
    const differsByUser = days.some((d) => {
      const a = selectDailyContracts("user-a", d).map((c) => c.id);
      const b = selectDailyContracts("user-b", d).map((c) => c.id);
      return JSON.stringify(a) !== JSON.stringify(b);
    });
    expect(differsByUser).toBe(true);

    const keysForUser = days.map((d) =>
      selectDailyContracts("user-a", d)
        .map((c) => c.id)
        .join(","),
    );
    expect(new Set(keysForUser).size).toBeGreaterThan(1);
  });

  it("preserves template payload on the derived contract", () => {
    const picks = selectDailyContracts("user-a", "2026-08-07");
    for (const c of picks) {
      const template = DAILY_CONTRACT_TEMPLATES.find((t) => t.id === c.id);
      expect(template).toBeDefined();
      expect(c.objective).toEqual(template?.objective);
      expect(c.payout).toBe(template?.payout);
      expect(c.rerollable).toBe(template?.rerollable);
    }
  });
});

// ── rollStreak ────────────────────────────────────────────────────────

describe("rollStreak", () => {
  const now = new Date("2026-08-10T12:00:00Z");

  function snap(overrides: Partial<StreakSnapshot>): StreakSnapshot {
    return {
      streakCount: 10,
      dailyResetAt: null,
      streakInsuredUntil: null,
      ...overrides,
    };
  }

  it("no history (dailyResetAt null) — unchanged", () => {
    const r = rollStreak(snap({ streakCount: 0 }), now);
    expect(r).toEqual({ streakCount: 0, usedInsurance: false, broken: false });
  });

  it("unparseable history — unchanged (tolerant hydration)", () => {
    const r = rollStreak(snap({ dailyResetAt: "not-a-date" }), now);
    expect(r).toEqual({ streakCount: 10, usedInsurance: false, broken: false });
  });

  it("same day — unchanged", () => {
    const r = rollStreak(snap({ dailyResetAt: "2026-08-10T01:00:00Z" }), now);
    expect(r).toEqual({ streakCount: 10, usedInsurance: false, broken: false });
  });

  it("gap of 1 day — streak continues (increment happens at claim time)", () => {
    const r = rollStreak(snap({ dailyResetAt: "2026-08-09T23:59:59Z" }), now);
    expect(r).toEqual({ streakCount: 10, usedInsurance: false, broken: false });
  });

  it("gap of 2 days — grace day, streak survives", () => {
    const r = rollStreak(snap({ dailyResetAt: "2026-08-08T00:00:00Z" }), now);
    expect(r).toEqual({ streakCount: 10, usedInsurance: false, broken: false });
  });

  it("gap > 2 days with active insurance — streak survives, usedInsurance", () => {
    const r = rollStreak(
      snap({ dailyResetAt: "2026-08-05", streakInsuredUntil: "2026-08-12" }),
      now,
    );
    expect(r).toEqual({ streakCount: 10, usedInsurance: true, broken: false });
  });

  it("insurance covering exactly today still counts", () => {
    const r = rollStreak(
      snap({ dailyResetAt: "2026-08-05", streakInsuredUntil: "2026-08-10" }),
      now,
    );
    expect(r).toEqual({ streakCount: 10, usedInsurance: true, broken: false });
  });

  it("gap > 2 days with expired insurance — streak halved (floor), broken", () => {
    const r = rollStreak(
      snap({ streakCount: 11, dailyResetAt: "2026-08-05", streakInsuredUntil: "2026-08-09" }),
      now,
    );
    expect(r).toEqual({ streakCount: 5, usedInsurance: false, broken: true });
  });

  it("gap > 2 days without insurance — streak halved (floor), broken", () => {
    const r = rollStreak(snap({ streakCount: 7, dailyResetAt: "2026-08-01" }), now);
    expect(r).toEqual({ streakCount: 3, usedInsurance: false, broken: true });
  });

  it("halving a 0 streak stays at 0", () => {
    const r = rollStreak(snap({ streakCount: 0, dailyResetAt: "2026-08-01" }), now);
    expect(r).toEqual({ streakCount: 0, usedInsurance: false, broken: true });
  });

  it("clock skew into the past (negative gap) — unchanged", () => {
    const r = rollStreak(snap({ dailyResetAt: "2026-08-11T00:00:00Z" }), now);
    expect(r).toEqual({ streakCount: 10, usedInsurance: false, broken: false });
  });
});

// ── milestoneFor ──────────────────────────────────────────────────────

describe("milestoneFor", () => {
  it("returns the bonus for exact milestone counts", () => {
    expect(milestoneFor(3)).toBe(25);
    expect(milestoneFor(7)).toBe(75);
    expect(milestoneFor(30)).toBe(250);
  });

  it("returns null for non-milestone counts", () => {
    for (const n of [0, 1, 2, 4, 6, 8, 29, 31, 100]) {
      expect(milestoneFor(n)).toBeNull();
    }
  });

  it("matches the exported milestone table", () => {
    for (const [count, bonus] of Object.entries(STREAK_MILESTONES)) {
      expect(milestoneFor(Number(count))).toBe(bonus);
    }
  });
});

// ── Constants ─────────────────────────────────────────────────────────

describe("economy constants", () => {
  it("exposes the documented costs", () => {
    expect(REROLL_COST).toBe(5);
    expect(STREAK_INSURANCE_COST).toBe(15);
    expect(STREAK_INSURANCE_DAYS).toBe(7);
  });
});

// Type-level smoke check: DailyContract is a template plus derived fields.
const _typecheck: DailyContract | undefined = undefined;
void _typecheck;

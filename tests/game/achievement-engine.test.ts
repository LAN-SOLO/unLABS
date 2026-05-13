import { describe, it, expect } from "vitest";

import {
  ACHIEVEMENTS,
  createInitialAchievementState,
  deriveStatus,
  diffNewlyUnlocked,
  evaluateCatalog,
  evaluateProgress,
  getAchievement,
  hydrateAchievementState,
  type AchievementGameState,
  type AchievementStatus,
} from "@/lib/game/achievements";

function makeState(overrides: Partial<AchievementGameState> = {}): AchievementGameState {
  return {
    resources: {},
    flags: {},
    craftedJobCount: 0,
    craftedRecipeIds: new Set(),
    discoveries: [],
    balance: 0,
    totalSpent: 0,
    ...overrides,
  };
}

describe("catalog integrity", () => {
  it("has unique achievement ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships 6 MVP T1 achievements", () => {
    expect(ACHIEVEMENTS.filter((a) => a.tier === 1)).toHaveLength(6);
  });

  it("every reward references the reserve (unsc > 0)", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.reward.unsc).toBeGreaterThan(0);
    }
  });

  it("every achievement has a positive target and an evaluator", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.target).toBeGreaterThan(0);
      expect(typeof a.evaluate).toBe("function");
    }
  });
});

describe("evaluateProgress", () => {
  it("clamps to [0, target]", () => {
    const a = getAchievement("resource.dabbler.t1")!;
    // Far over target.
    const over = evaluateProgress(
      a,
      makeState({
        resources: { abstractum: { amount: 999, capacity: 1000, ratePerSecond: 0 } },
      }),
    );
    expect(over).toBe(a.target);
    // Negative evaluator output returns 0.
    const neg = evaluateProgress({ ...a, evaluate: () => -5 }, makeState());
    expect(neg).toBe(0);
  });

  it("returns 0 when the resource slot is missing", () => {
    const a = getAchievement("energy.first_spark.t1")!;
    expect(evaluateProgress(a, makeState({ resources: {} }))).toBe(0);
  });
});

describe("deriveStatus", () => {
  it("marks gated achievements as locked before the availability flag", () => {
    const a = getAchievement("energy.first_spark.t1")!;
    const s = deriveStatus(a, 0, createInitialAchievementState(), { ep0_complete: false });
    expect(s).toBe("locked");
  });

  it("moves from progressing -> unlocked at the target", () => {
    const a = getAchievement("resource.dabbler.t1")!;
    const pre = deriveStatus(a, a.target - 1, createInitialAchievementState(), {});
    const at = deriveStatus(a, a.target, createInitialAchievementState(), {});
    expect(pre).toBe("progressing");
    expect(at).toBe("unlocked");
  });

  it("stays claimed once the reward has been banked", () => {
    const a = getAchievement("resource.dabbler.t1")!;
    const player = createInitialAchievementState();
    player.claimed[a.id] = true;
    expect(deriveStatus(a, a.target, player, {})).toBe("claimed");
  });
});

describe("evaluateCatalog + diffNewlyUnlocked", () => {
  it("only fires a diff on upward transitions into 'unlocked'", () => {
    const state = createInitialAchievementState();
    const flags = { ep0_complete: true, missions_unlocked: true, anomaly_mode: true };
    // First tick: all zero. No unlocks.
    const first = evaluateCatalog(ACHIEVEMENTS, makeState({ flags }), state, flags);
    const firstMap = Object.fromEntries(first.map((a) => [a.id, a.status])) as Record<
      string,
      AchievementStatus
    >;

    // Second tick: resource.dabbler hits target.
    const second = evaluateCatalog(
      ACHIEVEMENTS,
      makeState({
        flags,
        resources: {
          abstractum: { amount: 100, capacity: 200, ratePerSecond: 0 },
        },
      }),
      state,
      flags,
    );
    const newly = diffNewlyUnlocked(firstMap, second);
    expect(newly.map((a) => a.id)).toEqual(["resource.dabbler.t1"]);

    // Third tick: still at 100. No new diff.
    const secondMap = Object.fromEntries(second.map((a) => [a.id, a.status])) as Record<
      string,
      AchievementStatus
    >;
    const third = evaluateCatalog(
      ACHIEVEMENTS,
      makeState({
        flags,
        resources: {
          abstractum: { amount: 100, capacity: 200, ratePerSecond: 0 },
        },
      }),
      state,
      flags,
    );
    expect(diffNewlyUnlocked(secondMap, third)).toHaveLength(0);
  });
});

describe("hydrateAchievementState", () => {
  it("returns a fresh state for garbage inputs", () => {
    expect(hydrateAchievementState(null)).toEqual(createInitialAchievementState());
    expect(hydrateAchievementState("string")).toEqual(createInitialAchievementState());
  });

  it("passes through known fields", () => {
    const raw = {
      progress: { "resource.dabbler.t1": 42 },
      unlocked: { "resource.dabbler.t1": true },
      claimed: {},
    };
    const out = hydrateAchievementState(raw);
    expect(out.progress["resource.dabbler.t1"]).toBe(42);
    expect(out.unlocked["resource.dabbler.t1"]).toBe(true);
  });
});

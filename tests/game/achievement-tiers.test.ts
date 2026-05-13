import { describe, it, expect } from "vitest";

import {
  ACHIEVEMENTS,
  createInitialAchievementState,
  deriveStatus,
  getAchievement,
} from "@/lib/game/achievements";

/**
 * Workstream 7 expands every branch from T1 → T1/T2/T3. These tests
 * pin the shape: 18 total, 6 per tier, every T2 gated on its T1 flag,
 * every T3 gated on its T2 flag.
 */

describe("achievement catalog — three tiers", () => {
  it("ships 18 achievements total (6 branches × 3 tiers)", () => {
    expect(ACHIEVEMENTS).toHaveLength(18);
  });

  it.each([[1], [2], [3]])("has 6 achievements at tier %i", (tier) => {
    expect(ACHIEVEMENTS.filter((a) => a.tier === tier)).toHaveLength(6);
  });

  it("T1 reward is the smallest, T3 the largest within each branch", () => {
    const branches = new Set(ACHIEVEMENTS.map((a) => a.branch));
    for (const b of branches) {
      const sorted = ACHIEVEMENTS.filter((a) => a.branch === b).sort((a, z) => a.tier - z.tier);
      expect(sorted[0].reward.unsc).toBeLessThan(sorted[1].reward.unsc);
      expect(sorted[1].reward.unsc).toBeLessThan(sorted[2].reward.unsc);
    }
  });

  it("T2 target is strictly greater than T1 target within each branch", () => {
    const branches = new Set(ACHIEVEMENTS.map((a) => a.branch));
    for (const b of branches) {
      const t1 = ACHIEVEMENTS.find((a) => a.branch === b && a.tier === 1)!;
      const t2 = ACHIEVEMENTS.find((a) => a.branch === b && a.tier === 2)!;
      const t3 = ACHIEVEMENTS.find((a) => a.branch === b && a.tier === 3)!;
      expect(t2.target).toBeGreaterThan(t1.target);
      expect(t3.target).toBeGreaterThan(t2.target);
    }
  });
});

describe("tier gating (available predicate)", () => {
  it("T2 is locked until T1 is claimed", () => {
    const t2 = getAchievement("resource.dabbler.t2")!;
    const state = createInitialAchievementState();
    // Without the t1 flag, T2 is locked.
    expect(deriveStatus(t2, t2.target, state, {})).toBe("locked");
    // With it, T2 is unlocked if target is met.
    expect(deriveStatus(t2, t2.target, state, { ach_resource_dabbler_t1: true })).toBe("unlocked");
  });

  it("T3 is locked until T2 is claimed", () => {
    const t3 = getAchievement("energy.first_spark.t3")!;
    const state = createInitialAchievementState();
    // T1 flag alone is not enough.
    expect(deriveStatus(t3, t3.target, state, { ach_energy_first_spark_t1: true })).toBe("locked");
    // Need T2 flag too.
    expect(
      deriveStatus(t3, t3.target, state, {
        ach_energy_first_spark_t1: true,
        ach_energy_first_spark_t2: true,
      }),
    ).toBe("unlocked");
  });
});

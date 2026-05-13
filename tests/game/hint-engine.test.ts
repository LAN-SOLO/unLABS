import { describe, it, expect } from "vitest";

import {
  HINT_THRESHOLDS_MS,
  computeGlobalHint,
  isEscalation,
  levelForElapsed,
  type ObjectiveIdleSnapshot,
} from "@/lib/game/hints/engine";

describe("hint engine", () => {
  describe("levelForElapsed", () => {
    it("returns 0 below the first threshold", () => {
      expect(levelForElapsed(0)).toBe(0);
      expect(levelForElapsed(HINT_THRESHOLDS_MS[1] - 1)).toBe(0);
    });

    it("steps through 1 / 2 / 3 at the defined thresholds", () => {
      expect(levelForElapsed(HINT_THRESHOLDS_MS[1])).toBe(1);
      expect(levelForElapsed(HINT_THRESHOLDS_MS[2])).toBe(2);
      expect(levelForElapsed(HINT_THRESHOLDS_MS[3])).toBe(3);
    });
  });

  describe("computeGlobalHint", () => {
    it("returns level 0 when no active objectives are present", () => {
      const result = computeGlobalHint([], 1_000_000);
      expect(result.level).toBe(0);
      expect(result.drivingObjectiveId).toBeNull();
    });

    it("ignores inactive objectives", () => {
      const now = 10_000_000;
      const snaps: ObjectiveIdleSnapshot[] = [
        {
          objectiveId: "a",
          missionId: "M1",
          lastActivityAt: now - HINT_THRESHOLDS_MS[3],
          active: false,
        },
      ];
      expect(computeGlobalHint(snaps, now).level).toBe(0);
    });

    it("picks the most stalled active objective", () => {
      const now = 10_000_000;
      const snaps: ObjectiveIdleSnapshot[] = [
        {
          objectiveId: "fresh",
          missionId: "M1",
          lastActivityAt: now - 30_000,
          active: true,
        },
        {
          objectiveId: "stalled",
          missionId: "M2",
          lastActivityAt: now - HINT_THRESHOLDS_MS[2] - 1000,
          active: true,
        },
      ];
      const r = computeGlobalHint(snaps, now);
      expect(r.level).toBe(2);
      expect(r.drivingObjectiveId).toBe("stalled");
      expect(r.drivingMissionId).toBe("M2");
    });

    it("ignores null lastActivityAt", () => {
      const snaps: ObjectiveIdleSnapshot[] = [
        {
          objectiveId: "never_touched",
          missionId: "M1",
          lastActivityAt: null,
          active: true,
        },
      ];
      expect(computeGlobalHint(snaps, 10_000_000).level).toBe(0);
    });
  });

  describe("isEscalation", () => {
    it("true only on upward transitions", () => {
      expect(isEscalation(0, 1)).toBe(true);
      expect(isEscalation(1, 2)).toBe(true);
      expect(isEscalation(2, 3)).toBe(true);
      expect(isEscalation(0, 0)).toBe(false);
      expect(isEscalation(2, 1)).toBe(false);
      expect(isEscalation(3, 0)).toBe(false);
    });
  });
});

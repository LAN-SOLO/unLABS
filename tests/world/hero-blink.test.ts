import { describe, expect, it } from "vitest";
import { GAZE_LIMIT, gazeAngles, heroBlinkFromLids, lidAngles } from "@/lib/world/hero/jade-blink";
import { LID_TRAVEL } from "@/lib/world/models/rig";

describe("hero blink and gaze", () => {
  it("maps the rig's lid offset to a blink amount", () => {
    expect(heroBlinkFromLids(undefined)).toBe(0);
    expect(heroBlinkFromLids([0, 0, 0])).toBe(0);
    expect(heroBlinkFromLids([0, 0, LID_TRAVEL / 2])).toBeCloseTo(0.5);
    expect(heroBlinkFromLids([0, 0, LID_TRAVEL * 3])).toBe(1);
    expect(heroBlinkFromLids([0, 0, Number.NaN])).toBe(0);
  });

  it("closes the upper lid downwards and meets the lower lid", () => {
    const open = lidAngles(0);
    const shut = lidAngles(1);
    expect(shut.upper).toBeGreaterThan(open.upper);
    expect(shut.lower).toBeLessThan(open.lower);
    const mid = lidAngles(0.5);
    expect(mid.upper).toBeGreaterThan(open.upper);
    expect(mid.upper).toBeLessThan(shut.upper);
  });

  it("clamps the gaze softly", () => {
    expect(Math.abs(gazeAngles(5).yaw)).toBeLessThan(GAZE_LIMIT.yaw);
    expect(gazeAngles(0.05).yaw).toBeCloseTo(0.05, 2);
    expect(gazeAngles(0, 0.1).pitch).toBeLessThan(0);
  });
});

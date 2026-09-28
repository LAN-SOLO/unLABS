import { describe, expect, it } from "vitest";
import {
  momentum,
  TREND_CONTINUATION,
  TREND_HZ,
  trendRound,
  visibleSlope,
} from "@/components/world/puzzles/engine/trend";

describe("trend", () => {
  it("is deterministic per seed and round", () => {
    expect(trendRound(512, 3, 0.3)).toEqual(trendRound(512, 3, 0.3));
    expect(trendRound(512, 3, 0.3)).not.toEqual(trendRound(512, 4, 0.3));
  });

  it("history lasts 3..6 s and continuation has a fixed length", () => {
    for (let r = 0; r < 40; r++) {
      const t = trendRound(7, r, 0.3);
      expect(t.history.length).toBeGreaterThanOrEqual(3 * TREND_HZ);
      expect(t.history.length).toBeLessThanOrEqual(6 * TREND_HZ);
      expect(t.continuation).toHaveLength(TREND_CONTINUATION);
    }
  });

  it("answer matches the direction of the continuation", () => {
    for (let r = 0; r < 60; r++) {
      const t = trendRound(512, r, 0.3);
      const last = t.history[t.history.length - 1];
      const end = t.continuation[t.continuation.length - 1];
      expect(end > last ? "cw" : "ccw").toBe(t.answer);
    }
  });

  it("a moving-average slope predictor on the visible data is right ≥ 80 %", () => {
    for (const seed of [512, 1, 99, 2024]) {
      let right = 0;
      let reversals = 0;
      const rounds = 200;
      for (let r = 0; r < rounds; r++) {
        const t = trendRound(seed, r, 0.3);
        if (t.reversal) reversals++;
        if ((visibleSlope(t.history) > 0 ? "cw" : "ccw") === t.answer) right++;
      }
      expect(right / rounds).toBeGreaterThanOrEqual(0.8);
      expect(reversals).toBeGreaterThan(20);
    }
  });

  it("slope helpers handle edge cases", () => {
    expect(visibleSlope([])).toBe(0);
    expect(visibleSlope([1])).toBe(0);
    expect(visibleSlope([0, 1, 2, 3])).toBeCloseTo(1);
    expect(momentum([0, 100, 200])).toBe(1);
    expect(momentum([0, -100, -200])).toBe(-1);
  });
});

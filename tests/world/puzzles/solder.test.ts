import { describe, expect, it } from "vitest";
import {
  BOARD_H,
  BOARD_W,
  PREHEAT,
  TEMP_MAX,
  TEMP_MIN,
  generateBoard,
  heatStep,
  isBurnt,
  releaseResult,
} from "@/components/world/puzzles/engine/solder";

describe("solder board", () => {
  for (const [seed, pads] of [
    [38, 6],
    [1, 4],
    [777, 8],
    [2024, 5],
  ]) {
    it(`seed ${seed}: ${pads} pads, non-overlapping, windows in range`, () => {
      const b = generateBoard(seed, pads, 14);
      expect(b.pads).toHaveLength(pads);
      for (const p of b.pads) {
        expect(p.lo).toBeGreaterThanOrEqual(TEMP_MIN);
        expect(p.hi).toBeLessThanOrEqual(TEMP_MAX);
        expect(p.hi - p.lo).toBe(14);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(BOARD_W);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(BOARD_H);
      }
      for (let i = 0; i < b.pads.length; i++)
        for (let j = i + 1; j < b.pads.length; j++)
          expect(Math.hypot(b.pads[i].x - b.pads[j].x, b.pads[i].y - b.pads[j].y)).toBeGreaterThan(
            40,
          );
      expect(generateBoard(seed, pads, 14)).toEqual(b);
    });
  }

  it("clamps pad count", () => {
    expect(generateBoard(1, 2, 14).pads).toHaveLength(4);
    expect(generateBoard(1, 20, 14).pads).toHaveLength(8);
  });
});

describe("solder heating", () => {
  it("reaches every possible window in 1..6 s and a release inside works", () => {
    const b = generateBoard(38, 8, 14);
    const dt = 1 / 60;
    for (const pad of b.pads) {
      let t = PREHEAT;
      let time = 0;
      while (t < pad.lo) {
        t = heatStep(t, true, dt);
        time += dt;
      }
      expect(time).toBeGreaterThanOrEqual(1);
      expect(time).toBeLessThanOrEqual(6);
      // One more frame keeps us inside (window spans several frames).
      expect(releaseResult(t, pad)).toBe("ok");
    }
  });

  it("window lasts long enough to react (≥ 0.2 s)", () => {
    const pad = { lo: TEMP_MAX - 14, hi: TEMP_MAX };
    const dt = 1 / 120;
    let t = pad.lo;
    let time = 0;
    while (t <= pad.hi) {
      t = heatStep(t, true, dt);
      time += dt;
    }
    expect(time).toBeGreaterThanOrEqual(0.2);
  });

  it("classifies releases and burns", () => {
    const w = { lo: 250, hi: 264 };
    expect(releaseResult(240, w)).toBe("kalt");
    expect(releaseResult(257, w)).toBe("ok");
    expect(releaseResult(270, w)).toBe("verbrannt");
    expect(isBurnt(280, w)).toBe(false);
    expect(isBurnt(290, w)).toBe(true);
  });

  it("cools back towards preheat when released", () => {
    let t = 300;
    for (let i = 0; i < 600; i++) t = heatStep(t, false, 0.1);
    expect(t).toBeGreaterThanOrEqual(PREHEAT);
    expect(t).toBeLessThan(PREHEAT + 1);
  });
});

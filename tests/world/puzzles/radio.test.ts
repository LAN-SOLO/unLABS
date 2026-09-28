import { describe, expect, it } from "vitest";
import {
  clampFreq,
  LOCK_THRESHOLD,
  phaseDelta,
  radioClarity,
  radioStart,
  voiceSample,
  wrapPhase,
} from "@/components/world/puzzles/engine/radio";

describe("radio", () => {
  it("clarity is 1 at the target and low far away", () => {
    expect(radioClarity(94.7, 135, 94.7, 135)).toBeCloseTo(1);
    expect(radioClarity(90.7, 135, 94.7, 135)).toBeLessThan(0.3);
    expect(radioClarity(94.7, 315, 94.7, 135)).toBeLessThan(0.01);
    expect(radioClarity(94.7, 225, 94.7, 135)).toBeCloseTo(0.25);
  });

  it("start is deterministic and noisy", () => {
    for (const seed of [1, 2, 3, 47, 1000]) {
      const s = radioStart(seed, 94.7, 135);
      expect(radioStart(seed, 94.7, 135)).toEqual(s);
      expect(radioClarity(s.freq, s.phase, 94.7, 135)).toBeLessThan(0.3);
      expect(s.phase % 5).toBe(0);
      expect(s.freq).toBe(clampFreq(s.freq));
    }
    const edge = radioStart(3, 88.0, 0);
    expect(Math.abs(edge.freq - 88.0)).toBeGreaterThanOrEqual(4);
  });

  it("lock threshold is reachable on the 0.1 MHz / 5° grid", () => {
    for (const [f, p] of [
      [94.7, 135],
      [101.3, 272],
      [88.1, 3],
    ]) {
      const gf = clampFreq(f);
      const gp = wrapPhase(Math.round(p / 5) * 5);
      expect(radioClarity(gf, gp, f, p)).toBeGreaterThanOrEqual(LOCK_THRESHOLD);
    }
  });

  it("helpers clamp and wrap", () => {
    expect(clampFreq(80)).toBe(87.5);
    expect(clampFreq(200)).toBe(108);
    expect(clampFreq(94.66)).toBe(94.7);
    expect(wrapPhase(-5)).toBe(355);
    expect(wrapPhase(725)).toBe(5);
    expect(phaseDelta(350, 10)).toBe(20);
    expect(phaseDelta(10, 350)).toBe(-20);
  });

  it("voice samples stay bounded", () => {
    for (let i = 0; i < 500; i++) {
      const v = voiceSample(i * 0.013, (i % 11) / 10, 5);
      expect(Math.abs(v)).toBeLessThanOrEqual(1.2);
    }
  });
});

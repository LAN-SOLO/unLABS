import { describe, expect, it } from "vitest";
import {
  CLARITY_CATEGORIES,
  CLARITY_ERAS,
  ERA_NAMES,
  ERA_THRESHOLDS,
  clarityLevel,
  clarityOf,
  CLARITY_BEST_COUNTER,
  clarityScore,
  eraOf,
  noteClarityEra,
  paramsAt,
} from "@/lib/world/clarity";
import { initialState } from "@/lib/world/game";
import { fullRun } from "./simCoverage";

describe("clarity", () => {
  it("has 42 named eras and weights summing to 1", () => {
    expect(CLARITY_ERAS).toBe(42);
    expect(ERA_NAMES).toHaveLength(42);
    expect(new Set(ERA_NAMES).size).toBe(42);
    expect(CLARITY_CATEGORIES.reduce((n, c) => n + c.weight, 0)).toBeCloseTo(1, 9);
    for (let i = 1; i < ERA_THRESHOLDS.length; i++)
      expect(ERA_THRESHOLDS[i]!).toBeGreaterThan(ERA_THRESHOLDS[i - 1]!);
  });

  it("starts with the big source blocks", () => {
    const c = clarityOf(initialState());
    expect(c.era).toBe(0);
    expect(c.params.mesh).toBe(1);
    expect(c.params.terrain).toBe(1);
  });

  it("gets clearer with every step of the level", () => {
    let prev = paramsAt(0);
    for (let l = 0.1; l <= 41; l += 0.1) {
      const p = paramsAt(l);
      expect(p.detail).toBeGreaterThanOrEqual(prev.detail - 1e-9);
      expect(p.mesh).toBeGreaterThanOrEqual(prev.mesh);
      expect(p.terrain).toBeGreaterThanOrEqual(prev.terrain);
      expect(p.saturation).toBeGreaterThanOrEqual(prev.saturation - 1e-9);
      prev = p;
    }
    expect(paramsAt(0).mesh).toBe(1);
    expect(paramsAt(41).mesh).toBe(8);
    expect(paramsAt(41).terrain).toBe(4);
  });

  it("splits the voxels again in every chapter after the first", () => {
    const tiers = Array.from({ length: CLARITY_ERAS }, (_, e) => paramsAt(e).mesh);
    // Each chapter start (6, 12, … 36) has at least as fine voxels as before, and
    // the model voxels get finer five times: 1 → 2 → 4 → 6 → 8.
    expect([...new Set(tiers)]).toEqual([1, 2, 4, 6, 8]);
    for (let e = 1; e < CLARITY_ERAS; e++) if (tiers[e] !== tiers[e - 1]) expect(e % 6).toBe(0);
  });

  it("never falls back once reached (power-gated doors may close)", () => {
    const s = initialState();
    s.counters[CLARITY_BEST_COUNTER] = Math.floor(0.5 * 1e6);
    expect(clarityOf(s).score).toBeCloseTo(0.5, 5);
    expect(noteClarityEra(s)).toBe(null); // first call adopts silently
    expect(clarityOf(s).era).toBe(eraOf(0.5));
  });

  it("modes override the story", () => {
    expect(clarityLevel(initialState(), "clear")).toBe(41);
    expect(clarityLevel(initialState(), "pixel")).toBe(0);
  });

  it("walks through the eras over a completionist run and ends crystal clear", () => {
    const { run, report } = fullRun();
    const eras = [initialState(), ...run.samples, run.s].map((s) => eraOf(clarityScore(s)));
    // Never back: every sample is at least as clear as the one before.
    for (let i = 1; i < eras.length; i++) expect(eras[i]!).toBeGreaterThanOrEqual(eras[i - 1]!);
    // Everything done → the last era, nothing missing.
    expect(Object.values(report).every((l) => l.length === 0)).toBe(true);
    const end = clarityOf(run.s);
    expect(Object.entries(end.parts).filter(([, v]) => v < 1)).toEqual([]);
    expect(end.score).toBe(1);
    expect(end.era).toBe(41);
    // The main goals alone (samples mid-run) never reach it.
    for (const s of run.samples.slice(0, -1)) expect(clarityScore(s)).toBeLessThan(1);
  }, 240_000);
});

import { describe, expect, it } from "vitest";
import {
  bestClamp,
  CLAMPS,
  clampEnvelope,
  clampFitError,
  makeWave,
  peakEnvelope,
  WAVE_SAMPLES,
} from "@/components/world/puzzles/engine/clamp";

describe("clamp envelopes", () => {
  it("have the documented shapes", () => {
    expect(clampEnvelope("arecibo", 0.5)).toBeGreaterThan(clampEnvelope("arecibo", 0));
    expect(clampEnvelope("greenbank", 0.5)).toBeLessThan(clampEnvelope("greenbank", 0));
    expect(clampEnvelope("jodrell", 1)).toBeLessThan(clampEnvelope("jodrell", 0));
    expect(clampEnvelope("parkes", 0.1)).toBe(clampEnvelope("parkes", 0.9));
    for (const c of CLAMPS)
      for (let x = 0; x <= 1; x += 0.1) expect(clampEnvelope(c.kind, x)).toBeGreaterThan(0);
  });

  it("clamps x outside [0, 1]", () => {
    expect(clampEnvelope("jodrell", -1)).toBe(clampEnvelope("jodrell", 0));
    expect(clampEnvelope("jodrell", 2)).toBe(clampEnvelope("jodrell", 1));
  });
});

describe("makeWave", () => {
  it("is deterministic and varies with round/attempt", () => {
    const a = makeWave(2008, 0, 0, 0.2);
    expect(makeWave(2008, 0, 0, 0.2)).toEqual(a);
    expect(a.samples).toHaveLength(WAVE_SAMPLES);
    expect(makeWave(2008, 0, 1, 0.2).samples).not.toEqual(a.samples);
    expect(makeWave(2008, 1, 0, 0.2).samples).not.toEqual(a.samples);
  });

  it("respects `avoid`", () => {
    for (let s = 0; s < 40; s++) expect(makeWave(s, 1, 0, 0.2, "parkes").kind).not.toBe("parkes");
  });

  it("produces all four kinds across seeds", () => {
    const kinds = new Set<string>();
    for (let s = 0; s < 40; s++) kinds.add(makeWave(s, 0, 0, 0.2).kind);
    expect(kinds.size).toBe(4);
  });
});

describe("bestClamp", () => {
  it("recovers the kind for clean waves", () => {
    for (let s = 0; s < 60; s++) {
      const w = makeWave(s, 0, 0, 0);
      expect(bestClamp(w.samples)).toBe(w.kind);
    }
  });

  it("recovers the kind at default noise for (nearly) all seeds", () => {
    let ok = 0;
    const total = 300;
    for (let s = 0; s < total; s++) {
      const w = makeWave(s, s % 3, s % 5, 0.2);
      if (bestClamp(w.samples) === w.kind) ok++;
    }
    expect(ok / total).toBeGreaterThan(0.97);
  });

  it("fit error is zero-ish for the true envelope and larger for others", () => {
    const w = makeWave(7, 0, 0, 0);
    const own = clampFitError(w.samples, w.kind);
    for (const c of CLAMPS)
      if (c.kind !== w.kind) expect(clampFitError(w.samples, c.kind)).toBeGreaterThan(own);
  });

  it("peak envelope handles empty input", () => {
    expect(peakEnvelope([])).toEqual([]);
    expect(clampFitError([], "parkes")).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  axisFeedback,
  baryDistance,
  baryToXY,
  CENTROID,
  clampBary,
  fitness,
  inTargetZone,
  jitter,
  memeticTarget,
  moveBary,
  TRI_VERTICES,
  xyToBary,
} from "@/components/world/puzzles/engine/memetic";

describe("barycentric conversion", () => {
  it("roundtrips", () => {
    for (const p of [CENTROID, [1, 0, 0], [0.2, 0.5, 0.3]] as const) {
      const [x, y] = baryToXY(p);
      const q = xyToBary(x, y);
      for (let i = 0; i < 3; i++) expect(q[i]).toBeCloseTo(p[i], 9);
    }
    expect(baryToXY([0, 1, 0])).toEqual([...TRI_VERTICES[1]]);
  });

  it("clamps outside points into the triangle", () => {
    const p = clampBary(xyToBary(-1, 2));
    expect(p.every((v) => v >= 0)).toBe(true);
    expect(p[0] + p[1] + p[2]).toBeCloseTo(1, 9);
    expect(clampBary([0, 0, 0])).toEqual(CENTROID);
    const m = moveBary(CENTROID, 5, 5);
    expect(m.every((v) => v >= 0)).toBe(true);
  });
});

describe("target", () => {
  it("is deterministic, inside, off-centre, all weights >= 0.1", () => {
    for (let s = 0; s < 50; s++) {
      const t = memeticTarget(s);
      expect(memeticTarget(s)).toEqual(t);
      expect(t[0] + t[1] + t[2]).toBeCloseTo(1, 9);
      expect(Math.min(...t)).toBeGreaterThanOrEqual(0.1);
      expect(baryDistance(t, CENTROID)).toBeGreaterThanOrEqual(0.15);
    }
    expect(memeticTarget(1)).not.toEqual(memeticTarget(2));
  });

  it("the centroid start is not in the zone, the target is", () => {
    const t = memeticTarget(1016);
    expect(inTargetZone(CENTROID, t, 0.08)).toBe(false);
    expect(inTargetZone(t, t, 0.08)).toBe(true);
  });
});

describe("fitness & feedback", () => {
  it("is 100 at target, ~>80 at the zone edge, low far away", () => {
    const t = memeticTarget(1016);
    expect(fitness(t, t, 0.08)).toBeCloseTo(100, 6);
    const [tx, ty] = baryToXY(t);
    const edge = xyToBary(tx + 0.08, ty);
    expect(fitness(edge, t, 0.08)).toBeGreaterThan(80);
    expect(fitness([1, 0, 0], t, 0.08)).toBeLessThan(10);
  });

  it("axis feedback signs point toward the target", () => {
    const f = axisFeedback([0.6, 0.2, 0.2], [0.4, 0.3, 0.3]);
    expect(f[0]).toBeGreaterThan(0);
    expect(f[1]).toBeLessThan(0);
  });

  it("jitter is bounded and deterministic", () => {
    for (let t = 0; t < 20; t += 0.37) {
      const [dx, dy] = jitter(t, 1016);
      expect(Math.abs(dx)).toBeLessThanOrEqual(1.9);
      expect(Math.abs(dy)).toBeLessThanOrEqual(1.9);
      expect(jitter(t, 1016)).toEqual([dx, dy]);
    }
  });
});

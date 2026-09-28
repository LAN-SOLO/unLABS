import { describe, expect, it } from "vitest";
import {
  bestCycle,
  generateMarket,
  isClosedRoute,
  pathYield,
  roundRate,
} from "@/components/world/puzzles/engine/arbitrage";

describe("arbitrage", () => {
  it("is deterministic", () => {
    expect(generateMarket(7, 5, 4, 1.08)).toEqual(generateMarket(7, 5, 4, 1.08));
    expect(generateMarket(7, 5, 4, 1.08)).not.toEqual(generateMarket(8, 5, 4, 1.08));
  });

  for (const [seed, nodes, hops, target] of [
    [7, 5, 4, 1.08],
    [1, 4, 3, 1.05],
    [42, 6, 5, 1.12],
    [99, 5, 3, 1.08],
    [2026, 6, 4, 1.2],
  ]) {
    it(`seed ${seed}: planted cycle reaches the target and is legal`, () => {
      const m = generateMarket(seed, nodes, hops, target);
      expect(m.names).toHaveLength(nodes);
      expect(m.names[0]).toBe("_unSC");
      expect(isClosedRoute(m.planted, m.maxHops)).toBe(true);
      expect(pathYield(m, m.planted)).toBeGreaterThanOrEqual(target);
      const best = bestCycle(m, 0, m.maxHops);
      expect(best.yield).toBeGreaterThanOrEqual(target);
      expect(isClosedRoute(best.path, m.maxHops)).toBe(true);
      expect(pathYield(m, best.path)).toBeCloseTo(best.yield, 10);
    });
  }

  it("most round trips lose value (fees)", () => {
    const m = generateMarket(7, 5, 4, 1.08);
    let losing = 0;
    let total = 0;
    for (let a = 1; a < m.names.length; a++) {
      total++;
      if (pathYield(m, [0, a, 0]) < 1) losing++;
    }
    expect(losing / total).toBeGreaterThanOrEqual(0.75);
  });

  it("validates routes", () => {
    expect(isClosedRoute([0, 1, 0], 4)).toBe(true);
    expect(isClosedRoute([0, 1, 2, 3, 4, 0], 4)).toBe(false);
    expect(isClosedRoute([0, 1, 1, 0], 4)).toBe(false);
    expect(isClosedRoute([0, 1, 2], 4)).toBe(false);
    expect(isClosedRoute([0, 0], 4)).toBe(false);
  });

  it("rounds rates to 4 significant digits", () => {
    expect(roundRate(12.3456)).toBe(12.35);
    expect(roundRate(0.0123456)).toBe(0.01235);
    expect(roundRate(0)).toBe(0);
  });

  it("clamps parameters", () => {
    const m = generateMarket(3, 99, 99, 9);
    expect(m.names.length).toBeLessThanOrEqual(6);
    expect(m.maxHops).toBe(5);
    expect(m.target).toBe(1.5);
    expect(bestCycle(m, 0, m.maxHops).yield).toBeGreaterThanOrEqual(1.5);
  });
});

describe("arbitrage: solvability sweep", () => {
  it("for many seeds the best cycle is a legal route that meets the target", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const [nodes, hops, target] of [
        [4, 3, 1.05],
        [5, 4, 1.08],
        [6, 5, 1.12],
      ] as const) {
        const m = generateMarket(seed, nodes, hops, target);
        const best = bestCycle(m, 0, m.maxHops);
        expect(isClosedRoute(best.path, m.maxHops)).toBe(true);
        expect(best.yield).toBeGreaterThanOrEqual(m.target);
        // The planted route is itself playable and already enough.
        expect(isClosedRoute(m.planted, m.maxHops)).toBe(true);
        expect(pathYield(m, m.planted)).toBeGreaterThanOrEqual(m.target);
      }
    }
  });
});

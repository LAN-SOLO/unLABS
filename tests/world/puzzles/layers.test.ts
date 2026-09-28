import { describe, expect, it } from "vitest";
import {
  COVERAGE_MIN,
  MATERIALS,
  allStacks,
  blockingSlot,
  coverage,
  evaluateStack,
  generateLayers,
  ruleHolds,
  ruleText,
} from "@/components/world/puzzles/engine/layers";

describe("layers", () => {
  it("enumerates ordered selections", () => {
    expect(allStacks(5)).toHaveLength(720);
    expect(allStacks(4)).toHaveLength(360);
  });

  it("is deterministic", () => {
    expect(generateLayers(5, 5)).toEqual(generateLayers(5, 5));
  });

  for (const [seed, slots] of [
    [5, 5],
    [1, 5],
    [9, 4],
    [42, 5],
    [77, 4],
    [2024, 5],
  ]) {
    it(`seed ${seed} / ${slots} slots: 1..3 valid stacks, all pass evaluation`, () => {
      const p = generateLayers(seed, slots);
      expect(p.slots).toBe(slots);
      expect(p.solutions.length).toBeGreaterThanOrEqual(1);
      expect(p.solutions.length).toBeLessThanOrEqual(3);
      expect(p.rules.length).toBeGreaterThanOrEqual(1);
      expect(p.rules.length).toBeLessThanOrEqual(10);
      for (const s of p.solutions) expect(evaluateStack(s, p.rules).ok).toBe(true);
      const brute = allStacks(slots).filter((s) => evaluateStack(s, p.rules).ok);
      expect(brute).toEqual(p.solutions);
      for (const r of p.rules) expect(ruleText(r).length).toBeGreaterThan(5);
    });
  }

  it("rejects incomplete and empty stacks", () => {
    const p = generateLayers(5, 5);
    const empty = evaluateStack([null, null, null, null, null], p.rules);
    expect(empty.ok).toBe(false);
    expect(empty.complete).toBe(false);
    const partial = p.solutions[0].map((m, i) => (i === 0 ? null : m));
    expect(evaluateStack(partial, p.rules).ok).toBe(false);
  });

  it("coverage is the max per interference, not the sum", () => {
    const ferrit = MATERIALS.findIndex((m) => m.id === "ferrit");
    const kupfer = MATERIALS.findIndex((m) => m.id === "kupfer");
    expect(coverage([ferrit, kupfer]).rf).toBe(90);
    expect(coverage([ferrit, kupfer]).thermik).toBe(30);
    expect(blockingSlot([kupfer, ferrit], "rf")).toBe(0);
    expect(blockingSlot([kupfer, ferrit], "mechanik")).toBe(-1);
    expect(COVERAGE_MIN).toBe(80);
  });

  it("rule semantics", () => {
    expect(ruleHolds({ type: "notAdjacent", a: 0, b: 1 }, [0, 1, 2])).toBe(false);
    expect(ruleHolds({ type: "notAdjacent", a: 0, b: 2 }, [0, 1, 2])).toBe(true);
    expect(ruleHolds({ type: "above", a: 0, b: 2 }, [0, 1, 2])).toBe(true);
    expect(ruleHolds({ type: "above", a: 0, b: 5 }, [0, 1, 2])).toBe(false);
    expect(ruleHolds({ type: "directlyAbove", a: 1, b: 2 }, [0, 1, 2])).toBe(true);
    expect(ruleHolds({ type: "notInner", m: 2 }, [0, 1, 2])).toBe(false);
    expect(ruleHolds({ type: "exclude", m: 4 }, [0, 1, 2])).toBe(true);
    expect(ruleHolds({ type: "at", m: 1, slot: 1 }, [0, 1, 2])).toBe(true);
    expect(ruleHolds({ type: "outerMin", trait: "rf", min: 60 }, [0, 1, 2])).toBe(true);
  });
});

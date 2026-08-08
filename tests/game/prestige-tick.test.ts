import { describe, it, expect } from "vitest";
import { advanceResources, prestigeMultiplier } from "@/lib/game/tickEngine";
import type { ResourceMap } from "@/lib/game/tickEngine";

describe("prestigeMultiplier", () => {
  it("maps level 0 to the neutral multiplier 1", () => {
    expect(prestigeMultiplier(0)).toBe(1);
  });

  it("maps level 1 to 1.5 and compounds per level", () => {
    expect(prestigeMultiplier(1)).toBe(1.5);
    expect(prestigeMultiplier(2)).toBeCloseTo(2.25, 10);
    expect(prestigeMultiplier(3)).toBeCloseTo(3.375, 10);
  });

  it("matches 1.5^20 at the DB level cap", () => {
    expect(prestigeMultiplier(20)).toBeCloseTo(Math.pow(1.5, 20), 6);
  });

  it("clamps negative and non-finite levels to the neutral multiplier", () => {
    expect(prestigeMultiplier(-1)).toBe(1);
    expect(prestigeMultiplier(-100)).toBe(1);
    expect(prestigeMultiplier(Number.NaN)).toBe(1);
    expect(prestigeMultiplier(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("advanceResources — rateMultiplier", () => {
  it("keeps the previous behavior when the multiplier is omitted", () => {
    const resources: ResourceMap = {
      abstractum: { amount: 0, capacity: 100, ratePerSecond: 2 },
    };
    const result = advanceResources(resources, 10);
    expect(result.nextResources.abstractum?.amount).toBe(20);
    expect(result.deltas.abstractum).toBe(20);
  });

  it("scales positive (producing) rates by the multiplier", () => {
    const resources: ResourceMap = {
      abstractum: { amount: 0, capacity: 100, ratePerSecond: 2 },
    };
    const result = advanceResources(resources, 10, prestigeMultiplier(1));
    expect(result.nextResources.abstractum?.amount).toBe(30); // 2 × 10 × 1.5
    expect(result.nextResources.abstractum?.totalProduced).toBe(30);
  });

  it("leaves negative (consuming) rates unscaled", () => {
    const resources: ResourceMap = {
      energy: { amount: 50, capacity: 100, ratePerSecond: -2 },
    };
    const result = advanceResources(resources, 10, prestigeMultiplier(1));
    expect(result.nextResources.energy?.amount).toBe(30); // -2 × 10, no ×1.5
    expect(result.nextResources.energy?.totalConsumed).toBe(20);
  });

  it("applies the multiplier per-resource in a mixed map", () => {
    const resources: ResourceMap = {
      abstractum: { amount: 0, capacity: 1000, ratePerSecond: 4 },
      energy: { amount: 100, capacity: 100, ratePerSecond: -1 },
      research: { amount: 10, capacity: 9999, ratePerSecond: 0 },
    };
    const result = advanceResources(resources, 5, 2);
    expect(result.nextResources.abstractum?.amount).toBe(40); // 4 × 5 × 2
    expect(result.nextResources.energy?.amount).toBe(95); // -1 × 5, unscaled
    expect(result.nextResources.research?.amount).toBe(10); // zero rate untouched
  });

  it("still clamps the boosted gain to capacity", () => {
    const resources: ResourceMap = {
      nanomaterial: { amount: 8, capacity: 10, ratePerSecond: 5 },
    };
    const result = advanceResources(resources, 10, 1.5);
    expect(result.nextResources.nanomaterial?.amount).toBe(10);
    expect(result.deltas.nanomaterial).toBe(2);
  });

  it("treats a multiplier of 1 identically to omitting it", () => {
    const resources: ResourceMap = {
      abstractum: { amount: 3, capacity: 100, ratePerSecond: 1.25 },
    };
    const withDefault = advanceResources(resources, 8);
    const withExplicit = advanceResources(resources, 8, 1);
    expect(withExplicit).toEqual(withDefault);
  });
});

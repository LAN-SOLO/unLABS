import { describe, it, expect } from "vitest";
import { advanceResources, createInitialResources } from "@/lib/game/tickEngine";
import type { ResourceMap } from "@/lib/game/tickEngine";

describe("createInitialResources", () => {
  it("starts every resource's lifetime totals at zero", () => {
    const resources = createInitialResources();
    for (const state of Object.values(resources)) {
      expect(state?.totalProduced).toBe(0);
      expect(state?.totalConsumed).toBe(0);
    }
  });
});

describe("advanceResources — lifetime totals", () => {
  it("accumulates totalProduced from a positive rate", () => {
    const resources: ResourceMap = {
      abstractum: { amount: 0, capacity: 100, ratePerSecond: 1 },
    };
    const result = advanceResources(resources, 10);
    expect(result.nextResources.abstractum?.amount).toBe(10);
    expect(result.nextResources.abstractum?.totalProduced).toBe(10);
    expect(result.nextResources.abstractum?.totalConsumed).toBe(0);
  });

  it("accumulates totalConsumed from a negative rate", () => {
    const resources: ResourceMap = {
      energy: { amount: 50, capacity: 100, ratePerSecond: -2 },
    };
    const result = advanceResources(resources, 5);
    expect(result.nextResources.energy?.amount).toBe(40);
    expect(result.nextResources.energy?.totalConsumed).toBe(10);
    expect(result.nextResources.energy?.totalProduced).toBe(0);
  });

  it("only counts the capacity-clamped delta actually applied, not the theoretical rate", () => {
    const resources: ResourceMap = {
      nanomaterial: { amount: 8, capacity: 10, ratePerSecond: 5 },
    };
    // Theoretical gain would be 50, but capacity clamps the applied delta to 2.
    const result = advanceResources(resources, 10);
    expect(result.nextResources.nanomaterial?.amount).toBe(10);
    expect(result.nextResources.nanomaterial?.totalProduced).toBe(2);
  });

  it("carries forward existing lifetime totals across successive ticks", () => {
    const resources: ResourceMap = {
      abstractum: {
        amount: 0,
        capacity: 100,
        ratePerSecond: 1,
        totalProduced: 7,
        totalConsumed: 3,
      },
    };
    const result = advanceResources(resources, 4);
    expect(result.nextResources.abstractum?.totalProduced).toBe(11);
    expect(result.nextResources.abstractum?.totalConsumed).toBe(3);
  });

  it("defaults missing lifetime totals on legacy saves to zero before accumulating", () => {
    const resources: ResourceMap = {
      // Simulates a pre-monitoring save with no totalProduced/totalConsumed fields.
      abstractum: { amount: 0, capacity: 100, ratePerSecond: 3 },
    };
    const result = advanceResources(resources, 2);
    expect(result.nextResources.abstractum?.totalProduced).toBe(6);
  });
});

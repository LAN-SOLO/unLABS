import { describe, it, expect } from "vitest";

import {
  computeAverageTps,
  computeBlockTimeMs,
  mapTpsToTier,
  parsePerformanceSamples,
  DEFAULT_BLOCK_TIME_MS,
  TIER_THRESHOLDS_TPS,
  type PerformanceSample,
} from "@/lib/solana/volatility";

function sample(overrides: Partial<PerformanceSample> = {}): PerformanceSample {
  return { numTransactions: 180_000, numSlots: 150, samplePeriodSecs: 60, ...overrides };
}

describe("mapTpsToTier", () => {
  it("uses ascending thresholds at 1000/2000/3000/4000", () => {
    expect(TIER_THRESHOLDS_TPS).toEqual([1000, 2000, 3000, 4000]);
  });

  it("maps low throughput to tier 1", () => {
    expect(mapTpsToTier(0)).toBe("1");
    expect(mapTpsToTier(999.99)).toBe("1");
  });

  it("crosses each threshold inclusively (tps >= threshold)", () => {
    expect(mapTpsToTier(1000)).toBe("2");
    expect(mapTpsToTier(1999.99)).toBe("2");
    expect(mapTpsToTier(2000)).toBe("3");
    expect(mapTpsToTier(2999.99)).toBe("3");
    expect(mapTpsToTier(3000)).toBe("4");
    expect(mapTpsToTier(3999.99)).toBe("4");
    expect(mapTpsToTier(4000)).toBe("5");
  });

  it("maps typical mainnet load (3000-4500 total TPS) to tiers 4-5", () => {
    expect(mapTpsToTier(3400)).toBe("4");
    expect(mapTpsToTier(4500)).toBe("5");
  });

  it("caps at tier 5 for extreme throughput", () => {
    expect(mapTpsToTier(1_000_000)).toBe("5");
  });

  it("clamps invalid input to tier 1", () => {
    expect(mapTpsToTier(Number.NaN)).toBe("1");
    expect(mapTpsToTier(-42)).toBe("1");
    expect(mapTpsToTier(Number.POSITIVE_INFINITY)).toBe("1");
  });
});

describe("computeAverageTps", () => {
  it("averages per-sample tps", () => {
    const samples = [
      sample({ numTransactions: 120_000, samplePeriodSecs: 60 }), // 2000 tps
      sample({ numTransactions: 240_000, samplePeriodSecs: 60 }), // 4000 tps
    ];
    expect(computeAverageTps(samples)).toBe(3000);
  });

  it("rounds to 2 decimals (numeric(10,2) column)", () => {
    const samples = [sample({ numTransactions: 100_000, samplePeriodSecs: 60 })]; // 1666.666...
    expect(computeAverageTps(samples)).toBe(1666.67);
  });

  it("skips unusable samples and returns null when none remain", () => {
    expect(computeAverageTps([])).toBeNull();
    expect(computeAverageTps([sample({ samplePeriodSecs: 0 })])).toBeNull();
    expect(computeAverageTps([sample({ numTransactions: -1 })])).toBeNull();
    const mixed = [
      sample({ numTransactions: 120_000, samplePeriodSecs: 60 }),
      sample({ samplePeriodSecs: 0 }),
    ];
    expect(computeAverageTps(mixed)).toBe(2000);
  });
});

describe("computeBlockTimeMs", () => {
  it("computes slot-weighted block time (400ms at 150 slots / 60s)", () => {
    expect(computeBlockTimeMs([sample({ numSlots: 150, samplePeriodSecs: 60 })])).toBe(400);
  });

  it("weights by slots across samples", () => {
    const samples = [
      sample({ numSlots: 100, samplePeriodSecs: 60 }), // 600ms/slot
      sample({ numSlots: 200, samplePeriodSecs: 60 }), // 300ms/slot
    ];
    // 120s over 300 slots = 400ms
    expect(computeBlockTimeMs(samples)).toBe(400);
  });

  it("returns null without slot data (caller falls back to default)", () => {
    expect(computeBlockTimeMs([])).toBeNull();
    expect(computeBlockTimeMs([sample({ numSlots: 0 })])).toBeNull();
    expect(DEFAULT_BLOCK_TIME_MS).toBe(400);
  });
});

describe("parsePerformanceSamples", () => {
  it("accepts a valid RPC result array", () => {
    const result = parsePerformanceSamples([
      { numTransactions: 120_000, numSlots: 150, samplePeriodSecs: 60, slot: 123 },
    ]);
    expect(result).toEqual([{ numTransactions: 120_000, numSlots: 150, samplePeriodSecs: 60 }]);
  });

  it("drops malformed entries and rejects fully invalid payloads", () => {
    const mixed = parsePerformanceSamples([
      { numTransactions: "many", numSlots: 150, samplePeriodSecs: 60 },
      null,
      { numTransactions: 60_000, numSlots: 150, samplePeriodSecs: 60 },
    ]);
    expect(mixed).toHaveLength(1);
    expect(parsePerformanceSamples("nope")).toBeNull();
    expect(parsePerformanceSamples(undefined)).toBeNull();
    expect(parsePerformanceSamples([{}])).toBeNull();
  });
});

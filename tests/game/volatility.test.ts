import { describe, it, expect } from "vitest";

import {
  applyVolatility,
  dailyPriceModifier,
  VOLATILITY_MAX_SWING,
  volatilityPercent,
} from "@/lib/game/volatility";

describe("dailyPriceModifier", () => {
  it("is deterministic per day key", () => {
    expect(dailyPriceModifier("2026-08-08")).toBe(dailyPriceModifier("2026-08-08"));
  });

  it("stays within ±25% and quantizes to 1% steps", () => {
    for (let d = 1; d <= 28; d++) {
      const key = `2026-09-${String(d).padStart(2, "0")}`;
      const m = dailyPriceModifier(key);
      expect(m).toBeGreaterThanOrEqual(1 - VOLATILITY_MAX_SWING);
      expect(m).toBeLessThanOrEqual(1 + VOLATILITY_MAX_SWING);
      expect(Math.round(m * 100)).toBeCloseTo(m * 100, 10);
    }
  });

  it("actually varies across days", () => {
    const values = new Set<number>();
    for (let d = 1; d <= 28; d++) {
      values.add(dailyPriceModifier(`2026-09-${String(d).padStart(2, "0")}`));
    }
    expect(values.size).toBeGreaterThan(5);
  });
});

describe("applyVolatility", () => {
  it("keeps free things free", () => {
    expect(applyVolatility(0, "2026-08-08")).toBe(0);
    expect(applyVolatility(-5, "2026-08-08")).toBe(0);
  });

  it("charges at least 1 for any priced action", () => {
    for (let d = 1; d <= 28; d++) {
      expect(applyVolatility(1, `2026-09-${String(d).padStart(2, "0")}`)).toBeGreaterThanOrEqual(1);
    }
  });

  it("rounds to whole _unSC", () => {
    const cost = applyVolatility(50, "2026-08-08");
    expect(Number.isInteger(cost)).toBe(true);
    expect(cost).toBeGreaterThanOrEqual(38);
    expect(cost).toBeLessThanOrEqual(63);
  });
});

describe("volatilityPercent", () => {
  it("matches the modifier", () => {
    const key = "2026-08-08";
    expect(volatilityPercent(key)).toBe(Math.round((dailyPriceModifier(key) - 1) * 100));
  });
});

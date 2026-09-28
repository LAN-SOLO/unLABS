import { describe, expect, it } from "vitest";
import {
  ERA_BITS,
  ERA_SETTINGS,
  IMG,
  crc16,
  displayHex,
  eraChecksum,
  generateEra,
  generateImage,
  hex4,
  quantize,
  settingKey,
  toEraBits,
} from "@/components/world/puzzles/engine/era";

describe("era: helpers", () => {
  it("crc16 matches the CCITT-FALSE check value", () => {
    const bytes = [..."123456789"].map((ch) => ch.charCodeAt(0));
    expect(crc16(bytes)).toBe(0x29b1);
    expect(hex4(0x29b1)).toBe("29B1");
    expect(hex4(0xa)).toBe("000A");
  });

  it("8-bit display blurs B/D/5, other eras stay crisp", () => {
    expect(displayHex("BD5A", 8)).toBe("80SA");
    expect(displayHex("BD5A", 16)).toBe("BD5A");
  });

  it("toEraBits falls back to 16", () => {
    expect(toEraBits(64)).toBe(64);
    expect(toEraBits(12)).toBe(16);
  });
});

describe("era: quantisation", () => {
  const img = generateImage(16);
  it("image has the right size and is deterministic", () => {
    expect(img).toHaveLength(IMG * IMG * 3);
    expect(generateImage(16)).toEqual(img);
    expect(generateImage(17)).not.toEqual(img);
  });

  it("each era limits the colour count", () => {
    const limits: Record<number, number> = { 8: 4, 16: 16, 32: 64, 64: 256 * 2 };
    for (const bits of ERA_BITS) {
      for (const dither of [false, true]) {
        const q = quantize(img, bits, dither);
        const colours = new Set<string>();
        for (let i = 0; i < q.length; i += 3) colours.add(`${q[i]},${q[i + 1]},${q[i + 2]}`);
        expect(colours.size).toBeLessThanOrEqual(limits[bits]);
        expect(q.every((v) => v >= 0 && v <= 255 && Number.isInteger(v))).toBe(true);
      }
    }
  });
});

describe("era: generator", () => {
  for (const [seed, bits, dither] of [
    [16, 16, true],
    [1, 8, false],
    [2003, 32, true],
    [89, 64, false],
    [847, 16, false],
  ] as const) {
    it(`seed ${seed}: exactly one setting matches the target (${bits}/${dither})`, () => {
      const p = generateEra(seed, bits, dither);
      const matches = ERA_SETTINGS.filter(
        (s) => eraChecksum(p.image, s.bits, s.dither) === p.targetSum,
      );
      expect(matches).toEqual([{ bits, dither }]);
      expect(p.sums[settingKey({ bits, dither })]).toBe(p.targetSum);
      expect(generateEra(seed, bits, dither)).toEqual(p);
    });
  }
});

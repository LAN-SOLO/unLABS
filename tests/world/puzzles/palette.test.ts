import { describe, expect, it } from "vitest";
import {
  PALETTE_CHANNELS,
  clueHolds,
  clueText,
  colorName,
  countSolutions,
  generatePalette,
  mixColor,
  permutations,
  toHex,
  wiringSolved,
} from "@/components/world/puzzles/engine/palette";

describe("palette", () => {
  it("is deterministic", () => {
    expect(generatePalette(2400, 4)).toEqual(generatePalette(2400, 4));
  });

  it("permutations enumerates n!", () => {
    expect(permutations(3)).toHaveLength(6);
    expect(permutations(5)).toHaveLength(120);
  });

  for (const [seed, n] of [
    [2400, 4],
    [1, 3],
    [9, 5],
    [77, 4],
    [2005, 5],
    [3, 3],
  ]) {
    it(`seed ${seed} / ${n} channels: clues determine exactly the solution`, () => {
      const p = generatePalette(seed, n);
      expect(p.channels).toHaveLength(n);
      expect([...p.solution].sort()).toEqual(p.channels.map((_, i) => i));
      expect(p.clues.every((c) => clueHolds(c, p.solution, p.channels) === true)).toBe(true);
      expect(countSolutions(n, p.clues, p.channels)).toBe(1);
      expect(wiringSolved(p.solution, p.solution)).toBe(true);
      expect(p.solution.every((o, i) => o === i)).toBe(false);
      for (const c of p.clues) expect(clueText(c, p.channels).length).toBeGreaterThan(5);
    });
  }

  it("rejects an empty or wrong wiring", () => {
    const p = generatePalette(2400, 4);
    expect(wiringSolved([null, null, null, null], p.solution)).toBe(false);
    const swapped = p.solution.slice();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(wiringSolved(swapped, p.solution)).toBe(false);
  });

  it("partial wirings evaluate clues to null when undecidable", () => {
    const ch = PALETTE_CHANNELS.slice(0, 3);
    expect(clueHolds({ type: "higher", a: 0, b: 1 }, [2, null, null], ch)).toBeNull();
    expect(clueHolds({ type: "higher", a: 0, b: 1 }, [2, 1, null], ch)).toBe(true);
    expect(clueHolds({ type: "adjacent", a: 0, b: 1 }, [2, 0, 1], ch)).toBe(false);
    expect(clueHolds({ type: "warmth", out: 0, warm: true }, [0, 1, 2], ch)).toBe(true);
    expect(clueHolds({ type: "warmth", out: 0, warm: true }, [null, 1, 2], ch)).toBeNull();
    expect(clueHolds({ type: "not", input: 1, out: 1 }, [0, 1, 2], ch)).toBe(false);
  });

  it("mixes colours with channel 1 dominating", () => {
    const ch = PALETTE_CHANNELS.slice(0, 3);
    const redFirst = mixColor([0, 1, 2], ch);
    const blueFirst = mixColor([2, 1, 0], ch);
    expect(redFirst[0]).toBeGreaterThan(blueFirst[0]);
    expect(mixColor([null, null, null], ch)).toEqual([0, 0, 0]);
    expect(colorName([255, 60, 60])).toBe("Red");
    expect(toHex([255, 0, 16])).toBe("#ff0010");
  });
});

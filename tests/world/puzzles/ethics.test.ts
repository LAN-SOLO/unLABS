import { describe, expect, it } from "vitest";
import {
  dealEthics,
  ETHICS_MAX_PAIRS,
  ETHICS_MIN_PAIRS,
  ETHICS_PAIRS,
  isMatch,
  pairById,
} from "@/components/world/puzzles/engine/ethics";

describe("ethics pool", () => {
  it("has at least 8 unique, non-empty pairs incl. Kristall #0089", () => {
    expect(ETHICS_PAIRS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ETHICS_PAIRS.map((p) => p.id)).size).toBe(ETHICS_PAIRS.length);
    for (const p of ETHICS_PAIRS) {
      expect(p.szenario.length).toBeGreaterThan(10);
      expect(p.prinzip.length).toBeGreaterThan(10);
      expect(p.erklaerung.length).toBeGreaterThan(10);
    }
    expect(ETHICS_PAIRS.some((p) => p.szenario.includes("#0089"))).toBe(true);
  });
});

describe("dealEthics", () => {
  it("is deterministic and seed-dependent", () => {
    expect(dealEthics(89, 6)).toEqual(dealEthics(89, 6));
    expect(dealEthics(89, 6)).not.toEqual(dealEthics(90, 6));
  });

  for (const pairs of [3, 6, 8]) {
    it(`deals ${pairs} complete pairs that can all be matched`, () => {
      const cards = dealEthics(89, pairs);
      expect(cards).toHaveLength(pairs * 2);
      expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
      const open = new Set<string>();
      for (const a of cards) {
        if (open.has(a.id)) continue;
        const b = cards.find((c) => isMatch(a, c));
        expect(b).toBeDefined();
        if (b) {
          open.add(a.id);
          open.add(b.id);
        }
      }
      expect(open.size).toBe(cards.length);
    });
  }

  it("clamps the pair count", () => {
    expect(dealEthics(1, 1)).toHaveLength(ETHICS_MIN_PAIRS * 2);
    expect(dealEthics(1, 99)).toHaveLength(ETHICS_MAX_PAIRS * 2);
  });

  it("shuffles (not simply paired in order)", () => {
    const cards = dealEthics(89, 6);
    const inOrder = cards.every((c, i) => i % 2 === 0 || cards[i - 1].pairId === c.pairId);
    expect(inOrder).toBe(false);
  });
});

describe("isMatch", () => {
  it("rejects same card, same side and different pairs", () => {
    const [a, b] = dealEthics(3, 4).filter((c) => c.pairId === dealEthics(3, 4)[0].pairId);
    expect(isMatch(a, b)).toBe(true);
    expect(isMatch(a, a)).toBe(false);
    const other = dealEthics(3, 4).find((c) => c.pairId !== a.pairId);
    if (other) expect(isMatch(a, other)).toBe(false);
    expect(pairById(a.pairId)?.id).toBe(a.pairId);
    expect(pairById("nope")).toBeUndefined();
  });
});

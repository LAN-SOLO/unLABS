import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { INSIGHT_BY_ID } from "@/lib/world/content/story";
import type { PuzzleKind } from "@/lib/world/types";

/**
 * Compile-time exhaustive: adding a PuzzleKind without listing it here
 * fails the typecheck, and listing it here without a PuzzleView case fails
 * the test below.
 */
const KINDS: Record<PuzzleKind, true> = {
  pipes: true,
  valve: true,
  lissajous: true,
  cipher: true,
  tones: true,
  heat: true,
  coolant: true,
  keypad: true,
  crc: true,
  sigils: true,
  temporal: true,
  laser: true,
  hue: true,
  era: true,
  arbitrage: true,
  ethics: true,
  memetic: true,
  stencil: true,
  clamp: true,
  trend: true,
  palette: true,
  layers: true,
  solder: true,
  wiring: true,
  morse: true,
  radio: true,
};

const ALL_KINDS = Object.keys(KINDS);

describe("puzzle registry", () => {
  const viewSource = readFileSync(
    join(process.cwd(), "components/world/puzzles/PuzzleView.tsx"),
    "utf8",
  );

  it("PuzzleView handles every PuzzleKind", () => {
    for (const kind of ALL_KINDS) expect(viewSource, kind).toContain(`case "${kind}":`);
  });

  it("every def uses a known kind and every kind has at least one def", () => {
    for (const p of PUZZLES) expect(ALL_KINDS, p.id).toContain(p.kind);
    const used = new Set(PUZZLES.map((p) => p.kind));
    for (const kind of ALL_KINDS) expect(used.has(kind as PuzzleKind), kind).toBe(true);
  });

  it("ids are unique and well-formed", () => {
    const ids = PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^pz_[a-z0-9_]+$/);
  });

  it("defs have German text and only reference existing items/insights", () => {
    for (const p of PUZZLES) {
      expect(p.title.length, p.id).toBeGreaterThan(3);
      expect(p.intro.length, p.id).toBeGreaterThan(20);
      expect(p.mcpSolved.length, p.id).toBeGreaterThan(10);
      for (const it of p.reward?.items ?? []) {
        expect(ITEM_BY_ID.has(it.item), `${p.id}: item ${it.item}`).toBe(true);
        expect(it.count).toBeGreaterThan(0);
      }
      for (const ins of p.reward?.insights ?? [])
        expect(INSIGHT_BY_ID.has(ins), `${p.id}: insight ${ins}`).toBe(true);
    }
  });
});

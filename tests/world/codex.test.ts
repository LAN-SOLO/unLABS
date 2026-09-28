import { describe, expect, it } from "vitest";
import { SYNERGIES } from "@/lib/world/combine";
import {
  CODEX_ENTRIES,
  CODEX_SYNERGY_ROWS,
  CODEX_TABS,
  codexEntriesFor,
  codexProgress,
  codexUnlocked,
  searchCodex,
  type CodexUnlock,
} from "@/lib/world/content/codex";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID, RECIPES, RECIPE_BY_KEY } from "@/lib/world/content/items";
import { ROOM_BY_ID, FLOORS } from "@/lib/world/content/map";
import { INSIGHT_BY_ID, NPCS } from "@/lib/world/content/story";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { AXIS_LABEL } from "@/lib/world/traits";
import { addItem, initialState } from "@/lib/world/game";
import type { Condition } from "@/lib/world/types";

function condProblems(c: Condition): string[] {
  if ("all" in c) return c.all.flatMap(condProblems);
  if ("any" in c) return c.any.flatMap(condProblems);
  if ("not" in c) return condProblems(c.not);
  if ("device" in c) return DEVICE_BY_ID.has(c.device) ? [] : [`device ${c.device}`];
  if ("insight" in c) return INSIGHT_BY_ID.has(c.insight) ? [] : [`insight ${c.insight}`];
  if ("item" in c) return ITEM_BY_ID.has(c.item) ? [] : [`item ${c.item}`];
  if ("puzzle" in c) return PUZZLE_BY_ID.has(c.puzzle) ? [] : [`puzzle ${c.puzzle}`];
  return [];
}

function unlockProblems(u: CodexUnlock | undefined): string[] {
  if (!u || "always" in u) return [];
  if ("anyOf" in u) return u.anyOf.length ? u.anyOf.flatMap(unlockProblems) : ["empty anyOf"];
  if ("cond" in u) return condProblems(u.cond);
  if ("discovered" in u) return DEVICE_BY_ID.has(u.discovered) ? [] : [`device ${u.discovered}`];
  if ("seen" in u) return u.seen.filter((id) => !ITEM_BY_ID.has(id)).map((id) => `item ${id}`);
  if ("visited" in u) return ROOM_BY_ID.has(u.visited) ? [] : [`room ${u.visited}`];
  if ("floor" in u) return FLOORS.some((f) => f.id === u.floor) ? [] : [`floor ${u.floor}`];
  if ("recipe" in u) return RECIPE_BY_KEY.has(u.recipe) ? [] : [`recipe ${u.recipe}`];
  return NPCS.some((n) => n.id === u.met) ? [] : [`npc ${u.met}`];
}

describe("Laborhandbuch (codex)", () => {
  it("has unique entry ids and every tab is populated", () => {
    const ids = CODEX_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of CODEX_TABS) expect(codexEntriesFor(t).length).toBeGreaterThan(0);
  });

  it("only references content that exists (entries and table rows)", () => {
    const problems: string[] = [];
    for (const e of CODEX_ENTRIES) {
      for (const p of unlockProblems(e.unlock)) problems.push(`${e.id}: ${p}`);
      for (const b of e.blocks)
        if (b.kind === "table")
          for (const r of b.rows)
            for (const p of unlockProblems(r.unlock)) problems.push(`${e.id} row: ${p}`);
    }
    expect(problems).toEqual([]);
  });

  it("covers every device, recipe and NPC", () => {
    for (const d of DEVICES) expect(CODEX_ENTRIES.some((e) => e.id === `d_${d.id}`)).toBe(true);
    expect(codexEntriesFor("rezepte")).toHaveLength(RECIPES.length);
    for (const n of NPCS) expect(CODEX_ENTRIES.some((e) => e.id === `p_${n.id}`)).toBe(true);
  });

  it("mirrors the synergy table of the combination engine", () => {
    expect(CODEX_SYNERGY_ROWS).toHaveLength(SYNERGIES.length);
    SYNERGIES.forEach((s, i) => {
      expect(CODEX_SYNERGY_ROWS[i]!.cells).toEqual([
        s.label,
        `${AXIS_LABEL[s.a]} + ${AXIS_LABEL[s.b]}`,
        `+${s.amount} ${AXIS_LABEL[s.gives]}`,
      ]);
    });
  });

  it("unlocks from the state: starter blueprints yes, deep lab no", () => {
    const s = initialState();
    const byId = (id: string) => CODEX_ENTRIES.find((e) => e.id === id)!;
    expect(codexUnlocked(s, byId("d_BTK-001").unlock)).toBe(true);
    expect(codexUnlocked(s, byId("d_TLP-001").unlock)).toBe(false);
    expect(codexUnlocked(s, byId("p_jade").unlock)).toBe(true);
    expect(codexUnlocked(s, byId("p_mcp").unlock)).toBe(false);
    s.flags.met_mcp = true;
    expect(codexUnlocked(s, byId("p_mcp").unlock)).toBe(true);
    expect(codexUnlocked(s, byId("o_werkstatt").unlock)).toBe(false);
    s.flags.visited_werkstatt = true;
    expect(codexUnlocked(s, byId("o_werkstatt").unlock)).toBe(true);
  });

  it("shows a recipe only once all of its inputs were seen", () => {
    const s = initialState();
    const cell = codexEntriesFor("rezepte").find(
      (e) => e.title === ITEM_BY_ID.get("energiezelle")!.name,
    )!;
    expect(codexUnlocked(s, cell.unlock)).toBe(false);
    addItem(s, "abstractum", 3);
    expect(codexUnlocked(s, cell.unlock)).toBe(true);
    const research = codexEntriesFor("rezepte").filter((e) => e.badge === "Research");
    expect(research.length).toBe(RECIPES.filter((r) => r.research).length);
  });

  it("searches only what is unlocked and counts progress", () => {
    const s = initialState();
    expect(searchCodex(s, "volatility").length).toBeGreaterThan(0);
    expect(searchCodex(s, "Teleport Pad")).toEqual([]);
    const before = codexProgress(s, "orte").unlocked;
    s.flags.visited_archiv = true;
    expect(codexProgress(s, "orte").unlocked).toBeGreaterThan(before);
  });
});

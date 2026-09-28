/**
 * Hidden recipes and the experimentation achievements.
 *
 * Secret recipes reward trying odd combinations: they must use real,
 * non-unique items, never shadow another recipe, be obtainable in play
 * (every input is salvageable or craftable), stay hidden in the handbook
 * until combined once, and each one needs a hint somewhere in the world.
 */
import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_BY_ID, evaluateAchievements, isUnlocked } from "@/lib/world/achievements";
import { CODEX_BY_ID, codexUnlocked, recipeId } from "@/lib/world/content/codex";
import { DECOR_ACTIONS } from "@/lib/world/content/decor-actions";
import {
  ITEM_BY_ID,
  PROTECTED_ITEMS,
  RECIPES,
  RECIPE_BY_KEY,
  SECRET_RECIPES,
  comboKey,
} from "@/lib/world/content/items";
import { NOTES, PICKUPS } from "@/lib/world/content/map";
import { addItem, doCombine, initialState } from "@/lib/world/game";
import type { ItemDef, WorldState } from "@/lib/world/types";

function withInputs(inputs: Record<string, number>): WorldState {
  const s = initialState();
  for (const [id, n] of Object.entries(inputs)) addItem(s, id, n);
  return s;
}

function proto(id: string, over: Partial<ItemDef>): ItemDef {
  return {
    id,
    name: id,
    kind: "prototyp",
    description: "",
    traits: {
      energie: 1,
      signal: 0,
      optik: 0,
      thermik: 0,
      mechanik: 0,
      quantum: 0,
      resonanz: 0,
      daten: 0,
    },
    color: "gelb",
    volatility: 1,
    depth: 1,
    ...over,
  };
}

describe("secret recipes", () => {
  it("exist, are unique and use known, non-unique items", () => {
    expect(SECRET_RECIPES.length).toBeGreaterThanOrEqual(6);
    expect(RECIPE_BY_KEY.size).toBe(RECIPES.length);
    for (const r of SECRET_RECIPES) {
      expect(ITEM_BY_ID.has(r.output), r.output).toBe(true);
      expect(r.research, r.note).toBeUndefined();
      for (const id of Object.keys(r.inputs)) {
        expect(ITEM_BY_ID.has(id), id).toBe(true);
        expect(PROTECTED_ITEMS.has(id), id).toBe(false);
      }
      const total = Object.values(r.inputs).reduce((a, b) => a + b, 0);
      expect(total, `${r.note} fits the basic 3-slot bench`).toBeLessThanOrEqual(3);
    }
  });

  it("only need inputs that can be salvaged or crafted", () => {
    const sources = new Set<string>();
    for (const p of PICKUPS) {
      for (const i of p.items) sources.add(i.item);
      for (const i of p.pool ?? []) sources.add(i);
    }
    for (const r of RECIPES) sources.add(r.output);
    sources.add("schlacke"); // every explosion
    for (const a of DECOR_ACTIONS)
      for (const o of a.outcomes) for (const i of o.effects?.items ?? []) sources.add(i.item);
    for (const r of SECRET_RECIPES)
      for (const id of Object.keys(r.inputs))
        expect(sources.has(id), `${r.note}: ${id}`).toBe(true);
  });

  it("combine into their output and reveal themselves in the handbook", () => {
    for (const r of SECRET_RECIPES) {
      const s = withInputs(r.inputs);
      const entry = CODEX_BY_ID.get(recipeId(r.inputs, r.output));
      expect(entry, r.note).toBeDefined();
      expect(entry!.badge).toBe("Secret");
      expect(codexUnlocked(s, entry!.unlock), r.note).toBe(false);
      const res = doCombine(s, r.inputs);
      expect(res.ok, r.note).toBe(true);
      expect(res.kind, r.note).toBe("recipe");
      expect(s.inventory[r.output], r.note).toBe(r.count);
      expect(codexUnlocked(s, entry!.unlock), r.note).toBe(true);
    }
  });

  it("each one is hinted at somewhere in the world (notes or furniture)", () => {
    const texts = [
      ...NOTES.map((n) => n.body),
      ...DECOR_ACTIONS.flatMap((a) => a.outcomes.map((o) => o.text)),
    ].join("\n");
    const hints: Record<string, RegExp> = {
      [comboKey({ leuchtalgen: 1, prisma: 1 })]: /Algae sort light/,
      [comboKey({ myzel: 2, speicherchip: 1 })]: /grown over an old memory chip/,
      [comboKey({ halo_kristall: 1, prisma: 1 })]: /Halo shard in front of a prism/,
      [comboKey({ geroell: 2, magnet: 1 })]: /magnet with screws/,
      [comboKey({ kaffee: 1, leuchtalgen: 1 })]: /Glow algae\? And a sip/,
      [comboKey({ myzel: 1, schlacke: 1 })]: /slag, overgrown with mycelium/,
      [comboKey({ geroell: 2, linse: 1 })]: /magnifying glass/,
    };
    for (const r of SECRET_RECIPES) {
      const re = hints[comboKey(r.inputs)];
      expect(re, `hint for ${r.note}`).toBeDefined();
      expect(texts, r.note).toMatch(re!);
    }
  });
});

describe("experimentation achievements", () => {
  it("are defined with German descriptions", () => {
    for (const id of [
      "nach_vorschrift",
      "zufallsfund",
      "verbotenes_kochbuch",
      "wunderkammer",
      "vierte_generation",
      "farbgedaechtnis",
      "messers_schneide",
      "bot_archaeologie",
      "stammtisch",
    ]) {
      const a = ACHIEVEMENT_BY_ID.get(id);
      expect(a, id).toBeDefined();
      expect(a!.description.length, id).toBeGreaterThan(20);
    }
  });

  it("unlock from secret recipes, prototypes, notes and conversations", () => {
    const s = initialState();
    s.recipesKnown[comboKey(SECRET_RECIPES[0]!.inputs)] = SECRET_RECIPES[0]!.output;
    expect(evaluateAchievements(s)).toContain("zufallsfund");
    for (const r of SECRET_RECIPES) s.recipesKnown[comboKey(r.inputs)] = r.output;
    expect(evaluateAchievements(s)).toContain("verbotenes_kochbuch");

    const colors = ["rot", "gelb", "gruen", "blau", "violett"] as const;
    colors.forEach((c, i) => {
      s.generated[`p_t${i}`] = proto(`p_t${i}`, { color: c, depth: i + 1, volatility: i + 1 });
    });
    const fresh = evaluateAchievements(s);
    expect(fresh).toEqual(
      expect.arrayContaining(["farbgedaechtnis", "vierte_generation", "messers_schneide"]),
    );
    expect(isUnlocked(s, "wunderkammer")).toBe(false);

    for (const n of NOTES) if (n.author === "bot") s.read[n.id] = true;
    expect(evaluateAchievements(s)).toContain("bot_archaeologie");

    for (const id of ["mcp", "x0r8t", "f1ndr", "l0g1k", "p1ndr0", "r3tr0", "b4c0n"])
      s.flags[`met_${id}`] = true;
    for (const id of ["d3c4d3", "w2rek", "k2ldr"]) s.flags[`bot_${id}_awake`] = true;
    expect(evaluateAchievements(s)).not.toContain("stammtisch");
    s.flags["said_c8br41n_What is [EXTERNAL]?"] = true;
    expect(evaluateAchievements(s)).toContain("stammtisch");
  });
});

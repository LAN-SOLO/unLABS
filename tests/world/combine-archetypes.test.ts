import { describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  EXPLOSION_EVENTS,
  PROTO_EFFECTS,
  VOLATILITY_LIMIT,
  archetypeCodex,
  archetypeFlag,
  combine,
  detectArchetype,
  explosionEvent,
  protoEffectCodex,
  prototypeAffordances,
} from "@/lib/world/combine";
import {
  ITEMS,
  ITEM_BY_ID,
  PROTECTED_ITEMS,
  RECIPE_BY_KEY,
  comboKey,
} from "@/lib/world/content/items";
import { addItem, count, doCombine, initialState } from "@/lib/world/game";
import { traits } from "@/lib/world/traits";
import type { ItemDef } from "@/lib/world/types";

/** Every non-recipe combination of 2–3 ordinary authored items. */
function smallCombos(): Record<string, number>[] {
  const pool = ITEMS.filter(
    (i) => !PROTECTED_ITEMS.has(i.id) && i.kind !== "relikt" && i.kind !== "schlacke",
  ).map((i) => i.id);
  const out: Record<string, number>[] = [];
  for (let a = 0; a < pool.length; a++)
    for (let b = a; b < pool.length; b++)
      for (let c = b; c <= pool.length; c++) {
        const inp: Record<string, number> = {};
        for (const id of [pool[a]!, pool[b]!, ...(c < pool.length ? [pool[c]!] : [])])
          inp[id] = (inp[id] ?? 0) + 1;
        if (!RECIPE_BY_KEY.has(comboKey(inp))) out.push(inp);
      }
  return out;
}

const COMBOS = smallCombos();

describe("combination determinism", () => {
  it("same inputs give the same result, regardless of input order or prior state", () => {
    for (const inp of COMBOS.filter((_, i) => i % 97 === 0)) {
      const reversed: Record<string, number> = {};
      for (const k of Object.keys(inp).reverse()) reversed[k] = inp[k]!;
      const a = combine(inp, {});
      const b = combine(reversed, { p_dummy: { ...ITEM_BY_ID.get("linse")!, id: "p_dummy" } });
      expect(b).toEqual(a);
    }
  });

  it("prototypes of prototypes are deterministic too", () => {
    const g1: Record<string, ItemDef> = {};
    const g2: Record<string, ItemDef> = {};
    const p1 = combine({ kupferspule: 1, kondensator: 1 }, g1).output!;
    const p2 = combine({ antenne: 1, platine: 1 }, g1).output!;
    g1[p1.id] = p1;
    g1[p2.id] = p2;
    g2[p2.id] = combine({ antenne: 1, platine: 1 }, g2).output!;
    g2[p1.id] = combine({ kupferspule: 1, kondensator: 1 }, g2).output!;
    const inp = { [p1.id]: 1, [p2.id]: 1 };
    expect(combine(inp, g1)).toEqual(combine(inp, g2));
    expect(combine(inp, g1).output!.depth).toBe(2);
  });
});

describe("archetypes", () => {
  it("has 10–15 archetypes with unique ids, names and complete codex texts", () => {
    expect(ARCHETYPES.length).toBeGreaterThanOrEqual(10);
    expect(ARCHETYPES.length).toBeLessThanOrEqual(15);
    expect(new Set(ARCHETYPES.map((a) => a.id)).size).toBe(ARCHETYPES.length);
    expect(new Set(ARCHETYPES.map((a) => a.name)).size).toBe(ARCHETYPES.length);
    for (const a of ARCHETYPES) {
      expect(a.rule.length, a.id).toBeGreaterThan(5);
      expect(a.property.length, a.id).toBeGreaterThan(10);
      expect(a.lore.length, a.id).toBeGreaterThan(10);
      expect(a.hex, a.id).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("detects by rule, most specific first", () => {
    expect(detectArchetype(traits({ quantum: 11, energie: 7, resonanz: 7 }), 1, 3)?.id).toBe(
      "singularitaet",
    );
    expect(detectArchetype(traits({ quantum: 7, resonanz: 7, signal: 6 }), 1, 3)?.id).toBe(
      "halo_stimmgabel",
    );
    expect(detectArchetype(traits({ quantum: 7, signal: 5 }), 1, 3)?.id).toBe("kohaerenz_anker");
    expect(detectArchetype(traits({ mechanik: 9, daten: 3 }), 1, 3)?.id).toBe("uhrwerk");
    expect(
      detectArchetype(traits({ energie: 4, signal: 4, optik: 4, thermik: 4, mechanik: 4 }), 1, 3)
        ?.id,
    ).toBe("chimaere");
    expect(detectArchetype(traits({ energie: 5, signal: 5, optik: 4, thermik: 4 }), 1, 1)?.id).toBe(
      "ruhepol",
    );
    expect(detectArchetype(traits({ energie: 2 }), 4, 3)?.id).toBe("rekursionsknoten");
    expect(detectArchetype(traits({ energie: 2 }), 3, 3)).toBeUndefined();
  });

  it("every archetype is reachable (2–3 authored parts, or depth 4 for the Rekursionsknoten)", () => {
    const found = new Set<string>();
    let protos = 0;
    for (const inp of COMBOS) {
      const r = combine(inp, {});
      if (r.kind !== "prototype") continue;
      protos++;
      if (r.archetype) found.add(r.archetype.id);
    }
    // Depth 4: fold prototypes into each other.
    const g: Record<string, ItemDef> = {};
    let cur = combine({ kupferspule: 1, kondensator: 1 }, g).output!;
    for (let i = 0; i < 3; i++) {
      g[cur.id] = cur;
      cur = combine({ [cur.id]: 1, linse: 1 }, g).output!;
    }
    expect(cur.depth).toBe(4);
    if (cur.archetype) found.add(cur.archetype);
    for (const a of ARCHETYPES) expect(found.has(a.id), a.id).toBe(true);
    // Special, not the norm.
    let named = 0;
    for (const inp of COMBOS) if (combine(inp, {}).archetype) named++;
    expect(named / protos).toBeLessThan(0.2);
  });

  it("an archetype renames, recolours and tags the prototype", () => {
    const r = combine({ abstractum: 1, exotische_materie: 2 }, {});
    expect(r.kind).toBe("prototype");
    expect(r.archetype?.id).toBe("singularitaet");
    expect(r.output!.name).toBe("Pocket Singularity Mk.1");
    expect(r.output!.color).toBe("violett");
    expect(r.output!.archetype).toBe("singularitaet");
    expect(r.output!.volatility).toBe(5);
    expect(r.synergies.some((x) => x.startsWith("Archetyp"))).toBe(true);
  });

  it("doCombine sets the arch_ flag once and reports it as new only the first time", () => {
    const s = initialState();
    addItem(s, "abstractum", 2);
    addItem(s, "exotische_materie", 4);
    const a = doCombine(s, { abstractum: 1, exotische_materie: 2 });
    expect(a.ok).toBe(true);
    expect(a.archetypeNew).toBe(true);
    expect(s.flags[archetypeFlag("singularitaet")]).toBe(true);
    expect(s.counters.archetypes).toBe(1);
    const b = doCombine(s, { abstractum: 1, exotische_materie: 2 });
    expect(b.archetypeNew).toBe(false);
    expect(s.counters.archetypes).toBe(1);
    expect(a.uses).toContain("ladung");
  });

  it("codex lists every archetype, hiding details until discovered", () => {
    const hidden = archetypeCodex({});
    expect(hidden).toHaveLength(ARCHETYPES.length);
    expect(hidden.every((e) => !e.discovered && e.rule === "???")).toBe(true);
    const one = archetypeCodex({ [archetypeFlag("uhrwerk")]: true });
    const u = one.find((e) => e.id === "uhrwerk")!;
    expect(u.discovered).toBe(true);
    expect(u.name).toBe("Clockwork Automaton");
    expect(
      protoEffectCodex({ proto_effect_ladung: true }).find((e) => e.id === "ladung")?.used,
    ).toBe(true);
  });

  it("affordances follow the traits", () => {
    const p = combine({ induktor: 1, batteriezelle: 1 }, {}).output!;
    expect(prototypeAffordances(p)).toContain("ladung");
    expect(prototypeAffordances(ITEM_BY_ID.get("energiezelle")!)).toEqual([]);
  });
});

describe("instability", () => {
  it("keeps the VOLATILITY_LIMIT semantics: over the limit always explodes into one slag", () => {
    let explosions = 0;
    for (const inp of COMBOS) {
      const vol = Object.entries(inp).reduce(
        (a, [id, n]) => a + ITEM_BY_ID.get(id)!.volatility * n,
        0,
      );
      const r = combine(inp, {});
      expect(r.kind === "explosion", comboKey(inp)).toBe(vol > VOLATILITY_LIMIT);
      if (r.kind === "explosion") {
        explosions++;
        expect(r.output?.id).toBe("schlacke");
        expect(r.count).toBe(1);
        expect(r.event).toBeDefined();
        expect((r.extras ?? []).reduce((a, x) => a + x.count, 0)).toBeLessThanOrEqual(1);
      }
    }
    expect(explosions).toBeGreaterThan(0);
  });

  it("side events are deterministic and every event exists", () => {
    const defs = [
      { def: ITEM_BY_ID.get("antimaterie")!, n: 2 },
      { def: ITEM_BY_ID.get("exotische_materie")!, n: 1 },
    ];
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const key = `test×${i}`;
      const a = explosionEvent(key, defs);
      expect(explosionEvent(key, defs)).toEqual(a);
      seen.add(a.event.id);
      for (const x of a.extras) expect(ITEM_BY_ID.has(x.item), x.item).toBe(true);
    }
    for (const e of EXPLOSION_EVENTS) expect(seen.has(e.id), e.id).toBe(true);
  });

  it("side products only pay out the first time a mix explodes (no farming)", () => {
    // Find a mix whose explosion has a side product.
    let mix: Record<string, number> | undefined;
    for (let a = 1; a <= 3 && !mix; a++)
      for (const other of ["exotische_materie", "plasmaring", "supraleiter", "qubit_chip"]) {
        const inp = { antimaterie: 2, [other]: a };
        const r = combine(inp, {});
        if (r.kind === "explosion" && r.extras?.length) {
          mix = inp;
          break;
        }
      }
    expect(mix).toBeDefined();
    const s = initialState();
    for (const [id, n] of Object.entries(mix!)) addItem(s, id, n * 2);
    const first = doCombine(s, mix!);
    expect(first.ok).toBe(true);
    expect(first.extras?.length).toBe(1);
    expect(s.flags[`explosion_${first.event!.id}`]).toBe(true);
    const x = first.extras![0]!;
    const had = count(s, x.item);
    const second = doCombine(s, mix!);
    expect(second.ok).toBe(true);
    expect(second.extras).toEqual([]);
    expect(second.message).toMatch(/Slag/);
    expect(count(s, x.item)).toBe(had - (mix![x.item] ?? 0));
    expect(count(s, "schlacke")).toBeGreaterThanOrEqual(2);
  });

  it("effect families are 8–12 and fully described", () => {
    expect(PROTO_EFFECTS.length).toBeGreaterThanOrEqual(8);
    expect(PROTO_EFFECTS.length).toBeLessThanOrEqual(12);
    for (const e of PROTO_EFFECTS) {
      expect(e.hint.length, e.id).toBeGreaterThan(20);
      expect(e.effect.length, e.id).toBeGreaterThan(20);
      expect(e.targets.length, e.id).toBeGreaterThan(5);
    }
  });
});

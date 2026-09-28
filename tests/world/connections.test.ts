import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { PICKUPS, PROPS } from "@/lib/world/content/map";
import { NG_PLUS_MCP_LINES, newGamePlus } from "@/lib/world/postgame";
import { buffKey, buffMultiplier } from "@/lib/world/buffs";
import * as decor from "@/lib/world/decor-actions";
import {
  dialogueGreeting,
  initialState,
  missingParts,
  pickupAvailable,
  pickupRespawnLeft,
  pickupRespawnSeconds,
  recipeChain,
  researchFlag,
} from "@/lib/world/game";
import { HINT_LAST_COUNTER, HINT_SPACING, hintSpacing, nextHint } from "@/lib/world/tutorial";
import type { WorldState } from "@/lib/world/types";

const withBuff = (s: WorldState, id: string, until: number): WorldState => {
  s.counters[buffKey(id)] = until;
  return s;
};

describe("buffs in game logic", () => {
  it("decor-actions still re-exports the buff helpers", () => {
    expect(decor.buffMultiplier).toBe(buffMultiplier);
    expect(typeof decor.activeBuffs).toBe("function");
  });

  it("respawn_boost (Wachstumsschub) halves pickup respawn timers while active", () => {
    const p = PICKUPS.find((x) => (x.respawn ?? 0) > 0 && !x.hidden && !x.puzzle)!;
    const s = initialState();
    s.playTime = 1000;
    s.taken[p.id] = 1000;
    const base = pickupRespawnSeconds(s, p);
    expect(base).toBe(p.respawn);
    withBuff(s, "wachstum", 5000);
    expect(pickupRespawnSeconds(s, p)).toBe(p.respawn! * 0.5);
    s.playTime = 1000 + p.respawn! * 0.5;
    expect(pickupAvailable(s, p)).toBe(true);
    expect(pickupRespawnLeft(s, p)).toBe(0);
    // Buff over → the normal timer applies again.
    delete s.counters[buffKey("wachstum")];
    expect(pickupAvailable(s, p)).toBe(false);
    expect(pickupRespawnLeft(s, p)).toBeCloseTo(p.respawn! * 0.5);
  });

  it("hint_boost shortens the tutorial hint spacing", () => {
    const s = initialState();
    s.playTime = 100;
    expect(hintSpacing(s)).toBe(HINT_SPACING);
    withBuff(s, "klarer_kopf", 400);
    expect(hintSpacing(s)).toBe(HINT_SPACING / 2);
    expect(hintSpacing(s, 400)).toBe(HINT_SPACING);
  });

  it("nextHint respects the boosted spacing", () => {
    const ctx = {
      focus: null,
      room: null,
      floor: 0 as const,
      overlay: null,
      powerGeneration: 0,
      hintsEnabled: true,
      cinematic: false,
    };
    const s = initialState();
    s.playTime = 600;
    s.counters[HINT_LAST_COUNTER] = 600 - HINT_SPACING / 2 - 1;
    expect(nextHint(s, ctx, s.playTime)).toBeNull();
    withBuff(s, "durchatmen", 900);
    expect(nextHint(s, ctx, s.playTime)).not.toBeNull();
  });
});

describe("recipe chains", () => {
  it("explains Hochlegierung down to the raw materials", () => {
    const lines = recipeChain("hochlegierung").map((l) => l.text);
    expect(lines[0]).toBe("High Alloy = 2 Base Alloy + Energy Cell");
    const basis = lines.find((l) => l.startsWith("Base Alloy = "))!;
    expect(basis).toContain("3 Abstractum + Energy Cell");
    expect(basis).toContain(" or 3 Rubble");
    expect(lines.some((l) => l.startsWith("Energy Cell = 3 Abstractum"))).toBe(true);
  });

  it("hides research-gated recipes until they are researched", () => {
    const s = initialState();
    const locked = recipeChain("basislegierung", s)[0]!.text;
    expect(locked).not.toContain("Slag");
    s.flags[researchFlag("rueckgewinnung")] = true;
    expect(recipeChain("basislegierung", s)[0]!.text).toContain("3 Slag");
  });

  it("raw materials have no chain", () => {
    expect(recipeChain("abstractum")).toEqual([]);
  });

  it("missingParts names craftable parts a blueprint stage lacks", () => {
    const s = initialState();
    const dev = DEVICES.find((d) =>
      d.stages[0]!.requires.some((r) => r.item && recipeChain(r.item).length > 0),
    )!;
    const req = dev.stages[0]!.requires.find((r) => r.item && recipeChain(r.item).length > 0)!;
    s.discovered[dev.id] = true;
    const parts = missingParts(s, dev.id);
    const part = parts.find((p) => p.item === req.item)!;
    expect(part.label).toBe(req.label);
    expect(part.have).toBe(0);
    expect(part.chain[0]!.item).toBe(req.item);
    // With enough of the part in the inventory it no longer blocks.
    s.inventory[req.item!] = 10;
    expect(missingParts(s, dev.id).some((p) => p.item === req.item)).toBe(false);
  });
});

describe("prop variants with decor actions", () => {
  const prop = (id: string) => PROPS.find((p) => p.id === id)!;

  it("the Kantine coffee machine (a station prop) brews like the decor machine", () => {
    const hit = decor.propDecorAction(prop("kaffeemaschine"));
    expect(hit?.decor).toBe("coffee_machine");
    const s = initialState();
    // Powered lab: pretend the grid delivers (coffee outcomes need ≥ 50 W).
    const r = decor.runPropDecorAction(s, prop("kaffeemaschine"), 0)!;
    expect(r.ok).toBe(true);
    expect(r.placementId).toBe("prop:kaffeemaschine");
    expect(r.actionId).toBe("coffee_machine");
  });

  it("other stations keep only their story beat", () => {
    expect(decor.propDecorAction(prop("teleskop"))).toBeNull();
    expect(decor.propDecorAction(prop("h4l0_kapsel"))).toBeNull();
  });

  it("decor props with a mapped variant get their action", () => {
    expect(decor.propDecorAction(prop("kartentisch"))?.decor).toBe("holo_table");
    expect(decor.propDecorAction(prop("regal_biblio_a"))?.decor).toBe("bookshelf");
    // No variant → nothing.
    expect(decor.propDecorAction(prop("pflanze4b"))).toBeNull();
  });
});

describe("MCP greets New Game+ runs", () => {
  it("replaces the first-contact line with an NG+ line", () => {
    const fresh = dialogueGreeting(initialState(), "mcp").map((l) => l.text);
    expect(fresh.some((t) => t.startsWith("…Operator recognized"))).toBe(true);
    expect(fresh).not.toContain(NG_PLUS_MCP_LINES[0]);

    const prev = initialState();
    prev.endings.frequenz = true;
    const ng = newGamePlus(prev);
    const lines = dialogueGreeting(ng, "mcp").map((l) => l.text);
    expect(lines).toContain(NG_PLUS_MCP_LINES[0]);
    expect(lines.some((t) => t.startsWith("…Operator recognized"))).toBe(false);

    const again = dialogueGreeting(newGamePlus(ng), "mcp").map((l) => l.text);
    expect(again.some((t) => t.includes("third cold start"))).toBe(true);
  });
});

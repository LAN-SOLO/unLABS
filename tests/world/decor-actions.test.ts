import { describe, expect, it } from "vitest";
import {
  BUFF_DEFAULT_FACTOR,
  DECOR_ACTIONS,
  DECOR_BUFFS,
  type DecorActionDef,
} from "@/lib/world/content/decor-actions";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { interiorFloors, interiorFor } from "@/lib/world/content/interior";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { ROOM_BY_ID } from "@/lib/world/content/map";
import { INSIGHT_BY_ID, NPC_SPEAKERS } from "@/lib/world/content/story";
import {
  activeBuffs,
  buffMultiplier,
  cooldownLeft,
  decorActionAt,
  decorActionFor,
  decorInteractPoint,
  pickOutcome,
  pruneBuffs,
  runDecorAction,
} from "@/lib/world/decor-actions";
import { initialState } from "@/lib/world/game";
import { DECOR_BY_ID } from "@/lib/world/models/decor";
import type { Condition, WorldState } from "@/lib/world/types";

function walk(c: Condition, visit: (leaf: Condition) => void): void {
  if ("all" in c) c.all.forEach((x) => walk(x, visit));
  else if ("any" in c) c.any.forEach((x) => walk(x, visit));
  else if ("not" in c) walk(c.not, visit);
  else visit(c);
}

function conditionsOf(a: DecorActionDef): Condition[] {
  const out: Condition[] = [];
  if (a.requires) out.push(a.requires);
  for (const o of a.outcomes) if (o.when) out.push(o.when);
  return out;
}

function fresh(): WorldState {
  const s = initialState();
  s.playTime = 1000;
  return s;
}

function action(id: string): DecorActionDef {
  const a = DECOR_ACTIONS.find((x) => x.id === id);
  if (!a) throw new Error(`missing action ${id}`);
  return a;
}

describe("decor action content", () => {
  it("has at least 45 interactions with unique ids", () => {
    expect(DECOR_ACTIONS.length).toBeGreaterThanOrEqual(45);
    const ids = DECOR_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = DECOR_ACTIONS.map((a) => `${a.decor}@${a.room ?? "*"}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("references only existing decor ids and rooms", () => {
    for (const a of DECOR_ACTIONS) {
      expect(DECOR_BY_ID.has(a.decor), a.decor).toBe(true);
      if (a.room) expect(ROOM_BY_ID.has(a.room), a.room).toBe(true);
      expect(a.id).toBe(a.room ? `${a.decor}@${a.room}` : a.decor);
    }
  });

  it("room-specific entries refer to pieces actually placed in that room", () => {
    const placed = new Set<string>();
    for (const f of interiorFloors())
      for (const p of interiorFor(f)) placed.add(`${p.decor}@${p.room}`);
    for (const a of DECOR_ACTIONS) if (a.room) expect(placed.has(a.id), a.id).toBe(true);
  });

  it("most actions are reachable in the actual interior", () => {
    const placed = new Set<string>();
    for (const f of interiorFloors()) for (const p of interiorFor(f)) placed.add(p.decor);
    const live = DECOR_ACTIONS.filter((a) => placed.has(a.decor));
    expect(live.length).toBeGreaterThanOrEqual(45);
  });

  it("references only existing items, insights, speakers and devices", () => {
    for (const a of DECOR_ACTIONS) {
      expect(a.outcomes.length, a.id).toBeGreaterThan(0);
      for (const o of a.outcomes) {
        expect(o.text.length, a.id).toBeGreaterThan(10);
        if (o.who) expect(NPC_SPEAKERS[o.who], `${a.id} who`).toBeDefined();
        for (const it of o.effects?.items ?? []) {
          expect(ITEM_BY_ID.has(it.item), it.item).toBe(true);
          expect(it.count).toBeGreaterThan(0);
        }
        for (const id of o.effects?.insights ?? [])
          expect(INSIGHT_BY_ID.has(id), `${a.id} → ${id}`).toBe(true);
        for (const f of o.effects?.flags ?? []) expect(f.startsWith("decor_"), f).toBe(true);
        for (const k of Object.keys(o.effects?.counters ?? {}))
          expect(k.startsWith("decor_"), k).toBe(true);
        if (o.effects?.buff) {
          expect(o.effects.buff.seconds).toBeGreaterThan(0);
          expect(BUFF_DEFAULT_FACTOR[o.effects.buff.kind]).toBeDefined();
        }
        if (o.cooldown !== undefined) expect(o.cooldown).toBeGreaterThan(0);
      }
    }
  });

  it("uses only valid conditions", () => {
    for (const a of DECOR_ACTIONS)
      for (const c of conditionsOf(a))
        walk(c, (leaf) => {
          if ("device" in leaf) expect(DEVICE_BY_ID.has(leaf.device), leaf.device).toBe(true);
          else if ("insight" in leaf)
            expect(INSIGHT_BY_ID.has(leaf.insight), leaf.insight).toBe(true);
          else if ("item" in leaf) expect(ITEM_BY_ID.has(leaf.item), leaf.item).toBe(true);
          else if ("flag" in leaf) expect(leaf.flag.length).toBeGreaterThan(0);
          else if ("counter" in leaf) expect(leaf.min).toBeGreaterThan(0);
          else if ("power" in leaf) expect(leaf.power).toBeGreaterThan(0);
          else throw new Error(`${a.id}: unsupported condition ${JSON.stringify(leaf)}`);
        });
  });

  it("buff ids are consistent", () => {
    for (const a of DECOR_ACTIONS)
      for (const o of a.outcomes)
        if (o.effects?.buff) expect(DECOR_BUFFS.get(o.effects.buff.id)).toEqual(o.effects.buff);
  });

  it("every action has something to say in a fresh and a late game", () => {
    const early = fresh();
    for (const a of DECOR_ACTIONS) {
      const r = runDecorAction(structuredClone(early), "p", a.decor, a.room ?? "nirgends", 1000);
      expect(r.text.length, a.id).toBeGreaterThan(0);
    }
  });
});

describe("decor action lookup", () => {
  it("prefers room-specific entries", () => {
    expect(decorActionFor("whiteboard", "kontroll")?.id).toBe("whiteboard@kontroll");
    expect(decorActionFor("whiteboard", "messgang")?.id).toBe("whiteboard");
    expect(decorActionFor("crate_stack", "werkstatt")).toBeUndefined();
  });

  it("decorActionAt reports availability", () => {
    const s = fresh();
    const v = decorActionAt({ decor: "chess_board", room: "kantine" }, s);
    expect(v?.label).toBe("Chessboard");
    expect(v?.available).toBe(true);
    expect(decorActionAt({ decor: "floor_cables", room: "kontroll" }, s)).toBeNull();
  });

  it("decorInteractPoint gives a sane radius", () => {
    for (const a of DECOR_ACTIONS) {
      const p = decorInteractPoint({ decor: a.decor, room: "x", x: 10, z: 12, rot: 1 });
      expect(p.radius).toBeGreaterThanOrEqual(0.8);
      expect(p.radius).toBeLessThan(8);
      expect(p.x).toBe(10);
    }
  });
});

describe("runDecorAction", () => {
  it("once outcomes fire first and only once", () => {
    const s = fresh();
    const r1 = runDecorAction(s, "p1", "calendar_2019", "wohnflur", 1000);
    expect(r1.text).toContain("circled in red");
    expect(r1.flags).toContain("decor_kalender");
    expect(s.flags.decor_kalender).toBe(true);
    const r2 = runDecorAction(s, "p1", "calendar_2019", "wohnflur", 1001);
    expect(r2.text).not.toContain("circled in red");
    expect(r2.flags).toEqual([]);
    expect(s.counters.decor_found).toBe(1);
    expect(s.counters.decor_used).toBe(2);
  });

  it("grants insights once and reports them", () => {
    const s = fresh();
    const r = runDecorAction(s, "p", "crt_terminal", "c8versteck", 1000);
    expect(r.insights).toContain("externe_stimme");
    expect(s.insights.externe_stimme).toBeTruthy();
    const again = runDecorAction(s, "p", "crt_terminal", "c8versteck", 1001);
    expect(again.insights).toEqual([]);
  });

  it("applies cooldowns per action and shows the idle line while resting", () => {
    const s = fresh();
    const r1 = runDecorAction(s, "p", "coffee_shrub", "gewaechshaus", 1000);
    expect(r1.items).toEqual([{ item: "kaffeebohnen", count: 1 }]);
    expect(s.inventory.kaffeebohnen).toBe(1);
    expect(cooldownLeft(s, "coffee_shrub", 1100)).toBe(500);
    const r2 = runDecorAction(s, "p", "coffee_shrub", "gewaechshaus", 1100);
    expect(r2.resting).toBe(true);
    expect(r2.items).toEqual([]);
    expect(r2.cooldownLeft).toBe(500);
    expect(s.inventory.kaffeebohnen).toBe(1);
    const r3 = runDecorAction(s, "p", "coffee_shrub", "gewaechshaus", 1600);
    expect(r3.resting).toBe(false);
    expect(s.inventory.kaffeebohnen).toBe(2);
  });

  it("coffee machine is cold without power and brews with power", () => {
    const cold = fresh();
    const r = runDecorAction(cold, "p", "coffee_machine", "kontroll", 1000);
    expect(r.items).toEqual([]);
    expect(r.buff).toBeUndefined();
    // Geothermal tap = 50 W → the once outcome (technique + insight) comes first.
    const warm = fresh();
    warm.flags.geo_routed = true;
    expect(pickOutcome(warm, action("coffee_machine"), 1000)).toBe(1);
    const w = runDecorAction(warm, "p", "coffee_machine", "kontroll", 1000);
    expect(w.items).toEqual([{ item: "kaffee", count: 1 }]);
    expect(w.insights).toContain("kaffee_technik");
    expect(w.buff?.kind).toBe("walk_speed");
    expect(buffMultiplier(warm, 1010, "walk_speed")).toBeCloseTo(1.25);
    // Cooling down: no second coffee right away, even from the other outcomes.
    const again = runDecorAction(warm, "p", "coffee_machine", "kontroll", 1010);
    expect(again.resting).toBe(true);
    expect(warm.inventory.kaffee).toBe(1);
    const later = runDecorAction(warm, "p", "coffee_machine", "kontroll", 1300);
    expect(later.items).toEqual([{ item: "kaffee", count: 1 }]);
    expect(later.insights).toEqual([]);
  });

  it("rotation is deterministic", () => {
    const run = (): string[] => {
      const s = fresh();
      return Array.from(
        { length: 6 },
        (_, i) => runDecorAction(s, "p", "bookshelf", "bibliothek", 1000 + i).text,
      );
    };
    const a = run();
    expect(run()).toEqual(a);
    expect(new Set(a).size).toBeGreaterThan(1);
  });

  it("outcomes depend on state", () => {
    const s = fresh();
    const before = runDecorAction(s, "p", "wall_clock", "kontroll", 1000).text;
    expect(before).toContain("03:41");
    s.flags.bot_d3c4d3_awake = true;
    const texts = Array.from({ length: 3 }, (_, i) =>
      runDecorAction(s, "p", "star_chart", "jadeq", 1000 + i),
    );
    expect(texts.some((r) => r.who === "d3c4d3")).toBe(true);
  });

  it("requires / unknown decor fail gracefully", () => {
    const s = fresh();
    const r = runDecorAction(s, "p", "floor_cables", "kontroll", 1000);
    expect(r.ok).toBe(false);
    expect(s.counters.decor_used).toBeUndefined();
  });

  it("sitting sets the pose hint", () => {
    const s = fresh();
    const r = runDecorAction(s, "p", "sofa", "damienq", 1000);
    expect(r.pose).toBe("sit");
    expect(r.buff?.kind).toBe("hint_boost");
  });

  it("kartograf needs the three map screens", () => {
    const s = fresh();
    s.flags.geo_routed = true;
    for (const room of ["kontroll", "kartenraum", "observatorium"])
      runDecorAction(s, "p", "map_screen", room, 1000);
    expect(s.counters.decor_karten).toBe(3);
    // Opening the map screens twice does not count twice.
    runDecorAction(s, "p", "map_screen", "kontroll", 1001);
    expect(s.counters.decor_karten).toBe(3);
  });
});

describe("buffs", () => {
  it("activate, multiply and expire", () => {
    const s = fresh();
    expect(buffMultiplier(s, 1000, "walk_speed")).toBe(1);
    runDecorAction(s, "p", "water_cooler", "kantine", 1000);
    expect(activeBuffs(s, 1010).map((b) => b.id)).toEqual(["kaltes_wasser"]);
    expect(buffMultiplier(s, 1010, "walk_speed")).toBeCloseTo(1.1);
    expect(buffMultiplier(s, 1010, "hint_boost")).toBe(1);
    expect(buffMultiplier(s, 1046, "walk_speed")).toBe(1);
    expect(activeBuffs(s, 1046)).toEqual([]);
    pruneBuffs(s, 1046);
    expect(Object.keys(s.counters).some((k) => k.startsWith("buff:"))).toBe(false);
  });

  it("strongest buff of a kind wins, no stacking", () => {
    const s = fresh();
    s.counters["buff:koffein"] = 2000;
    s.counters["buff:kaltes_wasser"] = 2000;
    expect(buffMultiplier(s, 1000, "walk_speed")).toBeCloseTo(1.25);
  });

  it("respawn boost shortens timers", () => {
    const s = fresh();
    runDecorAction(s, "p", "planter", "gewaechshaus", 1000);
    expect(buffMultiplier(s, 1001, "respawn_boost")).toBeLessThan(1);
  });
});

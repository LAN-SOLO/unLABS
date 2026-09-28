import { describe, expect, it } from "vitest";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { DOORS, PICKUPS, PROPS } from "@/lib/world/content/map";
import { initialState } from "@/lib/world/game";
import {
  HINTS,
  HINT_LAST_COUNTER,
  HINT_SPACING,
  hintFlag,
  markHintSeen,
  nextHint,
  resetHints,
  type TutorialContext,
} from "@/lib/world/tutorial";
import { CONTROL_ACTIONS } from "@/lib/world/settings";

const ctx = (patch: Partial<TutorialContext> = {}): TutorialContext => ({
  floor: 0,
  room: "kontroll",
  overlay: null,
  focus: null,
  powerGeneration: 0,
  hintsEnabled: true,
  ...patch,
});

describe("tutorial hints", () => {
  it("has unique ids and valid keys", () => {
    const ids = HINTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    const literal = /^(?:[A-Z]|F\d{1,2})$/;
    for (const h of HINTS)
      for (const k of h.keys ?? [])
        expect((CONTROL_ACTIONS as readonly string[]).includes(k) || literal.test(k)).toBe(true);
  });

  it("stays quiet at the cold start (0 W is not a brownout)", () => {
    const s = initialState();
    expect(nextHint(s, ctx(), 0)).toBeNull();
  });

  it("respects settings.gameplay.hints, cutscenes and menus", () => {
    const s = initialState();
    const c = { overlay: "workbench" };
    expect(nextHint(s, ctx(c), 0)?.id).toBe("workbench");
    expect(nextHint(s, ctx({ ...c, hintsEnabled: false }), 0)).toBeNull();
    expect(nextHint(s, ctx({ ...c, cinematic: true }), 0)).toBeNull();
    expect(nextHint(s, ctx({ overlay: "pause" }), 0)).toBeNull();
  });

  it("shows each hint only once", () => {
    const s = initialState();
    const c = ctx({ overlay: "puzzle" });
    const h = nextHint(s, c, 0)!;
    expect(h.id).toBe("puzzle");
    markHintSeen(s, h.id, 0);
    expect(s.flags[hintFlag("puzzle")]).toBe(true);
    expect(nextHint(s, c, 1000)).toBeNull();
    resetHints(s);
    expect(s.counters[HINT_LAST_COUNTER]).toBeUndefined();
    expect(nextHint(s, c, 0)?.id).toBe("puzzle");
  });

  it("keeps a minimum spacing between hints", () => {
    const s = initialState();
    markHintSeen(s, "puzzle", 100);
    const c = ctx({ overlay: "workbench" });
    expect(HINT_SPACING).toBeGreaterThanOrEqual(20);
    expect(nextHint(s, c, 100 + HINT_SPACING - 1)).toBeNull();
    expect(nextHint(s, c, 100 + HINT_SPACING)?.id).toBe("workbench");
  });

  it("picks the highest priority among eligible hints", () => {
    const s = initialState();
    s.playTime = 400; // camera, quicksave and codex are all due
    s.flags.explosion_seen = true;
    const order: string[] = [];
    for (let i = 0; i < 10; i++) {
      const h = nextHint(s, ctx(), s.playTime);
      if (!h) break;
      order.push(h.id);
      markHintSeen(s, h.id);
      s.playTime += HINT_SPACING;
    }
    expect(order).toEqual(["explosion", "camera", "quicksave", "codex"]);
  });

  it("reacts to focus: blueprint, locked door, keypad, tool, NPC", () => {
    const s = initialState();
    expect(nextHint(s, ctx({ focus: { kind: "device", id: "BTK-001" } }), 0)).toMatchObject({
      id: "blueprint",
      keys: ["interact"],
    });
    const plain = DOORS.find((d) => !d.keypad && !d.secret && d.lock)!;
    expect(nextHint(s, ctx({ focus: { kind: "door", id: plain.id } }), 0)?.id).toBe("door_locked");
    const keypad = DOORS.find((d) => d.keypad)!;
    expect(nextHint(s, ctx({ focus: { kind: "door", id: keypad.id } }), 0)?.id).toBe("keypad");
    expect(nextHint(s, ctx({ focus: { kind: "npc", id: "mcp" } }), 0)?.text).toMatch(/MCP/);
    const tool = PICKUPS.find((p) => p.tool)!;
    s.flags[`salvaged_${tool.id}`] = true;
    const h = nextHint(s, ctx({ justHappened: "pickup_partial" }), 0);
    expect(h?.id).toBe("pickup_tool");
    expect(h?.text).toMatch(/Basic Toolkit/);
  });

  it("explains the elevator only while it lacks power", () => {
    const s = initialState();
    const lift = PROPS.find((p) => p.kind === "elevator")!;
    const focus = { kind: "prop", id: lift.id };
    expect(nextHint(s, ctx({ focus }), 0)?.id).toBe("elevator_nopower");
    markHintSeen(s, "power_panel", 0);
    expect(nextHint(s, ctx({ focus, powerGeneration: 60 }), 1000)?.id).toBe("elevator");
    markHintSeen(s, "elevator", 1000);
    expect(nextHint(s, ctx({ focus, powerGeneration: 60 }), 2000)).toBeNull();
  });

  it("teaches movement right after the cold open, only inside the control room", () => {
    const s = initialState();
    s.flags.visited_kontroll = true;
    expect(nextHint(s, ctx(), 0)).toBeNull(); // cold open still running
    s.flags.scene_wake = true;
    expect(nextHint(s, ctx(), 0)).toMatchObject({
      id: "move",
      keys: ["moveUp", "moveLeft", "moveDown", "moveRight"],
    });
    expect(nextHint(s, ctx({ overlay: "inventory" }), 0)).toBeNull();
    s.flags.visited_werkstatt = true;
    expect(nextHint(s, ctx(), 0)).toBeNull();
  });

  it("teaches the inventory after the first loot and combining at a starved slot", () => {
    const s = initialState();
    s.taken["p_kontroll_regal"] = 1;
    s.inventory = { schrott: 2 };
    expect(nextHint(s, ctx(), 0)?.id).toBe("inventory");
    markHintSeen(s, "inventory", 0);
    const uec = { kind: "device", id: "UEC-001" };
    s.discovered["UEC-001"] = true;
    markHintSeen(s, "blueprint", 0);
    expect(nextHint(s, ctx({ focus: uec }), 1000)).toMatchObject({
      id: "combine_prompt",
      keys: ["workbench"],
    });
    // Once the workbench itself was explained, the prompt is redundant.
    const t = initialState();
    t.inventory = { schrott: 2 };
    t.discovered["UEC-001"] = true;
    markHintSeen(t, "blueprint", 0);
    markHintSeen(t, "workbench", 0);
    expect(nextHint(t, ctx({ focus: uec }), 1000)).toBeNull();
  });

  it("points at the power overview once the first watt flows", () => {
    const s = initialState();
    s.flags.geo_routed = true;
    expect(nextHint(s, ctx({ powerGeneration: 50 }), 0)).toMatchObject({
      id: "power_panel",
      keys: ["power"],
    });
    expect(nextHint(s, ctx({ powerGeneration: 50, overlay: "workbench" }), 0)?.id).toBe(
      "workbench",
    );
  });

  it("offers the map on the first new floor and the wall cutaway below deck", () => {
    const s = initialState();
    expect(nextHint(s, ctx({ floor: 1, room: "geo" }), 0)).toMatchObject({
      id: "map",
      keys: ["M"],
    });
    markHintSeen(s, "map", 0);
    s.playTime = 200;
    for (const r of ["kontroll", "aufzug0", "aufzug1"]) s.flags[`visited_${r}`] = true;
    expect(nextHint(s, ctx({ floor: 1, room: "geo" }), 200)?.id).toBe("walls");
  });

  it("never repeats a hint in a long session", () => {
    const s = initialState();
    s.flags.scene_wake = true;
    s.flags.explosion_seen = true;
    s.flags.geo_routed = true;
    s.inventory = { schrott: 3 };
    s.taken["p_kontroll_regal"] = 1;
    s.insights = { a: 1, b: 1 };
    const seen: string[] = [];
    const lift = PROPS.find((p) => p.kind === "elevator")!;
    const contexts: TutorialContext[] = [
      ctx({ powerGeneration: 50 }),
      ctx({ overlay: "workbench" }),
      ctx({ overlay: "puzzle" }),
      ctx({ floor: 1, room: "geo" }),
      ctx({ focus: { kind: "prop", id: lift.id }, powerGeneration: 50 }),
      ctx({ hiddenBehindWalls: true }),
    ];
    for (let t = 0; t < 3000; t += HINT_SPACING) {
      s.playTime = t;
      for (const c of contexts) {
        const h = nextHint(s, c, t);
        if (!h) continue;
        seen.push(h.id);
        markHintSeen(s, h.id, t);
        break;
      }
    }
    expect(seen.length).toBeGreaterThan(8);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("offers the wall cutaway when the player keeps disappearing", () => {
    const s = initialState();
    expect(nextHint(s, ctx({ hiddenBehindWalls: true }), 0)).toMatchObject({
      id: "walls",
      keys: ["V"],
    });
  });

  it("warns about a brownout once there is some power", () => {
    const s = initialState();
    s.flags.geo_routed = true; // 50 W
    s.built["LCT-001"] = DEVICE_BY_ID.get("LCT-001")!.stages.length; // 55 W
    expect(nextHint(s, ctx({ powerGeneration: 50 }), 0)).toMatchObject({
      id: "brownout",
      keys: ["power"],
    });
  });
});

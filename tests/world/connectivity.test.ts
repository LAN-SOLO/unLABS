/**
 * Connectivity & coverage — "Alles ist miteinander verknüpft."
 * ============================================================
 *
 * Runs the greedy simulated player past the main goals (endings, bots,
 * slices) until everything else a player can do is done too, then prints
 * a coverage report: every note, pickup, puzzle, dialogue option,
 * insight, recipe, achievement, ending, bot quest, door, floor and room
 * must be reached. Also checks that hints, objectives and the compass only
 * ever point at things that exist and are available, that no unique item
 * can be destroyed, that each ending device can be powered on its own,
 * that every device effect does something, and that real play triggers
 * every scripted scene.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { combine } from "@/lib/world/combine";
import { DEVICES, DEVICE_BY_ID, DEVICE_PUZZLES } from "@/lib/world/content/devices";
import { ITEM_BY_ID, PROTECTED_ITEMS, RECIPES, SLICE_ITEM } from "@/lib/world/content/items";
import {
  DOORS,
  ELEVATORS,
  FLOORS,
  FLOOR_ACCESS,
  FLOOR_SIZE,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  ROOM_BY_ID,
  SLICE_PICKUPS,
  roomAt,
} from "@/lib/world/content/map";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { BOT_QUESTS, DEVICE_INSIGHTS, ENDINGS, INSIGHTS, NPCS } from "@/lib/world/content/story";
import {
  RESEARCH_TOPICS,
  addItem,
  autoAssign,
  buildStage,
  count,
  deviceHasUse,
  deviceReadout,
  dialogueOptions,
  doCombine,
  doorIsOpen,
  endingsAt,
  evalCond,
  floorAccessible,
  flyDrone,
  hint,
  initialState,
  isOnline,
  isSwitchedOn,
  itemFits,
  maxCombineInputs,
  noteVisible,
  openBlueprints,
  operateDevice,
  pickupVisible,
  power,
  propUsable,
  puzzleAvailable,
  puzzleLockHint,
  reachableRooms,
  recipeAvailable,
  research,
  toggleDevice,
  uecOutput,
  UEC_NOMINAL,
} from "@/lib/world/game";
import { compassTarget, objectives, topObjective } from "@/lib/world/quests";
import { SCENE_IDS, sceneFor } from "@/lib/world/scenes";
import { dailyPriceModifier } from "@/lib/game/volatility";
import type { Condition, FloorId, WorldState } from "@/lib/world/types";
import { WORLD_FIRMWARE } from "@/lib/world/content/firmware";
import { HUBS } from "@/lib/world/content/links";
import { FIRMWARE } from "@/lib/world/firmware";
import { defaultDone, inReach, knownChecksum, play } from "./simPlayer";
import { fullRun, linkedHubs } from "./simCoverage";

// ── Helpers ───────────────────────────────────────────────────────

function dayWith(pick: "min" | "max"): string {
  let best = "2026-01-01";
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    const m = dailyPriceModifier(d);
    if (pick === "min" ? m < dailyPriceModifier(best) : m > dailyPriceModifier(best)) best = d;
  }
  return best;
}

// ── Coverage ──────────────────────────────────────────────────────

describe("coverage: everything is reachable by play", () => {
  const { run, report } = fullRun();

  it("main goals are reached first (endings, bots, slices)", () => {
    expect(defaultDone(run.s)).toBe(true);
  });

  it("prints an empty coverage report", () => {
    const lines = Object.entries(report)
      .filter(([, l]) => l.length)
      .map(([k, l]) => `${k}: ${l.join(", ")}`);
    expect(lines, `Unerreicht:\n${lines.join("\n")}`).toEqual([]);
  });

  it("every dialogue option of every NPC was offered and chosen", () => {
    expect(report.dialogue).toEqual([]);
  });

  it("every achievement unlocks by play — including the secret ones", () => {
    expect(report.achievements).toEqual([]);
  });

  it("every secret door ends up open and every room gets visited", () => {
    expect(DOORS.filter((d) => d.secret && !doorIsOpen(run.s, d)).map((d) => d.id)).toEqual([]);
    expect(report.rooms).toEqual([]);
  });

  it("real play triggers every scripted scene", () => {
    const fired = new Set<string>();
    for (const t of run.triggers) {
      const id = sceneFor(t)?.id;
      if (id) fired.add(id);
    }
    expect(SCENE_IDS.filter((id) => !fired.has(id))).toEqual([]);
  });

  it("every lab firmware update is flashed by play (manual checksums found in the lab)", () => {
    expect(report.firmware).toEqual([]);
    for (const [id, w] of Object.entries(WORLD_FIRMWARE))
      if (w.source === "manual")
        expect(knownChecksum(run.s, id), `${id}: checksum learned from a found entry`).toBe(
          FIRMWARE.get(id)!.update!.checksum,
        );
  });

  it("every hub links devices in play, and every link a build stage asks for is made", () => {
    expect(HUBS.filter((h) => !linkedHubs(run.s).has(h.id)).map((h) => h.id)).toEqual([]);
    const asked: string[] = [];
    const walk = (c: Condition | undefined): void => {
      if (!c) return;
      if ("all" in c) c.all.forEach(walk);
      else if ("any" in c) c.any.forEach(walk);
      else if ("link" in c) asked.push(`${c.link}>${c.to}`);
    };
    for (const d of DEVICES) for (const st of d.stages) walk(st.when);
    expect(asked.length).toBeGreaterThan(0);
    for (const l of asked) {
      const [hub, to] = l.split(">") as [string, string];
      expect(run.s.links[hub] ?? [], l).toContain(to);
    }
  });

  it("every ending is triggered at a device (or prop) that exists and is reachable", () => {
    for (const e of ENDINGS) {
      const dev = DEVICE_BY_ID.get(e.device);
      const prop = PROPS.find((p) => p.kind === e.device || p.id === e.device);
      expect(dev ?? prop, e.id).toBeDefined();
      const floor = dev ? ROOM_BY_ID.get(dev.room)!.floor : prop!.floor;
      const x = dev ? dev.x : prop!.x;
      const z = dev ? dev.z : prop!.z;
      expect(inReach(run.s, floor, x, z), e.id).toBe(true);
    }
  });
});

// ── Hints, objectives, compass ────────────────────────────────────

/** Positions of everything the player can interact with, per floor. */
function interactables(): Map<FloorId, Set<string>> {
  const m = new Map<FloorId, Set<string>>();
  const add = (f: FloorId, x: number, z: number) => {
    if (!m.has(f)) m.set(f, new Set());
    m.get(f)!.add(`${x},${z}`);
  };
  for (const d of DEVICES) add(ROOM_BY_ID.get(d.room)!.floor, d.x, d.z);
  for (const p of PICKUPS) add(p.floor, p.x, p.z);
  for (const n of NOTES) add(n.floor, n.x, n.z);
  for (const p of PROPS) if (p.kind !== "decor") add(p.floor, p.x, p.z);
  for (const n of NPCS) add(n.floor, n.x, n.z);
  for (const d of DOORS) add(d.floor, d.x, d.z);
  for (const e of ELEVATORS) add(e.floor, e.x, e.z);
  return m;
}

describe("hints, objectives and the compass stay truthful along the playthrough", () => {
  const run = play({ sampleEvery: 1 });
  const spots = interactables();
  const samples = [initialState(), ...run.samples, run.s];

  it("samples the whole game", () => {
    expect(samples.length).toBeGreaterThan(10);
  });

  it("every objective target is a real interactable on an accessible floor", () => {
    const bad: string[] = [];
    for (const s of samples)
      for (const o of objectives(s)) {
        if (!o.target) continue;
        const t = o.target;
        if (!floorAccessible(s, t.floor)) bad.push(`${o.id}: Ebene ${t.floor} gesperrt`);
        if (t.x < 0 || t.x > FLOOR_SIZE.x || t.z < 0 || t.z > FLOOR_SIZE.z)
          bad.push(`${o.id}: außerhalb`);
        if (!spots.get(t.floor)?.has(`${t.x},${t.z}`))
          bad.push(`${o.id}: kein Objekt bei ${t.floor}/${t.x},${t.z}`);
      }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("the compass points at a real interactable on an accessible floor", () => {
    for (const s of samples) {
      const t = compassTarget(s);
      if (!t) continue;
      expect(floorAccessible(s, t.floor)).toBe(true);
      expect(spots.get(t.floor)?.has(`${t.x},${t.z}`)).toBe(true);
    }
  });

  it("objectives that claim »ready« really are", () => {
    const bad: string[] = [];
    for (const s of samples)
      for (const o of objectives(s)) {
        if (o.id.startsWith("geraet_") && o.detail?.startsWith("All set")) {
          const id = o.id.slice("geraet_".length);
          const d = DEVICE_BY_ID.get(id)!;
          if (!inReach(s, ROOM_BY_ID.get(d.room)!.floor, d.x, d.z)) bad.push(`${o.id} unreachable`);
        }
        if (o.id.startsWith("bot_") && o.detail?.startsWith("Ready")) {
          const q = BOT_QUESTS.find((b) => `bot_${b.npc}` === o.id)!;
          const npc = NPCS.find((n) => n.id === q.npc)!;
          if (!inReach(s, npc.floor, npc.x, npc.z)) bad.push(`${o.id} unreachable`);
          if (!dialogueOptions(s, npc.id).some((x) => x.label === q.option))
            bad.push(`${o.id} option not offered`);
        }
        if (o.id.startsWith("slice_p_") && o.detail === "Visible — pick it up.") {
          const p = PICKUPS.find((x) => `slice_${x.id}` === o.id)!;
          if (!pickupVisible(s, p)) bad.push(`${o.id} not visible`);
        }
      }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("the top objective is never about something already done", () => {
    for (const s of samples) {
      const top = topObjective(s);
      if (!top) continue;
      if (top.id.startsWith("geraet_")) {
        const id = top.id.slice("geraet_".length);
        expect(s.built[id] ?? 0).toBeLessThan(DEVICE_BY_ID.get(id)!.stages.length);
      }
      if (top.id.startsWith("bot_")) expect(s.flags[`${top.id}_awake`]).toBeFalsy();
      if (top.id === "strom_ventil") expect(s.puzzles.pz_geo_valve).toBeFalsy();
      if (top.id === "strom_verteiler") expect(s.puzzles.pz_power_flow).toBeFalsy();
    }
  });

  it("MCP / DGN hints only name available things", () => {
    const bad: string[] = [];
    for (const s of samples) {
      const h = hint(s);
      expect(h.length).toBeGreaterThan(10);
      const m = /^Open blueprint: ([^(]+?) \(/.exec(h);
      if (m) {
        const d = DEVICES.find((x) => x.name === m[1]);
        if (!d) bad.push(`unknown device in hint: ${h}`);
        else if (!openBlueprints(s).includes(d)) bad.push(`blueprint not open: ${h}`);
      }
      if (h.includes("echo in the secondary station") && !isOnline(s, "ECR-001"))
        bad.push(`echo not visible: ${h}`);
      if (h.startsWith("BNET-001 reports")) {
        const q = BOT_QUESTS.find((x) => h.includes(x.hint))!;
        const npc = NPCS.find((n) => n.id === q.npc)!;
        if (s.flags[q.flag] || !floorAccessible(s, npc.floor)) bad.push(`bot hint stale: ${h}`);
      }
      if (h.startsWith("The Basic Toolkit") && s.built["BTK-001"] === 3) bad.push(h);
      if (h.startsWith("Build the Portable Workbench") && s.built["PWB-001"] === 3) bad.push(h);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("no raw ids (snake_case flags, counters) leak into hints or objectives", () => {
    const raw = /\b[a-z0-9]+_[a-z0-9_]+\b/;
    const bad: string[] = [];
    for (const s of samples) {
      if (raw.test(hint(s))) bad.push(`hint: ${hint(s)}`);
      for (const o of objectives(s))
        for (const t of [o.text, o.detail ?? ""]) if (raw.test(t)) bad.push(`${o.id}: ${t}`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("the UEC hint's example combination really gives Energie ≥ 8", () => {
    const res = combine({ induktor: 1, batteriezelle: 1 }, {});
    expect(res.kind).toBe("prototype");
    expect(res.output!.traits.energie).toBeGreaterThanOrEqual(8);
  });
});

// ── Soft-locks & balance ──────────────────────────────────────────

describe("no soft-locks", () => {
  it("unique items never fill a trait slot and never go onto the workbench", () => {
    for (const id of PROTECTED_ITEMS) {
      const def = ITEM_BY_ID.get(id)!;
      expect(def, id).toBeDefined();
      // A slot that only asks for traits never takes a unique item.
      expect(itemFits(def, { label: "x", traits: {} })).toBe(false);
      // A slot that names it explicitly still does.
      expect(itemFits(def, { label: "x", item: id })).toBe(true);
      const s = initialState();
      addItem(s, id, 1);
      addItem(s, "schraubensatz", 1);
      const r = doCombine(s, { [id]: 1, schraubensatz: 1 });
      expect(r.ok, id).toBe(false);
      expect(count(s, id)).toBe(1);
    }
  });

  it("the screwdriver survives an auto-assigned build (BTK stage 2 still possible)", () => {
    const s = initialState();
    addItem(s, "schraubendreher", 1);
    const picks = autoAssign(s, [{ label: "Befestigung", traits: { mechanik: 2 } }]);
    expect(picks[0]).toBeNull();
  });

  it("every unique relic has a use or a documented alternative", () => {
    const refs = new Set<string>();
    const walk = (c: Condition | undefined): void => {
      if (!c) return;
      if ("all" in c) c.all.forEach(walk);
      else if ("any" in c) c.any.forEach(walk);
      else if ("not" in c) walk(c.not);
      else if ("item" in c) refs.add(c.item);
    };
    for (const hooks of Object.values(DEVICE_INSIGHTS)) for (const h of hooks) walk(h.requires);
    for (const p of PROPS) walk(p.requires);
    for (const d of DEVICES)
      for (const st of d.stages) for (const r of st.requires) if (r.item) refs.add(r.item);
    // Slices are the collectible: they count via the `slices` counter (CDC-001 hook, secret ending)
    // and are traded between players — they never fill a slot themselves.
    const counted = Object.values(DEVICE_INSIGHTS).some((hooks) =>
      hooks.some((h) => JSON.stringify(h.requires ?? {}).includes('"counter":"slices"')),
    );
    expect(counted).toBe(true);
    for (const id of PROTECTED_ITEMS) if (id !== SLICE_ITEM) expect(refs.has(id), id).toBe(true);
  });

  it("items a relic-hook needs can be re-obtained or have an alternative insight source", () => {
    // Items consumed by a build slot must come back (respawn, drone, recipe) —
    // or the insight their hook grants must also come from somewhere else.
    const consumed = new Set<string>();
    for (const d of DEVICES)
      for (const st of d.stages) for (const r of st.requires) if (r.item) consumed.add(r.item);
    for (const [dev, hooks] of Object.entries(DEVICE_INSIGHTS))
      for (const h of hooks) {
        const req = h.requires;
        if (!req || !("item" in req) || !consumed.has(req.item)) continue;
        const renewable =
          PICKUPS.some(
            (p) =>
              p.respawn && (p.items.some((i) => i.item === req.item) || p.pool?.includes(req.item)),
          ) || RECIPES.some((r) => r.output === req.item);
        const alt = h.grants.every(
          (g) =>
            NOTES.some((n) => n.grants?.includes(g)) ||
            PROPS.some((p) => p.grants?.includes(g)) ||
            PUZZLES.some((p) => p.reward?.insights?.includes(g)) ||
            NPCS.some((n) => n.options.some((o) => o.grants?.includes(g))) ||
            Object.entries(DEVICE_INSIGHTS).some(([d, hs]) =>
              hs.some((x) => x !== h && x.grants.includes(g) && !(d === dev && x.requires === req)),
            ),
        );
        expect(renewable || alt, `${dev} ← ${req.item}`).toBe(true);
      }
  });
});

describe("every alternative of a lock really works on its own", () => {
  it("the Basic Toolkit pries open the powerless archive and server-room doors", () => {
    const s = initialState();
    const doors = DOORS.filter((d) => d.id === "d_archiv" || d.id === "d_rechen");
    expect(doors).toHaveLength(2);
    for (const d of doors) expect(doorIsOpen(s, d), d.id).toBe(false);
    s.built["BTK-001"] = 3;
    expect(power(s).generation).toBe(0);
    for (const d of doors) expect(doorIsOpen(s, d), d.id).toBe(true);
  });

  it("a slice behind a prop's puzzle keeps the prop's condition (Lab Clock, TMP-001)", () => {
    const s = initialState();
    expect(puzzleAvailable(s, "pz_temporal")).toBe(false);
    expect(puzzleLockHint(s, "pz_temporal")).toMatch(/Lab Clock/);
    expect(puzzleAvailable(s, "pz_coolant")).toBe(false);
    // Puzzles without a gated prop host are always startable from their pickup.
    expect(puzzleAvailable(s, "pz_heat")).toBe(true);
    s.flags.geo_routed = true;
    s.built["CLK-001"] = 3;
    expect(puzzleAvailable(s, "pz_temporal")).toBe(true);
  });

  it("the first drone flight alone opens the shaft to Ebene −4", () => {
    const s = initialState();
    s.flags.geo_routed = true;
    for (const id of ["UEC-001", "EXD-001", "RMG-001", "NET-001", "BAT-001"]) s.built[id] = 3;
    expect(floorAccessible(s, 5)).toBe(false);
    expect(flyDrone(s).ok).toBe(true);
    expect(s.insights.schacht_frei).toBeTruthy();
    expect(floorAccessible(s, 5)).toBe(true);
  });

  it("every »any« door lock has a branch that can hold without the others", () => {
    // A device branch must hold with just that device (and the core) built —
    // no branch may silently depend on another one (like a toolkit that needs power).
    for (const d of DOORS) {
      if (!d.lock || !("any" in d.lock)) continue;
      for (const branch of d.lock.any) {
        if (!("device" in branch)) continue;
        const dev = DEVICE_BY_ID.get(branch.device)!;
        const s = initialState();
        s.flags.geo_routed = true;
        s.built["UEC-001"] = 3;
        s.built[dev.id] = dev.stages.length;
        expect(evalCond(s, branch), `${d.id} ← ${dev.id}`).toBe(true);
      }
    }
  });
});

describe("power budget", () => {
  function allBuilt(): WorldState {
    const s = initialState();
    for (const d of DEVICES) s.built[d.id] = d.stages.length;
    s.flags.geo_routed = true;
    return s;
  }

  for (const pick of ["min", "max"] as const) {
    describe(`on the ${pick} volatility day`, () => {
      beforeAll(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(`${dayWith(pick)}T12:00:00Z`));
      });
      afterAll(() => {
        vi.useRealTimers();
      });

      it("each ending's devices run together with everything else switched off", () => {
        for (const e of ENDINGS) {
          const s = allBuilt();
          const need = new Set<string>();
          const walk = (c: Condition): void => {
            if ("all" in c) c.all.forEach(walk);
            else if ("any" in c) c.any.forEach(walk);
            else if ("device" in c) need.add(c.device);
          };
          walk(e.requires);
          if (DEVICE_BY_ID.has(e.device)) need.add(e.device);
          const keep = new Set([...need, "THM-001", "MCP-000"]);
          for (const d of DEVICES) if (d.power > 0 && !keep.has(d.id)) toggleDevice(s, d.id);
          for (const id of need) expect(isOnline(s, id), `${e.id}: ${id}`).toBe(true);
        }
      });

      it("even with only UEC + geothermal, the early game floors open (≥ 100 W)", () => {
        const s = initialState();
        s.flags.geo_routed = true;
        s.built["UEC-001"] = 3;
        expect(power(s).generation).toBeGreaterThanOrEqual(100);
      });
    });
  }

  it("VLT-001 lifts the core back to nominal output on weak days", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${dayWith("min")}T12:00:00Z`));
    try {
      expect(uecOutput()).toBeLessThan(UEC_NOMINAL);
      const s = initialState();
      s.flags.geo_routed = true;
      for (const id of ["UEC-001", "BAT-001", "VLT-001"]) s.built[id] = 3;
      const on = power(s).generation;
      toggleDevice(s, "VLT-001");
      const off = power(s).generation;
      expect(on - off).toBe(UEC_NOMINAL - uecOutput());
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── Device effects ────────────────────────────────────────────────

/** Devices whose effect lives in game.ts code rather than in a content condition. */
const CODE_MECHANICS: Record<string, (on: WorldState, off: WorldState) => boolean> = {
  "UEC-001": (a, b) => power(a).generation > power(b).generation,
  "MFR-001": (a, b) => power(a).generation > power(b).generation,
  "PWR-001": (a, b) => power(a).generation > power(b).generation,
  "BAT-001": (a, b) => power(a).generation > power(b).generation,
  "PWD-001": (a, b) => power(a).generation > power(b).generation,
  "VLT-001": (a) => deviceReadout(a, "VLT-001").length > 0,
  "PWB-001": (a, b) => maxCombineInputs(a) > maxCombineInputs(b),
  "THM-001": (a, b) => power(a).online.has("TLP-001") && !power(b).online.has("TLP-001"),
  "EXD-001": (a) => deviceHasUse("EXD-001") && deviceReadout(a, "EXD-001").length > 0,
  "NXS-01": (a) => research(a).ok,
  "ATK-001": (a) => deviceReadout(a, "ATK-001").length > 0,
  "CPU-001": (a) => deviceReadout(a, "CPU-001").length > 0,
  "CLK-001": (a) => deviceReadout(a, "CLK-001").length > 0,
  "MEM-001": (a) => deviceReadout(a, "MEM-001").length > 0,
  "TMP-001": (a) => deviceReadout(a, "TMP-001").length > 0,
  "QCP-001": (a) => deviceReadout(a, "QCP-001").length > 0,
  "BTK-001": (a, b) => isOnline(a, "BTK-001") && !isOnline(b, "BTK-001"),
  "P3D-001": (a, b) => isOnline(a, "P3D-001") && !isOnline(b, "P3D-001"),
};

describe("every device effect does something", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${dayWith("max")}T12:00:00Z`));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  function allOn(): WorldState {
    const s = initialState();
    for (const d of DEVICES) s.built[d.id] = d.stages.length;
    s.flags.geo_routed = true;
    return s;
  }

  /** Observable world facts that depend on devices. */
  function fingerprint(s: WorldState): string {
    return JSON.stringify({
      pickups: PICKUPS.filter((p) => pickupVisible(s, p)).map((p) => p.id),
      notes: NOTES.filter((n) => noteVisible(s, n.id)).map((n) => n.id),
      props: PROPS.filter((p) => propUsable(s, p.id)).map((p) => p.id),
      doors: DOORS.filter((d) => evalCond(s, d.lock)).map((d) => d.id),
      npcs: NPCS.filter((n) => evalCond(s, n.visible)).map((n) => n.id),
      options: NPCS.flatMap((n) => dialogueOptions(s, n.id).map((o) => `${n.id}:${o.label}`)),
      floors: FLOORS.filter((f) => floorAccessible(s, f.id)).map((f) => f.id),
      devicePuzzles: Object.entries(DEVICE_PUZZLES).flatMap(([d, l]) =>
        isOnline(s, d) ? l.filter((x) => evalCond(s, x.requires)).map((x) => x.puzzle) : [],
      ),
      stations: RECIPES.filter((r) => !r.station || isOnline(s, r.station)).map((r) => r.output),
      endings: ENDINGS.map((e) => endingsAt(s, e.device).map((x) => x.ready)),
    });
  }

  it("switching any device off changes the world (or a documented code mechanic)", () => {
    const flavourOnly: string[] = [];
    for (const d of DEVICES) {
      if (d.id === "MCP-000") continue;
      const on = allOn();
      // Give the conditions something to bite on.
      for (const i of INSIGHTS) on.insights[i.id] = 1;
      const off = structuredClone(on);
      toggleDevice(off, d.id);
      expect(isSwitchedOn(off, d.id)).toBe(false);
      const changed = fingerprint(on) !== fingerprint(off);
      const code = CODE_MECHANICS[d.id]?.(on, off) ?? false;
      const use = deviceHasUse(d.id) && operateDevice(structuredClone(on), d.id).lines.length > 0;
      if (!changed && !code && !use) flavourOnly.push(d.id);
    }
    expect(flavourOnly).toEqual([]);
  });

  it("every device with »Benutzen« says something when used online", () => {
    const s = allOn();
    for (const d of DEVICES) {
      if (!deviceHasUse(d.id)) continue;
      const hooks = DEVICE_INSIGHTS[d.id] ?? [];
      const out = operateDevice(structuredClone(s), d.id);
      // Hook devices may have nothing new without their item/insight — readouts always talk.
      if (!hooks.length) expect(out.lines.length, d.id).toBeGreaterThan(0);
    }
  });

  it("the Nexus researches all topics and unlocks their recipes", () => {
    const s = allOn();
    const gated = RECIPES.filter((r) => r.research);
    expect(gated.length).toBe(RESEARCH_TOPICS.length);
    for (const r of gated) expect(recipeAvailable(s, r)).toBe(false);
    addItem(s, "schlacke", 3);
    expect(doCombine(s, { schlacke: 3 }).ok).toBe(false);
    for (let i = 0; i < 10; i++) {
      research(s);
      s.playTime += 100;
    }
    for (const r of gated) expect(recipeAvailable(s, r), r.output).toBe(true);
    expect(doCombine(s, { schlacke: 3 }).ok).toBe(true);
    expect(s.insights.nexus_forschung).toBeTruthy();
  });

  it("the Quantum Compass reveals slice locations like K2-LDR's catalogue", () => {
    const s = initialState();
    s.flags.geo_routed = true;
    for (const d of DEVICES) s.built[d.id] = d.stages.length;
    toggleDevice(s, "QCP-001");
    const before = objectives(s).filter((o) => o.group === "slices").length;
    toggleDevice(s, "QCP-001");
    const after = objectives(s).filter((o) => o.group === "slices").length;
    expect(before).toBe(1);
    expect(after).toBeGreaterThan(1);
  });

  it("build slots and blueprints of every device are satisfiable in principle", () => {
    // Every named slot item exists and is obtainable from a pickup, recipe, puzzle, drone or bot.
    const sources = new Set<string>();
    for (const p of PICKUPS) {
      p.items.forEach((i) => sources.add(i.item));
      p.pool?.forEach((i) => sources.add(i));
    }
    for (const r of RECIPES) sources.add(r.output);
    for (const p of PUZZLES) p.reward?.items?.forEach((i) => sources.add(i.item));
    for (const id of [
      "halo_staub",
      "supraleiter",
      "qubit_chip",
      "plasmaring",
      "synapsis_splitter",
      "glasfaser",
      "exotische_materie",
      "laserdiode",
      "rotor",
    ])
      sources.add(id);
    for (const d of DEVICES)
      for (const st of d.stages)
        for (const r of st.requires)
          if (r.item) expect(sources.has(r.item), `${d.id}: ${r.item}`).toBe(true);
    // Keep the helper honest: a real build still consumes items.
    const s = initialState();
    addItem(s, "gehaeuseplatte", 1);
    expect(buildStage(s, "CLK-001").ok).toBe(true);
  });

  it("slice pickups are all on accessible floors once the game is done", () => {
    const run = play();
    for (const id of SLICE_PICKUPS) {
      const p = PICKUPS.find((x) => x.id === id)!;
      expect(floorAccessible(run.s, p.floor), id).toBe(true);
      expect(reachableRooms(run.s, p.floor).has(roomAt(p.floor, p.x, p.z)!.id), id).toBe(true);
    }
    expect(ROOMS.length).toBeGreaterThan(40);
    expect(FLOOR_ACCESS[3].keypad).toBe("pz_keypad_tiefe");
  });
});

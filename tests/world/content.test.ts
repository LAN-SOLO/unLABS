import { describe, expect, it } from "vitest";
import { DEVICES, DEVICE_BY_ID, DEVICE_PUZZLES } from "@/lib/world/content/devices";
import { ITEM_BY_ID, RECIPES, SLICE_ITEM, SLICE_TOTAL } from "@/lib/world/content/items";
import {
  DOORS,
  ELEVATORS,
  FLOORS,
  FLOORS_TOP_DOWN,
  FLOOR_ACCESS,
  FLOOR_BY_ID,
  FLOOR_SIZE,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  ROOM_BY_ID,
  SLICE_PICKUPS,
  roomAt,
} from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import {
  BOT_QUESTS,
  DEVICE_INSIGHTS,
  ENDINGS,
  INSIGHTS,
  INSIGHT_BY_ID,
  NPCS,
  NPC_SPEAKERS,
} from "@/lib/world/content/story";
import type { Condition } from "@/lib/world/types";

function condRefs(
  c: Condition | undefined,
  out: { insights: string[]; devices: string[]; items: string[]; puzzles: string[] },
): void {
  if (!c) return;
  if ("all" in c) c.all.forEach((x) => condRefs(x, out));
  else if ("any" in c) c.any.forEach((x) => condRefs(x, out));
  else if ("not" in c) condRefs(c.not, out);
  else if ("insight" in c) out.insights.push(c.insight);
  else if ("device" in c) out.devices.push(c.device);
  else if ("item" in c) out.items.push(c.item);
  else if ("puzzle" in c) out.puzzles.push(c.puzzle);
}

function collectAll(): {
  insights: string[];
  devices: string[];
  items: string[];
  puzzles: string[];
} {
  const out = {
    insights: [] as string[],
    devices: [] as string[],
    items: [] as string[],
    puzzles: [] as string[],
  };
  for (const d of DEVICES) {
    out.devices.push(...d.needs);
    d.discover.forEach((c) => condRefs(c, out));
    for (const st of d.stages) {
      condRefs(st.when, out);
      if (st.puzzle) out.puzzles.push(st.puzzle);
      for (const r of st.requires) if (r.item) out.items.push(r.item);
    }
  }
  for (const d of DOORS) {
    condRefs(d.lock, out);
    if (d.keypad) out.puzzles.push(d.keypad);
  }
  for (const p of PICKUPS) {
    condRefs(p.hidden, out);
    p.items.forEach((i) => out.items.push(i.item));
    if (p.puzzle) out.puzzles.push(p.puzzle);
    if (p.tool) out.devices.push(p.tool);
  }
  for (const n of NOTES) {
    condRefs(n.hidden, out);
    out.insights.push(...(n.grants ?? []));
  }
  for (const p of PROPS) {
    condRefs(p.requires, out);
    if (p.puzzle) out.puzzles.push(p.puzzle);
    out.insights.push(...(p.grants ?? []));
  }
  for (const npc of NPCS) {
    condRefs(npc.visible, out);
    npc.greeting.forEach((g) => condRefs(g.when, out));
    for (const o of npc.options) {
      condRefs(o.when, out);
      out.insights.push(...(o.grants ?? []));
      for (const t of o.takes ?? []) out.items.push(t.item);
    }
  }
  for (const e of ENDINGS) condRefs(e.requires, out);
  for (const i of INSIGHTS) condRefs(i.auto, out);
  for (const a of Object.values(FLOOR_ACCESS)) condRefs(a.requires, out);
  for (const hooks of Object.values(DEVICE_PUZZLES))
    for (const h of hooks) {
      out.puzzles.push(h.puzzle);
      condRefs(h.requires, out);
    }
  for (const [dev, hooks] of Object.entries(DEVICE_INSIGHTS)) {
    out.devices.push(dev);
    for (const h of hooks) {
      condRefs(h.requires, out);
      out.insights.push(...h.grants);
    }
  }
  for (const r of RECIPES) {
    out.items.push(r.output, ...Object.keys(r.inputs));
    if (r.station) out.devices.push(r.station);
  }
  return out;
}

describe("lab world content", () => {
  it("has the 38 catalog devices plus the MCP core", () => {
    expect(DEVICES).toHaveLength(39);
    expect(new Set(DEVICES.map((d) => d.id)).size).toBe(DEVICES.length);
  });

  it("references only existing ids", () => {
    const refs = collectAll();
    for (const id of refs.devices) expect(DEVICE_BY_ID.has(id), `device ${id}`).toBe(true);
    for (const id of refs.items) expect(ITEM_BY_ID.has(id), `item ${id}`).toBe(true);
    for (const id of refs.puzzles) expect(PUZZLE_BY_ID.has(id), `puzzle ${id}`).toBe(true);
    for (const id of refs.insights) expect(INSIGHT_BY_ID.has(id), `insight ${id}`).toBe(true);
  });

  it("places every device, pickup, note and prop inside its room / on the grid", () => {
    for (const d of DEVICES) {
      const room = ROOM_BY_ID.get(d.room);
      expect(room, d.id).toBeDefined();
      expect(d.x > room!.x + 2 && d.x < room!.x + room!.w - 2, `${d.id} x`).toBe(true);
      expect(d.z > room!.z + 2 && d.z < room!.z + room!.d - 2, `${d.id} z`).toBe(true);
    }
    for (const o of [...PICKUPS, ...NOTES, ...PROPS]) {
      expect(roomAt(o.floor, o.x, o.z), `${o.id} at ${o.x},${o.z}`).toBeDefined();
      expect(o.x > 0 && o.x < FLOOR_SIZE.x && o.z > 0 && o.z < FLOOR_SIZE.z).toBe(true);
    }
  });

  it("puts doors on a wall shared by two rooms", () => {
    for (const d of DOORS) {
      const rooms = ROOMS.filter((r) => r.floor === d.floor);
      const onWall = rooms.filter((r) =>
        d.axis === "x"
          ? (d.z === r.z || d.z === r.z + r.d) && d.x > r.x && d.x < r.x + r.w
          : (d.x === r.x || d.x === r.x + r.w) && d.z > r.z && d.z < r.z + r.d,
      );
      expect(onWall.length, `door ${d.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("has an acyclic device dependency graph", () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string): void => {
      if (done.has(id)) return;
      expect(visiting.has(id), `cycle at ${id}`).toBe(false);
      visiting.add(id);
      DEVICE_BY_ID.get(id)!.needs.forEach(visit);
      visiting.delete(id);
      done.add(id);
    };
    DEVICES.forEach((d) => visit(d.id));
  });

  it("keeps FLOORS indexable by id and orders them top to bottom", () => {
    FLOORS.forEach((f, i) => expect(f.id).toBe(i));
    for (const f of FLOORS) expect(FLOOR_BY_ID[f.id]).toBe(f);
    expect(FLOORS_TOP_DOWN.map((f) => f.id)).toEqual([4, 0, 1, 2, 3, 5]);
    for (const f of FLOORS) {
      expect(FLOOR_ACCESS[f.id], `access ${f.id}`).toBeDefined();
      expect(
        ELEVATORS.some((e) => e.floor === f.id),
        `elevator ${f.id}`,
      ).toBe(true);
      expect(
        PROPS.some((p) => p.floor === f.id && p.kind === "elevator"),
        `elevator prop ${f.id}`,
      ).toBe(true);
    }
  });

  it("gives each new floor 6–9 rooms and an elevator shaft like the others", () => {
    for (const floor of [4, 5] as const) {
      const rooms = ROOMS.filter((r) => r.floor === floor);
      expect(rooms.length).toBeGreaterThanOrEqual(6);
      expect(rooms.length).toBeLessThanOrEqual(9);
      const shaft = rooms.find((r) => r.id === `aufzug${floor}`)!;
      expect([shaft.x, shaft.z, shaft.w, shaft.d]).toEqual([112, 52, 16, 20]);
      for (const r of rooms) expect(r.blurb.length, r.id).toBeGreaterThan(40);
    }
  });

  it("never lets two rooms on a floor overlap (walls may be shared)", () => {
    for (const a of ROOMS)
      for (const b of ROOMS) {
        if (a === b || a.floor !== b.floor) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
        expect(ox > 0 && oz > 0, `${a.id} × ${b.id}`).toBe(false);
      }
    for (const r of ROOMS) {
      expect(r.x >= 0 && r.z >= 0, r.id).toBe(true);
      expect(r.x + r.w < FLOOR_SIZE.x && r.z + r.d < FLOOR_SIZE.z, r.id).toBe(true);
    }
  });

  it("gives every new or secret room something to do", () => {
    const newRooms = ROOMS.filter(
      (r) => r.floor >= 4 || DOORS.some((d) => d.secret && d.floor === r.floor && touches(d, r)),
    );
    expect(newRooms.length).toBeGreaterThan(15);
    for (const r of newRooms) {
      if (r.theme === "elevator") continue;
      const inside = (o: { floor: number; x: number; z: number }) =>
        o.floor === r.floor && roomAt(r.floor, o.x, o.z)?.id === r.id;
      const things =
        PICKUPS.filter(inside).length +
        NOTES.filter(inside).length +
        PROPS.filter(inside).length +
        NPCS.filter(inside).length;
      expect(things, r.id).toBeGreaterThan(0);
    }
  });

  it("hides secret doors behind a scan or a laser cut", () => {
    const secret = DOORS.filter((d) => d.secret);
    expect(secret.length).toBeGreaterThanOrEqual(2);
    for (const d of secret) expect(d.lock, d.id).toBeDefined();
    expect(secret.some((d) => d.floor === 0)).toBe(true);
    expect(secret.some((d) => d.floor === 3)).toBe(true);
  });

  it("scatters exactly 30 unique slices of Crystal #0089 over all floors", () => {
    expect(SLICE_PICKUPS).toHaveLength(SLICE_TOTAL);
    const slices = PICKUPS.filter((p) => p.items.some((i) => i.item === SLICE_ITEM));
    for (const p of slices) {
      expect(p.items, p.id).toEqual([{ item: SLICE_ITEM, count: 1 }]);
      expect(p.respawn, p.id).toBeUndefined();
      expect(p.pool, p.id).toBeUndefined();
    }
    for (const f of FLOORS)
      expect(
        slices.some((p) => p.floor === f.id),
        `floor ${f.id}`,
      ).toBe(true);
    expect(slices.filter((p) => p.hidden || p.puzzle).length).toBeGreaterThanOrEqual(20);
  });

  it("places every NPC inside a room on its floor", () => {
    for (const n of NPCS) {
      const r = roomAt(n.floor, n.x, n.z);
      expect(r, n.id).toBeDefined();
    }
  });

  it("wires every bot reactivation quest to a real dialogue option", () => {
    const bots = [
      "x0r8t",
      "f1ndr",
      "l0g1k",
      "p1ndr0",
      "r3tr0",
      "b4c0n",
      "d3c4d3",
      "w2rek",
      "k2ldr",
      "c8br41n",
    ];
    expect(BOT_QUESTS.map((q) => q.npc).sort()).toEqual([...bots].sort());
    for (const q of BOT_QUESTS) {
      const npc = NPCS.find((n) => n.id === q.npc);
      expect(npc, q.npc).toBeDefined();
      const o = npc!.options.find((x) => x.label === q.option);
      expect(o, `${q.npc}: ${q.option}`).toBeDefined();
      expect(o!.flags, q.npc).toContain(q.flag);
      expect(o!.repeatable, q.npc).toBeUndefined();
      expect(NPC_SPEAKERS[q.npc], q.npc).toBeDefined();
      // Something in the world reacts to the bot being awake.
      const reacts =
        PICKUPS.some((p) => JSON.stringify(p.hidden ?? {}).includes(q.flag)) ||
        PROPS.some((p) => JSON.stringify(p.requires ?? {}).includes(q.flag)) ||
        NOTES.some((n) => JSON.stringify(n.hidden ?? {}).includes(q.flag));
      expect(reacts, q.flag).toBe(true);
    }
  });

  it("has a fifth, secret ending and keeps the four original ids", () => {
    const ids = ENDINGS.map((e) => e.id);
    for (const id of ["frequenz", "substrat", "rueckkehr", "halo"]) expect(ids).toContain(id);
    const secret = ENDINGS.filter((e) => e.secret);
    expect(secret.map((e) => e.id)).toEqual(["kristall"]);
  });

  it("ships at least 60 notes and every NPC speaker has a name", () => {
    expect(NOTES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(NOTES.map((n) => n.id)).size).toBe(NOTES.length);
    expect(new Set(PICKUPS.map((p) => p.id)).size).toBe(PICKUPS.length);
    expect(new Set(PROPS.map((p) => p.id)).size).toBe(PROPS.length);
    for (const n of NPCS) expect(NPC_SPEAKERS[n.id], n.id).toBeDefined();
    for (const n of NPCS)
      for (const o of n.options)
        for (const l of o.lines) expect(NPC_SPEAKERS[l.who], `${n.id}: ${l.who}`).toBeDefined();
  });
});

function touches(d: (typeof DOORS)[number], r: (typeof ROOMS)[number]): boolean {
  return d.axis === "x"
    ? (d.z === r.z || d.z === r.z + r.d) && d.x > r.x && d.x < r.x + r.w
    : (d.x === r.x || d.x === r.x + r.w) && d.z > r.z && d.z < r.z + r.d;
}

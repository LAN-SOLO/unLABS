/**
 * Bots at work — every lore bot has a work station it can actually use.
 *
 * Mirrors the engine's `updateStations` (render/engine.ts) without three:
 * built devices (all devices counted as built), room kiosks, furniture
 * with a decor action and interactive props each get a free stand point
 * in their room (`findFreeSpot`, same distance formula). The NPC brain then
 * uses a station when
 * - the bot is stationary and a stand point lies within 2.5 of its home, or
 * - the bot wanders and a stand point lies within `wander + 3` of its home.
 * Devices only count once built, so every bot needs a non-device station
 * (kiosk, prop, furniture) to be busy from the first minute.
 */
import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { decorFootprints, interiorFor } from "@/lib/world/content/interior";
import { DOORS, FLOOR_SIZE, NOTES, PICKUPS, PROPS, ROOMS, roomAt } from "@/lib/world/content/map";
import { NPCS } from "@/lib/world/content/story";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_SCALE,
  ROOM_TERMINAL_SIZE,
} from "@/lib/world/content/terminals";
import { decorInteractPoint, hasDecorAction, propDecorAction } from "@/lib/world/decor-actions";
import { PROP_VARIANT_DECOR } from "@/lib/world/content/decor-actions";
import { FloorCollision } from "@/lib/world/actor";
import { buildFloor } from "@/lib/world/layout";
import { MODEL_SCALE, deviceModel, deviceVisual, propModel } from "@/lib/world/models";
import { DECOR_BY_ID, decorModel } from "@/lib/world/models/decor";
import { findFreeSpot } from "@/lib/world/render/npc-brain";
import type { FloorId, NpcId, PropDef } from "@/lib/world/types";

const LORE_BOTS: readonly NpcId[] = [
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

interface Spot {
  label: string;
  x: number;
  z: number;
  radius: number;
}

interface StationSpot {
  label: string;
  sx: number;
  sz: number;
}

function propGrid(p: PropDef) {
  const decor = p.variant ? PROP_VARIANT_DECOR[p.variant] : undefined;
  return decor && DECOR_BY_ID.has(decor) ? decorModel(decor) : propModel(p.model);
}

function collision(floor: FloorId): FloorCollision {
  const col = new FloorCollision(buildFloor(floor).world, FLOOR_SIZE.x, FLOOR_SIZE.z);
  const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
  for (const d of DEVICES) {
    if (roomFloor.get(d.room) !== floor) continue;
    const visual = deviceVisual(d.id);
    const m = deviceModel(d.id);
    const sc = visual.scale ?? MODEL_SCALE;
    const [fw, fd] = visual.footprint ?? [m.w, m.d];
    const hw = (fw * sc) / 2;
    const hd = (fd * sc) / 2;
    col.addFootprint(
      d.x + 0.5 - hw + 0.3,
      d.z + 0.5 - hd + 0.3,
      d.x + 0.5 + hw - 0.3,
      d.z + 0.5 + hd - 0.3,
      (visual.height ?? m.h) * sc,
    );
  }
  for (const p of PROPS) {
    if (p.floor !== floor || p.model === "elevator") continue;
    const m = propGrid(p);
    const rot = (p.rot ?? 0) % 2 === 1;
    const hw = ((rot ? m.d : m.w) * MODEL_SCALE) / 2;
    const hd = ((rot ? m.w : m.d) * MODEL_SCALE) / 2;
    col.addFootprint(
      p.x + 0.8 - hw,
      p.z + 0.8 - hd,
      p.x + 0.2 + hw,
      p.z + 0.2 + hd,
      m.h * MODEL_SCALE,
    );
  }
  for (const f of decorFootprints(floor)) col.addFootprint(f.x0, f.z0, f.x1, f.z1, f.h);
  for (const t of ROOM_TERMINALS) {
    if (t.floor !== floor) continue;
    const odd = (t.rot ?? 0) % 2 === 1;
    const hw = ((odd ? ROOM_TERMINAL_SIZE.d : ROOM_TERMINAL_SIZE.w) * ROOM_TERMINAL_SCALE) / 2;
    const hd = ((odd ? ROOM_TERMINAL_SIZE.w : ROOM_TERMINAL_SIZE.d) * ROOM_TERMINAL_SCALE) / 2;
    col.addFootprint(
      t.x + 0.8 - hw,
      t.z + 0.8 - hd,
      t.x + 0.2 + hw,
      t.z + 0.2 + hd,
      ROOM_TERMINAL_SIZE.h * ROOM_TERMINAL_SCALE,
    );
  }
  return col;
}

function workSpots(floor: FloorId): Spot[] {
  const out: Spot[] = [];
  const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
  for (const d of DEVICES) {
    if (roomFloor.get(d.room) !== floor) continue;
    const visual = deviceVisual(d.id);
    const m = deviceModel(d.id);
    const sc = visual.scale ?? MODEL_SCALE;
    const [fw, fd] = visual.footprint ?? [m.w, m.d];
    out.push({ label: `device ${d.id}`, x: d.x, z: d.z, radius: (Math.max(fw, fd) * sc) / 2 });
  }
  for (const p of PROPS) {
    if (p.floor !== floor) continue;
    if (p.kind === "decor" && !propDecorAction(p)) continue;
    const m = propGrid(p);
    out.push({
      label: `prop ${p.id}`,
      x: p.x,
      z: p.z,
      radius: (Math.max(m.w, m.d) * MODEL_SCALE) / 2,
    });
  }
  for (const t of ROOM_TERMINALS)
    if (t.floor === floor) out.push({ label: `terminal ${t.id}`, x: t.x, z: t.z, radius: 1.5 });
  for (const p of interiorFor(floor)) {
    if (!hasDecorAction(p.decor, p.room)) continue;
    const { x, z, radius } = decorInteractPoint(p);
    out.push({ label: `decor ${p.decor}`, x, z, radius });
  }
  return out;
}

function stationsFor(floor: FloorId): StationSpot[] {
  const col = collision(floor);
  const walkBlocked = (x: number, z: number): boolean => {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= FLOOR_SIZE.x || cz >= FLOOR_SIZE.z) return true;
    return !col.get(cx, 0, cz) || !!col.get(cx, 1, cz) || !!col.get(cx, 2, cz);
  };
  const out: StationSpot[] = [];
  for (const it of workSpots(floor)) {
    const cx = it.x + 0.5;
    const cz = it.z + 0.5;
    const room = roomAt(floor, cx, cz)?.id;
    if (!room) continue;
    const spot = findFreeSpot(
      (x, z) => walkBlocked(x, z) || roomAt(floor, x, z)?.id !== room,
      cx,
      cz,
      Math.max(1, it.radius) + 1.4,
      0.8,
    );
    if (spot) out.push({ label: it.label, sx: spot.x, sz: spot.z });
  }
  return out;
}

describe("bots at work", () => {
  const cache = new Map<FloorId, StationSpot[]>();
  const stations = (f: FloorId): StationSpot[] => {
    let s = cache.get(f);
    if (!s) {
      s = stationsFor(f);
      cache.set(f, s);
    }
    return s;
  };

  for (const id of LORE_BOTS) {
    it(`${id} has a work station within reach of its home`, () => {
      const npc = NPCS.find((n) => n.id === id);
      expect(npc, id).toBeDefined();
      const hx = npc!.x + 0.5;
      const hz = npc!.z + 0.5;
      const reach = npc!.wander > 0 ? npc!.wander + 3 : 2.5;
      const usable = stations(npc!.floor)
        .map((s) => ({ ...s, d: Math.hypot(s.sx - hx, s.sz - hz) }))
        .filter((s) => s.d <= reach && !s.label.startsWith("device "))
        .map((s) => `${s.label} @${s.d.toFixed(1)}`);
      expect(usable.length, `${id} (${npc!.x},${npc!.z})`).toBeGreaterThan(0);
    });
  }

  it("keeps every bot clear of notes, pickups, props, kiosks and doors", () => {
    const things = [
      ...NOTES.map((n) => ({ l: `note ${n.id}`, f: n.floor, x: n.x, z: n.z, min: 2.5 })),
      ...PICKUPS.map((n) => ({ l: `pickup ${n.id}`, f: n.floor, x: n.x, z: n.z, min: 2.5 })),
      ...PROPS.map((n) => ({ l: `prop ${n.id}`, f: n.floor, x: n.x, z: n.z, min: 2.5 })),
      ...ROOM_TERMINALS.map((n) => ({ l: `kiosk ${n.id}`, f: n.floor, x: n.x, z: n.z, min: 2.5 })),
      ...DOORS.map((n) => ({ l: `door ${n.id}`, f: n.floor, x: n.x, z: n.z, min: 4 })),
    ];
    const problems: string[] = [];
    for (const n of NPCS) {
      if (n.id === "mcp") continue;
      for (const t of things)
        if (t.f === n.floor && Math.hypot(t.x - n.x, t.z - n.z) < t.min)
          problems.push(`${n.id} too close to ${t.l}`);
    }
    expect(problems).toEqual([]);
  });
});

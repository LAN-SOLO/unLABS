/**
 * Walkability — protects the lab from blocked paths.
 *
 * For every floor: terrain from `buildFloor`, plus the collision footprints
 * of ALL devices (as if built), all non-elevator props (same formula as the
 * engine's `rebuildCollision`) and the solid decor. A 3×3-cell walker then
 * floods the grid from the elevator spawn (x − 6 of the shaft); every interactable must be
 * reachable within 5 voxels (+ its interaction radius, as in the engine).
 */
import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { decorFootprints } from "@/lib/world/content/interior";
import {
  DOORS,
  ELEVATORS,
  FLOORS,
  FLOOR_SIZE,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
} from "@/lib/world/content/map";
import { NPCS } from "@/lib/world/content/story";
import { FloorCollision, WALKER } from "@/lib/world/actor";
import { buildFloor } from "@/lib/world/layout";
import { MODEL_SCALE, deviceModel, deviceVisual, propModel } from "@/lib/world/models";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_SCALE,
  ROOM_TERMINAL_SIZE,
} from "@/lib/world/content/terminals";
import type { FloorId } from "@/lib/world/types";

const HEADROOM = 6;
const REACH = 5;

interface Target {
  label: string;
  x: number;
  z: number;
  radius: number;
}

function collisionFor(floor: FloorId, withDecor: boolean): FloorCollision {
  const layout = buildFloor(floor);
  const col = new FloorCollision(layout.world, FLOOR_SIZE.x, FLOOR_SIZE.z);
  const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
  for (const d of DEVICES) {
    if (roomFloor.get(d.room) !== floor) continue;
    const m = deviceModel(d.id);
    const sc = deviceVisual(d.id).scale ?? MODEL_SCALE;
    const hw = (m.w * sc) / 2;
    const hd = (m.d * sc) / 2;
    col.addFootprint(
      d.x + 0.5 - hw + 0.3,
      d.z + 0.5 - hd + 0.3,
      d.x + 0.5 + hw - 0.3,
      d.z + 0.5 + hd - 0.3,
      m.h * sc,
    );
  }
  for (const p of PROPS) {
    if (p.floor !== floor || p.model === "elevator") continue;
    const m = propModel(p.model);
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
  // Room terminals (wall kiosks): prop-like footprint, shrunk by 0.3.
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
  if (withDecor)
    for (const f of decorFootprints(floor)) col.addFootprint(f.x0, f.z0, f.x1, f.z1, f.h);
  return col;
}

function targetsFor(floor: FloorId): Target[] {
  const out: Target[] = [];
  const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
  for (const d of DEVICES) {
    if (roomFloor.get(d.room) !== floor) continue;
    const m = deviceModel(d.id);
    out.push({
      label: `device ${d.id}`,
      x: d.x,
      z: d.z,
      radius: (Math.max(m.w, m.d) * (deviceVisual(d.id).scale ?? MODEL_SCALE)) / 2,
    });
  }
  for (const p of PROPS) {
    if (p.floor !== floor) continue;
    const m = propModel(p.model);
    out.push({
      label: `prop ${p.id}`,
      x: p.x,
      z: p.z,
      radius: (Math.max(m.w, m.d) * MODEL_SCALE) / 2,
    });
  }
  for (const p of PICKUPS)
    if (p.floor === floor) out.push({ label: `pickup ${p.id}`, x: p.x, z: p.z, radius: 1.5 });
  for (const t of ROOM_TERMINALS)
    if (t.floor === floor) out.push({ label: `terminal ${t.id}`, x: t.x, z: t.z, radius: 1.5 });
  for (const n of NOTES)
    if (n.floor === floor) out.push({ label: `note ${n.id}`, x: n.x, z: n.z, radius: 0.8 });
  for (const d of DOORS)
    if (d.floor === floor) out.push({ label: `door ${d.id}`, x: d.x, z: d.z, radius: 2.5 });
  for (const n of NPCS)
    if (n.floor === floor && n.id !== "mcp")
      out.push({ label: `npc ${n.id}`, x: n.x, z: n.z, radius: 1.5 });
  return out;
}

/** Walker centres per voxel (quarter-voxel resolution). */
const Q = 4;

/**
 * Flood fill of walker centres: the walker is the engine's 2.2 × 2.2 box
 * (WALKER.width), every voxel column it overlaps must have a floor and be
 * free from y = 1 up to its head. At integer alignment this is exactly the
 * 3×3-cell walker; the quarter-voxel grid also finds the diagonal squeezes
 * the real walker slides through.
 */
function flood(col: FloorCollision, start: [number, number]): Uint8Array {
  const sx = FLOOR_SIZE.x;
  const sz = FLOOR_SIZE.z;
  const free = new Uint8Array(sx * sz);
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      if (!col.get(x, 0, z)) continue;
      let ok = true;
      for (let y = 1; ok && y <= HEADROOM; y++) if (col.get(x, y, z)) ok = false;
      if (ok) free[x + z * sx] = 1;
    }
  const half = WALKER.width / 2;
  const nx = sx * Q;
  const nz = sz * Q;
  const centre = (i: number, k: number) => {
    const x0 = Math.floor(i / Q - half);
    const x1 = Math.ceil(i / Q + half) - 1;
    const z0 = Math.floor(k / Q - half);
    const z1 = Math.ceil(k / Q + half) - 1;
    if (x0 < 0 || z0 < 0 || x1 >= sx || z1 >= sz) return false;
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) if (!free[x + z * sx]) return false;
    return true;
  };
  const seen = new Uint8Array(nx * nz);
  const si = start[0] * Q + Q / 2;
  const sk = start[1] * Q + Q / 2;
  const queue: number[] = [];
  if (centre(si, sk)) {
    seen[si + sk * nx] = 1;
    queue.push(si + sk * nx);
  }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    const i = c % nx;
    const k = (c - i) / nx;
    for (const [ni, nk] of [
      [i + 1, k],
      [i - 1, k],
      [i, k + 1],
      [i, k - 1],
    ] as const) {
      if (ni < 0 || nk < 0 || ni >= nx || nk >= nz) continue;
      const j = ni + nk * nx;
      if (seen[j] || !centre(ni, nk)) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return seen;
}

function unreachable(floor: FloorId, withDecor: boolean): string[] {
  const e = ELEVATORS.find((q) => q.floor === floor) ?? { x: 120, z: 62 };
  const seen = flood(collisionFor(floor, withDecor), [e.x - 6, e.z]);
  const nx = FLOOR_SIZE.x * Q;
  const nz = FLOOR_SIZE.z * Q;
  return targetsFor(floor)
    .filter((t) => {
      const R = REACH + t.radius;
      const cx = t.x + 0.5;
      const cz = t.z + 0.5;
      for (let k = Math.max(0, Math.floor((cz - R) * Q)); k <= Math.min(nz - 1, (cz + R) * Q); k++)
        for (
          let i = Math.max(0, Math.floor((cx - R) * Q));
          i <= Math.min(nx - 1, (cx + R) * Q);
          i++
        )
          if (seen[i + k * nx] && Math.hypot(i / Q - cx, k / Q - cz) <= R) return false;
      return true;
    })
    .map((t) => t.label);
}

describe("walkability", () => {
  for (const { id: floor } of FLOORS) {
    it(`floor ${floor}: content alone leaves every interactable reachable`, () => {
      expect(unreachable(floor, false)).toEqual([]);
    });
    it(`floor ${floor}: decor never blocks an interactable`, () => {
      const before = new Set(unreachable(floor, false));
      expect(unreachable(floor, true).filter((l) => !before.has(l))).toEqual([]);
    });
  }

  it("the walker can move away from the elevator spawn on every floor", () => {
    for (const { id: floor } of FLOORS) {
      const e = ELEVATORS.find((q) => q.floor === floor) ?? { x: 120, z: 62 };
      const seen = flood(collisionFor(floor, true), [e.x - 6, e.z]);
      expect(seen.reduce((a, b) => a + b, 0)).toBeGreaterThan(Q * Q * 20);
    }
  });
});

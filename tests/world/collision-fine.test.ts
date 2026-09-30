/**
 * Fine collision (half-voxel cells from the model voxels) and the walker.
 *
 *  - The per-column occupancy never blocks more than the old bounding-box
 *    footprints (so no floor can get tighter than walkability / playthrough
 *    and the interior validator assume) — and actually frees floor.
 *  - The walker collides at half-voxel resolution, slips round corners it
 *    only clips with its edge, and still stops flat against walls.
 */
import { describe, expect, it } from "vitest";
import { FINE, FloorCollision, WALKER, Walker } from "@/lib/world/actor";
import { DEVICES } from "@/lib/world/content/devices";
import { decorFootprints } from "@/lib/world/content/interior";
import { FLOORS, FLOOR_SIZE, PROPS, ROOMS } from "@/lib/world/content/map";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_SCALE,
  ROOM_TERMINAL_SIZE,
} from "@/lib/world/content/terminals";
import { buildFloor } from "@/lib/world/layout";
import { MODEL_SCALE, deviceVisual } from "@/lib/world/models";
import { fillCollision, floorOccupants, propGrid } from "@/lib/world/occupancy";
import type { VoxelSource } from "@/lib/voxel/grid";
import type { FloorId } from "@/lib/world/types";

/** The engine's previous collision: shrunk bounding boxes per object (all devices built). */
function legacy(floor: FloorId): FloorCollision {
  const col = new FloorCollision(buildFloor(floor).world, FLOOR_SIZE.x, FLOOR_SIZE.z);
  const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
  for (const d of DEVICES) {
    if (roomFloor.get(d.room) !== floor) continue;
    const v = deviceVisual(d.id);
    const sc = v.scale ?? MODEL_SCALE;
    const [fw, fd] = v.footprint ?? [v.base.w, v.base.d];
    const hw = (fw * sc) / 2;
    const hd = (fd * sc) / 2;
    col.addFootprint(
      d.x + 0.8 - hw,
      d.z + 0.8 - hd,
      d.x + 0.2 + hw,
      d.z + 0.2 + hd,
      (v.height ?? v.base.h) * sc,
    );
  }
  for (const p of PROPS) {
    if (p.floor !== floor || p.model === "elevator") continue;
    const m = propGrid(p);
    const rot = (p.rot ?? 0) % 2 === 1;
    const hw = ((rot ? m.d : m.w) * MODEL_SCALE) / 2;
    const hd = ((rot ? m.w : m.d) * MODEL_SCALE) / 2;
    col.addFootprint(p.x + 0.8 - hw, p.z + 0.8 - hd, p.x + 0.2 + hw, p.z + 0.2 + hd, m.h);
  }
  for (const f of decorFootprints(floor)) col.addFootprint(f.x0, f.z0, f.x1, f.z1, f.h);
  for (const t of ROOM_TERMINALS) {
    if (t.floor !== floor) continue;
    const odd = (t.rot ?? 0) % 2 === 1;
    const hw = ((odd ? ROOM_TERMINAL_SIZE.d : ROOM_TERMINAL_SIZE.w) * ROOM_TERMINAL_SCALE) / 2;
    const hd = ((odd ? ROOM_TERMINAL_SIZE.w : ROOM_TERMINAL_SIZE.d) * ROOM_TERMINAL_SCALE) / 2;
    col.addFootprint(t.x + 0.8 - hw, t.z + 0.8 - hd, t.x + 0.2 + hw, t.z + 0.2 + hd, 5);
  }
  return col;
}

describe("fine collision — occupancy", () => {
  it("never blocks a cell the old bounding-box footprints left free, and frees floor", () => {
    for (const f of FLOORS) {
      const old = legacy(f.id);
      const world = buildFloor(f.id).world;
      const col = new FloorCollision(world, FLOOR_SIZE.x, FLOOR_SIZE.z);
      fillCollision(col, floorOccupants(f.id), () => true);
      let fine = 0;
      let freed = 0;
      for (let fz = 0; fz < FLOOR_SIZE.z * FINE; fz++)
        for (let fx = 0; fx < FLOOR_SIZE.x * FINE; fx++) {
          const x = Math.floor(fx / FINE);
          const z = Math.floor(fz / FINE);
          const wasBlocked = !!old.get(x, 1, z);
          const blocked = col.fineHeight(fx, fz) > 0;
          if (blocked) {
            fine++;
            expect(wasBlocked, `floor ${f.id} cell ${fx},${fz}`).toBe(true);
          } else if (wasBlocked && !world.get(x, 1, z)) freed++;
        }
      expect(fine).toBeGreaterThan(0);
      expect(freed, `floor ${f.id} frees floor around furniture`).toBeGreaterThan(0);
    }
  });

  it("devices only collide once built", () => {
    const f = FLOORS[0]!.id;
    const occ = floorOccupants(f);
    const dev = occ.find((o) => o.device)!;
    const col = new FloorCollision(buildFloor(f).world, FLOOR_SIZE.x, FLOOR_SIZE.z);
    fillCollision(col, occ, () => false);
    expect(dev.cells.every(([x, z]) => col.fineHeight(x, z) === 0)).toBe(true);
    fillCollision(col, occ, () => true);
    expect(dev.cells.every(([x, z]) => col.fineHeight(x, z) > 0)).toBe(true);
  });
});

// ── Walker ───────────────────────────────────────────────────────

/** A floor slab (y = 0) of 40 × 40 voxels plus solid fine cells. */
function arena(solid: (fx: number, fz: number) => boolean): VoxelSource {
  const floor: VoxelSource = {
    get: (x, y, z) => (y === 0 && x >= 0 && z >= 0 && x < 40 && z < 40 ? 1 : 0),
  };
  const col = new FloorCollision(floor, 40, 40);
  for (let fz = 0; fz < 80; fz++)
    for (let fx = 0; fx < 80; fx++) if (solid(fx, fz)) col.markFine(fx, fz, 3);
  return col.fineSource();
}

function walk(src: VoxelSource, w: Walker, move: [number, number], seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(src, move, 1 / 60, FINE);
}

describe("walker", () => {
  it("stops flat against a half-voxel face (no whole-voxel gap)", () => {
    // Wall face at x = 20.5 (fine cells from 41 on).
    const src = arena((fx) => fx >= 41);
    const w = new Walker([15, 1, 10], WALKER.radius);
    walk(src, w, [1, 0], 2);
    expect(w.position[0] + WALKER.radius).toBeGreaterThan(20.49);
    expect(w.position[0] + WALKER.radius).toBeLessThanOrEqual(20.5);
  });

  it("slips round a corner it only clips with its edge", () => {
    // A pillar x ∈ [20, 22), z ∈ [0, 10.5): walking +x at z = 11.05 clips its corner by 0.25.
    const src = arena((fx, fz) => fx >= 40 && fx < 44 && fz < 21);
    const w = new Walker([15, 1, 11.05], WALKER.radius);
    walk(src, w, [1, 0], 2);
    expect(w.position[0]).toBeGreaterThan(23);
  });

  it("still stops at a wall hit head-on (no sideways drift)", () => {
    const src = arena((fx) => fx >= 40 && fx < 44);
    const w = new Walker([15, 1, 10], WALKER.radius);
    walk(src, w, [1, 0], 2);
    expect(w.position[0]).toBeLessThan(20);
    expect(w.position[2]).toBeCloseTo(10, 3);
  });

  it("slides along a wall when walking diagonally into it", () => {
    const src = arena((fx) => fx >= 40 && fx < 44);
    const w = new Walker([15, 1, 10], WALKER.radius);
    walk(src, w, [Math.SQRT1_2, Math.SQRT1_2], 1);
    expect(w.position[0]).toBeLessThan(20);
    expect(w.position[2]).toBeGreaterThan(15);
  });

  it("detects being wedged inside something", () => {
    const src = arena((fx, fz) => fx >= 28 && fx < 32 && fz >= 18 && fz < 22);
    const w = new Walker([15, 1, 10], WALKER.radius);
    expect(w.blockedAt(src, 15, 10, FINE)).toBe(true);
    expect(w.blockedAt(src, 10, 10, FINE)).toBe(false);
  });
});

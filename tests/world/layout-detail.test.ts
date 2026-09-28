/**
 * Architecture detail (layout.ts): themed walls, slab markings, wall-top
 * relief and the deep-floor roughness — deterministic, collision-neutral and
 * within the terrain triangle budget.
 */
import { describe, expect, it } from "vitest";
import { DOORS, ELEVATORS, FLOORS, ROOMS, WALL_HEIGHT } from "@/lib/world/content/map";
import { C, LAB_PALETTE, labMaterialOf } from "@/lib/world/content/palette";
import { ELEVATOR_AREA, buildFloor, isDeepFloor } from "@/lib/world/layout";
import { greedyMesh } from "@/lib/voxel/mesher";
import { CHUNK, type VoxelWorld } from "@/lib/voxel/world";
import type { FloorId } from "@/lib/world/types";

/** Greedy-mesher quads per floor before the detail pass (terrain as the renderer meshes it). */
const QUADS_BEFORE: Record<FloorId, number> = {
  0: 9580,
  1: 11508,
  2: 10770,
  3: 12341,
  4: 11667,
  5: 12540,
};
const QUAD_BUDGET = 1.35;

function quads(world: VoxelWorld): number {
  let n = 0;
  for (const key of world.chunkKeys()) {
    const [cx, cy, cz] = key.split(",").map(Number) as [number, number, number];
    n += greedyMesh(world, [cx * CHUNK, cy * CHUNK, cz * CHUNK], [CHUNK, CHUNK, CHUNK], {
      palette: LAB_PALETTE,
      materialOf: labMaterialOf,
    }).quads;
  }
  return n;
}

function count(world: VoxelWorld, pred: (v: number, x: number, y: number, z: number) => boolean) {
  let n = 0;
  for (let y = 0; y < world.sy; y++)
    for (let z = 0; z < world.sz; z++)
      for (let x = 0; x < world.sx; x++) {
        const v = world.get(x, y, z);
        if (v && pred(v, x, y, z)) n++;
      }
  return n;
}

const inElevator = (x: number, z: number) =>
  x >= ELEVATOR_AREA.x0 - 4 &&
  x <= ELEVATOR_AREA.x1 + 4 &&
  z >= ELEVATOR_AREA.z0 - 4 &&
  z <= ELEVATOR_AREA.z1 + 4;

describe("layout detail", () => {
  for (const { id: floor } of FLOORS) {
    it(`floor ${floor}: deterministic and within the quad budget`, () => {
      const a = buildFloor(floor).world;
      const b = buildFloor(floor).world;
      expect(count(a, (v, x, y, z) => b.get(x, y, z) !== v)).toBe(0);
      expect(quads(a)).toBeLessThanOrEqual(Math.round(QUADS_BEFORE[floor] * QUAD_BUDGET));
    });

    it(`floor ${floor}: wall-top relief only sits on walls`, () => {
      const { world } = buildFloor(floor);
      const loose = count(
        world,
        (_v, x, y, z) =>
          y === WALL_HEIGHT + 1 && !inElevator(x, z) && world.get(x, WALL_HEIGHT, z) === 0,
      );
      expect(loose).toBe(0);
    });
  }

  it("corridor chevrons point toward the elevator", () => {
    // Shaft corridors (Ebene −4) have mine rails instead.
    const corridors = ROOMS.filter((r) => r.theme === "corridor" && r.floor !== 5);
    expect(corridors.length).toBeGreaterThan(0);
    for (const r of corridors) {
      const { world } = buildFloor(r.floor);
      const e = ELEVATORS.find((q) => q.floor === r.floor)!;
      const long = r.w >= r.d;
      const mark = r.floorColor === C.carpet_red ? C.fabric_mustard : C.paint_white;
      // Along positions of the chevron at the centre line (tip) and two cells off it.
      const at = (across: number) => {
        const out: number[] = [];
        for (let along = 10; along < 20; along++) {
          const x = long ? r.x + along : r.x + Math.floor(r.w / 2) + across;
          const z = long ? r.z + Math.floor(r.d / 2) + across : r.z + along;
          if (world.get(x, 0, z) === mark) out.push(along);
        }
        return out;
      };
      const tip = at(0);
      const arm = at(2);
      expect(tip.length, r.id).toBeGreaterThan(0);
      expect(arm.length, r.id).toBeGreaterThan(0);
      const dir = long ? Math.sign(e.x - (r.x + r.w / 2)) : Math.sign(e.z - (r.z + r.d / 2)) || 1;
      expect(Math.sign(tip[0]! - arm[0]!), r.id).toBe(dir);
    }
  });

  it("every visible door has a room plate beside it", () => {
    for (const d of DOORS) {
      if (d.secret) continue;
      const { world } = buildFloor(d.floor);
      const o = -(Math.floor(d.width / 2) + 2);
      const x = d.axis === "x" ? d.x + o : d.x;
      const z = d.axis === "x" ? d.z : d.z + o;
      if (!world.get(x, 5, z)) continue; // plate would sit in an opening
      expect(world.get(x, 6, z), d.id).toBe(C.paint_white);
      expect(world.get(x, 5, z), d.id).toBe(C.blue_paint);
    }
  });

  it("deep floors are rough (puddles, veins, rock/brick), upper floors are not", () => {
    for (const { id: floor } of FLOORS) {
      const { world } = buildFloor(floor);
      const puddles = count(world, (v, _x, y) => y === 0 && v === C.puddle);
      const veins = count(world, (v, _x, y) => y > 0 && (v === C.vein_cyan || v === C.abstractum));
      const rough = count(
        world,
        (v, _x, y) => y > 0 && (v === C.rock || v === C.rock_dark || v === C.brick),
      );
      if (isDeepFloor(floor)) {
        expect(puddles, `floor ${floor} puddles`).toBeGreaterThan(0);
        expect(veins, `floor ${floor} veins`).toBeGreaterThan(0);
        expect(rough, `floor ${floor} rock`).toBeGreaterThan(0);
      } else {
        expect(puddles + rough, `floor ${floor}`).toBe(0);
      }
    }
  });

  it("room themes get distinct wall treatments", () => {
    const signature = (id: string) => {
      const r = ROOMS.find((q) => q.id === id)!;
      const { world } = buildFloor(r.floor);
      const seen = new Set<number>();
      for (let y = 1; y <= WALL_HEIGHT; y++) {
        for (let x = r.x + 1; x < r.x + r.w; x++) {
          seen.add(world.get(x, y, r.z));
          seen.add(world.get(x, y, r.z + r.d));
        }
        for (let z = r.z + 1; z < r.z + r.d; z++) {
          seen.add(world.get(r.x, y, z));
          seen.add(world.get(r.x + r.w, y, z));
        }
      }
      return seen;
    };
    expect(signature("sekundaer").has(C.walnut)).toBe(true); // wainscoting
    expect(signature("diagnose").has(C.tile_white)).toBe(true); // tiled lab
    expect(signature("fertigung").has(C.safety_yellow)).toBe(true); // hazard base / signage
  });
});

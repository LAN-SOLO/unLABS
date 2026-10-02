/**
 * Airlock hardware (pure, no three): steam nozzle rails on the chamber's side
 * walls, the extraction grate in the floor, suction ducts along the wall
 * tops, warning lamps. docs/DOORS.md, rules lib/world/doors/airlock.ts.
 *
 * Built at DOOR_SCALE (4 voxels per world unit), meshed centred in x/z with
 * y = 0 at the bottom. `airlockFixtures` places them in world coordinates
 * for an airlock whose doors run along x (walls cross along z) or along z.
 */
import { C } from "@/lib/world/content/palette";
import { Model } from "@/lib/world/models/core";
import type { AirlockDef } from "@/lib/world/doors/airlock";

const VPU = 4;

/** Nozzle rail for one side wall: `len` world units long (along the chamber). */
export function nozzleRailModel(len: number): Model {
  const L = Math.round(len * VPU);
  const m = new Model(2, 18, L);
  // Pipe along the wall, three rows of nozzles, a manifold at the end.
  for (const y of [2, 8, 14]) {
    m.box(0, y, 0, 0, y + 1, L - 1, C.steel);
    for (let z = 2; z < L - 1; z += 3) m.set(1, y, z, C.chrome).set(1, y + 1, z, C.metal_dark);
  }
  m.box(0, 0, 0, 0, 17, 1, C.metal_dark);
  m.box(0, 0, L - 2, 0, 17, L - 1, C.metal_dark);
  m.set(1, 16, 0, C.led_amber).set(1, 16, L - 1, C.led_amber);
  return m;
}

/** Floor grate over the extraction pit (w × d world units). */
export function grateModel(w: number, d: number): Model {
  const W = Math.round(w * VPU);
  const D = Math.round(d * VPU);
  const m = new Model(W, 1, D);
  for (let x = 0; x < W; x++)
    for (let z = 0; z < D; z++) {
      const rim = x === 0 || z === 0 || x === W - 1 || z === D - 1;
      m.set(x, 0, z, rim ? C.safety_yellow : x % 2 && z % 3 ? C.black : C.steel_dark);
    }
  return m;
}

/** Suction duct along a wall top with intake louvres. */
export function ductModel(len: number): Model {
  const L = Math.round(len * VPU);
  const m = new Model(3, 3, L);
  m.box(0, 0, 0, 2, 2, L - 1, C.metal);
  for (let z = 1; z < L - 1; z += 2) m.set(0, 0, z, C.black).set(0, 1, z, C.black);
  return m;
}

/** Warning lamp (amber dome on a bracket). */
export function lampModel(): Model {
  const m = new Model(2, 3, 2);
  m.box(0, 0, 0, 1, 0, 1, C.metal_dark);
  m.box(0, 1, 0, 1, 2, 1, C.led_amber);
  return m;
}

export interface Fixture {
  key: "rail" | "grate" | "duct" | "lamp";
  model: Model;
  /** World position of the model origin (centre x/z, bottom y). */
  at: [number, number, number];
  /** Rotation about y (radians). */
  rotY: number;
}

/**
 * Fixtures of an airlock in world coordinates. `doorAxis` = the doors' wall
 * orientation: the nozzle rails sit on the two other walls.
 */
export function airlockFixtures(a: AirlockDef, doorAxis: "x" | "z"): Fixture[] {
  const c = a.chamber;
  const x0 = c.x0;
  const x1 = c.x1 + 1;
  const z0 = c.z0;
  const z1 = c.z1 + 1;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  // Doors in walls along x → the side walls (rails) run along z.
  const alongZ = doorAxis === "x";
  const len = alongZ ? z1 - z0 : x1 - x0;
  const out: Fixture[] = [];
  const rail = nozzleRailModel(len);
  const duct = ductModel(len);
  for (const s of [-1, 1] as const) {
    if (alongZ) {
      const wx = s < 0 ? x0 + 0.25 : x1 - 0.25;
      out.push({ key: "rail", model: rail, at: [wx, 1.2, cz], rotY: s < 0 ? 0 : Math.PI });
      out.push({ key: "duct", model: duct, at: [wx, 6.6, cz], rotY: 0 });
      out.push({ key: "lamp", model: lampModel(), at: [wx, 6.0, z0 + 0.4], rotY: 0 });
    } else {
      const wz = s < 0 ? z0 + 0.25 : z1 - 0.25;
      out.push({
        key: "rail",
        model: rail,
        at: [cx, 1.2, wz],
        rotY: s < 0 ? -Math.PI / 2 : Math.PI / 2,
      });
      out.push({ key: "duct", model: duct, at: [cx, 6.6, wz], rotY: Math.PI / 2 });
      out.push({ key: "lamp", model: lampModel(), at: [x0 + 0.4, 6.0, wz], rotY: 0 });
    }
  }
  out.push({
    key: "grate",
    model: grateModel(x1 - x0 - 1, z1 - z0 - 1),
    at: [cx, 0.78, cz],
    rotY: 0,
  });
  return out;
}

/** Points (world) where the nozzles blow steam: both rails, three heights. */
export function steamPoints(a: AirlockDef, doorAxis: "x" | "z"): [number, number, number][] {
  const c = a.chamber;
  const pts: [number, number, number][] = [];
  const alongZ = doorAxis === "x";
  for (const s of [-1, 1]) {
    for (const y of [1.8, 3.3, 4.8]) {
      for (let k = 0; k < 2; k++) {
        const t = 0.3 + k * 0.4;
        if (alongZ) pts.push([s < 0 ? c.x0 + 0.6 : c.x1 + 0.4, y, c.z0 + t * (c.z1 + 1 - c.z0)]);
        else pts.push([c.x0 + t * (c.x1 + 1 - c.x0), y, s < 0 ? c.z0 + 0.6 : c.z1 + 0.4]);
      }
    }
  }
  return pts;
}

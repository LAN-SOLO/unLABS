/**
 * Floor voxelization — turns the room table into a VoxelWorld per floor.
 * Pure (no three): tested and reused by the renderer.
 *
 * Architecture rules (keep the walker free):
 * - Room interiors only get voxels at y = 0 (floor patterns) and at
 *   y ≥ WALL_HEIGHT − 1 directly beside a wall (lamps, corbels, cable
 *   trays) — above the walker's head (5.1 tall standing on y = 1).
 * - Everything else (panelling, pillars, windows, keypads, hazard frames)
 *   lives in the wall line itself.
 */
import { C } from "@/lib/world/content/palette";
import { DEVICES } from "@/lib/world/content/devices";
import {
  DOORS,
  ELEVATORS,
  FLOOR_SIZE,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  WALL_HEIGHT,
  floorGeomOf,
} from "@/lib/world/content/map";
import type { FloorGeom, RoomGeom, WallCell } from "@/lib/world/floor-geom";
import { NPCS } from "@/lib/world/content/story";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_SCALE,
  ROOM_TERMINAL_SIZE,
} from "@/lib/world/content/terminals";
import { MODEL_SCALE } from "@/lib/world/models/core";
import { deviceModel, deviceVisual } from "@/lib/world/models/devices";
import { pickupModel, propModel } from "@/lib/world/models/props";
import { fnv1a } from "@/lib/world/traits";
import type { DoorDef, FloorId, RoomDef, RoomTheme } from "@/lib/world/types";
import { VoxelWorld } from "@/lib/voxel/world";
import { CORE } from "@/lib/world/content/floorplan";

export const DOOR_HEIGHT = 6;

/** Elevator keep-out (world units, inclusive voxel range). */
export const ELEVATOR_AREA = {
  x0: CORE.x - 8,
  z0: CORE.z - 10,
  x1: CORE.x + 8,
  z1: CORE.z + 10,
} as const;

export interface Lamp {
  room: string;
  x: number;
  y: number;
  z: number;
}

export interface FloorLayout {
  floor: FloorId;
  world: VoxelWorld;
  lamps: Lamp[];
}

export type ZoneKind = "device" | "prop" | "pickup" | "note" | "npc" | "door" | "elevator";

/** Footprint of something the player interacts with (world units, max exclusive). */
export interface Zone {
  kind: ZoneKind;
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Interaction anchor (the def's x/z). */
  x: number;
  z: number;
  /** Model height in world voxels (0 for flat things). */
  h: number;
}

// ── Interactable zones ───────────────────────────────────────────

function centered(
  kind: ZoneKind,
  id: string,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
): Zone {
  return {
    kind,
    id,
    x,
    z,
    h,
    x0: x + 0.5 - w / 2,
    z0: z + 0.5 - d / 2,
    x1: x + 0.5 + w / 2,
    z1: z + 0.5 + d / 2,
  };
}

/**
 * Footprints of every interactable on a floor: devices (as if fully built,
 * rotated), props, pickups, notes, NPC homes, door openings and the
 * elevator area. Used by the architecture and the decor generator to keep
 * their distance.
 */
export function interactableZones(floor: FloorId): Zone[] {
  const out: Zone[] = [];
  const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
  for (const d of DEVICES) {
    if (roomFloor.get(d.room) !== floor) continue;
    const m = deviceModel(d.id);
    const sc = deviceVisual(d.id).scale ?? MODEL_SCALE;
    const odd = (d.rot ?? 0) % 2 === 1;
    const w = (odd ? m.d : m.w) * sc;
    const dd = (odd ? m.w : m.d) * sc;
    out.push(centered("device", d.id, d.x, d.z, w, dd, m.h * sc));
  }
  for (const p of PROPS) {
    if (p.floor !== floor || p.model === "elevator") continue;
    const m = propModel(p.model);
    const odd = (p.rot ?? 0) % 2 === 1;
    const w = (odd ? m.d : m.w) * MODEL_SCALE;
    const dd = (odd ? m.w : m.d) * MODEL_SCALE;
    out.push(centered("prop", p.id, p.x, p.z, w, dd, m.h * MODEL_SCALE));
  }
  // Wall kiosks (room terminals) behave like props: interactable, solid.
  for (const t of ROOM_TERMINALS) {
    if (t.floor !== floor) continue;
    const odd = (t.rot ?? 0) % 2 === 1;
    const { w: tw, h: th, d: td } = ROOM_TERMINAL_SIZE;
    const w = (odd ? td : tw) * ROOM_TERMINAL_SCALE;
    const dd = (odd ? tw : td) * ROOM_TERMINAL_SCALE;
    out.push(centered("prop", t.id, t.x, t.z, w, dd, th * ROOM_TERMINAL_SCALE));
  }
  for (const p of PICKUPS) {
    if (p.floor !== floor) continue;
    const m = pickupModel(p.model);
    out.push(
      centered("pickup", p.id, p.x, p.z, m.w * MODEL_SCALE, m.d * MODEL_SCALE, m.h * MODEL_SCALE),
    );
  }
  for (const n of NOTES) if (n.floor === floor) out.push(centered("note", n.id, n.x, n.z, 1, 1, 0));
  for (const n of NPCS)
    if (n.floor === floor && n.id !== "mcp") out.push(centered("npc", n.id, n.x, n.z, 2, 2, 5));
  for (const d of DOORS) {
    if (d.floor !== floor) continue;
    const half = Math.floor(d.width / 2);
    out.push(
      d.axis === "x"
        ? {
            kind: "door",
            id: d.id,
            x: d.x,
            z: d.z,
            h: DOOR_HEIGHT,
            x0: d.x - half,
            z0: d.z,
            x1: d.x + half + 1,
            z1: d.z + 1,
          }
        : {
            kind: "door",
            id: d.id,
            x: d.x,
            z: d.z,
            h: DOOR_HEIGHT,
            x0: d.x,
            z0: d.z - half,
            x1: d.x + 1,
            z1: d.z + half + 1,
          },
    );
  }
  for (const e of ELEVATORS)
    if (e.floor === floor)
      out.push({
        kind: "elevator",
        id: `elevator${floor}`,
        x: e.x,
        z: e.z,
        h: WALL_HEIGHT,
        x0: ELEVATOR_AREA.x0,
        z0: ELEVATOR_AREA.z0,
        x1: ELEVATOR_AREA.x1 + 1,
        z1: ELEVATOR_AREA.z1 + 1,
      });
  return out;
}

function nearZone(zones: readonly Zone[], x: number, z: number, margin: number): boolean {
  for (const q of zones)
    if (x + 1 > q.x0 - margin && x < q.x1 + margin && z + 1 > q.z0 - margin && z < q.z1 + margin)
      return true;
  return false;
}

/** True if (x, z) lies within `along` of a door centre along its wall and `into` across it. */
function nearDoor(
  doors: readonly DoorDef[],
  x: number,
  z: number,
  along: number,
  into: number,
): boolean {
  for (const d of doors) {
    const a = d.axis === "x" ? Math.abs(x - d.x) : Math.abs(z - d.z);
    const b = d.axis === "x" ? Math.abs(z - d.z) : Math.abs(x - d.x);
    if (a <= along && b <= into) return true;
  }
  return false;
}

// ── Materials ────────────────────────────────────────────────────

/** Small integer hash (fast, deterministic). */
function ih(x: number, z: number, seed: number): number {
  let h = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

interface WallMats {
  seam: number;
  pillar: number;
  base: number;
}

const WALL_MATS: Record<number, WallMats> = {
  [C.wall]: { seam: C.wall_dark, pillar: C.steel_dark, base: C.wall_dark },
  [C.wall_dark]: { seam: C.floor_dark, pillar: C.metal, base: C.metal_dark },
  [C.wall_beige]: { seam: C.beige, pillar: C.wood_dark, base: C.wood_dark },
  [C.wall_olive]: { seam: C.floor_green, pillar: C.metal, base: C.metal_dark },
  [C.wall_teal]: { seam: C.tile_teal, pillar: C.steel_dark, base: C.metal_dark },
  [C.concrete]: { seam: C.concrete_dark, pillar: C.concrete_light, base: C.asphalt },
};

const INDUSTRIAL: ReadonlySet<RoomTheme> = new Set<RoomTheme>([
  "factory",
  "power",
  "hangar",
  "airlock",
  "botdepot",
  "reactor",
  "containment",
  "geothermal",
  "storage",
]);

const TRAY_THEMES: ReadonlySet<RoomTheme> = new Set<RoomTheme>([
  "server",
  "power",
  "corridor",
  "factory",
  "cooling",
  "geothermal",
  "reactor",
  "botdepot",
  "hangar",
  "audio",
  "forge",
  "lab",
]);

const WINDOW_THEMES: ReadonlySet<RoomTheme> = new Set<RoomTheme>([
  "control",
  "office",
  "lab",
  "workshop",
  "archive",
  "corridor",
  "audio",
  "server",
  "cryo",
  "quarters",
  "greenhouse",
  "observatory",
  "containment",
  "portal",
  "forge",
  "anomaly",
]);

/** Random-walk crack cells for concrete floors (deterministic per room, inside its shape). */
function crackSet(
  r: RoomDef,
  own: (x: number, z: number) => boolean,
  count: number,
  len: number,
): Set<number> {
  const out = new Set<number>();
  const seed = fnv1a(`crack:${r.id}`);
  for (let c = 0; c < count; c++) {
    let x = r.x + 2 + (ih(c, 1, seed) % Math.max(1, r.w - 4));
    let z = r.z + 2 + (ih(c, 2, seed) % Math.max(1, r.d - 4));
    if (!own(x, z)) continue;
    let dir = ih(c, 3, seed) % 4;
    for (let i = 0; i < len; i++) {
      out.add(x + z * FLOOR_SIZE.x);
      const turn = ih(c * 97 + i, 4, seed) % 5;
      if (turn === 0) dir = (dir + 1) % 4;
      else if (turn === 1) dir = (dir + 3) % 4;
      x += [1, 0, -1, 0][dir]!;
      z += [0, 1, 0, -1][dir]!;
      if (!own(x, z)) break;
    }
  }
  return out;
}

/**
 * Floor colour of a cell (lx, lz relative to the room's bounding box);
 * `edge` = distance to the room's own wall (0 = the wall line itself).
 */
function floorColorAt(r: RoomDef, x: number, z: number, cracks: Set<number>, edge: number): number {
  const theme = r.theme ?? "generic";
  const lx = x - r.x;
  const lz = z - r.z;
  const base = r.floorColor;
  const seed = fnv1a(r.id);
  const h = ih(x, z, seed);
  const cx = r.x + r.w / 2;
  const cz = r.z + r.d / 2;
  const dist = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
  const grid4 = lx % 4 === 0 || lz % 4 === 0;
  const cracked = cracks.has(x + z * FLOOR_SIZE.x);

  if (edge === 0) return base === C.floor_grate ? C.metal_dark : C.floor_dark;
  if (isShaft(r)) return shaftFloorAt(r, lx, lz, h, cracked);
  if (INDUSTRIAL.has(theme) && edge === 1)
    return ((x + z) & 1) === 0 ? C.wall_trim : C.hazard_black;

  switch (theme) {
    case "office":
    case "quarters": {
      if (base === C.tile_white) {
        // Kitchen / canteen: white tiles with grout lines and a checked border.
        if (edge <= 2) return ((lx + lz) & 1) === 0 ? C.tile_black : C.tile_white;
        if (lx % 3 === 0 || lz % 3 === 0) return C.tile_cream;
        return h % 29 === 0 ? C.coffee : C.tile_white;
      }
      if (edge >= 4) {
        if (edge === 4) return C.fabric_mustard;
        const carpet =
          theme === "quarters"
            ? base === C.carpet_blue || base === C.carpet_red
              ? base
              : C.carpet_green
            : base === C.floor_beige
              ? C.carpet_red
              : C.carpet_blue;
        return (lx + lz) % 6 === 0 && edge > 5 ? C.fabric_red : carpet;
      }
      const plank = Math.floor((lx + (lz % 2) * 2) / 4);
      return [C.oak, C.wood, C.wood_light][(plank + lz) % 3]!;
    }
    case "control": {
      if (Math.abs(dist - 7) < 0.6) return C.metal_light;
      if (Math.abs(dist - 7) < 1.2) return C.floor_dark;
      if (grid4) return C.floor_dark;
      return ((lx >> 1) + (lz >> 1)) % 2 === 0 ? base : C.wall_dark;
    }
    case "lab": {
      if (lx % 3 === 0 || lz % 3 === 0) return C.concrete_light;
      if (edge === 3) return C.safety_blue;
      return h % 13 === 0 ? C.tile_cream : C.tile_white;
    }
    case "cryo":
    case "cooling": {
      const frostBand = edge <= 4 + (h % 3);
      if (frostBand && h % 3 !== 0) return h % 5 === 0 ? C.coat_shadow : C.white;
      if (lx % 3 === 0 || lz % 3 === 0) return theme === "cryo" ? C.tile_black : C.floor_dark;
      return theme === "cryo" ? C.tile_teal : base;
    }
    case "containment": {
      if (Math.abs(dist - Math.min(r.w, r.d) * 0.28) < 0.7)
        return ((x + z) & 1) === 0 ? C.safety_yellow : C.hazard_black;
      if (grid4) return C.tile_black;
      return base;
    }
    case "server":
    case "power": {
      const channel = lz % 8 === 4 && edge > 2;
      if (channel) {
        if (lx % 6 === 3) return theme === "server" ? C.led_green : C.led_amber;
        return theme === "server" ? C.cable_black : lx % 2 ? C.cable_red : C.cable_yellow;
      }
      if (lz % 8 === 3 || lz % 8 === 5) return C.black; // channel lips (open sub-floor)
      if (grid4) return C.metal_dark;
      const tile = ih(lx >> 2, lz >> 2, seed);
      if (tile % 5 === 0) return ((x + z) & 1) === 0 ? C.metal_dark : C.black; // perforated
      return base === C.floor_grate ? C.floor_grate : base;
    }
    case "geothermal":
    case "reactor":
    case "hangar": {
      if (cracked) return h % 4 === 0 ? C.black : C.asphalt;
      if (theme === "hangar") {
        if (Math.abs(lx - Math.floor(r.w / 2)) <= 0 && lz % 4 < 2) return C.safety_yellow;
        if ((lx % 16 === 4 || lx % 16 === 12) && lz % 2 === 0 && edge > 3) return C.paint_white;
      }
      if (theme === "geothermal" && h % 17 === 0) return C.rust;
      if (theme === "reactor" && Math.abs(dist - 9) < 0.6) return C.safety_yellow;
      const n = h % 7;
      return n === 0 ? C.concrete : n === 1 ? C.concrete_light : base;
    }
    case "forge":
    case "portal":
    case "anomaly": {
      const glow = theme === "forge" ? C.cerulean : theme === "portal" ? C.exotic : C.abstractum;
      if (theme === "anomaly") {
        if (cracked) return h % 3 === 0 ? glow : C.purple_paint;
        return grid4 ? C.tile_black : base;
      }
      const ring = Math.abs((dist % 7) - 3.5) > 3.1 && dist > 5;
      if (ring) return (Math.floor(Math.atan2(z - cz, x - cx) * 6) & 3) === 0 ? C.metal_dark : glow;
      const axis = (Math.abs(x + 0.5 - cx) < 0.6 || Math.abs(z + 0.5 - cz) < 0.6) && dist > 4;
      if (axis) return Math.floor(dist) % 3 === 0 ? glow : C.metal_dark;
      return grid4 ? C.tile_black : base;
    }
    case "workshop": {
      if (edge === 5 && (lx + lz) % 3 !== 0) return C.safety_yellow;
      if (h % 41 === 0) return C.asphalt;
      return grid4 ? C.floor_dark : base;
    }
    case "archive": {
      // Basket-weave parquet with a walnut border and a runner down the middle.
      if (edge <= 2) return C.walnut;
      const long = r.w >= r.d;
      const across = long ? lz - Math.floor(r.d / 2) : lx - Math.floor(r.w / 2);
      if (Math.abs(across) <= 2 && edge > 4)
        return Math.abs(across) === 2 ? C.fabric_mustard : C.carpet_blue;
      const block = ((lx >> 1) + (lz >> 1)) % 2;
      const plank = block ? lx % 2 : lz % 2;
      return block ? (plank ? C.oak : C.wood) : plank ? C.wood_light : C.oak;
    }
    case "airlock": {
      const mid = Math.floor(r.d / 2);
      if (Math.abs(lz - mid) <= 1) return ((lx + lz) >> 1) % 2 === 0 ? C.wall_trim : C.hazard_black;
      return grid4 ? C.metal_dark : base;
    }
    case "corridor": {
      if (r.shape?.some((p) => p.kind !== "rect")) {
        // Bent / curved passage: guide lines follow the walls (distance field), studs every 5.
        const carpet = base === C.carpet_red || base === C.carpet_blue || base === C.carpet_green;
        if (edge === 2)
          return carpet ? C.fabric_mustard : (x + z) % 5 === 0 ? C.led_green : C.safety_yellow;
        if (edge === 1) return carpet ? C.walnut : C.floor_tile;
        return carpet ? base : grid4 ? C.floor_dark : base;
      }
      const long = r.w >= r.d;
      const across = long ? lz - Math.floor(r.d / 2) : lx - Math.floor(r.w / 2);
      const along = long ? lx : lz;
      const a = Math.abs(across);
      // Chevrons every 10 on the centre line, pointing toward the elevator.
      const k = along % 10;
      const chevron =
        a <= 2 && (towardElevator(r) > 0 ? k === 5 - a || k === 6 - a : k === 3 + a || k === 4 + a);
      if (base === C.carpet_red || base === C.carpet_blue || base === C.carpet_green) {
        // Residential corridor: runner with a mustard border, woven arrows.
        if (a === 4) return C.fabric_mustard;
        if (a < 4) return chevron ? C.fabric_mustard : base;
        return grid4 ? C.walnut : C.wood_dark;
      }
      // Guide lines with emergency studs, white chevrons.
      if (a === 4) return along % 10 === 0 ? C.led_green : C.safety_yellow;
      if (chevron) return C.paint_white;
      if (a === 6) return C.floor_tile;
      return grid4 ? C.floor_dark : base;
    }
    case "factory": {
      const lane = lx % 16 === 8 || lz % 16 === 8;
      if (lane) return C.safety_yellow;
      if (lx % 16 === 7 || lx % 16 === 9 || lz % 16 === 7 || lz % 16 === 9) return C.hazard_black;
      if (h % 37 === 0) return C.asphalt;
      return grid4 ? C.metal_dark : base;
    }
    case "storage": {
      if (lx % 8 === 0 || lz % 10 === 0) return C.paint_white;
      return h % 9 === 0 ? C.concrete_light : base;
    }
    case "audio":
      return ((lx >> 1) + (lz >> 1)) % 2 === 0 ? base : C.paint_black;
    case "vault": {
      if ((lx + lz) % 8 === 0 || (lx - lz + 800) % 8 === 0) return C.gold;
      return ((lx >> 2) + (lz >> 2)) % 2 === 0 ? base : C.tile_black;
    }
    case "botdepot": {
      if ((lx % 8 === 1 || lx % 8 === 6 || lz % 8 === 1 || lz % 8 === 6) && edge > 2)
        return C.safety_yellow;
      if (h % 29 === 0) return C.asphalt;
      return base;
    }
    case "greenhouse": {
      // Tiled walkways between planting beds; wet glass tiles at the crossings.
      const px = lx % 6 === 0;
      const pz = lz % 6 === 0;
      if (px && pz) return C.glass_green;
      if (px || pz) return C.tile_teal;
      if (h % 9 === 0) return C.leaf_dark;
      if (h % 13 === 0) return C.plant_green;
      return h % 5 === 0 ? C.pot : C.soil;
    }
    case "observatory": {
      // Dome floor: concentric rings, eight spokes, a brass centre, star specks.
      if (dist < 1.6) return C.brass;
      const ring = dist % 6;
      if (ring < 0.7) return C.metal_light;
      const a = Math.atan2(z + 0.5 - cz, x + 0.5 - cx);
      const seg = Math.PI / 4;
      const off = Math.abs(a - Math.round(a / seg) * seg) * dist; // voxels from the spoke line
      if (off < 0.5 && dist > 2) return C.metal_dark;
      return h % 43 === 0 ? C.led_white : h % 61 === 0 ? C.halo_glow : C.tile_black;
    }
    case "elevator":
      return grid4 ? C.metal_dark : base;
    default: {
      const alt =
        base === C.floor_grate ? C.metal_dark : base === C.floor_tile ? C.floor_dark : C.floor_tile;
      return ((x >> 2) + (z >> 2)) % 2 === 0 ? base : alt;
    }
  }
}

/** Rooms of the sealed shaft (Ebene −4) that are raw rock, not lab. */
function isShaft(r: RoomDef): boolean {
  return r.floor === 5 && (r.theme === "storage" || r.theme === "corridor");
}

/** Timber support spacing along shaft walls. */
const SHAFT_PILLAR = 6;

/** Gravel floor; mine rails with sleepers along the long axis of shaft corridors. */
function shaftFloorAt(r: RoomDef, lx: number, lz: number, h: number, cracked: boolean): number {
  if (r.theme === "corridor") {
    const long = r.w >= r.d;
    const across = long ? lz - Math.floor(r.d / 2) : lx - Math.floor(r.w / 2);
    const along = long ? lx : lz;
    if (Math.abs(across) === 2) return h % 11 === 0 ? C.rust : C.steel; // rails
    if (Math.abs(across) <= 3 && along % 3 === 0) return C.wood_dark; // sleepers
  }
  if (cracked) return h % 3 === 0 ? C.black : C.asphalt;
  const n = h % 23;
  if (n === 0) return C.rust;
  if (n < 3) return C.concrete_light;
  if (n < 9) return C.asphalt;
  return (h >> 5) % 3 === 0 ? C.concrete : C.concrete_dark;
}

/** Rough rock wall with timber posts every SHAFT_PILLAR and a header beam. */
function shaftWall(world: VoxelWorld, x: number, z: number, p: number): void {
  const post = p % SHAFT_PILLAR === 0;
  for (let y = 1; y <= WALL_HEIGHT; y++) {
    let c: number;
    if (y === WALL_HEIGHT) c = post ? C.wood_dark : C.wood;
    else if (post) c = y === WALL_HEIGHT - 1 ? C.wood : C.wood_dark;
    else {
      const k = ih(x * 3 + y, z * 5 - y, 977);
      c = k % 7 === 0 ? C.concrete_light : k % 3 === 0 ? C.concrete : C.concrete_dark;
      if (k % 53 === 0) c = C.crystal_violet;
      else if (k % 41 === 0) c = C.rust;
    }
    world.set(x, y, z, c);
  }
}

// ── Architecture detail ──────────────────────────────────────────
//
// Everything below only recolours voxels of the wall line / the slab, or
// adds voxels ON TOP of walls (y = WALL_HEIGHT + 1) and above head height
// beside walls (y = WALL_HEIGHT − 1): collision, door openings and the
// walker's room interiors stay exactly as before. The wall cutaway removes
// every voxel above its cut, so these additions are trimmed with the walls.

const RESIDENTIAL: ReadonlySet<RoomTheme> = new Set<RoomTheme>(["office", "quarters", "archive"]);

/** Tiled lab walls: tile + grout colour. */
const TILES: Partial<Record<RoomTheme, readonly [number, number]>> = {
  lab: [C.tile_white, C.coat_shadow],
  cryo: [C.tile_teal, C.tile_black],
  cooling: [C.coat_shadow, C.steel_dark],
  containment: [C.tile_black, C.steel_dark],
};

/** Pipe runs (in the wall at y 6, on top of the wall and at head height). */
const PIPES: Partial<Record<RoomTheme, number>> = {
  power: C.copper,
  geothermal: C.copper,
  reactor: C.copper,
  factory: C.steel,
  hangar: C.steel,
  botdepot: C.steel,
  storage: C.steel_dark,
  cooling: C.aluminium,
};

/** Signage stripe (y 4) per theme. */
const SIGNAGE: Partial<Record<RoomTheme, number>> = {
  power: C.safety_orange,
  reactor: C.safety_yellow,
  geothermal: C.safety_orange,
  factory: C.safety_yellow,
  hangar: C.safety_yellow,
  botdepot: C.safety_green,
  airlock: C.safety_red,
  workshop: C.safety_orange,
  corridor: C.safety_green,
  storage: C.safety_blue,
  lab: C.safety_blue,
  cryo: C.paint_sky,
};

/** Hazard-striped baseboards. */
const HAZARD_BASE: ReadonlySet<RoomTheme> = new Set<RoomTheme>([
  "factory",
  "hangar",
  "botdepot",
  "airlock",
  "workshop",
]);

/** Conduit runs (y 6) with junction boxes and status LEDs (y 7). */
const CONDUIT: Partial<Record<RoomTheme, number>> = {
  server: C.led_green,
  control: C.led_amber,
  corridor: 0,
  audio: 0,
  vault: 0,
  observatory: 0,
  elevator: 0,
};

const GLOW: Partial<Record<RoomTheme, number>> = {
  forge: C.cerulean,
  portal: C.exotic,
  anomaly: C.abstractum,
};

/** Themes that get hazard rings on the floor around their machines. */
const MACHINE_RINGS: ReadonlySet<RoomTheme> = new Set<RoomTheme>([
  ...INDUSTRIAL,
  "lab",
  "server",
  "forge",
  "portal",
  "cooling",
  "workshop",
]);

/** Themes with floor drains. */
const DRAINS: ReadonlySet<RoomTheme> = new Set<RoomTheme>([
  "cooling",
  "geothermal",
  "reactor",
  "factory",
  "greenhouse",
  "botdepot",
  "hangar",
  "cryo",
  "lab",
  "containment",
  "workshop",
]);

/** Deep floors (Ebene −3, −4): rough walls, puddles, veins. */
export function isDeepFloor(floor: FloorId): boolean {
  return floor === 3 || floor === 5;
}

/**
 * Themed colour of a panelled wall voxel. `p` is the position along the
 * wall, `c` the plain panel colour (baseboard, seams, pillars, trim).
 */
function wallDetail(r: RoomDef, p: number, y: number, pillar: boolean, c: number): number {
  const theme = r.theme ?? "generic";
  if (theme === "greenhouse") return c;
  const top = y === WALL_HEIGHT;
  if (RESIDENTIAL.has(theme)) {
    // Wainscoting: walnut baseboard, oak panels with stiles, a chair rail; walnut cornice.
    if (top) return C.walnut;
    if (pillar) return y === WALL_HEIGHT - 1 ? C.oak : C.wood_dark;
    if (y === 1) return C.walnut;
    if (y === 2 || y === 3) return p % 4 === 2 ? C.wood_dark : theme === "archive" ? C.wood : C.oak;
    if (y === 4) return C.walnut;
    return c;
  }
  if (top) {
    if (theme === "vault") return C.gold;
    if (theme === "observatory") return C.brass;
    if (GLOW[theme] !== undefined) return p % 8 === 4 ? GLOW[theme]! : C.metal_dark;
    if (TILES[theme]) return C.metal_light;
    return c;
  }
  if (pillar) return theme === "vault" ? C.brass : c;
  const tiles = TILES[theme];
  const sign = SIGNAGE[theme];
  const pipe = PIPES[theme];
  const glow = GLOW[theme];
  const conduit = CONDUIT[theme];
  // Vents: 2 × 2 grille low on the wall every 16.
  const vent = !tiles && theme !== "vault" && (p % 16 === 10 || p % 16 === 11);
  if (y === 1) {
    if (HAZARD_BASE.has(theme)) return (p >> 1) % 2 === 0 ? C.safety_yellow : C.hazard_black;
    if (glow !== undefined) return C.metal_dark;
    return c;
  }
  if (vent && (y === 2 || y === 3)) return y === 2 ? C.black : C.metal_dark;
  if (y === 6 && pipe !== undefined) {
    if (p % 24 === 15) return C.safety_red; // valve
    return p % 6 === 3 ? C.metal_dark : pipe; // flanges
  }
  if (y === 6 && conduit !== undefined)
    return p % 12 === 6 ? C.metal_light : p % 12 === 7 ? C.metal_dark : C.steel_dark;
  if (y === 7 && conduit && p % 4 === 2) return conduit;
  if (y === 6 && glow !== undefined) return p % 4 < 2 ? glow : C.metal_dark;
  if (y === 4 && sign !== undefined) return sign;
  if (y === 4 && theme === "vault") return C.gold;
  if (tiles && y >= 2 && y <= 6) return p % 4 === 0 || y === 5 ? tiles[1] : tiles[0];
  if (theme === "audio" && y >= 2 && y <= 5) return p % 3 === 0 ? C.fabric_gray : C.paint_black;
  return c;
}

/**
 * Wall cells of a room grouped by the side they face (0 N, 1 S, 2 W, 3 E),
 * each group ordered along the wall. Curved walls land in the side their
 * normal leans to.
 */
function roomSides(rg: RoomGeom): { x: number; z: number }[][] {
  const out: WallCell[][] = [[], [], [], []];
  for (const w of rg.walls) {
    const side = Math.abs(w.nz) >= Math.abs(w.nx) ? (w.nz > 0 ? 0 : 1) : w.nx > 0 ? 2 : 3;
    out[side]!.push(w);
  }
  out[0]!.sort((a, b) => a.x - b.x);
  out[1]!.sort((a, b) => a.x - b.x);
  out[2]!.sort((a, b) => a.z - b.z);
  out[3]!.sort((a, b) => a.z - b.z);
  return out;
}

/** Door cells, frames and keypads plus a margin: architecture detail stays clear. */
function doorKeepOut(doors: readonly DoorDef[], x: number, z: number): boolean {
  for (const d of doors) {
    const half = Math.floor(d.width / 2);
    const reach = d.secret ? 7 : half + 3;
    const a = d.axis === "x" ? Math.abs(x - d.x) : Math.abs(z - d.z);
    const b = d.axis === "x" ? Math.abs(z - d.z) : Math.abs(x - d.x);
    if (a <= reach && b <= 1) return true;
  }
  return false;
}

/**
 * Deep floors: rock intrusions (Ebene −4) / exposed brick behind fallen
 * plaster (Ebene −3), glowing crystal veins and roots hanging from above.
 */
function deepWalls(
  world: VoxelWorld,
  rg: RoomGeom,
  doors: readonly DoorDef[],
  shaft: boolean,
): void {
  const r = rg.room;
  const seed = fnv1a(`deep:${r.id}`);
  const sides = roomSides(rg);
  const perim = rg.walls.length;
  const paint = (side: number, i: number, y: number, c: number): boolean => {
    const cells = sides[side]!;
    if (i < 1 || i >= cells.length - 1 || y < 1 || y > WALL_HEIGHT) return false;
    const { x, z } = cells[i]!;
    if (doorKeepOut(doors, x, z) || !world.get(x, y, z)) return false;
    world.set(x, y, z, c);
    return true;
  };
  if (!shaft) {
    const blobs = Math.ceil(perim / 26);
    for (let b = 0; b < blobs; b++) {
      const side = ih(b, 1, seed) % 4;
      const len = sides[side]!.length;
      if (len < 8) continue;
      const t = 3 + (ih(b, 2, seed) % (len - 6));
      const cy = 2 + (ih(b, 3, seed) % 6);
      const rad = 1.6 + (ih(b, 4, seed) % 16) / 10;
      const brick = r.floor === 3 && ih(b, 5, seed) % 3 !== 0;
      for (let i = t - 5; i <= t + 5; i++)
        for (let y = 1; y <= WALL_HEIGHT; y++) {
          const jitter = (ih(i * 7 + y, b, seed) % 10) / 12;
          const d = Math.hypot(i - t, (y - cy) * 1.3);
          if (d > rad + jitter - 0.3) continue;
          const k = ih(i * 3 + y, b * 5 - y, seed);
          const c = brick
            ? (i + (y & 1) * 2) % 4 === 0
              ? C.mortar
              : y & 1
                ? C.brick
                : C.paint_brick
            : k % 5 === 0
              ? C.concrete_light
              : k % 2 === 0
                ? C.rock
                : C.rock_dark;
          // Rock bulges over the wall top.
          if (paint(side, i, y, c) && !brick && y === WALL_HEIGHT && d < rad - 0.4) {
            const { x, z } = sides[side]![i]!;
            world.set(x, WALL_HEIGHT + 1, z, k % 3 === 0 ? C.rock : C.rock_dark);
          }
        }
    }
  }
  // Crystal veins: diagonal random walks of glowing voxels.
  const glow = r.floor === 5 ? C.abstractum : C.vein_cyan;
  const veins = Math.ceil(perim / (shaft ? 30 : 44));
  for (let v = 0; v < veins; v++) {
    const side = ih(v, 11, seed) % 4;
    const len = sides[side]!.length;
    let i = 2 + (ih(v, 12, seed) % Math.max(1, len - 4));
    let y = 2 + (ih(v, 13, seed) % 5);
    const dir = ih(v, 14, seed) % 2 === 0 ? 1 : -1;
    const steps = 5 + (ih(v, 15, seed) % 7);
    for (let s = 0; s < steps; s++) {
      paint(side, i, y, glow);
      const k = ih(v * 31 + s, 16, seed) % 4;
      i += k === 0 ? 0 : dir;
      y = Math.max(1, Math.min(WALL_HEIGHT - 1, y + (k === 1 ? 1 : k === 2 ? -1 : 0)));
    }
  }
  // Roots (Ebene −4): hang from the top of the wall, stub above it.
  if (r.floor !== 5) return;
  const roots = Math.ceil(perim / 34);
  for (let q = 0; q < roots; q++) {
    const side = ih(q, 21, seed) % 4;
    const len = sides[side]!.length;
    let i = 2 + (ih(q, 22, seed) % Math.max(1, len - 4));
    const depth = 2 + (ih(q, 23, seed) % 4);
    const cell = sides[side]![i];
    if (cell && paint(side, i, WALL_HEIGHT, C.root))
      world.set(cell.x, WALL_HEIGHT + 1, cell.z, C.root);
    for (let y = WALL_HEIGHT - 1; y >= WALL_HEIGHT - depth; y--) {
      paint(side, i, y, C.root);
      const k = ih(q * 17 + y, 24, seed) % 5;
      if (k === 0) i++;
      else if (k === 1) i--;
    }
  }
}

/** Room number plates beside every (non-secret) door, on the side without the keypad. */
function doorPlates(world: VoxelWorld, doors: readonly DoorDef[]): void {
  for (const d of doors) {
    if (d.secret) continue;
    const half = Math.floor(d.width / 2);
    const o = -(half + 2);
    const x = d.axis === "x" ? d.x + o : d.x;
    const z = d.axis === "x" ? d.z : d.z + o;
    if (!world.get(x, 5, z) || !world.get(x, 6, z)) continue;
    world.set(x, 6, z, C.paint_white);
    world.set(x, 5, z, C.blue_paint);
  }
}

/** Direction (+1 / −1) along a corridor's long axis toward the floor's elevator. */
function towardElevator(r: RoomDef): number {
  const e = ELEVATORS.find((q) => q.floor === r.floor) ?? { x: CORE.x, z: CORE.z };
  const long = r.w >= r.d;
  const d = long ? e.x - (r.x + r.w / 2) : e.z - (r.z + r.d / 2);
  return d < 0 ? -1 : 1;
}

/** Interior cell of a room (its own shape, not the wall line). */
function inside(g: FloorGeom, rg: RoomGeom, x: number, z: number, margin = 1): boolean {
  if (x < 0 || z < 0 || x >= g.W || z >= g.Z) return false;
  const i = x + z * g.W;
  return g.owner[i] === rg.index + 1 && g.edge[i]! >= margin;
}

function inElevatorArea(x: number, z: number): boolean {
  return (
    x >= ELEVATOR_AREA.x0 - 1 &&
    x <= ELEVATOR_AREA.x1 + 1 &&
    z >= ELEVATOR_AREA.z0 - 1 &&
    z <= ELEVATOR_AREA.z1 + 1
  );
}

/**
 * Slab details: hazard rings around machines, drain grates, stains,
 * puddles (deep floors) and emergency lights beside corridor doors.
 */
function floorDetail(
  world: VoxelWorld,
  g: FloorGeom,
  rg: RoomGeom,
  doors: readonly DoorDef[],
  zones: readonly Zone[],
): void {
  const r = rg.room;
  const theme = r.theme ?? "generic";
  if (theme === "elevator" || theme === "hub" || isShaft(r)) return;
  const seed = fnv1a(`slab:${r.id}`);
  const inRoom = (q: Zone) => inside(g, rg, Math.floor(q.x), Math.floor(q.z), 1);
  const own = zones.filter(inRoom);
  const setSlab = (x: number, z: number, c: number) => {
    if (inside(g, rg, x, z) && !inElevatorArea(x, z)) world.set(x, 0, z, c);
  };

  // Hazard rings (diagonal stripes) one voxel around every machine footprint.
  if (MACHINE_RINGS.has(theme))
    for (const q of own) {
      if (q.kind !== "device") continue;
      const x0 = Math.floor(q.x0) - 1;
      const z0 = Math.floor(q.z0) - 1;
      const x1 = Math.ceil(q.x1);
      const z1 = Math.ceil(q.z1);
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
          setSlab(x, z, ((x + z) >> 1) % 2 === 0 ? C.safety_yellow : C.hazard_black);
        }
    }

  // Blob painter for grates, stains and puddles (kept off interactables and doors).
  const blobs = (
    tag: number,
    count: number,
    rMin: number,
    rMax: number,
    color: (d: number, rad: number, x: number, z: number) => number | null,
  ) => {
    for (let b = 0; b < count; b++) {
      const cx = r.x + 3 + (ih(b, tag, seed) % Math.max(1, r.w - 6));
      const cz = r.z + 3 + (ih(b, tag + 1, seed) % Math.max(1, r.d - 6));
      const rad = rMin + ((ih(b, tag + 2, seed) % 100) / 100) * (rMax - rMin);
      if (nearZone(zones, cx, cz, rad + 1) || nearDoor(doors, cx, cz, 5, rad + 3)) continue;
      const R = Math.ceil(rad);
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          const x = cx + dx;
          const z = cz + dz;
          const jitter = (ih(x, z, seed + tag) % 10) / 14;
          const d = Math.hypot(dx, dz);
          if (d > rad + jitter - 0.35) continue;
          const c = color(d, rad, x, z);
          if (c !== null) setSlab(x, z, c);
        }
    }
  };
  const area = rg.area;

  // Drain grates: 3 × 3, dark slots in a steel frame.
  if (DRAINS.has(theme)) {
    const n = Math.max(1, Math.round(area / 420));
    for (let b = 0; b < n; b++) {
      const cx = r.x + 3 + (ih(b, 31, seed) % Math.max(1, r.w - 6));
      const cz = r.z + 3 + (ih(b, 32, seed) % Math.max(1, r.d - 6));
      if (nearZone(zones, cx, cz, 2) || nearDoor(doors, cx, cz, 5, 4)) continue;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++)
          setSlab(cx + dx, cz + dz, dz === 0 && dx !== 0 ? C.black : C.metal_dark);
    }
  }

  // Stains on raw concrete / industrial floors.
  const concrete =
    r.floorColor === C.concrete_dark ||
    r.floorColor === C.asphalt ||
    theme === "factory" ||
    theme === "botdepot" ||
    theme === "storage" ||
    theme === "workshop";
  if (concrete)
    blobs(41, Math.max(1, Math.round(area / 320)), 1, 2.4, (d, rad, x, z) =>
      d > rad - 0.8
        ? null
        : theme === "geothermal" || theme === "reactor"
          ? ih(x, z, seed) % 3 === 0
            ? C.rust
            : C.grime
          : ih(x, z, seed) % 4 === 0
            ? C.dust
            : C.grime,
    );

  // Puddles on the deep floors: dark water core (glass) with a wet rim.
  if (isDeepFloor(r.floor) && theme !== "vault" && theme !== "portal" && theme !== "server")
    blobs(51, Math.max(1, Math.round(area / 380)), 1.4, 2.6, (d, rad) =>
      d < rad - 1 ? C.puddle : C.grime,
    );

  // Emergency floor lights beside corridor / airlock doors.
  if (theme === "corridor" || theme === "airlock")
    for (const d of doors) {
      if (d.secret) continue;
      const half = Math.floor(d.width / 2);
      for (const side of [-1, 1] as const) {
        const o = side * (half + 2);
        for (const into of [-1, 1] as const) {
          const x = d.axis === "x" ? d.x + o : d.x + into;
          const z = d.axis === "x" ? d.z + into : d.z + o;
          if (inside(g, rg, x, z)) setSlab(x, z, C.led_green);
        }
      }
    }
}

/**
 * Relief on top of the walls (y = WALL_HEIGHT + 1): pipe runs with flanges
 * over industrial rooms, cable bundles over server rooms, pillar caps elsewhere.
 */
function wallTops(world: VoxelWorld, rg: RoomGeom, doors: readonly DoorDef[]): void {
  const r = rg.room;
  const theme = r.theme ?? "generic";
  if (theme === "elevator" || theme === "greenhouse" || isShaft(r) || RESIDENTIAL.has(theme))
    return;
  const y = WALL_HEIGHT + 1;
  const pipe = PIPES[theme];
  for (const { x, z, p } of rg.walls) {
    if (doorKeepOut(doors, x, z) || inElevatorArea(x, z)) continue;
    if (!world.get(x, WALL_HEIGHT, z) || world.get(x, y, z)) continue;
    if (pipe !== undefined) world.set(x, y, z, p % 12 === 6 ? C.metal_dark : pipe);
    else if (theme === "server" && p % 8 !== 0)
      world.set(x, y, z, p % 5 === 0 ? C.cable_red : C.cable_black);
    else if (p % 8 === 0) world.set(x, y, z, C.metal_light);
  }
}

/**
 * Head-height pipe runs (y = WALL_HEIGHT − 1) along the north- and
 * west-facing walls of industrial rooms (the others carry the cable trays).
 */
function headPipes(
  world: VoxelWorld,
  rg: RoomGeom,
  ok: (x: number, z: number) => boolean,
  lampCells: ReadonlySet<string>,
): void {
  const r = rg.room;
  const pipe = PIPES[r.theme ?? "generic"];
  if (pipe === undefined || isShaft(r)) return;
  const y = WALL_HEIGHT - 1;
  const lampNear = (x: number, z: number) =>
    lampCells.has(`${x},${z}`) ||
    lampCells.has(`${x - 1},${z}`) ||
    lampCells.has(`${x + 1},${z}`) ||
    lampCells.has(`${x},${z - 1}`) ||
    lampCells.has(`${x},${z + 1}`);
  for (const w of rg.walls) {
    if (!((w.nz === 1 && w.nx === 0) || (w.nx === 1 && w.nz === 0))) continue;
    const x = w.x + w.nx;
    const z = w.z + w.nz;
    if (!ok(x, z) || lampNear(x, z) || world.get(x, y, z)) continue;
    world.set(x, y, z, w.p % 24 === 15 ? C.safety_red : w.p % 6 === 3 ? C.metal_dark : pipe);
  }
}

// ── Build ────────────────────────────────────────────────────────

export function buildFloor(floor: FloorId): FloorLayout {
  const world = new VoxelWorld(FLOOR_SIZE.x, FLOOR_SIZE.y, FLOOR_SIZE.z);
  const g = floorGeomOf(floor);
  const doors = DOORS.filter((d) => d.floor === floor);
  const zones = interactableZones(floor).filter((q) => q.kind !== "door" && q.kind !== "elevator");
  const tall = zones.filter((q) => q.h > WALL_HEIGHT - 2);
  const secret = doors.filter((d) => d.secret);
  const lamps: Lamp[] = [];
  const W = g.W;

  // Floors first (interiors and their wall lines), each room in its own pattern.
  for (const rg of g.rooms) {
    const r = rg.room;
    const theme = r.theme ?? "generic";
    const own = (x: number, z: number) => inside(g, rg, x, z, 1);
    const cracks =
      theme === "geothermal" || theme === "reactor" || theme === "hangar" || isShaft(r)
        ? crackSet(r, own, Math.ceil(rg.area / 220), 26)
        : theme === "anomaly"
          ? crackSet(r, own, Math.ceil(rg.area / 160), 30)
          : new Set<number>();
    for (const i of rg.cells) {
      const x = i % W;
      const z = (i - x) / W;
      world.set(x, 0, z, floorColorAt(r, x, z, cracks, g.edge[i]!));
    }
    for (const w of rg.walls) world.set(w.x, 0, w.z, floorColorAt(r, w.x, w.z, cracks, 0));
  }

  // Walls with panelling: baseboard, seams, pillars every 8, amber top trim
  // (the shaft gets rough rock with timber supports instead).
  const shaftRooms = new Set(g.rooms.filter((rg) => isShaft(rg.room)).map((rg) => rg.room.id));
  for (const rg of g.rooms) {
    const r = rg.room;
    const mats = WALL_MATS[r.wallColor] ?? {
      seam: C.wall_dark,
      pillar: C.metal,
      base: C.metal_dark,
    };
    for (const { x, z, p } of rg.walls) {
      if (shaftRooms.has(r.id)) {
        shaftWall(world, x, z, p);
        continue;
      }
      const pillar = p % 8 === 0;
      const glassy = r.theme === "greenhouse" && !pillar && !nearDoor(doors, x, z, 4, 1);
      // Plain panelling beside secret doors: their wall cover mirrors it.
      const plain = nearDoor(secret, x, z, 6, 1);
      for (let y = 1; y <= WALL_HEIGHT; y++) {
        let c = r.wallColor;
        if (y === WALL_HEIGHT) c = C.wall_trim;
        else if (pillar) c = y === WALL_HEIGHT - 1 ? C.metal_light : mats.pillar;
        else if (y === 1) c = mats.base;
        else if (glassy && y >= 3 && y <= 6) c = y === 3 || p % 4 === 0 ? C.steel : C.glass_green;
        else if (p % 8 === 4 || y === 5) c = mats.seam;
        if (!plain && !glassy) c = wallDetail(r, p, y, pillar, c);
        world.set(x, y, z, c);
      }
    }
  }

  // Poché: the solid body of the lab between the rooms (rock on the deep floors).
  pocheMass(world, g, floor);

  // Deep floors: rock / brick intrusions, crystal veins, roots.
  if (isDeepFloor(floor))
    for (const rg of g.rooms) deepWalls(world, rg, doors, shaftRooms.has(rg.room.id));

  // Windows in walls shared by two "clean" rooms (y 3–5, glass class).
  carveWindows(world, g, doors);

  // Wall lamps every ~10 voxels on north- and west-facing walls (inside), with a hood.
  for (const rg of g.rooms)
    for (const w of rg.walls) {
      const north = w.nz === 1 && w.nx === 0;
      const west = w.nx === 1 && w.nz === 0;
      if ((!north && !west) || w.p % 10 !== 5) continue;
      const x = w.x + w.nx;
      const z = w.z + w.nz;
      if (!inside(g, rg, x, z, 1)) continue;
      lamps.push({ room: rg.room.id, x, y: WALL_HEIGHT - 1, z });
    }
  for (const l of lamps) {
    world.set(l.x, l.y, l.z, C.led_red);
    world.set(l.x, l.y + 1, l.z, C.metal_dark);
  }
  const lampCells = new Set(lamps.map((l) => `${l.x},${l.z}`));

  // Above-head details beside the walls: pillar corbels + cable trays (south/east walls).
  const headOk = (x: number, z: number) =>
    !lampCells.has(`${x},${z}`) && !nearDoor(doors, x, z, 4, 2) && !nearZone(tall, x, z, 1);
  const trayColor = (i: number) =>
    i % 7 === 0
      ? C.steel
      : i % 3 === 0
        ? C.cable_red
        : i % 5 === 0
          ? C.cable_yellow
          : C.cable_black;
  for (const rg of g.rooms) {
    const r = rg.room;
    const theme = r.theme ?? "generic";
    if (theme === "elevator") continue;
    const y = WALL_HEIGHT - 1;
    const shaft = shaftRooms.has(r.id);
    const step = shaft ? SHAFT_PILLAR : 8;
    const corbel = shaft ? C.wood : C.metal_light;
    const trays = TRAY_THEMES.has(theme) && !shaft;
    for (const w of rg.walls) {
      if (Math.abs(w.nx) + Math.abs(w.nz) !== 1) continue;
      const x = w.x + w.nx;
      const z = w.z + w.nz;
      if (!inside(g, rg, x, z, 1) || !headOk(x, z)) continue;
      if (w.p % step === 0) world.set(x, y, z, corbel);
      else if (trays && (w.nz === -1 || w.nx === -1)) world.set(x, y, z, trayColor(w.p));
    }
  }
  for (const rg of g.rooms) headPipes(world, rg, headOk, lampCells);

  // Door openings with hazard-striped frames (+ keypads).
  for (const d of doors) carveDoor(world, d);
  doorPlates(world, doors);

  // Slab details and wall-top relief.
  for (const rg of g.rooms) {
    floorDetail(world, g, rg, doors, zones);
    wallTops(world, rg, doors);
  }
  hubDetail(world, g, doors);

  // Elevator shaft: platform ring + pillars + overhead frame.
  for (const e of ELEVATORS) {
    if (e.floor !== floor) continue;
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++) {
        const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
        const stripe = ((dx + dz + 6) & 1) === 0;
        world.set(
          e.x + dx,
          0,
          e.z + dz,
          edge ? (stripe ? C.wall_trim : C.hazard_black) : C.floor_grate,
        );
      }
    world.set(e.x, 0, e.z, C.led_amber);
    const top = WALL_HEIGHT + 2;
    for (const [dx, dz] of [
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4],
    ] as const) {
      for (let y = 1; y <= top; y++)
        world.set(e.x + dx, y, e.z + dz, y % 3 === 0 ? C.wall_trim : C.metal);
      world.set(e.x + dx, 1, e.z + dz, C.hazard_black);
    }
    for (let o = -4; o <= 4; o++) {
      const c = o % 2 === 0 ? C.steel_dark : C.metal;
      world.set(e.x + o, top, e.z - 4, c);
      world.set(e.x + o, top, e.z + 4, c);
      world.set(e.x - 4, top, e.z + o, c);
      world.set(e.x + 4, top, e.z + o, c);
    }
    world.set(e.x, top + 1, e.z - 4, C.led_amber);
    world.set(e.x, top + 1, e.z + 4, C.led_amber);
  }
  return { floor, world, lamps };
}

/**
 * Windows in walls between two "clean" rooms: a straight wall cell whose
 * inner side belongs to one room and whose outer side to another.
 */
function carveWindows(world: VoxelWorld, g: FloorGeom, doors: readonly DoorDef[]): void {
  for (const rg of g.rooms) {
    const a = rg.room;
    if (!WINDOW_THEMES.has(a.theme ?? "generic") || isShaft(a)) continue;
    for (const w of rg.walls) {
      if (Math.abs(w.nx) + Math.abs(w.nz) !== 1) continue;
      const bx = w.x - w.nx;
      const bz = w.z - w.nz;
      if (bx < 0 || bz < 0 || bx >= g.W || bz >= g.Z) continue;
      const o = g.owner[bx + bz * g.W]!;
      if (!o || o === rg.index + 1) continue;
      const b = g.rooms[o - 1]!.room;
      if (!WINDOW_THEMES.has(b.theme ?? "generic") || isShaft(b)) continue;
      const pane =
        a.theme === "containment" || b.theme === "containment"
          ? C.glass_purple
          : a.theme === "cryo" || b.theme === "cryo"
            ? C.ice
            : C.glass;
      paneAt(world, w.x, w.z, w.p, doors, pane);
    }
  }
}

function paneAt(
  world: VoxelWorld,
  x: number,
  z: number,
  p: number,
  doors: readonly DoorDef[],
  pane: number,
): void {
  if (nearDoor(doors, x, z, 5, 0.5)) return;
  const slot = ((p % 8) + 8) % 8;
  if (slot < 2 || slot > 6) return;
  world.set(x, 2, z, C.metal_light);
  for (let y = 3; y <= 5; y++) world.set(x, y, z, pane);
  world.set(x, 6, z, C.metal);
}

/**
 * The poché — the lab's solid body between the rooms, thick as a bunker:
 * dark concrete with service hatches, vents and cable ducts on top; raw rock
 * with crystal flecks on the deep floors.
 */
function pocheMass(world: VoxelWorld, g: FloorGeom, floor: FloorId): void {
  // Few, large runs of one colour so the greedy mesher merges them into big quads:
  // flat sides, a flat top with a service duct grid (every 16) and rare hatches.
  const deep = isDeepFloor(floor);
  const side = deep ? C.rock_dark : C.concrete_dark;
  const flat = deep ? C.rock_dark : C.asphalt;
  const seed = 9001 + floor;
  for (let z = 0; z < g.Z; z++)
    for (let x = 0; x < g.W; x++) {
      if (!g.mass[x + z * g.W]) continue;
      for (let y = 1; y < WALL_HEIGHT; y++) world.set(x, y, z, side);
      let top = flat;
      if (deep) {
        const h = ih(x >> 1, z >> 1, seed);
        if (h % 23 === 0) top = floor === 5 ? C.abstractum : C.vein_cyan;
        else if (h % 5 === 0) top = C.rock;
      } else if (x % 16 === 8 || z % 16 === 8) top = C.steel_dark;
      else if (ih(x >> 1, z >> 1, seed) % 41 === 0) top = C.metal_dark;
      world.set(x, WALL_HEIGHT, z, top);
    }
}

/**
 * The core rotunda floor: a compass rose around the shaft, concentric
 * guide rings and floor lights pointing at the doors.
 */
function hubDetail(world: VoxelWorld, g: FloorGeom, doors: readonly DoorDef[]): void {
  for (const rg of g.rooms) {
    const r = rg.room;
    if (r.theme !== "hub") continue;
    const e = ELEVATORS.find((q) => q.floor === r.floor);
    if (!e) continue;
    const deep = r.floor === 5;
    const own = rg.index + 1;
    // Guide lights: a strip in the floor from the shaft platform to every door of the core.
    const guide = new Set<number>();
    for (const d of doors) {
      const touches = [-1, 1].some((sd) => {
        const x = d.axis === "x" ? d.x : d.x + sd;
        const z = d.axis === "x" ? d.z + sd : d.z;
        return g.owner[x + z * g.W] === own;
      });
      if (!touches) continue;
      const len = Math.hypot(d.x - e.x, d.z - e.z);
      for (let t = 0; t <= len; t += 0.5) {
        const x = Math.floor(e.x + ((d.x - e.x) * t) / len);
        const z = Math.floor(e.z + ((d.z - e.z) * t) / len);
        if (g.owner[x + z * g.W] === own && !inElevatorArea(x, z)) guide.add(x + z * g.W);
      }
    }
    for (const i of rg.cells) {
      const x = i % g.W;
      const z = (i - x) / g.W;
      if (inElevatorArea(x, z)) continue;
      const dx = x + 0.5 - e.x;
      const dz = z + 0.5 - e.z;
      const dist = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx);
      const edge = g.edge[i]!;
      if (guide.has(i)) {
        world.set(
          x,
          0,
          z,
          deep
            ? Math.round(dist) % 3 === 0
              ? C.lamp_warm
              : C.wood_dark
            : Math.round(dist) % 2 === 0
              ? C.led_green
              : C.metal_dark,
        );
        continue;
      }
      if (deep) {
        // Pit bottom: mine rails in a ring, gravel between.
        if (Math.abs(dist - 16) < 0.6 || Math.abs(dist - 18) < 0.6) world.set(x, 0, z, C.steel);
        else if (Math.abs(dist - 17) < 1.2 && Math.round(a * 16) % 3 === 0)
          world.set(x, 0, z, C.wood_dark);
        continue;
      }
      const ring = Math.abs(dist - 15.5) < 0.55 || Math.abs(dist - 18.5) < 0.45;
      const spoke = Math.abs(a - Math.round(a / (Math.PI / 4)) * (Math.PI / 4)) * dist < 0.55;
      if (ring) world.set(x, 0, z, (Math.round(a * 20) & 1) === 0 ? C.brass : C.metal_light);
      else if (spoke && dist > 12 && edge > 2)
        world.set(x, 0, z, dist % 3 < 1 ? C.led_amber : C.metal_dark);
      else if (edge === 2) world.set(x, 0, z, C.wall_trim);
    }
  }
}

export function doorCells(d: DoorDef): { x: number; z: number }[] {
  const half = Math.floor(d.width / 2);
  const out: { x: number; z: number }[] = [];
  for (let o = -half; o <= half; o++)
    out.push(d.axis === "x" ? { x: d.x + o, z: d.z } : { x: d.x, z: d.z + o });
  return out;
}

function carveDoor(world: VoxelWorld, d: DoorDef): void {
  const cells = doorCells(d);
  for (const c of cells) {
    for (let y = 1; y <= DOOR_HEIGHT; y++) world.set(c.x, y, c.z, 0);
    world.set(c.x, DOOR_HEIGHT + 1, c.z, C.door_frame);
    world.set(c.x, 0, c.z, C.metal_dark);
  }
  const first = cells[0]!;
  const last = cells[cells.length - 1]!;
  const step = d.axis === "x" ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const before = { x: first.x - step.x, z: first.z - step.z };
  const after = { x: last.x + step.x, z: last.z + step.z };
  for (let y = 1; y <= DOOR_HEIGHT + 1; y++) {
    const c = y > DOOR_HEIGHT ? C.door_frame : y % 2 === 0 ? C.wall_trim : C.hazard_black;
    world.set(before.x, y, before.z, c);
    world.set(after.x, y, after.z, c);
  }
  // Threshold stripes on the floor under the frame.
  world.set(before.x, 0, before.z, C.hazard_black);
  world.set(after.x, 0, after.z, C.hazard_black);
  // Status LED in the header above the opening.
  const mid = cells[Math.floor(cells.length / 2)]!;
  world.set(mid.x, WALL_HEIGHT, mid.z, d.lock || d.keypad ? C.led_red : C.led_green);
  if (d.keypad) {
    // Keypad block in the wall line beside the frame (visible from both sides).
    const k = { x: after.x + step.x, z: after.z + step.z };
    world.set(k.x, 2, k.z, C.metal_dark);
    world.set(k.x, 3, k.z, C.led_amber);
    world.set(k.x, 4, k.z, C.screen_green);
    world.set(k.x, 5, k.z, C.metal_dark);
  }
}

/** Fill (closed) or clear (open) a door leaf. */
export function setDoorLeaf(world: VoxelWorld, d: DoorDef, closed: boolean, keypad: boolean): void {
  const cells = doorCells(d);
  cells.forEach((c, i) => {
    for (let y = 1; y <= DOOR_HEIGHT; y++) {
      let v = 0;
      if (closed) {
        const stripe = y === 3;
        v = stripe
          ? keypad
            ? C.led_amber
            : C.door_locked
          : i === Math.floor(cells.length / 2)
            ? C.metal_dark
            : C.door_panel;
      }
      world.set(c.x, y, c.z, v);
    }
  });
}

/** Switch wall lamps of a room between lit (white-gold) and emergency red. */
export function setLamps(
  world: VoxelWorld,
  lamps: readonly Lamp[],
  room: string,
  lit: boolean,
): void {
  for (const l of lamps)
    if (l.room === room) world.set(l.x, l.y, l.z, lit ? C.white_gold : C.led_red);
}

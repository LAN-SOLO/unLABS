/**
 * Door + elevator models (pure — no three).
 * =========================================
 *
 * All models are built at DOOR_SCALE (0.25 world units per voxel, 4 voxels
 * per world voxel) and are meant to be meshed CENTRED in x/z with y = 0 at
 * the bottom (the engine's `meshModel(grid, scale, true)` convention).
 *
 * Door frame of reference (local, before the door group's rotation):
 *   - local +x runs ALONG the wall (world +x for axis "x" doors, world +z
 *     for axis "z" doors), local z runs ACROSS the wall (the wall is 1 world
 *     unit thick, local z ∈ [-0.5, 0.5]);
 *   - the door group origin sits at (d.x + 0.5, 1, d.z + 0.5): the centre
 *     of the 5-cell opening, on the floor surface;
 *   - the opening spans local x ∈ [-2.5, 2.5], y ∈ [0, 6] (DOOR_HEIGHT);
 *     the frame cells either side are x ∈ [-3.5, -2.5] and [2.5, 3.5] and
 *     the header row is y ∈ [6, 7].
 *
 * Leaves are 2.5 × 6 world units (10 × 24 voxels), 0.75 thick (inside the
 * wall), so a pair closes the opening exactly and each half hides inside
 * the wall when slid 2.5 units outwards. The frame encloses the voxel
 * frame cells (proud by 0.25 on both wall faces) so nothing is coplanar.
 */
import { C } from "@/lib/world/content/palette";
import { ROOMS, WALL_HEIGHT } from "@/lib/world/content/map";
import { Model } from "@/lib/world/models/core";
import {
  bezelScreen,
  faceRect,
  faceSet,
  hash3,
  mount,
  stencil,
  visual,
  type AnimPart,
  type DeviceVisual,
} from "@/lib/world/models/anim";
import type { DoorDef, RoomDef } from "@/lib/world/types";

/** World units per door/elevator model voxel. */
export const DOOR_SCALE = 0.25;
/** Model voxels per world voxel. */
export const DOOR_VPU = 4;

/** Opening in world units (5 cells × DOOR_HEIGHT 6). */
export const OPENING_W = 5;
export const OPENING_H = 6;

export const LEAF_W = 10;
export const LEAF_H = 24;
export const LEAF_D = 3;
/** Secret leaves are exactly wall-thick (flush with the wall panelling). */
export const SECRET_LEAF_D = 4;

export const FRAME_W = 28;
export const FRAME_H = 28;
export const FRAME_D = 6;
/** Jamb width in voxels (4 = the frame cell + 1 lip into the opening). */
export const JAMB_W = 5;
/** First header row (y = 5.75 world above the floor: 1 voxel lip into the opening). */
export const HEADER_Y = 23;

export type DoorVariant = "normal" | "keypad" | "locked" | "secret";
export type LeafSide = "left" | "right";
/** Colour of a leaf's status strip / the frame beacon. */
export type DoorLight = "green" | "amber" | "red";

const LIGHT_COLOR: Record<DoorLight, number> = {
  green: C.led_green,
  amber: C.led_amber,
  red: C.led_red,
};

/** What a door looks like right now: light colour from lock state + keypad hardware. */
export function doorLight(variant: DoorVariant, unlocked: boolean): DoorLight {
  if (unlocked) return "green";
  return variant === "keypad" ? "amber" : "red";
}

// ── Small helpers ────────────────────────────────────────────────

/** Copy of `m` mirrored along x. */
export function mirrorX(m: Model): Model {
  const out = new Model(m.w, m.h, m.d);
  m.grid.forEach((x, y, z, v) => out.set(m.w - 1 - x, y, z, v));
  return out;
}

/** Sub-box of `m` (voxel indices, inclusive start, sizes in voxels). */
export function cropModel(
  m: Model,
  x0: number,
  y0: number,
  z0: number,
  w: number,
  h: number,
  d: number,
): Model {
  const out = new Model(w, h, d);
  for (let z = 0; z < d; z++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = m.grid.get(x0 + x, y0 + y, z0 + z);
        if (v) out.set(x, y, z, v);
      }
  return out;
}

/** Paint the same (u, v) rect on both big faces (z = 0 and z = d - 1) at depth `dd`. */
function bothFaces(
  m: Model,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  dd: number,
  c: number,
): void {
  faceRect(m, "+z", m.d - 1, u0, v0, u1, v1, dd, c);
  faceRect(m, "-z", 0, u0, v0, u1, v1, dd, c);
}

function bothSet(m: Model, u: number, v: number, dd: number, c: number): void {
  faceSet(m, "+z", m.d - 1, u, v, dd, c);
  faceSet(m, "-z", 0, u, v, dd, c);
}

// ── Blast-door leaves ────────────────────────────────────────────

export interface LeafOpts {
  light: DoorLight;
  /** Small keypad on the leaf (keypad doors, right leaf only). */
  keypad?: boolean;
  /** Locking bolt across the meeting edge. */
  bolt?: boolean;
}

/**
 * LEFT leaf, meeting edge at x = LEAF_W − 1. Rim, V-chevrons at the
 * bottom, recessed panels with rivet strips, emissive status strip, a
 * glazed window slit and a rubber gasket on the meeting edge.
 */
function leftLeaf(o: LeafOpts): Model {
  const W = LEAF_W;
  const H = LEAF_H;
  const m = new Model(W, H, LEAF_D);
  m.box(0, 0, 0, W - 1, H - 1, LEAF_D - 1, C.door_panel);
  const L = W - 1;
  // Recessed panels (faces carved, core shows darker steel).
  const recess = (u0: number, v0: number, u1: number, v1: number) => {
    bothFaces(m, u0, v0, u1, v1, 0, 0);
    faceRect(m, "+z", m.d - 1, u0, v0, u1, v1, 1, C.steel_dark);
  };
  recess(1, 7, L - 2, 10);
  recess(1, 13, L - 2, 21);
  // Chevron band (V across both leaves: stripes lean toward the meeting edge).
  for (let v = 0; v <= 4; v++)
    for (let u = 0; u <= L; u++) {
      const k = (((L - u + v) >> 1) & 1) === 0 ? C.safety_yellow : C.hazard_black;
      bothSet(m, u, v, 0, k);
    }
  // Steel strips with rivets.
  for (const v of [5, 6, 12, 22]) bothFaces(m, 0, v, L, v, 0, C.steel);
  for (let u = 1; u <= L - 1; u += 2) {
    bothSet(m, u, 6, 0, C.chrome);
    bothSet(m, u, 22, 0, C.chrome);
  }
  // Rivets inside the recessed panels (stand on the core, flush with the rim).
  for (const [u, v] of [
    [1, 7],
    [L - 2, 7],
    [1, 10],
    [L - 2, 10],
    [1, 13],
    [L - 2, 13],
    [1, 21],
    [L - 2, 21],
  ] as const)
    bothSet(m, u, v, 0, C.chrome);
  // Status light strip.
  const lc = LIGHT_COLOR[o.light];
  for (let u = 1; u <= L - 1; u++) {
    bothSet(m, u, 11, 0, lc);
    m.set(u, 11, 1, lc);
  }
  bothSet(m, 0, 11, 0, C.metal_dark);
  // Window slit: glazed through, framed.
  for (let v = 15; v <= 18; v++)
    for (let u = 3; u <= 7; u++) {
      const edge = v === 15 || v === 18 || u === 3 || u === 7;
      if (edge) bothSet(m, u, v, 0, C.metal_dark);
      else {
        bothSet(m, u, v, 0, 0);
        m.set(u, v, 1, C.glass);
      }
    }
  // Top & outer rim, meeting-edge gasket.
  bothFaces(m, 0, H - 1, L, H - 1, 0, C.metal_dark);
  m.box(0, 0, 0, 0, H - 1, LEAF_D - 1, C.metal_dark);
  m.box(L, 0, 0, L, H - 1, LEAF_D - 1, C.rubber);
  for (let v = 1; v < H - 1; v += 4) m.set(L, v, 1, C.hazard_black);
  if (o.bolt) {
    // Locking bolt: heavy steel block at the strip height, reaching the edge.
    for (let v = 9; v <= 13; v++) for (let u = L - 3; u <= L; u++) bothSet(m, u, v, 0, C.steel);
    bothSet(m, L - 3, 11, 0, C.safety_red);
  }
  return m;
}

/** One blast-door leaf (the right leaf is the mirrored left one, plus the keypad). */
export function doorLeafModel(side: LeafSide, o: LeafOpts): Model {
  const left = leftLeaf(o);
  if (side === "left") return left;
  const m = mirrorX(left);
  if (o.keypad) {
    // Keypad plate on the lower panel: black plate, 3×2 keys, tiny display.
    bothFaces(m, 3, 6, 8, 10, 0, C.paint_black);
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 3; i++)
        bothSet(m, 4 + i * 2, 7 + j * 2, 0, i === 2 && j === 0 ? C.safety_red : C.paint_gray);
    bothFaces(m, 4, 10, 7, 10, 0, C.screen_green);
  }
  return m;
}

// ── Frame / header ───────────────────────────────────────────────

export interface FrameOpts {
  /**
   * Frame of a (revealed) secret door: the header band and its status
   * LEDs use the wall's own trim colour (C.wall_trim) instead of the lit
   * door-frame amber, and there is no "B2" stencil, so even an opened
   * secret door does not advertise itself from across the room.
   */
  secret?: boolean;
}

/** Header status-LED colour (normal doors glow amber; secret doors wear the wall trim). */
export function headerLedColor(o: FrameOpts = {}): number {
  return o.secret ? C.wall_trim : C.led_amber;
}

/**
 * Door surround: two jambs (the frame cells + 1-voxel lip into the
 * opening) and a header. Proud by 1 voxel on both wall faces. Hazard
 * stripes on the jamb faces (scuffed at the foot), rivets, bolted access
 * plates, a guide slot where the leaves run, a cable conduit and two
 * status LEDs on the header, a door placard. The warning beacon is a
 * separate model (`doorBeaconModel`).
 */
export function doorFrameModel(o: FrameOpts = {}): Model {
  const W = FRAME_W;
  const H = FRAME_H;
  const D = FRAME_D;
  const m = new Model(W, H, D);
  const R = W - 1;
  // Jambs + header body.
  m.box(0, 0, 0, JAMB_W - 1, H - 1, D - 1, C.steel_dark);
  m.box(R - JAMB_W + 1, 0, 0, R, H - 1, D - 1, C.steel_dark);
  m.box(0, HEADER_Y, 0, R, H - 1, D - 1, C.steel_dark);
  // Jamb faces: outer steel edge, rivet column, hazard stripes.
  for (const [a, b, rivet, edge] of [
    [2, 4, 1, 0],
    [R - 4, R - 2, R - 1, R],
  ] as const) {
    for (let v = 0; v < HEADER_Y; v++)
      for (let u = a; u <= b; u++)
        bothSet(m, u, v, 0, (((u + v) >> 1) & 1) === 0 ? C.safety_yellow : C.hazard_black);
    bothFaces(m, edge, 0, edge, H - 1, 0, C.metal);
    bothFaces(m, rivet, 0, rivet, HEADER_Y - 1, 0, C.steel);
    for (let v = 2; v < HEADER_Y; v += 4) bothSet(m, rivet, v, 0, C.chrome);
    // Foot plates.
    bothFaces(m, Math.min(a, edge), 0, Math.max(b, edge), 0, 0, C.metal_dark);
  }
  // Guide slots on the opening sides of the jambs (where the leaves run).
  for (const x of [JAMB_W - 1, R - JAMB_W + 1])
    for (let y = 0; y < HEADER_Y; y++) for (let z = 2; z <= 3; z++) m.set(x, y, z, C.black);
  // Scuffed feet: boots and trolleys wore the stripes down to bare steel.
  for (const [a, b] of [
    [2, 4],
    [R - 4, R - 2],
  ] as const)
    for (let u = a; u <= b; u++)
      for (let v = 1; v <= 3; v++)
        if (hash3(u, v, 31) < 0.3) bothSet(m, u, v, 0, v === 1 ? C.iron_rust : C.steel_dark);
  // Bolted access plate on the keypad-side jamb (both faces), mid height.
  bothFaces(m, R - 4, 10, R - 2, 13, 0, C.steel);
  for (const [u, v] of [
    [R - 4, 10],
    [R - 2, 10],
    [R - 4, 13],
    [R - 2, 13],
  ] as const)
    bothSet(m, u, v, 0, C.chrome);
  bothSet(m, R - 3, 12, 0, C.paper_yellow); // inspection tag
  // Header faces: door-frame band (wall trim on secret doors), dark lip, stencil.
  const band = o.secret ? C.wall_trim : C.door_frame;
  bothFaces(m, 0, HEADER_Y, R, HEADER_Y, 0, C.metal_dark);
  bothFaces(m, 0, HEADER_Y + 1, R, H - 1, 0, band);
  bothFaces(m, 0, H - 1, R, H - 1, 0, C.metal_light);
  for (const u of [1, 5, 22, 26]) bothSet(m, u, HEADER_Y + 2, 0, C.chrome);
  if (!o.secret) {
    stencil(m, "+z", D - 1, 8 - 5, HEADER_Y + 1, "B2", C.hazard_black);
    stencil(m, "-z", 0, 24 - 5 + 4, HEADER_Y + 1, "B2", C.hazard_black);
  }
  // Status LEDs flanking the beacon slot + a cable conduit along the top edge.
  const led = headerLedColor(o);
  for (const u of [10, 17]) bothSet(m, u, HEADER_Y + 2, 0, led);
  for (let u = 2; u <= R - 2; u++) if (u % 6 !== 0) m.set(u, H - 1, 0, C.cable_black);
  // Placard (room code plate) on the header's right half.
  bothFaces(m, 19, HEADER_Y + 1, 21, HEADER_Y + 2, 0, o.secret ? band : C.paint_white);
  if (!o.secret) bothSet(m, 20, HEADER_Y + 2, 0, C.paint_black);
  // Underside of the header lip: dark, with the leaf track.
  for (let x = JAMB_W; x <= R - JAMB_W; x++) {
    m.set(x, HEADER_Y, 2, C.black);
    m.set(x, HEADER_Y, 3, C.black);
  }
  return m;
}

/** Beacon on the header centre (proud 1 voxel beyond the frame on both faces). */
export const BEACON_W = 4;
export const BEACON_H = 3;
export const BEACON_D = FRAME_D + 2;

export function doorBeaconModel(light: DoorLight): Model {
  const m = new Model(BEACON_W, BEACON_H, BEACON_D);
  const lc = LIGHT_COLOR[light];
  m.box(0, 0, 1, BEACON_W - 1, BEACON_H - 1, BEACON_D - 2, C.metal_dark);
  // Lenses on both faces + a lit top stripe.
  m.box(0, 0, 0, BEACON_W - 1, 1, 0, lc).box(0, 0, BEACON_D - 1, BEACON_W - 1, 1, BEACON_D - 1, lc);
  m.box(1, BEACON_H - 1, 1, BEACON_W - 2, BEACON_H - 1, BEACON_D - 2, lc);
  m.set(0, 2, 0, C.metal_dark).set(BEACON_W - 1, 2, 0, C.metal_dark);
  m.set(0, 2, BEACON_D - 1, C.metal_dark).set(BEACON_W - 1, 2, BEACON_D - 1, C.metal_dark);
  return m;
}

/** Beacon bottom row inside the header (local y = BEACON_ROW / DOOR_VPU). */
export const BEACON_ROW = HEADER_Y + 1;

// ── Secret doors: wall-matching skin ─────────────────────────────

/** Colour of the wall voxel at cell offset `o` (along the wall) and world row y (1..7). */
export type WallSkin = (o: number, y: number) => number;

interface WallMats {
  seam: number;
  pillar: number;
  base: number;
}

/** Mirror of layout.ts' private WALL_MATS (keep in sync, or export it from there). */
const WALL_MATS: Record<number, WallMats> = {
  [C.wall]: { seam: C.wall_dark, pillar: C.steel_dark, base: C.wall_dark },
  [C.wall_dark]: { seam: C.floor_dark, pillar: C.metal, base: C.metal_dark },
  [C.wall_beige]: { seam: C.beige, pillar: C.wood_dark, base: C.wood_dark },
  [C.wall_olive]: { seam: C.floor_green, pillar: C.metal, base: C.metal_dark },
  [C.wall_teal]: { seam: C.tile_teal, pillar: C.steel_dark, base: C.metal_dark },
  [C.concrete]: { seam: C.concrete_dark, pillar: C.concrete_light, base: C.asphalt },
};

function matsOf(wall: number): WallMats {
  return WALL_MATS[wall] ?? { seam: C.wall_dark, pillar: C.metal, base: C.metal_dark };
}

/** layout.ts' panelled wall rule for position `p` along the wall and row y. */
function panelColor(wall: number, p: number, y: number): number {
  const mats = matsOf(wall);
  const pp = ((p % 8) + 8) % 8;
  if (y === WALL_HEIGHT) return C.wall_trim;
  if (pp === 0) return y === WALL_HEIGHT - 1 ? C.metal_light : mats.pillar;
  if (y === 1) return mats.base;
  if (pp === 4 || y === 5) return mats.seam;
  return wall;
}

/** Plain panelled wall skin: wall colour + panel phase (`p` of the door centre cell). */
export function panelSkin(wall: number, p0 = 2): WallSkin {
  return (o, y) => panelColor(wall, p0 + o, y);
}

/** Same integer hash as layout.ts (shaft rock). */
function ih(x: number, z: number, seed: number): number {
  let h = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

function rockColor(x: number, y: number, z: number, p: number): number {
  const post = p % 6 === 0;
  if (y === WALL_HEIGHT) return post ? C.wood_dark : C.wood;
  if (post) return y === WALL_HEIGHT - 1 ? C.wood : C.wood_dark;
  const k = ih(x * 3 + y, z * 5 - y, 977);
  if (k % 53 === 0) return C.crystal_violet;
  if (k % 41 === 0) return C.rust;
  return k % 7 === 0 ? C.concrete_light : k % 3 === 0 ? C.concrete : C.concrete_dark;
}

function isShaftRoom(r: RoomDef): boolean {
  return r.floor === 5 && (r.theme === "storage" || r.theme === "corridor");
}

function onWall(r: RoomDef, x: number, z: number): boolean {
  if (x < r.x || x > r.x + r.w || z < r.z || z > r.z + r.d) return false;
  return x === r.x || x === r.x + r.w || z === r.z || z === r.z + r.d;
}

/**
 * The exact skin layout.ts paints on this door's wall: for every cell the
 * LAST room (ROOMS order) whose perimeter contains it wins, like the
 * voxelizer's overwrite order — panelling phase and shaft rock included.
 */
export function secretSkinFor(d: DoorDef): WallSkin {
  const rooms = ROOMS.filter((r) => r.floor === d.floor);
  return (o, y) => {
    const x = d.axis === "x" ? d.x + o : d.x;
    const z = d.axis === "x" ? d.z : d.z + o;
    let owner: RoomDef | undefined;
    for (const r of rooms) if (onWall(r, x, z)) owner = r;
    if (!owner) return C.wall;
    const p = z === owner.z || z === owner.z + owner.d ? x - owner.x : z - owner.z;
    return isShaftRoom(owner) ? rockColor(x, y, z, p) : panelColor(owner.wallColor, p, y);
  };
}

/**
 * Full 7-cell × 7-row wall patch (28 × 28 × `depth` voxels) painted with
 * `skin`, plus a subtle seam where the hidden leaves meet.
 */
function secretPatch(skin: WallSkin, depth: number): Model {
  const m = new Model(FRAME_W, FRAME_H, depth);
  for (let col = 0; col < FRAME_W; col++)
    for (let row = 0; row < FRAME_H; row++) {
      const o = Math.floor(col / DOOR_VPU) - 3;
      const y = 1 + Math.floor(row / DOOR_VPU);
      m.box(col, row, 0, col, row, depth - 1, skin(o, y));
    }
  // Subtle seam: every other voxel of the meeting column, on the faces only.
  const mid = FRAME_W / 2 - 1;
  for (let row = 5; row < LEAF_H - 1; row += 2) {
    const c = skin(0, 1 + Math.floor(row / DOOR_VPU));
    const dark = matsOf(c).seam === c ? C.black : matsOf(c).seam;
    bothSet(m, mid, row, 0, dark);
  }
  // Hairline where the leaf tops meet the header (only a few voxels).
  for (const col of [5, 9, 18, 22]) bothSet(m, col, LEAF_H - 1, 0, skin(0, 5));
  return m;
}

export interface SecretDoorModels {
  /** Static cover over the frame cells + header (hides the hazard frame). */
  cover: Model;
  left: Model;
  right: Model;
}

/**
 * Secret door, matching the wall. Leaves are wall-thick (flush); the cover
 * is the 7-cell patch with the leaf area cut out. Mesh the leaves with a
 * depth scale of ~0.98 and the cover with ~1.02 so nothing z-fights.
 */
export function secretDoorModels(skin: WallSkin): SecretDoorModels {
  const patch = secretPatch(skin, SECRET_LEAF_D);
  const off = FRAME_W / 2 - LEAF_W; // 4: first leaf column
  const left = cropModel(patch, off, 0, 0, LEAF_W, LEAF_H, SECRET_LEAF_D);
  const right = cropModel(patch, off + LEAF_W, 0, 0, LEAF_W, LEAF_H, SECRET_LEAF_D);
  const cover = cropModel(patch, 0, 0, 0, FRAME_W, FRAME_H, SECRET_LEAF_D);
  cover.box(off, 0, 0, off + 2 * LEAF_W - 1, LEAF_H - 1, SECRET_LEAF_D - 1, 0);
  return { cover, left, right };
}

// ── Elevator ─────────────────────────────────────────────────────

/** Platform footprint: 7 × 7 world cells (e.x ± 3, e.z ± 3). */
export const PLATFORM_W = 28;
/** Deck thickness in voxels. */
export const DECK_H = 2;
/** Crossbar top row (+1): cables attach here. */
export const PLATFORM_H = 30;
/** Rail height rows. */
const RAIL_TOP = 14;

/**
 * Lift platform (DeviceVisual with the floor-indicator screen): grate deck
 * with a hazard rim, handrails on N/S/E, a yoke with crossbar for the
 * hoist cables, and a control post (call button, floor buttons, status
 * screen). The entry side (−x, west) is left open for the gate.
 */
export function elevatorPlatformVisual(): DeviceVisual {
  const W = PLATFORM_W;
  const R = W - 1;
  const m = new Model(W, PLATFORM_H, W);
  // Deck: steel underside, grate top, hazard rim (2 wide), corner bolts.
  m.box(0, 0, 0, R, 0, R, C.steel_dark);
  for (let z = 0; z < W; z++)
    for (let x = 0; x < W; x++) {
      const rim = Math.min(x, z, R - x, R - z);
      let c: number;
      if (rim <= 1) c = (((x + z) >> 1) & 1) === 0 ? C.safety_yellow : C.hazard_black;
      else c = x % 3 === 0 || z % 3 === 0 ? C.metal_dark : C.floor_grate;
      m.set(x, 1, z, c);
    }
  for (const [x, z] of [
    [2, 2],
    [R - 2, 2],
    [2, R - 2],
    [R - 2, R - 2],
  ] as const)
    m.set(x, 1, z, C.chrome);
  m.set(13, 1, 13, C.led_amber).set(14, 1, 14, C.led_amber);
  // Handrails on N (z=0), S (z=R), E (x=R): posts, toe board, mid + top rail.
  const rail = (along: "x" | "z", fixed: number) => {
    for (let t = 0; t < W; t++) {
      const [x, z] = along === "x" ? [t, fixed] : [fixed, t];
      m.set(x, 2, z, C.metal);
      m.set(x, 8, z, C.steel);
      m.set(x, RAIL_TOP, z, C.safety_yellow);
      if (t % 9 === 0 || t === R)
        for (let y = 3; y < RAIL_TOP; y++) m.set(x, y, z, y === 3 ? C.metal_dark : C.steel);
    }
  };
  rail("x", 0);
  rail("x", R);
  rail("z", R);
  // Cage mesh between the mid and top rails: a diagonal lattice, so the
  // cage reads as expanded metal without walling the platform in.
  const mesh = (along: "x" | "z", fixed: number) => {
    for (let t = 1; t < R; t++)
      for (let y = 9; y < RAIL_TOP; y++) {
        if (t % 9 === 0) continue;
        if ((t + y) % 4 !== 0 && (t - y + 64) % 4 !== 0) continue;
        const [x, z] = along === "x" ? [t, fixed] : [fixed, t];
        m.set(x, y, z, C.steel_dark);
      }
  };
  mesh("x", 0);
  mesh("x", R);
  mesh("z", R);
  // Kick plates below the mid rail: bolted, scuffed.
  for (const [along, fixed] of [
    ["x", 0],
    ["x", R],
    ["z", R],
  ] as const)
    for (let t = 1; t < R; t++) {
      const [x, z] = along === "x" ? [t, fixed] : [fixed, t];
      m.set(x, 3, z, t % 5 === 0 ? C.chrome : hash3(t, fixed, 5) < 0.25 ? C.iron_rust : C.metal);
    }
  // Worn walkway on the grate from the gate to the control post.
  for (let x = 2; x < 22; x++)
    for (let z = 11; z <= 16; z++)
      if (m.grid.get(x, 1, z) === C.floor_grate && hash3(x, z, 3) < 0.35) m.set(x, 1, z, C.steel);
  // Load placard on the north rail (facing the cab).
  m.box(4, 10, 1, 8, 12, 1, C.paint_white);
  m.box(5, 11, 1, 7, 11, 1, C.paint_black).set(4, 12, 1, C.safety_red).set(8, 12, 1, C.safety_red);
  // Gate tracks on the open west side (bottom + top, the gate bars run in them).
  for (let z = 0; z < W; z++) {
    m.set(0, 2, z, C.metal_dark);
    m.set(0, RAIL_TOP + 3, z, C.metal_dark);
  }
  for (const z of [0, R]) for (let y = 2; y <= RAIL_TOP + 3; y++) m.set(0, y, z, C.steel_dark);
  // Yoke: posts at the N/S rail centres up to the crossbar.
  for (const z of [0, R]) {
    m.box(13, 2, z, 14, PLATFORM_H - 1, z, C.steel_dark);
    for (let y = 4; y < PLATFORM_H - 2; y += 4) m.set(13, y, z, C.safety_yellow);
  }
  m.box(12, PLATFORM_H - 2, 0, 15, PLATFORM_H - 1, R, C.steel_dark);
  for (let z = 1; z < R; z += 3)
    m.set(12, PLATFORM_H - 1, z, C.chrome).set(15, PLATFORM_H - 1, z, C.chrome);
  m.box(13, PLATFORM_H - 1, 12, 14, PLATFORM_H - 1, 15, C.brass); // cable shackle
  // Knee braces from the posts to the crossbar, caged work lamp under it.
  for (const z of [1, R - 1]) {
    const dz = z === 1 ? 1 : -1;
    for (let i = 0; i < 4; i++) m.set(13, PLATFORM_H - 3 - i, z + dz * (i + 1), C.steel_dark);
  }
  m.box(13, PLATFORM_H - 4, 13, 14, PLATFORM_H - 3, 14, C.lamp_cold);
  for (const [x, z] of [
    [12, 12],
    [15, 12],
    [12, 15],
    [15, 15],
  ] as const)
    m.box(x, PLATFORM_H - 4, z, x, PLATFORM_H - 3, z, C.metal_dark);
  // Control post in the NE corner, facing −x (the entry).
  m.box(22, 2, 2, 25, 17, 4, C.metal);
  m.box(21, 18, 1, 25, 23, 5, C.paint_navy);
  const scr = bezelScreen(m, "-x", 21, 2, 19, 4, 22, "status", { color: "#FFB800" });
  // Call button (big, red, proud) + floor buttons column below the screen.
  m.set(20, 15, 3, C.safety_red).set(21, 15, 3, C.safety_red);
  for (let i = 0; i < 5; i++) m.set(21, 5 + i * 2, 3, i === 0 ? C.led_green : C.paint_gray);
  m.box(22, 2, 5, 22, 17, 5, C.cable_black);
  // Post details: emergency-stop mushroom, key switch, inspection sticker, grab handle.
  m.set(20, 12, 2, C.safety_yellow).set(19, 12, 2, C.safety_red);
  m.set(21, 3, 2, C.chrome).set(21, 3, 3, C.brass);
  m.box(21, 17, 3, 21, 17, 4, C.paper_yellow);
  m.box(20, 6, 1, 20, 12, 1, C.safety_yellow);
  const v = visual(m, [], []);
  v.scale = DOOR_SCALE;
  v.screens = [scr];
  return v;
}

/** Gate bar count and model (a collapsible gate on the west side of the platform). */
export const GATE_BARS = 10;
export const GATE_BAR_H = RAIL_TOP + 1;

export function gateBarModel(): Model {
  const m = new Model(1, GATE_BAR_H, 2);
  m.box(0, 0, 0, 0, GATE_BAR_H - 1, 1, C.steel);
  m.set(0, 0, 0, C.metal_dark).set(0, 0, 1, C.metal_dark);
  m.set(0, GATE_BAR_H - 1, 0, C.metal_dark).set(0, GATE_BAR_H - 1, 1, C.metal_dark);
  m.set(0, 6, 0, C.safety_yellow).set(0, 7, 1, C.safety_yellow);
  return m;
}

/** Gate bar centre z (local, world units) for bar i at gate closure 0 (open) .. 1 (closed). */
export function gateBarZ(i: number, closed: number): number {
  const half = PLATFORM_W / 2 / DOOR_VPU; // 3.5
  const zClosed = -half + 0.25 + (i * (2 * half - 0.5)) / (GATE_BARS - 1);
  const zOpen = half - 0.25 - (GATE_BARS - 1 - i) * 0.12;
  const k = Math.max(0, Math.min(1, closed));
  return zOpen + (zClosed - zOpen) * k;
}

/** Winch dimensions (sits on the shaft's overhead frame). */
export const WINCH_W = 20;
export const WINCH_H = 18;
export const WINCH_D = 36;
/** World y of the winch model's bottom row (beam bottom lands on the frame top at y = 11). */
export const WINCH_Y = 9;
/** Sheave centre in winch voxel coords (cables hang from its bottom). */
export const SHEAVE_AT: [number, number, number] = [10, 4, 18];
export const SHEAVE_R = 4;

/**
 * Overhead winch: a beam across the shaft frame, a motor housing with a
 * spinning cable drum on top and a spinning sheave hanging below the beam.
 * Parts spin about x (`speed` is a nominal rate — the elevator drives the
 * angle from the platform's velocity).
 */
export function elevatorWinchVisual(): DeviceVisual {
  const m = new Model(WINCH_W, WINCH_H, WINCH_D);
  // Beam along z resting on the frame (rows 8..10).
  m.box(7, 8, 0, 12, 10, WINCH_D - 1, C.steel_dark);
  for (let z = 1; z < WINCH_D; z += 3) m.set(7, 10, z, C.chrome).set(12, 10, z, C.chrome);
  for (let z = 0; z < WINCH_D; z++) m.set(9, 8, z, C.safety_yellow).set(10, 8, z, C.hazard_black);
  // Sheave bracket plates hanging under the beam.
  for (const x of [6, 13]) m.box(x, 1, 13, x, 7, 23, C.metal);
  // Motor housing on top of the beam.
  m.box(2, 11, 12, 17, 13, 23, C.metal_dark);
  m.box(2, 14, 12, 5, 16, 23, C.safety_yellow); // gearbox
  for (let z = 13; z < 23; z += 2) m.box(2, 17, z, 5, 17, z, C.steel);
  m.box(14, 14, 14, 17, 17, 21, C.blue_paint); // motor
  for (let y = 14; y <= 17; y++) m.set(17, y, 13, C.steel).set(17, y, 22, C.steel);
  m.set(15, 17, 17, C.led_amber);
  // Drum saddles.
  for (const x of [6, 13]) m.box(x, 14, 16, x, 16, 19, C.metal);
  const sheave = new Model(3, SHEAVE_R * 2 + 1, SHEAVE_R * 2 + 1);
  const c = SHEAVE_R;
  for (let z = 0; z <= 2 * c; z++)
    for (let y = 0; y <= 2 * c; y++) {
      const dd = Math.hypot(y - c, z - c);
      if (dd > c + 0.3) continue;
      const rim = dd > c - 1.2;
      const spoke = Math.abs(y - c) < 0.6 || Math.abs(z - c) < 0.6;
      for (let x = 0; x < 3; x++) {
        if (x !== 1 && !rim && dd > 1.2) continue;
        sheave.set(x, y, z, rim ? C.steel : spoke || dd <= 1.2 ? C.safety_yellow : C.metal_dark);
      }
      if (!rim && spoke) sheave.set(1, y, z, C.safety_yellow);
    }
  sheave.set(1, 2 * c, c, C.safety_red); // marker so the spin reads
  const drum = new Model(6, 5, 5);
  for (let z = 0; z < 5; z++)
    for (let y = 0; y < 5; y++) {
      if (Math.hypot(y - 2, z - 2) > 2.4) continue;
      for (let x = 0; x < 6; x++)
        drum.set(
          x,
          y,
          z,
          x === 0 || x === 5 ? C.steel : (y + z + x) % 2 ? C.cable_black : C.steel_dark,
        );
    }
  drum.set(0, 4, 2, C.safety_red);
  const parts: AnimPart[] = [
    mount("sheave", sheave, [SHEAVE_AT[0], SHEAVE_AT[1] + 0.5, SHEAVE_AT[2]], "spin", {
      speed: 3,
      axis: "x",
      power: false,
    }),
    mount("drum", drum, [10, 16.5, 17.5], "spin", { speed: 2, axis: "x", power: false }),
  ];
  const v = visual(m, parts, []);
  v.scale = DOOR_SCALE;
  return v;
}

/** One cable segment (stretched along y by the elevator system). */
export function cableModel(): Model {
  return new Model(1, 4, 1).box(0, 0, 0, 0, 3, 0, C.cable_black);
}

/** Pit below the platform: walls just outside the 7 × 7 hole, 10 world units deep. */
export const PIT_W = PLATFORM_W + 2;
export const PIT_H = 40;

export function elevatorPitModel(): Model {
  const W = PIT_W;
  const R = W - 1;
  const m = new Model(W, PIT_H, W);
  for (let y = 0; y < PIT_H; y++)
    for (let t = 0; t < W; t++) {
      const n = hash3(t, y, 7);
      const c =
        y % 8 === 0 ? C.hazard_black : n < 0.08 ? C.rust : n < 0.35 ? C.concrete : C.concrete_dark;
      m.set(t, y, 0, c).set(t, y, R, c).set(0, y, t, c).set(R, y, t, c);
    }
  // Guide rails on the E/W walls, light strips every 2 world units.
  for (let y = 0; y < PIT_H; y++) {
    for (const z of [12, 17]) m.set(0, y, z, C.steel).set(R, y, z, C.steel);
    if (y % 8 === 4) for (const t of [5, 24]) m.set(t, y, 0, C.led_amber).set(t, y, R, C.led_amber);
  }
  m.box(1, 0, 1, R - 1, 0, R - 1, C.black);
  return m;
}

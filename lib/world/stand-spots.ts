/**
 * Stand spots, active sides and seat anchors (pure — no three, no DOM).
 * =====================================================================
 *
 * Where Jade stands to use an object, and which way she faces:
 *
 *  - Every object has a **footprint** in its own frame (the bounding box of
 *    its solid model columns, see `columnMask`) and a rotation in quarter
 *    turns (three.js `rotation.y = rot · π/2`; model front = local +z).
 *  - Its **active sides** come from a small table per model / kind (a
 *    console: front only; a table: all four; wall pieces: the side away
 *    from the wall; devices: the front plus every side with a screen).
 *    Each side yields a spot just outside the footprint at a comfortable
 *    reach (`STAND_GAP` from the face), facing the object. Long sides slide
 *    the spot along to where the player clicked.
 *  - Small loose things (pickups, notes, clutter on the floor) are
 *    **radial**: any direction works.
 *  - **Seats and beds** add an anchor: the seat contact point, the surface
 *    height and the seated / lying yaw; their spots are the approach spots
 *    she sits down from.
 *
 * The engine ranks the candidates (`candidateSpots`: the clicked side
 * first), drops blocked / unreachable ones and falls back to the nearest
 * reachable side by path length (`pickSpot`).
 *
 * Also here: `columnMask` / `maskCells` — per-column occupancy of a model
 * (rotated, scaled) rasterised into the fine collision cells.
 */
import type { VoxelGrid } from "@/lib/voxel/grid";
import { FINE, WALKER } from "@/lib/world/actor";

export type SideDir = "+z" | "+x" | "-z" | "-x";
export const ALL_SIDES: readonly SideDir[] = ["+z", "+x", "-z", "-x"];

/** Distance from an object's face to Jade's centre when she uses it (collision half-width + a little). */
export const STAND_GAP = WALKER.radius + 0.12;

/** Hips-to-top-of-head distance used to place the hips on a bed (world units). */
export const HIP_FROM_HEAD = 3.3;

const LOCAL: Record<SideDir, readonly [number, number]> = {
  "+z": [0, 1],
  "+x": [1, 0],
  "-z": [0, -1],
  "-x": [-1, 0],
};

// ── Frames ───────────────────────────────────────────────────────

/**
 * An object's footprint: centre (world), rotation (quarter turns) and the
 * local bounding box of its solid columns (world units, relative to the
 * centre, in the object's own frame).
 */
export interface Footprint {
  cx: number;
  cz: number;
  rot: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

function cs(rot: number): [number, number] {
  const a = (((rot % 4) + 4) % 4) * (Math.PI / 2);
  return [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
}

/** Local direction → world (same as three.js rotation.y). */
export function localToWorldDir(rot: number, lx: number, lz: number): [number, number] {
  const [c, s] = cs(rot);
  return [lx * c + lz * s, -lx * s + lz * c];
}

/** World direction → local. */
export function worldToLocalDir(rot: number, wx: number, wz: number): [number, number] {
  const [c, s] = cs(rot);
  return [wx * c - wz * s, wx * s + wz * c];
}

export function toWorld(fp: Footprint, lx: number, lz: number): [number, number] {
  const [x, z] = localToWorldDir(fp.rot, lx, lz);
  return [fp.cx + x, fp.cz + z];
}

export function toLocal(fp: Footprint, x: number, z: number): [number, number] {
  return worldToLocalDir(fp.rot, x - fp.cx, z - fp.cz);
}

/** Outward world normal of a side. */
export function sideNormal(fp: Footprint, dir: SideDir): [number, number] {
  const [lx, lz] = LOCAL[dir];
  return localToWorldDir(fp.rot, lx, lz);
}

/** Heading (radians, 0 = +z, like `Walker.facing`) of a world direction. */
export function headingOf(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** Distance from the centre to the face of `dir`, and the side's span along its tangent. */
function sideGeom(fp: Footprint, dir: SideDir): { face: number; t0: number; t1: number } {
  switch (dir) {
    case "+z":
      return { face: fp.z1, t0: fp.x0, t1: fp.x1 };
    case "-z":
      return { face: -fp.z0, t0: fp.x0, t1: fp.x1 };
    case "+x":
      return { face: fp.x1, t0: fp.z0, t1: fp.z1 };
    case "-x":
      return { face: -fp.x0, t0: fp.z0, t1: fp.z1 };
  }
}

/** Local point on `dir`'s outward line at `dist` from the centre, `t` along the tangent. */
function sidePoint(dir: SideDir, dist: number, t: number): [number, number] {
  switch (dir) {
    case "+z":
      return [t, dist];
    case "-z":
      return [t, -dist];
    case "+x":
      return [dist, t];
    case "-x":
      return [-dist, t];
  }
}

/** Tangent coordinate of a local point for a side. */
function tangentOf(dir: SideDir, lx: number, lz: number): number {
  return dir === "+z" || dir === "-z" ? lx : lz;
}

// ── Column masks & fine collision cells ──────────────────────────

/** Solid model columns (model voxel resolution) of a placed model. */
export interface ColumnMask {
  w: number;
  d: number;
  /** World units per model voxel. */
  scale: number;
  /** 1 = column blocks the walker. */
  cells: Uint8Array;
  /** Highest blocking voxel top (world units above the slab), 0 if none. */
  top: number;
  count: number;
}

export interface MaskPart {
  grid: VoxelGrid;
  /** Where the part's voxel (0, 0, 0) sits in the base model's voxel frame. */
  offset: readonly [number, number, number];
}

export interface MaskOptions {
  /** Lift of the model above the slab (world units). */
  elevation?: number;
  /** Voxels whose bottom is at or above this height (world) never block (walker height). */
  headroom?: number;
  /** Extra grids at rest pose (animated parts). */
  parts?: readonly MaskPart[];
  /** Drop isolated single columns (stray voxels) so she does not snag on them. */
  cleanup?: boolean;
}

/**
 * Per-column occupancy of a model: a column blocks when any voxel in it
 * starts below head height. Overhangs above her head (shelves on a wall,
 * hanging lamps) never block the floor below.
 */
export function columnMask(grid: VoxelGrid, scale: number, opts: MaskOptions = {}): ColumnMask {
  const w = grid.sx;
  const d = grid.sz;
  const elev = opts.elevation ?? 0;
  const head = opts.headroom ?? WALKER.height;
  const cells = new Uint8Array(w * d);
  let top = 0;
  const visit = (x: number, y: number, z: number): void => {
    if (x < 0 || z < 0 || x >= w || z >= d) return;
    const y0 = elev + y * scale;
    if (y0 >= head) return;
    cells[x + z * w] = 1;
    top = Math.max(top, y0 + scale);
  };
  grid.forEach((x, y, z) => visit(x, y, z));
  for (const p of opts.parts ?? []) {
    const [ox, oy, oz] = p.offset;
    p.grid.forEach((x, y, z) => visit(Math.floor(x + ox), Math.floor(y + oy), Math.floor(z + oz)));
  }
  let count = 0;
  for (let i = 0; i < cells.length; i++) count += cells[i]!;
  if (opts.cleanup !== false && count > 6) {
    const drop: number[] = [];
    for (let z = 0; z < d; z++)
      for (let x = 0; x < w; x++) {
        if (!cells[x + z * w]) continue;
        const n =
          (x > 0 ? cells[x - 1 + z * w]! : 0) +
          (x < w - 1 ? cells[x + 1 + z * w]! : 0) +
          (z > 0 ? cells[x + (z - 1) * w]! : 0) +
          (z < d - 1 ? cells[x + (z + 1) * w]! : 0);
        if (n === 0) drop.push(x + z * w);
      }
    for (const i of drop) cells[i] = 0;
    count -= drop.length;
  }
  return { w, d, scale, cells, top, count };
}

/** Local bounding box (world units, relative to the model's bottom centre) of a mask; null if empty. */
export function maskBounds(m: ColumnMask): [number, number, number, number] | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let z = 0; z < m.d; z++)
    for (let x = 0; x < m.w; x++) {
      if (!m.cells[x + z * m.w]) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x + 1);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z + 1);
    }
  if (x0 === Infinity) return null;
  const s = m.scale;
  return [(x0 - m.w / 2) * s, (x1 - m.w / 2) * s, (z0 - m.d / 2) * s, (z1 - m.d / 2) * s];
}

/** Footprint of a placed model from its mask (falls back to the full model box). */
export function footprintOf(m: ColumnMask, cx: number, cz: number, rot: number): Footprint {
  const b = maskBounds(m) ?? [
    (-m.w / 2) * m.scale,
    (m.w / 2) * m.scale,
    (-m.d / 2) * m.scale,
    (m.d / 2) * m.scale,
  ];
  return { cx, cz, rot, x0: b[0], x1: b[1], z0: b[2], z1: b[3] };
}

/** Footprint from plain model dimensions (model voxels × scale). */
export function boxFootprint(
  w: number,
  d: number,
  scale: number,
  cx: number,
  cz: number,
  rot: number,
): Footprint {
  return {
    cx,
    cz,
    rot,
    x0: (-w / 2) * scale,
    x1: (w / 2) * scale,
    z0: (-d / 2) * scale,
    z1: (d / 2) * scale,
  };
}

/** World-space rectangle (x0, z0, x1, z1) that clips a mask (e.g. the old bbox footprint). */
export type ClipRect = readonly [number, number, number, number];

/**
 * Fine collision cells (FINE per world unit) covered by a placed mask: a
 * cell is solid when the model covers its centre (and, with `clip`, the
 * centre lies inside the clip rectangle). Returns fine-cell coordinates.
 */
export function maskCells(
  m: ColumnMask,
  cx: number,
  cz: number,
  rot: number,
  clip?: ClipRect,
): [number, number][] {
  const out: [number, number][] = [];
  if (!m.count) return out;
  const hw = (m.w * m.scale) / 2;
  const hd = (m.d * m.scale) / 2;
  const odd = ((rot % 4) + 4) % 2 === 1;
  const ex = odd ? hd : hw;
  const ez = odd ? hw : hd;
  const fx0 = Math.floor((cx - ex) * FINE);
  const fx1 = Math.ceil((cx + ex) * FINE);
  const fz0 = Math.floor((cz - ez) * FINE);
  const fz1 = Math.ceil((cz + ez) * FINE);
  for (let fz = fz0; fz < fz1; fz++)
    for (let fx = fx0; fx < fx1; fx++) {
      const px = (fx + 0.5) / FINE;
      const pz = (fz + 0.5) / FINE;
      if (clip && (px < clip[0] || pz < clip[1] || px >= clip[2] || pz >= clip[3])) continue;
      const [lx, lz] = worldToLocalDir(rot, px - cx, pz - cz);
      const i = Math.floor(lx / m.scale + m.w / 2);
      const k = Math.floor(lz / m.scale + m.d / 2);
      if (i < 0 || k < 0 || i >= m.w || k >= m.d) continue;
      if (m.cells[i + k * m.w]) out.push([fx, fz]);
    }
  return out;
}

// ── Seats & beds ─────────────────────────────────────────────────

export type SeatKind = "sit" | "lie";

/**
 * Seat geometry in model voxels (continuous coords: voxel i spans [i, i+1]).
 * Seats run along the model's x axis.
 */
export interface SeatDef {
  kind: SeatKind;
  /** Seat surface (sit) / mattress top (lie) above the model's floor, model voxels. */
  top: number;
  /** Sides she gets on from. */
  from: readonly SideDir[];
  /** Contact point depth behind the approach face (model voxels). */
  inset: number;
  /** Fixed seat places along x (sofa cushions)… */
  slots?: readonly number[];
  /** …or a free range along x (benches), clamped to the click. */
  range?: readonly [number, number];
  /** Lie: head end along x (model voxels) — she lies with her head toward −x. */
  headEnd?: number;
  /** Sit: height of a footrest (rail, chair base) above the model's floor, model voxels. */
  footrest?: number;
  /** Sit: how far a soft cushion gives under her (world units). */
  sink?: number;
}

/** Seats and beds by decor id (prop variants resolve to their decor). */
export const SEATS: Readonly<Record<string, SeatDef>> = {
  // Seats sit at Jade's knee height (≈ 1.0–1.25; her knee ≈ 1.1): thighs
  // level, feet flat on the floor (see rig.ts `sitFit`) — the contact point
  // is just behind the front face. Backrests at −z.
  sofa: { kind: "sit", top: 4, from: ["+z"], inset: 1.6, slots: [6.5, 13.5, 20.5], sink: 0.1 },
  armchair: { kind: "sit", top: 4, from: ["+z"], inset: 1.6, slots: [7], sink: 0.1 },
  // Office chair: low gas column, feet on the floor in front of the star base.
  swivel_chair: { kind: "sit", top: 5, from: ["+z"], inset: 3, slots: [6], sink: 0.1 },
  // Lab stool: no backrest, front and back, facing the way she came from.
  stool: { kind: "sit", top: 5, from: ["+z", "-z"], inset: 4, slots: [4], sink: 0.05 },
  // Wooden bench: no backrest, either long side.
  bench_long: {
    kind: "sit",
    top: 2,
    from: ["+z", "-z"],
    inset: 0.6,
    range: [2.5, 11.5],
    sink: 0.05,
  },
  // Perch on the edge of the canteen table (legs hang — the only seat where they do).
  canteen_table: { kind: "sit", top: 10, from: ["+z", "-z"], inset: 2, range: [3, 21] },
  // Beds: pillow at −x, get in from a long side.
  cot: { kind: "lie", top: 6, from: ["+z", "-z"], inset: 6, headEnd: 1 },
  bunk_bed: { kind: "lie", top: 4, from: ["+z", "-z"], inset: 3, headEnd: 1 },
  jade_bed: { kind: "lie", top: 4, from: ["+z", "-z"], inset: 3.5, headEnd: 1 },
};

/** Where she sits / lies: contact point, surface height and body yaw. */
export interface SeatAnchor {
  kind: SeatKind;
  /** Seat contact (sit) / hip point on the mattress (lie), world. */
  x: number;
  z: number;
  /** Surface height above the slab (world units). */
  y: number;
  /**
   * Root yaw while seated (radians, 0 = +z): sit → the direction she looks;
   * lie → her local +z (feet), so local −z (head) points at the pillow.
   */
  yaw: number;
  /** Sit: footrest height above the slab (world units; 0 = the floor). */
  footrest: number;
  /** Sit: how far the cushion gives (world units). */
  sink: number;
}

export interface SeatInfo {
  def: SeatDef;
  /** Model voxels → world. */
  scale: number;
  /** Model size (voxels). */
  w: number;
  d: number;
  /** Lift above the slab (world units). */
  elevation: number;
}

// ── Stand targets ────────────────────────────────────────────────

export interface SideSpec {
  dir: SideDir;
  /** Slide the spot along the side toward the click (long sides). */
  slide: boolean;
}

export interface StandTarget {
  fp: Footprint;
  /** Active sides; empty = radial (any direction). */
  sides: readonly SideSpec[];
  /** Radial: spot distance from the centre (world units). */
  radial?: number;
  seat?: SeatInfo;
  /** Align slide spots to this world point instead of the click (clutter on a desk). */
  alignTo?: readonly [number, number];
  /** Gap from the face (default STAND_GAP). */
  gap?: number;
}

export interface StandSpot {
  x: number;
  z: number;
  /** Heading toward the object (radians, 0 = +z). */
  facing: number;
  /** Outward unit normal (world) — push direction when the spot is blocked. */
  nx: number;
  nz: number;
  side: SideDir | null;
  seat?: SeatAnchor;
  /**
   * 0 = on the preferred (clicked) side — tried in order, the first free one
   * wins; 1 = elsewhere — the one with the shortest path wins.
   */
  tier?: 0 | 1;
}

/** Spots of a side longer than this slide along it toward the click. */
export const SLIDE_MIN = 3.2;

/** Step between alternative spots along one side (world units). */
export const ALONG_STEP = 0.8;

/**
 * A spot on side `dir`, aligned along the side to world point `hint` when
 * the side slides (else centred), shifted by `shift` along the side.
 */
export function spotForSide(
  t: StandTarget,
  dir: SideDir,
  slide: boolean,
  hint?: readonly [number, number],
  shift = 0,
): StandSpot {
  const fp = t.fp;
  const g = sideGeom(fp, dir);
  const gap = t.gap ?? STAND_GAP;
  const m = Math.min(WALKER.radius + 0.1, (g.t1 - g.t0) / 2);
  let along = (g.t0 + g.t1) / 2;
  if (slide && hint) {
    const [lx, lz] = toLocal(fp, hint[0], hint[1]);
    along = tangentOf(dir, lx, lz);
  }
  along = Math.min(g.t1 - m, Math.max(g.t0 + m, along + shift));
  const [lx, lz] = sidePoint(dir, g.face + gap, along);
  const [x, z] = toWorld(fp, lx, lz);
  const [nx, nz] = sideNormal(fp, dir);
  return { x, z, facing: headingOf(-nx, -nz), nx, nz, side: dir };
}

/**
 * The spot on a side plus alternatives shifted along it (nearest first),
 * for when something stands right in front of the preferred place.
 */
export function sideSpots(
  t: StandTarget,
  dir: SideDir,
  slide: boolean,
  hint?: readonly [number, number],
): StandSpot[] {
  const base = spotForSide(t, dir, slide, hint);
  const out = [base];
  const seen = new Set([`${base.x.toFixed(2)},${base.z.toFixed(2)}`]);
  for (let k = 1; k <= 8; k++)
    for (const sg of [1, -1]) {
      const s = spotForSide(t, dir, slide, hint, sg * k * ALONG_STEP);
      const key = `${s.x.toFixed(2)},${s.z.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  return out;
}

/** Radial spots (`n` directions) around a small object. */
export function radialSpots(t: StandTarget, n = 8): StandSpot[] {
  const r = t.radial ?? 1.4;
  const out: StandSpot[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const nx = Math.sin(a);
    const nz = Math.cos(a);
    out.push({
      x: t.fp.cx + nx * r,
      z: t.fp.cz + nz * r,
      facing: headingOf(-nx, -nz),
      nx,
      nz,
      side: null,
    });
  }
  return out;
}

/** Seat contact / anchor for an approach side and a place along the seat (model voxel x). */
export function seatAnchor(t: StandTarget, from: SideDir, alongVox: number): SeatAnchor {
  const s = t.seat!;
  const { def, scale, w, d } = s;
  // Contact in model voxels (x along the seat, z depth behind the approach face).
  let mx = alongVox;
  let mz: number;
  let mxAxis = true;
  switch (from) {
    case "+z":
      mz = d - def.inset;
      break;
    case "-z":
      mz = def.inset;
      break;
    case "+x":
      mxAxis = false;
      mz = alongVox;
      mx = w - def.inset;
      break;
    case "-x":
      mxAxis = false;
      mz = alongVox;
      mx = def.inset;
      break;
  }
  if (def.kind === "lie" && mxAxis) mx = (def.headEnd ?? 0) + HIP_FROM_HEAD / scale;
  const [x, z] = toWorld(t.fp, (mx - w / 2) * scale, (mz - d / 2) * scale);
  const y = s.elevation + def.top * scale;
  let yaw: number;
  if (def.kind === "lie") {
    // Head toward local −x of the bed: rig forward (+z, feet) = +x of the bed.
    const [hx, hz] = localToWorldDir(t.fp.rot, 1, 0);
    yaw = headingOf(hx, hz);
  } else {
    const [nx, nz] = sideNormal(t.fp, from);
    yaw = headingOf(nx, nz);
  }
  return {
    kind: def.kind,
    x,
    z,
    y,
    yaw,
    footrest: def.footrest ? s.elevation + def.footrest * scale : 0,
    sink: def.sink ?? 0,
  };
}

/** Approach spots of a seat (every approach side × place), each with its anchor. */
export function seatSpots(t: StandTarget, hint?: readonly [number, number]): StandSpot[] {
  const s = t.seat;
  if (!s) return [];
  const out: StandSpot[] = [];
  for (const from of s.def.from) {
    const alongAxisX = from === "+z" || from === "-z";
    const places: number[] = [];
    if (s.def.slots && alongAxisX) places.push(...s.def.slots);
    else if (s.def.range && alongAxisX) {
      const [a, b] = s.def.range;
      let v = (a + b) / 2;
      if (hint) {
        const [lx] = toLocal(t.fp, hint[0], hint[1]);
        v = lx / s.scale + s.w / 2;
      }
      places.push(Math.min(b, Math.max(a, v)));
    } else if (s.def.kind === "lie") places.push(0);
    else places.push(alongAxisX ? s.w / 2 : s.d / 2);
    for (const place of places) {
      const anchor = seatAnchor(t, from, place);
      // Stand in front of the contact point, just outside the face.
      const g = sideGeom(t.fp, from);
      const [clx, clz] = toLocal(t.fp, anchor.x, anchor.z);
      const along = Math.min(g.t1, Math.max(g.t0, tangentOf(from, clx, clz)));
      const [lx, lz] = sidePoint(from, g.face + (t.gap ?? STAND_GAP), along);
      const [x, z] = toWorld(t.fp, lx, lz);
      const [nx, nz] = sideNormal(t.fp, from);
      out.push({ x, z, facing: headingOf(-nx, -nz), nx, nz, side: from, seat: anchor });
    }
  }
  return out;
}

// ── Choosing ─────────────────────────────────────────────────────

export interface ClickHit {
  x: number;
  z: number;
  /** World face normal of the hit (optional). */
  nx?: number;
  ny?: number;
  nz?: number;
}

/**
 * Local direction of the clicked side: from the face normal when it is a
 * side face, else from where on the footprint the hit lies (top faces).
 * Null when the hit is too close to the middle to tell.
 */
export function clickedSide(fp: Footprint, hit: ClickHit): SideDir | null {
  if (hit.nx !== undefined && hit.nz !== undefined && Math.abs(hit.ny ?? 0) < 0.6) {
    const [lx, lz] = worldToLocalDir(fp.rot, hit.nx, hit.nz);
    if (Math.hypot(lx, lz) > 0.3)
      return Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? "+x" : "-x") : lz > 0 ? "+z" : "-z";
  }
  const [lx, lz] = toLocal(fp, hit.x, hit.z);
  const hx = Math.max(0.25, (fp.x1 - fp.x0) / 2);
  const hz = Math.max(0.25, (fp.z1 - fp.z0) / 2);
  const u = (lx - (fp.x0 + fp.x1) / 2) / hx;
  const v = (lz - (fp.z0 + fp.z1) / 2) / hz;
  if (Math.max(Math.abs(u), Math.abs(v)) < 0.3) return null;
  return Math.abs(u) > Math.abs(v) ? (u > 0 ? "+x" : "-x") : v > 0 ? "+z" : "-z";
}

function dirDot(a: SideDir, b: SideDir): number {
  const [ax, az] = LOCAL[a];
  const [bx, bz] = LOCAL[b];
  return ax * bx + az * bz;
}

/**
 * Candidate spots, best first. Tier 0: the clicked side (or the active side
 * closest to it in angle; without a click the side nearest the player) —
 * its spot, then the same side shifted along. Tier 1: every other spot.
 */
export function candidateSpots(
  t: StandTarget,
  player: readonly [number, number],
  hit?: ClickHit,
): StandSpot[] {
  const hint: readonly [number, number] | undefined =
    t.alignTo ?? (hit ? [hit.x, hit.z] : undefined);
  const dist = (s: StandSpot): number => Math.hypot(s.x - player[0], s.z - player[1]);
  const clicked = hit && !t.alignTo ? clickedSide(t.fp, hit) : null;
  if (t.seat || !t.sides.length) {
    const spots = t.seat ? seatSpots(t, hint ?? player) : radialSpots(t);
    const along = (s: StandSpot): number =>
      hint && t.seat ? Math.hypot(s.x - hint[0], s.z - hint[1]) : 0;
    const score = (s: StandSpot): number =>
      clicked && s.side
        ? -dirDot(s.side, clicked) * 1000 + along(s) * 10 + dist(s) * 0.01
        : along(s) * 10 + dist(s);
    return spots
      .map((s) => ({ s, k: score(s) }))
      .sort((a, b) => a.k - b.k)
      .map((e, i) => ({ ...e.s, tier: i === 0 ? (0 as const) : (1 as const) }));
  }
  // Rank the sides by their centre spot.
  const ranked = t.sides
    .map((sd) => {
      const c = spotForSide(t, sd.dir, sd.slide, hint ?? player);
      const k = clicked ? -dirDot(sd.dir, clicked) * 1000 + dist(c) * 0.01 : dist(c);
      return { sd, k };
    })
    .sort((a, b) => a.k - b.k);
  const out: StandSpot[] = [];
  ranked.forEach(({ sd }, i) => {
    for (const s of sideSpots(t, sd.dir, sd.slide, hint ?? player))
      out.push({ ...s, tier: i === 0 ? 0 : 1 });
  });
  return out;
}

/**
 * Pick the spot to walk to: the first reachable tier-0 candidate (the
 * clicked side), else the reachable one with the shortest path. `pathLength`
 * returns null for blocked / unreachable spots. With `lowerBound` (e.g. the
 * straight-line distance) the fallback stops early once no remaining spot
 * can beat the best path.
 */
export function pickSpot(
  cands: readonly StandSpot[],
  pathLength: (s: StandSpot) => number | null,
  lowerBound?: (s: StandSpot) => number,
): { spot: StandSpot; length: number } | null {
  if (!cands.length) return null;
  // Preferred side, in order (its own spot, then shifted along it).
  const preferred = cands.filter((c, i) => (c.tier ?? (i === 0 ? 0 : 1)) === 0);
  for (const c of preferred) {
    const len = pathLength(c);
    if (len !== null) return { spot: c, length: len };
  }
  // Else the nearest reachable spot anywhere else, by path length.
  const rest = cands.filter((c) => !preferred.includes(c));
  if (lowerBound) rest.sort((a, b) => lowerBound(a) - lowerBound(b));
  let best: { spot: StandSpot; length: number } | null = null;
  for (const c of rest) {
    if (best && lowerBound && lowerBound(c) >= best.length) break;
    const len = pathLength(c);
    if (len === null) continue;
    if (!best || len < best.length) best = { spot: c, length: len };
  }
  return best;
}

/**
 * Push a spot outward along its normal (0.1 steps, up to `max`) until
 * `free` holds — the fine collision may reach a little past the mask box.
 */
export function settleSpot(
  s: StandSpot,
  free: (x: number, z: number) => boolean,
  max = 0.8,
): StandSpot | null {
  for (let d = 0; d <= max + 1e-9; d += 0.1) {
    const x = s.x + s.nx * d;
    const z = s.z + s.nz * d;
    if (free(x, z)) return d === 0 ? s : { ...s, x, z };
  }
  return null;
}

// ── Side tables ──────────────────────────────────────────────────

const side = (dir: SideDir, slide = false): SideSpec => ({ dir, slide });
const FRONT: readonly SideSpec[] = [side("+z")];

/**
 * Decor with more than the front usable: free-standing, round or table-like
 * things. Everything else solid is used from its front; wall pieces from the
 * side away from the wall; loose floor clutter from anywhere (radial).
 */
const DECOR_ALL = new Set([
  "mug_table",
  "plant_ficus",
  "plant_fern",
  "plant_dusty",
  "coffee_shrub",
  "crystal_cluster",
  "drone_parked",
  "containment_pod",
  "holo_table",
  "foucault_pendulum",
  "armillary",
  "mine_cart",
  "algae_tank",
  "lab_table",
  "telescope",
  "antenna_mast",
  "chess_board",
]);
/** Long pieces used from both long sides. */
const DECOR_FRONT_BACK = new Set(["planter", "ergometer", "canteen_table"]);

export interface DecorSideInput {
  id: string;
  solid: boolean;
  wall: boolean;
  /** Model size in world units (unrotated). */
  w: number;
  d: number;
}

/** Active sides of a decor piece (empty = radial). */
export function decorSides(p: DecorSideInput): SideSpec[] {
  const slideX = p.w >= SLIDE_MIN;
  const slideZ = p.d >= SLIDE_MIN;
  if (p.wall) return [side("+z", slideX)];
  if (!p.solid) return [];
  if (DECOR_ALL.has(p.id))
    return [side("+z", slideX), side("-z", slideX), side("+x", slideZ), side("-x", slideZ)];
  if (DECOR_FRONT_BACK.has(p.id)) return [side("+z", slideX), side("-z", slideX)];
  return [side("+z", slideX)];
}

/** Active sides of a map prop by model (props with a decor variant use `decorSides`). */
export function propSides(model: string, w: number, d: number): SideSpec[] {
  const slideX = w >= SLIDE_MIN;
  const slideZ = d >= SLIDE_MIN;
  switch (model) {
    case "bench":
      return [side("+z", slideX), side("+x"), side("-x")];
    case "valve":
    case "plant":
    case "barrel":
    case "pipe":
    case "lamp":
      return ALL_SIDES.map((s) => side(s, s === "+z" || s === "-z" ? slideX : slideZ));
    case "forge":
      return [side("+z"), side("+x"), side("-x")];
    case "board":
      return [side("+z", slideX)];
    default:
      // bigterminal, console, pult, desk, rack, junction, chair, sofa …: front only.
      return [...FRONT];
  }
}

/**
 * Active sides of a device: the front plus every side with a screen; a
 * roughly square device with a top screen is used from all sides. Very
 * wide fronts slide toward the click (several screens).
 */
export function deviceSides(
  screens: readonly { normal: string }[],
  w: number,
  d: number,
): SideSpec[] {
  const dirs = new Set<SideDir>(["+z"]);
  for (const s of screens)
    if (s.normal === "+x" || s.normal === "-x" || s.normal === "-z" || s.normal === "+z")
      dirs.add(s.normal);
  const square = Math.abs(w - d) <= Math.max(w, d) * 0.25;
  if (screens.some((s) => s.normal === "+y") && square) for (const s of ALL_SIDES) dirs.add(s);
  return ALL_SIDES.filter((s) => dirs.has(s)).map((s) =>
    side(s, (s === "+z" || s === "-z" ? w : d) >= 8),
  );
}

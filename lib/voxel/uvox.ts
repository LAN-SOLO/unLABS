/**
 * uvox — the lossless voxel interchange format of the voxel pipeline
 * (docs/VOXEL-BLENDER.md). The game exports its models as uvox, Blender
 * (scripts/voxel/blender/voxelgod) clones them voxel for voxel and writes
 * uvox back; a round trip is bit-identical (`sha` over the raw cells).
 *
 * Conventions (same as the game):
 * - axes: x right, y up, z towards the viewer; index = x + sx · (y + sy · z)
 * - cell value 0 = empty, 1..255 = the GAME palette index (kept as is, so a
 *   clone never re-quantises colours); `palette` documents every used index
 * - placement in the assembly frame (world units):
 *   world(p) = origin + Ry(rotY) · ((p − anchor) · unit)
 *   with `p` in the model's voxel coordinates and `anchor` the model point
 *   that sits on `origin` (engine meshes centred in x/z: [sx/2, 0, sz/2])
 *
 * Grid operations here are exact on the lattice: integer upsampling,
 * quarter turns, mirrors, and combining models of different voxel sizes
 * onto a common lattice (`combine`) — a voxel stays a voxel at every size.
 *
 * Pure, no world imports.
 */
import { VoxelGrid } from "@/lib/voxel/grid";

export type UvoxMaterial = "solid" | "glass" | "emit" | "metal";

export interface UvoxPaletteEntry {
  /** Game palette index (the cell value). */
  index: number;
  /** sRGB 0..255. */
  rgb: [number, number, number];
  mat: UvoxMaterial;
  name: string;
}

export interface UvoxModel {
  format: "uvox";
  version: 1;
  id: string;
  size: [number, number, number];
  /** World units per voxel edge. */
  unit: number;
  origin: [number, number, number];
  /** Model point (voxel units) placed on `origin`. */
  anchor: [number, number, number];
  /** Rotation about +y (radians, three.js sense) around `origin`. */
  rotY: number;
  palette: UvoxPaletteEntry[];
  /** Run-length pairs [value, count, value, count, …] over the cells (x fastest). */
  runs: number[];
  /** `gridSha` of the cells: equal sha = identical voxels. */
  sha: string;
  meta?: Record<string, unknown>;
}

/** Several voxel models placed in one frame (an assembly — e.g. a door). */
export interface UvoxScene {
  format: "uvox-scene";
  version: 1;
  id: string;
  parts: UvoxModel[];
  meta?: Record<string, unknown>;
}

export interface PaletteSource {
  rgb(index: number): [number, number, number];
  mat(index: number): UvoxMaterial;
  name(index: number): string;
}

/**
 * Content id of a grid: two FNV-1a lanes (32 bit each) over the header
 * `"<sx>x<sy>x<sz>:"` and the raw cells → 16 hex chars. Equal sha = identical
 * voxels. Mirrored bit for bit in scripts/voxel/blender/voxelgod/uvox.py.
 */
export function gridSha(grid: VoxelGrid): string {
  let a = 0x811c9dc5 | 0;
  let b = 0x01000193 ^ 0x5bd1e995;
  const eat = (byte: number): void => {
    a = Math.imul(a ^ byte, 0x01000193);
    b = Math.imul(b ^ (byte ^ 0xa5), 0x01000193);
  };
  for (const ch of `${grid.sx}x${grid.sy}x${grid.sz}:`) eat(ch.charCodeAt(0));
  for (const v of grid.data) eat(v);
  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, "0");
  return hex(a) + hex(b);
}

export function encodeRuns(data: Uint8Array): number[] {
  const runs: number[] = [];
  for (let i = 0; i < data.length; ) {
    let j = i + 1;
    while (j < data.length && data[j] === data[i]) j++;
    runs.push(data[i]!, j - i);
    i = j;
  }
  return runs;
}

export function decodeRuns(runs: readonly number[], n: number): Uint8Array {
  const out = new Uint8Array(n);
  let o = 0;
  for (let k = 0; k < runs.length; k += 2) {
    const v = runs[k]!;
    const c = runs[k + 1]!;
    if (o + c > n) throw new Error("uvox: runs overflow the grid");
    if (v) out.fill(v, o, o + c);
    o += c;
  }
  if (o !== n) throw new Error(`uvox: runs cover ${o} of ${n} cells`);
  return out;
}

export function toUvox(
  id: string,
  grid: VoxelGrid,
  palette: PaletteSource,
  opts: {
    unit: number;
    origin?: [number, number, number];
    anchor?: [number, number, number];
    rotY?: number;
    meta?: Record<string, unknown>;
  },
): UvoxModel {
  const used = new Set<number>();
  for (const v of grid.data) if (v) used.add(v);
  return {
    format: "uvox",
    version: 1,
    id,
    size: [grid.sx, grid.sy, grid.sz],
    unit: opts.unit,
    origin: opts.origin ?? [0, 0, 0],
    anchor: opts.anchor ?? [0, 0, 0],
    rotY: opts.rotY ?? 0,
    palette: [...used]
      .sort((a, b) => a - b)
      .map((index) => ({
        index,
        rgb: palette.rgb(index),
        mat: palette.mat(index),
        name: palette.name(index),
      })),
    runs: encodeRuns(grid.data),
    sha: gridSha(grid),
    ...(opts.meta ? { meta: opts.meta } : {}),
  };
}

export function fromUvox(m: UvoxModel): VoxelGrid {
  const [sx, sy, sz] = m.size;
  const g = new VoxelGrid(sx, sy, sz, decodeRuns(m.runs, sx * sy * sz));
  const sha = gridSha(g);
  if (sha !== m.sha) throw new Error(`uvox ${m.id}: sha ${sha} ≠ ${m.sha}`);
  return g;
}

// ── Exact lattice operations ─────────────────────────────────────

/** Every voxel becomes k×k×k voxels (same shape, finer lattice). */
export function upsample(grid: VoxelGrid, k: number): VoxelGrid {
  if (!Number.isInteger(k) || k < 1) throw new Error("upsample: k must be a positive integer");
  if (k === 1) return grid;
  const out = new VoxelGrid(grid.sx * k, grid.sy * k, grid.sz * k);
  grid.forEach((x, y, z, v) =>
    out.fill([x * k, y * k, z * k], [x * k + k, y * k + k, z * k + k], v),
  );
  return out;
}

/** Quarter turns about +y (counter-clockwise seen from above, like three.js rotation.y). */
export function rotateY90(grid: VoxelGrid, turns: number): VoxelGrid {
  const t = ((turns % 4) + 4) % 4;
  if (t === 0) return grid;
  const odd = t % 2 === 1;
  const out = new VoxelGrid(odd ? grid.sz : grid.sx, grid.sy, odd ? grid.sx : grid.sz);
  grid.forEach((x, y, z, v) => {
    // Rotation by +90° about y maps (x, z) → (z, −x).
    let nx = x;
    let nz = z;
    for (let i = 0; i < t; i++) {
      const w = i % 2 === 0 ? grid.sx : grid.sz;
      [nx, nz] = [nz, w - 1 - nx];
    }
    out.set(nx, y, nz, v);
  });
  return out;
}

export function mirror(grid: VoxelGrid, axis: "x" | "y" | "z"): VoxelGrid {
  const out = new VoxelGrid(grid.sx, grid.sy, grid.sz);
  grid.forEach((x, y, z, v) =>
    out.set(
      axis === "x" ? grid.sx - 1 - x : x,
      axis === "y" ? grid.sy - 1 - y : y,
      axis === "z" ? grid.sz - 1 - z : z,
      v,
    ),
  );
  return out;
}

/** A model placed on a lattice: grid + voxel size + corner position (world units). */
export interface Placed {
  grid: VoxelGrid;
  unit: number;
  origin: [number, number, number];
}

const EPS = 1e-6;
function ratio(a: number, b: number): number | null {
  const r = a / b;
  return Math.abs(r - Math.round(r)) < EPS ? Math.round(r) : null;
}

/**
 * Merge models of different voxel sizes into one grid on the lattice of
 * `unit` (default: the finest unit). Exact or it throws: every model's unit
 * must be an integer multiple of `unit` and every origin must sit on the
 * lattice — no resampling, no rounding, every source voxel becomes k³
 * target voxels. Later models win where they overlap.
 */
export function combine(
  parts: readonly Placed[],
  unit = Math.min(...parts.map((p) => p.unit)),
): Placed {
  const lo: [number, number, number] = [Infinity, Infinity, Infinity];
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const scaled = parts.map((p) => {
    const k = ratio(p.unit, unit);
    if (k === null) throw new Error(`combine: unit ${p.unit} is not a multiple of ${unit}`);
    const cell = p.origin.map((o) => ratio(o, unit));
    if (cell.some((c) => c === null))
      throw new Error(`combine: origin ${p.origin.join(",")} is off the ${unit} lattice`);
    const g = upsample(p.grid, k);
    const c = cell as [number, number, number];
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, c[i]!);
      hi[i] = Math.max(hi[i]!, c[i]! + [g.sx, g.sy, g.sz][i]!);
    }
    return { g, c };
  });
  const out = new VoxelGrid(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  for (const { g, c } of scaled)
    g.forEach((x, y, z, v) => out.set(x + c[0] - lo[0], y + c[1] - lo[1], z + c[2] - lo[2], v));
  return { grid: out, unit, origin: [lo[0] * unit, lo[1] * unit, lo[2] * unit] };
}

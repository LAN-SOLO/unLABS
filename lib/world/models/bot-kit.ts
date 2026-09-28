/**
 * Fine-scale build kit for characters and lore bots (pure — no three).
 * ====================================================================
 *
 * Bots, the MCP avatar and the humanoid rigs are authored at the refined
 * resolution: half the voxel edge of their old models (BOT_SCALE 0.125,
 * CHARACTER_SCALE 0.09) with twice the voxel counts per axis, so they keep
 * their world size. They are flagged `fine` and meshed as authored (refine
 * family "hires"), so every detail here is placed by hand instead of by
 * the generic 2×2×2 refinement rules: chamfered casings with highlight
 * lines, grooved panel seams, screws, grilles, pixel-art faces, stencilled
 * ids, cable runs and deterministic weathering.
 *
 * Coordinates follow core's convention: voxel INDICES for drawing (a centre
 * between two voxels is written as x.5), front = +z. Face helpers are the
 * detail kit's (`faceRect`, `seam`, `stencil`, … in anim.ts).
 */
import { C } from "@/lib/world/content/palette";
import {
  faceSet,
  facePaint,
  faceXYZ,
  hash3,
  stud,
  type Face,
  type Vec3,
} from "@/lib/world/models/anim";
import { Model } from "@/lib/world/models/core";

// ── Casings ──────────────────────────────────────────────────────

export interface CasingOpts {
  /** Chamfer width in voxels (default 1). */
  r?: number;
  /** Colour of the voxels along the new bevel (highlight / worn edge line). */
  edge?: number;
  /** Chamfer the bottom edges too (default false: the casing sits on something). */
  bottom?: boolean;
  /** Chamfer the vertical edges (default true). */
  vertical?: boolean;
  /** Chamfer the top edges (default true). */
  top?: boolean;
}

/**
 * Box with chamfered edges: along every chamfered edge the voxels with
 * `da + db < r` (distances to the two faces) are cut, the next diagonal
 * (`da + db == r`) gets the `edge` colour, so casings read as pressed /
 * rounded sheet metal instead of sharp blocks.
 */
export function casing(
  m: Model,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  body: number,
  o: CasingOpts = {},
): void {
  const r = o.r ?? 1;
  const top = o.top ?? true;
  const bottom = o.bottom ?? false;
  const vertical = o.vertical ?? true;
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = Math.min(x - x0, x1 - x);
        const dz = Math.min(z - z0, z1 - z);
        const dyt = y1 - y;
        const dyb = y - y0;
        let cut = false;
        let rim = false;
        const pair = (a: number, b: number): void => {
          if (a + b < r) cut = true;
          else if (a + b === r) rim = true;
        };
        if (vertical) pair(dx, dz);
        if (top) {
          pair(dx, dyt);
          pair(dz, dyt);
        }
        if (bottom) {
          pair(dx, dyb);
          pair(dz, dyb);
        }
        if (cut) continue;
        m.set(x, y, z, rim && o.edge !== undefined ? o.edge : body);
      }
}

/** Vertical cylinder with a chamfered top rim (and bottom rim when `bottom`). */
export function drum(
  m: Model,
  cx: number,
  cz: number,
  r: number,
  y0: number,
  y1: number,
  body: number,
  rim?: number,
  bottom = false,
): void {
  for (let y = y0; y <= y1; y++) {
    const shrink = (y === y1 || (bottom && y === y0)) && r > 2 ? 1 : 0;
    m.cyl(cx, cz, r - shrink, y, y, body);
    if (rim === undefined || !(y === y1 - 1 || (bottom && y === y0 + 1))) continue;
    // Rim line: recolour the outer shell of this row (never grows the silhouette).
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if (m.grid.get(x, y, z) && Math.hypot(x - cx, z - cz) >= r - 1.1) m.set(x, y, z, rim);
  }
}

// ── Surface detail ───────────────────────────────────────────────

/** Painted line (only on solid voxels) along an inclusive face rect. */
export function paint(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  c: number,
): void {
  for (let v = Math.min(v0, v1); v <= Math.max(v0, v1); v++)
    for (let u = Math.min(u0, u1); u <= Math.max(u0, u1); u++) facePaint(m, face, at, u, v, c);
}

/** Proud screw heads (fall back to a painted dot where the grid has no room). */
export function screwsAt(
  m: Model,
  face: Face,
  at: number,
  pts: readonly (readonly [number, number])[],
  c: number = C.chrome,
): void {
  for (const [u, v] of pts) stud(m, face, at, u, v, c);
}

/** Flush screw heads with a slot (painted: a light head and a dark slot pixel beside it). */
export function flushScrews(
  m: Model,
  face: Face,
  at: number,
  pts: readonly (readonly [number, number])[],
  head: number = C.chrome,
): void {
  for (const [u, v] of pts) facePaint(m, face, at, u, v, head);
}

/**
 * ASCII pixel art on a face: `rows` top → bottom, `u` grows along the row.
 * `.` or space leaves the voxel alone; other characters map through `pal`.
 * d = 0 paints only solid voxels; d ≠ 0 sets voxels at that depth.
 */
export function pixels(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  vTop: number,
  rows: readonly string[],
  pal: Readonly<Record<string, number>>,
  d = 0,
): void {
  rows.forEach((row, r) => {
    for (let k = 0; k < row.length; k++) {
      const ch = row[k]!;
      if (ch === "." || ch === " ") continue;
      const c = pal[ch];
      if (c === undefined) continue;
      if (d === 0) facePaint(m, face, at, u0 + k, vTop - r, c);
      else faceSet(m, face, at, u0 + k, vTop - r, d, c);
    }
  });
}

/**
 * A flat part model (1 voxel deep, facing +z) from ASCII rows (top → bottom).
 * `0` carves nothing (transparent), other characters map through `pal`.
 */
export function sprite(rows: readonly string[], pal: Readonly<Record<string, number>>): Model {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const m = new Model(w, h, 1);
  rows.forEach((row, r) => {
    for (let k = 0; k < row.length; k++) {
      const c = pal[row[k]!];
      if (c) m.set(k, h - 1 - r, 0, c);
    }
  });
  return m;
}

/** Recessed pixel screen: carve the rect `depth` deep, fill the back with `bg`. */
export function recess(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  depth: number,
  bg: number,
): void {
  for (let v = v0; v <= v1; v++)
    for (let u = u0; u <= u1; u++) {
      for (let d = 0; d < depth; d++) faceSet(m, face, at, u, v, d, 0);
      faceSet(m, face, at, u, v, depth, bg);
    }
}

/** Alternate rows of a screen rect dimmed (fine CRT scanlines), only where `fg` pixels are lit. */
export function scanlines(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  depth: number,
  bg: number,
  dim: number,
): void {
  for (let v = v0; v <= v1; v += 2)
    for (let u = u0; u <= u1; u++) {
      const [x, y, z] = faceXYZ(face, at, u, v, depth);
      if (m.grid.get(x, y, z) === bg) m.set(x, y, z, dim);
    }
}

// ── Weathering ───────────────────────────────────────────────────

export interface WeatherOpts {
  /** Chance of a rust pit on an exposed metal voxel (0..1). */
  rust?: number;
  /** Chance of a chipped-paint highlight on an exposed casing edge voxel. */
  chips?: number;
  /** Chipped paint colour (bare metal). */
  chip?: number;
  /** Colours that weather (defaults: every colour except emissives / screens). */
  only?: ReadonlySet<number>;
  seed?: number;
}

/**
 * Deterministic weathering on exposed surface voxels: rust pits and bare
 * metal chips where two faces meet (edges wear first). Only recolours.
 */
export function weather(m: Model, o: WeatherOpts): void {
  const g = m.grid;
  const seed = o.seed ?? 0;
  const edits: [number, number, number, number][] = [];
  g.forEach((x, y, z, v) => {
    if (o.only && !o.only.has(v)) return;
    let open = 0;
    if (!g.get(x + 1, y, z)) open++;
    if (!g.get(x - 1, y, z)) open++;
    if (!g.get(x, y + 1, z)) open++;
    if (!g.get(x, y, z + 1)) open++;
    if (!g.get(x, y, z - 1)) open++;
    if (!open) return;
    const n = hash3(x + seed * 17, y - seed * 5, z + seed * 3);
    if (o.chips && open >= 2 && n < o.chips) edits.push([x, y, z, o.chip ?? C.steel]);
    else if (o.rust && n > 1 - o.rust)
      edits.push([x, y, z, n > 1 - o.rust * 0.35 ? C.iron_rust : C.rust]);
  });
  for (const [x, y, z, c] of edits) m.set(x, y, z, c);
}

/** Every voxel of colour `from` inside the box becomes `to` (recolour a region). */
export function recolorBox(
  m: Model,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  from: number,
  to: number,
): void {
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) if (m.grid.get(x, y, z) === from) m.set(x, y, z, to);
}

/** Straight cable between two voxel points (axis steps: x, then y, then z). */
export function cable(m: Model, a: Vec3, b: Vec3, c: number): void {
  const [x0, y0, z0] = a;
  const [x1, y1, z1] = b;
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) m.set(x, y0, z0, c);
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) m.set(x1, y, z0, c);
  for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) m.set(x1, y1, z, c);
}

/** Mirror a model in x (left ↔ right). */
export function mirrorModelX(src: Model): Model {
  const out = new Model(src.w, src.h, src.d);
  src.grid.forEach((x, y, z, v) => out.set(src.w - 1 - x, y, z, v));
  return out;
}

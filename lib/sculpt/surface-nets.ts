/**
 * Surface nets — smooth meshes from signed distance fields (pure — no three).
 * ===========================================================================
 *
 * The clarity renderer's mesher: where the voxel mesher emits one cube
 * face per voxel side, surface nets place one vertex per grid cell the
 * surface passes through (the mean of its edge crossings) and connect the
 * four cells around every crossing edge with a quad. The result is a
 * watertight, smooth surface whose resolution is just the sampling cell —
 * the same field can be meshed coarse (a distant bot) or fine (Jade's face).
 *
 * Normals come from the field's gradient, not from the triangles, so
 * shading stays smooth even at a coarse cell.
 *
 * Sampling is sparse: the grid is visited in 8³ blocks and a block whose
 * centre lies farther from the surface than its own radius is filled with
 * that distance (only the sign matters there) — a body's bounding box is
 * mostly air, this skips ~80 % of the field evaluations. It needs a field
 * that never over-estimates the distance by much (`margin` absorbs the
 * slack of ellipsoids, smooth unions and small displacements).
 */
import type { Sdf, Vec3 } from "@/lib/sculpt/sdf";

export interface SurfaceBounds {
  min: Vec3;
  max: Vec3;
  /** Edge length of one sampling cell (same units as the field). */
  cell: number;
}

export interface SurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface SurfaceOptions {
  /** Safety factor on the empty-block test (default 1.5). */
  margin?: number;
  /** Gradient step as a fraction of the cell (default 0.5). */
  normalStep?: number;
}

const BLOCK = 8;

/** Corner offsets of a cell, bit i of the index = axis i. */
const CORNERS: readonly [number, number, number][] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];

/** The 12 cell edges as corner index pairs. */
const EDGES: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < 8; i++)
    for (let d = 0; d < 3; d++) {
      const j = i | (1 << d);
      if (j !== i) out.push([i, j]);
    }
  return out;
})();

/** Sample `sdf` on the corner grid of `b` (x fastest), skipping empty blocks. */
export function sampleField(
  sdf: Sdf,
  b: SurfaceBounds,
  margin = 1.5,
): { values: Float32Array; dims: [number, number, number] } {
  const nx = Math.max(2, Math.ceil((b.max[0] - b.min[0]) / b.cell) + 1);
  const ny = Math.max(2, Math.ceil((b.max[1] - b.min[1]) / b.cell) + 1);
  const nz = Math.max(2, Math.ceil((b.max[2] - b.min[2]) / b.cell) + 1);
  const values = new Float32Array(nx * ny * nz);
  const [ox, oy, oz] = b.min;
  const c = b.cell;
  const radius = ((BLOCK * c) / 2) * Math.sqrt(3);
  for (let bz = 0; bz < nz; bz += BLOCK)
    for (let by = 0; by < ny; by += BLOCK)
      for (let bx = 0; bx < nx; bx += BLOCK) {
        const ex = Math.min(nx, bx + BLOCK + 1);
        const ey = Math.min(ny, by + BLOCK + 1);
        const ez = Math.min(nz, bz + BLOCK + 1);
        const cx = ox + ((bx + ex - 1) / 2) * c;
        const cy = oy + ((by + ey - 1) / 2) * c;
        const cz = oz + ((bz + ez - 1) / 2) * c;
        const d = sdf(cx, cy, cz);
        if (Math.abs(d) > radius * margin + c) {
          for (let z = bz; z < ez; z++)
            for (let y = by; y < ey; y++) {
              const row = (z * ny + y) * nx;
              for (let x = bx; x < ex; x++) values[row + x] = d;
            }
          continue;
        }
        for (let z = bz; z < ez; z++)
          for (let y = by; y < ey; y++) {
            const row = (z * ny + y) * nx;
            for (let x = bx; x < ex; x++) values[row + x] = sdf(ox + x * c, oy + y * c, oz + z * c);
          }
      }
  return { values, dims: [nx, ny, nz] };
}

/**
 * Surface nets over sampled values (x fastest, `dims` samples per axis,
 * sample i at `min + i * cell`): vertex positions and triangles, no normals.
 */
export function netsFromValues(
  values: ArrayLike<number>,
  dims: readonly [number, number, number],
  min: Vec3,
  cell: number,
): { positions: Float32Array; indices: Uint32Array } {
  const [nx, ny, nz] = dims;
  const cx = nx - 1;
  const cy = ny - 1;
  const cz = nz - 1;
  const cellVert = new Int32Array(cx * cy * cz).fill(-1);
  let pos = new Float32Array(4096 * 3);
  let nv = 0;
  const c = cell;
  const [ox, oy, oz] = min;
  const v = new Float64Array(8);

  for (let z = 0; z < cz; z++)
    for (let y = 0; y < cy; y++)
      for (let x = 0; x < cx; x++) {
        let mask = 0;
        for (let i = 0; i < 8; i++) {
          const o = CORNERS[i]!;
          const val = values[((z + o[2]) * ny + (y + o[1])) * nx + (x + o[0])]!;
          v[i] = val;
          if (val < 0) mask |= 1 << i;
        }
        if (mask === 0 || mask === 0xff) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, bb] of EDGES) {
          const va = v[a]!;
          const vb = v[bb]!;
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const ca = CORNERS[a]!;
          const cb = CORNERS[bb]!;
          sx += ca[0] + (cb[0] - ca[0]) * t;
          sy += ca[1] + (cb[1] - ca[1]) * t;
          sz += ca[2] + (cb[2] - ca[2]) * t;
          n++;
        }
        if ((nv + 1) * 3 > pos.length) {
          const g = new Float32Array(pos.length * 2);
          g.set(pos);
          pos = g;
        }
        pos[nv * 3] = ox + (x + sx / n) * c;
        pos[nv * 3 + 1] = oy + (y + sy / n) * c;
        pos[nv * 3 + 2] = oz + (z + sz / n) * c;
        cellVert[(z * cy + y) * cx + x] = nv++;
      }

  // Faces: every grid edge with a sign change is shared by four cells.
  let idx = new Uint32Array(8192 * 3);
  let ni = 0;
  const cellAt = (x: number, y: number, z: number) => cellVert[(z * cy + y) * cx + x]!;
  const push = (a: number, b2: number, c2: number) => {
    if (ni + 3 > idx.length) {
      const g = new Uint32Array(idx.length * 2);
      g.set(idx);
      idx = g;
    }
    idx[ni++] = a;
    idx[ni++] = b2;
    idx[ni++] = c2;
  };
  for (let z = 0; z < cz; z++)
    for (let y = 0; y < cy; y++)
      for (let x = 0; x < cx; x++) {
        const v0 = values[(z * ny + y) * nx + x]!;
        const inside = v0 < 0;
        // Edge along +x from corner (x,y,z): cells (x, y-1..y, z-1..z).
        if (y > 0 && z > 0) {
          const v1 = values[(z * ny + y) * nx + x + 1]!;
          if (inside !== v1 < 0)
            quad(
              cellAt(x, y, z),
              cellAt(x, y - 1, z),
              cellAt(x, y - 1, z - 1),
              cellAt(x, y, z - 1),
              inside,
            );
        }
        // Edge along +y: cells (x-1..x, y, z-1..z).
        if (x > 0 && z > 0) {
          const v1 = values[(z * ny + y + 1) * nx + x]!;
          if (inside !== v1 < 0)
            quad(
              cellAt(x, y, z),
              cellAt(x, y, z - 1),
              cellAt(x - 1, y, z - 1),
              cellAt(x - 1, y, z),
              inside,
            );
        }
        // Edge along +z: cells (x-1..x, y-1..y, z).
        if (x > 0 && y > 0) {
          const v1 = values[((z + 1) * ny + y) * nx + x]!;
          if (inside !== v1 < 0)
            quad(
              cellAt(x, y, z),
              cellAt(x - 1, y, z),
              cellAt(x - 1, y - 1, z),
              cellAt(x, y - 1, z),
              inside,
            );
        }
      }

  function quad(a: number, b2: number, c2: number, d: number, flip: boolean): void {
    if (a < 0 || b2 < 0 || c2 < 0 || d < 0) return;
    if (flip) {
      push(a, b2, c2);
      push(a, c2, d);
    } else {
      push(a, c2, b2);
      push(a, d, c2);
    }
  }

  return { positions: pos.slice(0, nv * 3), indices: idx.slice(0, ni) };
}

/** Mesh the zero level set of `sdf` inside `b`. */
export function surfaceNets(sdf: Sdf, b: SurfaceBounds, opts: SurfaceOptions = {}): SurfaceMesh {
  const { values, dims } = sampleField(sdf, b, opts.margin ?? 1.5);
  const { positions, indices } = netsFromValues(values, dims, b.min, b.cell);
  const c = b.cell;
  const nv = positions.length / 3;
  const normals = new Float32Array(nv * 3);
  const e = c * (opts.normalStep ?? 0.5);
  for (let i = 0; i < nv; i++) {
    const px = positions[i * 3]!;
    const py = positions[i * 3 + 1]!;
    const pz = positions[i * 3 + 2]!;
    const gx = sdf(px + e, py, pz) - sdf(px - e, py, pz);
    const gy = sdf(px, py + e, pz) - sdf(px, py - e, pz);
    const gz = sdf(px, py, pz + e) - sdf(px, py, pz - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    normals[i * 3] = gx / l;
    normals[i * 3 + 1] = gy / l;
    normals[i * 3 + 2] = gz / l;
  }
  return { positions, normals, indices };
}

/**
 * Pull every vertex onto the surface along the gradient (one Newton step):
 * surface nets place vertices at the mean of edge crossings, which sits a
 * little inside convex curves — projecting restores exact silhouettes.
 */
export function projectToSurface(sdf: Sdf, mesh: SurfaceMesh, steps = 1): void {
  const p = mesh.positions;
  const n = mesh.normals;
  for (let s = 0; s < steps; s++)
    for (let i = 0; i < p.length; i += 3) {
      const d = sdf(p[i]!, p[i + 1]!, p[i + 2]!);
      p[i] = p[i]! - n[i]! * d;
      p[i + 1] = p[i + 1]! - n[i + 1]! * d;
      p[i + 2] = p[i + 2]! - n[i + 2]! * d;
    }
}

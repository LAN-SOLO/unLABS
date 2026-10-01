import { VoxelGrid, type Vec3 } from "@/lib/voxel/grid";
import {
  MATERIAL_CLASSES,
  greedyMesh,
  type MaterialClass,
  type MeshData,
  type MeshGroup,
  type MeshOptions,
} from "@/lib/voxel/mesher";

/**
 * Fine voxels — the same model at a smaller voxel size (pure).
 * ============================================================
 *
 * The clarity engine never leaves voxels: every era the lab is drawn with
 * smaller cubes. `fineGrid(grid, m)` splits each voxel into m×m×m sub-voxels
 * and lets them follow the *shape* the coarse voxels approximate instead of
 * copying the blocks: a sharp blurred occupancy field ([1 w 1] per axis) is
 * sampled at every sub-voxel centre near the surface, so
 *
 * - flat faces stay exactly where they are (the field crosses ½ on the face),
 * - convex edges and corners get a rounded bevel,
 * - diagonal staircases fill in towards a plane,
 *
 * and the finer the sub-voxels, the closer the cubes get to the smooth form.
 * At high m the voxels are so small that the model reads as rendered — but
 * it is still cubes, meshed by the normal greedy mesher.
 *
 * Guarantees: thin parts (a voxel with nothing on both sides along some
 * axis — rods, panels, single voxels) stay whole blocks, so they never thin
 * out or vanish; emissive and glass voxels stay crisp blocks
 * (screens, LEDs, panes), interior and empty space is copied wholesale (only
 * cells with a mixed 3×3×3 neighbourhood are sampled). Colours come from the
 * containing voxel, or — for sub-voxels that fill a concave corner — from the
 * nearest solid neighbour.
 */

export interface FineGridOptions {
  materialOf?: (index: number) => MaterialClass;
  /**
   * Centre weight w of the [1 w 1] blur (default 12): a small rounded
   * bevel on edges, like machined parts. Lower = rounder (6 melts small
   * details), higher = crisper.
   */
  sharpness?: number;
}

/** Shaped classes; the rest (glass, emit) keep crisp blocks. */
const SHAPED: Readonly<Record<MaterialClass, boolean>> = {
  solid: true,
  metal: true,
  glass: false,
  emit: false,
};

/**
 * Field + fill for one grid; `region()` splits any box of it (cells outside
 * the grid are empty), so big models can be meshed block by block.
 */
export class FineSampler {
  private readonly shaped = new Uint8Array(256);
  private readonly f: Float32Array;
  private readonly nx: number;
  private readonly ny: number;
  private readonly nz: number;

  constructor(
    readonly grid: VoxelGrid,
    opts: FineGridOptions = {},
  ) {
    const materialOf = opts.materialOf ?? (() => "solid" as const);
    const w = opts.sharpness ?? 12;
    for (let k = 1; k < 256; k++) this.shaped[k] = SHAPED[materialOf(k)] ? 1 : 0;
    const { sx, sy, sz, data } = grid;
    // Padded occupancy of shaped voxels (pad 1), then the separable blur.
    const nx = (this.nx = sx + 2);
    const ny = (this.ny = sy + 2);
    this.nz = sz + 2;
    const occ = new Float32Array(nx * ny * this.nz);
    for (let z = 0, i = 0; z < sz; z++)
      for (let y = 0; y < sy; y++)
        for (let x = 0; x < sx; x++, i++) {
          const v = data[i]!;
          if (v && this.shaped[v]) occ[x + 1 + nx * (y + 1 + ny * (z + 1))] = 1;
        }
    const tmp = new Float32Array(occ.length);
    const norm = 1 / (w + 2);
    const blur = (src: Float32Array, dst: Float32Array, stride: number, axisLen: number) => {
      const n = src.length;
      for (let i = 0; i < n; i++) {
        const k = Math.floor(i / stride) % axisLen;
        const l = k > 0 ? src[i - stride]! : 0;
        const r = k < axisLen - 1 ? src[i + stride]! : 0;
        dst[i] = (l + w * src[i]! + r) * norm;
      }
    };
    blur(occ, tmp, 1, nx);
    blur(tmp, occ, nx, ny);
    blur(occ, tmp, nx * ny, this.nz);
    this.f = tmp;
  }

  private at(x: number, y: number, z: number): number {
    const g = this.grid;
    if (x < 0 || y < 0 || z < 0 || x >= g.sx || y >= g.sy || z >= g.sz) return 0;
    return g.data[x + g.sx * (y + g.sy * z)]!;
  }

  private solidAt(x: number, y: number, z: number): boolean {
    const v = this.at(x, y, z);
    return v !== 0 && this.shaped[v] === 1;
  }

  /** Trilinear field at a point in grid voxel coordinates (centre of voxel i at i + 0.5). */
  private sample(px: number, py: number, pz: number): number {
    const { nx, ny, nz, f } = this;
    const nxy = nx * ny;
    const gx = px + 0.5;
    const gy = py + 0.5;
    const gz = pz + 0.5;
    const ix = Math.min(nx - 2, Math.max(0, Math.floor(gx)));
    const iy = Math.min(ny - 2, Math.max(0, Math.floor(gy)));
    const iz = Math.min(nz - 2, Math.max(0, Math.floor(gz)));
    const fx = gx - ix;
    const fy = gy - iy;
    const fz = gz - iz;
    const b = ix + nx * (iy + ny * iz);
    const c000 = f[b]!;
    const c100 = f[b + 1]!;
    const c010 = f[b + nx]!;
    const c110 = f[b + nx + 1]!;
    const c001 = f[b + nxy]!;
    const c101 = f[b + nxy + 1]!;
    const c011 = f[b + nxy + nx]!;
    const c111 = f[b + nxy + nx + 1]!;
    const x00 = c000 + (c100 - c000) * fx;
    const x10 = c010 + (c110 - c010) * fx;
    const x01 = c001 + (c101 - c001) * fx;
    const x11 = c011 + (c111 - c011) * fx;
    const y0 = x00 + (x10 - x00) * fy;
    const y1 = x01 + (x11 - x01) * fy;
    return y0 + (y1 - y0) * fz;
  }

  /** Colour of the nearest shaped neighbour (faces, then edges, then corners). */
  private nearestShaped(x: number, y: number, z: number): number {
    let best = 0;
    let bd = 4;
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const d = dx * dx + dy * dy + dz * dz;
          if (d === 0 || d >= bd || !this.solidAt(x + dx, y + dy, z + dz)) continue;
          bd = d;
          best = this.at(x + dx, y + dy, z + dz);
        }
    return best;
  }

  /** The box [min, min + size) of the grid split into m×m×m sub-voxels each. */
  region(min: Vec3, size: Vec3, m: number): VoxelGrid {
    const FX = size[0] * m;
    const FY = size[1] * m;
    const out = new VoxelGrid(FX, FY, size[2] * m);
    const od = out.data;
    const inv = 1 / m;
    const { shaped } = this;
    for (let bz = 0; bz < size[2]; bz++)
      for (let by = 0; by < size[1]; by++)
        for (let bx = 0; bx < size[0]; bx++) {
          const x = min[0] + bx;
          const y = min[1] + by;
          const z = min[2] + bz;
          const v = this.at(x, y, z);
          const isShaped = v !== 0 && shaped[v] === 1;
          // Mixed neighbourhood? Only then is the surface near.
          let mixed = false;
          // Thin parts stay whole blocks (see module doc).
          const thin =
            isShaped &&
            ((!this.solidAt(x - 1, y, z) && !this.solidAt(x + 1, y, z)) ||
              (!this.solidAt(x, y - 1, z) && !this.solidAt(x, y + 1, z)) ||
              (!this.solidAt(x, y, z - 1) && !this.solidAt(x, y, z + 1)));
          if (!thin && (v === 0 || isShaped)) {
            for (let dz = -1; dz <= 1 && !mixed; dz++)
              for (let dy = -1; dy <= 1 && !mixed; dy++)
                for (let dx = -1; dx <= 1 && !mixed; dx++)
                  if (this.solidAt(x + dx, y + dy, z + dz) !== isShaped) mixed = true;
          }
          if (!mixed) {
            if (v === 0) continue;
            for (let k = 0; k < m; k++)
              for (let j = 0; j < m; j++) {
                const row = bx * m + FX * (by * m + j + FY * (bz * m + k));
                od.fill(v, row, row + m);
              }
            continue;
          }
          // Colour for sub-voxels that fill a concave corner of an empty voxel.
          const fillColor = isShaped ? 0 : this.nearestShaped(x, y, z);
          if (!isShaped && !fillColor) continue;
          for (let k = 0; k < m; k++) {
            const lz = (k + 0.5) * inv;
            for (let j = 0; j < m; j++) {
              const ly = (j + 0.5) * inv;
              let o = bx * m + FX * (by * m + j + FY * (bz * m + k));
              for (let i = 0; i < m; i++, o++) {
                const lx = (i + 0.5) * inv;
                if (this.sample(x + lx, y + ly, z + lz) >= 0.5) od[o] = isShaped ? v : fillColor;
              }
            }
          }
        }
    return out;
  }
}

/** Split every voxel of `grid` into m×m×m shaped sub-voxels (see module doc). m = 1 returns `grid`. */
export function fineGrid(grid: VoxelGrid, m: number, opts: FineGridOptions = {}): VoxelGrid {
  if (m <= 1) return grid;
  return new FineSampler(grid, opts).region([0, 0, 0], [grid.sx, grid.sy, grid.sz], m);
}

/** Grid cells per meshing block (bounds memory: a block is (BLOCK + 2)·m cells per axis). */
const BLOCK = 16;

/**
 * Greedy mesh of `grid` split m×m×m, block by block (each block with a ring
 * of one grid cell, so faces and AO across block borders match). Output is
 * in grid units × `scale` (default 1), like `greedyMesh` on the grid itself.
 */
export function fineMesh(
  grid: VoxelGrid,
  m: number,
  opts: MeshOptions & FineGridOptions,
): MeshData {
  const unit = opts.scale ?? 1;
  const off = opts.offset ?? [0, 0, 0];
  if (m <= 1) return greedyMesh(grid, [0, 0, 0], [grid.sx, grid.sy, grid.sz], opts);
  const sampler = new FineSampler(grid, opts);
  const parts: MeshData[] = [];
  for (let z0 = 0; z0 < grid.sz; z0 += BLOCK)
    for (let y0 = 0; y0 < grid.sy; y0 += BLOCK)
      for (let x0 = 0; x0 < grid.sx; x0 += BLOCK) {
        const size: Vec3 = [
          Math.min(BLOCK, grid.sx - x0),
          Math.min(BLOCK, grid.sy - y0),
          Math.min(BLOCK, grid.sz - z0),
        ];
        const fine = sampler.region(
          [x0 - 1, y0 - 1, z0 - 1],
          [size[0] + 2, size[1] + 2, size[2] + 2],
          m,
        );
        const data = greedyMesh(fine, [m, m, m], [size[0] * m, size[1] * m, size[2] * m], {
          ...opts,
          // Fine cell (i) of this block sits at grid coordinate (x0 - 1) + i / m.
          offset: [(x0 - 1 + off[0]) * m, (y0 - 1 + off[1]) * m, (z0 - 1 + off[2]) * m],
          scale: unit / m,
        });
        if (data.quads) parts.push(data);
      }
  return mergeMeshData(parts);
}

/** Concatenate meshes, keeping one index range per material class. */
export function mergeMeshData(parts: readonly MeshData[]): MeshData {
  if (parts.length === 1) return parts[0]!;
  let nv = 0;
  let ni = 0;
  let quads = 0;
  for (const p of parts) {
    nv += p.positions.length / 3;
    ni += p.indices.length;
    quads += p.quads;
  }
  const positions = new Float32Array(nv * 3);
  const normals = new Float32Array(nv * 3);
  const colors = new Float32Array(nv * 3);
  const indices = new Uint32Array(ni);
  const groups: MeshGroup[] = [];
  let o = 0;
  const base: number[] = [];
  let v = 0;
  for (const p of parts) {
    base.push(v);
    positions.set(p.positions, v * 3);
    normals.set(p.normals, v * 3);
    colors.set(p.colors, v * 3);
    v += p.positions.length / 3;
  }
  for (const cls of MATERIAL_CLASSES) {
    const start = o;
    parts.forEach((p, k) => {
      for (const g of p.groups) {
        if (g.material !== cls) continue;
        const b = base[k]!;
        for (let i = g.start; i < g.start + g.count; i++) indices[o++] = p.indices[i]! + b;
      }
    });
    if (o > start) groups.push({ material: cls, start, count: o - start });
  }
  return { positions, normals, colors, indices, groups, quads };
}

import { readBox, type Vec3, type VoxelSource } from "@/lib/voxel/grid";
import type { Palette } from "@/lib/voxel/palette";

/** Render bucket per palette index. Each bucket becomes one geometry group / material. */
export type MaterialClass = "solid" | "glass" | "emit" | "metal";
export const MATERIAL_CLASSES: readonly MaterialClass[] = ["solid", "glass", "emit", "metal"];

export interface MeshOptions {
  palette: Palette;
  /** Classify a palette index. Default: everything is 'solid'. */
  materialOf?: (index: number) => MaterialClass;
  /** Ambient occlusion. Default true. */
  ao?: boolean;
  /** Brightness per AO level 0 (occluded) .. 3 (open). */
  aoCurve?: readonly [number, number, number, number];
  /** Offset added to every vertex (e.g. a model pivot). */
  offset?: Vec3;
  /**
   * Edge length of one voxel in output units (default 1), applied after
   * `offset` — 0.5 meshes a refined 2× grid at its source size.
   */
  scale?: number;
}

export interface MeshGroup {
  material: MaterialClass;
  start: number;
  count: number;
}

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  /** Linear RGB, AO baked in. */
  colors: Float32Array;
  indices: Uint32Array;
  /** Index ranges per material class, in MATERIAL_CLASSES order, empty ones omitted. */
  groups: MeshGroup[];
  quads: number;
}

/** Growable per-material vertex streams (typed arrays, doubled on demand). */
class Bucket {
  positions = new Float32Array(1024 * 3);
  normals = new Float32Array(1024 * 3);
  colors = new Float32Array(1024 * 3);
  indices = new Uint32Array(1024 * 1.5);
  /** Vertices written. */
  nv = 0;
  /** Indices written. */
  ni = 0;

  reserveQuad(): void {
    if ((this.nv + 4) * 3 > this.positions.length) {
      const grow = (a: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> => {
        const b = new Float32Array(a.length * 2);
        b.set(a);
        return b;
      };
      this.positions = grow(this.positions);
      this.normals = grow(this.normals);
      this.colors = grow(this.colors);
    }
    if (this.ni + 6 > this.indices.length) {
      const b = new Uint32Array(this.indices.length * 2);
      b.set(this.indices);
      this.indices = b;
    }
  }
}

const DEFAULT_AO: readonly [number, number, number, number] = [0.45, 0.65, 0.82, 1];

/**
 * Greedy mesher with per-vertex ambient occlusion.
 *
 * Meshes the box [min, min + size) of `src`, sampling neighbours outside the box
 * so chunk borders cull and shade correctly. Faces merge only when palette index
 * and all four AO values match, so AO never smears across a merged quad.
 * Transparent classes ('glass') keep faces against other materials.
 *
 * The box plus a 1-voxel margin is copied into a dense array first (fast
 * paths for VoxelGrid and chunked worlds), so the hot loops are plain index
 * arithmetic without bounds checks or per-sample allocations.
 */
export function greedyMesh(src: VoxelSource, min: Vec3, size: Vec3, opts: MeshOptions): MeshData {
  const materialOf = opts.materialOf ?? (() => "solid" as const);
  const useAo = opts.ao ?? true;
  const aoCurve = opts.aoCurve ?? DEFAULT_AO;
  const offset = opts.offset ?? [0, 0, 0];
  const unit = opts.scale ?? 1;
  const buckets = new Map<MaterialClass, Bucket>();
  const colorCache = new Map<number, [number, number, number]>();
  let quads = 0;

  const X = size[0] + 2;
  const Y = size[1] + 2;
  const Z = size[2] + 2;
  const pad = readBox(src, [min[0] - 1, min[1] - 1, min[2] - 1], [X, Y, Z]);
  const S: Vec3 = [1, X, X * Y];
  const opaqueT = new Uint8Array(256);
  const classOf: MaterialClass[] = [];
  for (let k = 1; k < 256; k++) {
    const m = materialOf(k);
    classOf[k] = m;
    opaqueT[k] = m !== "glass" ? 1 : 0;
  }
  const color = (v: number): [number, number, number] => {
    let c = colorCache.get(v);
    if (!c) colorCache.set(v, (c = opts.palette.linear(v)));
    return c;
  };
  const ao = [0, 0, 0, 0];

  // 1. One sweep over the solid cells: every visible face goes into the mask
  //    of its (axis, direction, slice), allocated lazily — empty space costs
  //    one byte read per cell.
  const masks: (Int32Array | undefined)[][] = [];
  for (let m = 0; m < 6; m++) masks.push(new Array<Int32Array | undefined>(size[m >> 1]!));
  for (let z = 0; z < size[2]; z++) {
    for (let y = 0; y < size[1]; y++) {
      let idx = 1 + X * (y + 1 + Y * (z + 1));
      for (let x = 0; x < size[0]; x++, idx++) {
        const c = pad[idx]!;
        if (c === 0) continue;
        for (let d = 0; d < 3; d++) {
          const Sd = S[d]!;
          for (let e = 0; e < 2; e++) {
            const ni = e ? idx + Sd : idx - Sd;
            const nc = pad[ni]!;
            if (nc !== 0 && (opaqueT[nc] || nc === c)) continue;
            const u = (d + 1) % 3;
            const v = (d + 2) % 3;
            const Su = S[u]!;
            const Sv = S[v]!;
            let aoBits = 0xff; // all corners level 3
            if (useAo) {
              // Corner order: (-u,-v), (+u,-v), (+u,+v), (-u,+v) — matches quad vertex order.
              const um = opaqueT[pad[ni - Su]!]!;
              const up = opaqueT[pad[ni + Su]!]!;
              const vm = opaqueT[pad[ni - Sv]!]!;
              const vp = opaqueT[pad[ni + Sv]!]!;
              const mm = opaqueT[pad[ni - Su - Sv]!]!;
              const pm = opaqueT[pad[ni + Su - Sv]!]!;
              const pp = opaqueT[pad[ni + Su + Sv]!]!;
              const mp = opaqueT[pad[ni - Su + Sv]!]!;
              const l0 = um && vm ? 0 : 3 - (um + vm + mm);
              const l1 = up && vm ? 0 : 3 - (up + vm + pm);
              const l2 = up && vp ? 0 : 3 - (up + vp + pp);
              const l3 = um && vp ? 0 : 3 - (um + vp + mp);
              aoBits = l0 | (l1 << 2) | (l2 << 4) | (l3 << 6);
            }
            const cs: Vec3 = [x, y, z];
            const list = masks[d * 2 + e]!;
            const sl = cs[d]!;
            let mask = list[sl];
            if (!mask) list[sl] = mask = new Int32Array(size[u]! * size[v]!);
            mask[cs[u]! + size[u]! * cs[v]!] = c | (aoBits << 8);
          }
        }
      }
    }
  }

  // 2. Greedily merge equal mask cells into rectangles (slice order as before).
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const su = size[u]!,
      sv = size[v]!;
    const minD = min[d]!,
      minU = min[u]!,
      minV = min[v]!;
    for (const dir of [-1, 1] as const) {
      const list = masks[d * 2 + (dir > 0 ? 1 : 0)]!;
      for (let s = 0; s < size[d]!; s++) {
        const mask = list[s];
        if (!mask) continue;
        let k = 0;
        for (let j = 0; j < sv; j++) {
          for (let i = 0; i < su; ) {
            const key = mask[k]!;
            if (key === 0) {
              i++;
              k++;
              continue;
            }
            let w = 1;
            while (i + w < su && mask[k + w] === key) w++;
            let h = 1;
            grow: while (j + h < sv) {
              for (let x = 0; x < w; x++) if (mask[k + x + h * su] !== key) break grow;
              h++;
            }
            const c = key & 0xff;
            ao[0] = (key >> 8) & 3;
            ao[1] = (key >> 10) & 3;
            ao[2] = (key >> 12) & 3;
            ao[3] = (key >> 14) & 3;
            const bucketKey = classOf[c]!;
            let bucket = buckets.get(bucketKey);
            if (!bucket) buckets.set(bucketKey, (bucket = new Bucket()));
            emitQuad(
              bucket,
              d,
              u,
              v,
              dir,
              minD + s + (dir > 0 ? 1 : 0),
              minU + i,
              minV + j,
              w,
              h,
              offset,
              unit,
              color(c),
              ao,
              aoCurve,
            );
            quads++;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[k + x + y * su] = 0;
            i += w;
            k += w;
          }
        }
      }
    }
  }

  return pack(buckets, quads);
}

function emitQuad(
  b: Bucket,
  d: number,
  u: number,
  v: number,
  dir: 1 | -1,
  plane: number,
  i: number,
  j: number,
  w: number,
  h: number,
  offset: Vec3,
  unit: number,
  rgb: [number, number, number],
  ao: readonly number[],
  aoCurve: readonly [number, number, number, number],
): void {
  b.reserveQuad();
  const base = b.nv;
  const P = b.positions;
  const N = b.normals;
  const Cc = b.colors;
  for (let q = 0; q < 4; q++) {
    // Corners (i, j), (i + w, j), (i + w, j + h), (i, j + h).
    const cu = q === 1 || q === 2 ? i + w : i;
    const cv = q >= 2 ? j + h : j;
    const o = (base + q) * 3;
    P[o + d] = (plane + offset[d]!) * unit;
    P[o + u] = (cu + offset[u]!) * unit;
    P[o + v] = (cv + offset[v]!) * unit;
    N[o] = 0;
    N[o + 1] = 0;
    N[o + 2] = 0;
    N[o + d] = dir;
    const f = aoCurve[ao[q]!]!;
    Cc[o] = rgb[0] * f;
    Cc[o + 1] = rgb[1] * f;
    Cc[o + 2] = rgb[2] * f;
  }
  b.nv += 4;
  // Split along the brighter diagonal so AO does not form a diagonal streak.
  const flip = ao[0]! + ao[2]! < ao[1]! + ao[3]!;
  // e_u x e_v = +e_d, so 0-1-2-3 is counter-clockwise seen from +d.
  const tris = flip ? FLIP_TRIS : TRIS;
  const I = b.indices;
  for (let t = 0; t < 6; t += 3) {
    I[b.ni + t] = base + tris[t]!;
    // Negative faces: swap the last two vertices of each triangle.
    I[b.ni + t + 1] = base + tris[dir < 0 ? t + 2 : t + 1]!;
    I[b.ni + t + 2] = base + tris[dir < 0 ? t + 1 : t + 2]!;
  }
  b.ni += 6;
}

const TRIS = [0, 1, 2, 0, 2, 3] as const;
const FLIP_TRIS = [1, 2, 3, 1, 3, 0] as const;

function pack(buckets: Map<MaterialClass, Bucket>, quads: number): MeshData {
  let vcount = 0,
    icount = 0;
  for (const b of buckets.values()) {
    vcount += b.nv;
    icount += b.ni;
  }
  const positions = new Float32Array(vcount * 3);
  const normals = new Float32Array(vcount * 3);
  const colors = new Float32Array(vcount * 3);
  const indices = new Uint32Array(icount);
  const groups: MeshGroup[] = [];
  let vo = 0,
    io = 0;
  for (const material of MATERIAL_CLASSES) {
    const b = buckets.get(material);
    if (!b) continue;
    positions.set(b.positions.subarray(0, b.nv * 3), vo * 3);
    normals.set(b.normals.subarray(0, b.nv * 3), vo * 3);
    colors.set(b.colors.subarray(0, b.nv * 3), vo * 3);
    if (vo === 0) indices.set(b.indices.subarray(0, b.ni), io);
    else for (let t = 0; t < b.ni; t++) indices[io + t] = b.indices[t]! + vo;
    groups.push({ material, start: io, count: b.ni });
    vo += b.nv;
    io += b.ni;
  }
  return { positions, normals, colors, indices, groups, quads };
}

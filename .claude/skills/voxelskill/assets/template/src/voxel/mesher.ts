import type { Vec3, VoxelSource } from '@/voxel/grid';
import type { Palette } from '@/voxel/palette';

/** Render bucket per palette index. Each bucket becomes one geometry group / material. */
export type MaterialClass = 'solid' | 'glass' | 'emit' | 'metal';
export const MATERIAL_CLASSES: readonly MaterialClass[] = ['solid', 'glass', 'emit', 'metal'];

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

interface Bucket {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

const DEFAULT_AO: readonly [number, number, number, number] = [0.45, 0.65, 0.82, 1];

/**
 * Greedy mesher with per-vertex ambient occlusion.
 *
 * Meshes the box [min, min + size) of `src`, sampling neighbours outside the box
 * so chunk borders cull and shade correctly. Faces merge only when palette index
 * and all four AO values match, so AO never smears across a merged quad.
 * Transparent classes ('glass') keep faces against other materials.
 */
export function greedyMesh(src: VoxelSource, min: Vec3, size: Vec3, opts: MeshOptions): MeshData {
  const materialOf = opts.materialOf ?? (() => 'solid' as const);
  const useAo = opts.ao ?? true;
  const aoCurve = opts.aoCurve ?? DEFAULT_AO;
  const offset = opts.offset ?? [0, 0, 0];
  const buckets = new Map<MaterialClass, Bucket>();
  const colorCache = new Map<number, [number, number, number]>();
  let quads = 0;

  const opaque = (v: number): boolean => v !== 0 && materialOf(v) !== 'glass';
  const color = (v: number): [number, number, number] => {
    let c = colorCache.get(v);
    if (!c) colorCache.set(v, (c = opts.palette.linear(v)));
    return c;
  };

  const p: Vec3 = [0, 0, 0];
  const n: Vec3 = [0, 0, 0];

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const su = size[u]!, sv = size[v]!;
    const minD = min[d]!, minU = min[u]!, minV = min[v]!;
    const mask = new Int32Array(su * sv);

    for (const dir of [-1, 1] as const) {
      for (let s = 0; s < size[d]!; s++) {
        // 1. Build the mask of visible faces for this slice.
        let k = 0;
        for (let j = 0; j < sv; j++) {
          for (let i = 0; i < su; i++, k++) {
            p[d] = minD + s; p[u] = minU + i; p[v] = minV + j;
            const c = src.get(p[0], p[1], p[2]);
            mask[k] = 0;
            if (c === 0) continue;
            n[0] = p[0]; n[1] = p[1]; n[2] = p[2];
            n[d] = n[d]! + dir;
            const nc = src.get(n[0], n[1], n[2]);
            const visible = nc === 0 || (!opaque(nc) && nc !== c);
            if (!visible) continue;
            let aoBits = 0xff; // all corners level 3
            if (useAo) {
              aoBits = 0;
              // Corner order: (-u,-v), (+u,-v), (+u,+v), (-u,+v) — matches quad vertex order.
              const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
              for (let q = 0; q < 4; q++) {
                const [du, dv] = corners[q]!;
                const side1 = sampleOpaque(src, opaque, n, u, du, v, 0);
                const side2 = sampleOpaque(src, opaque, n, u, 0, v, dv);
                const corner = sampleOpaque(src, opaque, n, u, du, v, dv);
                const level = side1 && side2 ? 0 : 3 - (side1 + side2 + corner);
                aoBits |= level << (q * 2);
              }
            }
            mask[k] = c | (aoBits << 8);
          }
        }

        // 2. Greedily merge equal mask cells into rectangles.
        k = 0;
        for (let j = 0; j < sv; j++) {
          for (let i = 0; i < su; ) {
            const key = mask[k]!;
            if (key === 0) { i++; k++; continue; }
            let w = 1;
            while (i + w < su && mask[k + w] === key) w++;
            let h = 1;
            grow: while (j + h < sv) {
              for (let x = 0; x < w; x++) if (mask[k + x + h * su] !== key) break grow;
              h++;
            }
            const c = key & 0xff;
            const ao = [(key >> 8) & 3, (key >> 10) & 3, (key >> 12) & 3, (key >> 14) & 3] as const;
            const bucketKey = materialOf(c);
            let bucket = buckets.get(bucketKey);
            if (!bucket) buckets.set(bucketKey, (bucket = { positions: [], normals: [], colors: [], indices: [] }));
            emitQuad(bucket, d, u, v, dir, minD + s + (dir > 0 ? 1 : 0), minU + i, minV + j, w, h, offset, color(c), ao, aoCurve);
            quads++;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[k + x + y * su] = 0;
            i += w; k += w;
          }
        }
      }
    }
  }

  return pack(buckets, quads);
}

function sampleOpaque(
  src: VoxelSource, opaque: (v: number) => boolean, n: Vec3,
  u: number, du: number, v: number, dv: number,
): number {
  const q: Vec3 = [n[0], n[1], n[2]];
  q[u] = q[u]! + du; q[v] = q[v]! + dv;
  return opaque(src.get(q[0], q[1], q[2])) ? 1 : 0;
}

function emitQuad(
  b: Bucket, d: number, u: number, v: number, dir: 1 | -1,
  plane: number, i: number, j: number, w: number, h: number, offset: Vec3,
  rgb: [number, number, number], ao: readonly [number, number, number, number],
  aoCurve: readonly [number, number, number, number],
): void {
  const base = b.positions.length / 3;
  const corners: [number, number][] = [[i, j], [i + w, j], [i + w, j + h], [i, j + h]];
  const normal: Vec3 = [0, 0, 0];
  normal[d] = dir;
  for (let q = 0; q < 4; q++) {
    const pos: Vec3 = [0, 0, 0];
    pos[d] = plane; pos[u] = corners[q]![0]; pos[v] = corners[q]![1];
    b.positions.push(pos[0] + offset[0], pos[1] + offset[1], pos[2] + offset[2]);
    b.normals.push(normal[0], normal[1], normal[2]);
    const f = aoCurve[ao[q]!]!;
    b.colors.push(rgb[0] * f, rgb[1] * f, rgb[2] * f);
  }
  // Split along the brighter diagonal so AO does not form a diagonal streak.
  const flip = ao[0] + ao[2] < ao[1] + ao[3];
  // e_u x e_v = +e_d, so 0-1-2-3 is counter-clockwise seen from +d.
  const tris = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
  if (dir < 0) for (let t = 0; t < 6; t += 3) [tris[t + 1], tris[t + 2]] = [tris[t + 2]!, tris[t + 1]!];
  for (const t of tris) b.indices.push(base + t);
}

function pack(buckets: Map<MaterialClass, Bucket>, quads: number): MeshData {
  let vcount = 0, icount = 0;
  for (const b of buckets.values()) { vcount += b.positions.length / 3; icount += b.indices.length; }
  const positions = new Float32Array(vcount * 3);
  const normals = new Float32Array(vcount * 3);
  const colors = new Float32Array(vcount * 3);
  const indices = new Uint32Array(icount);
  const groups: MeshGroup[] = [];
  let vo = 0, io = 0;
  for (const material of MATERIAL_CLASSES) {
    const b = buckets.get(material);
    if (!b) continue;
    positions.set(b.positions, vo * 3);
    normals.set(b.normals, vo * 3);
    colors.set(b.colors, vo * 3);
    for (let t = 0; t < b.indices.length; t++) indices[io + t] = b.indices[t]! + vo;
    groups.push({ material, start: io, count: b.indices.length });
    vo += b.positions.length / 3;
    io += b.indices.length;
  }
  return { positions, normals, colors, indices, groups, quads };
}

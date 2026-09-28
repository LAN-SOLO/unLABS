import type { VoxelGrid } from '@/voxel/grid';
import type { Palette } from '@/voxel/palette';

export interface IsoSprite {
  width: number;
  height: number;
  /** RGBA8, row-major, top-left origin — feed to ImageData or a DataTexture. */
  data: Uint8ClampedArray<ArrayBuffer>;
  /** Pixel position of the grid origin corner (x=0, y=0, z=0) on the sprite, for anchoring. */
  originX: number;
  originY: number;
}

export interface IsoOptions {
  /** Half-width of one voxel's top face in pixels. Even numbers give clean 2:1 edges. Default 4. */
  scale?: number;
  /** Brightness of top / +Z face / +X face. */
  shade?: readonly [number, number, number];
  /** Quarter turns around Y before projecting (0..3) — bake 4 view directions. */
  rotation?: 0 | 1 | 2 | 3;
  /** Draw a 1px dark outline around the silhouette. */
  outline?: boolean;
}

/**
 * CPU renderer for 2:1 pixel-art isometric sprites from a Y-up voxel grid
 * (same idea as IsoVoxel). Deterministic, needs no WebGL — works in tests,
 * workers and build scripts. Visible faces: top (+Y), left (+Z), right (+X).
 *
 * Voxel (x, y, z) is drawn at px = (x - z) * s, py = (x + z) * s/2 - y * s,
 * in painter's order of increasing x + y + z.
 */
export function bakeIsoSprite(grid: VoxelGrid, palette: Palette, opts: IsoOptions = {}): IsoSprite {
  const s = opts.scale ?? 4;
  if (s < 2 || s % 2 !== 0) throw new Error('scale must be an even number >= 2');
  const shade = opts.shade ?? [1, 0.78, 0.6];
  const rot = opts.rotation ?? 0;

  // Rotate the grid footprint in quarter turns.
  const W = rot % 2 === 0 ? grid.sx : grid.sz;
  const D = rot % 2 === 0 ? grid.sz : grid.sx;
  const H = grid.sy;
  const sample = (x: number, y: number, z: number): number => {
    switch (rot) {
      case 0: return grid.get(x, y, z);
      case 1: return grid.get(z, y, W - 1 - x);
      case 2: return grid.get(W - 1 - x, y, D - 1 - z);
      default: return grid.get(D - 1 - z, y, x);
    }
  };

  const pad = opts.outline ? 1 : 0;
  const width = (W + D) * s + pad * 2;
  const height = ((W + D) * s) / 2 + H * s + pad * 2;
  const originX = D * s + pad;
  const originY = H * s + pad;
  const data = new Uint8ClampedArray(width * height * 4);
  const stamp = buildStamp(s);

  for (let sum = 0; sum <= W + H + D - 3; sum++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const z = sum - x - y;
        if (z < 0 || z >= D) continue;
        const c = sample(x, y, z);
        if (c === 0) continue;
        // Skip fully hidden voxels.
        if (sample(x + 1, y, z) && sample(x, y + 1, z) && sample(x, y, z + 1)) continue;
        const [r, g, b] = palette.get(c);
        const ox = originX + (x - z) * s - s;
        const oy = originY + ((x + z) * s) / 2 - y * s - s;
        for (let py = 0; py < 2 * s; py++) {
          for (let px = 0; px < 2 * s; px++) {
            const face = stamp[py * 2 * s + px]!;
            if (face === 0) continue;
            const f = shade[face - 1]!;
            const o = ((oy + py) * width + ox + px) * 4;
            data[o] = r * f; data[o + 1] = g * f; data[o + 2] = b * f; data[o + 3] = 255;
          }
        }
      }
    }
  }
  if (opts.outline) addOutline(data, width, height);
  return { width, height, data, originX, originY };
}

/** 2s x 2s cube stamp: 0 empty, 1 top, 2 left (+Z), 3 right (+X). */
function buildStamp(s: number): Uint8Array {
  const n = 2 * s;
  const out = new Uint8Array(n * n);
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const x = px + 0.5, y = py + 0.5;
      let face = 0;
      if (Math.abs(x - s) / s + Math.abs(y - s / 2) / (s / 2) <= 1) face = 1;
      else if (x < s && y >= s / 2 + x / 2 && y <= 1.5 * s + x / 2) face = 2;
      else if (x >= s && y >= s - (x - s) / 2 && y <= 2 * s - (x - s) / 2) face = 3;
      out[py * n + px] = face;
    }
  }
  return out;
}

function addOutline(data: Uint8ClampedArray, w: number, h: number): void {
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3]! > 0;
  const edge: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push((y * w + x) * 4);
  for (const o of edge) { data[o] = 20; data[o + 1] = 18; data[o + 2] = 28; data[o + 3] = 255; }
}

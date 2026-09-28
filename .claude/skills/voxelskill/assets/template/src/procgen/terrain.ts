import { fbm2 } from '@/procgen/noise';
import type { VoxelWorld } from '@/voxel/world';

export interface IslandOptions {
  seed: number;
  /** Noise frequency — smaller = broader hills. */
  scale: number;
  /** Ground level at the island center. */
  base: number;
  /** Max hill height added on top of base. */
  amplitude: number;
  /** Water surface height (0 = no water). */
  waterLevel: number;
  colors: { grass: number; dirt: number; stone: number; sand: number; water: number };
}

/**
 * Diorama island: fBm heightmap multiplied by a radial falloff so the level
 * has a readable edge. Writes into `world` and returns the heightmap.
 */
export function generateIsland(world: VoxelWorld, o: IslandOptions): Int16Array {
  const { sx, sz } = world;
  const heights = new Int16Array(sx * sz);
  const cx = sx / 2, cz = sz / 2, r = Math.min(sx, sz) / 2;
  for (let z = 0; z < sz; z++) {
    for (let x = 0; x < sx; x++) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / r;
      const falloff = Math.max(0, 1 - d * d);
      const n = fbm2(x * o.scale, z * o.scale, o.seed);
      const h = Math.floor((o.base + n * o.amplitude) * falloff);
      heights[z * sx + x] = h;
      for (let y = 0; y < h; y++) {
        const depth = h - 1 - y;
        const beach = h <= o.waterLevel + 1;
        const c = depth === 0 ? (beach ? o.colors.sand : o.colors.grass) : depth < 3 ? o.colors.dirt : o.colors.stone;
        world.set(x, y, z, c);
      }
      for (let y = h; y < o.waterLevel && falloff > 0; y++) world.set(x, y, z, o.colors.water);
    }
  }
  return heights;
}

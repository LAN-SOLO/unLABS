import type { Vec3, VoxelSource } from "@/lib/voxel/grid";

export interface VoxelHit {
  /** The solid voxel that was hit. */
  voxel: Vec3;
  /** Face normal of the hit — `voxel + normal` is where a new block goes. */
  normal: Vec3;
  distance: number;
  value: number;
}

/**
 * Amanatides & Woo voxel traversal (DDA). Visits every cell the ray crosses,
 * in order, so it never skips thin walls. `dir` need not be normalized.
 */
export function raycastVoxels(
  src: VoxelSource,
  origin: Vec3,
  dir: Vec3,
  maxDistance: number,
): VoxelHit | null {
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len === 0) return null;
  const d: Vec3 = [dir[0] / len, dir[1] / len, dir[2] / len];
  const cell: Vec3 = [Math.floor(origin[0]), Math.floor(origin[1]), Math.floor(origin[2])];
  const step: Vec3 = [0, 0, 0];
  const tMax: Vec3 = [Infinity, Infinity, Infinity];
  const tDelta: Vec3 = [Infinity, Infinity, Infinity];

  for (let a = 0; a < 3; a++) {
    const da = d[a]!;
    if (da > 0) {
      step[a] = 1;
      tMax[a] = (cell[a]! + 1 - origin[a]!) / da;
      tDelta[a] = 1 / da;
    } else if (da < 0) {
      step[a] = -1;
      tMax[a] = (origin[a]! - cell[a]!) / -da;
      tDelta[a] = -1 / da;
    }
  }

  const normal: Vec3 = [0, 0, 0];
  let t = 0;
  while (t <= maxDistance) {
    const value = src.get(cell[0], cell[1], cell[2]);
    if (value !== 0) return { voxel: [...cell], normal: [...normal], distance: t, value };
    const a = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2;
    t = tMax[a]!;
    tMax[a] += tDelta[a]!;
    cell[a] += step[a]!;
    normal[0] = 0;
    normal[1] = 0;
    normal[2] = 0;
    normal[a] = -step[a]!;
  }
  return null;
}

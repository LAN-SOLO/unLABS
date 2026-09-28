import type { Vec3, VoxelSource } from '@/voxel/grid';

/** Axis-aligned box given by its minimum corner and size, in voxel units (Y-up). */
export interface Box {
  min: Vec3;
  size: Vec3;
}

export interface MoveResult {
  /** Movement actually applied after collisions. */
  moved: Vec3;
  /** Which axes were blocked (e.g. blocked[1] && delta.y < 0 → standing on ground). */
  blocked: [boolean, boolean, boolean];
}

const EPS = 1e-4;

/**
 * Moves `box` by `delta` against solid voxels, resolving one axis at a time
 * (Y first, so landing is resolved before sliding). Mutates box.min.
 * Keep |delta| per axis < 1 per call (sub-step fast movement) to avoid tunnelling.
 */
export function moveBox(src: VoxelSource, box: Box, delta: Vec3, isSolid: (v: number) => boolean = (v) => v !== 0): MoveResult {
  const moved: Vec3 = [0, 0, 0];
  const blocked: [boolean, boolean, boolean] = [false, false, false];
  for (const a of [1, 0, 2] as const) {
    const da = delta[a]!;
    if (da === 0) continue;
    const start = box.min[a];
    box.min[a] += da;
    if (overlapsSolid(src, box, isSolid)) {
      // Snap flush against the blocking face.
      box.min[a] = da > 0
        ? Math.floor(box.min[a] + box.size[a]) - box.size[a] - EPS
        : Math.floor(box.min[a]) + 1 + EPS;
      blocked[a] = true;
    }
    moved[a] = box.min[a] - start;
  }
  return { moved, blocked };
}

export function overlapsSolid(src: VoxelSource, box: Box, isSolid: (v: number) => boolean = (v) => v !== 0): boolean {
  const x0 = Math.floor(box.min[0]), x1 = Math.floor(box.min[0] + box.size[0] - EPS);
  const y0 = Math.floor(box.min[1]), y1 = Math.floor(box.min[1] + box.size[1] - EPS);
  const z0 = Math.floor(box.min[2]), z1 = Math.floor(box.min[2] + box.size[2] - EPS);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) if (isSolid(src.get(x, y, z))) return true;
  return false;
}

import { VoxelGrid, type Vec3 } from '@/voxel/grid';
import { forEachVoxel } from '@/vox/parser';
import type { VoxFile, VoxModel } from '@/vox/types';

/** Row-major 3x3 rotation (entries -1/0/1) + translation, in MagicaVoxel axes (Z-up). */
export interface VoxTransform {
  r: [number, number, number, number, number, number, number, number, number];
  t: Vec3;
}

export interface VoxInstance {
  modelId: number;
  model: VoxModel;
  /** World transform in MagicaVoxel axes; apply to voxel centers relative to the model pivot. */
  transform: VoxTransform;
  /** Names of the transform nodes from root to this shape. */
  path: string[];
  layer: number;
  hidden: boolean;
}

export const IDENTITY: VoxTransform = { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

/** Decode the ROTATION byte (spec section (c)). 4 = identity. */
export function decodeRotation(byte: number): VoxTransform['r'] {
  const i1 = byte & 3;
  const i2 = (byte >> 2) & 3;
  if (i1 === i2 || i1 > 2 || i2 > 2) throw new Error(`invalid rotation byte ${byte}`);
  const i3 = 3 - i1 - i2;
  const r: VoxTransform['r'] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  r[i1] = (byte >> 4) & 1 ? -1 : 1;
  r[3 + i2] = (byte >> 5) & 1 ? -1 : 1;
  r[6 + i3] = (byte >> 6) & 1 ? -1 : 1;
  return r;
}

export function encodeRotation(r: VoxTransform['r']): number {
  const idx = (row: number) => [0, 1, 2].findIndex((c) => r[row * 3 + c] !== 0);
  const neg = (row: number) => (r[row * 3 + idx(row)]! < 0 ? 1 : 0);
  return idx(0) | (idx(1) << 2) | (neg(0) << 4) | (neg(1) << 5) | (neg(2) << 6);
}

export function compose(a: VoxTransform, b: VoxTransform): VoxTransform {
  const r: VoxTransform['r'] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i * 3 + j] = r[i * 3 + j]! + a.r[i * 3 + k]! * b.r[k * 3 + j]!;
  return { r, t: apply(a, b.t) };
}

export function apply(tr: VoxTransform, p: Vec3): Vec3 {
  const { r, t } = tr;
  return [
    r[0] * p[0] + r[1] * p[1] + r[2] * p[2] + t[0],
    r[3] * p[0] + r[4] * p[1] + r[5] * p[2] + t[1],
    r[6] * p[0] + r[7] * p[1] + r[8] * p[2] + t[2],
  ];
}

/**
 * MagicaVoxel pivot of a model: floor(size / 2) per axis (same as the ogt_vox
 * reference loader). Voxel (x,y,z) occupies [v - pivot, v - pivot + 1] in model space.
 */
export function pivot(size: Vec3): Vec3 {
  return [Math.floor(size[0] / 2), Math.floor(size[1] / 2), Math.floor(size[2] / 2)];
}

/**
 * Flattens the scene graph into placed model instances for one animation frame.
 * Files without a scene graph yield one instance per model at the origin.
 */
export function flattenScene(file: VoxFile, frame = 0): VoxInstance[] {
  if (!file.nodes.has(0)) {
    return file.models.map((model, modelId) => ({ modelId, model, transform: IDENTITY, path: [], layer: 0, hidden: false }));
  }
  const hiddenLayers = new Set(file.layers.filter((l) => l.hidden).map((l) => l.id));
  const out: VoxInstance[] = [];

  const visit = (id: number, parent: VoxTransform, path: string[], layer: number, hidden: boolean, depth: number): void => {
    if (depth > 256) throw new Error('scene graph too deep (cycle?)');
    const node = file.nodes.get(id);
    if (!node) return;
    if (node.kind === 'transform') {
      const f = pickFrame(node.frames, frame);
      const local: VoxTransform = f ? { r: decodeRotation(f.rotation), t: f.translation } : IDENTITY;
      const name = node.attributes._name;
      visit(node.child, compose(parent, local), name ? [...path, name] : path, node.layer >= 0 ? node.layer : layer,
        hidden || node.attributes._hidden === '1' || hiddenLayers.has(node.layer), depth + 1);
    } else if (node.kind === 'group') {
      for (const c of node.children) visit(c, parent, path, layer, hidden || node.attributes._hidden === '1', depth + 1);
    } else {
      const m = pickFrame(node.models, frame);
      const model = m ? file.models[m.modelId] : undefined;
      if (m && model) out.push({ modelId: m.modelId, model, transform: parent, path, layer, hidden });
    }
  };
  visit(0, IDENTITY, [], 0, false, 0);
  return out;
}

/** Latest keyframe with frame <= t (MagicaVoxel holds keyframes until the next one). */
function pickFrame<T extends { frame: number }>(frames: readonly T[], t: number): T | undefined {
  let best: T | undefined;
  for (const f of frames) if (f.frame <= t && (!best || f.frame >= best.frame)) best = f;
  return best ?? frames[0];
}

/**
 * Convert a MagicaVoxel point (Z-up, right-handed) to game/Three.js axes (Y-up, right-handed):
 * (x, y, z) → (x, z, -y). This equals a -90° rotation about X.
 */
export function voxToYUp(p: Vec3): Vec3 {
  return [p[0], p[2], -p[1]];
}

/**
 * World-space (Y-up) integer cells of every voxel of an instance.
 * Uses voxel centers so 90° rotations stay on the grid.
 */
export function instanceCells(inst: VoxInstance, fn: (cell: Vec3, color: number) => void): void {
  const pv = pivot(inst.model.size);
  forEachVoxel(inst.model, (x, y, z, c) => {
    const w = voxToYUp(apply(inst.transform, [x + 0.5 - pv[0], y + 0.5 - pv[1], z + 0.5 - pv[2]]));
    fn([Math.floor(w[0]), Math.floor(w[1]), Math.floor(w[2])], c);
  });
}

/** Axis-aligned bounds (Y-up cells, max exclusive) of visible instances. */
export function sceneBounds(instances: readonly VoxInstance[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const inst of instances) {
    if (inst.hidden) continue;
    instanceCells(inst, (p) => {
      for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a]!, p[a]!); max[a] = Math.max(max[a]!, p[a]! + 1); }
    });
  }
  if (min[0] === Infinity) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}

/** Bake all visible instances into one Y-up grid (useful for collision, iso sprites, editing). */
export function sceneToGrid(instances: readonly VoxInstance[]): { grid: VoxelGrid; origin: Vec3 } {
  const { min, max } = sceneBounds(instances);
  const grid = new VoxelGrid(Math.max(1, max[0] - min[0]), Math.max(1, max[1] - min[1]), Math.max(1, max[2] - min[2]));
  for (const inst of instances) {
    if (inst.hidden) continue;
    instanceCells(inst, (p, c) => grid.set(p[0] - min[0], p[1] - min[1], p[2] - min[2], c));
  }
  return { grid, origin: min };
}

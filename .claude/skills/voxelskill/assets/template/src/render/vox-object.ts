import type * as THREE from 'three';
import type { Vec3 } from '@/voxel/grid';
import type { MaterialClass } from '@/voxel/mesher';
import { greedyMesh } from '@/voxel/mesher';
import { parseVox } from '@/vox/parser';
import { flattenScene, sceneToGrid } from '@/vox/scene';
import type { VoxFile } from '@/vox/types';
import { materialClassifier, toMesh } from '@/render/voxel-mesh';

export type Anchor = 'pivot' | 'bottom-center';

export interface VoxObject {
  file: VoxFile;
  mesh: THREE.Mesh;
  /** Y-up bounds of the baked model relative to mesh origin. */
  min: Vec3;
  max: Vec3;
}

/**
 * Bake a whole .vox scene (all visible instances, frame `frame`) into one Y-up mesh.
 * 'bottom-center' puts the model's footprint center at the origin, standing on y = 0 —
 * the right default for props. 'pivot' keeps MagicaVoxel world coordinates.
 */
export function voxToObject(
  file: VoxFile,
  materials: Record<MaterialClass, THREE.Material>,
  { anchor = 'bottom-center', frame = 0 }: { anchor?: Anchor; frame?: number } = {},
): VoxObject {
  const { grid, origin } = sceneToGrid(flattenScene(file, frame));
  const shift: Vec3 = anchor === 'pivot'
    ? origin
    : [-Math.floor(grid.sx / 2), 0, -Math.floor(grid.sz / 2)];
  const data = greedyMesh(grid, [0, 0, 0], [grid.sx, grid.sy, grid.sz], {
    palette: file.palette,
    materialOf: materialClassifier(file.materials),
    offset: shift,
  });
  const mesh = toMesh(data, materials);
  return {
    file,
    mesh,
    min: shift,
    max: [shift[0] + grid.sx, shift[1] + grid.sy, shift[2] + grid.sz],
  };
}

/** Fetch + parse a .vox from a URL (e.g. `/models/tree.vox` in public/). */
export async function loadVox(url: string): Promise<VoxFile> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: ${res.status}`);
  return parseVox(await res.arrayBuffer());
}

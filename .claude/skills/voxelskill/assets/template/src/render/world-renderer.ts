import * as THREE from 'three';
import type { MaterialClass } from '@/voxel/mesher';
import { greedyMesh } from '@/voxel/mesher';
import type { Palette } from '@/voxel/palette';
import { CHUNK, VoxelWorld } from '@/voxel/world';
import { toMesh } from '@/render/voxel-mesh';

/**
 * Keeps one THREE.Mesh per world chunk in sync. Call `sync()` once per frame:
 * it re-meshes at most `budget` dirty chunks so edits never stall a frame.
 */
export class WorldRenderer {
  readonly root = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Mesh>();

  constructor(
    private readonly world: VoxelWorld,
    private readonly palette: Palette,
    private readonly materials: Record<MaterialClass, THREE.Material>,
    private readonly materialOf?: (index: number) => MaterialClass,
  ) {
    this.root.name = 'world';
    for (const key of world.chunkKeys()) world.dirty.add(key);
  }

  sync(budget = 4): void {
    let done = 0;
    for (const key of this.world.dirty) {
      if (done++ >= budget) break;
      this.world.dirty.delete(key);
      this.rebuild(key);
    }
  }

  /** Re-mesh everything now (use after bulk generation, before the first frame). */
  syncAll(): void {
    this.sync(Infinity);
  }

  private rebuild(key: string): void {
    const old = this.meshes.get(key);
    if (old) {
      this.root.remove(old);
      old.geometry.dispose();
      this.meshes.delete(key);
    }
    const [cx, cy, cz] = VoxelWorld.parseKey(key);
    const data = greedyMesh(this.world, [cx * CHUNK, cy * CHUNK, cz * CHUNK], [CHUNK, CHUNK, CHUNK], {
      palette: this.palette,
      ...(this.materialOf ? { materialOf: this.materialOf } : {}),
    });
    if (data.quads === 0) return;
    const mesh = toMesh(data, this.materials);
    mesh.name = `chunk ${key}`;
    this.root.add(mesh);
    this.meshes.set(key, mesh);
  }
}

import * as THREE from "three";
import type { Vec3, VoxelGrid, VoxelSource } from "@/lib/voxel/grid";
import type { MaterialClass } from "@/lib/voxel/mesher";
import { REFINE_REACH } from "@/lib/voxel/refine";
import { MATERIAL_CLASSES, greedyMesh } from "@/lib/voxel/mesher";
import type { Palette } from "@/lib/voxel/palette";
import { CHUNK, VoxelWorld } from "@/lib/voxel/world";
import { mergeByMaterial, shadowProxy } from "@/lib/world/render/batching";
import { toGeometry } from "@/lib/world/render/voxel-mesh";

/**
 * Keeps the terrain of a voxel world in sync. Chunks are greedy-meshed
 * individually (at most `budget` dirty chunks per `sync()`, so edits never
 * stall a frame), then concatenated into ONE mesh with a group per
 * material class: the whole terrain costs ≤ 4 draw calls (+1 shadow draw
 * through a single-material proxy that shares the geometry).
 *
 * With a `refine` function the terrain is rendered at 2× resolution: each
 * dirty chunk (plus a 1-voxel ring for border culling / AO) is refined from
 * the logical world and meshed at half the voxel size. The logical world
 * (collision, raycasts, pathfinding) is untouched; its `dirtyReach` is
 * raised so an edit near a border re-refines the neighbour chunk too.
 */

/** Render-only refinement of a world box into a 2× grid (see lib/voxel/refine.ts). */
export type TerrainRefiner = (src: VoxelSource, min: Vec3, size: Vec3) => VoxelGrid;
export class WorldRenderer {
  readonly root = new THREE.Group();
  private readonly chunks = new Map<string, THREE.BufferGeometry>();
  private mesh: THREE.Mesh | null = null;
  private proxy: THREE.Mesh | null = null;
  /** Syncs with rebuilt chunks since the last merge. */
  private stale = 0;
  private readonly materialList: THREE.Material[];

  constructor(
    private readonly world: VoxelWorld,
    private readonly palette: Palette,
    materials: Record<MaterialClass, THREE.Material>,
    private readonly materialOf?: (index: number) => MaterialClass,
    /** Material of the shadow proxy (default: the solid material). */
    private readonly shadowMaterial: THREE.Material = materials.solid,
    private readonly refine?: TerrainRefiner,
  ) {
    this.root.name = "world";
    if (refine) world.dirtyReach = Math.max(world.dirtyReach, REFINE_REACH);
    this.materialList = MATERIAL_CLASSES.map((c) => materials[c]);
    for (const key of world.chunkKeys()) world.dirty.add(key);
  }

  /** Re-mesh up to `budget` dirty chunks; returns how many were rebuilt. */
  sync(budget = 4): number {
    let done = 0;
    for (const key of this.world.dirty) {
      if (done >= budget) break;
      done++;
      this.world.dirty.delete(key);
      this.rebuild(key);
    }
    if (done > 0) this.stale++;
    // Re-merge once a batch of edits is complete (a cutaway dirties every
    // chunk: one merge instead of one per frame); a steady trickle of edits
    // still shows up after a few frames.
    if (this.stale > 0 && (this.world.dirty.size === 0 || this.stale >= 8)) {
      this.stale = 0;
      this.remerge();
    }
    return done;
  }

  /** Re-mesh everything now (use after bulk generation, before the first frame). */
  syncAll(): void {
    this.sync(Infinity);
  }

  /** Meshed (non-empty) chunks. */
  get chunkCount(): number {
    return this.chunks.size;
  }

  private rebuild(key: string): void {
    this.chunks.get(key)?.dispose();
    this.chunks.delete(key);
    const [cx, cy, cz] = VoxelWorld.parseKey(key);
    const min: Vec3 = [cx * CHUNK, cy * CHUNK, cz * CHUNK];
    const mat = this.materialOf ? { materialOf: this.materialOf } : {};
    let data;
    if (this.refine) {
      // Chunk clipped to the world, plus a 1-voxel ring so faces and AO on
      // chunk borders match the neighbour's refinement exactly.
      const w = this.world;
      const size: Vec3 = [
        Math.min(CHUNK, w.sx - min[0]),
        Math.min(CHUNK, w.sy - min[1]),
        Math.min(CHUNK, w.sz - min[2]),
      ];
      if (size[0] <= 0 || size[1] <= 0 || size[2] <= 0) return;
      const fine = this.refine(
        w,
        [min[0] - 1, min[1] - 1, min[2] - 1],
        [size[0] + 2, size[1] + 2, size[2] + 2],
      );
      data = greedyMesh(fine, [2, 2, 2], [size[0] * 2, size[1] * 2, size[2] * 2], {
        palette: this.palette,
        ...mat,
        offset: [2 * (min[0] - 1), 2 * (min[1] - 1), 2 * (min[2] - 1)],
        scale: 0.5,
      });
    } else {
      data = greedyMesh(this.world, min, [CHUNK, CHUNK, CHUNK], {
        palette: this.palette,
        ...mat,
      });
    }
    if (data.quads === 0) return;
    this.chunks.set(key, toGeometry(data));
  }

  private remerge(): void {
    this.dropMesh();
    const merged = mergeByMaterial([...this.chunks.values()].map((geometry) => ({ geometry })));
    if (!merged) return;
    const mesh = new THREE.Mesh(merged.geometry, this.materialList);
    mesh.name = "terrain";
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.root.add(mesh);
    this.mesh = mesh;
    // Same geometry, single material: the whole terrain is one shadow draw.
    // (Shared on purpose; disposing it twice via scene traversal is a no-op.)
    this.proxy = shadowProxy(merged.geometry, this.shadowMaterial);
    this.root.add(this.proxy);
  }

  private dropMesh(): void {
    if (this.mesh) {
      this.root.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.proxy) {
      this.root.remove(this.proxy);
      this.proxy = null;
    }
  }

  dispose(): void {
    this.dropMesh();
    for (const g of this.chunks.values()) g.dispose();
    this.chunks.clear();
  }
}

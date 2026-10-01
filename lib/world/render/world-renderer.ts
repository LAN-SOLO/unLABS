import * as THREE from "three";
import type { VoxelGrid, Vec3, VoxelSource } from "@/lib/voxel/grid";
import type { MaterialClass } from "@/lib/voxel/mesher";
import { REFINE_REACH } from "@/lib/voxel/refine";
import { MATERIAL_CLASSES, greedyMesh } from "@/lib/voxel/mesher";
import type { Palette } from "@/lib/voxel/palette";
import { CHUNK, VoxelWorld } from "@/lib/voxel/world";
import { mergeByMaterial, shadowProxy } from "@/lib/world/render/batching";
import { FineSampler } from "@/lib/voxel/fine-grid";
import type { MeshTier } from "@/lib/world/models/refine";
import { toGeometry } from "@/lib/world/render/voxel-mesh";
import { TERRAIN_BOX, terrainBoxMin, terrainChunkKey } from "@/lib/world/crystal";

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

/** Crystal terrain chunks (docs/CRYSTAL.md) — the engine's CrystalLibrary. */
export interface TerrainCrystal {
  has(key: string): boolean;
  geometry(
    key: string,
    size: readonly [number, number, number],
    center: boolean,
  ): THREE.BufferGeometry | null;
}
export class WorldRenderer {
  readonly root = new THREE.Group();
  private readonly chunks = new Map<string, THREE.BufferGeometry>();
  private mesh: THREE.Mesh | null = null;
  private proxy: THREE.Mesh | null = null;
  /** Syncs with rebuilt chunks since the last merge. */
  private stale = 0;
  private materialList: THREE.Material[];
  /** Crystal age: chunks whose exact state has a crystal model show it (null = voxels). */
  private crystal: TerrainCrystal | null = null;
  /** Chunk key → crystal key of chunks shown as voxels while their crystal model loads. */
  private readonly crystalWait = new Map<string, string>();
  /** Chunks currently showing their crystal model. */
  private readonly crystalShown = new Set<string>();
  /** Clarity voxel divisions: 1 = source cubes, 2 = refined, 4 = refined and split again. */
  private tier: MeshTier = 2;

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

  /**
   * Crystal age on (`crystal` + a material list with the crystal slots after
   * the voxel classes) or off (null). Re-meshes every chunk.
   */
  setCrystal(crystal: TerrainCrystal | null, materials?: THREE.Material[]): void {
    if (materials) {
      this.materialList = materials;
      if (this.mesh) this.mesh.material = materials;
    }
    if (crystal === this.crystal) return;
    this.crystal = crystal;
    this.crystalWait.clear();
    for (const key of this.world.chunkKeys()) this.world.dirty.add(key);
  }

  /** Chunks showing their crystal model. */
  get crystalChunks(): number {
    return this.crystalShown.size;
  }

  /** Chunks still waiting for their crystal model. */
  get crystalPending(): number {
    return this.crystalWait.size;
  }

  /** Re-mesh up to `budget` dirty chunks; returns how many were rebuilt. */
  sync(budget = 4): number {
    if (this.crystal && this.crystalWait.size) {
      for (const [key, ck] of this.crystalWait) {
        if (!this.crystal.has(ck)) this.crystalWait.delete(key);
        else if (this.crystal.geometry(ck, [TERRAIN_BOX, TERRAIN_BOX, TERRAIN_BOX], false)) {
          this.crystalWait.delete(key);
          this.world.dirty.add(key);
        }
      }
    }
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

  /** Switch the terrain voxel divisions (re-meshes every chunk over the next frames). */
  setTier(tier: MeshTier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    for (const key of this.world.chunkKeys()) this.world.dirty.add(key);
  }

  get meshTier(): MeshTier {
    return this.tier;
  }

  /** Re-mesh everything now (use after bulk generation, before the first frame). */
  syncAll(): void {
    this.sync(Infinity);
  }

  /** Chunks waiting for a re-mesh. */
  get dirtyChunks(): number {
    return this.world.dirty.size;
  }

  /** Meshed (non-empty) chunks. */
  get chunkCount(): number {
    return this.chunks.size;
  }

  private rebuild(key: string): void {
    this.chunks.get(key)?.dispose();
    this.chunks.delete(key);
    this.crystalShown.delete(key);
    const [cx, cy, cz] = VoxelWorld.parseKey(key);
    const min: Vec3 = [cx * CHUNK, cy * CHUNK, cz * CHUNK];
    if (this.crystal) {
      const { key: ck } = terrainChunkKey(this.world, min);
      if (this.crystal.has(ck)) {
        const g = this.crystal.geometry(ck, [TERRAIN_BOX, TERRAIN_BOX, TERRAIN_BOX], false);
        if (g) {
          const o = terrainBoxMin(min);
          this.chunks.set(key, g.clone().translate(o[0], o[1], o[2]));
          this.crystalShown.add(key);
          return;
        }
        // Loading: voxels for now, swapped in by `sync` once it arrives.
        this.crystalWait.set(key, ck);
      }
    }
    const mat = this.materialOf ? { materialOf: this.materialOf } : {};
    let data;
    if (this.refine && this.tier >= 2) {
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
      const m = this.tier / 2;
      if (m <= 1) {
        const offset: Vec3 = [2 * (min[0] - 1), 2 * (min[1] - 1), 2 * (min[2] - 1)];
        data = greedyMesh(fine, [2, 2, 2], [size[0] * 2, size[1] * 2, size[2] * 2], {
          palette: this.palette,
          ...mat,
          offset,
          scale: 0.5,
        });
      } else {
        // Split the refined chunk again (shaped sub-voxels, lib/voxel/fine-grid.ts):
        // the chunk plus one refined voxel of ring, meshed without the ring.
        const split = new FineSampler(fine, mat).region(
          [1, 1, 1],
          [size[0] * 2 + 2, size[1] * 2 + 2, size[2] * 2 + 2],
          m,
        );
        const o = (k: 0 | 1 | 2): number => 2 * m * (min[k] - 1) + m;
        data = greedyMesh(split, [m, m, m], [size[0] * 2 * m, size[1] * 2 * m, size[2] * 2 * m], {
          palette: this.palette,
          ...mat,
          offset: [o(0), o(1), o(2)],
          scale: 1 / (2 * m),
        });
      }
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

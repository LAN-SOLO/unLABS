/// <reference lib="webworker" />
/**
 * Meshes voxel models at the fine clarity divisions (4×–8×) off the main
 * thread — a big device takes seconds at 8×. See fine-mesh-pool.ts.
 */
import { VoxelGrid } from "@/lib/voxel/grid";
import { materialFromKey, refinedModelMesh } from "@/lib/world/models/refine";
import type { FineMeshJob } from "@/lib/world/render/fine-mesh-pool";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<FineMeshJob>) => {
  const j = e.data;
  const grid = new VoxelGrid(j.sx, j.sy, j.sz, j.data);
  const materialOf = materialFromKey(j.material);
  const mesh = refinedModelMesh(grid, j.family, {
    center: j.center,
    tier: j.tier,
    ...(j.material === "lab" ? {} : { materialOf }),
  });
  // Copies: the worker's own cache keeps its arrays (they are not transferred away).
  const out = {
    positions: mesh.positions.slice(),
    normals: mesh.normals.slice(),
    colors: mesh.colors.slice(),
    indices: mesh.indices.slice(),
    groups: mesh.groups,
    quads: mesh.quads,
  };
  self.postMessage({ id: j.id, mesh: out }, [
    out.positions.buffer,
    out.normals.buffer,
    out.colors.buffer,
    out.indices.buffer,
  ]);
};

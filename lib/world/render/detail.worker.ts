/// <reference lib="webworker" />
/**
 * Detailed devices off the main thread (models/detail.ts): the fine grids,
 * the finished base in both power states and their meshes. See
 * detail-pool.ts.
 */
import { stagedBuildGrid } from "@/lib/world/models/anim";
import { detailGrids } from "@/lib/world/models/detail";
import { deviceVisual } from "@/lib/world/models/devices";
import { modelMeshKey, refinedModelMesh } from "@/lib/world/models/refine";
import type { DetailJob, DetailResult, WireGrid, WireMesh } from "@/lib/world/render/detail-pool";
import type { VoxelGrid } from "@/lib/voxel/grid";

declare const self: DedicatedWorkerGlobalScope;

function wire(g: VoxelGrid): WireGrid {
  return { sx: g.sx, sy: g.sy, sz: g.sz, data: g.data };
}

function mesh(g: VoxelGrid): WireMesh {
  const opts = { center: true, tier: 2 as const };
  const m = refinedModelMesh(g, "hires", opts);
  return {
    key: modelMeshKey(g, "hires", opts),
    mesh: {
      positions: m.positions.slice(),
      normals: m.normals.slice(),
      colors: m.colors.slice(),
      indices: m.indices.slice(),
      groups: m.groups,
      quads: m.quads,
    },
  };
}

self.onmessage = (e: MessageEvent<DetailJob>) => {
  const { id } = e.data;
  const grids = detailGrids(deviceVisual(id), id);
  const on = stagedBuildGrid(grids.base, 1, true);
  const off = stagedBuildGrid(grids.base, 1, false);
  const out: DetailResult = {
    id,
    base: wire(grids.base),
    parts: grids.parts.map(wire),
    on: wire(on),
    off: wire(off),
    meshes: [mesh(on), mesh(off)],
  };
  const buffers: Transferable[] = [out.base, out.on, out.off, ...out.parts].map(
    (g) => g.data.buffer,
  );
  for (const m of out.meshes)
    buffers.push(
      m.mesh.positions.buffer,
      m.mesh.normals.buffer,
      m.mesh.colors.buffer,
      m.mesh.indices.buffer,
    );
  self.postMessage(out, buffers);
};

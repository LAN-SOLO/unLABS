/**
 * Detailed devices without frame hitches.
 * =======================================
 *
 * A detailed device (lib/world/models/detail.ts: 4× finer voxels plus
 * components) takes 0.1–0.7 s to build and mesh. Workers do it; the engine
 * shows the authored device meanwhile and swaps the detailed one in when
 * `requestDetail` returns it. The finished base in both power states comes
 * back meshed: its meshes go into the shared model mesh cache, so the swap
 * itself costs a hash, not a mesh. Without workers (tests, Node) the detail
 * is built on the spot.
 */
import { VoxelGrid } from "@/lib/voxel/grid";
import type { MeshData } from "@/lib/voxel/mesher";
import { stagedBuildGrid, type DeviceVisual } from "@/lib/world/models/anim";
import { assembleDetail, detailGrids } from "@/lib/world/models/detail";
import { deviceVisual } from "@/lib/world/models/devices";
import { putModelMesh } from "@/lib/world/models/refine";

export interface WireGrid {
  sx: number;
  sy: number;
  sz: number;
  data: Uint8Array;
}
export interface WireMesh {
  key: string;
  mesh: MeshData;
}
export interface DetailJob {
  id: string;
}
export interface DetailResult {
  id: string;
  base: WireGrid;
  parts: WireGrid[];
  /** Finished base, powered / unpowered (what `buildDevice` shows when complete). */
  on: WireGrid;
  off: WireGrid;
  meshes: WireMesh[];
}

/** A detailed device, ready for the engine. */
export interface DetailedDevice {
  visual: DeviceVisual;
  /** The finished base grids (powered, unpowered) — meshed already. */
  on: VoxelGrid;
  off: VoxelGrid;
}

const ready = new Map<string, DetailedDevice>();
const requested = new Set<string>();
const queue: string[] = [];
let workers: Worker[] | null = null;
let broken = false;
const idle: Worker[] = [];

const grid = (w: WireGrid): VoxelGrid => new VoxelGrid(w.sx, w.sy, w.sz, w.data);

function done(r: DetailResult): void {
  for (const m of r.meshes) putModelMesh(m.key, m.mesh);
  const visual = assembleDetail(deviceVisual(r.id), {
    base: grid(r.base),
    parts: r.parts.map(grid),
  });
  ready.set(r.id, { visual, on: grid(r.on), off: grid(r.off) });
  requested.delete(r.id);
}

function pool(): Worker[] | null {
  if (workers || broken) return workers;
  if (typeof Worker === "undefined") {
    broken = true;
    return null;
  }
  const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 2));
  try {
    workers = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL("./detail.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<DetailResult>) => {
        done(e.data);
        idle.push(w);
        pump();
      };
      w.onerror = () => {
        broken = true;
      };
      workers.push(w);
      idle.push(w);
    }
  } catch {
    broken = true;
    workers = null;
  }
  return workers;
}

function pump(): void {
  while (idle.length && queue.length)
    idle.pop()!.postMessage({ id: queue.shift()! } satisfies DetailJob);
}

/** Build synchronously (no workers). */
function direct(id: string): DetailedDevice {
  const v = deviceVisual(id);
  const grids = detailGrids(v, id);
  const d = {
    visual: assembleDetail(v, grids),
    on: stagedBuildGrid(grids.base, 1, true),
    off: stagedBuildGrid(grids.base, 1, false),
  };
  ready.set(id, d);
  return d;
}

/** The detailed device if ready, else `null` after queueing it (ask again later; nearest first). */
export function requestDetail(id: string): DetailedDevice | null {
  const hit = ready.get(id);
  if (hit) return hit;
  if (!pool() || broken) return direct(id);
  if (!requested.has(id)) {
    requested.add(id);
    queue.push(id);
    pump();
  }
  return null;
}

/** Devices still being detailed. */
export function pendingDetails(): number {
  return requested.size;
}

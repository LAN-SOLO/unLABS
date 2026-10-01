/**
 * Fine model meshes without frame hitches.
 * ========================================
 *
 * The clarity eras split every voxel model into 4, 6 and finally 8 cubes
 * per voxel edge (lib/voxel/fine-grid.ts). A big device takes seconds at
 * 8×, so those tiers are meshed by a small pool of Web Workers; the engine
 * asks with `requestModelMesh` every frame until the mesh is there, and
 * keeps showing the previous tier meanwhile. Tiers 1 and 2 are cheap and
 * meshed on the spot. Results land in the shared model mesh cache
 * (`putModelMesh`), so a model placed many times is meshed once.
 */
import type { VoxelGrid } from "@/lib/voxel/grid";
import type { MaterialClass, MeshData } from "@/lib/voxel/mesher";
import {
  materialKeyOf,
  modelMeshKey,
  peekModelMesh,
  putModelMesh,
  refinedModelMesh,
  type MeshTier,
  type RefineFamily,
} from "@/lib/world/models/refine";

/** One model to mesh (posted to fine-mesh.worker.ts). */
export interface FineMeshJob {
  id: number;
  sx: number;
  sy: number;
  sz: number;
  data: Uint8Array;
  family: RefineFamily;
  center: boolean;
  tier: MeshTier;
  material: string;
}

/** Highest tier meshed synchronously. */
export const SYNC_TIER: MeshTier = 2;

interface Pending {
  key: string;
  job: FineMeshJob;
}

let workers: Worker[] | null = null;
let broken = false;
const idle: Worker[] = [];
const queue: Pending[] = [];
const inFlight = new Map<number, string>();
const requested = new Set<string>();
let nextId = 1;

function pool(): Worker[] | null {
  if (workers || broken) return workers;
  if (typeof Worker === "undefined") {
    broken = true;
    return null;
  }
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
  try {
    workers = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL("./fine-mesh.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<{ id: number; mesh: MeshData }>) => {
        const key = inFlight.get(e.data.id);
        inFlight.delete(e.data.id);
        if (key) {
          putModelMesh(key, e.data.mesh);
          requested.delete(key);
        }
        idle.push(w);
        pump();
      };
      w.onerror = () => {
        // A broken worker: fall back to synchronous meshing from now on.
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
  while (idle.length && queue.length) {
    const w = idle.pop()!;
    const p = queue.shift()!;
    inFlight.set(p.job.id, p.key);
    w.postMessage(p.job);
  }
}

/**
 * The mesh of a model at `tier` if it is ready (cached or cheap), else
 * `null` after queueing it for a worker — ask again on a later frame.
 * Requests are served in order: ask nearest-first.
 */
export function requestModelMesh(
  grid: VoxelGrid,
  family: RefineFamily,
  opts: { center?: boolean; materialOf?: (i: number) => MaterialClass; tier: MeshTier },
): MeshData | null {
  if (opts.tier <= SYNC_TIER) return refinedModelMesh(grid, family, opts);
  const key = modelMeshKey(grid, family, opts);
  const hit = peekModelMesh(key);
  if (hit) return hit;
  if (!pool() || broken) return refinedModelMesh(grid, family, opts);
  if (!requested.has(key)) {
    requested.add(key);
    queue.push({
      key,
      job: {
        id: nextId++,
        sx: grid.sx,
        sy: grid.sy,
        sz: grid.sz,
        data: grid.data.slice(),
        family,
        center: !!opts.center,
        tier: opts.tier,
        material: materialKeyOf(opts.materialOf),
      },
    });
    pump();
  }
  return null;
}

/** Jobs not finished yet (queued + running). */
export function pendingFineMeshes(): number {
  return queue.length + inFlight.size;
}

/** Drop queued jobs (a floor change re-requests what it needs, nearest first). */
export function clearFineMeshQueue(): void {
  for (const p of queue) requested.delete(p.key);
  queue.length = 0;
}

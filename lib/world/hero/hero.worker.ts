/// <reference lib="webworker" />
/**
 * Builds hero meshes and the hair groom off the main thread (surface nets
 * over the sculpt fields take ~1 s in game detail, several seconds in
 * portrait detail; the groom ~0.5–1 s).
 */
import { buildJadeBundle, type HeroDetail } from "@/lib/world/hero/build";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<{ id: number; detail: HeroDetail }>) => {
  const bundle = buildJadeBundle(e.data.detail);
  const transfer: ArrayBuffer[] = [];
  for (const l of bundle.layers)
    for (const a of [l.positions, l.normals, l.indices, l.skinIndex, l.skinWeight, l.ao])
      transfer.push(a.buffer as ArrayBuffer);
  for (const g of bundle.groom.guides)
    transfer.push(g.rest.buffer as ArrayBuffer, g.normals.buffer as ArrayBuffer);
  self.postMessage({ id: e.data.id, bundle }, transfer);
};

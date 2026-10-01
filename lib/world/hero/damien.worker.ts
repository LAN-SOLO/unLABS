/// <reference lib="webworker" />
/** Builds Damien's hero meshes off the main thread. */
import { buildDamienHero } from "@/lib/world/hero/damien-build";
import type { HeroDetail } from "@/lib/world/hero/build";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<{ detail: HeroDetail }>) => {
  const layers = buildDamienHero(e.data.detail);
  const transfer: ArrayBuffer[] = [];
  for (const l of layers)
    for (const a of [l.positions, l.normals, l.indices, l.skinIndex, l.skinWeight, l.ao])
      transfer.push(a.buffer as ArrayBuffer);
  self.postMessage({ layers }, transfer);
};

/**
 * Damien's hero mesh, built off the main thread (cached per detail).
 * Same pattern as load.ts for Jade.
 */
import { buildDamienHero } from "@/lib/world/hero/damien-build";
import type { HeroDetail, HeroLayerMesh } from "@/lib/world/hero/build";

const cache = new Map<HeroDetail, Promise<HeroLayerMesh[]>>();

function viaWorker(detail: HeroDetail): Promise<HeroLayerMesh[]> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./damien.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ layers: HeroLayerMesh[] }>) => {
      resolve(e.data.layers);
      w.terminate();
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || "damien worker failed"));
    };
    w.postMessage({ detail });
  });
}

/** Damien's hero layers at `detail` (cached). */
export function loadDamienHero(detail: HeroDetail): Promise<HeroLayerMesh[]> {
  let p = cache.get(detail);
  if (!p) {
    p =
      typeof Worker !== "undefined"
        ? viaWorker(detail).catch(() => buildDamienHero(detail))
        : Promise.resolve(buildDamienHero(detail));
    cache.set(detail, p);
  }
  return p;
}

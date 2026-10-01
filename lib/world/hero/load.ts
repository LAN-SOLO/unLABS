/**
 * Hero loading: meshes + hair groom in a Web Worker when available (never
 * blocks a frame), else synchronously. Results are cached per detail level
 * for the session — the geometry depends on the sculpt only, looks just
 * recolour.
 */
import { buildJadeBundle, type HeroBundle, type HeroDetail } from "@/lib/world/hero/build";

const cache = new Map<HeroDetail, Promise<HeroBundle>>();

function viaWorker(detail: HeroDetail): Promise<HeroBundle> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./hero.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ bundle: HeroBundle }>) => {
      resolve(e.data.bundle);
      w.terminate();
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || "hero worker failed"));
    };
    w.postMessage({ id: 1, detail });
  });
}

/** Jade's hero meshes and hair groom at `detail` (cached). */
export function loadJadeHero(detail: HeroDetail): Promise<HeroBundle> {
  let p = cache.get(detail);
  if (!p) {
    p =
      typeof Worker !== "undefined"
        ? viaWorker(detail).catch(() => buildJadeBundle(detail))
        : Promise.resolve(buildJadeBundle(detail));
    cache.set(detail, p);
  }
  return p;
}

/**
 * Slice images and crystal GIFs (browser only: Canvas 2D).
 * =========================================================
 *
 * A slice is drawn with the unETH capture renderer (uneth-crystal.ts) at its
 * own frame: position p shows the capture turned by (p − 1) · 6°. A crystal
 * plays its 30 positions in order, 80 ms each — in capture order it turns,
 * mixed it does something exotic. Empty positions are black frames.
 *
 * Rendered captures: every crystal's 30 slices are re-rendered in Blender
 * (scripts/slices/blender/capture.py) and shipped as one atlas per token,
 * `/slices/<id>.webp` (6 × 5 tiles of 256 px). A slice draws from its atlas
 * once loaded; until then (or without the file) the procedural capture
 * renderer stands in. `onSliceAtlas` tells views to redraw.
 */
import { FRAME_MS, renderSlice } from "@/lib/world/uneth-crystal";
import { SLICE_POSITIONS, tokenById } from "@/lib/world/matrix/archive";
import { encodeGif } from "@/lib/world/matrix/gif";

/** A filled crystal position (token + slice position), or null. */
export type FrameRef = { token: number; pos: number } | null;

const CACHE_LIMIT = 600;
const cache = new Map<string, HTMLCanvasElement>();

/** Atlas layout (scripts/slices/blender/capture.py). */
export const ATLAS_TILE = 256;
export const ATLAS_COLS = 6;

type AtlasState = HTMLImageElement | "loading" | "missing";
const atlases = new Map<number, AtlasState>();
const listeners = new Set<() => void>();

/** Called whenever a rendered atlas finished loading (views redraw). */
export function onSliceAtlas(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function atlasUrl(token: number): string {
  return `/slices/${String(token).padStart(4, "0")}.webp`;
}

/** Start loading a token's atlas; resolves when it is loaded (or known missing). */
export function loadSliceAtlas(token: number): Promise<void> {
  const st = atlases.get(token);
  if (st && st !== "loading") return Promise.resolve();
  return new Promise((resolve) => {
    if (st === "loading") {
      const off = onSliceAtlas(() => {
        if (atlases.get(token) !== "loading") {
          off();
          resolve();
        }
      });
      return;
    }
    atlases.set(token, "loading");
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      atlases.set(token, img);
      for (const [k] of cache) if (k.startsWith(`${token}|`)) cache.delete(k);
      for (const l of [...listeners]) l();
      resolve();
    };
    img.onerror = () => {
      atlases.set(token, "missing");
      for (const l of [...listeners]) l();
      resolve();
    };
    img.src = atlasUrl(token);
  });
}

/** The slice image (cached per token, position and size): rendered atlas, else procedural. */
export function sliceCanvas(token: number, pos: number, size: number): HTMLCanvasElement {
  const key = `${token}|${pos}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const frame = Math.max(0, Math.min(SLICE_POSITIONS - 1, pos - 1));
  const atlas = atlases.get(token);
  if (atlas instanceof HTMLImageElement) {
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    const sx = (frame % ATLAS_COLS) * ATLAS_TILE;
    const sy = Math.floor(frame / ATLAS_COLS) * ATLAS_TILE;
    ctx.drawImage(atlas, sx, sy, ATLAS_TILE, ATLAS_TILE, 0, 0, size, size);
  } else {
    const t = tokenById(token);
    if (t) renderSlice(c, t.traits, frame);
    if (atlas === undefined) void loadSliceAtlas(token);
    // Not cached while the rendered atlas is on its way.
    if (atlas !== "missing") return c;
  }
  cache.set(key, c);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return c;
}

/** Draw one crystal frame (black when empty). */
export function drawFrame(ctx: CanvasRenderingContext2D, f: FrameRef, size: number): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  if (f) ctx.drawImage(sliceCanvas(f.token, f.pos, size), 0, 0, size, size);
}

/** The crystal as a looping GIF (30 frames × 80 ms), from the rendered slices. */
export async function crystalGifRendered(frames: readonly FrameRef[], size = 320): Promise<Blob> {
  await Promise.all([...new Set(frames.filter(Boolean).map((f) => f!.token))].map(loadSliceAtlas));
  return crystalGif(frames, size);
}

/** The crystal as a looping GIF (30 frames × 80 ms). */
export function crystalGif(frames: readonly FrameRef[], size = 320): Blob {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const images = frames.map((f) => {
    drawFrame(ctx, f, size);
    return ctx.getImageData(0, 0, size, size);
  });
  const bytes = encodeGif(images, FRAME_MS);
  return new Blob([bytes.slice().buffer], { type: "image/gif" });
}

/** Offer a blob as a file download. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

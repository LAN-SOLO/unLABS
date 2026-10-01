/**
 * Slice images and crystal GIFs (browser only: Canvas 2D).
 * =========================================================
 *
 * A slice is drawn with the unETH capture renderer (uneth-crystal.ts) at its
 * own frame: position p shows the capture turned by (p − 1) · 6°. A crystal
 * plays its 30 positions in order, 80 ms each — in capture order it turns,
 * mixed it does something exotic. Empty positions are black frames.
 */
import { FRAME_MS, renderSlice } from "@/lib/world/uneth-crystal";
import { SLICE_POSITIONS, tokenById } from "@/lib/world/matrix/archive";
import { encodeGif } from "@/lib/world/matrix/gif";

/** A filled crystal position (token + slice position), or null. */
export type FrameRef = { token: number; pos: number } | null;

const CACHE_LIMIT = 600;
const cache = new Map<string, HTMLCanvasElement>();

/** The rendered slice (cached per token, position and size). */
export function sliceCanvas(token: number, pos: number, size: number): HTMLCanvasElement {
  const key = `${token}|${pos}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const t = tokenById(token);
  if (t) renderSlice(c, t.traits, Math.max(0, Math.min(SLICE_POSITIONS - 1, pos - 1)));
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

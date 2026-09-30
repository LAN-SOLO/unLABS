"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { LAB_PALETTE } from "@/lib/world/content/palette";
import type { VoxelGrid } from "@/lib/voxel/grid";
import { bakeIsoSprite } from "@/lib/voxel/iso-baker";

export type Rotation = 0 | 1 | 2 | 3;

const cache = new Map<string, ImageData>();
const CACHE_MAX = 160;

/** Bake (once per key + view direction) the iso sprite of a grid. */
function bake(grid: VoxelGrid, key: string, size: number, rotation: Rotation): ImageData {
  const k = `${key}|r${rotation}|${size}`;
  let img = cache.get(k);
  if (!img) {
    const px = Math.max(grid.sx + grid.sz, grid.sy * 1.2);
    const scale = Math.max(2, Math.min(8, Math.floor(size / px / 2) * 2 || 2));
    const sprite = bakeIsoSprite(grid, LAB_PALETTE, { scale, outline: true, rotation });
    img = new ImageData(sprite.data, sprite.width, sprite.height);
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(k, img);
  }
  return img;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Pixel-art isometric preview of a voxel model (CPU-baked, no WebGL).
 * Baked once per `cacheKey` and view direction, scaled to fit the box with
 * crisp pixels. With `rotate` the model turns in quarter steps (paused on
 * hover/focus and when the user prefers reduced motion).
 */
export function ModelPreview({
  grid,
  cacheKey,
  size = 180,
  className = "",
  rotate = false,
  rotateMs = 1600,
  label,
  rotation: fixed,
}: {
  grid: VoxelGrid;
  cacheKey: string;
  size?: number;
  className?: string;
  rotate?: boolean;
  rotateMs?: number;
  label?: string;
  /** Controlled view direction (quarter turns); overrides `rotate`. */
  rotation?: Rotation;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [spun, setRotation] = useState<Rotation>(0);
  const rotation: Rotation = fixed ?? spun;
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!rotate || fixed !== undefined || paused || prefersReducedMotion()) return;
    const id = window.setInterval(() => setRotation((r) => ((r + 1) % 4) as Rotation), rotateMs);
    return () => window.clearInterval(id);
  }, [rotate, fixed, paused, rotateMs]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const img = bake(grid, cacheKey, size, rotation);
    const off = document.createElement("canvas");
    off.width = img.width;
    off.height = img.height;
    off.getContext("2d")?.putImageData(img, 0, 0);
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const k = Math.min(size / img.width, size / img.height);
    const w = img.width * k;
    const h = img.height * k;
    ctx.drawImage(off, (size - w) / 2, (size - h) / 2, w, h);
  }, [grid, cacheKey, size, rotation]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label ?? tr("Model preview")}
      data-rotation={rotation}
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}

"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useRef } from "react";
import type { VoxelGrid } from "@/lib/voxel/grid";
import { bakeIsoSprite, type IsoSprite } from "@/lib/voxel/iso-baker";
import { LAB_PALETTE } from "@/lib/world/content/palette";
import { itemIconModel } from "@/lib/world/models/items";
import { SPECTRUM_HEX } from "@/lib/world/traits";
import type { ItemDef, ItemKind } from "@/lib/world/types";

const spriteCache = new Map<string, IsoSprite>();
const SPRITE_CACHE_MAX = 400;

/**
 * Bake (once per key) a CPU iso sprite of a voxel grid. The even `scale` is
 * picked so the sprite is at least `targetPx` wide — the browser then only
 * ever downsamples, which keeps small icons crisp on HiDPI screens.
 */
export function bakeCachedSprite(grid: VoxelGrid, key: string, targetPx: number): IsoSprite {
  const span = Math.max(grid.sx + grid.sz, grid.sy * 1.2);
  const scale = Math.max(2, Math.min(12, Math.ceil(targetPx / span / 2) * 2));
  const k = `${key}@${scale}`;
  const hit = spriteCache.get(k);
  if (hit) return hit;
  const sprite = bakeIsoSprite(grid, LAB_PALETTE, { scale, outline: true });
  if (spriteCache.size >= SPRITE_CACHE_MAX) spriteCache.clear();
  spriteCache.set(k, sprite);
  return sprite;
}

/** Copy a baked sprite onto a canvas (intrinsic size = sprite size). */
export function paintSprite(canvas: HTMLCanvasElement, sprite: IsoSprite): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const img = ctx.createImageData(sprite.width, sprite.height);
  img.data.set(sprite.data);
  ctx.putImageData(img, 0, 0);
  return true;
}

/** Stable cache key for an item's icon (prototype ids are content hashes). */
export function itemIconKey(item: ItemDef): string {
  return `item:${item.id}|${item.color}|${item.volatility}|${item.depth}`;
}

/** Frame styling per item kind (rarity). */
export const KIND_FRAME: Record<ItemKind, { border: string; bg: string; label: string }> = {
  rohstoff: { border: "#FFB80066", bg: "#FFB800", label: tr("Raw material") },
  bauteil: { border: "#33FF3355", bg: "#33FF33", label: tr("Component") },
  werkzeug: { border: "#8f969e88", bg: "#8f969e", label: tr("Tool") },
  prototyp: { border: "#E91E8C99", bg: "#E91E8C", label: tr("Prototype") },
  relikt: { border: "#e0b64acc", bg: "#e0b64a", label: tr("Relic") },
  schlacke: { border: "#6e6e6866", bg: "#6e6e68", label: tr("Slag") },
  verbrauch: { border: "#7fd4ff88", bg: "#7fd4ff", label: tr("Provision") },
};

/**
 * Pixel-art voxel icon of an item, baked on the CPU and cached. Volatile
 * items (≥ 3) glow softly in their spectrum colour; the frame tells the kind.
 */
export function ItemIcon({
  item,
  size = 40,
  frame = true,
  className = "",
  title,
}: {
  item: ItemDef;
  size?: number;
  /** Draw the rarity frame and backdrop (off for inline use). */
  frame?: boolean;
  className?: string;
  title?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = itemIconKey(item);
  const inner = frame ? Math.max(8, size - 6) : size;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? Math.min(3, window.devicePixelRatio || 1) : 1;
    const sprite = bakeCachedSprite(itemIconModel(item).grid, key, inner * dpr);
    if (!paintSprite(canvas, sprite)) return;
    const k = inner / Math.max(sprite.width, sprite.height);
    canvas.style.width = `${Math.round(sprite.width * k)}px`;
    canvas.style.height = `${Math.round(sprite.height * k)}px`;
    // Only pixelate when enlarging; downsampling looks better smoothed.
    canvas.style.imageRendering = k >= 1 ? "pixelated" : "auto";
  }, [item, key, inner]);

  const hex = SPECTRUM_HEX[item.color];
  const volatile = item.volatility >= 3;
  const f = KIND_FRAME[item.kind];
  return (
    <span
      role="img"
      aria-label={title ?? item.name}
      title={title}
      data-item-icon={item.id}
      className={`relative inline-flex shrink-0 items-center justify-center ${
        frame ? "rounded-[3px] border" : ""
      } ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: frame ? f.border : undefined,
        background: frame
          ? `radial-gradient(circle at 50% 60%, ${hex}26 0%, ${f.bg}0d 55%, #00000059 100%)`
          : undefined,
        boxShadow:
          frame && item.kind === "relikt"
            ? `inset 0 0 0 1px #00000099, inset 0 0 6px ${f.bg}40`
            : undefined,
      }}
    >
      {volatile && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[12%] rounded-full motion-safe:animate-pulse"
          style={{
            background: `radial-gradient(circle, ${hex}${item.volatility >= 5 ? "70" : "48"} 0%, transparent 70%)`,
          }}
        />
      )}
      <canvas
        ref={ref}
        className="relative"
        style={{
          width: inner,
          height: inner,
          filter: volatile ? `drop-shadow(0 0 ${item.volatility - 1}px ${hex})` : undefined,
        }}
      />
      {frame && item.kind === "prototyp" && item.depth > 0 && (
        <span
          aria-hidden
          className="absolute right-0.5 bottom-0 font-mono text-[8px] leading-none text-[#E91E8C]"
        >
          {item.depth}
        </span>
      )}
    </span>
  );
}

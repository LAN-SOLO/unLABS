"use client";

import { useEffect, useRef } from "react";
import { bakeCachedSprite, paintSprite } from "@/components/world/ItemIcon";
import { pieceGrid } from "@/components/world/wardrobe/look-models";
import { colorHex } from "@/lib/world/content/palette";
import { WEAR_BY_ID } from "@/lib/world/content/wardrobe";

/**
 * Pixel-art icon of a wardrobe piece in a colourway (CPU-baked iso sprite,
 * cached). `dim` greys it out (not owned yet); `unknown` hides it as a
 * silhouette (hidden finds in the collection).
 */
export function WearIcon({
  item,
  colorway,
  size = 44,
  dim = false,
  unknown = false,
  title,
}: {
  item: string;
  colorway?: string;
  size?: number;
  dim?: boolean;
  unknown?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = WEAR_BY_ID.get(item);
  const cw = w?.colorways.find((c) => c.id === colorway) ?? w?.colorways[0];
  const inner = Math.max(8, size - 6);

  useEffect(() => {
    const canvas = ref.current;
    const grid = pieceGrid(item, cw?.id);
    if (!canvas || !grid) return;
    const dpr = typeof window !== "undefined" ? Math.min(3, window.devicePixelRatio || 1) : 1;
    const sprite = bakeCachedSprite(grid, `wear:${item}.${cw?.id ?? ""}`, inner * dpr);
    if (!paintSprite(canvas, sprite)) return;
    const k = inner / Math.max(sprite.width, sprite.height);
    canvas.style.width = `${Math.round(sprite.width * k)}px`;
    canvas.style.height = `${Math.round(sprite.height * k)}px`;
    canvas.style.imageRendering = k >= 1 ? "pixelated" : "auto";
  }, [item, cw?.id, inner]);

  const hex = cw ? colorHex(cw.tones.main) : "#444";
  return (
    <span
      role="img"
      aria-label={title ?? w?.name ?? item}
      title={title}
      data-wear-icon={item}
      className="relative inline-flex shrink-0 items-center justify-center rounded-[3px] border border-[#E91E8C]/30"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 60%, ${hex}30 0%, #00000059 100%)`,
      }}
    >
      <canvas
        ref={ref}
        className="relative"
        style={{
          width: inner,
          height: inner,
          filter: unknown
            ? "brightness(0) opacity(0.55)"
            : dim
              ? "grayscale(1) opacity(0.45)"
              : undefined,
        }}
      />
      {unknown && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-sm text-[#E91E8C]/80"
        >
          ?
        </span>
      )}
    </span>
  );
}

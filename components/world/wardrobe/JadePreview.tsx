"use client";

import { tr } from "@/lib/i18n";
import { ModelPreview, type Rotation } from "@/components/world/ModelPreview";
import { CrtButton } from "@/components/world/ui";
import { lookGrid, lookKey } from "@/components/world/wardrobe/look-models";
import type { JadeLook } from "@/lib/world/content/wardrobe";

/**
 * Jade in a look, as a pixel-art iso preview with quarter-turn buttons.
 * `turn` is controlled so hovering through pieces keeps the view direction.
 */
export function JadePreview({
  look,
  turn,
  onTurn,
  size = 220,
  compact = false,
}: {
  look: JadeLook;
  turn: Rotation;
  onTurn: (r: Rotation) => void;
  size?: number;
  /** Small card preview (outfits) without turn buttons. */
  compact?: boolean;
}) {
  const key = lookKey(look);
  // lookGrid caches per look, so hovering through a slot never re-meshes.
  const grid = lookGrid(look);
  const step = (d: 1 | -1) => onTurn(((((turn + d) % 4) + 4) % 4) as Rotation);
  return (
    <div className="flex flex-col items-center gap-1" data-jade-preview={key}>
      <div className="rounded-sm border border-[#E91E8C]/25 bg-[radial-gradient(circle_at_50%_70%,#E91E8C14_0%,#00000000_65%)]">
        <ModelPreview
          grid={grid}
          cacheKey={`jade:${key}`}
          size={size}
          rotation={turn}
          label={tr("Jade in the current look")}
        />
      </div>
      {!compact && (
        <div className="flex items-center gap-2">
          <CrtButton tone="cyan" onClick={() => step(-1)} aria-label={tr("Turn Jade left")}>
            ⟲
          </CrtButton>
          <span className="text-[10px] text-white/40">{tr("turn")}</span>
          <CrtButton tone="cyan" onClick={() => step(1)} aria-label={tr("Turn Jade right")}>
            ⟳
          </CrtButton>
        </div>
      )}
    </div>
  );
}

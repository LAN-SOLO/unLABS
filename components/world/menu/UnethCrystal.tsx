"use client";

import { useEffect, useRef, useState } from "react";
import { getSettings } from "@/lib/world/settings";
import {
  FRAMES,
  FRAME_MS,
  captureLabel,
  randomTraits,
  renderSlice,
  traitCode,
  type SliceColor,
  type SliceTraits,
} from "@/lib/world/uneth-crystal";
import { tr } from "@/lib/i18n";

/** Loops of one variant (2 × 2.4 s) before the next random one turns up. */
const LOOPS_PER_VARIANT = 2;
/** With reduced motion the crystal stands face-on and only the variant changes. */
const STILL_FRAME = 15;
const STILL_HOLD_MS = 6000;

const COLOUR_NAME: Readonly<Record<SliceColor, string>> = {
  white: tr("crystal::White"),
  green: tr("crystal::Green"),
  yellow: tr("crystal::Yellow"),
  blue: tr("crystal::Blue"),
  purple: tr("crystal::Purple"),
  red: tr("crystal::Red"),
  orange: tr("crystal::Orange"),
  rgb: "RGB",
};

/** Colour · style, e.g. "Orange · pure" — the variant's name line. */
function variantName(t: SliceTraits): string {
  const style = captureLabel(t);
  return t.color === "rgb" && style === "RGB"
    ? "RGB"
    : tr("{colour} · {style}", { colour: COLOUR_NAME[t.color], style });
}

/**
 * The unETH crystal of the title screen: the neon capture sculpture turning
 * (30 frames, 80 ms), switching to a random released variant — colour, style,
 * tier, I/O state, era, direction — every couple of turns, with a caption so
 * players see which crystals exist. Frames are rendered once per variant and
 * cached.
 */
export function UnethCrystal({ size = 96, caption = true }: { size?: number; caption?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Client-only: the first variant is picked after mount (no SSR mismatch).
  const [traits, setTraits] = useState<SliceTraits | null>(null);

  useEffect(() => {
    setTraits(randomTraits());
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !traits) return;
    const px = Math.round(size * Math.min(2, window.devicePixelRatio || 1));
    canvas.width = px;
    canvas.height = px;
    const cache: (HTMLCanvasElement | undefined)[] = [];
    const frameCanvas = (f: number): HTMLCanvasElement => {
      let c = cache[f];
      if (!c) {
        c = document.createElement("canvas");
        c.width = px;
        c.height = px;
        renderSlice(c, traits, f, { badge: false });
        cache[f] = c;
      }
      return c;
    };
    const still = getSettings().accessibility.reduceMotion;
    let frame = still ? STILL_FRAME : 0;
    let shown = 0;
    const show = () => {
      ctx.clearRect(0, 0, px, px);
      ctx.drawImage(frameCanvas(frame), 0, 0);
    };
    show();
    if (still) {
      const id = window.setTimeout(() => setTraits(randomTraits()), STILL_HOLD_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setInterval(() => {
      frame = (frame + 1) % FRAMES;
      shown++;
      if (shown >= FRAMES * LOOPS_PER_VARIANT) {
        window.clearInterval(id);
        setTraits(randomTraits());
        return;
      }
      show();
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, [traits, size]);

  return (
    <figure className="m-0 flex flex-col items-center gap-1" style={{ width: size }}>
      <canvas
        ref={ref}
        role="img"
        aria-label={
          traits
            ? tr("unETH crystal: {name}, {code}", {
                name: variantName(traits),
                code: traitCode(traits),
              })
            : tr("unETH crystal")
        }
        style={{ width: size, height: size, mixBlendMode: "screen" }}
      />
      {caption && (
        <figcaption
          aria-hidden
          className="min-h-[2.2em] text-center font-mono text-[9px] leading-tight tracking-wider text-[#33FF33]/55 uppercase"
        >
          {traits && (
            <>
              <span className="text-[#FFB800]/80">{variantName(traits)}</span>
              <br />
              <span className="whitespace-nowrap tabular-nums">{traitCode(traits)}</span>
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}

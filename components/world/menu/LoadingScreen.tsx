"use client";

import { LOADING_TIPS, LORE_QUOTES } from "@/components/world/menu/lore";
import { Octahedron, SCANLINES, UiScale, useRotatingIndex } from "@/components/world/menu/shared";
import { withKeys } from "@/components/world/keys";
import { useSettings } from "@/lib/world/settings";
import { useState } from "react";
import { tr } from "@/lib/i18n";

/**
 * Loading overlay: progress bar plus rotating tips and lore quotes.
 * `progress` 0..1 (omit for an indeterminate bar).
 */
export function LoadingScreen({
  progress,
  label = tr("Powering up the lab …"),
  z = 75,
}: {
  progress?: number;
  label?: string;
  z?: number;
}) {
  const [s] = useSettings();
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  const tipIdx = useRotatingIndex(LOADING_TIPS.length, 6000, seed);
  const quoteIdx = useRotatingIndex(LORE_QUOTES.length, 11000, seed * 7);
  const tip = withKeys(LOADING_TIPS[tipIdx]!, s.controls);
  const quote = LORE_QUOTES[quoteIdx]!;
  const p = progress === undefined ? null : Math.max(0, Math.min(1, progress));
  const motion = !s.accessibility.reduceMotion;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[#050805] font-mono text-[#33FF33]"
      style={{ zIndex: z }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <style>{`@keyframes unlab-indet { from{left:-30%} to{left:100%} }`}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: SCANLINES }}
      />
      <UiScale className="relative flex w-full max-w-xl flex-col items-center gap-6 px-6">
        <Octahedron size={72} />
        <div className="w-full">
          <div className="mb-1 flex justify-between text-xs">
            <span className="tracking-[0.2em] text-[#FFB800] uppercase">{label}</span>
            {p !== null && <span className="tabular-nums">{Math.round(p * 100)} %</span>}
          </div>
          <div
            className="relative h-3 w-full overflow-hidden rounded-sm border border-[#33FF33]/40 bg-black"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={p === null ? undefined : Math.round(p * 100)}
          >
            {p !== null ? (
              <div
                className="h-full bg-[#33FF33] shadow-[0_0_10px_#33FF33] transition-[width] duration-300"
                style={{ width: `${p * 100}%` }}
              />
            ) : (
              <div
                className="absolute inset-y-0 w-[30%] bg-[#33FF33]/70"
                style={{ animation: motion ? "unlab-indet 1.4s linear infinite" : undefined }}
              />
            )}
          </div>
        </div>
        <div className="min-h-16 w-full rounded-sm border border-[#33FF33]/20 bg-[#0D0D0D]/80 p-3">
          <div className="mb-1 text-[10px] tracking-[0.3em] text-[#00FFFF] uppercase">
            {tr("Tip")}
          </div>
          <p className="text-sm text-[#d8ffd8]">{tip}</p>
        </div>
        <figure className="w-full text-center">
          <blockquote className="text-xs text-[#d8ffd8]/70 italic">
            {tr("“{text}”", { text: quote.text })}
          </blockquote>
          <figcaption className="mt-1 text-[10px] text-[#FFB800]/70">— {quote.by}</figcaption>
        </figure>
      </UiScale>
    </div>
  );
}

"use client";

/**
 * Compact CRT popover for furniture interactions (`runDecorAction`).
 * Types the text out (instant with reduceMotion or text speed "sofort"),
 * shows an optional speaker and the resulting effects (buff chip, items,
 * insights). Remount per result (`key`). Esc / Enter / E / Space close it; the first press while
 * typing reveals the whole text instead.
 */
import { tr } from "@/lib/i18n";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ItemIcon } from "@/components/world/ItemIcon";
import { CrtButton } from "@/components/world/puzzles/ui";
import { BuffChip } from "@/components/world/ui";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { INSIGHT_BY_ID, NPC_SPEAKERS } from "@/lib/world/content/story";
import type { DecorActionResult } from "@/lib/world/decor-actions";
import { textCharsPerSecond, useSettings } from "@/lib/world/settings";

const VERB_TAG: Record<DecorActionResult["verb"], string> = {
  benutzen: tr("decor verb::used"),
  lesen: tr("decor verb::read"),
  hören: tr("decor verb::heard"),
  ansehen: tr("decor verb::viewed"),
  sitzen: tr("decor verb::break"),
  liegen: tr("decor verb::rest"),
  trinken: tr("decor verb::drunk"),
};

export function DecorActionPanel({
  result,
  onClose,
  extra,
}: {
  result: DecorActionResult;
  onClose: () => void;
  /** Host content shown once the text is out (e.g. "Use with prototype …"). */
  extra?: ReactNode;
}) {
  const [settings] = useSettings();
  const instant = settings.accessibility.reduceMotion || settings.gameplay.textSpeed === "sofort";
  const cps = instant ? Number.POSITIVE_INFINITY : textCharsPerSecond(settings.gameplay.textSpeed);
  const total = result.text.length;
  const [shown, setShown] = useState(instant ? total : 0);
  const done = shown >= total;
  // Typewriter (interval, not rAF, so it keeps flowing in background tabs).
  // Remount per result (`key`) to restart it.
  useEffect(() => {
    if (!Number.isFinite(cps)) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const n = Math.min(total, Math.floor(((performance.now() - start) / 1000) * cps));
      setShown((prev) => Math.max(prev, n));
      if (n >= total) window.clearInterval(id);
    }, 30);
    return () => window.clearInterval(id);
  }, [cps, total]);

  const advance = useCallback(() => {
    if (!done) setShown(total);
    else onClose();
  }, [done, onClose, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Enter" || e.key === " " || e.key.toLowerCase() === "e") {
        e.preventDefault();
        e.stopPropagation();
        advance();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [advance, onClose]);

  const speaker = result.who ? NPC_SPEAKERS[result.who] : undefined;
  const hasEffects = !!result.buff || result.items.length > 0 || result.insights.length > 0;
  const calm = settings.accessibility.reduceMotion;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4"
      role="dialog"
      aria-label={result.label}
    >
      <div
        className="pointer-events-auto relative w-full max-w-md cursor-pointer rounded-sm border border-[#FFB800]/40 bg-[#0D0D0D]/95 font-mono text-[#33FF33] shadow-[0_0_30px_rgba(0,0,0,0.8)]"
        onMouseDown={(e) => {
          e.stopPropagation();
          advance();
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)",
          }}
        />
        <div className="flex items-center justify-between gap-3 border-b border-[#FFB800]/20 px-4 pt-3 pb-2">
          <h2 className="truncate text-xs tracking-[0.2em] text-[#FFB800] uppercase">
            {result.label}
          </h2>
          <span className="shrink-0 text-[10px] tracking-widest text-[#33FF33]/50 uppercase">
            {result.resting ? "…" : VERB_TAG[result.verb]}
          </span>
        </div>
        <div className="relative px-4 py-3 text-sm leading-relaxed">
          {speaker && (
            <p className="mb-1 text-xs tracking-wider uppercase" style={{ color: speaker.color }}>
              {speaker.name}
            </p>
          )}
          <p
            className={result.who ? "text-[#E8F4FF]" : "text-[#d8ffd8]"}
            aria-live="polite"
            aria-label={result.text}
          >
            {result.who ? tr("quote::“") : ""}
            {result.text.slice(0, shown)}
            {done && result.who ? tr("quote::”") : ""}
            {!done && (
              <span
                aria-hidden
                className={calm ? "text-[#33FF33]" : "animate-pulse text-[#33FF33]"}
              >
                ▌
              </span>
            )}
          </p>
          {done && hasEffects && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#33FF33]/15 pt-2 text-xs">
              {result.buff && <BuffChip buff={result.buff} />}
              {result.items.map((it) => {
                const def = ITEM_BY_ID.get(it.item);
                return (
                  <span
                    key={it.item}
                    className="flex items-center gap-1.5 rounded-sm border border-[#33FF33]/30 px-1.5 py-0.5 text-[#d8ffd8]"
                  >
                    {def && <ItemIcon item={def} size={20} frame={false} />}
                    {def?.name ?? it.item}
                    <span className="text-[#FFB800]">+{it.count}</span>
                  </span>
                );
              })}
              {result.insights.map((id) => (
                <span
                  key={id}
                  className="rounded-sm border border-[#FFB800]/40 px-2 py-0.5 text-[#FFB800]"
                >
                  {tr("Insight: {title}", { title: INSIGHT_BY_ID.get(id)?.title ?? id })}
                </span>
              ))}
            </div>
          )}
          {done && extra && (
            <div className="mt-3 cursor-auto" onMouseDown={(e) => e.stopPropagation()}>
              {extra}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <CrtButton
              tone="amber"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onClose}
              aria-label={tr("Close")}
            >
              {done ? tr("OK [E]") : tr("Next")}
            </CrtButton>
          </div>
        </div>
      </div>
    </div>
  );
}

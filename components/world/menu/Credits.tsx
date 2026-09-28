"use client";

import { useEffect, useRef, useState } from "react";
import { FULL_CREDITS, type CreditBlock } from "@/components/world/menu/lore";
import {
  CrtButton,
  MenuKeyframes,
  Octahedron,
  SCANLINES,
  UiScale,
  useEscLayer,
} from "@/components/world/menu/shared";
import { useSettings } from "@/lib/world/settings";
import { tr } from "@/lib/i18n";

/** Pixels per second of the roll (normal / fast-forward). */
export const CREDITS_SPEED = 38;
export const CREDITS_FAST = 6;

function Block({ block, index }: { block: CreditBlock; index: number }) {
  return (
    <section className="flex w-full flex-col gap-2">
      <h3 className="flex items-center justify-center gap-3 text-xs tracking-[0.3em] text-[#FFB800] uppercase">
        <span className="text-[#33FF33]/35">[{String(index + 1).padStart(2, "0")}]</span>
        {block.heading}
      </h3>
      {block.lines.map((l, i) =>
        typeof l === "string" ? (
          <p key={i} className="text-sm text-[#d8ffd8]/80 italic">
            {l}
          </p>
        ) : (
          <p key={i} className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 text-sm">
            <span className="text-right text-[#d8ffd8]">{l[0]}</span>
            <span className="text-[#33FF33]/40">·</span>
            <span className="text-left text-[#00FFFF]/80">{l[1]}</span>
          </p>
        ),
      )}
    </section>
  );
}

/**
 * Full-screen scrolling in-universe credits ("personnel file").
 * Hold Space/↓ to fast-forward, ↑ to roll back; Esc, Enter, a click or
 * "Skip" closes. The roll closes itself at the end. With
 * `reduceMotion` it is a static, manually scrollable list instead.
 */
export function Credits({
  onClose,
  z = 80,
  blocks = FULL_CREDITS,
}: {
  onClose: () => void;
  z?: number;
  blocks?: readonly CreditBlock[];
}) {
  const [s] = useSettings();
  useEscLayer(onClose);
  const roll = !s.accessibility.reduceMotion;
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [fast, setFast] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Keyboard: hold to fast-forward / rewind, Enter to skip.
  const dir = useRef<1 | -1>(1);
  const boost = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        boost.current = true;
        dir.current = 1;
        setFast(true);
      } else if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        boost.current = true;
        dir.current = -1;
        setFast(true);
      } else if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        closeRef.current();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (["Space", "ArrowDown", "KeyS", "ArrowUp", "KeyW"].includes(e.code)) {
        boost.current = false;
        dir.current = 1;
        setFast(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // The roll itself (rAF, frame-rate independent, paused while the tab is hidden).
  useEffect(() => {
    if (!roll) return;
    let raf = 0;
    let last = 0;
    let y = 0;
    let doneAt = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (document.hidden) return;
      const vh = viewport.current?.clientHeight ?? 0;
      const ch = content.current?.scrollHeight ?? 0;
      const end = ch + vh;
      const speed = CREDITS_SPEED * (boost.current ? CREDITS_FAST : 1) * dir.current;
      y = Math.max(0, Math.min(end, y + speed * dt));
      if (content.current) content.current.style.transform = `translateY(${vh - y}px)`;
      if (bar.current) bar.current.style.width = `${end > 0 ? (y / end) * 100 : 0}%`;
      if (end > 0 && y >= end) {
        doneAt ||= now;
        if (now - doneAt > 1200) {
          cancelAnimationFrame(raf);
          closeRef.current();
        }
      } else doneAt = 0;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [roll]);

  const body = (
    <div className="flex flex-col items-center gap-10 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <Octahedron size={80} />
        <div className="text-4xl font-bold tracking-[0.12em] text-[#33FF33] [text-shadow:0_0_14px_rgba(51,255,51,.5)]">
          _unLAB
        </div>
        <div className="text-xs tracking-[0.35em] text-[#FFB800] uppercase">
          {tr("Personnel file · Credits")}
        </div>
        <div className="text-[10px] tracking-[0.2em] text-[#33FF33]/45 uppercase">
          {tr("UnstableLabs underground facility · dormant for 2,561 days")}
        </div>
      </div>
      {blocks.map((block, i) => (
        <Block key={block.heading} block={block} index={i} />
      ))}
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm text-[#E8F4FF]/80 italic">Keep listening. Keep building.</p>
        <p className="text-[10px] tracking-[0.3em] text-[#33FF33]/40 uppercase">
          {tr("End of transmission")}
        </p>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black/95 font-mono"
      style={{ zIndex: z }}
      role="dialog"
      aria-label={tr("Credits")}
      onClick={roll ? onClose : undefined}
    >
      <MenuKeyframes />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: SCANLINES }}
      />
      {/* Fade the roll in and out at the top/bottom edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(180deg, #000 0%, transparent 14%, transparent 86%, #000 100%)",
        }}
      />
      <UiScale className="relative mx-auto h-full max-w-2xl px-4">
        {roll ? (
          <div ref={viewport} className="h-full overflow-hidden">
            <div ref={content} style={{ transform: "translateY(100vh)", willChange: "transform" }}>
              {body}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {body}
          </div>
        )}
      </UiScale>
      <div
        className="absolute top-4 right-4 z-20 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {roll && (
          <span className="hidden text-[10px] text-[#33FF33]/45 sm:inline">
            {fast ? tr(">> Fast-forward") : tr("Hold Space: fast-forward · ↑ back")}
          </span>
        )}
        <CrtButton tone="amber" onClick={onClose}>
          {tr("Skip")}
        </CrtButton>
      </div>
      {roll && (
        <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-[#33FF33]/10" aria-hidden>
          <div ref={bar} className="h-full bg-[#FFB800]/70" style={{ width: 0 }} />
        </div>
      )}
    </div>
  );
}

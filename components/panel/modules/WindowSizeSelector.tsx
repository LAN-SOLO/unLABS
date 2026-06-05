"use client";

import { useState, useCallback, useEffect, useRef } from "react";

import { getElectronConfig } from "@/lib/desktop";

const WINDOW_PRESETS = [
  { label: "1K 4:3", w: 1024, h: 768 },
  { label: "1K 3:2", w: 1080, h: 720 },
  { label: "2K 4:3", w: 1600, h: 1200 },
  { label: "2K 3:2", w: 1920, h: 1280 },
  { label: "3K 4:3", w: 2560, h: 1920 },
  { label: "3K 3:2", w: 2880, h: 1920 },
  { label: "4K 4:3", w: 3840, h: 2880 },
  { label: "4K 3:2", w: 3840, h: 2560 },
] as const;

export function WindowSizeSelector() {
  const [idx, setIdx] = useState(-1);
  const panelRef = useRef<HTMLElement | null>(null);
  const originalSizeRef = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    panelRef.current = document.querySelector(".game-panel") as HTMLElement | null;
    // Store original window size for reset
    originalSizeRef.current = { w: window.innerWidth, h: window.innerHeight };
  }, []);

  const apply = useCallback((i: number) => {
    const electron = getElectronConfig();
    const isDesktop = electron?.isDesktop && typeof electron.resizeWindow === "function";

    if (isDesktop) {
      // Desktop mode: actually resize the Electron window
      if (i < 0) {
        // Reset to original size
        const orig = originalSizeRef.current;
        if (orig) {
          electron.resizeWindow!(orig.w, orig.h);
        }
        return;
      }
      const preset = WINDOW_PRESETS[i];
      electron.resizeWindow!(preset.w, preset.h);
    } else {
      // Browser mode: use CSS transform scaling as fallback
      const panel =
        panelRef.current ?? (document.querySelector(".game-panel") as HTMLElement | null);
      if (!panel) return;

      if (i < 0) {
        panel.style.transform = "";
        panel.style.transformOrigin = "";
        document.body.style.overflow = "";
        document.body.style.background = "";
        return;
      }

      const preset = WINDOW_PRESETS[i];
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const scaleX = vw / preset.w;
      const scaleY = vh / preset.h;
      const scale = Math.min(scaleX, scaleY, 1);

      panel.style.transform = `scale(${scale})`;
      panel.style.transformOrigin = "center center";
      document.body.style.overflow = "hidden";
      document.body.style.background = "#000";
      document.body.style.display = "flex";
      document.body.style.alignItems = "center";
      document.body.style.justifyContent = "center";
    }
  }, []);

  const cycle = useCallback(() => {
    const next = ((idx < 0 ? -1 : idx) + 1) % WINDOW_PRESETS.length;
    setIdx(next);
    apply(next);
  }, [idx, apply]);

  const reset = useCallback(() => {
    setIdx(-1);
    apply(-1);
  }, [apply]);

  const cur = idx >= 0 ? WINDOW_PRESETS[idx] : null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        onClick={cycle}
        className="flex h-7 cursor-pointer items-center gap-1.5 rounded border border-[var(--neon-green)]/30 bg-[var(--panel-surface-light)] px-2.5 transition-all hover:border-[var(--neon-green)]/60 hover:bg-[var(--neon-green)]/5 active:bg-[var(--neon-green)]/10"
        title={cur ? `${cur.label} (${cur.w}\u00d7${cur.h})` : "Cycle window size presets"}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
          <rect
            x="1"
            y="1"
            width="8"
            height="6"
            rx="0.5"
            stroke="var(--neon-green)"
            strokeWidth="1"
          />
          <line x1="3" y1="9" x2="7" y2="9" stroke="var(--neon-green)" strokeWidth="1" />
        </svg>
        <span className="font-mono text-[8px] tracking-wider text-[var(--neon-green)]">
          {cur ? cur.label : "AUTO"}
        </span>
        {cur && (
          <span className="font-mono text-[7px] text-white/30">
            {cur.w}&times;{cur.h}
          </span>
        )}
      </button>
      {idx >= 0 && (
        <button
          onClick={reset}
          className="flex h-7 cursor-pointer items-center rounded border border-white/10 bg-[var(--panel-surface-light)] px-1.5 transition-all hover:border-white/30"
          title="Reset to auto"
        >
          <span className="font-mono text-[7px] text-white/40">&times;</span>
        </button>
      )}
    </div>
  );
}

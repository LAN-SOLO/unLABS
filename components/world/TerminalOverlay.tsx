"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CrtButton } from "@/components/world/puzzles/ui";
import type { Toast } from "@/components/world/useWorld";
import { absorbTerminalEvents } from "@/lib/world/bridge";
import { getActiveSlot, slotOf } from "@/lib/world/save";
import { EMBED_TERMINAL_PATH, isCloseTerminalMessage } from "@/lib/terminal/embed";
import type { WorldState } from "@/lib/world/types";

/** The slice of `useWorld()` the terminal sync needs. */
export interface TerminalWorldApi {
  get(): WorldState;
  act<T>(fn: (s: WorldState) => T): T;
  toast(text: string, tone?: Toast["tone"]): void;
}

/**
 * Re-apply the events the big terminal queued (`labor signal …`, power
 * switches) onto the live world state and toast them. Idempotent; returns
 * the number of events taken. Used on mount, on `storage` events and when
 * the terminal overlay closes.
 */
export function absorbTerminalIntoWorld(w: TerminalWorldApi): number {
  const slot = slotOf(w.get()) ?? getActiveSlot();
  const { events } = w.act((st) => absorbTerminalEvents(st, slot));
  for (const e of events) {
    w.toast(tr("Main Console: {title}", { title: e.title }), "insight");
    if (e.lines[0]) w.toast(e.lines[0], "info");
  }
  return events.length;
}

export interface TerminalOverlayProps {
  /** Close the overlay (Back button, Esc, or the terminal asking via postMessage). */
  onClose: () => void;
  /** Runs before the terminal starts loading — flush the world save here. */
  onOpen?: () => void;
  /** Frame source; the embedded terminal by default. */
  src?: string;
}

/**
 * The big _unOS terminal in-game: a full-screen CRT frame over the running
 * (paused) lab with the terminal page in a same-origin iframe. Not logged in
 * → the login page shows inside the frame; the Back button always works.
 * While open, all keys stay out of the game (capture phase); Esc closes.
 */
export function TerminalOverlay({
  onClose,
  onOpen,
  src = EMBED_TERMINAL_PATH,
}: TerminalOverlayProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const started = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef(onClose);
  const openRef = useRef(onOpen);
  useEffect(() => {
    closeRef.current = onClose;
    openRef.current = onOpen;
  });

  // Flush first, then point the frame at the terminal: the terminal reads
  // the world slot on boot, so it must see the current state.
  useLayoutEffect(() => {
    openRef.current?.();
    started.current = true;
    if (frameRef.current) frameRef.current.src = src;
  }, [src]);

  // The embedded terminal asks to close (`back`, `exit`, `labor world`, Esc).
  useEffect(() => {
    const onMessage = (e: MessageEvent): void => {
      if (e.origin !== window.location.origin || !isCloseTerminalMessage(e.data)) return;
      const frame = frameRef.current?.contentWindow;
      if (!frame || e.source !== frame) return;
      closeRef.current();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Keys pressed in the parent document (the frame has its own) never reach
  // the game or the title menu underneath; Esc closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      e.stopImmediatePropagation();
      if (e.type === "keydown" && e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      // Space/Enter are game keys — never leave focus on a button behind us.
      const a = document.activeElement;
      if (a instanceof HTMLElement && a !== document.body) a.blur();
    };
  }, []);

  const onLoad = (): void => {
    // The initial about:blank load fires before the src is set — ignore it.
    if (!started.current) return;
    setLoaded(true);
    frameRef.current?.contentWindow?.focus();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr("Main Console · _unOS terminal")}
      className="fixed inset-0 z-[80] flex flex-col bg-black/85 p-2 font-mono sm:p-4"
    >
      <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-md border-2 border-[#33FF33]/40 bg-black shadow-[0_0_40px_rgba(51,255,51,0.18),inset_0_0_30px_rgba(0,0,0,0.9)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#33FF33]/30 bg-[#0b1a0b] px-3 py-1.5">
          <CrtButton tone="amber" onClick={() => closeRef.current()}>
            ← {tr("Back to the lab")} [Esc]
          </CrtButton>
          <span className="truncate text-[11px] tracking-wider text-[#33FF33]/70 uppercase">
            {tr("Main Console · _unOS terminal")}
          </span>
        </div>
        <div className="relative flex-1 bg-black">
          {!loaded && (
            <p className="absolute inset-0 flex animate-pulse items-center justify-center text-sm text-[#FFB800]">
              {tr("Connecting to the Main Console …")}
            </p>
          )}
          <iframe
            ref={frameRef}
            title={tr("Main Console · _unOS terminal")}
            onLoad={onLoad}
            className={`absolute inset-0 h-full w-full border-0 transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          />
          {/* CRT glass: scanlines + vignette over the terminal. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)",
              boxShadow: "inset 0 0 90px rgba(0,0,0,0.75)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

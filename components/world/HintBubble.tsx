"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { CrtButton } from "@/components/world/ui";
import {
  CONTROL_ACTIONS,
  labelForCode,
  useSettings,
  type ControlAction,
  type Controls,
} from "@/lib/world/settings";
import type { Hint } from "@/lib/world/tutorial";

/** Auto-dismiss after this many milliseconds. */
export const HINT_AUTO_DISMISS_MS = 9000;
const FADE_MS = 220;

function isAction(key: string): key is ControlAction {
  return (CONTROL_ACTIONS as readonly string[]).includes(key);
}

/** A rebindable action shows its current key; anything else is a literal label. */
export function hintKeyLabel(key: string, controls: Controls): string {
  return isAction(key) ? labelForCode(controls[key]) : key;
}

function KeyCap({ label }: { label: string }) {
  return (
    <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded-[3px] border border-b-[3px] border-[#FFB800]/60 bg-[#1A1A1A] px-1.5 py-0.5 font-mono text-[11px] leading-none text-[#FFB800] shadow-[0_0_6px_rgba(255,184,0,0.25)]">
      {label}
    </kbd>
  );
}

/**
 * Small non-blocking hint card, bottom-centre above the controls line.
 * Remount per hint (`key={hint.id}`) so the timers restart.
 */
export function HintBubble({ hint, onDismiss }: { hint: Hint; onDismiss: () => void }) {
  const [settings] = useSettings();
  const reduceMotion = settings.accessibility.reduceMotion;
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(onDismiss, reduceMotion ? 0 : FADE_MS);
    return () => window.clearTimeout(id);
  }, [leaving, onDismiss, reduceMotion]);

  useEffect(() => {
    const id = window.setTimeout(() => setLeaving(true), HINT_AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, []);

  const visible = shown && !leaving;
  const keys = hint.keys ?? [];

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute bottom-10 left-1/2 z-[60] w-[min(520px,92vw)] -translate-x-1/2"
    >
      <div
        className="pointer-events-auto relative overflow-hidden rounded-sm border border-[#FFB800]/50 bg-[#0D0D0D]/95 px-4 py-3 font-mono text-[#33FF33] shadow-[0_0_24px_rgba(0,0,0,0.8),0_0_12px_rgba(255,184,0,0.15)]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible || reduceMotion ? "translateY(0)" : "translateY(10px)",
          transition: reduceMotion
            ? "none"
            : `opacity ${FADE_MS}ms ease-out, transform ${FADE_MS}ms ease-out`,
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
        <div className="relative flex items-start gap-3">
          <span aria-hidden className="mt-0.5 text-sm text-[#FFB800]">
            ◈
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-[0.2em] text-[#FFB800] uppercase">
              {tr("Hint · {title}", { title: hint.title })}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#d8ffd8]">
              {keys.length > 0 && (
                <span className="mr-1.5 inline-flex flex-wrap gap-1 align-middle">
                  {keys.map((k) => (
                    <KeyCap key={k} label={hintKeyLabel(k, settings.controls)} />
                  ))}
                </span>
              )}
              {hint.text}
            </p>
          </div>
          <CrtButton tone="amber" className="shrink-0" onClick={() => setLeaving(true)}>
            {tr("Got it")}
          </CrtButton>
        </div>
        {!reduceMotion && (
          <div
            aria-hidden
            className="absolute bottom-0 left-0 h-px bg-[#FFB800]/60"
            style={{
              width: visible ? "0%" : "100%",
              transition: visible ? `width ${HINT_AUTO_DISMISS_MS}ms linear` : "none",
            }}
          />
        )}
      </div>
    </div>
  );
}

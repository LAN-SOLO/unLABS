"use client";

/**
 * Cold open for a new game + the cinematic title card.
 * ====================================================
 *
 * `IntroSequence` is the black "transmission" card shown before the wake
 * scene (scenes.ts `wake`): a timestamp, the gap of 2.561 days and three
 * short paragraphs, typewritten. Space / click completes the current
 * paragraph, then advances; Esc or "Skip" jumps straight to the
 * scene. It ends on black, so the scene (which starts with `fade(1, 0)`)
 * picks up without a visible cut.
 *
 * `SceneTitleCard` renders a scene's `title` step (big letter-spaced name
 * and a subline) over the letterboxed picture for `seconds`.
 */
import { tr } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CrtButton,
  MenuKeyframes,
  SCANLINES,
  UiScale,
  useEscLayer,
} from "@/components/world/menu/shared";
import { useSettings } from "@/lib/world/settings";

export interface IntroParagraph {
  text: string;
  /** Tailwind classes for the paragraph. */
  tone?: "stamp" | "body" | "quiet" | "motto";
}

/** The cold-open text, in order. */
export const INTRO_PARAGRAPHS: readonly IntroParagraph[] = [
  { text: tr("02/14/2019 · 03:41:22 UTC"), tone: "stamp" },
  { text: tr("+ 2,561 days"), tone: "stamp" },
  {
    text: tr(
      "My name is Jade Lawrence. Seven years ago Damien and I started the Infinity Forge. Coherence rose past σ-17 — and then we were no longer at our stations.",
    ),
    tone: "body",
  },
  {
    text: tr("I am back. Damien is not. Somewhere between the signals he is still there."),
    tone: "body",
  },
  { text: tr("The lab has to run again. Device by device."), tone: "quiet" },
  { text: tr("Performance before understanding."), tone: "motto" },
];

const TONE: Record<NonNullable<IntroParagraph["tone"]>, string> = {
  stamp: "text-[11px] tracking-[0.4em] text-[#FFB800]/80 uppercase",
  body: "text-base leading-relaxed text-[#E8F4FF] [text-shadow:0_0_8px_rgba(232,244,255,.3)]",
  quiet: "text-sm leading-relaxed text-[#d8ffd8]/70",
  motto:
    "text-sm tracking-[0.2em] text-[#33FF33] italic [text-shadow:0_0_10px_rgba(51,255,51,.45)]",
};

/** Characters per second of the typewriter. */
const CPS = 46;
/** Pause after a finished paragraph before the next one starts (ms). */
const PARAGRAPH_GAP_MS = 520;

export interface IntroSequenceProps {
  /** Called once when the card is done (read, advanced or skipped). */
  onDone: () => void;
  /** Optional typing sound (e.g. `sound("typewriter_tick")`), throttled. */
  onTick?: () => void;
}

export function IntroSequence({ onDone, onTick }: IntroSequenceProps) {
  const [settings] = useSettings();
  const instant = settings.accessibility.reduceMotion;
  const [para, setPara] = useState(instant ? INTRO_PARAGRAPHS.length - 1 : 0);
  const [shown, setShown] = useState(
    instant ? INTRO_PARAGRAPHS[INTRO_PARAGRAPHS.length - 1]!.text.length : 0,
  );
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);
  const current = INTRO_PARAGRAPHS[para]!;
  const typing = shown < current.text.length;
  const last = para === INTRO_PARAGRAPHS.length - 1;
  const finished = last && !typing;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    // Let the text fade out on black before the scene takes over.
    window.setTimeout(onDone, instant ? 0 : 450);
  }, [onDone, instant]);

  // Typewriter.
  const tickRef = useRef(onTick);
  useEffect(() => {
    tickRef.current = onTick;
  });
  useEffect(() => {
    if (!typing || leaving) return;
    const step = Math.max(1, Math.round(CPS / 30));
    const t = window.setTimeout(() => {
      setShown((n) => Math.min(current.text.length, n + step));
      if (current.text[shown] && current.text[shown] !== " ") tickRef.current?.();
    }, 1000 / 30);
    return () => window.clearTimeout(t);
  }, [typing, shown, current, leaving]);

  // Next paragraph after a short beat.
  useEffect(() => {
    if (typing || last || leaving) return;
    const t = window.setTimeout(() => {
      setPara((p) => p + 1);
      setShown(0);
    }, PARAGRAPH_GAP_MS);
    return () => window.clearTimeout(t);
  }, [typing, last, leaving]);

  const advance = useCallback(() => {
    if (leaving) return;
    if (typing) setShown(current.text.length);
    else if (!last) {
      setPara((p) => p + 1);
      setShown(0);
    } else finish();
  }, [leaving, typing, current, last, finish]);

  useEscLayer(finish);

  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "BUTTON" || t.tagName === "INPUT")) return;
      e.preventDefault();
      advanceRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const buttonRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (finished) buttonRef.current?.querySelector("button")?.focus();
  }, [finished]);

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden bg-black font-mono"
      role="dialog"
      aria-modal="true"
      aria-label={tr("Cold open")}
      onClick={advance}
    >
      <MenuKeyframes />
      <UiScale className="relative flex h-full items-center justify-center px-6">
        <div
          className="flex w-full max-w-2xl flex-col gap-5 transition-opacity duration-500"
          style={{ opacity: leaving ? 0 : 1 }}
        >
          {INTRO_PARAGRAPHS.slice(0, para + 1).map((p, i) => {
            const text = i < para ? p.text : p.text.slice(0, shown);
            return (
              <p
                key={i}
                className={TONE[p.tone ?? "body"]}
                style={{ animation: instant ? undefined : "unlab-fade .5s ease-out" }}
              >
                {text}
                {i === para && typing && (
                  <span
                    aria-hidden
                    className="ml-0.5 inline-block h-[1em] w-[0.55em] translate-y-[0.15em] bg-current"
                    style={{ animation: "unlab-caret 1s steps(1) infinite" }}
                  />
                )}
              </p>
            );
          })}
          <div
            ref={buttonRef}
            className="mt-4 flex h-10 items-center gap-3 transition-opacity duration-500"
            style={{ opacity: finished && !leaving ? 1 : 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {finished && (
              <CrtButton tone="amber" onClick={finish}>
                {tr("Get up")}
              </CrtButton>
            )}
          </div>
        </div>
      </UiScale>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: SCANLINES }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 50%, #000 100%)" }}
      />
      {!leaving && (
        <div className="absolute right-4 bottom-4 flex items-center gap-4">
          <p className="pointer-events-none text-[10px] tracking-[0.25em] text-[#33FF33]/40 uppercase">
            {tr("Space / click: continue")}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              finish();
            }}
            className="border border-white/25 bg-black/60 px-3 py-1 text-[11px] text-white/60 hover:text-white"
          >
            {tr("Skip ›")}
          </button>
        </div>
      )}
    </div>
  );
}

const TITLE_KEYFRAMES = `
@keyframes unlab-title-card {
  0% { opacity: 0; letter-spacing: 0.6em; filter: blur(3px); }
  18% { opacity: 1; letter-spacing: 0.32em; filter: blur(0); }
  80% { opacity: 1; letter-spacing: 0.3em; }
  100% { opacity: 0; letter-spacing: 0.28em; }
}
@keyframes unlab-title-rule { 0% { transform: scaleX(0); } 25%, 100% { transform: scaleX(1); } }
`;

export interface SceneTitleCardProps {
  title: string;
  sub?: string;
  /** How long the card stays (it fades in and out within this time). */
  seconds: number;
}

/**
 * A scene's title card, centred over the picture. Remount per card
 * (`key={title}`) so the animation restarts; pointer-events pass through.
 */
export function SceneTitleCard({ title, sub, seconds }: SceneTitleCardProps) {
  const [settings] = useSettings();
  const reduce = settings.accessibility.reduceMotion;
  const dur = `${Math.max(0.5, seconds)}s`;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center font-mono"
    >
      <style>{TITLE_KEYFRAMES}</style>
      <div
        className="flex flex-col items-center gap-3 text-center"
        style={{ animation: reduce ? undefined : `unlab-title-card ${dur} ease-out forwards` }}
      >
        <p className="text-3xl font-bold tracking-[0.3em] text-[#33FF33] uppercase [text-shadow:0_0_14px_rgba(51,255,51,.55),0_2px_6px_rgba(0,0,0,.9)] sm:text-5xl">
          {title}
        </p>
        <span
          aria-hidden
          className="h-px w-48 origin-center bg-[#FFB800]/70"
          style={{ animation: reduce ? undefined : `unlab-title-rule ${dur} ease-out forwards` }}
        />
        {sub && (
          <p className="text-xs tracking-[0.35em] text-[#FFB800] uppercase [text-shadow:0_2px_4px_rgba(0,0,0,.9)]">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

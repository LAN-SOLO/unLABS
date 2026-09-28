"use client";

/**
 * Full-screen post-ending sequence.
 * =================================
 *
 * Shown after an ending scene (scenes.ts, `keepFade`) has faded to black:
 *   1. epilogue    — the ending's epilogue from story.ts, typewritten on black
 *   2. aftermath   — "What happened next" (postgame.ts `aftermath`)
 *   3. stats       — play time, devices, insights, achievements, endings x/5
 *   4. credits     — the in-universe credits (menu/lore `CREDITS`), rolling once
 *   5. end         — "Stay in the lab" / "Main menu"
 *
 * Space, Esc or a click first completes the current text, then advances;
 * "Skip" jumps straight to the end page. The epilogue carries a
 * voxel still of the place where the ending happened (the anchor device,
 * or the forge), the report reveals its rows one by one.
 * With `reduceMotion` all text appears instantly and nothing scrolls.
 */
import { tr } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ModelPreview } from "@/components/world/ModelPreview";
import { CREDITS } from "@/components/world/menu/lore";
import {
  CrtButton,
  MenuKeyframes,
  Octahedron,
  SCANLINES,
  UiScale,
  useEscLayer,
} from "@/components/world/menu/shared";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ENDING_BY_ID } from "@/lib/world/content/story";
import { deviceModel } from "@/lib/world/models/devices";
import { propModel } from "@/lib/world/models/props";
import type { VoxelGrid } from "@/lib/voxel/grid";
import { aftermath, endingStats } from "@/lib/world/postgame";
import { formatPlayTime } from "@/lib/world/save";
import { ENDING_SIGNATURE, isEndingId } from "@/lib/world/scenes";
import { useSettings } from "@/lib/world/settings";
import type { WorldState } from "@/lib/world/types";

export const ENDING_SEQUENCE_PAGES = ["epilogue", "aftermath", "stats", "credits", "end"] as const;
export type EndingSequencePage = (typeof ENDING_SEQUENCE_PAGES)[number];

export interface EndingSequenceProps {
  endingId: string;
  state: WorldState;
  /** "Stay in the lab" — back to free play. */
  onContinue: () => void;
  /** "Main menu" — back to the title screen. */
  onMainMenu: () => void;
  /** Characters per second for the typewriter (default 42). */
  cps?: number;
}

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")";

const KEYFRAMES = `
@keyframes unlab-grain { 0%{transform:translate(0,0)} 25%{transform:translate(-3%,2%)} 50%{transform:translate(2%,-3%)} 75%{transform:translate(-2%,-1%)} 100%{transform:translate(0,0)} }
@keyframes unlab-afterglow { 0%{opacity:.95} 100%{opacity:0} }
@keyframes unlab-credits { from{transform:translateY(0)} to{transform:translateY(-100%)} }
@keyframes unlab-still { 0%{opacity:0;transform:scale(1.08)} 20%{opacity:1} 100%{opacity:1;transform:scale(1)} }
@keyframes unlab-row { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
`;

/** The voxel still for an ending: its anchor device, or the forge prop. */
export function endingStill(endingId: string): { grid: VoxelGrid; key: string } | null {
  const e = ENDING_BY_ID.get(endingId);
  if (!e) return null;
  try {
    if (DEVICE_BY_ID.has(e.device))
      return { grid: deviceModel(e.device).grid, key: `ending:${e.device}` };
    return { grid: propModel(e.device).grid, key: `ending:prop:${e.device}` };
  } catch {
    return null;
  }
}

/** Reveals `total` characters over time; `instant` shows everything at once. */
function useTypewriter(
  total: number,
  cps: number,
  instant: boolean,
  key: string,
): [number, () => void] {
  const [shown, setShown] = useState(instant ? total : 0);
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    setShown(instant ? total : 0);
  }
  useEffect(() => {
    if (instant || shown >= total) return;
    const step = Math.max(1, Math.round(cps / 30));
    const t = window.setTimeout(() => setShown((n) => Math.min(total, n + step)), 1000 / 30);
    return () => window.clearTimeout(t);
  }, [shown, total, cps, instant]);
  const complete = useCallback(() => setShown(total), [total]);
  return [instant ? total : shown, complete];
}

/** Slice a list of paragraphs to the first `n` characters. */
function sliceParagraphs(paras: readonly string[], n: number): string[] {
  const out: string[] = [];
  let left = n;
  for (const p of paras) {
    if (left <= 0) break;
    out.push(p.slice(0, left));
    left -= p.length;
  }
  return out;
}

function Caret({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1em] w-[0.55em] translate-y-[0.15em] bg-current"
      style={{ animation: "unlab-caret 1s steps(1) infinite" }}
    />
  );
}

function PageFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="flex min-h-full flex-col items-center justify-center px-6 py-16"
      style={{ animation: "unlab-fade .6s ease-out" }}
    >
      {children}
    </section>
  );
}

function StatRow({
  label,
  value,
  index = 0,
  animate = false,
}: {
  label: string;
  value: ReactNode;
  index?: number;
  animate?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-6 border-b border-[#33FF33]/10 py-1.5"
      style={
        animate ? { animation: `unlab-row .45s ease-out ${0.25 + index * 0.22}s both` } : undefined
      }
    >
      <dt className="text-xs tracking-[0.2em] text-[#FFB800]/80 uppercase">{label}</dt>
      <dd className="text-sm text-[#d8ffd8] tabular-nums">{value}</dd>
    </div>
  );
}

export function EndingSequence({
  endingId,
  state,
  onContinue,
  onMainMenu,
  cps = 42,
}: EndingSequenceProps) {
  const [settings] = useSettings();
  const reduce = settings.accessibility.reduceMotion;
  const ending = ENDING_BY_ID.get(endingId);
  const sig = isEndingId(endingId) ? ENDING_SIGNATURE[endingId] : ENDING_SIGNATURE.frequenz;
  const [page, setPage] = useState<EndingSequencePage>("epilogue");
  const pageIdx = ENDING_SEQUENCE_PAGES.indexOf(page);

  // Content is fixed for the lifetime of the sequence (state may keep ticking).
  const epilogue = useMemo(() => ending?.epilogue ?? tr("The lab keeps running."), [ending]);
  const after = useMemo(() => aftermath(endingId, state), [endingId, state]);
  const stats = useMemo(() => endingStats(state), [state]);
  const still = useMemo(() => endingStill(endingId), [endingId]);

  const typedText: readonly string[] =
    page === "epilogue" ? [epilogue] : page === "aftermath" ? after : [];
  const total = typedText.reduce((n, p) => n + p.length, 0);
  const [shown, complete] = useTypewriter(total, cps, reduce, page);
  const typing = shown < total;

  const next = useCallback(() => {
    setPage((p) => {
      const i = ENDING_SEQUENCE_PAGES.indexOf(p);
      return ENDING_SEQUENCE_PAGES[Math.min(ENDING_SEQUENCE_PAGES.length - 1, i + 1)]!;
    });
  }, []);

  const advance = useCallback(() => {
    if (typing) complete();
    else if (page !== "end") next();
  }, [typing, complete, page, next]);

  useEscLayer(advance);

  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "BUTTON" || t.tagName === "INPUT")) return;
      e.preventDefault();
      advanceRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const endButtonsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (page === "end") endButtonsRef.current?.querySelector("button")?.focus();
  }, [page]);

  const title = ending?.title ?? tr("The End");

  let body: ReactNode = null;
  if (page === "epilogue") {
    body = (
      <PageFrame label={tr("Epilogue")}>
        {still && (
          <div
            aria-hidden
            className="mb-8 rounded-sm border p-2"
            style={{
              borderColor: `${sig.css}55`,
              boxShadow: `0 0 32px ${sig.css}33, inset 0 0 24px #000`,
              background: `radial-gradient(circle at 50% 60%, ${sig.accent} 0%, #000 75%)`,
              animation: reduce ? undefined : "unlab-still 6s ease-out both",
            }}
          >
            <ModelPreview grid={still.grid} cacheKey={still.key} size={168} />
          </div>
        )}
        <p className="mb-8 text-[10px] tracking-[0.4em] uppercase" style={{ color: sig.css }}>
          {tr("End · {title}", { title })}
        </p>
        <p className="max-w-2xl text-center text-lg leading-relaxed text-[#E8F4FF] [text-shadow:0_0_8px_rgba(232,244,255,.35)]">
          {epilogue.slice(0, shown)}
          <Caret on={typing} />
        </p>
      </PageFrame>
    );
  } else if (page === "aftermath") {
    const paras = sliceParagraphs(after, shown);
    body = (
      <PageFrame label={tr("What happened next")}>
        <h2 className="mb-8 text-xs tracking-[0.4em] text-[#FFB800] uppercase">
          {tr("What happened next")}
        </h2>
        <div className="flex max-w-2xl flex-col gap-4">
          {paras.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-[#d8ffd8]/90">
              {p}
              <Caret on={typing && i === paras.length - 1} />
            </p>
          ))}
        </div>
      </PageFrame>
    );
  } else if (page === "stats") {
    body = (
      <PageFrame label={tr("Statistics")}>
        <h2 className="mb-6 text-xs tracking-[0.4em] text-[#FFB800] uppercase">
          {tr("Lab report")}
        </h2>
        <dl className="w-full max-w-md">
          <StatRow
            index={0}
            animate={!reduce}
            label={tr("Play time")}
            value={formatPlayTime(stats.playTime)}
          />
          <StatRow
            index={1}
            animate={!reduce}
            label={tr("Devices")}
            value={`${stats.devices.current} / ${stats.devices.total}`}
          />
          <StatRow
            index={2}
            animate={!reduce}
            label={tr("Insights")}
            value={`${stats.insights.current} / ${stats.insights.total}`}
          />
          <StatRow
            index={3}
            animate={!reduce}
            label={tr("Achievements")}
            value={`${stats.achievements.current} / ${stats.achievements.total}`}
          />
          <StatRow
            index={4}
            animate={!reduce}
            label={tr("stats::Slices")}
            value={`${stats.slices.current} / ${stats.slices.total}`}
          />
          <StatRow
            index={5}
            animate={!reduce}
            label={tr("Bots woken")}
            value={`${stats.bots.current} / ${stats.bots.total}`}
          />
          <StatRow
            index={6}
            animate={!reduce}
            label={tr("Endings")}
            value={`${stats.endingsFound} / ${stats.endingsTotal}`}
          />
          {stats.ngPlus > 0 && (
            <StatRow
              index={7}
              animate={!reduce}
              label={tr("New Game+")}
              value={tr("Cycle {n}", { n: stats.ngPlus })}
            />
          )}
        </dl>
        <ul className="mt-6 flex w-full max-w-md flex-col gap-1" aria-label={tr("Endings")}>
          {stats.endings.map((e) => (
            <li
              key={e.id}
              className={`text-sm ${
                e.id === endingId
                  ? "text-[#E8F4FF]"
                  : e.found
                    ? "text-[#33FF33]"
                    : "text-[#33FF33]/35"
              }`}
            >
              {e.found ? "✓" : "·"} {e.title}
            </li>
          ))}
        </ul>
      </PageFrame>
    );
  } else if (page === "credits") {
    const roll = (
      <div className="flex flex-col items-center gap-10 py-[45vh] text-center">
        <div className="flex flex-col items-center gap-3">
          <Octahedron size={72} />
          <div className="text-4xl font-bold tracking-[0.12em] text-[#33FF33] [text-shadow:0_0_14px_rgba(51,255,51,.5)]">
            _unLAB
          </div>
          <div className="text-xs tracking-[0.35em] uppercase" style={{ color: sig.css }}>
            {title}
          </div>
        </div>
        {CREDITS.map((block) => (
          <section key={block.heading} className="flex flex-col gap-2">
            <h3 className="text-xs tracking-[0.3em] text-[#FFB800] uppercase">{block.heading}</h3>
            {block.lines.map((l, i) =>
              typeof l === "string" ? (
                <p key={i} className="text-sm text-[#d8ffd8]/80 italic">
                  {l}
                </p>
              ) : (
                <p key={i} className="text-sm">
                  <span className="text-[#d8ffd8]">{l[0]}</span>
                  <span className="text-[#33FF33]/40"> — </span>
                  <span className="text-[#00FFFF]/80">{l[1]}</span>
                </p>
              ),
            )}
          </section>
        ))}
        <p className="text-sm text-[#E8F4FF]/80 italic">Keep listening. Keep building.</p>
        <p className="text-sm text-[#E8F4FF]/80 italic">Keep the lab unstable.</p>
        <p className="text-[10px] tracking-[0.3em] text-[#33FF33]/40 uppercase">
          {tr("End of transmission")}
        </p>
      </div>
    );
    body = (
      <section aria-label={tr("Credits")} className="h-full overflow-hidden">
        {reduce ? (
          <div className="h-full overflow-y-auto">{roll}</div>
        ) : (
          <div
            style={{ animation: "unlab-credits 45s linear 1 forwards" }}
            onAnimationEnd={() => setPage((p) => (p === "credits" ? "end" : p))}
          >
            {roll}
          </div>
        )}
      </section>
    );
  } else {
    body = (
      <PageFrame label={tr("The End")}>
        <Octahedron size={64} />
        <p className="mt-6 text-2xl font-bold tracking-[0.14em] text-[#33FF33] [text-shadow:0_0_12px_rgba(51,255,51,.5)]">
          _unLAB
        </p>
        <p className="mt-2 text-xs tracking-[0.35em] uppercase" style={{ color: sig.css }}>
          {title}
        </p>
        <p className="mt-6 max-w-md text-center text-xs text-[#d8ffd8]/70">
          {stats.endingsFound < stats.endingsTotal
            ? stats.endingsTotal - stats.endingsFound === 1
              ? tr("1 ending is still open. The lab keeps running.")
              : tr("{n} endings are still open. The lab keeps running.", {
                  n: stats.endingsTotal - stats.endingsFound,
                })
            : tr("All endings found. The lab keeps running anyway.")}
        </p>
        <div ref={endButtonsRef} className="mt-8 flex gap-3" onClick={(e) => e.stopPropagation()}>
          <CrtButton tone="cyan" onClick={onContinue}>
            {tr("Stay in the lab")}
          </CrtButton>
          <CrtButton tone="amber" onClick={onMainMenu}>
            {tr("Main menu")}
          </CrtButton>
        </div>
      </PageFrame>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[90] overflow-hidden bg-black font-mono"
      role="dialog"
      aria-modal="true"
      aria-label={tr("End · {title}", { title })}
      data-page={page}
      onClick={advance}
    >
      <MenuKeyframes />
      <style>{KEYFRAMES}</style>
      {!reduce && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${sig.accent} 0%, ${sig.css} 18%, transparent 70%)`,
            animation: "unlab-afterglow 2.8s ease-out forwards",
          }}
        />
      )}
      <UiScale className="relative h-full overflow-y-auto">{body}</UiScale>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: SCANLINES }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[10%] opacity-[0.07] mix-blend-screen"
        style={{
          backgroundImage: GRAIN,
          animation: reduce ? undefined : "unlab-grain .4s steps(2) infinite",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, #000 100%)" }}
      />
      {page !== "end" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPage("end");
          }}
          className="absolute top-4 right-4 border border-white/25 bg-black/60 px-3 py-1 text-[11px] text-white/60 hover:text-white"
        >
          {tr("Skip ›")}
        </button>
      )}
      {page !== "end" && (
        <div className="pointer-events-none absolute right-0 bottom-4 left-0 flex flex-col items-center gap-2">
          <div className="flex gap-1.5" aria-hidden>
            {ENDING_SEQUENCE_PAGES.map((p, i) => (
              <span
                key={p}
                className={`h-1 w-4 rounded-full ${i <= pageIdx ? "bg-[#33FF33]/70" : "bg-[#33FF33]/15"}`}
              />
            ))}
          </div>
          <p className="text-[10px] tracking-[0.25em] text-[#33FF33]/40 uppercase">
            {tr("Space / click / Esc: continue")}
          </p>
        </div>
      )}
    </div>
  );
}

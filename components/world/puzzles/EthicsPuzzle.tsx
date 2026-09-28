"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dealEthics, isMatch, pairById } from "@/components/world/puzzles/engine/ethics";
import { num } from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  StatusLine,
  StepPips,
  arrowDelta,
  useFailFx,
  useFailHint,
  useHotkeys,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const MISMATCH_MS = 1100;
const PEEK_MS = 1500;
/** Glyphs so the card sides don't rely on cyan vs amber alone. */
const SIDE_GLYPH = { szenario: "◇", prinzip: "◆" } as const;

function sideLabel(side: "szenario" | "prinzip"): string {
  return side === "szenario" ? tr("Scenario") : tr("Principle");
}

export function EthicsPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 89);
  const pairs = num(params, "pairs", 6);
  const cards = useMemo(() => dealEthics(seed, pairs), [seed, pairs]);
  const total = cards.length / 2;

  const [matched, setMatched] = useState<string[]>([]);
  const [open, setOpen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [peek, setPeek] = useState(false);
  const [peeksUsed, setPeeksUsed] = useState(0);
  const [lastPair, setLastPair] = useState<string | null>(null);
  const [miss, setMiss] = useState(false);
  const [focus, setFocus] = useState(0);
  const sfx = useSfx(sound);
  const { fails, fail, hint } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();

  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const timersRef = useRef<number[]>([]);
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const isOpen = (id: string, pairId: string) =>
    peek || open.includes(id) || matched.includes(pairId);

  const flip = (idx: number) => {
    const card = cards[idx];
    if (!card || solved || busy || peek) return;
    if (matched.includes(card.pairId) || open.includes(card.id)) return;
    setFocus(idx);
    if (open.length === 0) {
      setOpen([card.id]);
      setMiss(false);
      sfx("ui_click");
      return;
    }
    const first = cards.find((c) => c.id === open[0]);
    if (!first) return;
    if (isMatch(first, card)) {
      const next = [...matched, card.pairId];
      setMatched(next);
      setOpen([]);
      setLastPair(card.pairId);
      setMiss(false);
      if (next.length === total) onSolve();
      else sfx("keypad_beep");
      return;
    }
    setOpen([first.id, card.id]);
    setBusy(true);
    setMiss(true);
    fail();
    failFx();
    sfx("fail_buzz");
    later(() => {
      setOpen([]);
      setBusy(false);
    }, MISMATCH_MS);
  };

  // A peek is granted per three mismatches.
  const peeksAvailable = Math.floor(fails / 3) - peeksUsed;

  const mcpPeek = () => {
    if (peeksAvailable <= 0 || peek || busy || solved) return;
    setPeek(true);
    sfx("mcp_blip");
    setPeeksUsed((p) => p + 1);
    later(() => setPeek(false), PEEK_MS);
  };

  const reset = () => {
    if (solved || busy) return;
    sfx("ui_click");
    setMatched([]);
    setOpen([]);
    setLastPair(null);
    setMiss(false);
  };

  /** Columns actually rendered (the grid is responsive): count cards on the first row. */
  const columns = (): number => {
    const btns = btnRefs.current.filter((b): b is HTMLButtonElement => b !== null);
    if (btns.length === 0) return 4;
    const top = btns[0].offsetTop;
    const c = btns.filter((b) => b.offsetTop === top).length;
    return c > 0 && c < btns.length ? c : 4;
  };

  const moveFocus = (next: number) => {
    const n = cards.length;
    const i = ((next % n) + n) % n;
    setFocus(i);
    btnRefs.current[i]?.focus();
  };

  useHotkeys((key) => {
    if (key === "m" || key === "M") {
      mcpPeek();
      return true;
    }
    if (key === "r" || key === "R") {
      reset();
      return true;
    }
    const d = arrowDelta(key);
    if (d) {
      moveFocus(focus + d[0] + d[1] * columns());
      return true;
    }
    if (key === "Enter" || key === " ") {
      flip(focus);
      return true;
    }
    return false;
  });

  const explained = lastPair ? pairById(lastPair) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${failClass}`}
        role="group"
        aria-label={tr("Calibration cards")}
      >
        {cards.map((card, idx) => {
          const shown = isOpen(card.id, card.pairId);
          const done = matched.includes(card.pairId);
          const wrong = miss && open.includes(card.id) && !done;
          const border = done
            ? "border-[#33FF33] bg-[#33FF33]/10 shadow-[0_0_8px_rgba(51,255,51,0.4)]"
            : wrong
              ? "border-red-500 bg-red-500/10"
              : shown
                ? card.side === "szenario"
                  ? "border-[#00FFFF]/70 bg-[#00FFFF]/5"
                  : "border-[#FFB800]/70 bg-[#FFB800]/5"
                : "border-[#33FF33]/30 bg-[#111] hover:border-[#00FFFF]/60";
          return (
            <button
              key={card.id}
              ref={(el) => {
                btnRefs.current[idx] = el;
              }}
              type="button"
              onClick={() => flip(idx)}
              onFocus={() => setFocus(idx)}
              disabled={solved}
              data-pz-autofocus={idx === 0 ? true : undefined}
              aria-pressed={shown}
              aria-label={
                !shown
                  ? tr("Face-down card {n}", { n: idx + 1 })
                  : done
                    ? tr("Matched — {side}: {text}", {
                        side: sideLabel(card.side),
                        text: card.text,
                      })
                    : wrong
                      ? tr("No pair — {side}: {text}", {
                          side: sideLabel(card.side),
                          text: card.text,
                        })
                      : `${sideLabel(card.side)}: ${card.text}`
              }
              className={`relative flex min-h-[96px] flex-col rounded-sm border p-1.5 text-left transition-[background-color,border-color,box-shadow] duration-200 [perspective:500px] ${!shown && !solved ? "hover:bg-[#0F1F0F] active:bg-[#00FFFF]/10" : ""} ${border}`}
            >
              {shown ? (
                // `.pz-flip` forces inline-block (unlayered, beats `flex`), so
                // label and text are block spans to keep them on separate lines.
                <span key="face" className="pz-flip w-full" data-card-face>
                  <span
                    className={`mb-1 block text-[9px] tracking-widest uppercase ${
                      card.side === "szenario" ? "text-[#00FFFF]" : "text-[#FFB800]"
                    }`}
                  >
                    <span aria-hidden className="mr-1">
                      {SIDE_GLYPH[card.side]}
                    </span>
                    {sideLabel(card.side)}
                    {done && (
                      <span aria-hidden className="float-right text-[#33FF33]">
                        ✓
                      </span>
                    )}
                    {wrong && (
                      <span aria-hidden className="float-right text-red-400">
                        ✗
                      </span>
                    )}
                  </span>
                  <span
                    className={`block text-[10px] leading-snug ${done ? "text-[#33FF33]" : "text-[#33FF33]/90"}`}
                  >
                    {card.text}
                  </span>
                </span>
              ) : (
                <span key="back" className="pz-flip m-auto text-center text-[#33FF33]/40">
                  <span className="block text-2xl leading-none">◈</span>
                  <span className="text-[9px] tracking-[0.3em]">MCP</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <StatusLine tone={miss ? "bad" : explained ? "ok" : "info"}>
        {miss
          ? tr("No match. Calibration noted.")
          : explained
            ? tr("MCP: “{text}”", { text: explained.erklaerung })
            : tr("Reveal a scenario card and its matching principle.")}
      </StatusLine>

      <HintBox show={hint}>
        {tr(
          "Cyan cards (◇) are scenarios, amber ones (◆) principles — a pair always has one of each.",
        )}{" "}
        {peeksAvailable > 0
          ? tr("An MCP peek is available (key M).")
          : tr("Next MCP peek after three more misses.")}
      </HintBox>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-2 text-[#FFB800]">
          {tr("Pairs")}
          <StepPips done={matched.length} total={total} label={tr("Pairs")} />
          <span className="text-[#33FF33]/60">{tr("Misses: {n}", { n: fails })}</span>
        </span>
        {hint && (
          <CrtButton
            tone="cyan"
            onClick={mcpPeek}
            disabled={solved || peek || busy || peeksAvailable <= 0}
          >
            {tr("MCP peek ({n})", { n: Math.max(0, peeksAvailable) })}
          </CrtButton>
        )}
      </div>
      <PuzzleFooter
        help={
          <>
            <kbd>←↑↓→</kbd>/<kbd>WASD</kbd> {tr("select")} · <kbd>Enter</kbd>/
            <kbd>{tr("Space")}</kbd> {tr("reveal")} · <kbd>M</kbd> {tr("MCP peek")} · <kbd>R</kbd>{" "}
            {tr("reset")}
          </>
        }
        onReset={reset}
        resetDisabled={solved || busy}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { num, str, strs } from "@/components/world/puzzles/logic";
import {
  HintBox,
  PuzzleFooter,
  StatusLine,
  arrowDelta,
  useFailFx,
  useFailHint,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const HINT_LATE = tr("Too late — by then it had already happened. Go further back.");

export function TemporalPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const lines = strs(params, "lines", []);
  // Clamped so a bad def can never be unsolvable.
  const answer = Math.min(Math.max(0, lines.length - 1), Math.max(0, num(params, "answer", 0)));
  // Texts tied to the log's threshold/location (defaults: the σ-17 log on Level −3).
  const header = str(params, "header", tr("LOG · LEVEL −3"));
  const hintEarly = str(params, "early", tr("Not yet — coherence was still below σ-17 back then."));
  const mcpText = str(
    params,
    "hint",
    tr(
      "The origin is not the loudest event but the first crossing. Read only the coherence values, in order, and stop at the first σ-17.",
    ),
  );
  const sfx = useSfx(sound);
  const [wrong, setWrong] = useState<number | null>(null);
  const [tried, setTried] = useState<number[]>([]);
  const [hint, setHint] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const { fail, hint: mcpHint } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const [cursor, setCursor] = useState(0);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const pick = (idx: number) => {
    if (solved) return;
    if (idx === answer) {
      setPicked(idx);
      setWrong(null);
      setHint("");
      onSolve();
      return;
    }
    sfx("fail_buzz");
    fail();
    failFx();
    setWrong(idx);
    setTried((t) => (t.includes(idx) ? t : [...t, idx]));
    setHint(idx < answer ? hintEarly : HINT_LATE);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setWrong(null), 700);
  };

  /** ↑/↓ (W/S), Home/End walk the log; Enter / Space pick natively (button). */
  const onListKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const d = arrowDelta(e.key);
    let target: number;
    if (e.key === "Home") target = 0;
    else if (e.key === "End") target = lines.length - 1;
    else if (d && d[1] !== 0) target = Math.min(lines.length - 1, Math.max(0, cursor + d[1]));
    else return;
    e.preventDefault();
    btnRefs.current[target]?.focus();
  };

  const reset = () => {
    setTried([]);
    setWrong(null);
    setHint("");
    sfx("ui_click");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-sm border border-[#33FF33]/25 bg-black p-1 ${failClass}`}>
        <div className="mb-1 flex justify-between px-2 text-[10px] tracking-widest text-[#FFB800]/80">
          <span>{header}</span>
          <span>{tr("{n} ENTRIES", { n: lines.length })}</span>
        </div>
        <ol className="flex flex-col gap-0.5" aria-label={tr("Log entries")} onKeyDown={onListKey}>
          {lines.map((line, idx) => {
            const ruledOut = tried.includes(idx) && wrong !== idx;
            const early = idx < answer;
            return (
              <li key={idx}>
                <button
                  ref={(el) => {
                    btnRefs.current[idx] = el;
                  }}
                  type="button"
                  tabIndex={idx === cursor ? 0 : -1}
                  data-pz-autofocus={idx === 0 ? true : undefined}
                  onFocus={() => setCursor(idx)}
                  aria-label={
                    tried.includes(idx)
                      ? early
                        ? tr("Entry {n}: {line} — too early", { n: idx + 1, line })
                        : tr("Entry {n}: {line} — too late", { n: idx + 1, line })
                      : tr("Entry {n}: {line}", { n: idx + 1, line })
                  }
                  onClick={() => pick(idx)}
                  onMouseEnter={() => !solved && sfx("ui_hover")}
                  disabled={solved}
                  className={`group flex w-full items-baseline gap-1 rounded-sm border px-2 py-1.5 text-left font-mono text-xs transition-colors sm:text-sm ${
                    wrong === idx
                      ? "pz-shake border-red-500 bg-red-500/20 text-red-300"
                      : picked === idx
                        ? "border-[#00FFFF] bg-[#00FFFF]/15 text-[#00FFFF] [text-shadow:0_0_6px_#00FFFF]"
                        : ruledOut
                          ? "border-transparent text-[#33FF33]/40 line-through decoration-red-500/50 hover:border-[#33FF33]/20"
                          : "border-transparent text-[#33FF33] hover:border-[#33FF33]/40 hover:bg-[#33FF33]/5 hover:[text-shadow:0_0_5px_#33FF33]"
                  } focus-visible:border-[#00FFFF]`}
                >
                  <span className="mr-1 shrink-0 text-[#FFB800]/70">
                    [{String(idx + 1).padStart(2, "0")}]
                  </span>
                  <span className="min-w-0 flex-1 break-words">{line}</span>
                  {tried.includes(idx) && (
                    <span
                      aria-hidden
                      className="shrink-0 text-[10px] tracking-wider text-red-400/80 no-underline"
                      title={early ? tr("too early") : tr("too late")}
                    >
                      {early ? tr("▼ early") : tr("▲ late")}
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="pz-blink ml-1 hidden text-[#00FFFF] group-hover:inline group-focus-visible:inline"
                  >
                    ◂
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <StatusLine tone={hint ? "bad" : "info"}>
        {hint || tr("{n} entries ruled out · pick the origin", { n: tried.length })}
      </StatusLine>
      <HintBox show={mcpHint && !solved}>{mcpText}</HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>↑↓</kbd>/<kbd>W S</kbd> {tr("scroll")} · <kbd>Enter</kbd> {tr("marks the origin")}{" "}
            · {tr("▼ too early, ▲ too late")}
          </>
        }
        onReset={reset}
        resetDisabled={solved || tried.length === 0}
        resetLabel={tr("Clear marks")}
      />
    </div>
  );
}

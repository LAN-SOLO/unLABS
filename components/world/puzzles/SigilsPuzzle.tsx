"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { generateLights, lightsToggle, num } from "@/components/world/puzzles/logic";
import {
  HintBox,
  ProgressBar,
  PuzzleFooter,
  arrowDelta,
  useFailHint,
  useRisingEdge,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const HINT_MOVES = 25;

export function SigilsPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const size = num(params, "size", 5);
  const seed = num(params, "seed", 1);
  const presses = num(params, "presses", 8);
  const puzzle = useMemo(() => generateLights(size, seed, presses), [size, seed, presses]);
  const sfx = useSfx(sound);
  const [board, setBoard] = useState<boolean[]>(() => puzzle.start.slice());
  /** Parity of the player's presses per cell (toggles commute and self-cancel). */
  const [pressed, setPressed] = useState<boolean[]>(() =>
    new Array<boolean>(puzzle.size * puzzle.size).fill(false),
  );
  const [moves, setMoves] = useState(0);
  const [ripple, setRipple] = useState<{ idx: number; n: number } | null>(null);
  const { hint: timeHint } = useFailHint(99, 45);
  const n = puzzle.size;
  const lit = board.filter(Boolean).length;
  const startLit = puzzle.start.filter(Boolean).length;
  const hint = (timeHint || moves >= HINT_MOVES) && !solved;
  const [cursor, setCursor] = useState(0);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useRisingEdge(hint, () => sfx("hint_pop"));

  // One press of a known solution the player still owes.
  const hintCell = useMemo(() => {
    if (!hint) return -1;
    const need = new Array<boolean>(n * n).fill(false);
    for (const p of puzzle.presses) need[p] = !need[p];
    return need.findIndex((v, i) => v !== pressed[i]);
  }, [hint, n, puzzle.presses, pressed]);

  const near = (idx: number, center: number) => {
    const r = Math.floor(idx / n);
    const c = idx % n;
    const cr = Math.floor(center / n);
    const cc = center % n;
    return Math.abs(r - cr) + Math.abs(c - cc) <= 1;
  };

  const press = (idx: number) => {
    if (solved) return;
    const next = lightsToggle(board, n, idx);
    setBoard(next);
    setPressed((p) => p.map((v, i) => (i === idx ? !v : v)));
    setMoves((m) => m + 1);
    setRipple((r) => ({ idx, n: (r?.n ?? 0) + 1 }));
    if (next.every((v) => !v)) {
      onSolve();
      return;
    }
    sfx(next.filter(Boolean).length < lit ? "keypad_beep" : "ui_click");
  };

  const reset = () => {
    setBoard(puzzle.start.slice());
    setPressed(new Array<boolean>(n * n).fill(false));
    setMoves(0);
    sfx("ui_click");
  };

  /** Arrows / WASD move the focus; Enter / Space press natively (button). */
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = arrowDelta(e.key);
    if (!d) return;
    e.preventDefault();
    const r = Math.min(n - 1, Math.max(0, Math.floor(cursor / n) + d[1]));
    const c = Math.min(n - 1, Math.max(0, (cursor % n) + d[0]));
    btnRefs.current[r * n + c]?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="grid gap-1.5 rounded-sm border border-[#33FF33]/20 bg-black/60 p-2"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        role="group"
        aria-label={tr("Sigil grid {n}×{n}, {lit} active", { n, lit })}
        onKeyDown={onGridKey}
      >
        {board.map((on, idx) => {
          const rippling = ripple !== null && near(idx, ripple.idx);
          return (
            <button
              key={idx}
              ref={(el) => {
                btnRefs.current[idx] = el;
              }}
              type="button"
              tabIndex={idx === cursor ? 0 : -1}
              data-pz-autofocus={idx === 0 ? true : undefined}
              onFocus={() => setCursor(idx)}
              onClick={() => press(idx)}
              disabled={solved}
              aria-label={`${tr("Sigil {r}/{c}: {state}", {
                r: Math.floor(idx / n) + 1,
                c: (idx % n) + 1,
                state: on ? tr("active") : tr("neutral"),
              })}${idx === hintCell ? ` ${tr("(hint)")}` : ""}`}
              aria-pressed={on}
              className={`relative flex h-11 w-11 items-center justify-center rounded-sm border text-xl transition-[background-color,box-shadow,border-color,color] duration-200 sm:h-12 sm:w-12 ${
                on
                  ? "border-[#FFB800] bg-[#FFB800]/20 text-[#FFB800] shadow-[0_0_12px_#FFB800] [text-shadow:0_0_8px_#FFB800]"
                  : "border-[#33FF33]/25 bg-black text-[#33FF33]/30 hover:border-[#00FFFF] hover:text-[#00FFFF]/70 hover:shadow-[0_0_8px_rgba(0,255,255,0.3)]"
              } focus-visible:border-[#00FFFF] active:scale-95 ${idx === hintCell ? "outline-2 outline-offset-1 outline-[#00FFFF] outline-dashed" : ""}`}
            >
              {rippling && (
                <span
                  key={`${ripple.n}`}
                  aria-hidden
                  className="pz-ripple absolute inset-0 rounded-sm border-2 border-[#00FFFF]"
                  style={{ animationDelay: idx === ripple.idx ? "0ms" : "70ms" }}
                />
              )}
              <span className={on ? "pz-glow" : undefined}>{on ? "✶" : "·"}</span>
            </button>
          );
        })}
      </div>
      <div className="flex w-full max-w-[320px] flex-col gap-2">
        <ProgressBar
          value={startLit === 0 ? 1 : 1 - lit / Math.max(startLit, lit)}
          label={tr("Active sigils: {lit} · Moves: {moves}", { lit, moves })}
        />
      </div>
      <div className="w-full">
        <HintBox show={hint && hintCell >= 0}>
          {tr(
            "Damien's trick was called “chasing”: row by row from the top, and under every light you place the counter-sigil below it. If that is too theoretical — the sigil with the dashed outline belongs to a solution. Order doesn't matter.",
          )}
        </HintBox>
      </div>
      <PuzzleFooter
        help={
          <>
            <kbd>←↑↓→</kbd>/<kbd>WASD</kbd> {tr("move")} · <kbd>Enter</kbd>/<kbd>{tr("Space")}</kbd>{" "}
            {tr("places a counter-sigil")} · {tr("✶ active, · neutral")}
          </>
        }
        onReset={reset}
        resetDisabled={solved || moves === 0}
      />
    </div>
  );
}

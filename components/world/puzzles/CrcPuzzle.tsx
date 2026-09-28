"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  bitsEqual,
  colParities,
  generateCrc,
  num,
  rowParities,
} from "@/components/world/puzzles/logic";
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

function Check({ ok, expected, label }: { ok: boolean; expected: number; label: string }) {
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-sm text-xs transition-colors ${
        ok
          ? "text-[#33FF33]"
          : "border border-dashed border-red-500/70 font-bold text-red-400 [text-shadow:0_0_6px_#FF4040]"
      }`}
      title={tr("Expected parity: {n}", { n: expected })}
      role="img"
      aria-label={
        ok
          ? tr("{label}: expected {n}, correct", { label, n: expected })
          : tr("{label}: expected {n}, wrong", { label, n: expected })
      }
    >
      {expected}
      {ok ? "✓" : "✗"}
    </span>
  );
}

function mismatches(
  bits: readonly number[],
  rows: number,
  cols: number,
  rp: readonly number[],
  cp: readonly number[],
): number {
  const r = rowParities(bits, rows, cols).filter((p, i) => p !== rp[i]).length;
  const c = colParities(bits, rows, cols).filter((p, i) => p !== cp[i]).length;
  return r + c;
}

export function CrcPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const rows = num(params, "rows", 6);
  const cols = num(params, "cols", 8);
  const seed = num(params, "seed", 1);
  const puzzle = useMemo(() => generateCrc(rows, cols, seed), [rows, cols, seed]);
  const sfx = useSfx(sound);
  const [bits, setBits] = useState<number[]>(() => puzzle.corrupted.slice());
  const [hover, setHover] = useState<number | null>(null);
  const { fail, hint } = useFailHint(3, 90, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const [moves, setMoves] = useState(0);
  const [cursor, setCursor] = useState(0);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const rp = rowParities(bits, puzzle.rows, puzzle.cols);
  const cp = colParities(bits, puzzle.rows, puzzle.cols);
  const rowBad = rp.map((p, i) => p !== puzzle.rowParity[i]);
  const colBad = cp.map((p, i) => p !== puzzle.colParity[i]);
  const allParity = !rowBad.some(Boolean) && !colBad.some(Boolean);
  const hr = hover === null ? -1 : Math.floor(hover / puzzle.cols);
  const hc = hover === null ? -1 : hover % puzzle.cols;

  const toggle = (idx: number) => {
    if (solved) return;
    const next = bits.slice();
    next[idx] ^= 1;
    setBits(next);
    setMoves((m) => m + 1);
    if (bitsEqual(next, puzzle.original)) {
      onSolve();
      return;
    }
    const before = mismatches(bits, puzzle.rows, puzzle.cols, puzzle.rowParity, puzzle.colParity);
    const after = mismatches(next, puzzle.rows, puzzle.cols, puzzle.rowParity, puzzle.colParity);
    if (after < before) sfx("keypad_beep");
    else {
      sfx("ui_click");
      // Worse than before: count it and flash the grid (the click stays the
      // sound — it is a manipulation, not a submitted answer).
      if (after > before) {
        fail();
        failFx();
      }
    }
  };

  const reset = () => {
    setBits(puzzle.corrupted.slice());
    setMoves(0);
    sfx("ui_click");
  };

  /** Arrows / WASD walk the matrix; Enter / Space toggle natively (button). */
  const onGridKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const d = arrowDelta(e.key);
    if (!d) return;
    e.preventDefault();
    const cr = Math.floor(cursor / puzzle.cols);
    const cc = cursor % puzzle.cols;
    const r = Math.min(puzzle.rows - 1, Math.max(0, cr + d[1]));
    const c = Math.min(puzzle.cols - 1, Math.max(0, cc + d[0]));
    btnRefs.current[r * puzzle.cols + c]?.focus();
  };
  const badRows = rowBad.filter(Boolean).length;
  const badCols = colBad.filter(Boolean).length;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`max-w-full overflow-x-auto rounded-sm border border-[#33FF33]/20 bg-black/60 p-1 ${failClass}`}
        onMouseLeave={() => setHover(null)}
      >
        <table
          className="border-separate border-spacing-1 [perspective:300px]"
          aria-label={tr("Data matrix with parity check")}
          onKeyDown={onGridKey}
        >
          <tbody>
            {Array.from({ length: puzzle.rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: puzzle.cols }, (_, c) => {
                  const idx = r * puzzle.cols + c;
                  const b = bits[idx];
                  const cross = rowBad[r] && colBad[c];
                  const bad = rowBad[r] || colBad[c];
                  const aligned = r === hr || c === hc;
                  return (
                    <td key={c}>
                      <button
                        ref={(el) => {
                          btnRefs.current[idx] = el;
                        }}
                        type="button"
                        tabIndex={idx === cursor ? 0 : -1}
                        data-pz-autofocus={idx === 0 ? true : undefined}
                        onClick={() => toggle(idx)}
                        onMouseEnter={() => setHover(idx)}
                        onFocus={() => {
                          setHover(idx);
                          setCursor(idx);
                        }}
                        disabled={solved}
                        aria-label={tr("Bit row {r}, column {c}: {b}", { r: r + 1, c: c + 1, b })}
                        className={`h-7 w-7 rounded-sm border font-mono text-sm transition-[background-color,box-shadow,border-color] duration-100 sm:h-8 sm:w-8 ${
                          b
                            ? "border-[#33FF33]/70 bg-[#33FF33]/15 text-[#33FF33] [text-shadow:0_0_5px_#33FF33]"
                            : "border-[#33FF33]/25 bg-black text-[#33FF33]/50"
                        } ${cross ? "shadow-[0_0_8px_rgba(255,64,64,0.55)]" : bad ? "shadow-[inset_0_0_6px_rgba(255,64,64,0.25)]" : ""} ${
                          aligned ? "bg-[#00FFFF]/10" : ""
                        } ${cross ? "underline decoration-red-500 decoration-2 underline-offset-2" : ""} hover:border-[#00FFFF] hover:shadow-[0_0_8px_#00FFFF] focus-visible:border-[#00FFFF]`}
                      >
                        <span key={`${idx}-${b}`} className="pz-flip">
                          {b}
                        </span>
                      </button>
                    </td>
                  );
                })}
                <td className="pl-2">
                  <Check
                    ok={!rowBad[r]}
                    expected={puzzle.rowParity[r]}
                    label={tr("Row {n}", { n: r + 1 })}
                  />
                </td>
              </tr>
            ))}
            <tr>
              {Array.from({ length: puzzle.cols }, (_, c) => (
                <td key={c}>
                  <Check
                    ok={!colBad[c]}
                    expected={puzzle.colParity[c]}
                    label={tr("Column {n}", { n: c + 1 })}
                  />
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="w-full">
        <StatusLine tone={allParity && !solved ? "bad" : "info"}>
          {allParity && !solved
            ? tr("Parity matches — but the record is not the original one yet. Reset.")
            : tr(
                "✗ {rows} row(s), {cols} column(s) wrong · Moves: {moves} — they cross at the flipped bit.",
                { rows: badRows, cols: badCols, moves },
              )}
        </StatusLine>
      </div>
      <HintBox show={hint && !solved}>
        {tr(
          "You are making it worse by improving it. Exactly one bit is flipped — reset and flip only the cell where the red-marked row and the red-marked column meet. It is already glowing.",
        )}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>←↑↓→</kbd>/<kbd>WASD</kbd> {tr("move")} · <kbd>Enter</kbd>/
            <kbd>{tr("Spacebar")}</kbd> {tr("flips the bit")} · {tr("✗ marks wrong parity")}
          </>
        }
        onReset={reset}
        resetDisabled={solved || moves === 0}
      />
    </div>
  );
}

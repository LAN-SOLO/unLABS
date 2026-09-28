"use client";

import { useId, useMemo, useState } from "react";
import {
  BEAM_HEX,
  BEAM_LABEL,
  generateLaser,
  isRotatable,
  receiverLit,
  traceBeams,
  type BeamColor,
  type LaserCell,
} from "@/components/world/puzzles/engine/laser";
import { num } from "@/components/world/puzzles/logic";
import {
  HintBox,
  PuzzleFooter,
  SHAPE_GLYPH,
  ShapeMark,
  StatusLine,
  arrowDelta,
  useFailFx,
  useFailHint,
  useHotkeys,
  usePuzzleFx,
  useSfx,
  type PuzzleProps,
  type ShapeName,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const C = 44;
/** Colour-blind cue: every beam colour also has its own shape. */
const BEAM_SHAPE: Record<BeamColor, ShapeName> = {
  weiss: "star",
  rot: "triangle",
  gruen: "circle",
  blau: "square",
};

function Piece({ cell, orient, x, y }: { cell: LaserCell; orient: number; x: number; y: number }) {
  const m = 7;
  const diag =
    orient === 0
      ? { x1: x + m, y1: y + C - m, x2: x + C - m, y2: y + m }
      : { x1: x + m, y1: y + m, x2: x + C - m, y2: y + C - m };
  switch (cell.t) {
    case "mirror":
      return (
        <g>
          <line {...diag} stroke="#0D2A2A" strokeWidth={7} strokeLinecap="round" />
          <line {...diag} stroke="#BFEFFF" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case "splitter":
      return (
        <g>
          <rect
            x={x + 5}
            y={y + 5}
            width={C - 10}
            height={C - 10}
            fill="#00FFFF"
            fillOpacity={0.06}
            stroke="#00FFFF"
            strokeOpacity={0.6}
            strokeDasharray="3 3"
          />
          <line {...diag} stroke="#00FFFF" strokeWidth={2.5} strokeOpacity={0.75} />
        </g>
      );
    case "filter":
      return (
        <g>
          <rect
            x={x + 9}
            y={y + 9}
            width={C - 18}
            height={C - 18}
            rx={2}
            fill={BEAM_HEX[cell.color]}
            fillOpacity={0.28}
            stroke={BEAM_HEX[cell.color]}
            strokeWidth={1.5}
          />
          <ShapeMark
            shape={BEAM_SHAPE[cell.color]}
            cx={x + C / 2}
            cy={y + C / 2 - 4}
            r={5}
            fill={BEAM_HEX[cell.color]}
          />
          <text
            x={x + C / 2}
            y={y + C / 2 + 10}
            textAnchor="middle"
            fontSize={8}
            fill={BEAM_HEX[cell.color]}
            fontFamily="monospace"
          >
            {BEAM_LABEL[cell.color].slice(0, 2).toUpperCase()}
          </text>
        </g>
      );
    case "block":
      return (
        <g>
          <rect x={x + 4} y={y + 4} width={C - 8} height={C - 8} fill="#262626" stroke="#555" />
          <line x1={x + 8} y1={y + 8} x2={x + C - 8} y2={y + C - 8} stroke="#555" />
          <line x1={x + C - 8} y1={y + 8} x2={x + 8} y2={y + C - 8} stroke="#555" />
        </g>
      );
    case "empty":
      return null;
  }
}

export function LaserPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 1);
  const size = num(params, "size", 6);
  const colors = num(params, "colors", 2);
  const receivers = num(params, "receivers", 3);
  const puzzle = useMemo(
    () => generateLaser(seed, size, colors, receivers),
    [seed, size, colors, receivers],
  );
  const n = puzzle.size;
  const [orient, setOrient] = useState<number[]>(() => puzzle.start.slice());
  const [moves, setMoves] = useState(0);
  const [cursor, setCursor] = useState(() => puzzle.emitterRow * n);
  const sfx = useSfx(sound);
  const { fail, hint } = useFailHint(3, 45, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const { reduceMotion } = usePuzzleFx();
  const [turned, setTurned] = useState<{ idx: number; n: number } | null>(null);
  const glowId = useId().replace(/:/g, "");

  const trace = useMemo(
    () => traceBeams(n, puzzle.cells, orient, puzzle.emitterRow),
    [n, puzzle, orient],
  );
  const lit = puzzle.receivers.map((r) => receiverLit(r, trace.exits));
  const litCount = lit.filter(Boolean).length;

  const hintCell = useMemo(() => {
    if (!hint) return -1;
    const wrong = puzzle.cells
      .map((_, i) => i)
      .filter((i) => isRotatable(puzzle.cells[i]) && orient[i] !== puzzle.solution[i]);
    if (wrong.length === 0) return -1;
    const touched = wrong.find((i) => trace.touched.has(i));
    return touched ?? wrong[0];
  }, [hint, puzzle, orient, trace]);

  const rotate = (idx: number) => {
    if (solved || !isRotatable(puzzle.cells[idx])) return;
    const next = orient.slice();
    next[idx] ^= 1;
    setOrient(next);
    setMoves((m) => m + 1);
    setTurned((t) => ({ idx, n: (t?.n ?? 0) + 1 }));
    const beams = traceBeams(n, puzzle.cells, next, puzzle.emitterRow);
    const nowLit = puzzle.receivers.filter((r) => receiverLit(r, beams.exits)).length;
    if (nowLit === puzzle.receivers.length) {
      onSolve();
      return;
    }
    if (nowLit < litCount) {
      // A receiver went dark again: that turn broke a working beam path.
      fail();
      failFx();
      sfx("fail_buzz");
    } else sfx(nowLit > litCount ? "keypad_beep" : "ui_click");
  };

  const reset = () => {
    if (solved) return;
    setOrient(puzzle.start.slice());
    setMoves(0);
    setTurned(null);
    sfx("ui_click");
  };

  useHotkeys((key) => {
    if (solved) return false;
    if (key === " " || key === "Enter") {
      rotate(cursor);
      return true;
    }
    const d = arrowDelta(key);
    if (!d) return false;
    const r = Math.max(0, Math.min(n - 1, Math.floor(cursor / n) + d[1]));
    const c = Math.max(0, Math.min(n - 1, (cursor % n) + d[0]));
    setCursor(r * n + c);
    return true;
  }, !solved);

  const cursorCell = puzzle.cells[cursor];
  const slash = orient[cursor] ? "\\" : "/";
  const cursorDesc = tr("Cursor row {r}, column {c}: {cell}", {
    r: Math.floor(cursor / n) + 1,
    c: (cursor % n) + 1,
    cell:
      cursorCell.t === "mirror"
        ? tr("Mirror {o}", { o: slash })
        : cursorCell.t === "splitter"
          ? tr("Beam splitter {o}", { o: slash })
          : cursorCell.t === "filter"
            ? tr("Filter {color}", { color: BEAM_LABEL[cursorCell.color] })
            : cursorCell.t === "block"
              ? tr("Block")
              : tr("empty"),
  });

  const W = (n + 2) * C;
  const cx = (c: number) => (c + 1.5) * C;
  const cy = (r: number) => (r + 1.5) * C;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${W} ${W}`}
        className="w-full max-w-[460px] touch-manipulation rounded-sm select-none"
        role="grid"
        tabIndex={0}
        data-pz-autofocus
        aria-label={tr("Laser bench. {cursor}. Receivers powered: {n} of {total}.", {
          cursor: cursorDesc,
          n: litCount,
          total: puzzle.receivers.length,
        })}
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={C} y={C} width={n * C} height={n * C} fill="#050805" stroke="#1F3F1F" />
        {puzzle.cells.map((cell, idx) => {
          const r = Math.floor(idx / n);
          const c = idx % n;
          const x = (c + 1) * C;
          const y = (r + 1) * C;
          const rot = isRotatable(cell);
          return (
            <g
              key={idx}
              role="gridcell"
              aria-label={
                rot
                  ? tr("Cell {r}/{c} (rotatable)", { r: r + 1, c: c + 1 })
                  : tr("Cell {r}/{c}", { r: r + 1, c: c + 1 })
              }
              onClick={() => {
                setCursor(idx);
                rotate(idx);
              }}
              className={rot && !solved ? "group cursor-pointer" : ""}
            >
              <rect
                x={x + 0.5}
                y={y + 0.5}
                width={C - 1}
                height={C - 1}
                fill={rot ? "#0B140B" : "#070A07"}
                stroke="#132613"
                className={rot && !solved ? "transition-colors group-hover:fill-[#143014]" : ""}
              />
              <g
                key={turned?.idx === idx ? `t${turned.n}` : "s"}
                className={turned?.idx === idx && !reduceMotion ? "pz-turn" : undefined}
                style={{ transformOrigin: `${x + C / 2}px ${y + C / 2}px` }}
              >
                <Piece cell={cell} orient={orient[idx] ?? 0} x={x} y={y} />
              </g>
              {idx === hintCell && (
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={C - 4}
                  height={C - 4}
                  fill="none"
                  stroke="#FFB800"
                  strokeWidth={2}
                  className="animate-pulse"
                />
              )}
            </g>
          );
        })}
        {/* Beams: wide soft halo, glowing core, then travelling photons. */}
        <g pointerEvents="none" opacity={0.22}>
          {trace.segments.map((s, i) => (
            <line
              key={i}
              x1={cx(s.c1)}
              y1={cy(s.r1)}
              x2={cx(s.c2)}
              y2={cy(s.r2)}
              stroke={BEAM_HEX[s.color]}
              strokeWidth={9}
              strokeLinecap="round"
            />
          ))}
        </g>
        <g filter={`url(#${glowId})`} pointerEvents="none">
          {trace.segments.map((s, i) => (
            <line
              key={i}
              x1={cx(s.c1)}
              y1={cy(s.r1)}
              x2={cx(s.c2)}
              y2={cy(s.r2)}
              stroke={BEAM_HEX[s.color]}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.95}
            />
          ))}
        </g>
        <g pointerEvents="none">
          {trace.segments.map((s, i) => (
            <line
              key={i}
              x1={cx(s.c1)}
              y1={cy(s.r1)}
              x2={cx(s.c2)}
              y2={cy(s.r2)}
              stroke="#FFFFFF"
              strokeWidth={1.2}
              strokeLinecap="round"
              opacity={0.7}
              className="pz-flow"
            />
          ))}
        </g>
        {/* Emitter */}
        <g pointerEvents="none">
          <rect
            x={C * 0.2}
            y={cy(puzzle.emitterRow) - 12}
            width={C * 0.75}
            height={24}
            rx={3}
            fill="#1A1A1A"
            stroke="#FFB800"
          />
          <circle cx={cx(-1) + 10} cy={cy(puzzle.emitterRow)} r={4} fill="#E8FFE8" />
          <text
            x={C * 0.5}
            y={cy(puzzle.emitterRow) + 3}
            textAnchor="middle"
            fontSize={8}
            fill="#FFB800"
            fontFamily="monospace"
          >
            LSR
          </text>
        </g>
        {/* Receivers */}
        {puzzle.receivers.map((rec, i) => {
          const on = lit[i];
          const col = BEAM_HEX[rec.color];
          return (
            <g key={i} pointerEvents="none">
              {on && (
                <circle
                  cx={cx(rec.c)}
                  cy={cy(rec.r)}
                  r={13}
                  fill="none"
                  stroke={col}
                  strokeWidth={2}
                  className="pz-ripple"
                />
              )}
              <circle
                cx={cx(rec.c)}
                cy={cy(rec.r)}
                r={13}
                fill={on ? col : "#0D0D0D"}
                fillOpacity={on ? 0.35 : 1}
                stroke={col}
                strokeWidth={on ? 3 : 1.5}
                filter={on ? `url(#${glowId})` : undefined}
              />
              <ShapeMark
                shape={BEAM_SHAPE[rec.color]}
                cx={cx(rec.c)}
                cy={cy(rec.r)}
                r={6}
                fill={on ? "#FFFFFF" : col}
              />
            </g>
          );
        })}
        {!solved && (
          <rect
            x={(cursor % n) * C + C + 1.5}
            y={Math.floor(cursor / n) * C + C + 1.5}
            width={C - 3}
            height={C - 3}
            fill="none"
            stroke="#00FFFF"
            strokeOpacity={0.55}
            strokeDasharray="4 3"
            pointerEvents="none"
            className="pz-cursor"
          />
        )}
      </svg>
      <div
        className={`flex w-full max-w-[460px] flex-wrap items-center justify-between gap-2 text-xs ${failClass}`}
      >
        <span className="text-[#FFB800]">
          {tr("Moves: {moves} · Receivers: {n} / {total}", {
            moves,
            n: litCount,
            total: puzzle.receivers.length,
          })}
        </span>
        <span className="flex flex-wrap gap-2" aria-label={tr("Receivers")}>
          {puzzle.receivers.map((rec, i) => (
            <span
              key={i}
              className={`rounded-sm border px-1.5 transition-opacity ${lit[i] ? "shadow-[0_0_6px_currentColor]" : ""}`}
              style={{
                borderColor: BEAM_HEX[rec.color],
                color: BEAM_HEX[rec.color],
                opacity: lit[i] ? 1 : 0.55,
              }}
            >
              <span aria-hidden>{SHAPE_GLYPH[BEAM_SHAPE[rec.color]]} </span>
              {BEAM_LABEL[rec.color]}
              {lit[i] ? " ✓" : " ·"}
              <span className="sr-only">{lit[i] ? ` ${tr("powered")}` : ` ${tr("dark")}`}</span>
            </span>
          ))}
        </span>
      </div>
      <StatusLine tone={solved ? "ok" : "info"}>
        {solved
          ? tr("All receivers saturated. Beam routing stable.")
          : tr(
              "Rotate mirrors (/ \\) and beam splitters (dashed). Filters tint white light; they block other colours.",
            )}
      </StatusLine>
      <div className="w-full max-w-[460px]">
        <HintBox show={hint && hintCell >= 0 && !solved}>
          {tr(
            "The marked element is set wrong: row {r}, column {c}. Rotate it once. Light does not lie — it only takes detours through your mistakes.",
            {
              r: Math.floor(hintCell / n) + 1,
              c: (hintCell % n) + 1,
            },
          )}
        </HintBox>
      </div>
      <div className="w-full max-w-[460px]">
        <PuzzleFooter
          help={
            <>
              {tr("Click rotates")} · <kbd>←↑↓→</kbd>/<kbd>WASD</kbd> {tr("cursor")} ·{" "}
              <kbd>Enter</kbd>/<kbd>{tr("Space")}</kbd> {tr("rotates")} ·{" "}
              {tr("Shapes: ▲ red, ● green, ■ blue")}
            </>
          }
          onReset={reset}
          resetDisabled={solved}
        />
      </div>
    </div>
  );
}

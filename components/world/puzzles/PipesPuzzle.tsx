"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { tr } from "@/lib/i18n";
import {
  E,
  N,
  S,
  W,
  generatePipes,
  num,
  pipeFlow,
  pipeMask,
} from "@/components/world/puzzles/logic";
import {
  HintBox,
  ProgressBar,
  PuzzleFooter,
  arrowDelta,
  useFailHint,
  usePuzzleFx,
  useRisingEdge,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";

const CELL = 48;
/** Moves without progress before the MCP points at a blocking segment. */
const HINT_MOVES = 40;

export function PipesPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const size = num(params, "size", 6);
  const seed = num(params, "seed", 1);
  const puzzle = useMemo(() => generatePipes(size, seed), [size, seed]);
  const sfx = useSfx(sound);
  const { reduceMotion } = usePuzzleFx();
  /** Unbounded quarter-turn counters (rotation = turns % 4) so each turn re-animates. */
  const [turns, setTurns] = useState<number[]>(() => puzzle.start.slice());
  const [moves, setMoves] = useState(0);
  /** Roving tab stop: the last focused cell. */
  const [cursor, setCursor] = useState(0);
  const { hint: timeHint } = useFailHint(99, 60, sfx);
  const cellRefs = useRef<(SVGGElement | null)[]>([]);
  const n = puzzle.size;
  const rots = turns.map((t) => t % 4);
  const flow = pipeFlow(n, puzzle.kinds, rots, puzzle.sourceRow, puzzle.sinkRow);
  const reach = Math.max(-1, ...[...flow.lit].map((i) => i % n)) + 1;
  const maxDist = Math.max(1, ...flow.dist.values());

  const hint = timeHint || moves >= HINT_MOVES;
  useRisingEdge(moves >= HINT_MOVES && !timeHint, () => sfx("hint_pop"));
  const hintCell =
    !hint || solved
      ? -1
      : (puzzle.path.find(
          (i) =>
            pipeMask(puzzle.kinds[i], rots[i]) !== pipeMask(puzzle.kinds[i], puzzle.solution[i]),
        ) ?? -1);

  const rotate = (idx: number) => {
    if (solved) return;
    const next = turns.slice();
    next[idx] += 1;
    setTurns(next);
    setMoves((m) => m + 1);
    const res = pipeFlow(
      n,
      puzzle.kinds,
      next.map((t) => t % 4),
      puzzle.sourceRow,
      puzzle.sinkRow,
    );
    if (res.solved) {
      onSolve();
      return;
    }
    sfx(res.lit.size > flow.lit.size ? "keypad_beep" : "ui_click");
  };

  const reset = () => {
    if (solved) return;
    setTurns(puzzle.start.slice());
    setMoves(0);
    sfx("ui_click");
  };

  const onCellKey = (e: KeyboardEvent<SVGGElement>, idx: number) => {
    const r = Math.floor(idx / n);
    const c = idx % n;
    let target = -1;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      rotate(idx);
      return;
    }
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      reset();
      return;
    }
    const d = arrowDelta(e.key);
    if (!d) return;
    e.preventDefault();
    const nr = Math.max(0, Math.min(n - 1, r + d[1]));
    const nc = Math.max(0, Math.min(n - 1, c + d[0]));
    target = nr * n + nc;
    if (target !== idx) cellRefs.current[target]?.focus();
  };

  const pad = CELL;
  const w = n * CELL + pad * 2;
  const h = n * CELL;
  const connected = flow.solved;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-[440px] select-none"
        role="grid"
        aria-label={tr("Pipe network")}
      >
        <defs>
          <filter id="pipes-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Source */}
        <g>
          <rect
            x={4}
            y={puzzle.sourceRow * CELL + 10}
            width={pad - 12}
            height={CELL - 20}
            fill="#1A1A1A"
            stroke="#FFB800"
          />
          <line
            x1={pad - 8}
            y1={puzzle.sourceRow * CELL + CELL / 2}
            x2={pad}
            y2={puzzle.sourceRow * CELL + CELL / 2}
            stroke="#00FFFF"
            strokeWidth={8}
            filter="url(#pipes-glow)"
          />
          <text
            x={pad / 2 - 2}
            y={puzzle.sourceRow * CELL + CELL / 2 + 4}
            textAnchor="middle"
            fontSize={10}
            fill="#FFB800"
            fontFamily="monospace"
          >
            IN
          </text>
        </g>
        {/* Sink */}
        <g>
          <rect
            x={pad + n * CELL + 8}
            y={puzzle.sinkRow * CELL + 10}
            width={pad - 12}
            height={CELL - 20}
            fill={connected ? "#003333" : "#1A1A1A"}
            stroke={connected ? "#00FFFF" : "#FFB800"}
          />
          <line
            x1={pad + n * CELL}
            y1={puzzle.sinkRow * CELL + CELL / 2}
            x2={pad + n * CELL + 8}
            y2={puzzle.sinkRow * CELL + CELL / 2}
            stroke={connected ? "#00FFFF" : "#335533"}
            strokeWidth={8}
          />
          <text
            x={pad + n * CELL + pad / 2 + 2}
            y={puzzle.sinkRow * CELL + CELL / 2 + 4}
            textAnchor="middle"
            fontSize={10}
            fill={connected ? "#00FFFF" : "#FFB800"}
            fontFamily="monospace"
          >
            OUT
          </text>
        </g>
        {puzzle.kinds.map((kind, idx) => {
          const r = Math.floor(idx / n);
          const c = idx % n;
          const x = pad + c * CELL;
          const y = r * CELL;
          const cx = x + CELL / 2;
          const cy = y + CELL / 2;
          const mask = pipeMask(kind, rots[idx]);
          const lit = flow.lit.has(idx);
          const color = lit ? "#00FFFF" : "#33FF33";
          const inDir = flow.entry.get(idx);
          const d = flow.dist.get(idx) ?? 0;
          const ends: [number, number, number][] = [
            [N, cx, y],
            [E, x + CELL, cy],
            [S, cx, y + CELL],
            [W, x, cy],
          ];
          const open = ends.filter(([bit]) => (mask & bit) !== 0);
          return (
            <g
              key={idx}
              ref={(el) => {
                cellRefs.current[idx] = el;
              }}
              role="gridcell"
              tabIndex={idx === cursor ? 0 : -1}
              onFocus={() => setCursor(idx)}
              data-pz-autofocus={idx === 0 ? "" : undefined}
              aria-label={`${tr("Segment row {row}, column {col}", { row: r + 1, col: c + 1 })}${lit ? ` (${tr("flowing")})` : ""}${idx === hintCell ? ` (${tr("misaligned")})` : ""}`}
              onClick={() => rotate(idx)}
              onKeyDown={(e) => onCellKey(e, idx)}
              className="pz-cell group outline-none"
            >
              <rect
                x={x + 1}
                y={y + 1}
                width={CELL - 2}
                height={CELL - 2}
                fill={lit ? "#002222" : "#0D0D0D"}
                stroke="#1F3F1F"
                className="transition-colors group-hover:fill-[#112611]"
              />
              <g
                key={turns[idx]}
                className={reduceMotion ? undefined : "pz-turn"}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
                filter={lit ? "url(#pipes-glow)" : undefined}
              >
                {open.map(([bit, ex, ey]) => (
                  <line
                    key={bit}
                    x1={cx}
                    y1={cy}
                    x2={ex}
                    y2={ey}
                    stroke={color}
                    strokeWidth={8}
                    strokeLinecap="butt"
                    opacity={lit ? 1 : 0.7}
                  />
                ))}
                <circle cx={cx} cy={cy} r={5} fill={color} opacity={lit ? 1 : 0.7} />
                {/* Flow: dashes run from the entry side through the centre and out. */}
                {lit &&
                  open.map(([bit, ex, ey]) => {
                    const incoming = bit === inDir;
                    return (
                      <line
                        key={`f${bit}`}
                        x1={incoming ? ex : cx}
                        y1={incoming ? ey : cy}
                        x2={incoming ? cx : ex}
                        y2={incoming ? cy : ey}
                        stroke="#E8FFFF"
                        strokeWidth={connected ? 3 : 2}
                        strokeLinecap="round"
                        opacity={connected ? 0.95 : 0.55}
                        className={connected ? "pz-flow" : "pz-flow-slow"}
                        style={{ animationDelay: `${-(maxDist - d) * 55}ms` }}
                        pointerEvents="none"
                      />
                    );
                  })}
              </g>
              {idx === hintCell && (
                <rect
                  x={x + 3}
                  y={y + 3}
                  width={CELL - 6}
                  height={CELL - 6}
                  fill="none"
                  stroke="#FFB800"
                  strokeWidth={2}
                  className="animate-pulse"
                  pointerEvents="none"
                />
              )}
              <rect
                x={x + 2}
                y={y + 2}
                width={CELL - 4}
                height={CELL - 4}
                fill="none"
                stroke="#00FFFF"
                strokeWidth={2}
                strokeDasharray="4 3"
                className="pz-focus"
              />
            </g>
          );
        })}
      </svg>
      <div className="flex w-full max-w-[440px] flex-col gap-2">
        <ProgressBar
          value={connected ? 1 : reach / n}
          label={tr("Reach: column {reach} / {n} · {lit} segments live", {
            reach,
            n,
            lit: flow.lit.size,
          })}
        />
        <HintBox show={hintCell >= 0}>
          {tr(
            "The current reaches column {reach}. The marked segment lies on the ideal line and is misaligned. One or two quarter turns — then we will see.",
            { reach },
          )}
        </HintBox>
        <PuzzleFooter
          help={
            <>
              {tr("Click")} / <kbd>Enter</kbd> / <kbd>{tr("Space")}</kbd> {tr("rotates")} ·{" "}
              <kbd>←↑↓→</kbd> {tr("or")} <kbd>WASD</kbd> {tr("move")} · <kbd>R</kbd> {tr("resets")}
            </>
          }
          extra={
            <span className="text-xs text-[#FFB800] tabular-nums">
              {tr("Moves: {n}", { n: moves })}
            </span>
          }
          onReset={reset}
          resetDisabled={solved}
        />
      </div>
    </div>
  );
}

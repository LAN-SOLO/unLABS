"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  STENCIL_H,
  STENCIL_W,
  distanceToPath,
  generateStencil,
  parseShape,
  stencilStart,
  stencilStep,
  type Cell,
  type StencilState,
} from "@/components/world/puzzles/engine/stencil";
import { num, str } from "@/components/world/puzzles/logic";
import {
  HintBox,
  ProgressBar,
  PuzzleFooter,
  StatusLine,
  useFailFx,
  useFailHint,
  useHotkeys,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const CELL = 24;
const W = STENCIL_W * CELL;
const H = STENCIL_H * CELL;
const CRACK_MS = 1000;
/** Cracks after which the blank gets more forgiving (progressive assist). */
const SOFT_FAILS = 5;
const SOFT_BONUS = 5;

const KEY_DIRS: Record<string, readonly [number, number]> = {
  arrowup: [0, -1],
  arrowdown: [0, 1],
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  q: [-1, -1],
  e: [1, -1],
  z: [-1, 1],
  y: [-1, 1],
  c: [1, 1],
  // Numpad-style digits: 7 8 9 / 4 · 6 / 1 2 3.
  "7": [-1, -1],
  "8": [0, -1],
  "9": [1, -1],
  "4": [-1, 0],
  "6": [1, 0],
  "1": [-1, 1],
  "2": [0, 1],
  "3": [1, 1],
};

interface TrailDot {
  cell: Cell;
  on: boolean;
}

type Feedback = { tone: "ok" | "bad" | "info"; text: string };

function cx(c: Cell): number {
  return c[0] * CELL + CELL / 2;
}
function cy(c: Cell): number {
  return c[1] * CELL + CELL / 2;
}

export function StencilPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 3);
  const shape = parseShape(str(params, "shape", "hex"));
  const baseStress = Math.max(3, num(params, "maxStress", 15));
  // Flavour for the host device (defaults: the micro-shard / slice synthesizer).
  const doneText = str(params, "done", tr("Stencil complete. A new slice crystallises."));
  const crackText = str(
    params,
    "crack",
    tr("Stress too high — the micro-shard cracks along the deviation."),
  );
  const puzzle = useMemo(() => generateStencil(seed, shape), [seed, shape]);
  const path = puzzle.path;

  const [state, setState] = useState<StencilState>(() => stencilStart(path));
  const [trail, setTrail] = useState<TrailDot[]>([]);
  const [cracking, setCracking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "info",
    text: tr("Follow the stencil from S to E. Steady hand."),
  });
  const sfx = useSfx(sound);
  const { fails, fail, hint } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const softened = fails >= SOFT_FAILS;
  const maxStress = baseStress + (softened ? SOFT_BONUS : 0);

  const stateRef = useRef(state);
  const crackingRef = useRef(false);
  const draggingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const restart = (text: string) => {
    const s = stencilStart(path);
    stateRef.current = s;
    crackingRef.current = false;
    setState(s);
    setTrail([]);
    setCracking(false);
    setFeedback({ tone: "info", text });
  };

  const move = (dx: number, dy: number) => {
    if (solved || crackingRef.current) return;
    const prev = stateRef.current;
    const next = stencilStep(prev, dx, dy, path, maxStress);
    if (next === prev) return;
    stateRef.current = next;
    setState(next);
    if (next.pos !== prev.pos) {
      const on = distanceToPath(next.pos, path) === 0;
      setTrail((t) => [...t, { cell: next.pos, on }]);
    }
    if (next.cracked) {
      crackingRef.current = true;
      draggingRef.current = false;
      setCracking(true);
      setFeedback({
        tone: "bad",
        text: crackText,
      });
      fail();
      failFx();
      sfx("fail_buzz");
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(
        () => restart(tr("New blank inserted. Stress reset.")),
        CRACK_MS,
      );
      return;
    }
    if (next.done) {
      setFeedback({ tone: "ok", text: doneText });
      onSolve();
      return;
    }
    if (next.blocked) {
      sfx("anomaly_zap");
      setFeedback({ tone: "bad", text: tr("Spark! Too far from the edge — movement blocked.") });
    } else if (distanceToPath(next.pos, path) === 1) {
      sfx("ui_hover");
      setFeedback({ tone: "bad", text: tr("Off the line — every step here costs stress.") });
    } else {
      if (next.progress > prev.progress && next.progress % 5 === 0) sfx("ui_click");
      setFeedback({ tone: "info", text: tr("On the line.") });
    }
  };

  useHotkeys((key) => {
    const dir = KEY_DIRS[key.toLowerCase()];
    if (!dir) return false;
    move(dir[0], dir[1]);
    return true;
  }, !solved);

  const cellFromPointer = (e: PointerEvent<SVGSVGElement>): Cell | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const x = Math.floor(((e.clientX - r.left) / r.width) * STENCIL_W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * STENCIL_H);
    return [x, y];
  };

  const followPointer = (e: PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    const target = cellFromPointer(e);
    if (!target) return;
    // At most two steps per event so a fast flick cannot teleport the cursor.
    for (let i = 0; i < 2; i++) {
      const p = stateRef.current.pos;
      const dx = Math.sign(target[0] - p[0]);
      const dy = Math.sign(target[1] - p[1]);
      if (dx === 0 && dy === 0) break;
      const before = stateRef.current;
      move(dx, dy);
      if (stateRef.current === before || stateRef.current.blocked || crackingRef.current) break;
    }
  };

  const stressFrac = Math.min(1, state.stress / maxStress);
  const stressColor = stressFrac < 0.5 ? "#FFB800" : stressFrac < 0.8 ? "#FF8A1E" : "#FF4040";
  const start = path[0];
  const end = path[path.length - 1];
  const nextSteps = hint ? path.slice(state.progress + 1, state.progress + 4) : [];
  const pathD = path.map((c, i) => `${i === 0 ? "M" : "L"} ${cx(c)} ${cy(c)}`).join(" ");
  const doneD = path
    .slice(0, state.progress + 1)
    .map((c, i) => `${i === 0 ? "M" : "L"} ${cx(c)} ${cy(c)}`)
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[520px]">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-[#FFB800]">{tr("Stress")}</span>
          <span style={{ color: stressColor }}>
            {state.stress} / {maxStress}
          </span>
        </div>
        <div className="relative h-3 w-full rounded-sm border border-[#33FF33]/30 bg-black">
          <div
            className={`h-full transition-[width] duration-100 ${stressFrac >= 0.8 ? "animate-pulse" : ""}`}
            style={{
              width: `${stressFrac * 100}%`,
              background: stressColor,
              boxShadow: `0 0 6px ${stressColor}`,
            }}
          />
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`w-full max-w-[520px] touch-none rounded-sm border border-[#33FF33]/30 bg-[#050805] select-none ${
          cracking ? "animate-pulse" : ""
        } ${failClass}`}
        role="application"
        tabIndex={0}
        data-pz-autofocus
        aria-label={tr("Stencil: progress {p} of {total} steps, stress {s}", {
          p: state.progress,
          total: path.length - 1,
          s: state.stress,
        })}
        onPointerDown={(e) => {
          if (solved || cracking) return;
          const target = cellFromPointer(e);
          const p = stateRef.current.pos;
          if (!target || Math.max(Math.abs(target[0] - p[0]), Math.abs(target[1] - p[1])) > 2) {
            setFeedback({
              tone: "info",
              text: tr("Set the stylus at the cursor and drag from there."),
            });
            return;
          }
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          followPointer(e);
        }}
        onPointerMove={followPointer}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      >
        {Array.from({ length: STENCIL_W * STENCIL_H }, (_, i) => (
          <circle
            key={i}
            cx={(i % STENCIL_W) * CELL + CELL / 2}
            cy={Math.floor(i / STENCIL_W) * CELL + CELL / 2}
            r={1}
            fill="#33FF33"
            opacity={0.18}
          />
        ))}
        {/* Tolerance corridor */}
        <path
          d={pathD}
          fill="none"
          stroke="#33FF33"
          strokeOpacity={0.06}
          strokeWidth={CELL * 3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Stencil outline */}
        <path
          d={pathD}
          fill="none"
          stroke="#33FF33"
          strokeOpacity={0.35}
          strokeWidth={CELL * 0.8}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="2 4"
        />
        <path
          d={doneD}
          fill="none"
          stroke="#00FFFF"
          strokeOpacity={0.55}
          strokeWidth={CELL * 0.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 4px #00FFFF)" }}
        />
        {/* Trail: squares on the line, amber crosses beside it (shape + colour). */}
        {trail.map((t, i) =>
          t.on ? (
            <rect
              key={i}
              x={t.cell[0] * CELL + CELL * 0.3}
              y={t.cell[1] * CELL + CELL * 0.3}
              width={CELL * 0.4}
              height={CELL * 0.4}
              fill="#33FF33"
              opacity={0.8}
            />
          ) : (
            <path
              key={i}
              d={`M${t.cell[0] * CELL + CELL * 0.28},${t.cell[1] * CELL + CELL * 0.28} l${CELL * 0.44},${CELL * 0.44} m0,${-CELL * 0.44} l${-CELL * 0.44},${CELL * 0.44}`}
              stroke="#FFB800"
              strokeWidth={2.5}
              opacity={0.9}
            />
          ),
        )}
        {nextSteps.map((c, i) => (
          <circle
            key={`h${i}`}
            cx={cx(c)}
            cy={cy(c)}
            r={CELL * 0.32}
            fill="none"
            stroke="#FFB800"
            strokeWidth={2}
            opacity={1 - i * 0.25}
            className="animate-pulse"
          />
        ))}
        {[
          { c: start, label: "S" },
          { c: end, label: "E" },
        ].map(({ c, label }) => (
          <g key={label}>
            <rect
              x={c[0] * CELL + 2}
              y={c[1] * CELL + 2}
              width={CELL - 4}
              height={CELL - 4}
              fill="#0D0D0D"
              stroke="#FFB800"
            />
            <text
              x={cx(c)}
              y={cy(c) + 4}
              textAnchor="middle"
              fontSize={12}
              fontFamily="monospace"
              fill="#FFB800"
            >
              {label}
            </text>
          </g>
        ))}
        {/* Cursor */}
        <g
          style={{ filter: `drop-shadow(0 0 5px ${cracking ? "#FF4040" : "#00FFFF"})` }}
          className={state.blocked ? "pz-shake" : undefined}
        >
          <rect
            x={state.pos[0] * CELL + 3}
            y={state.pos[1] * CELL + 3}
            width={CELL - 6}
            height={CELL - 6}
            fill="none"
            stroke={cracking ? "#FF4040" : state.blocked ? "#FF8A1E" : "#00FFFF"}
            strokeWidth={2.5}
          />
        </g>
        {cracking && (
          <g stroke="#FF4040" strokeWidth={1.6} fill="none" opacity={0.9}>
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const a = (k / 6) * Math.PI * 2 + 0.4;
              const x0 = cx(state.pos);
              const y0 = cy(state.pos);
              return (
                <polyline
                  key={k}
                  points={`${x0},${y0} ${x0 + Math.cos(a) * 18},${y0 + Math.sin(a) * 14} ${
                    x0 + Math.cos(a + 0.3) * 38
                  },${y0 + Math.sin(a + 0.3) * 30} ${x0 + Math.cos(a - 0.2) * 60},${y0 + Math.sin(a - 0.2) * 48}`}
                />
              );
            })}
          </g>
        )}
        {solved && (
          <path
            d={pathD}
            fill="none"
            stroke="#E8FFE8"
            strokeWidth={CELL * 0.35}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 8px #00FFFF)" }}
          />
        )}
      </svg>

      <div className="flex w-full max-w-[520px] flex-col gap-2">
        <ProgressBar
          value={state.progress / (path.length - 1)}
          label={tr("Progress: {p} / {total} steps · Cracks: {fails}", {
            p: state.progress,
            total: path.length - 1,
            fails,
          })}
        />
        <StatusLine tone={feedback.tone}>{feedback.text}</StatusLine>
        <HintBox show={hint && !solved}>
          {tr(
            "The next three steps are marked. Diagonals (Q E Z C) save detours — every step off the line costs one point of stress. On the keyboard, no hand trembles.",
          )}
          {softened &&
            ` ${tr("I have inserted a softer blank: {n} points of stress.", { n: maxStress })}`}
        </HintBox>
        <PuzzleFooter
          help={
            <>
              {tr("Start at the cursor and drag")} · <kbd>←↑↓→</kbd>/<kbd>WASD</kbd> ·{" "}
              {tr("diagonal")} <kbd>Q</kbd> <kbd>E</kbd> <kbd>Z</kbd> <kbd>C</kbd> {tr("or numpad")}{" "}
              <kbd>1</kbd>–<kbd>9</kbd> · {tr("■ on the line, ✕ beside it")}
            </>
          }
          onReset={() => {
            sfx("ui_click");
            restart(tr("Back to the start."));
          }}
          resetDisabled={solved || cracking}
        />
      </div>
    </div>
  );
}

"use client";

import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  WIRE_COLORS,
  cellOwners,
  emptyPaths,
  endpointColor,
  extendPath,
  generateWiring,
  isConnected,
  startPath,
  stepsToward,
  validatePaths,
  type WirePaths,
} from "@/components/world/puzzles/engine/wiring";
import { num } from "@/components/world/puzzles/logic";
import {
  HintBox,
  PuzzleFooter,
  SHAPE_GLYPH,
  ShapeMark,
  StatusLine,
  arrowDelta,
  shapeAt,
  useFailFx,
  useFailHint,
  useHotkeys,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const C = 52;
const M = 34;

export function WiringPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 9);
  const size = num(params, "size", 6);
  const pairs = num(params, "pairs", 5);
  const puzzle = useMemo(() => generateWiring(seed, size, pairs), [seed, size, pairs]);
  const n = puzzle.size;
  const [paths, setPaths] = useState<WirePaths>(() => emptyPaths(puzzle));
  const [cursor, setCursor] = useState(0);
  const [holding, setHolding] = useState(-1);
  const pathsRef = useRef<WirePaths>(paths);
  const dragRef = useRef<{ color: number; pointer: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sfx = useSfx(sound);
  const { fail, hint } = useFailHint(3, 50, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const glowId = useId().replace(/:/g, "");

  const owners = cellOwners(n, paths);
  const connected = puzzle.endpoints.map((e) => isConnected(puzzle, paths[e.color] ?? [], e.color));
  const cursorColor = (() => {
    const ep = endpointColor(puzzle, cursor);
    return ep >= 0 ? ep : (owners[cursor] ?? -1);
  })();
  const doneCount = connected.filter(Boolean).length;
  const ghost = hint ? connected.findIndex((c) => !c) : -1;

  const countConnected = (p: WirePaths) =>
    puzzle.endpoints.filter((e) => isConnected(puzzle, p[e.color] ?? [], e.color)).length;

  const commit = (next: WirePaths) => {
    if (next === pathsRef.current) return;
    const before = countConnected(pathsRef.current);
    pathsRef.current = next;
    setPaths(next);
    if (validatePaths(puzzle, next)) {
      onSolve();
      return;
    }
    if (countConnected(next) > before) sfx("keypad_beep");
  };

  const colorAt = (cell: number): number => {
    const ep = endpointColor(puzzle, cell);
    if (ep >= 0) return ep;
    return cellOwners(n, pathsRef.current)[cell] ?? -1;
  };

  const cellFromEvent = (e: PointerEvent<SVGSVGElement>): number => {
    const svg = svgRef.current;
    if (!svg) return -1;
    const rect = svg.getBoundingClientRect();
    const scale = (n * C + 2 * M) / rect.width;
    const x = (e.clientX - rect.left) * scale - M;
    const y = (e.clientY - rect.top) * scale;
    const c = Math.floor(x / C);
    const r = Math.floor(y / C);
    if (r < 0 || c < 0 || r >= n || c >= n) return -1;
    return r * n + c;
  };

  const extendToward = (color: number, target: number) => {
    let cur = pathsRef.current;
    const own = cur[color] ?? [];
    if (own.length === 0) return;
    for (const cell of stepsToward(n, own[own.length - 1], target)) {
      const next = extendPath(puzzle, cur, color, cell);
      if (next === cur) break;
      cur = next;
    }
    commit(cur);
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (solved) return;
    const cell = cellFromEvent(e);
    if (cell < 0) return;
    setCursor(cell);
    const color = colorAt(cell);
    if (color < 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { color, pointer: e.pointerId };
    sfx("ui_click");
    commit(startPath(puzzle, pathsRef.current, color, cell));
    setHolding(-1);
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || solved || drag.pointer !== e.pointerId) return;
    const cell = cellFromEvent(e);
    if (cell < 0) return;
    extendToward(drag.color, cell);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    const empty = emptyPaths(puzzle);
    pathsRef.current = empty;
    setPaths(empty);
    setHolding(-1);
    fail();
  };

  /** Blocked move (foreign wire end in the way): buzz, shake, count toward the hint. */
  const blocked = () => {
    fail();
    failFx();
    sfx("fail_buzz");
  };

  const pickOrDrop = () => {
    if (holding >= 0) {
      sfx("ui_click");
      setHolding(-1);
      return;
    }
    const color = colorAt(cursor);
    if (color < 0) return;
    sfx("ui_click");
    const next = startPath(puzzle, pathsRef.current, color, cursor);
    commit(next);
    setHolding(isConnected(puzzle, next[color] ?? [], color) ? -1 : color);
  };

  useHotkeys((key) => {
    if (solved) return false;
    if (key === " " || key === "Enter") {
      pickOrDrop();
      return true;
    }
    const d = arrowDelta(key);
    if (!d) return false;
    const r = Math.floor(cursor / n) + d[1];
    const c = (cursor % n) + d[0];
    if (r < 0 || c < 0 || r >= n || c >= n) return true;
    const target = r * n + c;
    if (holding < 0) {
      setCursor(target);
      return true;
    }
    const next = extendPath(puzzle, pathsRef.current, holding, target);
    if (next === pathsRef.current) {
      const ep = endpointColor(puzzle, target);
      if (ep >= 0 && ep !== holding) blocked();
      return true;
    }
    commit(next);
    const own = next[holding] ?? [];
    setCursor(own[own.length - 1] ?? target);
    if (isConnected(puzzle, own, holding)) setHolding(-1);
    else sfx("ui_click");
    return true;
  });

  const W = n * C + 2 * M;
  const H = n * C;
  const px = (cell: number) => M + (cell % n) * C + C / 2;
  const py = (cell: number) => Math.floor(cell / n) * C + C / 2;
  const points = (p: readonly number[]) => p.map((cell) => `${px(cell)},${py(cell)}`).join(" ");

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`w-full max-w-[480px] touch-none rounded-sm select-none ${failClass}`}
        role="application"
        tabIndex={0}
        data-pz-autofocus
        aria-roledescription={tr("Wiring harness")}
        aria-label={`${tr("Wiring harness {n}×{n}. Cursor row {row}, column {col}", {
          n,
          row: Math.floor(cursor / n) + 1,
          col: (cursor % n) + 1,
        })}${
          cursorColor >= 0 ? tr(", wire {color}", { color: WIRE_COLORS[cursorColor].name }) : ""
        }${holding >= 0 ? tr(". In hand: {color}", { color: WIRE_COLORS[holding].name }) : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <filter id={glowId} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Terminal blocks */}
        {[0, W - M + 4].map((x, k) => (
          <g key={k}>
            <rect x={x + 4} y={4} width={M - 12} height={H - 8} fill="#1A1A1A" stroke="#3A3A3A" />
            {Array.from({ length: n }, (_, i) => (
              <circle key={i} cx={x + M / 2 - 2} cy={i * C + C / 2} r={4} fill="#3A3A3A" />
            ))}
            <text
              x={x + M / 2 - 2}
              y={H / 2}
              fontSize={8}
              fill="#FFB800"
              fontFamily="monospace"
              textAnchor="middle"
              transform={`rotate(-90 ${x + M / 2 - 2} ${H / 2})`}
            >
              {k === 0 ? "KLEMMLEISTE A" : "KLEMMLEISTE B"}
            </text>
          </g>
        ))}
        {owners.map((owner, cell) => (
          <rect
            key={cell}
            x={M + (cell % n) * C + 0.5}
            y={Math.floor(cell / n) * C + 0.5}
            width={C - 1}
            height={C - 1}
            fill={owner >= 0 && connected[owner] ? WIRE_COLORS[owner].hex : "#070A07"}
            fillOpacity={owner >= 0 && connected[owner] ? 0.12 : 1}
            stroke="#163016"
          />
        ))}
        {ghost >= 0 && !solved && (
          <polyline
            points={points(puzzle.solution[ghost] ?? [])}
            fill="none"
            stroke={WIRE_COLORS[ghost].hex}
            strokeWidth={3}
            strokeDasharray="2 7"
            strokeLinecap="round"
            opacity={0.8}
            pointerEvents="none"
          />
        )}
        <g filter={`url(#${glowId})`} pointerEvents="none">
          {paths.map((p, color) =>
            p.length >= 2 ? (
              <polyline
                key={color}
                points={points(p)}
                fill="none"
                stroke={WIRE_COLORS[color].hex}
                strokeWidth={C * 0.3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={connected[color] ? 1 : 0.75}
              />
            ) : null,
          )}
        </g>
        {/* Current running through completed wires. */}
        <g pointerEvents="none">
          {paths.map((p, color) =>
            p.length >= 2 && connected[color] ? (
              <polyline
                key={color}
                points={points(p)}
                fill="none"
                stroke="#FFFFFF"
                strokeOpacity={0.7}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pz-flow"
              />
            ) : null,
          )}
        </g>
        {puzzle.endpoints.map((e) =>
          [e.a, e.b].map((cell) => (
            <g key={`${e.color}-${cell}`} pointerEvents="none">
              <circle
                cx={px(cell)}
                cy={py(cell)}
                r={C * 0.32}
                fill={WIRE_COLORS[e.color].hex}
                stroke="#0D0D0D"
                strokeWidth={3}
              />
              {/* Shape per colour so pairs read without colour vision. */}
              <ShapeMark
                shape={shapeAt(e.color)}
                cx={px(cell)}
                cy={py(cell)}
                r={C * 0.17}
                fill={connected[e.color] ? "#FFFFFF" : "#0D0D0D"}
                stroke={connected[e.color] ? "#0D0D0D" : undefined}
              />
            </g>
          )),
        )}
        {!solved && (
          <rect
            x={M + (cursor % n) * C + 2}
            y={Math.floor(cursor / n) * C + 2}
            width={C - 4}
            height={C - 4}
            fill="none"
            stroke={holding >= 0 ? WIRE_COLORS[holding].hex : "#00FFFF"}
            strokeOpacity={0.7}
            strokeDasharray="4 3"
            pointerEvents="none"
            className={`pz-cursor ${holding >= 0 ? "" : "pz-blink"}`}
          />
        )}
      </svg>
      <div className="flex w-full max-w-[480px] flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[#FFB800]">
          {tr("Connected: {done} / {total}", { done: doneCount, total: puzzle.endpoints.length })}
        </span>
        <ul className="flex flex-wrap gap-1.5" aria-label={tr("Wires")}>
          {puzzle.endpoints.map((e) => (
            <li
              key={e.color}
              className={`rounded-sm border px-1 transition-opacity ${connected[e.color] ? "" : "border-dashed"}`}
              style={{
                borderColor: WIRE_COLORS[e.color].hex,
                color: WIRE_COLORS[e.color].hex,
                opacity: connected[e.color] ? 1 : 0.55,
              }}
            >
              <span aria-hidden>{SHAPE_GLYPH[shapeAt(e.color)]} </span>
              {WIRE_COLORS[e.color].name}
              <span className="sr-only">
                {connected[e.color] ? ` ${tr("wire::connected")}` : ` ${tr("wire::open")}`}
              </span>
              {connected[e.color] && <span aria-hidden> ✓</span>}
            </li>
          ))}
        </ul>
      </div>
      <StatusLine tone={solved ? "ok" : "info"}>
        {solved
          ? tr("Wiring harness closed. No crossing, no short circuit.")
          : holding >= 0
            ? tr("Wire {color} in hand — arrows route it, Space lets go.", {
                color: WIRE_COLORS[holding].name,
              })
            : tr("Connect matching wire ends (colour + symbol). Wires must not cross.")}
      </StatusLine>
      <div className="w-full max-w-[480px]">
        <HintBox show={hint && ghost >= 0 && !solved}>
          {tr(
            "The dotted trace shows how Jade would have routed the {color} wire. The rest follows. Rule of thumb: wires along the edge first, then the ones in the middle.",
            { color: WIRE_COLORS[Math.max(0, ghost)].name },
          )}
        </HintBox>
      </div>
      <div className="w-full max-w-[480px]">
        <PuzzleFooter
          help={
            <>
              {tr("Mouse: drag from a wire end")} · <kbd>←</kbd>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <kbd>→</kbd>/<kbd>WASD</kbd> {tr("wiring::move")} · <kbd>{tr("Space")}</kbd>/
              <kbd>Enter</kbd> {tr("picks up / lets go of a wire")}
            </>
          }
          onReset={reset}
          resetDisabled={solved}
        />
      </div>
    </div>
  );
}

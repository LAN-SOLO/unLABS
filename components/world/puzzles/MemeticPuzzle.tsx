"use client";

import { fmtNum } from "@/components/world/format";
import { tr } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  CENTROID,
  MEMETIC_AXES,
  TRI_H,
  TRI_VERTICES,
  axisFeedback,
  baryToXY,
  clampBary,
  fitness,
  inTargetZone,
  jitter,
  memeticTarget,
  moveBary,
  xyToBary,
  type Bary,
} from "@/components/world/puzzles/engine/memetic";
import { num } from "@/components/world/puzzles/logic";
import {
  HintBox,
  ProgressBar,
  PuzzleFooter,
  StatusLine,
  isTypingTarget,
  useFailFx,
  useFailHint,
  usePuzzleFx,
  useRisingEdge,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";

const S = 300;
const PAD_X = 50;
const PAD_TOP = 34;
const VB_W = S + PAD_X * 2;
const VB_H = S * TRI_H + PAD_TOP + 40;
const KEY_SPEED = 0.32; // triangle units per second
/** Shift = fine control. */
const FINE_FACTOR = 0.35;
const DRIFT_GAIN = 1.6;
const MIN_HOLD_FOR_FAIL = 0.5;

function toPx(p: Bary): [number, number] {
  const [x, y] = baryToXY(p);
  return [PAD_X + x * S, PAD_TOP + y * S];
}

/** Colour from cold (red) through amber to hot (green), by closeness 0..1. */
function heat(closeness: number): string {
  if (closeness > 0.8) return "#33FF33";
  if (closeness > 0.5) return "#FFB800";
  return "#FF4D4D";
}

export function MemeticPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 1016);
  const radius = Math.max(0.03, num(params, "radius", 0.08));
  const hold = Math.max(0.5, num(params, "hold", 2));
  const drift = Math.max(0, num(params, "drift", 0.02));
  const target = useMemo(() => memeticTarget(seed), [seed]);

  const [pos, setPos] = useState<Bary>(CENTROID);
  const [held, setHeld] = useState(0);
  const [inside, setInside] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  const sfx = useSfx(sound);
  const { fails, fail, hint } = useFailHint(3, 40, sfx);
  const { failClass, fail: failFx } = useFailFx();
  /** Second hint stage: after six drop-outs the MCP damps the drift by half. */
  const damped = fails >= 6;
  const driftScaleRef = useRef(1);
  useEffect(() => {
    driftScaleRef.current = damped ? 0.5 : 1;
  }, [damped]);
  const { reduceMotion } = usePuzzleFx();
  const [trail, setTrail] = useState<Bary[]>([]);
  useRisingEdge(inside && !solved, () => sfx("keypad_beep"));

  const posRef = useRef<Bary>(CENTROID);
  const dragRef = useRef<Bary | null>(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false, fine: false });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cbRef = useRef({ onSolve, fail, sfx, failFx });
  useEffect(() => {
    cbRef.current = { onSolve, fail, sfx, failFx };
  }, [onSolve, fail, sfx, failFx]);

  useEffect(() => {
    type Dir = "up" | "down" | "left" | "right";
    const map: Record<string, Dir> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    const dirOf = (e: KeyboardEvent): Dir | undefined =>
      map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    const down = (e: KeyboardEvent) => {
      keysRef.current.fine = e.shiftKey;
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const k = dirOf(e);
      if (!k) return;
      e.preventDefault();
      keysRef.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.fine = e.shiftKey;
      const k = dirOf(e);
      if (k) keysRef.current[k] = false;
    };
    // Releasing keys outside the window must not leave the marker running.
    const blur = () => {
      keysRef.current = { up: false, down: false, left: false, right: false, fine: false };
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    if (solved) return;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let inZoneFor = 0;
    let done = false;
    let trailT = 0;
    let trailPts: Bary[] = [];
    posRef.current = CENTROID;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      let p = posRef.current;
      const k = keysRef.current;
      const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      const ky = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      const speed = KEY_SPEED * (k.fine ? FINE_FACTOR : 1);
      if (kx !== 0 || ky !== 0) p = moveBary(p, kx * speed * dt, ky * speed * dt);
      const drag = dragRef.current;
      if (drag) {
        const [px, py] = baryToXY(p);
        const [dx, dy] = baryToXY(drag);
        const a = 1 - Math.exp(-dt / 0.12);
        p = moveBary(p, (dx - px) * a, (dy - py) * a);
      }
      const [jx, jy] = jitter(t, seed);
      const dr = drift * DRIFT_GAIN * driftScaleRef.current * dt;
      p = moveBary(p, jx * dr, jy * dr);
      posRef.current = p;

      const ok = inTargetZone(p, target, radius);
      if (ok) inZoneFor += dt;
      else {
        if (inZoneFor >= MIN_HOLD_FOR_FAIL) {
          cbRef.current.fail();
          cbRef.current.failFx();
          cbRef.current.sfx("fail_buzz");
        }
        inZoneFor = 0;
      }
      trailT += dt;
      if (trailT >= 0.05) {
        trailT = 0;
        trailPts = [...trailPts.slice(-15), p];
        setTrail(trailPts);
      }
      setPos(p);
      setHeld(inZoneFor);
      setInside(ok);
      if (inZoneFor >= hold && !done) {
        done = true;
        cbRef.current.onSolve();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [solved, seed, target, radius, hold, drift, resetTick]);

  const pointerBary = (e: PointerEvent<SVGSVGElement>): Bary | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const vx = ((e.clientX - r.left) / r.width) * VB_W;
    const vy = ((e.clientY - r.top) / r.height) * VB_H;
    return clampBary(xyToBary((vx - PAD_X) / S, (vy - PAD_TOP) / S));
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (solved) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = pointerBary(e);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) dragRef.current = pointerBary(e);
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    setTrail([]);
    dragRef.current = null;
    posRef.current = CENTROID;
    setPos(CENTROID);
    setHeld(0);
    setResetTick((n) => n + 1);
  };

  const fit = fitness(pos, target, radius);
  const fitColor = fit >= 80 ? "#33FF33" : fit >= 50 ? "#FFB800" : "#FF4D4D";
  const fb = axisFeedback(pos, target);
  const [mx, my] = toPx(pos);
  const [tx, ty] = toPx(target);
  const tri = TRI_VERTICES.map(([x, y]) => `${PAD_X + x * S},${PAD_TOP + y * S}`).join(" ");
  const labelPos: [number, number, "middle" | "start" | "end"][] = [
    [PAD_X + 0.5 * S, PAD_TOP - 14, "middle"],
    [PAD_X - 4, PAD_TOP + TRI_H * S + 26, "start"],
    [PAD_X + S + 4, PAD_TOP + TRI_H * S + 26, "end"],
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={`w-full max-w-[360px] cursor-crosshair touch-none rounded-sm select-none ${failClass}`}
          role="application"
          tabIndex={0}
          data-pz-autofocus
          aria-label={tr(
            "Memetic triangle, fitness {fit}. Hold the arrow keys or WASD to move the marker, Shift for fine control.",
            { fit: Math.round(fit) },
          )}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <defs>
            <filter id="memetic-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <polygon points={tri} fill="#050805" stroke="#33FF33" strokeOpacity={0.6} />
          {/* inner grid lines at 1/3 and 2/3 */}
          {[1 / 3, 2 / 3].map((f) =>
            [0, 1, 2].map((axis) => {
              const a: number[] = [0, 0, 0];
              const b: number[] = [0, 0, 0];
              a[axis] = f;
              b[axis] = f;
              a[(axis + 1) % 3] = 1 - f;
              b[(axis + 2) % 3] = 1 - f;
              const [x1, y1] = toPx([a[0], a[1], a[2]]);
              const [x2, y2] = toPx([b[0], b[1], b[2]]);
              return (
                <line
                  key={`${f}-${axis}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#33FF33"
                  strokeOpacity={0.12}
                />
              );
            }),
          )}
          {TRI_VERTICES.map(([x, y], i) => {
            const closeness = 1 - Math.min(1, Math.abs(fb[i]) / 0.3);
            const c = heat(closeness);
            return (
              <g key={i}>
                <circle
                  cx={PAD_X + x * S}
                  cy={PAD_TOP + y * S}
                  r={6 + closeness * 8}
                  fill={c}
                  opacity={0.25 + closeness * 0.6}
                  filter="url(#memetic-glow)"
                />
                <text
                  x={labelPos[i][0]}
                  y={labelPos[i][1]}
                  textAnchor={labelPos[i][2]}
                  fontSize={12}
                  fontFamily="monospace"
                  fill={c}
                >
                  {MEMETIC_AXES[i]}
                </text>
              </g>
            );
          })}
          {hint && (
            <circle
              cx={tx}
              cy={ty}
              r={radius * S}
              fill="#00FFFF"
              fillOpacity={0.06}
              stroke="#00FFFF"
              strokeDasharray="3 4"
              strokeOpacity={0.8}
            />
          )}
          {!reduceMotion &&
            trail.map((p, i) => {
              const [x, y] = toPx(p);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={1.5 + (i / trail.length) * 2}
                  fill={fitColor}
                  opacity={(i / trail.length) * 0.45}
                  pointerEvents="none"
                />
              );
            })}
          <g filter="url(#memetic-glow)">
            <line
              x1={mx - 7}
              y1={my - 7}
              x2={mx + 7}
              y2={my + 7}
              stroke={fitColor}
              strokeWidth={2}
            />
            <line
              x1={mx - 7}
              y1={my + 7}
              x2={mx + 7}
              y2={my - 7}
              stroke={fitColor}
              strokeWidth={2}
            />
            {inside && (
              <>
                <circle cx={mx} cy={my} r={11} fill="none" stroke="#33FF33" strokeOpacity={0.7} />
                <circle
                  cx={mx}
                  cy={my}
                  r={11}
                  fill="none"
                  stroke="#33FF33"
                  strokeWidth={1.5}
                  className="animate-ping"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              </>
            )}
          </g>
        </svg>

        <div className="flex w-full flex-col gap-2 text-xs">
          <div className="rounded-sm border border-[#33FF33]/30 bg-black px-3 py-2 text-center">
            <div className="text-[10px] tracking-widest text-[#FFB800]">
              {tr("MEMETIC FITNESS")}
            </div>
            <div
              className="text-3xl tabular-nums"
              style={{ color: fitColor, textShadow: `0 0 8px ${fitColor}` }}
            >
              {Math.round(fit)}
            </div>
          </div>
          {MEMETIC_AXES.map((axis, i) => {
            const d = fb[i];
            const closeness = 1 - Math.min(1, Math.abs(d) / 0.3);
            const c = heat(closeness);
            const verdict =
              Math.abs(d) < 0.03 ? tr("✓ right") : d > 0 ? tr("▼ too much") : tr("▲ too little");
            return (
              <div key={axis} className="flex items-center gap-2">
                <span className="w-24 text-[#FFB800]">{axis}</span>
                <div className="relative h-2 flex-1 rounded-sm border border-[#33FF33]/30 bg-black">
                  <div
                    className="h-full"
                    style={{ width: `${pos[i] * 100}%`, background: c, boxShadow: `0 0 4px ${c}` }}
                  />
                </div>
                <span className="w-20 text-right" style={{ color: c }}>
                  {verdict}
                </span>
              </div>
            );
          })}
          <ProgressBar
            value={held / hold}
            label={tr("Broadcast window: {held} / {hold} s", {
              held: fmtNum(Math.min(held, hold), 1),
              hold: fmtNum(hold, 1),
            })}
          />
        </div>
      </div>

      <StatusLine tone={inside ? "ok" : fit >= 50 ? "info" : "bad"}>
        {inside
          ? tr("Resonance. Hold …")
          : fit >= 50
            ? tr("Warm. The corners are responding — follow the green.")
            : tr("Cold. The message fizzles out in the noise.")}
      </StatusLine>
      <HintBox show={hint}>
        {tr(
          "The dashed zone is the sweet spot. It does not drift — your marker does. Small corrections, not big ones. The bars on the right show which corner gets too much or too little: ▼ means away from that corner.",
        )}
        {damped && ` ${tr("I have damped the noise — the drift is now half as strong.")}`}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            {tr("Mouse: drag")} · <kbd>←↑↓→</kbd>/<kbd>WASD</kbd> {tr("hold")} · <kbd>⇧</kbd>{" "}
            {tr("fine")} · {tr("Dropouts: {n}", { n: fails })}
          </>
        }
        onReset={reset}
        resetDisabled={solved}
      />
    </div>
  );
}

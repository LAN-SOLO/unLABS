"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HUE_BAND_DEG,
  HUE_COLORS,
  HUE_LABELS,
  angleDiff,
  bandCenter,
  bandIndexAt,
  hueHit,
  normAngle,
  perRound,
  spectrumIndex,
} from "@/components/world/puzzles/engine/hue";
import { num, nums, str } from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  ProgressBar,
  PuzzleFooter,
  StatusLine,
  useFailFx,
  useFailHint,
  useHotkeys,
  usePuzzleFx,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";
import { SPECTRUM } from "@/lib/world/types";

const SIZE = 300;
const C = SIZE / 2;
const R_OUT = 128;
const R_IN = 84;
const PAUSE_MS = 750;
/** Typical human reaction lag the hint compensates for. */
const LEAD_S = 0.15;
/** Misses after which the needle is damped (progressive assist). */
const DAMP_FAILS = 6;
const DAMP_FACTOR = 0.75;

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r];
}

function arcPath(r1: number, r2: number, from: number, to: number): string {
  const [x1, y1] = polar(r2, from);
  const [x2, y2] = polar(r2, to);
  const [x3, y3] = polar(r1, to);
  const [x4, y4] = polar(r1, from);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r2} ${r2} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${large} 0 ${x4} ${y4} Z`;
}

type Feedback = { tone: "ok" | "bad" | "info"; text: string };

export function HuePuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const targetIdx = spectrumIndex(str(params, "target", "gelb"));
  const rounds = Math.max(1, Math.floor(num(params, "rounds", 3)));
  const tolerances = nums(params, "tolerances", [18, 11, 6]);
  const speeds = nums(params, "speeds", [110, 160, 220]);
  const targetName = SPECTRUM[targetIdx];

  const [round, setRound] = useState(0);
  const [angle, setAngle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lastStop, setLastStop] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "info",
    text: tr("Needle running. Stop it inside the marked window."),
  });
  const sfx = useSfx(sound);
  const { fail, hint, fails } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const { reduceMotion } = usePuzzleFx();
  const [stops, setStops] = useState(0);

  const tol = Math.max(1, Math.min(HUE_BAND_DEG / 2, perRound(tolerances, round, 6)));
  const damped = fails >= DAMP_FAILS;
  const speed = Math.max(20, perRound(speeds, round, 200) * (damped ? DAMP_FACTOR : 1));

  const angleRef = useRef(0);
  const pausedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (solved) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        angleRef.current = normAngle(angleRef.current + speed * dt);
        setAngle(angleRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed, solved]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const pauseThen = (fn: () => void) => {
    pausedRef.current = true;
    setPaused(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      fn();
      pausedRef.current = false;
      setPaused(false);
    }, PAUSE_MS);
  };

  const stop = () => {
    if (solved || pausedRef.current) return;
    const a = angleRef.current;
    setLastStop(a);
    setStops((n) => n + 1);
    if (hueHit(a, targetIdx, tol)) {
      const next = round + 1;
      if (next >= rounds) {
        pausedRef.current = true;
        setPaused(true);
        setFeedback({
          tone: "ok",
          text: tr("Hue locked: {hue}.", { hue: HUE_LABELS[targetName] }),
        });
        onSolve();
        return;
      }
      sfx("keypad_beep");
      setFeedback({
        tone: "ok",
        text: tr("Hit {n}/{total}. Window narrows, needle speeds up.", { n: next, total: rounds }),
      });
      pauseThen(() => setRound(next));
      return;
    }
    fail();
    failFx();
    sfx("fail_buzz");
    const d = angleDiff(a, bandCenter(targetIdx));
    const landed = HUE_LABELS[SPECTRUM[bandIndexAt(a)]];
    const deg = Math.abs(Math.round(d));
    setFeedback({
      tone: "bad",
      text:
        Math.abs(d) > 90
          ? tr("Missed — {hue}, {deg}° way off.", { hue: landed, deg })
          : d > 0
            ? tr("Missed — {hue}, {deg}° too late.", { hue: landed, deg })
            : tr("Missed — {hue}, {deg}° too early.", { hue: landed, deg }),
    });
    pauseThen(() => undefined);
  };

  const reset = () => {
    if (solved) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    pausedRef.current = false;
    setPaused(false);
    setRound(0);
    setLastStop(null);
    setFeedback({
      tone: "info",
      text: tr("Recalibrated. Stop the needle inside the marked window."),
    });
    sfx("ui_click");
  };

  useHotkeys(
    (key) => {
      if (key === " " || key === "Enter") {
        stop();
        return true;
      }
      return false;
    },
    !solved,
    { repeat: false },
  );

  const centre = bandCenter(targetIdx);
  const winFrom = centre - tol;
  const winTo = centre + tol;
  const [nx, ny] = polar(R_OUT + 6, angle);
  const [gx, gy] = polar(R_OUT + 6, angle + speed * LEAD_S);
  const bracket = (deg: number) => {
    const [a1, b1] = polar(R_IN - 6, deg);
    const [a2, b2] = polar(R_OUT + 12, deg);
    return { x1: a1, y1: b1, x2: a2, y2: b2 };
  };
  const bl = bracket(winFrom);
  const br = bracket(winTo);
  const hitNow = hueHit(angle, targetIdx, tol);
  const targetColor = HUE_COLORS[targetName];

  const bands = useMemo(
    () =>
      SPECTRUM.map((c, i) => {
        const from = i * HUE_BAND_DEG;
        const [lx, ly] = polar((R_IN + R_OUT) / 2, from + HUE_BAND_DEG / 2);
        return { c, i, from, lx, ly };
      }),
    [],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={`w-full max-w-[320px] cursor-crosshair rounded-full select-none ${failClass}`}
        role="img"
        aria-label={tr("Colour wheel, target {hue}. Click stops the needle.", {
          hue: HUE_LABELS[targetName],
        })}
        onPointerDown={(e) => {
          e.preventDefault();
          stop();
        }}
      >
        <defs>
          <filter id="hue-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={C} cy={C} r={R_OUT + 16} fill="#050805" stroke="#33FF33" strokeOpacity={0.3} />
        {bands.map(({ c, i, from, lx, ly }) => {
          const isTarget = i === targetIdx;
          return (
            <g key={c}>
              <path
                d={arcPath(R_IN, R_OUT, from + 0.6, from + HUE_BAND_DEG - 0.6)}
                fill={HUE_COLORS[c]}
                fillOpacity={isTarget ? 0.55 : 0.22}
                stroke={HUE_COLORS[c]}
                strokeOpacity={isTarget ? 1 : 0.5}
              />
              <text
                x={lx}
                y={ly + 3}
                textAnchor="middle"
                fontSize={9}
                fontFamily="monospace"
                fill={isTarget ? "#FFFFFF" : "#CFE"}
                opacity={isTarget ? 1 : 0.75}
              >
                {HUE_LABELS[c]}
              </text>
            </g>
          );
        })}
        {/* Tolerance window */}
        <path
          d={arcPath(R_IN - 6, R_OUT + 12, winFrom, winTo)}
          fill={targetColor}
          fillOpacity={hitNow ? 0.28 : 0.12}
          stroke="none"
        />
        {[bl, br].map((l, k) => (
          <line
            key={k}
            {...l}
            stroke="#FFB800"
            strokeWidth={2.5}
            filter="url(#hue-glow)"
            className="animate-pulse"
          />
        ))}
        {/* Round pips */}
        {Array.from({ length: rounds }, (_, i) => (
          <circle
            key={i}
            cx={C - (rounds - 1) * 9 + i * 18}
            cy={C + 34}
            r={5}
            fill={i < round || (solved && i === round) ? "#33FF33" : "#0D0D0D"}
            stroke="#33FF33"
            strokeOpacity={0.6}
          />
        ))}
        <text
          x={C}
          y={C - 18}
          textAnchor="middle"
          fontSize={11}
          fontFamily="monospace"
          fill="#FFB800"
        >
          {tr("TARGET")}
        </text>
        <text
          x={C}
          y={C + 6}
          textAnchor="middle"
          fontSize={18}
          fontFamily="monospace"
          fill={targetColor}
          style={{ filter: `drop-shadow(0 0 5px ${targetColor})` }}
        >
          {HUE_LABELS[targetName].toUpperCase()}
        </text>
        {/* Last stop marker */}
        {lastStop !== null && paused && !solved && (
          <line
            {...bracket(lastStop)}
            stroke={hueHit(lastStop, targetIdx, tol) ? "#33FF33" : "#FF4040"}
            strokeWidth={2}
            strokeDasharray="3 3"
          />
        )}
        {/* Hint: lead ghost */}
        {hint && !solved && (
          <line
            x1={C}
            y1={C}
            x2={gx}
            y2={gy}
            stroke="#FFB800"
            strokeOpacity={0.35}
            strokeWidth={2}
          />
        )}
        {/* Needle afterimage (phosphor persistence) */}
        {!paused &&
          !solved &&
          !reduceMotion &&
          [3, 2, 1].map((k) => {
            const [tx, ty] = polar(R_OUT + 6, angle - k * speed * 0.018);
            return (
              <line
                key={k}
                x1={C}
                y1={C}
                x2={tx}
                y2={ty}
                stroke="#00FFFF"
                strokeOpacity={0.12 * (4 - k)}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
        {/* Stop ripple */}
        {lastStop !== null && paused && (
          <circle
            key={stops}
            cx={polar(R_OUT + 6, lastStop)[0]}
            cy={polar(R_OUT + 6, lastStop)[1]}
            r={10}
            fill="none"
            stroke={hueHit(lastStop, targetIdx, tol) ? "#33FF33" : "#FF4040"}
            strokeWidth={2}
            className="pz-ripple"
          />
        )}
        {/* Needle */}
        <line
          x1={C}
          y1={C}
          x2={nx}
          y2={ny}
          stroke={paused ? (hueHit(angle, targetIdx, tol) ? "#33FF33" : "#FF4040") : "#00FFFF"}
          strokeWidth={3}
          strokeLinecap="round"
          filter="url(#hue-glow)"
        />
        <circle cx={C} cy={C} r={6} fill="#1A1A1A" stroke="#00FFFF" strokeWidth={2} />
      </svg>

      <div className="flex w-full max-w-[420px] flex-col gap-2">
        <ProgressBar
          value={(solved ? rounds : round) / rounds}
          label={tr("Hits {n} / {total} · tolerance ±{tol}° · {speed}°/s", {
            n: solved ? rounds : round,
            total: rounds,
            tol: tol.toFixed(0),
            speed: Math.round(speed),
          })}
        />
        <StatusLine tone={feedback.tone}>{feedback.text}</StatusLine>
        <div className="flex justify-center">
          <CrtButton
            tone="cyan"
            onClick={stop}
            disabled={solved || paused}
            data-pz-autofocus
            className="min-w-32 py-2 text-sm"
            aria-label={tr("Stop needle (target {hue})", { hue: HUE_LABELS[targetName] })}
          >
            ■ {tr("Stop")}
          </CrtButton>
        </div>
        <HintBox show={hint && !solved}>
          {tr(
            "Your finger lags the needle by about 0.15 s. Human. Press as soon as the faint lead pointer reaches the window — then the needle lands dead centre. A miss only costs one revolution, not a round.",
          )}
          {damped && ` ${tr("I have also slowed the needle by a quarter. Between us.")}`}
        </HintBox>
        <PuzzleFooter
          help={
            <>
              <kbd>{tr("Space")}</kbd>/<kbd>Enter</kbd>{" "}
              {tr(
                "or a click on the wheel stops the needle · the target band is bright, the window framed in amber",
              )}
            </>
          }
          onReset={reset}
          resetDisabled={solved}
          resetLabel={tr("Start over")}
        />
      </div>
    </div>
  );
}

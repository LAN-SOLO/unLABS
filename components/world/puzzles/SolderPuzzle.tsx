"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_H,
  BOARD_W,
  PREHEAT,
  generateBoard,
  heatStep,
  isBurnt,
  releaseResult,
} from "@/components/world/puzzles/engine/solder";
import { num } from "@/components/world/puzzles/logic";
import {
  HintBox,
  ProgressBar,
  PuzzleFooter,
  StatusLine,
  isTypingTarget,
  useFailFx,
  useFailHint,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

/** Thermometer scale shown in the gauge (°C). */
const SCALE_LO = 150;
const SCALE_HI = 420;
const PAD_R = 13;

type Feedback = { tone: "ok" | "bad" | "info"; text: string };

function pct(t: number): number {
  return ((t - SCALE_LO) / (SCALE_HI - SCALE_LO)) * 100;
}

export function SolderPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 38);
  const padCount = num(params, "pads", 6);
  const width = num(params, "width", 14);
  const board = useMemo(() => generateBoard(seed, padCount, width), [seed, padCount, width]);
  const pads = board.pads;

  const [current, setCurrent] = useState(0);
  const [temp, setTemp] = useState(PREHEAT);
  const [heating, setHeating] = useState(false);
  const [burnFlash, setBurnFlash] = useState<number | null>(null);
  const [wrongPad, setWrongPad] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "info",
    text: tr("Hold pad 1 to heat the joint. Release inside the window."),
  });
  const sfx = useSfx(sound);
  const { fail: failHint, fails, hint } = useFailHint(3, 60, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const fail = () => {
    failHint();
    failFx();
  };

  const tempRef = useRef(PREHEAT);
  const holdingRef = useRef(false);
  const currentRef = useRef(0);
  const solvedRef = useRef(solved);
  const timersRef = useRef<number[]>([]);
  const failRef = useRef(fail);
  useEffect(() => {
    failRef.current = fail;
    solvedRef.current = solved;
  });

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  // Temperature simulation.
  useEffect(() => {
    if (solved) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const pad = pads[currentRef.current];
      tempRef.current = heatStep(tempRef.current, holdingRef.current, dt);
      if (pad && holdingRef.current && isBurnt(tempRef.current, pad)) {
        holdingRef.current = false;
        tempRef.current = PREHEAT;
        setHeating(false);
        setBurnFlash(currentRef.current);
        timersRef.current.push(window.setTimeout(() => setBurnFlash(null), 700));
        setFeedback({
          tone: "bad",
          text: tr("Pad {n} burnt. Flux charred — joint cooled down, start again.", {
            n: currentRef.current + 1,
          }),
        });
        failRef.current();
        sfx("fail_buzz");
      }
      setTemp(tempRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pads, solved, sfx]);

  const startHeat = (idx: number) => {
    if (solved || holdingRef.current) return;
    if (idx < currentRef.current) return;
    if (idx !== currentRef.current) {
      setWrongPad(idx);
      later(() => setWrongPad(null), 500);
      setFeedback({
        tone: "bad",
        text: tr("Wrong order — pad {n} comes later. Next up: pad {next}.", {
          n: idx + 1,
          next: currentRef.current + 1,
        }),
      });
      fail();
      sfx("fail_buzz");
      return;
    }
    holdingRef.current = true;
    setHeating(true);
  };

  const release = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHeating(false);
    if (solvedRef.current) return;
    const idx = currentRef.current;
    const pad = pads[idx];
    if (!pad) return;
    const res = releaseResult(tempRef.current, pad);
    if (res === "kalt") {
      sfx("ui_click");
      setFeedback({
        tone: "info",
        text: tr("Cold joint at {t} °C — hasn't flowed yet. Keep heating.", {
          t: Math.round(tempRef.current),
        }),
      });
      return;
    }
    if (res === "verbrannt") {
      tempRef.current = PREHEAT;
      setBurnFlash(idx);
      later(() => setBurnFlash(null), 700);
      setFeedback({
        tone: "bad",
        text: tr("Too hot ({t} °C exceeded). Pad {n} cooled down — again.", {
          t: Math.round(pad.hi),
          n: idx + 1,
        }),
      });
      fail();
      sfx("fail_buzz");
      return;
    }
    const next = idx + 1;
    currentRef.current = next;
    setCurrent(next);
    tempRef.current = PREHEAT;
    if (next >= pads.length) {
      setFeedback({ tone: "ok", text: tr("All joints are shining. Board calibrated.") });
      onSolve();
      return;
    }
    sfx("keypad_beep");
    setFeedback({
      tone: "ok",
      text: tr("Pad {n} is set — clean meniscus. On to pad {next}.", {
        n: idx + 1,
        next: next + 1,
      }),
    });
  };

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    holdingRef.current = false;
    currentRef.current = 0;
    tempRef.current = PREHEAT;
    setHeating(false);
    setCurrent(0);
    setTemp(PREHEAT);
    setFeedback({ tone: "info", text: tr("Board desoldered. From the top: pad 1.") });
  };

  const startRef = useRef(startHeat);
  const releaseRef = useRef(release);
  useEffect(() => {
    startRef.current = startHeat;
    releaseRef.current = release;
  });

  // Space / Enter held = iron on the active pad. Buttons keep their own
  // Enter/Space (reset), so the board itself takes initial focus.
  useEffect(() => {
    const isHeatKey = (e: KeyboardEvent) => e.key === " " || e.key === "Enter";
    const onButton = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && e.target.closest("button") !== null;
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || onButton(e) || !isHeatKey(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (!e.repeat) startRef.current(currentRef.current);
    };
    const up = (e: KeyboardEvent) => {
      if (isHeatKey(e)) releaseRef.current();
    };
    const blur = () => releaseRef.current();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerup", blur);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerup", blur);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const active = pads[current];
  const inWindow = active ? temp >= active.lo && temp <= active.hi : false;
  const idealNow = active
    ? Math.abs(temp - (active.lo + active.hi) / 2) <= (active.hi - active.lo) / 4
    : false;
  const heatFrac = Math.max(0, Math.min(1, (temp - PREHEAT) / 200));

  // Traces: chain pads in order plus a bus to the edge connector.
  const traces = pads.map((p, i) => {
    const q = pads[i + 1];
    if (!q) return null;
    return `M ${p.x} ${p.y} L ${q.x} ${p.y} L ${q.x} ${q.y}`;
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
        className={`w-full max-w-[520px] touch-none rounded-lg select-none ${failClass}`}
        role="application"
        tabIndex={0}
        data-pz-autofocus
        aria-roledescription={tr("solder board")}
        aria-label={tr(
          "Circuit board, {count} solder pads. Active: pad {n}. Hold Space or Enter to heat.",
          { count: pads.length, n: Math.min(current + 1, pads.length) },
        )}
      >
        <defs>
          <radialGradient id="solder-blob" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#C8CCD0" />
            <stop offset="100%" stopColor="#6B7075" />
          </radialGradient>
          <filter id="solder-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <pattern id="solder-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0E3A1E" strokeWidth={0.6} />
          </pattern>
        </defs>
        <rect x={2} y={2} width={BOARD_W - 4} height={BOARD_H - 4} rx={8} fill="#0B2A16" />
        <rect
          x={2}
          y={2}
          width={BOARD_W - 4}
          height={BOARD_H - 4}
          rx={8}
          fill="url(#solder-grid)"
        />
        <rect
          x={2}
          y={2}
          width={BOARD_W - 4}
          height={BOARD_H - 4}
          rx={8}
          fill="none"
          stroke="#33FF33"
          strokeOpacity={0.4}
        />
        {[14, BOARD_W - 14].map((x) =>
          [14, BOARD_H - 14].map((y) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={4} fill="#050805" stroke="#8A7A3A" />
          )),
        )}
        <text
          x={12}
          y={BOARD_H - 22}
          fontSize={8}
          fontFamily="monospace"
          fill="#CFE8CF"
          opacity={0.5}
        >
          _unLAB KAL-{String(seed).padStart(3, "0")} REV.B · 2008 D.F.
        </text>
        {traces.map((d, i) =>
          d ? (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={i + 1 < current ? "#C9A227" : "#8A6F1C"}
              strokeOpacity={i + 1 < current ? 0.95 : 0.5}
              strokeWidth={4}
              strokeLinejoin="round"
            />
          ) : null,
        )}
        {pads.map((p, i) => {
          const done = i < current;
          const isActive = i === current && !solved;
          const burning = burnFlash === i;
          const wrong = wrongPad === i;
          return (
            <g
              key={i}
              role="button"
              tabIndex={-1}
              aria-label={
                done
                  ? tr("Pad {n} (soldered)", { n: i + 1 })
                  : isActive
                    ? tr("Pad {n} (active)", { n: i + 1 })
                    : tr("Pad {n}", { n: i + 1 })
              }
              className={done || solved ? "" : "group cursor-pointer"}
              onPointerDown={(e) => {
                e.preventDefault();
                startHeat(i);
              }}
              onPointerUp={release}
              onPointerLeave={release}
            >
              {isActive && heating && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={PAD_R + 6 + heatFrac * 10}
                  fill={inWindow ? "#FFB800" : "#FF5020"}
                  opacity={0.25 + heatFrac * 0.35}
                  filter="url(#solder-glow)"
                />
              )}
              {isActive && heating && (
                <g opacity={0.5}>
                  {[0, 1, 2].map((k) => (
                    <circle
                      key={k}
                      cx={p.x - 6 + k * 6}
                      cy={p.y - PAD_R - 6 - k * 5}
                      r={3 + k}
                      fill="#DDD"
                      className="animate-ping"
                      style={{ animationDelay: `${k * 180}ms`, animationDuration: "1.2s" }}
                    />
                  ))}
                </g>
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={PAD_R}
                fill={burning ? "#3A0A0A" : done ? "url(#solder-blob)" : "#B87333"}
                stroke={wrong ? "#FF4040" : isActive ? "#00FFFF" : done ? "#E8FFE8" : "#6A4520"}
                strokeWidth={isActive || wrong ? 2.5 : 1.2}
                className={isActive && !heating ? "animate-pulse" : done ? "pz-pop" : ""}
                style={done ? { filter: "drop-shadow(0 0 3px #E8FFE8)" } : undefined}
              />
              {!done && <circle cx={p.x} cy={p.y} r={3} fill="#050805" />}
              {!done && !isActive && !solved && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={PAD_R + 3}
                  fill="none"
                  stroke="#E8FFE8"
                  strokeOpacity={0}
                  strokeDasharray="3 3"
                  className="transition-[stroke-opacity] group-hover:[stroke-opacity:0.5]"
                />
              )}
              {done && (
                <path
                  d={`M ${p.x - 5} ${p.y} l 3.5 3.5 l 6.5 -7`}
                  fill="none"
                  stroke="#0B2A16"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <text
                x={p.x + PAD_R + 3}
                y={p.y - PAD_R + 2}
                fontSize={11}
                fontFamily="monospace"
                fill={isActive ? "#00FFFF" : "#E8FFE8"}
                opacity={done ? 0.5 : 0.9}
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex w-full max-w-[520px] flex-col gap-2">
        {active && !solved ? (
          <div className="w-full">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-[#FFB800]">
                {tr("Pad {n} · window {lo}–{hi} °C", {
                  n: current + 1,
                  lo: active.lo,
                  hi: active.hi,
                })}
              </span>
              <span
                className={`tabular-nums ${
                  inWindow ? "text-[#33FF33]" : temp > active.hi ? "text-red-400" : "text-[#00FFFF]"
                }`}
                aria-live="off"
              >
                {inWindow ? "▣ " : temp > active.hi ? "▲ " : "▽ "}
                {temp.toFixed(0)} °C
              </span>
            </div>
            <div
              className="relative h-5 w-full rounded-sm border border-[#33FF33]/30 bg-black"
              role="meter"
              aria-label={tr("Solder temperature")}
              aria-valuemin={SCALE_LO}
              aria-valuemax={SCALE_HI}
              aria-valuenow={Math.round(temp)}
              aria-valuetext={tr("{t} °C, window {lo} to {hi}", {
                t: Math.round(temp),
                lo: active.lo,
                hi: active.hi,
              })}
            >
              <div
                className="absolute inset-y-0 border-x border-[#33FF33]/70 bg-[repeating-linear-gradient(135deg,rgba(51,255,51,0.28)_0,rgba(51,255,51,0.28)_3px,rgba(51,255,51,0.12)_3px,rgba(51,255,51,0.12)_6px)]"
                style={{ left: `${pct(active.lo)}%`, width: `${pct(active.hi) - pct(active.lo)}%` }}
              />
              <div
                className="absolute inset-y-0 bg-red-500/15"
                style={{ left: `${pct(active.hi + 25)}%`, right: 0 }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00FFFF]/30 via-[#FFB800]/40 to-[#FF4040]/60"
                style={{ width: `${Math.max(0, Math.min(100, pct(temp)))}%` }}
              />
              <div
                className="absolute inset-y-0 w-1 -translate-x-1/2 bg-[#E8FFE8] shadow-[0_0_6px_#E8FFE8]"
                style={{ left: `${Math.max(0, Math.min(100, pct(temp)))}%` }}
              />
            </div>
            {hint && (
              <div
                className={`mt-1 text-center text-xs tracking-widest ${
                  heating && idealNow
                    ? "text-[#33FF33] [text-shadow:0_0_8px_#33FF33]"
                    : "text-[#33FF33]/20"
                }`}
              >
                {tr("▼ RELEASE NOW ▼")}
              </div>
            )}
          </div>
        ) : null}
        <ProgressBar
          value={current / pads.length}
          label={tr("Joints: {done} / {total}", {
            done: Math.min(current, pads.length),
            total: pads.length,
          })}
        />
        <StatusLine tone={feedback.tone}>{feedback.text}</StatusLine>
        <HintBox show={hint && !solved}>
          {tr(
            "The heat climbs faster and faster. Tap briefly instead of holding long: between taps the joint barely cools, and “cold” costs nothing. When “Release now” lights up, you are right in the window.",
          )}
          {fails >= 6 &&
            ` ${tr("Pad {n}: window {lo}–{hi} °C — release as soon as the readout shows ▣.", {
              n: current + 1,
              lo: active?.lo ?? 0,
              hi: active?.hi ?? 0,
            })}`}
        </HintBox>
        <PuzzleFooter
          help={
            <>
              {tr("Hold a pad or hold")} <kbd>{tr("Space")}</kbd>/<kbd>Enter</kbd> ·{" "}
              {tr("release in the green window (▣)")}
            </>
          }
          onReset={reset}
          resetDisabled={solved}
        />
      </div>
    </div>
  );
}

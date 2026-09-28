"use client";

import { fmtNum } from "@/components/world/format";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  momentum,
  TREND_CONTINUATION,
  TREND_HZ,
  trendRound,
  type TrendAnswer,
} from "@/components/world/puzzles/engine/trend";
import { num, str } from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  StatusLine,
  useFailFx,
  useFailHint,
  useHotkeys,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const W = 520;
const H = 180;
const REVEAL_S = TREND_CONTINUATION / TREND_HZ;
const PAUSE_S = 0.9;

type Phase = "run" | "prompt" | "reveal";

interface Verdict {
  guess: TrendAnswer | null;
  correct: boolean;
}

function label(a: TrendAnswer): string {
  return a === "cw" ? "CW ↻" : "CCW ↺";
}

export function TrendPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 512);
  const target = Math.max(1, Math.round(num(params, "streak", 5)));
  const baseWindowS = Math.max(1, num(params, "window", 3));
  const noise = num(params, "noise", 0.3);
  // Idle line for the host device (default: the adapters' consensus stream).
  const idleText = str(params, "idle", tr("Consensus stream running … read the slope."));

  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("run");
  const [shown, setShown] = useState(0);
  const [cont, setCont] = useState(0);
  const [remaining, setRemaining] = useState(baseWindowS);
  const [streak, setStreak] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const sfx = useSfx(sound);
  const { fail, fails, hint } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();
  /** Second hint stage: after six misses the decision window grows by half. */
  const windowS = fails >= 6 ? baseWindowS * 1.5 : baseWindowS;

  const data = useMemo(() => trendRound(seed, round, noise), [seed, round, noise]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Scale over the whole round so the chart doesn't jump during the reveal.
  const range = useMemo(() => {
    const all = [...data.history, ...data.continuation];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = Math.max(0.2, (hi - lo) * 0.15);
    return { lo: lo - pad, hi: hi + pad };
  }, [data]);

  // Phase: run — history scrolls in.
  useEffect(() => {
    if (solved || phase !== "run") return;
    let raf = 0;
    let t0 = -1;
    const total = data.history.length;
    const tick = (now: number) => {
      if (t0 < 0) t0 = now;
      const n = Math.min(total, Math.floor(((now - t0) / 1000) * TREND_HZ) + 1);
      setShown(n);
      if (n >= total) {
        setRemaining(windowS);
        setPhase("prompt");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, data, solved, windowS]);

  const decide = (guess: TrendAnswer | null) => {
    if (solved || phase !== "prompt") return;
    const correct = guess === data.answer;
    setVerdict({ guess, correct });
    setCont(0);
    setPhase("reveal");
    if (correct) {
      const next = streak + 1;
      setStreak(next);
      if (next >= target) onSolve();
      else sfx("keypad_beep");
    } else {
      setStreak(0);
      fail();
      failFx();
      sfx("fail_buzz");
    }
  };

  const decideRef = useRef(decide);
  useEffect(() => {
    decideRef.current = decide;
  });

  // Phase: prompt — decision window countdown.
  useEffect(() => {
    if (solved || phase !== "prompt") return;
    let raf = 0;
    let t0 = -1;
    const tick = (now: number) => {
      if (t0 < 0) t0 = now;
      const left = windowS - (now - t0) / 1000;
      if (left <= 0) {
        setRemaining(0);
        decideRef.current(null);
        return;
      }
      setRemaining(left);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, solved, windowS]);

  // Phase: reveal — continuation plays out, then the next round starts.
  useEffect(() => {
    if (phase !== "reveal") return;
    let raf = 0;
    let t0 = -1;
    const tick = (now: number) => {
      if (t0 < 0) t0 = now;
      const el = (now - t0) / 1000;
      setCont(Math.min(TREND_CONTINUATION, Math.floor(el * TREND_HZ) + 1));
      if (el >= REVEAL_S + PAUSE_S) {
        if (solved) return;
        setRound((r) => r + 1);
        setShown(0);
        setCont(0);
        setVerdict(null);
        setPhase("run");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, solved]);

  useHotkeys((key) => {
    const k = key.toLowerCase();
    if (
      k === "c" ||
      k === "d" ||
      k === "w" ||
      k === "1" ||
      key === "ArrowRight" ||
      key === "ArrowUp"
    )
      decideRef.current("cw");
    else if (
      k === "x" ||
      k === "a" ||
      k === "s" ||
      k === "2" ||
      key === "ArrowLeft" ||
      key === "ArrowDown"
    )
      decideRef.current("ccw");
    else return false;
    return true;
  });

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    setRound((r) => r + 1);
    setStreak(0);
    setShown(0);
    setCont(0);
    setVerdict(null);
    setPhase("run");
  };

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#050805";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(51,255,51,0.1)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const x = (i / 10) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const total = data.history.length + TREND_CONTINUATION;
    const splitX = (data.history.length / total) * W;
    const xAt = (i: number) => (i / (total - 1)) * W;
    const yAt = (v: number) => H - ((v - range.lo) / (range.hi - range.lo)) * H;

    // Decision line.
    if (phase !== "run") {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(255,184,0,0.6)";
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, H);
      ctx.stroke();
      ctx.restore();
    }

    const drawLine = (from: number, values: readonly number[], color: string) => {
      if (values.length === 0) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = xAt(from + i);
        const y = yAt(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    const hist = data.history.slice(0, shown);
    drawLine(0, hist, "#33FF33");
    if (phase === "reveal" && cont > 0) {
      const color = verdict?.correct ? "#00FFFF" : "#FF4040";
      drawLine(
        data.history.length - 1,
        [data.history[data.history.length - 1], ...data.continuation.slice(0, cont)],
        color,
      );
    }
    // Cursor dot at the head.
    if (hist.length > 0) {
      const v = hist[hist.length - 1];
      ctx.fillStyle = "#00FF66";
      ctx.shadowColor = "#00FF66";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(xAt(hist.length - 1), yAt(v), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [data, shown, cont, phase, verdict, range]);

  const mom = momentum(data.history.slice(0, Math.max(2, shown)));
  const locked = solved || phase !== "prompt";

  let status: { tone: "ok" | "bad" | "info"; text: string };
  if (phase === "reveal" && verdict) {
    status = verdict.correct
      ? { tone: "ok", text: tr("✓ Correct: {dir} — the trend holds.", { dir: label(data.answer) }) }
      : {
          tone: "bad",
          text:
            verdict.guess === null
              ? tr("✗ Too late. It was {dir}. Streak reset.", { dir: label(data.answer) })
              : tr("✗ Wrong. It was {dir}. Streak reset.", { dir: label(data.answer) }),
        };
  } else if (phase === "prompt") {
    status = { tone: "info", text: tr("PREDICT ROTATION: {s} s", { s: fmtNum(remaining, 1) }) };
  } else {
    status = { tone: "info", text: idleText };
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#FFB800]">{tr("Round {n}", { n: round + 1 })}</span>
        <span
          className="flex items-center gap-1"
          aria-label={tr("Streak {n} of {total}", { n: streak, total: target })}
        >
          <span className="mr-1 text-[#FFB800]">{tr("Streak")}</span>
          {Array.from({ length: target }, (_, i) => (
            <span
              key={i}
              className={`inline-block h-3 w-3 rounded-full border transition-colors ${
                i < streak
                  ? `border-[#00FFFF] bg-[#00FFFF] shadow-[0_0_6px_#00FFFF] ${i === streak - 1 ? "pz-pop" : ""}`
                  : "border-[#33FF33]/40 bg-black"
              }`}
            />
          ))}
        </span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className={`w-full rounded-sm border ${
            phase === "reveal" && verdict && !verdict.correct
              ? "border-red-500/70"
              : "border-[#33FF33]/40"
          } ${failClass}`}
          aria-label={tr("Trend chart")}
          // The answer buttons are disabled while the series runs, so the
          // chart takes the opening focus — never the »New streak« reset.
          tabIndex={0}
          data-pz-autofocus
        />
        {phase === "prompt" && !solved && (
          <div className="pointer-events-none absolute top-2 right-2 rounded-sm border border-[#FFB800] bg-black/80 px-2 py-1 text-xs tracking-widest text-[#FFB800] [text-shadow:0_0_6px_#FFB800]">
            {tr("PREDICTION {s} s", { s: fmtNum(remaining, 1) })}
          </div>
        )}
        {phase === "prompt" && (
          <div
            className="absolute bottom-0 left-0 h-1 bg-[#FFB800]"
            style={{ width: `${(remaining / windowS) * 100}%` }}
          />
        )}
      </div>
      {hint && (
        <div>
          <div className="mb-1 flex justify-between text-[10px] tracking-widest text-[#FFB800]">
            <span>MOMENTUM</span>
            <span
              className={mom >= 0 ? "text-[#33FF33]" : "text-red-400"}
              aria-label={mom >= 0 ? tr("Momentum rising") : tr("Momentum falling")}
            >
              {mom >= 0 ? tr("▲ rising · CW") : tr("▼ falling · CCW")}
            </span>
          </div>
          <div className="relative h-3 w-full rounded-sm border border-[#33FF33]/30 bg-black">
            <div className="absolute inset-y-0 left-1/2 w-px bg-[#33FF33]/40" />
            <div
              className={`absolute inset-y-0 ${mom >= 0 ? "bg-[#33FF33]/70" : "bg-red-500/70"}`}
              aria-hidden
              style={
                mom >= 0
                  ? { left: "50%", width: `${mom * 50}%` }
                  : { left: `${50 + mom * 50}%`, width: `${-mom * 50}%` }
              }
            />
          </div>
        </div>
      )}
      <StatusLine tone={status.tone}>{status.text}</StatusLine>
      <div className="flex items-center justify-center gap-3">
        <CrtButton
          tone="cyan"
          className={`min-w-28 py-2 text-sm ${!locked ? "shadow-[0_0_10px_rgba(0,255,255,0.4)]" : ""}`}
          onClick={() => decide("ccw")}
          disabled={locked}
          aria-label={tr("Counter-clockwise: price falls")}
        >
          <span aria-hidden>▼ </span>
          {tr("CCW ↺ falls")}
        </CrtButton>
        <CrtButton
          tone="green"
          className={`min-w-28 py-2 text-sm ${!locked ? "shadow-[0_0_10px_rgba(51,255,51,0.4)]" : ""}`}
          onClick={() => decide("cw")}
          disabled={locked}
          aria-label={tr("Clockwise: price rises")}
        >
          <span aria-hidden>▲ </span>
          {tr("CW ↻ rises")}
        </CrtButton>
      </div>
      <HintBox show={hint}>
        {tr(
          "Watch only the last short second before the line. A kink there beats any long trend — the momentum bar measures exactly that slope. Green right: CW. Red left: CCW. That is all there is to it.",
        )}
        {fails >= 6 &&
          ` ${tr("I have extended the prediction window to {s} s. Breathe.", { s: fmtNum(windowS, 1) })}`}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>→</kbd>/<kbd>↑</kbd>/<kbd>C</kbd> = {tr("CW (rises)")} · <kbd>←</kbd>/<kbd>↓</kbd>/
            <kbd>X</kbd> = {tr("CCW (falls)")} · {tr("{n} correct in a row", { n: target })} ·{" "}
            {tr("no way to fail")}
          </>
        }
        onReset={reset}
        resetDisabled={solved}
        resetLabel={tr("New streak")}
      />
    </div>
  );
}

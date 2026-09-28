"use client";

import { useEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import {
  LISSAJOUS_RATIOS,
  lissajousMatches,
  lissajousPoint,
  lissajousStartPhase,
  normPhase,
  num,
  parseRatio,
  str,
} from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  useFailHint,
  useHotkeys,
  useRisingEdge,
  usePuzzleFx,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";

const SIZE = 280;
const HALF = SIZE / 2;
const AMP = HALF - 16;
/** Seconds the beam needs for one full figure. */
const BEAM_PERIOD_S = 1.8;
/** Share of phosphor brightness lost per 60 Hz frame. */
const DECAY = 0.07;

function toPx(x: number, y: number): [number, number] {
  return [HALF + x * AMP, HALF - y * AMP];
}

function drawFigure(
  ctx: CanvasRenderingContext2D,
  ratio: string,
  phase: number,
  color: string,
  width: number,
  glow: number,
) {
  const [a, b] = parseRatio(ratio);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  const steps = 720;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const [px, py] = toPx(...lissajousPoint(a, b, phase, t));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, targetRatio: string, targetPhase: number) {
  ctx.fillStyle = "#050805";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(51,255,51,0.12)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const p = (i / 8) * SIZE;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, SIZE);
    ctx.moveTo(0, p);
    ctx.lineTo(SIZE, p);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.4;
  drawFigure(ctx, targetRatio, targetPhase, "#00FFFF", 5, 0);
  ctx.globalAlpha = 1;
}

export function LissajousPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const targetRatio = str(params, "ratio", "3:4");
  const targetPhase = normPhase(num(params, "phase", 90));
  const sfx = useSfx(sound);
  const { reduceMotion } = usePuzzleFx();
  const startPhase = lissajousStartPhase(targetRatio, targetPhase);
  const [ratio, setRatio] = useState<string>("1:1");
  const [phase, setPhase] = useState(startPhase);
  const [changes, setChanges] = useState(0);
  const { hint: timeHint } = useFailHint(99, 40, sfx);
  const hint = (timeHint || changes >= 24) && !solved;
  useRisingEdge(changes >= 24 && !timeHint, () => sfx("hint_pop"));
  const ratioOk = ratio === targetRatio;

  const backRef = useRef<HTMLCanvasElement | null>(null);
  const beamRef = useRef<HTMLCanvasElement | null>(null);
  const figRef = useRef({ ratio, phase, solved });
  useEffect(() => {
    figRef.current = { ratio, phase, solved };
  }, [ratio, phase, solved]);

  // Static layer: grid + cyan ghost.
  useEffect(() => {
    const ctx = backRef.current?.getContext("2d");
    if (!ctx) return;
    drawBackdrop(ctx, targetRatio, targetPhase);
  }, [targetRatio, targetPhase]);

  // Beam layer: a phosphor dot tracing the figure, leaving a decaying trail.
  useEffect(() => {
    const canvas = beamRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (reduceMotion || typeof requestAnimationFrame !== "function") {
      ctx.clearRect(0, 0, SIZE, SIZE);
      drawFigure(ctx, ratio, phase, "#33FF33", 1.6, 6);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const f = figRef.current;
      const [a, b] = parseRatio(f.ratio);
      // Fade what is already there (phosphor persistence).
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${1 - Math.pow(1 - DECAY, dt * 60)})`;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.restore();
      const t0 = t;
      t += (dt / BEAM_PERIOD_S) * Math.PI * 2;
      const color = f.solved ? "#E8FFE8" : "#33FF33";
      ctx.save();
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const tt = t0 + ((t - t0) * i) / steps;
        const [px, py] = toPx(...lissajousPoint(a, b, f.phase, tt));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      const [hx, hy] = toPx(...lissajousPoint(a, b, f.phase, t));
      ctx.fillStyle = "#E8FFE8";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(hx, hy, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, ratio, phase]);

  const update = (nextRatio: string, nextPhase: number) => {
    if (solved) return;
    const p = normPhase(nextPhase);
    setRatio(nextRatio);
    setPhase(p);
    setChanges((c) => c + 1);
    if (lissajousMatches(nextRatio, p, targetRatio, targetPhase)) {
      onSolve();
      return;
    }
    sfx(nextRatio === targetRatio && ratio !== targetRatio ? "keypad_beep" : "ui_click");
  };

  const [ta, tb] = parseRatio(targetRatio);

  const reset = () => {
    if (solved) return;
    setRatio("1:1");
    setPhase(startPhase);
    sfx("ui_click");
  };

  // 1–5 pick a ratio, A/D (or Q/E) turn the phase, R resets.
  useHotkeys((key) => {
    if (solved) return false;
    const i = Number(key) - 1;
    if (/^[1-9]$/.test(key) && i < LISSAJOUS_RATIOS.length) {
      update(LISSAJOUS_RATIOS[i]!, phase);
      return true;
    }
    if (key === "a" || key === "A" || key === "q" || key === "Q") update(ratio, phase - 15);
    else if (key === "d" || key === "D" || key === "e" || key === "E") update(ratio, phase + 15);
    else if (key === "r" || key === "R") reset();
    else return false;
    return true;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative w-full max-w-[280px] shrink-0">
        <canvas
          ref={backRef}
          width={SIZE}
          height={SIZE}
          className="block w-full rounded-sm border border-[#33FF33]/40"
          aria-hidden
        />
        <canvas
          ref={beamRef}
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 w-full rounded-sm"
          aria-label={tr("Oscilloscope: current figure {ratio}, phase {phase}°", { ratio, phase })}
        />
        <span
          className={`absolute top-1 right-2 text-[10px] tracking-widest ${ratioOk ? "text-[#33FF33] [text-shadow:0_0_6px_#33FF33]" : "text-[#33FF33]/40"}`}
        >
          {ratioOk ? "FREQ ✓" : "FREQ ✗"}
        </span>
      </div>
      <div className="flex w-full flex-col gap-4">
        <div>
          <div className="mb-2 text-xs text-[#FFB800]">{tr("Frequency ratio X:Y")}</div>
          <div className="flex flex-wrap gap-2">
            {LISSAJOUS_RATIOS.map((r, i) => (
              <CrtButton
                key={r}
                tone={r === ratio ? "cyan" : "green"}
                aria-pressed={r === ratio}
                aria-label={r}
                data-pz-autofocus={i === 0 ? "" : undefined}
                onClick={() => update(r, phase)}
                disabled={solved}
                className={r === ratio ? "bg-[#00FFFF]/10" : ""}
              >
                <span aria-hidden className="mr-1 text-[9px] opacity-60">
                  {i + 1}
                </span>
                <span aria-hidden className="mr-0.5 inline-block w-2">
                  {r === ratio ? "▸" : ""}
                </span>
                {r}
              </CrtButton>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs text-[#FFB800]">
            Phase: <span className="tabular-nums">{phase}°</span>
          </div>
          <div className="flex items-center gap-2">
            <CrtButton
              onClick={() => update(ratio, phase - 15)}
              disabled={solved}
              aria-label="Phase −15°"
            >
              −15°
            </CrtButton>
            <input
              type="range"
              min={0}
              max={345}
              step={15}
              value={phase}
              disabled={solved}
              onChange={(e) => update(ratio, Number(e.target.value))}
              className="w-full cursor-ew-resize accent-[#33FF33]"
              aria-label="Phase"
            />
            <CrtButton
              onClick={() => update(ratio, phase + 15)}
              disabled={solved}
              aria-label="Phase +15°"
            >
              +15°
            </CrtButton>
          </div>
        </div>
        <p className="text-xs text-[#33FF33]/70">
          {tr(
            "Thin bright trace (green): your figure. Wide pale band (cyan): ghost image. Cover it exactly.",
          )}
        </p>
        <HintBox show={hint}>
          {ratioOk
            ? tr(
                "The ratio is right — the loop count fits. Now only the phase: turn it in 15° steps until the figure stops squinting.",
              )
            : tr(
                "Count where the ghost image touches the edges: {a}× on the left edge, {b}× on the top. Side to top — that is X:Y.",
                { a: ta, b: tb },
              )}
        </HintBox>
        <PuzzleFooter
          help={
            <>
              <kbd>1</kbd>–<kbd>{LISSAJOUS_RATIOS.length}</kbd> {tr("ratio")} · <kbd>A</kbd>/
              <kbd>D</kbd> {tr("phase ∓15°")} · <kbd>R</kbd> {tr("back")}
            </>
          }
          onReset={reset}
          resetDisabled={solved}
        />
      </div>
    </div>
  );
}

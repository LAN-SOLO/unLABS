"use client";

/**
 * LissajousCalibration
 * ====================
 *
 * Minigame for EP1 "Bring Lab Into Focus". The player tunes two frequency
 * sliders until the Lissajous figure ratio stabilizes near the target
 * (2:3). When the lock latches, we call `onLock` — the QuestOverlay wraps
 * that in a server action that sets the `lissajous_locked` flag and then
 * calls `advance()` so the next step (reveal) fires.
 *
 * Rendering:
 *   - requestAnimationFrame loop owned by this component
 *   - canvas 280×200, phosphor-green strokes, fading trail
 *   - small readouts: freq1, freq2, ratio, error, hold progress
 *
 * Math lives in `lib/game/lissajous.ts` so this component can stay a thin
 * shell over requestAnimationFrame + state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_LOCK_CONFIG,
  computeRatioError,
  createInitialLockState,
  lissajousPoint,
  stepLockState,
  type LockConfig,
  type LockState,
} from "@/lib/game/lissajous";

interface LissajousCalibrationProps {
  targetRatio?: number;
  onLock: () => void;
}

const CANVAS_W = 280;
const CANVAS_H = 200;

export function LissajousCalibration({
  targetRatio = DEFAULT_LOCK_CONFIG.targetRatio,
  onLock,
}: LissajousCalibrationProps) {
  // Player-controlled frequency knobs. Integer steps on the sliders give
  // the knobs a satisfying click and make landing on the target achievable.
  const [freq1, setFreq1] = useState(30);
  const [freq2, setFreq2] = useState(50);

  // Lock state lives in a ref so the animation loop can mutate it without
  // triggering re-renders every frame. We mirror the latched "locked" into
  // a stateful value for the UI.
  const lockStateRef = useRef<LockState>(createInitialLockState());
  const [lockedUI, setLockedUI] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const hasFiredLockRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const config: LockConfig = useMemo(
    () => ({ ...DEFAULT_LOCK_CONFIG, targetRatio }),
    [targetRatio],
  );

  // Fire onLock exactly once when the lock latches.
  useEffect(() => {
    if (lockedUI && !hasFiredLockRef.current) {
      hasFiredLockRef.current = true;
      onLock();
    }
  }, [lockedUI, onLock]);

  const drawFrame = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const currentRatio = freq2 === 0 ? 0 : freq1 / freq2;
      const error = computeRatioError(freq1, freq2, config.targetRatio);
      const nextLockState = stepLockState(lockStateRef.current, error, config);
      lockStateRef.current = nextLockState;

      if (
        nextLockState.locked !== lockedUI ||
        Math.floor((nextLockState.holdCount / config.holdSamples) * 100) !== holdProgress
      ) {
        setLockedUI(nextLockState.locked);
        setHoldProgress(
          Math.min(100, Math.floor((nextLockState.holdCount / config.holdSamples) * 100)),
        );
      }

      // Fade trail
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid
      ctx.strokeStyle = "rgba(34, 197, 94, 0.12)";
      ctx.lineWidth = 1;
      for (let i = 0; i < CANVAS_W; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_H);
        ctx.stroke();
      }
      for (let j = 0; j < CANVAS_H; j += 20) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(CANVAS_W, j);
        ctx.stroke();
      }

      // Lissajous curve sampled over a fixed parameter window. The live
      // "phase" input makes the curve precess when the ratio is off and
      // stand still when it's on target.
      const ampX = CANVAS_W * 0.4;
      const ampY = CANVAS_H * 0.4;
      const phase = t * 0.001 * (currentRatio - config.targetRatio) * 8;
      ctx.strokeStyle = nextLockState.locked ? "rgba(163, 230, 53, 1)" : "rgba(34, 197, 94, 0.85)";
      ctx.lineWidth = nextLockState.locked ? 2 : 1.25;
      ctx.beginPath();
      const steps = 400;
      for (let i = 0; i <= steps; i++) {
        const u = (i / steps) * Math.PI * 2;
        const point = lissajousPoint(u, freq1 / 10, freq2 / 10, ampX, ampY, phase);
        const px = CANVAS_W / 2 + point.x;
        const py = CANVAS_H / 2 + point.y;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Center crosshair
      ctx.strokeStyle = "rgba(34, 197, 94, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2, 0);
      ctx.lineTo(CANVAS_W / 2, CANVAS_H);
      ctx.moveTo(0, CANVAS_H / 2);
      ctx.lineTo(CANVAS_W, CANVAS_H / 2);
      ctx.stroke();
    },
    [freq1, freq2, config, holdProgress, lockedUI],
  );

  // RAF loop
  useEffect(() => {
    const startT = performance.now();
    const loop = (now: number) => {
      drawFrame(now - startT);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame]);

  const currentRatio = freq2 === 0 ? 0 : freq1 / freq2;
  const error = computeRatioError(freq1, freq2, config.targetRatio);
  const targetLabel = `${Math.round(config.targetRatio * 3)}:3`;

  return (
    <div className="border border-green-500/40 bg-black/60 p-3">
      <div className="flex items-start gap-3">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="border border-green-500/30 bg-black"
        />
        <div className="flex-1 space-y-1 text-[11px]">
          <div>
            target:{" "}
            <span className="text-green-300">
              {targetLabel} ({config.targetRatio.toFixed(4)})
            </span>
          </div>
          <div>
            current: <span className="text-green-300">{currentRatio.toFixed(4)}</span>
          </div>
          <div>
            error:{" "}
            <span className={error <= config.errorThreshold ? "text-lime-300" : "text-amber-300"}>
              {(error * 100).toFixed(2)}%
            </span>
          </div>
          <div>
            hold: <span className="text-green-300">{holdProgress}%</span>
          </div>
          <div className="pt-1">
            status:{" "}
            {lockedUI ? (
              <span className="text-lime-300">LOCKED</span>
            ) : (
              <span className="text-green-500/70">tuning...</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="text-[10px] text-green-500/70">freq1: {freq1}</span>
          <input
            type="range"
            min={10}
            max={80}
            step={1}
            value={freq1}
            onChange={(e) => setFreq1(Number(e.target.value))}
            className="w-full accent-green-500"
            disabled={lockedUI}
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-green-500/70">freq2: {freq2}</span>
          <input
            type="range"
            min={10}
            max={80}
            step={1}
            value={freq2}
            onChange={(e) => setFreq2(Number(e.target.value))}
            className="w-full accent-green-500"
            disabled={lockedUI}
          />
        </label>
      </div>
    </div>
  );
}

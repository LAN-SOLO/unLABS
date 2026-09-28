/**
 * PZ_TREND_DIAL — pure logic.
 *
 * Each round is a hidden signal: a linear trend with a slow wobble plus noise.
 * About a third of the rounds contain a visible "Knick" in the last second of
 * history — the trend reverses before the prompt. The answer is the direction
 * of the hidden slope during the continuation (CW = up, CCW = down).
 */
import { mulberry32 } from "@/components/world/puzzles/rng";

/** Samples per second. */
export const TREND_HZ = 20;
/** Samples of continuation revealed after the prediction. */
export const TREND_CONTINUATION = 30;
/** Samples used for the visible-slope estimate (0.8 s). */
export const TREND_SLOPE_WINDOW = 16;

export type TrendAnswer = "cw" | "ccw";

export interface TrendRound {
  history: number[];
  continuation: number[];
  answer: TrendAnswer;
  /** True when the trend reversed shortly before the prompt. */
  reversal: boolean;
}

function roundSeed(seed: number, round: number): number {
  return (Math.imul(seed | 0, 1009) + Math.imul(round | 0, 7919) + 0x5bd1e995) >>> 0;
}

export function trendRound(seed: number, round: number, noise: number): TrendRound {
  const rng = mulberry32(roundSeed(seed, round));
  const n = Math.max(0, Math.min(1, noise));
  const duration = 3 + rng() * 3; // 3..6 s
  const len = Math.round(duration * TREND_HZ);
  const dir0 = rng() < 0.5 ? 1 : -1;
  const speed = 0.6 + rng() * 0.6; // units per second
  const reversal = rng() < 0.3;
  const knick = reversal ? len - Math.round(TREND_HZ * (1 + rng() * 0.2)) : len;
  const wobbleAmp = 0.08;
  const wobbleW = 2 + rng() * 1.5;
  const wobblePh = rng() * Math.PI * 2;
  const amp = n * 0.25;

  let base = 0;
  let slope = (dir0 * speed) / TREND_HZ;
  const history: number[] = [];
  for (let i = 0; i < len; i++) {
    if (i === knick) slope = -slope;
    base += slope;
    const t = i / TREND_HZ;
    history.push(base + wobbleAmp * Math.sin(wobbleW * t + wobblePh) + (rng() * 2 - 1) * amp);
  }
  const continuation: number[] = [];
  for (let i = 0; i < TREND_CONTINUATION; i++) {
    base += slope;
    const t = (len + i) / TREND_HZ;
    continuation.push(base + wobbleAmp * Math.sin(wobbleW * t + wobblePh) + (rng() * 2 - 1) * amp);
  }
  return { history, continuation, answer: slope > 0 ? "cw" : "ccw", reversal };
}

/** Least-squares slope (per sample) over the last `window` samples. */
export function visibleSlope(history: readonly number[], window = TREND_SLOPE_WINDOW): number {
  const w = Math.min(window, history.length);
  if (w < 2) return 0;
  const start = history.length - w;
  const xm = (w - 1) / 2;
  let ym = 0;
  for (let i = 0; i < w; i++) ym += history[start + i];
  ym /= w;
  let num = 0;
  let den = 0;
  for (let i = 0; i < w; i++) {
    const dx = i - xm;
    num += dx * (history[start + i] - ym);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

/** Slope normalised to −1..1 for a momentum bar (≈ ±1.2 units/s = full scale). */
export function momentum(history: readonly number[]): number {
  const s = (visibleSlope(history) * TREND_HZ) / 1.2;
  return Math.max(-1, Math.min(1, s));
}

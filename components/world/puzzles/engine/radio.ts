/**
 * Funkpeilung — pure logic for the two-knob radio tuner.
 */
import { mulberry32, randInt } from "@/components/world/puzzles/rng";

export const FREQ_MIN = 87.5;
export const FREQ_MAX = 108.0;
export const FREQ_SIGMA = 0.6;
export const LOCK_THRESHOLD = 0.9;

export function clampFreq(f: number): number {
  const c = Math.max(FREQ_MIN, Math.min(FREQ_MAX, f));
  return Math.round(c * 10) / 10;
}

export function wrapPhase(p: number): number {
  return ((Math.round(p) % 360) + 360) % 360;
}

/** Signed shortest phase difference target − current, in −180..180. */
export function phaseDelta(phase: number, target: number): number {
  let d = (wrapPhase(target) - wrapPhase(phase)) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** 0..1 — gaussian in frequency, squared raised-cosine in phase. */
export function radioClarity(freq: number, phase: number, tFreq: number, tPhase: number): number {
  const df = freq - tFreq;
  const g = Math.exp(-(df * df) / (2 * FREQ_SIGMA * FREQ_SIGMA));
  const dp = (phaseDelta(phase, tPhase) * Math.PI) / 180;
  const ph = 0.5 + 0.5 * Math.cos(dp);
  return g * ph * ph;
}

/** Deterministic start: ≥ 4 MHz away and 90..270° out of phase (5° grid). */
export function radioStart(
  seed: number,
  tFreq: number,
  tPhase: number,
): { freq: number; phase: number } {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  let freq = FREQ_MIN;
  for (let i = 0; i < 32; i++) {
    freq = clampFreq(FREQ_MIN + rng() * (FREQ_MAX - FREQ_MIN));
    if (Math.abs(freq - tFreq) >= 4) break;
  }
  if (Math.abs(freq - tFreq) < 4) freq = tFreq - FREQ_MIN > FREQ_MAX - tFreq ? FREQ_MIN : FREQ_MAX;
  const phase = wrapPhase(Math.round(tPhase / 5) * 5 + (18 + randInt(rng, 37)) * 5);
  return { freq, phase };
}

function hash(x: number): number {
  const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** A voice-like sample in about −1..1 blended with noise by clarity. */
export function voiceSample(t: number, clarity: number, seed: number): number {
  const c = Math.max(0, Math.min(1, clarity));
  const f0 = 3.1 + (seed % 7) * 0.13;
  const syllable = Math.max(0, Math.sin(t * 1.7 + seed)) ** 0.6 * (0.6 + 0.4 * Math.sin(t * 0.43));
  const voice =
    syllable *
    (0.6 * Math.sin(f0 * t * 6.283) +
      0.3 * Math.sin(2 * f0 * t * 6.283 + 0.5) +
      0.15 * Math.sin(3 * f0 * t * 6.283 + 1.1));
  const noise = hash(Math.floor(t * 900) + seed * 131) * 2 - 1;
  return c * voice + (1 - c) * noise * 0.85;
}

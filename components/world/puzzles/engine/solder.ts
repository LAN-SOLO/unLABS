/**
 * Lötstation — pure logic: seeded PCB layout, joint temperature windows and
 * the heating/cooling model of the iron.
 */
import { mulberry32, randInt } from "@/components/world/puzzles/rng";

/** The board is preheated; joints start here and cool back towards it. */
export const PREHEAT = 180;
export const TEMP_MIN = 230;
export const TEMP_MAX = 360;
/** Holding this far above the window burns the joint. */
export const BURN_MARGIN = 25;
export const BOARD_W = 420;
export const BOARD_H = 260;
const PAD_MARGIN = 36;
const PAD_MIN_DIST = 64;

export interface SolderPad {
  x: number;
  y: number;
  /** Temperature window [lo, hi] in °C. */
  lo: number;
  hi: number;
}

export interface SolderBoard {
  pads: SolderPad[];
  width: number;
}

export type ReleaseResult = "ok" | "kalt" | "verbrannt";

export function generateBoard(seed: number, pads: number, width: number): SolderBoard {
  const count = Math.max(4, Math.min(8, Math.floor(pads)));
  const w = Math.max(6, Math.min(40, width));
  const rng = mulberry32(seed);
  const out: SolderPad[] = [];
  let guard = 0;
  while (out.length < count && guard < 5000) {
    guard++;
    const x = PAD_MARGIN + randInt(rng, BOARD_W - PAD_MARGIN * 2);
    const y = PAD_MARGIN + randInt(rng, BOARD_H - PAD_MARGIN * 2);
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < PAD_MIN_DIST)) continue;
    const lo = TEMP_MIN + randInt(rng, Math.max(1, TEMP_MAX - w - TEMP_MIN + 1));
    out.push({ x, y, lo, hi: lo + w });
  }
  // Deterministic fallback grid in the (practically impossible) case the loop gave up.
  for (let i = out.length; i < count; i++) {
    const lo = TEMP_MIN + ((i * 37) % Math.max(1, TEMP_MAX - w - TEMP_MIN));
    out.push({
      x: PAD_MARGIN + (i % 4) * 110,
      y: PAD_MARGIN + Math.floor(i / 4) * 120,
      lo,
      hi: lo + w,
    });
  }
  return { pads: out, width: w };
}

/** Heating rate in °C/s — the hotter the joint, the faster it climbs. */
export function heatRate(temp: number): number {
  return 38 + 0.08 * Math.max(0, temp - PREHEAT);
}

export function heatStep(temp: number, holding: boolean, dt: number): number {
  if (holding) return temp + heatRate(temp) * dt;
  return PREHEAT + (temp - PREHEAT) * Math.exp(-dt / 6);
}

export function releaseResult(temp: number, window: { lo: number; hi: number }): ReleaseResult {
  if (temp < window.lo) return "kalt";
  if (temp > window.hi) return "verbrannt";
  return "ok";
}

/** True while holding when the joint overheats far past its window. */
export function isBurnt(temp: number, window: { hi: number }): boolean {
  return temp > window.hi + BURN_MARGIN;
}

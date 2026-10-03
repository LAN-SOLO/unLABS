/**
 * Skin motion — the brightness of a dynamic channel at time t and place p.
 *
 * This is the reference implementation the world shader mirrors line by
 * line (GLSL in the engine, docs/SKINS.md § Shader). Inputs are world
 * units: `u` runs along the wall (x + z), `y` is the height (0 … 9), `r` the
 * distance to the room centre, `h` a stable 0 … 1 hash of the panel / cell
 * the voxel belongs to. `input` is the live value of the preset's source.
 */
import type { SkinMode } from "@/lib/world/skins/types";

const TAU = Math.PI * 2;

export interface SkinPlace {
  u: number;
  y: number;
  r: number;
  h: number;
}

export const SKIN_MODES: readonly SkinMode[] = [
  "static",
  "breathe",
  "pulse",
  "heartbeat",
  "chase",
  "scan",
  "ripple",
  "flicker",
  "twinkle",
  "rain",
  "meter",
  "cycle",
  "alarm",
  "reactive",
  "daylight",
  "off",
];

/** Share of full power a mode draws on average (power model, state.ts). */
export const MODE_DUTY: Readonly<Record<SkinMode, number>> = {
  static: 1,
  breathe: 0.72,
  pulse: 0.42,
  heartbeat: 0.36,
  chase: 0.34,
  scan: 0.3,
  ripple: 0.65,
  flicker: 0.86,
  twinkle: 0.32,
  rain: 0.28,
  meter: 0.5,
  cycle: 1,
  alarm: 0.55,
  reactive: 0.6,
  daylight: 0.6,
  off: 0,
};

const frac = (v: number): number => v - Math.floor(v);

/** Stable 0 … 1 noise from two integers (GLSL: fract(sin(dot) * 43758.5453)). */
export function hash2(a: number, b: number): number {
  return frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
}

/**
 * Channel brightness 0 … 1. `speed` scales the tempo (1 = base). Base tempi
 * are chosen so the lore numbers fit: `pulse` at speed 1 has a 2 s period,
 * so speed 1.1806 gives the data center's 847 ms on / 847 ms off.
 */
export function skinLevel(mode: SkinMode, t: number, p: SkinPlace, speed = 1, input = 0): number {
  const s = Math.max(0, speed);
  switch (mode) {
    case "static":
    case "cycle":
      return 1;
    case "off":
      return 0;
    case "breathe":
      return 0.55 + 0.45 * Math.sin(TAU * t * 0.25 * s);
    case "pulse": {
      const ph = frac((t * s) / 2);
      return ph < 0.5 ? 1 : 0.12;
    }
    case "heartbeat": {
      const ph = frac((t * s) / 1.2);
      const a = Math.exp(-(((ph - 0.04) / 0.05) ** 2));
      const b = 0.7 * Math.exp(-(((ph - 0.22) / 0.05) ** 2));
      return 0.18 + 0.82 * Math.max(a, b);
    }
    case "chase": {
      const ph = frac(p.u / 12 - t * s * 0.5);
      return 0.12 + 0.88 * (ph < 0.25 ? 1 - ph / 0.25 : 0);
    }
    case "scan": {
      const band = frac(t * s * 0.25) * 10 - 0.5;
      return 0.16 + 0.84 * Math.exp(-(((p.y - band) / 0.7) ** 2));
    }
    case "ripple":
      return 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(TAU * (p.r / 6 - t * s * 0.4)));
    case "flicker": {
      const n = hash2(Math.floor(t * 12 * s), Math.floor(p.u / 4));
      return n < 0.08 ? 0.12 : 0.9 + 0.1 * n;
    }
    case "twinkle": {
      const w = Math.max(0, Math.sin(TAU * (t * s * 0.3 + p.h)));
      return 0.15 + 0.85 * w ** 8;
    }
    case "rain": {
      const head = 9 - frac(t * s * 0.35 + p.h) * 12;
      const dy = p.y - head;
      return dy >= 0 && dy < 3 ? 1 - dy / 3 : 0.06;
    }
    case "meter": {
      // VU meter: each column (h) rises to the input level with its own wobble.
      const level =
        Math.min(1, Math.max(0, input)) * (0.75 + 0.25 * hash2(Math.floor(t * 8), p.h * 97));
      return p.y <= 0.6 + level * 8 ? 1 : 0.08;
    }
    case "alarm":
      return frac(t) < 0.5 ? 1 : 0.08;
    case "reactive":
      return 0.15 + 0.85 * Math.min(1, Math.max(0, input));
    case "daylight":
      return 0.2 + 0.8 * Math.min(1, Math.max(0, input));
  }
}

/** Line colour mix for `cycle` (0 = line, 1 = line2). */
export function skinCycleMix(mode: SkinMode, t: number, speed = 1): number {
  return mode === "cycle" ? 0.5 + 0.5 * Math.sin(TAU * t * speed * 0.08) : 0;
}

/** Daylight curve for `daylight` / source `clock`: 0 at night, 1 at noon (hour 0 … 24). */
export function daylight(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  return Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
}

/**
 * Drums — kits and patterns for the song system (pure).
 * =====================================================
 *
 * Patterns are step strings on a sixteenth grid (16 steps in 4/4, 12 in
 * 3/4 / 6/8): `x` hit, `o` soft hit (ghost), `.` rest. Kits synthesise the
 * pieces (kick, snare, hats, clap, rim, shaker, toms, brush, ride).
 */
import type { SynthTarget } from "@/lib/world/audio/synth";
import type { DrumStyle, Kit } from "@/lib/world/audio/songs/types";

export const DRUM_PIECES = [
  "kick",
  "snare",
  "hat",
  "ohat",
  "clap",
  "rim",
  "shaker",
  "tomhi",
  "tomlo",
  "brush",
  "ride",
  "crash",
] as const;
export type DrumPiece = (typeof DRUM_PIECES)[number];

export type DrumPattern = Partial<Record<DrumPiece, string>>;

/** 4/4 patterns (16 steps). The minimum energy per piece keeps quiet sections sparse. */
const P16: Record<Exclude<DrumStyle, "none">, DrumPattern> = {
  tick: { rim: "x...x...x...x...", shaker: "..o...o...o...o." },
  brush: { brush: "x.o.x.o.x.o.x.o.", kick: "x.......x.......", rim: "....x.......x..." },
  soft: { kick: "x.......x.o.....", rim: "....x.......x...", hat: "x.o.x.o.x.o.x.o." },
  four: {
    kick: "x...x...x...x...",
    clap: "....x.......x...",
    hat: "..x...x...x...x.",
    shaker: "oooooooooooooooo",
  },
  break: { kick: "x.....x...x.....", snare: "....x.......x..o", hat: "x.x.x.x.x.x.x.xo" },
  half: { kick: "x.........x.....", snare: "........x.......", hat: "x.o.x.o.x.o.x.o." },
  shuffle: { kick: "x.....x.x.......", snare: "....x.......x...", hat: "x..ox..ox..ox..o" },
  march: { kick: "x.......x.......", snare: "....x.ox....x.ox", hat: "x...x...x...x..." },
  bossa: { kick: "x.....x.x.....x.", rim: "x..x...x..x..x..", shaker: "xoxoxoxoxoxoxoxo" },
  waltz: { kick: "x...............", rim: "....x...x.......", hat: "x.o.x.o.x.o....." },
  electro: {
    kick: "x..x..x...x..x..",
    clap: "....x.......x...",
    hat: "xoxoxoxoxoxoxoxo",
    ohat: "..x...x...x...x.",
  },
  dnb: {
    kick: "x.........x.....",
    snare: "....x.......x..o",
    hat: "xoxoxoxoxoxoxoxo",
    ride: "x...x...x...x...",
  },
  lofi: { kick: "x......x..x.....", snare: "....x.......x...", hat: "x.ox.ox.x.ox.ox." },
  tribal: {
    tomlo: "x..x..x...x..x..",
    tomhi: "....x.......x.x.",
    shaker: "xoxoxoxoxoxoxoxo",
    kick: "x.......x.......",
  },
  gallop: { kick: "x...x.x.x...x.x.", snare: "....x.......x...", hat: "x.xxx.xxx.xxx.xx" },
};

/** 3/4 and 6/8 patterns (12 steps). */
const P12: Record<Exclude<DrumStyle, "none">, DrumPattern> = {
  tick: { rim: "x...x...x...", shaker: "..o...o...o." },
  brush: { brush: "x.o.x.o.x.o.", kick: "x..........." },
  soft: { kick: "x...........", rim: "....x...x...", hat: "x.o.x.o.x.o." },
  four: { kick: "x.....x.....", clap: "......x.....", hat: "..x...x...x." },
  break: { kick: "x.....x.x...", snare: "......x.....", hat: "x.x.x.x.x.x." },
  half: { kick: "x...........", snare: "......x.....", hat: "x.o.x.o.x.o." },
  shuffle: { kick: "x.....x.....", snare: "......x.....", hat: "x.ox.ox.ox.o" },
  march: { kick: "x.....x.....", snare: "...x.o...x.o", hat: "x..x..x..x.." },
  bossa: { kick: "x..x..x..x..", rim: "x...x..x....", shaker: "xoxoxoxoxoxo" },
  waltz: { kick: "x...........", rim: "....x...x...", hat: "x.o.x.o.x.o." },
  electro: { kick: "x.....x..x..", clap: "......x.....", hat: "xoxoxoxoxoxo" },
  dnb: { kick: "x.....x.....", snare: "...x.....x..", hat: "xoxoxoxoxoxo" },
  lofi: { kick: "x.......x...", snare: "......x.....", hat: "x.ox.ox.ox.o" },
  tribal: { tomlo: "x..x..x..x..", tomhi: "..x.....x...", shaker: "xoxoxoxoxoxo" },
  gallop: { kick: "x.....x..x..", snare: "......x.....", hat: "xxx.xxx.xxx." },
};

/** Pieces that only join from this section energy on. */
const MIN_ENERGY: Partial<Record<DrumPiece, number>> = {
  shaker: 0.35,
  ohat: 0.55,
  ride: 0.5,
  hat: 0.2,
};

export function drumPattern(style: DrumStyle, steps: 16 | 12): DrumPattern {
  if (style === "none") return {};
  return (steps === 16 ? P16 : P12)[style];
}

/** Hits (piece, step, velocity) of a pattern at a section energy. */
export function drumHits(
  pattern: DrumPattern,
  energy: number,
): { piece: DrumPiece; step: number; vel: number }[] {
  const out: { piece: DrumPiece; step: number; vel: number }[] = [];
  for (const [piece, str] of Object.entries(pattern) as [DrumPiece, string][]) {
    if (energy < (MIN_ENERGY[piece] ?? 0)) continue;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === "x") out.push({ piece, step: i, vel: 1 });
      else if (c === "o") out.push({ piece, step: i, vel: 0.45 });
    }
  }
  return out;
}

/** A drum fill for the last bar (second half): snare / tom run. */
export function fillHits(steps: 16 | 12): { piece: DrumPiece; step: number; vel: number }[] {
  const half = steps / 2;
  const out: { piece: DrumPiece; step: number; vel: number }[] = [];
  for (let i = half; i < steps; i++) {
    const k = (i - half) / half;
    const piece: DrumPiece = k < 0.34 ? "snare" : k < 0.67 ? "tomhi" : "tomlo";
    out.push({ piece, step: i, vel: 0.55 + k * 0.45 });
  }
  return out;
}

const kickLevel: Record<Kit, number> = {
  acoustic: 1,
  electro: 1,
  chip: 0.9,
  lofi: 0.85,
  hand: 0.7,
};

/** Play one drum hit at `at` seconds. */
export function playDrum(
  t: SynthTarget,
  kit: Kit,
  piece: DrumPiece,
  at: number,
  vel: number,
): void {
  const v = vel;
  switch (piece) {
    case "kick": {
      const k = kickLevel[kit];
      if (kit === "chip") {
        t.tone({
          wave: "triangle",
          freq: 160,
          freqEnd: 45,
          at,
          dur: 0.09,
          gain: 0.2 * v * k,
          attack: 0.001,
          release: 0.04,
        });
        return;
      }
      const f0 = kit === "electro" ? 120 : 140;
      const len = kit === "electro" ? 0.19 : 0.15;
      // Body (a little lighter than before so bass lines stay audible) …
      t.tone({
        wave: "sine",
        freq: f0,
        freqEnd: 45,
        at,
        dur: len,
        gain: 0.2 * v * k,
        attack: 0.001,
        release: 0.07,
      });
      // … and a beater click that carries the beat on small speakers.
      t.noise({
        at,
        dur: 0.012,
        gain: 0.05 * v * k,
        filter: "lowpass",
        freq: kit === "lofi" ? 1200 : 3000,
      });
      if (kit !== "lofi")
        t.noise({ at, dur: 0.004, gain: 0.035 * v * k, filter: "bandpass", freq: 3200, q: 1.2 });
      return;
    }
    case "snare": {
      if (kit === "chip") {
        t.noise({ at, dur: 0.08, gain: 0.08 * v, filter: "highpass", freq: 1800, release: 0.04 });
        return;
      }
      const bright = kit === "lofi" ? 2400 : 4200;
      t.noise({
        at,
        dur: 0.12,
        gain: 0.11 * v,
        filter: "bandpass",
        freq: bright,
        q: 0.7,
        release: 0.08,
      });
      t.tone({
        wave: "triangle",
        freq: 210,
        freqEnd: 150,
        at,
        dur: 0.06,
        gain: 0.06 * v,
        attack: 0.001,
        release: 0.05,
      });
      return;
    }
    case "hat":
      t.noise({
        at,
        dur: 0.025,
        gain: (kit === "lofi" ? 0.04 : 0.055) * v,
        filter: "highpass",
        freq: kit === "chip" ? 6000 : 8000,
        release: 0.02,
      });
      return;
    case "ohat":
      t.noise({ at, dur: 0.16, gain: 0.04 * v, filter: "highpass", freq: 7500, release: 0.12 });
      return;
    case "clap":
      for (const d of [0, 0.011, 0.023]) {
        t.noise({
          at: at + d,
          dur: 0.012,
          gain: 0.07 * v,
          filter: "bandpass",
          freq: 1600,
          q: 1.2,
          release: 0.02,
        });
      }
      t.noise({
        at: at + 0.03,
        dur: 0.1,
        gain: 0.04 * v,
        filter: "bandpass",
        freq: 1400,
        q: 1,
        release: 0.1,
      });
      return;
    case "rim":
      t.tone({
        wave: "triangle",
        freq: kit === "hand" ? 520 : 1700,
        at,
        dur: 0.01,
        gain: 0.05 * v,
        attack: 0.001,
        release: 0.04,
      });
      t.noise({ at, dur: 0.008, gain: 0.03 * v, filter: "bandpass", freq: 2600, q: 3 });
      return;
    case "shaker":
      t.noise({
        at,
        dur: 0.04,
        gain: 0.024 * v,
        filter: "highpass",
        freq: 5500,
        attack: 0.012,
        release: 0.03,
      });
      return;
    case "tomhi":
    case "tomlo": {
      const f = piece === "tomhi" ? (kit === "hand" ? 330 : 220) : kit === "hand" ? 180 : 120;
      t.tone({
        wave: "sine",
        freq: f,
        freqEnd: f * 0.7,
        at,
        dur: 0.14,
        gain: 0.12 * v,
        attack: 0.001,
        release: 0.1,
      });
      if (kit === "hand")
        t.noise({ at, dur: 0.01, gain: 0.03 * v, filter: "bandpass", freq: f * 6, q: 2 });
      return;
    }
    case "brush":
      t.noise({
        at,
        dur: 0.12,
        gain: 0.022 * v,
        filter: "bandpass",
        freq: 4500,
        q: 0.6,
        attack: 0.03,
        release: 0.08,
      });
      return;
    case "ride":
      t.tone({
        wave: "sine",
        freq: 3400,
        at,
        dur: 0.01,
        gain: 0.01 * v,
        attack: 0.001,
        release: 0.5,
      });
      t.noise({ at, dur: 0.05, gain: 0.018 * v, filter: "highpass", freq: 6500, release: 0.3 });
      return;
    case "crash":
      t.noise({
        at,
        dur: 0.4,
        gain: 0.05 * v,
        filter: "highpass",
        freq: 5000,
        attack: 0.002,
        release: 1.2,
      });
      return;
  }
}

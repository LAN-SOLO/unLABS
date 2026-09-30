/**
 * Footfalls — footwear × surface step sounds + motion layers (pure recipes).
 * =========================================================================
 *
 * A step is built from two halves, like Foley on a stage:
 *
 * - the **surface** (`SURFACE_RESP`) says how the floor answers: how hard it
 *   is, the band of its contact click, the low "body" of the floor, a ring
 *   (steel plate, grate bars, tiles, ice) and a texture (grit, fibres, splash,
 *   glass shards, gravel grains, cable rattle, paper crinkle);
 * - the **footwear** (`FOOTWEAR_SPEC` + one designer function per sole) says
 *   how it is struck: heel → toe timing, hardness (how much of the click comes
 *   through), mass (the thump), and its own signature — boot lugs, sneaker
 *   squeaks on smooth floors, the hollow flop and wet slap of rubber boots, the
 *   magnetic clamp + hum on steel, the soft pad and heel flap of slippers, the
 *   woody double clack of clogs, and the continuous wheel roll of skates.
 *
 * Every step draws its micro-variation from the target's RNG (heel/toe gap,
 * pitch, click band, extra scuffs), feet differ (right foot a little heavier
 * and lower), and `pace` (1 = normal walk, > 1.3 = running) makes steps
 * quicker, brighter and louder. Kinds: `step`, `scuff` (turning), `stop`
 * (settling after the last step), `land` (after a ladder / elevator ride).
 *
 * Motion layers (`renderMotion`) come from worn pieces: keys jingle, tools
 * rattle, a crystal chimes, a raincoat rustles, a cylinder clanks, a servo
 * squeaks, a gadget hums — quietly, with the steps.
 *
 * Budget: a step is 3–6 synth events (one node chain each), a layer 1–3.
 */
import { mtof, type SynthTarget } from "@/lib/world/audio/synth";
import type { Surface } from "@/lib/world/audio/sfx";
import {
  FOOTWEAR_SETS,
  MOTION_LAYER_KINDS,
  type Footwear,
  type MotionLayerKind,
} from "@/lib/world/audio/songs/styles";

export { FOOTWEAR_SETS, MOTION_LAYER_KINDS };
export type { Footwear, MotionLayerKind };

export const STEP_KINDS = ["step", "scuff", "stop", "land"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export interface StepParams {
  surface: Surface;
  footwear: Footwear;
  /** 0 = left, 1 = right. */
  foot?: 0 | 1;
  /** 1 = normal walk, 0.5 = creeping, 1.5+ = running. */
  pace?: number;
  kind?: StepKind;
  /** Seconds until the next step is expected (skate roll length). */
  interval?: number;
}

// ── Helpers ──────────────────────────────────────────────────────

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const vary = (t: SynthTarget, v: number, amount = 0.08): number =>
  v * (1 + (t.rand() - 0.5) * 2 * amount);
const between = (t: SynthTarget, lo: number, hi: number): number => lo + t.rand() * (hi - lo);
const pick = <T>(t: SynthTarget, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(t.rand() * list.length))]!;
const chance = (t: SynthTarget, p: number): boolean => t.rand() < p;

// ── Surfaces ─────────────────────────────────────────────────────

type Texture =
  | "none"
  | "rattle"
  | "plate"
  | "grit"
  | "fibre"
  | "creak"
  | "splash"
  | "shards"
  | "grains"
  | "cable"
  | "crinkle"
  | "frost"
  | "bounce";

export interface SurfaceResp {
  /** 0 = soft (carpet) … 1 = hard (tile, ice). */
  hard: number;
  /** Contact click: filter, centre frequency, Q. */
  click: { filter: "bandpass" | "highpass" | "lowpass"; freq: number; q: number };
  /** Low body of the floor (Hz, glide target). */
  body: [number, number];
  /** Ringing partials (steel plate, grate bars, tiles, ice), decay seconds. */
  ring?: { freqs: readonly number[]; decay: number; gain: number; wave: "triangle" | "sine" };
  texture: Texture;
  /** Smooth enough for sneaker squeaks / skate glide. */
  smooth: boolean;
  /** Ferromagnetic: magnetic boots clamp. */
  magnetic: boolean;
}

export const SURFACE_RESP: Readonly<Record<Surface, SurfaceResp>> = {
  metal: {
    hard: 0.9,
    click: { filter: "bandpass", freq: 2300, q: 2.5 },
    body: [180, 110],
    ring: { freqs: [880, 1040, 760, 1180], decay: 0.18, gain: 0.03, wave: "triangle" },
    texture: "plate",
    smooth: true,
    magnetic: true,
  },
  grate: {
    hard: 0.85,
    click: { filter: "bandpass", freq: 3300, q: 5 },
    body: [95, 70],
    ring: { freqs: [230, 205, 260], decay: 0.06, gain: 0.03, wave: "triangle" },
    texture: "rattle",
    smooth: false,
    magnetic: true,
  },
  concrete: {
    hard: 0.8,
    click: { filter: "lowpass", freq: 900, q: 0.8 },
    body: [95, 58],
    texture: "grit",
    smooth: false,
    magnetic: false,
  },
  tile: {
    hard: 1,
    click: { filter: "highpass", freq: 2300, q: 0.8 },
    body: [150, 100],
    ring: { freqs: [1900, 2100, 1750], decay: 0.08, gain: 0.012, wave: "sine" },
    texture: "none",
    smooth: true,
    magnetic: false,
  },
  carpet: {
    hard: 0.12,
    click: { filter: "lowpass", freq: 520, q: 0.7 },
    body: [110, 70],
    texture: "fibre",
    smooth: false,
    magnetic: false,
  },
  wood: {
    hard: 0.6,
    click: { filter: "bandpass", freq: 760, q: 1.4 },
    body: [210, 140],
    texture: "creak",
    smooth: true,
    magnetic: false,
  },
  water: {
    hard: 0.35,
    click: { filter: "lowpass", freq: 700, q: 0.8 },
    body: [120, 80],
    texture: "splash",
    smooth: true,
    magnetic: false,
  },
  glass: {
    hard: 0.9,
    click: { filter: "highpass", freq: 3200, q: 0.8 },
    body: [130, 90],
    texture: "shards",
    smooth: false,
    magnetic: false,
  },
  rubber: {
    hard: 0.3,
    click: { filter: "lowpass", freq: 650, q: 1 },
    body: [125, 85],
    texture: "bounce",
    smooth: true,
    magnetic: false,
  },
  gravel: {
    hard: 0.55,
    click: { filter: "bandpass", freq: 1500, q: 0.9 },
    body: [90, 60],
    texture: "grains",
    smooth: false,
    magnetic: false,
  },
  ice: {
    hard: 1,
    click: { filter: "bandpass", freq: 1800, q: 1.2 },
    body: [160, 120],
    ring: { freqs: [2600, 3100, 2850], decay: 0.1, gain: 0.014, wave: "sine" },
    texture: "frost",
    smooth: true,
    magnetic: false,
  },
  cable: {
    hard: 0.3,
    click: { filter: "bandpass", freq: 1300, q: 3 },
    body: [140, 95],
    texture: "cable",
    smooth: false,
    magnetic: false,
  },
  paper: {
    hard: 0.15,
    click: { filter: "bandpass", freq: 3500, q: 1.2 },
    body: [120, 80],
    texture: "crinkle",
    smooth: false,
    magnetic: false,
  },
};

// ── Footwear ─────────────────────────────────────────────────────

export interface FootwearSpec {
  /** How much of the floor's click comes through (sole hardness). */
  hard: number;
  /** Weight of the thump. */
  mass: number;
  /** Heel → toe gap range in seconds (at walking pace). */
  heelToe: readonly [number, number];
  /** Toe loudness relative to the heel. */
  toe: number;
  /** Overall pitch colour. */
  pitch: number;
  /** Overall loudness of the set. */
  gain: number;
}

export const FOOTWEAR_SPEC: Readonly<Record<Footwear, FootwearSpec>> = {
  boot: { hard: 0.85, mass: 0.95, heelToe: [0.045, 0.07], toe: 0.6, pitch: 1, gain: 1 },
  sneaker: { hard: 0.35, mass: 0.55, heelToe: [0.022, 0.04], toe: 0.8, pitch: 1.15, gain: 0.75 },
  rubber: { hard: 0.3, mass: 0.8, heelToe: [0.035, 0.055], toe: 0.7, pitch: 0.85, gain: 0.9 },
  magnetic: { hard: 1, mass: 1, heelToe: [0.012, 0.02], toe: 0.5, pitch: 0.8, gain: 1 },
  slipper: { hard: 0.08, mass: 0.3, heelToe: [0.06, 0.1], toe: 1, pitch: 1.1, gain: 0.6 },
  clog: { hard: 1, mass: 0.6, heelToe: [0.075, 0.105], toe: 0.9, pitch: 1.2, gain: 0.9 },
  skate: { hard: 0.5, mass: 0.5, heelToe: [0.03, 0.04], toe: 0.5, pitch: 1, gain: 0.8 },
};

/** Player-facing loudness per footwear (multiplies the surface gain). */
export function footwearGain(f: Footwear): number {
  return FOOTWEAR_SPEC[f].gain;
}

// ── Building blocks ──────────────────────────────────────────────

interface Hit {
  at: number;
  /** 0..1 loudness of this impact. */
  g: number;
  /** Brightness multiplier (sole hardness × floor hardness × pace). */
  bright: number;
  pitch: number;
}

/** The floor's contact click (the "tick" of a heel or toe). */
function contact(t: SynthTarget, s: SurfaceResp, h: Hit, dur = 0.035): void {
  const f = s.click.freq * (0.45 + 0.65 * h.bright) * h.pitch;
  t.noise({
    at: h.at,
    dur: vary(t, dur, 0.2),
    gain: 0.26 * h.g * (0.25 + 0.75 * h.bright),
    filter: s.click.filter,
    freq: vary(t, f, 0.12),
    q: s.click.q,
    attack: 0.002 + (1 - h.bright) * 0.01,
  });
}

/** The thump through the floor (sole mass; soft floors swallow it). */
function body(
  t: SynthTarget,
  s: SurfaceResp,
  h: Hit,
  mass: number,
  wave: "sine" | "triangle",
): void {
  t.tone({
    wave,
    freq: vary(t, s.body[0] * h.pitch, 0.08),
    freqEnd: s.body[1] * h.pitch,
    at: h.at,
    dur: 0.05 + mass * 0.03,
    gain: 0.13 * mass * h.g * (0.45 + 0.55 * s.hard),
    attack: 0.002,
    release: 0.04 + mass * 0.03,
  });
}

/** Plate / bar / tile / ice ring. */
function ring(t: SynthTarget, s: SurfaceResp, h: Hit, amount = 1): void {
  if (!s.ring || amount <= 0) return;
  t.tone({
    wave: s.ring.wave,
    freq: vary(t, pick(t, s.ring.freqs) * h.pitch, 0.06),
    at: h.at + 0.003,
    dur: 0.015,
    gain: s.ring.gain * amount * h.g * (0.4 + 0.6 * h.bright),
    release: s.ring.decay,
  });
}

/** The floor's texture layer (what makes water wet and gravel crunchy). */
function texture(t: SynthTarget, s: SurfaceResp, h: Hit, weight: number): void {
  const g = h.g * weight;
  switch (s.texture) {
    case "rattle":
      // Grating: loose bars clattering after the hit, a hollow void below.
      for (let i = 0; i < 3; i++)
        t.noise({
          at: h.at + 0.008 + i * between(t, 0.012, 0.022),
          dur: 0.012,
          gain: (0.14 - i * 0.035) * g,
          filter: "bandpass",
          freq: vary(t, pick(t, [2900, 3300, 3700]), 0.08),
          q: 6,
          release: 0.025,
        });
      t.tone({
        wave: "square",
        freq: vary(t, 230),
        freqEnd: 180,
        at: h.at,
        dur: 0.05,
        gain: 0.02 * g,
        filter: { type: "lowpass", freq: 900 },
      });
      break;
    case "plate":
      // Steel plate: a bright clang band under the click.
      t.noise({
        at: h.at + 0.002,
        dur: 0.03,
        gain: 0.08 * g * (0.3 + 0.7 * h.bright),
        filter: "bandpass",
        freq: vary(t, 3400, 0.1),
        q: 3,
        release: 0.06,
      });
      break;
    case "grit":
      t.noise({
        at: h.at + between(t, 0.02, 0.05),
        dur: 0.05,
        gain: 0.07 * g,
        filter: "bandpass",
        freq: vary(t, 3200, 0.2),
        q: 1.2,
        attack: 0.01,
      });
      break;
    case "fibre":
      t.noise({
        at: h.at + 0.01,
        dur: 0.07,
        gain: 0.08 * g,
        filter: "bandpass",
        freq: vary(t, 1400, 0.2),
        q: 0.8,
        attack: 0.02,
      });
      break;
    case "creak":
      if (chance(t, 0.3))
        t.tone({
          wave: "sawtooth",
          freq: vary(t, 330, 0.15),
          freqEnd: vary(t, 290, 0.1),
          at: h.at + 0.05,
          dur: 0.14,
          gain: 0.01 * g,
          vibrato: { rate: vary(t, 22, 0.3), depth: 8 },
          filter: { type: "bandpass", freq: 1100, q: 5 },
        });
      break;
    case "splash":
      // Wet slap + spray + a plop of the displaced water.
      t.noise({
        at: h.at,
        dur: vary(t, 0.09, 0.2),
        gain: 0.2 * g,
        filter: "bandpass",
        freq: vary(t, 1100, 0.2),
        freqEnd: 600,
        q: 0.9,
        attack: 0.004,
        release: 0.08,
      });
      t.noise({
        at: h.at + between(t, 0.02, 0.04),
        dur: vary(t, 0.12, 0.25),
        gain: 0.1 * g,
        filter: "highpass",
        freq: vary(t, 3800, 0.2),
        attack: 0.01,
        release: 0.14,
      });
      t.tone({
        wave: "sine",
        freq: vary(t, 520, 0.2),
        freqEnd: 260,
        at: h.at + between(t, 0.03, 0.06),
        dur: 0.05,
        gain: 0.03 * g,
        release: 0.05,
      });
      break;
    case "shards": {
      // Glass crunching: a handful of tiny bright cracks + a tinkle.
      const n = 4 + Math.floor(t.rand() * 4);
      for (let i = 0; i < n; i++)
        t.noise({
          at: h.at + between(t, 0, 0.08),
          dur: 0.007,
          gain: between(t, 0.1, 0.2) * g,
          filter: "bandpass",
          freq: between(t, 3500, 7500),
          q: 6,
          release: 0.02,
        });
      t.tone({
        wave: "sine",
        freq: between(t, 4200, 6800),
        at: h.at + between(t, 0.03, 0.08),
        dur: 0.01,
        gain: 0.012 * g,
        release: 0.12,
      });
      break;
    }
    case "grains": {
      // Gravel / grit: grains shifting under the sole over ~0.1 s.
      const n = 4 + Math.floor(t.rand() * 3);
      for (let i = 0; i < n; i++)
        t.noise({
          at: h.at + between(t, 0.005, 0.11),
          dur: 0.012,
          gain: between(t, 0.05, 0.1) * g,
          filter: "bandpass",
          freq: between(t, 1200, 4200),
          q: 2.5,
          release: 0.02,
        });
      break;
    }
    case "cable":
      // Rubber cables shifting: a soft plastic double-knock.
      for (const d of [0.012, between(t, 0.03, 0.05)])
        t.noise({
          at: h.at + d,
          dur: 0.012,
          gain: 0.08 * g,
          filter: "bandpass",
          freq: vary(t, 1600, 0.15),
          q: 4,
          release: 0.03,
        });
      break;
    case "crinkle": {
      // Paper and cardboard: a quick flutter of crinkles.
      const n = 3 + Math.floor(t.rand() * 3);
      for (let i = 0; i < n; i++)
        t.noise({
          at: h.at + i * between(t, 0.015, 0.03),
          dur: 0.018,
          gain: between(t, 0.05, 0.1) * g,
          filter: "bandpass",
          freq: between(t, 2500, 5500),
          q: 1.8,
          release: 0.03,
        });
      break;
    }
    case "frost":
      // A cold crisp tick, now and then a tiny slip.
      if (chance(t, 0.35))
        t.noise({
          at: h.at + between(t, 0.03, 0.06),
          dur: 0.05,
          gain: 0.05 * g,
          filter: "highpass",
          freq: vary(t, 5200, 0.15),
          attack: 0.015,
        });
      break;
    case "bounce":
      // Rubber matting gives a little: a soft second thud.
      t.tone({
        wave: "sine",
        freq: vary(t, 95, 0.1),
        freqEnd: 70,
        at: h.at + between(t, 0.035, 0.05),
        dur: 0.04,
        gain: 0.05 * g,
      });
      break;
    case "none":
      break;
  }
}

/** Sideways drag of a sole over the floor (turns, stops, slipper shuffle). */
function drag(t: SynthTarget, s: SurfaceResp, at: number, g: number, soft: number): void {
  const f =
    s.texture === "fibre" ? 1100 : s.texture === "grit" || s.texture === "grains" ? 2600 : 1800;
  t.noise({
    at,
    dur: vary(t, 0.09 + soft * 0.06, 0.2),
    gain: 0.09 * g,
    filter: "bandpass",
    freq: vary(t, f * (1.2 - soft * 0.4), 0.15),
    freqEnd: f * 0.7,
    q: 1.1,
    attack: 0.02 + soft * 0.02,
    release: 0.05,
  });
}

/** Sneaker squeak: rubber on a smooth floor. */
function squeak(t: SynthTarget, at: number, g: number): void {
  const f = between(t, 1700, 3100);
  t.tone({
    wave: "triangle",
    freq: f,
    freqEnd: f * between(t, 1.08, 1.3),
    at,
    dur: between(t, 0.04, 0.09),
    gain: 0.022 * g,
    attack: 0.008,
    release: 0.03,
    vibrato: { rate: between(t, 35, 60), depth: f * 0.03 },
    filter: { type: "bandpass", freq: f * 1.1, q: 3 },
  });
}

// ── Footwear designers ───────────────────────────────────────────

interface Ctx {
  t: SynthTarget;
  s: SurfaceResp;
  surface: Surface;
  spec: FootwearSpec;
  kind: StepKind;
  /** Loudness 0..~1.2 (pace, foot, kind). */
  g: number;
  pitch: number;
  pace: number;
  foot: 0 | 1;
  gap: number;
  interval: number;
}

function heelToe(c: Ctx, bodyWave: "sine" | "triangle" = "sine"): { heel: Hit; toe: Hit } {
  const bright = clamp01(c.s.hard * c.spec.hard * (0.85 + 0.15 * c.pace));
  const heel: Hit = { at: 0, g: c.g, bright, pitch: c.pitch };
  const toe: Hit = {
    at: c.gap,
    g: c.g * c.spec.toe,
    bright: clamp01(bright * 1.1),
    pitch: c.pitch * 1.08,
  };
  body(c.t, c.s, heel, c.spec.mass, bodyWave);
  contact(c.t, c.s, heel);
  contact(c.t, c.s, toe, 0.025);
  return { heel, toe };
}

/** Work boots: lugged heel strike, toe roll, full floor answer. */
function boot(c: Ctx): void {
  const { heel } = heelToe(c);
  ring(c.t, c.s, heel, 1);
  texture(c.t, c.s, heel, 1);
  if (c.surface === "water")
    // Heavy sole: the displaced water sloshes back.
    c.t.noise({
      at: between(c.t, 0.09, 0.13),
      dur: 0.08,
      gain: 0.07 * c.g,
      filter: "bandpass",
      freq: vary(c.t, 800, 0.2),
      freqEnd: 500,
      q: 1.5,
      attack: 0.02,
    });
  // Lugs catching now and then (a short gritty scrape after the toe).
  if (c.kind !== "land" && chance(c.t, 0.18 + 0.2 * clamp01(c.pace - 1)))
    drag(c.t, c.s, c.gap + 0.02, c.g * 0.5, 0.2);
}

/** Sneakers: soft rounded thud, close heel-toe, squeaks on smooth floors. */
function sneaker(c: Ctx): void {
  const bright = clamp01(c.s.hard * 0.3);
  const h: Hit = { at: 0, g: c.g, bright, pitch: c.pitch };
  // One rolling, muffled impact instead of a click pair.
  c.t.noise({
    at: 0,
    dur: 0.05,
    gain: 0.2 * c.g,
    filter: "lowpass",
    freq: vary(c.t, (650 + 900 * c.s.hard) * c.pitch, 0.12),
    attack: 0.006,
    release: 0.04,
  });
  body(c.t, c.s, h, c.spec.mass, "sine");
  contact(c.t, c.s, { ...h, at: c.gap, g: c.g * 0.6 }, 0.02);
  texture(c.t, c.s, h, c.surface === "water" ? 0.6 : 0.8);
  const turning = c.kind === "scuff" || c.kind === "stop";
  if (c.s.smooth && c.surface !== "water" && chance(c.t, turning ? 0.9 : 0.14))
    squeak(c.t, c.gap + between(c.t, 0.01, 0.04), c.g * (turning ? 1.3 : 0.9));
  if (c.surface === "water")
    // Squelch: foam soaking up water.
    c.t.noise({
      at: c.gap + 0.02,
      dur: 0.09,
      gain: 0.07 * c.g,
      filter: "bandpass",
      freq: vary(c.t, 900, 0.2),
      freqEnd: 1600,
      q: 2,
      attack: 0.02,
    });
}

/** Rubber boots: hollow shaft flop, rubbery slap, huge on water. */
function rubber(c: Ctx): void {
  const h: Hit = { at: 0, g: c.g, bright: clamp01(c.s.hard * 0.35), pitch: c.pitch };
  // The hollow boot shaft resonating.
  c.t.noise({
    at: 0,
    dur: 0.06,
    gain: 0.18 * c.g,
    filter: "bandpass",
    freq: vary(c.t, 230, 0.12),
    q: 3,
    attack: 0.004,
    release: 0.07,
  });
  body(c.t, c.s, h, c.spec.mass, "sine");
  contact(c.t, c.s, h, 0.03);
  // Squash: the thick rubber sole giving way.
  c.t.noise({
    at: 0.006,
    dur: 0.05,
    gain: 0.1 * c.g,
    filter: "bandpass",
    freq: vary(c.t, 700, 0.12),
    freqEnd: 480,
    q: 2,
    attack: 0.012,
  });
  // The loose upper slapping the leg a moment later.
  c.t.noise({
    at: c.gap + between(c.t, 0.04, 0.07),
    dur: 0.03,
    gain: 0.14 * c.g,
    filter: "bandpass",
    freq: vary(c.t, 950, 0.15),
    q: 1.2,
    attack: 0.003,
  });
  texture(c.t, c.s, h, c.surface === "water" ? 1.5 : 0.8);
  if (c.surface !== "water" && c.s.smooth && chance(c.t, 0.2))
    // Rubber-on-rubber creak.
    c.t.tone({
      wave: "sawtooth",
      freq: vary(c.t, 420, 0.2),
      freqEnd: vary(c.t, 360, 0.1),
      at: c.gap,
      dur: 0.07,
      gain: 0.012 * c.g,
      vibrato: { rate: vary(c.t, 30, 0.3), depth: 14 },
      filter: { type: "bandpass", freq: 900, q: 4 },
    });
}

/** Magnetic boots: clamp + electromagnet hum on steel, a dead clunk elsewhere. */
function magnetic(c: Ctx): void {
  const h: Hit = { at: 0, g: c.g, bright: clamp01(c.s.hard), pitch: c.pitch };
  if (c.s.magnetic) {
    // Release click of the lifting plate, then the clamp.
    c.t.noise({
      at: 0,
      dur: 0.006,
      gain: 0.08 * c.g,
      filter: "bandpass",
      freq: vary(c.t, 4200, 0.1),
      q: 5,
    });
    const clamp: Hit = { ...h, at: 0.03 };
    body(c.t, c.s, { ...clamp, g: c.g * 1.2 }, 1, "triangle");
    contact(c.t, c.s, clamp, 0.03);
    ring(c.t, c.s, clamp, 1.6);
    // Electromagnet engaging: a short mains-ish buzz with a pitch sag.
    c.t.tone({
      wave: "square",
      freq: vary(c.t, 120, 0.04),
      freqEnd: 100,
      at: 0.03,
      dur: 0.1,
      gain: 0.03 * c.g,
      attack: 0.004,
      release: 0.08,
      filter: { type: "lowpass", freq: 700, q: 2 },
    });
  } else {
    // No steel to grab: a heavy dull plate thud and a servo whine.
    body(c.t, c.s, { ...h, g: c.g * 1.25 }, 1, "sine");
    contact(c.t, c.s, { ...h, bright: h.bright * 0.6 }, 0.04);
    if (c.surface === "water")
      // The flat sole plate slaps the water: a sharp broad smack, less spray.
      c.t.noise({
        at: 0,
        dur: 0.015,
        gain: 0.22 * c.g,
        filter: "highpass",
        freq: vary(c.t, 1200, 0.1),
        release: 0.03,
      });
    texture(c.t, c.s, h, c.surface === "water" ? 0.7 : 1);
    c.t.tone({
      wave: "sawtooth",
      freq: vary(c.t, 900, 0.05),
      freqEnd: 1150,
      at: 0.01,
      dur: 0.06,
      gain: 0.016 * c.g,
      filter: { type: "bandpass", freq: 1000, q: 6 },
    });
    if (c.surface === "water")
      // Live coils in a puddle: a short electric fizz.
      for (let i = 0; i < 4; i++)
        c.t.noise({
          at: 0.03 + i * between(c.t, 0.018, 0.03),
          dur: 0.012,
          gain: 0.05 * c.g,
          filter: "highpass",
          freq: vary(c.t, 6000, 0.15),
          release: 0.02,
        });
    // The magnets buzz in vain for a moment.
    c.t.tone({
      wave: "square",
      freq: vary(c.t, 120, 0.04),
      at: 0.015,
      dur: 0.07,
      gain: 0.018 * c.g,
      attack: 0.006,
      release: 0.05,
      filter: { type: "lowpass", freq: 900, q: 1.5 },
    });
  }
}

/** Slippers: soft pad, a drag, the heel flapping back. */
function slipper(c: Ctx): void {
  c.t.noise({
    at: 0,
    dur: 0.06,
    gain: 0.16 * c.g,
    filter: "lowpass",
    freq: vary(c.t, 380 + 300 * c.s.hard, 0.15),
    attack: 0.018,
    release: 0.05,
  });
  drag(c.t, c.s, 0.01, c.g * 0.9, 1);
  // Even a soft sole ticks faintly on hard floors.
  contact(
    c.t,
    c.s,
    { at: 0.012, g: c.g * 0.5, bright: clamp01(c.s.hard * 0.3), pitch: c.pitch },
    0.02,
  );
  // Flap: the loose back of the slipper hitting the heel.
  c.t.noise({
    at: c.gap + between(c.t, 0.02, 0.05),
    dur: 0.012,
    gain: 0.07 * c.g,
    filter: "bandpass",
    freq: vary(c.t, 1200, 0.2),
    q: 1.5,
  });
  texture(c.t, c.s, { at: 0, g: c.g, bright: 0.1, pitch: c.pitch }, 0.6);
  if (c.surface === "water")
    // Soaked slipper: a soggy squish.
    c.t.noise({
      at: 0.03,
      dur: 0.12,
      gain: 0.06 * c.g,
      filter: "bandpass",
      freq: vary(c.t, 600, 0.2),
      freqEnd: 1100,
      q: 2.5,
      attack: 0.03,
    });
}

/** Clogs: two hollow woody clacks (heel, then toe), knocking on hard floors. */
function clog(c: Ctx): void {
  const hard = c.s.hard;
  for (const [at, g] of [
    [0, 1],
    [c.gap, c.spec.toe],
  ] as const) {
    const f = vary(c.t, 620 * c.pitch, 0.07) * (0.7 + 0.3 * hard);
    // Hollow wooden sole: short resonant knock + a clacky band.
    c.t.tone({
      wave: "triangle",
      freq: f,
      freqEnd: f * 0.82,
      at,
      dur: 0.018,
      gain: 0.09 * c.g * g * (0.5 + 0.5 * hard),
      release: 0.06,
    });
    c.t.noise({
      at,
      dur: 0.016,
      gain: 0.18 * c.g * g * (0.3 + 0.7 * hard),
      filter: "bandpass",
      freq: vary(c.t, 1500 + 700 * hard, 0.1),
      q: 4,
      release: 0.03,
    });
  }
  const h: Hit = { at: 0, g: c.g, bright: clamp01(hard), pitch: c.pitch };
  body(c.t, c.s, { ...h, g: c.g * 0.7 }, c.spec.mass, "triangle");
  ring(c.t, c.s, h, 0.8);
  texture(c.t, c.s, h, c.surface === "water" ? 0.55 : 0.9);
}

/** Skates: a push stroke and a continuous wheel roll until the next step. */
function skate(c: Ctx): void {
  const roll = Math.max(0.12, c.interval * 1.2 + 0.04);
  const s = c.s;
  if (c.kind === "stop") {
    // Toe-stop brake: a rubber screech sliding down.
    c.t.tone({
      wave: "sawtooth",
      freq: vary(c.t, 700, 0.1),
      freqEnd: 380,
      at: 0,
      dur: 0.2,
      gain: 0.016 * c.g,
      vibrato: { rate: vary(c.t, 28, 0.2), depth: 20 },
      filter: { type: "bandpass", freq: 1200, q: 3 },
    });
    drag(c.t, s, 0, c.g * 1.1, 0.3);
    return;
  }
  // The push: a sideways scrape of the wheels.
  c.t.noise({
    at: 0,
    dur: 0.06,
    gain: 0.08 * c.g,
    filter: "bandpass",
    freq: vary(c.t, 2200 * c.pitch, 0.12),
    freqEnd: 1100 * c.pitch,
    q: 1.4,
    attack: 0.006,
  });
  // The roll: band, roughness and joints by floor.
  const r = SKATE_ROLL[c.surface];
  c.t.noise({
    at: 0.01,
    dur: roll,
    gain: r.g * c.g,
    filter: "bandpass",
    freq: vary(c.t, r.f, 0.08),
    q: r.q,
    attack: Math.min(0.08, roll * 0.3),
    release: Math.min(0.2, roll * 0.5),
  });
  // Bearing whine rising with speed.
  const whine = vary(c.t, (380 + 180 * clamp01(c.pace - 0.6)) * c.pitch, 0.04);
  c.t.tone({
    wave: "sine",
    freq: whine,
    freqEnd: whine * 0.96,
    at: 0.01,
    dur: roll,
    gain: 0.008 * c.g,
    attack: Math.min(0.08, roll * 0.3),
    release: Math.min(0.2, roll * 0.5),
    vibrato: { rate: 7, depth: 3 },
  });
  // Joints under the wheels (tile gaps, grate bars, planks, cables) or debris.
  for (let i = 0; i < r.joints; i++) {
    const at = 0.04 + ((i + c.t.rand() * 0.4) / Math.max(1, r.joints)) * roll * 0.85;
    if (r.joint === "knock")
      c.t.tone({
        wave: "triangle",
        freq: vary(c.t, 300, 0.1),
        at,
        dur: 0.01,
        gain: 0.03 * c.g,
        release: 0.05,
      });
    else
      c.t.noise({
        at,
        dur: r.joint === "crackle" ? 0.006 : 0.01,
        gain: (r.joint === "crackle" ? 0.1 : 0.08) * c.g,
        filter: "bandpass",
        freq: vary(c.t, r.joint === "crackle" ? 4500 : c.s.click.freq, 0.15),
        q: 4,
      });
  }
}

type RollJoint = "click" | "knock" | "crackle";

/** Skate roll per floor: noise band, Q, level, joints per roll and their kind. */
const SKATE_ROLL: Readonly<
  Record<Surface, { f: number; q: number; g: number; joints: number; joint: RollJoint }>
> = {
  metal: { f: 1400, q: 1.4, g: 0.09, joints: 1, joint: "click" },
  grate: { f: 1100, q: 0.8, g: 0.1, joints: 4, joint: "click" },
  concrete: { f: 900, q: 0.6, g: 0.12, joints: 0, joint: "click" },
  tile: { f: 2400, q: 1, g: 0.07, joints: 2, joint: "click" },
  carpet: { f: 380, q: 0.7, g: 0.07, joints: 0, joint: "click" },
  wood: { f: 1200, q: 1.2, g: 0.08, joints: 2, joint: "knock" },
  water: { f: 2600, q: 0.7, g: 0.1, joints: 0, joint: "click" },
  glass: { f: 2000, q: 0.8, g: 0.07, joints: 5, joint: "crackle" },
  rubber: { f: 600, q: 0.8, g: 0.06, joints: 0, joint: "click" },
  gravel: { f: 900, q: 0.5, g: 0.11, joints: 5, joint: "crackle" },
  ice: { f: 5200, q: 0.8, g: 0.06, joints: 0, joint: "click" },
  cable: { f: 1600, q: 1, g: 0.07, joints: 2, joint: "knock" },
  paper: { f: 3000, q: 0.8, g: 0.07, joints: 3, joint: "crackle" },
};

const DESIGNERS: Readonly<Record<Footwear, (c: Ctx) => void>> = {
  boot,
  sneaker,
  rubber,
  magnetic,
  slipper,
  clog,
  skate,
};

// ── Public recipes ───────────────────────────────────────────────

/** Timing and loudness shaping shared by every set (pace, foot, kind). */
function context(t: SynthTarget, p: StepParams): Ctx {
  const spec = FOOTWEAR_SPEC[p.footwear];
  const s = SURFACE_RESP[p.surface];
  const pace = Math.max(0.4, Math.min(2, p.pace ?? 1));
  const foot = p.foot ?? 0;
  const kind = p.kind ?? "step";
  // Right foot a touch heavier and lower; faster = louder and quicker heel-toe.
  const footPitch = foot === 1 ? 0.97 : 1.025;
  const footGain = foot === 1 ? 1 : 0.9;
  const paceGain = 0.7 + 0.35 * clamp01(pace - 0.5);
  const kindGain = kind === "land" ? 1.35 : kind === "stop" ? 0.55 : kind === "scuff" ? 0.5 : 1;
  const gap = between(t, spec.heelToe[0], spec.heelToe[1]) / Math.max(0.7, Math.min(1.6, pace));
  return {
    t,
    s,
    surface: p.surface,
    spec,
    kind,
    g: Math.min(1.25, footGain * paceGain * kindGain * vary(t, 1, 0.08)),
    pitch: spec.pitch * footPitch * vary(t, 1, 0.04),
    pace,
    foot,
    gap,
    interval: Math.max(0.1, Math.min(0.8, p.interval ?? 0.3)),
  };
}

/** One footfall (or scuff / stop / landing) of `footwear` on `surface`. */
export function renderStep(t: SynthTarget, p: StepParams): void {
  const c = context(t, p);
  if (c.kind === "scuff") {
    // Turning: a drag of the sole (sneakers squeak, skates carve).
    drag(t, c.s, 0, c.g * 1.6, p.footwear === "slipper" ? 1 : 0.3);
    if (p.footwear === "sneaker" && c.s.smooth) squeak(t, 0.02, c.g * 1.5);
    if (p.footwear === "skate")
      t.noise({
        at: 0,
        dur: 0.18,
        gain: 0.08 * c.g,
        filter: "bandpass",
        freq: 2600,
        freqEnd: 1500,
        q: 1.5,
        attack: 0.03,
      });
    return;
  }
  if (c.kind === "land") {
    // Both feet: a heavier first contact, the second foot right after.
    DESIGNERS[p.footwear](c);
    const second: Ctx = { ...c, g: c.g * 0.65, foot: c.foot === 0 ? 1 : 0, kind: "step" };
    const shifted = delayed(t, between(t, 0.03, 0.05));
    DESIGNERS[p.footwear]({ ...second, t: shifted });
    return;
  }
  DESIGNERS[p.footwear](c);
  if (c.kind === "stop" && p.footwear !== "skate") drag(t, c.s, c.gap + 0.02, c.g * 0.8, 0.4);
}

/** A target that shifts every event by `by` seconds (second foot of a landing). */
function delayed(t: SynthTarget, by: number): SynthTarget {
  return {
    rand: () => t.rand(),
    tone: (s) => t.tone({ ...s, at: (s.at ?? 0) + by }),
    noise: (s) => t.noise({ ...s, at: (s.at ?? 0) + by }),
  };
}

// ── Motion layers ────────────────────────────────────────────────

/** D lydian (the soundtrack's home colour) for the crystal chime. */
const CHIME_MIDI = [86, 88, 90, 93, 95, 98] as const;

export interface MotionParams {
  foot?: 0 | 1;
  pace?: number;
  kind?: StepKind;
  /** Running step counter (layers that sound every n-th step). */
  index?: number;
}

/**
 * Motion layers of worn pieces for one step. Deterministic per target RNG.
 * Returns how many layers actually sounded (tests, budgets).
 */
export function renderMotion(
  t: SynthTarget,
  layers: readonly MotionLayerKind[],
  p: MotionParams = {},
): number {
  const pace = Math.max(0.4, Math.min(2, p.pace ?? 1));
  const kind = p.kind ?? "step";
  const index = p.index ?? 0;
  const foot = p.foot ?? 0;
  const jolt = kind === "land" ? 1.8 : kind === "stop" ? 0.8 : kind === "scuff" ? 0.6 : 1;
  const run = clamp01((pace - 0.9) / 0.6);
  let n = 0;
  for (const layer of layers) {
    const g = jolt * (0.75 + 0.45 * run);
    switch (layer) {
      case "keys": {
        if (!chance(t, 0.55 + 0.45 * run) && kind === "step") break;
        const count = 2 + Math.floor(t.rand() * (2 + run * 2));
        for (let i = 0; i < count; i++) {
          const f = between(t, 3000, 6400);
          t.tone({
            wave: "sine",
            freq: f,
            at: 0.03 + i * between(t, 0.012, 0.03),
            dur: 0.006,
            gain: 0.012 * g,
            release: between(t, 0.05, 0.12),
          });
          if (i === 0)
            t.tone({
              wave: "sine",
              freq: f * 2.76,
              at: 0.03,
              dur: 0.004,
              gain: 0.005 * g,
              release: 0.05,
            });
        }
        n++;
        break;
      }
      case "tools": {
        if (kind === "step" && foot === 0 && run < 0.5) break;
        for (let i = 0; i < 2; i++)
          t.noise({
            at: 0.035 + i * between(t, 0.02, 0.04),
            dur: 0.01,
            gain: 0.06 * g,
            filter: "bandpass",
            freq: between(t, 900, 1900),
            q: 6,
            release: 0.04,
          });
        t.tone({
          wave: "triangle",
          freq: vary(t, 410, 0.1),
          at: 0.04,
          dur: 0.01,
          gain: 0.012 * g,
          release: 0.09,
        });
        n++;
        break;
      }
      case "chime": {
        if (kind === "step" && index % 3 !== 0) break;
        const f = mtof(pick(t, CHIME_MIDI));
        t.tone({ wave: "sine", freq: f, at: 0.05, dur: 0.01, gain: 0.012 * g, release: 0.7 });
        t.tone({
          wave: "sine",
          freq: f * 2.756,
          at: 0.05,
          dur: 0.006,
          gain: 0.004 * g,
          release: 0.25,
        });
        n++;
        break;
      }
      case "rustle":
        t.noise({
          at: 0.01,
          dur: vary(t, 0.09, 0.2),
          gain: 0.035 * g,
          filter: "bandpass",
          freq: vary(t, foot === 0 ? 2400 : 3100, 0.15),
          freqEnd: foot === 0 ? 3000 : 2500,
          q: 0.9,
          attack: 0.03,
          release: 0.05,
        });
        n++;
        break;
      case "clank":
        if (kind === "step" && foot === 1 && run < 0.5) break;
        t.tone({
          wave: "triangle",
          freq: vary(t, 360, 0.08),
          at: 0.05,
          dur: 0.012,
          gain: 0.02 * g,
          release: 0.18,
        });
        t.tone({
          wave: "sine",
          freq: vary(t, 360 * 2.41, 0.05),
          at: 0.05,
          dur: 0.008,
          gain: 0.007 * g,
          release: 0.1,
        });
        n++;
        break;
      case "squeak":
        if (kind === "step" && index % 2 !== 1) break;
        t.tone({
          wave: "sawtooth",
          freq: vary(t, 720, 0.1),
          freqEnd: vary(t, 940, 0.1),
          at: 0.02,
          dur: between(t, 0.06, 0.1),
          gain: 0.007 * g,
          attack: 0.01,
          filter: { type: "bandpass", freq: 1500, q: 6 },
        });
        n++;
        break;
      case "hum":
        t.tone({
          wave: "sine",
          freq: vary(t, 110, 0.02),
          at: 0,
          dur: 0.22,
          gain: 0.012 * g,
          attack: 0.06,
          release: 0.12,
          vibrato: { rate: 5, depth: 2 },
        });
        t.tone({
          wave: "square",
          freq: vary(t, 220, 0.02),
          at: 0,
          dur: 0.2,
          gain: 0.004 * g,
          attack: 0.05,
          release: 0.1,
          filter: { type: "lowpass", freq: 900 },
        });
        n++;
        break;
    }
  }
  return n;
}

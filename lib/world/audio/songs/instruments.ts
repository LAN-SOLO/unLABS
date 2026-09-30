/**
 * Instruments — synth recipes for the song system (pure).
 * =======================================================
 *
 * Each instrument writes one note as tones / noise bursts into a
 * `SynthTarget` (same vocabulary as sfx.ts), so it can be recorded in
 * tests and played on Web Audio. Gains are balanced so that a part at
 * velocity 1 sits at a similar loudness whatever instrument plays it.
 *
 * Sound palette: "Zelda, but technical" — ocarina, harp, celesta and
 * music box next to chip squares, FM bass and filtered synth plucks.
 */
import { mtof, type SynthTarget } from "@/lib/world/audio/synth";
import type { InstrumentId } from "@/lib/world/audio/songs/types";

export interface NoteSpec {
  midi: number;
  /** Seconds from the target's t0. */
  at: number;
  /** Sounding length in seconds (before release). */
  dur: number;
  /** 0..1 */
  vel: number;
  pan?: number;
}

type Recipe = (t: SynthTarget, f: number, n: NoteSpec) => void;

const P = (n: NoteSpec) => (n.pan !== undefined ? { pan: n.pan } : {});

const R: Record<InstrumentId, Recipe> = {
  // ── Leads ──────────────────────────────────────────────────────
  ocarina: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.075 * v,
      attack: 0.035,
      release: 0.16,
      ...(n.dur > 0.35 ? { vibrato: { rate: 5.4, depth: f * 0.007 } } : {}),
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 2,
      at: n.at,
      dur: n.dur,
      gain: 0.01 * v,
      attack: 0.03,
      release: 0.1,
      ...P(n),
    });
    t.tone({
      wave: "triangle",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.018 * v,
      attack: 0.03,
      release: 0.12,
      filter: { type: "lowpass", freq: 1600 },
      ...P(n),
    });
    t.noise({
      at: n.at,
      dur: Math.min(0.09, n.dur),
      gain: 0.022 * v,
      filter: "bandpass",
      freq: f * 2.2,
      q: 5,
      attack: 0.01,
      release: 0.05,
      ...P(n),
    });
  },
  flute: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.065 * v,
      attack: 0.05,
      release: 0.18,
      ...(n.dur > 0.4 ? { vibrato: { rate: 4.6, depth: f * 0.006 } } : {}),
      ...P(n),
    });
    t.tone({
      wave: "triangle",
      freq: f * 2,
      at: n.at,
      dur: n.dur,
      gain: 0.008 * v,
      attack: 0.06,
      release: 0.12,
      ...P(n),
    });
    t.noise({
      at: n.at,
      dur: n.dur,
      gain: 0.007 * v,
      filter: "bandpass",
      freq: f * 3,
      q: 2,
      attack: 0.06,
      release: 0.12,
      ...P(n),
    });
  },
  whistle: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.05 * v,
      attack: 0.02,
      release: 0.1,
      vibrato: { rate: 6, depth: f * 0.012 },
      ...P(n),
    });
    t.noise({
      at: n.at,
      dur: n.dur,
      gain: 0.004 * v,
      filter: "bandpass",
      freq: f * 2,
      q: 8,
      ...P(n),
    });
  },
  chip: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "square",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.03 * v,
      attack: 0.004,
      release: 0.05,
      ...(n.dur > 0.3 ? { vibrato: { rate: 6.2, depth: f * 0.009 } } : {}),
      filter: { type: "lowpass", freq: 3400 },
      ...P(n),
    });
    t.tone({
      wave: "square",
      freq: f * 1.004,
      at: n.at,
      dur: n.dur,
      gain: 0.011 * v,
      attack: 0.004,
      release: 0.05,
      filter: { type: "lowpass", freq: 2400 },
      ...P(n),
    });
  },
  synthlead: (t, f, n) => {
    const v = n.vel;
    for (const [m, g] of [
      [1, 0.024],
      [1.006, 0.02],
    ] as const) {
      t.tone({
        wave: "sawtooth",
        freq: f * m,
        at: n.at,
        dur: n.dur,
        gain: g * v,
        attack: 0.01,
        release: 0.12,
        ...(n.dur > 0.3 ? { vibrato: { rate: 5.5, depth: f * 0.006 } } : {}),
        filter: {
          type: "lowpass",
          freq: Math.min(9000, f * 9),
          freqEnd: Math.max(300, f * 2.5),
          q: 3,
        },
        ...P(n),
      });
    }
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.02 * v,
      attack: 0.01,
      release: 0.1,
      ...P(n),
    });
  },
  brass: (t, f, n) => {
    const v = n.vel;
    for (const d of [-5, 5]) {
      t.tone({
        wave: "sawtooth",
        freq: f,
        detune: d,
        at: n.at,
        dur: n.dur,
        gain: 0.022 * v,
        attack: 0.06,
        release: 0.14,
        filter: { type: "lowpass", freq: 700, freqEnd: Math.min(4000, f * 5), q: 1.2 },
        ...P(n),
      });
    }
  },
  strings: (t, f, n) => {
    const v = n.vel;
    for (const d of [-7, 6]) {
      t.tone({
        wave: "sawtooth",
        freq: f,
        detune: d,
        at: n.at,
        dur: n.dur,
        gain: 0.02 * v,
        attack: Math.min(0.18, n.dur * 0.4),
        release: 0.45,
        vibrato: { rate: 5.3, depth: f * 0.004 },
        filter: { type: "lowpass", freq: 2400, q: 0.6 },
        ...P(n),
      });
    }
  },
  choir: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "triangle",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.045 * v,
      attack: 0.2,
      release: 0.6,
      vibrato: { rate: 4.8, depth: f * 0.005 },
      ...P(n),
    });
    t.tone({
      wave: "sawtooth",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.012 * v,
      attack: 0.25,
      release: 0.6,
      filter: { type: "bandpass", freq: 750, q: 2.5 },
      ...P(n),
    });
  },
  // ── Plucked / struck ───────────────────────────────────────────
  harp: (t, f, n) => {
    const v = n.vel;
    const tail = Math.min(2.4, 0.9 + 400 / f);
    t.tone({
      wave: "triangle",
      freq: f,
      at: n.at,
      dur: 0.02,
      gain: 0.07 * v,
      attack: 0.002,
      release: tail,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 2,
      at: n.at,
      dur: 0.01,
      gain: 0.02 * v,
      attack: 0.002,
      release: tail * 0.5,
      ...P(n),
    });
    t.noise({ at: n.at, dur: 0.006, gain: 0.018 * v, filter: "highpass", freq: 3200, ...P(n) });
  },
  celesta: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: 0.01,
      gain: 0.06 * v,
      attack: 0.002,
      release: 1.7,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 4,
      at: n.at,
      dur: 0.01,
      gain: 0.012 * v,
      attack: 0.001,
      release: 0.35,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 2.76,
      at: n.at,
      dur: 0.01,
      gain: 0.008 * v,
      attack: 0.001,
      release: 0.6,
      ...P(n),
    });
  },
  musicbox: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f * 2,
      at: n.at,
      dur: 0.01,
      gain: 0.05 * v,
      attack: 0.001,
      release: 1.3,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 6.1,
      at: n.at,
      dur: 0.01,
      gain: 0.008 * v,
      attack: 0.001,
      release: 0.25,
      ...P(n),
    });
    t.tone({
      wave: "triangle",
      freq: f * 4,
      at: n.at,
      dur: 0.01,
      gain: 0.006 * v,
      attack: 0.001,
      release: 0.4,
      ...P(n),
    });
  },
  kalimba: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: 0.01,
      gain: 0.075 * v,
      attack: 0.002,
      release: 0.75,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 5.95,
      at: n.at,
      dur: 0.005,
      gain: 0.018 * v,
      attack: 0.001,
      release: 0.07,
      ...P(n),
    });
    t.noise({
      at: n.at,
      dur: 0.004,
      gain: 0.012 * v,
      filter: "bandpass",
      freq: 2500,
      q: 2,
      ...P(n),
    });
  },
  marimba: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: 0.01,
      gain: 0.085 * v,
      attack: 0.002,
      release: 0.45,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 4,
      at: n.at,
      dur: 0.005,
      gain: 0.025 * v,
      attack: 0.001,
      release: 0.06,
      ...P(n),
    });
    t.noise({
      at: n.at,
      dur: 0.008,
      gain: 0.015 * v,
      filter: "bandpass",
      freq: f * 2,
      q: 3,
      ...P(n),
    });
  },
  vibes: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: Math.min(n.dur, 0.3),
      gain: 0.055 * v,
      attack: 0.003,
      release: 1.4,
      vibrato: { rate: 5, depth: f * 0.004 },
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 4,
      at: n.at,
      dur: 0.01,
      gain: 0.01 * v,
      attack: 0.002,
      release: 0.3,
      ...P(n),
    });
  },
  epiano: (t, f, n) => {
    const v = n.vel;
    const hold = Math.min(n.dur, 1.2);
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: hold,
      gain: 0.06 * v,
      attack: 0.004,
      release: 0.7,
      ...P(n),
    });
    t.tone({
      wave: "triangle",
      freq: f * 2,
      at: n.at,
      dur: 0.05,
      gain: 0.014 * v,
      attack: 0.003,
      release: 0.35,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 7.1,
      at: n.at,
      dur: 0.01,
      gain: 0.005 * v,
      attack: 0.001,
      release: 0.08,
      ...P(n),
    });
  },
  piano: (t, f, n) => {
    const v = n.vel;
    const hold = Math.min(n.dur, 1.6);
    t.tone({
      wave: "triangle",
      freq: f,
      at: n.at,
      dur: hold,
      gain: 0.048 * v,
      attack: 0.002,
      release: Math.min(1.6, 0.5 + 300 / f),
      filter: {
        type: "lowpass",
        freq: Math.min(9000, f * 7),
        freqEnd: Math.max(400, f * 2),
        q: 0.5,
      },
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: hold,
      gain: 0.03 * v,
      attack: 0.002,
      release: 0.9,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 2.003,
      at: n.at,
      dur: 0.05,
      gain: 0.01 * v,
      attack: 0.002,
      release: 0.5,
      ...P(n),
    });
    t.noise({ at: n.at, dur: 0.006, gain: 0.008 * v, filter: "highpass", freq: 2500, ...P(n) });
  },
  guitar: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "triangle",
      freq: f,
      at: n.at,
      dur: 0.02,
      gain: 0.065 * v,
      attack: 0.002,
      release: Math.min(1.4, 0.4 + n.dur),
      filter: { type: "lowpass", freq: 2600, freqEnd: 900, q: 0.8 },
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 2,
      at: n.at,
      dur: 0.01,
      gain: 0.012 * v,
      attack: 0.002,
      release: 0.4,
      ...P(n),
    });
    t.noise({
      at: n.at,
      dur: 0.012,
      gain: 0.02 * v,
      filter: "bandpass",
      freq: f * 3,
      q: 6,
      ...P(n),
    });
  },
  pluck: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sawtooth",
      freq: f,
      at: n.at,
      dur: Math.min(0.25, n.dur),
      gain: 0.04 * v,
      attack: 0.003,
      release: 0.22,
      filter: { type: "lowpass", freq: 4200, freqEnd: 380, q: 4 },
      ...P(n),
    });
    t.tone({
      wave: "square",
      freq: f / 2,
      at: n.at,
      dur: 0.08,
      gain: 0.008 * v,
      attack: 0.003,
      release: 0.1,
      filter: { type: "lowpass", freq: 900 },
      ...P(n),
    });
  },
  // ── Pads (one call per chord tone) ─────────────────────────────
  warmpad: (t, f, n) => {
    for (const d of [-8, 8]) {
      t.tone({
        wave: "sawtooth",
        freq: f,
        detune: d,
        at: n.at,
        dur: n.dur,
        gain: 0.011 * n.vel,
        attack: Math.min(1.2, n.dur * 0.4),
        release: 1.4,
        filter: { type: "lowpass", freq: 1000, q: 0.5 },
        ...P(n),
      });
    }
  },
  darkpad: (t, f, n) => {
    for (const d of [-10, 10]) {
      t.tone({
        wave: "sawtooth",
        freq: f,
        detune: d,
        at: n.at,
        dur: n.dur,
        gain: 0.012 * n.vel,
        attack: Math.min(1.8, n.dur * 0.5),
        release: 2,
        filter: { type: "lowpass", freq: 520, q: 1.5 },
        ...P(n),
      });
    }
  },
  glass: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.02 * v,
      attack: Math.min(0.8, n.dur * 0.3),
      release: 1.6,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 2,
      detune: 4,
      at: n.at,
      dur: n.dur,
      gain: 0.007 * v,
      attack: Math.min(1, n.dur * 0.4),
      release: 1.4,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 3,
      at: n.at,
      dur: n.dur,
      gain: 0.003 * v,
      attack: Math.min(1.2, n.dur * 0.5),
      release: 1,
      ...P(n),
    });
  },
  organ: (t, f, n) => {
    const v = n.vel;
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.022 * v,
      attack: 0.02,
      release: 0.12,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 2,
      at: n.at,
      dur: n.dur,
      gain: 0.011 * v,
      attack: 0.02,
      release: 0.1,
      ...P(n),
    });
    t.tone({
      wave: "sine",
      freq: f * 3,
      at: n.at,
      dur: n.dur,
      gain: 0.005 * v,
      attack: 0.02,
      release: 0.08,
      ...P(n),
    });
    t.tone({
      wave: "square",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.004 * v,
      attack: 0.02,
      release: 0.1,
      filter: { type: "lowpass", freq: 1500 },
      ...P(n),
    });
  },
  stringpad: (t, f, n) => {
    for (const d of [-9, 0, 9]) {
      t.tone({
        wave: "sawtooth",
        freq: f,
        detune: d,
        at: n.at,
        dur: n.dur,
        gain: 0.0075 * n.vel,
        attack: Math.min(0.9, n.dur * 0.35),
        release: 1.1,
        vibrato: { rate: 5.1 + d * 0.02, depth: f * 0.003 },
        filter: { type: "lowpass", freq: 1900, q: 0.4 },
        ...P(n),
      });
    }
  },
  choirpad: (t, f, n) => {
    t.tone({
      wave: "triangle",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.02 * n.vel,
      attack: Math.min(1, n.dur * 0.4),
      release: 1.3,
      vibrato: { rate: 4.6, depth: f * 0.004 },
      ...P(n),
    });
    t.tone({
      wave: "sawtooth",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.006 * n.vel,
      attack: Math.min(1, n.dur * 0.4),
      release: 1.3,
      filter: { type: "bandpass", freq: 650, q: 2.2 },
      ...P(n),
    });
  },
  // ── Bass ───────────────────────────────────────────────────────
  subbass: (t, f, n) => {
    // A shaped sub: firm attack, then a quieter sustain (held notes no longer wall up the low end),
    // plus a soft octave so it still reads on small speakers.
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: Math.min(n.dur, 0.35),
      gain: 0.07 * n.vel,
      attack: 0.012,
      release: 0.25,
    });
    if (n.dur > 0.35)
      t.tone({
        wave: "sine",
        freq: f,
        at: n.at + 0.2,
        dur: n.dur - 0.2,
        gain: 0.035 * n.vel,
        attack: 0.2,
        release: 0.2,
      });
    t.tone({
      wave: "triangle",
      freq: f * 2,
      at: n.at,
      dur: Math.min(n.dur, 0.5),
      gain: 0.014 * n.vel,
      attack: 0.01,
      release: 0.15,
    });
  },
  synthbass: (t, f, n) => {
    t.tone({
      wave: "sawtooth",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.056 * n.vel,
      attack: 0.005,
      release: 0.1,
      filter: { type: "lowpass", freq: 1100, freqEnd: 220, q: 5 },
    });
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.055 * n.vel,
      attack: 0.005,
      release: 0.1,
    });
  },
  upright: (t, f, n) => {
    t.tone({
      wave: "triangle",
      freq: f,
      at: n.at,
      dur: Math.min(n.dur, 0.5),
      gain: 0.065 * n.vel,
      attack: 0.006,
      release: 0.35,
      filter: { type: "lowpass", freq: 900 },
    });
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: Math.min(n.dur, 0.5),
      gain: 0.035 * n.vel,
      attack: 0.006,
      release: 0.3,
    });
    t.noise({ at: n.at, dur: 0.012, gain: 0.025 * n.vel, filter: "bandpass", freq: f * 5, q: 4 });
  },
  fmbass: (t, f, n) => {
    t.tone({
      wave: "sine",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.065 * n.vel,
      attack: 0.004,
      release: 0.1,
    });
    t.tone({
      wave: "square",
      freq: f * 2,
      at: n.at,
      dur: n.dur,
      gain: 0.028 * n.vel,
      attack: 0.004,
      release: 0.08,
      filter: { type: "lowpass", freq: 900, freqEnd: 160, q: 6 },
    });
  },
  chipbass: (t, f, n) => {
    t.tone({
      wave: "triangle",
      freq: f,
      at: n.at,
      dur: n.dur,
      gain: 0.085 * n.vel,
      attack: 0.002,
      release: 0.03,
    });
  },
};

/** Instruments that play chords as pads (long attack, used by the pad part). */
export const PAD_INSTRUMENTS: ReadonlySet<InstrumentId> = new Set([
  "warmpad",
  "darkpad",
  "glass",
  "organ",
  "stringpad",
  "choirpad",
]);

/** Plucked / struck instruments: their tail rings on its own. */
export const STRUCK_INSTRUMENTS: ReadonlySet<InstrumentId> = new Set([
  "harp",
  "celesta",
  "musicbox",
  "kalimba",
  "marimba",
  "vibes",
  "epiano",
  "piano",
  "guitar",
  "pluck",
]);

/** Play one note of an instrument into a synth target. */
export function playNote(t: SynthTarget, id: InstrumentId, n: NoteSpec): void {
  R[id](t, mtof(n.midi), n);
}

/** Display names (studio). */
export const INSTRUMENT_IDS = Object.keys(R) as InstrumentId[];

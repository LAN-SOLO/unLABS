/**
 * Sound effects, round 6 — the overhaul ("Zelda, but technical").
 * ===============================================================
 *
 * Replaces the original event, action, device, UI and footstep recipes
 * with richer ones and adds a few new cues. Every tonal cue sits in
 * D lydian (the soundtrack's home colour), so pickups, insights, solved
 * puzzles and menus sound like one instrument family with the music:
 * FM-ish bells and glassy plucks for rewards, short chip blips for the
 * interface, relays, whines and hums for machines, heel-and-toe footsteps
 * with per-surface texture.
 *
 * Jingles are original (no quotes from existing games). Pure recipes —
 * see sfx.ts for the vocabulary; `SFX` merges this table over the old one.
 */
import { mtof, type SynthTarget } from "@/lib/world/audio/synth";
import type { SfxParams } from "@/lib/world/audio/sfx";
import { renderStep } from "@/lib/world/audio/footfall";

type Recipe = (t: SynthTarget, p: SfxParams) => void;

const vary = (t: SynthTarget, v: number, amount = 0.06): number =>
  v * (1 + (t.rand() - 0.5) * 2 * amount);
const variant = (t: SynthTarget, n: number): number => Math.min(n - 1, Math.floor(t.rand() * n));
const between = (t: SynthTarget, lo: number, hi: number): number => lo + t.rand() * (hi - lo);

/** D lydian scale degrees (0 = D4) → MIDI. */
const LYD = [0, 2, 4, 6, 7, 9, 11];
function d(deg: number, oct = 0): number {
  const o = Math.floor(deg / 7);
  const i = ((deg % 7) + 7) % 7;
  return 62 + (o + oct) * 12 + LYD[i]!;
}

/** Bell: fundamental + inharmonic partials with fast decay (FM-ish). */
function bell(t: SynthTarget, midi: number, at: number, gain: number, decay = 1.2): void {
  const f = mtof(midi);
  t.tone({ wave: "sine", freq: f, at, dur: 0.01, gain, attack: 0.002, release: decay });
  t.tone({
    wave: "sine",
    freq: f * 2.756,
    at,
    dur: 0.01,
    gain: gain * 0.28,
    attack: 0.001,
    release: decay * 0.35,
  });
  t.tone({
    wave: "sine",
    freq: f * 5.404,
    at,
    dur: 0.01,
    gain: gain * 0.12,
    attack: 0.001,
    release: decay * 0.18,
  });
  t.tone({
    wave: "sine",
    freq: f * 2,
    at,
    dur: 0.01,
    gain: gain * 0.18,
    attack: 0.002,
    release: decay * 0.6,
  });
}

/** Glassy pluck (harp-like with a digital edge). */
function pluck(t: SynthTarget, midi: number, at: number, gain: number, tail = 0.5): void {
  const f = mtof(midi);
  t.tone({ wave: "triangle", freq: f, at, dur: 0.02, gain, attack: 0.002, release: tail });
  t.tone({
    wave: "square",
    freq: f,
    at,
    dur: 0.03,
    gain: gain * 0.25,
    attack: 0.002,
    release: tail * 0.4,
    filter: { type: "lowpass", freq: f * 6, freqEnd: f * 1.5 },
  });
}

/** Short chip blip (interface). */
function blip(t: SynthTarget, midi: number, at: number, gain: number, len = 0.035): void {
  t.tone({
    wave: "square",
    freq: mtof(midi),
    at,
    dur: len,
    gain,
    attack: 0.002,
    release: 0.03,
    filter: { type: "lowpass", freq: 4200 },
  });
  t.tone({
    wave: "sine",
    freq: mtof(midi),
    at,
    dur: len,
    gain: gain * 0.8,
    attack: 0.002,
    release: 0.05,
  });
}

/** Rising sparkle: a few very high bell pings with a hiss. */
function sparkle(t: SynthTarget, at: number, n: number, gain: number): void {
  for (let i = 0; i < n; i++) {
    bell(
      t,
      d(7 + Math.floor(between(t, 0, 7)), 1),
      at + i * between(t, 0.03, 0.06),
      gain * between(t, 0.5, 1),
      0.35,
    );
  }
  t.noise({
    at,
    dur: n * 0.05 + 0.2,
    gain: gain * 0.4,
    filter: "highpass",
    freq: 7000,
    attack: 0.03,
    release: 0.25,
  });
}

/** Relay click (mechanical contact). */
function relay(t: SynthTarget, at: number, g = 1): void {
  t.noise({ at, dur: 0.008, gain: 0.22 * g, filter: "bandpass", freq: vary(t, 2600, 0.1), q: 4 });
  t.noise({
    at: at + 0.012,
    dur: 0.006,
    gain: 0.12 * g,
    filter: "bandpass",
    freq: vary(t, 1800, 0.1),
    q: 5,
  });
  t.tone({ wave: "sine", freq: vary(t, 140), freqEnd: 90, at, dur: 0.04, gain: 0.06 * g });
}

// ── Footsteps: delegated to footfall.ts (work boots, the default sole) ──

function footstep(t: SynthTarget, p: SfxParams): void {
  renderStep(t, { surface: p.surface ?? "metal", footwear: "boot" });
}

export const SFX_V2 = {
  footstep,

  // ── Rewards & discovery ────────────────────────────────────────
  pickup: (t) => {
    // Two-note glassy "got it", interval rotates so repeats stay fresh.
    const v = variant(t, 4);
    const pair = [
      [4, 7],
      [2, 4],
      [4, 6],
      [3, 7],
    ][v]!;
    pluck(t, d(pair[0]!, 1), 0, 0.12, 0.35);
    bell(t, d(pair[1]!, 1), 0.07, 0.09, 0.6);
    t.noise({ at: 0.05, dur: 0.12, gain: 0.02, filter: "highpass", freq: 7500, release: 0.1 });
  },
  item_rare: (t) => {
    // Short original "item found" flourish: a rising lydian run into a held bell chord.
    [0, 2, 4, 3, 7].forEach((deg, i) => pluck(t, d(deg, 1), i * 0.075, 0.1, 0.4));
    for (const [deg, g] of [
      [7, 0.08],
      [11, 0.06],
      [14, 0.05],
    ] as const)
      bell(t, d(deg, 0), 0.4, g, 1.6);
    t.tone({
      wave: "triangle",
      freq: mtof(d(0, -1)),
      at: 0.4,
      dur: 0.6,
      gain: 0.06,
      attack: 0.02,
      release: 0.8,
    });
    sparkle(t, 0.45, 5, 0.03);
  },
  insight: (t) => {
    // A thought clicking into place: a soft low bloom, then two bells a lydian fourth apart.
    t.tone({
      wave: "sine",
      freq: mtof(d(0, -1)),
      dur: 0.9,
      gain: 0.05,
      attack: 0.25,
      release: 0.9,
    });
    bell(t, d(3, 1), 0.05, 0.08, 1.5);
    bell(t, d(7, 1), 0.2, 0.09, 1.8);
    bell(t, d(9, 1), 0.34, 0.05, 1.6);
    sparkle(t, 0.25, 4, 0.022);
  },
  blueprint: (t) => {
    // Data sweep and a two-blip "saved".
    t.noise({
      dur: 0.4,
      gain: 0.05,
      filter: "bandpass",
      freq: 900,
      freqEnd: 6500,
      q: 4,
      release: 0.1,
    });
    t.tone({ wave: "sine", freq: 500, freqEnd: 1800, dur: 0.35, gain: 0.04, release: 0.05 });
    blip(t, d(4, 1), 0.38, 0.05);
    blip(t, d(7, 1), 0.46, 0.05, 0.06);
    bell(t, d(7, 1), 0.46, 0.04, 0.8);
  },
  puzzle_solved: (t) => {
    // Original "solved" jingle: an arpeggio climbing through the ♯4, landing bright.
    const run = [0, 3, 4, 7, 9, 11, 14];
    run.forEach((deg, i) => pluck(t, d(deg, 0), i * 0.07, 0.09, 0.35));
    for (const deg of [7, 11, 14]) bell(t, d(deg, 0), run.length * 0.07 + 0.02, 0.06, 1.8);
    t.tone({
      wave: "triangle",
      freq: mtof(d(0, -1)),
      at: 0.5,
      dur: 0.8,
      gain: 0.07,
      attack: 0.02,
      release: 0.9,
    });
    sparkle(t, 0.55, 6, 0.028);
  },
  secret: (t) => {
    // A hidden thing revealed: shimmering tremolo that resolves upward (original motif).
    const seq = [
      [0, 0],
      [3, 0.12],
      [4, 0.24],
      [8, 0.36],
      [7, 0.52],
      [11, 0.68],
      [14, 0.86],
    ] as const;
    for (const [deg, at] of seq) {
      bell(t, d(deg, 0), at, 0.07, 0.9);
      pluck(t, d(deg, -1), at, 0.05, 0.3);
    }
    t.tone({
      wave: "sine",
      freq: mtof(d(0, -1)),
      at: 0.86,
      dur: 1.2,
      gain: 0.07,
      attack: 0.05,
      release: 1.2,
    });
    t.tone({
      wave: "sine",
      freq: mtof(d(4, -1)),
      at: 0.86,
      dur: 1.2,
      gain: 0.05,
      attack: 0.05,
      release: 1.2,
    });
    sparkle(t, 0.9, 7, 0.03);
  },
  achievement: (t) => {
    // CRT fanfare: chip triplet up, a held bell chord, scanline hiss.
    const v = variant(t, 3);
    const top = [7, 9, 11][v]!;
    [0, 2, 4, 0, 4, top].forEach((deg, i) =>
      blip(t, d(deg, 1), i < 3 ? i * 0.06 : 0.22 + (i - 3) * 0.09, 0.04, i === 5 ? 0.18 : 0.05),
    );
    for (const deg of [0, 4, 7]) bell(t, d(deg, 1), 0.5, 0.05, 1.4);
    t.tone({ wave: "sine", freq: 7800, dur: 0.6, gain: 0.004, release: 0.3 });
    t.noise({ at: 0.45, dur: 0.3, gain: 0.018, filter: "highpass", freq: 6000, release: 0.3 });
  },

  // ── Building & devices ─────────────────────────────────────────
  build_stage: (t) => {
    // Clamp, ratchet, torque, confirm.
    t.noise({ dur: 0.08, gain: 0.3, filter: "bandpass", freq: vary(t, 1600), q: 2 });
    t.tone({ wave: "sine", freq: vary(t, 120), freqEnd: 70, dur: 0.12, gain: 0.14 });
    const clicks = 5 + variant(t, 3);
    for (let i = 0; i < clicks; i++) {
      t.noise({
        at: 0.12 + i * 0.042,
        dur: 0.012,
        gain: 0.18,
        filter: "bandpass",
        freq: vary(t, 3800, 0.1),
        q: 4,
      });
      t.tone({
        wave: "square",
        freq: vary(t, 900 + i * 40, 0.05),
        at: 0.12 + i * 0.042,
        dur: 0.006,
        gain: 0.012,
      });
    }
    const end = 0.14 + clicks * 0.042;
    t.tone({
      wave: "sawtooth",
      freq: 90,
      freqEnd: 160,
      at: end,
      dur: 0.25,
      gain: 0.05,
      attack: 0.03,
      filter: { type: "lowpass", freq: 700 },
    });
    t.noise({ at: end + 0.26, dur: 0.1, gain: 0.3, filter: "lowpass", freq: 700 });
    blip(t, d(4, 0), end + 0.32, 0.05);
    blip(t, d(7, 0), end + 0.4, 0.05, 0.08);
  },
  device_on: (t) => {
    // Relay, capacitor whine rising, transformer hum settling, ready chord.
    const v = variant(t, 3);
    relay(t, 0);
    t.tone({
      wave: "sine",
      freq: vary(t, 300),
      freqEnd: vary(t, [2400, 2800, 2100][v]!),
      at: 0.03,
      dur: 0.7,
      gain: 0.025,
      attack: 0.1,
      release: 0.2,
    });
    t.tone({
      wave: "sawtooth",
      freq: 50,
      freqEnd: [100, 110, 98][v]!,
      at: 0.05,
      dur: 0.9,
      gain: 0.08,
      attack: 0.3,
      release: 0.5,
      filter: { type: "lowpass", freq: 420, freqEnd: 700 },
    });
    t.tone({
      wave: "sine",
      freq: 100,
      freqEnd: [200, 220, 196][v]!,
      at: 0.05,
      dur: 0.9,
      gain: 0.09,
      attack: 0.3,
      release: 0.4,
    });
    blip(t, d(0, 1), 0.85, 0.04, 0.05);
    blip(t, d(4, 1), 0.93, 0.04, 0.05);
    bell(t, d(7, 1), 1.01, 0.04, 0.7);
  },
  device_off: (t) => {
    // Hum drops, a descending two-tone, relay opens.
    t.tone({
      wave: "sawtooth",
      freq: 110,
      freqEnd: 38,
      dur: 0.8,
      gain: 0.08,
      release: 0.15,
      filter: { type: "lowpass", freq: 520, freqEnd: 200 },
    });
    t.tone({ wave: "sine", freq: 220, freqEnd: 55, dur: 0.8, gain: 0.08, release: 0.15 });
    blip(t, d(4, 1), 0.05, 0.035);
    blip(t, d(0, 1), 0.13, 0.035);
    relay(t, 0.8, 0.8);
  },
  power_up_cascade: (t) => {
    // Breakers slamming in one after another, each a step higher, then the grid sings.
    for (let i = 0; i < 6; i++) {
      const at = i * 0.17;
      relay(t, at, 1.2);
      t.noise({ at, dur: 0.12, gain: 0.3, filter: "lowpass", freq: 300 });
      t.tone({ wave: "sine", freq: 60 * (1 + i * 0.25), at, dur: 0.28, gain: 0.14 });
      blip(t, d(i, 0), at + 0.04, 0.025);
    }
    t.tone({
      wave: "sawtooth",
      freq: 55,
      at: 1.05,
      dur: 1.6,
      gain: 0.07,
      attack: 0.4,
      release: 0.8,
      filter: { type: "lowpass", freq: 380, freqEnd: 900 },
    });
    t.tone({ wave: "sine", freq: 110, at: 1.05, dur: 1.6, gain: 0.09, attack: 0.4, release: 0.8 });
    for (const deg of [0, 4, 7, 11]) bell(t, d(deg, 0), 1.3, 0.035, 1.6);
  },
  brownout: (t) => {
    t.tone({
      wave: "sawtooth",
      freq: 110,
      freqEnd: 30,
      dur: 1.2,
      gain: 0.12,
      vibrato: { rate: 7, depth: 9 },
      filter: { type: "lowpass", freq: 600, freqEnd: 150 },
    });
    t.noise({ dur: 0.6, gain: 0.16, filter: "lowpass", freq: 220 });
    // A falling chip warning, detuned.
    blip(t, d(7, 0), 0.05, 0.04, 0.12);
    blip(t, d(3, 0), 0.2, 0.04, 0.2);
    for (let i = 0; i < 3; i++)
      t.noise({ at: 0.2 + t.rand() * 0.8, dur: 0.02, gain: 0.26, filter: "highpass", freq: 4000 });
  },

  // ── Workbench ──────────────────────────────────────────────────
  combine: (t) => {
    // Two parts meet: counter-sweeps, a snap, a question-mark chime.
    t.tone({ wave: "sine", freq: 440, freqEnd: 880, dur: 0.22, gain: 0.08 });
    t.tone({ wave: "sine", freq: 990, freqEnd: 495, dur: 0.22, gain: 0.07 });
    t.noise({ dur: 0.26, gain: 0.07, filter: "bandpass", freq: 3000, freqEnd: 800, q: 2 });
    t.noise({ at: 0.23, dur: 0.02, gain: 0.2, filter: "bandpass", freq: 2200, q: 3 });
    pluck(t, d(4, 1), 0.25, 0.08, 0.4);
    pluck(t, d(3, 1), 0.33, 0.06, 0.4);
  },
  prototype: (t) => {
    // Something new exists: glitter, a rising ramp, a proud bell.
    for (let i = 0; i < 9; i++) bell(t, d(Math.floor(between(t, 7, 18)), 0), i * 0.04, 0.03, 0.3);
    t.tone({ wave: "triangle", freq: 440, freqEnd: 1318, dur: 0.45, gain: 0.07, release: 0.2 });
    for (const deg of [0, 4, 7]) bell(t, d(deg, 1), 0.46, 0.06, 1.3);
    t.noise({ dur: 0.6, gain: 0.03, filter: "highpass", freq: 8000, release: 0.3 });
  },
  explosion: (t) => {
    t.noise({
      dur: 1.1,
      gain: 0.85,
      filter: "lowpass",
      freq: 3200,
      freqEnd: 160,
      attack: 0.004,
      release: 0.6,
    });
    t.tone({ wave: "sine", freq: 85, freqEnd: 26, dur: 0.9, gain: 0.85, attack: 0.004 });
    t.noise({ dur: 0.2, gain: 0.28, filter: "highpass", freq: 4200 });
    for (let i = 0; i < 7; i++)
      t.noise({
        at: 0.15 + t.rand() * 1.1,
        dur: 0.02,
        gain: 0.16,
        filter: "bandpass",
        freq: between(t, 1500, 5000),
        q: 2,
      });
    // Ringing ears.
    t.tone({ wave: "sine", freq: 3950, at: 0.2, dur: 1.4, gain: 0.006, attack: 0.3, release: 0.8 });
  },

  // ── Puzzles & failures ─────────────────────────────────────────
  puzzle_open: (t) => {
    t.tone({
      wave: "triangle",
      freq: mtof(d(0, 0)),
      freqEnd: mtof(d(7, 0)),
      dur: 0.16,
      gain: 0.08,
    });
    blip(t, d(4, 1), 0.12, 0.04);
    t.noise({ dur: 0.18, gain: 0.03, filter: "bandpass", freq: 1500, freqEnd: 5000, q: 2 });
  },
  fail_buzz: (t) => {
    // Softer "nope": two short falling chip tones and a low thud — clear, not grating.
    blip(t, 58, 0, 0.045, 0.09);
    blip(t, 55, 0.12, 0.045, 0.14);
    t.tone({ wave: "sine", freq: 110, freqEnd: 80, dur: 0.18, gain: 0.06 });
  },
  keypad_beep: (t) => {
    // DTMF-ish: two sine partials, a hair of key click.
    const v = variant(t, 4);
    const lo = [697, 770, 852, 941][v]!;
    const hi = [1209, 1336, 1477, 1336][v]!;
    t.tone({ wave: "sine", freq: lo, dur: 0.07, gain: 0.05, attack: 0.002 });
    t.tone({ wave: "sine", freq: hi, dur: 0.07, gain: 0.04, attack: 0.002 });
    t.noise({ dur: 0.006, gain: 0.04, filter: "bandpass", freq: 3000, q: 3 });
  },

  // ── Interface (tuned, soft) ────────────────────────────────────
  ui_click: (t) => {
    const v = variant(t, 3);
    t.tone({
      wave: "sine",
      freq: mtof([86, 88, 83][v]!),
      freqEnd: mtof([81, 83, 79][v]!),
      dur: 0.02,
      gain: 0.05,
      attack: 0.001,
    });
    t.noise({ dur: 0.006, gain: 0.03, filter: "bandpass", freq: 4200, q: 3 });
  },
  ui_hover: (t) =>
    t.tone({
      wave: "sine",
      freq: mtof(d(7, 1) + 12),
      dur: 0.015,
      gain: 0.018,
      attack: 0.002,
      release: 0.03,
    }),
  ui_open: (t) => {
    pluck(t, d(0, 1), 0, 0.05, 0.2);
    pluck(t, d(4, 1), 0.05, 0.05, 0.25);
    t.noise({ dur: 0.08, gain: 0.02, filter: "bandpass", freq: 2000, freqEnd: 5000 });
  },
  ui_close: (t) => {
    pluck(t, d(4, 1), 0, 0.045, 0.18);
    pluck(t, d(0, 1), 0.05, 0.045, 0.2);
    t.noise({ dur: 0.08, gain: 0.02, filter: "bandpass", freq: 5000, freqEnd: 2000 });
  },
  toast: (t) => {
    bell(t, d(4, 1), 0, 0.05, 0.4);
    bell(t, d(7, 1), 0.07, 0.05, 0.5);
  },
  hint_pop: (t) => {
    const v = variant(t, 3);
    pluck(t, d([3, 4, 6][v]!, 1), 0, 0.06, 0.25);
    bell(t, d([7, 7, 9][v]!, 1), 0.06, 0.035, 0.4);
  },
  mcp_blip: (t) => {
    const v = variant(t, 3);
    blip(t, [69, 71, 74][v]!, 0, 0.035, 0.04);
  },

  // ── New cues (round 6) ─────────────────────────────────────────
  studio_on: (t) => {
    // The studio wakes: tape motor, a warm chord, speaker thump.
    t.tone({
      wave: "sawtooth",
      freq: 30,
      freqEnd: 90,
      dur: 0.6,
      gain: 0.04,
      attack: 0.2,
      filter: { type: "lowpass", freq: 300 },
    });
    t.tone({ wave: "sine", freq: 50, freqEnd: 40, at: 0.55, dur: 0.12, gain: 0.2 });
    for (const [deg, at] of [
      [0, 0.6],
      [4, 0.66],
      [7, 0.72],
      [11, 0.78],
      [14, 0.84],
    ] as const)
      pluck(t, d(deg, 0), at, 0.07, 0.9);
    t.noise({
      at: 0.6,
      dur: 1,
      gain: 0.012,
      filter: "highpass",
      freq: 6000,
      attack: 0.2,
      release: 0.5,
    });
  },
  tape_stop: (t) => {
    // Reel-to-reel brake: the tone sinks and stops.
    t.tone({
      wave: "triangle",
      freq: mtof(d(4, 1)),
      freqEnd: 60,
      dur: 0.6,
      gain: 0.06,
      release: 0.05,
    });
    t.noise({
      dur: 0.6,
      gain: 0.03,
      filter: "bandpass",
      freq: 1200,
      freqEnd: 200,
      q: 1.5,
      release: 0.05,
    });
    relay(t, 0.62, 0.7);
  },
  record_start: (t) => {
    blip(t, d(0, 1), 0, 0.04, 0.05);
    blip(t, d(0, 1), 0.25, 0.04, 0.05);
    blip(t, d(0, 1), 0.5, 0.04, 0.05);
    blip(t, d(0, 2), 0.75, 0.05, 0.14);
  },
  switch_click: (t) => {
    const v = variant(t, 3);
    t.noise({
      dur: 0.01,
      gain: 0.14,
      filter: "bandpass",
      freq: vary(t, [2200, 2600, 1900][v]!),
      q: 4,
    });
    t.tone({ wave: "sine", freq: vary(t, 180), freqEnd: 120, dur: 0.03, gain: 0.05 });
  },

  // ── Round 7: the wardrobe replicator "Needle's Eye" ──
  sew_rattle: (t) => {
    // A sewing needle hammering: ~1.2 s of fast metallic ticks (12–16 Hz,
    // accelerating a little) over a small motor whirr, the fabric feed
    // rustling underneath.
    const rate = between(t, 12, 16);
    const n = Math.round(rate * 1.2);
    let at = 0.02;
    for (let i = 0; i < n; i++) {
      const up = i % 2 === 1;
      t.noise({
        at,
        dur: 0.006,
        gain: (up ? 0.07 : 0.12) * between(t, 0.8, 1.1),
        filter: "bandpass",
        freq: vary(t, up ? 5200 : 3600, 0.08),
        q: 6,
        release: 0.02,
      });
      if (!up)
        t.tone({
          wave: "triangle",
          freq: vary(t, 1700, 0.05),
          at,
          dur: 0.004,
          gain: 0.012,
          release: 0.03,
        });
      at += (1 / rate) * (1 - (i / n) * 0.15);
    }
    t.tone({
      wave: "sawtooth",
      freq: vary(t, 95, 0.05),
      freqEnd: 110,
      at: 0,
      dur: 1.15,
      gain: 0.018,
      attack: 0.08,
      release: 0.12,
      filter: { type: "lowpass", freq: 600, q: 1.5 },
    });
    t.noise({
      at: 0.05,
      dur: 1.1,
      gain: 0.03,
      filter: "bandpass",
      freq: vary(t, 2400, 0.15),
      q: 0.8,
      attack: 0.1,
      release: 0.1,
    });
  },
  replicator_ping: (t) => {
    // Finished: the needle stops (a last clack), then a bright two-note bell ping.
    t.noise({ dur: 0.008, gain: 0.14, filter: "bandpass", freq: vary(t, 3600), q: 5 });
    t.tone({ wave: "sine", freq: vary(t, 160), freqEnd: 90, dur: 0.05, gain: 0.05 });
    const v = variant(t, 2);
    bell(t, d(v ? 4 : 2, 1), 0.12, 0.12, 1.1);
    bell(t, d(v ? 7 : 7, 1), 0.26, 0.14, 1.6);
    sparkle(t, 0.3, 3, 0.05);
  },
} satisfies Record<string, Recipe>;

/** Names added in round 6 (the rest override existing recipes). */
export const SFX_V2_NEW = [
  "secret",
  "studio_on",
  "tape_stop",
  "record_start",
  "switch_click",
  // round 7
  "sew_rattle",
  "replicator_ping",
] as const;

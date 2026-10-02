/**
 * Sound effect recipes — fully procedural, no audio files.
 * ========================================================
 *
 * Each recipe writes tones / noise bursts into a `SynthTarget`. Pitch and
 * gain scaling, spatialisation and bus routing happen in the engine.
 */
import type { SynthTarget } from "@/lib/world/audio/synth";
import type { RoomTheme } from "@/lib/world/types";
import { SFX_V2 } from "@/lib/world/audio/sfx-v2";

export const SFX_NAMES = [
  "footstep",
  "pickup",
  "item_rare",
  "build_stage",
  "device_on",
  "device_off",
  "power_up_cascade",
  "brownout",
  "combine",
  "prototype",
  "explosion",
  "puzzle_open",
  "puzzle_solved",
  "fail_buzz",
  "door_open",
  "door_locked",
  "elevator",
  "keypad_beep",
  "note_paper",
  "tape_play",
  "ui_click",
  "ui_hover",
  "ui_open",
  "ui_close",
  "toast",
  "insight",
  "blueprint",
  "mcp_blip",
  "echo_whisper",
  "teleport",
  "rift",
  "anomaly_zap",
  "drone",
  "alarm",
  "handshake_tone",
  // ── round 4 ──
  "steam_hiss",
  "drip",
  "rumble",
  "hum_surge",
  "lamp_buzz",
  "spark_crackle",
  "pa_chime",
  "door_slide",
  "door_close",
  "elevator_start",
  "elevator_stop",
  "gate_rattle",
  "coffee_brew",
  "radio_tune",
  "page_turn",
  "sit",
  "buff_on",
  "achievement",
  "hint_pop",
  "typewriter_tick",
  "scan_sweep",
  "drone_fly",
  // ── round 5: Foley for animations + electrical detail ──
  "mug_clink",
  "chair_creak",
  "typing",
  "elevator_cable",
  "door_hiss",
  // ── doors round: locking mechanisms + airlock (docs/DOORS.md) ──
  "latch_bolt",
  "latch_wheel",
  "latch_magnet",
  "airlock_steam",
  "airlock_extract",
  "brownout_crackle",
  // ── round 6: overhaul + studio ──
  "secret",
  "studio_on",
  "tape_stop",
  "record_start",
  "switch_click",
  // ── round 7: wardrobe replicator ──
  "sew_rattle",
  "replicator_ping",
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

/**
 * Floor surfaces for footsteps. The first six come from the room theme
 * (`surfaceForTheme`); the rest are cryo / cavern floors and spots found
 * under the player (puddles, broken glass, rubber mats, rubble, cables,
 * paper — see audio/surfaces.ts).
 */
export const SURFACES = [
  "metal",
  "grate",
  "concrete",
  "tile",
  "carpet",
  "wood",
  "water",
  "glass",
  "rubber",
  "gravel",
  "ice",
  "cable",
  "paper",
] as const;
export type Surface = (typeof SURFACES)[number];

export type BusName = "master" | "music" | "sfx" | "ambience" | "ui" | "voice";

export interface SfxParams {
  surface?: Surface;
}

/** Which bus each effect is routed through (default: sfx). */
export const SFX_BUS: Partial<Record<SfxName, BusName>> = {
  ui_click: "ui",
  ui_hover: "ui",
  ui_open: "ui",
  ui_close: "ui",
  toast: "ui",
  keypad_beep: "ui",
  mcp_blip: "voice",
  echo_whisper: "voice",
  pa_chime: "voice",
  achievement: "ui",
  hint_pop: "ui",
  typewriter_tick: "ui",
  switch_click: "ui",
};

/** Floor surface per room theme (for footsteps). */
export function surfaceForTheme(theme: RoomTheme | undefined): Surface {
  switch (theme) {
    case "server":
    case "power":
    case "cooling":
    case "reactor":
    case "containment":
    case "elevator":
    case "botdepot":
      return "grate";
    case "factory":
    case "hangar":
    case "forge":
    case "geothermal":
    case "storage":
      return "concrete";
    case "cryo":
      return "ice";
    case "greenhouse":
      return "gravel";
    case "lab":
    case "portal":
    case "anomaly":
    case "airlock":
      return "tile";
    case "office":
    case "quarters":
    case "audio":
      return "carpet";
    case "archive":
    case "observatory":
      return "wood";
    default:
      return "metal";
  }
}

type Recipe = (t: SynthTarget, p: SfxParams) => void;

const vary = (t: SynthTarget, v: number, amount = 0.08): number =>
  v * (1 + (t.rand() - 0.5) * 2 * amount);

/**
 * Pick one of `n` variants. Newer recipes call this first so that repeated
 * triggers (doors, drips, steam) never sound identical — combined with the
 * `vary()` jitter below it keeps repetition fatigue down.
 */
const variant = (t: SynthTarget, n: number): number => Math.min(n - 1, Math.floor(t.rand() * n));

/** Random value in [lo, hi). */
const between = (t: SynthTarget, lo: number, hi: number): number => lo + t.rand() * (hi - lo);

/** Per-surface loudness for footsteps (carpet is soft, grating rings). */
export const FOOTSTEP_GAIN: Record<Surface, number> = {
  metal: 0.55,
  grate: 0.6,
  concrete: 0.5,
  tile: 0.5,
  carpet: 0.35,
  wood: 0.5,
  water: 0.55,
  glass: 0.5,
  rubber: 0.4,
  gravel: 0.5,
  ice: 0.45,
  cable: 0.42,
  paper: 0.4,
};

/** Hollow metal clunk (door ends, elevator brakes, gate latches). */
function clunk(t: SynthTarget, at: number, weight: number): void {
  t.noise({ at, dur: 0.07, gain: 0.34 * weight, filter: "lowpass", freq: vary(t, 380, 0.2) });
  t.tone({
    wave: "sine",
    freq: vary(t, 92, 0.12),
    freqEnd: 52,
    at,
    dur: 0.12,
    gain: 0.2 * weight,
  });
  t.tone({
    wave: "triangle",
    freq: vary(t, 610, 0.2),
    at: at + 0.005,
    dur: 0.05,
    gain: 0.025 * weight,
    release: 0.15,
  });
}

/** Servo whirr: a filtered saw with motor wobble plus mechanical rasp. */
function whirr(t: SynthTarget, at: number, dur: number, from: number, to: number): void {
  t.tone({
    wave: "sawtooth",
    freq: from,
    freqEnd: to,
    at,
    dur,
    gain: 0.045,
    attack: 0.05,
    release: 0.08,
    vibrato: { rate: vary(t, 38, 0.2), depth: 4 },
    filter: { type: "lowpass", freq: vary(t, 1300, 0.2), q: 2 },
  });
  t.noise({
    at,
    dur,
    gain: 0.07,
    filter: "bandpass",
    freq: from * 5,
    freqEnd: to * 5,
    q: 3,
    attack: 0.05,
    release: 0.08,
  });
}

/** Round-4 recipes (ambient events, doors, decor, UI feedback). */
const ROUND4_SFX = {
  steam_hiss: (t) => {
    const v = variant(t, 3);
    const dur = [0.9, 1.4, 0.6][v]! * vary(t, 1, 0.15);
    // Valve tick, then the pressurised jet that softens as it empties.
    t.noise({ dur: 0.02, gain: 0.18, filter: "bandpass", freq: vary(t, 2400), q: 4 });
    t.noise({
      at: 0.02,
      dur,
      gain: [0.22, 0.18, 0.26][v]!,
      filter: "highpass",
      freq: vary(t, [3200, 4400, 2600][v]!, 0.12),
      freqEnd: vary(t, 1800, 0.15),
      attack: 0.04,
      release: dur * 0.5,
    });
    t.noise({
      at: 0.02,
      dur: dur * 0.8,
      gain: 0.06,
      filter: "bandpass",
      freq: vary(t, 900, 0.2),
      q: 1.5,
      attack: 0.1,
      release: 0.3,
    });
    if (v === 1) {
      // Sputtering tail.
      for (let i = 0; i < 3; i++) {
        t.noise({
          at: dur + 0.1 + i * between(t, 0.08, 0.16),
          dur: 0.06,
          gain: 0.08,
          filter: "highpass",
          freq: vary(t, 3000),
        });
      }
    }
  },
  drip: (t) => {
    const v = variant(t, 3);
    const f0 = vary(t, [1500, 1900, 1150][v]!, 0.18);
    t.tone({ wave: "sine", freq: f0, freqEnd: f0 * 0.5, dur: 0.06, gain: 0.14, attack: 0.002 });
    t.noise({ dur: 0.012, gain: 0.05, filter: "highpass", freq: 5000 });
    // A quieter echo off the walls (cave / shaft feel on variant 2).
    const echo = v === 2 ? 0.22 : 0.14;
    t.tone({
      wave: "sine",
      freq: f0 * 0.98,
      freqEnd: f0 * 0.5,
      at: echo,
      dur: 0.06,
      gain: v === 2 ? 0.06 : 0.03,
      attack: 0.002,
    });
    if (v === 1) {
      t.tone({
        wave: "sine",
        freq: f0 * 1.2,
        freqEnd: f0 * 0.6,
        at: between(t, 0.35, 0.6),
        dur: 0.05,
        gain: 0.08,
        attack: 0.002,
      });
    }
  },
  rumble: (t) => {
    const v = variant(t, 3);
    const dur = [2.2, 1.6, 2.6][v]!;
    t.noise({
      dur,
      gain: 0.5,
      filter: "lowpass",
      freq: vary(t, [110, 150, 80][v]!, 0.15),
      freqEnd: 60,
      attack: 0.4,
      release: 0.9,
    });
    t.tone({
      wave: "sine",
      freq: vary(t, 36, 0.1),
      freqEnd: 28,
      dur,
      gain: 0.3,
      attack: 0.5,
      release: 0.8,
      vibrato: { rate: vary(t, 5, 0.3), depth: 2 },
    });
    // Debris settling somewhere above.
    const debris = [4, 2, 6][v]!;
    for (let i = 0; i < debris; i++) {
      t.noise({
        at: between(t, 0.4, dur),
        dur: 0.025,
        gain: 0.08,
        filter: "bandpass",
        freq: between(t, 1500, 4000),
        q: 3,
      });
    }
  },
  hum_surge: (t) => {
    const v = variant(t, 3);
    const base = vary(t, [50, 60, 45][v]!, 0.04);
    t.tone({
      wave: "sawtooth",
      freq: base,
      freqEnd: base * [1.5, 1.33, 1.8][v]!,
      dur: 0.9,
      gain: 0.1,
      attack: 0.35,
      release: 0.6,
      filter: { type: "lowpass", freq: vary(t, 520, 0.2), q: 3 },
    });
    t.tone({
      wave: "sine",
      freq: base * 2,
      freqEnd: base * 3,
      dur: 0.9,
      gain: 0.1,
      attack: 0.35,
      release: 0.6,
    });
    t.noise({
      at: 0.5,
      dur: 0.3,
      gain: 0.04,
      filter: "bandpass",
      freq: vary(t, 3000, 0.3),
      q: 2,
      release: 0.2,
    });
  },
  lamp_buzz: (t) => {
    const v = variant(t, 3);
    const bursts = [4, 6, 3][v]!;
    let at = 0;
    for (let i = 0; i < bursts; i++) {
      const len = between(t, 0.03, 0.14);
      t.tone({
        wave: "square",
        freq: vary(t, 120, 0.03),
        at,
        dur: len,
        gain: 0.035,
        attack: 0.002,
        release: 0.01,
        filter: { type: "bandpass", freq: vary(t, 1100, 0.25), q: 3 },
      });
      t.noise({ at, dur: 0.008, gain: 0.08, filter: "highpass", freq: vary(t, 4500, 0.2) });
      at += len + between(t, 0.03, 0.18);
    }
  },
  spark_crackle: (t) => {
    const v = variant(t, 3);
    const n = [8, 12, 5][v]!;
    for (let i = 0; i < n; i++) {
      t.noise({
        at: Math.pow(t.rand(), 1.6) * [0.5, 0.7, 0.3][v]!,
        dur: between(t, 0.004, 0.02),
        gain: between(t, 0.1, 0.28),
        filter: "highpass",
        freq: between(t, 3000, 7500),
      });
    }
    t.tone({
      wave: "square",
      freq: vary(t, 2400, 0.25),
      freqEnd: 300,
      dur: 0.06,
      gain: 0.04,
    });
  },
  pa_chime: (t) => {
    // Classic two/three-tone tannoy ding-dong with bell partials.
    const v = variant(t, 3);
    const notes = [
      [659.3, 523.3],
      [784, 659.3, 523.3],
      [587.3, 440, 587.3],
    ][v]!;
    const d = vary(t, 1, 0.015);
    notes.forEach((f, i) => {
      const at = i * 0.42;
      t.tone({ wave: "sine", freq: f * d, at, dur: 0.5, gain: 0.12, attack: 0.004, release: 0.7 });
      t.tone({ wave: "sine", freq: f * d * 2.76, at, dur: 0.12, gain: 0.02, release: 0.2 });
      t.tone({ wave: "triangle", freq: f * d * 2, at, dur: 0.3, gain: 0.025, release: 0.4 });
    });
  },
  door_slide: (t) => {
    const v = variant(t, 3);
    const dur = [0.55, 0.45, 0.65][v]! * vary(t, 1, 0.08);
    t.noise({ dur: 0.03, gain: 0.12, filter: "highpass", freq: 3500 });
    whirr(t, 0.02, dur, vary(t, [170, 200, 150][v]!), vary(t, 250, 0.1));
    t.noise({
      at: 0.02,
      dur,
      gain: 0.07,
      filter: "bandpass",
      freq: 5200,
      freqEnd: 2400,
      q: 0.8,
      attack: 0.08,
      release: 0.1,
    });
    clunk(t, dur + 0.04, 0.8);
  },
  door_close: (t) => {
    const v = variant(t, 3);
    const dur = [0.5, 0.6, 0.42][v]! * vary(t, 1, 0.08);
    whirr(t, 0, dur, vary(t, 250, 0.1), vary(t, [160, 140, 180][v]!));
    clunk(t, dur + 0.02, 1.1);
    // Latch.
    t.noise({
      at: dur + 0.11,
      dur: 0.015,
      gain: 0.15,
      filter: "bandpass",
      freq: vary(t, 2800, 0.15),
      q: 5,
    });
  },
  elevator_start: (t) => {
    const v = variant(t, 3);
    clunk(t, 0, 1);
    t.tone({
      wave: "sawtooth",
      freq: vary(t, 38, 0.1),
      freqEnd: vary(t, [70, 64, 78][v]!, 0.05),
      at: 0.1,
      dur: 1.3,
      gain: 0.12,
      attack: 0.4,
      release: 0.4,
      vibrato: { rate: 2, depth: 2 },
      filter: { type: "lowpass", freq: 320 },
    });
    t.noise({
      at: 0.1,
      dur: 1.3,
      gain: 0.08,
      filter: "lowpass",
      freq: 300,
      freqEnd: 520,
      attack: 0.5,
      release: 0.4,
    });
    // Cable creak.
    t.tone({
      wave: "triangle",
      freq: vary(t, 520, 0.2),
      freqEnd: vary(t, 470, 0.2),
      at: 0.25,
      dur: 0.3,
      gain: 0.015,
      vibrato: { rate: 13, depth: 8 },
    });
  },
  elevator_stop: (t) => {
    const v = variant(t, 3);
    t.tone({
      wave: "sawtooth",
      freq: vary(t, 70, 0.05),
      freqEnd: 34,
      dur: 0.9,
      gain: 0.11,
      release: 0.2,
      filter: { type: "lowpass", freq: 300 },
    });
    // Brake squeal.
    t.tone({
      wave: "sine",
      freq: vary(t, [1900, 2300, 1650][v]!, 0.05),
      freqEnd: vary(t, 1700, 0.05),
      at: 0.4,
      dur: 0.35,
      gain: 0.018,
      vibrato: { rate: 23, depth: 12 },
    });
    clunk(t, 0.85, 1.2);
    // Arrival ding.
    const ding = [1318.5, 1174.7, 1568][v]!;
    t.tone({ wave: "sine", freq: ding, at: 1.1, dur: 0.6, gain: 0.08, release: 0.5 });
    t.tone({ wave: "sine", freq: ding * 2.76, at: 1.1, dur: 0.1, gain: 0.01, release: 0.2 });
  },
  gate_rattle: (t) => {
    const v = variant(t, 3);
    const hits = [9, 13, 6][v]!;
    for (let i = 0; i < hits; i++) {
      const at = (i / hits) * 0.6 + between(t, 0, 0.03);
      t.noise({
        at,
        dur: 0.03,
        gain: between(t, 0.1, 0.24),
        filter: "bandpass",
        freq: between(t, 1500, 3600),
        q: 7,
        release: 0.05,
      });
    }
    t.tone({ wave: "square", freq: vary(t, 90), dur: 0.6, gain: 0.02, release: 0.1 });
    clunk(t, 0.62, 0.6);
  },
  coffee_brew: (t) => {
    const v = variant(t, 3);
    const len = [2.4, 2.8, 2][v]!;
    // Pump hum.
    t.tone({
      wave: "sawtooth",
      freq: vary(t, 100, 0.05),
      dur: len,
      gain: 0.025,
      attack: 0.1,
      release: 0.2,
      filter: { type: "lowpass", freq: 400 },
    });
    // Hot water hiss.
    t.noise({
      at: 0.3,
      dur: len - 0.3,
      gain: 0.05,
      filter: "bandpass",
      freq: vary(t, 3000, 0.2),
      q: 1,
      attack: 0.3,
      release: 0.4,
    });
    // Gurgles.
    const bubbles = [10, 14, 8][v]!;
    for (let i = 0; i < bubbles; i++) {
      const f = between(t, 220, 620);
      t.tone({
        wave: "sine",
        freq: f,
        freqEnd: f * 1.6,
        at: between(t, 0.5, len),
        dur: 0.04,
        gain: 0.05,
        attack: 0.003,
      });
    }
  },
  radio_tune: (t) => {
    const v = variant(t, 3);
    const up = v !== 1;
    const lo = vary(t, 500, 0.2);
    const hi = vary(t, 3200, 0.2);
    t.noise({
      dur: 1.4,
      gain: 0.12,
      filter: "bandpass",
      freq: up ? lo : hi,
      freqEnd: up ? hi : lo,
      q: 3,
      attack: 0.05,
      release: 0.2,
    });
    // Heterodyne whistles passing stations.
    for (let i = 0; i < 2; i++) {
      const f = between(t, 700, 2200);
      t.tone({
        wave: "sine",
        freq: f,
        freqEnd: f * (up ? 0.4 : 2.2),
        at: 0.2 + i * 0.45,
        dur: 0.3,
        gain: 0.025,
      });
    }
    if (v === 2) {
      // Locks onto a faint station.
      t.tone({
        wave: "triangle",
        freq: vary(t, 392, 0.05),
        at: 1.35,
        dur: 0.6,
        gain: 0.03,
        vibrato: { rate: 5, depth: 6 },
        filter: { type: "bandpass", freq: 1200, q: 1.5 },
      });
    }
  },
  page_turn: (t) => {
    const v = variant(t, 3);
    const dur = [0.18, 0.25, 0.14][v]!;
    t.noise({
      dur,
      gain: 0.14,
      filter: "bandpass",
      freq: vary(t, 3200, 0.2),
      freqEnd: vary(t, 1300, 0.2),
      q: 1.2,
      attack: 0.03,
    });
    t.noise({
      at: dur * 0.85,
      dur: 0.05,
      gain: 0.1,
      filter: "lowpass",
      freq: vary(t, 1500, 0.2),
    });
  },
  sit: (t) => {
    const v = variant(t, 3);
    t.noise({ dur: 0.1, gain: 0.3, filter: "lowpass", freq: vary(t, 320, 0.2), attack: 0.01 });
    t.tone({ wave: "sine", freq: vary(t, 80, 0.1), freqEnd: 55, dur: 0.1, gain: 0.12 });
    if (v !== 2) {
      // Chair creak.
      t.tone({
        wave: "sawtooth",
        freq: vary(t, [210, 170][v]!, 0.12),
        freqEnd: vary(t, 160, 0.12),
        at: 0.12,
        dur: 0.22,
        gain: 0.012,
        vibrato: { rate: vary(t, 18, 0.3), depth: 10 },
        filter: { type: "bandpass", freq: 900, q: 4 },
      });
    }
  },
  buff_on: (t) => {
    const v = variant(t, 3);
    const root = [523.3, 587.3, 493.9][v]!;
    [1, 1.26, 1.5].forEach((r, i) => {
      t.tone({
        wave: "triangle",
        freq: root * r,
        at: i * 0.06,
        dur: 0.2,
        gain: 0.07,
        release: 0.25,
      });
    });
    t.noise({
      dur: 0.5,
      gain: 0.03,
      filter: "bandpass",
      freq: vary(t, 2000, 0.2),
      freqEnd: 7000,
      q: 2,
      attack: 0.1,
    });
  },

  typewriter_tick: (t) => {
    const v = variant(t, 3);
    t.noise({
      dur: 0.008,
      gain: 0.035,
      filter: "bandpass",
      freq: vary(t, [3800, 4400, 3300][v]!, 0.1),
      q: 3,
    });
    t.tone({ wave: "square", freq: vary(t, 1600, 0.15), dur: 0.006, gain: 0.006 });
  },
  scan_sweep: (t) => {
    const v = variant(t, 3);
    const lo = vary(t, [380, 440, 330][v]!, 0.05);
    t.tone({ wave: "sine", freq: lo, freqEnd: lo * 4, dur: 0.7, gain: 0.07, release: 0.1 });
    t.tone({
      wave: "triangle",
      freq: lo * 1.5,
      freqEnd: lo * 6,
      dur: 0.7,
      gain: 0.02,
      release: 0.1,
    });
    t.noise({
      dur: 0.7,
      gain: 0.04,
      filter: "bandpass",
      freq: 800,
      freqEnd: 6000,
      q: 5,
      release: 0.1,
    });
    t.tone({ wave: "square", freq: 1760, at: 0.75, dur: 0.03, gain: 0.03 });
    if (v === 1) t.tone({ wave: "square", freq: 2093, at: 0.82, dur: 0.03, gain: 0.03 });
  },
  drone_fly: (t) => {
    const v = variant(t, 3);
    const f = vary(t, [190, 220, 170][v]!, 0.05);
    const dop = [0.88, 0.92, 1.08][v]!;
    for (const [mul, g] of [
      [1, 0.045],
      [1.018, 0.035],
    ] as const) {
      t.tone({
        wave: "sawtooth",
        freq: f * mul,
        freqEnd: f * mul * dop,
        dur: 1.6,
        gain: g,
        attack: 0.35,
        release: 0.4,
        vibrato: { rate: vary(t, 32, 0.15), depth: 5 },
        filter: { type: "lowpass", freq: vary(t, 1500, 0.2) },
      });
    }
    t.noise({
      dur: 1.6,
      gain: 0.04,
      filter: "bandpass",
      freq: vary(t, 2200, 0.2),
      q: 1,
      attack: 0.4,
      release: 0.4,
    });
  },
} satisfies Record<string, Recipe>;

/** Round-5 Foley (decor animations, doors, elevator, electrical). */
const ROUND5_SFX = {
  mug_clink: (t) => {
    // Ceramic on ceramic / on steel desk: two short inharmonic partials.
    const v = variant(t, 3);
    const f = vary(t, [2350, 2900, 1950][v]!, 0.06);
    t.tone({ wave: "sine", freq: f, dur: 0.03, gain: 0.08, attack: 0.001, release: 0.25 });
    t.tone({ wave: "sine", freq: f * 2.76, dur: 0.02, gain: 0.03, attack: 0.001, release: 0.12 });
    t.noise({ dur: 0.008, gain: 0.06, filter: "highpass", freq: 4000 });
    if (v === 1) {
      // Set down twice (little rattle).
      t.tone({ wave: "sine", freq: f * 1.02, at: 0.07, dur: 0.02, gain: 0.04, release: 0.15 });
    }
  },
  chair_creak: (t) => {
    const v = variant(t, 3);
    const dur = [0.35, 0.5, 0.25][v]!;
    t.tone({
      wave: "sawtooth",
      freq: vary(t, [190, 240, 160][v]!, 0.12),
      freqEnd: vary(t, [150, 300, 130][v]!, 0.12),
      dur,
      gain: 0.022,
      attack: 0.04,
      vibrato: { rate: vary(t, 16, 0.3), depth: 12 },
      filter: { type: "bandpass", freq: vary(t, 950, 0.2), q: 5 },
    });
    // Gas-lift squeak / castor roll.
    t.noise({
      dur: dur * 0.8,
      gain: 0.03,
      filter: "bandpass",
      freq: vary(t, 2200, 0.2),
      q: 3,
      attack: 0.05,
    });
  },
  typing: (t) => {
    // A short burst of 4-7 keystrokes with uneven rhythm; space bar thunk.
    const n = 4 + Math.floor(t.rand() * 4);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const space = t.rand() < 0.18;
      t.noise({
        at,
        dur: space ? 0.02 : 0.01,
        gain: space ? 0.07 : 0.05,
        filter: "bandpass",
        freq: vary(t, space ? 1400 : 3200, 0.15),
        q: 2.5,
      });
      t.tone({ wave: "sine", freq: vary(t, space ? 180 : 420, 0.1), at, dur: 0.012, gain: 0.02 });
      at += between(t, 0.07, 0.16);
    }
  },
  elevator_cable: (t) => {
    // Steel cable under load: a low groan plus sheave clicks passing by.
    const v = variant(t, 3);
    const dur = [1.6, 2.2, 1.2][v]!;
    t.tone({
      wave: "sawtooth",
      freq: vary(t, 62, 0.1),
      freqEnd: vary(t, 70, 0.1),
      dur,
      gain: 0.035,
      attack: 0.3,
      release: 0.4,
      vibrato: { rate: vary(t, 5, 0.3), depth: 2 },
      filter: { type: "lowpass", freq: 380, q: 3 },
    });
    t.noise({
      dur,
      gain: 0.04,
      filter: "bandpass",
      freq: vary(t, 1600, 0.2),
      q: 6,
      attack: 0.3,
      release: 0.4,
    });
    const clicks = [4, 6, 3][v]!;
    for (let i = 0; i < clicks; i++) {
      t.noise({
        at: (i + 0.5) * (dur / clicks),
        dur: 0.015,
        gain: 0.07,
        filter: "bandpass",
        freq: vary(t, 2600, 0.1),
        q: 4,
      });
    }
  },
  latch_bolt: (t) => {
    // Steel bolts / pins / clamps: a short slide, then a heavy seat.
    const v = variant(t, 3);
    t.noise({
      dur: 0.09,
      gain: 0.08,
      filter: "bandpass",
      freq: vary(t, [2600, 1900, 3200][v]!, 0.1),
      q: 1.2,
    });
    clunk(t, 0.08, [0.9, 1.2, 0.7][v]!);
    t.tone({
      wave: "square",
      freq: vary(t, 140, 0.1),
      at: 0.08,
      dur: 0.05,
      gain: 0.03,
      release: 0.06,
    });
  },
  latch_wheel: (t) => {
    // Vault wheel / cam: a ratchet of ticks, the lugs seating at the end.
    const n = 4 + variant(t, 3);
    for (let i = 0; i < n; i++)
      t.noise({
        at: i * 0.045,
        dur: 0.012,
        gain: 0.07,
        filter: "highpass",
        freq: vary(t, 4200, 0.15),
      });
    clunk(t, n * 0.045 + 0.02, 0.6);
  },
  latch_magnet: (t) => {
    // Electromagnet: a hum swells or dies, a soft contact click.
    t.tone({ wave: "sine", freq: 100, at: 0, dur: 0.25, gain: 0.05, attack: 0.04, release: 0.12 });
    t.tone({ wave: "sine", freq: 200, at: 0, dur: 0.22, gain: 0.025, attack: 0.04, release: 0.1 });
    t.noise({ at: 0.2, dur: 0.015, gain: 0.07, filter: "highpass", freq: 3000 });
  },
  airlock_steam: (t) => {
    // Nozzles: a burst of hot steam that hisses on.
    t.noise({ dur: 0.04, gain: 0.14, filter: "lowpass", freq: 700 });
    t.noise({
      at: 0.03,
      dur: 1.6,
      gain: 0.13,
      filter: "highpass",
      freq: vary(t, 3200, 0.1),
      freqEnd: 2000,
      attack: 0.05,
      release: 0.5,
    });
    t.noise({
      at: 0.05,
      dur: 1.4,
      gain: 0.05,
      filter: "bandpass",
      freq: 900,
      q: 0.6,
      attack: 0.1,
      release: 0.4,
    });
  },
  airlock_extract: (t) => {
    // Extraction: a fan spins up and pulls the air through the floor grate.
    whirr(t, 0, 1.4, 60, 140);
    t.noise({
      dur: 1.4,
      gain: 0.08,
      filter: "bandpass",
      freq: 500,
      freqEnd: 1400,
      q: 0.7,
      attack: 0.3,
      release: 0.4,
    });
    clunk(t, 1.45, 0.5);
  },
  door_hiss: (t) => {
    // Pneumatic door: seal pop, pressure hiss of varying length, latch tick.
    const v = variant(t, 4);
    const dur = [0.45, 0.7, 0.3, 0.9][v]! * vary(t, 1, 0.1);
    t.noise({ dur: 0.02, gain: 0.12, filter: "lowpass", freq: vary(t, 600, 0.2) });
    t.noise({
      at: 0.015,
      dur,
      gain: [0.16, 0.12, 0.2, 0.1][v]!,
      filter: "highpass",
      freq: vary(t, [2800, 3600, 2400, 4200][v]!, 0.1),
      freqEnd: vary(t, 1500, 0.15),
      attack: 0.02,
      release: dur * 0.6,
    });
    if (v === 3) {
      // Long airlock: a second, lower exhale.
      t.noise({
        at: dur * 0.6,
        dur: dur * 0.6,
        gain: 0.06,
        filter: "bandpass",
        freq: vary(t, 800, 0.2),
        q: 1.2,
        attack: 0.1,
      });
    }
    t.tone({ wave: "triangle", freq: vary(t, 1250, 0.1), at: dur + 0.03, dur: 0.02, gain: 0.03 });
  },
  brownout_crackle: (t) => {
    // Arcing contacts: clustered pops with a sagging mains buzz under them.
    const pops = 5 + Math.floor(t.rand() * 5);
    for (let i = 0; i < pops; i++) {
      t.noise({
        at: between(t, 0, 0.6),
        dur: between(t, 0.008, 0.03),
        gain: between(t, 0.06, 0.16),
        filter: "bandpass",
        freq: between(t, 2000, 6500),
        q: 1.5,
      });
    }
    t.tone({
      wave: "sawtooth",
      freq: 100,
      freqEnd: 82,
      dur: 0.7,
      gain: 0.02,
      attack: 0.02,
      filter: { type: "lowpass", freq: 700 },
    });
  },
} satisfies Record<string, Recipe>;

export const SFX: Record<SfxName, Recipe> = {
  door_open: (t) => {
    t.noise({
      dur: 0.6,
      gain: 0.28,
      filter: "bandpass",
      freq: 4200,
      freqEnd: 1800,
      q: 1.2,
      attack: 0.02,
      release: 0.2,
    });
    t.tone({ wave: "sine", freq: 90, freqEnd: 70, dur: 0.5, gain: 0.12 });
    t.noise({ at: 0.55, dur: 0.08, gain: 0.3, filter: "lowpass", freq: 420 });
  },
  door_locked: (t) => {
    for (const at of [0, 0.12]) {
      t.noise({ at, dur: 0.06, gain: 0.3, filter: "lowpass", freq: 600 });
      t.tone({ wave: "square", freq: 150, at, dur: 0.08, gain: 0.05 });
    }
    t.tone({ wave: "square", freq: 220, freqEnd: 180, at: 0.26, dur: 0.15, gain: 0.04 });
  },
  elevator: (t) => {
    t.tone({
      wave: "sawtooth",
      freq: 70,
      dur: 1.6,
      gain: 0.12,
      attack: 0.3,
      release: 0.3,
      vibrato: { rate: 2, depth: 3 },
      filter: { type: "lowpass", freq: 300 },
    });
    t.noise({ dur: 1.6, gain: 0.08, filter: "lowpass", freq: 420, attack: 0.3, release: 0.3 });
    t.tone({ wave: "sine", freq: 1318, at: 1.7, dur: 0.8, gain: 0.1, release: 0.5 });
    t.tone({ wave: "sine", freq: 1046, at: 1.85, dur: 0.9, gain: 0.1, release: 0.6 });
  },
  note_paper: (t) => {
    t.noise({ dur: 0.15, gain: 0.18, filter: "bandpass", freq: 3000, freqEnd: 1500, q: 1.5 });
    t.noise({ at: 0.12, dur: 0.08, gain: 0.12, filter: "bandpass", freq: 5000, q: 1.5 });
  },
  tape_play: (t) => {
    t.noise({ dur: 0.03, gain: 0.3, filter: "bandpass", freq: 1500, q: 3 });
    t.noise({ at: 0.05, dur: 1.1, gain: 0.05, filter: "highpass", freq: 5000, release: 0.3 });
    t.tone({
      wave: "sine",
      freq: 440,
      at: 0.1,
      dur: 0.9,
      gain: 0.05,
      vibrato: { rate: 5.5, depth: 9 },
      release: 0.2,
    });
    t.tone({
      wave: "triangle",
      freq: 330,
      at: 0.15,
      dur: 0.8,
      gain: 0.03,
      vibrato: { rate: 4.2, depth: 6 },
    });
  },
  echo_whisper: (t) => {
    t.noise({
      dur: 1.8,
      gain: 0.18,
      filter: "bandpass",
      freq: 1200,
      freqEnd: 700,
      q: 8,
      attack: 0.4,
      release: 0.8,
    });
    t.noise({
      at: 0.3,
      dur: 1.4,
      gain: 0.12,
      filter: "bandpass",
      freq: 2400,
      freqEnd: 1600,
      q: 10,
      attack: 0.3,
      release: 0.6,
    });
    t.tone({
      wave: "sine",
      freq: 220,
      dur: 2,
      gain: 0.04,
      attack: 0.6,
      release: 0.8,
      vibrato: { rate: 0.7, depth: 12 },
    });
  },
  teleport: (t) => {
    t.tone({ wave: "sine", freq: 200, freqEnd: 2000, dur: 1.2, gain: 0.12, attack: 0.2 });
    t.tone({
      wave: "sawtooth",
      freq: 100,
      freqEnd: 1600,
      dur: 1.2,
      gain: 0.05,
      attack: 0.2,
      filter: { type: "lowpass", freq: 2500 },
    });
    t.noise({ dur: 1.2, gain: 0.08, filter: "highpass", freq: 2000, attack: 0.4 });
    t.tone({ wave: "sine", freq: 120, freqEnd: 40, at: 1.2, dur: 0.45, gain: 0.35 });
  },
  rift: (t) => {
    t.tone({
      wave: "sine",
      freq: 55,
      dur: 2.2,
      gain: 0.28,
      attack: 0.5,
      release: 0.8,
      vibrato: { rate: 3, depth: 5 },
    });
    t.noise({
      dur: 2.2,
      gain: 0.12,
      filter: "bandpass",
      freq: 300,
      freqEnd: 1500,
      q: 4,
      attack: 0.6,
      release: 0.8,
    });
    t.tone({
      wave: "sawtooth",
      freq: 27.5,
      dur: 2.2,
      gain: 0.08,
      attack: 0.5,
      filter: { type: "lowpass", freq: 200 },
    });
    t.tone({ wave: "sine", freq: 1760, at: 0.8, dur: 1.2, gain: 0.03, detune: 12 });
  },
  anomaly_zap: (t) => {
    t.tone({ wave: "square", freq: 2000, freqEnd: 100, dur: 0.15, gain: 0.08 });
    t.noise({ dur: 0.1, gain: 0.12, filter: "highpass", freq: 6000 });
  },
  drone: (t) => {
    t.tone({
      wave: "sawtooth",
      freq: 180,
      dur: 1.2,
      gain: 0.05,
      attack: 0.2,
      release: 0.3,
      vibrato: { rate: 30, depth: 6 },
      filter: { type: "lowpass", freq: 1400 },
    });
    t.tone({
      wave: "sawtooth",
      freq: 183,
      dur: 1.2,
      gain: 0.04,
      attack: 0.2,
      release: 0.3,
      filter: { type: "lowpass", freq: 1200 },
    });
  },
  alarm: (t) => {
    for (const at of [0, 0.6]) {
      t.tone({
        wave: "square",
        freq: 440,
        freqEnd: 660,
        at,
        dur: 0.45,
        gain: 0.05,
        filter: { type: "lowpass", freq: 1500 },
      });
    }
  },
  handshake_tone: (t) => {
    t.tone({ wave: "sine", freq: 440, dur: 0.8, gain: 0.18, attack: 0.02, release: 0.5 });
    t.tone({ wave: "triangle", freq: 880, dur: 0.6, gain: 0.04, attack: 0.02, release: 0.4 });
  },

  ...ROUND4_SFX,
  ...ROUND5_SFX,
  // Round 6 overhaul: replaces the event / device / UI / footstep recipes above.
  ...SFX_V2,
};

/** Semitone ratio helper for `pitch` (e.g. handshake tones 3-6-4-8). */
export function semitones(n: number): number {
  return Math.pow(2, n / 12);
}

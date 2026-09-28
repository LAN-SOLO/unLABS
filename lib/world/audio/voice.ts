/**
 * Typing voices — per-character bleeps for dialogue lines.
 * ========================================================
 *
 * `speechPlan()` is pure: it turns a line into a list of bleeps with a
 * deterministic pitch per character (the same word always "sounds" the
 * same), so tests and the engine agree on timing.
 */
import { SFX } from "@/lib/world/audio/sfx";
import type { FilterKind, SynthTarget, Wave } from "@/lib/world/audio/synth";

export const VOICE_IDS = [
  "mcp",
  "jade",
  "damien",
  "bot",
  "halo",
  "pa",
  "bot_gruff",
  "bot_chirpy",
  "bot_slow",
] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

export interface VoicePreset {
  wave: Wave;
  /** Base pitch in Hz. */
  base: number;
  /** Pitch spread in semitones. */
  spread: number;
  /** Characters per second. */
  cps: number;
  /** Bleep every nth letter (keeps long lines light). */
  every: number;
  blip: number;
  gain: number;
  attack?: number;
  release?: number;
  vibrato?: { rate: number; depth: number };
  /** Extra sine voices as frequency ratios (Halo's choir, Damien's broken signal). */
  harmonics?: readonly number[];
  /** Filter on every bleep (lowpass for soft voices, bandpass for the tannoy). */
  filter?: { type: FilterKind; freq: number; q?: number };
  /** Per-bleep pitch glide ratio (bots chirp up / grumble down). */
  glide?: number;
  /** Warm sub-octave sine under each bleep (Jade), as a gain ratio. */
  warmth?: number;
  /** Breathy noise layer (Damien), as a gain ratio. */
  breath?: number;
  /** Fraction of bleeps that drop out (Damien's failing signal). */
  dropout?: number;
  /** A tiny status click every nth bleep (MCP). */
  clickEvery?: number;
  /** Tannoy slap-back echo. */
  echo?: { delay: number; gain: number };
  /** Seconds of lead-in before the first bleep (the PA chime plays here). */
  lead?: number;
}

export const VOICES: Record<VoiceId, VoicePreset> = {
  // Dry, clipped square blips with relay-like status clicks.
  mcp: {
    wave: "square",
    base: 196,
    spread: 5,
    cps: 30,
    every: 2,
    blip: 0.04,
    gain: 0.05,
    attack: 0.002,
    release: 0.01,
    filter: { type: "lowpass", freq: 1800 },
    clickEvery: 7,
  },
  // Soft sine with a warm sub-octave, gently rounded envelope.
  jade: {
    wave: "sine",
    base: 330,
    spread: 7,
    cps: 34,
    every: 2,
    blip: 0.055,
    gain: 0.09,
    attack: 0.012,
    release: 0.05,
    warmth: 0.45,
    harmonics: [2],
    filter: { type: "lowpass", freq: 2400 },
  },
  // Breathy, filtered noise over a low sine, with signal dropouts.
  damien: {
    wave: "sine",
    base: 165,
    spread: 6,
    cps: 22,
    every: 2,
    blip: 0.08,
    gain: 0.08,
    attack: 0.015,
    release: 0.04,
    vibrato: { rate: 9, depth: 14 },
    harmonics: [1.012],
    breath: 0.9,
    dropout: 0.22,
  },
  bot: {
    wave: "square",
    base: 587,
    spread: 9,
    cps: 40,
    every: 2,
    blip: 0.03,
    gain: 0.035,
    attack: 0.003,
    release: 0.02,
    filter: { type: "lowpass", freq: 3200 },
  },
  // Choral pad: slow swells, stacked fifths/octaves.
  halo: {
    wave: "sine",
    base: 110,
    spread: 12,
    cps: 14,
    every: 3,
    blip: 0.35,
    gain: 0.06,
    attack: 0.12,
    release: 0.4,
    harmonics: [1.5, 2, 3.005],
    vibrato: { rate: 0.8, depth: 6 },
  },
  // Lab tannoy: band-passed, slap-back echo, led in by the chime.
  pa: {
    wave: "sawtooth",
    base: 247,
    spread: 4,
    cps: 26,
    every: 2,
    blip: 0.05,
    gain: 0.045,
    attack: 0.004,
    release: 0.03,
    filter: { type: "bandpass", freq: 1400, q: 2.2 },
    echo: { delay: 0.13, gain: 0.35 },
    lead: 1.1,
  },
  // r3tr0: gruff, low, grumbling down.
  bot_gruff: {
    wave: "sawtooth",
    base: 196,
    spread: 5,
    cps: 32,
    every: 2,
    blip: 0.045,
    gain: 0.04,
    attack: 0.004,
    release: 0.02,
    glide: 0.82,
    filter: { type: "lowpass", freq: 900, q: 3 },
  },
  // b4c0n: chirpy, high, upward chirps.
  bot_chirpy: {
    wave: "triangle",
    base: 880,
    spread: 10,
    cps: 44,
    every: 2,
    blip: 0.028,
    gain: 0.045,
    attack: 0.002,
    release: 0.015,
    glide: 1.35,
  },
  // f1ndr: slow, deliberate, long wobbling tones.
  bot_slow: {
    wave: "square",
    base: 330,
    spread: 4,
    cps: 18,
    every: 3,
    blip: 0.09,
    gain: 0.03,
    attack: 0.01,
    release: 0.05,
    vibrato: { rate: 4, depth: 5 },
    filter: { type: "lowpass", freq: 1400 },
  },
};

const BOT_VOICES: Readonly<Record<string, VoiceId>> = {
  r3tr0: "bot_gruff",
  b4c0n: "bot_chirpy",
  f1ndr: "bot_slow",
};

/** Dialogue speaker → voice preset. */
export function voiceFor(who: string): VoiceId {
  if (who === "mcp" || who === "jade" || who === "damien" || who === "halo" || who === "pa") {
    return who;
  }
  if (who === "unstables") return "halo";
  return BOT_VOICES[who] ?? "bot";
}

/**
 * Per-speaker pitch multiplier so that bots sharing the generic "bot"
 * preset still sound like different machines (deterministic per id).
 */
export function speakerPitch(who: string): number {
  if (voiceFor(who) !== "bot" || who === "bot") return 1;
  let h = 0;
  for (let i = 0; i < who.length; i++) h = (Math.imul(h, 31) + who.charCodeAt(i)) >>> 0;
  return 0.8 + (h % 9) * 0.06;
}

export interface Bleep {
  at: number;
  freq: number;
  dur: number;
  gain: number;
}

const MAX_BLEEPS = 90;

/** Plan the bleeps for a line. Returns the bleeps and the spoken duration. */
export function speechPlan(text: string, voice: VoiceId): { bleeps: Bleep[]; duration: number } {
  const v = VOICES[voice];
  const step = 1 / v.cps;
  const bleeps: Bleep[] = [];
  let t = v.lead ?? 0;
  let letter = 0;
  // Strip bracketed stage directions like "[SIGNAL STARK]" from the voice.
  const spoken = text.replace(/\[[^\]]*\]/g, " ");
  for (const ch of spoken) {
    if (/[.!?…]/.test(ch)) {
      t += step * 6;
      continue;
    }
    if (/[,;:—–-]/.test(ch)) {
      t += step * 3;
      continue;
    }
    if (/\s/.test(ch)) {
      t += step;
      continue;
    }
    const n = letter++;
    const code = ch.toLowerCase().codePointAt(0) ?? 97;
    const dropped = v.dropout !== undefined && ((code * 13 + n * 29) % 100) / 100 < v.dropout;
    if (n % v.every === 0 && !dropped && bleeps.length < MAX_BLEEPS) {
      const semis = ((code * 7) % (v.spread * 2 + 1)) - v.spread;
      const vowel = /[aeiouäöüy]/i.test(ch);
      bleeps.push({
        at: t,
        freq: v.base * Math.pow(2, semis / 12),
        dur: v.blip,
        gain: v.gain * (vowel ? 1 : 0.7),
      });
    }
    t += step;
  }
  return { bleeps, duration: t };
}

/** Write a planned line into a synth target. */
export function renderSpeech(target: SynthTarget, bleeps: readonly Bleep[], voice: VoiceId): void {
  const v = VOICES[voice];
  if (v.lead) SFX.pa_chime(target, {});
  const attack = v.attack ?? 0.005;
  const release = v.release ?? 0.02;
  const bleep = (b: Bleep, at: number, gain: number): void => {
    target.tone({
      wave: v.wave,
      freq: b.freq,
      ...(v.glide ? { freqEnd: b.freq * v.glide } : {}),
      at,
      dur: b.dur,
      gain,
      attack,
      release,
      ...(v.vibrato ? { vibrato: v.vibrato } : {}),
      ...(v.filter ? { filter: v.filter } : {}),
    });
  };
  bleeps.forEach((b, i) => {
    bleep(b, b.at, b.gain);
    if (v.echo) bleep(b, b.at + v.echo.delay, b.gain * v.echo.gain);
    for (const ratio of v.harmonics ?? []) {
      target.tone({
        wave: "sine",
        freq: b.freq * ratio,
        at: b.at + 0.01,
        dur: b.dur,
        gain: b.gain * (ratio > 1.1 ? 0.35 : 0.5),
        attack: Math.max(0.01, attack * 1.5),
        release: release * 1.2,
      });
    }
    if (v.warmth) {
      target.tone({
        wave: "sine",
        freq: b.freq / 2,
        at: b.at,
        dur: b.dur * 1.2,
        gain: b.gain * v.warmth,
        attack: attack * 2,
        release: release * 2,
      });
    }
    if (v.breath) {
      target.noise({
        at: b.at,
        dur: b.dur,
        gain: b.gain * v.breath,
        filter: "bandpass",
        freq: b.freq * 4,
        q: 1.4,
        attack: 0.02,
        release: 0.05,
      });
    }
    if (v.clickEvery && i % v.clickEvery === v.clickEvery - 1) {
      target.noise({
        at: b.at + b.dur,
        dur: 0.006,
        gain: 0.05,
        filter: "bandpass",
        freq: 3600,
        q: 4,
      });
    }
  });
}

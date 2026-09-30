/**
 * Synth primitives — the vocabulary every procedural sound is written in.
 * ======================================================================
 *
 * Recipes (sfx, voices, ambience) never touch Web Audio directly: they
 * describe tones and noise bursts against a `SynthTarget`. The engine's
 * target turns them into nodes; tests use a recording target. This keeps
 * all sound design pure and verifiable without an AudioContext.
 */

export type Wave = "sine" | "square" | "sawtooth" | "triangle";
export type FilterKind = "lowpass" | "highpass" | "bandpass";

export interface ToneSpec {
  wave: Wave;
  /** Start frequency in Hz. */
  freq: number;
  /** Exponential glide target reached at the end of `dur`. */
  freqEnd?: number;
  /** Offset from "now" in seconds. */
  at?: number;
  dur: number;
  /** Peak gain (0..1, before bus gain). */
  gain: number;
  attack?: number;
  release?: number;
  detune?: number;
  vibrato?: { rate: number; depth: number };
  /** Optional filter; `freqEnd` sweeps it exponentially over `dur` (filter envelope). */
  filter?: { type: FilterKind; freq: number; q?: number; freqEnd?: number };
  /** Stereo position -1..1 (music parts; ignored where no panner exists). */
  pan?: number;
}

export interface NoiseSpec {
  at?: number;
  dur: number;
  gain: number;
  filter: FilterKind;
  freq: number;
  /** Filter sweep target. */
  freqEnd?: number;
  q?: number;
  attack?: number;
  release?: number;
  /** Stereo position -1..1 (music parts; ignored where no panner exists). */
  pan?: number;
}

export interface SynthTarget {
  tone(spec: ToneSpec): void;
  noise(spec: NoiseSpec): void;
  /** 0..1, deterministic in tests. */
  rand(): number;
}

/** Recorded event (used by tests and by `describe()` helpers). */
export type SynthEvent = ({ kind: "tone" } & ToneSpec) | ({ kind: "noise" } & NoiseSpec);

/** A SynthTarget that just records — handy for tests and offline analysis. */
export class RecordingTarget implements SynthTarget {
  readonly events: SynthEvent[] = [];
  private readonly rng: () => number;

  constructor(seed = 1) {
    this.rng = mulberry32(seed);
  }

  tone(spec: ToneSpec): void {
    this.events.push({ kind: "tone", ...spec });
  }

  noise(spec: NoiseSpec): void {
    this.events.push({ kind: "noise", ...spec });
  }

  rand(): number {
    return this.rng();
  }

  /** Total length of the recorded sound in seconds. */
  duration(): number {
    let end = 0;
    for (const e of this.events) end = Math.max(end, (e.at ?? 0) + e.dur + (e.release ?? 0));
    return end;
  }
}

/** Small deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** MIDI note → Hz. */
export function mtof(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Distance attenuation + stereo pan for a sound at `pos` heard from
 * `listener` (both voxel x/z). `yaw` is the camera yaw so that panning
 * follows the screen, not the world axes.
 */
export function spatialize(
  pos: readonly [number, number],
  listener: readonly [number, number],
  yaw = Math.PI / 4,
  ref = 6,
  max = 42,
): { gain: number; pan: number; distance: number } {
  const dx = pos[0] - listener[0];
  const dz = pos[1] - listener[1];
  const distance = Math.hypot(dx, dz);
  let gain = 1;
  if (distance > ref) {
    const k = clamp(1 - (distance - ref) / Math.max(0.001, max - ref), 0, 1);
    gain = k * k;
  }
  // Camera right vector for the engine's orbit (camera sits at +sin/cos yaw).
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const pan = clamp((dx * rx + dz * rz) / 16, -1, 1);
  return { gain, pan, distance };
}

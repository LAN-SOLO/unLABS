/**
 * Offline renderer — songs to PCM without Web Audio (pure TypeScript).
 * ====================================================================
 *
 * Implements `SynthTarget` sample by sample (band-limited saw/square,
 * RBJ biquads with sweeps, the same exponential envelopes as
 * webaudio.ts, vibrato, equal-power pan) so the soundtrack can be
 * measured in tests (level, clipping, density) and exported as preview
 * files for the dev book (scripts/audio/render-songs.ts).
 */
import type { NoiseSpec, SynthTarget, ToneSpec } from "@/lib/world/audio/synth";
import { mulberry32 } from "@/lib/world/audio/synth";
import {
  renderBar,
  songPlan,
  type PartTargets,
  type RenderOptions,
} from "@/lib/world/audio/songs/arrange";
import type { Part, SongDef } from "@/lib/world/audio/songs/types";
import { PARTS } from "@/lib/world/audio/songs/types";

const MIN = 0.0001;

class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  constructor(
    private readonly type: "lowpass" | "highpass" | "bandpass",
    private readonly sr: number,
  ) {}
  set(freq: number, q: number): void {
    const f = Math.min(Math.max(10, freq), this.sr * 0.45);
    const w = (2 * Math.PI * f) / this.sr;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * Math.max(0.05, q));
    const a0 = 1 + alpha;
    let b0: number;
    let b1: number;
    let b2: number;
    if (this.type === "lowpass") {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (this.type === "highpass") {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }
  run(x: number): number {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function expAt(v0: number, v1: number, t: number, t0: number, t1: number): number {
  if (t <= t0) return v0;
  if (t >= t1) return v1;
  return v0 * Math.pow(v1 / v0, (t - t0) / (t1 - t0));
}

function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Stereo PCM buffer target. */
export class OfflineTarget implements SynthTarget {
  private readonly rng: () => number;
  constructor(
    readonly left: Float32Array,
    readonly right: Float32Array,
    readonly sr: number,
    /** Absolute start (seconds) that `at: 0` maps to. */
    public t0 = 0,
    seed = 7,
  ) {
    this.rng = mulberry32(seed);
  }

  rand(): number {
    return this.rng();
  }

  private write(
    start: number,
    attack: number,
    dur: number,
    release: number,
    peak: number,
    pan: number | undefined,
    sample: (t: number, i: number) => number,
  ): void {
    const sr = this.sr;
    const holdEnd = Math.max(start + attack, start + dur);
    const end = holdEnd + Math.max(0.01, release);
    const i0 = Math.max(0, Math.floor(start * sr));
    const i1 = Math.min(this.left.length, Math.ceil(end * sr));
    const p = Math.max(-1, Math.min(1, pan ?? 0));
    const gl = Math.cos(((p + 1) * Math.PI) / 4);
    const gr = Math.sin(((p + 1) * Math.PI) / 4);
    const pk = Math.max(MIN, peak);
    for (let i = i0; i < i1; i++) {
      const t = i / sr;
      const env =
        t < start + attack
          ? expAt(MIN, pk, t, start, start + Math.max(0.001, attack))
          : t < holdEnd
            ? pk
            : expAt(pk, MIN, t, holdEnd, end);
      const v = sample(t, i - i0) * env;
      this.left[i]! += v * gl;
      this.right[i]! += v * gr;
    }
  }

  tone(s: ToneSpec): void {
    const start = this.t0 + (s.at ?? 0);
    const attack = s.attack ?? 0.005;
    const release = s.release ?? 0.05;
    const sr = this.sr;
    const f0 = Math.max(1, s.freq);
    const f1 = s.freqEnd !== undefined ? Math.max(1, s.freqEnd) : f0;
    const det = s.detune ? Math.pow(2, s.detune / 1200) : 1;
    const filt = s.filter ? new Biquad(s.filter.type, sr) : null;
    const ff0 = s.filter?.freq ?? 0;
    const ff1 = s.filter?.freqEnd ?? ff0;
    const q = s.filter?.q ?? 0.7;
    if (filt) filt.set(ff0, q);
    let phase = 0;
    this.write(start, attack, s.dur, release, s.gain, s.pan, (t, k) => {
      let f = expAt(f0, f1, t, start, start + Math.max(0.001, s.dur)) * det;
      if (s.vibrato) f += s.vibrato.depth * Math.sin(2 * Math.PI * s.vibrato.rate * (t - start));
      const dt = Math.min(0.5, f / sr);
      phase += dt;
      if (phase >= 1) phase -= 1;
      let x: number;
      switch (s.wave) {
        case "sine":
          x = Math.sin(2 * Math.PI * phase);
          break;
        case "triangle":
          x = 1 - 4 * Math.abs(phase - 0.5);
          break;
        case "sawtooth":
          x = 2 * phase - 1 - polyBlep(phase, dt);
          break;
        case "square": {
          const ph2 = (phase + 0.5) % 1;
          x = (phase < 0.5 ? 1 : -1) + polyBlep(phase, dt) - polyBlep(ph2, dt);
          break;
        }
      }
      if (filt) {
        if (ff1 !== ff0 && k % 32 === 0)
          filt.set(expAt(ff0, ff1, t, start, start + Math.max(0.01, s.dur)), q);
        x = filt.run(x);
      }
      return x;
    });
  }

  noise(s: NoiseSpec): void {
    const start = this.t0 + (s.at ?? 0);
    const attack = s.attack ?? 0.003;
    const release = s.release ?? 0.04;
    const filt = new Biquad(s.filter, this.sr);
    const q = s.q ?? 0.8;
    filt.set(s.freq, q);
    const f1 = s.freqEnd ?? s.freq;
    let seed = Math.floor(this.rng() * 0xffffffff) >>> 0;
    this.write(start, attack, s.dur, release, s.gain, s.pan, (t, k) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      if (f1 !== s.freq && k % 32 === 0)
        filt.set(expAt(s.freq, Math.max(10, f1), t, start, start + Math.max(0.01, s.dur)), q);
      return filt.run((seed / 4294967296) * 2 - 1);
    });
  }
}

/** Echo send per part (mirrors the in-game music bus). */
export const ECHO_SEND: Readonly<Record<Part, number>> = {
  lead: 0.22,
  counter: 0.18,
  bell: 0.4,
  arp: 0.3,
  pad: 0.08,
  bass: 0,
  drums: 0.04,
};

/** Hall send per part (the in-game music convolver). */
export const HALL_SEND: Readonly<Record<Part, number>> = {
  lead: 0.35,
  counter: 0.4,
  bell: 0.5,
  arp: 0.4,
  pad: 0.5,
  bass: 0.05,
  drums: 0.15,
};

export interface RenderResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  seconds: number;
}

/** Schroeder hall (4 combs + 2 allpasses per channel), in place into `outL/R`. */
function hall(
  inL: Float32Array,
  inR: Float32Array,
  outL: Float32Array,
  outR: Float32Array,
  sr: number,
  wet: number,
): void {
  const k = sr / 44100;
  const run = (src: Float32Array, dst: Float32Array, spread: number) => {
    const combs = [1557, 1617, 1491, 1422].map((d) => Math.round((d + spread) * k));
    const bufs = combs.map((d) => new Float32Array(d));
    const idx = combs.map(() => 0);
    const lp = combs.map(() => 0);
    const aps = [225, 556].map((d) => Math.round((d + spread) * k));
    const abufs = aps.map((d) => new Float32Array(d));
    const aidx = aps.map(() => 0);
    const fb = 0.84;
    const dampK = 0.25;
    for (let i = 0; i < src.length; i++) {
      const x = src[i]!;
      let y = 0;
      for (let c = 0; c < combs.length; c++) {
        const b = bufs[c]!;
        const o = b[idx[c]!]!;
        lp[c] = o * (1 - dampK) + lp[c]! * dampK;
        b[idx[c]!] = x + lp[c]! * fb;
        idx[c] = (idx[c]! + 1) % b.length;
        y += o;
      }
      y *= 0.25;
      for (let a = 0; a < aps.length; a++) {
        const b = abufs[a]!;
        const o = b[aidx[a]!]!;
        const v = y + o * 0.5;
        b[aidx[a]!] = v;
        aidx[a] = (aidx[a]! + 1) % b.length;
        y = o - v * 0.5;
      }
      dst[i]! += y * wet;
    }
  };
  run(inL, outL, 0);
  run(inR, outR, 23);
}

/**
 * Render a song (or its first `maxSeconds`) to stereo PCM, with the
 * dotted-eighth echo and the hall the game uses. Levels are left as the
 * game plays them (no normalisation) so tests can check headroom.
 */
export function renderSong(
  song: SongDef,
  opts: {
    sampleRate?: number;
    maxSeconds?: number;
    fromBar?: number;
    tail?: number;
    hall?: boolean;
  } & RenderOptions = {},
): RenderResult {
  const sr = opts.sampleRate ?? 22050;
  const plan = songPlan(song, opts.length ?? "standard");
  const from = opts.fromBar ?? 0;
  const total = plan.totalSeconds - from * plan.barSeconds;
  const seconds = Math.min(total, opts.maxSeconds ?? total) + (opts.tail ?? 2);
  const len = Math.ceil(seconds * sr);
  const dryL = new Float32Array(len);
  const dryR = new Float32Array(len);
  const sendL = new Float32Array(len);
  const sendR = new Float32Array(len);
  const hallL = new Float32Array(len);
  const hallR = new Float32Array(len);
  const bars = Math.ceil(Math.min(total, opts.maxSeconds ?? total) / plan.barSeconds);
  for (let b = 0; b < bars; b++) {
    const t0 = b * plan.barSeconds;
    const targets: PartTargets = {};
    for (const part of PARTS) {
      const sd = (b + 1) * 131 + part.length;
      const outs: [SynthTarget, number][] = [[new OfflineTarget(dryL, dryR, sr, t0, sd), 1]];
      if (ECHO_SEND[part] > 0)
        outs.push([new OfflineTarget(sendL, sendR, sr, t0, sd), ECHO_SEND[part]]);
      if (opts.hall !== false && HALL_SEND[part] > 0)
        outs.push([new OfflineTarget(hallL, hallR, sr, t0, sd), HALL_SEND[part]]);
      targets[part] = tee(outs);
    }
    renderBar(song, from + b, targets, opts);
  }
  // Dotted-eighth ping-pong echo, damped, into the mix.
  const delay = Math.round(plan.eighth * 1.5 * sr);
  const damp = new Biquad("lowpass", sr);
  damp.set(2400, 0.5);
  const dampR = new Biquad("lowpass", sr);
  dampR.set(2400, 0.5);
  const fb = 0.35;
  const bufL = new Float32Array(len);
  const bufR = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const dl = i >= delay ? bufR[i - delay]! : 0;
    const dr = i >= delay ? bufL[i - delay]! : 0;
    bufL[i] = sendL[i]! + damp.run(dl) * fb;
    bufR[i] = sendR[i]! + dampR.run(dr) * fb;
    dryL[i]! += (i >= delay ? bufL[i - delay]! : 0) * 0.5;
    dryR[i]! += (i >= delay ? bufR[i - delay]! : 0) * 0.5;
  }
  if (opts.hall !== false) hall(hallL, hallR, dryL, dryR, sr, 0.9);
  return { left: dryL, right: dryR, sampleRate: sr, seconds };
}

/** Forward every event to several targets with a gain each. */
function tee(outs: readonly [SynthTarget, number][]): SynthTarget {
  const first = outs[0]![0];
  return {
    rand: () => first.rand(),
    tone: (s) => {
      for (const [t, g] of outs) t.tone(g === 1 ? s : { ...s, gain: s.gain * g });
    },
    noise: (s) => {
      for (const [t, g] of outs) t.noise(g === 1 ? s : { ...s, gain: s.gain * g });
    },
  };
}

export interface LevelStats {
  peak: number;
  rms: number;
  /** RMS per 2-second window. */
  windows: number[];
  /** Share of samples over |0.99| (before the game's compressor). */
  clipped: number;
}

export function levelStats(r: RenderResult, windowSec = 2): LevelStats {
  let peak = 0;
  let sum = 0;
  let clip = 0;
  const n = r.left.length;
  const w = Math.max(1, Math.floor(windowSec * r.sampleRate));
  const windows: number[] = [];
  let ws = 0;
  for (let i = 0; i < n; i++) {
    const l = r.left[i]!;
    const rr = r.right[i]!;
    const a = Math.max(Math.abs(l), Math.abs(rr));
    if (a > peak) peak = a;
    if (a > 0.99) clip++;
    const e = (l * l + rr * rr) / 2;
    sum += e;
    ws += e;
    if ((i + 1) % w === 0) {
      windows.push(Math.sqrt(ws / w));
      ws = 0;
    }
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, n)), windows, clipped: clip / Math.max(1, n) };
}

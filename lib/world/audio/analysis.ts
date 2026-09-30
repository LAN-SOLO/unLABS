/**
 * Offline sound analysis — objective checks for procedural recipes.
 * =================================================================
 *
 * Renders a recipe with the pure offline synth (songs/offline.ts) and
 * measures it: peak, RMS, spectral centroid, energy per band, and how long
 * the sound lasts (time until the envelope stays 30 dB below its peak). Used
 * by tests (footwear sets must be measurably different) and by
 * scripts/audio/footsteps.ts (tables + spectrograms). Pure TypeScript.
 */
import type { SynthTarget } from "@/lib/world/audio/synth";
import { OfflineTarget } from "@/lib/world/audio/songs/offline";

export interface SoundFeatures {
  peak: number;
  rms: number;
  /** A-weighted level (RMS of the loudness-weighted spectrum, relative units). */
  loud: number;
  /** Spectral centroid in Hz of the A-weighted spectrum (what the ear finds "bright"). */
  centroid: number;
  /** Share of A-weighted spectral energy per band: <250, 250–1k, 1k–4k, >4k Hz. */
  bands: [number, number, number, number];
  /** Seconds until the level stays 30 dB under the peak. */
  length: number;
  /** Seconds from start to the loudest 5 ms window. */
  attackAt: number;
  /** Envelope of the first 300 ms in 5 ms steps, dB under the peak (0 … −40). */
  env: number[];
}

const ENV_STEPS = 60;

/** Render `recipe` into a mono buffer (`seconds` long). */
export function renderRecipe(
  recipe: (t: SynthTarget) => void,
  opts: { sampleRate?: number; seconds?: number; seed?: number } = {},
): { mono: Float32Array; sampleRate: number } {
  const sr = opts.sampleRate ?? 22050;
  const n = Math.ceil((opts.seconds ?? 1.2) * sr);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  recipe(new OfflineTarget(left, right, sr, 0, opts.seed ?? 7));
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = (left[i]! + right[i]!) * 0.5;
  return { mono, sampleRate: sr };
}

/** In-place radix-2 FFT (re, im of length 2^k). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/** Magnitude spectrum summed over Hann-windowed frames (1024 samples, 50 % overlap). */
export function powerSpectrum(mono: Float32Array, frame = 1024): Float64Array {
  const out = new Float64Array(frame / 2);
  const re = new Float64Array(frame);
  const im = new Float64Array(frame);
  for (let start = 0; start + frame <= mono.length; start += frame / 2) {
    for (let i = 0; i < frame; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));
      re[i] = mono[start + i]! * w;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < frame / 2; k++) out[k]! += re[k]! * re[k]! + im[k]! * im[k]!;
  }
  return out;
}

/** A-weighting as a power factor (IEC 61672, 0 dB at 1 kHz). */
export function aWeight(f: number): number {
  const f2 = f * f;
  const ra =
    (12194 ** 2 * f2 * f2) /
    ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  const g = ra * 1.2589; // +2.0 dB
  return g * g;
}

/** Raw measurements of one render (summable over seeds). */
interface Measure {
  spec: Float64Array;
  /** Energy per 5 ms window. */
  env: Float64Array;
  peak: number;
  sumSq: number;
  samples: number;
  sampleRate: number;
}

function measure(mono: Float32Array, sampleRate: number): Measure {
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < mono.length; i++) {
    const a = Math.abs(mono[i]!);
    if (a > peak) peak = a;
    sumSq += mono[i]! * mono[i]!;
  }
  const win = Math.max(1, Math.floor(sampleRate * 0.005));
  const env = new Float64Array(Math.ceil(mono.length / win));
  for (let i = 0; i < mono.length; i++) env[Math.floor(i / win)]! += mono[i]! * mono[i]!;
  return { spec: powerSpectrum(mono), env, peak, sumSq, samples: mono.length, sampleRate };
}

function fromMeasure(m: Measure, runs = 1): SoundFeatures {
  const { spec, env, sampleRate } = m;
  const binHz = sampleRate / (spec.length * 2);
  let total = 0;
  let weighted = 0;
  const bands: [number, number, number, number] = [0, 0, 0, 0];
  for (let k = 1; k < spec.length; k++) {
    const f = k * binHz;
    const e = spec[k]! * aWeight(f);
    total += e;
    weighted += e * f;
    bands[f < 250 ? 0 : f < 1000 ? 1 : f < 4000 ? 2 : 3] += e;
  }
  const norm = total > 0 ? total : 1;
  // Envelope: energy per 5 ms window; length = time holding 95 % of the energy.
  let energy = 0;
  let top = 0;
  let topAt = 0;
  env.forEach((v, i) => {
    energy += v;
    if (v > top) {
      top = v;
      topAt = i;
    }
  });
  let acc = 0;
  let last = env.length - 1;
  for (let i = 0; i < env.length; i++) {
    acc += env[i]!;
    if (acc >= energy * 0.95) {
      last = i;
      break;
    }
  }
  const envDb: number[] = [];
  for (let i = 0; i < ENV_STEPS; i++) {
    const v = env[i] ?? 0;
    envDb.push(top > 0 && v > 0 ? Math.max(-40, 10 * Math.log10(v / top)) : -40);
  }
  const frames = Math.max(1, (Math.floor(m.samples / 512) - 1) * runs);
  return {
    env: envDb,
    peak: m.peak / runs,
    rms: Math.sqrt(m.sumSq / Math.max(1, m.samples * runs)),
    loud: Math.sqrt(total / frames / 1024) / 16,
    centroid: total > 0 ? weighted / total : 0,
    bands: bands.map((b) => b / norm) as [number, number, number, number],
    length: (last + 1) * 0.005,
    attackAt: topAt * 0.005,
  };
}

export function features(mono: Float32Array, sampleRate: number): SoundFeatures {
  return fromMeasure(measure(mono, sampleRate));
}

/**
 * Distance between two sounds' character (0 = same): A-weighted log-centroid,
 * band shares, log length, log loudness and the envelope's rhythm (heel → toe
 * gap, clamp delay, flaps, rolls), each roughly unit-scaled.
 */
export function featureDistance(a: SoundFeatures, b: SoundFeatures): number {
  const lc = Math.log2(Math.max(20, a.centroid) / Math.max(20, b.centroid));
  const bands = a.bands.reduce((s, v, i) => s + Math.abs(v - b.bands[i]!), 0);
  const len = Math.log2(Math.max(0.01, a.length) / Math.max(0.01, b.length));
  const lvl = Math.log2(Math.max(1e-4, a.loud) / Math.max(1e-4, b.loud));
  let envDiff = 0;
  for (let i = 0; i < ENV_STEPS; i++) envDiff += Math.abs((a.env[i] ?? -40) - (b.env[i] ?? -40));
  const shape = envDiff / ENV_STEPS / 12;
  return Math.hypot(lc, bands * 2, len, lvl * 0.5, shape);
}

/**
 * Features of a recipe's micro-variants: spectra and envelopes of several
 * seeds are summed first, so the result describes the set, not one draw.
 */
export function averageFeatures(
  recipe: (t: SynthTarget) => void,
  seeds: readonly number[],
  opts: { sampleRate?: number; seconds?: number } = {},
): SoundFeatures {
  let sum: Measure | null = null;
  for (const seed of seeds) {
    const r = renderRecipe(recipe, { ...opts, seed });
    const m = measure(r.mono, r.sampleRate);
    if (!sum) sum = m;
    else {
      for (let k = 0; k < sum.spec.length; k++) sum.spec[k]! += m.spec[k]!;
      for (let k = 0; k < sum.env.length; k++) sum.env[k]! += m.env[k] ?? 0;
      sum.peak += m.peak;
      sum.sumSq += m.sumSq;
    }
  }
  if (!sum) throw new Error("averageFeatures: no seeds");
  return fromMeasure(sum, seeds.length);
}

/**
 * PZ_CLAMP_PATTERN — match one of Fridge's four clamp patterns (2008) to a
 * slice's volatility waveform. Pure logic, deterministic from the seed.
 */
import { mulberry32, randInt } from "@/components/world/puzzles/rng";
import { tr } from "@/lib/i18n";

export type ClampKind = "arecibo" | "parkes" | "jodrell" | "greenbank";

export interface ClampDef {
  kind: ClampKind;
  name: string;
  shape: string;
}

export const CLAMPS: readonly ClampDef[] = [
  { kind: "arecibo", name: "Arecibo", shape: tr("narrow – wide – narrow") },
  { kind: "parkes", name: "Parkes", shape: tr("even") },
  { kind: "jodrell", name: "Jodrell", shape: tr("tapering") },
  { kind: "greenbank", name: "Green Bank", shape: tr("wide – narrow – wide") },
];

export const WAVE_SAMPLES = 160;

/** Envelope (grip width) of a clamp over x ∈ [0, 1], values in (0, 1]. */
export function clampEnvelope(kind: ClampKind, x: number): number {
  const u = Math.max(0, Math.min(1, x));
  switch (kind) {
    case "arecibo":
      return 0.2 + 0.8 * Math.sin(Math.PI * u);
    case "parkes":
      return 0.72;
    case "jodrell":
      return 1 - 0.8 * u;
    case "greenbank":
      return 1 - 0.8 * Math.sin(Math.PI * u);
  }
}

export interface ClampWave {
  kind: ClampKind;
  /** Carrier cycles over the window. */
  cycles: number;
  samples: number[];
}

function waveSeed(seed: number, round: number, attempt: number): number {
  return (Math.imul(seed | 0, 1000003) + round * 7919 + attempt * 104729) >>> 0;
}

/**
 * Volatility waveform for a round/attempt: sine carrier × clamp envelope + noise.
 * `avoid` (e.g. the previous round's kind) is skipped when given.
 */
export function makeWave(
  seed: number,
  round: number,
  attempt: number,
  noise: number,
  avoid?: ClampKind,
): ClampWave {
  const rng = mulberry32(waveSeed(seed, round, attempt));
  const pool = avoid ? CLAMPS.filter((c) => c.kind !== avoid) : CLAMPS;
  const kind = pool[randInt(rng, pool.length)].kind;
  const cycles = 8 + randInt(rng, 5);
  const phase = rng() * Math.PI * 2;
  const amp = 0.85 + rng() * 0.15;
  const n = Math.max(0, Math.min(0.6, noise));
  const samples: number[] = [];
  for (let i = 0; i < WAVE_SAMPLES; i++) {
    const x = i / (WAVE_SAMPLES - 1);
    const carrier = Math.sin(2 * Math.PI * cycles * x + phase);
    samples.push(amp * clampEnvelope(kind, x) * carrier + n * (rng() * 2 - 1));
  }
  return { kind, cycles, samples };
}

/** Peak envelope: sliding max of |v| over ±`half` samples. */
export function peakEnvelope(samples: readonly number[], half = 10): number[] {
  const out: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    let m = 0;
    const lo = Math.max(0, i - half);
    const hi = Math.min(samples.length - 1, i + half);
    for (let j = lo; j <= hi; j++) m = Math.max(m, Math.abs(samples[j]));
    out.push(m);
  }
  return out;
}

/** Normalised least-squares error of the best scaled fit a·env(x) to the peak envelope. */
export function clampFitError(samples: readonly number[], kind: ClampKind): number {
  const env = peakEnvelope(samples);
  const n = env.length;
  if (n === 0) return 0;
  let smm = 0;
  let sme = 0;
  let norm = 0;
  const model: number[] = [];
  for (let i = 0; i < n; i++) {
    const m = clampEnvelope(kind, n > 1 ? i / (n - 1) : 0);
    model.push(m);
    smm += m * m;
    sme += m * env[i];
    norm += env[i] * env[i];
  }
  const a = smm > 0 ? sme / smm : 0;
  let err = 0;
  for (let i = 0; i < n; i++) {
    const d = env[i] - a * model[i];
    err += d * d;
  }
  return norm > 0 ? err / norm : 0;
}

/** Clamp kind whose envelope fits the waveform best. */
export function bestClamp(samples: readonly number[]): ClampKind {
  let best: ClampKind = CLAMPS[0].kind;
  let bestErr = Number.POSITIVE_INFINITY;
  for (const c of CLAMPS) {
    const e = clampFitError(samples, c.kind);
    if (e < bestErr) {
      bestErr = e;
      best = c.kind;
    }
  }
  return best;
}

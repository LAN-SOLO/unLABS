import { tr } from "@/lib/i18n";
import {
  SPECTRUM,
  TRAIT_AXES,
  type SpectrumColor,
  type TraitAxis,
  type Traits,
} from "@/lib/world/types";

export function emptyTraits(): Traits {
  return {
    energie: 0,
    signal: 0,
    optik: 0,
    thermik: 0,
    mechanik: 0,
    quantum: 0,
    resonanz: 0,
    daten: 0,
  };
}

export function traits(partial: Partial<Traits>): Traits {
  return { ...emptyTraits(), ...partial };
}

export function addTraits(a: Traits, b: Traits, scale = 1): Traits {
  const out = emptyTraits();
  for (const k of TRAIT_AXES) out[k] = a[k] + b[k] * scale;
  return out;
}

export function roundTraits(t: Traits): Traits {
  const out = emptyTraits();
  for (const k of TRAIT_AXES) out[k] = Math.max(0, Math.round(t[k] * 10) / 10);
  return out;
}

export function traitTotal(t: Traits): number {
  let s = 0;
  for (const k of TRAIT_AXES) s += t[k];
  return s;
}

/** Axes sorted by value, strongest first (ties broken by axis order). */
export function dominantAxes(t: Traits): TraitAxis[] {
  return [...TRAIT_AXES].sort(
    (a, b) => t[b] - t[a] || TRAIT_AXES.indexOf(a) - TRAIT_AXES.indexOf(b),
  );
}

/** True when every threshold in `need` is reached. */
export function meetsTraits(t: Traits, need: Partial<Traits>): boolean {
  for (const k of TRAIT_AXES) {
    const n = need[k];
    if (n !== undefined && t[k] < n) return false;
  }
  return true;
}

/** Cosine similarity restricted to the axes named in the signature. */
export function signatureMatch(t: Traits, sig: Partial<Traits>): number {
  let dot = 0;
  let nt = 0;
  let ns = 0;
  for (const k of TRAIT_AXES) {
    const s = sig[k] ?? 0;
    dot += t[k] * s;
    nt += t[k] * t[k];
    ns += s * s;
  }
  if (nt === 0 || ns === 0) return 0;
  return dot / Math.sqrt(nt * ns);
}

/** Spectral blend: average wavelength index, weighted by trait mass. */
export function blendColors(colors: { color: SpectrumColor; weight: number }[]): SpectrumColor {
  let sum = 0;
  let w = 0;
  for (const c of colors) {
    sum += SPECTRUM.indexOf(c.color) * c.weight;
    w += c.weight;
  }
  if (w === 0) return "gamma";
  const idx = Math.max(0, Math.min(SPECTRUM.length - 1, Math.round(sum / w)));
  return SPECTRUM[idx]!;
}

export const AXIS_LABEL: Record<TraitAxis, string> = {
  energie: tr("axis::Energy"),
  signal: tr("axis::Signal"),
  optik: tr("axis::Optics"),
  thermik: tr("axis::Thermal"),
  mechanik: tr("axis::Mechanics"),
  quantum: tr("axis::Quantum"),
  resonanz: tr("axis::Resonance"),
  daten: tr("axis::Data"),
};

export const AXIS_COLOR: Record<TraitAxis, string> = {
  energie: "#FFB800",
  signal: "#00FFFF",
  optik: "#AAFF00",
  thermik: "#FF6B00",
  mechanik: "#C4B9A0",
  quantum: "#8B00FF",
  resonanz: "#E91E8C",
  daten: "#0066FF",
};

export const SPECTRUM_HEX: Record<SpectrumColor, string> = {
  infrarot: "#7a1020",
  rot: "#FF3333",
  orange: "#FF6B00",
  gelb: "#FFB800",
  gruen: "#00FF66",
  blau: "#0066FF",
  indigo: "#4B3BFF",
  violett: "#8B00FF",
  gamma: "#E8F4FF",
};

/** FNV-1a — the same deterministic hash the rest of the game uses. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

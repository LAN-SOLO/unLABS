/**
 * PZ_HUE_TUNING — pure logic for the nine-band colour wheel.
 * Angles are in degrees, 0° at the top, growing clockwise.
 */
import { tr } from "@/lib/i18n";
import { SPECTRUM, type SpectrumColor } from "@/lib/world/types";

export const HUE_BAND_DEG = 360 / SPECTRUM.length;

export const HUE_LABELS: Record<SpectrumColor, string> = {
  infrarot: tr("Infrared"),
  rot: tr("Red"),
  orange: tr("Orange"),
  gelb: tr("Yellow"),
  gruen: tr("Green"),
  blau: tr("Blue"),
  indigo: tr("Indigo"),
  violett: tr("Violet"),
  gamma: tr("Gamma"),
};

export const HUE_COLORS: Record<SpectrumColor, string> = {
  infrarot: "#7A1010",
  rot: "#FF3030",
  orange: "#FF8A1E",
  gelb: "#FFE030",
  gruen: "#33FF33",
  blau: "#2F8CFF",
  indigo: "#5A4BFF",
  violett: "#B040FF",
  gamma: "#E8FFE8",
};

/** Normalises any angle to [0, 360). */
export function normAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Signed shortest difference a − b in (−180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = normAngle(a - b);
  return d > 180 ? d - 360 : d;
}

export function bandIndexAt(angleDeg: number): number {
  return Math.min(SPECTRUM.length - 1, Math.floor(normAngle(angleDeg) / HUE_BAND_DEG));
}

export function bandCenter(idx: number): number {
  return idx * HUE_BAND_DEG + HUE_BAND_DEG / 2;
}

/** Index of a spectrum colour name; unknown names fall back to "gelb". */
export function spectrumIndex(name: string): number {
  const i = SPECTRUM.findIndex((c) => c === name.toLowerCase());
  return i >= 0 ? i : SPECTRUM.indexOf("gelb");
}

/** True when the needle angle lies within ±tol of the target band's centre. */
export function hueHit(angle: number, targetIdx: number, tol: number): boolean {
  return Math.abs(angleDiff(angle, bandCenter(targetIdx))) <= tol;
}

/** Per-round value from a list, repeating the last entry when the list is short. */
export function perRound(list: readonly number[], round: number, fallback: number): number {
  if (list.length === 0) return fallback;
  return list[Math.min(round, list.length - 1)];
}

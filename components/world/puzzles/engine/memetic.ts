/**
 * PZ_MEMETIC_FITNESS_TRIANGLE — ternary balance between Verbreitung, Tiefe
 * and Mutation. Triangle coordinates use side length 1:
 *   V0 Verbreitung (top), V1 Tiefe (bottom left), V2 Mutation (bottom right).
 */
import { tr } from "@/lib/i18n";
import { mulberry32 } from "@/components/world/puzzles/rng";

export type Bary = readonly [number, number, number];

/** Display labels of the three corners (index = barycentric axis). */
export const MEMETIC_AXES: readonly string[] = [tr("Spread"), tr("Depth"), tr("Mutation")];

export const TRI_H = Math.sqrt(3) / 2;
export const TRI_VERTICES: readonly (readonly [number, number])[] = [
  [0.5, 0],
  [0, TRI_H],
  [1, TRI_H],
];

export const CENTROID: Bary = [1 / 3, 1 / 3, 1 / 3];

export function baryToXY(p: Bary): [number, number] {
  let x = 0;
  let y = 0;
  for (let i = 0; i < 3; i++) {
    x += p[i] * TRI_VERTICES[i][0];
    y += p[i] * TRI_VERTICES[i][1];
  }
  return [x, y];
}

export function xyToBary(x: number, y: number): Bary {
  const [[x0, y0], [x1, y1], [x2, y2]] = TRI_VERTICES;
  const det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / det;
  const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / det;
  return [a, b, 1 - a - b];
}

/** Clamp to the triangle (negative weights → 0, renormalised). */
export function clampBary(p: Bary): Bary {
  const a = Math.max(0, p[0]);
  const b = Math.max(0, p[1]);
  const c = Math.max(0, p[2]);
  const s = a + b + c;
  if (s <= 0) return CENTROID;
  return [a / s, b / s, c / s];
}

/** Euclidean distance in triangle units (side = 1). */
export function baryDistance(p: Bary, q: Bary): number {
  const [px, py] = baryToXY(p);
  const [qx, qy] = baryToXY(q);
  return Math.hypot(px - qx, py - qy);
}

/** Target zone centre: every weight ≥ 0.1 and clearly off the centroid. */
export function memeticTarget(seed: number): Bary {
  const rng = mulberry32(seed);
  for (let i = 0; i < 200; i++) {
    const a = rng();
    const b = rng();
    const c = rng();
    const s = a + b + c;
    if (s <= 0) continue;
    const p: Bary = [a / s, b / s, c / s];
    if (p.some((v) => v < 0.1)) continue;
    if (baryDistance(p, CENTROID) < 0.15) continue;
    return p;
  }
  return [0.55, 0.3, 0.15];
}

/** Memetic fitness 0..100 (≈ 85 at the zone edge, 100 at the centre). */
export function fitness(p: Bary, target: Bary, radius: number): number {
  const d = baryDistance(p, target);
  const r = Math.max(0.01, radius) * 2.5;
  return 100 * Math.exp(-((d / r) ** 2));
}

export function inTargetZone(p: Bary, target: Bary, radius: number): boolean {
  return baryDistance(p, target) <= radius;
}

/** Per-axis feedback: positive = too much of that axis, negative = too little. */
export function axisFeedback(p: Bary, target: Bary): [number, number, number] {
  return [p[0] - target[0], p[1] - target[1], p[2] - target[2]];
}

/** Drift velocity (triangle units per second before scaling by `drift`). */
export function jitter(t: number, seed: number): [number, number] {
  const ph = (seed % 997) * 0.37;
  const dx = Math.sin(1.3 * t + ph) + 0.6 * Math.sin(3.1 * t + 2 * ph) + 0.3 * Math.sin(7.7 * t);
  const dy =
    Math.cos(1.1 * t + 0.5 * ph) + 0.6 * Math.sin(2.7 * t + ph + 1) + 0.3 * Math.cos(6.3 * t);
  return [dx, dy];
}

/** Move a point by (dx, dy) in triangle units, staying inside. */
export function moveBary(p: Bary, dx: number, dy: number): Bary {
  const [x, y] = baryToXY(p);
  return clampBary(xyToBary(x + dx, y + dy));
}

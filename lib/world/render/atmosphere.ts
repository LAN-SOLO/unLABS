/**
 * Atmosphere — per-floor mood and timing helpers for the lab engine (pure).
 * ========================================================================
 *
 * Deep floors read colder and darker, the living quarters warmer. The
 * tint is a gentle final-image multiplier (CRT pass `uTint`), so palette
 * colours stay recognisable; the hemisphere sky and key light colour
 * carry most of the mood.
 */
import type { FloorId } from "@/lib/world/types";

export interface FloorMood {
  /** Final-image RGB multiplier (≈1). */
  tint: readonly [number, number, number];
  /** Hemisphere light sky colour. */
  sky: string;
  /** Multiplier for hemisphere + fill intensity. */
  ambient: number;
  /** Shadow-casting key light colour. */
  key: string;
  /** Multiplier for the key light. */
  keyGain: number;
  /** Dust mote colour for lit rooms. */
  motes: string;
}

const MOODS: Record<FloorId, FloorMood> = {
  // Oberdeck: neutral office light, a touch of blue daylight.
  0: {
    tint: [1, 1, 1.02],
    sky: "#9fb4d8",
    ambient: 1,
    key: "#ffe6c4",
    keyGain: 1,
    motes: "#ffe8c0",
  },
  // Energie & Fertigung: sodium-warm workshop.
  1: {
    tint: [1.03, 0.99, 0.94],
    sky: "#c2ab8c",
    ambient: 0.95,
    key: "#ffd9a8",
    keyGain: 1,
    motes: "#ffd08a",
  },
  // Signale & Anomalien: violet-cool.
  2: {
    tint: [0.98, 0.97, 1.05],
    sky: "#a39ad0",
    ambient: 0.9,
    key: "#e8e0ff",
    keyGain: 0.95,
    motes: "#d8ccff",
  },
  // Tiefenlabor: colder and darker.
  3: {
    tint: [0.93, 0.97, 1.06],
    sky: "#7f9cc4",
    ambient: 0.8,
    key: "#d6e6ff",
    keyGain: 0.9,
    motes: "#cfe2ff",
  },
  // Wohnquartiere & Observatorium: warm, homely.
  4: {
    tint: [1.05, 1, 0.92],
    sky: "#d8c2a0",
    ambient: 1.05,
    key: "#ffd6a0",
    keyGain: 1.05,
    motes: "#ffe0a8",
  },
  // Der Schacht: coldest and darkest.
  5: {
    tint: [0.88, 0.94, 1.08],
    sky: "#6a82aa",
    ambient: 0.68,
    key: "#c8dcff",
    keyGain: 0.82,
    motes: "#bcd4ff",
  },
};

export function floorMood(floor: FloorId): FloorMood {
  return MOODS[floor];
}

/**
 * Camera framing for a room: the look-at point drifts a little toward the
 * room centre so rooms feel composed, never more than `max` units.
 */
export function roomFramingOffset(
  px: number,
  pz: number,
  room: { x: number; z: number; w: number; d: number } | undefined,
  out: [number, number] = [0, 0],
  weight = 0.12,
  max = 2.5,
): [number, number] {
  if (!room) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  let dx = (room.x + room.w / 2 - px) * weight;
  let dz = (room.z + room.d / 2 - pz) * weight;
  const len = Math.hypot(dx, dz);
  if (len > max) {
    dx *= max / len;
    dz *= max / len;
  }
  out[0] = dx;
  out[1] = dz;
  return out;
}

/**
 * Seconds until an unstable (starved) device throws its next spark / heat
 * puff. Calm mode (reduced flicker) spaces them out three times.
 */
export function brownoutInterval(rnd: number, calm: boolean): number {
  return (0.7 + rnd * 1.6) * (calm ? 3 : 1);
}

/** Ids that became online since the previous power state (power-on flashes). */
export function newlyOnline(prev: ReadonlySet<string> | null, next: ReadonlySet<string>): string[] {
  if (!prev) return [];
  const out: string[] = [];
  for (const id of next) if (!prev.has(id)) out.push(id);
  return out;
}

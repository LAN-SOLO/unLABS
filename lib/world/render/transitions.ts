/**
 * State-transition curves — pure, allocation-free, no three.js.
 * ============================================================
 *
 * The engine animates state changes instead of snapping them: devices
 * spin up / wind down when their power changes, finished build stages
 * drop in with a bounce under a scan line, taken pickups fly to the
 * player, read notes fold away, unlocked doors retract their bolts.
 * Everything here maps a normalised time (0..1) or a ramp value to a
 * pose, so it is deterministic and unit-tested (tests/world/render-*.test.ts).
 */
import {
  animTransform,
  type AnimKind,
  type AnimPart,
  type AnimState,
} from "@/lib/world/models/anim";

// ── Easing ───────────────────────────────────────────────────────

function clamp01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/** Smoothstep ease-in-out on [0, 1]. */
export function easeInOut(t: number): number {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
}

export function easeInCubic(t: number): number {
  const k = clamp01(t);
  return k * k * k;
}

export function easeOutCubic(t: number): number {
  const k = 1 - clamp01(t);
  return 1 - k * k * k;
}

/** Overshoots past 1 and settles (`s` = overshoot strength, 1.70158 ≈ 10 %). */
export function easeOutBack(t: number, s = 1.70158): number {
  const k = clamp01(t) - 1;
  return 1 + (s + 1) * k * k * k + s * k * k;
}

/** Classic bouncing-ball ease: lands at 1 with three shrinking bounces. */
export function easeOutBounce(t: number): number {
  const k = clamp01(t);
  const n = 7.5625;
  const d = 2.75;
  if (k < 1 / d) return n * k * k;
  if (k < 2 / d) {
    const u = k - 1.5 / d;
    return n * u * u + 0.75;
  }
  if (k < 2.5 / d) {
    const u = k - 2.25 / d;
    return n * u * u + 0.9375;
  }
  const u = k - 2.625 / d;
  return n * u * u + 0.984375;
}

/** Deterministic 0..1 noise for an integer step (same hash as anim.ts). */
export function stepNoise(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// ── Device power ramp ────────────────────────────────────────────

/** Seconds from dark to full power (spin-up, lights fade in). */
export const POWER_RAMP_UP = 1.5;
/** Seconds from full power to dark (wind-down, lights stutter out). */
export const POWER_RAMP_DOWN = 1.1;

/**
 * Advance a linear 0..1 power ramp toward `target` (1 = on). Up and down
 * run at their own speeds; the result is clamped and lands exactly on the target.
 */
export function stepRamp(
  value: number,
  target: 0 | 1,
  dt: number,
  up = POWER_RAMP_UP,
  down = POWER_RAMP_DOWN,
): number {
  if (dt <= 0) return value;
  if (target === 1) return up <= 0 ? 1 : Math.min(1, value + dt / up);
  return down <= 0 ? 0 : Math.max(0, value - dt / down);
}

/**
 * Speed multiplier of animated parts for a ramp value: eases in on the way
 * up (motors take a moment to bite) and out on the way down (inertia).
 */
export function spinFactor(ramp: number): number {
  return easeInOut(ramp);
}

/**
 * Emissive / light multiplier for a ramp value at engine time `t`.
 * Powering up, the glow fades in behind a short fluorescent-tube flicker
 * (first ~45 % of the ramp); powering down it dims with a stutter. With
 * `calm` (reduce flicker) both are plain fades.
 */
export function glowFactor(ramp: number, t: number, rising: boolean, calm: boolean): number {
  const r = clamp01(ramp);
  if (r >= 1) return 1;
  if (r <= 0) return 0;
  const base = rising ? easeInOut(r) : r * r;
  if (calm) return base;
  if (rising) {
    if (r > 0.45) return base;
    // Strike attempts: dark gaps get rarer as the tube catches.
    const on = stepNoise(Math.floor(t * 24)) < 0.35 + r * 1.3;
    return on ? Math.max(base, 0.55 * r + 0.25) : base * 0.1;
  }
  // Stutter while dying: occasional drop-outs, more as it fades.
  const drop = stepNoise(Math.floor(t * 18) + 7) > 0.25 + r * 0.6;
  return drop ? base * 0.2 : base;
}

/** Per-rig animation clock and power-ramp factors (owned by the engine's device view). */
export interface RigRamp {
  /** Animation time of the rig's powered parts (advances at `speed` × real time). */
  clock: number;
  /** Speed / amplitude multiplier 0..1 (`spinFactor`). */
  speed: number;
  /** Emissive / light multiplier 0..1 (`glowFactor`). */
  glow: number;
}

/** Motions that accumulate (angle keeps growing): they slow down and stop where they are. */
const ACCUMULATING: ReadonlySet<AnimKind> = new Set<AnimKind>(["spin", "orbit", "step"]);

/**
 * Pose of a power-requiring part on a ramping rig. The part runs on the
 * rig's own `clock` (which the engine advances at `speed`), so spinners
 * spin up and coast to a stop without ever jumping; oscillating parts
 * (bob, sway, piston, …) also scale their travel by `speed`, settling at
 * their rest pose when dark — exactly the unpowered pose of `animTransform`.
 * Emissive intensity follows `glow`; blinking overlays stay hidden when dark.
 */
export function rampedTransform(
  part: AnimPart,
  clock: number,
  speed: number,
  glow: number,
): AnimState {
  const st = animTransform(part, clock, true);
  const amp = Math.max(0, Math.min(1, speed));
  if (!ACCUMULATING.has(part.kind) && amp < 1) {
    for (let i = 0; i < 3; i++) {
      st.rot[i] = st.rot[i]! * amp;
      st.pos[i] = st.pos[i]! * amp;
    }
  }
  st.intensity *= Math.max(0, Math.min(1, glow));
  if (part.kind === "blink") st.visible = st.visible && glow > 0.02;
  return st;
}

// ── Build-stage assembly flourish ────────────────────────────────

/** Duration of the "stage complete" flourish (seconds). */
export const ASSEMBLY_TIME = 0.9;
/** Drop height of the new stage mesh (world units). */
export const ASSEMBLY_DROP = 1.4;

export interface AssemblyPose {
  /** Extra height of the device (world units, ≥ 0). */
  lift: number;
  /** Vertical squash (1 = rest; < 1 on impact). */
  squashY: number;
  /** Scan-line sweep 0 (floor) .. 1 (top). */
  scan: number;
  /** Scan-line opacity 0..1. */
  scanAlpha: number;
  /** True once the device has first touched down. */
  landed: boolean;
}

/**
 * Pose of the assembly flourish at normalised time `k` (0..1). The model
 * drops in with a bounce over the first 60 %, squashing on each impact,
 * while a scan line sweeps bottom → top. `still` (reduce motion) keeps the
 * model in place and shows the scan line only.
 */
export function assemblyPose(k: number, still = false): AssemblyPose {
  const u = clamp01(k);
  const scan = easeOutCubic(u / 0.85);
  const scanAlpha = u < 0.1 ? u / 0.1 : 1 - easeInCubic((u - 0.1) / 0.9);
  if (still) return { lift: 0, squashY: 1, scan, scanAlpha, landed: true };
  const d = clamp01(u / 0.6);
  const fall = easeOutBounce(d);
  const lift = (1 - fall) * ASSEMBLY_DROP;
  // First contact of easeOutBounce is at d = 1/2.75.
  const landed = d >= 1 / 2.75;
  // Squash right after an impact: strongest at first contact, fading out.
  const impact = landed ? Math.max(0, 1 - lift / (ASSEMBLY_DROP * 0.25)) * (1 - d) : 0;
  return { lift, squashY: 1 - 0.12 * impact, scan, scanAlpha, landed };
}

// ── Pickups & notes ──────────────────────────────────────────────

/** Seconds a taken pickup flies toward the player. */
export const PICKUP_FLIGHT_TIME = 0.3;
/** Seconds a read note takes to fold away. */
export const NOTE_FOLD_TIME = 0.35;

export interface FlightPose {
  /** Lerp factor start → player (0..1). */
  travel: number;
  /** Extra arc height (world units). */
  arc: number;
  /** Uniform scale (1 → 0.15). */
  scale: number;
  /** Spin around y (rad). */
  spin: number;
}

/** A taken pickup at normalised flight time `k`: lifts, spins, accelerates in and shrinks. */
export function pickupFlight(k: number): FlightPose {
  const u = clamp01(k);
  return {
    travel: easeInCubic(u),
    arc: Math.sin(u * Math.PI) * 1.2,
    scale: 1 - 0.85 * easeInCubic(u),
    spin: u * Math.PI * 2,
  };
}

export interface FoldPose {
  /** Scale across the page (x). */
  scaleX: number;
  /** Scale along the page (z) — folds in half first. */
  scaleZ: number;
  /** Tilt while folding (rad). */
  tilt: number;
  /** Glow multiplier 1 → 0. */
  glow: number;
}

/** A note folding away at normalised time `k`: halves, halves again, gone. */
export function noteFold(k: number): FoldPose {
  const u = clamp01(k);
  const first = easeInOut(u / 0.5);
  const second = easeInOut((u - 0.5) / 0.5);
  return {
    scaleX: 1 - 0.5 * first - 0.5 * second,
    scaleZ: 1 - 0.5 * first - 0.4 * second,
    tilt: Math.sin(u * Math.PI) * 0.5,
    glow: 1 - easeInOut(u),
  };
}

// ── Door unlock ──────────────────────────────────────────────────

/** Bolts retract over this long; the door stays shut until then. */
export const UNLOCK_HOLD = 0.35;
/** Total length of the unlock sequence (beacon flashes finish while the door opens). */
export const UNLOCK_TIME = 0.85;
/** When the beacon turns green (and the chirp plays). */
export const UNLOCK_CHIRP_AT = 0.3;

export type UnlockLight = "old" | "green" | "off";

export interface UnlockPose {
  /** Bolt retraction 0 (thrown) .. 1 (inside the leaf). */
  bolt: number;
  /** Which beacon shows. */
  light: UnlockLight;
  /** Keypad flash plate visible. */
  keyFlash: boolean;
  /** The door may start to open. */
  release: boolean;
  done: boolean;
}

/**
 * Door unlock at time `t` (seconds since the lock was satisfied). The old
 * beacon strobes while the bolts slide back, then green blinks twice and
 * stays; keypad doors flash their pad. `calm` (reduce flicker): no strobe.
 */
export function unlockPose(t: number, calm = false): UnlockPose {
  const bolt = easeInOut(t / UNLOCK_HOLD);
  let light: UnlockLight;
  if (t < UNLOCK_CHIRP_AT) light = calm || Math.floor(t / 0.075) % 2 === 0 ? "old" : "off";
  else if (!calm && t < UNLOCK_CHIRP_AT + 0.4)
    light = Math.floor((t - UNLOCK_CHIRP_AT) / 0.1) % 2 === 0 ? "green" : "off";
  else light = "green";
  const keyFlash = t < UNLOCK_TIME - 0.15 && (calm || Math.floor(t / 0.09) % 2 === 0);
  return { bolt, light, keyFlash, release: t >= UNLOCK_HOLD, done: t >= UNLOCK_TIME };
}

// ── Elevator cage light sweep ────────────────────────────────────

/** Spacing (world units) between the shaft light bands passing the cage. */
export const SHAFT_BAND_GAP = 2.6;

/**
 * Height of the shaft light band inside the cage (0..gap) for a platform
 * offset: bands are fixed to the shaft, so they slide past opposite to travel.
 */
export function shaftBandY(offset: number, gap = SHAFT_BAND_GAP): number {
  const r = (-offset * 1.8) % gap;
  return r < 0 ? r + gap : r;
}

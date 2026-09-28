/**
 * Motion helpers — pure, allocation-free smoothing used by the engine.
 * ===================================================================
 *
 * No three.js import so they run in tests. Angles are radians.
 */

const TAU = Math.PI * 2;

/** Wrap an angle into [−π, π). */
export function wrapAngle(a: number): number {
  let r = (a + Math.PI) % TAU;
  if (r < 0) r += TAU;
  return r - Math.PI;
}

/** Shortest signed difference `to − from` in [−π, π). */
export function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/**
 * Turn `current` toward `target` along the shortest arc: exponential ease
 * (`rate`, 1/s) capped at `maxSpeed` rad/s so large turns never snap.
 */
export function turnToward(
  current: number,
  target: number,
  dt: number,
  rate = 6,
  maxSpeed = 5,
): number {
  const d = angleDelta(current, target);
  const eased = d * (1 - Math.exp(-Math.max(0, dt) * rate));
  const cap = maxSpeed * Math.max(0, dt);
  const step = Math.max(-cap, Math.min(cap, eased));
  return wrapAngle(current + step);
}

/** Velocity carrier for `smoothDamp` (one per smoothed axis). */
export interface DampState {
  v: number;
}

/**
 * Critically damped spring (Unity-style SmoothDamp): eases in AND out, never
 * overshoots on a fixed target, stays stable with large `dt`.
 */
export function smoothDamp(
  s: DampState,
  current: number,
  target: number,
  smoothTime: number,
  dt: number,
): number {
  if (dt <= 0) return current;
  const st = Math.max(1e-4, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (s.v + omega * change) * dt;
  s.v = (s.v - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  // Prevent overshoot past the target.
  if (target - current > 0 === out > target) {
    out = target;
    s.v = 0;
  }
  return out;
}

/** Smoothstep 0..1 over `t` in [0, 1]. */
export function smoothstep01(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

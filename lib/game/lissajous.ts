/**
 * Lissajous pure-logic helpers
 * ============================
 *
 * The EP1 calibration minigame asks the player to tune two sine inputs until
 * their ratio locks onto a target (the "stable figure"). All the math lives
 * here so the React component stays a thin shell and so the lock rule can be
 * exercised in isolation.
 *
 * Terminology:
 *   - target ratio:   the expected frequency ratio the player is tuning to
 *                     (e.g. 2:3). Expressed as a single scalar `targetRatio`.
 *   - current ratio:  freq1 / freq2 at the instant the sample was taken.
 *   - error:          |current - target| / target  (dimensionless, 0 = perfect).
 *   - lock threshold: error must stay below this for `holdSamples` consecutive
 *                     samples before the figure is considered locked.
 *
 * Sampling is done by the React component at ~60Hz. This file never touches
 * timers — callers feed it samples and ask for the current lock state.
 */

export interface LockConfig {
  targetRatio: number;
  /** Dimensionless error threshold for a single sample to count as "on target". */
  errorThreshold: number;
  /** Consecutive on-target samples needed to flip to locked. */
  holdSamples: number;
}

export const DEFAULT_LOCK_CONFIG: LockConfig = {
  targetRatio: 2 / 3,
  errorThreshold: 0.02, // 2% — tight enough to feel earned, loose enough to be reachable
  holdSamples: 30, // ~0.5s at 60Hz
};

export function computeRatioError(freq1: number, freq2: number, targetRatio: number): number {
  if (freq2 === 0) return Number.POSITIVE_INFINITY;
  const current = freq1 / freq2;
  if (targetRatio === 0) return Number.POSITIVE_INFINITY;
  return Math.abs(current - targetRatio) / targetRatio;
}

export interface LockState {
  /** Number of consecutive on-target samples observed so far. */
  holdCount: number;
  /** True once holdCount has reached holdSamples. Latches. */
  locked: boolean;
}

export function createInitialLockState(): LockState {
  return { holdCount: 0, locked: false };
}

/**
 * Apply one sample to the lock state and return the next state. Latches on
 * lock — once locked, further samples leave the state alone so a jittery
 * knob doesn't un-lock the figure mid-celebration.
 */
export function stepLockState(prev: LockState, error: number, config: LockConfig): LockState {
  if (prev.locked) return prev;
  if (error <= config.errorThreshold) {
    const holdCount = prev.holdCount + 1;
    return { holdCount, locked: holdCount >= config.holdSamples };
  }
  return { holdCount: 0, locked: false };
}

/**
 * Sample a point on a Lissajous figure.
 *   x(t) = A * sin(a*t + delta)
 *   y(t) = B * sin(b*t)
 */
export function lissajousPoint(
  t: number,
  freq1: number,
  freq2: number,
  ampX: number,
  ampY: number,
  phase: number,
): { x: number; y: number } {
  return {
    x: ampX * Math.sin(freq1 * t + phase),
    y: ampY * Math.sin(freq2 * t),
  };
}

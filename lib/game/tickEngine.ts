/**
 * Tick engine — pure logic for the idle game loop.
 *
 * This module is intentionally framework-agnostic and free of side effects so
 * it can be exercised by tests and by the React provider alike. The provider
 * owns wall-clock time and calls these functions; this file owns the math.
 *
 * Design notes:
 *   - A "tick" is one second of game time. The provider drives ticks at 1Hz.
 *   - Offline progress: when the tab resumes, the provider asks the engine to
 *     fast-forward N ticks based on (now - lastTickAt). The engine clamps this
 *     so an idle overnight tab does not explode the resource state.
 *   - Rates are expressed as units-per-second so a tick is a trivial addition.
 */

export const TICK_INTERVAL_MS = 1000;

/** Hard cap on offline catch-up: anything beyond this is silently truncated. */
export const MAX_OFFLINE_SECONDS = 60 * 60 * 8; // 8 hours

export type ResourceId =
  | "abstractum"
  | "energy"
  | "base_alloy"
  | "advanced_alloy"
  | "nanomaterial"
  | "exotic_matter"
  | "antimatter"
  | "research";

export interface ResourceState {
  /** Current stored amount. */
  amount: number;
  /** Cap; pass Infinity for "uncapped". */
  capacity: number;
  /** Net rate in units per second (can be negative). */
  ratePerSecond: number;
  /** Lifetime sum of positive applied deltas. Absent on pre-monitoring saves — read with `?? 0`. */
  totalProduced?: number;
  /** Lifetime sum of negative applied deltas (as a positive magnitude). Absent on pre-monitoring saves — read with `?? 0`. */
  totalConsumed?: number;
}

export type ResourceMap = Partial<Record<ResourceId, ResourceState>>;

export interface TickResult {
  nextResources: ResourceMap;
  /** Per-resource delta actually applied (post-capacity clamp). */
  deltas: Partial<Record<ResourceId, number>>;
  /** Number of in-game seconds simulated during this tick. */
  elapsedSeconds: number;
}

/**
 * Advance the resource state by `elapsedSeconds`. Pure function.
 * Each resource is clamped to [0, capacity]. Deltas reflect actual applied
 * change, not the theoretical `rate * elapsed`.
 */
export function advanceResources(resources: ResourceMap, elapsedSeconds: number): TickResult {
  const seconds = Math.max(0, elapsedSeconds);
  const nextResources: ResourceMap = {};
  const deltas: Partial<Record<ResourceId, number>> = {};

  for (const [id, state] of Object.entries(resources) as Array<[ResourceId, ResourceState]>) {
    const theoretical = state.ratePerSecond * seconds;
    const target = state.amount + theoretical;
    const clamped = Math.max(0, Math.min(state.capacity, target));
    const applied = clamped - state.amount;
    deltas[id] = applied;
    nextResources[id] = {
      ...state,
      amount: clamped,
      totalProduced: (state.totalProduced ?? 0) + Math.max(0, applied),
      totalConsumed: (state.totalConsumed ?? 0) + Math.max(0, -applied),
    };
  }

  return { nextResources, deltas, elapsedSeconds: seconds };
}

/**
 * Compute how much game time to simulate given a wall-clock gap.
 * Returns the clamped elapsed seconds and whether truncation occurred.
 */
export function computeElapsedSeconds(
  lastTickAt: number | null,
  now: number,
): { elapsedSeconds: number; truncated: boolean } {
  if (lastTickAt == null || lastTickAt <= 0 || now <= lastTickAt) {
    return { elapsedSeconds: 0, truncated: false };
  }
  const raw = Math.floor((now - lastTickAt) / 1000);
  if (raw > MAX_OFFLINE_SECONDS) {
    return { elapsedSeconds: MAX_OFFLINE_SECONDS, truncated: true };
  }
  return { elapsedSeconds: raw, truncated: false };
}

/**
 * Cold-start resource state per the GDD (EP0 "Cold Boot"):
 *   - Abstractum starts seeping in at +1/min once UEC-001 powers on (handled
 *     elsewhere by the quest engine flipping the rate). Default rate is 0 so
 *     a brand new operator does not accrue resources before the tutorial.
 *   - Energy starts at 0 capacity until UEC-001 is activated.
 */
export function createInitialResources(): ResourceMap {
  const zeroed = { totalProduced: 0, totalConsumed: 0 };
  return {
    abstractum: { amount: 0, capacity: 100, ratePerSecond: 0, ...zeroed },
    energy: { amount: 0, capacity: 0, ratePerSecond: 0, ...zeroed },
    base_alloy: { amount: 0, capacity: 50, ratePerSecond: 0, ...zeroed },
    advanced_alloy: { amount: 0, capacity: 25, ratePerSecond: 0, ...zeroed },
    nanomaterial: { amount: 0, capacity: 10, ratePerSecond: 0, ...zeroed },
    exotic_matter: { amount: 0, capacity: 5, ratePerSecond: 0, ...zeroed },
    antimatter: { amount: 0, capacity: 1, ratePerSecond: 0, ...zeroed },
    research: { amount: 0, capacity: 9999, ratePerSecond: 0, ...zeroed },
  };
}

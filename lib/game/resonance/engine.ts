/**
 * Resonance engine — sliding window evaluator
 * =============================================
 *
 * Pure functions that evaluate resonance protocols against a buffer of
 * recent state events. The buffer is ephemeral (not persisted) — it
 * rebuilds from scratch on page load, ensuring protocols require
 * real-time action sequences.
 *
 * The engine maintains a circular buffer of the last BUFFER_DURATION_MS
 * worth of events. On each game tick, it evaluates all undiscovered
 * protocols against the buffer.
 */

import type { ResonanceMatch, ResonanceProtocol, ResonanceStep, StateEvent } from "./types";

/** How long events stay in the buffer (120 seconds). */
export const BUFFER_DURATION_MS = 120 * 1000;

/**
 * Check if a single resonance step is satisfied by any event in the
 * buffer within the given time window.
 */
function isStepSatisfied(
  step: ResonanceStep,
  buffer: StateEvent[],
  windowStartMs: number,
  windowEndMs: number,
): boolean {
  return buffer.some((event) => {
    // Must be within the time window
    if (event.timestamp < windowStartMs || event.timestamp > windowEndMs) {
      return false;
    }

    // Must match the step kind
    if (event.kind !== step.kind) return false;

    // Device ID match (if applicable)
    if (step.deviceId && event.deviceId !== step.deviceId) return false;

    // Parameter match (if applicable)
    if (step.param && event.param !== step.param) return false;

    // Command match (if applicable)
    if (step.command && event.command !== step.command) return false;

    // Evaluate the condition
    return evaluateCondition(step.condition, event.value);
  });
}

/**
 * Evaluate a condition string against a value.
 * Supports: == value, >= value, > value, <= value, < value, active, executed
 */
function evaluateCondition(condition: string, value: string): boolean {
  const trimmed = condition.trim();

  // Simple keyword conditions
  if (trimmed === "active") return value === "active" || value === "true" || value === "1";
  if (trimmed === "executed") return value === "executed" || value === "true" || value === "1";
  if (trimmed === "purge") return value === "purge";

  // Comparison operators
  const match = trimmed.match(/^(==|>=|>|<=|<)\s*(.+)$/);
  if (!match) return value === trimmed; // fallback: exact string match

  const [, op, expected] = match;
  const expectedTrimmed = expected.trim();

  // Try numeric comparison
  const numValue = parseFloat(value);
  const numExpected = parseFloat(expectedTrimmed);

  if (!isNaN(numValue) && !isNaN(numExpected)) {
    switch (op) {
      case "==":
        return numValue === numExpected;
      case ">=":
        return numValue >= numExpected;
      case ">":
        return numValue > numExpected;
      case "<=":
        return numValue <= numExpected;
      case "<":
        return numValue < numExpected;
    }
  }

  // Fall back to string comparison for ==
  if (op === "==") return value === expectedTrimmed;

  return false;
}

/**
 * Evaluate all protocols against the event buffer. Returns an array of
 * matched protocols (may be empty).
 *
 * Pure function — no side effects.
 */
export function evaluateResonance(
  buffer: StateEvent[],
  protocols: ResonanceProtocol[],
  discoveredFlags: Record<string, boolean>,
): ResonanceMatch[] {
  const now = Date.now();
  const matches: ResonanceMatch[] = [];

  for (const protocol of protocols) {
    // Skip already discovered non-repeatable protocols
    const isDiscovered = discoveredFlags[protocol.discoveryFlag] === true;
    if (isDiscovered && !protocol.repeatable) continue;

    // Check if all steps are satisfied within the protocol's window
    const windowMs = protocol.windowSec * 1000;
    const windowStartMs = now - windowMs;
    const windowEndMs = now;

    const allSatisfied = protocol.sequence.every((step) =>
      isStepSatisfied(step, buffer, windowStartMs, windowEndMs),
    );

    if (allSatisfied) {
      matches.push({
        protocolId: protocol.id,
        isFirstDiscovery: !isDiscovered,
        rewards: isDiscovered ? [] : protocol.rewards,
      });
    }
  }

  return matches;
}

/**
 * Prune old events from the buffer. Returns a new array without events
 * older than BUFFER_DURATION_MS.
 */
export function pruneBuffer(buffer: StateEvent[], now: number): StateEvent[] {
  const cutoff = now - BUFFER_DURATION_MS;
  const pruned = buffer.filter((e) => e.timestamp >= cutoff);
  // Only return a new array if something was actually pruned
  return pruned.length === buffer.length ? buffer : pruned;
}

/**
 * Add an event to the buffer. Auto-prunes old events.
 */
export function pushEvent(buffer: StateEvent[], event: StateEvent): StateEvent[] {
  const pruned = pruneBuffer(buffer, event.timestamp);
  return [...pruned, event];
}

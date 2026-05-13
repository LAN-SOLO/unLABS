/**
 * Hint escalation engine — pure math.
 *
 * MissionProvider already computes a per-objective `hintLevel` (0/1/2) based
 * on `lastActivityAt`. This engine layers a **global** escalation on top:
 *
 *   - Take the most stalled active objective's elapsed time
 *   - Map it to a single global level (0..3) using broader thresholds
 *     (60 s / 300 s / 900 s)
 *   - Detect upward transitions so the caller knows when to fire a side
 *     effect (journal entry, notification, tips bar update)
 *
 * Keeping this file side-effect-free makes it trivially unit-testable and
 * lets the React provider own all of the I/O.
 */
export type HintLevel = 0 | 1 | 2 | 3;

export const HINT_THRESHOLDS_MS: Record<Exclude<HintLevel, 0>, number> = {
  1: 60 * 1000, // 60 s   — gentle nudge
  2: 5 * 60 * 1000, // 5 min  — surface whatNext in tips
  3: 15 * 60 * 1000, // 15 min — notify + journal HINT entry
};

export interface ObjectiveIdleSnapshot {
  /** Objective id (unique across missions). */
  objectiveId: string;
  /** Mission id the objective belongs to (for suggestion attribution). */
  missionId: string;
  /** Last time the player made progress on this objective. */
  lastActivityAt: number | null;
  /** True when the objective still needs progress. */
  active: boolean;
}

/**
 * Map an elapsed-ms value to the corresponding global hint level.
 */
export function levelForElapsed(elapsedMs: number): HintLevel {
  if (elapsedMs >= HINT_THRESHOLDS_MS[3]) return 3;
  if (elapsedMs >= HINT_THRESHOLDS_MS[2]) return 2;
  if (elapsedMs >= HINT_THRESHOLDS_MS[1]) return 1;
  return 0;
}

export interface GlobalHintState {
  /** Current level derived from the most-stalled active objective. */
  level: HintLevel;
  /** Elapsed ms since last activity on the most stalled objective. */
  elapsedMs: number;
  /** ID of the objective driving the level; null when no active objectives. */
  drivingObjectiveId: string | null;
  /** Mission id the objective belongs to; null when no active objectives. */
  drivingMissionId: string | null;
}

export function computeGlobalHint(
  snapshots: ObjectiveIdleSnapshot[],
  now: number,
): GlobalHintState {
  let best: GlobalHintState = {
    level: 0,
    elapsedMs: 0,
    drivingObjectiveId: null,
    drivingMissionId: null,
  };

  for (const snap of snapshots) {
    if (!snap.active) continue;
    if (snap.lastActivityAt == null) continue;
    const elapsed = now - snap.lastActivityAt;
    if (elapsed <= 0) continue;
    const level = levelForElapsed(elapsed);
    if (level > best.level || (level === best.level && elapsed > best.elapsedMs)) {
      best = {
        level,
        elapsedMs: elapsed,
        drivingObjectiveId: snap.objectiveId,
        drivingMissionId: snap.missionId,
      };
    }
  }

  return best;
}

/**
 * Detect an upward edge on the global level. Used by the provider to fire
 * exactly one side effect per escalation, not once per tick while the player
 * remains idle at the same level.
 */
export function isEscalation(previousLevel: HintLevel, nextLevel: HintLevel): boolean {
  return nextLevel > previousLevel;
}

export const HINT_LEVEL_LABEL: Record<HintLevel, string> = {
  0: "nominal",
  1: "drift",
  2: "stall",
  3: "lost",
};

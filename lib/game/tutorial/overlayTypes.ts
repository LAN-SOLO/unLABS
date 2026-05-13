/**
 * Tutorial-overlay step model
 * ===========================
 *
 * Pure types describing one step in the easy-mode interactive walkthrough.
 * The overlay observer (contexts/TutorialOverlayObserver.tsx) walks these
 * sequentially, advancing when a step's `advance` predicate flips truthy.
 *
 * Steps are intentionally declarative so adding new ones is data-only — no
 * imperative state machine, no per-step React component to write.
 */

/** State shape the predicates observe. Keep narrow so steps can stay pure. */
export interface OverlayObservation {
  /** quest.state.flags */
  questFlags: Record<string, boolean>;
  /** Mission status by id (active|completed|locked|claimed|available). */
  missionStatus: Record<string, string>;
  /** Per-objective status keyed by `${missionId}.${objectiveId}`. */
  objectiveStatus: Record<string, string>;
  /** True if the resources panel is mounted (player is on /panel). */
  onPanel: boolean;
  /** True if the lab/production view is open. */
  onLab: boolean;
}

/**
 * `advance` predicates run on every observation tick. The first step whose
 * predicate is satisfied (and that's not yet completed) becomes the current
 * step; the next satisfied predicate auto-advances.
 *
 * `kind: "manual"` means the player has to click the "Got it" button — used
 * for purely informational steps that don't have a state side effect.
 */
export type OverlayAdvance =
  | { kind: "manual" }
  | { kind: "questFlag"; flag: string; value: boolean }
  | { kind: "missionStatus"; missionId: string; status: string }
  | { kind: "objectiveStatus"; key: string; status: string }
  | { kind: "anyOf"; conditions: OverlayAdvance[] };

export type OverlayPosition = "top" | "bottom" | "left" | "right" | "center";

export interface OverlayStep {
  /** Stable id — used in step-index lookup and analytics. */
  id: string;
  /** Title shown in the step card. */
  title: string;
  /** Body copy. Plain text; line breaks become paragraph breaks. */
  body: string;
  /**
   * CSS selector pointing at the UI element to highlight. Optional — when
   * null, the card floats in `position` without a target ring.
   */
  target?: string | null;
  /** Where the step card renders relative to target (or viewport if no target). */
  position?: OverlayPosition;
  /** What advances the step. */
  advance: OverlayAdvance;
  /**
   * If true, the player can press "Got it" to skip ahead even when the
   * predicate is not yet satisfied. Useful for informational steps where
   * the player might already be ahead.
   */
  allowSkipAhead?: boolean;
}

/** Evaluates an advance predicate against an observation. */
export function predicateSatisfied(predicate: OverlayAdvance, obs: OverlayObservation): boolean {
  switch (predicate.kind) {
    case "manual":
      return false;
    case "questFlag":
      return (obs.questFlags[predicate.flag] ?? false) === predicate.value;
    case "missionStatus":
      return obs.missionStatus[predicate.missionId] === predicate.status;
    case "objectiveStatus":
      return obs.objectiveStatus[predicate.key] === predicate.status;
    case "anyOf":
      return predicate.conditions.some((c) => predicateSatisfied(c, obs));
  }
}

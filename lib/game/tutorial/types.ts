/**
 * Tutorial state & skip-equivalent rewards.
 *
 * Pure types and helpers only — safe to import from both client and server.
 * Skip-equivalent rewards model "what EP0 + EP1 would have granted if the
 * player had played through them", so hard-skippers land in roughly the same
 * mechanical state as a completed onboarding without breaking the idle loop.
 */

import type { StepReward } from "@/lib/game/quests/types";

export type TutorialPhase = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Difficulty toggles between two distinct guidance UXs:
 *   - "easy"  → interactive overlay walks the player through commands
 *   - "hard"  → immediate hints in the mission panel + `guide` terminal command
 *   - null    → not yet chosen (DifficultyPicker modal will prompt at boot)
 */
export type TutorialDifficulty = "easy" | "hard" | null;

export interface TutorialState {
  /** Player completed the guided flow normally. */
  completed: boolean;
  /** Player used `tutorial skip` to jump past the flow. */
  skipped: boolean;
  /** Latest phase reached (0 = never started, 5 = autonomy/open-world). */
  currentPhase: TutorialPhase;
  /** ISO timestamp of the last WelcomeBackModal dismissal (null = never). */
  welcomeBackAckAt: string | null;
  /** Difficulty selected at first launch. null = picker not yet shown/answered. */
  difficulty: TutorialDifficulty;
  /** Tutorial-overlay step index (easy mode only). 0 = not started, -1 = dismissed. */
  overlayStepIndex: number;
}

export function createInitialTutorialState(): TutorialState {
  return {
    completed: false,
    skipped: false,
    currentPhase: 0,
    welcomeBackAckAt: null,
    difficulty: null,
    overlayStepIndex: 0,
  };
}

/**
 * Merge an unknown blob (coming from profiles.tutorial_state JSONB) into the
 * canonical shape. Tolerant of missing / malformed fields so save migrations
 * don't strand players on old schemas.
 */
export function hydrateTutorialState(raw: unknown): TutorialState {
  const defaults = createInitialTutorialState();
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Partial<TutorialState>;
  const rawPhase = typeof obj.currentPhase === "number" ? obj.currentPhase : defaults.currentPhase;
  const currentPhase = (Math.max(0, Math.min(5, Math.floor(rawPhase))) as TutorialPhase) ?? 0;
  const rawDifficulty =
    obj.difficulty === "easy" || obj.difficulty === "hard" ? obj.difficulty : null;
  const rawOverlayStep =
    typeof obj.overlayStepIndex === "number" && Number.isFinite(obj.overlayStepIndex)
      ? Math.floor(obj.overlayStepIndex)
      : defaults.overlayStepIndex;
  return {
    completed: typeof obj.completed === "boolean" ? obj.completed : defaults.completed,
    skipped: typeof obj.skipped === "boolean" ? obj.skipped : defaults.skipped,
    currentPhase,
    welcomeBackAckAt:
      typeof obj.welcomeBackAckAt === "string" ? obj.welcomeBackAckAt : defaults.welcomeBackAckAt,
    difficulty: rawDifficulty,
    overlayStepIndex: rawOverlayStep,
  };
}

/**
 * Sentinel episode id used after a skip. `getEpisode()` returns null for
 * unknown ids, which hides the QuestOverlay — exactly the behavior we want.
 */
export const SKIPPED_EPISODE_ID = "SKIPPED";

/**
 * Flags that should be set after a hard-skip so downstream systems see the
 * same progression state as a normally-completed EP0 + EP1.
 */
export const SKIP_FLAGS: Record<string, boolean> = {
  ep0_complete: true,
  osc_001_online: true,
  lissajous_locked: true,
  anomaly_mode: true,
  missions_unlocked: true,
};

/**
 * Cumulative rewards a skipping player should receive. Mirrors the net
 * resource state after EP0 (ep0.ignite + ep0.seep + ep0.handoff) and EP1
 * (ep1.power_on + ep1.reveal).
 *
 * Keeping this as a declarative list lets the same apply-path that handles
 * quest rewards handle skip rewards — no branching at the call site.
 */
export const SKIP_REWARDS: StepReward[] = [
  // Energy online (UEC-001 + OSC-001 net: 50 - 18 = 32)
  { kind: "set_resource_capacity", resourceId: "energy", capacity: 500 },
  { kind: "set_resource_rate", resourceId: "energy", ratePerSecond: 32 },
  // Abstractum seep at 1/min
  { kind: "set_resource_rate", resourceId: "abstractum", ratePerSecond: 1 / 60 },
  // Starter grants
  { kind: "grant_resource", resourceId: "abstractum", amount: 5 },
  { kind: "grant_resource", resourceId: "research", amount: 1 },
];

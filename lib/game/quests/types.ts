/**
 * Quest engine types
 * ==================
 *
 * An Episode is a linear sequence of Steps the player walks through during a
 * narrative beat (e.g. EP0 "Cold Boot"). Each step carries:
 *
 *   - id             — stable identifier persisted in `profiles.quest_state`
 *   - voiceLines[]   — narrative text attributed to a persona (MCP / Jade / …)
 *   - objective      — the short one-liner shown as the "current task"
 *   - hint           — longer prompt shown if the player stalls
 *   - trigger        — how the step completes (continue-button, command, flag)
 *   - reward?        — optional side effect applied on step completion
 *
 * The types here are intentionally free of React and browser APIs so the
 * engine can be used from server actions as well as the client provider.
 */

/**
 * Narrative personas. Each voice has its own visual treatment in the
 * overlay (color, prefix, typing speed, etc.).
 */
export type VoiceId =
  | "mcp" // Master Control Program — dry sarcasm, lime-green
  | "jade" // The previous operator's margin notes — teal, italicized
  | "fridge" // Engineering log — amber, monospace
  | "system"; // Unvoiced system/procfs prints — dim gray

export interface VoiceLine {
  voice: VoiceId;
  text: string;
}

/**
 * Trigger describing how a step advances. Phase 2 ships the continue-button
 * trigger only; the other variants are declared so episode authors can start
 * designing EP1+ now without another types migration later.
 */
export type StepTrigger =
  | { kind: "continue" }
  | { kind: "command"; command: string; argsPattern?: string }
  | { kind: "flag"; flag: string };

/**
 * Reward side effects. Applied by the QuestProvider once a step is marked
 * complete. Keeping rewards declarative (rather than arbitrary callbacks)
 * lets the dev area replay them for testing and keeps episode files pure.
 */
export type StepReward =
  | {
      kind: "set_resource_rate";
      resourceId: string;
      ratePerSecond: number;
    }
  | {
      kind: "set_resource_capacity";
      resourceId: string;
      capacity: number;
    }
  | {
      kind: "grant_resource";
      resourceId: string;
      amount: number;
    }
  | {
      kind: "set_flag";
      flag: string;
      value: boolean;
    };

/**
 * Optional minigame that should be rendered in place of (or alongside) the
 * CONTINUE button. When a step carries a minigame marker the overlay hides
 * the default button and relies on the minigame to call `advance()` itself.
 */
export type StepMinigame = { kind: "lissajous"; targetRatio: number };

export interface Step {
  id: string;
  voiceLines: VoiceLine[];
  objective: string;
  hint?: string;
  trigger: StepTrigger;
  /** Rewards fired when this step completes, in order. */
  rewards?: StepReward[];
  /** Optional minigame the player must complete to unlock the step. */
  minigame?: StepMinigame;
}

export interface Episode {
  id: string; // e.g. 'EP0'
  title: string;
  synopsis: string;
  steps: Step[];
  /** Rewards fired once the final step is marked complete. */
  completionRewards?: StepReward[];
  /**
   * Optional id of the episode the player should transition to when this one
   * completes. If the referenced episode is not registered, the player stays
   * on the current episode id with no active step (overlay hides).
   */
  nextEpisode?: string;
}

/**
 * Persisted per-player quest state. Mirrors `profiles.quest_state` JSONB.
 * Only the fields we write are declared; unknown keys pass through.
 */
export interface QuestState {
  /** Active episode id (source of truth is profiles.current_episode). */
  episodeId: string;
  /** Index into the active episode's `steps` array. */
  currentStepIndex: number;
  /** IDs of steps completed within the active episode. */
  completedStepIds: string[];
  /** Boolean flags set by `set_flag` rewards. */
  flags: Record<string, boolean>;
}

export function createInitialQuestState(episodeId: string): QuestState {
  return {
    episodeId,
    currentStepIndex: 0,
    completedStepIds: [],
    flags: {},
  };
}

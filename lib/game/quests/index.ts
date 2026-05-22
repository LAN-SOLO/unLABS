/**
 * Quest engine — episode registry + pure state transitions.
 *
 * Pure functions only. React and server-action glue lives in separate files
 * (contexts/QuestProvider.tsx, app/(game)/actions/quest.ts). This module is
 * safe to import from both the client and the server.
 */

import { EP0 } from "./ep0";
import { EP1 } from "./ep1";
import { EP2 } from "./ep2";
import { EP3 } from "./ep3";
import { EP4 } from "./ep4";
import {
  createInitialQuestState,
  type Episode,
  type QuestState,
  type Step,
  type StepReward,
  type StepTrigger,
} from "./types";

export * from "./types";

/**
 * Central registry. Add new episodes here as they come online. Episodes not
 * in the registry are treated as "no active quest" — the overlay hides and
 * the idle loop runs freely.
 */
const EPISODE_REGISTRY: Record<string, Episode> = {
  [EP0.id]: EP0,
  [EP1.id]: EP1,
  [EP2.id]: EP2,
  [EP3.id]: EP3,
  [EP4.id]: EP4,
};

export function getEpisode(episodeId: string): Episode | null {
  return EPISODE_REGISTRY[episodeId] ?? null;
}

export function listRegisteredEpisodes(): Episode[] {
  return Object.values(EPISODE_REGISTRY);
}

/**
 * Resolve the step that the player is currently working on. Returns null if
 * the state is out of range (e.g. episode complete) or the episode is
 * unknown.
 */
export function getCurrentStep(state: QuestState): Step | null {
  const episode = getEpisode(state.episodeId);
  if (!episode) return null;
  if (state.currentStepIndex < 0) return null;
  if (state.currentStepIndex >= episode.steps.length) return null;
  return episode.steps[state.currentStepIndex];
}

export interface AdvanceResult {
  /** New quest state after the advance. */
  state: QuestState;
  /** Rewards that should now be applied (step + optional completion). */
  rewards: StepReward[];
  /** True if the episode just completed as a result of this advance. */
  episodeCompleted: boolean;
  /**
   * Episode id the player is now on. Differs from state.episodeId only when
   * the current episode just finished and had a `nextEpisode` pointer whose
   * target is registered.
   */
  nextEpisodeId: string;
}

/**
 * Pure helper: is the given trigger satisfied by the given flag map? Used by
 * canAdvanceStep and by the cascade look-ahead (cascadeAdvance) which has to
 * inspect *future* steps without advancing through them first.
 */
export function isTriggerSatisfied(trigger: StepTrigger, flags: Record<string, boolean>): boolean {
  switch (trigger.kind) {
    case "continue":
      return true;
    case "flag":
      return flags[trigger.flag] === true;
    case "command":
      // Command triggers are set by the terminal integration (Phase 4). For
      // now they behave like flags keyed on the command id.
      return flags[`cmd:${trigger.command}`] === true;
  }
}

/**
 * Check whether the current step is eligible to advance right now. A
 * continue-triggered step is always eligible; a flag-triggered step only
 * becomes eligible after the flag has been set (by a minigame, a command,
 * etc.).
 */
export function canAdvanceStep(state: QuestState): boolean {
  const step = getCurrentStep(state);
  if (!step) return false;
  return isTriggerSatisfied(step.trigger, state.flags);
}

/**
 * Mark the current step complete and move to the next one. Returns the
 * rewards that the caller should apply to the game state (rates, flags,
 * grants). Idempotent on "already complete" — a double-advance at the end
 * is a no-op rather than an error. Refuses to advance if the current step's
 * trigger is not yet satisfied (e.g. a flag-gated step whose flag is unset),
 * unless `force` is set — used by the cascade walker when we've already
 * proven a *later* step is satisfiable and want to apply the in-between
 * steps' rewards on the way through.
 */
export function advanceStep(state: QuestState, opts?: { force?: boolean }): AdvanceResult {
  const episode = getEpisode(state.episodeId);
  if (!episode) {
    return {
      state,
      rewards: [],
      episodeCompleted: false,
      nextEpisodeId: state.episodeId,
    };
  }

  // Already past the end — idempotent no-op.
  if (state.currentStepIndex >= episode.steps.length) {
    return {
      state,
      rewards: [],
      episodeCompleted: false,
      nextEpisodeId: state.episodeId,
    };
  }

  if (!opts?.force && !canAdvanceStep(state)) {
    return {
      state,
      rewards: [],
      episodeCompleted: false,
      nextEpisodeId: state.episodeId,
    };
  }

  const currentStep = episode.steps[state.currentStepIndex];
  const nextIndex = state.currentStepIndex + 1;
  const justCompleted = nextIndex >= episode.steps.length;

  const nextState: QuestState = {
    ...state,
    currentStepIndex: nextIndex,
    completedStepIds: state.completedStepIds.includes(currentStep.id)
      ? state.completedStepIds
      : [...state.completedStepIds, currentStep.id],
    flags: applyFlagRewards(state.flags, currentStep.rewards),
  };

  const stepRewards = currentStep.rewards ?? [];
  const completionRewards = justCompleted ? (episode.completionRewards ?? []) : [];

  // If the episode just completed, apply flag rewards from completion
  // rewards AND decide whether to transition to nextEpisode.
  let finalState: QuestState = justCompleted
    ? {
        ...nextState,
        flags: applyFlagRewards(nextState.flags, completionRewards),
      }
    : nextState;

  let nextEpisodeId = state.episodeId;
  if (justCompleted && episode.nextEpisode) {
    const target = getEpisode(episode.nextEpisode);
    if (target) {
      // Fresh state for the new episode, but preserve the flag map so rewards
      // set during EP0 (e.g. ep0_complete) remain visible to downstream
      // episodes.
      finalState = {
        episodeId: target.id,
        currentStepIndex: 0,
        completedStepIds: [],
        flags: finalState.flags,
      };
      nextEpisodeId = target.id;
    }
  }

  return {
    state: finalState,
    rewards: [...stepRewards, ...completionRewards],
    episodeCompleted: justCompleted,
    nextEpisodeId,
  };
}

/**
 * Walk the engine forward as far as the current flag set allows. Differs
 * from `advanceStep` in that it tolerates out-of-order triggers: if the
 * current step's trigger isn't satisfied but a *later* step's trigger is,
 * we force-advance through the intervening steps (applying their rewards)
 * so the player isn't stranded.
 *
 * Real-world failure mode this fixes:
 *   EP2 step 3 gates on `abstractum_bottleneck_observed` (a slow runtime
 *   observer). Step 4 gates on `nexus_built` (set by a recipe claim).
 *   A player who builds the Nexus before the observer trips would
 *   otherwise be stuck on step 3 indefinitely.
 *
 * Cascades across episode boundaries via `nextEpisode` so a fully-
 * satisfied EP2 can fall straight into EP3.
 */
export function cascadeAdvance(state: QuestState): AdvanceResult {
  let cur = state;
  const allRewards: StepReward[] = [];
  let episodeCompleted = false;
  let nextEpisodeId = state.episodeId;

  // Hard bound — the registry has < 50 steps total; 200 covers any
  // future expansion and prevents an infinite loop on a malformed registry.
  for (let iter = 0; iter < 200; iter++) {
    const episode = getEpisode(cur.episodeId);
    if (!episode) break;
    if (cur.currentStepIndex >= episode.steps.length) break;

    // Find the furthest step index from `currentStepIndex` whose trigger
    // is satisfied under the current flag map. Anything between current
    // and that index becomes a force-skip with rewards applied.
    let furthest = -1;
    for (let i = cur.currentStepIndex; i < episode.steps.length; i++) {
      if (isTriggerSatisfied(episode.steps[i].trigger, cur.flags)) {
        furthest = i;
      }
    }
    if (furthest < cur.currentStepIndex) break;

    // Drive the engine through each step in [currentStepIndex .. furthest].
    // Intermediate triggers may be unsatisfied — that's exactly what the
    // force path is for.
    while (cur.currentStepIndex <= furthest && cur.currentStepIndex < episode.steps.length) {
      const result = advanceStep(cur, { force: true });
      if (result.state === cur) break; // belt-and-suspenders against engine no-op
      cur = result.state;
      allRewards.push(...result.rewards);
      episodeCompleted = result.episodeCompleted;
      nextEpisodeId = result.nextEpisodeId;
      // If we crossed an episode boundary mid-cascade, restart the outer
      // loop so we evaluate the NEW episode's first step against the
      // already-accumulated flags.
      if (cur.episodeId !== episode.id) break;
    }
  }

  return { state: cur, rewards: allRewards, episodeCompleted, nextEpisodeId };
}

/**
 * Set a flag in the quest state. Used by minigames to signal completion
 * from outside the normal advance flow.
 */
export function setQuestFlag(state: QuestState, flag: string, value: boolean): QuestState {
  if (state.flags[flag] === value) return state;
  return { ...state, flags: { ...state.flags, [flag]: value } };
}

function applyFlagRewards(
  flags: Record<string, boolean>,
  rewards: StepReward[] | undefined,
): Record<string, boolean> {
  if (!rewards || rewards.length === 0) return flags;
  let next: Record<string, boolean> | null = null;
  for (const r of rewards) {
    if (r.kind === "set_flag") {
      if (!next) next = { ...flags };
      next[r.flag] = r.value;
    }
  }
  return next ?? flags;
}

/**
 * Produce a fresh state for the given episode id. Used by reset actions in
 * the dev area.
 */
export function resetEpisodeState(episodeId: string): QuestState {
  return createInitialQuestState(episodeId);
}

/**
 * Best-effort migration / hydration: handles partial or legacy quest_state
 * blobs from the database. Missing fields are filled with defaults.
 */
export function hydrateQuestState(raw: unknown, fallbackEpisodeId: string): QuestState {
  if (!raw || typeof raw !== "object") {
    return createInitialQuestState(fallbackEpisodeId);
  }
  const obj = raw as Partial<QuestState>;
  return {
    episodeId: typeof obj.episodeId === "string" ? obj.episodeId : fallbackEpisodeId,
    currentStepIndex:
      typeof obj.currentStepIndex === "number" && obj.currentStepIndex >= 0
        ? obj.currentStepIndex
        : 0,
    completedStepIds: Array.isArray(obj.completedStepIds)
      ? obj.completedStepIds.filter((v): v is string => typeof v === "string")
      : [],
    flags:
      obj.flags && typeof obj.flags === "object"
        ? Object.fromEntries(
            Object.entries(obj.flags).filter(([, v]) => typeof v === "boolean") as Array<
              [string, boolean]
            >,
          )
        : {},
  };
}

"use server";

/**
 * Quest server actions
 * ====================
 *
 * Thin Supabase wrappers for reading and writing the player's quest state.
 * All mutations re-verify the user server-side so a malicious client can't
 * fast-forward another player's episode.
 *
 * Persistence model:
 *   - `profiles.current_episode`  — source of truth for the active episode id
 *   - `profiles.quest_state`       — JSONB blob matching QuestState
 *
 * Keeping the two fields in sync is cheap (one UPDATE) because they always
 * change together.
 */

import { createClient } from "@/lib/supabase/server";
import {
  advanceStep,
  getEpisode,
  hydrateQuestState,
  resetEpisodeState,
  setQuestFlag,
} from "@/lib/game/quests";
import type { QuestState, StepReward } from "@/lib/game/quests/types";

export interface QuestLoadResult {
  ok: boolean;
  episodeId: string;
  state: QuestState | null;
  error?: string;
}

export async function loadQuestState(): Promise<QuestLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, episodeId: "EP0", state: null, error: "not_authenticated" };
  }

  const result = await supabase
    .from("profiles")
    .select("current_episode, quest_state")
    .eq("id", user.id)
    .maybeSingle();

  // Existing codebase convention: cast through a concrete shape because
  // Database generic inference on `.from()` currently resolves to `never`.
  const profile = result.data as {
    current_episode: string;
    quest_state: Record<string, unknown>;
  } | null;

  if (!profile) {
    return { ok: false, episodeId: "EP0", state: null, error: "profile_missing" };
  }

  const episodeId = profile.current_episode ?? "EP0";
  const state = hydrateQuestState(profile.quest_state, episodeId);

  return { ok: true, episodeId, state };
}

export interface QuestAdvanceResult {
  ok: boolean;
  /** New state after advancing. */
  state: QuestState | null;
  /** Rewards the client should apply to GameTickProvider. */
  rewards: StepReward[];
  /** New episode id after any auto-advance on completion. */
  nextEpisodeId: string | null;
  episodeCompleted: boolean;
  error?: string;
}

/**
 * Advance the current step of the player's active episode. The client is
 * expected to apply the returned rewards to the tick engine — this action
 * does NOT touch player_saves directly, to keep the server/client
 * responsibilities cleanly separated.
 */
export async function advanceQuestStep(): Promise<QuestAdvanceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      state: null,
      rewards: [],
      nextEpisodeId: null,
      episodeCompleted: false,
      error: "not_authenticated",
    };
  }

  // Re-read the canonical state server-side so a stale client can't replay
  // a step reward by submitting an old state.
  const loaded = await loadQuestState();
  if (!loaded.ok || !loaded.state) {
    return {
      ok: false,
      state: null,
      rewards: [],
      nextEpisodeId: null,
      episodeCompleted: false,
      error: loaded.error ?? "load_failed",
    };
  }

  const advanced = advanceStep(loaded.state);

  // The pure engine already computes the correct next episode id (honoring
  // Episode.nextEpisode when the current episode completes).
  const nextEpisodeId = advanced.nextEpisodeId;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      current_episode: nextEpisodeId,
      quest_state: advanced.state as unknown as Record<string, unknown>,
    } as never)
    .eq("id", user.id);

  if (updateError) {
    return {
      ok: false,
      state: null,
      rewards: [],
      nextEpisodeId: null,
      episodeCompleted: false,
      error: updateError.message,
    };
  }

  return {
    ok: true,
    state: advanced.state,
    rewards: advanced.rewards,
    nextEpisodeId,
    episodeCompleted: advanced.episodeCompleted,
  };
}

export interface QuestFlagResult {
  ok: boolean;
  state: QuestState | null;
  error?: string;
}

/**
 * Allowed flags a client can set directly. Anything else is rejected.
 *
 * Additions here must correspond to a client-side signal that cannot be
 * trivially forged without the player actually doing the thing — e.g.
 * `abstractum_bottleneck_observed` requires holding a resource condition
 * for 60 s, `first_production_run` requires a claimed job row.
 */
const CLIENT_SETTABLE_FLAGS = new Set([
  "lissajous_locked",
  "abstractum_bottleneck_observed",
  "first_production_run",
  // Phase 4/5 observer-set flags (see contexts/PhaseObservers.tsx)
  "research_started",
  "pick_path_done",
  "pick_path_deep",
  "welcome_back_seen",
]);

/**
 * Set a quest flag from the client. Used by minigames to report completion
 * back to the engine. Restricted to an allow-list so a malicious client
 * can't set `ep0_complete` or similar to bypass content.
 */
export async function setQuestFlagAction(flag: string, value: boolean): Promise<QuestFlagResult> {
  if (!CLIENT_SETTABLE_FLAGS.has(flag)) {
    return { ok: false, state: null, error: "flag_not_allowed" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, state: null, error: "not_authenticated" };
  }

  const loaded = await loadQuestState();
  if (!loaded.ok || !loaded.state) {
    return { ok: false, state: null, error: loaded.error ?? "load_failed" };
  }

  const nextState = setQuestFlag(loaded.state, flag, value);

  const { error } = await supabase
    .from("profiles")
    .update({
      quest_state: nextState as unknown as Record<string, unknown>,
    } as never)
    .eq("id", user.id);

  if (error) return { ok: false, state: null, error: error.message };
  return { ok: true, state: nextState };
}

export interface QuestResetResult {
  ok: boolean;
  state: QuestState | null;
  error?: string;
}

/**
 * Reset the player's episode to its initial state. Used by the dev area.
 * Not gated on is_dev — regular players may reset their *own* current
 * episode (useful if a player gets stuck). Destructive ops like wiping
 * completed flags from other episodes stay dev-only.
 */
export async function resetCurrentEpisode(episodeId?: string): Promise<QuestResetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, state: null, error: "not_authenticated" };
  }

  const targetEpisode = episodeId ?? "EP0";
  if (!getEpisode(targetEpisode)) {
    return { ok: false, state: null, error: "unknown_episode" };
  }

  const fresh = resetEpisodeState(targetEpisode);

  const { error } = await supabase
    .from("profiles")
    .update({
      current_episode: targetEpisode,
      quest_state: fresh as unknown as Record<string, unknown>,
    } as never)
    .eq("id", user.id);

  if (error) return { ok: false, state: null, error: error.message };
  return { ok: true, state: fresh };
}

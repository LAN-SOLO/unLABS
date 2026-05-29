"use server";

/**
 * Mission server actions
 * ======================
 *
 * Thin Supabase wrappers for reading and writing the player's mission state.
 * Mirrors the pattern in actions/quest.ts — mutations re-verify server-side.
 *
 * Persistence: `profiles.mission_state` JSONB blob.
 */

import { createClient } from "@/lib/supabase/server";
import {
  claimMission as claimMissionPure,
  evaluateMission,
  getMission,
  hydrateMissionState,
  trackMission as trackMissionPure,
  untrackMission as untrackMissionPure,
  updateObjectiveProgress as updateProgressPure,
} from "@/lib/game/missions";
import type { MissionPlayerState } from "@/lib/game/missions/types";
import type { StepReward } from "@/lib/game/quests/types";

// ── Result types ──────────────────────────────────────────────────────

export interface MissionLoadResult {
  ok: boolean;
  state: MissionPlayerState | null;
  flags: Record<string, boolean>;
  error?: string;
}

export interface MissionResult {
  ok: boolean;
  state: MissionPlayerState | null;
  error?: string;
}

export interface MissionClaimResult {
  ok: boolean;
  state: MissionPlayerState | null;
  rewards: StepReward[];
  nextMissionId: string | null;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

async function loadProfileState() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, supabase, profile: null };

  const result = await supabase
    .from("profiles")
    .select("mission_state, quest_state")
    .eq("id", user.id)
    .maybeSingle();

  const profile = result.data as {
    mission_state: Record<string, unknown>;
    quest_state: Record<string, unknown>;
  } | null;

  return { user, supabase, profile };
}

function extractFlags(questState: unknown): Record<string, boolean> {
  if (!questState || typeof questState !== "object") return {};
  const qs = questState as { flags?: Record<string, boolean> };
  if (!qs.flags || typeof qs.flags !== "object") return {};
  return Object.fromEntries(
    Object.entries(qs.flags).filter(([, v]) => typeof v === "boolean"),
  ) as Record<string, boolean>;
}

// ── Actions ───────────────────────────────────────────────────────────

export async function loadMissionState(): Promise<MissionLoadResult> {
  const { user, profile } = await loadProfileState();
  if (!user) {
    return { ok: false, state: null, flags: {}, error: "not_authenticated" };
  }
  if (!profile) {
    return { ok: false, state: null, flags: {}, error: "profile_missing" };
  }

  const state = hydrateMissionState(profile.mission_state);
  const flags = extractFlags(profile.quest_state);

  return { ok: true, state, flags };
}

export async function trackMissionAction(missionId: string): Promise<MissionResult> {
  const { user, supabase, profile } = await loadProfileState();
  if (!user) return { ok: false, state: null, error: "not_authenticated" };
  if (!profile) return { ok: false, state: null, error: "profile_missing" };

  const mission = getMission(missionId);
  if (!mission) return { ok: false, state: null, error: "unknown_mission" };

  const flags = extractFlags(profile.quest_state);
  const state = hydrateMissionState(profile.mission_state);

  // Validate mission is unlocked
  const evaluated = evaluateMission(mission, state, flags);
  if (evaluated.status === "locked") {
    return { ok: false, state, error: "mission_locked" };
  }
  if (evaluated.status === "claimed") {
    return { ok: false, state, error: "mission_already_claimed" };
  }

  const nextState = trackMissionPure(missionId, state);

  const { error } = await supabase
    .from("profiles")
    .update({
      mission_state: nextState as unknown as Record<string, unknown>,
    } as never)
    .eq("id", user.id);

  if (error) return { ok: false, state: null, error: error.message };
  return { ok: true, state: nextState };
}

export async function untrackMissionAction(missionId: string): Promise<MissionResult> {
  const { user, supabase, profile } = await loadProfileState();
  if (!user) return { ok: false, state: null, error: "not_authenticated" };
  if (!profile) return { ok: false, state: null, error: "profile_missing" };

  const state = hydrateMissionState(profile.mission_state);
  const nextState = untrackMissionPure(missionId, state);

  const { error } = await supabase
    .from("profiles")
    .update({
      mission_state: nextState as unknown as Record<string, unknown>,
    } as never)
    .eq("id", user.id);

  if (error) return { ok: false, state: null, error: error.message };
  return { ok: true, state: nextState };
}

export async function updateObjectiveProgressAction(
  objectiveId: string,
  value: number,
): Promise<MissionResult> {
  const { user, supabase, profile } = await loadProfileState();
  if (!user) return { ok: false, state: null, error: "not_authenticated" };
  if (!profile) return { ok: false, state: null, error: "profile_missing" };

  const state = hydrateMissionState(profile.mission_state);
  const nextState = updateProgressPure(objectiveId, value, state);

  const { error } = await supabase
    .from("profiles")
    .update({
      mission_state: nextState as unknown as Record<string, unknown>,
    } as never)
    .eq("id", user.id);

  if (error) return { ok: false, state: null, error: error.message };
  return { ok: true, state: nextState };
}

export async function claimMissionAction(
  missionId: string,
  clientProgress?: Record<string, number>,
): Promise<MissionClaimResult> {
  const { user, supabase, profile } = await loadProfileState();
  if (!user) {
    return {
      ok: false,
      state: null,
      rewards: [],
      nextMissionId: null,
      error: "not_authenticated",
    };
  }
  if (!profile) {
    return {
      ok: false,
      state: null,
      rewards: [],
      nextMissionId: null,
      error: "profile_missing",
    };
  }

  let state = hydrateMissionState(profile.mission_state);
  const flags = extractFlags(profile.quest_state);

  // Merge client-derived progress (craft_count, resource_threshold, flag,
  // device_action, command) into the state before evaluation. These are
  // computed/tracked client-side and the persisted objectiveProgress can
  // lag behind due to debouncing or concurrent writes. Trusting the client
  // for this single-player game is acceptable; the alternative is racing
  // multiple writes and silently failing the claim.
  if (clientProgress && Object.keys(clientProgress).length > 0) {
    state = {
      ...state,
      objectiveProgress: { ...state.objectiveProgress, ...clientProgress },
    };
  }

  const result = claimMissionPure(missionId, state, flags);
  if (!result) {
    return {
      ok: false,
      state,
      rewards: [],
      nextMissionId: null,
      error: "mission_not_claimable",
    };
  }

  // Apply flag rewards from the mission into quest_state as well
  const questState = (profile.quest_state ?? {}) as Record<string, unknown>;
  const questFlags = { ...flags };
  for (const reward of result.rewards) {
    if (reward.kind === "set_flag") {
      questFlags[reward.flag] = reward.value;
    }
  }
  const updatedQuestState = {
    ...questState,
    flags: questFlags,
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      mission_state: result.state as unknown as Record<string, unknown>,
      quest_state: updatedQuestState as never,
    } as never)
    .eq("id", user.id);

  if (error) {
    return {
      ok: false,
      state: null,
      rewards: [],
      nextMissionId: null,
      error: error.message,
    };
  }

  return {
    ok: true,
    state: result.state,
    rewards: result.rewards,
    nextMissionId: result.nextMissionId,
  };
}

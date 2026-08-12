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

  // Merge client-derived progress into the state before evaluation. The
  // persisted objectiveProgress can lag behind due to debouncing or
  // concurrent writes, so the client sends its current view along.
  //
  // Trust posture: missions pay no _unSC directly, but their set_flag
  // rewards gate episodes and device unlocks — so the merged values are
  // not harmless. craft_count objectives are therefore overridden below
  // with the real production_jobs count (rows the client cannot forge).
  // The remaining objective types (resource_threshold, flag, device_action,
  // command, discovery) evaluate tick-/terminal-local state with no
  // server-authoritative mirror and stay client-trusted — documented
  // residual surface, same as the resource/energy/exploration achievement
  // branches.
  if (clientProgress && Object.keys(clientProgress).length > 0) {
    state = {
      ...state,
      objectiveProgress: { ...state.objectiveProgress, ...clientProgress },
    };
  }

  // Server-authoritative override for craft_count objectives of the mission
  // being claimed: replace the client-asserted value with the lifetime count
  // of claimed production jobs for the objective's recipe. The DB count is
  // >= any honestly tracked progress, so honest players are never worse off.
  const mission = getMission(missionId);
  if (mission) {
    const craftObjectives = mission.tasks.flatMap((task) =>
      task.objectives.filter((obj) => obj.type === "craft_count"),
    );
    if (craftObjectives.length > 0) {
      const countResults = await Promise.all(
        craftObjectives.map((obj) =>
          supabase
            .from("production_jobs")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("recipe_id", obj.target)
            .eq("status", "claimed"),
        ),
      );
      const overrides: Record<string, number> = {};
      craftObjectives.forEach((obj, i) => {
        const res = countResults[i];
        if (res.error) {
          // Fail open on transient query errors: keep the merged value so a
          // DB hiccup doesn't block honest claims (same posture as
          // lib/game/achievements/verify.ts).
          console.warn(`[mission] craft_count verify failed for ${obj.id}: ${res.error.message}`);
          return;
        }
        overrides[obj.id] = res.count ?? 0;
      });
      state = {
        ...state,
        objectiveProgress: { ...state.objectiveProgress, ...overrides },
      };
    }
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

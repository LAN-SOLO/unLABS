/**
 * Mission engine — registry + pure state transitions.
 *
 * Pure functions only. React and server-action glue lives in separate files
 * (contexts/MissionProvider.tsx, app/(game)/actions/mission.ts). This module
 * is safe to import from both client and server.
 *
 * Missions are the open-world gameplay layer that runs alongside the linear
 * quest episodes. They share the quest flag namespace so episode rewards can
 * gate missions and mission rewards can unlock episode content.
 */

import { M001 } from "./catalog/m001-power-budget";
import { M002 } from "./catalog/m002-forge-awakens";
import { M003 } from "./catalog/m003-signal-hunter";
import { M004 } from "./catalog/m004-first-resonance";
import { M005 } from "./catalog/m005-reactor-genesis";
import { M006 } from "./catalog/m006-anomaly-deepens";
import { M007 } from "./catalog/m007-three-chains";
import { M008 } from "./catalog/m008-first-production-run";
import { M009 } from "./catalog/m009-abstractum-bottleneck";
import { M010 } from "./catalog/m010-first-research";
import { M011 } from "./catalog/m011-drone-protocol";
import { M012 } from "./catalog/m012-cross-pollinator";
import { M013 } from "./catalog/m013-deep-research";
import { M014 } from "./catalog/m014-exotic-containment";
import { M015 } from "./catalog/m015-quantum-awakening";
import { M016 } from "./catalog/m016-deep-scan";
import { M017 } from "./catalog/m017-exotic-synthesis";
import { M018 } from "./catalog/m018-antimatter-protocol";
import { M019 } from "./catalog/m019-neural-architect";
import { M020 } from "./catalog/m020-last-device";
import { M021 } from "./catalog/m021-convergence";
import {
  createInitialMissionState,
  type Mission,
  type MissionCategory,
  type MissionPlayerState,
  type MissionTask,
  type MissionStatus,
  type MissionSuggestion,
  type MissionWithStatus,
  type ObjectiveWithProgress,
  type TaskStatus,
  type TaskWithStatus,
} from "./types";

export * from "./types";

// ── Registry ──────────────────────────────────────────────────────────

const MISSION_REGISTRY: Record<string, Mission> = {
  [M001.id]: M001,
  [M002.id]: M002,
  [M003.id]: M003,
  [M004.id]: M004,
  [M005.id]: M005,
  [M006.id]: M006,
  [M007.id]: M007,
  [M008.id]: M008,
  [M009.id]: M009,
  [M010.id]: M010,
  [M011.id]: M011,
  [M012.id]: M012,
  [M013.id]: M013,
  [M014.id]: M014,
  [M015.id]: M015,
  [M016.id]: M016,
  [M017.id]: M017,
  [M018.id]: M018,
  [M019.id]: M019,
  [M020.id]: M020,
  [M021.id]: M021,
};

export function getMission(id: string): Mission | null {
  return MISSION_REGISTRY[id] ?? null;
}

export function listAllMissions(): Mission[] {
  return Object.values(MISSION_REGISTRY);
}

// ── Evaluation helpers ────────────────────────────────────────────────

/**
 * Check whether all flags in the requirement list are set.
 */
function areRequirementsMet(
  requires: string[] | undefined,
  flags: Record<string, boolean>,
): boolean {
  if (!requires || requires.length === 0) return true;
  return requires.every((f) => flags[f] === true);
}

/**
 * Evaluate the status of a single objective.
 */
function evaluateObjectiveStatus(currentValue: number, targetValue: number): TaskStatus {
  if (currentValue >= targetValue) return "completed";
  if (currentValue > 0) return "in_progress";
  return "available";
}

/**
 * Evaluate a task and return it enriched with progress data.
 */
export function evaluateTask(
  task: MissionTask,
  state: MissionPlayerState,
  flags: Record<string, boolean>,
): TaskWithStatus {
  const isUnlocked = areRequirementsMet(task.unlockRequires, flags);

  const objectives: ObjectiveWithProgress[] = task.objectives.map((obj) => {
    const currentValue = state.objectiveProgress[obj.id] ?? 0;

    if (!isUnlocked) {
      return { ...obj, currentValue, status: "locked" as const };
    }

    const status = evaluateObjectiveStatus(currentValue, obj.targetValue);
    return { ...obj, currentValue, status };
  });

  let status: TaskStatus;
  if (!isUnlocked) {
    status = "locked";
  } else if (objectives.every((o) => o.status === "completed")) {
    status = "completed";
  } else if (objectives.some((o) => o.status === "in_progress" || o.status === "completed")) {
    status = "in_progress";
  } else {
    status = "available";
  }

  return {
    id: task.id,
    label: task.label,
    objectives,
    unlockRequires: task.unlockRequires,
    voiceOnStart: task.voiceOnStart,
    voiceOnComplete: task.voiceOnComplete,
    status,
  };
}

/**
 * Evaluate a full mission and return it enriched with status + progress.
 */
export function evaluateMission(
  mission: Mission,
  state: MissionPlayerState,
  flags: Record<string, boolean>,
): MissionWithStatus {
  // Already claimed?
  if (state.completedMissionIds.includes(mission.id)) {
    const tasks = mission.tasks.map((t) => evaluateTask(t, state, flags));
    return {
      ...mission,
      tasks,
      status: "claimed",
      completedTaskCount: tasks.length,
    };
  }

  // Unlock requirements met?
  if (!areRequirementsMet(mission.unlockRequires, flags)) {
    const tasks = mission.tasks.map((t) => ({
      ...t,
      objectives: t.objectives.map((o) => ({
        ...o,
        currentValue: 0,
        status: "locked" as const,
      })),
      status: "locked" as const,
    }));
    return { ...mission, tasks, status: "locked", completedTaskCount: 0 };
  }

  // Evaluate tasks
  const tasks = mission.tasks.map((t) => evaluateTask(t, state, flags));
  const completedTaskCount = tasks.filter((t) => t.status === "completed").length;
  const allTasksComplete = tasks.every((t) => t.status === "completed");
  const isActive = state.activeMissionIds.includes(mission.id);

  let status: MissionStatus;
  if (allTasksComplete) {
    status = "completed";
  } else if (isActive) {
    status = "active";
  } else {
    status = "available";
  }

  return { ...mission, tasks, status, completedTaskCount };
}

/**
 * Get all missions that are available (unlocked but not yet completed/claimed).
 */
export function getAvailableMissions(
  state: MissionPlayerState,
  flags: Record<string, boolean>,
): MissionWithStatus[] {
  return listAllMissions()
    .map((m) => evaluateMission(m, state, flags))
    .filter((m) => m.status === "available" || m.status === "active" || m.status === "completed")
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

/**
 * Get all missions with their current status, including locked ones.
 */
export function getAllMissionsWithStatus(
  state: MissionPlayerState,
  flags: Record<string, boolean>,
): MissionWithStatus[] {
  return listAllMissions()
    .map((m) => evaluateMission(m, state, flags))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

// ── State mutations (pure) ────────────────────────────────────────────

/**
 * Track a mission (add to activeMissionIds). Returns the updated state.
 * No-ops if the mission is already active or completed.
 */
export function trackMission(missionId: string, state: MissionPlayerState): MissionPlayerState {
  if (state.activeMissionIds.includes(missionId) || state.completedMissionIds.includes(missionId)) {
    return state;
  }
  return {
    ...state,
    activeMissionIds: [...state.activeMissionIds, missionId],
  };
}

/**
 * Untrack a mission (remove from activeMissionIds). Does not erase
 * objective progress — re-tracking later resumes from where the player
 * left off.
 */
export function untrackMission(missionId: string, state: MissionPlayerState): MissionPlayerState {
  if (!state.activeMissionIds.includes(missionId)) return state;
  return {
    ...state,
    activeMissionIds: state.activeMissionIds.filter((id) => id !== missionId),
  };
}

/**
 * Update progress for an objective. Clamps to [0, Infinity).
 */
export function updateObjectiveProgress(
  objectiveId: string,
  value: number,
  state: MissionPlayerState,
): MissionPlayerState {
  const clamped = Math.max(0, value);
  if (state.objectiveProgress[objectiveId] === clamped) return state;
  return {
    ...state,
    objectiveProgress: { ...state.objectiveProgress, [objectiveId]: clamped },
    lastActivityAt: {
      ...state.lastActivityAt,
      [objectiveId]: Date.now(),
    },
    // Reset hint level on progress
    hintLevel: { ...state.hintLevel, [objectiveId]: 0 },
  };
}

/**
 * Increment progress for an objective by a delta.
 */
export function incrementObjectiveProgress(
  objectiveId: string,
  delta: number,
  state: MissionPlayerState,
): MissionPlayerState {
  const current = state.objectiveProgress[objectiveId] ?? 0;
  return updateObjectiveProgress(objectiveId, current + delta, state);
}

import type { StepReward } from "@/lib/game/quests/types";

export interface ClaimResult {
  state: MissionPlayerState;
  rewards: StepReward[];
  nextMissionId: string | null;
}

/**
 * Claim a completed mission. Validates all tasks are done, applies flag
 * rewards to the returned state, and moves the mission to completedMissionIds.
 */
export function claimMission(
  missionId: string,
  state: MissionPlayerState,
  flags: Record<string, boolean>,
): ClaimResult | null {
  const mission = getMission(missionId);
  if (!mission) return null;

  const evaluated = evaluateMission(mission, state, flags);
  if (evaluated.status !== "completed") return null;

  const nextState: MissionPlayerState = {
    ...state,
    activeMissionIds: state.activeMissionIds.filter((id) => id !== missionId),
    completedMissionIds: [...state.completedMissionIds, missionId],
  };

  return {
    state: nextState,
    rewards: mission.rewards,
    nextMissionId: mission.nextMission ?? null,
  };
}

// ── Hint escalation ──────────────────────────────────────────────────

const HINT_LEVEL_1_MS = 60 * 1000; // 60 seconds
const HINT_LEVEL_2_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Compute the current hint level for an objective based on time since
 * last activity. Returns 0 (no hint), 1 (gentle nudge), or 2 (deep dive).
 */
export function computeHintLevel(
  objectiveId: string,
  state: MissionPlayerState,
  now: number,
): number {
  const lastActivity = state.lastActivityAt[objectiveId];
  if (!lastActivity) {
    // No activity recorded — start at level 1 after a grace period
    return 0;
  }
  const elapsed = now - lastActivity;
  if (elapsed >= HINT_LEVEL_2_MS) return 2;
  if (elapsed >= HINT_LEVEL_1_MS) return 1;
  return 0;
}

/**
 * Update hint levels for all active mission objectives. Returns updated
 * state (same reference if nothing changed).
 */
export function updateHintLevels(
  state: MissionPlayerState,
  flags: Record<string, boolean>,
  now: number,
): MissionPlayerState {
  let changed = false;
  const nextHintLevel = { ...state.hintLevel };

  for (const missionId of state.activeMissionIds) {
    const mission = getMission(missionId);
    if (!mission) continue;

    for (const task of mission.tasks) {
      if (!areRequirementsMet(task.unlockRequires, flags)) continue;

      for (const obj of task.objectives) {
        const current = state.objectiveProgress[obj.id] ?? 0;
        if (current >= obj.targetValue) continue; // already done

        const level = computeHintLevel(obj.id, state, now);
        if (level !== (state.hintLevel[obj.id] ?? 0)) {
          nextHintLevel[obj.id] = level;
          changed = true;
        }
      }
    }
  }

  if (!changed) return state;
  return { ...state, hintLevel: nextHintLevel };
}

// ── whatnext suggestion engine ────────────────────────────────────────

/** Priority order for mission categories when suggesting next actions. */
const CATEGORY_PRIORITY: Record<MissionCategory, number> = {
  onboarding: 0,
  progression: 1,
  resonance: 2,
  exploration: 3,
  mastery: 4,
};

/**
 * Compute the single most impactful next action for the player.
 */
export function computeWhatNext(
  state: MissionPlayerState,
  flags: Record<string, boolean>,
): MissionSuggestion {
  const all = getAllMissionsWithStatus(state, flags);

  // 1. Any completed (unclaimed) missions?
  const unclaimed = all.find((m) => m.status === "completed");
  if (unclaimed) {
    return {
      action: `Claim your reward for "${unclaimed.title}"`,
      reason: "All tasks complete. Your reward is waiting.",
      voice: "mcp",
      missionId: unclaimed.id,
      hintLevel: 0,
    };
  }

  // 2. Any active mission with a hinted objective?
  for (const mission of all.filter((m) => m.status === "active")) {
    for (const task of mission.tasks) {
      if (task.status === "completed" || task.status === "locked") continue;
      for (const obj of task.objectives) {
        if (obj.status === "completed") continue;
        const level = state.hintLevel[obj.id] ?? 0;
        if (level > 0) {
          const hint = level >= 2 ? (obj.deepDiveHint ?? obj.hint) : obj.hint;
          return {
            action: hint ?? obj.description,
            reason: `Mission: ${mission.title} — ${task.label}`,
            voice: "mcp",
            missionId: mission.id,
            hintLevel: level,
          };
        }
      }
    }
  }

  // 3. Any active mission — show current objective
  const active = all.find((m) => m.status === "active");
  if (active) {
    const nextTask = active.tasks.find(
      (t) => t.status === "available" || t.status === "in_progress",
    );
    if (nextTask) {
      const nextObj = nextTask.objectives.find((o) => o.status !== "completed");
      return {
        action: nextObj?.description ?? nextTask.label,
        reason: `Mission: ${active.title}`,
        voice: "mcp",
        missionId: active.id,
        hintLevel: 0,
      };
    }
  }

  // 4. Suggest highest-priority available mission
  const available = all
    .filter((m) => m.status === "available")
    .sort(
      (a, b) =>
        CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] ||
        (a.priority ?? 99) - (b.priority ?? 99),
    );
  if (available.length > 0) {
    const suggested = available[0];
    return {
      action: `New mission available: "${suggested.title}" — ${suggested.flavor}`,
      reason: "Track this mission to get started.",
      voice: "mcp",
      missionId: suggested.id,
      hintLevel: 0,
    };
  }

  // 5. All missions done — explore resonances
  const discoveryCount = state.discoveryLog.length;
  return {
    action:
      discoveryCount > 0
        ? "There are more resonances hidden in the lab. Jade left clues in the log files."
        : "The lab holds secrets. Try reading the files in /unvar/log/jade/.",
    reason: "All missions complete. Explore for hidden discoveries.",
    voice: "jade",
    hintLevel: 0,
  };
}

// ── Device ID extraction (for UI markers) ─────────────────────────────

/**
 * Collect all device IDs referenced by active mission objectives that
 * are not yet completed. Used by the UI to render mission markers on
 * device tiles.
 */
export function getActiveDeviceIds(
  state: MissionPlayerState,
  flags: Record<string, boolean>,
): Set<string> {
  const ids = new Set<string>();

  for (const missionId of state.activeMissionIds) {
    const mission = getMission(missionId);
    if (!mission) continue;

    for (const task of mission.tasks) {
      if (!areRequirementsMet(task.unlockRequires, flags)) continue;

      for (const obj of task.objectives) {
        const current = state.objectiveProgress[obj.id] ?? 0;
        if (current >= obj.targetValue) continue;
        if (obj.relatedDeviceIds) {
          for (const did of obj.relatedDeviceIds) {
            ids.add(did);
          }
        }
      }
    }
  }

  return ids;
}

// ── Hydration ─────────────────────────────────────────────────────────

/**
 * Best-effort hydration of a raw JSONB blob into MissionPlayerState.
 * Missing fields are filled with defaults.
 */
export function hydrateMissionState(raw: unknown): MissionPlayerState {
  if (!raw || typeof raw !== "object") {
    return createInitialMissionState();
  }
  const obj = raw as Partial<MissionPlayerState>;
  return {
    activeMissionIds: Array.isArray(obj.activeMissionIds)
      ? obj.activeMissionIds.filter((v): v is string => typeof v === "string")
      : [],
    completedMissionIds: Array.isArray(obj.completedMissionIds)
      ? obj.completedMissionIds.filter((v): v is string => typeof v === "string")
      : [],
    objectiveProgress:
      obj.objectiveProgress && typeof obj.objectiveProgress === "object"
        ? Object.fromEntries(
            Object.entries(obj.objectiveProgress).filter(([, v]) => typeof v === "number") as Array<
              [string, number]
            >,
          )
        : {},
    discoveryLog: Array.isArray(obj.discoveryLog)
      ? obj.discoveryLog.filter((v): v is string => typeof v === "string")
      : [],
    hintLevel:
      obj.hintLevel && typeof obj.hintLevel === "object"
        ? Object.fromEntries(
            Object.entries(obj.hintLevel).filter(([, v]) => typeof v === "number") as Array<
              [string, number]
            >,
          )
        : {},
    lastActivityAt:
      obj.lastActivityAt && typeof obj.lastActivityAt === "object"
        ? Object.fromEntries(
            Object.entries(obj.lastActivityAt).filter(([, v]) => typeof v === "number") as Array<
              [string, number]
            >,
          )
        : {},
  };
}

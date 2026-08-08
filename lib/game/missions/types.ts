/**
 * Mission system types
 * ====================
 *
 * Missions are the open-world gameplay scaffolding that runs alongside the
 * linear quest episodes. After EP1 completes and sets `missions_unlocked`,
 * the player can track multiple missions with parallel objectives.
 *
 * Types here are framework-agnostic — no React, no browser APIs. Safe to
 * import from both client and server.
 *
 * Reward effects reuse `StepReward` from the quest engine so the entire
 * game shares a single effect vocabulary.
 */

import type { StepReward, VoiceId, VoiceLine } from "@/lib/game/quests/types";

// ── Status enums ──────────────────────────────────────────────────────

export type MissionStatus =
  | "locked" // unlock requirements not met
  | "available" // can be tracked
  | "active" // player is tracking this mission
  | "completed" // all tasks done, reward unclaimed
  | "claimed"; // reward collected

export type TaskStatus =
  | "locked" // task unlock requirements not met
  | "available" // can be worked on
  | "in_progress" // at least one objective has progress
  | "completed"; // all objectives satisfied

// ── Objective types ───────────────────────────────────────────────────

export type ObjectiveType =
  | "flag" // quest flag must be set (target = flag name, targetValue = 1)
  | "resource_threshold" // resource amount >= targetValue (target = ResourceId)
  | "craft_count" // craft N items of a recipe (target = recipe id)
  | "device_action" // device-specific action (target = device id)
  | "command" // terminal command executed (target = command string)
  | "discovery"; // resonance protocol discovered (target = discovery id)

export interface TaskObjective {
  /** Stable id, unique within the mission (e.g. "m001.obj.craft_energy_cell"). */
  id: string;
  /** Human-readable description shown in the checklist. */
  description: string;
  /** How this objective is evaluated. */
  type: ObjectiveType;
  /** Evaluated against: flag name, resource id, recipe id, device id, command, or discovery id. */
  target: string;
  /** Completion threshold. 1 for flags/commands, N for craft counts, amount for resources. */
  targetValue: number;
  /** Comparison direction. Default "gte" (>=). Use "lte" for "drop below" objectives. */
  comparison?: "gte" | "lte";
  /** For device_action objectives: the device property to read (e.g. "powered", "sensitivity"). */
  property?: string;
  /** Gentle nudge shown after 60s of no progress. */
  hint?: string;
  /** Explicit walkthrough shown after 5min or on `whatnext --verbose`. */
  deepDiveHint?: string;
  /**
   * Optional device IDs related to this objective. Used by the UI to render
   * mission markers on device tiles.
   */
  relatedDeviceIds?: string[];
}

// ── Task ──────────────────────────────────────────────────────────────

export interface MissionTask {
  /** Stable id, unique within the mission (e.g. "m001.task.craft_basics"). */
  id: string;
  /** Short label shown in the task list. */
  label: string;
  /** All objectives must be satisfied for the task to complete. */
  objectives: TaskObjective[];
  /** Quest flags that must be set before this task becomes available. */
  unlockRequires?: string[];
  /** Voice lines played when the player first sees this task. */
  voiceOnStart?: VoiceLine[];
  /** Voice lines played on task completion. */
  voiceOnComplete?: VoiceLine[];
}

// ── Mission ───────────────────────────────────────────────────────────

export type MissionCategory =
  | "onboarding" // post-EP1 guided intro to systems
  | "progression" // main advancement path
  | "exploration" // optional side content
  | "resonance" // resonance protocol discovery
  | "mastery"; // optimization / endgame goals

export interface Mission {
  /** Stable id (e.g. "M001"). Persisted in player state. */
  id: string;
  /** Display title. */
  title: string;
  /** One-liner flavor text. */
  flavor: string;
  /** Categorization for UI grouping and priority sorting. */
  category: MissionCategory;
  /** Ordered list of tasks. */
  tasks: MissionTask[];
  /** Quest flags required for the mission to become available. */
  unlockRequires?: string[];
  /** Rewards applied when the player claims the completed mission. */
  rewards: StepReward[];
  /** Voice lines on mission completion (before claim). */
  completionVoice?: VoiceLine[];
  /** Optional next mission in a chain. */
  nextMission?: string;
  /** If true, tasks must be completed in order. Default: false (parallel). */
  sequential?: boolean;
  /** Optional time limit in seconds. Null = no limit. */
  timeLimitSec?: number | null;
  /**
   * Priority within the category. Lower = suggested first. Missions of the
   * same category are sorted by this value in `whatnext`.
   */
  priority?: number;
}

// ── Player state ──────────────────────────────────────────────────────

export interface MissionPlayerState {
  /** Mission IDs the player is actively tracking. */
  activeMissionIds: string[];
  /** Mission IDs the player has claimed rewards for. */
  completedMissionIds: string[];
  /** Objective progress: objectiveId -> current value. */
  objectiveProgress: Record<string, number>;
  /** Discovery IDs from the resonance system. */
  discoveryLog: string[];
  /** Hint escalation level per objective: objectiveId -> 0 | 1 | 2. */
  hintLevel: Record<string, number>;
  /** Timestamp (epoch ms) of last progress per objective. */
  lastActivityAt: Record<string, number>;
  /** UTC day key ("YYYY-MM-DD") the daily-contract fields below refer to. */
  dailyResetAt: string | null;
  /** Daily contract ids claimed on the `dailyResetAt` day. */
  dailyClaimedIds: string[];
  /** Daily contract ids rerolled on the `dailyResetAt` day. */
  dailyRerolledIds: string[];
  /** Consecutive-day claim streak (increments on first claim of a day). */
  streakCount: number;
  /** UTC day key up to which streak insurance protects the streak. */
  streakInsuredUntil: string | null;
}

export function createInitialMissionState(): MissionPlayerState {
  return {
    activeMissionIds: [],
    completedMissionIds: [],
    objectiveProgress: {},
    discoveryLog: [],
    hintLevel: {},
    lastActivityAt: {},
    dailyResetAt: null,
    dailyClaimedIds: [],
    dailyRerolledIds: [],
    streakCount: 0,
    streakInsuredUntil: null,
  };
}

// ── Derived types for UI ──────────────────────────────────────────────

export interface ObjectiveWithProgress extends TaskObjective {
  currentValue: number;
  status: TaskStatus;
}

export interface TaskWithStatus extends Omit<MissionTask, "objectives"> {
  objectives: ObjectiveWithProgress[];
  status: TaskStatus;
}

export interface MissionWithStatus extends Omit<Mission, "tasks"> {
  tasks: TaskWithStatus[];
  status: MissionStatus;
  /** Number of completed tasks / total tasks. */
  completedTaskCount: number;
}

// ── Suggestion type for whatnext ───────────────────────────────────────

export interface MissionSuggestion {
  /** What the player should do next. */
  action: string;
  /** Why this is the best next step. */
  reason: string;
  /** Optional voice attribution. */
  voice?: VoiceId;
  /** Related mission id, if any. */
  missionId?: string;
  /** Hint level that produced this suggestion. */
  hintLevel: number;
}

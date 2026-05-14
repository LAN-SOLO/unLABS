"use client";

/**
 * MissionProvider
 * ===============
 *
 * Client-side owner of the mission system state. Runs alongside
 * QuestProvider, reading quest flags to evaluate mission unlock status
 * and using the game tick to evaluate resource-threshold objectives.
 *
 * Mounted inside GameTickProvider + QuestProvider + ProductionProvider
 * so it can read resources, quest flags, and production jobs.
 *
 * Responsibilities:
 *   - Hold an optimistic copy of MissionPlayerState
 *   - Evaluate mission/task/objective status on each tick
 *   - Escalate hints based on time-since-last-activity
 *   - Provide a `whatNext()` suggestion for the terminal
 *   - Collect device IDs for mission markers on tiles
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { useGameTick } from "@/contexts/GameTickProvider";
import { useQuest } from "@/contexts/QuestProvider";
import { useJournalOptional } from "@/contexts/JournalProvider";
import {
  computeWhatNext,
  getActiveDeviceIds,
  getAllMissionsWithStatus,
  getAvailableMissions,
  hydrateMissionState,
  listAllMissions,
  trackMission as trackMissionEngine,
  untrackMission as untrackMissionEngine,
  type MissionPlayerState,
  type MissionSuggestion,
  type MissionWithStatus,
} from "@/lib/game/missions";
import {
  claimMissionAction,
  trackMissionAction,
  untrackMissionAction,
  updateObjectiveProgressAction,
} from "@/app/(game)/actions/mission";
import type { StepReward } from "@/lib/game/quests/types";

// ── Context shape ─────────────────────────────────────────────────────

interface MissionContextValue {
  /** All missions with current status. */
  allMissions: MissionWithStatus[];
  /** Only active + available + completed (unclaimed) missions. */
  availableMissions: MissionWithStatus[];
  /** Number of completed (claimed) missions. */
  completedCount: number;
  /** True while any server action is in flight. */
  isBusy: boolean;
  /** Track a mission (add to active list). */
  trackMission: (id: string) => void;
  /** Untrack a mission (remove from active list). */
  untrackMission: (id: string) => void;
  /** Claim a completed mission's rewards. */
  claimMission: (id: string) => void;
  /** Update objective progress (for client-detected progress). */
  updateProgress: (objectiveId: string, value: number) => void;
  /** Increment objective progress by delta. */
  incrementProgress: (objectiveId: string, delta: number) => void;
  /** Get the current whatnext suggestion. */
  whatNext: () => MissionSuggestion;
  /** Device IDs that have active mission objectives. */
  activeDeviceIds: Set<string>;
  /** Raw mission state (for terminal commands). */
  missionState: MissionPlayerState;
  /** Quest flags (for terminal commands). */
  questFlags: Record<string, boolean>;
}

const MissionContext = createContext<MissionContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────

export interface MissionProviderProps {
  children: ReactNode;
  initialMissionState: unknown;
}

export function MissionProvider({ children, initialMissionState }: MissionProviderProps) {
  const [state, setState] = useState<MissionPlayerState>(() =>
    hydrateMissionState(initialMissionState),
  );
  const [isBusy, startTransition] = useTransition();
  const tick = useGameTick();
  const quest = useQuest();
  // Optional so MissionProvider still boots outside game-shell (e.g. in tests)
  const journal = useJournalOptional();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Quest flags from the quest provider
  const flags = quest.state.flags;

  // ── Reward application (shared with QuestProvider pattern) ─────────

  const applyRewards = useCallback(
    (rewards: StepReward[]) => {
      for (const reward of rewards) {
        switch (reward.kind) {
          case "set_resource_rate":
            tick.setRate(
              reward.resourceId as Parameters<typeof tick.setRate>[0],
              reward.ratePerSecond,
            );
            break;
          case "set_resource_capacity":
            tick.setCapacity(
              reward.resourceId as Parameters<typeof tick.setCapacity>[0],
              reward.capacity,
            );
            break;
          case "grant_resource":
            tick.grant(reward.resourceId as Parameters<typeof tick.grant>[0], reward.amount);
            break;
          case "set_flag":
            // Flags propagated through the server action's quest_state update
            break;
        }
      }
    },
    [tick],
  );

  // ── Derived hint levels (computed, not stored in state) ──────────────
  // Hint levels are derived from lastActivityAt timestamps. We compute them
  // in a useMemo keyed on tickCount so they update every second without
  // needing a setState call in an effect.
  const computedHintLevels = useMemo(() => {
    const now = Date.now();
    const levels: Record<string, number> = {};
    for (const missionId of state.activeMissionIds) {
      const mission = listAllMissions().find((m) => m.id === missionId);
      if (!mission) continue;
      for (const task of mission.tasks) {
        for (const obj of task.objectives) {
          const current = state.objectiveProgress[obj.id] ?? 0;
          if (current >= obj.targetValue) continue;
          const lastActivity = state.lastActivityAt[obj.id];
          if (!lastActivity) {
            levels[obj.id] = 0;
            continue;
          }
          const elapsed = now - lastActivity;
          if (elapsed >= 5 * 60 * 1000) levels[obj.id] = 2;
          else if (elapsed >= 60 * 1000) levels[obj.id] = 1;
          else levels[obj.id] = 0;
        }
      }
    }
    return levels;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick.tickCount, state.activeMissionIds, state.objectiveProgress, state.lastActivityAt]);

  // ── Resource threshold objective evaluation ─────────────────────────
  // Computed as derived state via useMemo. The objectiveProgress for
  // resource_threshold objectives is computed on every tick but only
  // "committed" via the state when it changes.
  const resourceThresholdProgress = useMemo(() => {
    const updates: Record<string, number> = {};

    for (const missionId of state.activeMissionIds) {
      const mission = listAllMissions().find((m) => m.id === missionId);
      if (!mission) continue;

      for (const task of mission.tasks) {
        for (const obj of task.objectives) {
          if (obj.type !== "resource_threshold") continue;

          const resourceId = obj.target as keyof typeof tick.resources;
          const resource = tick.resources[resourceId];
          if (!resource) continue;

          const currentValue = obj.description.toLowerCase().includes("rate")
            ? resource.ratePerSecond
            : resource.amount;

          updates[obj.id] = currentValue;
        }
      }
    }
    return updates;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick.tickCount, tick.resources, state.activeMissionIds]);

  // Merge resource threshold progress into the state object used for
  // evaluation, without triggering an effect-based setState.
  const effectiveState = useMemo<MissionPlayerState>(() => {
    const merged = { ...state.objectiveProgress, ...resourceThresholdProgress };
    // Only create a new object if something actually changed
    const keys = Object.keys(resourceThresholdProgress);
    const anyChanged = keys.some(
      (k) => state.objectiveProgress[k] !== resourceThresholdProgress[k],
    );
    if (!anyChanged) return { ...state, hintLevel: computedHintLevels };
    return {
      ...state,
      objectiveProgress: merged,
      hintLevel: computedHintLevels,
    };
  }, [state, resourceThresholdProgress, computedHintLevels]);

  // ── Actions ─────────────────────────────────────────────────────────

  const trackMission = useCallback((id: string) => {
    // Optimistic update
    setState((s) => trackMissionEngine(id, s));
    startTransition(async () => {
      const result = await trackMissionAction(id);
      if (result.ok && result.state) {
        setState(result.state);
      }
    });
  }, []);

  const untrackMission = useCallback((id: string) => {
    setState((s) => untrackMissionEngine(id, s));
    startTransition(async () => {
      const result = await untrackMissionAction(id);
      if (result.ok && result.state) {
        setState(result.state);
      }
    });
  }, []);

  const claimMission = useCallback(
    (id: string) => {
      startTransition(async () => {
        const result = await claimMissionAction(id);
        if (result.ok && result.state) {
          applyRewards(result.rewards);
          setState(result.state);

          // Narrative breadcrumb: write completion voice lines to the
          // journal so the player can re-read them from JournalPanel later.
          if (journal) {
            const mission = listAllMissions().find((m) => m.id === id);
            journal.write("mission", 5, `[ ${id} ] claimed: ${mission?.title ?? id}`);
            if (mission?.completionVoice && mission.completionVoice.length > 0) {
              for (const line of mission.completionVoice) {
                journal.write(`voice/${line.voice}`, 6, line.text);
              }
            }
          }

          // Auto-track the next mission in the chain if there is one
          if (result.nextMissionId) {
            setState((s) => trackMissionEngine(result.nextMissionId!, s));
            void trackMissionAction(result.nextMissionId);
          }
        }
      });
    },
    [applyRewards, journal],
  );

  const updateProgress = useCallback((objectiveId: string, value: number) => {
    setState((s) => {
      const prev = s.objectiveProgress[objectiveId] ?? 0;
      if (prev === value) return s;
      return {
        ...s,
        objectiveProgress: { ...s.objectiveProgress, [objectiveId]: value },
        lastActivityAt: { ...s.lastActivityAt, [objectiveId]: Date.now() },
        hintLevel: { ...s.hintLevel, [objectiveId]: 0 },
      };
    });
    // Debounce server sync — progress updates happen frequently
    startTransition(async () => {
      await updateObjectiveProgressAction(objectiveId, value);
    });
  }, []);

  const incrementProgress = useCallback(
    (objectiveId: string, delta: number) => {
      const current = stateRef.current.objectiveProgress[objectiveId] ?? 0;
      updateProgress(objectiveId, current + delta);
    },
    [updateProgress],
  );

  const whatNext = useCallback(() => {
    return computeWhatNext(effectiveState, flags);
  }, [effectiveState, flags]);

  // ── Derived values ──────────────────────────────────────────────────

  const allMissions = useMemo(
    () => getAllMissionsWithStatus(effectiveState, flags),
    [effectiveState, flags],
  );

  const availableMissions = useMemo(
    () => getAvailableMissions(effectiveState, flags),
    [effectiveState, flags],
  );

  const completedCount = useMemo(
    () => effectiveState.completedMissionIds.length,
    [effectiveState.completedMissionIds],
  );

  const activeDeviceIds = useMemo(
    () => getActiveDeviceIds(effectiveState, flags),
    [effectiveState, flags],
  );

  const value = useMemo<MissionContextValue>(
    () => ({
      allMissions,
      availableMissions,
      completedCount,
      isBusy,
      trackMission,
      untrackMission,
      claimMission,
      updateProgress,
      incrementProgress,
      whatNext,
      activeDeviceIds,
      missionState: effectiveState,
      questFlags: flags,
    }),
    [
      allMissions,
      availableMissions,
      completedCount,
      isBusy,
      trackMission,
      untrackMission,
      claimMission,
      updateProgress,
      incrementProgress,
      whatNext,
      activeDeviceIds,
      effectiveState,
      flags,
    ],
  );

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionContext);
  if (!ctx) {
    throw new Error("useMission must be used inside <MissionProvider>");
  }
  return ctx;
}

/**
 * Variant that returns null instead of throwing when MissionProvider is not
 * mounted. Used by surfaces that may render outside the provider boundary
 * (tutorial overlay, debug shells).
 */
export function useMissionOptional(): MissionContextValue | null {
  return useContext(MissionContext);
}

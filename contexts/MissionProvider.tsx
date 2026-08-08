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
import { useProduction } from "@/contexts/ProductionProvider";
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
import {
  buyStreakInsurance,
  claimContract,
  getDailyState,
  rerollContract,
} from "@/app/(game)/actions/daily";
import { utcDayKey, type DailyContract } from "@/lib/game/daily/engine";
import type { StepReward } from "@/lib/game/quests/types";

// ── Context shape ─────────────────────────────────────────────────────

interface MissionContextValue {
  /** All missions with current status. */
  allMissions: MissionWithStatus[];
  /** Only active + available + completed (unclaimed) missions. */
  availableMissions: MissionWithStatus[];
  /** Number of completed (claimed) missions. */
  completedCount: number;
  /** True while a track/untrack server action is in flight. */
  isBusy: boolean;
  /** Mission id whose claim is currently in flight, or null. */
  claimingId: string | null;
  /** Last failed claim (cleared on the next attempt). */
  claimError: { missionId: string; message: string } | null;
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
  /** Report device state for device_action objectives. */
  reportDeviceState: (deviceId: string, properties: Record<string, number>) => void;
  /** Report a terminal command execution for command objectives. */
  reportCommand: (commandInput: string) => void;
  /** Get the current whatnext suggestion. */
  whatNext: () => MissionSuggestion;
  /** Device IDs that have active mission objectives. */
  activeDeviceIds: Set<string>;
  /** Raw mission state (for terminal commands). */
  missionState: MissionPlayerState;
  /** Quest flags (for terminal commands). */
  questFlags: Record<string, boolean>;
  /** Daily contract board (comeback loop) with client-derived progress. */
  daily: {
    loaded: boolean;
    dayKey: string;
    contracts: Array<{
      contractId: string;
      title: string;
      description: string;
      payout: number;
      rerollable: boolean;
      claimed: boolean;
      isReplacement: boolean;
      progress: number;
      target: number;
      completed: boolean;
    }>;
    streak: { count: number; insuredUntil: string | null };
    claim: (contractId: string) => Promise<{
      ok: boolean;
      awarded?: number;
      milestone?: number;
      streak?: number;
      error?: string;
    }>;
    reroll: (contractId: string) => Promise<{ ok: boolean; error?: string }>;
    buyInsurance: () => Promise<{ ok: boolean; error?: string }>;
  };
}

const MissionContext = createContext<MissionContextValue | null>(null);

/** Human-readable summary of claim rewards for journal entries. */
function describeRewards(rewards: StepReward[]): string {
  const parts: string[] = [];
  for (const r of rewards) {
    switch (r.kind) {
      case "grant_resource":
        parts.push(`+${r.amount} ${r.resourceId}`);
        break;
      case "set_resource_rate":
        parts.push(`${r.resourceId} rate → ${r.ratePerSecond}/s`);
        break;
      case "set_resource_capacity":
        parts.push(`${r.resourceId} capacity → ${r.capacity}`);
        break;
      case "set_flag":
        break;
    }
  }
  return parts.join(", ");
}

/**
 * Server-loaded snapshot of today's daily contract board
 * (app/(game)/actions/daily.ts → getDailyState). Progress is NOT part of
 * this state — it is derived per render, same as mission objectives.
 */
interface DailyBoardState {
  loaded: boolean;
  dayKey: string;
  contracts: DailyContract[];
  claimedIds: string[];
  rerolledIds: string[];
  streakCount: number;
  streakInsuredUntil: string | null;
}

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
  // Background progress syncs get their own transition so their (near
  // constant) pending state never disables the panel's action buttons —
  // sharing one transition kept every CLAIM button stuck on "CLAIMING…".
  const [, startSyncTransition] = useTransition();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const claimingIdRef = useRef<string | null>(null);
  const [claimError, setClaimError] = useState<{ missionId: string; message: string } | null>(null);
  const tick = useGameTick();
  const quest = useQuest();
  const production = useProduction();
  // Optional so MissionProvider still boots outside game-shell (e.g. in tests)
  const journal = useJournalOptional();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Holds the merged effective state so server-bound callbacks can read
  // the latest derived progress without depending on it in their deps.
  const effectiveStateRef = useRef<MissionPlayerState>(state);

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

  // ── Craft-count objective evaluation ────────────────────────────────
  // Derived from the production jobs list: for each active mission's
  // craft_count objective, count claimed jobs whose recipe matches the
  // objective's target. Same derive-don't-store pattern as
  // resourceThresholdProgress — keeps the server objectiveProgress out
  // of the loop (production_jobs is the source of truth) and makes the
  // tutorial overlay's objectiveStatus check fire correctly.
  const craftCountProgress = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of production.jobs) {
      if (job.status !== "claimed") continue;
      counts.set(job.recipeId, (counts.get(job.recipeId) ?? 0) + 1);
    }

    const updates: Record<string, number> = {};
    for (const missionId of state.activeMissionIds) {
      const mission = listAllMissions().find((m) => m.id === missionId);
      if (!mission) continue;
      for (const task of mission.tasks) {
        for (const obj of task.objectives) {
          if (obj.type !== "craft_count") continue;
          const count = counts.get(obj.target) ?? 0;
          if (count > 0) updates[obj.id] = count;
        }
      }
    }
    return updates;
  }, [production.jobs, state.activeMissionIds]);

  // ── Flag objective evaluation ────────────────────────────────────────
  const flagProgress = useMemo(() => {
    const updates: Record<string, number> = {};
    for (const missionId of state.activeMissionIds) {
      const mission = listAllMissions().find((m) => m.id === missionId);
      if (!mission) continue;
      for (const task of mission.tasks) {
        for (const obj of task.objectives) {
          if (obj.type !== "flag") continue;
          updates[obj.id] = flags[obj.target] ? 1 : 0;
        }
      }
    }
    return updates;
  }, [flags, state.activeMissionIds]);

  // Merge resource threshold + craft count + flag progress into the state
  // object used for evaluation, without triggering an effect-based setState.
  const effectiveState = useMemo<MissionPlayerState>(() => {
    const merged = {
      ...state.objectiveProgress,
      ...resourceThresholdProgress,
      ...craftCountProgress,
      ...flagProgress,
    };
    const derivedKeys = [
      ...Object.keys(resourceThresholdProgress),
      ...Object.keys(craftCountProgress),
      ...Object.keys(flagProgress),
    ];
    const anyChanged = derivedKeys.some((k) => state.objectiveProgress[k] !== merged[k]);
    if (!anyChanged) return { ...state, hintLevel: computedHintLevels };
    return {
      ...state,
      objectiveProgress: merged,
      hintLevel: computedHintLevels,
    };
  }, [state, resourceThresholdProgress, craftCountProgress, flagProgress, computedHintLevels]);

  // Keep the ref in sync so claim/track callbacks can read derived progress.
  useEffect(() => {
    effectiveStateRef.current = effectiveState;
  }, [effectiveState]);

  // ── Daily contracts (comeback loop) ─────────────────────────────────
  // Server-authoritative board (app/(game)/actions/daily.ts) with
  // client-derived progress, mirroring the derive-don't-store pattern of
  // the mission objectives above.

  const [dailyBoard, setDailyBoard] = useState<DailyBoardState>({
    loaded: false,
    dayKey: "",
    contracts: [],
    claimedIds: [],
    rerolledIds: [],
    streakCount: 0,
    streakInsuredUntil: null,
  });
  // Local counters for `command` objectives, keyed by contractId (fed by
  // reportCommand below). Contract ids embed the day key, so entries from
  // a previous day are inert even before the rollover reload prunes them.
  const [dailyCommandCounts, setDailyCommandCounts] = useState<Record<string, number>>({});
  // contractIds of replacements produced by reroll() in THIS session. The
  // getDailyState payload cannot attribute replacements client-side (the
  // originals are derived from the userId-seeded engine, and no provider
  // has the userId), so after a full page reload `isReplacement` degrades
  // to false. Cosmetic only — claim/reroll validation is server-side.
  const [dailyReplacementIds, setDailyReplacementIds] = useState<string[]>([]);
  const dailyLoadingRef = useRef(false);

  const loadDaily = useCallback(async () => {
    if (dailyLoadingRef.current) return;
    dailyLoadingRef.current = true;
    try {
      const result = await getDailyState();
      if (result.ok) {
        setDailyBoard({
          loaded: true,
          dayKey: result.dayKey,
          contracts: result.contracts,
          claimedIds: result.claimedIds,
          rerolledIds: result.rerolledIds,
          streakCount: result.streakCount,
          streakInsuredUntil: result.streakInsuredUntil,
        });
        // Fresh board (mount or day rollover): drop day-scoped client state.
        setDailyCommandCounts({});
        setDailyReplacementIds([]);
      }
    } catch {
      // Network hiccup on load — stay unloaded; the terminal surface
      // degrades to an empty board instead of crashing the provider.
    } finally {
      dailyLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadDaily();
  }, [loadDaily]);

  // Day rollover: re-derive "today" once per tick; when the UTC day flips
  // past the loaded board, refetch. tickCount is the clock here — the memo
  // has no other reactive input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentDayKey = useMemo(() => utcDayKey(new Date()), [tick.tickCount]);
  useEffect(() => {
    if (!dailyBoard.loaded) return;
    if (currentDayKey !== dailyBoard.dayKey) void loadDaily();
  }, [currentDayKey, dailyBoard.loaded, dailyBoard.dayKey, loadDaily]);

  // Ref mirror so reportCommand/claim callbacks read the latest board
  // without depending on it (same pattern as stateRef/effectiveStateRef).
  const dailyBoardRef = useRef(dailyBoard);
  useEffect(() => {
    dailyBoardRef.current = dailyBoard;
  }, [dailyBoard]);

  // Client-derived progress per contractId (derive-don't-store, like
  // resourceThresholdProgress/craftCountProgress above).
  const dailyProgress = useMemo(() => {
    const updates: Record<string, number> = {};
    const midnightMs = dailyBoard.dayKey ? Date.parse(`${dailyBoard.dayKey}T00:00:00Z`) : 0;
    for (const contract of dailyBoard.contracts) {
      const obj = contract.objective;
      if (obj.type === "craft_count") {
        // Claimed production jobs for the target recipe since UTC midnight
        // of the board's day — the same window the server verifies against.
        let count = 0;
        for (const job of production.jobs) {
          if (job.status !== "claimed") continue;
          if (job.recipeId !== obj.target) continue;
          if (job.claimedAt === null || job.claimedAt < midnightMs) continue;
          count += 1;
        }
        updates[contract.contractId] = count;
      } else if (obj.type === "resource_threshold") {
        const resource = tick.resources[obj.target as keyof typeof tick.resources];
        updates[contract.contractId] = resource ? resource.amount : 0;
      } else if (obj.type === "command") {
        updates[contract.contractId] = dailyCommandCounts[contract.contractId] ?? 0;
      } else {
        updates[contract.contractId] = 0;
      }
    }
    return updates;
    // tick.tickCount keeps resource thresholds honest every second (same
    // posture as resourceThresholdProgress above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tick.tickCount,
    tick.resources,
    production.jobs,
    dailyBoard.contracts,
    dailyBoard.dayKey,
    dailyCommandCounts,
  ]);

  const dailyProgressRef = useRef(dailyProgress);
  useEffect(() => {
    dailyProgressRef.current = dailyProgress;
  }, [dailyProgress]);

  const dailyContracts = useMemo(
    () =>
      dailyBoard.contracts.map((contract) => {
        const obj = contract.objective;
        const claimed = dailyBoard.claimedIds.includes(contract.contractId);
        const progress = dailyProgress[contract.contractId] ?? 0;
        const satisfied =
          obj.comparison === "lte" ? progress <= obj.targetValue : progress >= obj.targetValue;
        return {
          contractId: contract.contractId,
          title: contract.title,
          description: obj.description,
          payout: contract.payout,
          rerollable: contract.rerollable,
          claimed,
          isReplacement: dailyReplacementIds.includes(contract.contractId),
          progress,
          target: obj.targetValue,
          // Claimed contracts stay completed even if derived progress
          // drifts afterwards (e.g. an lte resource threshold rising again).
          completed: claimed || satisfied,
        };
      }),
    [dailyBoard.contracts, dailyBoard.claimedIds, dailyProgress, dailyReplacementIds],
  );

  // The _unSC balance is owned by ProductionProvider; its exported
  // refresh() re-reads jobs + balance from the server, so daily payouts
  // and burns show up immediately instead of waiting for the provider's
  // 15s periodic refresh. refresh() is a stable useCallback([]) there.
  const refreshProduction = production.refresh;

  const dailyClaim = useCallback(
    async (contractId: string) => {
      const board = dailyBoardRef.current;
      const contract = board.contracts.find((c) => c.contractId === contractId);
      if (!contract) return { ok: false, error: "unknown_contract" };
      const obj = contract.objective;
      // craft_count is verified server-side against production_jobs; the
      // client-trusted objective types ship their derived progress.
      const clientProgress =
        obj.type === "command" || obj.type === "resource_threshold"
          ? { [obj.id]: dailyProgressRef.current[contractId] ?? 0 }
          : undefined;
      try {
        const result = await claimContract(contractId, clientProgress);
        if (!result.ok) return { ok: false, error: result.error ?? "unknown" };
        setDailyBoard((s) => ({
          ...s,
          claimedIds: s.claimedIds.includes(contractId)
            ? s.claimedIds
            : [...s.claimedIds, contractId],
          streakCount: result.streakCount,
        }));
        const milestoneText =
          result.milestoneAwarded > 0
            ? ` — streak milestone: +${result.milestoneAwarded} _unSC`
            : "";
        journal?.write(
          "daily",
          5,
          `[ daily ] claimed: ${contract.title} — +${result.unscAwarded} _unSC${milestoneText}`,
        );
        void refreshProduction();
        return {
          ok: true,
          awarded: result.unscAwarded,
          milestone: result.milestoneAwarded > 0 ? result.milestoneAwarded : undefined,
          streak: result.streakCount,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "network_error" };
      }
    },
    [journal, refreshProduction],
  );

  const dailyReroll = useCallback(
    async (contractId: string) => {
      try {
        const result = await rerollContract(contractId);
        if (!result.ok || !result.replacement) {
          return { ok: false, error: result.error ?? "unknown" };
        }
        const replacement = result.replacement;
        setDailyBoard((s) => ({
          ...s,
          contracts: s.contracts.map((c) => (c.contractId === contractId ? replacement : c)),
          rerolledIds: s.rerolledIds.includes(contractId)
            ? s.rerolledIds
            : [...s.rerolledIds, contractId],
        }));
        setDailyReplacementIds((prev) =>
          prev.includes(replacement.contractId) ? prev : [...prev, replacement.contractId],
        );
        // The reroll burned REROLL_COST _unSC server-side — sync the balance.
        void refreshProduction();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "network_error" };
      }
    },
    [refreshProduction],
  );

  const dailyBuyInsurance = useCallback(async () => {
    try {
      const result = await buyStreakInsurance();
      if (!result.ok) return { ok: false, error: result.error ?? "unknown" };
      setDailyBoard((s) => ({ ...s, streakInsuredUntil: result.streakInsuredUntil }));
      // Insurance burned STREAK_INSURANCE_COST _unSC — sync the balance.
      void refreshProduction();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "network_error" };
    }
  }, [refreshProduction]);

  const daily = useMemo<MissionContextValue["daily"]>(
    () => ({
      loaded: dailyBoard.loaded,
      dayKey: dailyBoard.dayKey,
      contracts: dailyContracts,
      streak: { count: dailyBoard.streakCount, insuredUntil: dailyBoard.streakInsuredUntil },
      claim: dailyClaim,
      reroll: dailyReroll,
      buyInsurance: dailyBuyInsurance,
    }),
    [
      dailyBoard.loaded,
      dailyBoard.dayKey,
      dailyBoard.streakCount,
      dailyBoard.streakInsuredUntil,
      dailyContracts,
      dailyClaim,
      dailyReroll,
      dailyBuyInsurance,
    ],
  );

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
      // One claim at a time; ignore double-clicks while in flight.
      if (claimingIdRef.current) return;
      claimingIdRef.current = id;
      setClaimingId(id);
      setClaimError(null);

      void (async () => {
        try {
          // Build a snapshot of client-derived progress for this mission's
          // objectives and send it atomically to the server. Avoids the race
          // condition of pushing each objective separately (concurrent writes
          // to the same row clobber each other).
          const mission = listAllMissions().find((m) => m.id === id);
          const clientProgress: Record<string, number> = {};
          if (mission) {
            const effective = effectiveStateRef.current.objectiveProgress;
            for (const task of mission.tasks) {
              for (const obj of task.objectives) {
                clientProgress[obj.id] = effective[obj.id] ?? 0;
              }
            }
          }

          const result = await claimMissionAction(id, clientProgress);
          if (!result.ok) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("[mission claim failed]", id, result.error);
            }
            setClaimError({ missionId: id, message: result.error ?? "unknown" });
            journal?.write("mission", 4, `[ ${id} ] claim failed: ${result.error ?? "unknown"}`);
            return;
          }
          if (result.state) {
            applyRewards(result.rewards);
            setState(result.state);

            // Narrative breadcrumb: write completion + rewards to the
            // journal so the player can re-read them from JournalPanel later.
            if (journal) {
              const rewardText = describeRewards(result.rewards);
              journal.write(
                "mission",
                5,
                `[ ${id} ] claimed: ${mission?.title ?? id}${rewardText ? ` — rewards: ${rewardText}` : ""}`,
              );
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "network_error";
          setClaimError({ missionId: id, message });
          journal?.write("mission", 4, `[ ${id} ] claim failed: ${message}`);
        } finally {
          claimingIdRef.current = null;
          setClaimingId(null);
        }
      })();
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
    // Background server sync — progress updates happen frequently, so they
    // run on their own transition (see startSyncTransition above).
    startSyncTransition(async () => {
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

  const reportDeviceState = useCallback(
    (deviceId: string, properties: Record<string, number>) => {
      const s = stateRef.current;
      for (const missionId of s.activeMissionIds) {
        const mission = listAllMissions().find((m) => m.id === missionId);
        if (!mission) continue;
        for (const task of mission.tasks) {
          for (const obj of task.objectives) {
            if (obj.type !== "device_action" || obj.target !== deviceId) continue;
            if (!obj.property || !(obj.property in properties)) continue;
            const value = properties[obj.property];
            const prev = s.objectiveProgress[obj.id] ?? 0;
            if (value !== prev) {
              updateProgress(obj.id, value);
            }
          }
        }
      }
    },
    [updateProgress],
  );

  const reportCommand = useCallback(
    (commandInput: string) => {
      const normalized = commandInput.trim().toLowerCase();
      const s = stateRef.current;
      for (const missionId of s.activeMissionIds) {
        const mission = listAllMissions().find((m) => m.id === missionId);
        if (!mission) continue;
        for (const task of mission.tasks) {
          for (const obj of task.objectives) {
            if (obj.type !== "command") continue;
            const target = obj.target.toLowerCase();
            if (normalized === target || normalized.startsWith(target + " ")) {
              const prev = s.objectiveProgress[obj.id] ?? 0;
              if (prev < obj.targetValue) {
                incrementProgress(obj.id, 1);
              }
            }
          }
        }
      }

      // Daily contracts: command objectives of today's un-claimed contracts
      // use the same normalization (exact match, or command + arguments).
      // Counts are local-only; they ride to the server as clientProgress at
      // claim time (same trust posture as mission command objectives).
      const board = dailyBoardRef.current;
      if (board.loaded) {
        for (const contract of board.contracts) {
          if (board.claimedIds.includes(contract.contractId)) continue;
          const obj = contract.objective;
          if (obj.type !== "command") continue;
          const target = obj.target.trim().toLowerCase();
          if (normalized === target || normalized.startsWith(target + " ")) {
            setDailyCommandCounts((prev) => {
              const current = prev[contract.contractId] ?? 0;
              if (current >= obj.targetValue) return prev;
              return { ...prev, [contract.contractId]: current + 1 };
            });
          }
        }
      }
    },
    [incrementProgress],
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

  // ── Mission visibility hooks into the journal ───────────────────────
  // The overlay is one-way dismissible, so players who close it lose all
  // sense of what's next. Mirror two transitions into the journal so they
  // can scroll back to find "what should I do":
  //   - A mission first becomes available (unlocked).
  //   - An objective transitions to completed.
  // First-render is treated as the baseline — pre-existing state isn't
  // back-filled so the journal doesn't spam on every page load.
  const journalSeenMissionsRef = useRef<Set<string> | null>(null);
  const journalSeenObjectivesRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!journal) return;

    const seenMissions = journalSeenMissionsRef.current;
    const seenObjectives = journalSeenObjectivesRef.current;
    const nextMissions = new Set<string>();
    const nextObjectives = new Set<string>();

    for (const m of allMissions) {
      if (m.status === "available" || m.status === "active") {
        nextMissions.add(m.id);
        if (seenMissions && !seenMissions.has(m.id)) {
          const firstTask = m.tasks[0];
          const hint = firstTask?.objectives[0]?.hint;
          journal.write(
            "mission",
            6,
            hint
              ? `New mission available — ${m.title}: ${hint}`
              : `New mission available — ${m.title}`,
          );
        }
      }
      for (const task of m.tasks) {
        for (const obj of task.objectives) {
          if (obj.status === "completed") {
            const key = `${m.id}.${obj.id}`;
            nextObjectives.add(key);
            if (seenObjectives && !seenObjectives.has(key)) {
              journal.write("mission", 6, `Objective complete — ${obj.description}`);
            }
          }
        }
      }
    }

    journalSeenMissionsRef.current = nextMissions;
    journalSeenObjectivesRef.current = nextObjectives;
  }, [allMissions, journal]);

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
      claimingId,
      claimError,
      trackMission,
      untrackMission,
      claimMission,
      updateProgress,
      incrementProgress,
      reportDeviceState,
      reportCommand,
      whatNext,
      activeDeviceIds,
      missionState: effectiveState,
      questFlags: flags,
      daily,
    }),
    [
      allMissions,
      availableMissions,
      completedCount,
      isBusy,
      claimingId,
      claimError,
      trackMission,
      untrackMission,
      claimMission,
      updateProgress,
      incrementProgress,
      reportDeviceState,
      reportCommand,
      whatNext,
      activeDeviceIds,
      effectiveState,
      flags,
      daily,
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

"use client";

/**
 * AchievementProvider
 * ===================
 *
 * Evaluates the achievement catalog on every tick and reconciles with
 * server-authoritative state. Responsibilities:
 *
 *   - Keep an optimistic AchievementPlayerState in memory (progress +
 *     unlocked + claimed)
 *   - Re-evaluate on every tick; push updates to the server when progress
 *     crosses an integer boundary (throttles DB writes)
 *   - Detect newly unlocked achievements since the previous tick and emit
 *     a NotificationProvider toast
 *   - Expose `claim(id)` which calls the server and updates the balance
 *     through ProductionProvider (which owns the optimistic _unSC balance)
 *
 * Must be mounted inside GameTick / Quest / Production / Mission /
 * Notification / Resonance providers.
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
import { useProduction } from "@/contexts/ProductionProvider";
import { useMission } from "@/contexts/MissionProvider";
import { useNotification } from "@/contexts/NotificationProvider";
import { useResonance } from "@/contexts/ResonanceProvider";
import { useJournalOptional } from "@/contexts/JournalProvider";
import {
  ACHIEVEMENTS,
  diffNewlyUnlocked,
  evaluateCatalog,
  type AchievementGameState,
  type AchievementPlayerState,
  type AchievementStatus,
  type AchievementWithStatus,
  createInitialAchievementState,
} from "@/lib/game/achievements";
import {
  claimAchievement,
  loadAchievementState,
  updateAchievementProgress,
  type AchievementLoadResult,
} from "@/app/(game)/actions/achievement";

interface AchievementContextValue {
  /** Catalog + live status for every achievement. */
  all: AchievementWithStatus[];
  /** In-memory player state (progress / unlocked / claimed bits). */
  state: AchievementPlayerState;
  /** Count of achievements in each status bucket. */
  summary: { total: number; unlocked: number; claimed: number };
  /** True while a claim is in flight. */
  busy: boolean;
  /** Claim the reward for an unlocked achievement. */
  claim: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Force a full reload from the server (used by dev tools). */
  refresh: () => Promise<void>;
}

const AchievementContext = createContext<AchievementContextValue | null>(null);

export interface AchievementProviderProps {
  children: ReactNode;
  /** Server-side snapshot loaded by the (game) layout. */
  initialState: AchievementLoadResult | null;
}

function toPlayerState(init: AchievementLoadResult | null): AchievementPlayerState {
  const empty = createInitialAchievementState();
  if (!init?.ok) return empty;
  for (const row of init.progress) {
    empty.progress[row.achievementId] = row.progress;
  }
  for (const row of init.unlocks) {
    empty.unlocked[row.achievementId] = true;
    if (row.rewardClaimed) empty.claimed[row.achievementId] = true;
  }
  return empty;
}

export function AchievementProvider({ children, initialState }: AchievementProviderProps) {
  const tick = useGameTick();
  const quest = useQuest();
  const production = useProduction();
  const mission = useMission();
  const notif = useNotification();
  const resonance = useResonance();
  const journal = useJournalOptional();

  const [state, setState] = useState<AchievementPlayerState>(() => toPlayerState(initialState));
  const [, startTransition] = useTransition();
  const [isBusy, setIsBusy] = useState(false);

  // Keep the previous status map so we can diff newly-unlocked rows.
  const previousStatusRef = useRef<Record<string, AchievementStatus>>({});

  // Server sync throttle: only push when the integer part of the progress
  // value changes, to avoid a write-per-tick storm.
  const lastSyncedProgressRef = useRef<Record<string, number>>({});

  // ── Build the evaluation snapshot ────────────────────────────────────
  const gameState = useMemo<AchievementGameState>(() => {
    const craftedJobs = production.jobs.filter((j) => j.status === "claimed");
    return {
      resources: tick.resources as AchievementGameState["resources"],
      flags: { ...quest.state.flags, ...mission.questFlags },
      craftedJobCount: craftedJobs.length,
      craftedRecipeIds: new Set(craftedJobs.map((j) => j.recipeId)),
      discoveries: resonance.discoveries,
      balance: production.balance,
      // totalSpent is not currently exposed client-side; fall back to
      // `balance` delta tracking later. For MVP we count all production
      // jobs' _unSC burn approximated by recipe count × 1 (conservative).
      totalSpent: craftedJobs.length,
    };
  }, [tick.resources, quest.state.flags, mission.questFlags, production, resonance]);

  const allFlags = useMemo(
    () => ({ ...quest.state.flags, ...mission.questFlags }),
    [quest.state.flags, mission.questFlags],
  );

  // ── Tick-driven evaluation + toast / sync side effects ──────────────
  const all = useMemo(
    () => evaluateCatalog(ACHIEVEMENTS, gameState, state, allFlags),
    [gameState, state, allFlags],
  );

  useEffect(() => {
    // Diff newly-unlocked. For each: fire a toast, mark unlocked in state.
    const newly = diffNewlyUnlocked(previousStatusRef.current, all);
    if (newly.length > 0) {
      setState((prev) => {
        const nextUnlocked = { ...prev.unlocked };
        for (const a of newly) nextUnlocked[a.id] = true;
        return { ...prev, unlocked: nextUnlocked };
      });
      for (const a of newly) {
        notif.notify(
          "mission_complete",
          `Achievement: ${a.title}`,
          `${a.description} — ${a.reward.description ?? `+${a.reward.unsc} _unSC`}`,
          9000,
        );
        journal?.write(
          "achievement",
          5,
          `Unlocked [${a.id}] ${a.title} (tier ${a.tier}) — claim with 'achieve claim ${a.id}'`,
        );
      }
    }

    // Sync progress server-side when integer value changes. We also write
    // the first time a row is seen (progress > 0 with no prior sync).
    for (const a of all) {
      const committed = lastSyncedProgressRef.current[a.id] ?? -1;
      const integerProgress = Math.floor(a.progress);
      if (committed !== integerProgress && a.progress > 0) {
        lastSyncedProgressRef.current[a.id] = integerProgress;
        const value = a.progress;
        startTransition(async () => {
          await updateAchievementProgress(a.id, value);
        });
      }
    }

    // Update the status cache for next diff.
    const nextStatus: Record<string, AchievementStatus> = {};
    for (const a of all) nextStatus[a.id] = a.status;
    previousStatusRef.current = nextStatus;
  }, [all, notif, journal]);

  // Mirror the live progress into state so consumers read the optimistic
  // value rather than the (throttled) server-committed one.
  useEffect(() => {
    setState((prev) => {
      const next = { ...prev.progress };
      let changed = false;
      for (const a of all) {
        if (next[a.id] !== a.progress) {
          next[a.id] = a.progress;
          changed = true;
        }
      }
      return changed ? { ...prev, progress: next } : prev;
    });
  }, [all]);

  // ── Claim ───────────────────────────────────────────────────────────
  const claim = useCallback(
    async (id: string) => {
      const target = all.find((a) => a.id === id);
      if (!target) return { ok: false, error: "unknown_achievement" };
      if (target.status !== "unlocked") {
        return { ok: false, error: "not_unlocked" };
      }
      setIsBusy(true);
      const result = await claimAchievement(id);
      setIsBusy(false);
      if (!result.ok) {
        return { ok: false, error: result.error ?? "claim_failed" };
      }
      setState((prev) => ({
        ...prev,
        claimed: { ...prev.claimed, [id]: true },
      }));
      notif.notify(
        "mission_complete",
        `+${result.unscAwarded} _unSC`,
        `Claimed: ${target.title}`,
        6000,
      );
      return { ok: true };
    },
    [all, notif],
  );

  const refresh = useCallback(async () => {
    const loaded = await loadAchievementState();
    if (loaded.ok) setState(toPlayerState(loaded));
  }, []);

  const summary = useMemo(
    () => ({
      total: all.length,
      unlocked: all.filter((a) => a.status === "unlocked" || a.status === "claimed").length,
      claimed: all.filter((a) => a.status === "claimed").length,
    }),
    [all],
  );

  const value = useMemo<AchievementContextValue>(
    () => ({ all, state, summary, busy: isBusy, claim, refresh }),
    [all, state, summary, isBusy, claim, refresh],
  );

  return <AchievementContext.Provider value={value}>{children}</AchievementContext.Provider>;
}

export function useAchievements(): AchievementContextValue {
  const ctx = useContext(AchievementContext);
  if (!ctx) {
    throw new Error("useAchievements must be used inside <AchievementProvider>");
  }
  return ctx;
}

export function useAchievementsOptional(): AchievementContextValue | null {
  return useContext(AchievementContext);
}

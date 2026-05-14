"use client";

/**
 * QuestProvider
 * =============
 *
 * Client-side owner of the active quest episode + step cursor. Must be
 * mounted INSIDE GameTickProvider so it can apply resource rewards directly
 * to the tick engine when a step completes.
 *
 * Responsibilities:
 *   - Hold an optimistic copy of the player's QuestState
 *   - Call the server-side `advanceQuestStep` action on CONTINUE
 *   - Apply returned rewards to GameTickProvider (rates, capacities, grants)
 *   - Expose a `reset()` for the dev area
 *
 * Not responsible for:
 *   - Saving to player_saves (that's the existing save-sync bridge)
 *   - Rendering the UI (that's <QuestOverlay />)
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { useGameTick } from "@/contexts/GameTickProvider";
import {
  getCurrentStep,
  getEpisode,
  hydrateQuestState,
  type Episode,
  type QuestState,
  type Step,
  type StepReward,
} from "@/lib/game/quests";
import {
  advanceQuestStep,
  resetCurrentEpisode,
  setQuestFlagAction,
} from "@/app/(game)/actions/quest";

interface QuestContextValue {
  episode: Episode | null;
  state: QuestState;
  currentStep: Step | null;
  isAdvancing: boolean;
  advance: () => void;
  reset: (episodeId?: string) => Promise<void>;
  /**
   * Flip a client-settable quest flag (e.g. `lissajous_locked`). Persisted
   * server-side via an allow-list. Minigames call this to signal completion.
   */
  setFlag: (flag: string, value: boolean) => Promise<void>;
  /**
   * Apply a list of rewards directly. Used by the tutorial skip flow, which
   * needs to bulk-apply EP0+EP1 rewards without walking the step engine.
   */
  applyRewards: (rewards: StepReward[]) => void;
  /**
   * Replace the active quest state optimistically. Used by tutorial skip /
   * resume after a server mutation; the client otherwise cannot jump the
   * cursor forward.
   */
  setStateOverride: (next: QuestState) => void;
}

const QuestContext = createContext<QuestContextValue | null>(null);

export interface QuestProviderProps {
  children: ReactNode;
  initialEpisodeId: string;
  initialQuestState: unknown;
}

export function QuestProvider({
  children,
  initialEpisodeId,
  initialQuestState,
}: QuestProviderProps) {
  const [state, setState] = useState<QuestState>(() =>
    hydrateQuestState(initialQuestState, initialEpisodeId),
  );
  const [isAdvancing, startTransition] = useTransition();
  const tick = useGameTick();

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
            // Flags are persisted in QuestState; no tick-engine side effect.
            break;
        }
      }
    },
    [tick],
  );

  const advance = useCallback(() => {
    startTransition(async () => {
      const result = await advanceQuestStep();
      if (!result.ok || !result.state) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[quest] advance failed:", result.error);
        }
        return;
      }
      applyRewards(result.rewards);
      setState(result.state);
    });
  }, [applyRewards]);

  const reset = useCallback(async (episodeId?: string) => {
    const result = await resetCurrentEpisode(episodeId);
    if (result.ok && result.state) {
      setState(result.state);
    }
  }, []);

  const setFlag = useCallback(async (flag: string, value: boolean) => {
    const result = await setQuestFlagAction(flag, value);
    if (result.ok && result.state) {
      setState(result.state);
    } else if (process.env.NODE_ENV !== "production") {
      console.warn("[quest] setFlag failed:", result.error);
    }
  }, []);

  const setStateOverride = useCallback((next: QuestState) => {
    setState(next);
  }, []);

  const episode = useMemo(() => getEpisode(state.episodeId), [state.episodeId]);
  const currentStep = useMemo(() => getCurrentStep(state), [state]);

  const value = useMemo<QuestContextValue>(
    () => ({
      episode,
      state,
      currentStep,
      isAdvancing,
      advance,
      reset,
      setFlag,
      applyRewards,
      setStateOverride,
    }),
    [
      episode,
      state,
      currentStep,
      isAdvancing,
      advance,
      reset,
      setFlag,
      applyRewards,
      setStateOverride,
    ],
  );

  return <QuestContext.Provider value={value}>{children}</QuestContext.Provider>;
}

export function useQuest(): QuestContextValue {
  const ctx = useContext(QuestContext);
  if (!ctx) {
    throw new Error("useQuest must be used inside <QuestProvider>");
  }
  return ctx;
}

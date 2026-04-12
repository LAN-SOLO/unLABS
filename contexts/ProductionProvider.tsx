"use client";

/**
 * ProductionProvider
 * ==================
 *
 * Client-side holder for the player's production jobs. Responsibilities:
 *
 *   1. Keep the jobs list in sync with the server (initial load + periodic
 *      refresh on tick).
 *   2. Start new jobs: deduct in-game resource costs from the tick engine,
 *      call the startJob server action, append the returned job.
 *   3. Claim completed jobs: call claimJob, apply rewards to tick engine,
 *      update the cached job status.
 *
 * Mounted inside GameTickProvider + QuestProvider so it can read resources,
 * deduct costs, and apply rewards without threading them through props.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useGameTick } from "@/contexts/GameTickProvider";
import {
  claimJob as claimJobAction,
  listJobs as listJobsAction,
  startJob as startJobAction,
} from "@/app/(game)/actions/production";
import { getBalance } from "@/app/(game)/actions/economy";
import { getRecipe } from "@/lib/game/recipes";
import type { ProductionJob } from "@/lib/game/production";
import type { StepReward } from "@/lib/game/quests/types";
import type { ResourceId } from "@/lib/game/tickEngine";

interface ProductionContextValue {
  jobs: ProductionJob[];
  balance: number;
  /** True while any start/claim is in flight (blocks duplicate clicks). */
  busy: boolean;
  /** Insufficient-resource reasons from the last startJob attempt. */
  lastError: string | null;
  startJob: (recipeId: string) => Promise<void>;
  claimJob: (jobId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ProductionContext = createContext<ProductionContextValue | null>(null);

export interface ProductionProviderProps {
  children: ReactNode;
  initialJobs: ProductionJob[];
  initialBalance: number;
}

export function ProductionProvider({
  children,
  initialJobs,
  initialBalance,
}: ProductionProviderProps) {
  const [jobs, setJobs] = useState<ProductionJob[]>(initialJobs);
  const [balance, setBalance] = useState<number>(initialBalance);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const tick = useGameTick();

  // Apply a list of rewards to the tick engine. Kept internal to match
  // QuestProvider's behavior. Flags are not handled here — no production
  // reward currently needs to interact with quest flags, but adding that
  // surface later is a one-line change.
  const applyRewards = useCallback(
    (rewards: StepReward[]) => {
      for (const reward of rewards) {
        switch (reward.kind) {
          case "set_resource_rate":
            tick.setRate(reward.resourceId as ResourceId, reward.ratePerSecond);
            break;
          case "set_resource_capacity":
            tick.setCapacity(reward.resourceId as ResourceId, reward.capacity);
            break;
          case "grant_resource":
            tick.grant(reward.resourceId as ResourceId, reward.amount);
            break;
          case "set_flag":
            // Production rewards can set flags, but we don't own QuestState
            // here. Phase 5 can plumb a `questSetFlag` callback through.
            break;
        }
      }
    },
    [tick],
  );

  const refresh = useCallback(async () => {
    const [jobResult, balanceResult] = await Promise.all([listJobsAction(), getBalance()]);
    if (jobResult.ok) setJobs(jobResult.jobs);
    if (balanceResult.ok && balanceResult.balance) {
      setBalance(balanceResult.balance.available);
    }
  }, []);

  const startJob = useCallback(
    async (recipeId: string) => {
      if (busy) return;
      setBusy(true);
      setLastError(null);

      const recipe = getRecipe(recipeId);
      if (!recipe) {
        setBusy(false);
        setLastError("unknown_recipe");
        return;
      }

      // Check in-game resource costs against the tick engine.
      for (const cost of recipe.costs) {
        const have = tick.resources[cost.resourceId]?.amount ?? 0;
        if (have < cost.amount) {
          setBusy(false);
          setLastError(`missing:${cost.resourceId}`);
          return;
        }
      }
      // Check _unSC upfront so we don't cause the server to return
      // insufficient_funds mid-burn.
      if (balance < recipe.unscBurn) {
        setBusy(false);
        setLastError("missing:unsc");
        return;
      }

      // Optimistically deduct resources client-side so the UI feels
      // responsive. The server still burns _unSC — that's the
      // authoritative cost.
      for (const cost of recipe.costs) {
        tick.grant(cost.resourceId, -cost.amount);
      }

      const result = await startJobAction(recipeId);
      if (!result.ok || !result.job) {
        // Roll back the optimistic deductions.
        for (const cost of recipe.costs) {
          tick.grant(cost.resourceId, cost.amount);
        }
        setBusy(false);
        setLastError(result.error ?? "start_failed");
        return;
      }

      // Server burned the _unSC. Reflect it locally.
      if (recipe.unscBurn > 0) {
        setBalance((b) => b - recipe.unscBurn);
      }
      setJobs((prev) => [result.job!, ...prev]);
      setBusy(false);
    },
    [busy, balance, tick],
  );

  const claimJob = useCallback(
    async (jobId: string) => {
      if (busy) return;
      setBusy(true);
      setLastError(null);

      const result = await claimJobAction(jobId);
      if (!result.ok || !result.job) {
        setBusy(false);
        setLastError(result.error ?? "claim_failed");
        return;
      }

      applyRewards(result.rewards);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? result.job! : j)));
      setBusy(false);
    },
    [busy, applyRewards],
  );

  // Periodic refresh (every 15s) to keep the jobs list + balance honest if
  // the player has another tab open, offline progress applies, etc.
  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const value = useMemo<ProductionContextValue>(
    () => ({
      jobs,
      balance,
      busy,
      lastError,
      startJob,
      claimJob,
      refresh,
    }),
    [jobs, balance, busy, lastError, startJob, claimJob, refresh],
  );

  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
}

export function useProduction(): ProductionContextValue {
  const ctx = useContext(ProductionContext);
  if (!ctx) {
    throw new Error("useProduction must be used inside <ProductionProvider>");
  }
  return ctx;
}

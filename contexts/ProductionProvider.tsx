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
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useGameTick } from "@/contexts/GameTickProvider";
import { useQuest } from "@/contexts/QuestProvider";
import {
  claimJob as claimJobAction,
  listJobs as listJobsAction,
  rushJob as rushJobAction,
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
  /** Finish a pending job instantly for an _unSC fee. */
  rushJob: (jobId: string) => Promise<void>;
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
  const quest = useQuest();

  // Apply a list of rewards to the tick engine + quest flags. Flag rewards
  // drive recipe unlocks (e.g. smt_01_online → cnd_01_build becomes
  // available), so without this wiring the whole EP2 production chain
  // stalls after the first device claim.
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
            void quest.setFlag(reward.flag, reward.value);
            break;
        }
      }
    },
    [tick, quest],
  );

  const refresh = useCallback(async () => {
    const [jobResult, balanceResult] = await Promise.all([listJobsAction(), getBalance()]);
    if (jobResult.ok) setJobs(jobResult.jobs);
    if (balanceResult.ok && balanceResult.balance) {
      setBalance(balanceResult.balance.available);
    }
  }, []);

  // Backfill quest flags from already-claimed jobs. Players who claimed
  // recipes before set_flag rewards were wired up have flag-gated recipes
  // (Condenser, Mixer, Nexus) stuck behind progress they already earned.
  // setFlag is idempotent so this is safe to run every mount, but we skip
  // flags already set in QuestState to keep the network quiet.
  const backfilledRef = useRef(false);
  useEffect(() => {
    if (backfilledRef.current) return;
    backfilledRef.current = true;

    const flags = quest.state.flags;
    for (const job of jobs) {
      if (job.status !== "claimed") continue;
      const recipe = getRecipe(job.recipeId);
      if (!recipe) continue;
      for (const reward of recipe.outputs) {
        if (reward.kind !== "set_flag") continue;
        if (flags[reward.flag] === reward.value) continue;
        void quest.setFlag(reward.flag, reward.value);
      }
    }
    // Only run when jobs first arrive — quest.state.flags intentionally
    // omitted so the effect doesn't re-fire when we set them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

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

  const rushJob = useCallback(
    async (jobId: string) => {
      if (busy) return;
      setBusy(true);
      setLastError(null);

      const result = await rushJobAction(jobId);
      if (!result.ok) {
        setBusy(false);
        setLastError(result.error ?? "rush_failed");
        return;
      }

      // The server burned the fee and moved completes_at. Pull jobs +
      // balance through the existing refresh path so the UI shows the
      // claimable job and the reduced balance without bespoke bookkeeping.
      await refresh();
      setBusy(false);
    },
    [busy, refresh],
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
      rushJob,
      refresh,
    }),
    [jobs, balance, busy, lastError, startJob, claimJob, rushJob, refresh],
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

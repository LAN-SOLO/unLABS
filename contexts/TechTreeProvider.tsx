"use client";

/**
 * TechTreeProvider
 * ================
 *
 * Owns the research-job state shown in the Nexus graph. Responsibilities:
 *
 *   - Hold an optimistic copy of TechTreeState (unlocked + inProgress)
 *   - Track the active job row so the graph can render live progress
 *   - Apply research-claim rewards to the tick engine on completion
 *   - Re-hydrate from the server every 15 s (cheap poll, mirrors
 *     ProductionProvider's pattern)
 *
 * Must be mounted inside GameTickProvider + QuestProvider +
 * NotificationProvider + JournalProvider.
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
import { useNotification } from "@/contexts/NotificationProvider";
import { useJournalOptional } from "@/contexts/JournalProvider";
import {
  evaluateTechTree,
  getTechNode,
  listTechNodes,
  type TechNodeWithStatus,
  type TechTreeState,
} from "@/lib/game/techTree";
import {
  claimResearch,
  cancelResearch,
  listResearch,
  startResearch,
  type ListResearchResult,
  type ResearchJobRow,
} from "@/app/(game)/actions/research";
import type { StepReward } from "@/lib/game/quests/types";
import type { ResourceId } from "@/lib/game/tickEngine";

interface TechTreeContextValue {
  nodes: TechNodeWithStatus[];
  treeState: TechTreeState;
  /** The currently active (unresolved) job, if any. */
  activeJob: ResearchJobRow | null;
  /** All research jobs, newest first (capped to 20). */
  history: ResearchJobRow[];
  /** True only when NXS-01 has been built (quest flag `nexus_built`). */
  nexusAvailable: boolean;
  busy: boolean;
  startNode: (nodeId: string) => Promise<{ ok: boolean; error?: string }>;
  claimNode: (jobId: string) => Promise<{ ok: boolean; error?: string }>;
  cancelNode: (jobId: string) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

const TechTreeContext = createContext<TechTreeContextValue | null>(null);

export interface TechTreeProviderProps {
  children: ReactNode;
  initialState: ListResearchResult | null;
}

export function TechTreeProvider({ children, initialState }: TechTreeProviderProps) {
  const tick = useGameTick();
  const notif = useNotification();
  const journal = useJournalOptional();

  const [treeState, setTreeState] = useState<TechTreeState>(
    () => initialState?.treeState ?? { unlocked: [], inProgress: null },
  );
  const [history, setHistory] = useState<ResearchJobRow[]>(() => initialState?.jobs ?? []);
  const [nexusAvailable, setNexusAvailable] = useState<boolean>(
    () => initialState?.nexusAvailable ?? false,
  );
  const [busy, setBusy] = useState(false);

  const activeJob = useMemo<ResearchJobRow | null>(() => {
    const open = history.find((j) => j.claimedAt == null && j.cancelledAt == null);
    return open ?? null;
  }, [history]);

  // Apply rewards to the tick engine (same vocabulary as quests/missions).
  const applyRewards = useCallback(
    (rewards: StepReward[]) => {
      for (const r of rewards) {
        switch (r.kind) {
          case "set_resource_rate":
            tick.setRate(r.resourceId as ResourceId, r.ratePerSecond);
            break;
          case "set_resource_capacity":
            tick.setCapacity(r.resourceId as ResourceId, r.capacity);
            break;
          case "grant_resource":
            tick.grant(r.resourceId as ResourceId, r.amount);
            break;
          case "set_flag":
            // Flags are persisted server-side in claimResearch.
            break;
        }
      }
    },
    [tick],
  );

  // Periodic refresh so multi-tab / server-authoritative flips converge.
  const refresh = useCallback(async () => {
    const result = await listResearch();
    if (!result.ok) return;
    setTreeState(result.treeState);
    setHistory(result.jobs);
    setNexusAvailable(result.nexusAvailable);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Auto-claim: if the active job has completed since last load, fire a
  // subtle nudge in the journal. We DON'T auto-claim because the design
  // keeps a deliberate player tap for the narrative beat.
  const autoClaimNudgeRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.completesAt <= Date.now() && !autoClaimNudgeRef.current.has(activeJob.id)) {
      autoClaimNudgeRef.current.add(activeJob.id);
      const node = getTechNode(activeJob.nodeId);
      journal?.write(
        "research",
        5,
        `Research complete: ${node?.title ?? activeJob.nodeId}. Run 'research claim' to unlock.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.id, activeJob?.completesAt, tick.tickCount]);

  const startNode = useCallback(
    async (nodeId: string) => {
      if (busy) return { ok: false, error: "busy" };
      setBusy(true);
      const result = await startResearch(nodeId);
      setBusy(false);
      if (!result.ok || !result.job) return { ok: false, error: result.error };
      setHistory((prev) => [result.job!, ...prev]);
      setTreeState((prev) => ({ ...prev, inProgress: result.job!.nodeId }));
      const node = getTechNode(nodeId);
      notif.notify(
        "tip",
        "Research started",
        `${node?.title ?? nodeId} — ${Math.round((node?.durationSec ?? 0) / 60)} min`,
        5000,
      );
      return { ok: true };
    },
    [busy, notif],
  );

  const claimNode = useCallback(
    async (jobId: string) => {
      if (busy) return { ok: false, error: "busy" };
      setBusy(true);
      const result = await claimResearch(jobId);
      setBusy(false);
      if (!result.ok || !result.nodeId) return { ok: false, error: result.error };
      applyRewards(result.rewards);
      const node = getTechNode(result.nodeId);
      setHistory((prev) => prev.map((j) => (j.id === jobId ? { ...j, claimedAt: Date.now() } : j)));
      setTreeState((prev) => ({
        unlocked: prev.unlocked.includes(result.nodeId!)
          ? prev.unlocked
          : [...prev.unlocked, result.nodeId!],
        inProgress: prev.inProgress === result.nodeId ? null : prev.inProgress,
      }));
      notif.notify(
        "mission_complete",
        `Research unlocked: ${node?.title ?? result.nodeId}`,
        node?.description,
        8000,
      );
      journal?.write(
        "research",
        5,
        `Unlocked [${result.nodeId}] ${node?.title ?? ""} — effects applied.`,
      );
      return { ok: true };
    },
    [busy, applyRewards, notif, journal],
  );

  const cancelNode = useCallback(
    async (jobId: string) => {
      if (busy) return { ok: false, error: "busy" };
      setBusy(true);
      const result = await cancelResearch(jobId);
      setBusy(false);
      if (!result.ok) return { ok: false, error: result.error };
      setHistory((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, cancelledAt: Date.now() } : j)),
      );
      setTreeState((prev) => ({ ...prev, inProgress: null }));
      return { ok: true };
    },
    [busy],
  );

  // Build the enriched node list. Re-compute on tick so progress animates.
  const nodes = useMemo<TechNodeWithStatus[]>(() => {
    return evaluateTechTree(listTechNodes(), treeState, Date.now(), activeJob?.startedAt ?? null);
    // tick.tickCount intentionally in deps so progress re-computes every second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeState, activeJob, tick.tickCount]);

  const value = useMemo<TechTreeContextValue>(
    () => ({
      nodes,
      treeState,
      activeJob,
      history,
      nexusAvailable,
      busy,
      startNode,
      claimNode,
      cancelNode,
      refresh,
    }),
    [
      nodes,
      treeState,
      activeJob,
      history,
      nexusAvailable,
      busy,
      startNode,
      claimNode,
      cancelNode,
      refresh,
    ],
  );

  return <TechTreeContext.Provider value={value}>{children}</TechTreeContext.Provider>;
}

export function useTechTree(): TechTreeContextValue {
  const ctx = useContext(TechTreeContext);
  if (!ctx) throw new Error("useTechTree must be used inside <TechTreeProvider>");
  return ctx;
}

export function useTechTreeOptional(): TechTreeContextValue | null {
  return useContext(TechTreeContext);
}

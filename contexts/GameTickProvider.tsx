"use client";

/**
 * GameTickProvider
 * ================
 *
 * Top-level client provider that drives the idle game loop. It is mounted once
 * inside the (game) route group layout and provides every descendant with:
 *
 *   - Live resource state (advanced every second by `tickEngine.advanceResources`)
 *   - Offline catch-up on mount based on the profile's `last_tick_at`
 *   - A `grant()` escape hatch used by the /dev area and quest rewards
 *   - A `setRate()` hook for future device managers to adjust production
 *
 * Intentionally minimal on purpose: this is Phase 1 scaffolding. Real
 * production chains, device load, and thermal-driven rate modulation will plug
 * in during Phase 4 via the `setRate` surface (not by forking this provider).
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

import {
  TICK_INTERVAL_MS,
  advanceResources,
  computeElapsedSeconds,
  createInitialResources,
  prestigeMultiplier as computePrestigeMultiplier,
  type ResourceId,
  type ResourceMap,
  type ResourceState,
} from "@/lib/game/tickEngine";
import { getPrestige } from "@/app/(game)/actions/prestige";

interface GameTickContextValue {
  /** Current resource state. Re-renders on every applied tick. */
  resources: ResourceMap;
  /** Monotonic tick counter (dev + debugging). */
  tickCount: number;
  /** Wall-clock timestamp (ms) of the most recent tick applied. */
  lastTickAt: number;
  /** Seconds of offline progress applied on mount (for MCP welcome message). */
  offlineCatchUpSeconds: number;
  /** True when offline catch-up hit the hard cap and elapsed time was truncated. */
  offlineTruncated: boolean;
  /**
   * Per-resource amount applied during offline catch-up. Keyed by ResourceId.
   * Stable until `acknowledgeOfflineCatchUp()` is called, then cleared.
   */
  offlineDeltas: Partial<Record<ResourceId, number>>;
  /** True while the WelcomeBackModal has not yet been dismissed. */
  hasUnseenOfflineCatchUp: boolean;
  /** Clear offline-delta state after the player dismisses the Welcome-Back modal. */
  acknowledgeOfflineCatchUp: () => void;
  /** Add or remove units from a resource; clamps to [0, capacity]. */
  grant: (id: ResourceId, delta: number) => void;
  /** Replace the rate-per-second for a resource. */
  setRate: (id: ResourceId, ratePerSecond: number) => void;
  /** Replace the capacity for a resource; re-clamps `amount`. */
  setCapacity: (id: ResourceId, capacity: number) => void;
  /** Kernel-recompile (prestige) level; 0 until loaded / never recompiled. */
  prestigeLevel: number;
  /** Production rate multiplier derived from the prestige level (1.5^level). */
  prestigeMultiplier: number;
  /** Re-fetch the prestige level from the server (call after a recompile). */
  refreshPrestige: () => Promise<void>;
}

const GameTickContext = createContext<GameTickContextValue | null>(null);

export interface GameTickProviderProps {
  children: ReactNode;
  /**
   * Initial resource snapshot (from Supabase `player_saves.data.resources`).
   * If omitted, the engine cold-starts.
   */
  initialResources?: ResourceMap;
  /**
   * Wall-clock timestamp of the profile's last tick — used to compute
   * offline catch-up. If null/undefined, no catch-up is applied.
   */
  initialLastTickAt?: number | null;
}

export function GameTickProvider({
  children,
  initialResources,
  initialLastTickAt,
}: GameTickProviderProps) {
  // Seed state with a deep copy so callers can't mutate our internals
  const [resources, setResources] = useState<ResourceMap>(() =>
    initialResources ? structuredClone(initialResources) : createInitialResources(),
  );
  const [tickCount, setTickCount] = useState(0);
  // lastTickAt starts at 0 and is set to Date.now() on mount. Seeding from
  // Date.now() in useState triggers a hydration mismatch because server and
  // client produce different timestamps on the same render pass.
  const [lastTickAt, setLastTickAt] = useState(0);
  const [offlineCatchUpSeconds, setOfflineCatchUpSeconds] = useState(0);
  const [offlineTruncated, setOfflineTruncated] = useState(false);
  const [offlineDeltas, setOfflineDeltas] = useState<Partial<Record<ResourceId, number>>>({});
  const [hasUnseenOfflineCatchUp, setHasUnseenOfflineCatchUp] = useState(false);
  const [prestigeLevel, setPrestigeLevel] = useState(0);

  const prestigeMult = useMemo(() => computePrestigeMultiplier(prestigeLevel), [prestigeLevel]);

  // Ref mirror so the 1Hz interval sees the current multiplier without being
  // re-created whenever the level changes.
  const prestigeMultRef = useRef(1);
  useEffect(() => {
    prestigeMultRef.current = prestigeMult;
  }, [prestigeMult]);

  // Initialize lastTickAt on the client only.
  useEffect(() => {
    setLastTickAt(Date.now());
  }, []);

  // Ref mirror so the setInterval callback always sees the latest resources
  // without re-creating the interval every tick.
  const resourcesRef = useRef(resources);
  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  // --- Prestige load + offline catch-up (runs once on mount) ---
  //
  // Ordering decision: the offline catch-up must know the prestige multiplier,
  // but the level lives server-side and arrives async. Rather than applying
  // catch-up at multiplier 1 and "patching it up" later (a race hack), the
  // one-shot mount effect SEQUENCES the two: it awaits getPrestige() first and
  // only then applies catch-up with the correct multiplier. The wall-clock gap
  // is measured against `mountedAt` (captured synchronously before the await),
  // so the seconds the 1Hz loop already simulated during the fetch are not
  // double-counted. If the fetch fails, catch-up proceeds at level 0
  // (multiplier 1) — the conservative fallback. An SSR-provided level prop
  // would remove the round-trip entirely but was judged too invasive for this
  // provider's prop surface; revisit if catch-up latency becomes visible.
  useEffect(() => {
    let cancelled = false;
    const mountedAt = Date.now();

    void (async () => {
      let level = 0;
      const prestige = await getPrestige();
      if (prestige.ok) level = prestige.level;
      if (cancelled) return;
      setPrestigeLevel(level);

      if (!initialLastTickAt) return;
      const { elapsedSeconds, truncated } = computeElapsedSeconds(initialLastTickAt, mountedAt);
      if (elapsedSeconds > 0) {
        const result = advanceResources(
          resourcesRef.current,
          elapsedSeconds,
          computePrestigeMultiplier(level),
        );
        setResources(result.nextResources);
        setOfflineCatchUpSeconds(elapsedSeconds);
        setOfflineTruncated(truncated);
        setOfflineDeltas(result.deltas);
        // Only surface the modal when there's actually something worth showing:
        // >60s offline AND at least one non-zero resource delta.
        const anyDelta = Object.values(result.deltas).some((v) => (v ?? 0) > 0);
        if (elapsedSeconds > 60 && anyDelta) {
          setHasUnseenOfflineCatchUp(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // intentionally ignoring changes to initialLastTickAt after mount —
    // catch-up is a one-shot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshPrestige = useCallback(async () => {
    const prestige = await getPrestige();
    if (prestige.ok) setPrestigeLevel(prestige.level);
  }, []);

  const acknowledgeOfflineCatchUp = useCallback(() => {
    setHasUnseenOfflineCatchUp(false);
  }, []);

  // --- 1Hz tick loop ---
  useEffect(() => {
    const interval = setInterval(() => {
      const result = advanceResources(resourcesRef.current, 1, prestigeMultRef.current);
      setResources(result.nextResources);
      setTickCount((c) => c + 1);
      setLastTickAt(Date.now());
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // --- Mutation helpers ---
  const grant = useCallback((id: ResourceId, delta: number) => {
    setResources((prev) => {
      const current: ResourceState = prev[id] ?? {
        amount: 0,
        capacity: Infinity,
        ratePerSecond: 0,
      };
      const next = Math.max(0, Math.min(current.capacity, current.amount + delta));
      const applied = next - current.amount;
      return {
        ...prev,
        [id]: {
          ...current,
          amount: next,
          totalProduced: (current.totalProduced ?? 0) + Math.max(0, applied),
          totalConsumed: (current.totalConsumed ?? 0) + Math.max(0, -applied),
        },
      };
    });
  }, []);

  const setRate = useCallback((id: ResourceId, ratePerSecond: number) => {
    setResources((prev) => {
      const current: ResourceState = prev[id] ?? {
        amount: 0,
        capacity: Infinity,
        ratePerSecond: 0,
      };
      return { ...prev, [id]: { ...current, ratePerSecond } };
    });
  }, []);

  const setCapacity = useCallback((id: ResourceId, capacity: number) => {
    setResources((prev) => {
      const current: ResourceState = prev[id] ?? {
        amount: 0,
        capacity: 0,
        ratePerSecond: 0,
      };
      const amount = Math.min(current.amount, capacity);
      return { ...prev, [id]: { ...current, capacity, amount } };
    });
  }, []);

  const value = useMemo<GameTickContextValue>(
    () => ({
      resources,
      tickCount,
      lastTickAt,
      offlineCatchUpSeconds,
      offlineTruncated,
      offlineDeltas,
      hasUnseenOfflineCatchUp,
      acknowledgeOfflineCatchUp,
      grant,
      setRate,
      setCapacity,
      prestigeLevel,
      prestigeMultiplier: prestigeMult,
      refreshPrestige,
    }),
    [
      resources,
      tickCount,
      lastTickAt,
      offlineCatchUpSeconds,
      offlineTruncated,
      offlineDeltas,
      hasUnseenOfflineCatchUp,
      acknowledgeOfflineCatchUp,
      grant,
      setRate,
      setCapacity,
      prestigeLevel,
      prestigeMult,
      refreshPrestige,
    ],
  );

  return <GameTickContext.Provider value={value}>{children}</GameTickContext.Provider>;
}

/**
 * Subscribe to the game tick. Throws if used outside a GameTickProvider so
 * misuse surfaces loudly instead of silently returning stale defaults.
 */
export function useGameTick(): GameTickContextValue {
  const ctx = useContext(GameTickContext);
  if (!ctx) {
    throw new Error("useGameTick must be used inside <GameTickProvider>");
  }
  return ctx;
}

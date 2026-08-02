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
  type ResourceId,
  type ResourceMap,
  type ResourceState,
} from "@/lib/game/tickEngine";

interface GameTickContextValue {
  /** Current resource state. Re-renders on every applied tick. */
  resources: ResourceMap;
  /** Monotonic tick counter (dev + debugging). */
  tickCount: number;
  /** Wall-clock timestamp (ms) of the most recent tick applied. */
  lastTickAt: number;
  /** Seconds of offline progress applied on mount (for MCP welcome message). */
  offlineCatchUpSeconds: number;
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
  const [offlineDeltas, setOfflineDeltas] = useState<Partial<Record<ResourceId, number>>>({});
  const [hasUnseenOfflineCatchUp, setHasUnseenOfflineCatchUp] = useState(false);

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

  // --- Offline catch-up (runs once on mount) ---
  useEffect(() => {
    if (!initialLastTickAt) return;
    const { elapsedSeconds } = computeElapsedSeconds(initialLastTickAt, Date.now());
    if (elapsedSeconds > 0) {
      const result = advanceResources(resourcesRef.current, elapsedSeconds);
      setResources(result.nextResources);
      setOfflineCatchUpSeconds(elapsedSeconds);
      setOfflineDeltas(result.deltas);
      // Only surface the modal when there's actually something worth showing:
      // >60s offline AND at least one non-zero resource delta.
      const anyDelta = Object.values(result.deltas).some((v) => (v ?? 0) > 0);
      if (elapsedSeconds > 60 && anyDelta) {
        setHasUnseenOfflineCatchUp(true);
      }
    }
    // intentionally ignoring changes to initialLastTickAt after mount —
    // catch-up is a one-shot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acknowledgeOfflineCatchUp = useCallback(() => {
    setHasUnseenOfflineCatchUp(false);
  }, []);

  // --- 1Hz tick loop ---
  useEffect(() => {
    const interval = setInterval(() => {
      const result = advanceResources(resourcesRef.current, 1);
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
      offlineDeltas,
      hasUnseenOfflineCatchUp,
      acknowledgeOfflineCatchUp,
      grant,
      setRate,
      setCapacity,
    }),
    [
      resources,
      tickCount,
      lastTickAt,
      offlineCatchUpSeconds,
      offlineDeltas,
      hasUnseenOfflineCatchUp,
      acknowledgeOfflineCatchUp,
      grant,
      setRate,
      setCapacity,
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

"use client";

/**
 * ResonanceProvider
 * =================
 *
 * Client-side provider for the resonance protocol detection system.
 * Maintains a sliding window buffer of device state events and evaluates
 * all undiscovered protocols against it on each game tick.
 *
 * Must be mounted inside GameTickProvider, QuestProvider, MissionProvider,
 * and NotificationProvider.
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
import { useMission } from "@/contexts/MissionProvider";
import { useNotification } from "@/contexts/NotificationProvider";
import { evaluateResonance, pruneBuffer, pushEvent } from "@/lib/game/resonance/engine";
import { getProtocol, listProtocols } from "@/lib/game/resonance/protocols";
import type { ResonanceProtocol, StateEvent } from "@/lib/game/resonance/types";
import { logDiscovery } from "@/app/(game)/actions/discovery";
import type { StepReward } from "@/lib/game/quests/types";

// ── Context shape ─────────────────────────────────────────────────────

interface ResonanceContextValue {
  /** Discovered protocol IDs. */
  discoveries: string[];
  /** Number of protocols not yet discovered. */
  undiscoveredCount: number;
  /** All protocols (for the discovery log). */
  allProtocols: ResonanceProtocol[];
  /** Push a device state event into the resonance buffer. */
  pushStateEvent: (event: Omit<StateEvent, "timestamp">) => void;
  /** Push a command execution event. */
  pushCommandEvent: (command: string) => void;
}

const ResonanceContext = createContext<ResonanceContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────

export function ResonanceProvider({ children }: { children: ReactNode }) {
  const tick = useGameTick();
  const quest = useQuest();
  const mission = useMission();
  const { notify } = useNotification();

  const [discoveries, setDiscoveries] = useState<string[]>(() => {
    // Seed from quest flags — any resonance_* flags that are already set
    const flags = quest.state.flags;
    return listProtocols()
      .filter((p) => flags[p.discoveryFlag] === true)
      .map((p) => p.id);
  });

  const bufferRef = useRef<StateEvent[]>([]);
  const discoveredSetRef = useRef(new Set(discoveries));

  // Keep discovered set in sync
  useEffect(() => {
    discoveredSetRef.current = new Set(discoveries);
  }, [discoveries]);

  // ── Event push ──────────────────────────────────────────────────────

  const pushStateEvent = useCallback((event: Omit<StateEvent, "timestamp">) => {
    const fullEvent: StateEvent = { ...event, timestamp: Date.now() };
    bufferRef.current = pushEvent(bufferRef.current, fullEvent);
  }, []);

  const pushCommandEvent = useCallback(
    (command: string) => {
      pushStateEvent({
        kind: "command",
        command,
        value: "executed",
      });
    },
    [pushStateEvent],
  );

  // ── Apply rewards (same pattern as QuestProvider) ───────────────────

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
            break;
        }
      }
    },
    [tick],
  );

  // ── Evaluation on each tick ─────────────────────────────────────────

  useEffect(() => {
    // Prune old events
    bufferRef.current = pruneBuffer(bufferRef.current, Date.now());

    if (bufferRef.current.length === 0) return;

    const flags = quest.state.flags;
    const protocols = listProtocols();

    const matches = evaluateResonance(bufferRef.current, protocols, flags);

    for (const match of matches) {
      if (!match.isFirstDiscovery) continue;
      if (discoveredSetRef.current.has(match.protocolId)) continue;

      // New discovery!
      const protocol = getProtocol(match.protocolId);
      if (!protocol) continue;

      // Update local state
      discoveredSetRef.current.add(match.protocolId);
      setDiscoveries((prev) => [...prev, match.protocolId]);

      // Apply rewards
      applyRewards(match.rewards);

      // Update mission progress for discovery objectives
      mission.updateProgress(
        `m004.obj.harmonic_discovery`, // specific objective
        1,
      );
      // Also update any generic discovery count objectives
      mission.incrementProgress("m006.obj.discover_2", 1);

      // Notify
      notify("discovery", `Resonance Discovered: ${protocol.codename}`, protocol.description, 8000);

      // Log to server
      void logDiscovery(match.protocolId);
    }
  }, [tick.tickCount, quest.state.flags, applyRewards, mission, notify]);

  // ── Derived values ──────────────────────────────────────────────────

  const allProtocols = useMemo(() => listProtocols(), []);

  const undiscoveredCount = useMemo(
    () => allProtocols.length - discoveries.length,
    [allProtocols, discoveries],
  );

  const value = useMemo<ResonanceContextValue>(
    () => ({
      discoveries,
      undiscoveredCount,
      allProtocols,
      pushStateEvent,
      pushCommandEvent,
    }),
    [discoveries, undiscoveredCount, allProtocols, pushStateEvent, pushCommandEvent],
  );

  return <ResonanceContext.Provider value={value}>{children}</ResonanceContext.Provider>;
}

export function useResonance(): ResonanceContextValue {
  const ctx = useContext(ResonanceContext);
  if (!ctx) {
    throw new Error("useResonance must be used inside <ResonanceProvider>");
  }
  return ctx;
}

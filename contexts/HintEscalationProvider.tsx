"use client";

/**
 * HintEscalationProvider
 * ======================
 *
 * Layers a **global** idle watcher on top of MissionProvider's per-objective
 * hintLevel. It computes a single "how lost is this operator right now"
 * level at 60 s / 5 min / 15 min thresholds, and fires exactly one side
 * effect per upward transition:
 *
 *   - Level 1: no side effect (just reflected in state for the tips bar)
 *   - Level 2: surface `whatNext()` in the tips bar (via the exposed state)
 *   - Level 3: journal HINT entry + toast notification
 *
 * Debounces so an operator hanging at the same level for an hour gets
 * exactly one prompt, not sixty. When they touch something and the level
 * resets to 0, the provider re-arms for the next stall.
 *
 * Must be mounted inside MissionProvider + JournalProvider + NotificationProvider.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useMission } from "@/contexts/MissionProvider";
import { useJournal } from "@/contexts/JournalProvider";
import { useNotification } from "@/contexts/NotificationProvider";
import { useGameTick } from "@/contexts/GameTickProvider";
import {
  computeGlobalHint,
  isEscalation,
  type GlobalHintState,
  type HintLevel,
  type ObjectiveIdleSnapshot,
} from "@/lib/game/hints/engine";
import type { MissionSuggestion } from "@/lib/game/missions/types";

interface HintEscalationContextValue {
  /** Current global hint state (level + elapsed + driving objective). */
  global: GlobalHintState;
  /**
   * The `whatNext` suggestion the provider elevated on the most recent
   * level-2+ escalation. Null when level is 0 or 1 so the tips bar can
   * fall back to its normal contextual-tip behavior.
   */
  elevatedSuggestion: MissionSuggestion | null;
}

const HintEscalationContext = createContext<HintEscalationContextValue | null>(null);

export function HintEscalationProvider({ children }: { children: ReactNode }) {
  const mission = useMission();
  const journal = useJournal();
  const notif = useNotification();
  const tick = useGameTick();

  const [global, setGlobal] = useState<GlobalHintState>({
    level: 0,
    elapsedMs: 0,
    drivingObjectiveId: null,
    drivingMissionId: null,
  });
  const [elevatedSuggestion, setElevatedSuggestion] = useState<MissionSuggestion | null>(null);

  // Track the previous level so we only fire on upward transitions.
  const previousLevelRef = useRef<HintLevel>(0);

  // Build the snapshot list from the mission state each tick. Kept as a
  // useMemo so the recompute cost is bounded by missionState changes, not
  // the full tick rate.
  const snapshots = useMemo<ObjectiveIdleSnapshot[]>(() => {
    const out: ObjectiveIdleSnapshot[] = [];
    for (const m of mission.allMissions) {
      if (m.status !== "active") continue;
      for (const task of m.tasks) {
        if (task.status === "completed") continue;
        for (const obj of task.objectives) {
          if (obj.status === "completed") continue;
          out.push({
            objectiveId: obj.id,
            missionId: m.id,
            lastActivityAt: mission.missionState.lastActivityAt[obj.id] ?? null,
            active: true,
          });
        }
      }
    }
    return out;
  }, [mission.allMissions, mission.missionState.lastActivityAt]);

  // Recompute the global level once per tick (1 Hz).
  useEffect(() => {
    const next = computeGlobalHint(snapshots, Date.now());
    setGlobal((prev) =>
      prev.level === next.level &&
      prev.drivingObjectiveId === next.drivingObjectiveId &&
      Math.abs(prev.elapsedMs - next.elapsedMs) < 1000
        ? prev
        : next,
    );

    const prevLevel = previousLevelRef.current;
    if (isEscalation(prevLevel, next.level)) {
      // Upward edge. Decide whether to fire side effects.
      if (next.level >= 2) {
        const suggestion = mission.whatNext();
        setElevatedSuggestion(suggestion);

        if (next.level === 3) {
          journal.write(
            "hint",
            5, // priority: notice
            `Operator appears idle for ${Math.round(next.elapsedMs / 60000)}m. Suggestion: ${suggestion.action}`,
          );
          notif.notify("tip", "Stalled?", suggestion.action, 8000);
        } else if (next.level === 2) {
          journal.write(
            "hint",
            6, // priority: info
            `Stall detected on ${next.drivingObjectiveId ?? "unknown"}: ${suggestion.reason}`,
          );
        }
      } else if (next.level === 1) {
        // Just reflected in state; no user-facing side effect.
      }
    }

    if (next.level === 0 && prevLevel > 0) {
      // Operator is active again — clear the elevated suggestion so the tips
      // bar resumes its normal contextual tips.
      setElevatedSuggestion(null);
    }

    previousLevelRef.current = next.level;
    // Intentionally depend on tickCount so we re-evaluate every second even
    // when `snapshots` is stable (elapsed grows without state changing).
  }, [snapshots, tick.tickCount, journal, notif, mission]);

  const value = useMemo<HintEscalationContextValue>(
    () => ({ global, elevatedSuggestion }),
    [global, elevatedSuggestion],
  );

  return <HintEscalationContext.Provider value={value}>{children}</HintEscalationContext.Provider>;
}

export function useHintEscalation(): HintEscalationContextValue {
  const ctx = useContext(HintEscalationContext);
  if (!ctx) {
    throw new Error("useHintEscalation must be used inside <HintEscalationProvider>");
  }
  return ctx;
}

export function useHintEscalationOptional(): HintEscalationContextValue | null {
  return useContext(HintEscalationContext);
}

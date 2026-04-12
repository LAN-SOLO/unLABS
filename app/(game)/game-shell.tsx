"use client";

/**
 * GameShell
 * =========
 *
 * Client entry point for the (game) route group. Mounts the tick provider,
 * registers save-sync with the browser lifecycle (debounced writes + flush on
 * unload), and renders the rest of the game tree.
 *
 * Kept deliberately small so the server layout stays a pure passthrough and
 * every hook here runs inside the provider boundary.
 */

import { useEffect, type ReactNode } from "react";

import { GameTickProvider, useGameTick } from "@/contexts/GameTickProvider";
import { QuestProvider } from "@/contexts/QuestProvider";
import { ProductionProvider } from "@/contexts/ProductionProvider";
import { MissionProvider } from "@/contexts/MissionProvider";
import { NotificationProvider } from "@/contexts/NotificationProvider";
import { ResonanceProvider } from "@/contexts/ResonanceProvider";
import { NotificationStack } from "@/components/notifications/NotificationStack";
import { cancelScheduledSave, flushSave, scheduleSave } from "@/lib/game/saveSync";
import type { ResourceMap } from "@/lib/game/tickEngine";
import type { ProductionJob } from "@/lib/game/production";

interface GameShellProps {
  children: ReactNode;
  initialResources?: ResourceMap;
  initialLastTickAt: number | null;
  initialSave: Record<string, unknown>;
  initialEpisodeId: string;
  initialQuestState: unknown;
  initialJobs: ProductionJob[];
  initialBalance: number;
  initialMissionState: unknown;
}

export function GameShell({
  children,
  initialResources,
  initialLastTickAt,
  initialSave,
  initialEpisodeId,
  initialQuestState,
  initialJobs,
  initialBalance,
  initialMissionState,
}: GameShellProps) {
  return (
    <GameTickProvider initialResources={initialResources} initialLastTickAt={initialLastTickAt}>
      <QuestProvider initialEpisodeId={initialEpisodeId} initialQuestState={initialQuestState}>
        <ProductionProvider initialJobs={initialJobs} initialBalance={initialBalance}>
          <MissionProvider initialMissionState={initialMissionState}>
            <NotificationProvider>
              <ResonanceProvider>
                <SaveSyncBridge initialSave={initialSave}>
                  {children}
                  <NotificationStack />
                </SaveSyncBridge>
              </ResonanceProvider>
            </NotificationProvider>
          </MissionProvider>
        </ProductionProvider>
      </QuestProvider>
    </GameTickProvider>
  );
}

/**
 * Bridges the live game state to the save-sync singleton. Runs inside the
 * GameTickProvider so it can read `resources` and `lastTickAt` directly.
 *
 * Write policy:
 *   - Debounced push (5s) on every tick
 *   - Flush immediately on `pagehide` / `beforeunload` so closing the tab
 *     never loses more than the last partial second
 *   - Cancel pending saves on unmount (SPA navigation) to avoid a stale
 *     payload racing the next mount's hydration
 */
function SaveSyncBridge({
  children,
  initialSave,
}: {
  children: ReactNode;
  initialSave: Record<string, unknown>;
}) {
  const { resources, lastTickAt, tickCount } = useGameTick();

  // Debounced auto-save. `scheduleSave` handles the coalescing internally.
  useEffect(() => {
    const payload = {
      data: { ...initialSave, resources },
      lastTickAt,
    };
    scheduleSave(payload);
    // Depending on `tickCount` ensures we re-queue every tick without needing
    // to deep-equal `resources` in the effect deps.
  }, [tickCount, resources, lastTickAt, initialSave]);

  // Lifecycle flush: try hard to persist the final state on unload.
  useEffect(() => {
    const handleHide = () => {
      void flushSave();
    };
    window.addEventListener("pagehide", handleHide);
    window.addEventListener("beforeunload", handleHide);
    return () => {
      window.removeEventListener("pagehide", handleHide);
      window.removeEventListener("beforeunload", handleHide);
      cancelScheduledSave();
    };
  }, []);

  return <>{children}</>;
}

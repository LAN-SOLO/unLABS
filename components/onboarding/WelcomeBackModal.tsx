"use client";

/**
 * WelcomeBackModal
 * ================
 *
 * Surfaced on mount when the player has been away long enough for the tick
 * engine to apply meaningful offline progress (>60s gap AND at least one
 * resource actually ticked up). Dismissal is recorded on the profile so we
 * don't nag across tab reloads within the same session — the ack endpoint
 * just writes a timestamp; the real gating is the unseen flag in the tick
 * context.
 *
 * Keeping it as a right-corner aside (not a center-screen modal) is a
 * deliberate UX call: the player hasn't "arrived at" anything; they're just
 * resuming. A full-blocking modal would feel adversarial for a checking-in
 * session. Escape / outside click is fine to dismiss.
 */

import { useCallback, useEffect } from "react";

import { useGameTick } from "@/contexts/GameTickProvider";
import { ackWelcomeBack } from "@/app/(game)/actions/tutorial";
import type { ResourceId } from "@/lib/game/tickEngine";

const RESOURCE_LABEL: Partial<Record<ResourceId, string>> = {
  abstractum: "Abstractum",
  energy: "Energy",
  base_alloy: "Base Alloy",
  advanced_alloy: "Advanced Alloy",
  nanomaterial: "Nanomaterial",
  exotic_matter: "Exotic Matter",
  antimatter: "Antimatter",
  research: "Research",
};

const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

function formatDuration(seconds: number): string {
  const clamped = Math.min(Math.max(seconds, 0), MAX_OFFLINE_SECONDS);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${clamped}s`;
}

export function WelcomeBackModal() {
  const {
    offlineCatchUpSeconds,
    offlineDeltas,
    hasUnseenOfflineCatchUp,
    acknowledgeOfflineCatchUp,
  } = useGameTick();

  const dismiss = useCallback(() => {
    acknowledgeOfflineCatchUp();
    void ackWelcomeBack();
  }, [acknowledgeOfflineCatchUp]);

  // Escape-to-dismiss for keyboard users.
  useEffect(() => {
    if (!hasUnseenOfflineCatchUp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasUnseenOfflineCatchUp, dismiss]);

  if (!hasUnseenOfflineCatchUp) return null;

  const capped = offlineCatchUpSeconds >= MAX_OFFLINE_SECONDS;

  // Top-3 resource gains, descending.
  const deltas = Object.entries(offlineDeltas)
    .map(([id, amount]) => [id as ResourceId, amount ?? 0] as const)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <aside
      aria-label="Welcome back"
      className="pointer-events-auto fixed top-4 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 border border-green-500/60 bg-black/95 font-mono text-sm text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.35)] backdrop-blur"
    >
      <header className="flex items-center justify-between border-b border-green-500/40 px-3 py-2">
        <span className="text-green-300">[ WELCOME BACK, OPERATOR ]</span>
        {capped && (
          <span className="rounded border border-amber-500/60 px-1.5 py-0.5 text-[10px] tracking-wider text-amber-300 uppercase">
            capped
          </span>
        )}
      </header>

      <div className="space-y-3 px-4 py-3">
        <p className="text-green-300">
          Offline duration:{" "}
          <span className="text-green-100">{formatDuration(offlineCatchUpSeconds)}</span>
        </p>

        {deltas.length === 0 ? (
          <p className="text-gray-400">
            No passive resources ticked. Build a device first, then return.
          </p>
        ) : (
          <div>
            <p className="mb-1 text-gray-400">Accrued while you were away:</p>
            <ul className="space-y-0.5">
              {deltas.map(([id, amount]) => (
                <li key={id} className="flex justify-between">
                  <span className="text-gray-300">{RESOURCE_LABEL[id] ?? id}</span>
                  <span className="text-green-200 tabular-nums">+{amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {capped && (
          <p className="text-[11px] text-amber-300/80">
            Offline progress is capped at 8 hours. Long breaks are welcome, but the lab will not
            hoard more than that.
          </p>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-green-500/40 px-3 py-2">
        <span className="text-[10px] text-gray-500">ESC to dismiss</span>
        <button
          type="button"
          onClick={dismiss}
          className="border border-green-500/60 bg-green-500/10 px-3 py-1 text-xs tracking-wider text-green-300 uppercase transition-colors hover:bg-green-500/20 focus:ring-1 focus:ring-green-300 focus:outline-none"
        >
          Back to it
        </button>
      </footer>
    </aside>
  );
}

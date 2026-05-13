"use client";

/**
 * NexusModule
 * ===========
 *
 * Compact panel tile for the NXS-01 Nexus. Shows:
 *   - Device state chip (built / offline / online)
 *   - Current research job (title + progress bar) when one is active
 *   - A rotating neon graph pattern when idle (purely visual)
 *   - A "claim" CTA when the active job is ready
 *
 * Hides itself entirely when `nexus_built` is false so the panel stays
 * clean for Phase 0–2 players.
 */

import { useMemo } from "react";

import { useNexusOptional } from "@/contexts/NexusManager";
import { useTechTreeOptional } from "@/contexts/TechTreeProvider";
import { useGameTick } from "@/contexts/GameTickProvider";
import { getTechNode } from "@/lib/game/techTree";

function fmtRemaining(sec: number): string {
  if (sec <= 0) return "READY";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function NexusModule() {
  const nexus = useNexusOptional();
  const tree = useTechTreeOptional();
  // Subscribe to tickCount so the progress bar re-renders once per second.
  // The actual value is unused; we just need to re-render.
  const { tickCount: _tickCount, lastTickAt } = useGameTick();
  void _tickCount;

  const activeJob = tree?.activeJob ?? null;
  const node = useMemo(() => (activeJob ? getTechNode(activeJob.nodeId) : null), [activeJob]);

  if (!nexus || !tree) return null;
  if (!nexus.isBuilt) return null;

  // `lastTickAt` is driven by the 1Hz interval and stable within a render.
  // On the first render it can be 0 (before the effect sets it); fall back
  // to activeJob.startedAt so progress starts at 0 rather than flashing
  // ready.
  const now = lastTickAt > 0 ? lastTickAt : (activeJob?.startedAt ?? 0);
  const remaining = activeJob ? Math.max(0, Math.ceil((activeJob.completesAt - now) / 1000)) : 0;
  const pct =
    activeJob && node
      ? Math.min(
          100,
          Math.max(0, Math.floor(((now - activeJob.startedAt) / (node.durationSec * 1000)) * 100)),
        )
      : 0;

  const stateLabel = !nexus.isOnline
    ? "STANDBY"
    : activeJob
      ? remaining === 0
        ? "READY"
        : "RESEARCHING"
      : "IDLE";

  const stateColor =
    stateLabel === "READY"
      ? "text-amber-300"
      : stateLabel === "RESEARCHING"
        ? "text-cyan-300"
        : stateLabel === "STANDBY"
          ? "text-gray-500"
          : "text-green-400";

  return (
    <div className="border border-green-500/30 bg-black/80 font-mono backdrop-blur-sm">
      <header className="flex items-center justify-between border-b border-green-500/20 px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-wider text-green-400 uppercase">NXS-01 Nexus</span>
          <span className={`text-[9px] tracking-wider ${stateColor}`}>[{stateLabel}]</span>
        </div>
        <span className="text-[8px] text-green-500/40">T2 · Gadget</span>
      </header>

      <div className="space-y-1 px-2 py-2">
        {activeJob && node ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-green-200">{node.title}</span>
              <span className="text-[10px] text-gray-500 tabular-nums">
                {fmtRemaining(remaining)}
              </span>
            </div>
            <div className="h-1 w-full bg-green-500/10">
              <div
                className={`h-full ${remaining === 0 ? "bg-amber-400/80" : "bg-cyan-400/70"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[9px] text-gray-500">{node.description}</p>
            {remaining === 0 && (
              <button
                type="button"
                onClick={() => void tree.claimNode(activeJob.id)}
                disabled={tree.busy}
                className="mt-1 w-full border border-amber-400/60 bg-amber-500/10 px-2 py-0.5 text-[10px] tracking-wider text-amber-200 uppercase transition-colors hover:bg-amber-500/20 disabled:opacity-50"
              >
                Claim unlock
              </button>
            )}
          </>
        ) : (
          <>
            {/* Idle holo-graph pulse */}
            <div className="relative h-12 w-full overflow-hidden">
              <div className="absolute inset-0 opacity-40">
                <svg viewBox="0 0 100 48" className="h-full w-full">
                  <g stroke="currentColor" strokeWidth="0.4" fill="none" className="text-green-400">
                    <path d="M10 40 L30 25 L50 35 L70 15 L90 30" />
                    <circle cx="10" cy="40" r="1.5" fill="currentColor" />
                    <circle cx="30" cy="25" r="1.5" fill="currentColor" />
                    <circle cx="50" cy="35" r="1.5" fill="currentColor" />
                    <circle cx="70" cy="15" r="1.5" fill="currentColor" />
                    <circle cx="90" cy="30" r="1.5" fill="currentColor" />
                  </g>
                </svg>
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-green-500/60">
                {nexus.isOnline ? "awaiting research" : "standby"}
              </div>
            </div>
            <p className="text-[9px] text-gray-500">
              {tree.treeState.unlocked.length} unlocked / {tree.nodes.length} nodes
            </p>
          </>
        )}
      </div>
    </div>
  );
}

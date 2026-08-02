"use client";

/**
 * MissionPanel
 * ============
 *
 * Left sidebar widget showing tracked missions with progress bars,
 * task checklists, and contextual tips. CRT aesthetic matching the
 * existing panel visual language.
 */

import { useState, useMemo } from "react";
import { useMission } from "@/contexts/MissionProvider";
import { useGameTick } from "@/contexts/GameTickProvider";
import { useHintEscalationOptional } from "@/contexts/HintEscalationProvider";
import { MissionProgressBar } from "./MissionProgressBar";
import { TaskChecklist } from "./TaskChecklist";
import { getActiveTip } from "@/lib/game/tips";
import type { MissionWithStatus } from "@/lib/game/missions/types";

export function MissionPanel() {
  const {
    allMissions,
    availableMissions,
    completedCount,
    isBusy,
    claimingId,
    claimError,
    trackMission,
    untrackMission,
    claimMission,
    questFlags,
  } = useMission();

  const tick = useGameTick();
  const hint = useHintEscalationOptional();

  const [isExpanded, setIsExpanded] = useState(true);
  const [showAvailable, setShowAvailable] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const tip = useMemo(() => getActiveTip(questFlags, tick.resources), [questFlags, tick.resources]);
  // When the hint engine has escalated to level 2+, override the rotating tip
  // with a concrete `whatNext` suggestion so the stalled operator gets
  // something specific to do instead of ambient flavor text.
  const elevated = hint?.elevatedSuggestion ?? null;

  const activeMissions = availableMissions.filter(
    (m) => m.status === "active" || m.status === "completed",
  );
  const untracked = availableMissions.filter((m) => m.status === "available");
  const claimed = allMissions.filter((m) => m.status === "claimed");

  // Don't render if missions aren't unlocked yet
  const hasMissions = allMissions.some((m) => m.status !== "locked");
  if (!hasMissions) return null;

  return (
    <div
      data-mission-panel
      aria-label="Missions panel"
      className="border border-green-500/30 bg-black/80 font-mono backdrop-blur-sm"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded((e) => !e)}
        className="flex w-full items-center justify-between border-b border-green-500/20 px-2 py-1 transition-colors hover:bg-green-500/5"
      >
        <span className="text-[10px] tracking-wider text-green-400 uppercase">Missions</span>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-green-500/50">
            {completedCount}/{allMissions.length}
          </span>
          <span className="text-[10px] text-green-500/40">{isExpanded ? "\u25B2" : "\u25BC"}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="scrollbar-thin scrollbar-thumb-green-500/20 max-h-[320px] space-y-2 overflow-y-auto p-1.5">
          {/* Active/completed missions */}
          {activeMissions.length === 0 && untracked.length === 0 && (
            <div className="py-2 text-center text-[9px] text-gray-500">
              No active missions. All complete.
            </div>
          )}

          {activeMissions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              isBusy={isBusy}
              claimingId={claimingId}
              claimError={claimError?.missionId === mission.id ? claimError.message : null}
              onClaim={claimMission}
              onUntrack={untrackMission}
            />
          ))}

          {/* Elevated hint from the escalation engine wins over the ambient tip */}
          {elevated && (
            <div className="border-t border-amber-500/30 bg-amber-500/5 px-1 py-1 text-center font-mono">
              <span className="text-[9px] tracking-wider text-amber-300/70 uppercase">
                Suggestion
              </span>
              <p className="text-[10px] text-amber-200">{elevated.action}</p>
              {elevated.reason && <p className="text-[8px] text-amber-500/60">{elevated.reason}</p>}
            </div>
          )}

          {/* Contextual tip */}
          {!elevated && tip && activeMissions.length === 0 && (
            <div className="border-t border-green-500/10 py-1 text-center font-mono text-[8px]">
              <span
                className={
                  tip.voice === "jade"
                    ? "text-teal-400/60 italic"
                    : tip.voice === "mcp"
                      ? "text-green-400/60"
                      : tip.voice === "fridge"
                        ? "text-amber-400/60"
                        : "text-gray-500"
                }
              >
                {tip.text}
              </span>
            </div>
          )}

          {/* Available missions toggle */}
          {untracked.length > 0 && (
            <div>
              <button
                onClick={() => setShowAvailable((s) => !s)}
                className="w-full py-0.5 text-center text-[9px] text-amber-400/70 transition-colors hover:text-amber-300"
              >
                {showAvailable ? "\u25B2 Hide" : "\u25BC Show"} {untracked.length} available mission
                {untracked.length !== 1 ? "s" : ""}
              </button>

              {showAvailable && (
                <div className="mt-1 space-y-1">
                  {untracked.map((mission) => (
                    <AvailableMissionCard
                      key={mission.id}
                      mission={mission}
                      isBusy={isBusy}
                      onTrack={trackMission}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Completed (claimed) missions — kept reviewable after they
              leave the active list. Full details live in the journal. */}
          {claimed.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted((s) => !s)}
                className="w-full py-0.5 text-center text-[9px] text-green-500/60 transition-colors hover:text-green-400"
              >
                {showCompleted ? "▲ Hide" : "▼ Show"} {claimed.length} completed mission
                {claimed.length !== 1 ? "s" : ""}
              </button>

              {showCompleted && (
                <div className="mt-1 space-y-1">
                  {claimed.map((mission) => (
                    <div
                      key={mission.id}
                      className="flex items-center justify-between rounded border border-green-500/15 bg-black/40 px-1.5 py-1"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-[10px] text-green-400">✓</span>
                        <span className="truncate text-[10px] text-green-500/70 line-through">
                          {mission.title}
                        </span>
                      </div>
                      <span className="ml-1 shrink-0 text-[8px] text-green-500/30 uppercase">
                        {mission.category}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function MissionCard({
  mission,
  isBusy,
  claimingId,
  claimError,
  onClaim,
  onUntrack,
}: {
  mission: MissionWithStatus;
  isBusy: boolean;
  claimingId: string | null;
  claimError: string | null;
  onClaim: (id: string) => void;
  onUntrack: (id: string) => void;
}) {
  const { missionState } = useMission();
  const isComplete = mission.status === "completed";
  const isClaiming = claimingId === mission.id;

  return (
    <div
      className={`space-y-1 rounded border px-1.5 py-1 ${
        isComplete ? "border-green-400/40 bg-green-500/5" : "border-green-500/20 bg-black/40"
      }`}
    >
      {/* Title row */}
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-bold ${isComplete ? "text-green-300" : "text-green-400"}`}
        >
          {mission.title}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-green-500/40 uppercase">{mission.category}</span>
        </div>
      </div>

      {/* Progress bar */}
      <MissionProgressBar completed={mission.completedTaskCount} total={mission.tasks.length} />

      {/* Tasks */}
      <TaskChecklist tasks={mission.tasks} hintLevels={missionState.hintLevel} />

      {/* Claim error — shown until the next attempt */}
      {claimError && (
        <p className="text-[8px] text-red-400/80">claim failed: {claimError} — try again</p>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-1 pt-0.5">
        {isComplete && (
          <button
            data-mission-claim={mission.id}
            onClick={() => onClaim(mission.id)}
            disabled={claimingId !== null}
            className="rounded border border-green-400/50 px-1.5 py-0.5 text-[9px] text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
          >
            {isClaiming ? "CLAIMING…" : "CLAIM"}
          </button>
        )}
        {!isComplete && (
          <button
            onClick={() => onUntrack(mission.id)}
            disabled={isBusy}
            className="px-1 py-0.5 text-[8px] text-gray-500 transition-colors hover:text-gray-400"
          >
            untrack
          </button>
        )}
      </div>
    </div>
  );
}

function AvailableMissionCard({
  mission,
  isBusy,
  onTrack,
}: {
  mission: MissionWithStatus;
  isBusy: boolean;
  onTrack: (id: string) => void;
}) {
  return (
    <div className="rounded border border-amber-500/20 bg-black/40 px-1.5 py-1">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-bold text-amber-300">{mission.title}</div>
          <div className="truncate text-[8px] text-gray-500">{mission.flavor}</div>
        </div>
        <button
          onClick={() => onTrack(mission.id)}
          disabled={isBusy}
          className="ml-1 shrink-0 rounded border border-amber-500/40 px-1.5 py-0.5 text-[9px] text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
        >
          TRACK
        </button>
      </div>
    </div>
  );
}

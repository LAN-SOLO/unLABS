"use client";

/**
 * TaskChecklist
 * =============
 *
 * Renders a mission's tasks as a checklist with LED-style indicators.
 * Each task shows its objectives and current progress.
 */

import type { TaskWithStatus } from "@/lib/game/missions/types";
import { useTutorialDifficulty } from "@/contexts/TutorialProvider";

interface TaskChecklistProps {
  tasks: TaskWithStatus[];
  /** Hint levels from mission state for escalated hint display. */
  hintLevels: Record<string, number>;
}

function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-block h-2 w-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
      );
    case "in_progress":
      return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />;
    case "available":
      return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400/70" />;
    case "locked":
    default:
      return <span className="inline-block h-2 w-2 rounded-full bg-gray-600" />;
  }
}

export function TaskChecklist({ tasks, hintLevels }: TaskChecklistProps) {
  // Hard mode (and pre-difficulty default behavior) gates the basic hint
  // behind the 60s stall timer. Easy mode and the explicit "hard" choice
  // both reveal it immediately so a fresh player isn't staring at a bare
  // objective with no how-to.
  const difficulty = useTutorialDifficulty();
  const revealHintImmediately = difficulty !== null;
  return (
    <div className="space-y-1.5">
      {tasks.map((task) => (
        <div key={task.id} className="space-y-0.5">
          {/* Task header */}
          <div className="flex items-center gap-1.5">
            <StatusIndicator status={task.status} />
            <span
              className={`font-mono text-[10px] ${
                task.status === "completed"
                  ? "text-green-400/60 line-through"
                  : task.status === "locked"
                    ? "text-gray-600"
                    : "text-green-300"
              }`}
            >
              {task.label}
            </span>
          </div>

          {/* Objectives */}
          {task.status !== "locked" && task.status !== "completed" && (
            <div className="ml-3.5 space-y-0.5">
              {task.objectives.map((obj) => {
                const showProgress = obj.targetValue > 1 && obj.status !== "locked";
                const hintLevel = hintLevels[obj.id] ?? 0;
                const effectiveHintLevel = revealHintImmediately && hintLevel < 1 ? 1 : hintLevel;
                const hintText =
                  effectiveHintLevel >= 2
                    ? (obj.deepDiveHint ?? obj.hint)
                    : effectiveHintLevel >= 1
                      ? obj.hint
                      : null;

                return (
                  <div key={obj.id}>
                    <div className="flex items-center gap-1">
                      <span
                        className={`font-mono text-[9px] ${
                          obj.status === "completed"
                            ? "text-green-500/50 line-through"
                            : "text-gray-400"
                        }`}
                      >
                        {obj.status === "completed" ? "\u2713" : "\u2022"} {obj.description}
                      </span>
                      {showProgress && (
                        <span className="font-mono text-[8px] text-amber-400/70">
                          ({Math.min(obj.currentValue, obj.targetValue)}/{obj.targetValue})
                        </span>
                      )}
                    </div>
                    {hintText && obj.status !== "completed" && (
                      <div className="mt-0.5 ml-2 font-mono text-[8px] text-teal-400/60 italic">
                        {hintText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

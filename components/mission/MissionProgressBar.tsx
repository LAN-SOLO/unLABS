"use client";

/**
 * MissionProgressBar
 * ==================
 *
 * Segmented progress bar showing completedTasks / totalTasks. Each
 * segment lights up green when its task is complete.
 */

interface MissionProgressBarProps {
  completed: number;
  total: number;
}

export function MissionProgressBar({ completed, total }: MissionProgressBarProps) {
  if (total === 0) return null;

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }, (_, i) => {
        const isComplete = i < completed;
        return (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              isComplete ? "bg-green-400 shadow-[0_0_4px_rgba(34,197,94,0.5)]" : "bg-green-500/20"
            }`}
          />
        );
      })}
    </div>
  );
}

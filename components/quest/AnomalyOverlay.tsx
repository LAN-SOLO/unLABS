"use client";

/**
 * AnomalyOverlay
 * ==============
 *
 * Full-viewport ambient effect that activates once the player has
 * witnessed the first anomaly in EP1. Purely cosmetic — renders a faint
 * animated noise gradient and a corner status badge so the player can see
 * the game remembers what they did.
 *
 * Intentionally subtle: it sits behind the UI (pointer-events-none) and
 * above the scanline layer already drawn on the terminal page. No z-index
 * contention with the QuestOverlay (which sits at z-40).
 */

import { useAnomalyMode } from "@/hooks/useAnomalyMode";

export function AnomalyOverlay() {
  const { active } = useAnomalyMode();
  if (!active) return null;

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-30 mix-blend-screen"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(236,72,153,0.05) 0%, rgba(236,72,153,0) 55%), repeating-linear-gradient(90deg, rgba(236,72,153,0.02) 0px, rgba(236,72,153,0.02) 1px, transparent 1px, transparent 4px)",
          animation: "anomaly-drift 7s linear infinite",
        }}
      />
      <div
        aria-label="Anomaly feed active"
        className="pointer-events-none fixed bottom-4 left-4 z-40 border border-pink-500/50 bg-black/80 px-2 py-1 font-mono text-[10px] text-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.3)]"
      >
        ANOM-FEED: ACTIVE
      </div>
      <style jsx global>{`
        @keyframes anomaly-drift {
          0% {
            background-position:
              0 0,
              0 0;
          }
          100% {
            background-position:
              0 0,
              40px 0;
          }
        }
      `}</style>
    </>
  );
}

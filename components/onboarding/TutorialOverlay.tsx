"use client";

/**
 * TutorialOverlay
 * ===============
 *
 * Easy-mode interactive walkthrough surface. Renders a step card pointing at
 * a target UI element (or floating in `position` if no target). Auto-advances
 * the moment the current step's `advance` predicate is satisfied; the player
 * can also press "Got it" on `allowSkipAhead` steps to nudge forward.
 *
 * The component is a self-contained tooltip — no portal needed because the
 * card uses `position: fixed` and a viewport-relative pointer to the target.
 * Highlight ring is drawn as a separate fixed element overlapping the
 * target's bounding rect.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useMissionOptional } from "@/contexts/MissionProvider";
import { useQuest } from "@/contexts/QuestProvider";
import { useTutorial } from "@/contexts/TutorialProvider";
import { useJournalOptional } from "@/contexts/JournalProvider";
import {
  OVERLAY_STEP_COUNT,
  OVERLAY_STEPS,
  getOverlayStep,
} from "@/lib/game/tutorial/overlaySteps";
import { predicateSatisfied, type OverlayObservation } from "@/lib/game/tutorial/overlayTypes";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Re-resolves a CSS selector to a bounding rect. Returns null if no element
 * matches (e.g. the player navigated away from the page that hosts it).
 *
 * Polls on a 200ms interval so the highlight tracks layout changes (window
 * resize, panel collapse, route change) without us wiring a global
 * MutationObserver. 200ms is a deliberate compromise: snappy enough that the
 * highlight doesn't lag the cursor, cheap enough that we don't spike the
 * main thread when the overlay is mounted.
 */
function useTargetRect(selector: string | null | undefined): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);
  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = (el as Element).getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    // Defer the first measurement so we don't setState synchronously inside
    // effect setup — avoids the React cascading-render lint warning.
    const initialId = window.setTimeout(measure, 0);
    const interval = window.setInterval(measure, 200);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.clearTimeout(initialId);
      window.clearInterval(interval);
      window.removeEventListener("resize", measure);
    };
  }, [selector]);
  return rect;
}

export function TutorialOverlay() {
  const tutorial = useTutorial();
  const mission = useMissionOptional();
  const quest = useQuest();
  const pathname = usePathname();

  // Build the observation — kept lean so re-renders are cheap.
  const observation: OverlayObservation = useMemo(() => {
    const missionStatus: Record<string, string> = {};
    const objectiveStatus: Record<string, string> = {};
    if (mission) {
      for (const m of mission.allMissions) {
        missionStatus[m.id] = m.status;
        for (const task of m.tasks) {
          for (const obj of task.objectives) {
            objectiveStatus[`${m.id}.${obj.id}`] = obj.status;
          }
        }
      }
    }
    return {
      questFlags: quest.state.flags,
      missionStatus,
      objectiveStatus,
      onPanel: (pathname ?? "").startsWith("/panel"),
      onLab: (pathname ?? "").startsWith("/lab"),
    };
  }, [mission, quest.state.flags, pathname]);

  // Auto-advance loop. Whenever the predicate flips true and we're not
  // already past it, bump the step. Guarded by `tutorial.overlayActive` so
  // hard-mode players never trigger this path.
  useEffect(() => {
    if (!tutorial.overlayActive) return;
    const stepIndex = tutorial.state.overlayStepIndex;
    const step = getOverlayStep(stepIndex);
    if (!step) return;
    if (!predicateSatisfied(step.advance, observation)) return;
    void tutorial.setOverlayStep(stepIndex + 1).catch(() => {
      // Server save failed — leave step pointer where it is so the next tick
      // retries. Worst case the player advances on click.
    });
  }, [tutorial, observation]);

  const stepIndex = tutorial.state.overlayStepIndex;
  const step = getOverlayStep(stepIndex);
  const targetRect = useTargetRect(step?.target ?? null);

  // Log each shown step to the Journal once, so the player can re-read past
  // tutorial cards via the Journal panel ("J") after they've advanced past
  // them or dismissed the overlay.
  const journal = useJournalOptional();
  const loggedStepRef = useRef<number | null>(null);
  useEffect(() => {
    if (!tutorial.overlayActive || !step || !journal) return;
    if (loggedStepRef.current === stepIndex) return;
    loggedStepRef.current = stepIndex;
    journal.write("tutorial", 5, `${step.title}\n${step.body}`);
  }, [tutorial.overlayActive, step, stepIndex, journal]);

  const handleManualAdvance = useCallback(() => {
    if (stepIndex >= OVERLAY_STEP_COUNT) {
      void tutorial.setOverlayStep(-1).catch(() => undefined); // mark dismissed
      return;
    }
    void tutorial.setOverlayStep(stepIndex + 1).catch(() => undefined);
  }, [tutorial, stepIndex]);

  const handleDismiss = useCallback(() => {
    void tutorial.setOverlayStep(-1).catch(() => undefined);
  }, [tutorial]);

  if (!tutorial.overlayActive) return null;
  if (!step) return null;

  return (
    <>
      {/* Highlight ring around the target element */}
      {targetRect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[90] rounded-md shadow-[0_0_22px_rgba(34,197,94,0.6)] ring-2 ring-green-400/80"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Step card */}
      <div
        role="dialog"
        aria-label="Tutorial step"
        className="pointer-events-auto fixed z-[91] w-[min(22rem,calc(100vw-2rem))] border border-green-400/70 bg-black/95 p-4 font-mono text-xs text-green-300 shadow-[0_0_30px_rgba(34,197,94,0.45)] backdrop-blur"
        style={cardPositionStyle(step.position, targetRect)}
      >
        <header className="mb-2 flex items-center justify-between">
          <span className="text-[10px] tracking-widest text-green-500/80 uppercase">
            STEP {stepIndex} / {OVERLAY_STEP_COUNT}
          </span>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss tutorial"
            className="text-green-400/60 hover:text-green-200"
          >
            ×
          </button>
        </header>

        <h3 className="mb-1.5 text-sm text-green-200">{step.title}</h3>
        {step.body.split("\n\n").map((para, i) => (
          <p key={i} className="mb-2 leading-relaxed whitespace-pre-line text-green-300/90">
            {para}
          </p>
        ))}

        <footer className="mt-3 flex items-center justify-between border-t border-green-500/30 pt-2">
          <span className="text-[10px] text-green-400/50">
            {step.advance.kind === "manual" || step.allowSkipAhead
              ? "click 'Got it' when ready"
              : "auto-advances when complete"}
          </span>
          {(step.advance.kind === "manual" || step.allowSkipAhead) && (
            <button
              type="button"
              onClick={handleManualAdvance}
              className="border border-green-400/60 bg-green-950/40 px-3 py-1 text-[11px] text-green-200 transition hover:border-green-300 hover:bg-green-900/60"
            >
              Got it →
            </button>
          )}
        </footer>
      </div>
    </>
  );
}

/**
 * Compute fixed-position styles for the step card given a target rect and a
 * preferred position. Falls back to corners if the target is offscreen or
 * absent.
 */
function cardPositionStyle(
  preferred: string | undefined,
  rect: TargetRect | null,
): React.CSSProperties {
  const margin = 16;
  const cardWidth = 352;
  const cardHeight = 200; // approximate — used to keep card on-screen
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  if (!rect || preferred === "center") {
    return {
      top: `calc(50% - ${cardHeight / 2}px)`,
      left: `calc(50% - ${cardWidth / 2}px)`,
    };
  }

  switch (preferred) {
    case "right":
      return {
        top: clamp(rect.top, margin, vh - cardHeight - margin),
        left: clamp(rect.left + rect.width + margin, margin, vw - cardWidth - margin),
      };
    case "left":
      return {
        top: clamp(rect.top, margin, vh - cardHeight - margin),
        left: clamp(rect.left - cardWidth - margin, margin, vw - cardWidth - margin),
      };
    case "top":
      return {
        top: clamp(rect.top - cardHeight - margin, margin, vh - cardHeight - margin),
        left: clamp(rect.left, margin, vw - cardWidth - margin),
      };
    case "bottom":
    default:
      return {
        top: clamp(rect.top + rect.height + margin, margin, vh - cardHeight - margin),
        left: clamp(rect.left, margin, vw - cardWidth - margin),
      };
  }
}

function clamp(value: number, lo: number, hi: number): number {
  if (lo > hi) return lo;
  return Math.min(Math.max(value, lo), hi);
}

// Re-export so future callers can render an OverlayDebug panel without
// reaching into internals (intentional public surface).
export { OVERLAY_STEPS };

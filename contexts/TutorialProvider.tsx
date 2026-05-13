"use client";

/**
 * TutorialProvider
 * ================
 *
 * Client-side mirror of `profiles.tutorial_state`. Hydrated on mount from a
 * server-loaded blob and updated through the server actions in
 * `app/(game)/actions/tutorial.ts`.
 *
 * Two consumers care about this state:
 *   - DifficultyPicker — mounts when `difficulty === null`
 *   - TutorialOverlay (easy mode) — drives interactive walkthrough steps
 *
 * Hard mode reads `difficulty` to flip the mission-panel hint reveal from
 * "after 60s of inactivity" to "show immediately".
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import {
  setOverlayStepIndex as setOverlayStepIndexAction,
  setTutorialDifficulty as setTutorialDifficultyAction,
} from "@/app/(game)/actions/tutorial";
import {
  hydrateTutorialState,
  type TutorialDifficulty,
  type TutorialState,
} from "@/lib/game/tutorial/types";

interface TutorialContextValue {
  state: TutorialState;
  /** True when difficulty has not yet been chosen — DifficultyPicker shows. */
  needsDifficultyChoice: boolean;
  /** True when easy-mode overlay should be active (chosen + step > 0). */
  overlayActive: boolean;
  /** Persist a difficulty choice. Optimistic-update with rollback on error. */
  chooseDifficulty: (difficulty: "easy" | "hard") => Promise<void>;
  /** Advance / set the easy-mode overlay step. Optimistic with rollback. */
  setOverlayStep: (next: number) => Promise<void>;
  /** Replace the local state (used after server actions return fresh shape). */
  setStateOverride: (next: TutorialState) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

interface TutorialProviderProps {
  children: ReactNode;
  initialTutorialState: unknown;
}

export function TutorialProvider({ children, initialTutorialState }: TutorialProviderProps) {
  const [state, setState] = useState<TutorialState>(() =>
    hydrateTutorialState(initialTutorialState),
  );

  const setStateOverride = useCallback((next: TutorialState) => {
    setState(next);
  }, []);

  const chooseDifficulty = useCallback(async (difficulty: "easy" | "hard") => {
    const previous = state;
    // Optimistic — drives the picker to dismiss before the round-trip lands
    setState((s) => ({
      ...s,
      difficulty,
      overlayStepIndex: difficulty === "easy" ? 1 : 0,
    }));
    const result = await setTutorialDifficultyAction(difficulty);
    if (!result.ok || !result.state) {
      setState(previous);
      throw new Error(result.error ?? "Failed to save difficulty.");
    }
    setState(result.state);
    // Note: state ref captured at call time is fine; rollback only runs on
    // failure so the lint exhaustive-deps complaint is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setOverlayStep = useCallback(async (nextStep: number) => {
    const previous = state;
    setState((s) => ({ ...s, overlayStepIndex: Math.floor(nextStep) }));
    const result = await setOverlayStepIndexAction(Math.floor(nextStep));
    if (!result.ok || !result.state) {
      setState(previous);
      throw new Error(result.error ?? "Failed to save overlay progress.");
    }
    setState(result.state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<TutorialContextValue>(() => {
    const needsDifficultyChoice = state.difficulty === null && !state.skipped;
    const overlayActive = state.difficulty === "easy" && state.overlayStepIndex > 0;
    return {
      state,
      needsDifficultyChoice,
      overlayActive,
      chooseDifficulty,
      setOverlayStep,
      setStateOverride,
    };
  }, [state, chooseDifficulty, setOverlayStep, setStateOverride]);

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return ctx;
}

export function useTutorialOptional(): TutorialContextValue | null {
  return useContext(TutorialContext);
}

/**
 * Convenience hook — returns the difficulty as a stable string, or "hard" as
 * a safe default before the player has chosen. This means existing
 * "hide hint until level 1" behavior continues to apply pre-choice.
 */
export function useTutorialDifficulty(): TutorialDifficulty {
  return useContext(TutorialContext)?.state.difficulty ?? null;
}

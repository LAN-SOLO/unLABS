"use client";

/**
 * DifficultyPicker
 * ================
 *
 * Center-screen modal shown on first launch (when tutorial_state.difficulty
 * is null). The player picks one of two guidance modes — the choice scopes
 * which hint surfaces are active for the rest of the playthrough.
 *
 * - GUIDED (easy)  → interactive overlay walks the player through commands
 * - SOLO (hard)    → hints surface immediately in the panel + `guide` cmd
 *
 * The modal is intentionally blocking. The first decision the player makes
 * is "how much help do I want?", and that answer drives the rest of the
 * UX — so we hold the gate until they commit. Both choices are reversible
 * later via `tutorial difficulty <easy|hard>` from the terminal.
 */

import { useCallback, useState, useTransition } from "react";

import { setTutorialDifficulty } from "@/app/(game)/actions/tutorial";
import type { TutorialState } from "@/lib/game/tutorial/types";

interface DifficultyPickerProps {
  onChosen: (next: TutorialState) => void;
}

export function DifficultyPicker({ onChosen }: DifficultyPickerProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const choose = useCallback(
    (difficulty: "easy" | "hard") => {
      setError(null);
      startTransition(async () => {
        const result = await setTutorialDifficulty(difficulty);
        if (!result.ok || !result.state) {
          setError(result.error ?? "Failed to save difficulty.");
          return;
        }
        onChosen(result.state);
      });
    },
    [onChosen],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose guidance level"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      <div className="relative w-[min(36rem,calc(100vw-2rem))] border border-green-500/60 bg-black/95 p-6 font-mono text-sm text-green-400 shadow-[0_0_40px_rgba(34,197,94,0.35)]">
        <header className="mb-4 border-b border-green-500/30 pb-3">
          <div className="text-[10px] tracking-widest text-green-500/70 uppercase">
            _unOS · boot
          </div>
          <h2 className="mt-1 text-base text-green-300">Choose Guidance Level</h2>
          <p className="mt-2 text-xs leading-relaxed text-green-400/70">
            How much help do you want with the early missions? You can switch later via{" "}
            <span className="text-green-300">tutorial difficulty &lt;easy|hard&gt;</span>.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => choose("easy")}
            className="group flex flex-col gap-2 border border-green-500/40 bg-green-950/30 p-4 text-left transition hover:border-green-400 hover:bg-green-900/40 disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-widest text-green-300/80 uppercase">
                Mode 01
              </span>
              <span className="text-[10px] text-green-300/50">guided</span>
            </div>
            <div className="text-base text-green-200 group-hover:text-green-100">EASY</div>
            <ul className="space-y-1 text-[11px] leading-snug text-green-400/80">
              <li>· Interactive overlay walks you through commands</li>
              <li>· Highlights the next button or terminal action</li>
              <li>· Step-by-step through the first missions</li>
            </ul>
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => choose("hard")}
            className="group flex flex-col gap-2 border border-amber-500/40 bg-amber-950/20 p-4 text-left transition hover:border-amber-400 hover:bg-amber-900/30 disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-widest text-amber-300/80 uppercase">
                Mode 02
              </span>
              <span className="text-[10px] text-amber-300/50">solo</span>
            </div>
            <div className="text-base text-amber-200 group-hover:text-amber-100">HARD</div>
            <ul className="space-y-1 text-[11px] leading-snug text-amber-400/80">
              <li>· Hints visible inline in the mission panel</li>
              <li>
                · <span className="text-amber-200">guide</span> terminal command on demand
              </li>
              <li>· No overlay — figure out the rest yourself</li>
            </ul>
          </button>
        </div>

        {error && (
          <p className="mt-3 text-[11px] text-red-400" role="alert">
            {error}
          </p>
        )}

        {pending && (
          <p className="mt-3 text-[11px] text-green-300/70" aria-live="polite">
            saving…
          </p>
        )}
      </div>
    </div>
  );
}

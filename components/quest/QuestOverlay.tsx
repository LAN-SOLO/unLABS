"use client";

/**
 * QuestOverlay
 * ============
 *
 * Floating narrative panel that guides the player through the active
 * episode. When there is no current step (episode complete or no active
 * quest) the component renders null so the terminal is unobstructed.
 *
 * Visual language:
 *   - Positioned top-right of the viewport, above the terminal chrome
 *   - Phosphor-green CRT aesthetic matching the rest of the game
 *   - Voice lines are prefixed and colored per persona (see VOICE_STYLE)
 *   - One CONTINUE button per step; disabled while the server advance is
 *     in-flight so double-clicks can't skip steps. Flag- and command-gated
 *     steps hide the button and show an "awaiting" status instead — the
 *     observer/minigame/terminal bridge advances them.
 *
 * Intentionally not a modal. Players should be able to glance at the panel
 * and at the same time see the panel/terminal underneath. Later phases can
 * add an optional "pin to side" toggle.
 */

import { useCallback, useEffect, useRef } from "react";

import { useQuest } from "@/contexts/QuestProvider";
import { useJournalOptional } from "@/contexts/JournalProvider";
import type { VoiceId, VoiceLine } from "@/lib/game/quests/types";
import { LissajousCalibration } from "./LissajousCalibration";

const VOICE_STYLE: Record<VoiceId, { label: string; color: string; italic?: boolean }> = {
  mcp: { label: "MCP", color: "text-green-300" },
  jade: { label: "JADE", color: "text-teal-300", italic: true },
  fridge: { label: "FRIDGE", color: "text-amber-300" },
  findr: { label: "FINDR", color: "text-pink-300" },
  system: { label: "SYS", color: "text-gray-400" },
};

export function QuestOverlay() {
  const { episode, currentStep, advance, isAdvancing, state, setFlag } = useQuest();
  const journal = useJournalOptional();

  // Called by the Lissajous minigame when its lock latches. Sets the gating
  // flag, then immediately advances the step so the "reveal" beat fires.
  const handleLissajousLock = useCallback(async () => {
    await setFlag("lissajous_locked", true);
    advance();
  }, [setFlag, advance]);

  // Log each step's voice lines to the Journal once, so the player can
  // re-read past narrative beats via the Journal panel ("J") even after the
  // overlay has advanced or the episode has completed.
  const loggedStepRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentStep || !journal) return;
    if (loggedStepRef.current === currentStep.id) return;
    loggedStepRef.current = currentStep.id;
    for (const line of currentStep.voiceLines) {
      journal.write(`voice/${line.voice}`, 5, line.text);
    }
  }, [currentStep, journal]);

  if (!episode || !currentStep) return null;

  const stepNumber = state.currentStepIndex + 1;
  const totalSteps = episode.steps.length;
  const hasMinigame = !!currentStep.minigame;
  const flagGated =
    currentStep.trigger.kind === "flag" && state.flags[currentStep.trigger.flag] !== true;
  // Command-gated steps advance via the terminal bridge (Terminal.tsx sets
  // `cmd:<name>` after a successful run) — never via CONTINUE. Showing the
  // button here would soft-lock: the server refuses the advance until the
  // flag is set.
  const awaitedCommand =
    currentStep.trigger.kind === "command" &&
    state.flags[`cmd:${currentStep.trigger.command}`] !== true
      ? currentStep.trigger.command
      : null;
  const gated = flagGated || awaitedCommand !== null;

  return (
    <aside
      aria-label="Quest overlay"
      data-quest-overlay
      className="pointer-events-auto fixed top-4 right-4 z-40 w-[min(32rem,calc(100vw-2rem))] border border-green-500/60 bg-black/90 font-mono text-sm text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.25)] backdrop-blur"
    >
      <header className="flex items-center justify-between border-b border-green-500/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-green-300">[{episode.id}]</span>
          <span className="text-green-400/80">{episode.title}</span>
        </div>
        <span className="text-[10px] text-green-500/60">
          step {stepNumber}/{totalSteps}
        </span>
      </header>

      <div className="px-3 pt-3">
        <p className="text-[10px] tracking-wide text-green-500/60 uppercase">current objective</p>
        <p className="text-green-200">&gt; {currentStep.objective}</p>
      </div>

      <div className="space-y-2 px-3 py-3">
        {currentStep.voiceLines.map((line, i) => (
          <VoiceLineRow key={i} line={line} />
        ))}
      </div>

      {currentStep.hint ? (
        <div className="mx-3 mb-3 border border-green-500/20 bg-green-500/5 px-2 py-1 text-[11px] text-green-500/70">
          hint: {currentStep.hint}
        </div>
      ) : null}

      {hasMinigame && currentStep.minigame?.kind === "lissajous" ? (
        <div className="mx-3 mb-3">
          <LissajousCalibration
            targetRatio={currentStep.minigame.targetRatio}
            onLock={handleLissajousLock}
          />
        </div>
      ) : null}

      <footer className="flex items-center justify-between border-t border-green-500/40 px-3 py-2">
        <span className="text-[10px] text-green-500/50">
          {isAdvancing
            ? "transmitting..."
            : awaitedCommand
              ? `awaiting: ${awaitedCommand}`
              : flagGated
                ? "awaiting trigger"
                : "ready"}
        </span>
        {/* Hide CONTINUE on gated steps — the minigame, observer, or the
            terminal command bridge is responsible for unlocking them. */}
        {gated ? null : (
          <button
            type="button"
            onClick={advance}
            disabled={isAdvancing}
            className="border border-green-400 bg-green-500/10 px-3 py-1 text-xs text-green-200 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAdvancing ? "[...]" : "> CONTINUE"}
          </button>
        )}
      </footer>
    </aside>
  );
}

function VoiceLineRow({ line }: { line: VoiceLine }) {
  const style = VOICE_STYLE[line.voice] ?? VOICE_STYLE.system;
  return (
    <p className={`leading-snug ${style.color} ${style.italic ? "italic" : ""}`}>
      <span className="text-[10px] opacity-60">{style.label}&gt;&nbsp;</span>
      {line.text}
    </p>
  );
}

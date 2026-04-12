"use client";

/**
 * useAnomalyMode
 * ==============
 *
 * Exposes the `anomaly_mode` quest flag as a simple boolean so UI
 * components (Oscilloscope, panel modules, the terminal) can tint, glitch,
 * or overlay distortions without coupling to the quest engine.
 *
 * Kept as a hook rather than a context so adding more "ambient" flags
 * later is a one-line addition here rather than a new provider per flag.
 */

import { useQuest } from "@/contexts/QuestProvider";

export function useAnomalyMode(): {
  active: boolean;
  oscOnline: boolean;
} {
  const { state } = useQuest();
  return {
    active: state.flags.anomaly_mode === true,
    oscOnline: state.flags.osc_001_online === true,
  };
}

/**
 * Contextual tips
 * ===============
 *
 * One-liner tips tied to game state predicates. Displayed as a rotating
 * "tip of the moment" in the MissionPanel footer when no urgent
 * objective is active.
 *
 * Tips are evaluated in priority order. The first matching tip is shown.
 */

import type { ResourceMap } from "./tickEngine";

export interface ContextualTip {
  id: string;
  text: string;
  /** Return true if this tip should be shown given current game state. */
  condition: (flags: Record<string, boolean>, resources: ResourceMap) => boolean;
  /** Lower = higher priority. */
  priority: number;
  /** Optional voice attribution for styling. */
  voice?: "mcp" | "jade" | "fridge" | "system";
}

export const TIPS: ContextualTip[] = [
  {
    id: "energy_at_cap",
    text: "Energy at capacity. Spend it or lose it. Craft something.",
    condition: (_flags, resources) => {
      const energy = resources.energy;
      if (!energy) return false;
      return energy.amount >= energy.capacity * 0.95 && energy.capacity > 0;
    },
    priority: 1,
    voice: "mcp",
  },
  {
    id: "abstractum_low",
    text: "Abstractum accrues slowly. Patience is a lab skill.",
    condition: (_flags, resources) => {
      const abs = resources.abstractum;
      if (!abs) return false;
      return abs.amount < 3 && abs.ratePerSecond > 0;
    },
    priority: 3,
    voice: "jade",
  },
  {
    id: "after_first_resonance",
    text: "There are more resonances hidden in the lab. Jade left clues.",
    condition: (flags) => flags.first_resonance === true,
    priority: 5,
    voice: "jade",
  },
  {
    id: "no_active_missions",
    text: "Check `missions --available` for something to work on.",
    condition: (flags) => flags.missions_unlocked === true,
    priority: 10,
    voice: "system",
  },
  {
    id: "forge_hint",
    text: "Advanced materials require base alloy. Stockpile before upgrading.",
    condition: (flags) => flags.ep0_complete === true && flags.forge_mastered !== true,
    priority: 7,
    voice: "fridge",
  },
  {
    id: "anomaly_hint",
    text: "The anomalies respond to resonance. They respond to you.",
    condition: (flags) => flags.anomaly_mode === true && flags.first_resonance !== true,
    priority: 6,
    voice: "mcp",
  },
  {
    id: "reactor_hint",
    text: "The energy crisis has an answer. It weighs 400 kilograms.",
    condition: (flags) => flags.forge_mastered === true && flags.reactor_online !== true,
    priority: 4,
    voice: "fridge",
  },
];

/**
 * Get the highest-priority tip that matches current game state.
 */
export function getActiveTip(
  flags: Record<string, boolean>,
  resources: ResourceMap,
): ContextualTip | null {
  const sorted = [...TIPS].sort((a, b) => a.priority - b.priority);
  return sorted.find((tip) => tip.condition(flags, resources)) ?? null;
}

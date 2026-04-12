/**
 * Recipe catalog
 * ==============
 *
 * Static data — recipes are code, not DB rows, because their costs and
 * durations are part of the game's balance and belong in version control.
 *
 * Each Recipe declares:
 *   - id              — stable key persisted in production_jobs.recipe_id
 *   - label / flavor  — UI strings
 *   - tier            — progression gate (1..5)
 *   - costs           — in-game resources burned at start (tick engine)
 *   - unscBurn        — _unSC hard-burned at start (if any)
 *   - durationSec     — wall-clock duration of the job
 *   - outputs         — rewards applied on claim (reuses StepReward kinds)
 *   - unlockRequires  — optional list of quest flags that must be set to
 *                       show the recipe in the catalog
 *
 * Output rewards reuse the StepReward union from the quest engine to keep
 * the reward/effect system uniform across the game. Adding a new effect
 * kind means updating `types.ts` once and everything downstream picks it
 * up automatically.
 */

import type { StepReward } from "./quests/types";
import type { ResourceId } from "./tickEngine";

export interface RecipeCost {
  resourceId: ResourceId;
  amount: number;
}

export interface Recipe {
  id: string;
  label: string;
  flavor: string;
  tier: 1 | 2 | 3 | 4 | 5;
  category: "material" | "device" | "energy" | "research";

  costs: RecipeCost[];
  unscBurn: number;
  durationSec: number;

  outputs: StepReward[];

  /** Quest flags that must be set before this recipe appears in the list. */
  unlockRequires?: string[];
}

/**
 * Phase 4 recipe catalog. Numbers are balanced against the Phase 1-3 loop:
 *
 *   - Cold-start energy rate is +50/s, dropping to +32/s after OSC-001.
 *   - Abstractum seeps at +1/min (~0.0167/s).
 *   - A new operator has 120 _unSC and ~5 Abstractum (EP0 grant).
 *
 * Everything is priced so that the first unlockable recipe is reachable
 * within a few minutes of EP1 completion without the player doing busywork.
 */
export const RECIPES: Recipe[] = [
  {
    id: "energy_cell",
    label: "Energy Cell",
    flavor: "A disposable reservoir that lets you spend idle energy later. Use it or lose it.",
    tier: 1,
    category: "energy",
    costs: [{ resourceId: "abstractum", amount: 3 }],
    unscBurn: 0,
    durationSec: 30,
    outputs: [{ kind: "grant_resource", resourceId: "energy", amount: 100 }],
  },
  {
    id: "base_alloy_ingot",
    label: "Base Alloy Ingot",
    flavor:
      "Raw Abstractum, stabilized in the smelter. The workhorse of every device you will ever build.",
    tier: 1,
    category: "material",
    costs: [
      { resourceId: "abstractum", amount: 5 },
      { resourceId: "energy", amount: 60 },
    ],
    unscBurn: 1,
    durationSec: 90,
    outputs: [{ kind: "grant_resource", resourceId: "base_alloy", amount: 1 }],
  },
  {
    id: "advanced_alloy_ingot",
    label: "Advanced Alloy Ingot",
    flavor: "Three Base Alloy ingots folded through the Alloy Forge. Takes longer than it looks.",
    tier: 2,
    category: "material",
    costs: [
      { resourceId: "base_alloy", amount: 3 },
      { resourceId: "energy", amount: 120 },
    ],
    unscBurn: 3,
    durationSec: 300,
    outputs: [{ kind: "grant_resource", resourceId: "advanced_alloy", amount: 1 }],
    unlockRequires: ["ep0_complete"],
  },
  {
    id: "nanomaterial_block",
    label: "Nanomaterial Block",
    flavor: "The moment a device starts to look expensive, it needs one of these.",
    tier: 3,
    category: "material",
    costs: [
      { resourceId: "advanced_alloy", amount: 3 },
      { resourceId: "energy", amount: 400 },
    ],
    unscBurn: 10,
    durationSec: 1800,
    outputs: [{ kind: "grant_resource", resourceId: "nanomaterial", amount: 1 }],
    unlockRequires: ["anomaly_mode"],
  },
  {
    id: "mfr_001_build",
    label: "Microfusion Reactor (MFR-001)",
    flavor:
      "The T2 power answer. Expensive, heavy, irreversible, and the only way off the energy-crisis treadmill.",
    tier: 2,
    category: "device",
    costs: [
      { resourceId: "abstractum", amount: 120 },
      { resourceId: "energy", amount: 50 },
    ],
    unscBurn: 25,
    durationSec: 900,
    outputs: [
      // Big capacity jump + net generation boost. Replaces the crude rate
      // currently set by EP1's osc_001_online step.
      {
        kind: "set_resource_capacity",
        resourceId: "energy",
        capacity: 2500,
      },
      { kind: "set_resource_rate", resourceId: "energy", ratePerSecond: 250 },
      { kind: "set_flag", flag: "mfr_001_online", value: true },
    ],
    unlockRequires: ["anomaly_mode"],
  },
];

export function getRecipe(id: string): Recipe | null {
  return RECIPES.find((r) => r.id === id) ?? null;
}

/**
 * Filter the catalog to recipes visible given the current flag set. Used
 * by the /lab UI to hide gated recipes without hard-deleting them.
 */
export function visibleRecipes(flags: Record<string, boolean>): Recipe[] {
  return RECIPES.filter((recipe) => {
    if (!recipe.unlockRequires || recipe.unlockRequires.length === 0) {
      return true;
    }
    return recipe.unlockRequires.every((f) => flags[f] === true);
  });
}

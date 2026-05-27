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
  // ── Phase 3 production-chain devices ──────────────────────────────
  // These three stub recipes gate the EP2 "Three Chains" beat. They're
  // intentionally cheap so the mission is reachable by a player who just
  // finished EP1 with the base resource rates. The outputs set a flag per
  // device; the flag unlocks downstream missions. Panel modules for these
  // devices can ship in a later polish pass without changing any IDs.
  {
    id: "smt_01_build",
    label: "Smelter (SMT-01)",
    flavor: "Routes raw Abstractum into the alloy chain. Hums in C-sharp when warm.",
    tier: 1,
    category: "device",
    costs: [
      { resourceId: "abstractum", amount: 15 },
      { resourceId: "energy", amount: 100 },
    ],
    unscBurn: 10,
    durationSec: 180,
    outputs: [
      { kind: "set_flag", flag: "smt_01_online", value: true },
      // Small permanent Abstractum rate bump as a tangible reward.
      { kind: "set_resource_rate", resourceId: "abstractum", ratePerSecond: 2 / 60 },
    ],
    unlockRequires: ["missions_unlocked"],
  },
  {
    id: "cnd_01_build",
    label: "Condenser (CND-01)",
    flavor: "Compresses loose energy into something you can ship in a box.",
    tier: 1,
    category: "device",
    costs: [
      { resourceId: "abstractum", amount: 15 },
      { resourceId: "energy", amount: 150 },
    ],
    unscBurn: 10,
    durationSec: 180,
    outputs: [
      { kind: "set_flag", flag: "cnd_01_online", value: true },
      { kind: "set_resource_capacity", resourceId: "energy", capacity: 750 },
    ],
    unlockRequires: ["smt_01_online"],
  },
  {
    id: "mix_01_build",
    label: "Mixer (MIX-01)",
    flavor: "Stirs reagents at frequencies the chemistry department considered irresponsible.",
    tier: 1,
    category: "device",
    costs: [
      { resourceId: "abstractum", amount: 20 },
      { resourceId: "energy", amount: 200 },
      { resourceId: "base_alloy", amount: 2 },
    ],
    unscBurn: 10,
    durationSec: 240,
    outputs: [
      { kind: "set_flag", flag: "mix_01_online", value: true },
      { kind: "set_flag", flag: "three_chains_online", value: true },
    ],
    unlockRequires: ["cnd_01_online"],
  },
  // NXS-01 Nexus — gate for the research subsystem. Workstream #6 expands
  // this device with a panel module, firmware lifecycle, and graph UI;
  // the recipe ships here so EP2's final step has a real mechanical anchor.
  {
    id: "nxs_01_build",
    label: "Nexus (NXS-01)",
    flavor:
      "A salvaged holo-projector rebuilt as a research visualizer. The map you have to build before you can read the map.",
    tier: 2,
    category: "device",
    costs: [
      { resourceId: "base_alloy", amount: 10 },
      { resourceId: "energy", amount: 400 },
    ],
    unscBurn: 40,
    durationSec: 600,
    outputs: [
      { kind: "set_flag", flag: "nexus_built", value: true },
      { kind: "grant_resource", resourceId: "research", amount: 5 },
    ],
    unlockRequires: ["three_chains_online"],
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

  // ── Tier 3: Science Devices ────────────────────────────────────────

  {
    id: "emc_001_build",
    label: "Exotic Matter Containment (EMC-001)",
    flavor:
      "A containment vessel for exotic matter. Previous containment method: hoping it would stay put.",
    tier: 3,
    category: "device",
    costs: [
      { resourceId: "nanomaterial", amount: 2 },
      { resourceId: "exotic_matter", amount: 3 },
      { resourceId: "energy", amount: 800 },
    ],
    unscBurn: 50,
    durationSec: 2400,
    outputs: [
      { kind: "set_flag", flag: "emc_001_online", value: true },
      { kind: "set_resource_capacity", resourceId: "exotic_matter", capacity: 25 },
    ],
    unlockRequires: ["ENDGAME_UNLOCKED", "forge_mastered"],
  },
  {
    id: "qan_001_build",
    label: "Quantum Analyzer (QAN-001)",
    flavor:
      "Measures quantum states with uncomfortable precision. The heaviest draw in the quantum pair.",
    tier: 3,
    category: "device",
    costs: [
      { resourceId: "nanomaterial", amount: 3 },
      { resourceId: "exotic_matter", amount: 2 },
      { resourceId: "energy", amount: 1200 },
      { resourceId: "advanced_alloy", amount: 5 },
    ],
    unscBurn: 80,
    durationSec: 3600,
    outputs: [{ kind: "set_flag", flag: "qan_001_online", value: true }],
    unlockRequires: ["emc_001_online"],
  },
  {
    id: "qsm_001_build",
    label: "Quantum State Monitor (QSM-001)",
    flavor:
      "Observes without collapsing. The lighter half of the quantum pair. Nervous but dependable.",
    tier: 3,
    category: "device",
    costs: [
      { resourceId: "nanomaterial", amount: 1 },
      { resourceId: "exotic_matter", amount: 1 },
      { resourceId: "energy", amount: 600 },
      { resourceId: "advanced_alloy", amount: 3 },
    ],
    unscBurn: 40,
    durationSec: 1800,
    outputs: [{ kind: "set_flag", flag: "qsm_001_online", value: true }],
    unlockRequires: ["emc_001_online"],
  },

  // ── Tier 3: Compute & Teleportation ────────────────────────────────

  {
    id: "aic_001_build",
    label: "AI Assistant Core (AIC-001)",
    flavor: "A neural compute core. MCP has opinions about this one. Strong opinions.",
    tier: 3,
    category: "device",
    costs: [
      { resourceId: "nanomaterial", amount: 4 },
      { resourceId: "exotic_matter", amount: 3 },
      { resourceId: "antimatter", amount: 1 },
      { resourceId: "energy", amount: 1500 },
    ],
    unscBurn: 100,
    durationSec: 3600,
    outputs: [
      { kind: "set_flag", flag: "aic_001_online", value: true },
      { kind: "grant_resource", resourceId: "research", amount: 15 },
    ],
    unlockRequires: ["ep5_complete"],
  },
  {
    id: "sca_001_build",
    label: "Supercomputer Array (SCA-001)",
    flavor:
      "Petascale compute in a rack-mount form factor. Cooling: aggressive. Power draw: concerning.",
    tier: 3,
    category: "device",
    costs: [
      { resourceId: "nanomaterial", amount: 5 },
      { resourceId: "exotic_matter", amount: 5 },
      { resourceId: "antimatter", amount: 2 },
      { resourceId: "energy", amount: 2000 },
    ],
    unscBurn: 150,
    durationSec: 5400,
    outputs: [{ kind: "set_flag", flag: "sca_001_online", value: true }],
    unlockRequires: ["ENDGAME_UNLOCKED", "aic_001_online"],
  },
  {
    id: "tlp_001_build",
    label: "Teleport Pad (TLP-001)",
    flavor:
      "Quantum teleportation platform. 100W continuous. Operator survival rate during testing: not disclosed.",
    tier: 3,
    category: "device",
    costs: [
      { resourceId: "nanomaterial", amount: 6 },
      { resourceId: "exotic_matter", amount: 8 },
      { resourceId: "antimatter", amount: 3 },
      { resourceId: "energy", amount: 2500 },
    ],
    unscBurn: 200,
    durationSec: 7200,
    outputs: [
      { kind: "set_flag", flag: "tlp_001_online", value: true },
      { kind: "set_resource_rate", resourceId: "exotic_matter", ratePerSecond: 1 / 60 },
    ],
    unlockRequires: ["ep4_complete", "sca_001_online"],
  },

  // ── Tier 3: Material Recipes ───────────────────────────────────────

  {
    id: "exotic_matter_crystal",
    label: "Exotic Matter Crystal",
    flavor:
      "Crystallized exotic matter. The containment vessel makes this possible. The lab's opinion of it is divided.",
    tier: 3,
    category: "material",
    costs: [
      { resourceId: "nanomaterial", amount: 1 },
      { resourceId: "energy", amount: 1000 },
      { resourceId: "advanced_alloy", amount: 2 },
    ],
    unscBurn: 15,
    durationSec: 2400,
    outputs: [{ kind: "grant_resource", resourceId: "exotic_matter", amount: 2 }],
    unlockRequires: ["emc_001_online"],
  },
  {
    id: "antimatter_vial",
    label: "Antimatter Vial",
    flavor: "One microgram of antihydrogen, suspended in a magnetic trap. Do not shake.",
    tier: 3,
    category: "material",
    costs: [
      { resourceId: "exotic_matter", amount: 4 },
      { resourceId: "energy", amount: 1500 },
      { resourceId: "nanomaterial", amount: 2 },
    ],
    unscBurn: 25,
    durationSec: 3600,
    outputs: [{ kind: "grant_resource", resourceId: "antimatter", amount: 1 }],
    unlockRequires: ["emc_001_online", "anomaly_topology_mapped"],
  },
];

export function getRecipe(id: string): Recipe | null {
  return RECIPES.find((r) => r.id === id) ?? null;
}

/**
 * A device-category recipe is "one-shot": once any of its set_flag outputs
 * has flipped true (e.g. nxs_01_build → nexus_built), the device exists and
 * cannot be built again from the lab. Future re-roll/upgrade flows would
 * ship as separate recipes (e.g. `nxs_01_upgrade_t3`).
 *
 * Returns false for non-device categories so material/energy recipes stay
 * repeatable indefinitely.
 */
export function isRecipeBuilt(recipe: Recipe, flags: Record<string, boolean>): boolean {
  if (recipe.category !== "device") return false;
  for (const out of recipe.outputs) {
    if (out.kind === "set_flag" && out.value === true && flags[out.flag] === true) {
      return true;
    }
  }
  return false;
}

/**
 * Filter the catalog to recipes visible given the current flag set. Used
 * by the /lab UI to hide gated recipes without hard-deleting them.
 * Excludes one-shot device recipes that have already been built.
 */
export function visibleRecipes(flags: Record<string, boolean>): Recipe[] {
  return RECIPES.filter((recipe) => {
    if (recipe.unlockRequires && recipe.unlockRequires.length > 0) {
      if (!recipe.unlockRequires.every((f) => flags[f] === true)) return false;
    }
    if (isRecipeBuilt(recipe, flags)) return false;
    return true;
  });
}

/**
 * Energy branch achievements.
 *
 * "First Spark" is the canonical Phase-2 achievement from the design docs —
 * the first time UEC-001 produces a non-trivial energy store. Granted at
 * 200 E so the player has to leave the reactor running for a few seconds
 * past ignition (rewards observing, not just clicking).
 */

import type { Achievement } from "../types";

const FIRST_SPARK_T1: Achievement = {
  id: "energy.first_spark.t1",
  title: "First Spark",
  description: "Store 200 Energy. The bus holds.",
  branch: "energy",
  tier: 1,
  target: 200,
  unit: "Energy",
  reward: {
    unsc: 25,
    flag: "ach_energy_first_spark_t1",
    description: "+25 _unSC",
  },
  // Only track once UEC-001 is online, so a brand-new operator doesn't see
  // a "locked at 0/200" row during Phase 0.
  available: (flags) => flags.ep0_complete === true,
  evaluate: (s) => s.resources.energy?.amount ?? 0,
};

const POWER_GRID_T2: Achievement = {
  id: "energy.first_spark.t2",
  title: "Power Grid",
  description: "Hold 1 000 Energy. The Condenser earned its keep.",
  branch: "energy",
  tier: 2,
  target: 1000,
  unit: "Energy",
  reward: {
    unsc: 50,
    flag: "ach_energy_first_spark_t2",
    description: "+50 _unSC",
  },
  available: (flags) => flags.ach_energy_first_spark_t1 === true,
  evaluate: (s) => s.resources.energy?.amount ?? 0,
};

const PERPETUAL_ENERGY_T3: Achievement = {
  id: "energy.first_spark.t3",
  title: "Perpetual Energy",
  description:
    "Generate 100 000 Energy lifetime. If the meter keeps spinning, something is going right.",
  branch: "energy",
  tier: 3,
  target: 100000,
  unit: "Energy (lifetime)",
  reward: {
    unsc: 100,
    flag: "ach_energy_first_spark_t3",
    description: "+100 _unSC",
  },
  available: (flags) => flags.ach_energy_first_spark_t2 === true,
  // Held-amount targets stop at capacity (1 500 after Power Condense) —
  // 5 000 held was unreachable. Lifetime generation measures play instead.
  evaluate: (s) => s.resources.energy?.totalProduced ?? s.resources.energy?.amount ?? 0,
};

export const ENERGY_ACHIEVEMENTS: Achievement[] = [
  FIRST_SPARK_T1,
  POWER_GRID_T2,
  PERPETUAL_ENERGY_T3,
];

/**
 * Construction branch achievements.
 *
 * "Tinkerer" measures claimed production jobs. Three is the design-doc
 * target: enough to force the player to use the crafting loop twice
 * (one pass per resource chain), not just finish a single onboarding job.
 */

import type { Achievement } from "../types";

const TINKERER_T1: Achievement = {
  id: "construction.tinkerer.t1",
  title: "Tinkerer",
  description: "Claim 3 production jobs. Making things is making progress.",
  branch: "construction",
  tier: 1,
  target: 3,
  unit: "jobs",
  reward: {
    unsc: 15,
    flag: "ach_construction_tinkerer_t1",
    description: "+15 _unSC",
  },
  available: (flags) => flags.missions_unlocked === true,
  evaluate: (s) => s.craftedJobCount,
};

const ENGINEER_T2: Achievement = {
  id: "construction.tinkerer.t2",
  title: "Engineer",
  description: "Claim 10 production jobs. The manifold is no longer surprising anyone.",
  branch: "construction",
  tier: 2,
  target: 10,
  unit: "jobs",
  reward: {
    unsc: 35,
    flag: "ach_construction_tinkerer_t2",
    description: "+35 _unSC",
  },
  available: (flags) => flags.ach_construction_tinkerer_t1 === true,
  evaluate: (s) => s.craftedJobCount,
};

const MASTER_INVENTOR_T3: Achievement = {
  id: "construction.tinkerer.t3",
  title: "Master Inventor",
  description: "Claim 30 production jobs. The lab is now, by any honest metric, a factory.",
  branch: "construction",
  tier: 3,
  target: 30,
  unit: "jobs",
  reward: {
    unsc: 75,
    flag: "ach_construction_tinkerer_t3",
    description: "+75 _unSC",
  },
  available: (flags) => flags.ach_construction_tinkerer_t2 === true,
  evaluate: (s) => s.craftedJobCount,
};

export const CONSTRUCTION_ACHIEVEMENTS: Achievement[] = [
  TINKERER_T1,
  ENGINEER_T2,
  MASTER_INVENTOR_T3,
];

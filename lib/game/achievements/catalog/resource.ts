/**
 * Resource branch achievements.
 *
 * Tracks lifetime accumulation of the primary resources that drive the idle
 * loop. T1 is intentionally low (hit during Phase 2/3); T2/T3 are stubs to
 * be authored alongside the expansion / autonomy episodes.
 */

import type { Achievement } from "../types";

const DABBLER_T1: Achievement = {
  id: "resource.dabbler.t1",
  title: "Resource Dabbler",
  description: "Accumulate 100 Abstractum. First proof the lab is leaking.",
  branch: "resource",
  tier: 1,
  target: 100,
  unit: "Abstractum",
  reward: {
    unsc: 20,
    flag: "ach_resource_dabbler_t1",
    description: "+20 _unSC",
  },
  evaluate: (s) => s.resources.abstractum?.amount ?? 0,
};

const DABBLER_T2: Achievement = {
  id: "resource.dabbler.t2",
  title: "Resource Hoarder",
  description: "Stockpile 500 Abstractum. The tap is real; so is the patience.",
  branch: "resource",
  tier: 2,
  target: 500,
  unit: "Abstractum",
  reward: {
    unsc: 40,
    flag: "ach_resource_dabbler_t2",
    description: "+40 _unSC",
  },
  available: (flags) => flags.ach_resource_dabbler_t1 === true,
  evaluate: (s) => s.resources.abstractum?.amount ?? 0,
};

const DABBLER_T3: Achievement = {
  id: "resource.dabbler.t3",
  title: "Resource Tycoon",
  description: "Hold 2 000 Abstractum. At drone-swarm rates this is a coffee break away.",
  branch: "resource",
  tier: 3,
  target: 2000,
  unit: "Abstractum",
  reward: {
    unsc: 80,
    flag: "ach_resource_dabbler_t3",
    description: "+80 _unSC",
  },
  available: (flags) => flags.ach_resource_dabbler_t2 === true,
  evaluate: (s) => s.resources.abstractum?.amount ?? 0,
};

export const RESOURCE_ACHIEVEMENTS: Achievement[] = [DABBLER_T1, DABBLER_T2, DABBLER_T3];

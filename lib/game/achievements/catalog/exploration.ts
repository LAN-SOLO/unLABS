/**
 * Exploration branch achievements.
 *
 * "First Glimpse" is the narrative hook for the Anomaly / Cosmic-Signal
 * tree. EP1 reveals the anomaly overlay; this achievement confirms the
 * first discovered resonance protocol after that reveal.
 */

import type { Achievement } from "../types";

const FIRST_GLIMPSE_T1: Achievement = {
  id: "exploration.first_glimpse.t1",
  title: "First Glimpse",
  description: "Discover your first resonance protocol. The signal noticed.",
  branch: "exploration",
  tier: 1,
  target: 1,
  unit: "discoveries",
  reward: {
    unsc: 20,
    flag: "ach_exploration_first_glimpse_t1",
    description: "+20 _unSC · anomaly log opens",
  },
  available: (flags) => flags.anomaly_mode === true,
  evaluate: (s) => s.discoveries.length,
};

const INVESTIGATOR_T2: Achievement = {
  id: "exploration.first_glimpse.t2",
  title: "Investigator",
  description: "Discover 3 resonance protocols. The anomalies are answering back.",
  branch: "exploration",
  tier: 2,
  target: 3,
  unit: "discoveries",
  reward: {
    unsc: 40,
    flag: "ach_exploration_first_glimpse_t2",
    description: "+40 _unSC",
  },
  available: (flags) => flags.ach_exploration_first_glimpse_t1 === true,
  evaluate: (s) => s.discoveries.length,
};

const ARCHIVIST_T3: Achievement = {
  id: "exploration.first_glimpse.t3",
  title: "Archivist",
  description: "Discover 6 resonance protocols. Most of the signal is now on paper.",
  branch: "exploration",
  tier: 3,
  target: 6,
  unit: "discoveries",
  reward: {
    unsc: 80,
    flag: "ach_exploration_first_glimpse_t3",
    description: "+80 _unSC",
  },
  available: (flags) => flags.ach_exploration_first_glimpse_t2 === true,
  evaluate: (s) => s.discoveries.length,
};

export const EXPLORATION_ACHIEVEMENTS: Achievement[] = [
  FIRST_GLIMPSE_T1,
  INVESTIGATOR_T2,
  ARCHIVIST_T3,
];

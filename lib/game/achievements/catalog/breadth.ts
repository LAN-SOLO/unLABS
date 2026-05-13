/**
 * Breadth branch achievements.
 *
 * "Jack of All Trades" rewards variety — crafting at least 2 distinct
 * recipes. Without a tech-tree UI yet, this is the cheapest proxy for
 * "player has explored more than one progression path". Graduates to
 * "touch N trees" in T2/T3 when the Nexus ships.
 */

import type { Achievement } from "../types";

const JACK_OF_ALL_TRADES_T1: Achievement = {
  id: "breadth.jack_of_all_trades.t1",
  title: "Jack of All Trades",
  description: "Craft 2 distinct recipes. Specialize later; explore now.",
  branch: "breadth",
  tier: 1,
  target: 2,
  unit: "distinct recipes",
  reward: {
    unsc: 15,
    flag: "ach_breadth_jack_t1",
    description: "+15 _unSC",
  },
  available: (flags) => flags.missions_unlocked === true,
  evaluate: (s) => s.craftedRecipeIds.size,
};

const JACK_OF_ALL_TRADES_T2: Achievement = {
  id: "breadth.jack_of_all_trades.t2",
  title: "Journeyman",
  description: "Craft 4 distinct recipes. Four brushes in the toolbox.",
  branch: "breadth",
  tier: 2,
  target: 4,
  unit: "distinct recipes",
  reward: {
    unsc: 30,
    flag: "ach_breadth_jack_t2",
    description: "+30 _unSC",
  },
  available: (flags) => flags.ach_breadth_jack_t1 === true,
  evaluate: (s) => s.craftedRecipeIds.size,
};

const MASTER_OF_ALL_TRADES_T3: Achievement = {
  id: "breadth.jack_of_all_trades.t3",
  title: "Master of All Trades",
  description: "Craft 6 distinct recipes. There is no longer a recipe you haven't touched.",
  branch: "breadth",
  tier: 3,
  target: 6,
  unit: "distinct recipes",
  reward: {
    unsc: 60,
    flag: "ach_breadth_jack_t3",
    description: "+60 _unSC",
  },
  available: (flags) => flags.ach_breadth_jack_t2 === true,
  evaluate: (s) => s.craftedRecipeIds.size,
};

export const BREADTH_ACHIEVEMENTS: Achievement[] = [
  JACK_OF_ALL_TRADES_T1,
  JACK_OF_ALL_TRADES_T2,
  MASTER_OF_ALL_TRADES_T3,
];

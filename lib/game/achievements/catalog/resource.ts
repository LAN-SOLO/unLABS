/**
 * Resource branch achievements.
 *
 * Tracks lifetime PRODUCTION of the primary resources that drive the idle
 * loop (tickEngine's totalProduced counter). Held-amount targets don't work
 * beyond T1: abstractum's base capacity is 100, so "stockpile 500" was
 * literally unreachable. Lifetime counters measure play, not tank size.
 * `amount` remains the fallback for saves predating the counters.
 */

import type { Achievement } from "../types";

/** Lifetime abstractum produced, falling back to held amount on old saves. */
function lifetimeAbstractum(s: Parameters<Achievement["evaluate"]>[0]): number {
  const r = s.resources.abstractum;
  return r?.totalProduced ?? r?.amount ?? 0;
}

const DABBLER_T1: Achievement = {
  id: "resource.dabbler.t1",
  title: "Resource Dabbler",
  description: "Produce 100 Abstractum lifetime. First proof the lab is leaking.",
  branch: "resource",
  tier: 1,
  target: 100,
  unit: "Abstractum (lifetime)",
  reward: {
    unsc: 20,
    flag: "ach_resource_dabbler_t1",
    description: "+20 _unSC",
  },
  evaluate: lifetimeAbstractum,
};

const DABBLER_T2: Achievement = {
  id: "resource.dabbler.t2",
  title: "Resource Hoarder",
  description: "Produce 1 000 Abstractum lifetime. The tap is real; so is the patience.",
  branch: "resource",
  tier: 2,
  target: 1000,
  unit: "Abstractum (lifetime)",
  reward: {
    unsc: 40,
    flag: "ach_resource_dabbler_t2",
    description: "+40 _unSC",
  },
  available: (flags) => flags.ach_resource_dabbler_t1 === true,
  evaluate: lifetimeAbstractum,
};

const DABBLER_T3: Achievement = {
  id: "resource.dabbler.t3",
  title: "Resource Tycoon",
  description: "Produce 10 000 Abstractum lifetime. At drone-swarm rates, a long coffee break.",
  branch: "resource",
  tier: 3,
  target: 10000,
  unit: "Abstractum (lifetime)",
  reward: {
    unsc: 80,
    flag: "ach_resource_dabbler_t3",
    description: "+80 _unSC",
  },
  available: (flags) => flags.ach_resource_dabbler_t2 === true,
  evaluate: lifetimeAbstractum,
};

export const RESOURCE_ACHIEVEMENTS: Achievement[] = [DABBLER_T1, DABBLER_T2, DABBLER_T3];

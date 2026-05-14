/**
 * M008 — "First Production Run"
 * ==============================
 *
 * Exercises the production queue in a concrete way: stockpile some Base
 * Alloy and witness energy pressure on a real multi-job run. Complements
 * EP2.first_job without duplicating it — the quest step demands a single
 * claim, this mission demands a stockpile.
 */

import type { Mission } from "../types";

export const M008: Mission = {
  id: "M008",
  title: "First Production Run",
  flavor: "A single ingot is a coincidence. Three is a supply chain.",
  category: "progression",
  priority: 8,
  unlockRequires: ["missions_unlocked", "smt_01_online"],
  tasks: [
    {
      id: "m008.task.stockpile",
      label: "Stockpile 3 Base Alloy Ingots",
      objectives: [
        {
          id: "m008.obj.craft_alloys",
          description: "Claim 3 Base Alloy Ingots",
          type: "craft_count",
          target: "base_alloy_ingot",
          targetValue: 3,
          hint: "Queue ingots from the Lab. 90 seconds each. Ten at a time is ambitious; three is sufficient.",
          deepDiveHint:
            "Each ingot costs 5 Abstractum + 60 Energy + 1 _unSC. You may need to refill Abstractum between jobs — it seeps at 1/min plus 2/min from SMT-01.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "grant_resource", resourceId: "base_alloy", amount: 2 },
    { kind: "set_flag", flag: "first_production_run", value: true },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Three ingots in inventory. This is what the previous operator used to call Tuesday.",
    },
  ],
  nextMission: "M009",
};

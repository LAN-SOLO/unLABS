/**
 * M008 — "First Production Run"
 * ==============================
 *
 * Exercises the production queue in a concrete way: stockpile some Base
 * Alloy and witness energy pressure on a real multi-job run. Complements
 * EP2.first_job without duplicating it — the quest step demands a single
 * claim, this mission demands a stockpile.
 *
 * Structure: task 1 is the production push (ingots + cells + a healthy
 * Abstractum buffer), task 2 is line supervision (terminal literacy +
 * holding the output instead of spending it immediately).
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
          relatedDeviceIds: ["SMT-01"],
        },
        {
          id: "m008.obj.craft_cells",
          description: "Claim 2 Energy Cells",
          type: "craft_count",
          target: "energy_cell",
          targetValue: 2,
          hint: "Energy Cells bank idle energy for later. Cheap, fast, and they keep the smelter fed between ingot jobs.",
          deepDiveHint:
            "The Energy Cell recipe costs 3 Abstractum, takes 30 seconds, and grants 100 Energy on claim. Queue them while an ingot job is running — the production line handles parallel jobs without complaint.",
        },
        {
          id: "m008.obj.abstractum_buffer",
          description: "Build an Abstractum buffer of 25 or more",
          type: "resource_threshold",
          target: "abstractum",
          targetValue: 25,
          hint: "Let the seep work for you. Three ingots cost 15 Abstractum — a 25-unit buffer means the line never starves.",
          deepDiveHint:
            "With SMT-01 online you gain 3 Abstractum per minute (1 base + 2 from the smelter). Stop spending for a few minutes and the buffer fills itself. A supply chain is mostly the discipline of not spending everything immediately.",
          relatedDeviceIds: ["SMT-01"],
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "One ingot proves the smelter works. Three ingots prove *you* work. The distinction matters to me more than it should.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "fridge",
          text: "ENG LOG: production batch complete. 3x base alloy, 2x energy cell. intake buffer nominal. line certified for continuous operation.",
        },
      ],
    },
    {
      id: "m008.task.oversight",
      label: "Supervise the line",
      objectives: [
        {
          id: "m008.obj.line_check",
          description: "Open the production hub with `lab`",
          type: "command",
          target: "lab",
          targetValue: 1,
          hint: "Type `lab` in the terminal. Operators who watch their queue lose fewer jobs to surprises.",
          deepDiveHint:
            "Run `lab` to jump to the production hub, or `lab jobs` to list every job with its ETA directly in the terminal. A supply chain you cannot see is a supply chain you cannot fix.",
        },
        {
          id: "m008.obj.system_status",
          description: "Check the system status with `status`",
          type: "command",
          target: "status",
          targetValue: 1,
          hint: "Run `status` in the terminal for the operator-level overview: balance, session, system health.",
        },
        {
          id: "m008.obj.hold_alloys",
          description: "Hold 3 Base Alloy in storage",
          type: "resource_threshold",
          target: "base_alloy",
          targetValue: 3,
          hint: "Crafting ingots puts Base Alloy in storage. Keep three there — resist the urge to spend them.",
          deepDiveHint:
            "The three ingots from this run land as 3 Base Alloy in your stores. Devices and research will happily eat them later — MIX-01 alone wants 2. For now, hold the stockpile. That is what makes it a stockpile.",
          relatedDeviceIds: ["SMT-01"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "mcp",
          text: "A monitored queue, a status check, and an actual reserve. You are beginning to operate this lab instead of merely surviving it.",
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

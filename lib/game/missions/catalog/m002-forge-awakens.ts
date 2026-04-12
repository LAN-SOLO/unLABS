/**
 * M002 — "The Forge Awakens"
 * ==========================
 *
 * Material progression mission. Teaches the player the tiered material
 * chain: Base Alloy -> Advanced Alloy, and introduces the idea that
 * higher-tier materials require lower-tier inputs.
 */

import type { Mission } from "../types";

export const M002: Mission = {
  id: "M002",
  title: "The Forge Awakens",
  flavor: "Raw Abstractum is a rumor. Alloy is a statement. Advanced alloy is a thesis.",
  category: "progression",
  priority: 2,
  unlockRequires: ["missions_unlocked", "missions_power_budget"],
  sequential: true,
  tasks: [
    {
      id: "m002.task.stockpile",
      label: "Stockpile Base Alloy",
      objectives: [
        {
          id: "m002.obj.craft_3_alloy",
          description: "Craft 3 Base Alloy Ingots",
          type: "craft_count",
          target: "base_alloy_ingot",
          targetValue: 3,
          hint: "You need three ingots to forge one Advanced Alloy. Start queueing jobs.",
          deepDiveHint:
            "Each Base Alloy Ingot costs 5 Abstractum + 60 Energy + 1 _unSC and takes 90 seconds. You can run one at a time. Plan your energy budget — crafting while devices are active may drain your reserves.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "fridge",
          text: "ENG LOG: base alloy stockpile sufficient for one advanced fold. proceed when ready.",
        },
      ],
    },
    {
      id: "m002.task.advanced",
      label: "Forge Advanced Alloy",
      unlockRequires: ["ep0_complete"],
      objectives: [
        {
          id: "m002.obj.craft_advanced",
          description: "Craft 1 Advanced Alloy Ingot",
          type: "craft_count",
          target: "advanced_alloy_ingot",
          targetValue: 1,
          hint: "Advanced Alloy requires 3 Base Alloy, 120 Energy, and 3 _unSC.",
          deepDiveHint:
            "The Advanced Alloy recipe is unlocked by completing EP0. It consumes 3 Base Alloy Ingots — all of what you just stockpiled. The job takes 5 minutes (300 seconds). Worth the wait.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "mcp",
          text: "Your first advanced alloy. It took the original team six months to produce one. You did it in an afternoon. I am not sure whether to be impressed or concerned.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "forge_mastered", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 2 },
  ],
  completionVoice: [
    {
      voice: "jade",
      text: "the forge remembers every fold. some of the older ingots hum at frequencies that make the oscilloscope nervous.",
    },
  ],
  nextMission: "M005",
};

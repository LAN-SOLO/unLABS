/**
 * M017 — "Exotic Synthesis"
 * ==========================
 *
 * Exploration mission. Teaches the exotic matter crystal recipe and
 * asks the player to stockpile for the endgame builds.
 */

import type { Mission } from "../types";

export const M017: Mission = {
  id: "M017",
  title: "Exotic Synthesis",
  flavor:
    "The containment vessel can crystallize exotic matter. Do it three times, then hold on to the results.",
  category: "exploration",
  priority: 17,
  unlockRequires: ["emc_001_online"],
  sequential: false,
  tasks: [
    {
      id: "m017.task.crystals",
      label: "Synthesize exotic matter crystals",
      objectives: [
        {
          id: "m017.obj.craft_crystals",
          description: "Craft 3 Exotic Matter Crystals",
          type: "craft_count",
          target: "exotic_matter_crystal",
          targetValue: 3,
          hint: "The crystal recipe is available once EMC-001 is online. Each crystal yields 2 exotic matter.",
          deepDiveHint:
            "Each crystal costs 1 Nanomaterial + 1000 Energy + 2 Advanced Alloy + 15 _unSC. Build time: 40 minutes each. You need three to stockpile for endgame devices.",
        },
      ],
    },
    {
      id: "m017.task.stockpile",
      label: "Stockpile exotic matter",
      objectives: [
        {
          id: "m017.obj.em_threshold",
          description: "Hold 10 or more exotic matter",
          type: "resource_threshold",
          target: "exotic_matter",
          targetValue: 10,
          hint: "Keep crafting crystals and collecting exotic matter from other sources until you hit 10.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "exotic_synthesis_claimed", value: true },
    { kind: "grant_resource", resourceId: "antimatter", amount: 1 },
  ],
  completionVoice: [
    {
      voice: "findr",
      text: "TEN exotic matters!! that is SO MANY!! you are basically a wizard now!! a SCIENCE wizard!!",
    },
  ],
};

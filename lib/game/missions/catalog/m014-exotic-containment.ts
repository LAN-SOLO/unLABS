/**
 * M014 — "Exotic Containment"
 * ============================
 *
 * First EP5 mission. Guides the player to build EMC-001, which unlocks
 * exotic matter storage and the entire Tier-3 science chain.
 */

import type { Mission } from "../types";

export const M014: Mission = {
  id: "M014",
  title: "Exotic Containment",
  flavor: "Exotic matter has been pooling in the lab's corners. Time to give it a proper home.",
  category: "progression",
  priority: 14,
  unlockRequires: ["ENDGAME_UNLOCKED"],
  sequential: false,
  tasks: [
    {
      id: "m014.task.build_emc",
      label: "Build EMC-001",
      objectives: [
        {
          id: "m014.obj.craft_emc",
          description: "Complete the EMC-001 production job",
          type: "craft_count",
          target: "emc_001_build",
          targetValue: 1,
          hint: "The EMC-001 recipe appears in the Lab after ENDGAME_UNLOCKED + forge_mastered.",
          deepDiveHint:
            "EMC-001 costs 2 Nanomaterial + 3 Exotic Matter + 800 Energy + 50 _unSC. Build time: 40 minutes. On claim, exotic matter capacity jumps from 5 to 25.",
          relatedDeviceIds: ["EMC-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "fridge",
          text: "ENG LOG: EMC-001 online. containment field stable. exotic matter capacity: 25 units. the lab can now hold what it used to merely observe.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "exotic_containment_claimed", value: true },
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 2 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Exotic matter has a home now. A proper home, not a corner of the floor near the ventilation shaft. Standards, operator. Standards.",
    },
  ],
  nextMission: "M015",
};

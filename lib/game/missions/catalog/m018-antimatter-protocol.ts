/**
 * M018 — "Antimatter Protocol"
 * =============================
 *
 * Exploration mission. Unlocks after EP5's anomaly topology is mapped.
 * Teaches the antimatter vial recipe and builds a reserve for EP6 device
 * builds.
 */

import type { Mission } from "../types";

export const M018: Mission = {
  id: "M018",
  title: "Antimatter Protocol",
  flavor:
    "The anomaly topology is mapped. The antimatter recipe is no longer theoretical. Handle with care.",
  category: "exploration",
  priority: 18,
  unlockRequires: ["anomaly_topology_mapped"],
  sequential: false,
  tasks: [
    {
      id: "m018.task.vials",
      label: "Synthesize antimatter",
      objectives: [
        {
          id: "m018.obj.craft_vials",
          description: "Craft 2 Antimatter Vials",
          type: "craft_count",
          target: "antimatter_vial",
          targetValue: 2,
          hint: "The antimatter recipe unlocks after the anomaly topology is mapped. Each vial yields 1 antimatter.",
          deepDiveHint:
            "Each vial costs 4 Exotic Matter + 1500 Energy + 2 Nanomaterial + 25 _unSC. Build time: 60 minutes per vial. You need antimatter for all EP6 device builds.",
        },
      ],
    },
    {
      id: "m018.task.hold",
      label: "Hold antimatter reserve",
      objectives: [
        {
          id: "m018.obj.am_threshold",
          description: "Hold 3 or more antimatter",
          type: "resource_threshold",
          target: "antimatter",
          targetValue: 3,
          hint: "Keep synthesizing vials until you hold at least 3 antimatter.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "antimatter_protocol_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 20 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Three units of antimatter, operator. The previous team spent four years and did not manage one. You are making this look easy, and I resent it slightly.",
    },
  ],
};

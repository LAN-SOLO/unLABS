/**
 * M006 — "The Anomaly Deepens"
 * ============================
 *
 * Late-game exploration mission. The player must accumulate exotic matter
 * and discover multiple resonance protocols, proving they understand both
 * the production and discovery systems.
 */

import type { Mission } from "../types";

export const M006: Mission = {
  id: "M006",
  title: "The Anomaly Deepens",
  flavor:
    "The signal is getting louder. Whatever is on the other side of the anomaly has noticed you too.",
  category: "exploration",
  priority: 6,
  unlockRequires: ["missions_unlocked", "anomaly_mode", "first_resonance"],
  tasks: [
    {
      id: "m006.task.exotic",
      label: "Accumulate exotic matter",
      objectives: [
        {
          id: "m006.obj.exotic_5",
          description: "Reach 5 exotic matter",
          type: "resource_threshold",
          target: "exotic_matter",
          targetValue: 5,
          hint: "Exotic matter is rare. Resonance protocols and high-tier production jobs are your best sources.",
          deepDiveHint:
            "Exotic matter comes from: (1) resonance protocol rewards, (2) specific production recipes, and (3) advanced mission rewards. Keep triggering resonance protocols and crafting high-tier materials to accumulate it.",
        },
      ],
    },
    {
      id: "m006.task.discoveries",
      label: "Expand the resonance catalog",
      objectives: [
        {
          id: "m006.obj.discover_2",
          description: "Discover any 2 resonance protocols",
          type: "discovery",
          target: "_any",
          targetValue: 2,
          hint: "Look for clues in the log files. Jade and Fridge left notes about strange device interactions.",
          deepDiveHint:
            "Resonance protocols are triggered by setting specific device parameters within a time window. Try reading files in /unvar/log/jade/ and /unvar/log/fridge/ for clues. You can also type `discoveries` in the terminal to see which protocols you have found so far.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "anomaly_depth", value: true },
    { kind: "grant_resource", resourceId: "antimatter", amount: 1 },
    { kind: "grant_resource", resourceId: "research", amount: 15 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "I am beginning to think the anomalies are not random. They respond to resonance. They respond to you. I am not sure what that means, and I am not sure I want to find out.",
    },
    {
      voice: "jade",
      text: "you are closer now. closer than I ever got. the anomalies are not a problem to solve. they are a conversation to have.",
    },
  ],
};

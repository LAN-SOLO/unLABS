/**
 * M012 — "Cross-Pollinator"
 * =========================
 *
 * Breadth-first progression mission. Shares `pick_path_done` with EP3.4.
 * The observer flips the flag as soon as `tech_tree_state.unlocked`
 * contains a node in each of at least two different trees — the first
 * time that happens, both the quest step and this mission complete.
 */

import type { Mission } from "../types";

export const M012: Mission = {
  id: "M012",
  title: "Cross-Pollinator",
  flavor: "Specialize later. Explore now. The tree is eight columns wide for a reason.",
  category: "exploration",
  priority: 12,
  unlockRequires: ["nexus_built"],
  tasks: [
    {
      id: "m012.task.two_trees",
      label: "Unlock research nodes in two different trees",
      objectives: [
        {
          id: "m012.obj.two_trees",
          description: "Hold unlocked nodes across ≥ 2 trees",
          type: "flag",
          target: "pick_path_done",
          targetValue: 1,
          hint: "Alloy Efficiency (Refine) + Seep Tap (Tools) is the cheapest two-tree pair.",
          deepDiveHint:
            "The client observer flips this flag when your tech_tree_state.unlocked spans ≥ 2 distinct trees. Both Alloy Efficiency and Seep Tap are T1 nodes with no prereqs, so this mission is reachable immediately after building the Nexus.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "cross_pollinator_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 2 },
  ],
  completionVoice: [
    {
      voice: "jade",
      text: "the tree prefers you to wander. specialization makes it suspicious.",
    },
  ],
  nextMission: "M013",
};

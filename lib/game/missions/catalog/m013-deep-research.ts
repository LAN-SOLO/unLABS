/**
 * M013 — "Deep Research"
 * ======================
 *
 * Phase 5 mastery beat. Requires the player to reach any T3 node — the
 * first genuinely long-horizon research commitment. Checks for the
 * `pick_path_deep` flag set by the observer when unlocked contains ≥ 1
 * T2+ node in ≥ 2 trees (matches EP4.2 semantics).
 */

import type { Mission } from "../types";

export const M013: Mission = {
  id: "M013",
  title: "Deep Research",
  flavor: "The tree fans out. Depth costs time. Breadth costs attention. Pay something.",
  category: "mastery",
  priority: 13,
  unlockRequires: ["pick_path_done"],
  tasks: [
    {
      id: "m013.task.depth",
      label: "Reach T2 research in two different trees",
      objectives: [
        {
          id: "m013.obj.deep",
          description: "Hold ≥ 1 T2+ node unlocked in each of 2 trees",
          type: "flag",
          target: "pick_path_deep",
          targetValue: 1,
          hint: "The tools.explorer_drone.t2 + refine.power_condense.t2 pair is the straight-line route.",
          deepDiveHint:
            "Power Condense needs Alloy Efficiency (Refine T1). Explorer Drone needs Seep Tap (Tools T1) AND Alloy Efficiency (cross-tree prereq). You end up touching three nodes plus the two T2 targets — about 30 minutes of research time total.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "deep_research_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 5 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Two tiers, two branches. This is what the original team called 'a week'. You did it in an afternoon. The lab likes that about you.",
    },
  ],
};

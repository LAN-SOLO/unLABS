/**
 * M011 — "Drone Protocol"
 * =======================
 *
 * Phase 4 centerpiece. Unlocking the Explorer Drone protocol jumps the
 * passive Abstractum rate from 3/min to 20/min — the first time the idle
 * loop goes from "adequate" to "meaningful". Shares a flag with EP3.2 so
 * either path satisfies both.
 */

import type { Mission } from "../types";

export const M011: Mission = {
  id: "M011",
  title: "Drone Protocol",
  flavor: "Autonomous prospecting. The drones choose where to drill. They are not telling you how.",
  category: "progression",
  priority: 11,
  unlockRequires: ["research_started"],
  tasks: [
    {
      id: "m011.task.unlock",
      label: "Unlock 'tools.explorer_drone.t2'",
      objectives: [
        {
          id: "m011.obj.drone_unlocked",
          description: "Claim the Explorer Drone Protocol research",
          type: "flag",
          target: "research_explorer_drone",
          targetValue: 1,
          hint: "Prereqs: Alloy Efficiency (Refine T1) AND Seep Tap (Tools T1). Chain them in the Nexus.",
          deepDiveHint:
            "'tools.explorer_drone.t2' takes 15 minutes to research. Costs 4 Base Alloy + 600 Energy + 30 _unSC. On claim, Abstractum rate jumps to 20/min permanently.",
          relatedDeviceIds: ["NXS-01", "EXD-001"],
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "drone_protocol_mission_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 3 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Twenty Abstractum per minute. The previous operator would have wept. You should at least smile a little.",
    },
  ],
  nextMission: "M012",
};

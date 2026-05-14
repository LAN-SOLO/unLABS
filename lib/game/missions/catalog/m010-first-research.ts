/**
 * M010 — "First Research"
 * =======================
 *
 * Phase 4 opener. Twins EP3.ep3.first_research — completing either
 * satisfies the other, because they share the `research_started` flag set
 * by the PhaseObservers when any research job exists.
 */

import type { Mission } from "../types";

export const M010: Mission = {
  id: "M010",
  title: "First Research",
  flavor: "Research is a tax on patience. It refunds in rates.",
  category: "progression",
  priority: 10,
  unlockRequires: ["nexus_built"],
  tasks: [
    {
      id: "m010.task.start",
      label: "Start any research through the Nexus",
      objectives: [
        {
          id: "m010.obj.research_started",
          description: "Start one research job",
          type: "flag",
          target: "research_started",
          targetValue: 1,
          hint: "Open the Nexus (run nexus) and click 'Start research' on any available T1 node.",
          deepDiveHint:
            "The quickest nodes are 'tools.seep_tap.t1' (3 min, 20 Abstractum) and 'refine.alloy_efficiency.t1' (5 min, 40 Abstractum + 300 Energy). Either one flips the flag.",
          relatedDeviceIds: ["NXS-01"],
        },
      ],
    },
  ],
  rewards: [{ kind: "grant_resource", resourceId: "research", amount: 1 }],
  completionVoice: [
    {
      voice: "findr",
      text: "ooh you started a thing!! a real science thing!!",
    },
  ],
  nextMission: "M011",
};

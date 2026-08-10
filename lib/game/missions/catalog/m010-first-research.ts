/**
 * M010 — "First Research"
 * =======================
 *
 * Phase 4 opener. Twins EP3.ep3.first_research — completing either
 * satisfies the other, because they share the `research_started` flag set
 * by the PhaseObservers when any research job exists.
 *
 * Task 1 gets the first job started (with a funded war chest so the
 * cheapest nodes are actually affordable); task 2 teaches the two ways to
 * watch it run — the Nexus graph and the terminal.
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
        {
          id: "m010.obj.browse_tree",
          description: "Browse the tech tree with `research`",
          type: "command",
          target: "research",
          targetValue: 1,
          hint: "Type `research` in the terminal for the full node list with statuses and ETAs.",
          deepDiveHint:
            "`research` (alias `r`) lists every node across all eight trees: available, locked, in progress, claimed. `research start <node-id>` begins a job from the terminal — no graph UI required. Eight columns. Pick one.",
          relatedDeviceIds: ["NXS-01"],
        },
        {
          id: "m010.obj.war_chest",
          description: "Assemble a 40-Abstractum war chest",
          type: "resource_threshold",
          target: "abstractum",
          targetValue: 40,
          hint: "The T1 refine node costs 40 Abstractum. Let the seep fill your reserve before you commit.",
          deepDiveHint:
            "Alloy Efficiency (Refine T1) costs 40 Abstractum + 300 Energy; Seep Tap (Tools T1) only 20 Abstractum. At 3/min the seep delivers 40 in under 15 minutes from empty — faster if you skip crafting meanwhile. Research is a budget line now.",
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "The Nexus is online, which means the lab can finally convert curiosity into rates. The original team called this 'the department'. I call it the only device that pays compound interest.",
        },
      ],
    },
    {
      id: "m010.task.follow_through",
      label: "Watch it run",
      objectives: [
        {
          id: "m010.obj.open_nexus",
          description: "Launch the Nexus holo-graph with `nexus`",
          type: "command",
          target: "nexus",
          targetValue: 1,
          hint: "Type `nexus` (alias `tree`) in the terminal to project the full research graph.",
          deepDiveHint:
            "`nexus` opens the clickable holo-graph: eight trees, tiers stacked bottom-to-top, prerequisites drawn as edges. Your running job pulses. This is the map of everything the lab does not know yet.",
          relatedDeviceIds: ["NXS-01"],
        },
        {
          id: "m010.obj.job_status",
          description: "Check the running job with `research status`",
          type: "command",
          target: "research status",
          targetValue: 1,
          hint: "Run `research status` to see the active job and its remaining time.",
          deepDiveHint:
            "`research status` prints the active node and its ETA; `research claim` collects it the moment the timer hits zero. Claiming is not automatic — knowledge, like ingots, must be picked up.",
          relatedDeviceIds: ["NXS-01"],
        },
        {
          id: "m010.obj.knowledge_bank",
          description: "Hold 5 or more Research points",
          type: "resource_threshold",
          target: "research",
          targetValue: 5,
          hint: "The Nexus build granted 5 Research. Hold on to them — the deeper trees charge in this currency.",
          deepDiveHint:
            "Research points arrive from mission rewards, certain tech nodes, and (later) a passive rate from the Science tree. The Adapters and Science trees spend them as a cost. Five in the bank keeps your options open.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "mcp",
          text: "Graph opened, job monitored, points banked. You have all three habits of a researcher and none of the grant paperwork.",
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

/**
 * M012 — "Cross-Pollinator"
 * =========================
 *
 * Breadth-first progression mission. Shares `pick_path_done` with EP3.4.
 * The observer flips the flag as soon as `tech_tree_state.unlocked`
 * contains a node in each of at least two different trees — the first
 * time that happens, both the quest step and this mission complete.
 *
 * Task 1 is the two-tree spread itself; task 2 pushes the player one
 * material tier up and into the habit of checking their own boards.
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
          relatedDeviceIds: ["NXS-01"],
        },
        {
          id: "m012.obj.survey_graph",
          description: "Survey the full graph with `nexus`",
          type: "command",
          target: "nexus",
          targetValue: 1,
          hint: "Open the holo-graph with `nexus` and actually look at all eight columns before you commit.",
          deepDiveHint:
            "Each column owns something: Tools feeds Abstractum rate, Adapters its capacity, Optics prints Nanomaterial, Synthesizers hold exotic matter, Science pays Research per minute, Devices raise storage, Gadgets pay one-time hauls. Knowing who owns what is the whole point of wandering.",
          relatedDeviceIds: ["NXS-01"],
        },
        {
          id: "m012.obj.seed_fund",
          description: "Hold 60 Abstractum for the entry-tier nodes",
          type: "resource_threshold",
          target: "abstractum",
          targetValue: 60,
          hint: "Most T1 nodes charge 30–80 Abstractum. Sixty in reserve covers any first pick.",
          deepDiveHint:
            "Entry costs: Seep Tap 20, Resource Magnet 30, Alloy Efficiency / Beam Collimation / Structured Inquiry 40, Oracle Handshake 50, Slice Compiler 60, Chassis Standard 80. With the drone protocol at 20/min, 60 Abstractum is three minutes of patience.",
        },
      ],
      voiceOnStart: [
        {
          voice: "jade",
          text: "eight trees. everyone picks the one that looks like power. pick the one that looks like a question instead.",
        },
      ],
    },
    {
      id: "m012.task.breadth",
      label: "Wander further",
      objectives: [
        {
          id: "m012.obj.advanced_ingot",
          description: "Claim 2 Advanced Alloy Ingots",
          type: "craft_count",
          target: "advanced_alloy_ingot",
          targetValue: 2,
          hint: "Advanced Alloy is the T2 material — three Base Alloy folded through the forge. Deep trees charge in it.",
          deepDiveHint:
            "Each Advanced Alloy Ingot costs 3 Base Alloy + 120 Energy + 3 _unSC and takes 5 minutes. T3 research nodes (Drone Swarm, Nanomaterial Catalyst, Resonance Harvester) all bill in Advanced Alloy — this is you paying tuition early.",
          relatedDeviceIds: ["SMT-01", "MIX-01"],
        },
        {
          id: "m012.obj.research_reserve",
          description: "Hold 10 or more Research points",
          type: "resource_threshold",
          target: "research",
          targetValue: 10,
          hint: "The Adapters and Science trees charge Research as a cost. Ten banked keeps both doors open.",
          deepDiveHint:
            "Research points come from mission claims and certain node grants (Ledger Attestation pays 10 back, Quantum Compass 25). Science T1 costs 10 Research and then pays a passive 2/min forever — the classic cross-pollinator move.",
        },
        {
          id: "m012.obj.check_missions",
          description: "Review the board with `missions --available`",
          type: "command",
          target: "missions",
          targetValue: 1,
          hint: "Run `missions` in the terminal — breadth in research unlocks breadth on the mission board.",
          deepDiveHint:
            "`missions` lists everything; `missions --available` filters to what you can start right now. Several later missions gate on flags that only research sets, so the board is also a map of which tree to visit next.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "mcp",
          text: "Two trees, a tier-two ingot, and a funded reserve. The tree rewards the curious. So do I, though less predictably.",
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

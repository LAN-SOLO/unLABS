/**
 * EP3 — "Expansion"
 * =================
 *
 * Phase 4 of the Cold Start Protocol: the Nexus is online, first research
 * jobs land, and the Abstractum bottleneck breaks when the Explorer Drone
 * protocol unlocks. EP3 is the bridge between "I can craft" and "the idle
 * loop pays me" — by the end of this episode the passive Abstractum rate
 * has climbed from 3/min (post-SMT-01) to 20/min (post-Drone Protocol).
 *
 * Mechanic anchoring:
 *   Step 1 → flag `research_started` (observer: any research job exists)
 *   Step 2 → flag `research_explorer_drone` (set by the tech-tree node)
 *   Step 3 → flag `welcome_back_seen` (observer: Welcome-Back modal ack)
 *   Step 4 → flag `pick_path_done` (observer: unlocked nodes span ≥ 2 trees)
 *
 * Plan-doc mapping: the original design called for "Quantum Mechanics
 * research → Explorer Drone" as a two-step gate; MVP collapses both into
 * the single `tools.explorer_drone.t2` tech node (which itself requires
 * Alloy Efficiency + Seep Tap as prereqs, so the player still walks the
 * chain). The Optics-T1 + Scanner content from the plan's Step 4 moves to
 * post-MVP; the slot is reused for cross-tree exploration.
 */

import type { Episode } from "./types";

export const EP3: Episode = {
  id: "EP3",
  title: "Expansion",
  synopsis:
    "The Nexus hums. The tree is mostly theoretical. Make a real choice, then make another one.",
  steps: [
    {
      id: "ep3.first_research",
      objective: "Start your first research job through the Nexus",
      hint: "Open the Nexus ('run nexus' in the terminal, or NEXUS panel tile). Any T1 node will do.",
      voiceLines: [
        {
          voice: "findr",
          text: "The tree! The tree! Pick one! Any one! I like Seep Tap — the math is very pretty and also it goes fast.",
        },
        {
          voice: "mcp",
          text: "Research is a patience tax. You pay it once, you reap for the rest of the session. Pick something that will still matter in an hour.",
        },
      ],
      trigger: { kind: "flag", flag: "research_started" },
      rewards: [{ kind: "set_flag", flag: "ep3_first_research_done", value: true }],
    },
    {
      id: "ep3.drone_protocol",
      objective: "Unlock the Explorer Drone protocol",
      hint: "Tools tier 2: 'tools.explorer_drone.t2'. Requires Alloy Efficiency AND Seep Tap unlocked first — the Nexus graph will highlight the chain.",
      voiceLines: [
        {
          voice: "mcp",
          text: "The drone protocol is the answer to the Abstractum bottleneck. Follow the chain: alloy efficiency, then seep tap, then the drone. Boring. Correct.",
        },
        {
          voice: "fridge",
          text: "ENG LOG: Drone Protocol ratifies autonomous prospecting. Post-claim Abstractum seep: 20/min. Post-human patience: ample.",
        },
        {
          voice: "jade",
          text: "(in the margin) — the drones choose where to drill. they are not telling me how they choose. that is probably fine.",
        },
      ],
      trigger: { kind: "flag", flag: "research_explorer_drone" },
      rewards: [{ kind: "set_flag", flag: "ep3_drone_done", value: true }],
    },
    {
      id: "ep3.daily_rhythm",
      objective: "Step away, then come back",
      hint: "Close the tab or walk away for at least a minute. When you return, the Welcome-Back summary is your confirmation the idle loop is earning.",
      voiceLines: [
        {
          voice: "mcp",
          text: "Welcome to the boring part. Come back tomorrow. Literally. The lab will still be here. So will I, unfortunately.",
        },
        {
          voice: "mcp",
          text: "Offline progress is capped at eight hours. Plan breaks accordingly. Long weekends will forgive you; fortnights will not.",
        },
      ],
      trigger: { kind: "flag", flag: "welcome_back_seen" },
      rewards: [{ kind: "set_flag", flag: "ep3_rhythm_done", value: true }],
    },
    {
      id: "ep3.pick_a_path",
      objective: "Unlock nodes in two different tech trees",
      hint: "The tech graph fans out from here. Alloy Efficiency (Refine) and Seep Tap (Tools) both count.",
      voiceLines: [
        {
          voice: "jade",
          text: "…specialization is cheaper in the short term. breadth is cheaper in the long one. the lab does not care which you pick.",
        },
        {
          voice: "mcp",
          text: "Two trees unlocks breadth achievements, flavor dialog, and a small amount of pride. All three are optional. None are free.",
        },
      ],
      trigger: { kind: "flag", flag: "pick_path_done" },
      rewards: [
        { kind: "set_flag", flag: "ep3_cross_tree_done", value: true },
        { kind: "grant_resource", resourceId: "research", amount: 2 },
      ],
    },
  ],
  completionRewards: [{ kind: "set_flag", flag: "ep3_complete", value: true }],
  nextEpisode: "EP4",
};

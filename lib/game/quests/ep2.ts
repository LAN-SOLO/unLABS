/**
 * EP2 — "Foundation"
 * ==================
 *
 * Phase 3 of the Cold Start Protocol: the player has missions unlocked,
 * a trickle of Abstractum, and a functioning energy bus. Foundation is
 * where the idle loop starts paying — by building the three production
 * chain devices (Smelter, Condenser, Mixer), queuing the first real job,
 * hitting the Abstractum bottleneck that motivates research, and finally
 * building the Nexus (NXS-01) which gates EP3's research subsystem.
 *
 * Mechanic anchoring:
 *   Step 1 → flag `three_chains_online` (set by MIX-01 recipe claim)
 *   Step 2 → flag `first_production_run` (set when a base_alloy_ingot job
 *            is claimed; emitted by the client observer)
 *   Step 3 → flag `abstractum_bottleneck_observed` (set by the observer
 *            after ≥60s held at ≤50 Abstractum)
 *   Step 4 → flag `nexus_built` (set by NXS-01 recipe claim)
 *
 * All gating is flag-based rather than continue-based so an operator who
 * happens to build the Smelter early still gets the narrative beat when
 * they open EP2 for the first time — the step shows as ready-to-advance.
 */

import type { Episode } from "./types";

export const EP2: Episode = {
  id: "EP2",
  title: "Foundation",
  synopsis:
    "Three production chains. Four walls of bottlenecks. Build the Nexus to see how far the tree actually grows.",
  steps: [
    {
      id: "ep2.three_chains",
      objective: "Bring the three production chains online",
      hint: "Smelter first, then Condenser, then Mixer. Each unlocks the next.",
      voiceLines: [
        {
          voice: "mcp",
          text: "Congratulations on one reactor. Now build three more things before I die of boredom.",
        },
        {
          voice: "mcp",
          text: "Smelter, Condenser, Mixer. They turn Abstractum into something you can actually use.",
        },
        {
          voice: "fridge",
          text: "ENG LOG: SMT-01 / CND-01 / MIX-01 required for the standard production manifold. dependencies: sequential. tolerances: cheerful.",
        },
      ],
      trigger: { kind: "flag", flag: "three_chains_online" },
      rewards: [
        // Small reserve-style grant is handled on claim by the client using
        // awardFromReserve; the narrative step itself doesn't move _unSC.
        { kind: "set_flag", flag: "ep2_step_chains_done", value: true },
      ],
    },
    {
      id: "ep2.first_job",
      objective: "Queue and claim a Base Alloy Ingot",
      hint: "Head to the Lab. Smelter → Base Alloy → five minutes. Try one. Or ten. Ten is more.",
      voiceLines: [
        {
          voice: "fridge",
          text: "The Smelter runs a Base Alloy Ingot recipe. Input: 5 Abstractum + 60 Energy + 1 _unSC. Output: one ingot. Time: 90 seconds.",
        },
        {
          voice: "mcp",
          text: "Patience is a lab skill, operator. The job will finish. The lab does not need you to stare at it.",
        },
      ],
      trigger: { kind: "flag", flag: "first_production_run" },
      rewards: [{ kind: "grant_resource", resourceId: "base_alloy", amount: 10 }],
    },
    {
      id: "ep2.bottleneck",
      objective: "Observe the Abstractum bottleneck",
      hint: "Let your Abstractum reserve drop below 50. The bottleneck is the point of the next step.",
      voiceLines: [
        {
          voice: "mcp",
          text: "You have noticed your Abstractum drained. That is the point. We need more sources.",
        },
        {
          voice: "jade",
          text: "(in the margin) — abstractum is not a supply problem. it is a patience problem. then it becomes a research problem. in that order.",
        },
        {
          voice: "mcp",
          text: "There is a research path for that. You will want a Nexus first.",
        },
      ],
      trigger: { kind: "flag", flag: "abstractum_bottleneck_observed" },
      rewards: [{ kind: "set_flag", flag: "nexus_blueprint_visible", value: true }],
    },
    {
      id: "ep2.build_nexus",
      objective: "Build NXS-01 (Nexus)",
      hint: "The Nexus recipe appears in the Lab once the three chains are online. It costs 10 Base Alloy, 400 Energy, and 40 _unSC.",
      voiceLines: [
        {
          voice: "jade",
          text: "…if you are reading this, you have found the Nexus. Build it. The tree was never for us. It is for you.",
        },
        {
          voice: "fridge",
          text: "NXS-01 SPEC: Gadget T2, holo-projector rebuild, renders the full tech graph in a 40 cm standing volume. Drew 45 W on the bench.",
        },
        {
          voice: "mcp",
          text: "Research was always theoretically possible. After the Nexus it will be practically tractable. Mind the difference.",
        },
      ],
      trigger: { kind: "flag", flag: "nexus_built" },
      rewards: [
        { kind: "set_flag", flag: "research_unlocked", value: true },
        { kind: "grant_resource", resourceId: "research", amount: 3 },
      ],
    },
  ],
  completionRewards: [{ kind: "set_flag", flag: "ep2_complete", value: true }],
  nextEpisode: "EP3",
};

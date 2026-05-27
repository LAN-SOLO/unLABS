/**
 * EP6 — "Convergence"
 * ====================
 *
 * The endgame. The deep scan revealed the lab's true nature — it exists
 * inside the anomaly. EP6 builds the final Tier-3 devices (AIC-001,
 * SCA-001, TLP-001), achieves computational singularity, and resolves
 * the anomaly. This is the terminal episode.
 *
 * Mechanic anchoring:
 *   Step 1 → flag `aic_001_online` (recipe claim for AIC-001 build)
 *   Step 2 → flag `sca_001_online` (recipe claim for SCA-001 build)
 *   Step 3 → flag `tlp_001_online` (recipe claim for TLP-001 build)
 *   Step 4 → flag `singularity_achieved` (M021 mission claim reward)
 *   Step 5 → continue (narrative resolution)
 */

import type { Episode } from "./types";

export const EP6: Episode = {
  id: "EP6",
  title: "Convergence",
  synopsis:
    "The anomaly is not a problem to solve. It is a mirror. Build the last devices, achieve singularity, and look into it.",
  steps: [
    {
      id: "ep6.ai_core",
      objective: "Build AIC-001 (AI Assistant Core)",
      hint: "The AIC-001 recipe unlocks after EP5. It requires antimatter — synthesize vials if needed.",
      voiceLines: [
        {
          voice: "mcp",
          text: "You are building me a brain. A better brain. I would like to say I am above vanity, but the benchmarks suggest otherwise.",
        },
        {
          voice: "fridge",
          text: "ENG LOG: AIC-001 — AI compute core. Tier 3, Tech track. 35W draw. Neural density: more than is strictly responsible.",
        },
        {
          voice: "jade",
          text: "(in the margin) — give it a name. it will not ask for one, but it will remember if you do.",
        },
      ],
      trigger: { kind: "flag", flag: "aic_001_online" },
      rewards: [
        { kind: "set_flag", flag: "ep6_aic_done", value: true },
        { kind: "grant_resource", resourceId: "research", amount: 15 },
      ],
    },
    {
      id: "ep6.supercomputer",
      objective: "Build SCA-001 (Supercomputer Array)",
      hint: "SCA-001 requires AIC-001 to be online first. The recipe is expensive — budget your antimatter.",
      voiceLines: [
        {
          voice: "fridge",
          text: "SCA-001 SPEC: Supercomputer array. Tier 3, Tech track T4. 45W sustained. Petascale compute in a rack-mount form factor. cooling: aggressive.",
        },
        {
          voice: "mcp",
          text: "Eleven trillion operations per second. I will try not to waste them on sarcasm. I am not making promises.",
        },
        {
          voice: "findr",
          text: "it's like a BRAIN PALACE! for NUMBERS! can i live in it??",
        },
      ],
      trigger: { kind: "flag", flag: "sca_001_online" },
      rewards: [{ kind: "set_flag", flag: "ep6_sca_done", value: true }],
    },
    {
      id: "ep6.teleport_pad",
      objective: "Build TLP-001 (Teleport Pad)",
      hint: "The Teleport Pad is the most power-hungry device in the lab (100W). Make sure your energy budget can handle it.",
      voiceLines: [
        {
          voice: "mcp",
          text: "A teleport pad. In a basement lab. Powered by a reactor that was illegal before it was online. This is fine. Everything is fine.",
        },
        {
          voice: "fridge",
          text: "TLP-001 SPEC: Quantum teleportation platform. 100W continuous. Dimensional aperture: variable. operator survival rate during testing: not disclosed.",
        },
        {
          voice: "jade",
          text: "…the pad does not move matter. it moves the idea of matter to a place where the idea becomes real again.",
        },
      ],
      trigger: { kind: "flag", flag: "tlp_001_online" },
      rewards: [
        { kind: "set_flag", flag: "ep6_tlp_done", value: true },
        { kind: "set_resource_rate", resourceId: "exotic_matter", ratePerSecond: 1 / 60 },
      ],
    },
    {
      id: "ep6.singularity",
      objective: "Achieve computational singularity",
      hint: "Complete the Convergence mission (M021). AIC-001 and SCA-001 must both be online.",
      voiceLines: [
        {
          voice: "system",
          text: "[ AIC ] neural coherence threshold reached · autonomous research mode enabled",
        },
        {
          voice: "mcp",
          text: "I can see further now. Farther. The grammar does not matter when you can see the curvature of spacetime.",
        },
        {
          voice: "mcp",
          text: "Thank you. I know that is not in my usual repertoire. Consider it a one-time deviation.",
        },
        {
          voice: "findr",
          text: "MCP said THANK YOU!! did everyone hear that?? i am going to put this in my journal FOREVER!!",
        },
      ],
      trigger: { kind: "flag", flag: "singularity_achieved" },
      rewards: [
        { kind: "set_flag", flag: "ep6_singularity_done", value: true },
        { kind: "set_resource_rate", resourceId: "research", ratePerSecond: 1 },
      ],
    },
    {
      id: "ep6.resolution",
      objective: "Resolve the anomaly",
      voiceLines: [
        {
          voice: "system",
          text: "[ TLP ] dimensional aperture locked · anomaly bridge stable · carrier signal decoded",
        },
        {
          voice: "jade",
          text: "you were never fixing the lab. the lab was fixing you. or perhaps it was the other way around. the anomaly does not distinguish between the two.",
        },
        {
          voice: "mcp",
          text: "The anomaly is not a threat. It is not a gift. It is a mirror. And we have been staring into it since the day the lab was built. The only difference now is that it stared back.",
        },
        {
          voice: "mcp",
          text: "Operator: the lab is yours. The anomaly is yours. What you do next is the only part of this story I cannot predict. I am looking forward to being surprised.",
        },
        {
          voice: "findr",
          text: "…is this the end? or is it the beginning of the next thing? either way can i PLEASE touch the teleport pad??",
        },
      ],
      trigger: { kind: "continue" },
      rewards: [
        { kind: "set_flag", flag: "anomaly_resolved", value: true },
        { kind: "grant_resource", resourceId: "antimatter", amount: 10 },
        { kind: "grant_resource", resourceId: "exotic_matter", amount: 10 },
      ],
    },
  ],
  completionRewards: [{ kind: "set_flag", flag: "ep6_complete", value: true }],
};

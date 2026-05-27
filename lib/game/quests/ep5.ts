/**
 * EP5 — "Containment"
 * ====================
 *
 * The lab's exotic matter reserves are growing unchecked. Time to contain,
 * measure, and study them properly. EP5 activates the Tier-3 science
 * devices (EMC-001, QAN-001, QSM-001) and culminates in a deep anomaly
 * scan that reveals the lab's true relationship to the anomaly.
 *
 * Mechanic anchoring:
 *   Step 1 → flag `emc_001_online` (recipe claim for EMC-001 build)
 *   Step 2 → flag `quantum_pair_online` (M015 mission claim reward)
 *   Step 3 → flag `deep_scan_complete` (M016 mission claim reward)
 *   Step 4 → continue (narrative reveal; maps anomaly topology)
 */

import type { Episode } from "./types";

export const EP5: Episode = {
  id: "EP5",
  title: "Containment",
  synopsis:
    "Exotic matter accumulates in the corners. Three new devices will catch it, measure it, and show you what it actually is.",
  steps: [
    {
      id: "ep5.exotic_containment",
      objective: "Build EMC-001 (Exotic Matter Containment)",
      hint: "The EMC-001 recipe unlocks after ENDGAME_UNLOCKED + forge_mastered. Check the Lab.",
      voiceLines: [
        {
          voice: "fridge",
          text: "ENG LOG: EMC-001 SPEC — exotic matter containment vessel. Tier 3, Science track. 40W full load. Containment field rated to 25 EM units. previous containment method: hoping.",
        },
        {
          voice: "mcp",
          text: "Exotic matter has been accumulating in the corners of this lab like dust. This device catches it. The previous method was not catching it.",
        },
        {
          voice: "jade",
          text: "(in the margin) — the containment vessel does not hold exotic matter. it persuades it to stay.",
        },
      ],
      trigger: { kind: "flag", flag: "emc_001_online" },
      rewards: [
        { kind: "set_flag", flag: "ep5_emc_done", value: true },
        { kind: "set_resource_capacity", resourceId: "exotic_matter", capacity: 25 },
      ],
    },
    {
      id: "ep5.quantum_pair",
      objective: "Bring QAN-001 and QSM-001 online",
      hint: "Build the Quantum Analyzer first (80W), then the Quantum State Monitor (22W). Together they form an entangled measurement pair.",
      voiceLines: [
        {
          voice: "findr",
          text: "Two quantum things!! The analyzer is big and heavy and the monitor is small and nervous and together they are BEST FRIENDS!!",
        },
        {
          voice: "mcp",
          text: "The analyzer measures. The monitor observes. If the distinction seems trivial, wait until you try to swap them.",
        },
        {
          voice: "fridge",
          text: "ENG LOG: QAN-001 — 80W draw, Science track T2. QSM-001 — 22W draw, Quantum track T2. Total added bus load: 102W. Caution advised.",
        },
      ],
      trigger: { kind: "flag", flag: "quantum_pair_online" },
      rewards: [{ kind: "set_flag", flag: "ep5_quantum_done", value: true }],
    },
    {
      id: "ep5.deep_scan",
      objective: "Run a deep anomaly scan with all three science devices active",
      hint: "Complete the Deep Scan mission (M016). All three science devices must be operational.",
      voiceLines: [
        {
          voice: "mcp",
          text: "Three devices. One hundred and forty-two watts of combined draw. If this scan does not reveal something, I will be cross.",
        },
        {
          voice: "jade",
          text: "…the deep scan does not see the anomaly. the anomaly sees the deep scan. the difference matters.",
        },
        {
          voice: "system",
          text: "[ SCAN ] initiating deep anomaly analysis · 3-device triangulation · ETA: 30s",
        },
      ],
      trigger: { kind: "flag", flag: "deep_scan_complete" },
      rewards: [
        { kind: "set_flag", flag: "ep5_scan_done", value: true },
        { kind: "grant_resource", resourceId: "exotic_matter", amount: 5 },
        { kind: "grant_resource", resourceId: "research", amount: 10 },
      ],
    },
    {
      id: "ep5.breakthrough",
      objective: "Analyze the scan results",
      voiceLines: [
        {
          voice: "system",
          text: "[ SCAN ] anomaly topology mapped · 7 dimensional axes confirmed · non-local carrier identified",
        },
        {
          voice: "mcp",
          text: "The scan returned something I was not expecting. The anomaly is not in the lab. The lab is in the anomaly. We are inside it. We have always been inside it.",
        },
        {
          voice: "jade",
          text: "(in the margin) — i suspected this. the lab was never built to study anomalies. it was built by one.",
        },
        {
          voice: "findr",
          text: "…wait. WAIT. does that mean WE are the experiment?? are WE the thing in the jar?? …this is the best day of my LIFE!",
        },
      ],
      trigger: { kind: "continue" },
      rewards: [
        { kind: "set_flag", flag: "anomaly_topology_mapped", value: true },
        { kind: "set_resource_capacity", resourceId: "antimatter", capacity: 10 },
      ],
    },
  ],
  completionRewards: [{ kind: "set_flag", flag: "ep5_complete", value: true }],
  nextEpisode: "EP6",
};

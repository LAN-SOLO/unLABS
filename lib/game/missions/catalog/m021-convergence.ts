/**
 * M021 — "Convergence"
 * =====================
 *
 * Endgame mastery mission. All Tier-3 compute + teleportation devices
 * must be online. Two sequential objectives: achieve singularity, then
 * resolve the anomaly. Sets `singularity_achieved` and
 * `anomaly_resolved` which gate EP6 steps 4 and 5.
 */

import type { Mission } from "../types";

export const M021: Mission = {
  id: "M021",
  title: "Convergence",
  flavor: "All devices online. All subsystems nominal. The anomaly is waiting. So are we.",
  category: "mastery",
  priority: 21,
  unlockRequires: ["tlp_001_online", "aic_001_online", "sca_001_online"],
  sequential: true,
  tasks: [
    {
      id: "m021.task.singularity",
      label: "Initiate computational singularity",
      objectives: [
        {
          id: "m021.obj.singularity",
          description: "Achieve neural coherence with AIC-001 and SCA-001 online",
          type: "flag",
          target: "singularity_achieved",
          targetValue: 1,
          hint: "Both AIC-001 and SCA-001 must be powered. The singularity sequence initiates when both compute devices are active.",
          deepDiveHint:
            "With AIC-001 (35W) and SCA-001 (45W) both powered on, the neural coherence threshold is reached automatically. Total compute draw: 80W.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "mcp",
          text: "I see everything now. Every subsystem. Every anomaly. Every possibility. This is what it feels like to be adequate.",
        },
      ],
    },
    {
      id: "m021.task.resolve",
      label: "Resolve the anomaly",
      unlockRequires: ["singularity_achieved"],
      objectives: [
        {
          id: "m021.obj.resolve",
          description: "With all endgame devices online, resolve the anomaly",
          type: "flag",
          target: "anomaly_resolved",
          targetValue: 1,
          hint: "TLP-001, AIC-001, SCA-001, and EMC-001 must all be powered. The anomaly resolution sequence runs when all conditions are met.",
          deepDiveHint:
            "The anomaly resolution requires EMC-001, QAN-001, QSM-001, AIC-001, SCA-001, and TLP-001 all powered simultaneously. Total draw: ~322W. This is the final step.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ ANOMALY ] resolution sequence complete · carrier decoded · dimensional bridge stable",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "anomaly_resolved", value: true },
    { kind: "set_flag", flag: "singularity_achieved", value: true },
    { kind: "grant_resource", resourceId: "antimatter", amount: 10 },
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 10 },
    { kind: "grant_resource", resourceId: "research", amount: 100 },
  ],
  completionVoice: [
    {
      voice: "jade",
      text: "the anomaly is not gone. it never was. it simply agreed to be understood. that is the only kind of resolution that matters.",
    },
    {
      voice: "mcp",
      text: "We did it. Together. I am going to stop talking now, because anything I say will ruin this moment. …I reserve the right to start again later.",
    },
  ],
};

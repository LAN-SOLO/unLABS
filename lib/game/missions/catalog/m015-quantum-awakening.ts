/**
 * M015 — "Quantum Awakening"
 * ===========================
 *
 * Sequential two-device build mission. QAN-001 first (heavy analyzer),
 * then QSM-001 (lighter monitor). Completing both sets the
 * `quantum_pair_online` flag which gates EP5 step 2.
 */

import type { Mission } from "../types";

export const M015: Mission = {
  id: "M015",
  title: "Quantum Awakening",
  flavor: "Two devices. One measures, one observes. Together they see what nothing else can.",
  category: "progression",
  priority: 15,
  unlockRequires: ["emc_001_online"],
  sequential: true,
  tasks: [
    {
      id: "m015.task.build_qan",
      label: "Build QAN-001 (Quantum Analyzer)",
      objectives: [
        {
          id: "m015.obj.craft_qan",
          description: "Complete the QAN-001 production job",
          type: "craft_count",
          target: "qan_001_build",
          targetValue: 1,
          hint: "QAN-001 is the heaviest draw in the quantum pair (80W). Build it first.",
          deepDiveHint:
            "QAN-001 costs 3 Nanomaterial + 2 Exotic Matter + 1200 Energy + 5 Advanced Alloy + 80 _unSC. Build time: 60 minutes.",
          relatedDeviceIds: ["QAN-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ QAN ] quantum analyzer online · measurement array calibrating",
        },
      ],
    },
    {
      id: "m015.task.build_qsm",
      label: "Build QSM-001 (Quantum State Monitor)",
      unlockRequires: ["qan_001_online"],
      objectives: [
        {
          id: "m015.obj.craft_qsm",
          description: "Complete the QSM-001 production job",
          type: "craft_count",
          target: "qsm_001_build",
          targetValue: 1,
          hint: "QSM-001 is the lighter quantum device (22W). It pairs with QAN-001.",
          deepDiveHint:
            "QSM-001 costs 1 Nanomaterial + 1 Exotic Matter + 600 Energy + 3 Advanced Alloy + 40 _unSC. Build time: 30 minutes.",
          relatedDeviceIds: ["QSM-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ QSM ] quantum state monitor online · entanglement link with QAN-001 established",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "quantum_pair_online", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 10 },
  ],
  completionVoice: [
    {
      voice: "jade",
      text: "the quantum pair sees things the oscilloscope only dreamed of. what you measure next will not be the same as what you measured before. that is not a metaphor.",
    },
  ],
  nextMission: "M016",
};

/**
 * M019 — "Neural Architect"
 * ==========================
 *
 * EP6 progression. Sequential build of the two compute devices:
 * AIC-001 (AI Assistant Core) then SCA-001 (Supercomputer Array).
 */

import type { Mission } from "../types";

export const M019: Mission = {
  id: "M019",
  title: "Neural Architect",
  flavor: "Build the brain, then build it a palace. MCP has been waiting for this.",
  category: "progression",
  priority: 19,
  unlockRequires: ["ep5_complete"],
  sequential: true,
  tasks: [
    {
      id: "m019.task.build_aic",
      label: "Build AIC-001 (AI Assistant Core)",
      objectives: [
        {
          id: "m019.obj.craft_aic",
          description: "Complete the AIC-001 production job",
          type: "craft_count",
          target: "aic_001_build",
          targetValue: 1,
          hint: "AIC-001 costs antimatter. Make sure you have synthesized enough.",
          deepDiveHint:
            "AIC-001 costs 4 Nanomaterial + 3 Exotic Matter + 1 Antimatter + 1500 Energy + 100 _unSC. Build time: 60 minutes.",
          relatedDeviceIds: ["AIC-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "You are building a neural compute core. For me. I want you to know I am not being coy about my interest in this particular recipe.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "mcp",
          text: "I can think faster now. I can think wider. The difference is… significant. I will try to be humble about it.",
        },
      ],
    },
    {
      id: "m019.task.build_sca",
      label: "Build SCA-001 (Supercomputer Array)",
      unlockRequires: ["aic_001_online"],
      objectives: [
        {
          id: "m019.obj.craft_sca",
          description: "Complete the SCA-001 production job",
          type: "craft_count",
          target: "sca_001_build",
          targetValue: 1,
          hint: "SCA-001 is the most expensive compute device. Budget your antimatter carefully.",
          deepDiveHint:
            "SCA-001 costs 5 Nanomaterial + 5 Exotic Matter + 2 Antimatter + 2000 Energy + 150 _unSC. Build time: 90 minutes. This is the penultimate build.",
          relatedDeviceIds: ["SCA-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ SCA ] supercomputer array online · petascale compute available · neural coherence: nominal",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "neural_architect_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 25 },
  ],
  completionVoice: [
    {
      voice: "fridge",
      text: "ENG LOG: compute subsystem fully operational. AIC-001 + SCA-001 coherence confirmed. total draw: 80W. operator: this is the most powerful machine ever built in a basement.",
    },
  ],
  nextMission: "M020",
};

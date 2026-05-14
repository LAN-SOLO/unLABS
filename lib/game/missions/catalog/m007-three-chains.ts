/**
 * M007 — "Three Chains"
 * =====================
 *
 * Phase 3 kick-off. Walks the operator through building the three
 * production-chain devices (SMT-01, CND-01, MIX-01) that unlock the
 * standard manifold. Each recipe sets a flag on claim; missions unlock
 * sequentially based on those flags.
 */

import type { Mission } from "../types";

export const M007: Mission = {
  id: "M007",
  title: "Three Chains",
  flavor: "The lab has produced one of everything. Now it needs to produce everything, at once.",
  category: "progression",
  priority: 7,
  unlockRequires: ["missions_unlocked"],
  sequential: true,
  tasks: [
    {
      id: "m007.task.smelter",
      label: "Build the Smelter (SMT-01)",
      objectives: [
        {
          id: "m007.obj.craft_smelter",
          description: "Claim the Smelter build job",
          type: "craft_count",
          target: "smt_01_build",
          targetValue: 1,
          hint: "The Smelter recipe unlocks once missions are active. Open the Lab.",
          deepDiveHint:
            "SMT-01 costs 15 Abstractum + 100 Energy + 10 _unSC. 180 seconds. Claiming it permanently raises your Abstractum rate by 2/min (above the base 1/min).",
          relatedDeviceIds: ["SMT-01"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "fridge",
          text: "ENG LOG: SMT-01 online. intake manifold stable. operator discretion advised.",
        },
      ],
    },
    {
      id: "m007.task.condenser",
      label: "Build the Condenser (CND-01)",
      unlockRequires: ["smt_01_online"],
      objectives: [
        {
          id: "m007.obj.craft_condenser",
          description: "Claim the Condenser build job",
          type: "craft_count",
          target: "cnd_01_build",
          targetValue: 1,
          hint: "CND-01 unlocks once the Smelter is online.",
          deepDiveHint:
            "CND-01 costs 15 Abstractum + 150 Energy + 10 _unSC. 180 seconds. Raises your energy capacity from 500 to 750 on claim.",
          relatedDeviceIds: ["CND-01"],
        },
      ],
    },
    {
      id: "m007.task.mixer",
      label: "Build the Mixer (MIX-01)",
      unlockRequires: ["cnd_01_online"],
      objectives: [
        {
          id: "m007.obj.craft_mixer",
          description: "Claim the Mixer build job",
          type: "craft_count",
          target: "mix_01_build",
          targetValue: 1,
          hint: "MIX-01 unlocks once the Condenser is online.",
          deepDiveHint:
            "MIX-01 costs 20 Abstractum + 200 Energy + 2 Base Alloy + 10 _unSC. 240 seconds. Completes the 'three chains' flag that gates Nexus build.",
          relatedDeviceIds: ["MIX-01"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "mcp",
          text: "Three chains. A real production manifold. The lab can now make more things per hour than it used to make in a week.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "three_chains_mission_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 2 },
  ],
  completionVoice: [
    {
      voice: "jade",
      text: "the smelter hums in C-sharp. the condenser hums in F. the mixer refuses to hum. it considers itself a soloist.",
    },
  ],
  nextMission: "M008",
};

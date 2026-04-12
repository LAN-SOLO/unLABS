/**
 * M005 — "Reactor Genesis"
 * ========================
 *
 * Major progression milestone. The player builds the Microfusion Reactor
 * (MFR-001), which is the game's answer to the energy bottleneck. This
 * mission is chained from M002 ("The Forge Awakens").
 */

import type { Mission } from "../types";

export const M005: Mission = {
  id: "M005",
  title: "Reactor Genesis",
  flavor: "The energy crisis has an answer. It weighs 400 kilograms and glows faintly blue.",
  category: "progression",
  priority: 5,
  unlockRequires: ["missions_unlocked", "anomaly_mode", "forge_mastered"],
  sequential: true,
  tasks: [
    {
      id: "m005.task.build_mfr",
      label: "Build MFR-001",
      objectives: [
        {
          id: "m005.obj.craft_mfr",
          description: "Complete the MFR-001 production job",
          type: "craft_count",
          target: "mfr_001_build",
          targetValue: 1,
          hint: "The Microfusion Reactor recipe is in the Lab. It costs 120 Abstractum, 50 Energy, and 25 _unSC.",
          deepDiveHint:
            'Navigate to the Lab and start the "Microfusion Reactor (MFR-001)" job. It requires 120 Abstractum, 50 Energy, and 25 _unSC. The job takes 15 minutes (900 seconds). Once complete, claim the job to bring MFR-001 online. This permanently boosts your energy capacity to 2500 and rate to 250 E/s.',
          relatedDeviceIds: ["MFR-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "fridge",
          text: "MFR-001 SPEC: Microfusion reactor. T2 power plant. Output: 250 E/s sustained. Containment: active-passive hybrid. Failure mode: do not ask.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ MFR ] reactor online · output: 250 E/s · containment nominal",
        },
        {
          voice: "mcp",
          text: "Two hundred and fifty energy per second. I have not felt this comfortable since the day the original team turned on the lights.",
        },
      ],
    },
    {
      id: "m005.task.observe_rate",
      label: "Confirm energy surplus",
      objectives: [
        {
          id: "m005.obj.energy_above_200",
          description: "Observe energy rate above 200 E/s",
          type: "resource_threshold",
          target: "energy",
          targetValue: 200,
          hint: "Check your energy rate in the resource bar. MFR-001 should push it well above 200.",
          deepDiveHint:
            "After claiming the MFR-001 job, your energy generation rate should jump to 250 E/s. Look at the energy resource bar at the top of the panel — the rate should be visible. If it shows lower, some devices may be drawing heavy power.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "reactor_online", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 10 },
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 1 },
  ],
  completionVoice: [
    {
      voice: "jade",
      text: "the reactor hums in E-flat. it always did. the anomalies like that note. pay attention to what happens next.",
    },
  ],
};

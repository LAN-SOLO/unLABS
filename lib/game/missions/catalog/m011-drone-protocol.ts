/**
 * M011 — "Drone Protocol"
 * =======================
 *
 * Phase 4 centerpiece. Unlocking the Explorer Drone protocol jumps the
 * passive Abstractum rate from 3/min to 20/min — the first time the idle
 * loop goes from "adequate" to "meaningful". Shares a flag with EP3.2 so
 * either path satisfies both.
 *
 * Three beats: fund the research, unlock the protocol, then actually fly
 * the drone and watch the new rate fill the reserve.
 */

import type { Mission } from "../types";

export const M011: Mission = {
  id: "M011",
  title: "Drone Protocol",
  flavor: "Autonomous prospecting. The drones choose where to drill. They are not telling you how.",
  category: "progression",
  priority: 11,
  unlockRequires: ["research_started"],
  tasks: [
    {
      id: "m011.task.groundwork",
      label: "Fund the expedition",
      objectives: [
        {
          id: "m011.obj.forge_stock",
          description: "Reach a lifetime total of 7 Base Alloy Ingots",
          type: "craft_count",
          target: "base_alloy_ingot",
          targetValue: 7,
          hint: "The drone research eats 4 Base Alloy. Keep the smelter busy so the cost does not hurt.",
          deepDiveHint:
            "You need 7 claimed Base Alloy Ingot jobs in total (earlier runs count). The Explorer Drone Protocol costs 4 Base Alloy + 600 Energy + 30 _unSC — crafting past the minimum leaves alloy in storage for whatever the tree demands next.",
          relatedDeviceIds: ["SMT-01"],
        },
        {
          id: "m011.obj.energy_headroom",
          description: "Bank 600 Energy for the research burn",
          type: "resource_threshold",
          target: "energy",
          targetValue: 600,
          hint: "The protocol burns 600 Energy at start. Your Condenser capacity (750) covers it — barely.",
          deepDiveHint:
            "Energy costs are paid up front when a research job starts. With CND-01's 750-unit capacity, 600 banked means powering down non-essential devices for a few minutes. Energy Cells (+100 each) can bridge the gap.",
          relatedDeviceIds: ["CND-01"],
        },
        {
          id: "m011.obj.drone_specs",
          description: "Review the drone with `exd`",
          type: "command",
          target: "exd",
          targetValue: 1,
          hint: "Type `exd` (alias `drone`) in the terminal to see EXD-001's spec sheet and status.",
          deepDiveHint:
            "`exd` prints the Explorer Drone's state, firmware, and power draw; `exd status` for the long form. Read the spec before you pay for the protocol — it is the heaviest field unit the lab owns.",
          relatedDeviceIds: ["EXD-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "The drones prospect autonomously. Four base alloy, six hundred energy, and they will find Abstractum veins nobody surveyed. I asked how they choose the drill sites. The firmware declined to comment.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "fridge",
          text: "ENG LOG: expedition budget secured. alloy stocked, energy banked, EXD-001 pre-flight sheet reviewed. cleared for protocol upload.",
        },
      ],
    },
    {
      id: "m011.task.unlock",
      label: "Unlock 'tools.explorer_drone.t2'",
      objectives: [
        {
          id: "m011.obj.drone_unlocked",
          description: "Claim the Explorer Drone Protocol research",
          type: "flag",
          target: "research_explorer_drone",
          targetValue: 1,
          hint: "Prereqs: Alloy Efficiency (Refine T1) AND Seep Tap (Tools T1). Chain them in the Nexus.",
          deepDiveHint:
            "'tools.explorer_drone.t2' takes 15 minutes to research. Costs 4 Base Alloy + 600 Energy + 30 _unSC. On claim, Abstractum rate jumps to 20/min permanently.",
          relatedDeviceIds: ["NXS-01", "EXD-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ EXD ] protocol upload complete · autonomous prospecting firmware v3.1.2 armed",
        },
      ],
    },
    {
      id: "m011.task.first_flight",
      label: "First deployment",
      objectives: [
        {
          id: "m011.obj.deploy",
          description: "Deploy the drone with `exd deploy`",
          type: "command",
          target: "exd deploy",
          targetValue: 1,
          hint: "Power EXD-001 on, then run `exd deploy` to send it into the field.",
          deepDiveHint:
            "The drone must be online and docked: power it on from the panel (or `exd power on`), then `exd deploy`. If it reports 'already deployed', run `exd recall` first and launch again. `exd status` shows the flight state at any time.",
          relatedDeviceIds: ["EXD-001"],
        },
        {
          id: "m011.obj.seep_surge",
          description: "Bank 80 Abstractum on the new drone rate",
          type: "resource_threshold",
          target: "abstractum",
          targetValue: 80,
          hint: "At 20/min the reserve climbs visibly. Let it run — 80 is minutes away, not hours.",
          deepDiveHint:
            "Post-protocol, Abstractum flows at 20/min — from empty to 80 in four minutes of not spending. Your storage caps at 100 until the Adapters tree raises it, so 80 is deliberately close to full: feel the ceiling. That is your next bottleneck.",
          relatedDeviceIds: ["EXD-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "jade",
          text: "the drones hum when they find a vein. nobody programmed that. I checked.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "drone_protocol_mission_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 3 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Twenty Abstractum per minute. The previous operator would have wept. You should at least smile a little.",
    },
  ],
  nextMission: "M012",
};

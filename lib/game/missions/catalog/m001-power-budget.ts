/**
 * M001 — "Power Budget"
 * =====================
 *
 * First mission after EP1. Teaches the player that energy is a finite
 * resource: craft an energy cell, craft an alloy, and watch your rate
 * dip as devices draw more power.
 */

import type { Mission } from "../types";

export const M001: Mission = {
  id: "M001",
  title: "Power Budget",
  flavor: "Energy flows freely — until it does not. Learn to spend before you are spent.",
  category: "onboarding",
  priority: 1,
  unlockRequires: ["missions_unlocked"],
  tasks: [
    {
      id: "m001.task.energy_cell",
      label: "Craft an Energy Cell",
      objectives: [
        {
          id: "m001.obj.craft_energy_cell",
          description: "Craft 1 Energy Cell",
          type: "craft_count",
          target: "energy_cell",
          targetValue: 1,
          hint: "Open the Lab (production panel) and start an Energy Cell job.",
          deepDiveHint:
            'Navigate to the Lab tab. The Energy Cell recipe costs 3 Abstractum and takes 30 seconds. Click "Start" to begin the job, then claim it when the timer completes.',
        },
      ],
    },
    {
      id: "m001.task.alloy",
      label: "Craft a Base Alloy Ingot",
      objectives: [
        {
          id: "m001.obj.craft_alloy",
          description: "Craft 1 Base Alloy Ingot",
          type: "craft_count",
          target: "base_alloy_ingot",
          targetValue: 1,
          hint: "Base Alloy Ingots cost Abstractum, Energy, and 1 _unSC.",
          deepDiveHint:
            "The Base Alloy Ingot recipe requires 5 Abstractum, 60 Energy, and 1 _unSC. It takes 90 seconds. This is the workhorse material for everything you will build.",
        },
      ],
    },
    {
      id: "m001.task.power_awareness",
      label: "Observe energy pressure",
      objectives: [
        {
          id: "m001.obj.energy_rate_dip",
          description: "Let energy rate drop below 40 E/s",
          type: "resource_threshold",
          target: "energy",
          targetValue: 40,
          hint: "Powering on devices reduces your net energy rate. Try enabling more equipment.",
          deepDiveHint:
            "Your current energy rate is +32 E/s after OSC-001 came online. Power on additional devices from the panel — each one draws power and reduces your net rate. Watch the energy bar to see the effect.",
          relatedDeviceIds: ["UEC-001", "OSC-001"],
        },
      ],
    },
  ],
  rewards: [
    { kind: "grant_resource", resourceId: "energy", amount: 50 },
    { kind: "set_flag", flag: "missions_power_budget", value: true },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "You have now experienced the first law of this lab: everything costs energy, and energy costs patience.",
    },
  ],
};

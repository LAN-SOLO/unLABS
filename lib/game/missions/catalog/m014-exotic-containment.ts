/**
 * M014 — "Exotic Containment"
 * ============================
 *
 * First EP5 mission. Guides the player to build EMC-001, which unlocks
 * exotic matter storage and the entire Tier-3 science chain.
 *
 * Three beats: provision the expensive build, run it, then prove the
 * vessel works by crystallizing the first exotic matter inside it.
 */

import type { Mission } from "../types";

export const M014: Mission = {
  id: "M014",
  title: "Exotic Containment",
  flavor: "Exotic matter has been pooling in the lab's corners. Time to give it a proper home.",
  category: "progression",
  priority: 14,
  unlockRequires: ["ENDGAME_UNLOCKED"],
  sequential: false,
  tasks: [
    {
      id: "m014.task.provision",
      label: "Provision the build",
      objectives: [
        {
          id: "m014.obj.nano_supply",
          description: "Claim 2 Nanomaterial Blocks",
          type: "craft_count",
          target: "nanomaterial_block",
          targetValue: 2,
          hint: "EMC-001 consumes 2 Nanomaterial. The block recipe is slow — start it before you need it.",
          deepDiveHint:
            "Each Nanomaterial Block costs 3 Advanced Alloy + 400 Energy + 10 _unSC and takes 30 minutes. Two blocks means a full hour of fabricator time — or half that once the Refine tree's Nanomaterial Catalyst is claimed. The Optics tree can also print Nanomaterial passively.",
        },
        {
          id: "m014.obj.exotic_reserve",
          description: "Hold 2 Exotic Matter in reserve",
          type: "resource_threshold",
          target: "exotic_matter",
          targetValue: 2,
          hint: "The build wants 3 Exotic Matter. Base storage caps at 5 — resonances and the Synthesizers tree fill it.",
          deepDiveHint:
            "Pre-containment, exotic matter only trickles in: resonance protocol rewards, mission claims, and 'synthesizers.slice_compiler.t1' (grants 2 on claim). You need 3 on hand for the build itself; keeping the reserve at 2+ afterwards is what the crystal recipe in this mission's finale is for.",
          relatedDeviceIds: ["EMC-001"],
        },
        {
          id: "m014.obj.power_buffer",
          description: "Bank 800 Energy for the containment field",
          type: "resource_threshold",
          target: "energy",
          targetValue: 800,
          hint: "The build burns 800 Energy at start. With MFR-001 online that is seconds of surplus.",
          deepDiveHint:
            "EMC-001's job bills 800 Energy up front and the finished vessel draws 40 W continuously. MFR-001's +250 E/s refills the bank almost instantly — if your rate is lower, shed idle devices until the bank holds 800.",
          relatedDeviceIds: ["MFR-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "Exotic matter does not respect the floor, the shelving, or — on one memorable occasion — the third dimension. We are building it a container. Gather the materials before it gathers itself.",
        },
      ],
    },
    {
      id: "m014.task.build_emc",
      label: "Build EMC-001",
      objectives: [
        {
          id: "m014.obj.craft_emc",
          description: "Complete the EMC-001 production job",
          type: "craft_count",
          target: "emc_001_build",
          targetValue: 1,
          hint: "The EMC-001 recipe appears in the Lab after ENDGAME_UNLOCKED + forge_mastered.",
          deepDiveHint:
            "EMC-001 costs 2 Nanomaterial + 3 Exotic Matter + 800 Energy + 50 _unSC. Build time: 40 minutes. On claim, exotic matter capacity jumps from 5 to 25.",
          relatedDeviceIds: ["EMC-001"],
        },
        {
          id: "m014.obj.vessel_check",
          description: "Inspect the vessel with `emc`",
          type: "command",
          target: "emc",
          targetValue: 1,
          hint: "Run `emc` (alias `containment`) in the terminal to read the containment field telemetry.",
          deepDiveHint:
            "`emc` reports field strength, stability, temperature, and stored units; `emc status` gives the long form. A containment vessel you never inspect is just a very expensive box of hope.",
          relatedDeviceIds: ["EMC-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "fridge",
          text: "ENG LOG: EMC-001 online. containment field stable. exotic matter capacity: 25 units. the lab can now hold what it used to merely observe.",
        },
      ],
    },
    {
      id: "m014.task.first_crystal",
      label: "Crystallize the first batch",
      objectives: [
        {
          id: "m014.obj.first_crystal",
          description: "Claim 1 Exotic Matter Crystal",
          type: "craft_count",
          target: "exotic_matter_crystal",
          targetValue: 1,
          hint: "The crystal recipe unlocks with EMC-001 online. One crystal yields 2 exotic matter — the vessel pays for itself.",
          deepDiveHint:
            "Exotic Matter Crystal: 1 Nanomaterial + 1,000 Energy + 2 Advanced Alloy + 15 _unSC, 40 minutes, yields 2 Exotic Matter. This is the lab's first *manufactured* exotic matter — everything before now was scavenged from resonances.",
          relatedDeviceIds: ["EMC-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ EMC ] crystallization cycle complete · 2 units condensed · containment holding at 95%",
        },
        {
          voice: "jade",
          text: "the first crystal is always cloudy. the lab keeps a little of it for itself. let it.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "exotic_containment_claimed", value: true },
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 2 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Exotic matter has a home now. A proper home, not a corner of the floor near the ventilation shaft. Standards, operator. Standards.",
    },
  ],
  nextMission: "M015",
};

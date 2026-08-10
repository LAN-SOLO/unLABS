/**
 * M018 — "Antimatter Protocol"
 * =============================
 *
 * Exploration mission. Unlocks after EP5's anomaly topology is mapped.
 * Teaches the antimatter vial recipe and builds a reserve for EP6 device
 * builds.
 *
 * Task 1 is the synthesis run (vials plus the exotic-matter and energy
 * feed they consume); task 2 is the reserve — which, at three units,
 * quietly demands the Synthesizers T4 lattice or a legendary resonance.
 */

import type { Mission } from "../types";

export const M018: Mission = {
  id: "M018",
  title: "Antimatter Protocol",
  flavor:
    "The anomaly topology is mapped. The antimatter recipe is no longer theoretical. Handle with care.",
  category: "exploration",
  priority: 18,
  unlockRequires: ["anomaly_topology_mapped"],
  sequential: false,
  tasks: [
    {
      id: "m018.task.vials",
      label: "Synthesize antimatter",
      objectives: [
        {
          id: "m018.obj.craft_vials",
          description: "Craft 2 Antimatter Vials",
          type: "craft_count",
          target: "antimatter_vial",
          targetValue: 2,
          hint: "The antimatter recipe unlocks after the anomaly topology is mapped. Each vial yields 1 antimatter.",
          deepDiveHint:
            "Each vial costs 4 Exotic Matter + 1500 Energy + 2 Nanomaterial + 25 _unSC. Build time: 60 minutes per vial. You need antimatter for all EP6 device builds.",
          relatedDeviceIds: ["EMC-001"],
        },
        {
          id: "m018.obj.exotic_feed",
          description: "Hold 8 Exotic Matter to feed the trap",
          type: "resource_threshold",
          target: "exotic_matter",
          targetValue: 8,
          hint: "Two vials devour 8 Exotic Matter. Keep the crystal line running while the vials cook.",
          deepDiveHint:
            "Each vial consumes 4 Exotic Matter at start, so the pair costs 8 up front. Refill mid-run with Exotic Matter Crystals (2 per claim) or the Synthesizers tree's grants; TLP-001, once built, drips 1/min passively. A synthesis chain that outruns its own feedstock is the mark of a mature lab.",
          relatedDeviceIds: ["EMC-001"],
        },
        {
          id: "m018.obj.energy_wall",
          description: "Bank 1,500 Energy for the magnetic trap",
          type: "resource_threshold",
          target: "energy",
          targetValue: 1500,
          hint: "The vial job bills 1,500 Energy at start — more than half your reactor-era bank.",
          deepDiveHint:
            "1,500 Energy per vial, paid up front, on top of the science array's continuous draw. MFR-001's +250 E/s refills the bank in under a minute of restraint; the Devices tree (Substrate Foundry 2,500, Singularity Housing 4,000) buys margin if the wall keeps arriving.",
          relatedDeviceIds: ["MFR-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "fridge",
          text: "ENG LOG: antimatter synthesis authorization. one microgram antihydrogen per vial, magnetic suspension, zero contact tolerance. safety note reads, in full: 'do not'. proceed.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ EMC ] vial synthesis complete · trap field nominal · annihilation events: zero (preferred)",
        },
      ],
    },
    {
      id: "m018.task.hold",
      label: "Hold antimatter reserve",
      objectives: [
        {
          id: "m018.obj.am_threshold",
          description: "Hold 3 or more antimatter",
          type: "resource_threshold",
          target: "antimatter",
          targetValue: 3,
          hint: "Keep synthesizing vials until you hold at least 3 antimatter.",
          deepDiveHint:
            "Base antimatter containment caps at a single unit — holding three requires the Synthesizers T4 'Antimatter Lattice Seed' (capacity 25, plus a 0.1/min drip), the Gadgets T4 pocket watch (+3 on claim), or a legendary resonance. This objective is the catalog telling you, politely, to finish a T4 tree.",
          relatedDeviceIds: ["EMC-001"],
        },
        {
          id: "m018.obj.survey_protocols",
          description: "Survey the resonance catalog with `discoveries`",
          type: "command",
          target: "discoveries",
          targetValue: 1,
          hint: "Run `discoveries` in the terminal — some resonance protocols pay out in antimatter.",
          deepDiveHint:
            "`discoveries` lists every catalogued resonance protocol and how many remain hidden. The legendary tier rewards antimatter directly: Fridge's thermal logs and the lab's own idle chatter hold the clues. Two of them are still out there for most operators.",
        },
        {
          id: "m018.obj.research_dividend",
          description: "Hold 100 or more Research points",
          type: "resource_threshold",
          target: "research",
          targetValue: 100,
          hint: "The endgame charges Research in three digits. The Science tree's passive rate gets you there.",
          deepDiveHint:
            "One hundred banked Research funds the deep Science and Adapters tiers (Hypothesis Engine alone costs 80). With Peer Simulation at 6/min the bank fills in a quarter hour; at Structured Inquiry's 2/min it is a long lunch. If neither is claimed yet, that is the actual objective.",
          relatedDeviceIds: ["NXS-01"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "mcp",
          text: "A standing antimatter reserve, a funded research ledger, and a resonance catalog you actually read. The lab is ready for whatever EP6 intends to do to us.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "antimatter_protocol_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 20 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Three units of antimatter, operator. The previous team spent four years and did not manage one. You are making this look easy, and I resent it slightly.",
    },
  ],
};

/**
 * M017 — "Exotic Synthesis"
 * ==========================
 *
 * Exploration mission. Teaches the exotic matter crystal recipe and
 * asks the player to stockpile for the endgame builds.
 *
 * Task 1 is the production side (crystals + the nanomaterial pipeline
 * that feeds them, accelerated by the Refine tree's catalyst — one of
 * the catalog's two research-flag gates). Task 2 is the stockpile.
 */

import type { Mission } from "../types";

export const M017: Mission = {
  id: "M017",
  title: "Exotic Synthesis",
  flavor:
    "The containment vessel can crystallize exotic matter. Do it three times, then hold on to the results.",
  category: "exploration",
  priority: 17,
  unlockRequires: ["emc_001_online"],
  sequential: false,
  tasks: [
    {
      id: "m017.task.crystals",
      label: "Synthesize exotic matter crystals",
      objectives: [
        {
          id: "m017.obj.craft_crystals",
          description: "Craft 3 Exotic Matter Crystals",
          type: "craft_count",
          target: "exotic_matter_crystal",
          targetValue: 3,
          hint: "The crystal recipe is available once EMC-001 is online. Each crystal yields 2 exotic matter.",
          deepDiveHint:
            "Each crystal costs 1 Nanomaterial + 1000 Energy + 2 Advanced Alloy + 15 _unSC. Build time: 40 minutes each. You need three to stockpile for endgame devices.",
          relatedDeviceIds: ["EMC-001"],
        },
        {
          id: "m017.obj.nano_pipeline",
          description: "Reach a lifetime total of 5 Nanomaterial Blocks",
          type: "craft_count",
          target: "nanomaterial_block",
          targetValue: 5,
          hint: "Every crystal eats a Nanomaterial. Keep the block fabricator running behind the synthesis line.",
          deepDiveHint:
            "Five claimed Nanomaterial Block jobs in total (earlier builds count). Each block costs 3 Advanced Alloy + 400 Energy + 10 _unSC and takes 30 minutes — 15 with the catalyst. The Optics tree's Photonic Lattice Printer eventually prints Nanomaterial passively; until then, this queue is the pipeline.",
        },
        {
          id: "m017.obj.catalyst",
          description: "Claim Nanomaterial Catalyst (refine.nanomaterial_catalyst.t3)",
          type: "flag",
          target: "research_nanomaterial_catalyst",
          targetValue: 1,
          hint: "Refine T3 halves Nanomaterial Block time. Synthesis at scale wants it claimed.",
          deepDiveHint:
            "'refine.nanomaterial_catalyst.t3' needs Power Condense (Refine T2) claimed first, costs 3 Advanced Alloy + 2000 Energy + 80 _unSC, and researches for 30 minutes. On claim, Nanomaterial Blocks fabricate in half the time — the difference between synthesis as an errand and synthesis as an industry.",
          relatedDeviceIds: ["NXS-01"],
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "Crystallized exotic matter. The containment vessel makes it, the endgame devices consume it, and the lab has formed an opinion about the middle step. The opinion is 'more'.",
        },
      ],
    },
    {
      id: "m017.task.stockpile",
      label: "Stockpile exotic matter",
      objectives: [
        {
          id: "m017.obj.em_threshold",
          description: "Hold 10 or more exotic matter",
          type: "resource_threshold",
          target: "exotic_matter",
          targetValue: 10,
          hint: "Keep crafting and collecting exotic matter from other sources until you hit 10.",
          deepDiveHint:
            "Ten units is 40% of EMC-001's 25-unit capacity. Sources: crystals (2 each), resonance protocols, the Synthesizers tree (Slice Compiler +2, Seed Crystal Vault +3, Deterministic Growth +6), and mission rewards. The endgame builds will drain this reserve fast — QAN wanted 2, the antimatter recipe wants 4 per vial.",
          relatedDeviceIds: ["EMC-001"],
        },
        {
          id: "m017.obj.vault_audit",
          description: "Audit the containment vessel with `emc status`",
          type: "command",
          target: "emc status",
          targetValue: 1,
          hint: "Run `emc status` and confirm the vessel is actually holding what the counter claims.",
          deepDiveHint:
            "`emc status` reports stored units, field strength, stability, and containment temperature. A ten-unit stockpile at low field stability is not a stockpile — it is a scheduled incident. Audit before you bank.",
          relatedDeviceIds: ["EMC-001"],
        },
        {
          id: "m017.obj.energy_reserve",
          description: "Hold 2,000 Energy alongside the synthesis line",
          type: "resource_threshold",
          target: "energy",
          targetValue: 2000,
          hint: "Each crystal bills 1,000 Energy at start. Two thousand banked means the queue never waits.",
          deepDiveHint:
            "Sustained synthesis means paying 1,000 Energy per crystal on top of the lab's continuous draw. With MFR-001 (+250 E/s, 2,500 cap) a 2,000-unit bank refills between jobs; the Devices tree's Substrate Foundry raises the ceiling to 2,500 if you keep bumping into it.",
          relatedDeviceIds: ["MFR-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "jade",
          text: "ten units, humming in their racks. the lab counts them at night. I used to think that was my imagination.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "exotic_synthesis_claimed", value: true },
    { kind: "grant_resource", resourceId: "antimatter", amount: 1 },
  ],
  completionVoice: [
    {
      voice: "findr",
      text: "TEN exotic matters!! that is SO MANY!! you are basically a wizard now!! a SCIENCE wizard!!",
    },
  ],
};

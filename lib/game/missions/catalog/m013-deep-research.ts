/**
 * M013 — "Deep Research"
 * ======================
 *
 * Phase 5 mastery beat. Requires the player to reach any T3 node — the
 * first genuinely long-horizon research commitment. Checks for the
 * `pick_path_deep` flag set by the observer when unlocked contains ≥ 1
 * T2+ node in ≥ 2 trees (matches EP4.2 semantics).
 *
 * The refine-side T2 (Power Condense → `research_power_condense`) is
 * required explicitly: it is the straight-line route the hints already
 * recommend, and one of the two research-flag gates the mission catalog
 * allows itself.
 */

import type { Mission } from "../types";

export const M013: Mission = {
  id: "M013",
  title: "Deep Research",
  flavor: "The tree fans out. Depth costs time. Breadth costs attention. Pay something.",
  category: "mastery",
  priority: 13,
  unlockRequires: ["pick_path_done"],
  tasks: [
    {
      id: "m013.task.depth",
      label: "Reach T2 research in two different trees",
      objectives: [
        {
          id: "m013.obj.deep",
          description: "Hold ≥ 1 T2+ node unlocked in each of 2 trees",
          type: "flag",
          target: "pick_path_deep",
          targetValue: 1,
          hint: "The tools.explorer_drone.t2 + refine.power_condense.t2 pair is the straight-line route.",
          deepDiveHint:
            "Power Condense needs Alloy Efficiency (Refine T1). Explorer Drone needs Seep Tap (Tools T1) AND Alloy Efficiency (cross-tree prereq). You end up touching three nodes plus the two T2 targets — about 30 minutes of research time total.",
          relatedDeviceIds: ["NXS-01"],
        },
        {
          id: "m013.obj.power_condense",
          description: "Claim Power Condense (refine.power_condense.t2)",
          type: "flag",
          target: "research_power_condense",
          targetValue: 1,
          hint: "The Condenser upgrade: energy capacity to 1,500. Refine T2, 15 minutes, worth every one of them.",
          deepDiveHint:
            "'refine.power_condense.t2' costs 5 Base Alloy + 800 Energy + 25 _unSC and needs Alloy Efficiency claimed first. The 800-Energy start cost wants a big bank — bring MFR-001 online (or drain everything else) before you press start. On claim, energy capacity jumps to 1,500.",
          relatedDeviceIds: ["NXS-01", "CND-01"],
        },
        {
          id: "m013.obj.energy_bank",
          description: "Bank 700 Energy for the deep runs",
          type: "resource_threshold",
          target: "energy",
          targetValue: 700,
          hint: "T2 research bills its energy up front. Fill the bank before you start the timer.",
          deepDiveHint:
            "Power Condense burns 800 Energy at start, Explorer Drone 600. With CND-01's 750 cap you can barely fund one; MFR-001 (2,500 cap, +250 E/s) makes the whole tier trivial. 700 banked proves you can hold a charge under load.",
          relatedDeviceIds: ["CND-01", "MFR-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "Tier two is where research stops being a hobby. The timers run in quarter hours and the invoices arrive in alloy. Commit to two branches. The tree remembers who finishes things.",
        },
      ],
    },
    {
      id: "m013.task.compound",
      label: "Compound the gains",
      objectives: [
        {
          id: "m013.obj.alloy_tuition",
          description: "Reach a lifetime total of 5 Advanced Alloy Ingots",
          type: "craft_count",
          target: "advanced_alloy_ingot",
          targetValue: 5,
          hint: "Tier-3 nodes bill in Advanced Alloy. Forge ahead of the invoice.",
          deepDiveHint:
            "Five claimed Advanced Alloy Ingot jobs in total (your M012 ingots count). Drone Swarm wants 2, Nanomaterial Catalyst 3, Resonance Harvester 4 — the T3 tier is an Advanced Alloy economy and you are its supplier.",
          relatedDeviceIds: ["SMT-01", "MIX-01"],
        },
        {
          id: "m013.obj.knowledge_stock",
          description: "Hold 20 or more Research points",
          type: "resource_threshold",
          target: "research",
          targetValue: 20,
          hint: "Deep trees pay Research back — Ledger Attestation +10, Quantum Compass +25. Bank twenty.",
          deepDiveHint:
            "If the reserve will not climb, buy the printing press: 'science.structured_inquiry.t1' costs 10 Research + 40 Abstractum and then generates 2 Research per minute forever. Twenty in the bank funds the Adapters ladder without pausing.",
        },
        {
          id: "m013.obj.audit_tree",
          description: "Audit your progress with `research list`",
          type: "command",
          target: "research list",
          targetValue: 1,
          hint: "Run `research list` and read the whole board: claimed, running, still locked.",
          deepDiveHint:
            "`research list` prints every node with its status and ETA — the terminal's flat view of the same graph `nexus` projects. A mastery-tier operator knows the state of all eight columns without opening the hologram.",
          relatedDeviceIds: ["NXS-01"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "fridge",
          text: "ENG LOG: two branches at T2 depth. alloy pipeline ahead of demand. research ledger positive. lab classified: research facility (again, finally).",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "deep_research_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 5 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Two tiers, two branches. This is what the original team called 'a week'. You did it in an afternoon. The lab likes that about you.",
    },
  ],
};

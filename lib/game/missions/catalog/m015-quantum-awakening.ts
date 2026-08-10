/**
 * M015 — "Quantum Awakening"
 * ===========================
 *
 * Sequential build mission. QAN-001 first (heavy analyzer), then QSM-001
 * (lighter monitor), then the pair is phase-locked over the terminal
 * bridge. Completing both builds sets the `quantum_pair_online` flag
 * which gates EP5 step 2.
 *
 * The finale's `qbridge sync` doubles as the trigger step of the
 * ENTANGLE-ALPHA resonance protocol — players who follow the mission with
 * both devices powered discover it "by accident", exactly as Jade's
 * day112 notes promise.
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
        {
          id: "m015.obj.pair_lore",
          description: "Read Jade's day 112 notes",
          type: "command",
          target: "cat /unvar/log/jade/day112.txt",
          targetValue: 1,
          hint: "Jade wrote about the quantum pair. Her notes live in /unvar/log/jade/ — day 112.",
          deepDiveHint:
            "Run: cat /unvar/log/jade/day112.txt — she claims the quantum devices 'remember each other', and describes powering both and bridging them. Whatever she means by that, you are about to build the two devices she was talking about.",
        },
        {
          id: "m015.obj.qan_power",
          description: "Bank 1,200 Energy for the analyzer build",
          type: "resource_threshold",
          target: "energy",
          targetValue: 1200,
          hint: "The QAN job bills 1,200 Energy at start. Let MFR-001 fill the bank before you press start.",
          deepDiveHint:
            "1,200 Energy needs at least the Power Condense capacity (1,500) or MFR-001's 2,500. At +250 E/s the reactor fills the requirement in seconds; on a lesser rate, power down idle heavy devices — the analyzer will draw 80 W all by itself soon enough.",
          relatedDeviceIds: ["MFR-001", "QAN-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "The Quantum Analyzer measures states with a precision the universe finds impolite. Jade left notes about this pair. I have read them twice and understood them once — briefly.",
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
        {
          id: "m015.obj.monitor_check",
          description: "Read the monitor's telemetry with `qsm`",
          type: "command",
          target: "qsm",
          targetValue: 1,
          hint: "Run `qsm` (alias `qubit`) to see coherence, qubit count, and entanglement status.",
          deepDiveHint:
            "`qsm` prints the Quantum State Monitor's live telemetry — coherence percentage, 127-qubit array state, error rate, and whether an entanglement link is active. Watch the coherence figure: it is about to matter.",
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
    {
      id: "m015.task.entangle",
      label: "Phase-lock the pair",
      unlockRequires: ["qsm_001_online"],
      objectives: [
        {
          id: "m015.obj.analyzer_check",
          description: "Read the analyzer's telemetry with `qua`",
          type: "command",
          target: "qua",
          targetValue: 1,
          hint: "Run `qua` (alias `analyzer`) to see the analyzer's mode, sensitivity, and coherence.",
          deepDiveHint:
            "`qua` is the terminal front-end for the Quantum Analyzer: mode, sensitivity, scan depth, frequency, coherence. Confirm both quantum devices are powered before you bridge them — a sync against a dark device is only half a sync.",
          relatedDeviceIds: ["QAN-001"],
        },
        {
          id: "m015.obj.qbridge_sync",
          description: "Phase-lock the pair with `qbridge sync`",
          type: "command",
          target: "qbridge sync",
          targetValue: 1,
          hint: "With both quantum devices powered, run `qbridge sync` in the terminal.",
          deepDiveHint:
            "`qbridge sync` aligns the entanglement channels and phase-locks QSM-001 to the analyzer. Run it while BOTH devices are online for a full lock — Jade's notes suggest the lab does something extra when the pair syncs cleanly. Something transfers. Not data.",
          relatedDeviceIds: ["QAN-001", "QSM-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ Q-BRIDGE ] phase lock acquired · states correlated · decoherence residual: negligible",
        },
        {
          voice: "mcp",
          text: "The pair is locked. Two instruments, one wave function, zero respect for classical intuition. Whatever they see now, they see it together.",
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

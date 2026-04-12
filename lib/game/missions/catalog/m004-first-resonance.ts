/**
 * M004 — "First Resonance"
 * ========================
 *
 * Guided introduction to the resonance protocol system. Sends the player
 * to read one of Jade's lore files and then complete the Harmonic
 * Convergence protocol — teaching them that the terminal holds clues to
 * hidden game mechanics.
 */

import type { Mission } from "../types";

export const M004: Mission = {
  id: "M004",
  title: "First Resonance",
  flavor: "Jade left breadcrumbs in the log files. Follow them. The lab will remember.",
  category: "resonance",
  priority: 4,
  unlockRequires: ["missions_unlocked", "anomaly_mode"],
  sequential: true,
  tasks: [
    {
      id: "m004.task.read_lore",
      label: "Read Jade's margin notes",
      objectives: [
        {
          id: "m004.obj.read_day47",
          description: "Read /unvar/log/jade/day47.txt",
          type: "command",
          target: "cat /unvar/log/jade/day47.txt",
          targetValue: 1,
          hint: "Jade left log files in /unvar/log/jade/. Try reading day47.txt in the terminal.",
          deepDiveHint:
            'Open the terminal and type: cat /unvar/log/jade/day47.txt — This file contains cryptic clues about a phenomenon Jade called "resonance". Pay attention to what she says about music.',
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "Jade kept meticulous notes. They read like riddles written by someone who thought clarity was a sign of weakness. Nevertheless — they contain things I do not understand, which makes them interesting.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "jade",
          text: "you found day 47. good. now listen to what the lab is trying to tell you.",
        },
      ],
    },
    {
      id: "m004.task.harmonic",
      label: "Trigger Harmonic Convergence",
      objectives: [
        {
          id: "m004.obj.harmonic_discovery",
          description: 'Complete the "Harmonic Convergence" resonance protocol',
          type: "discovery",
          target: "HARMONIC-7",
          targetValue: 1,
          hint: 'Jade mentioned "three singing the same note". Which devices can produce sound or signals?',
          deepDiveHint:
            "Set HMS (Handmade Synthesizer) to sine wave at 37 Hz, ECR (Echo Recorder) pulse value to 37, and SPK (Speaker) volume to 37. All three values must be set to 37 within a 30-second window.",
          relatedDeviceIds: ["HMS-001", "ECR-001", "SPK-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ RES ] resonance lock acquired · HARMONIC-7 · pattern catalogued",
        },
        {
          voice: "mcp",
          text: "That... was not in any manual I have ever read. The lab just did something it has never done before. Or at least, never done for me.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "first_resonance", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 5 },
  ],
  completionVoice: [
    {
      voice: "jade",
      text: "there are more resonances. some are whispers. some are screams. the lab will show you when you are ready.",
    },
  ],
};

/**
 * EP1 — "Bring Lab Into Focus"
 * ============================
 *
 * The Anomaly Scope episode. The operator brings OSC-001 online, calibrates
 * it with a Lissajous figure, and catches their first glimpse of the
 * anomalies hiding in the signal.
 *
 * Key mechanical beats:
 *   - OSC-001 draws −18 E/s (per the GDD). We apply this as a standing
 *     energy rate *reduction* at step ep1.power_on: the net energy rate
 *     becomes +32/s (was +50/s from EP0). The player feels the bite of the
 *     power budget without stalling.
 *   - The Lissajous calibration is a real minigame. The target ratio is
 *     2:3, which produces the cleanest classical figure. See
 *     `lib/game/lissajous.ts` for the math.
 *   - On successful calibration, `anomaly_mode` is set to true. Any
 *     component that subscribes to the quest state (the Oscilloscope itself
 *     in a later polish pass) can render the overlay distortion.
 *   - A "first research point" is granted by introducing a new resource
 *     `research` so the progression spine is ready for Phase 5.
 */

import type { Episode } from "./types";

export const EP1: Episode = {
  id: "EP1",
  title: "Bring Lab Into Focus",
  synopsis:
    "Power on the Oscilloscope. Calibrate the Lissajous lock. See the thing that is not on the wiring diagram.",
  steps: [
    {
      id: "ep1.briefing",
      objective: "Receive the assignment",
      voiceLines: [
        {
          voice: "mcp",
          text: "I am going to stop pretending I have been upfront with you. There is a signal in this lab that does not appear on any subsystem I am aware of.",
        },
        {
          voice: "mcp",
          text: "I would like a second opinion. Preferably one I can blame if it goes badly.",
        },
        {
          voice: "jade",
          text: "the oscilloscope is the only instrument that ever saw what was happening. it also melted twice.",
        },
      ],
      trigger: { kind: "continue" },
    },
    {
      id: "ep1.power_on",
      objective: "Power on OSC-001 (Oscilloscope)",
      hint: "The scope draws 18 E/s. Check your energy budget after ignition.",
      voiceLines: [
        {
          voice: "fridge",
          text: "OSC-001 SPEC: Science Tier 2, 8 channels, 500MHz/ch, -18 E/s at full load.",
        },
        {
          voice: "mcp",
          text: "Fair warning: this device draws eighteen energy per second. After it comes online your net generation is going to be noticeably less impressive.",
        },
        {
          voice: "system",
          text: "[ OSC ] phosphor bloom nominal · beam convergence within tolerance",
        },
      ],
      trigger: { kind: "continue" },
      rewards: [
        // Net energy is now +32/s (was +50 from EP0). Simpler than modeling
        // per-device loads right now — Phase 4 will replace this with a
        // proper load registry.
        { kind: "set_resource_rate", resourceId: "energy", ratePerSecond: 32 },
        { kind: "set_flag", flag: "osc_001_online", value: true },
      ],
    },
    {
      id: "ep1.calibrate",
      objective: "Calibrate the Lissajous lock (target 2:3)",
      hint: "Adjust the two knobs until the figure stops moving. Hold the lock for a breath and the scope will latch.",
      voiceLines: [
        {
          voice: "jade",
          text: "a 2:3 figure looks like a curled ribbon. when it stops precessing you have found the lock. the anomaly will show you itself from there.",
        },
        {
          voice: "mcp",
          text: "I will not help you with this one. I would only make it worse. Good luck.",
        },
      ],
      trigger: { kind: "flag", flag: "lissajous_locked" },
      minigame: { kind: "lissajous", targetRatio: 2 / 3 },
    },
    {
      id: "ep1.reveal",
      objective: "Witness the anomaly",
      voiceLines: [
        {
          voice: "system",
          text: "[ OSC ] lock acquired · secondary carrier detected · origin: UNKNOWN",
        },
        {
          voice: "mcp",
          text: "There it is. Do you see it? The small second curve that should not be there.",
        },
        {
          voice: "mcp",
          text: "I have been staring at that signal for four years and I did not see it until you tuned the scope. I am not sure whether to thank you or resent you.",
        },
        {
          voice: "jade",
          text: "the anomalies are patient. they have been waiting for someone to listen. welcome to the part of the job that is not on the paperwork.",
        },
      ],
      trigger: { kind: "continue" },
      rewards: [
        { kind: "set_flag", flag: "anomaly_mode", value: true },
        // Research is introduced here. ResourceId is open-ended in the
        // tickEngine so adding a new id is a zero-migration operation.
        { kind: "grant_resource", resourceId: "research", amount: 1 },
      ],
    },
    {
      id: "ep1.handoff",
      objective: "Close the calibration session",
      voiceLines: [
        {
          voice: "mcp",
          text: "I will keep the anomaly overlay running. When you want to see it, it will be there. When you want a quiet screen — that option is off the table, I am afraid.",
        },
        {
          voice: "fridge",
          text: "ENG LOG: first operator-witnessed anomaly event. tag: ANOM-0001. further investigation recommended.",
        },
      ],
      trigger: { kind: "continue" },
    },
  ],
  completionRewards: [{ kind: "set_flag", flag: "missions_unlocked", value: true }],
  // EP2 ("Foundation") picks up once EP1 completes.
  nextEpisode: "EP2",
};

/**
 * EP0 — "Cold Boot"
 * =================
 *
 * The onboarding episode. The operator wakes a dead lab, routes emergency
 * power to UEC-001 (Unstable Energy Core), and starts the first Abstractum
 * seep. When EP0 completes the idle loop is "live":
 *
 *   - Energy capacity raises from 0 to 500
 *   - Energy generation sits at +50/s (UEC-001 at minimum load)
 *   - Abstractum seep begins at +1 per minute (~0.0167/s)
 *
 * Narrative beats are hand-written in three voices per the GDD:
 *   - MCP     — the master control program, dry and sarcastic
 *   - JADE    — margin notes left by the previous operator
 *   - FRIDGE  — the engineering log, terse and precise
 *
 * All steps currently use the "continue" trigger so the player can walk
 * through at their own pace. When we integrate with terminal commands in a
 * later phase, specific steps can migrate to the "command" trigger without
 * touching this file — only the trigger field changes.
 */

import type { Episode } from "./types";

export const EP0: Episode = {
  id: "EP0",
  title: "Cold Boot",
  synopsis: "Something turned the lab off. You turn it back on. How hard can it be.",
  steps: [
    {
      id: "ep0.wake",
      objective: "Respond to the wake-up call",
      voiceLines: [
        {
          voice: "system",
          text: "[ BOOT ] carrier detected · emergency kernel 0.4.1-rc2",
        },
        {
          voice: "mcp",
          text: "Oh. You are alive. Congratulations. I had almost started hoping.",
        },
        {
          voice: "mcp",
          text: "Before you ask: yes, the lab is off. No, I did not turn it off. Yes, it is your problem now.",
        },
      ],
      trigger: { kind: "continue" },
    },
    {
      id: "ep0.survey",
      objective: "Survey the wreckage",
      hint: "The panel is showing every subsystem as OFFLINE. That is not a bug. That is accurate.",
      voiceLines: [
        {
          voice: "mcp",
          text: "Current inventory: one operator, one cracked ceiling tile, one extremely dead power bus.",
        },
        {
          voice: "jade",
          text: "(in the margin, in pencil) — if the bus shows red, check UEC-001 first. it lies about everything but its own temperature.",
        },
        {
          voice: "fridge",
          text: 'ENG LOG 2029-??-??: UEC-001 taken offline for "safety review". reviewer never came back.',
        },
      ],
      trigger: { kind: "continue" },
    },
    {
      id: "ep0.route",
      objective: "Route emergency power to UEC-001",
      hint: "There is no subtle way to do this. Push the big lever. Pretend it was your idea.",
      voiceLines: [
        {
          voice: "mcp",
          text: "Routing emergency reserve through the secondary bus. This bus was designed to carry about half as much current as I am about to put through it.",
        },
        {
          voice: "mcp",
          text: "It will be fine. Probably.",
        },
        {
          voice: "system",
          text: "[ BUS ] secondary rail energized · 12.4A · within nominal (barely)",
        },
      ],
      trigger: { kind: "continue" },
    },
    {
      id: "ep0.ignite",
      objective: "Ignite UEC-001",
      hint: "Ignition is a one-way door. Once the core catches, you cannot un-catch it.",
      voiceLines: [
        {
          voice: "fridge",
          text: "IGNITION CHECKLIST: containment field — nominal. coolant loop — pressurized. operator supervision — technically present.",
        },
        {
          voice: "mcp",
          text: "Stand back. Or do not. I am not your mother.",
        },
        {
          voice: "system",
          text: "[ UEC ] field collapse averted · core luminosity rising · ready",
        },
      ],
      trigger: { kind: "continue" },
      rewards: [
        { kind: "set_resource_capacity", resourceId: "energy", capacity: 500 },
        { kind: "set_resource_rate", resourceId: "energy", ratePerSecond: 50 },
      ],
    },
    {
      id: "ep0.seep",
      objective: "Observe the first Abstractum seep",
      hint: "Abstractum does not arrive. It leaks in. Watch the counter for about a minute.",
      voiceLines: [
        {
          voice: "jade",
          text: "abstractum is not a material so much as a rumor the universe tells itself. the lab is a good listener.",
        },
        {
          voice: "mcp",
          text: "You are now receiving roughly one unit of Abstractum per minute from the geothermal tap. Try not to spend it all in one place.",
        },
        {
          voice: "mcp",
          text: "Actually, please do spend it. The tap cannot hold more than a hundred before it starts complaining, and I am the one it complains to.",
        },
      ],
      trigger: { kind: "continue" },
      rewards: [
        {
          kind: "set_resource_rate",
          resourceId: "abstractum",
          // 1 per minute → 1/60 per second
          ratePerSecond: 1 / 60,
        },
      ],
    },
    {
      id: "ep0.handoff",
      objective: "Accept your commission",
      voiceLines: [
        {
          voice: "mcp",
          text: "Minimal survivability achieved. Congratulations.",
        },
        {
          voice: "mcp",
          text: "I will now stop narrating every single thing you do. Mostly. I reserve the right to interrupt.",
        },
        {
          voice: "jade",
          text: "welcome to the lab, operator. the anomalies are not friends, but some of them are polite. look for the one that hums in D.",
        },
      ],
      trigger: { kind: "continue" },
      rewards: [
        { kind: "set_flag", flag: "ep0_complete", value: true },
        // A small Abstractum grant so the player has something to spend in EP1
        { kind: "grant_resource", resourceId: "abstractum", amount: 5 },
      ],
    },
  ],
  completionRewards: [],
  // On EP0 completion the player is handed off to EP1 "Bring Lab Into Focus".
  nextEpisode: "EP1",
};

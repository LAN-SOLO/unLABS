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
 * Trigger anchoring (0.1.28):
 *   - Steps wake→seep are narrative beats and keep the "continue" trigger.
 *   - `ep0_complete` is granted at ep0.seep (not at the end) so the basic
 *     subsystems (BAT-001 / NET-001 / MEM-001, see DEVICE_UNLOCK_FLAGS)
 *     unlock while EP0 is still active.
 *   - ep0.handoff gates on the real `grid_online` flag: the player must
 *     actually power on BAT-001, NET-001 and MEM-001 (three real actions).
 *     GridObserverBridge (components/panel/GridObserverBridge.tsx) sets the
 *     flag once all three are live; setQuestFlagAction cascades the step.
 *   - "command" triggers stay unused here: nothing sets `cmd:*` flags yet
 *     (the terminal→quest bridge is still Phase 4), so a command-gated step
 *     would soft-lock. Revisit once the bridge exists.
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
        // Re-authorizes the basic subsystems (BAT/NET/MEM/CDC/PWB unlock on
        // this flag) so the final step can demand a real power-on action.
        { kind: "set_flag", flag: "ep0_complete", value: true },
      ],
    },
    {
      id: "ep0.handoff",
      objective: "Wake the basic grid: power on BAT-001, NET-001 and MEM-001",
      hint: "Type `panel` to open the hardware panel, then switch the three subsystems on (power on BAT-001, and the same for NET-001 and MEM-001). The step completes the moment all three are live.",
      voiceLines: [
        {
          voice: "mcp",
          text: "Minimal survivability achieved. Congratulations.",
        },
        {
          voice: "system",
          text: "[ AUTH ] subsystems re-authorized: CDC-001 · BAT-001 · MEM-001 · NET-001 · PWB-001 — state: OFF",
        },
        {
          voice: "mcp",
          text: "The basic grid is yours now. Open the panel and power on BAT-001, NET-001, and MEM-001. I will not do it for you. Character building.",
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
      // Real action gate: GridObserverBridge sets `grid_online` once BAT-001,
      // NET-001 and MEM-001 are all powered; the server cascade advances this
      // step (no CONTINUE button — QuestOverlay shows "awaiting trigger").
      trigger: { kind: "flag", flag: "grid_online" },
      rewards: [
        // A small Abstractum grant so the player has something to spend in EP1
        { kind: "grant_resource", resourceId: "abstractum", amount: 5 },
      ],
    },
  ],
  completionRewards: [],
  // On EP0 completion the player is handed off to EP1 "Bring Lab Into Focus".
  nextEpisode: "EP1",
};

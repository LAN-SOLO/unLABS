/**
 * EP4 — "Autonomy"
 * ================
 *
 * Phase 5 of the Cold Start Protocol: the onboarding concludes. The lab
 * is self-sustaining, the research subsystem is live, and the player is
 * handed off to the open-world loop. EP4 steps are mostly narrative
 * beats — the one mechanical gate is "touched multiple trees at T2".
 *
 * Mechanic anchoring:
 *   Step 1 → continue (handoff; auto-sets `tutorial_graduated`)
 *   Step 2 → flag `pick_path_deep` (observer: ≥ 2 T2+ nodes unlocked)
 *   Step 3 → continue (optional anomaly lore; narrative only in MVP —
 *            real anomaly event pipeline is post-MVP)
 *   Step 4 → continue (endgame flag + marketplace visibility)
 *
 * On completion EP4 sets `ENDGAME_UNLOCKED` so downstream systems
 * (starter-pack shop, marketplace, prestige) can gate on a single flag
 * rather than walking the episode ladder.
 */

import type { Episode } from "./types";

export const EP4: Episode = {
  id: "EP4",
  title: "Autonomy",
  synopsis:
    "Graduation. The lab is yours. The narrator is tired. The research tree is open. The rest is play.",
  steps: [
    {
      id: "ep4.graduation",
      objective: "Accept the handoff",
      voiceLines: [
        {
          voice: "mcp",
          text: "Alright. You know the loop. Resources in, devices out, research in between, repeat until ascension.",
        },
        {
          voice: "mcp",
          text: "I am done holding your hand. The tutorial ends here. I reserve the right to interrupt if something starts making a noise I do not recognize.",
        },
        {
          voice: "jade",
          text: "(in the margin) — the rest of this notebook is unfinished. you will know what to write in it better than i did.",
        },
      ],
      trigger: { kind: "continue" },
      rewards: [
        { kind: "set_flag", flag: "tutorial_graduated", value: true },
        // The +100 _unSC reserve burn referenced in the plan is handled
        // client-side on step advance (awardFromReserve), not as a
        // quest-engine grant — keep reward side-effects to flags here.
      ],
    },
    {
      id: "ep4.pick_a_path",
      objective: "Unlock two T2 (or higher) research nodes",
      hint: "The EP3 cross-tree step only needed two branches touched at T1. This one asks for depth — T2 or higher in two trees.",
      voiceLines: [
        {
          voice: "findr",
          text: "Two roads! Three roads! Eight roads! You pick! I'll wave at all of them!",
        },
        {
          voice: "mcp",
          text: "Breadth is the cheapest hedge. Depth is the cheapest growth. Pick your flavor.",
        },
      ],
      trigger: { kind: "flag", flag: "pick_path_deep" },
      rewards: [
        { kind: "set_flag", flag: "ach_breadth_unlocked", value: true },
        { kind: "grant_resource", resourceId: "research", amount: 5 },
      ],
    },
    {
      id: "ep4.anomaly",
      objective: "Witness the first anomaly beyond the oscilloscope",
      hint: "This step is narrative-only in the current build. Click continue when ready.",
      voiceLines: [
        {
          voice: "jade",
          text: "…it watches back. do not look away. it is already too late for not-looking-away.",
        },
        {
          voice: "fridge",
          text: "ENG LOG: anomaly class B detected in the auxiliary field. no containment breach. operator attention respectfully requested.",
        },
        {
          voice: "mcp",
          text: "I am choosing not to be alarmed. If you feel differently, your instincts are possibly more accurate than mine.",
        },
      ],
      // Marked continue for MVP — a future anomaly-event system will
      // replace this with a `flag`-gated trigger tied to an actual
      // in-game incident.
      trigger: { kind: "continue" },
      rewards: [{ kind: "set_flag", flag: "anomaly_b_witnessed", value: true }],
    },
    {
      id: "ep4.open_world",
      objective: "Begin open operation",
      voiceLines: [
        {
          voice: "mcp",
          text: "This is the part where the game becomes a game. Don't make me regret saving your lab.",
        },
        {
          voice: "mcp",
          text: "The marketplace is visible. Starter packs are real. Achievements are rolling. Good luck, operator.",
        },
        {
          voice: "system",
          text: "[ EP4 ] handoff complete · endgame flags set · sandbox active",
        },
      ],
      trigger: { kind: "continue" },
      rewards: [
        { kind: "set_flag", flag: "ENDGAME_UNLOCKED", value: true },
        { kind: "set_flag", flag: "marketplace_visible", value: true },
      ],
    },
  ],
  completionRewards: [{ kind: "set_flag", flag: "ep4_complete", value: true }],
  // EP4 is the terminal tutorial episode. Post-MVP workstreams (prestige,
  // seasons) can add nextEpisode: "EP5-Seasonal" without changing EP4.
};

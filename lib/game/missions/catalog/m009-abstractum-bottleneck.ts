/**
 * M009 — "The Bottleneck"
 * =======================
 *
 * Mission twin of EP2.bottleneck. The player must observe their Abstractum
 * reserve run low while a chain is active — the moment the idle loop
 * converts from "free resource" to "budgeted resource". Completion sets
 * the same flag EP2 gates on, so claiming this mission also advances the
 * quest step (by design — one player action, one beat).
 *
 * Evaluated via a flag objective so the client-side AbstractumBottleneck
 * observer can decide when the condition is met (60 s held at ≤50).
 */

import type { Mission } from "../types";

export const M009: Mission = {
  id: "M009",
  title: "The Bottleneck",
  flavor:
    "Abstractum is not a supply problem. It is a patience problem. Then it becomes a research problem.",
  category: "onboarding",
  priority: 9,
  unlockRequires: ["missions_unlocked", "smt_01_online"],
  tasks: [
    {
      id: "m009.task.drain",
      label: "Observe the bottleneck",
      objectives: [
        {
          id: "m009.obj.observed_flag",
          description: "Hold Abstractum at ≤50 for 60 seconds while a chain is online",
          type: "flag",
          target: "abstractum_bottleneck_observed",
          targetValue: 1,
          hint: "Keep crafting. The reserve will drop; leave it low for a minute and the observer will mark the beat.",
          deepDiveHint:
            "The client watches your Abstractum amount every tick. Holding it ≤50 for 60 consecutive seconds flips the flag. Starting a Base Alloy job and waiting is usually the fastest path.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "bottleneck_mission_claimed", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 1 },
  ],
  completionVoice: [
    {
      voice: "jade",
      text: "the bottleneck is not a problem. it is an invitation to build something that isn't yet there.",
    },
  ],
};

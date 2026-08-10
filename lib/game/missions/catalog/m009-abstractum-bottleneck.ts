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
 * NOTE: tests assert that `m009.obj.observed_flag` stays the first
 * objective of the first task — append, never reorder.
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
          relatedDeviceIds: ["SMT-01"],
        },
        {
          id: "m009.obj.reserve_low",
          description: "Let the Abstractum reserve sink to 50 or below",
          type: "resource_threshold",
          target: "abstractum",
          targetValue: 50,
          comparison: "lte",
          hint: "Spend faster than the seep refills. Ingot jobs at 5 Abstractum each will get you there.",
          deepDiveHint:
            "Your seep is 3/min with SMT-01 online — one Base Alloy job burns 5 Abstractum instantly. Two or three quick jobs push the reserve under 50 before the seep can argue.",
          relatedDeviceIds: ["SMT-01"],
        },
        {
          id: "m009.obj.ask_advisor",
          description: "Run `whatnext` while the reserve is tight",
          type: "command",
          target: "whatnext",
          targetValue: 1,
          hint: "When you are stuck or starved, `whatnext` is the terminal's answer to 'now what?'. Try it.",
          deepDiveHint:
            "Type `whatnext` (or `wn`) in the terminal. It reads your active missions and current hints and returns the single most useful next action. `whatnext --verbose` includes the full walkthrough.",
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "You are about to run out of Abstractum. I want you to watch it happen. Scarcity is the only teacher in this lab that never repeats itself.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "jade",
          text: "you saw the floor of the reserve. good. most operators only ever see the ceiling.",
        },
      ],
    },
    {
      id: "m009.task.relief",
      label: "Engineer around it",
      objectives: [
        {
          id: "m009.obj.push_through",
          description: "Reach a lifetime total of 5 Base Alloy Ingots",
          type: "craft_count",
          target: "base_alloy_ingot",
          targetValue: 5,
          hint: "Keep the line running even while the reserve is thin. The bottleneck is survivable — that is the lesson.",
          deepDiveHint:
            "You need 5 claimed Base Alloy Ingot jobs in total (the count includes earlier runs). Each job costs 5 Abstractum + 60 Energy + 1 _unSC. Time the jobs against the 3/min seep and the line never fully stalls.",
          relatedDeviceIds: ["SMT-01"],
        },
        {
          id: "m009.obj.recover",
          description: "Refill the Abstractum reserve to 60 or more",
          type: "resource_threshold",
          target: "abstractum",
          targetValue: 60,
          hint: "Now the other half of the discipline: stop spending and let the seep restore the buffer.",
          deepDiveHint:
            "Pause the ingot jobs for a while. At 3/min the climb from ~50 to 60 takes about four minutes — less if you avoid Energy Cell jobs too. A reserve you can drain *and* refill on purpose is a reserve under control.",
        },
        {
          id: "m009.obj.survey_board",
          description: "Review the mission board with `missions`",
          type: "command",
          target: "missions",
          targetValue: 1,
          hint: "Run `missions` in the terminal to see everything that is tracked, available, and claimable.",
          deepDiveHint:
            "Type `missions` for the full board. Flags: `--active`, `--available`, `--completed`, and `--track <id>` / `--claim <id>` to manage missions without leaving the terminal. The bottleneck you just survived unlocks research-flavored answers on this board.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "fridge",
          text: "ENG LOG: abstractum reserve cycled low-to-high under load. operator retains composure. bottleneck reclassified: known quantity.",
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

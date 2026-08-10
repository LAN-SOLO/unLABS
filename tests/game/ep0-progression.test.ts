import { describe, it, expect } from "vitest";

import {
  advanceStep,
  canAdvanceStep,
  cascadeAdvance,
  createInitialQuestState,
  getCurrentStep,
  getEpisode,
  setQuestFlag,
  type QuestState,
  type StepReward,
} from "@/lib/game/quests";
import { SKIP_FLAGS } from "@/lib/game/tutorial/types";
import { isDeviceUnlocked } from "@/lib/game/devices/unlocks";
import { OVERLAY_STEPS } from "@/lib/game/tutorial/overlaySteps";

/**
 * EP0 "Cold Boot" — trigger migration (0.1.28) + command bridge (0.1.29).
 *
 * EP0's finale is anchored to a real player action: `grid_online` is set by
 * GridObserverBridge once BAT-001, NET-001 and MEM-001 are powered on. To make
 * that possible, `ep0_complete` (the device-unlock flag for the basic grid)
 * moves from the final step to ep0.seep, so the subsystems unlock while EP0 is
 * still active.
 *
 * With the terminal→quest command bridge in place, EP0's opener is anchored
 * too: ep0.wake gates on `command: dmesg`, which the bridge resolves via the
 * `cmd:dmesg` flag (see isTriggerSatisfied) after the first successful run.
 */

describe("EP0 Cold Boot — registration", () => {
  it("is registered with 6 steps in stable order", () => {
    const ep = getEpisode("EP0")!;
    expect(ep).not.toBeNull();
    expect(ep.steps.map((s) => s.id)).toEqual([
      "ep0.wake",
      "ep0.survey",
      "ep0.route",
      "ep0.ignite",
      "ep0.seep",
      "ep0.handoff",
    ]);
  });

  it("gates the first step on the real dmesg command", () => {
    const ep = getEpisode("EP0")!;
    const wake = ep.steps[0];
    expect(wake.trigger).toEqual({ kind: "command", command: "dmesg" });
  });

  it("gates the final step on the real grid_online flag", () => {
    const ep = getEpisode("EP0")!;
    const handoff = ep.steps[ep.steps.length - 1];
    expect(handoff.trigger).toEqual({ kind: "flag", flag: "grid_online" });
  });
});

describe("EP0 — ep0.wake command trigger resolves via the cmd: flag", () => {
  it("refuses to advance until cmd:dmesg is set, advances once it is", () => {
    // The exact flag shape is load-bearing: isTriggerSatisfied resolves
    // command triggers as flags[`cmd:${trigger.command}`], and the terminal
    // bridge (Terminal.tsx) writes exactly that key via setQuestFlagAction.
    const state = createInitialQuestState("EP0");
    expect(getCurrentStep(state)?.id).toBe("ep0.wake");
    expect(canAdvanceStep(state)).toBe(false);
    const stuck = advanceStep(state);
    expect(stuck.state.currentStepIndex).toBe(0);

    const woken = setQuestFlag(state, "cmd:dmesg", true);
    expect(canAdvanceStep(woken)).toBe(true);
    expect(advanceStep(woken).state.currentStepIndex).toBe(1);
  });
});

describe("EP0 — ep0_complete unlocks the grid before the final step", () => {
  function walkToHandoff(): QuestState {
    // wake gates on `command: dmesg` — simulate the terminal bridge firing.
    let state: QuestState = setQuestFlag(createInitialQuestState("EP0"), "cmd:dmesg", true);
    // wake (cmd:dmesg satisfied) → survey → route → ignite → seep.
    for (let i = 0; i < 5; i++) {
      state = advanceStep(state).state;
    }
    return state;
  }

  it("completing ep0.seep sets ep0_complete", () => {
    const state = walkToHandoff();
    expect(getCurrentStep(state)?.id).toBe("ep0.handoff");
    expect(state.flags.ep0_complete).toBe(true);
  });

  it("BAT-001 / NET-001 / MEM-001 are unlocked while ep0.handoff is active", () => {
    const state = walkToHandoff();
    for (const id of ["BAT-001", "NET-001", "MEM-001"]) {
      expect(isDeviceUnlocked(id, state.flags)).toBe(true);
    }
  });

  it("ep0.handoff refuses to advance until grid_online is set", () => {
    const state = walkToHandoff();
    expect(canAdvanceStep(state)).toBe(false);
    const stuck = advanceStep(state);
    expect(stuck.state.currentStepIndex).toBe(state.currentStepIndex);
    expect(stuck.rewards).toEqual([]);
  });

  it("grid_online completes EP0, grants the Abstractum starter, and hands off to EP1", () => {
    let state = walkToHandoff();
    state = setQuestFlag(state, "grid_online", true);
    const final = advanceStep(state);
    expect(final.episodeCompleted).toBe(true);
    expect(final.nextEpisodeId).toBe("EP1");
    expect(final.state.episodeId).toBe("EP1");
    // Step reward: the 5-Abstractum starter grant still fires on completion.
    expect(final.rewards).toContainEqual({
      kind: "grant_resource",
      resourceId: "abstractum",
      amount: 5,
    });
    // Flags persist across the episode boundary.
    expect(final.state.flags.ep0_complete).toBe(true);
    expect(final.state.flags.grid_online).toBe(true);
  });

  it("background cascade never walks the narrative continue steps", () => {
    // A premature grid_online (stale save) must not fast-forward the intro:
    // ep0.wake is command-gated (cmd:dmesg unset) and the one-step look-ahead
    // only sees ep0.survey, a continue step the cascade refuses to walk.
    let state = createInitialQuestState("EP0");
    state = setQuestFlag(state, "grid_online", true);
    const result = cascadeAdvance(state);
    expect(result.state.currentStepIndex).toBe(0);
    expect(result.rewards).toEqual([]);
  });

  it("the dmesg bridge cascades past ep0.wake but stops at the next continue step", () => {
    // This is the live path: setQuestFlagAction("cmd:dmesg") → server
    // cascadeAdvance → wake completes, survey (continue) waits for a click.
    let state = createInitialQuestState("EP0");
    state = setQuestFlag(state, "cmd:dmesg", true);
    const result = cascadeAdvance(state);
    expect(getCurrentStep(result.state)?.id).toBe("ep0.survey");
    expect(result.state.completedStepIds).toEqual(["ep0.wake"]);
  });

  it("cascade heals a save stuck on ep0.seep once the grid is live", () => {
    // One-step look-ahead: seep (continue) is force-skipped because handoff's
    // trigger is already satisfied — seep's rewards (incl. ep0_complete) are
    // still applied on the way through.
    let state: QuestState = setQuestFlag(createInitialQuestState("EP0"), "cmd:dmesg", true);
    for (let i = 0; i < 4; i++) {
      state = advanceStep(state).state; // wake → survey → route → ignite
    }
    expect(getCurrentStep(state)?.id).toBe("ep0.seep");
    state = setQuestFlag(state, "grid_online", true);
    const result = cascadeAdvance(state);
    expect(result.episodeCompleted).toBe(true);
    expect(result.state.episodeId).toBe("EP1");
    expect(result.state.flags.ep0_complete).toBe(true);
  });
});

describe("tutorial skip flow stays consistent with EP0/EP1 triggers", () => {
  function collectSetTrueFlags(episodeId: string): string[] {
    const ep = getEpisode(episodeId)!;
    const rewards: StepReward[] = [
      ...ep.steps.flatMap((s) => s.rewards ?? []),
      ...(ep.completionRewards ?? []),
    ];
    return rewards
      .filter((r): r is Extract<StepReward, { kind: "set_flag" }> => r.kind === "set_flag")
      .filter((r) => r.value === true)
      .map((r) => r.flag);
  }

  it("SKIP_FLAGS covers every flag EP0 and EP1 rewards set to true", () => {
    // `tutorial skip` bypasses the step engine and must leave the player with
    // the same progression flags a played-through EP0+EP1 would have.
    for (const flag of [...collectSetTrueFlags("EP0"), ...collectSetTrueFlags("EP1")]) {
      expect(SKIP_FLAGS[flag], `SKIP_FLAGS missing "${flag}"`).toBe(true);
    }
  });

  it("skip does not depend on trigger (input) flags like grid_online or cmd:*", () => {
    // grid_online and cmd:dmesg are trigger (input) flags, not progression
    // rewards — the skip path parks the player on the SKIPPED sentinel
    // episode, so no step trigger is ever evaluated and both may stay unset.
    expect(SKIP_FLAGS.grid_online).toBeUndefined();
    expect(SKIP_FLAGS["cmd:dmesg"]).toBeUndefined();
    // Nothing the skip flow unlocks gates on grid_online (device unlocks all
    // resolve against SKIP_FLAGS successfully).
    for (const id of ["BAT-001", "NET-001", "MEM-001", "CDC-001", "PWB-001"]) {
      expect(isDeviceUnlocked(id, SKIP_FLAGS)).toBe(true);
    }
  });
});

describe("easy-mode overlay stays in sync with EP0's trigger", () => {
  it("the wake-the-grid overlay step advances on the same flag EP0.handoff gates on", () => {
    const ep0 = getEpisode("EP0")!;
    const handoff = ep0.steps[ep0.steps.length - 1];
    const overlay = OVERLAY_STEPS.find((s) => s.id === "wake-the-grid")!;
    expect(overlay).toBeDefined();
    expect(handoff.trigger.kind).toBe("flag");
    expect(overlay.advance).toEqual({
      kind: "questFlag",
      flag: handoff.trigger.kind === "flag" ? handoff.trigger.flag : "",
      value: true,
    });
  });

  it("the follow-mcp overlay step advances on ep0_complete, which now fires at ep0.seep", () => {
    const ep0 = getEpisode("EP0")!;
    const seep = ep0.steps.find((s) => s.id === "ep0.seep")!;
    expect(
      seep.rewards?.some((r) => r.kind === "set_flag" && r.flag === "ep0_complete" && r.value),
    ).toBe(true);
    const overlay = OVERLAY_STEPS.find((s) => s.id === "follow-mcp")!;
    expect(overlay.advance).toEqual({ kind: "questFlag", flag: "ep0_complete", value: true });
  });
});

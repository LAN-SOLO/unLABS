import { describe, it, expect } from "vitest";

import {
  advanceStep,
  createInitialQuestState,
  getEpisode,
  listRegisteredEpisodes,
  setQuestFlag,
  type QuestState,
} from "@/lib/game/quests";
import { getMission, listAllMissions } from "@/lib/game/missions";

describe("EP3 Expansion — registry + linkage", () => {
  it("is registered and linked from EP2", () => {
    expect(getEpisode("EP3")).not.toBeNull();
    expect(getEpisode("EP2")!.nextEpisode).toBe("EP3");
  });

  it("has 4 steps", () => {
    const ep = getEpisode("EP3")!;
    expect(ep.steps.map((s) => s.id)).toEqual([
      "ep3.first_research",
      "ep3.drone_protocol",
      "ep3.daily_rhythm",
      "ep3.pick_a_path",
    ]);
  });

  it("points to EP4 on completion", () => {
    expect(getEpisode("EP3")!.nextEpisode).toBe("EP4");
  });

  it("each step advances only when its flag is set", () => {
    let state: QuestState = createInitialQuestState("EP3");

    expect(advanceStep(state).state.currentStepIndex).toBe(0); // blocked

    state = setQuestFlag(state, "research_started", true);
    state = advanceStep(state).state;
    expect(state.currentStepIndex).toBe(1);

    state = setQuestFlag(state, "research_explorer_drone", true);
    state = advanceStep(state).state;
    expect(state.currentStepIndex).toBe(2);

    state = setQuestFlag(state, "welcome_back_seen", true);
    state = advanceStep(state).state;
    expect(state.currentStepIndex).toBe(3);

    state = setQuestFlag(state, "pick_path_done", true);
    const final = advanceStep(state);
    expect(final.episodeCompleted).toBe(true);
    expect(final.nextEpisodeId).toBe("EP4");
    expect(final.state.episodeId).toBe("EP4");
    expect(final.state.flags.ep3_complete).toBe(true);
  });
});

describe("EP4 Autonomy — registry + flow", () => {
  it("is registered", () => {
    expect(getEpisode("EP4")).not.toBeNull();
    expect(listRegisteredEpisodes().map((e) => e.id)).toEqual(
      expect.arrayContaining(["EP0", "EP1", "EP2", "EP3", "EP4"]),
    );
  });

  it("has 4 steps ending with open-world handoff", () => {
    const ep = getEpisode("EP4")!;
    expect(ep.steps.map((s) => s.id)).toEqual([
      "ep4.graduation",
      "ep4.pick_a_path",
      "ep4.anomaly",
      "ep4.open_world",
    ]);
  });

  it("sets ENDGAME_UNLOCKED + marketplace_visible on final step", () => {
    const last = getEpisode("EP4")!.steps[3];
    const flags = (last.rewards ?? [])
      .filter((r) => r.kind === "set_flag")
      .map((r) => (r as { flag: string }).flag);
    expect(flags).toEqual(expect.arrayContaining(["ENDGAME_UNLOCKED", "marketplace_visible"]));
  });

  it("walks through step-1 (continue) → step-2 (flag) → step-3 (continue) → step-4 (continue)", () => {
    let state: QuestState = createInitialQuestState("EP4");

    // Step 1 — continue
    state = advanceStep(state).state;
    expect(state.flags.tutorial_graduated).toBe(true);

    // Step 2 — flag-gated on pick_path_deep
    expect(advanceStep(state).state.currentStepIndex).toBe(1); // blocked
    state = setQuestFlag(state, "pick_path_deep", true);
    state = advanceStep(state).state;
    expect(state.currentStepIndex).toBe(2);

    // Step 3 — continue
    state = advanceStep(state).state;
    expect(state.currentStepIndex).toBe(3);

    // Step 4 — continue (final)
    const final = advanceStep(state);
    expect(final.episodeCompleted).toBe(true);
    expect(final.state.flags.ENDGAME_UNLOCKED).toBe(true);
    expect(final.state.flags.marketplace_visible).toBe(true);
    expect(final.state.flags.ep4_complete).toBe(true);
  });

  it("EP4 chains to EP5", () => {
    expect(getEpisode("EP4")!.nextEpisode).toBe("EP5");
  });
});

describe("Phase 4/5 missions", () => {
  it.each([["M010"], ["M011"], ["M012"], ["M013"]])("%s is registered", (id) => {
    expect(getMission(id)).not.toBeNull();
  });

  it("M010 gates on nexus_built", () => {
    expect(getMission("M010")!.unlockRequires).toContain("nexus_built");
  });

  it("M011 chains from M010 via research_started", () => {
    expect(getMission("M010")!.nextMission).toBe("M011");
    expect(getMission("M011")!.unlockRequires).toContain("research_started");
  });

  it("M013 requires pick_path_done (same flag as EP3.4)", () => {
    expect(getMission("M013")!.unlockRequires).toContain("pick_path_done");
  });

  it("mission ids remain globally unique after expansion", () => {
    const ids = listAllMissions().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("catalog has at least 10 missions", () => {
    expect(listAllMissions().length).toBeGreaterThanOrEqual(10);
  });
});

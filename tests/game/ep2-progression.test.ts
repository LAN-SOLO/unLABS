import { describe, it, expect } from "vitest";

import {
  advanceStep,
  createInitialQuestState,
  getCurrentStep,
  getEpisode,
  listRegisteredEpisodes,
  setQuestFlag,
  type QuestState,
} from "@/lib/game/quests";
import { getRecipe, RECIPES } from "@/lib/game/recipes";
import { listAllMissions, getMission } from "@/lib/game/missions";

describe("EP2 Foundation — episode registration", () => {
  it("is in the registry", () => {
    expect(getEpisode("EP2")).not.toBeNull();
    expect(listRegisteredEpisodes().map((e) => e.id)).toContain("EP2");
  });

  it("has 4 steps", () => {
    const ep = getEpisode("EP2")!;
    expect(ep.steps).toHaveLength(4);
    expect(ep.steps.map((s) => s.id)).toEqual([
      "ep2.three_chains",
      "ep2.first_job",
      "ep2.bottleneck",
      "ep2.build_nexus",
    ]);
  });

  it("sets ep2_complete on completion", () => {
    const ep = getEpisode("EP2")!;
    expect(
      ep.completionRewards?.some((r) => r.kind === "set_flag" && r.flag === "ep2_complete"),
    ).toBe(true);
  });
});

describe("EP1 → EP2 transition", () => {
  it("EP1 has nextEpisode=EP2", () => {
    const ep1 = getEpisode("EP1")!;
    expect(ep1.nextEpisode).toBe("EP2");
  });

  it("advancing past EP1's final step switches to EP2 with preserved flags", () => {
    // Walk EP1 to the last step via its continue triggers, lissajous flag,
    // and so on. Use advanceStep repeatedly.
    let state: QuestState = createInitialQuestState("EP1");
    // EP1.briefing (continue) → power_on (continue) → calibrate (flag)
    // → reveal (continue) → handoff (continue)
    state = advanceStep(state).state; // briefing
    state = advanceStep(state).state; // power_on (rewards set osc_001_online)
    // calibrate requires lissajous_locked
    state = setQuestFlag(state, "lissajous_locked", true);
    const afterCalibrate = advanceStep(state);
    state = afterCalibrate.state;
    state = advanceStep(state).state; // reveal
    const final = advanceStep(state); // handoff → should complete EP1
    expect(final.episodeCompleted).toBe(true);
    expect(final.nextEpisodeId).toBe("EP2");
    expect(final.state.episodeId).toBe("EP2");
    // EP1's completion reward sets missions_unlocked; it should carry over
    expect(final.state.flags.missions_unlocked).toBe(true);
  });
});

describe("EP2 step advancement (flag triggers)", () => {
  it("three_chains advances only when three_chains_online is set", () => {
    const initial = createInitialQuestState("EP2");
    const notReady = advanceStep(initial);
    // Can't advance without the flag.
    expect(notReady.state.currentStepIndex).toBe(0);

    const withFlag = setQuestFlag(initial, "three_chains_online", true);
    const advanced = advanceStep(withFlag);
    expect(advanced.state.currentStepIndex).toBe(1);
  });

  it("walks through all 4 steps given the right flags", () => {
    let state: QuestState = createInitialQuestState("EP2");

    state = setQuestFlag(state, "three_chains_online", true);
    state = advanceStep(state).state; // step 1 → 2

    state = setQuestFlag(state, "first_production_run", true);
    state = advanceStep(state).state; // step 2 → 3

    state = setQuestFlag(state, "abstractum_bottleneck_observed", true);
    state = advanceStep(state).state; // step 3 → 4

    state = setQuestFlag(state, "nexus_built", true);
    const final = advanceStep(state); // step 4 → complete
    expect(final.episodeCompleted).toBe(true);
    expect(final.state.flags.ep2_complete).toBe(true);
  });

  it("advancing past EP2's final step transitions to EP3 with preserved flags", () => {
    // EP2 was terminal in Workstream #5; WS#7 added EP3 as the next episode.
    let state: QuestState = createInitialQuestState("EP2");
    state = setQuestFlag(state, "three_chains_online", true);
    state = advanceStep(state).state;
    state = setQuestFlag(state, "first_production_run", true);
    state = advanceStep(state).state;
    state = setQuestFlag(state, "abstractum_bottleneck_observed", true);
    state = advanceStep(state).state;
    state = setQuestFlag(state, "nexus_built", true);
    const final = advanceStep(state);
    expect(final.episodeCompleted).toBe(true);
    expect(final.nextEpisodeId).toBe("EP3");
    expect(final.state.episodeId).toBe("EP3");
    // EP3 step 0 is flag-gated on `research_started`; until the flag is set,
    // the current step is the first EP3 step (not null).
    const step = getCurrentStep(final.state);
    expect(step?.id).toBe("ep3.first_research");
    // EP2 completion flag persists into EP3.
    expect(final.state.flags.ep2_complete).toBe(true);
  });
});

describe("Phase 3 recipes", () => {
  it.each([
    ["smt_01_build", "device", 1],
    ["cnd_01_build", "device", 1],
    ["mix_01_build", "device", 1],
    ["nxs_01_build", "device", 2],
  ])("recipe %s exists at tier %i", (id, category, tier) => {
    const recipe = getRecipe(id);
    expect(recipe).not.toBeNull();
    expect(recipe!.category).toBe(category);
    expect(recipe!.tier).toBe(tier);
  });

  it("SMT-01 → CND-01 → MIX-01 → NXS-01 form an ordered chain of unlocks", () => {
    expect(getRecipe("smt_01_build")!.unlockRequires).toEqual(["missions_unlocked"]);
    expect(getRecipe("cnd_01_build")!.unlockRequires).toEqual(["smt_01_online"]);
    expect(getRecipe("mix_01_build")!.unlockRequires).toEqual(["cnd_01_online"]);
    expect(getRecipe("nxs_01_build")!.unlockRequires).toEqual(["three_chains_online"]);
  });

  it("MIX-01 sets the three_chains_online flag on claim", () => {
    const outputs = getRecipe("mix_01_build")!.outputs;
    expect(outputs.some((o) => o.kind === "set_flag" && o.flag === "three_chains_online")).toBe(
      true,
    );
  });

  it("NXS-01 sets the nexus_built flag on claim", () => {
    const outputs = getRecipe("nxs_01_build")!.outputs;
    expect(outputs.some((o) => o.kind === "set_flag" && o.flag === "nexus_built")).toBe(true);
  });

  it("has a growing catalog (at least the EP2 additions above the Phase-1 set)", () => {
    // Pre-existing: energy_cell, base_alloy_ingot, advanced_alloy_ingot,
    // nanomaterial_block, mfr_001_build (5). After EP2: 9.
    expect(RECIPES.length).toBeGreaterThanOrEqual(9);
  });
});

describe("Phase 3 missions", () => {
  it.each([["M007"], ["M008"], ["M009"]])("mission %s is registered", (id) => {
    expect(getMission(id)).not.toBeNull();
  });

  it("mission ids are unique across the whole registry", () => {
    const ids = listAllMissions().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("M007 requires missions_unlocked and is sequential", () => {
    const m = getMission("M007")!;
    expect(m.unlockRequires).toContain("missions_unlocked");
    expect(m.sequential).toBe(true);
  });

  it("M007 tasks gate on the previous device's online flag", () => {
    const m = getMission("M007")!;
    const t = Object.fromEntries(m.tasks.map((t) => [t.id, t]));
    expect(t["m007.task.condenser"].unlockRequires).toEqual(["smt_01_online"]);
    expect(t["m007.task.mixer"].unlockRequires).toEqual(["cnd_01_online"]);
  });

  it("M009 tracks the same flag EP2.bottleneck gates on", () => {
    const m = getMission("M009")!;
    const obj = m.tasks[0].objectives[0];
    expect(obj.type).toBe("flag");
    expect(obj.target).toBe("abstractum_bottleneck_observed");
  });
});

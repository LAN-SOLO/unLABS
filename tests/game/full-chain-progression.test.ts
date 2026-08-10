import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  advanceStep,
  canAdvanceStep,
  cascadeAdvance,
  createInitialQuestState,
  getCurrentStep,
  getEpisode,
  isTriggerSatisfied,
  listRegisteredEpisodes,
  setQuestFlag,
  type Episode,
  type QuestState,
  type StepReward,
  type StepTrigger,
} from "@/lib/game/quests";
import { SKIPPED_EPISODE_ID } from "@/lib/game/tutorial/types";
import { TECH_NODES } from "@/lib/game/techTree";

/**
 * Full-chain progression test (NEXT_STEPS 0.1.28 pt. 1)
 * =====================================================
 *
 * The git history of this project is littered with "quest stuck" fixes: a
 * step gates on a flag that nothing in the shipped game can set, and the
 * player is stranded. This suite simulates the ENTIRE flag chain EP0 → EP6
 * through the pure quest engine and fails if any step of any episode can
 * get stuck — catching the whole bug class instead of one instance at a
 * time.
 *
 * Trigger flags can come from exactly three legitimate sources:
 *
 *   1. A `set_flag` reward of an EARLIER step / episode-completion.
 *   2. The client bridge: `setQuestFlagAction` in
 *      app/(game)/actions/quest.ts accepts flags on the server allow-list
 *      `CLIENT_SETTABLE_FLAGS` plus terminal command flags matching
 *      `CMD_FLAG_PATTERN` (`cmd:<name>`, written by Terminal.tsx).
 *   3. The server-trusted tech-tree path: `claimResearch`
 *      (app/(game)/actions/research.ts) persists every `set_flag` effect of
 *      a claimed TechNode (lib/game/techTree/catalog.ts) straight into
 *      profiles.quest_state.flags — this is how `research_explorer_drone`
 *      (EP3 "drone_protocol") gets set.
 *
 * A flag/command trigger whose key is reachable through NONE of these
 * sources is the "quest stuck" bug and must fail this suite.
 *
 * Why the allow-list is parsed from source instead of imported:
 * app/(game)/actions/quest.ts is a `"use server"` module — Next.js only
 * permits async function exports from such files, so `CLIENT_SETTABLE_FLAGS`
 * and `CMD_FLAG_PATTERN` cannot be exported without breaking the build.
 * Parsing keeps a single source of truth; if the constants are renamed or
 * restructured the loader below fails loudly.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The flag key `isTriggerSatisfied` reads for a trigger; null for continue. */
function triggerFlagKey(trigger: StepTrigger): string | null {
  switch (trigger.kind) {
    case "continue":
      return null;
    case "flag":
      return trigger.flag;
    case "command":
      return `cmd:${trigger.command}`;
  }
}

/** Follow nextEpisode pointers from EP0; guards against cycles. */
function episodeChainFromEP0(): Episode[] {
  const chain: Episode[] = [];
  const seen = new Set<string>();
  let cur: Episode | null = getEpisode("EP0");
  while (cur) {
    if (seen.has(cur.id)) throw new Error(`nextEpisode cycle at ${cur.id}`);
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.nextEpisode ? getEpisode(cur.nextEpisode) : null;
  }
  return chain;
}

function setTrueFlags(rewards: StepReward[] | undefined): string[] {
  return (rewards ?? [])
    .filter((r): r is Extract<StepReward, { kind: "set_flag" }> => r.kind === "set_flag")
    .filter((r) => r.value === true)
    .map((r) => r.flag);
}

/** Server allow-list, parsed from the "use server" action module (see header). */
function loadServerAllowList(): { allowList: Set<string>; cmdPattern: RegExp } {
  // Resolved from the vitest root (= repo root, see vitest.config.ts) —
  // import.meta.url is an http: URL under the jsdom environment.
  const src = readFileSync(join(process.cwd(), "app", "(game)", "actions", "quest.ts"), "utf8");
  const setMatch = src.match(/CLIENT_SETTABLE_FLAGS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!setMatch) throw new Error("CLIENT_SETTABLE_FLAGS not found in actions/quest.ts");
  // Strip line comments first — they contain quoted prose that must not
  // leak into the allow-list.
  const body = setMatch[1].replace(/\/\/.*$/gm, "");
  const allowList = new Set([...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  const patMatch = src.match(/CMD_FLAG_PATTERN\s*=\s*\/(.+)\/;/);
  if (!patMatch) throw new Error("CMD_FLAG_PATTERN not found in actions/quest.ts");
  return { allowList, cmdPattern: new RegExp(patMatch[1]) };
}

/** Flags the server-trusted claimResearch path can set (source 3). */
function techTreeSetTrueFlags(): Set<string> {
  return new Set(TECH_NODES.flatMap((node) => setTrueFlags(node.effects)));
}

/** Simulated resource side of the reward stream (pure-engine equivalent). */
interface Ledger {
  rates: Record<string, number>;
  capacities: Record<string, number>;
  granted: Record<string, number>;
}

function applyRewardsToLedger(ledger: Ledger, rewards: StepReward[]): void {
  for (const r of rewards) {
    switch (r.kind) {
      case "set_resource_rate":
        ledger.rates[r.resourceId] = r.ratePerSecond;
        break;
      case "set_resource_capacity":
        ledger.capacities[r.resourceId] = r.capacity;
        break;
      case "grant_resource":
        ledger.granted[r.resourceId] = (ledger.granted[r.resourceId] ?? 0) + r.amount;
        break;
      case "set_flag":
        // Flags live in QuestState.flags — the engine applies them itself.
        break;
    }
  }
}

/**
 * Walk the whole chain exactly like a player would: continue-steps are
 * clicked, flag-steps get exactly the flag their trigger names (derived, not
 * hardcoded), command-steps get `cmd:<command>`. Asserts step-by-step that
 * nothing is skipped, nothing completes twice, and every flag-gated step is
 * actually blocked until its flag arrives.
 */
function playerWalk(): {
  state: QuestState;
  chain: Episode[];
  completionLog: Array<{ episodeId: string; stepId: string }>;
  ledger: Ledger;
  completedEpisodes: string[];
} {
  const chain = episodeChainFromEP0();
  let state = createInitialQuestState(chain[0].id);
  const completionLog: Array<{ episodeId: string; stepId: string }> = [];
  const ledger: Ledger = { rates: {}, capacities: {}, granted: {} };
  const completedEpisodes: string[] = [];

  for (const episode of chain) {
    expect(state.episodeId).toBe(episode.id);
    expect(state.currentStepIndex).toBe(0);

    for (const step of episode.steps) {
      expect(getCurrentStep(state)?.id).toBe(step.id);

      const key = triggerFlagKey(step.trigger);
      if (key !== null) {
        // No earlier reward may pre-satisfy a trigger — that would let the
        // engine silently auto-skip player-facing content.
        expect(
          state.flags[key],
          `${episode.id}/${step.id}: trigger "${key}" pre-set by an earlier reward`,
        ).toBeUndefined();

        // The step must be genuinely gated: without the flag, advance is a
        // no-op with no rewards.
        expect(canAdvanceStep(state)).toBe(false);
        const blocked = advanceStep(state);
        expect(blocked.state.currentStepIndex).toBe(state.currentStepIndex);
        expect(blocked.rewards).toEqual([]);

        // The derived key must be exactly what the engine resolves.
        expect(isTriggerSatisfied(step.trigger, { [key]: true })).toBe(true);
        state = setQuestFlag(state, key, true);
      }

      expect(canAdvanceStep(state)).toBe(true);
      const prevIndex = state.currentStepIndex;
      const result = advanceStep(state);
      completionLog.push({ episodeId: episode.id, stepId: step.id });
      applyRewardsToLedger(ledger, result.rewards);

      const isLast = prevIndex === episode.steps.length - 1;
      if (isLast) {
        expect(result.episodeCompleted).toBe(true);
        completedEpisodes.push(episode.id);
        if (episode.nextEpisode) {
          expect(result.nextEpisodeId).toBe(episode.nextEpisode);
          expect(result.state.episodeId).toBe(episode.nextEpisode);
          expect(result.state.currentStepIndex).toBe(0);
          expect(result.state.completedStepIds).toEqual([]);
        } else {
          // Terminal episode: state parks past the end, overlay hides.
          expect(result.state.episodeId).toBe(episode.id);
          expect(result.state.currentStepIndex).toBe(episode.steps.length);
        }
      } else {
        expect(result.episodeCompleted).toBe(false);
        // Exactly one step forward — never a skip, never a repeat.
        expect(result.state.currentStepIndex).toBe(prevIndex + 1);
        expect(result.state.completedStepIds).toEqual(
          episode.steps.slice(0, prevIndex + 1).map((s) => s.id),
        );
      }
      state = result.state;
    }
  }

  return { state, chain, completionLog, ledger, completedEpisodes };
}

// ---------------------------------------------------------------------------
// 1. Chain topology
// ---------------------------------------------------------------------------

describe("full chain — episode topology", () => {
  it("EP0's nextEpisode chain covers every registered episode exactly once and ends at EP6", () => {
    const chain = episodeChainFromEP0();
    expect(chain.map((e) => e.id)).toEqual(["EP0", "EP1", "EP2", "EP3", "EP4", "EP5", "EP6"]);
    // Chain == registry (no orphaned episodes, no dangling nextEpisode).
    const registered = listRegisteredEpisodes()
      .map((e) => e.id)
      .sort();
    expect(chain.map((e) => e.id).sort()).toEqual(registered);
    // EP6 is terminal.
    expect(chain[chain.length - 1].id).toBe("EP6");
    expect(chain[chain.length - 1].nextEpisode).toBeUndefined();
    // Every non-terminal pointer resolves.
    for (const ep of chain) {
      if (ep.nextEpisode) {
        expect(getEpisode(ep.nextEpisode), `${ep.id}.nextEpisode dangling`).not.toBeNull();
      }
    }
  });

  it("the chain totals exactly 32 steps (EP0:6 EP1:5 EP2:4 EP3:4 EP4:4 EP5:4 EP6:5)", () => {
    const chain = episodeChainFromEP0();
    expect(chain.map((e) => e.steps.length)).toEqual([6, 5, 4, 4, 4, 4, 5]);
    const total = chain.reduce((sum, e) => sum + e.steps.length, 0);
    expect(total).toBe(32);
  });

  it("step ids are globally unique across the whole chain", () => {
    const ids = episodeChainFromEP0().flatMap((e) => e.steps.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// 2. The core walk — EP0 → EP6 as a player
// ---------------------------------------------------------------------------

describe("full chain — player walk EP0 → EP6", () => {
  it("reaches every episode's terminal state; no step skipped or completed twice", () => {
    const { state, chain, completionLog, completedEpisodes } = playerWalk();

    // (a) every episode was completed, in chain order.
    expect(completedEpisodes).toEqual(chain.map((e) => e.id));

    // (b) the chain ends in EP6 as the terminal episode.
    expect(state.episodeId).toBe("EP6");
    expect(getCurrentStep(state)).toBeNull();
    expect(state.currentStepIndex).toBe(getEpisode("EP6")!.steps.length);

    // (c) completion log is exactly the chain's steps, in order, no dupes.
    const expected = chain.flatMap((e) => e.steps.map((s) => ({ episodeId: e.id, stepId: s.id })));
    expect(completionLog).toEqual(expected);
    expect(new Set(completionLog.map((c) => c.stepId)).size).toBe(completionLog.length);

    // (d) total completed steps == chain total == 32.
    expect(completionLog).toHaveLength(32);

    // A double-advance past the end stays a no-op (idempotent terminal).
    const again = advanceStep(state);
    expect(again.state).toEqual(state);
    expect(again.rewards).toEqual([]);
  });

  it("milestone flags survive the whole chain (rewards + completionRewards applied)", () => {
    const { state } = playerWalk();
    // Step-reward milestones.
    expect(state.flags.ep0_complete).toBe(true); // ep0.seep step reward (EP0 has no completionRewards)
    expect(state.flags.osc_001_online).toBe(true);
    expect(state.flags.anomaly_mode).toBe(true);
    expect(state.flags.research_unlocked).toBe(true);
    expect(state.flags.tutorial_graduated).toBe(true);
    expect(state.flags.ENDGAME_UNLOCKED).toBe(true);
    expect(state.flags.marketplace_visible).toBe(true);
    expect(state.flags.anomaly_topology_mapped).toBe(true);
    expect(state.flags.anomaly_resolved).toBe(true);
    // Completion-reward milestones (EP1 sets missions_unlocked instead of a
    // *_complete flag; EP2–EP6 set epN_complete).
    expect(state.flags.missions_unlocked).toBe(true);
    for (const n of [2, 3, 4, 5, 6]) {
      expect(state.flags[`ep${n}_complete`], `ep${n}_complete missing after full walk`).toBe(true);
    }
  });

  it("applies the reward stream to a simulated resource ledger", () => {
    // Pinned on purpose: content tuning must update these deliberately.
    const { ledger } = playerWalk();
    // Capacities.
    expect(ledger.capacities.energy).toBe(500); // ep0.ignite
    expect(ledger.capacities.exotic_matter).toBe(25); // ep5.exotic_containment
    expect(ledger.capacities.antimatter).toBe(10); // ep5.breakthrough
    // Rates — set_resource_rate overwrites: ep1.power_on's 32 replaces
    // ep0.ignite's 50.
    expect(ledger.rates.energy).toBe(32);
    expect(ledger.rates.abstractum).toBeCloseTo(1 / 60);
    expect(ledger.rates.exotic_matter).toBeCloseTo(1 / 60); // ep6.teleport_pad
    expect(ledger.rates.research).toBe(1); // ep6.singularity
    // Grants (summed across the chain).
    expect(ledger.granted.abstractum).toBe(5); // ep0.handoff starter
    expect(ledger.granted.base_alloy).toBe(10); // ep2.first_job
    expect(ledger.granted.research).toBe(1 + 3 + 2 + 5 + 10 + 15); // = 36
    expect(ledger.granted.exotic_matter).toBe(5 + 10); // ep5.deep_scan + ep6.resolution
    expect(ledger.granted.antimatter).toBe(10); // ep6.resolution
  });
});

// ---------------------------------------------------------------------------
// 3. Stuck detection — every trigger flag must have a setter
// ---------------------------------------------------------------------------

describe("full chain — stuck detection (every trigger flag has a legitimate setter)", () => {
  it("the source-parsed allow-list looks sane (guards the parser itself)", () => {
    const { allowList, cmdPattern } = loadServerAllowList();
    expect(allowList.size).toBeGreaterThanOrEqual(20);
    // Spot checks against known members.
    expect(allowList.has("grid_online")).toBe(true);
    expect(allowList.has("lissajous_locked")).toBe(true);
    expect(allowList.has("singularity_achieved")).toBe(true);
    // Comment prose must not have leaked in.
    for (const flag of allowList) expect(flag).toMatch(/^[a-z0-9_]+$/i);
    // The cmd pattern accepts the real EP0 bridge flag and rejects junk.
    expect(cmdPattern.test("cmd:dmesg")).toBe(true);
    expect(cmdPattern.test("grid_online")).toBe(false);
  });

  it("tech-tree effects cover research_explorer_drone (server path via claimResearch)", () => {
    // EP3 "drone_protocol" is NOT client-settable — it is set server-side
    // when claimResearch applies the TOOLS_T2 explorer-drone node effects.
    expect(techTreeSetTrueFlags().has("research_explorer_drone")).toBe(true);
  });

  it("every flag/command trigger in EP0→EP6 is settable by rewards, the client bridge, or the tech tree", () => {
    const { allowList, cmdPattern } = loadServerAllowList();
    const techFlags = techTreeSetTrueFlags();
    const chain = episodeChainFromEP0();

    // Flags set by rewards of steps strictly BEFORE the step under test
    // (a step's own rewards fire after its trigger, so they can't unstick it).
    const earlierRewardFlags = new Set<string>();

    for (const episode of chain) {
      for (const step of episode.steps) {
        const key = triggerFlagKey(step.trigger);
        if (key !== null) {
          const settable =
            earlierRewardFlags.has(key) ||
            allowList.has(key) ||
            cmdPattern.test(key) ||
            techFlags.has(key);
          expect(
            settable,
            `QUEST-STUCK: ${episode.id}/${step.id} gates on "${key}" but no earlier reward, ` +
              `CLIENT_SETTABLE_FLAGS entry, cmd:* bridge, or tech-tree effect can set it`,
          ).toBe(true);
        }
        for (const flag of setTrueFlags(step.rewards)) earlierRewardFlags.add(flag);
      }
      for (const flag of setTrueFlags(episode.completionRewards)) earlierRewardFlags.add(flag);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Cascade robustness — heal property from every mid-chain state
// ---------------------------------------------------------------------------

describe("full chain — cascadeAdvance robustness from every mid-chain state", () => {
  /** Every flag any source could set, all true — the maximal save. */
  function fullFlagSet(): Record<string, boolean> {
    const flags: Record<string, boolean> = {};
    for (const episode of episodeChainFromEP0()) {
      for (const step of episode.steps) {
        const key = triggerFlagKey(step.trigger);
        if (key !== null) flags[key] = true;
        for (const f of setTrueFlags(step.rewards)) flags[f] = true;
      }
      for (const f of setTrueFlags(episode.completionRewards)) flags[f] = true;
    }
    for (const f of techTreeSetTrueFlags()) flags[f] = true;
    return flags;
  }

  it("never throws and moves monotonically forward from any (episode, step) with all flags set", () => {
    const chain = episodeChainFromEP0();
    const chainIndex = new Map(chain.map((e, i) => [e.id, i]));
    const fullFlags = fullFlagSet();

    for (const episode of chain) {
      // Include the past-the-end index — a terminal/legacy save shape.
      for (let stepIndex = 0; stepIndex <= episode.steps.length; stepIndex++) {
        const start: QuestState = {
          episodeId: episode.id,
          currentStepIndex: stepIndex,
          completedStepIds: [],
          flags: { ...fullFlags },
        };
        const result = cascadeAdvance(start); // must not throw

        // Monotone: same episode with index >= start, or a later episode.
        const fromIdx = chainIndex.get(episode.id)!;
        const toIdx = chainIndex.get(result.state.episodeId);
        expect(
          toIdx,
          `${episode.id}@${stepIndex} cascaded to unknown ${result.state.episodeId}`,
        ).toBeDefined();
        if (toIdx === fromIdx) {
          expect(result.state.currentStepIndex).toBeGreaterThanOrEqual(stepIndex);
        } else {
          expect(toIdx!).toBeGreaterThan(fromIdx);
        }

        // No step recorded twice on the way through.
        const ids = result.state.completedStepIds;
        expect(new Set(ids).size).toBe(ids.length);

        // Fixpoint: cascading the healed state again goes nowhere new.
        const again = cascadeAdvance(result.state);
        expect(again.state.episodeId).toBe(result.state.episodeId);
        expect(again.state.currentStepIndex).toBe(result.state.currentStepIndex);
      }
    }
  });

  it("with NO flags set, cascade is a strict no-op from every mid-chain state", () => {
    // Continue steps must never be walked by the background cascade, and
    // flag steps are unsatisfied — so an empty flag map may not move at all.
    for (const episode of episodeChainFromEP0()) {
      for (let stepIndex = 0; stepIndex < episode.steps.length; stepIndex++) {
        const start: QuestState = {
          episodeId: episode.id,
          currentStepIndex: stepIndex,
          completedStepIds: [],
          flags: {},
        };
        const result = cascadeAdvance(start);
        expect(result.state.episodeId).toBe(episode.id);
        expect(result.state.currentStepIndex).toBe(stepIndex);
        expect(result.rewards).toEqual([]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Edge cases — SKIPPED sentinel + completion rewards
// ---------------------------------------------------------------------------

describe("full chain — SKIPPED sentinel stays outside the chain", () => {
  it("SKIPPED is not a registered episode and nothing chains into it", () => {
    expect(getEpisode(SKIPPED_EPISODE_ID)).toBeNull();
    for (const ep of listRegisteredEpisodes()) {
      expect(ep.nextEpisode).not.toBe(SKIPPED_EPISODE_ID);
      expect(ep.id).not.toBe(SKIPPED_EPISODE_ID);
    }
  });

  it("advance and cascade are safe no-ops on a SKIPPED save", () => {
    const state = createInitialQuestState(SKIPPED_EPISODE_ID);
    expect(getCurrentStep(state)).toBeNull();
    expect(canAdvanceStep(state)).toBe(false);

    const advanced = advanceStep(state);
    expect(advanced.state).toEqual(state);
    expect(advanced.rewards).toEqual([]);
    expect(advanced.episodeCompleted).toBe(false);

    const cascaded = cascadeAdvance(state);
    expect(cascaded.state).toEqual(state);
    expect(cascaded.rewards).toEqual([]);
  });
});

describe("full chain — completionRewards shape", () => {
  it("EP2–EP6 set their epN_complete flag in completionRewards; EP0 sets it at ep0.seep; EP1 sets missions_unlocked", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const ep = getEpisode(`EP${n}`)!;
      expect(
        setTrueFlags(ep.completionRewards),
        `EP${n} completionRewards missing ep${n}_complete`,
      ).toContain(`ep${n}_complete`);
    }
    // EP0: completionRewards intentionally empty — ep0_complete fires early
    // (ep0.seep) so the basic grid unlocks while EP0 is still active.
    const ep0 = getEpisode("EP0")!;
    expect(ep0.completionRewards ?? []).toEqual([]);
    const seep = ep0.steps.find((s) => s.id === "ep0.seep")!;
    expect(setTrueFlags(seep.rewards)).toContain("ep0_complete");
    // EP1: unlocks missions instead of a *_complete flag.
    expect(setTrueFlags(getEpisode("EP1")!.completionRewards)).toContain("missions_unlocked");
  });
});

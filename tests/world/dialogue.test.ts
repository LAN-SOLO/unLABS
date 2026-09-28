/**
 * Dialogue: every option is asked once.
 * =====================================
 *
 * After an option was chosen (its `said_` flag is set) it is not offered
 * again — in English and German. Only `repeatable` options come back, and
 * only when their answer would differ from the one already shown. Effects
 * (flags, insights, items) apply once; the "Already asked" replay is pure.
 */
import { describe, expect, it } from "vitest";
import { NPCS } from "@/lib/world/content/story";
import {
  answerSignature,
  askedDialogueOptions,
  chooseDialogue,
  dialogueAnswer,
  dialogueOptions,
  initialState,
  saidKey,
} from "@/lib/world/game";
import type { DialogueOption, WorldState } from "@/lib/world/types";
import { loadGame } from "./localeGame";

type Game = Awaited<ReturnType<typeof loadGame>>;

/** Ask every offered non-repeatable option; return the labels asked. */
function askAll(g: Game["game"], s: WorldState, npcId: string): string[] {
  const asked: string[] = [];
  for (const o of g.dialogueOptions(s, npcId)) {
    if (o.repeatable) continue;
    if (g.chooseDialogue(s, npcId, o.label).ok) asked.push(o.label);
  }
  return asked;
}

describe.each(["en", "de"] as const)("dialogue options are asked once (%s)", (locale) => {
  it("an asked option disappears and cannot be chosen again", async () => {
    const g = await loadGame(locale);
    const s = g.game.initialState();
    const asked = askAll(g.game, s, "mcp");
    expect(asked.length).toBeGreaterThan(1);
    const offered = g.game.dialogueOptions(s, "mcp").map((o) => o.label);
    for (const label of asked) {
      expect(offered, label).not.toContain(label);
      expect(g.game.chooseDialogue(s, "mcp", label).ok, label).toBe(false);
    }
    // They show up in the read-only "Already asked" list instead.
    const done = g.game.askedDialogueOptions(s, "mcp").map((o) => o.label);
    expect(done).toEqual(expect.arrayContaining(asked));
  });

  it("P1N-DR0: “What are you looking for?” is not offered twice", async () => {
    const g = await loadGame(locale);
    const s = g.game.initialState();
    const before = g.game.dialogueOptions(s, "p1ndr0");
    expect(before.length).toBeGreaterThanOrEqual(2);
    const asked = askAll(g.game, s, "p1ndr0");
    expect(asked.length).toBe(before.length);
    expect(g.game.dialogueOptions(s, "p1ndr0")).toEqual([]);
  });
});

describe("repeatable options", () => {
  it("only the MCP's hint is repeatable", () => {
    const rep = NPCS.flatMap((n) => n.options.filter((o) => o.repeatable).map(() => n.id));
    expect(rep).toEqual(["mcp"]);
    const hint = NPCS.find((n) => n.id === "mcp")!.options.find((o) => o.repeatable)!;
    expect(hint.lines.some((l) => l.text === "__HINT__")).toBe(true);
    expect(hint.grants ?? []).toEqual([]);
    expect(hint.flags ?? []).toEqual([]);
    expect(hint.takes ?? []).toEqual([]);
  });

  it("the hint comes back only when its answer changed", () => {
    const s = initialState();
    const hint = dialogueOptions(s, "mcp").find((o) => o.repeatable)!;
    const r = chooseDialogue(s, "mcp", hint.label);
    expect(r.ok).toBe(true);
    const shown = new Set([answerSignature(s, "mcp", hint)]);
    expect(dialogueOptions(s, "mcp", shown).map((o) => o.label)).not.toContain(hint.label);
    // Progress changes the hint → it is offered again.
    s.puzzles.pz_geo_valve = true;
    expect(dialogueOptions(s, "mcp", shown).map((o) => o.label)).toContain(hint.label);
  });

  it("effects of a repeatable option apply only the first time", () => {
    const mcp = NPCS.find((n) => n.id === "mcp")!;
    const probe: DialogueOption = {
      label: "__test probe__",
      repeatable: true,
      lines: [{ who: "mcp", text: "probe" }],
      flags: ["probe_flag"],
      grants: ["cold_start"],
    };
    mcp.options.push(probe);
    try {
      const s = initialState();
      const first = chooseDialogue(s, "mcp", probe.label);
      expect(first.insights).toContain("cold_start");
      expect(s.flags.probe_flag).toBe(true);
      delete s.flags.probe_flag;
      const again = chooseDialogue(s, "mcp", probe.label);
      expect(again.ok).toBe(true);
      expect(again.insights).toEqual([]);
      expect(s.flags.probe_flag).toBeUndefined();
    } finally {
      mcp.options.splice(mcp.options.indexOf(probe), 1);
    }
  });
});

describe("“Already asked” replay", () => {
  it("reading an asked answer again changes nothing", () => {
    const s = initialState();
    for (const o of dialogueOptions(s, "mcp")) chooseDialogue(s, "mcp", o.label);
    const before = structuredClone(s);
    const asked = askedDialogueOptions(s, "mcp");
    expect(asked.length).toBeGreaterThan(0);
    for (const o of asked) expect(dialogueAnswer(s, o).length).toBeGreaterThan(0);
    expect(s).toEqual(before);
  });

  it("hand-overs are not listed as questions", () => {
    for (const npc of NPCS) {
      const s = initialState();
      for (const o of npc.options) s.flags[saidKey(npc.id, o)] = true;
      for (const o of askedDialogueOptions(s, npc.id)) expect(o.takes ?? []).toEqual([]);
    }
  });
});

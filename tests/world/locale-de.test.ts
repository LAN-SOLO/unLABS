/**
 * Both languages play the same game.
 * ==================================
 *
 * The Lab World is English-first; German comes from `lib/i18n/de/*`. Content
 * tables evaluate `tr()` at import, so the German game is a *separate module
 * graph* (see `localeGame.ts`). These tests load the game once per locale and
 * check that the translation changed only text, never rules:
 *
 *  - the greedy playthrough reaches every ending, bot and slice in German too,
 *    with the identical sequence of events as in English;
 *  - the completionist run covers everything (achievements, dialogue, puzzles,
 *    notes, recipes, rooms …) in German as well;
 *  - dialogue labels are real translations, unique per NPC, and their
 *    `said_` keys are identical in both languages.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGame, type LoadedGame } from "./localeGame";

let en: LoadedGame;
let de: LoadedGame;

beforeAll(async () => {
  en = await loadGame("en");
  de = await loadGame("de");
}, 60_000);

afterAll(() => {
  de?.i18n.__setLocaleForTests(null);
  en?.i18n.__setLocaleForTests(null);
});

describe("locale graphs", () => {
  it("really are English and German", () => {
    expect(en.i18n.getLocale()).toBe("en");
    expect(de.i18n.getLocale()).toBe("de");
    const cellEn = en.items.ITEM_BY_ID.get("energiezelle")!.name;
    const cellDe = de.items.ITEM_BY_ID.get("energiezelle")!.name;
    expect(cellEn).toBe("Energy Cell");
    expect(cellDe).toBe("Energiezelle");
  });

  it("keep every id, count and number identical (only text differs)", () => {
    const ids = (g: LoadedGame) => ({
      devices: g.devices.DEVICES.map((d) => [d.id, d.room, d.power, d.needs, d.stages.length]),
      items: g.items.ITEMS.map((i) => [i.id, i.kind, i.traits, i.volatility]),
      recipes: g.items.RECIPES.map((r) => [r.inputs, r.output, r.station ?? null]),
      pickups: g.map.PICKUPS.map((p) => [p.id, p.floor, p.x, p.z, p.items, p.puzzle ?? null]),
      notes: g.map.NOTES.map((n) => [n.id, n.floor, n.x, n.z, n.grants ?? []]),
      props: g.map.PROPS.map((p) => [p.id, p.kind, p.floor, p.x, p.z, p.puzzle ?? null]),
      doors: g.map.DOORS.map((d) => [d.id, d.floor, d.x, d.z, d.keypad ?? null, d.lock ?? null]),
      puzzles: g.puzzles.PUZZLES.map((p) => [p.id, p.kind, p.reward ?? null]),
      insights: g.story.INSIGHTS.map((i) => [i.id, i.auto ?? null]),
      endings: g.story.ENDINGS.map((e) => [e.id, e.device, e.requires]),
      bots: g.story.BOT_QUESTS.map((q) => [q.npc, q.flag]),
      npcs: g.story.NPCS.map((n) => [
        n.id,
        n.floor,
        n.x,
        n.z,
        n.visible ?? null,
        n.options.map((o) => [o.when ?? null, o.flags ?? [], o.grants ?? [], o.takes ?? []]),
      ]),
      achievements: g.achievements.ACHIEVEMENTS.map((a) => a.id),
      devicePuzzles: Object.entries(g.devices.DEVICE_PUZZLES).map(([dev, hooks]) => [
        dev,
        hooks.map((h) => [h.puzzle, h.requires ?? null]),
      ]),
    });
    expect(ids(de)).toEqual(ids(en));
  });
});

describe("greedy playthrough in German", () => {
  it("reaches every ending, bot and slice — with the same event sequence as in English", () => {
    const runEn = en.sim.play();
    const runDe = de.sim.play();
    const s = runDe.s;

    const missing = de.devices.DEVICES.filter((d) => !de.game.isBuilt(s, d.id)).map(
      (d) => `${d.id}: ${de.game.checkStage(s, d.id)?.blockers.join(" | ")}`,
    );
    expect(missing, missing.join("\n")).toEqual([]);
    expect(Object.keys(s.endings).sort()).toEqual(de.story.ENDINGS.map((e) => e.id).sort());
    expect(de.story.BOT_QUESTS.filter((q) => !s.flags[q.flag]).map((q) => q.npc)).toEqual([]);
    expect(de.map.SLICE_PICKUPS.filter((id) => s.taken[id] === undefined)).toEqual([]);
    expect(s.counters.slices).toBe(de.items.SLICE_TOTAL);

    // Rules must not depend on the language: identical progress, step by step.
    expect(runDe.steps).toBe(runEn.steps);
    expect(runDe.triggers).toEqual(runEn.triggers);
    expect(s.flags).toEqual(runEn.s.flags);
    expect(s.inventory).toEqual(runEn.s.inventory);
    expect(s.built).toEqual(runEn.s.built);
    expect(s.insights).toEqual(runEn.s.insights);
  });

  it("the completionist run covers everything, including every achievement", () => {
    const { run, report } = de.cov.fullRun();
    expect(de.sim.defaultDone(run.s)).toBe(true);
    const lines = Object.entries(report)
      .filter(([, l]) => l.length)
      .map(([k, l]) => `${k}: ${l.join(", ")}`);
    expect(lines, `Not reached in German:\n${lines.join("\n")}`).toEqual([]);
    expect(
      de.achievements.ACHIEVEMENTS.filter((a) => !de.achievements.isUnlocked(run.s, a.id)),
    ).toEqual([]);
  });
});

describe("dialogue in both languages", () => {
  it("every NPC option label is the dictionary translation of its English source", () => {
    const untranslated: string[] = [];
    en.story.NPCS.forEach((npc, i) => {
      const deNpc = de.story.NPCS[i]!;
      expect(deNpc.id).toBe(npc.id);
      expect(deNpc.options).toHaveLength(npc.options.length);
      npc.options.forEach((o, j) => {
        const label = deNpc.options[j]!.label;
        expect(label.trim().length, `${npc.id}#${j}`).toBeGreaterThan(0);
        // The English label, or a `context::label` key that shows as it.
        const sources = [...en.DE].filter(
          ([k]) => k === o.label || k.endsWith(`${en.i18n.CONTEXT_SEPARATOR}${o.label}`),
        );
        if (sources.length === 0) untranslated.push(`${npc.id}: ${o.label}`);
        else
          expect(
            sources.map(([, v]) => v),
            `${npc.id}: ${o.label}`,
          ).toContain(label);
      });
    });
    expect(untranslated).toEqual([]);
  });

  it("labels are unique per NPC in both languages (options are chosen by label)", () => {
    for (const g of [en, de])
      for (const npc of g.story.NPCS) {
        const labels = npc.options.map((o) => o.label);
        expect(new Set(labels).size, `${g.locale} ${npc.id}`).toBe(labels.length);
      }
  });

  it("saidKey is identical in English and German for every option", () => {
    en.story.NPCS.forEach((npc, i) => {
      npc.options.forEach((o, j) => {
        const deOpt = de.story.NPCS[i]!.options[j]!;
        const k = en.game.saidKey(npc.id, o);
        expect(k).toBe(`said_${npc.id}_${o.label}`);
        expect(de.game.saidKey(npc.id, deOpt), `${npc.id}: ${deOpt.label}`).toBe(k);
      });
    });
  });

  it("every German label maps back to exactly its own English source (save migration)", () => {
    const wrong: string[] = [];
    en.story.NPCS.forEach((npc, i) =>
      npc.options.forEach((o, j) => {
        const label = de.story.NPCS[i]!.options[j]!.label;
        const back = de.i18n.englishOf(label);
        if (back !== o.label) wrong.push(`${npc.id}: ${label} → ${back} (want ${o.label})`);
      }),
    );
    expect(wrong).toEqual([]);
  });

  it("bot quests point at a real option in both languages", () => {
    for (const g of [en, de])
      for (const q of g.story.BOT_QUESTS) {
        const npc = g.story.NPCS.find((n) => n.id === q.npc)!;
        const o = npc.options.find((x) => x.label === q.option);
        expect(o, `${g.locale} ${q.npc}: ${q.option}`).toBeDefined();
        expect(o!.flags).toContain(q.flag);
      }
  });

  it("the __HINT__ placeholder line is never translated", () => {
    const hints = (g: LoadedGame) =>
      g.story.NPCS.flatMap((n) =>
        n.options.flatMap((o, j) =>
          o.lines.filter((l) => l.text === "__HINT__").map(() => `${n.id}#${j}`),
        ),
      );
    expect(hints(en).length).toBeGreaterThan(0);
    expect(hints(de)).toEqual(hints(en));
  });

  it("choosing a German option sets the English-keyed flag and never re-offers it", () => {
    const s = de.game.initialState();
    const o = de.game.dialogueOptions(s, "mcp")[0]!;
    expect(de.game.chooseDialogue(s, "mcp", o.label).ok).toBe(true);
    const i = de.story.NPCS.find((n) => n.id === "mcp")!.options.indexOf(o);
    const enLabel = en.story.NPCS.find((n) => n.id === "mcp")!.options[i]!.label;
    expect(s.flags[`said_mcp_${enLabel}`]).toBe(true);
    expect(s.flags[`said_mcp_${o.label}`]).toBeUndefined();
    if (!o.repeatable)
      expect(de.game.dialogueOptions(s, "mcp").map((x) => x.label)).not.toContain(o.label);
  });
});

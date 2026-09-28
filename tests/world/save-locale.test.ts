/**
 * Old saves and New Game+ keep working in both languages.
 * ========================================================
 *
 * Before the translation, dialogue flags were keyed by the German label
 * (`said_mcp_Wer bist du?`). Saves of format v1 (no `held_` flags, often no
 * version at all) and v2 carry those German keys; v3 keys them by the English
 * source label. These tests take a real mid-game state from the simulated
 * player, turn it back into a v1 / v2 blob with German dialogue keys, load it
 * through every entry point (readSave, a save slot, the legacy single save)
 * in either language, and play it to the end. Answered one-time options must
 * stay answered; nothing may be offered twice.
 *
 * New Game+ is played through completely in English and German as well.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WorldState } from "@/lib/world/types";
import { loadGame, type LoadedGame } from "./localeGame";

/** Steps of the greedy player for the mid-game fixture (a full game takes ~33). */
const MID_STEPS = 8;

let en: LoadedGame;
let de: LoadedGame;
/** English mid-game state (some dialogue done, far from finished). */
let mid: WorldState;
/** English said_ key → the German key an old save used for it. */
let germanKey: Map<string, string>;

beforeAll(async () => {
  en = await loadGame("en");
  de = await loadGame("de");
  mid = en.sim.play({ maxSteps: MID_STEPS }).s;
  germanKey = new Map();
  en.story.NPCS.forEach((npc, i) =>
    npc.options.forEach((o, j) => {
      const deLabel = de.story.NPCS[i]!.options[j]!.label;
      germanKey.set(en.game.saidKey(npc.id, o), `said_${npc.id}_${deLabel}`);
    }),
  );
}, 60_000);

afterAll(() => {
  de?.i18n.__setLocaleForTests(null);
  en?.i18n.__setLocaleForTests(null);
});

beforeEach(() => localStorage.clear());

type Raw = Record<string, unknown> & { flags: Record<string, boolean> };

/** The mid-game state as an old save of format `version` (1 = versionless, pre-held_). */
function oldSave(version: 1 | 2, versionless = false): Raw {
  const raw = JSON.parse(JSON.stringify(mid)) as Raw;
  const flags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw.flags)) {
    if (version === 1 && k.startsWith("held_")) continue;
    flags[germanKey.get(k) ?? k] = v;
  }
  raw.flags = flags;
  if (versionless) delete raw.version;
  else raw.version = version;
  return raw;
}

function saidFlags(s: WorldState): string[] {
  return Object.keys(s.flags)
    .filter((k) => k.startsWith("said_") && s.flags[k])
    .sort();
}

/** Continue a loaded state with the greedy player; it must finish everything. */
function finish(g: LoadedGame, s: WorldState): WorldState {
  const run = g.sim.play({}, { s, steps: 0, triggers: [], said: new Set(), samples: [] });
  expect(g.sim.defaultDone(run.s), `${g.locale}: not finished after ${run.steps} steps`).toBe(true);
  const missing = g.devices.DEVICES.filter((d) => !g.game.isBuilt(run.s, d.id)).map((d) => d.id);
  expect(missing).toEqual([]);
  return run.s;
}

/** No option that was already answered is on offer again (unless repeatable). */
function noRepeats(g: LoadedGame, s: WorldState): void {
  const repeats: string[] = [];
  for (const npc of g.story.NPCS)
    for (const o of g.game.dialogueOptions(s, npc.id))
      if (!o.repeatable && s.flags[g.game.saidKey(npc.id, o)])
        repeats.push(`${npc.id}: ${o.label}`);
  expect(repeats).toEqual([]);
}

describe("fixture", () => {
  it("is a real mid-game state with answered dialogue", () => {
    expect(saidFlags(mid).length).toBeGreaterThan(3);
    expect(en.sim.defaultDone(mid)).toBe(false);
    expect(Object.keys(mid.built).length).toBeGreaterThan(1);
    expect(Object.keys(mid.endings)).toEqual([]);
    // Old saves really differ: at least one key is German.
    const old = oldSave(2);
    expect(saidFlags(mid).some((k) => !(k in old.flags))).toBe(true);
  });

  it("NPC ids contain no underscore (the v2 → v3 migration splits said_<npc>_<label>)", () => {
    for (const n of en.story.NPCS) expect(n.id, n.id).not.toContain("_");
  });
});

describe("old saves with German dialogue keys", () => {
  for (const loc of ["en", "de"] as const) {
    describe(`loaded in ${loc}`, () => {
      const g = () => (loc === "en" ? en : de);

      for (const [label, make] of [
        ["v1 (versionless)", () => oldSave(1, true)],
        ["v1", () => oldSave(1)],
        ["v2", () => oldSave(2)],
      ] as const) {
        it(`${label}: migrates to the current format with English keys and plays to the end`, () => {
          const r = g().save.readSave(make());
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          const s = r.state;
          expect(s.version).toBe(g().game.SAVE_VERSION);
          expect(saidFlags(s)).toEqual(saidFlags(mid));
          for (const id of Object.keys(mid.inventory))
            if ((mid.inventory[id] ?? 0) > 0) expect(s.flags[`held_${id}`], id).toBe(true);
          expect(s.built).toEqual(mid.built);
          expect(s.insights).toEqual(mid.insights);
          noRepeats(g(), s);
          finish(g(), s);
        });
      }

      it("a v2 slot loads through loadSlot and becomes the active game", () => {
        localStorage.setItem(g().save.slotKey("slot2"), JSON.stringify(oldSave(2)));
        localStorage.setItem(g().save.MIGRATED_KEY, "1");
        const s = g().save.loadSlot("slot2");
        expect(s).not.toBeNull();
        expect(saidFlags(s!)).toEqual(saidFlags(mid));
        expect(
          g()
            .save.listSlots()
            .find((x) => x.id === "slot2")?.corrupt ?? false,
        ).toBe(false);
        noRepeats(g(), s!);
        finish(g(), s!);
      });

      it("a versionless legacy single save is moved into slot 1", () => {
        localStorage.setItem(g().save.SAVE_KEY, JSON.stringify(oldSave(1, true)));
        const s = g().save.loadSlot("slot1");
        expect(s).not.toBeNull();
        expect(s!.version).toBe(g().game.SAVE_VERSION);
        expect(saidFlags(s!)).toEqual(saidFlags(mid));
        expect(g().save.getActiveSlot()).toBe("slot1");
      });

      it("export → import round-trips a migrated save", () => {
        localStorage.setItem(g().save.MIGRATED_KEY, "1");
        localStorage.setItem(g().save.slotKey("slot3"), JSON.stringify(oldSave(2)));
        const text = g().save.exportSave("slot3");
        const res = g().save.importSave("slot1", text);
        expect(res.ok).toBe(true);
        const s = g().save.loadSlot("slot1")!;
        expect(saidFlags(s)).toEqual(saidFlags(mid));
      });
    });
  }

  it("a save written in German loads identically in English (and vice versa)", () => {
    const deRun = de.sim.play({ maxSteps: MID_STEPS }).s;
    const back = en.save.readSave(JSON.parse(JSON.stringify(deRun)));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(saidFlags(back.state)).toEqual(saidFlags(mid));
    expect(back.state.flags).toEqual(mid.flags);
    noRepeats(en, back.state);
    const there = de.save.readSave(JSON.parse(JSON.stringify(mid)));
    expect(there.ok && there.state.flags).toEqual(deRun.flags);
  });
});

describe("New Game+ in both languages", () => {
  for (const loc of ["en", "de"] as const) {
    it(`${loc}: a finished game starts NG+ and completes it again`, () => {
      const g = loc === "en" ? en : de;
      const first = g.sim.play().s;
      expect(g.sim.defaultDone(first)).toBe(true);

      localStorage.setItem(g.save.MIGRATED_KEY, "1");
      const s = g.save.newGamePlusGame("slot2", first);
      expect(s.flags[g.postgame.NG_PLUS_FLAG]).toBe(true);
      expect(s.counters[g.postgame.NG_PLUS_COUNTER]).toBe(1);
      for (const e of g.story.ENDINGS)
        expect(s.flags[g.postgame.legacyEndingFlag(e.id)], e.id).toBe(true);
      expect(saidFlags(s)).toEqual([]); // dialogue is new again
      expect(Object.keys(s.endings)).toEqual([]);

      // The MCP greets with an NG+ line in the player's language.
      const greeting = g.game.dialogueGreeting(s, "mcp").map((l) => l.text);
      expect(greeting.some((t) => g.postgame.NG_PLUS_MCP_LINES.includes(t))).toBe(true);
      if (loc === "de")
        expect(g.postgame.NG_PLUS_MCP_LINES[0]).toBe(
          g.DE.get(
            "Dr. Lawrence. Cold start. Again. I have the feeling I have already logged this sentence.",
          ),
        );

      // Reload from the slot (as the title screen would) and play it out.
      const loaded = g.save.loadSlot("slot2")!;
      expect(loaded.flags[g.postgame.NG_PLUS_FLAG]).toBe(true);
      const done = finish(g, loaded);
      expect(Object.keys(done.endings).sort()).toEqual(g.story.ENDINGS.map((e) => e.id).sort());
      expect(g.postgame.endingStats(done).endingsFound).toBe(g.story.ENDINGS.length);
    });
  }
});

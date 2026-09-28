/**
 * Dialogue "said" flags are keyed by the English source label, so they
 * survive a language switch; old (German-keyed) saves are migrated v2 → v3.
 */
import { afterEach, describe, expect, it } from "vitest";
import { __setLocaleForTests, englishOf, sourceOf } from "@/lib/i18n";
import { DE } from "@/lib/i18n/de";
import { NPCS } from "@/lib/world/content/story";
import {
  SAVE_VERSION,
  chooseDialogue,
  dialogueOptions,
  initialState,
  saidKey,
} from "@/lib/world/game";
import { migrateSave } from "@/lib/world/save-sanitize";

afterEach(() => __setLocaleForTests(null));

/** A dialogue option whose English label has a German translation. */
function translatedOption(): { npc: string; en: string; de: string } {
  for (const n of NPCS)
    for (const o of n.options) {
      const de = DE.get(o.label);
      if (de && de !== o.label) return { npc: n.id, en: o.label, de };
    }
  throw new Error("no translated dialogue label found");
}

describe("said flags", () => {
  it("sourceOf maps a German label back to its English source", () => {
    const { en, de } = translatedOption();
    expect(englishOf(de)).toBe(en);
    expect(sourceOf(en)).toBe(en);
    __setLocaleForTests("de");
    expect(sourceOf(de)).toBe(en);
    expect(sourceOf("no such text")).toBe("no such text");
  });

  it("saidKey is the same in English and German", () => {
    const { npc, en, de } = translatedOption();
    const opt = NPCS.find((n) => n.id === npc)!.options.find((o) => o.label === en)!;
    const english = saidKey(npc, opt);
    __setLocaleForTests("de");
    expect(saidKey(npc, { ...opt, label: de })).toBe(english);
    expect(english).toBe(`said_${npc}_${en}`);
  });

  it("choosing an option sets the English-keyed flag", () => {
    const s = initialState();
    const o = dialogueOptions(s, "mcp")[0]!;
    expect(chooseDialogue(s, "mcp", o.label).ok).toBe(true);
    expect(s.flags[`said_mcp_${o.label}`]).toBe(true);
  });

  it("migrates German said_ flags of a v2 save to English keys", () => {
    const { npc, en, de } = translatedOption();
    const raw = {
      ...initialState(),
      version: 2,
      flags: { [`said_${npc}_${de}`]: true, said_mcp_unknown: true, geo_routed: true },
    };
    const r = migrateSave(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.version).toBe(SAVE_VERSION);
    const flags = r.data.flags as Record<string, unknown>;
    expect(flags[`said_${npc}_${en}`]).toBe(true);
    expect(flags[`said_${npc}_${de}`]).toBeUndefined();
    expect(flags.said_mcp_unknown).toBe(true);
    expect(flags.geo_routed).toBe(true);
  });
});

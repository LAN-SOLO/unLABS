/**
 * Jade's signature looks (content/looks.ts, rules in lib/world/wardrobe.ts)
 * and the v6 → v7 save migration of the 2026 rework.
 */
import { describe, expect, it } from "vitest";
import { LOOK_BY_ID, SIGNATURE_LOOKS } from "@/lib/world/content/looks";
import {
  DEFAULT_LOOK,
  LEGACY_DEFAULT_LOOK,
  WEAR_BY_ID,
  WEAR_SLOTS,
  WEAR_SLOT_BY_ID,
} from "@/lib/world/content/wardrobe";
import { initialState } from "@/lib/world/game";
import { BOT_QUESTS } from "@/lib/world/content/story";
import { jadeRig, posedVoxels, rigBounds } from "@/lib/world/models/rig";
import { readSave } from "@/lib/world/save";
import {
  cloneLook,
  equip,
  grantWear,
  lookMissing,
  lookUnlocked,
  looksProgress,
  sanitizeWardrobe,
  syncLooks,
  visibleLook,
  wardrobeTick,
  wearLook,
  wearingLook,
} from "@/lib/world/wardrobe";
import type { WorldState } from "@/lib/world/types";

/** Bot flags (the wardrobe derives `bots_awake` from them). */
function wakeAllBots(s: WorldState): void {
  for (const q of BOT_QUESTS) s.flags[q.flag] = true;
}

const kinds = (k: string) => SIGNATURE_LOOKS.filter((l) => l.unlock.kind === k);

describe("signature look catalogue", () => {
  it("has eighteen complete, distinct looks", () => {
    expect(SIGNATURE_LOOKS).toHaveLength(18);
    expect(new Set(SIGNATURE_LOOKS.map((l) => l.id)).size).toBe(18);
    const keys = new Set<string>();
    for (const l of SIGNATURE_LOOKS) {
      expect(l.name.length, l.id).toBeGreaterThan(3);
      expect(l.description.length, l.id).toBeGreaterThan(20);
      // Every slot spelled out: set or explicitly null.
      expect(Object.keys(l.look).sort(), l.id).toEqual([...WEAR_SLOTS].sort());
      for (const slot of WEAR_SLOTS) {
        const e = l.look[slot];
        if (!e) {
          expect(WEAR_SLOT_BY_ID.get(slot)!.optional, `${l.id}.${slot}`).toBe(true);
          continue;
        }
        const w = WEAR_BY_ID.get(e.item);
        expect(w?.slot, `${l.id}.${slot}`).toBe(slot);
        expect(
          w!.colorways.some((c) => c.id === e.colorway),
          `${l.id}.${slot}.${e.colorway}`,
        ).toBe(true);
      }
      keys.add(WEAR_SLOTS.map((k) => `${l.look[k]?.item}.${l.look[k]?.colorway}`).join("|"));
    }
    expect(keys.size).toBe(18);
    // None of them is simply the first-day look.
    expect(SIGNATURE_LOOKS.some((l) => wearingLook(DEFAULT_LOOK) === l.id)).toBe(false);
  });

  it("spreads the unlocks: ~6 start/replicator, ~5 finds, ≥7 events", () => {
    expect(kinds("start").length + kinds("craft").length).toBe(6);
    expect(kinds("find")).toHaveLength(5);
    expect(kinds("event").length).toBeGreaterThanOrEqual(7);
    const sources = (l: (typeof SIGNATURE_LOOKS)[number]) =>
      WEAR_SLOTS.flatMap((k) => (l.look[k] ? [WEAR_BY_ID.get(l.look[k]!.item)!] : []));
    for (const l of kinds("start"))
      for (const w of sources(l)) expect(w.source.kind, `${l.id}: ${w.id}`).toBe("start");
    for (const l of kinds("craft"))
      for (const w of sources(l))
        expect(["start", "craft"], `${l.id}: ${w.id}`).toContain(w.source.kind);
    for (const l of kinds("find")) {
      expect(
        sources(l).some((w) => w.source.kind === "find"),
        l.id,
      ).toBe(true);
      for (const w of sources(l)) expect(w.source.kind, `${l.id}: ${w.id}`).not.toBe("reward");
    }
    // Start / craft / find looks never need a dye (they unlock by owning the pieces).
    for (const l of [...kinds("start"), ...kinds("craft"), ...kinds("find")])
      for (const k of WEAR_SLOTS) {
        const e = l.look[k];
        if (!e) continue;
        const c = WEAR_BY_ID.get(e.item)!.colorways.find((x) => x.id === e.colorway)!;
        expect(c.dye, `${l.id}.${k}`).toBeUndefined();
      }
    for (const l of kinds("event"))
      if (l.unlock.kind === "event") expect(l.unlock.hint.length, l.id).toBeGreaterThan(10);
  });

  it("every look builds within budget and stays under the door frame", () => {
    for (const l of SIGNATURE_LOOKS) {
      const def = jadeRig(visibleLook(l.look));
      expect(posedVoxels(def).length, l.id).toBeLessThan(10000);
      for (const p of def.parts)
        expect(p.model.grid.count(), `${l.id}/${p.name}`).toBeLessThanOrEqual(2600);
      const [min, max] = rigBounds(def);
      expect(max[1] - min[1], l.id).toBeLessThan(6);
    }
  });
});

describe("unlocking looks", () => {
  it("unlocks the starter looks on the first tick, and nothing else", () => {
    const s = initialState();
    const got = wardrobeTick(s).looks;
    expect(got.sort()).toEqual(
      kinds("start")
        .map((l) => l.id)
        .sort(),
    );
    expect(syncLooks(s)).toEqual([]);
    expect(looksProgress(s)).toEqual({ unlocked: 2, worn: 0, total: 18 });
  });

  it("unlocks a replicator look once every piece is owned", () => {
    const s = initialState();
    const l = LOOK_BY_ID.get("surface_winter")!;
    expect(lookMissing(s, l).pieces.length).toBeGreaterThan(0);
    for (const id of lookMissing(s, l).pieces) grantWear(s, id, "craft");
    expect(syncLooks(s)).toContain("surface_winter");
    expect(lookUnlocked(s, "surface_winter")).toBe(true);
  });

  it("event looks hand over every missing piece and dyed colour", () => {
    const s = initialState();
    s.flags.studio_open = true;
    const r = wardrobeTick(s);
    expect(r.looks).toContain("studio_session");
    expect(s.wardrobe.owned.gig_bag).toBe(true);
    expect(s.wardrobe.owned.headphones).toBe(true);
    // Ten awake bots: the festival brings its own pieces and dyes.
    const t = initialState();
    wakeAllBots(t);
    expect(syncLooks(t)).toContain("neon_festival");
    for (const id of ["top_neon", "flower_crown", "glow_bands", "shorts_tights"])
      expect(t.wardrobe.owned[id], id).toBe(true);
    expect(t.wardrobe.dyes["sneakers.neon"]).toBe(true);
    expect(t.wardrobe.dyes["hair_ponytail.magenta"]).toBe(true);
    expect(lookMissing(t, LOOK_BY_ID.get("neon_festival")!)).toEqual({ pieces: [], dyes: [] });
  });

  it("the secret look waits for the secret ending", () => {
    const s = initialState();
    s.flags.ending_frequenz = true;
    s.flags.ending_substrat = true;
    s.flags.ending_rueckkehr = true;
    s.flags.ending_halo = true;
    const got = syncLooks(s);
    expect(got).toContain("hero_of_the_halo");
    expect(got).toContain("forge_ceremony");
    expect(got).not.toContain("crystal_0089");
    s.flags.ending_kristall = true;
    expect(syncLooks(s)).toEqual(["crystal_0089"]);
  });
});

describe("wearing looks", () => {
  function withLook(id: string): WorldState {
    const s = initialState();
    wakeAllBots(s);
    s.flags.studio_open = true;
    wardrobeTick(s);
    expect(lookUnlocked(s, id)).toBe(true);
    return s;
  }

  it("puts the whole look on at the wardrobe and remembers it was worn", () => {
    const s = withLook("studio_session");
    const r = wearLook(s, "studio_session", true);
    expect(r.waiting).toBe(false);
    expect(wearingLook(s.wardrobe.look)).toBe("studio_session");
    expect(s.flags.look_on_studio_session).toBe(true);
    expect(s.wardrobe.looksWorn.studio_session).toBe(true);
    expect(looksProgress(s).worn).toBe(1);
    // Changing one piece ends the look (the flag goes, the memory stays).
    equip(s, "wrist", null, undefined, true);
    wardrobeTick(s);
    expect(s.flags.look_on_studio_session).toBeUndefined();
    expect(s.wardrobe.looksWorn.studio_session).toBe(true);
  });

  it("away from the wardrobe only gadgets and accessories change", () => {
    const s = withLook("neon_festival");
    const r = wearLook(s, "neon_festival", false);
    expect(r.waiting).toBe(true);
    expect(s.wardrobe.look.head?.item).toBe("flower_crown");
    expect(s.wardrobe.look.wrist?.item).toBe("glow_bands");
    expect(s.wardrobe.look.top?.item).toBe(DEFAULT_LOOK.top!.item);
    expect(s.wardrobe.looksWorn.neon_festival).toBeUndefined();
  });

  it("refuses locked looks", () => {
    const s = initialState();
    expect(wearLook(s, "gala_night", true).changed).toEqual([]);
    expect(wearLook(s, "nope", true).changed).toEqual([]);
  });

  it("sanitises looks and worn marks", () => {
    const w = sanitizeWardrobe({
      looks: { weekend: 12, nope: 3, gala_night: -1, lab_lead: "x" },
      looksWorn: { weekend: true, nope: true },
    });
    expect(w.looks).toEqual({ weekend: 12 });
    expect(w.looksWorn).toEqual({ weekend: true });
  });
});

describe("save v7 (Jade's rework)", () => {
  function v6(look: typeof DEFAULT_LOOK, owned: Record<string, true>): Record<string, unknown> {
    const raw = JSON.parse(JSON.stringify(initialState())) as Record<string, unknown>;
    raw.version = 6;
    raw.wardrobe = { owned, look: cloneLook(look), dyes: {}, presets: [], found: {}, seen: {} };
    return raw;
  }
  const oldStarters = {
    sweater_teal: true,
    turtleneck: true,
    tee_unlab: true,
    labcoat: true,
    cargo_dark: true,
    jeans: true,
    boots_leather: true,
    sneakers: true,
    hair_ponytail: true,
    hair_bun: true,
    hair_loose: true,
    hair_bob: true,
    goggles_amber: true,
    safety_glasses: true,
    nitrile: true,
    toolbelt: true,
    watch: true,
    flannel: true,
  } as const;

  it("moves a save still wearing the old first-day look to the new one", () => {
    const r = readSave(v6(LEGACY_DEFAULT_LOOK, { ...oldStarters }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = r.state.wardrobe;
    expect(w.look).toEqual(DEFAULT_LOOK);
    // Old pieces stay, the new starter pieces are in the wardrobe.
    for (const id of Object.keys(oldStarters)) expect(w.owned[id], id).toBe(true);
    expect(w.owned.shirt_collar_geo).toBe(true);
    expect(w.owned.hair_updo).toBe(true);
    expect(w.looks).toEqual({});
    expect(w.looksWorn).toEqual({});
  });

  it("keeps any look the player chose", () => {
    const mine = { ...cloneLook(LEGACY_DEFAULT_LOOK), top: { item: "flannel", colorway: "red" } };
    const r = readSave(v6(mine, { ...oldStarters }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.wardrobe.look).toEqual(mine);
    // The old ponytail in auburn is still there to wear.
    expect(r.state.wardrobe.look.hair).toEqual({ item: "hair_ponytail", colorway: "auburn" });
  });
});

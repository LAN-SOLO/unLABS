/**
 * Jade's wardrobe — rules (lib/world/wardrobe.ts).
 *
 * Equipping (clothes only at the wardrobe), presets, dyes, replicator jobs
 * and their timing, recycling, rewards, the pickup route for `wear:` finds,
 * worn flags, "Surprise me" and the v5 → v6 save migration round trip.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOOK,
  DYE_SECONDS,
  REFINE_RECIPES,
  REPLICATOR_INTRO_FLAG,
  WEAR_BY_ID,
  WEAR_ITEMS,
  WEAR_SLOTS,
} from "@/lib/world/content/wardrobe";
import { PICKUPS } from "@/lib/world/content/map";
import { ENDINGS } from "@/lib/world/content/story";
import { addItem, evalCond, initialState, takePickup } from "@/lib/world/game";
import { readSave } from "@/lib/world/save-sanitize";
import type { WorldState } from "@/lib/world/types";
import {
  applyPreset,
  canRecycle,
  craftStatus,
  dyeStatus,
  equip,
  equipBlocked,
  finishJob,
  grantWear,
  jobProgress,
  jobRemaining,
  lookSignature,
  recycle,
  recycleYield,
  refineStatus,
  replicatorIntro,
  savePreset,
  startCraft,
  startDye,
  startRefine,
  surpriseLook,
  syncWearRewards,
  visibleLook,
  wardrobeCounters,
  wardrobeStats,
  wardrobeTick,
} from "@/lib/world/wardrobe";

/** A state with enough power on the grid for the replicator (≥ 50 W). */
function powered(): WorldState {
  const s = initialState();
  // The Universal Energy Converter (a starter blueprint) alone gives more than 50 W.
  s.built["UEC-001"] = 3;
  s.switchedOn["UEC-001"] = true;
  return s;
}

describe("equipping", () => {
  it("starts with the default look and the starter pieces", () => {
    const s = initialState();
    expect(s.wardrobe.look).toEqual(DEFAULT_LOOK);
    for (const w of WEAR_ITEMS)
      expect(!!s.wardrobe.owned[w.id], w.id).toBe(w.source.kind === "start");
    expect(wardrobeStats(s).changedSlots).toBe(0);
  });

  it("changes clothes, shoes and hair only at the wardrobe", () => {
    const s = initialState();
    expect(equipBlocked(s, "top", "turtleneck", undefined, false)).toMatch(/wardrobe/);
    expect(equip(s, "top", "turtleneck", undefined, false)).toBe(false);
    expect(equip(s, "top", "turtleneck", "navy", true)).toBe(true);
    expect(s.wardrobe.look.top).toEqual({ item: "turtleneck", colorway: "navy" });
    // Gear and accessories change anywhere.
    expect(equip(s, "face", "safety_glasses", undefined, false)).toBe(true);
    expect(equip(s, "head", null, undefined, false)).toBe(true);
    expect(s.wardrobe.look.head).toBeNull();
    expect(s.counters.wear_changes).toBe(3);
  });

  it("refuses unowned pieces, wrong slots, undyed colours and bare required slots", () => {
    const s = initialState();
    expect(equip(s, "head", "hardhat", undefined, true)).toBe(false);
    expect(equip(s, "head", "sweater_teal", undefined, true)).toBe(false);
    expect(equip(s, "outer", "labcoat", "black", true)).toBe(false); // dye first
    expect(equip(s, "top", null, undefined, true)).toBe(false);
    expect(s.counters.wear_changes ?? 0).toBe(0);
  });

  it("does not count putting on what is already worn", () => {
    const s = initialState();
    expect(equip(s, "top", "sweater_teal", "teal", true)).toBe(false);
    expect(s.counters.wear_changes ?? 0).toBe(0);
  });

  it("mirrors the visible look into worn_ flags (a full-face helmet hides the face slot)", () => {
    const s = initialState();
    grantWear(s, "fake_mustache", "find");
    grantWear(s, "welding_helmet", "craft");
    equip(s, "face", "fake_mustache", undefined, false);
    expect(s.flags.worn_fake_mustache).toBe(true);
    equip(s, "head", "welding_helmet", undefined, false);
    expect(visibleLook(s.wardrobe.look).face).toBeNull();
    expect(s.flags.worn_fake_mustache).toBeUndefined();
    expect(s.flags.worn_welding_helmet).toBe(true);
    expect(s.flags.worn_goggles_amber).toBeUndefined();
  });
});

describe("presets and surprise", () => {
  it("saves and applies outfits; away from the wardrobe only gear changes", () => {
    const s = initialState();
    equip(s, "top", "turtleneck", "black", true);
    equip(s, "face", "safety_glasses", undefined, true);
    expect(savePreset(s, 0, "  Night shift  ")).toBe(true);
    expect(s.wardrobe.presets[0]?.name).toBe("Night shift");
    equip(s, "top", "sweater_teal", "teal", true);
    equip(s, "face", null, undefined, true);
    const away = applyPreset(s, 0, false);
    expect(away).toEqual(["face"]);
    expect(s.wardrobe.look.top?.item).toBe("sweater_teal");
    expect(applyPreset(s, 0, true)).toEqual(["top"]);
    expect(s.wardrobe.look.top).toEqual({ item: "turtleneck", colorway: "black" });
    expect(applyPreset(s, 3, true)).toEqual([]);
    expect(savePreset(s, 9, "x")).toBe(false);
  });

  it("surprise only uses owned pieces and available colours", () => {
    const s = initialState();
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 20; i++) {
      surpriseLook(s, true, rand);
      for (const slot of WEAR_SLOTS) {
        const e = s.wardrobe.look[slot];
        if (!e) continue;
        expect(s.wardrobe.owned[e.item], e.item).toBe(true);
        const c = WEAR_BY_ID.get(e.item)!.colorways.find((x) => x.id === e.colorway)!;
        expect(c.dye, `${e.item}.${e.colorway}`).toBeUndefined();
      }
    }
    // Away from the wardrobe the clothes stay.
    const top = s.wardrobe.look.top;
    surpriseLook(s, false, rand);
    expect(s.wardrobe.look.top).toEqual(top);
  });
});

describe("replicator", () => {
  it("needs power to start a job", () => {
    const s = initialState();
    addItem(s, "stoffreste", 5);
    expect(craftStatus(s, "fingerless").state).toBe("offline");
    expect(startCraft(s, "fingerless")).toBe(false);
  });

  it("crafts a piece: pays, runs for its seconds, hands it over on finish", () => {
    const s = powered();
    expect(evalCond(s, { power: 50 })).toBe(true);
    const w = WEAR_BY_ID.get("scarf")!;
    if (w.source.kind !== "craft") throw new Error("scarf is a craft piece");
    expect(craftStatus(s, "scarf").state).toBe("missing");
    expect(craftStatus(s, "scarf").missing).toEqual({ stoffreste: 2 });
    addItem(s, "stoffreste", 3);
    expect(craftStatus(s, "scarf").state).toBe("ready");
    expect(startCraft(s, "scarf")).toBe(true);
    expect(s.inventory.stoffreste).toBe(1);
    // One job at a time.
    addItem(s, "stoffreste", 3);
    expect(craftStatus(s, "joggers").state).toBe("busy");
    expect(startCraft(s, "joggers")).toBe(false);
    s.playTime += w.source.seconds / 2;
    expect(jobProgress(s)).toBeCloseTo(0.5, 5);
    expect(jobRemaining(s)).toBeCloseTo(w.source.seconds / 2, 5);
    expect(finishJob(s)).toBeNull();
    s.playTime += w.source.seconds / 2;
    const done = finishJob(s);
    expect(done?.kind).toBe("craft");
    expect(s.wardrobe.owned.scarf).toBe(true);
    expect(s.wardrobe.crafted).toBe(1);
    expect(s.wardrobe.job).toBeNull();
    expect(craftStatus(s, "scarf").state).toBe("owned");
  });

  it("keeps locked patterns locked until their condition holds", () => {
    const s = powered();
    addItem(s, "stoffreste", 5);
    addItem(s, "farbpigment", 5);
    expect(craftStatus(s, "cape").state).toBe("locked");
    s.endings[ENDINGS[0]!.id] = true;
    expect(craftStatus(s, "cape").state).toBe("ready");
    expect(craftStatus(s, "labcoat_patched").state).toBe("locked");
    s.counters.combo_explosion = 1;
    expect(wardrobeCounters(s).explosions).toBe(1);
    expect(craftStatus(s, "labcoat_patched").state).not.toBe("locked");
  });

  it("refines textiles", () => {
    const s = powered();
    const r = REFINE_RECIPES.find((x) => x.id === "fibre_harness")!;
    expect(refineStatus(s, r.id).state).toBe("missing");
    addItem(s, "kabelbaum", 1);
    expect(startRefine(s, r.id)).toBe(true);
    expect(s.inventory.kabelbaum ?? 0).toBe(0);
    s.playTime += r.seconds;
    expect(finishJob(s)?.kind).toBe("refine");
    expect(s.inventory.polymerfaser).toBe(r.count);
    expect(s.counters.wear_refined).toBe(1);
  });

  it("dyes a colourway once; afterwards it is free", () => {
    const s = powered();
    expect(dyeStatus(s, "labcoat", "black").state).toBe("missing");
    addItem(s, "farbpigment", 3);
    expect(startDye(s, "labcoat", "black")).toBe(true);
    expect(s.inventory.farbpigment ?? 0).toBe(0);
    s.playTime += DYE_SECONDS;
    finishJob(s);
    expect(s.wardrobe.dyes["labcoat.black"]).toBe(true);
    expect(dyeStatus(s, "labcoat", "black").state).toBe("owned");
    expect(equip(s, "outer", "labcoat", "black", true)).toBe(true);
    expect(s.counters.wear_dyed).toBe(1);
  });

  it("recycles unworn replicated pieces for half their fabric", () => {
    const s = initialState();
    grantWear(s, "hoodie", "craft");
    expect(recycleYield("hoodie")).toEqual({ stoffreste: 2 });
    expect(canRecycle(s, "hoodie")).toBe(true);
    equip(s, "top", "hoodie", undefined, true);
    expect(canRecycle(s, "hoodie")).toBe(false);
    equip(s, "top", "sweater_teal", "teal", true);
    expect(recycle(s, "hoodie")).toEqual({ stoffreste: 2 });
    expect(s.wardrobe.owned.hoodie).toBeUndefined();
    expect(s.inventory.stoffreste).toBe(2);
    // Starter and found pieces never go into the maw.
    expect(canRecycle(s, "sweater_teal")).toBe(false);
    expect(recycle(s, "sweater_teal")).toBeNull();
  });

  it("writes Jade's intro log once", () => {
    const s = initialState();
    expect(replicatorIntro(s)).toBe(true);
    expect(s.flags[REPLICATOR_INTRO_FLAG]).toBe(true);
    expect(replicatorIntro(s)).toBe(false);
  });
});

describe("finds and rewards", () => {
  it("routes wear: pickups into the wardrobe, not the inventory", () => {
    const s = initialState();
    const p = PICKUPS.find((x) => x.id === "p_wear_flannel")!;
    const r = takePickup(s, p.id);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/Flannel shirt/);
    expect(s.wardrobe.owned.flannel).toBe(true);
    expect(s.wardrobe.found.flannel).toBeGreaterThan(0);
    expect(Object.keys(s.inventory).some((k) => k.startsWith("wear:"))).toBe(false);
    expect(s.counters.salvaged ?? 0).toBe(0);
    expect(takePickup(s, p.id).ok).toBe(false);
  });

  it("hands over reward pieces when their condition holds", () => {
    const s = initialState();
    expect(syncWearRewards(s)).toEqual([]);
    s.counters.slices = 10;
    s.flags.studio_open = true;
    const got = wardrobeTick(s).rewards;
    expect(got.sort()).toEqual(["hair_undercut", "headphones"]);
    expect(syncWearRewards(s)).toEqual([]);
  });
});

describe("save v6", () => {
  it("migrates a v5 save to the default wardrobe", () => {
    const raw = JSON.parse(JSON.stringify(initialState())) as Record<string, unknown>;
    delete raw.wardrobe;
    raw.version = 5;
    const r = readSave(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.wardrobe.look).toEqual(DEFAULT_LOOK);
    expect(r.state.wardrobe.owned.sweater_teal).toBe(true);
    expect(r.state.wardrobe.job).toBeNull();
  });

  it("keeps a full wardrobe through a JSON round trip", () => {
    const s = powered();
    grantWear(s, "hoodie", "craft");
    grantWear(s, "propeller_cap", "find");
    s.wardrobe.dyes["hoodie.lilac"] = true;
    equip(s, "top", "hoodie", "lilac", true);
    equip(s, "head", "propeller_cap", undefined, true);
    savePreset(s, 2, "Rainbow");
    addItem(s, "stoffreste", 2);
    startCraft(s, "fingerless");
    const back = readSave(JSON.parse(JSON.stringify(s)));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const w = back.state.wardrobe;
    expect(lookSignature(w.look)).toBe(lookSignature(s.wardrobe.look));
    expect(w.owned).toEqual(s.wardrobe.owned);
    expect(w.dyes).toEqual(s.wardrobe.dyes);
    expect(w.presets[2]?.name).toBe("Rainbow");
    expect(w.job).toEqual(s.wardrobe.job);
    expect(w.found).toEqual(s.wardrobe.found);
  });

  it("drops unknown pieces and falls back to the default for unowned worn ones", () => {
    const raw = JSON.parse(JSON.stringify(initialState())) as Record<string, unknown>;
    raw.wardrobe = {
      owned: { sweater_teal: true, not_a_piece: true },
      look: { top: { item: "hoodie", colorway: "black" }, head: { item: "nope", colorway: "x" } },
      dyes: { "hoodie.teal": true },
      job: { kind: "craft", id: "nope", start: 0, done: 1 },
      presets: [{ name: 5 }, "junk"],
    };
    const r = readSave(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = r.state.wardrobe;
    expect(w.owned.not_a_piece).toBeUndefined();
    expect(w.look.top).toEqual(DEFAULT_LOOK.top);
    expect(w.look.head).toEqual(DEFAULT_LOOK.head);
    expect(w.dyes).toEqual({});
    expect(w.job).toBeNull();
    expect(w.presets.every((p) => p === null)).toBe(true);
  });
});

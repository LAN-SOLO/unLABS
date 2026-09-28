/**
 * Biorhythm rules (lib/world/biorhythm.ts): activation, decay per setting,
 * clamping, effects, provisions (bag, fridge, fresh bonus, coffee), sleep,
 * training, the station props and the content hooks (items, models, codex,
 * achievements, hint, barks).
 */
import { describe, expect, it } from "vitest";
import {
  BIO_BALANCED_WALK,
  BIO_DECAY_PER_MIN,
  BIO_LOW_WALK,
  BIO_NEEDS,
  BIO_START,
  BIO_STATION_BY_PROP,
  CARRY_LIMIT,
  COFFEE_RESTORE,
  FRESH_BONUS,
  FRIDGE_CAPACITY,
  PROTEIN_BONUS,
  PROVISIONS,
  REPLICATOR_COOLDOWN,
  SLEEP_BELOW,
  SLEEP_SECONDS,
  TRAIN_COOLDOWN,
  TRAIN_GAIN,
  bagCount,
  bioActivate,
  bioActive,
  bioBarkDue,
  bioEffects,
  bioEnabled,
  bioTick,
  bioTips,
  bioValue,
  bioWalkMultiplier,
  consume,
  fridgeCount,
  fridgeStore,
  fridgeTake,
  fridgeTotal,
  minutesUntilLow,
  replicate,
  sleep,
  sleepBlocked,
  train,
  type BioNeed,
} from "@/lib/world/biorhythm";
import { ACHIEVEMENT_BY_ID, evaluateAchievements } from "@/lib/world/achievements";
import { CODEX_BY_ID, codexUnlocked } from "@/lib/world/content/codex";
import { BARKS } from "@/lib/world/content/barks";
import { PROP_VARIANT_DECOR } from "@/lib/world/content/decor-actions";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { PROPS, roomAt } from "@/lib/world/content/map";
import { DEVICES } from "@/lib/world/content/devices";
import { addItem, count, initialState, power } from "@/lib/world/game";
import { DECOR_BY_ID, decorModel, decorScale, decorVisual } from "@/lib/world/models/decor";
import { ICON_MAX, itemIconModel } from "@/lib/world/models/items";
import { propModel } from "@/lib/world/models";
import { mergeSettings, DEFAULT_SETTINGS } from "@/lib/world/settings";
import { HINTS, nextHint } from "@/lib/world/tutorial";
import type { WorldState } from "@/lib/world/types";

/** Fresh state standing on Level +1 with the rhythm started. */
function active(): WorldState {
  const s = initialState();
  s.floor = 4;
  expect(bioActivate(s)).toBe(true);
  return s;
}

function set(s: WorldState, need: BioNeed, v: number): void {
  s.counters[`bio_${need}`] = v;
}

/** Switch on generators until the grid has at least `w` watts. */
function powerUp(s: WorldState, w = 50): void {
  for (const d of DEVICES.filter((x) => x.power < 0)) {
    if (power(s).generation >= w) return;
    s.built[d.id] = d.stages.length;
    s.discovered[d.id] = true;
    s.switchedOn[d.id] = true;
  }
}

describe("activation", () => {
  it("stays hidden and full until Level +1 is reached", () => {
    const s = initialState();
    expect(bioActive(s)).toBe(false);
    bioTick(s, 3600, "normal");
    expect(bioActive(s)).toBe(false);
    for (const n of BIO_NEEDS) expect(bioValue(s, n)).toBe(100);
    expect(bioEffects(s, "normal")).toEqual({ status: "hidden", walk: 1, low: [] });
  });

  it("starts on the first visit to Level +1 (current floor or a visited room)", () => {
    const s = initialState();
    s.flags.visited_kantine = true;
    const r = bioTick(s, 1, "normal");
    expect(r.activated).toBe(true);
    expect(bioActive(s)).toBe(true);
    expect(bioTick(s, 1, "normal").activated).toBe(false);
    expect(bioValue(s, "fit")).toBeLessThan(BIO_START.fit + 0.01);
  });

  it("never starts while the setting is off", () => {
    const s = initialState();
    s.floor = 4;
    expect(bioTick(s, 60, "off").activated).toBe(false);
    expect(bioActive(s)).toBe(false);
    expect(bioEnabled(s, "normal")).toBe(false);
  });
});

describe("decay", () => {
  it("drops per minute of play at the documented rates", () => {
    const s = active();
    bioTick(s, 60, "normal");
    for (const n of BIO_NEEDS)
      expect(bioValue(s, n)).toBeCloseTo(BIO_START[n] - BIO_DECAY_PER_MIN[n], 5);
  });

  it("relaxed halves the decay, off freezes it", () => {
    const a = active();
    const b = active();
    bioTick(a, 600, "relaxed");
    bioTick(b, 600, "off");
    for (const n of BIO_NEEDS) {
      expect(bioValue(a, n)).toBeCloseTo(BIO_START[n] - BIO_DECAY_PER_MIN[n] * 5, 5);
      expect(bioValue(b, n)).toBe(BIO_START[n]);
    }
    expect(bioEnabled(b, "off")).toBe(false);
    expect(bioWalkMultiplier(b, "off")).toBe(1);
  });

  it("is slow: nothing gets low in the first 45 minutes", () => {
    const s = active();
    for (let t = 0; t < 45 * 60; t++) bioTick(s, 1, "normal");
    expect(bioEffects(s, "normal").status).not.toBe("low");
    expect(minutesUntilLow(s, "drink", "normal")!).toBeGreaterThan(0);
    expect(minutesUntilLow(s, "drink", "off")).toBeNull();
  });

  it("clamps to 0..100", () => {
    const s = active();
    bioTick(s, 999_999, "normal");
    for (const n of BIO_NEEDS) expect(bioValue(s, n)).toBe(0);
    set(s, "food", 500);
    expect(bioValue(s, "food")).toBe(100);
    set(s, "food", 95);
    for (let i = 0; i < 3; i++) {
      addBag(s, "naehrriegel");
      consume(s, "naehrriegel");
    }
    expect(bioValue(s, "food")).toBe(100);
  });
});

function addBag(s: WorldState, id: string, n = 1): void {
  s.counters[`bio_inv:${id}`] = (s.counters[`bio_inv:${id}`] ?? 0) + n;
}

describe("effects", () => {
  it("any need below 20 slows walking a little and never blocks", () => {
    const s = active();
    set(s, "drink", 10);
    expect(bioEffects(s, "normal")).toMatchObject({ status: "low", low: ["drink"] });
    expect(bioWalkMultiplier(s, "normal")).toBe(BIO_LOW_WALK);
    expect(BIO_LOW_WALK).toBeGreaterThanOrEqual(0.9);
    // Even at zero everything still works.
    for (const n of BIO_NEEDS) set(s, n, 0);
    powerUp(s);
    expect(replicate(s, "wasserflasche").ok).toBe(true);
    expect(train(s).ok).toBe(true);
    expect(sleep(s).ok).toBe(true);
  });

  it("balanced (all ≥ 60, fitness ≥ 70) gives a small bonus", () => {
    const s = active();
    expect(bioEffects(s, "normal").status).toBe("ok");
    set(s, "fit", 75);
    expect(bioEffects(s, "normal").status).toBe("balanced");
    expect(bioWalkMultiplier(s, "normal")).toBe(BIO_BALANCED_WALK);
    expect(BIO_BALANCED_WALK).toBeLessThanOrEqual(1.1);
    set(s, "food", 59);
    expect(bioEffects(s, "normal").status).toBe("ok");
  });

  it("low-need nudges are rate-limited", () => {
    const s = active();
    expect(bioBarkDue(s, "normal", 100)).toBe(false);
    set(s, "food", 5);
    expect(bioBarkDue(s, "normal", 100)).toBe(true);
    expect(bioBarkDue(s, "normal", 200)).toBe(false);
    expect(bioBarkDue(s, "normal", 400)).toBe(true);
    expect(bioBarkDue(s, "off", 10_000)).toBe(false);
  });

  it("offers tips only while enabled", () => {
    const s = active();
    set(s, "drink", 10);
    expect(bioTips(s, "normal").length).toBeGreaterThan(0);
    expect(bioTips(s, "off")).toEqual([]);
  });
});

describe("Food Replicator", () => {
  it("needs 50 W, prints into the bag and cools down", () => {
    const s = active();
    expect(replicate(s, "naehrriegel").ok).toBe(false);
    powerUp(s);
    const r = replicate(s, "naehrriegel");
    expect(r).toMatchObject({ ok: true, cooldownLeft: REPLICATOR_COOLDOWN, item: "naehrriegel" });
    expect(bagCount(s, "naehrriegel")).toBe(1);
    expect(replicate(s, "wasserflasche").ok).toBe(false);
    s.playTime += REPLICATOR_COOLDOWN;
    expect(replicate(s, "wasserflasche").ok).toBe(true);
    expect(replicate(s, "unbekannt", s.playTime + 999).ok).toBe(false);
  });

  it("keeps consumables out of the inventory and caps the bag", () => {
    const s = active();
    powerUp(s);
    for (let i = 0; i < CARRY_LIMIT + 2; i++)
      replicate(s, "protein_shake", i * REPLICATOR_COOLDOWN);
    expect(bagCount(s, "protein_shake")).toBe(CARRY_LIMIT);
    expect(s.inventory.protein_shake).toBeUndefined();
    for (const p of PROVISIONS) expect(ITEM_BY_ID.has(p.id), p.id).toBe(false);
  });
});

describe("eating and drinking", () => {
  it("restores the listed amounts from the bag", () => {
    const s = active();
    set(s, "food", 20);
    set(s, "drink", 20);
    addBag(s, "naehrriegel");
    addBag(s, "wasserflasche");
    expect(consume(s, "naehrriegel").gains).toEqual({ food: 35 });
    expect(consume(s, "wasserflasche").gains).toEqual({ drink: 40 });
    expect(bioValue(s, "food")).toBe(55);
    expect(bioValue(s, "drink")).toBe(60);
    expect(consume(s, "naehrriegel").ok).toBe(false);
  });

  it("food from the Neutro-Fridge is fresh (+25 %)", () => {
    const s = active();
    set(s, "food", 10);
    addBag(s, "naehrriegel", 2);
    expect(fridgeStore(s, "naehrriegel").ok).toBe(true);
    expect(fridgeCount(s, "naehrriegel")).toBe(1);
    const r = consume(s, "naehrriegel", "fridge");
    expect(r.fresh).toBe(true);
    expect(r.gains.food).toBeCloseTo(35 * FRESH_BONUS, 1);
    expect(fridgeCount(s, "naehrriegel")).toBe(0);
  });

  it("the fridge holds 12 and hands things back", () => {
    const s = active();
    addBag(s, "wasserflasche", FRIDGE_CAPACITY + 1);
    for (let i = 0; i < FRIDGE_CAPACITY; i++) expect(fridgeStore(s, "wasserflasche").ok).toBe(true);
    expect(fridgeTotal(s)).toBe(FRIDGE_CAPACITY);
    expect(fridgeStore(s, "wasserflasche").ok).toBe(false);
    expect(fridgeTake(s, "wasserflasche").ok).toBe(true);
    expect(fridgeTotal(s)).toBe(FRIDGE_CAPACITY - 1);
    expect(fridgeTake(s, "naehrriegel").ok).toBe(false);
  });

  it("coffee from the inventory counts as a drink with a little rest", () => {
    const s = active();
    set(s, "drink", 50);
    set(s, "rest", 50);
    addItem(s, "kaffee", 1);
    const r = consume(s, "kaffee");
    expect(r.ok).toBe(true);
    expect(r.gains).toEqual(COFFEE_RESTORE);
    expect(count(s, "kaffee")).toBe(0);
    expect(consume(s, "kaffee").ok).toBe(false);
  });

  it("does nothing before the rhythm started", () => {
    const s = initialState();
    addBag(s, "naehrriegel");
    expect(consume(s, "naehrriegel").ok).toBe(false);
  });
});

describe("sleep", () => {
  it("only below 90 rest; restores rest and skips a few minutes", () => {
    const s = active();
    expect(sleepBlocked(s)).not.toBeNull();
    expect(sleep(s).ok).toBe(false);
    set(s, "rest", 40);
    set(s, "food", 70);
    const t = s.playTime;
    const r = sleep(s);
    expect(r.ok).toBe(true);
    expect(bioValue(s, "rest")).toBe(100);
    expect(bioValue(s, "food")).toBe(70);
    expect(s.playTime).toBe(t + SLEEP_SECONDS);
    expect(s.counters.bio_woke_at).toBe(s.playTime);
    expect(SLEEP_BELOW).toBe(90);
  });
});

describe("training", () => {
  it("+15 fitness, small cost, 60 s cooldown", () => {
    const s = active();
    const r = train(s);
    expect(r.ok).toBe(true);
    expect(bioValue(s, "fit")).toBe(BIO_START.fit + TRAIN_GAIN);
    expect(bioValue(s, "drink")).toBe(95);
    expect(bioValue(s, "rest")).toBe(97);
    expect(train(s).ok).toBe(false);
    s.playTime += TRAIN_COOLDOWN;
    expect(train(s).ok).toBe(true);
  });

  it("a protein shake boosts the next workout once", () => {
    const s = active();
    addBag(s, "protein_shake");
    consume(s, "protein_shake");
    train(s);
    expect(bioValue(s, "fit")).toBeCloseTo(BIO_START.fit + TRAIN_GAIN * PROTEIN_BONUS, 5);
    s.playTime += TRAIN_COOLDOWN;
    train(s);
    expect(bioValue(s, "fit")).toBeCloseTo(
      BIO_START.fit + TRAIN_GAIN * PROTEIN_BONUS + TRAIN_GAIN,
      5,
    );
  });

  it("sleep then train unlocks the achievements", () => {
    const s = active();
    set(s, "rest", 50);
    sleep(s);
    train(s);
    s.playTime += TRAIN_COOLDOWN;
    train(s);
    const fresh = evaluateAchievements(s);
    expect(fresh).toContain("fruehsport");
    expect(fresh).toContain("gesunder_geist");
    expect(ACHIEVEMENT_BY_ID.get("gesunder_geist")?.branch).toBe("labor");
  });
});

describe("content hooks", () => {
  it("places the four stations on Level +1 in the right rooms", () => {
    const rooms: Record<string, string> = {
      food_replicator: "kantine",
      neutro_fridge: "kantine",
      jades_bett: "jadeq",
      ergometer: "jadeq",
    };
    for (const [id, room] of Object.entries(rooms)) {
      const p = PROPS.find((x) => x.id === id)!;
      expect(p, id).toBeDefined();
      expect(p.kind).toBe("station");
      expect(roomAt(p.floor, p.x, p.z)?.id, id).toBe(room);
      expect(BIO_STATION_BY_PROP.has(id)).toBe(true);
      const decor = PROP_VARIANT_DECOR[p.variant ?? ""]!;
      expect(DECOR_BY_ID.has(decor), decor).toBe(true);
      // Classic half scale, inside the fallback prop model used by walkability.
      expect(decorScale(decor)).toBe(0.5);
      const m = decorModel(decor);
      const fallback = propModel(p.model);
      expect(m.w, decor).toBeLessThanOrEqual(fallback.w);
      expect(m.d, decor).toBeLessThanOrEqual(fallback.d);
    }
    expect(PROPS.find((p) => p.id === "food_replicator")?.requires).toEqual({ power: 50 });
    expect(decorVisual("ergometer")?.parts.some((p) => p.kind === "spin")).toBe(true);
    expect(decorVisual("food_replicator")?.screens?.length).toBe(1);
  });

  it("has a voxel icon for every provision", () => {
    for (const p of PROVISIONS) {
      expect(p.item.kind).toBe("verbrauch");
      const m = itemIconModel(p.item);
      expect(Math.max(m.w, m.h, m.d)).toBeLessThanOrEqual(ICON_MAX);
      expect(m.grid.count(), p.id).toBeGreaterThan(20);
    }
  });

  it("codex, hint, barks and setting exist", () => {
    const e = CODEX_BY_ID.get("g_biorhythmus")!;
    expect(e).toBeDefined();
    const s = initialState();
    expect(codexUnlocked(s, e.unlock)).toBe(false);
    s.flags.visited_kantine = true;
    expect(codexUnlocked(s, e.unlock)).toBe(true);
    expect(HINTS.some((h) => h.id === "biorhythm")).toBe(true);
    const t = active();
    t.playTime = 1000;
    for (const h of HINTS) if (h.id !== "biorhythm") t.flags[`tut_${h.id}`] = true;
    expect(
      nextHint(t, { floor: 4, powerGeneration: 50, hintsEnabled: true, overlay: null }, 1000)?.id,
    ).toBe("biorhythm");
    expect(BARKS.filter((b) => b.trigger === "bio_low").length).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_SETTINGS.gameplay.biorhythm).toBe("normal");
    expect(
      mergeSettings(DEFAULT_SETTINGS, { gameplay: { biorhythm: "relaxed" } }).gameplay,
    ).toMatchObject({
      biorhythm: "relaxed",
    });
    expect(
      mergeSettings(DEFAULT_SETTINGS, { gameplay: { biorhythm: "wild" } }).gameplay.biorhythm,
    ).toBe("normal");
  });
});

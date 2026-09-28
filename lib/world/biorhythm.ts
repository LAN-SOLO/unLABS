/**
 * Biorhythm — Jade's four needs (pure, no DOM, no three).
 * ========================================================
 *
 * Satiation, hydration, rest and fitness (0–100). Deliberately gentle:
 *
 * - The rhythm only starts the first time Jade sets foot on Level +1 (the
 *   Living Quarters with the kitchen and her own room). Before that every
 *   value reads as full and nothing is shown.
 * - Values drift down slowly with play time (`BIO_DECAY_PER_MIN`, halved in
 *   the "relaxed" setting, frozen when the setting is "off").
 * - Effects never block, damage or lose progress: a need below `BIO_LOW`
 *   slows walking a little (`BIO_LOW_WALK`) and lets Jade/MCP mention it now
 *   and then; everything well cared for gives a small bonus (`BIO_BALANCED_WALK`).
 * - Food never spoils. Consumables live in their own counters, never in
 *   `inventory`, so they can never reach the workbench, a build slot,
 *   disassembly or a prototype effect.
 *
 * Save shape: everything lives in `WorldState.counters` / `flags` (no
 * migration needed):
 *
 *   counters.bio_on_at            play time the rhythm started (absent = not yet)
 *   counters.bio_food|drink|rest|fit   the four values (0..100)
 *   counters["bio_inv:<id>"]      consumables Jade carries (bag)
 *   counters["fridge:<id>"]       consumables in the Neutro-Fridge
 *   counters["bio_cd:replicator"] play time the replicator is ready again
 *   counters["bio_cd:train"]      play time the ergometer is ready again
 *   counters.bio_protein          1 = the next workout gets the shake bonus
 *   counters.bio_woke_at          play time Jade last woke up
 *   counters.bio_bark_at          play time of the last "need is low" nudge
 *   counters.bio_meals|bio_sleeps|bio_trainings   statistics
 *   flags.bio_fruehsport          trained right after waking (achievement)
 *   flags.bio_fridge_seen         the lasagne line at the fridge was shown
 */
import { intlLocale, tr } from "@/lib/i18n";
import { ROOMS } from "@/lib/world/content/map";
import { evalCond, removeItem } from "@/lib/world/game";
import { traits } from "@/lib/world/traits";
import type { BiorhythmMode } from "@/lib/world/settings";
import type { ItemDef, WorldState } from "@/lib/world/types";

// ── Numbers (every tuning knob in one place) ─────────────────────

export type BioNeed = "food" | "drink" | "rest" | "fit";
export const BIO_NEEDS: readonly BioNeed[] = ["food", "drink", "rest", "fit"];

export const BIO_KEY: Readonly<Record<BioNeed, string>> = {
  food: "bio_food",
  drink: "bio_drink",
  rest: "bio_rest",
  fit: "bio_fit",
};

export const BIO_MAX = 100;
/** Counter holding the play time the rhythm started. */
export const BIO_ON_COUNTER = "bio_on_at";
/** The level whose first visit starts the rhythm (Level +1, Living Quarters). */
export const BIO_FLOOR = 4;

/** Values when the rhythm starts: fed, watered and rested — fitness is the thing to build. */
export const BIO_START: Readonly<Record<BioNeed, number>> = {
  food: 100,
  drink: 100,
  rest: 100,
  fit: 50,
};

/** Loss per minute of play time ("normal"). */
export const BIO_DECAY_PER_MIN: Readonly<Record<BioNeed, number>> = {
  food: 1,
  drink: 1.6,
  rest: 0.7,
  fit: 0.2,
};
/** Decay multiplier of the "relaxed" setting. */
export const BIO_RELAXED_FACTOR = 0.5;

/** Below this a need counts as low. */
export const BIO_LOW = 20;
/** Balanced: every need at least this … */
export const BIO_BALANCED_MIN = 60;
/** … and fitness at least this. */
export const BIO_BALANCED_FIT = 70;
/** Walk speed factor while any need is low. */
export const BIO_LOW_WALK = 0.92;
/** Walk speed factor while balanced. */
export const BIO_BALANCED_WALK = 1.06;
/** Minimum play seconds between two "need is low" nudges (the bark engine may still skip one). */
export const BIO_BARK_EVERY = 240;

/** Replicator: minimum power on the grid and seconds between two prints. */
export const REPLICATOR_POWER = 50;
export const REPLICATOR_COOLDOWN = 20;
/** Most units of one consumable Jade carries in her bag. */
export const CARRY_LIMIT = 5;
/** Neutro-Fridge capacity (all consumables together). */
export const FRIDGE_CAPACITY = 12;
/** Eating/drinking straight from the fridge restores this much more. */
export const FRESH_BONUS = 1.25;

/** Sleep: only when rest is below this; play time skipped while asleep. */
export const SLEEP_BELOW = 90;
export const SLEEP_SECONDS = 180;

/** Training: fitness gain, cost, cooldown, protein-shake multiplier. */
export const TRAIN_GAIN = 15;
export const TRAIN_COST: Readonly<Partial<Record<BioNeed, number>>> = { drink: 5, rest: 3 };
export const TRAIN_COOLDOWN = 60;
export const PROTEIN_BONUS = 1.5;
/** "Morning workout": training within this many seconds after waking up. */
export const MORNING_WINDOW = 120;

/** Locale-aware short number for texts ("1.6" / "1,6"). */
export function bioNum(v: number, digits = 2): string {
  return new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: digits }).format(v);
}

// ── Consumables ──────────────────────────────────────────────────

export interface ProvisionDef {
  /** Item id (also the icon id in models/items.ts). */
  id: string;
  item: ItemDef;
  /** Points restored per need. */
  restore: Partial<Record<BioNeed, number>>;
  /** Boosts the next workout (`PROTEIN_BONUS`). */
  protein?: boolean;
  /** "eat" or "drink" (label only). */
  verb: "eat" | "drink";
}

function provision(
  id: string,
  name: string,
  description: string,
  color: ItemDef["color"],
  restore: ProvisionDef["restore"],
  verb: ProvisionDef["verb"],
  protein = false,
): ProvisionDef {
  const item: ItemDef = {
    id,
    name,
    kind: "verbrauch",
    description,
    traits: traits({}),
    color,
    volatility: 1,
    depth: 0,
  };
  return protein ? { id, item, restore, verb, protein } : { id, item, restore, verb };
}

/** What the Food Replicator prints (kept out of `ITEMS` on purpose). */
export const PROVISIONS: readonly ProvisionDef[] = [
  provision(
    "naehrriegel",
    tr("Nutrient Bar"),
    tr("Printed oats, nuts and something the replicator calls “flavour”. Filling."),
    "orange",
    { food: 35 },
    "eat",
  ),
  provision(
    "wasserflasche",
    tr("Water Bottle"),
    tr("Filtered water from the deep aquifer, bottled by the replicator. Tastes of rock."),
    "blau",
    { drink: 40 },
    "drink",
  ),
  provision(
    "protein_shake",
    tr("Protein Shake"),
    tr("Vanilla, allegedly. Fills a little, quenches a little — and the next workout counts more."),
    "gelb",
    { food: 15, drink: 20 },
    "drink",
    true,
  ),
];

export const PROVISION_BY_ID: ReadonlyMap<string, ProvisionDef> = new Map(
  PROVISIONS.map((p) => [p.id, p]),
);

/** Jade's coffee (a normal inventory item) also counts as a drink. */
export const COFFEE_ITEM = "kaffee";
export const COFFEE_RESTORE: Readonly<Partial<Record<BioNeed, number>>> = { drink: 10, rest: 10 };

export const bagKey = (id: string): string => `bio_inv:${id}`;
export const fridgeKey = (id: string): string => `fridge:${id}`;
const CD_REPLICATOR = "bio_cd:replicator";
const CD_TRAIN = "bio_cd:train";

// ── Activation & values ──────────────────────────────────────────

const FLOOR_ROOMS: readonly string[] = ROOMS.filter((r) => r.floor === BIO_FLOOR).map((r) => r.id);

/** Has Jade reached Level +1 (now or any of its rooms before)? */
export function bioReady(s: WorldState): boolean {
  return s.floor === BIO_FLOOR || FLOOR_ROOMS.some((id) => s.flags[`visited_${id}`]);
}

/** The rhythm has started (sticky). */
export function bioActive(s: WorldState): boolean {
  return s.counters[BIO_ON_COUNTER] !== undefined;
}

/** Started and not switched off in the settings. */
export function bioEnabled(s: WorldState, mode: BiorhythmMode): boolean {
  return mode !== "off" && bioActive(s);
}

/** Start the rhythm when Level +1 is reached. Returns true when it just started. */
export function bioActivate(s: WorldState): boolean {
  if (bioActive(s) || !bioReady(s)) return false;
  s.counters[BIO_ON_COUNTER] = Math.round(s.playTime);
  for (const n of BIO_NEEDS) s.counters[BIO_KEY[n]] = BIO_START[n];
  return true;
}

const clamp = (v: number): number => Math.max(0, Math.min(BIO_MAX, v));

/** Current value of a need (full while the rhythm has not started). */
export function bioValue(s: WorldState, need: BioNeed): number {
  if (!bioActive(s)) return BIO_MAX;
  const v = s.counters[BIO_KEY[need]];
  return clamp(v === undefined || !Number.isFinite(v) ? BIO_START[need] : v);
}

export function bioValues(s: WorldState): Record<BioNeed, number> {
  return {
    food: bioValue(s, "food"),
    drink: bioValue(s, "drink"),
    rest: bioValue(s, "rest"),
    fit: bioValue(s, "fit"),
  };
}

function setValue(s: WorldState, need: BioNeed, v: number): void {
  // Unrounded on purpose: per-second decay steps are tiny (0.0117…0.0267).
  s.counters[BIO_KEY[need]] = clamp(v);
}

/** Decay per minute for a need in a mode (0 when off). */
export function bioRate(need: BioNeed, mode: BiorhythmMode): number {
  if (mode === "off") return 0;
  return BIO_DECAY_PER_MIN[need] * (mode === "relaxed" ? BIO_RELAXED_FACTOR : 1);
}

export interface BioTickReport {
  /** The rhythm started during this tick. */
  activated: boolean;
}

/**
 * Advance the rhythm by `dt` seconds of play (call once per play-clock
 * second). "off" freezes everything and never starts the rhythm.
 */
export function bioTick(s: WorldState, dt: number, mode: BiorhythmMode): BioTickReport {
  if (mode === "off" || !(dt > 0)) return { activated: false };
  const activated = bioActivate(s);
  if (!bioActive(s)) return { activated };
  for (const n of BIO_NEEDS) setValue(s, n, bioValue(s, n) - (bioRate(n, mode) * dt) / 60);
  return { activated };
}

// ── Effects ──────────────────────────────────────────────────────

export type BioStatus = "hidden" | "low" | "balanced" | "ok";

export interface BioEffects {
  status: BioStatus;
  /** Walk speed multiplier (1 = no effect). */
  walk: number;
  /** Needs below `BIO_LOW`, in `BIO_NEEDS` order. */
  low: BioNeed[];
}

/** Balanced by the values alone (used by the achievement, independent of the setting). */
export function bioBalanced(s: WorldState): boolean {
  if (!bioActive(s)) return false;
  const v = bioValues(s);
  return BIO_NEEDS.every((n) => v[n] >= BIO_BALANCED_MIN) && v.fit >= BIO_BALANCED_FIT;
}

export function bioEffects(s: WorldState, mode: BiorhythmMode): BioEffects {
  if (!bioEnabled(s, mode)) return { status: "hidden", walk: 1, low: [] };
  const v = bioValues(s);
  const low = BIO_NEEDS.filter((n) => v[n] < BIO_LOW);
  if (low.length) return { status: "low", walk: BIO_LOW_WALK, low };
  if (bioBalanced(s)) return { status: "balanced", walk: BIO_BALANCED_WALK, low };
  return { status: "ok", walk: 1, low };
}

/** Walk speed multiplier for the engine (1 while hidden/off). */
export function bioWalkMultiplier(s: WorldState, mode: BiorhythmMode): number {
  return bioEffects(s, mode).walk;
}

/** Minutes of play until a need drops below `BIO_LOW` (0 = already low, null = never). */
export function minutesUntilLow(s: WorldState, need: BioNeed, mode: BiorhythmMode): number | null {
  const v = bioValue(s, need);
  if (v < BIO_LOW) return 0;
  const r = bioRate(need, mode);
  return r > 0 ? (v - BIO_LOW) / r : null;
}

/**
 * Should Jade/the MCP mention a low need now? Rate-limited through
 * `counters.bio_bark_at` (writes it when returning true).
 */
export function bioBarkDue(s: WorldState, mode: BiorhythmMode, now: number): boolean {
  if (bioEffects(s, mode).status !== "low") return false;
  const last = s.counters.bio_bark_at;
  if (last !== undefined && now - last < BIO_BARK_EVERY) return false;
  s.counters.bio_bark_at = now;
  return true;
}

/** Short advice for the Bio panel (most urgent first; empty when all is well). */
export function bioTips(s: WorldState, mode: BiorhythmMode): string[] {
  if (!bioEnabled(s, mode)) return [];
  const v = bioValues(s);
  const out: string[] = [];
  if (v.drink < 40)
    out.push(
      tr("Thirsty: a water bottle from the Food Replicator in the kitchen helps (+{n}).", {
        n: PROVISION_BY_ID.get("wasserflasche")?.restore.drink ?? 0,
      }),
    );
  if (v.food < 40)
    out.push(
      tr("Hungry: a nutrient bar from the replicator restores +{n}.", {
        n: PROVISION_BY_ID.get("naehrriegel")?.restore.food ?? 0,
      }),
    );
  if (v.rest < 40) out.push(tr("Tired: a nap in your bed in Jade's Quarters restores rest fully."));
  if (v.fit < BIO_BALANCED_FIT)
    out.push(
      tr("The ergometer in Jade's Quarters builds fitness (+{n} per workout).", { n: TRAIN_GAIN }),
    );
  if (!out.length && !bioBalanced(s))
    out.push(
      tr("Keep every need above {min} and fitness above {fit} for a small bonus.", {
        min: BIO_BALANCED_MIN,
        fit: BIO_BALANCED_FIT,
      }),
    );
  if (bioBalanced(s)) out.push(tr("Balanced: you walk a little faster. Nicely done."));
  return out;
}

// ── Bag & fridge ─────────────────────────────────────────────────

export function bagCount(s: WorldState, id: string): number {
  return Math.max(0, Math.floor(s.counters[bagKey(id)] ?? 0));
}

export function fridgeCount(s: WorldState, id: string): number {
  return Math.max(0, Math.floor(s.counters[fridgeKey(id)] ?? 0));
}

export function fridgeTotal(s: WorldState): number {
  return PROVISIONS.reduce((a, p) => a + fridgeCount(s, p.id), 0);
}

export function bagTotal(s: WorldState): number {
  return PROVISIONS.reduce((a, p) => a + bagCount(s, p.id), 0);
}

function add(s: WorldState, key: string, by: number): void {
  const next = Math.max(0, Math.floor(s.counters[key] ?? 0) + by);
  if (next === 0) delete s.counters[key];
  else s.counters[key] = next;
}

export interface BioReport {
  ok: boolean;
  text: string;
  /** Points actually gained per need (after clamping; negatives = costs). */
  gains: Partial<Record<BioNeed, number>>;
  /** Seconds until the station is ready again (0 = ready). */
  cooldownLeft: number;
  /** Consumed from the fridge (fresh bonus applied). */
  fresh?: boolean;
  item?: string;
}

const fail = (text: string, cooldownLeft = 0): BioReport => ({
  ok: false,
  text,
  gains: {},
  cooldownLeft,
});

/** Seconds until the replicator prints again. */
export function replicatorCooldown(s: WorldState, now: number = s.playTime): number {
  return Math.max(0, (s.counters[CD_REPLICATOR] ?? 0) - now);
}

/** Seconds until the ergometer can be used again. */
export function trainCooldown(s: WorldState, now: number = s.playTime): number {
  return Math.max(0, (s.counters[CD_TRAIN] ?? 0) - now);
}

/** Print one consumable into Jade's bag. */
export function replicate(s: WorldState, id: string, now: number = s.playTime): BioReport {
  const p = PROVISION_BY_ID.get(id);
  if (!p) return fail(tr("The replicator does not know that recipe."));
  if (!evalCond(s, { power: REPLICATOR_POWER }))
    return fail(tr("The replicator needs at least {w} W on the grid.", { w: REPLICATOR_POWER }));
  const cd = replicatorCooldown(s, now);
  if (cd > 0) return fail(tr("The print head is still cooling down."), cd);
  if (bagCount(s, id) >= CARRY_LIMIT)
    return fail(
      tr("Your bag already holds {n}. Eat one or put some in the Neutro-Fridge.", {
        n: CARRY_LIMIT,
      }),
    );
  add(s, bagKey(id), 1);
  s.counters[CD_REPLICATOR] = now + REPLICATOR_COOLDOWN;
  s.counters.bio_printed = (s.counters.bio_printed ?? 0) + 1;
  return {
    ok: true,
    text: tr("The replicator hums and prints: {name}.", { name: p.item.name }),
    gains: {},
    cooldownLeft: REPLICATOR_COOLDOWN,
    item: id,
  };
}

function applyRestore(
  s: WorldState,
  restore: Partial<Record<BioNeed, number>>,
  factor: number,
): Partial<Record<BioNeed, number>> {
  const gains: Partial<Record<BioNeed, number>> = {};
  for (const n of BIO_NEEDS) {
    const r = restore[n];
    if (!r) continue;
    const before = bioValue(s, n);
    setValue(s, n, before + r * factor);
    gains[n] = Math.round((bioValue(s, n) - before) * 10) / 10;
  }
  return gains;
}

export type ConsumeFrom = "bag" | "fridge";

/** Eat or drink a consumable from the bag or (fresh, +25 %) straight from the fridge. */
export function consume(s: WorldState, id: string, from: ConsumeFrom = "bag"): BioReport {
  if (!bioActive(s)) return fail(tr("Jade is neither hungry nor thirsty yet."));
  if (id === COFFEE_ITEM) {
    if (from !== "bag" || !removeItem(s, COFFEE_ITEM, 1)) return fail(tr("No coffee at hand."));
    const gains = applyRestore(s, COFFEE_RESTORE, 1);
    s.counters.bio_meals = (s.counters.bio_meals ?? 0) + 1;
    return {
      ok: true,
      text: tr("Coffee from the singularity bus. Warm, bitter, awake."),
      gains,
      cooldownLeft: 0,
      item: id,
    };
  }
  const p = PROVISION_BY_ID.get(id);
  if (!p) return fail(tr("That is not edible."));
  const key = from === "fridge" ? fridgeKey(id) : bagKey(id);
  if ((s.counters[key] ?? 0) < 1)
    return fail(
      from === "fridge" ? tr("The fridge has none of that.") : tr("None left in the bag."),
    );
  add(s, key, -1);
  const fresh = from === "fridge";
  const gains = applyRestore(s, p.restore, fresh ? FRESH_BONUS : 1);
  if (p.protein) s.counters.bio_protein = 1;
  s.counters.bio_meals = (s.counters.bio_meals ?? 0) + 1;
  const text = fresh
    ? tr("{name}, fresh and cold from the Neutro-Fridge.", { name: p.item.name })
    : p.verb === "eat"
      ? tr("{name} — eaten.", { name: p.item.name })
      : tr("{name} — drunk.", { name: p.item.name });
  return { ok: true, text, gains, cooldownLeft: 0, fresh, item: id };
}

/** Put one consumable from the bag into the fridge. */
export function fridgeStore(s: WorldState, id: string): BioReport {
  if (!PROVISION_BY_ID.has(id) || bagCount(s, id) < 1) return fail(tr("None left in the bag."));
  if (fridgeTotal(s) >= FRIDGE_CAPACITY)
    return fail(tr("The Neutro-Fridge is full ({n}).", { n: FRIDGE_CAPACITY }));
  add(s, bagKey(id), -1);
  add(s, fridgeKey(id), 1);
  return {
    ok: true,
    text: tr("Stored in the Neutro-Fridge."),
    gains: {},
    cooldownLeft: 0,
    item: id,
  };
}

/** Take one consumable from the fridge into the bag. */
export function fridgeTake(s: WorldState, id: string): BioReport {
  if (!PROVISION_BY_ID.has(id) || fridgeCount(s, id) < 1)
    return fail(tr("The fridge has none of that."));
  if (bagCount(s, id) >= CARRY_LIMIT)
    return fail(
      tr("Your bag already holds {n}. Eat one or put some in the Neutro-Fridge.", {
        n: CARRY_LIMIT,
      }),
    );
  add(s, fridgeKey(id), -1);
  add(s, bagKey(id), 1);
  return { ok: true, text: tr("Taken along."), gains: {}, cooldownLeft: 0, item: id };
}

// ── Sleep & training ─────────────────────────────────────────────

/** Why sleeping is not possible right now (null = it is). */
export function sleepBlocked(s: WorldState): string | null {
  if (!bioActive(s)) return tr("Jade is not tired.");
  if (bioValue(s, "rest") >= SLEEP_BELOW)
    return tr("Still too awake to sleep (rest {v} of {max}).", {
      v: Math.round(bioValue(s, "rest")),
      max: SLEEP_BELOW,
    });
  return null;
}

/**
 * Sleep in Jade's bed: rest → 100 and `SLEEP_SECONDS` of play time pass
 * (respawn timers, cooldowns and buffs advance with it; satiation and
 * hydration do not drop while asleep).
 */
export function sleep(s: WorldState): BioReport {
  const why = sleepBlocked(s);
  if (why) return fail(why);
  const before = bioValue(s, "rest");
  setValue(s, "rest", BIO_MAX);
  s.playTime += SLEEP_SECONDS;
  s.counters.bio_woke_at = s.playTime;
  s.counters.bio_sleeps = (s.counters.bio_sleeps ?? 0) + 1;
  return {
    ok: true,
    text: tr("A few minutes of real sleep. The lab hummed on without you. You feel rested."),
    gains: { rest: Math.round((BIO_MAX - before) * 10) / 10 },
    cooldownLeft: 0,
  };
}

/** One workout on the ergometer. */
export function train(s: WorldState, now: number = s.playTime): BioReport {
  if (!bioActive(s)) return fail(tr("Jade feels fit enough for now."));
  const cd = trainCooldown(s, now);
  if (cd > 0) return fail(tr("Catch your breath first."), cd);
  const protein = (s.counters.bio_protein ?? 0) > 0;
  const gains = applyRestore(s, { fit: TRAIN_GAIN }, protein ? PROTEIN_BONUS : 1);
  for (const [n, c] of Object.entries(TRAIN_COST) as [BioNeed, number][]) {
    const before = bioValue(s, n);
    setValue(s, n, before - c);
    gains[n] = Math.round((bioValue(s, n) - before) * 10) / 10;
  }
  delete s.counters.bio_protein;
  s.counters[CD_TRAIN] = now + TRAIN_COOLDOWN;
  s.counters.bio_trainings = (s.counters.bio_trainings ?? 0) + 1;
  const woke = s.counters.bio_woke_at;
  if (woke !== undefined && now - woke <= MORNING_WINDOW) s.flags.bio_fruehsport = true;
  return {
    ok: true,
    text: protein
      ? tr("Ten minutes on the ergometer — the shake kicks in. Legs burning, head clear.")
      : tr("Ten minutes on the ergometer. Legs burning, head clear."),
    gains,
    cooldownLeft: TRAIN_COOLDOWN,
  };
}

// ── Stations (map props) ─────────────────────────────────────────

export type BioStation = "replicator" | "fridge" | "bed" | "trainer";

/** Map prop id → station. */
export const BIO_STATION_BY_PROP: ReadonlyMap<string, BioStation> = new Map([
  ["food_replicator", "replicator"],
  ["neutro_fridge", "fridge"],
  ["jades_bett", "bed"],
  ["ergometer", "trainer"],
]);

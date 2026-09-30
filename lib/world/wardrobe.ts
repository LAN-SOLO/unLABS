/**
 * Jade's wardrobe — pure rules.
 * =============================
 *
 * Ownership, equipping (clothes only at the wardrobe, gear and accessories
 * anywhere), outfit presets, the replicator in her quarters (one job at a
 * time: fabricate, refine textiles, dye, recycle), hidden finds (map pickups
 * with `wear:<id>` items) and rewards. Everything mutates the `WorldState`
 * passed in and never throws. Data: content/wardrobe.ts.
 */
import { tr } from "@/lib/i18n";
import {
  DEFAULT_LOOK,
  DYE_SECONDS,
  OUTFIT_PRESETS,
  REPLICATOR_INTRO_FLAG,
  REPLICATOR_POWER,
  RECYCLE_SHARE,
  REFINE_RECIPES,
  TEXTILE_ITEMS,
  WEAR_BY_ID,
  WEAR_ITEMS,
  WEAR_ITEM_PREFIX,
  WEAR_SLOTS,
  WEAR_SLOT_BY_ID,
  type FootwearSound,
  type JadeLook,
  type MotionLayer,
  type WearItem,
  type WearSlot,
} from "@/lib/world/content/wardrobe";
import { BOT_QUESTS } from "@/lib/world/content/story";
import { addItem, evalCond, log, removeItem } from "@/lib/world/game";
import type { Condition, WardrobeState, WorldState } from "@/lib/world/types";

export type { JadeLook, WearSlot } from "@/lib/world/content/wardrobe";

// ── State ───────────────────────────────────────────────────────

export function cloneLook(l: JadeLook): JadeLook {
  const o = {} as JadeLook;
  for (const k of WEAR_SLOTS) o[k] = l[k] ? { ...l[k] } : null;
  return o;
}

export function initialWardrobe(): WardrobeState {
  const owned: Record<string, true> = {};
  for (const w of WEAR_ITEMS) if (w.source.kind === "start") owned[w.id] = true;
  return {
    owned,
    dyes: {},
    look: cloneLook(DEFAULT_LOOK),
    presets: Array.from({ length: OUTFIT_PRESETS }, () => null),
    found: {},
    crafted: 0,
    seen: {},
    job: null,
  };
}

// ── Queries ─────────────────────────────────────────────────────

export function isWearPickupItem(itemId: string): boolean {
  return itemId.startsWith(WEAR_ITEM_PREFIX);
}

export function wearIdFromItem(itemId: string): string | null {
  if (!isWearPickupItem(itemId)) return null;
  const id = itemId.slice(WEAR_ITEM_PREFIX.length);
  return WEAR_BY_ID.has(id) ? id : null;
}

export function ownsWear(s: WorldState, id: string): boolean {
  return !!s.wardrobe.owned[id];
}

export function ownedWear(s: WorldState, slot?: WearSlot): WearItem[] {
  return WEAR_ITEMS.filter((w) => s.wardrobe.owned[w.id] && (!slot || w.slot === slot));
}

/** Colourway usable: free ones with the piece, dyed ones once paid for. */
export function colorwayAvailable(s: WorldState, itemId: string, colorway: string): boolean {
  const w = WEAR_BY_ID.get(itemId);
  const c = w?.colorways.find((x) => x.id === colorway);
  if (!w || !c || !ownsWear(s, itemId)) return false;
  return !c.dye || !!s.wardrobe.dyes[`${itemId}.${colorway}`];
}

/**
 * Counters the wardrobe conditions use that the world only keeps as flags:
 * `bots_awake`, `explosions` (workbench explosion events), `endings`.
 */
export function wardrobeCounters(s: WorldState): Record<string, number> {
  const flags = Object.keys(s.flags).filter((k) => s.flags[k]);
  return {
    bots_awake: BOT_QUESTS.filter((q) => s.flags[q.flag]).length,
    // Every workbench explosion (`combo_explosion`), at least one per event kind seen.
    explosions: Math.max(
      s.counters.combo_explosion ?? 0,
      flags.filter((k) => k.startsWith("explosion_") && k !== "explosion_seen").length,
    ),
    endings: Object.values(s.endings).filter(Boolean).length,
  };
}

/** `evalCond` with the derived wardrobe counters layered over `s.counters`. */
export function evalWearCond(s: WorldState, c: Condition | undefined): boolean {
  if (!c) return true;
  const view: WorldState = { ...s, counters: { ...s.counters, ...wardrobeCounters(s) } };
  return evalCond(view, c);
}

/** Why a slot change is refused, or null when it is allowed. */
export function equipBlocked(
  s: WorldState,
  slot: WearSlot,
  itemId: string | null,
  colorway: string | undefined,
  atWardrobe: boolean,
): string | null {
  const def = WEAR_SLOT_BY_ID.get(slot);
  if (!def) return tr("Unknown slot.");
  if (def.wardrobeOnly && !atWardrobe)
    return tr("Clothes, shoes and hair are changed at the wardrobe in Jade's quarters.");
  if (itemId === null) return def.optional ? null : tr("Jade will not go without that.");
  const w = WEAR_BY_ID.get(itemId);
  if (!w || w.slot !== slot) return tr("That does not go there.");
  if (!ownsWear(s, itemId)) return tr("Not in the wardrobe yet.");
  const cw = colorway ?? w.colorways[0]!.id;
  if (!colorwayAvailable(s, itemId, cw))
    return tr("That colour has to be dyed at the replicator first.");
  return null;
}

// ── Equipping and presets ───────────────────────────────────────

export function equip(
  s: WorldState,
  slot: WearSlot,
  itemId: string | null,
  colorway: string | undefined,
  atWardrobe: boolean,
): boolean {
  if (equipBlocked(s, slot, itemId, colorway, atWardrobe)) return false;
  const cur = s.wardrobe.look[slot];
  const cw = itemId === null ? undefined : (colorway ?? WEAR_BY_ID.get(itemId)!.colorways[0]!.id);
  if (itemId === null ? cur === null : cur?.item === itemId && cur.colorway === cw) return false;
  if (itemId === null) s.wardrobe.look[slot] = null;
  else {
    const w = WEAR_BY_ID.get(itemId)!;
    s.wardrobe.look[slot] = { item: itemId, colorway: colorway ?? w.colorways[0]!.id };
    s.wardrobe.seen[itemId] = true;
  }
  s.counters.wear_changes = (s.counters.wear_changes ?? 0) + 1;
  syncWornFlags(s);
  return true;
}

/** Prefix of the flags that mirror what Jade wears right now (bark / dialogue conditions). */
export const WORN_FLAG_PREFIX = "worn_";

/**
 * Mirror the visible look into `worn_<item>` flags so plain `Condition`s
 * (barks, dialogue) can react to what Jade wears. Idempotent.
 */
export function syncWornFlags(s: WorldState): void {
  const look = visibleLook(s.wardrobe.look);
  const want = new Set<string>();
  for (const slot of WEAR_SLOTS) if (look[slot]) want.add(`${WORN_FLAG_PREFIX}${look[slot]!.item}`);
  for (const k of Object.keys(s.flags))
    if (k.startsWith(WORN_FLAG_PREFIX) && !want.has(k)) delete s.flags[k];
  for (const k of want) s.flags[k] = true;
}

export function savePreset(s: WorldState, index: number, name: string): boolean {
  if (index < 0 || index >= OUTFIT_PRESETS) return false;
  const clean = name.trim().slice(0, 24) || tr("Outfit {n}", { n: index + 1 });
  s.wardrobe.presets[index] = { name: clean, look: cloneLook(s.wardrobe.look) };
  return true;
}

/**
 * Put on a saved outfit. Away from the wardrobe only gear and accessories
 * change. Pieces no longer owned are skipped. Returns the slots that changed.
 */
export function applyPreset(s: WorldState, index: number, atWardrobe: boolean): WearSlot[] {
  const p = s.wardrobe.presets[index];
  if (!p) return [];
  const changed: WearSlot[] = [];
  for (const slot of WEAR_SLOTS) {
    const want = p.look[slot];
    const have = s.wardrobe.look[slot];
    if (want?.item === have?.item && want?.colorway === have?.colorway) continue;
    if (equip(s, slot, want?.item ?? null, want?.colorway, atWardrobe)) changed.push(slot);
  }
  return changed;
}

/** What actually shows: a full-face helmet hides the face slot. */
export function visibleLook(look: JadeLook): JadeLook {
  const out = cloneLook(look);
  const head = look.head ? WEAR_BY_ID.get(look.head.item) : undefined;
  if (head?.coversFace) out.face = null;
  return out;
}

export function footwearOf(look: JadeLook): FootwearSound {
  const w = look.feet ? WEAR_BY_ID.get(look.feet.item) : undefined;
  return w?.step ?? "boot";
}

/** Motion sound layers of everything worn (deduplicated, slot order). */
export function motionLayersOf(look: JadeLook): MotionLayer[] {
  const out: MotionLayer[] = [];
  for (const slot of WEAR_SLOTS) {
    const w = look[slot] ? WEAR_BY_ID.get(look[slot]!.item) : undefined;
    if (w?.layer && !out.includes(w.layer)) out.push(w.layer);
  }
  return out;
}

// ── Getting pieces ──────────────────────────────────────────────

/** Hand over a piece. Returns true when it is new. */
export function grantWear(s: WorldState, id: string, how: "find" | "craft" | "reward"): boolean {
  const w = WEAR_BY_ID.get(id);
  if (!w || s.wardrobe.owned[id]) return false;
  s.wardrobe.owned[id] = true;
  if (how === "find") s.wardrobe.found[id] = Math.max(1, Math.round(s.playTime));
  if (how === "craft") s.wardrobe.crafted += 1;
  s.flags[`wear_${id}`] = true;
  log(
    s,
    how === "find"
      ? tr("Found for the wardrobe: {name}", { name: w.name })
      : how === "craft"
        ? tr("Replicated: {name}", { name: w.name })
        : tr("New in the wardrobe: {name}", { name: w.name }),
  );
  return true;
}

/** Grant every reward piece whose condition now holds. Returns the new ids. */
export function syncWearRewards(s: WorldState): string[] {
  const out: string[] = [];
  for (const w of WEAR_ITEMS) {
    if (w.source.kind !== "reward" || s.wardrobe.owned[w.id]) continue;
    if (evalWearCond(s, w.source.when) && grantWear(s, w.id, "reward")) out.push(w.id);
  }
  return out;
}

// ── Replicator ──────────────────────────────────────────────────

/** `offline` = the replicator has too little power on the grid to start a job. */
export type CraftState = "owned" | "locked" | "missing" | "ready" | "busy" | "offline";

export interface CraftStatus {
  state: CraftState;
  /** Resources still missing (item id → count). */
  missing: Record<string, number>;
}

function missingFor(
  s: WorldState,
  recipe: Readonly<Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(recipe)) {
    const have = s.inventory[id] ?? 0;
    if (have < n) out[id] = n - have;
  }
  return out;
}

function pay(s: WorldState, recipe: Readonly<Record<string, number>>): void {
  for (const [id, n] of Object.entries(recipe)) removeItem(s, id, n);
}

/** Pattern visible on the replicator (craftable pieces whose unlock holds). */
export function patternUnlocked(s: WorldState, w: WearItem): boolean {
  return w.source.kind === "craft" && evalWearCond(s, w.source.unlock);
}

export function craftStatus(s: WorldState, id: string): CraftStatus {
  const w = WEAR_BY_ID.get(id);
  if (!w || w.source.kind !== "craft") return { state: "locked", missing: {} };
  if (ownsWear(s, id)) return { state: "owned", missing: {} };
  if (!patternUnlocked(s, w)) return { state: "locked", missing: {} };
  const missing = missingFor(s, w.source.recipe);
  if (Object.keys(missing).length) return { state: "missing", missing };
  return startable(s);
}

/** Enough power on the grid for the replicator to start a job. */
export function replicatorPowered(s: WorldState): boolean {
  return evalCond(s, { power: REPLICATOR_POWER });
}

/** Busy / offline / ready once the resources are there. */
function startable(s: WorldState): CraftStatus {
  if (s.wardrobe.job) return { state: "busy", missing: {} };
  if (!replicatorPowered(s)) return { state: "offline", missing: {} };
  return { state: "ready", missing: {} };
}

/** Seconds until the running job is done (0 = done or none). */
export function jobRemaining(s: WorldState): number {
  const j = s.wardrobe.job;
  return j ? Math.max(0, j.done - s.playTime) : 0;
}

/** 0..1 progress of the running job. */
export function jobProgress(s: WorldState): number {
  const j = s.wardrobe.job;
  if (!j) return 0;
  const total = Math.max(0.001, j.done - j.start);
  return Math.max(0, Math.min(1, (s.playTime - j.start) / total));
}

export function startCraft(s: WorldState, id: string): boolean {
  const w = WEAR_BY_ID.get(id);
  if (!w || w.source.kind !== "craft" || craftStatus(s, id).state !== "ready") return false;
  pay(s, w.source.recipe);
  s.wardrobe.job = {
    kind: "craft",
    id,
    start: s.playTime,
    done: s.playTime + w.source.seconds,
  };
  return true;
}

export function refineStatus(s: WorldState, recipeId: string): CraftStatus {
  const r = REFINE_RECIPES.find((x) => x.id === recipeId);
  if (!r) return { state: "locked", missing: {} };
  const missing = missingFor(s, r.inputs);
  if (Object.keys(missing).length) return { state: "missing", missing };
  return startable(s);
}

export function startRefine(s: WorldState, recipeId: string): boolean {
  const r = REFINE_RECIPES.find((x) => x.id === recipeId);
  if (!r || refineStatus(s, recipeId).state !== "ready") return false;
  pay(s, r.inputs);
  s.wardrobe.job = { kind: "refine", id: r.id, start: s.playTime, done: s.playTime + r.seconds };
  return true;
}

export function dyeStatus(s: WorldState, itemId: string, colorway: string): CraftStatus {
  const w = WEAR_BY_ID.get(itemId);
  const c = w?.colorways.find((x) => x.id === colorway);
  if (!w || !c?.dye || !ownsWear(s, itemId)) return { state: "locked", missing: {} };
  if (s.wardrobe.dyes[`${itemId}.${colorway}`]) return { state: "owned", missing: {} };
  const missing = missingFor(s, c.dye);
  if (Object.keys(missing).length) return { state: "missing", missing };
  return startable(s);
}

export function startDye(s: WorldState, itemId: string, colorway: string): boolean {
  if (dyeStatus(s, itemId, colorway).state !== "ready") return false;
  const c = WEAR_BY_ID.get(itemId)!.colorways.find((x) => x.id === colorway)!;
  pay(s, c.dye!);
  s.wardrobe.job = {
    kind: "dye",
    id: `${itemId}.${colorway}`,
    start: s.playTime,
    done: s.playTime + DYE_SECONDS,
  };
  return true;
}

export interface JobResult {
  kind: "craft" | "refine" | "dye";
  /** Wear id, refine recipe id, or `<item>.<colorway>`. */
  id: string;
  text: string;
}

/** Finish the running job when its time is up (call from the game tick / when the menu opens). */
export function finishJob(s: WorldState): JobResult | null {
  const j = s.wardrobe.job;
  if (!j || s.playTime < j.done) return null;
  s.wardrobe.job = null;
  if (j.kind === "craft") {
    grantWear(s, j.id, "craft");
    const w = WEAR_BY_ID.get(j.id);
    return { ...j, text: tr("The replicator hands over: {name}", { name: w?.name ?? j.id }) };
  }
  if (j.kind === "refine") {
    const r = REFINE_RECIPES.find((x) => x.id === j.id);
    if (r) addItem(s, r.output, r.count);
    s.counters.wear_refined = (s.counters.wear_refined ?? 0) + 1;
    return { ...j, text: r?.label ?? j.id };
  }
  s.wardrobe.dyes[j.id] = true;
  s.counters.wear_dyed = (s.counters.wear_dyed ?? 0) + 1;
  const [itemId, cw] = j.id.split(".");
  const w = WEAR_BY_ID.get(itemId ?? "");
  const c = w?.colorways.find((x) => x.id === cw);
  return {
    ...j,
    text: tr("Dyed: {name} in {colour}", { name: w?.name ?? "?", colour: c?.label ?? "?" }),
  };
}

/** Crafted pieces that are owned and not worn can be recycled. */
export function canRecycle(s: WorldState, id: string): boolean {
  const w = WEAR_BY_ID.get(id);
  if (!w || w.source.kind !== "craft" || !ownsWear(s, id)) return false;
  return !WEAR_SLOTS.some((slot) => s.wardrobe.look[slot]?.item === id);
}

/** Textile resources a recycle returns. */
export function recycleYield(id: string): Record<string, number> {
  const w = WEAR_BY_ID.get(id);
  if (!w || w.source.kind !== "craft") return {};
  const out: Record<string, number> = {};
  for (const [item, n] of Object.entries(w.source.recipe)) {
    if (!(TEXTILE_ITEMS as readonly string[]).includes(item)) continue;
    const back = Math.floor(n * RECYCLE_SHARE);
    if (back > 0) out[item] = back;
  }
  if (!Object.keys(out).length) out.stoffreste = 1;
  return out;
}

export function recycle(s: WorldState, id: string): Record<string, number> | null {
  if (!canRecycle(s, id)) return null;
  const back = recycleYield(id);
  delete s.wardrobe.owned[id];
  for (const k of Object.keys(s.wardrobe.dyes))
    if (k.startsWith(`${id}.`)) delete s.wardrobe.dyes[k];
  for (const [item, n] of Object.entries(back)) addItem(s, item, n);
  s.counters.wear_recycled = (s.counters.wear_recycled ?? 0) + 1;
  return back;
}

// ── Stats (achievements, menus) ─────────────────────────────────

export interface WardrobeStats {
  owned: number;
  total: number;
  found: number;
  totalFinds: number;
  crafted: number;
  /** Slots with something other than the default look. */
  changedSlots: number;
}

export function wardrobeStats(s: WorldState): WardrobeStats {
  const finds = WEAR_ITEMS.filter((w) => w.source.kind === "find");
  let changedSlots = 0;
  for (const slot of WEAR_SLOTS) {
    const a = s.wardrobe.look[slot];
    const b = DEFAULT_LOOK[slot];
    if (a?.item !== b?.item || a?.colorway !== b?.colorway) changedSlots++;
  }
  return {
    owned: WEAR_ITEMS.filter((w) => s.wardrobe.owned[w.id]).length,
    total: WEAR_ITEMS.length,
    found: finds.filter((w) => s.wardrobe.owned[w.id]).length,
    totalFinds: finds.length,
    crafted: s.wardrobe.crafted,
    changedSlots,
  };
}

// ── Save sanitising ─────────────────────────────────────────────

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function sanitizeLook(raw: unknown, fallback: JadeLook): JadeLook {
  const out = cloneLook(fallback);
  if (!isRec(raw)) return out;
  for (const slot of WEAR_SLOTS) {
    const v = raw[slot];
    const def = WEAR_SLOT_BY_ID.get(slot)!;
    if (v === null) {
      if (def.optional) out[slot] = null;
      continue;
    }
    if (!isRec(v) || typeof v.item !== "string") continue;
    const w = WEAR_BY_ID.get(v.item);
    if (!w || w.slot !== slot) continue;
    const cw = typeof v.colorway === "string" && w.colorways.some((c) => c.id === v.colorway);
    out[slot] = { item: w.id, colorway: cw ? (v.colorway as string) : w.colorways[0]!.id };
  }
  return out;
}

/** Rebuild a valid wardrobe from anything (old saves, hand-edited blobs). Never throws. */
export function sanitizeWardrobe(raw: unknown): WardrobeState {
  const base = initialWardrobe();
  if (!isRec(raw)) return base;
  if (isRec(raw.owned))
    for (const [k, v] of Object.entries(raw.owned))
      if (v && WEAR_BY_ID.has(k)) base.owned[k] = true;
  if (isRec(raw.dyes))
    for (const [k, v] of Object.entries(raw.dyes)) {
      const [id, cw] = k.split(".");
      const w = WEAR_BY_ID.get(id ?? "");
      if (v && w && w.colorways.some((c) => c.id === cw && c.dye)) base.dyes[k] = true;
    }
  if (isRec(raw.found))
    for (const [k, v] of Object.entries(raw.found))
      if (WEAR_BY_ID.has(k) && typeof v === "number" && Number.isFinite(v) && v > 0)
        base.found[k] = Math.round(v);
  if (isRec(raw.seen))
    for (const [k, v] of Object.entries(raw.seen)) if (v && WEAR_BY_ID.has(k)) base.seen[k] = true;
  const crafted = typeof raw.crafted === "number" && Number.isFinite(raw.crafted) ? raw.crafted : 0;
  base.crafted = Math.max(0, Math.floor(crafted));
  // Only pieces that are owned (and colours that are available) stay on.
  const look = sanitizeLook(raw.look, DEFAULT_LOOK);
  for (const slot of WEAR_SLOTS) {
    const e = look[slot];
    if (!e) continue;
    const w = WEAR_BY_ID.get(e.item)!;
    const c = w.colorways.find((x) => x.id === e.colorway);
    const ok = base.owned[e.item] && (!c?.dye || base.dyes[`${e.item}.${e.colorway}`]);
    if (!ok) look[slot] = DEFAULT_LOOK[slot] ? { ...DEFAULT_LOOK[slot]! } : null;
  }
  base.look = look;
  if (Array.isArray(raw.presets))
    base.presets = base.presets.map((_, i) => {
      const p: unknown = (raw.presets as unknown[])[i];
      if (!isRec(p) || typeof p.name !== "string") return null;
      return { name: p.name.slice(0, 24), look: sanitizeLook(p.look, DEFAULT_LOOK) };
    });
  const j = raw.job;
  if (
    isRec(j) &&
    (j.kind === "craft" || j.kind === "refine" || j.kind === "dye") &&
    typeof j.id === "string" &&
    typeof j.start === "number" &&
    typeof j.done === "number" &&
    Number.isFinite(j.start) &&
    Number.isFinite(j.done)
  ) {
    const valid =
      j.kind === "craft"
        ? WEAR_BY_ID.has(j.id)
        : j.kind === "refine"
          ? REFINE_RECIPES.some((r) => r.id === j.id)
          : WEAR_BY_ID.has(j.id.split(".")[0] ?? "");
    if (valid) base.job = { kind: j.kind, id: j.id, start: j.start, done: j.done };
  }
  return base;
}

// ── Replicator helpers (UI, game tick) ──────────────────────────

/**
 * First time at the replicator: Jade's intro log. Returns true once (the
 * UI shows the intro card then).
 */
export function replicatorIntro(s: WorldState): boolean {
  if (s.flags[REPLICATOR_INTRO_FLAG]) return false;
  s.flags[REPLICATOR_INTRO_FLAG] = true;
  log(
    s,
    tr(
      "Needle's Eye, NDL-0. Built it in 2018 from a scrapped industrial sewing head, the spare gantry of the first fabricator and Damien's bathroom mirror. He never noticed.",
    ),
  );
  return true;
}

export interface WardrobeTick {
  /** The replicator job that just finished, if any. */
  job: JobResult | null;
  /** Reward pieces handed over just now. */
  rewards: string[];
}

/** Cheap periodic check (once a second is plenty): finish the job, hand out rewards. */
export function wardrobeTick(s: WorldState): WardrobeTick {
  syncWornFlags(s);
  return { job: finishJob(s), rewards: syncWearRewards(s) };
}

/** Mark pieces as looked at (the menu stops calling them “new”). */
export function markSeen(s: WorldState, ids: readonly string[]): boolean {
  let changed = false;
  for (const id of ids)
    if (WEAR_BY_ID.has(id) && s.wardrobe.owned[id] && !s.wardrobe.seen[id]) {
      s.wardrobe.seen[id] = true;
      changed = true;
    }
  return changed;
}

/** Owned pieces the player has not looked at yet. */
export function unseenWear(s: WorldState): string[] {
  return WEAR_ITEMS.filter((w) => s.wardrobe.owned[w.id] && !s.wardrobe.seen[w.id]).map(
    (w) => w.id,
  );
}

export function renamePreset(s: WorldState, index: number, name: string): boolean {
  const p = s.wardrobe.presets[index];
  if (!p) return false;
  p.name = name.trim().slice(0, 24) || tr("Outfit {n}", { n: index + 1 });
  return true;
}

export function clearPreset(s: WorldState, index: number): boolean {
  if (!s.wardrobe.presets[index]) return false;
  s.wardrobe.presets[index] = null;
  return true;
}

/** Colourways of a piece Jade can wear right now (free or already dyed). */
export function availableColorways(s: WorldState, itemId: string): string[] {
  const w = WEAR_BY_ID.get(itemId);
  if (!w) return [];
  return w.colorways.filter((c) => colorwayAvailable(s, itemId, c.id)).map((c) => c.id);
}

/**
 * “Surprise me”: a random look from owned pieces and available colours.
 * Away from the wardrobe only gear and accessories change. `rand` returns
 * 0..1 (Math.random in the UI, a seeded generator in tests). Returns the
 * slots that changed.
 */
export function surpriseLook(
  s: WorldState,
  atWardrobe: boolean,
  rand: () => number = Math.random,
): WearSlot[] {
  const changed: WearSlot[] = [];
  for (const slot of WEAR_SLOTS) {
    const def = WEAR_SLOT_BY_ID.get(slot)!;
    if (def.wardrobeOnly && !atWardrobe) continue;
    const pool = ownedWear(s, slot);
    const bare = def.optional && (pool.length === 0 || rand() < 0.3);
    if (bare) {
      if (equip(s, slot, null, undefined, atWardrobe)) changed.push(slot);
      continue;
    }
    const w = pool[Math.floor(rand() * pool.length) % pool.length];
    if (!w) continue;
    const cws = availableColorways(s, w.id);
    const cw = cws[Math.floor(rand() * cws.length) % cws.length];
    if (equip(s, slot, w.id, cw, atWardrobe)) changed.push(slot);
  }
  return changed;
}

/** Stable string of a look (engine refresh checks, React keys). */
export function lookSignature(look: JadeLook): string {
  return WEAR_SLOTS.map((k) => (look[k] ? `${look[k]!.item}.${look[k]!.colorway}` : "-")).join("|");
}

/** Display name of a pickup item that may be a wardrobe piece (`wear:<id>`). */
export function wearItemName(itemId: string): string | undefined {
  const id = wearIdFromItem(itemId);
  return id ? WEAR_BY_ID.get(id)?.name : undefined;
}

/** How many pieces of the given source kind the player owns / exist. */
export function sourceProgress(
  s: WorldState,
  kind: WearItem["source"]["kind"],
): { owned: number; total: number } {
  const list = WEAR_ITEMS.filter((w) => w.source.kind === kind);
  return { owned: list.filter((w) => s.wardrobe.owned[w.id]).length, total: list.length };
}

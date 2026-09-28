/**
 * Pure read-only derivations for the lab-world panels (no React, no DOM).
 * Nothing here mutates the world state; the rules live in lib/world/game.ts.
 */
import { intlLocale, tr } from "@/lib/i18n";
import { VOLATILITY_LIMIT, combine, type CombineResult } from "@/lib/world/combine";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import {
  ITEM_BY_ID,
  RECIPES,
  RECIPE_BY_KEY,
  comboKey,
  type Recipe,
} from "@/lib/world/content/items";
import { ROOMS } from "@/lib/world/content/map";
import {
  count,
  isBuilt,
  isOnline,
  isProtected,
  isSwitchedOn,
  itemDef,
  itemFits,
  maxCombineInputs,
  recipeAvailable,
  stagesDone,
  type PowerStatus,
} from "@/lib/world/game";
import { addTraits, emptyTraits } from "@/lib/world/traits";
import type {
  DeviceDef,
  ItemDef,
  ItemKind,
  TraitAxis,
  Traits,
  WorldState,
} from "@/lib/world/types";

// ── Inventory ────────────────────────────────────────────────────

export type ItemSort = "art" | "name" | "menge" | "volatilitaet" | "eigenschaft";

export const ITEM_SORT_LABEL: Record<ItemSort, string> = {
  art: tr("Kind"),
  name: tr("Name"),
  menge: tr("Quantity"),
  volatilitaet: tr("Volatility"),
  eigenschaft: tr("Trait"),
};

/** Kind order for the "Kind" sort (rarest last). */
const KIND_ORDER: Record<ItemKind, number> = {
  rohstoff: 0,
  bauteil: 1,
  werkzeug: 2,
  prototyp: 3,
  relikt: 4,
  schlacke: 5,
  verbrauch: 6,
};

export function sortItems(
  items: readonly ItemDef[],
  sort: ItemSort,
  inventory: Record<string, number>,
  axis: TraitAxis = "energie",
): ItemDef[] {
  const byName = (a: ItemDef, b: ItemDef) => a.name.localeCompare(b.name, intlLocale());
  return [...items].sort((a, b) => {
    switch (sort) {
      case "name":
        return byName(a, b);
      case "menge":
        return (inventory[b.id] ?? 0) - (inventory[a.id] ?? 0) || byName(a, b);
      case "volatilitaet":
        return b.volatility - a.volatility || b.depth - a.depth || byName(a, b);
      case "eigenschaft":
        return b.traits[axis] - a.traits[axis] || byName(a, b);
      default:
        return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byName(a, b);
    }
  });
}

/** Case-insensitive match on name, description and kind. */
export function matchesQuery(def: ItemDef, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return (
    def.name.toLowerCase().includes(n) ||
    def.description.toLowerCase().includes(n) ||
    def.kind.includes(n)
  );
}

export function inventoryItems(s: WorldState): ItemDef[] {
  return Object.keys(s.inventory)
    .filter((id) => (s.inventory[id] ?? 0) > 0)
    .map((id) => itemDef(s, id))
    .filter((x): x is ItemDef => !!x);
}

/** A build slot an item can fill. */
export interface StageUse {
  device: DeviceDef;
  stageIndex: number;
  stageName: string;
  label: string;
  /** Slot names the item explicitly (otherwise it fits by traits). */
  exact: boolean;
  /** The stage is the device's next one. */
  next: boolean;
}

/** Recipes that consume the item (only those the player could know). */
export function recipeUses(s: WorldState, id: string): Recipe[] {
  return RECIPES.filter(
    (r) =>
      (r.inputs[id] ?? 0) > 0 &&
      recipeAvailable(s, r) &&
      (!r.secret || !!s.recipesKnown[comboKey(r.inputs)]) &&
      Object.keys(r.inputs).every((i) => s.flags[`seen_${i}`] || (s.inventory[i] ?? 0) > 0),
  );
}

/**
 * Open build stages (of discovered blueprints) whose slots this item fits,
 * by name or by traits. Finished stages are skipped.
 */
export function stageUses(s: WorldState, def: ItemDef): StageUse[] {
  const out: StageUse[] = [];
  for (const d of DEVICES) {
    if (!s.discovered[d.id]) continue;
    const done = stagesDone(s, d.id);
    d.stages.forEach((st, i) => {
      if (i < done) return;
      for (const req of st.requires) {
        if (!itemFits(def, req)) continue;
        out.push({
          device: d,
          stageIndex: i,
          stageName: st.name,
          label: req.label,
          exact: req.item === def.id,
          next: i === done,
        });
        break;
      }
    });
  }
  // Exact matches and next stages first.
  return out.sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.next) - Number(a.next));
}

export interface SalvageInfo {
  ok: boolean;
  reason?: string;
  /** Parts that come back (one is lost). */
  returns: string[];
}

/** Mirrors `disassemble()` without touching the state. */
export function salvageInfo(s: WorldState, id: string): SalvageInfo {
  const def = itemDef(s, id);
  if (!def || count(s, id) < 1)
    return { ok: false, reason: tr("Not in the inventory."), returns: [] };
  if (isProtected(id))
    return {
      ok: false,
      reason: tr("{name} is one of a kind. It does not get taken apart.", { name: def.name }),
      returns: [],
    };
  let parts: string[] = [];
  if (def.parents) parts = [...def.parents];
  else {
    const recipe = RECIPES.find((r) => r.output === id && r.count === 1);
    if (recipe)
      for (const [k, n] of Object.entries(recipe.inputs)) for (let i = 0; i < n; i++) parts.push(k);
  }
  if (parts.length < 2)
    return {
      ok: false,
      reason: tr("{name} cannot be salvaged.", { name: def.name }),
      returns: [],
    };
  parts.sort();
  parts.pop();
  if (!isOnline(s, "BTK-001"))
    return {
      ok: false,
      reason: tr("Needs the Basic Toolkit (BTK-001) online."),
      returns: parts,
    };
  return { ok: true, returns: parts };
}

// ── Workbench ────────────────────────────────────────────────────

export function slotCounts(slots: readonly string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const id of slots) m[id] = (m[id] ?? 0) + 1;
  return m;
}

export interface CombinePreview {
  inputs: Record<string, number>;
  key: string;
  /** Summed input volatility vs. VOLATILITY_LIMIT. */
  volSum: number;
  /** Summed input traits (before the 20 % loss). */
  slotTraits: Traits;
  /** Why the combination cannot run (null = it can). */
  blocked: string | null;
  /** Result of the pure engine (null with fewer than two parts or when blocked early). */
  result: CombineResult | null;
  /** The combination was never made before. */
  isNew: boolean;
  /** A recipe matches, so volatility does not matter. */
  safe: boolean;
}

/**
 * What `doCombine` would do with these slots — computed with the pure
 * `combine()` engine and the same gates, without mutating anything.
 */
export function previewCombine(s: WorldState, slots: readonly string[]): CombinePreview {
  const inputs = slotCounts(slots);
  const key = comboKey(inputs);
  const defs = slots.map((id) => itemDef(s, id)).filter((x): x is ItemDef => !!x);
  const volSum = defs.reduce((a, d) => a + d.volatility, 0);
  const slotTraits = defs.reduce((t, d) => addTraits(t, d.traits), emptyTraits());
  const base = { inputs, key, volSum, slotTraits, isNew: !s.recipesKnown[key] };
  const recipe = RECIPE_BY_KEY.get(key);
  if (slots.length < 2)
    return { ...base, blocked: tr("At least two parts."), result: null, safe: false };
  let blocked: string | null = null;
  if (slots.length > maxCombineInputs(s))
    blocked = tr("This workbench only has {n} slots.", { n: maxCombineInputs(s) });
  else if (Object.entries(inputs).some(([id, n]) => count(s, id) < n))
    blocked = tr("Not enough parts in the inventory.");
  else if (Object.keys(inputs).some((id) => isProtected(id)))
    blocked = tr("One-of-a-kind items stay off the bench.");
  else if (recipe && !recipeAvailable(s, recipe))
    blocked = tr("Process unknown — the Nexus (NXS-01) has to research it first.");
  const result = combine(inputs, s.generated, (dev) => isOnline(s, dev));
  if (!blocked && result.kind === "missing-station") blocked = result.message;
  if (!blocked && result.kind === "invalid") blocked = result.message;
  return { ...base, blocked, result, safe: !!recipe };
}

/** Risk band of a volatility sum. */
export function volatilityRisk(volSum: number): "ruhig" | "warm" | "kritisch" | "explosion" {
  if (volSum > VOLATILITY_LIMIT) return "explosion";
  if (volSum > VOLATILITY_LIMIT * 0.75) return "kritisch";
  if (volSum > VOLATILITY_LIMIT * 0.5) return "warm";
  return "ruhig";
}

/** Parse a canonical combo key ("a×2+b×1") back into inputs. */
export function parseComboKey(key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of key.split("+")) {
    const [id, n] = part.split("×");
    if (id && n && Number(n) > 0) out[id] = Number(n);
  }
  return out;
}

export interface KnownCombo {
  key: string;
  inputs: Record<string, number>;
  output: ItemDef | undefined;
  /** Station or research note, if any. */
  note?: string;
  source: "handbuch" | "entdeckt";
}

/**
 * Recipes the player knows: manual recipes whose inputs have been seen,
 * plus every combination made before (s.recipesKnown).
 */
export function knownCombos(s: WorldState): KnownCombo[] {
  const out = new Map<string, KnownCombo>();
  for (const r of RECIPES) {
    if (!recipeAvailable(s, r)) continue;
    // Secret recipes stay hidden until combined once (they then come in via recipesKnown below).
    if (r.secret) continue;
    if (!Object.keys(r.inputs).every((i) => s.flags[`seen_${i}`])) continue;
    const key = comboKey(r.inputs);
    out.set(key, {
      key,
      inputs: r.inputs,
      output: ITEM_BY_ID.get(r.output),
      note: r.station
        ? tr("needs {device}", { device: DEVICE_BY_ID.get(r.station)?.name ?? r.station })
        : undefined,
      source: "handbuch",
    });
  }
  for (const [key, outId] of Object.entries(s.recipesKnown)) {
    if (out.has(key)) continue;
    const def = itemDef(s, outId);
    if (!def || def.kind === "schlacke") continue;
    out.set(key, { key, inputs: parseComboKey(key), output: def, source: "entdeckt" });
  }
  return [...out.values()];
}

/**
 * Slot list for a combo if the inventory holds all parts and it fits the
 * bench; otherwise the reason it cannot be filled.
 */
export function fillSlots(
  s: WorldState,
  inputs: Record<string, number>,
): { slots: string[] } | { error: string } {
  const slots: string[] = [];
  for (const [id, n] of Object.entries(inputs)) {
    if (isProtected(id)) return { error: tr("One-of-a-kind items do not go on the workbench.") };
    if (count(s, id) < n)
      return {
        error: tr("Missing {name} ({have}/{need}).", {
          name: itemDef(s, id)?.name ?? id,
          have: count(s, id),
          need: n,
        }),
      };
    for (let i = 0; i < n; i++) slots.push(id);
  }
  if (slots.length > maxCombineInputs(s))
    return {
      error: tr("Needs {n} slots — the workbench has {max}.", {
        n: slots.length,
        max: maxCombineInputs(s),
      }),
    };
  return { slots };
}

// ── Power ────────────────────────────────────────────────────────

/**
 * Brownout priority, mirroring the consumer order in `power()`: the MCP
 * and the power infrastructure are served first, everything else in
 * catalogue order. When generation falls short, the tail loses power first.
 */
export const CONSUMER_PRIORITY: readonly string[] = [
  "MCP-000",
  "BAT-001",
  "PWR-001",
  "THM-001",
  ...DEVICES.map((d) => d.id).filter(
    (id) => !["MCP-000", "BAT-001", "PWR-001", "THM-001"].includes(id),
  ),
];

export interface ConsumerRow {
  device: DeviceDef;
  priority: number;
  switchedOn: boolean;
  online: boolean;
  starved?: "strom" | "hitze";
}

export function consumerRows(s: WorldState, p: PowerStatus): ConsumerRow[] {
  const rows: ConsumerRow[] = [];
  CONSUMER_PRIORITY.forEach((id, i) => {
    const d = DEVICE_BY_ID.get(id);
    if (!d || d.power <= 0) return;
    const partial = id === "MCP-000" && stagesDone(s, id) > 0;
    if (!isBuilt(s, id) && !partial) return;
    rows.push({
      device: d,
      priority: i + 1,
      switchedOn: isSwitchedOn(s, id),
      online: p.online.has(id),
      starved: p.starved.find((x) => x.id === id)?.reason,
    });
  });
  return rows;
}

/** Online consumers in the order they would go dark on a shortfall. */
export function brownoutOrder(rows: readonly ConsumerRow[]): ConsumerRow[] {
  return rows.filter((r) => r.online).reverse();
}

export interface PowerSample {
  t: number;
  generation: number;
  demand: number;
}

export const POWER_HISTORY_MAX = 90;

/** Append a sample (collapsing same-second duplicates), bounded length. */
export function pushSample(list: PowerSample[], sample: PowerSample): PowerSample[] {
  const last = list[list.length - 1];
  const next = last && last.t === sample.t ? [...list.slice(0, -1), sample] : [...list, sample];
  return next.length > POWER_HISTORY_MAX ? next.slice(next.length - POWER_HISTORY_MAX) : next;
}

export interface LightRow {
  id: string;
  name: string;
  lit: boolean;
  by?: string;
  visited: boolean;
}

/** Rooms whose light depends on a device (plus base lighting). */
export function lightRows(s: WorldState, p: PowerStatus): LightRow[] {
  return ROOMS.filter((r) => r.litBy).map((r) => ({
    id: r.id,
    name: r.name,
    lit: p.generation >= 50 && p.online.has(r.litBy!),
    by: r.litBy,
    visited: !!s.flags[`visited_${r.id}`],
  }));
}

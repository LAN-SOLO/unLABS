/**
 * Lab World — game rules.
 * =======================
 *
 * Pure functions over `WorldState`: conditions, power grid, discovery,
 * building, combining, salvage, puzzles, notes, endings, hints. The React
 * layer calls these and re-renders; the 3D layer only reads the state.
 * Functions mutate the passed state in place and return a small report.
 */
import {
  clockFactor,
  drawFactor,
  fwFault,
  fwOf,
  heatOf,
  isStable,
  kernelLoad,
  rootPowerKey,
  thermalLimit,
  tun,
} from "@/lib/world/root/model";
import { initialRoot } from "@/lib/world/root/state";
import { initialOps } from "@/lib/world/ops/state";
import {
  FIRMWARE,
  FW_TUNING,
  effectiveDraw,
  firmwareAtLeast,
  hasFeature,
  isUpdated,
} from "@/lib/world/firmware";
import { isLinked, linksOf } from "@/lib/world/links";
import { PERK_TUNING, hasPerk } from "@/lib/world/perks";
import { sourceOf, tr } from "@/lib/i18n";
import { buffMultiplier } from "@/lib/world/buffs";
import {
  BOT_PROFILES,
  MAX_INPUTS,
  PROTO_EFFECT_BY_ID,
  PUZZLE_AXIS,
  PUZZLE_BYPASS_MIN,
  VOLATILITY_LIMIT,
  archetypeFlag,
  archetypeOf,
  combine,
  lookupItem,
  prototypeAffordances,
  reaches,
  type CombineResult,
  type ProtoEffectId,
} from "@/lib/world/combine";
import { DEVICES, DEVICE_BY_ID, NEEDS_COOLING } from "@/lib/world/content/devices";
import {
  ITEM_BY_ID,
  PROTECTED_ITEMS,
  RECIPES,
  RECIPE_BY_KEY,
  SLICE_ITEM,
  SLICE_TOTAL,
  comboKey,
  type Recipe,
} from "@/lib/world/content/items";
import {
  DOORS,
  FLOOR_ACCESS,
  FLOOR_BY_ID,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  ROOM_BY_ID,
  SLICE_PICKUPS,
  SPAWN,
  roomAt,
  doorTouches,
} from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import {
  BOT_QUESTS,
  DEVICE_INSIGHTS,
  ENDINGS,
  INSIGHTS,
  INSIGHT_BY_ID,
  NPCS,
} from "@/lib/world/content/story";
import { fnv1a, meetsTraits, signatureMatch, traitTotal } from "@/lib/world/traits";
import type {
  Experiment,
  Condition,
  DeviceDef,
  DialogueLine,
  DialogueOption,
  DoorDef,
  EndingDef,
  FloorId,
  ItemDef,
  PickupDef,
  Requirement,
  RoomDef,
  WorldState,
} from "@/lib/world/types";
import { dailyPriceModifier } from "@/lib/game/volatility";
import { WEAR_BY_ID } from "@/lib/world/content/wardrobe";
import { grantWear, initialWardrobe, isWearPickupItem, wearIdFromItem } from "@/lib/world/wardrobe";
import { initialMatrix } from "@/lib/world/matrix/state";

export const STARTER_DEVICES = ["MCP-000", "CLK-001", "VNT-001", "BTK-001", "UEC-001"] as const;

/**
 * Current save format version (see `lib/world/save.ts` `MIGRATIONS`).
 * Bump it together with a new migration step whenever the persisted shape
 * or the meaning of a field changes.
 */
export const SAVE_VERSION = 10;

export function initialState(): WorldState {
  const s: WorldState = {
    version: SAVE_VERSION,
    floor: SPAWN.floor,
    pos: [...SPAWN.pos],
    inventory: {},
    generated: {},
    built: { "MCP-000": 1 },
    switchedOn: {},
    discovered: {},
    insights: {},
    flags: {},
    puzzles: {},
    taken: {},
    read: {},
    doorsOpen: {},
    endings: {},
    recipesKnown: {},
    log: [],
    playTime: 0,
    combos: 0,
    counters: {},
    firmware: {},
    links: {},
    archive: {},
    tuning: {},
    memos: [],
    courses: {},
    readouts: {},
    experiments: [],
    wardrobe: initialWardrobe(),
    matrix: initialMatrix(),
    ops: initialOps(),
    root: initialRoot(),
  };
  for (const id of STARTER_DEVICES) s.discovered[id] = true;
  log(s, tr("Cold start. Residual charge 0.3 %. Something is humming somewhere."));
  return s;
}

export function log(s: WorldState, text: string): void {
  s.log.push({ t: Math.round(s.playTime), text });
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}

// ── Items ────────────────────────────────────────────────────────

export function itemDef(s: WorldState, id: string): ItemDef | undefined {
  return lookupItem(id, s.generated);
}

export function addItem(s: WorldState, id: string, count = 1): void {
  s.inventory[id] = (s.inventory[id] ?? 0) + count;
  s.flags[`seen_${id}`] = true;
  s.flags[`held_${id}`] = true;
  // Slices of Crystal #0089 are counted once found, even if later used up.
  if (id === SLICE_ITEM) s.counters.slices = (s.counters.slices ?? 0) + count;
}

/** Increment a numeric counter (achievements, quests). */
export function bump(s: WorldState, key: string, by = 1): number {
  s.counters[key] = (s.counters[key] ?? 0) + by;
  return s.counters[key];
}

export function removeItem(s: WorldState, id: string, count = 1): boolean {
  const have = s.inventory[id] ?? 0;
  if (have < count) return false;
  if (have === count) delete s.inventory[id];
  else s.inventory[id] = have - count;
  return true;
}

export function count(s: WorldState, id: string): number {
  return s.inventory[id] ?? 0;
}

// ── Devices & power ──────────────────────────────────────────────

export function stagesDone(s: WorldState, id: string): number {
  return s.built[id] ?? 0;
}

export function isBuilt(s: WorldState, id: string): boolean {
  const d = DEVICE_BY_ID.get(id);
  return !!d && stagesDone(s, id) >= d.stages.length;
}

export function isSwitchedOn(s: WorldState, id: string): boolean {
  return s.switchedOn[id] ?? true;
}

/** The calendar day that drives the UEC volatility (UTC, "YYYY-MM-DD"). */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Nominal UEC output; VLT-001 holds the core at least here. */
export const UEC_NOMINAL = 150;
/** PWD-001 compensates reactive power on the bus. */
export const PWD_BONUS = 20;

/** Today's UEC output, swinging with the global daily volatility. */
export function uecOutput(dayKey: string = todayKey()): number {
  return Math.round(UEC_NOMINAL * dailyPriceModifier(dayKey));
}

export interface PowerStatus {
  generation: number;
  demand: number;
  online: Set<string>;
  /** Built + switched on, but not powered (brownout) or overheated. */
  starved: { id: string; reason: "strom" | "hitze" }[];
  sources: { label: string; watts: number }[];
}

/**
 * Supply order. BAT-001 comes first: it draws 0 W and adds its 40 W buffer,
 * so a battery that is the only source still keeps the MCP alive.
 */
const CONSUMER_ORDER: string[] = [
  "BAT-001",
  "MCP-000",
  "PWR-001",
  "THM-001",
  ...DEVICES.map((d) => d.id).filter(
    (id) => !["BAT-001", "MCP-000", "PWR-001", "THM-001"].includes(id),
  ),
];

/**
 * Last power result per world state. The key covers everything `power()`
 * reads, so a hit is always correct; keying by state (WeakMap) keeps
 * interleaved states — the live game and a simulated/cloned one — from
 * evicting each other and lets dropped states be collected.
 */
const powerCache = new WeakMap<WorldState, { key: string; status: PowerStatus }>();

export function power(s: WorldState, dayKey?: string): PowerStatus {
  const day = dayKey ?? todayKey();
  const puffer = Math.min(PROTO_PUFFER_MAX, s.counters.proto_puffer ?? 0);
  const priority = s.links["PWR-001"] ?? [];
  const cooled = s.links["THM-001"] ?? [];
  const key = `${JSON.stringify(s.built)}|${JSON.stringify(s.switchedOn)}|${s.flags.geo_routed ? 1 : 0}|${puffer}|${day}|${priority.join(",")}|${JSON.stringify(s.firmware)}|${cooled.join(",")}|${rootPowerKey(s)}`;
  const hit = powerCache.get(s);
  if (hit && hit.key === key) return hit.status;

  const sources: { label: string; watts: number }[] = [];
  const online = new Set<string>();
  const starved: PowerStatus["starved"] = [];
  let generation = 0;
  if (s.flags.geo_routed) {
    generation += 50;
    sources.push({ label: tr("Geothermal tap"), watts: 50 });
  }
  if (puffer > 0) {
    generation += puffer;
    sources.push({ label: tr("Prototype buffer"), watts: puffer });
  }
  // Root lab: the UEC's tuned nominal output (sysctl power.uec.nominal) and firmware clocks.
  const nominal = tun(s, "power.uec.nominal");
  const thmRunning = isBuilt(s, "THM-001") && isSwitchedOn(s, "THM-001");
  for (const d of DEVICES) {
    if (d.power >= 0 || !isBuilt(s, d.id) || !isSwitchedOn(s, d.id)) continue;
    const fw = fwOf(s, d.id);
    const genCooled = thmRunning && cooled.includes(d.id);
    const heat = heatOf(fw) * (d.id === "UEC-001" ? nominal / UEC_NOMINAL : 1);
    if (!isStable(fw)) {
      starved.push({ id: d.id, reason: "strom" });
      continue;
    }
    if (heat > thermalLimit(s, genCooled) + 1e-9) {
      starved.push({ id: d.id, reason: "hitze" });
      continue;
    }
    const rated =
      d.id === "UEC-001"
        ? (uecOutput(day) * nominal) / UEC_NOMINAL
        : d.id === "MFR-001"
          ? fusionOutput(s)
          : -d.power;
    const w = Math.round(rated * (fw.clock / 100) * 10) / 10;
    generation += w;
    online.add(d.id);
    sources.push({ label: d.name, watts: w });
  }
  let demand = 0;
  // PWR-001 priority circuits: linked consumers are served right after the
  // grid's own head (battery, MCP, PWR, THM) — only while PWR-001 itself
  // came up in that head.
  const serve = (id: string): void => {
    const d = DEVICE_BY_ID.get(id);
    if (!d || d.power < 0) return;
    const partial = id === "MCP-000" && stagesDone(s, id) > 0;
    if (!(isBuilt(s, id) || partial) || !isSwitchedOn(s, id)) return;
    if (NEEDS_COOLING(d) && !online.has("THM-001")) {
      starved.push({ id, reason: "hitze" });
      return;
    }
    // Root lab firmware tuning: an undervolted core browns out, an overheated one trips.
    const fault = fwFault(s, id, online.has("THM-001") && cooled.includes(id));
    if (fault) {
      starved.push({ id, reason: fault === "hot" ? "hitze" : "strom" });
      return;
    }
    // Firmware, the THM-001 cooling loop and the tuned clock/voltage set the draw;
    // the MCP-000 also carries the kernel load of every pushed tunable.
    const draw =
      Math.round(
        (effectiveDraw(s, id, d.power, online.has("THM-001")) * drawFactor(fwOf(s, id)) +
          (id === "MCP-000" ? kernelLoad(s) : 0)) *
          10,
      ) / 10;
    if (demand + draw > generation + 1e-9) {
      starved.push({ id, reason: "strom" });
      return;
    }
    demand += draw;
    online.add(id);
    if (id === "PWR-001" && s.flags.geo_routed) {
      generation += 100;
      sources.push({ label: tr("Geothermal full load (PWR-001)"), watts: 100 });
    }
    if (id === "BAT-001") {
      const buffer = batteryBuffer(s);
      generation += buffer;
      sources.push({ label: tr("Battery buffer"), watts: buffer });
    }
    if (id === "PWD-001") {
      const bonus = tun(s, "power.pwd.bonus");
      generation += bonus;
      sources.push({ label: tr("Reactive power compensation (PWD-001)"), watts: bonus });
    }
    if (id === "VLT-001" && online.has("UEC-001")) {
      const dip = Math.round((nominal - (uecOutput(day) * nominal) / UEC_NOMINAL) * 10) / 10;
      if (dip > 0) {
        generation += dip;
        sources.push({ label: tr("Voltage stabilisation (VLT-001)"), watts: dip });
      }
    }
  };
  const head = CONSUMER_ORDER.slice(0, 4);
  const rest = CONSUMER_ORDER.slice(4);
  for (const id of head) serve(id);
  const first = online.has("PWR-001") ? rest.filter((id) => priority.includes(id)) : [];
  for (const id of first) serve(id);
  for (const id of rest) if (!first.includes(id)) serve(id);
  const status: PowerStatus = {
    generation,
    demand: Math.round(demand * 10) / 10,
    online,
    starved,
    sources,
  };
  powerCache.set(s, { key, status });
  return status;
}

/**
 * Watts a consumer draws right now with its firmware tuning (root lab), the
 * same formula `power()` uses; the MCP-000 carries the kernel load on top.
 */
export function tunedDraw(s: WorldState, id: string): number {
  const d = DEVICE_BY_ID.get(id);
  if (!d || d.power < 0) return 0;
  const thm = isBuilt(s, "THM-001") && isSwitchedOn(s, "THM-001");
  return (
    Math.round(
      (effectiveDraw(s, id, d.power, thm) * drawFactor(fwOf(s, id)) +
        (id === "MCP-000" ? kernelLoad(s) : 0)) *
        10,
    ) / 10
  );
}

/** BAT-001's buffer on the grid (W; more with its `fast-charge` update). */
export function batteryBuffer(s: WorldState): number {
  const base = hasFeature(s, "BAT-001", "fast-charge") ? FW_TUNING.batteryBuffer : 40;
  // Root lab: sysctl power.battery.buffer moves the buffer from its 40 W rating.
  return base + tun(s, "power.battery.buffer") - 40;
}

/** MFR-001's output (W; more with its `fuel-autotune` update). */
export function fusionOutput(s: WorldState): number {
  return hasFeature(s, "MFR-001", "fuel-autotune")
    ? FW_TUNING.fusionOutput
    : -(DEVICE_BY_ID.get("MFR-001")?.power ?? -250);
}

export function isOnline(s: WorldState, id: string): boolean {
  return power(s).online.has(id);
}

// ── Conditions ───────────────────────────────────────────────────

export function evalCond(s: WorldState, c: Condition | undefined): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => evalCond(s, x));
  if ("any" in c) return c.any.some((x) => evalCond(s, x));
  if ("not" in c) return !evalCond(s, c.not);
  if ("device" in c) return c.state === "built" ? isBuilt(s, c.device) : isOnline(s, c.device);
  if ("insight" in c) return !!s.insights[c.insight];
  if ("flag" in c) return !!s.flags[c.flag];
  if ("item" in c) return count(s, c.item) >= (c.count ?? 1);
  if ("puzzle" in c) return !!s.puzzles[c.puzzle];
  if ("power" in c) return power(s).generation >= c.power;
  if ("counter" in c) return (s.counters[c.counter] ?? 0) >= c.min;
  if ("link" in c) return isLinked(s, c.link, c.to);
  if ("firmware" in c) return firmwareAtLeast(s, c.firmware, c.min);
  if ("archive" in c) return s.archive[c.archive] !== undefined;
  return false;
}

/** Plain-language rendering of a condition (for lock hints and the journal). */
export function describeCond(c: Condition): string {
  if ("all" in c) return joinAnd(c.all.map(describeCond));
  if ("any" in c) return `(${joinOr(c.any.map(describeCond))})`;
  if ("not" in c) return tr("not {cond}", { cond: describeCond(c.not) });
  if ("device" in c) {
    const device = DEVICE_BY_ID.get(c.device)?.name ?? c.device;
    return c.state === "built"
      ? tr("{device} built", { device })
      : tr("{device} online", { device });
  }
  if ("insight" in c)
    return tr("Insight “{title}”", { title: INSIGHT_BY_ID.get(c.insight)?.title ?? c.insight });
  if ("flag" in c) return flagLabel(c.flag);
  if ("item" in c) return `${c.count ?? 1}× ${ITEM_BY_ID.get(c.item)?.name ?? c.item}`;
  if ("puzzle" in c)
    return tr("Puzzle “{title}”", { title: PUZZLE_BY_ID.get(c.puzzle)?.title ?? c.puzzle });
  if ("counter" in c) return counterLabel(c.counter, c.min);
  if ("link" in c)
    return tr("{device} linked to {hub}", {
      device: DEVICE_BY_ID.get(c.to)?.name ?? c.to,
      hub: DEVICE_BY_ID.get(c.link)?.name ?? c.link,
    });
  if ("firmware" in c)
    return tr("{device} firmware {version} or newer", {
      device: DEVICE_BY_ID.get(c.firmware)?.name ?? c.firmware,
      version: c.min,
    });
  if ("archive" in c) return tr("a certain record found");
  return tr("{watts} W output", { watts: c.power });
}

/** "a and b and c" (each pair translated as a whole). */
export function joinAnd(parts: readonly string[]): string {
  return parts.reduce((a, b) => tr("{a} and {b}", { a, b }));
}

/** "a or b or c". */
export function joinOr(parts: readonly string[]): string {
  return parts.reduce((a, b) => tr("{a} or {b}", { a, b }));
}

/** Readable name of a state flag (for hints like »Erscheint, sobald: …«). */
export function flagLabel(flag: string): string {
  const bot = /^bot_(.+)_awake$/.exec(flag);
  if (bot)
    return tr("{name} reactivated", { name: NPCS.find((n) => n.id === bot[1])?.name ?? bot[1]! });
  if (flag === "geo_routed") return tr("Geothermal tap connected");
  if (flag.startsWith("ending_")) {
    const e = ENDINGS.find((x) => `ending_${x.id}` === flag);
    if (e) return tr("Ending “{title}” reached", { title: e.title });
  }
  if (flag.startsWith("research_")) {
    const t = RESEARCH_BY_ID.get(flag.slice("research_".length));
    if (t) return tr("Research “{title}” completed", { title: t.title });
  }
  const pz = [...PUZZLE_BY_ID.values()].find((p) => p.reward?.flags?.includes(flag));
  if (pz) return tr("Puzzle “{title}” solved", { title: pz.title });
  return flag;
}

/** Readable name of a counter threshold. */
export function counterLabel(counter: string, min: number): string {
  if (counter === "slices") return tr("{n} slices of Crystal #0089 found", { n: min });
  if (counter === "drone_runs")
    return min === 1 ? tr("one drone flight") : tr("{n} drone flights", { n: min });
  if (counter === "research") return tr("{n} research points", { n: min });
  if (counter === "bots_awake")
    return min === 1 ? tr("one lore bot awake") : tr("{n} lore bots awake", { n: min });
  if (counter === "explosions")
    return min === 1
      ? tr("one explosion at the workbench")
      : tr("{n} explosions at the workbench", { n: min });
  if (counter === "endings")
    return min === 1 ? tr("any ending reached") : tr("{n} endings reached", { n: min });
  return `${counter} ≥ ${min}`;
}

// ── Insights & discovery ─────────────────────────────────────────

export function grant(s: WorldState, ids: readonly string[] | undefined): string[] {
  const fresh: string[] = [];
  for (const id of ids ?? []) {
    if (s.insights[id] || !INSIGHT_BY_ID.has(id)) continue;
    s.insights[id] = Math.round(s.playTime) || 1;
    fresh.push(id);
    log(s, tr("Insight: {title}", { title: INSIGHT_BY_ID.get(id)?.title ?? id }));
  }
  if (fresh.length) fresh.push(...settle(s).insights);
  return fresh;
}

export interface SettleReport {
  insights: string[];
  discovered: string[];
}

/** Apply automatic insights and blueprint discoveries until nothing changes. */
export function settle(s: WorldState): SettleReport {
  const report: SettleReport = { insights: [], discovered: [] };
  for (let guard = 0; guard < 10; guard++) {
    let changed = false;
    for (const i of INSIGHTS) {
      if (!s.insights[i.id] && i.auto && evalCond(s, i.auto)) {
        s.insights[i.id] = Math.round(s.playTime) || 1;
        report.insights.push(i.id);
        log(s, tr("Insight: {title}", { title: i.title }));
        changed = true;
      }
    }
    for (const d of DEVICES) {
      if (s.discovered[d.id]) continue;
      const needsBuilt = d.needs.every((n) => isBuilt(s, n));
      const trigger = d.discover.length === 0 || d.discover.some((c) => evalCond(s, c));
      if (needsBuilt && trigger) {
        s.discovered[d.id] = true;
        report.discovered.push(d.id);
        log(s, tr("Blueprint discovered: {name}", { name: d.name }));
        changed = true;
      }
    }
    if (!changed) break;
  }
  return report;
}

// ── Building ─────────────────────────────────────────────────────

/** Does this single item satisfy the requirement slot? */
export function itemFits(def: ItemDef, req: Requirement): boolean {
  if (req.item && def.id === req.item) return true;
  // Tools and unique relics only go where a slot asks for them by name.
  if (isProtected(def.id)) return false;
  if (req.traits && meetsTraits(def.traits, req.traits)) {
    if (req.maxVolatility !== undefined && def.volatility > req.maxVolatility) return false;
    return def.kind !== "schlacke";
  }
  return false;
}

/** Items in the inventory that could fill a slot, best (cheapest) first. */
export function candidates(s: WorldState, req: Requirement): ItemDef[] {
  const out: ItemDef[] = [];
  for (const id of Object.keys(s.inventory)) {
    const def = itemDef(s, id);
    if (def && itemFits(def, req)) out.push(def);
  }
  return out.sort((a, b) => {
    if (req.item) {
      if (a.id === req.item) return -1;
      if (b.id === req.item) return 1;
    }
    return traitTotal(a.traits) - traitTotal(b.traits);
  });
}

/** Greedy slot assignment: one item id per unit needed, or null if short. */
export function autoAssign(s: WorldState, reqs: readonly Requirement[]): (string[] | null)[] {
  const left: Record<string, number> = { ...s.inventory };
  return reqs.map((req) => {
    const need = req.count ?? 1;
    const picks: string[] = [];
    for (const def of candidates(s, req)) {
      while (picks.length < need && (left[def.id] ?? 0) > 0) {
        picks.push(def.id);
        left[def.id] = (left[def.id] ?? 0) - 1;
      }
      if (picks.length >= need) break;
    }
    return picks.length >= need ? picks : null;
  });
}

export interface StageCheck {
  device: DeviceDef;
  stageIndex: number;
  complete: boolean;
  blockers: string[];
  /** The subset of `blockers` that are missing items (the workbench can help). */
  itemBlockers: string[];
  /** The blocker that asks for a calibration puzzle, if any. */
  puzzleBlocker?: string;
  assignment: (string[] | null)[];
}

export function checkStage(s: WorldState, id: string): StageCheck | null {
  const device = DEVICE_BY_ID.get(id);
  if (!device) return null;
  const stageIndex = stagesDone(s, id);
  if (stageIndex >= device.stages.length) {
    return { device, stageIndex, complete: true, blockers: [], itemBlockers: [], assignment: [] };
  }
  const stage = device.stages[stageIndex]!;
  const blockers: string[] = [];
  if (!s.discovered[id]) blockers.push(tr("Blueprint unknown."));
  for (const n of device.needs) {
    if (!isBuilt(s, n))
      blockers.push(tr("Needs first: {name}.", { name: DEVICE_BY_ID.get(n)?.name ?? n }));
  }
  if (stage.when && !evalCond(s, stage.when))
    blockers.push(stage.whenHint ?? tr("Needs: {cond}.", { cond: describeCond(stage.when) }));
  let puzzleBlocker: string | undefined;
  if (stage.puzzle && !s.puzzles[stage.puzzle]) {
    puzzleBlocker = tr("Calibration: solve puzzle “{title}”.", {
      title: PUZZLE_BY_ID.get(stage.puzzle)?.title ?? stage.puzzle,
    });
    blockers.push(puzzleBlocker);
  }
  const assignment = autoAssign(s, stage.requires);
  const itemBlockers: string[] = [];
  assignment.forEach((a, i) => {
    if (!a) {
      const req = stage.requires[i]!;
      itemBlockers.push(missingText(req));
    }
  });
  blockers.push(...itemBlockers);
  return {
    device,
    stageIndex,
    complete: false,
    blockers,
    itemBlockers,
    ...(puzzleBlocker ? { puzzleBlocker } : {}),
    assignment,
  };
}

function missingText(req: Requirement): string {
  return tr("Missing: {count}× {label}.", { count: req.count ?? 1, label: req.label });
}

export interface BuildReport {
  ok: boolean;
  message: string;
  finished: boolean;
  discovered: string[];
  insights: string[];
}

/**
 * Complete the next stage. `assignment` may override the automatic slot
 * picks (one array of item ids per requirement).
 */
export function buildStage(s: WorldState, id: string, assignment?: string[][]): BuildReport {
  const check = checkStage(s, id);
  const fail = (message: string): BuildReport => ({
    ok: false,
    message,
    finished: false,
    discovered: [],
    insights: [],
  });
  if (!check) return fail(tr("Unknown device."));
  if (check.complete) return fail(tr("Already finished."));
  const stage = check.device.stages[check.stageIndex]!;
  const picks = assignment ?? check.assignment;
  const nonItemBlockers = check.blockers.filter((b) => !check.itemBlockers.includes(b));
  if (nonItemBlockers.length) return fail(nonItemBlockers[0]!);

  // Validate the (possibly user-chosen) picks against slots and inventory.
  const use: Record<string, number> = {};
  for (let i = 0; i < stage.requires.length; i++) {
    const req = stage.requires[i]!;
    const p = picks[i];
    if (!p || p.length < (req.count ?? 1)) return fail(missingText(req));
    for (const itemId of p) {
      const def = itemDef(s, itemId);
      if (!def || !itemFits(def, req))
        return fail(
          tr("{name} does not fit “{slot}”.", { name: def?.name ?? itemId, slot: req.label }),
        );
      use[itemId] = (use[itemId] ?? 0) + 1;
    }
  }
  for (const [itemId, n] of Object.entries(use)) {
    if (count(s, itemId) < n)
      return fail(tr("Not enough {name}.", { name: itemDef(s, itemId)?.name ?? itemId }));
  }
  for (const [itemId, n] of Object.entries(use)) removeItem(s, itemId, n);

  s.built[id] = check.stageIndex + 1;
  const finished = s.built[id] >= check.device.stages.length;
  log(s, `${check.device.name}: ${stage.name} — ${stage.text}`);
  const settled = settle(s);
  return {
    ok: true,
    message: finished ? check.device.mcp : stage.text,
    finished,
    discovered: settled.discovered,
    insights: settled.insights,
  };
}

export function toggleDevice(s: WorldState, id: string): boolean {
  s.switchedOn[id] = !isSwitchedOn(s, id);
  return s.switchedOn[id];
}

// ── Combination ──────────────────────────────────────────────────

/** Tools and one-of-a-kind relics that must never be lost to an experiment. */
export function isProtected(id: string): boolean {
  return PROTECTED_ITEMS.has(id);
}

/** Research-gated recipes only work once the Nexus has finished the topic. */
export function recipeAvailable(s: WorldState, r: Recipe): boolean {
  return !r.research || !!s.flags[researchFlag(r.research)];
}

export function maxCombineInputs(s: WorldState): number {
  return isOnline(s, "PWB-001") ? MAX_INPUTS : 3;
}

export interface CombineReport extends CombineResult {
  ok: boolean;
  discovered: string[];
  insights: string[];
  isNew: boolean;
  /** Prototype hit a named archetype for the first time (flag `arch_<id>` just set). */
  archetypeNew?: boolean;
  /** Effect families the new prototype qualifies for ("Taugt für: …"). */
  uses?: ProtoEffectId[];
}

export function doCombine(s: WorldState, inputs: Record<string, number>): CombineReport {
  const total = Object.values(inputs).reduce((a, b) => a + b, 0);
  const max = maxCombineInputs(s);
  const base = { discovered: [] as string[], insights: [] as string[], isNew: false };
  if (total > max) {
    return {
      ...base,
      ok: false,
      kind: "invalid",
      count: 0,
      key: comboKey(inputs),
      synergies: [],
      message: tr("This workbench only has {max} slots. The Portable Workbench (PWB-001) has 6.", {
        max,
      }),
    };
  }
  for (const [id, n] of Object.entries(inputs)) {
    if (count(s, id) < n) {
      return {
        ...base,
        ok: false,
        kind: "invalid",
        count: 0,
        key: comboKey(inputs),
        synergies: [],
        message: tr("Not enough parts in the inventory."),
      };
    }
  }
  const unique = Object.keys(inputs).find((id) => (inputs[id] ?? 0) > 0 && isProtected(id));
  if (unique) {
    return {
      ...base,
      ok: false,
      kind: "invalid",
      count: 0,
      key: comboKey(inputs),
      synergies: [],
      message: tr("{name} is one of a kind. It does not go on the workbench.", {
        name: itemDef(s, unique)?.name ?? unique,
      }),
    };
  }
  const gated = RECIPE_BY_KEY.get(comboKey(inputs));
  if (gated && !recipeAvailable(s, gated)) {
    return {
      ...base,
      ok: false,
      kind: "invalid",
      count: 0,
      key: comboKey(inputs),
      synergies: [],
      message: tr(
        "Nobody knows this process yet. The Nexus (NXS-01) has to research it first: “{topic}”.",
        { topic: RESEARCH_BY_ID.get(gated.research!)?.title ?? gated.research ?? "?" },
      ),
    };
  }
  const res = combine(inputs, s.generated, (dev) => isOnline(s, dev));
  if (!res.output || res.kind === "invalid" || res.kind === "missing-station") {
    if (res.kind === "invalid") recordExperiment(s, { inputs, outcome: "fail" });
    return { ...res, ...base, ok: false };
  }
  for (const [id, n] of Object.entries(inputs)) removeItem(s, id, n);
  const isNew = !s.recipesKnown[res.key];
  s.recipesKnown[res.key] = res.output.id;
  if (res.kind === "prototype") s.generated[res.output.id] = res.output;
  addItem(s, res.output.id, res.count);
  s.combos += 1;
  bump(s, `combo_${res.kind}`);
  recordExperiment(s, {
    inputs,
    outcome: res.kind === "prototype" || res.kind === "explosion" ? res.kind : "recipe",
    output: res.output.id,
  });

  // Explosions: the side event only pays out the first time a mix blows up.
  let message = res.message;
  let extras = res.extras;
  if (res.kind === "explosion" && res.event) {
    s.flags[`explosion_${res.event.id}`] = true;
    if (isNew) for (const x of extras ?? []) addItem(s, x.item, x.count);
    else if (extras?.length) {
      extras = [];
      message = tr(
        "Volatility {vol} > {limit}. It goes bang. Slag is all that is left. Same mix — nothing special left over this time.",
        { vol: res.volatility ?? 0, limit: VOLATILITY_LIMIT },
      );
    }
  }
  // EMC-001 `breach-guard`: the containment field catches one input part.
  const fieldCatch =
    res.kind === "explosion" && hasFeature(s, "EMC-001", "breach-guard") && isOnline(s, "EMC-001");
  if (fieldCatch) {
    const caught = Object.keys(inputs)
      .filter((id) => (inputs[id] ?? 0) > 0)
      .sort()[0];
    if (caught) {
      addItem(s, caught, 1);
      message = tr("{message} The containment field caught 1× {name}.", {
        message,
        name: itemDef(s, caught)?.name ?? caught,
      });
    }
  }
  // Perk `blast_catch` (course "Volatility"): Jade's own reflex saves one part when
  // the containment field did not.
  if (res.kind === "explosion" && !fieldCatch && hasPerk(s, "blast_catch")) {
    const caught = Object.keys(inputs)
      .filter((id) => (inputs[id] ?? 0) > 0)
      .sort()[0];
    if (caught) {
      addItem(s, caught, 1);
      message = tr("{message} You snatched 1× {name} off the bench in time.", {
        message,
        name: itemDef(s, caught)?.name ?? caught,
      });
    }
  }
  // Named archetypes: flag on first creation (the codex lists them).
  let archetypeNew: boolean | undefined;
  if (res.kind === "prototype" && res.archetype) {
    const flag = archetypeFlag(res.archetype.id);
    archetypeNew = !s.flags[flag];
    if (archetypeNew) {
      s.flags[flag] = true;
      bump(s, "archetypes");
      log(
        s,
        tr("Archetype discovered: {name} — {property}", {
          name: res.archetype.name,
          property: res.archetype.property,
        }),
      );
    }
  }
  const uses = res.kind === "prototype" ? prototypeAffordances(res.output) : [];
  const usesText = uses.map((u) => PROTO_EFFECT_BY_ID.get(u)?.name ?? u).join(", ");
  log(
    s,
    res.kind === "explosion"
      ? tr("Explosion! {message}", { message })
      : uses.length
        ? tr("Combined: {count}× {name} (good for: {uses})", {
            count: res.count,
            name: res.output.name,
            uses: usesText,
          })
        : tr("Combined: {count}× {name}", { count: res.count, name: res.output.name }),
  );

  const discovered: string[] = [];
  const insights: string[] = [];
  if (res.kind === "prototype") {
    insights.push(...grant(s, ["prototypen"]));
    // "One became something I didn't design." — prototypes can reveal blueprints.
    for (const d of DEVICES) {
      if (s.discovered[d.id]) continue;
      if (
        signatureMatch(res.output.traits, d.signature) >= 0.93 &&
        traitTotal(res.output.traits) >= 6
      ) {
        s.discovered[d.id] = true;
        discovered.push(d.id);
        log(s, tr("The prototype resembles a blueprint: {name}", { name: d.name }));
      }
    }
  }
  if (res.kind === "explosion") s.flags.explosion_seen = true;
  const settled = settle(s);
  return {
    ...res,
    message,
    extras,
    ok: true,
    isNew,
    archetypeNew,
    uses,
    discovered: [...discovered, ...settled.discovered],
    insights: [...insights, ...settled.insights],
  };
}

/** BTK-001: take a prototype or sub-assembly apart; one unit is lost. */
export function disassemble(
  s: WorldState,
  id: string,
): { ok: boolean; message: string; returned: string[] } {
  if (!isOnline(s, "BTK-001"))
    return {
      ok: false,
      message: tr("Taking things apart needs the Basic Toolkit (online)."),
      returned: [],
    };
  const def = itemDef(s, id);
  if (!def || count(s, id) < 1)
    return { ok: false, message: tr("Not in the inventory."), returned: [] };
  if (isProtected(id))
    return {
      ok: false,
      message: tr("{name} is one of a kind. It does not get taken apart.", { name: def.name }),
      returned: [],
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
      message: tr("{name} cannot be taken apart any further.", { name: def.name }),
      returned: [],
    };
  removeItem(s, id, 1);
  parts.sort();
  // BTK-001 `torque-profiles`: two-part assemblies come apart without loss.
  const lossless = parts.length === 2 && hasFeature(s, "BTK-001", "torque-profiles");
  if (!lossless) parts.pop(); // Zerlegungsverlust
  for (const p of parts) addItem(s, p, 1);
  log(s, tr("Taken apart: {name}", { name: def.name }));
  return {
    ok: true,
    message: lossless
      ? tr("{name} taken apart. The torque profiles saved every part.", { name: def.name })
      : tr("{name} taken apart. One part was lost.", { name: def.name }),
    returned: parts,
  };
}

/**
 * Print patterns: components held in *this* run. `seen_` survives NG+ (codex),
 * so older saves without `held_` fall back to it only outside NG+.
 */
function printable(s: WorldState, id: string): boolean {
  return !!s.flags[`held_${id}`] || (!s.flags.ng_plus && !!s.flags[`seen_${id}`]);
}

/** P3D-001: print any authored component held before, for one base alloy. */
export function fabricate(s: WorldState, id: string): { ok: boolean; message: string } {
  if (!isOnline(s, "P3D-001"))
    return { ok: false, message: tr("The 3D Fabricator is not online.") };
  const def = ITEM_BY_ID.get(id);
  if (!def || def.kind !== "bauteil" || !printable(s, id))
    return { ok: false, message: tr("Unknown print pattern.") };
  // P3D-001 `purge-saver`: every third print needs no filament.
  const free =
    hasFeature(s, "P3D-001", "purge-saver") &&
    ((s.counters.prints ?? 0) + 1) % FW_TUNING.freePrintEvery === 0;
  if (!free && !removeItem(s, "basislegierung", 1))
    return { ok: false, message: tr("Needs 1× Base Alloy as filament.") };
  addItem(s, id, 1);
  bump(s, "prints");
  log(s, tr("Printed: {name}", { name: def.name }));
  return {
    ok: true,
    message: free
      ? tr("{name} printed — purge saver: no filament used.", { name: def.name })
      : tr("{name} printed.", { name: def.name }),
  };
}

export function fabricable(s: WorldState): ItemDef[] {
  return [...ITEM_BY_ID.values()].filter((d) => d.kind === "bauteil" && printable(s, d.id));
}

// ── Recipe chains ────────────────────────────────────────────────

const RECIPES_BY_OUTPUT = new Map<string, Recipe[]>();
for (const r of RECIPES) {
  const list = RECIPES_BY_OUTPUT.get(r.output) ?? [];
  list.push(r);
  RECIPES_BY_OUTPUT.set(r.output, list);
}

/** "2 Basislegierung + Energiezelle" (+ yield / station suffix). */
function recipeInputsText(r: Recipe): string {
  let t = Object.entries(r.inputs)
    .map(([id, n]) => `${n > 1 ? `${n} ` : ""}${ITEM_BY_ID.get(id)?.name ?? id}`)
    .join(" + ");
  if (r.count > 1) t = tr("{inputs} (yields {n})", { inputs: t, n: r.count });
  if (r.station)
    t = tr("{inputs} [at {station}]", {
      inputs: t,
      station: DEVICE_BY_ID.get(r.station)?.name ?? r.station,
    });
  return t;
}

export interface RecipeChainLine {
  item: string;
  /** "Hochlegierung = 2 Basislegierung + Energiezelle". */
  text: string;
}

/**
 * How to make `item` from the explicit recipes, breadth-first down to
 * `maxDepth` levels ("Hochlegierung = 2 Basislegierung + Energiezelle",
 * "Basislegierung = 3 Abstractum + Energiezelle oder 3 Geröll", …).
 * With a state, research-gated recipes that are not unlocked yet and secret
 * recipes the player has not discovered (`recipesKnown`) are left out. Empty when the item has no recipe (a raw material).
 */
export function recipeChain(item: string, s?: WorldState, maxDepth = 3): RecipeChainLine[] {
  const out: RecipeChainLine[] = [];
  const seen = new Set<string>([item]);
  const queue: { id: string; depth: number }[] = [{ id: item, depth: 0 }];
  while (queue.length) {
    const { id, depth } = queue.shift()!;
    const recipes = (RECIPES_BY_OUTPUT.get(id) ?? []).filter(
      (r) => !s || (recipeAvailable(s, r) && (!r.secret || !!s.recipesKnown[comboKey(r.inputs)])),
    );
    if (!recipes.length) continue;
    out.push({
      item: id,
      text: `${ITEM_BY_ID.get(id)?.name ?? id} = ${joinOr(recipes.map(recipeInputsText))}`,
    });
    if (depth + 1 >= maxDepth) continue;
    for (const r of recipes)
      for (const input of Object.keys(r.inputs)) {
        if (seen.has(input)) continue;
        seen.add(input);
        queue.push({ id: input, depth: depth + 1 });
      }
  }
  return out;
}

export interface MissingPart {
  /** Slot label of the blueprint ("Gitter"). */
  label: string;
  /** The named item the slot asks for. */
  item: string;
  count: number;
  have: number;
  chain: RecipeChainLine[];
}

/**
 * Named parts that block the next stage of a blueprint (the slot cannot be
 * filled from the inventory) and that can be crafted — each with its
 * recipe chain. Empty when nothing craftable is missing.
 */
export function missingParts(s: WorldState, id: string): MissingPart[] {
  const c = checkStage(s, id);
  if (!c || c.complete) return [];
  const stage = c.device.stages[c.stageIndex]!;
  const out: MissingPart[] = [];
  stage.requires.forEach((req, i) => {
    if (c.assignment[i] || !req.item) return;
    const chain = recipeChain(req.item, s);
    if (!chain.length) return;
    out.push({
      label: req.label,
      item: req.item,
      count: req.count ?? 1,
      have: count(s, req.item),
      chain,
    });
  });
  return out;
}

// ── World objects ────────────────────────────────────────────────

export function pickupVisible(s: WorldState, p: PickupDef): boolean {
  return evalCond(s, p.hidden) || !!s.flags[revealedFlag(p.id)];
}

export function pickupAvailable(s: WorldState, p: PickupDef): boolean {
  if (!pickupVisible(s, p)) return false;
  const t = s.taken[p.id];
  if (t === undefined) return true;
  if (!p.respawn) return false;
  return s.playTime - t >= pickupRespawnSeconds(s, p);
}

/**
 * Effective respawn time of a pickup right now: the authored `respawn`,
 * halved at the geothermal seep while ATK-001 runs, times the active
 * `respawn_boost` buff (e.g. 0.5 after tending the greenhouse). 0 = never.
 */
export function pickupRespawnSeconds(s: WorldState, p: PickupDef): number {
  if (!p.respawn) return 0;
  const speed = p.id === "p_geo_seep" && isOnline(s, "ATK-001") ? 2 : 1;
  // CLK-001 `event-scheduler`: the clock schedules refills sooner.
  const sched =
    hasFeature(s, "CLK-001", "event-scheduler") && isOnline(s, "CLK-001")
      ? FW_TUNING.respawnFactor
      : 1;
  return (p.respawn / speed) * sched * buffMultiplier(s, s.playTime, "respawn_boost");
}

/** Seconds until a taken pickup is back (0 = available or never respawns). */
export function pickupRespawnLeft(s: WorldState, p: PickupDef): number {
  const t = s.taken[p.id];
  if (t === undefined || !p.respawn) return 0;
  return Math.max(0, pickupRespawnSeconds(s, p) - (s.playTime - t));
}

export interface TakeReport {
  ok: boolean;
  message: string;
  items: { item: string; count: number }[];
}

/**
 * Open a pickup. Salvage piles that need a tool give only their first
 * stack by hand; the rest stays until the tool is online.
 */
export function takePickup(s: WorldState, id: string): TakeReport {
  const p = PICKUPS.find((x) => x.id === id);
  if (!p || !pickupAvailable(s, p)) return { ok: false, message: tr("Nothing left."), items: [] };
  if (p.puzzle && !s.puzzles[p.puzzle]) return { ok: false, message: tr("Locked."), items: [] };
  const partialKey = `partial_${p.id}`;
  const hasTool = !p.tool || isOnline(s, p.tool);
  let items: { item: string; count: number }[];
  let done = true;
  if (hasTool) {
    items = s.flags[partialKey] ? p.items.slice(1) : p.items;
    delete s.flags[partialKey];
  } else if (s.flags[partialKey]) {
    const tool = DEVICE_BY_ID.get(p.tool!)?.name ?? p.tool;
    return {
      ok: false,
      message: tr("Nothing more to get here by hand. With {tool} there would be more.", {
        tool: tool ?? "?",
      }),
      items: [],
    };
  } else {
    items = p.items.slice(0, 1);
    s.flags[partialKey] = true;
    done = false;
  }
  if (p.pool && p.pool.length) {
    const n = s.counters[`pool_${p.id}`] ?? 0;
    s.counters[`pool_${p.id}`] = n + 1;
    items = [];
    for (let i = 0; i < (p.poolCount ?? 3); i++) {
      const item = p.pool[fnv1a(`${p.id}:${n}:${i}`) % p.pool.length]!;
      const existing = items.find((it) => it.item === item);
      if (existing) existing.count += 1;
      else items.push({ item, count: 1 });
    }
  }
  const bonus = p.id === "p_geo_seep" && isOnline(s, "ATK-001") ? 2 : 1;
  // Wardrobe finds (`wear:<id>`) go to Jade's wardrobe, not the inventory.
  const worn = items.filter((it) => isWearPickupItem(it.item));
  const given = items
    .filter((it) => !isWearPickupItem(it.item))
    .map((it) => ({ item: it.item, count: it.count * bonus }));
  // Perk `scrap_sense` (course "Salvage"): every n-th finished pile gives one part more.
  if (done && given.length && hasPerk(s, "scrap_sense")) {
    if (bump(s, "perk_scrap_n") % PERK_TUNING.scrapEvery === 0) given[0]!.count += 1;
  }
  for (const it of given) addItem(s, it.item, it.count);
  if (given.length)
    bump(
      s,
      "salvaged",
      given.reduce((a, it) => a + it.count, 0),
    );
  const pieces: string[] = [];
  for (const it of worn) {
    const id = wearIdFromItem(it.item);
    if (!id) continue;
    grantWear(s, id, "find");
    pieces.push(WEAR_BY_ID.get(id)?.name ?? id);
  }
  if (done) s.taken[p.id] = s.playTime;
  const names = [
    ...given.map((it) => `${it.count}× ${ITEM_BY_ID.get(it.item)?.name ?? it.item}`),
    ...pieces.map((name) => tr("{name} — for the wardrobe", { name })),
  ].join(", ");
  log(s, `${p.label}: ${names}`);
  const message = done
    ? names
    : tr("{items} — by hand. The Basic Toolkit could salvage more.", { items: names });
  return {
    ok: true,
    message,
    items: [...given, ...worn.map((it) => ({ item: it.item, count: 1 }))],
  };
}

/** True when a pile was salvaged by hand and needs the tool for the rest. */
export function pickupNeedsTool(s: WorldState, p: PickupDef): boolean {
  return !!s.flags[`partial_${p.id}`] && !!p.tool && !isOnline(s, p.tool);
}

export function readNote(s: WorldState, id: string): string[] {
  const n = NOTES.find((x) => x.id === id);
  if (!n) return [];
  s.read[id] = true;
  return grant(s, n.grants);
}

export function noteVisible(s: WorldState, id: string): boolean {
  const n = NOTES.find((x) => x.id === id);
  return !!n && (evalCond(s, n.hidden) || !!s.flags[revealedFlag(n.id)]);
}

export function doorIsOpen(s: WorldState, d: DoorDef): boolean {
  if (s.doorsOpen[d.id]) return true;
  if (d.keypad) return !!s.puzzles[d.keypad];
  return evalCond(s, d.lock);
}

export function doorsForFloor(floor: FloorId): DoorDef[] {
  return DOORS.filter((d) => d.floor === floor);
}

export function solvePuzzle(
  s: WorldState,
  id: string,
): { insights: string[]; items: string[]; discovered: string[] } {
  const p = PUZZLE_BY_ID.get(id);
  if (!p || s.puzzles[id]) return { insights: [], items: [], discovered: [] };
  s.puzzles[id] = true;
  log(s, tr("Puzzle solved: {title}", { title: p.title }));
  const items: string[] = [];
  for (const it of p.reward?.items ?? []) {
    addItem(s, it.item, it.count);
    items.push(`${it.count}× ${ITEM_BY_ID.get(it.item)?.name ?? it.item}`);
  }
  for (const f of p.reward?.flags ?? []) s.flags[f] = true;
  const insights = grant(s, p.reward?.insights);
  const settled = settle(s);
  return { insights: [...insights, ...settled.insights], items, discovered: settled.discovered };
}

/**
 * A puzzle that a prop hosts behind a condition (Forge-Terminal needs the
 * Lab Clock, the coolant desk needs TMP-001 …) keeps that condition wherever
 * else it appears — e.g. on a slice pickup next to the prop.
 */
export function puzzleAvailable(s: WorldState, id: string): boolean {
  const hosts = PROPS.filter((p) => p.puzzle === id && p.requires);
  return hosts.length === 0 || hosts.some((p) => evalCond(s, p.requires));
}

/** Why a puzzle cannot be started yet (the hosting prop's hint), if it cannot. */
export function puzzleLockHint(s: WorldState, id: string): string | undefined {
  if (puzzleAvailable(s, id)) return undefined;
  const host = PROPS.find((p) => p.puzzle === id && p.requires);
  return (
    host?.requiresHint ??
    (host?.requires ? tr("Needs: {cond}.", { cond: describeCond(host.requires) }) : undefined)
  );
}

export function floorAccessible(s: WorldState, floor: FloorId): boolean {
  return evalCond(s, FLOOR_ACCESS[floor].requires);
}

export function propUsable(s: WorldState, id: string): boolean {
  const p = PROPS.find((x) => x.id === id);
  return !!p && evalCond(s, p.requires);
}

// ── Device use ───────────────────────────────────────────────────

export interface UseReport {
  lines: string[];
  insights: string[];
  items: string[];
}

/**
 * Using an online device runs its insight hooks (alternate story paths),
 * a research cycle on the Nexus and appends the device's live readout
 * (monitors, clock, power, compass …) so every device has something to say.
 */
export function operateDevice(s: WorldState, id: string): UseReport {
  const out: UseReport = { lines: [], insights: [], items: [] };
  if (!isOnline(s, id)) return out;
  for (const hook of DEVICE_INSIGHTS[id] ?? []) {
    if (!evalCond(s, hook.requires)) continue;
    const fresh = grant(s, hook.grants);
    if (fresh.length) {
      out.lines.push(hook.text);
      out.insights.push(...fresh);
    }
  }
  if (id === "NXS-01") {
    const r = research(s);
    out.lines.push(r.message);
    out.insights.push(...r.insights);
  }
  out.lines.push(...deviceReadout(s, id));
  // Perk `second_look` (course "Reading the needles"): one more line — the grid margin.
  if (out.lines.length && hasPerk(s, "second_look")) {
    const p = power(s);
    out.lines.push(
      tr("Second look: {gen} W generated, {demand} W drawn, margin {margin} W.", {
        gen: Math.round(p.generation),
        demand: Math.round(p.demand),
        margin: Math.round(p.generation - p.demand),
      }),
    );
  }
  // Kept for the knowledge panel ("processed information").
  if (out.lines.length)
    s.readouts[id] = { t: Math.round(s.playTime), lines: out.lines.slice(0, 12) };
  return out;
}

/** Most recent workbench experiments kept in the save. */
export const EXPERIMENT_LOG_MAX = 60;

/** Record a workbench experiment (knowledge panel "Experiments"). */
export function recordExperiment(s: WorldState, e: Omit<Experiment, "t">): void {
  s.experiments.push({ ...e, inputs: { ...e.inputs }, t: Math.round(s.playTime) });
  if (s.experiments.length > EXPERIMENT_LOG_MAX)
    s.experiments.splice(0, s.experiments.length - EXPERIMENT_LOG_MAX);
}

// ── Research (NXS-01) ────────────────────────────────────────────

export interface ResearchTopic {
  id: string;
  title: string;
  /** Research points needed (cumulative). */
  cost: number;
  /** What the finished topic unlocks (journal / panel text). */
  text: string;
}

/** Research points per Nexus cycle ("Forschung +5"). */
export const RESEARCH_PER_CYCLE = 5;
/** Seconds of play between two research cycles. */
export const RESEARCH_COOLDOWN = 90;

export const RESEARCH_TOPICS: readonly ResearchTopic[] = [
  {
    id: "rueckgewinnung",
    title: tr("Slag Recovery"),
    cost: 5,
    text: tr("3× Slag → 1× Base Alloy. No explosion is ever entirely wasted again."),
  },
  {
    id: "synapsis",
    title: tr("Synapsis Reconstruction"),
    cost: 10,
    text: tr(
      "Halo Crystal Shard + Control Module + Quartz Crystal → Synapsis Shard (at the Nexus).",
    ),
  },
  {
    id: "anomalie",
    title: tr("Anomaly Synthesis"),
    cost: 20,
    text: tr("2× Halo Crystal Shard + 2× Energy Cell → Anomalous Core (Anomaly Detector online)."),
  },
];

export const RESEARCH_BY_ID: ReadonlyMap<string, ResearchTopic> = new Map(
  RESEARCH_TOPICS.map((t) => [t.id, t]),
);

export function researchFlag(topic: string): string {
  return `research_${topic}`;
}

/** Seconds per research cycle (shorter while an updated AIC-001 plans the queue). */
export function researchCooldown(s: WorldState): number {
  const aic = hasFeature(s, "AIC-001", "self-optimize") && isOnline(s, "AIC-001");
  const base = aic ? FW_TUNING.researchCooldown : RESEARCH_COOLDOWN;
  // Root lab: sysctl research.cooldown scales the cycle; an overclocked AIC-001 plans faster.
  const speed = aic ? clockFactor(s, "AIC-001") : 1;
  return Math.max(10, Math.round((base * tun(s, "research.cooldown")) / RESEARCH_COOLDOWN / speed));
}

/**
 * Research points per cycle: the base, +2 with the Nexus' `prereq-chain`
 * update, +1 for every online machine on the SCA-001 compute mesh.
 */
export function researchPerCycle(s: WorldState): number {
  const mesh = isOnline(s, "SCA-001")
    ? linksOf(s, "SCA-001").filter((id) => isOnline(s, id)).length * FW_TUNING.meshResearch
    : 0;
  const chain = hasFeature(s, "NXS-01", "prereq-chain") ? FW_TUNING.researchBonus : 0;
  // Perk `research_notes` (course "Research on the Nexus").
  const notes = hasPerk(s, "research_notes") ? PERK_TUNING.research : 0;
  // Root lab: sysctl research.yield adds deeper analysis passes.
  return RESEARCH_PER_CYCLE + chain + mesh + notes + tun(s, "research.yield");
}

export function researchReady(s: WorldState): boolean {
  const last = s.counters.research_last;
  return last === undefined || s.playTime - last >= researchCooldown(s);
}

/** Run one research cycle on the Nexus: +5 points, finished topics unlock recipes. */
export function research(s: WorldState): {
  ok: boolean;
  message: string;
  unlocked: string[];
  insights: string[];
} {
  if (!isOnline(s, "NXS-01"))
    return { ok: false, message: tr("The Nexus is not online."), unlocked: [], insights: [] };
  if (!researchReady(s)) {
    const left = Math.ceil(researchCooldown(s) - (s.playTime - (s.counters.research_last ?? 0)));
    return {
      ok: false,
      message: tr("Research cycle still running ({left} s).", { left }),
      unlocked: [],
      insights: [],
    };
  }
  s.counters.research_last = s.playTime;
  const gain = researchPerCycle(s);
  const points = bump(s, "research", gain);
  const unlocked: string[] = [];
  for (const t of RESEARCH_TOPICS) {
    if (s.flags[researchFlag(t.id)] || points < t.cost) continue;
    s.flags[researchFlag(t.id)] = true;
    unlocked.push(t.id);
    log(s, tr("Research completed: {title}", { title: t.title }));
  }
  const insights = grant(s, ["nexus_forschung"]);
  const next = RESEARCH_TOPICS.find((t) => !s.flags[researchFlag(t.id)]);
  const done = unlocked.map((id) => {
    const t = RESEARCH_BY_ID.get(id)!;
    return tr("Completed: {title} — {text}", { title: t.title, text: t.text });
  });
  const tail = next
    ? tr("Next topic: {title} ({points}/{cost} points).", {
        title: next.title,
        points,
        cost: next.cost,
      })
    : tr("All research topics completed.");
  return {
    ok: true,
    message: [
      tr("Research cycle: +{gain} ({points} points).", { gain, points }),
      ...done,
      tail,
    ].join(" "),
    unlocked,
    insights,
  };
}

// ── Device readouts ──────────────────────────────────────────────

function mmss(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${t % 60} s`;
}

function where(floor: FloorId, x: number, z: number): string {
  const r = roomAt(floor, x, z);
  return r ? r.name : tr("room::unknown");
}

/** Devices with a live readout (shown after »Benutzen«). */
const READOUT_DEVICES = new Set([
  "CDC-001",
  "MSC-001",
  "UEC-001",
  "MFR-001",
  "PWR-001",
  "BAT-001",
  "ATK-001",
  "PWD-001",
  "VLT-001",
  "CLK-001",
  "MEM-001",
  "CPU-001",
  "TMP-001",
  "THM-001",
  "NET-001",
  "QCP-001",
  "EXD-001",
  "NXS-01",
  "DGN-001",
  "QAN-001",
  "TLP-001",
]);

/** CDC-001: slices catalogued; per level with the `slice-cache` update. */
function cacheReadout(s: WorldState): string[] {
  const lines = [
    tr("Crystal index: {n} of {total} slices of Crystal #0089 catalogued.", {
      n: s.counters.slices ?? 0,
      total: SLICE_TOTAL,
    }),
  ];
  if (!hasFeature(s, "CDC-001", "slice-cache")) return lines;
  const per = new Map<FloorId, number>();
  for (const pid of SLICE_PICKUPS) {
    const pk = PICKUPS.find((x) => x.id === pid);
    if (!pk || s.taken[pid] !== undefined) continue;
    per.set(pk.floor, (per.get(pk.floor) ?? 0) + 1);
  }
  lines.push(
    per.size
      ? tr("Slice cache — still missing: {list}.", {
          list: [...per]
            .sort((a, b) => a[0] - b[0])
            .map(([f, n]) => `${FLOOR_BY_ID[f].short} ×${n}`)
            .join(" · "),
        })
      : tr("Slice cache: every slice is accounted for."),
  );
  return lines;
}

/** MSC-001: refilling sources in reach; which are full with the `batch-scan` update. */
function scanReadout(s: WorldState): string[] {
  const sources = PICKUPS.filter(
    (p) =>
      !!p.respawn &&
      floorAccessible(s, p.floor) &&
      pickupVisible(s, p) &&
      reachableRooms(s, p.floor).has(roomAt(p.floor, p.x, p.z)?.id ?? ""),
  );
  const lines = [tr("Material scan: {n} refilling source(s) within reach.", { n: sources.length })];
  if (!hasFeature(s, "MSC-001", "batch-scan")) return lines;
  const full = sources.filter((p) => pickupAvailable(s, p));
  lines.push(
    full.length
      ? tr("Batch scan — ready to harvest: {list}.", {
          list: full
            .slice(0, 4)
            .map((p) => `${p.label} (${where(p.floor, p.x, p.z)})`)
            .join(", "),
        })
      : tr("Batch scan: every source is still refilling."),
  );
  return lines;
}

/** NET-001 data hub: first readout line of up to four linked devices. */
function remoteReadouts(s: WorldState): string[] {
  const out: string[] = [];
  for (const id of linksOf(s, "NET-001")) {
    if (out.length >= 4) break;
    if (!isOnline(s, id)) continue;
    const device = DEVICE_BY_ID.get(id)?.name ?? id;
    const first = READOUT_DEVICES.has(id) ? deviceReadout(s, id)[0] : undefined;
    out.push(
      first
        ? tr("Remote {device}: {line}", { device, line: first })
        : tr("Remote {device}: online.", { device }),
    );
  }
  return out;
}

/** DGN-001 diag hub: health of every probed device (+ pending updates with `deep-scan`). */
function probeReadouts(s: WorldState, deep: boolean): string[] {
  const p = power(s);
  const out: string[] = [];
  for (const id of linksOf(s, "DGN-001")) {
    const device = DEVICE_BY_ID.get(id)?.name ?? id;
    const starved = p.starved.find((x) => x.id === id);
    out.push(
      p.online.has(id)
        ? tr("Probe {device}: healthy.", { device })
        : starved?.reason === "hitze"
          ? tr("Probe {device}: overheating — the Thermal Manager must run.", { device })
          : starved
            ? tr("Probe {device}: no power — shed load or add generation.", { device })
            : tr("Probe {device}: switched off.", { device }),
    );
    const m = FIRMWARE.get(id);
    if (deep && m?.update && m.world && !isUpdated(s, id))
      out.push(
        `  ${
          m.world.source === "net"
            ? tr("Update {version} waiting on the network mirror (NET-001).", {
                version: m.update.version,
              })
            : m.world.source === "mcp"
              ? tr("Update {version} waiting in the MCP's device registry.", {
                  version: m.update.version,
                })
              : tr("Service image {version} on board — its checksum is somewhere in the lab.", {
                  version: m.update.version,
                })
        }`,
      );
  }
  return out;
}

/** True when the device panel should offer »Benutzen«. */
export function deviceHasUse(id: string): boolean {
  return (DEVICE_INSIGHTS[id] ?? []).length > 0 || READOUT_DEVICES.has(id);
}

/** Live status lines of an online device (pure; empty for devices without a readout). */
export function deviceReadout(s: WorldState, id: string): string[] {
  if (!isOnline(s, id)) return [];
  const p = power(s);
  const reserve = Math.round((p.generation - p.demand) * 10) / 10;
  switch (id) {
    case "UEC-001": {
      const w = p.sources.find((x) => x.label === DEVICE_BY_ID.get(id)?.name)?.watts ?? 0;
      return [
        tr("Core output: {w} W (nominal {nominal} W, swings with the daily volatility).", {
          w,
          nominal: UEC_NOMINAL,
        }),
      ];
    }
    case "MFR-001":
      return [
        tr("Micro-fusion: {w} W. Auto-SCRAM armed. Cooling via THM-001.", {
          w: fusionOutput(s),
        }),
      ];
    case "PWR-001":
      return [
        s.flags.geo_routed
          ? tr("Geothermal at full load: +100 W.")
          : tr("Geothermal tap not connected — solve the distribution panel on Level −1 first."),
      ];
    case "BAT-001":
      return [tr("Buffer storage: +{w} W reserve on the grid.", { w: batteryBuffer(s) })];
    case "CDC-001":
      return cacheReadout(s);
    case "MSC-001":
      return scanReadout(s);
    case "ATK-001": {
      const seep = PICKUPS.find((x) => x.id === "p_geo_seep");
      const left = seep ? pickupRespawnLeft(s, seep) : 0;
      return [
        left > 0
          ? tr("Seep valve refills twice as fast: next charge in {time}.", { time: mmss(left) })
          : tr("Seep valve full — double yield (Geothermal, Level −1)."),
      ];
    }
    case "PWD-001":
      return [
        tr("Bus: generation {gen} W · load {load} W · reserve {reserve} W.", {
          gen: p.generation,
          load: p.demand,
          reserve,
        }),
        tr("Reactive power compensated: +{w} W.", { w: PWD_BONUS }),
        p.starved.length
          ? tr("Starving: {list}.", {
              list: p.starved.map((x) => DEVICE_BY_ID.get(x.id)?.name ?? x.id).join(", "),
            })
          : tr("No consumer is starving."),
      ];
    case "VLT-001": {
      const raw = uecOutput();
      return [
        tr("UEC raw voltage today: {raw} W ({delta} %).", {
          raw,
          delta: `${raw >= UEC_NOMINAL ? "+" : ""}${Math.round((raw / UEC_NOMINAL - 1) * 100)}`,
        }),
        raw < UEC_NOMINAL
          ? tr("Stabilised at {nominal} W (+{diff} W).", {
              nominal: UEC_NOMINAL,
              diff: UEC_NOMINAL - raw,
            })
          : tr("Core stable above rated output."),
      ];
    }
    case "CLK-001": {
      const lines = [
        tr("Lab time: day 2,561 + {time}. All timestamps in sync.", { time: mmss(s.playTime) }),
      ];
      if (!s.puzzles.pz_temporal)
        lines.push(tr("The Forge terminal (Level −3) can now put the logs in order."));
      if (isBuilt(s, "EXD-001"))
        lines.push(
          droneReady(s)
            ? tr("Drone: ready for launch.")
            : tr("Drone: charging, {time} to go.", {
                time: mmss(droneCooldown(s) - (s.playTime - (s.counters.drone_last ?? 0))),
              }),
        );
      if (isBuilt(s, "NXS-01"))
        lines.push(
          researchReady(s)
            ? tr("Nexus: next research cycle ready.")
            : tr("Nexus: next cycle in {time}.", {
                time: mmss(researchCooldown(s) - (s.playTime - (s.counters.research_last ?? 0))),
              }),
        );
      return lines;
    }
    case "MEM-001": {
      const n = INSIGHTS.filter((i) => s.insights[i.id]).length;
      const lines = [tr("Memory: {n} of {total} insights indexed.", { n, total: INSIGHTS.length })];
      if (stagesDone(s, "MCP-000") < 3)
        lines.push(tr("MCP memory bank ready for inspection — the MCP needs 2 Memory Chips."));
      if (hasFeature(s, "MEM-001", "leak-trace")) {
        const unread = NOTES.find(
          (n) =>
            !s.read[n.id] &&
            floorAccessible(s, n.floor) &&
            evalCond(s, n.hidden) &&
            reachableRooms(s, n.floor).has(roomAt(n.floor, n.x, n.z)?.id ?? ""),
        );
        lines.push(
          unread
            ? tr("Leak trace: an unindexed record in {room} ({floor}).", {
                room: where(unread.floor, unread.x, unread.z),
                floor: FLOOR_BY_ID[unread.floor].short,
              })
            : tr("Leak trace: every reachable record is indexed."),
        );
      }
      return lines;
    }
    case "CPU-001":
      return [
        tr("Processes: {active} devices active, {blocked} blocked.", {
          active: p.online.size,
          blocked: p.starved.length,
        }),
        ...p.starved.slice(0, 3).map((x) => {
          const name = DEVICE_BY_ID.get(x.id)?.name ?? x.id;
          return `  ${
            x.reason === "hitze"
              ? tr("{name}: thermally throttled", { name })
              : tr("{name}: waiting for power", { name })
          }`;
        }),
      ];
    case "TMP-001": {
      const hot = p.starved.filter((x) => x.reason === "hitze");
      const lines = [
        hot.length
          ? tr("Overheated: {list}. Thermal Manager (THM-001) missing.", {
              list: hot.map((x) => DEVICE_BY_ID.get(x.id)?.name ?? x.id).join(", "),
            })
          : tr("All zones in the green. Deep Lab: very cold."),
      ];
      if (!s.puzzles.pz_coolant)
        lines.push(tr("The coolant mixing desk (Cooling, Level −1) can now be operated."));
      return lines;
    }
    case "THM-001": {
      const cooled = DEVICES.filter((d) => d.tier === 3 && d.power > 0 && p.online.has(d.id));
      return [tr("Cooling loop active: {n} tier-3 device(s) cooled.", { n: cooled.length })];
    }
    case "NET-001": {
      const awake = BOT_QUESTS.filter((q) => s.flags[q.flag]).length;
      return [
        tr("BNET-001: {awake} of {total} lore bots awake.", { awake, total: BOT_QUESTS.length }),
        tr("Network-controlled doors (Teleport, Radio Room) are released."),
        ...remoteReadouts(s),
      ];
    }
    case "QCP-001": {
      const next = SLICE_PICKUPS.map((pid) => PICKUPS.find((x) => x.id === pid)).find(
        (pk) => !!pk && s.taken[pk.id] === undefined && floorAccessible(s, pk.floor),
      );
      const lines = [
        next
          ? tr(
              "The needle trembles towards {room} ({floor}): a slice of Crystal #0089 lies there.",
              {
                room: where(next.floor, next.x, next.z),
                floor: FLOOR_BY_ID[next.floor].short,
              },
            )
          : tr("The needle rests. No slice left for it to sense."),
      ];
      if (s.insights.damien_koordinaten) lines.push(tr("Damien's coordinates: saved."));
      return lines;
    }
    case "EXD-001":
      return [
        droneReady(s)
          ? tr("Drone ready for launch. {n} flights into the shaft so far.", {
              n: s.counters.drone_runs ?? 0,
            })
          : tr("Drone charging: {time}.", {
              time: mmss(droneCooldown(s) - (s.playTime - (s.counters.drone_last ?? 0))),
            }),
      ];
    case "DGN-001": {
      const open = openBlueprints(s);
      const lines = [tr("Findings: {n} open blueprint(s).", { n: open.length })];
      const deep = hasFeature(s, "DGN-001", "deep-scan");
      for (const d of deep ? open : open.slice(0, 3)) {
        const c = checkStage(s, d.id);
        lines.push(`  ${d.name}: ${c?.blockers[0] ?? tr("ready to build.")}`);
      }
      lines.push(...probeReadouts(s, deep));
      return lines;
    }
    case "TLP-001": {
      if (s.endings.rueckkehr)
        return [
          tr("The pad is cooling down. Halo correlation 0.000. Something in the Halo is waiting."),
        ];
      const need: [string, boolean][] = [
        [tr("Coordinates"), !!s.insights.damien_koordinaten],
        [tr("Handshake"), !!s.insights.handshake],
        [tr("Coherence σ-17"), !!s.insights.sigma17],
      ];
      return [
        tr("Portal matrix: {list}.", {
          list: need.map(([k, ok]) => `${k} ${ok ? "✓" : "—"}`).join(" · "),
        }),
      ];
    }
    case "QAN-001":
      return [
        s.insights.damien_muster
          ? tr("Resonance pattern D.F.: 94.8 % reconstructed.")
          : tr(
              "Waiting for a sample: one Synapsis Shard in the inventory is enough for Damien's pattern.",
            ),
        s.insights.x9_lesung
          ? tr("X9-DUST: read. “The slices belong together.”")
          : tr("An X9-DUST memory core could be read here as well."),
      ];
    case "NXS-01": {
      const pts = s.counters.research ?? 0;
      return RESEARCH_TOPICS.map(
        (t) =>
          `${s.flags[researchFlag(t.id)] ? "✓" : `${Math.min(pts, t.cost)}/${t.cost}`} ${t.title}`,
      );
    }
    default:
      return [];
  }
}

const DRONE_RUNS: readonly { item: string; count: number }[][] = [
  [
    { item: "halo_staub", count: 1 },
    { item: "supraleiter", count: 1 },
  ],
  [
    { item: "qubit_chip", count: 1 },
    { item: "plasmaring", count: 1 },
  ],
  [
    { item: "synapsis_splitter", count: 1 },
    { item: "glasfaser", count: 2 },
  ],
  [
    { item: "exotische_materie", count: 1 },
    { item: "laserdiode", count: 1 },
  ],
  [
    { item: "supraleiter", count: 1 },
    { item: "rotor", count: 2 },
  ],
];
export const DRONE_COOLDOWN = 150;

/** Seconds between drone flights (shorter with EXD-001's `fast-return` update). */
export function droneCooldown(s: WorldState): number {
  const rated = hasFeature(s, "EXD-001", "fast-return") ? FW_TUNING.droneCooldown : DRONE_COOLDOWN;
  // Root lab: sysctl drone.cooldown scales the turnaround; a faster EXD-001 clock shortens it.
  const base = Math.max(
    15,
    Math.round((rated * tun(s, "drone.cooldown")) / DRONE_COOLDOWN / clockFactor(s, "EXD-001")),
  );
  // Perk `drone_routes` (course "Drone flight"): pre-planned routes.
  return hasPerk(s, "drone_routes") ? Math.round(base * PERK_TUNING.droneCooldown) : base;
}

export function droneReady(s: WorldState): boolean {
  const last = s.counters.drone_last;
  return last === undefined || s.playTime - last >= droneCooldown(s);
}

export function flyDrone(s: WorldState): { ok: boolean; message: string; insights: string[] } {
  if (!isOnline(s, "EXD-001"))
    return { ok: false, message: tr("The drone is not online."), insights: [] };
  if (!droneReady(s))
    return { ok: false, message: tr("The drone is still charging."), insights: [] };
  const runs = s.counters.drone_runs ?? 0;
  const loot = DRONE_RUNS[runs % DRONE_RUNS.length]!;
  for (const it of loot) addItem(s, it.item, it.count);
  s.counters.drone_last = s.playTime;
  s.counters.drone_runs = runs + 1;
  // The first flight maps the sealed shaft: X9-DUST and the elevator release.
  const extra = runs === 0 ? grant(s, ["x9_dust", "schacht_frei"]) : [];
  const names = loot
    .map((it) => `${it.count}× ${ITEM_BY_ID.get(it.item)?.name ?? it.item}`)
    .join(", ");
  log(s, tr("Drone flight #{n}: {items}", { n: runs + 1, items: names }));
  return {
    ok: true,
    message:
      runs === 0
        ? tr(
            "The drone returns from the shaft: {items}. The shaft is mapped — the emergency elevator now goes down to Level −4.",
            { items: names },
          )
        : tr("The drone returns from the shaft: {items}.", { items: names }),
    insights: extra,
  };
}

// ── Endings ──────────────────────────────────────────────────────

export function endingsAt(
  s: WorldState,
  deviceOrProp: string,
): { ending: EndingDef; ready: boolean }[] {
  return ENDINGS.filter((e) => e.device === deviceOrProp).map((ending) => ({
    ending,
    ready: evalCond(s, ending.requires),
  }));
}

/**
 * Secret endings stay hidden (journal, device panel) until reached or until
 * their first clue holds: the crystal is known or ten slices are found.
 */
export function endingRevealed(s: WorldState, e: EndingDef): boolean {
  if (!e.secret || s.endings[e.id]) return true;
  return !!s.insights.kristall_0089 || (s.counters.slices ?? 0) >= 10;
}

export function reachEnding(s: WorldState, id: string): boolean {
  const e = ENDINGS.find((x) => x.id === id);
  if (!e || !evalCond(s, e.requires)) return false;
  s.endings[id] = true;
  s.flags[`ending_${id}`] = true;
  log(s, tr("ENDING REACHED: {title}", { title: e.title }));
  return true;
}

// ── Hints (MCP / DGN-001) ────────────────────────────────────────

/** Floor a device stands on. */
export function deviceFloor(id: string): FloorId | undefined {
  const d = DEVICE_BY_ID.get(id);
  return d ? ROOM_BY_ID.get(d.room)?.floor : undefined;
}

/**
 * Blueprints the player can work on right now: discovered, not built, all
 * `needs` built and the device's floor reachable by elevator.
 */
export function openBlueprints(s: WorldState): DeviceDef[] {
  return DEVICES.filter((d) => {
    if (!s.discovered[d.id] || isBuilt(s, d.id)) return false;
    if (!d.needs.every((n) => isBuilt(s, n))) return false;
    const f = deviceFloor(d.id);
    return f !== undefined && floorAccessible(s, f);
  });
}

/**
 * The MCP's / DGN-001's next hint. Every branch only names things that are
 * available now (never a locked floor, an invisible NPC or a finished task).
 */
export function hint(s: WorldState): string {
  const p = power(s);
  if (!s.puzzles.pz_geo_valve)
    return tr(
      "Geothermal, Level −1. The Emergency Ladder is at the Elevator Shaft in the east. Open the seep valve first, then turn the distributor. Load before understanding.",
    );
  if (!s.puzzles.pz_power_flow)
    return tr(
      "The seep valve is open. Now turn the distribution panel in the geothermal shaft to fifty units. Not forty-nine.",
    );
  if (!isBuilt(s, "UEC-001")) {
    const c = checkStage(s, "UEC-001");
    return tr(
      "The Unstable Energy Core in the geothermal shaft. Next stage: {stage}. {blocker} Energy ≥ 8: combine two Energy Cells at the workbench (or Inductor + Battery Cell).",
      { stage: c?.device.stages[c.stageIndex]?.name ?? "?", blocker: c?.blockers[0] ?? "" },
    ).replace(/\s+/g, " ");
  }
  if (!isBuilt(s, "BTK-001"))
    return tr(
      "The Basic Toolkit in the Workshop. With it you get everything out of scrap — and pry doors open.",
    );
  if (!isBuilt(s, "PWB-001"))
    return tr(
      "Build the Portable Workbench in the Workshop. Three slots are for beginners. Six are for people with ambition.",
    );
  if (!isBuilt(s, "CDC-001"))
    return tr("The Crystal Data Cache in the Archive. Without it, Crystal #0089 stays silent.");
  if (!isBuilt(s, "VNT-001"))
    return tr(
      "The ventilation in the outer airlock. In the material store on Level −1 you cannot see a thing for the smoke.",
    );
  if (p.starved.length) {
    const first = p.starved[0]!;
    const name = DEVICE_BY_ID.get(first.id)?.name ?? first.id;
    return first.reason === "hitze"
      ? tr(
          "{name} is overheating. Tier-3 devices need the Thermal Manager (Cooling, Level −1) — online.",
          { name },
        )
      : tr(
          "Brownout: {n} device(s) without power, {name} first. Switch something off or build generation (PWR-001, BAT-001, MFR-001).",
          { n: p.starved.length, name },
        );
  }
  if (!s.insights.halo_schluessel && s.insights.halo_h)
    return tr(
      "Jade's margin notes. Four of them, spread across three levels. Read the initial letters.",
    );
  if (!isBuilt(s, "MEM-001"))
    return tr("The data centre (Level −1). Memory Monitor, then CPU. Then I can remember again.");
  if (stagesDone(s, "MCP-000") < 3 && isOnline(s, "MEM-001"))
    return tr(
      "The Memory Monitor is running. Put two Memory Chips into my memory bank — then I will remember 03:27.",
    );
  if (!isBuilt(s, "ECR-001") && isBuilt(s, "NET-001") && s.discovered["ECR-001"])
    return tr(
      "The Echo Recorder in the signal lab (Level −2). It hears what is left in the noise. Perhaps Dr. Fridge.",
    );
  const open = openBlueprints(s);
  if (open.length) {
    const d = open[0]!;
    const c = checkStage(s, d.id);
    const room = ROOM_BY_ID.get(d.room);
    const at = room ? ` (${room.name}, ${FLOOR_BY_ID[room.floor].short})` : "";
    return tr("Open blueprint: {name}{at} — stage “{stage}”. {next}", {
      name: d.name,
      at,
      stage: c?.device.stages[c.stageIndex]?.name ?? "?",
      next: c?.blockers[0] ?? tr("All set."),
    });
  }
  const sleeping = BOT_QUESTS.find((q) => {
    const npc = NPCS.find((n) => n.id === q.npc);
    return !s.flags[q.flag] && !!npc && floorAccessible(s, npc.floor);
  });
  if (sleeping) return tr("BNET-001 reports a sleeping agent. {hint}", { hint: sleeping.hint });
  const endings = ENDINGS.filter((e) => !s.endings[e.id] && !e.secret);
  if (endings.length) {
    const where = isOnline(s, "ECR-001")
      ? tr("Speak to his echo in the secondary station (Level 0).")
      : tr("The journal shows what each path still lacks.");
    return endings.length === 1
      ? tr("There is one path to Dr. Fridge you have not taken yet. {where}", { where })
      : tr("There are {n} paths to Dr. Fridge you have not taken yet. {where}", {
          n: endings.length,
          where,
        });
  }
  const slices = s.counters.slices ?? 0;
  if (slices < SLICE_TOTAL)
    return s.insights.k2ldr_katalog
      ? tr(
          "Crystal #0089: {n} of {total} slices. K2-LDR's catalogue in the journal shows where the rest are.",
          { n: slices, total: SLICE_TOTAL },
        )
      : tr(
          "Crystal #0089: {n} of {total} slices. Dr. Lawrence spread them out, she did not hide them. K2-LDR in the Archive keeps a catalogue.",
          { n: slices, total: SLICE_TOTAL },
        );
  const secret = ENDINGS.find((e) => e.secret && !s.endings[e.id]);
  if (secret) {
    if (!s.insights.kristall_ganz)
      return tr("All thirty slices. Use the Crystal Data Cache in the Archive — put them in.");
    const missing = ("all" in secret.requires ? secret.requires.all : [secret.requires]).filter(
      (c) => !evalCond(s, c),
    );
    if (missing.length)
      return tr("The crystal is whole. You are still missing: {list}.", {
        list: missing.map(describeCond).join(", "),
      });
    return tr(
      "The crystal is whole. Go to the Crystal Data Cache. And then you ask it — not the other way round.",
    );
  }
  return (
    prototypeHint(s) ?? tr("You have built everything. The lab is still not finished. It never is.")
  );
}

// ── Stats ────────────────────────────────────────────────────────

export function progress(s: WorldState): {
  devices: number;
  totalDevices: number;
  insights: number;
  totalInsights: number;
  endings: number;
} {
  return {
    devices: DEVICES.filter((d) => isBuilt(s, d.id)).length,
    totalDevices: DEVICES.length,
    insights: INSIGHTS.filter((i) => s.insights[i.id]).length,
    totalInsights: INSIGHTS.length,
    endings: Object.keys(s.endings).length,
  };
}

// ── Reachability ─────────────────────────────────────────────────

/** Rooms reachable on a floor from its elevator shaft through open doors. */
export function reachableRooms(s: WorldState, floor: FloorId): Set<string> {
  const rooms = ROOMS.filter((r) => r.floor === floor);
  const start = rooms.find((r) => r.id.startsWith("aufzug"));
  const seen = new Set<string>();
  if (!start || !floorAccessible(s, floor)) return seen;
  const queue = [start.id];
  seen.add(start.id);
  const doors = doorsForFloor(floor).filter((d) => doorIsOpen(s, d));
  while (queue.length) {
    const id = queue.shift()!;
    const r = ROOM_BY_ID.get(id)!;
    for (const d of doors) {
      if (!doorTouches(d, r)) continue;
      for (const other of rooms) {
        if (!seen.has(other.id) && doorTouches(d, other)) {
          seen.add(other.id);
          queue.push(other.id);
        }
      }
    }
  }
  return seen;
}

/** Keypad doors are reachable for interaction from either side. */
export function keypadDoorsReachable(s: WorldState, floor: FloorId): DoorDef[] {
  const reach = reachableRooms(s, floor);
  return doorsForFloor(floor).filter(
    (d) =>
      d.keypad &&
      !s.puzzles[d.keypad] &&
      ROOMS.some((r) => r.floor === floor && reach.has(r.id) && doorTouches(d, r)),
  );
}

// ── Dialogue ─────────────────────────────────────────────────────

/**
 * Flag marking a dialogue option as said. Keyed by the ENGLISH source label so
 * it survives a language switch (old German keys are migrated, save v2 → v3).
 */
export function saidKey(npcId: string, o: DialogueOption): string {
  return `said_${npcId}_${sourceOf(o.label)}`;
}

/** Greeting lines whose condition currently holds. */
export function dialogueGreeting(s: WorldState, npcId: string): DialogueLine[] {
  const npc = NPCS.find((n) => n.id === npcId);
  if (!npc) return [];
  return npc.greeting.filter((g) => evalCond(s, g.when)).map(({ who, text }) => ({ who, text }));
}

/** Has this option already been chosen (in any session, any language)? */
export function wasSaid(s: WorldState, npcId: string, o: DialogueOption): boolean {
  return !!s.flags[saidKey(npcId, o)];
}

/** The answer an option gives right now (`__HINT__` resolved to the current hint). */
export function dialogueAnswer(s: WorldState, o: DialogueOption): DialogueLine[] {
  return o.lines.map((l) => (l.text === "__HINT__" ? { ...l, text: hint(s) } : l));
}

/**
 * Locale-stable signature of an exchange (option + the answer it gave). The
 * dialogue panel collects the signatures shown this session so a repeatable
 * option only comes back once its answer would actually differ.
 */
export function exchangeSignature(
  npcId: string,
  o: DialogueOption,
  answer: readonly DialogueLine[],
): string {
  return [saidKey(npcId, o), ...answer.map((l) => sourceOf(l.text))].join("\n");
}

/** Signature of the answer `o` would give right now. */
export function answerSignature(s: WorldState, npcId: string, o: DialogueOption): string {
  return exchangeSignature(npcId, o, dialogueAnswer(s, o));
}

/**
 * Options on offer right now (same filter as the dialogue panel). Every
 * option is asked once; only options marked `repeatable` come back, and with
 * `shown` (signatures from {@link answerSignature}) only when their answer
 * changed since.
 */
export function dialogueOptions(
  s: WorldState,
  npcId: string,
  shown?: ReadonlySet<string>,
): DialogueOption[] {
  const npc = NPCS.find((n) => n.id === npcId);
  if (!npc) return [];
  return npc.options.filter((o) => {
    if (!evalCond(s, o.when)) return false;
    if (!o.repeatable) return !wasSaid(s, npc.id, o);
    return !shown?.has(answerSignature(s, npc.id, o));
  });
}

/**
 * Options already asked and no longer on offer — the panel's read-only
 * "Already asked" list. Hand-overs (`takes`) are not questions and stay out.
 */
export function askedDialogueOptions(
  s: WorldState,
  npcId: string,
  shown?: ReadonlySet<string>,
): DialogueOption[] {
  const npc = NPCS.find((n) => n.id === npcId);
  if (!npc) return [];
  const offered = new Set(dialogueOptions(s, npcId, shown));
  return npc.options.filter(
    (o) => !offered.has(o) && !(o.takes ?? []).length && wasSaid(s, npc.id, o),
  );
}

export interface DialogueReport {
  ok: boolean;
  message: string;
  lines: DialogueLine[];
  insights: string[];
  discovered: string[];
}

/**
 * Choose a dialogue option: hands over `takes` items, sets `flags`, grants
 * insights and resolves the `__HINT__` placeholder. Pure — the dialogue
 * panel and the simulated player both use it.
 */
export function chooseDialogue(s: WorldState, npcId: string, label: string): DialogueReport {
  const fail = (message: string): DialogueReport => ({
    ok: false,
    message,
    lines: [],
    insights: [],
    discovered: [],
  });
  const o = dialogueOptions(s, npcId).find((x) => x.label === label);
  if (!o) return fail(tr("That question does not fit right now."));
  for (const t of o.takes ?? []) {
    if (count(s, t.item) < t.count) {
      return fail(
        tr("Missing for that: {count}× {item}.", {
          count: t.count,
          item: ITEM_BY_ID.get(t.item)?.name ?? t.item,
        }),
      );
    }
  }
  for (const t of o.takes ?? []) removeItem(s, t.item, t.count);
  // Effects apply once: a repeatable option only answers again.
  const first = !wasSaid(s, npcId, o);
  s.flags[saidKey(npcId, o)] = true;
  if (first) for (const f of o.flags ?? []) s.flags[f] = true;
  bump(s, "dialogues");
  const lines = dialogueAnswer(s, o);
  const insights = first ? grant(s, o.grants) : [];
  const settled = settle(s);
  return {
    ok: true,
    message: "",
    lines,
    insights: [...insights, ...settled.insights],
    discovered: settled.discovered,
  };
}

// ── Prototype use ("Benutzen mit Prototyp …") ────────────────────

/** Most the prototype buffers may add to the grid, in watts. */
export const PROTO_PUFFER_MAX = 45;

/** Flag that makes a hidden note/pickup visible (set by the Lichtbild effect). */
export function revealedFlag(id: string): string {
  return `revealed_${id}`;
}

/** Flag set the first time an effect family is used (codex / hints). */
export function protoEffectFlag(family: ProtoEffectId): string {
  return `proto_effect_${family}`;
}

/** Hidden-by-device conditions an optical prototype can see through. */
const LIGHT_REVEALS: ReadonlySet<string> = new Set([
  "VNT-001",
  "AND-001",
  "MSC-001",
  "INT-001",
  "RMG-001",
  "QSM-001",
]);

/** Onboarding puzzles stay hands-on. */
const NO_BYPASS: ReadonlySet<string> = new Set(["pz_power_flow", "pz_geo_valve"]);

/** Non-secret doors that still give way to resonance. */
const RESONANT_DOORS: ReadonlySet<string> = new Set(["d_hoehle"]);

/** Where a Kohärenz prototype does something, and what it reveals. */
const COHERENCE_TARGETS: Readonly<Record<string, { insight: string; text: string }>> = {
  "TLP-001": {
    insight: "sigma17",
    text: tr(
      "The portal reaches for the prototype and holds on to it. Coherence σ-15 … σ-16 … σ-17. The MCP notes the number without asking where it comes from.",
    ),
  },
  "DIM-001": {
    insight: "membran_duenn",
    text: tr(
      "The rift widens by a hair's breadth. There is nothing behind it — only a membrane, thinner than it has any right to be.",
    ),
  },
  infinity_forge: {
    insight: "halo_zustand",
    text: tr(
      "The Forge reads the prototype like a key. A state diagram appears on the glass: THE HALO EXPANDS — inward.",
    ),
  },
};

export type ProtoTargetKind = "item" | "door" | "npc" | "device" | "prop" | "pickup" | "puzzle";

export interface PrototypeUseReport {
  ok: boolean;
  /** Toast headline. */
  message: string;
  family?: ProtoEffectId;
  /** Further lines (effect details, MCP remarks). */
  lines: string[];
  /** Reanimation: the bot's lines. */
  dialogue: DialogueLine[];
  insights: string[];
  discovered: string[];
  items: { item: string; count: number }[];
  /** Note/pickup ids made visible. */
  revealed: string[];
  /** Door opened by the effect. */
  opened?: string;
  /** Puzzle solved by the effect. */
  puzzle?: string;
  /** The prototype was used up. */
  consumed: boolean;
  /** First time this effect family fired (show "Neue Wirkung entdeckt"). */
  firstOfFamily: boolean;
}

interface UseOutcome {
  message: string;
  lines?: string[];
  dialogue?: DialogueLine[];
  insights?: string[];
  discovered?: string[];
  items?: { item: string; count: number }[];
  revealed?: string[];
  opened?: string;
  puzzle?: string;
}

interface UsePlan {
  family: ProtoEffectId;
  /** Higher wins when several effects apply. */
  score: number;
  /** One-line preview for the "Benutzen mit Prototyp …" menu. */
  preview: string;
  apply: () => UseOutcome;
}

interface ResolvedTarget {
  kind: ProtoTargetKind;
  id: string;
  name: string;
  floor?: FloorId;
  x?: number;
  z?: number;
  room?: RoomDef;
}

function resolveTarget(s: WorldState, target: string): ResolvedTarget | undefined {
  const gen = s.generated[target];
  if (gen && count(s, target) > 0) return { kind: "item", id: target, name: gen.name };
  const door = DOORS.find((d) => d.id === target);
  if (door)
    return {
      kind: "door",
      id: target,
      name: door.secret ? tr("Hollow wall") : tr("Door"),
      floor: door.floor,
      x: door.x,
      z: door.z,
      room: roomAt(door.floor, door.x, door.z),
    };
  const npc = NPCS.find((n) => n.id === target);
  if (npc)
    return {
      kind: "npc",
      id: target,
      name: npc.name,
      floor: npc.floor,
      x: npc.x,
      z: npc.z,
      room: roomAt(npc.floor, npc.x, npc.z),
    };
  const dev = DEVICE_BY_ID.get(target);
  if (dev) {
    const room = ROOM_BY_ID.get(dev.room);
    return {
      kind: "device",
      id: target,
      name: dev.name,
      floor: room?.floor,
      x: dev.x,
      z: dev.z,
      room,
    };
  }
  const prop = PROPS.find((p) => p.id === target);
  if (prop)
    return {
      kind: "prop",
      id: target,
      name: prop.label,
      floor: prop.floor,
      x: prop.x,
      z: prop.z,
      room: roomAt(prop.floor, prop.x, prop.z),
    };
  const pk = PICKUPS.find((p) => p.id === target);
  if (pk)
    return {
      kind: "pickup",
      id: target,
      name: pk.label,
      floor: pk.floor,
      x: pk.x,
      z: pk.z,
      room: roomAt(pk.floor, pk.x, pk.z),
    };
  const pz = PUZZLE_BY_ID.get(target);
  if (pz) return { kind: "puzzle", id: target, name: pz.title };
  return undefined;
}

/** Deterministic per (prototype, target) roll. */
function rollFor(protoId: string, target: string): number {
  return fnv1a(`unlabs:use:${protoId}:${target}`);
}

function puzzleOf(t: ResolvedTarget): string | undefined {
  if (t.kind === "puzzle") return t.id;
  if (t.kind === "prop") return PROPS.find((p) => p.id === t.id)?.puzzle;
  if (t.kind === "pickup") return PICKUPS.find((p) => p.id === t.id)?.puzzle;
  if (t.kind === "door") return DOORS.find((d) => d.id === t.id)?.keypad;
  return undefined;
}

function hiddenByLight(c: Condition | undefined): boolean {
  return !!c && "device" in c && LIGHT_REVEALS.has(c.device);
}

function planUses(s: WorldState, proto: ItemDef, t: ResolvedTarget): UsePlan[] {
  const plans: UsePlan[] = [];
  const arch = archetypeOf(proto);
  const strength = arch?.strength ?? 1;
  const pt = proto.traits;
  const roll = rollFor(proto.id, t.id);

  // Ladung — charge a device.
  if (t.kind === "device" && isBuilt(s, t.id) && reaches(proto, { energie: 6 })) {
    if (t.id === "NXS-01" && isOnline(s, t.id) && !researchReady(s)) {
      plans.push({
        family: "ladung",
        score: pt.energie,
        preview: tr("Start a research cycle now"),
        apply: () => {
          delete s.counters.research_last;
          const r = research(s);
          return {
            message: tr("The Nexus swallows the charge and carries on computing at once."),
            lines: [r.message],
            insights: r.insights,
          };
        },
      });
    } else if (t.id === "EXD-001" && isOnline(s, t.id) && !droneReady(s)) {
      plans.push({
        family: "ladung",
        score: pt.energie,
        preview: tr("Charge the drone battery now"),
        apply: () => {
          delete s.counters.drone_last;
          return { message: tr("Drone battery full. It can go straight back into the shaft.") };
        },
      });
    } else {
      const cur = Math.min(PROTO_PUFFER_MAX, s.counters.proto_puffer ?? 0);
      if (!s.flags[`puffer_${t.id}`] && cur < PROTO_PUFFER_MAX) {
        const amount = Math.min(PROTO_PUFFER_MAX - cur, (10 + 5 * (roll % 2)) * strength);
        plans.push({
          family: "ladung",
          score: pt.energie,
          preview: tr("Charge buffer (+{w} W)", { w: amount }),
          apply: () => {
            s.flags[`puffer_${t.id}`] = true;
            const total = bump(s, "proto_puffer", amount);
            return {
              message: tr(
                "{name}: buffer charged — +{w} W on the grid ({total}/{max} W from prototypes).",
                {
                  name: t.name,
                  w: amount,
                  total: Math.min(total, PROTO_PUFFER_MAX),
                  max: PROTO_PUFFER_MAX,
                },
              ),
              lines: [
                roll % 3 === 0
                  ? tr("MCP: “Unregulated feed-in. I am logging it as a donation.”")
                  : tr("The readout jumps, hesitates, stays up."),
              ],
            };
          },
        });
      }
    }
  }

  // Kühlung — calm another prototype.
  if (t.kind === "item" && t.id !== proto.id) {
    const other = s.generated[t.id];
    const can = reaches(proto, { thermik: 6 }) || arch?.id === "ruhepol";
    if (other && other.kind === "prototyp" && other.volatility > 1 && can) {
      const to = Math.max(1, other.volatility - strength);
      plans.push({
        family: "kuehlung",
        score: pt.thermik,
        preview: tr("Volatility {from} → {to}", { from: other.volatility, to }),
        apply: () => {
          s.generated[t.id] = { ...other, volatility: to };
          return {
            message: tr("{name} calms down: volatility {from} → {to}.", {
              name: other.name,
              from: other.volatility,
              to,
            }),
            lines: [tr("The trembling in the casing subsides. Now it fits sensitive slots too.")],
          };
        },
      });
    }
  }

  // Lichtbild — reveal what only a device would show.
  if (
    (t.kind === "device" || t.kind === "prop" || t.kind === "pickup") &&
    t.room &&
    reaches(proto, { optik: 6 })
  ) {
    const wide = strength >= 2;
    const inArea = (floor: FloorId, x: number, z: number) =>
      wide ? floor === t.room!.floor : roomAt(floor, x, z)?.id === t.room!.id;
    const notes = NOTES.filter(
      (n) =>
        hiddenByLight(n.hidden) &&
        inArea(n.floor, n.x, n.z) &&
        !evalCond(s, n.hidden) &&
        !s.flags[revealedFlag(n.id)],
    );
    const piles = PICKUPS.filter(
      (p) =>
        hiddenByLight(p.hidden) &&
        inArea(p.floor, p.x, p.z) &&
        !evalCond(s, p.hidden) &&
        !s.flags[revealedFlag(p.id)],
    );
    if (notes.length + piles.length > 0) {
      plans.push({
        family: "lichtbild",
        score: pt.optik,
        preview: wide
          ? tr("Illuminate the whole level")
          : tr("Illuminate {room}", { room: t.room.name }),
        apply: () => {
          const revealed = [...notes.map((n) => n.id), ...piles.map((p) => p.id)];
          for (const id of revealed) s.flags[revealedFlag(id)] = true;
          return {
            message:
              revealed.length === 1
                ? tr("Illumination: {n} hidden object visible.", { n: revealed.length })
                : tr("Illumination: {n} hidden objects visible.", { n: revealed.length }),
            lines: [
              ...notes.map((n) => tr("Note: “{title}”", { title: n.title })),
              ...piles.map((p) => tr("Find: {label}", { label: p.label })),
            ],
            revealed,
          };
        },
      });
    }
  }

  // Dekodierung / Stimmung / Kalibrierung — solve a puzzle.
  const pz = puzzleOf(t);
  const pdef = pz ? PUZZLE_BY_ID.get(pz) : undefined;
  if (pz && pdef && !s.puzzles[pz] && !NO_BYPASS.has(pz) && puzzleAvailable(s, pz)) {
    const map = PUZZLE_AXIS[pdef.kind];
    if (map && reaches(proto, { [map.axis]: PUZZLE_BYPASS_MIN })) {
      const fam = PROTO_EFFECT_BY_ID.get(map.family)!;
      plans.push({
        family: map.family,
        score: pt[map.axis] + 1,
        preview: tr("Solve “{title}”", { title: pdef.title }),
        apply: () => {
          const r = solvePuzzle(s, pz);
          return {
            message: tr("{family}: “{title}” solved.", { family: fam.name, title: pdef.title }),
            lines: [
              pdef.mcpSolved,
              ...(r.items.length ? [tr("Received: {items}", { items: r.items.join(", ") })] : []),
            ],
            insights: r.insights,
            discovered: r.discovered,
            puzzle: pz,
          };
        },
      });
    }
  }

  // Hebel — finish a half-salvaged pile without the tool.
  if (t.kind === "pickup" && reaches(proto, { mechanik: 6 })) {
    const p = PICKUPS.find((x) => x.id === t.id)!;
    if (!p.pool && s.flags[`partial_${p.id}`] && p.tool && !isOnline(s, p.tool)) {
      const rest = p.items.slice(1);
      plans.push({
        family: "hebel",
        score: pt.mechanik,
        preview: tr("Pry out the rest"),
        apply: () => {
          delete s.flags[`partial_${p.id}`];
          s.taken[p.id] = s.playTime;
          for (const it of rest) addItem(s, it.item, it.count);
          bump(
            s,
            "salvaged",
            rest.reduce((a, it) => a + it.count, 0),
          );
          const names = rest
            .map((it) => `${it.count}× ${ITEM_BY_ID.get(it.item)?.name ?? it.item}`)
            .join(", ");
          return {
            message: tr("Using the {name} as a crowbar: {items}.", {
              name: proto.name,
              items: names || tr("nothing more"),
            }),
            items: rest,
          };
        },
      });
    }
  }

  // Peilung — locate slice signatures.
  if ((t.kind === "device" || t.kind === "prop") && reaches(proto, { signal: 6 })) {
    const left = PICKUPS.filter(
      (p) =>
        SLICE_PICKUPS.includes(p.id) &&
        s.taken[p.id] === undefined &&
        !s.flags[`peil_${p.id}`] &&
        floorAccessible(s, p.floor),
    ).sort((a, b) => {
      const fa = a.floor === t.floor ? 0 : 1;
      const fb = b.floor === t.floor ? 0 : 1;
      const da = Math.hypot(a.x - (t.x ?? 0), a.z - (t.z ?? 0));
      const db = Math.hypot(b.x - (t.x ?? 0), b.z - (t.z ?? 0));
      return fa - fb || da - db || a.id.localeCompare(b.id);
    });
    if (left.length) {
      const found = left.slice(0, strength);
      plans.push({
        family: "peilung",
        score: pt.signal,
        preview:
          found.length === 1
            ? tr("Take a bearing on {n} slice signature", { n: found.length })
            : tr("Take a bearing on {n} slice signatures", { n: found.length }),
        apply: () => {
          const lines = found.map((p) => {
            s.flags[`peil_${p.id}`] = true;
            const room = roomAt(p.floor, p.x, p.z);
            const where = `${room?.name ?? "?"} (${FLOOR_BY_ID[p.floor].short})`;
            return pickupVisible(s, p)
              ? tr("847 Hz from the direction of {where}.", { where })
              : tr("847 Hz from the direction of {where} — still hidden: {cond}.", {
                  where,
                  cond: describeCond(p.hidden!),
                });
          });
          return { message: tr("Bearing: slice signature found."), lines };
        },
      });
    }
  }

  // Resonanzschlüssel — open a hidden door.
  if (t.kind === "door" && reaches(proto, { resonanz: 5, quantum: 5 })) {
    const d = DOORS.find((x) => x.id === t.id)!;
    if ((d.secret || RESONANT_DOORS.has(d.id)) && !doorIsOpen(s, d)) {
      plans.push({
        family: "resonanzschluessel",
        score: (pt.resonanz + pt.quantum) / 2,
        preview: tr("Make the seam vibrate"),
        apply: () => {
          s.doorsOpen[d.id] = true;
          return {
            message: d.secret
              ? tr(
                  "The wall answers with a deep tone. A seam springs open — there is a passage behind it.",
                )
              : tr("The crystal curtain resonates, finds its frequency and gives way."),
            opened: d.id,
          };
        },
      });
    }
  }

  // Reanimation — a prototype instead of the missing part.
  if (t.kind === "npc") {
    const prof = BOT_PROFILES.find((b) => b.npc === t.id);
    const quest = BOT_QUESTS.find((q) => q.npc === t.id);
    const npc = NPCS.find((n) => n.id === t.id);
    const option = npc?.options.find((o) => o.label === quest?.option);
    if (
      prof &&
      quest &&
      npc &&
      option &&
      !s.flags[quest.flag] &&
      evalCond(s, npc.visible) &&
      (arch?.wildcard || reaches(proto, prof.need))
    ) {
      plans.push({
        family: "reanimation",
        score: 10,
        preview: tr("use instead of {part}", { part: prof.part }),
        apply: () => {
          s.flags[saidKey(npc.id, option)] = true;
          for (const f of option.flags ?? []) s.flags[f] = true;
          bump(s, "dialogues");
          const insights = grant(s, option.grants);
          return {
            message: tr("{bot} takes the {proto} instead of {part}. It is running again.", {
              bot: npc.name,
              proto: proto.name,
              part: prof.part,
            }),
            dialogue: option.lines.map((l) =>
              l.text === "__HINT__" ? { ...l, text: hint(s) } : l,
            ),
            insights,
          };
        },
      });
    }
  }

  // Kohärenz — portal, rift, forge.
  const coh = COHERENCE_TARGETS[t.id];
  if (
    coh &&
    !s.insights[coh.insight] &&
    (t.kind === "prop" || isBuilt(s, t.id)) &&
    reaches(proto, { quantum: 8, resonanz: 3 })
  ) {
    plans.push({
      family: "kohaerenz",
      score: pt.quantum,
      preview: tr("Hold coherence ({title})", {
        title: INSIGHT_BY_ID.get(coh.insight)?.title ?? coh.insight,
      }),
      apply: () => ({ message: coh.text, insights: grant(s, [coh.insight]) }),
    });
  }

  return plans.sort((a, b) => b.score - a.score || a.family.localeCompare(b.family));
}

function prototypeInInventory(s: WorldState, protoId: string): ItemDef | undefined {
  const def = s.generated[protoId];
  return def && def.kind === "prototyp" && count(s, protoId) > 0 ? def : undefined;
}

/**
 * Use a generated prototype on a target — a device, prop, door, bot, pickup,
 * puzzle or another prototype in the inventory. The effect family is chosen
 * by the prototype's strongest matching axis (or forced via `family`); the
 * outcome is deterministic (keyed by prototype id and target). Failed uses
 * never consume anything. Named archetypes may keep the prototype.
 */
export function applyPrototype(
  s: WorldState,
  protoId: string,
  target: string,
  family?: ProtoEffectId,
): PrototypeUseReport {
  const base: PrototypeUseReport = {
    ok: false,
    message: "",
    lines: [],
    dialogue: [],
    insights: [],
    discovered: [],
    items: [],
    revealed: [],
    consumed: false,
    firstOfFamily: false,
  };
  const proto = prototypeInInventory(s, protoId);
  if (!proto) return { ...base, message: tr("No such prototype in the inventory.") };
  const t = resolveTarget(s, target);
  if (!t) return { ...base, message: tr("There is nothing to try out on that.") };
  const plans = planUses(s, proto, t).filter((p) => !family || p.family === family);
  const plan = plans[0];
  if (!plan) {
    const can = prototypeAffordances(proto)
      .map((f) => PROTO_EFFECT_BY_ID.get(f)?.name ?? f)
      .join(", ");
    return {
      ...base,
      message: tr("{target} does not react to {proto}.", { target: t.name, proto: proto.name }),
      lines: [
        can
          ? tr("The prototype is good for: {list}.", { list: can })
          : tr("This prototype has no distinct effect."),
      ],
    };
  }
  const out = plan.apply();
  const reusable = archetypeOf(proto)?.reusable?.includes(plan.family) ?? false;
  if (!reusable) removeItem(s, proto.id, 1);
  const flag = protoEffectFlag(plan.family);
  const firstOfFamily = !s.flags[flag];
  s.flags[flag] = true;
  bump(s, "proto_uses");
  log(
    s,
    tr("Prototype used ({family}): {message}", {
      family: PROTO_EFFECT_BY_ID.get(plan.family)?.name ?? plan.family,
      message: out.message,
    }),
  );
  const settled = settle(s);
  return {
    ...base,
    ok: true,
    family: plan.family,
    message: out.message,
    lines: [
      ...(out.lines ?? []),
      ...(reusable ? [tr("{name} stays intact (archetype).", { name: proto.name })] : []),
    ],
    dialogue: out.dialogue ?? [],
    insights: [...(out.insights ?? []), ...settled.insights],
    discovered: [...(out.discovered ?? []), ...settled.discovered],
    items: out.items ?? [],
    revealed: out.revealed ?? [],
    opened: out.opened,
    puzzle: out.puzzle,
    consumed: !reusable,
    firstOfFamily,
  };
}

/**
 * Alias of `applyPrototype` under the design name. React code should call
 * `applyPrototype` — the `use` prefix trips the rules-of-hooks lint.
 */
export const usePrototype = applyPrototype;

export interface PrototypeUseOption {
  protoId: string;
  name: string;
  family: ProtoEffectId;
  familyName: string;
  preview: string;
  /** False when a named archetype keeps the prototype. */
  consumes: boolean;
}

/**
 * Which prototypes in the inventory would do something at `target`
 * (best first) — the list behind "Benutzen mit Prototyp …". Pure.
 */
export function prototypeUseOptions(s: WorldState, target: string): PrototypeUseOption[] {
  const t = resolveTarget(s, target);
  if (!t) return [];
  const out: (PrototypeUseOption & { score: number })[] = [];
  for (const id of Object.keys(s.inventory).sort()) {
    const proto = prototypeInInventory(s, id);
    if (!proto || id === target) continue;
    const plan = planUses(s, proto, t)[0];
    if (!plan) continue;
    out.push({
      protoId: id,
      name: proto.name,
      family: plan.family,
      familyName: PROTO_EFFECT_BY_ID.get(plan.family)?.name ?? plan.family,
      preview: plan.preview,
      consumes: !(archetypeOf(proto)?.reusable?.includes(plan.family) ?? false),
      score: plan.score,
    });
  }
  out.sort((a, b) => b.score - a.score || a.protoId.localeCompare(b.protoId));
  return out.map((o) => ({
    protoId: o.protoId,
    name: o.name,
    family: o.family,
    familyName: o.familyName,
    preview: o.preview,
    consumes: o.consumes,
  }));
}

/**
 * A nudge towards an effect family the player has not tried yet, based on
 * a prototype they carry — or undefined. For the MCP / DGN-001 hint line.
 */
export function prototypeHint(s: WorldState): string | undefined {
  for (const id of Object.keys(s.inventory).sort()) {
    const proto = prototypeInInventory(s, id);
    if (!proto) continue;
    for (const f of prototypeAffordances(proto)) {
      if (s.flags[protoEffectFlag(f)]) continue;
      const e = PROTO_EFFECT_BY_ID.get(f)!;
      return `${proto.name}: ${e.hint} (${e.name} — ${e.targets}.)`;
    }
  }
  return undefined;
}

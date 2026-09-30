/**
 * Lab World — objective tracker (»Aufträge«).
 * ===========================================
 *
 * There is no quest log to follow; this module *derives* what could be done
 * next from the current `WorldState`, thread by thread: power, the next
 * stage of each device, bots waiting for a part, unread notes, locked
 * doors and floors, the slices of Crystal #0089 and the missing pieces of
 * each way to Damien. Pure — the journal renders `objectiveSections()` and
 * the HUD compass points at `compassTarget()`.
 */
import { tr } from "@/lib/i18n";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID, SLICE_TOTAL } from "@/lib/world/content/items";
import {
  DOORS,
  FLOORS,
  FLOOR_ACCESS,
  FLOOR_BY_ID,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  ROOM_BY_ID,
  SLICE_PICKUPS,
  roomAt,
  doorTouches,
} from "@/lib/world/content/map";
import { BOT_QUESTS, ENDINGS, NPCS } from "@/lib/world/content/story";
import {
  checkStage,
  count,
  describeCond,
  doorIsOpen,
  endingRevealed,
  evalCond,
  floorAccessible,
  isBuilt,
  isOnline,
  missingParts as missingBlueprintParts,
  noteVisible,
  pickupAvailable,
  pickupVisible,
  power,
  reachableRooms,
} from "@/lib/world/game";
import type { Condition, FloorId, RoomDef, WorldState } from "@/lib/world/types";
import { CORE } from "@/lib/world/content/floorplan";

export type ObjectiveGroup =
  | "strom"
  | "ebenen"
  | "geraete"
  | "bots"
  | "slices"
  | "raeume"
  | "notizen"
  | "wege";

export interface ObjectiveTarget {
  floor: FloorId;
  x: number;
  z: number;
  label: string;
}

export interface Objective {
  id: string;
  group: ObjectiveGroup;
  /** Short instruction (translated). */
  text: string;
  /** Optional second line (blocker, hint). */
  detail?: string;
  /** Lower = more urgent. */
  priority: number;
  target?: ObjectiveTarget;
  /**
   * Recipe chain for a missing craftable part of a blueprint
   * ("Hochlegierung = 2 Basislegierung + Energiezelle", …).
   */
  recipe?: string[];
}

export interface ObjectiveSection {
  group: ObjectiveGroup;
  title: string;
  items: Objective[];
}

export const GROUP_TITLE: Record<ObjectiveGroup, string> = {
  strom: tr("objectives::Power"),
  ebenen: tr("objectives::Levels"),
  geraete: tr("objectives::Devices"),
  bots: tr("objectives::Reactivate bots"),
  slices: tr("objectives::Crystal #0089"),
  raeume: tr("objectives::Locked doors"),
  notizen: tr("objectives::Unread"),
  wege: tr("objectives::Paths to Damien"),
};

const GROUP_ORDER: readonly ObjectiveGroup[] = [
  "strom",
  "ebenen",
  "geraete",
  "bots",
  "wege",
  "slices",
  "raeume",
  "notizen",
];

/** Max items per group (the journal stays readable). */
const GROUP_LIMIT: Record<ObjectiveGroup, number> = {
  strom: 4,
  ebenen: 5,
  geraete: 6,
  bots: 10,
  slices: 8,
  raeume: 5,
  notizen: 6,
  wege: 5,
};

function roomName(floor: FloorId, x: number, z: number): string {
  const r = roomAt(floor, x, z);
  return r ? `${r.name} (${FLOOR_BY_ID[floor].short})` : FLOOR_BY_ID[floor].short;
}

function at(floor: FloorId, x: number, z: number, label: string): ObjectiveTarget {
  return { floor, x, z, label };
}

function deviceTarget(id: string): ObjectiveTarget | undefined {
  const d = DEVICE_BY_ID.get(id);
  const r = d ? ROOM_BY_ID.get(d.room) : undefined;
  return d && r ? at(r.floor, d.x, d.z, d.name) : undefined;
}

function propTarget(id: string): ObjectiveTarget | undefined {
  const p = PROPS.find((x) => x.id === id);
  return p ? at(p.floor, p.x, p.z, p.label) : undefined;
}

/** First failing clauses of a condition, in plain language. */
function missingParts(s: WorldState, c: Condition): string[] {
  const parts = "all" in c ? c.all : [c];
  return parts.filter((p) => !evalCond(s, p)).map(describeCond);
}

/** Lock hint of a closed door that touches the room (why the player cannot get in yet). */
function lockedDoorInto(
  s: WorldState,
  floor: FloorId,
  room: RoomDef | undefined,
): string | undefined {
  if (!room) return undefined;
  const d = DOORS.find(
    (x) =>
      x.floor === floor &&
      doorTouches(x, room) &&
      !doorIsOpen(s, x) &&
      (!x.secret || !!s.insights.geheimtueren),
  );
  if (!d) return undefined;
  return d.lockHint ?? (d.lock ? describeCond(d.lock) : undefined);
}

// ── Threads ──────────────────────────────────────────────────────

function powerObjectives(s: WorldState): Objective[] {
  const out: Objective[] = [];
  if (!s.puzzles.pz_geo_valve)
    out.push({
      id: "strom_ventil",
      group: "strom",
      text: tr("Open the Abstractum Seep Valve"),
      detail: tr("Geothermal shaft, Level −1 — via the Emergency Ladder at the Elevator."),
      priority: 0,
      target: propTarget("geo_ventil"),
    });
  if (!s.puzzles.pz_power_flow)
    out.push({
      id: "strom_verteiler",
      group: "strom",
      text: tr("Turn the geothermal distributor to 50 W"),
      detail: tr("“Fifty units. Not forty-nine.”"),
      priority: 1,
      target: propTarget("geo_verteiler"),
    });
  const p = power(s);
  if (p.starved.length && p.generation > 0) {
    const first = DEVICE_BY_ID.get(p.starved[0]!.id);
    out.push({
      id: "strom_brownout",
      group: "strom",
      text: tr("Brownout: {n} device(s) without power or too hot", { n: p.starved.length }),
      detail:
        p.starved[0]!.reason === "hitze"
          ? tr(
              "{name} is overheating (Thermal Manager missing). Switch something off or build generation.",
              { name: first?.name ?? "?" },
            )
          : tr("{name} is starving. Switch something off or build generation.", {
              name: first?.name ?? "?",
            }),
      priority: 3,
      target: first ? deviceTarget(first.id) : undefined,
    });
  }
  const dome = DOORS.find((d) => d.id === "d_observatorium");
  if (dome && floorAccessible(s, 4) && !doorIsOpen(s, dome) && p.generation >= 50)
    out.push({
      id: "strom_kuppel",
      group: "strom",
      text: tr("Bring output up to 200 W (now {w} W)", { w: p.generation }),
      detail: tr("The observatory dome (Level +1) needs 200 W."),
      priority: 60,
    });
  return out;
}

function floorObjectives(s: WorldState): Objective[] {
  const out: Objective[] = [];
  for (const f of FLOORS) {
    if (floorAccessible(s, f.id)) continue;
    const acc = FLOOR_ACCESS[f.id];
    out.push({
      id: `ebene_${f.id}`,
      group: "ebenen",
      text: tr("Reach {floor}", { floor: f.name }),
      detail: acc.hint,
      priority: 20 + f.order,
      target: at(s.floor, CORE.x, CORE.z, tr("Elevator")),
    });
  }
  return out;
}

function deviceObjectives(s: WorldState): Objective[] {
  const out: Objective[] = [];
  for (const d of DEVICES) {
    if (!s.discovered[d.id] || isBuilt(s, d.id)) continue;
    if (!d.needs.every((n) => isBuilt(s, n))) continue;
    const room = ROOM_BY_ID.get(d.room);
    // Devices on a locked floor are covered by the "Ebenen" objective.
    if (!room || !floorAccessible(s, room.floor)) continue;
    const c = checkStage(s, d.id);
    if (!c) continue;
    const stage = d.stages[c.stageIndex];
    const reachable = !!room && reachableRooms(s, room.floor).has(room.id);
    const ready = c.blockers.length === 0;
    const part = ready ? undefined : missingBlueprintParts(s, d.id)[0];
    out.push({
      id: `geraet_${d.id}`,
      group: "geraete",
      text: tr("{name}: stage {n}/{total} “{stage}”", {
        name: d.name,
        n: c.stageIndex + 1,
        total: d.stages.length,
        stage: stage?.name ?? "?",
      }),
      detail: ready ? tr("All set — go there and build.") : c.blockers[0],
      ...(part ? { recipe: part.chain.map((l) => l.text) } : {}),
      priority:
        (d.id === "UEC-001" ? 2 : 10) +
        d.tier * 2 +
        (ready ? 0 : 4) +
        (reachable ? 0 : 6) +
        c.stageIndex * -1,
      target: deviceTarget(d.id),
    });
  }
  return out;
}

function botObjectives(s: WorldState): Objective[] {
  const out: Objective[] = [];
  for (const q of BOT_QUESTS) {
    if (s.flags[q.flag]) continue;
    const npc = NPCS.find((n) => n.id === q.npc);
    if (!npc || !floorAccessible(s, npc.floor)) continue;
    const option = npc.options.find((o) => o.label === q.option);
    const deliverable = !!option && evalCond(s, option.when);
    const takes = option?.takes?.[0];
    const room = roomAt(npc.floor, npc.x, npc.z);
    const reachable = !!room && reachableRooms(s, npc.floor).has(room.id);
    const blocked = reachable ? undefined : lockedDoorInto(s, npc.floor, room);
    out.push({
      id: `bot_${q.npc}`,
      group: "bots",
      text: q.hint,
      detail: !reachable
        ? tr("Get there first: {why}", { why: blocked ?? tr("The room is still locked.") })
        : deliverable
          ? takes
            ? tr("Ready: {count}× {item} on hand — {reward}", {
                count: takes.count,
                item: ITEM_BY_ID.get(takes.item)?.name ?? takes.item,
                reward: q.reward,
              })
            : tr("Ready: requirement met — {reward}", { reward: q.reward })
          : tr("Reward: {reward}", { reward: q.reward }),
      priority: deliverable && reachable ? 15 : 32,
      target: at(npc.floor, npc.x, npc.z, npc.name),
    });
  }
  return out;
}

function sliceObjectives(s: WorldState): Objective[] {
  const found = s.counters.slices ?? 0;
  if (found >= SLICE_TOTAL) return [];
  const out: Objective[] = [];
  // K2-LDR's catalogue — or the Quantum Compass, which feels the slices.
  const catalog = !!s.insights.k2ldr_katalog || isOnline(s, "QCP-001");
  if (!catalog) {
    out.push({
      id: "slices_zaehlen",
      group: "slices",
      text: tr("{found}/{total} slices of Crystal #0089 found", { found, total: SLICE_TOTAL }),
      detail: tr(
        "Jade spread the slices all over the lab. K2-LDR (Archive, Level 0) could catalogue them — or the Quantum Compass (QCP-001) tracks them down.",
      ),
      priority: 55,
    });
    return out;
  }
  for (const id of SLICE_PICKUPS) {
    const p = PICKUPS.find((x) => x.id === id);
    if (!p || s.taken[p.id] !== undefined || !floorAccessible(s, p.floor)) continue;
    const where = roomName(p.floor, p.x, p.z);
    const visible = pickupVisible(s, p);
    const locked = !!p.puzzle && !s.puzzles[p.puzzle];
    out.push({
      id: `slice_${p.id}`,
      group: "slices",
      text: `${p.label} — ${where}`,
      detail: !visible
        ? tr("Appears once: {cond}", { cond: describeCond(p.hidden!) })
        : locked
          ? tr("Secured: {cond}", { cond: describeCond({ puzzle: p.puzzle! }) })
          : tr("Visible — pick it up."),
      priority: visible && !locked && pickupAvailable(s, p) ? 35 : 58,
      target: at(p.floor, p.x, p.z, p.label),
    });
  }
  out.push({
    id: "slices_zaehlen",
    group: "slices",
    text: tr("{found}/{total} slices found ({source})", {
      found,
      total: SLICE_TOTAL,
      source: s.insights.k2ldr_katalog ? tr("K2-LDR catalogue") : tr("Quantum Compass"),
    }),
    priority: 99,
  });
  return out;
}

function doorObjectives(s: WorldState): Objective[] {
  const out: Objective[] = [];
  for (const f of FLOORS) {
    if (!floorAccessible(s, f.id)) continue;
    const reach = reachableRooms(s, f.id);
    for (const d of DOORS) {
      if (d.floor !== f.id || doorIsOpen(s, d)) continue;
      if (d.secret && !s.insights.geheimtueren) continue;
      const beside = ROOMS.some((r) => r.floor === f.id && reach.has(r.id) && doorTouches(d, r));
      if (!beside) continue;
      out.push({
        id: `tuer_${d.id}`,
        group: "raeume",
        text: d.keypad
          ? tr("Keypad: {room}", { room: roomName(f.id, d.x, d.z) })
          : tr("Locked door ({floor})", { floor: f.short }),
        detail: d.lockHint ?? (d.lock ? describeCond(d.lock) : undefined),
        priority: d.keypad ? 26 : 45,
        target: at(f.id, d.x, d.z, tr("Door")),
      });
    }
  }
  return out;
}

function noteObjectives(s: WorldState): Objective[] {
  const out: Objective[] = [];
  const perRoom = new Map<string, { floor: FloorId; x: number; z: number; n: number }>();
  for (const n of NOTES) {
    if (s.read[n.id] || !noteVisible(s, n.id) || !floorAccessible(s, n.floor)) continue;
    const r = roomAt(n.floor, n.x, n.z);
    if (!r || !reachableRooms(s, n.floor).has(r.id)) continue;
    const e = perRoom.get(r.id);
    if (e) e.n += 1;
    else perRoom.set(r.id, { floor: n.floor, x: n.x, z: n.z, n: 1 });
  }
  for (const [roomId, e] of perRoom) {
    const r = ROOM_BY_ID.get(roomId)!;
    out.push({
      id: `notiz_${roomId}`,
      group: "notizen",
      text:
        e.n > 1
          ? tr("{n} unread notes: {room} ({floor})", {
              n: e.n,
              room: r.name,
              floor: FLOOR_BY_ID[r.floor].short,
            })
          : tr("{n} unread note: {room} ({floor})", {
              n: e.n,
              room: r.name,
              floor: FLOOR_BY_ID[r.floor].short,
            }),
      priority: 40 - Math.min(5, e.n),
      target: at(e.floor, e.x, e.z, r.name),
    });
  }
  return out;
}

function endingObjectives(s: WorldState): Objective[] {
  const out: Objective[] = [];
  for (const e of ENDINGS) {
    if (s.endings[e.id]) continue;
    if (!endingRevealed(s, e)) continue;
    const missing = missingParts(s, e.requires);
    const total = "all" in e.requires ? e.requires.all.length : 1;
    const target = e.device === "forge" ? propTarget("infinity_forge") : deviceTarget(e.device);
    out.push({
      id: `weg_${e.id}`,
      group: "wege",
      text: missing.length
        ? tr("{title}: {n}/{total} conditions", {
            title: e.title,
            n: total - missing.length,
            total,
          })
        : tr("{title}: ready!", { title: e.title }),
      detail: missing.length
        ? tr("Missing: {list}", { list: missing.slice(0, 2).join(" · ") })
        : e.prompt,
      priority: missing.length ? 50 + missing.length * 2 : 5,
      target,
    });
  }
  return out;
}

// ── Public API ───────────────────────────────────────────────────

/** Every open objective, most urgent first. */
export function objectives(s: WorldState): Objective[] {
  const all = [
    ...powerObjectives(s),
    ...floorObjectives(s),
    ...deviceObjectives(s),
    ...botObjectives(s),
    ...sliceObjectives(s),
    ...doorObjectives(s),
    ...noteObjectives(s),
    ...endingObjectives(s),
  ];
  // The compass never points onto a floor the elevator cannot reach yet.
  for (const o of all) if (o.target && !floorAccessible(s, o.target.floor)) delete o.target;
  const limited: Objective[] = [];
  for (const g of GROUP_ORDER) {
    limited.push(
      ...all
        .filter((o) => o.group === g)
        .sort((a, b) => a.priority - b.priority)
        .slice(0, GROUP_LIMIT[g]),
    );
  }
  return limited.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

/**
 * Objectives grouped for the journal (»Aufträge«), groups in a stable order.
 * Pass a precomputed list (`objectivesCached`) to skip the sweep.
 */
export function objectiveSections(
  s: WorldState,
  list: readonly Objective[] = objectives(s),
): ObjectiveSection[] {
  return GROUP_ORDER.map((group) => ({
    group,
    title: GROUP_TITLE[group],
    items: list.filter((o) => o.group === group),
  })).filter((sec) => sec.items.length > 0);
}

/** The single most urgent objective (for the HUD line). */
export function topObjective(s: WorldState): Objective | undefined {
  return objectives(s)[0];
}

/**
 * Where the compass needle points: the most urgent objective that has a
 * location. Prefers targets on the current floor when priorities tie
 * within 3 points.
 */
export function compassTarget(s: WorldState): ObjectiveTarget | null {
  return autoCompass(s, objectives(s))?.target ?? null;
}

function autoCompass(
  s: WorldState,
  list: readonly Objective[],
): { objective: Objective; target: ObjectiveTarget } | null {
  const located = list.filter((o) => o.target);
  const best = located[0];
  if (!best) return null;
  const here = located.find((o) => o.target!.floor === s.floor && o.priority <= best.priority + 3);
  const pick = here ?? best;
  return { objective: pick, target: pick.target! };
}

// ── Tracked objective (journal »Track«) ──────────────────────────

/**
 * The pinned objective lives in the world flags as `track_<objective id>`
 * (at most one is set). A pin whose objective is done or has no location
 * any more is ignored — the compass falls back to the automatic pick — and
 * lingers harmlessly until the next pin replaces it.
 */
export const TRACK_FLAG_PREFIX = "track_";

/** Id of the pinned objective, or null. */
export function trackedObjectiveId(s: WorldState): string | null {
  for (const [k, v] of Object.entries(s.flags))
    if (v && k.startsWith(TRACK_FLAG_PREFIX)) return k.slice(TRACK_FLAG_PREFIX.length);
  return null;
}

/** Pin one objective (null unpins). Clears any previous pin. */
export function setTrackedObjective(s: WorldState, id: string | null): void {
  for (const k of Object.keys(s.flags)) if (k.startsWith(TRACK_FLAG_PREFIX)) delete s.flags[k];
  if (id) s.flags[`${TRACK_FLAG_PREFIX}${id}`] = true;
}

/** Only objectives with a location can be tracked (the compass needs a place). */
export function canTrack(o: Objective): boolean {
  return !!o.target;
}

// ── HUD (one sweep for line + compass) ───────────────────────────

export interface HudObjective {
  /** Objective shown in the HUD line (the tracked one while it is open). */
  objective: Objective | undefined;
  /** Compass target (tracked objective's place, else the automatic pick). */
  target: ObjectiveTarget | null;
  /** True while the compass follows a pinned objective. */
  tracked: boolean;
}

/** HUD line + compass from one objective list (see `objectivesCached`). */
export function hudObjective(s: WorldState, list: readonly Objective[]): HudObjective {
  const pin = trackedObjectiveId(s);
  const pinned = pin ? list.find((o) => o.id === pin && o.target) : undefined;
  if (pinned) return { objective: pinned, target: pinned.target!, tracked: true };
  return { objective: list[0], target: autoCompass(s, list)?.target ?? null, tracked: false };
}

const objectiveCache = new WeakMap<WorldState, { key: string; list: Objective[] }>();

/**
 * `objectives(s)`, computed once per world version. The world state is
 * mutated in place, so the caller passes its change counter (`useWorld`
 * version); the current floor is part of the key because floor targets
 * (elevator) depend on it. Treat the returned list as read-only.
 */
export function objectivesCached(s: WorldState, version: number): Objective[] {
  const key = `${version}:${s.floor}`;
  const hit = objectiveCache.get(s);
  if (hit && hit.key === key) return hit.list;
  const list = objectives(s);
  objectiveCache.set(s, { key, list });
  return list;
}

/** Items the player carries that some sleeping bot is waiting for. */
export function questItemsInInventory(s: WorldState): string[] {
  const out: string[] = [];
  for (const q of BOT_QUESTS) {
    if (s.flags[q.flag]) continue;
    const o = NPCS.find((n) => n.id === q.npc)?.options.find((x) => x.label === q.option);
    for (const t of o?.takes ?? []) if (count(s, t.item) >= t.count) out.push(t.item);
  }
  return out;
}

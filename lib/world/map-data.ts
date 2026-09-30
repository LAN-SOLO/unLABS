/**
 * Lab World — map model (pure).
 * =============================
 *
 * Derives everything the map shows from the `WorldState` and the content
 * tables: rooms with fog of war, doors with their lock state, the elevator
 * shaft with its floor links and every documented thing on each floor
 * (devices, finds, notes, people, stations, terminals, puzzles, decor) with
 * a status, a one-line status text, whether it counts as "found" and the
 * objective that can be tracked at its spot. No React, no DOM — the map UI
 * (`components/world/map/*`) only renders this model.
 *
 * Fog of war: a room is `visited` once entered (`visited_<room>` flag),
 * `known` when it is reachable through open doors or borders a visited room
 * through a visible door, otherwise `unknown` (drawn dim with "?"). Rooms
 * behind secret doors stay hidden until the door is found or they were
 * entered. Things inside a room are listed only after the room was visited
 * (located slices, collected finds, read notes and met people always are).
 */
import { tr } from "@/lib/i18n";
import { codexUnlocked, CODEX_BY_ID } from "@/lib/world/content/codex";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { interiorFor } from "@/lib/world/content/interior";
import {
  DOORS,
  FLOORS_TOP_DOWN,
  FLOOR_ACCESS,
  FLOOR_BY_ID,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  SLICE_PICKUPS,
  roomAt,
  doorTouches,
  floorGeomOf,
  roomAnchor,
} from "@/lib/world/content/map";
import { roomOutline } from "@/lib/world/floor-geom";
import { BOT_QUESTS, NPCS } from "@/lib/world/content/story";
import { ROOM_TERMINALS } from "@/lib/world/content/terminals";
import { decorActionFor, propDecorAction, seenFlag } from "@/lib/world/decor-actions";
import {
  describeCond,
  doorIsOpen,
  evalCond,
  floorAccessible,
  isBuilt,
  isSwitchedOn,
  noteVisible,
  pickupAvailable,
  pickupNeedsTool,
  pickupRespawnLeft,
  pickupVisible,
  power,
  puzzleAvailable,
  reachableRooms,
  stagesDone,
} from "@/lib/world/game";
import { canTrack, objectives, objectivesCached, trackedObjectiveId } from "@/lib/world/quests";
import type { DoorDef, FloorId, NpcId, RoomTheme, WorldState } from "@/lib/world/types";

// ── Types ────────────────────────────────────────────────────────

/** Entity categories (map icons, filters, legend). */
export const MAP_CATEGORIES = [
  "device",
  "item",
  "slice",
  "cache",
  "note",
  "npc",
  "station",
  "terminal",
  "puzzle",
  "elevator",
  "door",
  "decor",
] as const;
export type MapCategory = (typeof MAP_CATEGORIES)[number];

/** Categories shown by default (decor is opt-in: there are hundreds of pieces). */
export const DEFAULT_MAP_FILTER: ReadonlySet<MapCategory> = new Set(
  MAP_CATEGORIES.filter((c) => c !== "decor"),
);

export const CATEGORY_LABEL: Record<MapCategory, string> = {
  device: tr("map::Devices"),
  item: tr("map::Finds"),
  slice: tr("map::Slices"),
  cache: tr("map::Caches"),
  note: tr("map::Notes"),
  npc: tr("map::People"),
  station: tr("map::Stations"),
  terminal: tr("map::Terminals"),
  puzzle: tr("map::Puzzles"),
  elevator: tr("map::Elevator"),
  door: tr("map::Doors"),
  decor: tr("map::Decor"),
};

export type MapStatus =
  // devices
  | "online"
  | "starved"
  | "off"
  | "building"
  | "blueprint"
  // finds, slices, caches
  | "available"
  | "locked"
  | "partial"
  | "respawning"
  | "taken"
  | "located"
  // notes
  | "unread"
  | "read"
  // people
  | "awake"
  | "dormant"
  | "present"
  // props, terminals, puzzles, decor, elevator
  | "usable"
  | "blocked"
  | "solved"
  | "used"
  // doors
  | "door_locked"
  | "door_keypad"
  | "door_secret"
  | "door_suspected";

export const STATUS_LABEL: Record<MapStatus, string> = {
  online: tr("map status::Online"),
  starved: tr("map status::No power"),
  off: tr("map status::Switched off"),
  building: tr("map status::Under construction"),
  blueprint: tr("map status::Blueprint"),
  available: tr("map status::Available"),
  locked: tr("map status::Locked"),
  partial: tr("map status::Needs a tool"),
  respawning: tr("map status::Refilling"),
  taken: tr("map status::Collected"),
  located: tr("map status::Located"),
  unread: tr("map status::Unread"),
  read: tr("map status::Read"),
  awake: tr("map status::Awake"),
  dormant: tr("map status::Dormant"),
  present: tr("map status::Present"),
  usable: tr("map status::Usable"),
  blocked: tr("map status::Not yet usable"),
  solved: tr("map status::Solved"),
  used: tr("map status::Used"),
  door_locked: tr("map status::Locked door"),
  door_keypad: tr("map status::Keypad"),
  door_secret: tr("map status::Secret door (found)"),
  door_suspected: tr("map status::Suspected passage"),
};

/** Statuses that mean "nothing left to do here" (drawn dimmed). */
const DONE_STATUS: ReadonlySet<MapStatus> = new Set<MapStatus>([
  "taken",
  "read",
  "solved",
  "used",
  "door_secret",
]);

export interface MapEntity {
  /** Unique key, `<category>:<content id>`. */
  key: string;
  category: MapCategory;
  /** Content id (device id, pickup id, note id, NPC id, prop id, …). */
  id: string;
  floor: FloorId;
  x: number;
  z: number;
  /** Room id the entity stands in (null on a wall line or outside rooms). */
  room: string | null;
  name: string;
  status: MapStatus;
  /** One translated line for tooltips and lists. */
  statusText: string;
  /** Counts towards the "Found" list (collected, read, discovered, met, used). */
  found: boolean;
  /** Nothing left to do (dimmed). */
  done: boolean;
  /** Objective that can be pinned at this place (journal "Track"). */
  objectiveId: string | null;
  /** Handbook entry, when one exists and is unlocked. */
  codexId: string | null;
  /** Lower-case search haystack. */
  search: string;
}

export type RoomFog = "visited" | "known" | "unknown";

export interface MapRoom {
  id: string;
  floor: FloorId;
  name: string;
  /** Short code "L0·03" (floor short + running number). */
  code: string;
  x: number;
  z: number;
  w: number;
  d: number;
  /** SVG path of the room's real shape (floor-geom.ts `roomOutline`). */
  outline: string;
  /** A point inside the room (labels, focus) — see map.ts `roomAnchor`. */
  ax: number;
  az: number;
  theme: RoomTheme;
  fog: RoomFog;
  /** Lights on (main power and the room's light device). */
  lit: boolean;
  /** Only reachable through a secret door. */
  secret: boolean;
  blurb: string;
  codexId: string | null;
}

export type DoorState = "open" | "locked" | "keypad" | "secret" | "suspected";

export interface MapDoor {
  id: string;
  floor: FloorId;
  x: number;
  z: number;
  axis: "x" | "z";
  width: number;
  state: DoorState;
  /** Lock hint while closed. */
  hint: string | null;
}

export interface ProgressCount {
  found: number;
  total: number;
}

export interface FloorProgress {
  rooms: ProgressCount;
  devices: ProgressCount;
  notes: ProgressCount;
  slices: ProgressCount;
  caches: ProgressCount;
  items: ProgressCount;
  people: ProgressCount;
}

export interface ShaftStop {
  floor: FloorId;
  name: string;
  short: string;
  accessible: boolean;
  /** Why the elevator does not stop here yet (or what the stop is). */
  hint: string;
  /** Reachable by the Emergency Ladder (L0 ↔ L−1). */
  ladder: boolean;
  visited: boolean;
}

export interface MapFloor {
  id: FloorId;
  name: string;
  short: string;
  accessible: boolean;
  visited: boolean;
  rooms: MapRoom[];
  doors: MapDoor[];
  entities: MapEntity[];
  progress: FloorProgress;
}

export interface MapPin {
  floor: FloorId;
  x: number;
  z: number;
}

export interface MapModel {
  floors: Record<FloorId, MapFloor>;
  /** Floor ids top-down (+1, 0, −1, −2, −3, −4). */
  order: FloorId[];
  /** Elevator stops top-down. */
  shaft: ShaftStop[];
  entities: ReadonlyMap<string, MapEntity>;
  rooms: ReadonlyMap<string, MapRoom>;
  /** Floor the player is on. */
  current: FloorId;
  /** Pinned objective id (journal "Track"), or null. */
  trackedId: string | null;
  /** Map waypoint (tracked by location), or null. */
  pin: MapPin | null;
}

// ── Static helpers ───────────────────────────────────────────────

const FLOOR_IDS: readonly FloorId[] = [0, 1, 2, 3, 4, 5];

/** Doors touching each room (static). */
const ROOM_DOORS: ReadonlyMap<string, DoorDef[]> = new Map(
  ROOMS.map((r) => [r.id, DOORS.filter((d) => d.floor === r.floor && doorTouches(d, r))]),
);

/** Rooms reachable only through secret doors (static). */
const SECRET_ROOMS: ReadonlySet<string> = new Set(
  ROOMS.filter((r) => {
    const ds = ROOM_DOORS.get(r.id) ?? [];
    return ds.length > 0 && ds.every((d) => d.secret);
  }).map((r) => r.id),
);

/** Room codes "L0·01" … (static, floor short is translated). */
const ROOM_CODE: ReadonlyMap<string, string> = new Map(
  FLOOR_IDS.flatMap((f) =>
    ROOMS.filter((r) => r.floor === f).map(
      (r, i) => [r.id, `${FLOOR_BY_ID[f].short}·${String(i + 1).padStart(2, "0")}`] as const,
    ),
  ),
);

const SLICE_SET: ReadonlySet<string> = new Set(SLICE_PICKUPS);
const BOT_QUEST_BY_NPC = new Map(BOT_QUESTS.map((q) => [q.npc, q]));
const DEVICE_FLOOR = new Map(DEVICES.map((d) => [d.id, ROOMS.find((r) => r.id === d.room)?.floor]));

export function isCachePickup(id: string): boolean {
  return id.startsWith("p_side_");
}

export function isSlicePickup(id: string): boolean {
  return SLICE_SET.has(id);
}

/** Decor placements with an action, per floor (static). */
const DECOR_ACTION_PLACEMENTS = new Map(
  FLOOR_IDS.map((f) => [
    f,
    interiorFor(f).flatMap((p) => {
      const a = decorActionFor(p.decor, p.room);
      return a ? [{ placement: p, action: a }] : [];
    }),
  ]),
);

function roomOf(floor: FloorId, x: number, z: number): string | null {
  return roomAt(floor, x, z)?.id ?? null;
}

/** NPC met (same rule as the handbook's "People"). */
export function npcMet(s: WorldState, id: NpcId): boolean {
  return codexUnlocked(s, { met: id });
}

function codexIf(s: WorldState, id: string): string | null {
  const e = CODEX_BY_ID.get(id);
  return e && codexUnlocked(s, e.unlock) ? id : null;
}

function haystack(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

// ── Map pin (track by location) ──────────────────────────────────

const PIN_F = "map_pin_floor";
const PIN_X = "map_pin_x";
const PIN_Z = "map_pin_z";

/** The map waypoint, stored in the world counters (saved with the game). */
export function mapPin(s: WorldState): MapPin | null {
  const f = s.counters[PIN_F];
  const x = s.counters[PIN_X];
  const z = s.counters[PIN_Z];
  if (f === undefined || x === undefined || z === undefined) return null;
  if (!FLOOR_IDS.includes(f as FloorId)) return null;
  return { floor: f as FloorId, x, z };
}

/** Set (or clear with null) the map waypoint. Mutates `s`. */
export function setMapPin(s: WorldState, pin: MapPin | null): void {
  if (!pin) {
    delete s.counters[PIN_F];
    delete s.counters[PIN_X];
    delete s.counters[PIN_Z];
    return;
  }
  s.counters[PIN_F] = pin.floor;
  s.counters[PIN_X] = pin.x;
  s.counters[PIN_Z] = pin.z;
}

// ── Derivation ───────────────────────────────────────────────────

interface Ctx {
  s: WorldState;
  visitedRoom: (id: string | null, floor: FloorId) => boolean;
  objectiveAt: (floor: FloorId, x: number, z: number) => string | null;
}

function makeEntity(
  ctx: Ctx,
  e: Omit<MapEntity, "key" | "done" | "objectiveId" | "search" | "room"> & {
    room?: string | null;
    extraSearch?: string;
  },
): MapEntity {
  const room = e.room !== undefined ? e.room : roomOf(e.floor, e.x, e.z);
  const roomName = room ? ROOMS.find((r) => r.id === room)?.name : undefined;
  const { extraSearch, ...rest } = e;
  return {
    ...rest,
    key: `${e.category}:${e.id}`,
    room,
    done: DONE_STATUS.has(e.status),
    objectiveId: ctx.objectiveAt(e.floor, e.x, e.z),
    search: haystack(e.name, e.id, roomName, e.statusText, CATEGORY_LABEL[e.category], extraSearch),
  };
}

function deviceEntities(ctx: Ctx, floor: FloorId): MapEntity[] {
  const { s } = ctx;
  const p = power(s);
  const out: MapEntity[] = [];
  for (const d of DEVICES) {
    if (DEVICE_FLOOR.get(d.id) !== floor || !s.discovered[d.id]) continue;
    const done = stagesDone(s, d.id);
    const total = d.stages.length;
    const status: MapStatus = p.online.has(d.id)
      ? "online"
      : isBuilt(s, d.id)
        ? isSwitchedOn(s, d.id)
          ? "starved"
          : "off"
        : done > 0
          ? "building"
          : "blueprint";
    const statusText = isBuilt(s, d.id)
      ? d.power < 0
        ? tr("{status} · generates {watts} W", {
            status: STATUS_LABEL[status],
            watts: -d.power,
          })
        : tr("{status} · draws {watts} W", { status: STATUS_LABEL[status], watts: d.power })
      : tr("{status} · stage {done}/{total}", { status: STATUS_LABEL[status], done, total });
    out.push(
      makeEntity(ctx, {
        category: "device",
        id: d.id,
        floor,
        x: d.x,
        z: d.z,
        room: d.room,
        name: `${d.id} · ${d.name}`,
        status,
        statusText,
        found: true,
        codexId: codexIf(s, `d_${d.id}`),
        extraSearch: d.summary,
      }),
    );
  }
  return out;
}

function pickupEntities(ctx: Ctx, floor: FloorId): MapEntity[] {
  const { s } = ctx;
  const out: MapEntity[] = [];
  for (const p of PICKUPS) {
    if (p.floor !== floor) continue;
    const room = roomOf(floor, p.x, p.z);
    const visible = pickupVisible(s, p);
    const taken = s.taken[p.id] !== undefined;
    const located = !!s.flags[`peil_${p.id}`] && !taken;
    if (!((visible && ctx.visitedRoom(room, floor)) || located || taken)) continue;
    const category: MapCategory = isSlicePickup(p.id)
      ? "slice"
      : isCachePickup(p.id)
        ? "cache"
        : "item";
    let status: MapStatus;
    if (taken && !pickupAvailable(s, p)) status = p.respawn ? "respawning" : "taken";
    else if (!visible) status = "located";
    else if (p.puzzle && !s.puzzles[p.puzzle]) status = "locked";
    else if (pickupNeedsTool(s, p)) status = "partial";
    else status = "available";
    const left = status === "respawning" ? Math.ceil(pickupRespawnLeft(s, p)) : 0;
    const statusText =
      status === "respawning"
        ? tr("Refills in {n} s", { n: left })
        : status === "partial" && p.tool
          ? tr("More with {tool}", { tool: DEVICE_BY_ID.get(p.tool)?.name ?? p.tool })
          : STATUS_LABEL[status];
    out.push(
      makeEntity(ctx, {
        category,
        id: p.id,
        floor,
        x: p.x,
        z: p.z,
        room,
        name: p.label,
        status,
        statusText,
        found: taken,
        codexId: null,
      }),
    );
  }
  return out;
}

function noteEntities(ctx: Ctx, floor: FloorId): MapEntity[] {
  const { s } = ctx;
  const out: MapEntity[] = [];
  for (const n of NOTES) {
    if (n.floor !== floor) continue;
    const room = roomOf(floor, n.x, n.z);
    const read = !!s.read[n.id];
    if (!read && !(noteVisible(s, n.id) && ctx.visitedRoom(room, floor))) continue;
    const status: MapStatus = read ? "read" : "unread";
    out.push(
      makeEntity(ctx, {
        category: "note",
        id: n.id,
        floor,
        x: n.x,
        z: n.z,
        room,
        name: n.title,
        status,
        statusText: STATUS_LABEL[status],
        found: read,
        codexId: null,
        extraSearch: read ? n.body : undefined,
      }),
    );
  }
  return out;
}

function npcEntities(ctx: Ctx, floor: FloorId): MapEntity[] {
  const { s } = ctx;
  const out: MapEntity[] = [];
  for (const n of NPCS) {
    if (n.floor !== floor || !evalCond(s, n.visible)) continue;
    const room = roomOf(floor, n.x, n.z);
    const met = npcMet(s, n.id);
    if (!met && !ctx.visitedRoom(room, floor)) continue;
    const quest = BOT_QUEST_BY_NPC.get(n.id);
    const status: MapStatus = quest ? (s.flags[quest.flag] ? "awake" : "dormant") : "present";
    out.push(
      makeEntity(ctx, {
        category: "npc",
        id: n.id,
        floor,
        x: n.x,
        z: n.z,
        room,
        name: n.name,
        status,
        statusText: met
          ? STATUS_LABEL[status]
          : tr("{status} · not met yet", { status: STATUS_LABEL[status] }),
        found: met,
        codexId: codexIf(s, `p_${n.id}`),
      }),
    );
  }
  return out;
}

function propEntities(ctx: Ctx, floor: FloorId): MapEntity[] {
  const { s } = ctx;
  const out: MapEntity[] = [];
  for (const p of PROPS) {
    if (p.floor !== floor) continue;
    const room = roomOf(floor, p.x, p.z);
    if (!ctx.visitedRoom(room, floor)) continue;
    const usable = evalCond(s, p.requires);
    if (p.kind === "decor") {
      const hit = propDecorAction(p);
      if (!hit) continue;
      const ok = usable && evalCond(s, hit.action.requires);
      const status: MapStatus = !ok
        ? "blocked"
        : s.flags[seenFlag(hit.action.id)]
          ? "used"
          : "usable";
      out.push(
        makeEntity(ctx, {
          category: "decor",
          id: p.id,
          floor,
          x: p.x,
          z: p.z,
          room,
          name: p.label,
          status,
          statusText: STATUS_LABEL[status],
          found: status === "used",
          codexId: null,
        }),
      );
      continue;
    }
    let category: MapCategory;
    let status: MapStatus;
    if (p.kind === "elevator") {
      category = "elevator";
      status = "usable";
    } else if (p.kind === "terminal") {
      category = "terminal";
      status = usable ? "usable" : "blocked";
    } else if (p.kind === "puzzle") {
      category = "puzzle";
      status =
        p.puzzle && s.puzzles[p.puzzle]
          ? "solved"
          : usable && (!p.puzzle || puzzleAvailable(s, p.puzzle))
            ? "usable"
            : "blocked";
    } else {
      category = "station";
      const granted = !!p.grants?.length && p.grants.every((g) => !!s.insights[g]);
      status = !usable ? "blocked" : granted ? "used" : "usable";
    }
    out.push(
      makeEntity(ctx, {
        category,
        id: p.id,
        floor,
        x: p.x,
        z: p.z,
        room,
        name: p.label,
        status,
        statusText:
          status === "blocked" && p.requires
            ? tr("Needs: {cond}", { cond: describeCond(p.requires) })
            : STATUS_LABEL[status],
        found: status === "used" || status === "solved",
        codexId: null,
      }),
    );
  }
  return out;
}

function terminalEntities(ctx: Ctx, floor: FloorId): MapEntity[] {
  const { s } = ctx;
  return ROOM_TERMINALS.filter((t) => t.floor === floor && ctx.visitedRoom(t.room, floor)).map(
    (t) => {
      const status: MapStatus = evalCond(s, t.requires) ? "usable" : "blocked";
      return makeEntity(ctx, {
        category: "terminal",
        id: t.id,
        floor,
        x: t.x,
        z: t.z,
        room: t.room,
        name: t.label,
        status,
        statusText: STATUS_LABEL[status],
        found: false,
        codexId: null,
        extraSearch: t.purpose,
      });
    },
  );
}

function decorEntities(ctx: Ctx, floor: FloorId): MapEntity[] {
  const { s } = ctx;
  const out: MapEntity[] = [];
  for (const { placement: p, action } of DECOR_ACTION_PLACEMENTS.get(floor) ?? []) {
    if (!ctx.visitedRoom(p.room, floor)) continue;
    const status: MapStatus = !evalCond(s, action.requires)
      ? "blocked"
      : s.flags[seenFlag(action.id)]
        ? "used"
        : "usable";
    out.push(
      makeEntity(ctx, {
        category: "decor",
        id: p.id,
        floor,
        x: p.x + 0.5,
        z: p.z + 0.5,
        room: p.room,
        name: action.label,
        status,
        statusText: STATUS_LABEL[status],
        found: status === "used",
        codexId: null,
      }),
    );
  }
  return out;
}

function doorState(s: WorldState, d: DoorDef): DoorState | null {
  const open = doorIsOpen(s, d);
  if (d.secret) return open ? "secret" : s.insights.geheimtueren ? "suspected" : null;
  if (open) return "open";
  return d.keypad ? "keypad" : "locked";
}

const DOOR_STATUS: Record<Exclude<DoorState, "open">, MapStatus> = {
  locked: "door_locked",
  keypad: "door_keypad",
  secret: "door_secret",
  suspected: "door_suspected",
};

function doorHint(d: DoorDef): string | null {
  return d.lockHint ?? (d.lock ? describeCond(d.lock) : null);
}

/**
 * Build the whole map model (all floors). Prefer `mapModelCached`. With a
 * world `version` the objective sweep is shared with the HUD's cache.
 */
export function buildMapModel(s: WorldState, version?: number): MapModel {
  const visited = (id: string): boolean => !!s.flags[`visited_${id}`];
  const floorVisited = (f: FloorId): boolean =>
    s.floor === f || ROOMS.some((r) => r.floor === f && visited(r.id));
  const visitedRoom = (id: string | null, f: FloorId): boolean =>
    id ? visited(id) : floorVisited(f);

  const trackable = (version === undefined ? objectives(s) : objectivesCached(s, version)).filter(
    canTrack,
  );
  const objectiveAt = (floor: FloorId, x: number, z: number): string | null => {
    let best: string | null = null;
    let bestD = 7;
    for (const o of trackable) {
      const t = o.target!;
      if (t.floor !== floor) continue;
      const dist = Math.abs(t.x - x) + Math.abs(t.z - z);
      if (dist < bestD) {
        bestD = dist;
        best = o.id;
      }
    }
    return best;
  };
  const ctx: Ctx = { s, visitedRoom, objectiveAt };
  const p = power(s);

  const floors = {} as Record<FloorId, MapFloor>;
  const entities = new Map<string, MapEntity>();
  const roomIndex = new Map<string, MapRoom>();

  for (const f of FLOOR_IDS) {
    const def = FLOOR_BY_ID[f];
    const accessible = floorAccessible(s, f);
    const reach = reachableRooms(s, f);
    // Doors (hidden secret doors are left out entirely).
    const doors: MapDoor[] = [];
    const doorStates = new Map<string, DoorState>();
    for (const d of DOORS) {
      if (d.floor !== f) continue;
      const state = doorState(s, d);
      if (!state) continue;
      doorStates.set(d.id, state);
      doors.push({
        id: d.id,
        floor: f,
        x: d.x,
        z: d.z,
        axis: d.axis,
        width: d.width,
        state,
        hint: state === "open" || state === "secret" ? null : doorHint(d),
      });
    }
    // Rooms with fog.
    const rooms: MapRoom[] = [];
    for (const r of ROOMS) {
      if (r.floor !== f) continue;
      const isVisited = visited(r.id);
      const secret = SECRET_ROOMS.has(r.id);
      const touching = ROOM_DOORS.get(r.id) ?? [];
      if (secret && !isVisited && !touching.some((d) => doorStates.has(d.id))) continue;
      const bordersVisited = touching.some(
        (d) =>
          doorStates.has(d.id) &&
          ROOMS.some((o) => o.id !== r.id && visited(o.id) && doorTouches(d, o)),
      );
      const fog: RoomFog = isVisited
        ? "visited"
        : reach.has(r.id) || bordersVisited || (accessible && r.id.startsWith("aufzug"))
          ? "known"
          : "unknown";
      const room: MapRoom = {
        id: r.id,
        floor: f,
        name: r.name,
        code: ROOM_CODE.get(r.id) ?? r.id,
        x: r.x,
        z: r.z,
        w: r.w,
        d: r.d,
        outline: roomOutline(floorGeomOf(f), r.id),
        ax: roomAnchor(r.id)?.x ?? r.x + r.w / 2,
        az: roomAnchor(r.id)?.z ?? r.z + r.d / 2,
        theme: r.theme ?? "generic",
        fog,
        lit: p.generation >= 50 && (!r.litBy || p.online.has(r.litBy)),
        secret,
        blurb: r.blurb,
        codexId: codexIf(s, `o_${r.id}`),
      };
      rooms.push(room);
      roomIndex.set(`room:${r.id}`, room);
    }
    const list: MapEntity[] = [
      ...deviceEntities(ctx, f),
      ...pickupEntities(ctx, f),
      ...noteEntities(ctx, f),
      ...npcEntities(ctx, f),
      ...propEntities(ctx, f),
      ...terminalEntities(ctx, f),
      ...decorEntities(ctx, f),
    ];
    for (const d of DOORS) {
      const state = doorStates.get(d.id);
      if (d.floor !== f || !state || state === "open") continue;
      const status = DOOR_STATUS[state];
      list.push(
        makeEntity(ctx, {
          category: "door",
          id: d.id,
          floor: f,
          x: d.x,
          z: d.z,
          room: null,
          name: d.keypad ? tr("Keypad door") : d.secret ? tr("Secret door") : tr("Locked door"),
          status,
          statusText:
            state === "locked" || state === "keypad"
              ? (doorHint(d) ?? STATUS_LABEL[status])
              : STATUS_LABEL[status],
          found: false,
          codexId: null,
        }),
      );
    }
    for (const e of list) entities.set(e.key, e);
    floors[f] = {
      id: f,
      name: def.name,
      short: def.short,
      accessible,
      visited: floorVisited(f),
      rooms,
      doors,
      entities: list,
      progress: floorProgress(s, f),
    };
  }

  const shaft: ShaftStop[] = FLOORS_TOP_DOWN.map((def) => ({
    floor: def.id,
    name: def.name,
    short: def.short,
    accessible: floorAccessible(s, def.id),
    hint: FLOOR_ACCESS[def.id].hint,
    ladder: def.id === 0 || def.id === 1,
    visited: floors[def.id].visited,
  }));

  return {
    floors,
    order: FLOORS_TOP_DOWN.map((d) => d.id),
    shaft,
    entities,
    rooms: roomIndex,
    current: s.floor,
    trackedId: trackedObjectiveId(s),
    pin: mapPin(s),
  };
}

/** Found / total per category on one floor (totals include what is still hidden). */
export function floorProgress(s: WorldState, f: FloorId): FloorProgress {
  const count = <T>(list: readonly T[], found: (x: T) => boolean): ProgressCount => ({
    found: list.filter(found).length,
    total: list.length,
  });
  const pickups = PICKUPS.filter((p) => p.floor === f);
  return {
    rooms: count(
      ROOMS.filter((r) => r.floor === f),
      (r) => !!s.flags[`visited_${r.id}`],
    ),
    devices: count(
      DEVICES.filter((d) => DEVICE_FLOOR.get(d.id) === f),
      (d) => !!s.discovered[d.id],
    ),
    notes: count(
      NOTES.filter((n) => n.floor === f),
      (n) => !!s.read[n.id],
    ),
    slices: count(
      pickups.filter((p) => isSlicePickup(p.id)),
      (p) => s.taken[p.id] !== undefined,
    ),
    caches: count(
      pickups.filter((p) => isCachePickup(p.id)),
      (p) => s.taken[p.id] !== undefined || (!!p.puzzle && !!s.puzzles[p.puzzle]),
    ),
    items: count(
      pickups.filter((p) => !isSlicePickup(p.id) && !isCachePickup(p.id) && !p.respawn),
      (p) => s.taken[p.id] !== undefined,
    ),
    people: count(
      NPCS.filter((n) => n.floor === f),
      (n) => npcMet(s, n.id),
    ),
  };
}

const modelCache = new WeakMap<WorldState, { key: string; model: MapModel }>();

/**
 * `buildMapModel(s)`, computed once per world version. The world state is
 * mutated in place, so the caller passes its change counter (`useWorld`
 * version). Treat the result as read-only.
 */
export function mapModelCached(s: WorldState, version: number): MapModel {
  const key = `${version}:${s.floor}`;
  const hit = modelCache.get(s);
  if (hit && hit.key === key) return hit.model;
  const model = buildMapModel(s, version);
  modelCache.set(s, { key, model });
  return model;
}

// ── Queries ──────────────────────────────────────────────────────

/** Entities whose category is in `cats`. */
export function filterEntities(
  list: readonly MapEntity[],
  cats: ReadonlySet<MapCategory>,
): MapEntity[] {
  return list.filter((e) => cats.has(e.category));
}

export interface MapSearchHit {
  /** Entity key or `room:<id>`. */
  key: string;
  floor: FloorId;
  name: string;
  kind: MapCategory | "room";
  statusText: string;
  x: number;
  z: number;
}

/**
 * Search all floors (entities and non-hidden rooms; unknown rooms only by
 * code). Every word must match. Current floor first, then top-down.
 */
export function searchMap(model: MapModel, query: string, limit = 40): MapSearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: MapSearchHit[] = [];
  const floors = [model.current, ...model.order.filter((f) => f !== model.current)];
  for (const f of floors) {
    const fl = model.floors[f];
    for (const r of fl.rooms) {
      const text =
        r.fog === "unknown" ? r.code.toLowerCase() : haystack(r.name, r.code, r.id, r.blurb);
      if (words.every((w) => text.includes(w)))
        hits.push({
          key: `room:${r.id}`,
          floor: f,
          name: r.fog === "unknown" ? `${r.code} · ?` : `${r.code} · ${r.name}`,
          kind: "room",
          statusText: ROOM_FOG_LABEL[r.fog],
          x: r.ax,
          z: r.az,
        });
    }
    for (const e of fl.entities)
      if (words.every((w) => e.search.includes(w)))
        hits.push({
          key: e.key,
          floor: f,
          name: e.name,
          kind: e.category,
          statusText: e.statusText,
          x: e.x,
          z: e.z,
        });
  }
  return hits.slice(0, limit);
}

export const ROOM_FOG_LABEL: Record<RoomFog, string> = {
  visited: tr("map::Explored"),
  known: tr("map::Known, not entered"),
  unknown: tr("map::Unexplored"),
};

/** Categories listed in "Found". */
export const FOUND_CATEGORIES: readonly MapCategory[] = [
  "device",
  "slice",
  "cache",
  "item",
  "note",
  "npc",
];

/** Found entities of one floor, grouped by category (only non-empty groups). */
export function foundByCategory(fl: MapFloor): { category: MapCategory; entities: MapEntity[] }[] {
  return FOUND_CATEGORIES.map((category) => ({
    category,
    entities: fl.entities
      .filter((e) => e.category === category && e.found)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.entities.length > 0);
}

/** Sum of the progress of all floors. */
export function totalProgress(model: MapModel): FloorProgress {
  const keys: (keyof FloorProgress)[] = [
    "rooms",
    "devices",
    "notes",
    "slices",
    "caches",
    "items",
    "people",
  ];
  const out = {} as FloorProgress;
  for (const k of keys) {
    out[k] = { found: 0, total: 0 };
    for (const f of model.order) {
      out[k].found += model.floors[f].progress[k].found;
      out[k].total += model.floors[f].progress[k].total;
    }
  }
  return out;
}

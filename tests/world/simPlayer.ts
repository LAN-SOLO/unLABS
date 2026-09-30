/**
 * Greedy simulated player shared by the playthrough and connectivity tests.
 * =========================================================================
 *
 * Uses only what a real player can reach — reachable pickups, notes,
 * props, NPC dialogue (incl. bot deliveries), device panels (use, hosted
 * puzzles, drone, research), recipes, trait prototypes and building — no
 * cheats. Puzzles count as solved the moment their host is reachable (the
 * minigames themselves are tested separately). Records every event that
 * could trigger a scene, so scene wiring can be checked against real play.
 *
 * Lab systems (`runSystems`): the player searches every reachable archive
 * spot (reads boards, searches lockers and vents, reads device INFO pages,
 * answers archive combinations once all their finds are in), links devices
 * to hubs (a standing policy per hub plus every link a build stage asks
 * for) and flashes every lab update it can: `manual` images with the
 * checksum parsed from an archive entry it has found, `net` / `mcp` images
 * by linking the device to NET-001 / MCP-000 for the download.
 */
import { evaluateAchievements } from "@/lib/world/achievements";
import {
  ARCHIVE,
  ARCHIVE_BY_ID,
  combine as combineArchive,
  openCombos,
  spotKey,
  visitSpot,
} from "@/lib/world/archive";
import { combine } from "@/lib/world/combine";
import type { ArchiveSpot } from "@/lib/world/content/archive";
import { WORLD_FIRMWARE } from "@/lib/world/content/firmware";
import { HUBS } from "@/lib/world/content/links";
import { ROOM_TERMINALS } from "@/lib/world/content/terminals";
import {
  canLink,
  flashFirmware,
  hubCapacity,
  linkDevice,
  unlinkDevice,
} from "@/lib/world/device-ops";
import { hasFeature, isUpdated } from "@/lib/world/firmware";
import { isLinked, linksOf } from "@/lib/world/links";
import { DEVICES, DEVICE_BY_ID, DEVICE_PUZZLES } from "@/lib/world/content/devices";
import { ITEM_BY_ID, RECIPES } from "@/lib/world/content/items";
import {
  FLOORS,
  FLOOR_ACCESS,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  ROOM_BY_ID,
  SLICE_PICKUPS,
  roomAt,
} from "@/lib/world/content/map";
import { BOT_QUESTS, ENDINGS, NPCS } from "@/lib/world/content/story";
import {
  buildStage,
  checkStage,
  chooseDialogue,
  count,
  dialogueOptions,
  doCombine,
  droneReady,
  endingsAt,
  evalCond,
  flyDrone,
  floorAccessible,
  grant,
  initialState,
  isBuilt,
  isOnline,
  isProtected,
  isSwitchedOn,
  keypadDoorsReachable,
  maxCombineInputs,
  noteVisible,
  operateDevice,
  pickupAvailable,
  power,
  puzzleAvailable,
  reachEnding,
  reachableRooms,
  readNote,
  saidKey,
  recipeAvailable,
  solvePuzzle,
  stagesDone,
  takePickup,
  toggleDevice,
} from "@/lib/world/game";
import type { SceneTrigger } from "@/lib/world/scenes";
import { meetsTraits } from "@/lib/world/traits";
import { TEXTILE_ITEMS } from "@/lib/world/content/wardrobe";

const isTextile = (id: string): boolean => (TEXTILE_ITEMS as readonly string[]).includes(id);
import type { Condition, FloorId, Requirement, WorldState } from "@/lib/world/types";

export const FLOOR_IDS: FloorId[] = FLOORS.map((f) => f.id);

export function floorOf(roomId: string): FloorId {
  return ROOM_BY_ID.get(roomId)?.floor ?? 0;
}

export function inReach(s: WorldState, floor: FloorId, x: number, z: number): boolean {
  const room = roomAt(floor, x, z);
  return !!room && floorAccessible(s, floor) && reachableRooms(s, floor).has(room.id);
}

export function deviceSpot(id: string): { floor: FloorId; x: number; z: number } {
  const d = DEVICE_BY_ID.get(id)!;
  return { floor: floorOf(d.room), x: d.x, z: d.z };
}

/** Where an ending is triggered: its device, or the Infinity-Forge prop. */
export function endingSpot(device: string): { floor: FloorId; x: number; z: number } {
  if (DEVICE_BY_ID.has(device)) return deviceSpot(device);
  const p = PROPS.find((x) => x.kind === device || x.id === device)!;
  return { floor: p.floor, x: p.x, z: p.z };
}

/** Craft an authored recipe output (recursively crafting missing inputs). */
export function tryCraft(s: WorldState, item: string, depth = 0): boolean {
  if (depth > 4) return false;
  const recipe = RECIPES.find(
    (r) => r.output === item && !(r.inputs[item] > 0) && recipeAvailable(s, r),
  );
  if (!recipe) return false;
  const total = Object.values(recipe.inputs).reduce((a, b) => a + b, 0);
  if (total > maxCombineInputs(s)) return false;
  for (const [id, n] of Object.entries(recipe.inputs)) {
    let guard = 0;
    while (count(s, id) < n && guard++ < 8) if (!tryCraft(s, id, depth + 1)) return false;
  }
  return doCombine(s, recipe.inputs).ok;
}

/** Find a 2–3 item prototype combination that satisfies a trait-only slot. */
export function tryTraitCombo(s: WorldState, req: Requirement): boolean {
  const pool = Object.keys(s.inventory).filter((id) => {
    const d = ITEM_BY_ID.get(id) ?? s.generated[id];
    // Textiles are for the wardrobe replicator; a player never builds devices from fabric.
    return d && d.kind !== "relikt" && d.kind !== "schlacke" && !isProtected(id) && !isTextile(id);
  });
  const tries: Record<string, number>[] = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i; j < pool.length; j++) {
      tries.push(i === j ? { [pool[i]!]: 2 } : { [pool[i]!]: 1, [pool[j]!]: 1 });
      for (let k = j; k < pool.length && k < j + 6; k++) {
        const t: Record<string, number> = {};
        for (const id of [pool[i]!, pool[j]!, pool[k]!]) t[id] = (t[id] ?? 0) + 1;
        tries.push(t);
      }
    }
  for (const t of tries) {
    if (Object.entries(t).some(([id, n]) => count(s, id) < n)) continue;
    const res = combine(t, s.generated, (d) => isOnline(s, d));
    if (
      res.kind === "prototype" &&
      res.output &&
      req.traits &&
      meetsTraits(res.output.traits, req.traits)
    ) {
      return doCombine(s, t).ok;
    }
  }
  return false;
}

/** Talk to an NPC; deliver quest items when they can be crafted or are at hand. */
export function talk(s: WorldState, npcId: string): void {
  for (const o of dialogueOptions(s, npcId)) {
    const spare = (o.takes ?? []).every((t) => {
      if (count(s, t.item) < t.count) tryCraft(s, t.item);
      return count(s, t.item) >= t.count;
    });
    if (spare) chooseDialogue(s, npcId, o.label);
  }
}

export interface Snapshot {
  online: Set<string>;
  stages: Record<string, number>;
  insights: Set<string>;
  endings: Set<string>;
  /** Bots whose `bot_<id>_awake` flag is set. */
  bots: Set<string>;
  /** Floors with at least one visited room (the player has been there). */
  floors: Set<FloorId>;
}

export function snapshot(s: WorldState): Snapshot {
  return {
    online: new Set(power(s).online),
    stages: Object.fromEntries(DEVICES.map((d) => [d.id, stagesDone(s, d.id)])),
    insights: new Set(Object.keys(s.insights)),
    endings: new Set(Object.keys(s.endings)),
    bots: new Set(BOT_QUESTS.filter((q) => s.flags[q.flag]).map((q) => q.npc)),
    floors: new Set(
      Object.keys(s.flags)
        .filter((f) => f.startsWith("visited_") && s.flags[f])
        .map((f) => floorOf(f.slice("visited_".length))),
    ),
  };
}

/** The same state diff → scene trigger mapping the lab director uses. */
export function diffTriggers(before: Snapshot, now: Snapshot): SceneTrigger[] {
  const out: SceneTrigger[] = [];
  for (const id of now.online) if (!before.online.has(id)) out.push({ kind: "device_online", id });
  for (const [id, n] of Object.entries(now.stages))
    if ((before.stages[id] ?? 0) < n) out.push({ kind: "stage_built", id, stage: n });
  for (const id of now.insights) if (!before.insights.has(id)) out.push({ kind: "insight", id });
  for (const id of now.endings) if (!before.endings.has(id)) out.push({ kind: "ending", id });
  for (const id of now.bots) if (!before.bots.has(id)) out.push({ kind: "bot_awake", id });
  for (const floor of now.floors)
    if (!before.floors.has(floor)) out.push({ kind: "floor_reached", floor });
  return out;
}

export interface SimRun {
  s: WorldState;
  steps: number;
  triggers: SceneTrigger[];
  /** Options chosen at least once, as "npc:label". */
  said: Set<string>;
  /** Objective checks collected along the way (see connectivity test). */
  samples: WorldState[];
}

export interface SimOptions {
  maxSteps?: number;
  /** Clone the state every N steps into `samples`. */
  sampleEvery?: number;
  /** Stop condition (default: all endings, bots and slices). */
  done?: (s: WorldState) => boolean;
}

/** Walk every reachable room (the UI sets visited_<room> on entering). */
function visitRooms(s: WorldState): void {
  for (const f of FLOOR_IDS) {
    if (!floorAccessible(s, f)) continue;
    for (const id of reachableRooms(s, f)) s.flags[`visited_${id}`] = true;
  }
}

// ── Lab systems: archive, links, firmware ────────────────────────

interface SpotAt {
  spot: ArchiveSpot;
  floor: FloorId;
  room: string;
  mode: "search" | "device";
  /** Extra precondition of using the spot (prop / terminal gates, note read, device online). */
  usable: (s: WorldState) => boolean;
}

function roomOf(floor: FloorId, x: number, z: number): string {
  return roomAt(floor, x, z)?.id ?? "";
}

/** Every archive spot with where it is (one per spot). */
const ARCHIVE_SPOTS: readonly SpotAt[] = (() => {
  const out = new Map<string, SpotAt>();
  for (const e of ARCHIVE) {
    const at = e.at;
    if (!at || out.has(spotKey(at))) continue;
    let sp: SpotAt | undefined;
    if ("decor" in at) {
      // Placement ids are "decor:<room>:<slot>…" (content/interior.ts) — no need
      // to generate the interiors (slow) just to find the room.
      const room = ROOM_BY_ID.get(at.decor.split(":")[1] ?? "");
      if (room)
        sp = { spot: at, floor: room.floor, room: room.id, mode: "search", usable: () => true };
    } else if ("prop" in at) {
      const p = PROPS.find((x) => x.id === at.prop);
      if (p)
        sp = {
          spot: at,
          floor: p.floor,
          room: roomOf(p.floor, p.x, p.z),
          mode: "search",
          usable: (s) => evalCond(s, p.requires),
        };
    } else if ("note" in at) {
      const n = NOTES.find((x) => x.id === at.note);
      if (n)
        sp = {
          spot: at,
          floor: n.floor,
          room: roomOf(n.floor, n.x, n.z),
          mode: "search",
          usable: (s) => !!s.read[n.id],
        };
    } else if ("terminal" in at) {
      const t = ROOM_TERMINALS.find((x) => x.id === at.terminal);
      if (t)
        sp = {
          spot: at,
          floor: t.floor,
          room: t.room,
          mode: "search",
          usable: (s) => evalCond(s, t.requires),
        };
    } else {
      const d = DEVICE_BY_ID.get(at.device);
      if (d)
        sp = {
          spot: at,
          floor: floorOf(d.room),
          room: d.room,
          mode: "device",
          usable: (s) => isOnline(s, d.id),
        };
    }
    if (sp) out.set(spotKey(at), sp);
  }
  return [...out.values()];
})();

/**
 * Visit every reachable archive spot (reading and searching everything, like
 * a thorough player) and answer archive combinations whose finds are all in.
 */
export function visitArchive(s: WorldState): void {
  const reach = new Map<FloorId, Set<string>>();
  for (const f of FLOOR_IDS) reach.set(f, floorAccessible(s, f) ? reachableRooms(s, f) : new Set());
  for (const sp of ARCHIVE_SPOTS) {
    if (!reach.get(sp.floor)?.has(sp.room) || !sp.usable(s)) continue;
    visitSpot(s, sp.spot, sp.mode);
  }
  for (const e of openCombos(s)) if (e.answer) combineArchive(s, e.answer);
}

/**
 * The checksum of a device's service image, if the player has found it: the
 * first 8-character hex token on a line of a found archive entry that names
 * the device (e.g. "NET-001 · service image 2.2.0 · CRC B4E9F3A7").
 */
export function knownChecksum(s: WorldState, id: string): string | undefined {
  for (const found of Object.keys(s.archive)) {
    const text = ARCHIVE_BY_ID.get(found)?.text ?? "";
    for (const line of text.split("\n")) {
      if (!line.includes(id)) continue;
      const m = /\b([0-9A-F]{8})\b/.exec(line);
      if (m) return m[1];
    }
  }
  return undefined;
}

/** Links a build stage asks for (`{link, to}` in stage conditions) — never unlinked. */
function condLinks(c: Condition | undefined, out: [string, string][]): void {
  if (!c) return;
  if ("all" in c) c.all.forEach((x) => condLinks(x, out));
  else if ("any" in c) c.any.forEach((x) => condLinks(x, out));
  else if ("link" in c) out.push([c.link, c.to]);
}
const GATE_LINKS: readonly [string, string][] = (() => {
  const out: [string, string][] = [];
  for (const d of DEVICES) for (const st of d.stages) condLinks(st.when, out);
  return out;
})();
const KEEP = new Set(GATE_LINKS.map(([h, t]) => `${h}>${t}`));

/** What the simulated player keeps linked to each hub (standing policy). */
export const HUB_POLICY: Readonly<Record<string, readonly string[]>> = {
  "MCP-000": ["CLK-001", "VNT-001"],
  "NET-001": ["UEC-001", "BAT-001", "EXD-001"],
  "PWR-001": ["TLP-001", "SCA-001", "QAN-001", "AIC-001", "DIM-001", "EMC-001"],
  "THM-001": ["TLP-001", "QAN-001", "P3D-001", "LCT-001", "SCA-001", "EXD-001"],
  "DGN-001": ["UEC-001", "NET-001", "ECR-001", "MFR-001", "SCA-001", "TLP-001"],
  "SCA-001": ["AIC-001", "QAN-001", "QSM-001", "EMC-001"],
};

/** Link `to` to `hub`, freeing a policy port first if the hub is full. */
function ensureLink(s: WorldState, hub: string, to: string): boolean {
  if (isLinked(s, hub, to)) return true;
  if (linksOf(s, hub).length >= hubCapacity(s, hub)) {
    const spare = linksOf(s, hub).find((x) => !KEEP.has(`${hub}>${x}`));
    if (spare) unlinkDevice(s, hub, spare);
  }
  return linkDevice(s, hub, to).ok;
}

/** Flash `id` through a hub download (net / mcp), unlinking again unless the link is kept. */
function flashVia(s: WorldState, hub: string, id: string): void {
  const had = isLinked(s, hub, id);
  if (!had && !ensureLink(s, hub, id)) return;
  flashFirmware(s, id);
  const policy = HUB_POLICY[hub] ?? [];
  if (!had && !KEEP.has(`${hub}>${id}`) && !policy.includes(id)) unlinkDevice(s, hub, id);
}

/**
 * Links and firmware: the hub policy, every link a build stage asks for,
 * and every lab update that can be flashed now (hubs and devices in reach).
 */
export function runSystems(s: WorldState): void {
  const here = (id: string) => {
    const at = deviceSpot(id);
    return inReach(s, at.floor, at.x, at.z);
  };
  for (const h of HUBS) {
    if (!isOnline(s, h.id) || !here(h.id)) continue;
    for (const to of HUB_POLICY[h.id] ?? [])
      if (linksOf(s, h.id).length < hubCapacity(s, h.id) && canLink(s, h.id, to).ok)
        linkDevice(s, h.id, to);
  }
  for (const [hub, to] of GATE_LINKS)
    if (!isLinked(s, hub, to) && isBuilt(s, to) && isOnline(s, hub) && here(hub))
      ensureLink(s, hub, to);
  for (const [id, w] of Object.entries(WORLD_FIRMWARE)) {
    if (isUpdated(s, id) || !isOnline(s, id) || !here(id)) continue;
    if (w.source === "manual") {
      const sum = knownChecksum(s, id);
      if (sum) flashFirmware(s, id, sum);
    } else if (w.source === "net") {
      if (isOnline(s, "NET-001") && hasFeature(s, "NET-001", "fw-mirror"))
        flashVia(s, "NET-001", id);
    } else if (isOnline(s, "MCP-000")) flashVia(s, "MCP-000", id);
  }
}

export function step(run: SimRun): void {
  const s = run.s;
  const before = snapshot(s);
  for (const f of FLOOR_IDS) {
    const acc = FLOOR_ACCESS[f];
    // Elevator keypad: offered once 100 W are on the bus (see ElevatorPanel).
    if (!floorAccessible(s, f) && acc.keypad && power(s).generation >= 100)
      solvePuzzle(s, acc.keypad);
    if (!floorAccessible(s, f)) continue;
    for (const d of keypadDoorsReachable(s, f)) solvePuzzle(s, d.keypad!);
    for (const p of PICKUPS) {
      if (p.floor !== f || !inReach(s, f, p.x, p.z) || !pickupAvailable(s, p)) continue;
      if (p.puzzle && !s.puzzles[p.puzzle] && !puzzleAvailable(s, p.puzzle)) continue;
      if (p.puzzle) solvePuzzle(s, p.puzzle);
      takePickup(s, p.id);
    }
    for (const n of NOTES)
      if (n.floor === f && !s.read[n.id] && noteVisible(s, n.id) && inReach(s, f, n.x, n.z))
        readNote(s, n.id);
    for (const p of PROPS) {
      if (p.floor !== f || !inReach(s, f, p.x, p.z) || !evalCond(s, p.requires)) continue;
      if (p.puzzle) solvePuzzle(s, p.puzzle);
      grant(s, p.grants);
    }
    for (const npc of NPCS) {
      if (npc.floor !== f || !evalCond(s, npc.visible) || !inReach(s, f, npc.x, npc.z)) continue;
      const offered = dialogueOptions(s, npc.id);
      talk(s, npc.id);
      for (const o of offered)
        if (s.flags[saidKey(npc.id, o)]) run.said.add(`${npc.id}:${o.label}`);
    }
  }
  visitRooms(s);
  visitArchive(s);
  runSystems(s);
  for (const d of DEVICES) {
    const at = deviceSpot(d.id);
    if (!isOnline(s, d.id) || !inReach(s, at.floor, at.x, at.z)) continue;
    operateDevice(s, d.id);
    for (const dp of DEVICE_PUZZLES[d.id] ?? [])
      if (evalCond(s, dp.requires)) solvePuzzle(s, dp.puzzle);
  }
  if (isOnline(s, "EXD-001") && droneReady(s)) flyDrone(s);
  for (const d of DEVICES) {
    const at = deviceSpot(d.id);
    if (!s.discovered[d.id] || isBuilt(s, d.id) || !inReach(s, at.floor, at.x, at.z)) continue;
    for (let guard = 0; guard < 3 && !isBuilt(s, d.id); guard++) {
      const c = checkStage(s, d.id)!;
      const stage = d.stages[c.stageIndex]!;
      if (stage.puzzle && !s.puzzles[stage.puzzle]) solvePuzzle(s, stage.puzzle);
      c.assignment.forEach((a, i) => {
        if (a) return;
        const req = stage.requires[i]!;
        const need = req.count ?? 1;
        for (let k = 0; k < need; k++) {
          if (req.item && tryCraft(s, req.item)) continue;
          if (req.traits) tryTraitCombo(s, req);
        }
      });
      if (!buildStage(s, d.id).ok) break;
    }
  }
  for (const e of ENDINGS) {
    const at = endingSpot(e.device);
    if (s.endings[e.id] || !inReach(s, at.floor, at.x, at.z)) continue;
    const ready = () => endingsAt(s, e.device).find((x) => x.ending.id === e.id)?.ready ?? false;
    if (!ready() && DEVICE_BY_ID.has(e.device) && isBuilt(s, e.device) && !isOnline(s, e.device)) {
      // Brownout: shed everything the ending does not need, like a player would.
      const keep = new Set([e.device, "THM-001", "PWR-001", "BAT-001", "MCP-000"]);
      const shed = DEVICES.filter((d) => d.power > 0 && !keep.has(d.id) && isSwitchedOn(s, d.id));
      for (const d of shed) toggleDevice(s, d.id);
      if (ready()) reachEnding(s, e.id);
      for (const d of shed) toggleDevice(s, d.id);
    } else if (ready()) reachEnding(s, e.id);
  }
  evaluateAchievements(s);
  run.triggers.push(...diffTriggers(before, snapshot(s)));
  s.playTime += 60;
}

export function defaultDone(s: WorldState): boolean {
  return (
    Object.keys(s.endings).length >= ENDINGS.length &&
    BOT_QUESTS.every((q) => s.flags[q.flag]) &&
    SLICE_PICKUPS.every((id) => s.taken[id] !== undefined)
  );
}

export function play(opts: SimOptions = {}, run?: SimRun): SimRun {
  const r: SimRun = run ?? {
    s: initialState(),
    steps: 0,
    triggers: [{ kind: "start" }],
    said: new Set(),
    samples: [],
  };
  const done = opts.done ?? defaultDone;
  const max = opts.maxSteps ?? 600;
  for (let i = 0; i < max && !done(r.s); i++) {
    step(r);
    r.steps += 1;
    if (opts.sampleEvery && r.steps % opts.sampleEvery === 0) r.samples.push(structuredClone(r.s));
  }
  return r;
}

/** Rooms that are not elevator shafts (the Kartograf achievement counts these). */
export const VISITABLE_ROOMS = ROOMS.filter((r) => r.theme !== "elevator").map((r) => r.id);

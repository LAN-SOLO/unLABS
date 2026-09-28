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
 */
import { evaluateAchievements } from "@/lib/world/achievements";
import { combine } from "@/lib/world/combine";
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
import type { FloorId, Requirement, WorldState } from "@/lib/world/types";

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
    return d && d.kind !== "relikt" && d.kind !== "schlacke" && !isProtected(id);
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

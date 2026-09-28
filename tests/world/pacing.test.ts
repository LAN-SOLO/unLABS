/**
 * Pacing — a "realistic player" playthrough with a clock.
 * =======================================================
 *
 * Unlike the greedy 60-s-step player in `simPlayer.ts`, this player walks.
 * Every action has a location and a duration: walking at 13 voxels/s
 * (Manhattan distance, via the elevator shaft between floors), elevator
 * rides 3 s, notes 8 s, puzzles 30–90 s by kind, combining 5 s per step.
 * It only acts on what a player can know: rooms it has walked into (and
 * their pickups, notes, props and NPCs), unexplored rooms behind open
 * doors, open blueprints from the journal, and the compass target from
 * `quests.ts`, which it prefers. When nothing is left it collects
 * refilling containers it needs, and otherwise waits.
 *
 * Alongside it runs the real bark engine (1 Hz tick + event barks) and
 * the tutorial hint poller, with the intro and other cinematics blocking
 * both, so bark/hint density can be measured.
 *
 * Prints a pacing report and asserts sane bounds.
 */
import { describe, expect, it, vi } from "vitest";
import { dailyPriceModifier } from "@/lib/game/volatility";
import { evaluateAchievements } from "@/lib/world/achievements";
import { BarkEngine, type BarkContext, type BarkTrigger } from "@/lib/world/barks";
import { DEVICES, DEVICE_BY_ID, DEVICE_PUZZLES } from "@/lib/world/content/devices";
import { combine } from "@/lib/world/combine";
import { ITEM_BY_ID, RECIPES } from "@/lib/world/content/items";
import {
  ELEVATORS,
  FLOOR_ACCESS,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  SLICE_PICKUPS,
  SPAWN,
  roomAt,
} from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { DEVICE_INSIGHTS, ENDINGS, INSIGHT_BY_ID, NPCS } from "@/lib/world/content/story";
import {
  RESEARCH_COOLDOWN,
  RESEARCH_TOPICS,
  DRONE_COOLDOWN,
  autoAssign,
  buildStage,
  checkStage,
  count,
  dialogueOptions,
  doCombine,
  isProtected,
  itemFits,
  maxCombineInputs,
  droneReady,
  endingsAt,
  evalCond,
  floorAccessible,
  flyDrone,
  grant,
  initialState,
  isBuilt,
  isOnline,
  isSwitchedOn,
  keypadDoorsReachable,
  noteVisible,
  operateDevice,
  pickupAvailable,
  pickupNeedsTool,
  power,
  puzzleAvailable,
  reachEnding,
  recipeAvailable,
  reachableRooms,
  readNote,
  researchFlag,
  researchReady,
  solvePuzzle,
  takePickup,
  toggleDevice,
} from "@/lib/world/game";
import { compassTarget, topObjective } from "@/lib/world/quests";
import { sceneDuration, sceneFor, sceneSeenFlag, type SceneTrigger } from "@/lib/world/scenes";
import { markHintSeen, nextHint, type TutorialContext } from "@/lib/world/tutorial";
import { traitTotal } from "@/lib/world/traits";
import type { FloorId, ItemDef, PuzzleKind, Requirement, WorldState } from "@/lib/world/types";
import {
  FLOOR_IDS,
  defaultDone,
  deviceSpot,
  diffTriggers,
  endingSpot,
  inReach,
  snapshot,
  talk,
} from "./simPlayer";

// ── Timing model ─────────────────────────────────────────────────

const WALK_SPEED = 13;
const ELEVATOR_RIDE = 3;
const NOTE_TIME = 8;
const COMBINE_TIME = 5;
const PICKUP_TIME = 2;
const BUILD_TIME = 6;
const TALK_TIME = 6;
const USE_TIME = 4;
/** Hard stop for the simulation (play seconds). */
const MAX_TIME = 8 * 3600;

const PUZZLE_TIME: Record<PuzzleKind, number> = {
  keypad: 30,
  valve: 35,
  pipes: 75,
  lissajous: 60,
  cipher: 90,
  tones: 45,
  heat: 50,
  coolant: 60,
  crc: 60,
  sigils: 75,
  temporal: 45,
  laser: 90,
  hue: 40,
  era: 60,
  arbitrage: 60,
  ethics: 45,
  memetic: 60,
  stencil: 60,
  clamp: 45,
  trend: 50,
  palette: 60,
  layers: 60,
  solder: 60,
  wiring: 75,
  morse: 60,
  radio: 60,
};

function puzzleTime(id: string): number {
  const p = PUZZLE_BY_ID.get(id);
  return p ? PUZZLE_TIME[p.kind] : 60;
}

// ── Positions ────────────────────────────────────────────────────

interface Pos {
  floor: FloorId;
  x: number;
  z: number;
}

const ELEVATOR_AT = ELEVATORS[0]!;

function manhattan(ax: number, az: number, bx: number, bz: number): number {
  return Math.abs(ax - bx) + Math.abs(az - bz);
}

/** Walking time (+ elevator ride when the floor changes). */
function travelTime(a: Pos, b: Pos): number {
  if (a.floor === b.floor) return manhattan(a.x, a.z, b.x, b.z) / WALK_SPEED;
  const d =
    manhattan(a.x, a.z, ELEVATOR_AT.x, ELEVATOR_AT.z) +
    manhattan(ELEVATOR_AT.x, ELEVATOR_AT.z, b.x, b.z);
  return d / WALK_SPEED + ELEVATOR_RIDE;
}

// ── Tasks ────────────────────────────────────────────────────────

type TaskKind =
  | "explore"
  | "pickup"
  | "respawn"
  | "note"
  | "puzzle"
  | "prop"
  | "talk"
  | "build"
  | "use"
  | "research"
  | "drone"
  | "ending";

interface Task {
  kind: TaskKind;
  id: string;
  at: Pos;
  /** Seconds spent at the target. */
  dur: number;
  value: number;
  /** Overlay shown while doing it (for the hint poller). */
  overlay?: string;
  focus?: { kind: string; id: string };
  run: (s: WorldState) => void;
}

/** Progress kinds count towards "the player is getting somewhere". */
const PROGRESS: ReadonlySet<TaskKind> = new Set([
  "puzzle",
  "prop",
  "talk",
  "build",
  "use",
  "ending",
  "note",
]);

/** Items the open blueprints still miss (incl. recipe inputs, two levels deep). */
function neededItems(s: WorldState): Set<string> {
  const need = new Set<string>();
  const expand = (id: string, depth: number) => {
    if (need.has(id) || depth > 3) return;
    need.add(id);
    for (const r of RECIPES)
      if (r.output === id) for (const k of Object.keys(r.inputs)) expand(k, depth + 1);
  };
  for (const d of DEVICES) {
    if (!s.discovered[d.id] || isBuilt(s, d.id) || !d.needs.every((n) => isBuilt(s, n))) continue;
    const c = checkStage(s, d.id);
    if (!c || c.complete) continue;
    const stage = d.stages[c.stageIndex]!;
    const a = autoAssign(s, stage.requires);
    stage.requires.forEach((req, i) => {
      if (a[i]) return;
      if (req.item) expand(req.item, 0);
      // Trait-only slots: energy / quantum sources.
      else if (req.traits?.energie) expand("energiezelle", 0);
      else if (req.traits?.quantum) expand("qubit_chip", 0);
      else if (req.traits?.mechanik) expand("rahmen", 0);
    });
  }
  // Ingredients of research-gated / station recipes the player may be aiming for.
  if (need.has("energiezelle")) need.add("abstractum");
  return need;
}

/**
 * Craft an item by any known recipe (the player reads the recipe list and
 * uses geröll for alloys when the abstractum runs dry), recursing into
 * missing inputs. Tries each recipe on a copy first.
 */
function craftAny(s: WorldState, item: string, depth = 0): boolean {
  if (depth > 5) return false;
  for (const r of RECIPES) {
    if (r.output !== item || (r.inputs[item] ?? 0) > 0 || !recipeAvailable(s, r)) continue;
    const total = Object.values(r.inputs).reduce((a, b) => a + b, 0);
    if (total > maxCombineInputs(s)) continue;
    const trial = structuredClone(s);
    let ok = true;
    for (const [id, n] of Object.entries(r.inputs)) {
      let guard = 0;
      while (ok && count(trial, id) < n && guard++ < 8) ok = craftAny(trial, id, depth + 1);
      if (count(trial, id) < n) ok = false;
      if (!ok) break;
    }
    if (ok && doCombine(trial, r.inputs).ok) {
      Object.assign(s, trial);
      return true;
    }
  }
  return false;
}

/** Sub-assemblies a player crafts on purpose to reach trait thresholds. */
const HELPERS = [
  "energiezelle",
  "induktor",
  "resonanzkammer",
  "sendeempfaenger",
  "steuermodul",
  "kuehlblock",
  "optikbank",
  "rahmen",
] as const;

function defOf(s: WorldState, id: string): ItemDef | undefined {
  return ITEM_BY_ID.get(id) ?? s.generated[id];
}

/**
 * Fill a trait slot like a player experimenting at the workbench: rank the
 * inventory by the axes the slot wants, try 2–4 part combinations of the
 * best candidates, take the cheapest prototype that fits. Crafts standard
 * sub-assemblies first when nothing fits.
 */
function fillTraitSlot(s: WorldState, req: Requirement): boolean {
  if (smartCombo(s, req)) return true;
  for (const h of HELPERS) {
    const d = ITEM_BY_ID.get(h)!;
    const helps = Object.entries(req.traits ?? {}).some(
      ([k, v]) => (v ?? 0) > 0 && d.traits[k as keyof typeof d.traits] > 0,
    );
    if (!helps || count(s, h) > 0) continue;
    const trial = structuredClone(s);
    if (craftAny(trial, h) && smartCombo(trial, req)) {
      craftAny(s, h);
      return smartCombo(s, req);
    }
  }
  return false;
}

function smartCombo(s: WorldState, req: Requirement): boolean {
  const want = Object.entries(req.traits ?? {}).filter(([, v]) => (v ?? 0) > 0);
  const rel = (id: string) => {
    const d = defOf(s, id);
    return d ? want.reduce((a, [k]) => a + d.traits[k as keyof typeof d.traits], 0) : 0;
  };
  // Parts that open blueprints ask for by name are kept back (a player sees them in the journal).
  const reserved: Record<string, number> = {};
  for (const d of DEVICES) {
    if (!s.discovered[d.id] || isBuilt(s, d.id)) continue;
    for (const st of d.stages.slice(s.built[d.id] ?? 0))
      for (const q of st.requires)
        if (q.item) reserved[q.item] = (reserved[q.item] ?? 0) + (q.count ?? 1);
  }
  const spare = (id: string) => count(s, id) - (reserved[id] ?? 0);
  const pool = Object.keys(s.inventory)
    .filter((id) => {
      const d = defOf(s, id);
      return (
        !!d && d.kind !== "relikt" && d.kind !== "schlacke" && !isProtected(id) && spare(id) > 0
      );
    })
    .sort((a, b) => rel(b) - rel(a))
    .slice(0, 9);
  const max = Math.min(4, maxCombineInputs(s));
  let best: { inputs: Record<string, number>; cost: number } | undefined;
  const pick = (start: number, inputs: Record<string, number>, n: number) => {
    if (n >= 2) {
      const res = combine(inputs, s.generated, (d) => isOnline(s, d));
      if (
        res.kind === "prototype" &&
        res.output &&
        itemFits(res.output, { ...req, item: undefined })
      ) {
        const cost = Object.entries(inputs).reduce(
          (a, [id, k]) => a + traitTotal(defOf(s, id)!.traits) * k,
          0,
        );
        if (!best || cost < best.cost) best = { inputs: { ...inputs }, cost };
      }
    }
    if (n >= max) return;
    for (let i = start; i < pool.length; i++) {
      const id = pool[i]!;
      if ((inputs[id] ?? 0) >= spare(id)) continue;
      inputs[id] = (inputs[id] ?? 0) + 1;
      pick(i, inputs, n + 1);
      inputs[id] -= 1;
      if (inputs[id] === 0) delete inputs[id];
    }
  };
  pick(0, {}, 0);
  return !!best && doCombine(s, best.inputs).ok;
}

function roomCenter(id: string): Pos {
  const r = ROOMS.find((x) => x.id === id)!;
  return { floor: r.floor, x: Math.round(r.x + r.w / 2), z: Math.round(r.z + r.d / 2) };
}

// ── Measurements ─────────────────────────────────────────────────

interface Report {
  firstPower?: number;
  fiveDevices?: number;
  floors: Partial<Record<FloorId, number>>;
  firstEnding?: number;
  allEndings?: number;
  done?: number;
  waits: { at: number; seconds: number; why: string }[];
  stalls: { from: number; seconds: number; objective: string }[];
  floorChanges: number;
  pingPong: number;
  barks: { t: number; id: string; trigger: string }[];
  hints: { t: number; id: string }[];
  cinematics: { t: number; id: string; seconds: number }[];
  timeline: { t: number; text: string }[];
  actions: Record<TaskKind, number>;
  /** Brownout/overheat moments and the tightest power reserve seen. */
  brownouts: { t: number; ids: string[] }[];
  minReserve: { t: number; watts: number; gen: number };
  powerCurve: string[];
  trace: string[];
  endTime: number;
}

class RealisticPlayer {
  s: WorldState = initialState();
  pos: Pos = { floor: SPAWN.floor, x: SPAWN.pos[0], z: SPAWN.pos[2] };
  known = new Set<string>();
  barks = new BarkEngine();
  report: Report = {
    floors: { 0: 0, 1: 0 },
    waits: [],
    stalls: [],
    floorChanges: 0,
    pingPong: 0,
    barks: [],
    hints: [],
    cinematics: [],
    timeline: [],
    actions: {
      explore: 0,
      pickup: 0,
      respawn: 0,
      note: 0,
      puzzle: 0,
      prop: 0,
      talk: 0,
      build: 0,
      use: 0,
      research: 0,
      drone: 0,
      ending: 0,
    },
    endTime: 0,
    trace: [],
    brownouts: [],
    minReserve: { t: 0, watts: Infinity, gen: 0 },
    powerCurve: [],
  };
  private idleFor = 0;
  private lastProgress = 0;
  private floorVisits: { floor: FloorId; t: number }[] = [{ floor: 0, t: 0 }];
  private ctx: Omit<TutorialContext, "powerGeneration" | "hintsEnabled" | "floor"> = {};

  constructor() {
    const spawnRoom = roomAt(this.pos.floor, this.pos.x, this.pos.z);
    if (spawnRoom) this.enterRoom(spawnRoom.id, false);
    this.cinematic({ kind: "start" });
  }

  get now(): number {
    return this.s.playTime;
  }

  note(text: string): void {
    this.report.timeline.push({ t: this.now, text });
  }

  // ── Clock ──────────────────────────────────────────────────────

  /** Advance the play clock second by second (bark tick + hint poll). */
  advance(seconds: number, opts: { idle?: boolean; cinematic?: boolean } = {}): void {
    const whole = Math.max(0, Math.round(seconds));
    for (let i = 0; i < whole; i++) {
      this.s.playTime += 1;
      this.idleFor = opts.idle ? this.idleFor + 1 : 0;
      if (opts.cinematic) continue;
      const b = this.barks.tick(this.s, this.now, {
        room: roomAt(this.pos.floor, this.pos.x, this.pos.z)?.id ?? null,
        floor: this.pos.floor,
        idleSeconds: this.idleFor,
      });
      if (b) this.report.barks.push({ t: this.now, id: b.id, trigger: "tick" });
      this.pollHint();
    }
  }

  private pollHint(): void {
    const ctx: TutorialContext = {
      ...this.ctx,
      floor: this.pos.floor,
      room: roomAt(this.pos.floor, this.pos.x, this.pos.z)?.id ?? null,
      powerGeneration: power(this.s).generation,
      hintsEnabled: true,
    };
    const h = nextHint(this.s, ctx, this.now);
    if (h) {
      markHintSeen(this.s, h.id, this.now);
      this.report.hints.push({ t: this.now, id: h.id });
    }
    this.ctx.justHappened = null;
  }

  private bark(trigger: BarkTrigger, ctx: BarkContext = {}): void {
    const c: BarkContext = { ...ctx };
    const room = roomAt(this.pos.floor, this.pos.x, this.pos.z)?.id;
    if (room && c.room === undefined) c.room = room;
    const b = this.barks.event(trigger, c, this.s, this.now);
    if (b) this.report.barks.push({ t: this.now, id: b.id, trigger });
  }

  private cinematic(trigger: SceneTrigger): boolean {
    const sc = sceneFor(trigger);
    if (!sc || this.s.flags[sceneSeenFlag(sc.id)]) return false;
    const secs = Math.ceil(sceneDuration(sc));
    this.report.cinematics.push({ t: this.now, id: sc.id, seconds: secs });
    this.advance(secs, { cinematic: true });
    this.s.flags[sceneSeenFlag(sc.id)] = true;
    return true;
  }

  // ── Moving ─────────────────────────────────────────────────────

  private enterRoom(id: string, barkIt = true): void {
    const first = !this.known.has(id);
    this.known.add(id);
    this.s.flags[`visited_${id}`] = true;
    if (barkIt) this.bark("enter_room", { room: id, first });
  }

  walkTo(to: Pos): void {
    const t = travelTime(this.pos, to);
    const floorChange = to.floor !== this.pos.floor;
    if (floorChange) {
      // Walk to the shaft, ride, arrive.
      this.advance(
        manhattan(this.pos.x, this.pos.z, ELEVATOR_AT.x, ELEVATOR_AT.z) / WALK_SPEED +
          ELEVATOR_RIDE,
      );
      this.pos = { floor: to.floor, x: ELEVATOR_AT.x, z: ELEVATOR_AT.z };
      this.report.floorChanges += 1;
      const prev = this.floorVisits[this.floorVisits.length - 2];
      const last = this.floorVisits[this.floorVisits.length - 1]!;
      if (prev && prev.floor === to.floor && this.now - last.t < 90) this.report.pingPong += 1;
      this.floorVisits.push({ floor: to.floor, t: this.now });
      this.ctx.justHappened = "floor_changed";
      this.bark("enter_floor", { floor: to.floor });
      const shaft = roomAt(to.floor, ELEVATOR_AT.x, ELEVATOR_AT.z);
      if (shaft) this.enterRoom(shaft.id, false);
      this.advance(manhattan(this.pos.x, this.pos.z, to.x, to.z) / WALK_SPEED);
    } else {
      this.advance(t);
    }
    const fromRoom = roomAt(this.pos.floor, this.pos.x, this.pos.z)?.id;
    this.pos = { ...to };
    const room = roomAt(to.floor, to.x, to.z);
    if (room && room.id !== fromRoom) this.enterRoom(room.id);
    else if (room) this.enterRoom(room.id, false);
  }

  // ── Knowledge → tasks ──────────────────────────────────────────

  private knownAt(floor: FloorId, x: number, z: number): boolean {
    const r = roomAt(floor, x, z);
    return !!r && this.known.has(r.id) && inReach(this.s, floor, x, z);
  }

  tasks(grind: boolean): Task[] {
    const s = this.s;
    const out: Task[] = [];
    const need = grind ? neededItems(s) : new Set<string>();
    for (const f of FLOOR_IDS) {
      if (!floorAccessible(s, f)) {
        const acc = FLOOR_ACCESS[f];
        if (
          acc.keypad &&
          !s.puzzles[acc.keypad] &&
          power(s).generation >= 100 &&
          this.knowsCode(acc.keypad)
        )
          out.push({
            kind: "puzzle",
            id: acc.keypad,
            at: { floor: this.pos.floor, x: ELEVATOR_AT.x, z: ELEVATOR_AT.z },
            dur: puzzleTime(acc.keypad),
            value: 4,
            overlay: "puzzle",
            run: (st) => void solvePuzzle(st, acc.keypad!),
          });
        continue;
      }
      for (const id of reachableRooms(s, f)) {
        if (this.known.has(id)) continue;
        const r = ROOMS.find((x) => x.id === id)!;
        if (r.theme === "elevator") continue;
        out.push({ kind: "explore", id, at: roomCenter(id), dur: 0, value: 2, run: () => {} });
      }
      for (const d of keypadDoorsReachable(s, f).filter((x) => this.knowsCode(x.keypad!)))
        out.push({
          kind: "puzzle",
          id: d.keypad!,
          at: { floor: f, x: d.x, z: d.z },
          dur: puzzleTime(d.keypad!),
          value: 3,
          overlay: "puzzle",
          focus: { kind: "door", id: d.id },
          run: (st) => void solvePuzzle(st, d.keypad!),
        });
    }
    for (const p of PICKUPS) {
      if (!floorAccessible(s, p.floor) || !this.knownAt(p.floor, p.x, p.z)) continue;
      if (!pickupAvailable(s, p) || pickupNeedsTool(s, p)) continue;
      if (p.puzzle && !s.puzzles[p.puzzle] && !puzzleAvailable(s, p.puzzle)) continue;
      const again = s.taken[p.id] !== undefined;
      if (again && !grind) continue;
      const items = [...p.items.map((i) => i.item), ...(p.pool ?? [])];
      const useful = items.some((i) => need.has(i));
      out.push({
        kind: again ? "respawn" : "pickup",
        id: p.id,
        at: { floor: p.floor, x: p.x, z: p.z },
        dur: PICKUP_TIME + (p.puzzle && !s.puzzles[p.puzzle] ? puzzleTime(p.puzzle) : 0),
        value: again ? (useful ? 1.5 : 0.2) : 3,
        overlay: p.puzzle && !s.puzzles[p.puzzle] ? "puzzle" : undefined,
        focus: { kind: "pickup", id: p.id },
        run: (st) => {
          if (p.puzzle) solvePuzzle(st, p.puzzle);
          const r = takePickup(st, p.id);
          if (r.ok && !r.items.length) return;
        },
      });
    }
    for (const n of NOTES) {
      if (s.read[n.id] || !noteVisible(s, n.id) || !this.knownAt(n.floor, n.x, n.z)) continue;
      out.push({
        kind: "note",
        id: n.id,
        at: { floor: n.floor, x: n.x, z: n.z },
        dur: NOTE_TIME,
        value: 2,
        focus: { kind: "note", id: n.id },
        run: (st) => {
          this.bark("note_read", { author: n.author });
          readNote(st, n.id);
        },
      });
    }
    for (const p of PROPS) {
      if (!this.knownAt(p.floor, p.x, p.z) || !evalCond(s, p.requires)) continue;
      const puzzleOpen = !!p.puzzle && !s.puzzles[p.puzzle];
      const grants = (p.grants ?? []).some((g) => !s.insights[g] && INSIGHT_BY_ID.has(g));
      if (!puzzleOpen && !grants) continue;
      out.push({
        kind: puzzleOpen ? "puzzle" : "prop",
        id: p.id,
        at: { floor: p.floor, x: p.x, z: p.z },
        dur: puzzleOpen ? puzzleTime(p.puzzle!) : USE_TIME,
        value: puzzleOpen ? 4 : 2,
        overlay: puzzleOpen ? "puzzle" : undefined,
        focus: { kind: "prop", id: p.id },
        run: (st) => {
          if (p.puzzle) {
            solvePuzzle(st, p.puzzle);
            this.bark("puzzle_solved", { kind: PUZZLE_BY_ID.get(p.puzzle)?.kind });
          }
          grant(st, p.grants);
        },
      });
    }
    for (const npc of NPCS) {
      if (!evalCond(s, npc.visible) || !this.knownAt(npc.floor, npc.x, npc.z)) continue;
      const fresh = dialogueOptions(s, npc.id).filter((o) => !s.flags[`said_${npc.id}_${o.label}`]);
      if (!fresh.length) continue;
      const trial = structuredClone(s);
      const before = Object.keys(trial.flags).length;
      talk(trial, npc.id);
      const said = Object.keys(trial.flags).length - before;
      if (said <= 0) continue;
      const delivers = fresh.some(
        (o) => (o.takes ?? []).length > 0 && trial.flags[`said_${npc.id}_${o.label}`],
      );
      out.push({
        kind: "talk",
        id: npc.id,
        at: { floor: npc.floor, x: npc.x, z: npc.z },
        dur: TALK_TIME * Math.min(4, fresh.length) + (delivers ? COMBINE_TIME : 0),
        value: delivers ? 5 : 2.5,
        overlay: "dialogue",
        focus: { kind: "npc", id: npc.id },
        run: (st) => talk(st, npc.id),
      });
    }
    for (const d of DEVICES) {
      const at = deviceSpot(d.id);
      if (!inReach(s, at.floor, at.x, at.z)) continue;
      const known = this.knownAt(at.floor, at.x, at.z);
      // Blueprints (the journal lists them; the compass points there).
      if (s.discovered[d.id] && !isBuilt(s, d.id)) {
        const c = checkStage(s, d.id);
        const hard = c?.blockers.filter(
          (b) => !c.itemBlockers.includes(b) && b !== c.puzzleBlocker,
        );
        if (c && hard && hard.length === 0) {
          const trial = structuredClone(s);
          const combos = trial.combos;
          if (this.tryBuild(trial, d.id, grind)) {
            const stage = d.stages[c.stageIndex]!;
            out.push({
              kind: "build",
              id: d.id,
              at,
              dur:
                BUILD_TIME +
                (trial.combos - combos) * COMBINE_TIME +
                (stage.puzzle && !s.puzzles[stage.puzzle] ? puzzleTime(stage.puzzle) : 0),
              value: 5,
              overlay: trial.combos > combos ? "workbench" : undefined,
              focus: { kind: "device", id: d.id },
              run: (st) => void this.tryBuild(st, d.id, grind),
            });
          }
        }
      }
      if (!known || !isOnline(s, d.id)) continue;
      const hooks = (DEVICE_INSIGHTS[d.id] ?? []).some(
        (h) => evalCond(s, h.requires) && h.grants.some((g) => !s.insights[g]),
      );
      if (hooks)
        out.push({
          kind: "use",
          id: d.id,
          at,
          dur: USE_TIME,
          value: 3,
          focus: { kind: "device", id: d.id },
          run: (st) => void operateDevice(st, d.id),
        });
      for (const dp of DEVICE_PUZZLES[d.id] ?? []) {
        if (s.puzzles[dp.puzzle] || !evalCond(s, dp.requires)) continue;
        out.push({
          kind: "puzzle",
          id: dp.puzzle,
          at,
          dur: puzzleTime(dp.puzzle),
          value: 3.5,
          overlay: "puzzle",
          focus: { kind: "device", id: d.id },
          run: (st) => {
            solvePuzzle(st, dp.puzzle);
            this.bark("puzzle_solved", { kind: PUZZLE_BY_ID.get(dp.puzzle)?.kind });
          },
        });
      }
      if (
        d.id === "NXS-01" &&
        researchReady(s) &&
        RESEARCH_TOPICS.some((t) => !s.flags[researchFlag(t.id)])
      )
        out.push({
          kind: "research",
          id: d.id,
          at,
          dur: USE_TIME,
          value: 2,
          run: (st) => void operateDevice(st, d.id),
        });
      if (d.id === "EXD-001" && droneReady(s) && (grind || !s.counters.drone_runs))
        out.push({
          kind: "drone",
          id: d.id,
          at,
          dur: USE_TIME,
          value: s.counters.drone_runs ? 1 : 4,
          run: (st) => void flyDrone(st),
        });
    }
    for (const e of ENDINGS) {
      if (s.endings[e.id]) continue;
      const at = endingSpot(e.device);
      if (!inReach(s, at.floor, at.x, at.z)) continue;
      const trial = structuredClone(s);
      if (!this.tryEnding(trial, e.id)) continue;
      out.push({
        kind: "ending",
        id: e.id,
        at,
        dur: 30,
        value: 10,
        overlay: "ending",
        run: (st) => void this.tryEnding(st, e.id),
      });
    }
    return out;
  }

  /**
   * Keypad codes are never told outright; the player needs to have read a
   * note (or seen a room text) that contains the date/number behind it.
   */
  private knowsCode(puzzle: string): boolean {
    const code = PUZZLE_BY_ID.get(puzzle)?.params?.code;
    if (typeof code !== "string" || code.length !== 4) return true;
    const a = code.slice(0, 2);
    const b = code.slice(2);
    const clues = [code, `${a}.${b}`, `${a}:${b}`, code.replace(/^0+/, "")];
    const texts = [
      ...NOTES.filter((n) => this.s.read[n.id]).map((n) => n.body),
      ...ROOMS.filter((r) => this.known.has(r.id)).map((r) => r.blurb),
    ];
    return texts.some((t) => clues.some((c) => t.includes(c)));
  }

  private tryBuild(st: WorldState, id: string, allowProto: boolean): boolean {
    const d = DEVICE_BY_ID.get(id)!;
    // Crafting one slot can eat parts another slot counted on — re-check a few times.
    for (let pass = 0; pass < 3; pass++) {
      const c = checkStage(st, id);
      if (!c || c.complete) return false;
      const stage = d.stages[c.stageIndex]!;
      if (stage.puzzle && !st.puzzles[stage.puzzle]) solvePuzzle(st, stage.puzzle);
      if (c.assignment.every((a) => !!a)) break;
      c.assignment.forEach((a, i) => {
        if (a) return;
        const req = stage.requires[i]!;
        const n = (req.count ?? 1) - (req.item ? Math.min(count(st, req.item), req.count ?? 1) : 0);
        for (let k = 0; k < n; k++) {
          if (req.item && craftAny(st, req.item)) continue;
          // Named parts are waited for; prototypes stand in only when stuck (or when no part exists).
          if (req.traits && (allowProto || !req.item)) fillTraitSlot(st, req);
        }
      });
    }
    return buildStage(st, id).ok;
  }

  private tryEnding(st: WorldState, id: string): boolean {
    const e = ENDINGS.find((x) => x.id === id)!;
    const ready = () => endingsAt(st, e.device).find((x) => x.ending.id === id)?.ready ?? false;
    if (ready()) return reachEnding(st, id);
    if (DEVICE_BY_ID.has(e.device) && isBuilt(st, e.device) && !isOnline(st, e.device)) {
      const keep = new Set([e.device, "THM-001", "PWR-001", "BAT-001", "MCP-000"]);
      const shed = DEVICES.filter((d) => d.power > 0 && !keep.has(d.id) && isSwitchedOn(st, d.id));
      for (const d of shed) toggleDevice(st, d.id);
      const ok = ready() && reachEnding(st, id);
      for (const d of shed) toggleDevice(st, d.id);
      return ok;
    }
    return false;
  }

  // ── Decide & act ───────────────────────────────────────────────

  private pick(list: Task[]): Task | undefined {
    const compass = compassTarget(this.s);
    const compassRoom = compass ? roomAt(compass.floor, compass.x, compass.z)?.id : undefined;
    let best: Task | undefined;
    let bestScore = -1;
    for (const t of list) {
      let v = t.value;
      if (
        compass &&
        t.at.floor === compass.floor &&
        roomAt(t.at.floor, t.at.x, t.at.z)?.id === compassRoom
      )
        v *= 3;
      const score = v / (travelTime(this.pos, t.at) + t.dur * 0.2 + 10);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  private nextReady(): number | undefined {
    const s = this.s;
    const times: number[] = [];
    const need = neededItems(s);
    for (const p of PICKUPS) {
      if (!p.respawn || s.taken[p.id] === undefined) continue;
      if (!floorAccessible(s, p.floor) || !this.knownAt(p.floor, p.x, p.z)) continue;
      const items = [...p.items.map((i) => i.item), ...(p.pool ?? [])];
      if (!items.some((i) => need.has(i))) continue;
      const speed = p.id === "p_geo_seep" && isOnline(s, "ATK-001") ? 2 : 1;
      times.push(s.taken[p.id]! + p.respawn / speed);
    }
    if (isOnline(s, "NXS-01") && RESEARCH_TOPICS.some((t) => !s.flags[researchFlag(t.id)]))
      times.push((s.counters.research_last ?? 0) + RESEARCH_COOLDOWN);
    if (isOnline(s, "EXD-001")) times.push((s.counters.drone_last ?? 0) + DRONE_COOLDOWN);
    const future = times.filter((t) => t > this.now);
    return future.length ? Math.min(...future) : undefined;
  }

  private checkMilestones(): void {
    const s = this.s;
    const r = this.report;
    if (r.firstPower === undefined && isOnline(s, "UEC-001")) {
      r.firstPower = this.now;
      this.note("UEC-001 online (erster Strom)");
    }
    const built = DEVICES.filter((d) => d.id !== "MCP-000" && isBuilt(s, d.id)).length;
    if (r.fiveDevices === undefined && built >= 5) {
      r.fiveDevices = this.now;
      this.note("5 Geräte gebaut");
    }
    for (const f of FLOOR_IDS)
      if (r.floors[f] === undefined && floorAccessible(s, f)) {
        r.floors[f] = this.now;
        this.note(`Ebene ${f} erreichbar`);
      }
    const endings = Object.keys(s.endings).length;
    if (r.firstEnding === undefined && endings >= 1) r.firstEnding = this.now;
    if (r.allEndings === undefined && endings >= ENDINGS.length) r.allEndings = this.now;
  }

  private act(t: Task): void {
    const s = this.s;
    this.walkTo(t.at);
    const before = snapshot(s);
    const flagsBefore = new Set(Object.keys(s.flags));
    const protoBefore = s.counters.combo_prototype ?? 0;
    const slicesBefore = s.counters.slices ?? 0;
    const puzzlesBefore = Object.keys(s.puzzles).length;
    this.ctx.focus = t.focus ?? null;
    this.ctx.overlay = t.overlay ?? null;
    // Hints about what the player is looking at fire before the action resolves.
    this.pollHint();
    this.advance(t.dur);
    t.run(s);
    evaluateAchievements(s);
    this.ctx.focus = null;
    this.ctx.overlay = null;
    this.report.actions[t.kind] += 1;
    this.report.trace.push(
      `${mm(this.now)} F${t.at.floor} ${t.kind} ${t.id} [${Object.entries(s.inventory)
        .map(([k, v]) => `${k}:${v}`)
        .join(" ")}]`,
    );
    if (t.kind === "pickup" && s.counters.slices !== slicesBefore) this.bark("pickup_rare");
    // Events → scenes and barks (same mapping as useLabDirector).
    const triggers = diffTriggers(before, snapshot(s));
    let progress = PROGRESS.has(t.kind) && t.kind !== "note";
    // A locked container's minigame is a solved puzzle, too.
    if (Object.keys(s.puzzles).length > puzzlesBefore) progress = true;
    for (const tr of triggers) {
      progress = true;
      if (tr.kind === "device_online") {
        const sc = sceneFor(tr);
        if (!sc || s.flags[sceneSeenFlag(sc.id)]) this.bark("device_online", { device: tr.id });
      } else if (tr.kind === "stage_built") {
        const total = DEVICE_BY_ID.get(tr.id)?.stages.length ?? 3;
        this.bark(tr.stage >= total ? "device_built" : "stage_built", { device: tr.id });
      } else if (tr.kind === "insight") {
        const th = INSIGHT_BY_ID.get(tr.id)?.thread;
        if (th) this.bark("insight", { thread: th });
      }
    }
    for (const f of Object.keys(s.flags)) {
      if (flagsBefore.has(f)) continue;
      const bot = /^bot_(.+)_awake$/.exec(f)?.[1];
      if (bot) this.bark("bot_awake", { bot: bot as BarkContext["bot"] });
      if (f.startsWith("ach_")) this.bark("achievement");
    }
    if ((s.counters.combo_prototype ?? 0) > protoBefore) {
      this.bark("combine_prototype");
      this.ctx.justHappened = "prototype";
    }
    const p = power(s);
    const slot = Math.floor(this.now / 1200);
    if (this.report.powerCurve.length <= slot)
      this.report.powerCurve.push(`${mm(this.now)}: ${p.demand}/${p.generation} W`);
    if (p.starved.length) {
      const ids = p.starved.map((x) => x.id);
      const last = this.report.brownouts[this.report.brownouts.length - 1];
      if (!last || last.ids.join() !== ids.join()) this.report.brownouts.push({ t: this.now, ids });
    } else if (p.generation > 0 && p.generation - p.demand < this.report.minReserve.watts)
      this.report.minReserve = { t: this.now, watts: p.generation - p.demand, gen: p.generation };
    for (const tr of triggers) this.cinematic(tr);
    this.checkMilestones();
    if (progress) this.lastProgress = this.now;
  }

  run(): Report {
    const r = this.report;
    let objectiveAtStall = topObjective(this.s)?.text ?? "—";
    while (this.now < MAX_TIME && !defaultDone(this.s)) {
      let list = this.tasks(false);
      let t = this.pick(list);
      if (!t) {
        list = this.tasks(true).filter((x) => x.value >= 1);
        t = this.pick(list);
      }
      const sinceProgress = this.now - this.lastProgress;
      if (sinceProgress < 1) {
        const top = topObjective(this.s);
        const p = power(this.s);
        objectiveAtStall = top
          ? `${top.text} (${top.detail ?? ""}) [${p.generation} W / ${p.demand} W${
              p.starved.length ? `, aus: ${p.starved.map((x) => x.id).join(" ")}` : ""
            }]`
          : "—";
      }
      if (t) {
        const progressBefore = this.lastProgress;
        this.act(t);
        if (this.lastProgress === progressBefore) continue;
        const gap = this.lastProgress - progressBefore;
        if (gap > 120)
          r.stalls.push({ from: progressBefore, seconds: gap, objective: objectiveAtStall });
        continue;
      }
      const next = this.nextReady();
      if (next === undefined) {
        this.note("Keine Aufgabe mehr und nichts, das nachfüllt — Ende der Simulation.");
        break;
      }
      const wait = Math.ceil(next - this.now);
      r.waits.push({ at: this.now, seconds: wait, why: topObjective(this.s)?.text ?? "—" });
      this.advance(wait, { idle: true });
    }
    const open = this.now - this.lastProgress;
    if (!defaultDone(this.s) && open > 120)
      r.stalls.push({ from: this.lastProgress, seconds: open, objective: objectiveAtStall });
    r.done = defaultDone(this.s) ? this.now : undefined;
    r.endTime = this.now;
    return r;
  }
}

// ── Report ───────────────────────────────────────────────────────

function mm(t: number | undefined): string {
  if (t === undefined) return "—";
  const m = Math.floor(t / 60);
  const h = Math.floor(m / 60);
  const sec = Math.round(t % 60);
  return h
    ? `${h} h ${String(m % 60).padStart(2, "0")} min`
    : `${m} min ${String(sec).padStart(2, "0")} s`;
}

function maxInWindow(times: number[], window: number): number {
  let best = 0;
  for (let i = 0; i < times.length; i++) {
    let j = i;
    while (j < times.length && times[j]! - times[i]! < window) j++;
    best = Math.max(best, j - i);
  }
  return best;
}

function format(r: Report): string {
  const bt = r.barks.map((b) => b.t);
  const perMin = (from: number, to: number) =>
    (bt.filter((t) => t >= from && t < to).length / Math.max(1, (to - from) / 60)).toFixed(2);
  const gaps = bt.slice(1).map((t, i) => t - bt[i]!);
  const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const waits = r.waits.map((w) => w.seconds);
  const lines = [
    "═══ Pacing-Report (realistischer Spieler) ═══",
    `Erster Strom (UEC online):  ${mm(r.firstPower)}`,
    `5 Geräte gebaut:             ${mm(r.fiveDevices)}`,
    ...FLOOR_IDS.map((f) => `Ebene ${f} erreichbar:          ${mm(r.floors[f])}`),
    `Erstes Ende:                 ${mm(r.firstEnding)}`,
    `Alle Enden:                  ${mm(r.allEndings)}`,
    `Alles (Enden+Bots+Slices):   ${mm(r.done)}   (Sim-Ende ${mm(r.endTime)})`,
    `Wartephasen: ${waits.length}, Summe ${mm(waits.reduce((a, b) => a + b, 0))}, längste ${mm(Math.max(0, ...waits))}`,
    ...r.waits
      .slice()
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 3)
      .map((w) => `   wartet ${w.seconds} s bei ${mm(w.at)} — ${w.why}`),
    `Stillstand > 2 min ohne Fortschritt: ${r.stalls.length}, längster ${mm(Math.max(0, ...r.stalls.map((x) => x.seconds)))}`,
    ...r.stalls
      .slice()
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 4)
      .map((x) => `   ${x.seconds} s ab ${mm(x.from)} — ${x.objective}`),
    `Strom: ${r.brownouts.length} Brownout-/Hitze-Momente${r.brownouts
      .slice(0, 4)
      .map((x) => ` [${mm(x.t)}: ${x.ids.join(" ")}]`)
      .join(
        "",
      )}; knappste Reserve ${Math.round(r.minReserve.watts)} W von ${r.minReserve.gen} W bei ${mm(r.minReserve.t)}`,
    `   Last/Erzeugung alle 20 min: ${r.powerCurve.join(" · ")}`,
    `Ebenenwechsel: ${r.floorChanges}, Hin-und-her (< 90 s auf einer Ebene): ${r.pingPong}`,
    `Aktionen: ${Object.entries(r.actions)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}`,
    `Cinematics: ${r.cinematics.map((c) => `${c.id}@${mm(c.t)} (${c.seconds} s)`).join(", ")}`,
    `Barks gesamt: ${r.barks.length} — ${perMin(0, r.endTime)}/min, Ø-Abstand ${Math.round(meanGap)} s`,
    `   Barks/min: 0–3 min ${perMin(0, 180)}, 0–10 min ${perMin(0, 600)}, 10–30 min ${perMin(600, 1800)}, danach ${perMin(1800, r.endTime)}`,
    `   dichteste Minute: ${(() => {
      let at = 0;
      let best = 0;
      for (let i = 0; i < bt.length; i++) {
        const n = bt.filter((t) => t >= bt[i]! && t < bt[i]! + 60).length;
        if (n > best) [best, at] = [n, i];
      }
      return r.barks
        .filter((b) => b.t >= bt[at]! && b.t < bt[at]! + 60)
        .map((b) => `${Math.round(b.t)} s ${b.trigger}:${b.id}`)
        .join(", ");
    })()}`,
    `   max. Barks in 60 s: ${maxInWindow(bt, 60)}, in den ersten 3 min: ${bt.filter((t) => t < 180).length}`,
    `   nach Auslöser: ${Object.entries(
      r.barks.reduce<Record<string, number>>((a, b) => {
        a[b.trigger === "tick" ? b.id.split(".")[0]! : b.trigger] =
          (a[b.trigger === "tick" ? b.id.split(".")[0]! : b.trigger] ?? 0) + 1;
        return a;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}`,
    `Hinweise: ${r.hints.length}, erste 5 min: ${r.hints.filter((h) => h.t < 300).length} — ${r.hints
      .slice(0, 8)
      .map((h) => `${h.id}@${Math.round(h.t)}s`)
      .join(", ")}`,
    "Erste 5 Minuten (Barks):",
    ...r.barks
      .filter((b) => b.t < 300)
      .map((b) => `   ${Math.round(b.t)} s  ${b.trigger.padEnd(14)} ${b.id}`),
    "Meilensteine:",
    ...r.timeline.slice(0, 20).map((e) => `   ${mm(e.t)}  ${e.text}`),
  ];
  return lines.join("\n");
}

// ── Tests ────────────────────────────────────────────────────────

/** A calendar day on which the UEC runs at (almost exactly) nominal output. */
function neutralDay(): string {
  let best = "2026-01-01";
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    if (Math.abs(dailyPriceModifier(d) - 1) < Math.abs(dailyPriceModifier(best) - 1)) best = d;
  }
  return best;
}

describe("pacing (realistic player)", () => {
  // The UEC output follows the calendar day — pin it so the report is stable.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${neutralDay()}T12:00:00Z`));
  const player = new RealisticPlayer();
  const r = player.run();
  vi.useRealTimers();
  console.log(format(r));
  if (process.env.PACING_TRACE) console.log(r.trace.join("\n"));

  it("finishes everything within the simulated time", () => {
    expect(r.done, `Sim-Ende bei ${mm(r.endTime)}`).toBeDefined();
    expect(Object.keys(player.s.endings).length).toBe(ENDINGS.length);
    expect(SLICE_PICKUPS.every((id) => player.s.taken[id] !== undefined)).toBe(true);
  });

  it("gets the first power within 12 minutes", () => {
    expect(r.firstPower).toBeDefined();
    expect(r.firstPower!).toBeLessThanOrEqual(12 * 60);
  });

  it("builds five devices within 25 minutes", () => {
    expect(r.fiveDevices!).toBeLessThanOrEqual(25 * 60);
  });

  it("reaches the first ending within 3 hours", () => {
    expect(r.firstEnding!).toBeLessThanOrEqual(3 * 3600);
  });

  it("never waits more than 3 minutes for a refill or cooldown", () => {
    const worst = Math.max(0, ...r.waits.map((w) => w.seconds));
    expect(worst).toBeLessThanOrEqual(180);
  });

  it("never goes 5 minutes without progress", () => {
    const worst = Math.max(0, ...r.stalls.map((x) => x.seconds));
    expect(worst, JSON.stringify(r.stalls.slice(0, 5))).toBeLessThanOrEqual(300);
  });

  it("barks about once every 1–2 minutes, without a pile-up at the start", () => {
    const minutes = r.endTime / 60;
    const rate = r.barks.length / minutes;
    expect(rate).toBeGreaterThanOrEqual(0.4);
    expect(rate).toBeLessThanOrEqual(1.1);
    expect(r.barks.filter((b) => b.t < 180).length).toBeLessThanOrEqual(3);
    // Ambient chatter never clusters; story beats (a new floor + bots waking) may reach 4.
    const chatter = r.barks.filter((b) => b.trigger !== "bot_awake" && !b.id.includes(".first"));
    expect(
      maxInWindow(
        chatter.map((b) => b.t),
        60,
      ),
    ).toBeLessThanOrEqual(3);
    expect(
      maxInWindow(
        r.barks.map((b) => b.t),
        60,
      ),
    ).toBeLessThanOrEqual(4);
  });

  it("spaces the tutorial hints and never stacks them on a bark", () => {
    expect(r.hints.filter((h) => h.t < 300).length).toBeLessThanOrEqual(7);
    for (const h of r.hints)
      for (const b of r.barks)
        expect(Math.abs(h.t - b.t), `${h.id} / ${b.id}`).toBeGreaterThanOrEqual(5);
  });
});

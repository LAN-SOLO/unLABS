/**
 * Completionist coverage run shared by `connectivity.test.ts` and the
 * German-locale checks (`locale-de.test.ts`): the greedy player first
 * reaches the main goals, then keeps going until every note, pickup,
 * puzzle, dialogue option, insight, recipe, research topic, achievement,
 * ending, bot, door, floor and room is done. `coverage()` lists what is
 * still missing (empty lists = everything reachable by play).
 */
import { ACHIEVEMENTS, isUnlocked } from "@/lib/world/achievements";
import { combine, VOLATILITY_LIMIT } from "@/lib/world/combine";
import { DEVICES } from "@/lib/world/content/devices";
import { ITEM_BY_ID, RECIPES, comboKey, type Recipe } from "@/lib/world/content/items";
import { DOORS, FLOORS, NOTES, PICKUPS } from "@/lib/world/content/map";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { BOT_QUESTS, ENDINGS, INSIGHTS, NPCS } from "@/lib/world/content/story";
import {
  RESEARCH_TOPICS,
  count,
  doCombine,
  doorIsOpen,
  floorAccessible,
  isOnline,
  isProtected,
  maxCombineInputs,
  power,
  recipeAvailable,
  researchFlag,
  saidKey,
} from "@/lib/world/game";
import type { WorldState } from "@/lib/world/types";
import {
  bioActivate,
  bioActive,
  bioBalanced,
  bioTick,
  bioValue,
  consume,
  replicate,
  sleep,
  train,
} from "@/lib/world/biorhythm";
import { VISITABLE_ROOMS, play, step, tryCraft, type SimRun } from "./simPlayer";

/** Craft one specific recipe (not just its output) if its inputs can be gathered. */
export function craftRecipe(s: WorldState, r: Recipe): boolean {
  if (!recipeAvailable(s, r)) return false;
  const total = Object.values(r.inputs).reduce((a, b) => a + b, 0);
  if (total > maxCombineInputs(s)) return false;
  for (const [id, n] of Object.entries(r.inputs)) {
    let guard = 0;
    while (count(s, id) < n && guard++ < 6) if (!tryCraft(s, id)) break;
    if (count(s, id) < n) return false;
  }
  return doCombine(s, r.inputs).ok;
}

/** Deliberately overload the workbench once (the "drei explodiert" achievement). */
export function explode(s: WorldState): boolean {
  const pool = Object.keys(s.inventory)
    .filter((id) => {
      const d = ITEM_BY_ID.get(id) ?? s.generated[id];
      return !!d && !isProtected(id) && d.kind !== "relikt";
    })
    .sort(
      (a, b) =>
        (ITEM_BY_ID.get(b) ?? s.generated[b])!.volatility -
        (ITEM_BY_ID.get(a) ?? s.generated[a])!.volatility,
    );
  const inputs: Record<string, number> = {};
  let vol = 0;
  let n = 0;
  for (const id of pool) {
    const v = (ITEM_BY_ID.get(id) ?? s.generated[id])!.volatility;
    for (let k = 0; k < count(s, id) && n < maxCombineInputs(s); k++) {
      inputs[id] = (inputs[id] ?? 0) + 1;
      vol += v;
      n += 1;
      if (vol > VOLATILITY_LIMIT) break;
    }
    if (vol > VOLATILITY_LIMIT) break;
  }
  if (vol <= VOLATILITY_LIMIT) return false;
  const res = combine(inputs, s.generated, (d) => isOnline(s, d));
  return res.kind === "explosion" && doCombine(s, inputs).ok;
}

export function recipeDone(s: WorldState, r: Recipe): boolean {
  return s.recipesKnown[comboKey(r.inputs)] === r.output;
}

export function saidAll(s: WorldState): string[] {
  const out: string[] = [];
  for (const n of NPCS)
    for (const o of n.options) if (!s.flags[saidKey(n.id, o)]) out.push(`${n.id}:${o.label}`);
  return out;
}

export interface Coverage {
  notes: string[];
  pickups: string[];
  puzzles: string[];
  dialogue: string[];
  insights: string[];
  recipes: string[];
  research: string[];
  achievements: string[];
  endings: string[];
  bots: string[];
  doors: string[];
  floors: string[];
  rooms: string[];
  devicesNeverOnline: string[];
}

export function coverage(s: WorldState, everOnline: Set<string>): Coverage {
  return {
    notes: NOTES.filter((n) => !s.read[n.id]).map((n) => n.id),
    pickups: PICKUPS.filter((p) => s.taken[p.id] === undefined).map((p) => p.id),
    puzzles: PUZZLES.filter((p) => !s.puzzles[p.id]).map((p) => p.id),
    dialogue: saidAll(s),
    insights: INSIGHTS.filter((i) => !s.insights[i.id]).map((i) => i.id),
    recipes: RECIPES.filter((r) => !recipeDone(s, r)).map(
      (r) => `${comboKey(r.inputs)}→${r.output}`,
    ),
    research: RESEARCH_TOPICS.filter((t) => !s.flags[researchFlag(t.id)]).map((t) => t.id),
    achievements: ACHIEVEMENTS.filter((a) => !isUnlocked(s, a.id)).map((a) => a.id),
    endings: ENDINGS.filter((e) => !s.endings[e.id]).map((e) => e.id),
    bots: BOT_QUESTS.filter((q) => !s.flags[q.flag]).map((q) => q.npc),
    doors: DOORS.filter((d) => !doorIsOpen(s, d)).map((d) => d.id),
    floors: FLOORS.filter((f) => !floorAccessible(s, f.id)).map((f) => f.name),
    rooms: VISITABLE_ROOMS.filter((id) => !s.flags[`visited_${id}`]),
    devicesNeverOnline: DEVICES.filter((d) => !everOnline.has(d.id)).map((d) => d.id),
  };
}

export function empty(c: Coverage): boolean {
  return Object.values(c).every((l: string[]) => l.length === 0);
}

/**
 * Biorhythm routine (the "Healthy Mind" / "Morning Workout" achievements):
 * once Level +1 is reached, print and eat, let an hour pass, sleep, train
 * right after waking, then train again until balanced. Done once.
 */
export function bioRoutine(s: WorldState): void {
  if (s.flags.bio_fruehsport && bioBalanced(s)) return;
  if (!bioActive(s) && !bioActivate(s)) return;
  if (!bioActive(s)) return;
  if (bioValue(s, "rest") >= 90) bioTick(s, 1200, "normal");
  replicate(s, "wasserflasche");
  consume(s, "wasserflasche");
  sleep(s);
  for (let i = 0; i < 4 && !bioBalanced(s); i++) {
    train(s);
    s.playTime += 61;
  }
}

/** Main goals first, then everything else a completionist would do. */
export function fullRun(): { run: SimRun; everOnline: Set<string>; report: Coverage } {
  const run = play({ sampleEvery: 4 });
  const everOnline = new Set<string>();
  for (const t of run.triggers) if (t.kind === "device_online") everOnline.add(t.id);
  let report = coverage(run.s, everOnline);
  for (let i = 0; i < 400 && !empty(report); i++) {
    const s = run.s;
    const slag = RECIPES.find((r) => r.inputs.schlacke)!;
    if (!s.flags.explosion_seen || (!recipeDone(s, slag) && count(s, "schlacke") < 3)) explode(s);
    for (const r of RECIPES) if (!recipeDone(s, r)) craftRecipe(s, r);
    bioRoutine(s);
    step(run);
    run.steps += 1;
    for (const t of run.triggers) if (t.kind === "device_online") everOnline.add(t.id);
    for (const id of power(s).online) everOnline.add(id);
    report = coverage(s, everOnline);
  }
  return { run, everOnline, report };
}

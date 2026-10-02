/**
 * Jade's routines — solution sequences she memorises, combines, learns from
 * repetition and runs on her own (pure, no DOM, no three). docs/OPS.md.
 * ======================================================================
 *
 * The vocabulary is the undevbook walkthrough's: every step is one replayable
 * game action (pickup, note, puzzle, craft, build, use, toggle, drone,
 * research, link, unlink, decor) that calls the same `lib/world/game.ts`
 * function the player's click does.
 *
 *  - **Memorise:** the player records a sequence (`startRecording` …
 *    `stopRecording`) — "Jade, remember this".
 *  - **Combine:** routines nest (`combineRoutines`): a routine step can be a
 *    whole routine; cycles are refused, depth is capped.
 *  - **Learn:** every action lands in `ops.log` (`recordAction`); a sequence of
 *    2–5 actions done `LEARN_AT` times becomes a learned routine, and a pair of
 *    routines run back to back `LEARN_AT` times becomes a learned combination.
 *  - **Apply:** learned routines are habits (`auto`): when the player starts
 *    one (does its first step), `habitFor` tells the caller Jade can finish it.
 *
 * Only knowledge Jade has is replayed: a craft needs a known recipe, a puzzle
 * must have been solved, missing build parts are crafted from known recipes.
 */
import { tr } from "@/lib/i18n";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID, RECIPES, RECIPE_BY_KEY, type Recipe } from "@/lib/world/content/items";
import { NOTES, PICKUPS } from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { decorActionFor, runDecorAction } from "@/lib/world/decor-actions";
import { linkDevice, unlinkDevice } from "@/lib/world/device-ops";
import {
  buildStage,
  checkStage,
  doCombine,
  flyDrone,
  maxCombineInputs,
  operateDevice,
  readNote,
  recipeAvailable,
  research,
  takePickup,
  toggleDevice,
} from "@/lib/world/game";
import { LOG_LIMIT, ROUTINE_LIMIT } from "@/lib/world/ops/state";
import type { OpsStep, Routine, RoutineItem, WorldState } from "@/lib/world/types";

/** Repetitions until Jade remembers a sequence on her own. */
export const LEARN_AT = 3;
/** Sequence lengths considered for habits. */
export const MIN_SEQ = 2;
export const MAX_SEQ = 5;
/** Nesting depth of combined routines. */
export const MAX_DEPTH = 4;

export const stepKey = (st: OpsStep): string =>
  `${st.kind}:${st.id}${st.arg ? `>${st.arg}` : ""}${st.room ? `@${st.room}` : ""}`;
const seqKey = (steps: readonly OpsStep[]): string => steps.map(stepKey).join(" | ");

// ── Labels ───────────────────────────────────────────────────────

function itemName(id: string, s?: WorldState): string {
  return ITEM_BY_ID.get(id)?.name ?? s?.generated[id]?.name ?? id;
}

/** Inputs of a comboKey (`a×2+b×1`). */
export function parseComboKey(key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of key.split("+")) {
    const m = /^(.+)×(\d+)$/.exec(part);
    if (m) out[m[1]!] = Number(m[2]);
  }
  return out;
}

/** Human label of a step. */
export function describeStep(st: OpsStep, s?: WorldState): string {
  switch (st.kind) {
    case "pickup":
      return tr("Take: {name}", { name: PICKUPS.find((p) => p.id === st.id)?.label ?? st.id });
    case "note":
      return tr("Read: {name}", { name: NOTES.find((n) => n.id === st.id)?.title ?? st.id });
    case "puzzle":
      return tr("Solve: {name}", { name: PUZZLE_BY_ID.get(st.id)?.title ?? st.id });
    case "craft": {
      const out = s?.recipesKnown[st.id] ?? RECIPE_BY_KEY.get(st.id)?.output;
      return tr("Craft: {name}", { name: out ? itemName(out, s) : st.id });
    }
    case "build":
      return tr("Build: {name}", { name: DEVICE_BY_ID.get(st.id)?.name ?? st.id });
    case "use":
      return tr("Use: {name}", { name: DEVICE_BY_ID.get(st.id)?.name ?? st.id });
    case "toggle":
      return tr("Switch: {name}", { name: DEVICE_BY_ID.get(st.id)?.name ?? st.id });
    case "drone":
      return tr("Fly the drone");
    case "research":
      return tr("Run a research cycle");
    case "link":
      return tr("Link {a} → {b}", { a: st.id, b: st.arg ?? "?" });
    case "unlink":
      return tr("Unlink {a} → {b}", { a: st.id, b: st.arg ?? "?" });
    case "decor":
      return tr("Use: {name}", {
        name: (st.arg && decorActionFor(st.arg, st.room ?? "")?.label) || st.arg || st.id,
      });
  }
}

// ── Replay ───────────────────────────────────────────────────────

export interface StepResult {
  ok: boolean;
  text: string;
}

const count = (s: WorldState, id: string) => s.inventory[id] ?? 0;

/** Craft an item from recipes Jade knows (recursively, like the walkthrough's crafter). */
export function craftKnown(s: WorldState, item: string, depth = 0): boolean {
  if (depth > 4) return false;
  const known = new Set(Object.keys(s.recipesKnown));
  const recipe: Recipe | undefined = RECIPES.find(
    (r) =>
      r.output === item &&
      !(r.inputs[item] > 0) &&
      recipeAvailable(s, r) &&
      known.has(
        Object.entries(r.inputs)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, n]) => `${id}×${n}`)
          .join("+"),
      ),
  );
  if (!recipe) return false;
  const total = Object.values(recipe.inputs).reduce((a, b) => a + b, 0);
  if (total > maxCombineInputs(s)) return false;
  for (const [id, n] of Object.entries(recipe.inputs)) {
    let guard = 0;
    while (count(s, id) < n && guard++ < 8) if (!craftKnown(s, id, depth + 1)) return false;
  }
  return doCombine(s, recipe.inputs).ok;
}

/** Replay one step (mutates `s`). `now` = play time. */
export function applyStep(s: WorldState, st: OpsStep, now = s.playTime): StepResult {
  const label = describeStep(st, s);
  const done = (ok: boolean, why?: string): StepResult => ({
    ok,
    text: why ? `${label} — ${why}` : label,
  });
  switch (st.kind) {
    case "pickup": {
      const r = takePickup(s, st.id);
      return done(r.ok, r.ok ? undefined : r.message);
    }
    case "note":
      readNote(s, st.id);
      return done(true);
    case "puzzle":
      // Puzzles stay solved: replaying one only confirms Jade knows the way.
      return done(!!s.puzzles[st.id], s.puzzles[st.id] ? undefined : tr("not solved yet"));
    case "craft": {
      if (!s.recipesKnown[st.id]) return done(false, tr("recipe unknown"));
      const inputs = parseComboKey(st.id);
      for (const [id, n] of Object.entries(inputs)) {
        let guard = 0;
        while (count(s, id) < n && guard++ < 8) if (!craftKnown(s, id)) break;
      }
      const r = doCombine(s, inputs);
      return done(r.ok, r.ok ? undefined : tr("missing ingredients"));
    }
    case "build": {
      const chk = checkStage(s, st.id);
      if (!chk) return done(false, tr("unknown device"));
      if (chk.complete) return done(true, tr("already complete"));
      for (const b of chk.itemBlockers) {
        const id = b.split(" ")[0]!;
        if (ITEM_BY_ID.has(id)) craftKnown(s, id);
      }
      const r = buildStage(s, st.id);
      return done(r.ok, r.ok ? undefined : r.message);
    }
    case "use":
      operateDevice(s, st.id);
      return done(true);
    case "toggle":
      return done(toggleDevice(s, st.id));
    case "drone": {
      const r = flyDrone(s);
      return done(r.ok, r.ok ? undefined : r.message);
    }
    case "research": {
      const r = research(s);
      return done(r.ok, r.ok ? undefined : r.message);
    }
    case "link": {
      const r = linkDevice(s, st.id, st.arg ?? "");
      return done(r.ok, r.ok ? undefined : r.message);
    }
    case "unlink": {
      const r = unlinkDevice(s, st.id, st.arg ?? "");
      return done(r.ok, r.ok ? undefined : r.message);
    }
    case "decor": {
      const r = runDecorAction(s, st.id, st.arg ?? "", st.room ?? "", now);
      return done(r.ok && !r.resting, r.resting ? tr("resting") : undefined);
    }
  }
}

// ── Routines ─────────────────────────────────────────────────────

export function routineById(s: WorldState, id: string): Routine | undefined {
  return s.ops.routines.find((r) => r.id === id);
}

/** The routine flattened into steps (nested routines expanded, cycles cut). */
export function expandRoutine(
  s: WorldState,
  id: string,
  depth = 0,
  seen = new Set<string>(),
): OpsStep[] {
  const r = routineById(s, id);
  if (!r || depth > MAX_DEPTH || seen.has(id)) return [];
  const next = new Set(seen).add(id);
  return r.items.flatMap((it) =>
    it.kind === "routine" ? expandRoutine(s, it.id, depth + 1, next) : [it],
  );
}

/** Does routine `id` contain routine `target` (directly or nested)? */
function contains(s: WorldState, id: string, target: string, depth = 0): boolean {
  if (id === target) return true;
  if (depth > MAX_DEPTH) return false;
  return (routineById(s, id)?.items ?? []).some(
    (it) => it.kind === "routine" && contains(s, it.id, target, depth + 1),
  );
}

function newId(s: WorldState, prefix: string): string {
  return `${prefix}${s.ops.next++}`;
}

function addRoutine(s: WorldState, r: Omit<Routine, "id">): Routine {
  const full: Routine = { id: newId(s, "r"), ...r };
  s.ops.routines.push(full);
  // Keep the list bounded: drop the least used learned routine first.
  if (s.ops.routines.length > ROUTINE_LIMIT) {
    const victims = s.ops.routines
      .filter((x) => x.source === "learned" && x.id !== full.id)
      .sort((a, b) => a.uses - b.uses);
    const drop = victims[0] ?? s.ops.routines[0]!;
    s.ops.routines = s.ops.routines.filter((x) => x !== drop);
  }
  return full;
}

export function startRecording(s: WorldState): void {
  s.ops.recording = [];
}

/** Stop recording; with ≥ 1 step and a name the sequence becomes a routine. */
export function stopRecording(s: WorldState, name?: string): Routine | null {
  const steps = s.ops.recording ?? [];
  s.ops.recording = null;
  if (!steps.length || !name?.trim()) return null;
  return addRoutine(s, {
    name: name.trim().slice(0, 80),
    items: steps,
    source: "recorded",
    uses: 0,
    auto: false,
    at: s.playTime,
  });
}

/** A routine made of other routines (in order). Refuses unknown ids and cycles. */
export function combineRoutines(
  s: WorldState,
  ids: readonly string[],
  name: string,
): Routine | null {
  if (ids.length < 2 || !ids.every((id) => routineById(s, id))) return null;
  const r = addRoutine(s, {
    name: name.trim().slice(0, 80) || ids.map((id) => routineById(s, id)!.name).join(" + "),
    items: ids.map((id) => ({ kind: "routine" as const, id })),
    source: "combined",
    uses: 0,
    auto: false,
    at: s.playTime,
  });
  if (ids.some((id) => contains(s, id, r.id))) {
    s.ops.routines = s.ops.routines.filter((x) => x !== r);
    return null;
  }
  return r;
}

export function renameRoutine(s: WorldState, id: string, name: string): void {
  const r = routineById(s, id);
  if (r && name.trim()) r.name = name.trim().slice(0, 80);
}

export function setRoutineAuto(s: WorldState, id: string, auto: boolean): void {
  const r = routineById(s, id);
  if (r) r.auto = auto;
}

/** Forget a routine (and remove it from combinations and tasks). */
export function forgetRoutine(s: WorldState, id: string): void {
  s.ops.routines = s.ops.routines
    .filter((r) => r.id !== id)
    .map((r) => ({ ...r, items: r.items.filter((it) => !(it.kind === "routine" && it.id === id)) }))
    .filter((r) => r.items.length > 0);
  s.ops.tasks = s.ops.tasks.filter((t) => !(t.what.kind === "routine" && t.what.id === id));
}

export interface RoutineRun {
  ok: boolean;
  done: number;
  total: number;
  lines: string[];
}

/** Run a routine now (all steps; a failed step is reported, the rest still runs). */
export function runRoutine(s: WorldState, id: string, from = 0): RoutineRun {
  const r = routineById(s, id);
  const steps = expandRoutine(s, id).slice(from);
  const lines: string[] = [];
  let done = 0;
  for (const st of steps) {
    const res = applyStep(s, st);
    lines.push(`${res.ok ? "✓" : "✗"} ${res.text}`);
    if (res.ok) done++;
  }
  if (r) {
    r.uses++;
    noteRoutineRun(s, r.id);
  }
  return { ok: done === steps.length, done, total: steps.length, lines };
}

// ── Learning ─────────────────────────────────────────────────────

function sameItems(a: readonly RoutineItem[], b: readonly RoutineItem[]): boolean {
  return a.length === b.length && a.every((x, i) => JSON.stringify(x) === JSON.stringify(b[i]));
}

export interface RecordResult {
  /** A sequence Jade just learned (it reached LEARN_AT repetitions). */
  learned: Routine | null;
}

/**
 * Note a player action (call next to the game call it describes). Feeds the
 * recording, the log and the habit counter.
 */
export function recordAction(s: WorldState, st: OpsStep): RecordResult {
  const o = s.ops;
  if (o.recording && o.recording.length < 64) o.recording.push(st);
  o.log.push(st);
  if (o.log.length > LOG_LIMIT) o.log.splice(0, o.log.length - LOG_LIMIT);
  let learned: Routine | null = null;
  for (let n = MIN_SEQ; n <= MAX_SEQ && n <= o.log.length; n++) {
    const seq = o.log.slice(-n);
    if (new Set(seq.map(stepKey)).size < 2) continue; // "take, take, take" is not a habit
    const key = seqKey(seq);
    o.seen[key] = (o.seen[key] ?? 0) + 1;
    if (o.seen[key] === LEARN_AT && !learned && !o.routines.some((r) => sameItems(r.items, seq))) {
      learned = addRoutine(s, {
        name: seq
          .map((x) => describeStep(x, s))
          .join(" → ")
          .slice(0, 80),
        items: seq.map((x) => ({ ...x })),
        source: "learned",
        uses: 0,
        auto: true,
        at: s.playTime,
      });
    }
  }
  pruneSeen(s);
  return { learned };
}

/** Routine pairs run back to back become a learned combination after LEARN_AT times. */
function noteRoutineRun(s: WorldState, id: string): void {
  const o = s.ops;
  const prev = o.seen["@last"] ? String(o.seen["@last"]) : "";
  const prevId = prev ? `r${prev}` : "";
  o.seen["@last"] = Number(id.slice(1)) || 0;
  if (!prevId || prevId === id) return;
  const key = `@pair ${prevId}>${id}`;
  o.seen[key] = (o.seen[key] ?? 0) + 1;
  if (o.seen[key] !== LEARN_AT) return;
  const items: RoutineItem[] = [
    { kind: "routine", id: prevId },
    { kind: "routine", id },
  ];
  if (o.routines.some((r) => sameItems(r.items, items))) return;
  const a = routineById(s, prevId);
  const b = routineById(s, id);
  if (!a || !b) return;
  addRoutine(s, {
    name: `${a.name} + ${b.name}`.slice(0, 80),
    items,
    source: "learned",
    uses: 0,
    auto: true,
    at: s.playTime,
  });
}

/** Keep the habit counter small (only keys still in reach of the log). */
function pruneSeen(s: WorldState): void {
  const keys = Object.keys(s.ops.seen);
  if (keys.length <= 600) return;
  const keep = keys.sort((a, b) => s.ops.seen[b]! - s.ops.seen[a]!).slice(0, 400);
  const next: Record<string, number> = {};
  for (const k of keep) next[k] = s.ops.seen[k]!;
  s.ops.seen = next;
}

/**
 * A habit the player just started: an `auto` routine whose first step is
 * `st`. Jade can finish it (`runRoutine(s, id, 1)`).
 */
export function habitFor(s: WorldState, st: OpsStep): Routine | null {
  const key = stepKey(st);
  return (
    s.ops.routines
      .filter((r) => r.auto && !s.ops.recording)
      .map((r) => ({ r, steps: expandRoutine(s, r.id) }))
      .filter(({ steps }) => steps.length > 1 && stepKey(steps[0]!) === key)
      .sort((a, b) => b.r.uses - a.r.uses || b.steps.length - a.steps.length)[0]?.r ?? null
  );
}

export interface NoteResult {
  learned: Routine | null;
  /** The habit Jade finished on her own after this step (and how far she got). */
  habit: { routine: Routine; run: RoutineRun } | null;
}

/**
 * The player did `st` (successfully): record it, learn from it — and if it
 * starts a habit Jade remembers (an `auto` routine), she finishes the rest
 * on her own. Call inside the same `act` as the game call.
 */
export function noteAction(s: WorldState, st: OpsStep): NoteResult {
  const { learned } = recordAction(s, st);
  const h = learned ? null : habitFor(s, st);
  if (!h) return { learned, habit: null };
  return { learned, habit: { routine: h, run: runRoutine(s, h.id, 1) } };
}

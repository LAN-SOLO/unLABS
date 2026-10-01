/**
 * The Matrix Chamber — rules (pure).
 * ==================================
 *
 * Before Damien vanished, the researchers learned to pull slices out of the
 * matrix of the Ethereum chain, keyed by the state of the chain. The
 * apparatus never found the exact moment again: every extraction dissolves
 * a random slice — a random frame of a random released unETH capture.
 *
 * - The chamber wakes only when every device of the lab is built.
 * - An extraction is tuned to one real day of the ETH ledger
 *   (matrix/history.ts) and fed with energy (field strength 1…5, watts on
 *   the grid when it starts) and rare materials (consumed at the start).
 * - What can come out depends on how rare the state was: the pure line
 *   (P02) always; RGB (P03) only with field ≥ 4 — it took a lot of energy;
 *   the mono line (P01) only at field 5 on a monochrome day, when every
 *   indicator of the chain stood at an extreme at once. Within a line the
 *   chamber favours captures whose traits resonate with the day's state.
 * - It takes 2…24 hours of real time (random, independent of the outcome)
 *   and keeps running while the game is closed. The outcome is fixed by a
 *   seed at the start and revealed at the end.
 * - Slices are composed into crystals at 30 positions: in capture order the
 *   crystal turns, mixed it becomes something exotic. Composed crystals are
 *   kept in the chamber's inventory (as slot lists — the GIF is rendered
 *   from them, see matrix/gif.ts).
 *
 * Times are wall-clock epoch milliseconds passed in as `now`, so the rules
 * stay deterministic in tests.
 */
import { DEVICES } from "@/lib/world/content/devices";
import { addItem, bump, count, isBuilt, power, removeItem } from "@/lib/world/game";
import { tr } from "@/lib/i18n";
import type {
  MatrixCrystal,
  MatrixField,
  MatrixJob,
  MatrixSlice,
  WorldState,
} from "@/lib/world/types";
import {
  SLICE_POSITIONS,
  TOKENS_BY_LINE,
  type ArchiveToken,
  type SliceLine,
} from "@/lib/world/matrix/archive";
import { HISTORY_DAYS, chainStateAt, indexOf, type ChainState } from "@/lib/world/matrix/history";
import { HOUR, MAX_HOURS, MIN_HOURS } from "@/lib/world/matrix/state";

export {
  MATRIX_PROP,
  initialMatrix,
  sanitizeMatrix,
  MAX_HOURS,
  MIN_HOURS,
} from "@/lib/world/matrix/state";

export const FIELDS: readonly MatrixField[] = [1, 2, 3, 4, 5];

/** Watts the grid must deliver when an extraction starts, per field strength. */
export const FIELD_WATTS: Readonly<Record<MatrixField, number>> = {
  1: 60,
  2: 90,
  3: 120,
  4: 180,
  5: 250,
};

/** Materials one extraction consumes, per field strength. */
export const FIELD_COST: Readonly<Record<MatrixField, Readonly<Record<string, number>>>> = {
  1: { halo_kristall: 1 },
  2: { halo_kristall: 1, energiezelle: 1 },
  3: { halo_kristall: 2, energiezelle: 1 },
  4: { halo_kristall: 2, energiezelle: 1, exotische_materie: 1 },
  5: { halo_kristall: 2, energiezelle: 2, exotische_materie: 1, antimaterie: 1 },
};

/** Lowest field strength that reaches the RGB line. */
export const RGB_FIELD: MatrixField = 4;
/** Field strength the mono line needs (on a monochrome day). */
export const MONO_FIELD: MatrixField = 5;

/** Relative weight of each line when it is reachable. */
export const LINE_WEIGHT: Readonly<Record<SliceLine, number>> = {
  pure: 1,
  rgb: 0.15,
  mono: 0.06,
};

/** Counter: extractions finished. */
export const EXTRACTED_COUNTER = "matrix_extracted";

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Waking ───────────────────────────────────────────────────────

/** Devices built / all devices (the chamber wakes at all). */
export function labCompletion(s: WorldState): { built: number; total: number } {
  return { built: DEVICES.filter((d) => isBuilt(s, d.id)).length, total: DEVICES.length };
}

/** The chamber is awake once every device of the lab is built. */
export function matrixAwake(s: WorldState): boolean {
  const c = labCompletion(s);
  return c.built >= c.total;
}

// ── Outcome ──────────────────────────────────────────────────────

/** Lines an extraction at `field` on a day with `state` can reach. */
export function reachableLines(field: MatrixField, state: ChainState): SliceLine[] {
  const out: SliceLine[] = ["pure"];
  if (field >= RGB_FIELD) out.push("rgb");
  if (field >= MONO_FIELD && state.mono) out.push("mono");
  return out;
}

/** Chance (0…1) of each line for a field strength and day. */
export function lineChances(field: MatrixField, state: ChainState): Record<SliceLine, number> {
  const lines = reachableLines(field, state);
  const total = lines.reduce((n, l) => n + LINE_WEIGHT[l], 0);
  return {
    pure: lines.includes("pure") ? LINE_WEIGHT.pure / total : 0,
    rgb: lines.includes("rgb") ? LINE_WEIGHT.rgb / total : 0,
    mono: lines.includes("mono") ? LINE_WEIGHT.mono / total : 0,
  };
}

/** How strongly a capture resonates with a day's chain state (weight ≥ 1). */
export function resonance(t: ArchiveToken, st: ChainState): number {
  const tr_ = t.traits;
  let w = 1;
  if (tr_.rotation === st.rotation) w += 2;
  if (tr_.tier === st.tier) w += 2;
  if (tr_.io === st.io) w += 1;
  if (tr_.era === st.era) w += 1;
  if (tr_.stasis === st.stasis) w += 1;
  return w;
}

function pickWeighted<T>(items: readonly T[], weight: (t: T) => number, r: number): T {
  let total = 0;
  for (const it of items) total += weight(it);
  let x = r * total;
  for (const it of items) {
    x -= weight(it);
    if (x < 0) return it;
  }
  return items[items.length - 1]!;
}

/** The slice a job dissolves (decided by its seed; same job → same slice). */
export function outcomeOf(job: Pick<MatrixJob, "seed" | "field" | "day">): {
  token: number;
  pos: number;
  line: SliceLine;
} {
  const rand = mulberry32(job.seed);
  const idx = Math.max(0, indexOf(job.day));
  const state = chainStateAt(idx);
  const chances = lineChances(job.field, state);
  const lines = (Object.keys(chances) as SliceLine[]).filter((l) => chances[l] > 0);
  const line = pickWeighted(lines, (l) => chances[l], rand());
  const token = pickWeighted(TOKENS_BY_LINE[line], (t) => resonance(t, state), rand());
  const pos = 1 + Math.min(SLICE_POSITIONS - 1, Math.floor(rand() * SLICE_POSITIONS));
  return { token: token.id, pos, line };
}

// ── Extraction ───────────────────────────────────────────────────

export type StartBlock = "asleep" | "busy" | "day" | "power" | "materials";

/** Why an extraction cannot start now (null = it can). */
export function startBlock(s: WorldState, field: MatrixField, day: string): StartBlock | null {
  if (!matrixAwake(s)) return "asleep";
  if (s.matrix.job) return "busy";
  const i = indexOf(day);
  if (i < 0 || i >= HISTORY_DAYS) return "day";
  if (power(s).generation < FIELD_WATTS[field]) return "power";
  for (const [id, n] of Object.entries(FIELD_COST[field])) if (count(s, id) < n) return "materials";
  return null;
}

/** Player-facing reason for a start block. */
export function startBlockText(b: StartBlock, field: MatrixField): string {
  switch (b) {
    case "asleep":
      return tr("The chamber sleeps until every device in the lab is built.");
    case "busy":
      return tr("An extraction is already running.");
    case "day":
      return tr("The ledger has no record of that day.");
    case "power":
      return tr("Field {n} needs {w} W on the grid.", { n: field, w: FIELD_WATTS[field] });
    case "materials":
      return tr("Not enough materials for field {n}.", { n: field });
  }
}

/**
 * Start an extraction: consumes the materials, fixes the outcome seed and a
 * random duration (2…24 h). `rand` decides seed and duration.
 */
export function startExtraction(
  s: WorldState,
  field: MatrixField,
  day: string,
  now: number,
  rand: () => number = Math.random,
): StartBlock | null {
  const block = startBlock(s, field, day);
  if (block) return block;
  for (const [id, n] of Object.entries(FIELD_COST[field])) removeItem(s, id, n);
  const hours = MIN_HOURS + rand() * (MAX_HOURS - MIN_HOURS);
  s.matrix.job = {
    start: now,
    end: now + Math.round(hours * HOUR),
    field,
    day,
    seed: Math.floor(rand() * 4294967296) >>> 0,
  };
  return null;
}

export function jobRemainingMs(s: WorldState, now: number): number {
  const j = s.matrix.job;
  return j ? Math.max(0, j.end - now) : 0;
}

/** 0…1 progress of the running job. */
export function jobProgress(s: WorldState, now: number): number {
  const j = s.matrix.job;
  if (!j) return 0;
  return Math.max(0, Math.min(1, (now - j.start) / Math.max(1, j.end - j.start)));
}

/** Finish the job if its time has come: the slice joins the chamber's inventory. */
export function finishExtraction(s: WorldState, now: number): MatrixSlice | null {
  const j = s.matrix.job;
  if (!j || now < j.end) return null;
  const o = outcomeOf(j);
  const slice: MatrixSlice = {
    uid: `m${s.matrix.next++}`,
    token: o.token,
    pos: o.pos,
    at: j.end,
    day: j.day,
    field: j.field,
  };
  s.matrix.slices.push(slice);
  s.matrix.job = null;
  bump(s, EXTRACTED_COUNTER);
  return slice;
}

/** Abort the running job: the materials are lost, the Matrix keeps its secret. */
export function abortExtraction(s: WorldState): boolean {
  if (!s.matrix.job) return false;
  s.matrix.job = null;
  return true;
}

// ── Composer ─────────────────────────────────────────────────────

/** Slice uid → crystal id, for slices placed in a crystal. */
export function placedIn(s: WorldState): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of s.matrix.crystals) for (const u of c.slots) if (u) m.set(u, c.id);
  return m;
}

/** Slices not placed in any crystal (optionally ignoring one crystal being edited). */
export function freeSlices(s: WorldState, editing?: string): MatrixSlice[] {
  const used = placedIn(s);
  return s.matrix.slices.filter((x) => {
    const c = used.get(x.uid);
    return !c || c === editing;
  });
}

export function sliceByUid(s: WorldState, uid: string): MatrixSlice | undefined {
  return s.matrix.slices.find((x) => x.uid === uid);
}

export type ComposeBlock = "empty" | "slots" | "unknown" | "twice" | "taken";

/** Why a slot list cannot be saved as a crystal (null = it can). */
export function composeBlock(
  s: WorldState,
  slots: readonly (string | null)[],
  editing?: string,
): ComposeBlock | null {
  if (slots.length !== SLICE_POSITIONS) return "slots";
  const seen = new Set<string>();
  const used = placedIn(s);
  for (const u of slots) {
    if (!u) continue;
    if (!sliceByUid(s, u)) return "unknown";
    if (seen.has(u)) return "twice";
    seen.add(u);
    const c = used.get(u);
    if (c && c !== editing) return "taken";
  }
  return seen.size ? null : "empty";
}

/** Save a crystal (new, or `id` to update one). Returns it, or null when blocked. */
export function saveCrystal(
  s: WorldState,
  name: string,
  slots: readonly (string | null)[],
  now: number,
  id?: string,
): MatrixCrystal | null {
  const existing = id ? s.matrix.crystals.find((c) => c.id === id) : undefined;
  if (composeBlock(s, slots, existing?.id)) return null;
  const clean = name.trim().slice(0, 40) || tr("Crystal {n}", { n: s.matrix.crystals.length + 1 });
  if (existing) {
    existing.name = clean;
    existing.slots = [...slots];
    existing.at = now;
    return existing;
  }
  const c: MatrixCrystal = { id: `k${s.matrix.next++}`, name: clean, slots: [...slots], at: now };
  s.matrix.crystals.push(c);
  return c;
}

/** Take a crystal apart: its slices are free again. */
export function dismantleCrystal(s: WorldState, id: string): boolean {
  const i = s.matrix.crystals.findIndex((c) => c.id === id);
  if (i < 0) return false;
  s.matrix.crystals.splice(i, 1);
  return true;
}

/** How a composed crystal moves when its 30 frames play. */
export type CrystalMotion = "turning" | "still" | "exotic" | "partial";

/**
 * - turning: one capture, every position in order (the original rotation)
 * - still: one capture, the same position everywhere it is filled
 * - partial: one capture in order, but with gaps
 * - exotic: anything else (mixed captures or shuffled positions)
 */
export function crystalMotion(s: WorldState, slots: readonly (string | null)[]): CrystalMotion {
  const filled = slots
    .map((u, i) => ({ i, sl: u ? sliceByUid(s, u) : undefined }))
    .filter((x): x is { i: number; sl: MatrixSlice } => !!x.sl);
  if (!filled.length) return "partial";
  const token = filled[0]!.sl.token;
  if (filled.some((x) => x.sl.token !== token)) return "exotic";
  if (filled.every((x) => x.sl.pos === filled[0]!.sl.pos) && filled.length > 1) return "still";
  if (filled.every((x) => x.sl.pos === x.i + 1))
    return filled.length === SLICE_POSITIONS ? "turning" : "partial";
  return "exotic";
}

/** Fill the slots with the free slices in capture order (each to its own position where free). */
export function autoArrange(s: WorldState, editing?: string): (string | null)[] {
  const slots: (string | null)[] = Array.from({ length: SLICE_POSITIONS }, () => null);
  const free = freeSlices(s, editing)
    .slice()
    .sort((a, b) => a.token - b.token || a.pos - b.pos);
  for (const x of free) {
    const i = x.pos - 1;
    if (!slots[i]) slots[i] = x.uid;
  }
  return slots;
}

/** Dev: let the running job finish now. */
export function debugFinishNow(s: WorldState, now: number): void {
  if (s.matrix.job) s.matrix.job.end = Math.min(s.matrix.job.end, now);
}

/** Dev: put materials for a field-5 run into the inventory. */
export function debugFeed(s: WorldState): void {
  for (const [id, n] of Object.entries(FIELD_COST[5])) addItem(s, id, n);
}

/** Dev: build and switch on every device (wakes the chamber). */
export function debugWake(s: WorldState): void {
  for (const d of DEVICES) {
    s.built[d.id] = d.stages.length;
    s.switchedOn[d.id] = true;
  }
}

/**
 * Clarity — how "real" the lab world looks (pure rules, no three).
 * ================================================================
 *
 * Jade wakes up in a world of big voxel blocks. Everything she finds,
 * invents, builds, optimises, combines or discovers makes it a little
 * clearer. The world passes through 42 eras (seven chapters of six), and
 * the voxels keep splitting — 1 → 2 → 4 → 6 → 8 cubes per source voxel
 * edge — until they are so small that the lab reads almost as a render.
 * It is voxels all the way: no pixel filter, no smooth meshes. Only when
 * everything a completionist can do is done (the same checklist as the
 * simulated completionist in tests/world/simCoverage.ts) is the last era
 * reached. Jade herself is always real: she is the one thing in the lab
 * that is not voxels.
 *
 * `clarityOf(state)` is the single source of truth. The renderer eases its
 * look towards `paramsAt(level)` (grade pass, voxel materials, voxel
 * divisions); crossing an era plays the "the world sharpens" moment.
 */
import { ACHIEVEMENTS, isUnlocked } from "@/lib/world/achievements";
import { DEVICES } from "@/lib/world/content/devices";
import { WORLD_FIRMWARE } from "@/lib/world/content/firmware";
import { RECIPES, SLICE_TOTAL, comboKey } from "@/lib/world/content/items";
import { HUBS } from "@/lib/world/content/links";
import { DOORS, NOTES, PICKUPS, ROOMS } from "@/lib/world/content/map";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { BOT_QUESTS, ENDINGS, INSIGHTS, NPCS } from "@/lib/world/content/story";
import { isUpdated } from "@/lib/world/firmware";
import { RESEARCH_TOPICS, doorIsOpen, initialState, researchFlag, saidKey } from "@/lib/world/game";
import type { WorldState } from "@/lib/world/types";
import type { MeshTier } from "@/lib/world/models/refine";
import type { ClarityMode } from "@/lib/world/clarity-mode";
import { tr } from "@/lib/i18n";

export { CLARITY_MODES, type ClarityMode } from "@/lib/world/clarity-mode";

/** Number of eras. */
export const CLARITY_ERAS = 42;
/** Eras per chapter (7 chapters). */
export const ERAS_PER_CHAPTER = 6;
const LAST = CLARITY_ERAS - 1;

// ── Progress ────────────────────────────────────────────────────

/** One kind of progress: its weight and how much of it is done (0..1). */
export interface ClarityCategory {
  id: string;
  weight: number;
  done(s: WorldState): number;
}

function share(n: number, total: number): number {
  return total <= 0 ? 1 : Math.min(1, n / total);
}

function countOf<T>(list: readonly T[], ok: (t: T) => boolean): number {
  let n = 0;
  for (const t of list) if (ok(t)) n++;
  return n;
}

const TOTAL_STAGES = DEVICES.reduce((n, d) => n + d.stages.length, 0);
const VISITABLE = ROOMS.filter((r) => r.theme !== "elevator");
const DIALOGUE = NPCS.flatMap((n) => n.options.map((o) => saidKey(n.id, o)));
const FIRMWARE_IDS = Object.keys(WORLD_FIRMWARE);

/**
 * Every kind of progress (weights sum to 1). Mirrors the completionist
 * coverage checklist, so a full playthrough reaches exactly 1.
 */
export const CLARITY_CATEGORIES: readonly ClarityCategory[] = [
  // Built.
  {
    id: "built",
    weight: 0.18,
    done: (s) => {
      let n = 0;
      for (const d of DEVICES) n += Math.min(d.stages.length, Math.max(0, s.built[d.id] ?? 0));
      return share(n, TOTAL_STAGES);
    },
  },
  {
    id: "discovered",
    weight: 0.04,
    done: (s) =>
      share(
        countOf(DEVICES, (d) => !!s.discovered[d.id]),
        DEVICES.length,
      ),
  },
  // Invented / combined.
  {
    id: "recipes",
    weight: 0.12,
    done: (s) =>
      share(
        countOf(RECIPES, (r) => s.recipesKnown[comboKey(r.inputs)] === r.output),
        RECIPES.length,
      ),
  },
  {
    id: "insights",
    weight: 0.08,
    done: (s) =>
      share(
        countOf(INSIGHTS, (i) => !!s.insights[i.id]),
        INSIGHTS.length,
      ),
  },
  {
    id: "research",
    weight: 0.05,
    done: (s) =>
      share(
        countOf(RESEARCH_TOPICS, (t) => !!s.flags[researchFlag(t.id)]),
        RESEARCH_TOPICS.length,
      ),
  },
  // Found.
  {
    id: "pickups",
    weight: 0.07,
    done: (s) =>
      share(
        countOf(PICKUPS, (p) => s.taken[p.id] !== undefined),
        PICKUPS.length,
      ),
  },
  { id: "slices", weight: 0.05, done: (s) => share(s.counters.slices ?? 0, SLICE_TOTAL) },
  {
    id: "notes",
    weight: 0.04,
    done: (s) =>
      share(
        countOf(NOTES, (n) => !!s.read[n.id]),
        NOTES.length,
      ),
  },
  {
    id: "puzzles",
    weight: 0.07,
    done: (s) =>
      share(
        countOf(PUZZLES, (p) => !!s.puzzles[p.id]),
        PUZZLES.length,
      ),
  },
  // Optimised.
  {
    id: "firmware",
    weight: 0.06,
    done: (s) =>
      share(
        countOf(FIRMWARE_IDS, (id) => isUpdated(s, id)),
        FIRMWARE_IDS.length,
      ),
  },
  {
    id: "hubs",
    weight: 0.03,
    done: (s) =>
      share(
        countOf(HUBS, (h) => (s.links[h.id] ?? []).length > 0),
        HUBS.length,
      ),
  },
  // Discovered.
  {
    id: "achievements",
    weight: 0.06,
    done: (s) =>
      share(
        countOf(ACHIEVEMENTS, (a) => isUnlocked(s, a.id)),
        ACHIEVEMENTS.length,
      ),
  },
  {
    id: "endings",
    weight: 0.05,
    done: (s) =>
      share(
        countOf(ENDINGS, (e) => !!s.endings[e.id]),
        ENDINGS.length,
      ),
  },
  {
    id: "bots",
    weight: 0.04,
    done: (s) =>
      share(
        countOf(BOT_QUESTS, (q) => !!s.flags[q.flag]),
        BOT_QUESTS.length,
      ),
  },
  {
    id: "doors",
    weight: 0.02,
    done: (s) =>
      share(
        countOf(DOORS, (d) => doorIsOpen(s, d)),
        DOORS.length,
      ),
  },
  {
    id: "rooms",
    weight: 0.02,
    done: (s) =>
      share(
        countOf(VISITABLE, (r) => !!s.flags[`visited_${r.id}`]),
        VISITABLE.length,
      ),
  },
  {
    id: "dialogue",
    weight: 0.02,
    done: (s) =>
      share(
        countOf(DIALOGUE, (k) => !!s.flags[k]),
        DIALOGUE.length,
      ),
  },
];

/** Progress per category (id → 0..1). */
export function clarityParts(s: WorldState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of CLARITY_CATEGORIES) out[c.id] = c.done(s);
  return out;
}

function rawScore(s: WorldState): { sum: number; all: boolean } {
  let sum = 0;
  let all = true;
  for (const c of CLARITY_CATEGORIES) {
    const d = c.done(s);
    if (d < 1) all = false;
    sum += c.weight * d;
  }
  return { sum, all };
}

/** Raw score of a fresh game (starter devices, open doors): clarity counts from there. */
let base: number | null = null;
function baseline(): number {
  if (base === null) base = Math.min(0.5, rawScore(initialState()).sum);
  return base;
}

/**
 * Progress 0..1 since the first morning — exactly 1 only when every
 * category is complete.
 */
export function clarityScore(s: WorldState): number {
  const { sum, all } = rawScore(s);
  if (all) return 1;
  const b = baseline();
  // Never reach the last era by rounding while something is still missing.
  return Math.max(0, Math.min(0.9995, (sum - b) / (1 - b)));
}

/** Score each era starts at: a gentle curve; the last era needs everything. */
export const ERA_THRESHOLDS: readonly number[] = Array.from({ length: CLARITY_ERAS }, (_, i) =>
  i === LAST ? 1 : 0.985 * Math.pow(i / LAST, 1.1),
);

/** Era of a score: the last threshold it has reached. */
export function eraOf(score: number): number {
  let e = 0;
  for (let i = 0; i < CLARITY_ERAS; i++) if (score >= ERA_THRESHOLDS[i]!) e = i;
  return e;
}

// ── Names ───────────────────────────────────────────────────────

/** Player-facing era names, six per chapter (German in lib/i18n/de/clarity.ts). */
export const ERA_NAMES: readonly string[] = [
  // Chapter 1 — big blocks (source voxels).
  tr("Block Dawn"),
  tr("Cold Cubes"),
  tr("First Flicker"),
  tr("Blocky Shadows"),
  tr("Muted Colours"),
  tr("Coarse Grain"),
  // Chapter 2 — the first split (2×).
  tr("First Split"),
  tr("Half Cubes"),
  tr("Edges Appear"),
  tr("Seams and Rivets"),
  tr("Warmer Colours"),
  tr("First Focus"),
  // Chapter 3 — steady cubes.
  tr("Steady Cubes"),
  tr("Fine Grain"),
  tr("Deep Palette"),
  tr("Shape Memory"),
  tr("Worn Edges"),
  tr("Steady Sight"),
  // Chapter 4 — the second split (4×).
  tr("Second Split"),
  tr("Quarter Cubes"),
  tr("Rounded Edges"),
  tr("Surface Grain"),
  tr("True Reflections"),
  tr("Near Sight"),
  // Chapter 5 — materials (the floors split too).
  tr("Soft Light"),
  tr("Material Truth"),
  tr("Quiet Screens"),
  tr("Deep Shadows"),
  tr("Fine Detail"),
  tr("Clear Glass"),
  // Chapter 6 — the third split (6×).
  tr("Third Split"),
  tr("Soft Contours"),
  tr("Living Light"),
  tr("Polished Steel"),
  tr("Clean Air"),
  tr("Almost Real"),
  // Chapter 7 — grains of sand (8×).
  tr("Grains of Sand"),
  tr("Thin Veil"),
  tr("Last Grain"),
  tr("Final Polish"),
  tr("Pure Light"),
  tr("Crystal Clear"),
];

/** Chapter (0..6) of an era. */
export function chapterOf(era: number): number {
  return Math.floor(Math.max(0, Math.min(LAST, era)) / ERAS_PER_CHAPTER);
}

// ── Look ────────────────────────────────────────────────────────

/** What the renderer does at a clarity level. */
export interface ClarityParams {
  /** Surface micro detail 0..1 (grain, roughness variation). */
  detail: number;
  /** CRT grain / scan band multiplier 0..1. */
  crt: number;
  /** Image-based lighting multiplier (flat → rich reflections). */
  env: number;
  /** Voxel divisions of the models (cubes per source voxel edge: 1, 2, 4, 6, 8). */
  mesh: MeshTier;
  /** Voxel divisions of the terrain (1, 2, 4). */
  terrain: MeshTier;
  /** Colour grading of the world (Jade is never graded): saturation and contrast, 1 = neutral. */
  saturation: number;
  contrast: number;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * First era (index) of each model voxel division: every chapter boundary
 * splits the voxels again (chapter 1 big blocks, 2–3 halved, 4–5 quartered,
 * 6 sixths, 7 eighths).
 */
export const MESH_TIER_ERAS: readonly (readonly [era: number, tier: MeshTier])[] = [
  [0, 1],
  [6, 2],
  [18, 4],
  [30, 6],
  [36, 8],
];

/** First era (index) of each terrain voxel division (floors and walls are big: they stop at 4). */
export const TERRAIN_TIER_ERAS: readonly (readonly [era: number, tier: MeshTier])[] = [
  [0, 1],
  [6, 2],
  [24, 4],
];

function tierAt(table: readonly (readonly [number, MeshTier])[], level: number): MeshTier {
  let t: MeshTier = 1;
  for (const [era, tier] of table) if (level >= era) t = tier;
  return t;
}

/** Model voxel divisions at a level. */
export function meshTierAt(level: number): MeshTier {
  return tierAt(MESH_TIER_ERAS, level);
}

/** Terrain voxel divisions at a level. */
export function terrainTierAt(level: number): MeshTier {
  return tierAt(TERRAIN_TIER_ERAS, level);
}

/**
 * The look at a continuous level 0..41. The voxels split at chapter
 * boundaries (`meshTierAt` / `terrainTierAt`); every other knob is a smooth
 * curve, so each invention nudges the world and each era is a visible
 * step: the colours deepen, materials gain detail and reflections, the CRT
 * grain fades.
 */
export function paramsAt(level: number): ClarityParams {
  const l = Math.max(0, Math.min(LAST, level));
  const t = l / LAST;
  return {
    detail: smoothstep(0.25, 0.97, t),
    crt: 1 - smoothstep(0.3, 1, t),
    env: 0.35 + 0.95 * smoothstep(0, 1, t),
    mesh: meshTierAt(l),
    terrain: terrainTierAt(l),
    // Muted, flat colour in the pixel eras; rich at the end.
    saturation: 0.62 + 0.43 * smoothstep(0, 0.85, t),
    contrast: 0.86 + 0.18 * smoothstep(0.05, 0.9, t),
  };
}

/** The look of each era at its start. */
export const ERA_PARAMS: readonly ClarityParams[] = Array.from({ length: CLARITY_ERAS }, (_, i) =>
  paramsAt(i),
);

export interface Clarity {
  /** Overall progress 0..1. */
  score: number;
  /** Era 0..41. */
  era: number;
  /** Chapter 0..6. */
  chapter: number;
  /** Progress towards the next era 0..1 (1 in the last era). */
  eraT: number;
  /** Level the renderer shows (era + drift inside it). */
  level: number;
  params: ClarityParams;
  parts: Record<string, number>;
}

/** Inside an era the look drifts at most this far: the era change stays a moment. */
const DRIFT = 0.6;

/** The clarity of a world state. */
export function clarityOf(s: WorldState): Clarity {
  // Never back: power-gated doors can close on a weak day — the world keeps
  // the clearest look it ever reached (CLARITY_BEST_COUNTER, see noteClarityEra).
  const score = Math.max(clarityScore(s), (s.counters[CLARITY_BEST_COUNTER] ?? 0) / 1e6);
  const era = eraOf(score);
  const lo = ERA_THRESHOLDS[era]!;
  const hi = ERA_THRESHOLDS[era + 1];
  const eraT = hi === undefined ? 1 : Math.max(0, Math.min(1, (score - lo) / (hi - lo)));
  const level = era >= LAST ? LAST : era + eraT * DRIFT;
  return {
    score,
    era,
    chapter: chapterOf(era),
    eraT,
    level,
    params: paramsAt(level),
    parts: clarityParts(s),
  };
}

/** Level (0..41, continuous) the renderer should show for a state and mode. */
export function clarityLevel(s: WorldState, mode: ClarityMode = "story"): number {
  if (mode === "clear") return LAST;
  if (mode === "pixel") return 0;
  return clarityOf(s).level;
}

/** Counter remembering the best score ever reached (× 1e6): clarity never falls back. */
export const CLARITY_BEST_COUNTER = "clarity_best";

/** Counter remembering the highest era announced (saves keep it). */
export const CLARITY_ERA_COUNTER = "clarity_era";

/**
 * After an action: the era Jade just reached if it is higher than any
 * announced before (and remember it), else null. A save without the
 * counter adopts its current era silently.
 */
export function noteClarityEra(s: WorldState): number | null {
  const score = clarityScore(s);
  const best = s.counters[CLARITY_BEST_COUNTER] ?? 0;
  if (score * 1e6 > best) s.counters[CLARITY_BEST_COUNTER] = Math.floor(score * 1e6);
  const era = clarityOf(s).era;
  const seen = s.counters[CLARITY_ERA_COUNTER];
  if (seen === undefined) {
    s.counters[CLARITY_ERA_COUNTER] = era;
    return null;
  }
  if (era <= seen) return null;
  s.counters[CLARITY_ERA_COUNTER] = era;
  return era;
}

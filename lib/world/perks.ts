/**
 * Course perks — flag helpers and numbers (pure, no imports).
 * ===========================================================
 *
 * A finished course (lib/world/courses.ts) may set `flags.perk_<id>`. The
 * effect of each perk is implemented where its rule lives, guarded by
 * `hasPerk(s, id)`; this file has no imports so game.ts, biorhythm.ts and
 * archive.ts can use it without an import cycle. Perks are small bonuses
 * only — nothing in the game ever requires one.
 */

/** Minimal state shape (keeps this module import-free). */
interface HasFlags {
  flags: Record<string, boolean>;
}

export const perkFlag = (perk: string): string => `perk_${perk}`;

export function hasPerk(s: HasFlags, perk: string): boolean {
  return !!s.flags[perkFlag(perk)];
}

/** Every perk a course can grant (ids). */
export const PERK_IDS = [
  "second_look",
  "scrap_sense",
  "speed_reader",
  "steady_rhythm",
  "good_form",
  "blast_catch",
  "research_notes",
  "drone_routes",
  "search_sense",
] as const;
export type PerkId = (typeof PERK_IDS)[number];

/** Effect numbers (applied in the rule files named per entry). */
export const PERK_TUNING = {
  /** speed_reader (courses.ts `study`): study time factor. */
  studyFactor: 1.25,
  /** steady_rhythm (biorhythm.ts `bioTick`): decay factor. */
  bioDecay: 0.9,
  /** good_form (biorhythm.ts `train`): fitness gain factor. */
  trainGain: 1.2,
  /** scrap_sense (game.ts `takePickup`): every n-th finished pile gives +1 of its first part. */
  scrapEvery: 4,
  /** research_notes (game.ts `researchPerCycle`): extra points per cycle. */
  research: 1,
  /** drone_routes (game.ts `droneCooldown`): cooldown factor. */
  droneCooldown: 0.85,
} as const;

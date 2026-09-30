/**
 * The lab archive — discovery rules (pure).
 * =========================================
 *
 * Content and the tier/value rules: content/archive/*. Found entries live in
 * `WorldState.archive` (id → play time) and are listed in the journal.
 *
 * Spots:
 * - read spots (boards, posters, screens, props, notes, terminals) show their
 *   entries when used;
 * - search spots: every searchable piece of furniture offers "Search", whether
 *   it hides something or not (an empty locker gives a shrug) — so the
 *   action itself never gives a hiding place away;
 * - device entries appear on the device interface's INFO page while the
 *   device is online;
 * - combination entries are entered at the archive console (journal).
 */
import { tr } from "@/lib/i18n";
import {
  ARCHIVE,
  ARCHIVE_BY_ID,
  type ArchiveEntry,
  type ArchiveSpot,
  type ArchiveTier,
} from "@/lib/world/content/archive";
import { evalCond, grant, log } from "@/lib/world/game";
import { hasPerk } from "@/lib/world/perks";
import { PIN_DECOR } from "@/lib/world/memos";
import type { WorldState } from "@/lib/world/types";

export { ARCHIVE, ARCHIVE_BY_ID };

/** Furniture that can be searched (lockers, vents, drawers, boxes, shelves …). */
export const SEARCHABLE_DECOR: ReadonlySet<string> = new Set([
  "locker_row",
  "wall_vent",
  "vent_fan",
  "filing_cabinet",
  "cardboard_boxes",
  "trash_bin",
  "bookshelf",
  "bookshelf_jade",
  "bookshelf_damien",
  "archive_shelf",
  "card_catalog",
  "display_case",
  "wall_shelf",
  "book_stack",
  "paper_pile",
  "paper_stack",
  "fuse_box",
  "vault_safe",
]);

/** Stable key of a spot. */
export function spotKey(spot: ArchiveSpot): string {
  if ("decor" in spot) return `decor|${spot.decor}`;
  if ("prop" in spot) return `prop|${spot.prop}`;
  if ("device" in spot) return `device|${spot.device}`;
  if ("terminal" in spot) return `terminal|${spot.terminal}`;
  return `note|${spot.note}`;
}

const BY_SPOT = new Map<string, ArchiveEntry[]>();
for (const e of ARCHIVE) {
  if (!e.at) continue;
  const k = spotKey(e.at);
  BY_SPOT.set(k, [...(BY_SPOT.get(k) ?? []), e]);
}

/** Entries at a spot (found or not). */
export function entriesAt(spot: ArchiveSpot): readonly ArchiveEntry[] {
  return BY_SPOT.get(spotKey(spot)) ?? [];
}

/** Decor placements that carry readable entries (the engine makes them interactable). */
export const ARCHIVE_DECOR: ReadonlySet<string> = new Set(
  ARCHIVE.flatMap((e) => (e.at && "decor" in e.at && e.find === "read" ? [e.at.decor] : [])),
);

export function isFound(s: WorldState, id: string): boolean {
  return s.archive[id] !== undefined;
}

/** The entry's extra conditions hold. */
export function findable(s: WorldState, e: ArchiveEntry): boolean {
  return evalCond(s, e.when);
}

export interface SpotView {
  /** Entries readable here (found now or earlier). */
  entries: ArchiveEntry[];
  /** Freshly found by this visit. */
  fresh: ArchiveEntry[];
  /** Nudges for entries here whose conditions do not hold yet. */
  hints: string[];
}

function take(s: WorldState, e: ArchiveEntry): void {
  s.archive[e.id] = Math.max(1, Math.round(s.playTime));
  log(s, tr("Archive — {title}", { title: e.title }));
  if (e.grants?.length) grant(s, e.grants);
}

/**
 * Use a spot: read entries (and, with `search`, hidden ones) are found when
 * their conditions hold. Mutates `s`.
 */
export function visitSpot(
  s: WorldState,
  spot: ArchiveSpot,
  mode: "read" | "search" | "device" = "read",
): SpotView {
  const out: SpotView = { entries: [], fresh: [], hints: [] };
  for (const e of entriesAt(spot)) {
    const reachable = e.find === mode || (mode === "search" && e.find === "read");
    if (isFound(s, e.id)) {
      if (reachable || e.find === "read") out.entries.push(e);
      continue;
    }
    if (!reachable) continue;
    if (!findable(s, e)) {
      if (e.whenHint) out.hints.push(e.whenHint);
      continue;
    }
    take(s, e);
    out.entries.push(e);
    out.fresh.push(e);
  }
  // Perk `search_sense` (course "Archive method"): an empty search tells Jade
  // when another piece of furniture in the same room still hides something.
  if (
    mode === "search" &&
    !out.entries.length &&
    !out.hints.length &&
    "decor" in spot &&
    hasPerk(s, "search_sense") &&
    roomHidesMore(s, spot.decor)
  )
    out.hints.push(tr("Nothing here — but something else in this room is worth a closer look."));
  return out;
}

/** Room part of a decor placement id (`decor:<room>:<n>`). */
function placementRoom(placement: string): string | undefined {
  const parts = placement.split(":");
  return parts[0] === "decor" && parts.length >= 3 ? parts[1] : undefined;
}

/** Another searchable spot in the placement's room hides a findable entry. */
export function roomHidesMore(s: WorldState, placement: string): boolean {
  const room = placementRoom(placement);
  if (!room) return false;
  return ARCHIVE.some(
    (e) =>
      e.find === "search" &&
      !!e.at &&
      "decor" in e.at &&
      e.at.decor !== placement &&
      placementRoom(e.at.decor) === room &&
      !isFound(s, e.id) &&
      findable(s, e),
  );
}

/** Normalised answer (case, spaces, dashes and dots ignored). */
export function normAnswer(a: string): string {
  return a.toLowerCase().replace(/[\s\-_.·,:;'"»«“”]/g, "");
}

/** Combination entries whose needed entries are all found but which are still open. */
export function openCombos(s: WorldState): ArchiveEntry[] {
  return ARCHIVE.filter(
    (e) => e.find === "combine" && !isFound(s, e.id) && (e.needs ?? []).every((n) => isFound(s, n)),
  );
}

/** Try an answer at the archive console. Returns the entries it unlocked (mutates `s`). */
export function combine(s: WorldState, answer: string): ArchiveEntry[] {
  const a = normAnswer(answer);
  if (!a) return [];
  const hit = openCombos(s).filter(
    (e) => e.answer !== undefined && normAnswer(e.answer) === a && findable(s, e),
  );
  for (const e of hit) take(s, e);
  bumpTries(s);
  return hit;
}

function bumpTries(s: WorldState): void {
  s.counters.archive_tries = (s.counters.archive_tries ?? 0) + 1;
}

/** Found / total per tier (journal progress). */
export function archiveProgress(
  s: WorldState,
): Record<ArchiveTier, { found: number; total: number }> {
  const p = {
    1: { found: 0, total: 0 },
    2: { found: 0, total: 0 },
    3: { found: 0, total: 0 },
    4: { found: 0, total: 0 },
    5: { found: 0, total: 0 },
  } as Record<ArchiveTier, { found: number; total: number }>;
  for (const e of ARCHIVE) {
    p[e.tier].total++;
    if (isFound(s, e.id)) p[e.tier].found++;
  }
  return p;
}

/** Found entries, newest first. */
export function foundEntries(s: WorldState): ArchiveEntry[] {
  return ARCHIVE.filter((e) => isFound(s, e.id)).sort(
    (a, b) => (s.archive[b.id] ?? 0) - (s.archive[a.id] ?? 0),
  );
}

export const TIER_LABEL: Readonly<Record<ArchiveTier, string>> = {
  1: tr("archive::open"),
  2: tr("archive::tucked away"),
  3: tr("archive::hidden"),
  4: tr("archive::well hidden"),
  5: tr("archive::buried"),
};

/** Names of furniture that can hold archive entries (focus label, spot panel title). */
export const SPOT_NAME: Readonly<Record<string, string>> = {
  locker_row: tr("spot::Lockers"),
  wall_vent: tr("spot::Vent grille"),
  vent_fan: tr("spot::Vent fan"),
  filing_cabinet: tr("spot::Filing cabinet"),
  cardboard_boxes: tr("spot::Cardboard boxes"),
  trash_bin: tr("spot::Bin"),
  bookshelf: tr("spot::Bookshelf"),
  bookshelf_jade: tr("spot::Jade's bookshelf"),
  bookshelf_damien: tr("spot::Damien's bookshelf"),
  archive_shelf: tr("spot::Archive shelf"),
  card_catalog: tr("spot::Card catalogue"),
  display_case: tr("spot::Display case"),
  wall_shelf: tr("spot::Wall shelf"),
  book_stack: tr("spot::Stack of books"),
  paper_pile: tr("spot::Pile of paper"),
  paper_stack: tr("spot::Stack of paper"),
  fuse_box: tr("spot::Fuse box"),
  vault_safe: tr("spot::Safe"),
  whiteboard: tr("spot::Whiteboard"),
  cork_board: tr("spot::Cork board"),
  cork_board_live: tr("spot::Pin board"),
  chalkboard: tr("spot::Blackboard"),
  poster_halo: tr("spot::Poster"),
  poster_unstable: tr("spot::Poster"),
  poster_safety: tr("spot::Safety poster"),
  poster_telescope: tr("spot::Poster"),
  star_chart: tr("spot::Star chart"),
  sticky_wall: tr("spot::Sticky-note wall"),
  sticky_notes: tr("spot::Sticky notes"),
  chalk_tally: tr("spot::Chalk marks"),
  morse_chalk: tr("spot::Chalk marks"),
  calendar_2019: tr("spot::Calendar"),
  menu_board: tr("spot::Menu board"),
  fridge_magnets: tr("spot::Fridge magnets"),
  map_screen: tr("spot::Map screen"),
  crt_stack: tr("spot::Monitors"),
  crt_terminal: tr("spot::Old terminal"),
  workstation_pc: tr("spot::Workstation"),
  holo_table: tr("spot::Holo table"),
  diagnostic_rack: tr("spot::Diagnostic rack"),
  gauge_cluster: tr("spot::Gauges"),
  server_rack_a: tr("spot::Server rack"),
  server_rack_b: tr("spot::Server rack"),
  server_rack_c: tr("spot::Server rack"),
  server_rack_dark: tr("spot::Dead server rack"),
  notebook_open: tr("spot::Notebook"),
  legal_pads: tr("spot::Legal pads"),
  exit_sign: tr("spot::Sign"),
  hazard_decal: tr("spot::Warning decal"),
  radiation_sign: tr("spot::Warning sign"),
  wall_phone: tr("spot::Wall phone"),
  lever_panel: tr("spot::Lever panel"),
};

/** Spot name for a decor piece. */
export function spotName(decor: string): string {
  return SPOT_NAME[decor] ?? tr("spot::Something");
}

/**
 * The decor piece reacts to the archive (readable entries here, or it can be
 * searched) or is a board Jade can pin memos to (lib/world/memos.ts).
 */
export function isArchiveDecor(placementId: string, decor: string): boolean {
  return ARCHIVE_DECOR.has(placementId) || SEARCHABLE_DECOR.has(decor) || PIN_DECOR.has(decor);
}

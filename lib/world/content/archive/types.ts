/**
 * The lab archive — hints and knowledge hidden across the lab (types).
 * ====================================================================
 *
 * Everything a player could look up in a guide exists somewhere in the lab:
 * chalked on a board, pinned to a cork wall, on a device screen, taped
 * inside a locker, folded behind a vent grille. Each entry has
 *
 * - `value` — how far-reaching the information is (1 = basics … 5 = solves
 *   a secret / an ending outright), and
 * - `tier`  — how hard it is to find (1 = in plain sight … 5 = only by
 *   combining several finds and creative thinking).
 *
 * Balance rule (tests/world/archive.test.ts): tier ≥ value − 1, and value 5
 * is never below tier 4. Far-reaching knowledge is never lying around.
 *
 * How an entry is found (`find`):
 *   - `read`    interacting with the spot shows it (boards, posters, screens);
 *   - `search`  the spot must be searched (lockers, vents, drawers, behind
 *               shelves) — an explicit "Search" action at the spot;
 *   - `device`  appears on the device interface's INFO page (device online);
 *   - `combine` no spot at all: after finding every entry in `needs`, the
 *               player enters the right `answer` at an archive console
 *               (Journal → Archive → "Combine") — the answer follows from
 *               the needed entries, never stated in any single one.
 * `when` adds conditions (a device online, an item held — e.g. a UV lamp —,
 * a firmware feature, a link, the play clock …).
 */
import type { Condition } from "@/lib/world/types";

export type ArchiveTier = 1 | 2 | 3 | 4 | 5;

export type ArchiveTopic =
  | "basics"
  | "power"
  | "building"
  | "devices"
  | "firmware"
  | "network"
  | "combine"
  | "puzzles"
  | "doors"
  | "items"
  | "bots"
  | "lore"
  | "secrets"
  | "endings";

/** Where an entry sits (ids are validated by tests/world/archive.test.ts). */
export type ArchiveSpot =
  /** Decor placement id (content/interior.ts). */
  | { decor: string }
  /** Map prop id (content/map.ts PROPS). */
  | { prop: string }
  /** Device interface INFO page. */
  | { device: string }
  /** Room terminal id (content/terminals.ts) — listed under `archive` in its shell. */
  | { terminal: string }
  /** Note id (content/map.ts NOTES) — shown below the note text. */
  | { note: string };

export type ArchiveFind = "read" | "search" | "device" | "combine";

/** What an entry is about (for the dev book and balance tests). */
export interface ArchiveRef {
  kind:
    | "device"
    | "puzzle"
    | "door"
    | "recipe"
    | "ending"
    | "item"
    | "room"
    | "npc"
    | "hub"
    | "firmware";
  id: string;
}

export interface ArchiveEntry {
  id: string;
  tier: ArchiveTier;
  value: ArchiveTier;
  topic: ArchiveTopic;
  title: string;
  /** The information itself (English in tr(); may contain line breaks). */
  text: string;
  /** Who wrote / left it (optional flavour: "J.L.", "D.F.", "MCP-000", a bot). */
  by?: string;
  find: ArchiveFind;
  /** Spot for read / search / device entries (none for combine). */
  at?: ArchiveSpot;
  /** Extra conditions for the entry to be findable. */
  when?: Condition;
  /** Shown instead when `when` does not hold yet (a nudge, never the content). */
  whenHint?: string;
  /** Combine entries: the entries that must be found first. */
  needs?: readonly string[];
  /** Combine entries: the answer to enter (case/space-insensitive). */
  answer?: string;
  /** Combine entries: the question the console asks (shown once all needs are found). */
  prompt?: string;
  about?: readonly ArchiveRef[];
  /** Insights granted on finding. */
  grants?: readonly string[];
}

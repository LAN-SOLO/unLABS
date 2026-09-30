/**
 * Lab World — save migration + sanitising.
 * =========================================
 *
 * Every blob that enters the game from storage or an import goes through
 * `readSave(raw)`:
 *
 * 1. `migrateSave` detects the format version and runs the migration chain
 *    (`MIGRATIONS[v]` turns a v-save into a v+1-save) up to `SAVE_VERSION`.
 *    Saves from a *newer* build are rejected (never silently downgraded).
 * 2. `sanitizeSave` rebuilds a `WorldState` field by field on top of
 *    `initialState()`: missing / wrongly typed fields get defaults, unknown
 *    item / device / puzzle / insight / note / door / pickup / ending ids are
 *    dropped, generated prototypes are validated (and inventory entries whose
 *    item no longer resolves are removed), numbers are made finite and
 *    non-negative, and a position outside the map (or on a floor the save
 *    cannot reach) respawns the player at the elevator of that floor or at
 *    `SPAWN`.
 *
 * The result always satisfies the invariants the UI relies on (every id it
 * looks up with `ITEM_BY_ID` / `DEVICE_BY_ID` / `PUZZLE_BY_ID` exists).
 * Pure — no storage access.
 */
import { englishOf } from "@/lib/i18n";
import { COURSE_BY_ID } from "@/lib/world/content/courses";
import { MEMO_MAX, MEMO_TEXT_MAX, MEMO_TITLE_MAX } from "@/lib/world/memos";
import { ARCHIVE_BY_ID } from "@/lib/world/content/archive";
import { HUB_BY_ID } from "@/lib/world/content/links";
import { FIRMWARE } from "@/lib/world/firmware";
import { ARCHETYPE_BY_ID } from "@/lib/world/combine";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import {
  DOORS,
  ELEVATORS,
  FLOOR_BY_ID,
  FLOOR_SIZE,
  NOTES,
  PICKUPS,
  SPAWN,
  roomAt,
} from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { ENDING_BY_ID, INSIGHT_BY_ID } from "@/lib/world/content/story";
import {
  EXPERIMENT_LOG_MAX,
  SAVE_VERSION,
  STARTER_DEVICES,
  floorAccessible,
  initialState,
} from "@/lib/world/game";
import {
  SPECTRUM,
  TRAIT_AXES,
  type FloorId,
  type ItemDef,
  type ItemKind,
  type SpectrumColor,
  type Experiment,
  type Memo,
  type MemoPlace,
  type MemoSourceKind,
  type Traits,
  type WorldState,
} from "@/lib/world/types";
import { CORE } from "@/lib/world/content/floorplan";
import { sanitizeWardrobe } from "@/lib/world/wardrobe";

type Raw = Record<string, unknown>;

export function isRecord(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Keys of a `WorldState` (used to recognise a save without a version). */
const STATE_KEYS: readonly string[] = Object.keys(initialState()).filter((k) => k !== "version");

// ── Migration ────────────────────────────────────────────────────

/** One step: a save of version `v` → version `v + 1` (input may be malformed). */
export type Migration = (raw: Raw) => Raw;

/**
 * The migration chain. Key = version migrated *from*. Every version below
 * `SAVE_VERSION` needs an entry (checked by tests/world/save-robust.test.ts).
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v1 → v2: `held_<item>` flags were introduced (keepsake / codex "owned
  // once" tracking). Everything currently in the inventory has been held.
  1: (raw) => {
    const flags: Raw = isRecord(raw.flags) ? { ...raw.flags } : {};
    if (isRecord(raw.inventory)) {
      for (const [id, n] of Object.entries(raw.inventory)) {
        if (typeof n === "number" && n > 0) flags[`held_${id}`] = true;
      }
    }
    return { ...raw, flags, version: 2 };
  },
  // v2 → v3: dialogue flags `said_<npc>_<label>` are keyed by the English
  // source label (the game is English-first now); old saves used the German
  // label. Rewrite every German label that the dictionaries know.
  2: (raw) => {
    const flags: Raw = {};
    for (const [k, v] of Object.entries(isRecord(raw.flags) ? raw.flags : {})) {
      const m = /^said_([^_]+)_(.+)$/.exec(k);
      const en = m ? englishOf(m[2]!) : undefined;
      const key = m && en ? `said_${m[1]}_${en}` : k;
      flags[key] = flags[key] === true || v;
    }
    return { ...raw, flags, version: 3 };
  },
  // v3 → v4: device firmware, hub links, the lab archive and device interface
  // settings. Old saves run factory firmware, have nothing linked, found
  // nothing and use default settings.
  3: (raw) => ({
    ...raw,
    firmware: isRecord(raw.firmware) ? raw.firmware : {},
    links: isRecord(raw.links) ? raw.links : {},
    archive: isRecord(raw.archive) ? raw.archive : {},
    tuning: isRecord(raw.tuning) ? raw.tuning : {},
    version: 4,
  }),
  // v4 → v5: Jade's knowledge management — memos (written / filed / pinned),
  // study progress, last device readouts and recent workbench experiments.
  4: (raw) => ({
    ...raw,
    memos: Array.isArray(raw.memos) ? raw.memos : [],
    courses: isRecord(raw.courses) ? raw.courses : {},
    readouts: isRecord(raw.readouts) ? raw.readouts : {},
    experiments: Array.isArray(raw.experiments) ? raw.experiments : [],
    version: 5,
  }),
  // v5 → v6: Jade's wardrobe. Old saves start with the default look and the
  // starter pieces; sanitizeWardrobe fills in the rest.
  5: (raw) => ({
    ...raw,
    wardrobe: isRecord(raw.wardrobe) ? raw.wardrobe : {},
    version: 6,
  }),
};

export type MigrateResult =
  | { ok: true; data: Raw; from: number }
  | { ok: false; reason: "shape" | "future"; version?: number };

function detectVersion(raw: Raw): number | null {
  const v = raw.version;
  if (typeof v === "number" && Number.isInteger(v) && v >= 1) return v;
  if (typeof v === "string" && /^\d+$/.test(v) && Number(v) >= 1) return Number(v);
  // No usable version: accept it as a v1 save if it clearly is a world state.
  return STATE_KEYS.filter((k) => k in raw).length >= 3 ? 1 : null;
}

/** Detect the version of a parsed blob and migrate it to `SAVE_VERSION`. */
export function migrateSave(raw: unknown): MigrateResult {
  if (!isRecord(raw)) return { ok: false, reason: "shape" };
  const from = detectVersion(raw);
  if (from === null || !STATE_KEYS.some((k) => k in raw)) return { ok: false, reason: "shape" };
  if (from > SAVE_VERSION) return { ok: false, reason: "future", version: from };
  let data: Raw = raw;
  for (let v = from; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, reason: "shape" };
    data = step(data);
  }
  return { ok: true, data, from };
}

// ── Field sanitisers ─────────────────────────────────────────────

const ITEM_KINDS: readonly ItemKind[] = [
  "rohstoff",
  "bauteil",
  "prototyp",
  "relikt",
  "schlacke",
  "werkzeug",
];
const MAX_COUNT = 999_999;

function finiteNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Finite, non-negative number or `fallback`. */
function nonNeg(v: unknown, fallback = 0): number {
  const n = finiteNum(v);
  return n === null ? fallback : Math.max(0, n);
}

function record(v: unknown): Raw {
  return isRecord(v) ? v : {};
}

/** Collects repair notes (developer diagnostics in English, never shown to players). */
class Sanitizer {
  readonly issues: string[] = [];

  note(msg: string): void {
    if (this.issues.length < 200) this.issues.push(msg);
  }

  /** Copy `field` keeping entries whose key passes `keep` and whose value `map`s to non-null. */
  map<T>(
    raw: Raw,
    field: string,
    keep: (key: string) => boolean,
    map: (v: unknown, key: string) => T | null,
  ): Record<string, T> {
    const out: Record<string, T> = {};
    const src = raw[field];
    if (src !== undefined && !isRecord(src)) this.note(`${field}: not an object`);
    for (const [k, v] of Object.entries(record(src))) {
      if (!keep(k)) {
        this.note(`${field}: unknown id ${k}`);
        continue;
      }
      const m = map(v, k);
      if (m === null) this.note(`${field}.${k}: invalid value`);
      else out[k] = m;
    }
    return out;
  }
}

const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const trueOnly = (v: unknown): true | null => (v === true ? true : null);

/** A generated prototype definition, or null if it is unusable. */
function sanitizeItemDef(key: string, v: unknown): ItemDef | null {
  if (!isRecord(v)) return null;
  if (v.id !== undefined && v.id !== key) return null;
  if (typeof v.name !== "string" || !v.name.trim()) return null;
  const traitsRaw = record(v.traits);
  const traits = Object.fromEntries(
    TRAIT_AXES.map((a) => [a, nonNeg(traitsRaw[a])]),
  ) as unknown as Traits;
  const kind = ITEM_KINDS.includes(v.kind as ItemKind) ? (v.kind as ItemKind) : "prototyp";
  const color = SPECTRUM.includes(v.color as SpectrumColor)
    ? (v.color as SpectrumColor)
    : SPECTRUM[0];
  const def: ItemDef = {
    id: key,
    name: v.name.slice(0, 80),
    kind,
    description: typeof v.description === "string" ? v.description : "",
    traits,
    color,
    volatility: Math.min(5, Math.max(1, Math.round(nonNeg(v.volatility, 1)))),
    depth: Math.min(99, Math.round(nonNeg(v.depth, 1))),
  };
  if (Array.isArray(v.parents)) {
    def.parents = v.parents.filter((p): p is string => typeof p === "string");
  }
  if (typeof v.archetype === "string" && ARCHETYPE_BY_ID.has(v.archetype)) {
    def.archetype = v.archetype;
  }
  return def;
}

function isFloorId(v: unknown): v is FloorId {
  return typeof v === "number" && Number.isInteger(v) && v in FLOOR_BY_ID;
}

/** Where a player lands on `floor` when their saved position is unusable. */
export function spawnFor(floor: FloorId): [number, number, number] {
  if (floor === SPAWN.floor) return [...SPAWN.pos];
  const e = ELEVATORS.find((x) => x.floor === floor) ?? { x: CORE.x, z: CORE.z };
  return [e.x - 6, 1, e.z];
}

/** True if `pos` lies inside the map and inside a room of `floor`. */
export function positionValid(floor: FloorId, pos: readonly number[]): boolean {
  const [x, y, z] = pos;
  if (x === undefined || y === undefined || z === undefined) return false;
  if (![x, y, z].every(Number.isFinite)) return false;
  if (x < 0 || z < 0 || x >= FLOOR_SIZE.x || z >= FLOOR_SIZE.z) return false;
  if (y < 0 || y > FLOOR_SIZE.y) return false;
  return !!roomAt(floor, Math.floor(x), Math.floor(z));
}

const PICKUP_IDS = new Set(PICKUPS.map((p) => p.id));
const NOTE_IDS = new Set(NOTES.map((n) => n.id));
const DOOR_IDS = new Set(DOORS.map((d) => d.id));

export interface SanitizeResult {
  state: WorldState;
  /** Human-readable list of what was repaired or dropped (capped). */
  issues: string[];
}

/**
 * Rebuild a playable `WorldState` from a migrated (current-version) blob.
 * Never throws.
 */
export function sanitizeSave(raw: Raw): SanitizeResult {
  const z = new Sanitizer();
  const base = initialState();

  // Prototypes first — the inventory and recipe book resolve against them.
  const generated = z.map(
    raw,
    "generated",
    (k) => !ITEM_BY_ID.has(k),
    (v, k) => sanitizeItemDef(k, v),
  );
  const resolves = (id: string): boolean => ITEM_BY_ID.has(id) || id in generated;

  const inventory = z.map(raw, "inventory", resolves, (v) => {
    const n = finiteNum(v);
    return n !== null && n >= 1 ? Math.min(MAX_COUNT, Math.floor(n)) : null;
  });

  const built = z.map(
    raw,
    "built",
    (k) => DEVICE_BY_ID.has(k),
    (v, k) => {
      const n = finiteNum(v);
      if (n === null) return null;
      const max = DEVICE_BY_ID.get(k)?.stages.length ?? 0;
      return Math.min(max, Math.max(0, Math.floor(n)));
    },
  );
  for (const [k, n] of Object.entries(base.built)) built[k] = Math.max(built[k] ?? 0, n);
  for (const k of Object.keys(built)) if (built[k] === 0) delete built[k];

  const discovered = z.map(raw, "discovered", (k) => DEVICE_BY_ID.has(k), bool);
  for (const id of STARTER_DEVICES) discovered[id] = true;

  const insights = z.map(
    raw,
    "insights",
    (k) => INSIGHT_BY_ID.has(k),
    (v) => {
      if (v === true) return 1;
      const n = finiteNum(v);
      return n !== null && n > 0 ? Math.max(1, Math.round(n)) : null;
    },
  );

  const log: WorldState["log"] = [];
  if (Array.isArray(raw.log)) {
    for (const e of raw.log.slice(-200)) {
      if (isRecord(e) && typeof e.text === "string") log.push({ t: nonNeg(e.t), text: e.text });
    }
  } else if (raw.log !== undefined) z.note("log: not a list");

  const s: WorldState = {
    version: SAVE_VERSION,
    floor: base.floor,
    pos: base.pos,
    inventory,
    generated,
    built,
    switchedOn: z.map(raw, "switchedOn", (k) => DEVICE_BY_ID.has(k), bool),
    discovered,
    insights,
    flags: z.map(raw, "flags", (k) => k.length > 0, bool),
    puzzles: z.map(raw, "puzzles", (k) => PUZZLE_BY_ID.has(k), trueOnly),
    taken: z.map(
      raw,
      "taken",
      (k) => PICKUP_IDS.has(k),
      (v) => (v === true ? 0 : finiteNum(v) === null ? null : nonNeg(v)),
    ),
    read: z.map(raw, "read", (k) => NOTE_IDS.has(k), bool),
    doorsOpen: z.map(raw, "doorsOpen", (k) => DOOR_IDS.has(k), bool),
    endings: z.map(raw, "endings", (k) => ENDING_BY_ID.has(k), trueOnly),
    recipesKnown: z.map(
      raw,
      "recipesKnown",
      (k) => k.length > 0,
      (v) => (typeof v === "string" && resolves(v) ? v : null),
    ),
    log: log.length ? log : base.log,
    playTime: nonNeg(raw.playTime),
    combos: Math.floor(nonNeg(raw.combos)),
    counters: z.map(
      raw,
      "counters",
      (k) => k.length > 0,
      (v) => (finiteNum(v) === null ? null : nonNeg(v)),
    ),
    firmware: z.map(
      raw,
      "firmware",
      (k) => FIRMWARE.has(k),
      (v) => (typeof v === "string" && SEMVER.test(v) ? v : null),
    ),
    links: sanitizeLinks(z, raw, built),
    archive: z.map(
      raw,
      "archive",
      (k) => ARCHIVE_BY_ID.has(k),
      (v) => {
        const n = finiteNum(v);
        return n !== null && n > 0 ? Math.max(1, Math.round(n)) : v === true ? 1 : null;
      },
    ),
    tuning: z.map(
      raw,
      "tuning",
      (k) => /^[A-Z0-9]+-\d+\.[a-z0-9_]+$/.test(k) && DEVICE_BY_ID.has(k.split(".")[0]!),
      (v) => finiteNum(v),
    ),
    memos: sanitizeMemos(z, raw.memos),
    courses: z.map(
      raw,
      "courses",
      (k) => COURSE_BY_ID.has(k),
      (v) => {
        const n = finiteNum(v);
        return n !== null && n > 0 ? Math.min(n, 1e7) : null;
      },
    ),
    readouts: z.map(
      raw,
      "readouts",
      (k) => DEVICE_BY_ID.has(k),
      (v) =>
        isRecord(v) && Array.isArray(v.lines)
          ? {
              t: nonNeg(v.t),
              lines: v.lines
                .filter((l): l is string => typeof l === "string")
                .slice(0, 12)
                .map((l) => l.slice(0, 300)),
            }
          : null,
    ),
    experiments: sanitizeExperiments(raw.experiments),
    wardrobe: sanitizeWardrobe(raw.wardrobe),
  };

  // Position: a known, reachable floor and a spot inside one of its rooms.
  let floor: FloorId = isFloorId(raw.floor) ? raw.floor : SPAWN.floor;
  if (!isFloorId(raw.floor)) z.note("floor: invalid");
  if (!floorAccessible(s, floor)) {
    z.note(`floor ${floor}: not reachable`);
    floor = SPAWN.floor;
  }
  const pos = Array.isArray(raw.pos) ? raw.pos.slice(0, 3).map((n) => finiteNum(n) ?? NaN) : [];
  s.floor = floor;
  if (floor === raw.floor && positionValid(floor, pos)) {
    s.pos = [pos[0]!, Math.max(1, pos[1]!), pos[2]!];
  } else {
    if (floor === raw.floor) z.note("pos: outside the map");
    s.pos = spawnFor(floor);
  }
  return { state: s, issues: z.issues };
}

const SEMVER = /^\d+\.\d+\.\d+$/;

const MEMO_PLACE = /^(mind|pc|decor:[\w:.-]{1,80})$/;
const MEMO_KINDS: ReadonlySet<string> = new Set([
  "archive",
  "insight",
  "readout",
  "recipe",
  "note",
  "log",
  "puzzle",
  "device",
  "course",
  "experiment",
  "message",
  "custom",
]);

/** Memos: well-formed, bounded text, unique ids, capped count. */
function sanitizeMemos(z: Sanitizer, raw: unknown): Memo[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    z.note("memos: not a list");
    return [];
  }
  const out: Memo[] = [];
  const ids = new Set<string>();
  for (const m of raw) {
    if (!isRecord(m) || typeof m.id !== "string" || ids.has(m.id)) continue;
    if (typeof m.title !== "string" || typeof m.text !== "string") continue;
    const place =
      typeof m.place === "string" && MEMO_PLACE.test(m.place) ? (m.place as MemoPlace) : "mind";
    const memo: Memo = {
      id: m.id.slice(0, 40),
      title: m.title.slice(0, MEMO_TITLE_MAX),
      text: m.text.slice(0, MEMO_TEXT_MAX),
      t: nonNeg(m.t),
      place,
    };
    if (isRecord(m.source) && typeof m.source.kind === "string" && MEMO_KINDS.has(m.source.kind))
      memo.source = {
        kind: m.source.kind as MemoSourceKind,
        ...(typeof m.source.id === "string" ? { id: m.source.id.slice(0, 80) } : {}),
      };
    if (Array.isArray(m.tags))
      memo.tags = m.tags
        .filter((x): x is string => typeof x === "string")
        .slice(0, 8)
        .map((x) => x.slice(0, 24));
    ids.add(memo.id);
    out.push(memo);
    if (out.length >= MEMO_MAX) break;
  }
  if (out.length !== raw.length) z.note("memos: cleaned");
  return out;
}

function sanitizeExperiments(raw: unknown): Experiment[] {
  if (!Array.isArray(raw)) return [];
  const out: Experiment[] = [];
  for (const e of raw.slice(-EXPERIMENT_LOG_MAX)) {
    if (!isRecord(e) || !isRecord(e.inputs)) continue;
    const outcome = e.outcome;
    if (
      outcome !== "recipe" &&
      outcome !== "prototype" &&
      outcome !== "explosion" &&
      outcome !== "fail"
    )
      continue;
    const inputs: Record<string, number> = {};
    for (const [k, v] of Object.entries(e.inputs)) {
      const n = finiteNum(v);
      if (n !== null && n > 0) inputs[k] = Math.floor(n);
    }
    out.push({
      t: nonNeg(e.t),
      inputs,
      outcome,
      ...(typeof e.output === "string" ? { output: e.output } : {}),
    });
  }
  return out;
}

/** Hub → linked devices: known hubs, built devices, unique, within capacity. */
function sanitizeLinks(
  z: Sanitizer,
  raw: Raw,
  built: Record<string, number>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (raw.links === undefined) return out;
  if (!isRecord(raw.links)) {
    z.note("links: not a record");
    return out;
  }
  for (const [hub, list] of Object.entries(raw.links)) {
    const def = HUB_BY_ID.get(hub);
    if (!def || !Array.isArray(list)) {
      z.note(`links.${hub}: dropped`);
      continue;
    }
    const ids = [
      ...new Set(
        list.filter(
          (id): id is string =>
            typeof id === "string" && id !== hub && DEVICE_BY_ID.has(id) && (built[id] ?? 0) > 0,
        ),
      ),
    ].slice(0, def.capacity);
    if (ids.length !== list.length) z.note(`links.${hub}: cleaned`);
    if (ids.length) out[hub] = ids;
  }
  return out;
}

export type ReadResult =
  | { ok: true; state: WorldState; issues: string[]; from: number }
  | { ok: false; reason: "shape" | "future"; version?: number };

/** Migrate + sanitise a parsed blob. */
export function readSave(raw: unknown): ReadResult {
  const m = migrateSave(raw);
  if (!m.ok) return m;
  const { state, issues } = sanitizeSave(m.data);
  return { ok: true, state, issues, from: m.from };
}

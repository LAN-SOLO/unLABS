/**
 * Lab World — save slots.
 * =======================
 *
 * Three manual slots plus one autosave slot, each a JSON `WorldState` blob:
 *   unlabs.world.v1.slot1 .. slot3, unlabs.world.v1.auto
 * Metadata for the slot list lives in `unlabs.world.v1.meta`, the active slot
 * id in `unlabs.world.v1.active`. A legacy single save (`unlabs.world.v1`) is
 * copied into slot 1 once (the legacy blob is left in place as a backup).
 *
 * Robustness: every blob read from storage or an import is migrated to the
 * current `SAVE_VERSION` and sanitised (`save-sanitize.ts`), so saves from
 * earlier builds load with defaults for new fields and without unknown ids.
 * A slot whose data cannot be read is listed as `corrupt` ("beschädigt")
 * instead of breaking the title screen; the active slot's unreadable blob is
 * stashed under `<slot key>.corrupt` before a fresh game may overwrite it.
 * The autosave keeps its previous version under `<auto key>.bak` and falls
 * back to it when the main autosave is unreadable.
 *
 * `loadWorld()` / `saveWorld()` / `resetWorld()` keep their old signatures and
 * operate on the active slot. Every state object handed out is *bound* to the
 * slot (and slot generation) it came from, so a late flush of a stale state
 * (e.g. useWorld's unmount flush after the player switched slots) can never
 * overwrite another slot or a freshly started / imported game.
 */

import { intlLocale, tr } from "@/lib/i18n";
import { FLOOR_BY_ID, roomAt } from "@/lib/world/content/map";
import { ENDINGS } from "@/lib/world/content/story";
import { SAVE_VERSION, initialState, progress } from "@/lib/world/game";
import { newGamePlus } from "@/lib/world/postgame";
import { isRecord, migrateSave, readSave } from "@/lib/world/save-sanitize";
import type { FloorId, WorldState } from "@/lib/world/types";

export { SAVE_VERSION };
export { MIGRATIONS, migrateSave, readSave, sanitizeSave } from "@/lib/world/save-sanitize";

/** Legacy single-save key; also the prefix of every slot key. */
export const SAVE_KEY = "unlabs.world.v1";
export const META_KEY = `${SAVE_KEY}.meta`;
export const ACTIVE_KEY = `${SAVE_KEY}.active`;
export const MIGRATED_KEY = `${SAVE_KEY}.migrated`;

export const SLOT_IDS = ["slot1", "slot2", "slot3", "auto"] as const;
export type SlotId = (typeof SLOT_IDS)[number];
export const MANUAL_SLOTS: readonly SlotId[] = ["slot1", "slot2", "slot3"];

export const SLOT_NAME: Record<SlotId, string> = {
  slot1: tr("Save slot {n}", { n: 1 }),
  slot2: tr("Save slot {n}", { n: 2 }),
  slot3: tr("Save slot {n}", { n: 3 }),
  auto: tr("Autosave"),
};

export interface SlotMeta {
  /** ISO timestamp of the last write. */
  savedAt: string;
  /** Seconds. */
  playTime: number;
  floor: FloorId;
  /** Human floor name, e.g. "Level −1 · Power & Fabrication". */
  floorName: string;
  room?: string;
  devices: number;
  totalDevices: number;
  insights: number;
  totalInsights: number;
  endings: number;
  totalEndings: number;
  label: string;
}

export interface SlotInfo {
  id: SlotId;
  name: string;
  /** No loadable save (also true for a corrupt slot). */
  empty: boolean;
  /** The slot holds data that cannot be read ("beschädigt"). */
  corrupt: boolean;
  active: boolean;
  meta: SlotMeta | null;
}

export function isSlotId(v: unknown): v is SlotId {
  return typeof v === "string" && (SLOT_IDS as readonly string[]).includes(v);
}

export function slotKey(id: SlotId): string {
  return `${SAVE_KEY}.${id}`;
}

/** Previous autosave (fallback when the autosave is unreadable). */
export function backupKey(id: SlotId): string {
  return `${slotKey(id)}.bak`;
}

/** Unreadable data of a slot, kept aside before it gets overwritten. */
export function corruptKey(id: SlotId): string {
  return `${slotKey(id)}.corrupt`;
}

// ── Storage primitives (never throw) ─────────────────────────────

function read(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Storage full or blocked — the session keeps running in memory.
    return false;
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function parse(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

// ── Hydration ────────────────────────────────────────────────────

/** True if the blob is a world save this build can load (any version up to the current one). */
export function isWorldSave(raw: unknown): boolean {
  return migrateSave(raw).ok;
}

/**
 * Migrate + sanitise a parsed save into a playable state (fresh state if the
 * blob is not a loadable save). Never throws.
 */
export function hydrate(raw: unknown): WorldState {
  const r = readSave(raw);
  return r.ok ? r.state : initialState();
}

type SlotRead =
  | { status: "empty" }
  | { status: "corrupt"; text: string }
  | { status: "ok"; state: WorldState; fromBackup: boolean };

/** Read + validate a slot; the autosave falls back to its backup. */
function readSlot(id: SlotId): SlotRead {
  const text = read(slotKey(id));
  if (text !== null) {
    const r = readSave(parse(text));
    if (r.ok) return { status: "ok", state: r.state, fromBackup: false };
  }
  if (id === "auto") {
    const r = readSave(parse(read(backupKey(id))));
    if (r.ok) return { status: "ok", state: r.state, fromBackup: true };
  }
  return text === null ? { status: "empty" } : { status: "corrupt", text };
}

// ── Meta ─────────────────────────────────────────────────────────

/** Pure: the slot-list summary of a state. */
export function computeMeta(s: WorldState, label?: string, savedAt = new Date()): SlotMeta {
  const p = progress(s);
  const floor: FloorId = FLOOR_BY_ID[s.floor] ? s.floor : 0;
  const room = roomAt(floor, Math.floor(s.pos[0]), Math.floor(s.pos[2]));
  const floorName = FLOOR_BY_ID[floor].name;
  return {
    savedAt: savedAt.toISOString(),
    playTime: Math.max(0, Math.floor(s.playTime)),
    floor,
    floorName,
    ...(room ? { room: room.name } : {}),
    devices: p.devices,
    totalDevices: p.totalDevices,
    insights: p.insights,
    totalInsights: p.totalInsights,
    endings: p.endings,
    totalEndings: ENDINGS.length,
    label: label ?? (room ? `${FLOOR_BY_ID[floor].short} · ${room.name}` : floorName),
  };
}

type MetaRecord = Partial<Record<SlotId, SlotMeta>>;

const META_NUMBERS = [
  "playTime",
  "devices",
  "totalDevices",
  "insights",
  "totalInsights",
  "endings",
  "totalEndings",
] as const;

/** Full shape check — the slot list renders every field. */
function isSlotMeta(m: unknown): m is SlotMeta {
  return (
    isRecord(m) &&
    typeof m.savedAt === "string" &&
    typeof m.floorName === "string" &&
    typeof m.label === "string" &&
    (m.room === undefined || typeof m.room === "string") &&
    typeof m.floor === "number" &&
    m.floor in FLOOR_BY_ID &&
    META_NUMBERS.every((k) => typeof m[k] === "number" && Number.isFinite(m[k]))
  );
}

function readMeta(): MetaRecord {
  const raw = parse(read(META_KEY));
  if (!isRecord(raw)) return {};
  const out: MetaRecord = {};
  for (const id of SLOT_IDS) {
    const m = raw[id];
    if (isSlotMeta(m)) out[id] = m;
  }
  return out;
}

function writeMeta(meta: MetaRecord): void {
  write(META_KEY, JSON.stringify(meta));
}

function setMeta(id: SlotId, m: SlotMeta | null): void {
  const meta = readMeta();
  if (m) meta[id] = m;
  else delete meta[id];
  writeMeta(meta);
}

// ── Binding (which slot a live state object belongs to) ──────────

interface Binding {
  slot: SlotId;
  gen: number;
}

const bindings = new WeakMap<WorldState, Binding>();
const generations: Record<SlotId, number> = { slot1: 0, slot2: 0, slot3: 0, auto: 0 };

function bind(s: WorldState, slot: SlotId): WorldState {
  bindings.set(s, { slot, gen: generations[slot] });
  return s;
}

/** Invalidate every live state object bound to `slot`. */
function bump(slot: SlotId): void {
  generations[slot] += 1;
}

/** The slot a state object was loaded from / last saved to (null if unbound). */
export function slotOf(s: WorldState): SlotId | null {
  return bindings.get(s)?.slot ?? null;
}

// ── Migration ────────────────────────────────────────────────────

/** Copy a legacy single save into slot 1 (once). Idempotent. */
export function migrateLegacy(): void {
  if (read(MIGRATED_KEY)) return;
  const legacy = parse(read(SAVE_KEY));
  if (isWorldSave(legacy) && read(slotKey("slot1")) === null) {
    const s = hydrate(legacy);
    if (write(slotKey("slot1"), JSON.stringify(s))) {
      setMeta("slot1", computeMeta(s));
      if (read(ACTIVE_KEY) === null) write(ACTIVE_KEY, "slot1");
    }
  }
  write(MIGRATED_KEY, "1");
}

// ── Active slot ──────────────────────────────────────────────────

export function getActiveSlot(): SlotId {
  migrateLegacy();
  const v = read(ACTIVE_KEY);
  return isSlotId(v) ? v : "slot1";
}

export function setActiveSlot(id: SlotId): void {
  write(ACTIVE_KEY, id);
}

// ── Slot API ─────────────────────────────────────────────────────

/** The slot holds a loadable save (the autosave counts its backup). */
export function slotExists(id: SlotId): boolean {
  migrateLegacy();
  return readSlot(id).status === "ok";
}

/** Any slot holds a save (for "Fortsetzen"). */
export function hasAnySave(): boolean {
  return SLOT_IDS.some((id) => slotExists(id));
}

/** The most recently written non-empty slot. */
export function latestSlot(): SlotId | null {
  let best: SlotInfo | null = null;
  for (const info of listSlots()) {
    if (info.empty || !info.meta) continue;
    if (!best || info.meta.savedAt > best.meta!.savedAt) best = info;
  }
  return best?.id ?? null;
}

export function listSlots(): SlotInfo[] {
  migrateLegacy();
  const meta = readMeta();
  const active = getActiveSlot();
  let repaired = false;
  const out = SLOT_IDS.map((id): SlotInfo => {
    const base = { id, name: SLOT_NAME[id], active: id === active };
    const r = readSlot(id);
    if (r.status !== "ok")
      return { ...base, empty: true, corrupt: r.status === "corrupt", meta: null };
    let m = meta[id];
    if (r.fromBackup) {
      // The stored meta describes the unreadable autosave — show the backup's.
      m = computeMeta(
        r.state,
        tr("Autosave (backup) · {label}", { label: computeMeta(r.state).label }),
        new Date(0),
      );
    } else if (!m) {
      m = computeMeta(r.state, undefined, new Date(0));
      meta[id] = m;
      repaired = true;
    }
    return { ...base, empty: false, corrupt: false, meta: m };
  });
  if (repaired) writeMeta(meta);
  return out;
}

/**
 * Read a slot (null if empty or corrupt; the autosave falls back to its
 * backup). The state is migrated, sanitised and bound to that slot.
 */
export function loadSlot(id: SlotId): WorldState | null {
  migrateLegacy();
  const r = readSlot(id);
  return r.status === "ok" ? bind(r.state, id) : null;
}

/** True if the slot holds data that cannot be read. */
export function slotCorrupt(id: SlotId): boolean {
  return readSlot(id).status === "corrupt";
}

export interface SaveOptions {
  /** Make `id` the active slot and bind `state` to it ("Speichern unter"). */
  activate?: boolean;
  /** Custom label for the slot list. */
  label?: string;
}

/** Write `state` into slot `id` and refresh its meta. Returns false if storage failed. */
export function saveToSlot(id: SlotId, state: WorldState, opts: SaveOptions = {}): boolean {
  migrateLegacy();
  if (id === "auto") rotateBackup(id);
  const ok = write(slotKey(id), JSON.stringify(state));
  if (!ok) return false;
  setMeta(id, computeMeta(state, opts.label));
  if (opts.activate) {
    bump(id);
    bind(state, id);
    setActiveSlot(id);
  }
  return true;
}

/** Keep the current (readable) content of `id` as its backup before overwriting it. */
function rotateBackup(id: SlotId): void {
  const cur = read(slotKey(id));
  if (cur !== null && readSave(parse(cur)).ok) write(backupKey(id), cur);
}

/** Remove a slot's data, backup and stashed corrupt copy. */
function clearSlotData(id: SlotId): void {
  remove(slotKey(id));
  remove(backupKey(id));
  remove(corruptKey(id));
}

/** Autosave: copy the running state into the autosave slot (does not rebind). */
export function autosave(state: WorldState): boolean {
  return saveToSlot("auto", state, {
    label: tr("Autosave · {label}", { label: computeMeta(state).label }),
  });
}

export function deleteSlot(id: SlotId): void {
  migrateLegacy();
  bump(id);
  clearSlotData(id);
  setMeta(id, null);
}

export function renameSlot(id: SlotId, label: string): void {
  const meta = readMeta();
  const m = meta[id];
  if (!m) return;
  meta[id] = { ...m, label: label.trim().slice(0, 40) || m.label };
  writeMeta(meta);
}

/** Start a fresh game in slot `id` (overwrites it) and make it active. */
export function newGame(id: SlotId): WorldState {
  migrateLegacy();
  bump(id);
  const s = initialState();
  write(slotKey(id), JSON.stringify(s));
  setMeta(id, computeMeta(s));
  setActiveSlot(id);
  return bind(s, id);
}

/**
 * Start "Neues Spiel+" in `id`, carrying achievements, codex knowledge and
 * recipes over from `prev` (see postgame.ts `newGamePlus`).
 */
export function newGamePlusGame(id: SlotId, prev: WorldState): WorldState {
  migrateLegacy();
  bump(id);
  const s = newGamePlus(prev);
  write(slotKey(id), JSON.stringify(s));
  setMeta(id, computeMeta(s, tr("New Game+")));
  setActiveSlot(id);
  return bind(s, id);
}

/** Slots whose save reached at least one ending (source for Neues Spiel+). */
export function finishedSlots(): SlotId[] {
  return SLOT_IDS.filter((id) => {
    const st = loadSlot(id);
    return (
      !!st &&
      (Object.keys(st.endings).length > 0 ||
        Object.keys(st.flags).some((f) => f.startsWith("legacy_ending_")))
    );
  });
}

// ── Legacy-compatible API (active slot) ──────────────────────────

/** Load the active slot (fresh state if empty). Bound to the active slot. */
export function loadWorld(): WorldState {
  const id = getActiveSlot();
  const r = readSlot(id);
  if (r.status === "ok") return bind(r.state, id);
  // The fresh game will overwrite the slot — keep unreadable data aside.
  if (r.status === "corrupt" && read(corruptKey(id)) === null) write(corruptKey(id), r.text);
  return bind(initialState(), id);
}

/**
 * Persist a running state into the slot it is bound to (unbound → active
 * slot). Stale states whose slot was since deleted, overwritten by a new
 * game or imported into are dropped silently.
 */
export function saveWorld(s: WorldState): void {
  const b = bindings.get(s);
  if (b && b.gen !== generations[b.slot]) return;
  const id = b?.slot ?? getActiveSlot();
  if (!b) bind(s, id);
  saveToSlot(id, s);
}

/** Clear the active slot and return a fresh state bound to it. */
export function resetWorld(): WorldState {
  const id = getActiveSlot();
  deleteSlot(id);
  return bind(initialState(), id);
}

// ── Export / import ──────────────────────────────────────────────

interface ExportEnvelope {
  format: "unlabs-world";
  version: 1;
  exportedAt: string;
  meta: SlotMeta;
  state: WorldState;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Base64 JSON envelope of a slot ("" if the slot is empty). */
export function exportSave(id: SlotId): string {
  const s = loadSlot(id);
  if (!s) return "";
  const env: ExportEnvelope = {
    format: "unlabs-world",
    version: 1,
    exportedAt: new Date().toISOString(),
    meta: readMeta()[id] ?? computeMeta(s),
    state: s,
  };
  return toBase64(JSON.stringify(env));
}

export type ImportResult =
  | {
      ok: true;
      meta: SlotMeta;
      /** Entries dropped or repaired while importing. */ repaired: number;
    }
  | { ok: false; error: string };

/** Largest import accepted (characters). */
export const MAX_IMPORT = 8_000_000;

export type ParsedImport =
  | {
      ok: true;
      state: WorldState;
      /** Label carried by an export envelope (trimmed to 40 characters). */
      label?: string;
      /** Entries dropped or repaired while reading. */
      repaired: number;
    }
  | { ok: false; error: string };

/**
 * Pure: read an exported code (base64 envelope, or raw JSON state/envelope)
 * into a migrated, sanitised state without touching storage. `importSave`
 * and the beta-save link preview both go through here.
 */
export function parseImport(text: string): ParsedImport {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: tr("No save code entered.") };
  if (trimmed.length > MAX_IMPORT) return { ok: false, error: tr("Save code is too large.") };
  let raw: unknown = null;
  try {
    raw = JSON.parse(trimmed.startsWith("{") ? trimmed : fromBase64(trimmed)) as unknown;
  } catch {
    return { ok: false, error: tr("Save code is damaged or incomplete.") };
  }
  const candidate = isRecord(raw) && raw.format === "unlabs-world" ? raw.state : raw;
  const r = readSave(candidate);
  if (!r.ok) {
    return {
      ok: false,
      error:
        r.reason === "future"
          ? tr(
              "This save comes from a newer version (v{version}); this version only knows up to v{max}.",
              { version: r.version ?? "?", max: SAVE_VERSION },
            )
          : tr("Not a valid _unLAB save."),
    };
  }
  const label =
    isRecord(raw) && isRecord(raw.meta) && typeof raw.meta.label === "string"
      ? raw.meta.label.slice(0, 40)
      : undefined;
  return { ok: true, state: r.state, repaired: r.issues.length, ...(label ? { label } : {}) };
}

/** Import an exported code (base64 envelope, or raw JSON state/envelope) into slot `id`. */
export function importSave(id: SlotId, text: string): ImportResult {
  const p = parseImport(text);
  if (!p.ok) return p;
  const s = p.state;
  bump(id);
  if (id === "auto") rotateBackup(id);
  if (!write(slotKey(id), JSON.stringify(s))) {
    return { ok: false, error: tr("Storage full or blocked.") };
  }
  remove(corruptKey(id));
  const meta = computeMeta(s, p.label);
  setMeta(id, meta);
  return { ok: true, meta, repaired: p.repaired };
}

// ── Manual-slot backup (beta-save links) ─────────────────────────

/**
 * Keep the current readable save of a manual slot as its backup
 * (`<slot key>.bak`) before something external overwrites it. Returns false
 * when there was nothing to keep. Restore with `restoreBackup`.
 */
export function backupSlot(id: SlotId): boolean {
  if (id === "auto") return false;
  const cur = read(slotKey(id));
  if (cur === null || !readSave(parse(cur)).ok) return false;
  return write(backupKey(id), cur);
}

/** Meta of a manual slot's restorable backup (null if there is none). */
export function backupMeta(id: SlotId): SlotMeta | null {
  if (id === "auto") return null;
  const r = readSave(parse(read(backupKey(id))));
  return r.ok ? computeMeta(r.state, undefined, new Date(0)) : null;
}

/**
 * Swap a manual slot with its backup (so a restore can be undone the same
 * way). An empty slot simply gets the backup back.
 */
export function restoreBackup(id: SlotId): boolean {
  if (id === "auto") return false;
  const bak = read(backupKey(id));
  const r = readSave(parse(bak));
  if (bak === null || !r.ok) return false;
  const cur = read(slotKey(id));
  bump(id);
  if (!write(slotKey(id), JSON.stringify(r.state))) return false;
  if (cur !== null && readSave(parse(cur)).ok) write(backupKey(id), cur);
  else remove(backupKey(id));
  remove(corruptKey(id));
  setMeta(id, computeMeta(r.state));
  return true;
}

// ── Formatting helpers ───────────────────────────────────────────

/** Seconds → "hh:mm". */
export function formatPlayTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** ISO → "09/27/2026, 02:05 PM" (en) / "27.09.2026, 14:05" (de). */
export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "—";
  return d.toLocaleString(intlLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

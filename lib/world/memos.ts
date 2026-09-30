/**
 * Jade's knowledge base — memos (pure).
 * =====================================
 *
 * Whatever Jade learns can be written down: an archive find, an insight, a
 * device readout, a recipe, an experiment, a note, a log line — or her own
 * words. A memo lives in one place:
 *
 * - `mind`   — her personal knowledge panel (always with her);
 * - `pc`     — filed on her computer (Jade's Quarters), browsable there;
 * - `decor:<placement>` — pinned to a board somewhere in the lab (cork
 *   boards, whiteboards, sticky-note walls, fridge magnets …): readable at
 *   that board, and shown on it.
 *
 * Memos are part of the save (`WorldState.memos`, sanitised in save-sanitize).
 */
import { tr } from "@/lib/i18n";
import type { Memo, MemoPlace, MemoSourceKind, WorldState } from "@/lib/world/types";

export const MEMO_MAX = 400;
export const MEMO_TITLE_MAX = 60;
export const MEMO_TEXT_MAX = 600;
/** How many memos fit on one board. */
export const BOARD_CAPACITY = 12;

/** Furniture that notes can be pinned / stuck / chalked onto. */
export const PIN_DECOR: ReadonlySet<string> = new Set([
  "cork_board",
  "whiteboard",
  "chalkboard",
  "sticky_wall",
  "sticky_notes",
  "fridge_magnets",
  "menu_board",
  "cork_board_live",
]);

export type MemoResult = { ok: true; memo: Memo } | { ok: false; message: string };

function nextId(s: WorldState): string {
  const n = (s.counters.memo_seq ?? 0) + 1;
  s.counters.memo_seq = n;
  return `m${n}`;
}

/** Memo already written from this source (so "Remember" is idempotent). */
export function memoFrom(s: WorldState, kind: MemoSourceKind, id: string): Memo | undefined {
  return s.memos.find((m) => m.source?.kind === kind && m.source.id === id);
}

export function addMemo(
  s: WorldState,
  m: {
    title: string;
    text: string;
    place?: MemoPlace;
    source?: { kind: MemoSourceKind; id?: string };
    tags?: readonly string[];
  },
): MemoResult {
  const title = m.title.trim().slice(0, MEMO_TITLE_MAX);
  const text = m.text.trim().slice(0, MEMO_TEXT_MAX);
  if (!title && !text) return { ok: false, message: tr("An empty note is not worth the paper.") };
  if (m.source?.id) {
    const dup = memoFrom(s, m.source.kind, m.source.id);
    if (dup) return { ok: true, memo: dup };
  }
  if (s.memos.length >= MEMO_MAX)
    return { ok: false, message: tr("Your knowledge base is full — tidy up some memos first.") };
  const place = m.place ?? "mind";
  if (place.startsWith("decor:") && pinnedAt(s, place).length >= BOARD_CAPACITY)
    return { ok: false, message: tr("This board is full.") };
  const memo: Memo = {
    id: nextId(s),
    title: title || text.slice(0, 40),
    text,
    t: Math.round(s.playTime),
    place,
    ...(m.source ? { source: { ...m.source } } : {}),
    ...(m.tags?.length ? { tags: m.tags.slice(0, 8).map((x) => x.slice(0, 24)) } : {}),
  };
  s.memos.push(memo);
  s.counters.memos_written = (s.counters.memos_written ?? 0) + 1;
  return { ok: true, memo };
}

export function editMemo(
  s: WorldState,
  id: string,
  patch: { title?: string; text?: string; tags?: readonly string[] },
): boolean {
  const m = s.memos.find((x) => x.id === id);
  if (!m) return false;
  if (patch.title !== undefined) m.title = patch.title.trim().slice(0, MEMO_TITLE_MAX) || m.title;
  if (patch.text !== undefined) m.text = patch.text.trim().slice(0, MEMO_TEXT_MAX);
  if (patch.tags !== undefined) m.tags = patch.tags.slice(0, 8).map((x) => x.slice(0, 24));
  return true;
}

export function deleteMemo(s: WorldState, id: string): boolean {
  const i = s.memos.findIndex((x) => x.id === id);
  if (i < 0) return false;
  s.memos.splice(i, 1);
  return true;
}

/** Move a memo to her head, her computer or a board (the UI checks she is at that board / PC). */
export function moveMemo(s: WorldState, id: string, place: MemoPlace): MemoResult {
  const m = s.memos.find((x) => x.id === id);
  if (!m) return { ok: false, message: tr("That memo is gone.") };
  if (
    place.startsWith("decor:") &&
    place !== m.place &&
    pinnedAt(s, place).length >= BOARD_CAPACITY
  )
    return { ok: false, message: tr("This board is full.") };
  if (place.startsWith("decor:") && place !== m.place)
    s.counters.memos_pinned = (s.counters.memos_pinned ?? 0) + 1;
  m.place = place;
  return { ok: true, memo: m };
}

/** Memos pinned to a board (placement id). */
export function pinnedAt(s: WorldState, place: string): Memo[] {
  return s.memos.filter((m) => m.place === place);
}

/** Boards with memos on them (placement ids). */
export function boardsInUse(s: WorldState): MemoPlace[] {
  return [...new Set(s.memos.filter((m) => m.place.startsWith("decor:")).map((m) => m.place))];
}

/** Memos in a place, newest first. */
export function memosIn(s: WorldState, place: "mind" | "pc"): Memo[] {
  return s.memos.filter((m) => m.place === place).sort((a, b) => b.t - a.t);
}

/** Memos anywhere but on a board, newest first (what Jade can pin somewhere). */
export function carried(s: WorldState): Memo[] {
  return s.memos.filter((m) => !m.place.startsWith("decor:")).sort((a, b) => b.t - a.t);
}

// ── Boards ───────────────────────────────────────────────────────

/** Memo place of a board (decor placement id). */
export const boardPlace = (placementId: string): MemoPlace => `decor:${placementId}`;

/** Decor placement id of a board place (`undefined` for mind / pc). */
export function placementOf(place: MemoPlace): string | undefined {
  return place.startsWith("decor:") ? place.slice("decor:".length) : undefined;
}

/**
 * Room id of a board place. Decor placement ids look like
 * `decor:<room>:<slot>` (content/interior.ts), so no geometry is needed.
 */
export function boardRoomId(place: MemoPlace): string | undefined {
  const pl = placementOf(place);
  if (!pl) return undefined;
  const parts = pl.split(":");
  return parts[0] === "decor" && parts[1] ? parts[1] : undefined;
}

/** Where Jade is handling a memo from. */
export type MemoDesk =
  | { kind: "knowledge" }
  | { kind: "pc" }
  | { kind: "board"; placement: string };

/**
 * May the memo be moved from here? A memo on a board can only be taken off
 * at that board or from the knowledge panel (her head remembers where it hangs);
 * the computer only handles what is in her head or on the computer.
 */
export function canMoveFrom(m: Memo, desk: MemoDesk): boolean {
  if (!m.place.startsWith("decor:")) return true;
  if (desk.kind === "knowledge") return true;
  return desk.kind === "board" && m.place === boardPlace(desk.placement);
}

/** Pin a memo to a board (from her head / computer, or from another board via the panel). */
export function pinMemo(s: WorldState, id: string, placementId: string): MemoResult {
  return moveMemo(s, id, boardPlace(placementId));
}

/** Take a memo off its board — back into her head. */
export function unpinMemo(s: WorldState, id: string): MemoResult {
  const m = s.memos.find((x) => x.id === id);
  if (!m) return { ok: false, message: tr("That memo is gone.") };
  if (!m.place.startsWith("decor:")) return { ok: true, memo: m };
  return moveMemo(s, id, "mind");
}

// ── "Remember" ───────────────────────────────────────────────────

export type RememberResult =
  | { ok: true; memo: Memo; fresh: boolean }
  | { ok: false; message: string };

/**
 * Store something Jade just saw as a memo in her head. Idempotent per
 * source (`kind` + `id`): a second click returns the memo already written.
 */
export function remember(
  s: WorldState,
  src: {
    kind: MemoSourceKind;
    id: string;
    title: string;
    text: string;
    tags?: readonly string[];
  },
): RememberResult {
  const had = memoFrom(s, src.kind, src.id);
  if (had) return { ok: true, memo: had, fresh: false };
  const r = addMemo(s, {
    title: src.title,
    text: src.text,
    place: "mind",
    source: { kind: src.kind, id: src.id },
    tags: src.tags ?? [],
  });
  return r.ok ? { ok: true, memo: r.memo, fresh: true } : r;
}

// ── Tags & search ────────────────────────────────────────────────

/** Split "a, b  c" into clean tags (lower case, unique, at most 8). */
export function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const t of raw.split(/[,\s#]+/)) {
    const k = t.trim().toLowerCase().slice(0, 24);
    if (k && !out.includes(k)) out.push(k);
  }
  return out.slice(0, 8);
}

/** All tags in use with their counts, most used first. */
export function memoTags(s: WorldState): { tag: string; n: number }[] {
  const m = new Map<string, number>();
  for (const memo of s.memos) for (const t of memo.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()]
    .map(([tag, n]) => ({ tag, n }))
    .sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}

/** Full-text search over all memos. */
export function searchMemos(s: WorldState, q: string): Memo[] {
  const k = q.trim().toLowerCase();
  if (!k) return [...s.memos];
  return s.memos.filter((m) =>
    `${m.title} ${m.text} ${(m.tags ?? []).join(" ")}`.toLowerCase().includes(k),
  );
}

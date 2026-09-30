/**
 * JadeOS helpers (pure): what the Files app can import from Jade's
 * knowledge, memo folders by tag, and small formatting helpers.
 */
import { tr } from "@/lib/i18n";
import { foundEntries } from "@/lib/world/archive";
import { COURSES, courseDone } from "@/lib/world/courses";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { INSIGHT_BY_ID } from "@/lib/world/content/story";
import { addMemo, memoFrom } from "@/lib/world/memos";
import type { Memo, MemoSourceKind, WorldState } from "@/lib/world/types";

export interface ImportSource {
  kind: MemoSourceKind;
  id: string;
  title: string;
  text: string;
  /** Folder (tag) the imported memo lands in. */
  tag: string;
}

export const TAG_INSIGHTS = tr("tag::insights");
export const TAG_ARCHIVE = tr("tag::archive");
export const TAG_READOUTS = tr("tag::readouts");
export const TAG_COURSES = tr("tag::courses");
export const TAG_DIARY = tr("tag::diary");

/** Everything Jade knows that is not on her computer (or in a memo) yet. */
export function importSources(s: WorldState): ImportSource[] {
  const out: ImportSource[] = [];
  for (const id of Object.keys(s.insights)) {
    const def = INSIGHT_BY_ID.get(id);
    if (def) out.push({ kind: "insight", id, title: def.title, text: def.text, tag: TAG_INSIGHTS });
  }
  for (const e of foundEntries(s))
    out.push({ kind: "archive", id: e.id, title: e.title, text: e.text, tag: TAG_ARCHIVE });
  for (const [id, r] of Object.entries(s.readouts))
    out.push({
      kind: "readout",
      id,
      title: tr("Readout — {device}", { device: DEVICE_BY_ID.get(id)?.name ?? id }),
      text: r.lines.join("\n"),
      tag: TAG_READOUTS,
    });
  for (const c of COURSES)
    if (courseDone(s, c.id))
      out.push({
        kind: "course",
        id: c.id,
        title: c.title,
        text: c.lessons.join("\n"),
        tag: TAG_COURSES,
      });
  return out.filter((x) => !memoFrom(s, x.kind, x.id));
}

/** File one source on the computer (idempotent). */
export function importSource(s: WorldState, src: ImportSource): boolean {
  const r = addMemo(s, {
    title: src.title,
    text: src.text,
    place: "pc",
    source: { kind: src.kind, id: src.id },
    tags: [src.tag],
  });
  return r.ok;
}

/** Tags used by the memos on the computer, sorted, with counts. */
export function pcFolders(memos: readonly Memo[]): { tag: string; n: number }[] {
  const m = new Map<string, number>();
  for (const x of memos) for (const t of x.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tag, n]) => ({ tag, n }));
}

/** "a, b ,c" → ["a", "b", "c"] (trimmed, unique, non-empty). */
export function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}

/** Play seconds → "h:mm:ss" / "m:ss". */
export function clock(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * Jade's memos (lib/world/memos.ts): limits, idempotent "Remember" sources,
 * board capacity, moving / pinning and the board rule (a pinned memo only
 * comes off at its board or from the knowledge panel).
 */
import { describe, expect, it } from "vitest";
import { initialState } from "@/lib/world/game";
import { isArchiveDecor } from "@/lib/world/archive";
import {
  BOARD_CAPACITY,
  MEMO_MAX,
  MEMO_TEXT_MAX,
  MEMO_TITLE_MAX,
  PIN_DECOR,
  addMemo,
  boardPlace,
  boardRoomId,
  boardsInUse,
  canMoveFrom,
  carried,
  deleteMemo,
  editMemo,
  memoFrom,
  memoTags,
  memosIn,
  moveMemo,
  parseTags,
  pinMemo,
  pinnedAt,
  placementOf,
  remember,
  searchMemos,
  unpinMemo,
} from "@/lib/world/memos";

const BOARD = "decor:kontroll:a2";
const OTHER = "decor:kantine:a2";

describe("addMemo", () => {
  it("writes into her head by default, with id, time and counters", () => {
    const s = initialState();
    s.playTime = 42.4;
    const r = addMemo(s, { title: "  Fuse  ", text: " Pull the red one. " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.memo).toMatchObject({
      title: "Fuse",
      text: "Pull the red one.",
      place: "mind",
      t: 42,
    });
    expect(r.memo.id).toMatch(/^m\d+$/);
    expect(s.counters.memos_written).toBe(1);
    expect(addMemo(s, { title: "b", text: "" }).ok && s.memos[1]!.id).not.toBe(r.memo.id);
  });

  it("rejects empty memos, trims long ones and uses the text as a fallback title", () => {
    const s = initialState();
    expect(addMemo(s, { title: "  ", text: "  " }).ok).toBe(false);
    const r = addMemo(s, {
      title: "x".repeat(200),
      text: "y".repeat(2000),
      tags: ["a".repeat(50)],
    });
    expect(r.ok && r.memo.title.length).toBe(MEMO_TITLE_MAX);
    expect(r.ok && r.memo.text.length).toBe(MEMO_TEXT_MAX);
    expect(r.ok && r.memo.tags?.[0]?.length).toBe(24);
    const f = addMemo(s, { title: "", text: "only text here" });
    expect(f.ok && f.memo.title).toBe("only text here");
  });

  it("stops at MEMO_MAX", () => {
    const s = initialState();
    for (let i = 0; i < MEMO_MAX; i++)
      expect(addMemo(s, { title: `n${i}`, text: "" }).ok).toBe(true);
    expect(addMemo(s, { title: "one more", text: "" }).ok).toBe(false);
    expect(s.memos).toHaveLength(MEMO_MAX);
  });
});

describe("remember (idempotent sources)", () => {
  it("returns the existing memo for the same source instead of a duplicate", () => {
    const s = initialState();
    const src = { kind: "archive" as const, id: "a1", title: "Find", text: "Text" };
    const a = remember(s, src);
    const b = remember(s, { ...src, title: "Changed" });
    expect(a.ok && a.fresh).toBe(true);
    expect(b.ok && b.fresh).toBe(false);
    expect(a.ok && b.ok && a.memo.id === b.memo.id).toBe(true);
    expect(s.memos).toHaveLength(1);
    expect(memoFrom(s, "archive", "a1")?.source).toEqual({ kind: "archive", id: "a1" });
    // Same id, different kind → a different memo.
    expect(remember(s, { ...src, kind: "insight" }).ok).toBe(true);
    expect(s.memos).toHaveLength(2);
    // addMemo with a known source is idempotent too.
    const again = addMemo(s, { title: "x", text: "y", source: { kind: "archive", id: "a1" } });
    expect(again.ok && again.memo.title).toBe("Find");
    expect(s.memos).toHaveLength(2);
  });

  it("still remembers a source after its memo was moved or pinned", () => {
    const s = initialState();
    const a = remember(s, { kind: "note", id: "n1", title: "N", text: "T" });
    if (!a.ok) throw new Error("remember failed");
    pinMemo(s, a.memo.id, BOARD);
    const b = remember(s, { kind: "note", id: "n1", title: "N", text: "T" });
    expect(b.ok && b.fresh).toBe(false);
    expect(s.memos).toHaveLength(1);
  });
});

describe("edit / delete / search / tags", () => {
  it("edits keep the old title when the new one is blank", () => {
    const s = initialState();
    const r = addMemo(s, { title: "Old", text: "t" });
    if (!r.ok) throw new Error("add failed");
    expect(editMemo(s, r.memo.id, { title: " ", text: "new", tags: ["x"] })).toBe(true);
    expect(s.memos[0]).toMatchObject({ title: "Old", text: "new", tags: ["x"] });
    expect(editMemo(s, "nope", { title: "a" })).toBe(false);
    expect(deleteMemo(s, r.memo.id)).toBe(true);
    expect(deleteMemo(s, r.memo.id)).toBe(false);
  });

  it("searches title, text and tags; counts tags; parses tag input", () => {
    const s = initialState();
    addMemo(s, { title: "Halo", text: "glows", tags: ["anomaly"] });
    addMemo(s, { title: "Fuse", text: "red wire", tags: ["power", "anomaly"] });
    expect(searchMemos(s, "RED").map((m) => m.title)).toEqual(["Fuse"]);
    expect(searchMemos(s, "anomaly")).toHaveLength(2);
    expect(searchMemos(s, " ")).toHaveLength(2);
    expect(memoTags(s)[0]).toEqual({ tag: "anomaly", n: 2 });
    expect(parseTags("Power, #grid  power,, x")).toEqual(["power", "grid", "x"]);
  });
});

describe("places, boards and moving", () => {
  it("parses board places", () => {
    expect(boardPlace(BOARD)).toBe(`decor:${BOARD}`);
    expect(placementOf(boardPlace(BOARD))).toBe(BOARD);
    expect(placementOf("mind")).toBeUndefined();
    expect(boardRoomId(boardPlace(BOARD))).toBe("kontroll");
    expect(boardRoomId("pc")).toBeUndefined();
  });

  it("pins, lists and takes memos off boards", () => {
    const s = initialState();
    const a = addMemo(s, { title: "A", text: "" });
    const b = addMemo(s, { title: "B", text: "", place: "pc" });
    if (!a.ok || !b.ok) throw new Error("add failed");
    expect(carried(s)).toHaveLength(2);
    expect(pinMemo(s, a.memo.id, BOARD).ok).toBe(true);
    expect(s.counters.memos_pinned).toBe(1);
    // Re-pinning to the same board counts nothing.
    pinMemo(s, a.memo.id, BOARD);
    expect(s.counters.memos_pinned).toBe(1);
    expect(pinnedAt(s, boardPlace(BOARD)).map((m) => m.title)).toEqual(["A"]);
    expect(boardsInUse(s)).toEqual([boardPlace(BOARD)]);
    expect(carried(s).map((m) => m.title)).toEqual(["B"]);
    expect(memosIn(s, "pc").map((m) => m.title)).toEqual(["B"]);
    expect(unpinMemo(s, a.memo.id).ok).toBe(true);
    expect(s.memos.find((m) => m.id === a.memo.id)?.place).toBe("mind");
    expect(boardsInUse(s)).toEqual([]);
    expect(moveMemo(s, "gone", "mind").ok).toBe(false);
    expect(unpinMemo(s, "gone").ok).toBe(false);
  });

  it("enforces the board capacity (also for new notes written onto a board)", () => {
    const s = initialState();
    for (let i = 0; i < BOARD_CAPACITY; i++)
      expect(addMemo(s, { title: `p${i}`, text: "", place: boardPlace(BOARD) }).ok).toBe(true);
    expect(addMemo(s, { title: "over", text: "", place: boardPlace(BOARD) }).ok).toBe(false);
    const x = addMemo(s, { title: "x", text: "" });
    if (!x.ok) throw new Error("add failed");
    expect(pinMemo(s, x.memo.id, BOARD).ok).toBe(false);
    expect(pinMemo(s, x.memo.id, OTHER).ok).toBe(true);
    // Moving a memo onto the board it already hangs on is not "over capacity".
    const first = pinnedAt(s, boardPlace(BOARD))[0]!;
    expect(moveMemo(s, first.id, boardPlace(BOARD)).ok).toBe(true);
  });

  it("a pinned memo comes off only at its board or from the knowledge panel", () => {
    const s = initialState();
    const a = addMemo(s, { title: "A", text: "", place: boardPlace(BOARD) });
    const b = addMemo(s, { title: "B", text: "" });
    if (!a.ok || !b.ok) throw new Error("add failed");
    expect(canMoveFrom(a.memo, { kind: "knowledge" })).toBe(true);
    expect(canMoveFrom(a.memo, { kind: "board", placement: BOARD })).toBe(true);
    expect(canMoveFrom(a.memo, { kind: "board", placement: OTHER })).toBe(false);
    expect(canMoveFrom(a.memo, { kind: "pc" })).toBe(false);
    expect(canMoveFrom(b.memo, { kind: "pc" })).toBe(true);
    expect(canMoveFrom(b.memo, { kind: "board", placement: OTHER })).toBe(true);
  });

  it("boards are interactable decor even without archive entries", () => {
    for (const d of PIN_DECOR) expect(isArchiveDecor("decor:nowhere:z9", d)).toBe(true);
    expect(isArchiveDecor("decor:nowhere:z9", "plant_pot_xyz")).toBe(false);
  });
});

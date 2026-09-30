/**
 * Save v5 (knowledge management): a v4 blob migrates with empty memos /
 * courses / readouts / experiments, and a v5 state with all of them survives
 * a JSON roundtrip through migrate + sanitise unchanged.
 */
import { describe, expect, it } from "vitest";
import { SAVE_VERSION, initialState } from "@/lib/world/game";
import { addMemo } from "@/lib/world/memos";
import { readSave } from "@/lib/world/save-sanitize";

describe("save v5 — knowledge management", () => {
  it("is the current version", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(5);
  });

  it("migrates a v4 save to empty knowledge fields", () => {
    const raw = JSON.parse(JSON.stringify(initialState())) as Record<string, unknown>;
    delete raw.memos;
    delete raw.courses;
    delete raw.readouts;
    delete raw.experiments;
    raw.version = 4;
    const r = readSave(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.from).toBe(4);
    expect(r.state.memos).toEqual([]);
    expect(r.state.courses).toEqual({});
    expect(r.state.readouts).toEqual({});
    expect(r.state.experiments).toEqual([]);
  });

  it("keeps memos in every place (head, computer, board) through a roundtrip", () => {
    const s = initialState();
    for (const place of ["mind", "pc", "decor:decor:jadeq:a16"] as const) {
      const r = addMemo(s, { title: `T ${place}`, text: "body", place, tags: ["x"] });
      expect(r.ok, place).toBe(true);
    }
    const back = readSave(JSON.parse(JSON.stringify(s)));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.state.memos.map((m) => [m.title, m.place, m.tags])).toEqual(
      s.memos.map((m) => [m.title, m.place, m.tags]),
    );
    expect(back.state.courses).toEqual(s.courses);
    expect(back.state.readouts).toEqual(s.readouts);
    expect(back.state.experiments).toEqual(s.experiments);
  });

  it("drops malformed memos and unknown places fall back to her head", () => {
    const raw = JSON.parse(JSON.stringify(initialState())) as Record<string, unknown>;
    raw.memos = [
      { id: "m1", title: "ok", text: "t", t: 1, place: "somewhere<script>" },
      { id: 5, title: "bad id", text: "t", t: 1, place: "pc" },
      "junk",
    ];
    const r = readSave(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.memos).toHaveLength(1);
    expect(r.state.memos[0]!.place).toBe("mind");
  });
});

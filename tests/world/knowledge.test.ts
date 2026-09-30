/**
 * Jade's knowledge (lib/world/knowledge.ts): areas, experience, ranks and
 * processed information — empty at the start, grown after a simulated full
 * playthrough (tests/world/simPlayer.ts, like playthrough.test.ts).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { initialState } from "@/lib/world/game";
import {
  AREAS,
  AREA_HOW,
  AREA_LABEL,
  LEVEL_LABEL,
  RANKS,
  allAreas,
  areaScore,
  experience,
  hubsRun,
  processed,
  rankOf,
  rankProgress,
  systemKnowledge,
} from "@/lib/world/knowledge";
import { addMemo, remember } from "@/lib/world/memos";
import type { WorldState } from "@/lib/world/types";
import { play } from "./simPlayer";

describe("knowledge at the start", () => {
  const s = initialState();

  it("every area is at level 0 with nothing learned", () => {
    const areas = allAreas(s);
    expect(areas.map((a) => a.area)).toEqual([...AREAS]);
    for (const a of areas) {
      expect(a.pct, a.area).toBe(0);
      expect(a.level, a.area).toBe(0);
      expect(a.levelLabel).toBe(LEVEL_LABEL[0]);
      expect(a.max, `${a.area} has something to learn`).toBeGreaterThan(0);
      expect(AREA_LABEL[a.area]).toBeTruthy();
      expect(AREA_HOW[a.area]).toBeTruthy();
    }
  });

  it("no experience, first rank, nothing processed", () => {
    expect(experience(s).xp).toBe(0);
    expect(rankOf(0)).toMatchObject({ index: 0, title: RANKS[0]!.title, next: RANKS[1]!.xp });
    expect(processed(s).total).toBe(0);
    expect(hubsRun(s)).toEqual([]);
  });
});

describe("ranks", () => {
  it("thresholds are strictly increasing and map exactly", () => {
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i]!.xp).toBeGreaterThan(RANKS[i - 1]!.xp);
    RANKS.forEach((r, i) => {
      expect(rankOf(r.xp).index).toBe(i);
      if (i > 0) expect(rankOf(r.xp - 1).index).toBe(i - 1);
    });
    const top = rankOf(RANKS.at(-1)!.xp + 99999);
    expect(top.index).toBe(RANKS.length - 1);
    expect(top.next).toBeUndefined();
  });

  it("progress runs from 0 to 1 between two ranks", () => {
    const [a, b] = [RANKS[1]!.xp, RANKS[2]!.xp];
    expect(rankProgress(a).frac).toBe(0);
    expect(rankProgress((a + b) / 2).frac).toBeCloseTo(0.5);
    expect(rankProgress(a).nextTitle).toBe(RANKS[2]!.title);
    expect(rankProgress(RANKS.at(-1)!.xp).frac).toBe(1);
  });
});

describe("processed information", () => {
  it("counts memos, readouts, experiments, notes and terminal flags", () => {
    const s = initialState();
    addMemo(s, { title: "a", text: "" });
    remember(s, { kind: "insight", id: "x", title: "b", text: "c" });
    s.readouts["UEC-001"] = { t: 1, lines: ["150 W"] };
    s.experiments.push({ t: 2, inputs: { a: 1 }, outcome: "fail" });
    s.read.some_note = true;
    s.flags.terminal_mail_m1 = true;
    s.flags.terminal_file_f1 = true;
    const p = processed(s);
    expect(p).toMatchObject({
      memos: 2,
      readouts: 1,
      experiments: 1,
      notes: 1,
      mails: 1,
      files: 1,
    });
    expect(p.total).toBe(7);
    // A readout on file counts for its area.
    expect(areaScore(s, "power").points).toBeGreaterThan(0);
  });
});

describe("knowledge after a simulated full playthrough", () => {
  let start: ReturnType<typeof allAreas>;
  let end: ReturnType<typeof allAreas>;
  let s: WorldState;
  beforeAll(() => {
    start = allAreas(initialState());
    s = play().s;
    end = allAreas(s);
  }, 240_000);

  it("the lab-side areas have grown (body depends on the biorhythm)", () => {
    const grown = end.filter((a, i) => a.pct > start[i]!.pct).map((a) => a.area);
    for (const a of AREAS.filter((x) => x !== "body")) expect(grown, a).toContain(a);
    for (const a of end) {
      expect(a.pct).toBeGreaterThanOrEqual(0);
      expect(a.pct).toBeLessThanOrEqual(100);
    }
    const byArea = new Map(end.map((a) => [a.area, a]));
    // Building every device must put building / power well past the basics.
    expect(byArea.get("building")!.level).toBeGreaterThanOrEqual(2);
    expect(byArea.get("power")!.level).toBeGreaterThanOrEqual(2);
  });

  it("gains experience worth a real rank and processes a lot", () => {
    const xp = experience(s);
    expect(xp.parts.find((p) => p.n > 0)).toBeTruthy();
    expect(rankOf(xp.xp).index).toBeGreaterThanOrEqual(3);
    const p = processed(s);
    expect(p.insights).toBeGreaterThan(10);
    expect(p.recipes).toBeGreaterThan(5);
    expect(p.total).toBeGreaterThan(50);
  });

  it("knows every device as built, with firmware versions", () => {
    const devs = systemKnowledge(s);
    expect(devs.length).toBeGreaterThan(30);
    expect(devs.every((d) => d.built && d.stages === d.total)).toBe(true);
    expect(devs.every((d) => /^\d+\.\d+\.\d+/.test(d.firmware))).toBe(true);
  });
});

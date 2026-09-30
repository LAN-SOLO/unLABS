/**
 * Courses on Jade's computer (lib/world/courses.ts, content/courses.ts) and
 * the perk effects in the rule files (lib/world/perks.ts).
 */
import { describe, expect, it } from "vitest";
import { ARCHIVE } from "@/lib/world/archive";
import { roomHidesMore, visitSpot } from "@/lib/world/archive";
import {
  BIO_DECAY_PER_MIN,
  BIO_LOW,
  TRAIN_GAIN,
  bioActivate,
  bioStudyFatigue,
  bioTick,
  bioValue,
  train,
} from "@/lib/world/biorhythm";
import { VOLATILITY_LIMIT } from "@/lib/world/combine";
import {
  COURSES,
  COURSE_BY_ID,
  allPerks,
  courseAvailable,
  courseDone,
  coursesIn,
  hasPerk,
  lessonsOpen,
  passCourse,
  perkFlag,
  study,
  studyProgress,
  studySecondsLeft,
  studyTick,
  type CourseDef,
} from "@/lib/world/courses";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { PICKUPS } from "@/lib/world/content/map";
import { INSIGHT_BY_ID } from "@/lib/world/content/story";
import {
  DRONE_COOLDOWN,
  RESEARCH_PER_CYCLE,
  addItem,
  doCombine,
  droneCooldown,
  initialState,
  operateDevice,
  researchPerCycle,
  takePickup,
} from "@/lib/world/game";
import { AREAS } from "@/lib/world/knowledge";
import { PERK_IDS, PERK_TUNING } from "@/lib/world/perks";
import type { Condition, WorldState } from "@/lib/world/types";

function build(s: WorldState, ...ids: string[]): void {
  for (const id of ids) {
    const d = DEVICE_BY_ID.get(id)!;
    s.built[id] = d.stages.length;
    s.discovered[id] = true;
    s.switchedOn[id] = true;
  }
}

/** Satisfy a course's requirement (for the study tests). */
function unlock(s: WorldState, c: CourseDef): void {
  const visit = (x: Condition | undefined): void => {
    if (!x) return;
    if ("all" in x) x.all.forEach(visit);
    else if ("any" in x) visit(x.any[0]);
    else if ("device" in x) build(s, x.device);
    else if ("insight" in x) s.insights[x.insight] = 1;
    else if ("counter" in x) s.counters[x.counter] = Math.max(x.min, 1);
    else if ("flag" in x) s.flags[x.flag] = true;
  };
  visit(c.requires);
}

function finish(s: WorldState, c: CourseDef): void {
  unlock(s, c);
  study(s, c.id, c.minutes * 60);
  expect(
    passCourse(
      s,
      c.id,
      c.quiz.map((q) => q.answer),
    ).ok,
  ).toBe(true);
}

function condRefsOk(c: Condition | undefined): string[] {
  if (!c) return [];
  if ("all" in c) return c.all.flatMap(condRefsOk);
  if ("any" in c) return c.any.flatMap(condRefsOk);
  if ("not" in c) return condRefsOk(c.not);
  if ("device" in c) return DEVICE_BY_ID.has(c.device) ? [] : [`device ${c.device}`];
  if ("insight" in c) return INSIGHT_BY_ID.has(c.insight) ? [] : [`insight ${c.insight}`];
  if ("item" in c) return ITEM_BY_ID.has(c.item) ? [] : [`item ${c.item}`];
  return [];
}

describe("course content", () => {
  it("has 20–26 courses with unique ids covering every knowledge area", () => {
    expect(COURSES.length).toBeGreaterThanOrEqual(20);
    expect(COURSES.length).toBeLessThanOrEqual(26);
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(COURSES.length);
    for (const a of AREAS) expect(coursesIn(a).length, a).toBeGreaterThanOrEqual(1);
  });

  it("every course has 3–6 lessons, a 2–4 question quiz with valid answers, 2–8 minutes", () => {
    for (const c of COURSES) {
      expect(c.lessons.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.lessons.length, c.id).toBeLessThanOrEqual(6);
      expect(c.quiz.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.quiz.length, c.id).toBeLessThanOrEqual(4);
      expect(c.minutes, c.id).toBeGreaterThanOrEqual(2);
      expect(c.minutes, c.id).toBeLessThanOrEqual(8);
      for (const q of c.quiz) {
        expect(q.options.length, q.q).toBeGreaterThanOrEqual(2);
        expect(Number.isInteger(q.answer), q.q).toBe(true);
        expect(q.answer, q.q).toBeGreaterThanOrEqual(0);
        expect(q.answer, q.q).toBeLessThan(q.options.length);
        expect(new Set(q.options).size, q.q).toBe(q.options.length);
      }
    }
  });

  it("requirements reference existing devices, insights and items", () => {
    for (const c of COURSES) expect(condRefsOk(c.requires), c.id).toEqual([]);
  });

  it("perks are unique and every perk id is known to the rules", () => {
    const perks = allPerks();
    expect(perks.length).toBeGreaterThanOrEqual(8);
    expect(new Set(perks.map((p) => p.id)).size).toBe(perks.length);
    expect(new Set(perks.map((p) => p.id))).toEqual(new Set(PERK_IDS));
  });

  it("facts in the lessons match the rules", () => {
    expect(VOLATILITY_LIMIT).toBe(12);
    expect(DRONE_COOLDOWN).toBe(150);
    expect(RESEARCH_PER_CYCLE).toBe(5);
    expect(TRAIN_GAIN).toBe(15);
    const fastest = Object.entries(BIO_DECAY_PER_MIN).sort((a, b) => b[1] - a[1])[0]![0];
    expect(fastest).toBe("drink");
    expect(DEVICES.find((d) => d.id === "TLP-001")?.power).toBe(100);
  });
});

describe("studying", () => {
  const c = COURSE_BY_ID.get("c_grid_basics")!;

  it("progress, lessons and seconds left follow the study time", () => {
    const s = initialState();
    expect(studyProgress(s, c.id)).toBe(0);
    expect(lessonsOpen(s, c)).toBe(1);
    expect(studySecondsLeft(s, c.id)).toBe(c.minutes * 60);
    study(s, c.id, (c.minutes * 60) / 2);
    expect(studyProgress(s, c.id)).toBeCloseTo(0.5);
    expect(lessonsOpen(s, c)).toBe(Math.floor(c.lessons.length / 2) + 1);
    study(s, c.id, 10_000);
    expect(studyProgress(s, c.id)).toBe(1);
    expect(lessonsOpen(s, c)).toBe(c.lessons.length);
    expect(s.courses[c.id]).toBe(c.minutes * 60);
    expect(s.counters.study_seconds).toBeGreaterThan(0);
  });

  it("locked courses cannot be studied", () => {
    const s = initialState();
    const locked = COURSE_BY_ID.get("c_research")!;
    expect(courseAvailable(s, locked).ok).toBe(false);
    expect(courseAvailable(s, locked).hint).toBeTruthy();
    study(s, locked.id, 100);
    expect(studyProgress(s, locked.id)).toBe(0);
    build(s, "NXS-01");
    expect(courseAvailable(s, locked).ok).toBe(true);
  });

  it("the quiz needs finished lessons and all answers right; then flags course and perk", () => {
    const s = initialState();
    const d = COURSE_BY_ID.get("c_study_method")!;
    const right = d.quiz.map((q) => q.answer);
    expect(passCourse(s, d.id, right).ok).toBe(false);
    study(s, d.id, d.minutes * 60);
    const wrong = right.map((a, i) => (i === 0 ? (a + 1) % d.quiz[0]!.options.length : a));
    const r = passCourse(s, d.id, wrong);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.wrong).toEqual([0]);
    expect(courseDone(s, d.id)).toBe(false);
    const ok = passCourse(s, d.id, right);
    expect(ok).toEqual({ ok: true, perk: "speed_reader" });
    expect(courseDone(s, d.id)).toBe(true);
    expect(hasPerk(s, "speed_reader")).toBe(true);
    expect(s.flags[perkFlag("speed_reader")]).toBe(true);
    expect(s.counters.courses_done).toBe(1);
    // Idempotent: handing in again does not count twice.
    passCourse(s, d.id, right);
    expect(s.counters.courses_done).toBe(1);
  });

  it("every course can be completed with its own answers once unlocked", () => {
    const s = initialState();
    for (const c2 of COURSES) finish(s, c2);
    expect(COURSES.every((x) => courseDone(s, x.id))).toBe(true);
    for (const p of PERK_IDS) expect(hasPerk(s, p)).toBe(true);
  });

  it("studyTick reports opened lessons, the finish and costs a little rest", () => {
    const s = initialState();
    s.floor = 4;
    bioActivate(s);
    const before = bioValue(s, "rest");
    const r1 = studyTick(s, c.id, 2, "normal");
    expect(r1.finished).toBe(false);
    expect(bioValue(s, "rest")).toBeLessThan(before);
    let opened = 0;
    let finished = false;
    for (let i = 0; i < 200 && !finished; i++) {
      const r = studyTick(s, c.id, 2, "normal");
      opened += r.opened;
      finished = r.finished;
    }
    expect(finished).toBe(true);
    expect(opened).toBe(c.lessons.length - 1);
    // Off: no rest cost.
    const s2 = initialState();
    s2.floor = 4;
    bioActivate(s2);
    studyTick(s2, c.id, 30, "off");
    expect(bioValue(s2, "rest")).toBe(100);
  });

  it("study fatigue never pushes rest below the low mark", () => {
    const s = initialState();
    s.floor = 4;
    bioActivate(s);
    s.counters.bio_rest = BIO_LOW + 0.1;
    bioStudyFatigue(s, 600, "normal");
    expect(bioValue(s, "rest")).toBe(BIO_LOW);
  });
});

describe("perk effects", () => {
  const give = (s: WorldState, p: string) => {
    s.flags[perkFlag(p)] = true;
  };

  it("speed_reader: study 25 % faster", () => {
    const a = initialState();
    const b = initialState();
    give(b, "speed_reader");
    study(a, "c_grid_basics", 40);
    study(b, "c_grid_basics", 40);
    expect(b.courses.c_grid_basics).toBeCloseTo(a.courses.c_grid_basics! * PERK_TUNING.studyFactor);
  });

  it("second_look: a readout gets the grid margin line", () => {
    const a = initialState();
    build(a, "UEC-001", "BAT-001", "CLK-001");
    const b = structuredClone(a);
    give(b, "second_look");
    const la = operateDevice(a, "CLK-001").lines;
    const lb = operateDevice(b, "CLK-001").lines;
    expect(la.length).toBeGreaterThan(0);
    expect(lb.length).toBe(la.length + 1);
    expect(lb.at(-1)).toMatch(/margin/);
  });

  it("scrap_sense: every fourth finished pile gives one part more", () => {
    const pile = PICKUPS.find((p) => !p.tool && !p.puzzle && !p.pool && !p.hidden && p.respawn)!;
    expect(pile).toBeDefined();
    const run = (perk: boolean): number => {
      const s = initialState();
      if (perk) give(s, "scrap_sense");
      let n = 0;
      for (let i = 0; i < 4; i++) {
        delete s.taken[pile.id];
        const r = takePickup(s, pile.id);
        n += r.items.reduce((a, it) => a + it.count, 0);
      }
      return n;
    };
    expect(run(true)).toBe(run(false) + 1);
  });

  it("blast_catch: an explosion gives one input part back", () => {
    const hot = [...ITEM_BY_ID.values()]
      .filter((d) => d.kind !== "prototyp" && d.volatility >= 4)
      .sort((x, y) => y.volatility - x.volatility)[0]!;
    const n = Math.floor(VOLATILITY_LIMIT / hot.volatility) + 1;
    const mix = { [hot.id]: n };
    const a = initialState();
    build(a, "PWB-001");
    addItem(a, hot.id, n);
    const b = structuredClone(a);
    give(b, "blast_catch");
    const ra = doCombine(a, mix);
    const rb = doCombine(b, mix);
    if (ra.kind !== "explosion") return; // a recipe for this mix: nothing to test
    expect(rb.kind).toBe("explosion");
    expect(b.inventory[hot.id] ?? 0).toBe((a.inventory[hot.id] ?? 0) + 1);
  });

  it("research_notes: +1 research point per cycle", () => {
    const s = initialState();
    const base = researchPerCycle(s);
    give(s, "research_notes");
    expect(researchPerCycle(s)).toBe(base + PERK_TUNING.research);
  });

  it("drone_routes: the drone recharges faster", () => {
    const s = initialState();
    expect(droneCooldown(s)).toBe(DRONE_COOLDOWN);
    give(s, "drone_routes");
    expect(droneCooldown(s)).toBe(Math.round(DRONE_COOLDOWN * PERK_TUNING.droneCooldown));
  });

  it("steady_rhythm: needs decay 10 % slower", () => {
    const a = initialState();
    a.floor = 4;
    bioActivate(a);
    const b = structuredClone(a);
    give(b, "steady_rhythm");
    bioTick(a, 600, "normal");
    bioTick(b, 600, "normal");
    const lossA = 100 - bioValue(a, "drink");
    const lossB = 100 - bioValue(b, "drink");
    expect(lossB).toBeCloseTo(lossA * PERK_TUNING.bioDecay);
  });

  it("good_form: workouts give 20 % more fitness", () => {
    const a = initialState();
    a.floor = 4;
    bioActivate(a);
    const b = structuredClone(a);
    give(b, "good_form");
    expect(train(a).gains.fit).toBe(TRAIN_GAIN);
    expect(train(b).gains.fit).toBeCloseTo(TRAIN_GAIN * PERK_TUNING.trainGain);
  });

  it("search_sense: an empty search hints at another hiding spot in the room", () => {
    // Find a room with at least two searchable spots, one of them without an entry left.
    const search = ARCHIVE.filter((e) => e.find === "search" && e.at && "decor" in e.at && !e.when);
    const hit = search[0]!;
    const at = hit.at as { decor: string };
    const room = at.decor.split(":")[1]!;
    const empty = `decor:${room}:zz_empty`;
    const s = initialState();
    expect(roomHidesMore(s, empty)).toBe(true);
    expect(visitSpot(s, { decor: empty }, "search").hints).toEqual([]);
    give(s, "search_sense");
    expect(visitSpot(s, { decor: empty }, "search").hints).toHaveLength(1);
    // Once everything in the room is found, the hint stays quiet.
    for (const e of search)
      if ((e.at as { decor: string }).decor.split(":")[1] === room) s.archive[e.id] = 1;
    expect(visitSpot(s, { decor: empty }, "search").hints).toEqual([]);
  });
});

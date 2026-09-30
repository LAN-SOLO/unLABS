import { describe, expect, it } from "vitest";
import {
  EMOTIONS,
  EVENTS,
  MOUTH_ART,
  MOUTH_SHAPES,
  appraise,
  dominant,
  expression,
  initialEmotions,
  stepEmotions,
  wants,
  type Emotion,
  type LabEvent,
} from "@/lib/world/emotion";
import {
  GESTURES,
  GESTURE_DURATION,
  applyGesture,
  gestureWeight,
} from "@/lib/world/models/gestures";
import { applyExpression } from "@/lib/world/models/gestures";
import { characterPose, RIG_PART_NAMES } from "@/lib/world/models/rig";
import { CHAIR, LIFE_ROOM, LabLife, STATIONS, route, AISLE_Z } from "@/lib/world/title-life";

describe("emotion model", () => {
  it("appraises lab events into the fitting emotions", () => {
    const expect1 = (e: LabEvent, emo: Emotion) => {
      const s = initialEmotions();
      appraise(s, e);
      expect(dominant(s).emotion, e).toBe(emo);
    };
    expect1("device_break", "surprise");
    expect1("gift", "gratitude");
    expect1("bot_mischief", "surprise");
    expect1("idea", "interest");
    const s = initialEmotions();
    appraise(s, "repair_success");
    expect(s.e.pride + s.e.joy).toBeGreaterThan(0.8);
  });

  it("failures sting more in a row, success brings relief and clears them", () => {
    const s = initialEmotions();
    appraise(s, "repair_fail");
    const first = s.e.frustration;
    appraise(s, "repair_fail");
    appraise(s, "repair_fail");
    expect(s.e.frustration - first).toBeGreaterThan(0.2);
    expect(s.e.anger).toBeGreaterThan(0);
    appraise(s, "repair_success");
    expect(s.e.relief).toBeGreaterThan(0.4);
    expect(s.e.frustration).toBeLessThan(first);
    expect(s.streak).toBe(0);
  });

  it("emotions decay with their own half-lives; surprise fades fast, pride lingers", () => {
    const s = initialEmotions();
    s.e.surprise = 1;
    s.e.pride = 1;
    for (let i = 0; i < 100; i++) stepEmotions(s, 0.1);
    expect(s.e.surprise).toBeLessThan(0.1);
    expect(s.e.pride).toBeGreaterThan(0.6);
  });

  it("mood follows the emotions slowly and colours later appraisals", () => {
    const good = initialEmotions();
    const bad = initialEmotions();
    for (let i = 0; i < 20; i++) {
      appraise(good, "gift", 0.5);
      appraise(bad, "repair_fail", 0.5);
      stepEmotions(good, 2);
      stepEmotions(bad, 2);
    }
    expect(good.mood[0]).toBeGreaterThan(0.2);
    expect(bad.mood[0]).toBeLessThan(-0.1);
    const g2 = structuredClone(good);
    const b2 = structuredClone(bad);
    g2.e.joy = 0;
    b2.e.joy = 0;
    appraise(g2, "repair_progress");
    appraise(b2, "repair_progress");
    expect(g2.e.joy).toBeGreaterThan(b2.e.joy);
  });

  it("needs drain while working and drive what she wants", () => {
    const s = initialEmotions();
    for (let i = 0; i < 400; i++) stepEmotions(s, 0.5, "work");
    expect(s.needs.energy).toBeLessThan(0.3);
    expect(s.e.fatigue).toBeGreaterThan(0.4);
    expect(["rest", "drink"]).toContain(wants(s));
    for (let i = 0; i < 200; i++) stepEmotions(s, 0.5, "rest");
    expect(s.needs.energy).toBeGreaterThan(0.6);
    appraise(s, "drink");
    expect(s.needs.thirst).toBe(0);
  });

  it("every emotion has a face; mouths are 6 × 3 overlays; expressions stay in range", () => {
    for (const k of MOUTH_SHAPES) {
      expect(MOUTH_ART[k]).toHaveLength(3);
      for (const row of MOUTH_ART[k]) expect(row).toMatch(/^[.sMdWl]{6}$/);
    }
    for (const k of EMOTIONS) {
      const s = initialEmotions();
      s.e[k] = 0.95;
      const ex = expression(s);
      expect(Math.abs(ex.brows), k).toBeLessThanOrEqual(1.2);
      expect(ex.lids, k).toBeLessThanOrEqual(0.9);
      expect(MOUTH_SHAPES).toContain(ex.mouth);
    }
    // Strong emotions show their icon.
    const s = initialEmotions();
    appraise(s, "device_break");
    expect(expression(s).icon).toBe("!");
    for (const e of Object.keys(EVENTS)) expect(EVENTS[e as LabEvent]).toBeDefined();
  });
});

describe("gestures and expression overlays", () => {
  it("fade in and out, and leave the pose finite", () => {
    for (const g of GESTURES) {
      expect(gestureWeight(g, 0)).toBe(0);
      expect(gestureWeight(g, GESTURE_DURATION[g] / 2)).toBeGreaterThan(0.9);
      expect(gestureWeight(g, GESTURE_DURATION[g] + 0.1)).toBe(0);
      const p = characterPose("idle", 1);
      applyGesture(p, g, GESTURE_DURATION[g] / 2);
      for (const n of RIG_PART_NAMES)
        for (const v of [...p[n].rot, ...(p[n].pos ?? [])])
          expect(Number.isFinite(v), `${g} ${n}`).toBe(true);
    }
  });

  it("an angry face lowers the brows and tightens the lids", () => {
    const s = initialEmotions();
    s.e.anger = 1;
    const p = characterPose("idle", 3.3);
    const before = structuredClone(p);
    applyExpression(p, expression(s), 3.3);
    expect(p.brows.pos![1]).toBeLessThan(before.brows.pos?.[1] ?? 0);
  });
});

describe("title lab life (aquarium)", () => {
  const life = new LabLife(89);
  const frames: ReturnType<LabLife["step"]>[] = [];
  const moods = new Set<string>();
  const mouths = new Set<string>();
  const poses = new Set<string>();
  let maxBots = 0;
  let doorOpened = false;
  let bubbles = 0;
  const speakers = new Set<string>();
  for (let i = 0; i < 20 * 60 * 30; i++) {
    const f = life.step(1 / 30);
    if (i % 30 === 0) frames.push(f);
    moods.add(f.jade.mood.split(" ")[0]!);
    mouths.add(f.jade.expression.mouth);
    poses.add(f.jade.pose);
    maxBots = Math.max(maxBots, f.bots.length);
    if (f.door > 0.9) doorOpened = true;
    bubbles += f.bubbles.length;
    for (const b of f.bubbles) speakers.add(b.who);
  }
  const st = life.stats;

  it("keeps everyone inside the room and every number finite", () => {
    for (const f of frames) {
      expect(Math.abs(f.jade.x)).toBeLessThan(LIFE_ROOM.w / 2);
      expect(Math.abs(f.jade.z)).toBeLessThan(LIFE_ROOM.d / 2);
      for (const v of [f.jade.x, f.jade.z, f.jade.yaw, f.chairYaw])
        expect(Number.isFinite(v)).toBe(true);
      for (const b of f.bots) {
        expect(Math.abs(b.x)).toBeLessThan(LIFE_ROOM.w / 2 + 1);
        expect(b.z).toBeGreaterThan(-LIFE_ROOM.d / 2 - 4);
      }
    }
    expect(maxBots).toBeLessThanOrEqual(2);
    expect(doorOpened).toBe(true);
  });

  it("is lively: she works, types, repairs, drinks, rests, spins and celebrates", () => {
    for (const k of [
      "task_repair",
      "task_type",
      "task_service",
      "task_experiment",
      "task_rest",
      "spin",
      "repaired",
      "repairFailed",
      "broken",
      "glitch",
    ])
      expect(st[k] ?? 0, k).toBeGreaterThan(0);
    for (const p of ["walk", "work", "typing", "sit", "drink", "celebrate", "startle", "read"])
      expect(poses, p).toContain(p);
    expect(bubbles).toBeGreaterThan(40);
    expect(speakers).toContain("jade");
    expect(speakers).toContain("mcp");
  });

  it("bots come in, help, bring coffee and cards, scan and make mischief — then leave", () => {
    for (const m of ["deliver", "assist", "patrol", "mischief", "paper"])
      expect(st[`bot_${m}`] ?? 0, m).toBeGreaterThan(0);
    expect(st.gift_mug ?? 0).toBeGreaterThan(0);
    expect(st.gift_card ?? 0).toBeGreaterThan(0);
    expect(st.mischief ?? 0).toBeGreaterThan(0);
  });

  it("shows a whole range of feelings, faces and gestures", () => {
    expect(moods.size, [...moods].join(" ")).toBeGreaterThanOrEqual(7);
    expect(mouths.size, [...mouths].join(" ")).toBeGreaterThanOrEqual(5);
    const gestures = Object.keys(st).filter((k) => k.startsWith("gesture_"));
    expect(gestures.length, gestures.join(" ")).toBeGreaterThanOrEqual(8);
  });

  it("routes stay on the aisle between stations (no walking through machines)", () => {
    const r = route(STATIONS.coffee.spot, STATIONS.bench.spot);
    expect(r[0]![1]).toBeCloseTo(AISLE_Z);
    expect(r[r.length - 1]).toEqual(STATIONS.bench.spot);
    expect(route(STATIONS.mcp.spot, CHAIR).at(-1)).toEqual(CHAIR);
  });

  it("is deterministic for a seed", () => {
    const a = new LabLife(7);
    const b = new LabLife(7);
    for (let i = 0; i < 3000; i++) {
      a.step(1 / 30);
      b.step(1 / 30);
    }
    expect(a.step(1 / 30).jade).toEqual(b.step(1 / 30).jade);
  });
});

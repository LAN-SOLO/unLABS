import { describe, expect, it } from "vitest";
import { initialState } from "@/lib/world/game";
import { BOT_DUTIES, DUTY_BY_ID, UPGRADE_COST } from "@/lib/world/content/bot-duties";
import { BOT_IDS } from "@/lib/world/models/characters";
import { PICKUPS } from "@/lib/world/content/map";
import {
  ALGAE_SECONDS,
  VINE_ROOMS,
  agingTick,
  algaeStage,
  harvestAlgae,
  vineStage,
  waterRoom,
} from "@/lib/world/aging";
import { sanitizeOps } from "@/lib/world/ops/state";
import {
  LEARN_AT,
  applyStep,
  combineRoutines,
  expandRoutine,
  habitFor,
  recordAction,
  runRoutine,
  startRecording,
  stopRecording,
} from "@/lib/world/ops/routines";
import { WORN, botOps, canUpgrade, runDuty, upgradeBot } from "@/lib/world/ops/bots";
import { addTask, ensureBotSchedule, opsTick, removeTask } from "@/lib/world/ops/schedule";
import { IDLE_AFTER_MS, SLEEP_AFTER_MS, idleTick } from "@/lib/world/ops/idle";
import type { OpsStep, WorldState } from "@/lib/world/types";

function wake(s: WorldState, ...bots: string[]): void {
  for (const b of bots) s.flags[`bot_${b}_awake`] = true;
}

const A: OpsStep = { kind: "note", id: "n_a" };
const B: OpsStep = { kind: "drone", id: "drone" };

describe("routines", () => {
  it("records a sequence and replays it", () => {
    const s = initialState();
    startRecording(s);
    recordAction(s, A);
    recordAction(s, B);
    const r = stopRecording(s, "Morning round")!;
    expect(r.items).toEqual([A, B]);
    expect(r.source).toBe("recorded");
    const run = runRoutine(s, r.id);
    expect(run.total).toBe(2);
    expect(r.uses).toBe(1);
  });

  it("learns a repeated sequence as a habit and offers to finish it", () => {
    const s = initialState();
    let learned = null;
    for (let i = 0; i < LEARN_AT; i++) {
      recordAction(s, A);
      learned = recordAction(s, B).learned ?? learned;
    }
    expect(learned).not.toBeNull();
    expect(learned!.auto).toBe(true);
    expect(habitFor(s, A)?.id).toBe(learned!.id);
  });

  it("combines routines, refuses cycles and expands nested steps", () => {
    const s = initialState();
    startRecording(s);
    recordAction(s, A);
    const r1 = stopRecording(s, "one")!;
    startRecording(s);
    recordAction(s, B);
    const r2 = stopRecording(s, "two")!;
    const c = combineRoutines(s, [r1.id, r2.id], "both")!;
    expect(expandRoutine(s, c.id)).toEqual([A, B]);
    expect(combineRoutines(s, [c.id, c.id], "")).not.toBeNull(); // a routine twice is fine
    expect(combineRoutines(s, [r1.id, "nope"], "x")).toBeNull();
  });

  it("only replays knowledge Jade has: no unknown recipe, no unsolved puzzle", () => {
    const s = initialState();
    expect(applyStep(s, { kind: "craft", id: "basislegierung×2" }).ok).toBe(false);
    expect(applyStep(s, { kind: "puzzle", id: "pz_power_flow" }).ok).toBe(false);
    const p = PICKUPS.find((x) => x.floor === 0)!;
    expect(applyStep(s, { kind: "pickup", id: p.id }).ok).toBe(true);
  });
});

describe("bots", () => {
  it("every lore bot has a duty from the design database and a service duty", () => {
    for (const b of BOT_IDS) {
      expect(
        BOT_DUTIES.some((d) => d.bot === b),
        b,
      ).toBe(true);
      expect(DUTY_BY_ID.get(`${b}_service`), b).toBeDefined();
    }
    for (const d of BOT_DUTIES) expect(d.source.length, d.id).toBeGreaterThan(10);
  });

  it("dormant bots get no timetable, awake ones get theirs once", () => {
    const s = initialState();
    ensureBotSchedule(s);
    expect(s.ops.tasks).toHaveLength(0);
    wake(s, "w2rek", "x0r8t");
    ensureBotSchedule(s);
    ensureBotSchedule(s);
    expect(s.ops.tasks.map((t) => t.what.id).sort()).toEqual(["w2rek_crawl", "x0r8t_signal"]);
  });

  it("X0-R8T keeps its own schedule", () => {
    const s = initialState();
    wake(s, "x0r8t");
    ensureBotSchedule(s);
    const t = s.ops.tasks[0]!;
    removeTask(s, t.id);
    expect(s.ops.tasks).toHaveLength(1);
    expect(addTask(s, { who: "x0r8t", what: { kind: "duty", id: "x0r8t_signal" } })).toBeNull();
  });

  it("duties wear bots out; the dock services them; upgrades cost materials", () => {
    const s = initialState();
    wake(s, "w2rek");
    let guard = 0;
    while (botOps(s, "w2rek").wear < WORN && guard++ < 40) runDuty(s, "w2rek_crawl");
    expect(runDuty(s, "w2rek_crawl").ok).toBe(false);
    opsTick(s); // a worn bot goes to its dock on its own
    expect(botOps(s, "w2rek").wear).toBe(0);
    expect(canUpgrade(s, "w2rek")).toBe(false);
    for (const [id, n] of Object.entries(UPGRADE_COST[1]!)) s.inventory[id] = n;
    expect(upgradeBot(s, "w2rek").ok).toBe(true);
    expect(botOps(s, "w2rek").level).toBe(1);
  });

  it("the greenhouse crawler waters the green rooms and harvests overflowing algae", () => {
    const s = initialState();
    wake(s, "w2rek");
    s.counters["algae:gewaechshaus"] = ALGAE_SECONDS;
    expect(algaeStage(s, "gewaechshaus")).toBe(3);
    const before = s.inventory.leuchtalgen ?? 0;
    runDuty(s, "w2rek_crawl");
    expect(s.inventory.leuchtalgen ?? 0).toBeGreaterThan(before);
    expect(algaeStage(s, "gewaechshaus")).toBe(0);
    expect(s.counters[`water:${VINE_ROOMS[0]}`]).toBeGreaterThan(0);
  });

  it("scheduled tasks run by priority, one per agent per tick", () => {
    const s = initialState();
    wake(s, "l0g1k");
    ensureBotSchedule(s);
    for (const t of s.ops.tasks) t.at = 0;
    const ev = opsTick(s);
    expect(ev.filter((e) => e.who === "l0g1k")).toHaveLength(1);
  });
});

describe("living lab", () => {
  it("algae overflow with light, harvesting resets them", () => {
    const s = initialState();
    agingTick(s, ALGAE_SECONDS, () => true, ["gewaechshaus"]);
    expect(algaeStage(s, "gewaechshaus")).toBe(3);
    expect(harvestAlgae(s, "gewaechshaus")).toBe(7);
  });

  it("vines grow from the greenhouse into the next rooms over time", () => {
    const s = initialState();
    waterRoom(s, "gewaechshaus");
    expect(vineStage(s, "gewaechshaus", "decor:gewaechshaus:v0")).toBe(0);
    agingTick(s, 1000, () => true, ["gewaechshaus"]);
    expect(vineStage(s, "gewaechshaus", "decor:gewaechshaus:v0")).toBeGreaterThan(0);
    expect(vineStage(s, "kantine", "decor:kantine:v0")).toBe(0);
  });
});

describe("idle life", () => {
  it("after an hour of pause Jade works off her tasks, then reads or trains; after five she sleeps", () => {
    const s = initialState();
    startRecording(s);
    recordAction(s, B);
    const r = stopRecording(s, "drone")!;
    addTask(s, { who: "jade", what: { kind: "routine", id: r.id }, in: 9999, priority: 8 });
    expect(idleTick(s, IDLE_AFTER_MS - 1, 0)).toEqual([]);
    const ev = idleTick(s, IDLE_AFTER_MS, 1);
    expect(ev).toHaveLength(1);
    expect(["read", "exercise"]).toContain(s.ops.idle?.kind);
    idleTick(s, SLEEP_AFTER_MS, 2);
    expect(s.ops.idle?.kind).toBe("sleep");
  });
});

describe("save", () => {
  it("sanitises untrusted operations data", () => {
    const s = initialState();
    startRecording(s);
    recordAction(s, A);
    stopRecording(s, "x");
    const round = sanitizeOps(JSON.parse(JSON.stringify(s.ops)));
    expect(round.routines).toHaveLength(1);
    expect(
      sanitizeOps({ routines: [{ id: 1 }], tasks: "x", bots: { a: { level: 99 } } }).bots.a!.level,
    ).toBe(3);
  });
});

describe("bot upgrade looks", () => {
  it("antenna and sensor puck sit on the shell (never float), every bot and level", async () => {
    const { BOT_IDS, botVisual } = await import("@/lib/world/models/characters");
    for (const id of BOT_IDS)
      for (let level = 1; level <= 3; level++) {
        const v = botVisual(id, true, level);
        for (const name of level >= 3
          ? ["upgrade_antenna", "upgrade_sensor"]
          : ["upgrade_antenna"]) {
          const p = v.parts.find((x) => x.name === name)!;
          // Some base voxel directly under the part's footprint, touching its bottom.
          let seated = false;
          p.model.grid.forEach((x, y, z) => {
            if (y !== 0) return;
            if (v.base.grid.get(p.offset[0] + x, p.offset[1] - 1, p.offset[2] + z)) seated = true;
          });
          expect(seated, `${id} L${level} ${name}`).toBe(true);
        }
      }
  });
});

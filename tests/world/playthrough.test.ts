/**
 * Greedy simulated player: uses only reachable pickups, notes, puzzles,
 * NPCs (incl. bot reactivation quests), device panels, recipes and
 * combinations — no cheats — and must reach every ending, including the
 * secret one. Guards against soft-locks when content changes. The player
 * itself lives in `simPlayer.ts` (shared with `connectivity.test.ts`).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { SLICE_TOTAL } from "@/lib/world/content/items";
import { ROOMS, SLICE_PICKUPS } from "@/lib/world/content/map";
import { BOT_QUESTS, ENDINGS } from "@/lib/world/content/story";
import { checkStage, floorAccessible, isBuilt, reachableRooms } from "@/lib/world/game";
import { dailyPriceModifier } from "@/lib/game/volatility";
import { play, type SimRun } from "./simPlayer";

/** First day (from 2026-01-01) whose UEC output hits the given extreme. */
function dayWith(pick: "min" | "max"): string {
  let best = "2026-01-01";
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    const m = dailyPriceModifier(d);
    if (pick === "min" ? m < dailyPriceModifier(best) : m > dailyPriceModifier(best)) best = d;
  }
  return best;
}

function assertComplete(run: SimRun): void {
  const s = run.s;
  const missing = DEVICES.filter((d) => !isBuilt(s, d.id)).map(
    (d) => `${d.id}: ${checkStage(s, d.id)?.blockers.join(" | ")}`,
  );
  expect(missing, missing.join("\n")).toEqual([]);
  expect(Object.keys(s.endings).sort()).toEqual(ENDINGS.map((e) => e.id).sort());
  expect(BOT_QUESTS.filter((q) => !s.flags[q.flag]).map((q) => q.npc)).toEqual([]);
  expect(SLICE_PICKUPS.filter((id) => s.taken[id] === undefined)).toEqual([]);
}

describe("simulated playthrough", () => {
  const run = play();
  const s = run.s;

  it("builds every device without soft-locks", () => {
    const missing = DEVICES.filter((d) => !isBuilt(s, d.id)).map(
      (d) => `${d.id}: ${checkStage(s, d.id)?.blockers.join(" | ")}`,
    );
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("reaches all endings, including the secret »Kristall #0089«", () => {
    expect(Object.keys(s.endings).sort()).toEqual(ENDINGS.map((e) => e.id).sort());
  });

  it("reactivates every lore bot", () => {
    const asleep = BOT_QUESTS.filter((q) => !s.flags[q.flag]).map((q) => q.npc);
    expect(asleep).toEqual([]);
    expect(s.insights.alle_bots).toBeTruthy();
  });

  it("collects all 30 slices of Crystal #0089", () => {
    const left = SLICE_PICKUPS.filter((id) => s.taken[id] === undefined);
    expect(left).toEqual([]);
    expect(s.counters.slices).toBe(SLICE_TOTAL);
  });

  it("visits the new floors", () => {
    expect(floorAccessible(s, 4)).toBe(true);
    expect(floorAccessible(s, 5)).toBe(true);
    // Every room of both floors, core and passages included.
    expect(reachableRooms(s, 4).size).toBe(ROOMS.filter((r) => r.floor === 4).length);
    expect(reachableRooms(s, 5).size).toBe(ROOMS.filter((r) => r.floor === 5).length);
  });

  it("finishes in a sensible number of steps", () => {
    expect(run.steps).toBeLessThan(600);
  });
});

/** The UEC output swings ±25 % per calendar day — the lab must work on every day. */
describe("playthrough on extreme volatility days", () => {
  for (const pick of ["min", "max"] as const) {
    describe(`${pick} day`, () => {
      beforeAll(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(`${dayWith(pick)}T12:00:00Z`));
      });
      afterAll(() => {
        vi.useRealTimers();
      });
      it("still completes everything", () => {
        assertComplete(play());
      });
    });
  }
});

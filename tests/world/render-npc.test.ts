/**
 * Pure render helpers: motion smoothing, NPC brain, atmosphere.
 */
import { describe, expect, it } from "vitest";
import {
  angleDelta,
  smoothDamp,
  smoothstep01,
  turnToward,
  wrapAngle,
} from "@/lib/world/render/motion";
import {
  NPC_PERSONAL_SPACE,
  bodyFree,
  createBrain,
  findFreeSpot,
  pathFree,
  stepBrain,
  type NpcBrainConfig,
  type NpcWorld,
} from "@/lib/world/render/npc-brain";
import {
  brownoutInterval,
  floorMood,
  newlyOnline,
  roomFramingOffset,
} from "@/lib/world/render/atmosphere";
import type { FloorId } from "@/lib/world/types";

/** 40×40 room with walls on the border and a pillar block at 18..22. */
function room(): (x: number, z: number) => boolean {
  return (x, z) => {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (cx <= 0 || cz <= 0 || cx >= 39 || cz >= 39) return true;
    return cx >= 18 && cx <= 22 && cz >= 18 && cz <= 22;
  };
}

function world(px = 100, pz = 100, others: number[] = []): NpcWorld {
  return { blocked: room(), playerX: px, playerZ: pz, others };
}

describe("motion", () => {
  it("wraps angles into [−π, π)", () => {
    expect(wrapAngle(2.5 * Math.PI)).toBeCloseTo(Math.PI / 2, 6);
    expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 6);
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6, 6);
  });

  it("turns along the shortest arc without snapping", () => {
    let a = 3;
    const next = turnToward(a, -3, 1 / 60, 6, 5);
    // Shortest arc from 3 to −3 goes through π (positive direction).
    expect(wrapAngle(next - a)).toBeGreaterThan(0);
    expect(Math.abs(wrapAngle(next - a))).toBeLessThanOrEqual(5 / 60 + 1e-9);
    for (let i = 0; i < 300; i++) a = turnToward(a, -3, 1 / 60);
    expect(Math.abs(angleDelta(a, -3))).toBeLessThan(0.01);
  });

  it("smoothDamp converges without overshoot", () => {
    const s = { v: 0 };
    let x = 0;
    let max = 0;
    for (let i = 0; i < 240; i++) {
      x = smoothDamp(s, x, 10, 0.2, 1 / 60);
      max = Math.max(max, x);
    }
    expect(x).toBeCloseTo(10, 3);
    expect(max).toBeLessThanOrEqual(10);
    expect(smoothDamp(s, 3, 5, 0.2, 0)).toBe(3);
    expect(smoothstep01(-1)).toBe(0);
    expect(smoothstep01(2)).toBe(1);
  });
});

describe("npc brain", () => {
  const cfg = (over: Partial<NpcBrainConfig> = {}): NpcBrainConfig => ({
    homeX: 10,
    homeZ: 10,
    wander: 6,
    stations: [],
    radius: 0.8,
    speed: 3.2,
    ...over,
  });

  it("probes bodies and paths against the collider", () => {
    const w = world();
    expect(bodyFree(w, 10, 10, 0.8)).toBe(true);
    expect(bodyFree(w, 17.5, 10, 0.8)).toBe(true);
    expect(bodyFree(w, 20, 20, 0.8)).toBe(false);
    expect(pathFree(w, 10, 20, 30, 20, 0.8)).toBe(false);
    expect(pathFree(w, 10, 10, 15, 10, 0.8)).toBe(true);
  });

  it("findFreeSpot returns a walkable point near the target", () => {
    const spot = findFreeSpot(room(), 20, 20, 5, 1);
    expect(spot).not.toBeNull();
    expect(bodyFree(world(), spot!.x, spot!.z, 1)).toBe(true);
    expect(Math.hypot(spot!.x - 20, spot!.z - 20)).toBeCloseTo(5, 5);
    // Fully enclosed → nothing.
    expect(findFreeSpot(() => true, 5, 5, 2, 1)).toBeNull();
  });

  it("wanders inside its leash, never through walls, and turns smoothly", () => {
    const b = createBrain("r3tr0", 10, 10);
    const c = cfg();
    const w = world();
    let maxTurn = 0;
    let moved = 0;
    for (let i = 0; i < 60 * 90; i++) {
      const yaw = b.yaw;
      const x = b.x;
      const z = b.z;
      stepBrain(b, c, w, 1 / 60);
      maxTurn = Math.max(maxTurn, Math.abs(angleDelta(yaw, b.yaw)));
      moved += Math.hypot(b.x - x, b.z - z);
      expect(bodyFree(w, b.x, b.z, c.radius)).toBe(true);
      expect(Math.hypot(b.x - c.homeX, b.z - c.homeZ)).toBeLessThanOrEqual(c.wander + 4 + 1e-6);
    }
    expect(moved).toBeGreaterThan(10);
    // 3.2 rad/s cap at 60 fps.
    expect(maxTurn).toBeLessThanOrEqual(3.2 / 60 + 1e-9);
  });

  it("works at a nearby station, facing it", () => {
    const b = createBrain("x0r8t", 10, 10);
    const c = cfg({ wander: 0, stations: [{ x: 10, z: 13, sx: 10, sz: 10.5 }] });
    for (let i = 0; i < 60 * 8; i++) stepBrain(b, c, world(), 1 / 60);
    expect(b.mode).toBe("work");
    expect(Math.abs(angleDelta(b.yaw, Math.atan2(0, 3)))).toBeLessThan(0.05);
    expect(b.workW).toBeGreaterThan(0.5);
    // Stationary bots never walk.
    expect(b.x).toBe(10);
    expect(b.z).toBe(10);
  });

  it("stops and turns toward a nearby player", () => {
    const b = createBrain("k2ldr", 10, 10);
    const c = cfg();
    const w = world(10, 14);
    for (let i = 0; i < 60 * 3; i++) stepBrain(b, c, w, 1 / 60);
    expect(b.mode).toBe("watch");
    expect(b.speed).toBe(0);
    expect(Math.abs(angleDelta(b.yaw, 0))).toBeLessThan(0.05);
    // Player leaves → resumes.
    w.playerX = 100;
    stepBrain(b, c, w, 1 / 60);
    expect(b.mode).not.toBe("watch");
  });

  it("two bots sharing a patch keep their distance most of the time", () => {
    const a = createBrain("a", 8, 10);
    const b = createBrain("b", 12, 10);
    const c = cfg({ wander: 5 });
    const others: number[] = [];
    const w: NpcWorld = { blocked: room(), playerX: 100, playerZ: 100, others };
    let close = 0;
    const frames = 60 * 60;
    for (let i = 0; i < frames; i++) {
      others.length = 0;
      others.push(a.x, a.z, b.x, b.z);
      stepBrain(a, c, w, 1 / 60);
      stepBrain(b, c, w, 1 / 60);
      if (Math.hypot(a.x - b.x, a.z - b.z) < NPC_PERSONAL_SPACE * 0.5) close++;
    }
    expect(close / frames).toBeLessThan(0.05);
  });

  it("is deterministic per id", () => {
    const run = () => {
      const b = createBrain("p1ndr0", 10, 10);
      for (let i = 0; i < 600; i++) stepBrain(b, cfg(), world(), 1 / 60);
      return [b.x, b.z, b.yaw];
    };
    expect(run()).toEqual(run());
  });
});

describe("atmosphere", () => {
  it("deep floors are colder and darker, living quarters warmer", () => {
    const warmth = (f: FloorId) => floorMood(f).tint[0] - floorMood(f).tint[2];
    expect(warmth(4)).toBeGreaterThan(warmth(0));
    expect(warmth(3)).toBeLessThan(warmth(0));
    expect(warmth(5)).toBeLessThan(warmth(3));
    expect(floorMood(5).ambient).toBeLessThan(floorMood(0).ambient);
    for (const f of [0, 1, 2, 3, 4, 5] as FloorId[])
      for (const c of floorMood(f).tint) expect(Math.abs(c - 1)).toBeLessThan(0.15);
  });

  it("framing offset is capped and zero outside rooms", () => {
    const out: [number, number] = [9, 9];
    expect(roomFramingOffset(0, 0, undefined, out)).toEqual([0, 0]);
    const [dx, dz] = roomFramingOffset(0, 0, { x: 0, z: 0, w: 200, d: 200 });
    expect(Math.hypot(dx, dz)).toBeCloseTo(2.5, 6);
  });

  it("detects newly online devices and spaces brownout sparks", () => {
    expect(newlyOnline(null, new Set(["A"]))).toEqual([]);
    expect(newlyOnline(new Set(["A"]), new Set(["A", "B"]))).toEqual(["B"]);
    expect(brownoutInterval(0.5, true)).toBeCloseTo(brownoutInterval(0.5, false) * 3, 6);
  });
});

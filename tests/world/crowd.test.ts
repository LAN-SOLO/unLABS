/**
 * Character ↔ character collision: bots and Jade never walk into or through
 * each other (lib/world/crowd.ts + npc-brain).
 */
import { describe, expect, it } from "vitest";
import { clipMove, crowded } from "@/lib/world/crowd";
import {
  NPC_PLAYER_RADIUS,
  createBrain,
  stepBrain,
  type NpcBrain,
  type NpcBrainConfig,
  type NpcWorld,
} from "@/lib/world/render/npc-brain";

function room(): (x: number, z: number) => boolean {
  return (x, z) => {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    return cx <= 0 || cz <= 0 || cx >= 39 || cz >= 39;
  };
}

const cfg = (over: Partial<NpcBrainConfig> = {}): NpcBrainConfig => ({
  homeX: 20,
  homeZ: 20,
  wander: 8,
  stations: [],
  radius: 0.8,
  speed: 3.2,
  ...over,
});

describe("clipMove", () => {
  it("stops a head-on step at the neighbour's surface", () => {
    const [x, z] = clipMove(0, 0, 0.5, 0, 0.8, [2, 0, 0.8]);
    expect(Math.hypot(x - 2, z)).toBeGreaterThanOrEqual(1.6 - 1e-9);
  });

  it("slides round a neighbour on a glancing step", () => {
    const [x, z] = clipMove(0, 0, 0.3, 0.3, 0.8, [1.7, 0, 0.8]);
    expect(z).toBeGreaterThan(0.2);
    expect(Math.hypot(x - 1.7, z)).toBeGreaterThanOrEqual(1.6 - 1e-6);
  });

  it("lets overlapping bodies move apart but not deeper", () => {
    expect(clipMove(0, 0, -0.4, 0, 0.8, [0.5, 0, 0.8])).toEqual([-0.4, 0]);
    expect(clipMove(0, 0, 0.3, 0, 0.8, [0.5, 0, 0.8])).toEqual([0, 0]);
  });

  it("ignores the mover's own entry", () => {
    expect(clipMove(3, 3, 3.5, 3, 0.8, [3, 3, 0.8])).toEqual([3.5, 3]);
    expect(crowded(3, 3, 0.8, [3, 3, 0.8], 3, 3)).toBe(false);
    expect(crowded(3, 3, 0.8, [4, 3, 0.8])).toBe(true);
  });
});

describe("bots in a crowd", () => {
  /** Run bots (and a walking Jade) for `seconds`; return the closest approach seen. */
  function simulate(
    brains: NpcBrain[],
    c: NpcBrainConfig,
    player: (t: number) => [number, number],
    seconds: number,
  ): { bots: number; jade: number } {
    const others: number[] = [];
    const w: NpcWorld = { blocked: room(), playerX: 0, playerZ: 0, others };
    let bots = Infinity;
    let jade = Infinity;
    const dt = 1 / 60;
    for (let f = 0; f < seconds * 60; f++) {
      [w.playerX, w.playerZ] = player(f * dt);
      others.length = 0;
      for (const b of brains) others.push(b.x, b.z);
      brains.forEach((b, k) => {
        stepBrain(b, c, w, dt);
        // Like the engine: later bots see where this one went this frame.
        others[k * 2] = b.x;
        others[k * 2 + 1] = b.z;
        // Other bots have not stepped yet or already have — both must be clear.
        for (const o of brains)
          if (o !== b) bots = Math.min(bots, Math.hypot(o.x - b.x, o.z - b.z));
        jade = Math.min(jade, Math.hypot(w.playerX - b.x, w.playerZ - b.z));
      });
    }
    return { bots, jade };
  }

  it("never overlap each other while wandering the same patch", () => {
    const c = cfg();
    const brains = ["a", "b", "c", "d", "e"].map((id, i) => createBrain(id, 14 + i * 3, 20));
    const { bots } = simulate(brains, c, () => [100, 100], 90);
    expect(bots).toBeGreaterThanOrEqual(2 * c.radius - 1e-6);
  });

  it("never walk into or through Jade", () => {
    const c = cfg({ wander: 10 });
    const brains = [
      createBrain("k2ldr", 12, 20),
      createBrain("p1ndr0", 28, 20),
      createBrain("m4rv", 20, 12),
    ];
    // Jade stands in the middle of their patch.
    const { jade } = simulate(brains, c, () => [20, 20], 90);
    expect(jade).toBeGreaterThanOrEqual(c.radius + NPC_PLAYER_RADIUS - 1e-6);
  });
});

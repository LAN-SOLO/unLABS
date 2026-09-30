/**
 * Walking into doors: the walker must never get stuck on a door that is
 * still sliding open (regression — Jade ran into half-open leaves and
 * stopped). Simulates the real Walker against a wall with a door whose
 * leaves follow the door system's timing (`doorWantsOpen`, DOOR_ANIM_TIME,
 * `doorCellCovered`) and the steering assist (`doorAssist`).
 */
import { describe, expect, it } from "vitest";
import { DOORS } from "@/lib/world/content/map";
import { WALKER, Walker } from "@/lib/world/actor";
import {
  DOOR_ANIM_TIME,
  doorAssist,
  doorCellCovered,
  doorWantsOpen,
  easeInOut,
} from "@/lib/world/render/doors";
import { OPENING_W } from "@/lib/world/models/doors";
import type { DoorDef } from "@/lib/world/types";
import type { VoxelSource } from "@/lib/voxel/grid";

const DOOR: DoorDef = { id: "test", floor: 0, x: 20, z: 20, axis: "x", width: 5 };

function run(start: [number, number], dir: [number, number], boost: number, assist: boolean) {
  let t = 0;
  let target = 0;
  const src: VoxelSource = {
    get(x, y, z) {
      if (y < 0) return 1;
      if (y === 0) return 1; // slab
      if (z !== 20 || y > 8) return 0;
      const o = x - DOOR.x;
      if (Math.abs(o) > 2) return 1; // wall
      return y <= 6 && doorCellCovered(o, easeInOut(t)) ? 1 : 0;
    },
  };
  const w = new Walker([start[0], 1, start[1]], WALKER.radius);
  const n = Math.hypot(dir[0], dir[1]);
  const d: [number, number] = [dir[0] / n, dir[1] / n];
  const dt = 1 / 120;
  let stalled = 0;
  let worstStall = 0;
  for (let i = 0; i < 360; i++) {
    const p = w.position;
    const move = assist ? doorAssist([DOOR], [p[0], p[2]], d, () => true) : d;
    const vel: [number, number] = [move[0] * WALKER.speed * boost, move[1] * WALKER.speed * boost];
    target = doorWantsOpen(DOOR, [p[0], p[2]], vel, target === 1) ? 1 : 0;
    t = target ? Math.min(1, t + dt / DOOR_ANIM_TIME) : Math.max(0, t - dt / DOOR_ANIM_TIME);
    w.update(src, [move[0] * boost, move[1] * boost], dt, 1);
    const q = w.position;
    const moved = Math.hypot(q[0] - p[0], q[2] - p[2]);
    stalled = moved < WALKER.speed * boost * dt * 0.15 ? stalled + dt : 0;
    worstStall = Math.max(worstStall, stalled);
    if (q[2] > 24) return { through: true, time: i * dt, worstStall };
  }
  return { through: false, time: 3, worstStall };
}

describe("walking into doors", () => {
  const cases: [string, [number, number], [number, number]][] = [
    ["head-on", [20.5, 6], [0, 1]],
    ["off-centre", [21.9, 6], [0, 1]],
    ["off-centre left", [19.0, 7], [0, 1]],
    ["diagonal", [27, 9], [-0.45, 1]],
    ["steep diagonal", [12, 12], [0.8, 1]],
  ];
  for (const [name, start, dir] of cases)
    for (const [mode, boost] of [
      ["walking", 1],
      ["running", 1.55],
    ] as const)
      it(`${name}, ${mode}: passes without stopping at a half-open leaf`, () => {
        const r = run(start, dir, boost, true);
        expect(r.through, `${name} ${mode}`).toBe(true);
        expect(r.worstStall, `${name} ${mode}`).toBeLessThan(0.05);
      });

  it("opens for where the walker is heading, not only where it is", () => {
    // 9 units away: too far for the radius, but running at it.
    expect(doorWantsOpen(DOOR, [20.5, 11.5], [0, 0], false)).toBe(false);
    expect(doorWantsOpen(DOOR, [20.5, 11.5], [0, 20], false)).toBe(true);
    // Walking away does not open it.
    expect(doorWantsOpen(DOOR, [20.5, 11.5], [0, -20], false)).toBe(false);
  });

  it("the assist steers towards the centre line only when heading into the doorway", () => {
    const [mx] = doorAssist([DOOR], [22.2, 17], [0, 1], () => true);
    expect(mx).toBeLessThan(0); // pulled back towards x = 20.5
    const away = doorAssist([DOOR], [22.2, 17], [0, -1], () => true);
    expect(away).toEqual([0, -1]);
    const locked = doorAssist([DOOR], [22.2, 17], [0, 1], () => false);
    expect(locked).toEqual([0, 1]);
    const far = doorAssist([DOOR], [30, 17], [0, 1], () => true);
    expect(far).toEqual([0, 1]);
  });

  it("every door in the game is as wide as the door model's opening", () => {
    for (const d of DOORS) expect(d.width, d.id).toBe(OPENING_W);
  });
});

/**
 * Click-to-move pathfinding: paths never cross walls, go through doorways,
 * respect locked doors, string pulling keeps line of sight, and solving all
 * room-to-room pairs of every floor stays fast.
 */
import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { decorFootprints } from "@/lib/world/content/interior";
import { DOORS, FLOORS, FLOOR_SIZE, PROPS, ROOMS } from "@/lib/world/content/map";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_SCALE,
  ROOM_TERMINAL_SIZE,
} from "@/lib/world/content/terminals";
import { FloorCollision, WALKER } from "@/lib/world/actor";
import { buildFloor, doorCells } from "@/lib/world/layout";
import { MODEL_SCALE, deviceModel, deviceVisual, propModel } from "@/lib/world/models";
import {
  columnBlocked,
  createNavGrid,
  findPath,
  lineClear,
  nearestFree,
  nodeCentre,
  setDynamicBlocked,
  smoothPath,
  updateNavGrid,
  type NavGrid,
  type XZ,
} from "@/lib/world/pathfind";
import type { DoorDef, FloorId, RoomDef } from "@/lib/world/types";

// ── Synthetic grids ──────────────────────────────────────────────

/** 30 × 20 voxels: outer walls, a wall at x = 15 with a 5-wide door at z = 8..12. */
function twoRooms(): { grid: NavGrid; blocked: (x: number, z: number) => boolean } {
  const blocked = (x: number, z: number): boolean =>
    x === 0 || z === 0 || x === 29 || z === 19 || (x === 15 && (z < 8 || z > 12));
  return { grid: createNavGrid(30, 20, blocked, { half: WALKER.width / 2 }), blocked };
}

const DOOR_CELLS: XZ[] = [8, 9, 10, 11, 12].map((z) => [15, z]);

/**
 * Independent check: at dense samples along every segment, every voxel
 * column under the walker's box is free (static + dynamic layers).
 */
function segmentsClear(g: NavGrid, pts: XZ[], ignoreDynamic = false): boolean {
  const h = g.half - 1e-3;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!;
    const [bx, bz] = pts[i]!;
    if (!lineClear(g, ax, az, bx, bz, ignoreDynamic)) return false;
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 20) + 1;
    for (let s = 0; s <= n; s++) {
      const x = ax + ((bx - ax) * s) / n;
      const z = az + ((bz - az) * s) / n;
      for (let vz = Math.floor(z - h); vz <= Math.floor(z + h); vz++)
        for (let vx = Math.floor(x - h); vx <= Math.floor(x + h); vx++) {
          const v = vx + vz * g.sx;
          if (g.vox[v] || (!ignoreDynamic && g.dyn[v])) return false;
        }
    }
  }
  return true;
}

describe("pathfind — synthetic", () => {
  it("routes through the doorway, never through the wall", () => {
    const { grid } = twoRooms();
    const r = findPath(grid, [5, 3], [25, 3]);
    expect(r.reached).toBe(true);
    expect(segmentsClear(grid, r.points)).toBe(true);
    // Crosses the wall line inside the door opening.
    const crossing = r.points.some(
      (p, i) =>
        i > 0 &&
        (() => {
          const q = r.points[i - 1]!;
          if ((q[0] - 15.5) * (p[0] - 15.5) > 0) return false;
          const t = (15.5 - q[0]) / (p[0] - q[0] || 1);
          const z = q[1] + (p[1] - q[1]) * t;
          return z >= 8 && z <= 13;
        })(),
    );
    expect(crossing).toBe(true);
    // String pulling: few corners, not a staircase.
    expect(r.points.length).toBeLessThanOrEqual(4);
  });

  it("a locked door blocks; the path ends near it and ignoring locks finds the way", () => {
    const { grid } = twoRooms();
    setDynamicBlocked(grid, DOOR_CELLS);
    const r = findPath(grid, [5, 10], [25, 10]);
    expect(r.reached).toBe(false);
    expect(segmentsClear(grid, r.points)).toBe(true);
    const end = r.points[r.points.length - 1]!;
    expect(end[0]).toBeLessThan(15);
    expect(Math.hypot(end[0] - 15, end[1] - 10)).toBeLessThan(4);
    expect(findPath(grid, [5, 10], [25, 10], { ignoreDynamic: true }).reached).toBe(true);
    setDynamicBlocked(grid, []);
    expect(findPath(grid, [5, 10], [25, 10]).reached).toBe(true);
  });

  it("static patches (a crate in the doorway) close the way", () => {
    const { grid, blocked } = twoRooms();
    const changed = updateNavGrid(grid, (x, z) => blocked(x, z) || (x === 15 && z === 10));
    expect(changed).toBe(1);
    // 2 + 2 free door cells are too narrow for the 2.2-wide walker.
    expect(findPath(grid, [5, 10], [25, 10]).reached).toBe(false);
    updateNavGrid(grid, blocked);
    expect(findPath(grid, [5, 10], [25, 10]).reached).toBe(true);
  });

  it("clicking into a wall walks to the nearest free spot", () => {
    const { grid } = twoRooms();
    const r = findPath(grid, [5, 10], [15.5, 3.5]);
    expect(r.reached).toBe(false);
    const end = r.points[r.points.length - 1]!;
    expect(Math.hypot(end[0] - 15.5, end[1] - 3.5)).toBeLessThan(2.5);
    expect(end[0]).toBeLessThan(15);
  });

  it("accept() ends the search within reach", () => {
    const { grid } = twoRooms();
    const r = findPath(grid, [5, 10], [25, 10], {
      accept: (x, z) => x > 16 && Math.hypot(x - 25, z - 10) <= 4,
    });
    expect(r.reached).toBe(true);
    const end = r.points[r.points.length - 1]!;
    expect(Math.hypot(end[0] - 25, end[1] - 10)).toBeLessThanOrEqual(4.01);
  });

  it("diagonals never cut a blocked corner", () => {
    const g = createNavGrid(4, 4, (x, z) => x === 1 && z === 1, { res: 1, half: 0.4 });
    // The box grazes the blocked voxel (1,1) on any diagonal past its corner.
    expect(lineClear(g, 0.5, 1.5, 1.5, 0.5)).toBe(false);
    expect(lineClear(g, 0.5, 0.5, 2.5, 2.5)).toBe(false);
    expect(lineClear(g, 0.5, 0.5, 3.5, 0.5)).toBe(true);
    expect(lineClear(g, 2.5, 0.5, 3.5, 3.5)).toBe(true);
    const r = findPath(g, [0.5, 0.5], [2.5, 2.5], { raw: true });
    expect(r.reached).toBe(true);
    for (let i = 1; i < r.points.length; i++) {
      const [ax, az] = r.points[i - 1]!;
      const [bx, bz] = r.points[i]!;
      if (ax !== bx && az !== bz) {
        // Diagonal step: both orthogonal cells free.
        expect(g.node[Math.floor(bx) + Math.floor(az) * g.nx]).toBe(1);
        expect(g.node[Math.floor(ax) + Math.floor(bz) * g.nx]).toBe(1);
      }
    }
  });

  it("string pulling keeps line of sight between consecutive waypoints", () => {
    const { grid } = twoRooms();
    const raw = findPath(grid, [3, 3], [26, 16], { raw: true });
    expect(raw.reached).toBe(true);
    const smooth = smoothPath(grid, raw.points);
    expect(smooth.length).toBeLessThan(raw.points.length);
    expect(smooth[0]).toEqual(raw.points[0]);
    expect(smooth[smooth.length - 1]).toEqual(raw.points[raw.points.length - 1]);
    expect(segmentsClear(grid, smooth)).toBe(true);
  });
});

// ── Real floors ──────────────────────────────────────────────────

/** Floor collision as the engine builds it with every device built (see walkability.test). */
function collisionFor(floor: FloorId): FloorCollision {
  const layout = buildFloor(floor);
  const col = new FloorCollision(layout.world, FLOOR_SIZE.x, FLOOR_SIZE.z);
  const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
  for (const d of DEVICES) {
    if (roomFloor.get(d.room) !== floor) continue;
    const m = deviceModel(d.id);
    const sc = deviceVisual(d.id).scale ?? MODEL_SCALE;
    const hw = (m.w * sc) / 2;
    const hd = (m.d * sc) / 2;
    col.addFootprint(
      d.x + 0.5 - hw + 0.3,
      d.z + 0.5 - hd + 0.3,
      d.x + 0.5 + hw - 0.3,
      d.z + 0.5 + hd - 0.3,
      m.h * sc,
    );
  }
  for (const p of PROPS) {
    if (p.floor !== floor || p.model === "elevator") continue;
    const m = propModel(p.model);
    const rot = (p.rot ?? 0) % 2 === 1;
    const hw = ((rot ? m.d : m.w) * MODEL_SCALE) / 2;
    const hd = ((rot ? m.w : m.d) * MODEL_SCALE) / 2;
    col.addFootprint(
      p.x + 0.8 - hw,
      p.z + 0.8 - hd,
      p.x + 0.2 + hw,
      p.z + 0.2 + hd,
      m.h * MODEL_SCALE,
    );
  }
  for (const t of ROOM_TERMINALS) {
    if (t.floor !== floor) continue;
    const odd = (t.rot ?? 0) % 2 === 1;
    const hw = ((odd ? ROOM_TERMINAL_SIZE.d : ROOM_TERMINAL_SIZE.w) * ROOM_TERMINAL_SCALE) / 2;
    const hd = ((odd ? ROOM_TERMINAL_SIZE.w : ROOM_TERMINAL_SIZE.d) * ROOM_TERMINAL_SCALE) / 2;
    col.addFootprint(
      t.x + 0.8 - hw,
      t.z + 0.8 - hd,
      t.x + 0.2 + hw,
      t.z + 0.2 + hd,
      ROOM_TERMINAL_SIZE.h * ROOM_TERMINAL_SCALE,
    );
  }
  for (const f of decorFootprints(floor)) col.addFootprint(f.x0, f.z0, f.x1, f.z1, f.h);
  return col;
}

function roomOf(floor: FloorId, x: number, z: number): RoomDef | undefined {
  return ROOMS.find(
    (r) =>
      r.floor === floor && x >= r.x + 1 && x < r.x + r.w - 1 && z >= r.z + 1 && z < r.z + r.d - 1,
  );
}

/** A free walker spot inside the room (spiral out from its centre, staying inside). */
function spotIn(g: NavGrid, r: RoomDef): XZ | null {
  const cx = r.x + r.w / 2;
  const cz = r.z + r.d / 2;
  const reach = Math.max(r.w, r.d) / 2;
  for (let rad = 0; rad <= reach; rad += 1) {
    const n = nearestFree(g, cx, cz, rad);
    if (!n) continue;
    const [x, z] = nodeCentre(g, n[0], n[1]);
    if (roomOf(r.floor, x, z)?.id === r.id) return [x, z];
  }
  return null;
}

function doorsOn(floor: FloorId): DoorDef[] {
  return DOORS.filter((d) => d.floor === floor);
}

/** Does the walker box at some sampled point of the path overlap a cell of one of `doors`? */
function touchesDoor(pts: XZ[], doors: DoorDef[], half: number): boolean {
  const cells = new Set(doors.flatMap((d) => doorCells(d).map((c) => `${c.x},${c.z}`)));
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!;
    const [bx, bz] = pts[i]!;
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 4) + 1;
    for (let s = 0; s <= n; s++) {
      const x = ax + ((bx - ax) * s) / n;
      const z = az + ((bz - az) * s) / n;
      for (let vz = Math.floor(z - half); vz <= Math.floor(z + half); vz++)
        for (let vx = Math.floor(x - half); vx <= Math.floor(x + half); vx++)
          if (cells.has(`${vx},${vz}`)) return true;
    }
  }
  return false;
}

const grids = new Map<FloorId, NavGrid>();
function gridFor(floor: FloorId): NavGrid {
  let g = grids.get(floor);
  if (!g) {
    const col = collisionFor(floor);
    g = createNavGrid(
      FLOOR_SIZE.x,
      FLOOR_SIZE.z,
      columnBlocked((x, y, z) => col.get(x, y, z)),
      { half: WALKER.width / 2 },
    );
    grids.set(floor, g);
  }
  setDynamicBlocked(g, []);
  return g;
}

describe("pathfind — lab floors", () => {
  for (const f of FLOORS) {
    const floor = f.id;
    it(`floor ${floor}: room-to-room paths stay on free cells and pass doorways`, () => {
      const g = gridFor(floor);
      const rooms = ROOMS.filter((r) => r.floor === floor);
      const spots = rooms.map((r) => [r, spotIn(g, r)] as const).filter(([, s]) => s !== null);
      expect(spots.length, "every room has a free spot").toBe(rooms.length);
      const doors = doorsOn(floor);
      let reached = 0;
      let pairs = 0;
      for (const [ra, a] of spots)
        for (const [rb, b] of spots) {
          if (ra.id === rb.id) continue;
          pairs++;
          const r = findPath(g, a!, b!);
          expect(segmentsClear(g, r.points), `${ra.id} → ${rb.id}`).toBe(true);
          if (!r.reached) continue;
          reached++;
          // Rooms are walled: leaving one means passing a door opening.
          expect(touchesDoor(r.points, doors, g.half), `${ra.id} → ${rb.id} via door`).toBe(true);
        }
      // With every door open (all locks ignored), the floor is one connected lab.
      expect(reached, `${reached}/${pairs} pairs reachable`).toBe(pairs);
    });
  }

  it("a closed (locked) door is never crossed", () => {
    let checked = 0;
    for (const d of DOORS) {
      const g = gridFor(d.floor);
      const cells = doorCells(d);
      // Points 3 voxels either side of the door.
      const off: XZ = d.axis === "x" ? [0, 3] : [3, 0];
      const a = nearestFree(g, d.x + 0.5 - off[0], d.z + 0.5 - off[1], 1.5);
      const b = nearestFree(g, d.x + 0.5 + off[0], d.z + 0.5 + off[1], 1.5);
      if (!a || !b) continue;
      const pa = nodeCentre(g, a[0], a[1]);
      const pb = nodeCentre(g, b[0], b[1]);
      setDynamicBlocked(
        g,
        cells.map((c) => [c.x, c.z] as XZ),
      );
      const r = findPath(g, pa, pb);
      expect(segmentsClear(g, r.points), d.id).toBe(true);
      expect(touchesDoor(r.points, [d], g.half - 0.05), d.id).toBe(false);
      setDynamicBlocked(g, []);
      checked++;
    }
    expect(checked).toBeGreaterThan(DOORS.length / 2);
  });

  it("solves every room pair on every floor quickly", () => {
    let total = 0;
    let n = 0;
    for (const f of FLOORS) gridFor(f.id); // grid build is a one-off per floor
    const t0 = performance.now();
    for (const f of FLOORS) {
      const g = gridFor(f.id);
      const spots = ROOMS.filter((r) => r.floor === f.id)
        .map((r) => spotIn(g, r))
        .filter((s): s is XZ => s !== null);
      for (const a of spots)
        for (const b of spots) {
          if (a === b) continue;
          total += findPath(g, a, b).expansions;
          n++;
        }
    }
    const ms = performance.now() - t0;
    expect(n).toBeGreaterThan(20);
    // Generous CI bound; typical is a few ms per path.
    expect(ms / n, `${n} paths, ${ms.toFixed(0)} ms, ${total} expansions`).toBeLessThan(25);
  });
});

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { C } from "@/lib/world/content/palette";
import { DOORS, ELEVATORS } from "@/lib/world/content/map";
import { buildFloor, DOOR_HEIGHT, doorCells } from "@/lib/world/layout";
import {
  BEACON_D,
  BEACON_ROW,
  DOOR_SCALE,
  FRAME_D,
  FRAME_H,
  FRAME_W,
  LEAF_D,
  LEAF_H,
  LEAF_W,
  PLATFORM_W,
  SECRET_LEAF_D,
  doorBeaconModel,
  doorFrameModel,
  doorLeafModel,
  elevatorPlatformVisual,
  elevatorWinchVisual,
  gateBarZ,
  GATE_BARS,
  HEADER_Y,
  headerLedColor,
  panelSkin,
  secretDoorModels,
  secretSkinFor,
} from "@/lib/world/models/doors";
import {
  DOOR_PASSABLE_AT,
  DoorSystem,
  ElevatorSystem,
  doorCellCovered,
  easeInOut,
  elevatorDuration,
  elevatorEventTimes,
  elevatorPose,
  leafSpan,
  rideDirection,
  type ElevatorEvent,
  type MeshModel,
} from "@/lib/world/render/doors";
import type { VoxelGrid } from "@/lib/voxel/grid";

/** Stand-in mesher: a box of the grid's size, centred in x/z, y from 0 (like the engine's). */
const mesher: MeshModel = (grid: VoxelGrid, scale: number) => {
  const geo = new THREE.BoxGeometry(grid.sx, grid.sy, grid.sz).translate(0, grid.sy / 2, 0);
  const mesh = new THREE.Mesh(geo);
  mesh.scale.setScalar(scale);
  return mesh;
};

function gridBytes(g: VoxelGrid): string {
  const out: number[] = [];
  g.forEach((x, y, z, v) => out.push(x, y, z, v));
  return out.join(",");
}

describe("door models", () => {
  it("leaves fill the 5 × 6 opening inside the 1-voxel wall", () => {
    for (const side of ["left", "right"] as const) {
      const m = doorLeafModel(side, { light: "green", keypad: side === "right" });
      expect([m.w, m.h, m.d]).toEqual([LEAF_W, LEAF_H, LEAF_D]);
    }
    expect(2 * LEAF_W * DOOR_SCALE).toBe(5);
    expect(LEAF_H * DOOR_SCALE).toBe(DOOR_HEIGHT);
    expect(LEAF_D * DOOR_SCALE).toBeLessThan(1);
    expect(SECRET_LEAF_D * DOOR_SCALE).toBe(1);
  });

  it("frame covers the frame cells + header and stays clear of the walker", () => {
    const f = doorFrameModel();
    expect([f.w, f.h, f.d]).toEqual([FRAME_W, FRAME_H, FRAME_D]);
    expect(FRAME_W * DOOR_SCALE).toBe(7); // 5 opening cells + 2 frame cells
    expect(FRAME_H * DOOR_SCALE).toBe(DOOR_HEIGHT + 1); // opening + header row
    expect(FRAME_D * DOOR_SCALE).toBe(1.5); // proud 0.25 on both wall faces
    // The clear opening inside the frame is ≥ 4.5 wide and ≥ 5.75 high (walker 2.2 × 5.1).
    let clearW = 0;
    for (let x = 0; x < f.w; x++) if (!f.grid.get(x, 5, 0)) clearW++;
    let clearH = 0;
    for (let y = 0; y < f.h; y++) if (!f.grid.get(f.w / 2, y, 0)) clearH++;
    expect(clearW * DOOR_SCALE).toBeGreaterThanOrEqual(4.5);
    expect(clearH * DOOR_SCALE).toBeGreaterThanOrEqual(5.75);
    const b = doorBeaconModel("red");
    expect(b.d).toBe(BEACON_D);
    expect(BEACON_ROW + b.h).toBeLessThanOrEqual(FRAME_H);
  });

  it("variants differ in their status light", () => {
    const has = (light: "green" | "amber" | "red", c: number) => {
      let n = 0;
      doorLeafModel("left", { light }).grid.forEach((_x, _y, _z, v) => {
        if (v === c) n++;
      });
      return n;
    };
    expect(has("green", C.led_green)).toBeGreaterThan(0);
    expect(has("amber", C.led_amber)).toBeGreaterThan(0);
    expect(has("red", C.led_red)).toBeGreaterThan(0);
    expect(has("red", C.led_green)).toBe(0);
  });

  it("secret doors match the wall they sit in", () => {
    for (const d of DOORS.filter((x) => x.secret)) {
      const s = secretDoorModels(secretSkinFor(d));
      expect([s.left.w, s.left.h, s.left.d]).toEqual([LEAF_W, LEAF_H, SECRET_LEAF_D]);
      expect([s.cover.w, s.cover.h]).toEqual([FRAME_W, FRAME_H]);
      // Compare a non-seam voxel of the cover with the untouched layout wall beside the door.
      const world = buildFloor(d.floor).world;
      const o = 3; // frame cell
      const x = d.axis === "x" ? d.x + o : d.x;
      const z = d.axis === "x" ? d.z : d.z + o;
      for (const y of [2, 4, 6])
        expect(s.cover.grid.get(26, (y - 1) * 4 + 1, 1)).toBe(secretSkinFor(d)(o, y));
      // The frame cell itself is hazard-painted by layout; the wall one further out is plain.
      expect(secretSkinFor(d)(o + 1, 3)).toBe(
        world.get(x + (d.axis === "x" ? 1 : 0), 3, z + (d.axis === "z" ? 1 : 0)),
      );
    }
    const plain = secretDoorModels(panelSkin(C.wall_dark));
    expect(plain.cover.grid.get(4, 0, 0)).toBe(0); // leaf area cut out of the cover
  });

  it("secret door frames wear the wall trim instead of lit amber", () => {
    const header = (m: ReturnType<typeof doorFrameModel>) => {
      const seen = new Set<number>();
      m.grid.forEach((_x, y, _z, v) => {
        if (y > HEADER_Y) seen.add(v);
      });
      return seen;
    };
    const normal = header(doorFrameModel());
    const secret = header(doorFrameModel({ secret: true }));
    expect(normal.has(C.door_frame)).toBe(true);
    expect(normal.has(C.led_amber)).toBe(true);
    expect(secret.has(C.door_frame)).toBe(false);
    expect(secret.has(C.led_amber)).toBe(false);
    expect(secret.has(C.wall_trim)).toBe(true);
    expect(headerLedColor({ secret: true })).toBe(C.wall_trim);
    // Same silhouette either way (only colours differ).
    const occ = (m: ReturnType<typeof doorFrameModel>) => {
      const out: number[] = [];
      m.grid.forEach((x, y, z) => out.push(x, y, z));
      return out.join(",");
    };
    expect(occ(doorFrameModel({ secret: true }))).toBe(occ(doorFrameModel()));
  });

  it("elevator cage has mesh panels between the rails but an open entry side", () => {
    const m = elevatorPlatformVisual().base;
    let mesh = 0;
    for (let x = 1; x < PLATFORM_W - 1; x++)
      for (let y = 9; y < 14; y++) if (m.grid.get(x, y, 0) === C.steel_dark) mesh++;
    expect(mesh).toBeGreaterThan(10);
    // West side (x = 0) between the posts stays open for the gate at walker height.
    for (let z = 1; z < PLATFORM_W - 1; z++)
      for (let y = 4; y < 14; y++) expect(m.grid.get(0, y, z), `${y},${z}`).toBe(0);
  });

  it("elevator platform fits the 7 × 7 shaft cells and carries a status screen", () => {
    const v = elevatorPlatformVisual();
    expect(v.base.w * DOOR_SCALE).toBe(7);
    expect(v.base.d * DOOR_SCALE).toBe(7);
    expect(v.base.w).toBe(PLATFORM_W);
    expect(v.screens?.map((s) => s.content)).toEqual(["status"]);
    const w = elevatorWinchVisual();
    expect(w.parts.map((p) => p.name)).toEqual(["sheave", "drum"]);
    expect(w.base.d * DOOR_SCALE).toBe(9); // spans the overhead frame (e.z ± 4)
  });

  it("models are deterministic", () => {
    const a = gridBytes(doorLeafModel("right", { light: "amber", keypad: true }).grid);
    const b = gridBytes(doorLeafModel("right", { light: "amber", keypad: true }).grid);
    expect(a).toBe(b);
    expect(gridBytes(elevatorPlatformVisual().base.grid)).toBe(
      gridBytes(elevatorPlatformVisual().base.grid),
    );
    const d = DOORS.find((x) => x.secret)!;
    expect(gridBytes(secretDoorModels(secretSkinFor(d)).cover.grid)).toBe(
      gridBytes(secretDoorModels(secretSkinFor(d)).cover.grid),
    );
  });
});

describe("leaf motion", () => {
  it("closed leaves meet in the centre and cover the opening", () => {
    expect(leafSpan("left", 0)).toEqual([-2.5, 0]);
    expect(leafSpan("right", 0)).toEqual([0, 2.5]);
  });

  it("open leaves sit entirely outside the opening", () => {
    expect(leafSpan("left", 1)[1]).toBeLessThanOrEqual(-2.5);
    expect(leafSpan("right", 1)[0]).toBeGreaterThanOrEqual(2.5);
    for (let o = -2; o <= 2; o++) {
      expect(doorCellCovered(o, 0)).toBe(true);
      expect(doorCellCovered(o, 1)).toBe(false);
    }
  });

  it("the middle three cells clear at the passable threshold", () => {
    for (const o of [-1, 0, 1]) expect(doorCellCovered(o, DOOR_PASSABLE_AT)).toBe(false);
    expect(doorCellCovered(2, DOOR_PASSABLE_AT)).toBe(true);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });
});

describe("DoorSystem", () => {
  const door = DOORS.find((d) => d.id === "d_mcp")!;
  const far: [number, number, number] = [door.x + 30, 1, door.z + 30];
  const near: [number, number, number] = [door.x + 3, 1, door.z];

  it("auto-opens an unlocked door near the player and keeps collision honest", () => {
    const moves: [string, boolean][] = [];
    const sys = new DoorSystem({ onMove: (id, o) => moves.push([id, o]) });
    const g = new THREE.Group();
    sys.addDoor(door, g, mesher);
    sys.setState(door.id, true, "normal");
    const cells = doorCells(door);
    const mid = cells[2]!;
    expect(sys.solidAt(mid.x, 2, mid.z)).toBe(true);
    expect(sys.isPassable(door.id)).toBe(false);
    sys.update(0.1, far);
    expect(sys.isPassable(door.id)).toBe(false);
    for (let i = 0; i < 10; i++) sys.update(0.1, near);
    expect(sys.isPassable(door.id)).toBe(true);
    for (const c of cells) expect(sys.solidAt(c.x, 2, c.z)).toBe(false);
    expect(sys.solidAt(mid.x, DOOR_HEIGHT + 1, mid.z)).toBe(false);
    for (let i = 0; i < 10; i++) sys.update(0.1, far);
    expect(sys.isPassable(door.id)).toBe(false);
    expect(moves).toEqual([
      [door.id, true],
      [door.id, false],
    ]);
  });

  it("keeps locked doors shut and never closes on the player", () => {
    const sys = new DoorSystem();
    sys.addDoor(door, new THREE.Group(), mesher);
    sys.setState(door.id, false, "locked");
    for (let i = 0; i < 10; i++) sys.update(0.1, near);
    expect(sys.isPassable(door.id)).toBe(false);
    expect(sys.lockedAt(door.x, door.z)).toBe(true);
    sys.setState(door.id, true, "locked");
    const inside: [number, number, number] = [door.x + 0.5, 1, door.z + 0.5];
    for (let i = 0; i < 10; i++) sys.update(0.1, inside);
    expect(sys.isPassable(door.id)).toBe(true);
    for (let i = 0; i < 10; i++) sys.update(0.1, inside);
    expect(sys.isPassable(door.id)).toBe(true);
  });

  it("snap jumps straight to the resting state", () => {
    const sys = new DoorSystem();
    sys.addDoor(door, new THREE.Group(), mesher);
    sys.setState(door.id, true, "normal");
    sys.snap(near);
    expect(sys.openAmount(door.id)).toBe(1);
  });

  it("secret doors are disguised until unlocked", () => {
    const d = DOORS.find((x) => x.secret)!;
    const sys = new DoorSystem();
    const g = new THREE.Group();
    sys.addDoor(d, g, mesher);
    sys.setState(d.id, false, "secret");
    const root = g.children[0]!;
    const frame = root.children[0]!;
    expect(frame.visible).toBe(false);
    sys.setState(d.id, true, "secret");
    expect(frame.visible).toBe(true);
  });
});

describe("elevator", () => {
  it("runs gate close → depart → midpoint → arrive → gate open, in order", () => {
    const events: ElevatorEvent[] = [];
    let midSeen = -1;
    const sys = new ElevatorSystem(mesher);
    for (const e of ELEVATORS) sys.addFloor(e.floor, new THREE.Group(), e);
    const ok = sys.ride(0, 1, () => (midSeen = events.length), {
      onEvent: (e) => events.push(e),
    });
    expect(ok).toBe(true);
    expect(sys.ride(0, 2, () => undefined)).toBe(false); // busy
    const offsets: number[] = [];
    for (let i = 0; i < 200 && sys.riding; i++) {
      sys.update(1 / 60);
      offsets.push(sys.offset);
    }
    expect(sys.riding).toBe(false);
    expect(events).toEqual([
      "gate-close",
      "depart",
      "fade-out",
      "midpoint",
      "arrive",
      "gate-open",
      "done",
    ]);
    expect(midSeen).toBe(3); // onMidpoint runs before the "midpoint" event is reported
    // Going down: the platform sinks on the old floor, comes from above on the new one.
    expect(Math.min(...offsets)).toBeLessThan(-3);
    expect(Math.max(...offsets)).toBeGreaterThan(3);
  });

  it("pose timeline is monotonic and deterministic", () => {
    const dir = rideDirection(0, 1);
    expect(dir).toBe(-1);
    expect(rideDirection(1, 0)).toBe(1);
    expect(rideDirection(0, 4)).toBe(1); // +1 is above 0
    const times = elevatorEventTimes().map((e) => e.t);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    const T = elevatorDuration();
    expect(elevatorPose(0, dir).gate).toBe(0);
    expect(elevatorPose(T * 0.3, dir).gate).toBe(1);
    expect(elevatorPose(T, dir)).toEqual({ stage: "done", gate: 0, offset: 0, arrived: true });
    expect(elevatorPose(1.1, dir)).toEqual(elevatorPose(1.1, dir));
    // Gate bars: closed spread across the side, open bunched at the +z end.
    const closed = Array.from({ length: GATE_BARS }, (_, i) => gateBarZ(i, 1));
    const open = Array.from({ length: GATE_BARS }, (_, i) => gateBarZ(i, 0));
    expect(closed[0]!).toBeLessThan(-3);
    expect(closed[GATE_BARS - 1]!).toBeGreaterThan(3);
    expect(Math.min(...open)).toBeGreaterThan(2);
  });

  it("supports the slab under the platform", () => {
    const sys = new ElevatorSystem(mesher);
    const e = ELEVATORS[0]!;
    sys.addFloor(e.floor, new THREE.Group(), e);
    expect(sys.solidAt(e.floor, e.x + 3, 0, e.z - 3)).toBe(true);
    expect(sys.solidAt(e.floor, e.x + 4, 0, e.z)).toBe(false);
    expect(sys.solidAt(e.floor, e.x, 1, e.z)).toBe(false);
  });
});

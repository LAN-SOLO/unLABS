import { describe, expect, it, vi } from "vitest";
import {
  DECOR_CLEARANCE,
  AUTHORED_ROOMS,
  decorFootprints,
  decorLights,
  decorPoint,
  interiorFor,
  interiorReport,
  placementRect,
  type DecorPlacement,
} from "@/lib/world/content/interior";
import {
  DOORS,
  FLOORS,
  FLOOR_SIZE,
  ROOMS,
  ROOM_BY_ID,
  WALL_HEIGHT,
  floorGeomOf,
} from "@/lib/world/content/map";
import {
  DOOR_HEIGHT,
  ELEVATOR_AREA,
  buildFloor,
  doorCells,
  interactableZones,
  type Zone,
} from "@/lib/world/layout";
import { DECOR, DECOR_BY_ID, decorModel, decorScale, decorVisual } from "@/lib/world/models/decor";
import { C } from "@/lib/world/content/palette";

interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

const EPS = 1e-6;

function gap(a: Rect, b: Rect): number {
  const dx = Math.max(b.x0 - a.x1, a.x0 - b.x1, 0);
  const dz = Math.max(b.z0 - a.z1, a.z0 - b.z1, 0);
  return Math.max(dx, dz);
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS;
}

function doorKeepout(q: Zone): Rect {
  const horizontal = q.x1 - q.x0 > q.z1 - q.z0;
  const a = DECOR_CLEARANCE.doorAlong;
  const i = DECOR_CLEARANCE.doorInto;
  return horizontal
    ? { x0: q.x - a, x1: q.x + a + 1, z0: q.z - i, z1: q.z + i + 1 }
    : { x0: q.x - i, x1: q.x + i + 1, z0: q.z - a, z1: q.z + a + 1 };
}

const floors = FLOORS.map((f) => f.id);

describe("decor library", () => {
  it("has at least 70 uniquely named pieces", () => {
    expect(DECOR.length).toBeGreaterThanOrEqual(70);
    expect(new Set(DECOR.map((d) => d.id)).size).toBe(DECOR.length);
  });

  it("every model builds, is non-empty and fits the floor height", () => {
    for (const d of DECOR) {
      const m = decorModel(d.id);
      let n = 0;
      m.grid.forEach(() => n++);
      expect(n, d.id).toBeGreaterThan(0);
      expect(((d.elevation ?? 0) + m.h * decorScale(d.id)) | 0, d.id).toBeLessThan(FLOOR_SIZE.y);
    }
  });

  it("wall-mounted pieces are shallow and non-solid", () => {
    for (const d of DECOR.filter((x) => x.wall)) {
      // At most one world voxel deep (2 voxels at 0.5, 4 at 0.25).
      expect(decorModel(d.id).d * decorScale(d.id), d.id).toBeLessThanOrEqual(1);
      expect(d.solid, d.id).toBe(false);
    }
  });

  it("light positions lie inside their models", () => {
    for (const d of DECOR) {
      if (!d.light) continue;
      const m = decorModel(d.id);
      const [x, y, z] = d.light.pos;
      expect(x >= -1 && x <= m.w && y >= -1 && y <= m.h && z >= -1 && z <= m.d, d.id).toBe(true);
    }
  });
});

const DARK = new Set<number>([C.crt_bg, C.black]);

describe("decor detail, screens and parts", () => {
  it("adds a detailed (0.25) library with plenty of small clutter", () => {
    const fine = DECOR.filter((d) => d.scale === 0.25);
    expect(fine.length).toBeGreaterThanOrEqual(60);
    const small = DECOR.filter((d) => d.small);
    expect(small.length).toBeGreaterThanOrEqual(20);
    for (const d of small) expect(d.solid, d.id).toBe(false);
  });

  it("host tops are real flat surfaces of their models", () => {
    for (const d of DECOR.filter((x) => x.top !== undefined)) {
      const m = decorModel(d.id);
      let cols = 0;
      const tops = new Map<number, number>();
      m.grid.forEach((x, y, z) => {
        const i = x + z * m.w;
        tops.set(i, Math.max(tops.get(i) ?? 0, y + 1));
      });
      for (const h of tops.values()) if (h === d.top) cols++;
      expect(cols, d.id).toBeGreaterThanOrEqual(6);
    }
  });

  it("screen centres lie on a dark recessed face", () => {
    let n = 0;
    for (const d of DECOR) {
      const m = decorModel(d.id);
      for (const s of d.screens ?? []) {
        n++;
        const [cx, cy, cz] = s.center;
        expect(s.w, d.id).toBeGreaterThan(0);
        expect(s.h, d.id).toBeGreaterThan(0);
        const fx = Math.floor(cx);
        const fy = Math.floor(cy);
        const fz = Math.floor(cz);
        // Normal +z: glass voxel just behind the face, empty voxel in front of it.
        const [back, front] =
          s.normal === "+z"
            ? [m.grid.get(fx, fy, cz - 1), cz < m.d ? m.grid.get(fx, fy, cz) : 0]
            : s.normal === "+y"
              ? [m.grid.get(fx, cy - 1, fz), cy < m.h ? m.grid.get(fx, cy, fz) : 0]
              : [1, 1];
        expect(Number.isInteger(s.normal === "+y" ? cy : cz), `${d.id} face plane`).toBe(true);
        expect(DARK.has(back), `${d.id} screen glass`).toBe(true);
        expect(front, `${d.id} screen recess`).toBe(0);
      }
    }
    expect(n).toBeGreaterThanOrEqual(12);
  });

  it("animated parts are non-empty, uniquely named and rig as visuals", () => {
    let n = 0;
    for (const d of DECOR) {
      if (!d.parts?.length) continue;
      const names = d.parts.map((p) => p.name);
      expect(new Set(names).size, d.id).toBe(names.length);
      for (const p of d.parts) {
        let v = 0;
        p.model.grid.forEach(() => v++);
        expect(v, `${d.id}.${p.name}`).toBeGreaterThan(0);
        n++;
      }
      const vis = decorVisual(d.id)!;
      expect(vis.scale).toBe(decorScale(d.id));
      expect(vis.base).toBe(decorModel(d.id));
    }
    expect(n).toBeGreaterThanOrEqual(20);
  });
});

describe("interior placements", () => {
  for (const floor of floors) {
    describe(`floor ${floor}`, () => {
      const placements = interiorFor(floor);
      const zones = interactableZones(floor);

      it("reference existing decor and rooms, inside the room", () => {
        expect(placements.length).toBeGreaterThan(0);
        for (const p of placements) {
          expect(DECOR_BY_ID.has(p.decor), p.decor).toBe(true);
          const room = ROOM_BY_ID.get(p.room);
          expect(room, p.room).toBeDefined();
          expect(room!.floor).toBe(floor);
          const r = placementRect(p);
          expect(r.x0 >= room!.x + 1 - 0.05 && r.x1 <= room!.x + room!.w + 0.05, p.id).toBe(true);
          expect(r.z0 >= room!.z + 1 - 0.05 && r.z1 <= room!.z + room!.d + 0.05, p.id).toBe(true);
        }
        expect(new Set(placements.map((p) => p.id)).size).toBe(placements.length);
      });

      it("keep clear of interactables, doors and the elevator", () => {
        const elevator: Rect = {
          x0: ELEVATOR_AREA.x0,
          z0: ELEVATOR_AREA.z0,
          x1: ELEVATOR_AREA.x1 + 1,
          z1: ELEVATOR_AREA.z1 + 1,
        };
        for (const p of placements) {
          const def = DECOR_BY_ID.get(p.decor)!;
          const r = placementRect(p);
          expect(intersects(r, elevator), `${p.id} in elevator area`).toBe(false);
          for (const q of zones) {
            if (q.kind === "elevator") continue;
            if (q.kind === "door") {
              expect(intersects(r, doorKeepout(q)), `${p.id} ${p.decor} at door ${q.id}`).toBe(
                false,
              );
              continue;
            }
            const need = def.solid ? 3 : 0;
            if (need > 0)
              expect(gap(r, q), `${p.id} ${p.decor} too close to ${q.id}`).toBeGreaterThanOrEqual(
                need - EPS,
              );
            else expect(intersects(r, q), `${p.id} ${p.decor} over ${q.id}`).toBe(false);
          }
        }
      });

      it("solid pieces do not overlap each other", () => {
        const solids = placements.filter((p) => DECOR_BY_ID.get(p.decor)!.solid);
        for (let i = 0; i < solids.length; i++)
          for (let j = i + 1; j < solids.length; j++)
            expect(
              intersects(placementRect(solids[i]!), placementRect(solids[j]!)),
              `${solids[i]!.id} × ${solids[j]!.id}`,
            ).toBe(false);
      });

      it("stays within the per-floor instancing budget", () => {
        // 90 + the operations infrastructure (camera, service dock, vines, algae spill; docs/OPS.md).
        expect(new Set(placements.map((p) => p.decor)).size).toBeLessThanOrEqual(94);
      });

      it("desk-top clutter stands on its host", () => {
        const byId = new Map(placements.map((p) => [p.id, p]));
        for (const p of placements.filter((q) => q.host)) {
          const def = DECOR_BY_ID.get(p.decor)!;
          expect(def.solid, p.id).toBe(false);
          const host = byId.get(p.host!);
          expect(host, p.id).toBeDefined();
          const hdef = DECOR_BY_ID.get(host!.decor)!;
          expect(hdef.top, host!.decor).toBeDefined();
          const lift = (host!.y ?? hdef.elevation ?? 0) + hdef.top! * decorScale(host!.decor);
          expect(Math.abs((p.y ?? 0) - lift), p.id).toBeLessThan(1e-9);
          const a = placementRect(p);
          const b = placementRect(host!);
          expect(a.x0 >= b.x0 - EPS && a.x1 <= b.x1 + EPS, p.id).toBe(true);
          expect(a.z0 >= b.z0 - EPS && a.z1 <= b.z1 + EPS, p.id).toBe(true);
        }
      });

      it("footprints and lights are consistent", () => {
        const solids = placements.filter((p) => DECOR_BY_ID.get(p.decor)!.solid);
        const fps = decorFootprints(floor);
        expect(fps.length).toBe(solids.length);
        for (const f of fps) {
          expect(f.x1).toBeGreaterThan(f.x0);
          expect(f.z1).toBeGreaterThan(f.z0);
          expect(f.h).toBeGreaterThan(0);
        }
        const lights = decorLights(floor);
        expect(lights.length).toBeLessThanOrEqual(12);
        for (const l of lights) {
          expect(l.x >= 0 && l.x <= FLOOR_SIZE.x && l.z >= 0 && l.z <= FLOOR_SIZE.z).toBe(true);
          expect(l.y).toBeGreaterThan(0);
        }
      });
    });
  }

  it("every room except elevators gets dressed", () => {
    const byRoom = new Set(floors.flatMap((f) => interiorFor(f).map((p) => p.room)));
    for (const r of ROOMS) if (r.theme !== "elevator") expect(byRoom.has(r.id), r.id).toBe(true);
  });

  it("hand-authored dressing mostly survives validation", () => {
    let authored = 0;
    let placed = 0;
    for (const f of floors) {
      const rep = interiorReport(f);
      authored += rep.authored;
      placed += rep.authoredPlaced;
    }
    expect(AUTHORED_ROOMS.length).toBeGreaterThanOrEqual(25);
    expect(placed / Math.max(1, authored)).toBeGreaterThan(0.7);
  });

  it("is deterministic", async () => {
    const before = JSON.stringify(floors.map((f) => interiorFor(f)));
    vi.resetModules();
    const fresh = await import("@/lib/world/content/interior");
    expect(JSON.stringify(floors.map((f) => fresh.interiorFor(f)))).toBe(before);
  });

  it("maps model points like three.js rotation.y", () => {
    const m = decorModel("exit_sign");
    const base: DecorPlacement = {
      id: "t",
      decor: "exit_sign",
      floor: 0,
      room: "x",
      x: 10,
      z: 10,
      rot: 0,
      y: 0,
    };
    // Front centre of the model (+z) ends up at +x for rot 1, −z for rot 2, −x for rot 3.
    const front: [number, number, number] = [(m.w - 1) / 2, 0, m.d + 2];
    const [x0, , z0] = decorPoint(base, front);
    expect(z0).toBeGreaterThan(10.5);
    const [x1, , z1] = decorPoint({ ...base, rot: 1 }, front);
    expect(x1).toBeGreaterThan(10.5);
    expect(Math.abs(z1 - 10.5)).toBeLessThan(1e-9);
    const [x2, , z2] = decorPoint({ ...base, rot: 2 }, front);
    expect(z2).toBeLessThan(10.5);
    expect(Math.abs(x2 - x0)).toBeLessThan(1e-9);
    const [x3] = decorPoint({ ...base, rot: 3 }, front);
    expect(x3).toBeLessThan(10.5);
  });
});

describe("layout architecture", () => {
  for (const floor of floors) {
    it(`floor ${floor}: room interiors are free from y = 1 to the head (except wall lines)`, () => {
      const { world } = buildFloor(floor);
      // Interior cells of the real room shapes (floor-geom.ts); walls and poché excluded.
      const g = floorGeomOf(floor);
      const elevatorPillar = (x: number, z: number) =>
        x >= ELEVATOR_AREA.x0 &&
        x <= ELEVATOR_AREA.x1 &&
        z >= ELEVATOR_AREA.z0 &&
        z <= ELEVATOR_AREA.z1;
      for (const rg of g.rooms)
        for (const i of rg.cells) {
          const x = i % g.W;
          const z = (i - x) / g.W;
          if (elevatorPillar(x, z)) continue;
          expect(world.get(x, 0, z), `floor ${x},${z}`).not.toBe(0);
          for (let y = 1; y <= WALL_HEIGHT - 2; y++)
            expect(world.get(x, y, z), `${rg.room.id} ${x},${y},${z}`).toBe(0);
        }
    });

    it(`floor ${floor}: door openings are clear`, () => {
      const { world } = buildFloor(floor);
      for (const d of DOORS.filter((q) => q.floor === floor))
        for (const c of doorCells(d))
          for (let y = 1; y <= DOOR_HEIGHT; y++) expect(world.get(c.x, y, c.z), d.id).toBe(0);
    });
  }
});

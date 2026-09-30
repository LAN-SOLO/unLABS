/**
 * Stand spots, active sides, seats — where Jade stands to use an object.
 *
 * Pure geometry (spots outside the footprint at reach, facing the object,
 * for every rotation; side choice by click; fallback to the nearest
 * reachable side) plus the real content: every seat and bed on every floor
 * has an approach spot on free, reachable floor, with its anchor on the
 * seat / mattress; no stand spot ever lies inside an object's collision.
 */
import { describe, expect, it } from "vitest";
import { FINE, FloorCollision, WALKER } from "@/lib/world/actor";
import { DEVICES } from "@/lib/world/content/devices";
import { interiorFor } from "@/lib/world/content/interior";
import { ELEVATORS, FLOORS, FLOOR_SIZE, PROPS, ROOMS } from "@/lib/world/content/map";
import { ROOM_TERMINALS } from "@/lib/world/content/terminals";
import { hasDecorAction } from "@/lib/world/decor-actions";
import { buildFloor } from "@/lib/world/layout";
import {
  decorStand,
  deviceStand,
  fillCollision,
  floorOccupants,
  propStand,
  terminalStand,
} from "@/lib/world/occupancy";
import { NAV_HEADROOM, boxFree, createNavGrid, findPath, type NavGrid } from "@/lib/world/pathfind";
import { elevatorHoleCells } from "@/lib/world/render/doors";
import {
  SEATS,
  STAND_GAP,
  boxFootprint,
  candidateSpots,
  clickedSide,
  pickSpot,
  seatSpots,
  settleSpot,
  sideNormal,
  spotForSide,
  toLocal,
  type SideDir,
  type StandSpot,
  type StandTarget,
} from "@/lib/world/stand-spots";
import type { FloorId } from "@/lib/world/types";
import { SIT_SEAT_HEIGHT, sitFit } from "@/lib/world/models/rig";

const ALL: SideDir[] = ["+z", "+x", "-z", "-x"];

/** An 8 × 4 (world units) console at (20.5, 20.5). */
function console(rot: number, sides: SideDir[] = ["+z"]): StandTarget {
  return {
    fp: boxFootprint(16, 8, 0.5, 20.5, 20.5, rot),
    sides: sides.map((dir) => ({ dir, slide: false })),
  };
}

/** Distance from (x, z) to the footprint rectangle (0 inside). */
function outside(t: StandTarget, x: number, z: number): number {
  const [lx, lz] = toLocal(t.fp, x, z);
  const dx = Math.max(t.fp.x0 - lx, 0, lx - t.fp.x1);
  const dz = Math.max(t.fp.z0 - lz, 0, lz - t.fp.z1);
  return Math.hypot(dx, dz);
}

/** Heading points from the spot toward the object's centre (within the side's normal). */
function facesObject(t: StandTarget, s: StandSpot): boolean {
  const fx = Math.sin(s.facing);
  const fz = Math.cos(s.facing);
  // Facing = −normal exactly for sided spots.
  return Math.abs(fx + s.nx) < 1e-6 && Math.abs(fz + s.nz) < 1e-6 && outside(t, s.x, s.z) > 0;
}

describe("stand spots — geometry", () => {
  it("side spots sit just outside the footprint at STAND_GAP and face it, for every rotation", () => {
    for (let rot = 0; rot < 4; rot++) {
      const t = console(rot, ALL);
      for (const dir of ALL) {
        const s = spotForSide(t, dir, false);
        expect(outside(t, s.x, s.z), `rot ${rot} ${dir}`).toBeCloseTo(STAND_GAP, 6);
        expect(facesObject(t, s), `rot ${rot} ${dir}`).toBe(true);
        // The outward normal is the side's world normal.
        const [nx, nz] = sideNormal(t.fp, dir);
        expect(s.nx).toBeCloseTo(nx, 9);
        expect(s.nz).toBeCloseTo(nz, 9);
      }
    }
  });

  it("the model front (+z) turns with the rotation like three.js rotation.y", () => {
    const n = (rot: number) => sideNormal(console(rot).fp, "+z").map((v) => Math.round(v));
    expect(n(0)).toEqual([0, 1]);
    expect(n(1)).toEqual([1, 0]);
    expect(n(2)).toEqual([0, -1]);
    expect(n(3)).toEqual([-1, 0]);
  });

  it("the clicked side comes from the face normal, else from where the top was hit", () => {
    const t = console(1, ALL); // front faces world +x
    expect(clickedSide(t.fp, { x: 30, z: 20.5, nx: 1, ny: 0, nz: 0 })).toBe("+z");
    expect(clickedSide(t.fp, { x: 0, z: 20.5, nx: 0, ny: 0, nz: -1 })).toBe("+x");
    // Top face (normal up): near the world −x edge → local back (−z).
    expect(clickedSide(t.fp, { x: 19, z: 20.5, nx: 0, ny: 1, nz: 0 })).toBe("-z");
    // Dead centre of the top: undecided.
    expect(clickedSide(t.fp, { x: 20.5, z: 20.5, nx: 0, ny: 1, nz: 0 })).toBeNull();
  });

  it("the clicked side's spot comes first; an inactive clicked side falls to the closest active side", () => {
    const table = console(0, ALL);
    const hitBack = { x: 20.5, z: 18.7, nx: 0, ny: 1, nz: 0 };
    const c = candidateSpots(table, [20.5, 40], hitBack);
    expect(c[0]!.side).toBe("-z");
    expect(c[0]!.tier).toBe(0);
    // A console is used from its front only: clicking its left end → front.
    const con = console(0, ["+z"]);
    const c2 = candidateSpots(con, [0, 20], { x: 16.6, z: 20.5, nx: -1, ny: 0, nz: 0 });
    expect(c2[0]!.side).toBe("+z");
    // Keyboard (no hit): the side nearest the player.
    const c3 = candidateSpots(table, [40, 20.5]);
    expect(c3[0]!.side).toBe("+x");
  });

  it("long sides slide toward the click and stay inside the span", () => {
    const t: StandTarget = { ...console(0), sides: [{ dir: "+z", slide: true }] };
    const s = spotForSide(t, "+z", true, [23, 30]);
    expect(s.x).toBeCloseTo(23, 6);
    const far = spotForSide(t, "+z", true, [99, 30]);
    expect(far.x).toBeLessThanOrEqual(20.5 + 4 - WALKER.radius + 1e-6);
    expect(far.x).toBeGreaterThan(20.5 + 2);
  });

  it("pickSpot: the clicked side (and its shifted alternatives) first, else the shortest path", () => {
    const t = console(0, ALL);
    const cands = candidateSpots(t, [20.5, 40], { x: 20.5, z: 22.5, nx: 0, ny: 0, nz: 1 });
    const front = cands.filter((c) => c.side === "+z");
    expect(front.length).toBeGreaterThan(1);
    expect(front.every((c) => c.tier === 0)).toBe(true);
    // Centre of the front blocked (a chair) → the next spot along the front, not another side.
    const blockedCentre = (s: StandSpot) =>
      Math.abs(s.x - 20.5) < 0.1 && s.side === "+z" ? null : 5;
    const p1 = pickSpot(cands, blockedCentre)!;
    expect(p1.spot.side).toBe("+z");
    expect(Math.abs(p1.spot.x - 20.5)).toBeGreaterThan(0.1);
    // Whole front blocked → the reachable side with the shortest path.
    const len = (s: StandSpot) => (s.side === "+z" ? null : s.side === "-x" ? 7 : 12);
    expect(pickSpot(cands, len)!.spot.side).toBe("-x");
    // Nothing reachable → null (the engine falls back to "as close as possible").
    expect(pickSpot(cands, () => null)).toBeNull();
  });

  it("settleSpot pushes a blocked spot outward along its normal, or gives up", () => {
    const t = console(0);
    const s = spotForSide(t, "+z", false);
    const moved = settleSpot(s, (_x, z) => z > s.z + 0.25)!;
    expect(moved.z).toBeGreaterThan(s.z + 0.25);
    expect(moved.x).toBeCloseTo(s.x, 9);
    expect(settleSpot(s, () => false)).toBeNull();
  });

  it("radial targets offer every direction, the one toward the player first", () => {
    const t: StandTarget = { fp: boxFootprint(1, 1, 1, 10.5, 10.5, 0), sides: [], radial: 1.4 };
    const c = candidateSpots(t, [10.5, 2], { x: 10.5, z: 10.5 });
    expect(c.length).toBe(8);
    expect(c[0]!.z).toBeLessThan(10.5);
    for (const s of c) expect(Math.hypot(s.x - 10.5, s.z - 10.5)).toBeCloseTo(1.4, 6);
  });

  it("seat anchors: sofa places along the cushions, beds put the hips on the mattress", () => {
    const sofa: StandTarget = {
      fp: boxFootprint(28, 14, 0.25, 50.5, 50.5, 0),
      sides: [],
      seat: { def: SEATS.sofa!, scale: 0.25, w: 28, d: 14, elevation: 0 },
    };
    const spots = seatSpots(sofa);
    expect(spots.length).toBe(3);
    for (const s of spots) {
      const a = s.seat!;
      expect(a.kind).toBe("sit");
      expect(a.y).toBeCloseTo(1, 6); // cushion top: 4 voxels × 0.25 (knee height)
      expect(a.yaw).toBeCloseTo(0, 6); // looks out of the front (+z)
      expect(outside(sofa, a.x, a.z)).toBe(0); // on the sofa
      expect(s.z).toBeGreaterThan(sofa.fp.cz + sofa.fp.z1); // stands in front
    }
    const bed: StandTarget = {
      fp: boxFootprint(14, 7, 0.5, 30.5, 30.5, 1),
      sides: [],
      seat: { def: SEATS.jade_bed!, scale: 0.5, w: 14, d: 7, elevation: 0 },
    };
    const b = seatSpots(bed);
    expect(b.length).toBe(2); // both long sides
    const a = b[0]!.seat!;
    expect(a.kind).toBe("lie");
    expect(outside(bed, a.x, a.z)).toBe(0);
    // Head (local −z of the rig, i.e. −(sin yaw, cos yaw)) points at the bed's −x end (world +z for rot 1).
    const head = [-Math.sin(a.yaw), -Math.cos(a.yaw)];
    const [hx, hz] = [head[0]!, head[1]!];
    const tip = [a.x + hx * 3.3, a.z + hz * 3.3];
    expect(outside(bed, tip[0]!, tip[1]!)).toBeLessThan(0.6); // head stays on the bed
    expect(hz).toBeCloseTo(1, 6);
  });
});

// ── Real content ─────────────────────────────────────────────────

interface FloorNav {
  nav: NavGrid;
  col: FloorCollision;
  spawn: [number, number];
}

const NAVS = new Map<FloorId, FloorNav>();

/** The engine's collision + nav (all devices built), minus the elevator cage. */
function floorNav(floor: FloorId): FloorNav {
  let f = NAVS.get(floor);
  if (f) return f;
  const layout = buildFloor(floor);
  const shaft = ELEVATORS.find((e) => e.floor === floor)!;
  for (const c of elevatorHoleCells(shaft)) layout.world.set(c.x, 0, c.z, 0);
  const col = new FloorCollision(layout.world, FLOOR_SIZE.x, FLOOR_SIZE.z);
  fillCollision(col, floorOccupants(floor), () => true);
  const w = layout.world;
  const coarse = new Uint8Array(FLOOR_SIZE.x * FLOOR_SIZE.z);
  for (let z = 0; z < FLOOR_SIZE.z; z++)
    for (let x = 0; x < FLOOR_SIZE.x; x++) {
      let b = !w.get(x, 0, z);
      for (let y = 1; !b && y <= NAV_HEADROOM; y++) if (w.get(x, y, z)) b = true;
      if (b) coarse[x + z * FLOOR_SIZE.x] = 1;
    }
  const nav = createNavGrid(
    FLOOR_SIZE.x * FINE,
    FLOOR_SIZE.z * FINE,
    (fx, fz) =>
      coarse[Math.floor(fx / FINE) + Math.floor(fz / FINE) * FLOOR_SIZE.x] === 1 ||
      col.fineHeight(fx, fz) > 0,
    { half: WALKER.navRadius, scale: FINE, res: 1 },
  );
  f = { nav, col, spawn: [shaft.x - 6 + 0.5, shaft.z + 0.5] };
  NAVS.set(floor, f);
  return f;
}

/** Engine rule: settle the spot, then a path from the elevator ending on it. */
function reachable(f: FloorNav, s: StandSpot): boolean {
  const settled = settleSpot(s, (x, z) => boxFree(f.nav, x, z, WALKER.radius));
  if (!settled) return false;
  const r = findPath(f.nav, f.spawn, [settled.x, settled.z], {
    accept: (x, z) => Math.hypot(x - settled.x, z - settled.z) <= 1.5,
  });
  return r.reached;
}

interface Seat {
  label: string;
  floor: FloorId;
  t: StandTarget;
}

function allSeats(): Seat[] {
  const out: Seat[] = [];
  for (const f of FLOORS) {
    for (const p of interiorFor(f.id)) {
      if (!hasDecorAction(p.decor, p.room) || p.host) continue;
      const t = decorStand(p);
      if (t.seat) out.push({ label: `${p.id} (${p.decor})`, floor: f.id, t });
    }
  }
  for (const p of PROPS) {
    const t = propStand(p);
    if (t.seat) out.push({ label: `prop ${p.id}`, floor: p.floor, t });
  }
  return out;
}

describe("stand spots — real content", () => {
  const seats = allSeats();

  it("finds the lab's seats and beds (sofa, armchair, chairs, stools, benches, beds)", () => {
    const kinds = new Set(seats.map((s) => s.t.seat!.def.kind));
    expect(kinds).toEqual(new Set(["sit", "lie"]));
    expect(seats.some((s) => s.label === "prop jades_bett")).toBe(true);
    expect(seats.length).toBeGreaterThanOrEqual(10);
  });

  it("every seat / bed has an approach spot on free floor reachable from the elevator", () => {
    const bad: string[] = [];
    for (const s of seats) {
      const f = floorNav(s.floor);
      const spots = seatSpots(s.t);
      if (!spots.some((sp) => reachable(f, sp))) bad.push(s.label);
    }
    expect(bad).toEqual([]);
  });

  it("she sits with her feet on the floor or a footrest — only the canteen-table perch hangs", () => {
    for (const s of seats) {
      if (s.t.seat!.def.kind !== "sit") continue;
      const a = seatSpots(s.t)[0]!.seat!;
      const fit = sitFit({ height: a.y, footrest: a.footrest, sink: a.sink });
      const perch = s.label.includes("canteen_table");
      expect(fit.planted, s.label).toBe(!perch);
      // Knee-high seats: the root never sinks below the floor.
      expect(fit.lift, s.label).toBeGreaterThan(0);
    }
    // A plain chair at the rig's own seat height: level thighs, feet under the knees, no lift.
    const plain = sitFit({ height: SIT_SEAT_HEIGHT });
    expect(plain.lift).toBeCloseTo(0, 9);
    expect(plain.foot[0]).toBeCloseTo(0, 6);
    expect(plain.foot[1]).toBeCloseTo(0, 6);
  });

  it("seat anchors lie on the seat, at its surface height, never in the walker's way", () => {
    for (const s of seats) {
      for (const sp of seatSpots(s.t)) {
        const a = sp.seat!;
        expect(outside(s.t, a.x, a.z), s.label).toBe(0);
        expect(a.y, s.label).toBeGreaterThan(0.9);
        expect(a.y, s.label).toBeLessThan(3.5);
        // The approach spot is outside the object and faces it.
        expect(outside(s.t, sp.x, sp.z), s.label).toBeGreaterThan(WALKER.radius);
      }
    }
  });

  it("no stand spot of any object lies inside collision (after settling); most are reachable", () => {
    let total = 0;
    let ok = 0;
    const none: string[] = [];
    for (const fl of FLOORS) {
      const f = floorNav(fl.id);
      const targets: [string, StandTarget][] = [];
      const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
      for (const d of DEVICES)
        if (roomFloor.get(d.room) === fl.id) targets.push([d.id, deviceStand(d)]);
      for (const t of ROOM_TERMINALS) if (t.floor === fl.id) targets.push([t.id, terminalStand(t)]);
      for (const p of PROPS)
        if (p.floor === fl.id && p.model !== "elevator" && p.kind !== "decor")
          targets.push([p.id, propStand(p)]);
      for (const [label, t] of targets) {
        total++;
        const cands = candidateSpots(t, f.spawn);
        let any = false;
        for (const c of cands) {
          const s = settleSpot(c, (x, z) => boxFree(f.nav, x, z, WALKER.radius));
          if (!s) continue;
          // Free for the collision box: no object or wall cell under it.
          expect(boxFree(f.nav, s.x, s.z, WALKER.radius), label).toBe(true);
          if (!any && reachable(f, s)) any = true;
        }
        if (any) ok++;
        else none.push(label);
      }
    }
    // Devices, kiosks and interactive props all have a usable side.
    expect(none).toEqual([]);
    expect(ok).toBe(total);
  });
});

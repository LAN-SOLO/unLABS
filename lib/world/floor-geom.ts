/**
 * Floor geometry from room shapes (pure — callers pass rooms and doors).
 *
 * - `owner`: room index + 1 for every interior cell (0 = none).
 * - Door throats: a door may sit in a curved or recessed wall; the cells
 *   between the door line and each room's interior are added to that room,
 *   door-wide, so every opening leads straight in (short passages).
 * - Walls: every non-interior cell touching an interior cell (8-neighbour).
 *   Each wall cell knows its room, its inward normal and a position `p`
 *   along the wall (for panelling rhythms).
 * - `edge`: Chebyshev distance of an interior cell to its room's walls
 *   (1 = right beside the wall) — replaces the old rectangle maths.
 * - Poché: solid mass around the building (cells near walls that belong to
 *   no room) so the plan reads as carved, thick-walled architecture.
 */
import { shapeContains, type RoomShape } from "@/lib/world/room-shape";
import type { DoorDef, RoomDef } from "@/lib/world/types";

export interface WallCell {
  x: number;
  z: number;
  /** Inward normal (toward the room interior), components in −1 … 1. */
  nx: number;
  nz: number;
  /** Position along the wall (for seams / pillars / lamps). */
  p: number;
}

export interface RoomGeom {
  room: RoomDef;
  index: number;
  walls: WallCell[];
  /** Interior cell count. */
  area: number;
  /** Interior cells (x + z · W). */
  cells: number[];
}

export interface FloorGeom {
  W: number;
  Z: number;
  /** Room index + 1 per interior cell. */
  owner: Int16Array;
  /** Room index + 1 per wall cell (the room whose wall it is). */
  wallOwner: Int16Array;
  /** Interior distance to the own room's wall (0 outside). */
  edge: Uint8Array;
  /** 1 = poché mass (solid filler around the building). */
  mass: Uint8Array;
  rooms: RoomGeom[];
  byId: Map<string, RoomGeom>;
  /** Wall cell (x + z · W) → its record. */
  wallAt: Map<number, WallCell>;
}

/** The shape of a room: its own `shape`, else its wall rectangle. */
export function roomShape(r: RoomDef): RoomShape {
  return r.shape ?? [{ kind: "rect", x: r.x, z: r.z, w: r.w, d: r.d }];
}

/** Longest door passage cut through solid mass (cells). */
export const MAX_THROAT = 14;
/** Poché thickness around the building (cells). */
const MASS_REACH = 5;

export function buildFloorGeom(
  rooms: readonly RoomDef[],
  doors: readonly DoorDef[],
  W: number,
  Z: number,
): FloorGeom {
  const owner = new Int16Array(W * Z);
  const inB = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < Z;

  // 1. Shape interiors (first room wins an overlap — the content tests forbid overlaps).
  rooms.forEach((r, i) => {
    const shape = roomShape(r);
    for (let z = Math.max(0, r.z); z <= Math.min(Z - 1, r.z + r.d); z++)
      for (let x = Math.max(0, r.x); x <= Math.min(W - 1, r.x + r.w); x++)
        if (!owner[x + z * W] && shapeContains(shape, x, z)) owner[x + z * W] = i + 1;
  });

  // 2. Door lines and their frame posts are always wall (a curved room may reach
  //    past the door line), then the throats: straight passages into each side's room.
  const doorLine = new Set<number>();
  for (const d of doors) {
    const reach = Math.floor(d.width / 2) + 1;
    for (let o = -reach; o <= reach; o++) {
      const x = d.axis === "x" ? d.x + o : d.x;
      const z = d.axis === "x" ? d.z : d.z + o;
      if (inB(x, z)) {
        owner[x + z * W] = 0;
        doorLine.add(x + z * W);
      }
    }
  }
  for (const d of doors) {
    const half = Math.floor(d.width / 2);
    const span: [number, number][] = [];
    for (let o = -half; o <= half; o++) span.push(d.axis === "x" ? [d.x + o, d.z] : [d.x, d.z + o]);
    for (const [x, z] of span) doorLine.add(x + z * W);
    for (const s of [-1, 1] as const) {
      const nx = d.axis === "x" ? 0 : s;
      const nz = d.axis === "x" ? s : 0;
      let found = 0;
      let k = 1;
      for (; k <= MAX_THROAT; k++) {
        const cx = d.x + nx * k;
        const cz = d.z + nz * k;
        if (!inB(cx, cz)) break;
        const o = owner[cx + cz * W]!;
        if (o) {
          found = o;
          break;
        }
      }
      if (!found) continue;
      // Rows 1 … k − 1 become the passage; rows k … k + 4 fill gaps of a curved wall.
      for (let j = 1; j <= k + 4; j++) {
        let full = true;
        for (const [x0, z0] of span) {
          const x = x0 + nx * j;
          const z = z0 + nz * j;
          if (!inB(x, z)) continue;
          const o = owner[x + z * W]!;
          if (o === found) continue;
          full = false;
          if (!o && !doorLine.has(x + z * W)) owner[x + z * W] = found;
        }
        if (j >= k && full) break;
      }
    }
  }

  // 3. Walls: non-interior cells touching an interior (8-neighbourhood).
  const wallOwner = new Int16Array(W * Z);
  const geoms: RoomGeom[] = rooms.map((room, index) => ({
    room,
    index,
    walls: [],
    area: 0,
    cells: [],
  }));
  for (let z = 0; z < Z; z++)
    for (let x = 0; x < W; x++) {
      const i = x + z * W;
      const o = owner[i]!;
      if (o) {
        geoms[o - 1]!.area++;
        geoms[o - 1]!.cells.push(i);
        continue;
      }
      // Room with the most interior neighbours owns the wall (ties: straight neighbours first).
      let best = 0;
      let bestScore = 0;
      const score = new Map<number, number>();
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const xx = x + dx;
          const zz = z + dz;
          if (!inB(xx, zz)) continue;
          const n = owner[xx + zz * W]!;
          if (!n) continue;
          const sc = (score.get(n) ?? 0) + (dx && dz ? 1 : 3);
          score.set(n, sc);
          if (sc > bestScore) {
            bestScore = sc;
            best = n;
          }
        }
      if (!best) continue;
      wallOwner[i] = best;
      let nx = 0;
      let nz = 0;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const xx = x + dx;
        const zz = z + dz;
        if (inB(xx, zz) && owner[xx + zz * W] === best) {
          nx += dx;
          nz += dz;
        }
      }
      if (!nx && !nz)
        for (const [dx, dz] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ] as const) {
          const xx = x + dx;
          const zz = z + dz;
          if (inB(xx, zz) && owner[xx + zz * W] === best) {
            nx += dx;
            nz += dz;
          }
        }
      const r = rooms[best - 1]!;
      const p = Math.abs(nx) > Math.abs(nz) ? z - r.z : x - r.x;
      geoms[best - 1]!.walls.push({ x, z, nx: Math.sign(nx), nz: Math.sign(nz), p });
    }

  // 4. Edge distance (multi-source BFS from each room's walls, Chebyshev steps).
  const edge = new Uint8Array(W * Z);
  const queue: number[] = [];
  for (let i = 0; i < W * Z; i++) {
    if (!owner[i]) continue;
    const x = i % W;
    const z = (i - x) / W;
    let touching = false;
    for (let dz = -1; dz <= 1 && !touching; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const zz = z + dz;
        if (!inB(xx, zz) || owner[xx + zz * W] !== owner[i]) {
          touching = true;
          break;
        }
      }
    if (touching) {
      edge[i] = 1;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % W;
    const z = (i - x) / W;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const zz = z + dz;
        if (!inB(xx, zz)) continue;
        const j = xx + zz * W;
        if (owner[j] !== owner[i] || edge[j]) continue;
        edge[j] = Math.min(255, edge[i]! + 1);
        queue.push(j);
      }
  }

  // 5. Poché mass: empty cells within MASS_REACH of a wall.
  const mass = new Uint8Array(W * Z);
  const dist = new Uint8Array(W * Z).fill(255);
  const mq: number[] = [];
  for (let i = 0; i < W * Z; i++)
    if (wallOwner[i]) {
      dist[i] = 0;
      mq.push(i);
    }
  for (let q = 0; q < mq.length; q++) {
    const i = mq[q]!;
    const x = i % W;
    const z = (i - x) / W;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const xx = x + dx;
      const zz = z + dz;
      if (!inB(xx, zz)) continue;
      const j = xx + zz * W;
      if (owner[j] || wallOwner[j] || dist[j] !== 255) continue;
      dist[j] = dist[i]! + 1;
      if (dist[j]! <= MASS_REACH) {
        mass[j] = 1;
        mq.push(j);
      }
    }
  }

  const byId = new Map(geoms.map((g) => [g.room.id, g]));
  const wallAt = new Map<number, WallCell>();
  for (const rg of geoms) for (const w of rg.walls) wallAt.set(w.x + w.z * W, w);
  return { W, Z, owner, wallOwner, edge, mass, rooms: geoms, byId, wallAt };
}

/** Room id at a cell: interior first, then the wall's room. */
export function geomRoomAt(g: FloorGeom, x: number, z: number): RoomDef | undefined {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= g.W || cz >= g.Z) return undefined;
  const i = cx + cz * g.W;
  const o = g.owner[i] || g.wallOwner[i];
  return o ? g.rooms[o - 1]!.room : undefined;
}

/**
 * SVG outline of a room (its interior plus its own wall ring), traced along
 * cell edges and simplified to corners — for the map screens.
 */
export function roomOutline(g: FloorGeom, id: string): string {
  const rg = g.byId.get(id);
  if (!rg) return "";
  const o = rg.index + 1;
  const W = g.W;
  const inCell = (x: number, z: number) =>
    x >= 0 &&
    z >= 0 &&
    x < W &&
    z < g.Z &&
    (g.owner[x + z * W] === o || g.wallOwner[x + z * W] === o);
  // Directed boundary edges (inside on the left), keyed by start point.
  const next = new Map<string, [number, number][]>();
  const add = (x0: number, z0: number, x1: number, z1: number) => {
    const k = `${x0},${z0}`;
    const list = next.get(k);
    if (list) list.push([x1, z1]);
    else next.set(k, [[x1, z1]]);
  };
  const cells = [...rg.cells, ...rg.walls.map((w) => w.x + w.z * W)];
  for (const i of cells) {
    const x = i % W;
    const z = (i - x) / W;
    if (!inCell(x, z - 1)) add(x + 1, z, x, z);
    if (!inCell(x, z + 1)) add(x, z + 1, x + 1, z + 1);
    if (!inCell(x - 1, z)) add(x, z, x, z + 1);
    if (!inCell(x + 1, z)) add(x + 1, z + 1, x + 1, z);
  }
  let d = "";
  while (next.size) {
    const [startKey, firstList] = next.entries().next().value as [string, [number, number][]];
    const [sx, sz] = startKey.split(",").map(Number) as [number, number];
    const pts: [number, number][] = [[sx, sz]];
    let cur = firstList.shift()!;
    if (!firstList.length) next.delete(startKey);
    let guard = 0;
    while (guard++ < 100000) {
      pts.push(cur);
      const k = `${cur[0]},${cur[1]}`;
      if (k === startKey) break;
      const list = next.get(k);
      if (!list?.length) break;
      const nxt = list.shift()!;
      if (!list.length) next.delete(k);
      cur = nxt;
    }
    // Drop collinear points.
    const simple: [number, number][] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const a = simple[simple.length - 1];
      const n = pts[i + 1];
      if (a && n && (a[0] - p[0]) * (n[1] - p[1]) === (a[1] - p[1]) * (n[0] - p[0])) continue;
      simple.push(p);
    }
    d += `M${simple.map(([x, z]) => `${x},${z}`).join("L")}Z`;
  }
  return d;
}

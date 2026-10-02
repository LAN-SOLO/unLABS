/**
 * Collision occupancy & stand targets of a floor's objects (pure, no three).
 * ==========================================================================
 *
 * The engine and the tests share this:
 *
 *  - **Occupants**: per placed object (device, prop, solid decor, room
 *    terminal) the fine collision cells its model columns cover
 *    (`columnMask` → `maskCells`), clipped to the old bounding-box footprint
 *    rectangle so the lab never gets tighter than the walkability test and
 *    the interior validator assume. Devices only collide once built.
 *  - **Stand targets**: where Jade stands to use an object (active sides,
 *    seats / beds), see `stand-spots.ts`.
 *
 * Masks are cached per model; everything is deterministic.
 */
import { FINE, FloorCollision, WALKER } from "@/lib/world/actor";
import { DEVICES } from "@/lib/world/content/devices";
import { DECOR_ACTIONS, PROP_VARIANT_DECOR } from "@/lib/world/content/decor-actions";
import {
  decorElevation,
  interiorFor,
  placementRect,
  type DecorPlacement,
} from "@/lib/world/content/interior";
import { PROPS, ROOMS } from "@/lib/world/content/map";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_SCALE,
  ROOM_TERMINAL_SIZE,
  roomTerminalModel,
  type RoomTerminalDef,
} from "@/lib/world/content/terminals";
import { MODEL_SCALE, type Model } from "@/lib/world/models/core";
import { DECOR_BY_ID, decorModel, decorScale } from "@/lib/world/models/decor";
import { deviceVisual } from "@/lib/world/models/devices";
import { propModel } from "@/lib/world/models/props";
import {
  SEATS,
  STAND_GAP,
  boxFootprint,
  columnMask,
  decorSides,
  deviceSides,
  footprintOf,
  maskCells,
  propSides,
  type ClipRect,
  type ColumnMask,
  type MaskPart,
  type StandTarget,
} from "@/lib/world/stand-spots";
import type { DoorDef, FloorId, PropDef } from "@/lib/world/types";

/** Collision occupancy of one placed object. */
export interface Occupant {
  /** Device id when it only collides once built (stage > 0). */
  device?: string;
  /** Fine collision cells (FINE per world unit). */
  cells: [number, number][];
  /** Solid height (world units). */
  h: number;
}

// ── Models & masks ───────────────────────────────────────────────

/** Model of a map prop (a prop variant with a decor model uses that model, at MODEL_SCALE). */
export function propGrid(p: Pick<PropDef, "model" | "variant">): Model {
  const decor = p.variant ? PROP_VARIANT_DECOR[p.variant] : undefined;
  return decor && DECOR_BY_ID.has(decor) ? decorModel(decor) : propModel(p.model);
}

const MASKS = new Map<string, ColumnMask>();
function cached(key: string, build: () => ColumnMask): ColumnMask {
  let m = MASKS.get(key);
  if (!m) {
    m = build();
    MASKS.set(key, m);
  }
  return m;
}

/** Solid columns of a device's built model incl. its animated parts at rest. */
export function deviceMask(id: string): ColumnMask {
  return cached(`device:${id}`, () => {
    const visual = deviceVisual(id);
    const byName = new Map<string, readonly [number, number, number]>();
    const parts: MaskPart[] = [];
    for (const part of visual.parts) {
      const parent = part.parent ? byName.get(part.parent) : undefined;
      const o: readonly [number, number, number] = parent
        ? [parent[0] + part.offset[0], parent[1] + part.offset[1], parent[2] + part.offset[2]]
        : [part.offset[0], part.offset[1], part.offset[2]];
      byName.set(part.name, o);
      parts.push({ grid: part.model.grid, offset: o });
    }
    return columnMask(visual.base.grid, visual.scale ?? MODEL_SCALE, { parts });
  });
}

export function propMask(p: Pick<PropDef, "model" | "variant">): ColumnMask {
  return cached(`prop:${p.model}:${p.variant ?? ""}`, () =>
    columnMask(propGrid(p).grid, MODEL_SCALE),
  );
}

/** Decor columns: solid pieces up to head height, others (wall pieces, clutter) whole. */
export function decorMask(p: DecorPlacement): ColumnMask {
  const def = DECOR_BY_ID.get(p.decor);
  const elev = decorElevation(p);
  const solid = !!def?.solid;
  return cached(`decor:${p.decor}:${solid ? elev : "full"}`, () => {
    const parts: MaskPart[] = (def?.parts ?? [])
      .filter((pt) => !pt.parent)
      .map((pt) => ({ grid: pt.model.grid, offset: pt.offset }));
    return columnMask(decorModel(p.decor).grid, decorScale(p.decor), {
      elevation: solid ? elev : 0,
      headroom: solid ? WALKER.height : Infinity,
      parts,
      cleanup: solid,
    });
  });
}

export function terminalMask(): ColumnMask {
  return cached("terminal", () => columnMask(roomTerminalModel().grid, ROOM_TERMINAL_SCALE));
}

// ── Stand targets ────────────────────────────────────────────────

/** Verb of the decor action of a piece in a room (room-specific first). */
function decorVerb(decor: string, room: string): string | undefined {
  let any: string | undefined;
  for (const a of DECOR_ACTIONS) {
    if (a.decor !== decor) continue;
    if (a.room === room) return a.verb;
    if (a.room === undefined && any === undefined) any = a.verb;
  }
  return any;
}

export function deviceStand(d: (typeof DEVICES)[number]): StandTarget {
  const visual = deviceVisual(d.id);
  const sc = visual.scale ?? MODEL_SCALE;
  return {
    fp: footprintOf(deviceMask(d.id), d.x + 0.5, d.z + 0.5, d.rot ?? 0),
    sides: deviceSides(visual.screens ?? [], visual.base.w * sc, visual.base.d * sc),
  };
}

/** Active sides / seat of a map prop (variants use their decor's table). */
export function propStand(p: PropDef): StandTarget {
  const m = propGrid(p);
  const fp = footprintOf(propMask(p), p.x + 0.5, p.z + 0.5, p.rot ?? 0);
  const w = m.w * MODEL_SCALE;
  const d = m.d * MODEL_SCALE;
  const variant = p.variant ? PROP_VARIANT_DECOR[p.variant] : undefined;
  const decor = variant && DECOR_BY_ID.has(variant) ? variant : undefined;
  const sides = decor
    ? decorSides({ id: decor, solid: true, wall: false, w, d })
    : propSides(p.model, w, d);
  const t: StandTarget = { fp, sides };
  const seat = decor ? SEATS[decor] : undefined;
  if (seat) t.seat = { def: seat, scale: MODEL_SCALE, w: m.w, d: m.d, elevation: 0 };
  return t;
}

/** Active sides / seat of a decor placement; desk-top clutter uses its host's sides. */
export function decorStand(p: DecorPlacement): StandTarget {
  const host = p.host ? interiorFor(p.floor).find((q) => q.id === p.host) : undefined;
  const base = host ?? p;
  const def = DECOR_BY_ID.get(base.decor);
  const m = decorModel(base.decor);
  const s = decorScale(base.decor);
  const fp = footprintOf(decorMask(base), base.x + 0.5, base.z + 0.5, base.rot);
  const t: StandTarget = {
    fp,
    sides: decorSides({
      id: base.decor,
      solid: !!def?.solid,
      wall: !!def?.wall,
      w: m.w * s,
      d: m.d * s,
    }),
  };
  if (host) t.alignTo = [p.x + 0.5, p.z + 0.5];
  else if (!t.sides.length)
    t.radial = Math.max(1.3, Math.max(fp.x1 - fp.x0, fp.z1 - fp.z0) / 2 + WALKER.radius + 0.25);
  const seat = SEATS[base.decor];
  const verb = decorVerb(base.decor, base.room);
  if (seat && !host && (verb === "sitzen" || verb === "liegen"))
    t.seat = { def: seat, scale: s, w: m.w, d: m.d, elevation: decorElevation(base) };
  return t;
}

export function terminalStand(t: RoomTerminalDef): StandTarget {
  return {
    fp: footprintOf(terminalMask(), t.x + 0.5, t.z + 0.5, t.rot ?? 0),
    sides: [{ dir: "+z", slide: false }],
  };
}

/** Pickups and notes: small things on the floor, used from any side (crouch reach). */
export function looseStand(x: number, z: number, radial: number): StandTarget {
  return { fp: boxFootprint(1, 1, 1, x + 0.5, z + 0.5, 0), sides: [], radial };
}

/** Doors: both faces of the wall; she uses the one on her side. */
export function doorStand(d: DoorDef): StandTarget {
  const alongX = d.axis === "x";
  return {
    fp: boxFootprint(alongX ? d.width : 1, alongX ? 1 : d.width, 1, d.x + 0.5, d.z + 0.5, 0),
    sides: alongX
      ? [
          { dir: "+z", slide: false },
          { dir: "-z", slide: false },
        ]
      : [
          { dir: "+x", slide: false },
          { dir: "-x", slide: false },
        ],
    gap: STAND_GAP + 0.4,
  };
}

/** Stand spots in front of a door's lock interface (both wall faces), docs/DOORS.md. */
export function doorPanelStand(d: DoorDef, at: { x: number; z: number }): StandTarget {
  const alongX = d.axis === "x";
  return {
    fp: boxFootprint(alongX ? 1 : 1, 1, 1, at.x, at.z, 0),
    sides: alongX
      ? [
          { dir: "+z", slide: false },
          { dir: "-z", slide: false },
        ]
      : [
          { dir: "+x", slide: false },
          { dir: "-x", slide: false },
        ],
    gap: STAND_GAP + 0.4,
  };
}

// ── Occupants ────────────────────────────────────────────────────

/** The old footprint rectangle rasterised to whole voxels (clip for the fine cells). */
function clipOf(x0: number, z0: number, x1: number, z1: number): ClipRect {
  return [Math.floor(x0), Math.floor(z0), Math.ceil(x1), Math.ceil(z1)];
}

/** Collision occupants of every object on a floor (devices flagged, see `Occupant.device`). */
export function floorOccupants(floor: FloorId): Occupant[] {
  const out: Occupant[] = [];
  const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
  for (const d of DEVICES) {
    if (roomFloor.get(d.room) !== floor) continue;
    const visual = deviceVisual(d.id);
    const model = visual.base;
    const sc = visual.scale ?? MODEL_SCALE;
    const [fw, fd] = visual.footprint ?? [model.w, model.d];
    const hw = (fw * sc) / 2;
    const hd = (fd * sc) / 2;
    const cx = d.x + 0.5;
    const cz = d.z + 0.5;
    out.push({
      device: d.id,
      cells: maskCells(
        deviceMask(d.id),
        cx,
        cz,
        d.rot ?? 0,
        clipOf(cx - hw + 0.3, cz - hd + 0.3, cx + hw - 0.3, cz + hd - 0.3),
      ),
      h: Math.max(1.5, (visual.height ?? model.h) * sc),
    });
  }
  for (const p of PROPS) {
    if (p.floor !== floor || p.model === "elevator") continue;
    const m = propGrid(p);
    const rot = (p.rot ?? 0) % 2 === 1;
    const hw = ((rot ? m.d : m.w) * MODEL_SCALE) / 2;
    const hd = ((rot ? m.w : m.d) * MODEL_SCALE) / 2;
    out.push({
      cells: maskCells(
        propMask(p),
        p.x + 0.5,
        p.z + 0.5,
        p.rot ?? 0,
        clipOf(p.x + 0.8 - hw, p.z + 0.8 - hd, p.x + 0.2 + hw, p.z + 0.2 + hd),
      ),
      h: Math.max(1.5, m.h * MODEL_SCALE),
    });
  }
  for (const p of interiorFor(floor)) {
    const def = DECOR_BY_ID.get(p.decor);
    if (!def?.solid) continue;
    const mask = decorMask(p);
    if (!mask.count) continue;
    const r = placementRect(p);
    out.push({
      cells: maskCells(
        mask,
        p.x + 0.5,
        p.z + 0.5,
        p.rot,
        clipOf(r.x0 + 0.3, r.z0 + 0.3, r.x1 - 0.3, r.z1 - 0.3),
      ),
      h: Math.max(1.5, decorElevation(p) + decorModel(p.decor).h * decorScale(p.decor)),
    });
  }
  for (const t of ROOM_TERMINALS) {
    if (t.floor !== floor) continue;
    const odd = (t.rot ?? 0) % 2 === 1;
    const hw = ((odd ? ROOM_TERMINAL_SIZE.d : ROOM_TERMINAL_SIZE.w) * ROOM_TERMINAL_SCALE) / 2;
    const hd = ((odd ? ROOM_TERMINAL_SIZE.w : ROOM_TERMINAL_SIZE.d) * ROOM_TERMINAL_SCALE) / 2;
    out.push({
      cells: maskCells(
        terminalMask(),
        t.x + 0.5,
        t.z + 0.5,
        t.rot ?? 0,
        clipOf(t.x + 0.8 - hw, t.z + 0.8 - hd, t.x + 0.2 + hw, t.z + 0.2 + hd),
      ),
      h: Math.max(1.5, ROOM_TERMINAL_SIZE.h * ROOM_TERMINAL_SCALE),
    });
  }
  return out;
}

/** Write occupants into a floor collision (devices only when `built(id)`). */
export function fillCollision(
  col: FloorCollision,
  occupants: readonly Occupant[],
  built: (device: string) => boolean,
): void {
  col.clearFootprints();
  for (const o of occupants) {
    if (o.device && !built(o.device)) continue;
    for (const [fx, fz] of o.cells) col.markFine(fx, fz, o.h);
  }
}

/** Fine cells per world unit (re-exported for callers building nav grids). */
export { FINE };

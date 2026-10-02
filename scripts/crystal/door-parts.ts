/**
 * Every door as the engine assembles it (lib/world/render/doors.ts
 * `addDoor` / `applyLook`, engine `stepAirlocks` fixtures): frame, leaf
 * pieces per light, mechanism parts, beacon, lock interface, airlock
 * hardware — each with its door-local position, so the crystal export
 * (scripts/crystal/export.ts) and the era renders (scripts/crystal/doors.ts)
 * see exactly the grids and placements of the game.
 *
 * Positions are door-local world units (the engine's door root: x along the
 * wall, y up from the floor, z through the wall). Every mesh is centred in
 * x/z (y from 0) and scaled by DOOR_SCALE, like the engine's door mesher.
 */
import type { VoxelGrid } from "@/lib/voxel/grid";
import { DOORS } from "@/lib/world/content/map";
import { AIRLOCKS, type AirlockDef } from "@/lib/world/doors/airlock";
import { doorStyle, type DoorStyle } from "@/lib/world/doors/style";
import { airlockFixtures } from "@/lib/world/models/airlock";
import {
  BEACON_ROW,
  DOOR_VPU,
  doorBeaconModel,
  doorFrameModel,
  doorLight,
  secretDoorModels,
  secretSkinFor,
  type DoorLight,
  type DoorVariant,
} from "@/lib/world/models/doors";
import {
  IFACE_AT,
  doorPieces,
  lockPanelModel,
  mechParts,
  styledFrameModel,
  type PanelState,
} from "@/lib/world/models/door-styles";
import { leafCenterX } from "@/lib/world/render/doors";
import type { DoorDef } from "@/lib/world/types";

export const DOOR_LIGHTS: readonly DoorLight[] = ["green", "amber", "red"];
export const PANEL_STATES: readonly PanelState[] = [
  "auto",
  "hold",
  "sealed",
  "locked",
  "keypad",
  "cycle",
];

export interface DoorPart {
  /** Crystal use id (manifest `uses`). */
  use: string;
  grid: VoxelGrid;
  /** Door-local position of the centred mesh (world units). */
  at: [number, number, number];
  /** Rotation about y (airlock fixtures only). */
  rotY: number;
}

export function doorVariant(d: DoorDef): DoorVariant {
  return d.secret ? "secret" : d.keypad ? "keypad" : d.lock ? "locked" : "normal";
}

/** Light a door shows closed in its default state (normal doors green, locked red, keypad amber). */
export function restingLight(d: DoorDef): DoorLight {
  const v = doorVariant(d);
  return doorLight(v, v === "normal");
}

function restingPanel(d: DoorDef): PanelState {
  if (d.airlock) return "cycle";
  const v = doorVariant(d);
  return v === "keypad" ? "keypad" : v === "locked" ? "locked" : "auto";
}

export function frameUse(d: DoorDef): string {
  return d.secret ? "door-frame-secret" : `door-style-${d.id}/frame`;
}
export function pieceUse(d: DoorDef, light: DoorLight, role: string): string {
  return `door-style-${d.id}-${light}/${role}`;
}
export function mechUse(d: DoorDef, i: number): string {
  return `door-style-${d.id}/mech${i}`;
}

/**
 * The closed, locked door in its default light (what Jade walks up to).
 * `light` overrides the leaf/beacon light; secret doors are shown revealed
 * (frame + their flush leaves).
 */
export function doorAssembly(d: DoorDef, light: DoorLight = restingLight(d)): DoorPart[] {
  const style = doorStyle(d.id);
  const out: DoorPart[] = [];
  const frame = d.secret ? doorFrameModel({ secret: true }) : styledFrameModel(style);
  out.push({ use: frameUse(d), grid: frame.grid, at: [0, 0, 0], rotY: 0 });
  out.push({
    use: `door-beacon-${light}`,
    grid: doorBeaconModel(light).grid,
    at: [0, BEACON_ROW / DOOR_VPU, 0],
    rotY: 0,
  });
  if (d.secret) {
    const m = secretDoorModels(secretSkinFor(d));
    out.push({
      use: `door-secret-${d.id}/left`,
      grid: m.left.grid,
      at: [leafCenterX("left", 0), 0, 0],
      rotY: 0,
    });
    out.push({
      use: `door-secret-${d.id}/right`,
      grid: m.right.grid,
      at: [leafCenterX("right", 0), 0, 0],
      rotY: 0,
    });
  } else {
    for (const p of doorPieces(style, light))
      out.push({ use: pieceUse(d, light, p.role), grid: p.model.grid, at: p.at, rotY: 0 });
    mechParts(style).forEach((m, i) =>
      out.push({ use: mechUse(d, i), grid: m.model.grid, at: m.at, rotY: 0 }),
    );
  }
  const st = restingPanel(d);
  out.push({
    use: `door-iface-${st}`,
    grid: lockPanelModel(st).grid,
    at: [IFACE_AT[0], IFACE_AT[1], 0],
    rotY: 0,
  });
  return out;
}

/** Airlock hardware in the outer door's frame of reference (chamber behind it). */
export function airlockAssembly(a: AirlockDef): { parts: DoorPart[]; doors: DoorDef[] } {
  const outer = DOORS.find((d) => d.id === a.outer)!;
  const inner = DOORS.find((d) => d.id === a.inner)!;
  const axis = outer.axis;
  // World → outer-door-local: translate to the door root, undo its wall
  // rotation (the engine turns z-axis doors by −π/2 about y; three.js
  // convention x' = x·cos + z·sin, z' = −x·sin + z·cos).
  const ox = outer.x + 0.5;
  const oz = outer.z + 0.5;
  const rot = axis === "z" ? Math.PI / 2 : 0;
  const local = (x: number, y: number, z: number): [number, number, number] => {
    const dx = x - ox;
    const dz = z - oz;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return [dx * c + dz * s, y - 1, -dx * s + dz * c];
  };
  const parts: DoorPart[] = airlockFixtures(a, axis).map((f, i) => ({
    use: `airlock-${a.id}/${f.key}${i}`,
    grid: f.model.grid,
    at: local(f.at[0], f.at[1], f.at[2]),
    rotY: f.rotY + rot,
  }));
  // The inner door, placed where it stands relative to the outer one.
  const ip = local(inner.x + 0.5, 1, inner.z + 0.5);
  for (const p of doorAssembly(inner))
    parts.push({
      ...p,
      at: [p.at[0] + ip[0], p.at[1] + ip[1], p.at[2] + ip[2]],
      rotY: (inner.axis === axis ? 0 : Math.PI / 2) + p.rotY,
    });
  return { parts, doors: [outer, inner] };
}

/** Every grid the styled doors can show (all lights, all panel states, airlocks). */
export function allDoorGrids(): { use: string; grid: VoxelGrid }[] {
  const out: { use: string; grid: VoxelGrid }[] = [];
  for (const d of DOORS) {
    if (d.secret) continue;
    const style: DoorStyle = doorStyle(d.id);
    out.push({ use: frameUse(d), grid: styledFrameModel(style).grid });
    for (const l of DOOR_LIGHTS)
      for (const p of doorPieces(style, l))
        out.push({ use: pieceUse(d, l, p.role), grid: p.model.grid });
    mechParts(style).forEach((m, i) => out.push({ use: mechUse(d, i), grid: m.model.grid }));
  }
  for (const st of PANEL_STATES)
    out.push({ use: `door-iface-${st}`, grid: lockPanelModel(st).grid });
  for (const a of AIRLOCKS) {
    const outer = DOORS.find((d) => d.id === a.outer)!;
    airlockFixtures(a, outer.axis).forEach((f, i) =>
      out.push({ use: `airlock-${a.id}/${f.key}${i}`, grid: f.model.grid }),
    );
  }
  return out;
}

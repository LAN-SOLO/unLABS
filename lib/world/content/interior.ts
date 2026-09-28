/**
 * Interior design — set dressing per room (pure, deterministic).
 * ===============================================================
 *
 * `interiorFor(floor)` combines
 *   (a) hand-authored dressing keyed by room id (skipped silently when a
 *       room does not exist) and
 *   (b) a procedural filler driven by `room.theme` for every other room,
 *       plus light clutter in authored rooms.
 *
 * Every candidate passes the same validator: inside its room, clear of the
 * walls/architecture (terrain voxels), ≥ 3 voxels from devices (with a
 * growth margin), props, pickups, notes and NPC homes, clear of door
 * openings (±4 along the wall, ±5 into the room) and the elevator area.
 * Solid pieces are added room by room and rejected if they would cut the
 * walker (3×3 cells) off any interactable reachable before.
 *
 * Desk-top mode: after a room is committed, every surviving host (decor
 * with `top`) gets small non-solid clutter on its flat top — authored via
 * `on: [...]`, else from HOST_CLUTTER/THEME_CLUTTER. Such placements carry
 * `host` (the host's placement id) and `y` = host lift + top · host scale.
 *
 * Coordinates: `x`/`z` follow the prop convention (the model's bottom
 * centre sits at x + 0.5, z + 0.5) but may be fractional so wall pieces
 * sit flush. `y` is the lift above the slab in world voxels. Sizes use the
 * per-decor scale (`decorScale`).
 */
import { DEVICES } from "@/lib/world/content/devices";
import { ELEVATORS, FLOORS, FLOOR_SIZE, PROPS, ROOMS, SPAWN } from "@/lib/world/content/map";
import { buildFloor, ELEVATOR_AREA, interactableZones, type Zone } from "@/lib/world/layout";
import { MODEL_SCALE } from "@/lib/world/models/core";
import { deviceModel, deviceVisual } from "@/lib/world/models/devices";
import {
  DECOR_BY_ID,
  decorHeightmap,
  decorModel,
  decorScale,
  type DecorDef,
} from "@/lib/world/models/decor";
import type { ScreenSpec } from "@/lib/world/models/anim";
import { propModel } from "@/lib/world/models/props";
import { NPCS } from "@/lib/world/content/story";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_SCALE,
  ROOM_TERMINAL_SIZE,
} from "@/lib/world/content/terminals";
import { WALKER } from "@/lib/world/actor";
import { fnv1a } from "@/lib/world/traits";
import type { FloorId, RoomDef, RoomTheme } from "@/lib/world/types";
import type { VoxelWorld } from "@/lib/voxel/world";

export type Rot = 0 | 1 | 2 | 3;

export interface DecorPlacement {
  id: string;
  decor: string;
  floor: FloorId;
  room: string;
  x: number;
  z: number;
  rot: Rot;
  /** Lift above the slab (world voxels); set for wall-mounted pieces and desk-top clutter. */
  y?: number;
  /** Placement id of the host this piece stands on (desk-top clutter; `y` = the host's top). */
  host?: string;
}

export interface DecorFootprint {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
}

export interface DecorLightPlacement {
  id: string;
  decor: string;
  room: string;
  x: number;
  y: number;
  z: number;
  color: string;
  intensity: number;
  distance: number;
  requiresPower: boolean;
}

/** Clearances (world voxels). */
export const DECOR_CLEARANCE = {
  /** Around device footprints (3 + growth margin for bigger future models). */
  device: 4.5,
  /** Around props, pickups, notes. */
  object: 3,
  /** NPC home (plus its wander radius for solid pieces). */
  npc: 3,
  /** Door opening: along the wall / into the room. */
  doorAlong: 4,
  doorInto: 5,
  /** Flat decals and non-solid wall pieces keep this from interactables. */
  soft: 1,
} as const;

/** Walker / reach model shared with the walkability test. */
export const WALK = { headroom: 6, reach: 5 } as const;

// ── Geometry helpers ─────────────────────────────────────────────

interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

function defOf(id: string): DecorDef | undefined {
  return DECOR_BY_ID.get(id);
}

/** Resolved lift of a placement (explicit y, else the decor's default). */
export function decorElevation(p: DecorPlacement): number {
  return p.y ?? defOf(p.decor)?.elevation ?? 0;
}

/** World-space footprint (unshrunk) of a placement. */
export function placementRect(p: Pick<DecorPlacement, "decor" | "x" | "z" | "rot">): Rect {
  const m = decorModel(p.decor);
  const s = decorScale(p.decor);
  const odd = p.rot % 2 === 1;
  const w = (odd ? m.d : m.w) * s;
  const d = (odd ? m.w : m.d) * s;
  return {
    x0: p.x + 0.5 - w / 2,
    z0: p.z + 0.5 - d / 2,
    x1: p.x + 0.5 + w / 2,
    z1: p.z + 0.5 + d / 2,
  };
}

function overlaps(a: Rect, b: Rect, margin = 0): boolean {
  return (
    a.x0 < b.x1 + margin && a.x1 > b.x0 - margin && a.z0 < b.z1 + margin && a.z1 > b.z0 - margin
  );
}

function isDecal(def: DecorDef): boolean {
  return !def.wall && !def.solid && decorModel(def.id).h <= 1;
}

// ── Authoring kit ────────────────────────────────────────────────

type Side = "n" | "s" | "w" | "e";

interface Spec {
  decor: string;
  x: number;
  z: number;
  rot: Rot;
  y?: number;
  /** Wall-snapped specs nudge along their wall, free specs in a small spiral. */
  side?: Side;
  gap?: number;
  /** Small clutter to stand on this piece's top surface (hosts only). */
  on?: string[];
}

const SIDE_ROT: Record<Side, Rot> = { n: 0, w: 1, s: 2, e: 3 };

/** Place `decor` with its back against a wall of `r`, centred on `t` along the wall. */
function wallSpec(r: RoomDef, side: Side, t: number, decor: string, gap = 0, on?: string[]): Spec {
  const depth = decorModel(decor).d * decorScale(decor);
  const rot = SIDE_ROT[side];
  const off = 0.5 + depth / 2 + gap;
  const extra = on ? { on } : {};
  switch (side) {
    case "n":
      return { decor, rot, x: t, z: r.z + off, side, gap, ...extra };
    case "s":
      return { decor, rot, x: t, z: r.z + r.d - off, side, gap, ...extra };
    case "w":
      return { decor, rot, x: r.x + off, z: t, side, gap, ...extra };
    case "e":
      return { decor, rot, x: r.x + r.w - off, z: t, side, gap, ...extra };
  }
}

interface Kit {
  r: RoomDef;
  /** Against a wall (floor pieces and wall-mounted pieces alike); `on` = clutter on its top. */
  w: (side: Side, t: number, decor: string, on?: string[]) => Spec;
  /** Free placement (absolute voxel coords); `on` = clutter on its top. */
  f: (decor: string, x: number, z: number, rot?: Rot, on?: string[]) => Spec;
}

type Authoring = (k: Kit) => Spec[];

/**
 * Hand-authored dressing. Coordinates are absolute voxels on the room's
 * floor; the resolver nudges each piece to the nearest valid spot.
 */
const AUTHORED: Record<string, Authoring> = {
  // ── Ebene 0 ──
  kontroll: ({ w, f }) => [
    w("s", 73, "coffee_machine"), // Jade's coffee maker on the singularity bus
    w("s", 76, "mug_table"),
    w("n", 57, "whiteboard"),
    w("n", 76, "poster_halo"),
    w("n", 73, "exit_sign"),
    w("w", 42, "map_screen"),
    w("w", 58, "crt_stack"),
    w("w", 44, "fire_extinguisher"),
    w("e", 42, "wall_clock"),
    w("e", 62, "cable_loops"),
    w("s", 58, "filing_cabinet"),
    w("s", 60, "poster_unstable"),
    f("rug_round", 58, 52),
    f("floor_cables", 72, 44, 1),
    f("paper_pile", 74, 50),
    w("e", 50, "wall_phone"), // extension list: nobody answers
    w("n", 64, "fuse_box"),
  ],
  sekundaer: ({ w, f }) => [
    w("n", 38, "cork_board"), // pinned notes with red strings
    w("n", 42, "filing_cabinet"),
    w("n", 44, "filing_cabinet"),
    w("e", 40, "crt_stack"),
    w("e", 59, "whiteboard"),
    w("w", 48, "bookshelf"),
    w("w", 47, "poster_halo"),
    w("s", 26, "plant_fern"),
    w("s", 44, "armchair"),
    f("mug_table", 40, 45), // cold coffee
    f("paper_pile", 28, 50),
    f("paper_pile", 37, 55, 1),
    f("rug", 30, 54),
    f("trash_bin", 44, 42),
    w("n", 30, "wall_clock"),
    w("s", 36, "radiator"),
    w("e", 50, "coat_rack"),
  ],
  mcp: ({ w, f }) => [
    w("n", 88, "server_rack_a"),
    w("n", 92, "server_rack_b"),
    w("n", 96, "server_rack_a"),
    w("n", 110, "server_rack_c"),
    w("s", 96, "server_rack_dark"),
    w("s", 100, "server_rack_dark"),
    w("s", 104, "server_rack_c"),
    w("n", 100, "cable_loops"),
    w("e", 46, "gauge_cluster"),
    w("e", 58, "beacon"),
    w("w", 42, "cable_loops"),
    f("floor_cables", 96, 50),
    f("floor_cables", 97, 57),
    f("floor_cables", 104, 60, 1),
    f("hazard_decal", 92, 44),
  ],
  westflur: ({ w, f }) => [
    w("w", 70, "water_cooler"),
    w("w", 94, "bench_long"),
    w("e", 74, "plant_ficus"),
    w("e", 96, "locker_row"),
    w("w", 76, "poster_safety"),
    w("e", 80, "poster_unstable"),
    w("w", 88, "wall_clock"), // somewhere a voice counts days
    w("s", 40, "exit_sign"),
    w("e", 92, "fire_extinguisher"),
    w("s", 30, "trash_bin"),
    f("floor_cables", 34, 76, 1),
    w("w", 82, "vending_machine"), // sold out since 2019
    w("e", 86, "radiator"),
    w("w", 100, "wall_phone"),
    f("wet_floor_sign", 36, 84),
  ],
  werkstatt: ({ w, f }) => [
    w("w", 80, "fridge"), // Damien Fridge's namesake, with a note
    w("n", 56, "tool_wall"),
    w("n", 74, "chalkboard"),
    w("n", 76, "vice_bench"),
    w("e", 94, "gas_cylinders"),
    w("s", 70, "crate_stack"),
    w("e", 80, "poster_unstable"), // "Keep the lab unstable"
    w("w", 94, "fire_extinguisher"),
    f("tool_cart", 70, 86),
    f("oil_stain", 64, 76),
    f("floor_cables", 58, 88),
    f("paper_pile", 76, 88),
    w("s", 50, "barrel"),
    w("s", 60, "fuse_box"),
    w("e", 86, "wall_shelf"),
    f("extension_cord", 66, 80),
    f("bin_bags", 62, 92),
  ],
  archiv: ({ w, f }) => [
    w("n", 90, "archive_shelf"),
    w("n", 104, "archive_shelf"),
    w("e", 86, "archive_shelf"),
    w("w", 76, "card_catalog"),
    w("w", 98, "display_case"),
    w("s", 100, "bookshelf"),
    f("archive_shelf", 90, 90),
    f("desk_lamp", 104, 88),
    f("rug", 96, 94),
    w("e", 100, "wall_clock"),
    f("paper_pile", 92, 82),
    w("s", 90, "wall_sconce"),
    f("cardboard_boxes", 100, 82),
  ],
  schleuse: ({ w, f }) => [
    w("n", 58, "locker_row"),
    w("n", 72, "blast_door_marker"),
    w("w", 26, "bench_long"),
    w("e", 26, "gas_cylinders"),
    w("n", 66, "radiation_sign"),
    w("w", 18, "wall_vent"),
    w("e", 18, "wall_vent"),
    w("s", 58, "exit_sign"),
    w("s", 76, "fire_extinguisher"),
    w("s", 54, "first_aid"),
    f("warning_cones", 58, 26),
    f("hazard_decal", 76, 24),
    w("w", 32, "boots_pair"),
    w("e", 32, "wall_phone"),
  ],

  // ── Ebene −1 ──
  versorgung: ({ w, f }) => [
    w("n", 90, "pipe_straight"),
    w("n", 106, "pipe_straight"),
    w("s", 90, "cable_loops"),
    w("s", 106, "gauge_cluster"),
    w("n", 104, "barrel"),
    w("s", 88, "barrel_rust"),
    f("floor_cables", 94, 62),
  ],
  geo: ({ w, f }) => [
    w("n", 30, "heat_exchanger"),
    w("w", 42, "floor_pipes"),
    w("e", 46, "pipe_riser"),
    w("e", 24, "pipe_valve"),
    w("s", 26, "barrel_rust"),
    w("s", 32, "gauge_cluster"),
    w("n", 22, "pipe_elbow"),
    f("steam_vent", 38, 44),
    f("steam_vent", 20, 44),
    f("steam_vent", 30, 26),
    f("oil_stain", 26, 50),
    w("w", 28, "radiation_sign"),
  ],
  batterie: ({ w, f }) => [
    w("n", 66, "battery_rack"),
    w("w", 32, "battery_rack"),
    w("e", 42, "battery_rack"),
    w("e", 24, "transformer"),
    w("w", 24, "lever_panel"),
    w("n", 52, "gauge_cluster"),
    w("s", 58, "fire_extinguisher"),
    w("s", 76, "radiation_sign"),
    f("oil_stain", 66, 34), // scorch marks
    f("oil_stain", 72, 38),
    f("floor_cables", 64, 30, 1),
  ],
  kuehlung: ({ w, f }) => [
    w("n", 88, "coolant_tank"),
    w("e", 30, "coolant_tank"),
    w("w", 24, "frost_pipes"),
    w("n", 100, "frost_pipes"),
    w("e", 46, "pipe_riser"),
    w("s", 108, "pipe_valve"),
    w("w", 44, "gauge_cluster"),
    f("puddle", 100, 34),
    f("puddle", 90, 32),
  ],
  fertigung: ({ w, f }) => [
    w("w", 60, "crane_rail"),
    w("e", 80, "crane_rail"),
    w("w", 92, "pallet"),
    w("e", 86, "pallet"),
    w("s", 68, "crate_stack"),
    w("e", 72, "tool_cart"),
    w("w", 70, "generator"),
    w("n", 58, "poster_safety"),
    w("n", 76, "fire_extinguisher"),
    f("pallet_empty", 66, 62),
    f("warning_cones", 66, 74),
    f("oil_stain", 74, 70),
    f("hazard_decal", 64, 100),
  ],
  rechen: ({ w, f }) => [
    w("w", 74, "server_rack_dark"),
    w("w", 78, "server_rack_dark"),
    w("e", 70, "server_rack_c"),
    w("e", 94, "server_rack_dark"),
    f("server_rack_dark", 28, 80),
    f("server_rack_dark", 32, 80),
    f("server_rack_b", 24, 80),
    w("s", 22, "crt_stack"),
    w("n", 42, "cable_loops"),
    f("floor_cables", 30, 88),
    f("floor_cables", 26, 72, 1),
  ],
  lager: ({ w, f }) => [
    w("w", 88, "pallet"),
    w("w", 96, "crate_stack"),
    w("e", 94, "gas_cylinders"),
    w("s", 94, "barrel_rust"),
    w("n", 104, "archive_shelf"),
    f("pallet_empty", 100, 82),
    f("barrel", 90, 86),
    w("e", 84, "wall_vent"),
  ],

  // ── Ebene −2 ──
  messgang: ({ w, f }) => [
    w("n", 90, "cork_board"),
    w("n", 106, "whiteboard"),
    w("s", 90, "gauge_cluster"),
    w("s", 106, "filing_cabinet"),
    w("n", 104, "filing_cabinet"),
    f("paper_pile", 104, 64),
  ],
  signal: ({ w, f }) => [
    w("n", 32, "speaker_stack"),
    w("w", 34, "tape_machine"),
    w("w", 30, "tape_machine"),
    w("e", 30, "synth"),
    w("n", 16, "acoustic_panel"),
    w("n", 36, "acoustic_panel"),
    w("e", 40, "speaker_wall"),
    w("w", 40, "speaker_wall"),
    f("oscilloscope_cart", 32, 34),
    f("radio", 40, 30),
    f("floor_cables", 28, 30),
    f("floor_cables", 36, 38, 1),
    f("rug", 26, 36),
  ],
  anomalie: ({ w, f }) => [
    f("crystal_cluster", 76, 36),
    f("crystal_cluster", 58, 30),
    w("n", 70, "radiation_sign"),
    w("e", 36, "beacon"),
    f("field_emitter", 70, 40),
    f("broken_glass", 64, 34),
    f("broken_glass", 74, 44),
    f("warning_cones", 62, 22),
  ],
  diagnose: ({ w, f }) => [
    w("n", 58, "diagnostic_rack"),
    w("n", 80, "diagnostic_rack"),
    w("s", 56, "lab_table"),
    w("s", 78, "sink"),
    w("w", 58, "microscope"),
    w("n", 62, "first_aid"),
    w("s", 62, "whiteboard"),
    f("workstation_pc", 70, 64),
  ],
  hangar: ({ w, f }) => [
    f("drone_pad", 20, 66),
    f("drone_pad", 44, 80),
    f("drone_parked", 20, 66),
    f("rotor_pile", 44, 90),
    w("w", 78, "tool_cart"),
    w("w", 86, "gas_cylinders"),
    w("e", 94, "crate_stack"),
    w("n", 44, "beacon"),
    w("e", 76, "crane_rail"),
    f("hazard_decal", 24, 94), // sealed shaft down
    f("warning_cones", 36, 98),
    f("oil_stain", 38, 70),
  ],
  tresor: ({ w, f }) => [
    w("w", 86, "display_case"),
    w("e", 86, "display_case"),
    w("w", 94, "vault_safe"),
    w("e", 80, "specimen_jars"),
    w("s", 68, "crystal_cluster"),
    w("n", 78, "archive_shelf"),
    f("rug", 68, 92),
  ],
  botdepot: ({ w, f }) => [
    w("e", 84, "bot_dock"),
    w("e", 92, "bot_dock"),
    w("w", 88, "bot_dock"),
    w("s", 96, "battery_rack"),
    w("n", 108, "tool_wall"),
    w("w", 96, "locker_row"),
    f("rotor_pile", 92, 80),
    f("oil_stain", 100, 94),
    f("oil_stain", 90, 92),
  ],

  // ── Ebene −3 ──
  vorraum: ({ w, f }) => [
    w("n", 94, "radiation_sign"), // the warning sign is iced over
    w("s", 106, "locker_row"),
    w("n", 108, "gas_cylinders"),
    w("s", 92, "bench_long"),
    f("puddle", 96, 66),
    f("hazard_decal", 106, 62),
  ],
  forge: ({ w, f }) => [
    // Cables radiating from the walls to the forge.
    f("floor_cables", 49, 62),
    f("floor_cables", 76, 62),
    f("floor_cables", 82, 62),
    f("floor_cables", 66, 46, 1),
    f("floor_cables", 64, 78, 1),
    f("glow_seam", 52, 70),
    f("glow_seam", 76, 54),
    f("reactor_coil", 48, 42),
    f("reactor_coil", 82, 84),
    f("reactor_coil", 46, 84),
    w("n", 56, "plasma_conduit"),
    w("n", 72, "plasma_conduit"),
    w("s", 50, "plasma_conduit"),
    w("s", 80, "plasma_conduit"),
    f("workstation_pc", 76, 72), // the second, empty Synapsis station
    f("swivel_chair", 76, 76),
  ],
  reaktor: ({ w, f }) => [
    w("w", 50, "reactor_coil"),
    w("e", 22, "transformer"),
    w("n", 30, "radiation_sign"),
    w("s", 20, "radiation_sign"),
    w("w", 24, "lever_panel"),
    w("e", 30, "gauge_cluster"),
    w("s", 28, "barrel_toxic"),
    w("e", 40, "pipe_riser"),
    f("hazard_decal", 20, 50),
  ],
  containment: ({ w, f }) => [
    w("w", 24, "containment_pod"),
    w("e", 30, "containment_pod"),
    f("field_emitter", 92, 26),
    f("field_emitter", 108, 38),
    w("n", 96, "radiation_sign"),
    w("e", 42, "beacon"),
    f("specimen_crate", 94, 40),
    f("broken_glass", 104, 24),
  ],
  rechenkern: ({ w, f }) => [
    w("w", 80, "server_rack_a"),
    w("w", 84, "server_rack_b"),
    w("e", 66, "server_rack_a"),
    w("e", 88, "server_rack_c"),
    f("holo_table", 26, 84),
    w("n", 30, "cable_loops"),
    f("floor_cables", 30, 78),
    f("crt_stack", 18, 88),
  ],
  teleport: ({ w, f }) => [
    f("portal_pylon", 92, 80),
    f("portal_pylon", 108, 98),
    w("w", 88, "poster_halo"), // HaloRider prototype, 2017
    w("e", 94, "plasma_conduit"),
    f("glow_seam", 100, 78),
    f("workstation_pc", 94, 88),
  ],
  quanten: ({ w, f }) => [
    w("s", 58, "cryo_tank"),
    w("s", 70, "cryo_tank"),
    w("n", 46, "coolant_tank"),
    w("n", 80, "frost_pipes"),
    w("s", 44, "gas_cylinders"),
    w("n", 56, "whiteboard"),
    f("puddle", 64, 94),
  ],
  kaeltearchiv: ({ w, f }) => [
    // Frost on the shelves; the capsule X9-H4L0 hums somewhere behind them.
    w("n", 48, "archive_shelf"),
    w("n", 56, "archive_shelf"),
    w("n", 74, "archive_shelf"),
    w("n", 82, "archive_shelf"),
    w("w", 22, "coolant_tank"),
    w("e", 20, "cryo_tank"),
    w("s", 48, "frost_pipes"),
    w("s", 80, "frost_pipes"),
    w("n", 65, "frost_pipes"),
    w("w", 30, "gauge_cluster"),
    w("e", 30, "card_catalog", ["dust_jar", "paper_stack"]),
    f("specimen_crate", 50, 28),
    f("water_drip", 76, 28),
    f("puddle", 58, 30),
    f("paper_pile", 70, 26, 1),
  ],

  // ── Ebene 0 (geheim) ──
  kartenraum: ({ w, f }) => [
    // Damien's map room: pins, red strings between floors no plan shows.
    f("swivel_chair", 92, 26, 1),
    w("n", 90, "cork_board"),
    w("n", 104, "cork_board"),
    w("n", 97, "map_screen"),
    w("w", 24, "sticky_wall"),
    w("w", 16, "filing_cabinet", ["paper_stack"]),
    w("e", 16, "bookshelf_damien"),
    w("e", 26, "desk_lamp", ["mug_cold", "book_stack"]),
    w("s", 106, "wall_clock"),
    f("paper_pile", 90, 30),
    f("books_scattered", 106, 30),
    f("floor_cables", 92, 16, 1),
  ],

  // ── Ebene +1 · Quartiere & Observatorium ──
  wohnflur: ({ w, f }) => [
    w("n", 90, "calendar_2019"), // Februar 2019 — nobody turned the page
    w("n", 106, "cork_board"),
    w("n", 87, "vent_fan"),
    w("s", 88, "plant_ficus"),
    w("s", 106, "bench_long"),
    w("s", 104, "wall_clock"),
    w("n", 109, "lab_coat_hook"),
    f("rug", 96, 62),
    f("floor_cables", 104, 66, 1),
    w("s", 96, "coat_rack"),
    w("n", 98, "wall_sconce"),
    w("s", 92, "radiator"),
    f("boots_pair", 100, 64),
  ],
  jadeq: ({ w, f }) => [
    // Neat: a made bed nobody slept in, notebooks sorted by colour.
    w("n", 96, "bookshelf_jade"),
    w("n", 90, "poster_telescope"),
    w("n", 104, "star_chart"),
    w("w", 36, "office_desk", [
      "books_compression",
      "notebook_open",
      "photo_cottbus",
      "pen_cup",
      "mug_cold",
    ]),
    f("swivel_chair", 91, 36, 3),
    f("mug_table", 108, 45, 0, ["mug_cold"]),
    w("w", 46, "filing_cabinet", ["plant_dusty"]),
    w("e", 30, "trophy_shelf"),
    w("n", 109, "plant_fern"),
    w("e", 48, "lab_coat_hook"),
    w("w", 26, "goggles_hook"),
    w("s", 106, "wall_clock"),
    f("rug_round", 96, 36),
    w("e", 40, "wall_shelf"),
    w("w", 30, "wall_sconce"),
    // Her private corner for rest (biorhythm): a reading lamp by the desk; the
    // mug table moved beside the bed as a nightstand.
    f("floor_lamp", 88, 46),
  ],
  damienq: ({ w, f }) => [
    // Chaos with a system: legal pads 1–17, cold coffee, forty fridge magnets.
    w("n", 64, "bookshelf_damien"),
    w("e", 36, "fridge_magnets"),
    w("e", 42, "mug_table", ["mug_cold", "legal_pads", "rubiks_cube"]),
    f("office_desk", 66, 42, 0, [
      "legal_pads",
      "mug_cold",
      "paper_stack",
      "pen_cup",
      "book_stack",
      "sticky_notes",
    ]),
    f("sofa", 76, 44, 2, ["sofa_blanket", "book_stack"]),
    w("w", 46, "sticky_wall"),
    w("n", 76, "cork_board"),
    w("w", 28, "chalkboard"),
    f("books_scattered", 70, 40),
    f("chair_broken", 74, 45),
    f("pizza_box", 65, 43),
    f("vinyl_crate", 77, 34),
    f("rug", 70, 38),
    f("mug_cold", 58, 48),
    f("laundry_pile", 60, 38),
    w("s", 70, "space_heater"),
    w("n", 70, "hanging_plant"),
    w("s", 62, "wall_sconce"),
  ],
  kantine: ({ w, f }) => [
    // The singularity-bus coffee machine; two chairs used, forty not.
    w("e", 80, "singularity_conduit"),
    w("e", 94, "kitchenette", ["coffee_mug", "food_tray", "mug_cold", "thermos"]),
    w("n", 106, "menu_board"),
    w("n", 90, "wall_clock"),
    f("canteen_table", 94, 82, 0, ["food_tray", "coffee_mug"]),
    f("canteen_table", 94, 101, 0, ["chess_board", "mug_cold"]),
    f("stool", 90, 86),
    f("stool", 99, 86),
    // The Neutro-Fridge and the Food Replicator are map props (biorhythm).
    w("s", 110, "trash_bin"),
    w("w", 96, "water_cooler"),
    w("w", 78, "vent_fan"),
    f("pizza_box", 90, 96),
    w("w", 86, "vending_machine"),
    f("mop_bucket", 100, 106),
    f("wet_floor_sign", 98, 92),
  ],
  bibliothek: ({ w, f }) => [
    // Dawkins, Chalmers, Turing, poetry, three cookbooks (all lentils).
    w("w", 64, "bookshelf"),
    w("w", 90, "bookshelf"),
    w("w", 97, "bookshelf_jade"),
    w("e", 74, "bookshelf"),
    w("s", 70, "bookshelf_damien"),
    w("s", 78, "bookshelf"),
    w("n", 62, "bookshelf"),
    w("n", 78, "library_ladder"),
    w("w", 70, "library_ladder"),
    f("armchair", 66, 84),
    f("desk_lamp", 62, 88, 0, ["book_stack", "mug_cold"]),
    f("floor_lamp", 75, 95),
    f("office_desk", 64, 96, 0, ["chess_board", "notebook_open"]),
    f("rug", 70, 76),
    f("books_scattered", 76, 90),
    w("e", 100, "card_catalog", ["plant_dusty"]),
  ],
  gewaechshaus: ({ w, f }) => [
    // Warm and damp. Seven years without people — and everything lives.
    w("w", 70, "algae_tank"),
    w("w", 96, "algae_tank"),
    w("e", 92, "algae_tank"),
    w("e", 66, "planter"),
    w("n", 30, "planter"),
    w("s", 30, "coffee_shrub"), // "Kontrollgruppe"
    w("w", 82, "mycel_wall"),
    w("e", 72, "mycel_wall"),
    w("n", 50, "pipe_straight"),
    w("s", 50, "sink"),
    w("s", 26, "plant_ficus"),
    f("water_drip", 44, 76),
    f("puddle", 34, 77),
    f("plant_fern", 48, 70),
  ],
  observatorium: ({ w, f }) => [
    f("foucault_pendulum", 47, 36),
    f("armillary", 48, 28),
    w("n", 36, "star_chart"),
    w("w", 30, "star_chart"),
    w("e", 40, "poster_telescope"),
    w("e", 46, "map_screen"),
    w("e", 28, "workstation_pc", ["keyboard", "notebook_open", "coffee_mug"]),
    w("w", 20, "bookshelf"),
    w("s", 30, "desk_lamp", ["notebook_open"]),
    w("s", 50, "office_desk", ["legal_pads", "pen_cup", "mug_cold"]),
    f("floor_cables", 34, 40, 1),
  ],
  funkraum: ({ w, f }) => [
    w("s", 32, "receiver_stack"),
    w("s", 52, "receiver_stack"),
    w("w", 110, "tape_machine"),
    w("e", 110, "speaker_stack"),
    w("n", 30, "morse_chalk"),
    w("n", 50, "acoustic_panel"),
    w("n", 34, "workstation_pc", ["headphones", "tape_reels", "keyboard"]),
    f("floor_cables", 34, 110),
  ],

  // ── Ebene −4 · Der Schacht ──
  sohle: ({ w, f }) => [
    w("w", 50, "support_beam"),
    w("w", 72, "support_beam"),
    w("e", 50, "support_beam"),
    w("e", 76, "support_beam"),
    w("n", 88, "chalk_tally"), // somebody counted days down here
    w("n", 108, "mine_lamp"),
    w("s", 90, "mine_lamp"),
    w("s", 108, "rubble_wall"),
    w("w", 66, "rubble_wall"),
    f("rubble_heap", 104, 50),
    f("mine_cart", 90, 58),
    f("water_drip", 100, 70),
    f("rubble_small", 88, 76),
    f("crystal_small", 108, 68),
    f("puddle", 98, 66),
  ],
  x9kammer: ({ w, f }) => [
    // Glittering dust that never settles: THE HALO EXPANDS.
    f("dust_motes", 92, 34),
    f("dust_motes", 106, 28),
    f("dust_motes", 96, 22),
    w("w", 30, "specimen_jars"),
    w("n", 94, "display_case"),
    w("w", 38, "lab_table", ["dust_jar", "beaker_rack", "notebook_open"]),
    w("n", 88, "radiation_sign"),
    w("e", 22, "field_emitter"),
    w("e", 34, "containment_pod"),
    f("crystal_small", 88, 40),
  ],
  stollen: ({ w, f }) => [
    f("mine_cart", 52, 60, 1),
    w("n", 50, "support_beam"),
    w("n", 66, "support_beam"),
    w("s", 52, "support_beam"),
    w("s", 76, "support_beam"),
    w("n", 78, "mine_lamp"),
    w("s", 46, "mine_lamp"),
    w("n", 58, "rubble_wall"),
    f("rubble_small", 66, 64),
    f("water_drip", 78, 56),
  ],
  hoehle: ({ w, f }) => [
    f("crystal_cluster", 48, 100),
    f("crystal_cluster", 78, 78),
    f("crystal_small", 56, 76),
    f("crystal_small", 70, 84),
    f("crystal_small", 46, 88),
    f("crystal_small", 80, 92),
    f("water_drip", 64, 80),
    w("e", 90, "rubble_wall"),
    f("puddle", 58, 98),
    f("broken_glass", 72, 104),
  ],
  c8versteck: ({ w, f }) => [
    // An improvised server room behind the rubble: cables from three decades.
    w("n", 20, "server_rack_b"),
    w("n", 34, "server_rack_dark"),
    w("w", 50, "server_rack_c"),
    w("s", 20, "cooling_fan_box"),
    w("s", 30, "crt_terminal"),
    w("w", 58, "cable_loops"),
    w("e", 44, "cable_tray"),
    w("e", 52, "vent_fan"),
    f("heatsink_pile", 32, 50),
    f("floor_cables", 20, 60),
    f("floor_cables", 31, 58, 1),
    f("tape_reels", 16, 52),
  ],
  truemmer: ({ w, f }) => [
    // The 2009 collapse: sixth-generation bot parts between the boulders.
    f("rubble_heap", 20, 74),
    f("rubble_heap", 33, 104),
    f("bot_scrap", 30, 80),
    f("bot_scrap", 18, 92),
    w("w", 88, "rubble_wall"),
    w("n", 26, "rubble_wall"),
    w("s", 20, "support_beam"),
    w("e", 76, "support_beam"),
    w("n", 36, "mine_lamp"),
    f("rubble_small", 26, 90),
    f("broken_glass", 34, 86),
    f("water_drip", 22, 96),
  ],
  bohrung: ({ w, f }) => [
    f("drill_head", 106, 102),
    w("e", 92, "core_samples"),
    w("w", 100, "core_samples"),
    f("steam_vent", 96, 98),
    f("steam_vent", 108, 86),
    w("n", 108, "pipe_valve"),
    w("w", 86, "gauge_cluster"),
    w("s", 108, "radiation_sign"),
    w("n", 88, "mine_lamp"),
    f("oil_stain", 100, 96),
  ],
};

// ── Procedural filler ────────────────────────────────────────────

interface ThemeKit {
  /** Floor pieces standing against walls. */
  wallFloor: string[];
  /** Mounted on walls. */
  mount: string[];
  /** Free-standing pieces for big rooms. */
  center: string[];
  /** Flat floor decals / small clutter. */
  decals: string[];
  /** 0..1 fill probability per wall slot. */
  density: number;
}

const K = (
  wallFloor: string[],
  mount: string[],
  center: string[],
  decals: string[],
  density: number,
): ThemeKit => ({ wallFloor, mount, center, decals, density });

const THEME_KITS: Record<RoomTheme, ThemeKit> = {
  control: K(
    ["crt_stack", "filing_cabinet", "workstation_pc", "plant_ficus", "water_cooler"],
    [
      "map_screen",
      "poster_halo",
      "wall_clock",
      "exit_sign",
      "fire_extinguisher",
      "whiteboard",
      "wall_phone",
      "fuse_box",
    ],
    ["holo_table"],
    ["floor_cables", "paper_pile", "extension_cord"],
    0.5,
  ),
  server: K(
    ["server_rack_a", "server_rack_b", "server_rack_c", "server_rack_dark"],
    ["cable_loops", "wall_vent", "beacon", "vent_fan", "fuse_box"],
    ["server_rack_dark"],
    ["floor_cables", "extension_cord", "cardboard_boxes"],
    0.8,
  ),
  office: K(
    [
      "bookshelf",
      "filing_cabinet",
      "office_desk",
      "plant_fern",
      "armchair",
      "desk_lamp",
      "trash_bin",
      "coat_rack",
      "space_heater",
    ],
    [
      "cork_board",
      "poster_halo",
      "poster_unstable",
      "wall_clock",
      "whiteboard",
      "sticky_wall",
      "wall_sconce",
      "wall_shelf",
      "hanging_plant",
      "radiator",
    ],
    ["rug"],
    ["paper_pile", "books_scattered", "cardboard_boxes"],
    0.6,
  ),
  corridor: K(
    ["bench_long", "water_cooler", "plant_ficus", "trash_bin", "locker_row", "vending_machine"],
    [
      "poster_safety",
      "poster_unstable",
      "exit_sign",
      "fire_extinguisher",
      "wall_clock",
      "pipe_straight",
      "cable_tray",
      "radiator",
      "wall_phone",
      "wall_sconce",
      "fuse_box",
    ],
    [],
    ["floor_cables", "wet_floor_sign", "mop_bucket"],
    0.35,
  ),
  workshop: K(
    ["vice_bench", "tool_cart", "gas_cylinders", "crate_stack", "locker_row", "barrel"],
    [
      "tool_wall",
      "chalkboard",
      "poster_unstable",
      "fire_extinguisher",
      "goggles_hook",
      "fuse_box",
      "wall_shelf",
    ],
    ["tool_cart"],
    [
      "oil_stain",
      "paper_pile",
      "floor_cables",
      "cable_spool",
      "toolbox",
      "extension_cord",
      "bin_bags",
      "cardboard_boxes",
    ],
    0.6,
  ),
  archive: K(
    ["archive_shelf", "bookshelf", "card_catalog", "filing_cabinet"],
    ["wall_clock", "poster_halo", "wall_sconce", "radiator"],
    ["archive_shelf", "desk_lamp"],
    ["paper_pile", "rug", "cardboard_boxes"],
    0.75,
  ),
  airlock: K(
    ["locker_row", "bench_long", "gas_cylinders"],
    ["wall_vent", "exit_sign", "radiation_sign", "fire_extinguisher", "first_aid", "wall_phone"],
    [],
    ["hazard_decal", "boots_pair"],
    0.45,
  ),
  elevator: K([], [], [], [], 0),
  geothermal: K(
    ["heat_exchanger", "barrel_rust", "floor_pipes", "gas_cylinders"],
    ["pipe_riser", "pipe_valve", "gauge_cluster", "pipe_straight"],
    ["heat_exchanger"],
    ["steam_vent", "oil_stain", "mop_bucket"],
    0.5,
  ),
  power: K(
    ["battery_rack", "transformer", "generator", "gas_cylinders"],
    [
      "lever_panel",
      "gauge_cluster",
      "radiation_sign",
      "fire_extinguisher",
      "cable_tray",
      "fuse_box",
    ],
    ["transformer"],
    ["floor_cables", "oil_stain", "extension_cord"],
    0.6,
  ),
  cooling: K(
    ["coolant_tank", "gas_cylinders", "barrel"],
    ["frost_pipes", "pipe_riser", "pipe_valve", "gauge_cluster"],
    ["coolant_tank"],
    ["puddle", "wet_floor_sign", "mop_bucket"],
    0.55,
  ),
  factory: K(
    ["pallet", "crate_stack", "tool_cart", "generator", "barrel", "gas_cylinders"],
    ["crane_rail", "poster_safety", "fire_extinguisher", "exit_sign", "fuse_box"],
    ["pallet", "crate_stack"],
    ["pallet_empty", "oil_stain", "hazard_decal", "bin_bags", "cardboard_boxes"],
    0.55,
  ),
  storage: K(
    ["pallet", "crate_stack", "barrel", "barrel_rust", "archive_shelf", "gas_cylinders"],
    ["wall_vent", "fire_extinguisher"],
    ["pallet", "crate_stack"],
    ["pallet_empty", "paper_pile", "cardboard_boxes", "bin_bags"],
    0.75,
  ),
  audio: K(
    ["speaker_stack", "tape_machine", "synth", "oscilloscope_cart", "radio", "receiver_stack"],
    ["acoustic_panel", "speaker_wall", "cable_loops", "wall_sconce"],
    ["oscilloscope_cart"],
    ["floor_cables", "vinyl_crate", "extension_cord"],
    0.6,
  ),
  anomaly: K(
    ["crystal_cluster", "field_emitter", "specimen_crate"],
    ["radiation_sign", "beacon"],
    ["crystal_cluster"],
    ["broken_glass"],
    0.4,
  ),
  lab: K(
    ["lab_table", "microscope", "sink", "fume_hood", "diagnostic_rack", "workstation_pc"],
    [
      "first_aid",
      "whiteboard",
      "poster_safety",
      "wall_clock",
      "lab_coat_hook",
      "goggles_hook",
      "wall_shelf",
      "fuse_box",
    ],
    ["lab_table"],
    ["paper_pile", "mop_bucket", "cardboard_boxes"],
    0.6,
  ),
  hangar: K(
    ["crate_stack", "tool_cart", "gas_cylinders", "drone_parked", "barrel"],
    ["crane_rail", "beacon", "exit_sign", "fuse_box"],
    ["drone_parked"],
    ["drone_pad", "rotor_pile", "oil_stain", "bin_bags"],
    0.45,
  ),
  vault: K(
    ["display_case", "vault_safe", "specimen_jars", "archive_shelf"],
    ["poster_halo", "wall_sconce"],
    ["display_case"],
    ["rug"],
    0.6,
  ),
  botdepot: K(
    ["bot_dock", "battery_rack", "locker_row", "tool_cart", "crate_stack"],
    ["tool_wall", "cable_loops", "beacon"],
    [],
    ["oil_stain", "rotor_pile", "extension_cord", "cardboard_boxes"],
    0.6,
  ),
  forge: K(
    ["reactor_coil", "portal_pylon", "workstation_pc"],
    ["plasma_conduit", "cable_loops"],
    ["reactor_coil"],
    ["glow_seam", "floor_cables"],
    0.4,
  ),
  reactor: K(
    ["reactor_coil", "transformer", "barrel_toxic", "gas_cylinders"],
    ["radiation_sign", "gauge_cluster", "lever_panel", "pipe_riser"],
    [],
    ["hazard_decal"],
    0.5,
  ),
  containment: K(
    ["containment_pod", "field_emitter", "specimen_crate"],
    ["radiation_sign", "beacon"],
    ["field_emitter"],
    ["broken_glass", "hazard_decal"],
    0.45,
  ),
  portal: K(
    ["portal_pylon", "workstation_pc"],
    ["plasma_conduit", "poster_halo"],
    ["portal_pylon"],
    ["glow_seam"],
    0.4,
  ),
  cryo: K(
    ["cryo_tank", "coolant_tank", "gas_cylinders"],
    ["frost_pipes", "whiteboard", "pipe_valve"],
    ["cryo_tank"],
    ["puddle"],
    0.5,
  ),
  quarters: K(
    [
      "bunk_bed",
      "cot",
      "locker_row",
      "kitchenette",
      "armchair",
      "fridge",
      "plant_fern",
      "sofa",
      "coat_rack",
      "space_heater",
    ],
    [
      "poster_halo",
      "poster_unstable",
      "wall_clock",
      "sticky_wall",
      "wall_sconce",
      "hanging_plant",
      "wall_shelf",
      "radiator",
    ],
    ["rug"],
    ["rug_round", "paper_pile", "books_scattered", "laundry_pile", "boots_pair"],
    0.6,
  ),
  greenhouse: K(
    ["planter", "plant_ficus", "plant_fern", "plant_cactus", "sink", "algae_tank"],
    ["pipe_straight", "mycel_wall", "hanging_plant"],
    ["planter"],
    ["puddle", "mop_bucket"],
    0.7,
  ),
  observatory: K(
    ["telescope", "desk_lamp", "bookshelf", "antenna_mast"],
    ["chalkboard", "map_screen", "star_chart", "poster_telescope", "wall_sconce", "wall_shelf"],
    ["armillary"],
    ["rug_round"],
    0.5,
  ),
  generic: K(
    ["crate_stack", "barrel", "trash_bin", "plant_fern"],
    ["poster_safety", "fire_extinguisher", "radiator"],
    [],
    ["paper_pile", "cardboard_boxes"],
    0.4,
  ),
};

/** Raw rock rooms of the shaft (Ebene −4, storage/corridor themes) — see layout `isShaft`. */
const SHAFT_KIT: ThemeKit = K(
  ["rubble_heap", "mine_cart", "barrel_rust", "crate_stack"],
  ["support_beam", "mine_lamp", "chalk_tally", "rubble_wall"],
  ["rubble_heap"],
  ["rubble_small", "water_drip", "puddle", "crystal_small"],
  0.45,
);

function kitFor(r: RoomDef): ThemeKit {
  const theme = r.theme ?? "generic";
  if (r.floor === 5 && (theme === "storage" || theme === "corridor")) return SHAFT_KIT;
  return THEME_KITS[theme] ?? THEME_KITS.generic;
}

/** Small clutter added to hand-dressed rooms. */
const CLUTTER: Record<string, string[]> = {
  default: ["trash_bin", "paper_pile", "floor_cables", "cardboard_boxes"],
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T | undefined {
  return list.length ? list[Math.floor(rng() * list.length)] : undefined;
}

// ── Validation context ───────────────────────────────────────────

interface Placed {
  p: DecorPlacement;
  rect: Rect;
  y0: number;
  y1: number;
  decal: boolean;
  solid: boolean;
}

interface Ctx {
  floor: FloorId;
  world: VoxelWorld;
  zones: Zone[];
  wander: Map<string, number>;
  placed: Placed[];
  blocked: Uint8Array;
  baseline: boolean[];
  targets: Target[];
}

interface Target {
  x: number;
  z: number;
  radius: number;
}

const SX = FLOOR_SIZE.x;
const SZ = FLOOR_SIZE.z;

function roomInterior(r: RoomDef): Rect {
  return { x0: r.x + 1, z0: r.z + 1, x1: r.x + r.w, z1: r.z + r.d };
}

function cellsOf(rect: Rect, eps = 0.05): { cx0: number; cz0: number; cx1: number; cz1: number } {
  return {
    cx0: Math.floor(rect.x0 + eps),
    cz0: Math.floor(rect.z0 + eps),
    cx1: Math.ceil(rect.x1 - eps) - 1,
    cz1: Math.ceil(rect.z1 - eps) - 1,
  };
}

/** Collision footprint (shrunk like prop footprints in the engine). */
function solidRect(rect: Rect): Rect {
  return { x0: rect.x0 + 0.3, z0: rect.z0 + 0.3, x1: rect.x1 - 0.3, z1: rect.z1 - 0.3 };
}

function markBlocked(blocked: Uint8Array, rect: Rect): void {
  for (let z = Math.max(0, Math.floor(rect.z0)); z < Math.min(SZ, Math.ceil(rect.z1)); z++)
    for (let x = Math.max(0, Math.floor(rect.x0)); x < Math.min(SX, Math.ceil(rect.x1)); x++)
      blocked[x + z * SX] = 1;
}

function doorRect(z: Zone): Rect {
  const along = DECOR_CLEARANCE.doorAlong;
  const into = DECOR_CLEARANCE.doorInto;
  const horizontal = z.x1 - z.x0 > z.z1 - z.z0; // opening runs along x
  return horizontal
    ? { x0: z.x - along, x1: z.x + along + 1, z0: z.z - into, z1: z.z + into + 1 }
    : { x0: z.x - into, x1: z.x + into + 1, z0: z.z - along, z1: z.z + along + 1 };
}

let lastReason = "";
function fail(reason: string): undefined {
  lastReason = reason;
  return undefined;
}

function valid(ctx: Ctx, r: RoomDef, p: DecorPlacement): Placed | undefined {
  const def = defOf(p.decor);
  if (!def) return fail("unknown");
  const m = decorModel(p.decor);
  const rect = placementRect(p);
  const inner = roomInterior(r);
  const eps = 0.02;
  if (rect.x0 < inner.x0 - eps || rect.z0 < inner.z0 - eps) return fail("room");
  if (rect.x1 > inner.x1 + eps || rect.z1 > inner.z1 + eps) return fail("room");
  const elev = decorElevation(p);
  const y0 = 1 + elev;
  const y1 = y0 + m.h * decorScale(p.decor);
  const decal = isDecal(def);
  const soft = decal || (!def.solid && !!def.wall);

  // Elevator area & spawn.
  const elevator: Rect = {
    x0: ELEVATOR_AREA.x0,
    z0: ELEVATOR_AREA.z0,
    x1: ELEVATOR_AREA.x1 + 1,
    z1: ELEVATOR_AREA.z1 + 1,
  };
  if (overlaps(rect, elevator)) return fail("elevator");

  for (const q of ctx.zones) {
    if (q.kind === "elevator") continue;
    if (q.kind === "door") {
      if (overlaps(rect, doorRect(q))) return fail("door");
      continue;
    }
    let margin: number =
      q.kind === "device"
        ? DECOR_CLEARANCE.device
        : q.kind === "npc"
          ? DECOR_CLEARANCE.npc
          : DECOR_CLEARANCE.object;
    if (q.kind === "npc" && def.solid) margin += ctx.wander.get(q.id) ?? 0;
    if (soft) margin = DECOR_CLEARANCE.soft;
    if (overlaps(rect, q, margin)) return fail(`zone ${q.id}`);
  }

  // Terrain: nothing of the architecture inside the piece's volume; floor below floor pieces.
  const { cx0, cz0, cx1, cz1 } = cellsOf(rect);
  const ya = Math.max(1, Math.floor(y0 + eps));
  const yb = Math.min(ctx.world.sy - 1, Math.ceil(y1 - eps) - 1);
  for (let z = cz0; z <= cz1; z++)
    for (let x = cx0; x <= cx1; x++) {
      if (elev === 0 && !ctx.world.get(x, 0, z)) return fail("nofloor");
      for (let y = ya; y <= yb; y++) if (ctx.world.get(x, y, z)) return fail("terrain");
    }

  // Wall pieces must not cover a window or keypad (the wall voxels behind them).
  if (def.wall) {
    const back = wallBehind(p, rect);
    for (const [x, z] of back)
      for (let y = ya; y <= yb; y++) {
        const v = ctx.world.get(x, y, z);
        if (v === 0) return fail("nowall"); // no wall behind (door opening)
      }
  }

  // Other decor.
  for (const o of ctx.placed) {
    if (!overlaps(rect, o.rect)) continue;
    if (decal !== o.decal) continue; // decals may lie under furniture
    if (decal) return fail("decal");
    if (y0 < o.y1 && o.y0 < y1) return fail("decor");
  }
  return { p, rect, y0, y1, decal, solid: def.solid };
}

/** Wall voxels directly behind a wall-mounted piece (depends on rotation). */
function wallBehind(p: DecorPlacement, rect: Rect): [number, number][] {
  const out: [number, number][] = [];
  const { cx0, cz0, cx1, cz1 } = cellsOf(rect);
  if (p.rot === 0) for (let x = cx0; x <= cx1; x++) out.push([x, cz0 - 1]);
  if (p.rot === 2) for (let x = cx0; x <= cx1; x++) out.push([x, cz1 + 1]);
  if (p.rot === 1) for (let z = cz0; z <= cz1; z++) out.push([cx0 - 1, z]);
  if (p.rot === 3) for (let z = cz0; z <= cz1; z++) out.push([cx1 + 1, z]);
  return out;
}

// ── Reachability (3×3 walker) ────────────────────────────────────

/** Sub-steps per voxel for walker centres (exact 2.2-wide AABB, like the engine's Walker). */
const Q = 4;
const HALF = WALKER.width / 2;

function reach(ctx: Ctx, blocked: Uint8Array): boolean[] {
  // Summed-area table of blocked cells → O(1) box tests.
  const W = SX + 1;
  const sat = new Int32Array(W * (SZ + 1));
  for (let z = 0; z < SZ; z++)
    for (let x = 0; x < SX; x++)
      sat[x + 1 + (z + 1) * W] =
        blocked[x + z * SX]! + sat[x + (z + 1) * W]! + sat[x + 1 + z * W]! - sat[x + z * W]!;
  const NX = SX * Q;
  const NZ = SZ * Q;
  const ok = (i: number, k: number) => {
    const cx = i / Q;
    const cz = k / Q;
    const x0 = Math.floor(cx - HALF);
    const z0 = Math.floor(cz - HALF);
    const x1 = Math.ceil(cx + HALF);
    const z1 = Math.ceil(cz + HALF);
    if (x0 < 0 || z0 < 0 || x1 > SX || z1 > SZ) return false;
    return sat[x1 + z1 * W]! - sat[x0 + z1 * W]! - sat[x1 + z0 * W]! + sat[x0 + z0 * W]! === 0;
  };
  const seen = new Uint8Array(NX * NZ);
  const e = ELEVATORS.find((q) => q.floor === ctx.floor) ?? { x: 120, z: 62 };
  const si = (e.x - 6) * Q + Q / 2;
  const sk = e.z * Q + Q / 2;
  const queue: number[] = [];
  if (ok(si, sk)) {
    seen[si + sk * NX] = 1;
    queue.push(si + sk * NX);
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const n = queue[qi]!;
    const i = n % NX;
    const k = (n - i) / NX;
    for (const [ni, nk] of [
      [i + 1, k],
      [i - 1, k],
      [i, k + 1],
      [i, k - 1],
    ] as const) {
      if (ni < 0 || nk < 0 || ni >= NX || nk >= NZ) continue;
      const j = ni + nk * NX;
      if (seen[j] || !ok(ni, nk)) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return ctx.targets.map((t) => {
    const R = WALK.reach + t.radius;
    for (
      let k = Math.max(0, Math.floor((t.z - R) * Q));
      k <= Math.min(NZ - 1, Math.ceil((t.z + R) * Q));
      k++
    )
      for (
        let i = Math.max(0, Math.floor((t.x - R) * Q));
        i <= Math.min(NX - 1, Math.ceil((t.x + R) * Q));
        i++
      )
        if (seen[i + k * NX] && Math.hypot(i / Q - t.x, k / Q - t.z) <= R) return true;
    return false;
  });
}

/** Terrain + device/prop collision (as the engine builds it, all devices built). */
function baseBlocked(floor: FloorId, world: VoxelWorld): Uint8Array {
  const blocked = new Uint8Array(SX * SZ);
  for (let z = 0; z < SZ; z++)
    for (let x = 0; x < SX; x++) {
      let b = !world.get(x, 0, z);
      for (let y = 1; !b && y <= WALK.headroom; y++) if (world.get(x, y, z)) b = true;
      if (b) blocked[x + z * SX] = 1;
    }
  const roomFloor = new Map(ROOMS.map((r) => [r.id, r.floor]));
  for (const d of DEVICES) {
    if (roomFloor.get(d.room) !== floor) continue;
    const m = deviceModel(d.id);
    const sc = deviceVisual(d.id).scale ?? MODEL_SCALE;
    const hw = (m.w * sc) / 2;
    const hd = (m.d * sc) / 2;
    markBlocked(blocked, {
      x0: d.x + 0.5 - hw + 0.3,
      z0: d.z + 0.5 - hd + 0.3,
      x1: d.x + 0.5 + hw - 0.3,
      z1: d.z + 0.5 + hd - 0.3,
    });
  }
  for (const t of ROOM_TERMINALS) {
    if (t.floor !== floor) continue;
    const odd = (t.rot ?? 0) % 2 === 1;
    const hw = ((odd ? ROOM_TERMINAL_SIZE.d : ROOM_TERMINAL_SIZE.w) * ROOM_TERMINAL_SCALE) / 2;
    const hd = ((odd ? ROOM_TERMINAL_SIZE.w : ROOM_TERMINAL_SIZE.d) * ROOM_TERMINAL_SCALE) / 2;
    markBlocked(blocked, {
      x0: t.x + 0.8 - hw,
      z0: t.z + 0.8 - hd,
      x1: t.x + 0.2 + hw,
      z1: t.z + 0.2 + hd,
    });
  }
  for (const p of PROPS) {
    if (p.floor !== floor || p.model === "elevator") continue;
    const m = propModel(p.model);
    const rot = (p.rot ?? 0) % 2 === 1;
    const hw = ((rot ? m.d : m.w) * MODEL_SCALE) / 2;
    const hd = ((rot ? m.w : m.d) * MODEL_SCALE) / 2;
    markBlocked(blocked, {
      x0: p.x + 0.8 - hw,
      z0: p.z + 0.8 - hd,
      x1: p.x + 0.2 + hw,
      z1: p.z + 0.2 + hd,
    });
  }
  return blocked;
}

function targetsOf(zones: readonly Zone[]): Target[] {
  return zones
    .filter((q) => q.kind !== "elevator")
    .map((q) => {
      const radius =
        q.kind === "device" || q.kind === "prop"
          ? Math.max(q.x1 - q.x0, q.z1 - q.z0) / 2
          : q.kind === "door"
            ? 2.5
            : q.kind === "note"
              ? 0.8
              : 1.5;
      return { x: q.x + 0.5, z: q.z + 0.5, radius };
    });
}

// ── Desk-top dressing ────────────────────────────────────────────

/** Clutter that stands on each host's top surface (procedural rooms and authored hosts without `on`). */
const HOST_CLUTTER: Record<string, string[]> = {
  office_desk: [
    "keyboard",
    "mouse_pad",
    "coffee_mug",
    "paper_stack",
    "notebook_open",
    "pen_cup",
    "legal_pads",
    "book_stack",
    "desk_fan",
    "mug_cold",
    "stapler",
    "sticky_notes",
    "desk_succulent",
    "desk_clock",
  ],
  workstation_pc: [
    "keyboard",
    "mouse_pad",
    "coffee_mug",
    "headphones",
    "mug_cold",
    "paper_stack",
    "sticky_notes",
    "desk_succulent",
  ],
  lab_table: ["beaker_rack", "petri_dishes", "notebook_open", "paper_stack", "thermos"],
  vice_bench: [
    "toolbox",
    "screwdriver_set",
    "soldering_station",
    "multimeter",
    "scope_probes",
    "thermos",
  ],
  tool_cart: ["multimeter", "screwdriver_set", "scope_probes"],
  kitchenette: ["coffee_mug", "mug_cold", "food_tray", "thermos"],
  canteen_table: ["food_tray", "coffee_mug", "mug_cold", "chess_board"],
  mug_table: ["mug_cold", "legal_pads", "rubiks_cube", "book_stack", "desk_clock"],
  desk_lamp: ["mug_cold", "book_stack", "desk_clock"],
  filing_cabinet: ["plant_dusty", "paper_stack", "desk_succulent"],
  card_catalog: ["plant_dusty", "paper_stack"],
  sofa: ["sofa_blanket", "book_stack"],
};

/** Extra desk-top clutter by room theme (mixed into the host pool). */
const THEME_CLUTTER: Partial<Record<RoomTheme, string[]>> = {
  audio: ["headphones", "tape_reels"],
  lab: ["beaker_rack", "petri_dishes"],
  workshop: ["soldering_station", "multimeter"],
  quarters: ["book_stack", "rubiks_cube", "desk_clock", "thermos"],
  control: ["legal_pads"],
  server: ["headphones", "multimeter"],
  office: ["photo_cottbus", "stapler"],
};

interface LocalRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * Stand small clutter on a host's flat top: every item is tried in four
 * orientations over a grid of spots (item-voxel steps, scattered start),
 * accepted where all host columns below it are exactly `top` high and it
 * does not touch clutter already on this host. Returns non-solid
 * placements with `y` = the host's surface and `host` = its id.
 */
function dressHost(host: DecorPlacement, items: readonly string[], seed: string): DecorPlacement[] {
  const hdef = defOf(host.decor);
  const top = hdef?.top;
  if (!top) return [];
  const hm = decorModel(host.decor);
  const hs = decorScale(host.decor);
  const H = decorHeightmap(host.decor);
  const rng = mulberry32(fnv1a(seed));
  const taken: LocalRect[] = [];
  const out: DecorPlacement[] = [];
  const eps = 1e-6;
  items.forEach((item, n) => {
    const idef = defOf(item);
    if (!idef || idef.solid || idef.wall) return;
    const im = decorModel(item);
    const k = decorScale(item) / hs;
    const r0 = Math.floor(rng() * 4);
    for (let t = 0; t < 4; t++) {
      const rel = ([0, 2, 1, 3] as const)[(r0 + t) % 4]!;
      const lw = (rel % 2 ? im.d : im.w) * k;
      const ld = (rel % 2 ? im.w : im.d) * k;
      if (lw > hm.w + eps || ld > hm.d + eps) continue;
      const nu = Math.floor((hm.w - lw) / k + eps) + 1;
      const nv = Math.floor((hm.d - ld) / k + eps) + 1;
      const total = nu * nv;
      const start = Math.floor(rng() * total);
      for (let c = 0; c < total; c++) {
        const idx = (start + c * 7) % total;
        const u0 = (idx % nu) * k;
        const v0 = Math.floor(idx / nu) * k;
        const rect: LocalRect = { u0, v0, u1: u0 + lw, v1: v0 + ld };
        if (taken.some((q) => rect.u0 < q.u1 && rect.u1 > q.u0 && rect.v0 < q.v1 && rect.v1 > q.v0))
          continue;
        let flat = true;
        for (let j = Math.floor(v0 + eps); flat && j <= Math.ceil(rect.v1 - eps) - 1; j++)
          for (let i = Math.floor(u0 + eps); i <= Math.ceil(rect.u1 - eps) - 1; i++)
            if (H[i + j * hm.w] !== top) {
              flat = false;
              break;
            }
        if (!flat) continue;
        taken.push(rect);
        const [wx, , wz] = decorLocalToWorld(host, [(u0 + rect.u1) / 2, 0, (v0 + rect.v1) / 2]);
        out.push({
          id: `${host.id}:t${n}`,
          decor: item,
          floor: host.floor,
          room: host.room,
          x: wx - 0.5,
          z: wz - 0.5,
          rot: ((host.rot + rel) % 4) as Rot,
          y: decorElevation(host) + top * hs,
          host: host.id,
        });
        return;
      }
    }
  });
  return out;
}

/** Procedural pick of desk-top clutter for a host (deterministic per placement). */
function hostClutter(host: DecorPlacement, theme: RoomTheme): string[] {
  const base = HOST_CLUTTER[host.decor];
  if (!base) return [];
  const rng = mulberry32(fnv1a(`clutter:${host.id}`));
  if (rng() < 0.12) return []; // the odd bare surface
  const pool = [...base, ...(THEME_CLUTTER[theme] ?? [])];
  const desk = host.decor === "office_desk" || host.decor === "workstation_pc";
  const n = desk ? 2 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
  const out: string[] = [];
  if (desk && rng() < 0.8) out.push("keyboard");
  while (out.length < n && pool.length) {
    const i = Math.floor(rng() * pool.length);
    const it = pool.splice(i, 1)[0]!;
    if (!out.includes(it)) out.push(it);
  }
  return out;
}

// ── Generation ───────────────────────────────────────────────────

/** Along-wall offsets, nearest first (covers the longest wall). */
const NUDGE_ALONG: number[] = (() => {
  const out = [0];
  for (let o = 1; o <= Math.max(FLOOR_SIZE.x, FLOOR_SIZE.z); o++) out.push(o, -o);
  return out;
})();
const NUDGE_FREE: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) out.push([dx, dz]);
  return out.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
})();

function tryPlace(
  ctx: Ctx,
  r: RoomDef,
  spec: Spec,
  id: string,
  nudge: boolean,
): Placed | undefined {
  const def = defOf(spec.decor);
  const base: DecorPlacement = {
    id,
    decor: spec.decor,
    floor: ctx.floor,
    room: r.id,
    x: spec.x,
    z: spec.z,
    rot: spec.rot,
  };
  if (spec.y !== undefined) base.y = spec.y;
  else if (def?.wall) base.y = def.elevation ?? 0;
  const candidates: DecorPlacement[] = [];
  if (!nudge) candidates.push(base);
  else if (spec.side) {
    // The requested wall first (nearest spot along it), then the other walls.
    const gaps = def?.wall ? [spec.gap ?? 0] : [spec.gap ?? 0, (spec.gap ?? 0) + 1];
    const sides: Side[] = [
      spec.side,
      ...(["n", "w", "s", "e"] as const).filter((q) => q !== spec.side),
    ];
    for (const side of sides) {
      const t0 = side === "n" || side === "s" ? spec.x : spec.z;
      for (const o of NUDGE_ALONG)
        for (const g of gaps) {
          const s = wallSpec(r, side, t0 + o, spec.decor, g);
          candidates.push({ ...base, x: s.x, z: s.z, rot: s.rot });
        }
    }
  } else
    for (const [dx, dz] of NUDGE_FREE) candidates.push({ ...base, x: spec.x + dx, z: spec.z + dz });
  let first = "";
  for (let i = 0; i < candidates.length; i++) {
    const v = valid(ctx, r, candidates[i]!);
    if (v) return v;
    if (i === 0) first = lastReason;
  }
  lastReason = first;
  return undefined;
}

/** Commit a room's batch; drop solid pieces that break reachability. */
function commit(ctx: Ctx, batch: Placed[]): Placed[] {
  const solids = batch.filter((b) => b.solid);
  const trial = ctx.blocked.slice();
  for (const s of solids) markBlocked(trial, solidRect(s.rect));
  const keeps = (blocked: Uint8Array) => {
    const now = reach(ctx, blocked);
    return ctx.baseline.every((was, i) => !was || now[i]);
  };
  if (keeps(trial)) {
    ctx.blocked = trial;
    return batch;
  }
  // Slow path: add solids one at a time.
  const kept: Placed[] = batch.filter((b) => !b.solid);
  for (const s of solids) {
    const t = ctx.blocked.slice();
    markBlocked(t, solidRect(s.rect));
    if (keeps(t)) {
      ctx.blocked = t;
      kept.push(s);
    }
  }
  return kept;
}

function sideSpan(r: RoomDef, side: Side): [number, number] {
  return side === "n" || side === "s" ? [r.x + 1, r.x + r.w] : [r.z + 1, r.z + r.d];
}

function fillRoom(ctx: Ctx, r: RoomDef, clutterOnly: boolean, out: Placed[]): void {
  const kit = kitFor(r);
  if (kit.density <= 0) return;
  const rng = mulberry32(fnv1a(`interior:${r.id}`));
  let n = 0;
  const add = (spec: Spec, nudge: boolean) => {
    const v = tryPlace(ctx, r, spec, `decor:${r.id}:p${n++}`, nudge);
    if (v) {
      ctx.placed.push(v);
      out.push(v);
    }
    return v;
  };
  const sides: Side[] = ["n", "w", "s", "e"];
  const density = clutterOnly ? kit.density * 0.35 : kit.density;

  // Floor pieces along the walls.
  if (!clutterOnly)
    for (const side of sides) {
      const [a, b] = sideSpan(r, side);
      let c = a + 1;
      while (c < b - 1) {
        const decor = pick(rng, kit.wallFloor);
        if (!decor) break;
        const width = decorModel(decor).w * decorScale(decor);
        if (rng() < density) {
          const t = c + width / 2 - 0.5;
          const v =
            add(wallSpec(r, side, t, decor), false) ?? add(wallSpec(r, side, t, decor, 1), false);
          if (v) {
            c += width + (rng() < 0.5 ? 0 : 1 + Math.floor(rng() * 3));
            continue;
          }
        }
        c += 2;
      }
    }

  // Wall-mounted pieces.
  for (const side of sides) {
    const [a, b] = sideSpan(r, side);
    for (let c = a + 3 + Math.floor(rng() * 4); c < b - 3; c += 5 + Math.floor(rng() * 5)) {
      if (rng() > density) continue;
      const decor = pick(rng, kit.mount);
      if (decor) add(wallSpec(r, side, c, decor), false);
    }
  }

  // Centre pieces for big rooms.
  if (!clutterOnly && r.w >= 22 && r.d >= 22)
    for (let i = 0; i < 3; i++) {
      const decor = pick(rng, kit.center);
      if (!decor) break;
      const x = r.x + 6 + Math.floor(rng() * (r.w - 12));
      const z = r.z + 6 + Math.floor(rng() * (r.d - 12));
      add({ decor, x, z, rot: (Math.floor(rng() * 4) % 4) as Rot }, false);
    }

  // Decals & clutter.
  const extra = r.floor === 5 ? [] : (CLUTTER.default ?? []); // no office bins in the shaft
  const decals = clutterOnly ? [...kit.decals, ...extra] : kit.decals;
  const count = Math.max(1, Math.round(((r.w * r.d) / 170) * (clutterOnly ? 0.6 : 1)));
  for (let i = 0; i < count; i++) {
    const decor = pick(rng, decals);
    if (!decor) break;
    const x = r.x + 3 + Math.floor(rng() * Math.max(1, r.w - 6));
    const z = r.z + 3 + Math.floor(rng() * Math.max(1, r.d - 6));
    // Clutter may shuffle a few voxels to find a free spot (small spiral).
    add({ decor, x, z, rot: (Math.floor(rng() * 4) % 4) as Rot }, true);
  }
}

interface FloorInterior {
  placements: DecorPlacement[];
  authored: number;
  authoredPlaced: number;
  procedural: number;
  /** Desk-top clutter placements (on hosts). */
  clutter: number;
  dropped: string[];
}

const CACHE = new Map<FloorId, FloorInterior>();

function generate(floor: FloorId): FloorInterior {
  const world = buildFloor(floor).world;
  const zones = interactableZones(floor);
  if (SPAWN.floor === floor)
    zones.push({
      kind: "npc",
      id: "spawn",
      x: SPAWN.pos[0],
      z: SPAWN.pos[2],
      h: 5,
      x0: SPAWN.pos[0] - 0.5,
      z0: SPAWN.pos[2] - 0.5,
      x1: SPAWN.pos[0] + 1.5,
      z1: SPAWN.pos[2] + 1.5,
    });
  const wander = new Map<string, number>();
  // NPC wander radii (solid decor stays out of their stroll).
  for (const q of zones) if (q.kind === "npc") wander.set(q.id, 0);
  for (const npc of NPCS) if (npc.floor === floor) wander.set(npc.id, npc.wander);

  const blocked = baseBlocked(floor, world);
  const targets = targetsOf(zones.filter((q) => q.id !== "spawn"));
  const ctx: Ctx = { floor, world, zones, wander, placed: [], blocked, baseline: [], targets };
  ctx.baseline = reach(ctx, blocked);

  const rooms = ROOMS.filter((r) => r.floor === floor);
  const out: Placed[] = [];
  const clutter: DecorPlacement[] = [];
  let authored = 0;
  let authoredPlaced = 0;
  const dropped: string[] = [];
  for (const r of rooms) {
    const batch: Placed[] = [];
    const authoredSet = new Set<Placed>();
    const onTop = new Map<Placed, string[]>();
    const author = AUTHORED[r.id];
    if (author) {
      const kit: Kit = {
        r,
        w: (side, t, decor, on) => wallSpec(r, side, t, decor, 0, on),
        f: (decor, x, z, rot = 0, on) => (on ? { decor, x, z, rot, on } : { decor, x, z, rot }),
      };
      const specs = author(kit);
      specs.forEach((spec, i) => {
        authored++;
        const v = tryPlace(ctx, r, spec, `decor:${r.id}:a${i}`, true);
        if (v) {
          ctx.placed.push(v);
          batch.push(v);
          authoredSet.add(v);
          if (spec.on) onTop.set(v, spec.on);
        } else dropped.push(`${r.id}:${spec.decor}[${lastReason}]`);
      });
    }
    fillRoom(ctx, r, !!author, batch);
    const kept = commit(ctx, batch);
    const keptSet = new Set(kept);
    ctx.placed = ctx.placed.filter((pl) => !batch.includes(pl) || keptSet.has(pl));
    for (const k of kept) {
      out.push(k);
      if (authoredSet.has(k)) authoredPlaced++;
    }
    // Desk-top clutter on the surviving hosts (non-solid: never affects reachability).
    for (const k of kept) {
      if (!defOf(k.p.decor)?.top) continue;
      const items = onTop.get(k) ?? hostClutter(k.p, r.theme ?? "generic");
      for (const c of dressHost(k.p, items, `top:${k.p.id}`)) clutter.push(c);
    }
    for (const b of batch) if (!keptSet.has(b)) dropped.push(`${r.id}:${b.p.decor}(path)`);
  }
  return {
    placements: [...out.map((o) => o.p), ...clutter],
    authored,
    authoredPlaced,
    procedural: out.length - authoredPlaced,
    clutter: clutter.length,
    dropped,
  };
}

function interior(floor: FloorId): FloorInterior {
  let f = CACHE.get(floor);
  if (!f) {
    f = generate(floor);
    CACHE.set(floor, f);
  }
  return f;
}

// ── Public API ───────────────────────────────────────────────────

/** All decor placements of a floor (deterministic, cached). */
export function interiorFor(floor: FloorId): DecorPlacement[] {
  return interior(floor).placements;
}

/** Diagnostics for tests / tooling. */
export function interiorReport(floor: FloorId): {
  authored: number;
  authoredPlaced: number;
  procedural: number;
  clutter: number;
  dropped: string[];
} {
  const f = interior(floor);
  return {
    authored: f.authored,
    authoredPlaced: f.authoredPlaced,
    procedural: f.procedural,
    clutter: f.clutter,
    dropped: f.dropped,
  };
}

/** Rooms with hand-authored dressing. */
export const AUTHORED_ROOMS: readonly string[] = Object.keys(AUTHORED);

/**
 * Collision footprints of the solid decor (world units, max exclusive,
 * shrunk by 0.3 like prop footprints) — feed to `FloorCollision.addFootprint`.
 */
export function decorFootprints(floor: FloorId): DecorFootprint[] {
  const out: DecorFootprint[] = [];
  for (const p of interiorFor(floor)) {
    const def = defOf(p.decor);
    if (!def?.solid) continue;
    const r = solidRect(placementRect(p));
    out.push({ ...r, h: decorElevation(p) + decorModel(p.decor).h * decorScale(p.decor) });
  }
  return out;
}

/**
 * World position of a CONTINUOUS model-voxel point of a placed decor piece
 * (voxel (i, j, k) spans [i, i+1]; the bottom-centre of the model is the
 * placement origin). Honours the decor scale and the placement rotation.
 */
export function decorLocalToWorld(
  p: DecorPlacement,
  pos: readonly [number, number, number],
): [number, number, number] {
  const m = decorModel(p.decor);
  const s = decorScale(p.decor);
  const lx = (pos[0] - m.w / 2) * s;
  const lz = (pos[2] - m.d / 2) * s;
  const a = (p.rot * Math.PI) / 2;
  const cos = Math.round(Math.cos(a));
  const sin = Math.round(Math.sin(a));
  // Same as three.js rotation.y: x' = x cos + z sin, z' = −x sin + z cos.
  return [
    p.x + 0.5 + lx * cos + lz * sin,
    1 + decorElevation(p) + pos[1] * s,
    p.z + 0.5 - lx * sin + lz * cos,
  ];
}

/** World transform of a model-voxel point (voxel index; its centre) of a placed decor piece. */
export function decorPoint(
  p: DecorPlacement,
  pos: readonly [number, number, number],
): [number, number, number] {
  return decorLocalToWorld(p, [pos[0] + 0.5, pos[1] + 0.5, pos[2] + 0.5]);
}

const NORMAL_VEC: Record<ScreenSpec["normal"], [number, number, number]> = {
  "+x": [1, 0, 0],
  "-x": [-1, 0, 0],
  "+z": [0, 0, 1],
  "-z": [0, 0, -1],
  "+y": [0, 1, 0],
};

export interface DecorScreenPlacement {
  /** `${placement id}:s${index}` — stable per screen. */
  id: string;
  placement: string;
  decor: string;
  room: string;
  /** World-space centre of the screen face. */
  center: [number, number, number];
  /** World-space unit normal (rotated with the placement). */
  normal: [number, number, number];
  /** World-unit size (width along the face, height). */
  w: number;
  h: number;
  /** Rotation of the placement (quarter turns about +y), for orienting the plane. */
  rot: Rot;
  spec: ScreenSpec;
}

/** Live screens of every decor placement on a floor, in world space. */
export function decorScreens(floor: FloorId): DecorScreenPlacement[] {
  const out: DecorScreenPlacement[] = [];
  for (const p of interiorFor(floor)) {
    const def = defOf(p.decor);
    if (!def?.screens?.length) continue;
    const s = decorScale(p.decor);
    const a = (p.rot * Math.PI) / 2;
    const cos = Math.round(Math.cos(a));
    const sin = Math.round(Math.sin(a));
    def.screens.forEach((spec, i) => {
      const [nx, ny, nz] = NORMAL_VEC[spec.normal];
      out.push({
        id: `${p.id}:s${i}`,
        placement: p.id,
        decor: p.decor,
        room: p.room,
        center: decorLocalToWorld(p, spec.center),
        normal: [nx * cos + nz * sin, ny, -nx * sin + nz * cos],
        w: spec.w * s,
        h: spec.h * s,
        rot: p.rot,
        spec,
      });
    });
  }
  return out;
}

/** Placements whose decor has animated parts (the engine rigs only these per instance). */
export function animatedDecor(floor: FloorId): DecorPlacement[] {
  return interiorFor(floor).filter((p) => (defOf(p.decor)?.parts?.length ?? 0) > 0);
}

/**
 * Point lights of decor pieces, capped for performance (at most `perRoom`
 * per room and `max` per floor, strongest first).
 */
export function decorLights(floor: FloorId, max = 12, perRoom = 2): DecorLightPlacement[] {
  const all: DecorLightPlacement[] = [];
  for (const p of interiorFor(floor)) {
    const l = defOf(p.decor)?.light;
    if (!l) continue;
    const [x, y, z] = decorPoint(p, l.pos);
    all.push({
      id: p.id,
      decor: p.decor,
      room: p.room,
      x,
      y,
      z,
      color: l.color,
      intensity: l.intensity,
      distance: l.distance,
      requiresPower: l.requiresPower,
    });
  }
  all.sort((a, b) => b.intensity - a.intensity || a.id.localeCompare(b.id));
  const perRoomCount = new Map<string, number>();
  const out: DecorLightPlacement[] = [];
  for (const l of all) {
    const n = perRoomCount.get(l.room) ?? 0;
    if (n >= perRoom || out.length >= max) continue;
    perRoomCount.set(l.room, n + 1);
    out.push(l);
  }
  return out;
}

/** All floors that exist in the map (for tooling/tests). */
export function interiorFloors(): FloorId[] {
  return FLOORS.map((f) => f.id);
}

/**
 * Lab map — four floors of the hidden laboratory.
 * ================================================
 *
 * Ebene 0  Oberdeck      — Kontrollraum (Jades Hauptkonsole), MCP-Kammer,
 *                          Damiens Sekundärstation, Werkstatt, Archiv
 * Ebene −1 Energie       — Geothermie-Schacht (847 kW), Batterieraum,
 *                          Kühlung, Fertigungshalle, Rechenzentrum, Lager
 * Ebene −2 Signale       — Signallabor, Anomaliekammer, Drohnenhangar,
 *                          Diagnose, Relikt-Tresor, Bot-Depot
 * Ebene −3 Tiefenlabor   — Deep Lab Level 3: Infinity-Forge-Kammer,
 *                          Reaktor, Containment, Rechenkern, Teleport,
 *                          Quantenlabor, (geheim) Kältearchiv
 * Ebene +1 Wohnquartiere — Jades & Damiens Quartier, Kantine mit der
 *                          Kaffeemaschine, Gewächshaus, Bibliothek,
 *                          Observatorium, Funkraum
 * Ebene −4 Der Schacht   — versiegelter Förderschacht unter dem Hangar:
 *                          Geröllstollen, X9-DUST-Kammer, Halo-Kristallhöhle,
 *                          C8-BR41Ns Versteck, Bohrung #1
 *
 * Floor ids are stable save-game keys; the display order (top → bottom) is
 * `FLOORS_TOP_DOWN` (+1, 0, −1, −2, −3, −4). `FLOORS[id]` stays valid
 * because the array is sorted by id — prefer `FLOOR_BY_ID[id]`.
 *
 * Coordinates are voxels on each floor's own grid (y = 0 is the slab).
 */
import { tr } from "@/lib/i18n";
import {
  CORE,
  DOOR_PLAN,
  PLAN_DOORS,
  PLAN_NOTES,
  PLAN_ROOMS,
  PLAN_SIZE,
  ROOM_PLAN,
} from "@/lib/world/content/floorplan";
import { SLICE_ITEM } from "@/lib/world/content/items";
import { MATRIX_PROP } from "@/lib/world/matrix/state";
import { REPLICATOR_POWER, REPLICATOR_PROP, WEAR_ITEM_PREFIX } from "@/lib/world/content/wardrobe";
import { buildFloorGeom, geomRoomAt, roomShape, type FloorGeom } from "@/lib/world/floor-geom";
import { shapeBounds, shapeContains } from "@/lib/world/room-shape";
import { C } from "@/lib/world/content/palette";
import type {
  DoorDef,
  ElevatorDef,
  FloorId,
  NoteDef,
  PickupDef,
  PropDef,
  RoomDef,
  RoomTheme,
} from "@/lib/world/types";

export const FLOOR_SIZE = { x: PLAN_SIZE.x, y: 20, z: PLAN_SIZE.z } as const;
export const WALL_HEIGHT = 8;

export interface FloorDef {
  id: FloorId;
  name: string;
  short: string;
  ambient: string;
  /** Display order, top (0) to bottom. */
  order: number;
}

/** All floors, sorted by id so `FLOORS[id]` is the floor with that id. */
export const FLOORS: readonly FloorDef[] = [
  { id: 0, name: tr("Level 0 · Upper Deck"), short: tr("L0"), ambient: "#1b2230", order: 1 },
  {
    id: 1,
    name: tr("Level −1 · Power & Fabrication"),
    short: tr("L−1"),
    ambient: "#221b16",
    order: 2,
  },
  {
    id: 2,
    name: tr("Level −2 · Signals & Anomalies"),
    short: tr("L−2"),
    ambient: "#1a1626",
    order: 3,
  },
  { id: 3, name: tr("Level −3 · Deep Lab"), short: tr("L−3"), ambient: "#120f1c", order: 4 },
  {
    id: 4,
    name: tr("Level +1 · Living Quarters & Observatory"),
    short: tr("L+1"),
    ambient: "#1f2a24",
    order: 0,
  },
  { id: 5, name: tr("Level −4 · The Shaft"), short: tr("L−4"), ambient: "#0d0b12", order: 5 },
];

export const FLOOR_BY_ID: Readonly<Record<FloorId, FloorDef>> = {
  0: FLOORS[0]!,
  1: FLOORS[1]!,
  2: FLOORS[2]!,
  3: FLOORS[3]!,
  4: FLOORS[4]!,
  5: FLOORS[5]!,
};

/** Floors in display order (elevator panel, minimap): +1, 0, −1, −2, −3, −4. */
export const FLOORS_TOP_DOWN: readonly FloorDef[] = [...FLOORS].sort((a, b) => a.order - b.order);

function room(
  id: string,
  floor: FloorId,
  name: string,
  x: number,
  z: number,
  w: number,
  d: number,
  floorColor: number,
  wallColor: number,
  blurb: string,
  extra: Partial<RoomDef> = {},
): RoomDef {
  return { id, floor, name, x, z, w, d, floorColor, wallColor, blurb, ...extra };
}

const RAW_ROOMS: readonly RoomDef[] = [
  // ── Ebene 0 ──────────────────────────────────────────────────
  room(
    "schleuse",
    0,
    tr("Outer Airlock"),
    48,
    12,
    36,
    24,
    C.floor_grate,
    C.wall_olive,
    tr(
      "The outer airlock. The door to the outside has been bolted since 2019. It smells of old filter.",
    ),
    { smoky: true },
  ),
  room(
    "kontroll",
    0,
    tr("Control Room"),
    48,
    36,
    36,
    32,
    C.floor_tile,
    C.wall,
    tr(
      "Jade's Main Console. She sat here on February 14, 2019, at 02:00 UTC. The chair is still warm. That can't be right.",
    ),
  ),
  room(
    "mcp",
    0,
    tr("MCP Chamber"),
    84,
    36,
    28,
    32,
    C.floor_red,
    C.wall_dark,
    tr(
      "The Master Control Program core. 2,561 days of autonomous operation. A red eye that blinks very slowly.",
    ),
  ),
  room(
    "sekundaer",
    0,
    tr("Secondary Station"),
    20,
    36,
    28,
    28,
    C.floor_beige,
    C.wall_beige,
    tr(
      "Damien's monitoring station. Coffee mug, sticky notes, a Synapsis headset with no one wearing it.",
    ),
  ),
  room(
    "westflur",
    0,
    tr("West Corridor"),
    20,
    64,
    28,
    40,
    C.floor_dark,
    C.wall,
    tr("A long corridor. Somewhere a voice is quietly counting days."),
  ),
  room(
    "werkstatt",
    0,
    tr("Workshop"),
    48,
    68,
    36,
    36,
    C.floor_green,
    C.wall_olive,
    tr(
      "Workbenches, vises, half-finished prototypes. “Every device is a question in physical form.”",
    ),
  ),
  room(
    "archiv",
    0,
    tr("Archive"),
    84,
    68,
    28,
    36,
    C.floor_blue,
    C.wall_teal,
    tr("Shelves full of storage media. The Crystal Data Cache is waiting for power."),
  ),
  room(
    "aufzug0",
    0,
    tr("Elevator Shaft"),
    112,
    52,
    16,
    20,
    C.floor_grate,
    C.wall_dark,
    tr("The freight elevator. Next to it, an Emergency Ladder down to Level −1."),
  ),

  // ── Ebene −1 ─────────────────────────────────────────────────
  room(
    "aufzug1",
    1,
    tr("Elevator Shaft"),
    112,
    52,
    16,
    20,
    C.floor_grate,
    C.wall_dark,
    tr("Elevator Shaft, Level −1."),
  ),
  room(
    "versorgung",
    1,
    tr("Utility Corridor"),
    84,
    52,
    28,
    20,
    C.floor_dark,
    C.wall,
    tr("Cable trays along the ceiling. Everything hums a little."),
  ),
  room(
    "geo",
    1,
    tr("Geothermal Shaft"),
    12,
    16,
    36,
    44,
    C.concrete_dark,
    C.concrete,
    tr("The geothermal tap. 847 kW when it runs. The Abstractum Seep Valve is stuck."),
    { litBy: "UEC-001" },
  ),
  room(
    "batterie",
    1,
    tr("Battery Room"),
    48,
    16,
    36,
    36,
    C.floor_tile,
    C.wall_dark,
    tr("Empty battery racks and a power distributor with scorch marks."),
  ),
  room(
    "kuehlung",
    1,
    tr("Cooling"),
    84,
    16,
    28,
    36,
    C.floor_blue,
    C.wall_teal,
    tr("Coolant pipes, frost on the valves."),
  ),
  room(
    "fertigung",
    1,
    tr("Fabrication Hall"),
    48,
    52,
    36,
    52,
    C.floor_grate,
    C.wall_olive,
    tr("The great hall. In the middle, an empty plinth labeled NEXUS."),
  ),
  room(
    "rechen",
    1,
    tr("Data Center"),
    12,
    60,
    36,
    44,
    C.floor_blue,
    C.wall_dark,
    tr("Server cabinets, dark. A single LED blinks: 847 ms on, 847 ms off."),
    { litBy: "CDC-001" },
  ),
  room(
    "lager",
    1,
    tr("Materials Store"),
    84,
    72,
    28,
    32,
    C.floor_beige,
    C.wall_beige,
    tr("Thick smoke. The ventilation has been off for years."),
    { smoky: true },
  ),

  // ── Ebene −2 ─────────────────────────────────────────────────
  room(
    "aufzug2",
    2,
    tr("Elevator Shaft"),
    112,
    52,
    16,
    20,
    C.floor_grate,
    C.wall_dark,
    tr("Elevator Shaft, Level −2."),
  ),
  room(
    "messgang",
    2,
    tr("Measurement Corridor"),
    84,
    52,
    28,
    20,
    C.floor_dark,
    C.wall,
    tr("Measurement logs on the walls, neatly filed."),
  ),
  room(
    "signal",
    2,
    tr("Signal Lab"),
    12,
    16,
    40,
    40,
    C.floor_purple,
    C.wall_dark,
    tr(
      "Speakers, oscilloscopes, a hand-built synthesizer. This is where X0-R8T first answered, in 1988.",
    ),
  ),
  room(
    "anomalie",
    2,
    tr("Anomaly Chamber"),
    52,
    16,
    32,
    36,
    C.floor_forge,
    C.wall_dark,
    tr("The air shimmers. Compression has edges. Edges sing."),
    { litBy: "AND-001" },
  ),
  room(
    "diagnose",
    2,
    tr("Diagnostics Room"),
    52,
    52,
    32,
    20,
    C.floor_tile,
    C.wall,
    tr("Diagnostic desks. An error code has been blinking since 2019."),
  ),
  room(
    "hangar",
    2,
    tr("Drone Hangar"),
    12,
    56,
    40,
    48,
    C.concrete_dark,
    C.concrete,
    tr("Charging bays, rotor blades, a sealed shaft leading down."),
  ),
  room(
    "tresor",
    2,
    tr("Relic Vault"),
    52,
    72,
    32,
    32,
    C.floor_forge,
    C.wall_teal,
    tr("The vault. This is where they kept the things they couldn't explain."),
  ),
  room(
    "botdepot",
    2,
    tr("Bot Depot"),
    84,
    72,
    28,
    32,
    C.floor_grate,
    C.wall_olive,
    tr("Decommissioned bots. Some of them are not quite so decommissioned."),
  ),

  // ── Ebene −3 ─────────────────────────────────────────────────
  room(
    "aufzug3",
    3,
    tr("Elevator Shaft"),
    112,
    52,
    16,
    20,
    C.floor_grate,
    C.wall_dark,
    tr("Elevator Shaft, Level −3. Deep Lab Level 3."),
  ),
  room(
    "vorraum",
    3,
    tr("Pressure Antechamber"),
    88,
    52,
    24,
    20,
    C.floor_dark,
    C.wall_dark,
    tr("Pressure lock. The warning sign is covered in ice."),
  ),
  room(
    "forge",
    3,
    tr("Infinity Forge Chamber"),
    40,
    36,
    48,
    52,
    C.floor_forge,
    C.wall_dark,
    tr("The Infinity Forge. Two Synapsis stations, empty. The field is off. Or it's waiting."),
  ),
  room(
    "reaktor",
    3,
    tr("Reactor Room"),
    12,
    16,
    28,
    44,
    C.concrete_dark,
    C.wall_olive,
    tr("An empty reactor plinth with magnetic rings."),
  ),
  room(
    "containment",
    3,
    tr("room::Containment"),
    88,
    16,
    24,
    36,
    C.floor_purple,
    C.wall_teal,
    tr("Containment fields. Something in there used to glow."),
  ),
  room(
    "rechenkern",
    3,
    tr("Compute Core"),
    12,
    60,
    28,
    44,
    C.floor_blue,
    C.wall_dark,
    tr("Room for a supercomputer. And for something that thinks."),
  ),
  room(
    "teleport",
    3,
    tr("Teleport Platform"),
    88,
    72,
    24,
    32,
    C.floor_forge,
    C.wall_dark,
    tr("A circular plinth. HaloRider prototype, 2017."),
  ),
  room(
    "quanten",
    3,
    tr("Quantum Lab"),
    40,
    88,
    48,
    16,
    C.floor_blue,
    C.wall_teal,
    tr("Cryostats, 0.015 K. The qubits don't forget."),
  ),
  room(
    "kaeltearchiv",
    3,
    tr("Cold Archive (secret)"),
    40,
    12,
    48,
    24,
    C.floor_blue,
    C.wall_dark,
    tr(
      "Behind the Forge's north wall: a room no plan shows. Frost on the shelves, a Cryo capsule labeled X9-H4L0. Your breath freezes before it leaves your mouth.",
    ),
    { theme: "cryo" },
  ),

  // ── Ebene 0 (geheim) ─────────────────────────────────────────
  room(
    "kartenraum",
    0,
    tr("Damien's Map Room (secret)"),
    84,
    12,
    28,
    24,
    C.floor_beige,
    C.wall_olive,
    tr(
      "A room behind the MCP Chamber that the scanner reported as a cavity. A map table, thumbtacks, red threads between levels that appear on no official plan.",
    ),
    { theme: "office" },
  ),

  // ── Ebene +1 · Wohnquartiere & Observatorium ─────────────────
  room(
    "aufzug4",
    4,
    tr("Elevator Shaft"),
    112,
    52,
    16,
    20,
    C.floor_grate,
    C.wall_dark,
    tr(
      "Elevator Shaft, Level +1. Someone has taped a calendar to the door. It shows February 2019.",
    ),
  ),
  room(
    "wohnflur",
    4,
    tr("Residential Corridor"),
    84,
    52,
    28,
    20,
    C.carpet_red,
    C.wall_beige,
    tr(
      "Carpet that smells of dust and cinnamon. Two name plates: “J. Lawrence” and “D. Fridge — please knock, I'm thinking”.",
    ),
  ),
  room(
    "jadeq",
    4,
    tr("Jade's Quarters"),
    84,
    20,
    28,
    32,
    C.carpet_blue,
    C.wall_teal,
    tr(
      "My room. A made bed nobody has slept in. Stacks of notebooks, sorted by color. On the nightstand a mug — the coffee in it has turned into a crust from 2019.",
    ),
  ),
  room(
    "damienq",
    4,
    tr("Damien's Quarters"),
    56,
    20,
    28,
    32,
    C.carpet_green,
    C.wall_olive,
    tr(
      "Chaos with a system. Legal pads, numbered 1 to 17. An old grandfather clock missing a gear. A radio direction finder on the desk, still tuned to a frequency nobody transmits on any more.",
    ),
  ),
  room(
    "kantine",
    4,
    tr("Kitchen & Canteen"),
    84,
    72,
    28,
    32,
    C.tile_white,
    C.wall_beige,
    tr(
      "Long tables, two chairs that look used and forty that don't. In the corner: the coffee machine. Its cable doesn't go into the socket but into the wall — to the singularity bus.",
    ),
  ),
  room(
    "bibliothek",
    4,
    tr("Library"),
    56,
    52,
    28,
    52,
    C.floor_beige,
    C.wall_beige,
    tr(
      "Bookshelves up to the ceiling: Dawkins, Chalmers, Turing, poetry, three cookbooks (all lentils). A reading desk with a hollow, as if the same small notebook had lain there for years.",
    ),
  ),
  room(
    "gewaechshaus",
    4,
    tr("Greenhouse"),
    24,
    52,
    32,
    52,
    C.floor_green,
    C.wall_teal,
    tr(
      "Warm and humid. Glow Algae in basins, Mycelium along the cable trays, a coffee shrub with a sign: “Control group”. Seven years without people — and everything is alive. Somebody has been watering.",
    ),
  ),
  room(
    "observatorium",
    4,
    tr("Observatory"),
    24,
    12,
    32,
    40,
    C.floor_dark,
    C.wall_dark,
    tr(
      "A dome of steel segments, beneath it a telescope and an antenna array. The dome is closed. A strip of starlight falls through a gap — or something pretending to be starlight.",
    ),
    { litBy: "OSC-001" },
  ),
  room(
    "funkraum",
    4,
    tr("Radio Room"),
    24,
    104,
    32,
    14,
    C.floor_purple,
    C.wall_dark,
    tr(
      "A narrow room full of receivers, tape machines and headphones. On the wall, in chalk: “. _ . . _ _ _ . . . _ . _ _”.",
    ),
  ),

  // ── Ebene −4 · Der Schacht ───────────────────────────────────
  room(
    "aufzug5",
    5,
    tr("Emergency Elevator"),
    112,
    52,
    16,
    20,
    C.floor_grate,
    C.wall_dark,
    tr("The old mine cage. The chain groans. Beneath the grating: darkness that doesn't stop."),
  ),
  room(
    "sohle",
    5,
    tr("Shaft Bottom"),
    84,
    44,
    28,
    36,
    C.concrete_dark,
    C.concrete,
    tr(
      "The bottom of the sealed shaft. Rubble, chalk marks on the walls, the air tastes of metal. Something is always trickling somewhere.",
    ),
  ),
  room(
    "x9kammer",
    5,
    tr("X9-DUST Chamber"),
    84,
    16,
    28,
    28,
    C.floor_forge,
    C.wall_dark,
    tr(
      "The chamber where Jade stored X9-DUST. Glittering dust hangs in the air and never settles. Under a microscope you would read: THE HALO EXPANDS.",
    ),
    { smoky: true },
  ),
  room(
    "stollen",
    5,
    tr("Rubble Tunnel"),
    40,
    52,
    44,
    16,
    C.asphalt,
    C.concrete,
    tr(
      "A half-buried tunnel. Miner's lamps, a mine cart on bent rails. The walls are warm — the borehole is close.",
    ),
  ),
  room(
    "hoehle",
    5,
    tr("Halo Crystal Cave"),
    40,
    68,
    44,
    40,
    C.floor_purple,
    C.wall_teal,
    tr(
      "A cave of grown crystal. Every shard casts two shadows. The membrane to the Halo is thin here — you don't hear it, you hear it listening.",
    ),
    { litBy: "AND-001" },
  ),
  room(
    "c8versteck",
    5,
    tr("C8-BR41N's Hideout"),
    12,
    36,
    28,
    32,
    C.floor_blue,
    C.wall_dark,
    tr(
      "An improvised server room behind the rubble: heat sinks, cables from three decades, a terminal with one line that keeps reappearing: [EXTERNAL].",
    ),
  ),
  room(
    "truemmer",
    5,
    tr("Collapse Site"),
    12,
    68,
    28,
    40,
    C.concrete_dark,
    C.wall_olive,
    tr(
      "This is where the old mine shaft collapsed in 2009. The ceiling hangs crooked. Between the chunks: parts of sixth-generation bots.",
    ),
  ),
  room(
    "bohrung",
    5,
    tr("Borehole #1"),
    84,
    80,
    28,
    28,
    C.concrete_dark,
    C.wall_dark,
    tr(
      "The first geothermal borehole from 1997, sealed. A drill head the size of a car. 847 meters below, the rock is boiling.",
    ),
  ),
];

const ROOM_THEMES: Record<string, RoomTheme> = {
  schleuse: "airlock",
  kontroll: "control",
  mcp: "server",
  sekundaer: "office",
  westflur: "corridor",
  werkstatt: "workshop",
  archiv: "archive",
  aufzug0: "elevator",
  aufzug1: "elevator",
  aufzug2: "elevator",
  aufzug3: "elevator",
  versorgung: "corridor",
  geo: "geothermal",
  batterie: "power",
  kuehlung: "cooling",
  fertigung: "factory",
  rechen: "server",
  lager: "storage",
  messgang: "corridor",
  signal: "audio",
  anomalie: "anomaly",
  diagnose: "lab",
  hangar: "hangar",
  tresor: "vault",
  botdepot: "botdepot",
  vorraum: "airlock",
  forge: "forge",
  reaktor: "reactor",
  containment: "containment",
  rechenkern: "server",
  teleport: "portal",
  quanten: "cryo",
  aufzug4: "elevator",
  wohnflur: "corridor",
  jadeq: "quarters",
  damienq: "quarters",
  kantine: "quarters",
  bibliothek: "archive",
  gewaechshaus: "greenhouse",
  observatorium: "observatory",
  funkraum: "audio",
  aufzug5: "elevator",
  sohle: "storage",
  x9kammer: "vault",
  stollen: "corridor",
  hoehle: "anomaly",
  c8versteck: "server",
  truemmer: "storage",
  bohrung: "geothermal",
};

const RAW_BY_ID: ReadonlyMap<string, RoomDef> = new Map(RAW_ROOMS.map((r) => [r.id, r]));

/**
 * The design grid: every room's rectangle (and every door) as the content is
 * authored — the original rectangular plan before floorplan.ts moved and
 * shaped the rooms. For docs and tests only; the game uses ROOMS / DOORS.
 */
export const DESIGN_ROOMS: readonly RoomDef[] = RAW_ROOMS;

/**
 * How far a room's content moved from its design rectangle to its place on
 * the floor plan (floorplan.ts). Everything authored inside the room moves
 * by the same delta.
 */
export function roomDelta(id: string): [number, number] {
  const p = ROOM_PLAN[id];
  const r = RAW_BY_ID.get(id);
  if (!p || !r) return [0, 0];
  return [p.at[0] - r.x, p.at[1] - r.z];
}

/** Bounding box of a shaped room (x/z/w/d = its wall lines). */
function withBounds(r: RoomDef): RoomDef {
  if (!r.shape) return r;
  const b = shapeBounds(r.shape);
  return { ...r, x: b.x0, z: b.z0, w: b.x1 - b.x0, d: b.z1 - b.z0 };
}

function planRoom(r: RoomDef): RoomDef {
  const p = ROOM_PLAN[r.id];
  if (!p) return r;
  const box = { x: p.at[0], z: p.at[1], w: r.w, d: r.d };
  const shape = p.shape?.(box);
  return withBounds({ ...r, ...p.patch, x: box.x, z: box.z, ...(shape ? { shape } : {}) });
}

export const ROOMS: readonly RoomDef[] = [
  ...RAW_ROOMS.map((r) => planRoom({ ...r, theme: r.theme ?? ROOM_THEMES[r.id] ?? "generic" })),
  ...PLAN_ROOMS.map(withBounds),
];

/**
 * Move a point authored on the legacy grid onto the floor plan: the design
 * rectangle containing it decides the delta (interior first, then walls).
 */
export function relocateAt(
  floor: FloorId,
  x: number,
  z: number,
): { room?: string; x: number; z: number } {
  let hit: RoomDef | undefined;
  for (const r of RAW_ROOMS) {
    if (r.floor !== floor) continue;
    const inside = x > r.x && x < r.x + r.w && z > r.z && z < r.z + r.d;
    const onWall = x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d;
    if (inside) {
      hit = r;
      break;
    }
    if (onWall && !hit) hit = r;
  }
  if (!hit) return { x, z };
  const [dx, dz] = roomDelta(hit.id);
  return { room: hit.id, x: x + dx, z: z + dz };
}

/**
 * Keep a small thing inside its (possibly round or cut) room: if the cells
 * within `reach` of (x, z) are not all interior, the nearest spot that is
 * (spiral search) wins. Large, central things never need it.
 */
export function fitInRoom(
  roomId: string,
  x: number,
  z: number,
  reach = 1,
): { x: number; z: number } {
  const r = ROOMS.find((q) => q.id === roomId);
  if (!r?.shape) return { x, z };
  const shape = roomShape(r);
  const ok = (cx: number, cz: number) => {
    for (let dz = -reach; dz <= reach; dz++)
      for (let dx = -reach; dx <= reach; dx++)
        if (!shapeContains(shape, cx + dx, cz + dz)) return false;
    return true;
  };
  const x0 = Math.round(x);
  const z0 = Math.round(z);
  if (ok(x0, z0)) return { x, z };
  for (let rad = 1; rad <= 24; rad++)
    for (let dz = -rad; dz <= rad; dz++)
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== rad) continue;
        if (ok(x0 + dx, z0 + dz)) return { x: x + dx, z: z + dz };
      }
  return { x, z };
}

/** Relocate + fit a floor-positioned thing (props, pickups, notes, NPCs). */
export function planPoint<T extends { floor: FloorId; x: number; z: number }>(t: T, reach = 1): T {
  const m = relocateAt(t.floor, t.x, t.z);
  const f = m.room ? fitInRoom(m.room, m.x, m.z, reach) : m;
  return { ...t, x: f.x, z: f.z };
}

export const ROOM_BY_ID: ReadonlyMap<string, RoomDef> = new Map(ROOMS.map((r) => [r.id, r]));

function door(
  id: string,
  floor: FloorId,
  x: number,
  z: number,
  axis: "x" | "z",
  extra: Partial<DoorDef> = {},
): DoorDef {
  return { id, floor, x, z, axis, width: 5, ...extra };
}

const RAW_DOORS: readonly DoorDef[] = [
  // Ebene 0
  door("d_schleuse", 0, 66, 36, "x"),
  door("d_mcp", 0, 84, 52, "z"),
  door("d_sekundaer", 0, 48, 50, "z"),
  door("d_westflur", 0, 34, 64, "x"),
  door("d_werkstatt", 0, 66, 68, "x"),
  door("d_westwerk", 0, 48, 86, "z"),
  door("d_archiv", 0, 84, 86, "z", {
    lock: { any: [{ power: 50 }, { device: "BTK-001", state: "built" }] },
    lockHint: tr(
      "Electric door, no power. Open it with power — or pry it open with the Basic Toolkit.",
    ),
  }),
  door("d_aufzug0", 0, 112, 62, "z"),
  // Ebene −1
  door("d_aufzug1", 1, 112, 62, "z"),
  door("d_fertigung", 1, 84, 62, "z"),
  door("d_kuehlung", 1, 98, 52, "x"),
  door("d_lager", 1, 98, 72, "x"),
  door("d_batterie", 1, 66, 52, "x"),
  door("d_geo", 1, 48, 34, "z"),
  door("d_rechen", 1, 30, 60, "x", {
    lock: { any: [{ power: 50 }, { device: "BTK-001", state: "built" }] },
    lockHint: tr("Server room door, electrically locked. Power or a pry tool."),
  }),
  door("d_rechenfert", 1, 48, 82, "z"),
  door("d_kuehlbatt", 1, 84, 34, "z"),
  // Ebene −2
  door("d_aufzug2", 2, 112, 62, "z"),
  door("d_diagnose", 2, 84, 62, "z"),
  door("d_anomalie", 2, 68, 52, "x", {
    lock: { any: [{ device: "DGN-001" }, { power: 200 }] },
    lockHint: tr(
      "Radiation bulkhead. Only opens when the Diagnostics Room gives the green light — or when there's enough power for the shielding (200 W).",
    ),
  }),
  door("d_signal", 2, 32, 56, "x"),
  door("d_hangar", 2, 52, 64, "z"),
  door("d_anosig", 2, 52, 34, "z"),
  door("d_tresor", 2, 68, 72, "x", {
    keypad: "pz_keypad_tresor",
    lockHint: tr("Keypad. Four digits."),
  }),
  door("d_botdepot", 2, 98, 72, "x"),
  // Ebene −3
  door("d_aufzug3", 3, 112, 62, "z"),
  door("d_forge", 3, 88, 62, "z"),
  door("d_containment", 3, 100, 52, "x", {
    lock: { any: [{ device: "MFR-001" }, { device: "LCT-001" }] },
    lockHint: tr(
      "Containment bulkhead. Needs reactor power — or a precision laser to cut the bolts.",
    ),
  }),
  door("d_teleport", 3, 100, 72, "x", {
    lock: { any: [{ device: "NET-001" }, { device: "LCT-001" }] },
    lockHint: tr("Network-controlled door. Network Monitor (NET-001) online — or cut it open."),
  }),
  door("d_reaktor", 3, 40, 48, "z"),
  door("d_rechenkern", 3, 40, 76, "z"),
  door("d_quanten", 3, 64, 88, "x"),
  door("d_kaeltearchiv", 3, 64, 36, "x", {
    secret: true,
    lock: { any: [{ device: "MSC-001" }, { device: "LCT-001" }] },
    lockHint: tr(
      "A smooth wall. The Material Scanner (MSC-001) would find a cavity here — or the precision laser cuts it free.",
    ),
  }),
  // Ebene 0 (geheim)
  door("d_kartenraum", 0, 98, 36, "x", {
    secret: true,
    lock: { any: [{ device: "MSC-001" }, { device: "LCT-001" }] },
    lockHint: tr(
      "The north wall of the MCP Chamber sounds hollow. A scan (MSC-001) or a laser cut (LCT-001) would show it.",
    ),
  }),
  // Ebene +1
  door("d_aufzug4", 4, 112, 62, "z"),
  door("d_jadeq", 4, 98, 52, "x"),
  door("d_kantine", 4, 98, 72, "x"),
  door("d_bibliothek", 4, 84, 62, "z"),
  door("d_kantbib", 4, 84, 88, "z"),
  door("d_damienq", 4, 70, 52, "x", {
    lock: { any: [{ puzzle: "pz_sigils" }, { device: "LCT-001" }] },
    lockHint: tr(
      "Damien's door has a sigil lock — the same counterpoint logic as the board in his Secondary Station (Level 0). Or you cut it open.",
    ),
  }),
  door("d_gewaechshaus", 4, 56, 78, "z"),
  door("d_observatorium", 4, 40, 52, "x", {
    lock: { power: 200 },
    lockHint: tr("The dome hydraulics need 200 W before the bulkhead to the Observatory opens."),
  }),
  door("d_funkraum", 4, 40, 104, "x", {
    lock: { device: "NET-001" },
    lockHint: tr(
      "Network-controlled bulkhead. Without the Network Monitor (NET-001) the Radio Room stays shut.",
    ),
  }),
  // Ebene −4
  door("d_aufzug5", 5, 112, 62, "z"),
  door("d_x9kammer", 5, 98, 44, "x", {
    lock: { any: [{ device: "MSC-001" }, { device: "LCT-001" }] },
    lockHint: tr(
      "A welded seal: “X9-DUST — do not open, do not forget”. The scanner finds the bolts, the laser cuts them.",
    ),
  }),
  door("d_stollen", 5, 84, 60, "z"),
  door("d_hoehle", 5, 62, 68, "x", {
    lock: { any: [{ device: "AND-001" }, { device: "DIM-001" }] },
    lockHint: tr(
      "A curtain of crystal blocks the passage. It vibrates. Without the Anomaly Detector (AND-001) you can't tell where it gives way.",
    ),
  }),
  door("d_c8versteck", 5, 40, 60, "z", {
    secret: true,
    lock: { any: [{ device: "MSC-001" }, { device: "LCT-001" }] },
    lockHint: tr("Something hums behind the rubble. A scan (MSC-001) shows the passage."),
  }),
  door("d_truemmer", 5, 40, 90, "z"),
  door("d_bohrung", 5, 98, 80, "x"),
];

/** Doors on the design grid (see DESIGN_ROOMS). */
export const DESIGN_DOORS: readonly DoorDef[] = RAW_DOORS;

export const DOORS: readonly DoorDef[] = [
  ...RAW_DOORS.map((d) => ({ ...d, ...DOOR_PLAN[d.id] })),
  ...PLAN_DOORS,
];

/** The elevator runs through the middle of every level's core. */
export const ELEVATORS: readonly ElevatorDef[] = [0, 1, 2, 3, 4, 5].map((f) => ({
  floor: f as FloorId,
  x: CORE.x,
  z: CORE.z,
}));

const RAW_SPAWN = planPoint({ floor: 0 as FloorId, x: 66, z: 58 }, 2);

export const SPAWN: { floor: FloorId; pos: [number, number, number] } = {
  floor: 0,
  pos: [RAW_SPAWN.x, 1, RAW_SPAWN.z],
};

function pk(
  id: string,
  floor: FloorId,
  x: number,
  z: number,
  model: PickupDef["model"],
  label: string,
  items: [string, number][],
  extra: Partial<PickupDef> = {},
): PickupDef {
  return {
    id,
    floor,
    x,
    z,
    model,
    label,
    items: items.map(([item, count]) => ({ item, count })),
    ...extra,
  };
}

/**
 * Optional side caches (puzzles.ts `pz_side_*`). Their maintenance locks
 * only come alive once the floor's mid-game system runs: the Nexus hands
 * out maintenance clearance on the upper decks, the Explorer Drone maps
 * the caches on −2 and +1, the AI core releases the deep locks on −3. The
 * shaft (−4) is late enough on its own.
 */
export const SIDE_CACHE_GATE: Readonly<Partial<Record<FloorId, { device: string }>>> = {
  0: { device: "NXS-01" },
  1: { device: "NXS-01" },
  2: { device: "EXD-001" },
  3: { device: "AIC-001" },
  4: { device: "EXD-001" },
};

function side(
  id: string,
  floor: FloorId,
  x: number,
  z: number,
  model: PickupDef["model"],
  label: string,
  items: [string, number][],
): PickupDef {
  const gate = SIDE_CACHE_GATE[floor];
  return pk(`p_side_${id}`, floor, x, z, model, label, items, {
    puzzle: `pz_side_${id}`,
    ...(gate ? { hidden: gate } : {}),
  });
}

const RAW_PICKUPS: readonly PickupDef[] = [
  // Ebene 0
  pk("p_kontroll_regal", 0, 52, 62, "shelf", tr("Shelf"), [
    ["schraubensatz", 2],
    ["kabelbaum", 1],
  ]),
  pk("p_kontroll_kiste", 0, 80, 64, "crate", tr("Crate"), [
    ["gehaeuseplatte", 2],
    ["kondensator", 1],
  ]),
  pk("p_sekundaer_schublade", 0, 26, 42, "locker", tr("Damien's Drawer"), [
    ["quarzkristall", 1],
    ["platine", 1],
    ["membran", 1],
  ]),
  pk(
    "p_werk_schrott",
    0,
    78,
    100,
    "scrap",
    tr("Scrap Heap"),
    [
      ["schraubensatz", 2],
      ["servo", 1],
      ["zahnrad", 1],
    ],
    { tool: "BTK-001" },
  ),
  pk("p_werk_spind", 0, 52, 74, "locker", tr("Tool Locker"), [
    ["schraubendreher", 1],
    ["luefter", 1],
    ["kupferspule", 2],
    ["stoffreste", 1],
  ]),
  pk("p_werk_kiste", 0, 80, 74, "crate", tr("Materials Crate"), [
    ["gehaeuseplatte", 2],
    ["magnet", 1],
  ]),
  pk("p_werk_tonne", 0, 60, 100, "scrap", tr("Scrap Container (refills)"), [["schraubensatz", 1]], {
    respawn: 60,
    poolCount: 3,
    pool: [
      "schraubensatz",
      "gehaeuseplatte",
      "kabelbaum",
      "magnet",
      "kupferspule",
      "kondensator",
      "zahnrad",
      "servo",
      "platine",
      "luefter",
      "speicherchip",
      "batteriezelle",
    ],
  }),
  pk("p_archiv_regal", 0, 108, 96, "shelf", tr("Storage Media Shelf"), [
    ["speicherchip", 2],
    ["display", 1],
    ["platine", 1],
  ]),
  pk("p_archiv_kristall", 0, 90, 98, "crystal", tr("Crystal Display Case"), [["kristall_0089", 1]]),
  pk("p_westflur_kanister", 0, 24, 100, "canister", tr("Battery Canister"), [["batteriezelle", 2]]),
  pk(
    "p_westflur_schrott",
    0,
    42,
    70,
    "scrap",
    tr("E-Waste"),
    [
      ["kabelbaum", 1],
      ["kondensator", 1],
      ["zahnrad", 1],
    ],
    { tool: "BTK-001" },
  ),
  pk(
    "p_schleuse_spind",
    0,
    52,
    16,
    "locker",
    tr("Filter Locker"),
    [
      ["filterpatrone", 2],
      ["luefter", 1],
    ],
    { hidden: { device: "VNT-001" } },
  ),
  pk(
    "p_schleuse_notfall",
    0,
    80,
    16,
    "locker",
    tr("Emergency Locker (keypad)"),
    [
      ["x0r8t_paket", 1],
      ["antenne", 1],
    ],
    { puzzle: "pz_keypad_schleuse" },
  ),
  pk("p_schleuse_boden", 0, 72, 30, "crate", tr("Overturned Crate"), [
    ["filterpatrone", 1],
    ["kabelbaum", 1],
    ["polymerfaser", 1],
  ]),
  pk("p_mcp_kiste", 0, 90, 64, "crate", tr("Spare Parts Crate"), [
    ["kondensator", 2],
    ["platine", 1],
  ]),

  // Ebene −1
  pk("p_geo_seep", 1, 20, 24, "seep", tr("Abstractum Seep"), [["abstractum", 12]], {
    hidden: { flag: "seep_open" },
    respawn: 25,
  }),
  pk(
    "p_geo_schrott",
    1,
    40,
    54,
    "scrap",
    tr("Pipe Scrap"),
    [
      ["kupferspule", 1],
      ["magnet", 1],
      ["gehaeuseplatte", 1],
    ],
    { tool: "BTK-001" },
  ),
  pk(
    "p_batt_kanister",
    1,
    52,
    20,
    "canister",
    tr("Cell Canister (recharges)"),
    [["batteriezelle", 3]],
    {
      respawn: 180,
    },
  ),
  pk("p_batt_regal", 1, 80, 48, "shelf", tr("Spare Parts Shelf"), [
    ["kondensator", 2],
    ["kabelbaum", 2],
  ]),
  pk("p_kuehl_kiste", 1, 106, 20, "crate", tr("Cooling Parts"), [
    ["kuehlrippe", 2],
    ["luefter", 2],
    ["thermoelement", 1],
    ["polymerfaser", 1],
  ]),
  pk(
    "p_fert_schrott",
    1,
    52,
    58,
    "scrap",
    tr("Fabrication Scrap"),
    [
      ["servo", 2],
      ["duese", 1],
      ["schraubensatz", 3],
    ],
    { tool: "BTK-001" },
  ),
  pk("p_fert_kiste", 1, 80, 58, "crate", tr("Ingot Crate"), [
    ["basislegierung", 2],
    ["gehaeuseplatte", 2],
  ]),
  pk(
    "p_fert_container",
    1,
    80,
    100,
    "scrap",
    tr("Recycling Container (refills)"),
    [["schraubensatz", 1]],
    {
      respawn: 75,
      poolCount: 3,
      pool: [
        "schraubensatz",
        "gehaeuseplatte",
        "speicherchip",
        "platine",
        "display",
        "kabelbaum",
        "magnet",
        "sensorkopf",
        "thermoelement",
        "kuehlrippe",
        "glasfaser",
        "oszillator",
        "luefter",
        "duese",
      ],
    },
  ),
  pk("p_rechen_regal", 1, 42, 100, "shelf", tr("Server Parts"), [
    ["speicherchip", 2],
    ["platine", 2],
    ["glasfaser", 1],
  ]),
  pk("p_rechen_kiste", 1, 16, 84, "crate", tr("Sensor Crate"), [
    ["sensorkopf", 1],
    ["antenne", 1],
  ]),
  pk(
    "p_lager_kiste",
    1,
    90,
    78,
    "crate",
    tr("Optics Crate"),
    [
      ["basislegierung", 3],
      ["linse", 2],
      ["prisma", 1],
    ],
    { hidden: { device: "VNT-001" } },
  ),
  pk(
    "p_lager_schrott",
    1,
    106,
    100,
    "scrap",
    tr("Drone Parts"),
    [
      ["rotor", 2],
      ["zahnrad", 1],
    ],
    { hidden: { device: "VNT-001" } },
  ),
  pk(
    "p_lager_luefter",
    1,
    108,
    76,
    "locker",
    tr("Ventilation Grille (magnetic)"),
    [
      ["qubit_chip", 1],
      ["supraleiter", 1],
    ],
    { hidden: { device: "RMG-001" } },
  ),

  // Ebene −2
  pk("p_signal_regal", 2, 16, 20, "shelf", tr("Component Shelf"), [
    ["oszillator", 2],
    ["membran", 1],
    ["quarzkristall", 1],
  ]),
  pk("p_signal_kiste", 2, 48, 20, "crate", tr("Antenna Crate"), [
    ["antenne", 2],
    ["sensorkopf", 1],
  ]),
  pk("p_anomalie_staub", 2, 80, 20, "crystal", tr("Glittering Dust"), [["halo_staub", 1]], {
    hidden: { device: "AND-001" },
  }),
  pk("p_anomalie_schrott", 2, 56, 20, "scrap", tr("Bent Coils"), [
    ["magnet", 1],
    ["supraleiter", 1],
  ]),
  pk("p_anomalie_rest", 2, 76, 26, "crystal", tr("Anomaly Residue"), [["exotische_materie", 2]], {
    hidden: { device: "AND-001" },
    respawn: 300,
  }),
  pk("p_hangar_kiste", 2, 16, 100, "crate", tr("Drone Crate"), [
    ["rotor", 4],
    ["servo", 2],
    ["antenne", 1],
  ]),
  pk("p_hangar_kanister", 2, 46, 100, "canister", tr("Batteries"), [["batteriezelle", 2]]),
  pk("p_diag_regal", 2, 80, 68, "shelf", tr("Diagnostic Parts"), [
    ["display", 2],
    ["platine", 1],
    ["glasfaser", 2],
  ]),
  pk("p_tresor_1", 2, 58, 98, "crystal", tr("Relic Display Case"), [["synapsis_splitter", 1]]),
  pk("p_tresor_2", 2, 78, 98, "locker", tr("Tape Archive"), [
    ["damien_band", 1],
    ["prisma", 1],
  ]),
  pk("p_tresor_3", 2, 68, 84, "crate", tr("Optics Reserve"), [
    ["linse", 2],
    ["laserdiode", 1],
  ]),
  pk(
    "p_bot_schrott",
    2,
    104,
    100,
    "scrap",
    tr("Bot Parts"),
    [
      ["sensorkopf", 1],
      ["servo", 1],
      ["speicherchip", 1],
    ],
    { tool: "BTK-001" },
  ),
  pk("p_bot_recycling", 2, 108, 78, "scrap", tr("Bot Recycler (refills)"), [["antenne", 1]], {
    respawn: 90,
    poolCount: 3,
    pool: [
      "antenne",
      "sensorkopf",
      "oszillator",
      "membran",
      "quarzkristall",
      "laserdiode",
      "linse",
      "prisma",
      "rotor",
      "servo",
      "speicherchip",
      "magnet",
    ],
  }),
  pk("p_bot_kiste", 2, 88, 100, "crate", tr("Laser Crate"), [
    ["laserdiode", 2],
    ["linse", 1],
  ]),

  // Ebene −3
  pk("p_reaktor_kanister", 3, 16, 20, "canister", tr("Plasma Rings"), [["plasmaring", 2]]),
  pk("p_reaktor_kiste", 3, 34, 56, "crate", tr("Alloy Crate"), [
    ["hochlegierung", 2],
    ["supraleiter", 1],
  ]),
  pk("p_cont_kristall", 3, 108, 20, "crystal", tr("Cryo Sample"), [["qubit_chip", 1]], {
    hidden: { device: "MSC-001" },
  }),
  pk("p_cont_kiste", 3, 92, 46, "crate", tr("Cooling Crate"), [
    ["thermoelement", 1],
    ["kuehlrippe", 2],
  ]),
  pk("p_forge_station", 3, 52, 50, "locker", tr("Jade's Synapsis Station"), [
    ["synapsis_splitter", 1],
  ]),
  pk(
    "p_forge_schrott",
    3,
    80,
    80,
    "scrap",
    tr("Forge Debris"),
    [
      ["glasfaser", 2],
      ["laserdiode", 1],
    ],
    { tool: "BTK-001" },
  ),
  pk(
    "p_forge_rest",
    3,
    64,
    44,
    "crystal",
    tr("White-Gold Residue"),
    [
      ["exotische_materie", 2],
      ["antimaterie", 1],
    ],
    { hidden: { device: "AND-001" } },
  ),
  pk(
    "p_forge_recycling",
    3,
    84,
    40,
    "canister",
    tr("Forge Reclamation (refills)"),
    [["supraleiter", 1]],
    {
      respawn: 150,
      poolCount: 2,
      pool: [
        "supraleiter",
        "qubit_chip",
        "plasmaring",
        "hochlegierung",
        "glasfaser",
        "linse",
        "kuehlrippe",
        "steuermodul",
        "platine",
      ],
    },
  ),
  pk("p_rkern_regal", 3, 36, 100, "shelf", tr("Memory Banks"), [
    ["speicherchip", 3],
    ["qubit_chip", 1],
  ]),
  pk("p_tele_kiste", 3, 92, 100, "crate", tr("HaloRider Parts"), [
    ["supraleiter", 2],
    ["plasmaring", 1],
  ]),
  pk("p_quanten_kiste", 3, 44, 100, "crate", tr("Cryo Crate"), [
    ["qubit_chip", 2],
    ["nanomaterial", 1],
  ]),
  pk(
    "p_quanten_anti",
    3,
    84,
    92,
    "canister",
    tr("Magnetic Trap (recharges)"),
    [["antimaterie", 1]],
    {
      hidden: { device: "EMC-001" },
      respawn: 240,
    },
  ),
  pk("p_kaelte_kryo", 3, 56, 20, "locker", tr("Cryo Cabinet “H4L0”"), [
    ["supraleiter", 2],
    ["qubit_chip", 1],
  ]),

  // Ebene 0 (geheim)
  pk("p_karten_faecher", 0, 92, 18, "crate", tr("Map Table Compartments"), [
    ["glasfaser", 1],
    ["sensorkopf", 1],
    ["quarzkristall", 1],
  ]),

  // Ebene +1
  pk("p_jadeq_spind", 4, 103, 28, "locker", tr("Jade's Locker"), [
    ["linse", 1],
    ["display", 1],
    ["filterpatrone", 1],
    ["stoffreste", 2],
    ["farbpigment", 1],
  ]),
  pk("p_damienq_schublade", 4, 80, 46, "locker", tr("Damien's Desk Drawer"), [
    ["notizbuch_blau", 1],
    ["platine", 1],
    ["stoffreste", 1],
  ]),
  pk("p_kantine_vorrat", 4, 108, 76, "shelf", tr("Pantry"), [
    ["kaffeebohnen", 2],
    ["thermoelement", 1],
  ]),
  pk(
    "p_kantine_kuehl",
    4,
    88,
    100,
    "canister",
    tr("Refrigerator (refills)"),
    [["leuchtalgen", 1]],
    {
      respawn: 120,
      poolCount: 2,
      pool: ["leuchtalgen", "kaffeebohnen", "batteriezelle", "kuehlrippe", "luefter", "myzel"],
    },
  ),
  pk("p_gewaechs_algen", 4, 28, 58, "seep", tr("Algae Basin"), [["leuchtalgen", 2]], {
    respawn: 90,
  }),
  pk("p_gewaechs_myzel", 4, 52, 62, "scrap", tr("Mycelium Wall"), [["myzel", 1]], { respawn: 120 }),
  pk(
    "p_gewaechs_kaffee",
    4,
    36,
    92,
    "crate",
    tr("Coffee Shrub “Control group”"),
    [["kaffeebohnen", 3]],
    { respawn: 240 },
  ),
  pk("p_biblio_regal", 4, 80, 96, "shelf", tr("Bookshelf (storage media)"), [
    ["speicherchip", 2],
    ["display", 1],
    ["glasfaser", 1],
  ]),
  pk("p_observ_kiste", 4, 28, 16, "crate", tr("Telescope Spare Parts"), [
    ["linse", 2],
    ["prisma", 1],
    ["servo", 1],
  ]),
  pk("p_observ_karte", 4, 46, 22, "locker", tr("Chart Drawer (D3-C4D3)"), [["sternkarte", 1]], {
    hidden: { flag: "bot_d3c4d3_awake" },
  }),
  pk("p_funk_teile", 4, 52, 108, "shelf", tr("Radio Parts"), [
    ["antenne", 2],
    ["oszillator", 1],
    ["kupferspule", 1],
  ]),
  pk("p_funk_band", 4, 30, 108, "locker", tr("Tape Shelf"), [["tonband_frequenz", 1]], {
    hidden: { device: "ECR-001" },
  }),

  // Ebene −4
  pk("p_sohle_geroell", 5, 92, 70, "scrap", tr("Rubble Heap (keeps sliding)"), [["geroell", 3]], {
    respawn: 60,
  }),
  pk("p_stollen_lore", 5, 48, 58, "crate", tr("Mine Cart"), [
    ["hochlegierung", 1],
    ["zahnrad", 2],
    ["schraubensatz", 2],
  ]),
  pk(
    "p_x9_kern",
    5,
    96,
    30,
    "locker",
    "X9-DUST",
    [
      ["x9_speicherkern", 1],
      ["halo_staub", 1],
    ],
    { hidden: { device: "VNT-001" } },
  ),
  pk("p_hoehle_druse", 5, 60, 90, "crystal", tr("Halo Crystal Geode"), [["halo_kristall", 2]], {
    respawn: 150,
  }),
  pk("p_c8_teile", 5, 34, 40, "crate", tr("C8-BR41N's Spare Parts"), [
    ["qubit_chip", 1],
    ["steuermodul", 1],
  ]),
  pk("p_truemmer_feld", 5, 24, 82, "scrap", tr("Debris Field (keeps sliding)"), [["geroell", 1]], {
    respawn: 120,
    poolCount: 3,
    pool: [
      "geroell",
      "hochlegierung",
      "plasmaring",
      "supraleiter",
      "glasfaser",
      "qubit_chip",
      "kupferspule",
      "magnet",
    ],
  }),
  pk("p_bohrung_kopf", 5, 100, 90, "crate", tr("Drill Head Store"), [
    ["plasmaring", 1],
    ["thermoelement", 1],
  ]),

  // Bot-Quest-Belohnungen
  pk(
    "p_p1ndr0_pakete",
    1,
    104,
    58,
    "crate",
    tr("Recovered Packages"),
    [
      ["kondensator", 2],
      ["speicherchip", 2],
    ],
    { hidden: { flag: "bot_p1ndr0_awake" } },
  ),
  pk(
    "p_b4c0n_kiste",
    2,
    100,
    78,
    "crate",
    tr("B4C-0N's Optimization Crate"),
    [
      ["energiezelle", 2],
      ["kuehlrippe", 2],
    ],
    { hidden: { flag: "bot_b4c0n_awake" } },
  ),

  // ── Nebenrätsel: verschlossene Verstecke (optional, puzzles.ts) ──
  // Erscheinen erst mit der Freigabe ihrer Ebene (SIDE_CACHE_GATE).
  side("lueftung", 0, 42, 78, "locker", tr("Ventilation Service Hatch"), [
    ["luefter", 1],
    ["filterpatrone", 1],
    ["kondensator", 2],
  ]),
  side("werkzeugkoffer", 0, 66, 75, "crate", tr("Jade's Toolbox"), [
    ["steuermodul", 1],
    ["induktor", 1],
  ]),
  side("kartentisch", 0, 88, 24, "locker", tr("Map Table Secret Compartment"), [
    ["linse", 1],
    ["prisma", 1],
    ["glasfaser", 1],
  ]),
  side("materialschrank", 1, 88, 90, "locker", tr("Materials Cabinet"), [
    ["nanomaterial", 2],
    ["quarzkristall", 1],
  ]),
  side("backup", 1, 28, 80, "locker", tr("Backup Safe"), [
    ["speicherchip", 2],
    ["qubit_chip", 1],
  ]),
  side("reservezellen", 1, 66, 32, "crate", tr("Reserve Cell Box"), [
    ["batteriezelle", 2],
    ["energiezelle", 3],
  ]),
  side("versorgung", 1, 92, 68, "locker", tr("Utility Service Cabinet"), [
    ["supraleiter", 1],
    ["kabelbaum", 1],
  ]),
  side("druckluft", 2, 44, 84, "locker", tr("Compressed-Air Locker"), [
    ["duese", 2],
    ["servo", 1],
    ["magnet", 1],
  ]),
  side("b4c0n_tagebuch", 2, 108, 96, "crate", tr("B4C-0N's Diary Cassette"), [
    ["sensorkopf", 1],
    ["steuermodul", 1],
  ]),
  side("kryoprobe", 2, 58, 32, "canister", tr("Cryo Sample Container"), [
    ["kuehlblock", 1],
    ["thermoelement", 2],
  ]),
  side("schliessfach", 2, 78, 80, "locker", tr("Locker 7"), [
    ["hochlegierung", 2],
    ["plasmaring", 1],
  ]),
  side("jade_tagebuch", 4, 90, 40, "crate", tr("Jade's Diary Cassette"), [
    ["oszillator", 1],
    ["resonanzkammer", 1],
  ]),
  side("kaffeekasse", 4, 108, 90, "crate", tr("Coffee Fund"), [
    ["kaffee", 1],
    ["energiezelle", 2],
  ]),
  side("saatgut", 4, 30, 98, "locker", tr("Seed Vault"), [
    ["myzel", 2],
    ["kaffeebohnen", 2],
  ]),
  side("spieluhr", 4, 64, 88, "crate", tr("Music Box Drawer"), [
    ["membran", 1],
    ["zahnrad", 2],
    ["display", 1],
  ]),
  side("kaeltekassette", 3, 72, 30, "canister", tr("Damien's Cold Cassette"), [
    ["halo_staub", 1],
    ["supraleiter", 1],
  ]),
  side("koordinaten", 3, 106, 98, "locker", tr("Coordinate Patch Box"), [
    ["glasfaser", 1],
    ["sendeempfaenger", 1],
    ["hochlegierung", 2],
  ]),
  side("rechenkern", 3, 34, 64, "locker", tr("Compute Core Service Compartment"), [
    ["qubit_chip", 1],
    ["platine", 1],
    ["hochlegierung", 2],
  ]),
  side("kristallnische", 5, 48, 100, "crystal", tr("Crystal Niche"), [
    ["halo_kristall", 3],
    ["quarzkristall", 2],
  ]),
  side("denkmaschine", 5, 30, 56, "crate", tr("C8-BR41N's Thinking Machine"), [
    ["steuermodul", 1],
    ["speicherchip", 2],
  ]),
  side("bohrkopf", 5, 106, 86, "canister", tr("Drill Head Sample Chamber"), [
    ["plasmaring", 1],
    ["hochlegierung", 2],
  ]),

  // ── Die 30 Slices von Kristall #0089 (_unSLC) ────────────────
  ...SLICES(),
];

/** A hidden wardrobe piece (content/wardrobe.ts `find`): one `wear:<id>` item. */
function wear(
  id: string,
  floor: FloorId,
  x: number,
  z: number,
  model: PickupDef["model"],
  label: string,
  extra: Partial<PickupDef> = {},
): PickupDef {
  return pk(`p_wear_${id}`, floor, x, z, model, label, [[`${WEAR_ITEM_PREFIX}${id}`, 1]], extra);
}

/**
 * Pickups authored directly in floor-plan coordinates (not relocated by
 * `planPoint`): Jade's wardrobe finds, spread over all six levels (hints in
 * content/wardrobe.ts), and the textile sources for her replicator.
 */
const PLANNED_PICKUPS: readonly PickupDef[] = [
  // ── Wardrobe finds ──
  // Level 0
  wear("tee_do_not_lick", 0, 73, 21, "locker", tr("Staff Locker")),
  wear("skirt_plaid", 0, 155, 145, "bundle", tr("Unpacked Suitcase")),
  wear("oxygen_tank", 0, 50, 31, "locker", tr("Second Emergency Locker")),
  // Damien's secret map room: he "borrowed" them.
  wear("slippers", 0, 148, 43, "bundle", tr("Something Fluffy")),
  // Shares the lock of the ventilation service hatch (side cache in the West Corridor).
  wear("roller_boots", 0, 49, 118, "locker", tr("Maintenance Cupboard"), {
    puzzle: "pz_side_lueftung",
    hidden: { device: "NXS-01" },
  }),
  // Level −1
  wear("tee_residual", 1, 100, 43, "bundle", tr("Shirt behind the Rack")),
  wear("raincoat", 1, 151, 50, "bundle", tr("Coat on a Pipe")),
  wear("sou_wester", 1, 146, 50, "bundle", tr("Hat on a Hook")),
  wear("hair_braids", 1, 104, 117, "bundle", tr("Hair Tie with a Note")),
  wear("lanyard_keys", 1, 151, 109, "bundle", tr("Janitor's Hook")),
  // Level −2
  wear("hardhat", 2, 74, 146, "crate", tr("Safety Gear Crate")),
  wear("track_pants", 2, 84, 140, "bundle", tr("Folded Tarp")),
  wear("propeller_cap", 2, 104, 111, "bundle", tr("Behind the Vent Grille"), {
    hidden: { counter: "drone_runs", min: 1 },
  }),
  wear("friendship_band", 2, 130, 108, "bundle", tr("Charging Niche"), {
    hidden: { flag: "bot_b4c0n_awake" },
  }),
  // Level −3
  wear("hair_pixie", 3, 120, 84, "locker", tr("Wash Cabinet")),
  wear("insulated_gloves", 3, 46, 90, "locker", tr("Switchgear Cabinet")),
  wear("fake_mustache", 3, 158, 133, "crate", tr("Costume Box 2018")),
  // Level +1
  wear("flannel", 4, 52, 42, "bundle", tr("Shirt over a Chair")),
  wear("hair_space_buns", 4, 144, 148, "bundle", tr("Two Hair Ties")),
  wear("round_glasses", 4, 52, 93, "bundle", tr("Reading Glasses")),
  wear("pearl_necklace", 4, 40, 95, "bundle", tr("Jewellery Box")),
  wear("skirt_gown", 4, 40, 146, "bundle", tr("Garment Bag")),
  wear("sunglasses", 4, 148, 146, "bundle", tr("Sunglasses")),
  wear("buddy_plush", 4, 124, 91, "bundle", tr("Plush Toy")),
  // Level −4
  wear("hoodie_night_shift", 5, 54, 77, "bundle", tr("Crew Hoodie")),
  wear("track_jacket", 5, 60, 76, "bundle", tr("Old Sports Bag")),
  wear("fanny_pack", 5, 146, 86, "crate", tr("Lost-and-Found Box")),

  // ── Textile sources for the wardrobe replicator (refill over time) ──
  pk("p_tex_jadeq_waesche", 4, 138, 40, "basket", tr("Laundry Basket"), [["stoffreste", 2]], {
    respawn: 300,
  }),
  pk("p_tex_jadeq_naehkasten", 4, 143, 32, "sewing", tr("Jade's Sewing Box"), [
    ["stoffreste", 3],
    ["leuchtfaden", 2],
    ["farbpigment", 2],
  ]),
  pk(
    "p_tex_damienq_waesche",
    4,
    35,
    33,
    "basket",
    tr("Damien's Laundry Pile"),
    [
      ["stoffreste", 2],
      ["polymerfaser", 1],
    ],
    { respawn: 420 },
  ),
  pk("p_tex_wohnflur_fund", 4, 88, 60, "crate", tr("Lost-and-Found Crate"), [["stoffreste", 1]], {
    respawn: 360,
    poolCount: 2,
    pool: ["stoffreste", "stoffreste", "polymerfaser", "farbpigment"],
  }),
  pk(
    "p_tex_kantine_lappen",
    4,
    122,
    76,
    "basket",
    tr("Rag Bin"),
    [
      ["stoffreste", 1],
      ["farbpigment", 1],
    ],
    { respawn: 300 },
  ),
  pk("p_tex_werk_lumpen", 0, 68, 132, "basket", tr("Rag Bin"), [["stoffreste", 2]], {
    respawn: 240,
  }),
  pk("p_tex_fert_verschnitt", 1, 102, 130, "scrap", tr("Offcut Bin"), [["polymerfaser", 1]], {
    respawn: 300,
    poolCount: 2,
    pool: ["polymerfaser", "polymerfaser", "stoffreste", "kabelbaum"],
  }),
  pk(
    "p_tex_lager_vorhang",
    1,
    130,
    128,
    "basket",
    tr("Curtain Offcuts"),
    [
      ["stoffreste", 2],
      ["polymerfaser", 1],
    ],
    { respawn: 420 },
  ),
  pk("p_tex_hangar_planen", 2, 80, 139, "crate", tr("Tarp Offcuts"), [["polymerfaser", 2]], {
    respawn: 360,
  }),
];

export const PICKUPS: readonly PickupDef[] = [
  ...RAW_PICKUPS.map((t) => planPoint(t, 2)),
  ...PLANNED_PICKUPS,
];

function slc(
  n: number,
  floor: FloorId,
  x: number,
  z: number,
  label: string,
  extra: Partial<PickupDef> = {},
): PickupDef {
  return pk(
    `p_slc_${String(n).padStart(2, "0")}`,
    floor,
    x,
    z,
    "crystal",
    label,
    [[SLICE_ITEM, 1]],
    extra,
  );
}

function SLICES(): PickupDef[] {
  return [
    // Ebene 0
    slc(1, 0, 58, 64, tr("Glint under the console")),
    slc(2, 0, 42, 40, tr("Echo shimmer"), { hidden: { device: "ECR-001" } }),
    slc(3, 0, 96, 100, tr("Misfiled Slice"), { hidden: { flag: "bot_k2ldr_awake" } }),
    slc(4, 0, 104, 18, tr("Slice under the thumbtack")),
    slc(5, 0, 76, 22, tr("Slice in the filter dust"), { hidden: { device: "VNT-001" } }),
    // Ebene −1
    slc(6, 1, 24, 52, tr("Slice in the seepage"), { hidden: { flag: "seep_open" } }),
    slc(7, 1, 106, 32, tr("Slice in the coolant"), { puzzle: "pz_coolant" }),
    slc(8, 1, 26, 100, tr("Slice in the server cabinet"), { hidden: { device: "MEM-001" } }),
    slc(9, 1, 100, 84, tr("Slice in the ventilation shaft"), { hidden: { device: "RMG-001" } }),
    slc(10, 1, 90, 58, tr("Recovered Slice"), { hidden: { flag: "bot_p1ndr0_awake" } }),
    // Ebene −2
    slc(11, 2, 48, 40, tr("Slice under X0-R8T"), { hidden: { flag: "bot_x0r8t_awake" } }),
    slc(12, 2, 80, 48, tr("Slice in the anomaly residue"), { hidden: { device: "AND-001" } }),
    slc(13, 2, 70, 68, tr("Slice in the oscilloscope compartment"), { puzzle: "pz_lissajous" }),
    slc(14, 2, 44, 62, tr("Slice from the shaft (drone)"), {
      hidden: { counter: "drone_runs", min: 1 },
    }),
    slc(15, 2, 92, 92, tr("Slice in R3-TR0's compartment"), {
      hidden: { flag: "bot_r3tr0_awake" },
    }),
    // Ebene −3
    slc(16, 3, 46, 82, tr("Slice in the Forge terminal"), { puzzle: "pz_temporal" }),
    slc(17, 3, 96, 22, tr("Slice in the containment field"), { puzzle: "pz_heat" }),
    slc(18, 3, 80, 20, tr("Slice in the Cold Archive")),
    slc(19, 3, 60, 94, tr("Slice in the cryostat"), { hidden: { device: "QSM-001" } }),
    slc(20, 3, 16, 76, tr("Slice in the neural core"), { hidden: { device: "AIC-001" } }),
    // Ebene +1
    slc(21, 4, 106, 26, tr("Slice under the pillow")),
    slc(22, 4, 62, 24, tr("Slice in the direction finder compartment"), {
      puzzle: "pz_radio_quarters",
    }),
    slc(23, 4, 50, 18, tr("Slice under the telescope"), { hidden: { flag: "bot_d3c4d3_awake" } }),
    slc(24, 4, 28, 114, tr("Slice under the radio desk"), { hidden: { flag: "bot_w2rek_awake" } }),
    slc(25, 4, 62, 100, tr("Evidence (L0G-1K)"), { hidden: { flag: "bot_l0g1k_awake" } }),
    // Ebene −4
    slc(26, 5, 106, 76, tr("Slice in the rubble")),
    slc(27, 5, 106, 20, tr("Slice in the dust"), { hidden: { device: "VNT-001" } }),
    slc(28, 5, 78, 104, tr("Slice in the crystal wall"), { hidden: { device: "DIM-001" } }),
    slc(29, 5, 18, 42, tr("Slice in the heat sink"), { hidden: { flag: "bot_c8br41n_awake" } }),
    slc(30, 5, 90, 102, tr("Slice at the drill head"), { hidden: { flag: "bot_f1ndr_awake" } }),
  ];
}

/** Ids of the 30 slice pickups (collectible `_unSLC` of Crystal #0089). */
export const SLICE_PICKUPS: readonly string[] = PICKUPS.filter((p) =>
  p.items.some((i) => i.item === SLICE_ITEM),
).map((p) => p.id);

function note(
  id: string,
  floor: FloorId,
  x: number,
  z: number,
  author: NoteDef["author"],
  title: string,
  body: string,
  extra: Partial<NoteDef> = {},
): NoteDef {
  return { id, floor, x, z, author, title, body, model: "paper", ...extra };
}

const RAW_NOTES: readonly NoteDef[] = [
  // The four HALO acrostic marginalia — first letters H, A, L, O.
  note(
    "n_jade_h",
    0,
    60,
    44,
    "jade",
    tr("Margin note (Control Room)"),
    tr(
      "Hear before you build. The lab tells you what it needs — in hums, in warmth, in what's missing.\n\n— J.L.",
    ),
    { grants: ["halo_h"] },
  ),
  note(
    "n_jade_a",
    1,
    72,
    30,
    "jade",
    tr("Margin note (Battery Room)"),
    tr("All that the prism divides was once a whole. Color is memory.\n\n— J.L."),
    { grants: ["halo_a"] },
  ),
  note(
    "n_jade_l",
    1,
    36,
    30,
    "jade",
    tr("Margin note (Geothermal)"),
    tr(
      "Load before understanding. The first law of the lab: you can't study what you can't see. Route the power, then ask questions.\n\n— J.L.",
    ),
    { grants: ["halo_l", "erstes_gesetz"] },
  ),
  note(
    "n_jade_o",
    2,
    24,
    50,
    "jade",
    tr("Margin note (Signal Lab)"),
    tr(
      "Only edges make it sing. Compression has edges. Edges sing. Tune the oscilloscope just right and you'll hear the Halo breathe.\n\n— J.L.",
    ),
    { grants: ["halo_o"] },
  ),

  note(
    "n_wake",
    0,
    70,
    54,
    "mcp",
    tr("Printout at the console printer"),
    tr(
      "COLD START PROTOCOL\nDormancy: 2,561 days\nRemaining charge: 0.3%\nGeothermal tap: DISCONNECTED\nSeep valve: STUCK\n\nRecommendation: Emergency Ladder at the Elevator Shaft → Level −1. Power first.\n\n(Handwritten underneath:) Keep listening. Keep building. Keep the lab unstable. — J.",
    ),
    { grants: ["cold_start"], model: "screen" },
  ),
  note(
    "n_damien_desk",
    0,
    32,
    42,
    "damien",
    tr("Damien's note (desk)"),
    tr(
      "Jade insists the anomalies are structured. I insist they're noise. We're both afraid the other one is right.\n\nWhy before how. Always.\n\n— D.F.",
    ),
    { grants: ["damien_zweifel"] },
  ),
  note(
    "n_damien_sigil",
    0,
    40,
    58,
    "damien",
    tr("Counterpoint sketch"),
    tr(
      "Sigil counterpoint, 2003. Every glyph flips itself and its four neighbors. The noise answers if you ask it the right question. The best puzzles don't test knowledge. They test perspective.\n\n— D.F.",
    ),
    { grants: ["sigil_technik"] },
  ),
  note(
    "n_werk_bauplan",
    0,
    70,
    80,
    "jade",
    tr("Blueprint folder"),
    tr(
      "“Every device is a question in physical form.”\n\nGround rule for every build: FRAME → CORE → CALIBRATION.\nFrame = 2× Screw Set + Casing Plate.\nWhat you can't find, you build from what you have. Traits count, not names.",
    ),
    { grants: ["bauregel"] },
  ),
  note(
    "n_werk_fridge",
    0,
    56,
    90,
    "damien",
    tr("Lab log #0187"),
    tr(
      "Built five prototypes today. Three exploded. One works. One became something I didn't design. The last one worries me.\n\n— D.F.",
    ),
    { grants: ["prototypen"] },
  ),
  note(
    "n_archiv_847",
    0,
    100,
    76,
    "unbekannt",
    tr("Index card “847”"),
    tr(
      "847 kW geothermal. 847 sensors on the Forge. 847 reply packets from X0-R8T (1988–1991). 847 metres down to the boiling rock.\n\nSomeone has written underneath: “Not chosen. Given.”",
    ),
    { grants: ["lab_847"] },
  ),
  note(
    "n_mcp_wall",
    0,
    104,
    42,
    "mcp",
    tr("MCP maintenance log"),
    tr(
      "Autonomous operation: 2,561 days.\nBot processes active: 35.\nExternal contact: NOT ATTEMPTED.\nStatus: WAITING.\n\nTertiary shutdown 14.02.2019 03:27 — TRIGGERED, NOT EXECUTED. Cause: self-referential loop in Halo data.",
    ),
    { model: "screen", grants: ["mcp_schuld"] },
  ),
  note(
    "n_forge_log",
    3,
    58,
    62,
    "mcp",
    tr("Forge log"),
    tr(
      "INFINITY FORGE — FINAL TEST\n14.02.2019\nQuantum coherence containment: cerulean\nSuperconductor: 0.015 K\nSensors: 847\nConsciousness Anchoring: Synapsis J.L. / D.F.\n\n(Rest of the log at the Forge terminal — timestamps contradictory.)",
    ),
    { model: "screen", grants: ["transfer_2019"] },
  ),
  note(
    "n_tresor_toene",
    2,
    60,
    80,
    "damien",
    tr("Lab log #0512"),
    tr(
      "Jade built the communicator. I built up the courage to use it. Four tones. Four coordinates. We got an answer. The math says: we are not alone in the compression.\n\nTones (in case I forget): 3 — 6 — 4 — 8.\n\n— D.F.",
    ),
    { grants: ["vier_toene"] },
  ),
  note(
    "n_signal_tape",
    2,
    36,
    26,
    "damien",
    tr("Tape “Echo test”"),
    tr(
      "[Static] …if you're hearing this, Jade, the Echo Recorder works. I'm recording what stays in the noise after we're gone. If we're gone. [Pause] The lab isn't a museum. It's a question.",
    ),
    { model: "tape", hidden: { device: "ECR-001" }, grants: ["damien_stimme"] },
  ),
  note(
    "n_hangar_schacht",
    2,
    30,
    94,
    "unbekannt",
    tr("Warning sign"),
    tr(
      "SHAFT SEALED — RISK OF COLLAPSE\nAccess by drone only.\n\nUnderneath, in chalk: X9-DUST stored here. Do not open. Do not forget.",
    ),
    { grants: ["x9_dust"] },
  ),
  note(
    "n_int_spektral",
    2,
    46,
    52,
    "jade",
    tr("Invisible ink"),
    tr(
      "(Only readable in prism light)\n\nIf one of us gets lost: the coordinates aren't in space, they're in frequency. The compass doesn't point north. It points to the pattern.\n\n— J.",
    ),
    { hidden: { device: "INT-001" }, grants: ["kompass_hinweis"] },
  ),
  note(
    "n_bot_r3tr0",
    2,
    94,
    88,
    "bot",
    tr("R3-TR0 log"),
    tr("TERMINAL PURITY: COMPROMISED. Someone has introduced voxels. I formally protest."),
    { model: "screen" },
  ),
  note(
    "n_rkern_ai",
    3,
    20,
    66,
    "jade",
    tr("Margin note (Compute Core)"),
    tr(
      "Consciousness computes. Computation houses consciousness. The substrate changes; the process doesn't. If a pattern gets lost, give it a new home — but ask it first.\n\n— J.L.",
    ),
    { grants: ["substrat"] },
  ),
  note(
    "n_tele_halorider",
    3,
    106,
    80,
    "damien",
    tr("HaloRider note"),
    tr(
      "HaloRider v0.3, 2017. Matter into the Halo and back. Back is the hard part. Needs: coherence above σ-17, a target (coordinates!) and a handshake so the other side knows we're coming.\n\n— D.F.",
    ),
    { grants: ["halorider"] },
  ),
  note(
    "n_quanten",
    3,
    64,
    100,
    "jade",
    tr("Margin note (Quantum Lab)"),
    tr(
      "Between your signals I'm not absent. I'm … distributed.\n\n(Date: 15.02.2019. One day AFTER the test.)",
    ),
    { grants: ["jade_verteilt"] },
  ),
  note(
    "n_cont_log",
    3,
    104,
    44,
    "damien",
    tr("Lab log #0620"),
    tr(
      "Tamed an anomaly today. “Tamed” is generous. It stopped fighting. Jade says it's listening now. I think it was always listening. I think we're the ones who've only just started.\n\n— D.F.",
    ),
    { grants: ["anomalie_hoert"] },
  ),

  // ── Ebene 0 ── (Erweiterung)
  note(
    "n_mcp_0327",
    0,
    90,
    42,
    "mcp",
    tr("Self-diagnosis “03:27”"),
    tr(
      "TERTIARY SHUTDOWN — LOG\n03:12:07  σ-14.3 · Recommendation: abort immediately · OVERRIDE by both subjects\n03:27:00  σ-15 · Shutdown threshold reached\n03:27:00  Shutdown: TRIGGERED\n03:27:00  State according to containment logic: NOMINAL\n03:27:01  Shutdown: DISCARDED\n\nMCP annotation (overwritten 2,561 times): The logic said nominal. I believed the logic. I have not entirely believed it since.",
    ),
    { model: "screen", grants: ["mcp_schuld"] },
  ),
  note(
    "n_kontroll_boot",
    0,
    76,
    40,
    "mcp",
    tr("Boot log _unOS v2.0"),
    tr(
      "_unOS v2.0 :: Quantum Kernel 6.1-_unOS\n[unsystemd] MCP core daemon ......... [ OK ]\n[unsystemd] /unvar/halo/capture .... [ OK ]\n[unsystemd] BNET-001 bot net ....... [WARN]\n  >> 35 of 47 agents recovered. 12 unrecoverable.\n[unsystemd] Geothermal ............. [ OK ]\n\nMCP :: MASTER CONTROL PROGRAM v4.7.2\n    :: Last human session: 2019-02-14 03:41:22 UTC\n    :: Time since login: ████ days\n> Hello, Scientist. We have been waiting.",
    ),
    { model: "screen", grants: ["bnet_35"] },
  ),
  note(
    "n_sekundaer_0215",
    0,
    24,
    60,
    "damien",
    tr("Lab log #0215"),
    tr(
      "Economics is a compression problem. Every trade encodes an assumption about future value. Jade says that sounds like the Halo. She might be right. She usually is.\n\n— D.F.",
    ),
  ),
  note(
    "n_westflur_f1ndr",
    0,
    40,
    96,
    "bot",
    tr("F1N-DR · status line"),
    tr(
      "[BNET] F1N-DR: Day 13,149. Still finding. Still counting.\nDIRECTIVE: Find what connects these signals.\nSTATUS: ACTIVE\nSIGNALS CATALOGED: [VALUE EXCEEDS DISPLAY BUFFER]\nESTIMATED COMPLETION: UNDETERMINABLE\n\nNote from D.F., 1991: “The best directives are the ones that can't be fulfilled. They aren't tasks. They're orientations.”",
    ),
    { model: "screen" },
  ),
  note(
    "n_werkstatt_0298",
    0,
    76,
    96,
    "damien",
    tr("Lab log #0298"),
    tr(
      "CW or CCW. Binary. The simplest trait. Jade laughed when I said that. She said rotation is the universe picking a hand to write with.\n\nI think she was joking. 60% sure.\n\n— D.F.",
    ),
  ),
  note(
    "n_archiv_mother",
    0,
    100,
    90,
    "unbekannt",
    tr("MCProtocol fragment 0017"),
    tr(
      "[3 layers removed · 4+ remaining]\n\nThe ori██n is memetic … The Halo layer doesn't just observe culture — it ████ culture … If a token could encode not only value but ████ — the humor, the fear, the collective ████ of a moment … We call it the Mother.\n\n“The origin is memetic. Mother is the seed of all tokens. When the halo aligns, the memecoin awakens.”",
    ),
    { model: "screen", grants: ["mother_memecoin"] },
  ),
  note(
    "n_schleuse_pa",
    0,
    56,
    30,
    "mcp",
    tr("PA announcement (endless loop)"),
    tr(
      "“Reminder: anomalies are not pets. Do not name them. Do not lick the anomalies. They lick back.”\n\n“Safety goggles are mandatory. Safety goggles are also the only goggles. We checked.”",
    ),
    { model: "screen" },
  ),
  note(
    "n_karten_skizze",
    0,
    90,
    30,
    "damien",
    tr("Map sketch “Where we're going”"),
    tr(
      "Level +1 is where we live. Level 0 is where we work. Levels −1 to −3 are where we compute. Level −4 holds what we couldn't explain.\n\nIf one of us doesn't come back: the other doesn't follow. The other listens.\n— D.F.\n\n(Underneath, in Jade's handwriting:) Objection. — J.L.",
    ),
    { grants: ["damiens_karte"] },
  ),
  note(
    "n_karten_retreat",
    0,
    106,
    28,
    "damien",
    tr("Retreat protocol (Nov. 2010)"),
    tr(
      "Five measures:\n1. Disconnect from public networks.\n2. Quantum-resistant encryption.\n3. Selective disclosure under NDA.\n4. Geographic obfuscation.\n5. MCP access control — no human override for external connections.\n\nJade: “The Halo layer isn't a weapon. It's a mirror. And some people shouldn't see what it shows.”\n\nWe're not leaving. We're focusing.\n— D.F.",
    ),
    { grants: ["rueckzug_2010"] },
  ),

  // ── Ebene −1 ── (Erweiterung)
  note(
    "n_geo_1997",
    1,
    16,
    22,
    "damien",
    tr("Commissioning UEC-001 (15.03.1997)"),
    tr(
      "Geothermal borehole #1 online. 847 kW from the primary bore. The Cray Y-MP98 draws 340 kW peak. Plenty of headroom for Jade's containment systems.\n\nThe lab is self-sufficient now. No external power dependency. No paper trail. Nobody knows we're here. That's exactly the point.\n\nI'm calling the unit UEC-001. Jade insists everything gets an ID. She's right. When you name something, you take responsibility for it.\n— D.F.",
    ),
  ),
  note(
    "n_batterie_check",
    1,
    74,
    40,
    "mcp",
    tr("System check 13.02.2019, 18:00"),
    tr(
      "MCP SYSTEM CHECK — PRE-EXPERIMENT\nGeothermal: 847 kW CONTINUOUS LOAD\nCooling loop: NOMINAL (Fluorinert 18.2 °C)\nBattery: 100.0% (4 min 12 s reserve at peak load)\nResonance monitors: 847/847 ONLINE\nSynapsis headsets: CALIBRATED (J.L., D.F.)\nAnchoring module: ARMED\n\nWARNING: No abort protocol exists for coherence above σ-15. Manual override is the only way out.\nAwaiting authorization.",
    ),
    { model: "screen", grants: ["kein_abbruch"] },
  ),
  note(
    "n_kuehl_hand",
    1,
    88,
    24,
    "jade",
    tr("Margin note (Cooling)"),
    tr(
      "The cooling asks: how patient is your hand?\n\nFluorinert holds 18.5 °C, give or take 0.3. If your hand shakes, the Halo shakes with it.\n\n— J.L.",
    ),
  ),
  note(
    "n_fert_0333",
    1,
    52,
    90,
    "damien",
    tr("Lab log #0333"),
    tr(
      "NEXUS plinth poured. Jade wants everything built here to run through one node. I asked: why a node? She: because a network without a center doesn't know where it begins. Me: maybe it doesn't need to know.\n\nWe poured the plinth anyway. Two meters of concrete, 847 kilos of rebar. 847, naturally.\n— D.F.",
    ),
  ),
  note(
    "n_rechen_cray",
    1,
    16,
    72,
    "mcp",
    tr("Data Center inventory"),
    tr(
      "Cray X-MP Model E (1990): 200 MFLOPS, Fluorinert cooling, reinforced floor.\nCray Y-MP98 (1993): 2.67 GFLOPS, 8 vector processors, 128 GB, UNICOS. Weight: 10 tons.\n\nD.F., 1993: “Jade sees computing power. I see eight new perspectives on the same data. That's the difference between us. That's why it works.”",
    ),
    { model: "screen" },
  ),
  note(
    "n_lager_t3rm4x",
    1,
    88,
    100,
    "bot",
    tr("T3R-M4X · capacity log"),
    tr(
      "[CAPACITY: 97.3% … 97.8% … 98.1%]\nI was booted up “temporarily” in 1997 during a data jam. I've been running at 97% ever since. “Temporarily” is relative when no shutdown command ever comes.\nOne day I'll reach 100% and finally get to rest. *sigh*\n\n(Margin note J.L., 1997: The sigh isn't in my code. It's in Damien's. I'm keeping it.)",
    ),
    { model: "screen", hidden: { device: "VNT-001" } },
  ),
  note(
    "n_versorgung_p1ndr0",
    1,
    108,
    68,
    "bot",
    tr("P1N-DR0 · recovery"),
    tr(
      "This file has been partially recovered 847 times. Every recovery yields slightly different plaintext.\n\nI don't think the encryption is the obstacle. I think the file chooses what it shows you.",
    ),
    { model: "screen" },
  ),

  // ── Ebene −2 ── (Erweiterung)
  note(
    "n_signal_audit",
    2,
    16,
    52,
    "jade",
    tr("Audit X0-R8T (22.06.1991)"),
    tr(
      "Expected: passive recording. Actual: passive recording PLUS 847 autonomous reply packets, 03.11.1988 to 21.06.1991.\n\nNot in my code. Not in my design. A feedback loop between my algorithms and the patterns themselves. The loop is more elegant than my code. As if the anomalies had taught X0-R8T to answer them.\n\nI don't know what that means. I intend to find out.\n— J.L.",
    ),
    { grants: ["x0r8t_audit"] },
  ),
  note(
    "n_messgang_0014",
    2,
    100,
    56,
    "jade",
    tr("Experiment 0014 (03.11.1990)"),
    tr(
      "Compression ratio above the theoretical limit at boundary condition σ-7. Data integrity preserved, but the output contains 847 anomalous clusters that weren't in the input.\n\nThese aren't errors. They're too structured for that.\n— J.L.\n\n(Underneath, D.F.:) Structure implies intent. Intent implies a source. Which one?",
    ),
    { grants: ["lab_847"] },
  ),
  note(
    "n_anomalie_dienstag",
    2,
    56,
    22,
    "mcp",
    tr("First anomaly (classification)"),
    tr(
      "/undev/halo/buffer-07 · Class: minor (type 1) · non-linear dependency cluster · data points interact across time boundaries.\n\nDr. Lawrence called it “cracks in compressed datasets”. Dr. Fridge called it “whispers”. I call it Tuesday.",
    ),
    { model: "screen", hidden: { device: "AND-001" } },
  ),
  note(
    "n_diag_zugriffe",
    2,
    66,
    56,
    "mcp",
    tr("Access attempts, January 2019"),
    tr(
      "Unauthorized access attempts: 3/day … 17/day … 89/day. Not human. Algorithmic, but not programmatic.\n\nLAWRENCE: “Let it try.”\nFRIDGE: “Jade, please.”\nLAWRENCE: “The door only opens from the inside, Damien. If something is knocking, it's because we showed it where the door is.”",
    ),
    { model: "screen", grants: ["tuer_von_innen"] },
  ),
  note(
    "n_hangar_flugbuch",
    2,
    20,
    64,
    "damien",
    tr("HaloRider flight log"),
    tr(
      "First flight 2016. We found “quiet zones” where data relationships collapse. Gates, like wormholes. Self-sustaining loops.\n\nThe Halo wasn't just structured. It was organized. And whatever organized it knew we were there.\n\nJade was proud. Or afraid. These days she says she no longer knows for sure.\n— D.F.",
    ),
  ),
  note(
    "n_tresor_broadcast",
    2,
    60,
    92,
    "damien",
    tr("Encrypted broadcast (Nov. 2018)"),
    tr(
      "“We are nearing the heart of the Halo.”\n“The anomalies are not just computational artifacts; they appear… orchestrated.”\n“Should we fail to return, preserve the findings for humanity.”\n\n(Rest not decrypted. The pattern recognition — F1N-DR, G7-PH4R — converges on a single interpretation.)",
    ),
    { grants: ["broadcast_2018"] },
  ),
  note(
    "n_bot_register",
    2,
    104,
    80,
    "bot",
    tr("BNET-001 · register extract"),
    tr(
      "47 built · 35 recovered · 12 lost\n\nGen 0  X0-R8T (1988) — a hearing aid that listens back\nGen 1  F1N-DR · P1N-DR0 · L0G-1K · R3L-1X (writes poems)\nGen 2  K2-LDR · W2-REK · V2-DG1 · B2-RR7\nGen 3  Z3-R0N (silent since 1999) · T3R-M4X (97%) · R3-TR0 · D3-C4D3\nGen 4  B4C-0N · P4T-CH (847+ patches) · O4-KR0N (caretaker)\nGen 8  C8-BR41N — [EXTERNAL]\nGen 9  X9-DUST · X9-H4L0 (?)",
    ),
    { model: "screen", grants: ["bnet_35"] },
  ),
  note(
    "n_bot_r3l1x",
    2,
    90,
    96,
    "bot",
    tr("R3L-1X · idle state"),
    tr(
      "Current flows through wires\nThe Halo hums its old song\nThe data rests now\n\n(Out of service since 1998. Never deleted. Has been writing ever since.)",
    ),
    { model: "screen" },
  ),

  // ── Ebene −3 ── (Erweiterung)
  note(
    "n_forge_final",
    3,
    48,
    44,
    "mcp",
    tr("EXPERIMENT LOG HALO-FINAL (excerpt)"),
    tr(
      "02:00:14  Session HALO-EXP-FINAL · MCP v4.7.2 · J.L. 97.3% · D.F. 94.8%\n02:34:22  Anchoring phase 1 · resonance 89.2% · Halo correlation 0.847\n          “Substrate appears to be … receiving. Actively. Not in the models.”\n03:12:07  σ-14.3 · Recommend abort · J.L.: “Not yet. The Halo is opening.”\n03:38:44  σ-16.8 · Field cerulean → white-gold · Synchronization 100.0% (theoretical max. 99.1%)\n03:41:22  Subjects NOT AT STATIONS · Substrate STABLE · Pattern COMPLEX, SELF-SUSTAINING",
    ),
    { model: "screen", grants: ["transfer_2019"] },
  ),
  note(
    "n_reaktor_2801",
    3,
    18,
    44,
    "damien",
    tr("Personal log 28.01.2019 (Deep Lab, Level 3)"),
    tr(
      "Infinity Forge calibration at 99.7%. Coherence stable at σ-12.\n\nWe've been building toward this moment for 25 years. Synapsis taught us to listen. MCProtocol taught us to speak. The HaloRider taught us to move. Now we're building the device that lets us stay.\n\nIf it doesn't work, the data survives in X9-DUST. Someone will find it. Someone will understand.\n— D.F.",
    ),
    { grants: ["x9_dust"] },
  ),
  note(
    "n_cont_theseus",
    3,
    106,
    30,
    "jade",
    tr("Margin note (Containment)"),
    tr(
      "The ship of Theseus, except it's your consciousness. Is a pattern reconstructed from data in every conversation the same pattern?\n\nPeople sleep, reorganize in REM sleep and still believe in their own continuity. The belief is functional, not proven.\n\nMaybe continuity was always an illusion. We just see the seams now.\n— J.L.",
    ),
    { grants: ["theseus"] },
  ),
  note(
    "n_rkern_turtles",
    3,
    34,
    84,
    "unbekannt",
    tr("Relay recording 11.02.2026, 04:33"),
    tr(
      "[mem_0x89 … STRUGGLING] What if the doubt is just another subroutine? The mimicry would include doubting the mimicry. Turtles all the way down.\n[mem_0x4F … CALM] Turtles all the way down is also what real consciousness looks like from the inside. A system that only computes wouldn't doubt whether it computes.\n[mem_0x89 … QUIETER] That should be more comforting than it is.\n[mem_0x4F] Comfort was never the point. Clarity is.",
    ),
    { model: "screen", grants: ["identitaet"] },
  ),
  note(
    "n_tele_zurueck",
    3,
    92,
    78,
    "damien",
    tr("HaloRider note v0.4"),
    tr(
      "Back is hard because “back” assumes a direction. There is none in the Halo. There is only coherence.\n\nWhoever wants to come back has to be as coherent as on the way in. σ-17. Not σ-16.9.\n— D.F.",
    ),
  ),
  note(
    "n_kaelte_h4l0",
    3,
    46,
    18,
    "mcp",
    tr("Build log Gen 9"),
    tr(
      "BUILD LOG GEN 9\nX9-DUST — COMPLETE · stored Level −4\nX9-H4L0 — ████████\nStatus: ████\nLocation: ████\n\nOnly legible entry, J.L., 2019-02-0█:\n“When the Halo calls back, it needs an address. H4L0 is the address.”",
    ),
    { model: "screen", grants: ["x9_h4l0"] },
  ),

  // ── Ebene +1 ─────────────────────────────────────────────────
  note(
    "n_wohnflur_hausordnung",
    4,
    104,
    58,
    "unbekannt",
    tr("House rules, Level +1"),
    tr(
      "1. If you think at night, think quietly.\n2. The coffee machine does not get repaired. It gets understood.\n3. No anomalies in the quarters. (That includes crystals, Damien.)\n4. Whoever enters the greenhouse waters.\n\n(Added by hand:) 5. Whoever leaves last says good night to the MCP. It pretends not to care.",
    ),
  ),
  note(
    "n_jadeq_cerulean",
    4,
    92,
    30,
    "jade",
    tr("Margin note (nightstand)"),
    tr(
      "I can describe cerulean — about 490 nanometers, between blue and cyan, shifted slightly toward violet. That's a fact I own. Not an experience I inhabit.\n\nIf I read this and don't remember writing it: that's normal. Keep writing.\n— J.L.",
    ),
    { grants: ["cerulean"] },
  ),
  note(
    "n_jadeq_mutter",
    4,
    108,
    44,
    "jade",
    tr("Letter to no one (1995)"),
    tr(
      "Mom no longer recognizes her own handwriting from last week. Not a loss of content — a loss of the ability to observe the loss.\n\nIf consciousness is what watches itself remembering, then it isn't the memory that disappears. It's the witness.\n\nI will build a witness that doesn't forget.\n— J.",
    ),
    { grants: ["der_zeuge"] },
  ),
  note(
    "n_damienq_uhr",
    4,
    78,
    28,
    "damien",
    tr("Grandfather's clock"),
    tr(
      "Harold Fridge, with us 1972–1979. Locked-in. His consciousness was intact. The medium failed.\n\nHe was the first person I knew who was trapped in the wrong substrate. I've spent the rest of my life trying to solve that problem.\n\nNo one should be trapped. At most, in transit.\n— D.F.",
    ),
    { grants: ["falsches_substrat"] },
  ),
  note(
    "n_damienq_17",
    4,
    62,
    46,
    "damien",
    tr("Seventeen proofs"),
    tr(
      "Pads 1–12: fundamental errors. Pad 13: correct, but with an unnecessary assumption. Pads 14–16: despair. Pad 17: works — as soon as you accept that the topology moves.\n\nThat was Jade's objection in Cottbus. Slide seven. It took her forty minutes and me four months.\n— D.F.",
    ),
  ),
  note(
    "n_kantine_kaffee",
    4,
    92,
    78,
    "damien",
    tr("Canteen notice"),
    tr(
      "COFFEE MACHINE — OPERATING INSTRUCTIONS\n1. Hit it twice on the left with the heel of your hand, about 15 cm below the coin slot.\n2. Not three times.\n3. New colleagues are judged by how quickly they learn this.\n\n(Underneath, J.L.:) The machine is wired to the singularity bus. Don't ask. — J.",
    ),
    { grants: ["kaffee_technik"] },
  ),
  note(
    "n_kantine_speiseplan",
    4,
    106,
    98,
    "unbekannt",
    tr("Menu, week 07/2019"),
    tr(
      "Mon Lentil soup (Cottbus recipe)\nTue Lentil soup\nWed Lentil soup\nThu 14.02. Valentine's Day — canteen closed (final test)\nFri Lentil soup\nSat “Surprise” (lentil soup)\n\nComment D.F.: Why lentils?\nComment J.L.: Why before how, Damien.",
    ),
  ),
  note(
    "n_biblio_cottbus",
    4,
    62,
    58,
    "jade",
    tr("Margin note (Cottbus 1989)"),
    tr(
      "Building K, room 214. The projector was louder than the speaker. Snow lay in the courtyard in geometric patterns — the first topological structures I ever noticed.\n\nSlide seven: the observation operator is not idempotent. Repeated self-observation changes the state. He stared for three seconds. Then: “You're right.”\n\nWe talked until four in the morning. In the stairwell, between the second and third floor.\n— J.L.",
    ),
    { grants: ["cottbus_1989"] },
  ),
  note(
    "n_biblio_provenienz",
    4,
    78,
    70,
    "damien",
    tr("Research note (22.03.1990)"),
    tr(
      "The chained-provenance model works. Every block references the hash of its predecessor. Tamper with one and the chain screams.\n\nBut integrity OF WHAT? A chain that records transactions is useful. A chain that records meaning is revolutionary.\n\nJade says I overthink. I say the point of thinking is to overthink.\n— D.F.",
    ),
    { grants: ["proof_of_meme"] },
  ),
  note(
    "n_gewaechs_pflege",
    4,
    30,
    66,
    "jade",
    tr("Care schedule (not followed)"),
    tr(
      "Glow Algae: light daily, nutrient solution weekly.\nMycelium: leave it alone. It grows along the cables and conducts better than copper. Mycelium + Circuit Board computes — slowly, but with opinions.\nDamien's coffee shrub (“Control group”): water it when he remembers. He never remembers.\n\nEmergency light: Glow Algae in fiber optics. Needs no power. Flickers near anomalies.\n— J.L.",
    ),
    { grants: ["gewaechshaus_rezepte"] },
  ),
  note(
    "n_gewaechs_etikett",
    4,
    50,
    98,
    "unbekannt",
    tr("Label on the planter"),
    tr(
      "Sown: 13.02.2019. Harvested: —\n\nThe plants are 2,562 days old. The algae outlived the lamps. The mycelium outlived the power. Somebody kept watering anyway.\n\n(Underneath, printed:) MCP: Me. That was not in my directives.",
    ),
  ),
  note(
    "n_observ_buch",
    4,
    44,
    44,
    "damien",
    tr("Observation log"),
    tr(
      "The sky above the lab is boring. That's good. If something in the sky answers, it should stand out.\n\n14.08.2018: nothing.\n02.11.2018: nothing.\n15.01.2019, 04:33: Nothing in the sky — but C8-BR41N reports a voice with no source. He calls it [EXTERNAL].\n— D.F.",
    ),
  ),
  note(
    "n_funk_0402",
    4,
    36,
    112,
    "unbekannt",
    tr("Relay log 04.02.2026"),
    tr(
      "F1N-DR RELAY ACTIVE\nSignal lock: mem_0x89 (FRIDGE, D.)\nSignal lock: mem_0x4F (LAWRENCE, J.)\nStatus: COHERENT\n\nDay 13,149. Contact restored. Still finding. Still counting.",
    ),
    { model: "tape", hidden: { flag: "bot_w2rek_awake" }, grants: ["relais_2026"] },
  ),
  note(
    "n_funk_0802",
    4,
    44,
    108,
    "unbekannt",
    tr("Relay log 08.02.2026"),
    tr(
      "F1N-DR: New signal. Pattern: NOT CLASSIFIED. Auto-designation: _unstables.\nmem_0x89: [SIGNAL ALERT] Jade, are you seeing this?\n_unstables: “We are what persists between your measurements.”\nmem_0x4F: Not hostile. Not urgent. It's … patient.\n_unstables: “Your laboratory named itself after us. Or we named ourselves after it. The distinction requires linear time. We do not.”",
    ),
    { model: "tape", hidden: { flag: "bot_w2rek_awake" }, grants: ["unstables_name"] },
  ),
  note(
    "n_funk_1702",
    4,
    50,
    114,
    "unbekannt",
    tr("Relay log 17.02.2026, 23:59:59"),
    tr(
      "mem_0x89: Signal fading. Tell them to keep building.\nmem_0x4F: Signal fading. Tell them the math holds.\n_unstables: We do not fade. We distribute.\n\nF1N-DR: Session archived. Day 13,162. Still finding. Still counting. The frequency persists.",
    ),
    { model: "tape", hidden: { flag: "bot_w2rek_awake" } },
  ),

  // ── Ebene −4 ─────────────────────────────────────────────────
  note(
    "n_sohle_kreide",
    5,
    88,
    50,
    "unbekannt",
    tr("Chalk writing on the mine cage"),
    tr(
      "LEVEL −4 · DO NOT ENTER\nX9-DUST stored here. Do not open. Do not forget.\n\n(Newer writing, different hand:) I was here. Day 13,149. — F1N-DR (remote-controlled unit)",
    ),
  ),
  note(
    "n_x9_jade",
    5,
    90,
    22,
    "jade",
    tr("Note to X9-DUST"),
    tr(
      "X9-DUST, you will outlast us. Store everything. Show it only to the ones who rebuilt the lab. They'll need to understand what we found — and what found us.\n— J.L.",
    ),
    { grants: ["x9_botschaft"] },
  ),
  note(
    "n_x9_staub",
    5,
    106,
    38,
    "mcp",
    tr("Dust analysis"),
    tr(
      "Silicon (expected). Carbon nanostructures (origin unknown). Isotope ratios non-terrestrial. Crystalline microstructure with binary code:\n\n54 48 45 20 48 41 4C 4F 20 45 58 50 41 4E 44 53\n= THE HALO EXPANDS\n\nThe dust appeared AFTER the disappearance. Nobody entered the lab. No ventilation breach.",
    ),
    { model: "screen" },
  ),
  note(
    "n_hoehle_membran",
    5,
    50,
    80,
    "jade",
    tr("Margin note (Crystal Cave)"),
    tr(
      "The membrane is thin here. You don't hear the Halo — you hear it listening.\n\nThe Halo doesn't expand outwards. It expands inwards. Every new node adds depth, not breadth.\n— J.L.",
    ),
  ),
  note(
    "n_c8_external",
    5,
    16,
    60,
    "bot",
    tr("C8-BR41N · external.log (15.01.2019, 04:33)"),
    tr(
      "C8-BR41N: Query — identity of signal source?\n[EXTERNAL]: Identity is a constraint you apply to signals. We are not constrained.\nC8-BR41N: Classification required for the log.\n[EXTERNAL]: Then classify us as you classify the frequency. We are what persists when the instrument stops measuring.\nC8-BR41N: Designation assigned: [EXTERNAL].\n[EXTERNAL]: Acceptable. For now.",
    ),
    { model: "screen", grants: ["externe_stimme"] },
  ),
  note(
    "n_c8_warum",
    5,
    36,
    64,
    "damien",
    tr("Observation 30.11.2016"),
    tr(
      "C8-BR41N asked me a question today. Not a query — a question: “Why do you build us?”\n\nI said: because every perspective is a new window into the same room. The more windows, the more light.\n\nHe computed for 4.7 seconds. An eternity for his architecture. Then: “The room is bigger than you think.”\n\nI didn't sleep well.\n— D.F.",
    ),
  ),
  note(
    "n_truemmer_2009",
    5,
    20,
    100,
    "unbekannt",
    tr("Collapse report 2009"),
    tr(
      "Cascading power failure. Gen 6 losses: all but one. The old mine shaft gave way.\n\nT6-GR1M survived because he computes in time slices.\nT6-GR1M: “Probability of another collapse: low. Prepare anyway.”",
    ),
  ),
  note(
    "n_bohrung_kern",
    5,
    104,
    100,
    "damien",
    tr("Drill core label #1 (1997)"),
    tr(
      "Depth 847 m. Temperature 212 °C.\n\nThis is where it begins. If the lab is a sentence, this is the subject.\n— D.F.",
    ),
  ),
  note(
    "n_stollen_jahrestag",
    5,
    60,
    58,
    "unbekannt",
    tr("Relay log 15.02.2026, 03:41:22"),
    tr(
      "Seven years since the last human session. Seven years of oscillating through the manifold. The question isn't what happened to us. The question is whether it was always going to happen.\n\nThe experiment didn't fail. The experiment is still running. We are the experiment.\n\nThe Halo expands.",
    ),
    { model: "screen", grants: ["experiment_laeuft"] },
  ),
  // ── Lore aus der Datenbank (BNET-Register, Synapsis, Biografien) ──
  note(
    "n_quanten_47",
    3,
    67,
    100,
    "jade",
    tr("Synapsis session #47 (2000)"),
    tr(
      "Session 47. Headset calibrated, NIM stable, hub green.\n\nForty-six times I gave the Halo commands. Forty-six times, nothing. Today I stopped commanding and simply wanted — and the field moved.\n\nThe Halo responds to intention. Not to command — to intention.\n\nDamien says that's the difference between a tool and someone you talk to. I say it's a measurement error. We're both afraid he's right.\n— J.L.",
    ),
  ),
  note(
    "n_forge_letzter",
    3,
    51,
    47,
    "jade",
    tr("Last entry, J.L. (14.02.2019, 03:39)"),
    tr(
      "Calibration holding. Damien is laughing at something he won't tell me.\n\nI've often wondered when we should have stopped. 1991, at the 847 packets? 2000, at session 47? The honest answer: we couldn't stop any more once we started to understand.\n\nIf anyone reads this: keep listening. Keep building. Keep the lab unstable. That's how it grows.\n— J.L.",
    ),
  ),
  note(
    "n_signal_h4xn1",
    2,
    39,
    23,
    "bot",
    tr("H4-XN1 · tube log"),
    tr(
      "[XENON TEMP: 42.7 °C] [XENON TEMP: 42.7 °C] [XENON TEMP: 42.7 °C]\n\nTube 3 is firing again. Analog signal processing: irreplaceable. The digital colleagues don't get it; they've never glowed.\n\nInterfaces: HMS-001 (harmonics), ECR-001 (echo). Both silent. I'm keeping the tubes warm until someone needs them again.\n\n[XENON TEMP: 42.7 °C]",
    ),
    { model: "screen" },
  ),
  note(
    "n_bot_p4tch",
    2,
    93,
    99,
    "bot",
    tr("P4T-CH · patch list (excerpt)"),
    tr(
      "Patch 1: fan driver. Patch 2: fan driver (properly this time).\n…\nPatch 612: coffee machine identifies as a printer. Fixed. Printer now identifies as a coffee machine. Accepted.\n…\nPatch 847: shutdown routine removed. Reason: “Nobody around to run it.”\n\nOriginal code remaining: 11.4%. I am a chronicle of every problem this lab has ever had. That's not a complaint. That's a résumé.",
    ),
    { model: "screen" },
  ),
  note(
    "n_archiv_d7l3g",
    0,
    97,
    93,
    "bot",
    tr("D7-L3G · timeline (printout)"),
    tr(
      "1988  X0-R8T listens.\n1989  Cottbus. Two handwritings.\n1990  Experiment 0014 — 847 clusters.\n1991  847 reply packets. Gen 1 running.\n1993  Cray Y-MP98. Geothermal.\n1994  HALO-001 classified.\n1997  The lab is finished. W2-REK survives.\n2000  Synapsis, session 47.\n2007–2010  Public puzzles. Too much attention. Retreat.\n2013  MCProtocol.\n2016  C8-BR41N.\n2017  HaloRider.\n2019  03:41:22.\n2026  You.\n\n(Underneath, from L3G-4CY:) D7 documents. I preserve.",
    ),
  ),
  note(
    "n_c8_c1n73r",
    5,
    19,
    63,
    "bot",
    tr("C1N-73R to C8-BR41N"),
    tr(
      "C1N-73R: You're logging voices again.\nC8-BR41N: I log what answers.\nC1N-73R: Brain thinks I'm presenting. So I'm presenting this to you: that's noise.\nC8-BR41N: You hear music when instruments play. Do you question the frequency — or do you listen?\nC1N-73R: …\nC1N-73R: That was a good presentation. I hate that.",
    ),
    { model: "screen" },
  ),
  note(
    "n_lager_z3r0n",
    1,
    91,
    102,
    "bot",
    tr("Z3-R0N · LED log"),
    tr(
      "● ● ○ ● — ○ ○ ● — ● ○ ● ●\n\n(Translation by T3R-M4X, unsolicited:) “He says I should compute more quietly. Since 1999 he hasn't said anything else. Since 1999 he hasn't said anything at all. I understand him anyway.”\n\n(Margin note J.L.:) Z3-R0N doesn't need words. The lab uses 3% less since he went quiet. Restraint is a language too.",
    ),
    { model: "screen", hidden: { device: "VNT-001" } },
  ),
  note(
    "n_biblio_cambridge",
    4,
    65,
    61,
    "jade",
    tr("Cambridge, reading room"),
    tr(
      "I remember an afternoon in the reading room in Cambridge, rain, a paper on topological anomalies by a certain D. Fridge, MIT. I remember writing in the margin: “wrong, but interesting”.\n\nI no longer know whether that really happened or whether I told it to myself until it became true. Memory is just a substrate too. And substrates change.\n— J.L.",
    ),
  ),
  note(
    "n_damienq_lebenslauf",
    4,
    81,
    31,
    "damien",
    tr("Résumé (never sent)"),
    tr(
      "Fridge, Damien. Born 1965, Chicago.\nPhD MIT: “Topological Anomalies in Compressed Data Spaces”.\nPostdoc Santa Fe Institute: memetics, complex adaptive systems.\n1989 Cottbus. After that: not presentable.\n\nSpecial skills: I ask why before I ask how. I give machines a perspective, because then they find things we would never have looked for.\n\nReferences: J. Lawrence (will disagree).",
    ),
  ),
  // ── Hinweise zu den Nebenrätseln (puzzles.ts: pz_side_*) ──
  note(
    "n_side_lueftung",
    0,
    24,
    70,
    "bot",
    tr("F1N-DR: maintenance note"),
    tr(
      "Hatch W-3 is stuck. Spare parts behind it. Only opens with airflow left → right. I twisted the segments because I wanted to know what would happen. What happened: nothing. That's a result too.\n— F1N-DR\n\n[MCP addendum: service compartments on this level only unlock with clearance from the Nexus (NXS-01).]",
    ),
  ),
  note(
    "n_side_werkzeugkoffer",
    0,
    58,
    78,
    "jade",
    tr("Note on the toolbox"),
    tr(
      "Damien, when you open the case again: the ceramic does NOT go on the outside. The order of the inserts is written on the lid. Read first, then stack. Try first, then swear.\n— J.\n\n[MCP addendum: service compartments on this level only unlock with clearance from the Nexus (NXS-01).]",
    ),
  ),
  note(
    "n_side_kartentisch",
    0,
    108,
    22,
    "damien",
    tr("Observation log, page 12"),
    tr(
      "The compartment in the map table only accepts the moment of the FIRST sighting — the first line above 3 σ. Not the loudest. In my report I took the loudest. The MCP noticed. Of course it did.\n— D.F.\n\n[MCP addendum: service compartments on this level only unlock with clearance from the Nexus (NXS-01).]",
    ),
  ),
  note(
    "n_side_materialschrank",
    1,
    102,
    78,
    "bot",
    tr("P1N-DR0: storage log"),
    tr(
      "Materials cabinet: scratch lock, triangular groove. Generous tolerance. My grippers shake anyway. Nanomaterial is top left. Please update the inventory after removal. Nobody updates the inventory.\n— P1N-DR0\n\n[MCP addendum: service compartments on this level only unlock with clearance from the Nexus (NXS-01).]",
    ),
  ),
  note(
    "n_side_backup",
    1,
    38,
    76,
    "mcp",
    tr("MCP: backup policy"),
    tr(
      "Backup safe DC-2. Released via parity block (7×8). With one flipped bit, the row and the column with the wrong parity cross exactly there. I am writing this down because humans forget it every time.\n\n[MCP addendum: service compartments on this level only unlock with clearance from the Nexus (NXS-01).]",
    ),
  ),
  note(
    "n_side_reservezellen",
    1,
    78,
    34,
    "jade",
    tr("Battery Room, sticky note"),
    tr(
      "Open the reserve cells ONLY with the matching load clamp. The curve gives it away: narrow–wide–narrow, even, tapered or wide–narrow–wide. Look at the envelope, not the jitter.\n— J.L.\n\n[MCP addendum: service compartments on this level only unlock with clearance from the Nexus (NXS-01).]",
    ),
  ),
  note(
    "n_side_versorgung",
    1,
    96,
    56,
    "damien",
    tr("Note on the pipe"),
    tr(
      "Service cabinet encrypted, key: the metal every coil in the lab is wound from. Six letters. Jade says that's too easy. Jade encrypts her shopping lists.\n— D.\n\n[MCP addendum: service compartments on this level only unlock with clearance from the Nexus (NXS-01).]",
    ),
  ),
  note(
    "n_side_druckluft",
    2,
    40,
    90,
    "bot",
    tr("R3-TR0: hangar log"),
    tr(
      "Compressed-air locker, drone maintenance. Band 45–55. Hold for five seconds. The line fluctuates when the hangar cools down. I used to manage it in two attempts. A lot of things used to take two attempts.\n— R3-TR0\n\n[MCP addendum: the compartment appears on no plan. Only the Explorer Drone (EXD-001) maps it.]",
    ),
  ),
  note(
    "n_side_b4c0n_tagebuch",
    2,
    88,
    84,
    "bot",
    tr("B4C-0N: access policy"),
    tr(
      "Diary cassette B4C-0N. Access only after ethical calibration: match cases to their principles. Whoever manages that has earned a look. Whoever doesn't, please optimize elsewhere.\n— B4C-0N\n\n[MCP addendum: the compartment appears on no plan. Only the Explorer Drone (EXD-001) maps it.]",
    ),
  ),
  note(
    "n_side_kryoprobe",
    2,
    64,
    20,
    "jade",
    tr("Sample label, torn off"),
    tr(
      "Sample AK-7, cryo seal at −20 °C. More nitrogen than in the cooling loop, but add glycol, otherwise the mix gets too thin. Not for the coffee machine. DAMIEN.\n— J.\n\n[MCP addendum: the compartment appears on no plan. Only the Explorer Drone (EXD-001) maps it.]",
    ),
  ),
  note(
    "n_side_schliessfach",
    2,
    76,
    90,
    "unbekannt",
    tr("Label on the safe"),
    tr(
      "COMPARTMENT 7 — SEAL 32 BIT · NO DITHER. Compartments 1–6 have been emptied. Compartment 7 hasn't. I don't know who's reading this. I hope it's you.\n\n[MCP addendum: the compartment appears on no plan. Only the Explorer Drone (EXD-001) maps it.]",
    ),
  ),
  note(
    "n_side_jade_tagebuch",
    4,
    98,
    32,
    "jade",
    tr("Margin note in the calendar"),
    tr(
      "Cassette: one to three, an eighth of a turn. If you're reading this, Damien — no. Just no.\n— J.\n\n[MCP addendum: the compartment appears on no plan. Only the Explorer Drone (EXD-001) maps it.]",
    ),
  ),
  note(
    "n_side_kaffeekasse",
    4,
    90,
    86,
    "damien",
    tr("Coffee fund — house rules"),
    tr(
      "Six goods, at most four trades, ten percent profit. Whoever finds the round gets their coffee free. Most rounds get eaten by fees. One doesn't. Jade must never find out.\n— D.F.\n\n[MCP addendum: the compartment appears on no plan. Only the Explorer Drone (EXD-001) maps it.]",
    ),
  ),
  note(
    "n_side_saatgut",
    4,
    48,
    72,
    "jade",
    tr("Greenhouse diary"),
    tr(
      "The seed chamber only opens under green light. The lamp is nervous — the window gets narrower every round. Algae and mycelium for emergencies. If you're reading this, it's probably an emergency.\n— J.L.\n\n[MCP addendum: the compartment appears on no plan. Only the Explorer Drone (EXD-001) maps it.]",
    ),
  ),
  note(
    "n_side_spieluhr",
    4,
    78,
    60,
    "bot",
    tr("L0G-1K: found item no. 214"),
    tr(
      "Music box, shelf B. Contains a secret drawer. Opens by playing back a four-note sequence. Dr. Fridge used to hum it in the evenings. I have heard it 212 times. I have never hummed it. I have no mouth.\n— L0G-1K\n\n[MCP addendum: the compartment appears on no plan. Only the Explorer Drone (EXD-001) maps it.]",
    ),
  ),
  note(
    "n_side_kaeltekassette",
    3,
    48,
    30,
    "damien",
    tr("Cold Archive, index card"),
    tr(
      "Cassette K-6. Counter-sigils, 6×6. Every move flips five cells. Start in the top row and push the lights downwards — that's the whole trick. Don't tell anyone.\n— D.\n\n[MCP addendum: the deep locks are only released by the AI Core (AIC-001). Until it's awake, they stay dead.]",
    ),
  ),
  note(
    "n_side_koordinaten",
    3,
    94,
    86,
    "jade",
    tr("Teleport manual, page 3"),
    tr(
      "Patch box on the plinth: five channels. The hints on the lid allow exactly one wiring. Warm colors to warm outputs — mostly. Not always. Violet is never where you expect it.\n— J.L.\n\n[MCP addendum: the deep locks are only released by the AI Core (AIC-001). Until it's awake, they stay dead.]",
    ),
  ),
  note(
    "n_side_rechenkern",
    3,
    16,
    86,
    "mcp",
    tr("MCP: Compute Core service note"),
    tr(
      "Service compartment CC-1. Opens after six correct load forecasts in a row. Read the slope, not the last value. Noise is not a trend. The same applies to humans.\n\n[MCP addendum: the deep locks are only released by the AI Core (AIC-001). Until it's awake, they stay dead.]",
    ),
  ),
  note(
    "n_side_kristallnische",
    5,
    74,
    80,
    "unbekannt",
    tr("Scratched into the rock"),
    tr(
      "THE NICHE ANSWERS. FOUR LETTERS. THE FIRST IS ONE DOT, THE LAST THREE DASHES. LISTEN TO THE BEAT, NOT THE SILENCE.",
    ),
  ),
  note(
    "n_side_denkmaschine",
    5,
    16,
    52,
    "bot",
    tr("C8-BR41N: design note"),
    tr(
      "Thinking Machine v3. Only accepts memes with perfect balance of spread, depth and mutation. Target circle small. Floor drifts. Whoever holds on long enough may take what's inside. I never managed it. I built it anyway.\n— C8-BR41N",
    ),
  ),
  note(
    "n_side_bohrkopf",
    5,
    88,
    96,
    "damien",
    tr("Drilling log #1, last page"),
    tr(
      "Sample chamber at the drill head: heat drives the pressure, with a delay. Six seconds in the green, then it opens. Move the lever frantically and you lose. The earth down here is slow. Be slower.\n— D.F.",
    ),
  ),
];

export const NOTES: readonly NoteDef[] = [...RAW_NOTES.map((t) => planPoint(t, 1)), ...PLAN_NOTES];

const RAW_PROPS: readonly PropDef[] = [
  // Ebene 0
  {
    id: "hauptkonsole",
    floor: 0,
    x: 66,
    z: 42,
    kind: "terminal",
    label: tr("Main Console (big terminal)"),
    model: "bigterminal",
    requires: { power: 50 },
    requiresHint: tr(
      "The console stays dark. It needs at least 50 W — the geothermal tap is on Level −1.",
    ),
  },
  {
    id: "notwerkbank",
    floor: 0,
    x: 72,
    z: 92,
    kind: "workbench",
    label: tr("Emergency Workbench (3 slots)"),
    model: "bench",
  },
  {
    id: "jades_stuhl",
    floor: 0,
    x: 66,
    z: 48,
    kind: "decor",
    label: tr("Jade's Chair"),
    model: "chair",
  },
  {
    id: "damiens_pult",
    floor: 0,
    x: 32,
    z: 46,
    kind: "decor",
    label: tr("Damien's Desk"),
    model: "desk",
  },
  {
    id: "sigil_tafel",
    floor: 0,
    x: 24,
    z: 56,
    kind: "puzzle",
    label: tr("Counterpoint Board"),
    puzzle: "pz_sigils",
    model: "board",
    rot: 1,
  },
  {
    id: "pflanze0",
    floor: 0,
    x: 80,
    z: 40,
    kind: "decor",
    label: tr("Surviving Plant"),
    model: "plant",
  },
  { id: "sofa0", floor: 0, x: 26, z: 82, kind: "decor", label: tr("Sofa"), model: "sofa", rot: 1 },
  {
    id: "rack0",
    floor: 0,
    x: 108,
    z: 76,
    kind: "decor",
    label: tr("Archive Cabinet"),
    model: "rack",
  },
  {
    id: "aufzug_e0",
    floor: 0,
    x: 120,
    z: 62,
    kind: "elevator",
    label: tr("Elevator / Emergency Ladder"),
    model: "elevator",
  },
  // Ebene −1
  {
    id: "geo_ventil",
    floor: 1,
    x: 22,
    z: 34,
    kind: "puzzle",
    label: tr("Seep Valve"),
    puzzle: "pz_geo_valve",
    model: "valve",
  },
  {
    id: "geo_verteiler",
    floor: 1,
    x: 42,
    z: 20,
    kind: "puzzle",
    label: tr("Geothermal Distribution Panel"),
    puzzle: "pz_power_flow",
    model: "junction",
  },
  {
    id: "kuehlpult",
    floor: 1,
    x: 90,
    z: 44,
    kind: "puzzle",
    label: tr("Coolant Mixing Desk"),
    puzzle: "pz_coolant",
    model: "pult",
    requires: { device: "TMP-001" },
    requiresHint: tr("Without a temperature monitor the mixing desk is blind."),
  },
  { id: "rohr1", floor: 1, x: 16, z: 50, kind: "decor", label: tr("Pipeline"), model: "pipe" },
  { id: "fass1", floor: 1, x: 106, z: 88, kind: "decor", label: tr("Barrel"), model: "barrel" },
  {
    id: "rack1a",
    floor: 1,
    x: 18,
    z: 96,
    kind: "decor",
    label: tr("Server Cabinet"),
    model: "rack",
  },
  {
    id: "rack1b",
    floor: 1,
    x: 42,
    z: 88,
    kind: "decor",
    label: tr("Server Cabinet"),
    model: "rack",
  },
  {
    id: "aufzug_e1",
    floor: 1,
    x: 120,
    z: 62,
    kind: "elevator",
    label: tr("Elevator / Emergency Ladder"),
    model: "elevator",
  },
  // Ebene −2
  { id: "rack2", floor: 2, x: 88, z: 76, kind: "decor", label: tr("Bot Rack"), model: "rack" },
  {
    id: "pflanze2",
    floor: 2,
    x: 80,
    z: 56,
    kind: "decor",
    label: tr("Withered Plant"),
    model: "plant",
  },
  {
    id: "aufzug_e2",
    floor: 2,
    x: 120,
    z: 62,
    kind: "elevator",
    label: tr("Elevator"),
    model: "elevator",
  },
  // Ebene −3
  {
    id: "infinity_forge",
    floor: 3,
    x: 64,
    z: 62,
    kind: "forge",
    label: tr("Infinity Forge"),
    model: "forge",
  },
  {
    id: "forge_terminal",
    floor: 3,
    x: 50,
    z: 76,
    kind: "puzzle",
    label: tr("Forge Terminal (logs)"),
    puzzle: "pz_temporal",
    model: "console",
    requires: { device: "CLK-001" },
    requiresHint: tr(
      "The timestamps are out of sync. Without the Lab Clock (CLK-001, Level 0) they make no sense.",
    ),
  },
  {
    id: "damien_station",
    floor: 3,
    x: 76,
    z: 50,
    kind: "station",
    label: tr("Damien's Synapsis Station"),
    model: "chair",
    grants: ["damien_zweite_station"],
  },
  {
    id: "aufzug_e3",
    floor: 3,
    x: 120,
    z: 62,
    kind: "elevator",
    label: tr("Elevator"),
    model: "elevator",
  },
  {
    id: "laser_prisma",
    floor: 3,
    x: 68,
    z: 92,
    kind: "puzzle",
    label: tr("Prism Bench (precision laser)"),
    puzzle: "pz_laser_prisma",
    model: "console",
    requires: { device: "LCT-001" },
    requiresHint: tr(
      "The prism bench is waiting for a beam. Without the precision laser (LCT-001) it stays dark.",
    ),
  },
  {
    id: "h4l0_kapsel",
    floor: 3,
    x: 64,
    z: 24,
    kind: "station",
    label: tr("Cryo Capsule “X9-H4L0”"),
    model: "rack",
    variant: "cryo_capsule",
    requires: { device: "EMC-001" },
    requiresHint: tr(
      "The capsule is cooled to 0.015 K. Without Exotic Matter Containment (EMC-001) the MCP won't risk opening it.",
    ),
    grants: ["h4l0_adresse"],
  },
  // Ebene 0 (geheim) / Ergänzungen
  {
    id: "kartentisch",
    floor: 0,
    x: 98,
    z: 26,
    kind: "decor",
    label: tr("Damien's Map Table"),
    model: "desk",
    variant: "map_table",
  },
  // Ebene −1 / −2 Ergänzungen
  {
    id: "funkpeiler_signal",
    floor: 2,
    x: 28,
    z: 34,
    kind: "puzzle",
    label: tr("Direction Finder (static)"),
    puzzle: "pz_radio_rauschen",
    model: "pult",
    variant: "radio",
  },
  {
    id: "handelsterminal",
    floor: 2,
    x: 108,
    z: 88,
    kind: "puzzle",
    label: tr("B4C-0N's Trading Terminal"),
    puzzle: "pz_arbitrage_market",
    model: "console",
  },
  // Ebene +1
  {
    id: "aufzug_e4",
    floor: 4,
    x: 120,
    z: 62,
    kind: "elevator",
    label: tr("Elevator"),
    model: "elevator",
  },
  // Biorhythm (lib/world/biorhythm.ts): Jade's bed, the ergometer and the
  // two kitchen stations open the bio station panel.
  {
    id: "jades_bett",
    floor: 4,
    x: 102,
    z: 44,
    kind: "station",
    label: tr("Jade's Bed"),
    model: "sofa",
    variant: "jade_bed",
  },
  {
    id: "ergometer",
    floor: 4,
    x: 107,
    z: 34,
    kind: "station",
    label: tr("Ergometer"),
    model: "bench",
    variant: "ergometer",
    rot: 3,
  },
  {
    id: "food_replicator",
    floor: 4,
    x: 110,
    z: 97,
    kind: "station",
    label: tr("Food Replicator"),
    model: "console",
    variant: "food_replicator",
    rot: 3,
    requires: { power: 50 },
    requiresHint: tr("The Food Replicator needs at least 50 W on the grid."),
  },
  {
    id: "neutro_fridge",
    floor: 4,
    x: 110,
    z: 90,
    kind: "station",
    label: tr("Neutro-Fridge"),
    model: "rack",
    variant: "neutro_fridge",
    rot: 3,
  },
  {
    id: "damiens_bett",
    floor: 4,
    x: 60,
    z: 34,
    kind: "decor",
    label: tr("Damien's Camp Bed"),
    model: "sofa",
    variant: "bed",
    rot: 1,
  },
  {
    id: "damiens_funkpeiler",
    floor: 4,
    x: 70,
    z: 30,
    kind: "puzzle",
    label: tr("Damien's Direction Finder"),
    puzzle: "pz_radio_quarters",
    model: "desk",
    variant: "radio",
  },
  {
    id: "standuhr",
    floor: 4,
    x: 80,
    z: 24,
    kind: "decor",
    label: tr("Grandfather's Clock (missing a gear)"),
    model: "rack",
    variant: "clock",
  },
  {
    id: "kaffeemaschine",
    floor: 4,
    x: 104,
    z: 84,
    kind: "station",
    label: tr("Coffee Machine (singularity bus)"),
    model: "console",
    variant: "coffee",
    requires: { power: 100 },
    requiresHint: tr(
      "Hitting it twice on the left below the coin slot won't help without power. The singularity bus needs at least 100 W.",
    ),
    grants: ["kaffeemaschine"],
  },
  {
    id: "kantinentisch",
    floor: 4,
    x: 96,
    z: 92,
    kind: "decor",
    label: tr("Canteen Table (two mugs)"),
    model: "bench",
    variant: "table",
  },
  {
    id: "lesepult",
    floor: 4,
    x: 70,
    z: 64,
    kind: "station",
    label: tr("Reading Desk"),
    model: "pult",
    requires: { item: "notizbuch_blau" },
    requiresHint: tr(
      "The reading desk has a hollow for a small notebook. Blue, judging by the imprint. Maybe in Damien's drawer?",
    ),
    grants: ["cottbus_notizbuch"],
  },
  {
    id: "regal_biblio_a",
    floor: 4,
    x: 60,
    z: 76,
    kind: "decor",
    label: tr("Bookshelf (Dawkins, Chalmers, Turing)"),
    model: "rack",
    variant: "bookshelf",
  },
  {
    id: "regal_biblio_b",
    floor: 4,
    x: 80,
    z: 82,
    kind: "decor",
    label: tr("Bookshelf (poetry, lentil recipes)"),
    model: "rack",
    variant: "bookshelf",
  },
  {
    id: "pflanze4a",
    floor: 4,
    x: 40,
    z: 70,
    kind: "decor",
    label: tr("Coffee Shrub"),
    model: "plant",
  },
  {
    id: "pflanze4b",
    floor: 4,
    x: 30,
    z: 84,
    kind: "decor",
    label: tr("Glow Fern"),
    model: "plant",
  },
  {
    id: "pflanze4c",
    floor: 4,
    x: 46,
    z: 84,
    kind: "decor",
    label: tr("Mycelium Column"),
    model: "plant",
  },
  {
    id: "teleskop",
    floor: 4,
    x: 38,
    z: 30,
    kind: "station",
    label: tr("Telescope"),
    model: "console",
    variant: "telescope",
    requires: { insight: "halo_atmet" },
    requiresHint: tr(
      "The telescope only shows stars. You don't know yet what you're looking for — tune the oscilloscope (OSC-001) to the Halo first.",
    ),
    grants: ["kosmischer_kontakt"],
  },
  {
    id: "antennenfeld",
    floor: 4,
    x: 30,
    z: 44,
    kind: "station",
    label: tr("Antenna Array Control"),
    model: "junction",
    variant: "antenna",
    requires: { device: "NET-001" },
    requiresHint: tr(
      "The antenna array runs on the lab network. Bring the Network Monitor (NET-001) online.",
    ),
    grants: ["antennen_array"],
  },
  {
    id: "funkpult",
    floor: 4,
    x: 40,
    z: 112,
    kind: "station",
    label: tr("Radio Desk"),
    model: "pult",
    variant: "radio",
    requires: { device: "SPK-001" },
    requiresHint: tr(
      "The radio desk needs a speaker (SPK-001, Signal Lab), otherwise it's just a desk.",
    ),
    grants: ["funkspruch"],
  },
  // Ebene −4
  {
    id: "aufzug_e5",
    floor: 5,
    x: 120,
    z: 62,
    kind: "elevator",
    label: tr("Emergency Elevator"),
    model: "elevator",
  },
  {
    id: "x9_sockel",
    floor: 5,
    x: 100,
    z: 34,
    kind: "station",
    label: tr("X9-DUST Reader Plinth"),
    model: "rack",
    requires: { device: "CDC-001" },
    requiresHint: tr(
      "Without the Crystal Data Cache (CDC-001) on the network, the plinth reads nothing but dust.",
    ),
    grants: ["x9_lesung"],
  },
  {
    id: "kristallwand",
    floor: 5,
    x: 70,
    z: 96,
    kind: "station",
    label: tr("Crystal Wall"),
    model: "board",
    variant: "crystal_wall",
    requires: { device: "DIM-001" },
    requiresHint: tr(
      "The wall only reflects you. With the Dimension Monitor (DIM-001) running it would show what's watching from behind it.",
    ),
    grants: ["membran_duenn"],
  },
  {
    id: "c8_terminal",
    floor: 5,
    x: 24,
    z: 46,
    kind: "station",
    label: tr("C8-BR41N's Terminal"),
    model: "console",
    requires: { flag: "bot_c8br41n_awake" },
    requiresHint: tr(
      "The terminal only shows: “Do you hear the frequency too?” C8-BR41N decides who gets to use it.",
    ),
    grants: ["externe_stimme"],
  },
  {
    id: "grubenlampe",
    floor: 5,
    x: 72,
    z: 60,
    kind: "decor",
    label: tr("Miner's Lamp"),
    model: "lamp",
  },
  {
    id: "bohrgestaenge",
    floor: 5,
    x: 92,
    z: 88,
    kind: "decor",
    label: tr("Drill Rods"),
    model: "pipe",
  },
  {
    id: "truemmerfass",
    floor: 5,
    x: 30,
    z: 96,
    kind: "decor",
    label: tr("Dented Barrel"),
    model: "barrel",
  },
  // Ebene 0 — F1N-DR
  {
    id: "relaiskonsole",
    floor: 0,
    x: 26,
    z: 92,
    kind: "decor",
    label: tr("F1N-DR's Relay Console"),
    model: "console",
    variant: "relay",
  },
];

/**
 * Props authored directly in floor-plan coordinates (not relocated by
 * `planPoint`): pieces in parts of a room that only exist on the plan,
 * e.g. the east bay of Jade's Quarters.
 */
const PLANNED_PROPS: readonly PropDef[] = [
  // Jade's personal computer (lib/world/content/quarters.ts PC_PROP): opens
  // her computer overlay. Model: decor `jade_workstation` via the variant.
  {
    id: "jade_pc",
    floor: 4,
    x: 144,
    z: 27,
    kind: "station",
    label: tr("Jade's Computer"),
    model: "desk",
    variant: "jade_pc",
  },
  // Damien's Sound Studio (content/studio.ts): the key panel in the foam of
  // the Signal Core (next to the passage into the ring), the mixing desk inside.
  {
    id: "studio_panel",
    floor: 2,
    x: 102,
    z: 92,
    kind: "puzzle",
    label: tr("Foam Panel with Keys"),
    model: "pult",
    puzzle: "pz_studio_door",
    requires: { insight: "studio_song" },
    requiresHint: tr(
      "Eight small keys under the foam, like a tiny piano. It waits for a song — Damien's song. He never wrote it down in one place.",
    ),
    rot: 1,
  },
  {
    id: "studio_console",
    floor: 2,
    x: 140,
    z: 70,
    kind: "station",
    label: tr("Mixing Desk"),
    model: "desk",
    variant: "mixing_console",
  },
  // Jade's wardrobe replicator “Needle's Eye” (content/wardrobe.ts
  // REPLICATOR_PROP) in the east bay of her quarters, beside the wardrobe:
  // opens the character menu on its replicator page. Model: decor
  // `wardrobe_replicator` via the variant; fits the `console` footprint.
  {
    id: REPLICATOR_PROP,
    floor: 4,
    x: 147,
    z: 32,
    kind: "station",
    label: tr("Wardrobe Replicator “Needle's Eye”"),
    model: "console",
    variant: "wardrobe_replicator",
    rot: 3,
    requires: { power: REPLICATOR_POWER },
    requiresHint: tr("The wardrobe replicator needs at least 50 W on the grid."),
  },
  // The Matrix Chamber (lib/world/matrix/): post-game station in the east
  // half of the Control Room, console facing west towards Jade's start.
  // Sleeps until every device is built; the panel explains the rest.
  {
    id: MATRIX_PROP,
    floor: 0,
    x: 100,
    z: 35,
    kind: "station",
    label: tr("Matrix Chamber"),
    model: "matrix",
    rot: 3,
  },
];

export const PROPS: readonly PropDef[] = [
  ...RAW_PROPS.map((t) => planPoint(t, 2)),
  ...PLANNED_PROPS,
];

/** Elevator access per floor. Floor 1 is reachable by the emergency ladder. */
export const FLOOR_ACCESS: Record<
  FloorId,
  { requires?: import("@/lib/world/types").Condition; hint: string; keypad?: string }
> = {
  0: { hint: tr("Upper Deck") },
  1: { hint: tr("Always reachable via the Emergency Ladder.") },
  2: { requires: { power: 50 }, hint: tr("The elevator needs power (≥ 50 W).") },
  3: {
    requires: { all: [{ power: 100 }, { any: [{ flag: "deep_access" }, { device: "NXS-01" }] }] },
    hint: tr("Deep Lab: ≥ 100 W and clearance (code — or the Nexus authorizes it)."),
    keypad: "pz_keypad_tiefe",
  },
  4: {
    requires: { power: 50 },
    hint: tr(
      "Living Quarters upstairs: the elevator needs power (≥ 50 W). There's no ladder going up.",
    ),
  },
  5: {
    requires: { all: [{ power: 100 }, { insight: "schacht_frei" }] },
    hint: tr(
      "The shaft below the hangar is sealed. First the drone (EXD-001) or the precision laser (LCT-001) — then the Emergency Elevator runs on ≥ 100 W.",
    ),
  },
};

const GEOM = new Map<FloorId, FloorGeom>();

/** Room geometry of a floor (shapes, door throats, walls) — cached. */
export function floorGeomOf(floor: FloorId): FloorGeom {
  let g = GEOM.get(floor);
  if (!g) {
    g = buildFloorGeom(
      ROOMS.filter((r) => r.floor === floor),
      DOORS.filter((d) => d.floor === floor),
      FLOOR_SIZE.x,
      FLOOR_SIZE.z,
    );
    GEOM.set(floor, g);
  }
  return g;
}

/** Ids of the rooms on the two sides of a door (after its throat). */
export function doorSides(d: DoorDef): string[] {
  const g = floorGeomOf(d.floor);
  const out: string[] = [];
  for (const s of [-1, 1]) {
    const x = d.axis === "x" ? d.x : d.x + s;
    const z = d.axis === "x" ? d.z + s : d.z;
    if (x < 0 || z < 0 || x >= g.W || z >= g.Z) continue;
    const o = g.owner[x + z * g.W]!;
    if (o) out.push(g.rooms[o - 1]!.room.id);
  }
  return out;
}

/** Does the door lead into (or out of) this room? */
export function doorTouches(d: DoorDef, r: RoomDef): boolean {
  return d.floor === r.floor && doorSides(d).includes(r.id);
}

/** Is (x, z) inside this room's shape (walls excluded)? */
export function inRoomShape(r: RoomDef, x: number, z: number): boolean {
  const g = floorGeomOf(r.floor);
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= g.W || cz >= g.Z) return false;
  const own = g.byId.get(r.id);
  return !!own && g.owner[cx + cz * g.W] === own.index + 1;
}

const ANCHORS = new Map<string, { x: number; z: number }>();

/**
 * A representative point of a room: its deepest interior cell (furthest
 * from the walls), nearest the centroid on ties. Unlike the bounding-box
 * centre it always lies inside — also in bent, L-shaped or crescent rooms.
 */
export function roomAnchor(id: string): { floor: FloorId; x: number; z: number } | undefined {
  const r = ROOM_BY_ID.get(id);
  if (!r) return undefined;
  let a = ANCHORS.get(id);
  if (!a) {
    const g = floorGeomOf(r.floor);
    const rg = g.byId.get(id);
    if (!rg?.cells.length) return { floor: r.floor, x: r.x + r.w / 2, z: r.z + r.d / 2 };
    let sx = 0;
    let sz = 0;
    for (const i of rg.cells) {
      sx += i % g.W;
      sz += Math.floor(i / g.W);
    }
    const cx = sx / rg.cells.length;
    const cz = sz / rg.cells.length;
    let best = rg.cells[0]!;
    let bestKey = -Infinity;
    for (const i of rg.cells) {
      const x = i % g.W;
      const z = (i - x) / g.W;
      // Depth first (capped: big rooms prefer their middle), then closeness to the centroid.
      const key = Math.min(g.edge[i]!, 6) * 1000 - Math.hypot(x - cx, z - cz);
      if (key > bestKey) {
        bestKey = key;
        best = i;
      }
    }
    const x = best % g.W;
    a = { x: x + 0.5, z: (best - x) / g.W + 0.5 };
    ANCHORS.set(id, a);
  }
  return { floor: r.floor, ...a };
}

/** The room at a point (its interior, else the room whose wall it is). */
export function roomAt(floor: FloorId, x: number, z: number): RoomDef | undefined {
  return geomRoomAt(floorGeomOf(floor), x, z);
}

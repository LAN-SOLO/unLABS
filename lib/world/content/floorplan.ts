/**
 * Floor plans — where every room sits and what shape it has.
 * ===========================================================
 *
 * Every level is built around a core (the room `aufzugN`): a rotunda with
 * the freight elevator in its middle. The rooms fan out from it — some open
 * straight onto the core, others hang off a corridor, an airlock or a bent
 * passage. Rooms are round, octagonal, L-shaped, capsule-like or (on the
 * deep levels) raw cave outlines; see lib/world/room-shape.ts.
 *
 * Content (devices, props, pickups, notes, NPCs, terminals, dressing) is
 * authored in each room's legacy "design rectangle" (map.ts RAW_ROOMS).
 * `ROOM_PLAN[id].at` moves that rectangle to its place on the new plan and
 * everything inside moves with it; `shape` then wraps the room around it.
 * Doors keep their ids and locks — only their position comes from here — so
 * every gate of the game stays exactly as it was. New doors only connect
 * rooms that were reachable without a lock anyway.
 */
import { tr } from "@/lib/i18n";
import { C } from "@/lib/world/content/palette";
import { S, type RoomShape } from "@/lib/world/room-shape";
import type { DoorDef, FloorId, NoteDef, RoomDef } from "@/lib/world/types";

/** Floor grid (voxels). */
export const PLAN_SIZE = { x: 176, z: 160 } as const;

/** The elevator shaft runs through the middle of every core. */
export const CORE = { x: 88, z: 80 } as const;

/** The design rectangle of a room after the move (its content box). */
export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface RoomPlacement {
  /** New top-left corner of the room's design rectangle. */
  at: readonly [number, number];
  /** Shape around the moved box (absolute voxels); default = the box itself. */
  shape?: (b: Box) => RoomShape;
  /** Overrides (name, blurb, theme, colours) — used for the cores. */
  patch?: Partial<Omit<RoomDef, "id" | "floor" | "x" | "z" | "w" | "d" | "shape">>;
}

// ── Shape helpers (all absolute) ─────────────────────────────────

/** The box grown by `g` on every side, optionally chamfered / rounded. */
const grown = (b: Box, g: number, o: { chamfer?: number; round?: number } = {}) =>
  S.rect(b.x - g, b.z - g, b.w + 2 * g, b.d + 2 * g, o);

/** Ellipse around the box centre with radii (half size × f) + g. */
const oval = (b: Box, fx: number, fz = fx, g = 0) =>
  S.ellipse(b.x + b.w / 2, b.z + b.d / 2, (b.w / 2) * fx + g, (b.d / 2) * fz + g);

/** Ring sector (crescent) — curved corridors around a core. Angles in degrees, 0 = +x, 90 = +z. */
function arc(
  cx: number,
  cz: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
  steps = 18,
): RoomShape[number] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * r1, cz + Math.sin(a) * r1]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * r0, cz + Math.sin(a) * r0]);
  }
  return S.poly(...pts);
}

/** Irregular cave outline: an ellipse whose radius wobbles deterministically. */
function blob(
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  seed: number,
  wobble = 0.16,
  n = 22,
): RoomShape[number] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const k = 1 + (h - Math.floor(h) - 0.5) * 2 * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]);
  }
  return S.poly(...pts);
}

/** The core rotunda of a lab level. */
const rotunda = (): RoomShape => [S.ellipse(CORE.x, CORE.z, 24, 22)];

// ── Rooms ────────────────────────────────────────────────────────

export const ROOM_PLAN: Readonly<Record<string, RoomPlacement>> = {
  // ── Level 0 · Upper Deck: the command deck ──────────────────
  aufzug0: {
    at: [80, 70],
    shape: rotunda,
    patch: {
      name: tr("Command Rotunda"),
      blurb: tr(
        "The core of the upper deck. The elevator shaft stands in the middle like a pillar; every corridor starts here. The floor compass still points at the control room.",
      ),
      theme: "hub",
      floorColor: C.floor_tile,
      wallColor: C.wall_dark,
    },
  },
  kontroll: { at: [70, 14], shape: (b) => [grown(b, 3, { chamfer: 11 })] },
  schleuse: { at: [18, 16], shape: (b) => [grown(b, 2, { round: 11 })] },
  mcp: { at: [124, 64], shape: (b) => [oval(b, 1.43, 1.38)] },
  kartenraum: { at: [128, 22], shape: (b) => [grown(b, 2, { chamfer: 8 })] },
  sekundaer: {
    at: [24, 56],
    shape: (b) => [grown(b, 1), S.rect(b.x - 1, b.z + 28, 18, 10, { chamfer: 3 })],
  },
  westflur: { at: [24, 98], shape: (b) => [grown(b, 1, { round: 10 })] },
  werkstatt: {
    at: [70, 114],
    shape: (b) => [
      grown(b, 1, { chamfer: 6 }),
      S.rect(b.x - 10, b.z + 8, 11, 16, { chamfer: 2 }),
      S.rect(b.x + 20, b.z + 36, 14, 8, { chamfer: 3 }),
    ],
  },
  archiv: {
    at: [130, 110],
    shape: (b) => [grown(b, 1), S.ellipse(b.x + b.w / 2, b.z + b.d - 4, 15, 13)],
  },

  // ── Level −1 · Power & Fabrication: the distribution ring ───
  aufzug1: {
    at: [80, 70],
    shape: rotunda,
    patch: {
      name: tr("Distribution Core"),
      blurb: tr(
        "Busbars run in a ring around the elevator shaft, thick as an arm. From here every cable of the level fans out — 847 kW, if the borehole ever answers again.",
      ),
      theme: "hub",
      floorColor: C.floor_grate,
      wallColor: C.wall_dark,
    },
  },
  versorgung: { at: [120, 70], shape: (b) => [grown(b, 1, { round: 9 })] },
  kuehlung: {
    at: [126, 20],
    shape: (b) => [grown(b, 1, { round: 8 }), S.ellipse(b.x + b.w + 1, b.z + 12, 7, 9)],
  },
  lager: {
    at: [126, 104],
    shape: (b) => [
      grown(b, 1, { chamfer: 6 }),
      S.rect(b.x + b.w - 2, b.z + 6, 12, 18, { chamfer: 3 }),
    ],
  },
  batterie: {
    at: [70, 10],
    shape: (b) => [grown(b, 1, { chamfer: 6 }), S.rect(b.x + 10, b.z - 7, 16, 8, { chamfer: 2 })],
  },
  geo: { at: [14, 50], shape: (b) => [oval(b, 1.28, 1.23)] },
  rechen: { at: [22, 108], shape: (b) => [grown(b, 1, { chamfer: 3 })] },
  fertigung: {
    at: [70, 106],
    shape: (b) => [
      S.rect(b.x - 1, b.z - 1, b.w + 2, b.d + 1, { chamfer: 4 }),
      S.rect(b.x - 10, b.z + 12, 11, 20, { chamfer: 2 }),
    ],
  },

  // ── Level −2 · Signals & Anomalies: the listening ring ──────
  aufzug2: {
    at: [80, 70],
    shape: rotunda,
    patch: {
      name: tr("Signal Core"),
      blurb: tr(
        "A round room that swallows every echo — acoustic foam behind perforated steel. The elevator hums a little lower here, as if it were listening too.",
      ),
      theme: "hub",
      floorColor: C.floor_dark,
      wallColor: C.wall_dark,
    },
  },
  messgang: { at: [102, 58], shape: () => [arc(CORE.x, CORE.z, 26, 34, -38, 40)] },
  diagnose: { at: [72, 30], shape: (b) => [grown(b, 1, { chamfer: 5 })] },
  tresor: { at: [122, 18], shape: (b) => [oval(b, 1.38, 1.4)] },
  botdepot: {
    at: [128, 86],
    shape: (b) => [grown(b, 1, { chamfer: 5 }), S.rect(b.x + 6, b.z + b.d, 16, 8, { chamfer: 3 })],
  },
  anomalie: { at: [12, 34], shape: (b) => [blob(b.x + 16, b.z + 18, 23, 26, 7, 0.1)] },
  signal: { at: [16, 96], shape: (b) => [oval(b, 1.32)] },
  hangar: { at: [70, 108], shape: (b) => [grown(b, 1, { round: 6 })] },

  // ── Level −3 · Deep Lab: the forge below the core ───────────
  aufzug3: {
    at: [80, 70],
    shape: rotunda,
    patch: {
      name: tr("Deep Core"),
      blurb: tr(
        "The lowest rotunda of the lab. Frost on the rails of the shaft, cerulean light seeping up from the Forge. Somebody painted a line on the floor: “Beyond this point: think twice.”",
      ),
      theme: "hub",
      floorColor: C.floor_dark,
      wallColor: C.wall_dark,
    },
  },
  vorraum: { at: [116, 70], shape: (b) => [grown(b, 1, { chamfer: 5 })] },
  containment: { at: [126, 20], shape: (b) => [grown(b, 2, { chamfer: 8 })] },
  teleport: { at: [146, 64], shape: (b) => [oval(b, 1.25, 1.25)] },
  quanten: { at: [64, 30], shape: (b) => [grown(b, 1, { round: 8 })] },
  forge: { at: [64, 104], shape: (b) => [grown(b, 1, { round: 16 })] },
  reaktor: { at: [20, 58], shape: (b) => [oval(b, 1.29, 1.18)] },
  rechenkern: {
    at: [20, 110],
    shape: (b) => [grown(b, 1, { chamfer: 5 }), S.ellipse(b.x, b.z + b.d / 2, 8, 12)],
  },
  kaeltearchiv: { at: [118, 114], shape: (b) => [grown(b, 2, { round: 8 })] },

  // ── Level +1 · Living Quarters & Observatory: the garden atrium ─
  aufzug4: {
    at: [80, 70],
    shape: rotunda,
    patch: {
      name: tr("Garden Atrium"),
      blurb: tr(
        "A round atrium with planters around the elevator shaft. Grow lights instead of sky, but the ivy does not seem to mind. Everybody who lives up here passes through.",
      ),
      theme: "hub",
      floorColor: C.floor_beige,
      wallColor: C.wall_beige,
    },
  },
  wohnflur: { at: [100, 44], shape: () => [arc(CORE.x, CORE.z, 26, 33, -112, -46)] },
  jadeq: {
    at: [116, 18],
    shape: (b) => [grown(b, 1, { chamfer: 4 }), S.ellipse(b.x + b.w + 1, b.z + b.d / 2, 6, 10)],
  },
  kantine: {
    at: [120, 66],
    shape: (b) => [grown(b, 1, { round: 6 }), S.rect(b.x + 6, b.z + b.d, 18, 9, { chamfer: 3 })],
  },
  bibliothek: { at: [30, 54], shape: (b) => [grown(b, 1, { chamfer: 8 })] },
  damienq: {
    at: [30, 12],
    shape: (b) => [
      S.poly(
        [b.x - 1, b.z + 4],
        [b.x + 8, b.z - 3],
        [b.x + b.w + 1, b.z - 1],
        [b.x + b.w + 1, b.z + b.d + 1],
        [b.x - 1, b.z + b.d + 1],
      ),
    ],
  },
  gewaechshaus: { at: [70, 104], shape: (b) => [grown(b, 1, { round: 12 })] },
  observatorium: { at: [118, 114], shape: (b) => [oval(b, 1.36, 1.2)] },
  funkraum: {
    at: [32, 134],
    shape: (b) => [grown(b, 1, { chamfer: 3 }), S.ellipse(b.x + 4, b.z + b.d / 2, 7, 8)],
  },

  // ── Level −4 · The Shaft: caves around the pit bottom ───────
  aufzug5: {
    at: [80, 70],
    shape: () => [blob(CORE.x, CORE.z, 23, 22, 3, 0.08)],
    patch: {
      name: tr("Shaft Station"),
      blurb: tr(
        "The bottom of the old mine shaft. The elevator ends in raw rock; timber, rails and a hand-painted sign: “−4. Nobody down here but us.”",
      ),
      theme: "hub",
      floorColor: C.asphalt,
      wallColor: C.concrete,
    },
  },
  sohle: { at: [122, 62], shape: (b) => [blob(b.x + b.w / 2, b.z + b.d / 2, 19, 23, 11, 0.08)] },
  x9kammer: {
    at: [124, 14],
    shape: (b) => {
      const cx = b.x + b.w / 2;
      const cz = b.z + b.d / 2;
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push([cx + Math.cos(a) * 19, cz + Math.sin(a) * 18]);
      }
      return [S.poly(...pts)];
    },
  },
  bohrung: { at: [124, 112], shape: (b) => [oval(b, 1.3)] },
  stollen: {
    at: [16, 72],
    shape: (b) => [
      S.poly(
        [b.x + 1, b.z + 2],
        [b.x + 14, b.z],
        [b.x + 26, b.z + 3],
        [b.x + 38, b.z + 1],
        [b.x + 46, b.z + 4],
        [b.x + 46, b.z + 13],
        [b.x + 36, b.z + 16],
        [b.x + 24, b.z + 13],
        [b.x + 12, b.z + 16],
        [b.x + 1, b.z + 13],
      ),
    ],
  },
  c8versteck: {
    at: [14, 22],
    shape: (b) => [blob(b.x + b.w / 2, b.z + b.d / 2, 19, 21, 23, 0.07)],
  },
  hoehle: { at: [46, 110], shape: (b) => [blob(b.x + b.w / 2, b.z + b.d / 2, 25, 24, 5, 0.08)] },
  truemmer: { at: [8, 104], shape: (b) => [blob(b.x + b.w / 2, b.z + b.d / 2, 16, 23, 17, 0.07)] },
};

// ── New connecting rooms ─────────────────────────────────────────

function corridor(
  id: string,
  floor: FloorId,
  name: string,
  blurb: string,
  shape: RoomShape,
  extra: Partial<RoomDef> = {},
): RoomDef {
  return {
    id,
    floor,
    name,
    x: 0,
    z: 0,
    w: 0,
    d: 0,
    floorColor: C.floor_dark,
    wallColor: C.wall,
    blurb,
    theme: "corridor",
    shape,
    ...extra,
  };
}

export const PLAN_ROOMS: readonly RoomDef[] = [
  corridor(
    "kabelgang",
    0,
    tr("Cable Passage"),
    tr(
      "A bent service passage from the control room to the MCP. Cables in bundles as thick as a thigh, all of them warm.",
    ),
    [S.poly([110, 30], [123, 30], [123, 63], [116, 63], [116, 38], [110, 38])],
  ),
  corridor(
    "archivgang",
    0,
    tr("Archive Passage"),
    tr(
      "A narrow passage to the archive. The door at the end has been electric since 1998 and stubborn since 2019.",
    ),
    [S.rect(107, 128, 22, 8)],
  ),
  corridor(
    "kuehlgang",
    1,
    tr("Coolant Passage"),
    tr("Frost on the pipes, condensation on the floor. The cold side of the battery room."),
    [S.rect(107, 26, 18, 8)],
    { theme: "cooling", floorColor: C.floor_grate },
  ),
  corridor(
    "strahlengang",
    2,
    tr("Radiation Lock"),
    tr(
      "A lead-lined lock between the diagnostics room and the anomaly chamber. The dosimeter on the wall has stopped counting.",
    ),
    [S.rect(56, 34, 15, 10, { chamfer: 2 })],
    { theme: "airlock", floorColor: C.floor_grate, wallColor: C.wall_olive },
  ),
  corridor(
    "gartengang",
    4,
    tr("Garden Passage"),
    tr(
      "From the library down to the greenhouse, around a corner. Somebody planted mint in the cable duct. It is winning.",
    ),
    [S.poly([34, 108], [43, 108], [43, 120], [69, 120], [69, 129], [34, 129])],
    { floorColor: C.carpet_green, wallColor: C.wall_beige },
  ),
  // Damien's hidden sound studio behind the listening ring's outer wall
  // (lib/world/content/studio.ts: props, puzzle, hints; the studio UI).
  corridor(
    "studio",
    2,
    tr("Damien's Sound Studio (secret)"),
    tr(
      "Behind the listening ring's outer wall: a studio no plan admits to. A mixing desk under a dust cover, monitors, tape machines, a synthesizer with a note on it: “Play it loud. The lab likes music.”",
    ),
    [S.rect(122, 60, 36, 22)],
    { theme: "audio", floorColor: C.carpet_red, wallColor: C.wall_dark },
  ),
];

// ── Doors ────────────────────────────────────────────────────────

export interface DoorPlacement {
  x: number;
  z: number;
  axis: "x" | "z";
  width?: number;
}

/** Positions of the existing doors (ids and locks live in map.ts). */
export const DOOR_PLAN: Readonly<Record<string, DoorPlacement>> = {
  // Level 0
  d_aufzug0: { x: 115, z: 80, axis: "z" },
  d_schleuse: { x: 67, z: 28, axis: "z" },
  d_mcp: { x: 109, z: 34, axis: "z" },
  d_sekundaer: { x: 53, z: 72, axis: "z" },
  d_westflur: { x: 32, z: 94, axis: "x" },
  d_werkstatt: { x: 88, z: 113, axis: "x" },
  d_westwerk: { x: 53, z: 128, axis: "z" },
  d_archiv: { x: 129, z: 132, axis: "z" },
  d_kartenraum: { x: 140, z: 57, axis: "x" },
  // Level −1
  d_aufzug1: { x: 115, z: 80, axis: "z" },
  d_fertigung: { x: 88, z: 105, axis: "x" },
  d_kuehlung: { x: 142, z: 69, axis: "x" },
  d_lager: { x: 142, z: 91, axis: "x" },
  d_batterie: { x: 88, z: 47, axis: "x" },
  d_geo: { x: 59, z: 80, axis: "z" },
  d_rechen: { x: 32, z: 104, axis: "x" },
  d_rechenfert: { x: 60, z: 128, axis: "z" },
  d_kuehlbatt: { x: 125, z: 30, axis: "z" },
  // Level −2
  d_aufzug2: { x: 113, z: 80, axis: "z" },
  d_diagnose: { x: 88, z: 51, axis: "x" },
  d_anomalie: { x: 71, z: 39, axis: "z" },
  d_signal: { x: 69, z: 120, axis: "z" },
  d_hangar: { x: 88, z: 107, axis: "x" },
  d_anosig: { x: 30, z: 84, axis: "x" },
  d_tresor: { x: 105, z: 40, axis: "z" },
  d_botdepot: { x: 127, z: 95, axis: "z" },
  // Level −3
  d_aufzug3: { x: 115, z: 80, axis: "z" },
  d_forge: { x: 88, z: 103, axis: "x" },
  d_containment: { x: 130, z: 69, axis: "x" },
  d_teleport: { x: 141, z: 80, axis: "z" },
  d_reaktor: { x: 58, z: 80, axis: "z" },
  d_rechenkern: { x: 62, z: 130, axis: "z" },
  d_quanten: { x: 88, z: 47, axis: "x" },
  d_kaeltearchiv: { x: 114, z: 126, axis: "z" },
  // Level +1
  d_aufzug4: { x: 88, z: 56, axis: "x" },
  d_jadeq: { x: 116, z: 50, axis: "z" },
  d_kantine: { x: 115, z: 80, axis: "z" },
  d_bibliothek: { x: 61, z: 80, axis: "z" },
  d_kantbib: { x: 132, z: 58, axis: "x" },
  d_damienq: { x: 44, z: 53, axis: "x" },
  d_gewaechshaus: { x: 69, z: 124, axis: "z" },
  d_observatorium: { x: 103, z: 144, axis: "z" },
  d_funkraum: { x: 69, z: 141, axis: "z" },
  // Level −4
  d_aufzug5: { x: 114, z: 80, axis: "z" },
  d_x9kammer: { x: 136, z: 54, axis: "x" },
  d_stollen: { x: 63, z: 80, axis: "z" },
  d_hoehle: { x: 78, z: 106, axis: "x" },
  d_c8versteck: { x: 26, z: 71, axis: "x" },
  d_truemmer: { x: 40, z: 128, axis: "z" },
  d_bohrung: { x: 136, z: 105, axis: "x" },
};

function door(
  id: string,
  floor: FloorId,
  x: number,
  z: number,
  axis: "x" | "z",
  width = 5,
): DoorDef {
  return { id, floor, x, z, axis, width };
}

/** Doors of the new corridors and cores. */
export const PLAN_DOORS: readonly DoorDef[] = [
  door("d_kern0_kontroll", 0, 88, 49, "x"),
  door("d_kabelgang_mcp", 0, 119, 63, "x"),
  door("d_werk_archivgang", 0, 107, 132, "z"),
  door("d_batt_kuehlgang", 1, 107, 30, "z"),
  door("d_strahlengang", 2, 56, 39, "z"),
  door("d_gartengang", 4, 38, 107, "x"),
  {
    ...door("d_studio", 2, 122, 76, "z"),
    secret: true,
    lock: { puzzle: "pz_studio_door" },
    lockHint: tr(
      "The outer wall of the ring is covered in acoustic foam — except for one panel with eight small keys. It is waiting for a song.",
    ),
  },
];

// ── Notes in the new passages ────────────────────────────────────

/** Notes found in the new corridors (authored directly on the floor plan). */
export const PLAN_NOTES: readonly NoteDef[] = [
  {
    id: "n_kabelgang_label",
    floor: 0,
    x: 120,
    z: 50,
    title: tr("Cable Passage — Label"),
    author: "mcp",
    body: tr(
      "Cable run MCP-000 ↔ Control Room. 412 conductors, 411 of them labelled. The unlabelled one carries my thoughts to your console, Dr. Lawrence. Please do not step on it.",
    ),
    model: "paper",
  },
  {
    id: "n_archivgang_tritt",
    floor: 0,
    x: 112,
    z: 130,
    title: tr("Archive Door — Maintenance"),
    author: "damien",
    body: tr(
      "The door jams whenever the power sags. Kick it at knee height, left of the handle. Jade says that is not a maintenance procedure. It works. — D.",
    ),
    model: "paper",
  },
  {
    id: "n_kuehlgang_frost",
    floor: 1,
    x: 115,
    z: 28,
    title: tr("Frost Log"),
    author: "jade",
    body: tr(
      "Condensation again. If the battery room freezes over, the cells lose 3 % per degree. I wrote this on the frosted pipe with my finger. Then on paper, because the pipe forgets.",
    ),
    model: "paper",
  },
  {
    id: "n_strahlengang_dosimeter",
    floor: 2,
    x: 62,
    z: 36,
    title: tr("Dosimeter Tape"),
    author: "unbekannt",
    body: tr(
      "Dose 14 Feb 2019, 03:27: off the scale. Dose 14 Feb 2019, 03:28: zero. Nothing in between. Dosimeters do not skip. This one did.",
    ),
    model: "tape",
  },
  {
    id: "n_gartengang_minze",
    floor: 4,
    x: 37,
    z: 125,
    title: tr("Mint"),
    author: "damien",
    body: tr(
      "I planted mint in the cable duct — an experiment on persistence. The mint won. Take some for tea. Do not tell Jade it is in the duct.",
    ),
    model: "paper",
  },
  // ── The studio trail (content/studio.ts) ──
  {
    id: "n_studio_frag1",
    floor: 0,
    x: 150,
    z: 118,
    title: tr("Tape Label (torn)"),
    author: "damien",
    body: tr(
      "JL — the song for the door, bars 1–2:  3 · 5\n\nThe rest is on the other two pieces. Never keep a song in one place. Songs in one place get deleted.",
    ),
    model: "tape",
    grants: ["studio_frag1"],
  },
  {
    id: "n_studio_frag2",
    floor: 3,
    x: 160,
    z: 118,
    title: tr("Frosted Lid"),
    author: "damien",
    body: tr(
      "…then climb to 8 and let it fall to 6.\n\nIf you found this in the cold, you found the hardest piece. — D.",
    ),
    model: "paper",
    grants: ["studio_frag2"],
  },
  {
    id: "n_studio_frag3",
    floor: 4,
    x: 58,
    z: 137,
    title: tr("Radio Log, Back Side"),
    author: "damien",
    body: tr(
      "Last part: 7 · 5. Never end on the 1 — it is not finished. Neither are we.\n\nThe door listens on Level −2, where the ring listens too.",
    ),
    model: "paper",
    grants: ["studio_frag3"],
  },
  {
    id: "n_messgang_foam",
    floor: 2,
    x: 118,
    z: 88,
    title: tr("Maintenance Note: Foam"),
    author: "bot",
    body: tr(
      "Panel 7 in the foam of the Signal Core is not foam. It is foam-coloured, and it has keys. Do not tap on them. The wall behind this ring hums back. — L0G-1K",
    ),
    model: "paper",
  },
  {
    id: "n_damienq_pad18",
    floor: 4,
    x: 40,
    z: 30,
    title: tr("Legal Pad #18"),
    author: "damien",
    body: tr(
      "If the lab ever goes too quiet: the ring on −2 listens both ways. I left J. a song in three pieces — where the files sleep, where the cold keeps things, where the radio talks to nobody.",
    ),
    model: "paper",
  },
  {
    id: "n_studio_log",
    floor: 2,
    x: 152,
    z: 64,
    title: tr("Session Log #212"),
    author: "damien",
    body: tr(
      "The lab plays itself now: calm for the quarters, rhythm for the forge, glass for the deep floors, a little swing for the kantine. The desk lets you choose. Mixer, keys, a sequencer, every sound this place makes. If you are reading this, Jade: the fader on the left is yours. — D.",
    ),
    model: "tape",
  },
];

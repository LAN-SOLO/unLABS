/**
 * Map look: room tints, category colours and icon glyphs.
 *
 * Every category has its own SHAPE (square, circle, diamond, hexagon, page,
 * person, gear, monitor, star, lift, bar, ring) so the map stays readable
 * without colour; the status adds a second cue (fill vs. outline, dashed,
 * dimmed, badge) on top of the colour.
 */
import type { MapCategory, MapStatus } from "@/lib/world/map-data";
import type { RoomTheme } from "@/lib/world/types";

/** Room floor tint per interior theme (dark, desaturated; lit rooms get brighter). */
export const THEME_TINT: Record<RoomTheme, string> = {
  control: "#1d3b2a",
  server: "#1b2940",
  office: "#3a3222",
  corridor: "#23262b",
  workshop: "#2b3322",
  archive: "#1d3438",
  airlock: "#2e3128",
  elevator: "#33301c",
  geothermal: "#3a2a1c",
  power: "#1f2a3a",
  cooling: "#1c3040",
  factory: "#2f2f28",
  storage: "#35302a",
  audio: "#2d2238",
  anomaly: "#2a1c3a",
  lab: "#26302f",
  hangar: "#2f2d28",
  vault: "#1f3033",
  botdepot: "#2c2f24",
  forge: "#241c30",
  reactor: "#3a2a1c",
  containment: "#2a2040",
  portal: "#1c2440",
  cryo: "#1c3444",
  quarters: "#3a2c28",
  greenhouse: "#1f3a22",
  observatory: "#1c2036",
  generic: "#26282c",
};

/** Base colour per category (Okabe-Ito inspired, tuned for the dark CRT background). */
export const CATEGORY_COLOR: Record<MapCategory, string> = {
  device: "#56B4E9",
  item: "#FFB800",
  slice: "#E91E8C",
  cache: "#E69F00",
  note: "#E8F4FF",
  npc: "#9AD0FF",
  station: "#2ED3A3",
  terminal: "#A0FFA0",
  puzzle: "#F0E442",
  elevator: "#D8C98A",
  door: "#FF6B6B",
  decor: "#8FA3B8",
};

/** Device status colours (the classic minimap code: green online, orange starved, cyan blueprint). */
const DEVICE_STATUS_COLOR: Partial<Record<MapStatus, string>> = {
  online: "#33FF33",
  starved: "#FF6B00",
  off: "#9AA0A6",
  building: "#FFB800",
  blueprint: "#00FFFF",
};

const DOOR_STATUS_COLOR: Partial<Record<MapStatus, string>> = {
  door_locked: "#FF3333",
  door_keypad: "#FFB800",
  door_secret: "#E91E8C",
  door_suspected: "#B388FF",
};

/** Fill colour of an entity icon. */
export function entityColor(category: MapCategory, status: MapStatus): string {
  if (category === "device") return DEVICE_STATUS_COLOR[status] ?? CATEGORY_COLOR.device;
  if (category === "door") return DOOR_STATUS_COLOR[status] ?? CATEGORY_COLOR.door;
  if (status === "blocked" || status === "locked") return "#9AA0A6";
  return CATEGORY_COLOR[category];
}

/** Outline-only statuses (not built yet, only located). */
export function entityHollow(status: MapStatus): boolean {
  return status === "blueprint" || status === "located" || status === "door_suspected";
}

export type Badge = "check" | "bang" | "lock" | "dot" | "q" | null;

/** Small corner badge: a second, colour-independent status cue. */
export function entityBadge(status: MapStatus): Badge {
  switch (status) {
    case "taken":
    case "read":
    case "solved":
    case "used":
    case "door_secret":
      return "check";
    case "starved":
    case "partial":
      return "bang";
    case "locked":
    case "blocked":
    case "door_locked":
    case "door_keypad":
      return "lock";
    case "unread":
    case "dormant":
      return "dot";
    case "located":
    case "door_suspected":
      return "q";
    default:
      return null;
  }
}

/**
 * Icon glyph paths per category in a unit box (−1…1). Drawn with a dark
 * outline so they read on every room tint.
 */
export const GLYPH: Record<MapCategory, string> = {
  device: "M-0.8,-0.8H0.8V0.8H-0.8Z",
  item: "M0.8,0A0.8,0.8 0 1 1 -0.8,0A0.8,0.8 0 1 1 0.8,0Z",
  slice: "M0,-1L0.9,0L0,1L-0.9,0Z",
  cache: "M-0.45,-0.85H0.45L0.95,0L0.45,0.85H-0.45L-0.95,0Z",
  note: "M-0.7,-0.9H0.35L0.7,-0.55V0.9H-0.7Z",
  npc: "M0.36,-0.5A0.36,0.36 0 1 1 -0.36,-0.5A0.36,0.36 0 1 1 0.36,-0.5ZM-0.8,0.9Q-0.8,0 0,0Q0.8,0 0.8,0.9Z",
  station:
    "M-0.35,-0.9H0.35L0.9,-0.35V0.35L0.35,0.9H-0.35L-0.9,0.35V-0.35ZM0.3,0A0.3,0.3 0 1 0 -0.3,0A0.3,0.3 0 1 0 0.3,0Z",
  terminal: "M-0.9,-0.8H0.9V0.45H-0.9ZM-0.25,0.45H0.25V0.7H0.55V0.9H-0.55V0.7H-0.25Z",
  puzzle:
    "M0,-1L0.24,-0.33L0.95,-0.31L0.39,0.13L0.59,0.81L0,0.41L-0.59,0.81L-0.39,0.13L-0.95,-0.31L-0.24,-0.33Z",
  elevator: "M-0.85,-0.85H0.85V0.85H-0.85ZM0,-0.65L0.4,-0.1H-0.4ZM0,0.65L0.4,0.1H-0.4Z",
  door: "M-0.95,-0.35H0.95V0.35H-0.95Z",
  decor: "M0.55,0A0.55,0.55 0 1 1 -0.55,0A0.55,0.55 0 1 1 0.55,0Z",
};

/** Glyph fill rule (holes in station / elevator glyphs). */
export const GLYPH_EVENODD: ReadonlySet<MapCategory> = new Set<MapCategory>([
  "station",
  "elevator",
]);

/** Icon radius in voxels at zoom 1 (large map) — HUD minimap uses its own. */
export const ICON_RADIUS = 1.9;
export const MINI_ICON_RADIUS = 1.9;

/** Draw order: bigger/important things on top. */
export const CATEGORY_Z: Record<MapCategory, number> = {
  decor: 0,
  door: 1,
  elevator: 2,
  station: 3,
  terminal: 3,
  item: 4,
  cache: 5,
  note: 5,
  puzzle: 6,
  device: 7,
  npc: 8,
  slice: 9,
};

/** Metres per voxel (walls are 8 voxels ≈ 3.2 m). */
export const METRES_PER_VOXEL = 0.4;

/** Map colours of the CRT look. */
export const MAP_COLORS = {
  bg: "#070a08",
  wall: "#7d8a7f",
  wallVisited: "#b9c7a8",
  amber: "#FFB800",
  cyan: "#00FFFF",
  magenta: "#E91E8C",
  text: "#d8ffd8",
} as const;

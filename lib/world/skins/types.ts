/**
 * Lab skins — walls and floors as a designed, dynamic surface (docs/SKINS.md).
 *
 * Pure types. A room's skin is a concept (`RoomSkin`: wall family, floor
 * family, bands, glyphs, presets) that the generator in `voxels.ts` turns
 * into voxels on the fine lattice (4 per source voxel, like device detail).
 * Three palette indices are dynamic channels whose colour the renderer
 * tints per room at runtime: `skin_line`, `skin_node`, `skin_field`.
 */
import type { ColorName } from "@/lib/world/content/palette";

/** A surface colour: a fixed palette colour or one of the three dynamic channels. */
export type Paint = ColorName | "line" | "node" | "field";

/** How a channel's brightness moves over time (mirrored by the shader, see modes.ts). */
export type SkinMode =
  | "static"
  | "breathe"
  | "pulse"
  | "heartbeat"
  | "chase"
  | "scan"
  | "ripple"
  | "flicker"
  | "twinkle"
  | "rain"
  | "meter"
  | "cycle"
  | "alarm"
  | "reactive"
  | "daylight"
  | "off";

/** Live game value a reactive skin follows (0 … 1). */
export type SkinSource =
  | "none"
  | "power"
  | "load"
  | "heat"
  | "signal"
  | "charge"
  | "clarity"
  | "clock";

/** A mood: colours and motion for the three channels. One geometry, many moods. */
export interface SkinPreset {
  id: string;
  name: string;
  /** Line channel (seams, outlines, guide lines). `#000000` = dark. */
  line: string;
  /** Second line colour for `cycle` (line → line2 → line). */
  line2?: string;
  /** Node channel (LEDs, keyholes, veins, stars). */
  node: string;
  /** Field channel (panel faces). */
  field: string;
  /** How much the field glows by itself: 0 = paint, 1 = light box. */
  fieldGlow: number;
  mode: SkinMode;
  /** Motion speed multiplier (1 = the mode's base tempo). */
  speed: number;
  /** Overall brightness 0 … 1. */
  intensity: number;
  source?: SkinSource;
  /** Reference picture(s) of the user's mood board (docs/SKINS.md § References). */
  ref?: number[];
}

export type WallFamily =
  | "grid"
  | "rack"
  | "rib"
  | "facet"
  | "acoustic"
  | "wainscot"
  | "tile"
  | "plate"
  | "glass"
  | "rock"
  | "brick"
  | "screen"
  | "pegboard"
  | "drawers";

/** Horizontal content band inside the panel zone (fine rows v0 … v1, inclusive). */
export interface Band {
  v0: number;
  v1: number;
  kind:
    | "books"
    | "notebooks"
    | "pads"
    | "cables"
    | "pipes"
    | "busbar"
    | "coils"
    | "ruler"
    | "morse"
    | "plants"
    | "threads"
    | "light"
    | "hazard"
    | "frost"
    | "duct";
  /** Material of pipes / bars where the kind has one (default per kind). */
  paint?: Paint;
}

export type GlyphSet = "tetro" | "tools" | "digits" | "trefoil" | "keyholes" | "chevrons";

export interface WallSpec {
  family: WallFamily;
  /** Panel module width in fine voxels (4 = one source voxel). */
  panel: number;
  /** Panel rows in the 24-fine panel zone (between base and cap). */
  rows: number;
  /** Seam width in fine voxels. */
  seam: number;
  /** Seams recessed by one fine voxel (relief) or flush. */
  relief: "inset" | "flat";
  base: "plain" | "hazard" | "glow" | "wood";
  paint: {
    panel: Paint;
    seam: Paint;
    base: Paint;
    cap: Paint;
    inlay: Paint;
    dark: Paint;
    accent: Paint;
    /** Wainscot dado fill (below the chair rail). */
    dado: Paint;
  };
  /** Wainscot dado below the chair rail: raised panels, beadboard, shiplap boards or tiles. */
  dado: "raised" | "bead" | "board" | "tile";
  /** Every n-th panel column is a dark panel (0 = none). */
  dark: number;
  /** Share of panels with an inlay glyph (0 … 1). */
  inlays: number;
  glyphs: GlyphSet;
  /** LED node pairs at the mid seam crossings. */
  nodes: boolean;
  /** Each panel carries a one-voxel rim in `accent`. */
  bezel: boolean;
  bands: Band[];
  /** Above-head moulding in the room (y 7–8 beside the wall). */
  cornice: "none" | "chamfer" | "cove";
  /** Pillar / rib every n source voxels along the wall (0 = none). */
  pillar: number;
  /** Glowing cracks (carved) across the wall. */
  cracks: boolean;
  /** Channel the wall cracks glow on — "node" keeps an ember under emergency light. */
  crackGlow: "line" | "node";
}

export type FloorFamily =
  | "tiles"
  | "checker"
  | "tread"
  | "grate"
  | "raised"
  | "guide"
  | "rings"
  | "planks"
  | "parquet"
  | "terrazzo"
  | "epoxy"
  | "concrete"
  | "gravel"
  | "beds"
  | "stars"
  | "carpet";

export interface FloorSpec {
  family: FloorFamily;
  /** Tile / plank module in fine voxels. */
  tile: number;
  paint: {
    a: Paint;
    b: Paint;
    grout: Paint;
    border: Paint;
    line: Paint;
    node: Paint;
  };
  /** Light inlays: guide lines and diamond markers (ref 7 / 9). */
  lines: "none" | "center" | "sides" | "both";
  diamonds: boolean;
  /** Cracks with a node glow (geothermal, anomaly). */
  cracks: boolean;
}

/** One room's concept. Text is English; German lives in lib/i18n/de/skins.ts. */
export interface RoomSkin {
  room: string;
  /** Concept name. */
  title: string;
  /** The idea in two or three sentences. */
  idea: string;
  wall: WallSpec;
  floor: FloorSpec;
  /** Room-specific mood (the default after a fresh start). */
  signature: SkinPreset;
  /** Further presets offered first for this room (library ids). */
  alts: string[];
  /** Game events that take over the skin for a moment. */
  events: string[];
  /** Reference pictures that shaped the concept. */
  ref: number[];
}

/** A player's setting for one room (surveillance station → Skins). */
export interface SkinSetting {
  preset: string;
  /** Optional overrides of the preset. */
  line?: string;
  node?: string;
  field?: string;
  mode?: SkinMode;
  speed: number;
  intensity: number;
  /** Settings of this room are mirrored to the whole floor / lab. */
  sync: "room" | "floor" | "lab";
}

/** Everything the renderer needs for one room this frame. */
export interface ResolvedSkin {
  line: string;
  line2: string;
  node: string;
  field: string;
  fieldGlow: number;
  mode: SkinMode;
  speed: number;
  intensity: number;
  source: SkinSource;
}

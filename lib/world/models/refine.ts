/**
 * Lab refinement profiles (pure — no three; usable from Node / the book).
 * ======================================================================
 *
 * Every rendered voxel is split into 2×2×2 sub-voxels by
 * `lib/voxel/refine.ts`. This module supplies the lab-specific inputs:
 * explicit partner colours from the lab palette (darker partner for seams,
 * grooves and skirting; lighter partner for rivets, wear and wall rims),
 * the screen / LED tables and one rule set per model family.
 *
 * Game logic never sees refined grids: collision, raycasts, pathfinding,
 * zones and all placements keep using the source models and the logical
 * world. `refinedModelMesh` meshes the 2× grid at half the voxel size, so a
 * mesh has exactly the source model's extent in the source's units.
 *
 * Models authored at the refined resolution already (the lore bots, the MCP
 * avatar and the humanoid rigs: half the voxel edge, twice the voxel counts,
 * flagged `fine` on their `DeviceVisual` / `CharacterRigDef`) use the family
 * "hires": `refineModel` returns them unchanged and `refinedModelMesh` meshes
 * them as they are — they are never split a second time.
 */
import { VoxelGrid, type Vec3 } from "@/lib/voxel/grid";
import { greedyMesh, type MaterialClass, type MeshData } from "@/lib/voxel/mesher";
import { refineGrid, refineRegion, type RefineOptions, type RefineRules } from "@/lib/voxel/refine";
import type { VoxelSource } from "@/lib/voxel/grid";
import { C, LAB_PALETTE, labMaterialOf, type ColorName } from "@/lib/world/content/palette";

/** Which rule set a model is refined with. */
export type RefineFamily =
  /** Devices, room terminals, the MCP avatar: richest detail. */
  | "device"
  /** Doors, frames, elevator cages (MODEL_SCALE). */
  | "architecture"
  /** Props and hero props (MODEL_SCALE). */
  | "prop"
  /** Classic decor at MODEL_SCALE. */
  | "decor"
  /** Small-detail decor (DETAIL_SCALE) and hand props: subdivision + light bevel only. */
  | "detail"
  /** Jointed characters and lore bots. */
  | "character"
  /** Pickups and notes on the floor. */
  | "pickup"
  /** Lab terrain (floors, walls, trims) — see `refineTerrainRegion`. */
  | "terrain"
  /** Plain subdivision (no detail rules). */
  | "plain"
  /**
   * Already fine (authored at half the voxel edge with its own bevels,
   * seams and LEDs): no subdivision at all — meshed as authored.
   */
  | "hires";

/** Rule set per family. Periods are in source voxels (0.25-scale devices: 8 ≙ 2 world units). */
export const REFINE_RULES: Readonly<Record<RefineFamily, RefineRules>> = {
  device: {
    bevel: 3,
    thinLines: true,
    seams: [8, 8, 8],
    grooves: true,
    rivets: true,
    wear: 0.03,
    scanlines: true,
    leds: true,
  },
  architecture: {
    bevel: 3,
    thinLines: true,
    seams: [4, 4, 4],
    grooves: true,
    rivets: true,
    wear: 0.03,
    scanlines: true,
    leds: true,
  },
  prop: {
    bevel: 3,
    thinLines: true,
    seams: [4, 4, 4],
    grooves: true,
    rivets: true,
    wear: 0.03,
    scanlines: true,
    leds: true,
  },
  decor: {
    bevel: 3,
    thinLines: true,
    seams: [6, 6, 6],
    wear: 0.03,
    scanlines: true,
    leds: true,
  },
  detail: { bevel: 4 },
  character: { bevel: 3, scanlines: true, leds: true },
  pickup: { bevel: 3, wear: 0.03, leds: true },
  terrain: {
    bevel: 3,
    thinLines: true,
    // Walls: panel joints every 4 along the wall (grooved, staggered per
    // face on 1-voxel walls) and a painted seam at y = 4.
    seams: [4, 4, 4],
    topSeams: [0, 0, 0],
    grooves: true,
    thinGrooves: true,
    // Floors: grooved tile joints (period per colour, see FLOOR_JOINTS).
    floorGrooves: { y: 0 },
    skirtingY: 1,
    topRim: true,
    rimMinY: 1,
    scanlines: true,
    leds: true,
  },
  plain: {},
  hires: {},
};

/** Family for a model that may be authored fine (`fine: true` → "hires"). */
export function familyFor(model: { fine?: boolean }, family: RefineFamily): RefineFamily {
  return model.fine ? "hires" : family;
}

type Partner = readonly [dark: ColorName | null, light: ColorName | null];

/**
 * Explicit partner colours: [darker, lighter]. Partners keep the material
 * class (metal ↔ metal, solid ↔ solid). Colours without an entry get no
 * seams / wear (fabrics, cables, glass, emissives).
 */
export const PARTNERS: Readonly<Partial<Record<ColorName, Partner>>> = {
  // metals
  metal_dark: ["metal_dark_dk", "metal_dark_lt"],
  steel_dark: ["steel_dark_dk", "steel_dark_lt"],
  steel: ["steel_dk", "aluminium"],
  metal: ["metal_dark", "metal_light"],
  door_panel: ["metal_dark", "metal_light"],
  chrome: ["aluminium", "chrome_lt"],
  aluminium: ["steel", "chrome"],
  metal_light: ["steel_dark", "steel"],
  copper: ["bronze", "copper_lt"],
  brass: ["brass_dk", "gold"],
  bronze: ["iron_rust", "copper"],
  gold: ["brass", "gold_lt"],
  iron_rust: ["iron_rust_dk", "bronze"],
  floor_grate: ["metal", "metal_light"],
  bot_body: ["steel_dk", "aluminium"],
  bot_dark: ["metal_dark", "steel_dark"],
  door_frame: ["door_frame_dk", "door_frame_lt"],
  goggles: ["door_frame_dk", "door_frame_lt"],
  // paints & plastics
  black: [null, "paint_black"],
  hazard_black: ["black", null],
  paint_black: ["black", "paint_black_lt"],
  paint_white: ["paint_white_dk", "white"],
  white: ["paint_white", null],
  paint_gray: ["paint_gray_dk", "paint_gray_lt"],
  paint_cream: ["tile_cream", "paper"],
  red_paint: ["paint_brick", "flower_red"],
  safety_red: ["book_red", "flower_red"],
  blue_paint: ["blue_paint_dk", null],
  safety_blue: ["badge_blue", null],
  safety_yellow: ["yellow_paint", "paper_yellow"],
  yellow_paint: ["cable_yellow", "safety_yellow"],
  safety_orange: ["orange_paint", null],
  orange_paint: ["orange_paint_dk", "safety_orange"],
  purple_paint: ["purple_paint_dk", null],
  green_paint: ["green_paint_dk", null],
  paint_teal: ["paint_teal_dk", null],
  paint_navy: ["paint_black", null],
  paint_mint: ["paint_mint_dk", null],
  paint_brick: ["brick", null],
  beige: ["beige_dk", "paint_cream"],
  cardboard: ["wood", null],
  // wood
  walnut: ["walnut_dk", "walnut_grain"],
  oak: ["oak_grain", "wood_light"],
  wood: ["wood_grain", "wood_light_grain"],
  wood_dark: ["wood_dark_grain", "wood_grain"],
  wood_light: ["wood_light_grain", null],
  // stone
  concrete_light: ["concrete", "dust"],
  concrete: ["concrete_dark", "concrete_light"],
  concrete_dark: ["rock", "concrete"],
  rock: ["rock_dark", null],
  brick: ["wood_red", null],
  asphalt: ["tile_black", null],
  // architecture: walls, trims, floors
  wall: ["wall_dk", "wall_lt"],
  wall_dark: ["wall_dark_dk", "wall_dk"],
  wall_trim: ["trim_dk", "trim_lt"],
  wall_olive: ["olive_dk", "olive_lt"],
  olive: ["olive_dk", "olive_lt"],
  wall_teal: ["teal_dk", "teal_lt"],
  teal: ["teal_dk", "teal_lt"],
  wall_beige: ["wall_beige_dk", "wall_beige_lt"],
  floor_dark: ["tile_black", "floor_tile"],
  floor_tile: ["floor_dark", "wall_dark"],
  tile_black: ["black", "floor_dark"],
  tile_white: ["tile_white_dk", "white"],
  tile_cream: ["tile_cream_dk", "paint_cream"],
  tile_teal: ["tile_teal_dk", null],
  floor_forge: ["black", null],
  floor_purple: ["floor_forge", null],
  floor_green: ["carpet_green", null],
  floor_blue: ["carpet_blue", null],
  floor_red: ["floor_red_dk", null],
  floor_beige: ["floor_beige_dk", null],
};

/** Screen colours → the dim sub-row colour of their scanlines. */
const SCREEN_COLORS: readonly ColorName[] = [
  "screen_green",
  "screen_amber",
  "screen_cyan",
  "screen_red",
  "screen_blue",
  "screen_white",
  "screen_purple",
];
/** Lone LED voxels → one lit sub-voxel in a bezel of this colour. */
const LED_COLORS: readonly ColorName[] = [
  "led_red",
  "led_green",
  "led_amber",
  "led_blue",
  "led_white",
  "led_pink",
];

function table(fill: (t: Uint8Array) => void): Uint8Array {
  const t = new Uint8Array(256);
  fill(t);
  return t;
}

export const DARK_PARTNER = table((t) => {
  for (const [name, p] of Object.entries(PARTNERS) as [ColorName, Partner][])
    if (p[0]) t[C[name]] = C[p[0]];
});
export const LIGHT_PARTNER = table((t) => {
  for (const [name, p] of Object.entries(PARTNERS) as [ColorName, Partner][])
    if (p[1]) t[C[name]] = C[p[1]];
});
export const SCAN_DIM = table((t) => {
  for (const n of SCREEN_COLORS) t[C[n]] = C.scan_dim;
});
/**
 * Floor joint period per colour: tiles every 2 voxels, poured / plated
 * floors every 4 (expansion joints). Paint, wood, carpet, soil: none.
 */
const FLOOR_JOINTS: Readonly<Partial<Record<ColorName, number>>> = {
  floor_dark: 2,
  floor_tile: 2,
  wall_dark: 2,
  tile_black: 2,
  tile_white: 2,
  tile_cream: 2,
  tile_teal: 2,
  floor_green: 2,
  floor_blue: 2,
  floor_red: 2,
  floor_purple: 2,
  floor_beige: 2,
  floor_forge: 2,
  metal_dark: 2,
  floor_grate: 2,
  concrete: 4,
  concrete_light: 4,
  concrete_dark: 4,
  asphalt: 4,
  rock: 4,
};
/** Poured floors whose per-voxel colour mottling counts as one surface for joints. */
const POURED: readonly ColorName[] = [
  "concrete",
  "concrete_light",
  "concrete_dark",
  "asphalt",
  "rock",
];
export const JOINT_FAMILY = table((t) => {
  for (const n of POURED) t[C[n]] = C.concrete;
});
export const JOINT_PERIOD = table((t) => {
  for (const [name, p] of Object.entries(FLOOR_JOINTS) as [ColorName, number][]) t[C[name]] = p;
});
export const LED_BEZEL = table((t) => {
  for (const n of LED_COLORS) t[C[n]] = C.led_bezel;
});

/** Refinement options for a family (lab palette partners, lab material classes). */
export function labRefineOptions(
  family: RefineFamily,
  materialOf: (i: number) => MaterialClass = labMaterialOf,
): RefineOptions {
  return {
    materialOf,
    dark: DARK_PARTNER,
    light: LIGHT_PARTNER,
    scan: SCAN_DIM,
    bezel: LED_BEZEL,
    joints: JOINT_PERIOD,
    jointFamily: JOINT_FAMILY,
    rules: REFINE_RULES[family],
    seed: 0x5eed,
  };
}

/**
 * Refine a model grid with a family's rules (2× grid; same world extent at
 * half the scale). "hires" models are already fine: returned unchanged.
 */
export function refineModel(
  grid: VoxelGrid,
  family: RefineFamily,
  materialOf?: (i: number) => MaterialClass,
): VoxelGrid {
  if (family === "hires") return grid;
  return refineGrid(grid, labRefineOptions(family, materialOf));
}

/** Refine a box of the logical lab world (terrain), sampling neighbours outside it. */
export function refineTerrainRegion(src: VoxelSource, min: Vec3, size: Vec3): VoxelGrid {
  return refineRegion(src, min, size, labRefineOptions("terrain"));
}

// ── Meshing with a content cache ─────────────────────────────────

export interface RefinedMeshOptions {
  /** Centre x/z on the origin (y from 0) — the engine's `center` convention. */
  center?: boolean;
  materialOf?: (i: number) => MaterialClass;
}

const CACHE_LIMIT = 900;
const meshCache = new Map<string, MeshData>();
/** Identity hint: grid → content hash (grids are not mutated once meshed). */
const hashOf = new WeakMap<VoxelGrid, string>();

function gridHash(grid: VoxelGrid): string {
  let h = hashOf.get(grid);
  if (h) return h;
  const d = grid.data;
  let a = 0x811c9dc5 | 0;
  let b = 0x9e3779b9 | 0;
  for (let i = 0; i < d.length; i++) {
    const v = d[i]!;
    if (v === 0) continue;
    a = Math.imul(a ^ v ^ (i << 8), 0x01000193);
    b = Math.imul(b ^ (i * 31 + v), 0x85ebca6b);
  }
  h = `${grid.sx}x${grid.sy}x${grid.sz}:${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
  hashOf.set(grid, h);
  return h;
}

/**
 * Greedy mesh of the refined grid in SOURCE voxel units: positions span
 * exactly [0, sx]×[0, sy]×[0, sz] (or centred in x/z), so callers keep their
 * mesh scale, pivots and offsets. Results are cached by content, family,
 * centring and material mapping (same model placed many times, rebuilt
 * floors, powered/unpowered variants) — treat the returned arrays as read-only.
 * "hires" grids are meshed as authored (scale 1, no refinement).
 */
export function refinedModelMesh(
  grid: VoxelGrid,
  family: RefineFamily,
  opts: RefinedMeshOptions = {},
): MeshData {
  const matKey =
    opts.materialOf && opts.materialOf !== labMaterialOf ? materialKey(opts.materialOf) : "lab";
  const key = `${family}|${opts.center ? 1 : 0}|${matKey}|${gridHash(grid)}`;
  const hit = meshCache.get(key);
  if (hit) {
    // LRU: move to the back.
    meshCache.delete(key);
    meshCache.set(key, hit);
    return hit;
  }
  const fine = refineModel(grid, family, opts.materialOf);
  const data = greedyMesh(fine, [0, 0, 0], [fine.sx, fine.sy, fine.sz], {
    palette: LAB_PALETTE,
    materialOf: opts.materialOf ?? labMaterialOf,
    ...(opts.center ? { offset: [-fine.sx / 2, 0, -fine.sz / 2] as Vec3 } : {}),
    scale: fine === grid ? 1 : 0.5,
  });
  meshCache.set(key, data);
  if (meshCache.size > CACHE_LIMIT) meshCache.delete(meshCache.keys().next().value!);
  return data;
}

/** Stable key of a material mapping (the 255 classes it assigns). */
function materialKey(materialOf: (i: number) => MaterialClass): string {
  let s = "";
  for (let i = 1; i < 256; i++) s += materialOf(i)[0];
  return s;
}

/** Drop cached meshes (tests / memory pressure). */
export function clearRefineCache(): void {
  meshCache.clear();
}

/** Decor family by model scale: DETAIL_SCALE pieces only get subdivision + a light bevel. */
export function decorFamily(scale: number): RefineFamily {
  return scale <= 0.26 ? "detail" : "decor";
}

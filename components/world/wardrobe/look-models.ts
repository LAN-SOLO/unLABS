/**
 * Voxel grids for the character menu (pure, cached).
 * ==================================================
 *
 * `lookGrid(look)` — Jade in a look, posed for the preview; `pieceGrid(id,
 * colourway)` — a single wardrobe piece as an icon. Both come from Jade's
 * wardrobe models (`lib/world/models/jade-look.ts`: `jadeLookGrid`,
 * `wearItemGrid`, `jadeLookKey`). Grids are cached per look / piece, so the
 * menu can hover through a whole slot without re-meshing.
 */
import type { VoxelGrid } from "@/lib/voxel/grid";
import { WEAR_BY_ID, type JadeLook } from "@/lib/world/content/wardrobe";
import { jadeLookGrid, jadeLookKey, wearItemGrid } from "@/lib/world/models/jade-look";
import { visibleLook } from "@/lib/world/wardrobe";

const LOOK_CACHE = new Map<string, VoxelGrid>();
const PIECE_CACHE = new Map<string, VoxelGrid>();
const CACHE_MAX = 96;

function remember<T>(cache: Map<string, T>, key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit;
  const v = make();
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, v);
  return v;
}

/** Cache key of a look (what the preview bakes). */
export function lookKey(look: JadeLook): string {
  return jadeLookKey(visibleLook(look));
}

/** Jade wearing `look` (helmets hide the face slot, like in the world). */
export function lookGrid(look: JadeLook): VoxelGrid {
  const v = visibleLook(look);
  return remember(LOOK_CACHE, jadeLookKey(v), () => jadeLookGrid(v));
}

/** Icon grid of one piece in one colourway (first colourway by default). */
export function pieceGrid(itemId: string, colorway?: string): VoxelGrid | null {
  const w = WEAR_BY_ID.get(itemId);
  if (!w) return null;
  const cw = colorway ?? w.colorways[0]!.id;
  return remember(PIECE_CACHE, `${itemId}.${cw}`, () => wearItemGrid(itemId, cw));
}

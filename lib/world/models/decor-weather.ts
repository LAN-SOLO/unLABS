/**
 * Decor weathering — a deterministic, voxel-neutral detail pass (pure).
 * ======================================================================
 *
 * Runs once per decor model (inside `decorModel`, cached) and only
 * RECOLOURS existing voxels, so footprints, host tops, screen recesses and
 * collision stay exactly as authored:
 *
 *   - wood grain: planks get darker grain streaks running along the member
 *     (vertical for legs / posts, horizontal for tops and panels);
 *   - fabric & leather: mottled weave, shaded undersides, worn leather tops;
 *   - painted metal: chipped paint on exposed edges of floor pieces;
 *   - steel feet: rust spots on the lowest rows;
 *   - grime: dirt speckles on the bottom row of floor-standing pieces;
 *   - dust: a few grey flecks on exposed top faces of big furniture.
 *
 * Emissive colours, glass, screens (crt_bg / black) and signage colours are
 * never touched. Pieces listed in `CLEAN` skip the pass.
 */
import { C, labMaterialOf } from "@/lib/world/content/palette";
import { Model } from "@/lib/world/models/core";
import type { DecorDef } from "@/lib/world/models/decor-kit";

/** Wood colour → its grain streak. */
const GRAIN: Record<number, number> = {
  [C.wood]: C.wood_grain,
  [C.wood_light]: C.wood_light_grain,
  [C.wood_dark]: C.wood_dark_grain,
  [C.wood_red]: C.wood_red_grain,
  [C.oak]: C.oak_grain,
  [C.walnut]: C.walnut_grain,
};

/** Fabric colour → its shade. */
const SHADE: Record<number, number> = {
  [C.fabric_red]: C.fabric_red_shade,
  [C.carpet_red]: C.fabric_red_shade,
  [C.fabric_blue]: C.fabric_blue_shade,
  [C.fabric_green]: C.fabric_green_shade,
  [C.fabric_gray]: C.fabric_gray_shade,
  [C.fabric_mustard]: C.fabric_mustard_shade,
  [C.olive]: C.fabric_green_shade,
};

/** Painted surfaces that chip to bare steel on worn edges. */
const PAINT = new Set<number>([
  C.paint_gray,
  C.paint_white,
  C.paint_cream,
  C.paint_black,
  C.paint_navy,
  C.paint_teal,
  C.beige,
  C.green_paint,
  C.blue_paint,
  C.red_paint,
  C.yellow_paint,
  C.orange_paint,
  C.safety_yellow,
  C.safety_orange,
  C.safety_red,
  C.safety_green,
]);

/** Bare steels that rust at the feet. */
const RUSTY = new Set<number>([C.steel, C.steel_dark, C.metal, C.metal_dark, C.aluminium]);

/** Colours that never receive grime or dust (lit, glassy, screens, paper decals). */
const KEEP = new Set<number>([C.crt_bg, C.black, C.paper, C.paper_yellow, C.paper_pink]);

/** Pieces that stay pristine (signage, decals, crystals, holograms…). */
const CLEAN = new Set<string>([
  "exit_sign",
  "radiation_sign",
  "first_aid",
  "hazard_decal",
  "blast_door_marker",
  "glow_seam",
  "holo_table",
  "crystal_cluster",
  "crystal_small",
  "puddle",
  "oil_stain",
  "broken_glass",
  "dust_motes",
]);

function vhash(id: number, x: number, y: number, z: number, salt: number): number {
  let h = (Math.imul(x + 17, 73856093) ^ Math.imul(y + 5, 19349663)) >>> 0;
  h = (h ^ Math.imul(z + 11, 83492791) ^ Math.imul(id + salt, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

function idHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Emissive / glass voxels and the amber trim are never weathered. */
function untouchable(v: number): boolean {
  const m = labMaterialOf(v);
  return m === "emit" || m === "glass" || v === C.wall_trim;
}

/**
 * Weathered copy of `src` for decor `def` (the source model is not
 * modified). Deterministic per decor id.
 */
export function weatherModel(
  def: Pick<DecorDef, "id" | "scale" | "wall" | "small">,
  src: Model,
): Model {
  if (CLEAN.has(def.id)) return src;
  const g = src.grid;
  const out = new Model(src.w, src.h, src.d);
  const id = idHash(def.id);
  const fine = (def.scale ?? 0.5) < 0.5;
  const floorPiece = !def.wall && !def.small && src.h > 2;
  const big = floorPiece && src.w * src.h * src.d >= (fine ? 1200 : 150);
  const at = (x: number, y: number, z: number) => (g.inBounds(x, y, z) ? g.get(x, y, z) : 0);
  g.forEach((x, y, z, v) => {
    let c = v;
    if (untouchable(v)) {
      out.set(x, y, z, v);
      return;
    }
    const up = at(x, y + 1, z);
    const down = at(x, y - 1, z);
    const openFaces =
      (at(x + 1, y, z) ? 0 : 1) +
      (at(x - 1, y, z) ? 0 : 1) +
      (at(x, y, z + 1) ? 0 : 1) +
      (at(x, y, z - 1) ? 0 : 1) +
      (up ? 0 : 1) +
      (down ? 0 : 1);
    const grain = GRAIN[v];
    const shade = SHADE[v];
    if (grain !== undefined) {
      // Vertical member (same wood above and below, open at a side) → grain runs in y.
      const vertical = up === v && down === v;
      const streak = vertical
        ? vhash(id, x, 0, z, 1) % 4 === 0
        : (vhash(id, 0, y, z, 3) + (x >> 3)) % 5 === 0;
      if (streak) c = grain;
      else if (vhash(id, x, y, z, 4) % 37 === 0) c = grain; // knot
    } else if (shade !== undefined) {
      // Underside shading + mottled weave.
      if ((down !== v && down !== 0) || (!down && y > 0)) c = shade;
      else if (vhash(id, x, y, z, 5) % 6 === 0) c = shade;
    } else if (v === C.leather || v === C.leather_black) {
      if (!up && vhash(id, x, y, z, 6) % 3 === 0) c = v === C.leather ? C.leather_worn : C.leather;
    } else if (PAINT.has(v) && floorPiece && openFaces >= 3) {
      // Worn edge: chipped paint (sparser on fine models, which have more edge voxels).
      if (vhash(id, x, y, z, 7) % (fine ? 9 : 7) === 0) c = y <= 1 ? C.iron_rust : C.steel_dark;
    } else if (RUSTY.has(v) && floorPiece && y <= (fine ? 1 : 0)) {
      if (vhash(id, x, y, z, 8) % 4 === 0) c = C.iron_rust;
    }
    if (c === v && floorPiece && y === 0 && !KEEP.has(v) && openFaces >= 2)
      if (vhash(id, x, y, z, 9) % 3 === 0) c = C.grime;
    if (c === v && big && !up && y >= src.h / 2 && !KEEP.has(v))
      if (vhash(id, x, y, z, 10) % 11 === 0) c = C.dust;
    out.set(x, y, z, c);
  });
  return out;
}

/**
 * uvox → game model: the way back from Blender (docs/VOXEL-BLENDER.md).
 * A model built or edited with voxelgod is saved as uvox and becomes a
 * `Model` here, voxel for voxel. Colours are game palette indices; the
 * loader refuses a file whose palette entry disagrees with the game palette,
 * so a model can never drift in colour on its way in or out.
 *
 * Blender-built models are display resolution already: use them as `fine`
 * visuals (family "hires", meshed as authored, never refined twice) with
 * `scale = unit` world units per voxel.
 */
import { fromUvox, type UvoxModel } from "@/lib/voxel/uvox";
import { LAB_PALETTE, labMaterialOf } from "@/lib/world/content/palette";
import { Model } from "@/lib/world/models/core";

export interface UvoxGameModel {
  model: Model;
  /** World units per voxel (use as the visual's `scale`). */
  scale: number;
  /** Authored at display resolution: mesh as is (family "hires"). */
  fine: true;
}

export function modelFromUvox(m: UvoxModel): UvoxGameModel {
  for (const p of m.palette) {
    const [r, g, b] = LAB_PALETTE.get(p.index);
    if (r !== p.rgb[0] || g !== p.rgb[1] || b !== p.rgb[2] || labMaterialOf(p.index) !== p.mat)
      throw new Error(
        `uvox ${m.id}: palette ${p.index} (${p.name}) is ${p.rgb.join(",")} ${p.mat}, ` +
          `the game has ${r},${g},${b} ${labMaterialOf(p.index)}`,
      );
  }
  const grid = fromUvox(m);
  const model = new Model(grid.sx, grid.sy, grid.sz);
  model.grid.data.set(grid.data);
  return { model, scale: m.unit, fine: true };
}

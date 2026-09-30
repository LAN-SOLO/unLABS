/**
 * Jade's look — public API (pure — no three).
 * ===========================================
 *
 * - `jadeLookRig(look)`   — the jointed rig wearing a look (= `jadeRig(look)`),
 * - `jadeLookKey(look)`   — stable cache key (slot order, item + colourway),
 * - `jadeLookGrid(look)`  — one merged voxel grid of the posed rig (rest pose
 *                           by default) for menu previews (ModelPreview /
 *                           bakeIsoSprite),
 * - `wearItemGrid(id, cw)` — a single piece as an icon grid (hair: the head
 *                           with that hairstyle; gloves: the hands).
 *
 * Composition: jade-rig.ts. Art: jade-wear (clothes), jade-hair (head and
 * hairstyles), jade-gear (headgear, face pieces, gloves), jade-accessories
 * (back, neck, belt, wrist, shoulder buddy), jade-prints (tee prints).
 */
import { VoxelGrid } from "@/lib/voxel/grid";
import {
  DEFAULT_LOOK,
  WEAR_BY_ID,
  type JadeLook,
  type WearSlot,
} from "@/lib/world/content/wardrobe";
import { buildJadeRig, lookKey, shownLook } from "@/lib/world/models/jade-rig";
import {
  posedVoxels,
  type CharacterPose,
  type CharacterRigDef,
  type PosedVoxel,
  type RigPartName,
} from "@/lib/world/models/rig";

export { shownLook };

/** Jade wearing `look` (full-face headgear hides the face slot). Same as `jadeRig(look)`. */
export function jadeLookRig(look: JadeLook): CharacterRigDef {
  return buildJadeRig(look);
}

/** Stable key of a look: `top=sweater_teal.teal|outer=…|…|buddy=-`. */
export function jadeLookKey(look: JadeLook): string {
  return lookKey(look);
}

/** Parts that never show in a preview (the lids rest inside the skull). */
const HIDDEN: ReadonlySet<RigPartName> = new Set<RigPartName>(["lids"]);

function toGrid(vs: readonly PosedVoxel[]): VoxelGrid {
  if (!vs.length) return new VoxelGrid(1, 1, 1);
  const cells = vs.map(
    (v) => [Math.floor(v.p[0]), Math.floor(v.p[1]), Math.floor(v.p[2]), v.color] as const,
  );
  let [x0, y0, z0] = [Infinity, Infinity, Infinity];
  let [x1, y1, z1] = [-Infinity, -Infinity, -Infinity];
  for (const [x, y, z] of cells) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
    z1 = Math.max(z1, z);
  }
  const g = new VoxelGrid(x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1);
  for (const [x, y, z, c] of cells) g.set(x - x0, y - y0, z - z0, c);
  return g;
}

/**
 * Jade in `look` as one voxel grid (character space, feet at the bottom,
 * front = +z), posed (rest pose by default). Dense parts, so rotated
 * previews show no holes.
 */
export function jadeLookGrid(look: JadeLook, pose?: Partial<CharacterPose>): VoxelGrid {
  const def = buildJadeRig(look, { hollow: false });
  return toGrid(posedVoxels(def, pose).filter((v) => !HIDDEN.has(v.part)));
}

/** Plain body the icons are cut from (nothing optional worn). */
const ICON_BASE: JadeLook = {
  ...DEFAULT_LOOK,
  outer: null,
  head: null,
  belt: null,
  wrist: null,
};

const cellKey = (v: PosedVoxel) =>
  `${v.part}|${Math.floor(v.p[0])},${Math.floor(v.p[1])},${Math.floor(v.p[2])}`;

/**
 * A single wardrobe piece as a small icon grid: the voxels that change when
 * Jade puts it on. Hairstyles show the whole head with the style; gloves
 * the hands.
 */
export function wearItemGrid(itemId: string, colorway: string): VoxelGrid {
  const w = WEAR_BY_ID.get(itemId);
  if (!w) return new VoxelGrid(1, 1, 1);
  const slot: WearSlot = w.slot;
  const base: JadeLook = { ...ICON_BASE };
  if (slot === "outer") base.top = null;
  const on = buildJadeRig({ ...base, [slot]: { item: itemId, colorway } }, { hollow: false });
  if (slot === "hair") {
    const head: ReadonlySet<RigPartName> = new Set<RigPartName>(["head", "hairBack", "brows"]);
    return toGrid(posedVoxels(on).filter((v) => head.has(v.part)));
  }
  const off = buildJadeRig({ ...base, [slot]: null }, { hollow: false });
  const before = new Map<string, number>();
  for (const v of posedVoxels(off)) if (!HIDDEN.has(v.part)) before.set(cellKey(v), v.color);
  const piece = posedVoxels(on).filter(
    (v) => !HIDDEN.has(v.part) && before.get(cellKey(v)) !== v.color,
  );
  return toGrid(piece);
}

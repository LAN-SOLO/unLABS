/**
 * The veil — how Damien is shown while he has not been found (pure, no three).
 * ============================================================================
 *
 * Damien Fridge is fully authored (`damienRig` in rig.ts), but the game keeps
 * him a mystery until the future "find Damien" arc sets the found flag
 * (lib/world/damien.ts). Until then every in-game appearance goes through
 * this transform: his voxel grids are downsampled into coarse blocks
 * (VEIL_BLOCK³ voxels, same model size and joints), every block gets a
 * colour from a cold cyan / grey noise palette (nothing of his skin, hair,
 * beard or shirt survives), a few blocks drop out as static and a few block
 * rows tear sideways. The silhouette — tall, broad, the wedge of the beard —
 * still reads as "a man in the static"; face, hair colour and clothes do not.
 *
 * The engine renders a veiled rig as a hologram (one glass material per
 * part) and flips between two seeds for a shimmering mosaic, see
 * `damienFigureRigs` and LabEngine's echo animation.
 */
import { C, LAB_PALETTE } from "@/lib/world/content/palette";
import { Model } from "@/lib/world/models/core";
import { damienRig, type CharacterRigDef, type RigPart } from "@/lib/world/models/rig";

/** Edge of a veil block in model voxels (2–3× downsampling): body parts. */
export const VEIL_BLOCK = 2;
/** The head is veiled coarser: no feature of the face survives. */
export const VEIL_HEAD_BLOCK = 3;

/** Cold noise palette of the veil, weighted (repeats = weight). */
export const VEIL_COLORS: readonly number[] = [
  C.holo_cyan,
  C.holo_cyan,
  C.holo_cyan,
  C.glass,
  C.glass,
  C.glass,
  C.paint_teal,
  C.paint_teal,
  C.steel_dark,
  C.steel_dark,
  C.holo_white,
];

/**
 * Noise palettes by brightness band (dark, mid, light). With `shade` a block
 * leans towards the band of its source colours, so light cloth and dark
 * trousers stay apart as a vague value study; hue never survives.
 */
const VEIL_BANDS: readonly (readonly number[])[] = [
  [C.steel_dark, C.steel_dark, C.paint_teal, C.paint_teal, C.holo_cyan],
  [C.paint_teal, C.glass, C.holo_cyan, C.holo_cyan, C.steel_dark],
  [C.holo_cyan, C.glass, C.glass, C.holo_white, C.holo_cyan],
];

/** Brightness band (0 dark, 1 mid, 2 light) of a palette colour. */
function band(v: number): number {
  const [r, g, b] = LAB_PALETTE.get(v);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l < 90 ? 0 : l < 170 ? 1 : 2;
}

export interface VeilOptions {
  /** Block edge in voxels (default VEIL_BLOCK). */
  block?: number;
  /** Noise seed: the same seed always gives the same veil. */
  seed?: number;
  /** Solid voxels a block needs to show up (default 3). */
  minFill?: number;
  /** Share of blocks that drop out as static (default 0.08). */
  dropout?: number;
  /** Share of block rows that tear sideways by one or two voxels (default 0.18). */
  tear?: number;
  /**
   * 0..1: how strongly a block's colour follows the brightness of its source
   * voxels (default 0 = pure noise). Never used on the head.
   */
  shade?: number;
}

/** Deterministic integer hash → [0, 1). */
function noise(a: number, b: number, c: number, d: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ Math.imul(c | 0, 0x9e3779b1), 0x85ebca6b);
  h = Math.imul(h ^ Math.imul(d | 0, 0xc2b2ae35), 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * Veil one voxel model: same size, coarse blocks in noise colours. Block
 * occupancy decides the shape (so the silhouette survives), the noise
 * decides every colour (so no detail does).
 */
export function veilGrid(src: Model, opts: VeilOptions = {}): Model {
  const k = Math.max(1, Math.floor(opts.block ?? VEIL_BLOCK));
  const seed = opts.seed ?? 0;
  const minFill = opts.minFill ?? 3;
  const dropout = opts.dropout ?? 0.08;
  const tear = opts.tear ?? 0.18;
  const nx = Math.ceil(src.w / k);
  const ny = Math.ceil(src.h / k);
  const nz = Math.ceil(src.d / k);
  const shade = opts.shade ?? 0;
  const counts = new Uint16Array(nx * ny * nz);
  const bright = new Uint16Array(nx * ny * nz);
  src.grid.forEach((x, y, z, v) => {
    const i = Math.floor(x / k) + nx * (Math.floor(y / k) + ny * Math.floor(z / k));
    counts[i] = counts[i]! + 1;
    if (shade > 0) bright[i] = bright[i]! + band(v);
  });
  const out = new Model(src.w, src.h, src.d);
  for (let by = 0; by < ny; by++) {
    // A torn row slides sideways (clamped to the model).
    const tr = noise(seed, by, 7, 3);
    const shift = tr < tear ? (noise(seed, by, 11, 5) < 0.5 ? -1 : 1) * (tr < tear / 3 ? 2 : 1) : 0;
    for (let bz = 0; bz < nz; bz++)
      for (let bx = 0; bx < nx; bx++) {
        const bi = bx + nx * (by + ny * bz);
        const n = counts[bi]!;
        if (n < minFill) continue;
        if (noise(seed, bx, by, bz + 1000) < dropout) continue;
        const u = noise(seed + 17, bx, by, bz);
        const pal =
          shade > 0 && noise(seed + 29, bx, by, bz) < shade
            ? VEIL_BANDS[Math.min(2, Math.round(bright[bi]! / n))]!
            : VEIL_COLORS;
        const c = pal[Math.min(pal.length - 1, Math.floor(u * pal.length))]!;
        for (let z = bz * k; z < Math.min(src.d, bz * k + k); z++)
          for (let y = by * k; y < Math.min(src.h, by * k + k); y++)
            for (let x = bx * k; x < Math.min(src.w, bx * k + k); x++) {
              const sx = Math.min(src.w - 1, Math.max(0, x + shift));
              out.set(sx, y, z, c);
            }
      }
  }
  return out;
}

/**
 * A veiled copy of a character rig: every body part veiled (thin parts with
 * a lower fill threshold), the face parts (brows, blinking lids) dropped —
 * the veil has no face. Joints and pivots are unchanged, so every pose works.
 */
export function veilRig(def: CharacterRigDef, seed = 0): CharacterRigDef {
  const parts: RigPart[] = [];
  def.parts.forEach((p, i) => {
    if (p.name === "brows" || p.name === "lids") return;
    const head = p.name === "head" || p.name === "hairBack";
    const block = head ? VEIL_HEAD_BLOCK : VEIL_BLOCK;
    const model = veilGrid(p.model, {
      block,
      seed: seed * 101 + i * 7 + 1,
      minFill: head ? 4 : 2,
      shade: head ? 0 : 0.6,
    });
    parts.push({ ...p, model });
  });
  return { id: "damien_veil", parts, scale: def.scale, hologram: true, fine: true };
}

/** How many veil frames the engine flips between (static shimmer). */
export const VEIL_FRAMES = 2;

/**
 * The rigs to build for Damien's figure: his hologram once he has been found,
 * otherwise VEIL_FRAMES veiled frames with different noise seeds.
 */
export function damienFigureRigs(revealed: boolean): CharacterRigDef[] {
  if (revealed) return [damienRig(true)];
  const solid = damienRig(false);
  return Array.from({ length: VEIL_FRAMES }, (_, k) => veilRig(solid, k));
}

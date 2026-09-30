/**
 * Jade's wardrobe — shared drawing kit (pure — no three).
 * =======================================================
 *
 * Every rig part of Jade is painted on a `Canvas`: a sparse voxel store
 * with the same chainable `set` / `box` / `sphere` calls as `Model`, but
 * unbounded. A canvas starts with a nominal size and a `clip` box equal to
 * it, so the base layers (body, clothes) behave exactly like drawing on a
 * `Model` of that size; gear that grows past the part (a helmet above the
 * head, a backpack behind the torso, a gauntlet cuff) is drawn with
 * `k.free(() => …)`, which lifts the clip. `toModel` then crops the union of
 * the nominal box and everything drawn and reports the shift, so the
 * composition (jade-rig.ts) can move the part's origin and its children's
 * pivots by the same amount — joints never move.
 *
 * Colours: a worn piece carries a `Tone` (palette indices of its
 * colourway's main / shade / accent, see content/wardrobe.ts).
 */
import { C, type ColorName } from "@/lib/world/content/palette";
import {
  WEAR_BY_ID,
  WEAR_SLOTS,
  type JadeLook,
  type WearItem,
  type WearSlot,
} from "@/lib/world/content/wardrobe";
import { Model } from "@/lib/world/models/core";

/** World units per model voxel — equals `CHARACTER_SCALE` in rig.ts (asserted by tests). */
export const JADE_SCALE = 0.09;
/** Hip height in model voxels (rig.ts: LEG_LEN · RIG_UNIT). */
export const JADE_HIP_Y = 24;

export type V3 = [number, number, number];

// ── Canvas ──────────────────────────────────────────────────────

const OFF = 128;
const key = (x: number, y: number, z: number) => x + OFF + (y + OFF) * 512 + (z + OFF) * 262144;

export class Canvas {
  private cells = new Map<number, number>();
  /** Writes outside this box are dropped (like `Model.set`); null = unbounded. */
  clip: V3 | null;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly d: number,
  ) {
    this.clip = [w, h, d];
  }

  inBounds(x: number, y: number, z: number): boolean {
    const c = this.clip;
    return !c || (x >= 0 && y >= 0 && z >= 0 && x < c[0] && y < c[1] && z < c[2]);
  }

  get(x: number, y: number, z: number): number {
    return this.cells.get(key(x, y, z)) ?? 0;
  }

  set(x: number, y: number, z: number, c: number): this {
    if (!this.inBounds(x, y, z)) return this;
    if (c) this.cells.set(key(x, y, z), c);
    else this.cells.delete(key(x, y, z));
    return this;
  }

  /** Inclusive box. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number): this {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, c);
    return this;
  }

  sphere(cx: number, cy: number, cz: number, r: number, c: number): this {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r + 0.3) this.set(x, y, z, c);
    return this;
  }

  /** Vertical cylinder centred at (cx, cz), radius r, rows y0..y1. */
  cyl(cx: number, cz: number, r: number, y0: number, y1: number, c: number): this {
    for (let y = y0; y <= y1; y++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r + 0.3) this.set(x, y, z, c);
    return this;
  }

  /** Run `fn` with the clip lifted (gear that grows the part). */
  free(fn: () => void): this {
    const c = this.clip;
    this.clip = null;
    try {
      fn();
    } finally {
      this.clip = c;
    }
    return this;
  }

  forEach(fn: (x: number, y: number, z: number, v: number) => void): void {
    for (const [k, v] of [...this.cells]) {
      const x = (k % 512) - OFF;
      const y = (Math.floor(k / 512) % 512) - OFF;
      const z = Math.floor(k / 262144) - OFF;
      fn(x, y, z, v);
    }
  }

  count(): number {
    return this.cells.size;
  }

  /** Copy mirrored across the nominal width (x → w - 1 - x). */
  mirrorX(): Canvas {
    const out = new Canvas(this.w, this.h, this.d);
    out.clip = null;
    this.forEach((x, y, z, v) => out.set(this.w - 1 - x, y, z, v));
    out.clip = this.clip;
    return out;
  }

  /** Recolour every voxel (0 deletes). */
  recolor(fn: (v: number, x: number, y: number, z: number) => number): this {
    this.forEach((x, y, z, v) => {
      const c = fn(v, x, y, z);
      if (c) this.cells.set(key(x, y, z), c);
      else this.cells.delete(key(x, y, z));
    });
    return this;
  }

  /**
   * Model covering the nominal box and everything drawn. `shift` is what
   * was added to every coordinate (≥ 0 per axis). With `hollow`, voxels
   * whose six neighbours are all solid are dropped (never visible).
   */
  toModel(hollow = false): { model: Model; shift: V3 } {
    let [x0, y0, z0] = [0, 0, 0];
    let [x1, y1, z1] = [this.w - 1, this.h - 1, this.d - 1];
    this.forEach((x, y, z) => {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      z1 = Math.max(z1, z);
    });
    const m = new Model(x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1);
    this.forEach((x, y, z, v) => {
      if (
        hollow &&
        this.get(x + 1, y, z) &&
        this.get(x - 1, y, z) &&
        this.get(x, y + 1, z) &&
        this.get(x, y - 1, z) &&
        this.get(x, y, z + 1) &&
        this.get(x, y, z - 1)
      )
        return;
      m.set(x - x0, y - y0, z - z0, v);
    });
    return { model: m, shift: [-x0, -y0, -z0] };
  }
}

// ── Small drawing helpers (Canvas twins of rig.ts' helpers) ─────

/** Clear the four vertical edge columns of a box (a rounded limb / body cross-section). */
export function roundEdges(
  m: Canvas,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
): void {
  for (const x of [x0, x1]) for (const z of [z0, z1]) m.box(x, y0, z, x, y1, z, 0);
}

/** Paint a voxel only where the canvas is solid. */
export function tint(m: Canvas, x: number, y: number, z: number, c: number): void {
  if (m.get(x, y, z)) m.set(x, y, z, c);
}

/** Recolour the solid voxels of a row whose colour is in `from` (or any, when omitted). */
export function paintWhere(
  m: Canvas,
  test: (x: number, y: number, z: number, v: number) => boolean,
  c: number | ((x: number, y: number, z: number, v: number) => number),
): void {
  m.forEach((x, y, z, v) => {
    if (test(x, y, z, v)) m.set(x, y, z, typeof c === "number" ? c : c(x, y, z, v));
  });
}

/**
 * Wrap row `y` of the solid shape with a one-voxel band (every empty cell
 * with a solid 4-neighbour in the row), filtered by `keep`. Straps,
 * headbands, belts round a shape of any outline.
 */
export function wrapRow(
  m: Canvas,
  y: number,
  c: number | ((x: number, z: number) => number),
  keep: (x: number, z: number) => boolean = () => true,
): void {
  const add: [number, number][] = [];
  m.forEach((x, yy, z) => {
    if (yy !== y) return;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (!m.get(nx, y, nz) && keep(nx, nz)) add.push([nx, nz]);
    }
  });
  for (const [x, z] of add) m.set(x, y, z, typeof c === "number" ? c : c(x, z));
}

/** Deterministic hash → [0, 1) (same as rig.ts). */
export function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
}

const LIGHTER: Partial<Record<ColorName, ColorName>> = {
  safety_yellow: "paper_yellow",
  safety_red: "flower_red",
  safety_orange: "orange_paint",
  fabric_green: "leaf_light",
  fabric_red: "flower_red",
  jeans: "paint_sky",
  paint_black_lt: "paint_gray_dk",
  paint_black: "paint_black_lt",
  black: "paint_black_lt",
  steel: "chrome",
  steel_dark: "steel",
  chrome: "chrome_lt",
  paint_white: "white",
  paint_teal: "teal_lt",
  sweater_teal: "teal_lt",
  fabric_gray: "paint_gray",
  olive: "olive_lt",
  leather: "leather_worn",
  paint_navy: "fabric_blue",
  paint_pink: "paper_pink",
  beige: "paint_cream",
  lime: "paint_lime",
  cerulean: "paint_sky",
  coat_white: "white",
  neon_pink: "paper_pink",
};
const LIGHTER_IDX = new Map<number, number>(
  Object.entries(LIGHTER).map(([a, b]) => [C[a as ColorName], C[b]]),
);

/** A lighter partner for highlights (gloss, fade); the colour itself when none is known. */
export function lighter(c: number): number {
  return LIGHTER_IDX.get(c) ?? c;
}

// ── The look, resolved ──────────────────────────────────────────

/** Palette indices of a colourway (shade / accent fall back to main / shade). */
export interface Tone {
  main: number;
  shade: number;
  accent: number;
}

export interface Worn {
  id: string;
  item: WearItem;
  t: Tone;
}

export type LookCtx = Record<WearSlot, Worn | null>;

export function toneOf(item: WearItem, colorway: string): Tone {
  const cw = item.colorways.find((c) => c.id === colorway) ?? item.colorways[0]!;
  const main = C[cw.tones.main];
  const shade = cw.tones.shade ? C[cw.tones.shade] : main;
  const accent = cw.tones.accent ? C[cw.tones.accent] : shade;
  return { main, shade, accent };
}

/** Resolve a look to items + tones (unknown ids are treated as empty slots). */
export function resolveLook(look: JadeLook): LookCtx {
  const out = {} as LookCtx;
  for (const slot of WEAR_SLOTS) {
    const e = look[slot];
    const item = e ? WEAR_BY_ID.get(e.item) : undefined;
    out[slot] =
      item && item.slot === slot ? { id: item.id, item, t: toneOf(item, e!.colorway) } : null;
  }
  return out;
}

/** Skin tones (Jade). */
export const SKIN = C.skin;
export const SKIN_SHADE = C.skin_shadow;
export const SKIN_LIGHT = C.skin_light;

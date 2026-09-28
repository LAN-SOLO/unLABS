/**
 * Decor build kit — shared types and drawing helpers for the decor library
 * (pure, no three). See `decor.ts` for the placement contract.
 */
import type {
  AnimKind,
  AnimPart,
  Axis,
  ScreenContent,
  ScreenSpec,
  Vec3,
} from "@/lib/world/models/anim";
import { C } from "@/lib/world/content/palette";
import { fnv1a } from "@/lib/world/traits";
import { Model } from "@/lib/world/models/core";

/** World units per model voxel for the detailed ("double resolution") pieces. */
export const DETAIL_SCALE = 0.25;

export interface DecorLight {
  /** Model-voxel position (unrotated model grid). */
  pos: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
  /** Only shines while the room is powered / lit. */
  requiresPower: boolean;
}

export interface DecorDef {
  id: string;
  model: () => Model;
  /** Blocks the walker (registered as a collision footprint). */
  solid: boolean;
  /** Mounted on a wall: back at model z = 0, at most one world voxel deep. */
  wall?: boolean;
  /** Default lift above the slab in world voxels (wall pieces, ceiling hangers). */
  elevation?: number;
  light?: DecorLight;
  /** World units per model voxel (default MODEL_SCALE = 0.5; 0.25 = double detail). */
  scale?: number;
  /** Live screens (monitors, CRTs, map screens). */
  screens?: ScreenSpec[];
  /** Animated parts (fans, clock hands, reels…), same semantics as device parts. */
  parts?: AnimPart[];
  /**
   * Host surface: height (model voxels) of a free, flat top face small
   * clutter may stand on (desks, tables, counters, sofas). Only model
   * columns whose top is exactly this high are used.
   */
  top?: number;
  /** Small desk-top clutter: may be placed on a host's `top` surface (always non-solid). */
  small?: boolean;
}

// ── Model helpers ────────────────────────────────────────────────

export function legs(
  m: Model,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h: number,
  c: number,
): void {
  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ] as const)
    m.box(x, 0, z, x, h, z, c);
}

export const BOOK_COLORS: readonly number[] = [
  C.book_red,
  C.book_green,
  C.book_blue,
  C.book_brown,
  C.paper,
  C.paint_navy,
  C.wood_red,
  C.fabric_mustard,
];

/** Row of books with varied colours and heights between x0..x1 standing on y0. */
export function books(
  m: Model,
  x0: number,
  x1: number,
  y0: number,
  maxH: number,
  z0: number,
  z1: number,
  seed: number,
  palette: readonly number[] = BOOK_COLORS,
): void {
  for (let x = x0; x <= x1; x++) {
    const h = fnv1a(`${seed}:${x}`);
    if (h % 11 === 0) continue; // gap
    const top = y0 + Math.max(1, maxH - (h % 3));
    const c = palette[h % palette.length]!;
    m.box(x, y0, z0, x, top - 1, z1, c);
    // Spine detail on the front face: a gilt / paper title band, a dark
    // label or a lighter worn top edge (recolour only, never extra voxels).
    const tall = top - y0;
    const k = (h >>> 5) % 6;
    if (tall >= 2 && k < 2) m.set(x, y0 + 1 + ((h >>> 9) % Math.max(1, tall - 1)), z1, C.gold);
    else if (tall >= 2 && k === 2) m.set(x, y0 + Math.floor(tall / 2), z1, C.paper);
    else if (tall >= 3 && k === 3) m.set(x, top - 1, z1, C.black);
  }
}

/** Deterministic scribbles on a flat surface at depth z. */
export function scribble(
  m: Model,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  colors: number[],
  seed: string,
  density = 3,
): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const h = fnv1a(`${seed}${x},${y}`);
      if (h % density === 0) m.set(x, y, z, colors[h % colors.length]!);
    }
}

/** Filled disc in the x/y plane at depth z (front-face dials, woofers, reels). */
export function disc(m: Model, cx: number, cy: number, r: number, z: number, c: number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) m.set(x, y, z, c);
}

export function flask(m: Model, x: number, z: number, y: number, liquid: number, tall = 2): void {
  m.box(x, y, z, x, y + tall - 1, z, liquid);
  m.set(x, y + tall, z, C.glass);
}

/** Table with its top at `topY`; the model is `h` tall so things can stand on it. */
export function table(
  w: number,
  h: number,
  d: number,
  topY: number,
  top: number,
  leg: number,
): Model {
  const m = new Model(w, h, d);
  m.box(0, topY, 0, w - 1, topY, d - 1, top);
  legs(m, 0, 0, w - 1, d - 1, topY - 1, leg);
  return m;
}

export function sign(w: number, h: number, bg: number, draw: (m: Model) => void): Model {
  const m = new Model(w, h, 1);
  m.box(0, 0, 0, w - 1, h - 1, 0, bg);
  draw(m);
  return m;
}

export function plantPot(
  m: Model,
  cx: number,
  cz: number,
  r: number,
  h: number,
  c: number = C.pot,
): void {
  m.cyl(cx, cz, r, 0, h, c);
  m.cyl(cx, cz, r - 0.8, h, h, C.soil);
}

export const L = (
  pos: [number, number, number],
  color: string,
  intensity: number,
  distance: number,
  requiresPower = true,
): DecorLight => ({ pos, color, intensity, distance, requiresPower });

// ── Screens & parts ──────────────────────────────────────────────

export interface WellOpts {
  content: ScreenContent;
  color?: string;
  bezel?: number;
  /** Defaults to true. */
  power?: boolean;
  text?: string;
}

/**
 * Recessed screen facing +z: a bezel ring on the plane `z`, the glass one
 * voxel deeper (dark CRT background at z − 1) over x0..x1 × y0..y1. The
 * returned spec's centre lies exactly on the glass' front face (plane z).
 */
export function screenWell(
  m: Model,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  o: WellOpts,
): ScreenSpec {
  m.box(x0 - 1, y0 - 1, z, x1 + 1, y1 + 1, z, o.bezel ?? C.black);
  m.box(x0, y0, z, x1, y1, z, 0);
  m.box(x0, y0, z - 1, x1, y1, z - 1, C.crt_bg);
  return screenAt([(x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2, z], x1 - x0 + 1, y1 - y0 + 1, "+z", o);
}

/** Recessed screen lying on top (+y): glass at row y − 1, bezel on row y. */
export function screenWellTop(
  m: Model,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  o: WellOpts,
): ScreenSpec {
  m.box(x0 - 1, y, z0 - 1, x1 + 1, y, z1 + 1, o.bezel ?? C.black);
  m.box(x0, y, z0, x1, y, z1, 0);
  m.box(x0, y - 1, z0, x1, y - 1, z1, C.crt_bg);
  return screenAt([(x0 + x1 + 1) / 2, y, (z0 + z1 + 1) / 2], x1 - x0 + 1, z1 - z0 + 1, "+y", o);
}

export function screenAt(
  center: Vec3,
  w: number,
  h: number,
  normal: ScreenSpec["normal"],
  o: WellOpts,
): ScreenSpec {
  const s: ScreenSpec = {
    center,
    w,
    h,
    normal,
    content: o.content,
    requiresPower: o.power ?? true,
  };
  if (o.color) s.color = o.color;
  if (o.text) s.text = o.text;
  return s;
}

export interface PartOpts {
  speed: number;
  axis?: Axis;
  amplitude?: number;
  phase?: number;
  /** Defaults to false for decor (clocks, steam and drips run without room power). */
  power?: boolean;
  /** Pivot in the part's voxel coords; defaults to the part's centre. */
  pivot?: Vec3;
}

/** Decor part whose pivot sits at `at` (continuous model coords). */
export function part(name: string, model: Model, at: Vec3, kind: AnimKind, o: PartOpts): AnimPart {
  const pivot: Vec3 = o.pivot ?? [model.w / 2, model.h / 2, model.d / 2];
  const p: AnimPart = {
    name,
    model,
    offset: [at[0] - pivot[0], at[1] - pivot[1], at[2] - pivot[2]],
    pivot,
    kind,
    speed: o.speed,
    requiresPower: o.power ?? false,
  };
  if (o.axis) p.axis = o.axis;
  if (o.amplitude !== undefined) p.amplitude = o.amplitude;
  if (o.phase !== undefined) p.phase = o.phase;
  return p;
}

/** Single-colour voxel blob (w × h × d box). */
export function blob(w: number, h: number, d: number, c: number): Model {
  return new Model(w, h, d).box(0, 0, 0, w - 1, h - 1, d - 1, c);
}

/** A rising wisp of steam / smoke: a few offset voxels, `h` tall. */
export function wisp(h: number, c: number, seed: number): Model {
  const m = new Model(2, h, 2);
  for (let y = 0; y < h; y++) {
    const k = fnv1a(`wisp${seed}:${y}`);
    if (y > 0 && k % 4 === 0) continue;
    m.set(k % 2, y, (k >> 3) % 2, c);
  }
  return m;
}

/** Falling drops: `n` single voxels stacked `gap` apart that blink in sequence. */
export function drips(
  name: string,
  at: Vec3,
  n: number,
  gap: number,
  c: number,
  speed = 0.8,
): AnimPart[] {
  const out: AnimPart[] = [];
  for (let i = 0; i < n; i++)
    out.push(
      part(`${name}${i}`, blob(1, 1, 1, c), [at[0], at[1] - i * gap, at[2]], "blink", {
        speed,
        amplitude: 1 / n,
        phase: (-i / n) * Math.PI * 2,
      }),
    );
  return out;
}

export interface Built {
  model: Model;
  screens?: ScreenSpec[];
  parts?: AnimPart[];
}

type RichOpts = Omit<DecorDef, "id" | "model" | "screens" | "parts">;

/**
 * Decor piece whose screens / parts are derived from the same drawing code
 * as its model: `build` runs once, eagerly, and its model is shared.
 */
export function rich(id: string, o: RichOpts, build: () => Built): DecorDef {
  const b = build();
  const def: DecorDef = { id, ...o, model: () => b.model };
  if (b.screens?.length) def.screens = b.screens;
  if (b.parts?.length) def.parts = b.parts;
  return def;
}

/** Detailed (0.25) piece without screens or parts. */
export function fine(id: string, o: Omit<RichOpts, "scale">, build: () => Model): DecorDef {
  return { id, scale: DETAIL_SCALE, ...o, model: build };
}

// ── Backs ────────────────────────────────────────────────────────

/** Fridge back: condenser coil grid, compressor, cord and a warning tag. */
export function fridgeBack(m: Model): void {
  for (let y = 4; y <= 20; y += 2) m.box(2, y, 0, 11, y, 0, C.metal_dark);
  m.box(2, 4, 0, 2, 20, 0, C.steel_dark).box(11, 4, 0, 11, 20, 0, C.steel_dark);
  m.box(3, 1, 0, 7, 3, 0, C.black).set(5, 2, 0, C.steel_dark);
  m.box(10, 0, 0, 10, 3, 0, C.cable_black);
  m.box(8, 21, 0, 10, 22, 0, C.paper_yellow);
}

/**
 * Item icons (pure — no three, no DOM).
 * =====================================
 *
 * Small voxel models (≤ 16³) for every authored item, drawn to read at
 * 32–64 px once baked into iso sprites, plus a procedural generator for
 * workbench prototypes: shape from the dominant trait axes, colour from the
 * spectrum colour, sparks for volatile items and rings for generation depth.
 *
 * View convention (see `bakeIsoSprite`): top, +z (left) and +x (right)
 * faces are visible, so details live on those faces.
 */
import { C } from "@/lib/world/content/palette";
import { discXY, discYZ, hash3 } from "@/lib/world/models/anim";
import { Model } from "@/lib/world/models/core";
import { dominantAxes, fnv1a } from "@/lib/world/traits";
import type { ItemDef, SpectrumColor, TraitAxis } from "@/lib/world/types";

/** Upper bound for every icon dimension. */
export const ICON_MAX = 16;

export interface IconTone {
  body: number;
  dark: number;
  glow: number;
  light: number;
}

/** Palette tones per spectrum colour (body, shadow, emissive, highlight). */
export const SPECTRUM_TONE: Record<SpectrumColor, IconTone> = {
  infrarot: { body: C.paint_brick, dark: C.wood_red, glow: C.fire, light: C.flower_red },
  rot: { body: C.safety_red, dark: C.red_paint, glow: C.led_red, light: C.glass_red },
  orange: {
    body: C.safety_orange,
    dark: C.orange_paint,
    glow: C.orange_neon,
    light: C.glass_amber,
  },
  gelb: { body: C.safety_yellow, dark: C.yellow_paint, glow: C.led_amber, light: C.paper_yellow },
  gruen: { body: C.safety_green, dark: C.green_paint, glow: C.led_green, light: C.glass_green },
  blau: { body: C.safety_blue, dark: C.blue_paint, glow: C.cerulean, light: C.paint_sky },
  indigo: { body: C.exotic, dark: C.paint_navy, glow: C.screen_blue, light: C.paint_lilac },
  violett: {
    body: C.neon_purple,
    dark: C.purple_paint,
    glow: C.abstractum,
    light: C.crystal_violet,
  },
  gamma: { body: C.chrome, dark: C.aluminium, glow: C.gamma, light: C.holo_white },
};

/** Indicator colour per trait axis (matches `AXIS_COLOR` in spirit). */
export const AXIS_TONE: Record<TraitAxis, number> = {
  energie: C.led_amber,
  signal: C.screen_cyan,
  optik: C.lime,
  thermik: C.orange_neon,
  mechanik: C.beige,
  quantum: C.neon_purple,
  resonanz: C.neon_magenta,
  daten: C.neon_blue,
};

// ── Kit ──────────────────────────────────────────────────────────

/** Model that snaps fractional coordinates to the nearest voxel. */
class IconModel extends Model {
  override set(x: number, y: number, z: number, c: number): this {
    return super.set(Math.round(x), Math.round(y), Math.round(z), c);
  }
}

/** Horizontal disc layer; voxels on the viewer-facing rim get `edge`. */
function layer(o: Model, cx: number, cz: number, r: number, y: number, c: number, edge = c): void {
  const cells: [number, number][] = [];
  let best = -Infinity;
  for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r + 0.3) {
        cells.push([x, z]);
        best = Math.max(best, x + z);
      }
  for (const [x, z] of cells) o.set(x, y, z, x + z >= best - 0.5 ? edge : c);
}

/** Tapered crystal spire; `tx`/`tz` lean it per layer. */
function spire(
  o: Model,
  cx: number,
  cz: number,
  y0: number,
  r: number,
  h: number,
  body: number,
  edge: number,
  tip: number,
  tx = 0,
  tz = 0,
): void {
  const shoulder = Math.floor(h * 0.55);
  for (let i = 0; i < h; i++) {
    const rr = i < shoulder ? r : Math.max(0.45, r * (1 - (i - shoulder + 1) / (h - shoulder + 1)));
    layer(o, cx + tx * i, cz + tz * i, rr, y0 + i, i >= h - 2 ? tip : body, edge);
  }
}

/** Flat gear lying in the xz plane. */
function gearFlat(
  o: Model,
  cx: number,
  cz: number,
  y0: number,
  y1: number,
  r: number,
  teeth: number,
  c: number,
  hub: number,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x - cx, z - cz);
        const a = Math.atan2(z - cz, x - cx);
        const tooth = Math.cos(a * teeth) > 0.2;
        if (d <= r - 0.4 || (tooth && d <= r + 0.9)) o.set(x, y, z, c);
      }
  }
  o.cyl(cx, cz, 1.2, y0, y1 + 1, hub);
}

/** Upright gear facing +z at depth z0..z1. */
function gearUpright(
  o: Model,
  cx: number,
  cy: number,
  z0: number,
  z1: number,
  r: number,
  teeth: number,
  c: number,
  hub: number,
): void {
  for (let z = z0; z <= z1; z++)
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x - cx, y - cy);
        const a = Math.atan2(y - cy, x - cx);
        if (d <= r - 0.4 || (Math.cos(a * teeth) > 0.2 && d <= r + 0.9)) o.set(x, y, z, c);
      }
  discXY(o, cx, cy, z1 + 1, 1, hub);
}

/** Torus standing in the xy plane (facing +z), coloured by angle. */
function torusUpright(
  o: Model,
  cx: number,
  cy: number,
  z0: number,
  z1: number,
  r: number,
  tube: number,
  paint: (angle: number, x: number, y: number, z: number) => number,
): void {
  for (let z = z0; z <= z1; z++)
    for (let y = Math.floor(cy - r - tube); y <= Math.ceil(cy + r + tube); y++)
      for (let x = Math.floor(cx - r - tube); x <= Math.ceil(cx + r + tube); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (Math.abs(d - r) <= tube) o.set(x, y, z, paint(Math.atan2(y - cy, x - cx), x, y, z));
      }
}

/** Flat torus in the xz plane. */
function torusFlat(
  o: Model,
  cx: number,
  cz: number,
  y0: number,
  y1: number,
  r: number,
  tube: number,
  paint: (angle: number, x: number, y: number, z: number) => number,
): void {
  for (let y = y0; y <= y1; y++)
    for (let z = Math.floor(cz - r - tube); z <= Math.ceil(cz + r + tube); z++)
      for (let x = Math.floor(cx - r - tube); x <= Math.ceil(cx + r + tube); x++) {
        const d = Math.hypot(x - cx, z - cz);
        if (Math.abs(d - r) <= tube) o.set(x, y, z, paint(Math.atan2(z - cz, x - cx), x, y, z));
      }
}

/** Horizontal cylinder along x (y/z centre), painted per column. */
function cylX(
  o: Model,
  x0: number,
  x1: number,
  cy: number,
  cz: number,
  r: number,
  paint: (x: number) => number,
): void {
  for (let x = x0; x <= x1; x++) discYZ(o, x, cy, cz, r, paint(x));
}

/** Ingot: three-layer trapezoid bar along x with a bright inset top. */
function ingot(
  o: Model,
  x0: number,
  y: number,
  z0: number,
  len: number,
  wid: number,
  c: number,
  top: number,
): void {
  o.box(x0, y, z0, x0 + len - 1, y, z0 + wid - 1, c);
  o.box(x0 + 1, y + 1, z0, x0 + len - 2, y + 1, z0 + wid - 1, c);
  o.box(x0 + 1, y + 2, z0 + 1, x0 + len - 2, y + 2, z0 + wid - 2, top);
}

/** Irregular lump (rock, slag) from a noisy sphere. */
function lump(
  o: Model,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  pick: (n: number, x: number, y: number, z: number) => number,
  seed = 0,
): void {
  for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
    for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const n = hash3(x + seed, y, z - seed);
        const d = Math.hypot(x - cx, (y - cy) * 1.25, z - cz);
        if (d <= r + (n - 0.5) * 1.4) o.set(x, y, z, pick(n, x, y, z));
      }
}

/** Only paint voxels that already exist. */
function paintIf(o: Model, x: number, y: number, z: number, c: number): void {
  if (o.grid.get(x, y, z)) o.set(x, y, z, c);
}

/** Small printed circuit board with traces and chips (used by several icons). */
function pcb(o: Model, x0: number, z0: number, x1: number, z1: number, board: number, y = 0) {
  o.box(x0, y, z0, x1, y, z1, board);
  for (let x = x0 + 1; x < x1; x += 3) o.box(x, y, z0 + 1, x, y, z1 - 1, C.gold);
  for (let z = z0 + 2; z < z1; z += 4) o.box(x0 + 1, y, z, x1 - 1, y, z, C.gold);
}

// ── Authored icons ───────────────────────────────────────────────

type Builder = () => Model;

const AUTHORED: Record<string, Builder> = {
  // ── Rohstoffe ──
  abstractum: () => {
    const o = new IconModel(13, 15, 13);
    lump(o, 6, 0.6, 6, 5, (n) => (n < 0.35 ? C.concrete : C.concrete_dark), 3);
    spire(o, 6, 5.5, 1, 2.3, 13, C.crystal_violet, C.abstractum, C.halo_glow, 0.02, 0.02);
    spire(o, 2.8, 8.5, 1, 1.5, 8, C.purple_paint, C.abstractum, C.crystal_violet, -0.08, 0.1);
    spire(o, 9.6, 8.6, 1, 1.6, 9, C.crystal_violet, C.abstractum, C.halo_glow, 0.12, 0.08);
    spire(o, 9, 3, 1, 1.2, 6, C.purple_paint, C.crystal_violet, C.abstractum, 0.1, -0.1);
    return o;
  },
  energiezelle: () => {
    const o = new IconModel(10, 13, 10);
    o.cyl(4.5, 4.5, 3.6, 0, 0, C.steel_dark);
    o.cyl(4.5, 4.5, 3.4, 1, 9, C.yellow_paint);
    o.cyl(4.5, 4.5, 3.6, 10, 10, C.steel);
    for (let y = 3; y <= 7; y++) layer(o, 4.5, 4.5, 3.4, y, C.safety_yellow, C.led_amber);
    o.cyl(4.5, 4.5, 3.5, 2, 2, C.paint_black).cyl(4.5, 4.5, 3.5, 8, 8, C.paint_black);
    o.cyl(4.5, 4.5, 1.2, 11, 12, C.chrome);
    o.set(4, 12, 4, C.led_amber);
    return o;
  },
  basislegierung: () => {
    const o = new IconModel(14, 7, 12);
    ingot(o, 0, 0, 0, 13, 5, C.bronze, C.copper);
    ingot(o, 1, 0, 6, 13, 5, C.bronze, C.copper);
    ingot(o, 1, 3, 3, 12, 5, C.bronze, C.gold);
    return o;
  },
  hochlegierung: () => {
    const o = new IconModel(14, 7, 12);
    ingot(o, 0, 0, 0, 13, 5, C.steel_dark, C.steel);
    ingot(o, 1, 0, 6, 13, 5, C.steel_dark, C.steel);
    ingot(o, 1, 3, 3, 12, 5, C.steel, C.chrome);
    o.box(5, 5, 5, 8, 5, 5, C.red_paint);
    o.box(12, 1, 9, 12, 1, 10, C.red_paint);
    // Banding straps over the top bar + a certificate tag: a bundled,
    // tested alloy, not loose ingots like the Basislegierung.
    for (const x of [3, 10]) {
      o.box(x, 6, 3, x, 6, 7, C.metal_dark);
      o.set(x, 5, 8, C.metal_dark).set(x, 5, 2, C.metal_dark);
    }
    o.box(11, 2, 11, 12, 3, 11, C.paper).set(12, 3, 11, C.safety_blue);
    return o;
  },
  nanomaterial: () => {
    const o = new IconModel(12, 12, 12);
    const P = [0, 5, 10];
    for (const a of P)
      for (const b of P) {
        o.box(0, a, b, 10, a, b, C.paint_mint);
        o.box(a, 0, b, a, 10, b, C.paint_mint);
        o.box(a, b, 0, a, b, 10, C.paint_mint);
      }
    for (const x of P) for (const y of P) for (const z of P) o.set(x, y, z, C.led_green);
    o.box(4, 4, 4, 6, 6, 6, C.glass_green);
    o.set(5, 5, 5, C.led_green);
    return o;
  },
  exotische_materie: () => {
    const o = new IconModel(13, 14, 13);
    o.cyl(6, 6, 4, 0, 1, C.metal_dark);
    o.cyl(6, 6, 3, 2, 2, C.steel);
    o.ring(6, 6, 5, 3, C.steel, 1);
    for (let z = 0; z < 13; z++)
      for (let y = 4; y < 14; y++)
        for (let x = 0; x < 13; x++) {
          const d = Math.hypot(x - 6, y - 8.5, z - 6);
          if (d <= 4.2) {
            const n = hash3(x, y, z);
            if (d > 3.2 && n < 0.3) continue;
            o.set(x, y, z, n < 0.45 ? C.exotic : n < 0.75 ? C.glass_purple : C.paint_lilac);
          }
        }
    o.sphere(6, 8.5, 6, 1.8, C.screen_blue);
    torusFlat(o, 6, 6, 8, 8, 5.6, 0.5, (a) => (Math.cos(a * 3) > 0 ? C.chrome : C.exotic));
    return o;
  },
  antimaterie: () => {
    const o = new IconModel(11, 15, 11);
    o.box(0, 0, 0, 10, 1, 10, C.hazard_black);
    for (let x = 0; x <= 10; x++) if (x % 3 === 0) o.box(x, 1, 10, x, 1, 10, C.safety_yellow);
    for (let z = 0; z <= 10; z++) if (z % 3 === 0) o.box(10, 1, z, 10, 1, z, C.safety_yellow);
    o.cyl(5, 5, 3, 2, 2, C.chrome);
    o.cyl(5, 5, 2.4, 3, 10, C.gamma);
    for (let y = 3; y <= 10; y++) layer(o, 5, 5, 2.4, y, C.holo_white, C.gamma);
    o.cyl(5, 5, 2.4, 11, 11, C.ice);
    o.cyl(5, 5, 2.6, 12, 13, C.chrome);
    o.cyl(5, 5, 1.2, 14, 14, C.steel);
    torusFlat(o, 5, 5, 5, 5, 3.4, 0.5, () => C.steel_dark);
    torusFlat(o, 5, 5, 8, 8, 3.4, 0.5, () => C.steel_dark);
    o.sphere(5, 7, 5, 1, C.led_white);
    return o;
  },
  leuchtalgen: () => {
    const o = new IconModel(11, 12, 11);
    o.cyl(5, 5, 4, 0, 0, C.glass);
    o.cyl(5, 5, 4, 1, 7, C.liquid_green);
    for (let y = 1; y <= 7; y++)
      for (let z = 0; z <= 10; z++)
        for (let x = 0; x <= 10; x++)
          if (hash3(x, y, z) < 0.18) paintIf(o, x, y, z, y < 4 ? C.leaf_dark : C.leaf_light);
    o.cyl(5, 5, 4, 8, 9, C.glass_green);
    o.cyl(5, 5, 4.2, 10, 10, C.steel);
    o.cyl(5, 5, 1.5, 11, 11, C.steel_dark);
    return o;
  },
  myzel: () => {
    const o = new IconModel(13, 10, 13);
    lump(o, 6, 1, 6, 5.2, (n) => (n < 0.5 ? C.soil : C.wood_dark), 7);
    for (let z = 0; z < 13; z++)
      for (let x = 0; x < 13; x++)
        for (let y = 5; y >= 0; y--)
          if (o.grid.get(x, y, z)) {
            if ((x * 3 + z * 5) % 7 === 0 || (x + z * 2) % 9 === 0) o.set(x, y, z, C.paint_cream);
            break;
          }
    const shroom = (x: number, z: number, h: number, cap: number) => {
      let base = 0;
      while (base < 9 && o.grid.get(x, base, z)) base++;
      o.box(x, base, z, x, base + h - 1, z, C.paint_cream);
      o.cyl(x, z, 1.4, base + h, base + h, cap);
      o.set(x, base + h + 1, z, cap);
    };
    shroom(4, 8, 3, C.wood_light);
    shroom(8, 7, 2, C.paper);
    shroom(7, 3, 2, C.wood_light);
    return o;
  },
  kaffeebohnen: () => {
    const o = new IconModel(12, 12, 12);
    o.cyl(5.5, 5.5, 4.6, 0, 6, C.cardboard);
    for (let y = 0; y <= 6; y++)
      for (let z = 0; z < 12; z++)
        for (let x = 0; x < 12; x++) if ((x + y) % 4 === 0) paintIf(o, x, y, z, C.book_brown);
    o.ring(5.5, 5.5, 4.6, 7, C.cardboard, 1);
    o.ring(5.5, 5.5, 5.2, 7, C.book_brown, 1);
    o.cyl(5.5, 5.5, 3.8, 7, 7, C.coffee);
    for (let z = 2; z <= 9; z++)
      for (let x = 2; x <= 9; x++) {
        const d = Math.hypot(x - 5.5, z - 5.5);
        if (d < 3.4) o.set(x, 8, z, (x + z) % 3 === 0 ? C.wood_dark : C.coffee);
        if (d < 2) o.set(x, 9, z, (x * z) % 4 === 0 ? C.wood_dark : C.coffee);
      }
    o.box(9, 0, 10, 10, 0, 11, C.coffee).set(10, 0, 10, C.wood_dark);
    return o;
  },
  kaffee: () => {
    const o = new IconModel(12, 14, 11);
    o.cyl(5, 5, 3.8, 0, 7, C.ceramic);
    for (let y = 2; y <= 3; y++) layer(o, 5, 5, 3.8, y, C.safety_orange, C.orange_neon);
    o.cyl(5, 5, 2.8, 7, 7, C.coffee);
    o.box(9, 2, 5, 10, 2, 5, C.ceramic).box(10, 2, 5, 10, 6, 5, C.ceramic);
    o.box(9, 6, 5, 10, 6, 5, C.ceramic);
    for (let y = 8; y <= 13; y++) {
      const x = 5 + Math.round(Math.sin(y * 0.9) * 1.4);
      o.set(x, y, 5, y % 2 ? C.abstractum : C.screen_purple);
      if (y < 12) o.set(x + 1, y, 5, C.holo_white);
    }
    return o;
  },
  halo_kristall: () => {
    const o = new IconModel(13, 15, 13);
    spire(o, 6, 6, 0, 2, 12, C.exotic, C.paint_lilac, C.halo_glow, 0.12, -0.05);
    spire(o, 6, 6, 0, 1.4, 9, C.paint_navy, C.exotic, C.paint_lilac, -0.3, 0.22);
    torusFlat(o, 6.5, 6, 11, 11, 4.2, 0.5, () => C.halo_glow);
    return o;
  },
  geroell: () => {
    const o = new IconModel(13, 8, 13);
    const pick = (n: number, x: number, y: number) =>
      n < 0.12 ? C.copper : n < 0.18 ? C.gold : (x + y) % 3 === 0 ? C.concrete : C.concrete_dark;
    lump(o, 4, 1.5, 5, 3.6, pick, 1);
    lump(o, 9, 1.2, 7, 2.8, pick, 5);
    lump(o, 6, 1, 10, 2.2, pick, 9);
    for (let x = 2; x <= 6; x++) {
      let y = 7;
      while (y > 0 && !o.grid.get(x, y, 7)) y--;
      if (o.grid.get(x, y, 7)) o.set(x, y, 7, C.paint_white);
    }
    return o;
  },

  // ── Bauteile ──
  schraubensatz: () => {
    const o = new IconModel(13, 10, 13);
    const screw = (x: number, z: number, h: number) => {
      for (let y = 0; y < h - 2; y++)
        o.box(x, y, z, x + 1, y, z + 1, y % 2 ? C.steel : C.steel_dark);
      o.cyl(x + 0.5, z + 0.5, 1.6, h - 2, h - 1, C.chrome);
      o.box(x - 1, h - 1, z + 0.5, x + 2, h - 1, z + 0.5, C.metal_dark);
      o.box(x + 0.5, h - 1, z - 1, x + 0.5, h - 1, z + 2, C.metal_dark);
    };
    screw(2, 3, 9);
    screw(8, 2, 7);
    screw(4, 8, 6);
    torusFlat(o, 9.5, 9.5, 0, 1, 1.8, 0.8, () => C.brass);
    return o;
  },
  gehaeuseplatte: () => {
    const o = new IconModel(14, 5, 12);
    o.box(0, 0, 1, 13, 0, 11, C.aluminium);
    for (let z = 2; z <= 11; z += 2) o.box(0, 0, z, 13, 0, z, C.chrome);
    o.box(0, 1, 0, 13, 4, 0, C.aluminium).box(0, 1, 1, 13, 1, 1, C.steel);
    for (const [x, z] of [
      [2, 3],
      [11, 3],
      [2, 9],
      [11, 9],
    ] as const)
      o.set(x, 0, z, C.metal_dark);
    for (let x = 2; x <= 11; x += 3) o.set(x, 3, 0, C.metal_dark);
    return o;
  },
  kupferspule: () => {
    const o = new IconModel(14, 11, 11);
    cylX(o, 1, 12, 5, 5, 3.8, (x) => (x % 2 ? C.copper : C.bronze));
    discYZ(o, 0, 5, 5, 4.8, C.paint_black);
    discYZ(o, 13, 5, 5, 4.8, C.paint_black);
    discYZ(o, 13, 5, 5, 1.4, C.metal_dark);
    o.box(4, 9, 5, 4, 10, 5, C.copper).box(9, 9, 5, 9, 10, 5, C.copper);
    return o;
  },
  kondensator: () => {
    const o = new IconModel(11, 13, 11);
    pcb(o, 0, 0, 10, 10, C.green_paint);
    o.cyl(5, 5, 3.4, 1, 10, C.paint_navy);
    for (let y = 1; y <= 10; y++) {
      o.set(8, y, 7, C.safety_yellow).set(7, y, 8, C.safety_yellow);
    }
    o.cyl(5, 5, 3.4, 11, 11, C.chrome);
    o.box(3, 12, 5, 7, 12, 5, C.steel).box(5, 12, 3, 5, 12, 7, C.steel);
    o.set(5, 12, 5, C.chrome);
    return o;
  },
  platine: () => {
    const o = new IconModel(14, 5, 12);
    o.box(0, 0, 0, 13, 0, 11, C.green_paint);
    for (let x = 1; x < 13; x += 2) o.box(x, 0, 11, x, 0, 11, C.gold);
    for (let z = 2; z < 10; z += 3) o.box(1, 0, z, 12, 0, z, C.safety_green);
    o.box(2, 1, 2, 6, 2, 6, C.paint_black);
    for (let x = 2; x <= 6; x += 2) o.set(x, 1, 7, C.chrome).set(x, 1, 1, C.chrome);
    o.box(9, 1, 2, 11, 1, 4, C.paint_black);
    o.cyl(10, 8, 1.2, 1, 3, C.paint_navy);
    o.set(10, 4, 8, C.chrome);
    o.box(3, 1, 9, 5, 1, 9, C.brass);
    o.set(12, 1, 1, C.led_red);
    // Pin header with a ribbon cable curling off the right edge.
    o.box(12, 1, 5, 12, 1, 9, C.paint_black);
    for (let z = 5; z <= 9; z++) o.set(13, 2, z, z % 2 ? C.paint_gray : C.paint_white);
    o.box(13, 3, 6, 13, 4, 8, C.paint_gray);
    return o;
  },
  speicherchip: () => {
    const o = new IconModel(14, 4, 8);
    o.box(0, 0, 0, 13, 0, 6, C.blue_paint);
    for (let x = 0; x <= 13; x++) o.set(x, 0, 7, x % 2 ? C.gold : C.brass);
    for (let i = 0; i < 4; i++) o.box(1 + i * 3, 1, 1, 2 + i * 3, 1, 4, C.paint_black);
    for (let i = 0; i < 4; i++) o.set(1 + i * 3, 2, 1, C.steel);
    o.box(6, 0, 7, 6, 0, 7, 0);
    o.set(12, 1, 5, C.paper);
    // Heat spreader clip and the two retention latches at the ends.
    o.box(1, 2, 3, 11, 2, 3, C.aluminium);
    o.box(0, 1, 0, 0, 3, 1, C.paint_white).box(13, 1, 0, 13, 3, 1, C.paint_white);
    return o;
  },
  kabelbaum: () => {
    const o = new IconModel(15, 6, 14);
    const cols = [C.cable_red, C.cable_yellow, C.safety_blue, C.cable_black];
    o.box(0, 0, 4, 2, 3, 9, C.paint_gray);
    for (let z = 5; z <= 8; z++) o.set(1, 4, z, C.gold);
    cols.forEach((c, i) => {
      const z = 5 + i;
      o.box(3, 1, z, 8, 1, z, c);
      const tz = 1 + i * 3.6;
      for (let x = 9; x <= 12; x++) o.set(x, 1, z + ((tz - z) * (x - 8)) / 4, c);
      o.box(13, 0, Math.round(tz), 14, 2, Math.round(tz), c === C.cable_black ? C.paint_gray : c);
      o.set(14, 1, Math.round(tz), C.gold);
    });
    for (const x of [4, 7]) o.box(x, 0, 4, x, 2, 9, C.paint_black);
    o.box(5, 2, 5, 6, 2, 8, C.paint_white);
    return o;
  },
  luefter: () => {
    const o = new IconModel(13, 4, 13);
    o.box(0, 0, 0, 12, 2, 12, C.metal_dark);
    o.cyl(6, 6, 5.3, 1, 2, 0);
    o.cyl(6, 6, 5.3, 0, 0, C.black);
    for (const [x, z] of [
      [1, 1],
      [11, 1],
      [1, 11],
      [11, 11],
    ] as const)
      o.set(x, 2, z, C.steel);
    for (let z = 0; z < 13; z++)
      for (let x = 0; x < 13; x++) {
        const d = Math.hypot(x - 6, z - 6);
        const a = Math.atan2(z - 6, x - 6) + d * 0.25;
        const blade = Math.floor(((a + Math.PI * 4) / (Math.PI * 2)) * 7) % 7;
        if (d > 1.6 && d < 5.2 && Math.sin(a * 7) > -0.1 && blade !== 3)
          o.set(x, 2, z, d > 4 ? C.steel : C.bot_body);
      }
    o.cyl(6, 6, 1.6, 1, 3, C.safety_blue);
    o.set(6, 3, 6, C.paint_white);
    return o;
  },
  kuehlrippe: () => {
    const o = new IconModel(13, 10, 12);
    o.box(0, 0, 0, 12, 1, 11, C.aluminium);
    for (let x = 0; x <= 12; x += 2) {
      o.box(x, 2, 0, x, 8, 11, C.aluminium);
      o.box(x, 9, 0, x, 9, 11, C.chrome);
    }
    o.box(0, 1, 11, 12, 1, 11, C.steel);
    o.box(3, 0, 12 - 1, 9, 0, 11, C.paint_gray);
    return o;
  },
  linse: () => {
    const o = new IconModel(12, 13, 9);
    o.box(3, 0, 2, 8, 0, 6, C.steel_dark);
    o.box(5, 1, 3, 6, 2, 5, C.steel);
    for (let z = 2; z <= 6; z++) {
      const r = z === 4 ? 4.6 : z === 3 || z === 5 ? 4.1 : 3.3;
      discXY(o, 5.5, 7.5, z, r, C.glass);
    }
    discXY(o, 5.5, 7.5, 4, 5.4, C.steel, true);
    for (let z = 3; z <= 5; z++) discXY(o, 5.5, 7.5, z, 5.4, C.steel, true);
    o.set(4, 9, 6, C.led_white).set(3, 10, 6, C.holo_white).set(4, 10, 6, C.holo_white);
    o.set(6, 7, 6, C.glass_dark).set(7, 6, 6, C.glass_dark).set(5, 8, 6, C.glass_dark);
    return o;
  },
  prisma: () => {
    const o = new IconModel(14, 10, 14);
    o.box(1, 0, 3, 9, 0, 9, C.steel_dark);
    for (let y = 1; y <= 8; y++) {
      const half = (8 - y) * 0.5;
      o.box(1, y, Math.round(6 - half), 9, y, Math.round(6 + half), C.glass);
      o.box(1, y, Math.round(6 + half), 9, y, Math.round(6 + half), C.ice);
    }
    const beams = [C.led_red, C.orange_neon, C.led_amber, C.led_green, C.neon_blue, C.neon_purple];
    beams.forEach((c, i) => {
      for (let z = 10; z <= 13; z++) o.set(3 + i + (z - 10) * (i - 2.5) * 0.25, 2, z, c);
    });
    for (let x = 10; x <= 13; x++) o.set(x, 4, 6, C.led_white);
    return o;
  },
  quarzkristall: () => {
    const o = new IconModel(11, 14, 11);
    o.box(2, 0, 2, 8, 1, 8, C.chrome);
    o.box(3, 0, 9, 3, 0, 10, C.steel).box(7, 0, 9, 7, 0, 10, C.steel);
    spire(o, 5, 5, 2, 2, 12, C.ice, C.holo_white, C.crystal_violet, 0.04, 0.02);
    spire(o, 2.5, 7, 2, 1, 6, C.ice, C.holo_white, C.crystal_violet, -0.12, 0.08);
    spire(o, 8, 6.5, 2, 1.1, 7, C.ice, C.holo_white, C.crystal_violet, 0.12, 0.05);
    return o;
  },
  magnet: () => {
    const o = new IconModel(13, 13, 5);
    torusUpright(o, 6, 6, 1, 3, 4.5, 1.5, (a) => (a > 0 ? C.red_paint : C.safety_red));
    o.box(0, 6, 0, 12, 12, 4, 0);
    o.box(0, 6, 1, 3, 10, 3, C.safety_red).box(9, 6, 1, 12, 10, 3, C.safety_red);
    o.box(0, 11, 1, 3, 12, 3, C.chrome).box(9, 11, 1, 12, 12, 3, C.chrome);
    for (const x of [1, 11]) o.set(x, 12, 3, C.led_white);
    o.box(5, 12, 2, 7, 12, 2, C.screen_cyan);
    return o;
  },
  sensorkopf: () => {
    const o = new IconModel(12, 13, 12);
    o.cyl(5.5, 5.5, 4.5, 0, 1, C.metal_dark);
    o.cyl(5.5, 5.5, 4, 2, 5, C.green_paint);
    o.sphere(5.5, 6, 5.5, 3.6, C.green_paint);
    o.box(0, 0, 0, 11, 5, 11, 0);
    o.cyl(5.5, 5.5, 4.5, 0, 1, C.metal_dark);
    o.cyl(5.5, 5.5, 4, 2, 5, C.green_paint);
    discXY(o, 5.5, 4, 10, 1.6, C.paint_black);
    o.set(5, 4, 10, C.lime).set(6, 4, 10, C.led_green);
    for (const [x, z] of [
      [3, 3],
      [8, 3],
      [3, 8],
      [8, 8],
    ] as const) {
      o.box(x, 8, z, x, 11, z, C.chrome);
      o.set(x, 12, z, C.led_green);
    }
    return o;
  },
  antenne: () => {
    const o = new IconModel(11, 16, 11);
    o.box(1, 0, 1, 9, 3, 9, C.paint_black);
    o.box(2, 1, 10, 8, 2, 10, C.metal_dark);
    o.set(3, 2, 10, C.led_green).set(5, 2, 10, C.led_amber);
    discYZ(o, 10, 2, 5, 1.2, C.chrome);
    for (let y = 4; y <= 14; y++) {
      const x = 5 + Math.floor((y - 4) * 0.25);
      const w = y < 8 ? 1 : 0;
      o.box(x, y, 5, x + w, y, 5 + w, y < 8 ? C.steel : C.chrome);
    }
    o.sphere(7.5, 15, 5, 0.8, C.chrome);
    return o;
  },
  membran: () => {
    const o = new IconModel(13, 6, 13);
    o.cyl(6, 6, 6, 0, 1, C.metal_dark);
    o.cyl(6, 6, 6.2, 2, 3, C.red_paint);
    for (let z = 0; z < 13; z++)
      for (let x = 0; x < 13; x++) {
        const d = Math.hypot(x - 6, z - 6);
        if (d <= 5.2) {
          const y = Math.max(1, Math.min(3, Math.round(1 + d * 0.45)));
          o.box(x, y, z, x, 3, z, 0);
          o.set(x, y, z, d > 4.4 ? C.rubber : Math.round(d) % 2 ? C.cardboard : C.paper);
        }
      }
    o.sphere(6, 1.5, 6, 1.6, C.paint_black);
    return o;
  },
  oszillator: () => {
    const o = new IconModel(14, 8, 12);
    pcb(o, 0, 0, 13, 11, C.purple_paint);
    o.box(3, 1, 3, 10, 4, 8, C.chrome);
    o.box(3, 4, 3, 3, 4, 3, C.steel).box(10, 4, 8, 10, 4, 8, C.steel);
    o.box(3, 4, 8, 3, 4, 8, C.steel).box(10, 4, 3, 10, 4, 3, C.steel);
    for (let x = 4; x <= 9; x++) o.set(x, 3, 9, C.paint_black);
    for (let x = 1; x <= 12; x++) {
      const y = 6 + Math.round(Math.sin(x * 0.9) * 1.2);
      o.set(x, y, 6, C.screen_purple);
    }
    return o;
  },
  laserdiode: () => {
    const o = new IconModel(10, 10, 16);
    o.box(1, 0, 0, 8, 1, 7, C.metal_dark);
    for (let z = 1; z <= 6; z++) discXY(o, 4.5, 5, z, z === 1 ? 3.6 : 3, C.gold);
    discXY(o, 4.5, 5, 7, 2, C.brass);
    discXY(o, 4.5, 5, 7, 1, C.glass_red);
    o.box(3, 4, 0, 3, 4, 0, C.steel).box(6, 4, 0, 6, 4, 0, C.steel);
    for (let z = 8; z <= 15; z++) o.set(4, 5, z, z % 2 ? C.led_red : C.mcp_red);
    o.box(8, 3, 3, 8, 6, 5, C.safety_yellow).set(8, 4, 4, C.hazard_black);
    return o;
  },
  servo: () => {
    const o = new IconModel(14, 11, 9);
    o.box(2, 0, 1, 11, 6, 7, C.safety_orange);
    o.box(0, 5, 2, 13, 5, 6, C.orange_paint);
    o.set(0, 5, 4, 0).set(13, 5, 4, 0);
    o.box(3, 1, 7, 10, 3, 7, C.paint_black);
    o.set(4, 2, 7, C.paint_white).set(6, 2, 7, C.paint_white);
    o.cyl(8, 4, 2, 7, 7, C.orange_paint);
    o.cyl(8, 4, 1, 8, 8, C.brass);
    o.box(4, 9, 3, 10, 9, 5, C.paint_white);
    o.box(8, 9, 1, 8, 9, 7, C.paint_white);
    o.set(8, 10, 4, C.chrome);
    return o;
  },
  display: () => {
    const o = new IconModel(14, 13, 8);
    o.box(4, 0, 1, 9, 0, 6, C.paint_gray);
    o.box(6, 1, 3, 7, 2, 4, C.paint_gray);
    o.box(0, 3, 2, 13, 12, 4, C.paint_gray);
    o.box(1, 4, 5, 12, 11, 5, C.metal_dark);
    for (let y = 5; y <= 10; y++)
      for (let x = 2; x <= 11; x++)
        o.set(
          x,
          y,
          5,
          y % 2 === 0 ? C.screen_green : (x + y) % 5 === 0 ? C.screen_green : C.crt_bg,
        );
    o.set(9, 9, 5, C.screen_white);
    o.set(12, 3, 5, C.led_green);
    return o;
  },
  batteriezelle: () => {
    const o = new IconModel(15, 7, 7);
    cylX(o, 1, 12, 3, 3, 2.9, (x) =>
      x === 1 ? C.metal_dark : x >= 10 ? C.paint_black : C.safety_yellow,
    );
    discYZ(o, 13, 3, 3, 1.2, C.chrome);
    discYZ(o, 0, 3, 3, 2.2, C.steel);
    for (let x = 4; x <= 7; x++) o.set(x, 3, 6, C.paint_black);
    o.set(5, 2, 6, C.paint_black).set(5, 4, 6, C.paint_black);
    return o;
  },
  supraleiter: () => {
    const o = new IconModel(13, 7, 13);
    o.cyl(6, 6, 5.8, 0, 0, C.chrome);
    o.cyl(6, 6, 5.2, 1, 4, C.blue_paint);
    for (let y = 1; y <= 4; y++) torusFlat(o, 6, 6, y, y, 5, 0.3, () => C.safety_blue);
    o.cyl(6, 6, 5.8, 5, 5, C.chrome);
    o.cyl(6, 6, 1.8, 0, 5, C.paint_black);
    o.cyl(6, 6, 1, 0, 5, 0);
    for (let x = 0; x < 13; x++)
      for (let z = 0; z < 13; z++) if (hash3(x, 6, z) < 0.13) paintIf(o, x, 5, z, C.ice);
    o.box(11, 1, 6, 12, 1, 12, C.safety_blue);
    return o;
  },
  qubit_chip: () => {
    const o = new IconModel(12, 12, 12);
    o.box(0, 0, 0, 11, 1, 11, C.gold);
    for (let i = 1; i <= 10; i += 2) {
      o.set(i, 1, 0, C.brass).set(i, 1, 11, C.brass).set(0, 1, i, C.brass).set(11, 1, i, C.brass);
    }
    o.box(2, 2, 2, 9, 2, 9, C.paint_black);
    o.box(4, 3, 4, 7, 3, 7, C.exotic);
    o.box(5, 3, 5, 6, 3, 6, C.screen_blue);
    for (const [x, z] of [
      [3, 3],
      [8, 3],
      [3, 8],
      [8, 8],
    ] as const)
      o.set(x, 3, z, C.gold);
    o.sphere(5.5, 8, 5.5, 1.7, C.exotic);
    o.set(6, 9, 6, C.paint_lilac);
    torusFlat(o, 5.5, 5.5, 8, 8, 3.2, 0.4, () => C.paint_lilac);
    return o;
  },
  filterpatrone: () => {
    const o = new IconModel(11, 12, 11);
    o.cyl(5, 5, 4.6, 0, 1, C.paint_gray);
    for (let z = 0; z < 11; z++)
      for (let x = 0; x < 11; x++) {
        const a = Math.atan2(z - 5, x - 5);
        const d = Math.hypot(x - 5, z - 5);
        if (d <= 4.3) o.box(x, 2, z, x, 9, z, Math.cos(a * 10) > 0 ? C.paper : C.paint_white);
      }
    o.cyl(5, 5, 4.6, 10, 10, C.paint_gray);
    o.cyl(5, 5, 1.8, 0, 10, C.metal_dark);
    for (let x = 0; x < 11; x++)
      for (let z = 0; z < 11; z++) if (hash3(x, 3, z) < 0.14) paintIf(o, x, 10, z, C.gamma);
    for (let y = 3; y <= 8; y++) if (y % 2) paintIf(o, 8, y, 8, C.halo_glow);
    return o;
  },
  duese: () => {
    const o = new IconModel(10, 13, 10);
    for (let y = 0; y <= 3; y++) o.cyl(4.5, 4.5, 1.9, y, y, y % 2 ? C.brass : C.gold);
    for (let y = 4; y <= 6; y++) {
      for (let z = 0; z < 10; z++)
        for (let x = 0; x < 10; x++) {
          const ax = Math.abs(x - 4.5);
          const az = Math.abs(z - 4.5);
          if (ax <= 4 && az <= 4 && ax + az * 0.58 <= 4.4 && az + ax * 0.58 <= 4.4)
            o.set(x, y, z, y === 6 ? C.gold : C.brass);
        }
    }
    for (let y = 7; y <= 10; y++)
      o.cyl(4.5, 4.5, Math.max(0.6, 2.8 - (y - 7) * 0.7), y, y, C.brass);
    o.set(4, 11, 4, C.orange_neon).set(5, 11, 5, C.plasma);
    o.set(4, 12, 5, C.fire);
    return o;
  },
  thermoelement: () => {
    const o = new IconModel(16, 6, 10);
    o.box(0, 0, 2, 4, 3, 7, C.safety_yellow);
    o.box(1, 3, 3, 3, 3, 6, C.yellow_paint);
    o.box(5, 1, 3, 6, 1, 3, C.chrome).box(5, 1, 6, 6, 1, 6, C.chrome);
    for (let x = 7; x <= 10; x++) {
      o.set(x, 0, 4 + (x % 2), C.cable_red);
      o.set(x, 0, 5 - (x % 2), C.cable_yellow);
    }
    o.box(11, 0, 4, 11, 1, 5, C.steel_dark);
    o.box(12, 0, 4, 14, 0, 5, C.steel);
    o.set(15, 0, 4, C.fire).set(15, 0, 5, C.plasma);
    return o;
  },
  plasmaring: () => {
    const o = new IconModel(14, 6, 14);
    torusFlat(o, 6.5, 6.5, 0, 3, 4.6, 1.8, (a) => (Math.cos(a * 6) > 0.4 ? C.copper : C.steel));
    torusFlat(o, 6.5, 6.5, 4, 4, 4.6, 1.1, () => C.plasma);
    torusFlat(o, 6.5, 6.5, 5, 5, 4.6, 0.5, () => C.lamp_warm);
    return o;
  },
  rotor: () => {
    const o = new IconModel(15, 5, 15);
    const blade = (
      x0: number,
      z0: number,
      x1: number,
      z1: number,
      tip: 1 | -1,
      alongX: boolean,
    ) => {
      o.box(x0, 1, z0, x1, 1, z1, C.paint_black);
      if (alongX) o.box(tip > 0 ? x1 - 1 : x0, 1, z0, tip > 0 ? x1 : x0 + 1, 1, z1, C.safety_green);
      else o.box(x0, 1, tip > 0 ? z1 - 1 : z0, x1, 1, tip > 0 ? z1 : z0 + 1, C.safety_green);
    };
    blade(9, 6, 14, 8, 1, true);
    blade(0, 6, 5, 7, -1, true);
    blade(7, 9, 8, 14, 1, false);
    blade(6, 0, 7, 5, -1, false);
    o.cyl(7, 7, 2.2, 0, 2, C.green_paint);
    o.cyl(7, 7, 1, 3, 3, C.chrome);
    o.set(7, 4, 7, C.led_green);
    return o;
  },
  glasfaser: () => {
    const o = new IconModel(15, 10, 12);
    cylX(o, 0, 6, 3, 6, 2.4, (x) => (x === 0 ? C.metal_dark : x === 6 ? C.steel : C.blue_paint));
    const tips = [C.cerulean, C.led_white, C.plasma_blue, C.holo_cyan, C.cerulean, C.led_white];
    tips.forEach((c, i) => {
      const dz = (i % 3) - 1;
      const dy = Math.floor(i / 3);
      for (let x = 7; x <= 13; x++) {
        const t = (x - 7) / 6;
        o.set(x, Math.round(2 + dy + dy * t * 4), Math.round(6 + dz + dz * t * 4), C.glass);
      }
      o.set(14, Math.round(2 + dy + dy * 4), Math.round(6 + dz + dz * 4), c);
    });
    return o;
  },
  zahnrad: () => {
    const o = new IconModel(15, 4, 15);
    gearFlat(o, 7, 7, 0, 1, 5.6, 12, C.brass, C.chrome);
    for (const [x, z] of [
      [4, 7],
      [10, 7],
      [7, 4],
      [7, 10],
    ] as const)
      o.box(x, 0, z, x, 1, z, 0);
    torusFlat(o, 7, 7, 1, 1, 4.2, 0.4, () => C.gold);
    return o;
  },
  schraubendreher: () => {
    const o = new IconModel(16, 5, 8);
    for (let x = 0; x <= 6; x++) {
      const c = x % 3 === 1 ? C.rubber : C.red_paint;
      o.box(x, 0, 2, x, 2, 4, c);
      o.set(x, 0, 2, 0).set(x, 2, 2, 0).set(x, 0, 4, 0).set(x, 2, 4, 0);
      o.set(x, 1, 1, c).set(x, 1, 5, c).set(x, 3, 3, c);
    }
    o.box(0, 1, 3, 0, 1, 3, C.wood_red);
    o.box(7, 1, 3, 14, 1, 3, C.chrome);
    o.box(7, 1, 2, 7, 1, 4, C.steel);
    o.set(15, 1, 3, C.steel_dark);
    o.set(3, 3, 3, C.fabric_red);
    return o;
  },
  rahmen: () => {
    const o = new IconModel(13, 11, 13);
    const e = C.steel_dark;
    const lo = 0;
    const hi = 12;
    for (const y of [0, 10]) {
      o.box(lo, y, lo, hi, y, lo, e).box(lo, y, hi, hi, y, hi, e);
      o.box(lo, y, lo, lo, y, hi, e).box(hi, y, lo, hi, y, hi, e);
    }
    for (const [x, z] of [
      [lo, lo],
      [hi, lo],
      [lo, hi],
      [hi, hi],
    ] as const) {
      o.box(x, 0, z, x, 10, z, C.steel);
      o.box(x, 0, z, x, 1, z, C.safety_orange).box(x, 9, z, x, 10, z, C.safety_orange);
    }
    for (const [x, z] of [
      [1, hi],
      [hi, 1],
      [hi - 1, hi],
      [hi, hi - 1],
    ] as const) {
      o.set(x, 9, z, C.safety_orange).set(x, 1, z, C.safety_orange);
    }
    o.box(1, 0, 1, 11, 0, 11, C.orange_paint);
    o.set(4, 10, hi, C.chrome).set(8, 10, hi, C.chrome).set(hi, 10, 4, C.chrome);
    return o;
  },
  induktor: () => {
    const o = new IconModel(13, 14, 6);
    torusUpright(o, 6, 7, 1, 4, 4.4, 1.9, (a) =>
      Math.cos(a * 9) > -0.3 ? (Math.cos(a * 9) > 0.6 ? C.bronze : C.copper) : C.red_paint,
    );
    o.box(3, 0, 2, 3, 2, 2, C.copper).box(9, 0, 2, 9, 2, 2, C.copper);
    o.box(2, 0, 1, 10, 0, 4, C.metal_dark);
    return o;
  },
  steuermodul: () => {
    const o = new IconModel(14, 9, 11);
    o.box(0, 0, 0, 13, 5, 9, C.paint_navy);
    o.box(1, 5, 1, 12, 5, 8, C.blue_paint);
    o.box(2, 6, 2, 6, 6, 5, C.green_paint);
    o.box(3, 7, 3, 5, 7, 4, C.paint_black);
    o.box(8, 6, 2, 11, 6, 3, C.paint_black);
    for (let x = 8; x <= 11; x++) o.set(x, 7, 2, C.gold);
    o.box(1, 1, 10, 12, 3, 10, C.metal_dark);
    o.leds(2, 11, 2, 10, [C.led_green, C.led_amber, C.led_green, C.led_blue, C.led_green]);
    for (let z = 2; z <= 7; z++) o.set(14 - 1, 3, z, z % 2 ? C.gold : C.brass);
    return o;
  },
  kuehlblock: () => {
    const o = new IconModel(13, 13, 13);
    o.box(0, 0, 0, 12, 1, 12, C.aluminium);
    for (let x = 0; x <= 12; x += 2) o.box(x, 2, 0, x, 7, 12, x % 4 ? C.aluminium : C.chrome);
    o.box(0, 8, 0, 12, 10, 12, C.metal_dark);
    o.cyl(6, 6, 5.2, 9, 10, 0);
    for (let z = 0; z < 13; z++)
      for (let x = 0; x < 13; x++) {
        const d = Math.hypot(x - 6, z - 6);
        const a = Math.atan2(z - 6, x - 6) + d * 0.25;
        if (d > 1.6 && d < 5.2 && Math.sin(a * 5) > 0) o.set(x, 9, z, C.safety_blue);
      }
    o.cyl(6, 6, 1.5, 9, 11, C.paint_black);
    o.set(6, 12, 6, C.cerulean);
    return o;
  },
  optikbank: () => {
    const o = new IconModel(16, 10, 8);
    o.box(0, 0, 2, 15, 1, 5, C.steel_dark);
    o.box(0, 1, 3, 15, 1, 4, C.metal_dark);
    for (const x of [2, 7, 12]) o.box(x, 2, 3, x + 1, 3, 4, C.steel);
    discYZ(o, 2, 6, 3.5, 2.8, C.steel_dark);
    discYZ(o, 2, 6, 3.5, 1.6, C.led_red);
    for (let x = 7; x <= 8; x++) discYZ(o, x, 6.5, 3.5, 2.6, C.glass);
    for (let y = 4; y <= 9; y++) {
      const half = (9 - y) * 0.45;
      o.box(12, y, Math.round(3.5 - half), 14, y, Math.round(3.5 + half), C.ice);
    }
    for (let x = 3; x <= 6; x++) o.set(x, 6, 4, C.led_red);
    for (let x = 9; x <= 11; x++) o.set(x, 6, 4, C.lime);
    return o;
  },
  resonanzkammer: () => {
    const o = new IconModel(12, 15, 12);
    o.cyl(5.5, 5.5, 5, 0, 1, C.metal_dark);
    o.cyl(5.5, 5.5, 4.3, 2, 9, C.brass);
    for (const y of [2, 9]) o.cyl(5.5, 5.5, 4.7, y, y, C.gold);
    for (let y = 4; y <= 7; y++)
      layer(o, 5.5, 5.5, 4.3, y, y === 4 || y === 7 ? C.brass : C.purple_paint, C.neon_magenta);
    for (let y = 4; y <= 7; y++) paintIf(o, 9, y, 8, C.abstractum);
    o.sphere(5.5, 10, 5.5, 3.4, C.brass);
    o.box(0, 0, 0, 11, 9, 11, 0);
    o.cyl(5.5, 5.5, 5, 0, 1, C.metal_dark);
    o.cyl(5.5, 5.5, 4.3, 2, 9, C.brass);
    for (const y of [2, 9]) o.cyl(5.5, 5.5, 4.7, y, y, C.gold);
    for (let y = 4; y <= 7; y++)
      layer(o, 5.5, 5.5, 4.3, y, y === 4 || y === 7 ? C.brass : C.purple_paint, C.neon_magenta);
    spire(o, 5.5, 5.5, 12, 1, 3, C.ice, C.holo_white, C.crystal_violet);
    return o;
  },
  sendeempfaenger: () => {
    const o = new IconModel(14, 16, 10);
    o.box(0, 0, 1, 13, 6, 8, C.green_paint);
    o.box(0, 6, 1, 13, 6, 8, C.safety_green);
    for (let y = 1; y <= 5; y++)
      for (let x = 1; x <= 5; x++) o.set(x, y, 9, (x + y) % 2 ? C.metal_dark : C.paint_black);
    discXY(o, 9.5, 3.5, 9, 1.8, C.chrome);
    o.set(9, 4, 10, C.paint_black);
    o.box(8, 5, 9, 11, 5, 9, C.crt_bg);
    o.set(9, 5, 9, C.screen_green).set(10, 5, 9, C.screen_green);
    for (let y = 7; y <= 14; y++) o.set(11 + Math.floor((y - 7) / 5), y, 3, C.chrome);
    o.set(12, 15, 3, C.led_green);
    for (let y = 7; y <= 9; y++) o.set(3, y, 3, C.steel);
    discXY(o, 3, 11, 4, 2.4, C.paint_white);
    o.set(3, 11, 5, C.steel);
    return o;
  },
  lichtleiter: () => {
    const o = new IconModel(15, 11, 6);
    for (let a = 0; a <= Math.PI; a += 0.03) {
      const x = 7 + Math.cos(a) * 5.5;
      const y = 1 + Math.sin(a) * 7.5;
      for (let dz = 1; dz <= 3; dz++)
        for (let d = -0.8; d <= 0.8; d += 0.8) {
          const n = hash3(Math.round(x), Math.round(y + d), dz);
          o.set(x + d, y, dz, n < 0.3 ? C.liquid_green : n < 0.6 ? C.glass_green : C.led_green);
        }
    }
    o.box(0, 0, 1, 3, 1, 4, C.steel).box(11, 0, 1, 14, 1, 4, C.steel);
    return o;
  },
  myzelplatine: () => {
    const o = new IconModel(14, 7, 12);
    o.box(0, 0, 0, 13, 0, 11, C.yellow_paint);
    for (let x = 1; x < 13; x += 2) o.set(x, 0, 11, C.gold);
    o.box(2, 1, 2, 6, 2, 6, C.paint_black);
    o.box(9, 1, 2, 11, 1, 4, C.paint_black);
    for (let x = 0; x < 14; x++)
      for (let z = 0; z < 12; z++)
        if (Math.abs(Math.sin(x * 0.7) * 3 + 6 - z) < 0.7 || Math.abs(x - 3 - z * 0.6) < 0.5)
          o.set(x, o.grid.get(x, 1, z) ? 3 : 1, z, C.paint_cream);
    const shroom = (x: number, z: number, h: number) => {
      o.box(x, 1, z, x, h, z, C.paint_cream);
      o.cyl(x, z, 1.2, h + 1, h + 1, C.wood_light);
    };
    shroom(10, 8, 3);
    shroom(12, 6, 2);
    shroom(8, 9, 1);
    return o;
  },

  // ── Relikte ──
  synapsis_splitter: () => {
    const o = new IconModel(14, 13, 9);
    for (let a = Math.PI * 0.05; a <= Math.PI * 0.72; a += 0.03) {
      const x = 5 + Math.cos(a) * 5.5;
      const y = 3 + Math.sin(a) * 8;
      for (let z = 3; z <= 5; z++) o.set(x, y, z, z === 5 ? C.chrome : C.paint_black);
    }
    for (let z = 2; z <= 6; z++) discXY(o, 10, 3.5, z, 3.3, C.leather_black);
    discXY(o, 10, 3.5, 7, 3.3, C.chrome, true);
    discXY(o, 10, 3.5, 7, 2.1, C.exotic);
    o.set(10, 4, 7, C.screen_blue).set(9, 3, 7, C.paint_lilac);
    spire(o, 3, 4, 8, 1.5, 5, C.exotic, C.paint_lilac, C.screen_blue, -0.25, 0);
    o.set(4, 11, 4, C.paint_lilac).set(2, 12, 3, C.screen_blue);
    return o;
  },
  halo_staub: () => {
    const o = new IconModel(13, 13, 13);
    o.cyl(6, 6, 5.5, 0, 0, C.glass);
    o.ring(6, 6, 5.5, 1, C.ice, 1);
    for (let z = 0; z < 13; z++)
      for (let x = 0; x < 13; x++) {
        const d = Math.hypot(x - 6, z - 6);
        const h = Math.round(3 - d * 0.7);
        for (let y = 1; y <= h; y++) {
          const n = hash3(x, y, z);
          o.set(x, y, z, n < 0.25 ? C.gamma : n < 0.5 ? C.halo_glow : C.holo_white);
        }
      }
    torusFlat(o, 6, 6, 9, 9, 4, 0.5, () => C.halo_glow);
    for (const [x, y, z] of [
      [3, 6, 5],
      [9, 7, 4],
      [6, 11, 8],
      [2, 10, 9],
      [10, 5, 10],
    ] as const)
      o.set(x, y, z, C.gamma);
    return o;
  },
  kristall_0089: () => {
    const o = new IconModel(12, 16, 12);
    o.box(1, 0, 1, 10, 1, 10, C.chrome);
    o.box(2, 2, 2, 9, 2, 9, C.steel);
    for (let y = 3; y <= 12; y++) {
      const c = y === 7 ? C.orange_neon : y % 2 ? C.crystal_cyan : C.safety_blue;
      layer(o, 5.5, 5.5, 3.3, y, c, y === 7 ? C.plasma : C.holo_cyan);
    }
    spire(o, 5.5, 5.5, 13, 3.3, 3, C.crystal_cyan, C.holo_cyan, C.lamp_cold);
    return o;
  },
  anomaler_kern: () => {
    const o = new IconModel(13, 15, 13);
    o.cyl(6, 6, 5.5, 0, 1, C.metal_dark);
    o.cyl(6, 6, 5.5, 13, 14, C.metal_dark);
    for (let a = 0; a < 8; a++) {
      const x = Math.round(6 + Math.cos((a * Math.PI) / 4) * 5.2);
      const z = Math.round(6 + Math.sin((a * Math.PI) / 4) * 5.2);
      o.box(x, 2, z, x, 12, z, C.steel);
    }
    for (let z = 0; z < 13; z++)
      for (let y = 3; y < 12; y++)
        for (let x = 0; x < 13; x++) {
          const d = Math.hypot(x - 6, y - 7.5, z - 6);
          const n = hash3(x * 2, y, z * 3);
          if (d <= 3.4 + (n - 0.5) * 1.2)
            o.set(x, y, z, n < 0.3 ? C.abstractum : n < 0.6 ? C.neon_purple : C.neon_pink);
        }
    o.set(6, 12, 6, C.led_pink);
    return o;
  },
  damien_band: () => {
    const o = new IconModel(14, 4, 14);
    o.cyl(6.5, 6.5, 6.4, 0, 0, C.orange_paint);
    o.cyl(6.5, 6.5, 5.2, 1, 1, C.coffee);
    for (let r = 2.2; r < 5.2; r += 1.4) o.ring(6.5, 6.5, r, 1, C.wood_dark, 1);
    o.cyl(6.5, 6.5, 6.4, 2, 2, C.safety_orange);
    for (let a = 0; a < 3; a++) {
      const x = 6.5 + Math.cos(a * 2.094) * 3.6;
      const z = 6.5 + Math.sin(a * 2.094) * 3.6;
      o.cyl(x, z, 1.2, 2, 2, 0);
    }
    o.cyl(6.5, 6.5, 1.6, 0, 3, C.chrome);
    o.cyl(6.5, 6.5, 0.6, 0, 3, 0);
    o.box(9, 3, 9, 11, 3, 10, C.paper);
    return o;
  },
  x0r8t_paket: () => {
    const o = new IconModel(13, 14, 13);
    o.box(1, 0, 1, 11, 6, 11, C.cardboard);
    o.box(5, 0, 1, 7, 7, 11, C.paper_yellow);
    o.box(1, 7, 5, 11, 7, 7, C.paper_yellow);
    o.box(5, 7, 1, 7, 7, 11, C.paper_yellow);
    o.box(8, 2, 12, 10, 4, 12, C.paper);
    o.set(9, 3, 12, C.book_red);
    for (const [x, y] of [
      [3, 9],
      [4, 10],
      [6, 11],
      [8, 10],
      [9, 12],
      [5, 13],
      [7, 9],
    ] as const)
      o.set(x, y, 6, C.screen_green);
    o.box(2, 3, 12, 4, 3, 12, C.led_green);
    return o;
  },
  slice_0089: () => {
    const o = new IconModel(12, 14, 7);
    o.box(3, 0, 1, 8, 0, 5, C.steel_dark);
    o.box(4, 1, 2, 7, 1, 4, C.chrome);
    for (let y = 2; y <= 13; y++)
      for (let x = 0; x < 12; x++) {
        const u = Math.abs(x - 5.5);
        const v = Math.abs(y - 7.5);
        if (u <= 5.4 && v <= 5.6 && u * 0.5 + v * 0.87 <= 5.5) {
          const edge = u * 0.5 + v * 0.87 > 4.3 || u > 4.6;
          o.set(x, y, 3, edge ? C.safety_blue : C.crystal_cyan);
          o.set(x, y, 2, C.blue_paint);
        }
      }
    for (let x = 3; x <= 8; x++) o.set(x, 7 + ((x * 3) % 3) - 1, 3, C.holo_cyan);
    o.set(6, 8, 3, C.plasma).set(5, 8, 3, C.orange_neon);
    return o;
  },
  sternkarte: () => {
    const o = new IconModel(15, 5, 12);
    o.box(0, 0, 2, 14, 0, 11, C.paint_navy);
    cylX(o, 0, 14, 2, 1.5, 1.7, () => C.paper_blue);
    discYZ(o, 14, 2, 1.5, 0.8, C.book_brown);
    for (let x = 1; x < 14; x++)
      for (let z = 4; z < 11; z++) if (hash3(x, 0, z) < 0.11) o.set(x, 0, z, C.paint_white);
    o.set(10, 1, 7, C.led_pink);
    o.set(9, 0, 7, C.neon_pink).set(11, 0, 7, C.neon_pink);
    o.set(10, 0, 6, C.neon_pink).set(10, 0, 8, C.neon_pink);
    for (let x = 2; x <= 9; x += 2) o.set(x, 0, 5 + Math.floor(x / 3), C.screen_purple);
    return o;
  },
  tonband_frequenz: () => {
    const o = new IconModel(15, 4, 10);
    o.box(0, 0, 0, 14, 2, 9, C.paint_black);
    o.box(1, 3, 1, 13, 3, 6, C.paper_yellow);
    for (let x = 2; x <= 12; x++) if (x % 4 !== 3) o.set(x, 3, 2, C.book_blue);
    for (const x of [4, 10]) {
      o.cyl(x, 4.5, 1.5, 3, 3, C.glass_dark);
      o.set(x, 3, 4, C.paper).set(x, 3, 5, C.paper);
    }
    o.box(4, 3, 4, 10, 3, 4, C.glass_dark);
    o.box(3, 2, 9, 11, 2, 9, C.orange_paint);
    o.set(5, 3, 7, C.book_red).set(7, 3, 7, C.book_red);
    return o;
  },
  notizbuch_blau: () => {
    const o = new IconModel(12, 5, 14);
    o.box(0, 0, 0, 10, 0, 13, C.book_blue);
    o.box(1, 1, 1, 10, 2, 12, C.paper);
    for (let x = 1; x <= 10; x++) o.set(x, 1, 12, x % 2 ? C.paper : C.paint_cream);
    for (let z = 1; z <= 12; z++) o.set(10, 2, z, z % 2 ? C.paper : C.paint_cream);
    o.box(0, 3, 0, 10, 3, 13, C.book_blue);
    o.box(0, 0, 0, 0, 3, 13, C.fabric_blue);
    o.box(3, 4, 3, 7, 4, 5, C.paper_blue);
    o.box(6, 1, 13, 6, 3, 13, C.fabric_red);
    o.box(6, 0, 13, 6, 0, 13, C.fabric_red);
    o.set(11, 1, 5, C.book_red).set(11, 0, 5, C.book_red);
    return o;
  },
  x9_speicherkern: () => {
    const o = new IconModel(11, 15, 11);
    o.cyl(5, 5, 4.5, 0, 1, C.chrome);
    o.cyl(5, 5, 4.5, 13, 14, C.chrome);
    for (const [x, z] of [
      [1, 1],
      [9, 1],
      [1, 9],
      [9, 9],
    ] as const)
      o.box(x, 2, z, x, 12, z, C.steel);
    for (let y = 2; y <= 12; y++)
      for (let z = 1; z <= 9; z++)
        for (let x = 1; x <= 9; x++) {
          const d = Math.hypot(x - 5, z - 5);
          if (d <= 2.8) {
            const n = hash3(x, y * 7, z);
            o.set(x, y, z, n < 0.35 ? C.gamma : n < 0.7 ? C.holo_white : C.lamp_cold);
          }
        }
    for (let y = 3; y <= 11; y += 2) {
      o.set(7, y, 7, C.screen_purple);
      o.set(8, y + 1, 5, C.neon_blue);
    }
    return o;
  },

  // ── Schlacke ──
  schlacke: () => {
    const o = new IconModel(13, 9, 13);
    lump(
      o,
      6,
      2.5,
      6,
      4.8,
      (n, x, y) =>
        n < 0.14 ? C.fire : n < 0.24 ? C.plasma : (x + y) % 3 ? C.iron_rust : C.metal_dark,
      11,
    );
    lump(o, 10, 1, 10, 1.8, (n) => (n < 0.3 ? C.rust : C.metal_dark), 4);
    o.set(5, 8, 6, C.concrete_light).set(6, 8, 5, C.concrete_light);
    return o;
  },

  // ── Biorhythm provisions (lib/world/biorhythm.ts) ──
  naehrriegel: () => {
    // A bar in a torn orange wrapper, oats and nuts showing at the open end.
    const o = new IconModel(14, 5, 8);
    o.box(0, 0, 1, 13, 2, 6, C.safety_orange);
    o.box(0, 3, 2, 13, 3, 5, C.orange_paint);
    for (let x = 1; x <= 12; x += 3) o.box(x, 0, 6, x, 2, 6, C.orange_neon);
    o.box(3, 1, 7, 8, 1, 7, C.paper).set(5, 1, 7, C.green_paint); // label
    o.box(10, 1, 2, 13, 2, 5, C.wood_light); // exposed bar
    o.set(11, 3, 3, C.wood_dark).set(12, 3, 4, C.oak).set(13, 2, 3, C.wood_dark);
    o.box(0, 0, 0, 0, 2, 7, C.orange_paint); // crimped end
    return o;
  },
  wasserflasche: () => {
    // Clear bottle with water, blue cap and a label ring.
    const o = new IconModel(9, 15, 9);
    o.cyl(4, 4, 3.4, 0, 9, C.glass);
    for (let y = 0; y <= 7; y++) layer(o, 4, 4, 3.4, y, C.water, C.liquid_blue);
    o.ring(4, 4, 3.4, 4, C.paper).ring(4, 4, 3.4, 5, C.safety_blue);
    o.cyl(4, 4, 2.4, 10, 11, C.glass);
    o.cyl(4, 4, 1.6, 12, 12, C.glass);
    o.cyl(4, 4, 1.6, 13, 14, C.safety_blue);
    return o;
  },
  protein_shake: () => {
    // Shaker cup: yellow body, measuring marks, black lid with a spout.
    const o = new IconModel(10, 15, 10);
    o.cyl(4.5, 4.5, 3.8, 0, 9, C.paper_yellow);
    for (let y = 0; y <= 6; y++) layer(o, 4.5, 4.5, 3.8, y, C.tile_cream, C.paper);
    for (let y = 2; y <= 8; y += 2) o.set(8, y, 4, C.black).set(8, y, 5, C.black);
    o.ring(4.5, 4.5, 3.8, 9, C.yellow_paint);
    o.cyl(4.5, 4.5, 3.8, 10, 11, C.paint_black);
    o.cyl(4.5, 4.5, 1.4, 12, 13, C.paint_black);
    o.set(4, 14, 4, C.safety_yellow);
    return o;
  },
};

/** Ids that have a hand-built icon (everything else is procedural). */
export const AUTHORED_ICON_IDS: ReadonlySet<string> = new Set(Object.keys(AUTHORED));

// ── Procedural prototype icons ───────────────────────────────────

const PN = 14;
const CX = 6.5;

/** Main body per dominant axis; draws into x/z 3..10. */
const BODY: Record<TraitAxis, (o: Model, t: IconTone, h: number) => void> = {
  energie: (o, t) => {
    o.cyl(CX, CX, 3.4, 1, 1, C.steel);
    for (let y = 2; y <= 8; y++)
      layer(o, CX, CX, 3.2, y, t.body, y >= 4 && y <= 6 ? t.glow : t.light);
    o.cyl(CX, CX, 3.4, 9, 9, C.steel);
    o.cyl(CX, CX, 1.2, 10, 10, C.chrome);
  },
  optik: (o, t, h) => {
    o.box(3, 1, 3, 10, 2, 10, C.steel_dark);
    for (let i = 0; i < 3; i++) {
      const y = 3 + i * 2;
      o.cyl(CX, CX, 3.4 - i * 0.5, y, y, i % 2 ? t.light : C.glass);
      o.ring(CX, CX, 3.6 - i * 0.5, y + 1, h & 1 ? C.chrome : C.steel, 1);
    }
    o.set(7, 9, 7, C.led_white);
  },
  quantum: (o, t) => {
    o.cyl(CX, CX, 2.2, 1, 2, C.steel_dark);
    o.cyl(CX, CX, 1, 3, 3, t.glow);
    o.sphere(CX, 7.5, CX, 3, t.body);
    for (let y = 5; y <= 10; y++) paintIf(o, 9, y, 8, t.glow);
    torusFlat(o, CX, CX, 7, 7, 4.2, 0.4, () => t.light);
  },
  mechanik: (o, t, h) => {
    o.box(3, 1, 3, 10, 7, 10, C.steel_dark);
    o.box(4, 7, 4, 9, 7, 9, t.dark);
    for (const [x, z] of [
      [3, 10],
      [10, 10],
      [10, 3],
    ] as const)
      o.box(x, 1, z, x, 7, z, t.body);
    gearUpright(o, CX, 4.5, 11, 11, 2.4, 8, h & 2 ? C.brass : C.chrome, C.metal_dark);
  },
  signal: (o, t) => {
    o.box(3, 1, 3, 10, 5, 10, t.dark);
    o.box(3, 5, 3, 10, 5, 10, t.body);
    for (let y = 2; y <= 4; y++)
      for (let x = 4; x <= 7; x++) o.set(x, y, 11, (x + y) % 2 ? C.metal_dark : C.black);
    o.box(4, 6, 4, 4, 12, 4, C.chrome).set(4, 13, 4, t.glow);
    discXY(o, 8, 9, 6, 2.3, C.paint_white);
    o.box(8, 6, 6, 8, 8, 6, C.steel);
    o.set(8, 9, 7, t.glow);
  },
  thermik: (o, t) => {
    o.box(3, 1, 3, 10, 1, 10, C.steel_dark);
    for (let x = 3; x <= 10; x += 2) {
      o.box(x, 2, 3, x, 8, 10, C.aluminium);
      o.box(x, 9, 3, x, 9, 10, t.body);
    }
    o.box(3, 3, 4, 10, 3, 4, C.copper).box(3, 6, 9, 10, 6, 9, C.copper);
  },
  resonanz: (o, t) => {
    o.box(3, 1, 4, 10, 2, 9, C.steel_dark);
    o.box(6, 3, 6, 7, 4, 7, C.chrome);
    o.box(4, 5, 6, 9, 5, 7, C.chrome);
    o.box(4, 6, 6, 5, 12, 7, t.body).box(8, 6, 6, 9, 12, 7, t.body);
    o.box(4, 12, 6, 5, 12, 7, t.glow).box(8, 12, 6, 9, 12, 7, t.glow);
    for (let y = 7; y <= 11; y += 2) o.set(CX, y, 7, t.light).set(7, y + 1, 7, t.light);
  },
  daten: (o, t) => {
    o.box(3, 1, 3, 10, 3, 10, C.paint_black);
    for (let i = 3; i <= 10; i += 2) {
      o.set(i, 1, 11, C.gold).set(11, 1, i, C.gold).set(i, 1, 2, C.gold).set(2, 1, i, C.gold);
    }
    o.box(5, 4, 5, 8, 4, 8, t.body);
    o.box(6, 4, 6, 7, 4, 7, t.glow);
    o.set(4, 4, 4, C.gold).set(9, 4, 9, C.gold);
  },
};

/** Secondary module mounted on the right (+x) side, x 11..13. */
const SIDE: Record<TraitAxis, (o: Model, t: IconTone) => void> = {
  energie: (o) => {
    o.cyl(12, 6.5, 1.2, 1, 4, C.yellow_paint);
    o.set(12, 5, 6, C.led_amber).set(12, 5, 7, C.led_amber);
  },
  optik: (o, t) => {
    o.box(11, 4, 6, 12, 4, 7, C.steel);
    discYZ(o, 13, 5, 6.5, 1.8, C.steel);
    discYZ(o, 13, 5, 6.5, 1, t.light);
  },
  quantum: (o, t) => {
    o.sphere(12, 6, 6.5, 1.3, t.glow);
    o.set(12, 3, 6, C.steel_dark).set(12, 3, 7, C.steel_dark);
  },
  mechanik: (o) => {
    for (let z = 4; z <= 9; z++)
      for (let y = 1; y <= 6; y++) {
        const d = Math.hypot(y - 3.5, z - 6.5);
        const a = Math.atan2(y - 3.5, z - 6.5);
        if (d <= 1.8 || (Math.cos(a * 6) > 0.3 && d <= 2.8)) o.set(11, y, z, C.brass);
      }
    o.set(12, 3, 6, C.chrome);
  },
  signal: (o, t) => {
    o.box(12, 1, 6, 12, 11, 6, C.chrome);
    o.set(12, 12, 6, t.glow);
    o.box(11, 1, 5, 13, 2, 7, C.metal_dark);
  },
  thermik: (o) => {
    for (let y = 1; y <= 6; y += 2) o.box(11, y, 5, 13, y, 8, C.aluminium);
    o.box(11, 1, 6, 11, 6, 7, C.copper);
  },
  resonanz: (o, t) => {
    o.box(11, 1, 5, 12, 1, 8, C.steel_dark);
    o.box(12, 2, 5, 12, 7, 5, C.chrome).box(12, 2, 8, 12, 7, 8, C.chrome);
    o.set(12, 7, 5, t.glow).set(12, 7, 8, t.glow);
  },
  daten: (o, t) => {
    o.box(11, 2, 5, 12, 5, 8, C.paint_black);
    for (let y = 2; y <= 5; y++) o.set(13, y, y % 2 ? 6 : 7, C.gold);
    o.set(12, 4, 6, t.glow);
  },
};

/**
 * Procedural icon for generated prototypes. Deterministic: the same item
 * always yields the same voxels; different dominant axes give different
 * silhouettes.
 */
export function prototypeIconModel(def: ItemDef): Model {
  const t = SPECTRUM_TONE[def.color];
  const h = fnv1a(`icon:${def.id}`);
  const [a1, a2, a3] = dominantAxes(def.traits) as [TraitAxis, TraitAxis, TraitAxis];
  // Generation depth stacks the plinth (1–3 steps) and lifts the body.
  const steps = Math.max(1, Math.min(3, def.depth));
  const lift = steps - 1;
  const o = new IconModel(PN, PN + 2, PN);

  for (let k = 0; k < steps; k++) {
    const grow = steps - 1 - k;
    o.box(
      2 - grow,
      k,
      2 - grow,
      11 + grow,
      k,
      11 + grow,
      k === steps - 1 ? C.metal_dark : C.steel_dark,
    );
    if (k < steps - 1)
      for (let x = 3 - grow; x <= 10 + grow; x += 3)
        o.set(x, k, 11 + grow, C.gold).set(11 + grow, k, x, C.gold);
  }
  // Trait LEDs on the top step's front edge; generation notches on its right edge.
  const leds: TraitAxis[] = [a1, a2, a3];
  leds.forEach((a, i) => {
    if (def.traits[a] > 0) o.set(4 + i * 2, lift, 11, AXIS_TONE[a]);
  });
  for (let i = 0; i < Math.min(def.depth, 4); i++) o.set(11, lift, 9 - i * 2, C.gold);

  // Body and side module are built at ground level, then lifted onto the plinth.
  const b = new IconModel(PN, PN + 2, PN);
  BODY[a1](b, t, h);
  if (def.traits[a2] > 0 && a2 !== a1) SIDE[a2](b, t);
  if (def.volatility >= 3)
    b.grid.forEach((x, y, z, v) => {
      if (v !== t.glow && hash3(x + (h % 97), y, z) < 0.035 * (def.volatility - 2))
        b.set(x, y, z, t.glow);
    });
  b.grid.forEach((x, y, z, v) => {
    if (y > 0) o.set(x, y + lift, z, v);
  });

  // Deep prototypes (Gen. 3+) get an orbit arc in their spectrum glow.
  if (def.depth >= 3) {
    const y = 6 + lift;
    torusFlat(o, CX, CX, y, y, 5.8, 0.45, (a, x, yy, z) =>
      o.grid.get(x, yy, z) ? o.grid.get(x, yy, z) : Math.cos(a - (h % 6)) > -0.2 ? t.glow : 0,
    );
  }

  // Volatility: sparks in the air around the body.
  if (def.volatility >= 3) {
    const sparks = (def.volatility - 2) * 2 + 1;
    for (let i = 0; i < sparks; i++) {
      const k = fnv1a(`spark:${def.id}:${i}`);
      const x = k % PN;
      const y = 3 + lift + ((k >>> 5) % (PN - 3 - lift));
      const z = (k >>> 11) % PN;
      if (!o.grid.get(x, y, z)) o.set(x, y, z, i % 2 ? t.glow : C.led_white);
    }
  }
  return o;
}

/** Metal → its highlight, for the viewer-facing top rims (see `finishIcon`). */
const RIM_LIGHT: Record<number, number> = {
  [C.steel_dark]: C.steel,
  [C.steel]: C.chrome,
  [C.metal_dark]: C.steel_dark,
  [C.metal]: C.metal_light,
  [C.aluminium]: C.chrome,
  [C.bronze]: C.copper,
  [C.brass]: C.gold,
  [C.iron_rust]: C.rust,
};

/**
 * Finishing pass (recolour only): metal voxels on the rims the iso camera
 * sees (open top plus open +x or +z face) catch a highlight, so bevels and
 * silhouettes read crisply at 32 px. Deterministic; never adds voxels.
 */
export function finishIcon(o: Model): Model {
  const g = o.grid;
  const open = (x: number, y: number, z: number) => !g.inBounds(x, y, z) || !g.get(x, y, z);
  const lit: [number, number, number, number][] = [];
  g.forEach((x, y, z, v) => {
    const hi = RIM_LIGHT[v];
    if (hi === undefined || !open(x, y + 1, z)) return;
    if (open(x + 1, y, z) || open(x, y, z + 1)) lit.push([x, y, z, hi]);
  });
  for (const [x, y, z, c] of lit) g.set(x, y, z, c);
  return o;
}

const modelCache = new Map<string, Model>();

/** Voxel icon for any item: hand-built for authored ids, procedural otherwise. */
export function itemIconModel(def: ItemDef): Model {
  const key = `${def.id}|${def.color}|${def.volatility}|${def.depth}`;
  const hit = modelCache.get(key);
  if (hit) return hit;
  const build = def.kind !== "prototyp" ? AUTHORED[def.id] : undefined;
  const model = finishIcon(build ? build() : prototypeIconModel(def));
  if (modelCache.size > 512) modelCache.clear();
  modelCache.set(key, model);
  return model;
}

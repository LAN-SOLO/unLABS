/**
 * Procedural voxel models (pure — no three).
 * ==========================================
 *
 * Devices, props, pickups and characters are built from box / cylinder /
 * sphere primitives at MODEL_SCALE (half a world voxel), front = +z.
 * Designs follow the device docs' visual hints (CDC = tall silver rack
 * with glowing screens, ECR = golden antenna with spheres, UEC = chaotic
 * purple sphere, TLP = circular platform with rings, …).
 */
import { C } from "@/lib/world/content/palette";
import { fnv1a } from "@/lib/world/traits";
import { VoxelGrid } from "@/lib/voxel/grid";

export const MODEL_SCALE = 0.5;

export class Model {
  readonly grid: VoxelGrid;
  constructor(
    readonly w: number,
    readonly h: number,
    readonly d: number,
  ) {
    this.grid = new VoxelGrid(w, h, d);
  }

  set(x: number, y: number, z: number, c: number): this {
    if (this.grid.inBounds(x, y, z)) this.grid.set(x, y, z, c);
    return this;
  }

  /** Inclusive box. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number): this {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, c);
    return this;
  }

  /** Vertical cylinder centred at (cx, cz), radius r, rows y0..y1. */
  cyl(cx: number, cz: number, r: number, y0: number, y1: number, c: number, hollow = false): this {
    for (let y = y0; y <= y1; y++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dd = (x - cx) ** 2 + (z - cz) ** 2;
          if (dd <= r * r + 0.3 && (!hollow || dd >= (r - 1.2) ** 2)) this.set(x, y, z, c);
        }
    return this;
  }

  sphere(cx: number, cy: number, cz: number, r: number, c: number): this {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r + 0.3) this.set(x, y, z, c);
    return this;
  }

  /** Horizontal ring (torus slice) at height y. */
  ring(cx: number, cz: number, r: number, y: number, c: number, thick = 1): this {
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
        if (Math.abs(dist - r) <= thick * 0.6)
          for (let t = 0; t < thick; t++) this.set(x, y + t, z, c);
      }
    return this;
  }

  /** Row of LEDs along x at (y, z). */
  leds(x0: number, x1: number, y: number, z: number, colors: number[]): this {
    for (let x = x0, i = 0; x <= x1; x += 2, i++) this.set(x, y, z, colors[i % colors.length]!);
    return this;
  }

  /** Screen with a scanline texture. */
  screen(x0: number, y0: number, x1: number, y1: number, z: number, c: number): this {
    this.box(x0 - 1, y0 - 1, z, x1 + 1, y1 + 1, z, C.black);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) this.set(x, y, z, (y - y0) % 2 === 0 ? c : C.crt_bg);
    return this;
  }
}

// ── Shared archetypes ────────────────────────────────────────────

export function rack(
  w: number,
  h: number,
  d: number,
  body: number,
  screen: number,
  led: number[],
): Model {
  const m = new Model(w, h, d);
  m.box(0, 0, 0, w - 1, h - 1, d - 1, body);
  m.box(1, 1, d - 1, w - 2, h - 2, d - 1, C.metal_dark);
  for (let y = 2; y < h - 3; y += 3) m.leds(2, w - 3, y, d - 1, led);
  m.screen(2, h - 3, w - 3, h - 2, d - 1, screen);
  m.box(0, h - 1, 0, w - 1, h - 1, d - 1, C.metal_light);
  return m;
}

export function consoleDesk(
  w: number,
  d: number,
  body: number,
  screen: number,
  screens = 1,
): Model {
  const m = new Model(w, 12, d);
  m.box(0, 0, 2, w - 1, 5, d - 1, body);
  m.box(0, 6, 3, w - 1, 6, d - 1, C.metal_light);
  for (let x = 1; x < w - 1; x += 2) m.set(x, 6, d - 2, x % 4 === 1 ? C.led_amber : C.black);
  const sw = Math.floor((w - 2) / screens);
  for (let i = 0; i < screens; i++) {
    const x0 = 1 + i * sw;
    m.box(x0, 7, 1, x0 + sw - 2, 11, 2, C.metal);
    m.screen(x0 + 1, 8, x0 + sw - 3, 10, 3, screen);
  }
  return m;
}

export function wallPanel(w: number, h: number, body: number, screen: number): Model {
  const m = new Model(w, h + 4, 3);
  m.box(0, 4, 0, w - 1, h + 3, 1, body);
  m.screen(2, 6, w - 3, h + 1, 2, screen);
  m.box(w / 2 - 1, 0, 0, w / 2, 3, 0, C.cable_black);
  return m;
}

export function fanBox(w: number, h: number, body: number, fans: number): Model {
  const m = new Model(w, h, w);
  m.box(0, 0, 0, w - 1, h - 1, w - 1, body);
  const step = Math.floor(w / fans);
  for (let i = 0; i < fans; i++) {
    const cx = step * i + step / 2 - 0.5;
    m.cyl(cx, w, step / 2 - 1, 0, 0, C.metal_dark);
    for (let y = 2; y < h - 2; y++)
      for (let x = Math.floor(cx - 2); x <= cx + 2; x++)
        m.set(x, y, w - 1, (x + y) % 3 === 0 ? C.metal_light : C.metal_dark);
  }
  m.box(0, h - 1, 0, w - 1, h - 1, w - 1, C.metal_light);
  return m;
}

// ── Staging & power ──────────────────────────────────────────────

const EMISSIVE_OFF: Record<number, number> = {
  [C.screen_green]: C.crt_bg,
  [C.screen_amber]: C.crt_bg,
  [C.screen_cyan]: C.crt_bg,
  [C.led_red]: C.black,
  [C.led_green]: C.black,
  [C.led_amber]: C.black,
  [C.neon_pink]: C.purple_paint,
  [C.neon_magenta]: C.purple_paint,
  [C.neon_purple]: C.purple_paint,
  [C.neon_blue]: C.blue_paint,
  [C.plasma]: C.rust,
  [C.plasma_blue]: C.blue_paint,
  [C.abstractum]: C.purple_paint,
  [C.exotic]: C.purple_paint,
  [C.gamma]: C.white,
  [C.white_gold]: C.beige,
  [C.cerulean]: C.blue_paint,
  [C.orange_neon]: C.orange_paint,
  [C.lime]: C.green_paint,
  [C.mcp_red]: C.red_paint,
  // Emissive-class darks (LED bezels, dim scanlines of fine bots): plain solids when off,
  // so an unpowered lamp part stays a single material.
  [C.led_bezel]: C.black,
  [C.scan_dim]: C.crt_bg,
};

/**
 * Copy of `src` showing build progress: the lowest `fraction` of voxels
 * (by height, with a deterministic shuffle within a layer) are solid, the
 * rest are a cyan blueprint ghost. Unpowered models get dark screens.
 */
export function stagedGrid(src: VoxelGrid, fraction: number, powered: boolean): VoxelGrid {
  const out = new VoxelGrid(src.sx, src.sy, src.sz);
  const cells: { x: number; y: number; z: number; v: number; k: number }[] = [];
  src.forEach((x, y, z, v) => cells.push({ x, y, z, v, k: y * 1e6 + (fnv1a(`${x},${z}`) % 1e6) }));
  cells.sort((a, b) => a.k - b.k);
  const solid = Math.round(cells.length * Math.max(0, Math.min(1, fraction)));
  cells.forEach((c, i) => {
    let v = c.v;
    if (i >= solid) v = C.ghost;
    else if (!powered) v = EMISSIVE_OFF[v] ?? v;
    out.set(c.x, c.y, c.z, v);
  });
  return out;
}

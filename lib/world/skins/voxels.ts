/**
 * Skin voxels — a room concept (rooms.ts) on the fine lattice.
 *
 * Every source voxel of a wall or floor becomes 4 × 4 × 4 fine voxels
 * (SKIN_FINE, the device-detail scale). Rules (docs/SKINS.md § Geometry):
 *
 * - **Silhouette:** walls stay in their wall line, floors in y = 0. Relief
 *   is carved *into* the surface (one fine voxel deep), never added onto it.
 *   The only voxels in the room are the cornice at y 7–8 beside the wall —
 *   above the walker's head, where lamps and corbels live today.
 * - **Wall face coordinates:** `u` runs along the wall (fine, from the
 *   wall's own position `p`), `v` up from y = 1 (0 … 31): v 0–3 base,
 *   4–27 panel zone, 28–31 cap. The cap covers the whole wall thickness,
 *   so the top view shows it.
 * - **Channels:** `line`, `node`, `field` become the palette indices
 *   `skin_line`, `skin_node`, `skin_field`; the renderer tints them per room.
 *
 * Pure (no three). The game can mesh these grids like device detail; the
 * export script (scripts/skins/export.ts) writes them as uvox for Blender.
 */
import { C } from "@/lib/world/content/palette";
import { DOORS, floorGeomOf, WALL_HEIGHT } from "@/lib/world/content/map";
import { doorCells } from "@/lib/world/layout";
import type { FloorGeom, RoomGeom } from "@/lib/world/floor-geom";
import type { Band, FloorSpec, GlyphSet, Paint, RoomSkin, WallSpec } from "@/lib/world/skins/types";
import type { FloorId } from "@/lib/world/types";

export const SKIN_FINE = 4;
/** Fine rows of a wall face (y 1 … 8). */
export const FACE_H = WALL_HEIGHT * SKIN_FINE;
export const PANEL_V0 = 4;
export const CAP_V0 = FACE_H - 4;
const ZONE_H = CAP_V0 - PANEL_V0;

export interface Cell {
  c: Paint;
  /** Recessed: the surface voxel is empty, the one behind it carries `c`. */
  r: boolean;
}

const cell = (c: Paint, r = false): Cell => ({ c, r });

export function paintIndex(p: Paint): number {
  if (p === "line") return C.skin_line;
  if (p === "node") return C.skin_node;
  if (p === "field") return C.skin_field;
  return C[p];
}

export const SKIN_CHANNELS: ReadonlySet<number> = new Set([C.skin_line, C.skin_node, C.skin_field]);

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Integer hash → 0 … 1 (deterministic, platform independent). */
export function ihash(a: number, b: number, c = 0): number {
  let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Smooth value noise 0 … 1 (bilinear over the integer hash). */
function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = ihash(xi, yi, seed);
  const b = ihash(xi + 1, yi, seed);
  const c = ihash(xi, yi + 1, seed);
  const d = ihash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// ── Glyphs (inlays) ──────────────────────────────────────────────

const G = (rows: string[]): boolean[][] => rows.map((r) => [...r].map((ch) => ch === "#"));

const TETRO = [
  G(["##..", "#...", "#...", "...."]),
  G(["....", ".#..", ".#..", ".##."]),
  G(["....", "###.", ".#..", "...."]),
  G(["..#.", "..#.", "..#.", "..#."]),
  G(["....", "##..", ".##.", "...."]),
  G(["....", ".##.", ".##.", "...."]),
  G(["###.", "..#.", "....", "...."]),
  G(["#...", "##..", "#...", "...."]),
];

const TOOLS = [
  // wrench
  G([
    ".##.....",
    "#..#....",
    ".##.#...",
    "....#...",
    ".....#..",
    "......#.",
    ".......#",
    "........",
  ]),
  // hammer
  G([
    "######..",
    "######..",
    "..##....",
    "..##....",
    "..##....",
    "..##....",
    "..##....",
    "..##....",
  ]),
  // screwdriver
  G([
    "...##...",
    "...##...",
    "...##...",
    "...##...",
    "....#...",
    "....#...",
    "....#...",
    "....#...",
  ]),
  // saw
  G([
    "########",
    "########",
    "#.#.#.#.",
    "........",
    "##......",
    "##......",
    "........",
    "........",
  ]),
  // pliers
  G([
    "..#..#..",
    "..#..#..",
    "...##...",
    "...##...",
    "..#..#..",
    ".#....#.",
    "#......#",
    "........",
  ]),
];

const DIGITS = [
  G(["###", "#.#", "#.#", "#.#", "###"]),
  G([".#.", "##.", ".#.", ".#.", "###"]),
  G(["###", "..#", "###", "#..", "###"]),
  G(["###", "..#", "###", "..#", "###"]),
  G(["#.#", "#.#", "###", "..#", "..#"]),
  G(["###", "#..", "###", "..#", "###"]),
  G(["###", "#..", "###", "#.#", "###"]),
  G(["###", "..#", ".#.", ".#.", ".#."]),
  G(["###", "#.#", "###", "#.#", "###"]),
  G(["###", "#.#", "###", "..#", "###"]),
];

const TREFOIL = G([".##.##.", "###.###", "###.###", "...#...", "..###..", ".#####.", "......."]);

/** Keyhole: ring head over a short slot, 3 wide so the door keeps a margin. */
const KEYHOLE = G(["###", "#.#", "###", ".#.", ".#."]);

/** Glyph pixel at panel-interior position (iu, iv of iw × ih), or false. */
function glyphAt(
  set: GlyphSet,
  pick: number,
  iu: number,
  iv: number,
  iw: number,
  ih: number,
): boolean {
  if (iw <= 0 || ih <= 0) return false;
  if (set === "chevrons") return mod(iu + iv, 6) < 3;
  if (set === "keyholes" || set === "digits") {
    // Fixed size, centred (digits: the panel's number).
    const g = set === "keyholes" ? KEYHOLE : DIGITS[Math.floor(pick * 10) % 10]!;
    const gh = g.length;
    const gw = g[0]!.length;
    const ou = Math.floor((iw - gw) / 2);
    const ov = Math.floor((ih - gh) / 2);
    const x = iu - ou;
    const y = ih - 1 - iv - ov; // glyph rows run top-down
    return x >= 0 && y >= 0 && x < gw && y < gh && g[y]![x]!;
  }
  const list = set === "tools" ? TOOLS : set === "trefoil" ? [TREFOIL] : TETRO;
  const g = list[Math.floor(pick * list.length) % list.length]!;
  const gw = g[0]!.length;
  const gh = g.length;
  const x = Math.floor((iu * gw) / iw);
  const y = gh - 1 - Math.floor((iv * gh) / ih);
  return g[y]?.[x] ?? false;
}

// ── Bands ────────────────────────────────────────────────────────

const RAINBOW: Paint[] = [
  "red_paint",
  "orange_paint",
  "yellow_paint",
  "green_paint",
  "blue_paint",
  "purple_paint",
  "paint_pink",
];
const BOOKS: Paint[] = ["book_red", "book_green", "book_blue", "book_brown", "leather", "paper"];
const CABLES: Paint[] = ["cable_black", "cable_red", "cable_yellow", "cable_black", "steel_dark"];
/** ". _ . . _ _ _ . . . _ . _ _" — the chalk line in the radio room. */
const MORSE = ". _ . . _ _ _ . . . _ . _ _";
const MORSE_BITS: boolean[] = (() => {
  const out: boolean[] = [];
  for (const ch of MORSE.split(" ")) {
    const n = ch === "." ? 2 : 6;
    for (let i = 0; i < n; i++) out.push(true);
    out.push(false, false);
  }
  out.push(false, false, false, false, false, false);
  return out;
})();

/** Thread-map pins (kartenraum): one per 10 fine along the wall. */
function pinV(k: number, band: Band, seed: number): number {
  return band.v0 + 2 + Math.floor(ihash(k, 7, seed) * Math.max(1, band.v1 - band.v0 - 3));
}

function bandCell(band: Band, u: number, v: number, seed: number): Cell | null {
  const lv = v - band.v0;
  const h = band.v1 - band.v0 + 1;
  switch (band.kind) {
    case "light":
      return cell("line");
    case "hazard":
      return cell(mod(u + v, 8) < 4 ? "safety_yellow" : "hazard_black");
    case "frost":
      return ihash(u, v, seed + 3) < 0.35 + (lv / h) * 0.4 ? cell("coat_white") : null;
    case "books":
    case "notebooks": {
      if (lv === 0) return cell("walnut");
      const w = band.kind === "books" ? 2 : 1;
      const id = Math.floor(u / w);
      const top = band.v1 - Math.floor(ihash(id, 1, seed) * (band.kind === "books" ? 3 : 2));
      if (v > top) return cell("black");
      if (band.kind === "notebooks") {
        const c = RAINBOW[Math.floor((mod(u, 56) / 56) * RAINBOW.length)]!;
        return cell(id % 3 === 0 ? "paint_black" : c);
      }
      if (ihash(id, 2, seed) < 0.06) return cell("black", true);
      return cell(BOOKS[Math.floor(ihash(id, 3, seed) * BOOKS.length)]!);
    }
    case "pads": {
      const lu = mod(u, 8);
      if (lu >= 6) return null;
      if (lv === h - 1) return cell(lu === 2 || lu === 3 ? "node" : "red_paint");
      return cell(lv % 2 === 0 ? "paper_blue" : "paper_yellow");
    }
    case "cables": {
      if (mod(u, 8) === 0) return cell("steel");
      const id = Math.floor(lv / 2);
      if (id % 3 === 1 && lv % 2 === 0) return cell("line");
      return cell(CABLES[id % CABLES.length]!);
    }
    case "pipes": {
      const pipe = band.paint ?? (seed % 2 === 0 ? "copper" : "aluminium");
      if (mod(u, 48) === 20) return cell("safety_red");
      if (mod(u, 12) === 0) return cell("metal_dark");
      return cell(lv === 0 || lv === h - 1 ? "metal_dark" : pipe);
    }
    case "busbar": {
      const k = mod(lv, 5);
      if (k >= 3) return cell("metal_dark", true);
      if (mod(u, 8) === 0) return cell("steel");
      return cell(k === 1 ? "line" : (band.paint ?? "copper"));
    }
    case "coils": {
      if (mod(u, 16) === 0) return cell("metal_dark");
      if (lv === Math.floor(h / 2)) return cell("line");
      return cell(lv % 2 === 0 ? "copper" : "bronze");
    }
    case "ruler": {
      const fromTop = band.v1 - v;
      const len = mod(u, 16) === 0 ? h : mod(u, 4) === 0 ? Math.ceil(h / 2) : 1;
      if (mod(u, 16) === 0 && fromTop === 0) return cell("node");
      return cell(fromTop < len ? "black" : "paint_white");
    }
    case "morse":
      return cell(lv === 1 && MORSE_BITS[mod(u, MORSE_BITS.length)] ? "node" : "paint_black");
    case "plants": {
      if (lv === 0) return cell("wood_dark");
      const n = vnoise(u / 3, v / 3, seed + 11);
      if (n > 0.55 - (lv / h) * 0.25)
        return cell(ihash(u, v, seed) < 0.5 ? "leaf_dark" : "leaf_light");
      if (mod(u + v, 6) === 0 || mod(u - v, 6) === 0) return cell("wood");
      return null;
    }
    case "threads": {
      const k = Math.floor(u / 10);
      for (const [a, b] of [
        [k, k + 1],
        [k - 1, k + 1],
      ] as const) {
        if (a !== k && ihash(a, 9, seed) < 0.6) continue;
        const ua = a * 10 + 5;
        const ub = b * 10 + 5;
        if (u < ua || u > ub) continue;
        const va = pinV(a, band, seed);
        const vb = pinV(b, band, seed);
        const vl = va + ((vb - va) * (u - ua)) / (ub - ua);
        if (Math.abs(v - vl) < 0.6) return cell("line");
      }
      const pk = Math.round((u - 5) / 10);
      if (Math.abs(u - (pk * 10 + 5)) < 1 && Math.abs(v - pinV(pk, band, seed)) < 1)
        return cell("red_paint");
      const nk = Math.floor(u / 14);
      if (ihash(nk, 4, seed) < 0.5 && mod(u, 14) < 6 && lv >= 1 && lv <= 5)
        return cell(ihash(nk, 5, seed) < 0.5 ? "paper_yellow" : "paper_pink");
      return cell("cardboard");
    }
    case "duct": {
      const lu = mod(u, 8);
      if (lu === 0 || lv === 0 || lv === h - 1) return cell("metal_dark");
      if (lu === 6 && lv === 1) return cell("node");
      return cell(lv % 2 === 0 ? "crt_bg" : "scan_dim");
    }
  }
}

// ── Walls ────────────────────────────────────────────────────────

/** The face of a wall at (u, v) — see the module comment for the coordinates. */
export function wallFace(w: WallSpec, u: number, v: number, seed: number): Cell {
  const p = w.paint;
  // Base and cap.
  if (v < PANEL_V0) {
    if (w.base === "hazard") return cell(mod(u + v, 8) < 4 ? "safety_yellow" : "hazard_black");
    if (w.base === "glow") return cell(v === PANEL_V0 - 1 ? "line" : p.base);
    if (w.base === "wood") return cell("walnut");
    return cell(v === PANEL_V0 - 1 ? "metal_dark_lt" : p.base);
  }
  if (v >= CAP_V0) return cell(p.cap);
  // Pillars / ribs.
  if (w.pillar > 0) {
    const pu = mod(u, w.pillar * SKIN_FINE);
    if (pu < SKIN_FINE) {
      if (w.family === "rock") return cell(pu === 0 || pu === 3 ? "wood_dark" : "wood");
      return cell(pu === 0 || pu === 3 ? p.accent : p.seam);
    }
  }
  // Glowing cracks (carved line channel), sparse warped-noise ridges.
  if (w.cracks) {
    const n = vnoise((u + 6 * vnoise(u / 7, v / 7, seed + 31)) / 14, v / 10, seed + 30);
    if (Math.abs(n - 0.5) < 0.018) return cell(w.crackGlow, true);
  }
  // Bands.
  for (const b of w.bands)
    if (v >= b.v0 && v <= b.v1) {
      const c = bandCell(b, u, v, seed);
      if (c) return c;
    }
  return familyCell(w, u, v, seed);
}

function familyCell(w: WallSpec, u: number, v: number, seed: number): Cell {
  const p = w.paint;
  const P = Math.max(2, w.panel);
  const s = w.seam;
  const z = v - PANEL_V0; // 0 … 23
  switch (w.family) {
    case "rock": {
      const n = vnoise(u / 5, v / 4, seed);
      const vein = Math.abs(vnoise(u / 11, v / 9, seed + 5) - 0.5);
      if (vein < 0.025) return cell("node", true);
      if (n < 0.32) return cell(p.seam, true);
      if (ihash(u, v, seed) < 0.03) return cell("concrete_light");
      return cell(n > 0.7 ? "rock_dark" : p.panel);
    }
    case "facet": {
      const cw = P;
      const ch = Math.round(P * 1.5);
      const cu = Math.floor(u / cw);
      const cv = Math.floor(z / ch);
      let d1 = 1e9;
      let d2 = 1e9;
      let best = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const gx = cu + i;
          const gy = cv + j;
          const px = (gx + 0.15 + 0.7 * ihash(gx, gy, seed)) * cw;
          const py = (gy + 0.15 + 0.7 * ihash(gx, gy, seed + 1)) * ch;
          // Stretch vertically: shards read tall, like crystal.
          const d = Math.hypot(u - px, (z - py) * 0.6);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = ihash(gx, gy, seed + 2);
          } else if (d < d2) d2 = d;
        }
      if (d2 - d1 < 1.1) return cell(p.seam);
      if (best < 0.22) return cell(p.accent);
      if (best < 0.55) return cell(p.panel);
      return cell(p.dark, true);
    }
    case "acoustic": {
      const lu = mod(u, P);
      if (lu === 0) return cell(p.seam, true);
      if (z < 1 || z > ZONE_H - 2) return cell(p.accent);
      const k = Math.floor(lu / 2);
      const bv = Math.floor(z / 2);
      const depth = (k * k + bv * bv * 3) % 7;
      return cell(depth % 2 === 0 ? p.panel : p.accent, depth >= 4);
    }
    case "rack": {
      const lu = mod(u, P);
      const bay = Math.floor(u / P);
      if (lu === 0) return cell(p.seam, true);
      if (lu === 1 || lu === P - 1) return cell(w.bezel ? p.accent : "metal_dark");
      if (z >= ZONE_H - 3) return cell(z === ZONE_H - 2 && lu === 3 ? p.accent : "steel_dark");
      // Status LEDs; with a node accent a full LED column per bay (charge / load bars).
      if (p.accent === "node" && (lu === P - 3 || lu === P - 4) && z % 3 === 1) return cell("node");
      if (lu === P - 3 && z % 3 === 1 && ihash(bay, z, seed) < 0.6) return cell("node");
      if (z % 2 === 0 && lu >= 3 && lu <= P - 4) return cell("black", true);
      return cell(p.panel);
    }
    case "rib": {
      const rowH = Math.floor(ZONE_H / w.rows);
      const lv = mod(z, rowH);
      const row = Math.floor(z / rowH);
      if (lv < s) return cell(p.seam, true);
      if (row === Math.floor(w.rows / 2) && lv === Math.floor(rowH / 2)) return cell(p.accent);
      return cell(p.panel);
    }
    case "wainscot": {
      // Dado (oak panels with stiles) up to z 8, chair rail z 8–9, upper wall, picture rail.
      if (z < 8) return dadoCell(w, u, z, seed);
      if (z < 10) return cell(z === 8 ? "walnut" : "oak");
      if (z === ZONE_H - 2) return cell("walnut");
      if (z === ZONE_H - 1) return cell(p.seam);
      if (mod(u, 6) === 3 && mod(z, 6) === 3) return cell("wall_beige_dk");
      return cell(p.panel);
    }
    case "glass": {
      if (z < 4) return cell(z === 3 ? (mod(u, 6) === 3 ? p.accent : "wood_dark") : "soil");
      const lu = mod(u, P);
      const rowH = Math.floor((ZONE_H - 4) / w.rows);
      const lv = mod(z - 4, rowH);
      if (lu === 0 || lv === 0) return cell(p.seam);
      return cell(p.panel);
    }
    default:
      return moduleCell(w, u, z, seed);
  }
}

/** Wainscot dado (z 0 … 7): skirting at z 0, top rail at z 7, the style's face in between. */
function dadoCell(w: WallSpec, u: number, z: number, seed: number): Cell {
  const p = w.paint;
  const P = Math.max(2, w.panel);
  if (z === 0 || z === 7) return cell("wood_dark");
  switch (w.dado) {
    case "bead":
      // Vertical tongue-and-groove boards, a recessed bead every third voxel.
      return mod(u, 3) === 0 ? cell(p.seam, true) : cell(p.dado);
    case "board": {
      // Shiplap: boards two voxels high, staggered butt joints, a shadow gap under each.
      const row = Math.floor((z - 1) / 2);
      if ((z - 1) % 2 === 1) return cell(p.seam, true);
      const off = Math.floor(ihash(row, 7, seed + 41) * P * 2);
      return mod(u + off, P * 2) === 0 ? cell(p.seam, true) : cell(p.dado);
    }
    case "tile": {
      // Small square tiles with recessed grout, a darker trim course on top.
      if (z === 6) return cell(p.seam);
      if (mod(u, 3) === 0 || (z - 1) % 3 === 2) return cell(p.seam, true);
      return cell(p.dado);
    }
    default: {
      // Raised panels with stiles.
      const lu = mod(u, P);
      if (lu < 2) return cell("wood_dark");
      if (lu === 2 || z === 1) return cell("walnut");
      return cell(p.dado);
    }
  }
}

/** Panel module families: grid, plate, tile, brick, screen, drawers, pegboard. */
function moduleCell(w: WallSpec, u0: number, z: number, seed: number): Cell {
  const p = w.paint;
  const P = Math.max(2, w.panel);
  const s = w.seam;
  const rowH = Math.max(2, Math.floor(ZONE_H / Math.max(1, w.rows)));
  const row = Math.floor(z / rowH);
  const u = w.family === "brick" ? u0 + (row % 2) * (P >> 1) : u0;
  const lu = mod(u, P);
  const lv = mod(z, rowH);
  const col = Math.floor(u / P);
  if (row >= Math.max(1, w.rows)) return cell(p.seam, w.relief === "inset");
  // LED node pairs at the mid seam crossings.
  if (w.nodes && lu < Math.max(2, s)) {
    const mid = Math.floor(w.rows / 2) * rowH;
    if (z === mid - 2 || z === mid + 1) return cell("node");
  }
  if (lu < s || lv < s) return cell(p.seam, w.relief === "inset");
  const iu = lu - s;
  const iv = lv - s;
  const iw = P - s;
  const ih = rowH - s;
  const pick = ihash(col, row, seed);
  if (w.dark > 0 && mod(col, w.dark) === w.dark - 1) return cell(p.dark);
  if (w.bezel && (iu === 0 || iv === 0 || iu === iw - 1 || iv === ih - 1)) return cell(p.accent);
  switch (w.family) {
    case "plate":
      if ((iu === 1 || iu === iw - 2) && (iv === 1 || iv === ih - 2)) return cell(p.accent);
      break;
    case "drawers":
      if (w.glyphs === "keyholes") {
        if (glyphAt("keyholes", 0, iu, iv, iw, ih)) return cell("node", true);
        if (iu === 0 || iv === ih - 1) return cell("metal_dark_lt");
        return cell(p.panel);
      }
      if (iv === Math.floor(ih / 2) && Math.abs(iu - Math.floor(iw / 2)) <= 1)
        return cell(p.accent);
      if (iv === ih - 1 && iu === Math.floor(iw / 2)) return cell("node");
      break;
    case "screen":
      if (iu === 0 || iv === 0 || iu === iw - 1 || iv === ih - 1) return cell(p.seam);
      if (iv === 1 && iu === iw - 2) return cell(p.accent);
      if (iv % 3 === 0) return cell("scan_dim");
      return cell(p.panel);
    case "pegboard":
      break;
  }
  // Inlays (painted for pegboards and digits, carved otherwise).
  if (w.inlays > 0 && ihash(col, row, seed + 17) < w.inlays) {
    const m = w.family === "pegboard" ? 2 : 1;
    if (
      iu >= m &&
      iv >= m &&
      iu < iw - m &&
      iv < ih - m &&
      glyphAt(w.glyphs, pick, iu - m, iv - m, iw - 2 * m, ih - 2 * m)
    ) {
      const painted = w.family === "pegboard" || w.glyphs === "digits" || w.glyphs === "chevrons";
      return cell(p.inlay, !painted);
    }
  }
  if (w.family === "pegboard" && iu % 2 === 1 && iv % 2 === 1) return cell("black", true);
  return cell(p.panel);
}

// ── Floors ───────────────────────────────────────────────────────

export interface FloorCtx {
  /** Fine coordinates inside the room's bounding box. */
  x: number;
  z: number;
  /** Fine size of the bounding box. */
  w: number;
  d: number;
  /** Source distance to the room's own wall (1 = beside it). */
  edge: number;
}

export function floorFace(f: FloorSpec, q: FloorCtx, seed: number): Cell {
  const p = f.paint;
  const T = Math.max(2, f.tile);
  const { x, z } = q;
  const long = q.w >= q.d;
  const along = long ? x : z;
  const across = long ? z - Math.floor(q.d / 2) : x - Math.floor(q.w / 2);
  const cx = Math.floor(q.w / 2);
  const cz = Math.floor(q.d / 2);
  const r = Math.hypot(x - cx, z - cz);
  // Cracks glow from below (node channel, carved).
  if (f.cracks) {
    // Thin crack lines: a ridge of warped noise, kept sparse.
    const wx = x + 8 * vnoise(x / 9, z / 9, seed + 22);
    const n = vnoise(wx / 26, z / 26, seed + 21);
    if (Math.abs(n - 0.5) < 0.006 && vnoise(x / 40, z / 40, seed + 23) > 0.45)
      return cell("node", true);
  }
  // Light inlays.
  if (f.lines === "center" || f.lines === "both") {
    if (Math.abs(across + 0.5) <= 1 && mod(along, 8) < 5) return cell(p.line);
  }
  if (f.lines === "sides" || f.lines === "both") {
    if (q.edge === 2 && mod(long ? z : x, SKIN_FINE) === 1) return cell(p.line);
  }
  if (f.diamonds) {
    const tu = mod(along, 16) - 8;
    const dd = Math.abs(tu) + Math.abs(across + 0.5);
    if (Math.abs(dd - 3) < 0.6 && (f.family === "guide" || q.edge > 2)) return cell(p.line);
  }
  switch (f.family) {
    case "tiles": {
      const lx = mod(x, T);
      const lz = mod(z, T);
      if (lx === 0 || lz === 0) return cell(p.grout, true);
      const t = ihash(Math.floor(x / T), Math.floor(z / T), seed);
      return cell(t < 0.12 ? p.b : p.a);
    }
    case "checker": {
      if (mod(x, T) === 0 || mod(z, T) === 0) return cell(p.grout, true);
      return cell((Math.floor(x / T) + Math.floor(z / T)) % 2 === 0 ? p.a : p.b);
    }
    case "tread":
      return cell(
        (mod(x, 4) === 0 && mod(z, 4) === 1) || (mod(x, 4) === 2 && mod(z, 4) === 3) ? p.b : p.a,
      );
    case "grate": {
      if (q.edge === 1) return cell(p.border);
      if (mod(x, 2) === 0 || mod(z, 8) === 0) return cell(p.a);
      return cell(ihash(x, z, seed) < 0.025 ? "node" : p.b, true);
    }
    case "raised": {
      if (mod(x, T) === 0 || mod(z, T) === 0) return cell(p.grout, true);
      const perf = ihash(Math.floor(x / T), Math.floor(z / T), seed) < 0.35;
      if (perf && x % 2 === 1 && z % 2 === 1) return cell("node", true);
      return cell(p.a);
    }
    case "guide": {
      if (q.edge === 1) return cell(p.border);
      if (mod(x, T) === 0 || mod(z, T) === 0) return cell(p.grout, true);
      return cell(p.a);
    }
    case "rings": {
      if (r < 3) return cell("node");
      if (mod(r, 12) < 1) return cell(p.line);
      const ang = Math.atan2(z - cz, x - cx);
      const spoke = Math.abs(Math.sin(ang * 4)) * r;
      if (spoke < 0.7) return cell(p.b, true);
      return cell(Math.floor(r / 12) % 2 === 0 ? p.a : p.b);
    }
    case "planks": {
      const row = Math.floor(z / T);
      const off = Math.floor(ihash(row, 1, seed) * 24);
      const lx = mod(x + off, 24);
      if (lx === 0 || mod(z, T) === 0) return cell(p.grout);
      return cell(ihash(row, Math.floor((x + off) / 24), seed) < 0.3 ? p.b : p.a);
    }
    case "parquet": {
      const B = T * 2;
      const bx = Math.floor(x / B);
      const bz = Math.floor(z / B);
      const horiz = (bx + bz) % 2 === 0;
      const k = horiz ? mod(z, B) : mod(x, B);
      if (k % T === 0) return cell(p.grout);
      return cell((Math.floor(k / T) + bx) % 2 === 0 ? p.a : p.b);
    }
    case "terrazzo": {
      const h = ihash(x, z, seed);
      if (p.node === "node" && h < 0.012) return cell("node");
      if (h < 0.08) return cell(p.b);
      if (h < 0.11) return cell(p.grout);
      return cell(p.a);
    }
    case "epoxy": {
      if (q.edge === 2) return cell(mod(x + z, 8) < 4 ? p.border : "hazard_black");
      if (vnoise(x / 12, z / 12, seed + 4) > 0.78) return cell(p.b);
      return cell(p.a);
    }
    case "concrete": {
      if (mod(x, T) === 0 || mod(z, T) === 0) return cell(p.grout, true);
      if (f.lines === "both" && q.edge === 3 && mod(long ? z : x, SKIN_FINE) === 0)
        return cell(p.border);
      return cell(ihash(x, z, seed) < 0.07 ? p.b : p.a);
    }
    case "gravel": {
      if (f.lines === "center") {
        if (Math.abs(across + 0.5) === 4.5) return cell("steel");
        if (Math.abs(across + 0.5) < 6 && mod(along, 6) === 0) return cell("wood_dark");
      }
      const h = ihash(x, z, seed);
      return cell(h < 0.33 ? p.b : h < 0.4 ? "rock" : p.a);
    }
    case "beds": {
      const lx = mod(x, T);
      const lz = mod(z, T * 2);
      if (lx < 6 || lz < 6) return cell(p.b);
      if (lx === 6 || lz === 6 || lx === T - 1 || lz === T * 2 - 1)
        return cell(mod(x + z, 6) === 0 ? p.node : p.grout);
      return cell(ihash(x, z, seed) < 0.18 ? "leaf_light" : p.a);
    }
    case "stars": {
      if (ihash(x, z, seed) < 0.012) return cell("node");
      if (mod(r, 16) < 1) return cell(p.grout);
      return cell(Math.floor(r / 16) % 2 === 0 ? p.a : p.b);
    }
    case "carpet": {
      if (q.edge === 1) return cell(p.border);
      if (q.edge === 2 && mod(long ? z : x, SKIN_FINE) === 0) return cell(p.b);
      return cell(ihash(x, z, seed) < 0.45 ? p.b : p.a);
    }
  }
}

// ── A whole room ─────────────────────────────────────────────────

export interface SkinRoomGrid {
  room: string;
  floor: FloorId;
  /** Source-voxel origin of the grid (x, z); y starts at 0. */
  ox: number;
  oz: number;
  /** Fine size. */
  sx: number;
  sy: number;
  sz: number;
  /** Palette indices, x fastest, then y, then z (uvox order). */
  data: Uint8Array;
}

/** Fine height: y 0 (floor) … y 8 (wall top). */
export const SKIN_SY = (WALL_HEIGHT + 1) * SKIN_FINE;

function seedOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return h & 0xffff;
}

/**
 * The room's walls, floor and cornice as fine voxels (no devices, props or
 * decor). Door openings are carved (y 1–6), lintels stay.
 */
export function skinRoomGrid(
  skin: RoomSkin,
  floorId: FloorId,
  opts: { cut?: boolean } = {},
): SkinRoomGrid {
  const g: FloorGeom = floorGeomOf(floorId);
  const rg: RoomGeom | undefined = g.byId.get(skin.room);
  if (!rg) throw new Error(`skins: room ${skin.room} is not on floor ${floorId}`);
  const seed = seedOf(skin.room);
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  const grow = (x: number, z: number) => {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  };
  for (const i of rg.cells) grow(i % g.W, Math.floor(i / g.W));
  for (const w of rg.walls) grow(w.x, w.z);
  const F = SKIN_FINE;
  const sx = (x1 - x0 + 1) * F;
  const sz = (z1 - z0 + 1) * F;
  const sy = SKIN_SY;
  const data = new Uint8Array(sx * sy * sz);
  const set = (fx: number, fy: number, fz: number, c: number) => {
    if (fx < 0 || fy < 0 || fz < 0 || fx >= sx || fy >= sy || fz >= sz) return;
    data[fx + fy * sx + fz * sx * sy] = c;
  };

  const doors = DOORS.filter((d) => d.floor === floorId);
  const doorSet = new Set<number>();
  for (const d of doors) for (const c of doorCells(d)) doorSet.add(c.x + c.z * g.W);
  const nearDoorCell = (x: number, z: number, reach: number) => {
    for (let dz = -reach; dz <= reach; dz++)
      for (let dx = -reach; dx <= reach; dx++)
        if (doorSet.has(x + dx + (z + dz) * g.W)) return true;
    return false;
  };

  // Floor: interior cells get the pattern in their top fine layer.
  const ctxW = sx;
  const ctxD = sz;
  for (const i of rg.cells) {
    const x = i % g.W;
    const z = Math.floor(i / g.W);
    const edge = g.edge[i]!;
    for (let sz2 = 0; sz2 < F; sz2++)
      for (let sx2 = 0; sx2 < F; sx2++) {
        const fx = (x - x0) * F + sx2;
        const fz = (z - z0) * F + sz2;
        const c = floorFace(skin.floor, { x: fx, z: fz, w: ctxW, d: ctxD, edge }, seed);
        const idx = paintIndex(c.c);
        for (let fy = 0; fy < F - 1; fy++) set(fx, fy, fz, C.floor_dark);
        set(fx, F - 2, fz, idx);
        if (!c.r) set(fx, F - 1, fz, idx);
      }
  }

  // Walls: fine layers along the inward normal; the inner face carries the skin.
  for (const w of rg.walls) {
    const isDoor = doorSet.has(w.x + w.z * g.W);
    const axisX = w.nx !== 0 && w.nz === 0; // wall runs along z, faces ±x
    const axisZ = w.nz !== 0 && w.nx === 0; // wall runs along x, faces ±z
    // Cutaway (iso pictures, like the game's V key): walls facing away from a
    // camera on the +x / +z side stop at the base.
    const cutHere = opts.cut === true && (w.nx < 0 || w.nz < 0);
    for (let y = 0; y <= WALL_HEIGHT; y++) {
      if (isDoor && y >= 1 && y <= 6) continue;
      if (cutHere && y >= 2) continue;
      for (let a = 0; a < F; a++)
        for (let b = 0; b < F; b++)
          for (let sy2 = 0; sy2 < F; sy2++) {
            const fx = (w.x - x0) * F + a;
            const fz = (w.z - z0) * F + b;
            const fy = y * F + sy2;
            if (y === 0) {
              set(fx, fy, fz, C.metal_dark);
              continue;
            }
            const v = (y - 1) * F + sy2;
            // Depth from the inner face (0 = surface toward the room).
            const depth = axisX
              ? w.nx > 0
                ? F - 1 - a
                : a
              : axisZ
                ? w.nz > 0
                  ? F - 1 - b
                  : b
                : 0;
            // Diagonal cells sample one column per cell: rows continue, no vertical seam zigzag.
            const u = !axisX && !axisZ ? w.p * F + 2 : w.p * F + (axisX ? b : a);
            const c = wallFace(skin.wall, u, v, seed);
            const idx = paintIndex(c.c);
            if (v >= CAP_V0) {
              set(fx, fy, fz, idx);
              continue;
            }
            if (!axisX && !axisZ) {
              set(fx, fy, fz, idx);
              continue;
            }
            if (depth === 0) {
              if (!c.r) set(fx, fy, fz, idx);
            } else if (depth === 1) set(fx, fy, fz, idx);
            else set(fx, fy, fz, C.wall_dark_dk);
          }
    }
  }

  // Cornice: above head (y 7–8) in the interior cell beside straight walls.
  if (skin.wall.cornice !== "none") {
    const cap = paintIndex(skin.wall.paint.cap);
    const body =
      skin.wall.paint.seam === "line" ||
      skin.wall.paint.seam === "node" ||
      skin.wall.paint.seam === "field"
        ? C.metal_dark
        : paintIndex(skin.wall.paint.seam);
    for (const w of rg.walls) {
      if (Math.abs(w.nx) + Math.abs(w.nz) !== 1) continue;
      if (opts.cut === true && (w.nx < 0 || w.nz < 0)) continue;
      const ix = w.x + w.nx;
      const iz = w.z + w.nz;
      if (g.owner[ix + iz * g.W] !== rg.index + 1) continue;
      if (nearDoorCell(w.x, w.z, 2)) continue;
      for (let vc = 0; vc < 2 * F; vc++)
        for (let k = 0; k < F; k++)
          for (let t = 0; t < F; t++) {
            // k = fine distance from the wall face into the room, t = along.
            const fx = w.nx !== 0 ? (ix - x0) * F + (w.nx > 0 ? k : F - 1 - k) : (ix - x0) * F + t;
            const fz = w.nz !== 0 ? (iz - z0) * F + (w.nz > 0 ? k : F - 1 - k) : (iz - z0) * F + t;
            const fy = (WALL_HEIGHT - 1) * F + vc;
            let c = 0;
            if (skin.wall.cornice === "chamfer") {
              if (k <= vc >> 1) c = vc === 0 ? C.skin_line : body;
              if (vc === 2 * F - 1) c = cap;
            } else {
              // Cove: a ledge one voxel out at y 7, light strip on top, backing to the cap.
              if (vc < 2 && k <= 3) c = body;
              else if (vc === 2 && k >= 2) c = C.skin_line;
              else if (k === 0 && vc >= 2) c = body;
              if (vc === 2 * F - 1 && k === 0) c = cap;
            }
            if (c) set(fx, fy, fz, c);
          }
    }
  }
  return { room: skin.room, floor: floorId, ox: x0, oz: z0, sx, sy, sz, data };
}

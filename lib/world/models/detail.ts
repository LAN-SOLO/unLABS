/**
 * Device detail: a second, finer voxel level plus real voxel components
 * (docs/VOXEL-BLENDER.md § Device detail).
 *
 * 1. **Feinstufe** — the engine already refines every device voxel 2×2×2
 *    with detail rules (refine.ts: bevels, seams, rivets, wear, scanlines,
 *    LEDs). Here the refined grid is refined once more with finer rules, so
 *    a source voxel becomes 4×4×4 voxels.
 * 2. **Bauteile** — flat, exposed, single-colour panels of the AUTHORED
 *    grid are found per face; on them (at the fine level) voxel components
 *    are stamped, matched to the panel and the device:
 *    - screens (screen colours not covered by a live screen) get content in
 *      the style of the device's live screens (bars, wave, text, radar …)
 *    - the largest front panel gets a type plate with the device id
 *    - side and back panels get vent slots (carved one voxel deep) with
 *      slotted screws in the corners, top panels a perforated grille
 *    Stamps only recolour surface voxels or carve inwards: the silhouette
 *    stays exactly the authored one.
 *
 * `detailVisual` returns the same visual at the fine lattice: every voxel
 * coordinate (part offsets and pivots, translational animation amplitudes,
 * lights, screens, footprint, height) is multiplied by the factor and the
 * scale divided by it — the device occupies exactly the same world space.
 * Game logic (collision, footprints, sides) keeps using `deviceVisual`; only
 * rendering uses the detailed one.
 *
 * Pure and deterministic (no three.js, no randomness).
 */
import { VoxelGrid } from "@/lib/voxel/grid";
import { refineGrid, type RefineRules } from "@/lib/voxel/refine";
import { C, labMaterialOf } from "@/lib/world/content/palette";
import type { AnimPart, DeviceVisual, ScreenContent, ScreenSpec } from "@/lib/world/models/anim";
import { MODEL_SCALE, Model } from "@/lib/world/models/core";
import {
  DARK_PARTNER,
  LIGHT_PARTNER,
  labRefineOptions,
  refineModel,
} from "@/lib/world/models/refine";

/** Rules of the second refinement (periods in refined voxels). */
export const FINE_RULES: RefineRules = {
  bevel: 3,
  thinLines: true,
  seams: [8, 8, 8],
  grooves: true,
  rivets: true,
  wear: 0.03,
  scanlines: true,
  leds: true,
};

const SCREEN = new Set<number>([
  C.screen_green,
  C.screen_amber,
  C.screen_cyan,
  C.screen_red,
  C.screen_blue,
  C.screen_white,
  C.screen_purple,
  C.crt_bg,
]);
/** Panels never touched: windows, emissives, fabrics of light. */
function stampable(c: number): boolean {
  const m = labMaterialOf(c);
  return m === "solid" || m === "metal";
}

// ── Faces and panels (authored grid) ─────────────────────────────

/** Face directions: index → outward normal. */
export type FaceDir = "+z" | "-z" | "+x" | "-x" | "+y";
const DIRS: readonly FaceDir[] = ["+z", "-z", "+x", "-x", "+y"];

interface Frame {
  /** Panel width (u) and height (v) of the face plane, number of layers. */
  U: number;
  V: number;
  layers: number;
  /** Cell of (u, v) on layer l (l counts from the outermost layer inwards). */
  cell(u: number, v: number, l: number): [number, number, number];
  /** Outward step. */
  out: [number, number, number];
}

/**
 * Face frame as a viewer in front of the face sees it: u to the right, v up
 * (top face: v away from the front). Layer 0 is the outermost plane.
 */
function frame(dir: FaceDir, sx: number, sy: number, sz: number): Frame {
  switch (dir) {
    case "+z":
      return { U: sx, V: sy, layers: sz, out: [0, 0, 1], cell: (u, v, l) => [u, v, sz - 1 - l] };
    case "-z":
      return { U: sx, V: sy, layers: sz, out: [0, 0, -1], cell: (u, v, l) => [sx - 1 - u, v, l] };
    case "+x":
      return {
        U: sz,
        V: sy,
        layers: sx,
        out: [1, 0, 0],
        cell: (u, v, l) => [sx - 1 - l, v, sz - 1 - u],
      };
    case "-x":
      return { U: sz, V: sy, layers: sx, out: [-1, 0, 0], cell: (u, v, l) => [l, v, u] };
    case "+y":
      return {
        U: sx,
        V: sz,
        layers: sy,
        out: [0, 1, 0],
        cell: (u, v, l) => [u, sy - 1 - l, sz - 1 - v],
      };
  }
}

export interface Panel {
  dir: FaceDir;
  /** Layer of the surface (0 = outermost plane of the grid on that side). */
  layer: number;
  /** Inclusive rectangle in face coordinates (authored voxels). */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  color: number;
}

/**
 * Maximal single-colour rectangles of exposed voxels, per face and layer,
 * largest first (greedy, deterministic). Only rectangles of at least
 * `minW` × `minH` authored voxels.
 */
export function findPanels(g: VoxelGrid, minW = 2, minH = 2): Panel[] {
  const out: Panel[] = [];
  for (const dir of DIRS) {
    const f = frame(dir, g.sx, g.sy, g.sz);
    for (let l = 0; l < f.layers; l++) {
      // Exposed colour per (u, v) on this layer.
      const col = new Int32Array(f.U * f.V);
      let any = false;
      for (let v = 0; v < f.V; v++)
        for (let u = 0; u < f.U; u++) {
          const [x, y, z] = f.cell(u, v, l);
          const c = g.get(x, y, z);
          if (!c) continue;
          if (g.get(x + f.out[0], y + f.out[1], z + f.out[2])) continue;
          col[v * f.U + u] = c;
          any = true;
        }
      if (!any) continue;
      for (;;) {
        const r = largestRect(col, f.U, f.V);
        if (!r || r.w < minW || r.h < minH) break;
        out.push({
          dir,
          layer: l,
          u0: r.u,
          v0: r.v,
          u1: r.u + r.w - 1,
          v1: r.v + r.h - 1,
          color: r.c,
        });
        for (let v = r.v; v < r.v + r.h; v++)
          for (let u = r.u; u < r.u + r.w; u++) col[v * f.U + u] = 0;
      }
    }
  }
  return out.sort((a, b) => area(b) - area(a) || DIRS.indexOf(a.dir) - DIRS.indexOf(b.dir));
}

function area(p: Panel): number {
  return (p.u1 - p.u0 + 1) * (p.v1 - p.v0 + 1);
}

/** Largest axis rectangle of one colour in a colour map (histogram method per colour). */
function largestRect(
  col: Int32Array,
  U: number,
  V: number,
): { u: number; v: number; w: number; h: number; c: number } | null {
  let best: { u: number; v: number; w: number; h: number; c: number } | null = null;
  const colours = new Set<number>();
  for (const c of col) if (c) colours.add(c);
  for (const c of [...colours].sort((a, b) => a - b)) {
    const hgt = new Int32Array(U);
    for (let v = 0; v < V; v++) {
      for (let u = 0; u < U; u++) hgt[u] = col[v * U + u] === c ? hgt[u]! + 1 : 0;
      // Largest rectangle in the histogram (stack).
      const st: number[] = [];
      for (let u = 0; u <= U; u++) {
        const h = u < U ? hgt[u]! : 0;
        while (st.length && hgt[st[st.length - 1]!]! >= h) {
          const top = st.pop()!;
          const hh = hgt[top]!;
          const left = st.length ? st[st.length - 1]! + 1 : 0;
          const w = u - left;
          if (hh > 0 && (!best || w * hh > best.w * best.h))
            best = { u: left, v: v - hh + 1, w, h: hh, c };
        }
        st.push(u);
      }
    }
  }
  return best;
}

// ── Fine stamping ────────────────────────────────────────────────

class Stamp {
  private readonly f: Frame;
  constructor(
    private readonly g: VoxelGrid,
    readonly p: Panel,
    private readonly k: number,
  ) {
    this.f = frame(p.dir, g.sx, g.sy, g.sz);
  }
  /** Fine-panel size. */
  get W(): number {
    return (this.p.u1 - this.p.u0 + 1) * this.k;
  }
  get H(): number {
    return (this.p.v1 - this.p.v0 + 1) * this.k;
  }
  /** Surface cell under fine panel point (s, t), searching up to 2 voxels inwards. */
  private surface(s: number, t: number): [number, number, number] | null {
    const u = this.p.u0 * this.k + s;
    const v = this.p.v0 * this.k + t;
    for (let d = 0; d < this.k; d++) {
      const [x, y, z] = this.f.cell(u, v, this.p.layer * this.k + d);
      if (this.g.get(x, y, z)) return [x, y, z];
    }
    return null;
  }
  paint(s: number, t: number, c: number): void {
    if (s < 0 || t < 0 || s >= this.W || t >= this.H) return;
    const at = this.surface(s, t);
    if (at) this.g.set(at[0], at[1], at[2], c);
  }
  /** Remove the surface voxel; the one behind turns `behind`. */
  carve(s: number, t: number, behind: number): void {
    if (s < 0 || t < 0 || s >= this.W || t >= this.H) return;
    const at = this.surface(s, t);
    if (!at) return;
    this.g.set(at[0], at[1], at[2], 0);
    const [x, y, z] = at;
    const o = this.f.out;
    const bx = x - o[0];
    const by = y - o[1];
    const bz = z - o[2];
    if (this.g.get(bx, by, bz)) this.g.set(bx, by, bz, behind);
  }
}

const dark = (c: number): number => DARK_PARTNER[c] || C.black;
const light = (c: number): number => LIGHT_PARTNER[c] || C.aluminium;

/** Slotted screw head, 2×2 (a light disc with a dark slot). */
function screw(st: Stamp, s: number, t: number, base: number): void {
  const hi = light(base);
  st.paint(s, t, hi);
  st.paint(s + 1, t, hi);
  st.paint(s, t + 1, dark(base));
  st.paint(s + 1, t + 1, hi);
}

function corners(st: Stamp, m: number, base: number): void {
  for (const [s, t] of [
    [m, m],
    [st.W - m - 2, m],
    [m, st.H - m - 2],
    [st.W - m - 2, st.H - m - 2],
  ] as const)
    screw(st, s, t, base);
}

/** Horizontal vent slots carved one voxel deep, screws in the corners. */
function vents(st: Stamp): void {
  const m = 3;
  const x0 = m + 4;
  const x1 = st.W - m - 5;
  if (x1 - x0 < 6) return;
  for (let t = m + 3; t <= st.H - m - 4; t += 3)
    for (let s = x0; s <= x1; s++) st.carve(s, t, C.black);
  corners(st, m, st.p.color);
}

/** Perforated grille: a grid of carved holes. */
function grille(st: Stamp): void {
  const m = 4;
  for (let t = m; t <= st.H - m - 1; t += 3)
    for (let s = m; s <= st.W - m - 1; s += 3) st.carve(s, t, C.black);
}

/** Access hatch: a carved outline groove, a recessed grip, screws inside the corners (vents inside on side panels). */
function hatch(st: Stamp, withVents: boolean): void {
  const m = 2;
  const s0 = m;
  const s1 = st.W - m - 1;
  const t0 = m;
  const t1 = st.H - m - 1;
  for (let s = s0; s <= s1; s++) {
    st.carve(s, t0, C.black);
    st.carve(s, t1, C.black);
  }
  for (let t = t0; t <= t1; t++) {
    st.carve(s0, t, C.black);
    st.carve(s1, t, C.black);
  }
  corners(st, m + 2, st.p.color);
  // Grip: a short recessed slot near the bottom middle.
  const mid = Math.floor(st.W / 2);
  for (let s = mid - 3; s <= mid + 2; s++) st.carve(s, t0 + 3, C.black);
  if (withVents) {
    const top = t1 - 5;
    for (let t = t0 + 7; t <= top; t += 3)
      for (let s = s0 + 6; s <= s1 - 6; s++) st.carve(s, t, C.black);
  }
}

/** A row of light rivets along the top and bottom of a panel. */
function rivets(st: Stamp): void {
  const hi = light(st.p.color);
  for (let s = 2; s < st.W - 2; s += 4) {
    st.paint(s, 1, hi);
    st.paint(s, st.H - 2, hi);
  }
}

/** Stickers: hazard stripes or a serial barcode label. */
function sticker(st: Stamp, kind: "hazard" | "barcode"): void {
  const w = Math.min(st.W - 4, 12);
  const h = Math.min(st.H - 4, 6);
  const s0 = st.W - w - 2;
  const t0 = 2;
  for (let t = t0; t < t0 + h; t++)
    for (let s = s0; s < s0 + w; s++) {
      let c: number;
      if (kind === "hazard")
        c = ((s - s0 + (t - t0)) >> 1) % 2 === 0 ? C.safety_yellow : C.hazard_black;
      else {
        const edge = t === t0 || t === t0 + h - 1 || s === s0 || s === s0 + w - 1;
        const bar = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0][(s - s0) % 12]!;
        c = edge ? C.paper : bar ? C.black : C.paper;
      }
      st.paint(s, t, c);
    }
}

// 3×5 pixel font (rows top → bottom, 3 bits per row).
const FONT: Record<string, number[]> = {
  "0": [7, 5, 5, 5, 7],
  "1": [2, 6, 2, 2, 7],
  "2": [7, 1, 7, 4, 7],
  "3": [7, 1, 3, 1, 7],
  "4": [5, 5, 7, 1, 1],
  "5": [7, 4, 7, 1, 7],
  "6": [7, 4, 7, 5, 7],
  "7": [7, 1, 2, 2, 2],
  "8": [7, 5, 7, 5, 7],
  "9": [7, 5, 7, 1, 7],
  "-": [0, 0, 7, 0, 0],
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [7, 4, 4, 4, 7],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [7, 4, 5, 5, 7],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 7],
  K: [5, 5, 6, 5, 5],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [7, 5, 5, 5, 7],
  P: [7, 5, 7, 4, 4],
  Q: [7, 5, 5, 7, 1],
  R: [7, 5, 6, 5, 5],
  S: [7, 4, 7, 1, 7],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  W: [5, 5, 7, 7, 5],
  X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
};

/** Text with its top-left at (s, t) in panel coords (t counts up, so rows go down from t). */
function text(st: Stamp, s: number, t: number, str: string, c: number): number {
  let x = s;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch];
    if (g)
      g.forEach((bits, row) => {
        for (let b = 0; b < 3; b++) if (bits & (4 >> b)) st.paint(x + b, t - row, c);
      });
    x += 4;
  }
  return x - s - 1;
}

/** Type plate with the device id, top-left of the panel. */
function plate(st: Stamp, id: string): boolean {
  const tw = id.length * 4 - 1;
  const w = tw + 4;
  const h = 9;
  const m = 3;
  if (st.W < w + 2 * m || st.H < h + 2 * m) return false;
  const s0 = m;
  const t1 = st.H - m - 1;
  const t0 = t1 - h + 1;
  for (let t = t0; t <= t1; t++)
    for (let s = s0; s < s0 + w; s++) {
      const edge = t === t0 || t === t1 || s === s0 || s === s0 + w - 1;
      st.paint(s, t, edge ? C.steel_dark : C.paint_cream);
    }
  text(st, s0 + 2, t1 - 2, id, C.black);
  return true;
}

/** Screen content in the device's style. Background dark, graphics in the screen colour. */
function screenArt(st: Stamp, style: ScreenContent, seed: number): void {
  const fg = st.p.color === C.crt_bg ? C.screen_green : st.p.color;
  const bg = C.crt_bg;
  const W = st.W;
  const H = st.H;
  const m = 1;
  for (let t = 0; t < H; t++) for (let s = 0; s < W; s++) st.paint(s, t, bg);
  const h = (n: number): number => {
    const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  switch (style) {
    case "bars":
    case "power":
    case "spectrum":
    case "qubits": {
      const n = Math.max(2, Math.floor((W - 2 * m) / 3));
      for (let i = 0; i < n; i++) {
        const hh = Math.max(1, Math.round((0.25 + 0.7 * h(i)) * (H - 2 * m - 1)));
        for (let t = m; t < m + hh; t++) {
          st.paint(m + i * 3, t, fg);
          st.paint(m + i * 3 + 1, t, fg);
        }
      }
      break;
    }
    case "wave":
    case "scope":
    case "reactor": {
      const mid = (H - 1) / 2;
      for (let s = m; s < W - m; s++) {
        const y = Math.round(
          mid + Math.sin((s / (W - 2 * m)) * Math.PI * 4 + seed) * (mid - m - 0.5),
        );
        st.paint(s, y, fg);
      }
      for (let s = m; s < W - m; s += 2) st.paint(s, Math.round(mid), dark(fg) || C.scan_dim);
      break;
    }
    case "radar": {
      const cx = (W - 1) / 2;
      const cy = (H - 1) / 2;
      const r = Math.min(cx, cy) - m;
      for (let t = 0; t < H; t++)
        for (let s = 0; s < W; s++) {
          const d = Math.hypot(s - cx, t - cy);
          if (Math.abs(d - r) < 0.6 || Math.abs(d - r / 2) < 0.5) st.paint(s, t, fg);
        }
      for (let i = 0; i <= r; i++) st.paint(Math.round(cx + i * 0.7), Math.round(cy + i * 0.7), fg);
      st.paint(Math.round(cx - r / 3), Math.round(cy + r / 4), C.led_red);
      break;
    }
    case "clock": {
      if (W >= 19 && H >= 7) text(st, m + 1, H - 2, `${10 + (seed % 13)}-${10 + (seed % 49)}`, fg);
      break;
    }
    default: {
      // Text / log / code / status: rows of "words".
      for (let t = H - 2; t >= m; t -= 2) {
        let s = m;
        let i = 0;
        while (s < W - m - 1) {
          const len = 2 + Math.floor(h(t * 31 + i) * 5);
          for (let k = 0; k < len && s + k < W - m; k++) st.paint(s + k, t, fg);
          s += len + 1;
          i++;
        }
      }
    }
  }
}

/** Is fine panel point under a live screen? (live screens are canvases; keep their area free) */
function underLiveScreen(p: Panel, screens: readonly ScreenSpec[], g: VoxelGrid): boolean {
  const f = frame(p.dir, g.sx, g.sy, g.sz);
  const [ax, ay, az] = f.cell(p.u0, p.v0, p.layer);
  const [bx, by, bz] = f.cell(p.u1, p.v1, p.layer);
  const lo = [Math.min(ax, bx), Math.min(ay, by), Math.min(az, bz)];
  const hi = [Math.max(ax, bx) + 1, Math.max(ay, by) + 1, Math.max(az, bz) + 1];
  return screens.some((s) => {
    const n = s.normal;
    if (n !== p.dir) return false;
    const half = [s.w / 2, s.h / 2];
    const [cx, cy, cz] = s.center;
    const sx0 = n === "+x" || n === "-x" ? cx : cx - half[0]!;
    const sx1 = n === "+x" || n === "-x" ? cx : cx + half[0]!;
    const sz0 = n === "+z" || n === "-z" ? cz : cz - half[0]!;
    const sz1 = n === "+z" || n === "-z" ? cz : cz + half[0]!;
    const sy0 = n === "+y" ? cy : cy - half[1]!;
    const sy1 = n === "+y" ? cy : cy + half[1]!;
    const overlap = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 + 1 && b0 < a1 + 1;
    return (
      overlap(sx0, sx1, lo[0]!, hi[0]!) &&
      overlap(sy0, sy1, lo[1]!, hi[1]!) &&
      overlap(sz0, sz1, lo[2]!, hi[2]!)
    );
  });
}

// ── The detailed visual ──────────────────────────────────────────

/** Voxels per authored voxel edge in the detailed models. */
export const DETAIL_FACTOR = 4;

function fine(grid: VoxelGrid, authoredFine: boolean): VoxelGrid {
  const once = authoredFine ? grid : refineModel(grid, "device");
  const o = labRefineOptions("device");
  o.rules = FINE_RULES;
  return refineGrid(once, o);
}

function toModel(g: VoxelGrid): Model {
  const m = new Model(g.sx, g.sy, g.sz);
  m.grid.data.set(g.data);
  return m;
}

/** Translational amplitudes are in voxels; angles are not. */
const MOVES = new Set(["bob", "slide", "orbit", "piston", "jitter"]);

function seedOf(id: string): number {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 1000;
}

/** The heavy part of the detail: fine base (with components) and fine part grids. */
export interface DetailGrids {
  base: VoxelGrid;
  parts: VoxelGrid[];
}

/** Voxels per authored voxel edge for this visual (authored-fine visuals refine once). */
export function detailFactor(v: DeviceVisual): number {
  return v.fine ? 2 : DETAIL_FACTOR;
}

/**
 * The fine grids of a device: base with its components, every part refined
 * the same way. Pure and deterministic — runs in a worker
 * (lib/world/render/detail.worker.ts). `id` names the type plate and seeds
 * the screen art.
 */
export function detailGrids(v: DeviceVisual, id: string): DetailGrids {
  const k = detailFactor(v);
  const src = v.base.grid;
  const base = fine(src, !!v.fine);
  const step = base.sx / src.sx;
  if (step !== k) throw new Error(`detail ${id}: refined ×${step}, expected ×${k}`);
  // Components on the authored panels (largest first), one per panel.
  const screens = v.screens ?? [];
  const panels = findPanels(src);
  const style = screens[0]?.content ?? "text";
  let plated = false;
  const seed = seedOf(id);
  const used = new Map<string, number>();
  const bump = (key: string): number => {
    const n = (used.get(key) ?? 0) + 1;
    used.set(key, n);
    return n;
  };
  panels.forEach((p, i) => {
    // Live screens are canvases drawn by the engine: their panel stays as authored.
    if (underLiveScreen(p, screens, src)) return;
    const st = new Stamp(base, p, k);
    if (SCREEN.has(p.color)) {
      screenArt(st, style, seed + i);
      return;
    }
    if (!stampable(p.color)) return;
    const big = st.W >= 28 && st.H >= 24;
    const mid = st.W >= 20 && st.H >= 14;
    const small = st.W >= 13 && st.H >= 9;
    if (p.dir === "+z" && !plated && p.color !== C.black && plate(st, id)) {
      plated = true;
      return;
    }
    if (p.dir === "+y") {
      if (bump("+y:grille") <= 1 && st.W >= 16 && st.H >= 16) grille(st);
      else if (st.W >= 10 && st.H >= 6) rivets(st);
      return;
    }
    if (big && bump(`${p.dir}:hatch`) <= 2) {
      hatch(st, p.dir !== "+z");
      return;
    }
    if (mid && p.dir !== "+z" && bump(`${p.dir}:vents`) <= 2) {
      vents(st);
      return;
    }
    if (small && bump(`${p.dir}:sticker`) <= 2) {
      sticker(st, (seed + i) % 2 === 0 ? "hazard" : "barcode");
      return;
    }
    if (st.W >= 10 && st.H >= 6) rivets(st);
  });
  return { base, parts: v.parts.map((p) => fine(p.model.grid, !!v.fine)) };
}

/**
 * The detailed visual from its fine grids: every voxel coordinate scaled by
 * the factor, the scale divided by it (same world space). Cheap.
 */
export function assembleDetail(v: DeviceVisual, grids: DetailGrids): DeviceVisual {
  const k = detailFactor(v);
  const base = grids.base;
  const scaleV = <T extends readonly number[]>(a: T): T => a.map((x) => x * k) as unknown as T;
  const parts: AnimPart[] = v.parts.map((p, i) => {
    const g = grids.parts[i]!;
    return {
      ...p,
      model: toModel(g),
      offset: scaleV(p.offset),
      pivot: scaleV(p.pivot),
      ...(p.amplitude !== undefined && MOVES.has(p.kind) ? { amplitude: p.amplitude * k } : {}),
      ...(p.rollRadius !== undefined ? { rollRadius: p.rollRadius * k } : {}),
    };
  });
  return {
    ...v,
    base: toModel(base),
    parts,
    lights: v.lights.map((l) => ({ ...l, pos: scaleV(l.pos) })),
    ...(v.footprint
      ? { footprint: [v.footprint[0] * k, v.footprint[1] * k] as [number, number] }
      : {}),
    ...(v.height !== undefined ? { height: v.height * k } : {}),
    scale: (v.scale ?? MODEL_SCALE) / k,
    ...(v.screens
      ? {
          screens: v.screens.map((s) => ({
            ...s,
            center: scaleV(s.center),
            w: s.w * k,
            h: s.h * k,
          })),
        }
      : {}),
    fine: true,
  };
}

/** The device at the fine lattice with its components (grids + assembly). */
export function detailVisual(v: DeviceVisual, id: string): DeviceVisual {
  return assembleDetail(v, detailGrids(v, id));
}

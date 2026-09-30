/**
 * Voxel models → crisp isometric vector art (SVG fragments, mm units).
 *
 * Input: the JSON dumps in `scripts/merch/voxels/` (written by
 * export-voxels.ts from the game's hi-res bot / MCP / Jade / device models).
 *
 * Method: in an isometric view every unit cube covers six triangles of a
 * fixed triangular screen lattice, and along a view ray the cube with the
 * larger x + y + z is always in front. So the renderer z-buffers exposed
 * faces per lattice triangle (exact back-to-front painter result, no
 * overlaps), then unions all triangles of the same final colour into one
 * outline path (edge cancelling + collinear merge). Result: one `<path>`
 * per colour, no hidden geometry, no hairline seams between faces, and an
 * optional silhouette outline ("sticker" cut line) underneath.
 *
 * Inks: `mode: "color"` keeps the palette (dark + light garments, darks
 * lifted on dark cloth so they don't vanish into black); `mode: "poster"`
 * posterises the shaded luminance into three tiers — dark / mid / light —
 * mapped to 2–3 flat inks (null = knockout, the garment shows through) for
 * the pop and pastel colour sets.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Ink } from "./kit.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export interface VoxelDump {
  id: string;
  name: string;
  /** [sx, sy, sz], y up; the model's front faces +z. */
  size: [number, number, number];
  palette: { hex: string; mat: string; name: string }[];
  /** Run-length encoded local palette indices (x fastest), [index, count, …]. */
  runs: number[];
}

export interface VoxelModel {
  dump: VoxelDump;
  data: Uint8Array;
}

const CACHE = new Map<string, VoxelModel>();

/** Load `scripts/merch/voxels/<id>.json` (cached). */
export function voxelModel(id: string): VoxelModel {
  const hit = CACHE.get(id);
  if (hit) return hit;
  const dump = JSON.parse(readFileSync(join(HERE, "voxels", `${id}.json`), "utf8")) as VoxelDump;
  const [sx, sy, sz] = dump.size;
  const data = new Uint8Array(sx * sy * sz);
  let o = 0;
  for (let i = 0; i < dump.runs.length; i += 2) {
    data.fill(dump.runs[i]!, o, o + dump.runs[i + 1]!);
    o += dump.runs[i + 1]!;
  }
  const m = { dump, data };
  CACHE.set(id, m);
  return m;
}

// ── Colour helpers ───────────────────────────────────────────────

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex([r, g, b]: RGB): string {
  const c = (v: number): string =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
/** Relative luminance 0..1 (sRGB → linear). */
export function luminance(c: RGB): number {
  const f = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

// ── Options ──────────────────────────────────────────────────────

export type Face = "top" | "left" | "right";

export interface PosterInks {
  /** Tier inks, darkest to lightest; null = no ink (garment shows through). */
  dark: string | null;
  mid: string | null;
  light: string | null;
  /** Emissive voxels (eyes, LEDs, screens) — defaults to `mid`. */
  glow?: string | null;
  /** Luminance cut quantiles (share of the visible area below each cut). */
  cuts?: [number, number];
}

export interface IsoOpts {
  /** Horizontal centre and bottom edge of the drawing (mm). */
  cx: number;
  bottom: number;
  /** Target height (mm) — or `unit` (mm per voxel edge) — or `width`. */
  height?: number;
  width?: number;
  unit?: number;
  /**
   * Quarter turns about the vertical axis: 0 = the model's front faces
   * lower-left, 1 = lower-right, 2/3 = back views.
   */
  yaw?: 0 | 1 | 2 | 3;
  /** Upside down (half turn about the view x axis) — belly up. */
  flip?: boolean;
  /** "color" (dark / light garments) or "poster" (pop / pastel). */
  mode?: "color" | "poster";
  poster?: PosterInks;
  /** Sticker outline under the silhouette: colour and width (mm). */
  outline?: { color: string; width: number } | null;
  /** Dark garments: minimum relative luminance of any colour (default 0.03 for dark ink). */
  lift?: number;
  /** Recolour palette entries by lab colour name (before shading). */
  recolor?: Readonly<Record<string, string>>;
  /** Leave out voxels of these material classes (e.g. "glass" beams). */
  skipMat?: readonly string[];
  /** Face brightness: top mixes towards white, right darkens (default 0.2 / 0.3). */
  topLight?: number;
  rightShade?: number;
}

export interface IsoResult {
  svg: string;
  /** Drawn box in mm (silhouette without outline). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** mm per voxel edge. */
  unit: number;
  /** Screen position (mm) of a model voxel corner (x, y, z) in the same view (after yaw). */
  at(x: number, y: number, z: number): [number, number];
}

const C30 = Math.sqrt(3) / 2;

/** Ink-aware defaults: the right mode / outline / lift for a garment ink set. */
export function inkIso(ink: Ink, o: Partial<IsoOpts> = {}): Partial<IsoOpts> {
  if (ink.id === "pop")
    return {
      mode: "poster",
      poster: { dark: "#141414", mid: null, light: "#FFFFFF", glow: ink.amber, cuts: [0.3, 0.6] },
      outline: { color: "#141414", width: 1.4 },
      ...o,
    };
  if (ink.id === "pastel")
    return {
      mode: "poster",
      poster: { dark: "#151515", mid: null, light: "#FFFFFF", glow: ink.red, cuts: [0.3, 0.6] },
      outline: { color: "#151515", width: 1.4 },
      ...o,
    };
  if (ink.light) return { mode: "color", outline: { color: "#121212", width: 1.1 }, ...o };
  return { mode: "color", lift: 0.03, outline: { color: "#EAFBEA", width: 1.1 }, ...o };
}

/** Isometric vector drawing of a voxel model. */
export function isoModel(id: string, opts: IsoOpts): IsoResult {
  const { dump, data } = voxelModel(id);
  const [sx, sy, sz] = dump.size;
  const yaw = opts.yaw ?? 0;
  // View-space dimensions after the yaw turn.
  const vx = yaw % 2 ? sz : sx;
  const vz = yaw % 2 ? sx : sz;
  const toModel = (x: number, z: number): [number, number] => {
    switch (yaw) {
      case 0:
        return [x, z];
      case 1:
        return [sx - 1 - z, x];
      case 2:
        return [sx - 1 - x, sz - 1 - z];
      default:
        return [z, sz - 1 - x];
    }
  };
  const skip = new Set(opts.skipMat ?? []);
  const cell = (x: number, y: number, z: number): number => {
    if (x < 0 || y < 0 || z < 0 || x >= vx || y >= sy || z >= vz) return 0;
    const fy = opts.flip ? sy - 1 - y : y;
    const [mx, mz] = toModel(x, opts.flip ? vz - 1 - z : z);
    const v = data[mx + sx * (fy + sy * mz)]!;
    return v && skip.has(dump.palette[v - 1]!.mat) ? 0 : v;
  };

  // ── Z-buffer over lattice triangles: key → depth, colour index, face ──
  const zDepth = new Map<number, number>();
  const zVal = new Map<number, number>();
  const KEY = (i: number, a: number): number => (i + 4096) * 16384 + (a + 8192);
  const put = (i: number, a: number, d: number, val: number): void => {
    const k = KEY(i, a);
    const cur = zDepth.get(k);
    if (cur !== undefined && cur >= d) return;
    zDepth.set(k, d);
    zVal.set(k, val);
  };
  for (let z = 0; z < vz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < vx; x++) {
        const v = cell(x, y, z);
        if (!v) continue;
        const i0 = x - z;
        const j0 = x + z - 2 * y;
        const d = x + y + z;
        if (!cell(x, y + 1, z)) {
          put(i0 - 1, j0 - 2, d, v * 4 + 0);
          put(i0, j0 - 2, d, v * 4 + 0);
        }
        if (!cell(x, y, z + 1)) {
          put(i0 - 1, j0 - 1, d, v * 4 + 1);
          put(i0 - 1, j0, d, v * 4 + 1);
        }
        if (!cell(x + 1, y, z)) {
          put(i0, j0 - 1, d, v * 4 + 2);
          put(i0, j0, d, v * 4 + 2);
        }
      }

  // ── Colours per (palette entry, face) ──
  const mode = opts.mode ?? "color";
  const topLight = opts.topLight ?? 0.2;
  const rightShade = opts.rightShade ?? 0.3;
  const lift = opts.lift ?? 0;
  const faceColor = (v: number, face: number): { c: RGB; emit: boolean } => {
    const p = dump.palette[v - 1]!;
    const base = rgb(opts.recolor?.[p.name] ?? p.hex);
    const emit = p.mat === "emit" && luminance(base) > 0.05;
    let c: RGB = base;
    if (face === 0) c = mix(base, [255, 255, 255], emit ? topLight * 0.4 : topLight);
    if (face === 2) c = mix(base, [0, 0, 0], emit ? rightShade * 0.4 : rightShade);
    return { c, emit };
  };
  const areaByVal = new Map<number, number>();
  for (const val of zVal.values()) areaByVal.set(val, (areaByVal.get(val) ?? 0) + 1);

  const colorOf = new Map<number, string | null>();
  if (mode === "color") {
    for (const val of areaByVal.keys()) {
      let { c } = faceColor(val >> 2, val & 3);
      if (lift > 0) {
        // Raise very dark colours towards a neutral grey until they reach `lift`.
        let t = 0;
        while (luminance(c) < lift && t < 1) {
          t += 0.05;
          c = mix(faceColor(val >> 2, val & 3).c, [96, 102, 110], t);
        }
      }
      colorOf.set(val, hex(c));
    }
  } else {
    // Tier per palette entry from its unshaded luminance (area-weighted
    // quantiles), then the shaded right face drops one tier — flat inks that
    // still read as volumes. Emissive voxels take the glow ink.
    const inks = opts.poster ?? { dark: "#141414", mid: "#888888", light: "#FFFFFF" };
    const tiers = [inks.dark, inks.mid, inks.light];
    const byEntry = new Map<number, { l: number; n: number; emit: boolean }>();
    for (const [val, n] of areaByVal) {
      const v = val >> 2;
      const fc = faceColor(v, 1);
      const e = byEntry.get(v) ?? { l: luminance(fc.c), n: 0, emit: fc.emit };
      e.n += n;
      byEntry.set(v, e);
    }
    const sorted = [...byEntry.values()].filter((e) => !e.emit).sort((a, b) => a.l - b.l);
    const total = sorted.reduce((s, e) => s + e.n, 0);
    const [q1, q2] = inks.cuts ?? [0.34, 0.68];
    let acc = 0;
    let cut1 = Infinity;
    let cut2 = Infinity;
    for (const e of sorted) {
      acc += e.n;
      if (cut1 === Infinity && acc >= total * q1) cut1 = e.l;
      if (cut2 === Infinity && acc >= total * q2) cut2 = e.l;
    }
    for (const val of areaByVal.keys()) {
      const e = byEntry.get(val >> 2)!;
      if (e.emit) {
        colorOf.set(val, inks.glow === undefined ? inks.mid : inks.glow);
        continue;
      }
      let tier = e.l <= cut1 ? 0 : e.l <= cut2 ? 1 : 2;
      if ((val & 3) === 2) tier = Math.max(0, tier - 1);
      colorOf.set(val, tiers[tier]!);
    }
  }

  // ── Scale and placement ──
  let iMin = Infinity;
  let iMax = -Infinity;
  let aMin = Infinity;
  let aMax = -Infinity;
  for (const k of zDepth.keys()) {
    const i = Math.floor(k / 16384) - 4096;
    const a = (k % 16384) - 8192;
    iMin = Math.min(iMin, i);
    iMax = Math.max(iMax, i + 1);
    aMin = Math.min(aMin, a);
    aMax = Math.max(aMax, a + 2);
  }
  const latW = (iMax - iMin) * C30;
  const latH = (aMax - aMin) / 2;
  const unit =
    opts.unit ?? (opts.height ? opts.height / latH : opts.width ? opts.width / latW : 100 / latH);
  const w = latW * unit;
  const h = latH * unit;
  const ox = opts.cx - w / 2 - iMin * C30 * unit;
  const oy = opts.bottom - h - (aMin / 2) * unit;
  const P = (i: number, a: number): string =>
    `${Math.round((ox + i * C30 * unit) * 100) / 100} ${Math.round((oy + (a / 2) * unit) * 100) / 100}`;

  // ── Region outlines: union of triangles per colour ──
  const tri = (i: number, a: number): [number, number][] =>
    (i + a) % 2 === 0
      ? [
          [i, a],
          [i + 1, a + 1],
          [i, a + 2],
        ]
      : [
          [i + 1, a],
          [i + 1, a + 2],
          [i, a + 1],
        ];
  const groups = new Map<string, number[]>();
  const all: number[] = [];
  for (const [k, val] of zVal) {
    all.push(k);
    const c = colorOf.get(val);
    if (!c) continue;
    const list = groups.get(c) ?? [];
    list.push(k);
    groups.set(c, list);
  }

  const outline = (keys: readonly number[]): string => {
    // Directed edges (clockwise on screen); shared edges cancel.
    const edges = new Map<string, [number, number, number, number]>();
    for (const k of keys) {
      const i = Math.floor(k / 16384) - 4096;
      const a = (k % 16384) - 8192;
      const t = tri(i, a);
      for (let e = 0; e < 3; e++) {
        const [p0, p1] = [t[e]!, t[(e + 1) % 3]!];
        const rev = `${p1[0]},${p1[1]}>${p0[0]},${p0[1]}`;
        if (edges.has(rev)) edges.delete(rev);
        else edges.set(`${p0[0]},${p0[1]}>${p1[0]},${p1[1]}`, [p0[0], p0[1], p1[0], p1[1]]);
      }
    }
    const from = new Map<string, [number, number, number, number][]>();
    for (const e of edges.values()) {
      const s = `${e[0]},${e[1]}`;
      const list = from.get(s) ?? [];
      list.push(e);
      from.set(s, list);
    }
    let d = "";
    for (const [start, list] of from) {
      while (list.length) {
        const pts: [number, number][] = [];
        let e = list.pop()!;
        const first = start;
        pts.push([e[0], e[1]]);
        for (let guard = 0; guard < 1e6; guard++) {
          const key = `${e[2]},${e[3]}`;
          if (key === first) break;
          pts.push([e[2], e[3]]);
          const next = from.get(key);
          if (!next || !next.length) break;
          e = next.pop()!;
        }
        // Drop collinear points.
        const simple: [number, number][] = [];
        for (let n = 0; n < pts.length; n++) {
          const a0 = pts[(n + pts.length - 1) % pts.length]!;
          const b0 = pts[n]!;
          const c0 = pts[(n + 1) % pts.length]!;
          const cross = (b0[0] - a0[0]) * (c0[1] - b0[1]) - (b0[1] - a0[1]) * (c0[0] - b0[0]);
          if (cross !== 0) simple.push(b0);
        }
        if (simple.length >= 3) d += `M${simple.map(([i, a]) => P(i, a)).join("L")}Z`;
      }
    }
    return d;
  };

  let svg = "";
  const sil = outline(all);
  // Knockout inks leave holes: the outline must not fill them.
  const knockout = [...colorOf.values()].some((c) => !c);
  if (opts.outline)
    svg += `<path d="${sil}" fill="${knockout ? "none" : opts.outline.color}" stroke="${opts.outline.color}" stroke-width="${Math.round(opts.outline.width * 2 * 100) / 100}" stroke-linejoin="round"/>`;
  // Seam guard: each region also strokes a hairline of its own colour.
  const hair = Math.round(Math.min(0.2, unit * 0.06) * 100) / 100;
  // Largest regions first, so small details sit on top of the hairlines.
  const ordered = [...groups].sort((a, b) => b[1].length - a[1].length);
  for (const [c, keys] of ordered)
    svg += `<path d="${outline(keys)}" fill="${c}" stroke="${c}" stroke-width="${hair}" stroke-linejoin="round"/>`;

  const at = (x: number, y: number, z: number): [number, number] => [
    ox + (x - z) * C30 * unit,
    oy + ((x + z - 2 * y) / 2) * unit,
  ];
  return { svg, x: opts.cx - w / 2, y: opts.bottom - h, w, h, unit, at };
}

/** Voxel-model ids available in scripts/merch/voxels (lore bots in lab order). */
export const VOXEL_BOTS = [
  "f1ndr",
  "x0r8t",
  "l0g1k",
  "p1ndr0",
  "r3tr0",
  "b4c0n",
  "d3c4d3",
  "w2rek",
  "k2ldr",
  "c8br41n",
] as const;
export type VoxelBot = (typeof VOXEL_BOTS)[number];

export const BOT_LABEL: Readonly<Record<VoxelBot, string>> = {
  f1ndr: "F1N-DR",
  x0r8t: "X0-R8T",
  l0g1k: "L0G-1K",
  p1ndr0: "P1N-DR0",
  r3tr0: "R3-TR0",
  b4c0n: "B4C-0N",
  d3c4d3: "D3-C4D3",
  w2rek: "W2-REK",
  k2ldr: "K2-LDR",
  c8br41n: "C8-BR41N",
};

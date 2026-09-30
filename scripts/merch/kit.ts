/**
 * Drawing kit for the merch motifs: every helper returns an SVG fragment
 * (string). Units are millimetres on the print area.
 *
 * Print rules (DTG on dark garments): no alpha fades — soft glows are drawn
 * as halftone dots, outlines as solid shapes. `Ink` swaps the palette for
 * light garments, `POP` for saturated colours (red, royal blue, teal, green)
 * and `PASTEL` for bright ones (ochre, pink, lilac, khaki).
 */
import type { InkId } from "../../lib/world/merch-garments.ts";

export interface Ink {
  /** Ink set (see InkId in lib/world/merch-garments.ts). */
  id: InkId;
  /** Printed on a light garment (dark main ink). */
  light: boolean;
  /** Main text. */
  fg: string;
  /** Secondary text. */
  dim: string;
  green: string;
  amber: string;
  cyan: string;
  red: string;
  violet: string;
  pink: string;
  orange: string;
  lime: string;
  /** Highlights (white on dark, main ink on light). */
  hi: string;
  /** Sprite outline: none on dark garments, near-black on light ones. */
  line: string | null;
  /** Panel fill behind text (dark variant only prints dark panels). */
  panel: string;
}

export const DARK: Ink = {
  id: "dark",
  light: false,
  fg: "#EAFBEA",
  dim: "#8FA38F",
  green: "#33FF33",
  amber: "#FFB800",
  cyan: "#00F0FF",
  red: "#FF3B30",
  violet: "#B388FF",
  pink: "#FF4FD8",
  orange: "#FF6B00",
  lime: "#AAFF00",
  hi: "#FFFFFF",
  line: null,
  panel: "#0B120B",
};

export const LIGHT: Ink = {
  id: "light",
  light: true,
  fg: "#121212",
  dim: "#555B55",
  green: "#12912A",
  amber: "#D98A00",
  cyan: "#0090A8",
  red: "#D0231B",
  violet: "#6A3FD0",
  pink: "#C0168F",
  orange: "#E05500",
  lime: "#5B9A00",
  hi: "#121212",
  line: "#121212",
  panel: "#121212",
};

/**
 * Saturated mid colours: white main ink, cream / warm yellow accents, black
 * for what was red or violet (red on a red shirt vanishes). No neon green.
 */
export const POP: Ink = {
  id: "pop",
  light: false,
  fg: "#FFFFFF",
  dim: "#F3E6C8",
  green: "#FFF1A8",
  amber: "#FFD23F",
  cyan: "#FFFFFF",
  red: "#141414",
  violet: "#141414",
  pink: "#FFD6E8",
  orange: "#FFD23F",
  lime: "#FFF1A8",
  hi: "#FFFFFF",
  line: "#141414",
  panel: "#141414",
};

/** Bright / pastel colours: near-black main ink with deep, darkened accents. */
export const PASTEL: Ink = {
  id: "pastel",
  light: true,
  fg: "#151515",
  dim: "#3B3B3B",
  green: "#0F5A22",
  amber: "#4A2400",
  cyan: "#0B4F66",
  red: "#9E1111",
  violet: "#3F2585",
  pink: "#8C0F5C",
  orange: "#8F3300",
  lime: "#2C5200",
  hi: "#151515",
  line: "#151515",
  panel: "#151515",
};

export const INKS: Readonly<Record<InkId, Ink>> = {
  dark: DARK,
  light: LIGHT,
  pop: POP,
  pastel: PASTEL,
};

export const FONT = {
  pixel: "PressStart",
  term: "VT323",
  mono: "SpaceMono",
  tech: "ShareTech",
  chunky: "RubikMono",
  bungee: "Bungee",
  shade: "BungeeShade",
  silk: "Silkscreen",
  neon: "Monoton",
  marker: "Marker",
  stencil: "BlackOps",
  glitch: "RubikGlitch",
  orbit: "Orbitron",
  archivo: "ArchivoBlack",
  major: "MajorMono",
  drip: "WetPaint",
  bebas: "Bebas",
  type: "SpecialElite",
} as const;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const r2 = (n: number): string => String(Math.round(n * 100) / 100);

export interface TextOpts {
  font?: string;
  size?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  ls?: number;
  weight?: number;
  /** Force the rendered width (mm). */
  width?: number;
  /** Stretch glyphs too when forcing the width. */
  squash?: boolean;
  stroke?: string;
  sw?: number;
  extra?: string;
}

export function text(x: number, y: number, s: string, o: TextOpts = {}): string {
  const a = [
    `x="${r2(x)}"`,
    `y="${r2(y)}"`,
    `font-family="${o.font ?? FONT.mono}"`,
    `font-size="${r2(o.size ?? 10)}"`,
    `fill="${o.fill ?? "#fff"}"`,
    `text-anchor="${o.anchor ?? "middle"}"`,
  ];
  if (o.ls) a.push(`letter-spacing="${r2(o.ls)}"`);
  if (o.weight) a.push(`font-weight="${o.weight}"`);
  if (o.width)
    a.push(
      `textLength="${r2(o.width)}" lengthAdjust="${o.squash ? "spacingAndGlyphs" : "spacing"}"`,
    );
  if (o.stroke)
    a.push(
      `stroke="${o.stroke}" stroke-width="${r2(o.sw ?? 1)}" stroke-linejoin="round" paint-order="stroke"`,
    );
  if (o.extra) a.push(o.extra);
  return `<text ${a.join(" ")}>${esc(s)}</text>`;
}

/** Text with a solid offset shadow (retro "print" depth, no alpha). */
export function shadowText(
  x: number,
  y: number,
  s: string,
  o: TextOpts & { shadow: string; dx?: number; dy?: number; layers?: number },
): string {
  const n = o.layers ?? 1;
  const dx = o.dx ?? 1.2;
  const dy = o.dy ?? 1.2;
  let out = "";
  for (let i = n; i >= 1; i--)
    out += text(x + (dx * i) / n, y + (dy * i) / n, s, {
      ...o,
      fill: o.shadow,
      stroke: o.stroke ? o.shadow : undefined,
    });
  return out + text(x, y, s, o);
}

export function rect(x: number, y: number, w: number, h: number, fill: string, extra = ""): string {
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${fill}" ${extra}/>`;
}

export function frame(
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
  sw: number,
  extra = "",
): string {
  return `<rect x="${r2(x + sw / 2)}" y="${r2(y + sw / 2)}" width="${r2(w - sw)}" height="${r2(h - sw)}" fill="none" stroke="${stroke}" stroke-width="${r2(sw)}" ${extra}/>`;
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  sw: number,
  extra = "",
): string {
  return `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${stroke}" stroke-width="${r2(sw)}" stroke-linecap="round" ${extra}/>`;
}

export function poly(
  pts: readonly (readonly [number, number])[],
  fill: string,
  extra = "",
): string {
  return `<polygon points="${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" ")}" fill="${fill}" ${extra}/>`;
}

export function circle(cx: number, cy: number, r: number, fill: string, extra = ""): string {
  return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${fill}" ${extra}/>`;
}

export function g(body: string, transform = "", extra = ""): string {
  return `<g${transform ? ` transform="${transform}"` : ""} ${extra}>${body}</g>`;
}

/**
 * Pixel sprite: `rows` of characters, `map` char → colour (null / missing =
 * transparent). Horizontal runs merge into one rect; `o` (outline) maps to
 * ink.line so dark garments show no black patches.
 */
export function sprite(
  rows: readonly string[],
  map: Readonly<Record<string, string | null>>,
  x: number,
  y: number,
  px: number,
): string {
  let out = "";
  rows.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      const ch = row[i]!;
      const c = map[ch];
      if (!c) {
        i++;
        continue;
      }
      let k = i + 1;
      while (k < row.length && row[k] === ch) k++;
      // Tiny overlap avoids hairline gaps between runs.
      out += `<rect x="${r2(x + i * px)}" y="${r2(y + j * px)}" width="${r2((k - i) * px + 0.05)}" height="${r2(px + 0.05)}" fill="${c}"/>`;
      i = k;
    }
  });
  return out;
}

export function spriteSize(rows: readonly string[], px: number): [number, number] {
  return [Math.max(...rows.map((r) => r.length)) * px, rows.length * px];
}

/** Halftone glow: dots on a hex grid, shrinking from r0 (centre) to 0 at `radius`. */
export function halftoneGlow(
  cx: number,
  cy: number,
  radius: number,
  color: string,
  step = 3,
  maxDot = 1.25,
  inner = 0,
): string {
  let out = "";
  const rows = Math.ceil(radius / (step * 0.866));
  for (let j = -rows; j <= rows; j++) {
    const y = cy + j * step * 0.866;
    const off = j % 2 ? step / 2 : 0;
    for (let x = cx - radius - step + off; x <= cx + radius + step; x += step) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < inner || d > radius) continue;
      const k = 1 - (d - inner) / (radius - inner);
      const r = maxDot * Math.pow(k, 1.2);
      if (r < 0.18) continue;
      out += circle(x, y, r, color);
    }
  }
  return out;
}

/** Halftone band fading from full dots at y0 to nothing at y1 (within x0..x1). */
export function halftoneBand(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  color: string,
  step = 3,
  maxDot = 1.3,
): string {
  let out = "";
  let j = 0;
  const dir = y1 > y0 ? 1 : -1;
  for (let y = y0; dir > 0 ? y <= y1 : y >= y1; y += dir * step * 0.866, j++) {
    const k = 1 - Math.abs(y - y0) / Math.abs(y1 - y0);
    const r = maxDot * k;
    if (r < 0.18) continue;
    for (let x = x0 + (j % 2 ? step / 2 : 0); x <= x1; x += step) out += circle(x, y, r, color);
  }
  return out;
}

/** Scanline cut: horizontal gaps through a shape (use as mask content). */
export function scanMask(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  pitch = 2.4,
  gap = 0.7,
): string {
  let bars = "";
  for (let yy = y; yy < y + h; yy += pitch) bars += rect(x, yy + pitch - gap, w, gap, "black");
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}">${rect(x, y, w, h, "white")}${bars}</mask>`;
}

// ── Octahedron (the _unLAB crystal logo) ─────────────────────────

const OCTA: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const OCTA_EDGES: readonly (readonly [number, number])[] = [
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [2, 4],
  [2, 5],
  [3, 4],
  [3, 5],
];

export function octahedron(
  cx: number,
  cy: number,
  r: number,
  front: string,
  back: string,
  sw: number,
  angle = 0.6,
  tilt = 0.45,
  stretch = 1.3,
): string {
  const cyA = Math.cos(angle);
  const syA = Math.sin(angle);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const pts = OCTA.map(([x, y, z]) => {
    const x1 = x * cyA + z * syA;
    const z1 = -x * syA + z * cyA;
    const y2 = y * ct - z1 * st;
    const z2 = y * st + z1 * ct;
    return { x: cx + x1 * r, y: cy - y2 * r * stretch, z: z2 };
  });
  let backs = "";
  let fronts = "";
  for (const [a, b] of OCTA_EDGES) {
    const pa = pts[a]!;
    const pb = pts[b]!;
    if ((pa.z + pb.z) / 2 < -0.1)
      backs += line(
        pa.x,
        pa.y,
        pb.x,
        pb.y,
        back,
        sw * 0.55,
        `stroke-dasharray="${r2(sw * 1.4)} ${r2(sw * 1.2)}"`,
      );
    else fronts += line(pa.x, pa.y, pb.x, pb.y, front, sw);
  }
  let dots = "";
  for (const p of pts) if (p.z >= -0.1) dots += circle(p.x, p.y, sw * 1.1, front);
  return backs + fronts + dots;
}

/** Solid faceted crystal (flat-shaded octahedron, elongated). */
export function crystal(
  cx: number,
  cy: number,
  w: number,
  h: number,
  faces: readonly string[],
  edge?: string,
  sw = 0.6,
): string {
  const top: [number, number] = [cx, cy - h / 2];
  const bot: [number, number] = [cx, cy + h / 2];
  const l: [number, number] = [cx - w / 2, cy - h * 0.04];
  const r: [number, number] = [cx + w / 2, cy - h * 0.04];
  const m: [number, number] = [cx + w * 0.08, cy + h * 0.06];
  const e = edge ? `stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round"` : "";
  return (
    poly([top, l, m], faces[0]!, e) +
    poly([top, m, r], faces[1]!, e) +
    poly([bot, l, m], faces[2]!, e) +
    poly([bot, m, r], faces[3]!, e)
  );
}

// ── Isometric voxels ─────────────────────────────────────────────

/** Iso cube at grid (x, y, z) — y up — with edge length s, origin (ox, oy). */
export function isoCube(
  ox: number,
  oy: number,
  s: number,
  x: number,
  y: number,
  z: number,
  top: string,
  left: string,
  right: string,
): string {
  const c = 0.866 * s;
  const px = ox + (x - z) * c;
  const py = oy + (x + z) * 0.5 * s - y * s;
  const T: [number, number] = [px, py - s];
  const L: [number, number] = [px - c, py - s * 0.5];
  const R: [number, number] = [px + c, py - s * 0.5];
  const C: [number, number] = [px, py];
  const B: [number, number] = [px, py + s];
  const BL: [number, number] = [px - c, py + s * 0.5];
  const BR: [number, number] = [px + c, py + s * 0.5];
  return poly([T, R, C, L], top) + poly([L, C, B, BL], left) + poly([C, R, BR, B], right);
}

/** Draw a voxel set back-to-front. `cells` = [x, y, z, [top, left, right]]. */
export function isoVoxels(
  ox: number,
  oy: number,
  s: number,
  cells: readonly (readonly [number, number, number, readonly [string, string, string]])[],
): string {
  const sorted = [...cells].sort((a, b) => a[0] + a[2] - (b[0] + b[2]) || a[1] - b[1]);
  return sorted.map(([x, y, z, c]) => isoCube(ox, oy, s, x, y, z, c[0], c[1], c[2])).join("");
}

// ── Signs, stripes, windows ──────────────────────────────────────

export function hazardStripes(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  a: string,
  b: string | null,
  pitch = 8,
): string {
  let stripes = "";
  for (let k = -h; k < w + h; k += pitch)
    stripes += poly(
      [
        [x + k, y + h],
        [x + k + pitch / 2, y + h],
        [x + k + pitch / 2 + h, y],
        [x + k + h, y],
      ],
      a,
    );
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>${b ? rect(x, y, w, h, b) : ""}<g clip-path="url(#${id})">${stripes}</g>`;
}

/** Rounded warning triangle (ISO 7010 style) centred at cx, apex at top. */
export function warnTriangle(
  cx: number,
  top: number,
  size: number,
  fill: string,
  border: string,
  sw: number,
): string {
  const h = size * 0.866;
  const pts: [number, number][] = [
    [cx, top],
    [cx + size / 2, top + h],
    [cx - size / 2, top + h],
  ];
  const p = pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" ");
  return (
    `<polygon points="${p}" fill="${border}" stroke="${border}" stroke-width="${r2(sw * 1.6)}" stroke-linejoin="round"/>` +
    poly(
      [
        [cx, top + sw * 2.3],
        [cx + size / 2 - sw * 2, top + h - sw * 1.15],
        [cx - size / 2 + sw * 2, top + h - sw * 1.15],
      ],
      fill,
      `stroke="${fill}" stroke-width="${r2(sw * 0.6)}" stroke-linejoin="round"`,
    )
  );
}

/** Terminal window chrome: title bar with three dots, framed body. */
export function termWindow(
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  ink: Ink,
  accent: string,
): string {
  const bar = 9;
  return (
    rect(x, y, w, h, ink.panel, `rx="2.5"`) +
    frame(x, y, w, h, accent, 1.1, `rx="2.5"`) +
    rect(x, y, w, bar, accent, `rx="2.5"`) +
    rect(x, y + bar - 3, w, 3, accent) +
    circle(x + 6, y + bar / 2, 1.6, ink.panel) +
    circle(x + 11, y + bar / 2, 1.6, ink.panel) +
    circle(x + 16, y + bar / 2, 1.6, ink.panel) +
    text(x + w / 2, y + bar / 2 + 2.1, title, {
      font: FONT.mono,
      size: 5.6,
      fill: ink.panel,
      weight: 700,
    })
  );
}

/** Simple seeded PRNG (designs must render identically every run). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Starburst / explosion polygon. */
export function burst(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  spikes: number,
  fill: string,
  seed = 1,
  extra = "",
): string {
  const rnd = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + rnd() * 0.12;
    const r = i % 2 ? r0 * (0.85 + rnd() * 0.25) : r1 * (0.8 + rnd() * 0.3);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts, fill, extra);
}

/** Barcode-ish tick row (serial numbers, labels). */
export function barcode(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  seed = 7,
): string {
  const rnd = rng(seed);
  let out = "";
  let cx = x;
  while (cx < x + w) {
    const bw = 0.4 + Math.floor(rnd() * 3) * 0.45;
    if (cx + bw > x + w) break;
    out += rect(cx, y, bw, h, color);
    cx += bw + 0.45 + Math.floor(rnd() * 2) * 0.45;
  }
  return out;
}

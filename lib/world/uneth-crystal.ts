/**
 * unETH crystal renderer — the _unITM crystal as the 2018 captures show it.
 * Ported from the undevbook (unlabsundevbook/src/lib/slices.ts, "Remix");
 * keep both in sync when the look changes.
 * ======================================================================
 *
 * A crystal is a rotating unETH light sculpture — the Ethereum octahedron
 * bent in neon tubes. One capture turns it by 180° over 30 frames (6° per
 * frame, 80 ms each); the sculpture is 2-fold symmetric, so frame 29 flows
 * seamlessly back into frame 0. Variants come from the traits:
 *
 *   colours  white < green < yellow < blue < purple < red < orange (+ rgb)
 *   styles   mono (P01 "BW", 64 bit only) · px pure / RGB (P02 / P03)
 *   tiers    volatility 1…5 (glow, shake, sparks; T5 tears the image)
 *   states   O steady · I pulses · I/O drops tubes in and out
 *   eras     16 < 32 < 64 bit (blocky, posterized, scanlines)
 *
 * Deterministic: the same traits and frame always give the same pixels.
 * Browser only (Canvas 2D incl. `filter`).
 */

export type SliceColor =
  | "white"
  | "green"
  | "yellow"
  | "blue"
  | "purple"
  | "red"
  | "orange"
  | "rgb";
/**
 * Style of the capture: `mono` = the black-and-white P01/L01 line ("BW",
 * colour only as a tint letter), `px` = the pixel lines — P02/L02 "pure"
 * (one neon colour) or, for colour `rgb`, P03/L04 "RGB".
 */
export type SliceStyle = "mono" | "px";
export type Rotation = "CW" | "CCW";
/** Archive `stasis` column: S = stasis, NOS = no stasis. */
export type Stasis = "S" | "NOS";
/** State: O, I or I/O (written O / I / IO in the release lists, 0 / I / I0 in file names). */
export type IoState = "O" | "I" | "IO";
export type Era = 8 | 16 | 32 | 64;

export interface SliceTraits {
  /** unETH archive ID (1…1120) — also the noise seed. */
  id: number;
  style: SliceStyle;
  color: SliceColor;
  /** Volatility tier 1…5. */
  tier: 1 | 2 | 3 | 4 | 5;
  rotation: Rotation;
  stasis: Stasis;
  io: IoState;
  era: Era;
}

export const FRAMES = 30;
/** Turn per slice in the original captures: 180° over 30 slices. */
export const DEG_PER_FRAME = 180 / FRAMES;
/** Frame delay of the original capture GIFs (30 × 80 ms = 2.4 s per loop). */
export const FRAME_MS = 80;

/** Slice angle (0…174°) of frame 0…29. */
export function sliceAngle(frame: number): number {
  return frame * DEG_PER_FRAME;
}

export const COLORS: SliceColor[] = [
  "white",
  "green",
  "yellow",
  "blue",
  "purple",
  "red",
  "orange",
  "rgb",
];
/** Neon tints — the unETH octahedron palette (UI_STYLE_guide-main, "THE OCTAHEDRON"). */
export const COLOR_HEX: Record<SliceColor, string> = {
  white: "#e8f4ff",
  green: "#00ff66",
  yellow: "#ffb800",
  blue: "#0066ff",
  purple: "#ff00ff",
  red: "#ff3333",
  orange: "#ff6b00",
  rgb: "#ffffff",
};
/** Grey of the mono (BW) captures before the tint. */
const MONO_HEX = "#d8d8d8";

// ── deterministic noise ─────────────────────────────────────────

function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Smooth 1D value noise in −1…1. */
function vnoise(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash(seed * 7919 + i) * 2 - 1;
  const b = hash(seed * 7919 + i + 1) * 2 - 1;
  const k = f * f * (3 - 2 * f);
  return a + (b - a) * k;
}

// ── geometry ────────────────────────────────────────────────────

type V3 = [number, number, number];

/**
 * The ETH logo as a flat faceted sculpture: an upper diamond (apex, a rhombic
 * waist — wide across, shallow in depth — and a short lower point) and, below
 * a gap, the chevron: an open rhombic ring folding down to the bottom apex and
 * in to an inner point. Proportions measured on the ID-0961 reference: it is
 * edge-on (a thin line) in slice 1 and face-on around slice 16, so the piece
 * is 2-fold symmetric and the 30 slices (180°) are one full visual cycle.
 * Fitted to the 30 original frames (silhouette width per frame: face-on
 * ≈ 0.47 of the frame, edge-on ≈ 0.12 incl. glow; research check 2026-09-29).
 */
function crystal(): { v: V3[]; edges: [number, number][]; faces: number[][] } {
  const v: V3[] = [];
  const R1 = 0.66;
  const R2 = 0.645;
  /** Depth of the rhombic waist relative to its width. */
  const D = 0.26;
  v.push([0, 1, 0]); // 0 apex
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    v.push([Math.cos(a) * R1, 0, Math.sin(a) * R1 * D]); // 1..4 waist
  }
  v.push([0, -0.37, 0]); // 5 diamond bottom
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    v.push([Math.cos(a) * R2, -0.165, Math.sin(a) * R2 * D]); // 6..9 chevron ring
  }
  v.push([0, -1, 0]); // 10 bottom apex
  v.push([0, -0.5, 0]); // 11 chevron inner point
  const edges: [number, number][] = [];
  const faces: number[][] = [];
  for (let k = 0; k < 4; k++) {
    const a = 1 + k;
    const b = 1 + ((k + 1) % 4);
    edges.push([0, a], [a, b], [a, 5]);
    faces.push([0, a, b], [5, a, b]);
    const c = 6 + k;
    const d = 6 + ((k + 1) % 4);
    edges.push([c, 10], [c, 11]);
    faces.push([10, c, d]);
  }
  return { v, edges, faces };
}
const CRYSTAL = crystal();

// ── rendering ───────────────────────────────────────────────────

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;
}
/**
 * Base tint of a capture. Pixel lines glow in their neon colour; the mono (BW)
 * line is grey with only a faint tint (assumption: the only mono original we
 * have, ID-0961 "mono_w", is white — how the other tint letters look is not
 * documented).
 */
function baseHex(tr: SliceTraits): string {
  if (tr.style === "mono")
    return tr.color === "white" || tr.color === "rgb"
      ? MONO_HEX
      : mixHexHex(COLOR_HEX[tr.color], MONO_HEX, 0.7);
  return COLOR_HEX[tr.color];
}
/** Glow colour for an edge (rgb cycles hue along the crystal and over the turn). */
function glowColor(tr: SliceTraits, edge: number, frame: number): string {
  const mono = tr.style === "mono";
  if (tr.color === "rgb") return hsl(edge * 37 + frame * 12, mono ? 22 : 100, mono ? 78 : 60);
  return baseHex(tr);
}
/** Hot core: near-white, faintly tinted. */
function coreColor(tr: SliceTraits, edge: number, frame: number): string {
  if (tr.style === "mono" && tr.color === "white") return "#ffffff";
  if (tr.color === "rgb") return hsl(edge * 37 + frame * 12, tr.style === "mono" ? 20 : 100, 88);
  const [r, g, b] = hexRgb(baseHex(tr));
  const mix = (c: number) => Math.round(c * 0.35 + 255 * 0.65);
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}

const SAMPLE = 512;

/** The pixel resolution each era renders at before it is scaled up (blocky eras). */
export const ERA_RES: Record<Era, number> = {
  8: 28,
  16: 56,
  32: 160,
  64: SAMPLE,
};

/**
 * Draw one slice (frame 0…29) into `canvas` (any size; drawn square).
 * Works on a regular or an Offscreen canvas.
 */
export function renderSlice(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  tr: SliceTraits,
  frame: number,
  opts: { badge?: boolean } = {},
): void {
  const out = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!out) return;
  const size = canvas.width;
  const src = makeCanvas(SAMPLE, SAMPLE);
  const g = src.getContext("2d") as CanvasRenderingContext2D;
  drawCrystal(g, tr, frame);

  out.save();
  out.fillStyle = "#000";
  out.fillRect(0, 0, size, size);
  const res = ERA_RES[tr.era];
  if (res < SAMPLE) {
    // Blocky eras: shrink with smoothing, posterize, grow without smoothing.
    const low = makeCanvas(res, res);
    const lg = low.getContext("2d") as CanvasRenderingContext2D;
    lg.imageSmoothingEnabled = true;
    lg.imageSmoothingQuality = "high";
    lg.drawImage(src as CanvasImageSource, 0, 0, res, res);
    posterize(lg, res, tr.era === 8 ? 5 : tr.era === 16 ? 9 : 24);
    out.imageSmoothingEnabled = false;
    out.drawImage(low as CanvasImageSource, 0, 0, size, size);
    if (tr.era === 16 || tr.era === 32) scanlines(out, size, tr.era === 16 ? 0.22 : 0.12);
  } else {
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = "high";
    out.drawImage(src as CanvasImageSource, 0, 0, size, size);
  }
  if (tr.tier >= 5) glitchBands(out, size, tr, frame);
  if (opts.badge !== false) drawBadge(out, size, tr);
  out.restore();
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function drawCrystal(g: CanvasRenderingContext2D, tr: SliceTraits, frame: number): void {
  const S = SAMPLE;
  const seed = tr.id * 131 + 7;
  const r = rng(seed * 31 + frame);
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);

  const dir = tr.rotation === "CW" ? 1 : -1;
  // Slice 1 of the reference shows the crystal edge-on; +6° per slice. CW =
  // clockwise seen from above (matches the drift of the ID-0961 original).
  const yaw = Math.PI / 2 + (dir * sliceAngle(frame) * Math.PI) / 180;
  const pitch = 0.3;
  // Volatility shakes the whole capture from tier 4 up.
  const shake = tr.tier >= 4 ? (tr.tier - 3) * 5 : 0;
  const cx = S / 2 + (shake ? (r() - 0.5) * shake : 0);
  const cy = S / 2 + (shake ? (r() - 0.5) * shake : 0);
  const scale = S * 0.4;

  // State: 0 steady, I pulses, I/O drops tubes in and out. No stasis breathes the shape.
  const pulse = tr.io === "I" ? 0.72 + 0.28 * Math.sin((frame / FRAMES) * Math.PI * 6) : 1;
  const wobbleAmp = 0.012 + (tr.stasis === "NOS" ? 0.018 : 0) + (tr.tier - 1) * 0.006;
  const wobbleT = tr.stasis === "NOS" ? frame * 0.35 : 0;

  const project = (p: V3): [number, number, number] => {
    const [x, y, z] = p;
    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const x1 = x * cyaw - z * syaw;
    const z1 = x * syaw + z * cyaw;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const persp = 1 / (1 - z2 * 0.12);
    return [cx + x1 * scale * persp, cy - y2 * scale * persp, z2];
  };

  // Background: lens rays (the soft X of the reference) and a centre haze.
  g.save();
  g.globalCompositeOperation = "lighter";
  const mono = tr.style === "mono";
  const glow =
    tr.color === "rgb" ? hsl(200 + frame * 12, mono ? 20 : 90, mono ? 70 : 55) : baseHex(tr);
  const rays = tr.tier >= 3 ? 0.22 : 0.14;
  g.filter = "blur(18px)";
  for (const ang of [-0.95, 0.95, -2.2, 2.2]) {
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    const grad = g.createLinearGradient(0, 0, S * 0.55, 0);
    grad.addColorStop(0, withAlpha(glow, rays * pulse));
    grad.addColorStop(1, withAlpha(glow, 0));
    g.fillStyle = grad;
    g.fillRect(0, -10, S * 0.55, 20);
    g.restore();
  }
  g.filter = "blur(30px)";
  const haze = g.createRadialGradient(cx, cy + 10, 0, cx, cy + 10, S * 0.3);
  haze.addColorStop(0, withAlpha(glow, (0.22 + tr.tier * 0.03) * pulse));
  haze.addColorStop(1, withAlpha(glow, 0));
  g.fillStyle = haze;
  g.fillRect(0, 0, S, S);
  g.filter = "none";

  // Faint haze inside the faces (the smoky fill between the tubes).
  const P = CRYSTAL.v.map(project);
  g.filter = "blur(12px)";
  for (const [fi, f] of CRYSTAL.faces.entries()) {
    const depth = f.reduce((s, i) => s + P[i]![2], 0) / f.length;
    const a = (0.07 + 0.05 * hash(seed + fi)) * (depth > 0 ? 1.3 : 0.8) * pulse;
    g.fillStyle = withAlpha(glow, a);
    g.beginPath();
    f.forEach((i, k) => {
      const [x, y] = P[i]!;
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.closePath();
    g.fill();
  }
  // The light source sits in the waist: a soft hot spot that blooms when the
  // tubes overlap edge-on.
  const [wx, wy] = project([0, -0.08, 0]);
  const edgeOn = Math.abs(Math.cos(yaw));
  g.filter = "blur(22px)";
  const hot = g.createRadialGradient(wx, wy, 0, wx, wy, S * 0.16);
  hot.addColorStop(0, withAlpha(glow, (0.25 + 0.45 * edgeOn) * pulse));
  hot.addColorStop(1, withAlpha(glow, 0));
  g.fillStyle = hot;
  g.fillRect(wx - S * 0.2, wy - S * 0.2, S * 0.4, S * 0.4);
  g.filter = "none";

  // The neon tubes: each edge is a hand-bent polyline (static in stasis).
  const SEG = 24;
  for (const [ei, [a, b]] of CRYSTAL.edges.entries()) {
    if (tr.io === "IO" && hash(seed + ei * 17 + Math.floor(frame / 2) * 101) < 0.28) continue;
    const A = CRYSTAL.v[a]!;
    const B = CRYSTAL.v[b]!;
    const pts: [number, number, number][] = [];
    for (let s = 0; s <= SEG; s++) {
      const k = s / SEG;
      const bend = Math.sin(k * Math.PI);
      // Two octaves: a slow hand-bend and a fine jag.
      const jag = (o: number) =>
        vnoise(seed + ei * 3 + o, k * 3 + wobbleT) * wobbleAmp * bend +
        vnoise(seed + ei * 5 + o + 50, k * 13 + wobbleT * 2) * wobbleAmp * 0.35;
      const p: V3 = [
        A[0] + (B[0] - A[0]) * k + jag(0),
        A[1] + (B[1] - A[1]) * k + jag(1),
        A[2] + (B[2] - A[2]) * k + jag(2),
      ];
      pts.push(project(p));
    }
    const depth = (pts[0]![2] + pts[SEG]![2]) / 2;
    const front = depth > 0 ? 1 : 0.62;
    const bright = (0.75 + 0.25 * hash(seed + ei * 5)) * front * pulse;
    const path = () => {
      g.beginPath();
      pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
    };
    g.lineCap = "round";
    g.lineJoin = "round";
    // wide glow → mid glow → hot core
    const tierGlow = 1 + (tr.tier - 1) * 0.35;
    g.filter = `blur(${Math.round(10 * tierGlow)}px)`;
    g.strokeStyle = withAlpha(glowColor(tr, ei, frame), 0.26 * bright * tierGlow);
    g.lineWidth = 14 * tierGlow;
    path();
    g.stroke();
    g.filter = "blur(2.5px)";
    g.strokeStyle = withAlpha(glowColor(tr, ei, frame), 0.55 * bright);
    g.lineWidth = 5;
    path();
    g.stroke();
    g.filter = "none";
    g.strokeStyle = withAlpha(coreColor(tr, ei, frame), Math.min(1, 1.05 * bright));
    g.lineWidth = depth > 0 ? 2.6 : 1.7;
    path();
    g.stroke();
    // Blown-out beads along the tube (the light-painting drips of the reference).
    if (hash(seed + ei * 11) < 0.35) {
      const k = Math.floor(hash(seed + ei * 13) * SEG);
      const [x, y] = pts[k]!;
      g.fillStyle = withAlpha(coreColor(tr, ei, frame), 0.9 * bright);
      g.beginPath();
      g.arc(x, y, 3.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Volatility 4–5: stray sparks and loose tube fragments.
  if (tr.tier >= 4) {
    const n = tr.tier === 4 ? 6 : 22;
    g.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * S * 0.62;
      const y = cy + (r() - 0.5) * S * 0.8;
      const len = 6 + r() * (tr.tier === 5 ? 30 : 14);
      const ang = r() * Math.PI * 2;
      g.strokeStyle = withAlpha(coreColor(tr, i, frame), 0.5 + r() * 0.5);
      g.filter = "blur(1px)";
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.lineTo(x + Math.cos(ang + 1.2) * len * 0.6, y + Math.sin(ang + 1.2) * len * 0.6);
      g.stroke();
    }
    g.filter = "none";
  }
  g.restore();

  // Capture artefacts: two faint vertical sensor lines.
  g.fillStyle = "rgba(255,255,255,0.035)";
  g.fillRect(Math.round(S * 0.445), 0, 1, S);
  g.fillRect(Math.round(S * 0.865), 0, 1, S);
  // Film grain.
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.06})`;
    g.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1, 1);
  }
}

function withAlpha(color: string, a: number): string {
  const al = Math.max(0, Math.min(1, a));
  if (color.startsWith("#")) {
    const [r, g, b] = hexRgb(color);
    return `rgb(${r} ${g} ${b} / ${al})`;
  }
  if (color.startsWith("hsl(")) return color.replace(")", ` / ${al})`);
  if (color.startsWith("rgb(")) return color.replace(")", ` / ${al})`);
  return color;
}

function posterize(g: CanvasRenderingContext2D, res: number, levels: number): void {
  const img = g.getImageData(0, 0, res, res);
  const d = img.data;
  const q = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i]! / q) * q;
    d[i + 1] = Math.round(d[i + 1]! / q) * q;
    d[i + 2] = Math.round(d[i + 2]! / q) * q;
  }
  g.putImageData(img, 0, 0);
}

function scanlines(g: CanvasRenderingContext2D, size: number, a: number): void {
  g.fillStyle = `rgba(0,0,0,${a})`;
  const step = Math.max(2, Math.round(size / 128));
  for (let y = 0; y < size; y += step * 2) g.fillRect(0, y, size, step);
}

/** Tier 5: horizontal tearing — bands of the image slide sideways. */
function glitchBands(
  g: CanvasRenderingContext2D,
  size: number,
  tr: SliceTraits,
  frame: number,
): void {
  const r = rng(tr.id * 977 + frame * 13);
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const h = Math.max(2, Math.floor(size * (0.01 + r() * 0.05)));
    const y = Math.floor(r() * (size - h));
    const dx = Math.round((r() - 0.5) * size * 0.12);
    const band = g.getImageData(0, y, size, h);
    g.putImageData(band, dx, y);
  }
}

/** The little pixel face in the corner of every capture (7 × 6 cells). */
const BADGE = [".####.", "#o####", "######", "#oo#o#", "######", ".####."];
function drawBadge(g: CanvasRenderingContext2D, size: number, tr: SliceTraits): void {
  const cell = Math.max(1, Math.round(size / 96));
  const w = cell * 6;
  const x0 = Math.round(size * 0.925 - w / 2);
  const y0 = Math.round(size * 0.925 - w / 2);
  const tint =
    tr.style === "mono"
      ? "#7c7c7c"
      : tr.color === "rgb"
        ? "#8a8a8a"
        : mixHex(COLOR_HEX[tr.color], "#7c7c7c", 0.7);
  BADGE.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === ".") return;
      g.fillStyle = c === "o" ? "#ffffff" : tint;
      g.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
    }),
  );
}
function mixHex(a: string, b: string, k: number): string {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const m = A.map((v, i) => Math.round(v * (1 - k) + B[i]! * k));
  return `rgb(${m[0]} ${m[1]} ${m[2]})`;
}
/** Like mixHex, but returns `#rrggbb` (usable as a base colour). */
function mixHexHex(a: string, b: string, k: number): string {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const hex = A.map((v, i) =>
    Math.round(v * (1 - k) + B[i]! * k)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${hex.join("")}`;
}

// ── variants ────────────────────────────────────────────────────

/** Released capture eras per style (the 8-bit IDs were never released). */
const ERAS: Record<SliceStyle, readonly Era[]> = { mono: [64], px: [16, 32, 64] };

/** A random released variant (style, colour, tier, state, era, direction). */
export function randomTraits(rand: () => number = Math.random): SliceTraits {
  const pick = <T>(xs: readonly T[]): T =>
    xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))]!;
  const style: SliceStyle = rand() < 0.2 ? "mono" : "px";
  return {
    id: 1 + Math.floor(rand() * 1120),
    style,
    color: pick(COLORS),
    tier: pick([1, 2, 3, 4, 5] as const),
    rotation: rand() < 0.5 ? "CW" : "CCW",
    stasis: rand() < 0.5 ? "S" : "NOS",
    io: pick(["O", "I", "IO"] as const),
    era: pick(ERAS[style]),
  };
}

/** Release phase / production line of a style: P01 mono, P02 pure, P03 RGB. */
export function captureLabel(tr: Pick<SliceTraits, "style" | "color">): "mono" | "pure" | "RGB" {
  if (tr.style === "mono") return "mono";
  return tr.color === "rgb" ? "RGB" : "pure";
}

/** Short trait code, e.g. "T3 · I/O · 32 bit · CW" (colour and style are named separately). */
export function traitCode(tr: SliceTraits): string {
  const io = tr.io === "IO" ? "I/O" : tr.io;
  return `T${tr.tier} · ${io} · ${tr.era} bit · ${tr.rotation}`;
}

// ── Capture names (release convention, as in the undevbook) ─────

/** Release date of the captures (YYMMDD). */
export const RELEASE_DATE = "180307";

/** Tint letter of a colour in capture file names. */
export const COLOR_LETTER: Record<SliceColor, string> = {
  white: "w",
  green: "g",
  yellow: "y",
  blue: "b",
  purple: "p",
  red: "r",
  orange: "o",
  rgb: "rgb",
};

/**
 * Capture file name (no extension), e.g.
 * `usc_unETH_ID-0089_P02_L02_pure_o_T2_64bit_CW_O_180307` — see the
 * undevbook's `captureName` for the full convention.
 */
export function captureName(tr: SliceTraits, date = RELEASE_DATE): string {
  const mono = tr.style === "mono";
  const rgb = !mono && tr.color === "rgb";
  const phase = mono ? "P01_L01" : rgb ? "P03_L04" : "P02_L02";
  const style = rgb ? "RGB" : `${mono ? "mono" : "pure"}_${COLOR_LETTER[tr.color]}`;
  const bit = mono ? "" : `_${tr.era}bit`;
  const id = String(tr.id).padStart(4, "0");
  return `usc_unETH_ID-${id}_${phase}_${style}_T${tr.tier}${bit}_${tr.rotation}_${tr.io}_${date}`;
}

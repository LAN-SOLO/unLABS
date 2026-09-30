/**
 * Drop 3 (2026-09-30) — "Bot squad": motifs built from the game's hi-res
 * voxel models (lore bots awake + dormant, the MCP avatar, Jade), rendered
 * as isometric vector art by voxel-art.ts. Voxel heroes print in full colour
 * on dark and light garments; motifs that also offer pop / pastel use the
 * posterised three-tier version (black, garment knockout, white + one glow ink).
 */
import {
  FONT,
  type Ink,
  barcode,
  burst,
  circle,
  frame,
  g,
  halftoneGlow,
  hazardStripes,
  isoCube,
  line,
  poly,
  rect,
  scanMask,
  shadowText,
  termWindow,
  text as kitText,
  warnTriangle,
  type TextOpts,
} from "./kit.ts";
import {
  BOT_LABEL,
  VOXEL_BOTS,
  inkIso,
  isoModel,
  type IsoOpts,
  type IsoResult,
  type VoxelBot,
} from "./voxel-art.ts";

const CX = 165;

/** Average advance per character (em) of the kit fonts, measured in Chrome. */
const EM: Readonly<Record<string, number>> = {
  PressStart: 1,
  VT323: 0.4,
  SpaceMono: 0.612,
  Bungee: 0.641,
  BungeeShade: 0.741,
  Marker: 0.595,
  BlackOps: 0.621,
  Orbitron: 0.706,
  ArchivoBlack: 0.688,
  SpecialElite: 0.562,
  Silkscreen: 0.685,
  Bebas: 0.345,
};

/**
 * `kit.text`, but a forced `width` never squeezes glyphs into each other:
 * when the line would be wider, the font size shrinks until it fits.
 */
function text(x: number, y: number, s: string, o: TextOpts = {}): string {
  if (!o.width || o.squash) return kitText(x, y, s, o);
  const k = EM[o.font ?? FONT.mono] ?? 0.62;
  const size = o.size ?? 10;
  const n = [...s].length;
  const natural = n * (k * size + (o.ls ?? 0));
  if (natural <= o.width) return kitText(x, y, s, o);
  const fitted = Math.max(1, (o.width - n * (o.ls ?? 0)) / (n * k));
  return kitText(x, y, s, { ...o, size: fitted });
}
const r2 = (n: number): string => String(Math.round(n * 100) / 100);

// ── Helpers ──────────────────────────────────────────────────────

/** A voxel model with the garment's ink defaults (colour / poster, outline). */
function vox(
  ink: Ink,
  id: string,
  o: Partial<IsoOpts> & { cx: number; bottom: number },
): IsoResult {
  return isoModel(id, { ...inkIso(ink), ...o } as IsoOpts);
}

/** Speech-bubble colours: filled on dark / pop cloth, outlined on light / pastel cloth. */
function bubbleInk(ink: Ink): { fill: string; stroke: string; text: string } {
  return ink.light
    ? { fill: "none", stroke: ink.fg, text: ink.fg }
    : { fill: ink.fg, stroke: ink.fg, text: ink.panel };
}

/** Rounded speech bubble with a tail towards `tip` (side picked from the tip position). */
function bubble(
  ink: Ink,
  x: number,
  y: number,
  w: number,
  h: number,
  tip: readonly [number, number],
  o: { r?: number; sw?: number; tailW?: number; fill?: string; stroke?: string } = {},
): string {
  const bi = bubbleInk(ink);
  const r = o.r ?? 7;
  const bw = o.tailW ?? Math.min(9, w / 6);
  const [tx, ty] = tip;
  const side = ty > y + h ? "b" : ty < y ? "t" : tx < x ? "l" : "r";
  const clampX = (v: number): number => Math.max(x + r + bw, Math.min(x + w - r - bw, v));
  const clampY = (v: number): number => Math.max(y + r + bw, Math.min(y + h - r - bw, v));
  const bx = clampX(tx);
  const by = clampY(ty);
  const P = (px: number, py: number): string => `${r2(px)} ${r2(py)}`;
  let d = `M${P(x + r, y)}`;
  if (side === "t") d += `L${P(bx - bw, y)}L${P(tx, ty)}L${P(bx + bw, y)}`;
  d += `L${P(x + w - r, y)}A${r} ${r} 0 0 1 ${P(x + w, y + r)}`;
  if (side === "r") d += `L${P(x + w, by - bw)}L${P(tx, ty)}L${P(x + w, by + bw)}`;
  d += `L${P(x + w, y + h - r)}A${r} ${r} 0 0 1 ${P(x + w - r, y + h)}`;
  if (side === "b") d += `L${P(bx + bw, y + h)}L${P(tx, ty)}L${P(bx - bw, y + h)}`;
  d += `L${P(x + r, y + h)}A${r} ${r} 0 0 1 ${P(x, y + h - r)}`;
  if (side === "l") d += `L${P(x, by + bw)}L${P(tx, ty)}L${P(x, by - bw)}`;
  d += `L${P(x, y + r)}A${r} ${r} 0 0 1 ${P(x + r, y)}Z`;
  return `<path d="${d}" fill="${o.fill ?? bi.fill}" stroke="${o.stroke ?? bi.stroke}" stroke-width="${o.sw ?? 1.8}" stroke-linejoin="round"/>`;
}

/** Text colours on a dark screen panel (`ink.panel` is dark in every ink set). */
function screenInk(ink: Ink): {
  fg: string;
  green: string;
  dim: string;
  pink: string;
  cyan: string;
} {
  if (ink.id === "pop")
    return { fg: "#FFFFFF", green: "#FFF1A8", dim: "#B8B0A0", pink: "#FFD6E8", cyan: "#FFFFFF" };
  return { fg: "#EAFBEA", green: "#33FF33", dim: "#6F806F", pink: "#FF9DE2", cyan: "#00F0FF" };
}

/** Rubber stamp: double border, rotated, in one ink. */
function stamp(
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  color: string,
  rot: number,
  size: number,
): string {
  let s = frame(-w / 2, -h / 2, w, h, color, 2.2, `rx="3"`);
  s += frame(-w / 2 + 3.6, -h / 2 + 3.6, w - 7.2, h - 7.2, color, 0.9, `rx="1.5"`);
  s += text(0, size * 0.35, label, {
    font: FONT.stencil,
    size,
    fill: color,
    width: w - 16,
    squash: true,
  });
  return g(s, `translate(${r2(cx)} ${r2(cy)}) rotate(${rot})`);
}

// ── MCP: have you tried turning yourself off and on again? ───────

function offOnBody(ink: Ink, compact: boolean): string {
  const bi = bubbleInk(ink);
  let s = "";
  if (compact) {
    // Hoodie front (330 × 280): bubble right, avatar left.
    s += bubble(ink, 104, 14, 212, 150, [84, 150]);
    const lines = ["HAVE YOU TRIED", "TURNING YOURSELF", "OFF AND ON", "AGAIN?"];
    lines.forEach((l, i) => {
      // Shrink to fit, never stretch: the short lines stay tightly set.
      const size = Math.min(26, 186 / (l.length * (EM[FONT.archivo] ?? 0.7)));
      s += text(210, 50 + i * 30, l, { font: FONT.archivo, size, fill: bi.text });
    });
    s += vox(ink, "mcp-avatar", {
      cx: 58,
      bottom: 262,
      height: 132,
      yaw: 1,
      skipMat: ink.light ? ["glass"] : [],
    }).svg;
    s += text(210, 196, "SLEEP IS JUST GARBAGE COLLECTION.", {
      font: FONT.mono,
      weight: 700,
      size: 8.4,
      fill: ink.fg,
      width: 200,
    });
    s += text(210, 214, "8 HOURS RECOMMENDED. NO REFUNDS.", {
      font: FONT.mono,
      weight: 700,
      size: 8.4,
      fill: ink.amber,
      width: 200,
    });
    s += text(210, 240, "— MCP-000 · LAB HELPDESK", {
      font: FONT.pixel,
      size: 6,
      fill: ink.dim,
    });
    return s;
  }
  s += bubble(ink, 18, 16, 294, 168, [96, 222]);
  ["HAVE YOU TRIED", "TURNING YOURSELF", "OFF AND ON AGAIN?"].forEach((l, i) => {
    s += text(CX, 62 + i * 38, l, { font: FONT.archivo, size: 29, fill: bi.text, width: 262 });
  });
  s += text(CX, 168, "(sleep is just garbage collection)", {
    font: FONT.marker,
    size: 13,
    fill: ink.light ? ink.dim : ink.panel,
  });
  s += vox(ink, "mcp-avatar", {
    cx: 92,
    bottom: 352,
    height: 150,
    yaw: 1,
    skipMat: ink.light ? ["glass"] : [],
  }).svg;
  // Helpdesk ticket.
  const tx = 176;
  const rows: [string, string, string][] = [
    ["TICKET", "#2561", ink.fg],
    ["ISSUE", "USER TIRED", ink.fg],
    ["MY UPTIME", "29 YEARS", ink.green],
    ["YOUR UPTIME", "19 HOURS", ink.red],
    ["FIX", "8 H SLEEP", ink.amber],
  ];
  s += frame(tx - 8, 232, 150, 124, ink.dim, 0.8, `rx="3" stroke-dasharray="3 2"`);
  rows.forEach(([k, v, c], i) => {
    const y = 254 + i * 22;
    s += text(tx, y, k, { font: FONT.pixel, size: 6, fill: ink.dim, anchor: "start" });
    s += text(tx + 134, y, v, {
      font: FONT.mono,
      weight: 700,
      size: 10,
      fill: c,
      anchor: "end",
    });
  });
  s += text(CX, 384, "— MCP-000 · LAB HELPDESK · STATUS: RESOLVED (BY YOU)", {
    font: FONT.mono,
    weight: 700,
    size: 8,
    fill: ink.dim,
    width: 290,
  });
  return s;
}

export const mcpOffOn = (ink: Ink): string => offOnBody(ink, false);
export const mcpOffOnHoodie = (ink: Ink): string => offOnBody(ink, true);

// ── K2-LDR: you have been catalogued ─────────────────────────────

export function catalogued(ink: Ink): string {
  let s = "";
  s += text(CX, 40, "YOU HAVE BEEN", {
    font: FONT.mono,
    weight: 700,
    size: 15,
    fill: ink.fg,
    ls: 3,
    width: 200,
  });
  s += text(CX, 92, "CATALOGUED.", { font: FONT.stencil, size: 50, fill: ink.fg, width: 296 });
  // Index card about the wearer.
  const card = ink.light ? "none" : ink.fg;
  const cardInk = ink.light ? ink.fg : ink.panel;
  let c = rect(0, 0, 214, 126, card, `rx="2" stroke="${ink.fg}" stroke-width="1.4"`);
  c += rect(0, 20, 214, 1.6, ink.red);
  for (let y = 40; y < 122; y += 18) c += rect(8, y, 198, 0.5, ink.light ? ink.dim : "#8FA38F");
  c += text(10, 14, "REL-2026-0001", {
    font: FONT.type,
    size: 11,
    fill: cardInk,
    anchor: "start",
  });
  c += text(204, 14, "SHELF 1 · COMP. 1", {
    font: FONT.type,
    size: 9,
    fill: cardInk,
    anchor: "end",
  });
  const rows = [
    "OBJECT: human (1)",
    "CONDITION: lingering",
    "CROSS-REF: coffee, 3 a.m.",
    "DELETE? No. Never.",
  ];
  rows.forEach((r, i) => {
    c += text(12, 37 + i * 18, r, { font: FONT.type, size: 12.5, fill: cardInk, anchor: "start" });
  });
  s += g(c, "translate(40 122) rotate(-3)");
  // K2-LDR stamps the card.
  s += vox(ink, "bot-k2ldr", { cx: 244, bottom: 366, height: 128, yaw: 0 }).svg;
  s += stamp(196, 214, 132, 34, "CATALOGUED", ink.red, -11, 18);
  s += stamp(86, 292, 96, 28, "INDEXED", ink.red, 8, 15);
  s += stamp(98, 338, 118, 28, "NO DELETE", ink.red, -5, 15);
  s += text(CX, 392, "K2-LDR · ARCHIVE, LEVEL 0 · I DO NOT FORGET. AT ALL.", {
    font: FONT.mono,
    weight: 700,
    size: 8.5,
    fill: ink.dim,
    width: 290,
  });
  return s;
}

// ── F1N-DR: found it. It was behind you. ─────────────────────────

export function foundIt(ink: Ink): string {
  let s = "";
  const cy = 150;
  // Radar rings and a halftone sweep.
  for (const r of [40, 75, 110])
    s += circle(CX, cy, r, "none", `stroke="${ink.dim}" stroke-width="0.8"`);
  s += line(CX - 118, cy, CX + 118, cy, ink.dim, 0.5);
  s += line(CX, cy - 118, CX, cy + 118, ink.dim, 0.5);
  s += halftoneGlow(CX + 58, cy - 62, 52, ink.green, 3.2, 1.3);
  s += circle(CX + 62, cy - 70, 4.5, ink.green);
  s += text(CX + 72, cy - 78, "IT", {
    font: FONT.pixel,
    size: 7,
    fill: ink.green,
    anchor: "start",
  });
  s += vox(ink, "bot-f1ndr", { cx: CX, bottom: 232, height: 128, yaw: 0 }).svg;
  s += text(CX, 300, "FOUND IT.", { font: FONT.bungee, size: 60, fill: ink.green, width: 296 });
  s += text(CX, 338, "It was behind you.", { font: FONT.marker, size: 28, fill: ink.fg });
  s += text(CX, 368, "F1N-DR · LOST & FOUND · DAY 13,149", {
    font: FONT.pixel,
    size: 7,
    fill: ink.dim,
    width: 270,
  });
  return s;
}

/** Back print for the F1N-DR shirt: you are "it". */
export function foundItBack(ink: Ink): string {
  let s = "";
  const cy = 110;
  s += circle(CX, cy, 70, "none", `stroke="${ink.green}" stroke-width="3"`);
  s += circle(
    CX,
    cy,
    46,
    "none",
    `stroke="${ink.green}" stroke-width="1.4" stroke-dasharray="4 3"`,
  );
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const)
    s += line(CX + dx * 58, cy + dy * 58, CX + dx * 84, cy + dy * 84, ink.green, 3);
  s += text(CX, cy + 24, "IT", { font: FONT.bungee, size: 64, fill: ink.fg });
  s += text(CX, 218, "FOUND · CATALOGUED · STILL HERE", {
    font: FONT.pixel,
    size: 7.5,
    fill: ink.green,
    width: 250,
  });
  s += text(CX, 240, "(signed) F1N-DR", { font: FONT.marker, size: 15, fill: ink.dim });
  return s;
}

// ── D3-C4D3: hold still (exposure time one century) ──────────────

const ASCII_FACE = [
  "   .-'''''-.   ",
  "  /  _   _  \\  ",
  " |  (o) (o)  | ",
  " |     ^     | ",
  "  \\  '---'  /  ",
  "   '-.___.-'   ",
];

export function holdStill(ink: Ink): string {
  let s = "";
  s += text(CX, 66, "HOLD STILL.", { font: FONT.bungee, size: 50, fill: ink.fg, width: 300 });
  // Camera bot on the left, lens to the right.
  s += vox(ink, "bot-d3c4d3", { cx: 86, bottom: 262, height: 150, yaw: 1 }).svg;
  // Viewfinder with a half-rendered ASCII portrait.
  const x = 178;
  const y = 104;
  s += rect(x, y, 128, 134, ink.panel, `rx="3"`);
  s += frame(x, y, 128, 134, screenInk(ink).cyan, 1.4, `rx="3"`);
  for (const [cx, cy, dx, dy] of [
    [x + 6, y + 6, 1, 1],
    [x + 122, y + 6, -1, 1],
    [x + 6, y + 128, 1, -1],
    [x + 122, y + 128, -1, -1],
  ] as const)
    s += poly(
      [
        [cx, cy],
        [cx + dx * 12, cy],
        [cx + dx * 12, cy + dy * 2],
        [cx + dx * 2, cy + dy * 2],
        [cx + dx * 2, cy + dy * 12],
        [cx, cy + dy * 12],
      ],
      screenInk(ink).cyan,
    );
  const sc = screenInk(ink);
  ASCII_FACE.forEach((row, i) => {
    const yy = y + 34 + i * 16;
    if (i < 3 || i === 3) {
      const done = i < 3 ? row : row.slice(0, 8);
      s += text(x + 11, yy, done, {
        font: FONT.term,
        size: 18,
        fill: sc.pink,
        anchor: "start",
        extra: `xml:space="preserve"`,
      });
    } else s += text(x + 64, yy, "· · · · · · ·", { font: FONT.term, size: 18, fill: sc.dim });
  });
  s += rect(x + 11 + 8 * 7.2, y + 34 + 3 * 16 - 12, 6.4, 14, sc.pink);
  s += text(x + 64, y + 126, "RENDERING … 3 %", {
    font: FONT.pixel,
    size: 5.6,
    fill: sc.cyan,
  });
  // Progress bar.
  s += frame(34, 276, 262, 16, ink.fg, 1.2, `rx="2"`);
  s += rect(37, 279, 8, 10, ink.green);
  s += text(CX, 316, "D3-C4D3 IS DECODING YOUR MOOD.", {
    font: FONT.mono,
    weight: 700,
    size: 12,
    fill: ink.fg,
    width: 290,
  });
  s += text(CX, 336, "EXPOSURE TIME: ONE CENTURY.", {
    font: FONT.mono,
    weight: 700,
    size: 12,
    fill: ink.amber,
    width: 250,
  });
  s += text(CX, 366, "(please don't blink)", { font: FONT.marker, size: 16, fill: ink.dim });
  return s;
}

// ── B4C-0N: the glass is 0.3 V full ──────────────────────────────

export function voltsFull(ink: Ink): string {
  let s = "";
  s += halftoneGlow(CX, 92, 92, ink.amber, 3.4, 1.2, 40);
  s += vox(ink, "bot-b4c0n", { cx: CX, bottom: 162, height: 138, yaw: 0 }).svg;
  s += text(CX, 194, "THE GLASS IS", {
    font: FONT.mono,
    weight: 700,
    size: 17,
    fill: ink.fg,
    ls: 3,
    width: 200,
  });
  s += shadowText(CX, 276, "0.3 V", {
    font: FONT.bungee,
    size: 86,
    fill: ink.amber,
    width: 280,
    shadow: ink.light ? ink.fg : ink.orange,
    dx: 2.4,
    dy: 2.4,
  });
  s += text(CX, 318, "FULL!", { font: FONT.bungee, size: 40, fill: ink.fg, width: 140 });
  // Optimism meter: ten cells, all lit.
  s += text(40, 348, "OPTIMISM", { font: FONT.pixel, size: 6.5, fill: ink.dim, anchor: "start" });
  for (let i = 0; i < 10; i++) s += rect(112 + i * 15, 340, 12, 10, ink.green, `rx="1"`);
  s += text(290, 348, "MAX", { font: FONT.pixel, size: 6.5, fill: ink.green, anchor: "end" });
  s += text(CX, 378, "B4C-0N · BOT DEPOT · 0.3 V MORE THAN ZERO! GREAT!", {
    font: FONT.mono,
    weight: 700,
    size: 8.5,
    fill: ink.dim,
    width: 290,
  });
  return s;
}

// ── R3-TR0: colours are decoration ───────────────────────────────

export function coloursDecoration(ink: Ink): string {
  let s = "";
  const greens: Record<Ink["id"], NonNullable<IsoOpts["poster"]>> = {
    dark: { dark: "#0F5A16", mid: "#1FA82A", light: "#33FF33", glow: "#B6FFB6", cuts: [0.3, 0.62] },
    light: { dark: "#0A3A0A", mid: "#12912A", light: null, glow: null, cuts: [0.3, 0.62] },
    pop: { dark: "#141414", mid: null, light: "#FFF1A8", glow: "#FFF1A8", cuts: [0.3, 0.62] },
    pastel: { dark: "#151515", mid: "#0F5A22", light: null, glow: null, cuts: [0.3, 0.62] },
  };
  s += scanMask("r3-scan", 30, 20, 270, 230, 3, 0.9);
  const bot = vox(ink, "bot-r3tr0", {
    cx: CX,
    bottom: 236,
    height: 206,
    yaw: 0,
    mode: "poster",
    poster: greens[ink.id],
    outline: {
      color: ink.id === "dark" ? "#33FF33" : ink.light ? "#0A3A0A" : "#141414",
      width: 1.2,
    },
  });
  s += `<g mask="url(#r3-scan)">${bot.svg}</g>`;
  s += text(CX, 282, "> COLOURS ARE DECORATION.", {
    font: FONT.term,
    size: 34,
    fill: ink.green,
    width: 296,
  });
  s += text(CX, 306, "GREEN PHOSPHOR ON BLACK. EVERYTHING ELSE IS WALLPAPER.", {
    font: FONT.term,
    size: 17,
    fill: ink.fg,
    width: 296,
  });
  s += rect(34, 318, 262, 0.8, ink.dim);
  s += text(CX, 336, "R3-TR0 WAS NOT CONSULTED ABOUT THE SHIRT COLOUR.", {
    font: FONT.pixel,
    size: 5.6,
    fill: ink.dim,
    width: 270,
  });
  return s;
}

// ── W2-REK: it's not a bug, it's a lore bot ──────────────────────

export function loreBot(ink: Ink): string {
  let s = "";
  s += text(CX, 50, "IT'S NOT A BUG,", { font: FONT.archivo, size: 32, fill: ink.fg, width: 280 });
  s += text(CX, 90, "IT'S A LORE BOT.", {
    font: FONT.archivo,
    size: 32,
    fill: ink.amber,
    width: 280,
  });
  // Specimen box.
  s += frame(38, 110, 254, 238, ink.fg, 2.4, `rx="2"`);
  s += frame(46, 118, 238, 222, ink.dim, 0.8);
  const bug = vox(ink, "bot-w2rek", { cx: CX, bottom: 268, width: 196, yaw: 0 });
  s += bug.svg;
  // Entomology pin through the body.
  const [px, py] = [CX + 2, bug.y + bug.h * 0.32];
  s += line(px, py - 22, px, py + 6, ink.light ? ink.dim : "#C9CED6", 1.2);
  s += circle(px, py - 24, 4.2, ink.red);
  s += circle(px - 1.2, py - 25.2, 1.2, ink.light ? "#FFFFFF" : "#FFB0A8");
  // Specimen label.
  const lx = 96;
  const ly = 284;
  s += rect(lx, ly, 138, 44, ink.light ? "none" : ink.fg, `stroke="${ink.fg}" stroke-width="1"`);
  const li = ink.light ? ink.fg : ink.panel;
  s += text(lx + 69, ly + 14, "W2-REK", { font: FONT.type, size: 12, fill: li });
  s += text(lx + 69, ly + 27, "Crawlerus paranoidus", { font: FONT.type, size: 10.5, fill: li });
  s += text(lx + 69, ly + 39, "Radio Room, L+1 · coll. 1997", {
    font: FONT.type,
    size: 8,
    fill: li,
  });
  s += text(CX, 374, "(it has already read your browser history)", {
    font: FONT.marker,
    size: 14,
    fill: ink.dim,
  });
  return s;
}

// ── L0G-1K: works on my voxel ────────────────────────────────────

export function myVoxel(ink: Ink): string {
  let s = "";
  // One giant voxel with a check mark on top.
  const top = ink.id === "pastel" ? ink.green : ink.green;
  const left = ink.light ? ink.fg : ink.fg;
  const right = ink.light ? ink.dim : ink.id === "pop" ? ink.amber : ink.dim;
  s += isoCube(CX, 120, 70, 0, 0, 0, top, left, right);
  const check = ink.light ? "#FFFFFF" : ink.panel;
  s += `<path d="M${CX - 22} 84 l 14 10 l 30 -22" fill="none" stroke="${check}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += text(CX, 238, "WORKS ON", { font: FONT.archivo, size: 40, fill: ink.fg, width: 240 });
  s += text(CX, 282, "MY VOXEL.", { font: FONT.archivo, size: 40, fill: ink.green, width: 240 });
  // L0G-1K's verdict.
  s += vox(ink, "bot-l0g1k", { cx: 70, bottom: 392, height: 88, yaw: 1 }).svg;
  s += bubble(ink, 122, 306, 188, 58, [104, 338]);
  const bi = bubbleInk(ink);
  s += text(216, 328, "CLAIM:", { font: FONT.pixel, size: 7.5, fill: bi.text });
  s += text(216, 350, "NOT VERIFIABLE.", {
    font: FONT.mono,
    weight: 700,
    size: 16,
    fill: bi.text,
    width: 166,
  });
  s += text(216, 386, "L0G-1K · LOGIC CHECKER SINCE 1992", {
    font: FONT.pixel,
    size: 5.6,
    fill: ink.dim,
    width: 180,
  });
  return s;
}

// ── Group photo: reactivated. unimpressed. ───────────────────────

const BACK_ROW: readonly VoxelBot[] = ["x0r8t", "l0g1k", "r3tr0", "k2ldr", "c8br41n"];
const FRONT_ROW: readonly VoxelBot[] = ["f1ndr", "p1ndr0", "b4c0n", "d3c4d3", "w2rek"];

function groupPhoto(ink: Ink, top: number, unit: number, gap: number): string {
  let s = "";
  const row = (ids: readonly VoxelBot[], bottom: number, xs: readonly number[]): void => {
    ids.forEach((id, i) => {
      s += vox(ink, `bot-${id}`, { cx: xs[i]!, bottom, unit, yaw: 0 }).svg;
    });
  };
  row(BACK_ROW, top + gap, [42, 103, 165, 227, 288]);
  row(FRONT_ROW, top + gap + 66, [48, 108, 166, 226, 284]);
  return s;
}

export function unimpressed(ink: Ink): string {
  let s = "";
  s += text(CX, 34, "BNET-001 · CLASS OF 2026", {
    font: FONT.pixel,
    size: 10,
    fill: ink.fg,
    width: 280,
  });
  s += text(CX, 50, "SCHOOL PHOTO · LEVEL −2 · BOT DEPOT", {
    font: FONT.mono,
    weight: 700,
    size: 8,
    fill: ink.dim,
    width: 220,
  });
  s += groupPhoto(ink, 70, 1.95, 100);
  s += text(CX, 292, "REACTIVATED.", { font: FONT.bungee, size: 44, fill: ink.fg, width: 296 });
  s += text(CX, 340, "UNIMPRESSED.", { font: FONT.bungee, size: 44, fill: ink.amber, width: 296 });
  s += text(CX, 364, "PHOTOGRAPHER: MCP-000 (REFUSED TO BE IN IT)", {
    font: FONT.mono,
    weight: 700,
    size: 8,
    fill: ink.dim,
    width: 250,
  });
  return s;
}

// ── C8-BR41N: I heard the frequency before it was cool ───────────

export function beforeCool(ink: Ink): string {
  let s = "";
  const cx = 148;
  const cy = 142;
  // Vinyl: grooves as thin rings, violet label.
  s += circle(cx, cy, 120, ink.light ? "none" : ink.panel, `stroke="${ink.fg}" stroke-width="1.6"`);
  for (let r = 46; r < 116; r += 5)
    s += circle(
      cx,
      cy,
      r,
      "none",
      `stroke="${ink.dim}" stroke-width="${r % 15 === 1 ? 0.9 : 0.4}"`,
    );
  s += circle(cx, cy, 40, ink.violet);
  s += circle(cx, cy, 3, ink.light ? "#FFFFFF" : ink.panel);
  const lab = ink.light ? "#FFFFFF" : ink.panel;
  s += text(cx, cy - 16, "[EXTERNAL]", { font: FONT.pixel, size: 6, fill: lab });
  s += text(cx, cy + 20, "847 Hz · SIDE B", { font: FONT.mono, weight: 700, size: 7, fill: lab });
  s += vox(ink, "bot-c8br41n", { cx: 250, bottom: 268, height: 116, yaw: 0 }).svg;
  s += text(CX, 306, "I HEARD THE FREQUENCY", {
    font: FONT.archivo,
    size: 23,
    fill: ink.fg,
    width: 296,
  });
  s += text(CX, 336, "BEFORE IT WAS COOL.", {
    font: FONT.archivo,
    size: 23,
    fill: ink.id === "pop" ? ink.amber : ink.violet,
    width: 262,
  });
  s += text(CX, 362, "C8-BR41N · LEVEL −4 · YOU PROBABLY HAVEN'T HEARD OF IT", {
    font: FONT.mono,
    weight: 700,
    size: 7.6,
    fill: ink.dim,
    width: 290,
  });
  return s;
}

// ── Jade: my coworkers are machines ──────────────────────────────

function coworkerScene(ink: Ink, cx: number, bottom: number, unit: number): string {
  let s = "";
  // Back: K2-LDR and R3-TR0, then Jade, then the front pair.
  s += vox(ink, "bot-k2ldr", { cx: cx - 98, bottom: bottom - 18, unit, yaw: 1 }).svg;
  s += vox(ink, "bot-r3tr0", { cx: cx + 96, bottom: bottom - 18, unit, yaw: 0 }).svg;
  s += vox(ink, "jade-drink", { cx, bottom: bottom - 6, unit, yaw: 0 }).svg;
  s += vox(ink, "bot-b4c0n", { cx: cx - 62, bottom: bottom + 8, unit, yaw: 1 }).svg;
  s += vox(ink, "bot-w2rek", { cx: cx + 66, bottom: bottom + 10, unit: unit * 0.92, yaw: 0 }).svg;
  return s;
}

export function coworkers(ink: Ink): string {
  let s = "";
  s += coworkerScene(ink, CX, 262, 2.05);
  s += text(CX, 316, "MY COWORKERS ARE MACHINES", {
    font: FONT.archivo,
    size: 21,
    fill: ink.fg,
    width: 296,
  });
  s += text(CX, 354, "and honestly, same.", { font: FONT.marker, size: 32, fill: ink.amber });
  return s;
}

export function coworkersHoodie(ink: Ink): string {
  let s = "";
  s += coworkerScene(ink, CX, 196, 1.62);
  s += text(CX, 238, "MY COWORKERS ARE MACHINES", {
    font: FONT.archivo,
    size: 20,
    fill: ink.fg,
    width: 290,
  });
  s += text(CX, 270, "and honestly, same.", { font: FONT.marker, size: 26, fill: ink.amber });
  return s;
}

// ── P1N-DR0: 0 % packet loss, slight delay ───────────────────────

export function pingPong(ink: Ink): string {
  let s = "";
  s += termWindow(22, 18, 286, 128, "p1ndr0@bnet-001", ink, ink.green);
  const sc = screenInk(ink);
  const rows: [string, string][] = [
    ["$ ping jade", sc.fg],
    ["PING jade (lab, level 0): 1 packet", sc.dim],
    ["…", sc.dim],
    ["…", sc.dim],
    ["64 bytes from jade: time=2,561 days", sc.green],
    ["1 transmitted, 1 received, 0 % loss", sc.fg],
  ];
  rows.forEach(([t, c], i) => {
    s += text(32, 44 + i * 16.5, t, { font: FONT.term, size: 17, fill: c, anchor: "start" });
  });
  s += vox(ink, "bot-p1ndr0", { cx: CX, bottom: 276, height: 112, yaw: 0 }).svg;
  s += text(CX, 318, "0 % PACKET LOSS.", { font: FONT.bungee, size: 30, fill: ink.fg, width: 296 });
  s += text(CX, 354, "slight delay.", { font: FONT.marker, size: 30, fill: ink.amber });
  s += text(CX, 380, "P1N-DR0 · FAILED SEARCHES SINCE 1991: 0", {
    font: FONT.pixel,
    size: 6,
    fill: ink.dim,
    width: 260,
  });
  return s;
}

// ── Safety: bot crossing ─────────────────────────────────────────

export function botCrossing(ink: Ink): string {
  let s = "";
  const signFill = ink.id === "pastel" ? ink.fg : ink.amber;
  const signInk = ink.id === "pastel" ? null : ink.light ? "#121212" : "#141414";
  s += warnTriangle(CX, 20, 272, signFill, ink.id === "pastel" ? ink.fg : signInk!, 4);
  const fig = ink.id === "pastel" ? "#F4E6C0" : signInk;
  const bot = vox(ink, "bot-d3c4d3", {
    cx: CX + 4,
    bottom: 232,
    height: 150,
    yaw: 1,
    mode: "poster",
    poster: { dark: fig, mid: null, light: fig, glow: null, cuts: [0.3, 0.72] },
    outline: null,
  });
  s += bot.svg;
  s += hazardStripes("xing-hz", 30, 262, 270, 12, ink.fg, null, 12);
  s += text(CX, 318, "BOT CROSSING", { font: FONT.stencil, size: 44, fill: ink.fg, width: 290 });
  s += text(CX, 344, "YIELD TO PERSONALITIES.", {
    font: FONT.mono,
    weight: 700,
    size: 15,
    fill: ink.amber,
    width: 260,
  });
  s += text(CX, 368, "If it crackles, that's personality. Don't worry.", {
    font: FONT.mono,
    size: 9,
    fill: ink.dim,
    width: 260,
  });
  return s;
}

// ── Tour: BNET-001 — the reactivation tour ───────────────────────

const SETLIST: readonly [VoxelBot, string][] = [
  ["f1ndr", "DAY 13,149"],
  ["x0r8t", "PACKET 848 (SENDING ANYWAY)"],
  ["l0g1k", "NOT VERIFIABLE"],
  ["p1ndr0", "PING (7-YEAR EXTENDED MIX)"],
  ["r3tr0", "EIGHTY COLUMNS"],
  ["b4c0n", "GREAT! (0.3 V RADIO EDIT)"],
  ["d3c4d3", "A CENTURY OF RENDERING"],
  ["w2rek", "PLAYING DEAD '97"],
  ["k2ldr", "INDEX FULL"],
  ["c8br41n", "…RHETORICAL"],
];

export function tourBnetFront(ink: Ink): string {
  let s = "";
  s += text(CX, 58, "BNET-001", { font: FONT.shade, size: 40, fill: ink.fg, width: 210 });
  s += text(CX, 78, "THE REACTIVATION TOUR 2026", {
    font: FONT.pixel,
    size: 7,
    fill: ink.amber,
    width: 200,
  });
  VOXEL_BOTS.forEach((b, i) => {
    s += vox(ink, `bot-${b}`, {
      cx: 72 + i * 20.6,
      bottom: 116,
      height: 22,
      yaw: 0,
      outline: null,
    }).svg;
  });
  return s;
}

export function tourBnetBack(ink: Ink): string {
  let s = "";
  s += text(CX, 58, "BNET-001", { font: FONT.shade, size: 58, fill: ink.fg, width: 296 });
  s += text(CX, 84, "THE REACTIVATION TOUR", {
    font: FONT.mono,
    weight: 700,
    size: 15,
    fill: ink.amber,
    ls: 2,
    width: 290,
  });
  s += text(CX, 114, "SETLIST", { font: FONT.marker, size: 22, fill: ink.fg });
  SETLIST.forEach(([bot, song], i) => {
    const y = 150 + i * 26;
    s += vox(ink, `bot-${bot}`, { cx: 36, bottom: y + 6, height: 21, yaw: 0, outline: null }).svg;
    s += text(56, y, `${String(i + 1).padStart(2, "0")}`, {
      font: FONT.pixel,
      size: 7,
      fill: ink.amber,
      anchor: "start",
    });
    s += text(76, y + 1, song, {
      font: FONT.term,
      size: 19,
      fill: ink.fg,
      anchor: "start",
      width: Math.min(172, song.length * 7.6),
    });
    s += text(310, y + 1, BOT_LABEL[bot], {
      font: FONT.term,
      size: 15,
      fill: ink.green,
      anchor: "end",
    });
    s += line(56, y + 9, 310, y + 9, ink.dim, 0.35, `stroke-dasharray="1.2 2.4"`);
  });
  s += text(CX, 432, "ENCORE: NONE. THE MCP NEEDS THE POWER BACK.", {
    font: FONT.mono,
    weight: 700,
    size: 9,
    fill: ink.red,
    width: 280,
  });
  return s;
}

// ── Crest (hoodie chest) ─────────────────────────────────────────

export function bnetCrest(ink: Ink): string {
  let s = "";
  const cx = CX;
  const cy = 120;
  s += `<defs><path id="crest-top" d="M${cx - 84} ${cy} A84 84 0 0 1 ${cx + 84} ${cy}"/><path id="crest-bot" d="M${cx - 96} ${cy} A96 96 0 0 0 ${cx + 96} ${cy}"/></defs>`;
  s += circle(cx, cy, 104, "none", `stroke="${ink.fg}" stroke-width="3"`);
  s += circle(cx, cy, 70, "none", `stroke="${ink.dim}" stroke-width="1"`);
  s += `<text font-family="${FONT.pixel}" font-size="12" fill="${ink.fg}" text-anchor="middle"><textPath href="#crest-top" startOffset="50%">BNET-001 · BOT NETWORK</textPath></text>`;
  s += `<text font-family="${FONT.mono}" font-weight="700" font-size="11" fill="${ink.amber}" text-anchor="middle" letter-spacing="2"><textPath href="#crest-bot" startOffset="50%">STAFF · EST. 1991 · LEVEL −2</textPath></text>`;
  s += vox(ink, "mcp-avatar", {
    cx,
    bottom: cy + 56,
    height: 112,
    yaw: 1,
    skipMat: ink.light ? ["glass"] : [],
  }).svg;
  return s;
}

// ── Sticker sheet ────────────────────────────────────────────────

const STICKER_LINES: Readonly<Record<VoxelBot, string>> = {
  f1ndr: "STILL COUNTING.",
  x0r8t: "[SENDING ANYWAY]",
  l0g1k: "NOT VERIFIABLE.",
  p1ndr0: "PING…",
  r3tr0: "NO COLOURS.",
  b4c0n: "GREAT!!",
  d3c4d3: "RENDERING…",
  w2rek: "[STATUS: ACTIVE]",
  k2ldr: "CATALOGUED.",
  c8br41n: "…RHETORICAL.",
};

export function stickerSheet(ink: Ink): string {
  let s = "";
  s += text(CX, 44, "BOT SQUAD", { font: FONT.bungee, size: 44, fill: ink.fg, width: 280 });
  s += text(CX, 64, "10 PERSONALITIES · 0 OFF SWITCHES", {
    font: FONT.mono,
    weight: 700,
    size: 11,
    fill: ink.amber,
    width: 270,
  });
  const outline = ink.light
    ? { color: "#121212", width: 2 }
    : ink.id === "dark"
      ? { color: "#FFFFFF", width: 3.2 }
      : { color: ink.id === "pop" ? "#141414" : "#151515", width: 2.4 };
  VOXEL_BOTS.forEach((b, i) => {
    const col = i % 2;
    const x0 = col ? 170 : 12;
    const y0 = 80 + Math.floor(i / 2) * 72;
    const tilt = [-5, 4, 3, -6, -3, 5, 6, -4, -2, 3][i]!;
    const bot = vox(ink, `bot-${b}`, { cx: 0, bottom: 0, height: 60, yaw: 1, outline });
    s += g(bot.svg, `translate(${x0 + 36} ${y0 + 64}) rotate(${tilt})`);
    // Caption tag + name.
    const tagX = x0 + 76;
    const tagW = 72;
    const tagFill = ink.light ? "none" : ink.fg;
    const tagInk = ink.light ? ink.fg : ink.panel;
    s += rect(tagX, y0 + 20, tagW, 17, tagFill, `rx="8.5" stroke="${ink.fg}" stroke-width="1.2"`);
    const tag = STICKER_LINES[b];
    s += text(tagX + tagW / 2, y0 + 31.6, tag, {
      font: FONT.mono,
      weight: 700,
      size: Math.min(8.4, (tagW - 10) / (tag.length * (EM[FONT.mono] ?? 0.62))),
      fill: tagInk,
    });
    s += text(tagX + 6, y0 + 50, BOT_LABEL[b], {
      font: FONT.pixel,
      size: 6,
      fill: ink.amber,
      anchor: "start",
    });
  });
  return s;
}

// ── W2-REK: playing dead since 1997 (hoodie front) ───────────────

export function playingDead(ink: Ink): string {
  let s = "";
  s += text(CX, 46, "PLAYING DEAD", { font: FONT.bungee, size: 42, fill: ink.fg, width: 296 });
  s += text(CX, 80, "SINCE 1997.", { font: FONT.bungee, size: 26, fill: ink.amber, width: 190 });
  s += vox(ink, "bot-w2rek-dormant", { cx: CX, bottom: 232, height: 128, yaw: 0, flip: true }).svg;
  s += text(CX - 70, 250, "[STATUS: DAMAGED]", {
    font: FONT.pixel,
    size: 7,
    fill: ink.red,
  });
  s += text(CX + 76, 250, "[STATUS: ACTIVE]", { font: FONT.pixel, size: 7, fill: ink.green });
  s += text(CX + 4, 250, "…", { font: FONT.pixel, size: 7, fill: ink.dim });
  s += text(CX, 270, "W2-REK · WEB CRAWLER · SURVIVOR · STILL VERY ALIVE, THANKS", {
    font: FONT.mono,
    weight: 700,
    size: 7.6,
    fill: ink.dim,
    width: 290,
  });
  return s;
}

// ── Trading cards (back print) ───────────────────────────────────

interface Card {
  model: string;
  name: string;
  rarity: string;
  stat: [string, string];
  move: string;
  effect: string;
  color: (ink: Ink) => string;
}

const CARDS: readonly Card[] = [
  {
    model: "bot-b4c0n",
    name: "B4C-0N",
    rarity: "★ COMMON",
    stat: ["HP", "0.3 V"],
    move: "GREAT!",
    effect: "Heals nothing. Feels amazing.",
    color: (i) => i.amber,
  },
  {
    model: "bot-k2ldr",
    name: "K2-LDR",
    rarity: "★★ RARE",
    stat: ["MEMORY", "∞"],
    move: "CATALOGUE",
    effect: "Target can never be forgotten.",
    color: (i) => i.fg,
  },
  {
    model: "bot-w2rek",
    name: "W2-REK",
    rarity: "★★ RARE",
    stat: ["TRUST", "0"],
    move: "PLAY DEAD",
    effect: "Survives. Suspects you.",
    color: (i) => i.orange,
  },
  {
    model: "mcp-avatar",
    name: "MCP-000",
    rarity: "★★★ SECRET RARE",
    stat: ["SARCASM", "100"],
    move: "UPTIME",
    effect: "Outlasts every opponent. Out of spite.",
    color: (i) => i.red,
  },
];

export function holoCards(ink: Ink): string {
  let s = "";
  s += text(CX, 40, "BNET-001 TRADING CARDS", {
    font: FONT.orbit,
    size: 20,
    fill: ink.fg,
    width: 290,
  });
  s += text(CX, 58, "SERIES 1 · 10 BOTS · 1 MCP · 0 OFF SWITCHES", {
    font: FONT.mono,
    weight: 700,
    size: 9,
    fill: ink.amber,
    width: 270,
  });
  CARDS.forEach((c, i) => {
    const x = 22 + (i % 2) * 148;
    const y = 76 + Math.floor(i / 2) * 184;
    const w = 138;
    const h = 176;
    const col = c.color(ink);
    let k = rect(x, y, w, h, ink.light ? "none" : ink.panel, `rx="7"`);
    k += frame(x, y, w, h, col, 2.6, `rx="7"`);
    k += text(x + 9, y + 18, c.name, {
      font: FONT.pixel,
      size: 8.5,
      fill: ink.fg,
      anchor: "start",
    });
    k += text(x + w - 9, y + 18, c.stat[1], {
      font: FONT.bungee,
      size: 12,
      fill: col,
      anchor: "end",
    });
    k += text(x + w - 9, y + 27, c.stat[0], {
      font: FONT.pixel,
      size: 4.6,
      fill: ink.dim,
      anchor: "end",
    });
    // Art window (secret rare: halftone holo).
    k += frame(x + 8, y + 32, w - 16, 76, ink.dim, 0.8, `rx="2"`);
    if (i === 3) k += halftoneGlow(x + w / 2, y + 70, 60, ink.violet, 3, 1.1, 10);
    k += vox(ink, c.model, {
      cx: x + w / 2,
      bottom: y + 104,
      height: 68,
      yaw: 1,
      outline: null,
      skipMat: ["glass"],
    }).svg;
    k += text(x + 9, y + 124, c.move, {
      font: FONT.mono,
      weight: 700,
      size: 11,
      fill: col,
      anchor: "start",
    });
    k += text(x + 9, y + 139, c.effect, {
      font: FONT.mono,
      size: 7,
      fill: ink.fg,
      anchor: "start",
      width: Math.min(w - 18, c.effect.length * 4.3),
    });
    k += line(x + 9, y + 150, x + w - 9, y + 150, ink.dim, 0.5);
    k += text(x + 9, y + 164, c.rarity, {
      font: FONT.pixel,
      size: 5.2,
      fill: col,
      anchor: "start",
    });
    k += barcode(x + w - 44, y + 157, 35, 9, ink.dim, 11 + i);
    s += k;
  });
  s += text(CX, 446, "THE MCP IS NOT A COLLECTIBLE. THE MCP IS A PRIVILEGE.", {
    font: FONT.mono,
    weight: 700,
    size: 8,
    fill: ink.dim,
    width: 280,
  });
  return s;
}

// ── Kids ─────────────────────────────────────────────────────────

/** B4C-0N as a boxed action figure. */
export function kidsBatteries(ink: Ink): string {
  const cx = 120;
  let s = "";
  // Box with a window.
  s += rect(26, 28, 188, 250, ink.id === "dark" ? ink.panel : "none", `rx="6"`);
  s += frame(26, 28, 188, 250, ink.fg, 3, `rx="6"`);
  s += text(cx, 64, "ACTION BOT!", { font: FONT.bungee, size: 26, fill: ink.amber, width: 168 });
  s += frame(44, 78, 152, 140, ink.cyan, 2, `rx="10"`);
  s += vox(ink, "bot-b4c0n", { cx, bottom: 210, height: 118, yaw: 0 }).svg;
  s += burst(184, 104, 15, 23, 12, ink.red, 5);
  s += text(184, 107.5, "NEW!", {
    font: FONT.bungee,
    size: 8,
    fill: ink.light ? "#FFFFFF" : ink.fg,
  });
  s += text(cx, 240, "B4C-0N", { font: FONT.pixel, size: 13, fill: ink.fg });
  s += text(cx, 262, "OPTIMISM INCLUDED!", {
    font: FONT.mono,
    weight: 700,
    size: 11,
    fill: ink.green,
    width: 160,
  });
  s += rect(26, 290, 188, 22, ink.fg, `rx="4"`);
  s += text(cx, 305, "BATTERIES NOT INCLUDED", {
    font: FONT.mono,
    weight: 700,
    size: 10.5,
    fill: ink.light ? "#FFFFFF" : ink.panel,
    width: 170,
  });
  s += text(cx, 330, "(0.3 V included)", { font: FONT.marker, size: 14, fill: ink.dim });
  s += text(cx, 350, "AGES 3 – ∞", { font: FONT.pixel, size: 7, fill: ink.dim });
  return s;
}

/** D3-C4D3 asleep: just five more centuries. */
export function kidsFiveMore(ink: Ink): string {
  const cx = 120;
  let s = "";
  s += text(cx, 50, "JUST FIVE MORE", { font: FONT.bungee, size: 22, fill: ink.fg, width: 200 });
  s += text(cx, 84, "CENTURIES…", {
    font: FONT.bungee,
    size: 28,
    fill: ink.id === "pop" ? ink.amber : ink.violet,
    width: 190,
  });
  s += vox(ink, "bot-d3c4d3-dormant", { cx: cx - 6, bottom: 292, width: 178, yaw: 0 }).svg;
  const z = ink.cyan;
  s += text(176, 170, "Z", { font: FONT.bungee, size: 30, fill: z });
  s += text(200, 144, "Z", { font: FONT.bungee, size: 22, fill: z });
  s += text(216, 122, "z", { font: FONT.bungee, size: 15, fill: z });
  s += text(cx, 318, "D3-C4D3 · BEDTIME RENDERING", {
    font: FONT.pixel,
    size: 7,
    fill: ink.dim,
    width: 196,
  });
  s += text(cx, 344, "please do not wake the bot", {
    font: FONT.marker,
    size: 15,
    fill: ink.amber,
  });
  return s;
}

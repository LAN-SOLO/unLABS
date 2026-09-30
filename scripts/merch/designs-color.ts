/**
 * Colour-garment motifs (2026-09 drop): built from few, flat inks so they
 * print in every ink set — dark, light, pop (red / royal blue / teal / green)
 * and pastel (ochre / pink / lilac / khaki). Plus the unETH crystal field
 * guide, which needs its real neon colours (dark + light only).
 */
import {
  FONT,
  type Ink,
  burst,
  circle,
  frame,
  g,
  halftoneGlow,
  hazardStripes,
  isoVoxels,
  line,
  poly,
  rect,
  text,
  warnTriangle,
} from "./kit.ts";
import { LORE_BOTS, mcpEye, spriteCard } from "./sprites.ts";

const CX = 165;
const r2 = (n: number): string => String(Math.round(n * 100) / 100);

// ── unETH crystal field guide ────────────────────────────────────

/** unETH capture colours (lib/world/uneth-crystal.ts COLOR_HEX) — dark / light ink. */
const UNETH: readonly { name: string; dark: string; light: string }[] = [
  { name: "WHITE", dark: "#E8F4FF", light: "#5A6570" },
  { name: "GREEN", dark: "#00FF66", light: "#0A8A3A" },
  { name: "YELLOW", dark: "#FFB800", light: "#B07A00" },
  { name: "BLUE", dark: "#2F7BFF", light: "#0B47B8" },
  { name: "PURPLE", dark: "#FF00FF", light: "#A0109E" },
  { name: "RED", dark: "#FF3333", light: "#C01818" },
  { name: "ORANGE", dark: "#FF6B00", light: "#C84E00" },
  { name: "RGB", dark: "", light: "" },
];
const RGB_EDGES = ["#FF3333", "#FFB800", "#00FF66", "#00F0FF", "#2F7BFF", "#FF00FF"];
const RGB_EDGES_LIGHT = ["#C01818", "#B07A00", "#0A8A3A", "#0090A8", "#0B47B8", "#A0109E"];

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

/**
 * The unETH crystal as neon tubes: an elongated octahedron. `color(i)` per
 * edge; `drop` hides edges (the I/O state drops tubes in and out).
 */
function neonCrystal(
  cx: number,
  cy: number,
  r: number,
  color: (edge: number) => string,
  sw: number,
  opts: { angle?: number; drop?: readonly number[]; core?: string } = {},
): string {
  const angle = opts.angle ?? 0.5;
  const tilt = 0.32;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const pts = OCTA.map(([x, y, z]) => {
    const x1 = x * ca + z * sa * 0.35;
    const z1 = -x * sa + z * ca * 0.35;
    const y2 = y * ct - z1 * st;
    const z2 = y * st + z1 * ct;
    return { x: cx + x1 * r * 0.72, y: cy - y2 * r * 1.35, z: z2 };
  });
  let back = "";
  let front = "";
  OCTA_EDGES.forEach(([a, b], i) => {
    if (opts.drop?.includes(i)) return;
    const pa = pts[a]!;
    const pb = pts[b]!;
    const isBack = (pa.z + pb.z) / 2 < -0.05;
    const c = color(i);
    const seg =
      line(pa.x, pa.y, pb.x, pb.y, c, isBack ? sw * 0.6 : sw) +
      (opts.core && !isBack ? line(pa.x, pa.y, pb.x, pb.y, opts.core, sw * 0.35) : "");
    if (isBack) back += seg;
    else front += seg;
  });
  return back + front;
}

/** Know your crystal: 8 colours, 5 volatility tiers, 3 states (back print). */
export function crystalVariants(ink: Ink): string {
  const col = (i: number): string => (ink.light ? UNETH[i]!.light : UNETH[i]!.dark);
  const rgb = ink.light ? RGB_EDGES_LIGHT : RGB_EDGES;
  const core = ink.light ? undefined : "#FFFFFF";
  let s = "";
  s += text(CX, 30, "KNOW YOUR CRYSTAL", {
    font: FONT.orbit,
    size: 24,
    fill: ink.fg,
    ls: 3,
    width: 300,
  });
  s += text(CX, 46, "unETH FIELD GUIDE · CAPTURE EDITION 2018", {
    font: FONT.mono,
    weight: 700,
    size: 8,
    fill: ink.amber,
    ls: 1.4,
    width: 290,
  });
  // ── 8 colours (2 rows × 4) ──
  s += text(20, 68, "01 · COLOURS", { font: FONT.pixel, size: 7, fill: ink.dim, anchor: "start" });
  for (let i = 0; i < 8; i++) {
    const x = 50 + (i % 4) * 77;
    const y = 104 + Math.floor(i / 4) * 78;
    const c = (e: number): string => (i === 7 ? rgb[e % rgb.length]! : col(i));
    if (!ink.light) s += halftoneGlow(x, y, 26, i === 7 ? "#8A6BFF" : col(i), 2.6, 0.9, 10);
    s += neonCrystal(x, y, 21, c, 2.2, { core, angle: 0.35 + i * 0.12 });
    s += text(x, y + 38, UNETH[i]!.name, { font: FONT.pixel, size: 6, fill: ink.fg });
  }
  s += line(20, 234, 310, 234, ink.dim, 0.6);
  // ── 5 tiers ──
  s += text(20, 250, "02 · VOLATILITY TIERS", {
    font: FONT.pixel,
    size: 7,
    fill: ink.dim,
    anchor: "start",
  });
  const tierCol = col(6);
  for (let t = 1; t <= 5; t++) {
    const x = 37 + (t - 1) * 64;
    const y = 290;
    if (!ink.light) s += halftoneGlow(x, y, 12 + t * 4.5, tierCol, 2.4, 0.5 + t * 0.12, 8);
    else if (t >= 3) s += halftoneGlow(x, y, 10 + t * 4, tierCol, 2.6, 0.35 + t * 0.08, 14);
    if (t >= 4)
      for (let k = 0; k < (t === 4 ? 4 : 9); k++) {
        const a = k * 2.39 + t;
        const d = 24 + (k % 3) * 3;
        s += line(
          x + Math.cos(a) * d,
          y + Math.sin(a) * d,
          x + Math.cos(a) * (d + 5),
          y + Math.sin(a) * (d + 5) - 2,
          ink.light ? ink.fg : "#FFFFFF",
          1,
        );
      }
    // T5 tears: the crystal is drawn twice, slid sideways.
    if (t === 5) s += neonCrystal(x + 4, y, 17, () => (ink.light ? ink.dim : col(4)), 1.2);
    s += neonCrystal(x, y, 17, () => tierCol, 1.4 + t * 0.35, { core, angle: 0.6 });
    s += text(x, y + 34, `T${t}`, { font: FONT.pixel, size: 8, fill: ink.fg });
  }
  s += line(20, 338, 310, 338, ink.dim, 0.6);
  // ── 3 states ──
  s += text(20, 354, "03 · STATES", { font: FONT.pixel, size: 7, fill: ink.dim, anchor: "start" });
  const states: [string, string][] = [
    ["O", "STEADY"],
    ["I", "PULSES"],
    ["I/O", "FLICKERS"],
  ];
  states.forEach(([code, what], k) => {
    const x = 62 + k * 103;
    const y = 392;
    const c = col(1);
    if (code === "I")
      for (const rr of [26, 31, 36])
        s += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${rr}" fill="none" stroke="${c}" stroke-width="${rr === 26 ? 1.3 : 0.8}" stroke-dasharray="${rr === 36 ? "2 3" : "none"}"/>`;
    s += neonCrystal(x, y, 18, () => c, 2.2, {
      core,
      angle: 0.55,
      drop: code === "I/O" ? [1, 6, 9] : undefined,
    });
    s += text(x, y + 36, code, { font: FONT.pixel, size: 8, fill: ink.fg });
    s += text(x, y + 46, what, { font: FONT.mono, weight: 700, size: 6.5, fill: ink.dim });
  });
  return s;
}

// ── Status 418 ───────────────────────────────────────────────────

/** Control Room: please take off your shoes. That was a joke. Status 418. */
export function status418(ink: Ink): string {
  let s = "";
  // Pixel teapot.
  const pot = [
    ".....hh.........",
    "....hhhh........",
    "..bbbbbbbbbb....",
    ".bbbbbbbbbbbb..s",
    "bbbwwbbbbbbbbbss",
    "bbbwbbbbbbbbbs.s",
    "bbbbbbbbbbbbbs..",
    "bbbbbbbbbbbbs...",
    ".bbbbbbbbbbb....",
    "..bbbbbbbbb.....",
    "...ddddddd......",
  ];
  const px = 6.2;
  const x0 = CX - 8 * px;
  const y0 = 34;
  pot.forEach((row, j) =>
    [...row].forEach((c, i) => {
      if (c === ".") return;
      // Body in the main ink, lid / base / highlight in amber.
      const fill = c === "b" || c === "s" ? ink.fg : ink.amber;
      s += rect(x0 + i * px, y0 + j * px, px + 0.05, px + 0.05, fill);
    }),
  );
  // Steam.
  for (let k = 0; k < 3; k++)
    s += `<path d="M${r2(CX - 14 + k * 14)} 28 q -5 -6 0 -12 q 5 -6 0 -12" fill="none" stroke="${ink.dim}" stroke-width="2" stroke-linecap="round"/>`;
  s += text(CX, 190, "418", { font: FONT.bungee, size: 78, fill: ink.fg, width: 190 });
  s += text(CX, 214, "I'M A TEAPOT", {
    font: FONT.pixel,
    size: 15,
    fill: ink.amber,
    width: 250,
  });
  s += line(50, 228, 280, 228, ink.dim, 0.8);
  s += text(CX, 246, "CONTROL ROOM. MY LIVING ROOM.", {
    font: FONT.mono,
    weight: 700,
    size: 10,
    fill: ink.fg,
    width: 250,
  });
  s += text(CX, 262, "PLEASE TAKE OFF YOUR SHOES.", {
    font: FONT.mono,
    weight: 700,
    size: 10,
    fill: ink.fg,
    width: 238,
  });
  s += text(CX, 282, "(that was a joke)", { font: FONT.marker, size: 13, fill: ink.green });
  s += text(CX, 300, "— MCP-000", { font: FONT.mono, size: 8, fill: ink.dim });
  return s;
}

// ── From low to sporting ─────────────────────────────────────────

/** Level −4: your probability of survival has risen. From low to sporting. */
export function sporting(ink: Ink): string {
  let s = "";
  const cy = 176;
  const R = 110;
  s += text(CX, 26, "LEVEL −4", { font: FONT.stencil, size: 24, fill: ink.fg, width: 170 });
  // Gauge: 9 segments from LOW (left) to HIGH (right).
  const segs = 9;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI + (i / segs) * Math.PI + 0.02;
    const a1 = Math.PI + ((i + 1) / segs) * Math.PI - 0.02;
    const r0 = R - 22;
    const fill = i < 3 ? (ink.red === "#141414" ? ink.fg : ink.red) : i < 6 ? ink.amber : ink.green;
    s += poly(
      [
        [CX + Math.cos(a0) * r0, cy + Math.sin(a0) * r0],
        [CX + Math.cos(a0) * R, cy + Math.sin(a0) * R],
        [CX + Math.cos(a1) * R, cy + Math.sin(a1) * R],
        [CX + Math.cos(a1) * r0, cy + Math.sin(a1) * r0],
      ],
      fill,
    );
  }
  const lab = (t: number, str: string): string => {
    const a = Math.PI + t * Math.PI;
    return text(CX + Math.cos(a) * (R + 12), cy + Math.sin(a) * (R + 12) + 3, str, {
      font: FONT.pixel,
      size: 6.5,
      fill: ink.dim,
    });
  };
  s += lab(0.03, "LOW") + lab(0.5, "SPORTING") + lab(0.97, "HIGH");
  // Needle: was at "low" (ghost), now at "sporting".
  const needle = (t: number, c: string, w: number, dash = ""): string => {
    const a = Math.PI + t * Math.PI;
    return line(CX, cy, CX + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30), c, w, dash);
  };
  s += needle(0.12, ink.dim, 2, `stroke-dasharray="3 3"`);
  s += needle(0.46, ink.fg, 4.5);
  s += circle(CX, cy, 9, ink.fg) + circle(CX, cy, 3.5, ink.amber);
  s += text(CX, 212, "SURVIVAL PROBABILITY", {
    font: FONT.archivo,
    size: 21,
    fill: ink.fg,
    width: 290,
  });
  s += text(CX, 236, "HAS RISEN.", { font: FONT.archivo, size: 21, fill: ink.fg, width: 150 });
  s += text(CX, 262, "FROM LOW TO SPORTING.", {
    font: FONT.mono,
    weight: 700,
    size: 13,
    fill: ink.amber,
    width: 250,
  });
  s += text(CX, 280, "— MCP-000, THE SHAFT", { font: FONT.mono, size: 8, fill: ink.dim });
  return s;
}

// ── Anomalies are not pets ───────────────────────────────────────

/** Reminder: anomalies are not pets. Please do not name them. (This is Steve.) */
export function notPets(ink: Ink): string {
  let s = "";
  const body = ink.light ? ink.fg : ink.id === "pop" ? "#141414" : ink.violet;
  const eye = ink.id === "pop" ? "#FFFFFF" : ink.light ? "#FFFFFF" : "#FFFFFF";
  if (ink.id === "dark") s += halftoneGlow(CX, 112, 84, ink.violet, 3, 1.1, 40);
  // Blob with three eyes and a collar.
  s += `<path d="M${CX - 58} 150 C ${CX - 70} 96, ${CX - 34} 54, ${CX} 62 C ${CX + 40} 50, ${CX + 72} 92, ${CX + 58} 150 C ${CX + 44} 176, ${CX - 44} 178, ${CX - 58} 150 Z" fill="${body}"/>`;
  for (const [dx, dy, r] of [
    [-24, 104, 11],
    [8, 92, 8],
    [30, 110, 13],
  ] as const) {
    s += circle(CX + dx, dy, r, eye);
    s += circle(CX + dx + r * 0.25, dy + r * 0.2, r * 0.45, body);
  }
  s += `<path d="M${CX - 20} 134 Q ${CX} 146 ${CX + 22} 132" fill="none" stroke="${eye}" stroke-width="3" stroke-linecap="round"/>`;
  // Collar + name tag.
  s += rect(CX - 50, 154, 100, 9, ink.red === "#141414" ? ink.amber : ink.red, `rx="4"`);
  s += circle(CX, 176, 13, ink.amber);
  s += circle(CX, 176, 10.5, ink.id === "pop" ? "#141414" : ink.light ? "#FFFFFF" : "#141414");
  s += text(CX, 179, "STEVE", {
    font: FONT.pixel,
    size: 4.2,
    fill: ink.id === "pop" || !ink.light ? ink.amber : ink.fg,
  });
  s += line(CX, 163, CX, 166, ink.amber, 1.4);
  s += text(CX, 222, "ANOMALIES ARE", { font: FONT.stencil, size: 30, fill: ink.fg, width: 270 });
  s += text(CX, 254, "NOT PETS.", { font: FONT.stencil, size: 30, fill: ink.fg, width: 180 });
  s += text(CX, 280, "PLEASE DO NOT NAME THEM.", {
    font: FONT.mono,
    weight: 700,
    size: 12,
    fill: ink.amber,
    width: 240,
  });
  s += text(CX + 60, 302, "(this is Steve)", { font: FONT.marker, size: 12, fill: ink.green });
  return s;
}

// ── Inventory 2019 ───────────────────────────────────────────────

/** Materials store. Last inventory 2019. Result: yes. */
export function inventory(ink: Ink): string {
  let s = "";
  const x = CX - 78;
  const y = 22;
  const w = 156;
  const h = 196;
  const paper = ink.light ? "#FFFFFF" : ink.id === "pop" ? "#FFFFFF" : "#EAFBEA";
  const pen = "#141414";
  s += rect(x, y + 10, w, h, ink.id === "pop" ? "#141414" : ink.amber, `rx="6"`);
  s += rect(x + 8, y + 22, w - 16, h - 22, paper, `rx="2"`);
  if (ink.light) s += frame(x + 8, y + 22, w - 16, h - 22, ink.fg, 1.2, `rx="2"`);
  s += rect(CX - 26, y, 52, 22, ink.id === "pop" ? "#FFD23F" : ink.dim, `rx="4"`);
  s += circle(CX, y + 8, 4, paper);
  s += text(CX, y + 44, "INVENTORY", { font: FONT.stencil, size: 17, fill: pen, width: 116 });
  s += text(CX, y + 58, "MATERIALS STORE · LEVEL −1", { font: FONT.mono, size: 5.6, fill: "#555" });
  const rows = ["COPPER COIL", "CABLES (MISC.)", "DUCT TAPE", "HOPE", "CRYSTAL #0089"];
  rows.forEach((r, i) => {
    const ry = y + 80 + i * 20;
    s += frame(x + 18, ry - 8, 10, 10, pen, 1);
    if (i !== 3)
      s += `<path d="M${x + 19.5} ${ry - 3} l3 3.5 l6 -9" fill="none" stroke="${ink.light ? ink.red : "#C01818"}" stroke-width="2" stroke-linecap="round"/>`;
    s += text(x + 34, ry, r, { font: FONT.type, size: 9, fill: pen, anchor: "start" });
  });
  s += line(x + 18, y + 184, x + w - 18, y + 184, pen, 0.6);
  s += text(x + w - 22, y + 196, "✓ 2019", {
    font: FONT.marker,
    size: 12,
    fill: ink.light ? ink.red : "#C01818",
    anchor: "end",
  });
  s += text(CX, 262, "LAST INVENTORY: 2019.", {
    font: FONT.archivo,
    size: 21,
    fill: ink.fg,
    width: 290,
  });
  s += text(CX, 294, "RESULT: YES.", { font: FONT.archivo, size: 28, fill: ink.amber, width: 230 });
  return s;
}

// ── Hot surfaces ─────────────────────────────────────────────────

/** Note: hot surfaces are hot. Cold surfaces are probably hot as well. */
export function hotSurfaces(ink: Ink): string {
  const yellow = ink.light ? "#F2B705" : "#FFC400";
  const black = "#141414";
  let s = "";
  s += warnTriangle(CX, 20, 180, yellow, black, 7);
  // Flame over a hot plate.
  s += `<path d="M${CX} 70 C ${CX + 28} 100, ${CX + 34} 126, ${CX + 18} 146 C ${CX + 20} 128, ${CX + 10} 118, ${CX + 4} 112 C ${CX + 6} 130, ${CX - 4} 138, ${CX - 10} 146 C ${CX - 30} 128, ${CX - 26} 98, ${CX} 70 Z" fill="${black}"/>`;
  s += rect(CX - 40, 150, 80, 7, black, `rx="2"`);
  for (let k = 0; k < 3; k++)
    s += `<path d="M${CX - 24 + k * 24} 164 q -4 3 0 6 q 4 3 0 6" fill="none" stroke="${black}" stroke-width="2.2" stroke-linecap="round"/>`;
  s += text(CX, 216, "HOT SURFACES", { font: FONT.archivo, size: 27, fill: ink.fg, width: 270 });
  s += text(CX, 244, "ARE HOT.", { font: FONT.archivo, size: 27, fill: ink.fg, width: 160 });
  s += text(CX, 270, "COLD SURFACES ARE", {
    font: FONT.mono,
    weight: 700,
    size: 12.5,
    fill: ink.amber,
    width: 200,
  });
  s += text(CX, 286, "PROBABLY HOT AS WELL.", {
    font: FONT.mono,
    weight: 700,
    size: 12.5,
    fill: ink.amber,
    width: 230,
  });
  s += hazardStripes("hs", 40, 300, 250, 10, yellow, null, 9);
  s += text(CX, 326, "LEVEL −1 · POWER & MANUFACTURING", {
    font: FONT.mono,
    size: 7.6,
    fill: ink.dim,
  });
  return s;
}

// ── Workshop report ──────────────────────────────────────────────

/** Workshop: 72 % of tools present. 100 % of them dusty. */
export function toolsDusty(ink: Ink): string {
  let s = "";
  // Crossed wrench + screwdriver.
  const tool = ink.fg;
  s += g(
    rect(-6, -70, 12, 118, tool, `rx="5"`) +
      `<path d="M-20 -70 a 20 20 0 1 1 40 0 l-10 0 l0 12 l-20 0 l0 -12 z" fill="${tool}"/>`,
    `translate(${CX} 110) rotate(-40)`,
  );
  s += g(
    rect(-4, -76, 8, 70, ink.dim, `rx="2"`) + rect(-9, -6, 18, 58, ink.amber, `rx="6"`),
    `translate(${CX} 118) rotate(40)`,
  );
  // Dust specks.
  for (let k = 0; k < 18; k++) {
    const a = k * 2.2;
    const d = 30 + ((k * 37) % 60);
    s += circle(CX + Math.cos(a) * d, 110 + Math.sin(a) * d * 0.8, 1 + (k % 3) * 0.5, ink.dim);
  }
  s += text(CX, 214, "WORKSHOP REPORT", {
    font: FONT.stencil,
    size: 24,
    fill: ink.fg,
    width: 270,
  });
  const bar = (y: number, label: string, pct: number, color: string): string =>
    text(40, y - 4, label, {
      font: FONT.mono,
      weight: 700,
      size: 9,
      fill: ink.fg,
      anchor: "start",
    }) +
    text(290, y - 4, `${pct} %`, { font: FONT.pixel, size: 8, fill: color, anchor: "end" }) +
    frame(40, y, 250, 14, ink.fg, 1.4) +
    rect(43, y + 3, (244 * pct) / 100, 8, color);
  s += bar(240, "TOOLS PRESENT", 72, ink.amber);
  s += bar(276, "OF THEM DUSTY", 100, ink.green);
  s += text(CX, 312, "_unLAB · WORKSHOP · UPPER DECK", {
    font: FONT.mono,
    size: 7.6,
    fill: ink.dim,
  });
  return s;
}

// ── Hoodies ──────────────────────────────────────────────────────

/** Quiet hours have been abolished. Please be quiet anyway. (hoodie front) */
export function quietHours(ink: Ink): string {
  let s = "";
  // Crescent moon (a masked circle: no background colour needed) + Zz.
  s += `<mask id="qh-moon" maskUnits="userSpaceOnUse" x="0" y="0" width="330" height="280">${rect(0, 0, 330, 280, "white")}${circle(76, 80, 33, "black")}</mask>`;
  s += circle(58, 92, 38, ink.amber, `mask="url(#qh-moon)"`);
  s += text(118, 62, "Z", { font: FONT.pixel, size: 16, fill: ink.fg });
  s += text(136, 42, "Z", { font: FONT.pixel, size: 11, fill: ink.fg });
  s += text(150, 28, "z", { font: FONT.pixel, size: 8, fill: ink.fg });
  s += text(318, 76, "QUIET", { font: FONT.archivo, size: 40, fill: ink.fg, anchor: "end" });
  s += text(318, 116, "HOURS", { font: FONT.archivo, size: 40, fill: ink.fg, anchor: "end" });
  // Stamp across.
  const stamp = ink.red === "#141414" ? "#141414" : ink.red;
  s += g(
    frame(-78, -17, 156, 34, stamp, 3.2, `rx="4"`) +
      text(0, 10, "ABOLISHED", { font: FONT.stencil, size: 23, fill: stamp, width: 136 }),
    `translate(226 146) rotate(-6)`,
  );
  s += line(20, 182, 310, 182, ink.dim, 0.8);
  s += text(CX, 212, "PLEASE BE QUIET ANYWAY.", {
    font: FONT.mono,
    weight: 700,
    size: 16,
    fill: ink.amber,
    width: 290,
  });
  s += text(CX, 234, "LEVEL +1 · LIVING QUARTERS · — MCP-000", {
    font: FONT.mono,
    size: 8,
    fill: ink.dim,
  });
  return s;
}

/** Please don't unplug anything that looks like me. (hoodie front, MCP eye) */
export function dontUnplug(ink: Ink): string {
  let s = mcpEye(ink, 78, 120, 52);
  // Plug + cable under the eye.
  s += `<path d="M78 180 C 78 214, 130 214, 140 240" fill="none" stroke="${ink.dim}" stroke-width="3.2" stroke-linecap="round"/>`;
  s += rect(128, 236, 26, 18, ink.dim, `rx="3"`);
  s += rect(133, 254, 4, 9, ink.dim) + rect(145, 254, 4, 9, ink.dim);
  const lines = ["PLEASE DON'T", "UNPLUG", "ANYTHING", "THAT LOOKS", "LIKE ME."];
  lines.forEach(
    (l, i) =>
      (s += text(318, 62 + i * 30, l, {
        font: FONT.archivo,
        size: i === 1 ? 30 : 21,
        fill: i === 1 ? (ink.red === "#141414" ? ink.amber : ink.red) : ink.fg,
        anchor: "end",
      })),
  );
  s += text(318, 218, "— MCP-000, THE MCP CHAMBER", {
    font: FONT.mono,
    size: 8,
    fill: ink.dim,
    anchor: "end",
  });
  return s;
}

/** The Infinity Forge: here matter was persuaded to be something else. (back) */
export function forge(ink: Ink): string {
  let s = "";
  s += text(CX, 42, "INFINITY", { font: FONT.orbit, size: 36, fill: ink.fg, ls: 6, width: 280 });
  s += text(CX, 84, "FORGE", { font: FONT.orbit, size: 44, fill: ink.amber, ls: 10, width: 230 });
  const top =
    ink.id === "dark"
      ? "#FFD36B"
      : ink.id === "pop"
        ? "#FFFFFF"
        : ink.light
          ? "#8A8F96"
          : "#FFFFFF";
  const left =
    ink.id === "dark"
      ? "#FF8A1F"
      : ink.id === "pop"
        ? "#FFD23F"
        : ink.light
          ? "#3B3F45"
          : "#FFD23F";
  const right =
    ink.id === "dark"
      ? "#C24A00"
      : ink.id === "pop"
        ? "#141414"
        : ink.light
          ? "#151515"
          : "#141414";
  const metal: [string, string, string] = [top, left, right];
  const hot: [string, string, string] = ink.light
    ? [ink.orange, ink.red, ink.fg]
    : ink.id === "pop"
      ? ["#FFF1A8", "#FFD23F", "#141414"]
      : ["#FFF1C2", "#FFB800", "#FF6B00"];
  const cells: [number, number, number, [string, string, string]][] = [];
  // Anvil: base, waist, top with horn.
  for (let x = 0; x < 5; x++) for (let z = 0; z < 3; z++) cells.push([x, 0, z, metal]);
  for (let x = 1; x < 4; x++) cells.push([x, 1, 1, metal]);
  for (let x = -1; x < 6; x++) for (let z = 0; z < 3; z++) cells.push([x, 2, z, metal]);
  cells.push([-2, 2, 1, metal]);
  // Glowing crystal ingot on top.
  cells.push([2, 3, 1, hot], [3, 3, 1, hot]);
  s += halftoneGlow(
    CX + 8,
    190,
    74,
    ink.light ? ink.orange : ink.id === "pop" ? "#FFD23F" : "#FF6B00",
    3.2,
    1.2,
    18,
  );
  s += isoVoxels(CX - 10, 222, 17, cells);
  // Sparks.
  s += burst(CX + 30, 176, 5, 14, 7, hot[0], 11);
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k - 5) * 0.22;
    const d = 40 + (k % 4) * 12;
    s += circle(CX + 30 + Math.cos(a) * d, 176 + Math.sin(a) * d, 1.6, hot[k % 2 ? 0 : 1]);
  }
  s += text(CX, 336, "HERE MATTER WAS PERSUADED", {
    font: FONT.mono,
    weight: 700,
    size: 14,
    fill: ink.fg,
    width: 290,
  });
  s += text(CX, 356, "TO BE SOMETHING ELSE.", {
    font: FONT.mono,
    weight: 700,
    size: 14,
    fill: ink.fg,
    width: 240,
  });
  s += line(40, 374, 290, 374, ink.dim, 0.8);
  s += text(CX, 392, "_unLAB · DEEP LAB · EST. 2019", {
    font: FONT.pixel,
    size: 7,
    fill: ink.dim,
  });
  return s;
}

/** "The basement with ambitions" — the lab in cross-section (hoodie back). */
export function basement(ink: Ink): string {
  let s = "";
  s += text(CX, 30, "THE BASEMENT", { font: FONT.bungee, size: 30, fill: ink.fg, width: 290 });
  s += text(CX, 60, "WITH AMBITIONS", { font: FONT.bungee, size: 30, fill: ink.amber, width: 290 });
  s += text(CX, 76, "— Damien, about the Deep Lab", {
    font: FONT.marker,
    size: 10,
    fill: ink.dim,
  });
  const floors: [string, string, string][] = [
    ["+1", "LIVING QUARTERS", "BEDS MADE. BY WHOM?"],
    ["0", "UPPER DECK", "OZONE & COLD COFFEE"],
    ["-1", "POWER", "HOPE CONSUMED"],
    ["-2", "SIGNALS & ANOMALIES", "THEY LICK BACK"],
    ["-3", "DEEP LAB", "GREEN ZONE (EXPANDED)"],
    ["-4", "THE SHAFT", "ERROR 404"],
  ];
  const x0 = 34;
  const x1 = 296;
  const y0 = 96;
  const fh = 50;
  // Ground line with grass ticks above +1? The surface sits above floor 0.
  floors.forEach(([lvl, name, note], i) => {
    const y = y0 + i * fh;
    const deep = i >= 2;
    s += rect(x0, y + fh - 6, x1 - x0, 6, deep ? ink.dim : ink.fg);
    s += text(x0 + 6, y + 22, lvl, {
      font: FONT.pixel,
      size: 12,
      fill: ink.amber,
      anchor: "start",
    });
    s += text(x0 + 44, y + 20, name, {
      font: FONT.mono,
      weight: 700,
      size: 11,
      fill: ink.fg,
      anchor: "start",
    });
    s += text(x0 + 44, y + 34, note, {
      font: FONT.mono,
      size: 7.5,
      fill: ink.dim,
      anchor: "start",
    });
    if (i === 1)
      for (let k = 0; k < 26; k++)
        s += line(x0 + k * 10, y0 + fh - 1, x0 + k * 10 + 4, y0 + fh - 7, ink.green, 1.2);
  });
  // Rock hatching below the Shaft.
  const yb = y0 + floors.length * fh;
  for (let k = 0; k < 14; k++)
    s += line(x0 + k * 19, yb + 6, x0 + k * 19 + 12, yb + 18, ink.dim, 1.2);
  // Elevator shaft on the right with the car at −4.
  const ex = x1 - 30;
  s += frame(ex, y0, 24, floors.length * fh, ink.fg, 1.6);
  s += line(ex + 12, y0, ex + 12, y0 + 5 * fh + 10, ink.dim, 0.8);
  s += rect(ex + 3, y0 + 5 * fh + 10, 18, 26, ink.amber, `rx="2"`);
  s += rect(
    ex + 7,
    y0 + 5 * fh + 15,
    10,
    8,
    ink.id === "dark" ? "#141414" : ink.light ? "#FFFFFF" : "#141414",
  );
  s += text(CX, yb + 40, "_unLAB · 6 LEVELS · 1 ELEVATOR · 0 EXITS", {
    font: FONT.mono,
    size: 8,
    fill: ink.dim,
  });
  return s;
}

/** Bot depot: ten personalities on standby (hoodie back). */
export function botDepot(ink: Ink): string {
  let s = "";
  s += text(CX, 38, "BOT DEPOT", { font: FONT.pixel, size: 28, fill: ink.fg, width: 270 });
  s += text(CX, 58, "TEN PERSONALITIES ON STANDBY", {
    font: FONT.mono,
    weight: 700,
    size: 11,
    fill: ink.amber,
    width: 260,
  });
  LORE_BOTS.forEach((b, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const cx = 37 + col * 64;
    const base = 160 + row * 130;
    // Charging bay.
    s += frame(cx - 28, base - 88, 56, 112, ink.dim, 1, `rx="3"`);
    s += rect(cx - 12, base + 17, 24, 3, ink.green);
    s += spriteCard(b, ink, cx, base, 3, true);
  });
  s += text(CX, 420, "“I WAS CALMER WHILE THEY SLEPT.”", {
    font: FONT.mono,
    weight: 700,
    size: 11,
    fill: ink.fg,
    width: 270,
  });
  s += text(CX, 436, "— MCP-000", { font: FONT.mono, size: 8, fill: ink.dim });
  return s;
}

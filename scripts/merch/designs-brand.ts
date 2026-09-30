/** Brand, crystal and MCP motifs. */
import {
  FONT,
  type Ink,
  barcode,
  circle,
  frame,
  g,
  halftoneGlow,
  line,
  octahedron,
  poly,
  rect,
  rng,
  scanMask,
  shadowText,
  text,
} from "./kit.ts";
import { mcpEye } from "./sprites.ts";

/** _unLAB wordmark with the wireframe crystal — the classic chest logo. */
export function logoClassic(ink: Ink): string {
  const cx = 165;
  let s = "";
  s += halftoneGlow(cx, 92, 92, ink.light ? ink.cyan : "#0FA3B1", 3.2, 1.35, 30);
  s += octahedron(cx, 92, 56, ink.amber, ink.cyan, 3.4, 0.62, 0.42, 1.28);
  s += shadowText(cx, 212, "_unLAB", {
    font: FONT.pixel,
    size: 44,
    fill: ink.green,
    shadow: ink.light ? "#0b5e0b" : "#0E6B0E",
    dx: 2.2,
    dy: 2.2,
    layers: 3,
    width: 280,
  });
  s += text(cx, 238, "THE UNSTABLE LAB", {
    font: FONT.mono,
    weight: 700,
    size: 14.5,
    fill: ink.amber,
    ls: 5.2,
    width: 262,
  });
  s += line(34, 250, 296, 250, ink.amber, 0.9);
  s += text(cx, 263, "_unOS · LEVEL −4 · SINCE 2019", {
    font: FONT.mono,
    size: 8.4,
    fill: ink.dim,
    ls: 2.2,
    width: 250,
  });
  return s;
}

/** Horizontal lock-up for the hoodie front (330 × 280). */
export function logoWide(ink: Ink): string {
  let s = "";
  s += halftoneGlow(70, 140, 70, ink.light ? ink.cyan : "#0FA3B1", 3, 1.25, 22);
  s += octahedron(70, 140, 44, ink.amber, ink.cyan, 2.8, 0.62, 0.42, 1.28);
  s += shadowText(128, 150, "_unLAB", {
    font: FONT.pixel,
    size: 31,
    fill: ink.green,
    shadow: ink.light ? "#0b5e0b" : "#0E6B0E",
    dx: 1.8,
    dy: 1.8,
    layers: 3,
    anchor: "start",
    width: 190,
  });
  s += text(128, 172, "THE UNSTABLE LAB", {
    font: FONT.mono,
    weight: 700,
    size: 10.5,
    fill: ink.amber,
    anchor: "start",
    width: 190,
  });
  s += line(128, 181, 318, 181, ink.amber, 0.7);
  s += text(128, 191, "LEVEL −4 · COLD START READY", {
    font: FONT.mono,
    size: 6.6,
    fill: ink.dim,
    anchor: "start",
    width: 190,
  });
  return s;
}

/** Glitched UNSTABLE: RGB split, sliced bands, scanlines. */
export function unstableGlitch(ink: Ink): string {
  const word = "UNSTABLE";
  const layer = (dx: number, fill: string): string =>
    text(165 + dx, 170, word, { font: FONT.archivo, size: 84, fill, width: 312, squash: true });
  const base = layer(-3.2, ink.cyan) + layer(3.2, ink.pink) + layer(0, ink.fg);
  const rnd = rng(89);
  let bands = "";
  let y = 100;
  let i = 0;
  while (y < 176) {
    const h = 3 + rnd() * 9;
    const dx = rnd() < 0.35 ? (rnd() - 0.5) * 14 : 0;
    bands += `<clipPath id="gb${i}"><rect x="0" y="${y}" width="330" height="${h}"/></clipPath>`;
    bands += `<g clip-path="url(#gb${i})" transform="translate(${dx.toFixed(2)} 0)">${base}</g>`;
    y += h;
    i++;
  }
  let s = `<defs>${scanMask("scan", 0, 96, 330, 86, 3.2, 0.7)}</defs>`;
  s += `<g mask="url(#scan)">${bands}</g>`;
  // Stray pixels flying off the glitch.
  for (let k = 0; k < 26; k++) {
    const x = 20 + rnd() * 290;
    const yy = 92 + rnd() * 92;
    s += rect(x, yy, 2 + rnd() * 9, 1.4, k % 3 ? ink.cyan : ink.pink);
  }
  s += text(165, 82, "_unLAB · PROPERTY OF", {
    font: FONT.mono,
    weight: 700,
    size: 10,
    fill: ink.amber,
    ls: 3,
    width: 180,
  });
  s += text(165, 214, "MOVEMENT IS NOT INSTABILITY.", {
    font: FONT.mono,
    weight: 700,
    size: 10.5,
    fill: ink.fg,
    width: 250,
  });
  s += text(165, 230, "MOVEMENT IS LIFE.", {
    font: FONT.mono,
    weight: 700,
    size: 10.5,
    fill: ink.green,
    width: 142,
  });
  return s;
}

/** MCP-000 … responding (reluctantly). */
export function mcpReluctantly(ink: Ink): string {
  let s = mcpEye(ink, 165, 98, 52);
  s += text(165, 196, "MCP-000", { font: FONT.pixel, size: 13, fill: ink.red, ls: 2, width: 120 });
  s += text(165, 236, "…responding", { font: FONT.term, size: 52, fill: ink.fg, width: 250 });
  s += g(
    text(0, 0, "(reluctantly)", { font: FONT.marker, size: 34, fill: ink.amber, width: 214 }),
    "translate(176 276) rotate(-5)",
  );
  return s;
}

/** Solved. Congratulations. I had put 3 % on you. */
export function mcp3Percent(ink: Ink): string {
  let s = "";
  s += text(165, 70, "SOLVED.", { font: FONT.archivo, size: 50, fill: ink.fg, width: 250 });
  s += text(165, 100, "Congratulations.", {
    font: FONT.mono,
    weight: 700,
    size: 17,
    fill: ink.green,
    width: 200,
  });
  const x = 45;
  const w = 240;
  s += text(x, 138, "MCP-000 · CONFIDENCE IN YOU", {
    font: FONT.mono,
    weight: 700,
    size: 7.6,
    fill: ink.dim,
    anchor: "start",
  });
  s += frame(x, 144, w, 26, ink.fg, 2);
  s += rect(x + 4, 148, (w - 8) * 0.03 + 0.5, 18, ink.red);
  for (let k = 1; k < 10; k++)
    s += line(x + (w * k) / 10, 170, x + (w * k) / 10, 174, ink.dim, 0.7);
  s += text(x + 14, 162, "3 %", { font: FONT.pixel, size: 9, fill: ink.red, anchor: "start" });
  s += text(165, 206, "I HAD PUT 3 % ON YOU.", {
    font: FONT.pixel,
    size: 11.5,
    fill: ink.amber,
    width: 250,
  });
  s += g(circle(0, 0, 5, ink.red) + circle(0, 0, 2, ink.hi), "translate(40 238)");
  s += text(52, 241, "the lab AI, quietly recalibrating", {
    font: FONT.mono,
    size: 8,
    fill: ink.dim,
    anchor: "start",
  });
  return s;
}

/** Congratulations. You have invented something nobody ordered. */
export function nobodyOrdered(ink: Ink): string {
  const rnd = rng(7);
  let s = "";
  // A lovingly useless prototype: a toaster with a propeller, three eyes and a tentacle.
  const cx = 165;
  s += halftoneGlow(cx, 108, 88, ink.light ? ink.violet : "#6A3FD0", 3.2, 1.3, 40);
  s += rect(cx - 52, 78, 104, 64, ink.light ? "#8c8c8c" : "#C9CED6", `rx="14"`);
  s += rect(cx - 52, 78, 104, 12, ink.light ? "#666" : "#EEF1F5", `rx="8"`);
  s +=
    rect(cx - 30, 72, 18, 8, ink.light ? "#444" : "#5a5f66", `rx="2"`) +
    rect(cx + 12, 72, 18, 8, ink.light ? "#444" : "#5a5f66", `rx="2"`);
  // Propeller.
  s += line(cx, 72, cx, 52, ink.dim, 3);
  s +=
    poly(
      [
        [cx, 52],
        [cx - 36, 44],
        [cx - 34, 52],
      ],
      ink.cyan,
    ) +
    poly(
      [
        [cx, 52],
        [cx + 36, 60],
        [cx + 34, 52],
      ],
      ink.cyan,
    );
  s += circle(cx, 52, 3.5, ink.amber);
  // Eyes.
  for (const [ex, er] of [
    [-26, 9],
    [0, 12],
    [26, 8],
  ] as const) {
    s += circle(cx + ex, 110, er, "#FFFFFF");
    s += circle(cx + ex + 2, 112, er * 0.45, "#141414");
  }
  // Tentacle.
  s += `<path d="M${cx + 52} 128 C ${cx + 90} 130, ${cx + 70} 170, ${cx + 104} 168 S ${cx + 118} 140, ${cx + 128} 150" fill="none" stroke="${ink.pink}" stroke-width="8" stroke-linecap="round"/>`;
  s += rect(cx - 44, 142, 10, 12, ink.dim) + rect(cx + 34, 142, 10, 12, ink.dim);
  // Sparks.
  for (let k = 0; k < 8; k++) s += rect(cx - 90 + rnd() * 180, 50 + rnd() * 30, 3, 3, ink.amber);
  s += text(cx, 196, "CONGRATULATIONS.", {
    font: FONT.archivo,
    size: 25,
    fill: ink.fg,
    width: 280,
  });
  s += text(cx, 222, "YOU HAVE INVENTED SOMETHING", {
    font: FONT.mono,
    weight: 700,
    size: 13,
    fill: ink.green,
    width: 280,
  });
  s += text(cx, 250, "NOBODY ORDERED.", {
    font: FONT.pixel,
    size: 17,
    fill: ink.amber,
    width: 280,
  });
  s += text(cx, 272, "— MCP-000, workbench log", { font: FONT.mono, size: 8, fill: ink.dim });
  return s;
}

/** Crystal #0089, cut into 30 slices, humming at 847 Hz (back print). */
export function crystal0089(ink: Ink): string {
  const cx = 165;
  const top = 92;
  const n = 30;
  const span = 250;
  let s = "";
  s += text(cx, 44, "CRYSTAL", { font: FONT.orbit, size: 30, fill: ink.fg, ls: 8, width: 230 });
  s += text(cx, 76, "#0089", { font: FONT.pixel, size: 22, fill: ink.amber, width: 130 });
  s += halftoneGlow(cx, top + span / 2, 150, ink.light ? ink.orange : "#C24A00", 3.6, 1.5, 40);
  // 847 Hz sine behind the slices.
  let d = "";
  for (let x = 10; x <= 320; x += 2) {
    const y =
      top + span / 2 + Math.sin((x / 320) * Math.PI * 2 * 5.5) * 26 * Math.sin((x / 320) * Math.PI);
    d += `${x === 10 ? "M" : "L"}${x} ${y.toFixed(2)} `;
  }
  s += `<path d="${d}" fill="none" stroke="${ink.cyan}" stroke-width="1.6"/>`;
  const rnd = rng(89);
  const cols = ink.light
    ? ["#F2A900", "#D96B00", "#A84400", "#FFD36B"]
    : ["#FFD36B", "#FF8A1F", "#C24A00", "#FFF1C2"];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const w = 150 * Math.pow(Math.sin(Math.PI * t), 0.75) + 8;
    const y = top + t * span;
    const dx = (rnd() - 0.5) * 10 * Math.sin(Math.PI * t);
    const hh = w * 0.18;
    const th = span / n - 2.4;
    const x = cx + dx;
    // Top face (flat rhombus) + front edges.
    s += poly(
      [
        [x - w / 2, y],
        [x, y - hh / 2],
        [x + w / 2, y],
        [x, y + hh / 2],
      ],
      cols[i % 7 === 3 ? 3 : 0]!,
    );
    s += poly(
      [
        [x - w / 2, y],
        [x, y + hh / 2],
        [x, y + hh / 2 + th],
        [x - w / 2, y + th],
      ],
      cols[1]!,
    );
    s += poly(
      [
        [x, y + hh / 2],
        [x + w / 2, y],
        [x + w / 2, y + th],
        [x, y + hh / 2 + th],
      ],
      cols[2]!,
    );
  }
  s += text(cx, 385, "30 SLICES · 847 Hz", {
    font: FONT.pixel,
    size: 13,
    fill: ink.fg,
    width: 250,
  });
  s += text(cx, 408, "THE CRYSTAL ANSWERS AT 847 HZ.", {
    font: FONT.mono,
    weight: 700,
    size: 10.5,
    fill: ink.cyan,
    width: 250,
  });
  s += barcode(115, 420, 100, 9, ink.dim, 89);
  s += text(cx, 440, "_unSLC · ARCHIVE T2 · 14.02.2019 03:27", {
    font: FONT.mono,
    size: 6.6,
    fill: ink.dim,
  });
  return s;
}

/** Periodic-table tile: Un — Unstable. "Element of surprise." */
export function elementUn(ink: Ink): string {
  const x = 80;
  const y = 30;
  const w = 170;
  let s = "";
  s += rect(x, y, w, w, ink.light ? ink.fg : ink.green, `rx="6"`);
  s += rect(x + 5, y + 5, w - 10, w - 10, ink.light ? "#F3F3F1" : "#0B120B", `rx="3"`);
  const tile = ink.light ? ink.fg : ink.green;
  s += text(x + 14, y + 26, "0089", {
    font: FONT.mono,
    weight: 700,
    size: 15,
    fill: tile,
    anchor: "start",
  });
  s += text(x + w - 14, y + 26, "847.00", {
    font: FONT.mono,
    size: 11,
    fill: ink.amber,
    anchor: "end",
  });
  s += text(x + w / 2, y + 110, "Un", { font: FONT.archivo, size: 86, fill: tile });
  s += text(x + w / 2, y + 136, "Unstable", {
    font: FONT.mono,
    weight: 700,
    size: 15,
    fill: ink.fg,
  });
  s += text(x + w / 2, y + 154, "[Halo] 3-6-4-8", { font: FONT.mono, size: 9, fill: ink.dim });
  s += text(165, 238, "ELEMENT OF", { font: FONT.archivo, size: 26, fill: ink.fg, width: 220 });
  s += text(165, 272, "SURPRISE", { font: FONT.archivo, size: 34, fill: ink.amber, width: 220 });
  s += text(165, 292, "half-life: until you look away", {
    font: FONT.mono,
    size: 8.5,
    fill: ink.dim,
  });
  return s;
}

/** It is not missing. It is inverted. */
export function inverted(ink: Ink): string {
  let s = "";
  s += text(165, 90, "IT IS NOT MISSING.", {
    font: FONT.bebas,
    size: 58,
    fill: ink.fg,
    width: 300,
  });
  s += g(
    text(0, 0, "IT IS INVERTED.", { font: FONT.bebas, size: 58, fill: ink.amber, width: 300 }),
    "translate(165 118) rotate(180)",
  );
  s += text(165, 188, "— J. LAWRENCE, COTTBUS, AROUND 3:00 A.M.", {
    font: FONT.mono,
    size: 8.5,
    fill: ink.dim,
    width: 280,
  });
  return s;
}

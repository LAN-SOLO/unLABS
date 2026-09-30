/** Crew motifs: the _unstables tour, the lore bots, Damien's echo, kids. */
import {
  FONT,
  type Ink,
  burst,
  circle,
  frame,
  g,
  halftoneGlow,
  line,
  rect,
  rng,
  scanMask,
  sprite,
  spriteSize,
  text,
} from "./kit.ts";
import { B4C0N, F1NDR, LORE_BOTS, drawSprite, spriteCard, type Sprite } from "./sprites.ts";

const TOUR: readonly [string, string, string][] = [
  ["14 FEB", "LEVEL +1 · SURFACE", "CANCELLED"],
  ["15 FEB", "LEVEL 0 · CONTROL ROOM", "SHOES OFF"],
  ["16 FEB", "LEVEL −1 · WORKSHOP", "72 % TOOLS"],
  ["17 FEB", "LEVEL −2 · CANTEEN", "NOTHING (GF)"],
  ["18 FEB", "LEVEL −3 · REACTOR", "SOLD OUT"],
  ["19 FEB", "LEVEL −4 · ???", "ERROR 404"],
  ["03:27", "THE HALO", "FOREVER"],
];

function bandLogo(ink: Ink, cx: number, y: number, scale: number): string {
  let s = "";
  s += text(cx, y, "THE", {
    font: FONT.mono,
    weight: 700,
    size: 9 * scale,
    fill: ink.amber,
    ls: 4 * scale,
  });
  s += text(cx + 1.4 * scale, y + 34 * scale + 1.4 * scale, "_unSTABLES", {
    font: FONT.neon,
    size: 34 * scale,
    fill: ink.light ? "#b9a3ff" : "#4B2A99",
    width: 280 * scale,
  });
  s += text(cx, y + 34 * scale, "_unSTABLES", {
    font: FONT.neon,
    size: 34 * scale,
    fill: ink.violet,
    width: 280 * scale,
  });
  return s;
}

/** Tour shirt front: small chest band logo. */
export function tourFront(ink: Ink): string {
  let s = bandLogo(ink, 165, 40, 0.8);
  s += text(165, 78, "BETWEEN YOUR MEASUREMENTS", {
    font: FONT.mono,
    weight: 700,
    size: 6.2,
    fill: ink.fg,
    width: 170,
  });
  s += text(165, 90, "WORLD TOUR 2026", {
    font: FONT.pixel,
    size: 6.2,
    fill: ink.amber,
    width: 110,
  });
  return s;
}

/** Tour shirt back: dates = lab levels, the ten bots as the crew. */
export function tourBack(ink: Ink): string {
  let s = bandLogo(ink, 165, 34, 1);
  s += text(165, 92, "BETWEEN YOUR MEASUREMENTS", {
    font: FONT.mono,
    weight: 700,
    size: 12,
    fill: ink.fg,
    width: 280,
  });
  s += text(165, 114, "WORLD TOUR 2026", {
    font: FONT.pixel,
    size: 14,
    fill: ink.amber,
    width: 230,
  });
  TOUR.forEach(([date, venue, note], i) => {
    const y = 150 + i * 26;
    const last = i === TOUR.length - 1;
    const noteFill =
      note === "CANCELLED" || note === "ERROR 404" ? ink.red : last ? ink.cyan : ink.green;
    const cell = { font: FONT.term, size: 18, anchor: "start" as const };
    s += text(20, y, date, { ...cell, fill: last ? ink.cyan : ink.amber });
    s += text(66, y, venue, {
      ...cell,
      fill: last ? ink.cyan : ink.fg,
      width: Math.min(158, venue.length * 7),
    });
    s += text(310, y, note, {
      ...cell,
      anchor: "end",
      fill: noteFill,
      width: Math.min(78, note.length * 7),
    });
    if (note === "CANCELLED") s += line(234, y - 5, 310, y - 5, ink.red, 1.4);
    s += line(20, y + 8, 310, y + 8, ink.dim, 0.35, `stroke-dasharray="1.2 2.4"`);
  });
  s += text(165, 346, "SUPPORTED BY", {
    font: FONT.mono,
    weight: 700,
    size: 7.5,
    fill: ink.dim,
    ls: 2,
  });
  LORE_BOTS.forEach((b, i) => {
    s += drawSprite(b, ink, 28 + i * 30.5, 396, 1.7);
  });
  s += text(
    165,
    420,
    "F1N-DR · X0-R8T · L0G-1K · P1N-DR0 · R3-TR0 · B4C-0N · D3-C4D3 · W2-REK · K2-LDR · C8-BR41N",
    { font: FONT.mono, size: 5, fill: ink.dim, width: 300 },
  );
  s += text(165, 440, "WE SAY “WE”. NEVER “I”.", {
    font: FONT.mono,
    weight: 700,
    size: 8,
    fill: ink.violet,
  });
  return s;
}

/** Hoodie front: the ten lore bots, reactivate them all. */
export function botLineup(ink: Ink): string {
  let s = text(165, 30, "REACTIVATE ALL 10", {
    font: FONT.pixel,
    size: 14,
    fill: ink.amber,
    width: 300,
  });
  LORE_BOTS.forEach((b, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    s += spriteCard(b, ink, 37 + col * 64, 124 + row * 118, 3.1);
  });
  s += text(165, 272, "THE LAB CREW · 1988 – 2016 · STILL RUNNING (MOSTLY)", {
    font: FONT.mono,
    size: 7,
    fill: ink.dim,
    width: 300,
  });
  return s;
}

/** Hoodie front: We are what persists between your measurements. */
export function betweenMeasurements(ink: Ink): string {
  let s = "";
  // Interference: two families of sine lines crossing.
  for (let k = 0; k < 9; k++) {
    let a = "";
    let b = "";
    for (let x = 0; x <= 330; x += 3) {
      const y1 = 40 + k * 22 + Math.sin(x / 26 + k * 0.5) * 9;
      const y2 = 40 + k * 22 + Math.sin(x / 19 - k * 0.7 + 2) * 9;
      a += `${x ? "L" : "M"}${x} ${y1.toFixed(2)} `;
      b += `${x ? "L" : "M"}${x} ${y2.toFixed(2)} `;
    }
    s += `<path d="${a}" fill="none" stroke="${ink.violet}" stroke-width="1.1"/>`;
    s += `<path d="${b}" fill="none" stroke="${ink.cyan}" stroke-width="0.7"/>`;
  }
  s += rect(24, 92, 282, 96, ink.light ? "#F3F3F1" : "#141414");
  s += frame(24, 92, 282, 96, ink.violet, 1.4);
  s += text(165, 124, "WE ARE WHAT PERSISTS", {
    font: FONT.archivo,
    size: 21,
    fill: ink.fg,
    width: 256,
  });
  s += text(165, 150, "BETWEEN", { font: FONT.archivo, size: 21, fill: ink.violet, width: 100 });
  s += text(165, 176, "YOUR MEASUREMENTS.", {
    font: FONT.archivo,
    size: 21,
    fill: ink.fg,
    width: 256,
  });
  s += text(165, 250, "— the _unstables", {
    font: FONT.mono,
    weight: 700,
    size: 9,
    fill: ink.violet,
  });
  return s;
}

/** The Halo responds to intent. Not to command. */
export function haloIntent(ink: Ink): string {
  let s = "";
  const cx = 165;
  const cy = 110;
  s += halftoneGlow(cx, cy, 95, ink.light ? ink.cyan : "#8FD8FF", 3.1, 1.3, 0);
  for (const [r, w] of [
    [70, 3],
    [56, 1.2],
    [84, 1],
  ] as const)
    s += circle(
      cx,
      cy,
      r,
      "none",
      `stroke="${ink.hi}" stroke-width="${w}" stroke-dasharray="${r === 70 ? "14 6" : "3 4"}"`,
    );
  s += circle(cx, cy, 22, ink.light ? "#121212" : "#E8F4FF");
  s += text(cx, 238, "THE HALO RESPONDS", {
    font: FONT.orbit,
    weight: 900,
    size: 20,
    fill: ink.fg,
    width: 280,
  });
  s += text(cx, 264, "TO INTENT.", {
    font: FONT.orbit,
    weight: 900,
    size: 20,
    fill: ink.cyan,
    width: 150,
  });
  s += text(cx, 292, "NOT TO COMMAND — TO INTENT.", {
    font: FONT.mono,
    weight: 700,
    size: 10,
    fill: ink.dim,
    width: 230,
  });
  return s;
}

const DAMIEN: Sprite = {
  id: "damien",
  name: "D.F.",
  rows: [
    ".....HHHHHH.....",
    "....HHHHHHHH....",
    "...HHssssssHH...",
    "...HBBBssBBBH...",
    "...GGGGssGGGG...",
    "...GooGGGGooG...",
    "...GGGGssGGGG...",
    "...ssssnnssss...",
    "...BsssnnsssB...",
    "...BBBmmmmBBB...",
    "...BBBBBBBBBB...",
    "....BBBBBBBB....",
    ".....BBBBBB.....",
    "..wwwwcccwwww...",
    ".wwwwwcccwwwww..",
    "wwwwwwcccwwwwww.",
  ],
  map: (ink) => ({
    H: ink.light ? "#5fb8c4" : "#B8F6FF",
    s: ink.light ? "#2a8b99" : "#4FD8E8",
    B: ink.light ? "#8fd0da" : "#DDFBFF",
    G: ink.light ? "#0090A8" : "#00F0FF",
    o: ink.light ? "#0d4a55" : "#0B5560",
    n: ink.light ? "#1f6f7a" : "#2FB6C6",
    m: ink.light ? "#0d4a55" : "#0B5560",
    w: ink.light ? "#1f6f7a" : "#1F9BAA",
    c: ink.light ? "#5fb8c4" : "#8CEFFF",
  }),
};

/** Hoodie back: Damien's hologram echo. */
export function damienEcho(ink: Ink): string {
  let s = "";
  s += text(165, 40, "RESONANCE PATTERN", {
    font: FONT.orbit,
    weight: 900,
    size: 20,
    fill: ink.fg,
    width: 280,
  });
  s += text(165, 64, "D.F. · SYNC 94.8 %", {
    font: FONT.mono,
    weight: 700,
    size: 11,
    fill: ink.cyan,
    width: 170,
  });
  s += halftoneGlow(165, 200, 150, ink.cyan, 3.6, 1.4, 60);
  const px = 14;
  const [w] = spriteSize(DAMIEN.rows, px);
  s += `<defs>${scanMask("holo", 0, 80, 330, 250, 4.2, 1.4)}</defs>`;
  s += `<g mask="url(#holo)">${sprite(DAMIEN.rows, DAMIEN.map(ink), 165 - w / 2, 88, px)}</g>`;
  // Glitch offsets.
  const rnd = rng(3);
  for (let k = 0; k < 12; k++)
    s += rect(40 + rnd() * 250, 90 + rnd() * 220, 6 + rnd() * 30, 2.2, ink.cyan);
  s += text(165, 360, "ALWAYS ASK", { font: FONT.archivo, size: 28, fill: ink.fg, width: 220 });
  s += text(165, 392, "WHY FIRST.", { font: FONT.archivo, size: 28, fill: ink.cyan, width: 200 });
  s += text(165, 418, "(cardamom in the coffee was his only heresy)", {
    font: FONT.mono,
    size: 8,
    fill: ink.dim,
  });
  return s;
}

// ── Kids (240 × 360) ─────────────────────────────────────────────

/** Junior lab assistant ID badge. */
export function kidsJunior(ink: Ink): string {
  let s = "";
  s += rect(112, 10, 16, 26, ink.dim, `rx="3"`);
  s += rect(30, 30, 180, 220, ink.light ? "#F3F3F1" : "#EEF2E8", `rx="10"`);
  s += rect(30, 30, 180, 44, ink.light ? ink.green : "#1FAF3A", `rx="10"`);
  s += rect(30, 60, 180, 14, ink.light ? ink.green : "#1FAF3A");
  s += rect(106, 38, 28, 6, "#EEF2E8", `rx="3"`);
  s += text(120, 66, "_unLAB ID", { font: FONT.pixel, size: 10, fill: "#141414" });
  s += rect(70, 86, 100, 90, "#1a1a1a", `rx="4"`);
  s += drawSprite(B4C0N, ink, 120, 168, 4.6);
  s += text(120, 202, "JUNIOR LAB", { font: FONT.archivo, size: 20, fill: "#141414", width: 160 });
  s += text(120, 224, "ASSISTANT", { font: FONT.archivo, size: 20, fill: "#141414", width: 150 });
  s += text(120, 242, "ACCESS LEVEL: SNACKS", {
    font: FONT.mono,
    weight: 700,
    size: 7.5,
    fill: "#B31212",
  });
  s += text(120, 284, "ALMOST IS JUST", { font: FONT.marker, size: 20, fill: ink.amber });
  s += text(120, 308, "ANOTHER WORD FOR SOON!", {
    font: FONT.marker,
    size: 20,
    fill: ink.amber,
    width: 220,
  });
  return s;
}

/** Prototype: unknown traits, please do not eat. */
export function kidsPrototype(ink: Ink): string {
  const cx = 120;
  let s = "";
  s += burst(cx, 120, 70, 96, 14, ink.light ? "#FFE08A" : "#3A2A5E", 4);
  const body = ink.light ? "#8e5bff" : "#B388FF";
  s += `<path d="M${cx - 60} 170 C ${cx - 70} 90, ${cx - 30} 60, ${cx} 64 C ${cx + 40} 58, ${cx + 72} 96, ${cx + 60} 170 Q ${cx + 45} 160 ${cx + 30} 172 Q ${cx + 15} 160 ${cx} 172 Q ${cx - 15} 160 ${cx - 30} 172 Q ${cx - 45} 160 ${cx - 60} 170 Z" fill="${body}"/>`;
  for (const [dx, dy, r] of [
    [-28, 104, 13],
    [6, 96, 16],
    [36, 108, 11],
  ] as const) {
    s += circle(cx + dx, dy, r, "#FFFFFF");
    s += circle(cx + dx + r * 0.2, dy + r * 0.15, r * 0.5, "#141414");
    s += circle(cx + dx + r * 0.35, dy - r * 0.1, r * 0.16, "#FFFFFF");
  }
  s += `<path d="M${cx - 22} 138 Q ${cx} 156 ${cx + 22} 138" fill="none" stroke="#141414" stroke-width="4" stroke-linecap="round"/>`;
  s += rect(cx - 9, 140, 7, 8, "#FFFFFF") + rect(cx + 3, 140, 7, 8, "#FFFFFF");
  s += line(cx - 20, 64, cx - 30, 40, body, 5) + circle(cx - 30, 38, 6, ink.lime);
  s += line(cx + 20, 62, cx + 34, 36, body, 5) + circle(cx + 34, 34, 6, ink.pink);
  s += text(cx, 222, "PROTOTYPE", { font: FONT.chunky, size: 26, fill: ink.fg, width: 210 });
  s += text(cx, 246, "UNKNOWN TRAITS", { font: FONT.pixel, size: 10, fill: ink.green, width: 170 });
  s += text(cx, 282, "please", { font: FONT.marker, size: 22, fill: ink.amber });
  s += text(cx, 312, "DO NOT EAT.", { font: FONT.marker, size: 30, fill: ink.amber, width: 200 });
  return s;
}

/** Collect all ten bots. */
export function kidsCollect(ink: Ink): string {
  let s = text(120, 30, "COLLECT", { font: FONT.pixel, size: 18, fill: ink.fg, width: 170 });
  s += text(120, 56, "ALL 10!", { font: FONT.pixel, size: 18, fill: ink.amber, width: 150 });
  const layout: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const row = Math.floor(i / 3);
    const inRow = row < 3 ? 3 : 1;
    const col = i % 3;
    layout.push([inRow === 3 ? 44 + col * 76 : 120, 122 + row * 72]);
  }
  LORE_BOTS.forEach((b, i) => {
    const [x, y] = layout[i]!;
    s += spriteCard(b, ink, x, y, 2.8);
  });
  return s;
}

/** F1N-DR: finder of lost socks. */
export function kidsFinder(ink: Ink): string {
  const cx = 120;
  let s = "";
  for (const r of [40, 62, 84, 106])
    s += `<path d="M${cx - r} 70 A ${r} ${r} 0 0 1 ${cx + r} 70" fill="none" stroke="${ink.green}" stroke-width="3" stroke-dasharray="10 6" transform="translate(0 ${-r * 0.1})"/>`;
  s += drawSprite(F1NDR, ink, cx, 196, 7);
  // A lost sock found.
  s += g(
    `<path d="M0 0 L 14 0 L 14 26 Q 14 34 22 36 L 30 38 Q 36 40 34 46 L 8 46 Q 0 46 0 38 Z" fill="${ink.pink}"/>` +
      rect(0, 0, 14, 5, ink.hi),
    "translate(186 140) rotate(12)",
  );
  s += text(cx, 244, "F1N-DR", { font: FONT.pixel, size: 18, fill: ink.green, width: 130 });
  s += text(cx, 276, "FINDER OF", { font: FONT.archivo, size: 24, fill: ink.fg, width: 170 });
  s += text(cx, 304, "LOST SOCKS", { font: FONT.archivo, size: 24, fill: ink.amber, width: 190 });
  s += text(cx, 324, "patient since 1991", { font: FONT.mono, size: 9, fill: ink.dim });
  return s;
}

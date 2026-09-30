/**
 * Pixel sprites of the lab crew (16 px wide). Colours are per sprite; `null`
 * = transparent. Outlines are left out on purpose (dark garments).
 */
import { circle, halftoneGlow, type Ink, sprite, spriteSize, text, FONT } from "./kit.ts";

export interface Sprite {
  id: string;
  name: string;
  rows: readonly string[];
  map: (ink: Ink) => Record<string, string | null>;
}

const metal = (ink: Ink): string => (ink.light ? "#5b625b" : "#9AA39A");
const dark = (ink: Ink): string => (ink.light ? "#2b2f2b" : "#39403A");

export const F1NDR: Sprite = {
  id: "f1n-dr",
  name: "F1N-DR",
  rows: [
    "......dDd.......",
    ".....dDDDd......",
    "......dDd.......",
    ".......m........",
    "...mmmmmmmmmm...",
    "...mGGGGGGGGm...",
    "...mGkGGGGkGm...",
    "...mGkGGGGkGm...",
    "...mGGGGGGGGm...",
    "...mGGkkkkGGm...",
    "...mmmmmmmmmm...",
    "....bbbbbbbb....",
    "..a.bbbAAbbb.a..",
    "..a.bbbbbbbb.a..",
    ".tttttttttttttt.",
    "tTtTtTtTtTtTtTtT",
    ".tttttttttttttt.",
  ],
  map: (ink) => ({
    d: ink.light ? "#8a948a" : "#D6DED6",
    D: ink.light ? "#5b625b" : "#9AA39A",
    m: metal(ink),
    G: ink.green,
    k: ink.light ? "#0a3a0a" : "#0B3B0B",
    b: ink.light ? "#3d6b45" : "#5E8A62",
    A: ink.amber,
    a: metal(ink),
    t: dark(ink),
    T: metal(ink),
  }),
};

export const X0R8T: Sprite = {
  id: "x0-r8t",
  name: "X0-R8T",
  rows: [
    "..wwwwwwwwwwww..",
    "..wRRRRwwRRRRw..",
    "..wRrrRwwRrrRw..",
    "..wRrrRwwRrrRw..",
    "..wRRRRwwRRRRw..",
    "..wwwwwwwwwwww..",
    "..wGGGGGGGGGGw..",
    "..wGkGGkGGkGGw..",
    "..wwwwwwwwwwww..",
    "..wbbwbbwbbwbw..",
    "..wwwwwwwwwwww..",
    "...l........l...",
    "...l........l...",
    "..ll........ll..",
  ],
  map: (ink) => ({
    w: ink.light ? "#6b4226" : "#8B5A36",
    R: ink.light ? "#2b2b2b" : "#C9C9C9",
    r: ink.light ? "#8a8a8a" : "#5a5a5a",
    G: ink.light ? "#2e9e2e" : "#7CFF7C",
    k: ink.light ? "#0a3a0a" : "#1f4f1f",
    b: ink.amber,
    l: metal(ink),
  }),
};

export const L0G1K: Sprite = {
  id: "l0g-1k",
  name: "L0G-1K",
  rows: [
    "..nnnnnnnnnnnn..",
    "..nffffffffffn..",
    "..nf-OO---O-fn..",
    "..nf--O-OO--fn..",
    "..nf-O--O--Ofn..",
    "..nffffffffffn..",
    "..nnnnnnnnnnnn..",
    "..nNNNNNNNNNNn..",
    "..nNccNNNNccNn..",
    "..nNNNNNNNNNNn..",
    "..nNNNNNNNNNNn..",
    "..nNccNNNNccNn..",
    "..nnnnnnnnnnnn..",
    "...ww......ww...",
  ],
  map: (ink) => ({
    n: ink.light ? "#1d2c55" : "#2B3F73",
    N: ink.light ? "#2f4a86" : "#3E5DA0",
    f: ink.light ? "#5f8fc0" : "#C8E6FF",
    "-": ink.light ? "#7fa9d6" : "#9AD0FF",
    O: ink.amber,
    c: ink.light ? "#555" : "#D0D6DC",
    w: dark(ink),
  }),
};

export const P1NDR0: Sprite = {
  id: "p1n-dr0",
  name: "P1N-DR0",
  rows: [
    "..........a.....",
    "..........A.....",
    ".....ooooooo....",
    "....oOOOOOOOo...",
    "....oOeeOeeOo...",
    "....oOekOekOo...",
    "....oOOOOOOOo...",
    "..ooooooooooooo.",
    ".oOOOOOOOOOOOOOo",
    ".oOyyOOOOOOOyyOo",
    ".ooooooooooooooo",
    "..WW...WW...WW..",
    "..WW...WW...WW..",
  ],
  map: (ink) => ({
    a: metal(ink),
    A: ink.red,
    o: ink.light ? "#b04a10" : "#D9621A",
    O: ink.orange,
    e: ink.light ? "#fff" : "#FFFFFF",
    k: "#1a1a1a",
    y: ink.amber,
    W: dark(ink),
  }),
};

export const R3TR0: Sprite = {
  id: "r3-tr0",
  name: "R3-TR0",
  rows: [
    "bbbbbbbbbbbbbbbb",
    "bSSSSSSSSSSSSSSb",
    "bSggggggggggggSb",
    "bSgGggggggggGgSb",
    "bSggGGggggGGggSb",
    "bSggggggggggggSb",
    "bSggGGggggGGggSb",
    "bSggggggggggggSb",
    "bSggggGGGGggggSb",
    "bSggggggggggggSb",
    "bSSSSSSSSSSSSSSb",
    "bbbbbbbbbbbbbbbb",
    "bbkkbkkbbbbbbrrb",
    "..bbbbbbbbbbbb..",
    "..KKKKKKKKKKKK..",
    ".KkKkKkKkKkKkKK.",
  ],
  map: (ink) => ({
    b: ink.light ? "#9c8f70" : "#C4B9A0",
    S: ink.light ? "#6e6450" : "#8E8470",
    g: ink.light ? "#0f2a0f" : "#10300F",
    G: ink.light ? "#39ff39" : "#33FF33",
    k: ink.light ? "#3a3a33" : "#5a5648",
    r: ink.red,
    K: ink.light ? "#b5ab90" : "#E0D6BD",
  }),
};

export const B4C0N: Sprite = {
  id: "b4c-0n",
  name: "B4C-0N",
  rows: [
    ".......rr.......",
    "......rRRr......",
    ".......mm.......",
    ".....YYYYYY.....",
    "...YYYYYYYYYY...",
    "..YYssssssssYY..",
    ".YYsshhsshhssYY.",
    ".YYssssssssssYY.",
    ".YYshssssssshYY.",
    ".YYsshhhhhhhsYY.",
    "..YYssssssssYY..",
    "...YYYYYYYYYY...",
    ".....YYYYYY.....",
    "....y......y....",
    "...yy......yy...",
  ],
  map: (ink) => ({
    r: ink.light ? "#b85c00" : "#FF8A00",
    R: ink.amber,
    m: metal(ink),
    Y: ink.light ? "#E0A800" : "#FFD23F",
    s: ink.light ? "#2a2000" : "#2A2000",
    h: ink.light ? "#FFE68A" : "#FFF3B0",
    y: metal(ink),
  }),
};

export const D3C4D3: Sprite = {
  id: "d3-c4d3",
  name: "D3-C4D3",
  rows: [
    "..pppppppppppp..",
    "..pssssssssssp..",
    "..psPPPPPPPPsp..",
    "..pssPPPPPPssp..",
    "..psssPPPPsssp..",
    "..pssssPPssssp..",
    "..psssPssPsssp..",
    "..pssPPPPPPssp..",
    "..psPPPPPPPPsp..",
    "..pppppppppppp..",
    ".......mm.......",
    ".......mm.......",
    "......mmmm......",
    ".....m.mm.m.....",
    "....m..mm..m....",
    "...m...mm...m...",
    "..mm..mmmm..mm..",
  ],
  map: (ink) => ({
    p: ink.light ? "#c2168f" : "#FF9DE2",
    s: ink.light ? "#2a0f24" : "#2A0F24",
    P: ink.light ? "#ff9de2" : "#FFD6F3",
    m: metal(ink),
  }),
};

export const W2REK: Sprite = {
  id: "w2-rek",
  name: "W2-REK",
  rows: [
    ".....oooooo.....",
    "...ooOOOOOOoo...",
    "..oOOAOOOOAOOo..",
    ".oOOAOOOOOOAOOo.",
    ".oOOOOrRRrOOOOo.",
    ".oOOOrRrrRrOOOo.",
    "..oOOOOOOOOOOo..",
    ".l.l.l....l.l.l.",
    "l.l.l......l.l.l",
    "l.l.l......l.l.l",
  ],
  map: (ink) => ({
    o: ink.light ? "#8a3416" : "#B84A22",
    O: ink.light ? "#e0582a" : "#FF7043",
    A: ink.light ? "#ff8a5c" : "#FFA07A",
    r: ink.light ? "#7a0c0c" : "#B31212",
    R: ink.red,
    l: ink.light ? "#4a3226" : "#8A6A5A",
  }),
};

export const K2LDR: Sprite = {
  id: "k2-ldr",
  name: "K2-LDR",
  rows: [
    ".....c...cc.....",
    "....cc..ccc.....",
    "..oooooooooooo..",
    "..oOOOOOOOOOOo..",
    "..oOeeOOOOeeOo..",
    "..oOekOOOOekOo..",
    "..oOOOOOOOOOOo..",
    "..oOOOOhhOOOOo..",
    "..oooooooooooo..",
    "..oOOOOOOOOOOo..",
    "..oOOOOhhOOOOo..",
    "..oOOOOOOOOOOo..",
    "..oooooooooooo..",
    "...w........w...",
    "..www......www..",
  ],
  map: (ink) => ({
    c: ink.light ? "#b8a878" : "#F4EBD0",
    o: ink.light ? "#3b4226" : "#4A5230",
    O: ink.light ? "#5f6a38" : "#6F7A45",
    e: "#F4EBD0",
    k: "#1C1F12",
    h: ink.light ? "#8c847f" : "#D7CCC8",
    w: dark(ink),
  }),
};

export const C8BR41N: Sprite = {
  id: "c8-br41n",
  name: "C8-BR41N",
  rows: [
    ".....gggggg.....",
    "...gg......gg...",
    "..g..PPpPP...g..",
    ".g..PpPPpPP...g.",
    ".g..PPPpPPP...g.",
    ".g...PpPPp....g.",
    ".gggggggggggggg.",
    "..cCCCCCCCCCCc..",
    "..cCvvCCCCvvCc..",
    "..cCCCCCCCCCCc..",
    "...cCCCCCCCCc...",
    "....cc....cc....",
    "...ccc....ccc...",
  ],
  map: (ink) => ({
    g: ink.light ? "#5aa0b8" : "#CFEFFF",
    P: ink.light ? "#a64dff" : "#C77DFF",
    p: ink.light ? "#5a00a8" : "#8B00FF",
    c: ink.light ? "#6b6b78" : "#8C8C99",
    C: ink.light ? "#9a9aa8" : "#D8D8E4",
    v: ink.light ? "#6a00d0" : "#B14DFF",
  }),
};

export const JADE: Sprite = {
  id: "jade",
  name: "Jade",
  rows: [
    "......hhhh......",
    ".....hhhhhh.....",
    "....hAAAAAAh....",
    "....hAaAAaAh....",
    "....hssssssh....",
    "....hsesseshT...",
    "....hssssssh.hh.",
    ".....ssmmss..hh.",
    "......ssss....h.",
    "....WWttttWW....",
    "...WWWttttWWW...",
    "..WWWWttttWWWW..",
    "..WW.WttttW.WW..",
    "..WW.WttttW.WW..",
    "..ss.WBBgBBW.ss.",
    ".....WttttW.....",
    ".....WttttW.....",
    ".....WddddW.....",
    "......dd.dd.....",
    "......dd.dd.....",
    "......dd.dd.....",
    ".....kkk.kkk....",
  ],
  map: (ink) => ({
    h: "#A0522D",
    A: ink.amber,
    a: ink.light ? "#FFD35A" : "#FFE08A",
    s: "#F2C6A0",
    e: "#2A1A10",
    m: "#C0605A",
    T: "#1FB5A5",
    W: ink.light ? "#d9d9d4" : "#F4F4F0",
    t: "#1F9E8F",
    B: "#6B4423",
    g: "#D4A017",
    d: ink.light ? "#2e333d" : "#4A5160",
    k: ink.light ? "#1a1a1a" : "#5a5a5a",
  }),
};

/** The ten reactivatable lore bots, in lab order. */
export const LORE_BOTS: readonly Sprite[] = [
  F1NDR,
  X0R8T,
  L0G1K,
  P1NDR0,
  R3TR0,
  B4C0N,
  D3C4D3,
  W2REK,
  K2LDR,
  C8BR41N,
];

/** Sprite at pixel size `px`, bottom-centred on (cx, baseY). */
export function drawSprite(s: Sprite, ink: Ink, cx: number, baseY: number, px: number): string {
  const [w, h] = spriteSize(s.rows, px);
  return sprite(s.rows, s.map(ink), cx - w / 2, baseY - h, px);
}

/** Sprite with its name tag underneath. */
export function spriteCard(
  s: Sprite,
  ink: Ink,
  cx: number,
  baseY: number,
  px: number,
  label = true,
): string {
  let out = drawSprite(s, ink, cx, baseY, px);
  if (label)
    out += text(cx, baseY + px * 3.2, s.name, { font: FONT.pixel, size: px * 1.35, fill: ink.fg });
  return out;
}

/** The MCP's eye: chrome rings, red iris, halftone glow. */
export function mcpEye(ink: Ink, cx: number, cy: number, r: number): string {
  const chrome = ink.light ? "#6b6f76" : "#C9CED6";
  const chromeDark = ink.light ? "#2d3035" : "#6B7079";
  let out = halftoneGlow(cx, cy, r * 1.9, ink.red, r * 0.075, r * 0.03, r * 1.02);
  out += circle(cx, cy, r, chromeDark);
  out += circle(cx, cy, r * 0.92, chrome);
  out += circle(cx, cy, r * 0.8, ink.light ? "#222" : "#1A0A0A");
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    out += circle(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, r * 0.025, chromeDark);
  }
  out += circle(cx, cy, r * 0.62, ink.light ? "#8a0f0a" : "#7A0A06");
  out += circle(cx, cy, r * 0.48, ink.red);
  out += circle(cx, cy, r * 0.3, ink.light ? "#ff6a50" : "#FF7A5C");
  out += circle(cx, cy, r * 0.14, ink.light ? "#fff0e0" : "#FFF3E8");
  out += circle(cx - r * 0.2, cy - r * 0.24, r * 0.07, "#FFFFFF");
  return out;
}

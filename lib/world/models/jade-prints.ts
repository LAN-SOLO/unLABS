/**
 * Jade's wardrobe — pixel prints for tees and hoodies (pure — no three).
 * =====================================================================
 *
 * Small voxel versions (≤ 10 × 10) of the merch motifs a `print` id names
 * (lib/world/merch.ts design ids). Each is a row list, top row first;
 * letters pick a colour from the garment's tone or a fixed ink:
 *
 *   a accent · m main · s shade · w white · k black · p pink · r red ·
 *   c cyan · y yellow · g grey · . nothing (the shirt shows)
 */
import { C } from "@/lib/world/content/palette";
import type { Canvas, Tone } from "@/lib/world/models/jade-kit";

export const PRINT_IDS = [
  "logo-classic",
  "do-not-lick",
  "status-418",
  "bot-lineup",
  "residual-charge",
  "night-shift",
] as const;

const PRINTS: Readonly<Record<string, readonly string[]>> = {
  // The wireframe crystal of the _unLAB logo over an underline.
  "logo-classic": [
    "....a.....",
    "...a.a....",
    "..a.a.a...",
    ".a..a..a..",
    "aaaaaaaaa.",
    ".a..a..a..",
    "..a.a.a...",
    "...a.a....",
    "....a.....",
    ".a.a.a.a..",
  ],
  // Hazard triangle with a pink tongue reaching for a cyan crystal.
  "do-not-lick": [
    "....aa....",
    "...a..a...",
    "...a.c.a..",
    "..a.ccc.a.",
    "..a..c..a.",
    ".a..ppp..a",
    ".a..prp..a",
    "a....p...a",
    "aaaaaaaaaa",
  ],
  // A teapot with steam over the digits 4 1 8.
  "status-418": [
    ".....w....",
    "....w.....",
    "..aaaaa...",
    "aaaaaaaa.a",
    ".aaaaaaaa.",
    "..........",
    "a.a..a.aaa",
    "a.a.aa.a.a",
    "aaa..a.aaa",
    "..a..a.a.a",
    "..a..a.aaa",
  ],
  // Ten little bots of different heights with glowing eyes.
  "bot-lineup": [
    "....g.....",
    ".g..ga..g.",
    ".a.gag.ga.",
    "gagagagaga",
    "gggggggggg",
    "g.g.g.g.g.",
  ],
  // An almost empty battery: one red segment at the bottom.
  "residual-charge": [
    "...ww.....",
    ".wwwwww...",
    ".w....w...",
    ".w....w...",
    ".w....w...",
    ".w....w...",
    ".w....w...",
    ".waaaaw...",
    ".wwwwww...",
  ],
  // A crescent moon, stars and a quiet line of text.
  "night-shift": [
    "..aaa...w.",
    ".aa.......",
    "aa.....w..",
    "aa........",
    "aa...w....",
    ".aa.......",
    "..aaa.....",
    "..........",
    "aaaa.aaaaa",
  ],
};

const INK: Readonly<Record<string, number>> = {
  w: C.paint_white,
  k: C.paint_black,
  p: C.paper_pink,
  r: C.lips,
  c: C.crystal_cyan,
  y: C.safety_yellow,
  g: C.paint_gray_lt,
};

/** The pixel rows of a print (empty for unknown ids). */
export function printRows(id: string): readonly string[] {
  return PRINTS[id] ?? [];
}

/**
 * Paint a print on the plane z (front of a garment), top row at `top`,
 * centred on x = cx (columns left → right = -x → +x seen from the front).
 * `keep` limits where it shows (e.g. inside an open coat).
 */
export function drawPrint(
  k: Canvas,
  id: string,
  t: Tone,
  cx: number,
  top: number,
  z: number,
  keep: (x: number, y: number) => boolean = () => true,
): void {
  const rows = printRows(id);
  const w = Math.max(0, ...rows.map((r) => r.length));
  const x0 = Math.round(cx - w / 2);
  rows.forEach((row, r) => {
    const y = top - r;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]!;
      if (ch === ".") continue;
      const c = ch === "a" ? t.accent : ch === "m" ? t.main : ch === "s" ? t.shade : INK[ch];
      const x = x0 + i;
      if (c && keep(x, y) && k.get(x, y, z)) k.set(x, y, z, c);
    }
  });
}

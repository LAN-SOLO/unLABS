/**
 * Bake Jade's wardrobe as iso pixel-art PNGs (visual QA + docs).
 * ==============================================================
 *
 *   pnpm exec vite-node --config scripts/audio/vite.config.mjs \
 *     scripts/wardrobe/bake-looks.ts -- [--out <dir>] [--only <item|slot>] [--sheet] [--outfits] [--pieces]
 *
 * Writes (default: all three) into `--out` (default `./.wardrobe-bake`):
 *   pieces/<item>.<colourway>.png — Jade with that piece on the default
 *                                   look, front (rotation 0) and back (2)
 *   outfits/<name>.png            — curated full looks, four rotations
 *   icons/<item>.<colourway>.png  — `wearItemGrid` icons
 *   contact-sheet.png             — every piece in every colourway (icons)
 *   contact-looks.png             — every piece worn, first colourway
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { VoxelGrid } from "@/lib/voxel/grid";
import { bakeIsoSprite, type IsoSprite } from "@/lib/voxel/iso-baker";
import { LAB_PALETTE } from "@/lib/world/content/palette";
import {
  DEFAULT_LOOK,
  WEAR_ITEMS,
  type JadeLook,
  type WearItem,
} from "@/lib/world/content/wardrobe";
import { jadeLookGrid, wearItemGrid } from "@/lib/world/models/jade-look";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = path.resolve(opt("--out") ?? ".wardrobe-bake");
const ONLY = opt("--only");
const modes = ["--sheet", "--outfits", "--pieces", "--slots"].filter((m) => args.includes(m));
const want = (m: string) => modes.length === 0 || modes.includes(m);

type Rot = 0 | 1 | 2 | 3;
const BG: [number, number, number] = [38, 40, 46];

function sprite(grid: VoxelGrid, rotation: Rot, scale = 4): IsoSprite {
  return bakeIsoSprite(grid, LAB_PALETTE, { scale, outline: true, rotation });
}

async function png(file: string, s: IsoSprite): Promise<void> {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(s.data.buffer), {
    raw: { width: s.width, height: s.height, channels: 4 },
  })
    .flatten({ background: { r: BG[0], g: BG[1], b: BG[2] } })
    .png()
    .toFile(file);
}

/** Side-by-side sprites (bottom aligned) with a gap. */
function row(sprites: IsoSprite[], gap = 8): IsoSprite {
  const width = sprites.reduce((a, s) => a + s.width, 0) + gap * (sprites.length - 1);
  const height = Math.max(...sprites.map((s) => s.height));
  const data = new Uint8ClampedArray(width * height * 4);
  let ox = 0;
  for (const s of sprites) {
    const oy = height - s.height;
    for (let y = 0; y < s.height; y++)
      for (let x = 0; x < s.width; x++) {
        const i = (y * s.width + x) * 4;
        if (!s.data[i + 3]) continue;
        const o = ((y + oy) * width + x + ox) * 4;
        data.set(s.data.subarray(i, i + 4), o);
      }
    ox += s.width + gap;
  }
  return { width, height, data, originX: 0, originY: 0 };
}

interface Cell {
  sprite: IsoSprite;
  label: string;
}

/** A labelled grid of sprites (labels via an SVG overlay). */
async function sheet(
  file: string,
  cells: Cell[],
  cols: number,
  cellW: number,
  cellH: number,
): Promise<void> {
  const rows = Math.ceil(cells.length / cols);
  const labelH = 14;
  const W = cols * cellW;
  const H = rows * (cellH + labelH);
  const composites: sharp.OverlayOptions[] = [];
  let svg = "";
  for (const [i, c] of cells.entries()) {
    const cx = (i % cols) * cellW;
    const cy = Math.floor(i / cols) * (cellH + labelH);
    const s = c.sprite;
    const k = Math.min(1, (cellW - 4) / s.width, (cellH - 4) / s.height);
    const w = Math.max(1, Math.floor(s.width * k));
    const h = Math.max(1, Math.floor(s.height * k));
    const input = await sharp(Buffer.from(s.data.buffer), {
      raw: { width: s.width, height: s.height, channels: 4 },
    })
      .resize(w, h, { kernel: "nearest" })
      .png()
      .toBuffer();
    composites.push({ input, left: cx + Math.floor((cellW - w) / 2), top: cy + (cellH - h) });
    const esc = c.label.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    svg += `<text x="${cx + cellW / 2}" y="${cy + cellH + 11}" font-family="Menlo, monospace" font-size="10" fill="#c9d0d6" text-anchor="middle">${esc}</text>`;
  }
  composites.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg}</svg>`,
    ),
    left: 0,
    top: 0,
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: BG[0], g: BG[1], b: BG[2], alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(file);
}

/** Jade with one piece on; tops, trousers and belts are shown without the lab coat. */
const on = (w: WearItem, cw: string): JadeLook => ({
  ...DEFAULT_LOOK,
  ...(w.slot === "top" || w.slot === "legs" || w.slot === "belt" ? { outer: null } : {}),
  [w.slot]: { item: w.id, colorway: cw },
});

const items = WEAR_ITEMS.filter((w) => !ONLY || w.id === ONLY || w.slot === ONLY);

const OUTFITS: Record<string, Partial<JadeLook>> = {
  default: {},
  forge: {
    top: { item: "overall_top", colorway: "grey" },
    outer: { item: "welding_apron", colorway: "leather" },
    legs: { item: "cargo_dark", colorway: "khaki" },
    head: { item: "welding_helmet", colorway: "black" },
    hands: { item: "welding_gloves", colorway: "leather" },
    belt: { item: "utility_belt", colorway: "brown" },
  },
  rain: {
    outer: { item: "raincoat", colorway: "yellow" },
    top: { item: "hoodie", colorway: "grey" },
    legs: { item: "jeans", colorway: "blue" },
    feet: { item: "rubber_boots", colorway: "yellow" },
    hair: { item: "hair_braids", colorway: "blond" },
    head: null,
    back: { item: "backpack", colorway: "olive" },
  },
  night: {
    top: { item: "hoodie_night_shift", colorway: "navy" },
    outer: null,
    legs: { item: "joggers", colorway: "black" },
    feet: { item: "slippers", colorway: "pink" },
    hair: { item: "hair_bun", colorway: "brown" },
    head: { item: "headphones", colorway: "black" },
    neck: { item: "crystal_pendant", colorway: "violet" },
    buddy: { item: "buddy_plush", colorway: "red" },
  },
  explorer: {
    top: { item: "flannel", colorway: "red" },
    outer: { item: "bomber", colorway: "olive" },
    legs: { item: "cargo_dark", colorway: "khaki" },
    feet: { item: "boots_leather", colorway: "black" },
    hair: { item: "hair_pixie", colorway: "black" },
    head: { item: "headlamp", colorway: "black" },
    back: { item: "oxygen_tank", colorway: "green" },
    wrist: { item: "wrist_computer", colorway: "olive" },
    buddy: { item: "buddy_drone", colorway: "white" },
  },
  punk: {
    top: { item: "tee_do_not_lick", colorway: "black" },
    outer: null,
    legs: { item: "skirt_plaid", colorway: "red" },
    feet: { item: "roller_boots", colorway: "white" },
    hair: { item: "hair_undercut", colorway: "magenta" },
    head: null,
    face: { item: "round_glasses", colorway: "brass" },
    neck: { item: "lanyard_keys", colorway: "red" },
    belt: { item: "fanny_pack", colorway: "neon" },
    wrist: { item: "friendship_band", colorway: "rainbow" },
  },
  hero: {
    top: { item: "turtleneck", colorway: "black" },
    outer: null,
    legs: { item: "shorts_tights", colorway: "green" },
    feet: { item: "mag_boots", colorway: "steel" },
    hair: { item: "hair_space_buns", colorway: "cerulean" },
    head: { item: "crystal_tiara", colorway: "halo" },
    face: { item: "hud_visor", colorway: "cyan" },
    hands: { item: "servo_gloves", colorway: "carbon" },
    back: { item: "cape", colorway: "red" },
    buddy: { item: "buddy_f1ndr", colorway: "grey" },
  },
  jet: {
    top: { item: "tee_418", colorway: "sky" },
    outer: null,
    legs: { item: "workpants_hivis", colorway: "orange" },
    feet: { item: "sneakers", colorway: "red" },
    hair: { item: "hair_loose", colorway: "auburn" },
    head: { item: "propeller_cap", colorway: "rainbow" },
    face: { item: "safety_glasses", colorway: "clear" },
    hands: { item: "insulated_gloves", colorway: "yellow" },
    back: { item: "jetpack", colorway: "chrome" },
    neck: { item: "bow_tie", colorway: "dots" },
    wrist: { item: "smartband", colorway: "mint" },
  },
};

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const looks: Cell[] = [];
  const icons: Cell[] = [];
  for (const w of items) {
    for (const [ci, cw] of w.colorways.entries()) {
      const grid = jadeLookGrid(on(w, cw.id));
      if (want("--pieces")) {
        const pair = row([sprite(grid, 0, 6), sprite(grid, 2, 6)]);
        await png(path.join(OUT, "pieces", `${w.id}.${cw.id}.png`), pair);
      }
      if (ci === 0) looks.push({ sprite: sprite(grid, 0, 2), label: w.id });
      const icon = sprite(wearItemGrid(w.id, cw.id), 0, 4);
      icons.push({ sprite: icon, label: `${w.id}.${cw.id}` });
      if (want("--pieces")) await png(path.join(OUT, "icons", `${w.id}.${cw.id}.png`), icon);
    }
  }
  if (want("--sheet") && !ONLY) {
    await sheet(path.join(OUT, "contact-sheet.png"), icons, 12, 150, 130);
    await sheet(path.join(OUT, "contact-looks.png"), looks, 13, 110, 170);
  } else if (want("--sheet")) {
    await sheet(path.join(OUT, "contact-sheet.png"), icons, 8, 150, 130);
    await sheet(path.join(OUT, "contact-looks.png"), looks, 8, 110, 170);
  }
  if (args.includes("--slots"))
    for (const slot of new Set(items.map((w) => w.slot))) {
      const cells: Cell[] = [];
      for (const w of items.filter((x) => x.slot === slot))
        for (const cw of w.colorways) {
          const grid = jadeLookGrid(on(w, cw.id));
          cells.push({
            sprite: row([sprite(grid, 0, 4), sprite(grid, 2, 4)]),
            label: `${w.id}.${cw.id}`,
          });
        }
      await sheet(path.join(OUT, "slots", `${slot}.png`), cells, 4, 330, 300);
    }
  if (want("--outfits"))
    for (const [name, parts] of Object.entries(OUTFITS)) {
      const grid = jadeLookGrid({ ...DEFAULT_LOOK, ...parts });
      await png(
        path.join(OUT, "outfits", `${name}.png`),
        row([0, 1, 2, 3].map((r) => sprite(grid, r as Rot))),
      );
    }
  console.log(`baked ${items.length} pieces → ${OUT}`);
}

void main();

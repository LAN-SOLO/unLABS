/**
 * Renders the merch motifs with the installed Google Chrome (Playwright):
 *
 *   node scripts/merch/render.ts [--out <dir>] [--only id,id] [--no-print] [--no-mockups]
 *
 * - Print files: transparent PNG, 3000 px wide, aspect = Shirtigo print area,
 *   155 dpi in the pHYs chunk → <out>/Druckdateien/<area>/<id>[_hell|_farbig|_pastell].png
 * - Shop previews: public/merch/designs/<id>[-light|-pop|-pastel].webp (800 px wide)
 * - Campaign mockups: <out>/Mockups/<id>_<colour>.png (garment + motif, per
 *   MOCKUP_COLORS of every ink set)
 * - Overview sheet: <out>/Uebersicht.png (every motif in every ink set)
 *
 * Default <out>: ../unlabsundevbook/research/Merge
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crc32 } from "node:zlib";
import { chromium } from "playwright";
import { INKS } from "./kit.ts";
import { AREAS, DESIGNS, designInks, type Design } from "./designs.ts";
import {
  GARMENTS,
  GARMENT_COLOR_BY_ID,
  MOCKUP_COLORS,
  type GarmentColor,
  type InkId,
} from "../../lib/world/merch-garments.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const PRINT_WIDTH = 3000;
const DPI = 155;
const PREVIEW_WIDTH = 800;

const args = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = resolve(arg("--out") ?? join(ROOT, "../unlabsundevbook/research/Merge"));
const ONLY = arg("--only")?.split(",");
const PRINT = !args.includes("--no-print");
const MOCKUPS = !args.includes("--no-mockups");

const FONTS: Record<string, string> = {
  PressStart: "PressStart2P-400",
  VT323: "VT323-400",
  SpaceMono: "SpaceMono-400",
  ShareTech: "ShareTechMono-400",
  RubikMono: "RubikMonoOne-400",
  Bungee: "Bungee-400",
  BungeeShade: "BungeeShade-400",
  Silkscreen: "Silkscreen-400",
  Monoton: "Monoton-400",
  Marker: "PermanentMarker-400",
  BlackOps: "BlackOpsOne-400",
  RubikGlitch: "RubikGlitch-400",
  Orbitron: "Orbitron-900",
  ArchivoBlack: "ArchivoBlack-400",
  MajorMono: "MajorMonoDisplay-400",
  WetPaint: "RubikWetPaint-400",
  Bebas: "BebasNeue-400",
  SpecialElite: "SpecialElite-400",
};

function fontFaces(): string {
  let css = "";
  for (const [fam, file] of Object.entries(FONTS)) {
    const url = pathToFileURL(join(HERE, "fonts", `${file}.woff2`)).href;
    css += `@font-face{font-family:"${fam}";src:url("${url}") format("woff2");font-weight:100 900;}`;
  }
  // Space Mono bold.
  css += `@font-face{font-family:"SpaceMono";font-weight:700;src:url("${pathToFileURL(join(HERE, "fonts", "SpaceMono-700.woff2")).href}") format("woff2");}`;
  css += `@font-face{font-family:"Silkscreen";font-weight:700;src:url("${pathToFileURL(join(HERE, "fonts", "Silkscreen-700.woff2")).href}") format("woff2");}`;
  return css;
}

/** Replace / add the pHYs chunk (pixels per metre) of a PNG. */
export function withDpi(png: Buffer, dpi: number): Buffer {
  const sig = png.subarray(0, 8);
  const chunks: Buffer[] = [];
  let off = 8;
  let ihdrEnd = -1;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString("ascii", off + 4, off + 8);
    const end = off + 12 + len;
    if (type !== "pHYs") chunks.push(png.subarray(off, end));
    if (type === "IHDR") ihdrEnd = chunks.length;
    off = end;
  }
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppm, 0);
  data.writeUInt32BE(ppm, 4);
  data.writeUInt8(1, 8);
  const typeAndData = Buffer.concat([Buffer.from("pHYs", "ascii"), data]);
  const phys = Buffer.alloc(12 + 9);
  phys.writeUInt32BE(9, 0);
  typeAndData.copy(phys, 4);
  phys.writeUInt32BE(crc32(typeAndData) >>> 0, 17);
  chunks.splice(ihdrEnd, 0, phys);
  return Buffer.concat([sig, ...chunks]);
}

/** File-name suffixes per ink set: print files (German) and shop previews. */
const PRINT_SUFFIX: Record<InkId, string> = {
  dark: "",
  light: "_hell",
  pop: "_farbig",
  pastel: "_pastell",
};
const PREVIEW_SUFFIX: Record<InkId, string> = {
  dark: "",
  light: "-light",
  pop: "-pop",
  pastel: "-pastel",
};

function designSvg(d: Design, ink: InkId, widthPx: number): { svg: string; w: number; h: number } {
  const a = AREAS[d.area];
  const h = Math.round((widthPx * a.h) / a.w);
  const body = d.draw(INKS[ink]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${h}" viewBox="0 0 ${a.w} ${a.h}" text-rendering="geometricPrecision" shape-rendering="geometricPrecision">${body}</svg>`;
  return { svg, w: widthPx, h };
}

function mockupSvg(d: Design, color: GarmentColor, designUrl: string): string {
  const area = AREAS[d.area];
  const shape = GARMENTS[area.garment];
  const p = shape.print[area.side];
  const shade = color.light ? "#00000026" : "#00000080";
  const neck = area.side === "front" ? shape.frontNeck : shape.backNeck;
  const details = area.side === "front" ? shape.details.front : shape.details.back;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.vw} ${shape.vh}" width="1600" height="${Math.round((1600 * shape.vh) / shape.vw)}">
<defs><linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
<path d="${shape.body}" fill="${color.hex}"/><path d="${shape.body}" fill="url(#sh)"/>
<path d="${neck}" fill="${shade}"/><path d="${details}" fill="none" stroke="${shade}" stroke-width="3" stroke-linecap="round"/>
<image href="${designUrl}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>
</svg>`;
}

async function main(): Promise<void> {
  const designs = DESIGNS.filter((d) => !ONLY || ONLY.includes(d.id));
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const tmp = join(HERE, ".render.html");
  writeFileSync(
    tmp,
    `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()} html,body{margin:0;background:transparent}#c{display:inline-block;line-height:0}</style></head><body><div id="c"></div><div style="position:absolute;left:-9999px">${Object.keys(
      FONTS,
    )
      .map((f) => `<span style="font-family:${f}">Aa0ÄÖÜß</span>`)
      .join("")}</div></body></html>`,
  );
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);

  const shot = async (svg: string, w: number, h: number): Promise<Buffer> => {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate((s) => {
      document.getElementById("c")!.innerHTML = s;
    }, svg);
    await page.evaluate(() => document.fonts.ready);
    return page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: w, height: h },
      type: "png",
    });
  };

  const toWebp = async (png: Buffer, w: number, h: number): Promise<Buffer> => {
    const url = await page.evaluate(
      async ([b64, cw, ch]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = cw;
        c.height = ch;
        c.getContext("2d")!.drawImage(img, 0, 0, cw, ch);
        return c.toDataURL("image/webp", 0.9);
      },
      [png.toString("base64"), w, h] as const,
    );
    return Buffer.from(url.split(",")[1]!, "base64");
  };

  const previewDir = join(ROOT, "public/merch/designs");
  mkdirSync(previewDir, { recursive: true });
  const overview: { id: string; png: string; bg: string }[] = [];

  for (const d of designs) {
    for (const ink of designInks(d)) {
      const suffix = PRINT_SUFFIX[ink];
      if (PRINT) {
        const { svg, w, h } = designSvg(d, ink, PRINT_WIDTH);
        const png = withDpi(await shot(svg, w, h), DPI);
        const dir = join(OUT, "Druckdateien", AREAS[d.area].folder);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${d.id}${suffix}.png`), png);
      }
      const pv = designSvg(d, ink, PREVIEW_WIDTH);
      const small = await shot(pv.svg, pv.w, pv.h);
      writeFileSync(
        join(previewDir, `${d.id}${PREVIEW_SUFFIX[ink]}.webp`),
        await toWebp(small, pv.w, pv.h),
      );
      const colors = MOCKUP_COLORS[ink].map((c) => GARMENT_COLOR_BY_ID.get(c)!);
      overview.push({
        id: `${d.id}${suffix}`,
        png: small.toString("base64"),
        bg: ink === "dark" ? "transparent" : colors[0]!.hex,
      });
      if (MOCKUPS) {
        const url = `data:image/png;base64,${small.toString("base64")}`;
        for (const color of colors) {
          const svg = mockupSvg(d, color, url);
          const shape = GARMENTS[AREAS[d.area].garment];
          const mh = Math.round((1600 * shape.vh) / shape.vw);
          const bg = `<div style="width:1600px;height:${mh}px;background:${color.light ? "#e9e9e6" : "#1d1f22"}">${svg}</div>`;
          await page.setViewportSize({ width: 1600, height: mh });
          await page.evaluate((s) => {
            document.getElementById("c")!.innerHTML = s;
          }, bg);
          await page.waitForTimeout(30);
          const mock = await page.screenshot({
            clip: { x: 0, y: 0, width: 1600, height: mh },
            type: "png",
          });
          const dir = join(OUT, "Mockups");
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${d.id}_${color.id}.png`), mock);
        }
      }
      console.log(`✓ ${d.id}${suffix}`);
    }
  }

  {
    // Overview sheet: every motif in every ink set on its cloth colour, 6 per row.
    const cols = Math.min(6, overview.length);
    const cell = ONLY ? 560 : 360;
    const rows = Math.ceil(overview.length / cols);
    const W = cols * cell;
    const H = rows * (cell + 40) + 80;
    const cells = overview
      .map(
        (o, i) =>
          `<div style="position:absolute;left:${(i % cols) * cell}px;top:${80 + Math.floor(i / cols) * (cell + 40)}px;width:${cell}px;height:${cell + 40}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${o.bg}"><img src="data:image/png;base64,${o.png}" style="max-width:${cell - 30}px;max-height:${cell - 30}px"/><div style="font:14px SpaceMono;color:#FFB800;background:#161718;padding:0 6px;margin-top:6px">${o.id}</div></div>`,
      )
      .join("");
    await page.setViewportSize({ width: W, height: H });
    await page.evaluate((s) => {
      document.getElementById("c")!.innerHTML = s;
    }, `<div style="position:relative;width:${W}px;height:${H}px;background:#161718"><div style="position:absolute;left:30px;top:22px;font:32px PressStart;color:#33FF33">_unLAB MERCH · ${overview.length} MOTIVE</div>${cells}</div>`);
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    writeFileSync(
      ONLY ? join(HERE, ".review.png") : join(OUT, "Uebersicht.png"),
      await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } }),
    );
  }
  await browser.close();
  if (existsSync(tmp)) unlinkSync(tmp);
  console.log(`done → ${OUT}`);
}

await main();

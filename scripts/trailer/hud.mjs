// HUD text for the trailers' post layer (docs/TRANSMISSIONS.md): the 5 × 7
// voxel font of blender/font.py, drawn as crisp RGBA PNGs that assemble.mjs
// overlays. Lives in post so the readouts stay sharp under depth of field and
// can be retimed without re-rendering.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));

/** char → 7 rows of 5 ("#" = on), parsed from blender/font.py (one source). */
const GLYPHS = (() => {
  const src = readFileSync(join(here, "blender/font.py"), "utf8");
  const out = new Map();
  for (const m of src.matchAll(/^\s+"(.)": \[((?:"[.#]{5}",?\s*){7})\]/gm)) {
    out.set(
      m[1],
      [...m[2].matchAll(/"([.#]{5})"/g)].map((r) => r[1]),
    );
  }
  return out;
})();

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Render `text` at `px` screen pixels per font pixel, in `color` (hex), with a
 * soft dark shadow so it reads over bright frames. Returns { file, w, h }.
 */
export function hudText(text, px, color, dir) {
  const key = createHash("sha1").update(`${text}|${px}|${color}`).digest("hex").slice(0, 12);
  const file = join(dir, `${key}.png`);
  const lines = text.split("\n");
  const pad = px;
  const w = Math.max(...lines.map((l) => l.length)) * 6 * px - px + pad * 2;
  const h = lines.length * 10 * px - 3 * px + pad * 2;
  if (existsSync(file)) return { file, w, h };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const on = new Uint8Array(w * h);
  lines.forEach((ln, li) => {
    [...ln].forEach((ch, ci) => {
      const gl = GLYPHS.get(ch) ?? GLYPHS.get(ch.toUpperCase());
      if (!gl) return;
      gl.forEach((row, ry) => {
        [...row].forEach((cell, rx) => {
          if (cell !== "#") return;
          for (let y = 0; y < px; y++)
            for (let x = 0; x < px; x++) {
              const X = pad + (ci * 6 + rx) * px + x;
              const Y = pad + (li * 10 + ry) * px + y;
              on[Y * w + X] = 1;
            }
        });
      });
    });
  });
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (on[i]) {
        rgba.set([r, g, b, 255], i * 4);
        continue;
      }
      // Shadow: any lit pixel within `px` → translucent black.
      let near = false;
      for (let dy = -px; dy <= px && !near; dy++)
        for (let dx = -px; dx <= px && !near; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && on[yy * w + xx]) near = true;
        }
      if (near) rgba.set([0, 0, 0, 120], i * 4);
    }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, png(w, h, rgba));
  return { file, w, h };
}

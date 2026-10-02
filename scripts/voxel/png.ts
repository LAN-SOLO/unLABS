/**
 * PNG writing + sprite trimming for the voxel pipeline's reference pictures —
 * byte-for-byte the rules of the undevbook's sprite baker
 * (unlabsundevbook/scripts/extract/sprites.ts: `png`, `trim`, `scaleFor`),
 * so a reference here equals the book's picture of the same grid.
 */
import zlib from "node:zlib";
import type { VoxelGrid } from "@/lib/voxel/grid";

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** RGBA8 → PNG bytes. */
export function png(width: number, height: number, rgba: Uint8ClampedArray | Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ]);
}

/** Trim fully transparent borders (keeps a 1 px margin). */
export function trim(
  w: number,
  h: number,
  d: Uint8ClampedArray,
): { w: number; h: number; d: Uint8ClampedArray; x0: number; y0: number } {
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3]! > 0) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return { w: 1, h: 1, d: new Uint8ClampedArray(4), x0: 0, y0: 0 };
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  x1 = Math.min(w - 1, x1 + 1);
  y1 = Math.min(h - 1, y1 + 1);
  const nw = x1 - x0 + 1;
  const nh = y1 - y0 + 1;
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++)
    out.set(d.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * nw * 4);
  return { w: nw, h: nh, d: out, x0, y0 };
}

/** The book's pixel scale for a picture of about `target` px. */
export function scaleFor(g: VoxelGrid, target: number): number {
  const span = Math.max(g.sx + g.sz, g.sy * 1.2);
  return Math.max(2, Math.min(12, Math.round(target / span / 2) * 2));
}

/**
 * GIF89a encoder for crystal captures (pure; ported from the undevbook's
 * `src/lib/slices.ts` — keep both in sync). One global palette (median cut
 * over all frames), LZW, infinite loop: enough for 30 slices of glow on
 * black. Works on anything shaped like `ImageData`, so it runs in Node too.
 */

/** RGBA pixels of one frame (`ImageData` fits). */
export interface GifFrame {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

/**
 * Minimal GIF89a encoder: one global palette (median cut over all frames),
 * LZW, infinite loop. Enough for 30 slices of glow on black.
 */
export function encodeGif(frames: readonly GifFrame[], delayMs: number): Uint8Array {
  const w = frames[0]!.width;
  const h = frames[0]!.height;
  const palette = medianCut(frames, 256);
  const lookup = new Map<number, number>();
  const nearest = (r: number, g: number, b: number): number => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    const hit = lookup.get(key);
    if (hit !== undefined) return hit;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i]!;
      const d = (p[0] - r) ** 2 * 3 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    lookup.set(key, best);
    return best;
  };
  const out = new ByteWriter();
  out.str("GIF89a");
  out.u16(w);
  out.u16(h);
  out.u8(0xf7); // global colour table, 8 bits, 256 entries
  out.u8(0);
  out.u8(0);
  for (let i = 0; i < 256; i++) {
    const p = palette[i] ?? [0, 0, 0];
    out.u8(p[0]);
    out.u8(p[1]);
    out.u8(p[2]);
  }
  // NETSCAPE2.0 loop forever
  out.bytes([0x21, 0xff, 0x0b]);
  out.str("NETSCAPE2.0");
  out.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);
  const delay = Math.max(2, Math.round(delayMs / 10));
  for (const f of frames) {
    out.bytes([0x21, 0xf9, 0x04, 0x04]);
    out.u16(delay);
    out.bytes([0x00, 0x00]);
    out.u8(0x2c);
    out.u16(0);
    out.u16(0);
    out.u16(w);
    out.u16(h);
    out.u8(0);
    const idx = new Uint8Array(w * h);
    const d = f.data;
    for (let i = 0, j = 0; i < idx.length; i++, j += 4)
      idx[i] = nearest(d[j]!, d[j + 1]!, d[j + 2]!);
    lzw(out, idx, 8);
  }
  out.u8(0x3b);
  return out.done();
}

function medianCut(frames: readonly GifFrame[], n: number): [number, number, number][] {
  // Sample pixels (every frame, strided) into a histogram of 5-bit colours.
  const hist = new Map<number, number>();
  for (const f of frames) {
    const d = f.data;
    for (let j = 0; j < d.length; j += 4 * 3) {
      const key = ((d[j]! >> 3) << 10) | ((d[j + 1]! >> 3) << 5) | (d[j + 2]! >> 3);
      hist.set(key, (hist.get(key) ?? 0) + 1);
    }
  }
  type Px = [number, number, number, number];
  const px: Px[] = [...hist].map(([k, c]) => [
    ((k >> 10) & 31) * 8 + 4,
    ((k >> 5) & 31) * 8 + 4,
    (k & 31) * 8 + 4,
    c,
  ]);
  // Pure black is by far the most common colour: reserve it exactly.
  const boxes: Px[][] = [px];
  while (boxes.length < n - 1) {
    let bi = -1;
    let bestRange = 0;
    let axis = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let a = 0; a < 3; a++) {
        let lo = 255;
        let hi = 0;
        for (const p of b) {
          lo = Math.min(lo, p[a]!);
          hi = Math.max(hi, p[a]!);
        }
        const weight = hi - lo;
        if (weight > bestRange) {
          bestRange = weight;
          bi = i;
          axis = a;
        }
      }
    });
    if (bi < 0) break;
    const b = boxes[bi]!.sort((p, q) => p[axis]! - q[axis]!);
    const total = b.reduce((s, p) => s + p[3], 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < b.length; i++) {
      acc += b[i]![3];
      if (acc >= total / 2) {
        cut = Math.max(1, Math.min(b.length - 1, i));
        break;
      }
    }
    boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
  }
  const pal: [number, number, number][] = [[0, 0, 0]];
  for (const b of boxes) {
    let r = 0;
    let g = 0;
    let bl = 0;
    let c = 0;
    for (const p of b) {
      r += p[0] * p[3];
      g += p[1] * p[3];
      bl += p[2] * p[3];
      c += p[3];
    }
    if (c) pal.push([Math.round(r / c), Math.round(g / c), Math.round(bl / c)]);
  }
  return pal.slice(0, n);
}

class ByteWriter {
  private buf = new Uint8Array(1 << 16);
  private n = 0;
  private grow(k: number): void {
    if (this.n + k <= this.buf.length) return;
    let len = this.buf.length * 2;
    while (len < this.n + k) len *= 2;
    const b = new Uint8Array(len);
    b.set(this.buf.subarray(0, this.n));
    this.buf = b;
  }
  u8(v: number): void {
    this.grow(1);
    this.buf[this.n++] = v & 255;
  }
  u16(v: number): void {
    this.u8(v & 255);
    this.u8((v >> 8) & 255);
  }
  bytes(a: number[] | Uint8Array): void {
    this.grow(a.length);
    this.buf.set(a, this.n);
    this.n += a.length;
  }
  str(s: string): void {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }
  done(): Uint8Array {
    return this.buf.slice(0, this.n);
  }
}

/** GIF LZW with variable code size and 255-byte sub-blocks. */
function lzw(out: ByteWriter, idx: Uint8Array, minCode: number): void {
  out.u8(minCode);
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let codeSize = minCode + 1;
  let next = eoi + 1;
  let dict = new Map<number, number>();
  const block: number[] = [];
  let bits = 0;
  let nbits = 0;
  const emit = (code: number) => {
    bits |= code << nbits;
    nbits += codeSize;
    while (nbits >= 8) {
      block.push(bits & 255);
      bits >>>= 8;
      nbits -= 8;
      if (block.length === 255) {
        out.u8(255);
        out.bytes(block);
        block.length = 0;
      }
    }
  };
  emit(clear);
  let prefix = idx[0]!;
  for (let i = 1; i < idx.length; i++) {
    const c = idx[i]!;
    const key = (prefix << 8) | c;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      codeSize = minCode + 1;
      next = eoi + 1;
    }
    prefix = c;
  }
  emit(prefix);
  emit(eoi);
  if (nbits > 0) block.push(bits & 255);
  if (block.length) {
    out.u8(block.length);
    out.bytes(block);
  }
  out.u8(0);
}

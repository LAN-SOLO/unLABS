/**
 * A 256-entry RGBA palette. Index 0 is always "empty" (never rendered).
 * Colors are sRGB bytes exactly as stored in a .vox RGBA chunk.
 */
export class Palette {
  /** 256 * 4 bytes: r, g, b, a per palette index. */
  readonly rgba: Uint8Array;

  constructor(rgba?: Uint8Array) {
    if (rgba && rgba.length !== 1024)
      throw new Error(`palette needs 1024 bytes, got ${rgba.length}`);
    this.rgba = rgba ?? new Uint8Array(1024);
  }

  /** Build from CSS hex strings; entry i becomes palette index i + 1. */
  static fromHex(colors: readonly string[]): Palette {
    if (colors.length > 255) throw new Error("a palette holds at most 255 colors");
    const p = new Palette();
    colors.forEach((hex, i) => p.set(i + 1, hexToRgb(hex)));
    return p;
  }

  set(index: number, [r, g, b]: readonly [number, number, number], a = 255): void {
    assertIndex(index);
    this.rgba.set([r, g, b, a], index * 4);
  }

  /** sRGB bytes [r, g, b, a]. */
  get(index: number): [number, number, number, number] {
    assertIndex(index);
    const o = index * 4;
    return [this.rgba[o]!, this.rgba[o + 1]!, this.rgba[o + 2]!, this.rgba[o + 3]!];
  }

  /** Linear-space floats 0..1 — what WebGL vertex colors expect. */
  linear(index: number): [number, number, number] {
    const [r, g, b] = this.get(index);
    return [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];
  }

  /** First index whose color matches exactly, or -1. */
  find(hex: string): number {
    const [r, g, b] = hexToRgb(hex);
    for (let i = 1; i < 256; i++) {
      const o = i * 4;
      if (this.rgba[o] === r && this.rgba[o + 1] === g && this.rgba[o + 2] === b) return i;
    }
    return -1;
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`invalid color '${hex}', expected #rrggbb`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function assertIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index > 255)
    throw new Error(`palette index ${index} out of 0..255`);
}

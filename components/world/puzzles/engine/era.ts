/**
 * Era-Shader — pure image + checksum logic (PZ_ERA_SHADER_DEMO).
 *
 * A 16×16 "Kristall-Vorschau" is generated from the seed. Four era filters
 * (8/16/32/64 bit) quantise it to 4/16/64/256 colours, optionally with an
 * ordered 4×4 Bayer dither. A CRC-16/CCITT over the quantised RGB bytes is
 * the visual checksum. The generator salts the image until all 8 settings
 * produce distinct checksums, so exactly one setting matches the target.
 */
import { mulberry32 } from "@/components/world/puzzles/rng";

export const ERA_BITS = [8, 16, 32, 64] as const;
export type EraBits = (typeof ERA_BITS)[number];
export const IMG = 16;

export interface EraSetting {
  bits: EraBits;
  dither: boolean;
}

export function toEraBits(v: number): EraBits {
  const found = ERA_BITS.find((b) => b === v);
  return found ?? 16;
}

/** RGB bytes, row-major, length IMG*IMG*3. */
export type RgbImage = number[];

export function generateImage(seed: number, salt = 0): RgbImage {
  const rng = mulberry32((seed * 7919 + salt * 104729) >>> 0);
  const hueA = rng() * Math.PI * 2;
  const hueB = hueA + 1.2 + rng() * 1.5;
  const cx = 7.5 + (rng() - 0.5) * 2;
  const cy = 7.5 + (rng() - 0.5) * 2;
  const radius = 5 + rng() * 2;
  const facets = 5 + Math.floor(rng() * 3);
  const out: number[] = [];
  for (let y = 0; y < IMG; y++) {
    for (let x = 0; x < IMG; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const ang = Math.atan2(dy, dx);
      // Faceted crystal outline: radius modulated per facet.
      const facet = Math.cos((ang * facets) / 2) * 0.8;
      const d = Math.sqrt(dx * dx + dy * dy) / (radius + facet);
      const noise = (rng() - 0.5) * 0.18;
      let r: number;
      let g: number;
      let b: number;
      if (d < 1) {
        const light = 0.35 + 0.6 * (1 - d) + 0.25 * Math.sin(ang * facets + hueA) + noise;
        const hue = d < 0.5 ? hueA : hueB;
        r = light * (0.5 + 0.5 * Math.cos(hue));
        g = light * (0.5 + 0.5 * Math.cos(hue - 2.094));
        b = light * (0.5 + 0.5 * Math.cos(hue + 2.094));
      } else {
        // Dark lab background with a faint green phosphor gradient.
        const bg = 0.05 + 0.1 * (y / IMG) + noise * 0.3;
        r = bg * 0.3;
        g = bg;
        b = bg * 0.5;
      }
      out.push(clampByte(r * 255), clampByte(g * 255), clampByte(b * 255));
    }
  }
  return out;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 8-bit era: 4-colour green phosphor palette (by luminance). */
const PHOSPHOR4: readonly (readonly [number, number, number])[] = [
  [8, 16, 8],
  [24, 96, 40],
  [60, 190, 80],
  [190, 255, 170],
];

/** Per-channel levels for 16/32/64 bit: 2·4·2 = 16, 4·4·4 = 64, 8·8·4 = 256. */
const LEVELS: Record<Exclude<EraBits, 8>, readonly [number, number, number]> = {
  16: [2, 4, 2],
  32: [4, 4, 4],
  64: [8, 8, 4],
};

function quantChannel(v: number, levels: number, offset: number): number {
  const step = 255 / (levels - 1);
  const q = Math.round(Math.max(0, Math.min(255, v + offset * step)) / step);
  return clampByte(q * step);
}

export function quantize(img: RgbImage, bits: EraBits, dither: boolean): RgbImage {
  const out: number[] = [];
  for (let y = 0; y < IMG; y++) {
    for (let x = 0; x < IMG; x++) {
      const i = (y * IMG + x) * 3;
      const t = dither ? (BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) / 16 - 0.5 : 0;
      const r = img[i] ?? 0;
      const g = img[i + 1] ?? 0;
      const b = img[i + 2] ?? 0;
      if (bits === 8) {
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        const idx = Math.max(0, Math.min(3, Math.round(lum / 85 + t)));
        const [pr, pg, pb] = PHOSPHOR4[idx];
        out.push(pr, pg, pb);
        continue;
      }
      const [lr, lg, lb] = LEVELS[bits];
      let qr = quantChannel(r, lr, t);
      let qg = quantChannel(g, lg, t);
      let qb = quantChannel(b, lb, t);
      if (bits === 64 && y % 2 === 1) {
        // Scanlines.
        qr = Math.round(qr * 0.7);
        qg = Math.round(qg * 0.7);
        qb = Math.round(qb * 0.7);
      }
      out.push(qr, qg, qb);
    }
  }
  return out;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF). */
export function crc16(bytes: readonly number[]): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= (byte & 0xff) << 8;
    for (let k = 0; k < 8; k++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function hex4(v: number): string {
  return (v & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

export const ERA_SETTINGS: readonly EraSetting[] = ERA_BITS.flatMap((bits) => [
  { bits, dither: false },
  { bits, dither: true },
]);

export interface EraPuzzle {
  image: RgbImage;
  /** Checksum per setting key `${bits}${d|n}`. */
  sums: Record<string, number>;
  target: EraSetting;
  targetSum: number;
}

export function settingKey(s: EraSetting): string {
  return `${s.bits}${s.dither ? "d" : "n"}`;
}

export function eraChecksum(img: RgbImage, bits: EraBits, dither: boolean): number {
  return crc16(quantize(img, bits, dither));
}

export function generateEra(seed: number, targetBits: number, targetDither: boolean): EraPuzzle {
  const target: EraSetting = { bits: toEraBits(targetBits), dither: targetDither };
  for (let salt = 0; salt < 64; salt++) {
    const image = generateImage(seed, salt);
    const sums: Record<string, number> = {};
    for (const s of ERA_SETTINGS) sums[settingKey(s)] = eraChecksum(image, s.bits, s.dither);
    if (new Set(Object.values(sums)).size === ERA_SETTINGS.length) {
      return { image, sums, target, targetSum: sums[settingKey(target)] };
    }
  }
  throw new Error(`Era generation failed for seed ${seed}`);
}

/**
 * How the checksum reads on the era's display. In 8 bit the blocky font
 * makes B look like 8, D like 0 and 5 like S.
 */
export function displayHex(hex: string, bits: EraBits): string {
  if (bits !== 8) return hex;
  return hex.replace(/B/g, "8").replace(/D/g, "0").replace(/5/g, "S");
}

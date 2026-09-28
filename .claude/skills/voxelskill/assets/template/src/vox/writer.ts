import type { Vec3 } from '@/voxel/grid';
import type { Palette } from '@/voxel/palette';
import type { VoxDict } from '@/vox/types';

export interface WriteModel {
  /** MagicaVoxel axes (z = up). Each axis 1..256. */
  size: Vec3;
  /** Packed x, y, z, colorIndex bytes. */
  xyzi: Uint8Array;
  /** Optional world translation of the model's center (MagicaVoxel axes). */
  translation?: Vec3;
  name?: string;
}

export interface WriteOptions {
  palette: Palette;
  /** MATL dicts keyed by palette index, e.g. { _type: '_emit', _emit: '1' }. */
  materials?: Map<number, VoxDict>;
}

/**
 * Writes a .vox (version 150) that MagicaVoxel opens with every model placed
 * in the world editor: root nTRN → nGRP → (nTRN → nSHP) per model.
 */
export function writeVox(models: readonly WriteModel[], opts: WriteOptions): Uint8Array {
  if (models.length === 0) throw new Error('writeVox needs at least one model');
  const w = new Writer();
  const children: number[][] = [];

  models.forEach((m) => {
    if (m.size.some((s) => !Number.isInteger(s) || s < 1 || s > 256)) throw new Error(`model size ${m.size.join('x')} outside 1..256`);
    if (m.xyzi.length % 4 !== 0) throw new Error('xyzi length must be a multiple of 4');
    children.push(chunk('SIZE', [...i32(m.size[0]), ...i32(m.size[1]), ...i32(m.size[2])]));
    children.push(chunk('XYZI', [...i32(m.xyzi.length / 4), ...m.xyzi]));
  });

  // Scene graph: node 0 root transform, node 1 group, then transform/shape pairs.
  children.push(chunk('nTRN', [...i32(0), ...dict({}), ...i32(1), ...i32(-1), ...i32(-1), ...i32(1), ...dict({})]));
  const groupChildren = models.map((_, k) => 2 + k * 2);
  children.push(chunk('nGRP', [...i32(1), ...dict({}), ...i32(models.length), ...groupChildren.flatMap(i32)]));
  models.forEach((m, k) => {
    const t = m.translation ?? [0, 0, Math.floor(m.size[2] / 2)];
    const attrs: VoxDict = m.name ? { _name: m.name } : {};
    children.push(chunk('nTRN', [
      ...i32(2 + k * 2), ...dict(attrs), ...i32(3 + k * 2), ...i32(-1), ...i32(0), ...i32(1),
      ...dict({ _t: `${t[0]} ${t[1]} ${t[2]}` }),
    ]));
    children.push(chunk('nSHP', [...i32(3 + k * 2), ...dict({}), ...i32(1), ...i32(k), ...dict({})]));
  });

  // RGBA: palette indices 1..255, then the unused 256th entry.
  const rgba = new Uint8Array(1024);
  rgba.set(opts.palette.rgba.subarray(4, 1024), 0);
  children.push(chunk('RGBA', [...rgba]));

  for (const [id, props] of opts.materials ?? []) children.push(chunk('MATL', [...i32(id), ...dict(props)]));

  const body = children.flat();
  w.bytes('VOX ');
  w.push(i32(150));
  w.bytes('MAIN');
  w.push(i32(0));
  w.push(i32(body.length));
  w.push(body);
  return w.result();
}

/** Pack a list of [x, y, z, colorIndex] voxels (MagicaVoxel axes) into XYZI bytes. */
export function packXyzi(voxels: Iterable<readonly [number, number, number, number]>): Uint8Array {
  const out: number[] = [];
  for (const [x, y, z, c] of voxels) {
    if (c < 1 || c > 255) throw new Error(`color index ${c} outside 1..255`);
    out.push(x, y, z, c);
  }
  return new Uint8Array(out);
}

function chunk(id: string, content: number[]): number[] {
  return [...ascii(id), ...i32(content.length), ...i32(0), ...content];
}

function i32(v: number): number[] {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setInt32(0, v, true);
  return [...b];
}

function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

function str(s: string): number[] {
  const b = new TextEncoder().encode(s);
  return [...i32(b.length), ...b];
}

function dict(d: VoxDict): number[] {
  const entries = Object.entries(d);
  return [...i32(entries.length), ...entries.flatMap(([k, v]) => [...str(k), ...str(v)])];
}

class Writer {
  private readonly out: number[] = [];
  bytes(s: string): void { this.out.push(...ascii(s)); }
  push(b: number[]): void { for (const x of b) this.out.push(x); }
  result(): Uint8Array { return new Uint8Array(this.out); }
}

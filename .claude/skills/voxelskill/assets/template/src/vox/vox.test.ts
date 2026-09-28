import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Palette } from '@/voxel/palette';
import { parseVox, forEachVoxel } from '@/vox/parser';
import { packXyzi, writeVox } from '@/vox/writer';
import { decodeRotation, encodeRotation, flattenScene, pivot, sceneBounds, sceneToGrid } from '@/vox/scene';

const palette = Palette.fromHex(['#ff0000', '#00ff00', '#0000ff']);

describe('vox parser/writer', () => {
  it('round-trips models, palette, names, translation and materials', () => {
    const bytes = writeVox(
      [
        { size: [2, 3, 4], xyzi: packXyzi([[0, 0, 0, 1], [1, 2, 3, 3]]), name: 'a' },
        { size: [1, 1, 1], xyzi: packXyzi([[0, 0, 0, 2]]), translation: [10, -5, 2] },
      ],
      { palette, materials: new Map([[2, { _type: '_emit', _emit: '1' }]]) },
    );
    const file = parseVox(bytes);
    expect(file.version).toBe(150);
    expect(file.models).toHaveLength(2);
    expect(file.models[0]!.size).toEqual([2, 3, 4]);
    const voxels: number[][] = [];
    forEachVoxel(file.models[0]!, (x, y, z, c) => voxels.push([x, y, z, c]));
    expect(voxels).toEqual([[0, 0, 0, 1], [1, 2, 3, 3]]);
    expect(file.palette.get(1)).toEqual([255, 0, 0, 255]);
    expect(file.palette.get(3)).toEqual([0, 0, 255, 255]);
    expect(file.materials.get(2)?._type).toBe('_emit');
    const inst = flattenScene(file);
    expect(inst).toHaveLength(2);
    expect(inst[0]!.path).toEqual(['a']);
    expect(inst[1]!.transform.t).toEqual([10, -5, 2]);
  });

  it('reads a file produced by the Python writer (scripts/make_vox.py)', () => {
    const file = parseVox(readFileSync(new URL('./__fixtures__/house.vox', import.meta.url)));
    expect(file.models[0]!.size).toEqual([14, 12, 14]);
    expect(file.models[0]!.xyzi.length / 4).toBe(1052);
    expect(file.materials.get(10)?._type).toBe('_glass');
    // Python writer stands models on z = 0: bottom row of voxels lands on y = 0 in Y-up.
    expect(sceneBounds(flattenScene(file)).min[1]).toBe(0);
  });

  it('rejects non-vox data with a clear error', () => {
    expect(() => parseVox(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/VOX/);
  });

  it('falls back to the default palette without RGBA chunk', () => {
    // Minimal file: header + MAIN with SIZE + XYZI only.
    const i32 = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255];
    const chunk = (id: string, c: number[]) => [...[...id].map((ch) => ch.charCodeAt(0)), ...i32(c.length), ...i32(0), ...c];
    const body = [...chunk('SIZE', [...i32(1), ...i32(1), ...i32(1)]), ...chunk('XYZI', [...i32(1), 0, 0, 0, 1])];
    const bytes = new Uint8Array([...'VOX '].map((c) => c.charCodeAt(0)).concat(i32(150), [...'MAIN'].map((c) => c.charCodeAt(0)), i32(0), i32(body.length), body));
    const file = parseVox(bytes);
    expect(file.palette.get(1)).toEqual([255, 255, 255, 255]);
    expect(flattenScene(file)).toHaveLength(1);
  });
});

describe('vox scene math', () => {
  it('rotation byte 4 is identity and encode/decode round-trips all 24 rotations', () => {
    expect(decodeRotation(4)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    // Spec example: rows (0 1 0), (0 0 -1), (-1 0 0).
    const spec = (1 << 0) | (2 << 2) | (0 << 4) | (1 << 5) | (1 << 6);
    expect(decodeRotation(spec)).toEqual([0, 1, 0, 0, 0, -1, -1, 0, 0]);
    let count = 0;
    for (let b = 0; b < 128; b++) {
      const i1 = b & 3, i2 = (b >> 2) & 3;
      if (i1 === i2 || i1 > 2 || i2 > 2) continue;
      expect(encodeRotation(decodeRotation(b))).toBe(b);
      count++;
    }
    expect(count).toBe(48); // 24 proper rotations + 24 mirrored
  });

  it('pivot is floor(size / 2)', () => {
    expect(pivot([3, 4, 5])).toEqual([1, 2, 2]);
  });

  it('bakes Z-up models into a Y-up grid: vox z becomes y, vox y becomes -z', () => {
    const file = parseVox(writeVox([{ size: [1, 2, 3], xyzi: packXyzi([[0, 0, 0, 1], [0, 1, 2, 2]]), translation: [0, 0, 0] }], { palette }));
    const { grid } = sceneToGrid(flattenScene(file));
    expect([grid.sx, grid.sy, grid.sz]).toEqual([1, 3, 2]);
    // vox (0,0,0) is lowest and "front" (larger Y-up z); vox (0,1,2) is top and back.
    expect(grid.get(0, 0, 1)).toBe(1);
    expect(grid.get(0, 2, 0)).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { VoxelGrid } from '@/voxel/grid';
import { Palette } from '@/voxel/palette';
import { bakeIsoSprite } from '@/iso/iso-baker';
import { findPath, parseTileMap, stampTileMap } from '@/tilemap/tilemap';
import { VoxelWorld } from '@/voxel/world';

const palette = Palette.fromHex(['#c08040', '#40a040']);

describe('bakeIsoSprite', () => {
  it('draws one voxel as a 2s x 2s cube with three shaded faces', () => {
    const g = new VoxelGrid(1, 1, 1);
    g.set(0, 0, 0, 1);
    const s = bakeIsoSprite(g, palette, { scale: 4 });
    expect([s.width, s.height]).toEqual([8, 8]);
    const shades = new Set<number>();
    let opaque = 0;
    for (let i = 0; i < s.data.length; i += 4) if (s.data[i + 3] === 255) { opaque++; shades.add(s.data[i]!); }
    expect(shades.size).toBe(3);
    expect(opaque).toBeGreaterThan(40);
  });

  it('sizes the canvas from the grid footprint and height', () => {
    const g = new VoxelGrid(3, 2, 5);
    g.fill([0, 0, 0], [3, 2, 5], 2);
    const s = bakeIsoSprite(g, palette, { scale: 2 });
    expect([s.width, s.height]).toEqual([(3 + 5) * 2, ((3 + 5) * 2) / 2 + 2 * 2]);
    const r = bakeIsoSprite(g, palette, { scale: 2, rotation: 1 });
    expect(r.width).toBe(s.width);
  });

  it('rejects odd scales', () => {
    expect(() => bakeIsoSprite(new VoxelGrid(1, 1, 1), palette, { scale: 3 })).toThrow(/even/);
  });
});

describe('tile maps', () => {
  const legend = { '.': { color: 1, height: 1 }, '#': { color: 2, height: 3 } };

  it('validates row lengths and legend characters', () => {
    expect(() => parseTileMap(['..', '.'], legend)).toThrow(/length/);
    expect(() => parseTileMap(['.x'], legend)).toThrow(/'x'/);
  });

  it('extrudes tiles into voxel columns', () => {
    const map = parseTileMap(['.#'], legend);
    const w = new VoxelWorld(4, 8, 2);
    stampTileMap(map, w, 2);
    expect(w.surfaceY(0, 0)).toBe(0);
    expect(w.surfaceY(3, 1)).toBe(2);
  });

  it('finds a path around walls', () => {
    const map = parseTileMap(['...', '##.', '...'], legend);
    expect(findPath(map, [0, 0], [0, 2])).toEqual([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2]]);
    expect(findPath(parseTileMap(['.#.'], legend), [0, 0], [2, 0])).toBeNull();
  });
});

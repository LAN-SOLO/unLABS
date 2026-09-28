import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVoxelMaterials } from '@/render/voxel-mesh';
import { buildLevel, findProps, type LevelDef } from '@/level/level';

const house = readFileSync(new URL('../vox/__fixtures__/house.vox', import.meta.url));

describe('buildLevel props', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tags prop meshes so gameplay can find them by id and tag', async () => {
    vi.stubGlobal('fetch', async () => new Response(house));
    const def: LevelDef = {
      name: 'test',
      size: [64, 16, 64],
      palette: ['#00ff00'],
      terrain: { type: 'tiles', rows: ['.'], legend: { '.': { color: 1, height: 1 } } },
      props: [
        { model: '/models/house.vox', at: [20, 1, 20], id: 'home' },
        { model: '/models/house.vox', at: [40, 1, 40], solid: false, tags: ['goal'] },
      ],
      spawn: [0, 2, 0],
    };
    const level = await buildLevel(def, createVoxelMaterials());
    expect(level.props.getObjectByName('home')?.userData.prop).toBe(def.props![0]);
    expect(findProps(level, 'goal')).toHaveLength(1);
    expect(findProps(level, 'goal')[0]!.position.toArray()).toEqual([40, 1, 40]);
    // Only the solid prop is stamped into collision.
    expect(level.solids.get(20, 1, 20)).not.toBe(0);
    expect(level.propSolids.get(40, 1, 40)).toBe(0);
  });
});

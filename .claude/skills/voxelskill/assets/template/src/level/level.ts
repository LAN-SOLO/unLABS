import * as THREE from 'three';
import type { Vec3, VoxelSource } from '@/voxel/grid';
import type { MaterialClass } from '@/voxel/mesher';
import { Palette } from '@/voxel/palette';
import { VoxelWorld } from '@/voxel/world';
import { generateIsland, type IslandOptions } from '@/procgen/terrain';
import { parseTileMap, stampTileMap, type TileDef } from '@/tilemap/tilemap';
import { flattenScene, sceneToGrid } from '@/vox/scene';
import { loadVox, voxToObject } from '@/render/vox-object';
import type { ViewMode } from '@/render/cameras';

/** JSON level format (public/levels/*.json). Positions are Y-up voxel units. */
export interface LevelDef {
  name: string;
  size: Vec3;
  /** Terrain palette: entry i is palette index i + 1. */
  palette: string[];
  /** Palette index → render class for terrain ("glass", "emit", "metal"). */
  materials?: Record<string, MaterialClass>;
  terrain:
    | ({ type: 'island' } & IslandOptions)
    | { type: 'tiles'; tileSize?: number; rows: string[]; legend: Record<string, TileDef> }
    | { type: 'vox'; model: string };
  props?: PropDef[];
  spawn: Vec3;
  view?: ViewMode;
}

export interface PropDef {
  /** URL of a .vox file, e.g. "/models/tree.vox". */
  model: string;
  /** [x, z] to stand on the terrain surface, or [x, y, z] for an exact position. */
  at: [number, number] | Vec3;
  /** Quarter turns around Y (0..3). */
  rotY?: number;
  /** Blocks movement. Default true. */
  solid?: boolean;
  /** Unique name for gameplay lookups; becomes mesh.name (default: the model URL). */
  id?: string;
  /** Free-form gameplay tags, e.g. ["coin"], ["door", "locked"]. */
  tags?: string[];
}

/** Prop meshes carrying `tag` (set via PropDef.tags). */
export function findProps(level: Level, tag: string): THREE.Mesh[] {
  return level.props.children.filter(
    (o): o is THREE.Mesh => o instanceof THREE.Mesh && ((o.userData.prop as PropDef | undefined)?.tags ?? []).includes(tag),
  );
}

export interface Level {
  def: LevelDef;
  world: VoxelWorld;
  palette: Palette;
  materialOf: (index: number) => MaterialClass;
  /** Collision-only voxels of solid props (value 1). */
  propSolids: VoxelWorld;
  /** world ∪ propSolids — use this for collision and raycasts against everything. */
  solids: VoxelSource;
  props: THREE.Group;
}

export async function loadLevel(url: string, materials: Record<MaterialClass, THREE.Material>): Promise<Level> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load level ${url}: ${res.status}`);
  const def = validateLevel(await res.json());
  return buildLevel(def, materials);
}

export async function buildLevel(def: LevelDef, materials: Record<MaterialClass, THREE.Material>): Promise<Level> {
  const [sx, sy, sz] = def.size;
  const world = new VoxelWorld(sx, sy, sz);
  const palette = Palette.fromHex(def.palette);
  const classes = new Map(Object.entries(def.materials ?? {}).map(([k, v]) => [Number(k), v]));
  const materialOf = (i: number): MaterialClass => classes.get(i) ?? 'solid';

  const t = def.terrain;
  if (t.type === 'island') {
    generateIsland(world, t);
  } else if (t.type === 'tiles') {
    stampTileMap(parseTileMap(t.rows, t.legend), world, t.tileSize ?? 1);
  } else {
    // Terrain authored in MagicaVoxel: bake with the terrain palette indices of that file.
    const file = await loadVox(t.model);
    const { grid } = sceneToGrid(flattenScene(file));
    palette.rgba.set(file.palette.rgba);
    grid.forEach((x, y, z, c) => world.set(x, y, z, c));
  }

  const propSolids = new VoxelWorld(sx, sy, sz);
  const props = new THREE.Group();
  props.name = 'props';
  const cache = new Map<string, Promise<Awaited<ReturnType<typeof loadVox>>>>();
  for (const p of def.props ?? []) {
    if (!cache.has(p.model)) cache.set(p.model, loadVox(p.model));
    const file = await cache.get(p.model)!;
    const obj = voxToObject(file, materials);
    const rot = (((p.rotY ?? 0) % 4) + 4) % 4;
    const pos: Vec3 = p.at.length === 3 ? p.at : [p.at[0], world.surfaceY(p.at[0], p.at[1]) + 1, p.at[1]];
    obj.mesh.position.set(pos[0], pos[1], pos[2]);
    obj.mesh.rotation.y = (rot * Math.PI) / 2;
    // Gameplay finds props via name/userData — never rely on children order.
    obj.mesh.name = p.id ?? p.model;
    obj.mesh.userData.prop = p;
    props.add(obj.mesh);

    if (p.solid ?? true) {
      const { grid } = sceneToGrid(flattenScene(file));
      grid.forEach((x, y, z) => {
        // Cell center in mesh space, rotated like the mesh, then floored back to a cell.
        let cx = x + obj.min[0] + 0.5, cz = z + obj.min[2] + 0.5;
        for (let r = 0; r < rot; r++) [cx, cz] = [cz, -cx];
        propSolids.set(Math.floor(pos[0] + cx), pos[1] + y + obj.min[1], Math.floor(pos[2] + cz), 1);
      });
    }
  }
  propSolids.dirty.clear();

  const solids: VoxelSource = { get: (x, y, z) => world.get(x, y, z) || propSolids.get(x, y, z) };
  return { def, world, palette, materialOf, propSolids, solids, props };
}

/** Minimal structural validation with actionable messages. */
export function validateLevel(json: unknown): LevelDef {
  const fail = (msg: string): never => { throw new Error(`invalid level: ${msg}`); };
  if (typeof json !== 'object' || json === null) fail('not an object');
  const o = json as Record<string, unknown>;
  const isVec3 = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isInteger(n));
  if (typeof o.name !== 'string') fail('"name" must be a string');
  if (!isVec3(o.size)) fail('"size" must be [x, y, z] integers');
  if (!Array.isArray(o.palette) || o.palette.some((c) => typeof c !== 'string')) fail('"palette" must be an array of "#rrggbb"');
  const terrain = o.terrain as { type?: unknown } | undefined;
  if (!terrain || !['island', 'tiles', 'vox'].includes(String(terrain.type))) fail('"terrain.type" must be island | tiles | vox');
  if (!isVec3(o.spawn)) fail('"spawn" must be [x, y, z] integers');
  return json as LevelDef;
}

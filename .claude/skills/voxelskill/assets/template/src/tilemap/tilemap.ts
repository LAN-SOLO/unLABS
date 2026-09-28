import type { VoxelWorld } from '@/voxel/world';

/** What one map character becomes. Heights stack voxels from y = 0. */
export interface TileDef {
  /** Palette index of the column body. */
  color: number;
  /** Column height in voxels (>= 1). */
  height: number;
  /** Optional different palette index for the top voxel (grass on dirt). */
  top?: number;
  /** Walkable for 2D grid logic (pathfinding, movement). Default: height <= 1. */
  walkable?: boolean;
}

export interface TileMap {
  width: number;
  depth: number;
  /** Row-major characters, rows[z][x]. Row 0 is north (-Z side on screen with yaw 0). */
  rows: string[];
  legend: Record<string, TileDef>;
}

/**
 * Parse an ASCII map. All rows must have equal length and every character
 * must appear in the legend (use ' ' or '.' for empty/ground explicitly).
 */
export function parseTileMap(rows: readonly string[], legend: Record<string, TileDef>): TileMap {
  if (rows.length === 0) throw new Error('tile map has no rows');
  const width = rows[0]!.length;
  rows.forEach((row, z) => {
    if (row.length !== width) throw new Error(`row ${z} has length ${row.length}, expected ${width}`);
    for (const ch of row) if (!(ch in legend)) throw new Error(`row ${z}: character '${ch}' not in legend`);
  });
  return { width, depth: rows.length, rows: [...rows], legend };
}

export function tileAt(map: TileMap, x: number, z: number): TileDef | undefined {
  const ch = map.rows[z]?.[x];
  return ch === undefined ? undefined : map.legend[ch];
}

export function isWalkable(map: TileMap, x: number, z: number): boolean {
  const t = tileAt(map, x, z);
  return !!t && (t.walkable ?? t.height <= 1);
}

/**
 * Extrude the map into a voxel world: each tile becomes a `tileSize` x height x `tileSize`
 * column. Render it with a 'topdown' camera for a 2D look, or 'iso'/'dimetric' for 2.5D.
 */
export function stampTileMap(map: TileMap, world: VoxelWorld, tileSize = 1, origin: [number, number, number] = [0, 0, 0]): void {
  for (let z = 0; z < map.depth; z++) {
    for (let x = 0; x < map.width; x++) {
      const t = tileAt(map, x, z);
      if (!t || t.height <= 0) continue;
      for (let dz = 0; dz < tileSize; dz++)
        for (let dx = 0; dx < tileSize; dx++)
          for (let y = 0; y < t.height; y++) {
            const c = y === t.height - 1 && t.top !== undefined ? t.top : t.color;
            world.set(origin[0] + x * tileSize + dx, origin[1] + y, origin[2] + z * tileSize + dz, c);
          }
    }
  }
}

/** 4-neighbour breadth-first path on walkable tiles; returns tile coords incl. start and goal, or null. */
export function findPath(map: TileMap, from: [number, number], to: [number, number]): [number, number][] | null {
  const key = (x: number, z: number) => z * map.width + x;
  const prev = new Map<number, number>();
  const queue: [number, number][] = [from];
  prev.set(key(...from), -1);
  while (queue.length) {
    const [x, z] = queue.shift()!;
    if (x === to[0] && z === to[1]) {
      const path: [number, number][] = [];
      for (let k = key(x, z); k !== -1; k = prev.get(k)!) path.unshift([k % map.width, Math.floor(k / map.width)]);
      return path;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= map.width || nz >= map.depth) continue;
      if (prev.has(key(nx, nz)) || !isWalkable(map, nx, nz)) continue;
      prev.set(key(nx, nz), key(x, z));
      queue.push([nx, nz]);
    }
  }
  return null;
}

import type { Vec3, VoxelSource } from '@/voxel/grid';

export const CHUNK = 32;

/**
 * Bounded, chunked, Y-up game world. Chunks are allocated lazily and
 * tracked as dirty when edited so only they get re-meshed.
 */
export class VoxelWorld implements VoxelSource {
  private readonly chunks = new Map<string, Uint8Array>();
  readonly dirty = new Set<string>();

  constructor(
    readonly sx: number,
    readonly sy: number,
    readonly sz: number,
  ) {}

  static key(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  static parseKey(key: string): Vec3 {
    const [x, y, z] = key.split(',').map(Number);
    return [x!, y!, z!];
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    const chunk = this.chunks.get(VoxelWorld.key(x >> 5, y >> 5, z >> 5));
    return chunk ? chunk[(x & 31) + CHUNK * ((y & 31) + CHUNK * (z & 31))]! : 0;
  }

  /** Writes a voxel and marks its chunk (and touching neighbours) dirty. Out-of-bounds writes are ignored. */
  set(x: number, y: number, z: number, value: number): void {
    if (!this.inBounds(x, y, z)) return;
    const cx = x >> 5, cy = y >> 5, cz = z >> 5;
    const key = VoxelWorld.key(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      if (value === 0) return;
      chunk = new Uint8Array(CHUNK * CHUNK * CHUNK);
      this.chunks.set(key, chunk);
    }
    const i = (x & 31) + CHUNK * ((y & 31) + CHUNK * (z & 31));
    if (chunk[i] === value) return;
    chunk[i] = value;
    this.dirty.add(key);
    // Faces and AO on chunk borders depend on the neighbour chunk.
    const lx = x & 31, ly = y & 31, lz = z & 31;
    if (lx === 0) this.markDirty(cx - 1, cy, cz);
    if (lx === 31) this.markDirty(cx + 1, cy, cz);
    if (ly === 0) this.markDirty(cx, cy - 1, cz);
    if (ly === 31) this.markDirty(cx, cy + 1, cz);
    if (lz === 0) this.markDirty(cx, cy, cz - 1);
    if (lz === 31) this.markDirty(cx, cy, cz + 1);
  }

  private markDirty(cx: number, cy: number, cz: number): void {
    const key = VoxelWorld.key(cx, cy, cz);
    if (this.chunks.has(key)) this.dirty.add(key);
  }

  /** Keys of all allocated chunks. */
  chunkKeys(): string[] {
    return [...this.chunks.keys()];
  }

  /** Highest solid y in a column, or -1. */
  surfaceY(x: number, z: number): number {
    for (let y = this.sy - 1; y >= 0; y--) if (this.get(x, y, z) !== 0) return y;
    return -1;
  }
}

import type { Vec3, VoxelSource } from "@/lib/voxel/grid";

export const CHUNK = 32;

/**
 * Bounded, chunked, Y-up game world. Chunks are allocated lazily and
 * tracked as dirty when edited so only they get re-meshed.
 */
export class VoxelWorld implements VoxelSource {
  private readonly chunks = new Map<string, Uint8Array>();
  readonly dirty = new Set<string>();
  /**
   * How far (voxels) an edit reaches into neighbour chunks. 0 = only edits
   * on a chunk's border dirty the neighbour (faces/AO); a renderer whose
   * meshing looks further (refinement rules) raises it.
   */
  dirtyReach = 0;

  constructor(
    readonly sx: number,
    readonly sy: number,
    readonly sz: number,
  ) {}

  static key(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  static parseKey(key: string): Vec3 {
    const [x, y, z] = key.split(",").map(Number);
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
    const cx = x >> 5,
      cy = y >> 5,
      cz = z >> 5;
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
    const lx = x & 31,
      ly = y & 31,
      lz = z & 31;
    const r = this.dirtyReach;
    const hi = 31 - r;
    if (lx <= r || lx >= hi || ly <= r || ly >= hi || lz <= r || lz >= hi) {
      const x0 = lx <= r ? -1 : 0,
        x1 = lx >= hi ? 1 : 0;
      const y0 = ly <= r ? -1 : 0,
        y1 = ly >= hi ? 1 : 0;
      const z0 = lz <= r ? -1 : 0,
        z1 = lz >= hi ? 1 : 0;
      for (let dz = z0; dz <= z1; dz++)
        for (let dy = y0; dy <= y1; dy++)
          for (let dx = x0; dx <= x1; dx++) {
            if (!dx && !dy && !dz) continue;
            // Without reach, only face neighbours matter (as before).
            if (r === 0 && Math.abs(dx) + Math.abs(dy) + Math.abs(dz) !== 1) continue;
            this.markDirty(cx + dx, cy + dy, cz + dz);
          }
    }
  }

  /**
   * Dense copy of the box [min, min + size) (x fastest), 0 outside the world
   * or in unallocated chunks — one chunk lookup per 32-voxel row segment.
   */
  readBox(min: Vec3, size: Vec3): Uint8Array {
    const [X, Y, Z] = size;
    const out = new Uint8Array(X * Y * Z);
    for (let z = 0; z < Z; z++) {
      const gz = min[2] + z;
      if (gz < 0 || gz >= this.sz) continue;
      for (let y = 0; y < Y; y++) {
        const gy = min[1] + y;
        if (gy < 0 || gy >= this.sy) continue;
        const row = X * (y + Y * z);
        let x = Math.max(0, -min[0]);
        const xEnd = Math.min(X, this.sx - min[0]);
        while (x < xEnd) {
          const gx = min[0] + x;
          const cxi = gx >> 5;
          const run = Math.min(xEnd - x, 32 - (gx & 31));
          const chunk = this.chunks.get(VoxelWorld.key(cxi, gy >> 5, gz >> 5));
          if (chunk) {
            const o = (gx & 31) + CHUNK * ((gy & 31) + CHUNK * (gz & 31));
            out.set(chunk.subarray(o, o + run), row + x);
          }
          x += run;
        }
      }
    }
    return out;
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

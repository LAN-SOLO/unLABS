/** Read access shared by dense grids and chunked worlds. 0 = empty, 1..255 = palette index. */
export interface VoxelSource {
  get(x: number, y: number, z: number): number;
}

export type Vec3 = [number, number, number];

/**
 * Dense, bounded voxel volume. Axis meaning is up to the caller:
 * game worlds are Y-up, raw .vox models are Z-up (see vox/scene.ts).
 * Layout: index = x + sx * (y + sy * z).
 */
export class VoxelGrid implements VoxelSource {
  readonly data: Uint8Array;

  constructor(
    readonly sx: number,
    readonly sy: number,
    readonly sz: number,
    data?: Uint8Array,
  ) {
    if (![sx, sy, sz].every((n) => Number.isInteger(n) && n > 0)) throw new Error(`invalid grid size ${sx}x${sy}x${sz}`);
    const n = sx * sy * sz;
    if (data && data.length !== n) throw new Error(`grid data has ${data.length} cells, expected ${n}`);
    this.data = data ?? new Uint8Array(n);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  /** Out-of-bounds reads return 0 so meshers can sample freely. */
  get(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? this.data[x + this.sx * (y + this.sy * z)]! : 0;
  }

  set(x: number, y: number, z: number, value: number): void {
    if (!this.inBounds(x, y, z)) throw new Error(`(${x},${y},${z}) outside ${this.sx}x${this.sy}x${this.sz}`);
    this.data[x + this.sx * (y + this.sy * z)] = value;
  }

  fill(min: Vec3, max: Vec3, value: number): void {
    for (let z = min[2]; z < max[2]; z++)
      for (let y = min[1]; y < max[1]; y++)
        for (let x = min[0]; x < max[0]; x++) this.set(x, y, z, value);
  }

  count(): number {
    let n = 0;
    for (const v of this.data) if (v !== 0) n++;
    return n;
  }

  forEach(fn: (x: number, y: number, z: number, value: number) => void): void {
    const { sx, sy, sz, data } = this;
    let i = 0;
    for (let z = 0; z < sz; z++)
      for (let y = 0; y < sy; y++)
        for (let x = 0; x < sx; x++, i++) if (data[i] !== 0) fn(x, y, z, data[i]!);
  }
}

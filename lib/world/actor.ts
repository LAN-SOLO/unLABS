/**
 * Walking & collision on a floor (pure).
 * Terrain voxels plus solid footprints of devices and props form one
 * VoxelSource, so the template's swept-AABB `moveBox` handles both.
 */
import { moveBox, type Box } from "@/lib/voxel/collision";
import type { Vec3, VoxelSource } from "@/lib/voxel/grid";

export class FloorCollision implements VoxelSource {
  /** Solid height per (x, z) column above the slab (0 = free). */
  private readonly heights: Uint8Array;

  constructor(
    private readonly terrain: VoxelSource,
    private readonly sx: number,
    private readonly sz: number,
  ) {
    this.heights = new Uint8Array(sx * sz);
  }

  clearFootprints(): void {
    this.heights.fill(0);
  }

  /** Mark a solid rectangle (world units, inclusive-exclusive) up to height h. */
  addFootprint(x0: number, z0: number, x1: number, z1: number, h: number): void {
    for (let z = Math.max(0, Math.floor(z0)); z < Math.min(this.sz, Math.ceil(z1)); z++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.sx, Math.ceil(x1)); x++) {
        const i = x + z * this.sx;
        this.heights[i] = Math.max(this.heights[i]!, Math.min(255, Math.ceil(h)));
      }
  }

  get(x: number, y: number, z: number): number {
    const t = this.terrain.get(x, y, z);
    if (t) return t;
    if (x < 0 || z < 0 || x >= this.sx || z >= this.sz || y < 1) return 0;
    return y < 1 + this.heights[x + z * this.sx]! ? 1 : 0;
  }
}

export const WALKER = { width: 2.2, height: 5.1, speed: 13, gravity: 40, stepUp: 1 } as const;

/** Kinematic walker: gravity, sliding, 1-voxel step-up, no jumping. */
export class Walker {
  readonly box: Box;
  vy = 0;
  /** Facing angle (radians, 0 = +z). */
  facing = 0;
  moving = false;

  constructor(pos: Vec3) {
    this.box = {
      min: [pos[0] - WALKER.width / 2, pos[1], pos[2] - WALKER.width / 2],
      size: [WALKER.width, WALKER.height, WALKER.width],
    };
  }

  get position(): Vec3 {
    const b = this.box;
    return [b.min[0] + b.size[0] / 2, b.min[1], b.min[2] + b.size[2] / 2];
  }

  teleport(pos: Vec3): void {
    this.box.min[0] = pos[0] - WALKER.width / 2;
    this.box.min[1] = pos[1];
    this.box.min[2] = pos[2] - WALKER.width / 2;
    this.vy = 0;
  }

  update(src: VoxelSource, move: [number, number], dt: number): void {
    const len = Math.hypot(move[0], move[1]);
    this.moving = len > 0.01;
    if (this.moving) this.facing = Math.atan2(move[0], move[1]);
    this.vy = Math.max(this.vy - WALKER.gravity * dt, -40);
    const dx = move[0] * WALKER.speed * dt;
    const dz = move[1] * WALKER.speed * dt;
    const dy = this.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
    for (let s = 0; s < steps; s++) {
      const res = moveBox(src, this.box, [0, dy / steps, 0]);
      const grounded = res.blocked[1] && dy < 0;
      if (res.blocked[1]) this.vy = 0;
      this.horizontal(src, dx / steps, dz / steps, grounded);
    }
  }

  private horizontal(src: VoxelSource, dx: number, dz: number, grounded: boolean): void {
    if (dx === 0 && dz === 0) return;
    const before: Vec3 = [...this.box.min];
    const res = moveBox(src, this.box, [dx, 0, dz]);
    if (!(res.blocked[0] || res.blocked[2]) || !grounded) return;
    const trial: Box = { min: [...before], size: this.box.size };
    if (moveBox(src, trial, [0, WALKER.stepUp, 0]).blocked[1]) return;
    const side = moveBox(src, trial, [dx, 0, dz]);
    if (side.blocked[0] && side.blocked[2]) return;
    moveBox(src, trial, [0, -WALKER.stepUp, 0]);
    this.box.min[0] = trial.min[0];
    this.box.min[1] = trial.min[1];
    this.box.min[2] = trial.min[2];
  }
}

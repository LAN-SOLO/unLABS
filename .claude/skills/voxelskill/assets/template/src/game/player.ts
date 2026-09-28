import type { Vec3, VoxelSource } from '@/voxel/grid';
import { moveBox, type Box } from '@/voxel/collision';

export interface PlayerInput {
  /** Desired horizontal direction in world space (x, z); length <= 1. */
  move: [number, number];
  jump: boolean;
}

export const PLAYER = { width: 0.6, height: 1.7, speed: 6, jumpSpeed: 8.5, gravity: 28, maxFall: 40, stepUp: 1 } as const;

/** Kinematic AABB character with gravity, jumping and 1-voxel auto step-up. */
export class Player {
  readonly box: Box;
  readonly velocity: Vec3 = [0, 0, 0];
  onGround = false;

  constructor(spawn: Vec3) {
    this.box = { min: [spawn[0] + 0.5 - PLAYER.width / 2, spawn[1], spawn[2] + 0.5 - PLAYER.width / 2], size: [PLAYER.width, PLAYER.height, PLAYER.width] };
  }

  /** Feet center position. */
  get position(): Vec3 {
    const b = this.box;
    return [b.min[0] + b.size[0] / 2, b.min[1], b.min[2] + b.size[2] / 2];
  }

  /** Fixed-timestep update (call with dt = 1/60). */
  update(src: VoxelSource, input: PlayerInput, dt: number): void {
    const v = this.velocity;
    v[0] = input.move[0] * PLAYER.speed;
    v[2] = input.move[1] * PLAYER.speed;
    if (input.jump && this.onGround) v[1] = PLAYER.jumpSpeed;
    v[1] = Math.max(v[1] - PLAYER.gravity * dt, -PLAYER.maxFall);

    // Sub-step so no axis moves more than half a voxel per step (no tunnelling).
    const steps = Math.max(1, Math.ceil((Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt) / 0.5));
    this.onGround = false;
    for (let s = 0; s < steps; s++) {
      const d: Vec3 = [(v[0] * dt) / steps, (v[1] * dt) / steps, (v[2] * dt) / steps];
      const res = moveBox(src, this.box, [0, d[1], 0]);
      if (res.blocked[1]) {
        if (d[1] < 0) this.onGround = true;
        v[1] = 0;
      }
      this.moveHorizontal(src, d);
    }
  }

  private moveHorizontal(src: VoxelSource, d: Vec3): void {
    const before: Vec3 = [...this.box.min];
    const res = moveBox(src, this.box, [d[0], 0, d[2]]);
    if (!(res.blocked[0] || res.blocked[2]) || !this.onGround) return;
    // Try stepping up one voxel: lift, move, then settle down.
    const trial: Box = { min: [...before], size: this.box.size };
    const up = moveBox(src, trial, [0, PLAYER.stepUp, 0]);
    if (up.blocked[1]) return;
    const side = moveBox(src, trial, [d[0], 0, d[2]]);
    if (side.blocked[0] || side.blocked[2]) return;
    moveBox(src, trial, [0, -PLAYER.stepUp, 0]);
    this.box.min[0] = trial.min[0]; this.box.min[1] = trial.min[1]; this.box.min[2] = trial.min[2];
  }
}

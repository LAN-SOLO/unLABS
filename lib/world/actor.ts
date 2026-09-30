/**
 * Walking & collision on a floor (pure).
 * =====================================
 *
 * Two collision layers over the terrain voxels:
 *
 *  - **Coarse** (`get`, one cell per voxel column): rectangles added with
 *    `addFootprint` (the walkability test and legacy callers, bots) —
 *    blocked from the slab up to a height.
 *  - **Fine** (`FINE` cells per world unit, i.e. half-voxel cells): the
 *    engine's per-column occupancy derived from the actual model voxels
 *    (`markFine`). `fineSource()` merges terrain + both layers (+ extra
 *    sources such as doors and the elevator) into one VoxelSource in fine
 *    units, which the walker collides with.
 *
 * `addFootprint` writes both layers, so coarse ⊇ fine always holds and the
 * coarse view stays a conservative answer for callers that only know voxels.
 */
import { moveBox, overlapsSolid, type Box } from "@/lib/voxel/collision";
import type { Vec3, VoxelSource } from "@/lib/voxel/grid";

/** Fine collision cells per world unit. */
export const FINE = 2;

export class FloorCollision implements VoxelSource {
  /** Solid height per (x, z) column above the slab (0 = free). */
  private readonly heights: Uint8Array;
  /** Solid height (fine cells) per fine (x, z) cell above the slab (0 = free). */
  private readonly fine: Uint8Array;
  readonly fsx: number;
  readonly fsz: number;

  constructor(
    private readonly terrain: VoxelSource,
    private readonly sx: number,
    private readonly sz: number,
  ) {
    this.heights = new Uint8Array(sx * sz);
    this.fsx = sx * FINE;
    this.fsz = sz * FINE;
    this.fine = new Uint8Array(this.fsx * this.fsz);
  }

  clearFootprints(): void {
    this.heights.fill(0);
    this.fine.fill(0);
  }

  /** Mark a solid rectangle (world units, inclusive-exclusive) up to height h. */
  addFootprint(x0: number, z0: number, x1: number, z1: number, h: number): void {
    for (let z = Math.max(0, Math.floor(z0)); z < Math.min(this.sz, Math.ceil(z1)); z++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.sx, Math.ceil(x1)); x++) {
        const i = x + z * this.sx;
        this.heights[i] = Math.max(this.heights[i]!, Math.min(255, Math.ceil(h)));
      }
    const fh = Math.min(255, Math.ceil(h * FINE));
    for (
      let z = Math.max(0, Math.floor(z0 * FINE));
      z < Math.min(this.fsz, Math.ceil(z1 * FINE));
      z++
    )
      for (
        let x = Math.max(0, Math.floor(x0 * FINE));
        x < Math.min(this.fsx, Math.ceil(x1 * FINE));
        x++
      ) {
        const i = x + z * this.fsx;
        this.fine[i] = Math.max(this.fine[i]!, fh);
      }
  }

  /**
   * Mark one fine cell (fine-cell coords) solid up to `h` world units; the
   * voxel column containing it is marked in the coarse layer too.
   */
  markFine(fx: number, fz: number, h: number): void {
    if (fx < 0 || fz < 0 || fx >= this.fsx || fz >= this.fsz) return;
    const fh = Math.min(255, Math.ceil(h * FINE));
    const i = fx + fz * this.fsx;
    this.fine[i] = Math.max(this.fine[i]!, fh);
    const c = Math.floor(fx / FINE) + Math.floor(fz / FINE) * this.sx;
    this.heights[c] = Math.max(this.heights[c]!, Math.min(255, Math.ceil(h)));
  }

  /** Solid height (world units) of the fine cell (0 = free, terrain not included). */
  fineHeight(fx: number, fz: number): number {
    if (fx < 0 || fz < 0 || fx >= this.fsx || fz >= this.fsz) return 0;
    return this.fine[fx + fz * this.fsx]! / FINE;
  }

  /** Coarse voxel view: terrain + footprints (conservative). */
  get(x: number, y: number, z: number): number {
    const t = this.terrain.get(x, y, z);
    if (t) return t;
    if (x < 0 || z < 0 || x >= this.sx || z >= this.sz || y < 1) return 0;
    return y < 1 + this.heights[x + z * this.sx]! ? 1 : 0;
  }

  /**
   * Fine-unit voxel source for the walker: terrain and `extra` (doors,
   * elevator — voxel sources) sampled at the voxel containing the fine
   * cell, objects from the fine layer.
   */
  fineSource(extra?: VoxelSource): VoxelSource {
    return {
      get: (fx, fy, fz) => {
        const x = Math.floor(fx / FINE);
        const y = Math.floor(fy / FINE);
        const z = Math.floor(fz / FINE);
        const t = this.terrain.get(x, y, z);
        if (t) return t;
        if (extra?.get(x, y, z)) return 1;
        if (fx < 0 || fz < 0 || fx >= this.fsx || fz >= this.fsz || fy < FINE) return 0;
        return fy < FINE + this.fine[fx + fz * this.fsx]! ? 1 : 0;
      },
    };
  }
}

/**
 * Walker constants. `width` is the conservative 2.2-voxel body the content
 * validators and the walkability test plan with; the engine's collision box
 * is the slimmer `radius` (half-width ≈ Jade's shoulders), with the nav grid
 * inflated by `navRadius` so planned paths keep a hand's breadth off corners.
 */
export const WALKER = {
  width: 2.2,
  radius: 0.8,
  navRadius: 0.9,
  height: 5.1,
  speed: 13,
  gravity: 40,
  stepUp: 1,
} as const;

/** Largest sideways nudge (world units) the walker takes to slip past a corner it clips. */
const CORNER_SLIP = 0.55;

/**
 * Kinematic walker: gravity, sliding, 1-voxel step-up, no jumping.
 * Positions are world units; `update` collides against a source with
 * `scale` cells per world unit (1 = voxels, FINE = the fine layer).
 */
export class Walker {
  readonly box: Box;
  vy = 0;
  /** Facing angle (radians, 0 = +z). */
  facing = 0;
  moving = false;

  constructor(pos: Vec3, half: number = WALKER.width / 2) {
    this.box = {
      min: [pos[0] - half, pos[1], pos[2] - half],
      size: [half * 2, WALKER.height, half * 2],
    };
  }

  get position(): Vec3 {
    const b = this.box;
    return [b.min[0] + b.size[0] / 2, b.min[1], b.min[2] + b.size[2] / 2];
  }

  teleport(pos: Vec3): void {
    this.box.min[0] = pos[0] - this.box.size[0] / 2;
    this.box.min[1] = pos[1];
    this.box.min[2] = pos[2] - this.box.size[2] / 2;
    this.vy = 0;
  }

  /** Move horizontally to (x, z) without touching height or fall speed. */
  placeAt(x: number, z: number): void {
    this.box.min[0] = x - this.box.size[0] / 2;
    this.box.min[2] = z - this.box.size[2] / 2;
  }

  /** Box would overlap solid cells at world point (x, z) (current height). */
  blockedAt(src: VoxelSource, x: number, z: number, scale = 1): boolean {
    const b = this.box;
    const probe: Box = {
      min: [(x - b.size[0] / 2) * scale, b.min[1] * scale, (z - b.size[2] / 2) * scale],
      size: [b.size[0] * scale, b.size[1] * scale, b.size[2] * scale],
    };
    return overlapsSolid(src, probe);
  }

  update(src: VoxelSource, move: [number, number], dt: number, scale = 1): void {
    const len = Math.hypot(move[0], move[1]);
    this.moving = len > 0.01;
    if (this.moving) this.facing = Math.atan2(move[0], move[1]);
    this.vy = Math.max(this.vy - WALKER.gravity * dt, -40);
    const dx = move[0] * WALKER.speed * dt;
    const dz = move[1] * WALKER.speed * dt;
    const dy = this.vy * dt;
    // Work in cell units; sub-steps stay below 0.8 cells (no tunnelling).
    const b = this.box;
    const cb: Box = {
      min: [b.min[0] * scale, b.min[1] * scale, b.min[2] * scale],
      size: [b.size[0] * scale, b.size[1] * scale, b.size[2] * scale],
    };
    const steps = Math.max(
      1,
      Math.ceil((Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) * scale) / 0.8),
    );
    for (let s = 0; s < steps; s++) {
      const res = moveBox(src, cb, [0, (dy / steps) * scale, 0]);
      const grounded = res.blocked[1] && dy < 0;
      if (res.blocked[1]) this.vy = 0;
      this.horizontal(src, cb, (dx / steps) * scale, (dz / steps) * scale, grounded, scale);
    }
    b.min[0] = cb.min[0] / scale;
    b.min[1] = cb.min[1] / scale;
    b.min[2] = cb.min[2] / scale;
  }

  private horizontal(
    src: VoxelSource,
    box: Box,
    dx: number,
    dz: number,
    grounded: boolean,
    scale: number,
  ): void {
    if (dx === 0 && dz === 0) return;
    const before: Vec3 = [...box.min];
    const res = moveBox(src, box, [dx, 0, dz]);
    if (!(res.blocked[0] || res.blocked[2])) return;
    if (grounded) {
      const trial: Box = { min: [...before], size: box.size };
      const up = WALKER.stepUp * scale;
      if (!moveBox(src, trial, [0, up, 0]).blocked[1]) {
        const side = moveBox(src, trial, [dx, 0, dz]);
        if (!(side.blocked[0] && side.blocked[2]) && (side.moved[0] !== 0 || side.moved[2] !== 0)) {
          moveBox(src, trial, [0, -up, 0]);
          // Only take the step when it got further than the plain slide.
          const gain =
            Math.abs(trial.min[0] - before[0]) +
            Math.abs(trial.min[2] - before[2]) -
            (Math.abs(res.moved[0]) + Math.abs(res.moved[2]));
          if (gain > 1e-4) {
            box.min[0] = trial.min[0];
            box.min[1] = trial.min[1];
            box.min[2] = trial.min[2];
            return;
          }
        }
      }
    }
    this.slipCorner(src, box, dx, dz, res.blocked, scale);
  }

  /**
   * Corner sliding: blocked on the axis we mostly move along, but only by a
   * corner the box clips with its edge → nudge sideways (up to CORNER_SLIP)
   * toward the free side, so she glides round door frames and furniture
   * corners instead of sticking.
   */
  private slipCorner(
    src: VoxelSource,
    box: Box,
    dx: number,
    dz: number,
    blocked: [boolean, boolean, boolean],
    scale: number,
  ): void {
    const along: 0 | 2 = Math.abs(dx) >= Math.abs(dz) ? 0 : 2;
    const main = along === 0 ? dx : dz;
    if (!blocked[along] || Math.abs(main) < 1e-6) return;
    const other: 0 | 2 = along === 0 ? 2 : 0;
    // Moving (nearly) straight into the obstacle: the sideways share is small.
    const side = along === 0 ? dz : dx;
    if (Math.abs(side) > Math.abs(main) * 0.8) return;
    const maxSlip = CORNER_SLIP * scale;
    const step = Math.abs(main);
    const probe: Box = { min: [...box.min], size: box.size };
    for (const dir of side === 0 ? [1, -1] : [Math.sign(side), -Math.sign(side)]) {
      // Smallest sideways offset that lets the box continue along `main`.
      for (let off = 0.1 * scale; off <= maxSlip + 1e-9; off += 0.1 * scale) {
        probe.min[0] = box.min[0];
        probe.min[1] = box.min[1];
        probe.min[2] = box.min[2];
        probe.min[other] += dir * off;
        if (overlapsSolid(src, probe)) break;
        probe.min[along] += Math.sign(main) * Math.min(step, 0.2 * scale);
        if (overlapsSolid(src, probe)) continue;
        // Free: slide sideways at walking pace (never more than the step).
        const d: Vec3 = [0, 0, 0];
        d[other] = dir * Math.min(off, step);
        moveBox(src, box, d);
        return;
      }
    }
  }
}

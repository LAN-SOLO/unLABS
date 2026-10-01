/**
 * Hair simulation — guide strands with position-based dynamics (pure).
 * ====================================================================
 *
 * Real hair is tens of thousands of strands; nobody simulates them all.
 * The engine simulates a few hundred **guide strands** (this module) and
 * the renderer grows the visible strands around them (children follow
 * their guide, see render/hero/hair-render.ts).
 *
 * Each guide is a polyline of `points` particles in the head's rest frame.
 * Every step (Verlet + position-based constraints, fixed sub-steps):
 *
 *  1. the first two particles ride on the head (root and the root's
 *     direction: hair leaves the scalp at a set angle),
 *  2. free particles integrate velocity, gravity and drag,
 *  3. **shape memory** pulls every particle towards where the groom puts it
 *     (rest pose carried by the head) — strong for the pinned updo, weak for
 *     loose curls, so the updo jiggles and the wisps swing,
 *  4. **inextensibility**: segment lengths are restored root to tip
 *     (follow-the-leader with a little mass-weighting: no stretching, no
 *     jitter),
 *  5. **collisions** with spheres and capsules in head / body space push
 *     particles out (the skull, the neck, the shoulders).
 *
 * Velocity is kept implicitly (Verlet), so a turning or walking head drags
 * the hair with real inertia. Space is whatever the caller passes: the
 * engine runs it in world space, matrices are column-major 4×4 (three.js
 * `Matrix4.elements`).
 */

export type Mat4 = ArrayLike<number>;

export interface GuideDef {
  /** Rest positions in head space (x, y, z per particle), root first. */
  rest: Float32Array;
  /** Shape-memory stiffness at the root … tip (0 = free, 1 = rigid per step). */
  stiffRoot: number;
  stiffTip: number;
}

export interface Collider {
  /** Which frame the collider lives in. */
  frame: "head" | "body";
  /** Sphere (b undefined) or capsule a→b, radius r, in that frame. */
  a: [number, number, number];
  b?: [number, number, number];
  r: number;
}

export interface HairSimOptions {
  /** Gravity in sim units per s² (default 0 → set by the caller). */
  gravity?: [number, number, number];
  /** Velocity kept per second (0..1, default 0.08 → strong air drag). */
  drag?: number;
  /** Fixed sub-step (s, default 1/90). */
  step?: number;
  /** Constraint iterations per sub-step (default 3). */
  iterations?: number;
  /** Uniform scale from head space to sim space (default 1). */
  scale?: number;
}

/** 4×4 column-major transform of a point into out[o..o+2]. */
function xform(m: Mat4, x: number, y: number, z: number, out: Float32Array, o: number): void {
  out[o] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  out[o + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  out[o + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
}

/** Inverse of a rigid (rotation · uniform scale + translation) 4×4 matrix. */
export function invertRigid(m: Mat4, out: Float64Array = new Float64Array(16)): Float64Array {
  // Columns are rotation × s: the inverse is Rᵀ / s² applied to (p − t).
  const s2 = m[0]! * m[0]! + m[1]! * m[1]! + m[2]! * m[2]!;
  const k = s2 > 0 ? 1 / s2 : 1;
  out[0] = m[0]! * k;
  out[1] = m[4]! * k;
  out[2] = m[8]! * k;
  out[3] = 0;
  out[4] = m[1]! * k;
  out[5] = m[5]! * k;
  out[6] = m[9]! * k;
  out[7] = 0;
  out[8] = m[2]! * k;
  out[9] = m[6]! * k;
  out[10] = m[10]! * k;
  out[11] = 0;
  const tx = m[12]!;
  const ty = m[13]!;
  const tz = m[14]!;
  out[12] = -(out[0] * tx + out[4] * ty + out[8] * tz);
  out[13] = -(out[1] * tx + out[5] * ty + out[9] * tz);
  out[14] = -(out[2] * tx + out[6] * ty + out[10] * tz);
  out[15] = 1;
  return out;
}

export class HairSim {
  /** Particles per guide. */
  readonly points: number;
  readonly guides: number;
  /** Current particle positions (sim space), guide-major. */
  readonly pos: Float32Array;
  private readonly prev: Float32Array;
  /** Rest positions in head space. */
  private readonly rest: Float32Array;
  /** Rest segment lengths (head space) per particle (from its predecessor). */
  private readonly seg: Float32Array;
  /** Shape stiffness per particle (as the per-iteration share, precomputed). */
  private readonly stiff: Float32Array;
  /** Guides that collide (loose ones; styled hair keeps its shape and skips it). */
  private readonly collides: Uint8Array;
  /** Rest targets carried by the head this frame (sim space). */
  private readonly target: Float32Array;
  private readonly colliders: Collider[] = [];
  private gravity: [number, number, number];
  private readonly drag: number;
  private readonly dt: number;
  private readonly iterations: number;
  private scale: number;
  private acc = 0;
  private started = false;
  private readonly headInv = new Float64Array(16);
  private readonly bodyInv = new Float64Array(16);
  private head: Mat4 = IDENTITY;
  private body: Mat4 = IDENTITY;

  constructor(guides: readonly GuideDef[], opts: HairSimOptions = {}) {
    if (!guides.length) throw new Error("hair sim needs at least one guide");
    this.points = guides[0]!.rest.length / 3;
    this.guides = guides.length;
    const n = this.points * this.guides;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.rest = new Float32Array(n * 3);
    this.target = new Float32Array(n * 3);
    this.seg = new Float32Array(n);
    this.stiff = new Float32Array(n);
    this.collides = new Uint8Array(guides.length);
    const P = this.points;
    const iterations = opts.iterations ?? 3;
    guides.forEach((g, gi) => {
      this.collides[gi] = Math.min(g.stiffRoot, g.stiffTip) < 0.5 ? 1 : 0;
      if (g.rest.length !== P * 3) throw new Error("every guide needs the same particle count");
      this.rest.set(g.rest, gi * P * 3);
      for (let i = 0; i < P; i++) {
        const k = gi * P + i;
        const t = i / (P - 1);
        const st = g.stiffRoot + (g.stiffTip - g.stiffRoot) * t;
        this.stiff[k] = 1 - Math.pow(1 - Math.min(0.999, st), 1 / iterations);
        if (i > 0) {
          const a = (k - 1) * 3;
          const b = k * 3;
          this.seg[k] = Math.hypot(
            this.rest[b]! - this.rest[a]!,
            this.rest[b + 1]! - this.rest[a + 1]!,
            this.rest[b + 2]! - this.rest[a + 2]!,
          );
        }
      }
    });
    this.gravity = opts.gravity ?? [0, 0, 0];
    this.drag = opts.drag ?? 0.08;
    this.dt = opts.step ?? 1 / 90;
    this.iterations = iterations;
    this.scale = opts.scale ?? 1;
  }

  addCollider(c: Collider): void {
    this.colliders.push(c);
  }

  setGravity(g: [number, number, number]): void {
    this.gravity = g;
  }

  setScale(s: number): void {
    this.scale = s;
  }

  /** Snap every particle to the groomed rest pose (no motion). */
  reset(head: Mat4, body: Mat4 = head): void {
    this.setFrames(head, body);
    this.carryRest();
    this.pos.set(this.target);
    this.prev.set(this.target);
    this.started = true;
  }

  private setFrames(head: Mat4, body: Mat4): void {
    this.head = head;
    this.body = body;
    invertRigid(head, this.headInv);
    invertRigid(body, this.bodyInv);
  }

  /** Rest pose carried by the head into sim space. */
  private carryRest(): void {
    const r = this.rest;
    for (let k = 0; k < r.length; k += 3)
      xform(this.head, r[k]!, r[k + 1]!, r[k + 2]!, this.target, k);
  }

  /**
   * Advance by `dt` seconds with the head (and body) at the given
   * transforms (head space → sim space). Large gaps (a paused tab, a
   * teleport) are clamped so the hair never explodes.
   */
  update(dt: number, head: Mat4, body: Mat4 = head): void {
    if (!this.started) {
      this.reset(head, body);
      return;
    }
    this.setFrames(head, body);
    this.carryRest();
    // A head that jumped far (teleport, floor change): snap instead of whipping.
    const jump = Math.hypot(
      this.target[0]! - this.pos[0]!,
      this.target[1]! - this.pos[1]!,
      this.target[2]! - this.pos[2]!,
    );
    if (jump > 40 * this.scale * (this.seg[1] || 1)) {
      this.pos.set(this.target);
      this.prev.set(this.target);
      return;
    }
    this.acc = Math.min(this.acc + Math.max(0, dt), this.dt * 6);
    while (this.acc >= this.dt) {
      this.acc -= this.dt;
      this.substep(this.dt);
    }
  }

  private substep(h: number): void {
    const { pos, prev, target, stiff, seg, points: P, guides: G } = this;
    const keep = Math.pow(this.drag, h);
    const [gx, gy, gz] = this.gravity;
    const h2 = h * h;
    // 1–2. Roots ride on the head; free particles integrate.
    for (let g = 0; g < G; g++) {
      for (let i = 0; i < P; i++) {
        const k = (g * P + i) * 3;
        if (i < 2) {
          prev[k] = pos[k]!;
          prev[k + 1] = pos[k + 1]!;
          prev[k + 2] = pos[k + 2]!;
          pos[k] = target[k]!;
          pos[k + 1] = target[k + 1]!;
          pos[k + 2] = target[k + 2]!;
          continue;
        }
        const x = pos[k]!;
        const y = pos[k + 1]!;
        const z = pos[k + 2]!;
        pos[k] = x + (x - prev[k]!) * keep + gx * h2;
        pos[k + 1] = y + (y - prev[k + 1]!) * keep + gy * h2;
        pos[k + 2] = z + (z - prev[k + 2]!) * keep + gz * h2;
        prev[k] = x;
        prev[k + 1] = y;
        prev[k + 2] = z;
      }
    }
    const sc = this.scale;
    for (let it = 0; it < this.iterations; it++) {
      for (let g = 0; g < G; g++) {
        for (let i = 2; i < P; i++) {
          const pi = g * P + i;
          const k = pi * 3;
          // 3. Shape memory (per-iteration share of the per-step stiffness).
          const s = stiff[pi]!;
          pos[k] = pos[k]! + (target[k]! - pos[k]!) * s;
          pos[k + 1] = pos[k + 1]! + (target[k + 1]! - pos[k + 1]!) * s;
          pos[k + 2] = pos[k + 2]! + (target[k + 2]! - pos[k + 2]!) * s;
          // 4. Segment length (the parent is treated as heavier: follow the leader).
          const a = k - 3;
          let dx = pos[k]! - pos[a]!;
          let dy = pos[k + 1]! - pos[a + 1]!;
          let dz = pos[k + 2]! - pos[a + 2]!;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const want = seg[pi]! * sc;
          const f = (len - want) / len;
          if (i > 2) {
            pos[a] = pos[a]! + dx * f * 0.15;
            pos[a + 1] = pos[a + 1]! + dy * f * 0.15;
            pos[a + 2] = pos[a + 2]! + dz * f * 0.15;
          }
          dx = pos[k]! - pos[a]!;
          dy = pos[k + 1]! - pos[a + 1]!;
          dz = pos[k + 2]! - pos[a + 2]!;
          const len2 = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const g2 = want / len2;
          pos[k] = pos[a]! + dx * g2;
          pos[k + 1] = pos[a + 1]! + dy * g2;
          pos[k + 2] = pos[a + 2]! + dz * g2;
        }
      }
    }
    // 5. Collisions (once per sub-step, loose strands only).
    if (this.colliders.length) this.collide();
  }

  private readonly tmp = new Float32Array(3);

  private collide(): void {
    const { pos, points: P, guides: G } = this;
    const sc = this.scale;
    for (const c of this.colliders) {
      const inv = c.frame === "head" ? this.headInv : this.bodyInv;
      const fwd = c.frame === "head" ? this.head : this.body;
      const r = c.r;
      for (let g = 0; g < G; g++) {
        if (!this.collides[g]) continue;
        for (let i = 2; i < P; i++) {
          const k = (g * P + i) * 3;
          // Into the collider's frame (head / body units).
          xform(inv, pos[k]!, pos[k + 1]!, pos[k + 2]!, this.tmp, 0);
          const px = this.tmp[0]!;
          const py = this.tmp[1]!;
          const pz = this.tmp[2]!;
          let cx = c.a[0];
          let cy = c.a[1];
          let cz = c.a[2];
          if (c.b) {
            const bx = c.b[0] - cx;
            const by = c.b[1] - cy;
            const bz = c.b[2] - cz;
            const l2 = bx * bx + by * by + bz * bz || 1;
            const t = Math.max(
              0,
              Math.min(1, ((px - cx) * bx + (py - cy) * by + (pz - cz) * bz) / l2),
            );
            cx += bx * t;
            cy += by * t;
            cz += bz * t;
          }
          const dx = px - cx;
          const dy = py - cy;
          const dz = pz - cz;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d >= r || d < 1e-6) continue;
          const push = r / d;
          xform(fwd, cx + dx * push, cy + dy * push, cz + dz * push, pos, k);
        }
      }
      void sc;
    }
  }

  /** Largest relative segment stretch (diagnostics / tests). */
  maxStretch(): number {
    const { pos, seg, points: P, guides: G } = this;
    let worst = 0;
    for (let g = 0; g < G; g++)
      for (let i = 1; i < P; i++) {
        const k = (g * P + i) * 3;
        const a = k - 3;
        const len = Math.hypot(
          pos[k]! - pos[a]!,
          pos[k + 1]! - pos[a + 1]!,
          pos[k + 2]! - pos[a + 2]!,
        );
        const want = seg[g * P + i]! * this.scale;
        if (want > 0) worst = Math.max(worst, Math.abs(len - want) / want);
      }
    return worst;
  }
}

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

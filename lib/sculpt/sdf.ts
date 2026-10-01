/**
 * Signed distance primitives for the sculpt engine (pure — no three).
 * ===================================================================
 *
 * The clarity renderer models its "real" characters (Jade, later Damien)
 * as signed distance fields: negative inside, positive outside, roughly
 * Lipschitz-1 so the sparse sampler in surface-nets.ts may skip empty
 * space. Every primitive takes a point as three numbers (no allocations in
 * the hot loop: a body is evaluated a few million times while meshing).
 *
 * Formulas after Inigo Quilez ("distance functions", "smooth minimum").
 */

export type Vec3 = [number, number, number];

/** A field: distance from (x, y, z) to the surface (negative inside). */
export type Sdf = (x: number, y: number, z: number) => number;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// ── Combinators ─────────────────────────────────────────────────

/** Polynomial smooth union (k = blend radius, 0 = hard). */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return a < b ? a : b;
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}

/** Smooth intersection. */
export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

/** Smooth subtraction: `a` minus `b`. */
export function ssub(a: number, b: number, k: number): number {
  return smax(a, -b, k);
}

// ── Primitives ──────────────────────────────────────────────────

export function sphere(x: number, y: number, z: number, c: Vec3, r: number): number {
  return Math.hypot(x - c[0], y - c[1], z - c[2]) - r;
}

/**
 * Ellipsoid (radii r) — the cheap bound from IQ: exact on the axes, close
 * enough elsewhere for sculpting (slightly under-estimates far away).
 */
export function ellipsoid(x: number, y: number, z: number, c: Vec3, r: Vec3): number {
  const px = (x - c[0]) / r[0];
  const py = (y - c[1]) / r[1];
  const pz = (z - c[2]) / r[2];
  const k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = px / r[0];
  const qy = py / r[1];
  const qz = pz / r[2];
  const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  if (k1 < 1e-9) return -Math.min(r[0], r[1], r[2]);
  return (k0 * (k0 - 1)) / k1;
}

/** Parameter t ∈ [0,1] of the closest point on segment a→b. */
export function segmentT(x: number, y: number, z: number, a: Vec3, b: Vec3): number {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  const bz = b[2] - a[2];
  const l2 = bx * bx + by * by + bz * bz;
  if (l2 < 1e-12) return 0;
  return clamp(((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / l2, 0, 1);
}

/** Capsule from a to b with radius r. */
export function capsule(x: number, y: number, z: number, a: Vec3, b: Vec3, r: number): number {
  const t = segmentT(x, y, z, a, b);
  return (
    Math.hypot(
      x - (a[0] + (b[0] - a[0]) * t),
      y - (a[1] + (b[1] - a[1]) * t),
      z - (a[2] + (b[2] - a[2]) * t),
    ) - r
  );
}

/**
 * Tapered capsule ("round cone"): radius ra at a, rb at b (IQ's exact
 * formula). Limbs, fingers, the neck and the nose are made of these.
 */
export function roundCone(
  x: number,
  y: number,
  z: number,
  a: Vec3,
  b: Vec3,
  ra: number,
  rb: number,
): number {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  if (l2 < 1e-12) return sphere(x, y, z, a, Math.max(ra, rb));
  const rr = ra - rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = x - a[0];
  const pay = y - a[1];
  const paz = z - a[2];
  const yy = pax * bax + pay * bay + paz * baz;
  const zz = yy - l2;
  const cx = pax * l2 - bax * yy;
  const cy = pay * l2 - bay * yy;
  const cz = paz * l2 - baz * yy;
  const x2 = cx * cx + cy * cy + cz * cz;
  const y2 = yy * yy * l2;
  const z2 = zz * zz * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
}

/** Rounded box centred at c with half extents h and corner radius r. */
export function roundBox(x: number, y: number, z: number, c: Vec3, h: Vec3, r: number): number {
  const qx = Math.abs(x - c[0]) - h[0] + r;
  const qy = Math.abs(y - c[1]) - h[1] + r;
  const qz = Math.abs(z - c[2]) - h[2] + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Torus in the xz plane around c (major radius R, tube radius r). */
export function torusY(x: number, y: number, z: number, c: Vec3, R: number, r: number): number {
  const q = Math.hypot(x - c[0], z - c[2]) - R;
  return Math.hypot(q, y - c[1]) - r;
}

/** Half space below the plane through p with unit normal n (inside = behind n). */
export function plane(x: number, y: number, z: number, p: Vec3, n: Vec3): number {
  return (x - p[0]) * n[0] + (y - p[1]) * n[1] + (z - p[2]) * n[2];
}

// ── Noise (for wrinkles, strands, skin) ─────────────────────────

function hash3(i: number, j: number, k: number): number {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [-1, 1]. */
export function vnoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const c000 = hash3(ix, iy, iz);
  const c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz);
  const c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1);
  const c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1);
  const c111 = hash3(ix + 1, iy + 1, iz + 1);
  const x00 = mix(c000, c100, ux);
  const x10 = mix(c010, c110, ux);
  const x01 = mix(c001, c101, ux);
  const x11 = mix(c011, c111, ux);
  return mix(mix(x00, x10, uy), mix(x01, x11, uy), uz) * 2 - 1;
}

/** Fractal value noise (octaves ≥ 1), amplitude ~[-1, 1]. */
export function fbm(x: number, y: number, z: number, octaves = 3): number {
  let a = 0.5;
  let f = 1;
  let s = 0;
  let n = 0;
  for (let o = 0; o < octaves; o++) {
    s += a * vnoise(x * f, y * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

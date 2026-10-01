/**
 * Jade's groom — the guide strands of her copper updo (pure).
 * ===========================================================
 *
 * Built from the portrait: every strand is swept straight up from the
 * hairline into a tall pompadour, gathered into a messy knot on the crown;
 * the sides are pulled up tight above the ears; loose curly wisps fall at
 * the temples, behind the ears and at the nape; fine flyaways stand off the
 * updo and catch the rim light.
 *
 * Output: guide strands (`GuideDef` for the simulation, lib/hair/sim.ts)
 * with per-guide render data (how many strands grow around each guide, how
 * wide the clump is, how curly) — the renderer grows the visible strands.
 * Everything is in head space = character space (model voxels), the same
 * frame the sculpt uses. Deterministic (seeded).
 */
import type { GuideDef } from "@/lib/hair/sim";
import { HAIR_KNOT, hairRegion, headField, jadeHairVolume } from "@/lib/world/hero/jade-sculpt";
import type { Vec3 } from "@/lib/sculpt/sdf";

/** Particles per guide strand. */
export const GUIDE_POINTS = 16;

export type StrandKind = "updo" | "knot" | "wisp" | "flyaway";

export interface GroomGuide extends GuideDef {
  kind: StrandKind;
  /** Rest normals per particle (head space): "outwards" from the hair volume. */
  normals: Float32Array;
  /** Strands grown around this guide (portrait detail; the game scales it down). */
  children: number;
  /** Clump half-width across the flow at the root / tip (voxels). */
  spreadRoot: number;
  spreadTip: number;
  /** Depth range of the children under the guide (voxels into the volume). */
  depth: number;
  /** Curl radius (voxels) and turns per strand length for the children. */
  curl: number;
  curlTurns: number;
  /** Strand width (voxels) at the root. */
  width: number;
}

export interface JadeGroom {
  guides: GroomGuide[];
  points: number;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function grad(f: (x: number, y: number, z: number) => number, p: V, e = 0.04): V {
  return norm([
    f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]),
    f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]),
    f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e),
  ]);
}

/** Pull p onto the iso surface f = off (two Newton steps). */
function project(f: (x: number, y: number, z: number) => number, p: V, off: number): V {
  let q = p;
  for (let i = 0; i < 3; i++) {
    const d = f(q[0], q[1], q[2]) - off;
    if (Math.abs(d) < 1e-3) break;
    q = sub(q, mul(grad(f, q), d));
  }
  return q;
}

/** Resample a polyline to n points evenly spaced along its length. */
export function resample(pts: readonly V[], n: number): V[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + len(sub(pts[i]!, pts[i - 1]!)));
  const total = cum[cum.length - 1]!;
  const out: V[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = (total * i) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1]! < t) j++;
    const seg = cum[j + 1]! - cum[j]! || 1;
    const u = Math.max(0, Math.min(1, (t - cum[j]!) / seg));
    const a = pts[j]!;
    const b = pts[Math.min(pts.length - 1, j + 1)]!;
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
  }
  return out;
}

function pack(pts: readonly V[]): Float32Array {
  const a = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => a.set(p, i * 3));
  return a;
}

/** Normals along a strand: outwards from the volume where it lies on it, else a stable perpendicular. */
function strandNormals(pts: readonly V[], vol: boolean): Float32Array {
  const out = new Float32Array(pts.length * 3);
  let prevN: V = [0, 0, 1];
  pts.forEach((p, i) => {
    const t = norm(sub(pts[Math.min(pts.length - 1, i + 1)]!, pts[Math.max(0, i - 1)]!));
    let n: V = vol ? grad(jadeHairVolume, p) : prevN;
    // Make it perpendicular to the strand.
    n = sub(n, mul(t, dot(n, t)));
    if (len(n) < 1e-3) n = norm(cross(t, [1, 0, 0]));
    n = norm(n);
    prevN = n;
    out.set(n, i * 3);
  });
  return out;
}

/** The outermost surface point along `dir`: march in from outside (skips inner cavities). */
function surfaceFromOutside(dir: V, f: (x: number, y: number, z: number) => number): V | null {
  const c: V = [0.1, 58.4, -0.9];
  let t = 9;
  for (let k = 0; k < 200 && t > 0; k++) {
    const p = add(c, mul(dir, t));
    const d = f(p[0], p[1], p[2]);
    if (d < 0.01) return project(f, p, 0);
    t -= Math.max(0.03, d * 0.8);
  }
  return null;
}

/**
 * An updo strand: from `root` along the volume's surface towards the knot,
 * hugging the surface at `lift`, then a part-turn around the knot.
 */
function updoPath(root: V, lift: number, swirl: number, r: () => number): V[] {
  const pts: V[] = [root];
  let p = root;
  const step = 0.18;
  for (let k = 0; k < 90; k++) {
    const toKnot = sub(HAIR_KNOT, p);
    const dist = len(toKnot);
    if (dist < 1.25) break;
    const n = grad(jadeHairVolume, p);
    // Flow: towards the knot, kept tangent to the surface; a gentle S-wave.
    let dir = norm(toKnot);
    dir = norm(sub(dir, mul(n, dot(dir, n))));
    const side = norm(cross(n, dir));
    dir = norm(add(dir, mul(side, 0.18 * Math.sin(k * 0.35 + swirl))));
    p = add(p, mul(dir, step));
    p = project(jadeHairVolume, p, lift);
    pts.push(p);
  }
  // Into the knot: a part-turn around the knot's axis, tucked in.
  const axis: V = [0.1, 1, 0.15];
  const a0 = Math.atan2(p[2] - HAIR_KNOT[2], p[0] - HAIR_KNOT[0]);
  const turn = 0.6 + r() * 0.9;
  for (let k = 1; k <= 10; k++) {
    const u = k / 10;
    const a = a0 + swirl * turn * Math.PI * u;
    const rad = 1.2 * (1 - 0.45 * u);
    pts.push([
      HAIR_KNOT[0] + Math.cos(a) * rad,
      p[1] + (HAIR_KNOT[1] + 0.35 - p[1]) * u + axis[1] * 0.2 * Math.sin(u * Math.PI),
      HAIR_KNOT[2] + Math.sin(a) * rad,
    ]);
  }
  return pts;
}

/** A loop of the messy knot: an off-centre ring around the knot centre. */
function knotLoop(r: () => number): V[] {
  const tilt = r() * Math.PI;
  const yaw = r() * Math.PI * 2;
  const rad = 1.05 + r() * 0.65;
  const a0 = r() * Math.PI * 2;
  const span = Math.PI * (1.2 + r() * 1.3);
  const pts: V[] = [];
  for (let k = 0; k <= 20; k++) {
    const a = a0 + (span * k) / 20;
    // Ring in its own plane, tilted and turned.
    const lx = Math.cos(a) * rad;
    const ly = Math.sin(a) * rad * 0.7;
    const y1 = ly * Math.cos(tilt);
    const z1 = ly * Math.sin(tilt);
    const x2 = lx * Math.cos(yaw) - z1 * Math.sin(yaw);
    const z2 = lx * Math.sin(yaw) + z1 * Math.cos(yaw);
    pts.push([HAIR_KNOT[0] + x2, HAIR_KNOT[1] + 0.25 + y1 * 0.9, HAIR_KNOT[2] + z2]);
  }
  return pts;
}

/** A loose curl hanging from `root`: an irregular helix that opens up as it falls. */
function wispPath(root: V, length: number, turns: number, drift: V, seed: number): V[] {
  const pts: V[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = seed * 2.1 + t * turns * Math.PI * 2 + 0.8 * Math.sin(seed + t * 5);
    const rad = (0.05 + 0.28 * t) * (0.8 + 0.4 * Math.sin(seed * 3 + t * 7));
    const sag = t * t;
    pts.push([
      root[0] + drift[0] * sag + Math.cos(a) * rad,
      root[1] - length * t + 0.25 * t * (1 - t),
      root[2] + drift[2] * sag + Math.sin(a) * rad,
    ]);
  }
  return pts;
}

/**
 * Jade's groom. `density` scales the number of guides (1 = portrait).
 * Guides are deterministic for a given density.
 */
export function jadeGroom(density = 1): JadeGroom {
  const r = rng(0x7ade);
  const guides: GroomGuide[] = [];
  const P = GUIDE_POINTS;
  const pushGuide = (
    kind: StrandKind,
    path: V[],
    o: Omit<GroomGuide, "rest" | "normals" | "kind">,
    onVolume: boolean,
  ) => {
    const pts = resample(path, P);
    guides.push({ kind, rest: pack(pts), normals: strandNormals(pts, onVolume), ...o });
  };

  // 1. The updo: roots spread over the volume (Fibonacci directions), dense at the hairline.
  const nUpdo = Math.round(600 * density);
  for (let i = 0; i < nUpdo; i++) {
    const k = i + 0.5;
    const y = 1 - (2 * k) / nUpdo;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = k * 2.399963229728653;
    const dir: V = [Math.cos(phi) * rad, y, Math.sin(phi) * rad];
    const hit = surfaceFromOutside(dir, jadeHairVolume);
    if (!hit) continue;
    // Only where hair grows / the updo stands, and not inside the knot.
    if (hairRegion(hit[1], hit[2], hit[0]) > 0.25 && hit[1] < 59.5) continue;
    if (len(sub(hit, HAIR_KNOT)) < 1.4) continue;
    // Under the hairline the volume's cut lies inside the head: not a root.
    if (headField(hit[0], hit[1], hit[2]) < -0.05) continue;
    const swirl = hit[0] < 0 ? -1 : 1;
    const path = updoPath(hit, 0.02 + r() * 0.05, swirl, r);
    if (path.length < 6) continue;
    pushGuide(
      "updo",
      path,
      {
        stiffRoot: 0.92,
        stiffTip: 0.55,
        children: 46,
        spreadRoot: 0.3,
        spreadTip: 0.24,
        depth: 0.22,
        curl: 0.015,
        curlTurns: 3,
        width: 0.016,
      },
      true,
    );
  }
  // Hairline: an extra ring of strands right at the edge of the face, so the
  // sweep-up reads from the front (they start on the scalp, not on the volume).
  const nLine = Math.round(70 * density);
  for (let i = 0; i < nLine; i++) {
    const a = -Math.PI * 0.4 + (Math.PI * 0.8 * (i + 0.5)) / nLine;
    const dir: V = norm([Math.sin(a), 0.32, Math.cos(a) * 0.95 + 0.2]);
    const hit = surfaceFromOutside(dir, (x, yy, z) => headField(x, yy, z));
    if (!hit) continue;
    // Walk up the scalp to the hairline.
    let p = hit;
    for (let k = 0; k < 60 && hairRegion(p[1], p[2], p[0]) > 0; k++)
      p = project(headField, add(p, [0, 0.1, -0.02]), 0);
    if (hairRegion(p[1], p[2], p[0]) > 0.05) continue;
    // Root just above the scalp (not on the volume's cut at the hairline).
    const path = updoPath(add(p, mul(grad(headField, p), 0.03)), 0.04, a < 0 ? -1 : 1, r);
    if (path.length < 6) continue;
    pushGuide(
      "updo",
      path,
      {
        stiffRoot: 0.95,
        stiffTip: 0.6,
        children: 48,
        spreadRoot: 0.2,
        spreadTip: 0.2,
        depth: 0.08,
        curl: 0.01,
        curlTurns: 2,
        width: 0.014,
      },
      true,
    );
  }

  // 2. The knot: messy loops around the crown.
  const nKnot = Math.round(46 * density);
  for (let i = 0; i < nKnot; i++)
    pushGuide(
      "knot",
      knotLoop(r),
      {
        stiffRoot: 0.85,
        stiffTip: 0.4,
        children: 70,
        spreadRoot: 0.28,
        spreadTip: 0.34,
        depth: 0.25,
        curl: 0.04,
        curlTurns: 4,
        width: 0.017,
      },
      false,
    );

  // 3. Loose curly wisps: temples, behind the ears, the nape (they swing).
  const wisps: [V, number, number, V][] = [];
  for (const s of [-1, 1]) {
    // Loose curls along the cheeks and in front of the ears (the portrait).
    wisps.push([[s * 2.5, 58.2, 0.85], 4.2, 2.4, [s * 0.55, 0, 0.2]]);
    wisps.push([[s * 2.62, 58.0, 0.45], 3.8, 2.1, [s * 0.75, 0, 0.1]]);
    wisps.push([[s * 2.72, 57.7, -0.05], 3.2, 1.8, [s * 0.7, 0, -0.1]]);
    wisps.push([[s * 2.6, 57.4, -0.6], 3.6, 2.2, [s * 0.6, 0, -0.2]]);
    wisps.push([[s * 2.2, 56.6, -1.7], 3.4, 2.4, [s * 0.45, 0, -0.25]]);
    wisps.push([[s * 1.6, 55.6, -2.6], 2.8, 2.0, [s * 0.25, 0, -0.35]]);
    wisps.push([[s * 0.8, 55.0, -3.0], 2.5, 1.8, [s * 0.15, 0, -0.3]]);
  }
  wisps.push([[0.1, 54.9, -3.15], 2.2, 1.6, [0, 0, -0.3]]);
  wisps.forEach(([root, length, turns, drift], i) => {
    const seed = 1 + i * 1.7;
    pushGuide(
      "wisp",
      wispPath(
        project(jadeHairVolume, root, 0.02),
        length * (0.9 + r() * 0.25),
        turns,
        drift,
        seed,
      ),
      {
        stiffRoot: 0.35,
        stiffTip: 0.04,
        children: 22,
        spreadRoot: 0.06,
        spreadTip: 0.12,
        depth: 0.05,
        curl: 0.07,
        curlTurns: 2.5,
        width: 0.013,
      },
      false,
    );
  });

  // 4. Flyaways: fine strands lifting off the updo along the flow.
  const nFly = Math.round(220 * density);
  for (let i = 0; i < nFly; i++) {
    const az = r() * Math.PI * 2;
    const el = 0.05 + r() * 1.3;
    const dir: V = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    const hit = surfaceFromOutside(dir, jadeHairVolume);
    if (!hit || hit[1] < 56 || headField(hit[0], hit[1], hit[2]) < -0.05) continue;
    const n = grad(jadeHairVolume, hit);
    let flow = norm(sub(HAIR_KNOT, hit));
    flow = norm(sub(flow, mul(n, dot(flow, n))));
    const l = 0.8 + r() * 2.2;
    const out = 0.25 + r() * 1.1;
    const pts: V[] = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      pts.push(
        add(
          add(hit, mul(flow, l * u)),
          add(mul(n, out * u * u), [0.12 * Math.sin(u * 5 + i), 0, 0.12 * Math.cos(u * 4 + i)]),
        ),
      );
    }
    pushGuide(
      "flyaway",
      pts,
      {
        stiffRoot: 0.6,
        stiffTip: 0.08,
        children: 3,
        spreadRoot: 0.03,
        spreadTip: 0.12,
        depth: 0,
        curl: 0.05,
        curlTurns: 1.5,
        width: 0.009,
      },
      false,
    );
  }
  return { guides, points: P };
}

/** Head-space rest position of the head joint's origin is not needed here: rest is character space. */
export type { Vec3 };

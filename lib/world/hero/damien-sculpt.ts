/**
 * Damien Fridge, sculpted — the distance fields of the "real" Damien (pure).
 * ==========================================================================
 *
 * Like Jade (jade-sculpt.ts), Damien exists as signed distance fields on
 * his own anatomical skeleton (damien-skeleton.ts), meshed with surface
 * nets. He is fully modelled — tall, heavy-set, slicked-back grey-blond
 * hair tied in a knot at the back, a long pointed grey beard, a white shirt
 * — but the game never shows this model plainly: until he has been found
 * (lib/world/damien.ts) every appearance goes through the veil shader
 * (render/hero/veil-material.ts), which quantises his surface into coarse
 * cold blocks so no face, hair or skin colour reads. The revealed render
 * is a dev preview only.
 *
 * Layers: head (skin), beard, hair (with the knot), hands, shirt, trousers,
 * shoes. Units: model voxels, feet on y = 0, front = +z, his right = -x.
 */
import {
  capsule,
  ellipsoid,
  fbm,
  roundBox,
  roundCone,
  smax,
  smin,
  smoothstep,
  ssub,
  type Vec3,
} from "@/lib/sculpt/sdf";
import type { SculptLayer } from "@/lib/world/hero/jade-sculpt";
import { DAMIEN_BODY as B } from "@/lib/world/hero/damien-skeleton";

function boxDist(x: number, y: number, z: number, lo: Vec3, hi: Vec3): number {
  const dx = Math.max(lo[0] - x, 0, x - hi[0]);
  const dy = Math.max(lo[1] - y, 0, y - hi[1]);
  const dz = Math.max(lo[2] - z, 0, z - hi[2]);
  return Math.hypot(dx, dy, dz);
}

// ── Head ────────────────────────────────────────────────────────

const SKULL_C: Vec3 = [0, 58.75, -0.75];
const SKULL_R: Vec3 = [2.72, 3.45, 3.45];
/** Eye centres (no eyeballs: sockets only — he is never seen up close). */
export const DAMIEN_EYES: readonly Vec3[] = [
  [-1.18, B.eyeY, 2.45],
  [1.18, B.eyeY, 2.45],
];

function headField(x: number, y: number, z: number): number {
  let d = ellipsoid(x, y, z, SKULL_C, SKULL_R);
  // A long face with a heavy jaw.
  d = smin(d, ellipsoid(x, y, z, [0, 56.6, 0.55], [2.38, 2.95, 2.3]), 0.9);
  for (const s of [-1, 1]) {
    d = smin(d, roundCone(x, y, z, [s * 1.75, 55.2, -0.4], [s * 0.2, 54.0, 1.95], 0.72, 0.5), 1.3);
    d = smin(d, ellipsoid(x, y, z, [s * 1.65, 57.4, 1.5], [0.85, 0.55, 0.9]), 0.6);
  }
  d = smin(d, ellipsoid(x, y, z, [0, 54.05, 2.15], [0.8, 0.6, 0.65]), 0.6);
  // Strong brow ridge.
  d = smin(d, capsule(x, y, z, [-1.55, 58.85, 2.45], [1.55, 58.85, 2.45], 0.42), 0.6);
  for (const e of DAMIEN_EYES)
    d = ssub(d, ellipsoid(x, y, z, [e[0], e[1] + 0.05, 2.95], [0.7, 0.42, 0.45]), 0.3);
  // A long straight nose.
  d = smin(d, roundCone(x, y, z, [0, 58.55, 2.75], [0, 56.75, 3.55], 0.26, 0.3), 0.4);
  d = smin(d, ellipsoid(x, y, z, [0, 56.6, 3.45], [0.34, 0.3, 0.3]), 0.3);
  for (const s of [-1, 1])
    d = smin(d, ellipsoid(x, y, z, [s * 0.36, 56.4, 3.05], [0.24, 0.2, 0.24]), 0.3);
  // Ears.
  for (const s of [-1, 1]) {
    let ear = ellipsoid(x, y, z, [s * 2.62, 57.6, -0.45], [0.3, 0.9, 0.55]);
    ear = ssub(ear, ellipsoid(x, y, z, [s * 2.82, 57.6, -0.38], [0.14, 0.55, 0.3]), 0.1);
    d = smin(d, ear, 0.18);
  }
  // A thick neck.
  d = smin(d, roundCone(x, y, z, [0, 50.4, -0.95], [0, 54.2, -0.8], 2.15, 1.95), 0.8);
  return d;
}

function headSkin(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-3.6, 50.0, -4.6], [3.6, 62.5, 4.6]);
  if (far > 0.8) return far;
  return headField(x, y, z);
}

// ── Beard ───────────────────────────────────────────────────────

/** The long pointed beard: a shell over jaw and chin that runs to a point on the chest. */
function beard(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-3.0, 46.6, -1.6], [3.0, 57.2, 4.4]);
  if (far > 0.8) return far;
  // Shell over the lower face, below the cheekbones and in front of the ears.
  let d = headField(x, y, z) - 0.38;
  d = smax(d, y - (56.4 - 0.25 * Math.abs(x)), 0.25);
  d = smax(d, -0.6 - z, 0.3);
  // Keep the lips free under the moustache line.
  d = ssub(d, ellipsoid(x, y, z, [0, 55.0, 3.2], [0.55, 0.16, 0.5]), 0.08);
  // The long point down the chest.
  d = smin(d, roundCone(x, y, z, [0, 53.6, 2.2], [0, 47.4, 3.1], 1.55, 0.18), 0.8);
  // The moustache: two swept wings.
  for (const s of [-1, 1])
    d = smin(
      d,
      roundCone(x, y, z, [s * 0.15, 55.55, 3.45], [s * 1.0, 55.05, 2.95], 0.2, 0.12),
      0.12,
    );
  // Strands: grooves running down.
  const g = Math.sin(x * 9.0 + 2 * fbm(x * 0.6, y * 0.3, z * 0.6, 2));
  return d + 0.04 * g;
}

// ── Hair ────────────────────────────────────────────────────────

function hair(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-3.4, 55.0, -5.6], [3.4, 64.2, 3.6]);
  if (far > 0.8) return far;
  // Receding hairline, swept straight back.
  const line = 59.7 + (z + 0.9) * 0.55;
  const region = Math.max(Math.min(line - y, z + 1.2), 56.2 - y);
  let d = smax(ellipsoid(x, y, z, SKULL_C, SKULL_R) - 0.32, region - 0.05, 0.2);
  // Volume swept back over the crown.
  d = smin(d, smax(ellipsoid(x, y, z, [0, 61.35, -0.7], [2.5, 1.45, 3.0]), region, 0.3), 0.8);
  // The knot at the back of the head, and the band of hair gathered into it.
  d = smin(d, ellipsoid(x, y, z, [0, 59.6, -4.25], [0.95, 1.0, 0.9]), 0.4);
  d = smin(d, capsule(x, y, z, [0, 60.2, -3.4], [0, 59.6, -4.2], 0.55), 0.3);
  // Slicked back: fine grooves along z.
  const g = Math.sin(x * 12.0 + 1.6 * fbm(x * 0.5, y * 0.5, z * 0.3, 2));
  return d + 0.03 * g;
}

// ── Body under the clothes ──────────────────────────────────────

function torsoBody(x: number, y: number, z: number): number {
  let d = ellipsoid(x, y, z, [0, 46.0, -0.45], [5.15, 5.6, 3.35]);
  d = smin(d, ellipsoid(x, y, z, [0, 49.3, -0.6], [4.9, 2.1, 2.75]), 1.2);
  // A belly.
  d = smin(d, ellipsoid(x, y, z, [0, 40.6, 0.55], [4.65, 4.3, 3.55]), 1.6);
  d = smin(d, ellipsoid(x, y, z, [0, 33.6, -0.2], [4.85, 4.0, 3.4]), 1.6);
  for (const s of [-1, 1]) {
    d = smin(d, roundCone(x, y, z, [s * 1.0, 51.3, -0.95], [s * 5.7, 50.3, -0.6], 1.55, 1.05), 1.0);
    d = smin(d, ellipsoid(x, y, z, [s * 6.0, 49.5, -0.5], [1.3, 1.55, 1.35]), 0.9);
    d = smin(d, ellipsoid(x, y, z, [s * 2.1, 46.8, 1.15], [2.2, 1.35, 1.25]), 1.2);
    d = smin(d, ellipsoid(x, y, z, [s * 2.0, 32.2, -1.6], [2.1, 2.4, 1.9]), 1.0);
  }
  return d;
}

function armBody(x: number, y: number, z: number): number {
  const s = x < 0 ? -1 : 1;
  const sh: Vec3 = [s * B.shoulderX, B.shoulderY - 0.3, -0.5];
  const el: Vec3 = [s * B.elbow[0], B.elbow[1], B.elbow[2]];
  const wr: Vec3 = [s * B.wrist[0], B.wrist[1], B.wrist[2]];
  let d = roundCone(x, y, z, sh, el, 1.55, 1.15);
  d = smin(d, roundCone(x, y, z, el, wr, 1.17, 0.88), 0.5);
  d = smin(d, ellipsoid(x, y, z, [s * (B.elbow[0] + 0.15), 37.6, -0.35], [1.25, 2.8, 1.2]), 0.9);
  return d;
}

// ── Hands ───────────────────────────────────────────────────────

function hand(x: number, y: number, z: number): number {
  const s = x < 0 ? -1 : 1;
  const w = B.wrist;
  const wx = s * w[0];
  const far = boxDist(
    x,
    y,
    z,
    [wx - 1.6, w[1] - 6.8, w[2] - 2.1],
    [wx + 1.6, w[1] + 1.4, w[2] + 2.5],
  );
  if (far > 0.6) return far;
  const inw = -s;
  const k = 1.12;
  let d = roundBox(x, y, z, [wx + s * 0.08, w[1] - 1.6, w[2] + 0.1], [0.46, 1.28, 1.0], 0.4);
  d = smin(
    d,
    roundCone(x, y, z, [wx, w[1] + 1.1, w[2]], [wx, w[1] - 0.4, w[2] + 0.05], 0.92, 0.76),
    0.4,
  );
  const fingers: [number, number, number][] = [
    [0.74, 0.95, 0.27],
    [0.25, 1.04, 0.28],
    [-0.23, 0.98, 0.27],
    [-0.68, 0.8, 0.24],
  ];
  const y0 = w[1] - 2.75;
  for (const [fz, ls, r] of fingers) {
    const p0: Vec3 = [wx + s * 0.05, y0, w[2] + fz];
    const p1: Vec3 = [p0[0] + inw * 0.2, p0[1] - 1.05 * ls * k, p0[2]];
    const p2: Vec3 = [p1[0] + inw * 0.42, p1[1] - 0.7 * ls * k, p1[2]];
    const p3: Vec3 = [p2[0] + inw * 0.45, p2[1] - 0.4 * ls * k, p2[2]];
    let f = roundCone(x, y, z, p0, p1, r, r * 0.94);
    f = smin(f, roundCone(x, y, z, p1, p2, r * 0.94, r * 0.86), 0.08);
    f = smin(f, roundCone(x, y, z, p2, p3, r * 0.86, r * 0.8), 0.06);
    d = smin(d, f, 0.2);
  }
  const t0: Vec3 = [wx + inw * 0.34, w[1] - 1.05, w[2] + 0.86];
  const t1: Vec3 = [wx + inw * 0.7, w[1] - 2.15, w[2] + 1.45];
  const t2: Vec3 = [wx + inw * 0.8, w[1] - 3.0, w[2] + 1.58];
  let th = roundCone(x, y, z, t0, t1, 0.38, 0.3);
  th = smin(th, roundCone(x, y, z, t1, t2, 0.3, 0.26), 0.06);
  return smin(d, th, 0.35);
}

// ── Clothes ─────────────────────────────────────────────────────

const SHIRT_HEM = 35.8;
const WAIST_TOP = 37.6;

function shirt(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-10.0, 30.6, -4.9], [10.0, 54.4, 4.9]);
  if (far > 0.8) return far;
  const fold = 0.07 * fbm(x * 0.45, y * 0.3, z * 0.45, 2);
  let torso = torsoBody(x, y, z) - 0.28 - fold;
  const blouse = smoothstep(3.5, 0.0, Math.abs(y - 38.6));
  torso -= 0.14 * blouse + 0.05 * blouse * Math.sin(y * 3.1 + x * 0.9);
  if (Math.abs(x) < 0.45 && z > 0 && y < 51.0) torso -= 0.04;
  torso = smax(torso, SHIRT_HEM - y, 0.12);
  const nr = Math.hypot(x / 1.05, z + 0.9);
  torso = smax(torso, -Math.max(nr - 2.25, 50.9 - y), 0.15);
  let arms = armBody(x, y, z) - 0.25 - fold;
  const s = x < 0 ? -1 : 1;
  const de = Math.hypot(x - s * B.elbow[0], y - B.elbow[1], z - B.elbow[2]);
  arms -= 0.07 * smoothstep(2.8, 0.4, de) * Math.sin((y - B.elbow[1]) * 5.5 + x);
  arms = smax(arms, B.wrist[1] + 0.45 - y, 0.1);
  let d = smin(torso, arms, 0.7);
  // Collar: a band around the neck, open at the front.
  const R = 2.35 - (y - 51.0) * 0.05;
  let collar = Math.max(Math.abs(nr - R) - 0.13, y - 53.0, 50.8 - y);
  collar = Math.max(collar, -Math.max(Math.abs(x) - 0.25, -(z - 0.9)));
  d = smin(d, collar, 0.2);
  return d;
}

function trousers(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-7.6, 3.8, -5.6], [7.6, 39.6, 5.2]);
  if (far > 0.8) return far;
  const fold = 0.06 * fbm(x * 0.5 + 3, y * 0.28, z * 0.5, 2);
  let d = torsoBody(x, y, z) - 0.42;
  const s = x < 0 ? -1 : 1;
  const hip: Vec3 = [s * B.hipJointX, B.hipJointY - 0.6, 0.12];
  const knee: Vec3 = [s * B.knee[0], B.knee[1], B.knee[2]];
  const hem: Vec3 = [s * B.ankle[0], 4.2, B.ankle[2] + 0.1];
  let leg = roundCone(x, y, z, hip, knee, 3.0, 2.3);
  leg = smin(leg, roundCone(x, y, z, knee, hem, 2.25, 1.85), 0.8);
  leg -= 0.05 * smoothstep(2.4, 0.3, Math.abs(y - knee[1])) * Math.sin(y * 4.2 + z * 1.4);
  d = smin(d, leg, 1.2) - fold;
  d -= 0.07 * smoothstep(WAIST_TOP - 1.0, WAIST_TOP - 0.85, y);
  d = smax(d, y - WAIST_TOP, 0.12);
  return smax(d, 4.25 - y, 0.08);
}

function shoes(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-5.4, -0.2, -3.0], [5.4, 5.6, 5.0]);
  if (far > 0.6) return far;
  const s = x < 0 ? -1 : 1;
  const bx = s * B.ankle[0];
  const yy = 0.95 + (y - 0.95) * 1.35;
  let d = roundCone(x, yy, z, [bx, 1.15, -1.3], [bx + s * 0.08, 0.9, 3.6], 1.12, 0.88) * 0.75;
  d = smin(d, roundCone(x, y, z, [bx, 0.9, -0.5], [bx, 4.9, -0.35], 1.32, 1.2), 0.7);
  d = smax(d, y - 4.9, 0.1);
  return smax(d, -y, 0.06);
}

/** Every sculpt layer of Damien (white shirt, dark trousers, dark shoes). */
export function damienLayers(): SculptLayer[] {
  return [
    {
      id: "head",
      material: "skin",
      sdf: headSkin,
      min: [-3.6, 50.0, -4.6],
      max: [3.6, 62.5, 4.6],
      cell: 0.08,
      gameCell: 0.28,
    },
    {
      id: "beard",
      material: "hair",
      sdf: beard,
      min: [-3.0, 46.6, -1.6],
      max: [3.0, 57.2, 4.4],
      cell: 0.08,
      gameCell: 0.26,
    },
    {
      id: "hair",
      material: "hair",
      sdf: hair,
      min: [-3.4, 55.0, -5.6],
      max: [3.4, 64.2, 3.6],
      cell: 0.09,
      gameCell: 0.3,
    },
    {
      id: "handR",
      material: "skin",
      sdf: (x, y, z) => (x < 0 ? hand(x, y, z) : 9),
      min: [-10.0, 23.0, -2.6],
      max: [-6.4, 32.4, 2.9],
      cell: 0.07,
      gameCell: 0.24,
    },
    {
      id: "handL",
      material: "skin",
      sdf: (x, y, z) => (x > 0 ? hand(x, y, z) : 9),
      min: [6.4, 23.0, -2.6],
      max: [10.0, 32.4, 2.9],
      cell: 0.07,
      gameCell: 0.24,
    },
    {
      id: "shirt",
      material: "shirt",
      sdf: shirt,
      min: [-10.0, 30.6, -4.9],
      max: [10.0, 54.4, 4.9],
      cell: 0.15,
      gameCell: 0.5,
    },
    {
      id: "trousers",
      material: "trousers",
      sdf: trousers,
      min: [-7.6, 3.8, -5.6],
      max: [7.6, 39.6, 5.2],
      cell: 0.17,
      gameCell: 0.6,
    },
    {
      id: "shoes",
      material: "boots",
      sdf: shoes,
      min: [-5.4, -0.2, -3.0],
      max: [5.4, 5.6, 5.0],
      cell: 0.11,
      gameCell: 0.36,
    },
  ];
}

/** Centre of his skull (the veil keys its head blocks off it). */
export const DAMIEN_HEAD_CENTER: Vec3 = SKULL_C;

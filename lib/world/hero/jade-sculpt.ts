/**
 * Jade Lawrence, sculpted — the distance fields of the "real" Jade (pure).
 * ========================================================================
 *
 * Jade is the one thing in the lab that is not made of voxels. This module
 * describes her body as signed distance fields in character space (model
 * voxels, 1 ≈ 2.78 cm, feet on y = 0, front = +z, her right = -x), on the
 * anatomical skeleton of skeleton.ts. The builder (build.ts) meshes every
 * layer with surface nets at its own resolution and skins it to the bones.
 *
 * Layers (each its own material in the renderer):
 *  - skin     — head, face (brow ridge, sockets, nose, lips, ears), neck
 *  - hands    — palms and curled fingers (skin material, finer cell)
 *  - hair     — the copper updo: a tall swept-up quiff, a twist on top,
 *               pinned sides and nape; strand grooves carved into the field
 *  - shirt    — white stand-collar shirt with placket, cuffs and folds
 *  - trousers — slim dark trousers
 *  - boots    — leather ankle boots with a flat sole
 *  - trim     — shirt buttons
 *
 * Reference: the look sheet from the user's portrait of Jade — pale skin,
 * vivid copper hair in a high updo, a round face with a closed smile,
 * winged liner over silver lids (painted by the skin shader), a white
 * shirt with a stand collar. Nothing here is taken from the photo itself.
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
  sphere,
  ssub,
  type Sdf,
  type Vec3,
} from "@/lib/sculpt/sdf";
import { JADE_BODY as B } from "@/lib/world/hero/skeleton";

export type HeroMaterial =
  | "skin"
  | "hair"
  | "hairShell"
  | "hairShell2"
  | "shirt"
  | "trousers"
  | "boots"
  | "trim"
  | "coat"
  | "belt"
  | "watch";

export interface SculptLayer {
  id: string;
  material: HeroMaterial;
  sdf: Sdf;
  min: Vec3;
  max: Vec3;
  /** Sampling cell at full detail (portrait). */
  cell: number;
  /** Sampling cell in the lab (game detail); the triangle budget lives here. */
  gameCell: number;
}

// ── Landmarks ───────────────────────────────────────────────────

/** Eye centres (eyeball spheres, radius EYE_R). */
export const JADE_EYES: readonly Vec3[] = [
  [-1.1, B.eyeY, 1.98],
  [1.1, B.eyeY, 1.98],
];
export const EYE_R = 0.43;

/** Out-of-box lower bound: distance to an axis-aligned box (≤ distance to anything inside it). */
function boxDist(x: number, y: number, z: number, lo: Vec3, hi: Vec3): number {
  const dx = Math.max(lo[0] - x, 0, x - hi[0]);
  const dy = Math.max(lo[1] - y, 0, y - hi[1]);
  const dz = Math.max(lo[2] - z, 0, z - hi[2]);
  return Math.hypot(dx, dy, dz);
}

// ── Head ────────────────────────────────────────────────────────

function headSkin(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-3.4, 49.0, -4.4], [3.4, 61.2, 4.4]);
  if (far > 0.8) return far;
  return headField(x, y, z);
}

// ── Head profile templates ───────────────────────────────────────
//
// The base of the head is a stack of horizontal cross-sections, like a
// sculptor's templates: for every height y the front-view half width
// `a`, the front depth `zf` (centre line) and the back depth `zb`. Each
// section is a superellipse — flatter at the front (a face is broad, not
// an egg), round at the back. Features (sockets, nose, lips, cheeks,
// ears) are added on top. Tables are in model voxels (1 ≈ 2.78 cm).

/** [y, half width, front z, back z] from the chin up to the crown. */
const HEAD_PROFILE: readonly (readonly [number, number, number, number])[] = [
  // Measured on the portrait (122.7 px per voxel, pupils ±1.1): a short
  // round chin at 53.0, the mouth line at 54.6, widest (±2.28) at the eyes.
  [52.95, 0.3, 1.35, -0.6],
  [53.15, 0.95, 2.05, -0.9],
  [53.45, 1.35, 2.38, -1.15],
  [53.85, 1.68, 2.5, -1.45],
  [54.3, 1.92, 2.58, -1.8],
  [54.75, 2.06, 2.66, -2.2],
  [55.3, 2.18, 2.7, -2.65],
  [55.9, 2.26, 2.62, -3.05],
  [56.55, 2.28, 2.5, -3.4],
  [57.3, 2.3, 2.66, -3.7],
  [58.0, 2.35, 2.6, -3.85],
  [58.8, 2.3, 2.4, -3.8],
  [59.5, 2.1, 2.02, -3.55],
  [60.1, 1.72, 1.45, -3.1],
  [60.5, 1.2, 0.8, -2.45],
  [60.75, 0.55, 0.1, -1.6],
  [60.85, 0.1, -0.5, -0.9],
];

/** Catmull-Rom sample of the profile table at height y (clamped). */
function profileAt(y: number): [number, number, number] {
  const T = HEAD_PROFILE;
  if (y <= T[0]![0]) return [T[0]![1], T[0]![2], T[0]![3]];
  const last = T[T.length - 1]!;
  if (y >= last[0]) return [last[1], last[2], last[3]];
  let i = 0;
  while (i < T.length - 2 && y > T[i + 1]![0]) i++;
  const p0 = T[Math.max(0, i - 1)]!;
  const p1 = T[i]!;
  const p2 = T[i + 1]!;
  const p3 = T[Math.min(T.length - 1, i + 2)]!;
  const t = (y - p1[0]) / (p2[0] - p1[0]);
  const t2 = t * t;
  const t3 = t2 * t;
  const cr = (k: 1 | 2 | 3) =>
    0.5 *
    (2 * p1[k] +
      (-p0[k] + p2[k]) * t +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  return [cr(1), cr(2), cr(3)];
}

/** Distance-like field of the profiled head base (negative inside). */
function headBase(x: number, y: number, z: number): number {
  const [a, zf, zb] = profileAt(y);
  const below = 52.95 - y;
  const above = y - 60.85;
  const zc = (zf + zb) / 2;
  const front = z >= zc;
  const depth = front ? zf - zc : zc - zb;
  const u = Math.abs(x) / Math.max(0.05, a);
  const w = Math.abs(z - zc) / Math.max(0.05, depth);
  // Flatter superellipse at the front of the brow and cheekbones; round
  // around the mouth (the dental arch) and at the back.
  // Round around the jaw and mouth (no corners), flatter across the brow and cheekbones.
  const n = front ? 1.85 + 0.55 * smoothstep(54.8, 56.4, y) : 2.1;
  const r = Math.pow(Math.pow(u, n) + Math.pow(w, n), 1 / n);
  const scale = Math.min(Math.max(a, 0.05), Math.max(depth, 0.05));
  let d = (r - 1) * scale * 0.85;
  if (below > 0) d = Math.max(d, below);
  if (above > 0) d = Math.max(d, above);
  return d;
}

export function headField(x: number, y: number, z: number): number {
  let d = headBase(x, y, z);
  // Cheekbones and the soft apples of the cheeks (she smiles).
  for (const s of [-1, 1]) {
    d = smin(d, ellipsoid(x, y, z, [s * 1.45, 56.0, 1.6], [0.7, 0.42, 0.74]), 0.6);
    // The apples of the cheeks, pushed up and out by the smile.
    d = smin(d, ellipsoid(x, y, z, [s * 1.15, 55.5, 2.0], [0.58, 0.44, 0.5]), 0.55);
  }
  // Brow ridge, soft, highest over the inner eye.
  for (const s of [-1, 1])
    d = smin(d, capsule(x, y, z, [s * 0.35, 57.38, 2.58], [s * 1.5, 57.48, 2.24], 0.2), 0.6);
  // Eye sockets: the lids sit in them; a soft hollow at the inner corner.
  for (const e of JADE_EYES) {
    // Shallow sockets: the portrait texture carries the eye area's shading.
    d = ssub(d, ellipsoid(x, y, z, [e[0], e[1] + 0.04, 2.62], [0.6, 0.34, 0.26]), 0.4);
    d = ssub(d, sphere(x, y, z, [e[0] * 0.55, e[1] + 0.02, 2.66], 0.14), 0.25);
  }
  // Nose: a straight, slim bridge; a small soft tip; slim wings; nostrils from below.
  // Nose: short and soft — a low bridge, a round tip, rounded wings.
  d = smin(d, roundCone(x, y, z, [0, 56.9, 2.48], [0, 55.5, 2.98], 0.2, 0.28), 0.32);
  d = smin(d, ellipsoid(x, y, z, [0, 55.38, 2.98], [0.34, 0.27, 0.27]), 0.32);
  for (const s of [-1, 1]) {
    d = smin(d, ellipsoid(x, y, z, [s * 0.42, 55.2, 2.72], [0.24, 0.18, 0.21]), 0.3);
    d = ssub(d, ellipsoid(x, y, z, [s * 0.18, 55.24, 2.84], [0.07, 0.035, 0.07]), 0.05);
    // Alar crease (the nasolabial fold is shading only — see the skin shader).
    d = ssub(d, sphere(x, y, z, [s * 0.52, 55.28, 2.66], 0.04), 0.1);
  }
  // Philtrum: two soft columns with a groove between.
  d = ssub(d, ellipsoid(x, y, z, [0, 54.9, 2.9], [0.07, 0.17, 0.05]), 0.08);
  // Lips: a wide closed-lip smile — thin upper lip, a soft lower lip,
  // corners pulled up and back into the cheeks.
  const lift = 0.12 * x * x;
  const ly = y - lift;
  // The lips wrap around the dental arch: their corners sit further back.
  const lz = z + 0.28 + 0.5 * x * x;
  for (const s of [-1, 1])
    d = smin(d, ellipsoid(x, ly, lz, [s * 0.42, 54.7, 2.7], [0.6, 0.08, 0.16]), 0.16);
  d = smin(d, ellipsoid(x, ly, lz, [0, 54.7, 2.74], [0.16, 0.08, 0.14]), 0.12);
  d = smin(d, ellipsoid(x, ly, lz, [0, 54.46, 2.68], [0.58, 0.14, 0.18]), 0.16);
  for (const s of [-1, 1])
    d = smin(d, ellipsoid(x, ly, lz, [s * 0.52, 54.5, 2.64], [0.42, 0.095, 0.15]), 0.15);
  // Vermilion border: the faint ridge where lip meets skin (upper lip).
  d = smin(d, capsule(x, ly, lz, [-0.8, 54.75, 2.78], [0.8, 54.75, 2.78], 0.03), 0.05);
  // The mouth line itself comes from the portrait texture (no carved groove).
  // Smile corners: a soft tuck (the texture draws the crease).
  for (const s of [-1, 1]) d = ssub(d, sphere(x, y, z, [s * 1.18, 54.78, 2.36], 0.04), 0.12);
  // Chin-lip fold, and a soft round chin pad.
  d = ssub(d, ellipsoid(x, y, z, [0, 54.05, 2.7], [0.42, 0.04, 0.06]), 0.18);
  d = smin(d, ellipsoid(x, y, z, [0, 53.45, 2.2], [0.7, 0.42, 0.42]), 0.4);
  // Ears.
  for (const s of [-1, 1]) {
    // Ears sit on the wider face of the portrait (outside the cheek line).
    let ear = ellipsoid(x, y, z, [s * 2.42, 56.1, -0.62], [0.2, 0.82, 0.42]);
    ear = smin(ear, ellipsoid(x, y, z, [s * 2.4, 55.38, -0.55], [0.17, 0.22, 0.19]), 0.1);
    ear = ssub(ear, ellipsoid(x, y, z, [s * 2.58, 56.12, -0.56], [0.11, 0.5, 0.25]), 0.06);
    d = smin(d, ear, 0.14);
  }
  // Neck: slim, with a clear angle under the jaw (small blend at the front).
  const neck = roundCone(x * 1.06, y, z, [0, 49.3, -0.9], [0, 53.4, -0.85], 1.85, 1.65);
  const k = z > 0.6 ? 0.28 : 0.7;
  d = smin(d, neck, k);
  // Lids around the eyeballs.
  for (const e of JADE_EYES) d = smin(d, lidShell(x, y, z, e), 0.08);
  return d;
}

/** Lid shell around an eyeball with the almond opening carved out. */
function lidShell(x: number, y: number, z: number, e: Vec3): number {
  const shell = sphere(x, y, z, e, EYE_R + 0.04);
  const out = e[0] < 0 ? e[0] - x : x - e[0];
  const u = out / 0.55;
  const v = y - e[1];
  // A smiling eye: the upper lid a little hooded, the lower lid lifted by the cheek.
  const upper = 0.145 * (1 - u * u) + 0.05 * u - 0.03;
  const lower = -0.095 * (1 - u * u) + 0.04 * u - 0.015;
  // Distance-like measure of the opening (negative inside the almond), only in front.
  const opening = Math.max(v - upper, lower - v, Math.abs(u) - 1, e[2] + 0.1 - z);
  return smax(shell, -opening, 0.03);
}

// ── Hair ────────────────────────────────────────────────────────

/** Where the scalp grows hair (negative) — the hairline around the face. */
export function hairRegion(y: number, z: number, x = 0): number {
  // A high forehead (the portrait): the hairline rises towards the front and
  // arches over the middle of the brow (lower at the temples).
  const arch = 0.25 * Math.max(0, 1 - (x / 2.2) * (x / 2.2)) * smoothstep(0.6, 2.2, z);
  const line = 56.5 + (z + 0.9) * 0.55 + arch;
  return Math.max(Math.min(line - y, z + 0.9), 54.2 - y);
}

/** Where the strands of the updo flow to: the twist on top. */
export const HAIR_TWIST: Vec3 = [0.15, 62.6, -0.95];

/**
 * The smooth volume of the updo (no strand texture): what the hair engine
 * grooms its strands over (lib/world/hero/jade-groom.ts). As in the
 * portrait: everything swept straight up from the hairline into a tall,
 * flame-shaped pompadour that narrows into a messy knot on the crown;
 * the sides pulled up tight above the ears.
 */
export function jadeHairVolume(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-3.9, 52.4, -5.0], [3.9, 64.8, 4.2]);
  if (far > 0.8) return far;
  // Cap: grows from nothing at the hairline to full thickness over ~1 voxel.
  const reg = hairRegion(y, z, x);
  // Thin at the temples and sides (pulled tight), full on top.
  const thick = -0.08 + (0.42 + 0.2 * smoothstep(58.5, 60.5, y)) * smoothstep(0.0, 2.2, -reg);
  let d = smax(headField(x, y, z) - 0.015 - thick, reg - 0.05, 0.15);
  // The pompadour: swept up from the forehead, tall, a little forward.
  let q = ellipsoid(x, y, z, [0.05, 60.9, -0.8], [2.95, 2.0, 2.6]);
  q = smax(q, reg + 0.6, 1.0);
  d = smin(d, q, 1.2);
  // The knot on the crown: its own round mass on top of the pompadour.
  d = smin(d, ellipsoid(x, y, z, [0.15, 62.45, -1.05], [1.2, 0.95, 1.25]), 0.5);
  // Pinned sides and the nape (pulled up tight; the ears stay free).
  for (const s of [-1, 1])
    d = smin(
      d,
      smax(ellipsoid(x, y, z, [s * 2.45, 58.6, -0.95], [0.72, 1.45, 2.15]), reg + 0.45, 0.6),
      0.7,
    );
  d = smin(d, ellipsoid(x, y, z, [0, 57.9, -2.9], [2.05, 2.2, 0.9]), 0.9);
  return d;
}

/** Centre of the knot on the crown (the strands of the updo flow into it). */
export const HAIR_KNOT: Vec3 = [0.15, 62.5, -1.05];

function hair(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-3.9, 52.4, -5.0], [3.9, 64.8, 4.2]);
  if (far > 0.8) return far;
  const reg = hairRegion(y, z, x);
  // The sculpted volume is the under-layer of the strand hair: a little
  // inside the surface the strands are groomed on (they cover it).
  const d = jadeHairVolume(x, y, z) + 0.06 * smoothstep(0.2, 1.2, -reg);
  // Strands flow towards the twist: clumps at constant azimuth around it,
  // irregular in width and depth (no regular grooves — that reads as plastic).
  const th = Math.atan2(x - HAIR_TWIST[0], z - HAIR_TWIST[2]);
  const along = Math.hypot(x - HAIR_TWIST[0], y - HAIR_TWIST[1], z - HAIR_TWIST[2]);
  const warp = 1.4 * fbm(x * 0.5, y * 0.3, z * 0.5, 2);
  const clumps = fbm(th * 4.2 + warp, along * 0.12, 0.7, 3);
  const fine = fbm(th * 15 + warp * 2, along * 0.3, 3.1, 2);
  // Tousled on top: loose curl-sized lumps grow with height.
  const top = smoothstep(59.5, 62.5, y);
  const lift =
    (0.14 + 0.16 * top) * fbm(x * 0.8 + 7, y * 0.7, z * 0.8, 3) +
    (0.04 + 0.08 * top) * fbm(x * 2.4, y * 1.9, z * 2.4, 2);
  const onSurface = smoothstep(0.2, 1.6, -reg);
  return d + (-0.1 * Math.abs(clumps) + 0.03 * fine) * onSurface + lift * onSurface;
}

/**
 * Loose curly tendrils (wisps at the temples and the nape), as polylines
 * in character space — the renderer sweeps thin tubes along them.
 */
export function jadeTendrils(): { points: Vec3[]; radius: number }[] {
  const out: { points: Vec3[]; radius: number }[] = [];
  /** A loose curl: an irregular helix that opens up and drifts as it falls. */
  const add = (root: Vec3, len: number, turns: number, r: number, seed: number, drift: Vec3) => {
    const pts: Vec3[] = [];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = seed * 2.1 + t * turns * Math.PI * 2 + 0.8 * Math.sin(seed + t * 5);
      const rad = (0.05 + 0.2 * t) * (0.8 + 0.4 * Math.sin(seed * 3 + t * 7));
      const sag = t * t;
      pts.push([
        root[0] + drift[0] * sag + Math.cos(a) * rad,
        root[1] - len * t,
        root[2] + drift[2] * sag + Math.sin(a) * rad,
      ]);
    }
    out.push({ points: pts, radius: r });
  };
  for (const s of [-1, 1]) {
    // Temples, in front of the ears.
    add([s * 2.28, 58.4, 1.05], 3.0, 1.8, 0.06, 1 + s, [s * 0.3, 0, 0.1]);
    add([s * 2.42, 57.9, 0.45], 2.4, 1.5, 0.05, 2.5 + s, [s * 0.35, 0, -0.1]);
    // Behind the ears and down the neck.
    add([s * 2.1, 56.4, -1.6], 3.2, 2.2, 0.06, 4 + s, [s * 0.4, 0, -0.2]);
    add([s * 1.15, 54.8, -2.95], 2.4, 1.7, 0.05, 6 + s, [s * 0.15, 0, -0.3]);
  }
  add([0.2, 54.5, -3.1], 2.1, 1.5, 0.05, 8, [0, 0, -0.2]);
  // Flyaways: fine strands lifting off the updo along the flow (they catch
  // the rim light and soften the silhouette like real hair).
  let seed = 0x2f6b;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 30; i++) {
    const az = rnd() * Math.PI * 2;
    const el = 0.15 + rnd() * 1.2;
    // Ray from inside the updo outwards; march to its surface.
    const dir: Vec3 = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    const c: Vec3 = [0.15, 59.6, -0.9];
    let t = 0;
    for (let k = 0; k < 60; k++) {
      const q: Vec3 = [c[0] + dir[0] * t, c[1] + dir[1] * t, c[2] + dir[2] * t];
      const d = hair(q[0], q[1], q[2]);
      if (d > -0.02) break;
      t += Math.max(0.05, -d);
    }
    const root: Vec3 = [
      c[0] + dir[0] * (t - 0.08),
      c[1] + dir[1] * (t - 0.08),
      c[2] + dir[2] * (t - 0.08),
    ];
    if (root[1] < 55.5) continue;
    // Flow: towards the twist, lifting a little off the surface.
    let fx = HAIR_TWIST[0] - root[0];
    let fy = HAIR_TWIST[1] - root[1] + 0.6;
    let fz = HAIR_TWIST[2] - root[2];
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl;
    fy /= fl;
    fz /= fl;
    const len = 0.4 + rnd() * 0.8;
    const lift = 0.15 + rnd() * 0.3;
    const pts: Vec3[] = [];
    for (let k = 0; k <= 4; k++) {
      const u = k / 4;
      const out = lift * u * u;
      pts.push([
        root[0] + fx * len * u + dir[0] * out + 0.08 * Math.sin(u * 5 + i),
        root[1] + fy * len * u + dir[1] * out,
        root[2] + fz * len * u + dir[2] * out + 0.08 * Math.cos(u * 4 + i),
      ]);
    }
    out.push({ points: pts, radius: 0.014 + rnd() * 0.01 });
  }
  return out;
}

// ── Body under the clothes ──────────────────────────────────────

/**
 * The torso without the shoulder caps: clothes split here into a body
 * (follows hips/torso) and sleeves (follow the arm bones), so lifting an
 * arm never drags cloth across the armpit.
 */
function torsoCore(x: number, y: number, z: number): number {
  let d = ellipsoid(x, y, z, [0, 45.0, -0.45], [4.4, 5.2, 2.88]);
  d = smin(d, ellipsoid(x, y, z, [0, 48.1, -0.6], [4.2, 2.0, 2.4]), 1.2);
  d = smin(d, ellipsoid(x, y, z, [0, 38.8, -0.2], [3.8, 3.6, 2.6]), 1.6);
  d = smin(d, ellipsoid(x, y, z, [0, 32.7, -0.25], [5.15, 4.0, 3.25]), 1.6);
  for (const s of [-1, 1]) {
    // Trapezius slope from the neck to the shoulder, then the deltoid cap.
    d = smin(d, roundCone(x, y, z, [s * 0.9, 50.0, -0.9], [s * 4.6, 48.0, -0.55], 1.25, 0.88), 1.0);
    d = smin(d, ellipsoid(x, y, z, [s * 1.9, 44.75, 1.55], [1.72, 1.58, 1.4]), 1.0);
    d = smin(d, ellipsoid(x, y, z, [s * 2.3, 31.3, -1.5], [2.5, 2.8, 2.2]), 1.0);
  }
  return d;
}

/** Deltoid caps (belong to the sleeves). */
function shoulderCaps(x: number, y: number, z: number): number {
  const s = x < 0 ? -1 : 1;
  return ellipsoid(x, y, z, [s * 5.05, 47.55, -0.45], [0.98, 1.3, 1.08]);
}

function torsoBody(x: number, y: number, z: number): number {
  return smin(torsoCore(x, y, z), shoulderCaps(x, y, z), 1.1);
}

function armBody(x: number, y: number, z: number): number {
  const s = x < 0 ? -1 : 1;
  const sh: Vec3 = [s * (B.shoulderX + 0.08), B.shoulderY - 1.25, -0.45];
  const el: Vec3 = [s * B.elbow[0], B.elbow[1], B.elbow[2]];
  const wr: Vec3 = [s * B.wrist[0], B.wrist[1], B.wrist[2]];
  let d = roundCone(x, y, z, sh, el, 1.17, 0.94);
  d = smin(d, roundCone(x, y, z, el, wr, 0.98, 0.72), 0.5);
  d = smin(d, ellipsoid(x, y, z, [s * (B.elbow[0] + 0.12), 37.2, -0.35], [1.06, 2.6, 1.02]), 0.9);
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
    [wx - 1.4, w[1] - 6.2, w[2] - 1.9],
    [wx + 1.4, w[1] + 1.4, w[2] + 2.3],
  );
  if (far > 0.6) return far;
  // Inward = towards the body (the palm faces the thigh).
  const inw = -s;
  let d = roundBox(x, y, z, [wx + s * 0.08, w[1] - 1.45, w[2] + 0.1], [0.4, 1.15, 0.88], 0.36);
  d = smin(
    d,
    roundCone(x, y, z, [wx, w[1] + 1.1, w[2]], [wx + s * 0.05, w[1] - 0.4, w[2] + 0.05], 0.8, 0.66),
    0.4,
  );
  const fingers: [number, number, number][] = [
    // z offset, length scale, radius
    [0.66, 0.95, 0.245],
    [0.22, 1.04, 0.25],
    [-0.21, 0.98, 0.24],
    [-0.6, 0.8, 0.215],
  ];
  const y0 = w[1] - 2.5;
  for (const [fz, ls, r] of fingers) {
    const p0: Vec3 = [wx + s * 0.05, y0, w[2] + fz];
    const p1: Vec3 = [p0[0] + inw * 0.18, p0[1] - 1.0 * ls, p0[2] - 0.02];
    const p2: Vec3 = [p1[0] + inw * 0.4, p1[1] - 0.66 * ls, p1[2] - 0.02];
    const p3: Vec3 = [p2[0] + inw * 0.42, p2[1] - 0.38 * ls, p2[2]];
    let f = roundCone(x, y, z, p0, p1, r, r * 0.94);
    f = smin(f, roundCone(x, y, z, p1, p2, r * 0.94, r * 0.86), 0.08);
    f = smin(f, roundCone(x, y, z, p2, p3, r * 0.86, r * 0.8), 0.06);
    d = smin(d, f, 0.18);
  }
  const t0: Vec3 = [wx + inw * 0.3, w[1] - 0.95, w[2] + 0.78];
  const t1: Vec3 = [wx + inw * 0.62, w[1] - 1.95, w[2] + 1.3];
  const t2: Vec3 = [wx + inw * 0.72, w[1] - 2.75, w[2] + 1.42];
  let th = roundCone(x, y, z, t0, t1, 0.34, 0.27);
  th = smin(th, roundCone(x, y, z, t1, t2, 0.27, 0.23), 0.06);
  d = smin(d, th, 0.35);
  return d;
}

// ── Clothes ─────────────────────────────────────────────────────

/** Half width of the placket down the shirt front. */
const PLACKET_HALF = 0.42;
/** The shirt is tucked in: its hem ends inside the trousers. */
const SHIRT_HEM = 35.2;
/** Top of the trousers' waistband. */
const WAIST_TOP = 36.9;

/** Shirt body: torso, placket, tucked hem, stand collar (no sleeves). */
function shirt(x: number, y: number, z: number, collarT = 0.12): number {
  const far = boxDist(x, y, z, [-6.6, 30.5, -4.6], [6.6, 52.8, 4.4]);
  if (far > 0.8) return far;
  const fold = 0.06 * fbm(x * 0.45, y * 0.3, z * 0.45, 2);
  let torso = torsoCore(x, y, z) - 0.26 - fold;
  // The shoulder line runs out to the seam where the sleeve is set in.
  torso = smin(torso, shoulderCaps(x, y, z) - 0.26, 0.6);
  // Soft blousing above the waistband.
  const blouse = smoothstep(3.5, 0.0, Math.abs(y - 38.0));
  torso -= 0.12 * blouse + 0.05 * blouse * Math.sin(y * 3.1 + x * 0.9);
  // Placket down the front.
  if (Math.abs(x) < PLACKET_HALF && z > 0 && y < 50.2) torso -= 0.04;
  torso = smax(torso, SHIRT_HEM - y, 0.12);
  // Neckline: the collar stands up out of it.
  const nr = Math.hypot(x / 1.05, z + 0.85);
  torso = smax(torso, -Math.max(nr - 1.9, 49.9 - y), 0.15);
  // Armholes: the body ends at the sleeve seam.
  torso = smax(torso, Math.abs(x) - (B.shoulderX - 0.15), 0.25);
  // Stand collar: a shell around the neck, open in a narrow V at the front.
  const r = Math.hypot(x / 1.05, z + 0.85);
  const R = 1.98 - (y - 50.0) * 0.06;
  let collar = Math.max(Math.abs(r - R) - collarT, y - 52.1, 49.6 - y);
  const gap = 0.28 + (y - 50.0) * 0.22;
  collar = Math.max(collar, -Math.max(Math.abs(x) - gap, -(z - 0.8)));
  return smin(torso, collar, 0.22);
}

/** Shirt sleeves: from the set-in seam over the shoulder cap to the cuffs. */
function shirtSleeves(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-8.8, 30.5, -2.4], [8.8, 50.4, 1.8]);
  if (far > 0.8) return far;
  if (Math.abs(x) < 3.6) return Math.max(far, 3.6 - Math.abs(x));
  const fold = 0.06 * fbm(x * 0.45, y * 0.3, z * 0.45, 2);
  let arms = smin(armBody(x, y, z), shoulderCaps(x, y, z), 0.9) - 0.24 - fold;
  // Elbow creases and the gathered sleeve above the cuff.
  const s = x < 0 ? -1 : 1;
  const de = Math.hypot(x - s * B.elbow[0], y - B.elbow[1], z - B.elbow[2]);
  arms -= 0.06 * smoothstep(2.6, 0.4, de) * Math.sin((y - B.elbow[1]) * 5.5 + x);
  arms -=
    0.05 * smoothstep(34.5, 33.0, y) * smoothstep(31.5, 33.0, y) * Math.sin(y * 7.0 + z * 3.0);
  // Cuff band and the sleeve end.
  const cuff = smoothstep(33.1, 32.7, y) * smoothstep(31.25, 31.55, y);
  arms -= 0.07 * cuff;
  arms = smax(arms, B.wrist[1] + 0.6 - y, 0.1);
  // The sleeve starts at the seam (a little inside it, so no gap shows).
  return smax(arms, B.shoulderX - 1.05 - Math.abs(x), 0.2);
}

function trousers(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-7.0, 3.8, -5.2], [7.0, 38.9, 4.4]);
  if (far > 0.8) return far;
  const fold = 0.06 * fbm(x * 0.5 + 3, y * 0.28, z * 0.5, 2);
  // Seat and waist follow the body, loose enough to hold the tucked shirt.
  let d = torsoBody(x, y, z) - 0.38;
  const s = x < 0 ? -1 : 1;
  const hip: Vec3 = [s * B.hipJointX, B.hipJointY - 0.6, 0.12];
  const knee: Vec3 = [s * B.knee[0], B.knee[1], B.knee[2]];
  const hem: Vec3 = [s * B.ankle[0], 4.2, B.ankle[2] + 0.1];
  let leg = roundCone(x, y, z, hip, knee, 3.05, 1.98);
  leg = smin(leg, roundCone(x, y, z, knee, hem, 1.96, 1.55), 0.8);
  // Knee and ankle folds, a crease behind the knee.
  const dk = Math.abs(y - knee[1]);
  leg -= 0.045 * smoothstep(2.4, 0.3, dk) * Math.sin(y * 4.2 + z * 1.4);
  leg -= 0.05 * smoothstep(3.6, 4.8, y) * smoothstep(7.5, 5.0, y) * Math.sin(y * 3.4 + x * 2);
  d = smin(d, leg, 1.2) - fold;
  // Waistband.
  d -= 0.07 * smoothstep(WAIST_TOP - 1.0, WAIST_TOP - 0.85, y);
  d = smax(d, y - WAIST_TOP, 0.12);
  d = smax(d, 4.25 - y, 0.08);
  return d;
}

function boots(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-4.8, -0.2, -2.8], [4.8, 6.0, 4.6]);
  if (far > 0.6) return far;
  const s = x < 0 ? -1 : 1;
  const bx = s * B.ankle[0];
  // Squashed foot: evaluate with y stretched (flatter instep).
  const yy = 0.95 + (y - 0.95) * 1.3;
  let d = roundCone(x, yy, z, [bx, 1.15, -1.25], [bx + s * 0.1, 0.9, 3.15], 0.98, 0.72) * 0.77;
  d = smin(d, roundBox(x, y, z, [bx, 0.45, -1.25], [0.72, 0.45, 0.72], 0.2), 0.3);
  d = smin(d, roundCone(x, y, z, [bx, 0.9, -0.5], [bx, 5.45, -0.35], 1.4, 1.33), 0.8);
  d = smax(d, y - 5.45, 0.1);
  // Flat sole with a slight welt.
  d = smax(d, -y, 0.06);
  const welt = smoothstep(0.45, 0.2, y) * 0.06;
  return d - welt;
}

// ── Lab coat, tool belt, watch ──────────────────────────────────

/** Coat hem height (just above the knee). */
export const COAT_HEM = 18.2;
/** The coat's sleeves end a little above the shirt cuffs. */
const COAT_CUFF = B.wrist[1] + 1.2;

/** Outer surface of the coat body as a solid (the layer is a shell around it). */
function coatSolid(x: number, y: number, z: number): number {
  // Upper coat: over the shirt with room to spare, out to the shoulder seam.
  let upper = smin(torsoCore(x, y, z), shoulderCaps(x, y, z), 0.6) - 0.42;
  // A lab coat hangs straight from the chest: fill the waist.
  const cx = x / 4.55;
  const cz = (z + 0.4) / 3.3;
  const column = smax(smax((Math.sqrt(cx * cx + cz * cz) - 1) * 3.3, y - 43.5, 1.2), 32.0 - y, 0.8);
  upper = smin(upper, column, 1.2);
  upper = smax(upper, 30.8 - y, 0.8);
  // Armholes at the shoulder seam (the sleeves are their own layer).
  upper = smax(upper, Math.abs(x) - (B.shoulderX + 0.1), 0.3);
  // Skirt: an elliptic tube from the hips, flaring a little towards the hem.
  const t = Math.max(0, 33.0 - y);
  const rx = 6.55 + 0.07 * t;
  const rz = 4.15 + 0.04 * t;
  const ex = x / rx;
  const ez = (z + 0.35) / rz;
  let skirt = (Math.sqrt(ex * ex + ez * ez) - 1) * Math.min(rx, rz);
  skirt = smax(skirt, y - 33.5, 0.6);
  let d = smin(upper, skirt, 1.4);
  // Drape: vertical folds falling from the chest, stronger towards the hem;
  // a little cloth noise everywhere.
  const ang = Math.atan2(x, z + 0.35);
  const fall = smoothstep(43.0, 24.0, y);
  const drape =
    fall *
    (0.06 + 0.05 * smoothstep(30.0, 20.0, y)) *
    Math.sin(ang * 9 + y * 0.12 + 1.6 * fbm(x * 0.3, 0.0, z * 0.3, 2));
  d -= drape + 0.04 * fbm(x * 0.5 + 11, y * 0.25, z * 0.5, 2);
  return smax(d, COAT_HEM - y, 0.1);
}

/** Coat sleeves as a solid: arm + shoulder cap, ending above the shirt cuff. */
function coatSleeveSolid(x: number, y: number, z: number): number {
  let d = smin(armBody(x, y, z), shoulderCaps(x, y, z), 0.9) - 0.5;
  const se = x < 0 ? -1 : 1;
  const de = Math.hypot(x - se * B.elbow[0], y - B.elbow[1], z - B.elbow[2]);
  d -= 0.07 * smoothstep(2.4, 0.3, de) * Math.sin((y - B.elbow[1]) * 4.5 + z * 2.0);
  d -= 0.03 * fbm(x * 0.5 + 5, y * 0.25, z * 0.5, 2);
  d = smax(d, COAT_CUFF - y, 0.08);
  return smax(d, B.shoulderX - 1.0 - Math.abs(x), 0.2);
}

function coatSleeves(x: number, y: number, z: number, shell: number): number {
  const far = boxDist(x, y, z, [-9.4, 30.0, -2.8], [9.4, 50.6, 2.2]);
  if (far > 0.8) return far;
  if (Math.abs(x) < 3.6) return Math.max(far, 3.6 - Math.abs(x));
  return Math.abs(coatSleeveSolid(x, y, z)) - shell;
}

/** Half width of the open front at height y (a V at the chest, then straight, flaring at the hem). */
function coatGap(y: number): number {
  if (y > 41.5) return 0.9 + (y - 41.5) * 0.19;
  if (y > 30) return 0.9 + (41.5 - y) * 0.015;
  return 1.07 + (30 - y) * 0.035;
}

function coatField(x: number, y: number, z: number, shell: number): number {
  const far = boxDist(x, y, z, [-9.4, 17.8, -5.4], [9.4, 52.4, 5.0]);
  if (far > 0.8) return far;
  const solid = coatSolid(x, y, z);
  let d = Math.abs(solid) - shell;
  // Open front: cut away a wedge in front of the chest (z > 0).
  const gap = coatGap(y);
  const open = Math.max(Math.abs(x) - gap, 0.2 - z);
  d = smax(d, -open, 0.06);
  // Lapels: the edge of the opening rolls outwards over the chest.
  const edge = Math.abs(Math.abs(x) - gap);
  if (y > 41.0 && y < 50.5 && z > 0)
    d -= 0.11 * smoothstep(0.9, 0.0, edge) * smoothstep(41.0, 43.0, y);
  // Collar: a band behind the neck that rolls down to the front, where it
  // runs into the lapels (lower and flatter the further forward).
  const r = Math.hypot(x / 1.05, z + 0.95);
  const ctop = 50.9 - 1.3 * smoothstep(-0.6, 2.2, z);
  const rr = 2.35 + 0.35 * smoothstep(-0.6, 2.2, z);
  let collar = Math.max(Math.abs(r - rr) - 0.1, y - ctop, ctop - 1.5 - y);
  collar = smax(collar, -Math.max(Math.abs(x) - gap - 0.2, -z), 0.3);
  d = smin(d, collar, 0.25);
  return d;
}

/** Height of the tool belt's centre line (slung, lower on her right hip). */
function beltY(x: number): number {
  return 34.0 + 0.12 * x;
}

function belt(x: number, y: number, z: number): number {
  const far = boxDist(x, y, z, [-7.2, 30.2, -4.6], [7.2, 35.6, 4.6]);
  if (far > 0.6) return far;
  const around = torsoBody(x, y, z) - 0.62;
  let d = Math.max(Math.abs(around) - 0.08, Math.abs(y - beltY(x)) - 0.42);
  // Buckle.
  const front = 3.08;
  d = Math.min(d, roundBox(x, y, z, [0.1, beltY(0.1), front], [0.42, 0.34, 0.1], 0.06));
  // Pouches: a tool pouch on her right hip, a slim one at the back left.
  d = smin(d, roundBox(x, y, z, [-5.55, 32.7, 0.55], [0.55, 1.05, 1.0], 0.22), 0.1);
  d = smin(d, roundBox(x, y, z, [4.2, 33.0, -2.9], [0.8, 0.8, 0.38], 0.18), 0.1);
  // A screwdriver handle sticking out of the pouch.
  d = Math.min(d, roundCone(x, y, z, [-5.6, 33.6, 0.9], [-5.65, 34.9, 1.05], 0.16, 0.12));
  return d;
}

function watch(x: number, y: number, z: number): number {
  const w = B.wrist;
  const far = boxDist(
    x,
    y,
    z,
    [w[0] - 1.3, w[1] - 0.6, w[2] - 1.3],
    [w[0] + 1.4, w[1] + 0.9, w[2] + 1.3],
  );
  if (far > 0.5) return far;
  const cy = w[1] + 0.15;
  const r = Math.hypot(x - w[0], (z - w[2]) * 1.08);
  let d = Math.max(Math.abs(r - 0.86) - 0.08, Math.abs(y - cy) - 0.2);
  // Dial on the back of the wrist (outer side, +x).
  d = smin(d, roundBox(x, y, z, [w[0] + 0.86, cy, w[2]], [0.1, 0.34, 0.34], 0.09), 0.05);
  return d;
}

/** Shirt button positions (front, down the placket). */
export function jadeButtons(): Vec3[] {
  const out: Vec3[] = [];
  for (const y of [48.2, 45.9, 43.6, 41.3, 39.0]) {
    // March inwards from the front until the shirt surface.
    let z = 5.0;
    for (let i = 0; i < 80 && shirt(0, y, z) > 0; i++) z -= Math.max(0.02, shirt(0, y, z));
    out.push([0, y, z + 0.02]);
  }
  return out;
}

function trim(x: number, y: number, z: number): number {
  let d = 99;
  for (const b of BUTTONS) d = Math.min(d, ellipsoid(x, y, z, b, [0.19, 0.19, 0.07]));
  return d;
}

const BUTTONS = jadeButtons();

/** Every sculpt layer of Jade's first-day look. */
export function jadeLayers(detail: "portrait" | "game" = "portrait"): SculptLayer[] {
  const skin: Sdf = (x, y, z) => headSkin(x, y, z);
  // The game meshes the coat coarser: a thicker shell keeps it watertight.
  const shell = detail === "game" ? 0.48 : 0.11;
  const coat: Sdf = (x, y, z) => coatField(x, y, z, shell);
  const collarT = detail === "game" ? 0.2 : 0.16;
  const shirtAt: Sdf = (x, y, z) => shirt(x, y, z, collarT);
  return [
    {
      id: "head",
      material: "skin",
      sdf: skin,
      min: [-3.3, 49.0, -4.3],
      max: [3.3, 61.0, 4.4],
      cell: 0.07,
      gameCell: 0.26,
    },
    {
      id: "handR",
      material: "skin",
      sdf: (x, y, z) => (x < 0 ? hand(x, y, z) : 9),
      min: [-8.9, 23.2, -2.3],
      max: [-5.6, 31.9, 2.6],
      cell: 0.06,
      gameCell: 0.21,
    },
    {
      id: "handL",
      material: "skin",
      sdf: (x, y, z) => (x > 0 ? hand(x, y, z) : 9),
      min: [5.6, 23.2, -2.3],
      max: [8.9, 31.9, 2.6],
      cell: 0.06,
      gameCell: 0.21,
    },
    {
      id: "hair",
      material: "hair",
      sdf: hair,
      min: [-4.0, 52.3, -5.1],
      max: [4.0, 64.9, 4.3],
      cell: 0.085,
      gameCell: 0.29,
    },
    {
      id: "shirt",
      material: "shirt",
      sdf: shirtAt,
      min: [-6.6, 30.5, -4.6],
      max: [6.6, 52.8, 4.4],
      cell: 0.14,
      gameCell: 0.5,
    },
    {
      id: "shirtSleeves",
      material: "shirt",
      sdf: shirtSleeves,
      min: [-8.8, 30.5, -2.4],
      max: [8.8, 50.4, 1.8],
      cell: 0.13,
      gameCell: 0.42,
    },
    {
      id: "trousers",
      material: "trousers",
      sdf: trousers,
      min: [-7.0, 3.8, -5.2],
      max: [7.0, 38.9, 4.4],
      cell: 0.16,
      gameCell: 0.62,
    },
    {
      id: "boots",
      material: "boots",
      sdf: boots,
      min: [-4.8, -0.2, -2.8],
      max: [4.8, 6.0, 4.6],
      cell: 0.1,
      gameCell: 0.34,
    },
    {
      id: "coat",
      material: "coat",
      sdf: coat,
      min: [-9.4, 17.8, -5.4],
      max: [9.4, 52.4, 5.0],
      cell: 0.11,
      gameCell: 0.6,
    },
    {
      id: "coatSleeves",
      material: "coat",
      sdf: (x, y, z) => coatSleeves(x, y, z, shell),
      min: [-9.4, 30.0, -2.8],
      max: [9.4, 50.6, 2.2],
      cell: 0.11,
      gameCell: 0.5,
    },
    {
      id: "belt",
      material: "belt",
      sdf: belt,
      min: [-7.2, 30.2, -4.6],
      max: [7.2, 35.6, 4.6],
      cell: 0.09,
      gameCell: 0.28,
    },
    {
      id: "watch",
      material: "watch",
      sdf: watch,
      min: [5.8, 30.2, -1.6],
      max: [8.5, 31.9, 1.4],
      cell: 0.035,
      gameCell: 0.14,
    },
    {
      id: "trim",
      material: "trim",
      sdf: trim,
      min: [-0.5, 38.0, 1.5],
      max: [0.5, 49.2, 4.5],
      cell: 0.035,
      gameCell: 0.08,
    },
  ];
}

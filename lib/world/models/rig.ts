/**
 * Character rigs and poses (pure — no three).
 * ============================================
 *
 * A `CharacterRigDef` is a hierarchy of voxel parts (hips → torso → head,
 * arms, legs, optional hair / coat tail). Each part is meshed un-centred
 * (voxel corner 0,0,0 at the mesh origin) and shifted by `-origin` inside a
 * joint group; the joint group sits at `pivot` in the PARENT's model voxel
 * frame (for the root: character space — x/z centred on the feet, y up from
 * the floor). Every unit is a model voxel; the whole character is scaled by
 * `scale` world units per voxel.
 *
 * Conventions: front = +z. The character's anatomical RIGHT side is -x
 * (R parts sit at -x). Rotations are Euler XYZ (three.js default) in
 * radians: rot.x > 0 swings a hanging limb backwards (and tips the head /
 * torso forward), rot.x < 0 lifts it forwards; rot.z > 0 moves a hanging
 * limb towards +x.
 *
 * Neighbouring parts overlap by a "plug" (two voxels) hidden inside the
 * parent, so joints never open a visible gap while they bend.
 *
 * Fine scale: the rigs are authored at half the old voxel edge
 * (CHARACTER_SCALE 0.09, twice the voxels per axis, same world size) with
 * real faces (irises, pupils, lash lines, nose, lips), hair strands, coat
 * folds and pockets, the ID badge, goggles, fingers and laced boots. They
 * are flagged `fine`, so the renderer meshes them as authored (refine
 * family "hires") instead of splitting every voxel again. Pose translations
 * stay in pose units (RIG_UNIT = 2 rig voxels, see `add`), so every pose,
 * transition and fidget is unchanged in world units.
 *
 * Face parts: `brows` sit a fraction of a voxel proud of the forehead and
 * slide / tilt for expressions; `lids` rest buried inside the skull and slide
 * forward (+z, `LID_TRAVEL`) in front of the eyes to blink. Both are children
 * of `head`, so the engine needs no special handling.
 *
 * Animation layers (all pure functions of time + small state):
 *  - `characterPose(kind, t, speed, opts)` — one pose kind at pose-clock t;
 *  - `gaitPose` / `advanceGait` — phase-coherent walk ↔ run locomotion with
 *    IK-planted feet (cadence from `gaitHz`, stride sized so nothing skates);
 *  - "sit" / "lie" — sit-down / lie-down choreographies with their own
 *    stand-up / get-up exits (`sampleTrack`), placed by the engine via
 *    SIT_SEAT_HEIGHT / SIT_SEAT_OFFSET / LIE_BACK_HEIGHT and `seatRootProgress`;
 *  - `PoseTrack` (`poseTrack`, `switchPose`, `sampleTrack`) — eased,
 *    interruptible cross-fades between kinds;
 *  - `animateCharacter` — track + locomotion + blinks in one call;
 *  - `handProp` / `propForPose` — mugs, books, crates, wrenches to attach.
 */
import { C } from "@/lib/world/content/palette";
import type { Vec3 } from "@/lib/world/models/anim";
import { DEFAULT_LOOK, type JadeLook } from "@/lib/world/content/wardrobe";
import { Model } from "@/lib/world/models/core";
import { buildJadeRig } from "@/lib/world/models/jade-rig";

export const RIG_PART_NAMES = [
  "hips",
  "torso",
  "head",
  "hairBack",
  "upperArmR",
  "forearmR",
  "upperArmL",
  "forearmL",
  "thighR",
  "shinR",
  "thighL",
  "shinL",
  "coatTail",
  "brows",
  "lids",
] as const;

export type RigPartName = (typeof RIG_PART_NAMES)[number];

export interface RigPart {
  name: RigPartName;
  model: Model;
  /** Parent part (listed earlier in `parts`); null for the root (hips). */
  parent: RigPartName | null;
  /** Joint position in the parent's model voxels (root: character space). */
  pivot: Vec3;
  /** Joint position in this part's own model voxels (mesh offset = -origin). */
  origin: Vec3;
  /** World units per model voxel (same for every part of a rig). */
  scale: number;
}

export interface CharacterRigDef {
  id: "jade" | "damien" | "damien_holo" | "damien_veil";
  /** Parents before children. */
  parts: RigPart[];
  /** World units per model voxel. */
  scale: number;
  hologram: boolean;
  /** Authored at the refined resolution: meshed as is (refine family "hires"). */
  fine?: boolean;
}

export interface PartPose {
  /** Euler XYZ rotation of the joint (rad). */
  rot: Vec3;
  /** Extra translation of the joint in parent-local model voxels. */
  pos?: Vec3;
}

export type CharacterPose = Record<RigPartName, PartPose>;

export type CharacterPoseKind =
  | "idle"
  | "walk"
  | "interact"
  | "talk"
  | "think"
  | "celebrate"
  | "sit"
  // Decor actions.
  | "drink"
  | "read"
  | "listen"
  // Locomotion / handling.
  | "run"
  | "carry"
  | "typing"
  | "crouch"
  // NPCs.
  | "work"
  | "wave"
  // Floor transitions and reactions.
  | "ride"
  | "climb"
  | "startle"
  // Resting on a bed / bench (placed by the engine, see LIE_BACK_HEIGHT).
  | "lie";

export const POSE_KINDS: readonly CharacterPoseKind[] = [
  "idle",
  "walk",
  "interact",
  "talk",
  "think",
  "celebrate",
  "sit",
  "drink",
  "read",
  "listen",
  "run",
  "carry",
  "typing",
  "crouch",
  "work",
  "wave",
  "ride",
  "climb",
  "startle",
  "lie",
];

/**
 * World units per voxel for humanoids (Jade ≈ 62 voxels ≈ 5.6 units). Fine
 * scale: half the old edge with twice the voxels per axis (see RIG_UNIT);
 * the rigs are flagged `fine` and meshed as authored.
 */
export const CHARACTER_SCALE = 0.09;
/**
 * Walk cadence at WALK_FULL_SPEED (full cycles per second, i.e. two steps).
 * `characterPose("walk", t, WALK_FULL_SPEED)` is periodic in 1 / WALK_HZ.
 *
 * Foot plant: Jade's legs are 24 rig voxels (2.16 units) long and the walker
 * moves at 13 units / s, i.e. 144 voxels / s. With the stance foot planted
 * for half a cycle (WALK_STANCE) and gliding back by one step (2·Z voxels),
 * the cadence has to be speed · stance / (2·Z): 3 Hz gives a 12-voxel
 * half step (±30° of leg swing) — a brisk, planted stride with a 2.6-voxel
 * (≈ 4 % of her height) vertical bob. `gaitHz` derives
 * the cadence for any speed and `gaitPose` sizes the step from it, so the
 * stance foot never skates (tests/world/rig-gait.test.ts measures it).
 */
export const WALK_HZ = 3;
/** Walker speed (world units / s) that maps to a full-stride walk (the walker's `speed`). */
export const WALK_FULL_SPEED = 13;
/** Length of the "interact" gesture in seconds (t = time since it started). */
export const INTERACT_DURATION = 0.6;

// ── Skeleton layout (character space, model voxels) ─────────────
//
// Fine scale: every length is RIG_UNIT (2) voxels per pose unit, so the
// pose code (translations in pose units, see `add`) is unchanged.
//
//   shin   rows 0..11   knee  y = 12
//   thigh  rows 12..23  hip   y = 24
//   hips   rows 24..27
//   torso  rows 28..43  shoulder y ≈ 43
//   head   rows 44..61 (neck rows 44..45) → 62 voxels ≈ 5.6 world units

/** Rig voxels per pose unit: pose translations (`add`) are authored in pose units. */
export const RIG_UNIT = 2;
/** Hip height in pose units (the legs are this long). */
const LEG_LEN = 12;
const HIP_Y = LEG_LEN * RIG_UNIT;

// ── Small drawing helpers ───────────────────────────────────────

function mirrorX(src: Model): Model {
  const out = new Model(src.w, src.h, src.d);
  src.grid.forEach((x, y, z, v) => out.set(src.w - 1 - x, y, z, v));
  return out;
}

function recolor(src: Model, fn: (v: number, x: number, y: number, z: number) => number): Model {
  const out = new Model(src.w, src.h, src.d);
  src.grid.forEach((x, y, z, v) => {
    const c = fn(v, x, y, z);
    if (c) out.set(x, y, z, c);
  });
  return out;
}

/** Clear the four vertical edge columns of a box (a rounded limb / body cross-section). */
function roundEdges(
  m: Model,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
): void {
  for (const x of [x0, x1]) for (const z of [z0, z1]) m.box(x, y0, z, x, y1, z, 0);
}

/** Paint a voxel only where the model is solid. */
function tint(m: Model, x: number, y: number, z: number, c: number): void {
  if (m.grid.get(x, y, z)) m.set(x, y, z, c);
}

interface Outfit {
  pants: number;
  fold: number;
  /** Inner-leg shadow on the front face. */
  gap: number;
  boot: number;
  bootDark: number;
  sole: number;
  /** Lace / stitching colour. */
  lace: number;
}

/**
 * Shin + boot (w6 h14 d10). Trousers x0..5 z2..7 rows 6..11 with a break
 * over the boot, a laced boot with a rounded toe cap, a welted sole with a
 * heel, the knee plug at rows 12..13. x = 5 is the inner side (right leg).
 */
function shinModel(o: Outfit): Model {
  const m = new Model(6, 14, 10);
  // Sole with a heel block and a welt.
  m.box(0, 0, 1, 5, 0, 9, o.sole);
  m.box(1, 0, 4, 4, 0, 5, 0);
  m.box(0, 1, 1, 5, 1, 9, o.bootDark);
  // Boot: foot, rounded toe cap, shaft.
  m.box(0, 2, 1, 5, 3, 8, o.boot);
  m.box(1, 2, 9, 4, 2, 9, o.boot);
  m.box(0, 4, 1, 5, 5, 7, o.boot);
  roundEdges(m, 0, 5, 1, 9, 2, 3);
  m.set(0, 2, 8, 0).set(5, 2, 8, 0);
  // Laces up the front, a heel counter and a pull tab.
  for (let y = 3; y <= 5; y++)
    m.set(2, y, 7 + (y === 3 ? 1 : 0), o.lace).set(3, y, 7 + (y === 3 ? 1 : 0), o.lace);
  m.set(1, 4, 7, o.bootDark)
    .set(4, 4, 7, o.bootDark)
    .set(1, 3, 8, o.bootDark)
    .set(4, 3, 8, o.bootDark);
  m.box(1, 2, 1, 4, 3, 1, o.bootDark);
  m.box(2, 5, 0, 3, 6, 0, o.bootDark);
  // Trousers with a break over the boot and creases.
  m.box(0, 6, 2, 5, 11, 7, o.pants);
  roundEdges(m, 0, 5, 2, 7, 6, 11);
  m.box(1, 6, 8, 4, 6, 8, o.pants);
  m.box(1, 5, 7, 4, 5, 7, o.pants);
  tint(m, 2, 9, 7, o.fold);
  tint(m, 3, 8, 7, o.fold);
  tint(m, 1, 7, 7, o.fold);
  tint(m, 0, 10, 4, o.fold);
  tint(m, 0, 8, 5, o.fold);
  for (let y = 6; y <= 11; y++) tint(m, 5, y, 6, o.gap);
  m.box(2, 12, 4, 3, 13, 5, o.pants);
  return m;
}

/** Thigh (w6 h14 d6): rows 0..11 visible, hip plug at rows 12..13. */
function thighModel(o: Outfit): Model {
  const m = new Model(6, 14, 6);
  m.box(0, 0, 0, 5, 11, 5, o.pants);
  roundEdges(m, 0, 5, 0, 5, 0, 11);
  // Creases: a knee fold, a diagonal pull from the hip, a back seam.
  for (const [x, y] of [
    [1, 2],
    [2, 3],
    [3, 7],
    [2, 8],
    [1, 9],
  ] as const)
    tint(m, x, y, 5, o.fold);
  for (let y = 0; y <= 11; y += 1) tint(m, 3, y, 0, y % 3 ? o.pants : o.fold);
  for (let y = 0; y <= 11; y++) tint(m, 5, y, 4, o.gap);
  // Side seam.
  for (let y = 0; y <= 11; y += 2) tint(m, 0, y, 2, o.fold);
  m.box(2, 12, 2, 3, 13, 3, o.pants);
  return m;
}

const SHIN_ORIGIN: Vec3 = [3, 12, 5];
const THIGH_ORIGIN: Vec3 = [3, 12, 3];
const KNEE_PIVOT: Vec3 = [3, 0, 3];
const UPPER_ARM_ORIGIN: Vec3 = [3, 9, 3];
const FOREARM_ORIGIN: Vec3 = [3, 10, 3];
const ELBOW_PIVOT: Vec3 = [3, 0, 3];

/**
 * Right hand (mirrored for the left) at rows 0..3: palm plane YZ at x 2..3,
 * four fingers along z with shaded gaps and knuckles, the thumb on the
 * inner (+x) side at the front.
 */
function hand(m: Model, skin: number, shade: number, nail: number = C.skin_light): void {
  m.box(1, 1, 1, 3, 3, 4, skin);
  for (let z = 1; z <= 4; z++) {
    m.set(2, 0, z, z === 1 ? shade : skin).set(1, 0, z, 0);
    m.set(1, 1, z, z % 2 ? shade : skin);
  }
  // Knuckles and finger gaps on the back of the hand (outer side, x = 1).
  for (const z of [1, 2, 3, 4]) m.set(1, 2, z, z % 2 ? skin : shade);
  m.set(2, 0, 4, nail).set(2, 0, 2, nail);
  // Thumb: from the palm's front edge, pointing down and in.
  m.box(4, 2, 4, 4, 3, 5, skin).set(4, 1, 5, shade).set(3, 3, 5, skin);
}

/** Lid depth at rest (buried in the skull) → blink travel so the lid stands 0.4 proud of the eyes. */
export const LID_TRAVEL = 2;
/** Brow travel (model voxels) for `raise = 1`. */
export const BROW_TRAVEL = 0.8;

/**
 * Eyelids (w10 h2 d1): one lid per eye (4 wide, a gap over the nose
 * bridge), skin above a dark lash line.
 */
function lidsModel(c: number, lash: number): Model {
  const m = new Model(10, 2, 1);
  m.box(0, 1, 0, 3, 1, 0, c).box(6, 1, 0, 9, 1, 0, c);
  m.box(0, 0, 0, 3, 0, 0, lash).box(6, 0, 0, 9, 0, 0, lash);
  return m;
}

/**
 * Brows + lids for a 14-wide head whose eyes sit on rows 8..9 and brows on
 * rows 11..12 of the face plane (voxels z 12..13, x 2..5 / 8..11). Brows
 * stand 0.3 proud of the forehead; lids rest inside the skull (z 11.4..12.4)
 * and slide out by LID_TRAVEL to blink.
 */
function faceParts(brows: Model, lidColor: number, lash: number, scale: number): RigPart[] {
  return [
    {
      name: "brows",
      model: brows,
      parent: "head",
      pivot: [7, 12, 13.3],
      origin: [5, 1, 1],
      scale,
    },
    {
      name: "lids",
      model: lidsModel(lidColor, lash),
      parent: "head",
      pivot: [7, 9, 11.9],
      origin: [5, 1, 0.5],
      scale,
    },
  ];
}

function limbs(
  upperR: Model,
  foreR: Model,
  o: Outfit,
  hipsW: number,
  torsoW: number,
  shoulderY: number,
  scale: number,
  foreL?: Model,
): RigPart[] {
  const cx = hipsW / 2;
  return [
    {
      name: "upperArmR",
      model: upperR,
      parent: "torso",
      pivot: [-3, shoulderY, 5],
      origin: UPPER_ARM_ORIGIN,
      scale,
    },
    {
      name: "forearmR",
      model: foreR,
      parent: "upperArmR",
      pivot: ELBOW_PIVOT,
      origin: FOREARM_ORIGIN,
      scale,
    },
    {
      name: "upperArmL",
      model: mirrorX(upperR),
      parent: "torso",
      pivot: [torsoW + 3, shoulderY, 5],
      origin: UPPER_ARM_ORIGIN,
      scale,
    },
    {
      name: "forearmL",
      model: foreL ?? mirrorX(foreR),
      parent: "upperArmL",
      pivot: ELBOW_PIVOT,
      origin: FOREARM_ORIGIN,
      scale,
    },
    {
      name: "thighR",
      model: thighModel(o),
      parent: "hips",
      pivot: [cx - 3, 0, 5],
      origin: THIGH_ORIGIN,
      scale,
    },
    {
      name: "shinR",
      model: shinModel(o),
      parent: "thighR",
      pivot: KNEE_PIVOT,
      origin: SHIN_ORIGIN,
      scale,
    },
    {
      name: "thighL",
      model: mirrorX(thighModel(o)),
      parent: "hips",
      pivot: [cx + 3, 0, 5],
      origin: THIGH_ORIGIN,
      scale,
    },
    {
      name: "shinL",
      model: mirrorX(shinModel(o)),
      parent: "thighL",
      pivot: KNEE_PIVOT,
      origin: SHIN_ORIGIN,
      scale,
    },
  ];
}

/**
 * Head volume (w14 h18 d16): rows 0..1 neck, then a rounded-rectangle
 * cross-section per row (narrow chin → full skull → crown). The face plane
 * is z 12..13 for x 3..10 (x 2 / 11 curve back to z 12). Returns the model
 * filled with `skin`; faces and hair are painted on top.
 */
function headVolume(skin: number, shade: number): Model {
  const m = new Model(14, 18, 16);
  m.box(5, 0, 5, 8, 1, 9, skin);
  m.box(5, 0, 9, 8, 0, 9, shade);
  const rows: Record<number, [hw: number, r: number, back: number]> = {
    2: [2.5, 1.5, 5],
    3: [3.5, 1.5, 4],
    4: [4.5, 1.5, 3],
  };
  for (let y = 2; y <= 16; y++) {
    const [hw, r, back] = rows[y] ?? (y >= 15 ? [y === 15 ? 4.6 : 3.8, 2.5, 3] : [5, 1.5, 2]);
    const cz = (back + 14) / 2;
    const hd = (14 - back) / 2;
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 14; x++) {
        const dx = Math.max(0, Math.abs(x + 0.5 - 7) - (hw - r));
        const dz = Math.max(0, Math.abs(z + 0.5 - cz) - (hd - r));
        if (dx * dx + dz * dz <= r * r + 0.01) m.set(x, y, z, skin);
      }
  }
  return m;
}

/** Round off the top of a head (hair included) with an ellipsoid cap above row 12. */
function capHead(m: Model): void {
  m.grid.forEach((x, y, z) => {
    if (y < 12) return;
    const e =
      ((x + 0.5 - 7) / 7.1) ** 2 + ((y + 0.5 - 8.5) / 9.6) ** 2 + ((z + 0.5 - 7.5) / 8.4) ** 2;
    if (e > 1) m.set(x, y, z, 0);
  });
}

/** Hair shell: every head voxel outside the face mask, plus a one-voxel layer of volume. */
function hairShell(
  m: Model,
  face: (x: number, y: number, z: number) => boolean,
  strand: (x: number, y: number, z: number) => number,
): void {
  const g = m.grid;
  const add: [number, number, number][] = [];
  g.forEach((x, y, z) => {
    if (y < 3) return;
    for (const [dx, dy, dz] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (!g.inBounds(nx, ny, nz) || g.get(nx, ny, nz)) continue;
      if (!face(nx, ny, nz)) add.push([nx, ny, nz]);
    }
  });
  for (const [x, y, z] of add) m.set(x, y, z, strand(x, y, z));
  g.forEach((x, y, z) => {
    if (y >= 3 && !face(x, y, z)) m.set(x, y, z, strand(x, y, z));
  });
}

// ── Jade Lawrence ───────────────────────────────────────────────

/**
 * Jade Lawrence wearing `look` (content/wardrobe.ts). Tall and slim (the
 * parts are fitted in jade-rig.ts; every joint the poses use is unchanged),
 * pale skin, silver lids with a black winged liner, the copper updo. The
 * first-day look — stand-collar shirt under the lab coat, no goggles — is
 * pinned by tests/world/jade-look.test.ts. The art lives in
 * models/jade-*.ts (composition: jade-rig.ts, public API: jade-look.ts).
 */
export function jadeRig(look: JadeLook = DEFAULT_LOOK): CharacterRigDef {
  return buildJadeRig(look);
}

/** Sleeve colours and details for the arms. */
interface ArmStyle {
  sleeve: number;
  shade: number;
  cuff: number;
  wrist: number;
  wristShade: number;
  skin: number;
  skinShade: number;
}

/** Upper arm (w6 h10 d6), rows 0..8 visible, shoulder plug on top. */
function upperArm(s: ArmStyle, patch: boolean): Model {
  const up = new Model(6, 10, 6);
  up.box(0, 0, 0, 5, 9, 5, s.sleeve);
  roundEdges(up, 0, 5, 0, 5, 0, 9);
  // Elbow crease, a fold down the back, the shoulder seam.
  for (const [x, y, z] of [
    [1, 1, 5],
    [2, 2, 5],
    [0, 4, 2],
    [0, 5, 3],
    [3, 3, 0],
    [2, 6, 0],
  ] as const)
    tint(up, x, y, z, s.shade);
  for (let z = 1; z <= 4; z++) tint(up, 0, 9, z, s.shade);
  if (patch) {
    // _unLABS sleeve patch: orange shield with a black mark.
    up.box(0, 5, 1, 0, 7, 3, C.safety_orange);
    up.set(0, 6, 2, C.paint_black).set(0, 7, 1, C.orange_paint).set(0, 7, 3, C.orange_paint);
  }
  return up;
}

/**
 * Forearm (w6 h12 d6): sleeve rows 6..9, cuff seam, the wrist (sweater
 * rib or skin) rows 4..5, the hand rows 0..3, elbow plug on top.
 */
function forearm(s: ArmStyle, watch: number | null): Model {
  const f = new Model(6, 12, 6);
  f.box(0, 6, 0, 5, 9, 5, s.sleeve);
  roundEdges(f, 0, 5, 0, 5, 6, 9);
  f.box(0, 6, 0, 5, 6, 5, s.cuff);
  roundEdges(f, 0, 5, 0, 5, 6, 6);
  for (const [x, y, z] of [
    [0, 8, 2],
    [2, 9, 5],
    [0, 7, 3],
    [4, 8, 0],
  ] as const)
    tint(f, x, y, z, s.shade);
  f.box(1, 4, 1, 4, 5, 4, s.wrist);
  f.set(1, 5, 4, s.wristShade).set(4, 4, 1, s.wristShade).set(1, 4, 2, s.wristShade);
  hand(f, s.skin, s.skinShade);
  f.box(2, 10, 2, 3, 11, 3, s.sleeve);
  if (watch !== null) {
    // Strap with a face on the back of the wrist (check-watch fidget).
    f.box(1, 4, 1, 4, 4, 4, C.leather_black);
    f.box(1, 4, 2, 1, 4, 3, watch).set(1, 5, 2, C.chrome).set(1, 5, 3, C.chrome);
  }
  return f;
}

// ── Damien Fridge ───────────────────────────────────────────────
//
// Reference: tall and heavy-set, older. Grey-blond hair slicked straight
// back with short undercut sides, tied into a small knot; a long, full,
// grey beard that ends in a point well below the chin; pale skin; white /
// silver eyeshadow with black winged liner; a white collared shirt, charcoal
// trousers, black shoes. No glasses.
//
// Build (rig voxels): the skeleton is the shared one (legs 24, hips pivot
// at row 24), but the torso is two rows taller (18) and wider (18) with a
// belly that stands proud of the belt, so he tops out at 64 voxels
// (5.76 world units — the tallest a rig may be under the 6-unit doors) and
// reads broad from every side. Large parts are hollowed (`hollow`) so they
// stay inside the per-part voxel budget.
//
// In the game he is never shown like this until he has been found (see
// lib/world/damien.ts): the echo, scenes and screens use the veiled
// transform from models/veil.ts.

const DAMIEN_OUTFIT: Outfit = {
  pants: C.fabric_gray_shade,
  fold: C.pants_dark,
  gap: C.paint_black,
  boot: C.leather_black,
  bootDark: C.paint_black,
  sole: C.rubber,
  lace: C.paint_black,
};

/** Torso width / height (rig voxels). */
const DAMIEN_TORSO_W = 18;
const DAMIEN_TORSO_H = 18;
/** Rows of beard that hang below the head volume (the head model grows downwards). */
const DAMIEN_BEARD = 9;
/** The head volume sits one voxel deep in its model (room for the hair knot at the back). */
const DAMIEN_HEAD_DZ = 1;

/** Remove voxels whose 26 neighbours are all solid (the shell still hides the inside). */
function hollow(m: Model): Model {
  const g = m.grid;
  const inner: [number, number, number][] = [];
  g.forEach((x, y, z) => {
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (!g.get(x + dx, y + dy, z + dz)) return;
    inner.push([x, y, z]);
  });
  for (const [x, y, z] of inner) m.set(x, y, z, 0);
  return m;
}

/** Frontmost solid z of column (x, y), or -1. */
function frontZ(m: Model, x: number, y: number): number {
  for (let z = m.d - 1; z >= 0; z--) if (m.grid.get(x, y, z)) return z;
  return -1;
}

/** Paint the front surface voxel of column (x, y). */
function paintFront(m: Model, x: number, y: number, c: number): void {
  const z = frontZ(m, x, y);
  if (z >= 0) m.set(x, y, z, c);
}

/** Fill one rounded-rectangle row of a body (x centred on `cx`, z from `zb` to `zf`). */
function bodyRow(
  m: Model,
  y: number,
  cx: number,
  hw: number,
  zb: number,
  zf: number,
  r: number,
  c: number,
): void {
  const cz = (zb + zf) / 2;
  const hd = (zf - zb) / 2;
  for (let z = 0; z < m.d; z++)
    for (let x = 0; x < m.w; x++) {
      const dx = Math.max(0, Math.abs(x + 0.5 - cx) - (hw - r));
      const dz = Math.max(0, Math.abs(z + 0.5 - cz) - (hd - r));
      if (dx * dx + dz * dz <= r * r + 0.01) m.set(x, y, z, c);
    }
}

/**
 * Hips (w18 h6 d12): charcoal trousers, a black belt with a steel buckle
 * half hidden under the belly, back pockets. Rows 4..5 plug into the torso.
 */
function damienHips(): Model {
  const m = new Model(DAMIEN_TORSO_W, 6, 12);
  const cx = DAMIEN_TORSO_W / 2;
  for (let y = 0; y <= 5; y++) {
    const zf = y === 0 ? 9.5 : y === 1 ? 10.5 : 11.2;
    bodyRow(m, y, cx, y === 0 ? 8.2 : 8.6, y === 0 ? 1 : 0.5, zf, 2.5, C.fabric_gray_shade);
  }
  // Belt with loops, the buckle under the overhang.
  for (let y = 2; y <= 3; y++)
    m.grid.forEach((x, yy, z) => {
      if (yy === y) m.set(x, yy, z, C.leather_black);
    });
  for (const x of [3, 14]) paintFront(m, x, 2, C.fabric_gray_shade);
  for (const x of [8, 9]) {
    paintFront(m, x, 2, C.chrome);
    paintFront(m, x, 3, C.chrome);
  }
  // Fly seam, back pockets, side seams.
  paintFront(m, 9, 0, C.pants_dark);
  paintFront(m, 9, 1, C.pants_dark);
  for (const x of [3, 4, 5, 12, 13, 14]) {
    tint(m, x, 1, 0, C.pants_dark);
    tint(m, x, 1, 1, C.pants_dark);
  }
  tint(m, 0, 0, 5, C.pants_dark);
  tint(m, 0, 1, 5, C.pants_dark);
  tint(m, DAMIEN_TORSO_W - 1, 0, 5, C.pants_dark);
  tint(m, DAMIEN_TORSO_W - 1, 1, 5, C.pants_dark);
  return hollow(m);
}

/**
 * Torso (w18 h18 d14): a white collared shirt over a broad chest and a
 * round belly. Open collar with points, a button placket, a chest pocket
 * with a pen, strain folds over the belly, the yoke seam and a box pleat
 * at the back.
 */
function damienTorso(): Model {
  const W = DAMIEN_TORSO_W;
  const m = new Model(W, DAMIEN_TORSO_H, 14);
  const cx = W / 2;
  // [half width, back z, front z, corner radius] per row.
  const row = (y: number): [number, number, number, number] => {
    if (y <= 1) return [8.6, 0.5, 11.2 + y * 0.6, 2.5];
    if (y <= 8) {
      // The belly: deepest at rows 4..6.
      const bulge = [0, 0, 12.2, 12.8, 13.2, 13.3, 13.2, 12.8, 12.2][y]!;
      return [9, 0, bulge, 3];
    }
    if (y <= 13) return [9, 0, y <= 10 ? 11.8 : 11.6, 2.5];
    if (y <= 15) return [9, 0.2, 11.2, 2];
    if (y === 16) return [8.6, 0.6, 10.6, 2.2];
    return [7.4, 1.2, 9.8, 2.6];
  };
  for (let y = 0; y < DAMIEN_TORSO_H; y++) {
    const [hw, zb, zf, r] = row(y);
    bodyRow(m, y, cx, hw, zb, zf, r, C.white);
  }
  // Soft side shading and the underside of the belly.
  m.grid.forEach((x, y, z) => {
    if ((x === 0 || x === W - 1) && (y + z) % 3 === 0) m.set(x, y, z, C.coat_shadow);
  });
  for (let x = 2; x < W - 2; x++) paintFront(m, x, 1, C.coat_shadow);
  for (let x = 3; x < W - 3; x += 2) paintFront(m, x, 2, C.tile_white);
  // Placket down the centre with buttons; strain folds pull from them.
  for (let y = 1; y <= 14; y++) paintFront(m, 9, y, C.tile_white);
  for (const y of [2, 5, 8, 11]) paintFront(m, 9, y, C.coat_shadow);
  for (const [x, y] of [
    [7, 4],
    [6, 5],
    [11, 4],
    [12, 5],
    [7, 7],
    [11, 7],
    [5, 3],
    [13, 6],
  ] as const)
    paintFront(m, x, y, C.tile_white);
  // Open collar: skin in the V, points lying on the chest, the stand at the neck.
  for (let y = 14; y <= 17; y++) {
    const half = y - 14;
    for (let x = 9 - half; x <= 8 + half; x++) paintFront(m, x, y, C.skin_light);
  }
  for (let y = 12; y <= 15; y++) {
    const off = 15 - y;
    for (const x of [6 + off, 11 - off]) {
      const z = frontZ(m, x, y);
      if (z >= 0) m.set(x, y, z + 1, C.white);
    }
  }
  paintFront(m, 6, 12, C.coat_shadow);
  paintFront(m, 11, 12, C.coat_shadow);
  m.box(5, 17, 2, 12, 17, 3, C.white).box(5, 17, 3, 5, 17, 7, C.white);
  m.box(12, 17, 3, 12, 17, 7, C.white);
  // Chest pocket on his left (+x) with a pen clipped in it.
  for (let x = 12; x <= 15; x++) paintFront(m, x, 9, C.coat_shadow);
  for (const x of [12, 15]) {
    paintFront(m, x, 10, C.coat_shadow);
    paintFront(m, x, 11, C.coat_shadow);
  }
  paintFront(m, 14, 11, C.paint_black);
  paintFront(m, 14, 12, C.chrome);
  // Back: yoke seam, box pleat, a crease where the shirt tucks in.
  for (let x = 1; x < W - 1; x++) tint(m, x, 14, 0, C.coat_shadow);
  for (let y = 3; y <= 13; y++) {
    tint(m, 8, y, 0, C.tile_white);
    tint(m, 10, y, 0, C.tile_white);
  }
  for (let x = 2; x < W - 2; x += 3) tint(m, x, 1, 0, C.coat_shadow);
  return hollow(m);
}

/** Shell mask: where the head volume stays skin (no hair volume is added). */
function damienFace(x: number, y: number, z: number): boolean {
  if (y <= 1) return true;
  // Slicked-back top: the hairline sits high above the forehead.
  if (y >= 16) return false;
  if (y >= 15) return z >= 13 && x >= 4 && x <= 9;
  if (y >= 12) return z >= 10;
  // Back of the head above the nape: the hair sweeps down into the knot.
  if (y >= 9 && z <= 6 && x >= 3 && x <= 10) return false;
  // Everything else is skin; the undercut sides are painted as stubble.
  return true;
}

/** Grey-blond strands combed straight back (lines along z, broken every few voxels). */
function damienHairColor(x: number, y: number, z: number): number {
  const n = hash01(x * 13 + (y >= 16 ? 5 : 0), Math.floor(z / 4) + (x % 2) * 7);
  if (n < 0.24) return C.beige;
  if (n > 0.86) return C.paint_gray;
  if (n > 0.62) return C.hair_gray;
  return C.tile_cream_dk;
}

/** Mixed grey / white beard strands running downwards. */
function damienBeardColor(x: number, y: number, z: number): number {
  const n = hash01(x * 7 + z * 3, Math.floor((y + 40) / 3));
  if (n < 0.1) return C.paint_white;
  if (n < 0.24) return C.coat_shadow;
  if (n < 0.44) return C.paint_gray_lt;
  if (n > 0.84) return C.paint_gray;
  return C.hair_gray;
}

/**
 * Head (w14 h27 d17): the shared head volume (rows 0..17 → model rows
 * 9..26, one voxel deep for the knot), slicked-back hair with a small knot,
 * undercut sides, pale skin, winged liner under white / silver shadow, a
 * long nose, and the beard — full over the jaw, then hanging nine rows
 * below the chin to a point, lying on the shirt.
 */
function damienHead(): Model {
  const base = headVolume(C.skin_light, C.skin);
  hairShell(base, damienFace, damienHairColor);
  capHead(base);
  // Undercut: short stubble on the sides and the nape (no volume).
  base.grid.forEach((x, y, z, v) => {
    if (y < 5 || y > 12 || v !== C.skin_light) return;
    const side = x <= 2 || x >= 11;
    const nape = z <= 4;
    if (!side && !nape) return;
    if (side && z >= 9) return; // temples and cheeks stay skin
    const n = hash01(x * 5 + z, y);
    base.set(x, y, z, n < 0.45 ? C.paint_gray_lt : n < 0.8 ? C.hair_gray : C.skin);
  });
  // Ears (skin, a shadow in the bowl), set into the undercut.
  base.box(1, 7, 6, 1, 10, 7, C.skin_light).set(1, 8, 6, C.skin).set(1, 9, 7, C.skin);
  base.box(12, 7, 6, 12, 10, 7, C.skin_light).set(12, 8, 6, C.skin).set(12, 9, 7, C.skin);
  // Beard over the jaw and cheeks (rows 2..6), fuller than the chin under it.
  base.grid.forEach((x, y, z) => {
    if (y < 2 || y > 6 || z < 6) return;
    const cheek = y >= 5 ? x <= 3 || x >= 10 : true;
    if (!cheek) return;
    if (y >= 3 && y <= 4 && x >= 5 && x <= 8 && z >= 12) return; // mouth area, painted below
    base.set(x, y, z, damienBeardColor(x, y, z));
  });
  for (let y = 2; y <= 5; y++)
    for (let x = 2; x <= 11; x++) {
      const z = frontZ(base, x, y);
      if (z >= 10 && z < 15 && !(y >= 3 && y <= 4 && x >= 5 && x <= 8))
        base.set(x, y, z + 1, damienBeardColor(x, y, z + 1));
    }
  // Moustache: full over the mouth, darker at the corners where it runs into the beard.
  base.box(4, 5, 13, 9, 5, 14, C.hair_gray);
  base.set(5, 5, 14, C.paint_white).set(8, 5, 14, C.coat_shadow);
  for (const x of [4, 9]) base.box(x, 3, 14, x, 5, 14, C.paint_gray_dk);
  base.set(3, 4, 14, C.paint_gray_dk).set(10, 4, 14, C.paint_gray_dk);
  // Mouth: a thin, level line half hidden by the moustache.
  base.box(4, 4, 14, 9, 4, 14, C.hair_gray).set(6, 4, 14, C.paint_gray_lt);
  base.box(5, 4, 13, 8, 4, 13, C.skin_shadow);
  base.set(6, 3, 13, C.lips).set(7, 3, 13, C.skin_shadow);
  base.set(5, 3, 13, damienBeardColor(5, 3, 13)).set(8, 3, 13, damienBeardColor(8, 3, 13));
  // Long, straight nose.
  base.box(6, 5, 14, 7, 8, 14, C.skin_light);
  base.set(6, 5, 14, C.skin_shadow).set(7, 5, 14, C.skin_shadow);
  base.box(6, 6, 15, 7, 6, 15, C.skin_light).set(7, 6, 15, C.skin);
  base.set(6, 8, 14, C.skin).set(7, 9, 14, C.skin_light);
  // Eyes: silver-white shadow (row 11), black liner along the lid with a
  // wing flicking up and out (rows 10..11), the eye (rows 8..9).
  const eyes: readonly string[] = ["KSSs..sSSK", "SKKK..KKKS", "WPPW..WPPW", "kWWs..sWWk"];
  const pal: Record<string, number> = {
    K: C.hair_black,
    S: C.paint_white,
    W: C.eye_white,
    P: C.paint_navy,
    k: C.paint_gray_dk,
    s: C.skin,
  };
  eyes.forEach((rowS, r) => {
    const y = 11 - r;
    for (let k = 0; k < rowS.length; k++) {
      const c = pal[rowS[k]!];
      if (!c) continue;
      const x = 2 + k;
      base.set(x, y, base.grid.get(x, y, 13) ? 13 : 12, c);
    }
  });
  // Pupils: a dark core on the inner voxel of each iris.
  base.set(4, 9, 13, C.hair_black).set(9, 9, 13, C.hair_black);
  // The wings wrap round onto the side of the face.
  for (const x of [2, 11]) base.set(x, 11, 11, C.hair_black).set(x, 12, 11, C.hair_black);
  // Forehead lines and the cheek shadow of a heavy face.
  base.box(4, 14, 13, 5, 14, 13, C.skin).box(8, 14, 13, 9, 14, 13, C.skin);
  base.set(3, 7, 13, C.skin).set(10, 7, 13, C.skin);
  // Hair knot at the back: a small bun behind a black tie.
  base.box(5, 10, 1, 8, 12, 1, C.leather_black);
  base.set(5, 10, 1, damienHairColor(5, 10, 1)).set(8, 12, 1, damienHairColor(8, 12, 1));

  // Into the tall model: the volume moves up by DAMIEN_BEARD rows.
  const B = DAMIEN_BEARD;
  const dz = DAMIEN_HEAD_DZ;
  const m = new Model(base.w, base.h + B, base.d + dz);
  base.grid.forEach((x, y, z, v) => m.set(x, y + B, z + dz, v));
  // The knot itself, behind the tie.
  m.box(5, B + 10, 0, 8, B + 12, 1, C.tile_cream_dk);
  m.set(5, B + 10, 0, 0)
    .set(8, B + 12, 0, 0)
    .set(5, B + 12, 0, 0)
    .set(8, B + 10, 0, 0);
  m.set(6, B + 11, 0, C.beige)
    .set(7, B + 10, 0, C.hair_gray)
    .set(6, B + 12, 1, C.hair_gray);
  // The hanging beard: rows 1 .. -(B-1) in head-volume rows, narrowing to a point.
  for (let hy = 1; hy >= 1 - (B - 1); hy--) {
    const k = 1 - hy; // 0 at the chin
    const hw = k < 6 ? 5.4 - k * 0.3 : Math.max(0.6, 3.6 - (k - 5) * 0.9);
    const zb = k <= 1 ? 11 : 12.4; // tucked under the chin, then lying on the shirt
    const zf = 15.4 - Math.max(0, k - 5) * 0.35;
    for (let x = 0; x < base.w; x++) {
      if (Math.abs(x + 0.5 - 7) > hw) continue;
      for (let z = Math.ceil(zb); z <= Math.floor(zf); z++)
        m.set(x, hy + B, z + dz, damienBeardColor(x, hy, z));
    }
  }
  return hollow(m);
}

/** Pale grey-blond brows, the right one lower, the left one lifted — sceptical (w10 h2 d2). */
function damienBrows(): Model {
  const m = new Model(10, 2, 2);
  // Right brow (x 0..3): level and low, heavier at the inner end.
  m.box(0, 0, 0, 3, 0, 0, C.hair_gray).set(3, 1, 0, C.paint_gray).set(0, 0, 1, C.tile_cream_dk);
  // Left brow (x 6..9): arched up at the outer end.
  m.box(6, 0, 0, 7, 0, 0, C.hair_gray).box(8, 1, 0, 9, 1, 0, C.hair_gray);
  m.set(9, 1, 1, C.tile_cream_dk).set(6, 0, 1, C.paint_gray);
  return m;
}

const DAMIEN_ARMS: ArmStyle = {
  sleeve: C.white,
  shade: C.coat_shadow,
  cuff: C.tile_white,
  wrist: C.skin_light,
  wristShade: C.skin,
  skin: C.skin_light,
  skinShade: C.skin,
};

/** Long white shirt sleeves with buttoned cuffs; the watch (it stopped at 03:40:09) on the left. */
function damienArms(): [Model, Model, Model] {
  const up = upperArm(DAMIEN_ARMS, false);
  const right = forearm(DAMIEN_ARMS, null);
  const left = forearm(DAMIEN_ARMS, C.gold);
  for (const f of [right, left]) tint(f, 1, 6, 3, C.coat_shadow);
  return [up, right, mirrorX(left)];
}

const HOLO_BRIGHT = new Set<number>([
  C.skin,
  C.skin_shadow,
  C.skin_light,
  C.hair_gray,
  C.white,
  C.paper,
  C.glass,
  C.brass,
  C.gold,
  C.eye_white,
  C.coat_shadow,
  C.paint_gray,
  C.paint_white,
  C.tile_white,
  C.beige,
  C.tile_cream_dk,
  C.paint_gray_lt,
  C.chrome,
]);

/** Glass-class hologram colour for a solid colour index. */
export function holoColor(v: number): number {
  return HOLO_BRIGHT.has(v) ? C.holo_white : C.holo_cyan;
}

/** Row (character space, rest pose) that the hologram leaves empty as a scanline gap. */
export function isScanlineGap(worldRow: number): boolean {
  return ((worldRow % 4) + 4) % 4 === 3;
}

/**
 * Damien Fridge, fully authored (see the reference notes above). `hologram`
 * recolours him into glass classes with scanline gaps — that is his echo
 * once he has been found. Until then the game only ever shows him veiled
 * (`veilRig` / `damienFigureRigs` in models/veil.ts).
 */
export function damienRig(hologram: boolean): CharacterRigDef {
  const s = CHARACTER_SCALE;
  const W = DAMIEN_TORSO_W;
  const [up, foreR, foreL] = damienArms();
  const face = faceParts(damienBrows(), C.paint_white, C.hair_black, s).map(
    (p): RigPart => ({
      ...p,
      // The head volume sits DAMIEN_BEARD rows up and one voxel deep in its model;
      // his brows ride one row higher (the shadow and the wing sit under them).
      pivot: [
        p.pivot[0],
        p.pivot[1] + DAMIEN_BEARD + (p.name === "brows" ? 1 : 0),
        p.pivot[2] + DAMIEN_HEAD_DZ,
      ],
    }),
  );
  const parts: RigPart[] = [
    {
      name: "hips",
      model: damienHips(),
      parent: null,
      pivot: [0, HIP_Y, 0],
      origin: [W / 2, 0, 5],
      scale: s,
    },
    {
      name: "torso",
      model: damienTorso(),
      parent: "hips",
      pivot: [W / 2, 4, 5],
      origin: [W / 2, 0, 5],
      scale: s,
    },
    {
      name: "head",
      model: damienHead(),
      parent: "torso",
      pivot: [W / 2, DAMIEN_TORSO_H, 5],
      origin: [7, DAMIEN_BEARD, 6 + DAMIEN_HEAD_DZ],
      scale: s,
    },
    ...face,
    ...limbs(up, foreR, DAMIEN_OUTFIT, W, W, DAMIEN_TORSO_H - 1, s, foreL),
  ];
  const def: CharacterRigDef = {
    id: "damien",
    parts,
    scale: s,
    hologram: false,
    fine: true,
  };
  if (!hologram) return def;
  // Recolour into glass classes and cut scanline gaps (aligned in character space at rest).
  const rest = restOrigins(def);
  const holoParts = parts.map((p) => {
    const baseY = rest.get(p.name)![1];
    // Face parts are too thin to survive a scanline cut: they stay whole.
    const facePart = p.name === "brows" || p.name === "lids";
    const model = recolor(p.model, (v, _x, y) =>
      !facePart && isScanlineGap(Math.floor(baseY + y + 0.5)) ? 0 : holoColor(v),
    );
    return { ...p, model };
  });
  return {
    id: "damien_holo",
    parts: holoParts,
    scale: s,
    hologram: true,
    fine: true,
  };
}
// ── Kinematics ──────────────────────────────────────────────────

/** Affine 3×4 matrix, row-major: [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]. */
export type Mat34 = number[];

const IDENTITY: Mat34 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

function mul(a: Mat34, b: Mat34): Mat34 {
  const o: Mat34 = new Array<number>(12).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += a[r * 4 + k]! * b[k * 4 + c]!;
      if (c === 3) v += a[r * 4 + 3]!;
      o[r * 4 + c] = v;
    }
  }
  return o;
}

function translation(v: Vec3): Mat34 {
  return [1, 0, 0, v[0], 0, 1, 0, v[1], 0, 0, 1, v[2]];
}

/** Euler XYZ (three.js default): R = Rx · Ry · Rz. */
function rotation(r: Vec3): Mat34 {
  const [cx, sx] = [Math.cos(r[0]), Math.sin(r[0])];
  const [cy, sy] = [Math.cos(r[1]), Math.sin(r[1])];
  const [cz, sz] = [Math.cos(r[2]), Math.sin(r[2])];
  const rx: Mat34 = [1, 0, 0, 0, 0, cx, -sx, 0, 0, sx, cx, 0];
  const ry: Mat34 = [cy, 0, sy, 0, 0, 1, 0, 0, -sy, 0, cy, 0];
  const rz: Mat34 = [cz, -sz, 0, 0, sz, cz, 0, 0, 0, 0, 1, 0];
  return mul(rx, mul(ry, rz));
}

export function applyMat(m: Mat34, p: Vec3): Vec3 {
  return [
    m[0]! * p[0] + m[1]! * p[1] + m[2]! * p[2] + m[3]!,
    m[4]! * p[0] + m[5]! * p[1] + m[6]! * p[2] + m[7]!,
    m[8]! * p[0] + m[9]! * p[1] + m[10]! * p[2] + m[11]!,
  ];
}

/**
 * Rest position of a part's joint group inside its parent's joint group
 * (model voxels): `pivot - parent.origin` (root: `pivot`, in character space).
 * This is what the engine assigns to `jointGroup.position` at rest.
 */
export function jointRestPosition(def: CharacterRigDef, part: RigPart): Vec3 {
  const parent = part.parent ? def.parts.find((p) => p.name === part.parent) : undefined;
  const o = parent?.origin ?? [0, 0, 0];
  return [part.pivot[0] - o[0], part.pivot[1] - o[1], part.pivot[2] - o[2]];
}

/**
 * Joint matrices in character space (model voxels): joint = parentJoint ·
 * T(jointRestPosition + pos) · R(rot). A part's voxel point p maps to
 * joint · (p - origin).
 */
export function jointMatrices(
  def: CharacterRigDef,
  pose?: Partial<CharacterPose>,
): Map<RigPartName, Mat34> {
  const out = new Map<RigPartName, Mat34>();
  for (const p of def.parts) {
    const pp = pose?.[p.name];
    const off = pp?.pos ?? [0, 0, 0];
    const rest = jointRestPosition(def, p);
    const local = mul(
      translation([rest[0] + off[0], rest[1] + off[1], rest[2] + off[2]]),
      rotation(pp?.rot ?? [0, 0, 0]),
    );
    const parent = p.parent ? out.get(p.parent) : IDENTITY;
    if (!parent) throw new Error(`rig ${def.id}: parent ${p.parent} of ${p.name} not built yet`);
    out.set(p.name, mul(parent, local));
  }
  return out;
}

/** Rest-pose position of each part's voxel corner (0,0,0) in character space. */
export function restOrigins(def: CharacterRigDef): Map<RigPartName, Vec3> {
  const joints = jointMatrices(def);
  const out = new Map<RigPartName, Vec3>();
  for (const p of def.parts) {
    const j = joints.get(p.name)!;
    out.set(p.name, applyMat(j, [-p.origin[0], -p.origin[1], -p.origin[2]]));
  }
  return out;
}

export interface PosedVoxel {
  part: RigPartName;
  /** Voxel centre in character space (model voxels). */
  p: Vec3;
  color: number;
}

/** Every voxel centre of the posed character (character space, model voxels). */
export function posedVoxels(def: CharacterRigDef, pose?: Partial<CharacterPose>): PosedVoxel[] {
  const joints = jointMatrices(def, pose);
  const out: PosedVoxel[] = [];
  for (const part of def.parts) {
    const j = joints.get(part.name)!;
    const [ox, oy, oz] = part.origin;
    part.model.grid.forEach((x, y, z, color) => {
      out.push({
        part: part.name,
        p: applyMat(j, [x + 0.5 - ox, y + 0.5 - oy, z + 0.5 - oz]),
        color,
      });
    });
  }
  return out;
}

/** Axis-aligned bounds of the rest pose in world units ([min, max] per axis, voxel faces). */
export function rigBounds(def: CharacterRigDef, pose?: Partial<CharacterPose>): [Vec3, Vec3] {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of posedVoxels(def, pose))
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, v.p[i]! - 0.5);
      max[i] = Math.max(max[i]!, v.p[i]! + 0.5);
    }
  return [min.map((n) => n * def.scale) as Vec3, max.map((n) => n * def.scale) as Vec3];
}

// ── Poses: timing constants ─────────────────────────────────────

const TAU = Math.PI * 2;

/** Run cadence (full cycles per second). `characterPose("run")` is periodic in 1 / RUN_HZ. */
export const RUN_HZ = 3.2;
/** Walker speed (world units / s) at which `gaitPose` is a full run (walk below WALK_FULL_SPEED). */
export const RUN_FULL_SPEED = 20;
/** Length of the "crouch" pick-up in seconds (t = time since it started). */
export const CROUCH_DURATION = 1.2;
/** Seconds standing still before the first idle fidget … */
export const IDLE_FIDGET_DELAY = 6;
/** … and the spacing of the following ones. */
export const IDLE_FIDGET_PERIOD = 7.5;
/** Length of one blink in seconds. */
export const BLINK_DURATION = 0.16;

/** Length of the "startle" flinch (a device powered on nearby). */
export const STARTLE_DURATION = 1.1;
/** Ladder climb cadence (full cycles per second: right hand + left hand). */
export const CLIMB_HZ = 1.1;

/** One-shot kinds settle back into "idle" after this many seconds (switch the track back then). */
export const ONE_SHOT_POSES: Readonly<Partial<Record<CharacterPoseKind, number>>> = {
  interact: INTERACT_DURATION,
  crouch: CROUCH_DURATION,
  startle: STARTLE_DURATION,
};

/** Kinds that keep their arms while the legs walk (`blendLocomotion`). */
const ARM_KINDS: ReadonlySet<CharacterPoseKind> = new Set<CharacterPoseKind>([
  "carry",
  "drink",
  "read",
  "listen",
  "talk",
  "think",
  "wave",
]);

export interface PoseOptions {
  /** Seconds the character has been standing still (drives idle fidgets); defaults to t. */
  idleFor?: number;
  /** Per-character seed: de-synchronises blinks, fidgets and idle loops between characters. */
  seed?: number;
  /** The seat "sit" sits on (legs reach for the floor / footrest, see `sitFit`). */
  seat?: SeatSpec;
}

// ── Small maths ─────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const u = clamp((x - e0) / (e1 - e0), 0, 1);
  return u * u * (3 - 2 * u);
}

/** 0 → 1 → 0 plateau between a and b with `ramp`-long smooth edges. */
function plateau(u: number, a: number, b: number, ramp: number): number {
  return smoothstep(a - ramp, a, u) * (1 - smoothstep(b, b + ramp, u));
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Deterministic hash → [0, 1). */
function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
}

/** Cubic ease-in-out on [0, 1] (C¹ at both ends). */
export function easeInOut(u: number): number {
  const x = clamp(u, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

// ── Pose building blocks ────────────────────────────────────────

/** Neutral pose: every joint at rest. */
export function restPose(): CharacterPose {
  const o = {} as CharacterPose;
  for (const n of RIG_PART_NAMES) o[n] = { rot: [0, 0, 0], pos: [0, 0, 0] };
  return o;
}

/**
 * Mutable helper: add rotation / translation (scaled by w) to a part. `pos`
 * is in pose units (RIG_UNIT voxels each); the pose stores rig voxels.
 */
function add(p: CharacterPose, n: RigPartName, rot: Vec3, pos?: Vec3, w = 1): void {
  const e = p[n];
  e.rot = [e.rot[0] + rot[0] * w, e.rot[1] + rot[1] * w, e.rot[2] + rot[2] * w];
  if (pos) {
    const q = e.pos ?? [0, 0, 0];
    const k = w * RIG_UNIT;
    e.pos = [q[0] + pos[0] * k, q[1] + pos[1] * k, q[2] + pos[2] * k];
  }
}

function lerp3(u: Vec3, v: Vec3, k: number): Vec3 {
  return [u[0] + (v[0] - u[0]) * k, u[1] + (v[1] - u[1]) * k, u[2] + (v[2] - u[2]) * k];
}

function blendPart(a: PartPose, b: PartPose, k: number): PartPose {
  return {
    rot: lerp3(a.rot, b.rot, k),
    pos: lerp3(a.pos ?? [0, 0, 0], b.pos ?? [0, 0, 0], k),
  };
}

/** Per-part linear blend: w = 0 → a, w = 1 → b. */
export function blendPose(a: CharacterPose, b: CharacterPose, w: number): CharacterPose {
  const k = clamp(w, 0, 1);
  const o = {} as CharacterPose;
  for (const n of RIG_PART_NAMES) o[n] = blendPart(a[n], b[n], k);
  return o;
}

/** Relaxed arms hanging slightly away from the coat. */
function relaxedArms(p: CharacterPose, breath: number): void {
  add(p, "upperArmR", [0.03 * breath, 0, -0.08]);
  add(p, "upperArmL", [0.03 * breath, 0, 0.08]);
  add(p, "forearmR", [-0.14, 0, 0.02]);
  add(p, "forearmL", [-0.14, 0, -0.02]);
}

function breathing(p: CharacterPose, t: number): number {
  const b = Math.sin(TAU * 0.22 * t);
  add(p, "torso", [0.015 * b - 0.01, 0, 0], [0, 0.12 * b, 0]);
  add(p, "head", [-0.02 * b, 0, 0]);
  add(p, "upperArmR", [0, 0, 0], [0, 0.1 * b, 0]);
  add(p, "upperArmL", [0, 0, 0], [0, 0.1 * b, 0]);
  add(p, "hairBack", [0.04 + 0.02 * b, 0, 0]);
  return b;
}

/** Weight shift (17 s loop): hips slide over the standing leg, the free knee relaxes. */
function weightShift(p: CharacterPose, t: number, amount = 1): void {
  shiftWeight(p, clamp(1.8 * Math.sin((TAU * t) / 17), -1, 1) * amount);
}

/** Hips over the right (w > 0) or left (w < 0) leg, feet planted. */
function shiftWeight(p: CharacterPose, w: number): void {
  const dx = 0.45 * w;
  const tilt = -0.035 * w;
  add(p, "hips", [0, 0, tilt], [dx, -0.1 * Math.abs(w), 0]);
  const legFix = -Math.atan2(dx, LEG_LEN) - tilt;
  add(p, "thighR", [-0.06 * Math.max(0, w), 0, legFix]);
  add(p, "thighL", [-0.06 * Math.max(0, -w), 0, legFix]);
  add(p, "shinR", [0.14 * Math.max(0, w), 0, 0]);
  add(p, "shinL", [0.14 * Math.max(0, -w), 0, 0]);
  add(p, "torso", [0, 0, 0.05 * w]);
  add(p, "head", [0, 0, -0.03 * w]);
  add(p, "coatTail", [0, 0, -tilt * 0.5]);
}

/** Standing base shared by the "stand and do something" poses. */
function stand(t: number, seed: number): CharacterPose {
  const p = restPose();
  const ts = t + seed * 7.31;
  const b = breathing(p, ts);
  relaxedArms(p, b);
  weightShift(p, ts, 0.6);
  return p;
}

// ── Face: blinks and brows ──────────────────────────────────────

function blinkPulse(u: number): number {
  if (u <= 0 || u >= BLINK_DURATION) return 0;
  return Math.min(1, 1.6 * Math.sin((Math.PI * u) / BLINK_DURATION));
}

/**
 * Eyelid closure 0..1 at time t: one blink every ~2–4 s at hashed offsets,
 * now and then a double blink. Continuous (0 at every slot boundary).
 */
export function blinkAmount(t: number, seed = 0): number {
  const SLOT = 3.7;
  const k = Math.floor(t / SLOT);
  const local = t - k * SLOT;
  const o = 0.2 + 2.9 * hash01(k, seed + 0.5);
  let a = blinkPulse(local - o);
  if (hash01(k + 91, seed + 0.5) < 0.22) a = Math.max(a, blinkPulse(local - o - 0.32));
  return a;
}

interface Expression {
  /** Brow lift: -1 furrowed … 0 neutral … 1 surprised / delighted. */
  raise?: number;
  /** Brow tilt (rad): one brow up, the other down (sceptical). */
  tilt?: number;
}

function face(p: CharacterPose, t: number, seed: number, e: Expression = {}): void {
  add(p, "lids", [0, 0, 0], [0, 0, (LID_TRAVEL / RIG_UNIT) * blinkAmount(t, seed)]);
  add(p, "brows", [0, 0, e.tilt ?? 0], [0, (BROW_TRAVEL / RIG_UNIT) * (e.raise ?? 0), 0]);
}

// ── Idle + fidgets ──────────────────────────────────────────────

export const IDLE_FIDGETS = ["look", "stretch", "watch", "shoulders", "goggles", "hair"] as const;
export type IdleFidget = (typeof IDLE_FIDGETS)[number];

const FIDGET_LEN: Record<IdleFidget, number> = {
  look: 3.4,
  stretch: 3.4,
  watch: 2.8,
  shoulders: 2.4,
  goggles: 2.6,
  hair: 2.6,
};

export interface FidgetState {
  kind: IdleFidget;
  /** Envelope 0..1 (smooth in and out). */
  weight: number;
  /** Seconds into the fidget. */
  u: number;
}

/** Which fidget (if any) plays after standing still for `idleFor` seconds. */
export function idleFidget(idleFor: number, seed = 0): FidgetState | null {
  if (!(idleFor >= IDLE_FIDGET_DELAY)) return null;
  const s = idleFor - IDLE_FIDGET_DELAY;
  const k = Math.floor(s / IDLE_FIDGET_PERIOD);
  const u = s - k * IDLE_FIDGET_PERIOD;
  const kind = IDLE_FIDGETS[Math.floor(hash01(k, seed + 3) * IDLE_FIDGETS.length)]!;
  const len = FIDGET_LEN[kind];
  const weight = plateau(u, 0.55, len - 0.55, 0.5);
  return weight > 0 ? { kind, weight, u } : null;
}

function applyFidget(p: CharacterPose, f: FidgetState): void {
  const { u, weight: w } = f;
  const len = FIDGET_LEN[f.kind];
  switch (f.kind) {
    case "look": {
      // Glance over one shoulder, then the other.
      const yaw = 0.75 * plateau(u, 0.8, 1.3, 0.35) - 0.7 * plateau(u, 1.95, 2.45, 0.35);
      add(p, "head", [-0.06, yaw, 0.06 * yaw], undefined, w);
      add(p, "torso", [0, 0.22 * yaw, 0], undefined, w);
      break;
    }
    case "stretch": {
      // Both arms overhead, back arched, a little side bend at the top.
      const bend = 0.12 * Math.sin((TAU * u) / len);
      add(p, "upperArmR", [-2.7, 0, -0.2], [0, 0.5, 0], w);
      add(p, "upperArmL", [-2.7, 0, 0.2], [0, 0.5, 0], w);
      add(p, "forearmR", [-0.2, 0, 0.25], undefined, w);
      add(p, "forearmL", [-0.2, 0, -0.25], undefined, w);
      add(p, "torso", [-0.13, 0, bend], undefined, w);
      add(p, "head", [-0.28, 0, -bend], undefined, w);
      add(p, "coatTail", [-0.08, 0, 0], undefined, w);
      break;
    }
    case "watch": {
      // Lift the left wrist, turn it, glance at the watch.
      add(p, "upperArmL", [-0.55, -0.2, -0.32], undefined, w);
      add(p, "forearmL", [-1.45, 0.75, 0], undefined, w);
      add(p, "head", [0.36, 0.3, 0.05], undefined, w);
      add(p, "torso", [0.03, 0.08, 0], undefined, w);
      break;
    }
    case "shoulders": {
      // Two shoulder rolls and a neck tilt.
      const shrug = 0.5 - 0.5 * Math.cos((TAU * 2 * u) / len);
      add(p, "upperArmR", [0.05 * shrug, 0, 0], [0, 0.9 * shrug, -0.2 * shrug], w);
      add(p, "upperArmL", [0.05 * shrug, 0, 0], [0, 0.9 * shrug, -0.2 * shrug], w);
      add(p, "head", [0.04, 0, 0.18 * Math.sin((TAU * u) / len)], undefined, w);
      break;
    }
    case "goggles": {
      // Right hand to the forehead, nudge the goggles up the hair, a small frown.
      const push = plateau(u, 1.0, 1.45, 0.25);
      add(p, "upperArmR", [-2.5 - 0.12 * push, 0, 0.3], undefined, w);
      add(p, "forearmR", [-0.6 + 0.15 * push, 0.4, 0], undefined, w);
      add(p, "head", [-0.1 - 0.08 * push, -0.08, 0], undefined, w);
      add(p, "torso", [-0.02, -0.05, 0], undefined, w);
      break;
    }
    case "hair": {
      // Tuck a loose strand behind the right ear, head tilting into the hand.
      const tuck = plateau(u, 0.95, 1.5, 0.3);
      add(p, "upperArmR", [-2.1, 0.4, -0.06 * tuck], undefined, w);
      add(p, "forearmR", [-1.8 - 0.1 * tuck, -0.2, 0], undefined, w);
      add(p, "head", [0.04, -0.12, -0.16 - 0.06 * tuck], undefined, w);
      add(p, "hairBack", [0, 0, 0.12 * tuck], undefined, w);
      break;
    }
  }
}

function idlePose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const ts = t + seed * 7.31;
  const p = restPose();
  const b = breathing(p, ts);
  relaxedArms(p, b);
  // Occasional slow look-around (11 s loop): left, right, a glance up.
  const u = mod(ts, 11);
  const look = 0.4 * plateau(u, 3, 4.4, 0.5) - 0.32 * plateau(u, 7, 8, 0.45);
  add(p, "head", [-0.08 * plateau(u, 9.3, 9.9, 0.3), look, 0.04 * look]);
  add(p, "torso", [0, 0.12 * look, 0]);
  weightShift(p, ts);
  // Hair and coat drift a little on their own.
  add(p, "hairBack", [0, 0, 0.035 * Math.sin(TAU * 0.31 * ts)]);
  add(p, "coatTail", [0.02 * Math.sin(TAU * 0.23 * ts + 1), 0, 0]);
  const f = idleFidget(o.idleFor ?? t, seed);
  if (f) applyFidget(p, f);
  face(p, t, seed, {
    raise: f?.kind === "stretch" ? 0.6 * f.weight : f?.kind === "goggles" ? -0.3 * f.weight : 0,
  });
  return p;
}

// ── Leg and arm kinematics ──────────────────────────────────────
//
// Planar (sagittal y/z) two-bone IK in character space, rig voxels. A
// segment's "pitch" is the rot.x that swings a hanging (−y) segment onto a
// direction: pitch > 0 points it backwards (−z), < 0 forwards.

/** Thigh and shin length (rig voxels): hip → knee, knee → sole. */
const SEG = HIP_Y / 2;
/** Sole extent in front of / behind the shin axis (rig voxels): toe cap and heel. */
const SOLE_TOE = 5;
const SOLE_HEEL = 4;
/** Upper arm (shoulder → elbow) and forearm (elbow → palm) length, rig voxels. */
const UPPER_ARM = 9;
const FOREARM = 8.5;
/** Shoulder joint above the torso joint, torso joint above the hips joint (rig voxels, sagittal). */
const SHOULDER_UP = 15;
const TORSO_UP = 4;

function pitchOf(dz: number, dy: number): number {
  return Math.atan2(-dz, -dy);
}

/** (y, z) of a segment of length l at pitch a, starting at (y, z). */
function along(y: number, z: number, l: number, a: number): [number, number] {
  return [y - l * Math.cos(a), z - l * Math.sin(a)];
}

/**
 * Lowest sole point relative to the sole centre under the shin axis, for a
 * shin pitch (≤ 0). `toe` scales how much of a forward-tipped toe counts:
 * 1 = roll up onto the toes (crouching), < 1 lets the toe cap sink a little
 * into the floor instead — there is no ankle, and a fully compensated toe
 * would force a deeper knee bend, which tips the toe further (a feedback
 * loop that makes every stance look crouched).
 */
function soleDrop(shin: number, toe = 1): number {
  const s = Math.sin(shin);
  return Math.min(-SOLE_TOE * s * toe, SOLE_HEEL * s);
}

/** Share of the toe dip compensated while walking / standing (see `soleDrop`). */
const TOE_GIVE = 0.4;

/**
 * Soft IK reach: distances approach the full limb length `l` asymptotically
 * (the last 3 %), so a limb near full stretch never snaps its joint straight
 * (acos has an infinite slope at 1). The target then falls a hair short.
 */
function softReach(d: number, l: number): number {
  const s = 0.97 * l;
  if (d <= s) return d;
  return s + (l - s) * (1 - Math.exp(-(d - s) / (l - s)));
}

/**
 * Two-bone leg IK: hip joint (hy, hz) → foot. `fy` is where the LOWEST sole
 * point should be (the foot rolls heel → toe: there is no ankle), `fz` the
 * sole centre. Returns the world pitches [thigh, shin]; the knee always
 * bends forward; out of reach the leg straightens towards the target.
 */
function legIK(hy: number, hz: number, fy: number, fz: number, toe = TOE_GIVE): [number, number] {
  let ty = fy;
  let out: [number, number] = [0, 0];
  for (let i = 0; i < 4; i++) {
    const dz = fz - hz;
    const dy = ty - hy;
    const d = Math.min(Math.hypot(dz, dy), 2 * SEG);
    const base = pitchOf(dz, dy);
    const bend = Math.acos(clamp(d / (2 * SEG), -1, 1));
    out = [base - bend, base + bend];
    ty = fy - soleDrop(out[1], toe);
  }
  return out;
}

/**
 * Two-bone arm IK: shoulder (sy, sz) → palm (ty, tz). World pitches
 * [upper, fore]; the elbow bends backwards / outwards. Out of reach the arm
 * straightens towards the target.
 */
function armIK(sy: number, sz: number, ty: number, tz: number): [number, number] {
  const dz = tz - sz;
  const dy = ty - sy;
  const d = softReach(Math.hypot(dz, dy), UPPER_ARM + FOREARM);
  const base = pitchOf(dz, dy);
  const cosA = (UPPER_ARM * UPPER_ARM + d * d - FOREARM * FOREARM) / (2 * UPPER_ARM * d || 1);
  const a = Math.acos(clamp(cosA, -1, 1));
  const cosB = (UPPER_ARM * UPPER_ARM + FOREARM * FOREARM - d * d) / (2 * UPPER_ARM * FOREARM);
  const elbow = Math.PI - Math.acos(clamp(cosB, -1, 1));
  return [base + a, base + a - elbow];
}

function setPitch(p: CharacterPose, n: RigPartName, pitch: number): void {
  const e = p[n];
  e.rot = [pitch, e.rot[1], e.rot[2]];
}

/** Write world leg pitches (from `legIK`) under a hips pitch. */
function setLeg(p: CharacterPose, side: "R" | "L", hipsPitch: number, leg: [number, number]): void {
  setPitch(p, side === "R" ? "thighR" : "thighL", leg[0] - hipsPitch);
  setPitch(p, side === "R" ? "shinR" : "shinL", leg[1] - leg[0]);
}

/** Write world arm pitches (from `armIK`) under the torso's world pitch; `inward` rolls the arm towards the body. */
function setArm(
  p: CharacterPose,
  side: "R" | "L",
  torsoPitch: number,
  arm: [number, number],
  inward = 0,
  w = 1,
): void {
  const up = side === "R" ? "upperArmR" : "upperArmL";
  const fo = side === "R" ? "forearmR" : "forearmL";
  const k = side === "R" ? 1 : -1;
  const lerpTo = (e: PartPose, v: Vec3): Vec3 => lerp3(e.rot, v, w);
  p[up].rot = lerpTo(p[up], [arm[0] - torsoPitch, p[up].rot[1] * (1 - w), k * inward]);
  p[fo].rot = lerpTo(p[fo], [arm[1] - arm[0], p[fo].rot[1] * (1 - w), p[fo].rot[2] * (1 - w)]);
}

interface Placement {
  /** Hips joint in character space (rig voxels). */
  y: number;
  z: number;
  x?: number;
  /** Pelvis pitch (rad; < 0 tips it back). */
  pitch: number;
  /** Lift of the hip joints inside the pelvis (rig voxels, hips frame): a seated buttock tuck. */
  thighLift?: number;
}

/** Hip-joint (legs) position (y, z) for a placement. */
function legRoot(b: Placement): [number, number] {
  const l = b.thighLift ?? 0;
  return [b.y + l * Math.cos(b.pitch), b.z + l * Math.sin(b.pitch)];
}

/** Put the hips joint at an absolute place (keeps any yaw / roll already on the hips). */
function placeHips(p: CharacterPose, b: Placement): void {
  p.hips.rot = [b.pitch, p.hips.rot[1], p.hips.rot[2]];
  p.hips.pos = [b.x ?? 0, b.y - HIP_Y, b.z];
  const l = b.thighLift ?? 0;
  if (l) {
    p.thighR.pos = [0, l, 0];
    p.thighL.pos = [0, l, 0];
  }
}

/** Place the hips and plant both feet (lowest sole point at y, sole centre at z). */
function plantFeet(
  p: CharacterPose,
  b: Placement,
  footR: [number, number],
  footL: [number, number] = footR,
  toe = TOE_GIVE,
): void {
  placeHips(p, b);
  const [hy, hz] = legRoot(b);
  setLeg(p, "R", b.pitch, legIK(hy, hz, footR[0], footR[1], toe));
  setLeg(p, "L", b.pitch, legIK(hy, hz, footL[0], footL[1], toe));
}

/** Shoulder (y, z) for a hips placement and a torso pitch relative to the hips. */
function shoulderAt(b: Placement, torsoPitch: number): [number, number] {
  const [ty, tz] = along(b.y, b.z, -TORSO_UP, b.pitch);
  return along(ty, tz, -SHOULDER_UP, b.pitch + torsoPitch);
}

// ── Locomotion ──────────────────────────────────────────────────

/** Share of a gait cycle each foot is planted: walking … running (the rest is swing / flight). */
const WALK_STANCE = 0.5;
const RUN_STANCE = 0.32;
/** Longest half step (rig voxels) before the cadence rises instead of the stride. */
const MAX_HALF_STEP = 14;
/** Hip → lowest sole distance at heel strike (a hair short of a straight leg). */
const LEG_REACH = 2 * SEG - 0.1;
/** The right heel strikes at this gait phase (cycles); the left half a cycle later. */
const R_CONTACT = 0.25;

interface Gait {
  /** Cadence (cycles / s). */
  hz: number;
  /** Planted share of the cycle. */
  stance: number;
  /** Half step (rig voxels): the planted foot glides from +half to −half. */
  half: number;
  /** Walk amplitude 0..1 (speed / WALK_FULL_SPEED). */
  a: number;
  /** Run weight 0..1. */
  r: number;
}

/** 0 at walking speed … 1 at RUN_FULL_SPEED. */
export function runWeight(speed: number): number {
  return smoothstep(WALK_FULL_SPEED, RUN_FULL_SPEED, speed);
}

function gaitOf(speed: number): Gait {
  const v = Math.max(0, speed);
  const r = runWeight(v);
  const a = clamp(v / WALK_FULL_SPEED, 0, 1);
  const walkHz = WALK_HZ * (0.55 + 0.45 * a);
  const runHz = RUN_HZ * Math.sqrt(clamp(v / RUN_FULL_SPEED, 0.5, 2));
  const stance = WALK_STANCE + (RUN_STANCE - WALK_STANCE) * r;
  const vox = v / CHARACTER_SCALE;
  const hz = Math.max(walkHz + (runHz - walkHz) * r, (vox * stance) / (2 * MAX_HALF_STEP));
  return { hz, stance, half: (vox * stance) / (2 * hz), a, r };
}

/**
 * Gait cadence (cycles / s) at `speed` (world units / s). Stride length
 * follows from it: half step = speed · stance / (2 · cadence), so the
 * planted foot moves back exactly as fast as the walker moves forward.
 */
export function gaitHz(speed: number): number {
  return gaitOf(speed).hz;
}

/** Planted foot speed (world units / s) relative to the hips for `speed`: equals `speed` (no skating). */
export function stanceFootSpeed(speed: number): number {
  const g = gaitOf(speed);
  return (2 * g.half * g.hz * CHARACTER_SCALE) / g.stance;
}

/**
 * Advance a gait phase (cycles, wrapped to [0, 1)) by dt at `speed`. Keeping a
 * phase instead of a clock lets the cadence change without the legs jumping.
 */
export function advanceGait(phase: number, dt: number, speed: number): number {
  return mod(phase + dt * gaitHz(speed), 1);
}

/** Hips height (rig voxels) through the cycle: low at heel strike, high mid-stance (walk); sinks mid-stance and floats in flight (run). */
function gaitHipY(g: Gait, phase: number): number {
  // Nearly straight over the stance foot (there is no ankle: a bent knee would
  // tip the toes into the floor); fully straight when standing still.
  const reach = 2 * SEG - (2 * SEG - LEG_REACH) * Math.max(g.a, g.r);
  const hC = Math.sqrt(reach * reach - g.half * g.half);
  const q = mod(phase - R_CONTACT, 0.5);
  const mid = reach;
  const walk = hC + (mid - hC) * Math.sin(Math.PI * (q / 0.5)) ** 2;
  if (g.r <= 0) return walk;
  const run =
    q < g.stance
      ? hC - 0.6 * Math.sin((Math.PI * q) / g.stance)
      : hC + 1.1 * Math.sin((Math.PI * (q - g.stance)) / (0.5 - g.stance));
  return walk + (run - walk) * g.r;
}

/** Foot target [lowest sole y, sole z] at leg phase ψ (0 = heel strike). */
function gaitFoot(g: Gait, psi: number): [number, number] {
  if (psi < g.stance) return [0, g.half * (1 - (2 * psi) / g.stance)];
  const u = (psi - g.stance) / (1 - g.stance);
  // Swing: the foot peels up behind (a heel kick when running) and reaches forward to land.
  const lift = 3.8 * smoothstep(0, 0.6, g.a) * (1 - g.r) + 4.5 * g.r;
  const shape = u ** (1 - 0.15 * g.r);
  return [lift * Math.sin(Math.PI * shape), -g.half * Math.cos(Math.PI * u)];
}

/**
 * Phase-coherent locomotion at `speed` (world units / s): a planted walk
 * that turns into a run with a flight phase towards RUN_FULL_SPEED. The legs
 * are solved with IK onto a stance foot that glides back at exactly the
 * walker's speed, so feet never skate; heel strike and toe-off come from the
 * shin angle (the sole rolls). Contact poses at phase R_CONTACT (right) and
 * R_CONTACT + 0.5 (left), passing poses in between.
 */
export function gaitPose(phase: number, speed: number): CharacterPose {
  const g = gaitOf(speed);
  const { a, r } = g;
  const amp = Math.max(a, r);
  const p = restPose();
  const ph = TAU * (phase - R_CONTACT);
  // +1 when the right foot is forward (its heel strike), −1 when it is back.
  const fwdR = Math.cos(ph);
  // +1 at the right leg's mid-stance, −1 at the left's.
  const stR = Math.cos(TAU * (phase - R_CONTACT - g.stance / 2));
  // Pelvis: twists with the leading leg, sways over and drops away from the stance leg.
  const yaw = (0.12 * a + 0.05 * r) * fwdR;
  const roll = -(0.05 * a + 0.03 * r) * stR;
  const sway = -(0.9 * a + 0.4 * r) * stR;
  const pitch = 0.1 * r;
  p.hips.rot = [0, yaw, roll];
  const hipY = gaitHipY(g, phase);
  const b: Placement = { y: hipY, z: 0, x: sway, pitch };
  placeHips(p, b);
  const psiR = mod(phase - R_CONTACT, 1);
  const psiL = mod(phase - R_CONTACT - 0.5, 1);
  const fR = gaitFoot(g, psiR);
  const fL = gaitFoot(g, psiL);
  // Running rolls further onto the forefoot (see soleDrop).
  const toe = TOE_GIVE + 0.1 * r;
  setLeg(p, "R", pitch, legIK(hipY, 0, fR[0], fR[1], toe));
  setLeg(p, "L", pitch, legIK(hipY, 0, fL[0], fL[1], toe));
  // Legs undo the pelvis twist / roll / sway so the feet track straight.
  const fix = -Math.atan2(sway, hipY) - roll;
  add(p, "thighR", [0, -yaw, fix]);
  add(p, "thighL", [0, -yaw, fix]);
  // Torso: leans into the stride, shoulders counter-rotate; head stays level and forward.
  const tPitch = 0.05 + 0.03 * a + 0.12 * r;
  const tYaw = -1.9 * yaw;
  add(p, "torso", [tPitch, tYaw, -0.6 * roll]);
  const bob = (hipY - gaitHipY(g, phase + 0.125)) / 40;
  add(p, "head", [-0.7 * (tPitch + pitch) + bob, -(yaw + tYaw), 0.4 * roll]);
  // Arms swing against the legs (a touch late), elbows bend more on the forward swing.
  const swing = 0.42 * a * (1 - r) + 0.8 * r;
  const armR = swing * Math.cos(ph - 0.25);
  const out = 0.1 + 0.04 * amp;
  add(p, "upperArmR", [armR - 0.08 * r, 0.1 * r, -out]);
  add(p, "upperArmL", [-armR - 0.08 * r, -0.1 * r, out]);
  const elbow = (0.22 + 0.25 * a) * (1 - r) + 1.35 * r;
  const fwdBend = 0.35 * (1 - 0.4 * r);
  add(p, "forearmR", [
    -elbow - fwdBend * Math.max(0, -armR / Math.max(swing, 1e-6)) * amp,
    0,
    0.06 * r,
  ]);
  add(p, "forearmL", [
    -elbow - fwdBend * Math.max(0, armR / Math.max(swing, 1e-6)) * amp,
    0,
    -0.06 * r,
  ]);
  // Secondary motion lags behind the body.
  add(p, "coatTail", [
    0.1 * a + 0.3 * r + (0.07 * a + 0.12 * r) * Math.sin(2 * ph - 0.9),
    0,
    0.06 * amp * Math.sin(ph - 0.9) - 0.5 * roll,
  ]);
  add(p, "hairBack", [
    0.14 * a + 0.4 * r + (0.1 * a + 0.16 * r) * Math.sin(2 * ph - 1.1),
    0,
    0.1 * amp * Math.sin(ph - 1.1),
  ]);
  return p;
}

/** "run" as a pose kind: at least a full run; periodic in 1 / gaitHz of that speed (RUN_HZ at rest). */
function runPose(t: number, speed: number): CharacterPose {
  const v = Math.max(speed, RUN_FULL_SPEED);
  return gaitPose(gaitHz(v) * t, v);
}

// ── Gestures and activities ─────────────────────────────────────

function interactPose(t: number, o: PoseOptions): CharacterPose {
  const p = idlePose(t, o);
  const e =
    t < 0 || t > INTERACT_DURATION
      ? 0
      : smoothstep(0, 0.18, t) * (1 - smoothstep(0.42, INTERACT_DURATION, t));
  if (e === 0) return p;
  const press = t > 0.18 && t < 0.42 ? Math.sin((Math.PI * (t - 0.18)) / 0.24) : 0;
  const reach = restPose();
  add(reach, "upperArmR", [-1.25 - 0.12 * press, 0, 0.14]);
  add(reach, "forearmR", [-0.4 + 0.3 * press, 0, 0]);
  add(reach, "upperArmL", [0.05, 0, 0.1]);
  add(reach, "forearmL", [-0.2, 0, 0]);
  add(reach, "torso", [0.12, 0.2, 0]);
  add(reach, "head", [0.14, -0.12, 0]);
  add(reach, "thighR", [-0.14, 0, 0]);
  add(reach, "shinR", [0.14, 0, 0]);
  add(reach, "hips", [0, 0, 0], [0, -0.2, 0.3]);
  add(reach, "coatTail", [0.06, 0, 0]);
  add(reach, "hairBack", [0.08, 0, 0]);
  // Face parts keep the idle blink / brows.
  reach.brows = { ...p.brows };
  reach.lids = { ...p.lids };
  return blendPose(p, reach, e);
}

function talkPose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const ts = t + seed * 5.17;
  const p = restPose();
  const b = breathing(p, ts);
  relaxedArms(p, b);
  // Nods and tilts.
  add(p, "head", [
    0.07 * Math.sin(TAU * 1.6 * ts) + 0.04 * Math.sin(TAU * 2.7 * ts + 1),
    0.12 * Math.sin(TAU * 0.3 * ts),
    0.05 * Math.sin(TAU * 0.45 * ts + 2),
  ]);
  // Right hand gestures in front of the chest, the left joins in now and then.
  const g = Math.sin(TAU * 0.7 * ts);
  add(p, "upperArmR", [-0.45 - 0.15 * g, 0.2, 0.02]);
  add(p, "forearmR", [
    -1.0 + 0.25 * Math.sin(TAU * 1.3 * ts),
    -0.2,
    0.2 * Math.sin(TAU * 0.9 * ts),
  ]);
  const lw = plateau(mod(ts, 6), 2, 4, 0.6);
  add(p, "upperArmL", [-0.35 * lw, -0.15 * lw, 0.05 * lw]);
  add(p, "forearmL", [(-0.8 + 0.2 * Math.sin(TAU * 1.1 * ts)) * lw, 0, 0]);
  add(p, "torso", [0.02, 0.08 * g, 0]);
  // Brows punctuate the gestures.
  face(p, t, seed, {
    raise: 0.25 + 0.45 * Math.max(0, g) * Math.max(0, Math.sin(TAU * 0.35 * ts)),
    tilt: 0.05 * Math.sin(TAU * 0.45 * ts + 2),
  });
  return p;
}

function thinkPose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const ts = t + seed * 3.9;
  const p = restPose();
  breathing(p, ts);
  // Right hand to the chin, left arm across the waist supporting the elbow.
  const tap =
    0.04 * Math.max(0, Math.sin(TAU * 1.4 * ts)) * smoothstep(-0.2, 0.2, Math.sin(TAU * 0.2 * ts));
  add(p, "upperArmR", [-0.62, 0.35, 0.3]);
  add(p, "forearmR", [-2.05 - tap, 0.25, 0.1]);
  add(p, "upperArmL", [-0.25, -0.3, -0.12]);
  add(p, "forearmL", [-1.45, -0.35, -0.35]);
  add(p, "head", [-0.12, -0.1 + 0.08 * Math.sin(TAU * 0.13 * ts), 0.12]);
  add(p, "torso", [0.03, 0.05, -0.02]);
  add(p, "thighR", [-0.04, 0, -0.03]);
  add(p, "shinR", [0.08, 0, 0]);
  face(p, t, seed, {
    raise: -0.55,
    tilt: 0.14 + 0.04 * Math.sin(TAU * 0.13 * ts),
  });
  return p;
}

function celebratePose(t: number, o: PoseOptions): CharacterPose {
  const p = restPose();
  const hop = Math.abs(Math.sin(TAU * 1.1 * t));
  const pump = Math.sin(TAU * 2.2 * t);
  // Crouch on landing, spring up; right fist punches the air, left fist at the hip.
  add(p, "hips", [0, 0, 0], [0, 0.9 * hop - 0.5, 0]);
  add(p, "thighR", [-0.3 * (1 - hop), 0, -0.05]);
  add(p, "thighL", [-0.3 * (1 - hop), 0, 0.05]);
  add(p, "shinR", [0.5 * (1 - hop), 0, 0]);
  add(p, "shinL", [0.5 * (1 - hop), 0, 0]);
  add(p, "torso", [0.08 * (1 - hop) - 0.06, 0, 0]);
  add(p, "upperArmR", [-2.7 + 0.25 * pump, 0, -0.25]);
  add(p, "forearmR", [-0.55 - 0.45 * Math.max(0, pump), 0, 0]);
  add(p, "upperArmL", [0.1, 0, 0.35]);
  add(p, "forearmL", [-1.6, 0, 0]);
  add(p, "head", [-0.25 + 0.06 * pump, 0, 0.06 * Math.sin(TAU * 1.1 * t)]);
  add(p, "coatTail", [0.2 * hop, 0, 0]);
  add(p, "hairBack", [-0.1 + 0.4 * (1 - hop), 0, 0]);
  face(p, t, o.seed ?? 0, { raise: 0.8 + 0.2 * hop });
  return p;
}

// ── Sitting and lying ───────────────────────────────────────────
//
// Both are placed by the engine: it moves the ROOT (feet / floor point of the
// character) so the seat or mattress meets the contact the constants below
// describe, over SIT_ENTER_DURATION / LIE_ENTER_DURATION (and back over the
// *_EXIT_DURATION), ideally with `seatRootProgress` as the easing so the
// root travel matches the body.

/** Thigh half-thickness (rig voxels): a level thigh's underside lies this far below its axis. */
const THIGH_HALF = 3;
/** Seated hip joint (legs): height above the root and z from the root (rig voxels). */
const SIT_HIP_Y = 12;
const SIT_HIP_Z = -12;
/** Pelvis rolled back a little when seated; the hip joints tuck up into it so the buttocks meet the seat. */
const SIT_PELVIS = -0.16;
const SIT_TUCK = 1.5;
/** Hip joint height while lying (rig voxels): the back (5 voxels behind the joint) rests on the root plane. */
const LIE_HIP_Y = 5;
/** Hips / torso depth behind the joint (rig voxels). */
const BACK_DEPTH = 5;

/**
 * "sit": height (world units) of the seat contact — the underside of the
 * level thighs / buttocks — above the root while the root stands on the
 * floor. The feet rest flat on the floor under the knees at the root's
 * x/z. Seat higher than this → the engine lifts the root by the difference
 * (the feet then dangle a little).
 */
export const SIT_SEAT_HEIGHT = (SIT_HIP_Y - THIGH_HALF) * CHARACTER_SCALE;
/**
 * "sit": local +z offset (world units, negative = behind the feet) of the
 * seat contact point — directly under the hip joints, i.e. the centre of
 * the buttocks — from the root. The engine places the root so that
 * root + rotate(facing) · (0, SIT_SEAT_HEIGHT, SIT_SEAT_OFFSET) is on the
 * seat's sit point; she faces away from the backrest, feet in front.
 */
export const SIT_SEAT_OFFSET = SIT_HIP_Z * CHARACTER_SCALE;
/**
 * "lie": height (world units) of the back contact (the back of the hips and
 * torso) above the root. Lying on her back along local z: hip joints at
 * the root's x/z, head towards −z, feet towards +z. The engine puts the
 * root at mattress height − LIE_BACK_HEIGHT; heels, arms, coat and head
 * never go below the back contact.
 */
export const LIE_BACK_HEIGHT = (LIE_HIP_Y - BACK_DEPTH) * CHARACTER_SCALE;
/** Sit-down: a glance back at the seat, lowering with a forward lean, hands onto the thighs (s). */
export const SIT_ENTER_DURATION = 1.2;
/** Stand-up from a seat (s): lean forward, push on the thighs, rise (the `transitionDuration` out of "sit"). */
export const SIT_EXIT_DURATION = 1.0;
/** Lie-down: sit on the bed edge (first ~40 %), then swing the legs up and lie back (s). */
export const LIE_ENTER_DURATION = 2.2;
/** Get-up from lying (s): sit up and swing the legs off (first ~55 %), then stand (the `transitionDuration` out of "lie"). */
export const LIE_EXIT_DURATION = 1.8;

/**
 * A seat for "sit" (world units): `height` of the seat surface above the
 * floor, `footrest` height of something to put the feet on (a stool rail,
 * a chair base; 0 = the floor), `sink` how far the buttocks may press into
 * a soft cushion so the feet reach down (default 0).
 */
export interface SeatSpec {
  height: number;
  footrest?: number;
  sink?: number;
}

/** How a seat is sat on: root lift (world), where the feet go (rig voxels, root space), planted or hanging. */
export interface SeatFit {
  /** Lift of the root above the floor (world units, may be < 0 for very low seats). */
  lift: number;
  /** Sole target (y, z) relative to the root, rig voxels. */
  foot: [number, number];
  /** Feet on the floor / footrest (else they hang from the seat edge). */
  planted: boolean;
}

/** Leg reach used to plant the feet (rig voxels; just under full stretch, see `softReach`). */
const SIT_REACH = 2 * SEG * 0.97;
/** Feet may fall this short of the floor and still count as planted (toes, soft reach), rig voxels. */
const SIT_TOE_SLACK = 1.5;

/**
 * Fit the seated body to a seat. The lab's seats sit at about her knee
 * height (~1.0–1.25 vs a knee of ~1.1): on a low seat she sits
 * with level thighs and shins upright; the higher the seat, the more the
 * legs straighten and reach forward and down (she perches on the front
 * edge), and a soft cushion gives up to `sink`. Only when even that cannot
 * reach the floor / footrest do the feet hang.
 */
export function sitFit(seat?: SeatSpec): SeatFit {
  const k = 1 / CHARACTER_SCALE;
  const s = (seat?.height ?? SIT_SEAT_HEIGHT) * k;
  const f = (seat?.footrest ?? 0) * k;
  // Hip joint above the floor with level thighs on the seat.
  const h0 = s + THIGH_HALF;
  // A soft seat gives until the knees can bend a little (never deeper than `sink`).
  const sink = clamp(h0 - f - (SIT_REACH - 4), 0, (seat?.sink ?? 0) * k);
  const h = h0 - sink;
  const v = h - f;
  const lift = (h - SIT_HIP_Y) * CHARACTER_SCALE;
  const planted = v <= SIT_REACH + SIT_TOE_SLACK;
  let dy: number;
  let dz: number;
  if (planted) {
    // Feet as far forward as the legs allow, never past the upright shin (12).
    dy = -v;
    dz = clamp(Math.sqrt(Math.max(0, SIT_REACH * SIT_REACH - v * v)), 0, -SIT_HIP_Z);
  } else {
    // Hanging from the edge: knees a little bent, shins down.
    dy = -(SIT_REACH - 2);
    dz = 6;
  }
  return { lift, foot: [SIT_HIP_Y + dy, SIT_HIP_Z + dz], planted };
}

/** Descent 0 (standing) … 1 (seated) of the sit-down at pose clock t. */
function sitDescent(t: number): number {
  return easeInOut((t - 0.15) / 0.95);
}

/** Lie-down stages at pose clock t: a = sat down on the edge, b = reclined. */
function lieStages(t: number): [number, number] {
  return [easeInOut(t / 0.9), easeInOut((t - 0.75) / 1.3)];
}

/**
 * Root travel for the engine while sitting down / lying down / getting up
 * (0 = where the move starts, 1 = where it ends; enter: standing spot →
 * seat root, exit: seat root → standing spot). `pos` eases the root
 * position (incl. height), `yaw` its facing. `t` is seconds since the
 * switch (the pose clock for "enter"; for "exit" time since switching away).
 */
export function seatRootProgress(
  kind: "sit" | "lie",
  dir: "enter" | "exit",
  t: number,
): { pos: number; yaw: number } {
  if (kind === "sit") {
    if (dir === "enter") return { pos: sitDescent(t), yaw: smoothstep(0, 0.45, t) };
    return { pos: easeInOut((t / SIT_EXIT_DURATION - 0.15) / 0.7), yaw: 0 };
  }
  if (dir === "enter") {
    const [a, b] = lieStages(t);
    return { pos: a, yaw: b };
  }
  const u = t / LIE_EXIT_DURATION;
  return { pos: easeInOut((u - 0.45) / 0.5), yaw: easeInOut(u / 0.55) };
}

/** Hips placement of the sit-down at descent d. */
function sitPlacement(d: number): Placement {
  const ly = HIP_Y + (SIT_HIP_Y - HIP_Y) * smoothstep(0.05, 1, d);
  const lz = SIT_HIP_Z * smoothstep(0, 0.85, d);
  const pitch = SIT_PELVIS * smoothstep(0.5, 1, d);
  const tuck = SIT_TUCK * smoothstep(0.6, 1, d);
  return {
    y: ly - tuck * Math.cos(pitch),
    z: lz - tuck * Math.sin(pitch),
    pitch,
    thighLift: tuck,
  };
}

/** Palm target on the top of a seated thigh (y, z), `k` = 0 near the hip … 1 at the knee. */
function thighTop(b: Placement, k: number): [number, number] {
  const [hy, hz] = legRoot(b);
  return [hy + THIGH_HALF + 1.2, hz + 3 + 7 * k];
}

interface SitState {
  /** Descent 0..1. */
  d: number;
  /** Extra forward lean of the torso (rad): balance while lowering / rising. */
  lean: number;
  /** Glance back at the seat 0..1. */
  look: number;
  /** Right hand reaching back for the seat 0..1. */
  reach: number;
  /** Hands pushing on the thighs to rise 0..1. */
  push: number;
  /** Seated idle layer 0..1. */
  idle: number;
  /** Settling onto the seat 0..1. */
  give: number;
}

function sitBody(s: SitState, t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const ts = t + seed * 4.3;
  const p = restPose();
  const b = sitPlacement(s.d);
  // Feet: from the standing spot to the floor / footrest under the seat (the
  // root rises with the same easing, see seatRootProgress).
  const fit = sitFit(o.seat);
  plantFeet(p, b, [fit.foot[0] * s.d, fit.foot[1] * s.d], undefined, fit.planted ? 1 : TOE_GIVE);
  // Feet a touch apart, knees follow.
  add(p, "thighR", [0, 0, -0.05 * s.d]);
  add(p, "thighL", [0, 0, 0.05 * s.d]);
  const br = Math.sin(TAU * 0.22 * ts);
  const tPitch = -b.pitch + 0.05 * s.d + s.lean;
  p.torso.rot = [tPitch + 0.012 * br, 0, 0];
  p.torso.pos = [0, 0.2 * br, 0];
  add(p, "head", [-0.65 * s.lean - 0.02 * br, 0, 0]);
  // Glance back / down over the right shoulder at the seat.
  add(p, "head", [0.3, -0.6, -0.05], undefined, s.look);
  add(p, "torso", [0, -0.18, 0], undefined, s.look);
  // Arms: relaxed and slightly forward for balance, then onto the thighs.
  relaxedArms(p, br);
  add(p, "upperArmR", [-0.5 * s.lean, 0, 0]);
  add(p, "upperArmL", [-0.5 * s.lean, 0, 0]);
  add(p, "upperArmR", [0.55, 0, -0.25], undefined, s.reach);
  add(p, "forearmR", [-0.2, 0, 0], undefined, s.reach);
  const onThighs = smoothstep(0.45, 0.95, s.d) * (1 - s.reach);
  if (onThighs > 0) {
    const worldT = b.pitch + tPitch;
    const [sy, sz] = shoulderAt(b, tPitch);
    const k = 0.72 + 0.2 * s.push;
    const [ty, tz] = thighTop(b, k);
    setArm(p, "R", worldT, armIK(sy, sz, ty + 0.3 * br, tz), 0.32, onThighs);
    setArm(p, "L", worldT, armIK(sy, sz, ty + 0.3 * br, tz), 0.32, onThighs);
  }
  // Coat skirt drapes back over the seat; ponytail hangs.
  add(p, "coatTail", [-1.45 * s.d, 0, 0], [0, 0.9 * s.d, 0]);
  add(p, "hairBack", [0.04 + 0.1 * s.lean, 0, 0]);
  if (s.idle > 0) {
    const w = s.idle;
    // Looks around now and then.
    const look = 0.3 * plateau(mod(ts, 9), 4, 5.5, 0.6) - 0.22 * plateau(mod(ts, 9), 7, 7.8, 0.4);
    add(p, "head", [0.03, look, 0.04 * look], undefined, w);
    add(p, "torso", [0, 0.1 * look, 0], undefined, w);
    // Fingers drum on the thigh; the left foot taps.
    const drum = plateau(mod(ts, 13), 7, 10, 0.5);
    add(p, "forearmR", [0.07 * drum * Math.sin(TAU * 4.2 * ts), 0, 0], undefined, w);
    const tap = drum * (0.5 + 0.5 * Math.sin(TAU * 2.1 * ts));
    add(p, "shinL", [-0.1 * tap, 0, 0], undefined, w);
    add(p, "thighL", [-0.04 * tap, 0, 0], undefined, w);
    // Leans back into the seat and rolls the shoulders once in a long while.
    const back = plateau(mod(ts, 23), 15, 18.5, 0.8);
    add(p, "torso", [-0.14, 0, 0], undefined, w * back);
    add(p, "head", [-0.06, 0, 0], undefined, w * back);
    add(p, "upperArmR", [0, 0, 0], [0, 0.35 * back * Math.max(0, Math.sin(TAU * 0.8 * ts)), 0], w);
    add(
      p,
      "upperArmL",
      [0, 0, 0],
      [0, 0.35 * back * Math.max(0, Math.sin(TAU * 0.8 * ts + 1)), 0],
      w,
    );
  }
  add(p, "hips", [0, 0, 0], [0, -0.2 * s.give, 0]);
  add(p, "head", [0.06 * s.give, 0, 0]);
  face(p, t, seed, { raise: 0.25 * s.look + 0.1 * s.push });
  return p;
}

/** Sit-down state at pose clock t. */
function sitState(t: number): SitState {
  const e = SIT_ENTER_DURATION;
  return {
    d: sitDescent(t),
    lean: 0.5 * Math.sin(Math.PI * clamp((t - 0.15) / 0.95, 0, 1)) ** 1.2,
    look: plateau(t, 0.12, 0.5, 0.15),
    reach: plateau(t, 0.25, 0.7, 0.2),
    push: 0,
    idle: smoothstep(e - 0.1, e + 0.6, t),
    // A small give as the weight lands on the seat.
    give: plateau(t, 1.08, 1.16, 0.1),
  };
}

function sitPose(t: number, o: PoseOptions): CharacterPose {
  return sitBody(sitState(t), t, o);
}

/**
 * Stand up from a seat: `s0` = the sit-down state at the switch (it may
 * not have finished), u = 0..1 through SIT_EXIT_DURATION.
 */
function sitExitPose(s0: SitState, u: number, t: number, o: PoseOptions): CharacterPose {
  const rise = easeInOut((u - 0.15) / 0.7);
  const fade = 1 - smoothstep(0, 0.3, u);
  return sitBody(
    {
      d: s0.d * (1 - rise),
      lean: s0.lean * fade + 0.55 * s0.d * Math.sin(Math.PI * clamp(u / 0.85, 0, 1)) ** 0.9,
      look: s0.look * fade,
      reach: s0.reach * fade,
      push: s0.d * plateau(u, 0.2, 0.5, 0.15),
      idle: s0.idle * fade,
      give: s0.give * fade,
    },
    t,
    o,
  );
}

interface LieState {
  /** Sat down on the edge 0..1. */
  a: number;
  /** Reclined 0..1. */
  b: number;
  /** Arms supporting the body (elbows back) 0..1. */
  prop: number;
  /** Lying idle layer 0..1. */
  idle: number;
}

/** Hip-joint height (rig voxels) when sat on the bed edge. */
const EDGE_HIP_Y = THIGH_HALF + 0.5;

function lieBody(s: LieState, t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const ts = t + seed * 5.9;
  const p = restPose();
  const { a, b } = s;
  const br = Math.sin(TAU * 0.18 * ts);
  // Pelvis: standing → sat on the edge (rolled back a little) → on the back.
  const pitch = SIT_PELVIS * smoothstep(0.4, 1, a) * (1 - b) + (-Math.PI / 2) * easeInOut(b);
  const tuck = SIT_TUCK * smoothstep(0.5, 1, a) * (1 - b);
  const ly = HIP_Y + (EDGE_HIP_Y - HIP_Y) * a + (LIE_HIP_Y - EDGE_HIP_Y) * b;
  const place: Placement = {
    y: ly - tuck * Math.cos(pitch),
    z: -tuck * Math.sin(pitch),
    pitch,
    thighLift: tuck,
  };
  placeHips(p, place);
  const [hy, hz] = legRoot(place);
  // Legs: planted → hanging over the edge → swung up and stretched out along +z.
  const knee = s.idle * plateau(mod(ts, 19), 9, 15, 1.2);
  const lying = (side: "R" | "L"): [number, number] => {
    const up = side === "R" ? knee : 0;
    const splay = side === "R" ? 0 : 0.5;
    return legIK(hy, hz, 0, 23 + splay - 9 * up);
  };
  for (const side of ["R", "L"] as const) {
    const stand = legIK(hy, hz, 0, 0);
    const hang: [number, number] = [-Math.PI / 2 + 0.06, 0.3];
    const la = smoothstep(0.15, 0.9, a);
    const lb = easeInOut(clamp(b / 0.8, 0, 1));
    const lie = lying(side);
    const th = stand[0] + (hang[0] - stand[0]) * la + (lie[0] - hang[0]) * lb;
    const sh = stand[1] + (hang[1] - stand[1]) * la + (lie[1] - hang[1]) * lb;
    setLeg(p, side, pitch, [th, sh]);
  }
  // Toes fall outwards when relaxed.
  add(p, "thighR", [0, -0.12 * b, -0.03]);
  add(p, "thighL", [0, 0.12 * b, 0.03]);
  // Torso: upright on the edge (a slight forward lean while lowering), then lies back.
  const lowering = 0.35 * Math.sin(Math.PI * a) * (1 - b);
  // Keep the torso upright relative to the world until the recline, then follow the hips.
  p.torso.rot = [
    -(SIT_PELVIS * smoothstep(0.4, 1, a)) * (1 - b) + lowering + 0.02 * br * (1 - b),
    0,
    0,
  ];
  // Lying, the chest rises with the breath (hips-local +z is up).
  p.torso.pos = [0, 0, 0.3 * (0.5 + 0.5 * br) * b];
  // Head: chin tucked onto the pillow when down; looks where it lies down first.
  // A pillow: the head rests a voxel up, chin tucked a little.
  add(p, "head", [0.3 * b - 0.5 * lowering, 0, 0], [0, 0, 0.6 * b]);
  add(p, "head", [0.25, -0.35, 0], undefined, plateau(a, 0.1, 0.5, 0.2) * (1 - b));
  const turn =
    s.idle * (0.4 * plateau(mod(ts, 27), 12, 20, 1.5) - 0.3 * plateau(mod(ts, 27), 3, 6, 1));
  add(p, "head", [0, turn, 0]);
  // Ponytail spreads on the pillow; coat skirt flat under the thighs.
  add(p, "hairBack", [0.04 - 0.34 * b, 0, 0], [0, 0, b]);
  add(p, "coatTail", [-1.45 * a * (1 - b) + 0.25 * b, 0, 0], [0, 0.9 * a * (1 - b), 1.5 * b]);
  // Arms: hang → support on the mattress (elbows back) → folded on the stomach.
  relaxedArms(p, br);
  const worldT = pitch + p.torso.rot[0];
  const [sy, sz] = shoulderAt(place, p.torso.rot[0]);
  if (s.prop > 0) {
    // Palms on the mattress beside the hips, arms behind the body.
    const target: [number, number] = [hy - THIGH_HALF + 1, hz - 6];
    setArm(p, "R", worldT, armIK(sy, sz, target[0], target[1]), -0.25, s.prop);
    setArm(p, "L", worldT, armIK(sy, sz, target[0], target[1]), -0.25, s.prop);
  }
  const fold = smoothstep(0.7, 1, b) * (1 - s.prop);
  if (fold > 0) {
    // Hands rest on the stomach and rise with the breath.
    const belly: [number, number] = [LIE_HIP_Y + BACK_DEPTH + 3.4 + 0.35 * br, -8];
    setArm(p, "R", worldT, armIK(sy, sz, belly[0], belly[1] + 1), 0.55, fold);
    setArm(p, "L", worldT, armIK(sy, sz, belly[0] + 0.6, belly[1] - 1), 0.55, fold);
  }
  // Eyes drift shut after a while; they open now and then.
  const shut =
    s.idle * smoothstep(3, 5, t) * (1 - plateau(mod(ts, 25), 17, 19.5, 0.4)) * (1 - 0.6 * knee);
  face(p, t, seed, { raise: -0.1 * shut });
  if (shut > 0) {
    const lid = p.lids.pos ?? [0, 0, 0];
    p.lids.pos = [lid[0], lid[1], Math.max(lid[2], LID_TRAVEL * shut)];
  }
  return p;
}

/** Lie-down state at pose clock t. */
function lieState(t: number): LieState {
  const [a, b] = lieStages(t);
  return {
    a,
    b,
    prop: plateau(t, 0.95, 1.7, 0.3),
    idle: smoothstep(LIE_ENTER_DURATION - 0.2, LIE_ENTER_DURATION + 0.6, t),
  };
}

function liePose(t: number, o: PoseOptions): CharacterPose {
  return lieBody(lieState(t), t, o);
}

/** Get up from lying: `s0` = the lie-down state at the switch, u = 0..1 through LIE_EXIT_DURATION. */
function lieExitPose(s0: LieState, u: number, t: number, o: PoseOptions): CharacterPose {
  const up = easeInOut(u / 0.55);
  const stand = easeInOut((u - 0.45) / 0.5);
  const fade = 1 - smoothstep(0, 0.25, u);
  return lieBody(
    {
      a: s0.a * (1 - stand),
      b: s0.b * (1 - up),
      // Elbows back to push up while sitting up (or keep a support already there).
      prop: Math.max(s0.prop * fade, s0.b * plateau(u, 0.2, 0.42, 0.15)),
      idle: s0.idle * fade,
    },
    t,
    o,
  );
}

/**
 * Pose of a seat kind ("sit" / "lie") being left: the stand-up / get-up
 * choreography from however far it had got when the switch happened.
 * `u` = 0..1 through the exit.
 */
function seatExit(
  from: PoseTrack,
  switchedAt: number,
  now: number,
  u: number,
  o: PoseOptions,
): CharacterPose {
  const t0 = switchedAt - from.start;
  const t = now - from.start;
  if (from.kind === "sit") return sitExitPose(sitState(t0), u, t, o);
  return lieExitPose(lieState(t0), u, t, o);
}

function drinkPose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const p = stand(t, seed);
  // Mug held at the chest; every 5 s a sip (raise, tip, lower).
  const sip = plateau(mod(t, 5), 1.5, 2.4, 0.5);
  add(p, "upperArmR", lerp3([-0.25, 0.3, 0.3], [-1.55, -0.2, 0.48], sip));
  add(p, "forearmR", lerp3([-1.3, 0, 0.1], [-0.62, 0, 0.23], sip));
  // Free hand rests on the hip.
  add(p, "upperArmL", [0.12, 0, 0.42]);
  add(p, "forearmL", [-1.25, 0, -0.35]);
  add(p, "head", [0.12 - 0.34 * sip, 0.05 * (1 - sip), 0]);
  add(p, "torso", [-0.04 * sip, 0, 0]);
  face(p, t, seed, { raise: 0.3 * sip });
  return p;
}

function readPose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const p = stand(t, seed);
  // Book held open at chest height, head down, eyes scanning the lines.
  add(p, "upperArmR", [-0.45, 0.3, 0.12]);
  add(p, "upperArmL", [-0.45, -0.3, -0.12]);
  add(p, "forearmR", [-1.25, 0, 0.1]);
  add(p, "forearmL", [-1.25, 0, -0.1]);
  const line = mod(t * 0.33, 1);
  const scan = 0.12 * (line < 0.85 ? line / 0.85 : 1 - (line - 0.85) / 0.15) - 0.06;
  add(p, "head", [0.42, scan, 0]);
  add(p, "torso", [0.06, 0, 0]);
  // Page turn every 6 s: the left hand flicks across.
  const turn = plateau(mod(t, 6), 4.7, 5.1, 0.25);
  add(p, "upperArmL", [-0.15, 0.25, -0.1], undefined, turn);
  add(p, "forearmL", [-0.2, 0, -0.35], undefined, turn);
  add(p, "head", [0, -0.12, 0], undefined, turn);
  face(p, t, seed, { raise: -0.15 + 0.4 * turn });
  return p;
}

function listenPose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const p = stand(t, seed);
  // Arms folded, head cocked towards the radio, nodding to the beat, a foot taps.
  add(p, "upperArmR", [-0.4, 0.25, 0.32]);
  add(p, "forearmR", [-1.75, 0.45, 0.25]);
  add(p, "upperArmL", [-0.4, -0.25, -0.32]);
  add(p, "forearmL", [-1.65, -0.45, -0.25]);
  const beat = TAU * 1.7 * t;
  const groove = plateau(mod(t, 16), 2, 13, 1.2);
  add(p, "head", [0.08 + 0.07 * groove * Math.sin(beat), 0.22, 0.2]);
  add(p, "torso", [0.05, 0.08, 0.02 * groove * Math.sin(beat / 2)]);
  const tap = groove * Math.max(0, Math.sin(beat)) ** 2;
  // Heel tap: the knee dips forward, the toe stays down (no ankle to lift the toes).
  add(p, "thighL", [-0.07 * tap, 0, 0]);
  add(p, "shinL", [0.14 * tap, 0, 0]);
  face(p, t, seed, { raise: 0.25, tilt: 0.12 });
  return p;
}

function typingPose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const ts = t + seed * 2.3;
  const p = restPose();
  breathing(p, ts);
  weightShift(p, ts, 0.3);
  // Leaning in at a console, forearms level over the keyboard.
  add(p, "torso", [0.14, 0, 0]);
  add(p, "head", [0.02, 0, 0]);
  add(p, "hips", [0, 0, 0], [0, -0.1, 0.25]);
  add(p, "upperArmR", [-0.5, 0.2, 0.12]);
  add(p, "upperArmL", [-0.5, -0.2, -0.12]);
  add(p, "forearmR", [-1.05, -0.15, 0]);
  add(p, "forearmL", [-1.05, 0.15, 0]);
  // Typing bursts with short pauses; hands drift across the keys.
  const burst = plateau(mod(ts, 4.5), 0.35, 3.3, 0.3);
  add(p, "forearmR", [0.06 * Math.sin(TAU * 7.3 * ts), 0, 0], undefined, burst);
  add(p, "forearmL", [0.06 * Math.sin(TAU * 8.1 * ts + 1.3), 0, 0], undefined, burst);
  const drift = 0.06 * Math.sin(TAU * 0.6 * ts);
  add(p, "upperArmR", [0, drift, 0], undefined, burst);
  add(p, "upperArmL", [0, drift, 0], undefined, burst);
  // Glance down at the keys, then back up at the screen.
  const glance = plateau(mod(ts, 9), 6, 7.1, 0.35);
  add(p, "head", [0.25 * glance, 0.1 * glance, 0]);
  face(p, t, seed, { raise: -0.2 + 0.3 * glance });
  return p;
}

function crouchPose(t: number, o: PoseOptions): CharacterPose {
  const p = idlePose(t, o);
  const e =
    t < 0 || t > CROUCH_DURATION
      ? 0
      : smoothstep(0, 0.42, t) * (1 - smoothstep(0.75, CROUCH_DURATION, t));
  if (e === 0) return p;
  // Squat with planted feet (IK): hips down and back, up on the balls of the
  // feet, knees apart; the pelvis tips forward and the back leans over the knees.
  const place: Placement = {
    y: HIP_Y - 14.5 * e,
    z: -4.5 * e,
    x: (p.hips.pos?.[0] ?? 0) * (1 - e),
    pitch: 0.45 * e,
  };
  // Solve on a copy and ease the legs over from the idle stance (no pop at e → 0).
  const squat = blendPose(p, p, 0);
  plantFeet(squat, place, [0, 0], [0, 0], 1);
  const k = smoothstep(0, 0.35, e);
  for (const n of ["hips", "thighR", "thighL", "shinR", "shinL"] as const)
    p[n] = blendPart(p[n], squat[n], k);
  add(p, "thighR", [0, 0, -0.14 * e]);
  add(p, "thighL", [0, 0, 0.14 * e]);
  const lean = 0.75 * e;
  p.torso.rot = lerp3(p.torso.rot, [lean, 0.1, 0], e);
  add(p, "head", [-0.7, -0.1, 0], undefined, e);
  // The right hand reaches the floor in front of the feet and closes on the item.
  const grab = plateau(t, 0.5, 0.72, 0.1);
  const [sy, sz] = shoulderAt(place, lean);
  setArm(p, "R", place.pitch + lean, armIK(sy, sz, 1.5 + 2 * (1 - grab), 9), 0.12, e);
  add(p, "forearmR", [-0.25 * grab, 0, 0], undefined, e);
  // The left forearm rests on the left knee.
  add(p, "upperArmL", [-0.2, 0, 0.05], undefined, e);
  add(p, "forearmL", [-1.0, 0, -0.1], undefined, e);
  // Coat skirt folds up over the thighs, ponytail swings forward.
  add(p, "coatTail", [-1.2, 0, 0], [0, 0.4, 0], e);
  add(p, "hairBack", [0.3, 0, 0], undefined, e);
  return p;
}

function workPose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const ts = t + seed * 6.1;
  const p = restPose();
  breathing(p, ts);
  weightShift(p, ts, 0.4);
  relaxedArms(p, 0);
  // 7 s loop at a device: work the panel, reach up and turn a valve / bolt, step back and check.
  const u = mod(ts, 7);
  const panel = plateau(u, 0.45, 3.1, 0.4);
  const reach = plateau(u, 3.9, 5.2, 0.45);
  const check = plateau(u, 5.95, 6.45, 0.3);
  add(p, "torso", [0.14, 0, 0], undefined, panel);
  add(p, "hips", [0, 0, 0], [0, -0.1, 0.25], panel);
  add(p, "upperArmR", [-0.45, 0.2, 0.2], undefined, panel);
  add(p, "upperArmL", [-0.45, -0.2, -0.2], undefined, panel);
  add(p, "forearmR", [-0.9 + 0.08 * Math.sin(TAU * 3.1 * ts), -0.15, 0], undefined, panel);
  add(p, "forearmL", [-0.9 + 0.08 * Math.sin(TAU * 2.3 * ts + 1), 0.15, 0], undefined, panel);
  add(p, "head", [0.18, 0.08 * Math.sin(TAU * 0.4 * ts), 0], undefined, panel);
  const twist = 0.45 * Math.sin(TAU * 1.2 * u);
  add(p, "upperArmR", [-1.85, 0, 0.18], undefined, reach);
  add(p, "forearmR", [-0.45, twist, 0], undefined, reach);
  add(p, "upperArmL", [0.1, 0, 0.3], undefined, reach);
  add(p, "forearmL", [-1.2, 0, -0.3], undefined, reach);
  add(p, "torso", [-0.04, 0.12, 0], undefined, reach);
  add(p, "head", [-0.28, -0.05, 0], undefined, reach);
  add(p, "head", [0.05, 0.4, 0.06], undefined, check);
  add(p, "torso", [0, 0.12, 0], undefined, check);
  face(p, t, seed, { raise: -0.3 * panel + 0.2 * reach + 0.3 * check });
  return p;
}

function wavePose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const p = stand(t, seed);
  // Arm swings up and out, then the forearm waves side to side.
  const up = smoothstep(0, 0.35, t);
  add(p, "upperArmR", [-0.3, 0, -2.3], undefined, up);
  add(p, "forearmR", [-0.2, 0, 0.3 + 0.45 * Math.sin(TAU * 1.9 * t)], undefined, up);
  add(p, "torso", [-0.02, 0.08, -0.05], undefined, up);
  add(p, "head", [-0.08, 0.05, 0.06 * Math.sin(TAU * 0.95 * t)], undefined, up);
  face(p, t, seed, { raise: 0.6 * up });
  return p;
}

function carryPose(t: number, o: PoseOptions, speed: number): CharacterPose {
  const seed = o.seed ?? 0;
  let p: CharacterPose;
  if (speed > 0) {
    p = gaitPose(gaitHz(speed) * t, speed);
  } else {
    p = restPose();
    breathing(p, t + seed * 7.31);
    weightShift(p, t + seed * 7.31, 0.5);
  }
  // Arms locked around a crate at the chest (see `handProp("crate")`), leaning back a touch.
  for (const n of ["upperArmR", "upperArmL", "forearmR", "forearmL"] as const)
    p[n] = { rot: [0, 0, 0], pos: [0, 0, 0] };
  add(p, "upperArmR", [-0.62, 0.12, 0.02]);
  add(p, "upperArmL", [-0.62, -0.12, -0.02]);
  add(p, "forearmR", [-0.95, 0, 0.12]);
  add(p, "forearmL", [-0.95, 0, -0.12]);
  add(p, "torso", [-0.1, 0, 0]);
  add(p, "head", [0.06, 0, 0]);
  face(p, t, seed, { raise: -0.2 });
  return p;
}

/**
 * Riding the cage lift: feet planted facing the gate, the right hand up on
 * the side rail, the left hanging loose. Starts with a small step in place
 * (settling onto the deck) while the hand finds the rail; then a slow sway
 * and a glance up at the floor indicator now and then. The cage's own
 * acceleration and rattle come in via `animateCharacter` (`load`, `rattle`).
 */
function ridePose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const ts = t + seed * 3.3;
  const p = restPose();
  const b = breathing(p, ts);
  relaxedArms(p, b);
  // Step in: right foot, then left, settle.
  const stepR = plateau(t, 0.18, 0.3, 0.12);
  const stepL = plateau(t, 0.55, 0.67, 0.12);
  add(p, "thighR", [-0.55 * stepR, 0, 0]);
  add(p, "shinR", [0.75 * stepR, 0, 0]);
  add(p, "thighL", [-0.55 * stepL, 0, 0]);
  add(p, "shinL", [0.75 * stepL, 0, 0]);
  add(p, "hips", [0, 0, 0], [0.25 * (stepL - stepR), 0.12 * (stepR + stepL), 0]);
  // Slow sway with the cage (2.2 s), a touch of weight on the rail side.
  const sway = Math.sin((TAU * ts) / 2.2) * smoothstep(0.4, 1.2, t);
  shiftWeight(p, 0.25 * sway - 0.15 * smoothstep(0.6, 1.2, t));
  // Right hand up on the rail, gripping.
  const g = smoothstep(0.25, 0.85, t);
  const grip = 0.04 * Math.sin(TAU * 0.37 * ts);
  add(p, "upperArmR", [-0.35, 0.15, -1.15 + grip], undefined, g);
  add(p, "forearmR", [-0.6, 0.1, 0.35], undefined, g);
  add(p, "torso", [0, 0.06, -0.04], undefined, g);
  add(p, "upperArmL", [0.06, 0, 0.04]);
  // Eyes on the gate; every ~5 s a glance up at the floor indicator.
  const up = plateau(mod(ts, 5.2), 3.2, 4.2, 0.35);
  add(p, "head", [-0.06 - 0.3 * up, -0.05 * sway, 0.03 * sway]);
  add(p, "hairBack", [0, 0, 0.04 * sway]);
  add(p, "coatTail", [0.02 * sway, 0, 0]);
  face(p, t, seed, { raise: 0.25 * up - 0.1 });
  return p;
}

/**
 * Emergency ladder: hand over hand, knees alternating against the hands
 * (right hand up with the left knee), body close to the rungs. Periodic in
 * 1 / CLIMB_HZ apart from blinks and breathing.
 */
function climbPose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const p = restPose();
  breathing(p, t + seed * 2.9);
  const ph = TAU * CLIMB_HZ * t;
  const s = Math.sin(ph);
  const hi = 0.5 + 0.5 * s; // right hand high / left knee up
  const lo = 1 - hi;
  // The reaching hand goes almost straight up; the low one pulls at a rung
  // in front of the face, elbow out and bent.
  add(p, "upperArmR", [-1.5 - 1.2 * hi, 0, -0.1]);
  add(p, "upperArmL", [-1.5 - 1.2 * lo, 0, 0.1]);
  add(p, "forearmR", [-0.1 - 0.8 * lo, 0, 0]);
  add(p, "forearmL", [-0.1 - 0.8 * hi, 0, 0]);
  add(p, "thighL", [-0.25 - 0.55 * hi, 0, 0.04]);
  add(p, "shinL", [0.35 + 0.75 * hi, 0, 0]);
  add(p, "thighR", [-0.25 - 0.55 * lo, 0, -0.04]);
  add(p, "shinR", [0.35 + 0.75 * lo, 0, 0]);
  // Hips hug the ladder and bob with each pull; shoulders roll with the reach.
  add(p, "hips", [0.06, 0, 0.03 * s], [0, 0.35 * Math.sin(2 * ph), 0.4]);
  add(p, "torso", [0.1, 0.07 * s, -0.03 * s]);
  add(p, "head", [-0.18 + 0.06 * Math.sin(2 * ph), -0.1 * s, 0]);
  add(p, "coatTail", [0.25 + 0.1 * Math.sin(2 * ph), 0, 0]);
  add(p, "hairBack", [0.12, 0, 0.06 * s]);
  face(p, t, seed, { raise: -0.35 });
  return p;
}

/** A device powers on nearby: flinch back, hands up, brows up — then relax (one-shot). */
function startlePose(t: number, o: PoseOptions): CharacterPose {
  const p = idlePose(t, o);
  const e =
    t < 0 || t > STARTLE_DURATION
      ? 0
      : smoothstep(0, 0.14, t) * (1 - smoothstep(0.5, STARTLE_DURATION, t));
  if (e === 0) return p;
  const jolt = plateau(t, 0.08, 0.22, 0.08);
  add(p, "torso", [-0.2 - 0.05 * jolt, 0, 0], undefined, e);
  add(p, "hips", [0, 0, 0], [0, 0.1 * jolt, -0.35], e);
  add(p, "head", [-0.16, 0, 0], undefined, e);
  add(p, "upperArmR", [-0.5, 0, -0.28], [0, 0.4, 0], e);
  add(p, "upperArmL", [-0.5, 0, 0.28], [0, 0.4, 0], e);
  add(p, "forearmR", [-0.95, 0, 0.1], undefined, e);
  add(p, "forearmL", [-0.95, 0, -0.1], undefined, e);
  add(p, "thighR", [0.1, 0, 0], undefined, e);
  add(p, "thighL", [-0.08, 0, 0], undefined, e);
  add(p, "shinL", [0.16, 0, 0], undefined, e);
  add(p, "hairBack", [-0.25 * jolt, 0, 0], undefined, e);
  add(p, "coatTail", [-0.1, 0, 0], undefined, e);
  add(p, "brows", [0, 0, 0], [0, (0.9 * BROW_TRAVEL) / RIG_UNIT, 0], e);
  return p;
}

/**
 * Pure pose for `kind` at pose-clock `t` (seconds).
 *  - `speed` (world units / s): "walk" scales stride / swing / bounce
 *    (0 → standing, 13 → full stride); "run" uses it for its amplitude
 *    (0 → a full run); "carry" walks when speed > 0.
 *  - "interact" / "crouch": t is the time since the gesture started; after
 *    INTERACT_DURATION / CROUCH_DURATION they equal "idle" (ONE_SHOT_POSES).
 *  - `opts.idleFor` drives idle fidgets (defaults to t); `opts.seed`
 *    de-synchronises characters.
 * "walk" and "run" are strictly periodic (no blinks); every other kind blinks.
 */
export function characterPose(
  kind: CharacterPoseKind,
  t: number,
  speed = 0,
  opts: PoseOptions = {},
): CharacterPose {
  switch (kind) {
    case "idle":
      return idlePose(t, opts);
    case "walk":
      return gaitPose(gaitHz(speed) * t, speed);
    case "run":
      return runPose(t, speed);
    case "interact":
      return interactPose(t, opts);
    case "talk":
      return talkPose(t, opts);
    case "think":
      return thinkPose(t, opts);
    case "celebrate":
      return celebratePose(t, opts);
    case "sit":
      return sitPose(t, opts);
    case "lie":
      return liePose(t, opts);
    case "drink":
      return drinkPose(t, opts);
    case "read":
      return readPose(t, opts);
    case "listen":
      return listenPose(t, opts);
    case "carry":
      return carryPose(t, opts, speed);
    case "typing":
      return typingPose(t, opts);
    case "crouch":
      return crouchPose(t, opts);
    case "work":
      return workPose(t, opts);
    case "wave":
      return wavePose(t, opts);
    case "ride":
      return ridePose(t, opts);
    case "climb":
      return climbPose(t, opts);
    case "startle":
      return startlePose(t, opts);
  }
}

// ── Eased, interruptible transitions ────────────────────────────

/**
 * Immutable pose track: the current kind plus the (still fading) track it
 * replaced. Store it on the character; replace it via `switchPose`.
 */
export interface PoseTrack {
  readonly kind: CharacterPoseKind;
  /** Pose-clock origin: t = now - start. */
  readonly start: number;
  /** When the cross-fade from `from` began and how long it lasts (s). */
  readonly blendStart: number;
  readonly blendDur: number;
  readonly from: PoseTrack | null;
  /**
   * Frozen pose standing in for a collapsed (too deep) part of the chain, so
   * very fast switching never pops. Normally absent.
   */
  readonly snapshot?: CharacterPose;
}

const MAX_TRACK_DEPTH = 6;

export function poseTrack(kind: CharacterPoseKind, now: number): PoseTrack {
  return { kind, start: now, blendStart: now, blendDur: 0, from: null };
}

/**
 * Default cross-fade length between two kinds (s). Leaving "sit" / "lie"
 * plays the stand-up / get-up (SIT_EXIT_DURATION / LIE_EXIT_DURATION);
 * entering them is short because their own clock starts from standing.
 */
export function transitionDuration(from: CharacterPoseKind, to: CharacterPoseKind): number {
  if (from === "lie") return LIE_EXIT_DURATION;
  if (from === "sit") return SIT_EXIT_DURATION;
  if (to === "sit" || to === "lie") return 0.4;
  if (from === "crouch" || to === "crouch") return 0.35;
  // Hands onto / off the rungs.
  if (from === "climb" || to === "climb") return 0.45;
  // Big arm poses need a little longer to come down into the reach.
  if (to === "interact") return from === "wave" || from === "celebrate" ? 0.3 : 0.2;
  // Throwing an arm overhead: a little longer.
  if (to === "celebrate" || to === "wave") return 0.4;
  return 0.3;
}

/** Kinds whose exit is a choreography (stand up / get up) rather than a cross-fade. */
function isSeatKind(k: CharacterPoseKind): boolean {
  return k === "sit" || k === "lie";
}

/** Eased weight (0..1) of `track.kind` over its predecessor at `now`. */
export function trackWeight(track: PoseTrack, now: number): number {
  if (!track.from || track.blendDur <= 0) return 1;
  return easeInOut((now - track.blendStart) / track.blendDur);
}

function pruneTrack(track: PoseTrack, now: number, depth: number): PoseTrack {
  if (!track.from || track.snapshot) return track;
  if (trackWeight(track, now) >= 1) return { ...track, from: null };
  // Too deep: freeze the rest of the chain as it looks right now.
  if (depth <= 1) return { ...track, from: null, blendDur: 0, snapshot: sampleTrack(track, now) };
  return { ...track, from: pruneTrack(track.from, now, depth - 1) };
}

/**
 * Switch to `kind` at `now`, cross-fading (eased) from whatever is showing —
 * including a half-finished earlier fade. Same kind → the track is returned
 * unchanged (use `restartPose` to replay a one-shot).
 */
export function switchPose(
  track: PoseTrack,
  kind: CharacterPoseKind,
  now: number,
  dur: number = transitionDuration(track.kind, kind),
): PoseTrack {
  if (kind === track.kind) return track;
  return restartPose(track, kind, now, dur);
}

/** Like `switchPose`, but always restarts the pose clock (replay "interact", "crouch", "wave"). */
export function restartPose(
  track: PoseTrack,
  kind: CharacterPoseKind,
  now: number,
  dur: number = transitionDuration(track.kind, kind),
): PoseTrack {
  return {
    kind,
    start: now,
    blendStart: now,
    blendDur: Math.max(0, dur),
    from: pruneTrack(track, now, MAX_TRACK_DEPTH - 1),
  };
}

/** True once a one-shot kind has played out (then switch back to "idle"). */
export function isPoseDone(track: PoseTrack, now: number): boolean {
  const d = ONE_SHOT_POSES[track.kind];
  return d !== undefined && now - track.start >= d;
}

/** Pose of a track at `now` (cross-fades evaluated recursively, all clocks keep running). */
export function sampleTrack(
  track: PoseTrack,
  now: number,
  speed = 0,
  opts: PoseOptions = {},
): CharacterPose {
  if (track.snapshot) return blendPose(track.snapshot, track.snapshot, 0);
  const cur = characterPose(track.kind, now - track.start, speed, opts);
  if (!track.from) return cur;
  const w = trackWeight(track, now);
  if (w >= 1) return cur;
  const from = track.from;
  if (isSeatKind(from.kind) && !from.snapshot && track.blendDur > 0) {
    // Stand up / get up first, then ease into the new kind.
    const u = clamp((now - track.blendStart) / track.blendDur, 0, 1);
    let leaving = seatExit(from, track.blendStart, now, u, opts);
    // The seat kind may itself still have been fading in: keep that fade.
    const wf = trackWeight(from, now);
    if (from.from && wf < 1)
      leaving = blendPose(sampleTrack(from.from, now, speed, opts), leaving, wf);
    return blendPose(leaving, cur, smoothstep(0.72, 1, u));
  }
  return blendPose(sampleTrack(from, now, speed, opts), cur, w);
}

/**
 * Lay locomotion over an activity pose. walkW 0 → `upper`, 1 → `gait`; kinds
 * that hold something or gesture (carry, drink, read, listen, talk, think,
 * wave) keep their arms and most of the head while the legs walk.
 */
export function blendLocomotion(
  upper: CharacterPose,
  gait: CharacterPose,
  walkW: number,
  kind: CharacterPoseKind,
): CharacterPose {
  const w = clamp(walkW, 0, 1);
  const out = blendPose(upper, gait, w);
  if (ARM_KINDS.has(kind)) {
    for (const n of ["upperArmR", "upperArmL", "forearmR", "forearmL"] as const)
      out[n] = blendPart(upper[n], gait[n], 0.15 * w);
    out.head = blendPart(upper.head, gait.head, 0.5 * w);
  }
  out.brows = { ...upper.brows };
  return out;
}

/**
 * Next `idleFor` (seconds standing still) for `animateCharacter`. It keeps
 * counting after the character starts moving until the walk has fully taken
 * over (walkW ≈ 1), so a running idle fidget fades out with the locomotion
 * blend instead of vanishing in one frame.
 */
export function advanceIdle(idleFor: number, dt: number, moving: boolean, walkW: number): number {
  if (moving && walkW > 0.97) return 0;
  return idleFor + Math.max(0, dt);
}

/**
 * Frame-rate independent exponential approach of `current` to `target`
 * (`rate` ≈ 1 / time constant). Use it for walkW and for the walker speed fed
 * into `advanceGait` / `animateCharacter` so run ↔ walk ↔ stop stay smooth.
 */
export function approach(current: number, target: number, dt: number, rate = 8): number {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * rate));
}

export interface CharacterAnimInput {
  track: PoseTrack;
  /** Engine clock (s). */
  now: number;
  /** Gait phase in cycles (`advanceGait`). */
  gaitPhase: number;
  /** Walker speed (world units / s), smoothed with `approach`; above WALK_FULL_SPEED it runs. */
  speed: number;
  /** 0 standing … 1 walking (the engine's smoothed locomotion weight). */
  walkW: number;
  /** Seconds since the character last moved (idle fidgets); count it with `advanceIdle`. */
  idleFor?: number;
  seed?: number;
  /**
   * Head turn towards something (a device that is running nearby): `yaw` is
   * relative to the body (`lookYaw`), `weight` 0..1 — smooth both in the caller.
   */
  look?: { yaw: number; weight: number };
  /** Cold 0..1 (deep floors, standing long): arms hugged, shiver bursts. Smooth it in the caller. */
  chill?: number;
  /**
   * Vertical cage acceleration −1..1 while riding: > 0 presses into the
   * knees (braking on the way down / starting up), < 0 goes light (hair lifts).
   */
  load?: number;
  /** Cage rattle 0..1 (travel speed): a fine tremor through torso and head. */
  rattle?: number;
  /** Seat under a "sit" pose (height above the floor etc., see `sitFit`). */
  seat?: SeatSpec;
  /**
   * Smoothed forward acceleration of the walker (world units / s²): > 0
   * leans into a start, < 0 sits back into a stop. Optional.
   */
  accel?: number;
  /**
   * Smoothed turn rate of the facing (rad / s, + = the walker's facing
   * angle growing, i.e. turning to her left): banks into the curve. Optional.
   */
  turnRate?: number;
}

/** Largest head + torso turn for `look` (rad). */
export const HEAD_LOOK_MAX = 1.1;
/** Devices further away than this (world units) are not looked at. */
export const LOOK_RADIUS = 6;
/** Floors cold enough to shiver on (Tiefenlabor, Bohrschacht). */
export const COLD_FLOORS: readonly number[] = [3, 5];
/** Seconds standing still on a cold floor before the shivering starts. */
export const CHILL_DELAY = 10;

/** Angle wrapped into [−π, π). */
export function wrapAngle(a: number): number {
  return mod(a + Math.PI, TAU) - Math.PI;
}

/** `approach` for angles: always turns the short way round. */
export function approachAngle(current: number, target: number, dt: number, rate = 8): number {
  return wrapAngle(current + wrapAngle(target - current) * (1 - Math.exp(-Math.max(0, dt) * rate)));
}

/**
 * Head yaw (rad, relative to the body) that looks from a character facing
 * `facing` (the walker convention: atan2(x, z)) towards the offset (dx, dz);
 * clamped to ±HEAD_LOOK_MAX. Null when the target is behind the shoulders.
 */
export function lookYaw(facing: number, dx: number, dz: number): number | null {
  if (dx === 0 && dz === 0) return null;
  const rel = wrapAngle(Math.atan2(dx, dz) - facing);
  if (Math.abs(rel) > 2.1) return null;
  return clamp(rel, -HEAD_LOOK_MAX, HEAD_LOOK_MAX);
}

export interface CageMotion {
  /** Last platform offset seen (world units). */
  offset: number;
  /** Platform velocity (units / s). */
  vel: number;
  /** Raw vertical acceleration mapped to −1..1 (smooth it before `animateCharacter`). */
  load: number;
}

/**
 * Step the cage motion estimate from the platform offset. The offset flips
 * sign when the floor switches at the midpoint — a jump of a unit or more in
 * one frame keeps the previous velocity and reports no load.
 */
export function cageMotion(prev: CageMotion, offset: number, dt: number): CageMotion {
  const d = offset - prev.offset;
  if (!(dt > 0) || Math.abs(d) >= 1) return { offset, vel: prev.vel, load: 0 };
  const vel = d / dt;
  return { offset, vel, load: clamp((vel - prev.vel) / dt / 10, -1, 1) };
}

/** Target chill (0 or 1): cold floor, plain idle, still for CHILL_DELAY seconds. */
export function chillTarget(floor: number, idleFor: number, kind: CharacterPoseKind): number {
  return COLD_FLOORS.includes(floor) && kind === "idle" && idleFor >= CHILL_DELAY ? 1 : 0;
}

/** Arms hugged round the chest, shoulders up, shivers in bursts. */
function applyChill(p: CharacterPose, now: number, w: number): void {
  add(p, "upperArmR", [-0.45, 0.3, 0.34], [0, 0.45, 0], w);
  add(p, "upperArmL", [-0.45, -0.3, -0.34], [0, 0.45, 0], w);
  add(p, "forearmR", [-1.75, 0.5, 0.28], undefined, w);
  add(p, "forearmL", [-1.75, -0.5, -0.28], undefined, w);
  add(p, "torso", [0.07, 0, 0], undefined, w);
  add(p, "head", [0.1, 0, 0], undefined, w);
  const burst = plateau(mod(now, 4.6), 0.6, 2.6, 0.45);
  const s = 0.6 * Math.sin(TAU * 9.5 * now) + 0.4 * Math.sin(TAU * 12.7 * now + 1.1);
  const k = w * burst;
  add(p, "torso", [0, 0.012 * s, 0.018 * s], undefined, k);
  add(p, "head", [0.01 * s, 0, -0.02 * s], undefined, k);
  add(p, "upperArmR", [0, 0, 0], [0.08 * s, 0.1 * s, 0], k);
  add(p, "upperArmL", [0, 0, 0], [-0.08 * s, 0.1 * s, 0], k);
  add(p, "shinR", [0.04 * s, 0, 0], undefined, k);
  add(p, "shinL", [-0.04 * s, 0, 0], undefined, k);
}

/** Cage acceleration and rattle on top of the ride pose. */
function applyCage(p: CharacterPose, now: number, load: number, rattle: number): void {
  const press = Math.max(0, load);
  const light = Math.max(0, -load);
  add(p, "hips", [0, 0, 0], [0, -0.3 * press + 0.2 * light, 0]);
  add(p, "thighR", [-0.16 * press, 0, 0]);
  add(p, "thighL", [-0.16 * press, 0, 0]);
  add(p, "shinR", [0.32 * press, 0, 0]);
  add(p, "shinL", [0.32 * press, 0, 0]);
  add(p, "torso", [0.05 * press - 0.02 * light, 0, 0]);
  add(p, "head", [0.06 * press - 0.08 * light, 0, 0]);
  add(p, "hairBack", [0.3 * light - 0.08 * press, 0, 0]);
  add(p, "coatTail", [0.25 * light, 0, 0]);
  add(p, "upperArmL", [0, 0, 0.12 * light]);
  const r = clamp(rattle, 0, 1);
  add(p, "torso", [0, 0, 0.02 * Math.sin(TAU * 7.3 * now)], undefined, r);
  add(p, "head", [0, 0, 0.015 * Math.sin(TAU * 5.1 * now + 0.7)], undefined, r);
  add(p, "hips", [0, 0, 0], [0.08 * Math.sin(TAU * 6.2 * now), 0, 0], r);
}

/**
 * Everything in one call: the eased activity track, phase-coherent walk/run
 * locomotion on top, and blinks on the global clock (so they keep going
 * while walking and never restart on a pose switch).
 */
export function animateCharacter(i: CharacterAnimInput): CharacterPose {
  const seed = i.seed ?? 0;
  const opts: PoseOptions = { seed };
  if (i.idleFor !== undefined) opts.idleFor = i.idleFor;
  if (i.seat) opts.seat = i.seat;
  const upper = sampleTrack(i.track, i.now, 0, opts);
  // The stride follows the real speed (planted feet, see gaitPose); walkW only
  // fades the whole locomotion layer in and out.
  const speed = Math.max(0, i.speed);
  const gait = gaitPose(i.gaitPhase, speed);
  const pose = i.walkW > 0 ? blendLocomotion(upper, gait, i.walkW, i.track.kind) : upper;
  const still = 1 - clamp(i.walkW, 0, 1);
  const moving = clamp(i.walkW, 0, 1);
  if (moving > 0 && (i.accel || i.turnRate)) {
    // Lean into acceleration (sit back when braking) and bank into turns
    // around the feet: the hips shift so the soles stay where they are.
    const lean = clamp((i.accel ?? 0) / 90, -0.12, 0.16) * moving;
    add(pose, "torso", [lean, 0, 0]);
    add(pose, "head", [-0.5 * lean, 0, 0]);
    const bank =
      clamp(-(i.turnRate ?? 0) * 0.035 * clamp(speed / WALK_FULL_SPEED, 0, 1.5), -0.14, 0.14) *
      moving;
    const hipY = HIP_Y + (pose.hips.pos?.[1] ?? 0);
    add(pose, "hips", [0, 0, bank], [(-hipY * Math.sin(bank)) / RIG_UNIT, 0, 0]);
    add(pose, "head", [0, 0, -0.6 * bank]);
  }
  if (i.look && i.look.weight > 0) {
    const w = clamp(i.look.weight, 0, 1) * (1 - 0.6 * (1 - still));
    const yaw = clamp(i.look.yaw, -HEAD_LOOK_MAX, HEAD_LOOK_MAX) * w;
    add(pose, "torso", [0, 0.3 * yaw, 0]);
    add(pose, "head", [0, 0.7 * yaw, 0.05 * yaw]);
  }
  const chill = clamp(i.chill ?? 0, 0, 1) * still;
  if (chill > 0) applyChill(pose, i.now, chill);
  if (i.load || i.rattle) applyCage(pose, i.now, clamp(i.load ?? 0, -1, 1), i.rattle ?? 0);
  // Blinks run on the global clock; resting eyes (lying down) stay shut on top.
  const shut =
    i.track.kind === "lie" ? (upper.lids.pos?.[2] ?? 0) * trackWeight(i.track, i.now) : 0;
  pose.lids = {
    rot: [0, 0, 0],
    pos: [0, 0, Math.max(LID_TRAVEL * blinkAmount(i.now, seed), shut)],
  };
  return pose;
}

// ── Hand props ──────────────────────────────────────────────────

export type HandPropKind = "mug" | "book" | "crate" | "wrench";

export interface HandProp {
  kind: HandPropKind;
  model: Model;
  /** Joint group the prop mesh is parented to. */
  joint: RigPartName;
  /**
   * Where the prop's voxel corner (0,0,0) sits in that joint's local frame
   * (rig voxels) — i.e. `mesh.position` inside the joint group.
   */
  anchor: Vec3;
  /** Rig voxels per prop voxel (props are modelled at pose-unit size: RIG_UNIT). */
  scale: number;
}

/** Which prop a pose shows (null → none). */
export const POSE_PROPS: Readonly<Partial<Record<CharacterPoseKind, HandPropKind>>> = {
  drink: "mug",
  read: "book",
  carry: "crate",
  work: "wrench",
};

export function propForPose(kind: CharacterPoseKind): HandPropKind | null {
  return POSE_PROPS[kind] ?? null;
}

/** Prop of whichever kind dominates the track at `now` (hide the others). */
export function activeProp(track: PoseTrack, now: number): HandPropKind | null {
  if (track.from && trackWeight(track, now) < 0.5) return activeProp(track.from, now);
  return propForPose(track.kind);
}

/** Mug (right hand): axis along the forearm's local +z, i.e. upright while the forearm is level. */
function mugModel(): Model {
  const m = new Model(3, 3, 3);
  m.box(0, 0, 0, 2, 2, 2, C.ceramic);
  m.set(1, 1, 2, C.coffee);
  m.set(1, 0, 1, C.safety_red); // lab logo
  m.set(1, 2, 1, C.paint_white).set(1, 2, 0, C.paint_white);
  return m;
}

/** Open book lying flat (pages up), spine along z. */
function bookModel(): Model {
  const m = new Model(7, 2, 5);
  m.box(0, 0, 0, 6, 0, 4, C.book_red);
  m.box(0, 1, 0, 2, 1, 4, C.paper).box(4, 1, 0, 6, 1, 4, C.paper);
  m.box(3, 1, 0, 3, 1, 4, C.book_red);
  for (const z of [1, 3]) m.set(1, 1, z, C.paint_gray).set(5, 1, z, C.paint_gray);
  m.set(2, 1, 2, C.paint_gray).set(4, 1, 2, C.paper_yellow);
  return m;
}

/** Cardboard crate with tape and a hazard label. */
function crateModel(): Model {
  const m = new Model(9, 5, 5);
  m.box(0, 0, 0, 8, 4, 4, C.cardboard);
  m.box(4, 4, 0, 4, 4, 4, C.paper_yellow).box(4, 0, 4, 4, 4, 4, C.paper_yellow);
  m.box(1, 1, 4, 2, 2, 4, C.safety_yellow).set(1, 2, 4, C.hazard_black);
  m.box(6, 2, 4, 7, 2, 4, C.paint_black).set(6, 3, 4, C.paint_black); // "this side up"
  m.box(0, 4, 0, 8, 4, 0, C.wood_light);
  return m;
}

/** Open-end wrench along the forearm's local -y (jaw at the bottom). */
function wrenchModel(): Model {
  const m = new Model(3, 7, 1);
  m.box(1, 2, 0, 1, 6, 0, C.steel);
  m.box(0, 0, 0, 2, 1, 0, C.chrome);
  m.set(1, 0, 0, 0);
  m.set(1, 5, 0, C.safety_red).set(1, 6, 0, C.safety_red); // grip
  return m;
}

/** Build a hand prop (fresh model each call). */
export function handProp(kind: HandPropKind): HandProp {
  switch (kind) {
    case "mug":
      return {
        kind,
        model: mugModel(),
        joint: "forearmR",
        anchor: [0.9, -11.2, -2.8],
        scale: RIG_UNIT,
      };
    case "book":
      return {
        kind,
        model: bookModel(),
        joint: "torso",
        anchor: [-7, 7.2, 8.4],
        scale: RIG_UNIT,
      };
    case "crate":
      return {
        kind,
        model: crateModel(),
        joint: "torso",
        anchor: [-9, 2.4, 7.4],
        scale: RIG_UNIT,
      };
    case "wrench":
      return {
        kind,
        model: wrenchModel(),
        joint: "forearmR",
        anchor: [-2.8, -16.8, -0.8],
        scale: RIG_UNIT,
      };
  }
}

/** Voxel centres of a prop in character space for a posed rig (tests / debugging). */
export function propVoxels(
  def: CharacterRigDef,
  prop: HandProp,
  pose?: Partial<CharacterPose>,
): Vec3[] {
  const j = jointMatrices(def, pose).get(prop.joint);
  if (!j) return [];
  const out: Vec3[] = [];
  const [ax, ay, az] = prop.anchor;
  const k = prop.scale;
  prop.model.grid.forEach((x, y, z) => {
    out.push(applyMat(j, [(x + 0.5) * k + ax, (y + 0.5) * k + ay, (z + 0.5) * k + az]));
  });
  return out;
}

// ── Decor verbs → poses ─────────────────────────────────────────

const TYPING_DECOR = /terminal|keyboard|synth|console|computer|laptop|typewriter|pc\b/;

/**
 * Pose for a decor action verb (see `content/decor-actions.ts`):
 * trinken → drink, lesen → read, hören → listen, sitzen → sit, liegen → lie,
 * ansehen → think, benutzen → typing at keyboards / synths / terminals, else work.
 */
export function poseForDecorVerb(verb: string, decorId = ""): CharacterPoseKind {
  switch (verb) {
    case "trinken":
      return "drink";
    case "lesen":
      return "read";
    case "hören": // i18n-ignore (verb id)
      return "listen";
    case "sitzen":
      return "sit";
    case "liegen":
      return "lie";
    case "ansehen":
      return "think";
    case "benutzen":
      return TYPING_DECOR.test(decorId) ? "typing" : "work";
    default:
      return "interact";
  }
}

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
 *  - `gaitPose` / `advanceGait` — phase-coherent walk ↔ run locomotion;
 *  - `PoseTrack` (`poseTrack`, `switchPose`, `sampleTrack`) — eased,
 *    interruptible cross-fades between kinds;
 *  - `animateCharacter` — track + locomotion + blinks in one call;
 *  - `handProp` / `propForPose` — mugs, books, crates, wrenches to attach.
 */
import { C } from "@/lib/world/content/palette";
import type { Vec3 } from "@/lib/world/models/anim";
import { Model } from "@/lib/world/models/core";

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
  id: "jade" | "damien" | "damien_holo";
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
  | "startle";

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
];

/**
 * World units per voxel for humanoids (Jade ≈ 62 voxels ≈ 5.6 units). Fine
 * scale: half the old edge with twice the voxels per axis (see RIG_UNIT);
 * the rigs are flagged `fine` and meshed as authored.
 */
export const CHARACTER_SCALE = 0.09;
/** Walk cadence (full cycles per second, i.e. two steps). `characterPose("walk")` is periodic in 1 / WALK_HZ. */
export const WALK_HZ = 1.8;
/** Walker speed (world units / s) that maps to a full-stride walk. */
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

const JADE_OUTFIT: Outfit = {
  pants: C.pants_dark,
  fold: C.carpet_blue,
  gap: C.hair_black,
  boot: C.leather,
  bootDark: C.walnut,
  sole: C.rubber,
  lace: C.leather_worn,
};

/** Hips (w16 h6 d10): trousers under the open coat, belt with a brass buckle, tools on the belt. */
function jadeHips(): Model {
  const m = new Model(16, 6, 10);
  m.box(0, 0, 0, 15, 3, 9, C.pants_dark);
  roundEdges(m, 0, 15, 0, 9, 0, 3);
  // Coat shell: sides and back, open front panels.
  m.box(0, 0, 1, 1, 3, 8, C.coat_white).box(14, 0, 1, 15, 3, 8, C.coat_white);
  m.box(1, 0, 0, 14, 3, 1, C.coat_white);
  m.box(2, 0, 8, 3, 3, 9, C.coat_white).box(12, 0, 8, 13, 3, 9, C.coat_white);
  m.box(3, 0, 9, 3, 3, 9, C.coat_shadow).box(12, 0, 9, 12, 3, 9, C.coat_shadow);
  // Belt, buckle, belt loops.
  m.box(4, 2, 9, 11, 3, 9, C.leather_black);
  m.box(7, 2, 9, 8, 3, 9, C.brass).set(7, 3, 9, C.gold);
  m.set(5, 3, 9, C.pants_dark).set(10, 3, 9, C.pants_dark);
  // Fly fold, a tape measure and a key carabiner.
  m.box(7, 0, 9, 7, 1, 9, C.carpet_blue);
  m.box(10, 0, 9, 11, 1, 9, C.safety_yellow).set(11, 1, 9, C.paint_black);
  m.box(4, 0, 9, 4, 1, 9, C.steel).set(5, 0, 9, C.chrome);
  // Back vent of the coat.
  m.box(7, 0, 0, 8, 3, 0, C.coat_shadow);
  m.box(2, 4, 2, 13, 5, 7, C.sweater_teal);
  return m;
}

/**
 * Torso (w16 h16 d12): the open lab coat over a teal cable-knit sweater,
 * folded lapels, the "J. LAWRENCE" badge with photo on the right chest, a
 * breast pocket with pens, a film dosimeter on the left lapel, back seam
 * and yoke, rounded shoulders.
 */
function jadeTorso(): Model {
  const m = new Model(16, 16, 12);
  m.box(0, 0, 0, 15, 15, 9, C.coat_white);
  roundEdges(m, 0, 15, 0, 9, 0, 15);
  // Shoulders slope into the arms.
  m.box(0, 15, 0, 1, 15, 9, 0).box(14, 15, 0, 15, 15, 9, 0);
  m.box(0, 14, 0, 0, 14, 9, 0).box(15, 14, 0, 15, 14, 9, 0);
  // Open coat over the sweater: a narrow strip low, a V widening at the lapels.
  for (let y = 0; y <= 15; y++) {
    const [a, b] = y <= 9 ? [6, 9] : y === 10 ? [5, 10] : [4, 11];
    m.box(a, y, 9, b, y, 9, C.sweater_teal);
    m.set(a - 1, y, 9, C.coat_shadow).set(b + 1, y, 9, C.coat_shadow);
  }
  // Cable knit: two vertical cables and purl dots; the crew-neck rib.
  for (let y = 0; y <= 13; y++) {
    tint(m, 7, y, 9, y % 3 === 0 ? C.paint_teal : C.sweater_teal);
    tint(m, 8, y, 9, y % 3 === 1 ? C.paint_teal : C.sweater_teal);
  }
  for (let y = 11; y <= 13; y += 2) m.set(5, y, 9, C.paint_teal).set(10, y, 9, C.paint_teal);
  m.box(5, 14, 9, 10, 15, 9, C.paint_teal);
  m.box(6, 15, 8, 9, 15, 9, C.paint_teal);
  // Folded lapels stand proud of the chest.
  for (let y = 10; y <= 15; y++) {
    const w = y >= 13 ? 2 : 1;
    m.box(4 - w, y, 10, 3, y, 10, C.coat_white).box(12, y, 10, 11 + w, y, 10, C.coat_white);
  }
  m.box(1, 10, 10, 3, 10, 10, C.coat_shadow).box(12, 10, 10, 14, 10, 10, C.coat_shadow);
  m.set(3, 14, 10, 0).set(12, 14, 10, 0);
  // ID badge "J. LAWRENCE" on the right chest: clip, blue header, photo, name lines.
  m.box(0, 3, 10, 3, 9, 10, C.paper);
  m.box(0, 8, 10, 3, 9, 10, C.badge_blue);
  m.set(1, 9, 10, C.paper).set(2, 9, 10, C.paper);
  m.box(0, 5, 10, 1, 7, 10, C.skin);
  m.set(0, 7, 10, C.hair_auburn).set(1, 7, 10, C.hair_auburn);
  m.set(2, 7, 10, C.paint_black).set(3, 6, 10, C.paint_black).set(2, 5, 10, C.paint_black);
  m.box(0, 4, 10, 3, 4, 10, C.paint_black);
  m.set(1, 3, 10, C.paint_black).set(3, 3, 10, C.paint_black);
  m.box(1, 10, 10, 2, 11, 10, C.steel);
  // Breast pocket with pens on the left chest.
  m.box(11, 2, 9, 14, 2, 9, C.coat_shadow);
  m.box(11, 3, 9, 11, 6, 9, C.coat_shadow).box(14, 3, 9, 14, 6, 9, C.coat_shadow);
  m.box(11, 7, 9, 14, 7, 9, C.coat_shadow);
  m.box(12, 6, 10, 12, 8, 10, C.safety_blue).set(12, 6, 10, C.chrome);
  m.box(13, 6, 10, 13, 9, 10, C.safety_red).set(13, 6, 10, C.chrome).set(13, 9, 10, C.chrome);
  // Placket buttons, film dosimeter on the left lapel.
  m.set(5, 2, 9, C.steel).set(5, 6, 9, C.steel);
  m.box(12, 12, 11, 13, 13, 11, C.safety_yellow)
    .set(12, 11, 11, C.paint_black)
    .set(13, 11, 11, C.paint_black);
  // Back seam, yoke, a half belt with two buttons; sleeve-head seams.
  m.box(7, 0, 0, 8, 5, 0, C.coat_shadow);
  m.box(2, 12, 0, 13, 12, 0, C.coat_shadow);
  m.box(4, 4, 0, 11, 4, 0, C.coat_shadow);
  m.set(4, 4, 0, C.steel).set(11, 4, 0, C.steel);
  for (let z = 1; z <= 8; z++) {
    tint(m, 1, 13, z, C.coat_shadow);
    tint(m, 14, 13, z, C.coat_shadow);
  }
  // Folds under the arms.
  for (const [y, z] of [
    [9, 3],
    [8, 4],
    [5, 6],
  ] as const) {
    tint(m, 0, y, z, C.coat_shadow);
    tint(m, 15, y, z, C.coat_shadow);
  }
  return m;
}

/** Face mask for Jade's hair: true where skin shows (face, ears, neck). */
function jadeFace(x: number, y: number, z: number): boolean {
  if (y <= 2) return true;
  // Fringe sweeps across the forehead towards her left (+x).
  if (y >= 14) return false;
  if (y === 13) return z >= 11 && x <= 5;
  // Right side: hair tucked behind the ear shows the ear and temple.
  if (x <= 2) return z >= 7 && y <= 12;
  // Left side: the jaw-length curtain.
  if (x >= 12) return false;
  if (x === 11) return z >= 12 && y <= 10;
  return z >= 10;
}

function jadeHead(): Model {
  const H = C.hair_auburn;
  const DARK = C.wood_red;
  const LIGHT = C.rust;
  const m = headVolume(C.skin, C.skin_shadow);
  hairShell(m, jadeFace, (x, y, z) => {
    // Strands: colour runs in 3-row locks, lighter towards the crown.
    const n = hash01(x * 13 + z * 7, Math.floor((y + x) / 3));
    return n < 0.2 ? DARK : n > (y > 13 ? 0.72 : 0.86) ? LIGHT : H;
  });
  capHead(m);
  // Face: cheeks, eyes, nose, mouth, chin.
  const face: readonly string[] = [
    // x 2..11, rows 12 (top) … 2 (bottom); z = 13 (x 2 / 11 at z 12).
    "..........",
    "LLLL..LLLL", // 10: lash line
    "WGGW..WGGW", // 9
    "WGPW..WPGW", // 8
    "....SS....", // 7: nose bridge shading
    ".b..NN..b.", // 6: blush, nose
    "....ss....", // 5: nostrils
    "..sMMMMs..", // 4: mouth
    "...lMMl...", // 3: lower lip
    "..........", // 2
  ];
  const pal: Record<string, number> = {
    L: C.walnut_dk,
    W: C.eye_white,
    G: C.eye_green,
    P: C.hair_black,
    S: C.skin_light,
    N: C.skin,
    s: C.skin_shadow,
    M: C.lips,
    l: C.skin_light,
    b: C.paper_pink,
  };
  face.forEach((row, r) => {
    const y = 11 - r;
    for (let k = 0; k < row.length; k++) {
      const c = pal[row[k]!];
      if (!c) continue;
      const x = 2 + k;
      const z = m.grid.get(x, y, 13) ? 13 : 12;
      m.set(x, y, z, c);
    }
  });
  // Nose tip and bridge stand proud.
  m.box(6, 5, 14, 7, 7, 14, C.skin).set(6, 5, 14, C.skin_shadow).set(7, 5, 14, C.skin_shadow);
  m.set(6, 7, 14, C.skin_light);
  // Jaw shading under the chin.
  for (let x = 4; x <= 9; x++) tint(m, x, 2, 11, C.skin_shadow);
  // Right ear, the pencil behind it and a small gold stud.
  m.box(1, 7, 7, 1, 9, 8, C.skin).set(1, 8, 7, C.skin_shadow);
  m.box(0, 10, 5, 0, 10, 10, C.paper_yellow)
    .set(0, 10, 11, C.paper_pink)
    .set(0, 10, 4, C.wood_light);
  m.set(1, 6, 8, C.gold);
  // Loose strands: down the left temple and over the jaw, a flyaway on the crown.
  m.box(12, 3, 13, 12, 9, 13, DARK).set(13, 4, 12, DARK).set(11, 10, 14, DARK);
  m.set(6, 17, 14, LIGHT).set(7, 17, 13, LIGHT);
  m.box(8, 13, 13, 10, 13, 14, H).set(11, 12, 14, H).set(9, 12, 14, DARK);
  // Amber goggles pushed up on the forehead: frames, lenses (solid, non-glowing), bridge, strap.
  for (const x0 of [2, 8]) {
    m.box(x0, 14, 14, x0 + 3, 16, 14, C.goggles);
    m.box(x0 + 1, 14, 15, x0 + 2, 16, 15, C.fabric_mustard);
    m.set(x0 + 1, 16, 15, C.paper_yellow);
    m.box(x0, 15, 15, x0, 15, 15, C.goggles).box(x0 + 3, 15, 15, x0 + 3, 15, 15, C.goggles);
  }
  m.box(6, 15, 14, 7, 15, 14, C.door_frame_dk);
  // Strap round the head, just under the crown.
  for (let z = 1; z <= 13; z++) {
    tint(m, 1, 15, z, C.leather_black);
    tint(m, 12, 15, z, C.leather_black);
  }
  for (let x = 2; x <= 11; x++) tint(m, x, 15, 1, C.leather_black);
  return m;
}

/** Brows (w10 h2 d2): arched, tapered tails. */
function jadeBrows(): Model {
  const m = new Model(10, 2, 2);
  m.box(1, 1, 0, 3, 1, 1, C.wood_red).set(0, 0, 1, C.hair_auburn).set(0, 0, 0, C.wood_red);
  m.box(6, 1, 0, 8, 1, 1, C.wood_red).set(9, 0, 1, C.hair_auburn).set(9, 0, 0, C.wood_red);
  m.set(3, 0, 1, C.wood_red).set(6, 0, 1, C.wood_red);
  return m;
}

/** Low ponytail with a teal tie (w6 h12 d4), hanging from the back of the head. */
function jadePonytail(): Model {
  const m = new Model(6, 12, 4);
  m.box(1, 10, 0, 4, 11, 3, C.sweater_teal).set(1, 11, 0, C.paint_teal).set(4, 10, 3, C.paint_teal);
  m.box(0, 6, 0, 5, 9, 3, C.hair_auburn);
  m.box(1, 2, 0, 4, 5, 3, C.hair_auburn);
  m.box(2, 0, 1, 3, 1, 2, C.hair_auburn);
  roundEdges(m, 0, 5, 0, 3, 6, 9);
  roundEdges(m, 1, 4, 0, 3, 2, 5);
  for (let y = 0; y <= 9; y++)
    for (let x = 0; x < 6; x++)
      for (let z = 0; z < 4; z++) {
        const s = (x * 5 + z * 3) % 4;
        if (m.grid.get(x, y, z) && s === 0) m.set(x, y, z, y % 3 ? C.wood_red : C.rust);
      }
  m.set(5, 4, 2, C.wood_red).set(5, 3, 2, C.wood_red); // stray strand escaping the tie
  return m;
}

/** Coat skirt below the hips (w20 h8 d14): sides, back and front edges, flared hem, pockets. */
function jadeCoatTail(): Model {
  const m = new Model(20, 8, 14);
  // Flare: the hem (rows 0..1) is one voxel wider than the top.
  m.box(2, 2, 2, 17, 7, 3, C.coat_white);
  m.box(2, 2, 2, 3, 7, 11, C.coat_white).box(16, 2, 2, 17, 7, 11, C.coat_white);
  m.box(1, 0, 1, 18, 1, 2, C.coat_white);
  m.box(1, 0, 1, 2, 1, 12, C.coat_white).box(17, 0, 1, 18, 1, 12, C.coat_white);
  m.box(3, 0, 12, 3, 1, 12, C.coat_white).box(16, 0, 12, 16, 1, 12, C.coat_white);
  // Hip pockets with flaps on the sides, the back vent, fold shading on the hem.
  m.box(1, 4, 6, 1, 6, 9, C.coat_shadow).box(1, 6, 5, 1, 6, 10, C.coat_white);
  m.box(18, 4, 6, 18, 6, 9, C.coat_shadow).box(18, 6, 5, 18, 6, 10, C.coat_white);
  m.box(9, 0, 1, 10, 4, 1, 0);
  m.box(9, 2, 2, 10, 4, 2, C.coat_shadow);
  for (const z of [4, 8]) {
    tint(m, 1, 0, z, C.coat_shadow);
    tint(m, 18, 0, z, C.coat_shadow);
  }
  for (const x of [5, 13]) tint(m, x, 0, 1, C.coat_shadow);
  // Hem wear: scuffed grime at the back, a torn corner, a scorch by the vent.
  m.set(4, 0, 1, C.grime).set(6, 0, 1, C.dust).set(14, 0, 1, C.grime).set(1, 0, 10, C.grime);
  m.set(12, 0, 1, C.dust);
  m.box(18, 0, 1, 18, 0, 2, 0);
  m.set(12, 2, 2, C.grime).set(11, 3, 2, C.grime);
  // Screwdriver in the right hip pocket, handle sticking out.
  m.box(1, 6, 7, 1, 7, 7, C.steel).box(0, 6, 7, 0, 7, 7, C.safety_yellow);
  m.set(0, 7, 7, C.paint_black);
  // Blue nitrile glove poking out of the left hip pocket.
  m.box(18, 6, 8, 19, 7, 8, C.paint_sky).set(19, 5, 8, C.safety_blue).set(19, 6, 9, C.paint_sky);
  return m;
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

const JADE_ARMS: ArmStyle = {
  sleeve: C.coat_white,
  shade: C.coat_shadow,
  cuff: C.coat_shadow,
  wrist: C.sweater_teal,
  wristShade: C.paint_teal,
  skin: C.skin,
  skinShade: C.skin_shadow,
};

function jadeArms(): [Model, Model, Model] {
  return [
    upperArm(JADE_ARMS, true),
    forearm(JADE_ARMS, null),
    mirrorX(forearm(JADE_ARMS, C.screen_cyan)),
  ];
}

/** Jade Lawrence: lab coat, teal sweater, amber goggles, auburn ponytail. */
export function jadeRig(): CharacterRigDef {
  const s = CHARACTER_SCALE;
  const [up, fore, foreL] = jadeArms();
  const parts: RigPart[] = [
    {
      name: "hips",
      model: jadeHips(),
      parent: null,
      pivot: [0, HIP_Y, 0],
      origin: [8, 0, 5],
      scale: s,
    },
    {
      name: "torso",
      model: jadeTorso(),
      parent: "hips",
      pivot: [8, 4, 5],
      origin: [8, 0, 5],
      scale: s,
    },
    {
      name: "head",
      model: jadeHead(),
      parent: "torso",
      pivot: [8, 16, 5],
      origin: [7, 0, 7],
      scale: s,
    },
    {
      name: "hairBack",
      model: jadePonytail(),
      parent: "head",
      pivot: [7, 11, 0],
      origin: [3, 12, 4],
      scale: s,
    },
    ...faceParts(jadeBrows(), C.skin_shadow, C.walnut_dk, s),
    ...limbs(up, fore, JADE_OUTFIT, 16, 16, 15, s, foreL),
    {
      name: "coatTail",
      model: jadeCoatTail(),
      parent: "hips",
      pivot: [8, 0, 1],
      origin: [10, 8, 3],
      scale: s,
    },
  ];
  return { id: "jade", parts, scale: s, hologram: false, fine: true };
}

// ── Damien Fridge ───────────────────────────────────────────────

const DAMIEN_OUTFIT: Outfit = {
  pants: C.fabric_gray,
  fold: C.concrete_dark,
  gap: C.pants_dark,
  boot: C.leather_black,
  bootDark: C.paint_black,
  sole: C.rubber,
  lace: C.leather,
};

/** Hips (w16 h6 d10): grey trousers, a brown leather belt, a notebook in the back pocket. */
function damienHips(): Model {
  const m = new Model(16, 6, 10);
  m.box(0, 0, 0, 15, 3, 9, C.fabric_gray);
  roundEdges(m, 0, 15, 0, 9, 0, 3);
  m.box(0, 2, 0, 15, 3, 9, C.leather);
  roundEdges(m, 0, 15, 0, 9, 2, 3);
  m.box(6, 2, 9, 9, 3, 9, C.brass).box(7, 2, 9, 8, 3, 9, C.leather_worn);
  m.set(2, 3, 9, C.walnut).set(13, 3, 9, C.walnut).set(2, 3, 0, C.walnut).set(13, 3, 0, C.walnut);
  m.box(7, 0, 9, 7, 1, 9, C.concrete_dark);
  m.box(2, 4, 2, 13, 5, 7, C.white);
  // Notebook in the back pocket, a pencil clipped to it.
  m.box(10, 0, 0, 13, 1, 0, C.fabric_gray_shade);
  m.box(10, 1, 0, 12, 2, 0, C.paper_yellow)
    .set(13, 2, 0, C.paper_yellow)
    .set(11, 2, 0, C.paint_black);
  return m;
}

/**
 * Torso (w16 h16 d12): brown waistcoat over a white shirt with an open
 * collar, brass buttons, welt pockets with a pocket-watch chain and a pen,
 * the back strap with its buckle.
 */
function damienTorso(): Model {
  const m = new Model(16, 16, 12);
  m.box(0, 0, 0, 15, 15, 9, C.vest_brown);
  roundEdges(m, 0, 15, 0, 9, 0, 15);
  m.box(0, 15, 0, 1, 15, 9, 0).box(14, 15, 0, 15, 15, 9, 0);
  m.box(0, 14, 0, 0, 14, 9, 0).box(15, 14, 0, 15, 14, 9, 0);
  // White shirt: shoulders and armholes, the open collar V with points.
  m.box(1, 13, 0, 3, 15, 9, C.white).box(12, 13, 0, 14, 15, 9, C.white);
  m.box(0, 11, 1, 0, 13, 8, C.white).box(15, 11, 1, 15, 13, 8, C.white);
  for (let y = 7; y <= 15; y++) {
    const half = y <= 10 ? 1 : y <= 12 ? 2 : 3;
    m.box(8 - half, y, 9, 7 + half, y, 9, C.white);
  }
  m.box(6, 13, 9, 9, 15, 9, C.skin).set(7, 15, 9, C.skin_shadow).set(8, 14, 9, C.skin_shadow);
  m.box(4, 14, 10, 5, 15, 10, C.white).box(10, 14, 10, 11, 15, 10, C.white);
  m.set(5, 13, 10, C.coat_shadow).set(10, 13, 10, C.coat_shadow);
  m.set(6, 12, 9, C.coat_shadow).set(9, 12, 9, C.coat_shadow);
  // Waistcoat: button line, brass buttons, points at the hem, welt pockets.
  for (let y = 0; y <= 6; y++) m.set(8, y, 9, C.wood_dark);
  for (const y of [1, 3, 5]) m.set(7, y, 10, C.brass);
  m.box(6, 0, 9, 9, 0, 9, 0).set(7, 0, 9, C.vest_brown).set(8, 0, 9, C.vest_brown);
  m.box(2, 4, 9, 5, 4, 9, C.walnut).box(10, 4, 9, 13, 4, 9, C.walnut);
  // Pocket-watch chain from the right pocket to a button, a pen clip and pencil in the left.
  for (let x = 8; x <= 12; x++) m.set(x, x % 2 ? 4 : 3, 10, C.gold);
  m.set(12, 5, 10, C.gold);
  m.box(3, 5, 10, 3, 6, 10, C.chrome).box(4, 5, 10, 4, 7, 10, C.paper_yellow);
  // Back: the strap with a brass buckle, a centre seam.
  m.box(2, 4, 0, 13, 4, 0, C.wood_dark);
  m.box(7, 4, 0, 8, 4, 0, C.brass);
  m.box(7, 5, 0, 8, 12, 0, C.walnut);
  // Folds.
  for (const [y, z] of [
    [9, 3],
    [7, 5],
  ] as const) {
    tint(m, 0, y, z, C.wood_dark);
    tint(m, 15, y, z, C.wood_dark);
  }
  return m;
}

/** Face mask for Damien's hair and beard: high forehead, full beard. */
function damienFace(x: number, y: number, z: number): boolean {
  if (y <= 1) return true;
  if (y >= 15) return false;
  if (y === 14) return z >= 12 && x >= 4 && x <= 9;
  if (x <= 1 || x >= 12) return false;
  return z >= 9;
}

function damienHead(): Model {
  const H = C.hair_gray;
  const HL = C.white;
  const HD = C.paint_gray;
  const m = headVolume(C.skin, C.skin_shadow);
  hairShell(m, damienFace, (x, y, z) => {
    const n = hash01(x * 11 + z * 5, Math.floor((y + z) / 2));
    return n < 0.2 ? HL : n > 0.8 ? HD : H;
  });
  capHead(m);
  // Full beard: jaw, chin, cheeks up to the ears, a moustache over the mouth.
  const beard = (x: number, y: number, z: number): number => {
    const s = (x * 3 + y * 5 + z) % 5;
    return s === 0 ? HL : s === 2 ? HD : H;
  };
  m.grid.forEach((x, y, z) => {
    if (y > 6 || y < 2) return;
    const cheek = y >= 5 && (x <= 3 || x >= 10);
    const jaw = y <= 4;
    if ((cheek || jaw) && !(y >= 3 && y <= 4 && x >= 5 && x <= 8 && z >= 12))
      m.set(x, y, z, beard(x, y, z));
  });
  m.box(4, 1, 11, 9, 1, 13, H).box(5, 0, 11, 8, 0, 12, HD);
  m.box(4, 2, 14, 9, 2, 14, H).set(6, 1, 14, HL).set(7, 1, 14, H);
  // Mouth under the moustache.
  m.box(5, 4, 13, 8, 4, 13, H).set(4, 4, 13, HD).set(9, 4, 13, HD);
  m.box(6, 3, 13, 7, 3, 13, C.lips);
  m.set(5, 3, 13, beard(5, 3, 13)).set(8, 3, 13, beard(8, 3, 13));
  // Nose.
  m.box(6, 5, 14, 7, 7, 14, C.skin).set(6, 5, 14, C.skin_shadow).set(7, 5, 14, C.skin_shadow);
  m.set(6, 7, 14, C.skin_light);
  // Eyes (dark, kind) behind round glasses.
  const eyes: readonly string[] = ["LLLL..LLLL", "WPPW..WPPW", "sWWs..sWWs"];
  const pal: Record<string, number> = {
    L: C.skin_shadow,
    W: C.eye_white,
    P: C.hair_black,
    s: C.skin_shadow,
  };
  eyes.forEach((row, r) => {
    const y = 10 - r;
    for (let k = 0; k < row.length; k++) {
      const c = pal[row[k]!];
      if (!c) continue;
      const x = 2 + k;
      m.set(x, y, m.grid.get(x, y, 13) ? 13 : 12, c);
    }
  });
  // Round glasses: rims one voxel proud, glass lenses, bridge, arms to the ears.
  for (const x0 of [1, 7]) {
    for (const [dx, dy] of [
      [1, -1],
      [2, -1],
      [3, -1],
      [4, -1],
      [0, 0],
      [5, 0],
      [0, 1],
      [5, 1],
      [1, 2],
      [2, 2],
      [3, 2],
      [4, 2],
    ] as const)
      m.set(x0 + dx, 8 + dy, 14, C.paint_black);
    m.box(x0 + 1, 8, 14, x0 + 4, 9, 14, C.glass);
  }
  m.box(6, 9, 14, 7, 9, 14, C.paint_black);
  for (let z = 6; z <= 13; z++) {
    m.set(0, 9, z, C.paint_black).set(13, 9, z, C.paint_black);
  }
  // Ears.
  m.box(1, 7, 5, 1, 9, 6, C.skin).set(1, 8, 5, C.skin_shadow);
  m.box(12, 7, 5, 12, 9, 6, C.skin).set(12, 8, 5, C.skin_shadow);
  // Forehead lines.
  m.box(4, 13, 13, 5, 13, 13, C.skin_shadow).box(8, 13, 13, 9, 13, 13, C.skin_shadow);
  return m;
}

/** Bushy grey brows with white tufts that curl over the glasses (w10 h2 d2). */
function damienBrows(): Model {
  const m = new Model(10, 2, 2);
  m.box(0, 0, 0, 3, 1, 0, C.hair_gray).box(6, 0, 0, 9, 1, 0, C.hair_gray);
  m.set(0, 1, 0, 0).set(9, 1, 0, 0);
  m.box(0, 0, 1, 2, 0, 1, C.white).box(7, 0, 1, 9, 0, 1, C.white);
  m.set(3, 1, 1, C.paint_gray).set(6, 1, 1, C.paint_gray);
  return m;
}

const DAMIEN_ARMS: ArmStyle = {
  sleeve: C.white,
  shade: C.coat_shadow,
  cuff: C.coat_shadow,
  wrist: C.skin,
  wristShade: C.skin_shadow,
  skin: C.skin,
  skinShade: C.skin_shadow,
};

/** Rolled shirt sleeves: the forearm below the roll is bare skin with a watch on the left. */
function damienArms(): [Model, Model, Model] {
  const up = upperArm(DAMIEN_ARMS, false);
  const fore = (watch: boolean): Model => {
    const f = forearm(DAMIEN_ARMS, null);
    // Sleeve rolled up to the elbow: the roll at rows 8..9, skin below.
    f.box(0, 6, 0, 5, 7, 5, 0);
    f.box(1, 6, 1, 4, 7, 4, C.skin);
    f.set(1, 6, 2, C.skin_shadow).set(4, 7, 3, C.skin_shadow);
    f.box(0, 8, 0, 5, 9, 5, C.white);
    roundEdges(f, 0, 5, 0, 5, 8, 9);
    for (let k = 1; k <= 4; k++) {
      tint(f, 0, 8, k, C.coat_shadow);
      tint(f, 5, 8, k, C.coat_shadow);
      tint(f, k, 8, 0, C.coat_shadow);
      tint(f, k, 8, 5, C.coat_shadow);
    }
    if (watch) {
      f.box(1, 4, 1, 4, 4, 4, C.leather_black);
      f.box(1, 4, 2, 1, 4, 3, C.gold).set(1, 5, 2, C.gold);
    }
    return f;
  };
  return [up, fore(false), mirrorX(fore(true))];
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
]);

/** Glass-class hologram colour for a solid colour index. */
export function holoColor(v: number): number {
  return HOLO_BRIGHT.has(v) ? C.holo_white : C.holo_cyan;
}

/** Row (character space, rest pose) that the hologram leaves empty as a scanline gap. */
export function isScanlineGap(worldRow: number): boolean {
  return ((worldRow % 4) + 4) % 4 === 3;
}

/** Damien Fridge: gray hair and beard, round glasses, brown vest, rolled sleeves, watch. */
export function damienRig(hologram: boolean): CharacterRigDef {
  const s = CHARACTER_SCALE;
  const [up, foreR, foreL] = damienArms();
  const parts: RigPart[] = [
    {
      name: "hips",
      model: damienHips(),
      parent: null,
      pivot: [0, HIP_Y, 0],
      origin: [8, 0, 5],
      scale: s,
    },
    {
      name: "torso",
      model: damienTorso(),
      parent: "hips",
      pivot: [8, 4, 5],
      origin: [8, 0, 5],
      scale: s,
    },
    {
      name: "head",
      model: damienHead(),
      parent: "torso",
      pivot: [8, 16, 5],
      origin: [7, 0, 7],
      scale: s,
    },
    ...faceParts(damienBrows(), C.skin_shadow, C.hair_gray, s),
    ...limbs(up, foreR, DAMIEN_OUTFIT, 16, 16, 15, s, foreL),
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
    const face = p.name === "brows" || p.name === "lids";
    const model = recolor(p.model, (v, _x, y) =>
      !face && isScanlineGap(Math.floor(baseY + y + 0.5)) ? 0 : holoColor(v),
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
export const RUN_HZ = 2.6;
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
      add(p, "upperArmR", [-2.3 - 0.12 * push, 0, 0.6], undefined, w);
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

// ── Locomotion ──────────────────────────────────────────────────

/** Walk cycle at `phase` (cycles; one cycle = two steps). Stance foot stays planted. */
function walkShape(phase: number, speed: number): CharacterPose {
  const p = restPose();
  const a = clamp(speed / WALK_FULL_SPEED, 0, 1.25);
  const ph = TAU * phase;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const s2 = Math.sin(2 * ph);
  // Legs: R thigh leads when s > 0; the knee flexes most mid-swing.
  const swing = 0.55 * a;
  add(p, "thighR", [-swing * s, 0, 0]);
  add(p, "thighL", [swing * s, 0, 0]);
  add(p, "shinR", [a * (0.12 + 0.95 * Math.max(0, c) ** 1.5), 0, 0]);
  add(p, "shinL", [a * (0.12 + 0.95 * Math.max(0, -c) ** 1.5), 0, 0]);
  // Pelvis: drops at double support (keeps the stance foot planted), twists with
  // the leading leg, rolls and sways over the stance leg.
  const drop = LEG_LEN * (1 - Math.cos(swing * s)) + 0.35 * a * (1 - Math.abs(c));
  add(p, "hips", [0, 0.12 * a * s, 0.05 * a * c], [0.35 * a * c, -drop, 0]);
  add(p, "thighR", [0, -0.12 * a * s, -0.05 * a * c]);
  add(p, "thighL", [0, -0.12 * a * s, -0.05 * a * c]);
  // Torso leans into the stride and counter-rotates; head bobs and stabilises.
  add(p, "torso", [0.07 * a + 0.03 * a * Math.abs(c), -0.24 * a * s, -0.04 * a * c]);
  add(p, "head", [-0.05 * a + 0.04 * a * s2, 0.12 * a * s, 0.02 * a * c]);
  // Arms: contra-lateral swing, elbows bend more on the forward swing.
  const arm = 0.5 * a;
  add(p, "upperArmR", [arm * s, 0, -0.1 - 0.04 * a]);
  add(p, "upperArmL", [-arm * s, 0, 0.1 + 0.04 * a]);
  add(p, "forearmR", [-0.18 - a * (0.25 + 0.45 * Math.max(0, -s)), 0, 0]);
  add(p, "forearmL", [-0.18 - a * (0.25 + 0.45 * Math.max(0, s)), 0, 0]);
  // Secondary motion lags behind the body.
  add(p, "coatTail", [
    0.14 * a + 0.1 * a * Math.sin(2 * ph - 0.9),
    0,
    0.06 * a * Math.sin(ph - 0.9),
  ]);
  add(p, "hairBack", [
    0.2 * a + 0.12 * a * Math.sin(2 * ph - 1.1),
    0,
    0.12 * a * Math.sin(ph - 1.1),
  ]);
  return p;
}

/** Run cycle at `phase` (cycles), amplitude a (1 = full sprint). Same leg phasing as the walk. */
function runShape(phase: number, a: number): CharacterPose {
  const p = restPose();
  const ph = TAU * phase;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const s2 = Math.sin(2 * ph);
  const swing = 0.8 * a;
  add(p, "thighR", [-swing * s - 0.12 * a, 0, 0]);
  add(p, "thighL", [swing * s - 0.12 * a, 0, 0]);
  // Knees: high recovery on the swing leg, a kick-back after push-off.
  add(p, "shinR", [a * (0.3 + 1.3 * Math.max(0, c) ** 1.3 + 0.35 * Math.max(0, -s)), 0, 0]);
  add(p, "shinL", [a * (0.3 + 1.3 * Math.max(0, -c) ** 1.3 + 0.35 * Math.max(0, s)), 0, 0]);
  // Pelvis: the stance leg carries it at mid-stance (s = 0); with the legs spread
  // it sinks so both feet only just leave the floor (a short flight phase).
  add(
    p,
    "hips",
    [0, 0.14 * a * s, 0.05 * a * c],
    [0.2 * a * c, a * (0.2 - 2 * Math.abs(s) ** 1.2), 0],
  );
  add(p, "thighR", [0, -0.14 * a * s, -0.04 * a * c]);
  add(p, "thighL", [0, -0.14 * a * s, -0.04 * a * c]);
  add(p, "torso", [0.2 * a + 0.04 * a * Math.abs(c), -0.3 * a * s, -0.03 * a * c]);
  add(p, "head", [-0.13 * a + 0.05 * a * s2, 0.15 * a * s, 0.02 * a * c]);
  // Arms pump, elbows at ~90°.
  add(p, "upperArmR", [0.8 * a * s - 0.1 * a, 0, -0.14]);
  add(p, "upperArmL", [-0.8 * a * s - 0.1 * a, 0, 0.14]);
  add(p, "forearmR", [-0.3 - a * (1.0 + 0.35 * Math.max(0, -s)), 0, 0.08]);
  add(p, "forearmL", [-0.3 - a * (1.0 + 0.35 * Math.max(0, s)), 0, -0.08]);
  add(p, "coatTail", [
    0.38 * a + 0.2 * a * Math.sin(2 * ph - 0.9),
    0,
    0.1 * a * Math.sin(ph - 0.9),
  ]);
  add(p, "hairBack", [
    0.5 * a + 0.2 * a * Math.sin(2 * ph - 1.1),
    0,
    0.18 * a * Math.sin(ph - 1.1),
  ]);
  return p;
}

/** 0 at walking speed … 1 at RUN_FULL_SPEED. */
export function runWeight(speed: number): number {
  return smoothstep(WALK_FULL_SPEED, RUN_FULL_SPEED, speed);
}

/** Gait cadence (cycles / s) at `speed`: WALK_HZ → RUN_HZ. */
export function gaitHz(speed: number): number {
  return WALK_HZ + (RUN_HZ - WALK_HZ) * runWeight(speed);
}

/**
 * Advance a gait phase (cycles, wrapped to [0, 1)) by dt at `speed`. Keeping a
 * phase instead of a clock lets the cadence change without the legs jumping.
 */
export function advanceGait(phase: number, dt: number, speed: number): number {
  return mod(phase + dt * gaitHz(speed), 1);
}

/**
 * Phase-coherent locomotion: the walk cycle up to WALK_FULL_SPEED, blending
 * into the run cycle towards RUN_FULL_SPEED (same phase → no leg pops).
 */
export function gaitPose(phase: number, speed: number): CharacterPose {
  const walk = walkShape(phase, Math.min(speed, WALK_FULL_SPEED));
  const r = runWeight(speed);
  return r > 0 ? blendPose(walk, runShape(phase, 1), r) : walk;
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

function sitPose(t: number, o: PoseOptions): CharacterPose {
  const seed = o.seed ?? 0;
  const ts = t + seed * 4.3;
  const p = restPose();
  const b = breathing(p, ts);
  // Thighs level, shins down: the hip joint sits at shin height (a chair seat).
  add(p, "hips", [-0.04, 0, 0], [0, -(LEG_LEN - 6.5), -0.5]);
  add(p, "thighR", [-1.5, 0, -0.04]);
  add(p, "thighL", [-1.5, 0, 0.04]);
  add(p, "shinR", [1.45, 0, 0.03]);
  add(p, "shinL", [1.45, 0, -0.03]);
  add(p, "torso", [0.04, 0, 0]);
  add(p, "upperArmR", [-0.35 + 0.02 * b, 0, -0.05]);
  add(p, "upperArmL", [-0.35 + 0.02 * b, 0, 0.05]);
  add(p, "forearmR", [-0.75, 0, 0.1]);
  add(p, "forearmL", [-0.75, 0, -0.1]);
  add(p, "coatTail", [0.8, 0, 0]);
  add(p, "head", [0.05, 0.25 * plateau(mod(ts, 9), 4, 5.5, 0.6), 0]);
  // Fingers drum on the knee now and then; one foot bounces.
  const drum = plateau(mod(ts, 13), 7, 10, 0.5);
  add(p, "forearmR", [0.06 * drum * Math.sin(TAU * 4.2 * ts), 0, 0]);
  add(p, "shinL", [-0.08 * drum * (0.5 + 0.5 * Math.sin(TAU * 2.1 * ts)), 0, 0]);
  // Lean back and stretch once in a long while.
  const lean = plateau(mod(ts, 23), 15, 18, 0.8);
  add(p, "torso", [-0.12, 0, 0], undefined, lean);
  add(p, "head", [-0.1, 0, 0], undefined, lean);
  face(p, t, seed, { raise: 0.1 * lean });
  return p;
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
  add(p, "thighL", [-0.06 * tap, 0, 0]);
  add(p, "shinL", [-0.1 * tap, 0, 0]);
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
      : smoothstep(0, 0.4, t) * (1 - smoothstep(0.75, CROUCH_DURATION, t));
  if (e === 0) return p;
  // Knees bend by th, shins by 2·th: the feet stay under the hips. There is no
  // ankle, so the soles tip forward: the hips drop only until the toes touch.
  const th = 1.25 * e;
  add(p, "thighR", [-th, 0, -0.08 * e]);
  add(p, "thighL", [-th, 0, 0.08 * e]);
  add(p, "shinR", [2 * th, 0, 0]);
  add(p, "shinL", [2 * th, 0, 0]);
  add(p, "hips", [0, 0, 0], [0, -(LEG_LEN * (1 - Math.cos(th)) - 2.5 * Math.sin(th)), 0]);
  // Lean over the knees; the right hand reaches the floor and closes.
  const grab = plateau(t, 0.5, 0.7, 0.1);
  add(p, "torso", [0.85, 0.1, 0], undefined, e);
  add(p, "head", [-0.35, -0.1, 0], undefined, e);
  add(p, "upperArmR", [-0.55, 0, 0.12], undefined, e);
  add(p, "forearmR", [-0.2 - 0.25 * grab, 0, 0], undefined, e);
  add(p, "upperArmL", [0.1, 0, -0.05], undefined, e);
  add(p, "forearmL", [-0.8, 0, 0], undefined, e);
  add(p, "coatTail", [0.9, 0, 0], undefined, e);
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
    p = walkShape(WALK_HZ * t, speed);
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
      return walkShape(WALK_HZ * t, speed);
    case "run":
      return runShape(RUN_HZ * t, speed > 0 ? clamp(speed / RUN_FULL_SPEED, 0.2, 1.2) : 1);
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

/** Default cross-fade length between two kinds (s). */
export function transitionDuration(from: CharacterPoseKind, to: CharacterPoseKind): number {
  if (from === "sit" || to === "sit" || from === "crouch" || to === "crouch") return 0.45;
  // Hands onto / off the rungs.
  if (from === "climb" || to === "climb") return 0.45;
  // Big arm poses need a little longer to come down into the reach.
  if (to === "interact") return from === "wave" || from === "celebrate" ? 0.3 : 0.2;
  if (to === "celebrate" || to === "wave") return 0.3;
  return 0.3;
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
  return blendPose(sampleTrack(track.from, now, speed, opts), cur, w);
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
  const upper = sampleTrack(i.track, i.now, 0, opts);
  // Stride amplitude fades with walkW (not with speed), so stopping never pops;
  // speed above WALK_FULL_SPEED blends towards the run.
  const gait = gaitPose(i.gaitPhase, Math.max(i.speed, WALK_FULL_SPEED));
  const pose = i.walkW > 0 ? blendLocomotion(upper, gait, i.walkW, i.track.kind) : upper;
  const still = 1 - clamp(i.walkW, 0, 1);
  if (i.look && i.look.weight > 0) {
    const w = clamp(i.look.weight, 0, 1) * (1 - 0.6 * (1 - still));
    const yaw = clamp(i.look.yaw, -HEAD_LOOK_MAX, HEAD_LOOK_MAX) * w;
    add(pose, "torso", [0, 0.3 * yaw, 0]);
    add(pose, "head", [0, 0.7 * yaw, 0.05 * yaw]);
  }
  const chill = clamp(i.chill ?? 0, 0, 1) * still;
  if (chill > 0) applyChill(pose, i.now, chill);
  if (i.load || i.rattle) applyCage(pose, i.now, clamp(i.load ?? 0, -1, 1), i.rattle ?? 0);
  pose.lids = {
    rot: [0, 0, 0],
    pos: [0, 0, LID_TRAVEL * blinkAmount(i.now, seed)],
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
 * trinken → drink, lesen → read, hören → listen, sitzen → sit,
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
    case "ansehen":
      return "think";
    case "benutzen":
      return TYPING_DECOR.test(decorId) ? "typing" : "work";
    default:
      return "interact";
  }
}

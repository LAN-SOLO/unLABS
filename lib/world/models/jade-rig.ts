/**
 * Jade's rig for a look — composition (pure — no three).
 * ======================================================
 *
 * Builds the 15 rig parts (RIG_PART_NAMES) of Jade wearing a `JadeLook`.
 * Each part is painted on a `Canvas` at its nominal size (clothes, then
 * gear, then accessories — see jade-wear / jade-hair / jade-gear /
 * jade-accessories), then turned into a `Model`. When a piece grows the
 * part past its nominal box (a helmet, a backpack, a gauntlet cuff) the
 * model grows too: `Canvas.toModel` reports the shift it applied, and
 * `assemble` adds it to the part's `origin` and to every child's `pivot`
 * (children pivots live in the parent's model frame). So
 * `pivot - parent.origin` — the joint's rest position, which every pose
 * table relies on — never changes for any look.
 *
 * After painting, every part is fitted to Jade's tall, slim build
 * (`HIPS_FIT` … `ARM_FIT`, see below). The first-day look keeps dense parts;
 * any other look drops the hidden interior voxels of every part (`hollow`),
 * which keeps the budgets (< 10000 posed voxels, ≤ 2600 per part) with
 * helmets, backpacks and buddies on.
 *
 * Only type imports from rig.ts (rig.ts imports this module for `jadeRig`).
 */
import { DEFAULT_LOOK, WEAR_BY_ID, WEAR_SLOTS, type JadeLook } from "@/lib/world/content/wardrobe";
import {
  backGear,
  beltGear,
  buddyGear,
  neckGear,
  wristGear,
} from "@/lib/world/models/jade-accessories";
import { faceGear, glovesCoverWrist, handWithGloves, headGear } from "@/lib/world/models/jade-gear";
import {
  browsCanvas,
  hairBackCanvas,
  hairTone,
  headWithHair,
  lidsCanvas,
} from "@/lib/world/models/jade-hair";
import {
  Canvas,
  JADE_HIP_Y,
  JADE_SCALE,
  fitCanvas,
  fitPoint,
  resolveLook,
  type Fit,
  type LookCtx,
  type V3,
} from "@/lib/world/models/jade-kit";
import {
  coatTailClothes,
  forearmClothes,
  hipsClothes,
  shinClothes,
  thighClothes,
  torsoClothes,
  upperArmClothes,
} from "@/lib/world/models/jade-wear";
import type { CharacterRigDef, RigPart, RigPartName } from "@/lib/world/models/rig";

/** Stable key of a look (slot order, `-` for empty). */
export function lookKey(look: JadeLook): string {
  return WEAR_SLOTS.map((s) => {
    const e = look[s];
    return e ? `${s}=${e.item}.${e.colorway}` : `${s}=-`;
  }).join("|");
}

/** What shows: a full-face helmet hides the face slot (same rule as wardrobe.ts `visibleLook`). */
export function shownLook(look: JadeLook): JadeLook {
  const head = look.head ? WEAR_BY_ID.get(look.head.item) : undefined;
  if (!head?.coversFace || !look.face) return look;
  return { ...look, face: null };
}

const DEFAULT_KEY = lookKey(DEFAULT_LOOK);

interface PartSpec {
  name: RigPartName;
  canvas: Canvas;
  parent: RigPartName | null;
  pivot: V3;
  origin: V3;
}

/** Turn canvases into rig parts, moving origins / child pivots by each part's growth. */
function assemble(specs: PartSpec[], hollow: boolean): RigPart[] {
  const shifts = new Map<RigPartName, V3>();
  return specs.map((sp) => {
    const { model, shift } = sp.canvas.toModel(hollow);
    shifts.set(sp.name, shift);
    const ps = sp.parent ? (shifts.get(sp.parent) ?? [0, 0, 0]) : [0, 0, 0];
    return {
      name: sp.name,
      model,
      parent: sp.parent,
      pivot: [sp.pivot[0] + ps[0]!, sp.pivot[1] + ps[1]!, sp.pivot[2] + ps[2]!],
      origin: [sp.origin[0] + shift[0], sp.origin[1] + shift[1], sp.origin[2] + shift[2]],
      scale: JADE_SCALE,
    };
  });
}

// ── Build: tall and slim ────────────────────────────────────────
//
// Every part is painted at the classic sizes (jade-wear / jade-hair /
// jade-gear / jade-accessories keep their frames), then fitted: the hips
// lose four columns and a front layer and gain a row (a higher waist, so
// the legs read longer) while the torso gives that row back below the chest
// and loses two columns and a layer (narrow shoulders); the arms lose their
// inner column; the head loses its outer hair columns and a layer at the
// back (a smaller head on a longer body). The joints the poses rely on
// (hip height, shoulders, thigh, shin, upper arm, forearm, the back's depth)
// stay exactly where they were, so every pose, seat, bed and gait is exact.

/** Hips 16×6×10 → 12×7×9. */
export const HIPS_FIT: Fit = { dropX: [1, 2, 13, 14], dropZ: [5], dupY: [1] };
/** Torso 16×16×12 → 14×15×11 (the shoulders stay at the same height above the hips). */
export const TORSO_FIT: Fit = { dropX: [1, 14], dropZ: [5], dropY: [1] };
/** Head 14×18×16 → 12×18×15: the outer hair columns and a layer at the back of the skull. */
export const HEAD_FIT: Fit = { dropX: [0, 13], dropZ: [2] };
/** Upper arm / forearm (right frame, inner side +x) 6 → 5 wide. */
export const ARM_FIT: Fit = { dropX: [5] };
/** The coat skirt follows the hips (tail x = hips x + 2, z = hips z + 2). */
const TAIL_FIT: Fit = { dropX: [3, 4, 15, 16], dropZ: [7] };

/** Width of a fitted arm (the left arm is its mirror image). */
const ARM_W = 5;
const mirrorPoint = (p: V3): V3 => [ARM_W - p[0], p[1], p[2]];

// ── Parts ───────────────────────────────────────────────────────

function hips(ctx: LookCtx): Canvas {
  const k = new Canvas(16, 6, 10);
  hipsClothes(k, ctx);
  beltGear(k, ctx);
  return fitCanvas(k, HIPS_FIT);
}

function torso(ctx: LookCtx): Canvas {
  const k = new Canvas(16, 16, 12);
  torsoClothes(k, ctx, hairTone(ctx).main);
  backGear(k, ctx.back);
  neckGear(k, ctx.neck);
  buddyGear(k, ctx.buddy);
  return fitCanvas(k, TORSO_FIT);
}

function head(ctx: LookCtx): Canvas {
  const k = new Canvas(14, 18, 16);
  headWithHair(k, ctx);
  faceGear(k, ctx.face);
  headGear(k, ctx.head);
  return fitCanvas(k, HEAD_FIT);
}

function forearm(ctx: LookCtx, left: boolean): Canvas {
  const k = new Canvas(6, 12, 6);
  forearmClothes(k, ctx);
  handWithGloves(k, ctx);
  if (left) wristGear(k, ctx.wrist, glovesCoverWrist(ctx));
  const f = fitCanvas(k, ARM_FIT);
  return left ? f.mirrorX() : f;
}

function upperArm(ctx: LookCtx): Canvas {
  const k = new Canvas(6, 10, 6);
  upperArmClothes(k, ctx);
  return fitCanvas(k, ARM_FIT);
}

function thigh(ctx: LookCtx): Canvas {
  const k = new Canvas(6, 14, 6);
  thighClothes(k, ctx);
  return k;
}

function shin(ctx: LookCtx): Canvas {
  const k = new Canvas(6, 14, 10);
  shinClothes(k, ctx);
  return k;
}

/** Coat skirt, or a single voxel buried in the hips when nothing hangs there. */
function coatTail(ctx: LookCtx): { canvas: Canvas; origin: V3 } {
  const origin = fitPoint(TAIL_FIT, [10, 8, 3]);
  const k = new Canvas(20, 8, 14);
  if (coatTailClothes(k, ctx)) return { canvas: fitCanvas(k, TAIL_FIT), origin };
  const p = new Canvas(1, 1, 1);
  p.clip = null;
  // Hips voxel (8, 2, 6) in the tail frame (hips - pivot + origin), inside the fitted hips too.
  p.set(10, 10, 8, ctx.legs?.t.main ?? 1);
  return { canvas: fitCanvas(p, TAIL_FIT), origin };
}

// ── The rig ─────────────────────────────────────────────────────

const UPPER_ARM_ORIGIN: V3 = fitPoint(ARM_FIT, [3, 9, 3]);
const FOREARM_ORIGIN: V3 = fitPoint(ARM_FIT, [3, 10, 3]);
const ELBOW_PIVOT: V3 = fitPoint(ARM_FIT, [3, 0, 3]);
const THIGH_ORIGIN: V3 = [3, 12, 3];
const SHIN_ORIGIN: V3 = [3, 12, 5];
const KNEE_PIVOT: V3 = [3, 0, 3];
/** Shoulder joints: the fitted arm (5 wide, joint 2 from its inner face) hangs flush with the torso. */
const TORSO_W = 16 - (TORSO_FIT.dropX?.length ?? 0);
const SHOULDER_Y = fitPoint(TORSO_FIT, [0, 15, 0])[1];
const SHOULDER_Z = fitPoint(TORSO_FIT, [0, 0, 5])[2];

export interface JadeRigOptions {
  /** Drop hidden interior voxels (default: every look except DEFAULT_LOOK). */
  hollow?: boolean;
}

/** Jade Lawrence wearing `look` (DEFAULT_LOOK: the first-day look, dense parts). */
export function buildJadeRig(
  look: JadeLook = DEFAULT_LOOK,
  opts: JadeRigOptions = {},
): CharacterRigDef {
  const shown = shownLook(look);
  const ctx = resolveLook(shown);
  const hollow = opts.hollow ?? lookKey(shown) !== DEFAULT_KEY;
  const hair = hairBackCanvas(ctx, HEAD_FIT);
  const tail = coatTail(ctx);
  const up = upperArm(ctx);
  const th = thigh(ctx);
  const sh = shin(ctx);
  const specs: PartSpec[] = [
    {
      name: "hips",
      canvas: hips(ctx),
      parent: null,
      pivot: [0, JADE_HIP_Y, 0],
      origin: fitPoint(HIPS_FIT, [8, 0, 5]),
    },
    {
      name: "torso",
      canvas: torso(ctx),
      parent: "hips",
      pivot: fitPoint(HIPS_FIT, [8, 4, 5]),
      origin: fitPoint(TORSO_FIT, [8, 0, 5]),
    },
    {
      name: "head",
      canvas: head(ctx),
      parent: "torso",
      pivot: fitPoint(TORSO_FIT, [8, 16, 5]),
      origin: fitPoint(HEAD_FIT, [7, 0, 7]),
    },
    {
      name: "hairBack",
      canvas: hair.canvas,
      parent: "head",
      pivot: fitPoint(HEAD_FIT, [7, 11, 0]),
      origin: hair.origin,
    },
    {
      name: "brows",
      canvas: browsCanvas(ctx),
      parent: "head",
      pivot: fitPoint(HEAD_FIT, [7, 12, 13.3]),
      origin: [5, 1, 1],
    },
    {
      name: "lids",
      canvas: lidsCanvas(),
      parent: "head",
      pivot: fitPoint(HEAD_FIT, [7, 9, 11.9]),
      origin: [5, 1, 0.5],
    },
    {
      name: "upperArmR",
      canvas: up,
      parent: "torso",
      pivot: [-3, SHOULDER_Y, SHOULDER_Z],
      origin: UPPER_ARM_ORIGIN,
    },
    {
      name: "forearmR",
      canvas: forearm(ctx, false),
      parent: "upperArmR",
      pivot: ELBOW_PIVOT,
      origin: FOREARM_ORIGIN,
    },
    {
      name: "upperArmL",
      canvas: up.mirrorX(),
      parent: "torso",
      pivot: [TORSO_W + 3, SHOULDER_Y, SHOULDER_Z],
      origin: mirrorPoint(UPPER_ARM_ORIGIN),
    },
    {
      name: "forearmL",
      canvas: forearm(ctx, true),
      parent: "upperArmL",
      pivot: mirrorPoint(ELBOW_PIVOT),
      origin: mirrorPoint(FOREARM_ORIGIN),
    },
    {
      name: "thighR",
      canvas: th,
      parent: "hips",
      pivot: fitPoint(HIPS_FIT, [5, 0, 5]),
      origin: THIGH_ORIGIN,
    },
    { name: "shinR", canvas: sh, parent: "thighR", pivot: KNEE_PIVOT, origin: SHIN_ORIGIN },
    {
      name: "thighL",
      canvas: th.mirrorX(),
      parent: "hips",
      pivot: fitPoint(HIPS_FIT, [11, 0, 5]),
      origin: THIGH_ORIGIN,
    },
    {
      name: "shinL",
      canvas: sh.mirrorX(),
      parent: "thighL",
      pivot: KNEE_PIVOT,
      origin: SHIN_ORIGIN,
    },
    {
      name: "coatTail",
      canvas: tail.canvas,
      parent: "hips",
      pivot: fitPoint(HIPS_FIT, [8, 0, 1]),
      origin: tail.origin,
    },
  ];
  return {
    id: "jade",
    parts: assemble(specs, hollow),
    scale: JADE_SCALE,
    hologram: false,
    fine: true,
  };
}

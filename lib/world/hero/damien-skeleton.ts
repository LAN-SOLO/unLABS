/**
 * Damien's hero skeleton — his anatomical joint layout (pure).
 * ============================================================
 *
 * Same 15 joint names, parents and rest orientation as the voxel rig (and
 * as Jade's hero skeleton), so every pose in models/rig.ts plays on him.
 * Units: model voxels (1 voxel = CHARACTER_SCALE world units ≈ 2.78 cm),
 * feet on y = 0, front = +z, his right = -x.
 *
 * Damien is tall and heavy-set: ~1.78 m to the top of his slicked-back
 * hair (≈ 5.76 world units at DAMIEN_UNIT, under the 5.8 door limit), broad shoulders,
 * a full chest and belly, long arms.
 */
import type { Vec3 } from "@/lib/sculpt/sdf";
import type { HeroJoint } from "@/lib/world/hero/skeleton";
import { RIG_PART_NAMES, type RigPartName } from "@/lib/world/models/rig";

/** Anatomical landmarks of Damien's body (character space, model voxels). */
export const DAMIEN_BODY = {
  crown: 62.2,
  chin: 53.7,
  eyeY: 58.0,
  neckBase: 51.6,
  shoulderY: 50.6,
  shoulderX: 6.5,
  elbow: [7.55, 40.4, -0.6] as Vec3,
  wrist: [8.15, 31.1, -0.3] as Vec3,
  waistY: 39.0,
  hipJointY: 31.8,
  hipJointX: 3.55,
  knee: [3.6, 17.6, 0.35] as Vec3,
  ankle: [3.6, 3.0, -0.3] as Vec3,
} as const;

const B = DAMIEN_BODY;

/** Top of the slicked-back hair (model voxels). */
export const DAMIEN_TOP = 62.9;
/** World units per model voxel for Damien: his hair top lands at 5.76 world units. */
export const DAMIEN_UNIT = 5.76 / DAMIEN_TOP;
/** Door limit (world units) every character must stay under. */
export const DOOR_HEIGHT_LIMIT = 5.8;

/** Damien's hero joints, parents first (same order as RIG_PART_NAMES). */
export const DAMIEN_HERO_JOINTS: readonly HeroJoint[] = [
  { name: "hips", parent: null, at: [0, B.hipJointY, 0] },
  { name: "torso", parent: "hips", at: [0, 36.2, -0.2] },
  { name: "head", parent: "torso", at: [0, 52.8, -0.8] },
  { name: "hairBack", parent: "head", at: [0, 60.2, -2.8] },
  { name: "upperArmR", parent: "torso", at: [-B.shoulderX, B.shoulderY, -0.5] },
  { name: "forearmR", parent: "upperArmR", at: [-B.elbow[0], B.elbow[1], B.elbow[2]] },
  { name: "upperArmL", parent: "torso", at: [B.shoulderX, B.shoulderY, -0.5] },
  { name: "forearmL", parent: "upperArmL", at: [B.elbow[0], B.elbow[1], B.elbow[2]] },
  { name: "thighR", parent: "hips", at: [-B.hipJointX, B.hipJointY, 0.15] },
  { name: "shinR", parent: "thighR", at: [-B.knee[0], B.knee[1], B.knee[2]] },
  { name: "thighL", parent: "hips", at: [B.hipJointX, B.hipJointY, 0.15] },
  { name: "shinL", parent: "thighL", at: [B.knee[0], B.knee[1], B.knee[2]] },
  { name: "coatTail", parent: "hips", at: [0, B.hipJointY, -3.6] },
  { name: "brows", parent: "head", at: [0, 58.9, 3.0] },
  { name: "lids", parent: "head", at: [0, B.eyeY, 2.9] },
];

export const DAMIEN_JOINT_BY_NAME: ReadonlyMap<RigPartName, HeroJoint> = new Map(
  DAMIEN_HERO_JOINTS.map((j) => [j.name, j]),
);

/** Rest position of one of Damien's joints inside its parent. */
export function damienLocalRest(j: HeroJoint): Vec3 {
  const p = j.parent ? DAMIEN_JOINT_BY_NAME.get(j.parent)!.at : ([0, 0, 0] as Vec3);
  return [j.at[0] - p[0], j.at[1] - p[1], j.at[2] - p[2]];
}

/** Every rig part has a Damien joint (checked by tests). */
export function damienCoversRig(): boolean {
  return RIG_PART_NAMES.every((n) => DAMIEN_JOINT_BY_NAME.has(n));
}

/** Bone segments for skin weights (see damien-build.ts). */
export const DAMIEN_WEIGHT_SEGMENTS: readonly { bone: RigPartName; a: Vec3; b: Vec3 }[] = [
  { bone: "hips", a: [0, 29.0, -0.3], b: [0, 35.6, -0.3] },
  { bone: "torso", a: [0, 37.6, -0.3], b: [0, 51.2, -0.7] },
  { bone: "torso", a: [-5.4, 50.4, -0.5], b: [5.4, 50.4, -0.5] },
  {
    bone: "upperArmR",
    a: [-B.shoulderX, B.shoulderY, -0.5],
    b: [-B.elbow[0], B.elbow[1] + 0.6, B.elbow[2]],
  },
  { bone: "forearmR", a: [-B.elbow[0], B.elbow[1] - 0.6, B.elbow[2]], b: [-8.5, 23.8, -0.1] },
  {
    bone: "upperArmL",
    a: [B.shoulderX, B.shoulderY, -0.5],
    b: [B.elbow[0], B.elbow[1] + 0.6, B.elbow[2]],
  },
  { bone: "forearmL", a: [B.elbow[0], B.elbow[1] - 0.6, B.elbow[2]], b: [8.5, 23.8, -0.1] },
  {
    bone: "thighR",
    a: [-B.hipJointX, B.hipJointY - 0.5, 0.15],
    b: [-B.knee[0], B.knee[1] + 0.5, B.knee[2]],
  },
  { bone: "shinR", a: [-B.knee[0], B.knee[1] - 0.5, B.knee[2]], b: [-B.ankle[0], 0.8, 1.0] },
  {
    bone: "thighL",
    a: [B.hipJointX, B.hipJointY - 0.5, 0.15],
    b: [B.knee[0], B.knee[1] + 0.5, B.knee[2]],
  },
  { bone: "shinL", a: [B.knee[0], B.knee[1] - 0.5, B.knee[2]], b: [B.ankle[0], 0.8, 1.0] },
];

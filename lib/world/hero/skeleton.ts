/**
 * Hero skeleton — anatomical joint layout for the "real" characters (pure).
 * =========================================================================
 *
 * The voxel rigs (models/rig.ts) are stylised: Jade's head is 18 of 62
 * voxels. The clarity renderer draws Jade as a realistically proportioned
 * woman (≈ 7.3 heads, 1.70 m to the crown) on a skeleton with the SAME 15
 * joint names, parents and rest orientation as the voxel rig: every pose
 * in rig.ts (walk, sit, typing, climb, …) is a set of joint rotations plus
 * small translations and plays on this skeleton unchanged.
 *
 * Units are the rig's model voxels (1 voxel = JADE_SCALE world units ≈
 * 2.78 cm), character space: feet on y = 0, front = +z, Jade's right = -x.
 *
 * Only the joint *positions* differ from the voxel rig. Where the engine
 * places the character from the voxel rig's measurements (seat height,
 * lying depth), `HERO_SEAT_LIFT` / `HERO_LIE_LIFT` give the correction.
 */
import { RIG_PART_NAMES, type RigPartName } from "@/lib/world/models/rig";
import type { Vec3 } from "@/lib/sculpt/sdf";

export interface HeroJoint {
  name: RigPartName;
  parent: RigPartName | null;
  /** Rest position in character space (model voxels). */
  at: Vec3;
}

/** Anatomical landmarks of Jade's body (character space, model voxels). */
export const JADE_BODY = {
  crown: 60.6,
  chin: 52.5,
  eyeY: 56.55,
  neckBase: 50.4,
  shoulderY: 49.6,
  shoulderX: 5.6,
  elbow: [6.55, 39.8, -0.55] as Vec3,
  wrist: [7.1, 30.8, -0.25] as Vec3,
  waistY: 38.6,
  hipJointY: 31.2,
  hipJointX: 3.05,
  knee: [3.1, 17.2, 0.35] as Vec3,
  ankle: [3.1, 3.0, -0.3] as Vec3,
} as const;

const B = JADE_BODY;

/** Jade's hero joints, parents first (same order as RIG_PART_NAMES). */
export const JADE_HERO_JOINTS: readonly HeroJoint[] = [
  { name: "hips", parent: null, at: [0, B.hipJointY, 0] },
  { name: "torso", parent: "hips", at: [0, 35.6, -0.2] },
  { name: "head", parent: "torso", at: [0, 51.6, -0.7] },
  { name: "hairBack", parent: "head", at: [0, 59.2, -2.2] },
  { name: "upperArmR", parent: "torso", at: [-B.shoulderX, B.shoulderY, -0.45] },
  { name: "forearmR", parent: "upperArmR", at: [-B.elbow[0], B.elbow[1], B.elbow[2]] },
  { name: "upperArmL", parent: "torso", at: [B.shoulderX, B.shoulderY, -0.45] },
  { name: "forearmL", parent: "upperArmL", at: [B.elbow[0], B.elbow[1], B.elbow[2]] },
  { name: "thighR", parent: "hips", at: [-B.hipJointX, B.hipJointY, 0.15] },
  { name: "shinR", parent: "thighR", at: [-B.knee[0], B.knee[1], B.knee[2]] },
  { name: "thighL", parent: "hips", at: [B.hipJointX, B.hipJointY, 0.15] },
  { name: "shinL", parent: "thighL", at: [B.knee[0], B.knee[1], B.knee[2]] },
  { name: "coatTail", parent: "hips", at: [0, B.hipJointY, -3.2] },
  { name: "brows", parent: "head", at: [0, 57.4, 2.9] },
  { name: "lids", parent: "head", at: [0, B.eyeY, 2.8] },
];

export const HERO_JOINT_BY_NAME: ReadonlyMap<RigPartName, HeroJoint> = new Map(
  JADE_HERO_JOINTS.map((j) => [j.name, j]),
);

/** Rest position of a joint inside its parent (what a bone's `position` is at rest). */
export function heroLocalRest(j: HeroJoint): Vec3 {
  const p = j.parent ? HERO_JOINT_BY_NAME.get(j.parent)!.at : ([0, 0, 0] as Vec3);
  return [j.at[0] - p[0], j.at[1] - p[1], j.at[2] - p[2]];
}

/** Knee height difference hero vs voxel rig (voxel rig knee: 12). Lifts seated poses. */
export const HERO_SEAT_LIFT = B.knee[1] - 12;
/** Hip height difference hero vs voxel rig (voxel rig hips: 24). */
export const HERO_HIP_LIFT = B.hipJointY - 24;

/** Every rig part has a hero joint (checked by tests). */
export function heroCoversRig(): boolean {
  return RIG_PART_NAMES.every((n) => HERO_JOINT_BY_NAME.has(n));
}

/**
 * Bone segments used for skin weights: each vertex is weighted by its
 * distance to these segments (see build.ts). Segments follow the bones
 * from their joint to the next one down the chain.
 */
export const JADE_WEIGHT_SEGMENTS: readonly { bone: RigPartName; a: Vec3; b: Vec3 }[] = [
  { bone: "hips", a: [0, 28.5, -0.3], b: [0, 35.0, -0.3] },
  { bone: "torso", a: [0, 37.0, -0.3], b: [0, 50.2, -0.6] },
  { bone: "torso", a: [-4.6, 49.4, -0.5], b: [4.6, 49.4, -0.5] },
  { bone: "head", a: [0, 52.4, -0.6], b: [0, 61.5, -0.4] },
  {
    bone: "upperArmR",
    a: [-B.shoulderX, B.shoulderY, -0.45],
    b: [-B.elbow[0], B.elbow[1] + 0.6, B.elbow[2]],
  },
  { bone: "forearmR", a: [-B.elbow[0], B.elbow[1] - 0.6, B.elbow[2]], b: [-7.5, 24.0, -0.1] },
  {
    bone: "upperArmL",
    a: [B.shoulderX, B.shoulderY, -0.45],
    b: [B.elbow[0], B.elbow[1] + 0.6, B.elbow[2]],
  },
  { bone: "forearmL", a: [B.elbow[0], B.elbow[1] - 0.6, B.elbow[2]], b: [7.5, 24.0, -0.1] },
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

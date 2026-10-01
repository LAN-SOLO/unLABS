/**
 * Jade's blink and gaze for the hero mesh (pure — no three).
 * ==========================================================
 *
 * The voxel rig blinks by sliding its `lids` part forward: the pose sets
 * `lids.pos[2] = LID_TRAVEL × amount` (see `animateCharacter` in rig.ts).
 * The hero skeleton has a `lids` bone too, but nothing is skinned to it —
 * the hero's lids are part of the head mesh. These helpers turn that pose
 * offset into a blink amount and the rotation of two thin lid caps that the
 * renderer places over each eyeball:
 *
 *   for each eye in JADE_EYES (head-bone space, like the eyeballs):
 *     upper = SphereGeometry(JADE_LID.radius, 32, 12, 0, 2π, 0, JADE_LID.upperTheta)
 *     lower = SphereGeometry(JADE_LID.radius, 32, 8, 0, 2π, π - JADE_LID.lowerTheta, JADE_LID.lowerTheta)
 *     (skin material; cap axis = +y, i.e. the pole sits above the eye)
 *   every frame:
 *     const b = heroBlinkFromLids(pose.lids?.pos);
 *     const { upper, lower } = lidAngles(b);
 *     upperCap.rotation.x = upper; lowerCap.rotation.x = lower;
 *     eyeball.rotation.set(gaze.pitch, gaze.yaw + inward, 0)  // gazeAngles(...)
 *
 * At blink 0 both caps rest inside the lid shell of the head (invisible);
 * at 1 the upper cap closes down to meet the lower one just below the iris.
 */
import { LID_TRAVEL } from "@/lib/world/models/rig";
import { EYE_R } from "@/lib/world/hero/jade-sculpt";

export const JADE_LID = {
  /** A hair above the head's lid shell (EYE_R + 0.04) so the caps cover it. */
  radius: EYE_R + 0.03,
  /** Polar extent of the upper cap (rad from its pole). */
  upperTheta: 1.25,
  /** Polar extent of the lower cap (rad from the bottom pole). */
  lowerTheta: 0.95,
  /** Upper cap rotation about x when open (tilted back, hidden in the lid shell). */
  upperOpen: -0.62,
  /** … and when shut (rotated down over the front of the eye). */
  upperShut: 0.52,
  lowerOpen: 0.22,
  lowerShut: -0.08,
} as const;

/** Blink amount 0 (open) .. 1 (shut) from the rig's `lids` joint offset. */
export function heroBlinkFromLids(pos?: readonly number[] | null): number {
  const z = pos?.[2] ?? 0;
  if (!Number.isFinite(z) || LID_TRAVEL <= 0) return 0;
  return Math.min(1, Math.max(0, z / LID_TRAVEL));
}

/** Eased lid cap rotations (rad about x) for a blink amount. */
export function lidAngles(blink: number): { upper: number; lower: number } {
  const b = Math.min(1, Math.max(0, blink));
  // Lids accelerate into the close and linger shut a moment.
  const e = b * b * (3 - 2 * b);
  return {
    upper: JADE_LID.upperOpen + (JADE_LID.upperShut - JADE_LID.upperOpen) * e,
    lower: JADE_LID.lowerOpen + (JADE_LID.lowerShut - JADE_LID.lowerOpen) * e,
  };
}

/** Maximum eye turn (rad): beyond this the head should turn instead. */
export const GAZE_LIMIT = { yaw: 0.42, pitch: 0.3 } as const;

/**
 * Eyeball rotation for a look direction relative to the head (yaw: + to
 * Jade's left, pitch: + up). Clamped softly so the iris never disappears
 * into the corner of the eye.
 */
export function gazeAngles(yaw: number, pitch = 0): { yaw: number; pitch: number } {
  const soft = (v: number, lim: number) => lim * Math.tanh(v / lim);
  return { yaw: soft(yaw, GAZE_LIMIT.yaw), pitch: -soft(pitch, GAZE_LIMIT.pitch) };
}

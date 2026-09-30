/**
 * Emotional overlays for a character pose (pure).
 *
 * `applyExpression` layers a face and posture from the emotion model
 * (lib/world/emotion.ts) onto any animation pose: brows, extra lid closure,
 * head pitch / roll, torso slump and a nervous jitter. `applyGesture` adds a
 * short body gesture (facepalm, head shake, fist pump …) with a smooth
 * fade in and out, so it can play over idle, work or sitting poses.
 *
 * Axis conventions follow rig.ts: rot x < 0 raises an upper arm forward /
 * bends the elbow, rot z < 0 lifts the right arm sideways (left mirrored),
 * head rot x > 0 looks down, rot y turns, rot z rolls.
 */
import type { Expression } from "@/lib/world/emotion";
import {
  BROW_TRAVEL,
  LID_TRAVEL,
  RIG_UNIT,
  type CharacterPose,
  type RigPartName,
} from "@/lib/world/models/rig";

type V3 = [number, number, number];

function add(p: CharacterPose, n: RigPartName, rot: V3, pos?: V3, w = 1): void {
  const e = p[n];
  if (!e) return;
  e.rot = [e.rot[0] + rot[0] * w, e.rot[1] + rot[1] * w, e.rot[2] + rot[2] * w];
  if (pos) {
    const q = e.pos ?? [0, 0, 0];
    const k = w * RIG_UNIT;
    e.pos = [q[0] + pos[0] * k, q[1] + pos[1] * k, q[2] + pos[2] * k];
  }
}

const TAU = Math.PI * 2;

/** Face + posture overlay. `t` drives the jitter; `w` fades the whole overlay (0..1). */
export function applyExpression(pose: CharacterPose, ex: Expression, t: number, w = 1): void {
  // Brows: lift (pose units along y) and tilt.
  add(pose, "brows", [0, 0, ex.browTilt], [0, (BROW_TRAVEL / RIG_UNIT) * ex.brows * 0.9, 0], w);
  // Lids: extra closure, capped so blink + closure never exceed the travel.
  const lid = pose.lids;
  if (lid) {
    const cur = lid.pos?.[2] ?? 0;
    const want = cur + LID_TRAVEL * Math.max(0, ex.lids) * 0.75 * w;
    lid.pos = [lid.pos?.[0] ?? 0, lid.pos?.[1] ?? 0, Math.min(LID_TRAVEL, want)];
  }
  const j = ex.jitter * w;
  const nx = Math.sin(t * 23.1) * 0.5 + Math.sin(t * 37.7) * 0.5;
  const ny = Math.sin(t * 19.3 + 1.2) * 0.5 + Math.sin(t * 31.9) * 0.5;
  add(pose, "head", [ex.headPitch + j * 0.03 * nx, j * 0.04 * ny, ex.headRoll], undefined, w);
  add(pose, "torso", [ex.slump * 0.16, 0, j * 0.015 * nx], undefined, w);
  // Deflated shoulders: arms hang a touch more forward and in.
  if (ex.slump > 0) {
    add(pose, "upperArmR", [ex.slump * 0.08, 0, ex.slump * 0.05], undefined, w);
    add(pose, "upperArmL", [ex.slump * 0.08, 0, -ex.slump * 0.05], undefined, w);
  }
}

export const GESTURES = [
  "facepalm",
  "headShake",
  "nod",
  "fistPump",
  "shrug",
  "stretch",
  "sigh",
  "stomp",
  "clap",
  "scratchHead",
  "thumbsUp",
  "lookAround",
] as const;
export type Gesture = (typeof GESTURES)[number];

/** Gesture lengths (s). */
export const GESTURE_DURATION: Readonly<Record<Gesture, number>> = {
  facepalm: 2.2,
  headShake: 1.4,
  nod: 1.1,
  fistPump: 1.3,
  shrug: 1.5,
  stretch: 2.6,
  sigh: 2.0,
  stomp: 0.9,
  clap: 1.6,
  scratchHead: 2.0,
  thumbsUp: 1.4,
  lookAround: 2.8,
};

/** Fade envelope: 0 → 1 → 0 over the gesture (ramps of 0.25 s or 20 %). */
export function gestureWeight(g: Gesture, t: number): number {
  const d = GESTURE_DURATION[g];
  if (t <= 0 || t >= d) return 0;
  const r = Math.min(0.25, d * 0.2);
  const s = (x: number) => x * x * (3 - 2 * x);
  return s(Math.min(1, t / r)) * s(Math.min(1, (d - t) / r));
}

/** Add gesture `g` at local time `t` (seconds since it started). */
export function applyGesture(pose: CharacterPose, g: Gesture, t: number): void {
  const w = gestureWeight(g, t);
  if (w <= 0) return;
  switch (g) {
    case "facepalm":
      add(pose, "upperArmR", [-1.15, 0.45, 0.35], undefined, w);
      add(pose, "forearmR", [-2.35, 0.3, 0.1], undefined, w);
      add(pose, "head", [0.3 + 0.05 * Math.sin(TAU * 1.5 * t), 0, -0.05], undefined, w);
      add(pose, "torso", [0.1, 0, 0], undefined, w);
      break;
    case "headShake":
      add(pose, "head", [0.08, 0.38 * Math.sin(TAU * 2.8 * t), 0], undefined, w);
      break;
    case "nod":
      add(pose, "head", [0.22 * Math.max(0, Math.sin(TAU * 2 * t)), 0, 0], undefined, w);
      break;
    case "fistPump": {
      const pump = Math.max(0, Math.sin(TAU * 2.4 * t));
      add(pose, "upperArmR", [-0.5 - 0.6 * pump, 0, -0.25], undefined, w);
      add(pose, "forearmR", [-2.1 + 0.3 * pump, 0, 0], undefined, w);
      add(pose, "torso", [-0.05, 0.1, 0], undefined, w);
      add(pose, "head", [-0.12, 0, 0], undefined, w);
      break;
    }
    case "shrug":
      add(pose, "upperArmR", [-0.2, 0, -0.45], [0, 0.35, 0], w);
      add(pose, "upperArmL", [-0.2, 0, 0.45], [0, 0.35, 0], w);
      add(pose, "forearmR", [-1.3, 0.6, 0], undefined, w);
      add(pose, "forearmL", [-1.3, -0.6, 0], undefined, w);
      add(pose, "head", [0, 0, 0.18], undefined, w);
      break;
    case "stretch":
      add(pose, "upperArmR", [-2.7, 0, -0.35], undefined, w);
      add(pose, "upperArmL", [-2.7, 0, 0.35], undefined, w);
      add(pose, "forearmR", [-0.5, 0, 0], undefined, w);
      add(pose, "forearmL", [-0.5, 0, 0], undefined, w);
      add(pose, "torso", [-0.14, 0, 0], undefined, w);
      add(pose, "head", [-0.25, 0, 0], undefined, w);
      break;
    case "sigh": {
      const u = Math.sin((Math.PI * t) / GESTURE_DURATION.sigh);
      add(pose, "torso", [-0.08 + 0.22 * u, 0, 0], undefined, w);
      add(pose, "head", [0.25 * u, 0, 0.05], undefined, w);
      break;
    }
    case "stomp": {
      const lift = Math.max(0, Math.sin((TAU * t) / GESTURE_DURATION.stomp));
      add(pose, "thighR", [-0.7 * lift, 0, 0], undefined, w);
      add(pose, "shinR", [0.9 * lift, 0, 0], undefined, w);
      add(pose, "upperArmR", [0, 0, -0.35], undefined, w);
      add(pose, "upperArmL", [0, 0, 0.35], undefined, w);
      break;
    }
    case "clap": {
      const c = Math.sin(TAU * 3 * t);
      add(pose, "upperArmR", [-0.95, 0.55, 0.25], undefined, w);
      add(pose, "upperArmL", [-0.95, -0.55, -0.25], undefined, w);
      add(pose, "forearmR", [-1.45, 0.25 * c, 0], undefined, w);
      add(pose, "forearmL", [-1.45, -0.25 * c, 0], undefined, w);
      break;
    }
    case "scratchHead":
      add(pose, "upperArmR", [-2.35, 0.25, -0.6], undefined, w);
      add(pose, "forearmR", [-1.95 + 0.12 * Math.sin(TAU * 4 * t), 0, 0], undefined, w);
      add(pose, "head", [0.05, 0, 0.14], undefined, w);
      break;
    case "thumbsUp":
      add(pose, "upperArmR", [-1.1, 0, -0.25], undefined, w);
      add(pose, "forearmR", [-1.05, 0.4, 0], undefined, w);
      add(pose, "head", [-0.06, 0, -0.08], undefined, w);
      break;
    case "lookAround":
      add(
        pose,
        "head",
        [-0.04, 0.55 * Math.sin((TAU * t) / GESTURE_DURATION.lookAround), 0],
        undefined,
        w,
      );
      add(
        pose,
        "torso",
        [0, 0.12 * Math.sin((TAU * t) / GESTURE_DURATION.lookAround), 0],
        undefined,
        w,
      );
      break;
  }
}

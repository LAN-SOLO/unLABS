import { describe, expect, it } from "vitest";
import {
  BLINK_DURATION,
  CROUCH_DURATION,
  IDLE_FIDGETS,
  IDLE_FIDGET_DELAY,
  INTERACT_DURATION,
  LID_TRAVEL,
  POSE_KINDS,
  RIG_PART_NAMES,
  RIG_UNIT,
  RUN_FULL_SPEED,
  RUN_HZ,
  WALK_FULL_SPEED,
  activeProp,
  advanceGait,
  advanceIdle,
  animateCharacter,
  applyMat,
  blinkAmount,
  characterPose,
  damienRig,
  easeInOut,
  gaitPose,
  handProp,
  idleFidget,
  isPoseDone,
  jadeRig,
  jointMatrices,
  poseForDecorVerb,
  poseTrack,
  posedVoxels,
  restPose,
  approach,
  propForPose,
  propVoxels,
  restartPose,
  rigBounds,
  sampleTrack,
  switchPose,
  trackWeight,
  type CharacterPose,
  type CharacterPoseKind,
  type CharacterRigDef,
  type HandPropKind,
  type PoseTrack,
  type RigPartName,
} from "@/lib/world/models/rig";
import type { Vec3 } from "@/lib/world/models/anim";
import { C } from "@/lib/world/content/palette";

const FPS = 60;
const DT = 1 / FPS;
/** Rig voxels per pose unit: voxel distances below are written in pose units × U. */
const U = RIG_UNIT;
/** Largest joint change allowed between two consecutive 60 fps frames. */
const MAX_ROT_STEP = 0.5;
const MAX_POS_STEP = 1.0 * U;

const RIGS: [string, CharacterRigDef][] = [
  ["jade", jadeRig()],
  ["damien", damienRig(false)],
  ["damien holo", damienRig(true)],
];

/** Solid counterpart (same geometry, real colours) of a rig. */
const solidOf = (def: CharacterRigDef): CharacterRigDef =>
  def.id === "jade" ? def : damienRig(false);

function step(a: CharacterPose, b: CharacterPose): { rot: number; pos: number; part: string } {
  let rot = 0;
  let pos = 0;
  let part = "";
  for (const n of RIG_PART_NAMES) {
    for (let i = 0; i < 3; i++) {
      const r = Math.abs(a[n].rot[i]! - b[n].rot[i]!);
      const q = Math.abs((a[n].pos ?? [0, 0, 0])[i]! - (b[n].pos ?? [0, 0, 0])[i]!);
      if (Math.max(r, q) > Math.max(rot, pos)) part = n;
      rot = Math.max(rot, r);
      pos = Math.max(pos, q);
    }
  }
  return { rot, pos, part };
}

function expectSmooth(frames: CharacterPose[], label: string): void {
  for (let i = 1; i < frames.length; i++) {
    const s = step(frames[i - 1]!, frames[i]!);
    expect(s.rot, `${label} frame ${i} (${s.part}) rot`).toBeLessThanOrEqual(MAX_ROT_STEP);
    expect(s.pos, `${label} frame ${i} (${s.part}) pos`).toBeLessThanOrEqual(MAX_POS_STEP);
  }
}

function expectFinite(p: CharacterPose, label: string): void {
  for (const n of RIG_PART_NAMES) {
    for (const r of p[n].rot) {
      expect(Number.isFinite(r), `${label} ${n}`).toBe(true);
      expect(Math.abs(r), `${label} ${n}`).toBeLessThanOrEqual(Math.PI);
    }
    for (const q of p[n].pos ?? [0, 0, 0]) {
      expect(Number.isFinite(q), `${label} ${n}`).toBe(true);
      // The hips travel down to a seat / mattress (at most the leg length).
      expect(Math.abs(q), `${label} ${n}`).toBeLessThanOrEqual(n === "hips" ? 12 * U : 8 * U);
    }
  }
}

const lowestFoot = (def: CharacterRigDef, p: CharacterPose): number =>
  Math.min(
    ...posedVoxels(def, p)
      .filter((v) => v.part === "shinL" || v.part === "shinR")
      .map((v) => v.p[1] - 0.5),
  );

const centroid = (vs: Vec3[]): Vec3 => {
  const c: Vec3 = [0, 0, 0];
  for (const v of vs) for (let i = 0; i < 3; i++) c[i] = c[i]! + v[i]! / vs.length;
  return c;
};

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const jointPoint = (def: CharacterRigDef, p: CharacterPose, n: RigPartName, q: Vec3): Vec3 =>
  applyMat(jointMatrices(def, p).get(n)!, q);

describe("rig budget and face parts", () => {
  it.each(RIGS)("%s stays within the part and voxel budget", (_n, def) => {
    expect(def.parts.length).toBeLessThanOrEqual(RIG_PART_NAMES.length);
    expect(def.parts.length).toBeGreaterThanOrEqual(13);
    // Fine scale (2× per axis): ~5× the old voxel budget (1800 / 420 per part).
    expect(posedVoxels(def).length).toBeLessThan(10000);
    for (const p of def.parts) expect(p.model.grid.count(), p.name).toBeLessThanOrEqual(2600);
    const names = def.parts.map((p) => p.name);
    expect(names).toContain("brows");
    expect(names).toContain("lids");
    for (const n of ["brows", "lids"])
      expect(def.parts.find((p) => p.name === n)!.parent, n).toBe("head");
  });

  it.each(RIGS)("%s: lids hide inside the head at rest and cover the eyes mid-blink", (_n, def) => {
    // Front of the eye whites (head row 4), measured on the solid colours.
    const eyeZ = Math.max(
      ...posedVoxels(solidOf(def))
        .filter((v) => v.part === "head" && v.color === C.eye_white)
        .map((v) => v.p[2]),
    );
    const lidsZ = (p?: CharacterPose): number =>
      Math.max(
        ...posedVoxels(def, p)
          .filter((v) => v.part === "lids")
          .map((v) => v.p[2]),
      );
    expect(lidsZ()).toBeLessThan(eyeZ - 1);
    expect(lidsZ()).toBeGreaterThan(eyeZ - 1 - U);
    const closed = restPose();
    closed.lids = { rot: [0, 0, 0], pos: [0, 0, LID_TRAVEL] };
    expect(lidsZ(closed)).toBeGreaterThan(eyeZ);
    expect(lidsZ(closed)).toBeLessThan(eyeZ + 0.5);
  });
});

describe("pose kinds", () => {
  it("exports every activity pose", () => {
    for (const k of [
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
    ] as const)
      expect(POSE_KINDS).toContain(k);
  });

  it("every pose is finite over a long run, with fidgets and seeds", () => {
    for (const kind of POSE_KINDS)
      for (let t = -0.5; t < 40; t += 0.61)
        for (const seed of [0, 3]) expectFinite(characterPose(kind, t, 9, { seed }), kind);
  });

  it.each(RIGS)("%s: every pose clears the 6-unit door and stays on the floor", (_n, def) => {
    for (const kind of POSE_KINDS)
      for (let t = 0; t < 40; t += 0.53) {
        // "lie" is placed on a bed by the engine: see rig-seat.test.ts.
        if (kind === "lie") continue;
        const speed = kind === "run" ? RUN_FULL_SPEED : kind === "walk" ? WALK_FULL_SPEED : 0;
        const [min, max] = rigBounds(def, characterPose(kind, t, speed));
        expect(max[1], `${kind} @ ${t}`).toBeLessThan(6);
        expect(min[1], `${kind} @ ${t}`).toBeGreaterThan(-0.3);
      }
  });

  it("every kind animates continuously at 60 fps", () => {
    for (const kind of POSE_KINDS)
      for (const speed of kind === "walk" || kind === "run" || kind === "carry"
        ? [0, WALK_FULL_SPEED, RUN_FULL_SPEED]
        : [0]) {
        const frames: CharacterPose[] = [];
        for (let i = 0; i < 20 * FPS; i++)
          frames.push(characterPose(kind, i * DT, speed, { seed: 1, idleFor: i * DT + 5 }));
        expectSmooth(frames, `${kind}@${speed}`);
      }
  });

  it("walk and run are strictly periodic (no blinks mixed in)", () => {
    const maxStep = (a: CharacterPose, b: CharacterPose): number => {
      const s = step(a, b);
      return Math.max(s.rot, s.pos);
    };
    for (let t = 0; t < 3; t += 0.13) {
      expect(maxStep(characterPose("run", t), characterPose("run", t + 1 / RUN_HZ))).toBeLessThan(
        1e-9,
      );
    }
    const a = characterPose("run", 0.25 / RUN_HZ);
    expect(a.thighR.rot[0]).toBeLessThan(-0.6);
    expect(a.upperArmR.rot[0]).toBeGreaterThan(0.5);
    expect(a.forearmR.rot[0]).toBeLessThan(-1.2);
  });

  it.each(RIGS)("%s: running feet touch down and never sink into the floor", (_n, def) => {
    let lowest = Infinity;
    for (let i = 0; i < 24; i++) {
      const low = lowestFoot(def, characterPose("run", i / 24 / RUN_HZ));
      // No ankle: the toe cap may dip a little as the foot rolls off (see soleDrop).
      expect(low, `phase ${i}/24`).toBeGreaterThan(-1.0 * U);
      lowest = Math.min(lowest, low);
    }
    expect(lowest).toBeLessThan(0.3 * U);
  });

  it("crouch squats with planted feet, reaches low and returns to idle", () => {
    const def = jadeRig();
    const mid = characterPose("crouch", CROUCH_DURATION / 2);
    expect(mid.hips.pos![1]).toBeLessThan(-4 * U);
    const low = lowestFoot(def, mid);
    expect(low).toBeGreaterThan(-0.6 * U);
    expect(low).toBeLessThan(0.6 * U);
    expect(jointPoint(def, mid, "forearmR", [0, -5 * U, 0])[1]).toBeLessThan(6 * U);
    const after = CROUCH_DURATION + 0.2;
    const s = step(characterPose("crouch", after), characterPose("idle", after));
    expect(Math.max(s.rot, s.pos)).toBeLessThan(1e-9);
  });

  it("wave raises the right hand above the head and swings the forearm", () => {
    const def = jadeRig();
    const handY = (t: number): number =>
      jointPoint(def, characterPose("wave", t), "forearmR", [0, -5 * U, 0])[1];
    expect(handY(1)).toBeGreaterThan(28 * U);
    const zs = [1, 1.13, 1.26].map((t) => characterPose("wave", t).forearmR.rot[2]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.3);
  });

  it("typing keeps both forearms level over the keys and the fingers moving", () => {
    const p = characterPose("typing", 1);
    for (const n of ["forearmR", "forearmL"] as const) {
      const total = p[n].rot[0] + p[n === "forearmR" ? "upperArmR" : "upperArmL"].rot[0];
      expect(total, n).toBeLessThan(-1.2);
      expect(total, n).toBeGreaterThan(-1.9);
    }
    const a = characterPose("typing", 1.0).forearmR.rot[0];
    const b = characterPose("typing", 1.05).forearmR.rot[0];
    expect(Math.abs(a - b)).toBeGreaterThan(0.005);
  });

  it("listen nods to the beat, read looks down at the page, sit is seated", () => {
    const nods = [0, 0.15, 0.3].map((t) => characterPose("listen", 4 + t).head.rot[0]);
    expect(Math.max(...nods) - Math.min(...nods)).toBeGreaterThan(0.05);
    expect(characterPose("read", 2).head.rot[0]).toBeGreaterThan(0.3);
    expect(characterPose("sit", 2).hips.pos![1]).toBeLessThan(-4 * U);
  });
});

describe("face", () => {
  it("blinks every few seconds, briefly, fully closing", () => {
    let closed = 0;
    let peaks = 0;
    let prev = 0;
    const N = 60 * FPS;
    for (let i = 0; i < N; i++) {
      const b = blinkAmount(i * DT, 2);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
      if (b > 0.99) closed++;
      if (prev === 0 && b > 0) peaks++;
      prev = b;
    }
    expect(peaks).toBeGreaterThanOrEqual(12);
    expect(peaks).toBeLessThanOrEqual(30);
    expect(closed / N).toBeLessThan(0.05);
    expect(closed).toBeGreaterThan(0);
    expect(BLINK_DURATION).toBeLessThan(0.3);
  });

  it("different seeds blink at different times", () => {
    let diff = 0;
    for (let t = 0; t < 30; t += DT) if (blinkAmount(t, 0) > 0 !== blinkAmount(t, 7) > 0) diff++;
    expect(diff).toBeGreaterThan(10);
  });

  it("brows lift for celebrate / talk and furrow for think", () => {
    expect(characterPose("celebrate", 1).brows.pos![1]).toBeGreaterThan(0.2 * U);
    expect(characterPose("think", 1).brows.pos![1]).toBeLessThan(-0.1 * U);
    const talk = [0, 0.5, 1, 1.5, 2].map((t) => characterPose("talk", t).brows.pos![1]);
    expect(Math.max(...talk)).toBeGreaterThan(0.1 * U);
  });
});

describe("idle fidgets", () => {
  it("start after standing still and cycle through all kinds", () => {
    expect(idleFidget(IDLE_FIDGET_DELAY - 0.1)).toBeNull();
    expect(idleFidget(0)).toBeNull();
    const seen = new Set<string>();
    for (let t = IDLE_FIDGET_DELAY; t < 400; t += 0.25) {
      const f = idleFidget(t, 1);
      if (f) {
        seen.add(f.kind);
        expect(f.weight).toBeGreaterThan(0);
        expect(f.weight).toBeLessThanOrEqual(1);
      }
    }
    expect([...seen].sort()).toEqual([...IDLE_FIDGETS].sort());
  });

  it("change the idle pose only while playing", () => {
    for (let t = IDLE_FIDGET_DELAY; t < 200; t += 0.5) {
      const f = idleFidget(t, 0);
      if (!f || f.weight < 0.9) continue;
      const withF = characterPose("idle", 3, 0, { idleFor: t });
      const without = characterPose("idle", 3, 0, { idleFor: 0 });
      const s = step(withF, without);
      expect(Math.max(s.rot, s.pos), `${f.kind} @ ${t}`).toBeGreaterThan(0.2);
      return;
    }
    throw new Error("no fidget reached full weight");
  });

  it("the watch fidget brings the left wrist up in front of the chest", () => {
    const def = jadeRig();
    for (let t = IDLE_FIDGET_DELAY; t < 400; t += 0.1) {
      const f = idleFidget(t, 0);
      if (f?.kind !== "watch" || f.weight < 0.99) continue;
      const p = characterPose("idle", 0, 0, { idleFor: t });
      const wrist = jointPoint(def, p, "forearmL", [0, -3 * U, 0]);
      expect(wrist[1]).toBeGreaterThan(16 * U);
      expect(wrist[2]).toBeGreaterThan(2 * U);
      return;
    }
    throw new Error("no watch fidget found");
  });
});

describe("pose tracks (eased transitions)", () => {
  it("easeInOut is monotone from 0 to 1", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    let prev = -1;
    for (let u = -0.2; u <= 1.2; u += 0.01) {
      const e = easeInOut(u);
      expect(e).toBeGreaterThanOrEqual(prev);
      prev = e;
    }
  });

  it("switching between any two kinds never jumps", () => {
    for (const a of POSE_KINDS)
      for (const b of POSE_KINDS) {
        if (a === b) continue;
        let track: PoseTrack = poseTrack(a, 0);
        const frames: CharacterPose[] = [];
        for (let i = 0; i < 90; i++) {
          const now = 2 + i * DT;
          if (i === 30) track = switchPose(track, b, now);
          frames.push(sampleTrack(track, now));
        }
        expectSmooth(frames, `${a}→${b}`);
      }
  });

  it("interrupting a half-finished fade stays continuous", () => {
    let track = poseTrack("idle", 0);
    const frames: CharacterPose[] = [];
    const plan: [number, CharacterPoseKind][] = [
      [10, "sit"],
      [18, "celebrate"],
      [22, "crouch"],
      [25, "wave"],
      [27, "drink"],
      [29, "run"],
      [31, "idle"],
    ];
    for (let i = 0; i < 120; i++) {
      const now = 1 + i * DT;
      for (const [f, k] of plan) if (f === i) track = switchPose(track, k, now);
      frames.push(sampleTrack(track, now));
    }
    expectSmooth(frames, "chain");
    // The chain is pruned: never deeper than six tracks.
    let depth = 0;
    for (let t: PoseTrack | null = track; t; t = t.from) depth++;
    expect(depth).toBeLessThanOrEqual(6);
  });

  it("same kind is a no-op, restart replays a one-shot, done flags fire", () => {
    const t0 = poseTrack("idle", 0);
    expect(switchPose(t0, "idle", 5)).toBe(t0);
    const it1 = switchPose(t0, "interact", 1);
    expect(trackWeight(it1, 1)).toBe(0);
    expect(trackWeight(it1, 2)).toBe(1);
    expect(isPoseDone(it1, 1 + INTERACT_DURATION - 0.01)).toBe(false);
    expect(isPoseDone(it1, 1 + INTERACT_DURATION + 0.01)).toBe(true);
    const again = restartPose(it1, "interact", 3);
    expect(again.start).toBe(3);
    expect(isPoseDone(poseTrack("idle", 0), 100)).toBe(false);
  });
});

describe("locomotion", () => {
  it("advanceGait wraps and speeds up towards a run", () => {
    expect(advanceGait(0.9, 0.1, 0)).toBeGreaterThanOrEqual(0);
    expect(advanceGait(0.9, 0.1, 0)).toBeLessThan(1);
    const walk = advanceGait(0, 0.1, WALK_FULL_SPEED);
    const run = advanceGait(0, 0.1, RUN_FULL_SPEED);
    expect(run).toBeGreaterThan(walk);
  });

  it("accelerating from standstill to a sprint is smooth", () => {
    let phase = 0;
    const frames: CharacterPose[] = [];
    for (let i = 0; i < 6 * FPS; i++) {
      const speed = Math.min(RUN_FULL_SPEED, i * DT * 6);
      phase = advanceGait(phase, DT, speed);
      frames.push(gaitPose(phase, speed));
    }
    expectSmooth(frames, "gait ramp");
  });

  it("animateCharacter: walk in, act, stop, fidget — no pops, blinks keep going", () => {
    let track = poseTrack("idle", 0);
    let phase = 0;
    let walkW = 0;
    let still = 0;
    let speed = 0;
    const frames: CharacterPose[] = [];
    let blinked = false;
    for (let i = 0; i < 25 * FPS; i++) {
      const now = i * DT;
      const moving = (now > 1 && now < 4) || (now > 12 && now < 14);
      speed = approach(speed, moving ? (now > 12 ? RUN_FULL_SPEED : WALK_FULL_SPEED) : 0, DT, 6);
      walkW += ((moving ? 1 : 0) - walkW) * Math.min(1, DT * 8);
      phase = advanceGait(phase, DT, speed);
      still = advanceIdle(still, DT, moving, walkW);
      if (i === 5 * FPS) track = switchPose(track, "carry", now);
      if (i === 8 * FPS) track = switchPose(track, "drink", now);
      if (i === 11 * FPS) track = switchPose(track, "idle", now);
      const pose = animateCharacter({ track, now, gaitPhase: phase, speed, walkW, idleFor: still });
      if (moving && pose.lids.pos![2] > LID_TRAVEL / 2) blinked = true;
      frames.push(pose);
    }
    expectSmooth(frames, "animateCharacter");
    expect(blinked).toBe(true);
  });

  it("carry and drink keep their arms while walking", () => {
    const track = poseTrack("carry", 0);
    const standing = animateCharacter({ track, now: 1, gaitPhase: 0.25, speed: 13, walkW: 0 });
    const walking = animateCharacter({ track, now: 1, gaitPhase: 0.25, speed: 13, walkW: 1 });
    expect(Math.abs(walking.upperArmR.rot[0] - standing.upperArmR.rot[0])).toBeLessThan(0.2);
    expect(Math.abs(walking.thighR.rot[0])).toBeGreaterThan(0.3);
  });
});

describe("hand props", () => {
  const def = jadeRig();

  it("each prop has a model on a real joint", () => {
    for (const k of ["mug", "book", "crate", "wrench"] as HandPropKind[]) {
      const p = handProp(k);
      expect(p.model.grid.count(), k).toBeGreaterThan(0);
      expect(def.parts.map((x) => x.name)).toContain(p.joint);
    }
    expect(propForPose("drink")).toBe("mug");
    expect(propForPose("read")).toBe("book");
    expect(propForPose("carry")).toBe("crate");
    expect(propForPose("work")).toBe("wrench");
    expect(propForPose("idle")).toBeNull();
  });

  it("the mug sits in the hand and reaches the mouth on a sip", () => {
    const hold = characterPose("drink", 0.3);
    const sip = characterPose("drink", 1.95);
    const mug = handProp("mug");
    const hand = jointPoint(def, hold, "forearmR", [0, -4 * U, 0]);
    expect(dist(centroid(propVoxels(def, mug, hold)), hand)).toBeLessThan(3 * U);
    const mouth = jointPoint(def, sip, "head", [0, 2.5 * U, 5.5 * U]);
    expect(dist(centroid(propVoxels(def, mug, sip)), mouth)).toBeLessThan(2.5 * U);
  });

  it("the crate sits between the hands, the book under the eyes", () => {
    const carry = characterPose("carry", 1);
    const crate = propVoxels(def, handProp("crate"), carry);
    const xs = crate.map((v) => v[0]);
    const hr = jointPoint(def, carry, "forearmR", [0, -4 * U, 0]);
    const hl = jointPoint(def, carry, "forearmL", [0, -4 * U, 0]);
    expect(Math.abs(hr[0] - Math.min(...xs))).toBeLessThan(2 * U);
    expect(Math.abs(hl[0] - Math.max(...xs))).toBeLessThan(2 * U);
    const read = characterPose("read", 1);
    const book = centroid(propVoxels(def, handProp("book"), read));
    const eyes = jointPoint(def, read, "head", [0, 4.5 * U, 3 * U]);
    expect(book[1]).toBeLessThan(eyes[1]);
    expect(book[2]).toBeGreaterThan(3 * U);
    for (const n of ["forearmR", "forearmL"] as const)
      expect(dist(jointPoint(def, read, n, [0, -4 * U, 0]), book)).toBeLessThan(5.5 * U);
  });

  it("activeProp follows the dominant track", () => {
    let t = poseTrack("idle", 0);
    expect(activeProp(t, 0)).toBeNull();
    t = switchPose(t, "drink", 1, 0.4);
    expect(activeProp(t, 1.05)).toBeNull();
    expect(activeProp(t, 1.5)).toBe("mug");
    t = switchPose(t, "carry", 2, 0.4);
    expect(activeProp(t, 2.05)).toBe("mug");
    expect(activeProp(t, 2.5)).toBe("crate");
  });
});

describe("decor verbs", () => {
  it("map onto poses", () => {
    expect(poseForDecorVerb("trinken")).toBe("drink");
    expect(poseForDecorVerb("lesen")).toBe("read");
    expect(poseForDecorVerb("hören")).toBe("listen");
    expect(poseForDecorVerb("sitzen")).toBe("sit");
    expect(poseForDecorVerb("ansehen")).toBe("think");
    expect(poseForDecorVerb("benutzen", "synth")).toBe("typing");
    expect(poseForDecorVerb("benutzen", "coffee_machine")).toBe("work");
    expect(poseForDecorVerb("???")).toBe("interact");
  });
});

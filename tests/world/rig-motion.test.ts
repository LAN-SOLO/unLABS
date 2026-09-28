import { describe, expect, it } from "vitest";
import {
  CHILL_DELAY,
  CLIMB_HZ,
  HEAD_LOOK_MAX,
  IDLE_FIDGET_DELAY,
  POSE_KINDS,
  RIG_PART_NAMES,
  RIG_UNIT,
  STARTLE_DURATION,
  advanceGait,
  advanceIdle,
  animateCharacter,
  applyMat,
  approach,
  approachAngle,
  cageMotion,
  characterPose,
  chillTarget,
  idleFidget,
  isPoseDone,
  jadeRig,
  jointMatrices,
  lookYaw,
  poseTrack,
  posedVoxels,
  sampleTrack,
  switchPose,
  wrapAngle,
  type CageMotion,
  type CharacterPose,
  type CharacterPoseKind,
  type RigPartName,
} from "@/lib/world/models/rig";
import type { Vec3 } from "@/lib/world/models/anim";
import { elevatorDuration, elevatorPose } from "@/lib/world/render/doors";

const FPS = 60;
const DT = 1 / FPS;
const def = jadeRig();
/** Rig voxels per pose unit: voxel distances below are written in pose units × U. */
const U = RIG_UNIT;

function maxStep(a: CharacterPose, b: CharacterPose): { d: number; part: string } {
  let d = 0;
  let part = "";
  for (const n of RIG_PART_NAMES)
    for (let i = 0; i < 3; i++) {
      const r = Math.abs(a[n].rot[i]! - b[n].rot[i]!);
      const q = Math.abs((a[n].pos ?? [0, 0, 0])[i]! - (b[n].pos ?? [0, 0, 0])[i]!) / (2 * U);
      if (Math.max(r, q) > d) {
        d = Math.max(r, q);
        part = n;
      }
    }
  return { d, part };
}

/** Same thresholds as rig-animation: 0.5 rad / 1 pose unit (U voxels) per 60 fps frame. */
function expectSmooth(frames: CharacterPose[], label: string): void {
  for (let i = 1; i < frames.length; i++) {
    const s = maxStep(frames[i - 1]!, frames[i]!);
    expect(s.d, `${label} frame ${i} (${s.part})`).toBeLessThanOrEqual(0.5);
  }
}

const at = (p: CharacterPose, n: RigPartName, q: Vec3): Vec3 =>
  applyMat(jointMatrices(def, p).get(n)!, q);
const hand = (p: CharacterPose, side: "R" | "L"): Vec3 => at(p, `forearm${side}`, [0, -4 * U, 0]);
const eyes = (p: CharacterPose): Vec3 => at(p, "head", [0, 4.5 * U, 3 * U]);
const shoulderY = (p: CharacterPose): number => at(p, "upperArmR", [0, 0, 0])[1];
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lowestFoot = (p: CharacterPose): number =>
  Math.min(
    ...posedVoxels(def, p)
      .filter((v) => v.part === "shinL" || v.part === "shinR")
      .map((v) => v.p[1] - 0.5),
  );
const footLift = (p: CharacterPose, side: "R" | "L"): number =>
  Math.min(
    ...posedVoxels(def, p)
      .filter((v) => v.part === `shin${side}`)
      .map((v) => v.p[1] - 0.5),
  );

describe("new pose kinds", () => {
  it("exports ride, climb and startle", () => {
    for (const k of ["ride", "climb", "startle"] as const) expect(POSE_KINDS).toContain(k);
  });

  it("switching into and out of the new kinds never jumps", () => {
    const kinds: CharacterPoseKind[] = ["idle", "walk", "talk", "ride", "climb", "startle"];
    for (const a of kinds)
      for (const b of kinds) {
        if (a === b) continue;
        let track = poseTrack(a, 0);
        const frames: CharacterPose[] = [];
        for (let i = 0; i < 120; i++) {
          const now = 3 + i * DT;
          if (i === 40) track = switchPose(track, b, now);
          frames.push(sampleTrack(track, now));
        }
        expectSmooth(frames, `${a}→${b}`);
      }
  });
});

describe("ride (cage lift)", () => {
  it("steps in: the right foot lifts first, then the left, then both stand", () => {
    const p0 = characterPose("ride", 0.24);
    expect(footLift(p0, "R")).toBeGreaterThan(footLift(p0, "L") + 0.5 * U);
    const p1 = characterPose("ride", 0.61);
    expect(footLift(p1, "L")).toBeGreaterThan(footLift(p1, "R") + 0.5 * U);
    for (let t = 1.5; t < 20; t += 0.7)
      expect(Math.abs(lowestFoot(characterPose("ride", t)))).toBeLessThan(0.7 * U);
  });

  it("holds the rail with the right hand up and out, the left hangs", () => {
    for (let t = 1.5; t < 12; t += 1.3) {
      const p = characterPose("ride", t);
      const r = hand(p, "R");
      const l = hand(p, "L");
      // Right side is −x in character space; the hand is out past the shoulder, near its height.
      expect(r[0]).toBeLessThan(at(p, "upperArmR", [0, 0, 0])[0] - 3 * U);
      expect(r[1]).toBeGreaterThan(shoulderY(p) - 3 * U);
      expect(l[1]).toBeLessThan(shoulderY(p) - 6 * U);
    }
  });

  it("sways without ever popping, also with cage load and rattle", () => {
    const frames: CharacterPose[] = [];
    let cage: CageMotion = { offset: 0, vel: 0, load: 0 };
    let load = 0;
    let rattle = 0;
    let track = poseTrack("idle", 0);
    const T = elevatorDuration();
    for (let i = 0; i < (T + 2) * FPS; i++) {
      const now = i * DT;
      const rt = now - 0.5;
      if (i === 30) track = switchPose(track, "ride", now);
      const riding = rt >= 0 && rt < T;
      const pose = riding ? elevatorPose(rt, -1) : null;
      if (pose && pose.stage === "gate-open") track = switchPose(track, "idle", now);
      if (pose) cage = cageMotion(cage, pose.offset, DT);
      load = approach(load, pose ? cage.load : 0, DT, 5);
      rattle = approach(rattle, pose ? Math.min(1, Math.abs(cage.vel) / 3) : 0, DT, 6);
      frames.push(
        animateCharacter({
          track,
          now,
          gaitPhase: 0,
          speed: 0,
          walkW: 0,
          load,
          rattle,
          idleFor: now,
        }),
      );
    }
    expectSmooth(frames, "ride");
  });

  it("cageMotion: presses on braking, goes light on a downward start, ignores the floor flip", () => {
    const T = elevatorDuration();
    let c: CageMotion = { offset: 0, vel: 0, load: 0 };
    let minLoad = 0;
    let maxLoad = 0;
    for (let t = DT; t < T; t += DT) {
      c = cageMotion(c, elevatorPose(t, -1).offset, DT);
      expect(Math.abs(c.load)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.vel)).toBeLessThan(15);
      minLoad = Math.min(minLoad, c.load);
      maxLoad = Math.max(maxLoad, c.load);
    }
    expect(minLoad).toBeLessThan(-0.5);
    expect(maxLoad).toBeGreaterThan(0.5);
    const flip = cageMotion({ offset: -3.9, vel: -8, load: 0 }, 3.9, DT);
    expect(flip.load).toBe(0);
    expect(flip.vel).toBe(-8);
  });

  it("load bends the knees, negative load lifts the hair", () => {
    const track = poseTrack("ride", 0);
    const base = { track, now: 3, gaitPhase: 0, speed: 0, walkW: 0 };
    const calm = animateCharacter(base);
    const press = animateCharacter({ ...base, load: 1 });
    const light = animateCharacter({ ...base, load: -1 });
    expect(press.hips.pos![1]).toBeLessThan(calm.hips.pos![1]);
    expect(press.shinR.rot[0]).toBeGreaterThan(calm.shinR.rot[0]);
    expect(light.hairBack.rot[0]).toBeGreaterThan(calm.hairBack.rot[0]);
  });
});

describe("climb (emergency ladder)", () => {
  it("alternates hands and knees: right hand high with the left knee up", () => {
    const q = 1 / CLIMB_HZ;
    for (const t of [0.25 * q, 1.25 * q, 2.25 * q]) {
      const p = characterPose("climb", t);
      expect(hand(p, "R")[1]).toBeGreaterThan(hand(p, "L")[1] + U);
      expect(footLift(p, "L")).toBeGreaterThan(footLift(p, "R") + U);
      const m = characterPose("climb", t + q / 2);
      expect(hand(m, "L")[1]).toBeGreaterThan(hand(m, "R")[1] + U);
      expect(footLift(m, "R")).toBeGreaterThan(footLift(m, "L") + U);
    }
  });

  it("both hands stay up on the rungs above the shoulders", () => {
    for (let t = 0; t < 6; t += 0.13) {
      const p = characterPose("climb", t);
      expect(hand(p, "R")[1]).toBeGreaterThan(shoulderY(p));
      expect(hand(p, "L")[1]).toBeGreaterThan(shoulderY(p));
    }
  });

  it("the limb cycle repeats every 1 / CLIMB_HZ", () => {
    const q = 1 / CLIMB_HZ;
    for (const t of [0.1, 0.7, 1.3]) {
      const a = characterPose("climb", t);
      const b = characterPose("climb", t + q);
      for (const n of ["upperArmR", "forearmL", "thighL", "shinR"] as const)
        expect(Math.abs(a[n].rot[0] - b[n].rot[0]), n).toBeLessThan(1e-6);
    }
  });
});

describe("startle", () => {
  it("flinches back with raised brows and settles into idle", () => {
    const idle = characterPose("idle", 0.3);
    const p = characterPose("startle", 0.3);
    expect(p.torso.rot[0]).toBeLessThan(idle.torso.rot[0] - 0.1);
    expect(p.brows.pos![1]).toBeGreaterThan(idle.brows.pos![1] + 0.2 * U);
    expect(hand(p, "R")[1]).toBeGreaterThan(hand(idle, "R")[1] + U);
    const late = maxStep(
      characterPose("startle", STARTLE_DURATION + 0.1),
      characterPose("idle", STARTLE_DURATION + 0.1),
    );
    expect(late.d).toBeLessThan(1e-9);
    const tr = switchPose(poseTrack("idle", 0), "startle", 2);
    expect(isPoseDone(tr, 2 + STARTLE_DURATION - 0.05)).toBe(false);
    expect(isPoseDone(tr, 2 + STARTLE_DURATION + 0.05)).toBe(true);
  });
});

describe("idle variety", () => {
  const fullFidget = (kind: string): CharacterPose => {
    for (let t = IDLE_FIDGET_DELAY; t < 800; t += 0.05) {
      const f = idleFidget(t, 0);
      if (f?.kind === kind && f.weight > 0.99 && f.u > 1.1 && f.u < 1.35)
        return characterPose("idle", 0, 0, { idleFor: t });
    }
    throw new Error(`no ${kind} fidget`);
  };

  it("adjusting the goggles brings the right hand up to the forehead", () => {
    const p = fullFidget("goggles");
    const h = hand(p, "R");
    expect(dist(h, eyes(p))).toBeLessThan(5 * U);
    expect(h[1]).toBeGreaterThan(eyes(p)[1] - 1.5 * U);
  });

  it("tucking the hair brings the right hand beside the head", () => {
    const p = fullFidget("hair");
    const h = hand(p, "R");
    expect(dist(h, eyes(p))).toBeLessThan(6 * U);
    expect(h[0]).toBeLessThan(eyes(p)[0]);
  });

  it("advanceIdle keeps counting until the walk has taken over", () => {
    expect(advanceIdle(5, 0.1, false, 0)).toBeCloseTo(5.1);
    expect(advanceIdle(5, 0.1, true, 0.5)).toBeCloseTo(5.1);
    expect(advanceIdle(5, 0.1, true, 0.99)).toBe(0);
  });

  it("starting to walk mid-fidget never pops", () => {
    for (const kind of ["goggles", "hair", "stretch", "watch"]) {
      // Find a fidget at full weight, then start walking right there.
      let start = -1;
      for (let t = IDLE_FIDGET_DELAY; t < 800 && start < 0; t += 0.05) {
        const f = idleFidget(t, 0);
        if (f?.kind === kind && f.weight > 0.99) start = t;
      }
      expect(start, kind).toBeGreaterThan(0);
      let idle = start;
      let walkW = 0;
      let speed = 0;
      let phase = 0;
      const track = poseTrack("idle", 0);
      const frames: CharacterPose[] = [];
      for (let i = 0; i < 2 * FPS; i++) {
        const now = 10 + i * DT;
        walkW = approach(walkW, 1, DT, 8);
        speed = approach(speed, 13, DT, 6);
        phase = advanceGait(phase, DT, speed);
        idle = advanceIdle(idle, DT, true, walkW);
        frames.push(
          animateCharacter({ track, now, gaitPhase: phase, speed, walkW, idleFor: idle }),
        );
      }
      expectSmooth(frames, kind);
    }
  });
});

describe("look at a running device", () => {
  it("lookYaw turns towards the side of the target, never behind", () => {
    expect(lookYaw(0, 0, 5)).toBeCloseTo(0);
    expect(lookYaw(0, 3, 3)).toBeCloseTo(Math.PI / 4);
    expect(lookYaw(0, -3, 3)).toBeCloseTo(-Math.PI / 4);
    expect(lookYaw(0, 5, 0)).toBe(HEAD_LOOK_MAX);
    expect(lookYaw(0, 0, -5)).toBeNull();
    expect(lookYaw(Math.PI / 2, 5, 0)).toBeCloseTo(0);
    expect(lookYaw(Math.PI - 0.1, 0.5, -5)).not.toBeNull();
    expect(lookYaw(0, 0, 0)).toBeNull();
  });

  it("wrapAngle / approachAngle take the short way round", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-0.5)).toBeCloseTo(-0.5);
    let a = 3;
    for (let i = 0; i < 120; i++) {
      const next = approachAngle(a, -3, DT, 6);
      expect(Math.abs(wrapAngle(next - a))).toBeLessThan(0.1);
      a = next;
    }
    expect(Math.abs(wrapAngle(a + 3))).toBeLessThan(0.01);
  });

  it("the look turns head + torso by the requested yaw", () => {
    const track = poseTrack("idle", 0);
    const base = { track, now: 2, gaitPhase: 0, speed: 0, walkW: 0 };
    const a = animateCharacter(base);
    const b = animateCharacter({ ...base, look: { yaw: 0.8, weight: 1 } });
    const turned = b.head.rot[1] + b.torso.rot[1] - (a.head.rot[1] + a.torso.rot[1]);
    expect(turned).toBeCloseTo(0.8);
    const half = animateCharacter({ ...base, look: { yaw: 0.8, weight: 0.5 } });
    expect(half.head.rot[1] + half.torso.rot[1] - (a.head.rot[1] + a.torso.rot[1])).toBeCloseTo(
      0.4,
    );
  });
});

describe("chill on deep floors", () => {
  it("chillTarget: cold floors, plain idle, after standing a while", () => {
    expect(chillTarget(3, CHILL_DELAY + 1, "idle")).toBe(1);
    expect(chillTarget(5, CHILL_DELAY + 1, "idle")).toBe(1);
    expect(chillTarget(3, CHILL_DELAY - 1, "idle")).toBe(0);
    expect(chillTarget(0, 100, "idle")).toBe(0);
    expect(chillTarget(3, 100, "typing")).toBe(0);
  });

  it("hugs the arms round the chest and shivers, smoothly in and out", () => {
    const track = poseTrack("idle", 0);
    const frames: CharacterPose[] = [];
    let chill = 0;
    let shiver = 0;
    let hugged = false;
    for (let i = 0; i < 16 * FPS; i++) {
      const now = i * DT;
      const want = now > 0.5 && now < 9 ? 1 : 0;
      chill = approach(chill, want, DT, 1.2);
      const p = animateCharacter({
        track,
        now,
        gaitPhase: 0,
        speed: 0,
        walkW: 0,
        idleFor: 0,
        chill,
      });
      frames.push(p);
      if (chill > 0.95) {
        const cold = animateCharacter({ track, now, gaitPhase: 0, speed: 0, walkW: 0, idleFor: 0 });
        shiver = Math.max(shiver, Math.abs(p.torso.rot[2] - cold.torso.rot[2]));
        const r = hand(p, "R");
        const l = hand(p, "L");
        // Both hands in front of the chest, close to the middle.
        if (
          Math.abs(r[0]) < 3.5 * U &&
          Math.abs(l[0]) < 3.5 * U &&
          r[2] > 3.5 * U &&
          l[2] > 3.5 * U
        )
          hugged = true;
      }
    }
    expectSmooth(frames, "chill");
    expect(shiver).toBeGreaterThan(0.01);
    expect(hugged).toBe(true);
  });

  it("walking lets go of the hug", () => {
    const track = poseTrack("idle", 0);
    const base = { track, now: 5, gaitPhase: 0.2, speed: 13, idleFor: 0 };
    const walk = animateCharacter({ ...base, walkW: 1 });
    const walkCold = animateCharacter({ ...base, walkW: 1, chill: 1 });
    expect(maxStep(walk, walkCold).d).toBeLessThan(1e-9);
  });
});

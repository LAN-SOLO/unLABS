import { describe, expect, it } from "vitest";
import {
  CHARACTER_SCALE,
  LIE_BACK_HEIGHT,
  LIE_ENTER_DURATION,
  LIE_EXIT_DURATION,
  LID_TRAVEL,
  POSE_KINDS,
  RIG_PART_NAMES,
  SIT_ENTER_DURATION,
  SIT_EXIT_DURATION,
  SIT_SEAT_HEIGHT,
  SIT_SEAT_OFFSET,
  animateCharacter,
  applyMat,
  characterPose,
  jadeRig,
  jointMatrices,
  poseTrack,
  posedVoxels,
  sampleTrack,
  seatRootProgress,
  switchPose,
  transitionDuration,
  type CharacterPose,
  type CharacterPoseKind,
  type PosedVoxel,
  type RigPartName,
} from "@/lib/world/models/rig";

const def = jadeRig();
const S = CHARACTER_SCALE;
const FPS = 60;
const DT = 1 / FPS;

const vox = (p: CharacterPose, parts: RigPartName[]): PosedVoxel[] =>
  posedVoxels(def, p).filter((v) => parts.includes(v.part));
const lowest = (vs: PosedVoxel[]): number => Math.min(...vs.map((v) => v.p[1] - 0.5));
const hipJoint = (p: CharacterPose): number[] =>
  applyMat(jointMatrices(def, p).get("thighR")!, [0, 0, 0]);

/** Voxels of part A whose (rounded) cell is also filled by part B. */
function overlap(p: CharacterPose, a: RigPartName, b: RigPartName): number {
  const cells = new Set<string>();
  const vs = posedVoxels(def, p);
  for (const v of vs) if (v.part === b) cells.add(v.p.map((x) => Math.round(x)).join(","));
  let n = 0;
  for (const v of vs) if (v.part === a && cells.has(v.p.map((x) => Math.round(x)).join(","))) n++;
  return n;
}

function maxStep(a: CharacterPose, b: CharacterPose): number {
  let d = 0;
  for (const n of RIG_PART_NAMES)
    for (let i = 0; i < 3; i++) {
      d = Math.max(d, Math.abs(a[n].rot[i]! - b[n].rot[i]!));
      d = Math.max(d, Math.abs((a[n].pos ?? [0, 0, 0])[i]! - (b[n].pos ?? [0, 0, 0])[i]!) / 4);
    }
  return d;
}

function expectSmooth(frames: CharacterPose[], label: string): void {
  for (let i = 1; i < frames.length; i++)
    expect(maxStep(frames[i - 1]!, frames[i]!), `${label} frame ${i}`).toBeLessThanOrEqual(0.5);
}

describe("seat contract", () => {
  it("exports lie as a pose kind and sensible durations", () => {
    expect(POSE_KINDS).toContain("lie");
    expect(SIT_ENTER_DURATION).toBeGreaterThan(0.6);
    expect(LIE_ENTER_DURATION).toBeGreaterThan(SIT_ENTER_DURATION);
    expect(transitionDuration("sit", "idle")).toBe(SIT_EXIT_DURATION);
    expect(transitionDuration("lie", "walk")).toBe(LIE_EXIT_DURATION);
  });

  it("SIT_SEAT_HEIGHT is the underside of the seated thighs / buttocks (whole seated loop)", () => {
    for (let t = SIT_ENTER_DURATION + 0.4; t < 30; t += 0.9) {
      const p = characterPose("sit", t);
      const seat = lowest(vox(p, ["hips", "thighR", "thighL", "coatTail"]));
      expect(seat * S, `t=${t}`).toBeCloseTo(SIT_SEAT_HEIGHT, 1);
      expect(Math.abs(seat - SIT_SEAT_HEIGHT / S), `t=${t}`).toBeLessThan(0.6);
      // Arms and torso never hang below the seat.
      expect(lowest(vox(p, ["forearmR", "forearmL", "torso"])), `t=${t}`).toBeGreaterThan(
        SIT_SEAT_HEIGHT / S,
      );
    }
  });

  it("SIT_SEAT_OFFSET is directly below the hip joints, feet flat on the floor at the root", () => {
    const p = characterPose("sit", SIT_ENTER_DURATION + 2);
    expect(hipJoint(p)[2]! * S).toBeCloseTo(SIT_SEAT_OFFSET, 1);
    expect(SIT_SEAT_OFFSET).toBeLessThan(-0.5);
    for (const side of ["shinR", "shinL"] as const) {
      const shin = vox(p, [side]);
      expect(Math.abs(lowest(shin)), side).toBeLessThan(0.6);
      const soles = shin.filter((v) => v.p[1] < 1);
      const z = soles.reduce((a, v) => a + v.p[2], 0) / soles.length;
      expect(Math.abs(z), side).toBeLessThan(2.5);
    }
  });

  it("LIE_BACK_HEIGHT is the back contact; nothing sinks below it while lying", () => {
    for (let t = LIE_ENTER_DURATION + 0.2; t < 40; t += 1.1) {
      const p = characterPose("lie", t);
      const back = lowest(vox(p, ["hips", "torso"]));
      // Breathing lifts the chest a fraction of a voxel.
      expect(Math.abs(back - LIE_BACK_HEIGHT / S), `t=${t}`).toBeLessThan(0.5);
      expect(lowest(posedVoxels(def, p)), `t=${t}`).toBeGreaterThan(LIE_BACK_HEIGHT / S - 0.6);
      // Along local z: head towards −z, feet towards +z, hip joints at the root's x/z.
      const [hx, , hz] = hipJoint(p);
      expect(Math.abs(hz!), `t=${t}`).toBeLessThan(1.5);
      expect(Math.abs(hx! + 3), `t=${t}`).toBeLessThan(1);
      const head = vox(p, ["head"]);
      expect(Math.max(...head.map((v) => v.p[2])), `t=${t}`).toBeLessThan(-15);
      const feet = vox(p, ["shinL"]);
      expect(Math.max(...feet.map((v) => v.p[2])), `t=${t}`).toBeGreaterThan(18);
      // Low: a body on a mattress, not a plank in the air.
      expect(Math.max(...vox(p, ["torso", "hips"]).map((v) => v.p[1])), `t=${t}`).toBeLessThan(14);
    }
  });

  it("seatRootProgress runs from 0 to 1 without going backwards", () => {
    for (const kind of ["sit", "lie"] as const)
      for (const dir of ["enter", "exit"] as const) {
        const T =
          kind === "sit"
            ? dir === "enter"
              ? SIT_ENTER_DURATION
              : SIT_EXIT_DURATION
            : dir === "enter"
              ? LIE_ENTER_DURATION
              : LIE_EXIT_DURATION;
        let prev = { pos: 0, yaw: 0 };
        expect(seatRootProgress(kind, dir, 0).pos).toBeCloseTo(0, 5);
        for (let t = 0; t <= T + 1e-9; t += T / 50) {
          const r = seatRootProgress(kind, dir, t);
          expect(r.pos).toBeGreaterThanOrEqual(prev.pos - 1e-12);
          expect(r.yaw).toBeGreaterThanOrEqual(prev.yaw - 1e-12);
          prev = r;
        }
        expect(prev.pos, `${kind} ${dir}`).toBeCloseTo(1, 3);
      }
  });
});

describe("sitting down and standing up", () => {
  it("sit-down keeps the feet planted, looks back at the seat and ends on the seat", () => {
    let looked = false;
    for (let t = 0; t <= SIT_ENTER_DURATION + 0.5; t += 0.05) {
      const p = characterPose("sit", t);
      for (const side of ["shinR", "shinL"] as const) {
        const shin = vox(p, [side]);
        expect(lowest(shin), `${side} t=${t}`).toBeGreaterThan(-0.8);
        expect(lowest(shin), `${side} t=${t}`).toBeLessThan(0.8);
      }
      if (p.head.rot[1] < -0.35) looked = true;
    }
    expect(looked).toBe(true);
    // The hips drop and move back monotonically.
    let y = Infinity;
    for (let t = 0.2; t <= SIT_ENTER_DURATION; t += 0.05) {
      const h = hipJoint(characterPose("sit", t))[1]!;
      expect(h).toBeLessThanOrEqual(y + 0.3);
      y = h;
    }
  });

  it("seated: hands rest on the thighs, no limb cuts through another", () => {
    for (let t = SIT_ENTER_DURATION + 0.5; t < 25; t += 0.7) {
      const p = characterPose("sit", t);
      for (const [a, b] of [
        ["forearmR", "thighR"],
        ["forearmL", "thighL"],
        ["thighR", "thighL"],
        ["shinR", "shinL"],
        ["forearmR", "head"],
      ] as const)
        expect(overlap(p, a, b), `${a}/${b} t=${t}`).toBeLessThanOrEqual(4);
      const j = jointMatrices(def, p);
      const palm = applyMat(j.get("forearmR")!, [0, -8.5, 0]);
      const thighTop = Math.max(...vox(p, ["thighR"]).map((v) => v.p[1] + 0.5));
      expect(Math.abs(palm[1]! - thighTop), `t=${t}`).toBeLessThan(4);
    }
  });

  it("standing up (any switch away from sit) leans forward, keeps the feet and ends standing", () => {
    for (const to of ["idle", "walk", "talk"] as CharacterPoseKind[]) {
      let track = poseTrack("sit", 0);
      const frames: CharacterPose[] = [];
      let leaned = false;
      for (let i = 0; i < 6 * FPS; i++) {
        const now = i * DT;
        if (i === 4 * FPS) track = switchPose(track, to, now);
        const p = sampleTrack(track, now);
        frames.push(p);
        if (i > 4 * FPS) {
          for (const side of ["shinR", "shinL"] as const)
            expect(lowest(vox(p, [side])), `${to} ${side} @${now}`).toBeGreaterThan(-0.8);
          if (p.torso.rot[0] + p.hips.rot[0] > 0.3) leaned = true;
        }
      }
      expectSmooth(frames, `sit→${to}`);
      expect(leaned, to).toBe(true);
      const end = frames[frames.length - 1]!;
      expect(hipJoint(end)[1]!, to).toBeGreaterThan(22);
    }
  });

  it("interrupting the sit-down half way stands back up smoothly", () => {
    let track = poseTrack("idle", 0);
    const frames: CharacterPose[] = [];
    for (let i = 0; i < 3 * FPS; i++) {
      const now = i * DT;
      if (i === 10) track = switchPose(track, "sit", now);
      if (i === 45) track = switchPose(track, "idle", now);
      frames.push(sampleTrack(track, now));
    }
    expectSmooth(frames, "sit interrupted");
  });
});

describe("lying down and getting up", () => {
  it("lie-down: sits on the edge first, then reclines; get-up reverses it smoothly", () => {
    let track = poseTrack("idle", 0);
    const frames: CharacterPose[] = [];
    let sat = false;
    for (let i = 0; i < 9 * FPS; i++) {
      const now = i * DT;
      if (i === 30) track = switchPose(track, "lie", now);
      if (i === 6 * FPS) track = switchPose(track, "idle", now);
      const p = sampleTrack(track, now);
      frames.push(p);
      // Sitting upright on the edge before lying back.
      const up = p.hips.rot[0] + p.torso.rot[0];
      if (hipJoint(p)[1]! < 8 && Math.abs(up) < 0.4) sat = true;
    }
    expectSmooth(frames, "lie in / out");
    expect(sat).toBe(true);
    expect(hipJoint(frames[frames.length - 1]!)[1]!).toBeGreaterThan(22);
  });

  it("eyes drift shut while lying (blinks keep their own clock)", () => {
    const track = poseTrack("lie", 0);
    const shut = animateCharacter({ track, now: 8, gaitPhase: 0, speed: 0, walkW: 0 });
    expect(shut.lids.pos![2]).toBeGreaterThan(0.9 * LID_TRAVEL);
    const awake = animateCharacter({
      track: poseTrack("idle", 0),
      now: 8.05,
      gaitPhase: 0,
      speed: 0,
      walkW: 0,
    });
    expect(awake.lids.pos![2]).toBeLessThan(LID_TRAVEL);
  });

  it("lying: hands rest on the stomach, above the torso's front", () => {
    const p = characterPose("lie", LIE_ENTER_DURATION + 3);
    const torsoTop = Math.max(...vox(p, ["torso"]).map((v) => v.p[1] + 0.5));
    for (const n of ["forearmR", "forearmL"] as const) {
      const palm = applyMat(jointMatrices(def, p).get(n)!, [0, -8.5, 0]);
      expect(palm[1]!, n).toBeGreaterThan(torsoTop - 1);
      expect(palm[1]!, n).toBeLessThan(torsoTop + 5);
      expect(Math.abs(palm[0]!), n).toBeLessThan(6);
    }
  });
});

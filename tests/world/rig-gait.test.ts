import { describe, expect, it } from "vitest";
import {
  CHARACTER_SCALE,
  POSE_KINDS,
  RUN_FULL_SPEED,
  RUN_HZ,
  WALK_FULL_SPEED,
  WALK_HZ,
  animateCharacter,
  applyMat,
  characterPose,
  gaitHz,
  gaitPose,
  jadeRig,
  jointMatrices,
  poseTrack,
  posedVoxels,
  stanceFootSpeed,
  type CharacterPose,
  type RigPartName,
} from "@/lib/world/models/rig";
import type { Vec3 } from "@/lib/world/models/anim";

const def = jadeRig();
const S = CHARACTER_SCALE;

const at = (p: CharacterPose, n: RigPartName, q: Vec3): Vec3 =>
  applyMat(jointMatrices(def, p).get(n)!, q);
const hipY = (p: CharacterPose): number => at(p, "thighR", [0, 0, 0])[1];
const footZ = (p: CharacterPose, side: "R" | "L"): number => at(p, `shin${side}`, [0, -12, 0])[2];

describe("gait cadence and stride", () => {
  it("WALK_HZ / RUN_HZ are the cadences at the walker's walk and full-run speeds", () => {
    expect(gaitHz(WALK_FULL_SPEED)).toBeCloseTo(WALK_HZ, 6);
    expect(gaitHz(RUN_FULL_SPEED)).toBeCloseTo(RUN_HZ, 6);
    // Faster → quicker steps, never slower.
    let prev = 0;
    for (let v = 0; v <= 30; v += 0.5) {
      expect(gaitHz(v)).toBeGreaterThanOrEqual(prev - 0.25);
      prev = gaitHz(v);
    }
  });

  it("the planted foot glides back exactly as fast as the walker moves (no skating)", () => {
    for (const v of [2, 6, 13, 16, 20, 26]) expect(stanceFootSpeed(v)).toBeCloseTo(v, 6);
  });

  it("measured: floor-contact points move at −speed while planted", () => {
    const pts: Vec3[] = [
      [0, -12, -4],
      [0, -12, 0.5],
      [0, -12, 5],
    ];
    for (const v of [6, WALK_FULL_SPEED, RUN_FULL_SPEED]) {
      const hz = gaitHz(v);
      const N = 300;
      const dt = 1 / hz / N;
      const sample = (i: number): Vec3[] => {
        const p = gaitPose(i / N, v);
        const out: Vec3[] = [];
        for (const s of ["R", "L"] as const) for (const q of pts) out.push(at(p, `shin${s}`, q));
        return out;
      };
      const vel: number[] = [];
      let prev = sample(0);
      for (let i = 1; i <= N; i++) {
        const cur = sample(i);
        cur.forEach((c, k) => {
          const pr = prev[k]!;
          if (c[1] < 0.5 && pr[1] < 0.5) vel.push(((c[2] - pr[2]) / dt) * S);
        });
        prev = cur;
      }
      vel.sort((a, b) => a - b);
      const median = vel[vel.length >> 1]!;
      expect(Math.abs(median + v) / v, `speed ${v}`).toBeLessThan(0.12);
    }
  });

  it("a real stride: long enough for the speed, legs within reach, feet on the floor", () => {
    for (const v of [WALK_FULL_SPEED, RUN_FULL_SPEED]) {
      let front = -Infinity;
      let back = Infinity;
      for (let i = 0; i < 48; i++) {
        const p = gaitPose(i / 48, v);
        for (const s of ["R", "L"] as const) {
          front = Math.max(front, footZ(p, s));
          back = Math.min(back, footZ(p, s));
        }
        const low = Math.min(
          ...posedVoxels(def, p)
            .filter((x) => x.part === "shinR" || x.part === "shinL")
            .map((x) => x.p[1] - 0.5),
        );
        expect(low, `v=${v} ${i}/48`).toBeGreaterThan(-2.4);
        expect(low, `v=${v} ${i}/48`).toBeLessThan(v === RUN_FULL_SPEED ? 2.5 : 0.8);
      }
      expect(front - back, `v=${v}`).toBeGreaterThan(20);
      expect(front - back, `v=${v}`).toBeLessThan(32);
    }
  });
});

describe("walk shape", () => {
  const T = 1 / WALK_HZ;
  const walk = (phase: number): CharacterPose => characterPose("walk", phase * T, WALK_FULL_SPEED);

  it("heel strike: the leading foot lands ahead, toe up; the trailing one pushes off, heel up", () => {
    const p = walk(0.25); // right heel strike
    expect(footZ(p, "R")).toBeGreaterThan(8);
    expect(footZ(p, "L")).toBeLessThan(-8);
    const shinWorld = (side: "R" | "L"): number =>
      p[`thigh${side}`].rot[0] + p[`shin${side}`].rot[0] + p.hips.rot[0];
    expect(shinWorld("R")).toBeLessThan(-0.1);
    expect(shinWorld("L")).toBeGreaterThan(0.1);
    // Passing: the swing knee bends to clear the floor.
    expect(walk(0).shinR.rot[0]).toBeGreaterThan(0.8);
  });

  it("bobs: low at heel strike, high over the stance foot", () => {
    const contact = hipY(walk(0.25));
    const passing = hipY(walk(0.5));
    expect(passing - contact).toBeGreaterThan(1.5);
    expect(passing - contact).toBeLessThan(4.5);
  });

  it("shoulders counter-rotate against the hips and the arms swing against the legs", () => {
    const p = walk(0.25);
    expect(p.hips.rot[1]).toBeGreaterThan(0.05);
    expect(p.torso.rot[1] + p.hips.rot[1]).toBeLessThan(-0.03);
    // Right leg forward ↔ right arm back.
    expect(p.upperArmR.rot[0]).toBeGreaterThan(0.2);
    expect(p.upperArmL.rot[0]).toBeLessThan(-0.2);
    // The head keeps looking ahead.
    expect(Math.abs(p.head.rot[1] + p.torso.rot[1] + p.hips.rot[1])).toBeLessThan(0.02);
  });

  it("arm swing and lean grow with speed", () => {
    const swing = (v: number): number => {
      let m = 0;
      for (let i = 0; i < 16; i++) m = Math.max(m, Math.abs(gaitPose(i / 16, v).upperArmR.rot[0]));
      return m;
    };
    expect(swing(4)).toBeLessThan(swing(WALK_FULL_SPEED));
    expect(swing(WALK_FULL_SPEED)).toBeLessThan(swing(RUN_FULL_SPEED));
    expect(gaitPose(0.3, RUN_FULL_SPEED).torso.rot[0]).toBeGreaterThan(
      gaitPose(0.3, WALK_FULL_SPEED).torso.rot[0],
    );
  });

  it("standing still means straight legs", () => {
    const p = gaitPose(0.4, 0);
    for (const n of ["thighR", "thighL", "shinR", "shinL"] as const)
      expect(Math.abs(p[n].rot[0]), n).toBeLessThan(1e-6);
  });
});

describe("start, stop and turns", () => {
  const base = {
    track: poseTrack("idle", 0),
    now: 3,
    gaitPhase: 0.3,
    speed: WALK_FULL_SPEED,
    walkW: 1,
  };

  it("leans into acceleration and sits back when braking", () => {
    const steady = animateCharacter(base);
    const go = animateCharacter({ ...base, accel: 30 });
    const brake = animateCharacter({ ...base, accel: -30 });
    expect(go.torso.rot[0]).toBeGreaterThan(steady.torso.rot[0] + 0.1);
    expect(brake.torso.rot[0]).toBeLessThan(steady.torso.rot[0] - 0.1);
  });

  it("banks into a turn around the feet", () => {
    const steady = animateCharacter(base);
    const left = animateCharacter({ ...base, turnRate: 3 });
    // Turning left (+facing) leans towards her left (+x): hips roll negative.
    expect(left.hips.rot[2]).toBeLessThan(steady.hips.rot[2] - 0.05);
    const feet = (p: CharacterPose): number =>
      (at(p, "shinR", [0, -12, 0])[0] + at(p, "shinL", [0, -12, 0])[0]) / 2;
    expect(Math.abs(feet(left) - feet(steady))).toBeLessThan(1.2);
  });
});

describe("joint limits", () => {
  it("knees never bend backwards, elbows never hyperextend", () => {
    for (const kind of POSE_KINDS)
      for (let t = 0; t < 30; t += 0.09)
        for (const seed of [0, 3]) {
          const speed = kind === "walk" ? 13 : kind === "run" ? 20 : kind === "carry" ? 9 : 0;
          const p = characterPose(kind, t, speed, { seed, idleFor: t + 2 });
          for (const n of ["shinR", "shinL"] as const)
            expect(p[n].rot[0], `${kind} ${n} @${t}`).toBeGreaterThan(-0.05);
          for (const n of ["forearmR", "forearmL"] as const)
            expect(p[n].rot[0], `${kind} ${n} @${t}`).toBeLessThan(0.05);
        }
  });
});

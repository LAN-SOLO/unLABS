import { describe, expect, it } from "vitest";
import { HairSim, invertRigid, type GuideDef } from "@/lib/hair/sim";

/** A straight strand hanging from (0, 10, 0) along +x (rest), 12 particles. */
function strand(stiffRoot = 0.1, stiffTip = 0.0): GuideDef {
  const rest = new Float32Array(12 * 3);
  for (let i = 0; i < 12; i++) rest.set([i * 0.5, 10, 0], i * 3);
  return { rest, stiffRoot, stiffTip };
}

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translate = (x: number, y: number, z: number) => [
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  x,
  y,
  z,
  1,
];

describe("hair simulation", () => {
  it("starts in the groomed pose", () => {
    const sim = new HairSim([strand()]);
    sim.update(1 / 60, I);
    expect(sim.pos[3 * 11]).toBeCloseTo(5.5, 5);
    expect(sim.maxStretch()).toBeLessThan(1e-5);
  });

  it("falls under gravity without stretching, and stays finite", () => {
    const sim = new HairSim([strand(0.02, 0)], { gravity: [0, -400, 0] });
    sim.update(0, I);
    for (let f = 0; f < 240; f++) sim.update(1 / 60, I);
    const tipY = sim.pos[3 * 11 + 1]!;
    expect(tipY).toBeLessThan(8);
    expect(sim.maxStretch()).toBeLessThan(0.02);
    for (const v of sim.pos) expect(Number.isFinite(v)).toBe(true);
  });

  it("keeps a stiff (styled) strand in shape", () => {
    const sim = new HairSim([strand(0.95, 0.9)], { gravity: [0, -400, 0] });
    sim.update(0, I);
    for (let f = 0; f < 120; f++) sim.update(1 / 60, I);
    expect(Math.abs(sim.pos[3 * 11 + 1]! - 10)).toBeLessThan(0.3);
  });

  it("drags behind a moving head (inertia) and snaps after a teleport", () => {
    const sim = new HairSim([strand(0.05, 0)]);
    sim.update(0, I);
    // Head moves along +z: the tip lags behind the root.
    for (let f = 1; f <= 20; f++) sim.update(1 / 60, translate(0, 0, f * 0.2));
    expect(sim.pos[3 * 11 + 2]!).toBeLessThan(sim.pos[2]! - 0.1);
    // A teleport far away: no whip, the hair snaps to the rest pose there.
    sim.update(1 / 60, translate(5000, 0, 0));
    expect(sim.pos[3 * 11]!).toBeCloseTo(5005.5, 3);
  });

  it("pushes particles out of colliders", () => {
    const sim = new HairSim([strand(0.0, 0.0)], { gravity: [0, -400, 0] });
    sim.addCollider({ frame: "head", a: [3, 8, 0], r: 1.5 });
    sim.update(0, I);
    for (let f = 0; f < 200; f++) sim.update(1 / 60, I);
    for (let i = 2; i < 12; i++) {
      const d = Math.hypot(sim.pos[i * 3]! - 3, sim.pos[i * 3 + 1]! - 8, sim.pos[i * 3 + 2]!);
      expect(d).toBeGreaterThan(1.5 - 0.15);
    }
  });

  it("inverts rigid transforms", () => {
    const m = [0, 2, 0, 0, -2, 0, 0, 0, 0, 0, 2, 0, 3, 4, 5, 1]; // rot 90° about z, scale 2, translate
    const inv = invertRigid(m);
    const p = [1, 2, 3];
    const w = [
      m[0]! * p[0]! + m[4]! * p[1]! + m[8]! * p[2]! + m[12]!,
      m[1]! * p[0]! + m[5]! * p[1]! + m[9]! * p[2]! + m[13]!,
      m[2]! * p[0]! + m[6]! * p[1]! + m[10]! * p[2]! + m[14]!,
    ];
    const back = [
      inv[0]! * w[0]! + inv[4]! * w[1]! + inv[8]! * w[2]! + inv[12]!,
      inv[1]! * w[0]! + inv[5]! * w[1]! + inv[9]! * w[2]! + inv[13]!,
      inv[2]! * w[0]! + inv[6]! * w[1]! + inv[10]! * w[2]! + inv[14]!,
    ];
    back.forEach((v, i) => expect(v).toBeCloseTo(p[i]!, 5));
  });
});

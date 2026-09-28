import { describe, expect, it } from "vitest";
import {
  BOT_IDS,
  BOT_MAX_HEIGHT,
  BOT_SCALE,
  botModel,
  botVisual,
  damienModel,
  damienSolidModel,
  jadeModel,
} from "@/lib/world/models/characters";
import {
  CHARACTER_SCALE,
  INTERACT_DURATION,
  POSE_KINDS,
  RIG_PART_NAMES,
  RIG_UNIT,
  WALK_HZ,
  blendPose,
  characterPose,
  damienRig,
  jadeRig,
  posedVoxels,
  restPose,
  rigBounds,
  type CharacterPose,
  type CharacterRigDef,
} from "@/lib/world/models/rig";

const RIGS: [string, CharacterRigDef][] = [
  ["jade", jadeRig()],
  ["damien", damienRig(false)],
  ["damien holo", damienRig(true)],
];

const DOOR_HEIGHT = 6;
/** Rig voxels per pose unit: voxel distances below are written in pose units × U. */
const U = RIG_UNIT;

function maxDiff(a: CharacterPose, b: CharacterPose): number {
  let d = 0;
  for (const n of RIG_PART_NAMES) {
    for (let i = 0; i < 3; i++) {
      d = Math.max(d, Math.abs(a[n].rot[i]! - b[n].rot[i]!));
      d = Math.max(d, Math.abs((a[n].pos ?? [0, 0, 0])[i]! - (b[n].pos ?? [0, 0, 0])[i]!));
    }
  }
  return d;
}

describe("character rigs", () => {
  it.each(RIGS)("%s: hierarchy is valid (parents first, no cycles, known names)", (_n, def) => {
    const seen = new Set<string>();
    const roots = def.parts.filter((p) => p.parent === null);
    expect(roots.map((p) => p.name)).toEqual(["hips"]);
    for (const p of def.parts) {
      expect(RIG_PART_NAMES).toContain(p.name);
      expect(seen.has(p.name), `duplicate ${p.name}`).toBe(false);
      if (p.parent) expect(seen.has(p.parent), `${p.name} before its parent`).toBe(true);
      seen.add(p.name);
      expect(p.model.grid.count(), p.name).toBeGreaterThan(0);
      expect(p.scale).toBe(def.scale);
      for (const v of [...p.pivot, ...p.origin]) expect(Number.isFinite(v)).toBe(true);
    }
    for (const n of ["torso", "head", "upperArmL", "upperArmR", "forearmL", "forearmR"])
      expect(seen.has(n), n).toBe(true);
    for (const n of ["thighL", "thighR", "shinL", "shinR"]) expect(seen.has(n), n).toBe(true);
  });

  it.each(RIGS)("%s: fits through 6-unit doors and the walker box", (_n, def) => {
    const [min, max] = rigBounds(def);
    expect(max[1] - min[1]).toBeLessThan(5.8);
    expect(max[1] - min[1]).toBeGreaterThan(4.8);
    expect(min[1]).toBeGreaterThanOrEqual(-0.01);
    expect(max[0] - min[0]).toBeLessThan(2.8);
    expect(max[2] - min[2]).toBeLessThan(2.8);
    expect(def.scale).toBe(CHARACTER_SCALE);
  });

  it.each(RIGS)("%s: every pose stays under the door frame", (_n, def) => {
    for (const kind of POSE_KINDS)
      for (let t = 0; t < 4; t += 0.37) {
        const [min, max] = rigBounds(def, characterPose(kind, t, 13));
        expect(max[1], `${kind} @ ${t}`).toBeLessThan(DOOR_HEIGHT);
        expect(min[1], `${kind} @ ${t}`).toBeGreaterThan(-0.6);
      }
  });

  it("jade wears goggles, a badge and a coat tail; damien has none", () => {
    const jade = jadeRig();
    const names = jade.parts.map((p) => p.name);
    expect(names).toContain("hairBack");
    expect(names).toContain("coatTail");
    expect(damienRig(false).parts.map((p) => p.name)).not.toContain("coatTail");
  });

  it("the hologram uses two glass colours and has scanline gaps", () => {
    const solid = posedVoxels(damienRig(false));
    const holo = posedVoxels(damienRig(true));
    expect(new Set(holo.map((v) => v.color)).size).toBeLessThanOrEqual(2);
    expect(holo.length).toBeLessThan(solid.length * 0.9);
    expect(holo.length).toBeGreaterThan(solid.length * 0.6);
  });
});

describe("character poses", () => {
  it("every pose is finite and bounded", () => {
    for (const kind of POSE_KINDS)
      for (let t = -1; t < 20; t += 0.23)
        for (const speed of [0, 4, 13, 20]) {
          const p = characterPose(kind, t, speed);
          for (const n of RIG_PART_NAMES) {
            for (const r of p[n].rot) {
              expect(Number.isFinite(r)).toBe(true);
              expect(Math.abs(r)).toBeLessThanOrEqual(Math.PI);
            }
            for (const q of p[n].pos ?? [0, 0, 0]) {
              expect(Number.isFinite(q)).toBe(true);
              expect(Math.abs(q)).toBeLessThanOrEqual(8 * U);
            }
          }
        }
  });

  it("the walk cycle is periodic and actually moves", () => {
    const period = 1 / WALK_HZ;
    for (let t = 0; t < 2; t += 0.17) {
      expect(
        maxDiff(characterPose("walk", t, 13), characterPose("walk", t + period, 13)),
      ).toBeLessThan(1e-9);
    }
    const a = characterPose("walk", 0.25 * period, 13);
    const b = characterPose("walk", 0.75 * period, 13);
    // Contra-lateral: right leg forward while right arm swings back, then the reverse.
    expect(a.thighR.rot[0]).toBeLessThan(-0.3);
    expect(a.upperArmR.rot[0]).toBeGreaterThan(0.2);
    expect(b.thighR.rot[0]).toBeGreaterThan(0.3);
    expect(b.thighL.rot[0]).toBeLessThan(-0.3);
    // Standing still means no stride.
    expect(Math.abs(characterPose("walk", 0.3, 0).thighR.rot[0])).toBeLessThan(1e-9);
  });

  it("the stance foot stays near the floor through the walk cycle", () => {
    const def = jadeRig();
    for (let i = 0; i < 12; i++) {
      const t = i / 12 / WALK_HZ;
      const feet = posedVoxels(def, characterPose("walk", t, 13)).filter(
        (v) => v.part === "shinL" || v.part === "shinR",
      );
      const low = Math.min(...feet.map((v) => v.p[1] - 0.5));
      // + 0.5: a half-size voxel's centre sits half a (fine) voxel closer to its edge.
      expect(Math.abs(low), `t=${t}`).toBeLessThan(1.5 * U + 0.5);
    }
  });

  it("interact reaches forward and settles back", () => {
    const mid = characterPose("interact", INTERACT_DURATION / 2);
    expect(mid.upperArmR.rot[0]).toBeLessThan(-0.9);
    const after = characterPose("interact", INTERACT_DURATION + 0.1);
    expect(maxDiff(after, characterPose("idle", INTERACT_DURATION + 0.1))).toBeLessThan(1e-9);
  });

  it("think raises a hand to the chin, celebrate pumps a fist overhead", () => {
    const def = jadeRig();
    const handY = (p: CharacterPose): number =>
      Math.max(
        ...posedVoxels(def, p)
          .filter((v) => v.part === "forearmR")
          .map((v) => v.p[1]),
      );
    expect(handY(characterPose("think", 1))).toBeGreaterThan(19 * U);
    expect(handY(characterPose("celebrate", 0.2))).toBeGreaterThan(26 * U);
    expect(handY(restPose())).toBeLessThan(18 * U);
  });

  it("blendPose interpolates per part", () => {
    const a = characterPose("idle", 1);
    const b = characterPose("sit", 1);
    expect(maxDiff(blendPose(a, b, 0), a)).toBeLessThan(1e-12);
    expect(maxDiff(blendPose(a, b, 1), b)).toBeLessThan(1e-12);
    const h = blendPose(a, b, 0.5);
    expect(h.thighR.rot[0]).toBeCloseTo((a.thighR.rot[0] + b.thighR.rot[0]) / 2, 10);
  });
});

describe("legacy character parts", () => {
  it("keep the five-piece rig contract", () => {
    for (const parts of [jadeModel(), damienModel(), damienSolidModel()]) {
      expect(parts.legL.h).toBe(parts.hip);
      expect(parts.body.w).toBe(parts.width);
      expect(parts.shoulder).toBeGreaterThan(parts.hip);
      expect(parts.shoulder).toBeLessThanOrEqual(parts.hip + parts.body.h);
      expect(parts.scale).toBe(CHARACTER_SCALE);
      expect((parts.hip + parts.body.h) * CHARACTER_SCALE).toBeLessThan(5.8);
      for (const m of [parts.body, parts.legL, parts.legR, parts.armL, parts.armR])
        expect(m.grid.count()).toBeGreaterThan(0);
    }
  });
});

describe("bots", () => {
  it.each(BOT_IDS.map((id) => [id]))("%s stays within 3 world units and animates", (id) => {
    const v = botVisual(id);
    expect(v.scale).toBe(BOT_SCALE);
    expect(v.height ?? v.base.h).toBeLessThanOrEqual(BOT_MAX_HEIGHT);
    expect((v.height ?? v.base.h) * BOT_SCALE).toBeLessThanOrEqual(3);
    expect(Math.max(v.base.w, v.base.d) * BOT_SCALE).toBeLessThanOrEqual(3.5);
    expect(v.parts.length).toBeGreaterThanOrEqual(1);
    expect(v.parts.every((p) => !p.requiresPower && !p.parent)).toBe(true);
    expect(botModel(id).grid.count()).toBe(v.base.grid.count());
  });

  it("D3-C4D3 shows a live face screen", () => {
    const s = botVisual("d3c4d3").screens ?? [];
    expect(s.map((x) => x.content)).toContain("face");
    expect(s.every((x) => !x.requiresPower)).toBe(true);
  });

  it("W2-REK scuttles on six legs in a tripod gait", () => {
    const legs = botVisual("w2rek").parts.filter((p) => p.name.startsWith("leg_"));
    expect(legs).toHaveLength(6);
    const phase = (n: string): number => legs.find((p) => p.name === n)!.phase ?? 0;
    expect(Math.cos(phase("leg_r0") - phase("leg_l1"))).toBeCloseTo(1);
    expect(Math.cos(phase("leg_r0") - phase("leg_l0"))).toBeCloseTo(-1);
  });
});

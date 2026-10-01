import { describe, expect, it } from "vitest";
import { buildJadeHero } from "@/lib/world/hero/build";
import { JADE_HERO_JOINTS } from "@/lib/world/hero/skeleton";

const name = (i: number) => JADE_HERO_JOINTS[i]!.name;
const ARMS = new Set(["upperArmR", "forearmR", "upperArmL", "forearmL"]);
const LEGS = new Set(["thighR", "shinR", "thighL", "shinL"]);

/** Bones a layer's vertices use (weight > 0.001). */
function bonesOf(layer: { skinIndex: Uint16Array; skinWeight: Float32Array }): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < layer.skinIndex.length; i++)
    if (layer.skinWeight[i]! > 0.001) out.add(name(layer.skinIndex[i]!));
  return out;
}

describe("hero skin weights (no cloth webs under the arms)", () => {
  const layers = buildJadeHero("game");
  const by = new Map(layers.map((l) => [l.id, l]));

  it("splits shirt and coat into bodies and sleeves", () => {
    for (const id of ["shirt", "shirtSleeves", "coat", "coatSleeves"])
      expect(by.has(id), id).toBe(true);
  });

  it("garment bodies never follow the arms; the trousers never the arms; the coat never the legs", () => {
    for (const id of ["shirt", "coat"])
      for (const b of bonesOf(by.get(id)!)) expect(ARMS.has(b), `${id}: ${b}`).toBe(false);
    for (const b of bonesOf(by.get("coat")!)) expect(LEGS.has(b), `coat: ${b}`).toBe(false);
    for (const b of bonesOf(by.get("trousers")!)) expect(ARMS.has(b), `trousers: ${b}`).toBe(false);
  });

  it("sleeves follow one arm each (plus the torso at the seam)", () => {
    for (const id of ["shirtSleeves", "coatSleeves"]) {
      const l = by.get(id)!;
      for (let v = 0; v < l.positions.length / 3; v++) {
        const side = l.positions[v * 3]! < 0 ? "R" : "L";
        for (let k = 0; k < 4; k++) {
          if (l.skinWeight[v * 4 + k]! <= 0.001) continue;
          const b = name(l.skinIndex[v * 4 + k]!);
          expect(
            b === "torso" || b === `upperArm${side}` || b === `forearm${side}`,
            `${id}: ${b}`,
          ).toBe(true);
        }
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { buildDamienHero } from "@/lib/world/hero/damien-build";
import {
  DAMIEN_HERO_JOINTS,
  DAMIEN_UNIT,
  DOOR_HEIGHT_LIMIT,
  damienCoversRig,
} from "@/lib/world/hero/damien-skeleton";
import { JADE_HERO_JOINTS } from "@/lib/world/hero/skeleton";
import { buildDamienRig } from "@/lib/world/render/hero/damien-rig";

const layers = buildDamienHero("game");

describe("hero Damien", () => {
  it("has every rig joint, with the same parents as Jade's hero skeleton", () => {
    expect(damienCoversRig()).toBe(true);
    expect(DAMIEN_HERO_JOINTS.map((j) => [j.name, j.parent])).toEqual(
      JADE_HERO_JOINTS.map((j) => [j.name, j.parent]),
    );
  });

  it("is tall but fits through doors, and taller than Jade", () => {
    let top = 0;
    for (const l of layers)
      for (let i = 1; i < l.positions.length; i += 3) top = Math.max(top, l.positions[i]!);
    const h = top * DAMIEN_UNIT;
    expect(h).toBeLessThan(DOOR_HEIGHT_LIMIT);
    expect(h).toBeGreaterThan(5.67);
  });

  it("stays within the game triangle budget", () => {
    const tris = layers.reduce((n, l) => n + l.indices.length / 3, 0);
    expect(tris).toBeLessThanOrEqual(60_000);
    for (const l of layers) {
      // Every vertex is bound with weights summing to 1.
      for (let v = 0; v < l.skinWeight.length; v += 4) {
        const s =
          l.skinWeight[v]! + l.skinWeight[v + 1]! + l.skinWeight[v + 2]! + l.skinWeight[v + 3]!;
        expect(Math.abs(s - 1)).toBeLessThan(1e-4);
      }
    }
  });

  it("veiled, wears nothing but the veil (no face, hair or skin colours)", () => {
    const rig = buildDamienRig(layers);
    expect(rig.veiled).toBe(true);
    const mats = new Set(rig.meshes.map((m) => m.material));
    expect(mats.size).toBe(1);
    const veil = [...mats][0] as { userData: { veil?: unknown }; blending: number };
    expect(veil.userData.veil).toBeDefined();
    for (const m of rig.meshes) expect(m.castShadow).toBe(false);
    rig.dispose();
  });
});

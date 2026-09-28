import { describe, expect, it } from "vitest";

import { C } from "@/lib/world/content/palette";
import { PICKUPS, PROPS } from "@/lib/world/content/map";
import type { Model } from "@/lib/world/models/core";
import {
  PICKUP_MODEL_KEYS,
  PROP_MODEL_KEYS,
  pickupModel,
  propModel,
  propVisual,
} from "@/lib/world/models/props";

/** [w, h, d, voxels] before the hero pass — footprints are a contract. */
const PROP_BASELINE: Record<string, [number, number, number, number]> = {
  console: [12, 12, 8, 627],
  bigterminal: [24, 16, 10, 1974],
  bench: [14, 8, 8, 272],
  valve: [8, 12, 8, 141],
  junction: [12, 14, 4, 392],
  forge: [28, 22, 28, 2276],
  elevator: [12, 2, 12, 174],
  desk: [14, 12, 8, 466],
  board: [12, 14, 2, 238],
  pult: [12, 12, 8, 631],
  chair: [6, 10, 6, 118],
  plant: [6, 12, 6, 153],
  pipe: [4, 14, 16, 160],
  cable: [2, 1, 2, 4],
  rack: [8, 14, 6, 672],
  lamp: [2, 6, 2, 24],
  barrel: [6, 8, 6, 208],
  sofa: [14, 7, 7, 525],
};

const PICKUP_BASELINE: Record<string, [number, number, number, number]> = {
  crate: [6, 5, 6, 180],
  scrap: [8, 4, 8, 124],
  shelf: [10, 12, 4, 300],
  seep: [8, 4, 8, 64],
  locker: [6, 12, 5, 360],
  canister: [6, 8, 6, 180],
  crystal: [6, 8, 6, 168],
  paper: [3, 1, 3, 9],
  tape: [4, 2, 3, 24],
  screen: [4, 4, 2, 32],
};

/** Allowed voxel growth per model (base + animated parts). */
const BUDGET = 1.5;

function count(m: Model): number {
  let n = 0;
  m.grid.forEach(() => n++);
  return n;
}

function colours(m: Model): Set<number> {
  const s = new Set<number>();
  m.grid.forEach((_x, _y, _z, v) => s.add(v));
  return s;
}

describe("prop hero pass", () => {
  it("covers every prop model used on the map", () => {
    for (const p of PROPS) expect(PROP_MODEL_KEYS, p.id).toContain(p.model);
    expect([...PROP_MODEL_KEYS].sort()).toEqual(Object.keys(PROP_BASELINE).sort());
  });

  it("keeps every prop footprint and stays within the voxel budget", () => {
    for (const [id, [w, h, d, voxels]] of Object.entries(PROP_BASELINE)) {
      const m = propModel(id);
      expect([m.w, m.d], id).toEqual([w, d]);
      expect(m.h, id).toBeGreaterThanOrEqual(h);
      const n = count(m);
      expect(n, id).toBeGreaterThanOrEqual(voxels * 0.95);
      expect(n, id).toBeLessThanOrEqual(Math.ceil(voxels * BUDGET));
    }
  });

  it("keeps pickup models exactly the same size and within budget", () => {
    for (const p of PICKUPS) expect(PICKUP_MODEL_KEYS, p.id).toContain(p.model);
    for (const [id, [w, h, d, voxels]] of Object.entries(PICKUP_BASELINE)) {
      const m = pickupModel(id);
      expect([m.w, m.h, m.d], id).toEqual([w, h, d]);
      const n = count(m);
      expect(n, id).toBeGreaterThan(voxels * 0.5);
      expect(n, id).toBeLessThanOrEqual(Math.ceil(voxels * BUDGET));
    }
  });

  it("builds deterministic models", () => {
    for (const id of PROP_MODEL_KEYS) {
      const a = propModel(id);
      const b = propModel(id);
      a.grid.forEach((x, y, z, v) => expect(b.grid.get(x, y, z), id).toBe(v));
      expect(count(a)).toBe(count(b));
    }
  });

  it("makes the Infinity Forge the biggest, glowing, crystal-bearing prop", () => {
    const forge = propModel("forge");
    for (const id of PROP_MODEL_KEYS) {
      if (id === "forge") continue;
      expect(count(propModel(id)), id).toBeLessThan(count(forge));
    }
    // Stands clearly taller than the lab walls (WALL_HEIGHT 8 = 16 model voxels).
    expect(forge.h).toBeGreaterThanOrEqual(30);
    const cs = colours(forge);
    for (const c of [C.cerulean, C.crystal_violet, C.crystal_cyan, C.glass, C.gold])
      expect(cs.has(c)).toBe(true);
    // The gate is a ring: its eye (between column and plates) is open on the
    // front plate plane, its rim is solid.
    expect(forge.grid.get(13, 17 + 11, 12)).toBeGreaterThan(0);
    expect(forge.grid.get(8, 22, 12)).toBe(0);
    expect(forge.grid.get(4, 26, 12)).toBe(0);
  });
});

describe("propVisual rigs", () => {
  it("is undefined for static props", () => {
    expect(propVisual("sofa")).toBeUndefined();
    expect(propVisual("nope")).toBeUndefined();
  });

  it.each(["forge", "valve", "bench"])(
    "%s: parts sit inside the base and never overlap it",
    (id) => {
      const v = propVisual(id);
      expect(v).toBeDefined();
      if (!v) return;
      const full = propModel(id);
      expect([v.base.w, v.base.h, v.base.d]).toEqual([full.w, full.h, full.d]);
      expect(v.parts.length).toBeGreaterThan(0);
      let partVoxels = 0;
      for (const p of v.parts) {
        expect(p.model.grid.count(), `${id}/${p.name}`).toBeGreaterThan(0);
        p.model.grid.forEach((x, y, z) => {
          partVoxels++;
          const bx = x + p.offset[0];
          const by = y + p.offset[1];
          const bz = z + p.offset[2];
          expect(v.base.grid.inBounds(bx, by, bz), `${id}/${p.name} in bounds`).toBe(true);
          expect(v.base.grid.get(bx, by, bz), `${id}/${p.name} overlaps base`).toBe(0);
        });
      }
      // Static model = base + parts at rest (no voxel lost or doubled).
      expect(count(full)).toBe(count(v.base) + partVoxels);
    },
  );

  it("gives the forge its crystal, halo and rune parts", () => {
    const v = propVisual("forge")!;
    const names = v.parts.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(["crystal_0089", "halo_ring", "halo_veil", "deck_runes"]),
    );
    const halo = v.parts.find((p) => p.name === "halo_ring")!;
    expect(halo.kind).toBe("spin");
    expect(halo.axis).toBe("z");
    expect(v.lights.length).toBeGreaterThan(0);
  });
});

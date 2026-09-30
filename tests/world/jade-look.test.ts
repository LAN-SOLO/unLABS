import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { C, labMaterialOf, type ColorName } from "@/lib/world/content/palette";
import {
  DEFAULT_LOOK,
  WEAR_ITEMS,
  WEAR_SLOTS,
  type JadeLook,
  type WearItem,
} from "@/lib/world/content/wardrobe";
import { jadeLookGrid, jadeLookKey, jadeLookRig, wearItemGrid } from "@/lib/world/models/jade-look";
import { JADE_SCALE } from "@/lib/world/models/jade-kit";
import { printRows, PRINT_IDS } from "@/lib/world/models/jade-prints";
import {
  CHARACTER_SCALE,
  RIG_PART_NAMES,
  jadeRig,
  jointRestPosition,
  posedVoxels,
  type CharacterRigDef,
} from "@/lib/world/models/rig";

/** Hash of every part (name, parent, pivot, origin, size, voxels). */
function rigHash(def: CharacterRigDef): string {
  const h = createHash("sha256");
  for (const p of def.parts) {
    h.update(
      `${p.name}|${p.parent}|${p.pivot}|${p.origin}|${p.model.w},${p.model.h},${p.model.d}|`,
    );
    p.model.grid.forEach((x, y, z, v) => h.update(`${x},${y},${z},${v};`));
  }
  return h.digest("hex");
}

/**
 * Snapshot of the first-day `jadeRig()`. It used to pin the 2025 model
 * (bc604e04…: teal sweater, auburn ponytail, amber goggles). The 2026 rework
 * changed her on purpose — tall and slim (fitted parts), pale skin with
 * silver lids and a winged liner, the copper updo, the stand-collar shirt,
 * no goggles, dark brown eyes — so the pin moved with it. Update it only for a deliberate
 * change of the first-day look.
 */
const FIRST_DAY_JADE = "26758063da5752bf5d12bb0edf20493c9a35a74894ce87e3e3e9e0169142f48e";

const wear = (w: WearItem, cw: string): JadeLook => ({
  ...DEFAULT_LOOK,
  [w.slot]: { item: w.id, colorway: cw },
});

const emissive = (def: CharacterRigDef) =>
  def.parts.some((p) => {
    let found = false;
    p.model.grid.forEach((_x, _y, _z, v) => {
      if (labMaterialOf(v) === "emit") found = true;
    });
    return found;
  });

const part = (def: CharacterRigDef, name: string) => def.parts.find((p) => p.name === name)!;

describe("jade's wardrobe looks", () => {
  it("the first-day look is pinned voxel for voxel", () => {
    expect(rigHash(jadeRig())).toBe(FIRST_DAY_JADE);
    expect(rigHash(jadeRig(DEFAULT_LOOK))).toBe(FIRST_DAY_JADE);
    expect(rigHash(jadeLookRig(DEFAULT_LOOK))).toBe(FIRST_DAY_JADE);
    expect(JADE_SCALE).toBe(CHARACTER_SCALE);
  });

  it("the first-day look: stand-collar shirt, lab coat, copper updo, no goggles or glasses", () => {
    expect(DEFAULT_LOOK.top).toEqual({ item: "shirt_collar_geo", colorway: "white" });
    expect(DEFAULT_LOOK.outer?.item).toBe("labcoat");
    expect(DEFAULT_LOOK.hair).toEqual({ item: "hair_updo", colorway: "copper" });
    expect(DEFAULT_LOOK.head).toBeNull();
    expect(DEFAULT_LOOK.face).toBeNull();
  });

  it("every piece in every colourway builds within budget with joints in place", () => {
    const base = jadeRig();
    const rest = new Map(base.parts.map((p) => [p.name, jointRestPosition(base, p)]));
    let maxPosed = 0;
    let maxPart = 0;
    for (const w of WEAR_ITEMS)
      for (const cw of w.colorways) {
        const def = jadeRig(wear(w, cw.id));
        const tag = `${w.id}.${cw.id}`;
        expect(def.parts.map((p) => p.name).sort(), tag).toEqual([...RIG_PART_NAMES].sort());
        const n = posedVoxels(def).length;
        maxPosed = Math.max(maxPosed, n);
        expect(n, tag).toBeLessThan(10000);
        for (const p of def.parts) {
          const c = p.model.grid.count();
          maxPart = Math.max(maxPart, c);
          expect(c, `${tag}/${p.name}`).toBeLessThanOrEqual(2600);
          expect(c, `${tag}/${p.name}`).toBeGreaterThan(0);
          expect(jointRestPosition(def, p), `${tag}/${p.name}`).toEqual(rest.get(p.name));
        }
      }
    expect(maxPosed).toBeGreaterThan(0);
    expect(maxPart).toBeGreaterThan(0);
  });

  it("stacked looks with every slot filled stay within budget", () => {
    const bySlot = new Map(WEAR_SLOTS.map((s) => [s, WEAR_ITEMS.filter((w) => w.slot === s)]));
    for (let i = 0; i < 12; i++) {
      const look = { ...DEFAULT_LOOK } as JadeLook;
      for (const s of WEAR_SLOTS) {
        const list = bySlot.get(s)!;
        const w = list[i % list.length]!;
        look[s] = { item: w.id, colorway: w.colorways[i % w.colorways.length]!.id };
      }
      const def = jadeRig(look);
      expect(posedVoxels(def).length).toBeLessThan(10000);
      for (const p of def.parts) expect(p.model.grid.count(), p.name).toBeLessThanOrEqual(2600);
    }
  });

  it("colourway tones are palette colours", () => {
    for (const w of WEAR_ITEMS)
      for (const cw of w.colorways)
        for (const t of [cw.tones.main, cw.tones.shade, cw.tones.accent])
          if (t) expect(C[t as ColorName], `${w.id}.${cw.id}: ${t}`).toBeGreaterThan(0);
  });

  it("colourways change the voxels", () => {
    for (const w of WEAR_ITEMS) {
      if (w.colorways.length < 2) continue;
      const hashes = new Set(w.colorways.map((cw) => rigHash(jadeRig(wear(w, cw.id)))));
      expect(hashes.size, w.id).toBe(w.colorways.length);
    }
  });

  it("full-face headgear hides the face piece; hair-covering gear tucks the hair", () => {
    const helmet = { item: "welding_helmet", colorway: "black" };
    const glasses = { item: "safety_glasses", colorway: "clear" };
    const a = jadeRig({ ...DEFAULT_LOOK, head: helmet, face: glasses });
    const b = jadeRig({ ...DEFAULT_LOOK, head: helmet, face: null });
    expect(rigHash(a)).toBe(rigHash(b));
    expect(jadeLookGrid({ ...DEFAULT_LOOK, head: helmet, face: glasses }).count()).toBe(
      jadeLookGrid({ ...DEFAULT_LOOK, head: helmet, face: null }).count(),
    );
    // Under the welding helmet the ponytail is tucked away (placeholder voxel only).
    const pony = { item: "hair_ponytail", colorway: "copper" };
    const tucked = jadeRig({ ...DEFAULT_LOOK, hair: pony, head: helmet });
    expect(part(tucked, "hairBack").model.grid.count()).toBe(1);
    // A cap keeps the ponytail.
    const cap = jadeRig({ ...DEFAULT_LOOK, hair: pony, head: { item: "cap", colorway: "black" } });
    expect(part(cap, "hairBack").model.grid.count()).toBeGreaterThan(50);
    // The updo's pompadour and bun hide under crown gear like buns do, and stay under bands.
    const bare = jadeLookGrid({ ...DEFAULT_LOOK, head: null }).sy;
    const loose = jadeLookGrid({
      ...DEFAULT_LOOK,
      hair: { item: "hair_loose", colorway: "copper" },
    });
    expect(bare).toBeGreaterThan(loose.sy);
    for (const hat of ["beanie", "hardhat", "sou_wester"]) {
      const w = WEAR_ITEMS.find((x) => x.id === hat)!;
      const hatOn = { item: hat, colorway: w.colorways[0]!.id };
      expect(jadeLookGrid({ ...DEFAULT_LOOK, head: hatOn }).sy, hat).toBe(
        jadeLookGrid({
          ...DEFAULT_LOOK,
          hair: { item: "hair_loose", colorway: "copper" },
          head: hatOn,
        }).sy,
      );
    }
    const phones = { item: "headphones", colorway: "black" };
    expect(jadeLookGrid({ ...DEFAULT_LOOK, head: phones }).sy).toBeGreaterThanOrEqual(bare);
    // Buns hide under a beanie: the head is not taller than with the beanie over the ponytail.
    const bun = { item: "hair_bun", colorway: "auburn" };
    const beanie = { item: "beanie", colorway: "teal" };
    const hBun = jadeLookGrid({ ...DEFAULT_LOOK, hair: bun, head: beanie }).sy;
    const hTail = jadeLookGrid({ ...DEFAULT_LOOK, head: beanie }).sy;
    expect(hBun).toBe(hTail);
    expect(jadeLookGrid({ ...DEFAULT_LOOK, hair: bun, head: null }).sy).toBeGreaterThan(
      jadeLookGrid({ ...DEFAULT_LOOK, head: null }).sy,
    );
  });

  it("prints differ per design and show on the chest", () => {
    const rows = PRINT_IDS.map((id) => printRows(id).join("/"));
    expect(new Set(rows).size).toBe(PRINT_IDS.length);
    for (const id of PRINT_IDS) {
      const r = printRows(id);
      expect(r.length, id).toBeGreaterThan(3);
      expect(Math.max(...r.map((x) => x.length)), id).toBeLessThanOrEqual(10);
    }
    const tees = WEAR_ITEMS.filter((w) => w.print);
    for (const w of tees) expect(PRINT_IDS as readonly string[]).toContain(w.print);
    const torsos = tees.map((w) => {
      const def = jadeRig({ ...wear(w, w.colorways[0]!.id), outer: null });
      const g = part(def, "torso").model.grid;
      const front: number[] = [];
      g.forEach((x, y, z, v) => {
        if (z === g.sz - 3 || z === 9) front.push(x * 100 + y * 1000 + v);
      });
      return front.sort().join(",");
    });
    expect(new Set(torsos).size).toBe(tees.length);
  });

  it("glowing pieces carry emissive voxels", () => {
    const plain = { ...DEFAULT_LOOK, wrist: null };
    for (const w of WEAR_ITEMS.filter((x) => x.glows))
      for (const cw of w.colorways) {
        const look = { ...plain, [w.slot]: { item: w.id, colorway: cw.id } };
        expect(emissive(jadeRig(look)), `${w.id}.${cw.id}`).toBe(true);
      }
    expect(emissive(jadeRig({ ...plain }))).toBe(false);
  });

  it("every piece has a non-empty icon and the look grid is a whole Jade", () => {
    for (const w of WEAR_ITEMS)
      for (const cw of w.colorways)
        expect(wearItemGrid(w.id, cw.id).count(), `${w.id}.${cw.id}`).toBeGreaterThan(8);
    const g = jadeLookGrid(DEFAULT_LOOK);
    expect(g.sy).toBeGreaterThanOrEqual(62);
    expect(g.sy).toBeLessThanOrEqual(64);
    expect(g.count()).toBeGreaterThan(3000);
    expect(wearItemGrid("nope", "x").count()).toBe(0);
  });

  it("look keys are stable and distinguish looks", () => {
    const k = jadeLookKey(DEFAULT_LOOK);
    expect(jadeLookKey({ ...DEFAULT_LOOK })).toBe(k);
    expect(k).toContain("top=shirt_collar_geo.white");
    expect(k).toContain("face=-");
    expect(jadeLookKey({ ...DEFAULT_LOOK, belt: null })).not.toBe(k);
    expect(
      jadeLookKey({ ...DEFAULT_LOOK, top: { item: "shirt_collar_geo", colorway: "black" } }),
    ).not.toBe(k);
  });
});

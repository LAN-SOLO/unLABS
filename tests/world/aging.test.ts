import { describe, expect, it } from "vitest";
import {
  DUST_SECONDS,
  FRESH,
  GROW_SECONDS,
  GROWING,
  WILT_AFTER,
  WILT_SPAN,
  agingTick,
  isDamp,
  lookFor,
  lookKey,
  tidyRoom,
  waterRoom,
} from "@/lib/world/aging";
import { initialState } from "@/lib/world/game";
import { ROOMS } from "@/lib/world/content/map";
import { C } from "@/lib/world/content/palette";
import { DECOR } from "@/lib/world/models/decor";
import { agedDecorModel, allAgedVariants } from "@/lib/world/models/decor-aging";
import { decorModel } from "@/lib/world/models/decor";

const dry = ROOMS.find((r) => !isDamp(r.id))!.id;
const damp = ROOMS.find((r) => isDamp(r.id))!.id;

describe("aging rules", () => {
  it("plants grow only with light and water", () => {
    const s = initialState();
    agingTick(s, 600, () => false, [dry]);
    expect(s.counters[`grow:${dry}`] ?? 0).toBe(0);
    agingTick(s, 600, () => true, [dry]);
    expect(s.counters[`grow:${dry}`]).toBe(600);
    const young = lookFor(s, dry, "plant_fern", 0).grow;
    agingTick(s, GROW_SECONDS, () => true, [dry]);
    expect(lookFor(s, dry, "plant_fern", 0).grow).toBeGreaterThan(young);
  });

  it("unwatered plants wilt, watering revives them", () => {
    const s = initialState();
    s.playTime = WILT_AFTER + WILT_SPAN;
    expect(lookFor(s, dry, "plant_ficus", 0).wilt).toBeGreaterThan(0);
    waterRoom(s, dry);
    expect(lookFor(s, dry, "plant_ficus", 0).wilt).toBe(0);
  });

  it("dust settles in dry rooms, using the room tidies it; damp rooms rust instead", () => {
    const s = initialState();
    agingTick(s, DUST_SECONDS, () => true, [dry, damp]);
    expect(lookFor(s, dry, "crate_stack", 0).weather).toBeGreaterThan(0);
    expect(lookFor(s, damp, "crate_stack", 0).damp).toBe(true);
    const before = s.counters[`dust:${dry}`]!;
    tidyRoom(s, dry);
    expect(s.counters[`dust:${dry}`]!).toBeLessThan(before);
  });

  it("crystals grow with the world's clarity", () => {
    const s = initialState();
    expect(lookFor(s, dry, "crystal_cluster", 0).crystal).toBeLessThan(
      lookFor(s, dry, "crystal_cluster", 41).crystal,
    );
  });

  it("keys only carry the stages that matter for a piece", () => {
    expect(lookKey("crate_stack", FRESH)).toBe("s0");
    expect(lookKey("plant_fern", FRESH)).toMatch(/^g\d+w0/);
  });
});

describe("aged decor models", () => {
  it("never leave the base model's shape (collision, footprints stay the same)", () => {
    for (const d of DECOR) {
      const base = decorModel(d.id).grid;
      for (const { model } of allAgedVariants(d.id)) {
        const g = model.grid;
        expect([g.sx, g.sy, g.sz]).toEqual([base.sx, base.sy, base.sz]);
        for (let i = 0; i < g.data.length; i++)
          if (g.data[i]) expect(base.data[i], `${d.id} grew outside its shape`).not.toBe(0);
      }
    }
  });

  it("plants have more foliage the further they grew, wilting browns the leaves", () => {
    /** [all foliage voxels, still-green ones] */
    const leaves = (id: string, grow: number, wilt = 0): [number, number] => {
      let n = 0;
      let green = 0;
      agedDecorModel(id, { ...FRESH, grow, wilt }).grid.forEach((_x, _y, _z, v) => {
        if (v === C.plant_green || v === C.leaf_dark || v === C.leaf_light || v === C.leaf_yellow)
          n++;
        if (v === C.plant_green || v === C.leaf_dark || v === C.leaf_light) green++;
      });
      return [n, green];
    };
    for (const id of [...GROWING].filter((id) => DECOR.some((d) => d.id === id))) {
      const [small] = leaves(id, 0);
      const [full] = leaves(id, 4);
      if (full === 0) continue; // foliage lives in the rig parts only
      expect(small, id).toBeLessThanOrEqual(full);
      expect(leaves(id, 4, 2)[1], id).toBeLessThan(leaves(id, 4, 0)[1]);
    }
  });

  it("is deterministic and cached", () => {
    const a = agedDecorModel("plant_fern", { ...FRESH, grow: 1, weather: 2 });
    const b = agedDecorModel("plant_fern", { ...FRESH, grow: 1, weather: 2 });
    expect(a).toBe(b);
  });
});

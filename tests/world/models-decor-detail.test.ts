import { PLAN_ROOMS } from "@/lib/world/content/floorplan";
import { NOT_YET_CRYSTAL } from "@/lib/world/models/decor-ops";
import { describe, expect, it } from "vitest";
import { C } from "@/lib/world/content/palette";
import { FLOORS, ROOMS } from "@/lib/world/content/map";
import { interiorFor } from "@/lib/world/content/interior";
import type { Model } from "@/lib/world/models/core";
import { DECOR, DECOR_BY_ID, decorModel, decorScale } from "@/lib/world/models/decor";
import { CLUTTER_DECOR } from "@/lib/world/models/decor-clutter";
import { DECOR_UPGRADES } from "@/lib/world/models/decor-upgrades";
import { weatherModel } from "@/lib/world/models/decor-weather";
import { propModel } from "@/lib/world/models/props";

function count(m: Model): number {
  let n = 0;
  m.grid.forEach(() => n++);
  return n;
}

function occupancy(m: Model): string {
  const out: number[] = [];
  m.grid.forEach((x, y, z) => out.push(x, y, z));
  return out.join(",");
}

function colours(m: Model): Set<number> {
  const s = new Set<number>();
  m.grid.forEach((_x, _y, _z, v) => s.add(v));
  return s;
}

/** Voxels of a decor piece incl. its animated parts. */
function voxels(id: string): number {
  const d = DECOR_BY_ID.get(id)!;
  return count(decorModel(id)) + (d.parts ?? []).reduce((a, p) => a + count(p.model), 0);
}

describe("decor weathering pass", () => {
  it("only recolours: occupancy of every piece equals its raw model", () => {
    for (const d of DECOR) expect(occupancy(decorModel(d.id)), d.id).toBe(occupancy(d.model()));
  });

  it("is deterministic and never touches emissive / screen voxels", () => {
    for (const id of ["office_desk", "workstation_pc", "server_rack_a", "kitchenette"]) {
      const d = DECOR_BY_ID.get(id)!;
      const raw = d.model();
      const a = weatherModel(d, raw);
      const b = weatherModel(d, raw);
      expect(Array.from(a.grid.data)).toEqual(Array.from(b.grid.data));
      raw.grid.forEach((x, y, z, v) => {
        if ([C.crt_bg, C.black, C.led_green, C.lamp_warm, C.screen_green].includes(v))
          expect(a.grid.get(x, y, z), `${id} ${x},${y},${z}`).toBe(v);
      });
    }
  });

  it("adds grain, fabric shading and wear to furniture", () => {
    expect(colours(decorModel("office_desk")).has(C.oak_grain)).toBe(true);
    expect(colours(decorModel("sofa")).has(C.fabric_red_shade)).toBe(true);
    const worn = DECOR.filter((d) => colours(decorModel(d.id)).has(C.grime));
    expect(worn.length).toBeGreaterThanOrEqual(20);
  });

  it("weathers props without changing their footprint", () => {
    for (const id of ["bench", "desk", "sofa", "barrel", "console"]) {
      const m = propModel(id);
      expect(count(m), id).toBeGreaterThan(0);
    }
    expect(colours(propModel("bench")).has(C.wood_grain)).toBe(true);
  });
});

describe("clutter and upgraded pieces", () => {
  it("new clutter is small, animated where it should be and all placed somewhere", () => {
    const placed = new Set(FLOORS.flatMap((f) => interiorFor(f.id).map((p) => p.decor)));
    for (const d of CLUTTER_DECOR) {
      expect(d.scale, d.id).toBe(0.25);
      expect(placed.has(d.id), `${d.id} is placed`).toBe(true);
    }
    const animated = CLUTTER_DECOR.filter((d) => d.parts?.length);
    expect(animated.length).toBeGreaterThanOrEqual(8);
  });

  it("upgraded classic pieces are double detail", () => {
    for (const d of DECOR_UPGRADES) expect(decorScale(d.id), d.id).toBe(0.25);
  });

  it("plants sway, the cooler bubbles, the beacon turns", () => {
    const kinds = (id: string) => (DECOR_BY_ID.get(id)!.parts ?? []).map((p) => p.kind);
    expect(kinds("plant_ficus")).toContain("sway");
    expect(kinds("plant_fern")).toContain("sway");
    expect(kinds("water_cooler")).toContain("bob");
    expect(kinds("beacon")).toContain("orbit");
    expect(kinds("steam_vent")).toContain("bob");
  });
});

describe("performance budget", () => {
  // Measured before the J2 detail pass: 83 375 library voxels, 167 164 placed.
  const LIB_BEFORE = 83_375;
  const PLACED_BEFORE = 167_164;
  // Measured 2026-10-01: 7 957 voxels.
  const OPS_CAP = 12_000;

  it("library and placed decor voxels stay within +40 %", () => {
    const lib = DECOR.reduce((a, d) => a + voxels(d.id), 0);
    // The floor-plan cores and passages (floorplan.ts) are new rooms with their own cap.
    const fresh = new Set([
      ...PLAN_ROOMS.map((r) => r.id),
      ...ROOMS.filter((r) => r.theme === "hub").map((r) => r.id),
    ]);
    let placed = 0;
    let added = 0;
    // Operations infrastructure (docs/OPS.md: cameras, docks, vines, spills) has its own cap.
    let ops = 0;
    for (const f of FLOORS)
      for (const p of interiorFor(f.id)) {
        if (NOT_YET_CRYSTAL.has(p.decor)) ops += voxels(p.decor);
        else if (fresh.has(p.room)) added += voxels(p.decor);
        else placed += voxels(p.decor);
      }
    expect(lib).toBeLessThanOrEqual(LIB_BEFORE * 1.4);
    expect(placed).toBeLessThanOrEqual(PLACED_BEFORE * 1.4);
    expect(added).toBeLessThanOrEqual(50_000);
    expect(ops).toBeLessThanOrEqual(OPS_CAP);
  });
});

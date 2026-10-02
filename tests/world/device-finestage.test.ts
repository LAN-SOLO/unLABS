import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { gridSha } from "@/lib/voxel/uvox";
import { MODEL_SCALE } from "@/lib/world/models/core";
import { DEVICE_VISUAL_IDS, deviceVisual } from "@/lib/world/models/devices";
import {
  assembleDetail,
  detailFactor,
  detailGrids,
  detailVisual,
  findPanels,
} from "@/lib/world/models/detail";
import { refineGrid } from "@/lib/voxel/refine";
import { labRefineOptions, refineModel } from "@/lib/world/models/refine";
import { FINE_RULES } from "@/lib/world/models/detail";

const IDS = [...new Set([...DEVICES.map((d) => d.id), ...DEVICE_VISUAL_IDS])];

/** The fine grid without components (refined twice), for silhouette checks. */
function plainFine(id: string) {
  const v = deviceVisual(id);
  const once = v.fine ? v.base.grid : refineModel(v.base.grid, "device");
  const o = labRefineOptions("device");
  o.rules = FINE_RULES;
  return refineGrid(once, o);
}

describe("device fine stage + components (lib/world/models/detail.ts)", () => {
  it("details every device and keeps its world size", () => {
    for (const id of IDS) {
      const v = deviceVisual(id);
      const d = detailVisual(v, id);
      const k = detailFactor(v);
      const sc = v.scale ?? MODEL_SCALE;
      expect(d.fine, id).toBe(true);
      expect(d.scale! * k, id).toBeCloseTo(sc, 9);
      expect([d.base.w, d.base.h, d.base.d], id).toEqual([
        v.base.w * k,
        v.base.h * k,
        v.base.d * k,
      ]);
      expect(d.parts).toHaveLength(v.parts.length);
      d.parts.forEach((p, i) => {
        const o = v.parts[i]!;
        expect(p.offset, `${id}/${p.name}`).toEqual(o.offset.map((x) => x * k));
        expect(p.pivot, `${id}/${p.name}`).toEqual(o.pivot.map((x) => x * k));
        expect(p.model.w, `${id}/${p.name}`).toBe(o.model.w * k);
      });
      d.lights.forEach((l, i) => expect(l.pos).toEqual(v.lights[i]!.pos.map((x) => x * k)));
      (d.screens ?? []).forEach((s, i) => {
        const o = v.screens![i]!;
        expect(s.center).toEqual(o.center.map((x) => x * k));
        expect([s.w, s.h]).toEqual([o.w * k, o.h * k]);
      });
    }
  });

  it("components never grow the silhouette (only recolour or carve inwards)", () => {
    for (const id of ["CDC-001", "PWR-001", "CPU-001", "MFR-001", "AIC-001"]) {
      const plain = plainFine(id);
      const d = detailGrids(deviceVisual(id), id).base;
      let added = 0;
      let changed = 0;
      for (let i = 0; i < d.data.length; i++) {
        if (d.data[i] && !plain.data[i]) added++;
        if (d.data[i] !== plain.data[i]) changed++;
      }
      expect(added, id).toBe(0);
      // …and they are really there.
      expect(changed, id).toBeGreaterThan(50);
    }
  });

  it("keeps the panels under live screens as the plain fine stage", () => {
    for (const id of IDS) {
      const v = deviceVisual(id);
      if (!v.screens?.length || v.fine) continue;
      const plain = plainFine(id);
      const d = detailGrids(v, id).base;
      const k = detailFactor(v);
      for (const s of v.screens) {
        // Sample the screen's centre cell on its surface: unchanged.
        const c = s.center.map((x) => Math.floor(x * k));
        const [x, y, z] = [
          Math.min(c[0]!, d.sx - 1),
          Math.min(c[1]!, d.sy - 1),
          Math.min(c[2]!, d.sz - 1),
        ];
        const i = x + d.sx * (y + d.sy * z);
        expect(d.data[i], `${id} screen ${s.content}`).toBe(plain.data[i]);
      }
    }
  });

  it("scales translational animation amplitudes, not angles", () => {
    for (const id of IDS) {
      const v = deviceVisual(id);
      const d = detailVisual(v, id);
      const k = detailFactor(v);
      v.parts.forEach((p, i) => {
        const q = d.parts[i]!;
        if (p.amplitude === undefined) return;
        const moves = ["bob", "slide", "orbit", "piston", "jitter"].includes(p.kind);
        expect(q.amplitude, `${id}/${p.name} ${p.kind}`).toBe(
          moves ? p.amplitude * k : p.amplitude,
        );
      });
    }
  });

  it("is deterministic and assembles from worker grids identically", () => {
    const v = deviceVisual("CDC-001");
    const a = detailGrids(v, "CDC-001");
    const b = detailGrids(deviceVisual("CDC-001"), "CDC-001");
    expect(gridSha(a.base)).toBe(gridSha(b.base));
    const viaWorker = assembleDetail(v, b);
    expect(gridSha(viaWorker.base.grid)).toBe(gridSha(detailVisual(v, "CDC-001").base.grid));
  });

  it("finds the large panels of an authored model", () => {
    const panels = findPanels(deviceVisual("CDC-001").base.grid);
    expect(panels.length).toBeGreaterThan(10);
    for (let i = 1; i < panels.length; i++) {
      const area = (p: (typeof panels)[number]) => (p.u1 - p.u0 + 1) * (p.v1 - p.v0 + 1);
      expect(area(panels[i - 1]!)).toBeGreaterThanOrEqual(area(panels[i]!));
    }
  });
});

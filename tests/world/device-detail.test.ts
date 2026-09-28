import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { C, labMaterialOf } from "@/lib/world/content/palette";
import {
  MOTION_KINDS,
  animTransform,
  buildPhases,
  isMotionPart,
  stagedBuildGrid,
  visual,
  type AnimPart,
} from "@/lib/world/models/anim";
import { Model, stagedGrid } from "@/lib/world/models/core";
import { deviceVisual } from "@/lib/world/models/devices";

/**
 * Voxels per device (base + parts) before the detail/animation pass
 * (2026-09-28). The pass may add at most 40 % on top.
 */
const BASELINE: Record<string, number> = {
  "MCP-000": 18011,
  "CLK-001": 1949,
  "VNT-001": 14539,
  "BTK-001": 3567,
  "BAT-001": 8250,
  "PWB-001": 5416,
  "CDC-001": 12277,
  "MEM-001": 6661,
  "CPU-001": 7529,
  "NET-001": 7915,
  "TMP-001": 1915,
  "THM-001": 19934,
  "PWR-001": 10987,
  "PWD-001": 1928,
  "VLT-001": 1352,
  "MSC-001": 7113,
  "RMG-001": 5666,
  "ATK-001": 11114,
  "UEC-001": 8648,
  "DGN-001": 11639,
  "ECR-001": 6962,
  "SPK-001": 3096,
  "HMS-001": 7051,
  "OSC-001": 11805,
  "INT-001": 3613,
  "AND-001": 4838,
  "QCP-001": 4104,
  "DIM-001": 7343,
  "EXD-001": 4685,
  "NXS-01": 14686,
  "LCT-001": 8421,
  "P3D-001": 12440,
  "MFR-001": 40448,
  "EMC-001": 21684,
  "QSM-001": 17511,
  "QAN-001": 31012,
  "AIC-001": 36171,
  "SCA-001": 30531,
  "TLP-001": 12453,
};

/**
 * The 12 story "hero" devices and their voxel counts (base + parts) before
 * the hero-detail pass (2026-09-28, after the detail pass above). The hero
 * pass may add at most 45 % on top, with at most 12 parts per device.
 */
const HERO_BEFORE: Record<string, number> = {
  "MCP-000": 18105,
  "UEC-001": 8664,
  "PWR-001": 11046,
  "CDC-001": 12337,
  "DIM-001": 7401,
  "QAN-001": 31116,
  "NXS-01": 14695,
  "AND-001": 4848,
  "TLP-001": 12561,
  "AIC-001": 36212,
  "QCP-001": 4131,
  "ECR-001": 6974,
};

/**
 * The other 27 devices and their voxel counts (base + parts) before the
 * lab-wide detail pass (2026-09-28, after the hero pass): each gets a glass
 * viewport or open mechanism, 3+ powered moving parts in 2+ motion kinds and
 * a cable to the floor, adding at most 45 % with at most 9 parts.
 */
const LAB_BEFORE: Record<string, number> = {
  "CLK-001": 1971,
  "VNT-001": 14622,
  "BTK-001": 3593,
  "BAT-001": 8256,
  "PWB-001": 5449,
  "MEM-001": 6688,
  "CPU-001": 7572,
  "NET-001": 7940,
  "TMP-001": 1921,
  "THM-001": 20048,
  "PWD-001": 1949,
  "VLT-001": 1363,
  "MSC-001": 7148,
  "RMG-001": 5680,
  "ATK-001": 11117,
  "DGN-001": 11647,
  "SPK-001": 3101,
  "HMS-001": 7072,
  "OSC-001": 11826,
  "INT-001": 3622,
  "EXD-001": 4688,
  "LCT-001": 8449,
  "P3D-001": 12390,
  "MFR-001": 40503,
  "EMC-001": 21684,
  "QSM-001": 17700,
  "SCA-001": 30589,
};

/** Cable colours (a run that reaches the floor rows reads as "plugged in"). */
const CABLES = new Set<number>([C.cable_black, C.cable_red, C.cable_yellow]);

const voxels = (id: string): number => {
  const v = deviceVisual(id);
  return v.base.grid.count() + v.parts.reduce((n, p) => n + p.model.grid.count(), 0);
};

const pose = (p: AnimPart, t: number, powered: boolean): string =>
  JSON.stringify(animTransform(p, t, powered));

describe("device detail & animation pass", () => {
  it("every device has at least two parts that visibly move or blink", () => {
    for (const d of DEVICES) {
      const moving = deviceVisual(d.id).parts.filter(isMotionPart);
      expect(moving.length, d.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("motion stops when the power goes (and runs when it is on)", () => {
    const ts = Array.from({ length: 48 }, (_, i) => 0.37 + i * 0.211);
    for (const d of DEVICES) {
      const parts = deviceVisual(d.id).parts.filter((p) => isMotionPart(p) && p.requiresPower);
      expect(parts.length, `${d.id}: powered motion parts`).toBeGreaterThanOrEqual(2);
      for (const p of parts) {
        const off = new Set(ts.map((t) => pose(p, t, false)));
        expect(off.size, `${d.id}.${p.name} frozen unpowered`).toBe(1);
        const on = new Set(ts.map((t) => pose(p, t, true)));
        expect(on.size, `${d.id}.${p.name} moves powered`).toBeGreaterThan(1);
      }
    }
  });

  it("powered parts go dark unpowered (their emissives have an off stand-in)", () => {
    for (const d of DEVICES)
      for (const p of deviceVisual(d.id).parts) {
        if (!p.requiresPower) continue;
        const lit: string[] = [];
        stagedGrid(p.model.grid, 1, false).forEach((x, y, z, c) => {
          if (labMaterialOf(c) === "emit") lit.push(`${x},${y},${z}`);
        });
        expect(lit, `${d.id}.${p.name}`).toEqual([]);
      }
  });

  it("screens lie fully inside the base model", () => {
    for (const d of DEVICES) {
      const v = deviceVisual(d.id);
      const { w, h, d: dp } = v.base;
      for (const s of v.screens ?? []) {
        const tag = `${d.id} ${s.content}`;
        const [cx, cy, cz] = s.center;
        const [hu, hv] = [s.w / 2, s.h / 2];
        const [ex, ey, ez] =
          s.normal === "+z" || s.normal === "-z"
            ? [hu, hv, 0]
            : s.normal === "+y"
              ? [hu, 0, hv]
              : [0, hv, hu];
        expect(cx - ex, tag).toBeGreaterThanOrEqual(0);
        expect(cx + ex, tag).toBeLessThanOrEqual(w);
        expect(cy - ey, tag).toBeGreaterThanOrEqual(0);
        expect(cy + ey, tag).toBeLessThanOrEqual(h);
        expect(cz - ez, tag).toBeGreaterThanOrEqual(0);
        expect(cz + ez, tag).toBeLessThanOrEqual(dp);
      }
    }
  });

  it("stays within the voxel budget (+40 % over the pre-pass baseline)", () => {
    for (const d of DEVICES) {
      const base = BASELINE[d.id];
      expect(base, `${d.id} has a baseline`).toBeDefined();
      expect(voxels(d.id), d.id).toBeLessThanOrEqual(Math.ceil(base! * 1.4));
    }
  });

  it("hero devices stay within +45 % of their pre-hero-pass count and ≤ 12 parts", () => {
    for (const [id, before] of Object.entries(HERO_BEFORE)) {
      const n = voxels(id);
      expect(n, id).toBeLessThanOrEqual(Math.ceil(before * 1.45));
      expect(n, `${id} never loses detail`).toBeGreaterThanOrEqual(before);
      expect(deviceVisual(id).parts.length, id).toBeLessThanOrEqual(12);
    }
  });

  it("hero devices read as heroes: glass internals, choreographed motion, a live screen", () => {
    for (const id of Object.keys(HERO_BEFORE)) {
      const v = deviceVisual(id);
      let glass = 0;
      v.base.grid.forEach((_x, _y, _z, c) => {
        if (labMaterialOf(c) === "glass") glass++;
      });
      expect(glass, `${id} glass voxels`).toBeGreaterThanOrEqual(12);
      const moving = v.parts.filter((p) => isMotionPart(p) && p.requiresPower);
      expect(moving.length, `${id} moving parts`).toBeGreaterThanOrEqual(5);
      expect(new Set(moving.map((p) => p.kind)).size, `${id} motion kinds`).toBeGreaterThanOrEqual(
        3,
      );
      expect((v.screens ?? []).length, `${id} screens`).toBeGreaterThanOrEqual(1);
    }
  });

  it("the lab-wide pass covers every non-hero device and stays within +45 % / 9 parts", () => {
    const ids = DEVICES.map((d) => d.id).filter((id) => !(id in HERO_BEFORE));
    expect(Object.keys(LAB_BEFORE).sort()).toEqual([...ids].sort());
    for (const [id, before] of Object.entries(LAB_BEFORE)) {
      const n = voxels(id);
      expect(n, id).toBeLessThanOrEqual(Math.ceil(before * 1.45));
      expect(n, `${id} never loses detail`).toBeGreaterThanOrEqual(before);
      expect(deviceVisual(id).parts.length, id).toBeLessThanOrEqual(9);
    }
  });

  it("non-hero devices show their workings: glass, powered mechanisms, a screen, a floor cable", () => {
    for (const id of Object.keys(LAB_BEFORE)) {
      const v = deviceVisual(id);
      let glass = 0;
      let floorCable = 0;
      v.base.grid.forEach((_x, y, _z, c) => {
        if (labMaterialOf(c) === "glass") glass++;
        if (y <= 1 && CABLES.has(c)) floorCable++;
      });
      expect(glass, `${id} glass voxels`).toBeGreaterThanOrEqual(6);
      expect(floorCable, `${id} cable to the floor`).toBeGreaterThan(0);
      const moving = v.parts.filter((p) => isMotionPart(p) && p.requiresPower);
      expect(moving.length, `${id} powered moving parts`).toBeGreaterThanOrEqual(3);
      expect(new Set(moving.map((p) => p.kind)).size, `${id} motion kinds`).toBeGreaterThanOrEqual(
        2,
      );
      expect((v.screens ?? []).length, `${id} screens`).toBeGreaterThanOrEqual(1);
    }
  });

  it("the detail pass added to every device (never removed detail)", () => {
    for (const d of DEVICES)
      expect(voxels(d.id), d.id).toBeGreaterThanOrEqual(BASELINE[d.id]! * 0.99);
  });

  it("uses the new mechanical motion kinds across the lab", () => {
    const used = new Set<string>();
    for (const d of DEVICES) for (const p of deviceVisual(d.id).parts) used.add(p.kind);
    for (const k of ["step", "piston", "wobble", "jitter", "sweep"]) expect(used, k).toContain(k);
  });
});

describe("mechanical motion kinds", () => {
  const part = (kind: AnimPart["kind"], extra: Partial<AnimPart> = {}): AnimPart => ({
    name: kind,
    model: new Model(1, 1, 1).set(0, 0, 0, 1),
    offset: [0, 0, 0],
    pivot: [0.5, 0.5, 0.5],
    kind,
    speed: 1,
    requiresPower: true,
    ...extra,
  });

  it("all motion kinds are listed", () => {
    for (const k of ["spin", "bob", "blink", "sway", "orbit", "slide"])
      expect(MOTION_KINDS.has(k as AnimPart["kind"])).toBe(true);
    expect(MOTION_KINDS.has("pulse")).toBe(false);
    expect(MOTION_KINDS.has("flicker")).toBe(false);
  });

  it("step holds between ticks and advances one step per tick", () => {
    const p = part("step", { axis: "z", speed: 2, amplitude: 0.5 });
    const a = animTransform(p, 0.3, true).rot[2];
    const b = animTransform(p, 0.45, true).rot[2];
    expect(a).toBeCloseTo(0.5);
    expect(b).toBeCloseTo(0.5);
    expect(animTransform(p, 1.3, true).rot[2]).toBeCloseTo(1.5);
  });

  it("piston strokes within [0, amplitude] and dwells at the ends", () => {
    const p = part("piston", { amplitude: 3, speed: 1 });
    for (let t = 0; t < 3; t += 0.07) {
      const y = animTransform(p, t, true).pos[1];
      expect(y).toBeGreaterThanOrEqual(-1e-9);
      expect(y).toBeLessThanOrEqual(3 + 1e-9);
    }
    expect(animTransform(p, 0.4, true).pos[1]).toBeCloseTo(3);
    expect(animTransform(p, 0.9, true).pos[1]).toBeCloseTo(0);
    const neg = part("piston", { amplitude: -2 });
    expect(animTransform(neg, 0.4, true).pos[1]).toBeCloseTo(-2);
  });

  it("wobble tilts off-axis by exactly its amplitude, sweep stays within ±amplitude", () => {
    for (let t = 0; t < 4; t += 0.19) {
      const w = animTransform(part("wobble", { amplitude: 0.3 }), t, true);
      expect(Math.hypot(w.rot[0], w.rot[2])).toBeCloseTo(0.3);
      expect(w.rot[1]).toBe(0);
      const s = animTransform(part("sweep", { axis: "z", amplitude: 0.7 }), t, true);
      expect(Math.abs(s.rot[2])).toBeLessThanOrEqual(0.7 + 1e-9);
    }
  });

  it("jitter is bounded and deterministic", () => {
    for (let t = 0; t < 3; t += 0.05) {
      const j = animTransform(part("jitter", { amplitude: 0.6, speed: 10 }), t, true);
      for (const c of j.pos) expect(Math.abs(c)).toBeLessThanOrEqual(0.6);
      expect(j).toEqual(animTransform(part("jitter", { amplitude: 0.6, speed: 10 }), t, true));
    }
  });

  it("new kinds rest (and go dark) unpowered", () => {
    for (const k of ["step", "piston", "wobble", "jitter", "sweep"] as const) {
      const a = animTransform(part(k, { phase: 0.4 }), 9.1, false);
      expect(a).toEqual(animTransform(part(k, { phase: 0.4 }), 0, false));
      expect(a.intensity).toBe(0);
      expect(a.pos).toEqual([0, 0, 0]);
    }
  });

  it("visual height covers a rising piston", () => {
    const base = new Model(4, 4, 4).box(0, 0, 0, 3, 3, 3, 1);
    const p = part("piston", { amplitude: 3, offset: [0, 4, 0] });
    expect(visual(base, [p], []).height).toBe(8);
  });
});

describe("staged construction (RAHMEN → KERN → KALIBRIERUNG)", () => {
  /** 1 where the cell is built (solid, not blueprint ghost). */
  const built = (g: { data: Uint8Array }): Uint8Array =>
    g.data.map((c) => (c !== 0 && c !== C.ghost ? 1 : 0));
  const sum = (a: Uint8Array): number => a.reduce((n, v) => n + v, 0);

  it("each stage adds a visible layer of construction and the last one is complete", () => {
    for (const d of DEVICES) {
      const src = deviceVisual(d.id).base.grid;
      const stages = [0, 1 / 3, 2 / 3, 1].map((f) => built(stagedBuildGrid(src, f, true)));
      expect(sum(stages[0]!), `${d.id} blueprint`).toBe(0);
      for (let i = 1; i < stages.length; i++) {
        const [prev, cur] = [stages[i - 1]!, stages[i]!];
        expect(sum(cur), `${d.id} stage ${i} grows`).toBeGreaterThan(sum(prev));
        const lost = prev.reduce((n, v, j) => n + (v && !cur[j] ? 1 : 0), 0);
        expect(lost, `${d.id} stage ${i} keeps what was built`).toBe(0);
      }
      const done = stagedBuildGrid(src, 1, false);
      expect(Array.from(done.data), d.id).toEqual(Array.from(stagedGrid(src, 1, false).data));
    }
  });

  it("the frame goes up first and emissive detail comes last", () => {
    for (const d of DEVICES) {
      const src = deviceVisual(d.id).base.grid;
      const phases = buildPhases(src);
      const counts = [0, 0, 0];
      src.forEach((x, y, z, c) => {
        const p = phases[x + src.sx * (y + src.sy * z)]!;
        counts[p]!++;
        if (labMaterialOf(c) === "emit") expect(p, `${d.id} emissive ${x},${y},${z}`).toBe(2);
        if (y === 0) expect(p === 0 || p === 2, `${d.id} floor row`).toBe(true);
      });
      for (const [i, n] of counts.entries()) expect(n, `${d.id} phase ${i}`).toBeGreaterThan(0);
    }
  });
});

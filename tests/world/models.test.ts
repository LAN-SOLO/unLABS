import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import {
  DETAIL_SCALE,
  animTransform,
  lightIntensity,
  partPivotInBase,
  type AnimPart,
  type DeviceVisual,
  type ScreenContent,
  type ScreenSpec,
  type Vec3,
} from "@/lib/world/models/anim";
import {
  BOT_IDS,
  BOT_MAX_WIDTH,
  botModel,
  botVisual,
  damienModel,
  damienSolidModel,
  jadeModel,
} from "@/lib/world/models/characters";
import { C, labMaterialOf } from "@/lib/world/content/palette";
import { MODEL_SCALE, Model, stagedGrid } from "@/lib/world/models/core";
import { DEVICE_VISUAL_IDS, deviceModel, deviceVisual } from "@/lib/world/models/devices";

const LORE_BOTS = [
  "x0r8t",
  "f1ndr",
  "l0g1k",
  "p1ndr0",
  "r3tr0",
  "b4c0n",
  "d3c4d3",
  "w2rek",
  "k2ldr",
  "c8br41n",
];

/** Story devices with a hero-detail pass (a larger part budget). */
const HERO_DEVICES = new Set([
  "MCP-000",
  "UEC-001",
  "PWR-001",
  "CDC-001",
  "DIM-001",
  "QAN-001",
  "NXS-01",
  "AND-001",
  "TLP-001",
  "AIC-001",
  "QCP-001",
  "ECR-001",
]);

const WALL_MOUNTED = ["CLK-001", "TMP-001", "PWD-001", "VLT-001", "BTK-001"];

/** Max world-space w/h/d per tier. */
const LIMITS: Record<1 | 2 | 3, [number, number, number]> = {
  1: [10, 10, 10],
  2: [12, 12, 12],
  3: [14, 13, 14],
};

/**
 * World footprints (w × d) the rooms were laid out for; the detailed models
 * must stay within ±15 % so doors and paths stay walkable.
 */
const FOOTPRINT: Record<string, [number, number]> = {
  "MCP-000": [9, 5],
  "CLK-001": [5.5, 2],
  "VNT-001": [6.5, 6],
  "BTK-001": [7, 2.5],
  "BAT-001": [8, 4.5],
  "PWB-001": [8, 5.5],
  "CDC-001": [6.5, 5],
  "MEM-001": [5, 4],
  "CPU-001": [5, 4.5],
  "NET-001": [6.5, 5],
  "TMP-001": [5, 2],
  "THM-001": [7.5, 7.5],
  "PWR-001": [6, 4.5],
  "PWD-001": [8, 2],
  "VLT-001": [5, 2],
  "MSC-001": [7, 6],
  "RMG-001": [7.5, 7.5],
  "ATK-001": [6.5, 6.5],
  "UEC-001": [9, 9],
  "DGN-001": [10, 6],
  "ECR-001": [7.5, 7.5],
  "SPK-001": [5.5, 5.5],
  "HMS-001": [10, 5.5],
  "OSC-001": [9, 5.5],
  "INT-001": [10, 5.5],
  "AND-001": [8.5, 8.5],
  "QCP-001": [6.5, 6.5],
  "DIM-001": [8.5, 8.5],
  "EXD-001": [9, 9],
  "NXS-01": [11, 11],
  "LCT-001": [10, 5],
  "P3D-001": [8.5, 8.5],
  "MFR-001": [13, 13],
  "EMC-001": [9, 9],
  "QSM-001": [9, 7],
  "QAN-001": [9, 6],
  "AIC-001": [9, 7],
  "SCA-001": [14, 5],
  "TLP-001": [12, 12],
};

/** Colours a live screen may sit on (the dark face left by bezelScreen). */
const DARK = new Set<number>([C.black, C.crt_bg, C.paint_black, C.metal_dark]);

const SCREEN_CONTENT = new Set<ScreenContent>([
  "power",
  "wave",
  "scope",
  "status",
  "log",
  "map",
  "text",
  "bars",
  "clock",
  "radar",
  "code",
  "face",
  "spectrum",
  "qubits",
  "reactor",
  "damien",
  "boot",
  "noise",
]);

/**
 * Voxel cells a screen covers: [behind, inFront] voxel coords per cell of
 * its rectangle, derived from `center`, `w`, `h` and `normal`.
 */
function screenCells(s: ScreenSpec): [Vec3, Vec3][] {
  const [cx, cy, cz] = s.center;
  const out: [Vec3, Vec3][] = [];
  const u0 = (c: number, n: number) => Math.round(c - n / 2);
  for (let i = 0; i < s.w; i++)
    for (let j = 0; j < s.h; j++) {
      switch (s.normal) {
        case "+z":
        case "-z": {
          const x = u0(cx, s.w) + i;
          const y = u0(cy, s.h) + j;
          const back = s.normal === "+z" ? cz - 1 : cz;
          const front = s.normal === "+z" ? cz : cz - 1;
          out.push([
            [x, y, back],
            [x, y, front],
          ]);
          break;
        }
        case "+x":
        case "-x": {
          const z = u0(cz, s.w) + i;
          const y = u0(cy, s.h) + j;
          const back = s.normal === "+x" ? cx - 1 : cx;
          const front = s.normal === "+x" ? cx : cx - 1;
          out.push([
            [back, y, z],
            [front, y, z],
          ]);
          break;
        }
        case "+y": {
          const x = u0(cx, s.w) + i;
          const z = u0(cz, s.h) + j;
          out.push([
            [x, cy - 1, z],
            [x, cy, z],
          ]);
          break;
        }
      }
    }
  return out;
}

function checkVisual(name: string, v: DeviceVisual): void {
  expect(v.base.grid.count(), `${name} base is empty`).toBeGreaterThan(0);
  const { w, h, d } = v.base;
  const names = new Set<string>();
  for (const p of v.parts) {
    expect(names.has(p.name), `${name}: duplicate part ${p.name}`).toBe(false);
    names.add(p.name);
    expect(p.model.grid.count(), `${name}.${p.name} is empty`).toBeGreaterThan(0);
    expect(Number.isFinite(p.speed), `${name}.${p.name} speed`).toBe(true);
    if (p.parent) {
      expect(names.has(p.parent), `${name}.${p.name} parent must come first`).toBe(true);
      continue;
    }
    // Pivot and offset within a generous box around the base.
    const [ox, oy, oz] = p.offset;
    expect(ox, `${name}.${p.name} x`).toBeGreaterThanOrEqual(-w / 2);
    expect(ox, `${name}.${p.name} x`).toBeLessThanOrEqual(w * 1.5);
    expect(oy, `${name}.${p.name} y`).toBeGreaterThanOrEqual(-2);
    expect(oy, `${name}.${p.name} y`).toBeLessThanOrEqual(h * 1.5);
    expect(oz, `${name}.${p.name} z`).toBeGreaterThanOrEqual(-d / 2);
    expect(oz, `${name}.${p.name} z`).toBeLessThanOrEqual(d * 1.5);
    const pv = partPivotInBase(v.base, p);
    expect(Math.abs(pv[0]), `${name}.${p.name} pivot x`).toBeLessThanOrEqual(w);
    expect(Math.abs(pv[2]), `${name}.${p.name} pivot z`).toBeLessThanOrEqual(d);
  }
  for (const l of v.lights) {
    expect(l.pos[0], `${name} light x`).toBeGreaterThanOrEqual(-1);
    expect(l.pos[0], `${name} light x`).toBeLessThanOrEqual(w + 1);
    expect(l.pos[1], `${name} light y`).toBeGreaterThanOrEqual(-1);
    expect(l.pos[1], `${name} light y`).toBeLessThanOrEqual((v.height ?? h) + 2);
    expect(l.pos[2], `${name} light z`).toBeGreaterThanOrEqual(-1);
    expect(l.pos[2], `${name} light z`).toBeLessThanOrEqual(d + 2);
    expect(l.color, `${name} light colour`).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(l.intensity).toBeGreaterThan(0);
    expect(l.distance).toBeGreaterThan(0);
  }
  expect(v.height ?? h).toBeGreaterThanOrEqual(h);
}

/**
 * Colours of the layer the camera sees from outside a face after a rotation
 * (the back "-z" or a side "±x"), skipping the dust rows below `minY`.
 */
function faceLayer(m: Model, side: "-z" | "-x" | "+x", minY = 3): number[] {
  const out: number[] = [];
  const U = side === "-z" ? m.w : m.d;
  const D = side === "-z" ? m.d : m.w;
  for (let y = minY; y < m.h; y++)
    for (let u = 0; u < U; u++)
      for (let k = 0; k < D; k++) {
        const [x, z] = side === "-z" ? [u, k] : side === "-x" ? [k, u] : [m.w - 1 - k, u];
        const c = m.grid.get(x, y, z);
        if (c) {
          out.push(c);
          break;
        }
      }
  return out;
}

/**
 * Detail on a face: accent colours (beyond the two most common — body and
 * edge — with at least 3 visible voxels each) and the number of voxels in
 * any colour other than those two.
 */
function faceDetail(layer: number[]): { accents: number; detail: number } {
  const count = new Map<number, number>();
  for (const c of layer) count.set(c, (count.get(c) ?? 0) + 1);
  const sorted = [...count.values()].sort((a, b) => b - a);
  const base = (sorted[0] ?? 0) + (sorted[1] ?? 0);
  return { accents: sorted.slice(2).filter((n) => n >= 3).length, detail: layer.length - base };
}

describe("device visuals", () => {
  it("every device has a hand-made visual", () => {
    for (const d of DEVICES) expect(DEVICE_VISUAL_IDS, d.id).toContain(d.id);
    expect(DEVICE_VISUAL_IDS.length).toBe(DEVICES.length);
  });

  it("bases, parts and lights are well-formed and sized per tier", () => {
    for (const d of DEVICES) {
      const v = deviceVisual(d.id);
      checkVisual(d.id, v);
      const sc = v.scale ?? MODEL_SCALE;
      const [mw, mh, md] = LIMITS[d.tier];
      expect(v.base.w * sc, `${d.id} w`).toBeLessThanOrEqual(mw);
      expect(v.base.h * sc, `${d.id} h`).toBeLessThanOrEqual(mh);
      expect(v.base.d * sc, `${d.id} d`).toBeLessThanOrEqual(md);
      expect((v.height ?? v.base.h) * sc, `${d.id} height`).toBeLessThanOrEqual(13);
      expect(Math.min(v.base.w, v.base.d) * sc, `${d.id} too small`).toBeGreaterThanOrEqual(2);
    }
  });

  it("every device is a high-detail model with the room's world footprint", () => {
    for (const d of DEVICES) {
      const v = deviceVisual(d.id);
      expect(v.scale, d.id).toBe(DETAIL_SCALE);
      const [fw, fd] = v.footprint ?? [v.base.w, v.base.d];
      const [ew, ed] = FOOTPRINT[d.id] ?? [0, 0];
      expect(fw * DETAIL_SCALE, `${d.id} footprint w`).toBeGreaterThanOrEqual(ew * 0.85);
      expect(fw * DETAIL_SCALE, `${d.id} footprint w`).toBeLessThanOrEqual(ew * 1.15);
      expect(fd * DETAIL_SCALE, `${d.id} footprint d`).toBeGreaterThanOrEqual(ed * 0.85);
      expect(fd * DETAIL_SCALE, `${d.id} footprint d`).toBeLessThanOrEqual(ed * 1.15);
    }
  });

  it("every device animates and glows", () => {
    for (const d of DEVICES) {
      const v = deviceVisual(d.id);
      expect(v.parts.length, d.id).toBeGreaterThanOrEqual(2);
      expect(v.parts.length, d.id).toBeLessThanOrEqual(HERO_DEVICES.has(d.id) ? 12 : 9);
      expect(v.lights.length, d.id).toBeGreaterThanOrEqual(1);
      expect(v.lights.length, d.id).toBeLessThanOrEqual(3);
      for (const p of v.parts)
        expect(p.model.grid.count(), `${d.id}.${p.name} too big`).toBeLessThanOrEqual(2500);
      for (const l of v.lights) {
        expect(l.pos[0], `${d.id} light x`).toBeLessThanOrEqual(v.base.w);
        expect(l.pos[2], `${d.id} light z`).toBeLessThanOrEqual(v.base.d);
      }
    }
  });

  it("every device has 1–3 live screens lying on a dark face of the model", () => {
    for (const d of DEVICES) {
      const v = deviceVisual(d.id);
      const screens = v.screens ?? [];
      expect(screens.length, d.id).toBeGreaterThanOrEqual(1);
      expect(screens.length, d.id).toBeLessThanOrEqual(3);
      const g = v.base.grid;
      screens.forEach((s, k) => {
        const tag = `${d.id} screen ${k} (${s.content})`;
        expect(SCREEN_CONTENT.has(s.content), tag).toBe(true);
        expect(s.w, tag).toBeGreaterThanOrEqual(2);
        expect(s.h, tag).toBeGreaterThanOrEqual(2);
        const [cx, cy, cz] = s.center;
        expect(cx, tag).toBeGreaterThanOrEqual(0);
        expect(cx, tag).toBeLessThanOrEqual(v.base.w);
        expect(cy, tag).toBeGreaterThanOrEqual(0);
        expect(cy, tag).toBeLessThanOrEqual(v.base.h);
        expect(cz, tag).toBeGreaterThanOrEqual(0);
        expect(cz, tag).toBeLessThanOrEqual(v.base.d);
        if (s.color) expect(s.color, tag).toMatch(/^#[0-9a-fA-F]{6}$/);
        for (const [back, front] of screenCells(s)) {
          expect(DARK.has(g.get(...back)), `${tag}: no dark face at ${back.join(",")}`).toBe(true);
          expect(g.get(...front), `${tag}: blocked at ${front.join(",")}`).toBe(0);
        }
      });
    }
  });

  it("the MCP shows a face and a log, the Echo Recorder shows Damien", () => {
    const kinds = (id: string) => (deviceVisual(id).screens ?? []).map((s) => s.content);
    expect(kinds("MCP-000")).toEqual(expect.arrayContaining(["face", "log"]));
    expect(kinds("ECR-001")).toContain("damien");
    expect(kinds("OSC-001")).toContain("scope");
    expect(kinds("MFR-001")).toContain("reactor");
    expect(kinds("CLK-001")).toContain("clock");
    expect(kinds("NXS-01")).toContain("map");
    expect(kinds("QSM-001")).toContain("qubits");
  });

  it("wall-mounted devices are shallow with a back plate at z = 0", () => {
    for (const id of WALL_MOUNTED) {
      const v = deviceVisual(id);
      const m = v.base;
      expect(m.d * (v.scale ?? MODEL_SCALE), id).toBeLessThanOrEqual(2.5);
      let back = 0;
      m.grid.forEach((_x, _y, z) => {
        if (z === 0) back++;
      });
      expect(back, id).toBeGreaterThan(20);
    }
  });

  it("backs and sides are dressed, not bare (the camera sees every device from all four sides)", () => {
    for (const d of DEVICES) {
      const m = deviceVisual(d.id).base;
      // Wall-mounted devices keep a flat back plate against the wall.
      if (!WALL_MOUNTED.includes(d.id)) {
        const back = faceDetail(faceLayer(m, "-z"));
        expect(back.accents, `${d.id} back: accent colours`).toBeGreaterThanOrEqual(5);
        expect(back.detail, `${d.id} back: detail voxels`).toBeGreaterThanOrEqual(40);
      }
      for (const side of ["-x", "+x"] as const) {
        const f = faceDetail(faceLayer(m, side));
        expect(f.accents, `${d.id} ${side} side: accent colours`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("unpowered devices go dark (every emissive voxel has an EMISSIVE_OFF stand-in)", () => {
    for (const d of DEVICES) {
      const glowing: string[] = [];
      stagedGrid(deviceVisual(d.id).base.grid, 1, false).forEach((x, y, z, c) => {
        if (labMaterialOf(c) === "emit") glowing.push(`${x},${y},${z}`);
      });
      expect(glowing, `${d.id} glows unpowered`).toEqual([]);
    }
  });

  it("deviceModel returns the visual's base and is deterministic", () => {
    for (const d of DEVICES) {
      const a = deviceModel(d.id);
      const b = deviceVisual(d.id).base;
      expect([a.w, a.h, a.d]).toEqual([b.w, b.h, b.d]);
      expect(Array.from(a.grid.data)).toEqual(Array.from(b.grid.data));
    }
  });

  it("unknown ids fall back to a crate", () => {
    const v = deviceVisual("NOPE-000");
    expect(v.base.grid.count()).toBeGreaterThan(0);
    expect(v.parts).toEqual([]);
  });
});

describe("characters and bots", () => {
  it("every lore bot has a distinct animated visual", () => {
    expect([...BOT_IDS].sort()).toEqual([...LORE_BOTS].sort());
    const shapes = new Set<string>();
    for (const id of LORE_BOTS) {
      const v = botVisual(id);
      checkVisual(id, v);
      expect(v.parts.length, id).toBeGreaterThanOrEqual(1);
      expect(
        v.parts.every((p) => !p.requiresPower),
        id,
      ).toBe(true);
      expect(Math.max(v.base.w, v.base.h, v.base.d), id).toBeLessThanOrEqual(BOT_MAX_WIDTH);
      expect(botModel(id).grid.count()).toBe(v.base.grid.count());
      shapes.add(`${v.base.w}x${v.base.h}x${v.base.d}:${v.base.grid.count()}`);
    }
    expect(shapes.size).toBe(LORE_BOTS.length);
  });

  it("humanoids keep the rig contract", () => {
    for (const parts of [jadeModel(), damienModel(), damienSolidModel()]) {
      expect(parts.legL.h).toBe(parts.hip);
      expect(parts.body.w).toBe(parts.width);
      expect(parts.body.d).toBeGreaterThanOrEqual(4);
      expect(parts.shoulder).toBeGreaterThan(parts.hip);
      expect(parts.shoulder).toBeLessThanOrEqual(parts.hip + parts.body.h);
      for (const m of [parts.body, parts.legL, parts.legR, parts.armL, parts.armR])
        expect(m.grid.count()).toBeGreaterThan(0);
    }
  });

  it("the Damien hologram only uses hologram colours", () => {
    const holo = damienModel();
    const solid = damienSolidModel();
    const colours = new Set<number>();
    holo.body.grid.forEach((_x, _y, _z, v) => colours.add(v));
    expect(colours.size).toBeLessThanOrEqual(2);
    expect(holo.body.grid.count()).toBe(solid.body.grid.count());
  });
});

describe("animTransform", () => {
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
  const kinds: AnimPart["kind"][] = [
    "spin",
    "bob",
    "blink",
    "pulse",
    "sway",
    "orbit",
    "flicker",
    "slide",
  ];

  it("is deterministic", () => {
    for (const k of kinds)
      for (const t of [0, 0.37, 1.5, 12.25, 1000.1])
        expect(animTransform(part(k), t, true)).toEqual(animTransform(part(k), t, true));
  });

  it("spins linearly about the chosen axis", () => {
    const s = animTransform(part("spin", { axis: "z", speed: 2, phase: 0.5 }), 3, true);
    expect(s.rot).toEqual([0, 0, 6.5]);
    expect(s.pos).toEqual([0, 0, 0]);
    expect(s.visible).toBe(true);
    expect(s.intensity).toBe(1);
  });

  it("bobs, sways and slides within their amplitude", () => {
    for (let t = 0; t < 5; t += 0.13) {
      const b = animTransform(part("bob", { amplitude: 2, speed: 0.7 }), t, true);
      expect(Math.abs(b.pos[1])).toBeLessThanOrEqual(2 + 1e-9);
      const w = animTransform(part("sway", { amplitude: 0.4 }), t, true);
      expect(Math.abs(w.rot[2])).toBeLessThanOrEqual(0.4 + 1e-9);
      const s = animTransform(part("slide", { amplitude: 3, speed: 0.3 }), t, true);
      expect(Math.abs(s.pos[0])).toBeLessThanOrEqual(3 + 1e-9);
    }
    expect(animTransform(part("bob", { speed: 0.25, amplitude: 2 }), 1, true).pos[1]).toBeCloseTo(
      2,
    );
  });

  it("orbits on a circle of radius amplitude", () => {
    for (const t of [0, 0.4, 2.2]) {
      const o = animTransform(part("orbit", { amplitude: 5 }), t, true);
      expect(Math.hypot(o.pos[0], o.pos[2])).toBeCloseTo(5);
      expect(o.pos[1]).toBe(0);
    }
  });

  it("blinks with the duty cycle and pulses/flickers within 0..1", () => {
    const blink = part("blink", { speed: 1, amplitude: 0.25 });
    expect(animTransform(blink, 0.1, true).visible).toBe(true);
    expect(animTransform(blink, 0.5, true).visible).toBe(false);
    for (let t = 0; t < 4; t += 0.11) {
      for (const k of ["pulse", "flicker"] as const) {
        const i = animTransform(part(k, { speed: 3 }), t, true).intensity;
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThanOrEqual(1);
      }
    }
  });

  it("freezes and darkens unpowered parts that need power", () => {
    for (const k of kinds) {
      const a = animTransform(part(k, { phase: 0.3 }), 7.3, false);
      const b = animTransform(part(k, { phase: 0.3 }), 0, false);
      expect(a).toEqual(b);
      expect(a.intensity).toBe(0);
    }
    expect(animTransform(part("blink"), 0.1, false).visible).toBe(false);
    const free = part("spin", { requiresPower: false });
    expect(animTransform(free, 2, false).rot[1]).toBe(2);
    expect(animTransform(free, 2, false).intensity).toBe(1);
  });

  it("scales light intensity with power and flicker", () => {
    const l = {
      pos: [0, 0, 0] as [number, number, number],
      color: "#ffffff",
      intensity: 10,
      distance: 5,
    };
    expect(lightIntensity({ ...l, requiresPower: true }, 1, false)).toBe(0);
    expect(lightIntensity({ ...l, requiresPower: true }, 1, true)).toBe(10);
    expect(lightIntensity({ ...l, requiresPower: false }, 1, false)).toBe(10);
    const f = lightIntensity({ ...l, requiresPower: true, flicker: true }, 1.3, true);
    expect(f).toBeGreaterThanOrEqual(7);
    expect(f).toBeLessThanOrEqual(10);
  });
});

import { describe, expect, it } from "vitest";
import { VoxelGrid } from "@/lib/voxel/grid";
import {
  combine,
  decodeRuns,
  encodeRuns,
  fromUvox,
  gridSha,
  mirror,
  rotateY90,
  toUvox,
  upsample,
  type PaletteSource,
} from "@/lib/voxel/uvox";
import { C, LAB_PALETTE, labMaterialOf } from "@/lib/world/content/palette";
import { composeVisual } from "@/lib/world/models/compose";
import { deviceVisual } from "@/lib/world/models/devices";
import { modelFromUvox } from "@/lib/world/models/uvox-model";
import { DOORS } from "@/lib/world/content/map";
import { doorStyle } from "@/lib/world/doors/style";
import { doorPieces, mechParts } from "@/lib/world/models/door-styles";
import { doorAssembly } from "@/scripts/voxel/door-parts";

const PAL: PaletteSource = {
  rgb: (i) => {
    const [r, g, b] = LAB_PALETTE.get(i);
    return [r, g, b];
  },
  mat: (i) => labMaterialOf(i),
  name: (i) => `c${i}`,
};

function sample(): VoxelGrid {
  const g = new VoxelGrid(5, 4, 3);
  g.set(0, 0, 0, C.steel);
  g.set(4, 3, 2, C.led_green);
  g.set(2, 1, 1, C.safety_red);
  g.set(1, 2, 0, C.metal_dark);
  return g;
}

describe("uvox format (lib/voxel/uvox.ts)", () => {
  it("round-trips runs and grids bit for bit", () => {
    const g = sample();
    expect(decodeRuns(encodeRuns(g.data), g.data.length)).toEqual(g.data);
    const m = toUvox("s", g, PAL, { unit: 0.25 });
    const back = fromUvox(JSON.parse(JSON.stringify(m)));
    expect(back.data).toEqual(g.data);
    expect(gridSha(back)).toBe(m.sha);
  });

  it("rejects a file whose voxels do not match its sha", () => {
    const m = toUvox("s", sample(), PAL, { unit: 1 });
    m.runs[0] = C.steel === 1 ? 2 : 1;
    expect(() => fromUvox(m)).toThrow(/sha/);
  });

  it("quarter turns and mirrors are lossless", () => {
    const g = sample();
    expect(gridSha(rotateY90(g, 4))).toBe(gridSha(g));
    expect(gridSha(rotateY90(rotateY90(g, 1), 3))).toBe(gridSha(g));
    expect(gridSha(mirror(mirror(g, "z"), "z"))).toBe(gridSha(g));
    const r = rotateY90(g, 1);
    expect([r.sx, r.sy, r.sz]).toEqual([g.sz, g.sy, g.sx]);
    // three.js rotation.y +90°: (x, z) → (z, sx − 1 − x)
    expect(r.get(0, 0, g.sx - 1)).toBe(C.steel);
  });

  it("combines different voxel sizes exactly or refuses", () => {
    const coarse = new VoxelGrid(1, 1, 1);
    coarse.set(0, 0, 0, C.steel);
    const fine = new VoxelGrid(1, 1, 1);
    fine.set(0, 0, 0, C.led_green);
    const out = combine([
      { grid: coarse, unit: 0.5, origin: [0, 0, 0] },
      { grid: fine, unit: 0.25, origin: [0.5, 0.25, 0] },
    ]);
    expect(out.unit).toBe(0.25);
    expect([out.grid.sx, out.grid.sy, out.grid.sz]).toEqual([3, 2, 2]);
    expect(out.grid.count()).toBe(8 + 1);
    expect(out.grid.get(2, 1, 0)).toBe(C.led_green);
    expect(gridSha(upsample(coarse, 2))).toBe(
      gridSha(combine([{ grid: coarse, unit: 0.5, origin: [0, 0, 0] }], 0.25).grid),
    );
    expect(() =>
      combine([
        { grid: coarse, unit: 0.5, origin: [0, 0, 0] },
        { grid: fine, unit: 0.3, origin: [0, 0, 0] },
      ]),
    ).toThrow(/multiple/);
    expect(() =>
      combine([
        { grid: coarse, unit: 0.5, origin: [0, 0, 0] },
        { grid: fine, unit: 0.25, origin: [0.1, 0, 0] },
      ]),
    ).toThrow(/lattice/);
  });

  it("brings a device back into the game voxel for voxel", () => {
    const g = composeVisual(deviceVisual("CLK-001"), 0, true);
    const m = toUvox("CLK-001", g, PAL, { unit: 0.5 });
    const { model, scale, fine } = modelFromUvox(m);
    expect(gridSha(model.grid)).toBe(gridSha(g));
    expect(scale).toBe(0.5);
    expect(fine).toBe(true);
    const wrong = {
      ...m,
      palette: m.palette.map((p, i) =>
        i ? p : { ...p, rgb: [0, 0, 0] as [number, number, number] },
      ),
    };
    expect(() => modelFromUvox(wrong)).toThrow(/palette/);
  });

  it("assembles every door with the engine's parts", () => {
    for (const d of DOORS) {
      const uses = doorAssembly(d).map((p) => p.use);
      if (d.secret) {
        expect(uses.some((u) => u.startsWith(`door-secret-${d.id}/`))).toBe(true);
        continue;
      }
      const s = doorStyle(d.id);
      expect(uses.filter((u) => /\/mech\d+$/.test(u))).toHaveLength(mechParts(s).length);
      expect(uses.filter((u) => u.startsWith(`door-style-${d.id}-`))).toHaveLength(
        doorPieces(s, "green").length,
      );
    }
  });
});

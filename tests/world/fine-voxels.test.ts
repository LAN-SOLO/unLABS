import { describe, expect, it } from "vitest";
import { VoxelGrid } from "@/lib/voxel/grid";
import { greedyMesh } from "@/lib/voxel/mesher";
import { fineGrid, fineMesh } from "@/lib/voxel/fine-grid";
import { C, LAB_PALETTE, labMaterialOf } from "@/lib/world/content/palette";
import { DEVICE_VISUAL_IDS, deviceVisual } from "@/lib/world/models/devices";
import { MESH_TIERS, clearRefineCache, refinedModelMesh } from "@/lib/world/models/refine";

const mat = { materialOf: labMaterialOf };

function box(n: number, v: number = C.steel): VoxelGrid {
  const g = new VoxelGrid(n, n, n);
  g.fill([0, 0, 0], [n, n, n], v);
  return g;
}

function extent(p: Float32Array): number[] {
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) {
    mn[i % 3] = Math.min(mn[i % 3]!, p[i]!);
    mx[i % 3] = Math.max(mx[i % 3]!, p[i]!);
  }
  return [...mn, ...mx];
}

describe("fine voxels (clarity divisions)", () => {
  it("keeps flat faces in place and rounds the corners of a block", () => {
    const f = fineGrid(box(6), 4, mat);
    expect([f.sx, f.sy, f.sz]).toEqual([24, 24, 24]);
    // Face centres are solid right up to the boundary …
    expect(f.get(0, 12, 12)).toBe(C.steel);
    expect(f.get(23, 12, 12)).toBe(C.steel);
    // … the outermost corner sub-voxel is cut (a rounded bevel).
    expect(f.get(0, 0, 0)).toBe(0);
    expect(f.get(23, 23, 23)).toBe(0);
  });

  it("never loses thin parts (a one-voxel rod)", () => {
    const g = new VoxelGrid(9, 3, 3);
    g.fill([0, 1, 1], [9, 2, 2], C.steel);
    for (const m of [2, 3, 4]) {
      const f = fineGrid(g, m, mat);
      for (let x = 0; x < 9; x++) {
        const c = Math.floor(1.5 * m);
        expect(f.get(x * m + Math.floor(m / 2), c, c)).toBe(C.steel);
      }
    }
  });

  it("keeps screens and LEDs as crisp blocks", () => {
    const g = box(4);
    g.set(0, 2, 2, C.screen_green);
    const f = fineGrid(g, 4, mat);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        for (let k = 0; k < 4; k++) expect(f.get(i, 8 + j, 8 + k)).toBe(C.screen_green);
  });

  it("meshes block by block with the same extent as the whole grid", () => {
    const g = new VoxelGrid(40, 20, 20);
    g.fill([2, 0, 2], [38, 12, 18], C.steel);
    g.fill([10, 12, 5], [30, 18, 15], C.paint_white);
    const whole = fineGrid(g, 3, mat);
    const a = greedyMesh(whole, [0, 0, 0], [whole.sx, whole.sy, whole.sz], {
      palette: LAB_PALETTE,
      ...mat,
      scale: 1 / 3,
    });
    const b = fineMesh(g, 3, { palette: LAB_PALETTE, ...mat });
    const ea = extent(a.positions);
    const eb = extent(b.positions);
    for (let i = 0; i < 6; i++) expect(eb[i]).toBeCloseTo(ea[i]!, 5);
  });

  it("every model tier keeps the model's extent", () => {
    clearRefineCache();
    const grid = deviceVisual(DEVICE_VISUAL_IDS[0]!).base.grid;
    const ref = extent(refinedModelMesh(grid, "device", { center: true, tier: 2 }).positions);
    for (const tier of MESH_TIERS) {
      const e = extent(refinedModelMesh(grid, "device", { center: true, tier }).positions);
      // Rounded corners may pull a bounding plane in by less than one source voxel.
      for (let i = 0; i < 6; i++) expect(Math.abs(e[i]! - ref[i]!)).toBeLessThan(1);
    }
  });
});

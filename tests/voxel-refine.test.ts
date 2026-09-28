import { describe, expect, it } from "vitest";
import { VoxelGrid, readBox, type Vec3 } from "@/lib/voxel/grid";
import { greedyMesh, type MaterialClass } from "@/lib/voxel/mesher";
import { Palette } from "@/lib/voxel/palette";
import { refineGrid, refineHash, refineRegion, type RefineOptions } from "@/lib/voxel/refine";
import { VoxelWorld } from "@/lib/voxel/world";

// 1 steel (metal), 2 paint (solid), 3 glass, 4 screen (emit), 5 led (emit),
// 6 dark steel, 7 light steel, 8 dark paint, 9 light paint, 10 crt bg, 11 bezel
const palette = Palette.fromHex([
  "#8f969e",
  "#dcdcd4",
  "#9fd8ff",
  "#33ff33",
  "#ff3333",
  "#50565d",
  "#c9d0d6",
  "#b0b0aa",
  "#f2f2ea",
  "#0a1a0a",
  "#0d0d0d",
]);
const CLASS: Record<number, MaterialClass> = {
  1: "metal",
  3: "glass",
  4: "emit",
  5: "emit",
  6: "metal",
  7: "metal",
};
const materialOf = (i: number): MaterialClass => CLASS[i] ?? "solid";
const table = (pairs: [number, number][]): Uint8Array => {
  const t = new Uint8Array(256);
  for (const [k, v] of pairs) t[k] = v;
  return t;
};
const RICH: RefineOptions = {
  materialOf,
  dark: table([
    [1, 6],
    [2, 8],
  ]),
  light: table([
    [1, 7],
    [2, 9],
  ]),
  scan: table([[4, 10]]),
  bezel: table([[5, 11]]),
  rules: {
    bevel: 3,
    thinLines: true,
    seams: [4, 4, 4],
    grooves: true,
    rivets: true,
    wear: 0.2,
    scanlines: true,
    leds: true,
  },
};

function box(size: Vec3, c: number): VoxelGrid {
  const g = new VoxelGrid(size[0], size[1], size[2]);
  g.fill([0, 0, 0], size, c);
  return g;
}

/** Non-empty sub-voxels of source voxel (x, y, z). */
function kept(f: VoxelGrid, x: number, y: number, z: number): number {
  let n = 0;
  for (let o = 0; o < 8; o++)
    if (f.get(2 * x + (o & 1), 2 * y + ((o >> 1) & 1), 2 * z + ((o >> 2) & 1))) n++;
  return n;
}

/** A small "device": thick metal shell, painted panel, thin fins, screen, LEDs, glass. */
function device(): VoxelGrid {
  const g = new VoxelGrid(14, 12, 10);
  g.fill([1, 0, 1], [13, 10, 9], 1);
  g.fill([2, 2, 9], [12, 8, 10], 2); // painted front plate (1 thick, on the shell)
  g.fill([4, 3, 9], [9, 7, 10], 4); // screen on the plate
  g.set(10, 6, 9, 5); // lone LEDs flush in the plate
  g.set(10, 4, 9, 5);
  for (let x = 2; x < 12; x += 2) g.fill([x, 10, 3], [x + 1, 12, 7], 1); // thin fins
  g.fill([0, 2, 3], [1, 6, 7], 3); // glass window
  return g;
}

describe("refineGrid", () => {
  it("doubles every dimension", () => {
    const f = refineGrid(box([3, 5, 7], 2), RICH);
    expect([f.sx, f.sy, f.sz]).toEqual([6, 10, 14]);
  });

  it("is a plain subdivision without rules", () => {
    const g = device();
    const f = refineGrid(g, { materialOf });
    g.forEach((x, y, z, v) => {
      for (let o = 0; o < 8; o++)
        expect(f.get(2 * x + (o & 1), 2 * y + ((o >> 1) & 1), 2 * z + ((o >> 2) & 1))).toBe(v);
    });
    expect(f.count()).toBe(g.count() * 8);
  });

  it("never adds voxels outside the source silhouette", () => {
    const g = device();
    const f = refineGrid(g, RICH);
    f.forEach((x, y, z) => expect(g.get(x >> 1, y >> 1, z >> 1)).not.toBe(0));
  });

  it("keeps at least 4 of 8 sub-voxels of every source voxel", () => {
    const g = device();
    const f = refineGrid(g, RICH);
    let min = 8;
    g.forEach((x, y, z) => (min = Math.min(min, kept(f, x, y, z))));
    expect(min).toBeGreaterThanOrEqual(4);
  });

  it("chamfers long convex edges of thick blocks", () => {
    const f = refineGrid(box([6, 6, 6], 2), { materialOf, rules: { bevel: 3 } });
    // Edge along x at the top front: the outer (y+, z+) sub-voxel is gone …
    expect(f.get(5, 11, 11)).toBe(0);
    // … the face centres stay, so the bounding box is unchanged.
    expect(f.get(5, 11, 6)).toBe(2);
    expect(f.get(5, 6, 11)).toBe(2);
    expect(f.get(0, 5, 5)).toBe(2);
    expect(f.get(11, 5, 5)).toBe(2);
  });

  it("does not bevel short edges (runs below the threshold)", () => {
    const f = refineGrid(box([2, 2, 2], 2), { materialOf, rules: { bevel: 3 } });
    expect(f.count()).toBe(64);
  });

  it("preserves 1-voxel-thin features completely", () => {
    // A 1-voxel-thick plate and a 1×1 post: no rule may open a hole.
    const g = new VoxelGrid(12, 12, 3);
    g.fill([0, 0, 1], [12, 12, 2], 1);
    g.fill([5, 0, 0], [6, 12, 1], 2);
    const f = refineGrid(g, RICH);
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        // The plate's projection along z stays fully covered.
        expect(f.get(x, y, 2) || f.get(x, y, 3)).not.toBe(0);
      }
    // Plate voxels that are 1 thick (not backed by the post) lose nothing.
    g.forEach((x, y, z) => {
      if (z === 1 && x !== 5) expect(kept(f, x, y, z)).toBe(8);
    });
  });

  it("leaves glass untouched and never removes emissive sub-voxels", () => {
    const g = device();
    const f = refineGrid(g, RICH);
    g.forEach((x, y, z, v) => {
      if (v === 3)
        for (let o = 0; o < 8; o++)
          expect(f.get(2 * x + (o & 1), 2 * y + ((o >> 1) & 1), 2 * z + ((o >> 2) & 1))).toBe(3);
      if (v === 4 || v === 5) expect(kept(f, x, y, z)).toBe(8);
    });
  });

  it("gives screens scanlines and LEDs a lit sub-voxel in a bezel", () => {
    const g = device();
    const f = refineGrid(g, RICH);
    // Screen face (z = 9 → outer sub-layer 19): alternate sub-rows dim.
    const rows = [6, 7, 8, 9].map((y) => f.get(12, y, 19));
    expect(rows).toEqual([10, 4, 10, 4]);
    // LED at (10, 6, 9): exactly one lit sub-voxel on the open face, the rest bezel.
    const face = [0, 1, 2, 3].map((o) => f.get(20 + (o & 1), 12 + (o >> 1), 19));
    expect(face.filter((v) => v === 5)).toHaveLength(1);
    expect(face.filter((v) => v === 11)).toHaveLength(3);
  });

  it("cuts grooved seams and rivets into large flat metal faces", () => {
    const g = box([12, 12, 12], 1);
    const f = refineGrid(g, { ...RICH, rules: { seams: [4, 4, 4], grooves: true, rivets: true } });
    // Seam at x = 4 on the +z face: outer sub dropped, inner one dark.
    expect(f.get(8, 11, 23)).toBe(0);
    expect(f.get(8, 11, 22)).toBe(6);
    // Rivet next to the seam crossing at (4, 4): light partner.
    expect(f.get(9, 9, 23)).toBe(7);
    // Plate interior untouched.
    expect(f.get(12, 13, 23)).toBe(1);
  });

  it("thins painted 1-voxel lines and keeps crossings joined", () => {
    const g = new VoxelGrid(10, 1, 10);
    for (let z = 0; z < 10; z++)
      for (let x = 0; x < 10; x++) g.set(x, 0, z, x % 3 === 0 || z % 3 === 0 ? 8 : 2);
    const f = refineGrid(g, { materialOf, rules: { thinLines: true } });
    const top = (x: number, z: number): number => f.get(x, 1, z);
    // Vertical line at x = 3: sub-column 6 stays the line, 7 becomes tile.
    expect(top(6, 9)).toBe(8);
    expect(top(7, 9)).toBe(2);
    // Crossing at (3, 3): the line continues through, the +x+z quadrant is tile.
    expect([top(6, 6), top(7, 6), top(6, 7), top(7, 7)]).toEqual([8, 8, 8, 2]);
  });

  it("is deterministic", () => {
    const a = refineGrid(device(), RICH);
    const b = refineGrid(device(), RICH);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    expect(refineHash(3, 4, 5, 9)).toBe(refineHash(3, 4, 5, 9));
    expect(refineHash(3, 4, 5, 9)).not.toBe(refineHash(3, 4, 6, 9));
  });

  it("meshes at half scale to the source extent", () => {
    const g = box([6, 4, 8], 2);
    const f = refineGrid(g, { materialOf, rules: { bevel: 3 } });
    const m = greedyMesh(f, [0, 0, 0], [f.sx, f.sy, f.sz], {
      palette,
      materialOf,
      offset: [-f.sx / 2, 0, -f.sz / 2],
      scale: 0.5,
    });
    const max = [-Infinity, -Infinity, -Infinity];
    const min = [Infinity, Infinity, Infinity];
    for (let i = 0; i < m.positions.length; i++) {
      max[i % 3] = Math.max(max[i % 3]!, m.positions[i]!);
      min[i % 3] = Math.min(min[i % 3]!, m.positions[i]!);
    }
    expect(min).toEqual([-3, 0, -4]);
    expect(max).toEqual([3, 4, 4]);
  });
});

describe("refineRegion", () => {
  it("refines adjacent boxes seamlessly (terrain chunks)", () => {
    const w = new VoxelWorld(64, 8, 16);
    for (let x = 0; x < 64; x++)
      for (let z = 0; z < 16; z++) {
        w.set(x, 0, z, (x >> 2) % 2 ? 2 : 1);
        if (z === 8 || x % 11 === 0) for (let y = 1; y < 6; y++) w.set(x, y, z, 2);
      }
    const opts: RefineOptions = { ...RICH, rules: { ...RICH.rules, bevel: 3 } };
    const whole = refineRegion(w, [0, 0, 0], [64, 8, 16], opts);
    const left = refineRegion(w, [0, 0, 0], [32, 8, 16], opts);
    const right = refineRegion(w, [32, 0, 0], [32, 8, 16], opts);
    whole.forEach((x, y, z, v) => {
      const part = x < 64 ? left.get(x, y, z) : right.get(x - 64, y, z);
      expect(part).toBe(v);
    });
    expect(left.count() + right.count()).toBe(whole.count());
  });
});

describe("readBox", () => {
  it("copies grids and chunked worlds identically, 0 outside", () => {
    const w = new VoxelWorld(70, 10, 40);
    const g = new VoxelGrid(70, 10, 40);
    for (let i = 0; i < 400; i++) {
      const x = (i * 37) % 70;
      const y = (i * 11) % 10;
      const z = (i * 17) % 40;
      w.set(x, y, z, 1 + (i % 9));
      g.set(x, y, z, 1 + (i % 9));
    }
    const min: Vec3 = [-3, -2, 20];
    const size: Vec3 = [76, 14, 25];
    const a = readBox(w, min, size);
    const b = readBox(g, min, size);
    const c = readBox({ get: (x, y, z) => g.get(x, y, z) }, min, size);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(Buffer.from(b).equals(Buffer.from(c))).toBe(true);
  });
});

describe("VoxelWorld.dirtyReach", () => {
  it("dirties neighbour chunks (incl. diagonals) within reach of an edit", () => {
    const w = new VoxelWorld(96, 32, 96);
    for (const [x, z] of [
      [10, 10],
      [40, 40],
      [70, 70],
      [40, 10],
      [10, 40],
    ] as const)
      w.set(x, 0, z, 1);
    w.dirty.clear();
    w.dirtyReach = 4;
    w.set(35, 0, 35, 2); // 3 voxels into chunk (1, 0, 1) → touches (0, 0, 0) diagonally
    expect([...w.dirty].sort()).toEqual(["0,0,0", "0,0,1", "1,0,0", "1,0,1"]);
    w.dirty.clear();
    w.set(48, 0, 48, 2); // chunk centre: nothing else
    expect([...w.dirty]).toEqual(["1,0,1"]);
  });
});

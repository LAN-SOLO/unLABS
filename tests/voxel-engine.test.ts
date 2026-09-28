import { describe, expect, it } from "vitest";
import { VoxelGrid } from "@/lib/voxel/grid";
import { greedyMesh } from "@/lib/voxel/mesher";
import { Palette } from "@/lib/voxel/palette";
import { raycastVoxels } from "@/lib/voxel/raycast";
import { moveBox, overlapsSolid } from "@/lib/voxel/collision";
import { VoxelWorld } from "@/lib/voxel/world";

const palette = Palette.fromHex(["#808080", "#ff0000", "#88ccff"]);

describe("greedyMesh", () => {
  it("merges a solid 8³ cube into 6 quads", () => {
    const g = new VoxelGrid(8, 8, 8);
    g.fill([0, 0, 0], [8, 8, 8], 1);
    const m = greedyMesh(g, [0, 0, 0], [8, 8, 8], { palette });
    expect(m.quads).toBe(6);
    expect(m.indices.length).toBe(36);
  });

  it("emits outward-facing triangles (winding matches normals)", () => {
    const g = new VoxelGrid(1, 1, 1);
    g.set(0, 0, 0, 1);
    const m = greedyMesh(g, [0, 0, 0], [1, 1, 1], { palette, ao: false });
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [m.indices[t]!, m.indices[t + 1]!, m.indices[t + 2]!].map((i) => [
        m.positions[i * 3]!,
        m.positions[i * 3 + 1]!,
        m.positions[i * 3 + 2]!,
      ]);
      const u = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!];
      const v = [c![0]! - a![0]!, c![1]! - a![1]!, c![2]! - a![2]!];
      const cross = [
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ];
      const i = m.indices[t]! * 3;
      const dot =
        cross[0]! * m.normals[i]! + cross[1]! * m.normals[i + 1]! + cross[2]! * m.normals[i + 2]!;
      expect(dot).toBeGreaterThan(0);
    }
  });

  it("does not merge different colors and culls shared faces", () => {
    const g = new VoxelGrid(2, 1, 1);
    g.set(0, 0, 0, 1);
    g.set(1, 0, 0, 2);
    const m = greedyMesh(g, [0, 0, 0], [2, 1, 1], { palette, ao: false });
    expect(m.quads).toBe(10); // 12 faces minus the 2 touching ones
  });

  it("keeps faces behind glass and puts glass in its own group", () => {
    const g = new VoxelGrid(2, 1, 1);
    g.set(0, 0, 0, 1);
    g.set(1, 0, 0, 3);
    const m = greedyMesh(g, [0, 0, 0], [2, 1, 1], {
      palette,
      ao: false,
      materialOf: (i) => (i === 3 ? "glass" : "solid"),
    });
    expect(m.quads).toBe(11); // solid face against glass stays visible
    expect(m.groups.map((g) => g.material)).toEqual(["solid", "glass"]);
  });

  it("darkens occluded corners (AO)", () => {
    const g = new VoxelGrid(3, 2, 3);
    g.fill([0, 0, 0], [3, 1, 3], 1);
    g.set(0, 1, 0, 1); // a block sitting on the floor corner
    const m = greedyMesh(g, [0, 0, 0], [3, 2, 3], { palette });
    const floorTopBrightness: number[] = [];
    for (let i = 0; i < m.positions.length / 3; i++) {
      if (m.normals[i * 3 + 1] === 1 && m.positions[i * 3 + 1] === 1)
        floorTopBrightness.push(m.colors[i * 3]!);
    }
    expect(Math.min(...floorTopBrightness)).toBeLessThan(Math.max(...floorTopBrightness));
  });

  it("samples outside the region so chunk borders cull correctly", () => {
    const w = new VoxelWorld(64, 32, 32);
    for (let x = 0; x < 64; x++) w.set(x, 0, 0, 1);
    const left = greedyMesh(w, [0, 0, 0], [32, 32, 32], { palette, ao: false });
    // No face on the x = 32 border because the neighbour chunk is solid there.
    const hasBorderFace = Array.from(
      { length: left.positions.length / 3 },
      (_, i) => left.positions[i * 3],
    ).some((x, i) => x === 32 && left.normals[i * 3] === 1);
    expect(hasBorderFace).toBe(false);
  });
});

describe("VoxelWorld", () => {
  it("marks neighbour chunks dirty on border edits", () => {
    const w = new VoxelWorld(64, 32, 32);
    w.set(40, 0, 0, 1);
    w.dirty.clear();
    w.set(32, 0, 0, 1);
    w.set(31, 0, 0, 1);
    expect([...w.dirty].sort()).toEqual(["0,0,0", "1,0,0"]);
  });
});

describe("raycastVoxels", () => {
  it("hits the first solid voxel and reports the face normal", () => {
    const g = new VoxelGrid(10, 10, 10);
    g.set(5, 2, 2, 1);
    g.set(7, 2, 2, 1);
    const hit = raycastVoxels(g, [0.5, 2.5, 2.5], [1, 0, 0], 20);
    expect(hit?.voxel).toEqual([5, 2, 2]);
    expect(hit?.normal).toEqual([-1, 0, 0]);
    expect(hit?.distance).toBeCloseTo(4.5);
  });

  it("returns null when nothing is hit", () => {
    expect(raycastVoxels(new VoxelGrid(4, 4, 4), [0.5, 0.5, 0.5], [0, 1, 0], 10)).toBeNull();
  });
});

describe("moveBox", () => {
  it("lands on the ground and slides along walls", () => {
    const g = new VoxelGrid(10, 10, 10);
    g.fill([0, 0, 0], [10, 1, 10], 1);
    g.fill([6, 1, 0], [7, 5, 10], 1);
    const box = {
      min: [2, 3, 2] as [number, number, number],
      size: [0.6, 1.7, 0.6] as [number, number, number],
    };
    const fall = moveBox(g, box, [0, -2.5, 0]);
    expect(fall.blocked[1]).toBe(true);
    expect(box.min[1]).toBeCloseTo(1, 3);
    for (let i = 0; i < 20; i++) moveBox(g, box, [0.5, 0, 0.1]);
    expect(box.min[0] + box.size[0]).toBeLessThanOrEqual(6);
    expect(box.min[2]).toBeGreaterThan(2);
    expect(overlapsSolid(g, box)).toBe(false);
  });
});

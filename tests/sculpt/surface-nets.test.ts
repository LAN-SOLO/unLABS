import { describe, expect, it } from "vitest";
import { capsule, smin, sphere } from "@/lib/sculpt/sdf";
import { projectToSurface, surfaceNets } from "@/lib/sculpt/surface-nets";

function faceAgreement(m: ReturnType<typeof surfaceNets>): number {
  const { positions: p, normals: n, indices: ix } = m;
  let agree = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t]! * 3, ix[t + 1]! * 3, ix[t + 2]! * 3];
    const ux = p[b]! - p[a]!,
      uy = p[b + 1]! - p[a + 1]!,
      uz = p[b + 2]! - p[a + 2]!;
    const vx = p[c]! - p[a]!,
      vy = p[c + 1]! - p[a + 1]!,
      vz = p[c + 2]! - p[a + 2]!;
    const fx = uy * vz - uz * vy,
      fy = uz * vx - ux * vz,
      fz = ux * vy - uy * vx;
    if (fx * n[a]! + fy * n[a + 1]! + fz * n[a + 2]! > 0) agree++;
  }
  return agree / (ix.length / 3);
}

describe("surface nets", () => {
  it("meshes a sphere watertight, on the surface, with outward counter-clockwise faces", () => {
    const f = (x: number, y: number, z: number) => sphere(x, y, z, [0, 0, 0], 3);
    const m = surfaceNets(f, { min: [-4, -4, -4], max: [4, 4, 4], cell: 0.25 });
    projectToSurface(f, m);
    expect(m.indices.length).toBeGreaterThan(1000);
    for (let i = 0; i < m.positions.length; i += 3) {
      const r = Math.hypot(m.positions[i]!, m.positions[i + 1]!, m.positions[i + 2]!);
      expect(Math.abs(r - 3)).toBeLessThan(0.01);
    }
    expect(faceAgreement(m)).toBeGreaterThan(0.99);
    // Watertight: every edge is shared by exactly two triangles.
    const edges = new Map<string, number>();
    for (let t = 0; t < m.indices.length; t += 3)
      for (let k = 0; k < 3; k++) {
        const a = m.indices[t + k]!,
          b = m.indices[t + ((k + 1) % 3)]!;
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
  });

  it("sparse sampling gives the same mesh as dense sampling", () => {
    const f = (x: number, y: number, z: number) =>
      smin(sphere(x, y, z, [0, 0, 0], 2), capsule(x, y, z, [0, 0, 0], [5, 3, 0], 0.7), 0.8);
    const b = {
      min: [-4, -4, -4] as [number, number, number],
      max: [8, 6, 4] as [number, number, number],
      cell: 0.2,
    };
    const sparse = surfaceNets(f, b);
    const dense = surfaceNets(f, b, { margin: 1e9 });
    expect(sparse.indices.length).toBe(dense.indices.length);
    expect(sparse.positions.length).toBe(dense.positions.length);
  });
});

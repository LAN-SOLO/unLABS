import { describe, expect, it } from "vitest";
import {
  generateLaser,
  isRotatable,
  laserSolved,
  reflect,
  traceBeams,
  type LaserCell,
} from "@/components/world/puzzles/engine/laser";

describe("laser: reflection", () => {
  it("'/' turns east into north and '\\' east into south", () => {
    expect(reflect(1, 0)).toBe(0);
    expect(reflect(1, 1)).toBe(2);
    expect(reflect(0, 0)).toBe(1);
    expect(reflect(3, 1)).toBe(0);
  });

  it("traces a beam through filter and mirror and blocks foreign colours", () => {
    const n = 3;
    const cells: LaserCell[] = Array.from({ length: 9 }, () => ({ t: "empty" }) as LaserCell);
    cells[3] = { t: "filter", color: "rot" };
    cells[4] = { t: "mirror" };
    const orient = new Array<number>(9).fill(0);
    const tr = traceBeams(n, cells, orient, 1);
    // '/' at (1,1) sends the red beam north, out at (-1,1).
    expect(tr.exits).toEqual([{ r: -1, c: 1, color: "rot" }]);
    cells[1] = { t: "filter", color: "blau" };
    expect(traceBeams(n, cells, orient, 1).exits).toEqual([]);
  });

  it("splitter sends light both ways and loops terminate", () => {
    const cells: LaserCell[] = Array.from({ length: 9 }, () => ({ t: "empty" }) as LaserCell);
    cells[4] = { t: "splitter" };
    const tr = traceBeams(3, cells, new Array<number>(9).fill(1), 1);
    expect(tr.exits.map((e) => `${e.r},${e.c}`).sort()).toEqual(["1,3", "3,1"]);
    const ring: LaserCell[] = Array.from({ length: 9 }, () => ({ t: "mirror" }) as LaserCell);
    expect(() => traceBeams(3, ring, new Array<number>(9).fill(0), 0)).not.toThrow();
  });
});

describe("laser: generator", () => {
  const cases: [number, number, number, number][] = [
    [1, 6, 2, 3],
    [2, 5, 1, 2],
    [3, 8, 3, 4],
    [4, 5, 3, 4],
    [5, 6, 1, 3],
    [6, 7, 2, 4],
    [4711, 6, 3, 3],
    // Authored defs (pz_laser_containment, pz_laser_prisma).
    [2019, 6, 2, 3],
    [89, 7, 3, 4],
  ];
  for (const [seed, size, colors, receivers] of cases) {
    it(`seed ${seed} (${size}×${size}, ${colors} Farben, ${receivers} Empfänger)`, () => {
      const p = generateLaser(seed, size, colors, receivers);
      expect(p.size).toBe(size);
      expect(p.receivers).toHaveLength(receivers);
      expect(new Set(p.receivers.map((r) => r.color)).size).toBe(Math.min(colors, receivers));
      for (const r of p.receivers) {
        const outside = r.r < 0 || r.c < 0 || r.r >= size || r.c >= size;
        expect(outside).toBe(true);
      }
      expect(laserSolved(p, p.solution)).toBe(true);
      expect(laserSolved(p, p.start)).toBe(false);
      // Only rotatable pieces differ between start and solution.
      p.cells.forEach((cell, i) => {
        if (!isRotatable(cell)) expect(p.start[i]).toBe(p.solution[i]);
      });
      expect(generateLaser(seed, size, colors, receivers)).toEqual(p);
    });
  }

  it("clamps params", () => {
    const p = generateLaser(9, 20, 9, 9);
    expect(p.size).toBe(8);
    expect(p.receivers.length).toBeLessThanOrEqual(4);
  });
});

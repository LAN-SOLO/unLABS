import { describe, expect, it } from "vitest";
import {
  adjacent,
  emptyPaths,
  extendPath,
  generateWiring,
  isConnected,
  startPath,
  stepsToward,
  validatePaths,
  type WiringPuzzle,
} from "@/components/world/puzzles/engine/wiring";

describe("wiring: generator", () => {
  for (const [seed, size, pairs] of [
    [9, 6, 5],
    [1, 5, 3],
    [42, 7, 6],
    [2024, 8, 8],
    [77, 5, 5],
  ]) {
    it(`seed ${seed}, ${size}×${size}, ${pairs} Adern is solvable and deterministic`, () => {
      const p = generateWiring(seed, size, pairs);
      expect(p.size).toBe(size);
      expect(p.endpoints).toHaveLength(pairs);
      expect(validatePaths(p, p.solution)).toBe(true);
      expect(validatePaths(p, emptyPaths(p))).toBe(false);
      // Solution covers the whole board (Hamiltonian path cut into segments).
      expect(new Set(p.solution.flat()).size).toBe(size * size);
      for (const seg of p.solution) expect(seg.length).toBeGreaterThanOrEqual(3);
      expect(generateWiring(seed, size, pairs)).toEqual(p);
    });
  }

  it("clamps params", () => {
    const p = generateWiring(3, 99, 99);
    expect(p.size).toBe(8);
    expect(p.endpoints.length).toBe(8);
  });
});

describe("wiring: path editing", () => {
  // 3×3 hand-made board: red 0→2 along the top, green 6→8 along the bottom.
  const p: WiringPuzzle = {
    size: 3,
    endpoints: [
      { color: 0, a: 0, b: 2 },
      { color: 1, a: 6, b: 8 },
    ],
    solution: [
      [0, 1, 2],
      [6, 7, 8],
    ],
  };

  it("draws, retracts and completes a wire", () => {
    let paths = startPath(p, emptyPaths(p), 0, 0);
    expect(paths[0]).toEqual([0]);
    paths = extendPath(p, paths, 0, 1);
    paths = extendPath(p, paths, 0, 4);
    expect(paths[0]).toEqual([0, 1, 4]);
    paths = extendPath(p, paths, 0, 1);
    expect(paths[0]).toEqual([0, 1]);
    expect(extendPath(p, paths, 0, 8)).toBe(paths); // not adjacent
    paths = extendPath(p, paths, 0, 2);
    expect(isConnected(p, paths[0], 0)).toBe(true);
    expect(extendPath(p, paths, 0, 5)).toBe(paths); // finished wires don't grow
  });

  it("blocks foreign endpoints and cuts foreign wires", () => {
    let paths = startPath(p, emptyPaths(p), 1, 6);
    paths = extendPath(p, paths, 1, 7);
    paths = extendPath(p, paths, 1, 4);
    let red = startPath(p, paths, 0, 0);
    red = extendPath(p, red, 0, 3);
    expect(extendPath(p, red, 0, 6)).toBe(red); // green endpoint
    red = extendPath(p, red, 0, 4);
    expect(red[0]).toEqual([0, 3, 4]);
    expect(red[1]).toEqual([6, 7]);
  });

  it("validates a full solution and rejects overlaps", () => {
    expect(validatePaths(p, p.solution)).toBe(true);
    expect(
      validatePaths(p, [
        [0, 1, 2],
        [6, 7, 8, 5, 2],
      ]),
    ).toBe(false);
  });

  it("walks orthogonally toward a target", () => {
    const steps = stepsToward(4, 0, 10);
    expect(steps[steps.length - 1]).toBe(10);
    let prev = 0;
    for (const s of steps) {
      expect(adjacent(4, prev, s)).toBe(true);
      prev = s;
    }
  });
});

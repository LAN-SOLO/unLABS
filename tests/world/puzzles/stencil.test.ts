import { describe, expect, it } from "vitest";
import {
  STENCIL_H,
  STENCIL_MAX_STEPS,
  STENCIL_MIN_STEPS,
  STENCIL_W,
  chebyshev,
  distanceToPath,
  generateStencil,
  parseShape,
  stencilStart,
  stencilStep,
  type StencilShape,
} from "@/components/world/puzzles/engine/stencil";

const SHAPES: StencilShape[] = ["hex", "tri", "poly"];

describe("stencil generation", () => {
  for (const shape of SHAPES) {
    for (const seed of [1, 3, 42, 847, 2003, 99991]) {
      it(`${shape} seed ${seed}: 30–40 steps, 8-connected, unique, in grid`, () => {
        const { path } = generateStencil(seed, shape);
        const steps = path.length - 1;
        expect(steps).toBeGreaterThanOrEqual(STENCIL_MIN_STEPS);
        expect(steps).toBeLessThanOrEqual(STENCIL_MAX_STEPS);
        for (let i = 1; i < path.length; i++) expect(chebyshev(path[i - 1], path[i])).toBe(1);
        expect(new Set(path.map((c) => `${c[0]},${c[1]}`)).size).toBe(path.length);
        for (const [x, y] of path) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(STENCIL_W);
          expect(y).toBeLessThan(STENCIL_H);
        }
        expect(chebyshev(path[0], path[path.length - 1])).toBeGreaterThanOrEqual(2);
      });
    }
  }

  it("is deterministic", () => {
    expect(generateStencil(3, "hex")).toEqual(generateStencil(3, "hex"));
    expect(generateStencil(3, "poly")).not.toEqual(generateStencil(4, "poly"));
  });

  it("parses shapes with fallback", () => {
    expect(parseShape("tri")).toBe("tri");
    expect(parseShape("poly")).toBe("poly");
    expect(parseShape("kreis")).toBe("hex");
  });
});

describe("stencil stepping", () => {
  it("tracing the path exactly gives zero stress and finishes", () => {
    for (const shape of SHAPES) {
      const { path } = generateStencil(3, shape);
      let s = stencilStart(path);
      for (let i = 1; i < path.length; i++) {
        s = stencilStep(s, path[i][0] - s.pos[0], path[i][1] - s.pos[1], path, 15);
      }
      expect(s.stress).toBe(0);
      expect(s.done).toBe(true);
      expect(s.cracked).toBe(false);
    }
  });

  it("adds stress off-path, blocks far moves and cracks at the limit", () => {
    const { path } = generateStencil(3, "hex");
    let s = stencilStart(path);
    // Find a direction that leaves the path by exactly one cell.
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ];
    const off = dirs.find(([dx, dy]) => {
      const t: [number, number] = [path[0][0] + dx, path[0][1] + dy];
      return distanceToPath(t, path) === 1;
    });
    expect(off).toBeDefined();
    if (!off) return;
    s = stencilStep(s, off[0], off[1], path, 15);
    expect(s.stress).toBe(1);
    // Hammer a blocked direction until the shard cracks.
    let guard = 0;
    while (!s.cracked && guard < 40) {
      s = stencilStep(s, off[0], off[1], path, 15);
      guard++;
    }
    expect(s.cracked).toBe(true);
    expect(s.stress).toBeGreaterThanOrEqual(15);
    const frozen = stencilStep(s, 1, 0, path, 15);
    expect(frozen).toBe(s);
  });

  it("does not let progress skip far ahead", () => {
    const { path } = generateStencil(42, "poly");
    const s = stencilStart(path);
    const jumped = { ...s, pos: path[10] };
    const next = stencilStep(
      jumped,
      path[11][0] - path[10][0],
      path[11][1] - path[10][1],
      path,
      15,
    );
    expect(next.progress).toBe(0);
  });
});

/**
 * PZ_MICRO_SHARD_STENCIL — pure logic: seeded stencil outlines rasterised
 * into 8-connected cell paths, plus the cursor/stress step function.
 */
import { mulberry32 } from "@/components/world/puzzles/rng";

export const STENCIL_W = 20;
export const STENCIL_H = 14;
export const STENCIL_MIN_STEPS = 30;
export const STENCIL_MAX_STEPS = 40;

export type StencilShape = "hex" | "tri" | "poly";
export type Cell = readonly [number, number];

export interface StencilPuzzle {
  shape: StencilShape;
  /** Ordered path cells; path.length − 1 steps from start to end. */
  path: Cell[];
}

export interface StencilState {
  pos: Cell;
  /** Highest path index reached. */
  progress: number;
  stress: number;
  cracked: boolean;
  done: boolean;
  /** True when the last attempted move was blocked (too far off). */
  blocked: boolean;
}

export function parseShape(raw: string): StencilShape {
  return raw === "tri" || raw === "poly" ? raw : "hex";
}

export function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

export function distanceToPath(cell: Cell, path: readonly Cell[]): number {
  let best = Infinity;
  for (const p of path) {
    const d = chebyshev(cell, p);
    if (d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

export function pathIndexOf(cell: Cell, path: readonly Cell[]): number {
  return path.findIndex((p) => p[0] === cell[0] && p[1] === cell[1]);
}

function vertices(shape: StencilShape, scale: number, rng: () => number): [number, number][] {
  const cx = (STENCIL_W - 1) / 2;
  const cy = (STENCIL_H - 1) / 2;
  const rot = rng() * Math.PI * 2;
  let angles: number[];
  let radii: number[];
  if (shape === "tri") {
    angles = [0, 1, 2].map((i) => rot + (i * Math.PI * 2) / 3);
    radii = angles.map(() => 1);
  } else if (shape === "hex") {
    angles = [0, 1, 2, 3, 4, 5].map((i) => rot + (i * Math.PI) / 3);
    radii = angles.map(() => 1);
  } else {
    const n = 5 + Math.floor(rng() * 3);
    angles = Array.from(
      { length: n },
      (_, i) => rot + ((i + (rng() - 0.5) * 0.5) * Math.PI * 2) / n,
    );
    radii = angles.map(() => 0.7 + rng() * 0.45);
  }
  return angles.map((a, i) => [
    Math.round(cx + Math.cos(a) * radii[i] * scale * 1.35),
    Math.round(cy + Math.sin(a) * radii[i] * scale),
  ]);
}

/** Rasterise a closed polygon into a loop of unique, 8-connected cells. */
function rasterLoop(vs: readonly [number, number][]): Cell[] {
  const loop: Cell[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < vs.length; i++) {
    const [ax, ay] = vs[i];
    const [bx, by] = vs[(i + 1) % vs.length];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let s = 0; s < steps; s++) {
      const x = Math.round(ax + ((bx - ax) * s) / steps);
      const y = Math.round(ay + ((by - ay) * s) / steps);
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      const last = loop[loop.length - 1];
      if (last && chebyshev(last, [x, y]) !== 1) continue;
      seen.add(key);
      loop.push([x, y]);
    }
  }
  return loop;
}

function inGrid(c: Cell): boolean {
  return c[0] >= 0 && c[1] >= 0 && c[0] < STENCIL_W && c[1] < STENCIL_H;
}

export function generateStencil(seed: number, shape: StencilShape): StencilPuzzle {
  for (let attempt = 0; attempt < 60; attempt++) {
    const rng = mulberry32((seed >>> 0) + attempt * 7919);
    for (let scale = 3; scale <= 7; scale += 0.25) {
      const loop = rasterLoop(vertices(shape, scale, rng));
      if (!loop.every(inGrid)) break;
      // Leave a small gap so start and end are distinct and not adjacent.
      const usable = loop.length - 3;
      if (usable < STENCIL_MIN_STEPS + 1) continue;
      const len = Math.min(usable, STENCIL_MAX_STEPS + 1);
      const path = loop.slice(0, len);
      if (chebyshev(path[0], path[path.length - 1]) < 2) continue;
      return { shape, path };
    }
  }
  // Fallback: a simple rectangle outline (always valid).
  const path: Cell[] = [];
  for (let x = 4; x <= 15; x++) path.push([x, 3]);
  for (let y = 4; y <= 10; y++) path.push([15, y]);
  for (let x = 14; x >= 4; x--) path.push([x, 10]);
  for (let y = 9; y >= 6; y--) path.push([4, y]);
  return { shape, path: path.slice(0, STENCIL_MAX_STEPS + 1) };
}

export function stencilStart(path: readonly Cell[]): StencilState {
  return {
    pos: path[0],
    progress: 0,
    stress: 0,
    cracked: false,
    done: false,
    blocked: false,
  };
}

/** Moves the cursor by (dx, dy) ∈ {−1,0,1}² and applies stress rules. */
export function stencilStep(
  state: StencilState,
  dx: number,
  dy: number,
  path: readonly Cell[],
  maxStress: number,
): StencilState {
  if (state.cracked || state.done) return state;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  if (sx === 0 && sy === 0) return { ...state, blocked: false };
  const target: Cell = [state.pos[0] + sx, state.pos[1] + sy];
  if (!inGrid(target)) return { ...state, blocked: true };
  const d = distanceToPath(target, path);
  if (d >= 2) {
    const stress = state.stress + 1;
    return { ...state, stress, blocked: true, cracked: stress >= maxStress };
  }
  const stress = state.stress + (d === 1 ? 1 : 0);
  let progress = state.progress;
  const idx = pathIndexOf(target, path);
  if (idx > progress && idx <= progress + 3) progress = idx;
  return {
    pos: target,
    progress,
    stress,
    blocked: false,
    cracked: stress >= maxStress,
    done: progress === path.length - 1 && stress < maxStress,
  };
}

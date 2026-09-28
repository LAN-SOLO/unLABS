/**
 * Kabelbaum — Flow-style wire routing, pure logic.
 *
 * Generation: a serpentine Hamiltonian path over the grid is randomised with
 * deterministic backbite moves, then cut into `pairs` segments (each ≥ 3
 * cells). Segment ends become the coloured wire ends, the segments themselves
 * are a guaranteed solution. Full coverage is not required to solve.
 */
import { mulberry32, randInt, type Rng } from "@/components/world/puzzles/rng";
import { tr } from "@/lib/i18n";

export const WIRE_COLORS: readonly { hex: string; name: string }[] = [
  { hex: "#FF4040", name: tr("Red") },
  { hex: "#33FF33", name: tr("Green") },
  { hex: "#3AA0FF", name: tr("Blue") },
  { hex: "#FFE030", name: tr("Yellow") },
  { hex: "#FF40FF", name: tr("Magenta") },
  { hex: "#00FFFF", name: tr("Cyan") },
  { hex: "#FF9A1A", name: tr("Orange") },
  { hex: "#E8E8E8", name: tr("White") },
];

export interface WireEnd {
  color: number;
  a: number;
  b: number;
}

export interface WiringPuzzle {
  size: number;
  endpoints: WireEnd[];
  /** One solution path per colour (cell indices, from `a` to `b`). */
  solution: number[][];
}

/** Paths indexed by colour; an empty array means "no wire yet". */
export type WirePaths = number[][];

export function adjacent(size: number, a: number, b: number): boolean {
  const ar = Math.floor(a / size);
  const ac = a % size;
  const br = Math.floor(b / size);
  const bc = b % size;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

export function neighbors(size: number, cell: number): number[] {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

function serpentine(size: number): number[] {
  const p: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let k = 0; k < size; k++) p.push(r * size + (r % 2 === 0 ? k : size - 1 - k));
  }
  return p;
}

/** One backbite move on the tail end; keeps `p` a Hamiltonian path. */
function backbite(rng: Rng, size: number, p: number[]): number[] {
  const path = rng() < 0.5 ? p.slice().reverse() : p.slice();
  const L = path.length;
  const end = path[L - 1];
  const opts = neighbors(size, end).filter((v) => v !== path[L - 2]);
  if (opts.length === 0) return path;
  const v = opts[randInt(rng, opts.length)];
  const i = path.indexOf(v);
  return [...path.slice(0, i + 1), ...path.slice(i + 1).reverse()];
}

function cutLengths(rng: Rng, total: number, pairs: number): number[] {
  const lens = new Array<number>(pairs).fill(3);
  let rest = total - 3 * pairs;
  while (rest > 0) {
    const chunk = Math.min(rest, 1 + randInt(rng, 3));
    lens[randInt(rng, pairs)] += chunk;
    rest -= chunk;
  }
  return lens;
}

export function generateWiring(seed: number, size: number, pairs: number): WiringPuzzle {
  const n = Math.max(5, Math.min(8, Math.floor(size)));
  const k = Math.max(3, Math.min(8, Math.floor(pairs), Math.floor((n * n) / 3)));
  const rng = mulberry32(seed);
  let path = serpentine(n);
  let best: WiringPuzzle | null = null;
  for (let tries = 0; tries < 60; tries++) {
    for (let i = 0; i < n * n * 12; i++) path = backbite(rng, n, path);
    const lens = cutLengths(rng, n * n, k);
    const solution: number[][] = [];
    let at = 0;
    for (const len of lens) {
      solution.push(path.slice(at, at + len));
      at += len;
    }
    const endpoints = solution.map((seg, color) => ({
      color,
      a: seg[0],
      b: seg[seg.length - 1],
    }));
    const puzzle = { size: n, endpoints, solution };
    best = puzzle;
    // Reject trivial pairs whose ends touch — they'd be a one-click wire.
    if (endpoints.every((e) => !adjacent(n, e.a, e.b))) return puzzle;
  }
  if (!best) throw new Error("unreachable");
  return best;
}

/** Owner colour of each cell by current paths (-1 = free). */
export function cellOwners(size: number, paths: WirePaths): number[] {
  const out = new Array<number>(size * size).fill(-1);
  paths.forEach((p, color) => {
    for (const cell of p) out[cell] = color;
  });
  return out;
}

/** Colour whose endpoint lies on `cell`, or -1. */
export function endpointColor(puzzle: WiringPuzzle, cell: number): number {
  const e = puzzle.endpoints.find((x) => x.a === cell || x.b === cell);
  return e ? e.color : -1;
}

export function isConnected(puzzle: WiringPuzzle, path: readonly number[], color: number): boolean {
  const e = puzzle.endpoints[color];
  if (!e || path.length < 2) return false;
  const first = path[0];
  const last = path[path.length - 1];
  if (!((first === e.a && last === e.b) || (first === e.b && last === e.a))) return false;
  for (let i = 1; i < path.length; i++) {
    if (!adjacent(puzzle.size, path[i - 1], path[i])) return false;
  }
  return true;
}

/**
 * Begin (or resume) drawing `color` at `cell`. On an endpoint the wire
 * restarts from there; on the colour's own path it is truncated to `cell`.
 */
export function startPath(
  puzzle: WiringPuzzle,
  paths: WirePaths,
  color: number,
  cell: number,
): WirePaths {
  const next = paths.map((p) => p.slice());
  const own = next[color] ?? [];
  const e = puzzle.endpoints[color];
  if (!e) return paths;
  if (cell === e.a || cell === e.b) {
    next[color] = [cell];
    return next;
  }
  const idx = own.indexOf(cell);
  if (idx >= 0) next[color] = own.slice(0, idx + 1);
  return next;
}

/** Extend the wire of `color` into `cell`. Returns `paths` unchanged when not allowed. */
export function extendPath(
  puzzle: WiringPuzzle,
  paths: WirePaths,
  color: number,
  cell: number,
): WirePaths {
  const own = paths[color] ?? [];
  if (own.length === 0) return paths;
  const last = own[own.length - 1];
  if (cell === last || !adjacent(puzzle.size, last, cell)) return paths;
  // Step back = retract.
  if (own.length >= 2 && own[own.length - 2] === cell) {
    const next = paths.map((p) => p.slice());
    next[color] = own.slice(0, -1);
    return next;
  }
  const ownIdx = own.indexOf(cell);
  if (ownIdx >= 0) {
    const next = paths.map((p) => p.slice());
    next[color] = own.slice(0, ownIdx + 1);
    return next;
  }
  if (isConnected(puzzle, own, color)) return paths;
  const epColor = endpointColor(puzzle, cell);
  if (epColor >= 0 && epColor !== color) return paths;
  const next = paths.map((p) => p.slice());
  // Cut a foreign wire running through this cell.
  next.forEach((p, other) => {
    if (other === color) return;
    const i = p.indexOf(cell);
    if (i >= 0) next[other] = p.slice(0, i);
  });
  next[color] = [...own, cell];
  return next;
}

/** All wires connected, adjacent steps, no cell used twice. */
export function validatePaths(puzzle: WiringPuzzle, paths: WirePaths): boolean {
  const used = new Set<number>();
  for (const e of puzzle.endpoints) {
    const p = paths[e.color] ?? [];
    if (!isConnected(puzzle, p, e.color)) return false;
    for (const cell of p) {
      if (used.has(cell)) return false;
      used.add(cell);
    }
  }
  return true;
}

export function emptyPaths(puzzle: WiringPuzzle): WirePaths {
  return puzzle.endpoints.map(() => []);
}

/** Cells walked from `from` toward `to`, one orthogonal step at a time (excludes `from`). */
export function stepsToward(size: number, from: number, to: number, max = 32): number[] {
  const out: number[] = [];
  let r = Math.floor(from / size);
  let c = from % size;
  const tr = Math.floor(to / size);
  const tc = to % size;
  while ((r !== tr || c !== tc) && out.length < max) {
    if (Math.abs(tr - r) >= Math.abs(tc - c)) r += Math.sign(tr - r);
    else c += Math.sign(tc - c);
    out.push(r * size + c);
  }
  return out;
}

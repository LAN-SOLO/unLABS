/**
 * Präzisionslaser — pure beam-routing logic.
 *
 * An n×n grid holds mirrors, splitters, colour filters and blocks. One white
 * emitter sits outside the left border; receivers sit outside the border and
 * each needs a beam of its colour. Mirrors and splitters rotate (toggle
 * between `/` and `\`). Generation is deterministic from the seed: pieces
 * are placed with a solution orientation, beams are traced, receivers are put
 * where the traced beams leave the grid, then orientations are scrambled.
 */
import { mulberry32, randInt, type Rng } from "@/components/world/puzzles/rng";
import { tr } from "@/lib/i18n";

export type BeamColor = "weiss" | "rot" | "gruen" | "blau";
export const FILTER_COLORS: readonly BeamColor[] = ["rot", "gruen", "blau"];

export const BEAM_HEX: Record<BeamColor, string> = {
  weiss: "#E8FFE8",
  rot: "#FF4040",
  gruen: "#33FF33",
  blau: "#3AA0FF",
};

export const BEAM_LABEL: Record<BeamColor, string> = {
  weiss: tr("White"),
  rot: tr("Red"),
  gruen: tr("Green"),
  blau: tr("Blue"),
};

export type LaserCell =
  | { t: "empty" }
  | { t: "block" }
  | { t: "mirror" }
  | { t: "splitter" }
  | { t: "filter"; color: BeamColor };

/** Directions: 0 = N, 1 = E, 2 = S, 3 = W. */
const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];
/** `/` (orientation 0) and `\` (orientation 1) reflection tables. */
const REFLECT: readonly (readonly number[])[] = [
  [1, 0, 3, 2],
  [3, 2, 1, 0],
];

export function reflect(dir: number, orient: number): number {
  return REFLECT[orient & 1][dir & 3];
}

export interface Receiver {
  /** Position outside the grid (row or col is -1 or n). */
  r: number;
  c: number;
  color: BeamColor;
}

export interface LaserPuzzle {
  size: number;
  cells: LaserCell[];
  /** Emitter row (sits at col -1, shooting east). */
  emitterRow: number;
  receivers: Receiver[];
  /** Orientation per cell (0 = `/`, 1 = `\`) that satisfies all receivers. */
  solution: number[];
  /** Scrambled starting orientations. */
  start: number[];
}

export interface BeamSegment {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  color: BeamColor;
}

export interface BeamHit {
  r: number;
  c: number;
  color: BeamColor;
}

export interface TraceResult {
  segments: BeamSegment[];
  /** Beams that left the grid (positions outside the grid). */
  exits: BeamHit[];
  /** Rotatable cells a beam passed through. */
  touched: Set<number>;
}

export function isRotatable(cell: LaserCell): boolean {
  return cell.t === "mirror" || cell.t === "splitter";
}

export function traceBeams(
  size: number,
  cells: readonly LaserCell[],
  orient: readonly number[],
  emitterRow: number,
): TraceResult {
  const segments: BeamSegment[] = [];
  const segKeys = new Set<string>();
  const exits: BeamHit[] = [];
  const exitKeys = new Set<string>();
  const touched = new Set<number>();
  const visited = new Set<string>();
  interface Beam {
    r: number;
    c: number;
    pr: number;
    pc: number;
    dir: number;
    color: BeamColor;
  }
  const queue: Beam[] = [{ r: emitterRow, c: 0, pr: emitterRow, pc: -1, dir: 1, color: "weiss" }];
  const addSeg = (b: Beam) => {
    const key = `${b.pr},${b.pc},${b.r},${b.c},${b.color}`;
    if (segKeys.has(key)) return;
    segKeys.add(key);
    segments.push({ r1: b.pr, c1: b.pc, r2: b.r, c2: b.c, color: b.color });
  };
  let guard = 0;
  while (queue.length > 0 && guard < 10000) {
    guard++;
    const b = queue.shift();
    if (!b) break;
    const key = `${b.r},${b.c},${b.dir},${b.color}`;
    if (visited.has(key)) continue;
    visited.add(key);
    addSeg(b);
    if (b.r < 0 || b.c < 0 || b.r >= size || b.c >= size) {
      const ek = `${b.r},${b.c},${b.color}`;
      if (!exitKeys.has(ek)) {
        exitKeys.add(ek);
        exits.push({ r: b.r, c: b.c, color: b.color });
      }
      continue;
    }
    const idx = b.r * size + b.c;
    const cell = cells[idx];
    let color = b.color;
    let dirs: number[] = [b.dir];
    switch (cell.t) {
      case "block":
        dirs = [];
        break;
      case "filter":
        if (color === "weiss") color = cell.color;
        else if (color !== cell.color) dirs = [];
        break;
      case "mirror":
        touched.add(idx);
        dirs = [reflect(b.dir, orient[idx] ?? 0)];
        break;
      case "splitter":
        touched.add(idx);
        dirs = [b.dir, reflect(b.dir, orient[idx] ?? 0)];
        break;
      case "empty":
        break;
    }
    for (const d of dirs) {
      queue.push({ r: b.r + DR[d], c: b.c + DC[d], pr: b.r, pc: b.c, dir: d, color });
    }
  }
  return { segments, exits, touched };
}

export function receiverLit(rec: Receiver, exits: readonly BeamHit[]): boolean {
  return exits.some((e) => e.r === rec.r && e.c === rec.c && e.color === rec.color);
}

export function laserSolved(puzzle: LaserPuzzle, orient: readonly number[]): boolean {
  const { exits } = traceBeams(puzzle.size, puzzle.cells, orient, puzzle.emitterRow);
  return puzzle.receivers.every((rec) => receiverLit(rec, exits));
}

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Coloured beam exits, one per border position (emitter slot excluded). */
function colouredExits(trace: TraceResult, emitterRow: number): BeamHit[] {
  const byPos = new Map<string, BeamHit>();
  for (const e of trace.exits) {
    if (e.color === "weiss" || (e.c === -1 && e.r === emitterRow)) continue;
    const key = `${e.r},${e.c}`;
    if (!byPos.has(key)) byPos.set(key, e);
  }
  return [...byPos.values()];
}

function attempt(rng: Rng, n: number, colors: number, receivers: number): LaserPuzzle | null {
  const cells: LaserCell[] = Array.from({ length: n * n }, () => ({ t: "empty" }) as LaserCell);
  const emitterRow = randInt(rng, n);
  const free = shuffle(
    rng,
    Array.from({ length: n * n }, (_, i) => i).filter((i) => i !== emitterRow * n),
  );
  let k = 0;
  const take = (): number => free[k++] ?? -1;
  const mirrorCount = Math.round(n * n * 0.22);
  const splitCount = Math.max(1, receivers - 1);
  const palette = shuffle(rng, FILTER_COLORS.slice()).slice(0, colors);
  for (let i = 0; i < mirrorCount; i++) cells[take()] = { t: "mirror" };
  for (let i = 0; i < splitCount; i++) cells[take()] = { t: "splitter" };
  for (const color of palette) cells[take()] = { t: "filter", color };
  const blocks = randInt(rng, 3);
  for (let i = 0; i < blocks; i++) cells[take()] = { t: "block" };

  const solution = cells.map(() => randInt(rng, 2));
  const need = Math.min(colors, receivers);
  const score = (): number => {
    const beams = traceBeams(n, cells, solution, emitterRow);
    const pos = colouredExits(beams, emitterRow);
    const distinct = new Set(pos.map((e) => e.color)).size;
    return (
      Math.min(pos.length, receivers) * 10 +
      Math.min(distinct, need) * 10 +
      Math.min(beams.touched.size, 3)
    );
  };
  const goal = receivers * 10 + need * 10 + 3;
  // Deterministic hill climb: move pieces / flip orientations until enough
  // coloured beams leave the grid at distinct border positions.
  let current = score();
  for (let it = 0; it < 600 && current < goal; it++) {
    const a = randInt(rng, n * n);
    const b = randInt(rng, n * n);
    const flip = rng() < 0.35;
    if (!flip && (a === emitterRow * n || b === emitterRow * n)) continue;
    if (flip) solution[a] ^= 1;
    else [cells[a], cells[b]] = [cells[b], cells[a]];
    const next = score();
    if (next >= current) current = next;
    else if (flip) solution[a] ^= 1;
    else [cells[a], cells[b]] = [cells[b], cells[a]];
  }
  if (current < goal) return null;
  cells.forEach((cell, i) => {
    if (!isRotatable(cell)) solution[i] = 0;
  });
  const trace = traceBeams(n, cells, solution, emitterRow);
  const unique = colouredExits(trace, emitterRow);
  const coloured = shuffle(rng, unique);
  if (coloured.length < receivers) return null;
  // Prefer distinct colours first.
  const chosen: BeamHit[] = [];
  const seen = new Set<BeamColor>();
  for (const e of coloured) {
    if (chosen.length >= receivers) break;
    if (!seen.has(e.color)) {
      chosen.push(e);
      seen.add(e.color);
    }
  }
  for (const e of coloured) {
    if (chosen.length >= receivers) break;
    if (!chosen.includes(e)) chosen.push(e);
  }
  if (seen.size < Math.min(colors, receivers)) return null;
  const recs: Receiver[] = chosen.map((e) => ({ r: e.r, c: e.c, color: e.color }));

  // Scramble: flip a random subset of rotatable cells, at least the touched ones mostly.
  const start = solution.slice();
  cells.forEach((cell, i) => {
    if (!isRotatable(cell)) return;
    if (trace.touched.has(i) ? rng() < 0.75 : rng() < 0.5) start[i] ^= 1;
  });
  const puzzle: LaserPuzzle = {
    size: n,
    cells,
    emitterRow,
    receivers: recs,
    solution,
    start,
  };
  if (!laserSolved(puzzle, solution)) return null;
  const touchedList = [...trace.touched];
  let j = 0;
  while (laserSolved(puzzle, start) && j < touchedList.length) {
    start[touchedList[j]] ^= 1;
    j++;
  }
  if (laserSolved(puzzle, start)) return null;
  return puzzle;
}

export function generateLaser(
  seed: number,
  size: number,
  colors: number,
  receivers: number,
): LaserPuzzle {
  const n = Math.max(5, Math.min(8, Math.floor(size)));
  const cols = Math.max(1, Math.min(3, Math.floor(colors)));
  const recs = Math.max(2, Math.min(4, Math.floor(receivers)));
  const rng = mulberry32(seed);
  for (let i = 0; i < 200; i++) {
    const p = attempt(rng, n, cols, recs);
    if (p) return p;
  }
  // Extremely unlikely fallback: relax to fewer receivers.
  for (let i = 0; i < 200; i++) {
    const p = attempt(rng, n, 1, 2);
    if (p) return p;
  }
  throw new Error(`Laser generation failed for seed ${seed}`);
}

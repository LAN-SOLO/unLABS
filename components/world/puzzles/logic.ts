/**
 * Pure puzzle logic — no DOM, no React — so it can be unit-tested.
 */
import { mulberry32, randInt } from "@/components/world/puzzles/rng";
import { tr } from "@/lib/i18n";
import type { PuzzleDef } from "@/lib/world/types";

// ---------------------------------------------------------------------------
// Param narrowing
// ---------------------------------------------------------------------------

type Params = PuzzleDef["params"];

export function num(params: Params, key: string, fallback: number): number {
  const v = params[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function str(params: Params, key: string, fallback: string): string {
  const v = params[key];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return fallback;
}

export function nums(params: Params, key: string, fallback: number[]): number[] {
  const v = params[key];
  if (Array.isArray(v)) {
    const out: number[] = [];
    for (const x of v) {
      if (typeof x === "number" && Number.isFinite(x)) out.push(x);
      else return fallback;
    }
    return out;
  }
  return fallback;
}

export function strs(params: Params, key: string, fallback: string[]): string[] {
  const v = params[key];
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const x of v) {
      if (typeof x === "string") out.push(x);
      else return fallback;
    }
    return out;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Pipes
// ---------------------------------------------------------------------------

/** Opening bits. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

export type PipeKind = "straight" | "corner" | "tee";

const BASE_MASK: Record<PipeKind, number> = {
  straight: N | S,
  corner: N | E,
  tee: N | E | S,
};

/** Rotate an opening mask clockwise by `quarterTurns`. */
export function rotateMask(mask: number, quarterTurns: number): number {
  let m = mask & 15;
  const r = ((quarterTurns % 4) + 4) % 4;
  for (let i = 0; i < r; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

export function pipeMask(kind: PipeKind, rot: number): number {
  return rotateMask(BASE_MASK[kind], rot);
}

export interface PipePuzzle {
  size: number;
  sourceRow: number;
  sinkRow: number;
  kinds: PipeKind[];
  /** Rotations that form the guaranteed path. */
  solution: number[];
  /** Scrambled starting rotations. */
  start: number[];
  /** Cells of the guaranteed path, source to sink. */
  path: number[];
}

function opposite(dir: number): number {
  return rotateMask(dir, 2);
}

function step(dir: number): [number, number] {
  if (dir === N) return [-1, 0];
  if (dir === S) return [1, 0];
  if (dir === E) return [0, 1];
  return [0, -1];
}

export interface FlowResult {
  lit: Set<number>;
  solved: boolean;
  /** BFS depth of every lit cell (source = 0), for flow animations. */
  dist: Map<number, number>;
  /** Opening bit through which the flow entered each lit cell. */
  entry: Map<number, number>;
}

/** BFS from the source (left edge, `sourceRow`) through mutually open tiles. */
export function pipeFlow(
  size: number,
  kinds: readonly PipeKind[],
  rots: readonly number[],
  sourceRow: number,
  sinkRow: number,
): FlowResult {
  const lit = new Set<number>();
  const dist = new Map<number, number>();
  const entry = new Map<number, number>();
  const start = sourceRow * size;
  const masks = kinds.map((k, i) => pipeMask(k, rots[i] ?? 0));
  if ((masks[start] & W) === 0) return { lit, solved: false, dist, entry };
  const queue = [start];
  lit.add(start);
  dist.set(start, 0);
  entry.set(start, W);
  while (queue.length > 0) {
    const idx = queue.shift();
    if (idx === undefined) break;
    const r = Math.floor(idx / size);
    const c = idx % size;
    for (const dir of [N, E, S, W]) {
      if ((masks[idx] & dir) === 0) continue;
      const [dr, dc] = step(dir);
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const nIdx = nr * size + nc;
      if ((masks[nIdx] & opposite(dir)) === 0 || lit.has(nIdx)) continue;
      lit.add(nIdx);
      dist.set(nIdx, (dist.get(idx) ?? 0) + 1);
      entry.set(nIdx, opposite(dir));
      queue.push(nIdx);
    }
  }
  const sink = sinkRow * size + (size - 1);
  return { lit, solved: lit.has(sink) && (masks[sink] & E) !== 0, dist, entry };
}

function kindAndRotFor(mask: number): { kind: PipeKind; rot: number } {
  const kind: PipeKind = mask === (N | S) || mask === (E | W) ? "straight" : "corner";
  for (let r = 0; r < 4; r++) if (pipeMask(kind, r) === mask) return { kind, rot: r };
  return { kind, rot: 0 };
}

export function generatePipes(size: number, seed: number): PipePuzzle {
  const n = Math.max(3, Math.floor(size));
  const rng = mulberry32(seed);
  const sourceRow = Math.floor(n / 2);
  const kinds: PipeKind[] = new Array<PipeKind>(n * n).fill("straight");
  const solution: number[] = new Array<number>(n * n).fill(0);
  const onPath = new Array<boolean>(n * n).fill(false);
  const path: number[] = [];

  // Monotone (never goes west) random walk: guaranteed self-avoiding.
  let row = sourceRow;
  for (let c = 0; c < n; c++) {
    const target = rng() < 0.45 ? row : randInt(rng, n);
    const dir = target > row ? S : N;
    let r = row;
    let entry = W;
    for (;;) {
      const last = r === target;
      const exit = last ? E : dir;
      const mask = entry | exit;
      const { kind, rot } = kindAndRotFor(mask);
      kinds[r * n + c] = kind;
      solution[r * n + c] = rot;
      onPath[r * n + c] = true;
      path.push(r * n + c);
      if (last) break;
      r += dir === S ? 1 : -1;
      entry = opposite(dir);
    }
    row = target;
  }
  const sinkRow = row;

  // Fill the rest with random tiles.
  const pool: PipeKind[] = ["straight", "corner", "corner", "tee"];
  for (let i = 0; i < n * n; i++) {
    if (onPath[i]) continue;
    kinds[i] = pool[randInt(rng, pool.length)];
    solution[i] = randInt(rng, 4);
  }

  // Scramble deterministically.
  const start = solution.map((rot) => (rot + 1 + randInt(rng, 3)) % 4);
  let k = 0;
  while (pipeFlow(n, kinds, start, sourceRow, sinkRow).solved && k < n * n * 4) {
    start[k % (n * n)] = (start[k % (n * n)] + 1) % 4;
    k++;
  }
  return { size: n, sourceRow, sinkRow, kinds, solution, start, path };
}

// ---------------------------------------------------------------------------
// Vigenère
// ---------------------------------------------------------------------------

function keyShifts(key: string): number[] {
  return key
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map((ch) => ch.charCodeAt(0) - 65);
}

function vigenere(text: string, key: string, sign: 1 | -1): string {
  const shifts = keyShifts(key);
  if (shifts.length === 0) return text.toUpperCase();
  let k = 0;
  let out = "";
  for (const ch of text.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      const s = shifts[k % shifts.length] * sign;
      out += String.fromCharCode(((((code - 65 + s) % 26) + 26) % 26) + 65);
      k++;
    } else {
      out += ch;
    }
  }
  return out;
}

export function vigenereEncrypt(plain: string, key: string): string {
  return vigenere(plain, key, 1);
}

export function vigenereDecrypt(cipher: string, key: string): string {
  return vigenere(cipher, key, -1);
}

// ---------------------------------------------------------------------------
// CRC / parity
// ---------------------------------------------------------------------------

export interface CrcPuzzle {
  rows: number;
  cols: number;
  original: number[];
  corrupted: number[];
  flipped: number;
  rowParity: number[];
  colParity: number[];
}

export function rowParities(bits: readonly number[], rows: number, cols: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < rows; r++) {
    let p = 0;
    for (let c = 0; c < cols; c++) p ^= bits[r * cols + c] & 1;
    out.push(p);
  }
  return out;
}

export function colParities(bits: readonly number[], rows: number, cols: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < cols; c++) {
    let p = 0;
    for (let r = 0; r < rows; r++) p ^= bits[r * cols + c] & 1;
    out.push(p);
  }
  return out;
}

export function generateCrc(rows: number, cols: number, seed: number): CrcPuzzle {
  const rr = Math.max(2, Math.floor(rows));
  const cc = Math.max(2, Math.floor(cols));
  const rng = mulberry32(seed);
  const original = Array.from({ length: rr * cc }, () => (rng() < 0.5 ? 0 : 1));
  const flipped = randInt(rng, rr * cc);
  const corrupted = original.slice();
  corrupted[flipped] ^= 1;
  return {
    rows: rr,
    cols: cc,
    original,
    corrupted,
    flipped,
    rowParity: rowParities(original, rr, cc),
    colParity: colParities(original, rr, cc),
  };
}

export function bitsEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ---------------------------------------------------------------------------
// Lights-Out (sigils)
// ---------------------------------------------------------------------------

export function lightsToggle(board: readonly boolean[], size: number, idx: number): boolean[] {
  const next = board.slice();
  const r = Math.floor(idx / size);
  const c = idx % size;
  const cells: [number, number][] = [
    [r, c],
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
  for (const [y, x] of cells) {
    if (y < 0 || x < 0 || y >= size || x >= size) continue;
    next[y * size + x] = !next[y * size + x];
  }
  return next;
}

export interface LightsPuzzle {
  size: number;
  start: boolean[];
  presses: number[];
}

export function generateLights(size: number, seed: number, pressCount = 8): LightsPuzzle {
  const n = Math.max(2, Math.floor(size));
  const rng = mulberry32(seed);
  const presses: number[] = [];
  const count = Math.min(pressCount, n * n);
  while (presses.length < count) {
    const idx = randInt(rng, n * n);
    if (!presses.includes(idx)) presses.push(idx);
  }
  let board = new Array<boolean>(n * n).fill(false);
  for (const p of presses) board = lightsToggle(board, n, p);
  if (board.every((v) => !v)) {
    const extra = presses.length > 0 ? (presses[0] + 1) % (n * n) : 0;
    presses.push(extra);
    board = lightsToggle(board, n, extra);
  }
  return { size: n, start: board, presses };
}

// ---------------------------------------------------------------------------
// Lissajous
// ---------------------------------------------------------------------------

export const LISSAJOUS_RATIOS = ["1:1", "1:2", "2:3", "3:4", "1:3"] as const;

export function parseRatio(ratio: string): [number, number] {
  const m = /^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(ratio);
  if (!m) return [1, 1];
  return [Math.max(1, Number(m[1])), Math.max(1, Number(m[2]))];
}

export function normPhase(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

export function lissajousMatches(
  ratio: string,
  phase: number,
  targetRatio: string,
  targetPhase: number,
): boolean {
  const [a, b] = parseRatio(ratio);
  const [ta, tb] = parseRatio(targetRatio);
  if (a !== ta || b !== tb) return false;
  if (normPhase(phase) === normPhase(targetPhase)) return true;
  // Different phases can trace the very same figure (3:4 looks identical at
  // 0°, 45°, 90° …) — the player matches what they see, so compare shapes.
  return lissajousDistance(a, b, phase, targetPhase) < LISSAJOUS_SAME_SHAPE;
}

/**
 * Start phase for the dial: the first 15° step whose figure (at the target
 * ratio) differs from the target, so picking the right ratio never solves
 * on its own.
 */
export function lissajousStartPhase(targetRatio: string, targetPhase: number): number {
  for (let p = 15; p < 360; p += 15) {
    if (!lissajousMatches(targetRatio, p, targetRatio, targetPhase)) return p;
  }
  return 0;
}

/** Hausdorff distances below this mean "the same figure on screen". */
const LISSAJOUS_SAME_SHAPE = 0.06;
const LISSAJOUS_SAMPLES = 240;

/** Symmetric Hausdorff distance between two figures of the same ratio. */
export function lissajousDistance(a: number, b: number, phaseA: number, phaseB: number): number {
  const sample = (phase: number): [number, number][] =>
    Array.from({ length: LISSAJOUS_SAMPLES }, (_, i) =>
      lissajousPoint(a, b, phase, (i / LISSAJOUS_SAMPLES) * Math.PI * 2),
    );
  const pa = sample(phaseA);
  const pb = sample(phaseB);
  const directed = (p: [number, number][], q: [number, number][]) => {
    let worst = 0;
    for (const [px, py] of p) {
      let best = Infinity;
      for (const [qx, qy] of q) {
        const d = (px - qx) ** 2 + (py - qy) ** 2;
        if (d < best) best = d;
      }
      if (best > worst) worst = best;
    }
    return Math.sqrt(worst);
  };
  return Math.max(directed(pa, pb), directed(pb, pa));
}

/** Point on the figure x = sin(a·t + φ), y = sin(b·t), both in [-1, 1]. */
export function lissajousPoint(
  a: number,
  b: number,
  phaseDeg: number,
  t: number,
): [number, number] {
  return [Math.sin(a * t + (phaseDeg * Math.PI) / 180), Math.sin(b * t)];
}

// ---------------------------------------------------------------------------
// Coolant
// ---------------------------------------------------------------------------

export const COOLANTS = [
  { id: "glykol", label: tr("Glycol"), temp: -5, viscosity: 3.0 },
  { id: "stickstoff", label: tr("Nitrogen"), temp: -40, viscosity: 0.3 },
  { id: "wasser", label: tr("Water"), temp: 8, viscosity: 1.0 },
] as const;

export const VISCOSITY_BAND: readonly [number, number] = [1.4, 2.2];

export interface CoolantMix {
  total: number;
  temp: number;
  viscosity: number;
}

export function coolantMix(parts: readonly number[]): CoolantMix {
  let total = 0;
  let t = 0;
  let v = 0;
  COOLANTS.forEach((c, i) => {
    const p = Math.max(0, parts[i] ?? 0);
    total += p;
    t += p * c.temp;
    v += p * c.viscosity;
  });
  if (total <= 0) return { total: 0, temp: 0, viscosity: 0 };
  return { total, temp: t / total, viscosity: v / total };
}

export function coolantOk(mix: CoolantMix, target: number): boolean {
  return (
    mix.total > 0 &&
    Math.abs(mix.temp - target) <= 1 &&
    mix.viscosity >= VISCOSITY_BAND[0] &&
    mix.viscosity <= VISCOSITY_BAND[1]
  );
}

// ---------------------------------------------------------------------------
// Heat / pressure
// ---------------------------------------------------------------------------

export const HEAT_ZONE: readonly [number, number] = [55, 70];
export const PRESSURE_ZONE: readonly [number, number] = [45, 65];

export interface HeatState {
  heat: number;
  pressure: number;
}

/** Anomaly disturbance on the heat target, in heat units. */
export function heatDisturbance(t: number): number {
  return 7 * Math.sin(0.55 * t) + 4 * Math.sin(1.7 * t + 1.3);
}

export function pressureTarget(heat: number): number {
  const h = Math.max(0, Math.min(100, heat)) / 100;
  return 100 * Math.pow(h, 1.4);
}

export function heatStep(state: HeatState, lever: number, t: number, dt: number): HeatState {
  const heatGoal = Math.max(0, Math.min(100, lever + heatDisturbance(t)));
  const heat = state.heat + (heatGoal - state.heat) * (1 - Math.exp(-dt / 0.6));
  const pressure =
    state.pressure + (pressureTarget(heat) - state.pressure) * (1 - Math.exp(-dt / 1.0));
  return { heat, pressure };
}

export function inZone(v: number, zone: readonly [number, number]): boolean {
  return v >= zone[0] && v <= zone[1];
}

// ---------------------------------------------------------------------------
// Valve
// ---------------------------------------------------------------------------

/** Self-driven oscillation of the flow (sum of sines + slow drift). */
export function valveDisturbance(t: number): number {
  return 14 * Math.sin(0.8 * t) + 7 * Math.sin(2.1 * t + 0.7) + 6 * Math.sin(0.23 * t + 2);
}

export function valveStep(value: number, control: number, t: number, dt: number): number {
  const goal = 50 + valveDisturbance(t) + control;
  const next = value + (goal - value) * (1 - Math.exp(-dt / 0.35));
  return Math.max(0, Math.min(100, next));
}

/**
 * Click-to-move pathfinding on a floor (pure, no three).
 * ======================================================
 *
 * Two layers:
 *
 *  - **Voxel columns** (`sx × sz`): a column is blocked when it has no floor
 *    under it or anything solid from y = 1 up to the walker's head — the same
 *    rule the walker collides with (terrain + footprints + elevator deck).
 *    Locked door cells are a separate *dynamic* layer (`setDynamicBlocked`):
 *    they change without a collision rebuild. Unlocked doors are free — their
 *    leaves open automatically when Lawrence walks up to them.
 *  - **Nodes** (`res` per voxel): candidate walker centres. A node is free
 *    when the walker's square box (± `half`) around it overlaps only free
 *    columns — i.e. the obstacles are inflated by the collision radius.
 *
 * A* runs 8-neighbour (octile, no corner cutting) over the nodes, capped at
 * `maxExpansions`; the result is string-pulled with an exact swept-box
 * line-of-sight test so she walks straight lines between corners.
 * If the goal cannot be reached, the path ends at the explored node closest
 * to it and `reached` is false.
 *
 * Cells: the blocked layer may be finer than a voxel (`scale` cells per
 * world unit, e.g. 2 → half-voxel collision cells). Every function takes
 * and returns WORLD coordinates; `sx`/`sz`, `vox`, `dyn` and the `blocked`
 * callbacks are in cell units.
 */

export type XZ = [number, number];

export interface NavGrid {
  /** Cell dimensions (cells, see `scale`). */
  readonly sx: number;
  readonly sz: number;
  /** Cells per world unit (1 = voxel columns, 2 = half-voxel cells). */
  readonly scale: number;
  /** Nodes per cell along each axis. */
  readonly res: number;
  readonly nx: number;
  readonly nz: number;
  /** Walker half-width (world units). */
  readonly half: number;
  /** 1 = voxel column blocked (static: terrain, footprints). */
  readonly vox: Uint8Array;
  /** 1 = voxel column blocked dynamically (locked doors). */
  readonly dyn: Uint8Array;
  /** 1 = walker centre fits, static + dynamic layers. */
  readonly node: Uint8Array;
  /** 1 = walker centre fits, static layer only (dynamic blocks ignored). */
  readonly nodeStatic: Uint8Array;
  /** Voxel keys currently in the dynamic layer. */
  dynCells: Set<number>;
  /** Search scratch (reused between searches). */
  scratch: Scratch | null;
}

interface Scratch {
  g: Float32Array;
  parent: Int32Array;
  stamp: Uint32Array;
  closed: Uint32Array;
  gen: number;
  heapIdx: Int32Array;
  heapF: Float64Array;
}

export interface NavOptions {
  /** Nodes per cell (default 2 → half-voxel resolution on voxel cells). */
  res?: number;
  /** Walker half-width in world units (default 1.1 = WALKER.width / 2). */
  half?: number;
  /** Cells per world unit (default 1). */
  scale?: number;
}

/** Head clearance above the slab the walker needs (walker height 5.1 → y 1..6). */
export const NAV_HEADROOM = 6;

/**
 * Column test from a voxel source: blocked when there is no floor at y = 0
 * or anything solid from y = 1 to `headroom` (the walkability test's rule).
 */
export function columnBlocked(
  solid: (x: number, y: number, z: number) => number | boolean,
  headroom = NAV_HEADROOM,
): (x: number, z: number) => boolean {
  return (x, z) => {
    if (!solid(x, 0, z)) return true;
    for (let y = 1; y <= headroom; y++) if (solid(x, y, z)) return true;
    return false;
  };
}

export function createNavGrid(
  sx: number,
  sz: number,
  blocked: (x: number, z: number) => boolean,
  opts: NavOptions = {},
): NavGrid {
  const res = Math.max(1, Math.round(opts.res ?? 2));
  const nx = sx * res;
  const nz = sz * res;
  const g: NavGrid = {
    sx,
    sz,
    scale: opts.scale ?? 1,
    res,
    nx,
    nz,
    half: opts.half ?? 1.1,
    vox: new Uint8Array(sx * sz),
    dyn: new Uint8Array(sx * sz),
    node: new Uint8Array(nx * nz),
    nodeStatic: new Uint8Array(nx * nz),
    dynCells: new Set(),
    scratch: null,
  };
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) g.vox[x + z * sx] = blocked(x, z) ? 1 : 0;
  refreshNodes(g, 0, 0, sx - 1, sz - 1);
  return g;
}

/**
 * Re-read the static layer (e.g. after devices / props changed) and patch
 * only the nodes whose footprint touches a changed column. Returns the
 * number of changed columns.
 */
export function updateNavGrid(g: NavGrid, blocked: (x: number, z: number) => boolean): number {
  let changed = 0;
  for (let z = 0; z < g.sz; z++)
    for (let x = 0; x < g.sx; x++) {
      const i = x + z * g.sx;
      const b = blocked(x, z) ? 1 : 0;
      if (g.vox[i] === b) continue;
      g.vox[i] = b;
      changed++;
      refreshNodes(g, x, z, x, z);
    }
  return changed;
}

/** Replace the dynamic layer (locked door cells, in cell units) with `cells`; patches the affected nodes. */
export function setDynamicBlocked(g: NavGrid, cells: Iterable<XZ>): void {
  const next = new Set<number>();
  for (const [x, z] of cells) if (x >= 0 && z >= 0 && x < g.sx && z < g.sz) next.add(x + z * g.sx);
  const touched: number[] = [];
  for (const k of g.dynCells) if (!next.has(k)) touched.push(k);
  for (const k of next) if (!g.dynCells.has(k)) touched.push(k);
  if (!touched.length) return;
  for (const k of g.dynCells) g.dyn[k] = 0;
  for (const k of next) g.dyn[k] = 1;
  g.dynCells = next;
  for (const k of touched) {
    const x = k % g.sx;
    const z = (k - x) / g.sx;
    refreshNodes(g, x, z, x, z);
  }
}

/** Node index range whose walker box overlaps voxel column range [vx0, vx1]. */
function nodeRange(g: NavGrid, v0: number, v1: number, n: number): [number, number] {
  // Node i centre c = (i + 0.5) / res; box [c − half, c + half] overlaps cell v
  // when c − half < v + 1 and c + half > v (all in cell units).
  const half = g.half * g.scale;
  const lo = Math.max(0, Math.floor((v0 - half) * g.res - 0.5) - 1);
  const hi = Math.min(n - 1, Math.ceil((v1 + 1 + half) * g.res - 0.5) + 1);
  return [lo, hi];
}

/** Recompute nodes around the voxel rectangle [x0..x1] × [z0..z1]. */
function refreshNodes(g: NavGrid, x0: number, z0: number, x1: number, z1: number): void {
  const [i0, i1] = nodeRange(g, x0, x1, g.nx);
  const [k0, k1] = nodeRange(g, z0, z1, g.nz);
  for (let k = k0; k <= k1; k++)
    for (let i = i0; i <= i1; i++) {
      const [s, d] = evalNode(g, i, k);
      const j = i + k * g.nx;
      g.nodeStatic[j] = s;
      g.node[j] = d;
    }
}

/** [static free, dynamic free] of node (i, k). */
function evalNode(g: NavGrid, i: number, k: number): [0 | 1, 0 | 1] {
  const cx = (i + 0.5) / g.res;
  const cz = (k + 0.5) / g.res;
  const eps = 1e-6;
  const half = g.half * g.scale;
  const x0 = Math.floor(cx - half + eps);
  const x1 = Math.ceil(cx + half - eps) - 1;
  const z0 = Math.floor(cz - half + eps);
  const z1 = Math.ceil(cz + half - eps) - 1;
  if (x0 < 0 || z0 < 0 || x1 >= g.sx || z1 >= g.sz) return [0, 0];
  let dyn = false;
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      const v = x + z * g.sx;
      if (g.vox[v]) return [0, 0];
      if (g.dyn[v]) dyn = true;
    }
  return [1, dyn ? 0 : 1];
}

// ── Coordinates ──────────────────────────────────────────────────

/** Node of world point (x, z). */
export function nodeOf(g: NavGrid, x: number, z: number): XZ {
  const k = g.res * g.scale;
  return [
    Math.min(g.nx - 1, Math.max(0, Math.floor(x * k))),
    Math.min(g.nz - 1, Math.max(0, Math.floor(z * k))),
  ];
}

/** World centre of node (i, k). */
export function nodeCentre(g: NavGrid, i: number, k: number): XZ {
  const n = g.res * g.scale;
  return [(i + 0.5) / n, (k + 0.5) / n];
}

/** Grid extent in world units. */
function worldSize(g: NavGrid): XZ {
  return [g.sx / g.scale, g.sz / g.scale];
}

export function isFreeAt(g: NavGrid, x: number, z: number, ignoreDynamic = false): boolean {
  const [wx, wz] = worldSize(g);
  if (x < 0 || z < 0 || x >= wx || z >= wz) return false;
  const [i, k] = nodeOf(g, x, z);
  return !!(ignoreDynamic ? g.nodeStatic : g.node)[i + k * g.nx];
}

/** Nearest free node to (x, z) within `radius` world units (ring search), or null. */
export function nearestFree(
  g: NavGrid,
  x: number,
  z: number,
  radius: number,
  ignoreDynamic = false,
): XZ | null {
  const nodes = ignoreDynamic ? g.nodeStatic : g.node;
  const [ci, ck] = nodeOf(g, x, z);
  const perUnit = g.res * g.scale;
  const maxR = Math.ceil(radius * perUnit);
  let best: XZ | null = null;
  let bestD = Infinity;
  for (let r = 0; r <= maxR; r++) {
    for (let k = ck - r; k <= ck + r; k++)
      for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(k - ck)) !== r) continue;
        if (i < 0 || k < 0 || i >= g.nx || k >= g.nz || !nodes[i + k * g.nx]) continue;
        const [wx, wz] = nodeCentre(g, i, k);
        const d = Math.hypot(wx - x, wz - z);
        if (d < bestD) {
          bestD = d;
          best = [i, k];
        }
      }
    // A ring at Chebyshev distance r is at least r / res away: stop once no closer hit can follow.
    if (best && bestD <= r / perUnit) break;
  }
  return best && bestD <= radius + 1 / perUnit ? best : null;
}

/**
 * Exact test: the walker's square box (± `half` world units, default the
 * grid's) centred on world point (x, z) touches only free cells.
 */
export function boxFree(
  g: NavGrid,
  x: number,
  z: number,
  half: number = g.half,
  ignoreDynamic = false,
): boolean {
  const s = g.scale;
  const h = half * s;
  const eps = 1e-6;
  const x0 = Math.floor(x * s - h + eps);
  const x1 = Math.ceil(x * s + h - eps) - 1;
  const z0 = Math.floor(z * s - h + eps);
  const z1 = Math.ceil(z * s + h - eps) - 1;
  if (x0 < 0 || z0 < 0 || x1 >= g.sx || z1 >= g.sz) return false;
  for (let vz = z0; vz <= z1; vz++)
    for (let vx = x0; vx <= x1; vx++) {
      const v = vx + vz * g.sx;
      if (g.vox[v] || (!ignoreDynamic && g.dyn[v])) return false;
    }
  return true;
}

// ── Line of sight ────────────────────────────────────────────────

/**
 * Exact swept-box test: true when the walker's square box (± `half`) can
 * slide in a straight line from world point a to b touching only free
 * cells. Column by column along x, the part of the segment whose box
 * overlaps that column is clipped and its z range (± half) checked — no
 * sampling gaps, corners included. `half` overrides the grid's walker
 * half-width (world units), e.g. the exact collision box on a last leg.
 */
export function lineClear(
  g: NavGrid,
  wax: number,
  waz: number,
  wbx: number,
  wbz: number,
  ignoreDynamic = false,
  half: number = g.half,
): boolean {
  const s = g.scale;
  const ax = wax * s;
  const az = waz * s;
  const bx = wbx * s;
  const bz = wbz * s;
  const h = half * s;
  const EPS = 1e-6;
  const dx = bx - ax;
  const dz = bz - az;
  const vx0 = Math.floor(Math.min(ax, bx) - h + EPS);
  const vx1 = Math.ceil(Math.max(ax, bx) + h - EPS) - 1;
  if (vx0 < 0 || vx1 >= g.sx) return false;
  for (let vx = vx0; vx <= vx1; vx++) {
    // Points whose box overlaps column vx: x ∈ (vx − h, vx + 1 + h).
    let t0 = 0;
    let t1 = 1;
    if (Math.abs(dx) > 1e-12) {
      const ta = (vx - h + EPS - ax) / dx;
      const tb = (vx + 1 + h - EPS - ax) / dx;
      t0 = Math.max(0, Math.min(ta, tb));
      t1 = Math.min(1, Math.max(ta, tb));
      if (t0 > t1) continue;
    } else if (!(ax > vx - h + EPS && ax < vx + 1 + h - EPS)) continue;
    const za = az + dz * t0;
    const zb = az + dz * t1;
    const vz0 = Math.floor(Math.min(za, zb) - h + EPS);
    const vz1 = Math.ceil(Math.max(za, zb) + h - EPS) - 1;
    if (vz0 < 0 || vz1 >= g.sz) return false;
    for (let vz = vz0; vz <= vz1; vz++) {
      const v = vx + vz * g.sx;
      if (g.vox[v] || (!ignoreDynamic && g.dyn[v])) return false;
    }
  }
  return true;
}

/** Greedy string pulling: keep only the corners needed for line of sight. */
export function smoothPath(g: NavGrid, pts: XZ[], ignoreDynamic = false): XZ[] {
  if (pts.length <= 2) return pts.slice();
  const out: XZ[] = [pts[0]!];
  let a = 0;
  while (a < pts.length - 1) {
    // Farthest point visible from the anchor (scan back from the end).
    let b = pts.length - 1;
    const pa = pts[a]!;
    while (b > a + 1) {
      const pb = pts[b]!;
      if (lineClear(g, pa[0], pa[1], pb[0], pb[1], ignoreDynamic)) break;
      b--;
    }
    out.push(pts[b]!);
    a = b;
  }
  return out;
}

// ── A* ───────────────────────────────────────────────────────────

export interface PathOptions {
  /** Expansion cap (default 40 000 — a whole floor at half-voxel resolution). */
  maxExpansions?: number;
  /** Treat locked door cells as free (to tell "locked" from "no way"). */
  ignoreDynamic?: boolean;
  /**
   * Extra goal test in world coordinates (e.g. "within reach of the device
   * and in its room"); a popped node that passes ends the search.
   */
  accept?: (x: number, z: number) => boolean;
  /** Skip string pulling (tests). */
  raw?: boolean;
}

export interface PathResult {
  /** Waypoints in world xz, from the (snapped) start to the end point. */
  points: XZ[];
  /** The goal (or an `accept`ed node) was reached. */
  reached: boolean;
  expansions: number;
  /** Start node was blocked and no free node was found nearby. */
  noStart?: boolean;
}

const SQRT2 = Math.SQRT2;
const DIRS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

function scratchFor(g: NavGrid): Scratch {
  const n = g.nx * g.nz;
  if (!g.scratch) {
    g.scratch = {
      g: new Float32Array(n),
      parent: new Int32Array(n),
      stamp: new Uint32Array(n),
      closed: new Uint32Array(n),
      gen: 0,
      heapIdx: new Int32Array(1024),
      heapF: new Float64Array(1024),
    };
  }
  const s = g.scratch;
  s.gen++;
  if (s.gen >= 0xffffffff) {
    s.stamp.fill(0);
    s.closed.fill(0);
    s.gen = 1;
  }
  return s;
}

/** Walker path from world point `from` to world point `to` on the nav grid. */
export function findPath(g: NavGrid, from: XZ, to: XZ, opts: PathOptions = {}): PathResult {
  const ignoreDynamic = !!opts.ignoreDynamic;
  const nodes = ignoreDynamic ? g.nodeStatic : g.node;
  const maxExp = opts.maxExpansions ?? 40_000;
  const nx = g.nx;
  const perUnit = g.res * g.scale;
  let start = nodeOf(g, from[0], from[1]);
  if (!nodes[start[0] + start[1] * nx]) {
    const near = nearestFree(g, from[0], from[1], 3, ignoreDynamic);
    if (!near) return { points: [], reached: false, expansions: 0, noStart: true };
    start = near;
  }
  const goal = nodeOf(g, to[0], to[1]);
  const goalFree = !!nodes[goal[0] + goal[1] * nx];
  const gi = goal[0];
  const gk = goal[1];
  const h = (i: number, k: number): number => {
    const dx = Math.abs(i - gi);
    const dz = Math.abs(k - gk);
    return (Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)) / perUnit;
  };
  const s = scratchFor(g);
  const gen = s.gen;
  let heapN = 0;
  const push = (idx: number, f: number): void => {
    if (heapN >= s.heapIdx.length) {
      const ni = new Int32Array(s.heapIdx.length * 2);
      ni.set(s.heapIdx);
      const nf = new Float64Array(s.heapF.length * 2);
      nf.set(s.heapF);
      s.heapIdx = ni;
      s.heapF = nf;
    }
    const hi = s.heapIdx;
    const hf = s.heapF;
    let c = heapN++;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (hf[p]! <= f) break;
      hi[c] = hi[p]!;
      hf[c] = hf[p]!;
      c = p;
    }
    hi[c] = idx;
    hf[c] = f;
  };
  const pop = (): number => {
    const hi = s.heapIdx;
    const hf = s.heapF;
    const top = hi[0]!;
    heapN--;
    if (heapN > 0) {
      const li = hi[heapN]!;
      const lf = hf[heapN]!;
      let c = 0;
      for (;;) {
        let m = 2 * c + 1;
        if (m >= heapN) break;
        if (m + 1 < heapN && hf[m + 1]! < hf[m]!) m++;
        if (hf[m]! >= lf) break;
        hi[c] = hi[m]!;
        hf[c] = hf[m]!;
        c = m;
      }
      hi[c] = li;
      hf[c] = lf;
    }
    return top;
  };
  const si0 = start[0] + start[1] * nx;
  s.stamp[si0] = gen;
  s.g[si0] = 0;
  s.parent[si0] = -1;
  push(si0, h(start[0], start[1]));
  let best = si0;
  // Fallback end when the goal is out of reach: closest to it, slightly
  // preferring nodes near the start (click into a wall → stay on this side).
  let bestScore = h(start[0], start[1]);
  let found = -1;
  let expansions = 0;
  const accept = opts.accept;
  while (heapN > 0 && expansions < maxExp) {
    const cur = pop();
    if (s.closed[cur] === gen) continue;
    s.closed[cur] = gen;
    expansions++;
    const ci = cur % nx;
    const ck = (cur - ci) / nx;
    const hc = h(ci, ck);
    const gc = s.g[cur]!;
    const score = hc + 0.1 * gc;
    if (score < bestScore) {
      best = cur;
      bestScore = score;
    }
    if ((goalFree && ci === gi && ck === gk) || (accept && accept(...nodeCentre(g, ci, ck)))) {
      found = cur;
      break;
    }
    for (const [di, dk, cost] of DIRS) {
      const ni = ci + di;
      const nk = ck + dk;
      if (ni < 0 || nk < 0 || ni >= nx || nk >= g.nz) continue;
      const n = ni + nk * nx;
      if (!nodes[n] || s.closed[n] === gen) continue;
      // No corner cutting: both orthogonal neighbours must be free for a diagonal.
      if (di && dk && (!nodes[ni + ck * nx] || !nodes[ci + nk * nx])) continue;
      const ng = gc + cost / perUnit;
      if (s.stamp[n] === gen && s.g[n]! <= ng) continue;
      s.stamp[n] = gen;
      s.g[n] = ng;
      s.parent[n] = cur;
      push(n, ng + h(ni, nk));
    }
  }
  const end = found >= 0 ? found : best;
  const chain: XZ[] = [];
  for (let c = end; c >= 0; c = s.parent[c]!) {
    const i = c % nx;
    chain.push(nodeCentre(g, i, (c - i) / nx));
    if (c === si0) break;
  }
  chain.reverse();
  const points = opts.raw ? chain : smoothPath(g, chain, ignoreDynamic);
  return { points, reached: found >= 0, expansions };
}

/**
 * Point ray over the static cell layer from a to b (world units), ignoring
 * the last `stopShort` units (the target's own footprint): "can she see /
 * reach it from here", i.e. no wall in between.
 */
export function rayClear(
  g: NavGrid,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  stopShort = 0,
): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const end = len - stopShort;
  if (end <= 0) return true;
  const n = Math.ceil(end / 0.25);
  for (let s = 0; s <= n; s++) {
    const t = Math.min(end, s * 0.25) / len;
    const x = Math.floor((ax + (bx - ax) * t) * g.scale);
    const z = Math.floor((az + (bz - az) * t) * g.scale);
    if (x < 0 || z < 0 || x >= g.sx || z >= g.sz || g.vox[x + z * g.sx]) return false;
  }
  return true;
}

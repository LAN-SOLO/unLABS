import { VoxelGrid, readBox, type Vec3, type VoxelSource } from "@/lib/voxel/grid";
import type { MaterialClass } from "@/lib/voxel/mesher";

/**
 * Voxel refinement (pure — no three, runs in Node).
 * ==================================================
 *
 * Splits every voxel into 2×2×2 sub-voxels at half the edge length and uses
 * the extra resolution for real detail instead of a plain subdivision:
 *
 * - **bevel** — the outermost sub-voxel along convex edges of solid/metal
 *   blocks is dropped (a chamfer), only where the edge runs ≥ `bevel` voxels
 *   and the block is ≥ 2 voxels thick on both sides of the edge. 1-voxel-thin
 *   parts, glass and emissives are never cut, so silhouettes and thin
 *   features survive and every block keeps ≥ 4 of its 8 sub-voxels.
 * - **thin lines** — 1-voxel painted lines on flat faces (grout grids, painted
 *   seams, stencil strokes) become half as wide; crossings stay joined.
 * - **seams / grooves / rivets** — plate lines every `seams` voxels on large
 *   flat same-colour faces (a darker partner colour; a 1-sub-voxel groove
 *   where the part is thick enough), light rivet dots at plate corners on metal.
 * - **wear** — deterministic (hash-based) light partner colour on chamfer
 *   and edge sub-voxels (worn paint, polished metal edges).
 * - **scanlines / LEDs** — screen colours get alternate dim sub-rows; lone
 *   LED voxels flush in a face become one lit sub-voxel in a dark bezel.
 * - **terrain extras** — floor joints (grooved tile / slab joints inside
 *   uniform floor areas and between checker tiles), grooved wall panel joints
 *   (staggered per face so 1-voxel walls never get holes), a skirting band at
 *   the foot of walls and a light rim on their top edge.
 *
 * Everything is deterministic (no randomness). The palette is passed in as
 * partner tables (index → darker / lighter partner index, 0 = none), so the
 * module stays palette-agnostic.
 */

export interface RefineRules {
  /** Chamfer convex edges whose run is at least this many voxels (0/undefined = off, clamped to 2..4). */
  bevel?: number;
  /** Half-width painted lines on flat faces. */
  thinLines?: boolean;
  /** Plate period per axis on side faces (normal x or z), in source voxels; 0 = none on that axis. */
  seams?: Vec3;
  /** Plate period per axis on top/bottom faces (normal y); defaults to `seams`. */
  topSeams?: Vec3;
  /** Cut seams one sub-voxel deep where the part is ≥ 2 voxels thick (else they are only painted). */
  grooves?: boolean;
  /**
   * Also groove 1-voxel-thin parts (walls): the two faces are staggered by
   * half a period so a groove never meets its counterpart (no holes).
   * Seams across the vertical axis stay painted.
   */
  thinGrooves?: boolean;
  /**
   * Floor joints on the top face of cells at absolute `y`: painted 1-voxel
   * grout lines of a jointed colour become half-width grooves, and uniform
   * runs of one joint family get a groove every `RefineOptions.joints[colour]`
   * voxels in x and z (painted markings, carpets, wood stay seamless).
   */
  floorGrooves?: { y: number };
  /** Light rivet dots at plate corners (metal only, needs seams on both face axes). */
  rivets?: boolean;
  /** Probability 0..1 of a light "worn" sub-voxel on chamfers and edges. */
  wear?: number;
  /** Alternate dim sub-rows on screen colours (see `RefineOptions.scan`). */
  scanlines?: boolean;
  /** Lone LED voxels become one lit sub-voxel in a dark bezel (see `RefineOptions.bezel`). */
  leds?: boolean;
  /** Absolute y of the first wall row: its lower half gets a dark skirting band where it stands on something. */
  skirtingY?: number;
  /** Light rim on the upper half of side faces of top-exposed voxels (wall copings). */
  topRim?: boolean;
  /** Only cells with y ≥ this (absolute) get skirting / top rim (e.g. 1 = walls, not the floor slab). */
  rimMinY?: number;
}

export interface RefineOptions {
  /** Classify a palette index (default: everything 'solid'). */
  materialOf?: (index: number) => MaterialClass;
  /** 256-entry table: darker partner per palette index (0 = none). */
  dark?: ArrayLike<number>;
  /** 256-entry table: lighter partner per palette index (0 = none). */
  light?: ArrayLike<number>;
  /** 256-entry table: dim scanline colour per screen colour (0 = not a screen). */
  scan?: ArrayLike<number>;
  /** 256-entry table: bezel colour per LED colour (0 = not an LED). */
  bezel?: ArrayLike<number>;
  /** 256-entry table: floor joint period per colour (0 = no joints), see `RefineRules.floorGrooves`. */
  joints?: ArrayLike<number>;
  /** 256-entry table: joint family per colour (runs of one family are jointed as one surface; default: the colour itself). */
  jointFamily?: ArrayLike<number>;
  rules?: RefineRules;
  /** Hash seed for wear. */
  seed?: number;
}

const SOLID = 0;
const GLASS = 1;
const EMIT = 2;
const METAL = 3;
const CLASS_CODE: Record<MaterialClass, number> = {
  solid: SOLID,
  glass: GLASS,
  emit: EMIT,
  metal: METAL,
};

/** Context margin (source voxels) sampled around a region — covers the longest rule reach. */
export const REFINE_REACH = 4;

/** Deterministic 0..1 hash of an integer triple. */
export function refineHash(x: number, y: number, z: number, seed = 0): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1);
  h ^= seed | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Refine a whole grid: returns a grid of 2× the size (sx·2, sy·2, sz·2). */
export function refineGrid(src: VoxelGrid, opts: RefineOptions = {}): VoxelGrid {
  return refineRegion(src, [0, 0, 0], [src.sx, src.sy, src.sz], opts);
}

/**
 * Refine the box [min, min + size) of `src` into a grid of 2× that size.
 * Rules sample neighbours outside the box (up to REFINE_REACH voxels), so
 * adjacent boxes (terrain chunks) refine seamlessly. Patterns (seams, wear)
 * use absolute source coordinates.
 */
export function refineRegion(
  src: VoxelSource,
  min: Vec3,
  size: Vec3,
  opts: RefineOptions = {},
): VoxelGrid {
  const M = REFINE_REACH;
  const [sx, sy, sz] = size;
  const PX = sx + 2 * M;
  const PY = sy + 2 * M;
  const PZ = sz + 2 * M;
  const pad = readBox(src, [min[0] - M, min[1] - M, min[2] - M], [PX, PY, PZ]);
  const S: [number, number, number] = [1, PX, PX * PY];
  const OX = sx * 2;
  const OY = sy * 2;
  const out = new VoxelGrid(OX, OY, sz * 2);
  const od = out.data;
  const OS: [number, number, number] = [1, OX, OX * OY];

  const materialOf = opts.materialOf ?? (() => "solid" as const);
  const cls = new Uint8Array(256);
  for (let k = 1; k < 256; k++) cls[k] = CLASS_CODE[materialOf(k)];
  const dark = opts.dark;
  const light = opts.light;
  const scan = opts.scan;
  const bezel = opts.bezel;
  const r = opts.rules ?? {};
  const seed = opts.seed ?? 0;
  const bevelRun = r.bevel ? Math.max(2, Math.min(M, r.bevel)) : 0;
  const sideSeams = r.seams;
  const topSeams = r.topSeams ?? r.seams;
  const wear = r.wear ?? 0;
  const rimMinY = r.rimMinY ?? -Infinity;

  // Sub-voxel scratch: 8 values, index ox + 2·oy + 4·oz.
  const sub = new Int32Array(8);
  const g: [number, number, number] = [0, 0, 0];
  const exp = new Uint8Array(6); // exposed flags, index axis·2 + side (0 = −, 1 = +)
  const touched = new Uint8Array(8); // recoloured by seams / lines (wear skips them)

  const isHard = (v: number): boolean => v !== 0 && (cls[v] === SOLID || cls[v] === METAL);

  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      let i = M + PX * (y + M + PY * (z + M));
      for (let x = 0; x < sx; x++, i++) {
        const c = pad[i]!;
        if (c === 0) continue;
        const base = 2 * x + OX * (2 * y + OY * 2 * z);
        let anyExp = 0;
        for (let a = 0; a < 3; a++) {
          const e0 = pad[i - S[a]] === 0 ? 1 : 0;
          const e1 = pad[i + S[a]] === 0 ? 1 : 0;
          exp[a * 2] = e0;
          exp[a * 2 + 1] = e1;
          anyExp |= e0 | e1;
        }
        const k = cls[c]!;
        if (!anyExp || k === GLASS) {
          writeSubs(od, base, OS, c);
          continue;
        }
        sub.fill(c);
        touched.fill(0);
        g[0] = min[0] + x;
        g[1] = min[1] + y;
        g[2] = min[2] + z;

        if (k === EMIT) {
          refineEmissive(c, i);
          flush(od, base, OS, sub);
          continue;
        }

        // ── Painted detail on flat faces (outer layer only) ──
        for (let a = 0; a < 3; a++) {
          for (let sd = 0; sd < 2; sd++) {
            if (!exp[a * 2 + sd]) continue;
            const u = (a + 1) % 3;
            const v = (a + 2) % 3;
            const out1 = (sd ? 1 : -1) * S[a];
            // A neighbour cell is "on this face" when it is solid and open on the same side.
            const onFace = (j: number): boolean => pad[j] !== 0 && pad[j + out1] === 0;
            const floorTop = !!r.floorGrooves && a === 1 && sd === 1 && g[1] === r.floorGrooves.y;
            if (r.thinLines) thinLines(c, i, a, sd, u, v, onFace);
            if (floorTop) floorJoints(c, i);
            const P = a === 1 ? topSeams : sideSeams;
            if (P) seams(c, i, a, sd, u, v, P, onFace, k);
            if (r.skirtingY !== undefined && a !== 1 && g[1] === r.skirtingY && g[1] >= rimMinY) {
              const dk = dark?.[c] ?? 0;
              if (dk && pad[i - S[1]] !== 0) paint(a, sd, 1, 0, dk);
            }
            if (r.topRim && a !== 1 && exp[3] && g[1] >= rimMinY) {
              const lt = light?.[c] ?? 0;
              if (lt) paint(a, sd, 1, 1, lt);
            }
          }
        }

        // ── Bevel: drop the outer sub-voxel of qualifying convex edges ──
        let dropped = 0;
        if (bevelRun) {
          for (let o = 0; o < 8; o++) {
            let n = 0;
            let ok = true;
            for (let a = 0; a < 3; a++) {
              const sd = (o >> a) & 1;
              if (!exp[a * 2 + sd]) continue;
              n++;
              // Thin on this axis (open on both sides) → never cut.
              if (!isHard(pad[i - (sd ? 1 : -1) * S[a]]!)) ok = false;
            }
            if (n < 2 || !ok) continue;
            if (!bevelOk(i, o)) continue;
            sub[o] = 0;
            dropped |= 1 << o;
          }
        }

        // ── Wear: light partner on chamfer faces and remaining edges ──
        const lt = light?.[c] ?? 0;
        if (wear > 0 && lt) {
          for (let o = 0; o < 8; o++) {
            if (sub[o] === 0 || touched[o]) continue;
            let n = 0;
            for (let a = 0; a < 3; a++) if (exp[a * 2 + ((o >> a) & 1)]) n++;
            if (n === 0) continue;
            let nearCut = false;
            for (let a = 0; a < 3; a++) if (dropped & (1 << (o ^ (1 << a)))) nearCut = true;
            if (n < 2 && !nearCut) continue;
            const hx = 2 * g[0] + (o & 1);
            const hy = 2 * g[1] + ((o >> 1) & 1);
            const hz = 2 * g[2] + ((o >> 2) & 1);
            if (refineHash(hx, hy, hz, seed) < wear) sub[o] = lt;
          }
        }
        flush(od, base, OS, sub);
      }
    }
  }
  return out;

  /** Recolour the outer-layer sub-voxels of face (a, sd) whose coordinate on axis w is `ow`. */
  function paint(a: number, sd: number, w: number, ow: number, color: number): void {
    for (let o = 0; o < 8; o++) {
      if (((o >> a) & 1) !== sd || ((o >> w) & 1) !== ow) continue;
      if (sub[o] === 0) continue;
      sub[o] = color;
      touched[o] = 1;
    }
  }

  function thinLines(
    c: number,
    i: number,
    a: number,
    sd: number,
    u: number,
    v: number,
    onFace: (j: number) => boolean,
  ): void {
    let thin = false;
    for (const [w, ow] of [
      [u, v],
      [v, u],
    ] as const) {
      const cm = pad[i - S[w]]!;
      const cp = pad[i + S[w]]!;
      if (cm === c || cp === c || !isHard(cm) || !isHard(cp)) continue;
      if (!onFace(i - S[w]) || !onFace(i + S[w])) continue;
      if (pad[i - S[ow]] !== c && pad[i + S[ow]] !== c) continue;
      // Keep the line on the − half, the + half takes the neighbour's colour.
      paint(a, sd, w, 1, cp);
      thin = true;
    }
    if (thin) return;
    // Crossing / joint where lines leave towards +u and +v: the +u+v
    // quadrant belongs to the tile on that diagonal. Only at line nodes —
    // at least 3 of the 4 diagonal neighbours differ (crossings, T and L
    // joints), never at the inner corner of a solid region.
    let diag = 0;
    for (const du of [-1, 1])
      for (const dv of [-1, 1]) if (pad[i + du * S[u] + dv * S[v]] !== c) diag++;
    if (diag < 3) return;
    const j = i + S[u] + S[v];
    const d = pad[j]!;
    if (pad[i + S[u]] !== c || pad[i + S[v]] !== c || d === c || !isHard(d) || !onFace(j)) return;
    for (let o = 0; o < 8; o++)
      if (((o >> a) & 1) === sd && ((o >> u) & 1) === 1 && ((o >> v) & 1) === 1) {
        sub[o] = d;
        touched[o] = 1;
      }
  }

  function seams(
    c: number,
    i: number,
    a: number,
    sd: number,
    u: number,
    v: number,
    P: Vec3,
    onFace: (j: number) => boolean,
    k: number,
  ): void {
    const dk = dark?.[c] ?? 0;
    if (!dk) return;
    const flat = (w: number): boolean =>
      pad[i - S[w]] === c && pad[i + S[w]] === c && onFace(i - S[w]) && onFace(i + S[w]);
    const thick = pad[i - (sd ? 1 : -1) * S[a]] !== 0;
    for (const [w, ow] of [
      [u, v],
      [v, u],
    ] as const) {
      const p = P[w]!;
      if (!p) continue;
      // Thin parts groove the − face half a period later than the + face.
      const staggered = r.thinGrooves && !thick && w !== 1 && sd === 0;
      if (mod(g[w]! + (staggered ? p >> 1 : 0), p) !== 0) continue;
      if (!flat(w) || pad[i - 2 * S[w]] !== c || !onFace(i - 2 * S[w])) continue;
      if (pad[i - S[ow]] !== c && pad[i + S[ow]] !== c) continue;
      if (r.grooves && (thick || (r.thinGrooves && w !== 1))) {
        for (let o = 0; o < 8; o++) {
          if (((o >> w) & 1) !== 0) continue;
          if (((o >> a) & 1) === sd) sub[o] = 0;
          else sub[o] = dk;
          touched[o] = 1;
        }
      } else paint(a, sd, w, 0, dk);
    }
    // Rivets at plate corners (metal).
    const lt = light?.[c] ?? 0;
    const pu = P[u]!;
    const pv = P[v]!;
    if (!r.rivets || k !== METAL || !lt || !pu || !pv) return;
    const mu = mod(g[u]!, pu);
    const mv = mod(g[v]!, pv);
    if ((mu !== 0 && mu !== pu - 1) || (mv !== 0 && mv !== pv - 1)) return;
    if (!flat(u) || !flat(v)) return;
    for (let o = 0; o < 8; o++)
      if (((o >> a) & 1) === sd && ((o >> u) & 1) === 1 && ((o >> v) & 1) === 1 && sub[o] === c) {
        sub[o] = lt;
        touched[o] = 1;
      }
  }

  /** Tile joints on a floor cell's top face: a groove along its −x / −z edge. */
  function floorJoints(c: number, i: number): void {
    const dk = dark?.[c] ?? 0;
    const p = opts.joints?.[c] ?? 0;
    if (!dk || !p) return;
    const fam = (v: number): number =>
      (opts.joints?.[v] ?? 0) > 0 ? (opts.jointFamily?.[v] ?? v) || v : -1;
    const f = fam(c);
    for (const w of [0, 2]) {
      const fm = fam(pad[i - S[w]]!);
      // Boundary between two jointed surfaces (checker tiles) — unless one
      // side is a 1-voxel line, which thinLines already turned into a groove.
      const boundary =
        fm > 0 && fm !== f && pad[i - 2 * S[w]] === pad[i - S[w]] && pad[i + S[w]] === c;
      // Inside a uniform run: every `p` voxels (two voxels either side of the joint).
      // The joint segment must continue along the surface on one side
      // (never across a 1-voxel line or a crossing — that leaves pits).
      const ow = 2 - w;
      const along = (t: number): boolean =>
        fam(pad[i + t * S[ow]]!) === f && fam(pad[i - S[w] + t * S[ow]]!) === f;
      const periodic =
        (along(1) || along(-1)) &&
        mod(g[w]!, p) === 0 &&
        fm === f &&
        fam(pad[i - 2 * S[w]]!) === f &&
        fam(pad[i + S[w]]!) === f;
      if (!boundary && !periodic) continue;
      for (let o = 0; o < 8; o++) {
        if (((o >> w) & 1) !== 0) continue;
        sub[o] = ((o >> 1) & 1) === 1 ? 0 : dk;
        touched[o] = 1;
      }
    }
  }

  /** Convex-edge test for sub-voxel `o` (all its exposed axes are thick). */
  function bevelOk(i: number, o: number): boolean {
    const axes: number[] = [];
    const sgn: number[] = [];
    for (let a = 0; a < 3; a++) {
      const sd = (o >> a) & 1;
      if (exp[a * 2 + sd]) {
        axes.push(a);
        sgn.push(sd ? 1 : -1);
      }
    }
    // Diagonal neighbours must be open (no block touching the edge).
    for (let p = 0; p < axes.length; p++)
      for (let q = p + 1; q < axes.length; q++)
        if (pad[i + sgn[p]! * S[axes[p]!] + sgn[q]! * S[axes[q]!]] !== 0) return false;
    if (axes.length === 3 && pad[i + sgn[0]! * S[0] + sgn[1]! * S[1] + sgn[2]! * S[2]] !== 0)
      return false;
    // Some edge through this sub-voxel must be a long run.
    for (let p = 0; p < axes.length; p++)
      for (let q = p + 1; q < axes.length; q++) {
        const a = axes[p]!;
        const b = axes[q]!;
        const along = 3 - a - b;
        if (edgeRun(i, a, sgn[p]!, b, sgn[q]!, along) >= bevelRun) return true;
      }
    return false;
  }

  function edgeRun(i: number, a: number, sa: number, b: number, sb: number, c3: number): number {
    let n = 1;
    for (const t of [-1, 1]) {
      for (let k = 1; k < bevelRun; k++) {
        const q = i + t * k * S[c3];
        if (pad[q] !== 0 && pad[q + sa * S[a]] === 0 && pad[q + sb * S[b]] === 0) n++;
        else break;
      }
    }
    return n;
  }

  function refineEmissive(c: number, i: number): void {
    const bz = bezel?.[c] ?? 0;
    if (r.leds && bz) {
      let same = 0;
      let faces = 0;
      let fa = 0;
      let fs = 0;
      for (let a = 0; a < 3; a++) {
        if (pad[i - S[a]] === c) same++;
        if (pad[i + S[a]] === c) same++;
        for (let sd = 0; sd < 2; sd++)
          if (exp[a * 2 + sd]) {
            faces++;
            fa = a;
            fs = sd;
          }
      }
      if (same === 0 && faces === 1) {
        // One lit sub-voxel (upper row) in a dark bezel on the open face.
        const up = fa === 1 ? 2 : 1;
        const across = 3 - fa - up;
        for (let o = 0; o < 8; o++) {
          if (((o >> fa) & 1) !== fs) continue;
          const lit = ((o >> up) & 1) === 1 && ((o >> across) & 1) === 0;
          if (!lit) sub[o] = bz;
        }
        return;
      }
    }
    const dim = scan?.[c] ?? 0;
    if (!r.scanlines || !dim) return;
    for (let a = 0; a < 3; a++) {
      for (let sd = 0; sd < 2; sd++) {
        if (!exp[a * 2 + sd]) continue;
        const u = (a + 1) % 3;
        const v = (a + 2) % 3;
        const out1 = (sd ? 1 : -1) * S[a];
        // Screens only: the face must continue in-plane (not a lone indicator).
        let wide = 0;
        for (const w of [u, v])
          for (const t of [-1, 1]) {
            const j = i + t * S[w];
            if (pad[j] === c && pad[j + out1] === 0) wide++;
          }
        if (wide < 2) continue;
        const row = a === 1 ? 2 : 1;
        for (let o = 0; o < 8; o++)
          if (((o >> a) & 1) === sd && ((o >> row) & 1) === 0) sub[o] = dim;
      }
    }
  }
}

function mod(n: number, p: number): number {
  return ((n % p) + p) % p;
}

function writeSubs(od: Uint8Array, base: number, OS: [number, number, number], c: number): void {
  od[base] = c;
  od[base + 1] = c;
  od[base + OS[1]] = c;
  od[base + OS[1] + 1] = c;
  od[base + OS[2]] = c;
  od[base + OS[2] + 1] = c;
  od[base + OS[2] + OS[1]] = c;
  od[base + OS[2] + OS[1] + 1] = c;
}

function flush(od: Uint8Array, base: number, OS: [number, number, number], sub: Int32Array): void {
  od[base] = sub[0]!;
  od[base + 1] = sub[1]!;
  od[base + OS[1]] = sub[2]!;
  od[base + OS[1] + 1] = sub[3]!;
  od[base + OS[2]] = sub[4]!;
  od[base + OS[2] + 1] = sub[5]!;
  od[base + OS[2] + OS[1]] = sub[6]!;
  od[base + OS[2] + OS[1] + 1] = sub[7]!;
}

/**
 * Character ↔ character collision (pure, no three).
 * =================================================
 *
 * Bots and Jade are discs on the floor plane. A move is clipped so no disc
 * walks into another: the part of the step that points into an overlapping
 * neighbour is removed (the mover slides round it), and moving apart is
 * always allowed — so two bodies that start overlapping (spawn, teleport)
 * separate instead of locking each other in place.
 *
 * `bodies` is a flat list of (x, z, r) triples. Entries at the mover's own
 * start position (distance < 1e-6) are ignored, so a shared list can include
 * the mover itself.
 */

/** Stride of the flat `bodies` list (x, z, r). */
export const BODY_STRIDE = 3;

const SELF_EPS = 1e-6;

function isSelf(x0: number, z0: number, bx: number, bz: number): boolean {
  return Math.abs(bx - x0) < SELF_EPS && Math.abs(bz - z0) < SELF_EPS;
}

/**
 * Clip a horizontal move of a disc (radius `r`) from (x0, z0) to (x1, z1)
 * against the other bodies. Returns the allowed end point.
 */
export function clipMove(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  r: number,
  bodies: readonly number[],
): [number, number] {
  let dx = x1 - x0;
  let dz = z1 - z0;
  if (dx === 0 && dz === 0) return [x0, z0];
  // Two passes: sliding off one neighbour can push into another.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i + 2 < bodies.length; i += BODY_STRIDE) {
      const bx = bodies[i]!;
      const bz = bodies[i + 1]!;
      if (isSelf(x0, z0, bx, bz)) continue;
      const min = r + bodies[i + 2]!;
      const ex = x0 + dx - bx;
      const ez = z0 + dz - bz;
      if (ex * ex + ez * ez >= min * min) continue;
      // Normal from the neighbour to the mover (start point; end point if coincident).
      let nx = x0 - bx;
      let nz = z0 - bz;
      let nl = Math.hypot(nx, nz);
      if (nl < SELF_EPS) {
        nx = ex;
        nz = ez;
        nl = Math.hypot(nx, nz);
      }
      if (nl < SELF_EPS) continue;
      nx /= nl;
      nz /= nl;
      const into = dx * nx + dz * nz;
      if (into < 0) {
        dx -= into * nx;
        dz -= into * nz;
      }
    }
  }
  // Whatever is left must not end deeper inside anyone than we started.
  const x = x0 + dx;
  const z = z0 + dz;
  for (let i = 0; i + 2 < bodies.length; i += BODY_STRIDE) {
    const bx = bodies[i]!;
    const bz = bodies[i + 1]!;
    if (isSelf(x0, z0, bx, bz)) continue;
    const min = r + bodies[i + 2]!;
    const after = Math.hypot(x - bx, z - bz);
    if (after < min && after < Math.hypot(x0 - bx, z0 - bz) - 1e-9) return [x0, z0];
  }
  return [x, z];
}

/** True when a disc of radius `r` at (x, z) overlaps any body (self excluded by `sx, sz`). */
export function crowded(
  x: number,
  z: number,
  r: number,
  bodies: readonly number[],
  sx = Number.NaN,
  sz = Number.NaN,
): boolean {
  for (let i = 0; i + 2 < bodies.length; i += BODY_STRIDE) {
    const bx = bodies[i]!;
    const bz = bodies[i + 1]!;
    if (isSelf(sx, sz, bx, bz)) continue;
    const min = r + bodies[i + 2]!;
    if ((x - bx) ** 2 + (z - bz) ** 2 < min * min) return true;
  }
  return false;
}

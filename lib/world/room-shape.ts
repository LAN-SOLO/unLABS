/**
 * Room shapes (pure, no imports besides types).
 *
 * A room's floor area is the union of a few primitives in absolute voxel
 * coordinates. A cell (x, z) belongs to the interior when its centre
 * (x + 0.5, z + 0.5) lies inside a primitive; the walls are the ring of
 * cells around the interior (see `lib/world/floor-geom.ts`).
 *
 * Rectangles follow the legacy room convention: `x`/`z` and `x + w`/`z + d`
 * are wall lines, so the interior is x + 1 … x + w − 1. A plain RoomDef
 * without `shape` is exactly `rect(x, z, w, d)`.
 */

export type ShapePrim =
  /** Wall-line rectangle; `chamfer` cuts 45° corners, `round` rounds them (radius). */
  | { kind: "rect"; x: number; z: number; w: number; d: number; chamfer?: number; round?: number }
  /** Ellipse (centre + radii) — round halls, domes, pods. */
  | { kind: "ellipse"; cx: number; cz: number; rx: number; rz: number }
  /** Polygon (voxel corner coordinates) — irregular caves, wedges, bent galleries. */
  | { kind: "poly"; pts: readonly (readonly [number, number])[] };

export type RoomShape = readonly ShapePrim[];

/** Point-in-polygon (even-odd). */
function inPoly(pts: readonly (readonly [number, number])[], px: number, pz: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i]!;
    const [xj, zj] = pts[j]!;
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Is the centre of cell (x, z) inside the primitive's interior? */
export function primContains(p: ShapePrim, x: number, z: number): boolean {
  const px = x + 0.5;
  const pz = z + 0.5;
  switch (p.kind) {
    case "rect": {
      // Interior cells x + 1 … x + w − 1 (centres x + 1.5 … x + w − 0.5).
      const x0 = p.x + 1;
      const z0 = p.z + 1;
      const x1 = p.x + p.w;
      const z1 = p.z + p.d;
      if (px < x0 || px > x1 || pz < z0 || pz > z1) return false;
      const dx = Math.min(px - x0, x1 - px);
      const dz = Math.min(pz - z0, z1 - pz);
      if (p.chamfer && dx + dz < p.chamfer) return false;
      if (p.round) {
        const r = p.round;
        if (dx < r && dz < r && Math.hypot(r - dx, r - dz) > r) return false;
      }
      return true;
    }
    case "ellipse": {
      const u = (px - p.cx) / p.rx;
      const v = (pz - p.cz) / p.rz;
      return u * u + v * v < 1;
    }
    case "poly":
      return inPoly(p.pts, px, pz);
  }
}

export function shapeContains(shape: RoomShape, x: number, z: number): boolean {
  for (const p of shape) if (primContains(p, x, z)) return true;
  return false;
}

/** Wall-line bounding box of a primitive (inclusive voxel range). */
export function primBounds(p: ShapePrim): { x0: number; z0: number; x1: number; z1: number } {
  switch (p.kind) {
    case "rect":
      return { x0: p.x, z0: p.z, x1: p.x + p.w, z1: p.z + p.d };
    case "ellipse":
      return {
        x0: Math.floor(p.cx - p.rx) - 1,
        z0: Math.floor(p.cz - p.rz) - 1,
        x1: Math.ceil(p.cx + p.rx),
        z1: Math.ceil(p.cz + p.rz),
      };
    case "poly": {
      let x0 = Infinity;
      let z0 = Infinity;
      let x1 = -Infinity;
      let z1 = -Infinity;
      for (const [x, z] of p.pts) {
        x0 = Math.min(x0, x);
        z0 = Math.min(z0, z);
        x1 = Math.max(x1, x);
        z1 = Math.max(z1, z);
      }
      return {
        x0: Math.floor(x0) - 1,
        z0: Math.floor(z0) - 1,
        x1: Math.ceil(x1),
        z1: Math.ceil(z1),
      };
    }
  }
}

/** Wall-line bounding box of a whole shape. */
export function shapeBounds(shape: RoomShape): { x0: number; z0: number; x1: number; z1: number } {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const p of shape) {
    const b = primBounds(p);
    x0 = Math.min(x0, b.x0);
    z0 = Math.min(z0, b.z0);
    x1 = Math.max(x1, b.x1);
    z1 = Math.max(z1, b.z1);
  }
  return { x0, z0, x1, z1 };
}

/** Shift a primitive by (dx, dz). */
export function movePrim(p: ShapePrim, dx: number, dz: number): ShapePrim {
  switch (p.kind) {
    case "rect":
      return { ...p, x: p.x + dx, z: p.z + dz };
    case "ellipse":
      return { ...p, cx: p.cx + dx, cz: p.cz + dz };
    case "poly":
      return { kind: "poly", pts: p.pts.map(([x, z]) => [x + dx, z + dz] as const) };
  }
}

/** Short constructors for authoring. */
export const S = {
  rect: (
    x: number,
    z: number,
    w: number,
    d: number,
    o: { chamfer?: number; round?: number } = {},
  ): ShapePrim => ({
    kind: "rect",
    x,
    z,
    w,
    d,
    ...o,
  }),
  ellipse: (cx: number, cz: number, rx: number, rz = rx): ShapePrim => ({
    kind: "ellipse",
    cx,
    cz,
    rx,
    rz,
  }),
  poly: (...pts: [number, number][]): ShapePrim => ({ kind: "poly", pts }),
};

/**
 * Flatten a rigged visual (base + animated parts) into ONE voxel grid at a
 * moment of its animation — the composition the undevbook bakes its device
 * pictures from (unlabsundevbook/scripts/extract/sprites.ts `compose`), so
 * the voxel pipeline (scripts/voxel, docs/VOXEL-BLENDER.md) clones exactly
 * what the book shows. Parts are transformed voxel-centre by voxel-centre
 * and snapped back onto the base's lattice (floor), parents first.
 *
 * Pure (no three.js); deterministic.
 */
import { VoxelGrid } from "@/lib/voxel/grid";
import { animTransform, type AnimPart, type DeviceVisual } from "@/lib/world/models/anim";
import { stagedGrid } from "@/lib/world/models/core";

type V3 = [number, number, number];

/** three.js Euler order 'XYZ' applied to a point: v' = Rx · Ry · Rz · v. */
export function rotEuler(p: V3, r: V3): V3 {
  let [x, y, z] = p;
  const [a, b, c] = r;
  if (c) [x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)];
  if (b) [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
  if (a) [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  return [x, y, z];
}

/**
 * Base + parts at time `t` (seconds of the animation) in one grid. `t = 0`
 * is the rest pose; `powered = false` freezes parts that need power and shows
 * their unlit colours, like the engine. `baseGrid` replaces the base (build
 * stages). The grid grows to fit parts that stick out of the base.
 */
export function composeVisual(
  v: DeviceVisual,
  t: number,
  powered: boolean,
  baseGrid?: VoxelGrid,
): VoxelGrid {
  const byName = new Map(v.parts.map((p) => [p.name, p]));
  const states = new Map(v.parts.map((p) => [p.name, animTransform(p, t, powered)]));
  const toParent = (part: AnimPart, p: V3): V3 => {
    const st = states.get(part.name)!;
    const local: V3 = [p[0] - part.pivot[0], p[1] - part.pivot[1], p[2] - part.pivot[2]];
    const r = rotEuler(local, st.rot);
    return [
      r[0] + part.pivot[0] + part.offset[0] + st.pos[0],
      r[1] + part.pivot[1] + part.offset[1] + st.pos[1],
      r[2] + part.pivot[2] + part.offset[2] + st.pos[2],
    ];
  };
  const pts: [number, number, number, number][] = [];
  (baseGrid ?? v.base.grid).forEach((x, y, z, c) => pts.push([x, y, z, c]));
  for (const part of v.parts) {
    const st = states.get(part.name)!;
    if (!st.visible) continue;
    let hidden = false;
    for (let p: AnimPart | undefined = part; p; p = p.parent ? byName.get(p.parent) : undefined)
      if (!states.get(p.name)!.visible) hidden = true;
    if (hidden) continue;
    const grid =
      part.requiresPower && !powered ? stagedGrid(part.model.grid, 1, false) : part.model.grid;
    grid.forEach((x, y, z, c) => {
      let p: V3 = [x + 0.5, y + 0.5, z + 0.5];
      for (let q: AnimPart | undefined = part; q; q = q.parent ? byName.get(q.parent) : undefined)
        p = toParent(q, p);
      pts.push([Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]), c]);
    });
  }
  let mx = 0,
    my = 0,
    mz = 0,
    Mx = 1,
    My = 1,
    Mz = 1;
  for (const [x, y, z] of pts) {
    mx = Math.min(mx, x);
    my = Math.min(my, y);
    mz = Math.min(mz, z);
    Mx = Math.max(Mx, x + 1);
    My = Math.max(My, y + 1);
    Mz = Math.max(Mz, z + 1);
  }
  const g = new VoxelGrid(Mx - mx, My - my, Mz - mz);
  for (const [x, y, z, c] of pts) g.set(x - mx, y - my, z - mz, c);
  return g;
}

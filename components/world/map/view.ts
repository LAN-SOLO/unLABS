/**
 * Map view math (pure): zoom level + centre in voxel coordinates, and the
 * SVG viewBox the floor is drawn into.
 */
import { FLOOR_SIZE } from "@/lib/world/content/map";
import { METRES_PER_VOXEL } from "@/components/world/map/theme";

export interface MapView {
  /** Zoom factor (1 = whole floor). */
  k: number;
  /** View centre (voxels). */
  cx: number;
  cz: number;
}

const MARGIN = 6;
/** viewBox in voxel units: the floor plus a margin for the compass and scale bar. */
export const VB = {
  x: -MARGIN,
  z: -MARGIN,
  w: FLOOR_SIZE.x + MARGIN * 2,
  h: FLOOR_SIZE.z + MARGIN * 2,
} as const;
export const VB_CX = VB.x + VB.w / 2;
export const VB_CZ = VB.z + VB.h / 2;
export const VIEWBOX = `${VB.x} ${VB.z} ${VB.w} ${VB.h}`;

export const K_MIN = 1;
export const K_MAX = 6;
export const HOME_VIEW: MapView = { k: 1, cx: VB_CX, cz: VB_CZ };

/** Keep the zoom in range and the centre over the floor. */
export function clampView(v: MapView): MapView {
  const k = Math.min(K_MAX, Math.max(K_MIN, v.k));
  // At zoom k the visible half-extent is VB.w / 2k; keep the floor under the view.
  const hx = VB.w / 2 / k;
  const hz = VB.h / 2 / k;
  const clamp = (c: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, c));
  return {
    k,
    cx: clamp(v.cx, VB.x + hx, VB.x + VB.w - hx),
    cz: clamp(v.cz, VB.z + hz, VB.z + VB.h - hz),
  };
}

/** viewBox units (screen-ish) → floor voxels under that point. */
export function unitToWorld(v: MapView, ux: number, uz: number): { x: number; z: number } {
  return { x: v.cx + (ux - VB_CX) / v.k, z: v.cz + (uz - VB_CZ) / v.k };
}

/** Zoom by `factor` keeping the voxel under (ux, uz) (viewBox units) in place. */
export function zoomAt(v: MapView, factor: number, ux = VB_CX, uz = VB_CZ): MapView {
  const k = Math.min(K_MAX, Math.max(K_MIN, v.k * factor));
  const p = unitToWorld(v, ux, uz);
  return clampView({
    k,
    cx: p.x - (p.x - v.cx) * (v.k / k),
    cz: p.z - (p.z - v.cz) * (v.k / k),
  });
}

/** Pan by a distance in viewBox units (e.g. a mouse drag). */
export function panBy(v: MapView, du: number, dv: number): MapView {
  return clampView({ k: v.k, cx: v.cx - du / v.k, cz: v.cz - dv / v.k });
}

/** Centre the view on a voxel (zooming in to at least `minK`). */
export function focusOn(v: MapView, x: number, z: number, minK = 2): MapView {
  return clampView({ k: Math.max(v.k, minK), cx: x, cz: z });
}

/** CSS transform of the zoomed layer (SVG user units). */
export function viewTransform(v: MapView): string {
  return `translate(${VB_CX}px, ${VB_CZ}px) scale(${v.k}) translate(${-v.cx}px, ${-v.cz}px)`;
}

/** Icons shrink a little less than the zoom grows (readable, not huge). */
export function iconScale(k: number): number {
  return 1 / Math.pow(k, 0.8);
}

/** Scale bar: a round number of metres that spans at most ~36 viewBox units. */
export function scaleBar(k: number): { metres: number; units: number } {
  const steps = [2, 5, 10, 20, 50];
  let pick = steps[0]!;
  for (const m of steps) if ((m / METRES_PER_VOXEL) * k <= 36) pick = m;
  return { metres: pick, units: (pick / METRES_PER_VOXEL) * k };
}

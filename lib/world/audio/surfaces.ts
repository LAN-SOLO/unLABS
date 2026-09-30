/**
 * What is under Jade's feet — floor spots from the interior decor.
 * ================================================================
 *
 * The room theme gives the base floor (`surfaceForTheme`); flat decor laid on
 * it changes the step: rugs are carpet, puddles / drips / oil / wet-floor
 * zones are water, broken glass crunches, rubble and dust are gravel,
 * floor cables and extension cords are cable, paper piles crinkle, hazard
 * mats and drone pads are rubber, empty pallets are wood.
 *
 * Cheap: one lazily built list of rectangles per floor (decor placements are
 * static), a linear scan per footstep (a few dozen rects per floor).
 */
import { interiorFor, placementRect, type DecorPlacement } from "@/lib/world/content/interior";
import type { Surface } from "@/lib/world/audio/sfx";
import type { FloorId } from "@/lib/world/types";

/** Decor id → the surface it lays over the floor (only floor-level pieces count). */
export const DECOR_SURFACE: Readonly<Record<string, Surface>> = {
  rug: "carpet",
  rug_round: "carpet",
  puddle: "water",
  water_drip: "water",
  oil_stain: "water",
  wet_floor_sign: "water",
  broken_glass: "glass",
  rubble_small: "gravel",
  rubble_heap: "gravel",
  dust_motes: "gravel",
  floor_cables: "cable",
  extension_cord: "cable",
  cable_loops: "cable",
  cable_spool: "cable",
  paper_pile: "paper",
  books_scattered: "paper",
  pizza_box: "paper",
  laundry_pile: "carpet",
  hazard_decal: "rubber",
  drone_pad: "rubber",
  pallet_empty: "wood",
};

/** Surfaces that win over each other when spots overlap (first = strongest). */
const PRIORITY: readonly Surface[] = [
  "water",
  "glass",
  "gravel",
  "paper",
  "cable",
  "rubber",
  "carpet",
  "wood",
];

/** Extra reach around a piece (a wet-floor sign marks a wet zone around it). */
const MARGIN: Readonly<Record<string, number>> = { wet_floor_sign: 2.5, water_drip: 1 };

export interface SurfaceSpot {
  surface: Surface;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  rank: number;
}

const cache = new Map<number, SurfaceSpot[]>();

/** Surface spots of a floor from its decor placements (cached). */
export function surfaceSpots(
  floor: FloorId,
  placements: (f: FloorId) => readonly DecorPlacement[] = interiorFor,
): SurfaceSpot[] {
  const hit = cache.get(floor);
  if (hit && placements === interiorFor) return hit;
  const out: SurfaceSpot[] = [];
  for (const p of placements(floor)) {
    const surface = DECOR_SURFACE[p.decor];
    if (!surface || p.host || (p.y ?? 0) > 0.5) continue;
    let r: ReturnType<typeof placementRect>;
    try {
      r = placementRect(p);
    } catch {
      continue;
    }
    // Shrink a little: stepping on the edge of a rug still sounds like the floor.
    const m = MARGIN[p.decor] ?? -0.2;
    const x0 = r.x0 - m;
    const x1 = r.x1 + m;
    const z0 = r.z0 - m;
    const z1 = r.z1 + m;
    if (x1 <= x0 || z1 <= z0) continue;
    out.push({ surface, x0, z0, x1, z1, rank: PRIORITY.indexOf(surface) });
  }
  // Strongest first: the first hit wins.
  out.sort((a, b) => a.rank - b.rank);
  if (placements === interiorFor) cache.set(floor, out);
  return out;
}

/** The spot surface at (x, z), or null when the plain floor shows. */
export function spotSurfaceAt(spots: readonly SurfaceSpot[], x: number, z: number): Surface | null {
  for (const s of spots) if (x >= s.x0 && x < s.x1 && z >= s.z0 && z < s.z1) return s.surface;
  return null;
}

/** Surface under the player: a decor spot if there is one, else the room floor. */
export function surfaceUnder(floor: FloorId, x: number, z: number, base: Surface): Surface {
  let spots: SurfaceSpot[];
  try {
    spots = surfaceSpots(floor);
  } catch {
    return base;
  }
  return spotSurfaceAt(spots, x, z) ?? base;
}

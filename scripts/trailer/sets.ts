/**
 * Trailer sets (docs/TRAILERS.md): which part of the lab each shot needs.
 * A set is one floor box around `rooms` (+ `margin` voxels), exported whole
 * by scripts/trailer/export.ts.
 */
import type { FloorId } from "@/lib/world/types";

export interface TrailerSet {
  id: string;
  floor: FloorId;
  rooms: string[];
  margin?: number;
  /** Devices left out (e.g. built on camera from the cast instead). */
  skipDevices?: string[];
}

export const TRAILER_SETS: readonly TrailerSet[] = [
  // L0 Upper Deck — "Wake" and the console.
  { id: "kontroll", floor: 0, rooms: ["kontroll"], margin: 2 },
  { id: "mcp", floor: 0, rooms: ["mcp"], margin: 2 },
  { id: "werkstatt", floor: 0, rooms: ["werkstatt"], margin: 2 },
  { id: "kartenraum", floor: 0, rooms: ["kartenraum"], margin: 2 },
  { id: "aufzug0", floor: 0, rooms: ["aufzug0"], margin: 3 },
  // L−1 Power & Fabrication.
  { id: "rechen", floor: 1, rooms: ["rechen"], margin: 2 },
  { id: "fertigung", floor: 1, rooms: ["fertigung"], margin: 2 },
  { id: "aufzug1", floor: 1, rooms: ["aufzug1"], margin: 3 },
  // L−2 Signals & Anomalies.
  { id: "signal", floor: 2, rooms: ["signal"], margin: 2 },
  { id: "anomalie", floor: 2, rooms: ["anomalie"], margin: 2 },
  { id: "botdepot", floor: 2, rooms: ["botdepot"], margin: 2 },
  { id: "aufzug2", floor: 2, rooms: ["aufzug2"], margin: 3 },
  // L−3 Deep Lab.
  { id: "forge", floor: 3, rooms: ["forge"], margin: 2 },
  { id: "reaktor", floor: 3, rooms: ["reaktor"], margin: 2 },
  { id: "aufzug3", floor: 3, rooms: ["aufzug3"], margin: 3 },
  // L+1 Living Quarters.
  { id: "jadeq", floor: 4, rooms: ["jadeq"], margin: 2 },
  { id: "damienq", floor: 4, rooms: ["damienq"], margin: 2 },
  { id: "observatorium", floor: 4, rooms: ["observatorium"], margin: 2 },
  { id: "funkraum", floor: 4, rooms: ["funkraum"], margin: 2 },
  { id: "aufzug4", floor: 4, rooms: ["aufzug4"], margin: 3 },
  // L−4 The Shaft.
  { id: "aufzug5", floor: 5, rooms: ["aufzug5"], margin: 3 },
  { id: "hoehle", floor: 5, rooms: ["hoehle"], margin: 2 },
  { id: "bohrung", floor: 5, rooms: ["bohrung"], margin: 2 },
  { id: "x9kammer", floor: 5, rooms: ["x9kammer"], margin: 2 },
];

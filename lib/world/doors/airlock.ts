/**
 * Airlocks — interlocked door pairs with a steam and extraction chamber
 * (pure). docs/DOORS.md.
 * ====================================================================
 *
 * The data center (Level −1) is reached through an airlock in its passage:
 * the outer door `d_rechen_schleuse`, a chamber of 5 × 4 cells, the inner
 * door `d_rechen`. The pair never stands open at the same time. Whoever
 * steps deep into the chamber is sealed in: both doors close, nozzles blow
 * hot steam (STEAM_S), the floor grate and the hood pull the steam and the
 * dust off (EXTRACT_S), then the far door releases. The clean side never
 * gathers dust (`CLEAN_ROOMS`, lib/world/aging.ts).
 *
 * `stepAirlock` is the controller: from Jade's position and the doors'
 * opening amounts it says which door may open and which events start (the
 * engine plays steam, extraction and the release). Never traps: in the
 * chamber the near door stays usable until she is deep inside, and after
 * the cycle either door may open (one at a time).
 */
import type { DoorDef, FloorId } from "@/lib/world/types";

export interface AirlockDef {
  id: string;
  floor: FloorId;
  /** Door on the dirty side. */
  outer: string;
  /** Door on the clean side. */
  inner: string;
  /** Room kept clean (no dust). */
  clean: string;
  /** Chamber cells (inclusive, world voxels). */
  chamber: { x0: number; z0: number; x1: number; z1: number };
}

export const AIRLOCKS: readonly AirlockDef[] = [
  {
    id: "schleuse_rechen",
    floor: 1,
    outer: "d_rechen_schleuse",
    inner: "d_rechen",
    clean: "rechen",
    chamber: { x0: 30, z0: 100, x1: 34, z1: 103 },
  },
];

export const AIRLOCK_BY_ID: ReadonlyMap<string, AirlockDef> = new Map(
  AIRLOCKS.map((a) => [a.id, a]),
);

/** Rooms an airlock keeps free of dust. */
export const CLEAN_ROOMS: readonly string[] = AIRLOCKS.map((a) => a.clean);

/** Seconds of hot steam, then of extraction. */
export const STEAM_S = 1.8;
export const EXTRACT_S = 1.6;
/** Distance (world units) from both door lines that counts as "deep in the chamber" (past the doorway clearance, render/doors.ts `inDoorway`). */
export const DEEP = 1.85;

export type AirlockPhase = "idle" | "steam" | "extract" | "release";
export type AirlockSide = "outer" | "inner" | "chamber";
export type AirlockEvent = "seal" | "steam" | "extract" | "release" | "cleared";

export interface AirlockState {
  phase: AirlockPhase;
  /** Seconds in the current phase. */
  t: number;
  /** Side Jade came from before entering the chamber. */
  from: "outer" | "inner" | null;
  /** Completed cycles (for the interface). */
  cycles: number;
}

export function initialAirlock(): AirlockState {
  return { phase: "idle", t: 0, from: null, cycles: 0 };
}

export interface AirlockInput {
  /** Jade's position (world x, z). */
  x: number;
  z: number;
  /** Doors' opening amounts 0..1. */
  outerOpen: number;
  innerOpen: number;
}

export interface AirlockOutput {
  allowOuter: boolean;
  allowInner: boolean;
  events: AirlockEvent[];
}

/** Coordinate across the doors (the doors share an axis). */
function across(d: Pick<DoorDef, "axis">, x: number, z: number): number {
  return d.axis === "x" ? z : x;
}

/** Which side of the airlock (x, z) is on, and how far from the nearest door line. */
export function airlockSide(
  def: AirlockDef,
  outer: Pick<DoorDef, "x" | "z" | "axis">,
  inner: Pick<DoorDef, "x" | "z" | "axis">,
  x: number,
  z: number,
): { side: AirlockSide; depth: number } {
  const o = across(outer, outer.x + 0.5, outer.z + 0.5);
  const i = across(inner, inner.x + 0.5, inner.z + 0.5);
  const p = across(outer, x, z);
  const dir = Math.sign(i - o) || 1;
  const t = (p - o) * dir; // 0 at the outer door line, |i − o| at the inner
  const span = Math.abs(i - o);
  const c = def.chamber;
  const along = outer.axis === "x" ? x : z;
  const a0 = outer.axis === "x" ? c.x0 : c.z0;
  const a1 = outer.axis === "x" ? c.x1 + 1 : c.z1 + 1;
  if (t <= 0 || along < a0 - 1 || along > a1 + 1) return { side: "outer", depth: 0 };
  if (t >= span) return { side: "inner", depth: 0 };
  return { side: "chamber", depth: Math.min(t, span - t) };
}

const CLOSED = 0.001;

/** Advance the airlock by dt seconds (mutates `st`). */
export function stepAirlock(
  st: AirlockState,
  def: AirlockDef,
  outer: Pick<DoorDef, "x" | "z" | "axis">,
  inner: Pick<DoorDef, "x" | "z" | "axis">,
  inp: AirlockInput,
  dt: number,
): AirlockOutput {
  const events: AirlockEvent[] = [];
  const { side, depth } = airlockSide(def, outer, inner, inp.x, inp.z);
  const outerClosed = inp.outerOpen <= CLOSED;
  const innerClosed = inp.innerOpen <= CLOSED;
  const deep = side === "chamber" && depth >= DEEP;
  st.t += dt;
  if (side !== "chamber" && st.phase !== "steam" && st.phase !== "extract") st.from = side;

  // The cycle runs on its own once sealed.
  if (st.phase === "steam" && st.t >= STEAM_S) {
    st.phase = "extract";
    st.t = 0;
    events.push("extract");
  } else if (st.phase === "extract" && st.t >= EXTRACT_S) {
    st.phase = "release";
    st.t = 0;
    st.cycles++;
    events.push("release");
  }
  if (st.phase === "idle" && deep && outerClosed && innerClosed) {
    st.phase = "steam";
    st.t = 0;
    events.push("seal", "steam");
  }
  if (st.phase === "release" && side !== "chamber") {
    st.phase = "idle";
    st.t = 0;
    events.push("cleared");
  }

  // Interlock: a door may open only while the other one is fully closed.
  let allowOuter = false;
  let allowInner = false;
  if (st.phase === "steam" || st.phase === "extract") {
    // Sealed.
  } else if (side === "outer") allowOuter = innerClosed;
  else if (side === "inner") allowInner = outerClosed;
  else if (st.phase === "release") {
    // After the cycle: the far door first; either one, never both.
    const nearOuter = across(outer, inp.x, inp.z);
    const toOuter = Math.abs(nearOuter - across(outer, outer.x + 0.5, outer.z + 0.5));
    const toInner = Math.abs(nearOuter - across(inner, inner.x + 0.5, inner.z + 0.5));
    const exitInner = st.from !== "inner";
    if (exitInner ? toInner <= toOuter + 1.5 : toInner < toOuter - 1.5) allowInner = outerClosed;
    else allowOuter = innerClosed;
  } else if (!deep) {
    // Stepping in or out: the door she is next to stays usable (if the other is shut).
    const p = across(outer, inp.x, inp.z);
    const toOuter = Math.abs(p - across(outer, outer.x + 0.5, outer.z + 0.5));
    const toInner = Math.abs(p - across(inner, inner.x + 0.5, inner.z + 0.5));
    if (toOuter <= toInner) allowOuter = innerClosed;
    else allowInner = outerClosed;
  }
  return { allowOuter, allowInner, events };
}

/** The airlock a door belongs to. */
export function airlockOf(d: Pick<DoorDef, "airlock">): AirlockDef | undefined {
  return d.airlock ? AIRLOCK_BY_ID.get(d.airlock) : undefined;
}

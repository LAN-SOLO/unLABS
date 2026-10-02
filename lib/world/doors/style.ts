/**
 * Door styles — every door in the lab has its own shape and its own locking
 * mechanism (pure, deterministic). docs/DOORS.md.
 * ===================================================================
 *
 * A style is the door's shape (how it moves, the profile of the meeting
 * edge, window, panel pattern, frame silhouette, paint) plus its locking
 * mechanism (bolts, vault wheel, clamps, …) with a variant that sets count
 * and placement. `doorStyle(id)` is fixed for the life of the game: styles
 * are assigned once over all doors, in id order, so that no two doors share
 * a shape and no two share a mechanism (tests/world/door-styles.test.ts).
 *
 * The collision of every style is the same (the 5-cell opening, passable at
 * DOOR_PASSABLE_AT) — the styles are the look and the motion only.
 */
import { tr } from "@/lib/i18n";
import { C } from "@/lib/world/content/palette";
import { DOORS } from "@/lib/world/content/map";
import { fnv1a } from "@/lib/world/traits";
import type { DoorDef } from "@/lib/world/types";

/** How the door opens. */
export type DoorMotion =
  /** Two leaves slide into the wall. */
  | "split"
  /** Four segments: the lower pair slides first, the upper pair follows. */
  | "stagger"
  /** Two leaves swing out on hinges at the jambs. */
  | "swing"
  /** A slatted curtain rolls up into the header. */
  | "shutter";

/** Profile of the meeting edge of the two leaves (split / stagger / swing). */
export type DoorEdge = "straight" | "stepped" | "toothed" | "diagonal" | "wave";
export type DoorWindow = "none" | "slit" | "porthole" | "grid" | "twin";
export type DoorPattern = "chevron" | "ribs" | "diamond" | "panels" | "honeycomb" | "plain";
/** Frame silhouette; chamfer / arch also cut the top corners of the leaves. */
export type DoorFrame = "square" | "chamfer" | "arch" | "vault" | "slim";

/** The locking mechanism that engages every time the door closes. */
export type MechKind =
  | "bolts"
  | "wheel"
  | "clamps"
  | "pins"
  | "magnet"
  | "crossbar"
  | "cam"
  | "pistons";

/** Mechanism variants (count / placement), 0 … MECH_VARIANTS − 1. */
export const MECH_VARIANTS = 9;

export interface DoorStyle {
  id: string;
  motion: DoorMotion;
  edge: DoorEdge;
  window: DoorWindow;
  pattern: DoorPattern;
  frame: DoorFrame;
  /** Leaf paint (palette index). */
  paint: number;
  /** Trim / rim colour (palette index). */
  trim: number;
  mech: MechKind;
  mechVariant: number;
}

export const MOTIONS: readonly DoorMotion[] = ["split", "stagger", "swing", "shutter"];
export const EDGES: readonly DoorEdge[] = ["straight", "stepped", "toothed", "diagonal", "wave"];
export const WINDOWS: readonly DoorWindow[] = ["none", "slit", "porthole", "grid", "twin"];
export const PATTERNS: readonly DoorPattern[] = [
  "chevron",
  "ribs",
  "diamond",
  "panels",
  "honeycomb",
  "plain",
];
export const FRAMES: readonly DoorFrame[] = ["square", "chamfer", "arch", "vault", "slim"];
export const MECHS: readonly MechKind[] = [
  "bolts",
  "wheel",
  "clamps",
  "pins",
  "magnet",
  "crossbar",
  "cam",
  "pistons",
];

const PAINTS: readonly number[] = [
  C.door_panel,
  C.paint_navy,
  C.paint_teal,
  C.olive,
  C.paint_gray,
  C.paint_black,
  C.red_paint,
  C.blue_paint,
  C.green_paint,
  C.orange_paint,
  C.paint_cream,
  C.steel_dark,
];
const TRIMS: readonly number[] = [C.metal_dark, C.steel, C.brass, C.copper, C.chrome];

/**
 * Doors with a designed look (not drawn from the pool): the airlock pair is
 * clean-room white with portholes and pistons, secret doors keep their
 * flush wall disguise and get a hidden magnetic lock.
 */
const FIXED: Readonly<Record<string, Partial<DoorStyle>>> = {
  d_rechen_schleuse: {
    motion: "split",
    edge: "straight",
    window: "porthole",
    pattern: "ribs",
    frame: "vault",
    paint: C.paint_white,
    trim: C.chrome,
    mech: "pistons",
  },
  d_rechen: {
    motion: "split",
    edge: "stepped",
    window: "porthole",
    pattern: "ribs",
    frame: "vault",
    paint: C.paint_white,
    trim: C.chrome,
    mech: "clamps",
  },
};

export const shapeKey = (s: DoorStyle): string =>
  `${s.motion}|${s.edge}|${s.window}|${s.pattern}|${s.frame}`;
export const mechKey = (s: DoorStyle): string => `${s.mech}#${s.mechVariant}`;

/** Edges only matter where two leaves meet. */
function edgeFor(motion: DoorMotion, e: DoorEdge): DoorEdge {
  return motion === "shutter" ? "straight" : e;
}

function assign(doors: readonly DoorDef[]): Map<string, DoorStyle> {
  const out = new Map<string, DoorStyle>();
  const shapes = new Set<string>();
  const mechs = new Set<string>();
  const ordered = [...doors].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // Designed doors first, so the pool never takes their look.
  ordered.sort((a, b) => Number(!FIXED[a.id]) - Number(!FIXED[b.id]));
  for (const d of ordered) {
    const h = fnv1a(`door-style:${d.id}`);
    const fixed = FIXED[d.id] ?? {};
    // Secret doors: flush wall leaves that split, a lock nobody sees.
    const secret = d.secret
      ? ({
          motion: "split",
          edge: "straight",
          window: "none",
          pattern: "plain",
          frame: "square",
          mech: "magnet",
        } as const)
      : {};
    let style: DoorStyle | null = null;
    // Walk the combination space from the door's hash until the shape is free.
    for (let k = 0; k < 4000 && !style; k++) {
      const n = h + k * 2654435761;
      const motion = fixed.motion ?? secret.motion ?? MOTIONS[n % MOTIONS.length]!;
      const cand: DoorStyle = {
        id: d.id,
        motion,
        edge: fixed.edge ?? secret.edge ?? edgeFor(motion, EDGES[(n >>> 3) % EDGES.length]!),
        window: fixed.window ?? secret.window ?? WINDOWS[(n >>> 7) % WINDOWS.length]!,
        pattern: fixed.pattern ?? secret.pattern ?? PATTERNS[(n >>> 11) % PATTERNS.length]!,
        frame: fixed.frame ?? secret.frame ?? FRAMES[(n >>> 15) % FRAMES.length]!,
        paint: fixed.paint ?? PAINTS[(n >>> 19) % PAINTS.length]!,
        trim: fixed.trim ?? TRIMS[(n >>> 23) % TRIMS.length]!,
        mech: MECHS[0]!,
        mechVariant: 0,
      };
      // Secret doors are all flush wall: their shape is the wall, not the pool.
      if (!d.secret && shapes.has(shapeKey(cand))) continue;
      style = cand;
    }
    if (!style) throw new Error(`no free door shape for ${d.id}`);
    // The mechanism: its own kind + variant, never shared.
    const m0 = fnv1a(`door-mech:${d.id}`);
    for (let k = 0; k < MECHS.length * MECH_VARIANTS; k++) {
      const n = m0 + k * 40503;
      const mech = fixed.mech ?? secret.mech ?? MECHS[n % MECHS.length]!;
      const variant = (n >>> 5) % MECH_VARIANTS;
      const key = `${mech}#${variant}`;
      if (mechs.has(key)) continue;
      style.mech = mech;
      style.mechVariant = variant;
      break;
    }
    if (mechs.has(mechKey(style))) throw new Error(`no free door mechanism for ${d.id}`);
    shapes.add(shapeKey(style));
    mechs.add(mechKey(style));
    out.set(d.id, style);
  }
  return out;
}

let STYLES: Map<string, DoorStyle> | null = null;

/** Every door's style (assigned once, lazily). */
export function doorStyles(): ReadonlyMap<string, DoorStyle> {
  return (STYLES ??= assign(DOORS));
}

export function doorStyle(id: string): DoorStyle {
  const s = doorStyles().get(id);
  if (!s) throw new Error(`unknown door ${id}`);
  return s;
}

/** Test hook: assign styles for another door list. */
export function assignDoorStyles(doors: readonly DoorDef[]): Map<string, DoorStyle> {
  return assign(doors);
}

// ── Labels (door interface) ─────────────────────────────────────

export const MOTION_LABEL: Record<DoorMotion, () => string> = {
  split: () => tr("sliding pair"),
  stagger: () => tr("staggered four-leaf"),
  swing: () => tr("swing pair"),
  shutter: () => tr("roll-up shutter"),
};

export const MECH_LABEL: Record<MechKind, () => string> = {
  bolts: () => tr("Throw bolts"),
  wheel: () => tr("Vault wheel"),
  clamps: () => tr("Jamb clamps"),
  pins: () => tr("Drop pins"),
  magnet: () => tr("Magnetic seal"),
  crossbar: () => tr("Cross bar"),
  cam: () => tr("Cam latch"),
  pistons: () => tr("Hydraulic pistons"),
};

export const MECH_TEXT: Record<MechKind, () => string> = {
  bolts: () => tr("Steel bolts shoot across the meeting edge and pull back into the leaf."),
  wheel: () =>
    tr("A wheel turns the lugs into the frame — a quarter turn locks, a quarter turn frees."),
  clamps: () => tr("Clamps on both jambs swing over the leaves and press them into the seal."),
  pins: () => tr("Pins drop from the header into the leaves; they lift before the door moves."),
  magnet: () =>
    tr("Electromagnets hold the leaves together. When the strip goes dark, it is free."),
  crossbar: () => tr("A bar drops across both leaves into its brackets and swings up to release."),
  cam: () => tr("Cam discs on the meeting edge turn their hooks into each other."),
  pistons: () => tr("Hydraulic rams press the leaves shut and retract with a hiss."),
};

/** Parts count of a mechanism variant (bolts, pins, clamps, pistons …): 2 … 4. */
/** Variants 6…8: doubled on both leaves / both faces (heavier build). */
export function mechHeavy(s: Pick<DoorStyle, "mechVariant">): boolean {
  return s.mechVariant >= 6;
}

export function mechCount(s: Pick<DoorStyle, "mechVariant">): number {
  return 2 + (s.mechVariant % 3);
}

/** Variants 3…5 and 6…8: the mechanism sits high (header side) instead of low. */
export function mechHigh(s: Pick<DoorStyle, "mechVariant">): boolean {
  return Math.floor(s.mechVariant / 3) % 2 === 1;
}

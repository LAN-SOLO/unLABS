/**
 * Styled door models — leaves, frames, locking mechanisms and the lock
 * interface panel for every door style (pure, no three). docs/DOORS.md.
 * ===================================================================
 *
 * Conventions as in models/doors.ts: DOOR_SCALE (4 voxels per world unit),
 * door-local frame with x along the wall, the opening x ∈ [−2.5, 2.5],
 * y ∈ [0, 6]. The closed door is drawn as ONE panel (20 × 24 voxels,
 * LEAF_D deep) — paint, pattern, window, rim — then cut into the pieces the
 * style moves: two leaves along the meeting-edge profile (split, swing),
 * four segments (stagger) or six slats (shutter). Frame silhouettes
 * (chamfer, arch) cut the panel's top corners and fill the frame there.
 *
 * Mechanism parts are separate small models with a release motion; the
 * engine (render/doors.ts) poses them from an engage amount e (1 = locked,
 * 0 = released) before the leaves move and after they close.
 */
import { C } from "@/lib/world/content/palette";
import { Model } from "@/lib/world/models/core";
import { hash3 } from "@/lib/world/models/anim";
import {
  FRAME_D,
  FRAME_H,
  FRAME_W,
  HEADER_Y,
  JAMB_W,
  LEAF_D,
  LEAF_H,
  LEAF_W,
  type DoorLight,
} from "@/lib/world/models/doors";
import {
  mechCount,
  mechHeavy,
  mechHigh,
  type DoorEdge,
  type DoorFrame,
  type DoorStyle,
} from "@/lib/world/doors/style";

/** Closed panel (both leaves) in voxels. */
export const PANEL_W = LEAF_W * 2;
export const PANEL_H = LEAF_H;
/** Leaf crops are wider than a half panel so profiled edges fit (2 voxels of slack). */
export const LEAF_CROP_W = LEAF_W + 2;
/** Shutter slats. */
export const SLATS = 6;
export const SLAT_H = PANEL_H / SLATS;
/** World units per voxel (DOOR_SCALE). */
const U = 0.25;

const LIGHT: Record<DoorLight, number> = {
  green: C.led_green,
  amber: C.led_amber,
  red: C.led_red,
};

// ── Opening silhouette ───────────────────────────────────────────

/** Is panel cell (x, y) inside the opening of this frame shape? */
export function inOpening(frame: DoorFrame, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= PANEL_W || y >= PANEL_H) return false;
  const top = PANEL_H - 1 - y;
  const fromEdge = Math.min(x, PANEL_W - 1 - x);
  if (frame === "chamfer") return fromEdge + top >= 4;
  if (frame === "arch") {
    const r = 7;
    if (fromEdge >= r || top >= r) return true;
    return Math.hypot(r - fromEdge - 0.5, r - top - 0.5) <= r;
  }
  return true;
}

/** Panel x where the right leaf starts in row y (the meeting-edge profile). */
export function splitX(edge: DoorEdge, y: number): number {
  const mid = LEAF_W;
  switch (edge) {
    case "straight":
      return mid;
    case "stepped":
      return y < PANEL_H / 2 ? mid - 1 : mid + 1;
    case "toothed":
      return mid + ((y >> 1) % 2 ? 1 : -1);
    case "diagonal":
      return mid - 2 + Math.round((y * 4) / (PANEL_H - 1));
    case "wave":
      return mid + Math.round(1.6 * Math.sin((y / PANEL_H) * Math.PI * 2));
  }
}

// ── Panel ────────────────────────────────────────────────────────

function setFaces(m: Model, x: number, y: number, c: number): void {
  if (!m.grid.get(x, y, 0) && !m.grid.get(x, y, m.d - 1)) return;
  m.set(x, y, 0, c).set(x, y, m.d - 1, c);
}

function carveFaces(m: Model, x: number, y: number, core: number): void {
  if (!m.grid.get(x, y, 1)) return;
  m.set(x, y, 0, 0)
    .set(x, y, m.d - 1, 0)
    .set(x, y, 1, core);
}

function patternAt(style: DoorStyle, x: number, y: number): number | null {
  switch (style.pattern) {
    case "chevron":
      if (y > 4) return null;
      return (((Math.abs(x - LEAF_W + 0.5) | 0) + y) >> 1) & 1 ? C.hazard_black : C.safety_yellow;
    case "ribs":
      return y % 4 === 1 ? style.trim : null;
    case "diamond":
      return (x + y) % 4 === 0 || (x - y + 64) % 4 === 0 ? C.steel_dark : null;
    case "panels":
      return null;
    case "honeycomb": {
      const row = Math.floor(y / 3);
      const off = row % 2 ? 2 : 0;
      return y % 3 === 0 || (x + off) % 4 === 0 ? C.steel_dark : null;
    }
    case "plain":
      return null;
  }
}

/**
 * The closed door as one panel: paint, pattern, recessed panels, window,
 * status strip, rim along the opening silhouette.
 */
export function doorPanelModel(style: DoorStyle, light: DoorLight): Model {
  const m = new Model(PANEL_W, PANEL_H, LEAF_D);
  for (let y = 0; y < PANEL_H; y++)
    for (let x = 0; x < PANEL_W; x++)
      if (inOpening(style.frame, x, y))
        for (let z = 0; z < LEAF_D; z++) m.set(x, y, z, style.paint);
  // Pattern on both faces.
  for (let y = 0; y < PANEL_H; y++)
    for (let x = 0; x < PANEL_W; x++) {
      const c = patternAt(style, x, y);
      if (c !== null) setFaces(m, x, y, c);
    }
  if (style.pattern === "panels")
    for (const [x0, x1] of [
      [2, LEAF_W - 3],
      [LEAF_W + 2, PANEL_W - 3],
    ] as const)
      for (const [y0, y1] of [
        [3, 9],
        [13, 20],
      ] as const)
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) carveFaces(m, x, y, C.steel_dark);
  // Window(s).
  const glass = (x: number, y: number) => {
    if (!inOpening(style.frame, x, y)) return;
    m.set(x, y, 0, 0)
      .set(x, y, LEAF_D - 1, 0)
      .set(x, y, 1, C.glass);
  };
  const frameRing = (x: number, y: number) => setFaces(m, x, y, style.trim);
  switch (style.window) {
    case "slit":
      for (const cx of [5, PANEL_W - 6])
        for (let y = 15; y <= 18; y++)
          for (let x = cx - 2; x <= cx + 2; x++)
            if (y === 15 || y === 18 || Math.abs(x - cx) === 2) frameRing(x, y);
            else glass(x, y);
      break;
    case "porthole":
      for (const cx of [4.5, PANEL_W - 5.5])
        for (let y = 12; y <= 21; y++)
          for (let x = Math.floor(cx - 4); x <= Math.ceil(cx + 4); x++) {
            const d = Math.hypot(x - cx, y - 16.5);
            if (d <= 2.6) glass(x, y);
            else if (d <= 3.6) frameRing(x, y);
          }
      break;
    case "grid":
      for (let y = 14; y <= 20; y++)
        for (let x = 3; x <= PANEL_W - 4; x++) {
          if (x >= LEAF_W - 2 && x <= LEAF_W + 1) continue;
          if (y === 14 || y === 20 || x % 3 === 0) frameRing(x, y);
          else glass(x, y);
        }
      break;
    case "twin":
      for (const cx of [3, 6, PANEL_W - 7, PANEL_W - 4])
        for (let y = 13; y <= 20; y++) {
          if (y === 13 || y === 20) frameRing(cx, y);
          else glass(cx, y);
        }
      break;
    case "none":
      break;
  }
  // Status strip across the panel (light colour), dark caps.
  for (let x = 1; x < PANEL_W - 1; x++) setFaces(m, x, 11, LIGHT[light]);
  // Rim along the silhouette (outer edge + top), hazard kick plate.
  for (let y = 0; y < PANEL_H; y++)
    for (let x = 0; x < PANEL_W; x++) {
      if (!m.grid.get(x, y, 1)) continue;
      const edge =
        !inOpening(style.frame, x - 1, y) ||
        !inOpening(style.frame, x + 1, y) ||
        !inOpening(style.frame, x, y + 1);
      if (edge) for (let z = 0; z < LEAF_D; z++) m.set(x, y, z, C.metal_dark);
    }
  for (let x = 0; x < PANEL_W; x++) setFaces(m, x, 0, C.metal_dark);
  // Wear: a few scuffs low on the faces.
  for (let x = 1; x < PANEL_W - 1; x++)
    for (let y = 1; y <= 3; y++)
      if (hash3(x, y, style.paint & 0xff) < 0.12) setFaces(m, x, y, C.steel_dark);
  return m;
}

// ── Pieces ───────────────────────────────────────────────────────

export type PieceRole = "left" | "right" | "leftUpper" | "rightUpper" | `slat${number}`;

export interface DoorPiece {
  role: PieceRole;
  model: Model;
  /**
   * Door-local position (world units) of the model's own origin
   * convention — centre of its x/z extent, y = 0 at its bottom — with the
   * door closed.
   */
  at: [number, number, number];
}

function cropMask(
  src: Model,
  x0: number,
  y0: number,
  w: number,
  h: number,
  keep: (x: number, y: number) => boolean,
): Model {
  const out = new Model(w, h, src.d);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!keep(x0 + x, y0 + y)) continue;
      for (let z = 0; z < src.d; z++) {
        const v = src.grid.get(x0 + x, y0 + y, z);
        if (v) out.set(x, y, z, v);
      }
    }
  return out;
}

/** Gasket on the meeting edge: the cells of a leaf that touch the other leaf. */
function gasket(m: Model, touches: (x: number, y: number) => boolean): void {
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++)
      if (m.grid.get(x, y, 1) && touches(x, y)) {
        for (let z = 0; z < m.d; z++) m.set(x, y, z, C.rubber);
        if (y % 4 === 2) m.set(x, y, 0, C.hazard_black).set(x, y, m.d - 1, C.hazard_black);
      }
}

/** The moving pieces of a closed door (models + their closed positions). */
export function doorPieces(style: DoorStyle, light: DoorLight): DoorPiece[] {
  const panel = doorPanelModel(style, light);
  const px = (x: number) => (x - PANEL_W / 2) * U; // panel x → door-local x (left edge of cell)
  if (style.motion === "shutter") {
    const out: DoorPiece[] = [];
    for (let i = 0; i < SLATS; i++) {
      const slat = cropMask(panel, 0, i * SLAT_H, PANEL_W, SLAT_H, () => true);
      // Hinge seam on top of every slat.
      for (let x = 0; x < PANEL_W; x++)
        if (slat.grid.get(x, SLAT_H - 1, 1))
          slat.set(x, SLAT_H - 1, 0, C.steel).set(x, SLAT_H - 1, LEAF_D - 1, C.steel);
      out.push({ role: `slat${i}`, model: slat, at: [0, i * SLAT_H * U, 0] });
    }
    return out;
  }
  const split = (y: number) => splitX(style.edge, y);
  const left = (x: number, y: number) => x < split(y);
  const right = (x: number, y: number) => x >= split(y);
  const lx0 = 0;
  const rx0 = PANEL_W - LEAF_CROP_W;
  const cut = (x0: number, keep: (x: number, y: number) => boolean, y0: number, h: number) => {
    const m = cropMask(panel, x0, y0, LEAF_CROP_W, h, keep);
    gasket(m, (x, y) => {
      const gx = x0 + x;
      const gy = y0 + y;
      return keep === left ? !left(gx + 1, gy) : !right(gx - 1, gy);
    });
    return m;
  };
  const cx = (x0: number) => px(x0) + (LEAF_CROP_W * U) / 2;
  if (style.motion === "stagger") {
    const h = PANEL_H / 2;
    return [
      { role: "left", model: cut(lx0, left, 0, h), at: [cx(lx0), 0, 0] },
      { role: "right", model: cut(rx0, right, 0, h), at: [cx(rx0), 0, 0] },
      { role: "leftUpper", model: cut(lx0, left, h, h), at: [cx(lx0), h * U, 0] },
      { role: "rightUpper", model: cut(rx0, right, h, h), at: [cx(rx0), h * U, 0] },
    ];
  }
  return [
    { role: "left", model: cut(lx0, left, 0, PANEL_H), at: [cx(lx0), 0, 0] },
    { role: "right", model: cut(rx0, right, 0, PANEL_H), at: [cx(rx0), 0, 0] },
  ];
}

// ── Frame ────────────────────────────────────────────────────────

/**
 * Styled surround: the frame silhouette fills the opening's cut corners,
 * jamb faces by style (hazard stripes, paint, heavy vault ring), header
 * band in the trim colour, a roll drum for shutters.
 */
export function styledFrameModel(style: DoorStyle): Model {
  const W = FRAME_W;
  const H = FRAME_H;
  const D = FRAME_D;
  const m = new Model(W, H, D);
  const R = W - 1;
  const body = style.frame === "vault" ? C.metal_dark : C.steel_dark;
  m.box(0, 0, 0, JAMB_W - 1, H - 1, D - 1, body);
  m.box(R - JAMB_W + 1, 0, 0, R, H - 1, D - 1, body);
  m.box(0, HEADER_Y, 0, R, H - 1, D - 1, body);
  // Cut corners of the opening (panel x = frame x − 4).
  for (let y = 0; y < HEADER_Y; y++)
    for (let x = JAMB_W - 1; x <= R - JAMB_W + 1; x++)
      if (!inOpening(style.frame, x - 4, y)) m.box(x, y, 0, x, y, D - 1, body);
  const faces = (x: number, y: number, c: number) => m.set(x, y, 0, c).set(x, y, D - 1, c);
  // Jamb faces.
  for (const [a, b] of [
    [1, 3],
    [R - 3, R - 1],
  ] as const)
    for (let y = 0; y < HEADER_Y; y++)
      for (let x = a; x <= b; x++) {
        let c: number;
        if (style.frame === "slim") c = style.paint;
        else if (style.frame === "vault") c = y % 6 === 2 ? style.trim : C.steel;
        else c = (((x + y) >> 1) & 1) === 0 ? C.safety_yellow : C.hazard_black;
        faces(x, y, c);
      }
  for (const x of [0, R]) for (let y = 0; y < H; y++) faces(x, y, C.metal);
  // Vault ring: lugs around the opening.
  if (style.frame === "vault")
    for (let y = 2; y < HEADER_Y; y += 5) {
      faces(JAMB_W - 1, y, C.chrome);
      faces(R - JAMB_W + 1, y, C.chrome);
    }
  // Guide slots where leaves run (sliding motions).
  if (style.motion === "split" || style.motion === "stagger")
    for (const x of [JAMB_W - 1, R - JAMB_W + 1])
      for (let y = 0; y < HEADER_Y; y++)
        if (inOpening(style.frame, x - 4 + (x < W / 2 ? 1 : -1), y))
          for (let z = 2; z <= 3; z++) m.set(x, y, z, C.black);
  // Header band, edge, rivets.
  for (let x = 0; x <= R; x++) {
    faces(x, HEADER_Y, C.metal_dark);
    for (let y = HEADER_Y + 1; y < H - 1; y++)
      faces(x, y, style.frame === "slim" ? style.paint : style.trim);
    faces(x, H - 1, C.metal_light);
  }
  for (const u of [1, 5, 22, 26]) faces(u, HEADER_Y + 2, C.chrome);
  // Shutter: roll drum across the header with slat lines, and the curtain slot.
  if (style.motion === "shutter") {
    for (let x = JAMB_W; x <= R - JAMB_W; x++) {
      for (let y = HEADER_Y + 1; y <= HEADER_Y + 3; y++)
        faces(x, y, x % 2 ? C.steel : C.steel_dark);
      m.set(x, HEADER_Y, 2, C.black).set(x, HEADER_Y, 3, C.black);
    }
  }
  // Placard + cable conduit.
  for (let x = 19; x <= 21; x++)
    for (let y = HEADER_Y + 1; y <= HEADER_Y + 2; y++) faces(x, y, C.paint_white);
  faces(20, HEADER_Y + 2, C.paint_black);
  for (let u = 2; u <= R - 2; u++) if (u % 6 !== 0) m.set(u, H - 1, 0, C.cable_black);
  return m;
}

// ── Locking mechanisms ───────────────────────────────────────────

/** How a mechanism part moves from locked (e = 1) to released (e = 0). */
export type MechMotion =
  | { type: "slide"; axis: "x" | "y" | "z"; by: number }
  | { type: "rotate"; axis: "x" | "y" | "z"; by: number; pivot: [number, number, number] }
  | { type: "fade" };

export interface MechPart {
  /** Where it rides: the door frame ("root") or a moving piece. */
  on: "root" | PieceRole;
  model: Model;
  /** Door-local position (closed door, locked), model origin as in DoorPiece. */
  at: [number, number, number];
  release: MechMotion;
}

const FACE_Z = (LEAF_D / 2) * U + 0.5 * U; // a voxel proud of a leaf face

function block(w: number, h: number, d: number, c: number): Model {
  const m = new Model(w, h, d);
  m.box(0, 0, 0, w - 1, h - 1, d - 1, c);
  return m;
}

/** Leaf a point at door-local x belongs to (closed door), for parts riding a leaf. */
function leafAt(style: DoorStyle, x: number, y: number): PieceRole {
  if (style.motion === "shutter") return `slat${Math.min(SLATS - 1, Math.floor(y / (SLAT_H * U)))}`;
  const upper = style.motion === "stagger" && y >= (PANEL_H / 2) * U;
  const isLeft = x < 0;
  return upper ? (isLeft ? "leftUpper" : "rightUpper") : isLeft ? "left" : "right";
}

/** Rows (world y) for n parts, low or high. */
function rows(n: number, high: boolean): number[] {
  const lo = high ? 3.4 : 0.8;
  const hi = high ? 5.2 : 3.0;
  return Array.from({ length: n }, (_, i) =>
    n === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * i) / (n - 1),
  );
}

/**
 * The locking mechanism parts of a style. Every door has its own: kind
 * plus variant (count, high/low, heavy = on both faces).
 */
export function mechParts(style: DoorStyle): MechPart[] {
  const n = mechCount(style);
  const high = mechHigh(style);
  const both = mechHeavy(style) || style.mech === "wheel" || style.mech === "crossbar";
  const faces = both ? [FACE_Z, -FACE_Z] : [FACE_Z];
  const out: MechPart[] = [];
  switch (style.mech) {
    case "bolts":
      // Bolts shoot from the left leaf across the meeting edge (shutter: from the jambs into the curtain).
      for (const y of rows(n, high))
        for (const z of faces) {
          const m = block(6, 2, 1, C.steel);
          m.set(5, 0, 0, C.safety_red).set(5, 1, 0, C.safety_red);
          if (style.motion === "shutter") {
            for (const s of [-1, 1])
              out.push({
                on: "root",
                model: m,
                at: [s * (2.5 - 0.5), y, z],
                release: { type: "slide", axis: "x", by: s * 0.9 },
              });
          } else
            out.push({
              on: leafAt(style, -0.5, y),
              model: m,
              at: [0.1, y, z],
              release: { type: "slide", axis: "x", by: -1.2 },
            });
        }
      break;
    case "wheel": {
      // A spoked wheel on the right leaf (shutter: centre of the curtain) turns a quarter.
      const spokes = 3 + (style.mechVariant % 3);
      const r = 3;
      for (const z of faces) {
        const m = new Model(2 * r + 1, 2 * r + 1, 1);
        for (let a = 0; a < 48; a++) {
          const t = (a / 48) * Math.PI * 2;
          m.set(Math.round(r + Math.cos(t) * r), Math.round(r + Math.sin(t) * r), 0, style.trim);
        }
        for (let k = 0; k < spokes; k++) {
          const t = (k / spokes) * Math.PI * 2;
          for (let s = 0; s <= r; s++)
            m.set(Math.round(r + Math.cos(t) * s), Math.round(r + Math.sin(t) * s), 0, C.steel);
        }
        m.set(r, r, 0, C.safety_red);
        const x = style.motion === "shutter" ? 0 : 1.25;
        const y = high ? 3.6 : 2.2;
        out.push({
          on: leafAt(style, x, y),
          model: m,
          at: [x, y - r * U, z],
          release: { type: "rotate", axis: "z", by: Math.PI / 2, pivot: [x, y, z] },
        });
      }
      break;
    }
    case "clamps":
      // Clamp arms on both jambs lie over the leaf edges; released, they swing out of the wall plane.
      for (const y of rows(n, high))
        for (const s of [-1, 1])
          for (const z of faces) {
            const m = block(4, 2, 1, C.metal_dark);
            m.set(s < 0 ? 3 : 0, 0, 0, C.safety_yellow).set(s < 0 ? 3 : 0, 1, 0, C.safety_yellow);
            const x = s * (2.5 - 0.25);
            out.push({
              on: "root",
              model: m,
              at: [x, y, z],
              release: {
                type: "rotate",
                axis: "y",
                by: s * Math.sign(z) * (Math.PI / 2),
                pivot: [s * 2.6, y, z],
              },
            });
          }
      break;
    case "pins":
      // Pins hang from the header into the leaves and lift into it.
      for (let i = 0; i < n; i++) {
        const x = -1.9 + (3.8 * i) / Math.max(1, n - 1);
        const m = block(1, 6, 1, C.chrome);
        m.set(0, 5, 0, C.safety_red);
        for (const z of faces)
          out.push({
            on: "root",
            model: m,
            at: [x, 6 - 1.25, z],
            release: { type: "slide", axis: "y", by: 1.3 },
          });
      }
      break;
    case "magnet": {
      // Electromagnet strips on the meeting edge; dark when released.
      for (const y of rows(n, high))
        for (const z of faces) {
          const m = block(2, 3, 1, C.plasma_blue);
          m.set(0, 1, 0, C.white).set(1, 1, 0, C.white);
          const x = style.motion === "shutter" ? 2.2 : 0;
          out.push({ on: "root", model: m, at: [x, y, z], release: { type: "fade" } });
        }
      break;
    }
    case "crossbar": {
      // A bar across both leaves drops into brackets; released it swings up around its left end.
      const y = high ? 4.6 : 2.4;
      for (const z of faces) {
        const m = block(18, 2, 1, style.trim);
        for (let x = 0; x < 18; x += 3) m.set(x, 0, 0, C.hazard_black);
        out.push({
          on: "root",
          model: m,
          at: [0, y, z],
          // Swings up around its left end (less when mounted high, so it stays below the wall top).
          release: {
            type: "rotate",
            axis: "z",
            by: Math.PI * (high ? 0.25 : 0.42),
            pivot: [-2.2, y + 0.25, z],
          },
        });
        const br = block(2, 3, 1, C.metal_dark);
        out.push({
          on: "root",
          model: br,
          at: [2.35, y - 0.25, z],
          release: { type: "slide", axis: "x", by: 0 },
        });
      }
      break;
    }
    case "cam":
      // Cam discs on the meeting edge turn their hooks a quarter.
      for (const y of rows(n, high))
        for (const z of faces) {
          const m = new Model(5, 5, 1);
          for (let a = 0; a < 5; a++)
            for (let b = 0; b < 5; b++)
              if (Math.hypot(a - 2, b - 2) <= 2.3) m.set(a, b, 0, C.brass);
          m.set(4, 2, 0, C.steel_dark).set(2, 2, 0, C.metal_dark);
          const x = style.motion === "shutter" ? -2.0 : 0;
          out.push({
            on: "root",
            model: m,
            at: [x, y - 0.6, z],
            release: { type: "rotate", axis: "z", by: -Math.PI / 2, pivot: [x, y, z] },
          });
        }
      break;
    case "pistons":
      // Rams from both jambs press the leaves; the rods pull back into their cylinders.
      for (const y of rows(n, high))
        for (const s of [-1, 1])
          for (const z of faces) {
            const cyl = block(3, 2, 2, C.metal_dark);
            const rod = block(4, 1, 1, C.chrome);
            rod.set(s < 0 ? 3 : 0, 0, 0, style.trim);
            out.push({
              on: "root",
              model: cyl,
              at: [s * 2.85, y, z],
              release: { type: "slide", axis: "x", by: 0 },
            });
            out.push({
              on: "root",
              model: rod,
              at: [s * (2.5 - 0.35), y + 0.06, z],
              release: { type: "slide", axis: "x", by: s * 0.9 },
            });
          }
      break;
  }
  return out;
}

// ── Lock interface panel ─────────────────────────────────────────

/** What the lock interface shows (colour of its screen). */
export type PanelState = "auto" | "hold" | "sealed" | "locked" | "keypad" | "cycle";

const PANEL_SCREEN: Record<PanelState, number> = {
  auto: C.led_green,
  hold: C.plasma_blue,
  sealed: C.led_red,
  locked: C.led_red,
  keypad: C.led_amber,
  cycle: C.led_amber,
};

export const IFACE_W = 4;
export const IFACE_H = 6;
/** Door-local position of the interface (right jamb, both faces), y bottom. */
export const IFACE_AT: [number, number] = [3.05, 3.0];

/** The lock interface: housing, screen (state colour), keys, a card slot. */
export function lockPanelModel(state: PanelState): Model {
  const m = new Model(IFACE_W, IFACE_H, FRAME_D + 2);
  const D = m.d - 1;
  m.box(0, 0, 1, IFACE_W - 1, IFACE_H - 1, D - 1, C.metal_dark);
  for (const z of [0, D]) {
    m.box(0, 0, z, IFACE_W - 1, IFACE_H - 1, z, C.paint_black);
    m.box(0, 3, z, IFACE_W - 1, 4, z, PANEL_SCREEN[state]);
    m.set(0, 1, z, C.paint_gray)
      .set(1, 1, z, C.paint_gray)
      .set(2, 1, z, C.safety_red)
      .set(3, 1, z, C.paint_gray);
    m.set(1, 5, z, C.black).set(2, 5, z, C.black); // card slot
  }
  return m;
}

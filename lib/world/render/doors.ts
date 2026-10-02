/**
 * Animated doors + elevator (three).
 * ==================================
 *
 * `DoorSystem` (one per floor view) renders every door as a frame, a
 * beacon and two sliding leaves (or, for a closed secret door, a
 * wall-matching disguise) and owns the door cells' collision: the voxel
 * world keeps door cells EMPTY; `solidAt` reports the cells a leaf still
 * covers, so collision follows the animation exactly.
 *
 * Behaviour: a door whose lock is satisfied (`setState(id, true, …)`)
 * opens automatically when the player comes within DOOR_OPEN_RADIUS of its
 * centre and closes again once the player is beyond DOOR_CLOSE_RADIUS and
 * clear of the doorway (hysteresis, never closes on the player). Locked
 * doors stay shut. With `autoOpen: false`, unlocked doors simply stay open.
 * Movement eases in/out over DOOR_ANIM_TIME; `onMove(id, opening)` fires
 * when a door starts to move (for sounds).
 *
 * `ElevatorSystem` renders the lift per floor — platform (deck, rails,
 * control post with a status screen), collapsible gate, overhead winch
 * with spinning sheave/drum, hoist cable, pit — and plays a ride:
 * gate closes → platform departs → (fade) → midpoint callback (the caller
 * switches floors) → platform arrives on the new floor → gate opens.
 *
 * Meshing is delegated to the engine (`MeshModel`) so materials and the
 * palette stay shared: a mesher returns the grid meshed CENTRED in x/z
 * with y = 0 at the bottom, already scaled.
 */
import * as THREE from "three";
import { FLOOR_BY_ID } from "@/lib/world/content/map";
import { DOOR_HEIGHT, doorCells } from "@/lib/world/layout";
import {
  BEACON_ROW,
  DOOR_SCALE,
  DOOR_VPU,
  GATE_BARS,
  LEAF_W,
  OPENING_W,
  PIT_H,
  PLATFORM_W,
  PLATFORM_H,
  SHEAVE_AT,
  SHEAVE_R,
  WINCH_Y,
  HEADER_Y,
  OPENING_H,
  cableModel,
  doorBeaconModel,
  doorFrameModel,
  doorLight,
  elevatorPitModel,
  elevatorPlatformVisual,
  elevatorWinchVisual,
  gateBarModel,
  gateBarZ,
  secretDoorModels,
  secretSkinFor,
  type DoorLight,
  type DoorVariant,
  type LeafSide,
} from "@/lib/world/models/doors";
import {
  IFACE_AT,
  SLAT_H,
  doorPieces,
  lockPanelModel,
  mechParts,
  styledFrameModel,
  type DoorPiece,
  type MechPart,
  type PanelState,
  type PieceRole,
} from "@/lib/world/models/door-styles";
import { doorStyle, type DoorStyle } from "@/lib/world/doors/style";
import type { DoorMode } from "@/lib/world/doors/lock";
import { gridHash } from "@/lib/world/models/refine";

const PANEL_STATES: readonly PanelState[] = ["auto", "hold", "sealed", "locked", "keypad", "cycle"];
import { partPivotInBase, type DeviceVisual } from "@/lib/world/models/anim";
import { markInstanced, markStatic } from "@/lib/world/render/batching";
import { UNLOCK_CHIRP_AT, shaftBandY, unlockPose } from "@/lib/world/render/transitions";
import type { Model } from "@/lib/world/models/core";
import type { DoorDef, ElevatorDef, FloorId } from "@/lib/world/types";
import type { VoxelGrid } from "@/lib/voxel/grid";

export type { DoorVariant } from "@/lib/world/models/doors";

/** Mesh a grid centred in x/z (y from 0) at `scale` — the engine's `meshModel(grid, scale, true)`. */
export type MeshModel = (grid: VoxelGrid, scale: number) => THREE.Mesh;

type Vec3 = readonly [number, number, number];

// ── Door timing & geometry (pure) ────────────────────────────────

export const DOOR_ANIM_TIME = 0.45;
export const DOOR_OPEN_RADIUS = 7;
export const DOOR_CLOSE_RADIUS = 9;
/**
 * Doors open for where the walker WILL be: its position this far ahead
 * (s) along its velocity counts too — at running speed a door that only
 * reacted to the current position was still half shut when she arrived.
 */
export const DOOR_LOOKAHEAD = 0.6;
/** Walker half-width + margin used to keep a door from closing on the player. */
const PLAYER_HALF = 1.3;
/** Leaf width in world units (2.5). */
export const LEAF_WORLD = LEAF_W * DOOR_SCALE;

/** Smoothstep-style ease in/out on [0, 1]. */
export function easeInOut(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

/**
 * Local x of a leaf's centre (door frame of reference, world units) for an
 * eased opening amount 0 (closed, meeting in the middle) .. 1 (inside the wall).
 */
export function leafCenterX(side: LeafSide, open: number): number {
  const k = Math.max(0, Math.min(1, open));
  const c = LEAF_WORLD / 2 + k * LEAF_WORLD;
  return side === "left" ? -c : c;
}

/** Local x extent [min, max] of a leaf at opening amount `open`. */
export function leafSpan(side: LeafSide, open: number): [number, number] {
  const c = leafCenterX(side, open);
  return [c - LEAF_WORLD / 2, c + LEAF_WORLD / 2];
}

/** Is door cell `o` (−2..2 along the wall) still covered by a leaf at opening `open`? */
export function doorCellCovered(o: number, open: number): boolean {
  // Leaves cover |x| from the inner edge e = open · 2.5 out to the jamb; cell o spans |o| ± 0.5.
  const e = Math.max(0, Math.min(1, open)) * (OPENING_W / 2);
  return Math.abs(o) + 0.5 > e + 1e-6;
}

/** Opening amount at which the middle three cells are clear (walker is 2.2 wide). */
export const DOOR_PASSABLE_AT = 0.6;

type XZ2 = readonly [number, number];

/** The walker's box touches the doorway (a door never closes on it). */
export function inDoorway(def: Pick<DoorDef, "x" | "z" | "axis" | "width">, pos: XZ2): boolean {
  const dx = pos[0] - (def.x + 0.5);
  const dz = pos[1] - (def.z + 0.5);
  const along = def.axis === "x" ? Math.abs(dx) : Math.abs(dz);
  const across = def.axis === "x" ? Math.abs(dz) : Math.abs(dx);
  return along < def.width / 2 + PLAYER_HALF && across < 0.5 + PLAYER_HALF;
}

/**
 * Proximity part of a door's wish to open: the walker (or where it will be
 * after DOOR_LOOKAHEAD at velocity `vel`) is within DOOR_OPEN_RADIUS, or
 * its box touches the doorway; an open door stays open until both are
 * beyond DOOR_CLOSE_RADIUS (hysteresis). Pure — tested.
 */
export function doorWantsOpen(
  def: Pick<DoorDef, "x" | "z" | "axis" | "width">,
  pos: XZ2,
  vel: XZ2,
  openNow: boolean,
): boolean {
  const cx = def.x + 0.5;
  const cz = def.z + 0.5;
  const dx = pos[0] - cx;
  const dz = pos[1] - cz;
  if (inDoorway(def, pos)) return true;
  const now = Math.hypot(dx, dz);
  const ahead = Math.hypot(dx + vel[0] * DOOR_LOOKAHEAD, dz + vel[1] * DOOR_LOOKAHEAD);
  const dist = Math.min(now, ahead);
  if (dist < DOOR_OPEN_RADIUS) return true;
  return openNow && dist < DOOR_CLOSE_RADIUS;
}

/**
 * Door "magnetism": a walker heading into a doorway is steered onto its
 * centre line, so it passes the opening instead of catching a jamb or a
 * leaf that is still sliding. `move` is the input direction (length ≤ 1);
 * returns the corrected direction with the same length. Doors that are
 * locked (`passable` false and not opening) are ignored. Pure — tested.
 */
export function doorAssist(
  doors: readonly Pick<DoorDef, "x" | "z" | "axis" | "width">[],
  pos: XZ2,
  move: XZ2,
  usable: (i: number) => boolean,
): [number, number] {
  const len = Math.hypot(move[0], move[1]);
  if (len < 1e-3) return [move[0], move[1]];
  let best = -1;
  let bestAcross = Infinity;
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i]!;
    const dx = pos[0] - (d.x + 0.5);
    const dz = pos[1] - (d.z + 0.5);
    const along = d.axis === "x" ? dx : dz;
    const across = d.axis === "x" ? dz : dx;
    // Only close in front of the opening, heading towards the door line.
    if (Math.abs(across) > 4 || Math.abs(along) > d.width / 2 + 1.5) continue;
    const toward = (d.axis === "x" ? move[1] : move[0]) * -Math.sign(across || 1);
    if (toward < 0.3 * len || !usable(i)) continue;
    if (Math.abs(across) < bestAcross) {
      bestAcross = Math.abs(across);
      best = i;
    }
  }
  if (best < 0) return [move[0], move[1]];
  const d = doors[best]!;
  const along = d.axis === "x" ? pos[0] - (d.x + 0.5) : pos[1] - (d.z + 0.5);
  // Free lateral room inside the opening for the walker's half-width.
  const slack = Math.max(0, d.width / 2 - PLAYER_HALF + 0.2);
  const off = Math.abs(along) - slack * 0.35;
  if (off <= 0) return [move[0], move[1]];
  // Push towards the centre line, harder the closer to the door line.
  const k = Math.min(0.9, off * 0.6) * (1 - Math.min(1, bestAcross / 4) * 0.5);
  const push = -Math.sign(along) * k * len;
  const mx = d.axis === "x" ? move[0] + push : move[0];
  const mz = d.axis === "x" ? move[1] : move[1] + push;
  const n = Math.hypot(mx, mz) || 1;
  return [(mx / n) * len, (mz / n) * len];
}

/** Seconds a locking mechanism takes to release (before the leaves move) or engage (after they close). */
export const MECH_TIME = 0.28;
/** Shutter curtain rise (world units) at full opening and its speed-up (clear head height early). */
const SHUTTER_RISE = OPENING_H;
const SHUTTER_GAIN = 1.4;
/** Stagger: upper segments start this much later (fraction of the opening). */
const STAGGER_LAG = 0.2;

/** Opening amount of one moving piece of a style for the door's eased opening k. */
export function pieceOpen(style: Pick<DoorStyle, "motion">, role: PieceRole, k: number): number {
  const c = (x: number) => Math.max(0, Math.min(1, x));
  if (style.motion === "stagger") {
    const upper = role === "leftUpper" || role === "rightUpper";
    return upper ? c((k * (1 + STAGGER_LAG) - STAGGER_LAG) / 1) : c(k * (1 + STAGGER_LAG));
  }
  if (style.motion === "shutter") return c(k * SHUTTER_GAIN);
  return k;
}

/** Swing pairs open towards +z or −z (door-local), fixed per door. */
export function swingDir(id: string): 1 | -1 {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h & 1 ? 1 : -1;
}

interface PieceView {
  role: PieceRole;
  group: THREE.Group;
  /** Closed position of the piece's model origin (door-local). */
  at: [number, number, number];
  /** Group origin (door-local): the hinge for swing leaves, else the door origin. */
  origin: [number, number, number];
}

interface PartView {
  def: MechPart;
  holder: THREE.Group;
}

interface DoorView {
  def: DoorDef;
  style: DoorStyle;
  root: THREE.Group;
  frame: THREE.Mesh;
  cover: THREE.Mesh | null;
  beacons: Map<DoorLight, THREE.Mesh>;
  /** The lock interface (one mesh per screen state). */
  iface: Map<PanelState, THREE.Mesh>;
  panel: PanelState;
  pieces: PieceView[];
  parts: PartView[];
  mesher: MeshModel;
  unlocked: boolean;
  variant: DoorVariant;
  leafKey: string;
  /** Linear animation time fraction 0..1 (eased for the leaves). */
  t: number;
  target: 0 | 1;
  initialised: boolean;
  cellKeys: number[];
  blink: number;
  /** Seconds into the unlock sequence (−1 = none running). */
  unlockT: number;
  /** Beacon colour before the unlock (strobes while the mechanism releases). */
  unlockFrom: DoorLight;
  /** Locking mechanism engaged: 1 = locked, 0 = released. */
  lockE: number;
  /** Interface mode (lib/world/doors/lock.ts). */
  mode: DoorMode;
  /** External gate (airlock interlock): false keeps the door shut. */
  gate: boolean;
}

export interface DoorSystemOpts {
  onMove?: (id: string, opening: boolean) => void;
  /** A locked / keypad door just unlocked: its beacon turns green now (play a chirp). */
  onUnlock?: (id: string, variant: DoorVariant) => void;
  /** A door's locking mechanism starts to release (false) or engage (true) — for its sound. */
  onMech?: (id: string, engage: boolean) => void;
  /** Proximity-driven doors (default true). */
  autoOpen?: boolean;
}

function cellKey(x: number, z: number): number {
  return x + z * 4096;
}

export class DoorSystem {
  private readonly doors = new Map<string, DoorView>();
  private readonly cells = new Map<number, { id: string; o: number }>();
  private readonly meshCache = new Map<string, THREE.Mesh>();
  private readonly onMove: ((id: string, opening: boolean) => void) | undefined;
  private readonly onUnlock: ((id: string, variant: DoorVariant) => void) | undefined;
  private readonly onMech: ((id: string, engage: boolean) => void) | undefined;
  private readonly autoOpen: boolean;
  private cut = Infinity;
  private still = false;
  private calm = false;
  /** Player velocity (world units / s, x/z) of the last update — door lookahead. */
  private vel: XZ2 = [0, 0];

  constructor(opts: DoorSystemOpts = {}) {
    this.onMove = opts.onMove;
    this.onUnlock = opts.onUnlock;
    this.onMech = opts.onMech;
    this.autoOpen = opts.autoOpen ?? true;
  }

  /** Accessibility: `still` = reduce motion (mechanisms snap), `calm` = reduce flicker (no strobe). */
  setCalm(still: boolean, calm: boolean): void {
    this.still = still;
    this.calm = calm;
  }

  /** Is an unlock sequence running on this door? */
  isUnlocking(id: string): boolean {
    const v = this.doors.get(id);
    return !!v && v.unlockT >= 0;
  }

  /** Shared-geometry mesh for a model (cached by key; identical grids share one geometry). */
  private cached(key: string, mesher: MeshModel, build: () => Model): THREE.Mesh {
    let m = this.meshCache.get(key);
    if (!m) {
      m = mesher(build().grid, DOOR_SCALE);
      this.meshCache.set(key, m);
    }
    // The cached mesh stays a template; every door gets its own clone.
    return m.clone();
  }

  /** Mesh a model by content (same voxels → same template, so parts instance across doors). */
  private byContent(model: Model, mesher: MeshModel): THREE.Mesh {
    return this.cached(`grid:${gridHash(model.grid)}`, mesher, () => model);
  }

  addDoor(door: DoorDef, group: THREE.Object3D, mesher: MeshModel): void {
    const style = doorStyle(door.id);
    const root = new THREE.Group();
    root.name = `door:${door.id}`;
    root.position.set(door.x + 0.5, 1, door.z + 0.5);
    root.rotation.y = door.axis === "z" ? -Math.PI / 2 : 0;
    // Frames and covers never move (the cutaway squash re-merges the batch).
    const frame = markStatic(
      door.secret
        ? this.cached("frame:secret", mesher, () => doorFrameModel({ secret: true }))
        : this.byContent(styledFrameModel(style), mesher),
    );
    root.add(frame);
    const beacons = new Map<DoorLight, THREE.Mesh>();
    for (const l of ["green", "amber", "red"] as const) {
      const b = markInstanced(this.cached(`beacon:${l}`, mesher, () => doorBeaconModel(l)));
      b.position.y = BEACON_ROW / DOOR_VPU;
      b.visible = false;
      root.add(b);
      beacons.set(l, b);
    }
    let cover: THREE.Mesh | null = null;
    if (door.secret) {
      cover = markStatic(mesher(secretDoorModels(secretSkinFor(door)).cover.grid, DOOR_SCALE));
      cover.scale.z *= 1.02; // a hair proud of the voxel frame cells it encloses
      root.add(cover);
    }
    // Lock interface on the right jamb (both faces): one mesh per screen state.
    const iface = new Map<PanelState, THREE.Mesh>();
    for (const st of PANEL_STATES) {
      const m = markInstanced(this.cached(`iface:${st}`, mesher, () => lockPanelModel(st)));
      m.position.set(IFACE_AT[0], IFACE_AT[1], 0);
      m.visible = false;
      root.add(m);
      iface.set(st, m);
    }
    group.add(root);
    const cellKeys: number[] = [];
    const half = Math.floor(door.width / 2);
    doorCells(door).forEach((c, i) => {
      const k = cellKey(c.x, c.z);
      cellKeys.push(k);
      this.cells.set(k, { id: door.id, o: i - half });
    });
    const view: DoorView = {
      def: door,
      style,
      root,
      frame,
      cover,
      beacons,
      iface,
      panel: "auto",
      pieces: [],
      parts: [],
      mesher,
      unlocked: false,
      variant: door.secret ? "secret" : door.keypad ? "keypad" : door.lock ? "locked" : "normal",
      leafKey: "",
      t: 0,
      target: 0,
      initialised: false,
      cellKeys,
      blink: 0,
      unlockT: -1,
      unlockFrom: "red",
      lockE: 1,
      mode: "auto",
      gate: true,
    };
    this.doors.set(door.id, view);
    this.applyLook(view);
    this.applyPose(view);
    this.applyCut(view);
  }

  /**
   * `open` = the door's lock is satisfied (game.ts `doorIsOpen`). The first
   * call per door snaps; later calls animate (a revealed secret door
   * slides apart the next time the player comes close).
   */
  setState(id: string, open: boolean, variant: DoorVariant): void {
    const v = this.doors.get(id);
    if (!v) return;
    const changed = v.unlocked !== open || v.variant !== variant || !v.initialised;
    const unlocking =
      v.initialised && !v.unlocked && open && (variant === "locked" || variant === "keypad");
    if (!open && v.unlockT >= 0) this.endUnlock(v);
    v.unlocked = open;
    v.variant = variant;
    if (!this.autoOpen) this.setTarget(v, open ? 1 : 0, v.initialised);
    else if (!open) this.setTarget(v, 0, v.initialised);
    if (!v.initialised) {
      v.initialised = true;
      v.t = v.target;
      v.lockE = v.t > 0 ? 0 : 1;
    }
    if (changed) this.applyLook(v);
    if (unlocking) this.startUnlock(v, variant);
    this.applyPose(v);
  }

  /** Interface mode (auto / hold / sealed) from the lock system. */
  setMode(id: string, mode: DoorMode): void {
    const v = this.doors.get(id);
    if (v) v.mode = mode;
  }

  /** Airlock interlock: while false the door stays (or goes) shut. */
  setGate(id: string, allowed: boolean): void {
    const v = this.doors.get(id);
    if (v) v.gate = allowed;
  }

  /** What the lock interface shows. */
  setPanel(id: string, state: PanelState): void {
    const v = this.doors.get(id);
    if (!v || v.panel === state) return;
    v.panel = state;
    this.applyPanel(v);
  }

  /** Jump every door to its resting state for this player position (after a floor switch). */
  snap(playerPos: Vec3): void {
    for (const v of this.doors.values()) {
      if (v.unlockT >= 0) this.endUnlock(v);
      this.setTarget(v, this.wanted(v, playerPos), false);
      v.t = v.target;
      v.lockE = v.t > 0 ? 0 : 1;
      this.applyLook(v);
      this.applyPose(v);
    }
  }

  update(dt: number, playerPos: Vec3, playerVel: XZ2 = [0, 0]): void {
    this.vel = playerVel;
    for (const v of this.doors.values()) {
      if (v.unlockT >= 0) this.stepUnlock(v, dt);
      this.setTarget(v, this.wanted(v, playerPos), true);
      let moved = false;
      // Mechanism first: it releases before the leaves move and engages after they closed.
      const wantE = v.target === 1 || v.t > 0 ? 0 : 1;
      if (v.lockE !== wantE) {
        const from = v.lockE;
        const step = this.still ? 1 : dt / MECH_TIME;
        v.lockE = wantE > v.lockE ? Math.min(1, v.lockE + step) : Math.max(0, v.lockE - step);
        if (from === (wantE ? 0 : 1)) this.onMech?.(v.def.id, wantE === 1);
        moved = true;
      }
      const leavesFree = v.lockE <= 0;
      const goal = v.target === 1 && leavesFree ? 1 : 0;
      if (v.t !== goal) {
        const step = dt / DOOR_ANIM_TIME;
        v.t = goal === 1 ? Math.min(1, v.t + step) : Math.max(0, v.t - step);
        v.blink += dt;
        moved = true;
      }
      if (moved) this.applyPose(v);
      this.applyBeacon(v, v.t !== v.target || (v.lockE > 0 && v.lockE < 1));
    }
  }

  isPassable(id: string): boolean {
    const v = this.doors.get(id);
    return !!v && easeInOut(v.t) >= DOOR_PASSABLE_AT;
  }

  /** Eased opening amount 0..1 (for sounds / UI). */
  openAmount(id: string): number {
    const v = this.doors.get(id);
    return v ? easeInOut(v.t) : 0;
  }

  /** Locking mechanism engaged amount (1 = locked). */
  lockAmount(id: string): number {
    return this.doors.get(id)?.lockE ?? 1;
  }

  /** Door "magnetism" for a walker at `pos` moving `move` (see `doorAssist`). */
  assist(pos: Vec3, move: XZ2): [number, number] {
    const list = [...this.doors.values()];
    return doorAssist(
      list.map((v) => v.def),
      [pos[0], pos[2]],
      move,
      (i) => list[i]!.unlocked && list[i]!.mode !== "sealed",
    );
  }

  /** True if a leaf occupies the world voxel (x, y, z): wrap the floor collision with this. */
  solidAt(x: number, y: number, z: number): boolean {
    if (y < 1 || y > DOOR_HEIGHT) return false;
    const c = this.cells.get(cellKey(x, z));
    if (!c) return false;
    const v = this.doors.get(c.id)!;
    return doorCellCovered(c.o, easeInOut(v.t));
  }

  /** Door cells that block even when the door would auto-open (locked or sealed doors) — for pathing. */
  lockedAt(x: number, z: number): boolean {
    const c = this.cells.get(cellKey(x, z));
    if (!c) return false;
    const v = this.doors.get(c.id)!;
    return !v.unlocked || v.mode === "sealed";
  }

  /** Match the wall cutaway (voxels above `cut` hidden): squash the doors to that height. */
  setCut(cut: number): void {
    this.cut = cut;
    for (const v of this.doors.values()) this.applyCut(v);
  }

  get ids(): string[] {
    return [...this.doors.keys()];
  }

  // ── internals ──

  private wanted(v: DoorView, p: Vec3): 0 | 1 {
    if (!v.unlocked) return 0;
    // Sealed or held by an interlock: shut — but never onto the player standing in the doorway.
    if (v.mode === "sealed" || !v.gate) return v.t > 0 && inDoorway(v.def, [p[0], p[2]]) ? 1 : 0;
    // An unlocking door holds still until its mechanism has released.
    if (v.unlockT >= 0 && !unlockPose(v.unlockT).release) return 0;
    if (!this.autoOpen || v.mode === "hold") return 1;
    // Never close on the player; open ahead of where they are heading.
    return doorWantsOpen(v.def, [p[0], p[2]], this.vel, v.target === 1) ? 1 : 0;
  }

  private setTarget(v: DoorView, target: 0 | 1, notify: boolean): void {
    if (v.target === target) return;
    v.target = target;
    v.blink = 0;
    if (notify && v.t !== target) this.onMove?.(v.def.id, target === 1);
  }

  private leafPieces(v: DoorView): { key: string; build: () => DoorPiece[] } {
    if (v.variant === "secret") {
      const build = (): DoorPiece[] => {
        const m = secretDoorModels(secretSkinFor(v.def));
        return [
          { role: "left", model: m.left, at: [leafCenterX("left", 0), 0, 0] },
          { role: "right", model: m.right, at: [leafCenterX("right", 0), 0, 0] },
        ];
      };
      return { key: `secret:${v.def.id}`, build };
    }
    const light = doorLight(v.variant, v.unlocked);
    return { key: `style:${v.def.id}:${light}`, build: () => doorPieces(v.style, light) };
  }

  private applyLook(v: DoorView): void {
    const lp = this.leafPieces(v);
    if (lp.key !== v.leafKey) {
      v.leafKey = lp.key;
      for (const p of v.pieces) v.root.remove(p.group);
      for (const p of v.parts) p.holder.parent?.remove(p.holder);
      v.pieces = [];
      v.parts = [];
      const swing = v.style.motion === "swing" && v.variant !== "secret";
      for (const piece of lp.build()) {
        const group = new THREE.Group();
        const isLeft = piece.role === "left" || piece.role === "leftUpper";
        const origin: [number, number, number] = swing
          ? [isLeft ? -OPENING_W / 2 : OPENING_W / 2, 0, 0]
          : [0, 0, 0];
        group.position.set(origin[0], origin[1], origin[2]);
        const mesh = markInstanced(
          this.cached(`${lp.key}:${piece.role}`, v.mesher, () => piece.model),
        );
        mesh.position.set(
          piece.at[0] - origin[0],
          piece.at[1] - origin[1],
          piece.at[2] - origin[2],
        );
        // Secret leaves are wall-thick: pull them a hair inside the wall faces.
        if (v.variant === "secret") mesh.scale.z = DOOR_SCALE * 0.98;
        group.add(mesh);
        v.root.add(group);
        v.pieces.push({ role: piece.role, group, at: piece.at, origin });
      }
      // The locking mechanism (secret doors: flush magnets nobody sees).
      if (v.variant !== "secret")
        for (const def of mechParts(v.style)) {
          const holder = new THREE.Group();
          const pivot = def.release.type === "rotate" ? def.release.pivot : def.at;
          const host = def.on === "root" ? null : v.pieces.find((p) => p.role === def.on);
          const base = host ? host.origin : ([0, 0, 0] as const);
          holder.position.set(pivot[0] - base[0], pivot[1] - base[1], pivot[2] - base[2]);
          const mesh = markInstanced(this.byContent(def.model, v.mesher));
          mesh.position.set(def.at[0] - pivot[0], def.at[1] - pivot[1], def.at[2] - pivot[2]);
          holder.add(mesh);
          (host ? host.group : v.root).add(holder);
          v.parts.push({ def, holder });
        }
    }
    const disguised = v.variant === "secret" && !v.unlocked;
    v.frame.visible = !disguised;
    if (v.cover) v.cover.visible = disguised;
    this.applyPanel(v);
    this.applyBeacon(v, v.t !== v.target);
  }

  private applyPanel(v: DoorView): void {
    const disguised = v.variant === "secret" && !v.unlocked;
    for (const [st, m] of v.iface) m.visible = !disguised && st === v.panel;
  }

  private applyBeacon(v: DoorView, moving: boolean): void {
    const disguised = v.variant === "secret" && !v.unlocked;
    if (v.unlockT >= 0 && !disguised) {
      // Unlock sequence owns the beacon: old colour strobes, then green.
      const pose = unlockPose(v.unlockT, this.calm);
      const lit: DoorLight | null =
        pose.light === "off" ? null : pose.light === "old" ? v.unlockFrom : "green";
      for (const [l, b] of v.beacons) b.visible = l === lit;
      return;
    }
    const lit: DoorLight = moving ? "amber" : doorLight(v.variant, v.unlocked);
    const on = !disguised && (!moving || this.calm || Math.floor(v.blink / 0.15) % 2 === 0);
    for (const [l, b] of v.beacons) b.visible = on && l === lit;
  }

  /** Start the unlock sequence: the beacon strobes, the mechanism releases once, then the door may open. */
  private startUnlock(v: DoorView, variant: DoorVariant): void {
    this.endUnlock(v);
    v.unlockT = 0;
    v.unlockFrom = doorLight(variant, false);
  }

  private stepUnlock(v: DoorView, dt: number): void {
    const t0 = v.unlockT;
    v.unlockT += dt;
    if (t0 < UNLOCK_CHIRP_AT && v.unlockT >= UNLOCK_CHIRP_AT) this.onUnlock?.(v.def.id, v.variant);
    if (unlockPose(v.unlockT).done) this.endUnlock(v);
  }

  private endUnlock(v: DoorView): void {
    v.unlockT = -1;
  }

  private applyPose(v: DoorView): void {
    const k = easeInOut(v.t);
    const st = v.variant === "secret" ? { motion: "split" as const } : v.style;
    const dir = swingDir(v.def.id);
    for (const p of v.pieces) {
      const o = pieceOpen(st, p.role, k);
      const isLeft = p.role === "left" || p.role === "leftUpper";
      if (st.motion === "swing") {
        p.group.rotation.y = (isLeft ? 1 : -1) * dir * o * (Math.PI / 2);
        p.group.visible = true;
      } else if (st.motion === "shutter") {
        const rise = o * SHUTTER_RISE;
        p.group.position.y = rise;
        // Slats roll onto the drum in the header: gone once they pass under it.
        p.group.visible = p.at[1] + rise + SLAT_H * DOOR_SCALE <= HEADER_Y * DOOR_SCALE + 0.05;
      } else {
        p.group.position.x = (isLeft ? -1 : 1) * o * (OPENING_W / 2);
        // Fully open leaves sit inside the wall: hide them (cutaway / glass walls can't reveal them).
        p.group.visible = o < 1;
      }
    }
    const e = easeInOut(v.lockE);
    for (const { def, holder } of v.parts) {
      const r = def.release;
      const free = 1 - e;
      holder.position.set(...this.partBase(v, def));
      holder.rotation.set(0, 0, 0);
      holder.visible = true;
      if (r.type === "slide") holder.position[r.axis] += r.by * free;
      else if (r.type === "rotate") holder.rotation[r.axis] = r.by * free;
      else holder.visible = e > 0.5;
    }
  }

  /** Holder position of a mechanism part in its host's frame. */
  private partBase(v: DoorView, def: MechPart): [number, number, number] {
    const pivot = def.release.type === "rotate" ? def.release.pivot : def.at;
    const host = def.on === "root" ? null : v.pieces.find((p) => p.role === def.on);
    const b = host ? host.origin : [0, 0, 0];
    return [pivot[0] - b[0]!, pivot[1] - b[1]!, pivot[2] - b[2]!];
  }

  private applyCut(v: DoorView): void {
    v.root.scale.y = Number.isFinite(this.cut) ? Math.max(0.12, Math.min(1, this.cut / 7)) : 1;
  }
}

// ── Elevator timeline (pure) ─────────────────────────────────────

export const ELEVATOR_TIMING = {
  /** Gate close / open duration. */
  gate: 0.5,
  /** Depart and arrive duration each. */
  travel: 0.9,
  /** "fade-out" fires this long before the midpoint (LabWorld's fade is 450 ms). */
  fadeLead: 0.45,
} as const;

/** Vertical travel shown on each floor (world units). */
export const ELEVATOR_TRAVEL = 4;

export type ElevatorEvent =
  | "gate-close"
  | "depart"
  | "fade-out"
  | "midpoint"
  | "arrive"
  | "gate-open"
  | "done";

export type ElevatorStage = "gate-close" | "depart" | "arrive" | "gate-open" | "done";

export interface ElevatorPose {
  stage: ElevatorStage;
  /** Gate closure 0 (open) .. 1 (closed). */
  gate: number;
  /** Platform offset from rest (world units) on the floor currently shown. */
  offset: number;
  /** True once the destination floor is the one shown (t ≥ midpoint). */
  arrived: boolean;
}

export function elevatorDuration(): number {
  const { gate, travel } = ELEVATOR_TIMING;
  return 2 * gate + 2 * travel;
}

/** Event times in firing order (equal times keep this order). */
export function elevatorEventTimes(): { event: ElevatorEvent; t: number }[] {
  const { gate, travel, fadeLead } = ELEVATOR_TIMING;
  const mid = gate + travel;
  return [
    { event: "gate-close", t: 0 },
    { event: "depart", t: gate },
    { event: "fade-out", t: Math.max(gate, mid - fadeLead) },
    { event: "midpoint", t: mid },
    { event: "arrive", t: mid + travel },
    { event: "gate-open", t: mid + travel },
    { event: "done", t: elevatorDuration() },
  ];
}

/** Events with t0 < time ≤ t1 (t0 < 0 includes the t = 0 events). */
export function elevatorEventsBetween(t0: number, t1: number): ElevatorEvent[] {
  return elevatorEventTimes()
    .filter((e) => e.t > t0 && e.t <= t1)
    .map((e) => e.event);
}

/** Direction of travel: −1 down, +1 up (by FloorDef.order: larger = deeper). */
export function rideDirection(from: FloorId, to: FloorId): -1 | 1 {
  return FLOOR_BY_ID[to].order > FLOOR_BY_ID[from].order ? -1 : 1;
}

/** Pose at ride time t (seconds) for direction `dir`. Pure. */
export function elevatorPose(t: number, dir: -1 | 1): ElevatorPose {
  const { gate, travel } = ELEVATOR_TIMING;
  const mid = gate + travel;
  const D = ELEVATOR_TRAVEL;
  if (t < gate)
    return { stage: "gate-close", gate: easeInOut(t / gate), offset: 0, arrived: false };
  if (t < mid) {
    const u = (t - gate) / travel;
    return { stage: "depart", gate: 1, offset: dir * D * u * u, arrived: false };
  }
  if (t < mid + travel) {
    const u = (t - mid) / travel;
    const out = 1 - (1 - u) * (1 - u);
    return { stage: "arrive", gate: 1, offset: -dir * D * (1 - out), arrived: true };
  }
  const end = elevatorDuration();
  if (t < end) {
    const u = (t - mid - travel) / gate;
    return { stage: "gate-open", gate: 1 - easeInOut(u), offset: 0, arrived: true };
  }
  return { stage: "done", gate: 0, offset: 0, arrived: true };
}

// ── Elevator system ──────────────────────────────────────────────

/** Deck bottom height (deck top lands a hair above the slab at y = 1.02). */
export const PLATFORM_Y = 0.52;

/** The 7 × 7 slab cells the platform replaces (clear them at y = 0 to open the shaft). */
export function elevatorHoleCells(e: ElevatorDef): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let dz = -3; dz <= 3; dz++)
    for (let dx = -3; dx <= 3; dx++) out.push({ x: e.x + dx, z: e.z + dz });
  return out;
}

interface ElevatorView {
  def: ElevatorDef;
  root: THREE.Group;
  platform: THREE.Group;
  bars: THREE.Mesh[];
  winch: THREE.Group;
  spinners: THREE.Group[];
  cable: THREE.Mesh;
  pit: THREE.Mesh;
  /** Shaft light band sliding past the cage while it travels (visible during rides only). */
  band: THREE.Mesh;
  angle: number;
  lastOffset: number;
}

/** Cage light band: a square additive tube around the deck, 0.12 tall. */
const BAND_GAP = 5.5;
function cageBand(): THREE.Mesh {
  const half = (PLATFORM_W * DOOR_SCALE) / 2 + 0.05;
  const geo = new THREE.CylinderGeometry(half * Math.SQRT2, half * Math.SQRT2, 0.12, 4, 1, true);
  geo.rotateY(Math.PI / 4);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: "#ffe6b8",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.visible = false;
  mesh.name = "cage-band";
  return mesh;
}

export interface ElevatorHooks {
  onEvent?: (e: ElevatorEvent) => void;
  onDone?: () => void;
}

export interface ElevatorSystemOpts {
  /** Attach live screens to the platform (e.g. `screens.attachVisual(g, v, {}, true)`). */
  attachScreens?: (group: THREE.Object3D, visual: DeviceVisual) => void;
}

interface Ride {
  from: FloorId;
  to: FloorId;
  dir: -1 | 1;
  t: number;
  onMidpoint: () => void;
  hooks: ElevatorHooks;
}

const SHEAVE_BOTTOM_Y = WINCH_Y + (SHEAVE_AT[1] + 0.5 - SHEAVE_R) * DOOR_SCALE;
const CABLE_BOTTOM_Y = PLATFORM_Y + PLATFORM_H * DOOR_SCALE;

export class ElevatorSystem {
  private readonly views = new Map<FloorId, ElevatorView>();
  private current: Ride | null = null;
  private pose: ElevatorPose = { stage: "done", gate: 0, offset: 0, arrived: true };
  private cut = Infinity;

  constructor(
    private readonly mesher: MeshModel,
    private readonly opts: ElevatorSystemOpts = {},
  ) {}

  addFloor(floor: FloorId, group: THREE.Object3D, def: ElevatorDef): void {
    const m = this.mesher;
    const root = new THREE.Group();
    root.name = `elevator:${floor}`;
    root.position.set(def.x + 0.5, 0, def.z + 0.5);

    const pit = markStatic(m(elevatorPitModel().grid, DOOR_SCALE));
    pit.position.y = -PIT_H * DOOR_SCALE;
    root.add(pit);

    const platform = new THREE.Group();
    const pv = elevatorPlatformVisual();
    platform.add(m(pv.base.grid, DOOR_SCALE));
    this.opts.attachScreens?.(platform, pv);
    const barGrid = gateBarModel().grid;
    const bars: THREE.Mesh[] = [];
    for (let i = 0; i < GATE_BARS; i++) {
      const b = i === 0 ? markInstanced(m(barGrid, DOOR_SCALE)) : bars[0]!.clone();
      b.position.set(-pv.base.w / 2 / DOOR_VPU + 0.5 * DOOR_SCALE, 2 * DOOR_SCALE, 0);
      platform.add(b);
      bars.push(b);
    }
    platform.position.y = PLATFORM_Y;
    const band = cageBand();
    platform.add(band);
    root.add(platform);

    const winch = new THREE.Group();
    winch.position.y = WINCH_Y;
    const wv = elevatorWinchVisual();
    winch.add(markStatic(m(wv.base.grid, DOOR_SCALE)));
    const spinners: THREE.Group[] = [];
    for (const part of wv.parts) {
      const pivot = new THREE.Group();
      const p = partPivotInBase(wv.base, part);
      pivot.position.set(p[0] * DOOR_SCALE, p[1] * DOOR_SCALE, p[2] * DOOR_SCALE);
      const mesh = m(part.model.grid, DOOR_SCALE);
      mesh.position.y = -part.pivot[1] * DOOR_SCALE;
      pivot.add(mesh);
      winch.add(pivot);
      spinners.push(pivot);
    }
    root.add(winch);

    const cable = m(cableModel().grid, DOOR_SCALE);
    root.add(cable);

    group.add(root);
    const view: ElevatorView = {
      def,
      root,
      platform,
      bars,
      winch,
      spinners,
      cable,
      pit,
      band,
      angle: 0,
      lastOffset: 0,
    };
    this.views.set(floor, view);
    this.applyView(view, { stage: "done", gate: 0, offset: 0, arrived: true }, 0);
    this.applyCut(view);
  }

  get riding(): boolean {
    return this.current !== null;
  }

  /** Platform offset (world units) on the floor currently shown — add it to the player & camera y. */
  get offset(): number {
    return this.current ? this.pose.offset : 0;
  }

  get stage(): ElevatorStage {
    return this.current ? this.pose.stage : "done";
  }

  /**
   * Start a ride. `onMidpoint` fires once the screen should be black (the
   * caller switches the floor there). Returns false if a ride is running
   * or the floors are the same.
   */
  ride(from: FloorId, to: FloorId, onMidpoint: () => void, hooks: ElevatorHooks = {}): boolean {
    if (this.current || from === to) return false;
    this.current = { from, to, dir: rideDirection(from, to), t: 0, onMidpoint, hooks };
    this.pose = elevatorPose(0, this.current.dir);
    hooks.onEvent?.("gate-close");
    return true;
  }

  update(dt: number): void {
    const r = this.current;
    if (!r) {
      for (const v of this.views.values()) this.spin(v, 0, dt);
      return;
    }
    const t0 = r.t;
    r.t = Math.min(elevatorDuration(), r.t + dt);
    for (const e of elevatorEventsBetween(t0, r.t)) {
      if (e === "midpoint") r.onMidpoint();
      r.hooks.onEvent?.(e);
    }
    this.pose = elevatorPose(r.t, r.dir);
    const shown = this.pose.arrived ? r.to : r.from;
    for (const [f, v] of this.views) {
      const p =
        f === shown ? this.pose : { stage: "done" as const, gate: 0, offset: 0, arrived: true };
      this.applyView(v, p, dt);
    }
    if (r.t >= elevatorDuration()) {
      this.current = null;
      r.hooks.onDone?.();
    }
  }

  /** Slab support for the platform cells (y = 0) once the hole has been cleared. */
  solidAt(floor: FloorId, x: number, y: number, z: number): boolean {
    if (y !== 0) return false;
    const v = this.views.get(floor);
    return !!v && Math.abs(x - v.def.x) <= 3 && Math.abs(z - v.def.z) <= 3;
  }

  setCut(cut: number): void {
    this.cut = cut;
    for (const v of this.views.values()) this.applyCut(v);
  }

  private applyView(v: ElevatorView, p: ElevatorPose, dt: number): void {
    v.platform.position.y = PLATFORM_Y + p.offset;
    v.bars.forEach((b, i) => (b.position.z = gateBarZ(i, p.gate)));
    const bottom = CABLE_BOTTOM_Y + p.offset;
    const len = Math.max(0.05, SHEAVE_BOTTOM_Y - bottom);
    v.cable.position.y = bottom;
    // Cable model is 4 voxels (1 world unit) tall.
    v.cable.scale.y = DOOR_SCALE * len;
    const vel = dt > 0 ? (p.offset - v.lastOffset) / dt : 0;
    v.lastOffset = p.offset;
    this.spin(v, vel, dt);
    // Shaft lights slide past the cage while it moves (fixed to the shaft).
    const glow = Math.min(1, Math.abs(vel) / 3);
    v.band.visible = glow > 0.02;
    if (v.band.visible) {
      v.band.position.y = 0.6 + shaftBandY(p.offset, BAND_GAP);
      (v.band.material as THREE.MeshBasicMaterial).opacity = 0.55 * glow;
    }
  }

  private spin(v: ElevatorView, velocity: number, dt: number): void {
    if (velocity === 0) return;
    v.angle += (velocity / (SHEAVE_R * DOOR_SCALE)) * dt;
    v.spinners.forEach((s, i) => (s.rotation.x = i === 0 ? v.angle : -v.angle * 0.6));
  }

  private applyCut(v: ElevatorView): void {
    const full = !Number.isFinite(this.cut);
    v.winch.visible = full;
    v.cable.visible = full;
  }
}

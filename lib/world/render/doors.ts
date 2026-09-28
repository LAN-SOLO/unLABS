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
  LEAF_D,
  LEAF_W,
  OPENING_W,
  PIT_H,
  PLATFORM_W,
  PLATFORM_H,
  SHEAVE_AT,
  SHEAVE_R,
  WINCH_Y,
  cableModel,
  doorBeaconModel,
  doorFrameModel,
  doorLeafModel,
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
import { block, partPivotInBase, type DeviceVisual } from "@/lib/world/models/anim";
import { C } from "@/lib/world/content/palette";
import { markInstanced, markStatic } from "@/lib/world/render/batching";
import {
  UNLOCK_CHIRP_AT,
  easeInOut as easeUnlock,
  shaftBandY,
  unlockPose,
} from "@/lib/world/render/transitions";
import type { Model } from "@/lib/world/models/core";
import type { DoorDef, ElevatorDef, FloorId } from "@/lib/world/types";
import type { VoxelGrid } from "@/lib/voxel/grid";

export type { DoorVariant } from "@/lib/world/models/doors";

/** Mesh a grid centred in x/z (y from 0) at `scale` — the engine's `meshModel(grid, scale, true)`. */
export type MeshModel = (grid: VoxelGrid, scale: number) => THREE.Mesh;

type Vec3 = readonly [number, number, number];

// ── Door timing & geometry (pure) ────────────────────────────────

export const DOOR_ANIM_TIME = 0.6;
export const DOOR_OPEN_RADIUS = 6;
export const DOOR_CLOSE_RADIUS = 8;
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

interface DoorView {
  def: DoorDef;
  root: THREE.Group;
  left: THREE.Group;
  right: THREE.Group;
  frame: THREE.Mesh;
  cover: THREE.Mesh | null;
  beacons: Map<DoorLight, THREE.Mesh>;
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
  /** Beacon colour before the unlock (strobes while the bolts retract). */
  unlockFrom: DoorLight;
  /** Transient bolt blocks (left, right) and keypad flash plate of a running unlock. */
  unlockMeshes: THREE.Mesh[];
}

/** Bolt block on the LEFT leaf (voxels): x 6..9, y 9..13 — see models/doors leftLeaf. */
const BOLT_W = 4;
const BOLT_H = 5;
const BOLT_X = (LEAF_W - BOLT_W / 2 - LEAF_W / 2) * DOOR_SCALE;
const BOLT_Y = 9 * DOOR_SCALE;
/** Keypad plate on the RIGHT leaf (voxels): x 3..8, y 6..10. */
const PAD_W = 6;
const PAD_H = 5;
const PAD_X = (3 + PAD_W / 2 - LEAF_W / 2) * DOOR_SCALE;
const PAD_Y = 6 * DOOR_SCALE;

export interface DoorSystemOpts {
  onMove?: (id: string, opening: boolean) => void;
  /** A locked / keypad door just unlocked: its beacon turns green now (play a chirp). */
  onUnlock?: (id: string, variant: DoorVariant) => void;
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
  private readonly autoOpen: boolean;
  private cut = Infinity;
  private still = false;
  private calm = false;

  constructor(opts: DoorSystemOpts = {}) {
    this.onMove = opts.onMove;
    this.onUnlock = opts.onUnlock;
    this.autoOpen = opts.autoOpen ?? true;
  }

  /** Accessibility: `still` = reduce motion (bolts vanish, no slide), `calm` = reduce flicker (no strobe). */
  setCalm(still: boolean, calm: boolean): void {
    this.still = still;
    this.calm = calm;
  }

  /** Is an unlock sequence running on this door? */
  isUnlocking(id: string): boolean {
    const v = this.doors.get(id);
    return !!v && v.unlockT >= 0;
  }

  /** Shared-geometry mesh for a cached model key. */
  private cached(key: string, mesher: MeshModel, build: () => Model): THREE.Mesh {
    let m = this.meshCache.get(key);
    if (!m) {
      m = mesher(build().grid, DOOR_SCALE);
      this.meshCache.set(key, m);
    }
    // The cached mesh stays a template; every door gets its own clone.
    return m.clone();
  }

  addDoor(door: DoorDef, group: THREE.Object3D, mesher: MeshModel): void {
    const root = new THREE.Group();
    root.name = `door:${door.id}`;
    root.position.set(door.x + 0.5, 1, door.z + 0.5);
    root.rotation.y = door.axis === "z" ? -Math.PI / 2 : 0;
    // Frames and covers never move (the cutaway squash re-merges the batch).
    const frame = markStatic(
      door.secret
        ? this.cached("frame:secret", mesher, () => doorFrameModel({ secret: true }))
        : this.cached("frame", mesher, () => doorFrameModel()),
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
    const left = new THREE.Group();
    const right = new THREE.Group();
    root.add(left, right);
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
      root,
      left,
      right,
      frame,
      cover,
      beacons,
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
      unlockMeshes: [],
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
    }
    if (changed) this.applyLook(v);
    // After applyLook: swapping the leaf meshes clears the leaf groups.
    if (unlocking) this.startUnlock(v, variant);
    this.applyPose(v);
  }

  /** Jump every door to its resting state for this player position (after a floor switch). */
  snap(playerPos: Vec3): void {
    for (const v of this.doors.values()) {
      if (v.unlockT >= 0) this.endUnlock(v);
      this.setTarget(v, this.wanted(v, playerPos), false);
      v.t = v.target;
      this.applyLook(v);
      this.applyPose(v);
    }
  }

  update(dt: number, playerPos: Vec3): void {
    for (const v of this.doors.values()) {
      if (v.unlockT >= 0) this.stepUnlock(v, dt);
      this.setTarget(v, this.wanted(v, playerPos), true);
      const moving = v.t !== v.target;
      if (moving) {
        const step = dt / DOOR_ANIM_TIME;
        v.t = v.target === 1 ? Math.min(1, v.t + step) : Math.max(0, v.t - step);
        v.blink += dt;
        this.applyPose(v);
      }
      this.applyBeacon(v, moving);
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

  /** True if a leaf occupies the world voxel (x, y, z): wrap the floor collision with this. */
  solidAt(x: number, y: number, z: number): boolean {
    if (y < 1 || y > DOOR_HEIGHT) return false;
    const c = this.cells.get(cellKey(x, z));
    if (!c) return false;
    const v = this.doors.get(c.id)!;
    return doorCellCovered(c.o, easeInOut(v.t));
  }

  /** Door cells that block even when the door would auto-open (locked doors) — for pathing. */
  lockedAt(x: number, z: number): boolean {
    const c = this.cells.get(cellKey(x, z));
    return !!c && !this.doors.get(c.id)!.unlocked;
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
    // Bolts first: an unlocking door holds still until they are back in the leaf.
    if (v.unlockT >= 0 && !unlockPose(v.unlockT).release) return 0;
    if (!this.autoOpen) return 1;
    const dx = p[0] - (v.def.x + 0.5);
    const dz = p[2] - (v.def.z + 0.5);
    const dist = Math.hypot(dx, dz);
    // Never close on the player: stay open while their box touches the doorway.
    const along = v.def.axis === "x" ? Math.abs(dx) : Math.abs(dz);
    const across = v.def.axis === "x" ? Math.abs(dz) : Math.abs(dx);
    const inDoorway = along < OPENING_W / 2 + PLAYER_HALF && across < 0.5 + PLAYER_HALF;
    if (inDoorway || dist < DOOR_OPEN_RADIUS) return 1;
    if (v.target === 1 && dist < DOOR_CLOSE_RADIUS) return 1;
    return 0;
  }

  private setTarget(v: DoorView, target: 0 | 1, notify: boolean): void {
    if (v.target === target) return;
    v.target = target;
    v.blink = 0;
    if (notify && v.t !== target) this.onMove?.(v.def.id, target === 1);
  }

  private leafModels(v: DoorView): { key: string; left: () => Model; right: () => Model } {
    if (v.variant === "secret") {
      const models = () => secretDoorModels(secretSkinFor(v.def));
      return { key: `secret:${v.def.id}`, left: () => models().left, right: () => models().right };
    }
    const light = doorLight(v.variant, v.unlocked);
    const keypad = v.variant === "keypad";
    const bolt = v.variant === "locked" && !v.unlocked;
    const key = `leaf:${light}:${keypad ? 1 : 0}:${bolt ? 1 : 0}`;
    return {
      key,
      left: () => doorLeafModel("left", { light, bolt }),
      right: () => doorLeafModel("right", { light, keypad, bolt }),
    };
  }

  private applyLook(v: DoorView): void {
    const lm = this.leafModels(v);
    if (lm.key !== v.leafKey) {
      v.leafKey = lm.key;
      for (const [g, side, build] of [
        [v.left, "left", lm.left],
        [v.right, "right", lm.right],
      ] as const) {
        for (const c of [...g.children]) if (!v.unlockMeshes.some((m) => m === c)) g.remove(c);
        const mesh = markInstanced(this.cached(`${lm.key}:${side}`, v.mesher, build));
        // Secret leaves are wall-thick: pull them a hair inside the wall faces.
        mesh.scale.z = DOOR_SCALE * (v.variant === "secret" ? 0.98 : 1);
        g.add(mesh);
      }
    }
    const disguised = v.variant === "secret" && !v.unlocked;
    v.frame.visible = !disguised;
    if (v.cover) v.cover.visible = disguised;
    this.applyBeacon(v, v.t !== v.target);
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

  /** Throw transient bolts (and a keypad flash plate) onto the leaves and start the sequence. */
  private startUnlock(v: DoorView, variant: DoorVariant): void {
    this.endUnlock(v);
    v.unlockT = 0;
    v.unlockFrom = doorLight(variant, false);
    const bolt = (side: "left" | "right"): THREE.Mesh => {
      const m = this.cached("unlock:bolt", v.mesher, () => {
        const b = block(BOLT_W, BOLT_H, LEAF_D, C.steel);
        for (const z of [0, LEAF_D - 1]) {
          b.set(1, 2, z, C.safety_red);
          b.set(2, 2, z, C.safety_red);
        }
        return b;
      });
      m.scale.z = DOOR_SCALE * 1.12;
      m.position.set(side === "left" ? BOLT_X : -BOLT_X, BOLT_Y, 0);
      return m;
    };
    const l = bolt("left");
    const r = bolt("right");
    v.left.add(l);
    v.right.add(r);
    v.unlockMeshes.push(l, r);
    if (variant === "keypad") {
      const pad = this.cached("unlock:pad", v.mesher, () =>
        block(PAD_W, PAD_H, LEAF_D, C.led_green),
      );
      pad.scale.z = DOOR_SCALE * 1.1;
      pad.position.set(PAD_X, PAD_Y, 0);
      v.right.add(pad);
      v.unlockMeshes.push(pad);
    }
    this.poseUnlock(v);
  }

  private stepUnlock(v: DoorView, dt: number): void {
    const t0 = v.unlockT;
    v.unlockT += dt;
    if (t0 < UNLOCK_CHIRP_AT && v.unlockT >= UNLOCK_CHIRP_AT) this.onUnlock?.(v.def.id, v.variant);
    if (unlockPose(v.unlockT).done) this.endUnlock(v);
    else this.poseUnlock(v);
  }

  private poseUnlock(v: DoorView): void {
    const pose = unlockPose(v.unlockT, this.calm);
    const [l, r, pad] = v.unlockMeshes;
    const k = easeUnlock(pose.bolt);
    if (l && r) {
      // Slide back into the leaf (away from the meeting edge), shrinking as it goes.
      const slide = this.still ? 0 : k * BOLT_W * DOOR_SCALE * 0.9;
      const sx = this.still ? 1 : 1 - 0.8 * k;
      const gone = pose.bolt >= 1;
      l.position.x = BOLT_X - slide;
      r.position.x = -BOLT_X + slide;
      l.scale.x = r.scale.x = DOOR_SCALE * sx;
      l.visible = r.visible = !gone;
    }
    if (pad) pad.visible = pose.keyFlash;
  }

  private endUnlock(v: DoorView): void {
    for (const m of v.unlockMeshes) m.parent?.remove(m);
    v.unlockMeshes.length = 0;
    v.unlockT = -1;
  }

  private applyPose(v: DoorView): void {
    const k = easeInOut(v.t);
    v.left.position.x = leafCenterX("left", k);
    v.right.position.x = leafCenterX("right", k);
    // Fully open leaves sit inside the wall: hide them (cutaway / glass walls can't reveal them).
    const hidden = k >= 1;
    v.left.visible = !hidden;
    v.right.visible = !hidden;
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

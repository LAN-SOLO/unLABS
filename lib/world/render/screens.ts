/**
 * ScreenSystem — live in-world CRT screens.
 * ==========================================
 *
 * Each `ScreenSpec` on a device visual, decor piece or room terminal gets a
 * small plane with a `CanvasTexture` that `drawScreen` (screen-content.ts)
 * repaints. Screens with the same look (content, colour, text, source,
 * size, power) share one canvas/texture/material, so e.g. the same decor
 * piece repeated in a room costs one canvas.
 *
 * Budget: every canvas is redrawn at ≤ `fps` (default 8), at most
 * `perFrame` canvases per `update()` in round-robin order, and only while
 * at least one of its planes is visible (floor group shown, inside the
 * camera frustum). Unpowered screens follow `screenLook`: dark glass is
 * painted once (re-checked about once a second), "NO SIGNAL" / brownout
 * screens animate at a reduced rate. A screen that powers on — a device
 * coming online (detected from the grid's online set) or a decor/terminal
 * screen switched on via `setPowered` — plays a short boot splash. At most
 * `maxScreens` planes exist; further `attach` calls return a no-op ref (-1).
 *
 * Coordinates: a spec's `center` is in the model's voxel coords; the model
 * is placed bottom-centre like the engine does (x − w/2, y, z − d/2) and
 * scaled by `scale` world units per voxel.
 */
import * as THREE from "three";
import type { ScreenSpec } from "@/lib/world/models/anim";
import type { DeviceVisual } from "@/lib/world/models/anim";
import { MODEL_SCALE } from "@/lib/world/models/core";
import {
  BOOT_SECONDS,
  drawScreen,
  screenColor,
  screenLook,
  screenResolution,
  type ScreenCtx,
  type ScreenInfo,
  type ScreenLook,
} from "@/lib/world/screen-content";

/** Redraw rate of animated unpowered screens (KEIN SIGNAL, brownout). */
const UNPOWERED_FPS = 4;
/** How often a dark screen re-checks whether it should show something. */
const DARK_RECHECK = 1;

export interface ScreenSource {
  deviceId?: string;
  roomId?: string;
  /** Decor placement id — live pinboards (content "notes") show its pinned memos. */
  placementId?: string;
}

/** Placement of an anchor (e.g. one decor instance): world voxel position + quarter-turn yaw. */
export interface ScreenAnchor {
  x: number;
  y: number;
  z: number;
  /** Rotation about y in radians. */
  rotY: number;
}

/** Handle returned by `attach` (−1 = not attached, cap reached). */
export type ScreenRef = number;

/** A canvas-like object with a 2D context (HTMLCanvasElement or OffscreenCanvas). */
export interface ScreenCanvas {
  width: number;
  height: number;
  getContext(id: "2d"): ScreenCtx | null;
}

export interface ScreenSystemOptions {
  /** Redraws per second per canvas (default 8). */
  fps?: number;
  /** Max canvas redraws per update (default 6). */
  perFrame?: number;
  /** Max planes (default 120). */
  maxScreens?: number;
  /** Distance of the plane in front of the model surface (world units, default 0.02). */
  offset?: number;
  /** Canvas factory (tests inject a stub). */
  createCanvas?: (w: number, h: number) => ScreenCanvas;
  /** Brightness multiplier of powered screens (> 1 feeds the bloom pass; default 1.25). */
  glow?: number;
}

interface Slot {
  key: string;
  w: number;
  h: number;
  canvas: ScreenCanvas;
  ctx: ScreenCtx | null;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  users: number;
  last: number;
  drawn: boolean;
  wanted: boolean;
  spec: ScreenSpec;
  source: ScreenSource;
  powered: boolean;
  /** Look of the last paint (null before the first). */
  look: ScreenLook | null;
  /** Time of the last look check. */
  lookAt: number;
  /** Power-on time for the boot splash (NaN = at the next draw, null = none). */
  bootAt: number | null;
}

interface Entry {
  id: number;
  mesh: THREE.Mesh;
  spec: ScreenSpec;
  source: ScreenSource;
  powered: boolean;
  slot: Slot;
  /** Anchor created by attach (removed on detach). */
  anchor: THREE.Object3D | null;
  radius: number;
}

function defaultCanvas(w: number, h: number): ScreenCanvas {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const NORMAL_ROT: Record<ScreenSpec["normal"], [number, number, number]> = {
  "+z": [0, 0, 0],
  "-z": [0, Math.PI, 0],
  "+x": [0, Math.PI / 2, 0],
  "-x": [0, -Math.PI / 2, 0],
  "+y": [-Math.PI / 2, 0, 0],
};

const NORMAL_DIR: Record<ScreenSpec["normal"], [number, number, number]> = {
  "+z": [0, 0, 1],
  "-z": [0, 0, -1],
  "+x": [1, 0, 0],
  "-x": [-1, 0, 0],
  "+y": [0, 1, 0],
};

/** Local position (model group frame) of a screen centre. */
export function screenLocalPosition(
  spec: ScreenSpec,
  dims: { w: number; d: number },
  scale: number,
  offset = 0.02,
): [number, number, number] {
  const n = NORMAL_DIR[spec.normal];
  return [
    (spec.center[0] - dims.w / 2) * scale + n[0] * offset,
    spec.center[1] * scale + n[1] * offset,
    (spec.center[2] - dims.d / 2) * scale + n[2] * offset,
  ];
}

export class ScreenSystem {
  private readonly entries = new Map<number, Entry>();
  private readonly slots: Slot[] = [];
  private readonly slotByKey = new Map<string, Slot>();
  private readonly pool = new Map<string, { canvas: ScreenCanvas; ctx: ScreenCtx | null }[]>();
  private readonly geometries = new Map<string, THREE.PlaneGeometry>();
  private readonly frustum = new THREE.Frustum();
  private readonly projView = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private readonly fps: number;
  private readonly perFrame: number;
  private readonly maxScreens: number;
  private readonly offset: number;
  private readonly glow: number;
  private readonly createCanvas: (w: number, h: number) => ScreenCanvas;
  private nextId = 1;
  private cursor = 0;
  /** Online set seen at the last draw (to detect devices powering on). */
  private prevOnline: ReadonlySet<string> | null = null;
  /** Device id → time it came online (boot splash). */
  private readonly deviceBoot = new Map<string, number>();
  /** Canvas redraws of the last update (for the perf HUD / tests). */
  lastDraws = 0;

  constructor(opts: ScreenSystemOptions = {}) {
    this.fps = opts.fps ?? 8;
    this.perFrame = opts.perFrame ?? 6;
    this.maxScreens = opts.maxScreens ?? 120;
    this.offset = opts.offset ?? 0.02;
    this.glow = opts.glow ?? 1.25;
    this.createCanvas = opts.createCanvas ?? defaultCanvas;
  }

  /** Number of attached planes / live canvases. */
  get size(): { screens: number; canvases: number } {
    return { screens: this.entries.size, canvases: this.slots.length };
  }

  /**
   * Add a screen to `parent` (a device group, bot group or anchor).
   * `dims` are the model's voxel width/depth (base.w, base.d), `scale` its
   * world units per voxel. With `anchor`, an extra transform node is
   * created under `parent` first (use for instanced decor placements).
   */
  attach(
    parent: THREE.Object3D,
    spec: ScreenSpec,
    dims: { w: number; d: number },
    scale: number,
    source: ScreenSource = {},
    opts: { powered?: boolean; anchor?: ScreenAnchor } = {},
  ): ScreenRef {
    if (this.entries.size >= this.maxScreens) return -1;
    const gw = spec.w * scale;
    const gh = spec.h * scale;
    const powered = opts.powered ?? true;
    const slot = this.acquire(spec, source, powered, screenResolution(gw, gh));
    const gkey = `${gw.toFixed(3)}x${gh.toFixed(3)}`;
    let geo = this.geometries.get(gkey);
    if (!geo) {
      geo = new THREE.PlaneGeometry(gw, gh);
      this.geometries.set(gkey, geo);
    }
    const mesh = new THREE.Mesh(geo, slot.material);
    mesh.name = `screen:${spec.content}`;
    const [px, py, pz] = screenLocalPosition(spec, dims, scale, this.offset);
    mesh.position.set(px, py, pz);
    const r = NORMAL_ROT[spec.normal];
    mesh.rotation.set(r[0], r[1], r[2]);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    let anchor: THREE.Object3D | null = null;
    if (opts.anchor) {
      anchor = new THREE.Object3D();
      anchor.position.set(opts.anchor.x, opts.anchor.y, opts.anchor.z);
      anchor.rotation.y = opts.anchor.rotY;
      anchor.scale.setScalar(1);
      anchor.add(mesh);
      parent.add(anchor);
    } else parent.add(mesh);
    const id = this.nextId++;
    this.entries.set(id, {
      id,
      mesh,
      spec,
      source,
      powered,
      slot,
      anchor,
      radius: Math.hypot(gw, gh) / 2 + 0.5,
    });
    return id;
  }

  /** Attach every screen of a device/bot visual to its group. */
  attachVisual(
    group: THREE.Object3D,
    visual: DeviceVisual,
    source: ScreenSource,
    powered: boolean,
  ): ScreenRef[] {
    const sc = visual.scale ?? MODEL_SCALE;
    return (visual.screens ?? []).map((spec) =>
      this.attach(group, spec, { w: visual.base.w, d: visual.base.d }, sc, source, { powered }),
    );
  }

  /** Switch power (re-keys the shared canvas; unpowered + requiresPower → dark). */
  setPowered(ref: ScreenRef, powered: boolean): void {
    const e = this.entries.get(ref);
    if (!e || e.powered === powered) return;
    e.powered = powered;
    const old = e.slot;
    const next = this.acquire(e.spec, e.source, powered, { w: old.w, h: old.h });
    // Switched on after having been seen dark: boot (not on floor build).
    if (powered && old.drawn && next.users === 1 && e.spec.requiresPower) next.bootAt = Number.NaN;
    e.slot = next;
    e.mesh.material = next.material;
    this.release(old);
  }

  /** Toggle the power of many refs at once. */
  setPoweredAll(refs: readonly ScreenRef[], powered: boolean): void {
    for (const r of refs) this.setPowered(r, powered);
  }

  detach(ref: ScreenRef): void {
    const e = this.entries.get(ref);
    if (!e) return;
    this.entries.delete(ref);
    if (e.anchor) e.anchor.removeFromParent();
    else e.mesh.removeFromParent();
    this.release(e.slot);
  }

  /**
   * Redraw due screens. `getInfo` builds the snapshot for a source (use
   * `screenInfo(state, src.deviceId, src.roomId)`); it is only called for
   * canvases that are actually redrawn this frame. With `camera`, screens
   * outside its frustum are skipped.
   */
  update(t: number, getInfo: (src: ScreenSource) => ScreenInfo, camera?: THREE.Camera): void {
    this.lastDraws = 0;
    if (!this.slots.length) return;
    for (const s of this.slots) s.wanted = false;
    if (camera) {
      this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projView);
    }
    for (const e of this.entries.values()) {
      if (e.slot.wanted) continue;
      if (!shown(e.mesh)) continue;
      if (camera) {
        const m = e.mesh.matrixWorld.elements;
        this.sphere.center.set(m[12]!, m[13]!, m[14]!);
        this.sphere.radius = e.radius;
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
      }
      e.slot.wanted = true;
    }
    const interval = 1 / this.fps;
    const n = this.slots.length;
    let budget = this.perFrame;
    const start = this.cursor;
    for (let i = 0; i < n && budget > 0; i++) {
      const idx = (start + i) % n;
      const slot = this.slots[idx]!;
      if (!slot.wanted) continue;
      const unpowered = slot.spec.requiresPower && !slot.powered;
      if (slot.drawn) {
        if (!unpowered && t - slot.last < interval) continue;
        if (unpowered && slot.look === "dark" && t - slot.lookAt < DARK_RECHECK) continue;
        if (unpowered && slot.look !== "dark" && t - slot.last < 1 / UNPOWERED_FPS) continue;
      }
      budget--;
      this.cursor = (idx + 1) % n;
      if (this.draw(slot, t, getInfo)) this.lastDraws++;
    }
  }

  dispose(): void {
    for (const e of this.entries.values()) {
      if (e.anchor) e.anchor.removeFromParent();
      else e.mesh.removeFromParent();
    }
    this.entries.clear();
    for (const s of this.slots) {
      s.texture.dispose();
      s.material.dispose();
    }
    this.slots.length = 0;
    this.slotByKey.clear();
    this.pool.clear();
    for (const g of this.geometries.values()) g.dispose();
    this.geometries.clear();
  }

  // ── internals ──────────────────────────────────────────────────

  /** Paint one slot; false when a dark screen stayed dark (nothing uploaded). */
  private draw(slot: Slot, t: number, getInfo: (src: ScreenSource) => ScreenInfo): boolean {
    const info = getInfo(slot.source);
    this.trackOnline(info.onlineIds, t);
    const look = screenLook(slot.spec, info, slot.powered);
    slot.lookAt = t;
    if (look === "dark" && slot.look === "dark" && slot.drawn) return false;
    if (slot.bootAt !== null && Number.isNaN(slot.bootAt)) slot.bootAt = t;
    const since =
      slot.bootAt ?? (slot.source.deviceId ? this.deviceBoot.get(slot.source.deviceId) : undefined);
    const bootAge = since === undefined ? Number.POSITIVE_INFINITY : t - since;
    if (slot.bootAt !== null && bootAge > BOOT_SECONDS) slot.bootAt = null;
    if (slot.ctx) {
      drawScreen(slot.ctx, slot.w, slot.h, slot.spec, info, t, slot.powered, bootAge);
      slot.texture.needsUpdate = true;
    }
    slot.look = look;
    slot.last = t;
    slot.drawn = true;
    return true;
  }

  /** Remember when devices came online (the first observed set only primes). */
  private trackOnline(online: ReadonlySet<string> | undefined, t: number): void {
    if (!online || online === this.prevOnline) return;
    if (this.prevOnline) {
      for (const id of online) if (!this.prevOnline.has(id)) this.deviceBoot.set(id, t);
    }
    this.prevOnline = online;
    for (const [id, at] of this.deviceBoot)
      if (t - at > BOOT_SECONDS + 1) this.deviceBoot.delete(id);
  }

  /** Seconds since `deviceId` came online (Infinity if not recently) — for tests / HUD. */
  bootAgeOf(deviceId: string, t: number): number {
    const at = this.deviceBoot.get(deviceId);
    return at === undefined ? Number.POSITIVE_INFINITY : t - at;
  }

  private acquire(
    spec: ScreenSpec,
    source: ScreenSource,
    powered: boolean,
    res: { w: number; h: number },
  ): Slot {
    const live = powered || !spec.requiresPower;
    const key = [
      spec.content,
      screenColor(spec, source.deviceId),
      spec.text ?? "",
      source.deviceId ?? "",
      source.roomId ?? "",
      source.placementId ?? "",
      `${res.w}x${res.h}`,
      live ? 1 : 0,
    ].join("|");
    const existing = this.slotByKey.get(key);
    if (existing) {
      existing.users++;
      return existing;
    }
    const sizeKey = `${res.w}x${res.h}`;
    const reuse = this.pool.get(sizeKey)?.pop();
    const canvas = reuse?.canvas ?? this.createCanvas(res.w, res.h);
    const ctx = reuse ? reuse.ctx : canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    material.color.setScalar(live ? this.glow : 1);
    const slot: Slot = {
      key,
      w: res.w,
      h: res.h,
      canvas,
      ctx,
      texture,
      material,
      users: 1,
      last: -Infinity,
      drawn: false,
      wanted: false,
      spec,
      source,
      powered,
      look: null,
      lookAt: -Infinity,
      bootAt: null,
    };
    this.slots.push(slot);
    this.slotByKey.set(key, slot);
    return slot;
  }

  private release(slot: Slot): void {
    slot.users--;
    if (slot.users > 0) return;
    this.slotByKey.delete(slot.key);
    const i = this.slots.indexOf(slot);
    if (i >= 0) this.slots.splice(i, 1);
    if (this.cursor >= this.slots.length) this.cursor = 0;
    slot.texture.dispose();
    slot.material.dispose();
    const sizeKey = `${slot.w}x${slot.h}`;
    const list = this.pool.get(sizeKey) ?? [];
    if (list.length < 8) list.push({ canvas: slot.canvas, ctx: slot.ctx });
    this.pool.set(sizeKey, list);
  }
}

/** True when the object and all its ancestors are visible. */
function shown(o: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}

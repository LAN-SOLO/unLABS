/**
 * Title-screen diorama — the lab as an aquarium.
 * ==============================================
 *
 * A small, self-contained three.js scene behind the main menu: a corner of
 * the Kontrollraum where Jade Lawrence actually works. The pure simulation
 * (lib/world/title-life.ts) decides what happens — repairs, typing, coffee,
 * swivel-chair spins, breakdowns, bots coming through the door — and the
 * emotion model (lib/world/emotion.ts) decides how she feels about it. This
 * file only renders a `LifeFrame`: the room, the devices (lit, glitching or
 * dead), Jade with pose, face (brows, lids, voxel mouth), gestures and hand
 * props, the bots with their wheels and legs, particles (sparks, smoke,
 * steam, confetti, hearts) and a DOM layer of speech bubbles and emotes.
 *
 * Deliberately cheap: its own WebGLRenderer at pixel ratio ≤ 1, ~30 fps,
 * optional half-resolution bloom, one shadow-casting light, one instanced
 * particle mesh, a fixed set of lights (no shader recompiles). Pauses while
 * the tab is hidden, holds the camera still under `reduceMotion`, and frees
 * every GPU resource in `dispose()`.
 *
 * Only this file (and `render/*`) import three; the React side
 * (`components/world/menu/TitleBackdrop.tsx`) loads it with a dynamic import.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { C, LAB_PALETTE } from "@/lib/world/content/palette";
import { SKIN, SKIN_LIGHT, SKIN_SHADE, fitPoint } from "@/lib/world/models/jade-kit";
import { HEAD_FIT } from "@/lib/world/models/jade-rig";
import { MOUTH_ART, type EmoteIcon, type MouthShape } from "@/lib/world/emotion";
import {
  animTransform,
  gaitTransform,
  lightIntensity,
  lightPosInBase,
  partPivotInBase,
  type DeviceVisual,
} from "@/lib/world/models/anim";
import { botVisual } from "@/lib/world/models/characters";
import { MODEL_SCALE, Model, stagedGrid } from "@/lib/world/models/core";
import { decorModel, decorScale, decorVisual } from "@/lib/world/models/decor";
import { deviceVisual } from "@/lib/world/models/devices";
import { requestDetail } from "@/lib/world/render/detail-pool";
import { DOOR_SCALE, doorFrameModel, doorLeafModel } from "@/lib/world/models/doors";
import { applyExpression, applyGesture } from "@/lib/world/models/gestures";
import {
  SIT_SEAT_OFFSET,
  activeProp,
  advanceGait,
  advanceIdle,
  animateCharacter,
  approach,
  approachAngle,
  handProp,
  isPoseDone,
  jadeRig,
  jointRestPosition,
  poseTrack,
  sitFit,
  switchPose,
  type CharacterPoseKind,
  type CharacterRigDef,
  type HandPropKind,
  type RigPartName,
  type SeatSpec,
} from "@/lib/world/models/rig";
import { leafCenterX } from "@/lib/world/render/doors";
import { screenLocalPosition } from "@/lib/world/render/screens";
import { createVoxelMaterials, toMesh } from "@/lib/world/render/voxel-mesh";
import type { MaterialClass } from "@/lib/voxel/mesher";
import {
  decorFamily,
  familyFor,
  refinedModelMesh,
  type RefineFamily,
} from "@/lib/world/models/refine";
import type { VoxelGrid } from "@/lib/voxel/grid";
import {
  CHAIR,
  CRATE,
  DOOR_X,
  LIFE_ROOM,
  LabLife,
  STATIONS,
  type BotFrame,
  type FxEvent,
  type LifeFrame,
  type StationId,
} from "@/lib/world/title-life";

// ── Pure layout & camera maths (unit-tested) ─────────────────────

export interface DioramaPlacement {
  kind: "device" | "decor";
  id: string;
  /** World units, floor centre = origin. */
  x: number;
  z: number;
  /** Yaw in radians. */
  rot: number;
  /** The simulation station this piece is (health, repairs). */
  station?: StationId;
  /** Height above the floor (wall-mounted pieces). */
  y?: number;
}

/** Floor footprint (world units) — walls stand on the −x and −z edges. */
export const DIORAMA_FLOOR = LIFE_ROOM;

const STATION_MODEL: Readonly<Record<StationId, { kind: "device" | "decor"; id: string }>> = {
  mcp: { kind: "device", id: "MCP-000" },
  drone: { kind: "device", id: "EXD-001" },
  bench: { kind: "device", id: "PWB-001" },
  desk: { kind: "decor", id: "office_desk" },
  coffee: { kind: "decor", id: "coffee_machine" },
  table: { kind: "decor", id: "lab_table" },
};

/** Stations first (from the simulation), then set dressing kept clear of every walkway. */
export const DIORAMA_LAYOUT: readonly DioramaPlacement[] = [
  ...(Object.keys(STATION_MODEL) as StationId[]).map((s) => ({
    ...STATION_MODEL[s],
    x: STATIONS[s].x,
    z: STATIONS[s].z,
    rot: STATIONS[s].rot,
    station: s,
  })),
  { kind: "decor", id: "gas_cylinders", x: -14.4, z: -10.9, rot: 0 },
  { kind: "decor", id: "barrel", x: -10.6, z: -10.4, rot: 0 },
  { kind: "decor", id: "water_cooler", x: 6.6, z: -10.9, rot: 0 },
  { kind: "decor", id: "rug", x: -10.2, z: -4.6, rot: Math.PI / 2 },
  { kind: "decor", id: "floor_cables", x: -1.2, z: -5.4, rot: 0 },
  { kind: "decor", id: "crate_stack", x: CRATE[0], z: CRATE[1], rot: 0 },
  { kind: "decor", id: "plant_ficus", x: -14.8, z: 11, rot: 0 },
  { kind: "decor", id: "wall_clock", x: -8.2, z: -11.4, rot: 0, y: 5.4 },
];

/** Camera yaw around the scene: a slow pendulum inside the open (+x, +z) quadrant. */
export function cameraYaw(t: number, reduceMotion: boolean): number {
  const base = Math.PI / 4;
  return reduceMotion ? base : base + 0.3 * Math.sin(t * 0.04);
}

export interface Frustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Orthographic frustum for a `width`×`height` viewport. On wide screens the
 * scene is shifted right by `focusShift` of the width so the menu column on
 * the left stays over empty, vignetted floor.
 */
export function dioramaFrustum(width: number, height: number, focusShift = 0.1): Frustum {
  const aspect = Math.max(0.3, width / Math.max(1, height));
  // Enough height for the whole room; widen on narrow screens so it still fits.
  const viewH = Math.max(28, 46 / aspect);
  const halfH = viewH / 2;
  const halfW = halfH * aspect;
  const shift = aspect > 1.2 ? focusShift * 2 * halfW : 0;
  return { left: -halfW - shift, right: halfW - shift, top: halfH, bottom: -halfH };
}

/** Glyph and colour of an emote icon above Jade's head. */
export const EMOTE_GLYPH: Readonly<Record<EmoteIcon, { glyph: string; color: string }>> = {
  "!": { glyph: "!", color: "#ffd84a" },
  "?": { glyph: "?", color: "#9fd8ff" },
  heart: { glyph: "♥", color: "#ff6f9a" },
  anger: { glyph: "#", color: "#ff4a3a" },
  sweat: { glyph: "💧", color: "#8fd0ff" },
  sparkle: { glyph: "✦", color: "#ffe680" },
  zz: { glyph: "z z", color: "#b8c4ff" },
  note: { glyph: "♪", color: "#8affc1" },
  idea: { glyph: "💡", color: "#ffe680" },
  dots: { glyph: "…", color: "#d0d0d0" },
  tear: { glyph: "💧", color: "#8fd0ff" },
};

// ── Scene ────────────────────────────────────────────────────────

export interface TitleDioramaOptions {
  reduceMotion: boolean;
  bloom: boolean;
  /** Called when the GL context is lost (the UI falls back to the 2D backdrop). */
  onFail?: () => void;
  /** Simulation seed (default: random per visit). */
  seed?: number;
}

interface PartView {
  pivot: THREE.Group;
  rest: THREE.Vector3;
  part: DeviceVisual["parts"][number];
}

interface ScreenView {
  mat: THREE.MeshBasicMaterial;
  base: THREE.Color;
  phase: number;
}

interface Rig {
  parts: PartView[];
  lights: { light: THREE.PointLight; def: DeviceVisual["lights"][number] }[];
  screens: ScreenView[];
  scale: number;
  powered: boolean;
}

interface StationView {
  id: StationId;
  rig: Rig | null;
  beacon: THREE.Mesh | null;
  beaconMat: THREE.MeshBasicMaterial | null;
  height: number;
}

interface BotView {
  root: THREE.Group;
  body: THREE.Group;
  rig: Rig;
  mug: THREE.Object3D;
  card: THREE.Object3D;
  height: number;
  yaw: number;
}

interface Bubble {
  el: HTMLDivElement;
  who: string;
  ttl: number;
  age: number;
}

const FRAME_MS = 1000 / 30;
const LIGHT_GAIN = 0.55;
const MAX_PARTICLES = 520;
const HAND_PROPS: readonly HandPropKind[] = ["mug", "book", "wrench"];
/** The swivel chair's seat (legs reach for the floor). */
const CHAIR_SEAT: SeatSpec = { height: 1.25 };
/** Poses in which she half-turns to the audience (reactions read better that way). */
const PRESENT_POSES: ReadonlySet<CharacterPoseKind> = new Set([
  "celebrate",
  "startle",
  "think",
  "talk",
  "drink",
  "read",
]);

const SPEAKER_COLOR: Record<string, string> = {
  jade: "#6fe3c8",
  mcp: "#ff6a55",
};
const BOT_COLOR = "#ffb000";

/** Mesh a grid refined 2×2×2 (same extent in source units, see models/refine.ts). */
function meshGrid(
  grid: VoxelGrid,
  materials: Record<MaterialClass, THREE.Material>,
  center: boolean,
  family: RefineFamily,
): THREE.Mesh {
  return toMesh(refinedModelMesh(grid, family, { center }), materials);
}

/** Lab floor: tiles, a grate walkway along the aisle, worn patches, the dark corridor outside the door. */
function floorModel(): Model {
  const { w, d } = DIORAMA_FLOOR;
  const m = new Model(w, 1, d);
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++) {
      const grate = z === 11 || z === 12;
      const worn = (x * 7 + z * 13) % 17 === 0;
      const c = grate
        ? C.floor_grate
        : worn
          ? C.concrete_dark
          : (x + z) % 2 === 0
            ? C.floor_tile
            : C.floor_dark;
      m.set(x, 0, z, c);
    }
  // Hazard stripes in front of the door.
  const dx = Math.floor(DOOR_X - 2.5 + w / 2);
  for (let x = dx; x < dx + 5; x++) m.set(x, 0, 0, x % 2 === 0 ? C.safety_yellow : C.hazard_black);
  return m;
}

function corridorModel(): Model {
  const m = new Model(5, 1, 4);
  m.box(0, 0, 0, 4, 0, 3, C.concrete_dark);
  m.box(2, 0, 0, 2, 0, 3, C.floor_grate);
  return m;
}

/** Back wall (with the door gap) and left wall, trim line, LEDs and a status screen. */
function wallModels(): { back: Model; left: Model } {
  const { w, d } = DIORAMA_FLOOR;
  const H = 9;
  const back = new Model(w, H, 1);
  back.box(0, 0, 0, w - 1, H - 1, 0, C.wall);
  back.box(0, 0, 0, w - 1, 0, 0, C.wall_dark);
  back.box(0, 6, 0, w - 1, 6, 0, C.wall_trim);
  for (let x = 3; x < w - 2; x += 6) back.set(x, 7, 0, x % 12 === 3 ? C.led_amber : C.led_green);
  const gap = Math.floor(DOOR_X - 2.5 + w / 2);
  back.box(gap, 0, 0, gap + 4, 6, 0, 0);
  const left = new Model(1, H, d);
  left.box(0, 0, 0, 0, H - 1, d - 1, C.wall_dark);
  left.box(0, 6, 0, 0, 6, d - 1, C.wall_trim);
  left.box(0, 3, 12, 0, 5, 15, C.screen_green);
  left.box(0, 8, 2, 0, 8, 4, C.led_red);
  return { back, left };
}

/** Index card K2-LDR delivers. */
function cardModel(): Model {
  const m = new Model(4, 1, 3);
  m.box(0, 0, 0, 3, 0, 2, C.paper);
  m.box(0, 0, 0, 3, 0, 0, C.safety_red);
  m.set(1, 0, 2, C.paint_gray).set(2, 0, 2, C.paint_gray);
  return m;
}

/** Faint horizontal scanline texture shared by every fake screen. */
function scanlineTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 32, 64);
  for (let y = 0; y < 64; y += 2) {
    const lit = Math.sin(y * 0.7) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.35 + lit * 0.5})`;
    const len = 6 + Math.floor(((y * 37) % 23) + lit * 3);
    ctx.fillRect(2, y, Math.min(28, len), 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Cheap deterministic flicker 0..1. */
function flicker(t: number, seed: number): number {
  const n = Math.sin(Math.floor(t * 14) * 12.9898 + seed * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// ── Particles ────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  gravity: number;
  drag: number;
  spin: number;
  color: THREE.Color;
}

const SPARK = ["#fff3c0", "#ffd27a", "#ffb000"];
const CONFETTI = ["#ff5a5a", "#ffd84a", "#5ce1c6", "#6fa8ff", "#ff7ad9", "#9dff6a"];

class Particles {
  readonly mesh: THREE.InstancedMesh;
  private readonly list: Particle[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private rnd = 0.5;

  constructor(material: THREE.Material) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color("#ffffff"));
  }

  private r(): number {
    this.rnd = (this.rnd * 9301 + 49297) % 233280;
    return this.rnd / 233280;
  }

  private add(p: Omit<Particle, "age" | "color"> & { color: string }): void {
    if (this.list.length >= MAX_PARTICLES) this.list.shift();
    this.list.push({ ...p, age: 0, color: new THREE.Color(p.color) });
  }

  emit(fx: FxEvent): void {
    const r = () => this.r();
    const pick = (a: readonly string[]) => a[Math.floor(r() * a.length)]!;
    const { x, y, z } = fx;
    const jx = () => x + (r() - 0.5) * 2.4;
    const jz = () => z + (r() - 0.5) * 2.4;
    switch (fx.kind) {
      case "sparks":
        for (let i = 0; i < 16; i++) {
          const a = r() * Math.PI * 2;
          const s = 2 + r() * 4;
          this.add({
            x: jx(),
            y,
            z: jz(),
            vx: Math.cos(a) * s,
            vy: 3 + r() * 5,
            vz: Math.sin(a) * s,
            life: 0.35 + r() * 0.45,
            size: 0.14 + r() * 0.1,
            grow: 0,
            gravity: -16,
            drag: 0.5,
            spin: 0,
            color: pick(SPARK),
          });
        }
        break;
      case "smoke":
      case "steam": {
        const steam = fx.kind === "steam";
        for (let i = 0; i < (steam ? 6 : 7); i++)
          this.add({
            x: x + (r() - 0.5) * 1.6,
            y: y + r() * 0.6,
            z: z + (r() - 0.5) * 1.6,
            vx: (r() - 0.5) * 0.5,
            vy: (steam ? 1.8 : 1.1) + r() * 0.8,
            vz: (r() - 0.5) * 0.5,
            life: steam ? 1.1 + r() * 0.6 : 2 + r() * 1.2,
            size: steam ? 0.28 : 0.6,
            grow: steam ? 0.6 : 0.75,
            gravity: 0,
            drag: 0.4,
            spin: (r() - 0.5) * 1.5,
            color: steam ? "#e6f2f2" : pick(["#7a7a7a", "#939393", "#adadad"]),
          });
        break;
      }
      case "confetti":
        for (let i = 0; i < 44; i++) {
          const a = r() * Math.PI * 2;
          const s = 1.5 + r() * 3.5;
          this.add({
            x,
            y,
            z,
            vx: Math.cos(a) * s,
            vy: 5 + r() * 4,
            vz: Math.sin(a) * s,
            life: 2 + r() * 1.2,
            size: 0.18 + r() * 0.08,
            grow: 0,
            gravity: -7,
            drag: 1.4,
            spin: (r() - 0.5) * 14,
            color: pick(CONFETTI),
          });
        }
        break;
      case "bang":
        for (let i = 0; i < 22; i++) {
          const a = r() * Math.PI * 2;
          const s = 4 + r() * 6;
          this.add({
            x,
            y,
            z,
            vx: Math.cos(a) * s,
            vy: 2 + r() * 6,
            vz: Math.sin(a) * s,
            life: 0.5 + r() * 0.5,
            size: 0.3 + r() * 0.25,
            grow: -0.2,
            gravity: -10,
            drag: 2,
            spin: (r() - 0.5) * 6,
            color: pick(["#fff0a0", "#ff9a2a", "#ff5a1a", "#444444"]),
          });
        }
        break;
      case "idea":
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          this.add({
            x: x + Math.cos(a) * 0.9,
            y,
            z: z + Math.sin(a) * 0.9,
            vx: Math.cos(a) * 0.9,
            vy: 1.4 + r() * 0.6,
            vz: Math.sin(a) * 0.9,
            life: 0.9 + r() * 0.4,
            size: 0.16,
            grow: 0,
            gravity: 0,
            drag: 1,
            spin: 4,
            color: pick(["#fff6a0", "#ffe24a"]),
          });
        }
        break;
      case "hearts":
        for (let i = 0; i < 7; i++)
          this.add({
            x: x + (r() - 0.5) * 1.4,
            y: y + r() * 0.5,
            z: z + (r() - 0.5) * 1.4,
            vx: (r() - 0.5) * 0.4,
            vy: 1 + r() * 0.6,
            vz: (r() - 0.5) * 0.4,
            life: 1.6 + r() * 0.6,
            size: 0.3,
            grow: 0,
            gravity: 0,
            drag: 0.2,
            spin: 0,
            color: pick(["#ff5a8a", "#ff8ab0", "#ff3a6a"]),
          });
        break;
    }
  }

  update(dt: number, t: number): void {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]!;
      p.age += dt;
      if (p.age >= p.life) {
        list.splice(i, 1);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vz *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
    }
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      const u = p.age / p.life;
      // Fade by shrinking (instanced opacity would need a custom shader).
      const fade = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
      const size = Math.max(0.01, (p.size + p.grow * p.age) * fade);
      this.e.set(p.spin * t, p.spin * t * 0.7, 0);
      this.q.setFromEuler(this.e);
      this.s.set(size, size, size);
      this.p.set(p.x, p.y, p.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.count = list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

// ── The diorama ──────────────────────────────────────────────────

export class TitleDiorama {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  private readonly materials = createVoxelMaterials();
  private readonly extraMaterials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly rigs: Rig[] = [];
  private readonly stations = new Map<StationId, StationView>();
  /** Devices still showing the authored model; the detailed one swaps in when ready (detail-pool.ts). */
  private readonly pendingDetail: {
    id: string;
    group: THREE.Group;
    scan: THREE.Texture | null;
    rig: Rig;
  }[] = [];
  private readonly bots = new Map<string, BotView>();
  private readonly joints = new Map<RigPartName, { group: THREE.Group; rest: THREE.Vector3 }>();
  private readonly handProps = new Map<HandPropKind, THREE.Object3D>();
  private readonly life: LabLife;
  private frame: LifeFrame | null = null;
  private jadeRoot = new THREE.Group();
  private mouth: THREE.InstancedMesh | null = null;
  private mouthShape: MouthShape | null = null;
  private chair = new THREE.Group();
  private crate = new THREE.Group();
  private doorLeaves: { left: THREE.Group; right: THREE.Group } | null = null;
  private particles: Particles | null = null;
  private flash: THREE.PointLight | null = null;
  private flashT = 0;
  private mcpEye: THREE.PointLight | null = null;
  private mcpTalk = 0;
  private track = poseTrack("idle", 0);
  private poseSeq = -1;
  private gaitPhase = 0;
  private speedS = 0;
  private walkW = 0;
  private idleFor = 0;
  private seatW = 0;
  private presentW = 0;
  private yawS = 0;
  private jadeInit = false;
  private overlay: HTMLDivElement | null = null;
  private emote: HTMLDivElement | null = null;
  private readonly bubbles: Bubble[] = [];
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private motes: THREE.Points | null = null;
  private envTexture: THREE.Texture | null = null;
  private readonly tmp = new THREE.Vector3();
  private raf = 0;
  private last = 0;
  private time = 0;
  private running = false;
  private disposed = false;
  private readonly cleanup: (() => void)[] = [];

  /** Build the diorama into `container`; null when WebGL is unavailable. */
  static create(container: HTMLElement, opts: TitleDioramaOptions): TitleDiorama | null {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" });
    } catch {
      return null;
    }
    try {
      return new TitleDiorama(container, renderer, opts);
    } catch {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      return null;
    }
  }

  private constructor(
    private readonly container: HTMLElement,
    renderer: THREE.WebGLRenderer,
    private opts: TitleDioramaOptions,
  ) {
    this.renderer = renderer;
    this.life = new LabLife(opts.seed ?? Math.floor(Math.random() * 1e9));
    renderer.setPixelRatio(Math.min(1, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = renderer.domElement;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);
    this.buildOverlay();

    const onLost = (e: Event) => {
      e.preventDefault();
      this.stop();
      this.opts.onFail?.();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    this.cleanup.push(() => canvas.removeEventListener("webglcontextlost", onLost));

    this.buildScene();
    this.setBloom(opts.bloom);
    this.resize();

    const onVisibility = () => (document.hidden ? this.stop() : this.start());
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanup.push(() => document.removeEventListener("visibilitychange", onVisibility));
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(container);
      this.cleanup.push(() => ro.disconnect());
    } else {
      const onResize = () => this.resize();
      window.addEventListener("resize", onResize);
      this.cleanup.push(() => window.removeEventListener("resize", onResize));
    }
    if (!document.hidden) this.start();
    // Dev handle for visual checks (screenshots, fast-forward).
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __title?: TitleDiorama }).__title = this;
  }

  /** Dev: the latest frame and where Jade's head is on screen (CSS px). */
  debugPeek(): { frame: LifeFrame | null; jade: [number, number] } {
    const r = this.jadeRoot.position;
    return { frame: this.frame, jade: this.toScreen(this.tmp.set(r.x, 5, r.z)) };
  }

  /** Dev: run the simulation `seconds` ahead (effects and bubbles are dropped). */
  debugSkip(seconds: number): void {
    for (let t = 0; t < seconds; t += 1 / 30) this.frame = this.life.step(1 / 30);
  }

  // ── Building ──────────────────────────────────────────────────

  private buildOverlay(): void {
    const o = document.createElement("div");
    o.setAttribute("aria-hidden", "true");
    Object.assign(o.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      overflow: "hidden",
    });
    this.container.appendChild(o);
    this.overlay = o;
    const e = document.createElement("div");
    Object.assign(e.style, {
      position: "absolute",
      left: "0",
      top: "0",
      font: "700 30px/1 ui-monospace, Menlo, monospace",
      textShadow: "0 0 6px rgba(0,0,0,0.9), 0 0 2px #000",
      opacity: "0",
      transition: "opacity 0.25s",
      willChange: "transform",
    });
    o.appendChild(e);
    this.emote = e;
  }

  private buildScene(): void {
    const scene = this.scene;
    scene.background = new THREE.Color("#050805");
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.envTexture;
    scene.environmentIntensity = 0.22;

    scene.add(new THREE.HemisphereLight("#9fb4d8", "#241c14", 0.42));
    const fill = new THREE.DirectionalLight("#fff1dc", 0.35);
    fill.position.set(30, 50, 20);
    scene.add(fill);
    const key = new THREE.SpotLight("#ffe6c4", 26, 0, Math.PI / 3.6, 0.7, 1);
    key.position.set(4, 38, 16);
    key.target.position.set(-1, 0, -1);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.05;
    key.shadow.camera.near = 10;
    key.shadow.camera.far = 80;
    scene.add(key, key.target);
    // The MCP's red eye washes the floor in front of it (and flares when it talks).
    const eye = new THREE.PointLight("#ff2a1a", 10, 18, 1.4);
    eye.position.set(STATIONS.mcp.x, 7, STATIONS.mcp.z + 5);
    scene.add(eye);
    this.mcpEye = eye;
    // One flash light shared by bangs and big spark showers.
    const flash = new THREE.PointLight("#ffb46a", 0, 16, 1.6);
    scene.add(flash);
    this.flash = flash;

    const { w, d } = DIORAMA_FLOOR;
    const floor = meshGrid(floorModel().grid, this.materials, false, "terrain");
    floor.position.set(-w / 2, -1, -d / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    const corridor = meshGrid(corridorModel().grid, this.materials, false, "terrain");
    corridor.position.set(DOOR_X - 2.5, -1, -d / 2 - 4);
    scene.add(corridor);
    const walls = wallModels();
    const back = meshGrid(walls.back.grid, this.materials, false, "architecture");
    back.position.set(-w / 2, 0, -d / 2 - 1);
    const left = meshGrid(walls.left.grid, this.materials, false, "architecture");
    left.position.set(-w / 2 - 1, 0, -d / 2);
    scene.add(back, left);
    this.addDoor();

    const scan = scanlineTexture();
    if (scan) this.textures.push(scan);
    for (const p of DIORAMA_LAYOUT) this.addPlacement(p, scan);
    this.addChair();
    this.addJade(jadeRig());
    for (const id of ["b4c0n", "p1ndr0", "f1ndr", "w2rek", "k2ldr"]) this.addBot(id, scan);
    const pmat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.extraMaterials.push(pmat);
    this.particles = new Particles(pmat);
    scene.add(this.particles.mesh);
    this.addMotes();
  }

  private addPlacement(p: DioramaPlacement, scan: THREE.Texture | null): void {
    const group = new THREE.Group();
    group.position.set(p.x, p.y ?? 0, p.z);
    group.rotation.y = p.rot;
    let rig: Rig | null = null;
    let height = 0;
    if (p.kind === "device") {
      const visual = deviceVisual(p.id);
      rig = this.addVisual(group, visual, true, scan);
      height = visual.base.h * (visual.scale ?? MODEL_SCALE);
      this.pendingDetail.push({ id: p.id, group, scan, rig });
    } else {
      const visual = decorVisual(p.id);
      const sc = decorScale(p.id);
      if (visual) rig = this.addVisual(group, visual, true, scan, decorFamily(visual.scale ?? sc));
      else {
        const mesh = meshGrid(decorModel(p.id).grid, this.materials, true, decorFamily(sc));
        mesh.scale.setScalar(sc);
        mesh.castShadow = true;
        group.add(mesh);
      }
      height = decorModel(p.id).h * sc;
    }
    if (p.id === "crate_stack") {
      this.crate = group;
    }
    this.scene.add(group);
    if (!p.station) return;
    let beacon: THREE.Mesh | null = null;
    let beaconMat: THREE.MeshBasicMaterial | null = null;
    if (STATIONS[p.station].breakable) {
      beaconMat = new THREE.MeshBasicMaterial({ color: "#3dff6a", toneMapped: false });
      this.extraMaterials.push(beaconMat);
      beacon = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), beaconMat);
      beacon.position.set(p.x, height + 0.7, p.z);
      this.scene.add(beacon);
    }
    this.stations.set(p.station, { id: p.station, rig, beacon, beaconMat, height });
  }

  private addDoor(): void {
    const root = new THREE.Group();
    root.position.set(DOOR_X, 0, -DIORAMA_FLOOR.d / 2 - 0.5);
    const frame = meshGrid(doorFrameModel().grid, this.materials, true, "architecture");
    frame.scale.setScalar(DOOR_SCALE);
    root.add(frame);
    const mk = (side: "left" | "right") => {
      const g = new THREE.Group();
      const m = meshGrid(
        doorLeafModel(side, { light: "green", keypad: side === "right" }).grid,
        this.materials,
        true,
        "architecture",
      );
      m.scale.setScalar(DOOR_SCALE);
      g.add(m);
      g.position.x = leafCenterX(side, 0);
      root.add(g);
      return g;
    };
    this.doorLeaves = { left: mk("left"), right: mk("right") };
    this.scene.add(root);
  }

  private addChair(): void {
    const sc = decorScale("swivel_chair");
    const mesh = meshGrid(decorModel("swivel_chair").grid, this.materials, true, decorFamily(sc));
    mesh.scale.setScalar(sc);
    mesh.castShadow = true;
    this.chair.add(mesh);
    this.chair.position.set(CHAIR[0], 0, CHAIR[1]);
    this.scene.add(this.chair);
  }

  private addVisual(
    group: THREE.Group,
    visual: DeviceVisual,
    powered: boolean,
    scan: THREE.Texture | null,
    family: RefineFamily = "device",
    lights = true,
  ): Rig {
    const sc = visual.scale ?? MODEL_SCALE;
    const base = meshGrid(visual.base.grid, this.materials, true, family);
    base.scale.setScalar(sc);
    base.castShadow = true;
    group.add(base);
    const rig: Rig = { parts: [], lights: [], screens: [], scale: sc, powered };
    const byName = new Map<string, PartView>();
    for (const part of visual.parts) {
      const grid = part.requiresPower ? stagedGrid(part.model.grid, 1, powered) : part.model.grid;
      const mesh = meshGrid(grid, this.materials, false, family);
      mesh.scale.setScalar(sc);
      mesh.position.set(-part.pivot[0] * sc, -part.pivot[1] * sc, -part.pivot[2] * sc);
      const pivot = new THREE.Group();
      pivot.add(mesh);
      const parent = part.parent ? byName.get(part.parent) : undefined;
      let rest: THREE.Vector3;
      if (parent) {
        rest = new THREE.Vector3(
          (part.offset[0] + part.pivot[0] - parent.part.pivot[0]) * sc,
          (part.offset[1] + part.pivot[1] - parent.part.pivot[1]) * sc,
          (part.offset[2] + part.pivot[2] - parent.part.pivot[2]) * sc,
        );
        parent.pivot.add(pivot);
      } else {
        const pp = partPivotInBase(visual.base, part);
        rest = new THREE.Vector3(pp[0] * sc, pp[1] * sc, pp[2] * sc);
        group.add(pivot);
      }
      pivot.position.copy(rest);
      const view: PartView = { pivot, rest, part };
      byName.set(part.name, view);
      rig.parts.push(view);
    }
    if (lights)
      for (const def of visual.lights) {
        const light = new THREE.PointLight(def.color, 0, def.distance, 2);
        const lp = lightPosInBase(visual.base, def);
        light.position.set(lp[0] * sc, lp[1] * sc, lp[2] * sc);
        group.add(light);
        rig.lights.push({ light, def });
      }
    for (const spec of visual.screens ?? []) {
      const base = new THREE.Color(spec.color ?? "#33FF33").multiplyScalar(1.6);
      const mat = new THREE.MeshBasicMaterial({
        color: base.clone(),
        ...(scan ? { map: scan } : {}),
        toneMapped: false,
      });
      this.extraMaterials.push(mat);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(spec.w * sc, spec.h * sc), mat);
      const [px, py, pz] = screenLocalPosition(
        spec,
        { w: visual.base.w, d: visual.base.d },
        sc,
        0.03,
      );
      plane.position.set(px, py, pz);
      const n = spec.normal;
      if (n === "-z") plane.rotation.y = Math.PI;
      else if (n === "+x") plane.rotation.y = Math.PI / 2;
      else if (n === "-x") plane.rotation.y = -Math.PI / 2;
      else if (n === "+y") plane.rotation.x = -Math.PI / 2;
      group.add(plane);
      rig.screens.push({ mat, base, phase: this.rigs.length * 1.7 + rig.screens.length });
    }
    this.rigs.push(rig);
    return rig;
  }

  private addJade(def: CharacterRigDef): void {
    const root = this.jadeRoot;
    const inner = new THREE.Group();
    inner.scale.setScalar(def.scale);
    root.add(inner);
    for (const part of def.parts) {
      const j = new THREE.Group();
      const rp = jointRestPosition(def, part);
      j.position.set(rp[0], rp[1], rp[2]);
      const mesh = meshGrid(part.model.grid, this.materials, false, familyFor(def, "character"));
      mesh.position.set(-part.origin[0], -part.origin[1], -part.origin[2]);
      mesh.castShadow = true;
      j.add(mesh);
      const parent = part.parent ? this.joints.get(part.parent)?.group : undefined;
      (parent ?? inner).add(j);
      this.joints.set(part.name, { group: j, rest: j.position.clone() });
    }
    for (const k of HAND_PROPS) {
      const hp = handProp(k);
      const joint = this.joints.get(hp.joint)?.group;
      if (!joint) continue;
      const mesh = meshGrid(hp.model.grid, this.materials, false, "detail");
      mesh.scale.setScalar(hp.scale);
      mesh.position.set(hp.anchor[0], hp.anchor[1], hp.anchor[2]);
      mesh.visible = false;
      joint.add(mesh);
      this.handProps.set(k, mesh);
    }
    // Voxel mouth overlay on the front of the head (6 × 3 cells, see emotion.ts).
    const head = def.parts.find((p) => p.name === "head");
    const headJoint = this.joints.get("head")?.group;
    if (head && headJoint) {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
      this.extraMaterials.push(mat);
      const mouth = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.14), mat, 18);
      const m = new THREE.Matrix4();
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 6; c++) {
          // Mouth cells in the painted head frame, moved like the head was fitted (jade-rig).
          const [x, y, z13] = fitPoint(HEAD_FIT, [4 + c, 4 - r, 13]);
          const front = head.model.grid.get(x, y, z13) ? z13 + 1 : z13;
          m.makeTranslation(
            x + 0.5 - head.origin[0],
            y + 0.5 - head.origin[1],
            front - head.origin[2] + 0.07,
          );
          mouth.setMatrixAt(r * 6 + c, m);
          mouth.setColorAt(r * 6 + c, new THREE.Color(paletteHex(SKIN)));
        }
      headJoint.add(mouth);
      this.mouth = mouth;
    }
    this.scene.add(root);
  }

  private setMouth(shape: MouthShape): void {
    if (!this.mouth || shape === this.mouthShape) return;
    this.mouthShape = shape;
    const pal: Record<string, number> = {
      ".": SKIN,
      s: SKIN_SHADE,
      l: SKIN_LIGHT,
      M: C.lips,
      d: C.hair_black,
      W: C.eye_white,
    };
    const col = new THREE.Color();
    MOUTH_ART[shape].forEach((row, r) => {
      for (let c = 0; c < 6; c++) {
        col.set(paletteHex(pal[row[c]!] ?? SKIN));
        this.mouth!.setColorAt(r * 6 + c, col);
      }
    });
    if (this.mouth.instanceColor) this.mouth.instanceColor.needsUpdate = true;
  }

  private addBot(id: string, scan: THREE.Texture | null): void {
    const visual = botVisual(id, true);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const rig = this.addVisual(body, visual, true, scan, familyFor(visual, "character"), false);
    // Bots animate by gait (animateBots), not with the devices.
    this.rigs.splice(this.rigs.indexOf(rig), 1);
    const height = visual.base.h * (visual.scale ?? MODEL_SCALE);
    const mugProp = handProp("mug");
    const mug = meshGrid(mugProp.model.grid, this.materials, true, "detail");
    mug.scale.setScalar(0.28);
    mug.position.y = height + 0.05;
    const card = meshGrid(cardModel().grid, this.materials, true, "detail");
    card.scale.setScalar(0.3);
    card.position.y = height + 0.05;
    root.add(mug, card);
    root.visible = false;
    this.scene.add(root);
    this.bots.set(id, { root, body, rig, mug, card, height, yaw: 0 });
  }

  /** Slow dust motes in the key light. */
  private addMotes(): void {
    const n = 110;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (((i * 7919) % 1000) / 1000 - 0.5) * DIORAMA_FLOOR.w;
      pos[i * 3 + 1] = (((i * 104729) % 1000) / 1000) * 14;
      pos[i * 3 + 2] = (((i * 1299709) % 1000) / 1000 - 0.5) * DIORAMA_FLOOR.d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: "#ffe6c4",
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.extraMaterials.push(mat);
    this.motes = new THREE.Points(geo, mat);
    this.scene.add(this.motes);
  }

  // ── Options ───────────────────────────────────────────────────

  setReduceMotion(v: boolean): void {
    this.opts = { ...this.opts, reduceMotion: v };
  }

  setBloom(v: boolean): void {
    this.opts = { ...this.opts, bloom: v };
    if (v && !this.composer) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      // Half-resolution bloom: glow only needs to be soft, not sharp.
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.max(1, size.x / 2), Math.max(1, size.y / 2)),
        0.55,
        0.5,
        1.15,
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      this.resize();
    } else if (!v && this.composer) {
      this.composer.dispose();
      this.bloomPass?.dispose();
      this.composer = null;
      this.bloomPass = null;
    }
  }

  // ── Loop ──────────────────────────────────────────────────────

  private resize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth || 800;
    const h = this.container.clientHeight || window.innerHeight || 600;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    const f = dioramaFrustum(w, h);
    Object.assign(this.camera, f);
    this.camera.updateProjectionMatrix();
    this.draw(0);
  }

  private start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    if (this.last && now - this.last < FRAME_MS) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this.draw(dt);
  };

  private placeCamera(): void {
    const yaw = cameraYaw(this.time, this.opts.reduceMotion);
    const dist = 80;
    const pitch = 0.62;
    const target = new THREE.Vector3(0, 3, -1);
    this.camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.camera.lookAt(target);
  }

  /**
   * Swap detailed devices in (same world space as the authored ones, like the
   * game): the group is rebuilt from the detailed visual with its pre-meshed,
   * powered base.
   */
  private swapDetails(): void {
    for (let i = this.pendingDetail.length - 1; i >= 0; i--) {
      const pd = this.pendingDetail[i]!;
      const d = requestDetail(pd.id);
      if (!d) continue;
      this.pendingDetail.splice(i, 1);
      for (const c of [...pd.group.children]) {
        pd.group.remove(c);
        c.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
      }
      const at = this.rigs.indexOf(pd.rig);
      if (at >= 0) this.rigs.splice(at, 1);
      const base = new Model(d.on.sx, d.on.sy, d.on.sz);
      base.grid.data.set(d.on.data);
      const rig = this.addVisual(pd.group, { ...d.visual, base }, true, pd.scan, "hires");
      for (const st of this.stations.values()) if (st.rig === pd.rig) st.rig = rig;
    }
  }

  /** Advance the simulation and render one frame. */
  private draw(dt: number): void {
    if (this.disposed) return;
    if (this.pendingDetail.length) this.swapDetails();
    this.time += dt;
    if (dt > 0 || !this.frame) {
      this.frame = this.life.step(Math.max(dt, 1e-3));
      for (const fx of this.frame.fx) this.onFx(fx);
      for (const b of this.frame.bubbles) this.say(b.who, b.text, b.ttl);
    }
    this.placeCamera();
    this.animateDevices(this.frame, dt);
    this.animateJade(this.frame, dt);
    this.animateBots(this.frame.bots, dt);
    this.particles?.update(dt, this.time);
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.updateOverlay(dt);
  }

  private onFx(fx: FxEvent): void {
    this.particles?.emit(fx);
    if (fx.kind === "bang" || fx.kind === "sparks") {
      const f = this.flash;
      if (f) {
        f.position.set(fx.x, fx.y + 1, fx.z);
        f.color.set(fx.kind === "bang" ? "#ff8a3a" : "#ffd27a");
        this.flashT = fx.kind === "bang" ? 1 : Math.max(this.flashT, 0.45);
      }
    }
  }

  private animateDevices(f: LifeFrame, dt: number): void {
    const t = this.time;
    for (const rig of this.rigs) {
      const sc = rig.scale;
      for (const pv of rig.parts) {
        const st = animTransform(pv.part, t, rig.powered);
        pv.pivot.rotation.set(st.rot[0], st.rot[1], st.rot[2]);
        pv.pivot.position.set(
          pv.rest.x + st.pos[0] * sc,
          pv.rest.y + st.pos[1] * sc,
          pv.rest.z + st.pos[2] * sc,
        );
        pv.pivot.visible = st.visible;
      }
      for (const l of rig.lights)
        l.light.intensity = lightIntensity(l.def, t, rig.powered) * LIGHT_GAIN;
      for (const s of rig.screens) {
        const tex = s.mat.map;
        if (tex && !this.opts.reduceMotion) tex.offset.y = (t * 0.08 + s.phase) % 1;
      }
    }
    // Health: glitching devices stutter, broken ones go dark and show red.
    let i = 0;
    for (const [id, sv] of this.stations) {
      i++;
      const d = f.devices[id];
      const health = d?.health ?? "ok";
      const glitchOn = health === "glitch" && flicker(t, i) < 0.35;
      if (sv.rig) {
        sv.rig.powered = health === "ok" || (health === "glitch" && !glitchOn);
        for (const s of sv.rig.screens) {
          if (health === "broken") s.mat.color.setRGB(0.05, 0.02, 0.02);
          else if (glitchOn)
            s.mat.color.copy(s.base).multiplyScalar(0.15 + flicker(t * 3, i) * 0.5);
          else s.mat.color.copy(s.base);
        }
      }
      if (sv.beaconMat && sv.beacon) {
        const pulse = 0.55 + 0.45 * Math.sin(t * (health === "ok" ? 2 : 9));
        const c = health === "broken" ? "#ff2a1a" : health === "glitch" ? "#ffb000" : "#3dff6a";
        sv.beaconMat.color.set(c).multiplyScalar(d?.repairing ? 1.4 : pulse);
        sv.beacon.rotation.y = t * (d?.repairing ? 4 : 0.6);
      }
    }
    // MCP eye: steady glow, flares when the MCP talks, dies when it is broken.
    if (this.mcpEye) {
      const mcp = f.devices.mcp?.health ?? "ok";
      this.mcpTalk = Math.max(0, this.mcpTalk - dt);
      const talk = this.mcpTalk > 0 ? 6 * (0.6 + 0.4 * Math.sin(t * 22)) : 0;
      this.mcpEye.intensity =
        mcp === "broken" ? 0.6 : mcp === "glitch" ? 10 * flicker(t, 7) : 10 + talk;
    }
    if (this.flash) {
      this.flashT = Math.max(0, this.flashT - dt * 3.5);
      this.flash.intensity = this.flashT * 60;
    }
    // Door leaves, chair and the bumped crate.
    if (this.doorLeaves) {
      this.doorLeaves.left.position.x = leafCenterX("left", f.door);
      this.doorLeaves.right.position.x = leafCenterX("right", f.door);
    }
    this.chair.rotation.y = f.chairYaw;
    const w = f.crateWobble;
    this.crate.rotation.z = w * 0.09 * Math.sin(t * 19);
    this.crate.rotation.x = w * 0.05 * Math.sin(t * 23 + 1);
    if (this.motes && !this.opts.reduceMotion) {
      this.motes.position.y = Math.sin(t * 0.2) * 0.6;
      this.motes.rotation.y = t * 0.01;
    }
  }

  private animateJade(f: LifeFrame, dt: number): void {
    const j = f.jade;
    const now = this.time;
    // Pose track: the simulation says what she does; walking is the locomotion layer.
    let kind: CharacterPoseKind = j.moving || j.pose === "walk" ? "idle" : j.pose;
    if (j.seated) kind = "sit";
    if (j.poseSeq !== this.poseSeq || (kind !== this.track.kind && !isPoseDone(this.track, now))) {
      this.poseSeq = j.poseSeq;
      this.track = switchPose(this.track, kind, now);
    } else if (isPoseDone(this.track, now) && this.track.kind !== "idle") {
      this.track = switchPose(this.track, "idle", now);
    }
    this.speedS = approach(this.speedS, j.moving ? j.speed : 0, dt, 6);
    this.walkW = approach(this.walkW, j.moving ? 1 : 0, dt, 8);
    this.idleFor = advanceIdle(this.idleFor, dt, j.moving, this.walkW);
    this.gaitPhase = advanceGait(this.gaitPhase, dt, this.speedS);
    this.seatW = approach(this.seatW, j.seated ? 1 : 0, dt, 6);

    // Heading: seated she turns with the chair; for reactions she half-turns to the audience.
    const present =
      !j.seated && !j.moving && (j.gesture !== null || PRESENT_POSES.has(j.pose)) ? 1 : 0;
    this.presentW = approach(this.presentW, present, dt, 3);
    const camYaw = cameraYaw(this.time, this.opts.reduceMotion);
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const goal = j.yaw + wrap(camYaw - j.yaw) * 0.65 * this.presentW;
    if (!this.jadeInit) {
      this.yawS = j.yaw;
      this.jadeInit = true;
    }
    this.yawS = j.seated ? j.yaw : approachAngle(this.yawS, goal, dt, 10);

    const fit = sitFit(CHAIR_SEAT);
    const sx = -Math.sin(this.yawS) * SIT_SEAT_OFFSET * this.seatW;
    const sz = -Math.cos(this.yawS) * SIT_SEAT_OFFSET * this.seatW;
    this.jadeRoot.position.set(j.x + sx, fit.lift * this.seatW, j.z + sz);
    this.jadeRoot.rotation.y = this.yawS;

    const pose = animateCharacter({
      track: this.track,
      now,
      gaitPhase: this.gaitPhase,
      speed: this.speedS,
      walkW: this.walkW,
      idleFor: this.idleFor,
      seed: 3,
      ...(j.seated ? { seat: CHAIR_SEAT } : {}),
    });
    applyExpression(pose, j.expression, now);
    if (j.gesture) applyGesture(pose, j.gesture.g, j.gesture.t);
    for (const [name, jt] of this.joints) {
      const pp = pose[name];
      if (!pp) continue;
      jt.group.rotation.set(pp.rot[0], pp.rot[1], pp.rot[2]);
      jt.group.position.set(
        jt.rest.x + (pp.pos?.[0] ?? 0),
        jt.rest.y + (pp.pos?.[1] ?? 0),
        jt.rest.z + (pp.pos?.[2] ?? 0),
      );
    }
    const prop = activeProp(this.track, now);
    for (const [k, m] of this.handProps) m.visible = k === prop;
    this.setMouth(j.expression.mouth);
  }

  private animateBots(frames: readonly BotFrame[], dt: number): void {
    const seen = new Set<string>();
    for (const b of frames) {
      const v = this.bots.get(b.id);
      if (!v) continue;
      seen.add(b.id);
      // Outside the door they are in the dark corridor: hide once past the frame.
      v.root.visible = b.z > -DIORAMA_FLOOR.d / 2 - 1.6;
      v.yaw = approachAngle(v.yaw, b.yaw, dt, 10);
      const hop = b.hop * 0.8 * Math.abs(Math.sin(this.time * 9));
      v.root.position.set(b.x, hop, b.z);
      v.root.rotation.y = v.yaw;
      v.body.rotation.z = b.moving ? 0.03 * Math.sin(b.travel * 3) : 0;
      const sc = v.rig.scale;
      for (const pv of v.rig.parts) {
        const st = gaitTransform(pv.part, this.time, true, b.travel, b.moving ? 1 : 0, sc);
        pv.pivot.rotation.set(st.rot[0], st.rot[1], st.rot[2]);
        pv.pivot.position.set(
          pv.rest.x + st.pos[0] * sc,
          pv.rest.y + st.pos[1] * sc,
          pv.rest.z + st.pos[2] * sc,
        );
        pv.pivot.visible = st.visible;
      }
      v.mug.visible = b.carry === "mug";
      v.card.visible = b.carry === "card";
      v.card.rotation.y = this.time * 1.5;
    }
    for (const [id, v] of this.bots) if (!seen.has(id)) v.root.visible = false;
  }

  // ── Speech bubbles & emotes (DOM) ─────────────────────────────

  private say(who: string, text: string, ttl: number): void {
    const o = this.overlay;
    if (!o) return;
    for (let i = this.bubbles.length - 1; i >= 0; i--)
      if (this.bubbles[i]!.who === who) {
        this.bubbles[i]!.el.remove();
        this.bubbles.splice(i, 1);
      }
    const color = SPEAKER_COLOR[who] ?? BOT_COLOR;
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      maxWidth: "220px",
      padding: "5px 9px",
      font: "12px/1.35 ui-monospace, Menlo, monospace",
      color,
      background: "rgba(4,8,6,0.86)",
      border: `1px solid ${color}`,
      borderRadius: "4px",
      boxShadow: `0 0 12px ${color}33`,
      whiteSpace: "normal",
      opacity: "0",
      transition: "opacity 0.2s",
      willChange: "transform",
    });
    el.textContent = text;
    const tail = document.createElement("span");
    Object.assign(tail.style, {
      position: "absolute",
      left: "50%",
      bottom: "-5px",
      width: "8px",
      height: "8px",
      marginLeft: "-4px",
      background: "rgba(4,8,6,0.86)",
      borderRight: `1px solid ${color}`,
      borderBottom: `1px solid ${color}`,
      transform: "rotate(45deg)",
    });
    el.appendChild(tail);
    o.appendChild(el);
    this.bubbles.push({ el, who, ttl, age: 0 });
  }

  /** World anchor above a speaker's head (null when not in the room). */
  private anchor(who: string): THREE.Vector3 | null {
    if (who === "jade") {
      const r = this.jadeRoot.position;
      return this.tmp.set(r.x, 6.6 - this.seatW * 1.3, r.z);
    }
    if (who === "mcp") return this.tmp.set(STATIONS.mcp.x, 10.8, STATIONS.mcp.z);
    const b = this.bots.get(who);
    if (!b || !b.root.visible) return null;
    return this.tmp.set(b.root.position.x, b.height + 1.4, b.root.position.z);
  }

  private toScreen(v: THREE.Vector3): [number, number] {
    v.project(this.camera);
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
  }

  private updateOverlay(dt: number): void {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!;
      b.age += dt;
      const a = this.anchor(b.who);
      if (b.age > b.ttl || !a) {
        b.el.remove();
        this.bubbles.splice(i, 1);
        continue;
      }
      if (b.who === "mcp") this.mcpTalk = Math.max(this.mcpTalk, 0.1);
      const [x, y] = this.toScreen(a);
      const rise = Math.min(1, b.age / 0.25);
      b.el.style.opacity = b.age > b.ttl - 0.4 ? String(Math.max(0, (b.ttl - b.age) / 0.4)) : "1";
      b.el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 8 * rise).toFixed(1)}px) translate(-50%, -100%)`;
    }
    const e = this.emote;
    const icon = this.frame?.jade.expression.icon ?? null;
    if (e) {
      if (icon) {
        const g = EMOTE_GLYPH[icon];
        if (e.dataset.icon !== icon) {
          e.dataset.icon = icon;
          e.textContent = g.glyph;
          e.style.color = g.color;
        }
        const r = this.jadeRoot.position;
        const jadeTalks = this.bubbles.some((b) => b.who === "jade");
        const [x, y] = this.toScreen(this.tmp.set(r.x, 6.4 - this.seatW * 1.3, r.z));
        const bob = this.opts.reduceMotion ? 0 : Math.sin(this.time * 5) * 3;
        const side = jadeTalks ? 70 : 0;
        e.style.transform = `translate(${(x + side).toFixed(1)}px, ${(y - 10 + bob).toFixed(1)}px) translate(-50%, -100%)`;
        e.style.opacity = "1";
      } else e.style.opacity = "0";
    }
  }

  // ── Teardown ──────────────────────────────────────────────────

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    for (const fn of this.cleanup) fn();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
    });
    this.particles?.dispose();
    this.mouth?.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
    for (const m of this.extraMaterials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.envTexture?.dispose();
    this.composer?.dispose();
    this.bloomPass?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.overlay?.remove();
    this.scene.clear();
  }
}

/** sRGB hex of a lab palette index (instance colours of the mouth overlay). */
function paletteHex(index: number): number {
  const [r, g, b] = LAB_PALETTE.get(index);
  return (r << 16) | (g << 8) | b;
}

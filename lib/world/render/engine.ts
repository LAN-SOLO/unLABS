/**
 * LabEngine — the 3D view of the lab world.
 * =========================================
 *
 * Orthographic camera from above at 45° (Aufbausim view), rotatable in
 * 90° steps, zoomable. One voxel world per floor (only the active floor
 * is shown), procedural voxel models for devices / props / pickups /
 * characters, room lights driven by the power grid, smoke and anomaly
 * particles, an X-ray silhouette so Lawrence stays visible behind walls.
 *
 * The engine reads `WorldState` through a getter and never mutates it —
 * interactions are reported to React via callbacks.
 */
import * as THREE from "three";
import { tr } from "@/lib/i18n";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createCrtPass, type CrtPass } from "@/lib/world/render/crt-pass";
import {
  DOOR_OPEN_RADIUS,
  DoorSystem,
  ElevatorSystem,
  elevatorHoleCells,
  type DoorVariant,
  type ElevatorEvent,
  type MeshModel,
} from "@/lib/world/render/doors";
import { PROP_VARIANT_DECOR } from "@/lib/world/content/decor-actions";
import { bioWalkMultiplier } from "@/lib/world/biorhythm";
import {
  buffMultiplier,
  decorInteractPoint,
  hasDecorAction,
  propDecorAction,
} from "@/lib/world/decor-actions";
import {
  type DecorPlacement,
  animatedDecor,
  decorFootprints,
  decorLights,
  decorElevation,
  interiorFor,
} from "@/lib/world/content/interior";
import { DECOR_BY_ID, decorModel, decorScale, decorVisual } from "@/lib/world/models/decor";
import {
  decorFamily,
  refineTerrainRegion,
  familyFor,
  refinedModelMesh,
  type RefineFamily,
} from "@/lib/world/models/refine";
import {
  animTransform,
  lightIntensity,
  lightPosInBase,
  partPivotInBase,
  stagedBuildGrid,
  type AnimPart,
  type DeviceVisual,
  type VisualLight,
} from "@/lib/world/models/anim";
import { botVisual, deviceVisual } from "@/lib/world/models";
import {
  activeProp,
  advanceGait,
  advanceIdle,
  animateCharacter,
  approach,
  approachAngle,
  cageMotion,
  chillTarget,
  handProp,
  lookYaw,
  LOOK_RADIUS,
  isPoseDone,
  poseTrack,
  restartPose,
  switchPose,
  damienRig,
  jadeRig,
  jointRestPosition,
  type CageMotion,
  type CharacterPose,
  type CharacterPoseKind,
  type CharacterRigDef,
  type HandPropKind,
  type PoseTrack,
  type RigPartName,
} from "@/lib/world/models/rig";
import { FxSystem, type AmbientKind, type FxKind } from "@/lib/world/render/fx";
import { smoothDamp, smoothstep01, turnToward, type DampState } from "@/lib/world/render/motion";
import {
  ASSEMBLY_TIME,
  NOTE_FOLD_TIME,
  PICKUP_FLIGHT_TIME,
  assemblyPose,
  glowFactor,
  noteFold,
  pickupFlight,
  rampedTransform,
  spinFactor,
  stepRamp,
  type RigRamp,
} from "@/lib/world/render/transitions";
import {
  createBrain,
  findFreeSpot,
  stepBrain,
  type NpcBrain,
  type NpcBrainConfig,
  type NpcWorld,
  type Station,
} from "@/lib/world/render/npc-brain";
import {
  brownoutInterval,
  floorMood,
  newlyOnline,
  roomFramingOffset,
} from "@/lib/world/render/atmosphere";
import { mcpAvatarVisual } from "@/lib/world/models/characters";
import { ScreenSystem, type ScreenRef } from "@/lib/world/render/screens";
import { screenInfo } from "@/lib/world/screen-content";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_SCALE,
  ROOM_TERMINAL_SIZE,
  roomTerminalModel,
  roomTerminalScreen,
} from "@/lib/world/content/terminals";
import { CameraDirector, ScreenShake } from "@/lib/world/render/cutscene";
import { FootstepClock } from "@/lib/world/audio/footsteps";
import { surfaceForTheme, type Surface } from "@/lib/world/audio/sfx";
import {
  actionForCode,
  actionHeld,
  effectivePixelRatio,
  followLerpRate,
  frameIntervalMs,
  getSettings,
  shadowMapSize,
  subscribeSettings,
  type Settings,
} from "@/lib/world/settings";
import { FloorCollision, Walker, WALKER } from "@/lib/world/actor";
import { DEVICES } from "@/lib/world/content/devices";
import {
  DOORS,
  ELEVATORS,
  FLOOR_BY_ID,
  FLOOR_SIZE,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  WALL_HEIGHT,
  roomAt,
} from "@/lib/world/content/map";
import { LAB_PALETTE, labMaterialOf } from "@/lib/world/content/palette";
import { NPCS } from "@/lib/world/content/story";
import {
  doorIsOpen,
  prototypeUseOptions,
  evalCond,
  isOnline,
  noteVisible,
  pickupAvailable,
  pickupNeedsTool,
  power,
  stagesDone,
  type PowerStatus,
} from "@/lib/world/game";
import { buildFloor, doorCells, setLamps, type FloorLayout } from "@/lib/world/layout";
import {
  columnBlocked,
  createNavGrid,
  findPath,
  isFreeAt,
  lineClear,
  rayClear,
  setDynamicBlocked,
  updateNavGrid,
  type NavGrid,
  type XZ,
} from "@/lib/world/pathfind";
import {
  MODEL_SCALE,
  pickupModel,
  propModel,
  propVisual,
  stagedGrid,
  type Model,
} from "@/lib/world/models";
import { createVoxelMaterials, toGeometry, toMesh } from "@/lib/world/render/voxel-mesh";
import { WorldRenderer } from "@/lib/world/render/world-renderer";
import {
  AutoInstancer,
  HIDDEN_LAYER,
  StaticBatcher,
  installShadowLayerHook,
  markInstanced,
  markStatic,
} from "@/lib/world/render/batching";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { DoorDef, FloorId, WorldState } from "@/lib/world/types";
import { MATERIAL_CLASSES, type MaterialClass } from "@/lib/voxel/mesher";

const MATERIAL_ORDER = MATERIAL_CLASSES;
import type { VoxelGrid, Vec3, VoxelSource } from "@/lib/voxel/grid";

/**
 * A light source that is not a real three.js light. The engine keeps a
 * fixed pool of PointLights and moves them to the virtual lights closest
 * to the camera — constant light count (no shader recompiles) and bounded
 * cost no matter how many lamps, screens and devices a floor has.
 */
export class VirtualLight extends THREE.Object3D {
  readonly color: THREE.Color;
  constructor(
    color: THREE.ColorRepresentation,
    public intensity: number,
    public distance: number,
    public decay = 2,
  ) {
    super();
    this.color = new THREE.Color(color);
  }
}

const LIGHT_POOL_SIZE = 14;
/** Global gain for pooled decorative lights (keeps white surfaces from blowing out). */
const POOL_GAIN = 0.4;

export type Target =
  | { kind: "device"; id: string }
  | { kind: "pickup"; id: string }
  | { kind: "note"; id: string }
  | { kind: "prop"; id: string }
  | { kind: "door"; id: string }
  | { kind: "npc"; id: string }
  | { kind: "terminal"; id: string }
  | { kind: "decor"; id: string };

export interface EngineCallbacks {
  onFocus(target: Target | null): void;
  onInteract(target: Target): void;
  onRoom(roomId: string | null): void;
  onMove(floor: FloorId, pos: Vec3): void;
  onWallMode?(label: string): void;
  onFootstep?(x: number, z: number, surface: Surface): void;
  onDoorMove?(id: string, opening: boolean): void;
  /** A locked / keypad door just unlocked (beacon turns green) — play a chirp. */
  onDoorUnlock?(id: string): void;
  /**
   * A click-to-move target cannot be reached: `locked` = only a locked /
   * closed secret door is in the way, `unreachable` = no way at all. Lawrence
   * still walks to the closest reachable point toward it.
   */
  onPathBlocked?(reason: PathBlockedReason): void;
}

export type PathBlockedReason = "locked" | "unreachable";

const REACH = 5.5;
/** Waypoint dots of the click-to-move path (incl. the target disc). */
const PATH_DOTS_MAX = 48;
const ELEVATION = Math.PI / 4.2;

interface Interactable {
  target: Target;
  x: number;
  z: number;
  radius: number;
  object: THREE.Object3D;
  /** Current visibility (hidden interactables are skipped). */
  active: boolean;
  /** Closed secret door: only targetable while a prototype can open it. */
  secretDoor?: DoorDef;
}

interface PartView {
  part: AnimPart;
  pivot: THREE.Group;
  rest: THREE.Vector3;
  /** Own emit material for pulse/flicker parts, so `intensity` can modulate the glow. */
  emit?: THREE.MeshBasicMaterial;
}

/** HDR gain of the shared emit material (see voxel-mesh.ts). */
const EMIT_GAIN = 2.4;

interface LightView {
  def: VisualLight;
  light: VirtualLight;
}

/** Animated parts + lights of a device or bot, attached to its group. */
interface VisualRig {
  parts: PartView[];
  lights: LightView[];
  powered: boolean;
  scale: number;
  /** Group the rig hangs in (its world position is the cull sphere centre). */
  host: THREE.Object3D;
  /** Bounding radius (world units) for frustum culling. */
  radius: number;
  /**
   * Device rigs: own clock + power ramp. Parts that need power run on
   * `clock` (advancing at `speed`) and glow × `glow`, so power changes
   * spin up / wind down instead of snapping (see transitions.ts).
   */
  ramp?: RigRamp;
}

/** What a device's meshes were built for. */
interface DeviceBuild {
  discovered: boolean;
  done: number;
  powered: boolean;
}

function sameBuild(a: DeviceBuild, b: DeviceBuild): boolean {
  return a.discovered === b.discovered && a.done === b.done && a.powered === b.powered;
}

interface DeviceView {
  id: string;
  group: THREE.Group;
  model: Model;
  visual: DeviceVisual;
  rig: VisualRig | null;
  screenRefs: ScreenRef[];
  footprint: [number, number, number, number, number];
  /** State the current meshes show (null = never built). */
  built: DeviceBuild | null;
  /** Power was lost: rebuild dark with this once the rig has wound down. */
  pending: DeviceBuild | null;
  /** Base mesh of the current build (static-batched while no transition runs). */
  base: THREE.Mesh | null;
  /** Power ramp 0..1 and where it is heading. */
  ramp: number;
  rampTarget: 0 | 1;
  /** Rig clock + ramp factors; survives rebuilds so parts never snap. */
  anim: RigRamp;
  /** Own emit material of the unbatched base while its glow ramps. */
  rampMat: THREE.MeshBasicMaterial | null;
  /** Seconds into the build-stage flourish (−1 = none) and its scan line. */
  assembleT: number;
  assembleStill: boolean;
  scan: THREE.Mesh | null;
}

/** A taken pickup flying to the player. */
interface PickupFlight {
  t: number;
  home: THREE.Vector3;
}

interface NpcView {
  id: string;
  group: THREE.Group;
  home: [number, number];
  wander: number;
  goal: [number, number];
  wait: number;
  rig?: CharacterRig;
  visual?: VisualRig;
  track?: PoseTrack;
  wasNear?: boolean;
  nearSince?: number;
  /** Behaviour state for lore bots (see npc-brain.ts). */
  brain?: NpcBrain;
  cfg?: NpcBrainConfig;
  /** Walk-cycle phase for the hop. */
  phase: number;
  /** Per-bot offset so idle motions do not sync up. */
  seed: number;
  /** Radius of the contact shadow (0 = none). */
  blob: number;
  /** Lore bots: awake (bot_<id>_awake) or slumped and dark. */
  awake?: boolean;
  /** Lore bots: the rebuildable body (base mesh, rig, screens). */
  body?: THREE.Group;
  bodyScreens?: ScreenRef[];
  /** Its interactable (moves with the bot). */
  it?: Interactable;
}

/** The MCP's floating eye projector beside MCP-000. */
interface AvatarView {
  group: THREE.Group;
  rig: VisualRig;
  placed: boolean;
}

interface CharacterRig {
  root: THREE.Group;
  joints: Map<string, THREE.Group>;
  rest: Map<string, THREE.Vector3>;
}

export type PlayerMode = CharacterPoseKind;
const HAND_PROPS: readonly HandPropKind[] = ["mug", "book", "crate", "wrench"];

interface FloorView {
  floor: FloorId;
  layout: FloorLayout;
  renderer: WorldRenderer;
  group: THREE.Group;
  collision: FloorCollision;
  devices: Map<string, DeviceView>;
  pickups: Map<string, THREE.Group>;
  notes: Map<string, THREE.Group>;
  npcs: Map<string, NpcView>;
  interactables: Interactable[];
  roomLights: Map<string, THREE.PointLight>;
  smoke: Map<string, THREE.Points>;
  anomaly?: THREE.Points;
  rift?: THREE.Mesh;
  /** Animated sliding doors (collision per leaf cell). */
  doors: DoorSystem;
  /** Terrain + footprints + closed door leaves + elevator deck. */
  collider: VoxelSource;
  lampKeys: Map<string, boolean>;
  /** Soft additive light cones under the wall lamps, one material per room. */
  shafts: Map<string, THREE.ShaderMaterial>;
  /** Voxels removed by the wall cutaway (key → palette index). */
  cutSaved: Map<number, number>;
  cutDirty: boolean;
  /** Live screens on decor pieces, powered like their room's lights. */
  decorScreens: { room: string; ref: ScreenRef }[];
  /** Animated decor parts (fans, clocks, reels…), gated by their room's power. */
  decorRigs: { room: string; rig: VisualRig }[];
  /** Room terminal kiosks and their screens. */
  terminals: { id: string; ref: ScreenRef }[];
  /** Point lights of lamps/screens in the interior, keyed by room. */
  decorLights: { room: string; light: VirtualLight; base: number; requiresPower: boolean }[];
  /** Every VirtualLight on the floor (re-collected when rigs are rebuilt). */
  lights: VirtualLight[];
  lightsDirty: boolean;
  /** Rooms whose lamps are on (set in sync). */
  litRooms: Set<string>;
  /** Work stations for bots (built devices, kiosks, furniture with actions). */
  stations: Station[];
  mcpAvatar?: AvatarView;
  /** Room index + 1 per cell (lazy, see roomIdAt). */
  roomGrid?: Int16Array;
  /** Never-moving meshes + decor, merged per map tile. */
  batch: StaticBatcher;
  /** Moving meshes with shared geometry (doors, pickups, rig parts) as InstancedMeshes. */
  instancer: AutoInstancer;
  /** Static content may have changed (sync, cutaway): re-check the tile batches. */
  staticDirty: boolean;
  /** Click-to-move grid (lazy, see navFor); dirty after collision rebuilds. */
  nav?: NavGrid;
  navDirty: boolean;
  /** Taken pickups on their way to the player. */
  flights: Map<string, PickupFlight>;
  /** Read notes folding away (id → seconds). */
  folds: Map<string, number>;
}

/** Cheap per-frame counters, see `LabEngine.debugStats()`. */
export interface EngineStats {
  /** Draw calls of the last frame, all passes (scene, shadow, bloom, CRT). */
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  /** CPU time of the last frame() in ms (simulation + render submit). */
  frameMs: number;
  rigsAnimated: number;
  rigsCulled: number;
  virtualLights: number;
  pooledLightsLit: number;
  particles: number;
  ambientEmitters: number;
  npcsActive: number;
  fps: number;
  /** Static tile meshes of the active floor (≤ 4 draws each). */
  staticTiles: number;
  /** InstancedMeshes of the active floor's auto-instancer (≤ 4 draws each). */
  instanceSets: number;
  /** Source meshes drawn through those InstancedMeshes. */
  instancedSources: number;
}

const BLOB_CAPACITY = 32;
/**
 * Map tile size (voxels) of the static batches: 136 × 120 floors → 3 × 2
 * tiles, ≤ 4 draws each. Big enough to keep draws low, small enough that a
 * device change re-merges only part of the floor and off-screen tiles cull.
 */
const BATCH_TILE = 64;

/** Wall cutaway heights (voxels kept above the slab). */
export const WALL_MODES = [
  { id: "hoch", label: tr("Walls up"), cut: Infinity },
  { id: "halb", label: tr("Walls half"), cut: 3 },
  { id: "tief", label: tr("Walls down"), cut: 1 },
] as const;

export class LabEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly materials = createVoxelMaterials();
  private readonly floors = new Map<FloorId, FloorView>();
  private active!: FloorView;
  private readonly walker: Walker;
  private readonly player: CharacterRig;
  private readonly xray: THREE.Group;
  private readonly lantern: THREE.PointLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  /** Shadow-casting ceiling spot over the room the player is in. */
  private readonly keyLight: THREE.SpotLight;
  /** Red emergency light that pulses while the lab has no power. */
  private readonly emergency: THREE.PointLight;
  private readonly lightPool: THREE.PointLight[] = [];
  private readonly crt: CrtPass;
  readonly fx: FxSystem;
  readonly screens = new ScreenSystem();
  private readonly elevators: ElevatorSystem;
  readonly director = new CameraDirector();
  readonly shake = new ScreenShake();
  private readonly steps = new FootstepClock(1.7);
  /** Letterbox 0..1 and fade 0..1 of the running cinematic (read by React). */
  cinema = { letterbox: 0, fade: 0, playing: false };
  private wallMode = 0;
  private track: PoseTrack = poseTrack("idle", 0);
  private walkW = 0;
  private gaitPhase = 0;
  private speedS = 0;
  /** Seconds standing still (fidgets, chill), counted with `advanceIdle`. */
  private idleFor = 0;
  /** Running elevator / ladder ride: pose, where Lawrence stands on the deck, which way she faces. */
  private ride: { mode: "ride" | "climb"; spot: [number, number]; facing: number } | null = null;
  private cage: CageMotion = { offset: 0, vel: 0, load: 0 };
  private rideLoad = 0;
  private rideRattle = 0;
  /** Smoothed head turn towards a running device nearby. */
  private lookYawS = 0;
  private lookW = 0;
  private lookCheck = 0;
  private lookGoal: number | null = null;
  /** Keep looking at this spot (a device that just powered on) until `until`. */
  private lookHold: { x: number; z: number; until: number } | null = null;
  private chill = 0;
  private handProps = new Map<HandPropKind, THREE.Object3D>();
  private readonly decorById = new Map<string, DecorPlacement>();
  /** Rooms whose lamps currently stutter (room id → end time). */
  private readonly flickers = new Map<string, number>();
  private settings: Settings = getSettings();
  private lastRender = 0;
  /** Frames per second (smoothed), for the optional HUD counter. */
  fps = 0;
  private keyRoom: string | null = null;
  private readonly focusRing: THREE.Mesh;
  private readonly keys = new Set<string>();
  private readonly target = new THREE.Vector3();
  private yaw = Math.PI / 4;
  private yawGoal = Math.PI / 4;
  private zoom = getSettings().camera.defaultZoom;
  private inputEnabled = true;
  private focus: Interactable | null = null;
  private room: string | null = null;
  private walkTo: THREE.Vector3 | null = null;
  private walkStuck = 0;
  /** Click-to-move: waypoints after `walkTo`, and the goal for one replan when stuck. */
  private route: XZ[] = [];
  private routeGoal: { to: XZ; accept?: (x: number, z: number) => boolean } | null = null;
  private replanned = false;
  /** Waypoint dots + target disc (one instanced draw call). */
  private readonly pathDots: THREE.InstancedMesh;
  private pathDotsAlpha = 0;
  private acc = 0;
  private last = performance.now();
  private time = 0;
  private moveReport = 0;
  private disposed = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly cleanup: (() => void)[] = [];
  // ── Atmosphere / camera easing ──
  /** Power state of the last sync (updateLighting reads it instead of recomputing). */
  private powerState: PowerStatus | null = null;
  private powerAge = 0;
  /** Online set of the previous sync, for power-on flashes (null = first sync). */
  private prevOnline: Set<string> | null = null;
  private readonly camDamp: [DampState, DampState, DampState] = [{ v: 0 }, { v: 0 }, { v: 0 }];
  private zoomS = getSettings().camera.defaultZoom;
  /** Seconds since the last floor switch (drives the zoom settle). */
  private settleT = 99;
  private readonly tint = new THREE.Color(1, 1, 1);
  private readonly tintGoal = new THREE.Color(1, 1, 1);
  private moodAmbient = 1;
  private moodKeyGain = 1;
  /** Next spark / heat puff per starved device (engine time). */
  private readonly brownoutAt = new Map<string, number>();
  private brownoutRnd = 0x9e3779b9;
  /** Dust-mote emitter handle per room of the active floor. */
  private readonly roomMotes = new Map<string, number>();
  private motesCheck = 0;
  // ── Contact shadows ──
  private readonly blobs: THREE.InstancedMesh;
  private readonly blobAlpha: THREE.InstancedBufferAttribute;
  // ── Perf helpers (no per-frame allocations in the hot loops) ──
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpC = new THREE.Color();
  private readonly tmpM = new THREE.Matrix4();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpS = new THREE.Vector3();
  private readonly frustum = new THREE.Frustum();
  private readonly projView = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private readonly poolAssigned: (VirtualLight | null)[] = new Array<VirtualLight | null>(
    LIGHT_POOL_SIZE,
  ).fill(null);
  private poolReselect = 0;
  private readonly lightCands: { v: VirtualLight; d: number }[] = [];
  private readonly npcOthers: number[] = [];
  private readonly framing: [number, number] = [0, 0];
  private readonly xrayPairs: [THREE.Object3D, THREE.Object3D][] = [];
  private smokeTick = 0;
  private readonly roomById = new Map(ROOMS.map((r) => [r.id, r]));
  private readonly stats: EngineStats = {
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    programs: 0,
    frameMs: 0,
    rigsAnimated: 0,
    rigsCulled: 0,
    virtualLights: 0,
    pooledLightsLit: 0,
    particles: 0,
    ambientEmitters: 0,
    npcsActive: 0,
    fps: 0,
    staticTiles: 0,
    instanceSets: 0,
    instancedSources: 0,
  };
  /** Geometry shared by meshes of the same model (instancing needs identical geometry). */
  private readonly sharedGeo = new Map<string, THREE.BufferGeometry>();
  /** Unit quad (horizontal) of the build-flourish scan lines. */
  private scanGeo: THREE.BufferGeometry | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly getState: () => WorldState,
    private readonly cb: EngineCallbacks,
  ) {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      effectivePixelRatio(this.settings.graphics, window.devicePixelRatio),
    );
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Count draw calls over all passes of a frame (reset manually in frame()).
    this.renderer.info.autoReset = false;
    // Batched meshes cast shadows through single-material proxies (batching.ts).
    this.cleanup.push(installShadowLayerHook(this.renderer));
    // World matrices are updated once per frame in frame(), before the
    // instancer copies them (saves a second full traversal in render()).
    this.scene.matrixWorldAutoUpdate = false;
    // Batched/instanced sources are hidden on their own layer but must stay clickable.
    this.raycaster.layers.enable(HIDDEN_LAYER);
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color("#07080b");
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.25;
    this.hemi = new THREE.HemisphereLight("#9fb4d8", "#241c14", 0.35);
    this.sun = new THREE.DirectionalLight("#fff1dc", 0.5);
    // The directional light is a soft fill only; shadows come from the
    // per-room key light (sharper and cheaper than a floor-wide shadow map).
    this.sun.castShadow = false;
    const half = Math.max(FLOOR_SIZE.x, FLOOR_SIZE.z) / 2 + 10;
    Object.assign(this.sun.shadow.camera, {
      left: -half,
      right: half,
      top: half,
      bottom: -half,
      near: 1,
      far: 400,
    });
    this.sun.position.set(FLOOR_SIZE.x / 2 + 60, 120, FLOOR_SIZE.z / 2 + 30);
    this.sun.target.position.set(FLOOR_SIZE.x / 2, 0, FLOOR_SIZE.z / 2);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.keyLight = new THREE.SpotLight("#ffe6c4", 0, 0, Math.PI / 4, 0.65, 1);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.04;
    this.keyLight.shadow.camera.near = 5;
    this.keyLight.shadow.camera.far = 80;
    this.scene.add(this.keyLight, this.keyLight.target);
    for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
      const l = new THREE.PointLight("#ffffff", 0, 10, 2);
      this.lightPool.push(l);
      this.scene.add(l);
    }
    this.emergency = new THREE.PointLight("#ff2a1a", 0, 60, 1.2);
    this.scene.add(this.emergency);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 1000);
    // Stencil is needed for the X-ray silhouette (see buildCharacter).
    const rt = new THREE.WebGLRenderTarget(
      w * this.renderer.getPixelRatio(),
      h * this.renderer.getPixelRatio(),
      {
        type: THREE.HalfFloatType,
        depthBuffer: true,
        stencilBuffer: true,
      },
    );
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.45, 1.2);
    this.composer.addPass(this.bloom);
    this.crt = createCrtPass();
    this.composer.addPass(this.crt);
    this.composer.addPass(new OutputPass());

    this.fx = new FxSystem(this.scene);
    this.elevators = new ElevatorSystem((g, sc) => this.meshModel(g, sc, true, "architecture"), {
      attachScreens: (g, v) => {
        this.screens.attachVisual(g, v, {}, true);
      },
    });
    this.applySettings(this.settings);
    this.cleanup.push(subscribeSettings(() => this.applySettings(getSettings())));

    // Lawrence + her X-ray silhouette.
    // The player writes stencil 1 where she is directly visible; the X-ray
    // copy only draws where the player is hidden (depth greater, stencil ≠ 1).
    const stencilMats = Object.fromEntries(
      Object.entries(this.materials).map(([k, m]) => {
        const c = m.clone();
        Object.assign(c, {
          stencilWrite: true,
          stencilRef: 1,
          stencilFunc: THREE.AlwaysStencilFunc,
          stencilZPass: THREE.ReplaceStencilOp,
        });
        return [k, c];
      }),
    ) as Record<MaterialClass, THREE.Material>;
    this.player = this.buildCharacter(jadeRig(), stencilMats);
    this.scene.add(this.player.root);
    this.xray = this.player.root.clone(true);
    const xmat = new THREE.MeshBasicMaterial({
      color: "#00ffff",
      transparent: true,
      opacity: 0.35,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc,
    });
    // Pair the joints now — before hand props are attached to the player,
    // which would shift a parallel traversal by one node per prop.
    const srcNodes: THREE.Object3D[] = [];
    this.player.root.traverse((o) => srcNodes.push(o));
    let xi = 0;
    this.xray.traverse((o) => {
      const src = srcNodes[xi++];
      if (src && src !== this.player.root && o instanceof THREE.Group)
        this.xrayPairs.push([src, o]);
    });
    this.xray.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = xmat;
        o.castShadow = false;
        o.renderOrder = 10;
      }
    });
    this.attachHandProps(this.player, stencilMats);
    this.scene.add(this.xray);
    this.lantern = new THREE.PointLight("#ffd9a0", 60, 22, 1.6);
    this.scene.add(this.lantern);

    const ringGeo = new THREE.RingGeometry(2.2, 2.6, 32).rotateX(-Math.PI / 2);
    this.focusRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: "#FFB800", transparent: true, opacity: 0.9 }),
    );
    this.focusRing.visible = false;
    this.scene.add(this.focusRing);
    this.pathDots = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: "#7fe8ff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
      PATH_DOTS_MAX,
    );
    this.pathDots.count = 0;
    this.pathDots.visible = false;
    this.pathDots.frustumCulled = false;
    this.scene.add(this.pathDots);

    // Soft contact shadows under characters: one instanced quad, one draw call.
    const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.blobAlpha = new THREE.InstancedBufferAttribute(new Float32Array(BLOB_CAPACITY), 1);
    this.blobAlpha.setUsage(THREE.DynamicDrawUsage);
    blobGeo.setAttribute("aAlpha", this.blobAlpha);
    this.blobs = new THREE.InstancedMesh(
      blobGeo,
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aAlpha;
          varying vec2 vUv;
          varying float vA;
          void main() {
            vUv = uv;
            vA = aAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          varying float vA;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float a = 1.0 - smoothstep(0.15, 1.0, d);
            gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * vA);
          }`,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      BLOB_CAPACITY,
    );
    this.blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blobs.frustumCulled = false;
    this.blobs.castShadow = false;
    this.blobs.receiveShadow = false;
    this.blobs.renderOrder = 2;
    this.blobs.count = 0;
    this.scene.add(this.blobs);

    const s = getState();
    this.walker = new Walker([...s.pos]);
    this.setFloor(s.floor, s.pos);
    this.bindInput();
    this.resize();
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  // ── Public API ────────────────────────────────────────────────

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.stopWalk();
    }
  }

  rotate(dir: 1 | -1): void {
    this.yawGoal += (dir * Math.PI) / 2;
  }

  zoomBy(factor: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, 18, 140);
  }

  /** Apply graphics / camera / accessibility settings live. */
  applySettings(next: Settings): void {
    this.settings = next;
    const g = next.graphics;
    this.renderer.setPixelRatio(effectivePixelRatio(g, window.devicePixelRatio));
    const size = shadowMapSize(g);
    this.renderer.shadowMap.enabled = size > 0;
    this.keyLight.castShadow = size > 0;
    if (size > 0 && this.keyLight.shadow.mapSize.x !== size) {
      this.keyLight.shadow.mapSize.set(size, size);
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
    }
    this.fx?.setDensity(g.particles);
    this.fx?.setCalm(next.accessibility.reduceFlicker);
    this.bloom.enabled = g.bloom;
    this.bloom.strength = g.bloomStrength;
    const calm = next.accessibility.reduceFlicker;
    this.crt.uniforms.uGrain.value = calm ? 0.015 : 0.045;
    this.crt.uniforms.uScanBand.value = calm ? 0 : 0.04;
    this.crt.uniforms.uAberration.value = next.accessibility.reduceMotion ? 0.0004 : 0.0012;
    for (const f of this.floors.values()) f.doors.setCalm(next.accessibility.reduceMotion, calm);
    this.resize();
  }

  /** Cycle wall cutaway: hoch → halb → tief. Returns the new mode label. */
  cycleWalls(): string {
    this.wallMode = (this.wallMode + 1) % WALL_MODES.length;
    const v = this.active;
    this.restoreCutaway(v);
    this.applyCutaway(v);
    const cut = WALL_MODES[this.wallMode]!.cut;
    v.doors.setCut(cut);
    v.staticDirty = true;
    this.elevators.setCut(cut);
    return WALL_MODES[this.wallMode]!.label;
  }

  get wallModeLabel(): string {
    return WALL_MODES[this.wallMode]!.label;
  }

  private cutKey(x: number, y: number, z: number): number {
    return x + FLOOR_SIZE.x * (z + FLOOR_SIZE.z * y);
  }

  private restoreCutaway(v: FloorView): void {
    for (const [k, val] of v.cutSaved) {
      const x = k % FLOOR_SIZE.x;
      const z = Math.floor(k / FLOOR_SIZE.x) % FLOOR_SIZE.z;
      const y = Math.floor(k / (FLOOR_SIZE.x * FLOOR_SIZE.z));
      v.layout.world.set(x, y, z, val);
    }
    v.cutSaved.clear();
    // Doors/lamps may have changed while hidden — force a re-sync.
    v.lampKeys.clear();
  }

  private applyCutaway(v: FloorView): void {
    v.cutDirty = false;
    const cut = WALL_MODES[this.wallMode]!.cut;
    if (!Number.isFinite(cut)) return;
    const w = v.layout.world;
    for (let y = cut + 1; y < FLOOR_SIZE.y; y++)
      for (let z = 0; z < FLOOR_SIZE.z; z++)
        for (let x = 0; x < FLOOR_SIZE.x; x++) {
          const val = w.get(x, y, z);
          if (!val) continue;
          v.cutSaved.set(this.cutKey(x, y, z), val);
          w.set(x, y, z, 0);
        }
  }

  setBloom(on: boolean): void {
    this.bloom.enabled = on;
  }

  get floor(): FloorId {
    return this.active.floor;
  }

  setFloor(floor: FloorId, pos?: Vec3): void {
    if (this.active) {
      this.finishTransitions(this.active);
      this.active.group.visible = false;
    }
    let view = this.floors.get(floor);
    if (!view) {
      view = this.buildFloorView(floor);
      this.floors.set(floor, view);
    }
    this.active = view;
    view.group.visible = true;
    const e = ELEVATORS.find((x) => x.floor === floor)!;
    // Mid-ride the new floor keeps Lawrence where she stood on the deck.
    const p: Vec3 =
      pos && this.ride
        ? [e.x + 0.5 + this.ride.spot[0], pos[1], e.z + 0.5 + this.ride.spot[1]]
        : (pos ?? [e.x - 6, 1, e.z]);
    this.walker.teleport(p);
    this.focus = null;
    this.stopWalk();
    // Camera: cut to the new floor (no pan across the map), then let the
    // zoom settle in; the floor mood cross-fades in updateLighting.
    this.target.set(p[0], p[1] + 2, p[2]);
    for (const d of this.camDamp) d.v = 0;
    this.settleT = 0;
    const mood = floorMood(floor);
    this.tintGoal.setRGB(mood.tint[0], mood.tint[1], mood.tint[2]);
    this.hemi.color.set(mood.sky);
    this.keyLight.color.set(mood.key);
    this.moodAmbient = mood.ambient;
    this.moodKeyGain = mood.keyGain;
    this.brownoutAt.clear();
    // Ambient particles per room.
    this.fx.clear();
    this.fx.clearAmbient();
    this.roomMotes.clear();
    for (const r of ROOMS) {
      if (r.floor !== floor) continue;
      const t = r.theme ?? "generic";
      const kind: AmbientKind =
        t === "anomaly" || t === "portal" || t === "containment"
          ? "wisps"
          : t === "cooling" || t === "cryo" || t === "geothermal"
            ? "steam"
            : t === "forge" || t === "reactor"
              ? "embers"
              : "dust";
      this.fx.ambient({ x: r.x + 1, z: r.z + 1, w: r.w - 2, d: r.d - 2 }, kind);
      // Lamp-lit dust motes; enabled in sync/updateMotes only while the room
      // is lit and near the camera (keeps the shared glow pool small).
      this.roomMotes.set(
        r.id,
        this.fx.ambient({ x: r.x + 1, z: r.z + 1, w: r.w - 2, d: r.d - 2 }, "motes", undefined, {
          enabled: false,
          color: mood.motes,
        }),
      );
    }
    const amb = FLOOR_BY_ID[floor].ambient;
    this.hemi.groundColor.set(amb);
    this.motesCheck = 0;
    this.sync();
    view.doors.snap(this.walker.position);
    this.cb.onMove(floor, this.walker.position);
  }

  /** Re-read the state (after any game action) and update the view. */
  sync(): void {
    const s = this.getState();
    const v = this.active;
    const p = power(s);
    this.powerState = p;
    this.powerAge = 0;
    const switchedOn = newlyOnline(this.prevOnline, p.online);
    this.prevOnline = new Set(p.online);
    // Devices: rebuild when stage or power changed (power changes ramp, see stepDevice).
    for (const dv of v.devices.values()) {
      const want: DeviceBuild = {
        discovered: !!s.discovered[dv.id],
        done: stagesDone(s, dv.id),
        powered: p.online.has(dv.id),
      };
      const b = dv.built;
      if (b && sameBuild(b, want)) {
        // Unchanged — or power came back while the rig was still winding down.
        dv.pending = null;
        dv.rampTarget = want.powered ? 1 : 0;
        this.screens.setPoweredAll(dv.screenRefs, want.powered);
        continue;
      }
      if (
        b &&
        dv.rig &&
        b.powered &&
        !want.powered &&
        b.done === want.done &&
        b.discovered === want.discovered
      ) {
        // Power lost: wind the rig down first, rebuild dark once it has stopped.
        dv.pending = want;
        dv.rampTarget = 0;
        this.setBaseBatched(v, dv);
        this.screens.setPoweredAll(dv.screenRefs, false);
        continue;
      }
      this.buildDevice(v, dv, want);
    }
    this.startleAt(v, switchedOn);
    // Power-on flash for devices that just came online on this floor.
    for (const id of switchedOn) {
      const dv = v.devices.get(id);
      if (!dv?.group.visible) continue;
      const [x0, z0, x1, z1, h] = dv.footprint;
      this.tmpV.set((x0 + x1) / 2, 1 + Math.min(h, 4) * 0.25, (z0 + z1) / 2);
      this.fx.emit("power_on", this.tmpV, {
        scale: THREE.MathUtils.clamp(Math.max(x1 - x0, z1 - z0) / 4, 0.6, 1.6),
      });
    }
    this.rebuildCollision(v);
    v.navDirty = true;
    this.updateStations(v, s);
    this.syncBots(v, s);
    this.syncAvatar(v, s, p);
    // Pickups & notes: taken pickups fly to Lawrence, read notes fold away.
    const still = this.settings.accessibility.reduceMotion;
    const [wx, , wz] = this.walker.position;
    const nearPlayer = (x: number, z: number): boolean =>
      Math.hypot(x + 0.5 - wx, z + 0.5 - wz) < 10;
    for (const pk of PICKUPS) {
      if (pk.floor !== v.floor || v.flights.has(pk.id)) continue;
      const g = v.pickups.get(pk.id)!;
      const on = pickupAvailable(s, pk) && !pickupNeedsTool(s, pk);
      const want = on || (pickupAvailable(s, pk) && pickupNeedsTool(s, pk));
      const shown = g.visible && g.userData.synced === true;
      g.userData.synced = true;
      if (shown && !want && !still && nearPlayer(pk.x, pk.z)) {
        v.flights.set(pk.id, { t: 0, home: g.position.clone() });
        g.userData.leaving = true;
        continue;
      }
      g.visible = want;
      g.userData.dim = !on;
    }
    for (const n of NOTES) {
      if (n.floor !== v.floor || v.folds.has(n.id)) continue;
      const g = v.notes.get(n.id)!;
      const want = noteVisible(s, n.id);
      const shown = g.visible && g.userData.synced === true;
      g.userData.synced = true;
      const paper = g.children[0];
      if (shown && !want && !still && paper instanceof THREE.Mesh) {
        // Fold in place: the page leaves the static batch while it moves.
        delete paper.userData.batch;
        paper.layers.set(0);
        g.userData.leaving = true;
        v.folds.set(n.id, 0);
        continue;
      }
      g.visible = want;
    }
    // Doors (animated leaves; voxel door cells stay empty).
    for (const d of DOORS) {
      if (d.floor !== v.floor) continue;
      const variant: DoorVariant = d.secret
        ? "secret"
        : d.keypad
          ? "keypad"
          : d.lock
            ? "locked"
            : "normal";
      v.doors.setState(d.id, doorIsOpen(s, d), variant);
    }
    // Room lights.
    for (const r of ROOMS) {
      if (r.floor !== v.floor) continue;
      const lit = p.generation >= 50 && (!r.litBy || p.online.has(r.litBy));
      if (v.lampKeys.get(r.id) !== lit) {
        v.lampKeys.set(r.id, lit);
        setLamps(v.layout.world, v.layout.lamps, r.id, lit);
        const shaft = v.shafts.get(r.id);
        if (shaft) shaft.uniforms.uAlpha!.value = lit ? 1 : 0;
        v.cutDirty = true;
      }
      const light = v.roomLights.get(r.id)!;
      light.intensity = lit ? 16 + Math.min(r.w, r.d) * 0.3 : 0;
      light.userData.base = light.intensity;
      for (const dl of v.decorLights) {
        if (dl.room !== r.id) continue;
        dl.light.intensity = !dl.requiresPower || lit ? dl.base : 0;
      }
      const smoke = v.smoke.get(r.id);
      if (smoke) smoke.visible = !p.online.has("VNT-001");
    }
    const litRooms = new Set(
      ROOMS.filter(
        (r) => r.floor === v.floor && p.generation >= 50 && (!r.litBy || p.online.has(r.litBy)),
      ).map((r) => r.id),
    );
    v.litRooms = litRooms;
    this.motesCheck = 0; // re-evaluate dust motes next frame
    for (const ds of v.decorScreens) this.screens.setPowered(ds.ref, litRooms.has(ds.room));
    for (const dr of v.decorRigs) dr.rig.powered = litRooms.has(dr.room);
    for (const t of v.terminals) {
      const def = ROOM_TERMINALS.find((x) => x.id === t.id);
      this.screens.setPowered(t.ref, !!def && evalCond(s, def.requires));
    }
    const anyLit = p.generation >= 50;
    this.hemi.intensity = (anyLit ? 0.45 : 0.16) * this.moodAmbient;
    this.sun.intensity = (anyLit ? 0.35 : 0.08) * this.moodAmbient;
    this.keyRoom = null; // re-aim the key light on the next frame
    if (v.cutDirty) this.applyCutaway(v);
    if (v.anomaly) v.anomaly.visible = true;
    if (v.rift) v.rift.visible = isOnline(s, "DIM-001");
    // NPC visibility.
    for (const npc of v.npcs.values()) {
      const def = NPCS.find((n) => n.id === npc.id);
      npc.group.visible = !def?.visible || evalCond(s, def.visible);
    }
    for (const it of v.interactables)
      it.active = it.secretDoor
        ? !doorIsOpen(s, it.secretDoor) && prototypeUseOptions(s, it.secretDoor.id).length > 0
        : it.object.visible && it.object.userData.leaving !== true;
    v.staticDirty = true;
    v.instancer.markDirty();
    this.updateFocus(true);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    for (const f of this.cleanup) f();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
    });
    for (const f of this.floors.values()) {
      for (const dv of f.devices.values()) {
        dv.rampMat?.dispose();
        (dv.scan?.material as THREE.Material | undefined)?.dispose();
      }
      f.batch.dispose();
      f.instancer.dispose();
      f.renderer.dispose();
    }
    this.sharedGeo.clear();
    Object.values(this.materials).forEach((m) => m.dispose());
    (this.blobs.material as THREE.Material).dispose();
    this.fx.dispose();
    this.screens.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Screen position (CSS px) of the focused object, for the label. */
  focusScreenPos(): { x: number; y: number } | null {
    if (!this.focus) return null;
    const v = new THREE.Vector3(this.focus.x + 0.5, 7.5, this.focus.z + 0.5).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height };
  }

  /** Ride the elevator to another floor; the caller switches floors at the midpoint. */
  rideElevator(
    to: FloorId,
    hooks: { onMidpoint: () => void; onEvent?: (e: ElevatorEvent) => void; onDone?: () => void },
  ): boolean {
    const from = this.active.floor;
    const e = ELEVATORS.find((x) => x.floor === from)!;
    // Without power the cage is dead: Lawrence takes the emergency ladder on
    // the shaft wall (east) instead of holding the rail facing the gate (west).
    const ladder = (this.powerState ?? power(this.getState())).generation < 50;
    const ride = ladder
      ? { mode: "climb" as const, spot: [1.4, 0] as [number, number], facing: Math.PI / 2 }
      : { mode: "ride" as const, spot: [0.6, -0.8] as [number, number], facing: -Math.PI / 2 };
    this.walker.teleport([e.x + 0.5 + ride.spot[0], 1, e.z + 0.5 + ride.spot[1]]);
    this.stopWalk();
    const ok = this.elevators.ride(from, to, hooks.onMidpoint, {
      onEvent: (ev) => {
        this.rideEvent(ev);
        hooks.onEvent?.(ev);
      },
      onDone: () => {
        this.ride = null;
        hooks.onDone?.();
      },
    });
    if (ok) {
      this.ride = ride;
      this.cage = { offset: 0, vel: 0, load: 0 };
      this.track = switchPose(this.track, ride.mode, this.time);
    }
    return ok;
  }

  /** Let go of the rail as the gate opens; step out of the cage once it is open. */
  private rideEvent(ev: ElevatorEvent): void {
    const r = this.ride;
    if (!r) return;
    if (ev === "gate-open") this.track = switchPose(this.track, "idle", this.time);
    if (ev === "done") {
      const e = ELEVATORS.find((x) => x.floor === this.active.floor)!;
      this.stopWalk();
      this.walkTo = new THREE.Vector3(e.x + 0.5 - 4.2, 1, e.z + 0.5 + r.spot[1]);
      this.walkStuck = 0;
    }
  }

  /** Decor placement behind a `{ kind: "decor" }` target. */
  decorPlacement(id: string): DecorPlacement | undefined {
    return this.decorById.get(id);
  }

  /** Emit a visual effect at a world position (for UI-driven events). */
  fxAt(kind: FxKind, x: number, y: number, z: number): void {
    this.fx.emit(kind, new THREE.Vector3(x, y, z));
  }

  /** Make a room's lights stutter for a moment (ambient event / brownout). */
  flickerRoom(roomId: string, seconds: number): void {
    if (this.settings.accessibility.reduceFlicker) return;
    this.flickers.set(roomId, this.time + seconds);
  }

  /** Current camera pose, the start point for cinematics. */
  cameraPose(): { target: [number, number, number]; zoom: number; yaw: number } {
    return {
      target: [this.target.x, this.target.y, this.target.z],
      zoom: this.zoomS,
      yaw: this.yaw,
    };
  }

  /** Snap the yaw back to the nearest 90° step (after a cinematic). */
  snapYaw(): void {
    const q = Math.PI / 2;
    this.yawGoal = Math.round((this.yaw - Math.PI / 4) / q) * q + Math.PI / 4;
  }

  playerPosition(): Vec3 {
    return this.walker.position;
  }

  playerFacing(): number {
    return this.walker.facing;
  }

  cameraYaw(): number {
    return this.yaw;
  }

  /**
   * Glow burst over the workbench nearest Lawrence on this floor, for the UI
   * to call right after a combination resolves: recipe → warm glow,
   * prototype → violet glow + sparkle, explosion → blast, shake and a lamp stutter.
   */
  workbenchFx(result: "recipe" | "prototype" | "explosion"): void {
    const floor = this.active.floor;
    const [px, , pz] = this.walker.position;
    let bench: (typeof PROPS)[number] | undefined;
    let bestD = Infinity;
    for (const p of PROPS) {
      if (p.floor !== floor || p.kind !== "workbench") continue;
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < bestD) {
        bestD = d;
        bench = p;
      }
    }
    if (!bench) return;
    const pos = new THREE.Vector3(
      bench.x + 0.5,
      1 + propGrid(bench).h * MODEL_SCALE,
      bench.z + 0.5,
    );
    if (result === "recipe") this.fx.emit("craft_glow", pos);
    else if (result === "prototype") {
      this.fx.emit("craft_glow", pos, { color: 0xb060ff, scale: 1.2 });
      this.fx.emit("build_sparkle", pos, { color: 0xb060ff, scale: 0.5, count: 0.6 });
    } else {
      this.fx.emit("explosion", pos, { scale: 0.6 });
      this.shake.add(0.45);
      const room = roomAt(floor, bench.x, bench.z);
      if (room) this.flickerRoom(room.id, 0.6);
    }
  }

  // ── State transitions (power ramps, build flourish, pickups, notes, doors) ──

  /** (Re)mesh a device for `want`; starts the power ramp / build flourish where they apply. */
  private buildDevice(v: FloorView, dv: DeviceView, want: DeviceBuild): void {
    const def = DEVICES.find((d) => d.id === dv.id)!;
    const stages = def.stages.length;
    const prev = dv.built;
    dv.pending = null;
    v.lightsDirty = true;
    for (const ref of dv.screenRefs) this.screens.detach(ref);
    dv.screenRefs = [];
    this.endAssembly(dv);
    this.clearGroup(dv.group);
    dv.base = null;
    dv.rig = null;
    dv.built = want;
    dv.group.visible = want.discovered || want.done > 0;
    if (!want.powered) {
      dv.ramp = 0;
      dv.rampTarget = 0;
    } else {
      dv.rampTarget = 1;
      // Newly powered: ramp up from where it is; otherwise (first build, stage change) at full.
      if (!prev || prev.powered) dv.ramp = 1;
    }
    if (dv.group.visible) {
      const grid = stagedBuildGrid(dv.model.grid, want.done / stages, want.powered);
      dv.base = this.meshModel(grid, dv.visual.scale ?? MODEL_SCALE, true, "device");
      dv.group.add(dv.base);
      if (want.done >= stages) {
        dv.rig = this.buildVisualRig(dv.visual, dv.group, want.powered);
        dv.rig.ramp = dv.anim;
        dv.screenRefs = this.screens.attachVisual(
          dv.group,
          dv.visual,
          { deviceId: dv.id },
          want.powered,
        );
      }
      if (prev && want.done > prev.done) this.startAssembly(v, dv);
    }
    this.setBaseBatched(v, dv);
  }

  /**
   * A settled device base is merged into its static tile; while it ramps,
   * winds down or drops in, it renders on its own with a private emit
   * material (the tile re-merges in the same frame, so nothing flashes).
   */
  private setBaseBatched(v: FloorView, dv: DeviceView): void {
    const base = dv.base;
    const settled = dv.assembleT < 0 && !dv.pending && dv.ramp === dv.rampTarget;
    if (settled) {
      if (base && base.userData.batch !== "static") {
        markStatic(base);
        base.material = MATERIAL_ORDER.map((c) => this.materials[c]);
        v.staticDirty = true;
      }
      if (dv.rampMat) {
        dv.rampMat.dispose();
        dv.rampMat = null;
      }
      return;
    }
    if (!base) return;
    if (base.userData.batch === "static") {
      delete base.userData.batch;
      base.layers.set(0);
      v.staticDirty = true;
    }
    const mat =
      dv.rampMat ??
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        color: new THREE.Color(EMIT_GAIN, EMIT_GAIN, EMIT_GAIN),
      });
    dv.rampMat = mat;
    base.material = MATERIAL_ORDER.map((c) => (c === "emit" ? mat : this.materials[c]));
  }

  /** Per frame: advance the power ramp, rig clock and build flourish of one device. */
  private stepDevice(v: FloorView, dv: DeviceView, dt: number): void {
    if (dv.ramp !== dv.rampTarget) {
      dv.ramp = stepRamp(dv.ramp, dv.rampTarget, dt);
      if (dv.ramp === dv.rampTarget) {
        if (dv.rampTarget === 0 && dv.pending) this.buildDevice(v, dv, dv.pending);
        else this.setBaseBatched(v, dv);
      }
    }
    const a = dv.anim;
    a.speed = spinFactor(dv.ramp);
    a.glow = glowFactor(
      dv.ramp,
      this.time,
      dv.rampTarget === 1,
      this.settings.accessibility.reduceFlicker,
    );
    a.clock += dt * a.speed;
    if (dv.rampMat) {
      const g = EMIT_GAIN * Math.max(0.06, a.glow);
      dv.rampMat.color.setRGB(g, g, g);
    }
    if (dv.assembleT >= 0) this.stepAssembly(v, dv, dt);
  }

  /** Build stage done: the model drops in with a bounce under a sweeping scan line. */
  private startAssembly(v: FloorView, dv: DeviceView): void {
    dv.assembleT = 0;
    dv.assembleStill = this.settings.accessibility.reduceMotion;
    const [x0, z0, x1, z1] = dv.footprint;
    const size = Math.max(x1 - x0, z1 - z0);
    this.scanGeo ??= new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const scan = new THREE.Mesh(
      this.scanGeo,
      new THREE.MeshBasicMaterial({
        color: "#5ff6ff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    scan.userData.sharedGeo = true;
    scan.castShadow = false;
    scan.receiveShadow = false;
    scan.renderOrder = 4;
    scan.position.set((x0 + x1) / 2, 1.05, (z0 + z1) / 2);
    scan.scale.set(size * 1.25 + 0.4, 1, size * 1.25 + 0.4);
    v.group.add(scan);
    dv.scan = scan;
    this.fx.emit("assemble", this.tmpV.set((x0 + x1) / 2, 1.2, (z0 + z1) / 2), {
      scale: THREE.MathUtils.clamp(size / 4, 0.6, 1.6),
    });
  }

  private stepAssembly(v: FloorView, dv: DeviceView, dt: number): void {
    const t0 = dv.assembleT;
    dv.assembleT += dt;
    const k = dv.assembleT / ASSEMBLY_TIME;
    if (k >= 1) {
      this.endAssembly(dv);
      this.setBaseBatched(v, dv);
      return;
    }
    const pose = assemblyPose(k, dv.assembleStill);
    dv.group.position.y = 1 + pose.lift;
    dv.group.scale.y = pose.squashY;
    const [x0, z0, x1, z1, h] = dv.footprint;
    if (dv.scan) {
      dv.scan.position.y = 1.05 + pose.scan * (h + 0.3);
      (dv.scan.material as THREE.MeshBasicMaterial).opacity = 0.55 * pose.scanAlpha;
    }
    if (!dv.assembleStill && pose.landed && !assemblyPose(t0 / ASSEMBLY_TIME).landed) {
      const size = Math.max(x1 - x0, z1 - z0);
      this.fx.emit("dust", this.tmpV.set((x0 + x1) / 2, 1, (z0 + z1) / 2), {
        scale: THREE.MathUtils.clamp(size / 3, 0.6, 1.8),
        count: 0.8,
      });
    }
  }

  private endAssembly(dv: DeviceView): void {
    dv.assembleT = -1;
    dv.group.position.y = 1;
    dv.group.scale.y = 1;
    if (dv.scan) {
      dv.scan.removeFromParent();
      (dv.scan.material as THREE.Material).dispose();
      dv.scan = null;
    }
  }

  /** Taken pickups fly to Lawrence and shrink; read notes fold in half twice. */
  private stepPickupsAndNotes(v: FloorView, dt: number): void {
    if (v.flights.size) {
      const [px, py, pz] = this.walker.position;
      const lift = this.elevators.riding ? this.elevators.offset : 0;
      for (const [id, f] of v.flights) {
        const g = v.pickups.get(id);
        if (!g) {
          v.flights.delete(id);
          continue;
        }
        f.t += dt;
        const k = f.t / PICKUP_FLIGHT_TIME;
        if (k >= 1) {
          g.visible = false;
          g.position.copy(f.home);
          g.scale.setScalar(1);
          g.rotation.y = 0;
          delete g.userData.leaving;
          v.flights.delete(id);
          continue;
        }
        const pose = pickupFlight(k);
        g.position.lerpVectors(f.home, this.tmpV.set(px, py + lift + 2.2, pz), pose.travel);
        g.position.y += pose.arc;
        g.scale.setScalar(pose.scale);
        g.rotation.y = pose.spin;
      }
    }
    for (const [id, t0] of v.folds) {
      const g = v.notes.get(id);
      const paper = g?.children[0];
      if (!g || !(paper instanceof THREE.Mesh)) {
        v.folds.delete(id);
        continue;
      }
      const t = t0 + dt;
      if (t >= NOTE_FOLD_TIME) {
        g.visible = false;
        paper.scale.setScalar(MODEL_SCALE);
        paper.rotation.x = 0;
        markStatic(paper);
        delete g.userData.leaving;
        delete g.userData.fold;
        v.folds.delete(id);
        v.staticDirty = true;
        continue;
      }
      v.folds.set(id, t);
      const pose = noteFold(t / NOTE_FOLD_TIME);
      paper.scale.set(MODEL_SCALE * pose.scaleX, MODEL_SCALE, MODEL_SCALE * pose.scaleZ);
      paper.rotation.x = pose.tilt;
      g.userData.fold = pose.glow;
    }
  }

  /** Leaving a floor: land every running flourish / flight / fold (power ramps just resume). */
  private finishTransitions(v: FloorView): void {
    for (const dv of v.devices.values()) {
      if (dv.assembleT < 0) continue;
      this.endAssembly(dv);
      this.setBaseBatched(v, dv);
    }
    this.stepPickupsAndNotes(v, 60);
  }

  /** DoorSystem callback: the beacon just turned green. */
  private doorUnlocked(id: string): void {
    this.cb.onDoorUnlock?.(id);
    const d = DOORS.find((x) => x.id === id);
    if (!d || d.floor !== this.active?.floor) return;
    this.fx.emit("unlock", this.tmpV.set(d.x + 0.5, 7, d.z + 0.5), { scale: 0.8 });
  }

  // ── Building the scene ────────────────────────────────────────

  /**
   * Mesh a model grid refined 2×2×2 with its family's detail rules (see
   * models/refine.ts). The mesh keeps the source grid's units, so `scale`,
   * pivots and offsets are unchanged; refined meshes are cached by content.
   */
  private meshModel(
    grid: VoxelGrid,
    scale: number,
    center: boolean,
    family: RefineFamily,
    materialOf?: (i: number) => MaterialClass,
    materials: Record<MaterialClass, THREE.Material> = this.materials,
  ): THREE.Mesh {
    const data = refinedModelMesh(grid, family, {
      center,
      ...(materialOf ? { materialOf } : {}),
    });
    const mesh = toMesh(data, materials);
    mesh.scale.setScalar(scale);
    return mesh;
  }

  /**
   * Mesh a grid with a geometry shared by every mesh of the same `key`
   * (same arguments → same geometry), so the auto-instancer can batch them.
   */
  private sharedMesh(
    key: string,
    grid: VoxelGrid,
    scale: number,
    center: boolean,
    family: RefineFamily,
    materials: Record<MaterialClass, THREE.Material> = this.materials,
  ): THREE.Mesh {
    let geo = this.sharedGeo.get(key);
    if (!geo) {
      geo = toGeometry(refinedModelMesh(grid, family, { center }));
      this.sharedGeo.set(key, geo);
    }
    const mesh = new THREE.Mesh(
      geo,
      MATERIAL_ORDER.map((c) => materials[c]),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.setScalar(scale);
    mesh.userData.sharedGeo = true;
    return mesh;
  }

  /** Remove a group's children and free their (unshared) geometry. */
  private clearGroup(g: THREE.Group): void {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse((o) => {
        if ((o instanceof THREE.Mesh || o instanceof THREE.Points) && !o.userData.sharedGeo)
          o.geometry.dispose();
      });
    }
  }

  /** Build a jointed character from a rig definition (parents first). */
  private buildCharacter(
    def: CharacterRigDef,
    materials: Record<MaterialClass, THREE.Material> = this.materials,
  ): CharacterRig {
    const root = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(def.scale);
    root.add(inner);
    const holo = def.hologram ? () => "glass" as MaterialClass : undefined;
    const joints = new Map<string, THREE.Group>();
    const rest = new Map<string, THREE.Vector3>();
    for (const part of def.parts) {
      const j = new THREE.Group();
      const rp = jointRestPosition(def, part);
      j.position.set(rp[0], rp[1], rp[2]);
      const mesh = this.meshModel(
        part.model.grid,
        1,
        false,
        familyFor(def, "character"),
        holo,
        materials,
      );
      mesh.position.set(-part.origin[0], -part.origin[1], -part.origin[2]);
      mesh.castShadow = !def.hologram;
      j.add(mesh);
      (part.parent ? (joints.get(part.parent) ?? inner) : inner).add(j);
      joints.set(part.name, j);
      rest.set(part.name, j.position.clone());
    }
    return { root, joints, rest };
  }

  private applyPose(rig: CharacterRig, pose: CharacterPose): void {
    for (const [name, j] of rig.joints) {
      const pp = pose[name as RigPartName];
      if (!pp) continue;
      j.rotation.set(pp.rot[0], pp.rot[1], pp.rot[2]);
      const r = rig.rest.get(name)!;
      j.position.set(r.x + (pp.pos?.[0] ?? 0), r.y + (pp.pos?.[1] ?? 0), r.z + (pp.pos?.[2] ?? 0));
    }
  }

  /**
   * Ride bookkeeping per frame: turn towards the gate / ladder and derive the
   * cage's vertical acceleration (knees, hair) and rattle from its offset.
   * The offset flips sign at the midpoint (floor switch) — skip that frame.
   */
  private stepRide(dt: number, offset: number): void {
    const r = this.ride;
    let load = 0;
    let rattle = 0;
    if (r) {
      this.walker.facing = approachAngle(this.walker.facing, r.facing, dt, 6);
      this.cage = cageMotion(this.cage, offset, dt);
      load = this.cage.load;
      rattle = r.mode === "ride" ? Math.min(1, Math.abs(this.cage.vel) / 3) : 0;
    }
    this.rideLoad = approach(this.rideLoad, r?.mode === "ride" ? load : 0, dt, 5);
    this.rideRattle = approach(this.rideRattle, rattle, dt, 6);
  }

  /**
   * Idle head turn: towards a device that just powered on (held a few
   * seconds), else the nearest running device within LOOK_RADIUS. Re-picked
   * 4× a second; yaw and weight ease so the head never snaps.
   */
  private stepLook(dt: number): void {
    this.lookCheck -= dt;
    const idle = !this.ride && this.walkW < 0.3 && this.idleFor > 1.2;
    const kind = this.track.kind;
    if (this.lookCheck <= 0) {
      this.lookCheck = 0.25;
      this.lookGoal = null;
      if (idle && (kind === "idle" || kind === "startle")) {
        const [px, , pz] = this.walker.position;
        const hold = this.lookHold && this.lookHold.until > this.time ? this.lookHold : null;
        if (hold) this.lookGoal = lookYaw(this.walker.facing, hold.x - px, hold.z - pz);
        else {
          let best = LOOK_RADIUS;
          for (const dv of this.active.devices.values()) {
            if (!dv.built?.powered || !dv.group.visible) continue;
            const [x0, z0, x1, z1] = dv.footprint;
            // Distance to the footprint's nearest edge, aim at its centre.
            const ex = Math.max(x0 - px, 0, px - x1);
            const ez = Math.max(z0 - pz, 0, pz - z1);
            const dist = Math.hypot(ex, ez);
            if (dist >= best) continue;
            const yaw = lookYaw(this.walker.facing, (x0 + x1) / 2 - px, (z0 + z1) / 2 - pz);
            if (yaw === null) continue;
            best = dist;
            this.lookGoal = yaw;
          }
        }
      }
    }
    const on = idle && this.lookGoal !== null;
    if (on) this.lookYawS = approach(this.lookYawS, this.lookGoal!, dt, 3);
    this.lookW = approach(this.lookW, on ? 1 : 0, dt, on ? 2 : 4);
  }

  /** Flinch when a device powers on within reach (only while standing idle). */
  private startleAt(v: FloorView, switchedOn: readonly string[]): void {
    if (this.ride || !switchedOn.length || this.track.kind !== "idle" || this.walker.moving) return;
    const [px, , pz] = this.walker.position;
    for (const id of switchedOn) {
      const dv = v.devices.get(id);
      if (!dv?.group.visible) continue;
      const [x0, z0, x1, z1] = dv.footprint;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (Math.hypot(cx - px, cz - pz) > LOOK_RADIUS + 4) continue;
      this.track = restartPose(this.track, "startle", this.time);
      this.lookHold = { x: cx, z: cz, until: this.time + 4 };
      this.lookCheck = 0;
      return;
    }
  }

  /** What Lawrence's body language shows (set by the UI: dialogue → talk, …). */
  setPlayerMode(mode: PlayerMode): void {
    // The ride / climb owns the body until the gate opens (overlays close as it starts).
    if (this.ride) return;
    if (mode !== this.track.kind) this.track = switchPose(this.track, mode, this.time);
  }

  /** One-shot gesture (interact, crouch) that returns to idle when done. */
  playGesture(kind: "interact" | "crouch"): void {
    this.track = restartPose(this.track, kind, this.time);
  }

  /** Mug, book, crate and wrench meshes parented to Lawrence's joints (hidden until a pose uses them). */
  private attachHandProps(
    rig: CharacterRig,
    materials: Record<MaterialClass, THREE.Material>,
  ): void {
    for (const k of HAND_PROPS) {
      const hp = handProp(k);
      const joint = rig.joints.get(hp.joint);
      if (!joint) continue;
      const mesh = this.meshModel(hp.model.grid, hp.scale, false, "detail", undefined, materials);
      mesh.position.set(hp.anchor[0], hp.anchor[1], hp.anchor[2]);
      mesh.visible = false;
      joint.add(mesh);
      this.handProps.set(k, mesh);
    }
  }

  /** Mesh a lore bot (awake or dormant) into `body`; returns its rig. */
  private buildBotBody(
    body: THREE.Group,
    id: string,
    floor: FloorId,
    x: number,
    z: number,
    awake: boolean,
  ): { rig: VisualRig; screens: ScreenRef[] } {
    const visual = botVisual(id, awake);
    const family = familyFor(visual, "character");
    body.add(this.meshModel(visual.base.grid, visual.scale ?? MODEL_SCALE, true, family));
    const rig = this.buildVisualRig(visual, body, awake, undefined, family);
    const npcRoom = roomAt(floor, x, z)?.id;
    const screens = this.screens.attachVisual(
      body,
      visual,
      npcRoom ? { roomId: npcRoom } : {},
      awake,
    );
    return { rig, screens };
  }

  /** Wake (or put to sleep) lore bots whose `bot_<id>_awake` flag changed. */
  private syncBots(v: FloorView, s: WorldState): void {
    for (const npc of v.npcs.values()) {
      if (npc.awake === undefined || !npc.body) continue;
      const awake = !!s.flags[`bot_${npc.id}_awake`];
      if (awake === npc.awake) continue;
      npc.awake = awake;
      for (const ref of npc.bodyScreens ?? []) this.screens.detach(ref);
      this.clearGroup(npc.body);
      const built = this.buildBotBody(npc.body, npc.id, v.floor, npc.home[0], npc.home[1], awake);
      npc.visual = built.rig;
      npc.bodyScreens = built.screens;
      if (!awake) npc.group.rotation.x = 0.1;
      else npc.group.rotation.x = 0;
    }
  }

  private buildFloorView(floor: FloorId): FloorView {
    const layout = buildFloor(floor);
    const shaft = ELEVATORS.find((x) => x.floor === floor)!;
    for (const c of elevatorHoleCells(shaft)) layout.world.set(c.x, 0, c.z, 0);
    // Light the lamps before the first mesh so a floor never flashes emergency red.
    const lampPower = power(this.getState());
    for (const r of ROOMS) {
      if (r.floor !== floor) continue;
      const lit = lampPower.generation >= 50 && (!r.litBy || lampPower.online.has(r.litBy));
      setLamps(layout.world, layout.lamps, r.id, lit);
    }
    const renderer = new WorldRenderer(
      layout.world,
      LAB_PALETTE,
      this.materials,
      labMaterialOf,
      undefined,
      refineTerrainRegion,
    );
    renderer.syncAll();
    const group = new THREE.Group();
    group.add(renderer.root);
    this.scene.add(group);
    const batch = new StaticBatcher(
      group,
      MATERIAL_ORDER.map((c) => this.materials[c]),
      this.materials.solid,
      BATCH_TILE,
    );
    const instancer = new AutoInstancer(group, this.materials.solid);
    const collision = new FloorCollision(layout.world, FLOOR_SIZE.x, FLOOR_SIZE.z);
    const mesh: MeshModel = (g, sc) => this.meshModel(g, sc, true, "architecture");
    const doors = new DoorSystem({
      onMove: (id, opening) => this.cb.onDoorMove?.(id, opening),
      onUnlock: (id) => this.doorUnlocked(id),
    });
    doors.setCalm(
      this.settings.accessibility.reduceMotion,
      this.settings.accessibility.reduceFlicker,
    );
    for (const d of DOORS) if (d.floor === floor) doors.addDoor(d, group, mesh);
    this.elevators.addFloor(floor, group, shaft);
    const collider: VoxelSource = {
      get: (x, y, z) =>
        collision.get(x, y, z) ||
        (doors.solidAt(x, y, z) || this.elevators.solidAt(floor, x, y, z) ? 1 : 0),
    };
    const view: FloorView = {
      floor,
      layout,
      renderer,
      group,
      collision,
      doors,
      collider,
      devices: new Map(),
      pickups: new Map(),
      notes: new Map(),
      npcs: new Map(),
      interactables: [],
      roomLights: new Map(),
      smoke: new Map(),

      lampKeys: new Map(),
      shafts: new Map(),
      cutSaved: new Map(),
      cutDirty: true,
      decorLights: [],
      decorScreens: [],
      decorRigs: [],
      terminals: [],
      lights: [],
      lightsDirty: true,
      litRooms: new Set(),
      stations: [],
      batch,
      instancer,
      staticDirty: true,
      navDirty: true,
      flights: new Map(),
      folds: new Map(),
    };
    this.buildInterior(view);
    this.buildLightShafts(view);

    const place = (obj: THREE.Object3D, x: number, z: number, rot = 0) => {
      obj.position.set(x + 0.5, 1, z + 0.5);
      obj.rotation.y = (rot * Math.PI) / 2;
      group.add(obj);
    };

    for (const d of DEVICES) {
      const room = ROOMS.find((r) => r.id === d.room)!;
      if (room.floor !== floor) continue;
      const visual = deviceVisual(d.id);
      const model = visual.base;
      const g = new THREE.Group();
      place(g, d.x, d.z, d.rot ?? 0);
      const sc = visual.scale ?? MODEL_SCALE;
      const [fw, fd] = visual.footprint ?? [model.w, model.d];
      const hw = (fw * sc) / 2;
      const hd = (fd * sc) / 2;
      view.devices.set(d.id, {
        id: d.id,
        group: g,
        model,
        visual,
        rig: null,
        screenRefs: [],
        built: null,
        pending: null,
        base: null,
        ramp: 0,
        rampTarget: 0,
        anim: { clock: 0, speed: 0, glow: 0 },
        rampMat: null,
        assembleT: -1,
        assembleStill: false,
        scan: null,
        footprint: [
          d.x + 0.5 - hw,
          d.z + 0.5 - hd,
          d.x + 0.5 + hw,
          d.z + 0.5 + hd,
          (visual.height ?? model.h) * sc,
        ],
      });
      view.interactables.push({
        target: { kind: "device", id: d.id },
        x: d.x,
        z: d.z,
        radius: Math.max(hw, hd),
        object: g,
        active: true,
      });
    }
    for (const p of PROPS) {
      if (p.floor !== floor) continue;
      const g = new THREE.Group();
      const m = propGrid(p);
      const variantDecor = p.variant ? PROP_VARIANT_DECOR[p.variant] : undefined;
      // Hero props (forge, workbench, seep valve) carry their own animated rig:
      // mesh the base without the moving parts, the rig adds them.
      const pv = variantDecor ? undefined : propVisual(p.model);
      if (p.model !== "elevator")
        g.add(markStatic(this.meshModel((pv?.base ?? m).grid, MODEL_SCALE, true, "prop")));
      const vv = variantDecor ? decorVisual(variantDecor) : pv;
      if (vv) {
        view.decorRigs.push({
          room: roomAt(floor, p.x, p.z)?.id ?? "",
          rig: this.buildVisualRig(
            { ...vv, scale: MODEL_SCALE, lights: pv ? vv.lights : [] },
            g,
            false,
            `rig:${variantDecor ?? `prop:${p.model}`}`,
            "prop",
          ),
        });
      }
      place(g, p.x, p.z, p.rot ?? 0);
      if (p.kind !== "decor" || propDecorAction(p)) {
        view.interactables.push({
          target: { kind: "prop", id: p.id },
          x: p.x,
          z: p.z,
          radius: (Math.max(m.w, m.d) * MODEL_SCALE) / 2,
          object: g,
          active: true,
        });
      }
    }
    for (const p of PICKUPS) {
      if (p.floor !== floor) continue;
      const g = new THREE.Group();
      g.add(
        markInstanced(
          this.sharedMesh(
            `pickup:${p.model}`,
            pickupModel(p.model).grid,
            MODEL_SCALE,
            true,
            "pickup",
          ),
        ),
      );
      place(g, p.x, p.z);
      view.pickups.set(p.id, g);
      view.interactables.push({
        target: { kind: "pickup", id: p.id },
        x: p.x,
        z: p.z,
        radius: 1.5,
        object: g,
        active: true,
      });
    }
    for (const n of NOTES) {
      if (n.floor !== floor) continue;
      const g = new THREE.Group();
      const mesh = markStatic(
        this.meshModel(pickupModel(n.model).grid, MODEL_SCALE, true, "pickup"),
      );
      mesh.position.y = 0.05;
      g.add(mesh);
      const glow = new VirtualLight(
        n.author === "jade" ? "#FFB800" : n.author === "damien" ? "#00ffff" : "#33ff33",
        6,
        5,
        2,
      );
      glow.position.y = 1;
      g.add(glow);
      place(g, n.x, n.z);
      view.notes.set(n.id, g);
      view.interactables.push({
        target: { kind: "note", id: n.id },
        x: n.x,
        z: n.z,
        radius: 0.8,
        object: g,
        active: true,
      });
    }
    for (const d of DOORS) {
      if (d.floor !== floor || (!d.lock && !d.keypad && !d.secret)) continue;
      const marker = new THREE.Object3D();
      place(marker, d.x, d.z);
      view.interactables.push({
        target: { kind: "door", id: d.id },
        x: d.x,
        z: d.z,
        radius: 2.5,
        object: marker,
        active: !d.secret,
        ...(d.secret ? { secretDoor: d } : {}),
      });
    }
    for (const npc of NPCS) {
      if (npc.floor !== floor || npc.id === "mcp") continue;
      const g = new THREE.Group();
      let rig: CharacterRig | undefined;
      let botRig: VisualRig | undefined;
      let botAwake = true;
      let botBody: THREE.Group | undefined;
      let botScreens: ScreenRef[] = [];
      if (npc.id === "damien") {
        rig = this.buildCharacter(damienRig(true));
        g.add(rig.root);
        const glow = new VirtualLight("#00ffff", 30, 10, 2);
        glow.position.y = 3;
        g.add(glow);
      } else {
        if (npc.id === "unstables") {
          // The _unstables are not a body: a column of drifting light at the rift.
          const pts = this.particles(npc.x - 2, npc.z - 2, 4, 4, 140, "#e8f4ff", 1.1, 0.8, 7);
          pts.position.set(-npc.x - 0.5, -1, -npc.z - 0.5);
          g.add(pts);
          const glow = new VirtualLight("#b8a8ff", 24, 12, 2);
          glow.position.y = 3;
          g.add(glow);
        } else {
          botAwake = !!this.getState().flags[`bot_${npc.id}_awake`];
          botBody = new THREE.Group();
          g.add(botBody);
          const built = this.buildBotBody(botBody, npc.id, floor, npc.x, npc.z, botAwake);
          botRig = built.rig;
          botScreens = built.screens;
        }
      }
      place(g, npc.x, npc.z);
      g.rotation.order = "YXZ"; // yaw first, then lean / tilt in the bot's own frame
      const seed = (npc.x * 0.37 + npc.z * 0.61) % (Math.PI * 2);
      const nv: NpcView = {
        id: npc.id,
        group: g,
        home: [npc.x, npc.z],
        wander: npc.wander,
        goal: [npc.x, npc.z],
        wait: 1,
        phase: 0,
        seed,
        blob: npc.id === "unstables" ? 0 : npc.id === "damien" ? 1.6 : 1.9,
      };
      if (rig) nv.rig = rig;
      if (botRig) {
        nv.visual = botRig;
        nv.awake = botAwake;
        if (botBody) nv.body = botBody;
        nv.bodyScreens = botScreens;
        const v = botVisual(npc.id, botAwake);
        const sc = v.scale ?? MODEL_SCALE;
        const [fw, fd] = v.footprint ?? [v.base.w, v.base.d];
        const half = (Math.max(fw, fd) * sc) / 2;
        nv.blob = THREE.MathUtils.clamp(half * 2.3, 1.4, 3.2);
        nv.brain = createBrain(npc.id, npc.x + 0.5, npc.z + 0.5, 0);
        nv.cfg = {
          homeX: npc.x + 0.5,
          homeZ: npc.z + 0.5,
          wander: npc.wander,
          stations: [],
          radius: THREE.MathUtils.clamp(half * 0.8, 0.5, 1),
          speed: 3.2,
        };
      }
      const it: Interactable = {
        target: { kind: "npc", id: npc.id },
        x: npc.x,
        z: npc.z,
        radius: 1.5,
        object: g,
        active: true,
      };
      nv.it = it;
      view.npcs.set(npc.id, nv);
      view.interactables.push(it);
    }
    // The MCP's avatar: a hologram eye projector beside MCP-000 (decorative,
    // not solid — placed on free floor in sync, once collision is known).
    const mcpDev = DEVICES.find((d) => d.id === "MCP-000");
    if (mcpDev && ROOMS.find((r) => r.id === mcpDev.room)?.floor === floor) {
      const visual = mcpAvatarVisual();
      const g = new THREE.Group();
      const family = familyFor(visual, "device");
      g.add(this.meshModel(visual.base.grid, visual.scale ?? MODEL_SCALE, true, family));
      const rig = this.buildVisualRig(visual, g, true, undefined, family);
      // A hologram projector: no shadow-pass draw calls.
      g.traverse((o) => {
        o.castShadow = false;
      });
      g.visible = false;
      group.add(g);
      view.mcpAvatar = { group: g, rig, placed: false };
    }
    for (const r of ROOMS) {
      if (r.floor !== floor) continue;
      const light = new THREE.PointLight("#ffe2b8", 0, Math.max(r.w, r.d) * 1.1, 1.3);
      light.position.set(r.x + r.w / 2, WALL_HEIGHT + 6, r.z + r.d / 2);
      group.add(light);
      view.roomLights.set(r.id, light);
      if (r.smoky) {
        const pts = this.particles(
          r.x + 1,
          r.z + 1,
          r.w - 2,
          r.d - 2,
          420,
          "#8a8f98",
          2.6,
          0.22,
          WALL_HEIGHT,
        );
        group.add(pts);
        view.smoke.set(r.id, pts);
      }
      if (r.id === "anomalie") {
        view.anomaly = this.particles(
          r.x + 2,
          r.z + 2,
          r.w - 4,
          r.d - 4,
          160,
          "#b060ff",
          1.2,
          0.7,
          WALL_HEIGHT,
        );
        group.add(view.anomaly);
      }
      if (r.id === "forge") {
        // The opened rift: a thin shimmering membrane inside the forge's ring
        // gate (gate plane faces +z, centre ≈ 4.5 units above the deck, inner
        // radius ≈ 2.4). Kept below the bloom threshold so the gate's plates
        // and runes stay readable.
        const rift = new THREE.Mesh(
          new THREE.CircleGeometry(2.3, 40),
          new THREE.MeshBasicMaterial({
            color: "#9fd4ff",
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        rift.position.set(64.5, 5.5, 62.5);
        group.add(rift);
        view.rift = rift;
      }
    }
    group.visible = false;
    return view;
  }

  /**
   * Mesh a visual's animated parts and lights into `group`. With `shareKey`
   * (the same visual placed many times, e.g. decor), part geometry is shared
   * and drawn through the floor's auto-instancer.
   */
  private buildVisualRig(
    visual: DeviceVisual,
    group: THREE.Group,
    powered: boolean,
    shareKey?: string,
    family: RefineFamily = "device",
  ): VisualRig {
    const sc = visual.scale ?? MODEL_SCALE;
    const b = visual.base;
    const radius = (Math.hypot(b.w, b.d, visual.height ?? b.h) * sc) / 2 + 1;
    const rig: VisualRig = { parts: [], lights: [], powered, scale: sc, host: group, radius };
    const byName = new Map<string, PartView>();
    for (const part of visual.parts) {
      const grid = part.requiresPower ? stagedGrid(part.model.grid, 1, powered) : part.model.grid;
      const glows = part.kind === "pulse" || part.kind === "flicker";
      const emit = glows
        ? new THREE.MeshBasicMaterial({
            vertexColors: true,
            color: new THREE.Color(EMIT_GAIN, EMIT_GAIN, EMIT_GAIN),
          })
        : undefined;
      const mesh =
        shareKey && !emit
          ? markInstanced(
              this.sharedMesh(
                `${shareKey}/${part.name}/${part.requiresPower && powered ? 1 : 0}`,
                grid,
                sc,
                false,
                family,
              ),
            )
          : this.meshModel(
              grid,
              sc,
              false,
              family,
              undefined,
              emit ? { ...this.materials, emit } : this.materials,
            );
      mesh.position.set(-part.pivot[0] * sc, -part.pivot[1] * sc, -part.pivot[2] * sc);
      const pivot = new THREE.Group();
      pivot.add(mesh);
      const parent = part.parent ? byName.get(part.parent) : undefined;
      let rest: THREE.Vector3;
      if (parent) {
        // Child offsets are in the parent's voxel frame (see anim.ts).
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
      const view: PartView = emit ? { part, pivot, rest, emit } : { part, pivot, rest };
      byName.set(part.name, view);
      rig.parts.push(view);
    }
    for (const def of visual.lights) {
      const light = new VirtualLight(def.color, lightIntensity(def, 0, powered), def.distance, 2);
      const lp = lightPosInBase(visual.base, def);
      light.position.set(lp[0] * sc, lp[1] * sc, lp[2] * sc);
      // Flickering rig lights stay pool candidates even while momentarily dark.
      light.userData.animated = powered;
      group.add(light);
      rig.lights.push({ def, light });
    }
    return rig;
  }

  private animateRig(rig: VisualRig, t: number): void {
    const sc = rig.scale;
    const r = rig.ramp;
    for (const pv of rig.parts) {
      const st =
        r && pv.part.requiresPower
          ? rampedTransform(pv.part, r.clock, r.speed, r.glow)
          : animTransform(pv.part, t, rig.powered);
      pv.pivot.rotation.set(st.rot[0], st.rot[1], st.rot[2]);
      pv.pivot.position.set(
        pv.rest.x + st.pos[0] * sc,
        pv.rest.y + st.pos[1] * sc,
        pv.rest.z + st.pos[2] * sc,
      );
      pv.pivot.visible = st.visible;
      if (pv.emit) {
        const g = EMIT_GAIN * Math.max(0.15, st.intensity);
        pv.emit.color.setRGB(g, g, g);
      }
    }
    this.animateRigLights(rig, t);
  }

  /** Rig light strengths (also kept right for culled rigs — they still light the view). */
  private animateRigLights(rig: VisualRig, t: number): void {
    const r = rig.ramp;
    for (const lv of rig.lights)
      lv.light.intensity =
        r && lv.def.requiresPower
          ? lightIntensity(lv.def, r.clock, true) * r.glow
          : lightIntensity(lv.def, t, rig.powered);
  }

  /** Volumetric-looking light cones leaning from each wall lamp into its room. */
  private buildLightShafts(view: FloorView): void {
    const geo = new THREE.ConeGeometry(2.4, 6.2, 18, 1, true);
    geo.translate(0, -3.1, 0); // apex at the lamp
    for (const r of ROOMS) {
      if (r.floor !== view.floor) continue;
      const lamps = view.layout.lamps.filter((l) => l.room === r.id);
      if (!lamps.length) continue;
      const mat = new THREE.ShaderMaterial({
        uniforms: { uAlpha: { value: 0 }, uColor: { value: new THREE.Color("#ffe2b0") } },
        vertexShader: /* glsl */ `
          varying float vY;
          void main() {
            vY = uv.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAlpha;
          uniform vec3 uColor;
          varying float vY;
          void main() {
            float a = pow(vY, 1.6) * 0.22 * uAlpha;
            gl_FragColor = vec4(uColor * a, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      view.shafts.set(r.id, mat);
      // All cones of a room share the material: bake them into one mesh (one draw).
      const g = new THREE.Object3D();
      const cones: THREE.BufferGeometry[] = [];
      for (const l of lamps) {
        g.position.set(l.x + 0.5, l.y + 0.3, l.z + 0.5);
        g.rotation.set(0, 0, 0);
        // Lean into the room, away from the wall the lamp hangs on.
        const tilt = 0.42;
        if (l.z <= r.z + 1) g.rotation.x = tilt;
        else if (l.z >= r.z + r.d - 1) g.rotation.x = -tilt;
        else if (l.x <= r.x + 1) g.rotation.z = -tilt;
        else g.rotation.z = tilt;
        g.updateMatrix();
        cones.push(geo.clone().applyMatrix4(g.matrix));
      }
      const merged = mergeGeometries(cones);
      for (const c of cones) c.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.renderOrder = 5;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      view.group.add(mesh);
    }
    geo.dispose();
  }

  /**
   * Set dressing: every decor placement is baked into the floor's static
   * tile batch (a handful of draws for the whole floor; only solid pieces
   * cast shadows, as before), plus screens, lights and interactables.
   */
  private buildInterior(view: FloorView): void {
    const geoByDecor = new Map<string, THREE.BufferGeometry | null>();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    for (const p of interiorFor(view.floor)) {
      let geo = geoByDecor.get(p.decor);
      if (geo === undefined) {
        const grid = decorModel(p.decor).grid;
        const data = refinedModelMesh(grid, decorFamily(decorScale(p.decor)), { center: true });
        // CPU-only source for merging (never uploaded itself).
        geo = data.quads === 0 ? null : toGeometry(data);
        geoByDecor.set(p.decor, geo);
      }
      if (!geo) continue;
      const def = DECOR_BY_ID.get(p.decor);
      const ds = def?.scale ?? MODEL_SCALE;
      scale.set(ds, ds, ds);
      q.setFromAxisAngle(up, (p.rot * Math.PI) / 2);
      pos.set(p.x + 0.5, 1 + decorElevation(p), p.z + 0.5);
      view.batch.addFixed(
        {
          geometry: geo,
          matrix: new THREE.Matrix4().compose(pos, q, scale),
          castShadow: def?.solid ?? false,
        },
        pos.x,
        pos.z,
      );
    }
    for (const p of interiorFor(view.floor)) {
      const def = DECOR_BY_ID.get(p.decor);
      if (!def?.screens?.length) continue;
      const m = decorModel(p.decor);
      const ds = def.scale ?? MODEL_SCALE;
      for (const sp of def.screens) {
        const ref = this.screens.attach(
          view.group,
          sp,
          { w: m.w, d: m.d },
          ds,
          { roomId: p.room },
          {
            powered: false,
            anchor: {
              x: p.x + 0.5,
              y: 1 + decorElevation(p),
              z: p.z + 0.5,
              rotY: (p.rot * Math.PI) / 2,
            },
          },
        );
        if (ref >= 0) view.decorScreens.push({ room: p.room, ref });
      }
    }
    // Furniture with actions (coffee machine, radio, whiteboards, …).
    for (const p of interiorFor(view.floor)) {
      if (!hasDecorAction(p.decor, p.room)) continue;
      const { x, z, radius } = decorInteractPoint(p);
      const marker = new THREE.Object3D();
      marker.position.set(x + 0.5, 1 + decorElevation(p), z + 0.5);
      view.group.add(marker);
      this.decorById.set(p.id, p);
      view.interactables.push({
        target: { kind: "decor", id: p.id },
        x,
        z,
        radius,
        object: marker,
        active: true,
      });
    }
    for (const p of animatedDecor(view.floor)) {
      const visual = decorVisual(p.decor);
      if (!visual) continue;
      const g = new THREE.Group();
      g.position.set(p.x + 0.5, 1 + decorElevation(p), p.z + 0.5);
      g.rotation.y = (p.rot * Math.PI) / 2;
      view.group.add(g);
      view.decorRigs.push({
        room: p.room,
        rig: this.buildVisualRig(
          { ...visual, lights: [] },
          g,
          false,
          `rig:${p.decor}`,
          decorFamily(visual.scale ?? decorScale(p.decor)),
        ),
      });
    }
    for (const t of ROOM_TERMINALS) {
      if (t.floor !== view.floor) continue;
      const g = new THREE.Group();
      g.add(
        markStatic(this.meshModel(roomTerminalModel().grid, ROOM_TERMINAL_SCALE, true, "device")),
      );
      g.position.set(t.x + 0.5, 1, t.z + 0.5);
      g.rotation.y = ((t.rot ?? 0) * Math.PI) / 2;
      view.group.add(g);
      const ref = this.screens.attach(
        g,
        roomTerminalScreen(t),
        { w: ROOM_TERMINAL_SIZE.w, d: ROOM_TERMINAL_SIZE.d },
        ROOM_TERMINAL_SCALE,
        { roomId: t.room },
        { powered: false },
      );
      view.terminals.push({ id: t.id, ref });
      const glow = new VirtualLight("#33ff33", 3, 5, 2);
      glow.position.set(0, 2.5, 1.2);
      g.add(glow);
      view.interactables.push({
        target: { kind: "terminal", id: t.id },
        x: t.x,
        z: t.z,
        radius: 1.5,
        object: g,
        active: true,
      });
    }
    for (const l of decorLights(view.floor)) {
      const light = new VirtualLight(l.color, 0, l.distance, 2);
      light.position.set(l.x, l.y, l.z);
      view.group.add(light);
      view.decorLights.push({
        room: l.room,
        light,
        base: l.intensity,
        requiresPower: l.requiresPower,
      });
    }
  }

  private particles(
    x: number,
    z: number,
    w: number,
    d: number,
    n: number,
    color: string,
    size: number,
    opacity: number,
    h: number,
  ): THREE.Points {
    n = Math.max(8, Math.round(n * this.settings.graphics.particles));
    const pos = new Float32Array(n * 3);
    let seed = (x * 73856093) ^ (z * 19349663);
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x + rnd() * w;
      pos[i * 3 + 1] = 1 + rnd() * h;
      pos[i * 3 + 2] = z + rnd() * d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    pts.userData.base = pos.slice();
    return pts;
  }

  // ── Click-to-move ─────────────────────────────────────────────

  /** Nav grid of a floor: built on first use, patched after collision changes; locked doors as the dynamic layer. */
  private navFor(v: FloorView): NavGrid {
    const blocked = columnBlocked(
      (x, y, z) => !!v.collision.get(x, y, z) || this.elevators.solidAt(v.floor, x, y, z),
    );
    if (!v.nav)
      v.nav = createNavGrid(FLOOR_SIZE.x, FLOOR_SIZE.z, blocked, { half: WALKER.width / 2 });
    else if (v.navDirty) updateNavGrid(v.nav, blocked);
    v.navDirty = false;
    // Closed-for-good doors: locked, keypad not solved, secret not revealed.
    // Unlocked doors stay free — they slide open as Lawrence walks up.
    const cells: XZ[] = [];
    for (const d of DOORS)
      if (d.floor === v.floor && v.doors.lockedAt(d.x, d.z))
        for (const c of doorCells(d)) cells.push([c.x, c.z]);
    setDynamicBlocked(v.nav, cells);
    return v.nav;
  }

  /** Clear click-to-move (target, waypoints, replan state, dots). */
  private stopWalk(): void {
    this.walkTo = null;
    this.walkStuck = 0;
    this.route = [];
    this.routeGoal = null;
    this.replanned = false;
  }

  /**
   * Plan a path to world point `to` (A* on the nav grid, doors respected)
   * and start following it. `accept` ends the path early (e.g. in reach of
   * an interactable). Unreachable → walk to the closest point and report.
   */
  private planWalk(to: XZ, accept?: (x: number, z: number) => boolean, replan = false): void {
    const v = this.active;
    const nav = this.navFor(v);
    const [px, , pz] = this.walker.position;
    const from: XZ = [px, pz];
    const res = findPath(nav, from, to, { accept });
    this.walkStuck = 0;
    if (!replan) this.replanned = false;
    this.routeGoal = { to, accept };
    if (res.noStart || !res.points.length) {
      // Wedged somewhere the grid does not know: fall back to a straight line.
      this.route = [];
      this.walkTo = new THREE.Vector3(to[0], 1, to[1]);
      return;
    }
    const pts = res.points.slice();
    // Skip the snapped start node if she can head for the next point directly.
    if (pts.length > 1 && lineClear(nav, px, pz, pts[1]![0], pts[1]![1])) pts.shift();
    if (res.reached && !accept) {
      // End exactly on the clicked spot when it is walkable from the last node.
      const last = pts[pts.length - 1]!;
      if (isFreeAt(nav, to[0], to[1]) && lineClear(nav, last[0], last[1], to[0], to[1]))
        pts[pts.length - 1] = [to[0], to[1]];
    }
    if (!res.reached && !replan) {
      const goalWalkable = !!accept || isFreeAt(nav, to[0], to[1], true);
      if (goalWalkable) {
        const viaLock = findPath(nav, from, to, { accept, ignoreDynamic: true }).reached;
        this.cb.onPathBlocked?.(viaLock ? "locked" : "unreachable");
      }
    }
    const first = pts.shift()!;
    this.route = pts;
    this.walkTo = new THREE.Vector3(first[0], 1, first[1]);
    this.pathDotsAlpha = Math.max(this.pathDotsAlpha, 0.01);
    this.placePathDots();
  }

  /** Click-to-move from outside the 3D view (e.g. the map's "Go there"). */
  goTo(x: number, z: number): void {
    if (!this.inputEnabled) return;
    this.planWalk([x + 0.5, z + 0.5]);
  }

  /** Walk up to an interactable that is out of reach: stop in reach, on its side of the walls. */
  private walkToInteractable(it: Interactable): void {
    const v = this.active;
    const gx = it.x + 0.5;
    const gz = it.z + 0.5;
    const reach = Math.max(1.5, REACH + it.radius - 1.2);
    const room = this.roomIdAt(v, gx, gz);
    const nav = this.navFor(v);
    this.planWalk([gx, gz], (x, z) => {
      if (Math.hypot(x - gx, z - gz) > reach) return false;
      if (room !== undefined && this.roomIdAt(v, x, z) === room) return true;
      return rayClear(nav, x, z, gx, gz, it.radius + 0.5);
    });
  }

  /** A door near Lawrence is unlocked but still sliding open (she waits instead of giving up). */
  private waitingForDoor(v: FloorView, x: number, z: number): boolean {
    for (const d of DOORS) {
      if (d.floor !== v.floor || Math.hypot(d.x + 0.5 - x, d.z + 0.5 - z) > DOOR_OPEN_RADIUS + 1)
        continue;
      if (!v.doors.lockedAt(d.x, d.z) && !v.doors.isPassable(d.id)) return true;
    }
    return false;
  }

  /** Put the dots on the remaining waypoints (last one = target disc). */
  private placePathDots(): void {
    const m = this.tmpM;
    const pts: XZ[] = [];
    if (this.walkTo) pts.push([this.walkTo.x, this.walkTo.z]);
    pts.push(...this.route);
    const [px, , pz] = this.walker.position;
    let n = 0;
    // Small dots every ~1.6 units along the remaining polyline, then the target disc.
    let ax = px;
    let az = pz;
    let carry = 0.8;
    for (const [bx, bz] of pts) {
      const len = Math.hypot(bx - ax, bz - az);
      let t = carry;
      while (t < len && n < PATH_DOTS_MAX - 1) {
        m.makeScale(0.32, 1, 0.32).setPosition(
          ax + ((bx - ax) * t) / len,
          1.06,
          az + ((bz - az) * t) / len,
        );
        this.pathDots.setMatrixAt(n++, m);
        t += 1.6;
      }
      carry = t - len;
      ax = bx;
      az = bz;
    }
    const end = pts[pts.length - 1];
    if (end) {
      m.makeScale(1.1, 1, 1.1).setPosition(end[0], 1.05, end[1]);
      this.pathDots.setMatrixAt(n++, m);
    }
    this.pathDots.count = n;
    this.pathDots.instanceMatrix.needsUpdate = true;
  }

  /** Fade the dots in while a path is walked, out once it ends. */
  private fadePathDots(dt: number): void {
    const want = this.walkTo && this.routeGoal ? 0.55 : 0;
    if (want === 0 && this.pathDotsAlpha === 0) return;
    this.pathDotsAlpha = approach(this.pathDotsAlpha, want, dt, 6);
    if (want === 0 && this.pathDotsAlpha < 0.02) this.pathDotsAlpha = 0;
    (this.pathDots.material as THREE.MeshBasicMaterial).opacity = this.pathDotsAlpha;
    this.pathDots.visible = this.pathDotsAlpha > 0 && this.pathDots.count > 0;
  }

  private rebuildCollision(v: FloorView): void {
    const s = this.getState();
    v.collision.clearFootprints();
    for (const dv of v.devices.values()) {
      if (stagesDone(s, dv.id) === 0) continue;
      const [x0, z0, x1, z1, h] = dv.footprint;
      v.collision.addFootprint(x0 + 0.3, z0 + 0.3, x1 - 0.3, z1 - 0.3, h);
    }
    for (const p of PROPS) {
      if (p.floor !== v.floor || p.model === "elevator") continue;
      const m = propGrid(p);
      const rot = (p.rot ?? 0) % 2 === 1;
      const hw = ((rot ? m.d : m.w) * MODEL_SCALE) / 2;
      const hd = ((rot ? m.w : m.d) * MODEL_SCALE) / 2;
      v.collision.addFootprint(
        p.x + 0.8 - hw,
        p.z + 0.8 - hd,
        p.x + 0.2 + hw,
        p.z + 0.2 + hd,
        m.h * MODEL_SCALE,
      );
    }
    for (const f of decorFootprints(v.floor)) v.collision.addFootprint(f.x0, f.z0, f.x1, f.z1, f.h);
    for (const t of ROOM_TERMINALS) {
      if (t.floor !== v.floor) continue;
      const odd = (t.rot ?? 0) % 2 === 1;
      const hw = ((odd ? ROOM_TERMINAL_SIZE.d : ROOM_TERMINAL_SIZE.w) * ROOM_TERMINAL_SCALE) / 2;
      const hd = ((odd ? ROOM_TERMINAL_SIZE.w : ROOM_TERMINAL_SIZE.d) * ROOM_TERMINAL_SCALE) / 2;
      v.collision.addFootprint(
        t.x + 0.8 - hw,
        t.z + 0.8 - hd,
        t.x + 0.2 + hw,
        t.z + 0.2 + hd,
        ROOM_TERMINAL_SIZE.h * ROOM_TERMINAL_SCALE,
      );
    }
  }

  // ── Input ─────────────────────────────────────────────────────

  private bindInput(): void {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!this.inputEnabled || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))) return;
      this.keys.add(e.code);
      const action = actionForCode(e.code, this.settings.controls);
      if (action === "interact") {
        if (this.focus) {
          this.playGesture("interact");
          this.cb.onInteract(this.focus.target);
        }
        e.preventDefault();
      }
      if (action === "rotateLeft") this.rotate(-1);
      if (action === "rotateRight") this.rotate(1);
      if (e.code === "KeyV") this.cb.onWallMode?.(this.cycleWalls());
      if (action === "zoomIn") this.zoomBy(0.85);
      if (action === "zoomOut") this.zoomBy(1.18);
      if (e.code.startsWith("Arrow")) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => this.keys.clear();
    const wheel = (e: WheelEvent) => {
      if (!this.inputEnabled) return;
      e.preventDefault();
      this.zoomBy(1 + e.deltaY * 0.001);
    };
    const click = (e: PointerEvent) => {
      if (!this.inputEnabled || e.button !== 0) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      // Clicked an interactable in reach? Interact. Otherwise walk there.
      const objects = this.active.interactables.filter((i) => i.active).map((i) => i.object);
      const hits = this.raycaster.intersectObjects(objects, true);
      if (hits[0]) {
        const it = this.active.interactables.find((i) => isAncestor(i.object, hits[0]!.object));
        if (it) {
          const [px, , pz] = this.walker.position;
          if (Math.hypot(it.x + 0.5 - px, it.z + 0.5 - pz) <= REACH + it.radius) {
            this.playGesture("interact");
            this.cb.onInteract(it.target);
            return;
          }
          this.walkToInteractable(it);
          return;
        }
      }
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
      const p = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, p)) this.planWalk([p.x, p.z]);
    };
    const resize = () => this.resize();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", resize);
    this.renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    this.renderer.domElement.addEventListener("pointerdown", click);
    this.cleanup.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", resize);
      this.renderer.domElement.removeEventListener("wheel", wheel);
      this.renderer.domElement.removeEventListener("pointerdown", click);
    });
  }

  private resize(): void {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
  }

  // ── Frame ─────────────────────────────────────────────────────

  private frame(now: number): void {
    if (this.disposed) return;
    const interval = frameIntervalMs(this.settings.graphics);
    if (interval > 0 && now - this.lastRender < interval - 0.5) return;
    if (this.lastRender)
      this.fps = this.fps * 0.9 + (1000 / Math.max(1, now - this.lastRender)) * 0.1;
    this.lastRender = now;
    const cpu0 = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.25);
    this.last = now;
    this.time += dt;
    this.acc += dt;

    // Movement input relative to camera yaw.
    let f = 0;
    let r = 0;
    if (this.inputEnabled) {
      const c = this.settings.controls;
      f =
        (actionHeld(this.keys, "moveUp", c) ? 1 : 0) -
        (actionHeld(this.keys, "moveDown", c) ? 1 : 0);
      r =
        (actionHeld(this.keys, "moveRight", c) ? 1 : 0) -
        (actionHeld(this.keys, "moveLeft", c) ? 1 : 0);
    }
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    let mx = fx * f - fz * r;
    let mz = fz * f + fx * r;
    // Any movement key cancels click-to-move at once.
    if (f || r) {
      if (this.walkTo) this.stopWalk();
    } else if (this.walkTo) {
      const [px, , pz] = this.walker.position;
      let dx = this.walkTo.x - px;
      let dz = this.walkTo.z - pz;
      let dist = Math.hypot(dx, dz);
      // Next waypoint once this one is (nearly) reached.
      while (this.route.length && dist < 0.5) {
        const [nx, nz] = this.route.shift()!;
        this.walkTo.set(nx, 1, nz);
        dx = nx - px;
        dz = nz - pz;
        dist = Math.hypot(dx, dz);
        this.placePathDots();
      }
      if (dist < 0.6 && !this.route.length) this.stopWalk();
      else {
        mx = dx / dist;
        mz = dz / dist;
      }
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const gs = this.getState();
    // Buffs (coffee …) × the gentle biorhythm factor (0.92 low · 1.06 balanced · else 1).
    const walkBoost =
      buffMultiplier(gs, gs.playTime, "walk_speed") *
      bioWalkMultiplier(gs, this.settings.gameplay.biorhythm);
    this.active.doors.update(dt, this.walker.position);
    this.elevators.update(dt);
    const STEP = 1 / 60;
    const before = this.walker.position;
    while (this.acc >= STEP) {
      this.walker.update(this.active.collider, [mx * walkBoost, mz * walkBoost], STEP);
      this.acc -= STEP;
    }
    const after = this.walker.position;
    if (this.walkTo) {
      const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
      // Pressing against a door that is still sliding open is not "stuck".
      const waiting = moved < 0.01 && this.waitingForDoor(this.active, after[0], after[2]);
      this.walkStuck = moved < 0.01 && !waiting ? this.walkStuck + dt : 0;
      if (this.walkStuck > 0.5) {
        const goal = this.routeGoal;
        if (goal && !this.replanned) {
          // Something moved into the way (bot, door): plan once more, then give up.
          this.planWalk(goal.to, goal.accept, true);
          this.replanned = true;
        } else this.stopWalk();
      }
    }
    this.fadePathDots(dt);
    if (after[1] < -10) this.walker.teleport([ELEVATORS[0]!.x - 6, 2, ELEVATORS[0]!.z]);

    // Player rig + walk cycle.
    const [px, py, pz] = after;
    const lift = this.elevators.riding ? this.elevators.offset : 0;
    this.stepRide(dt, lift);
    this.player.root.position.set(px, py + lift, pz);
    this.player.root.rotation.y = this.walker.facing;
    // Pose: idle ↔ walk blend, interact gesture, talk/think/celebrate modes.
    const rawSpeed = dt > 0 ? Math.hypot(after[0] - before[0], after[2] - before[2]) / dt : 0;
    this.speedS = approach(this.speedS, this.walker.moving ? rawSpeed : 0, dt, 6);
    this.walkW = approach(this.walkW, this.walker.moving ? 1 : 0, dt, 8);
    this.idleFor = advanceIdle(this.idleFor, dt, this.walker.moving, this.walkW);
    if (this.walker.moving) {
      // Walking away ends a seated/drinking/reading pose.
      if (this.track.kind !== "idle" && this.walkW > 0.5 && !isPoseDone(this.track, this.time))
        this.track = switchPose(this.track, "idle", this.time);
    }
    this.gaitPhase = advanceGait(this.gaitPhase, dt, this.speedS);
    if (isPoseDone(this.track, this.time)) this.track = switchPose(this.track, "idle", this.time);
    this.stepLook(dt);
    this.chill = approach(
      this.chill,
      this.ride ? 0 : chillTarget(this.active.floor, this.idleFor, this.track.kind),
      dt,
      1.2,
    );
    this.applyPose(
      this.player,
      animateCharacter({
        track: this.track,
        now: this.time,
        gaitPhase: this.gaitPhase,
        speed: this.speedS,
        walkW: this.walkW,
        idleFor: this.idleFor,
        seed: 0,
        look: { yaw: this.lookYawS, weight: this.lookW },
        chill: this.chill,
        load: this.rideLoad,
        rattle: this.rideRattle,
      }),
    );
    const prop = activeProp(this.track, this.time);
    for (const [k, m] of this.handProps) m.visible = k === prop;
    this.syncXray();
    this.lantern.position.set(px, py + 5, pz);

    this.animateWorld(dt);
    this.fx.update(dt);
    const foot = this.steps.update(Math.hypot(after[0] - before[0], after[2] - before[2]));
    if (foot !== null) {
      const r = roomAt(this.active.floor, Math.floor(after[0]), Math.floor(after[2]));
      const surface = surfaceForTheme(r?.theme);
      this.cb.onFootstep?.(after[0], after[2], surface);
      if (surface === "concrete" || surface === "tile") {
        this.fx.emit("footstep_dust", this.tmpV.set(after[0], 1.05, after[2]));
      }
    }
    this.updateFocus(false);

    // Room change + periodic position report.
    const room = roomAt(this.active.floor, Math.floor(px), Math.floor(pz));
    const id = room?.id ?? null;
    if (id !== this.room) {
      this.room = id;
      this.cb.onRoom(id);
    }
    this.moveReport += dt;
    if (this.moveReport > 1) {
      this.moveReport = 0;
      this.cb.onMove(this.active.floor, after);
    }

    // Camera — a running cinematic overrides the follow camera.
    const cine = this.director.update(dt);
    let zoom: number;
    if (cine?.controlsCamera) {
      this.target.set(cine.target[0], cine.target[1], cine.target[2]);
      this.yaw = cine.yaw;
      this.yawGoal = cine.yaw;
      // Hand the pose back smoothly once the cinematic lets go.
      this.zoomS = cine.zoom;
      for (const d of this.camDamp) d.v = 0;
      zoom = cine.zoom;
    } else {
      const instant = this.settings.accessibility.reduceMotion;
      this.yaw +=
        (this.yawGoal - this.yaw) *
        (instant ? 1 : Math.min(1, dt * 8 * this.settings.camera.rotateSpeed));
      // Critically damped follow (eases in and out, no lurch on room / floor
      // changes) with a gentle bias toward the current room's centre.
      const room = this.room ? this.roomById.get(this.room) : undefined;
      const off = roomFramingOffset(px, pz, instant ? undefined : room, this.framing);
      const smooth = 1 / followLerpRate(this.settings.camera);
      this.target.x = smoothDamp(this.camDamp[0], this.target.x, px + off[0], smooth, dt);
      this.target.y = smoothDamp(this.camDamp[1], this.target.y, py + 2 + lift, smooth * 0.5, dt);
      this.target.z = smoothDamp(this.camDamp[2], this.target.z, pz + off[1], smooth, dt);
      this.zoomS += (this.zoom - this.zoomS) * (instant ? 1 : 1 - Math.exp(-dt * 9));
      // Floor switch: start ~9 % wider and settle in.
      this.settleT += dt;
      const settle = instant ? 0 : 1 - smoothstep01(this.settleT / 1.2);
      zoom = this.zoomS * (1 + 0.09 * settle);
    }
    this.cinema.letterbox = cine?.letterbox ?? 0;
    this.cinema.fade = cine?.fade ?? 0;
    this.cinema.playing = this.director.isPlaying;
    this.crt.uniforms.uLetterbox.value = this.cinema.letterbox;
    this.crt.uniforms.uFade.value = this.cinema.fade;
    const [sx, sy] = this.settings.accessibility.reduceMotion ? [0, 0] : this.shake.update(dt);
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    const aspect = w / h;
    const halfH = zoom / 2;
    Object.assign(this.camera, {
      left: -halfH * aspect,
      right: halfH * aspect,
      top: halfH,
      bottom: -halfH,
    });
    const dir = this.tmpDir.set(
      Math.cos(ELEVATION) * Math.sin(this.yaw),
      Math.sin(ELEVATION),
      Math.cos(ELEVATION) * Math.cos(this.yaw),
    );
    const look = this.tmpV.set(
      this.target.x + sx * Math.cos(this.yaw),
      this.target.y + sy,
      this.target.z - sx * Math.sin(this.yaw),
    );
    this.camera.position.copy(look).addScaledVector(dir, 300);
    this.camera.lookAt(look);
    this.camera.updateProjectionMatrix();

    this.active.renderer.sync(4);
    this.updateLighting(dt);
    this.updateLightPool(dt);
    this.updateFlickers();
    this.updateMotes(dt);
    this.updateBrownout();
    this.updateBlobs(lift);
    const st = this.getState();
    this.screens.update(this.time, (src) => screenInfo(st, src.deviceId, src.roomId), this.camera);
    this.crt.uniforms.uTime.value = this.time;
    this.crt.uniforms.uAspect.value = aspect;
    // One world-matrix update per frame (auto-update is off), then refresh
    // the batches from it before anything is drawn.
    this.scene.updateMatrixWorld();
    const av = this.active;
    if (av.staticDirty) {
      av.staticDirty = false;
      av.batch.update();
    }
    av.instancer.update();
    this.renderer.info.reset();
    this.composer.render();
    const info = this.renderer.info;
    const stt = this.stats;
    stt.drawCalls = info.render.calls;
    stt.triangles = info.render.triangles;
    stt.geometries = info.memory.geometries;
    stt.textures = info.memory.textures;
    stt.programs = info.programs?.length ?? 0;
    stt.frameMs = performance.now() - cpu0;
    stt.particles = this.fx.particleCount;
    stt.ambientEmitters = this.fx.activeEmitters;
    stt.fps = this.fps;
    stt.staticTiles = av.batch.tileCount;
    stt.instanceSets = av.instancer.setCount;
    stt.instancedSources = av.instancer.sourceCount;
  }

  /**
   * Cheap counters for profiling (draw calls over all passes, CPU frame
   * time, culled rigs, light pool use…). Read it from the console, e.g.
   * `engine.debugStats()`; the object is reused, copy it to keep values.
   */
  debugStats(): Readonly<EngineStats> {
    return this.stats;
  }

  private updateFlickers(): void {
    for (const [room, until] of this.flickers) {
      const light = this.active.roomLights.get(room);
      const base = (light?.userData.base as number | undefined) ?? 0;
      if (!light) {
        this.flickers.delete(room);
        continue;
      }
      if (this.time >= until) {
        light.intensity = base;
        this.flickers.delete(room);
      } else light.intensity = base * (Math.sin(this.time * 47) > 0.2 ? 1 : 0.12);
      const shaft = this.active.shafts.get(room);
      if (shaft)
        shaft.uniforms.uAlpha!.value =
          this.time >= until ? (base > 0 ? 1 : 0) : light.intensity / Math.max(0.001, base);
    }
  }

  /**
   * Move the pooled PointLights onto the virtual lights nearest the camera
   * focus. The nearest set is re-selected ~8×/s from a cached per-floor list
   * (no scene traversal, no allocations); intensities, colours and positions
   * of the assigned lights are copied every frame so flicker stays smooth.
   */
  private updateLightPool(dt: number): void {
    const v = this.active;
    if (v.lightsDirty) {
      v.lights.length = 0;
      v.group.traverse((o) => {
        if (o instanceof VirtualLight) v.lights.push(o);
      });
      v.lightsDirty = false;
      this.poolReselect = 0;
    }
    this.stats.virtualLights = v.lights.length;
    this.poolReselect -= dt;
    if (this.poolReselect <= 0) {
      this.poolReselect = 0.12;
      const cands = this.lightCands;
      let n = 0;
      for (const l of v.lights) {
        const live = l.intensity > 0.01 || l.userData.animated === true;
        if (!live || !visibleIn(l, v.group)) continue;
        l.getWorldPosition(this.tmpV);
        const d = this.tmpV.distanceToSquared(this.target);
        const c = cands[n];
        if (c) {
          c.v = l;
          c.d = d;
        } else cands.push({ v: l, d });
        n++;
      }
      // Partial selection sort: only the pool size matters.
      const k = Math.min(n, LIGHT_POOL_SIZE);
      for (let a = 0; a < k; a++) {
        let m = a;
        for (let b = a + 1; b < n; b++) if (cands[b]!.d < cands[m]!.d) m = b;
        if (m !== a) {
          const tmp = cands[a]!;
          cands[a] = cands[m]!;
          cands[m] = tmp;
        }
        this.poolAssigned[a] = cands[a]!.v;
      }
      for (let a = k; a < LIGHT_POOL_SIZE; a++) this.poolAssigned[a] = null;
    }
    let lit = 0;
    for (let i = 0; i < this.lightPool.length; i++) {
      const l = this.lightPool[i]!;
      const c = this.poolAssigned[i];
      if (!c || c.intensity <= 0.01 || !visibleIn(c, v.group)) {
        l.intensity = 0;
        continue;
      }
      c.getWorldPosition(l.position);
      l.color.copy(c.color);
      l.intensity = c.intensity * POOL_GAIN;
      l.distance = c.distance;
      l.decay = c.decay;
      lit++;
    }
    this.stats.pooledLightsLit = lit;
  }

  /** Aim the shadow-casting key light at the current room; pulse emergency lights. */
  private updateLighting(dt: number): void {
    // power() hashes the build state on every call; sync() caches it after
    // each game action, and a slow refresh catches day-dependent output.
    this.powerAge += dt;
    if (!this.powerState || this.powerAge > 1) {
      this.powerState = power(this.getState());
      this.powerAge = 0;
    }
    const p = this.powerState;
    const powered = p.generation >= 50;
    const room = this.room ? this.roomById.get(this.room) : undefined;
    if (room && this.keyRoom !== room.id) {
      this.keyRoom = room.id;
      const cx = room.x + room.w / 2;
      const cz = room.z + room.d / 2;
      const height = 34;
      this.keyLight.position.set(cx + 3, height, cz + 5);
      this.keyLight.target.position.set(cx, 0, cz);
      this.keyLight.angle = Math.min(1.2, Math.atan((Math.max(room.w, room.d) * 0.62) / height));
      this.keyLight.shadow.camera.updateProjectionMatrix();
    }
    const lit = !!room && powered && (!room.litBy || p.online.has(room.litBy));
    const goal = lit ? (34 + Math.max(room!.w, room!.d) * 0.5) * this.moodKeyGain : 0;
    this.keyLight.intensity += (goal - this.keyLight.intensity) * Math.min(1, dt * 3);
    const [px, , pz] = this.walker.position;
    if (!powered) {
      // Rotating-beacon feel: slow pulse with a stutter.
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.2);
      const stutter =
        !this.settings.accessibility.reduceFlicker && Math.sin(this.time * 31) > 0.93 ? 0.3 : 1;
      this.emergency.intensity = (18 + pulse * 30) * stutter;
      this.emergency.position.set(
        room ? room.x + room.w / 2 : px,
        9,
        room ? room.z + room.d / 2 : pz,
      );
      this.lantern.intensity = 85;
    } else {
      this.emergency.intensity = 0;
      this.lantern.intensity = lit ? 8 : 55;
    }
    // Per-floor mood tint, cross-faded after a floor switch, times the red
    // emergency cast while the lab is dark.
    this.tint.lerp(this.tintGoal, 1 - Math.exp(-dt * 2.5));
    const tint = this.crt.uniforms.uTint.value.copy(this.tint);
    if (!powered) tint.multiply(this.tmpC.setRGB(1.05, 0.9, 0.9));
  }

  private syncXray(): void {
    this.xray.position.copy(this.player.root.position);
    this.xray.rotation.copy(this.player.root.rotation);
    for (const [src, dst] of this.xrayPairs) {
      dst.rotation.copy(src.rotation);
      dst.position.copy(src.position);
    }
  }

  private animateWorld(dt: number): void {
    const v = this.active;
    const t = this.time;
    // Frustum of the previous frame's camera (one frame of lag is invisible
    // for culling and saves recomputing after the camera update).
    this.projView.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    let animated = 0;
    let culled = 0;
    // Power ramps, pending wind-down rebuilds and build flourishes (cheap, all devices).
    for (const dv of v.devices.values()) this.stepDevice(v, dv, dt);
    this.stepPickupsAndNotes(v, dt);
    const run = (rig: VisualRig): void => {
      if (this.rigInView(rig)) {
        this.animateRig(rig, t);
        animated++;
      } else {
        // Off screen: keep the lights right (they still light the view), skip the parts.
        this.animateRigLights(rig, t);
        culled++;
      }
    };
    for (const dv of v.devices.values()) if (dv.rig && dv.group.visible) run(dv.rig);
    for (const dr of v.decorRigs) run(dr.rig);
    for (const npc of v.npcs.values()) if (npc.visual && npc.group.visible) run(npc.visual);
    if (v.mcpAvatar?.group.visible) run(v.mcpAvatar.rig);
    this.stats.rigsAnimated = animated;
    this.stats.rigsCulled = culled;
    for (const g of v.pickups.values()) {
      if (!g.visible || g.userData.leaving === true) continue;
      const inner = g.children[0];
      if (inner)
        inner.position.y = g.userData.dim ? 0 : Math.max(0, Math.sin(t * 2 + g.position.x) * 0.15);
    }
    for (const g of v.notes.values()) {
      const light = g.children[1];
      if (light instanceof VirtualLight)
        light.intensity =
          (4 + Math.sin(t * 3 + g.position.z) * 2) * ((g.userData.fold as number | undefined) ?? 1);
    }
    // Smoke / anomaly clouds: CPU-animated, so only on screen and at ≤30 Hz.
    this.smokeTick += dt;
    if (this.smokeTick >= 1 / 30) {
      this.smokeTick = 0;
      for (const pts of v.smoke.values()) this.driftPoints(pts, t, 0.8);
      if (v.anomaly) this.driftPoints(v.anomaly, t, 1.2);
    }
    if (v.rift?.visible) {
      v.rift.rotation.z += dt * 0.3;
      v.rift.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04);
      (v.rift.material as THREE.MeshBasicMaterial).opacity = 0.14 + Math.sin(t * 2) * 0.05;
    }
    this.animateNpcs(v, dt, t);
  }

  private driftPoints(pts: THREE.Points, t: number, amp: number): void {
    if (!pts.visible || !this.frustum.intersectsObject(pts)) return;
    const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const base = pts.userData.base as Float32Array;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      arr[i * 3] = base[i * 3]! + Math.cos(t * 0.3 + i * 1.7) * amp;
      arr[i * 3 + 1] = base[i * 3 + 1]! + Math.sin(t * 0.7 + i) * amp;
    }
    pos.needsUpdate = true;
  }

  private rigInView(rig: VisualRig): boolean {
    const e = rig.host.matrixWorld.elements;
    this.sphere.center.set(e[12]!, e[13]!, e[14]!);
    this.sphere.radius = rig.radius;
    return this.frustum.intersectsSphere(this.sphere);
  }

  private readonly npcWorld: NpcWorld = {
    blocked: (x, z) => this.walkBlocked(this.active, x, z),
    playerX: 0,
    playerZ: 0,
    others: this.npcOthers,
  };

  /** Bots think, walk, work and watch; Damien's echo talks; the MCP eye follows Lawrence. */
  private animateNpcs(v: FloorView, dt: number, t: number): void {
    const [px, , pz] = this.walker.position;
    const others = this.npcOthers;
    others.length = 0;
    for (const o of v.npcs.values())
      if (o.brain && o.group.visible) others.push(o.brain.x, o.brain.z);
    const world = this.npcWorld;
    world.playerX = px;
    world.playerZ = pz;
    const motion = this.settings.accessibility.reduceMotion ? 0.4 : 1;
    let active = 0;
    for (const npc of v.npcs.values()) {
      if (!npc.group.visible) continue;
      active++;
      const g = npc.group;
      if (npc.rig) {
        // Damien's echo flickers in place and turns toward Lawrence.
        const near = Math.hypot(g.position.x - px, g.position.z - pz) < 7;
        g.rotation.y = turnToward(
          g.rotation.y,
          Math.atan2(px - g.position.x, pz - g.position.z),
          dt,
          4,
          3,
        );
        // Flicker the body only — hiding the group would stop this loop from
        // ever showing it again until the next sync.
        npc.rig.root.visible =
          this.settings.accessibility.reduceFlicker || Math.sin(t * 17) > -0.92;
        let track = npc.track ?? poseTrack("think", t);
        if (near && !npc.wasNear) {
          track = switchPose(track, "wave", t);
          npc.nearSince = t;
        } else if (near && track.kind === "wave" && t - (npc.nearSince ?? t) > 1.5) {
          track = switchPose(track, "talk", t);
        } else if (!near && npc.wasNear) {
          track = switchPose(track, "think", t);
        }
        npc.track = track;
        npc.wasNear = near;
        this.applyPose(
          npc.rig,
          animateCharacter({
            track,
            now: t,
            gaitPhase: 0,
            speed: 0,
            walkW: 0,
            idleFor: t,
            seed: 7,
          }),
        );
        continue;
      }
      const b = npc.brain;
      const cfg = npc.cfg;
      if (!b || !cfg) {
        // The _unstables: a column of light that breathes slowly.
        g.position.y = 1 + Math.sin(t * 0.8 + npc.seed) * 0.3 * motion;
        continue;
      }
      if (npc.awake === false) {
        // Dormant: slumped in place, a slight forward lean, no wandering.
        g.rotation.x = 0.1;
        continue;
      }
      stepBrain(b, cfg, world, dt);
      const k = Math.min(1, b.speed / cfg.speed);
      npc.phase += b.speed * dt * 2.2;
      const s = npc.seed;
      const hop = Math.abs(Math.sin(npc.phase)) * 0.14 * k;
      const breathe = Math.sin(t * 1.7 + s) * 0.025 * (1 - k);
      const tap = Math.abs(Math.sin(t * 5.2 + s)) * 0.05 * b.workW;
      const lean = 0.07 * k + b.workW * (0.1 + Math.sin(t * 2.4 + s) * 0.035);
      const scan = b.workW * Math.sin(t * 0.9 + s) * 0.2;
      const tilt = b.watchW * Math.sin(t * 0.8 + s) * 0.09 + Math.sin(npc.phase) * 0.04 * k;
      g.position.set(b.x, 1 + (hop + breathe + tap) * motion, b.z);
      g.rotation.set(lean * motion, b.yaw + scan * motion, tilt * motion);
      if (npc.it) {
        npc.it.x = b.x - 0.5;
        npc.it.z = b.z - 0.5;
      }
    }
    this.stats.npcsActive = active;
    const av = v.mcpAvatar;
    if (av?.group.visible && av.placed) {
      const g = av.group;
      const dx = px - g.position.x;
      const dz = pz - g.position.z;
      const goal =
        Math.hypot(dx, dz) < 16
          ? Math.atan2(dx, dz)
          : (g.userData.yaw0 as number) + Math.sin(t * 0.25) * 0.8;
      g.rotation.y = turnToward(g.rotation.y, goal, dt, 2.5, 1.6);
    }
  }

  /** Floor cell at (x, z) is not walkable for a bot (wall, solid, hole, outside). */
  private walkBlocked(v: FloorView, x: number, z: number): boolean {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= FLOOR_SIZE.x || cz >= FLOOR_SIZE.z) return true;
    const c = v.collider;
    return !c.get(cx, 0, cz) || !!c.get(cx, 1, cz) || !!c.get(cx, 2, cz);
  }

  /** Room index + 1 per floor cell (0 = corridor/none), built lazily. */
  private roomIdAt(v: FloorView, x: number, z: number): string | undefined {
    if (!v.roomGrid) {
      const grid = new Int16Array(FLOOR_SIZE.x * FLOOR_SIZE.z);
      ROOMS.forEach((r, i) => {
        if (r.floor !== v.floor) return;
        for (let zz = Math.max(0, r.z); zz < Math.min(FLOOR_SIZE.z, r.z + r.d); zz++)
          for (let xx = Math.max(0, r.x); xx < Math.min(FLOOR_SIZE.x, r.x + r.w); xx++)
            grid[xx + zz * FLOOR_SIZE.x] = i + 1;
      });
      v.roomGrid = grid;
    }
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= FLOOR_SIZE.x || cz >= FLOOR_SIZE.z) return undefined;
    const i = v.roomGrid[cx + cz * FLOOR_SIZE.x]!;
    return i ? ROOMS[i - 1]!.id : undefined;
  }

  /**
   * Work stations for bots: built devices, room kiosks, furniture with
   * actions and interactive props, each with a free stand point in the same
   * room. Recomputed after collision changes (sync).
   */
  private updateStations(v: FloorView, s: WorldState): void {
    v.stations.length = 0;
    for (const it of v.interactables) {
      const kind = it.target.kind;
      if (kind !== "device" && kind !== "terminal" && kind !== "decor" && kind !== "prop") continue;
      if (kind === "device" && stagesDone(s, it.target.id) === 0) continue;
      const cx = it.x + 0.5;
      const cz = it.z + 0.5;
      const room = this.roomIdAt(v, cx, cz);
      if (!room) continue;
      const spot = findFreeSpot(
        (x, z) => this.walkBlocked(v, x, z) || this.roomIdAt(v, x, z) !== room,
        cx,
        cz,
        Math.max(1, it.radius) + 1.4,
        0.8,
      );
      if (spot) v.stations.push({ x: cx, z: cz, sx: spot.x, sz: spot.z });
    }
    for (const npc of v.npcs.values()) {
      if (!npc.cfg) continue;
      const reach = npc.cfg.wander + 6;
      npc.cfg.stations = v.stations.filter(
        (st) => Math.hypot(st.sx - npc.cfg!.homeX, st.sz - npc.cfg!.homeZ) <= reach,
      );
    }
  }

  /** Show / place the MCP's eye projector next to MCP-000 on free floor. */
  private syncAvatar(v: FloorView, s: WorldState, p: PowerStatus): void {
    const av = v.mcpAvatar;
    const dv = v.devices.get("MCP-000");
    if (!av || !dv) return;
    av.rig.powered = p.online.has("MCP-000") || stagesDone(s, "MCP-000") > 0;
    const [x0, z0, x1, z1] = dv.footprint;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const room = this.roomIdAt(v, cx, cz);
    const blocked = (x: number, z: number): boolean =>
      this.walkBlocked(v, x, z) ||
      this.roomIdAt(v, x, z) !== room ||
      // Keep doorways and interaction spots clear.
      DOORS.some((d) => d.floor === v.floor && Math.abs(d.x - x) < 3 && Math.abs(d.z - z) < 3) ||
      v.interactables.some(
        (it) =>
          it.target.kind !== "device" &&
          Math.abs(it.x + 0.5 - x) < 1.5 &&
          Math.abs(it.z + 0.5 - z) < 1.5,
      );
    const r = 1.2;
    if (av.placed) {
      const g = av.group;
      const still =
        !blocked(g.position.x, g.position.z) &&
        !blocked(g.position.x - r, g.position.z - r) &&
        !blocked(g.position.x + r, g.position.z + r) &&
        !blocked(g.position.x - r, g.position.z + r) &&
        !blocked(g.position.x + r, g.position.z - r);
      if (!still) av.placed = false;
    }
    if (!av.placed) {
      const rm = room ? this.roomById.get(room) : undefined;
      const prefer = rm ? Math.atan2(rm.x + rm.w / 2 - cx, rm.z + rm.d / 2 - cz) : 0;
      const spot = findFreeSpot(blocked, cx, cz, Math.max(x1 - x0, z1 - z0) / 2 + 2.2, r, prefer);
      if (spot) {
        av.group.position.set(spot.x, 1, spot.z);
        const yaw0 = rm ? Math.atan2(rm.x + rm.w / 2 - spot.x, rm.z + rm.d / 2 - spot.z) : 0;
        av.group.rotation.y = yaw0;
        av.group.userData.yaw0 = yaw0;
        av.placed = true;
      }
    }
    const show = av.placed && dv.group.visible;
    if (av.group.visible !== show) v.lightsDirty = true;
    av.group.visible = show;
  }

  /** Enable lamp-lit dust motes only in lit rooms near the camera (4 Hz check). */
  private updateMotes(dt: number): void {
    this.motesCheck -= dt;
    if (this.motesCheck > 0) return;
    this.motesCheck = 0.25;
    const v = this.active;
    const reach = this.zoomS * 0.75;
    for (const [id, handle] of this.roomMotes) {
      const r = this.roomById.get(id);
      if (!r) continue;
      const near =
        Math.abs(r.x + r.w / 2 - this.target.x) < r.w / 2 + reach &&
        Math.abs(r.z + r.d / 2 - this.target.z) < r.d / 2 + reach;
      this.fx.setAmbientEnabled(handle, near && v.litRooms.has(id));
    }
  }

  private nextBrownoutRnd(): number {
    this.brownoutRnd = (Math.imul(this.brownoutRnd, 1664525) + 1013904223) >>> 0;
    return this.brownoutRnd / 4294967296;
  }

  /** Unstable devices in a brownout spit sparks; overheated ones shimmer. */
  private updateBrownout(): void {
    const p = this.powerState;
    if (!p || p.starved.length === 0) return;
    const v = this.active;
    const calm = this.settings.accessibility.reduceFlicker;
    for (const st of p.starved) {
      const dv = v.devices.get(st.id);
      if (!dv?.group.visible) continue;
      const next = this.brownoutAt.get(st.id);
      if (next !== undefined && this.time < next) continue;
      this.brownoutAt.set(st.id, this.time + brownoutInterval(this.nextBrownoutRnd(), calm));
      if (next === undefined) continue; // first sighting: just schedule
      const [x0, z0, x1, z1, h] = dv.footprint;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const size = Math.max(x1 - x0, z1 - z0);
      this.sphere.center.set(cx, 1 + h / 2, cz);
      this.sphere.radius = size + h;
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      const pos = this.tmpV.set(
        cx + (this.nextBrownoutRnd() - 0.5) * (x1 - x0) * 0.6,
        1 + h * 0.85,
        cz + (this.nextBrownoutRnd() - 0.5) * (z1 - z0) * 0.6,
      );
      if (st.reason === "hitze")
        this.fx.emit("heat_shimmer", pos, { scale: THREE.MathUtils.clamp(size / 3, 0.7, 1.8) });
      else this.fx.emit("sparks", pos, { count: calm ? 0.2 : 0.35, scale: 0.45 });
    }
  }

  /** Contact shadows under Lawrence and every visible character. */
  private updateBlobs(lift: number): void {
    let n = 0;
    const [px, py, pz] = this.walker.position;
    n = this.putBlob(n, px, py + lift, pz, 2.7, 0.5);
    for (const npc of this.active.npcs.values()) {
      if (!npc.group.visible || npc.blob <= 0) continue;
      const g = npc.group;
      const air = Math.max(0, g.position.y - 1);
      const holo = npc.rig ? 0.45 : 1;
      n = this.putBlob(n, g.position.x, 1, g.position.z, npc.blob * (1 - air), 0.5 * holo);
    }
    this.blobs.count = n;
    this.blobs.instanceMatrix.needsUpdate = true;
    this.blobAlpha.needsUpdate = true;
  }

  private putBlob(n: number, x: number, y: number, z: number, size: number, alpha: number): number {
    if (n >= BLOB_CAPACITY) return n;
    this.tmpS.set(size, 1, size);
    this.tmpQ.identity();
    this.tmpM.compose(this.tmpDir.set(x, y + 0.04, z), this.tmpQ, this.tmpS);
    this.blobs.setMatrixAt(n, this.tmpM);
    this.blobAlpha.setX(n, alpha);
    return n + 1;
  }

  private updateFocus(force: boolean): void {
    const [px, , pz] = this.walker.position;
    const fx = Math.sin(this.walker.facing);
    const fz = Math.cos(this.walker.facing);
    let best: Interactable | null = null;
    let bestScore = Infinity;
    for (const it of this.active.interactables) {
      if (!it.active || !it.object.visible) continue;
      const dx = it.x + 0.5 - px;
      const dz = it.z + 0.5 - pz;
      const dist = Math.hypot(dx, dz) - it.radius;
      if (dist > REACH) continue;
      const facing = dist > 0.5 ? (dx * fx + dz * fz) / Math.max(0.001, Math.hypot(dx, dz)) : 1;
      const score = dist - facing * 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    if (best !== this.focus || force) {
      this.focus = best;
      this.cb.onFocus(best ? best.target : null);
    }
    this.focusRing.visible = !!best;
    if (best) {
      this.focusRing.position.set(best.x + 0.5, 1.05, best.z + 0.5);
      this.focusRing.scale.setScalar(Math.max(0.6, best.radius / 2.2));
      (this.focusRing.material as THREE.MeshBasicMaterial).opacity =
        0.6 + Math.sin(this.time * 5) * 0.3;
    }
  }
}

/** `o` and all its ancestors up to (and including) `root` are visible. */
function visibleIn(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === root) return true;
  }
  return false;
}

function isAncestor(parent: THREE.Object3D, child: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = child; o; o = o.parent) if (o === parent) return true;
  return false;
}

export { WALKER };

function propGrid(p: { model: string; variant?: string }): Model {
  const decor = p.variant ? PROP_VARIANT_DECOR[p.variant] : undefined;
  return decor && DECOR_BY_ID.has(decor) ? decorModel(decor) : propModel(p.model);
}

/**
 * Animated device / bot visuals (pure — no three).
 * =================================================
 *
 * A `DeviceVisual` is a static `base` model plus a list of `AnimPart`s
 * (separately meshed voxel models that spin, bob, blink, …) and a few
 * `VisualLight`s. All coordinates are in MODEL voxels (MODEL_SCALE world
 * units each); voxel (i, j, k) spans [i, i+1] × [j, j+1] × [k, k+1], so the
 * centre of a model w wide is w / 2.
 *
 * Placement contract (engine side):
 *   - The base is meshed centred in x/z (offset -w/2, 0, -d/2) exactly as
 *     before. A point p in base voxel coords therefore sits at
 *     `(p - [base.w/2, 0, base.d/2]) * MODEL_SCALE` in the device group.
 *   - A part is meshed un-centred (its voxel corner 0,0,0 at the mesh
 *     origin), shifted by `-pivot`, inside a pivot group positioned at
 *     `offset + pivot` (base coords, see `partPivotInBase`). Every frame
 *     the pivot group gets `rotation = rot` and `position += pos` from
 *     `animTransform`, `visible`, and its emissive strength × `intensity`.
 *   - A part with `parent` is placed in the parent's local voxel frame
 *     instead (offset relative to the parent's corner 0,0,0) and inherits
 *     its motion — used for rotors on a hovering drone.
 */
import { C, colorHex, labMaterialOf, type ColorName } from "@/lib/world/content/palette";
import { Model, stagedGrid } from "@/lib/world/models/core";
import { VoxelGrid } from "@/lib/voxel/grid";

export type AnimKind =
  | "spin"
  | "bob"
  | "blink"
  | "pulse"
  | "sway"
  | "orbit"
  | "flicker"
  | "slide"
  // Mechanical motions (all pose-based, so any engine that applies rot/pos shows them):
  /** Stepper / clock tick: rotates `amplitude` rad per step, `speed` steps/s, with a quick snap. */
  | "step"
  /** Reciprocating stroke with dwell at both ends: travel `amplitude` voxels at `speed` Hz. */
  | "piston"
  /** Precessing tilt (gyroscope / gimbal): tilt `amplitude` rad around `axis` at `speed` Hz. */
  | "wobble"
  /** Deterministic shake (unstable matter, rattling parts): `amplitude` voxels, `speed` Hz. */
  | "jitter"
  /** Linear back-and-forth rotation (radar / scan needles): ±`amplitude` rad at `speed` Hz. */
  | "sweep";

export type Axis = "x" | "y" | "z";

export type Vec3 = [number, number, number];

export interface AnimPart {
  name: string;
  model: Model;
  /** Where the part's local origin (voxel corner 0,0,0) sits, in the base model's voxel coords. */
  offset: Vec3;
  /** Rotation pivot in the part's own voxel coords. */
  pivot: Vec3;
  kind: AnimKind;
  /** Rotation / motion axis. Defaults: spin/orbit/bob → y, sway → z, slide → x. */
  axis?: Axis;
  /** rad/s for spin & orbit; steps/s for step; Hz for everything else. */
  speed: number;
  /**
   * bob/slide: travel in voxels · sway: angle in rad · orbit: radius in voxels ·
   * pulse/flicker: modulation depth 0..1 · blink: duty cycle 0..1 ·
   * step: angle per step in rad · piston: stroke in voxels (signed) ·
   * wobble/sweep: angle in rad · jitter: shake in voxels.
   */
  amplitude?: number;
  /** Phase offset in radians (spin/orbit: start angle). */
  phase?: number;
  /** Frozen (rest pose, emissive off) while the device is unpowered. */
  requiresPower: boolean;
  /** Name of an earlier part this one rides on (offset is then in the parent's voxel frame). */
  parent?: string;
  /**
   * Locomotion part of a character (see `gaitTransform`): "roll" = a wheel /
   * track sprocket that turns by the distance travelled (`rollRadius`),
   * "stride" = legs / body bounce that cycle once per `stride` world units
   * and settle while standing. Without a gait source it animates on the clock.
   */
  gait?: "roll" | "stride";
  /** "roll": wheel radius in the part's voxels. */
  rollRadius?: number;
  /** "stride": world units travelled per animation cycle. */
  stride?: number;
}

export interface VisualLight {
  /** Base-model voxel coords. */
  pos: Vec3;
  color: string;
  intensity: number;
  /** World units (three.js PointLight distance). */
  distance: number;
  requiresPower: boolean;
  flicker?: boolean;
}

/** What a live in-world screen shows (rendered by lib/world/render/screens.ts). */
export type ScreenContent =
  | "power"
  | "wave"
  | "scope"
  | "status"
  | "log"
  | "map"
  | "text"
  | "bars"
  | "clock"
  | "radar"
  | "code"
  | "face"
  | "spectrum"
  | "qubits"
  | "reactor"
  | "damien"
  | "boot"
  | "noise"
  /** A live pinboard: the memos pinned to that decor placement (ScreenInfo.pinned). */
  | "notes";

/**
 * A flat live screen on a model. `center` is in the model's voxel coords
 * (same frame as AnimPart.offset); `w`/`h` in model voxels; `normal` is the
 * direction the screen faces.
 */
export interface ScreenSpec {
  center: Vec3;
  w: number;
  h: number;
  normal: "+x" | "-x" | "+z" | "-z" | "+y";
  content: ScreenContent;
  /** Phosphor colour, e.g. "#33FF33". */
  color?: string;
  requiresPower: boolean;
  /** Optional fixed text for content "text". */
  text?: string;
}

export interface DeviceVisual {
  base: Model;
  parts: AnimPart[];
  lights: VisualLight[];
  /** Footprint in model voxels for collision; defaults to base w×d. */
  footprint?: [number, number];
  /** Total height in model voxels including parts; defaults to base h. */
  height?: number;
  /** World units per model voxel (default MODEL_SCALE = 0.5; 0.25 = double detail). */
  scale?: number;
  /** Live screens on this model. */
  screens?: ScreenSpec[];
  /**
   * Authored at the refined resolution (its own bevels, seams, LEDs): the
   * renderer meshes base and parts as they are, with refine family "hires"
   * instead of splitting every voxel 2×2×2 again (see models/refine.ts).
   */
  fine?: boolean;
}

export interface AnimState {
  /** Euler rotation (rad) of the pivot group. */
  rot: Vec3;
  /** Extra translation in model voxels, added to the rest position. */
  pos: Vec3;
  visible: boolean;
  /** Emissive multiplier 0..1 (0 = dark). */
  intensity: number;
}

const TAU = Math.PI * 2;

const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

const DEFAULT_AXIS: Record<AnimKind, Axis> = {
  spin: "y",
  orbit: "y",
  bob: "y",
  sway: "z",
  slide: "x",
  blink: "y",
  pulse: "y",
  flicker: "y",
  step: "y",
  piston: "y",
  wobble: "y",
  jitter: "y",
  sweep: "y",
};

/** Ease-in-out on [0, 1]. */
function smooth(u: number): number {
  const f = Math.max(0, Math.min(1, u));
  return f * f * (3 - 2 * f);
}

/**
 * Piston stroke profile in [0, 1] with period 1: extend (0.35), dwell
 * (0.15), retract (0.35), dwell (0.15).
 */
function stroke(u: number): number {
  const f = u - Math.floor(u);
  if (f < 0.35) return smooth(f / 0.35);
  if (f < 0.5) return 1;
  if (f < 0.85) return 1 - smooth((f - 0.5) / 0.35);
  return 0;
}

/** Deterministic 0..1 noise for an integer step. */
function noise(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Triangle wave in [-1, 1] with period 1. */
function tri(u: number): number {
  const f = u - Math.floor(u);
  return f < 0.5 ? f * 4 - 1 : 3 - f * 4;
}

export function partAxis(part: AnimPart): Axis {
  return part.axis ?? DEFAULT_AXIS[part.kind];
}

/**
 * Pose of `part` at time `t` (seconds). Pure and deterministic.
 * Unpowered parts that require power rest at their phase pose, dark, and
 * blinking overlays are hidden.
 */
export function animTransform(part: AnimPart, t: number, powered: boolean): AnimState {
  const rot: Vec3 = [0, 0, 0];
  const pos: Vec3 = [0, 0, 0];
  const ai = AXIS_INDEX[partAxis(part)];
  const phase = part.phase ?? 0;
  const live = powered || !part.requiresPower;
  const tt = live ? t : 0;
  const hz = TAU * part.speed * tt + phase;
  let visible = true;
  let intensity = live ? 1 : 0;

  switch (part.kind) {
    case "spin":
      rot[ai] = phase + part.speed * tt;
      break;
    case "orbit": {
      const a = phase + part.speed * tt;
      const r = part.amplitude ?? 4;
      const [u, v] = ai === 0 ? [1, 2] : ai === 1 ? [2, 0] : [0, 1];
      pos[u] = Math.cos(a) * r;
      pos[v] = Math.sin(a) * r;
      rot[ai] = a;
      break;
    }
    case "bob":
      pos[ai] = live ? (part.amplitude ?? 1) * Math.sin(hz) : 0;
      break;
    case "slide":
      pos[ai] = live ? (part.amplitude ?? 2) * tri(part.speed * tt + phase / TAU) : 0;
      break;
    case "sway":
      rot[ai] = live ? (part.amplitude ?? 0.3) * Math.sin(hz) : 0;
      break;
    case "blink": {
      const duty = part.amplitude ?? 0.5;
      const u = part.speed * tt + phase / TAU;
      visible = live && u - Math.floor(u) < duty;
      intensity = visible ? 1 : 0;
      break;
    }
    case "pulse":
      if (live) intensity = 1 - (part.amplitude ?? 0.7) * (0.5 - 0.5 * Math.sin(hz));
      break;
    case "flicker":
      if (live)
        intensity = 1 - (part.amplitude ?? 0.5) * noise(Math.floor(part.speed * tt + phase));
      break;
    case "step": {
      // Snap to the next position during the first 18 % of each step.
      const u = part.speed * tt;
      const n = Math.floor(u);
      rot[ai] = phase + (part.amplitude ?? TAU / 12) * (n + smooth((u - n) / 0.18));
      break;
    }
    case "piston":
      pos[ai] = live ? (part.amplitude ?? 2) * stroke(part.speed * tt + phase / TAU) : 0;
      break;
    case "wobble": {
      const a = live ? (part.amplitude ?? 0.25) : 0;
      const [u, v] = ai === 0 ? [1, 2] : ai === 1 ? [2, 0] : [0, 1];
      rot[u] = a * Math.cos(hz);
      rot[v] = a * Math.sin(hz);
      break;
    }
    case "jitter":
      if (live) {
        const a = part.amplitude ?? 0.5;
        const n = Math.floor(part.speed * tt + phase);
        pos[0] = a * (noise(n) * 2 - 1);
        pos[1] = a * (noise(n + 101) * 2 - 1) * 0.5;
        pos[2] = a * (noise(n + 211) * 2 - 1);
      }
      break;
    case "sweep":
      rot[ai] = live ? (part.amplitude ?? 0.8) * tri(part.speed * tt + phase / TAU) : 0;
      break;
  }
  return { rot, pos, visible, intensity };
}

/**
 * Pose of a part on a moving character. Locomotion parts (`gait`) follow the
 * distance travelled instead of the clock, so wheels roll without slipping
 * and legs never paddle while the character stands still:
 *  - "roll": angle = phase + travel / radius (forward roll about the part's axis);
 *  - "stride": the clip advances one cycle per `stride` units and its
 *    swing fades out with `moving` (0 standing … 1 full speed).
 * `travel` is the distance walked (world units, any origin), `scale` the
 * rig's world units per voxel. Every other part: `animTransform`.
 */
export function gaitTransform(
  part: AnimPart,
  t: number,
  powered: boolean,
  travel: number,
  moving: number,
  scale: number,
): AnimState {
  if (!part.gait) return animTransform(part, t, powered);
  if (part.gait === "roll") {
    const st = animTransform(part, 0, false);
    const r = Math.max(1e-3, (part.rollRadius ?? 3) * scale);
    st.rot[AXIS_INDEX[partAxis(part)]] = (part.phase ?? 0) + travel / r;
    st.intensity = powered || !part.requiresPower ? 1 : 0;
    return st;
  }
  const cycles = travel / Math.max(1e-3, part.stride ?? 1);
  const st = animTransform(part, cycles / Math.max(1e-6, part.speed), true);
  const w = Math.max(0, Math.min(1, moving));
  for (let i = 0; i < 3; i++) {
    st.rot[i] = st.rot[i]! * w;
    st.pos[i] = st.pos[i]! * w;
  }
  if (part.requiresPower && !powered) st.intensity = 0;
  return st;
}

/** Light strength at time `t` (0 when it needs power and has none). */
export function lightIntensity(light: VisualLight, t: number, powered: boolean): number {
  if (light.requiresPower && !powered) return 0;
  if (!light.flicker) return light.intensity;
  return light.intensity * (0.7 + 0.3 * noise(Math.floor(t * 12)));
}

/** A part's pivot in base voxel coords relative to the base's bottom-centre (engine origin). */
export function partPivotInBase(base: Model, part: AnimPart): Vec3 {
  return [
    part.offset[0] + part.pivot[0] - base.w / 2,
    part.offset[1] + part.pivot[1],
    part.offset[2] + part.pivot[2] - base.d / 2,
  ];
}

/** A light's position relative to the base's bottom-centre (engine origin), in model voxels. */
export function lightPosInBase(base: Model, light: VisualLight): Vec3 {
  return [light.pos[0] - base.w / 2, light.pos[1], light.pos[2] - base.d / 2];
}

// ── Build kit (shared by devices.ts and characters.ts) ───────────
//
// Drawing helpers use core's convention: arguments are voxel INDICES
// (a centre between two voxels is written as x.5). Mount helpers take
// CONTINUOUS coords (voxel index + 0.5 = voxel centre).

export interface MountOpts {
  speed: number;
  axis?: Axis;
  amplitude?: number;
  phase?: number;
  /** Defaults to true. */
  power?: boolean;
  /** Pivot in the part's voxel coords; defaults to the part's centre. */
  pivot?: Vec3;
  parent?: string;
  /** Locomotion part (see `AnimPart.gait`). */
  gait?: "roll" | "stride";
  rollRadius?: number;
  stride?: number;
}

/** Part whose pivot sits at `at` (continuous base coords, or the parent's frame). */
export function mount(
  name: string,
  model: Model,
  at: Vec3,
  kind: AnimKind,
  o: MountOpts,
): AnimPart {
  const pivot: Vec3 = o.pivot ?? [model.w / 2, model.h / 2, model.d / 2];
  const part: AnimPart = {
    name,
    model,
    offset: [at[0] - pivot[0], at[1] - pivot[1], at[2] - pivot[2]],
    pivot,
    kind,
    speed: o.speed,
    requiresPower: o.power ?? true,
  };
  if (o.axis) part.axis = o.axis;
  if (o.amplitude !== undefined) part.amplitude = o.amplitude;
  if (o.phase !== undefined) part.phase = o.phase;
  if (o.parent) part.parent = o.parent;
  if (o.gait) part.gait = o.gait;
  if (o.rollRadius !== undefined) part.rollRadius = o.rollRadius;
  if (o.stride !== undefined) part.stride = o.stride;
  return part;
}

export function glow(
  pos: Vec3,
  color: ColorName,
  intensity: number,
  distance: number,
  requiresPower = true,
  flicker = false,
): VisualLight {
  const l: VisualLight = { pos, color: colorHex(color), intensity, distance, requiresPower };
  if (flicker) l.flicker = true;
  return l;
}

/** Assemble a visual; `height` covers parts that rise above the base. */
export function visual(
  base: Model,
  parts: AnimPart[],
  lights: VisualLight[],
  footprint?: [number, number],
): DeviceVisual {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const baseY = (p: AnimPart): number => {
    const par = p.parent ? byName.get(p.parent) : undefined;
    return p.offset[1] + (par ? baseY(par) : 0);
  };
  let height = base.h;
  for (const p of parts) {
    const vertical = partAxis(p) === "y";
    const lift =
      p.kind === "bob" && vertical
        ? Math.abs(p.amplitude ?? 1)
        : p.kind === "piston" && vertical
          ? Math.max(0, p.amplitude ?? 2)
          : p.kind === "jitter"
            ? Math.abs(p.amplitude ?? 0.5)
            : 0;
    height = Math.max(height, Math.ceil(baseY(p) + p.model.h + lift));
  }
  const v: DeviceVisual = { base, parts, lights, height };
  if (footprint) v.footprint = footprint;
  return v;
}

/** Disc facing +z at depth z, centre (cx, cy). `c = 0` carves. */
export function discXY(
  m: Model,
  cx: number,
  cy: number,
  z: number,
  r: number,
  c: number,
  hollow = false,
): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dd = (x - cx) ** 2 + (y - cy) ** 2;
      if (dd <= r * r + 0.3 && (!hollow || dd >= (r - 1.2) ** 2)) m.set(x, y, z, c);
    }
}

/** Disc facing ±x at column x, centre (cy, cz). */
export function discYZ(m: Model, x: number, cy: number, cz: number, r: number, c: number): void {
  for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      if ((y - cy) ** 2 + (z - cz) ** 2 <= r * r + 0.3) m.set(x, y, z, c);
}

/** Box with contrasting vertical edges and top rim; top corners chamfered. */
export function bevelBox(
  m: Model,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  body: number,
  edge: number,
): void {
  m.box(x0, y0, z0, x1, y1, z1, body);
  for (const x of [x0, x1])
    for (const z of [z0, z1]) {
      m.box(x, y0, z, x, y1, z, edge);
      m.set(x, y1, z, 0);
    }
  m.box(x0 + 1, y1, z0, x1 - 1, y1, z0, edge).box(x0 + 1, y1, z1, x1 - 1, y1, z1, edge);
  m.box(x0, y1, z0 + 1, x0, y1, z1 - 1, edge).box(x1, y1, z0 + 1, x1, y1, z1 - 1, edge);
}

/** Flat panel on the plane z with screws in the corners. */
export function bolted(
  m: Model,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  c: number,
  screw: number = C.chrome,
): void {
  m.box(x0, y0, z, x1, y1, z, c);
  m.set(x0, y0, z, screw).set(x1, y0, z, screw).set(x0, y1, z, screw).set(x1, y1, z, screw);
}

/** Horizontal louvre slats on the plane z. */
export function vent(m: Model, x0: number, y0: number, x1: number, y1: number, z: number): void {
  for (let y = y0; y <= y1; y++)
    m.box(x0, y, z, x1, y, z, (y - y0) % 2 === 0 ? C.steel_dark : C.black);
}

/** Louvre slats on the side plane x. */
export function ventSide(
  m: Model,
  x: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): void {
  for (let y = y0; y <= y1; y++)
    m.box(x, y, z0, x, y, z1, (y - y0) % 2 === 0 ? C.steel_dark : C.black);
}

/** Diagonal yellow/black hazard stripes on the plane z. */
export function hazard(m: Model, x0: number, y0: number, x1: number, y1: number, z: number): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      m.set(x, y, z, ((x + y) >> 1) % 2 === 0 ? C.safety_yellow : C.hazard_black);
}

/** Hazard stripes on the side plane x. */
export function hazardSide(
  m: Model,
  x: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): void {
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      m.set(x, y, z, ((z + y) >> 1) % 2 === 0 ? C.safety_yellow : C.hazard_black);
}

/** One-row label with "text" dots. */
export function label(
  m: Model,
  x0: number,
  x1: number,
  y: number,
  z: number,
  bg: number = C.paper,
  ink: number = C.paint_black,
): void {
  for (let x = x0; x <= x1; x++) m.set(x, y, z, x > x0 && x < x1 && (x - x0) % 3 !== 0 ? ink : bg);
}

/** Round dial facing +z. `angle` (rad from 12 o'clock, clockwise) draws a needle. */
export function gauge(
  m: Model,
  cx: number,
  cy: number,
  z: number,
  r: number,
  angle?: number,
  face: number = C.paper,
  rim: number = C.brass,
  needle: number = C.led_red,
): void {
  discXY(m, cx, cy, z, r + 1, rim);
  discXY(m, cx, cy, z, r, face);
  for (const a of [-1.2, -0.6, 0, 0.6, 1.2])
    m.set(Math.round(cx + Math.sin(a) * r), Math.round(cy + Math.cos(a) * r), z, C.paint_black);
  if (angle !== undefined)
    for (let i = 1; i < r; i++)
      m.set(Math.round(cx + Math.sin(angle) * i), Math.round(cy + Math.cos(angle) * i), z, needle);
  m.set(Math.round(cx), Math.round(cy), z, C.paint_black);
}

/** Grid of keys (one voxel each, one voxel apart) protruding on plane z. */
export function keypad(
  m: Model,
  x0: number,
  y0: number,
  cols: number,
  rows: number,
  z: number,
  key: number = C.paint_gray,
  hi: number = C.safety_red,
): void {
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      m.set(x0 + i * 2, y0 + j * 2, z, i === cols - 1 && j === 0 ? hi : key);
}

/** Axis-aligned polyline of boxes (cables, conduits, rails). */
export function cableRun(m: Model, pts: Vec3[], c: number): void {
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1]!, pts[i]!];
    m.box(a[0], a[1], a[2], b[0], b[1], b[2], c);
  }
}

/** Pipe rising `up` voxels from (x,y,z) then running `out` voxels along `dir`, with flanges. */
export function pipeElbow(
  m: Model,
  x: number,
  y: number,
  z: number,
  up: number,
  out: number,
  dir: "x" | "-x" | "z" | "-z",
  c: number,
  flange: number = C.brass,
): void {
  m.box(x, y, z, x, y + up, z, c);
  const top = y + up;
  const dx = dir === "x" ? 1 : dir === "-x" ? -1 : 0;
  const dz = dir === "z" ? 1 : dir === "-z" ? -1 : 0;
  m.box(x, top, z, x + dx * out, top, z + dz * out, c);
  m.set(x, y, z, flange)
    .set(x, top, z, flange)
    .set(x + dx * out, top, z + dz * out, flange);
}

export type ScreenKind = "wave" | "bars" | "text" | "grid" | "graph" | "radar" | "scan";

/** Bezelled screen on plane z with a content pattern. */
export function screen(
  m: Model,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  kind: ScreenKind,
  fg: number,
  bg: number = C.crt_bg,
  seed = 0,
): void {
  m.box(x0 - 1, y0 - 1, z, x1 + 1, y1 + 1, z, C.black);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = x - x0;
      const j = y - y0;
      let on = false;
      switch (kind) {
        case "wave":
          on = j === Math.round(((h - 1) / 2) * (1 + Math.sin(i * 0.9 + seed)));
          break;
        case "bars":
          on = i % 2 === 0 && j <= (i * 7 + seed * 3 + 2) % h;
          break;
        case "text":
          on = (y1 - y) % 2 === 0 && i < 1 + ((j * 5 + seed * 3 + 2) % w);
          break;
        case "grid":
          on = i % 2 === 0 && j % 2 === 0;
          break;
        case "graph":
          on = j === Math.min(h - 1, Math.floor((i * h) / w + ((i * 3 + seed) % 2)));
          break;
        case "radar": {
          const dd = Math.hypot(x - cx, y - cy);
          const r = Math.min(w, h) / 2;
          on = Math.abs(dd - r + 0.5) < 0.6 || (x >= cx && Math.abs(y - cy - (x - cx) * 0.6) < 0.5);
          break;
        }
        case "scan":
          on = j % 2 === 0;
          break;
      }
      m.set(x, y, z, on ? fg : bg);
    }
}

// ── Part model makers ────────────────────────────────────────────

/** Filled box model. */
export function block(w: number, h: number, d: number, c: number): Model {
  return new Model(w, h, d).box(0, 0, 0, w - 1, h - 1, d - 1, c);
}

/** Three-bladed rotor of radius r in plane "xy" (spins about z) or "xz" (about y). */
export function fanRotor(
  r: number,
  plane: "xy" | "xz",
  blade: number = C.steel,
  hub: number = C.metal_dark,
): Model {
  const s = 2 * r + 1;
  const m = plane === "xy" ? new Model(s, s, 1) : new Model(s, 1, s);
  for (let v = 0; v < s; v++)
    for (let u = 0; u < s; u++) {
      const du = u - r;
      const dv = v - r;
      const d = Math.hypot(du, dv);
      if (d > r + 0.3) continue;
      const a = Math.atan2(dv, du);
      const f = ((((3 * a) / (Math.PI * 2) + d * 0.07) % 1) + 1) % 1;
      const c = d <= 1.2 ? hub : f < 0.36 ? blade : 0;
      if (c) {
        if (plane === "xy") m.set(u, v, 0, c);
        else m.set(u, 0, v, c);
      }
    }
  return m;
}

/** Ring of radius r in the given plane; `marker` voxels at two opposite points make rotation visible. */
export function ringModel(
  r: number,
  plane: "xz" | "xy" | "yz",
  c: number,
  marker?: number,
  thick = 1,
): Model {
  const s = 2 * Math.ceil(r) + 3;
  const ctr = (s - 1) / 2;
  const [w, h, d] = plane === "xz" ? [s, thick, s] : plane === "xy" ? [s, s, thick] : [thick, s, s];
  const m = new Model(w, h, d);
  for (let v = 0; v < s; v++)
    for (let u = 0; u < s; u++) {
      const dist = Math.hypot(u - ctr, v - ctr);
      if (Math.abs(dist - r) > 0.6) continue;
      const a = Math.abs(Math.atan2(v - ctr, u - ctr));
      const col = marker !== undefined && (a < 0.35 || a > Math.PI - 0.35) ? marker : c;
      for (let t = 0; t < thick; t++) {
        if (plane === "xz") m.set(u, t, v, col);
        else if (plane === "xy") m.set(u, v, t, col);
        else m.set(t, v, u, col);
      }
    }
  return m;
}

/** Sphere model with an optional inner core colour. */
export function orb(r: number, c: number, core?: number, coreR = r / 2): Model {
  const s = 2 * Math.ceil(r) + 1;
  const ctr = (s - 1) / 2;
  const m = new Model(s, s, s);
  m.sphere(ctr, ctr, ctr, r, c);
  if (core !== undefined) {
    // Expose the core through the front so it reads as an inner glow.
    m.sphere(ctr, ctr, ctr, coreR, core);
    for (let z = ctr + 1; z < s; z++) if (m.grid.get(ctr, ctr, z)) m.set(ctr, ctr, z, core);
  }
  return m;
}

/** Row of single-voxel LEDs, `gap` apart, along x (or y). */
export function ledStrip(n: number, colors: number[], gap = 2, along: "x" | "y" = "x"): Model {
  const len = (n - 1) * gap + 1;
  const m = along === "x" ? new Model(len, 1, 1) : new Model(1, len, 1);
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length]!;
    if (along === "x") m.set(i * gap, 0, 0, c);
    else m.set(0, i * gap, 0, c);
  }
  return m;
}

// ── Detail kit (DETAIL_SCALE devices) ────────────────────────────
//
// Face-relative drawing: a `Face` plus `at` (the voxel index of that
// face's outermost layer) maps face coords (u, v, d) to voxels. u runs
// along the face (x for ±z / +y faces, z for ±x faces), v runs up (y) —
// or along z for "+y" — and d is the depth INTO the model (d = -1 is one
// voxel proud of the surface).

/** World units per model voxel for the high-detail device models. */
export const DETAIL_SCALE = 0.25;

export type Face = "+x" | "-x" | "+z" | "-z" | "+y";

export function faceXYZ(face: Face, at: number, u: number, v: number, d: number): Vec3 {
  switch (face) {
    case "+z":
      return [u, v, at - d];
    case "-z":
      return [u, v, at + d];
    case "+x":
      return [at - d, v, u];
    case "-x":
      return [at + d, v, u];
    case "+y":
      return [u, at - d, v];
  }
}

/** Set one voxel in face coords (`c = 0` carves). */
export function faceSet(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  d: number,
  c: number,
): void {
  const [x, y, z] = faceXYZ(face, at, u, v, d);
  m.set(x, y, z, c);
}

/** Fill an inclusive rectangle of a face at depth d. */
export function faceRect(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  d: number,
  c: number,
): void {
  for (let v = Math.min(v0, v1); v <= Math.max(v0, v1); v++)
    for (let u = Math.min(u0, u1); u <= Math.max(u0, u1); u++) faceSet(m, face, at, u, v, d, c);
}

/** Recolour a surface voxel only where the model is solid (paint, weathering). */
export function facePaint(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  c: number,
  d = 0,
): void {
  const [x, y, z] = faceXYZ(face, at, u, v, d);
  if (m.grid.get(x, y, z)) m.set(x, y, z, c);
}

/** Deterministic 0..1 hash of an integer triple (weathering patterns). */
export function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Housing with chamfered vertical edges (edge-coloured highlight lines
 * beside each cut) and a chamfered top rim.
 */
export function chamferBox(
  m: Model,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  body: number,
  edge: number,
): void {
  m.box(x0, y0, z0, x1, y1, z1, body);
  for (const [x, z, dx, dz] of [
    [x0, z0, 1, 1],
    [x1, z0, -1, 1],
    [x0, z1, 1, -1],
    [x1, z1, -1, -1],
  ] as const) {
    m.box(x, y0, z, x, y1, z, 0);
    m.box(x + dx, y0, z, x + dx, y1, z, edge).box(x, y0, z + dz, x, y1, z + dz, edge);
  }
  // Top rim: outer ring removed, the ring inside it edge-coloured.
  m.box(x0, y1, z0, x1, y1, z0, 0).box(x0, y1, z1, x1, y1, z1, 0);
  m.box(x0, y1, z0, x0, y1, z1, 0).box(x1, y1, z0, x1, y1, z1, 0);
  m.box(x0 + 1, y1, z0 + 1, x1 - 1, y1, z0 + 1, edge).box(
    x0 + 1,
    y1,
    z1 - 1,
    x1 - 1,
    y1,
    z1 - 1,
    edge,
  );
  m.box(x0 + 1, y1, z0 + 1, x0 + 1, y1, z1 - 1, edge).box(
    x1 - 1,
    y1,
    z0 + 1,
    x1 - 1,
    y1,
    z1 - 1,
    edge,
  );
}

/** Dark plinth with a recessed toe-kick (bottom row inset by one). */
export function plinth(
  m: Model,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h: number,
  c: number = C.metal_dark,
  kick: number = C.black,
): void {
  m.box(x0, 1, z0, x1, h - 1, z1, c);
  m.box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, kick);
}

/** Carved panel seam (a 1-voxel groove with a dark floor) along an axis-aligned line. */
export function seam(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  floor: number = C.black,
): void {
  for (let v = Math.min(v0, v1); v <= Math.max(v0, v1); v++)
    for (let u = Math.min(u0, u1); u <= Math.max(u0, u1); u++) {
      const [x, y, z] = faceXYZ(face, at, u, v, 0);
      if (!m.grid.get(x, y, z)) continue;
      m.set(x, y, z, 0);
      faceSet(m, face, at, u, v, 1, floor);
    }
}

/** Proud screw / rivet heads at the given face points. */
export function screws(
  m: Model,
  face: Face,
  at: number,
  pts: readonly (readonly [number, number])[],
  c: number = C.chrome,
): void {
  for (const [u, v] of pts) faceSet(m, face, at, u, v, -1, c);
}

/** Screws in the four corners of a face rectangle. */
export function cornerScrews(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  c: number = C.chrome,
): void {
  screws(
    m,
    face,
    at,
    [
      [u0, v0],
      [u1, v0],
      [u0, v1],
      [u1, v1],
    ],
    c,
  );
}

/** A row of rivets every `step` voxels along u. */
export function rivetRow(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  u1: number,
  v: number,
  step: number,
  c: number = C.steel,
): void {
  for (let u = u0; u <= u1; u += step) faceSet(m, face, at, u, v, -1, c);
}

/** Bolted cover plate proud of the face, with corner screws. */
export function coverPlate(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  c: number,
  screw: number = C.chrome,
): void {
  faceRect(m, face, at, u0, v0, u1, v1, -1, c);
  for (const [u, v] of [
    [u0 + 1, v0 + 1],
    [u1 - 1, v0 + 1],
    [u0 + 1, v1 - 1],
    [u1 - 1, v1 - 1],
  ] as const)
    faceSet(m, face, at, u, v, -2, screw);
}

/**
 * Recessed louvre vent: the rect is carved `depth` deep with a black back,
 * slats on every other row sit one voxel inside the face.
 */
export function grille(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  depth = 2,
  slat: number = C.steel_dark,
  frame?: number,
): void {
  for (let d = 0; d < depth; d++) faceRect(m, face, at, u0, v0, u1, v1, d, 0);
  faceRect(m, face, at, u0, v0, u1, v1, depth, C.black);
  for (let v = v0 + 1; v <= v1; v += 2) faceRect(m, face, at, u0, v, u1, v, 1, slat);
  if (frame !== undefined) {
    faceRect(m, face, at, u0 - 1, v0 - 1, u1 + 1, v0 - 1, -1, frame);
    faceRect(m, face, at, u0 - 1, v1 + 1, u1 + 1, v1 + 1, -1, frame);
    faceRect(m, face, at, u0 - 1, v0, u0 - 1, v1, -1, frame);
    faceRect(m, face, at, u1 + 1, v0, u1 + 1, v1, -1, frame);
  }
}

/** Screen normal for a face. */
function faceNormal(face: Face): ScreenSpec["normal"] {
  return face;
}

export interface BezelOpts {
  color?: string;
  /** Frame colour (default metal_dark). */
  frame?: number;
  /** Depth of the screen surface into the face (default 0 — flush, frame proud). */
  sink?: number;
  power?: boolean;
  text?: string;
}

/**
 * Framed live screen: a proud frame around the rect, the rect itself a dark
 * (black) face at depth `sink` with everything in front of it cleared, and a
 * `ScreenSpec` lying exactly on that dark surface.
 */
export function bezelScreen(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  content: ScreenContent,
  o: BezelOpts = {},
): ScreenSpec {
  const sink = o.sink ?? 0;
  const frame = o.frame ?? C.metal_dark;
  for (let d = -1; d <= sink; d++) {
    faceRect(m, face, at, u0 - 1, v0 - 1, u1 + 1, v1 + 1, d, frame);
    faceRect(m, face, at, u0, v0, u1, v1, d, d === sink ? C.black : 0);
  }
  faceRect(m, face, at, u0, v0, u1, v1, sink + 1, C.black);
  const uc = (u0 + u1 + 1) / 2;
  const vc = (v0 + v1 + 1) / 2;
  const w = u1 - u0 + 1;
  const h = v1 - v0 + 1;
  const plane = face === "+x" || face === "+z" || face === "+y" ? at + 1 - sink : at + sink;
  const center: Vec3 =
    face === "+z" || face === "-z"
      ? [uc, vc, plane]
      : face === "+y"
        ? [uc, plane, vc]
        : [plane, vc, uc];
  const s: ScreenSpec = {
    center,
    w,
    h,
    normal: faceNormal(face),
    content,
    requiresPower: o.power ?? true,
  };
  if (o.color) s.color = o.color;
  if (o.text) s.text = o.text;
  return s;
}

/** Diagonal hazard stripes (2 voxels wide) on a face rect at depth d. */
export function hazardFace(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  d = 0,
): void {
  for (let v = v0; v <= v1; v++)
    for (let u = u0; u <= u1; u++)
      faceSet(m, face, at, u, v, d, (((u + v) >> 1) & 1) === 0 ? C.safety_yellow : C.hazard_black);
}

// 3×5 stencil font, rows top → bottom.
const FONT: Record<string, string> = {
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  J: "001001001101010",
  K: "101101110101101",
  L: "100100100100111",
  M: "101111111101101",
  N: "110101101101101",
  O: "010101101101010",
  P: "110101110100100",
  Q: "010101101110011",
  R: "110101110101101",
  S: "011100010001110",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
  W: "101101111111101",
  X: "101101010101101",
  Y: "101101010010010",
  Z: "111001010100111",
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "110001010100111",
  "3": "110001010001110",
  "4": "101101111001001",
  "5": "111100110001110",
  "6": "011100111101111",
  "7": "111001010010010",
  "8": "111101111101111",
  "9": "111101111001110",
  "-": "000000111000000",
  "!": "010010010000010",
  ":": "000010000010000",
  ".": "000000000000010",
  "%": "101001010100101",
  "?": "110001010000010",
  "+": "000010111010000",
  "/": "001001010100100",
  "<": "001010100010001",
  ">": "100010001010100",
  "=": "000111000111000",
  "#": "101111101111101",
};

/** Pixel width of a stencilled string (3 per glyph + 1 gap). */
export function stencilWidth(text: string): number {
  return Math.max(0, text.length * 4 - 1);
}

/**
 * Stencil `text` (3×5 glyphs) onto a face; (u, v) is the bottom-left corner
 * as seen from outside. d = 0 paints into the surface, -1 stands proud.
 */
export function stencil(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  text: string,
  c: number,
  d = 0,
): void {
  // Reading direction along u, as seen from outside the face.
  const dir = face === "+x" || face === "-z" ? -1 : 1;
  for (let i = 0; i < text.length; i++) {
    const g = FONT[text[i]!.toUpperCase()];
    if (!g) continue;
    for (let r = 0; r < 5; r++)
      for (let k = 0; k < 3; k++) {
        if (g[r * 3 + k] !== "1") continue;
        const uu = u + dir * (i * 4 + k);
        // On a top face the glyph's top points away from the viewer (-z).
        const vv = face === "+y" ? v - 4 + r : v + 4 - r;
        if (d === 0) facePaint(m, face, at, uu, vv, c);
        else faceSet(m, face, at, uu, vv, d, c);
      }
  }
}

/** Proud label plate with stencilled text, centred. */
export function namePlate(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  text: string,
  bg: number = C.paint_cream,
  ink: number = C.paint_black,
): void {
  const w = stencilWidth(text) + 2;
  const dir = face === "+x" || face === "-z" ? -1 : 1;
  const ua = dir > 0 ? u0 : u0 - w + 1;
  faceRect(m, face, at, ua, v0, ua + w - 1, v0 + 6, -1, bg);
  const start = dir > 0 ? u0 + 1 : u0 - 1;
  stencil(m, face, at, start, face === "+y" ? v0 + 5 : v0 + 1, text, ink, -1);
}

/** Round knob (2×2, proud) with a pointer voxel on top. */
export function knob(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  c: number = C.paint_black,
  pointer: number = C.chrome,
): void {
  faceRect(m, face, at, u, v, u + 1, v + 1, -1, c);
  faceSet(m, face, at, u + 1, v + 1, -2, pointer);
}

/** Bank of toggle switches on a dark strip; levers alternate up/down. */
export function switchBank(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v: number,
  n: number,
  step = 2,
  lever: number = C.chrome,
  plate: number = C.black,
): void {
  const u1 = u0 + (n - 1) * step;
  faceRect(m, face, at, u0 - 1, v, u1 + 1, v + 2, -1, plate);
  for (let i = 0; i < n; i++) {
    const u = u0 + i * step;
    faceSet(m, face, at, u, v + 1, -2, lever);
    faceSet(m, face, at, u, (i * 5 + n) % 3 === 0 ? v : v + 2, -2, lever);
  }
}

/** Row of proud indicator LEDs. */
export function ledRow(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v: number,
  n: number,
  step: number,
  colors: readonly number[],
): void {
  for (let i = 0; i < n; i++)
    faceSet(m, face, at, u0 + i * step, v, -1, colors[i % colors.length]!);
}

/** Sticky note (4×4, proud) with two scribbled lines. */
export function stickyNote(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  c: number = C.paper_yellow,
  ink: number = C.paint_navy,
): void {
  faceRect(m, face, at, u, v, u + 3, v + 3, -1, c);
  faceRect(m, face, at, u + 1, v + 2, u + 3, v + 2, -1, ink);
  faceRect(m, face, at, u, v + 1, u + 2, v + 1, -1, ink);
}

/** Rust streak running down from (u, v1) to v0, fading as it goes. */
export function rustStreak(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v0: number,
  v1: number,
): void {
  for (let v = v1; v >= v0; v--) {
    const t = (v1 - v) / Math.max(1, v1 - v0);
    if (t > 0.5 && hash3(u, v, at) < t - 0.3) continue;
    facePaint(m, face, at, u, v, t < 0.3 ? C.iron_rust : C.rust);
  }
  facePaint(m, face, at, u + 1, v1, C.rust);
}

/** Scorch mark (soot with a rusty halo) of radius r around (u, v). */
export function scorch(m: Model, face: Face, at: number, u: number, v: number, r: number): void {
  for (let dv = -Math.ceil(r); dv <= Math.ceil(r); dv++)
    for (let du = -Math.ceil(r); du <= Math.ceil(r); du++) {
      const dd = Math.hypot(du, dv * 1.2) / r;
      if (dd > 1) continue;
      const n = hash3(u + du, v + dv, at * 3);
      if (dd > 0.7 && n < 0.5) continue;
      facePaint(
        m,
        face,
        at,
        u + du,
        v + dv,
        dd < 0.45 ? C.black : n < 0.5 ? C.metal_dark : C.iron_rust,
      );
    }
}

/**
 * Dust and grime on the lowest `rows` layers: exposed side voxels get a
 * sparse concrete-coloured speckle (denser at the bottom).
 */
export function dust(m: Model, rows = 3, density = 0.45): void {
  const g = m.grid;
  for (let y = 0; y < Math.min(rows, g.sy); y++)
    for (let z = 0; z < g.sz; z++)
      for (let x = 0; x < g.sx; x++) {
        const v = g.get(x, y, z);
        // Leave empty cells and dark screen faces alone.
        if (!v || v === C.black) continue;
        const exposed =
          !g.get(x + 1, y, z) || !g.get(x - 1, y, z) || !g.get(x, y, z + 1) || !g.get(x, y, z - 1);
        if (!exposed) continue;
        const n = hash3(x, y, z);
        if (n < density * (1 - y / rows))
          m.set(x, y, z, n < density * 0.35 ? C.concrete_light : C.concrete_dark);
      }
}

/** Coffee ring stain on the top surface at height y (only paints solid voxels). */
export function coffeeRing(m: Model, cx: number, y: number, cz: number, r = 1.6): void {
  for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
      if (Math.abs(Math.hypot(x - cx, z - cz) - r) < 0.55 && m.grid.get(x, y, z))
        m.set(x, y, z, C.coffee);
}

/**
 * Parallel cable harness along an axis-aligned polyline; cable i is
 * offset by i along `spread`. The first point gets a connector block
 * and every cable ends in a plug voxel.
 */
export function harness(
  m: Model,
  pts: Vec3[],
  colors: readonly number[],
  spread: Axis,
  connector: number = C.steel_dark,
  plug: number = C.chrome,
): void {
  const ai = AXIS_INDEX[spread];
  colors.forEach((c, i) => {
    const shifted = pts.map((p) => {
      const q: Vec3 = [p[0], p[1], p[2]];
      q[ai] += i;
      return q;
    });
    cableRun(m, shifted, c);
    const end = shifted[shifted.length - 1]!;
    m.set(end[0], end[1], end[2], plug);
  });
  const a = pts[0]!;
  const b: Vec3 = [a[0], a[1], a[2]];
  b[ai] += colors.length - 1;
  m.box(a[0], a[1], a[2], b[0], b[1], b[2], connector);
}

/** Vertical glass tube (hollow) with metal caps, rows y0..y1. */
export function glassTube(
  m: Model,
  cx: number,
  cz: number,
  r: number,
  y0: number,
  y1: number,
  glass: number = C.glass,
  cap: number = C.chrome,
): void {
  m.cyl(cx, cz, r, y0 + 1, y1 - 1, glass, true);
  m.cyl(cx, cz, r + 0.6, y0, y0, cap);
  m.cyl(cx, cz, r + 0.6, y1, y1, cap);
}

/** Assemble a high-detail visual (scale DETAIL_SCALE) with live screens. */
export function detailVisual(
  base: Model,
  parts: AnimPart[],
  lights: VisualLight[],
  screens: ScreenSpec[],
  footprint?: [number, number],
): DeviceVisual {
  const v = visual(base, parts, lights, footprint);
  v.scale = DETAIL_SCALE;
  v.screens = screens;
  return v;
}

// ── Detail part makers ───────────────────────────────────────────

/** Faceted crystal: a bi-pyramid of radius r and height h with a glowing core. */
export function gem(h: number, r: number, c: number, core: number): Model {
  const s = 2 * Math.ceil(r) + 1;
  const ctr = (s - 1) / 2;
  const m = new Model(s, h, s);
  const mid = (h - 1) * 0.4;
  for (let y = 0; y < h; y++) {
    const t = y <= mid ? y / Math.max(1, mid) : (h - 1 - y) / Math.max(1, h - 1 - mid);
    const rr = Math.max(0.5, r * t);
    for (let z = 0; z < s; z++)
      for (let x = 0; x < s; x++) {
        const dd = Math.abs(x - ctr) + Math.abs(z - ctr);
        if (dd <= rr + 0.2) m.set(x, y, z, dd <= rr * 0.45 ? core : c);
      }
  }
  // Let the core show on the front facet.
  for (let y = 1; y < h - 1; y++) if (m.grid.get(ctr, y, s - 1)) m.set(ctr, y, s - 1, core);
  return m;
}

/** Needle / hand: voxel 0 is the hub, the hand points +y. */
export function needleModel(len: number, c: number, hub: number = C.paint_black, w = 1): Model {
  const m = new Model(w, len + 1, 1);
  m.box(0, 1, 0, w - 1, len, 0, c);
  m.box(0, 0, 0, w - 1, 0, 0, hub);
  return m;
}

/** Tape / film reel facing +z: rim, spokes, hub. */
export function reelModel(r: number, rim: number = C.paint_black, hub: number = C.chrome): Model {
  const s = 2 * Math.ceil(r) + 1;
  const ctr = (s - 1) / 2;
  const m = new Model(s, s, 1);
  for (let v = 0; v < s; v++)
    for (let u = 0; u < s; u++) {
      const d = Math.hypot(u - ctr, v - ctr);
      if (d > r + 0.3) continue;
      const a = Math.atan2(v - ctr, u - ctr);
      const spoke = Math.abs(Math.sin(a * 1.5)) < 0.28;
      const c = d < 1.3 ? hub : d > r - 1.1 ? rim : d < r * 0.55 || spoke ? rim : 0;
      if (c) m.set(u, v, 0, c);
    }
  return m;
}

// ── Rear / service kit (backs and sides) ─────────────────────────
//
// Service hatches, rear vents, sockets, serial plates, cable drops and the
// odd human touch for the faces the camera only sees after a rotation.
// Face-relative like the detail kit. Proud voxels (d < 0) that would leave
// the grid fall back to painting the surface (`stud`, `plate`), so the kit
// also works on faces flush with the model's bounding box.

/** Proud voxel where the grid has room, else painted into the surface (if solid). */
export function stud(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  c: number,
  d = -1,
): void {
  const [x, y, z] = faceXYZ(face, at, u, v, d);
  if (m.grid.inBounds(x, y, z)) m.set(x, y, z, c);
  else facePaint(m, face, at, u, v, c);
}

/** Rect at depth d (default proud) with the same out-of-grid fallback as `stud`. */
export function plate(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  c: number,
  d = -1,
): void {
  for (let v = Math.min(v0, v1); v <= Math.max(v0, v1); v++)
    for (let u = Math.min(u0, u1); u <= Math.max(u0, u1); u++) stud(m, face, at, u, v, c, d);
}

/** Axis-aligned polyline in face coords (u, v, d). */
export function faceCable(m: Model, face: Face, at: number, pts: readonly Vec3[], c: number): void {
  cableRun(
    m,
    pts.map((p) => faceXYZ(face, at, p[0], p[1], p[2])),
    c,
  );
}

/** Model axis a face axis ("u" along the face, "v" up, "d" depth) maps to. */
function faceAxis(face: Face, a: "u" | "v" | "d"): Axis {
  if (face === "+y") return a === "u" ? "x" : a === "v" ? "z" : "y";
  if (a === "v") return "y";
  const zFace = face === "+z" || face === "-z";
  return a === "u" ? (zFace ? "x" : "z") : zFace ? "z" : "x";
}

/** `harness` with the polyline in face coords; cables fan out along a face axis. */
export function faceHarness(
  m: Model,
  face: Face,
  at: number,
  pts: readonly Vec3[],
  colors: readonly number[],
  spread: "u" | "v" | "d" = "u",
  connector: number = C.steel_dark,
  plug: number = C.chrome,
): void {
  harness(
    m,
    pts.map((p) => faceXYZ(face, at, p[0], p[1], p[2])),
    colors,
    faceAxis(face, spread),
    connector,
    plug,
  );
}

export interface HatchOpts {
  /** Panel colour (repaints the solid surface inside the seam). */
  panel?: number;
  screw?: number;
  /** Pull handle (default true). */
  handle?: boolean;
  /** Small paper inspection tag in the top-left corner. */
  tag?: boolean;
}

/** Bolted service hatch: carved seam outline, corner screws, pull handle. */
export function serviceHatch(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  o: HatchOpts = {},
): void {
  if (o.panel !== undefined)
    for (let v = v0 + 1; v < v1; v++)
      for (let u = u0 + 1; u < u1; u++) facePaint(m, face, at, u, v, o.panel);
  seam(m, face, at, u0, v0, u1, v0);
  seam(m, face, at, u0, v1, u1, v1);
  seam(m, face, at, u0, v0, u0, v1);
  seam(m, face, at, u1, v0, u1, v1);
  const s = o.screw ?? C.chrome;
  for (const [u, v] of [
    [u0 + 1, v0 + 1],
    [u1 - 1, v0 + 1],
    [u0 + 1, v1 - 1],
    [u1 - 1, v1 - 1],
  ] as const)
    stud(m, face, at, u, v, s);
  if (o.handle ?? true) {
    const uc = Math.round((u0 + u1) / 2);
    const vh = v1 - 3;
    plate(m, face, at, uc - 1, vh, uc + 1, vh, C.steel_dark);
  }
  if (o.tag && u1 - u0 >= 8) {
    plate(m, face, at, u0 + 3, v1 - 4, u0 + 5, v1 - 2, C.paper);
    stud(m, face, at, u0 + 4, v1 - 3, C.safety_red);
  }
}

export interface OpenHatchOpts {
  /** Cavity depth (default 3). */
  depth?: number;
  /** Door left ajar on the hinge side (needs two voxels of room in front of the face). */
  door?: "left" | "right";
  /** Door colour. */
  panel?: number;
}

/**
 * Access panel open: a cavity with a circuit board at the back (copper
 * traces, chips, a capacitor), a cable loop, empty screw holes around the
 * opening and, optionally, the door hanging ajar in front of one half.
 */
export function openHatch(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  o: OpenHatchOpts = {},
): void {
  const depth = o.depth ?? 3;
  for (let d = 0; d < depth; d++) faceRect(m, face, at, u0, v0, u1, v1, d, 0);
  for (let v = v0; v <= v1; v++)
    for (let u = u0; u <= u1; u++) {
      const n = hash3(u, v, at);
      faceSet(m, face, at, u, v, depth, (v - v0) % 3 === 1 && n < 0.7 ? C.copper : C.green_paint);
    }
  // Chips and a capacitor on the board, a cable loop across the cavity.
  for (let u = u0 + 1; u + 1 <= u1 - 1; u += 4)
    faceRect(m, face, at, u, v1 - 2, u + 1, v1 - 1, depth - 1, C.black);
  faceSet(m, face, at, u1 - 1, v0 + 1, depth - 1, C.safety_blue);
  faceSet(m, face, at, u1 - 1, v0 + 2, depth - 1, C.chrome);
  const vl = Math.round((v0 + v1) / 2);
  faceCable(
    m,
    face,
    at,
    [
      [u0, vl, depth - 1],
      [u0 + 1, vl, depth - 1],
      [u0 + 1, v0, depth - 1],
      [u1 - 2, v0, depth - 1],
    ],
    C.cable_red,
  );
  // Empty screw holes around the rim.
  for (const [u, v] of [
    [u0 - 1, v0 - 1],
    [u1 + 1, v0 - 1],
    [u0 - 1, v1 + 1],
    [u1 + 1, v1 + 1],
  ] as const)
    facePaint(m, face, at, u, v, C.black);
  if (o.door) {
    const c = o.panel ?? C.steel_dark;
    const half = Math.floor((u1 - u0) / 2);
    const [ha, hb] = o.door === "left" ? [u0 - 1, u0 + half - 1] : [u1 - half + 1, u1 + 1];
    const [fa, fb] = o.door === "left" ? [u0 + half, u0 + half + 2] : [u1 - half - 2, u1 - half];
    plate(m, face, at, ha, v0, hb, v1, c, -1);
    faceRect(m, face, at, fa, v0, fb, v1, -2, c);
    stud(m, face, at, o.door === "left" ? fb : fa, vl, C.steel, -3);
  }
}

export interface InletOpts {
  /** Plugged cable colour (drops to the floor); omit for an empty socket. */
  cable?: number;
  /** Rocker switch + pilot LED above the socket. */
  rocker?: boolean;
  /** Floor run of the cable along +u (negative: −u). */
  run?: number;
}

/** IEC-style power inlet (5×4 plate) with an optional plugged cable to the floor. */
export function powerInlet(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  o: InletOpts = {},
): void {
  plate(m, face, at, u, v, u + 4, v + 3, C.paint_black);
  if (o.cable !== undefined) {
    plate(m, face, at, u + 1, v + 1, u + 3, v + 2, C.rubber, -1);
    stud(m, face, at, u + 2, v + 1, o.cable, -2);
    const run = o.run ?? 3;
    faceCable(
      m,
      face,
      at,
      [
        [u + 2, v, -1],
        [u + 2, 0, -1],
        [u + 2 + run, 0, -1],
      ],
      o.cable,
    );
  } else {
    faceRect(m, face, at, u + 1, v + 1, u + 3, v + 2, 0, C.black);
    for (const uu of [u + 1, u + 3]) facePaint(m, face, at, uu, v + 2, C.chrome, 1);
  }
  if (o.rocker) {
    plate(m, face, at, u, v + 5, u + 2, v + 6, C.paint_black);
    stud(m, face, at, u + 1, v + 6, C.safety_red, -2);
    stud(m, face, at, u + 4, v + 6, C.led_red);
  }
}

/**
 * Row of network / data ports on a proud strip with a status LED over each.
 * `plugged[i]` is the cable colour in port i (0 = empty); plugged cables
 * drop straight down to the floor.
 */
export function portBank(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v: number,
  plugged: readonly number[],
  leds: readonly number[] = [C.led_green, C.led_amber],
): void {
  const n = plugged.length;
  const u1 = u0 + n * 3 - 2;
  plate(m, face, at, u0 - 1, v - 1, u1 + 1, v + 3, C.metal_dark);
  plugged.forEach((c, i) => {
    const u = u0 + i * 3;
    plate(m, face, at, u, v, u + 1, v + 1, C.black);
    stud(m, face, at, u + 1, v + 3, leds[i % leds.length]!);
    if (!c) return;
    stud(m, face, at, u, v, C.chrome, -1);
    stud(m, face, at, u + 1, v, c, -1);
    faceCable(
      m,
      face,
      at,
      [
        [u + 1, v - 2, -1],
        [u + 1, 0, -1],
      ],
      c,
    );
  });
}

export interface SerialOpts {
  bg?: number;
  ink?: number;
  /** Plate depth (default −1, proud; falls back to painted when there is no room). */
  d?: number;
  /** Barcode strip under the text. */
  barcode?: boolean;
  /** Minimum plate width (a text-less barcode tag needs one). */
  w?: number;
}

/**
 * Riveted maintenance plate with stencilled lines (e.g. ["UEC-001", "SN 0847"]; 4 voxels
 * per glyph, so small faces get ["0847"] or a text-less barcode tag with `w`).
 * (u0, v0) is the bottom corner on the reading-start side, as seen from outside.
 */
export function serialPlate(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  lines: readonly string[],
  o: SerialOpts = {},
): void {
  const bg = o.bg ?? C.aluminium;
  const ink = o.ink ?? C.paint_black;
  const d = o.d ?? -1;
  const w = Math.max(o.w ?? 0, ...lines.map((t) => stencilWidth(t) + 2));
  const bar = o.barcode ? 3 : 0;
  const h = Math.max(lines.length * 6 + 1, 2) + bar;
  const dir = face === "+x" || face === "-z" ? -1 : 1;
  const ua = dir > 0 ? u0 : u0 - w + 1;
  const ub = ua + w - 1;
  plate(m, face, at, ua, v0, ub, v0 + h - 1, bg, d);
  const [x, y, z] = faceXYZ(face, at, u0, v0, d);
  const dd = m.grid.inBounds(x, y, z) ? d : 0;
  lines.forEach((t, i) => {
    const vb = v0 + bar + 1 + (lines.length - 1 - i) * 6;
    stencil(m, face, at, dir > 0 ? ua + 1 : ub - 1, vb, t, ink, dd);
  });
  if (bar)
    for (let u = ua + 1; u <= ub - 1; u++)
      if (hash3(u, v0, at) < 0.55) plate(m, face, at, u, v0 + 1, u, v0 + 2, C.paint_black, dd);
  for (const u of [ua, ub])
    for (const v of [v0, v0 + h - 1]) plate(m, face, at, u, v, u, v, C.steel_dark, dd);
}

/** Yellow warning triangle (7×5) with a "!" (or a bolt when `volt`). Painted flush unless d < 0. */
export function warnSticker(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  volt = false,
  d = 0,
): void {
  const rows: readonly string[] = volt
    ? ["...Y...", "..KYY..", ".YYKYY.", ".YKYYY.", "YYYYKYY"]
    : ["...Y...", "..YKY..", ".YYKYY.", ".YYYYY.", "YYYKYYY"];
  rows.forEach((row, r) => {
    for (let k = 0; k < 7; k++) {
      const ch = row[k];
      if (ch === ".") continue;
      const c = ch === "K" ? C.hazard_black : C.safety_yellow;
      if (d === 0) facePaint(m, face, at, u + k, v + 4 - r, c);
      else stud(m, face, at, u + k, v + 4 - r, c, d);
    }
  });
}

/**
 * Taped paper note (7 wide): two scribbled lines, an optional single
 * stencilled glyph (e.g. a red "!") and masking tape across the top.
 */
export function tapedNote(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  glyph = "",
  ink: number = C.paint_navy,
  paper: number = C.paper,
): void {
  const h = glyph ? 10 : 6;
  plate(m, face, at, u, v, u + 6, v + h - 1, paper);
  for (const [vv, a, b] of [
    [v + h - 3, u + 1, u + 5],
    [v + h - 5, u + 1, u + 3],
  ] as const)
    for (let uu = a; uu <= b; uu++) if (hash3(uu, vv, at) < 0.8) stud(m, face, at, uu, vv, ink);
  if (glyph) {
    const dir = face === "+x" || face === "-z" ? -1 : 1;
    const [x, y, z] = faceXYZ(face, at, u, v, -1);
    const d = m.grid.inBounds(x, y, z) ? -1 : 0;
    stencil(m, face, at, dir > 0 ? u + 2 : u + 4, v + 1, glyph, C.safety_red, d);
  }
  plate(m, face, at, u - 1, v + h - 1, u + 1, v + h - 1, C.beige);
  plate(m, face, at, u + 5, v + h - 1, u + 7, v + h - 1, C.beige);
}

/** Coffee mug (3×3×3 + handle on +x) standing with its base at (x, y, z). */
export function mug(m: Model, x: number, y: number, z: number, c: number = C.ceramic): void {
  m.box(x, y, z, x + 2, y + 2, z + 2, c);
  m.set(x + 1, y + 2, z + 1, C.coffee);
  m.set(x + 3, y + 1, z + 1, c).set(x + 3, y + 2, z + 1, c);
}

/** Proud cooling fins every `step` along u over a dark backing (heat-sink look). */
export function coolingFins(
  m: Model,
  face: Face,
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  step = 2,
  c: number = C.aluminium,
  depth = 1,
): void {
  for (let v = v0; v <= v1; v++)
    for (let u = u0; u <= u1; u++) facePaint(m, face, at, u, v, C.metal_dark);
  for (let u = u0; u <= u1; u += step)
    for (let d = 1; d <= depth; d++) faceRect(m, face, at, u, v0, u, v1, -d, c);
}

/**
 * Round exhaust fan port on any face: carved well with a black floor, a
 * chrome finger guard (ring + cross) flush with the surface and a hub.
 */
export function fanPort(
  m: Model,
  face: Face,
  at: number,
  uc: number,
  vc: number,
  r: number,
  guard: number = C.chrome,
): void {
  for (let v = Math.floor(vc - r); v <= Math.ceil(vc + r); v++)
    for (let u = Math.floor(uc - r); u <= Math.ceil(uc + r); u++) {
      const dd = Math.hypot(u - uc, v - vc);
      if (dd > r + 0.3) continue;
      faceSet(m, face, at, u, v, 0, 0);
      faceSet(m, face, at, u, v, 1, 0);
      faceSet(m, face, at, u, v, 2, C.black);
      const ring = Math.abs(dd - r) < 0.6 || Math.abs(dd - r * 0.55) < 0.5;
      const cross = Math.abs(u - uc) < 0.6 || Math.abs(v - vc) < 0.6;
      if (ring || cross) faceSet(m, face, at, u, v, 0, guard);
      if (dd < 1.3) faceSet(m, face, at, u, v, 1, C.metal_dark);
    }
}

/**
 * Pipe leaving the face at (u, v): flange, a short run down the face at
 * depth d with a red valve wheel and a floor foot.
 */
export function pipeDrop(
  m: Model,
  face: Face,
  at: number,
  u: number,
  v: number,
  c: number = C.copper,
  flange: number = C.brass,
  d = -1,
): void {
  plate(m, face, at, u - 1, v - 1, u + 1, v + 1, flange, d);
  plate(m, face, at, u, 0, u, v - 2, c, d);
  const vm = Math.max(2, Math.round(v / 2));
  plate(m, face, at, u - 1, vm, u + 1, vm, C.safety_red, d);
  plate(m, face, at, u - 1, 0, u + 1, 0, flange, d);
}

// ── Motion classes ───────────────────────────────────────────────

/**
 * Kinds that move or hide geometry (rotation, translation or visibility),
 * i.e. read as motion even where emissive `intensity` is not applied.
 * `pulse` and `flicker` only modulate brightness.
 */
export const MOTION_KINDS: ReadonlySet<AnimKind> = new Set<AnimKind>([
  "spin",
  "bob",
  "blink",
  "sway",
  "orbit",
  "slide",
  "step",
  "piston",
  "wobble",
  "jitter",
  "sweep",
]);

/** True when the part visibly moves (or blinks) rather than only glowing. */
export function isMotionPart(part: AnimPart): boolean {
  return MOTION_KINDS.has(part.kind);
}

// ── Build staging (RAHMEN → KERN → KALIBRIERUNG) ─────────────────
//
// `stagedGrid` (core.ts) reveals a model bottom-up by height. The build
// phases below make the three device stages read as construction steps:
//   0 RAHMEN        frame: plinth rows, edges/corners and the hidden core mass
//   1 KERN          body: flat panel faces in the model's common colours
//   2 KALIBRIERUNG  detail: emissive voxels (LEDs, screens, glow) and rare
//                   accent colours (labels, screws, cables, stickers)

export type BuildPhase = 0 | 1 | 2;

/** Rows from the floor that always count as frame (plinths, feet). */
const FRAME_ROWS = 3;

/** A colour covering less than this share of the visible voxels is an accent. */
const ACCENT_SHARE = 0.03;

/** Build phase per cell (index = x + sx * (y + sy * z), 255 = empty). */
export function buildPhases(src: VoxelGrid): Uint8Array {
  const { sx, sy, sz } = src;
  const out = new Uint8Array(sx * sy * sz).fill(255);
  const exposedFaces = (x: number, y: number, z: number): number =>
    (src.get(x + 1, y, z) ? 0 : 1) +
    (src.get(x - 1, y, z) ? 0 : 1) +
    (src.get(x, y + 1, z) ? 0 : 1) +
    (src.get(x, y, z + 1) ? 0 : 1) +
    (src.get(x, y, z - 1) ? 0 : 1);
  const colourCount = new Map<number, number>();
  let visible = 0;
  src.forEach((x, y, z, v) => {
    if (!exposedFaces(x, y, z)) return;
    visible++;
    colourCount.set(v, (colourCount.get(v) ?? 0) + 1);
  });
  const accent = (v: number): boolean => (colourCount.get(v) ?? 0) < visible * ACCENT_SHARE;
  src.forEach((x, y, z, v) => {
    const i = x + sx * (y + sy * z);
    const e = exposedFaces(x, y, z);
    let phase: BuildPhase;
    if (labMaterialOf(v) === "emit" || (e > 0 && accent(v))) phase = 2;
    else if (y < FRAME_ROWS || e === 0 || e >= 3) phase = 0;
    else if (e === 2) {
      // Edge voxels: frame only when the two open faces are on different axes (a real edge).
      const ox = !src.get(x + 1, y, z) || !src.get(x - 1, y, z);
      const oz = !src.get(x, y, z + 1) || !src.get(x, y, z - 1);
      const oy = !src.get(x, y + 1, z);
      phase = (ox ? 1 : 0) + (oz ? 1 : 0) + (oy ? 1 : 0) >= 2 ? 0 : 1;
    } else phase = 1;
    out[i] = phase;
  });
  return out;
}

/**
 * Copy of `src` showing build progress by phase: with `fraction` f of the
 * stages done, phases below ⌊3f⌋ are solid, the next phase is solid
 * bottom-up for the remainder, everything else is a cyan blueprint ghost.
 * f = 1/3, 2/3, 1 → frame, frame + body, complete. Unpowered models get
 * dark emissives exactly like `stagedGrid`.
 */
export function stagedBuildGrid(src: VoxelGrid, fraction: number, powered: boolean): VoxelGrid {
  const f = Math.max(0, Math.min(1, fraction));
  const lit = stagedGrid(src, 1, powered);
  const phases = buildPhases(src);
  const whole = Math.floor(f * 3 + 1e-9);
  const rest = f * 3 - whole;
  // Cells of the partially built phase, bottom-up with a stable shuffle per layer.
  const partial: { i: number; k: number }[] = [];
  const { sx, sy } = src;
  src.forEach((x, y, z) => {
    const i = x + sx * (y + sy * z);
    if (phases[i] === whole) partial.push({ i, k: y + hash3(x, 0, z) * 0.999 });
  });
  partial.sort((a, b) => a.k - b.k);
  const solidPartial = new Set<number>();
  const n = Math.round(partial.length * rest);
  for (let j = 0; j < n; j++) solidPartial.add(partial[j]!.i);
  const out = new VoxelGrid(src.sx, src.sy, src.sz);
  for (let i = 0; i < src.data.length; i++) {
    const v = lit.data[i]!;
    if (!v) continue;
    const p = phases[i]!;
    out.data[i] = p < whole || solidPartial.has(i) ? v : C.ghost;
  }
  return out;
}

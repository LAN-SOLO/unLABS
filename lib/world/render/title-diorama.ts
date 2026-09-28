/**
 * Title-screen diorama.
 * =====================
 *
 * A small, self-contained three.js scene behind the main menu: a slice of the
 * Kontrollraum with the MCP-000 monolith, the UEC containment sphere, a few
 * decor pieces and Jade Lawrence idling (with fidgets) — all built from the
 * same procedural voxel models the game uses, animated with `animTransform`
 * and `animateCharacter`.
 *
 * Deliberately cheap: its own WebGLRenderer at pixel ratio ≤ 1, ~30 fps,
 * optional half-resolution bloom, one shadow-casting light, no instancing or
 * light pool. Pauses while the tab is hidden, holds the camera still under
 * `reduceMotion`, and frees every GPU resource in `dispose()`.
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
import { C } from "@/lib/world/content/palette";
import {
  animTransform,
  lightIntensity,
  lightPosInBase,
  partPivotInBase,
  type DeviceVisual,
} from "@/lib/world/models/anim";
import { MODEL_SCALE, Model, stagedGrid } from "@/lib/world/models/core";
import { decorModel, decorScale, decorVisual } from "@/lib/world/models/decor";
import { deviceVisual } from "@/lib/world/models/devices";
import {
  animateCharacter,
  jadeRig,
  jointRestPosition,
  poseTrack,
  type CharacterPose,
  type CharacterRigDef,
  type RigPartName,
} from "@/lib/world/models/rig";
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

// ── Pure layout & camera maths (unit-tested) ─────────────────────

export interface DioramaPlacement {
  kind: "device" | "decor";
  id: string;
  /** World units, floor centre = origin. */
  x: number;
  z: number;
  /** Yaw in radians. */
  rot: number;
  /** Devices: powered (animated, lit). */
  powered?: boolean;
}

/** Floor footprint (world units) — walls stand on the -x and -z edges. */
export const DIORAMA_FLOOR = { w: 30, d: 22 } as const;

export const DIORAMA_LAYOUT: readonly DioramaPlacement[] = [
  { kind: "device", id: "MCP-000", x: -3, z: -7.4, rot: 0, powered: true },
  { kind: "device", id: "UEC-001", x: 8.5, z: -4.5, rot: -0.55, powered: true },
  { kind: "decor", id: "gas_cylinders", x: -12.6, z: -9.2, rot: 0 },
  { kind: "decor", id: "crate_stack", x: -11.5, z: -3.5, rot: Math.PI / 2 },
  { kind: "decor", id: "reactor_coil", x: -10.5, z: 3.5, rot: 0 },
  { kind: "decor", id: "lab_table", x: 9.5, z: 5.5, rot: -Math.PI / 2 },
  { kind: "decor", id: "cable_loops", x: 3.5, z: -9.8, rot: 0 },
  { kind: "decor", id: "barrel", x: -7.5, z: -9.2, rot: 0 },
];

/** Where Jade stands: beside the MCP, turned into the room (three-quarter front view). */
export const DIORAMA_JADE = { x: 1.5, z: 1.5, rot: 0.4 } as const;

/** Camera yaw around the scene: a slow pendulum inside the open (+x, +z) quadrant. */
export function cameraYaw(t: number, reduceMotion: boolean): number {
  const base = Math.PI / 4;
  return reduceMotion ? base : base + 0.32 * Math.sin(t * 0.045);
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
export function dioramaFrustum(width: number, height: number, focusShift = 0.16): Frustum {
  const aspect = Math.max(0.3, width / Math.max(1, height));
  // Enough height for the monolith; widen on narrow screens so it still fits.
  const viewH = Math.max(30, 44 / aspect);
  const halfH = viewH / 2;
  const halfW = halfH * aspect;
  const shift = aspect > 1.2 ? focusShift * 2 * halfW : 0;
  return { left: -halfW - shift, right: halfW - shift, top: halfH, bottom: -halfH };
}

// ── Scene ────────────────────────────────────────────────────────

export interface TitleDioramaOptions {
  reduceMotion: boolean;
  bloom: boolean;
  /** Called when the GL context is lost (the UI falls back to the 2D backdrop). */
  onFail?: () => void;
}

interface PartView {
  pivot: THREE.Group;
  rest: THREE.Vector3;
  part: DeviceVisual["parts"][number];
}

interface Rig {
  parts: PartView[];
  lights: { light: THREE.PointLight; def: DeviceVisual["lights"][number] }[];
  scale: number;
  powered: boolean;
}

const FRAME_MS = 1000 / 30;
const LIGHT_GAIN = 0.55;

/** Mesh a grid refined 2×2×2 (same extent in source units, see models/refine.ts). */
function meshGrid(
  grid: VoxelGrid,
  materials: Record<MaterialClass, THREE.Material>,
  center: boolean,
  family: RefineFamily,
): THREE.Mesh {
  return toMesh(refinedModelMesh(grid, family, { center }), materials);
}

/** Lab floor slab: tiles with a grate strip and a few worn patches (world scale 1). */
function floorModel(): Model {
  const { w, d } = DIORAMA_FLOOR;
  const m = new Model(w, 1, d);
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++) {
      const grate = z === 13 || z === 14;
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
  return m;
}

/** Two low walls (back and left) with a trim line and a few status LEDs. */
function wallModels(): { back: Model; left: Model } {
  const { w, d } = DIORAMA_FLOOR;
  const H = 9;
  const back = new Model(w, H, 1);
  back.box(0, 0, 0, w - 1, H - 1, 0, C.wall);
  back.box(0, 0, 0, w - 1, 0, 0, C.wall_dark);
  back.box(0, 6, 0, w - 1, 6, 0, C.wall_trim);
  for (let x = 3; x < w - 2; x += 6) back.set(x, 7, 0, x % 12 === 3 ? C.led_amber : C.led_green);
  const left = new Model(1, H, d);
  left.box(0, 0, 0, 0, H - 1, d - 1, C.wall_dark);
  left.box(0, 6, 0, 0, 6, d - 1, C.wall_trim);
  left.box(0, 2, 6, 0, 4, 10, C.screen_green);
  return { back, left };
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

export class TitleDiorama {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  private readonly materials = createVoxelMaterials();
  private readonly extraMaterials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly rigs: Rig[] = [];
  private readonly screens: { mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  private readonly joints = new Map<RigPartName, { group: THREE.Group; rest: THREE.Vector3 }>();
  private readonly track = poseTrack("idle", 0);
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private motes: THREE.Points | null = null;
  private envTexture: THREE.Texture | null = null;
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
  }

  // ── Building ──────────────────────────────────────────────────

  private buildScene(): void {
    const scene = this.scene;
    scene.background = new THREE.Color("#050805");
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.envTexture;
    scene.environmentIntensity = 0.22;

    scene.add(new THREE.HemisphereLight("#9fb4d8", "#241c14", 0.4));
    const fill = new THREE.DirectionalLight("#fff1dc", 0.35);
    fill.position.set(30, 50, 20);
    scene.add(fill);
    const key = new THREE.SpotLight("#ffe6c4", 22, 0, Math.PI / 4.2, 0.7, 1);
    key.position.set(6, 34, 14);
    key.target.position.set(0, 0, -3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.05;
    key.shadow.camera.near = 10;
    key.shadow.camera.far = 70;
    scene.add(key, key.target);
    // The MCP's red eye washes the floor in front of it.
    const eye = new THREE.PointLight("#ff2a1a", 10, 18, 1.4);
    eye.position.set(-3, 7, -3);
    scene.add(eye);

    const { w, d } = DIORAMA_FLOOR;
    const floor = meshGrid(floorModel().grid, this.materials, false, "terrain");
    floor.position.set(-w / 2, -1, -d / 2);
    floor.castShadow = false;
    scene.add(floor);
    const walls = wallModels();
    const back = meshGrid(walls.back.grid, this.materials, false, "architecture");
    back.position.set(-w / 2, 0, -d / 2 - 1);
    const left = meshGrid(walls.left.grid, this.materials, false, "architecture");
    left.position.set(-w / 2 - 1, 0, -d / 2);
    scene.add(back, left);

    const scan = scanlineTexture();
    if (scan) this.textures.push(scan);
    for (const p of DIORAMA_LAYOUT) {
      const group = new THREE.Group();
      group.position.set(p.x, 0, p.z);
      group.rotation.y = p.rot;
      if (p.kind === "device") {
        this.addVisual(group, deviceVisual(p.id), p.powered ?? true, scan);
      } else {
        const visual = decorVisual(p.id);
        if (visual)
          this.addVisual(group, visual, true, scan, decorFamily(visual.scale ?? decorScale(p.id)));
        else {
          const mesh = meshGrid(
            decorModel(p.id).grid,
            this.materials,
            true,
            decorFamily(decorScale(p.id)),
          );
          mesh.scale.setScalar(decorScale(p.id));
          group.add(mesh);
        }
      }
      scene.add(group);
    }
    this.addJade(jadeRig());
    this.addMotes();
  }

  private addVisual(
    group: THREE.Group,
    visual: DeviceVisual,
    powered: boolean,
    scan: THREE.Texture | null,
    family: RefineFamily = "device",
  ): void {
    const sc = visual.scale ?? MODEL_SCALE;
    const base = meshGrid(visual.base.grid, this.materials, true, family);
    base.scale.setScalar(sc);
    group.add(base);
    const rig: Rig = { parts: [], lights: [], scale: sc, powered };
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
    for (const def of visual.lights) {
      const light = new THREE.PointLight(def.color, 0, def.distance, 2);
      const lp = lightPosInBase(visual.base, def);
      light.position.set(lp[0] * sc, lp[1] * sc, lp[2] * sc);
      group.add(light);
      rig.lights.push({ light, def });
    }
    for (const spec of visual.screens ?? []) {
      if (spec.requiresPower && !powered) continue;
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(spec.color ?? "#33FF33").multiplyScalar(1.6),
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
      this.screens.push({ mat, phase: this.screens.length * 1.7 });
    }
    this.rigs.push(rig);
  }

  private addJade(def: CharacterRigDef): void {
    const root = new THREE.Group();
    root.position.set(DIORAMA_JADE.x, 0, DIORAMA_JADE.z);
    root.rotation.y = DIORAMA_JADE.rot;
    const inner = new THREE.Group();
    inner.scale.setScalar(def.scale);
    root.add(inner);
    for (const part of def.parts) {
      const j = new THREE.Group();
      const rp = jointRestPosition(def, part);
      j.position.set(rp[0], rp[1], rp[2]);
      const mesh = meshGrid(part.model.grid, this.materials, false, familyFor(def, "character"));
      mesh.position.set(-part.origin[0], -part.origin[1], -part.origin[2]);
      j.add(mesh);
      const parent = part.parent ? this.joints.get(part.parent)?.group : undefined;
      (parent ?? inner).add(j);
      this.joints.set(part.name, { group: j, rest: j.position.clone() });
    }
    this.scene.add(root);
  }

  /** Slow dust motes in the key light. */
  private addMotes(): void {
    const n = 90;
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
    this.draw();
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
    this.time += dt;
    this.draw();
  };

  private placeCamera(): void {
    const yaw = cameraYaw(this.time, this.opts.reduceMotion);
    const dist = 80;
    const pitch = 0.62;
    const target = new THREE.Vector3(0, 3.5, -2);
    this.camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.camera.lookAt(target);
  }

  private animate(): void {
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
    }
    for (const s of this.screens) {
      const tex = s.mat.map;
      if (tex && !this.opts.reduceMotion) tex.offset.y = (t * 0.08 + s.phase) % 1;
    }
    const pose: CharacterPose = animateCharacter({
      track: this.track,
      now: t,
      gaitPhase: 0,
      speed: 0,
      walkW: 0,
      idleFor: t + 2,
      seed: 3,
    });
    for (const [name, j] of this.joints) {
      const pp = pose[name];
      if (!pp) continue;
      j.group.rotation.set(pp.rot[0], pp.rot[1], pp.rot[2]);
      j.group.position.set(
        j.rest.x + (pp.pos?.[0] ?? 0),
        j.rest.y + (pp.pos?.[1] ?? 0),
        j.rest.z + (pp.pos?.[2] ?? 0),
      );
    }
    if (this.motes && !this.opts.reduceMotion) {
      this.motes.position.y = Math.sin(t * 0.2) * 0.6;
      this.motes.rotation.y = t * 0.01;
    }
  }

  private draw(): void {
    if (this.disposed) return;
    this.placeCamera();
    this.animate();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
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
    for (const m of Object.values(this.materials)) m.dispose();
    for (const m of this.extraMaterials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.envTexture?.dispose();
    this.composer?.dispose();
    this.bloomPass?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.scene.clear();
  }
}

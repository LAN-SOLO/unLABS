/**
 * FxSystem — pooled particle bursts and effects for the lab engine.
 * =================================================================
 *
 * Budget-friendly: two `THREE.Points` pools (additive glow + soft smoke)
 * simulated on the CPU with fixed-size typed arrays, a handful of pooled
 * ring and beam meshes, and two point lights that are always in the scene
 * (intensity 0 when unused, so the shader program never recompiles).
 *
 * All sizes are in world units (voxels); the point shader converts them
 * to pixels from the orthographic camera every frame.
 */
import * as THREE from "three";

export const FX_KINDS = [
  "sparks",
  "build_sparkle",
  "steam",
  "dust",
  "wisps",
  "teleport",
  "rift_pulse",
  "explosion",
  "pickup_glint",
  "insight_ring",
  "power_wave",
  "footstep_dust",
  "alarm",
  "power_on",
  "heat_shimmer",
  "craft_glow",
  "unlock",
  "assemble",
] as const;
export type FxKind = (typeof FX_KINDS)[number];

export const AMBIENT_KINDS = ["dust", "wisps", "steam", "embers", "motes"] as const;
export type AmbientKind = (typeof AMBIENT_KINDS)[number];

export interface FxOptions {
  /** Override the effect colour (CSS string or 0xRRGGBB). */
  color?: string | number;
  /** Size multiplier (radius of rings, spread of bursts). */
  scale?: number;
  /** Particle count multiplier. */
  count?: number;
  /** Seconds, for lasting effects (alarm, wisps). */
  duration?: number;
}

export interface RoomRect {
  x: number;
  z: number;
  w: number;
  d: number;
  /** Floor height (default 1). */
  y?: number;
  /** Vertical extent (default 7). */
  h?: number;
}

const COLORS = {
  cyan: 0x00ffff,
  amber: 0xffb800,
  green: 0x33ff33,
  violet: 0xb060ff,
  white: 0xfff4e0,
  spark: 0xffc46b,
  smoke: 0x6f747c,
  steam: 0xd8e2ea,
  dust: 0xc9b99a,
  alarm: 0xff2a1a,
} as const;

// ── Particle pool ─────────────────────────────────────────────────

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize > 0.0 ? max(1.0, aSize * uScale) : 0.0;
}`;

const FRAG = /* glsl */ `
uniform float uSoft;
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0 || vAlpha <= 0.0) discard;
  gl_FragColor = vec4(vColor, vAlpha * pow(1.0 - d, uSoft));
}`;

interface SpawnSpec {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  size0: number;
  size1: number;
  alpha: number;
  color: THREE.Color;
  drag?: number;
  gravity?: number;
  /** Random velocity jitter per second (wisps, smoke). */
  turb?: number;
}

class ParticlePool {
  readonly points: THREE.Points;
  private readonly geo = new THREE.BufferGeometry();
  private readonly mat: THREE.ShaderMaterial;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly vel: Float32Array;
  /** life, max, size0, size1, alpha0, drag, gravity, turb */
  private readonly meta: Float32Array;
  private cursor = 0;
  private alive = 0;
  private high = 0;

  constructor(
    readonly capacity: number,
    blending: THREE.Blending,
    soft: number,
  ) {
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.meta = new Float32Array(capacity * 8);
    const dyn = (arr: Float32Array, n: number) =>
      new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute("position", dyn(this.pos, 3));
    this.geo.setAttribute("aColor", dyn(this.col, 3));
    this.geo.setAttribute("aSize", dyn(this.size, 1));
    this.geo.setAttribute("aAlpha", dyn(this.alpha, 1));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 10 }, uSoft: { value: soft } },
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    const tmp = new THREE.Vector2();
    this.points.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(tmp);
      let unitsHigh = 40;
      if (camera instanceof THREE.OrthographicCamera) {
        unitsHigh = (camera.top - camera.bottom) / camera.zoom;
      }
      this.mat.uniforms.uScale!.value = tmp.y / Math.max(1, unitsHigh);
    };
  }

  get count(): number {
    return this.alive;
  }

  spawn(s: SpawnSpec): void {
    let i = -1;
    for (let k = 0; k < this.capacity; k++) {
      const j = (this.cursor + k) % this.capacity;
      if (this.meta[j * 8 + 1] === 0) {
        i = j;
        break;
      }
    }
    if (i < 0)
      i = this.cursor; // pool full: recycle the oldest slot
    else this.alive++;
    this.cursor = (i + 1) % this.capacity;
    this.pos[i * 3] = s.x;
    this.pos[i * 3 + 1] = s.y;
    this.pos[i * 3 + 2] = s.z;
    this.vel[i * 3] = s.vx;
    this.vel[i * 3 + 1] = s.vy;
    this.vel[i * 3 + 2] = s.vz;
    this.col[i * 3] = s.color.r;
    this.col[i * 3 + 1] = s.color.g;
    this.col[i * 3 + 2] = s.color.b;
    const m = i * 8;
    this.meta[m] = 0;
    this.meta[m + 1] = Math.max(0.05, s.life);
    this.meta[m + 2] = s.size0;
    this.meta[m + 3] = s.size1;
    this.meta[m + 4] = s.alpha;
    this.meta[m + 5] = s.drag ?? 0;
    this.meta[m + 6] = s.gravity ?? 0;
    this.meta[m + 7] = s.turb ?? 0;
    this.size[i] = s.size0;
    this.alpha[i] = 0;
    if (i + 1 > this.high) this.high = i + 1;
  }

  update(dt: number, rnd: () => number): void {
    if (this.alive === 0) return;
    let high = 0;
    for (let i = 0; i < this.high; i++) {
      const m = i * 8;
      const max = this.meta[m + 1]!;
      if (max === 0) continue;
      const life = this.meta[m]! + dt;
      if (life >= max) {
        this.meta[m + 1] = 0;
        this.alpha[i] = 0;
        this.size[i] = 0;
        this.alive--;
        continue;
      }
      this.meta[m] = life;
      high = i + 1;
      const drag = Math.max(0, 1 - this.meta[m + 5]! * dt);
      const turb = this.meta[m + 7]!;
      const v = i * 3;
      let vx = this.vel[v]! * drag;
      let vy = this.vel[v + 1]! * drag - this.meta[m + 6]! * dt;
      let vz = this.vel[v + 2]! * drag;
      if (turb > 0) {
        vx += (rnd() - 0.5) * turb * dt;
        vy += (rnd() - 0.5) * turb * dt * 0.5;
        vz += (rnd() - 0.5) * turb * dt;
      }
      this.vel[v] = vx;
      this.vel[v + 1] = vy;
      this.vel[v + 2] = vz;
      this.pos[v] = this.pos[v]! + vx * dt;
      this.pos[v + 1] = Math.max(1.02, this.pos[v + 1]! + vy * dt);
      this.pos[v + 2] = this.pos[v + 2]! + vz * dt;
      const t = life / max;
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      this.alpha[i] = this.meta[m + 4]! * fade;
      this.size[i] = this.meta[m + 2]! + (this.meta[m + 3]! - this.meta[m + 2]!) * t;
    }
    this.high = high;
    if (this.alive < 0) this.alive = 0;
    this.geo.setDrawRange(0, high);
    for (const name of ["position", "aColor", "aSize", "aAlpha"]) {
      const attr = this.geo.getAttribute(name) as THREE.BufferAttribute;
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, high * attr.itemSize);
      attr.needsUpdate = true;
    }
  }

  clear(): void {
    this.meta.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
    this.alive = 0;
    this.high = 0;
    this.geo.setDrawRange(0, 0);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ── Pooled meshes ─────────────────────────────────────────────────

interface Anim {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
  dur: number;
  r0: number;
  r1: number;
  alpha: number;
  height: number;
  busy: boolean;
}

interface Flash {
  light: THREE.PointLight;
  t: number;
  dur: number;
  peak: number;
  pulse: number;
  busy: boolean;
}

interface Emitter {
  id: number;
  rect: RoomRect;
  kind: AmbientKind;
  rate: number;
  acc: number;
  /** Paused emitters keep their slot but spawn nothing (e.g. motes in dark rooms). */
  enabled: boolean;
  color?: THREE.Color;
}

export class FxSystem {
  private readonly root = new THREE.Group();
  private readonly glow: ParticlePool;
  private readonly soft: ParticlePool;
  private readonly rings: Anim[] = [];
  private readonly beams: Anim[] = [];
  private readonly flashes: Flash[] = [];
  private readonly emitters: Emitter[] = [];
  private readonly ringGeo = new THREE.RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2);
  private readonly beamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
  private readonly tmpColor = new THREE.Color();
  private density = 1;
  /** Reduced flicker: flash lights are dimmer and never strobe. */
  private calm = false;
  private nextEmitter = 1;
  private seed = 0x2f6b1d;
  private readonly rnd = (): number => {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  };

  constructor(
    private readonly scene: THREE.Scene,
    opts: { glowCapacity?: number; softCapacity?: number } = {},
  ) {
    this.root.name = "fx";
    this.glow = new ParticlePool(opts.glowCapacity ?? 1536, THREE.AdditiveBlending, 1.6);
    this.soft = new ParticlePool(opts.softCapacity ?? 512, THREE.NormalBlending, 1.2);
    this.root.add(this.soft.points, this.glow.points);
    for (let i = 0; i < 10; i++) this.rings.push(this.makeAnim(this.ringGeo));
    for (let i = 0; i < 3; i++) this.beams.push(this.makeAnim(this.beamGeo));
    for (let i = 0; i < 2; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 28, 1.6);
      light.visible = true;
      this.root.add(light);
      this.flashes.push({ light, t: 0, dur: 0, peak: 0, pulse: 0, busy: false });
    }
    scene.add(this.root);
  }

  /** 0..1 — scales particle counts and ambient emission (quality setting). */
  setDensity(d: number): void {
    this.density = Math.min(1, Math.max(0, d));
  }

  /** Reduced-flicker mode (accessibility): softer flashes, no strobing alarm. */
  setCalm(calm: boolean): void {
    this.calm = calm;
  }

  /** Show/hide everything (e.g. while switching floors). */
  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  /** Live particle count (for debugging / tests). */
  get particleCount(): number {
    return this.glow.count + this.soft.count;
  }

  emit(kind: FxKind, pos: THREE.Vector3, opts: FxOptions = {}): void {
    const sc = opts.scale ?? 1;
    const n = (base: number) => Math.round(base * this.density * (opts.count ?? 1));
    const color = (fallback: number) => this.tmpColor.set(opts.color ?? fallback);
    const r = this.rnd;
    switch (kind) {
      case "sparks": {
        const c = color(COLORS.spark).clone();
        for (let i = 0; i < n(26); i++) {
          const a = r() * Math.PI * 2;
          const sp = (3 + r() * 7) * sc;
          this.glow.spawn({
            x: pos.x,
            y: pos.y,
            z: pos.z,
            vx: Math.cos(a) * sp,
            vy: 2 + r() * 6,
            vz: Math.sin(a) * sp,
            life: 0.35 + r() * 0.5,
            size0: 0.35,
            size1: 0.08,
            alpha: 1,
            color: c,
            drag: 1.5,
            gravity: 18,
          });
        }
        this.flash(pos, c, 12, 0.18);
        break;
      }
      case "build_sparkle": {
        const c = color(COLORS.cyan).clone();
        for (let i = 0; i < n(40); i++) {
          const a = r() * Math.PI * 2;
          const rad = (0.5 + r() * 2.5) * sc;
          this.glow.spawn({
            x: pos.x + Math.cos(a) * rad,
            y: pos.y + r() * 1.5,
            z: pos.z + Math.sin(a) * rad,
            vx: 0,
            vy: 1.5 + r() * 2.5,
            vz: 0,
            life: 1 + r() * 1.2,
            size0: 0.45,
            size1: 0.1,
            alpha: 0.9,
            color: c,
            turb: 2,
          });
        }
        this.ring(pos, 0.5 * sc, 3.5 * sc, 0.8, c, 0.7);
        break;
      }
      case "steam": {
        const c = color(COLORS.steam).clone();
        for (let i = 0; i < n(18); i++) {
          this.soft.spawn({
            x: pos.x + (r() - 0.5) * sc,
            y: pos.y,
            z: pos.z + (r() - 0.5) * sc,
            vx: (r() - 0.5) * 1.2,
            vy: 2.5 + r() * 2,
            vz: (r() - 0.5) * 1.2,
            life: 1.4 + r() * 1,
            size0: 0.8 * sc,
            size1: 3 * sc,
            alpha: 0.28,
            color: c,
            drag: 0.8,
            turb: 3,
          });
        }
        break;
      }
      case "dust":
      case "footstep_dust": {
        const small = kind === "footstep_dust";
        const c = color(COLORS.dust).clone();
        for (let i = 0; i < n(small ? 5 : 16); i++) {
          const a = r() * Math.PI * 2;
          const sp = (small ? 0.8 : 2) * (0.5 + r()) * sc;
          this.soft.spawn({
            x: pos.x,
            y: pos.y + 0.1,
            z: pos.z,
            vx: Math.cos(a) * sp,
            vy: 0.3 + r() * (small ? 0.4 : 1.2),
            vz: Math.sin(a) * sp,
            life: small ? 0.5 + r() * 0.3 : 1 + r() * 0.8,
            size0: small ? 0.3 : 0.6,
            size1: small ? 0.8 : 2,
            alpha: small ? 0.25 : 0.35,
            color: c,
            drag: 3,
          });
        }
        break;
      }
      case "wisps": {
        const c = color(COLORS.violet).clone();
        const life = opts.duration ?? 2.5;
        for (let i = 0; i < n(14); i++) {
          this.glow.spawn({
            x: pos.x + (r() - 0.5) * 3 * sc,
            y: pos.y + r() * 2,
            z: pos.z + (r() - 0.5) * 3 * sc,
            vx: (r() - 0.5) * 0.8,
            vy: 0.4 + r() * 0.8,
            vz: (r() - 0.5) * 0.8,
            life: life * (0.6 + r() * 0.6),
            size0: 0.8,
            size1: 0.2,
            alpha: 0.7,
            color: c,
            turb: 4,
          });
        }
        break;
      }
      case "teleport": {
        const c = color(COLORS.cyan).clone();
        this.beam(pos, 2.4 * sc, 18, 1.8, c);
        this.ring(pos, 0.3, 4 * sc, 1, c, 0.9);
        for (let i = 0; i < n(50); i++) {
          const a = r() * Math.PI * 2;
          const rad = r() * 2 * sc;
          this.glow.spawn({
            x: pos.x + Math.cos(a) * rad,
            y: pos.y + r() * 2,
            z: pos.z + Math.sin(a) * rad,
            vx: 0,
            vy: 4 + r() * 8,
            vz: 0,
            life: 0.8 + r() * 0.8,
            size0: 0.4,
            size1: 0.1,
            alpha: 1,
            color: c,
          });
        }
        this.flash(pos, c, 40, 0.9);
        break;
      }
      case "rift_pulse": {
        const c = color(COLORS.violet).clone();
        this.ring(pos, 1, 9 * sc, 1.4, c, 0.8);
        this.ring(pos, 0.5, 5 * sc, 1.1, this.tmpColor.set(COLORS.white).clone(), 0.5);
        for (let i = 0; i < n(30); i++) {
          const a = r() * Math.PI * 2;
          const sp = 2 + r() * 4;
          this.glow.spawn({
            x: pos.x,
            y: pos.y + 1 + r() * 4,
            z: pos.z,
            vx: Math.cos(a) * sp,
            vy: (r() - 0.5) * 2,
            vz: Math.sin(a) * sp,
            life: 1 + r() * 0.8,
            size0: 0.6,
            size1: 0.15,
            alpha: 0.85,
            color: c,
            drag: 1.2,
            turb: 3,
          });
        }
        this.flash(pos, c, 30, 0.6);
        break;
      }
      case "explosion": {
        const hot = color(COLORS.spark).clone();
        const smoke = this.tmpColor.set(COLORS.smoke).clone();
        for (let i = 0; i < n(60); i++) {
          const a = r() * Math.PI * 2;
          const el = r() * Math.PI * 0.5;
          const sp = (6 + r() * 12) * sc;
          this.glow.spawn({
            x: pos.x,
            y: pos.y + 0.5,
            z: pos.z,
            vx: Math.cos(a) * Math.cos(el) * sp,
            vy: Math.sin(el) * sp + 3,
            vz: Math.sin(a) * Math.cos(el) * sp,
            life: 0.4 + r() * 0.7,
            size0: 0.5,
            size1: 0.1,
            alpha: 1,
            color: hot,
            drag: 2,
            gravity: 14,
          });
        }
        for (let i = 0; i < n(26); i++) {
          const a = r() * Math.PI * 2;
          const sp = (1 + r() * 3) * sc;
          this.soft.spawn({
            x: pos.x,
            y: pos.y + 0.5 + r(),
            z: pos.z,
            vx: Math.cos(a) * sp,
            vy: 1.5 + r() * 2.5,
            vz: Math.sin(a) * sp,
            life: 1.6 + r() * 1.4,
            size0: 1.5 * sc,
            size1: 5 * sc,
            alpha: 0.45,
            color: smoke,
            drag: 1,
            turb: 2,
          });
        }
        this.ring(pos, 0.5, 7 * sc, 0.5, hot, 1);
        this.flash(pos, hot, 120, 0.5);
        break;
      }
      case "pickup_glint": {
        const c = color(COLORS.amber).clone();
        for (let i = 0; i < n(12); i++) {
          const a = (i / 12) * Math.PI * 2;
          this.glow.spawn({
            x: pos.x,
            y: pos.y + 1,
            z: pos.z,
            vx: Math.cos(a) * 2.5,
            vy: 1.5 + r() * 2,
            vz: Math.sin(a) * 2.5,
            life: 0.5 + r() * 0.3,
            size0: 0.5,
            size1: 0.05,
            alpha: 1,
            color: c,
            drag: 3,
          });
        }
        this.glow.spawn({
          x: pos.x,
          y: pos.y + 1.2,
          z: pos.z,
          vx: 0,
          vy: 0.5,
          vz: 0,
          life: 0.35,
          size0: 2.2,
          size1: 0.4,
          alpha: 1,
          color: this.tmpColor.set(COLORS.white).clone(),
        });
        break;
      }
      case "insight_ring": {
        const c = color(COLORS.green).clone();
        this.ring(pos, 0.5, 6 * sc, 1.3, c, 0.9);
        this.ring(pos, 0.2, 3.5 * sc, 1.0, c, 0.6);
        break;
      }
      case "power_wave": {
        const c = color(COLORS.amber).clone();
        this.ring(pos, 1, 70 * sc, 2.6, c, 0.8);
        this.ring(pos, 0.5, 40 * sc, 2.0, this.tmpColor.set(COLORS.white).clone(), 0.5);
        this.flash(pos, c, 50, 0.8);
        break;
      }
      case "alarm": {
        this.flash(pos, color(COLORS.alarm).clone(), 45, opts.duration ?? 4, 2.2);
        break;
      }
      case "power_on": {
        // A device comes online: a quick upward beam, a floor ring, a few
        // motes rising off the casing and one soft flash.
        const c = color(COLORS.cyan).clone();
        this.beam(pos, 0.9 * sc, 7 * sc, 0.7, c);
        this.ring(pos, 0.4, 4.5 * sc, 0.9, c, 0.7);
        for (let i = 0; i < n(18); i++) {
          const a = r() * Math.PI * 2;
          const rad = (0.6 + r() * 1.4) * sc;
          this.glow.spawn({
            x: pos.x + Math.cos(a) * rad,
            y: pos.y + r() * 2 * sc,
            z: pos.z + Math.sin(a) * rad,
            vx: 0,
            vy: 1.5 + r() * 2.5,
            vz: 0,
            life: 0.6 + r() * 0.6,
            size0: 0.35,
            size1: 0.05,
            alpha: 0.9,
            color: c,
            drag: 1,
          });
        }
        this.flash(pos, c, 22, 0.45);
        break;
      }
      case "craft_glow": {
        // Something came off the workbench: a soft bloom over the bench top,
        // a ring on the floor and a few motes lifting off the result.
        const c = color(COLORS.amber).clone();
        this.glow.spawn({
          x: pos.x,
          y: pos.y + 0.4,
          z: pos.z,
          vx: 0,
          vy: 0.3,
          vz: 0,
          life: 0.5,
          size0: 3.2 * sc,
          size1: 0.6 * sc,
          alpha: 0.85,
          color: c,
        });
        for (let i = 0; i < n(22); i++) {
          const a = r() * Math.PI * 2;
          const rad = (0.2 + r() * 1.2) * sc;
          this.glow.spawn({
            x: pos.x + Math.cos(a) * rad,
            y: pos.y + r() * 0.5,
            z: pos.z + Math.sin(a) * rad,
            vx: Math.cos(a) * 0.6,
            vy: 1.2 + r() * 2.2,
            vz: Math.sin(a) * 0.6,
            life: 0.6 + r() * 0.7,
            size0: 0.4,
            size1: 0.05,
            alpha: 0.95,
            color: c,
            drag: 1.2,
            turb: 1.5,
          });
        }
        this.ring(pos, 0.3, 2.8 * sc, 0.7, c, 0.6);
        this.flash(pos, c, 26, 0.5);
        break;
      }
      case "unlock": {
        // A lock gives: a quick green spit of sparks off the beacon and a small flash.
        const c = color(COLORS.green).clone();
        for (let i = 0; i < n(10); i++) {
          const a = r() * Math.PI * 2;
          const sp = (1.5 + r() * 2.5) * sc;
          this.glow.spawn({
            x: pos.x,
            y: pos.y,
            z: pos.z,
            vx: Math.cos(a) * sp,
            vy: 0.5 + r() * 2,
            vz: Math.sin(a) * sp,
            life: 0.3 + r() * 0.3,
            size0: 0.3,
            size1: 0.05,
            alpha: 1,
            color: c,
            drag: 2.5,
            gravity: 6,
          });
        }
        this.flash(pos, c, 14, 0.35);
        break;
      }
      case "assemble": {
        // Build stage lands: motes converge onto the model from a wide ring,
        // plus a floor ring where it touches down.
        const c = color(COLORS.cyan).clone();
        for (let i = 0; i < n(24); i++) {
          const a = r() * Math.PI * 2;
          const rad = (1.5 + r() * 1.5) * sc;
          const life = 0.45 + r() * 0.25;
          this.glow.spawn({
            x: pos.x + Math.cos(a) * rad,
            y: pos.y + r() * 2.5 * sc,
            z: pos.z + Math.sin(a) * rad,
            vx: (-Math.cos(a) * rad) / life,
            vy: 0,
            vz: (-Math.sin(a) * rad) / life,
            life,
            size0: 0.12,
            size1: 0.4,
            alpha: 0.9,
            color: c,
          });
        }
        this.ring(pos, 2.5 * sc, 0.4, 0.5, c, 0.6);
        break;
      }
      case "heat_shimmer": {
        // Overheating device: pale, wobbling puffs rising off the top plus a
        // couple of dull embers — reads as heat haze in the ortho view.
        const haze = this.tmpColor.set(opts.color ?? 0xffe2c4).clone();
        for (let i = 0; i < n(6); i++) {
          this.soft.spawn({
            x: pos.x + (r() - 0.5) * 1.6 * sc,
            y: pos.y,
            z: pos.z + (r() - 0.5) * 1.6 * sc,
            vx: (r() - 0.5) * 0.3,
            vy: 1.2 + r() * 0.8,
            vz: (r() - 0.5) * 0.3,
            life: 1.2 + r() * 0.8,
            size0: 0.6 * sc,
            size1: 1.8 * sc,
            alpha: 0.1,
            color: haze,
            turb: 3,
          });
        }
        const ember = this.tmpColor.set(COLORS.spark).clone();
        for (let i = 0; i < n(3); i++) {
          this.glow.spawn({
            x: pos.x + (r() - 0.5) * sc,
            y: pos.y,
            z: pos.z + (r() - 0.5) * sc,
            vx: (r() - 0.5) * 0.4,
            vy: 1 + r(),
            vz: (r() - 0.5) * 0.4,
            life: 0.8 + r() * 0.6,
            size0: 0.22,
            size1: 0.04,
            alpha: 0.7,
            color: ember,
            turb: 1.5,
          });
        }
        break;
      }
    }
  }

  /**
   * Continuous ambient particles inside a room rectangle. Returns a
   * handle for `clearAmbient()`; call `clearAmbient()` on floor change.
   */
  ambient(
    rect: RoomRect,
    kind: AmbientKind,
    rate?: number,
    opts: { enabled?: boolean; color?: string | number } = {},
  ): number {
    const id = this.nextEmitter++;
    const area = Math.max(1, rect.w * rect.d);
    const base =
      kind === "dust"
        ? area / 90
        : kind === "wisps"
          ? area / 160
          : kind === "motes"
            ? Math.min(8, area / 110)
            : area / 120;
    const e: Emitter = {
      id,
      rect,
      kind,
      rate: rate ?? Math.min(20, base),
      acc: 0,
      enabled: opts.enabled ?? true,
    };
    if (opts.color !== undefined) e.color = new THREE.Color(opts.color);
    this.emitters.push(e);
    return id;
  }

  /** Pause / resume one ambient emitter (particles already alive keep drifting). */
  setAmbientEnabled(handle: number, enabled: boolean): void {
    const e = this.emitters.find((x) => x.id === handle);
    if (e) {
      e.enabled = enabled;
      if (!enabled) e.acc = 0;
    }
  }

  /** Number of ambient emitters currently spawning (debug counter). */
  get activeEmitters(): number {
    let n = 0;
    for (const e of this.emitters) if (e.enabled) n++;
    return n;
  }

  clearAmbient(handle?: number): void {
    if (handle === undefined) this.emitters.length = 0;
    else {
      const i = this.emitters.findIndex((e) => e.id === handle);
      if (i >= 0) this.emitters.splice(i, 1);
    }
  }

  /** Remove every running effect (not the ambient emitters). */
  clear(): void {
    this.glow.clear();
    this.soft.clear();
    for (const a of [...this.rings, ...this.beams]) {
      a.busy = false;
      a.mesh.visible = false;
    }
    for (const f of this.flashes) {
      f.busy = false;
      f.light.intensity = 0;
    }
  }

  update(dt: number): void {
    const step = Math.min(dt, 0.1);
    for (const e of this.emitters) this.runEmitter(e, step);
    this.glow.update(step, this.rnd);
    this.soft.update(step, this.rnd);
    for (const a of this.rings) {
      if (!a.busy) continue;
      a.t += step;
      const k = Math.min(1, a.t / a.dur);
      const ease = 1 - Math.pow(1 - k, 2.2);
      const rad = a.r0 + (a.r1 - a.r0) * ease;
      a.mesh.scale.set(rad, 1, rad);
      a.mat.opacity = a.alpha * (1 - k);
      if (k >= 1) {
        a.busy = false;
        a.mesh.visible = false;
      }
    }
    for (const a of this.beams) {
      if (!a.busy) continue;
      a.t += step;
      const k = Math.min(1, a.t / a.dur);
      const grow = Math.min(1, k * 5);
      const rad = a.r0 * (1 - k * 0.85);
      a.mesh.scale.set(rad, a.height * grow, rad);
      a.mat.opacity = a.alpha * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8);
      if (k >= 1) {
        a.busy = false;
        a.mesh.visible = false;
      }
    }
    for (const f of this.flashes) {
      if (!f.busy) continue;
      f.t += step;
      const k = f.t / f.dur;
      if (k >= 1) {
        f.busy = false;
        f.light.intensity = 0;
        continue;
      }
      f.light.intensity =
        f.pulse > 0
          ? f.peak * (0.5 + 0.5 * Math.sin(f.t * f.pulse * Math.PI * 2 - Math.PI / 2)) * (1 - k * k)
          : f.peak * (1 - k) * (1 - k);
    }
  }

  dispose(): void {
    this.scene.remove(this.root);
    this.glow.dispose();
    this.soft.dispose();
    this.ringGeo.dispose();
    this.beamGeo.dispose();
    for (const a of [...this.rings, ...this.beams]) a.mat.dispose();
    for (const f of this.flashes) f.light.dispose();
    this.emitters.length = 0;
  }

  // ── internals ──

  private makeAnim(geo: THREE.BufferGeometry): Anim {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    this.root.add(mesh);
    return { mesh, mat, t: 0, dur: 1, r0: 0, r1: 1, alpha: 1, height: 1, busy: false };
  }

  private take(pool: Anim[]): Anim {
    const free = pool.find((a) => !a.busy);
    if (free) return free;
    // Recycle the most advanced one.
    return pool.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
  }

  private ring(
    pos: THREE.Vector3,
    r0: number,
    r1: number,
    dur: number,
    color: THREE.Color,
    alpha: number,
  ): void {
    const a = this.take(this.rings);
    Object.assign(a, { t: 0, dur, r0, r1, alpha, busy: true });
    a.mat.color.copy(color);
    a.mat.opacity = alpha;
    a.mesh.position.set(pos.x, Math.max(1.06, pos.y) + 0.02, pos.z);
    a.mesh.scale.set(r0, 1, r0);
    a.mesh.visible = true;
  }

  private beam(
    pos: THREE.Vector3,
    radius: number,
    height: number,
    dur: number,
    c: THREE.Color,
  ): void {
    const a = this.take(this.beams);
    Object.assign(a, { t: 0, dur, r0: radius, r1: radius, alpha: 0.55, height, busy: true });
    a.mat.color.copy(c);
    a.mesh.position.set(pos.x, Math.max(1, pos.y), pos.z);
    a.mesh.scale.set(radius, 0.01, radius);
    a.mesh.visible = true;
  }

  private flash(pos: THREE.Vector3, c: THREE.Color, peak: number, dur: number, pulse = 0): void {
    const f =
      this.flashes.find((x) => !x.busy) ??
      this.flashes.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
    // Calm mode: no strobing, a third of the brightness.
    if (this.calm) {
      peak *= 0.35;
      pulse = 0;
    }
    Object.assign(f, { t: 0, dur, peak, pulse, busy: true });
    f.light.color.copy(c);
    f.light.position.set(pos.x, pos.y + 3, pos.z);
    f.light.intensity = pulse > 0 ? 0 : peak;
  }

  private runEmitter(e: Emitter, dt: number): void {
    if (!e.enabled) return;
    e.acc += e.rate * this.density * dt;
    const r = this.rnd;
    const { x, z, w, d } = e.rect;
    const y0 = e.rect.y ?? 1;
    const h = e.rect.h ?? 7;
    while (e.acc >= 1) {
      e.acc -= 1;
      const px = x + 1 + r() * Math.max(0, w - 2);
      const pz = z + 1 + r() * Math.max(0, d - 2);
      switch (e.kind) {
        case "dust":
          this.soft.spawn({
            x: px,
            y: y0 + r() * h,
            z: pz,
            vx: (r() - 0.5) * 0.3,
            vy: (r() - 0.5) * 0.15,
            vz: (r() - 0.5) * 0.3,
            life: 5 + r() * 4,
            size0: 0.18,
            size1: 0.18,
            alpha: 0.35,
            color: this.tmpColor.set(COLORS.dust),
            turb: 0.3,
          });
          break;
        case "wisps":
          this.glow.spawn({
            x: px,
            y: y0 + r() * h * 0.6,
            z: pz,
            vx: (r() - 0.5) * 0.6,
            vy: 0.3 + r() * 0.4,
            vz: (r() - 0.5) * 0.6,
            life: 3 + r() * 3,
            size0: 0.7,
            size1: 0.1,
            alpha: 0.55,
            color: this.tmpColor.set(COLORS.violet),
            turb: 2.5,
          });
          break;
        case "steam":
          this.soft.spawn({
            x: px,
            y: y0,
            z: pz,
            vx: (r() - 0.5) * 0.4,
            vy: 1 + r() * 1.2,
            vz: (r() - 0.5) * 0.4,
            life: 2.5 + r() * 2,
            size0: 0.8,
            size1: 3,
            alpha: 0.16,
            color: this.tmpColor.set(COLORS.steam),
            turb: 1.5,
          });
          break;
        case "motes":
          // Dust caught in the lamp light: tiny, slow, faint additive specks.
          this.glow.spawn({
            x: px,
            y: y0 + 1.5 + r() * (h - 1.5),
            z: pz,
            vx: (r() - 0.5) * 0.12,
            vy: (r() - 0.35) * 0.08,
            vz: (r() - 0.5) * 0.12,
            life: 6 + r() * 5,
            size0: 0.12 + r() * 0.1,
            size1: 0.1,
            alpha: 0.28,
            color: e.color ?? this.tmpColor.set(COLORS.white),
            turb: 0.12,
          });
          break;
        case "embers":
          this.glow.spawn({
            x: px,
            y: y0 + r() * 2,
            z: pz,
            vx: (r() - 0.5) * 0.5,
            vy: 0.8 + r() * 1.5,
            vz: (r() - 0.5) * 0.5,
            life: 2 + r() * 2,
            size0: 0.3,
            size1: 0.05,
            alpha: 0.9,
            color: this.tmpColor.set(COLORS.spark),
            turb: 2,
          });
          break;
      }
    }
  }
}

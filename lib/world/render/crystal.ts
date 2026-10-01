/**
 * Crystal models at runtime (docs/CRYSTAL.md): loads `/crystal/manifest.json`,
 * fetches the Blender-built GLBs on demand (meshopt, quantised) and turns
 * them into engine geometry — float position / normal / colour (palette ×
 * baked AO and wear, linear), one group per crystal surface whose material
 * index is `CRYSTAL_SLOT_BASE + slot`. Mesh space = the engine's voxel mesh
 * space (source voxel units, y up, min corner at 0; centred like the voxel
 * mesh when the caller asks).
 *
 * Materials: the engine's material arrays get CRYSTAL_SLOTS extra entries
 * after the four voxel classes (`materialsFor`). Emissive surfaces reuse the
 * array's own `emit` material (so glow parts keep their pulse material and
 * bloom tuning), glass reuses its `glass`; everything else is a shared
 * physically based surface material with world-space micro relief (and the
 * library's tileable maps once `pnpm crystal:library` added them).
 */
import * as THREE from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  CRYSTAL_SLOTS,
  CRYSTAL_SLOT_BASE,
  forbiddenUse,
  isCrystalManifest,
  surfaceSlots,
  type CrystalManifest,
  type CrystalSurface,
} from "@/lib/world/crystal";

type GeoState = THREE.BufferGeometry | "loading" | "failed";

/** Surface id inside a crystal GLB's material id. */
const MATERIAL_ID = /^crystal:(\w+)$/;

/** Voxel material array order (lib/voxel/mesher MATERIAL_CLASSES). */
const GLASS = 1;
const EMIT = 2;

export class CrystalLibrary {
  private manifest: CrystalManifest | null = null;
  private slotOf = new Map<string, number>();
  /** Surface id per slot (null = unused). */
  private slotSurface: (string | null)[] = Array.from({ length: CRYSTAL_SLOTS }, () => null);
  /** Shared surface materials, configured when the manifest arrives. */
  readonly slots: THREE.MeshPhysicalMaterial[];
  private readonly raw = new Map<string, GeoState>();
  private readonly placed = new Map<string, THREE.BufferGeometry>();
  private readonly arrays = new Map<string, THREE.Material[]>();
  private readonly loader: GLTFLoader;
  private readonly textures = new THREE.TextureLoader();
  private loading = 0;
  readonly ready: Promise<boolean>;
  private disposed = false;

  constructor(private readonly base = "/crystal/") {
    this.slots = Array.from({ length: CRYSTAL_SLOTS }, (_, i) => surfaceMaterial(`slot${i}`, {}));
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.ready = this.load();
  }

  private async load(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}manifest.json`, { cache: "no-cache" });
      if (!res.ok) return false;
      const json: unknown = await res.json();
      if (!isCrystalManifest(json) || this.disposed) return false;
      this.manifest = json;
      this.slotOf = surfaceSlots(json);
      for (const [sid, slot] of this.slotOf) {
        if (this.slotSurface[slot]) continue;
        this.slotSurface[slot] = sid;
        configureSurface(
          this.slots[slot]!,
          sid,
          json.surfaces[sid] ?? {},
          this.base,
          this.textures,
        );
      }
      for (const arr of this.arrays.values()) this.fillSlots(arr);
      return true;
    } catch {
      return false;
    }
  }

  /** Is the manifest loaded and does it hold a crystal model for this grid key? */
  has(key: string): boolean {
    const m = this.manifest?.models[key];
    return !!m && !m.uses.some(forbiddenUse) && this.raw.get(key) !== "failed";
  }

  /** Models in the manifest (0 until it is loaded). */
  get size(): number {
    return this.manifest ? Object.keys(this.manifest.models).length : 0;
  }

  /** GLBs currently downloading / decoding. */
  get pending(): number {
    return this.loading;
  }

  /**
   * Crystal geometry of a grid in engine mesh space, or null while it loads
   * (call again later). `center` shifts it like the voxel mesh
   * (x/z centred on the grid, y from 0).
   */
  geometry(
    key: string,
    size: readonly [number, number, number],
    center: boolean,
  ): THREE.BufferGeometry | null {
    const k = `${key}|${center ? 1 : 0}`;
    const hit = this.placed.get(k);
    if (hit) return hit;
    const raw = this.raw.get(key);
    if (raw === undefined) {
      this.fetch(key);
      return null;
    }
    if (raw === "loading" || raw === "failed") return null;
    const g = raw.clone();
    if (center) g.translate(-size[0] / 2, 0, -size[2] / 2);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    g.userData.crystal = true;
    this.placed.set(k, g);
    return g;
  }

  private fetch(key: string): void {
    const m = this.manifest?.models[key];
    if (!m) return;
    this.raw.set(key, "loading");
    this.loading++;
    this.loader.load(
      `${this.base}${m.file}`,
      (gltf) => {
        this.loading--;
        if (this.disposed) return;
        try {
          this.raw.set(key, this.toGeometry(gltf.scene));
        } catch (e) {
          console.warn(`[crystal] ${m.file}:`, e);
          this.raw.set(key, "failed");
        }
      },
      undefined,
      () => {
        this.loading--;
        this.raw.set(key, "failed");
      },
    );
  }

  /** All primitives → one float geometry, groups by surface slot (sorted). */
  private toGeometry(scene: THREE.Object3D): THREE.BufferGeometry {
    scene.updateMatrixWorld(true);
    const parts: { slot: number; geo: THREE.BufferGeometry }[] = [];
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mat = o.material as THREE.Material;
      // glTF material id `crystal:<surface>` (scripts/crystal/blender/crystal/surfaces.py).
      const sid = MATERIAL_ID.exec(mat.name)?.[1] ?? "plastic";
      const slot = this.slotOf.get(sid) ?? this.slotOf.get("plastic") ?? 0;
      parts.push({ slot, geo: floatGeometry(o.geometry, o.matrixWorld) });
    });
    parts.sort((a, b) => a.slot - b.slot);
    let verts = 0;
    let idx = 0;
    for (const p of parts) {
      verts += p.geo.getAttribute("position").count;
      idx += p.geo.getIndex()!.count;
    }
    const pos = new Float32Array(verts * 3);
    const nrm = new Float32Array(verts * 3);
    const col = new Float32Array(verts * 3);
    const index = verts > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
    const out = new THREE.BufferGeometry();
    let v0 = 0;
    let i0 = 0;
    for (const p of parts) {
      const g = p.geo;
      const n = g.getAttribute("position").count;
      pos.set(g.getAttribute("position").array as Float32Array, v0 * 3);
      nrm.set(g.getAttribute("normal").array as Float32Array, v0 * 3);
      col.set(g.getAttribute("color").array as Float32Array, v0 * 3);
      const gi = g.getIndex()!.array;
      for (let k = 0; k < gi.length; k++) index[i0 + k] = gi[k]! + v0;
      out.addGroup(i0, gi.length, CRYSTAL_SLOT_BASE + p.slot);
      v0 += n;
      i0 += gi.length;
    }
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    out.setAttribute("color", new THREE.BufferAttribute(col, 3));
    out.setIndex(new THREE.BufferAttribute(index, 1));
    return out;
  }

  /**
   * A voxel material array extended by the crystal slots (cached per array
   * content, so meshes sharing materials share the array — instancing keys
   * on material ids).
   */
  materialsFor(voxel: readonly THREE.Material[]): THREE.Material[] {
    const head = voxel.slice(0, CRYSTAL_SLOT_BASE);
    const k = head.map((m) => m.uuid).join(",");
    let arr = this.arrays.get(k);
    if (!arr) {
      arr = [...head, ...this.slots];
      this.fillSlots(arr);
      this.arrays.set(k, arr);
    }
    return arr;
  }

  /**
   * Point the slots of an extended array at the right materials. Arrays are
   * handed out before the manifest may have arrived (floors build first) and
   * are shared by meshes, batches and the terrain — so they are updated in
   * place once the surfaces are known.
   */
  private fillSlots(arr: THREE.Material[]): void {
    for (let i = 0; i < CRYSTAL_SLOTS; i++) {
      const s = this.slotSurface[i];
      const def = s ? this.manifest?.surfaces[s] : undefined;
      arr[CRYSTAL_SLOT_BASE + i] =
        def && (def.emit ?? 0) >= 1
          ? arr[EMIT]!
          : def && (def.transmission ?? 0) > 0
            ? arr[GLASS]!
            : this.slots[i]!;
    }
  }

  /** Surface id of every slot (dev overlay / tests). */
  surfaces(): (string | null)[] {
    return [...this.slotSurface];
  }

  dispose(): void {
    this.disposed = true;
    for (const g of this.placed.values()) g.dispose();
    for (const g of this.raw.values()) if (g instanceof THREE.BufferGeometry) g.dispose();
    for (const m of this.slots) m.dispose();
    this.placed.clear();
    this.raw.clear();
    this.arrays.clear();
  }
}

/** Float, non-interleaved, de-quantised copy with the node transform baked in. */
function floatGeometry(src: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pa = src.getAttribute("position");
  const n = pa.count;
  const pos = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pa, i).applyMatrix4(matrix);
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const na = src.getAttribute("normal");
  const nrm = new Float32Array(n * 3);
  if (na) {
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      nrm[i * 3] = v.x;
      nrm[i * 3 + 1] = v.y;
      nrm[i * 3 + 2] = v.z;
    }
  }
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  const ca = src.getAttribute("color");
  const col = new Float32Array(n * 3).fill(1);
  if (ca) {
    for (let i = 0; i < n; i++) {
      col[i * 3] = ca.getX(i);
      col[i * 3 + 1] = ca.getY(i);
      col[i * 3 + 2] = ca.getZ(i);
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const idx = src.getIndex();
  const index = new Uint32Array(idx ? idx.count : n);
  for (let i = 0; i < index.length; i++) index[i] = idx ? idx.getX(i) : i;
  g.setIndex(new THREE.BufferAttribute(index, 1));
  if (!na) g.computeVertexNormals();
  return g;
}

/** Placeholder surface material (configured once the manifest is known). */
function surfaceMaterial(key: string, s: CrystalSurface): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true });
  m.name = `crystal:${key}`;
  applySurface(m, s);
  return m;
}

/**
 * PBR factors of a surface. Lacquer (clearcoat) sits on paint, plastic and
 * glaze; cloth gets sheen; skin a soft sheen as a cheap stand-in for
 * scattering. Values from the surface table win over these defaults.
 */
function applySurface(m: THREE.MeshPhysicalMaterial, s: CrystalSurface): void {
  m.metalness = s.metal ?? 0;
  m.roughness = s.rough ?? 0.5;
  m.envMapIntensity = 1;
  m.clearcoat = s.clearcoat ?? 0;
  m.clearcoatRoughness = 0.22;
  m.sheen = s.sheen ?? 0;
  m.sheenRoughness = 0.75;
  m.sheenColor.set(0xffffff);
  if (s.subsurface) {
    m.sheen = Math.max(m.sheen, 0.25);
    m.sheenColor.set(0xff9a80);
  }
}

/** Default lacquer per surface id (painted / moulded things have a coat on top). */
const LACQUER: Readonly<Record<string, number>> = {
  painted_metal: 0.45,
  plastic: 0.3,
  ceramic: 0.7,
  leather: 0.15,
  warm_metal: 0.1,
};

/** Surfaces with brushed / scratched metal (streaky roughness). */
const BRUSHED = new Set(["steel", "chrome", "warm_metal", "painted_metal", "rust"]);

/**
 * Configure a slot for its surface: PBR factors, world-space micro relief /
 * roughness breakup scaled by the surface's `relief`, and the library's
 * tileable normal / roughness maps (triplanar) when the manifest names them.
 */
function configureSurface(
  m: THREE.MeshPhysicalMaterial,
  sid: string,
  s: CrystalSurface,
  base: string,
  loader: THREE.TextureLoader,
): void {
  m.name = `crystal:${sid}`;
  applySurface(m, { clearcoat: LACQUER[sid], ...s });
  const relief = s.relief ?? 0.3;
  const scratch = BRUSHED.has(sid) ? (s.metal ?? 0) * 0.6 + 0.25 : 0;
  const tex = s.textures;
  const tileable = (path: string | undefined, srgb: boolean): THREE.Texture | null => {
    if (!path) return null;
    const t = loader.load(`${base}${path}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const nMap = tileable(tex?.normal, false);
  const rMap = tileable(tex?.roughness, false);
  const scale = tex?.scale ?? 0.25;
  const uniforms = {
    uCrNormal: { value: nMap },
    uCrRough: { value: rMap },
    uCrScale: { value: scale },
    uCrRelief: { value: relief },
    uCrScratch: { value: scratch },
  };
  const defs = `${nMap ? "#define CR_NMAP\n" : ""}${rMap ? "#define CR_RMAP\n" : ""}`;
  m.customProgramCacheKey = () => `crystal-${sid}-${nMap ? 1 : 0}${rMap ? 1 : 0}`;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCrW;\nvarying vec3 vCrN;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvCrW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCrN = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
${defs}varying vec3 vCrW;
varying vec3 vCrN;
uniform float uCrScale;
uniform float uCrRelief;
uniform float uCrScratch;
#ifdef CR_NMAP
uniform sampler2D uCrNormal;
#endif
#ifdef CR_RMAP
uniform sampler2D uCrRough;
#endif
float crHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float crNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(crHash(i), crHash(i + vec3(1,0,0)), f.x), mix(crHash(i + vec3(0,1,0)), crHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(crHash(i + vec3(0,0,1)), crHash(i + vec3(1,0,1)), f.x), mix(crHash(i + vec3(0,1,1)), crHash(i + vec3(1,1,1)), f.x), f.y), f.z) * 2.0 - 1.0;
}
vec3 crWeights() { vec3 w = pow(abs(normalize(vCrN)), vec3(4.0)); return w / max(1e-4, w.x + w.y + w.z); }
float crFade(float f) { return 1.0 - smoothstep(0.3, 0.8, length(fwidth(vCrW)) * f); }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
#ifdef CR_RMAP
{ vec3 w = crWeights(); vec3 p = vCrW * uCrScale;
  float r = texture2D(uCrRough, p.yz).g * w.x + texture2D(uCrRough, p.xz).g * w.y + texture2D(uCrRough, p.xy).g * w.z;
  roughnessFactor = clamp(roughnessFactor + (r - 0.5) * 0.5, 0.03, 1.0); }
#else
roughnessFactor = clamp(roughnessFactor + uCrRelief * 0.14 * crNoise(vCrW * 2.1 + 7.0), 0.03, 1.0);
#endif
if (uCrScratch > 0.0) {
  // Brushed / handled metal: fine streaks (long along the dominant tangent) and smudges.
  vec3 an = abs(normalize(vCrN));
  vec3 sp = an.y > 0.7 ? vec3(vCrW.x * 36.0, 0.0, vCrW.z * 1.2) : vec3(vCrW.x * 1.2 + vCrW.z * 1.2, vCrW.y * 30.0, 0.0);
  float streak = crNoise(sp) * 0.5 + 0.5;
  float smudge = smoothstep(0.35, 0.9, crNoise(vCrW * 0.7 + 3.0) * 0.5 + 0.5);
  float fade = crFade(30.0);
  // Floors and tops: barely brushed (streaks read as noise from above), walls of devices fully.
  float brushed = an.y > 0.7 ? 0.3 : 1.0;
  roughnessFactor = clamp(roughnessFactor + uCrScratch * (0.07 * brushed * (streak - 0.5) * fade + 0.14 * smudge), 0.03, 1.0);
}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
#ifdef CR_NMAP
{ vec3 w = crWeights(); vec3 p = vCrW * uCrScale;
  vec3 tx = texture2D(uCrNormal, p.yz).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(uCrNormal, p.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(uCrNormal, p.xy).xyz * 2.0 - 1.0;
  vec3 wn = normalize(vec3(0.0, tx.y, tx.x) * w.x + vec3(ty.x, 0.0, ty.y) * w.y + vec3(tz.x, tz.y, 0.0) * w.z) * uCrRelief * 0.6;
  normal = normalize(normal + (viewMatrix * vec4(wn, 0.0)).xyz); }
#else
if (uCrRelief > 0.001) {
  float h = uCrRelief * 0.01 * (crNoise(vCrW * 11.0) * crFade(11.0) + 0.5 * crNoise(vCrW * 29.0) * crFade(29.0));
  vec3 sx = dFdx(-vViewPosition); vec3 sy = dFdy(-vViewPosition);
  vec3 r1 = cross(sy, normal); vec3 r2 = cross(normal, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  vec3 bn = abs(det) * normal - grad;
  if (abs(det) > 1e-12 && dot(bn, bn) > 1e-20) normal = normalize(bn);
}
#endif`,
      );
  };
  m.needsUpdate = true;
}

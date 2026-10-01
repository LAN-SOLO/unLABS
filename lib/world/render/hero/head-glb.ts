/**
 * Jade's real head (Blender + MPFB2, scripts/hero/blender/jade_mpfb.py →
 * public/hero/jade-head.glb): an anatomical head and neck in character space
 * (model voxels), aligned so its eye sockets sit on JADE_EYES — the game's
 * eyeballs, bones, groom and hair colliders fit unchanged. The skin is the
 * baked portrait texture; a `blink` morph target closes both lids; brows are
 * alpha cards. Replaces the SDF `head` layer and the lid caps (docs/HERO.md).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface HeroHeadPart {
  positions: Float32Array;
  normals: Float32Array;
  uv: Float32Array | null;
  indices: Uint32Array;
  /** Morph `blink` as position deltas (null = none). */
  blink: Float32Array | null;
  map: THREE.Texture | null;
}

export interface HeroHead {
  head: HeroHeadPart;
  brows: HeroHeadPart | null;
}

export const HERO_HEAD_URL = "/hero/jade-head.glb";
/** Textures next to the GLB (not embedded: the CSP blocks the loader's blob: URLs). */
const SKIN_URL = "/hero/jade-skin.jpg";
const BROWS_URL = "/hero/jade-brows.png";

function part(mesh: THREE.Mesh): HeroHeadPart {
  // Bake the node transform (the exporter may wrap meshes in transformed nodes).
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  for (const m of g.morphAttributes.position ?? []) {
    if (g.morphTargetsRelative) {
      const nm = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
      const v = new THREE.Vector3();
      for (let i = 0; i < m.count; i++) {
        v.fromBufferAttribute(m, i).applyMatrix3(nm);
        m.setXYZ(i, v.x, v.y, v.z);
      }
    } else m.applyMatrix4(mesh.matrixWorld);
  }
  const n = g.getAttribute("position").count;
  const copy = (name: string, size: number): Float32Array | null => {
    const a = g.getAttribute(name);
    if (!a) return null;
    const out = new Float32Array(n * size);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k);
    return out;
  };
  const idx = g.getIndex();
  const indices = new Uint32Array(idx ? idx.count : n);
  for (let i = 0; i < indices.length; i++) indices[i] = idx ? idx.getX(i) : i;
  const morphs = g.morphAttributes.position;
  let blink: Float32Array | null = null;
  if (morphs?.length) {
    const names = (mesh.userData.targetNames as string[] | undefined) ?? [];
    const k = Math.max(0, names.indexOf("blink"));
    const m = morphs[k]!;
    blink = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) blink[i * 3 + c] = m.getComponent(i, c);
    if (!g.morphTargetsRelative) {
      const p = g.getAttribute("position");
      for (let i = 0; i < n; i++)
        for (let c = 0; c < 3; c++) blink[i * 3 + c] -= p.getComponent(i, c);
    }
  }
  const mat = mesh.material as THREE.MeshStandardMaterial;
  return {
    positions: copy("position", 3)!,
    normals: copy("normal", 3) ?? new Float32Array(n * 3),
    uv: copy("uv", 2),
    indices,
    blink,
    map: mat.map ?? null,
  };
}

const BROWS_NODE = /brow/i;
const HEAD_NODE = /head/i;

let cached: Promise<HeroHead | null> | null = null;

/** Load the head once (null when the file is missing or in Node). */
export function loadHeroHead(url = HERO_HEAD_URL): Promise<HeroHead | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  cached ??= new GLTFLoader()
    .loadAsync(url)
    .then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      let head: HeroHeadPart | null = null;
      let brows: HeroHeadPart | null = null;
      gltf.scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const name = `${o.name} ${o.parent?.name ?? ""}`.toLowerCase();
        // glTF node names written by scripts/hero/blender/export_head.py.
        if (BROWS_NODE.test(name)) brows = part(o);
        else if (HEAD_NODE.test(name)) head = part(o);
      });
      if (!head) return null;
      const tl = new THREE.TextureLoader();
      const h = head as HeroHeadPart;
      const b = brows as HeroHeadPart | null;
      // The skin is derived from the private reference portrait and is not in
      // the repository (built locally by scripts/hero/blender/jade_mpfb.py):
      // without it, keep the sculpted head instead of an untextured one.
      return tl.loadAsync(SKIN_URL).then(async (skin) => {
        skin.flipY = false;
        h.map = skin;
        if (b) {
          b.map = await tl.loadAsync(BROWS_URL).catch(() => null);
          if (b.map) b.map.flipY = false;
        }
        return { head: h, brows: b?.map ? b : null };
      });
    })
    .catch(() => null);
  return cached;
}

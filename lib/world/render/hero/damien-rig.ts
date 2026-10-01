/**
 * Damien's hero rig — the skinned, "real" Damien as a three.js tree.
 * ==================================================================
 *
 * Same shape as Jade's HeroRig (root, inner, joints, rest, meshes,
 * skeleton) so the engine poses him with `applyPose` like any character.
 *
 * `veiled` (the default and the only mode the game may use until
 * `isDamienRevealed()`): every part wears the veil shader — a coarse
 * cyan mosaic, nothing of his face, hair, beard or clothes readable. The
 * revealed mode (plain physical materials) exists for the dev studio only.
 * `tick(time)` animates the veil; `setStrength(0..1)` fades him in/out
 * (the engine's materialise / dissolve).
 */
import * as THREE from "three";
import type { HeroLayerMesh } from "@/lib/world/hero/build";
import { DAMIEN_HERO_JOINTS, DAMIEN_UNIT, damienLocalRest } from "@/lib/world/hero/damien-skeleton";
import { tickVeil, veilMaterial, type VeilMaterial } from "@/lib/world/render/hero/veil-material";

export interface DamienRig {
  root: THREE.Group;
  inner: THREE.Group;
  joints: Map<string, THREE.Object3D>;
  rest: Map<string, THREE.Vector3>;
  meshes: THREE.Mesh[];
  skeleton: THREE.Skeleton;
  veiled: boolean;
  /** Animate the veil (no-op when revealed). */
  tick(time: number): void;
  /** 0 = gone, 1 = fully there. */
  setStrength(s: number): void;
  dispose(): void;
}

export interface DamienRigOptions {
  /** Veiled (default true). Only a dev preview may pass false. */
  veiled?: boolean;
  /** World units per model voxel (default DAMIEN_UNIT). */
  unit?: number;
}

/** Plain look for the dev preview (revealed). */
const REVEALED: Readonly<Record<string, { color: string; roughness: number; sheen?: number }>> = {
  head: { color: "#e6c2a6", roughness: 0.5, sheen: 0.3 },
  handR: { color: "#e6c2a6", roughness: 0.5, sheen: 0.3 },
  handL: { color: "#e6c2a6", roughness: 0.5, sheen: 0.3 },
  hair: { color: "#c4b89c", roughness: 0.4, sheen: 0.5 },
  beard: { color: "#a9a49a", roughness: 0.55, sheen: 0.4 },
  shirt: { color: "#f1f1ec", roughness: 0.8, sheen: 0.4 },
  trousers: { color: "#2b2e35", roughness: 0.85, sheen: 0.5 },
  shoes: { color: "#1c1917", roughness: 0.4 },
};

function geometry(l: HeroLayerMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(l.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(l.normals, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(l.skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(l.skinWeight, 4));
  g.setIndex(new THREE.BufferAttribute(l.indices, 1));
  g.computeBoundingSphere();
  return g;
}

/** Build Damien from his hero layers (damien-build.ts). */
export function buildDamienRig(
  layers: readonly HeroLayerMesh[],
  opts: DamienRigOptions = {},
): DamienRig {
  const veiled = opts.veiled ?? true;
  const root = new THREE.Group();
  root.name = "damien";
  const inner = new THREE.Group();
  inner.scale.setScalar(opts.unit ?? DAMIEN_UNIT);
  root.add(inner);
  const joints = new Map<string, THREE.Object3D>();
  const rest = new Map<string, THREE.Vector3>();
  const bones: THREE.Bone[] = [];
  for (const j of DAMIEN_HERO_JOINTS) {
    const b = new THREE.Bone();
    b.name = j.name;
    const r = damienLocalRest(j);
    b.position.set(r[0], r[1], r[2]);
    (j.parent ? joints.get(j.parent)! : inner).add(b);
    joints.set(j.name, b);
    rest.set(j.name, b.position.clone());
    bones.push(b);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  const veil: VeilMaterial | null = veiled ? veilMaterial() : null;
  const plain: THREE.Material[] = [];
  const meshes: THREE.Mesh[] = [];
  for (const l of layers) {
    let mat: THREE.Material;
    if (veil) mat = veil;
    else {
      const spec = REVEALED[l.id] ?? REVEALED.shirt!;
      mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setStyle(spec.color, THREE.SRGBColorSpace),
        roughness: spec.roughness,
        sheen: spec.sheen ?? 0,
        sheenColor: new THREE.Color(1, 0.85, 0.8),
      });
      plain.push(mat);
    }
    const m = new THREE.SkinnedMesh(geometry(l), mat);
    m.name = l.id;
    m.frustumCulled = false;
    m.castShadow = !veiled;
    m.receiveShadow = !veiled;
    if (veil) m.renderOrder = 5;
    inner.add(m);
    meshes.push(m);
  }
  root.updateMatrixWorld(true);
  for (const m of meshes) if (m instanceof THREE.SkinnedMesh) m.bind(skeleton, m.matrixWorld);

  return {
    root,
    inner,
    joints,
    rest,
    meshes,
    skeleton,
    veiled,
    tick(time) {
      if (veil) tickVeil(veil, time);
    },
    setStrength(s) {
      const v = Math.max(0, Math.min(1, s));
      if (veil) veil.userData.veil.uStrength.value = v;
      else
        for (const m of plain) {
          m.transparent = v < 1;
          m.opacity = v;
        }
    },
    dispose() {
      for (const m of meshes) m.geometry.dispose();
      veil?.dispose();
      for (const m of plain) m.dispose();
      skeleton.dispose();
    },
  };
}

/**
 * Hero rig — the skinned, "real" Jade as a three.js object tree.
 * ==============================================================
 *
 * Turns the pure mesh data of build.ts into skinned meshes on a skeleton
 * of `THREE.Bone`s named like the voxel rig's joints. The result has the
 * same shape the engine uses for voxel characters (`root`, `joints`,
 * `rest`), so `applyPose`, hand props and seat placement work unchanged:
 * bones are Object3Ds, a pose sets their rotation and position.
 *
 * Also adds what the fields don't mesh: the two eyeballs (children of the
 * head bone) and the loose curly tendrils (thin tubes, rigid to the head).
 */
import * as THREE from "three";
import type { HeroLayerMesh } from "@/lib/world/hero/build";
import type { JadeGroom } from "@/lib/world/hero/jade-groom";
import { createHairStrands, type HairStrands } from "@/lib/world/render/hero/hair-render";
import { EYE_R, HAIR_TWIST, JADE_EYES, jadeTendrils } from "@/lib/world/hero/jade-sculpt";
import { JADE_LID, gazeAngles, lidAngles } from "@/lib/world/hero/jade-blink";
import { HERO_JOINT_BY_NAME, JADE_HERO_JOINTS, heroLocalRest } from "@/lib/world/hero/skeleton";
import type { HeroHead, HeroHeadPart } from "@/lib/world/render/hero/head-glb";
import {
  cardMaterial,
  texturedSkinMaterial,
  createHeroMaterials,
  HERO_UNIT_DEFAULT,
  type HeroColors,
  type HeroMaterials,
} from "@/lib/world/render/hero/materials";

export interface HeroRig {
  root: THREE.Group;
  /** Scaled group (model voxels → world units) holding the skeleton and meshes. */
  inner: THREE.Group;
  joints: Map<string, THREE.Object3D>;
  rest: Map<string, THREE.Vector3>;
  meshes: THREE.Mesh[];
  materials: HeroMaterials;
  skeleton: THREE.Skeleton;
  /** Lids: 0 open … 1 shut (see `heroBlinkFromLids`). */
  setBlink(blink: number): void;
  /** Eye direction relative to the head (rad, clamped). */
  setGaze(yaw: number, pitch?: number): void;
  /** The simulated strand hair (null without a groom). */
  hair: HairStrands | null;
  /** Per frame, after the pose is applied: steps the hair simulation. */
  update(dt: number): void;
  dispose(): void;
}

function layerGeometry(l: HeroLayerMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(l.positions, 3);
  g.setAttribute("position", pos);
  g.setAttribute("rest", pos);
  g.setAttribute("normal", new THREE.BufferAttribute(l.normals, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(l.skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(l.skinWeight, 4));
  g.setAttribute("ao", new THREE.BufferAttribute(l.ao, 1));
  g.setIndex(new THREE.BufferAttribute(l.indices, 1));
  if (l.material === "hair") g.setAttribute("tangent", hairTangents(l.positions, l.normals));
  g.computeBoundingSphere();
  return g;
}

/**
 * Strand direction per hair vertex: towards the twist on top, projected
 * onto the surface — drives the anisotropic highlight along the strands.
 */
function hairTangents(pos: Float32Array, nor: Float32Array): THREE.BufferAttribute {
  const n = pos.length / 3;
  const out = new Float32Array(n * 4);
  const [tx, ty, tz] = HAIR_TWIST;
  for (let i = 0; i < n; i++) {
    let dx = tx - pos[i * 3]!;
    let dy = ty - pos[i * 3 + 1]!;
    let dz = tz - pos[i * 3 + 2]!;
    const nx = nor[i * 3]!;
    const ny = nor[i * 3 + 1]!;
    const nz = nor[i * 3 + 2]!;
    const k = dx * nx + dy * ny + dz * nz;
    dx -= k * nx;
    dy -= k * ny;
    dz -= k * nz;
    let l = Math.hypot(dx, dy, dz);
    if (l < 1e-5) {
      // At the twist itself: swirl around the vertical.
      dx = -nz;
      dy = 0;
      dz = nx;
      l = Math.hypot(dx, dz) || 1;
    }
    out[i * 4] = dx / l;
    out[i * 4 + 1] = dy / l;
    out[i * 4 + 2] = dz / l;
    out[i * 4 + 3] = 1;
  }
  return new THREE.BufferAttribute(out, 4);
}

/** Tendril tubes (tapering towards the tips) merged into one geometry, rigid to `bone`. */
function tendrilGeometry(bone: number): THREE.BufferGeometry {
  const SIDES = 6;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const a = new THREE.Vector3();
  const t = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (const td of jadeTendrils()) {
    const curve = new THREE.CatmullRomCurve3(
      td.points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    );
    const steps = td.points.length * 3;
    const frames = curve.computeFrenetFrames(steps, false);
    const base = pos.length / 3;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      curve.getPointAt(u, a);
      t.copy(frames.tangents[i]!);
      const r = td.radius * (1 - 0.75 * u);
      for (let k = 0; k < SIDES; k++) {
        const ang = (k / SIDES) * Math.PI * 2;
        n.copy(frames.normals[i]!).multiplyScalar(Math.cos(ang));
        b.copy(frames.binormals[i]!).multiplyScalar(Math.sin(ang));
        n.add(b).normalize();
        pos.push(a.x + n.x * r, a.y + n.y * r, a.z + n.z * r);
        nor.push(n.x, n.y, n.z);
      }
    }
    for (let i = 0; i < steps; i++)
      for (let k = 0; k < SIDES; k++) {
        const k2 = (k + 1) % SIDES;
        const p0 = base + i * SIDES + k;
        const p1 = base + i * SIDES + k2;
        const p2 = base + (i + 1) * SIDES + k;
        const p3 = base + (i + 1) * SIDES + k2;
        idx.push(p0, p2, p1, p1, p2, p3);
      }
  }
  const nv = pos.length / 3;
  const si = new Uint16Array(nv * 4);
  const sw = new Float32Array(nv * 4);
  for (let v = 0; v < nv; v++) {
    si[v * 4] = bone;
    sw[v * 4] = 1;
  }
  return layerGeometry({
    id: "tendrils",
    material: "hair",
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    indices: new Uint32Array(idx),
    skinIndex: si,
    skinWeight: sw,
    ao: new Float32Array(nv).fill(0.85),
  });
}

export interface HeroRigOptions {
  colors: HeroColors;
  /** Hair groom for the strand engine (without it: the old tube tendrils). */
  groom?: JadeGroom;
  /** Share of each guide's strands drawn (1 = portrait, ~0.25 in the lab). */
  hairShare?: number;
  /** Cheaper hair simulation (the lab: 1/60 s steps, two iterations). */
  hairCheap?: boolean;
  /** World units per model voxel (default: the rig scale). */
  unit?: number;
  castShadow?: boolean;
  /**
   * Real head (Blender/MPFB, head-glb.ts): replaces the sculpted head layer
   * and the lid caps; blinks with its morph target.
   */
  head?: HeroHead | null;
}

/** Skin weights of the head: face and skull follow the head, the neck hands over to the torso. */
function headSkin(pos: Float32Array, rigid: boolean): { idx: Uint16Array; w: Float32Array } {
  const n = pos.length / 3;
  const idx = new Uint16Array(n * 4);
  const w = new Float32Array(n * 4);
  const head = JADE_HERO_JOINTS.findIndex((j) => j.name === "head");
  const torso = JADE_HERO_JOINTS.findIndex((j) => j.name === "torso");
  for (let v = 0; v < n; v++) {
    const y = pos[v * 3 + 1]!;
    const t = rigid ? 1 : Math.min(1, Math.max(0, (y - 50.4) / 2.2));
    const s = t * t * (3 - 2 * t);
    idx[v * 4] = head;
    w[v * 4] = s;
    idx[v * 4 + 1] = torso;
    w[v * 4 + 1] = 1 - s;
  }
  return { idx, w };
}

function headGeometry(p: HeroHeadPart, rigid: boolean): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(p.positions, 3);
  g.setAttribute("position", pos);
  g.setAttribute("rest", pos);
  g.setAttribute("normal", new THREE.BufferAttribute(p.normals, 3));
  if (p.uv) g.setAttribute("uv", new THREE.BufferAttribute(p.uv, 2));
  const sk = headSkin(p.positions, rigid);
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(sk.idx, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(sk.w, 4));
  g.setAttribute(
    "ao",
    new THREE.BufferAttribute(new Float32Array(p.positions.length / 3).fill(1), 1),
  );
  g.setIndex(new THREE.BufferAttribute(p.indices, 1));
  if (p.blink) {
    g.morphAttributes.position = [new THREE.BufferAttribute(p.blink, 3)];
    g.morphTargetsRelative = true;
  }
  g.computeBoundingSphere();
  return g;
}

/** Build the skinned hero from mesh layers (character space, model voxels). */
export function buildHeroRig(layers: readonly HeroLayerMesh[], opts: HeroRigOptions): HeroRig {
  const unit = opts.unit ?? HERO_UNIT_DEFAULT;
  const materials = createHeroMaterials(opts.colors, unit);
  const root = new THREE.Group();
  root.name = "hero";
  const inner = new THREE.Group();
  inner.scale.setScalar(unit);
  root.add(inner);

  const joints = new Map<string, THREE.Object3D>();
  const rest = new Map<string, THREE.Vector3>();
  const bones: THREE.Bone[] = [];
  for (const j of JADE_HERO_JOINTS) {
    const b = new THREE.Bone();
    b.name = j.name;
    const r = heroLocalRest(j);
    b.position.set(r[0], r[1], r[2]);
    (j.parent ? joints.get(j.parent)! : inner).add(b);
    joints.set(j.name, b);
    rest.set(j.name, b.position.clone());
    bones.push(b);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  const meshes: THREE.Mesh[] = [];
  const cast = opts.castShadow ?? true;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    m.frustumCulled = false;
    inner.add(m);
    meshes.push(m);
  };
  const realHead = opts.head ?? null;
  for (const l of layers) {
    if (realHead && l.id === "head") continue;
    add(layerGeometry(l), materials[l.material], l.id);
    // The sculpted hair volume was shaped around the SDF skull: over the real
    // head its silhouette threw a hard shadow edge across the face.
    if (realHead && l.id === "hair") meshes[meshes.length - 1]!.castShadow = false;
  }
  let headMesh: THREE.Mesh | null = null;
  if (realHead) {
    const skinTex = texturedSkinMaterial(realHead.head.map, unit);
    add(headGeometry(realHead.head, false), skinTex, "head");
    headMesh = meshes[meshes.length - 1]!;
    if (realHead.brows)
      add(headGeometry(realHead.brows, true), cardMaterial(realHead.brows.map), "brows");
  }
  const headIdx = JADE_HERO_JOINTS.findIndex((j) => j.name === "head");
  if (!opts.groom) add(tendrilGeometry(headIdx), materials.hair, "tendrils");
  // Bind with the meshes' real world matrices (the inner scale!), so the
  // skinning matrices cancel exactly wherever the root moves later.
  root.updateMatrixWorld(true);
  for (const m of meshes) if (m instanceof THREE.SkinnedMesh) m.bind(skeleton, m.matrixWorld);

  // Eyeballs: children of the head bone.
  const head = joints.get("head")!;
  const headAt = HERO_JOINT_BY_NAME.get("head")!.at;
  const eyeGeo = new THREE.SphereGeometry(EYE_R, 40, 28);
  eyeGeo.setAttribute("rest", eyeGeo.getAttribute("position"));
  eyeGeo.setAttribute(
    "ao",
    new THREE.BufferAttribute(new Float32Array(eyeGeo.getAttribute("position").count).fill(1), 1),
  );
  const eyes: { mesh: THREE.Mesh; inward: number }[] = [];
  // Lid caps (skin) that close over the eyeballs when she blinks.
  const capGeo = (thetaStart: number, theta: number) => {
    const g = new THREE.SphereGeometry(JADE_LID.radius, 32, 10, 0, Math.PI * 2, thetaStart, theta);
    const n = g.getAttribute("position").count;
    g.setAttribute("ao", new THREE.BufferAttribute(new Float32Array(n).fill(0.8), 1));
    return g;
  };
  const caps: { upper: THREE.Mesh; lower: THREE.Mesh }[] = [];
  for (const e of JADE_EYES) {
    const m = new THREE.Mesh(eyeGeo, materials.eye);
    // (with the real head the lids are part of its mesh — see setBlink)
    m.name = "eye";
    m.position.set(e[0] - headAt[0], e[1] - headAt[1], e[2] - headAt[2]);
    // Look slightly inward, like a relaxed gaze at a near point.
    const inward = -e[0] * 0.05;
    m.rotation.y = inward;
    m.castShadow = false;
    head.add(m);
    meshes.push(m);
    eyes.push({ mesh: m, inward });
    const pair = {
      upper: capGeo(0, JADE_LID.upperTheta),
      lower: capGeo(Math.PI - JADE_LID.lowerTheta, JADE_LID.lowerTheta),
    };
    const cap = (g: THREE.BufferGeometry, name: string) => {
      // Rest = character-space position, so the skin shader paints lids (shadow, liner) on them.
      const pos = g.getAttribute("position");
      const rest = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        rest[i * 3] = pos.getX(i) + e[0];
        rest[i * 3 + 1] = pos.getY(i) + e[1];
        rest[i * 3 + 2] = pos.getZ(i) + e[2];
      }
      g.setAttribute("rest", new THREE.BufferAttribute(rest, 3));
      const c = new THREE.Mesh(g, materials.skin);
      c.name = name;
      c.position.copy(m.position);
      c.castShadow = false;
      head.add(c);
      meshes.push(c);
      return c;
    };
    if (!realHead)
      caps.push({ upper: cap(pair.upper, "lidUpper"), lower: cap(pair.lower, "lidLower") });
  }
  const setBlink = (b: number) => {
    if (headMesh?.morphTargetInfluences?.length) headMesh.morphTargetInfluences[0] = b;
    const a = lidAngles(b);
    for (const c of caps) {
      c.upper.rotation.x = a.upper;
      c.lower.rotation.x = a.lower;
    }
  };
  setBlink(0);

  // Strand hair (hair engine): simulated guides, strands grown on the GPU.
  let hair: HairStrands | null = null;
  if (opts.groom) {
    // The sculpted updo becomes the dense under-layer (darker, inside the strands).
    hair = createHairStrands(opts.groom, {
      childShare: opts.hairShare ?? 1,
      color: materials.hair.userData.heroUniforms.uBase.value as THREE.Color,
      headAt: HERO_JOINT_BY_NAME.get("head")!.at,
      torsoAt: HERO_JOINT_BY_NAME.get("torso")!.at,
      ...(opts.hairCheap ? { step: 1 / 60, iterations: 2 } : {}),
    });
    inner.add(hair.mesh);
    meshes.push(hair.mesh);
  }
  const torsoBone = joints.get("torso")!;

  return {
    root,
    inner,
    joints,
    rest,
    meshes,
    materials,
    skeleton,
    setBlink,
    hair,
    update(dt: number) {
      if (!hair) return;
      root.updateMatrixWorld(true);
      hair.update(dt, head, torsoBone, inner);
    },
    setGaze(yaw: number, pitch = 0) {
      const g = gazeAngles(yaw, pitch);
      for (const e of eyes) e.mesh.rotation.set(-g.pitch, g.yaw + e.inward, 0);
    },
    dispose() {
      for (const m of meshes) m.geometry.dispose();
      hair?.dispose();
      for (const k of Object.keys(materials) as (keyof HeroMaterials)[]) materials[k].dispose();
      skeleton.dispose();
    },
  };
}

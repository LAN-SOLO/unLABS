import * as THREE from "three";
import type { MaterialClass, MeshData } from "@/lib/voxel/mesher";
import { MATERIAL_CLASSES } from "@/lib/voxel/mesher";

/**
 * Clarity uniforms shared by every voxel material: `uDetail` 0..1 adds
 * surface micro detail as the world gets clearer (see lib/world/clarity.ts);
 * the engine sets it every frame. 0 = the plain pixel-era look.
 */
export const VOXEL_CLARITY = { uDetail: { value: 0 } };

/**
 * Micro detail in world space: roughness variation, faint colour mottling
 * and a fine relief (faded by the pixel footprint so it never shimmers).
 */
function withDetail(
  m: THREE.MeshStandardMaterial,
  key: string,
  /** Relief / roughness-noise strength (metals reflect the sky: less, or they glitter). */
  relief = 1,
): THREE.MeshStandardMaterial {
  m.customProgramCacheKey = () => `voxel-detail-${key}`;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = VOXEL_CLARITY.uDetail;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldP;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vWorldP;
uniform float uDetail;
float vdHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vdNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(vdHash(i), vdHash(i + vec3(1,0,0)), f.x), mix(vdHash(i + vec3(0,1,0)), vdHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(vdHash(i + vec3(0,0,1)), vdHash(i + vec3(1,0,1)), f.x), mix(vdHash(i + vec3(0,1,1)), vdHash(i + vec3(1,1,1)), f.x), f.y), f.z) * 2.0 - 1.0;
}
float vdFade(float f) { return 1.0 - smoothstep(0.3, 0.8, length(fwidth(vWorldP)) * f); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float vdMottle = vdNoise(vWorldP * 0.9) * 0.6 + vdNoise(vWorldP * 3.7) * 0.4;
diffuseColor.rgb *= 1.0 + uDetail * 0.07 * vdMottle;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + uDetail * ${(0.16 * relief).toFixed(3)} * vdNoise(vWorldP * 2.3 + 7.0), 0.04, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
if (uDetail > 0.001) {
  float h = uDetail * ${(0.012 * relief).toFixed(4)} * (vdNoise(vWorldP * 9.0) * vdFade(9.0) + 0.5 * vdNoise(vWorldP * 23.0) * vdFade(23.0));
  vec3 sx = dFdx(-vViewPosition); vec3 sy = dFdy(-vViewPosition);
  vec3 r1 = cross(sy, normal); vec3 r2 = cross(normal, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  vec3 bn = abs(det) * normal - grad;
  if (abs(det) > 1e-12 && dot(bn, bn) > 1e-20) normal = normalize(bn);
}`,
      );
  };
  return m;
}

/** One shared material per class; vertex colors carry palette color + AO. */
export function createVoxelMaterials(): Record<MaterialClass, THREE.Material> {
  return {
    solid: withDetail(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
      "solid",
    ),
    metal: withDetail(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.8 }),
      "metal",
      0.35,
    ),
    glass: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.1,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
    // Emissive voxels ignore lighting; pair with UnrealBloomPass for glow.
    // HDR boost: emissive voxels exceed the bloom threshold, lit surfaces don't.
    emit: new THREE.MeshBasicMaterial({
      vertexColors: true,
      color: new THREE.Color(2.4, 2.4, 2.4),
    }),
  };
}

export function toGeometry(mesh: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  g.setAttribute("color", new THREE.BufferAttribute(mesh.colors, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  mesh.groups.forEach((grp) =>
    g.addGroup(grp.start, grp.count, MATERIAL_CLASSES.indexOf(grp.material)),
  );
  g.computeBoundingSphere();
  return g;
}

/** Mesh with a material array indexed like MATERIAL_CLASSES. */
export function toMesh(
  mesh: MeshData,
  materials: Record<MaterialClass, THREE.Material>,
): THREE.Mesh {
  const m = new THREE.Mesh(
    toGeometry(mesh),
    MATERIAL_CLASSES.map((c) => materials[c]),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Dispose geometry of a mesh tree (materials are shared — dispose them once at shutdown). */
export function disposeGeometry(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}

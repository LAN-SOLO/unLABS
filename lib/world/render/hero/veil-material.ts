/**
 * The veil — how the real Damien is shown while he has not been found.
 * ====================================================================
 *
 * A hologram shader for skinned meshes. In the vertex stage every vertex
 * is snapped to a coarse block grid in rest space (before skinning, so the
 * blocks move with his bones): the face, the beard's shape, the knot all
 * collapse into a mosaic of the same coarse cells — only the silhouette of
 * a tall, heavy man survives. Rows of blocks tear sideways now and then.
 *
 * The fragment stage throws every colour away: each block gets a cold
 * cyan / teal / white value from a hash, blocks drop out as static, a
 * fresnel rim makes the outline glow, scanlines roll through. Additive and
 * transparent, so he reads as light in the room rather than as a body.
 *
 * Uniforms: uTime (s), uSeed (flips the mosaic), uStrength (0 = gone,
 * 1 = fully materialised; also drives the dropout while building up).
 */
import * as THREE from "three";

export interface VeilUniforms {
  uTime: THREE.IUniform<number>;
  uSeed: THREE.IUniform<number>;
  uStrength: THREE.IUniform<number>;
  /** Block edge in model voxels (body). */
  uBlock: THREE.IUniform<number>;
  /** Block edge in model voxels above `uHeadY` (coarser: no feature of the face survives). */
  uHeadBlock: THREE.IUniform<number>;
  uHeadY: THREE.IUniform<number>;
}

export type VeilMaterial = THREE.MeshBasicMaterial & { userData: { veil: VeilUniforms } };

export interface VeilOptions {
  block?: number;
  headBlock?: number;
  headY?: number;
  seed?: number;
}

const COMMON = /* glsl */ `
float vHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
`;

/** One veil material (share it across the parts of a figure; `tick` animates it). */
export function veilMaterial(opts: VeilOptions = {}): VeilMaterial {
  const m = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }) as VeilMaterial;
  const u: VeilUniforms = {
    uTime: { value: 0 },
    uSeed: { value: opts.seed ?? 0 },
    uStrength: { value: 1 },
    uBlock: { value: opts.block ?? 0.9 },
    uHeadBlock: { value: opts.headBlock ?? 1.45 },
    uHeadY: { value: opts.headY ?? 54.6 },
  };
  m.userData.veil = u;
  m.customProgramCacheKey = () => "hero-veil";
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
${COMMON}
uniform float uTime;
uniform float uSeed;
uniform float uBlock;
uniform float uHeadBlock;
uniform float uHeadY;
varying vec3 vCell;
varying vec3 vViewP;
varying float vCellSize;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
{
  float bs = transformed.y > uHeadY ? uHeadBlock : uBlock;
  vec3 cell = floor(transformed / bs);
  vCell = cell;
  vCellSize = bs;
  // Snap to the block centre: the surface becomes a coarse mosaic.
  transformed = (cell + 0.5) * bs;
  // Rows of blocks tear sideways for a moment.
  float row = floor(transformed.y / (bs * 2.0));
  float tick = floor(uTime * 7.0);
  float tear = vHash(vec3(row, tick, uSeed + 3.0));
  if (tear > 0.86) transformed.x += (vHash(vec3(row, tick, uSeed + 9.0)) - 0.5) * bs * 3.0;
}`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
vViewP = mvPosition.xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
${COMMON}
uniform float uTime;
uniform float uSeed;
uniform float uStrength;
varying vec3 vCell;
varying vec3 vViewP;
varying float vCellSize;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  float h = vHash(vCell + vec3(uSeed * 7.0));
  // Static: blocks drop out (more while he is still building up).
  float flick = vHash(vCell + vec3(floor(uTime * 5.0), uSeed, 1.7));
  float drop = 0.1 + 0.85 * (1.0 - uStrength);
  if (flick < drop) discard;
  vec3 cyan = vec3(0.25, 0.9, 1.0);
  vec3 teal = vec3(0.06, 0.42, 0.5);
  vec3 ice = vec3(0.75, 0.98, 1.0);
  vec3 steel = vec3(0.1, 0.16, 0.2);
  vec3 c = h < 0.45 ? cyan : h < 0.72 ? teal : h < 0.9 ? steel : ice;
  // Faceted normal from the mosaic → a glowing rim.
  vec3 n = normalize(cross(dFdx(vViewP), dFdy(vViewP)));
  float fres = pow(1.0 - abs(dot(n, normalize(-vViewP))), 2.2);
  // The outline frays: rim blocks drop out more often (no hard edge to read).
  if (fres > 0.55 && flick < 0.35) discard;
  // Rolling scanlines and a slow shimmer.
  float scan = 0.55 + 0.45 * step(0.5, fract(gl_FragCoord.y / 3.0 + uTime * 0.7));
  float band = 0.75 + 0.25 * sin(vViewP.y * 6.0 - uTime * 3.0);
  float shimmer = 0.8 + 0.4 * vHash(vCell + vec3(floor(uTime * 12.0)));
  c *= (0.28 + 1.5 * fres) * scan * band * shimmer;
  diffuseColor.rgb = c;
  diffuseColor.a = 0.5 * uStrength;
}`,
      );
  };
  return m;
}

/** Advance a veil: time, and a mosaic seed that flips a few times a second. */
export function tickVeil(m: VeilMaterial, time: number): void {
  const u = m.userData.veil;
  u.uTime.value = time;
  u.uSeed.value = Math.floor(time * 2.5) % 2;
}

/**
 * Hair renderer — tens of thousands of strands grown around the guides.
 * =====================================================================
 *
 * The simulation (lib/hair/sim.ts) moves a few hundred guide strands. Every
 * frame their particles (and surface normals) are uploaded into two float
 * textures; one instanced draw then grows all visible strands on the GPU:
 *
 *  - each instance is one strand: its guide, where it sits in the clump
 *    (across the flow and how deep under the surface), its curl phase,
 *    width and colour variation;
 *  - the vertex shader walks the guide's particles, offsets the strand in
 *    the guide's frame (tangent · surface normal · binormal), adds its
 *    curl, and expands a thin ribbon facing the camera; strands thinner
 *    than a pixel keep one pixel and fade (alpha-hashed, so no sorting);
 *  - the fragment shader is a Kajiya–Kay hair model on three.js lights:
 *    a white primary highlight shifted towards the tip, a coloured
 *    secondary one shifted towards the root, wrapped diffuse, and
 *    transmission — back-lit copper hair glows like in the portrait.
 *    Inner strands (deeper in the clump) are darker: cheap self-shadowing.
 *
 * Space: strands are drawn in the hero's inner group (character units); the
 * simulation runs in world space and is mapped back on upload.
 */
import * as THREE from "three";
import { HairSim, type Collider } from "@/lib/hair/sim";
import type { JadeGroom } from "@/lib/world/hero/jade-groom";

export interface HairRenderOptions {
  /** Share of each guide's children to draw (1 = portrait, ~0.25 in the lab). */
  childShare: number;
  /** Base colour (shared with the sculpted hair material, so the wardrobe recolours both). */
  color: THREE.Color;
  /** Head joint rest position (character space): the guides' rest frame origin. */
  headAt: readonly [number, number, number];
  torsoAt: readonly [number, number, number];
  /** Minimum strand width in pixels (sub-pixel strands fade below it). */
  minPixel?: number;
  /** Simulation sub-step (s) and constraint iterations (the lab uses a cheaper 1/60 × 2). */
  step?: number;
  iterations?: number;
}

export interface HairStrands {
  mesh: THREE.Mesh;
  sim: HairSim;
  /** Step the simulation and upload: call once per frame after the skeleton moved. */
  update(dt: number, head: THREE.Object3D, torso: THREE.Object3D, inner: THREE.Object3D): void;
  dispose(): void;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const VERT = /* glsl */ `
uniform sampler2D uPos;
uniform sampler2D uNrm;
uniform float uPoints;
uniform float uGuides;
uniform float uMinPixel;
uniform vec2 uViewport;
attribute float aSeg;
attribute float aSide;
attribute vec4 aStrand;   // guide, across (-1..1), depth (0..1), curl phase
attribute vec4 aShape;    // spreadRoot, spreadTip, depth range, curl radius
attribute vec4 aLook;     // curl turns, width, colour variation, length (0..1)
varying vec3 vTangent;
varying vec3 vNormal;
varying vec3 vViewPos;
varying float vU;
varying float vDepth;
varying float vVar;
varying float vAlpha;

vec3 gp(float g, float i) {
  return texture2D(uPos, vec2((i + 0.5) / uPoints, (g + 0.5) / uGuides)).xyz;
}
vec3 gn(float g, float i) {
  return texture2D(uNrm, vec2((i + 0.5) / uPoints, (g + 0.5) / uGuides)).xyz;
}

void main() {
  float g = aStrand.x;
  float last = uPoints - 1.0;
  // Shorter strands end early: squeeze the parameter.
  float i = aSeg * aLook.w;
  float i0 = floor(i);
  float i1 = min(i0 + 1.0, last);
  float f = i - i0;
  vec3 p = mix(gp(g, i0), gp(g, i1), f);
  vec3 t = gp(g, min(i1 + 0.0, last)) - gp(g, max(i0 - 0.0, 0.0));
  if (dot(t, t) < 1e-10) t = gp(g, last) - gp(g, 0.0);
  t = normalize(t);
  vec3 n = normalize(mix(gn(g, i0), gn(g, i1), f));
  n = normalize(n - t * dot(n, t) + 1e-5);
  vec3 b = normalize(cross(t, n));
  float u = i / last;
  float spread = mix(aShape.x, aShape.y, u);
  // Layers stack outwards from the volume: deep strands lie on it, top strands above.
  // Roots lie flat on the scalp (no visor at the hairline); the layers build up along the strand.
  float depth = (1.0 - aStrand.z) * aShape.z * smoothstep(0.0, 0.35, u);
  float ca = aStrand.w + u * aLook.x * 6.2831853;
  // Frizz: every strand wanders a little off its clump, more towards the tip.
  float fz = aStrand.w * 3.1;
  vec3 frizz = (b * sin(u * 13.0 + fz) + n * cos(u * 9.0 + fz * 1.7)) * (0.012 + 0.05 * u * u);
  vec3 pos = p + frizz + b * (aStrand.y * spread) + n * depth
           + (b * cos(ca) + n * sin(ca)) * aShape.w * (0.4 + u);
  // Ribbon facing the camera.
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 tv = normalize((modelViewMatrix * vec4(t, 0.0)).xyz);
  vec3 side = normalize(cross(tv, normalize(-mv.xyz)) + 1e-6);
  float width = aLook.y * (1.0 - 0.75 * u * u);
  // Pixel footprint of the width: never thinner than uMinPixel, fade instead.
  vec4 clip = projectionMatrix * mv;
  float px = width * projectionMatrix[1][1] * uViewport.y * 0.5 / max(1e-4, clip.w);
  float keep = max(px, uMinPixel);
  // Roots: fine single hairs growing out of the skin (thin and sparse at the hairline).
  vAlpha = clamp(px / uMinPixel, 0.15, 1.0) * mix(0.25, 1.0, smoothstep(0.0, 0.12, u));
  width *= mix(0.35, 1.0, smoothstep(0.0, 0.1, u));
  mv.xyz += side * aSide * width * (keep / max(px, 1e-4)) * 0.5;
  gl_Position = projectionMatrix * mv;
  vTangent = tv;
  vNormal = normalize((modelViewMatrix * vec4(n, 0.0)).xyz);
  vViewPos = mv.xyz;
  vU = u;
  vDepth = aStrand.z;
  vVar = aLook.z;
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <lights_pars_begin>
uniform vec3 uColor;
varying vec3 vTangent;
varying vec3 vNormal;
varying vec3 vViewPos;
varying float vU;
varying float vDepth;
varying float vVar;
varying float vAlpha;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Marschner hair (the real-time form of Karis, "Physically Based Hair Shading
// in Unreal", 2016): three light paths through a dielectric fibre (IOR 1.55)
// — R (surface reflection, white, shifted towards the root), TT (through the
// fibre, coloured: the glow of back-lit copper hair) and TRT (inside reflection,
// coloured second highlight) — plus a wrapped, tinted multiple-scattering term.
const float HAIR_IOR = 1.55;
const float HAIR_ROUGH = 0.34;
const float HAIR_SCATTER = 0.42;

float hairG(float b, float t) { return exp(-0.5 * t * t / (b * b)) / (2.5066283 * b); }
float hairF(float c) {
  float f0 = (1.0 - HAIR_IOR) / (1.0 + HAIR_IOR);
  f0 *= f0;
  float m = 1.0 - c;
  return f0 + (1.0 - f0) * m * m * m * m * m;
}

vec3 strandLight(vec3 L, vec3 radiance, vec3 V, vec3 T, vec3 N, vec3 base) {
  float sinL = clamp(dot(T, L), -1.0, 1.0);
  float sinV = clamp(dot(T, V), -1.0, 1.0);
  float cosD = cos(0.5 * abs(asin(sinV) - asin(sinL)));
  vec3 lp = L - sinL * T;
  vec3 vp = V - sinV * T;
  float cosPhi = dot(lp, vp) * inversesqrt(dot(lp, lp) * dot(vp, vp) + 1e-4);
  float cosHalfPhi = sqrt(clamp(0.5 + 0.5 * cosPhi, 0.0, 1.0));
  float nP = 1.19 / max(cosD, 1e-3) + 0.36 * cosD;
  float r2 = HAIR_ROUGH * HAIR_ROUGH;
  float shift = 0.035;
  vec3 S = vec3(0.0);
  // R
  {
    float sa = sin(-2.0 * shift);
    float ca = cos(-2.0 * shift);
    float sh = 2.0 * sa * (ca * cosHalfPhi * sqrt(max(0.0, 1.0 - sinV * sinV)) + sa * sinV);
    float Mp = hairG(r2 * 1.4142 * cosHalfPhi + 1e-3, sinL + sinV - sh);
    float Np = 0.25 * cosHalfPhi;
    float Fp = hairF(sqrt(clamp(0.5 + 0.5 * dot(L, V), 0.0, 1.0)));
    S += vec3(Mp * Np * Fp);
  }
  // TT
  {
    float Mp = hairG(r2 * 0.5 + 1e-3, sinL + sinV - shift);
    float a = 1.0 / nP;
    float h = cosHalfPhi * (1.0 + a * (0.6 - 0.8 * cosPhi));
    float f = hairF(cosD * sqrt(clamp(1.0 - h * h, 0.0, 1.0)));
    float Fp = (1.0 - f) * (1.0 - f);
    vec3 Tp = pow(max(base, vec3(1e-3)), vec3(0.5 * sqrt(max(0.0, 1.0 - h * h * a * a)) / max(cosD, 1e-3)));
    float Np = exp(-3.65 * cosPhi - 3.98);
    S += Mp * Np * Fp * Tp;
  }
  // TRT
  {
    float Mp = hairG(r2 * 2.0 + 1e-3, sinL + sinV - 4.0 * shift);
    float f = hairF(cosD * 0.5);
    float Fp = (1.0 - f) * (1.0 - f) * f;
    vec3 Tp = pow(max(base, vec3(1e-3)), vec3(0.8 / max(cosD, 1e-3)));
    float Np = exp(17.0 * cosPhi - 16.78);
    S += Mp * Np * Fp * Tp;
  }
  // Multiple scattering inside the hair volume (wrapped, tinted, darker deep in the clump).
  vec3 fakeN = normalize(V - T * sinV);
  float kajiya = 1.0 - abs(sinL);
  float nol = clamp((dot(fakeN, L) + 1.0) * 0.25, 0.0, 1.0);
  float lum = max(1e-3, dot(base, vec3(0.2126, 0.7152, 0.0722)));
  vec3 tint = pow(base / lum, vec3(0.6));
  S += sqrt(base) * (mix(nol, kajiya, 0.33) / 3.14159 * HAIR_SCATTER) * tint;
  // Fibres also take some plain diffuse light (keeps them readable in flat light).
  float diffuse = clamp(0.45 + 0.55 * dot(N, L), 0.15, 1.0) * mix(0.2, 0.85, sqrt(max(0.0, 1.0 - sinL * sinL)));
  return radiance * (S * 2.6 + base * diffuse * 0.3);
}

void main() {
  if (hash12(gl_FragCoord.xy + vVar * 97.0) > vAlpha) discard;
  vec3 T = normalize(vTangent);
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPos);
  // Colour: per-strand variation, darker roots, sun-lighter ends, darker inside the clump.
  // Copper with redder and lighter strands mixed in.
  vec3 base = uColor * (0.72 + 0.4 * vVar) * mix(vec3(1.0, 0.82, 0.78), vec3(1.0, 1.05, 1.0), vVar);
  base *= mix(0.55, 1.05, smoothstep(0.0, 0.6, vU));
  base *= mix(1.0, 0.55, vDepth);
  vec3 col = vec3(0.0);
#if NUM_DIR_LIGHTS > 0
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
    DirectionalLight dl = directionalLights[i];
    col += strandLight(dl.direction, dl.color, V, T, N, base);
  }
#endif
#if NUM_POINT_LIGHTS > 0
  for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
    PointLight pl = pointLights[i];
    vec3 lv = pl.position - vViewPos;
    float d = length(lv);
    float att = getDistanceAttenuation(d, pl.distance, pl.decay);
    col += strandLight(lv / d, pl.color * att, V, T, N, base);
  }
#endif
#if NUM_SPOT_LIGHTS > 0
  for (int i = 0; i < NUM_SPOT_LIGHTS; i++) {
    SpotLight sl = spotLights[i];
    vec3 lv = sl.position - vViewPos;
    float d = length(lv);
    vec3 L = lv / d;
    float cosA = dot(L, sl.direction);
    float cone = getSpotAttenuation(sl.coneCos, sl.penumbraCos, cosA);
    float att = getDistanceAttenuation(d, sl.distance, sl.decay);
    col += strandLight(L, sl.color * att * cone, V, T, N, base);
  }
#endif
  vec3 amb = ambientLightColor;
#if NUM_HEMI_LIGHTS > 0
  for (int i = 0; i < NUM_HEMI_LIGHTS; i++) amb += getHemisphereLightIrradiance(hemisphereLights[i], N);
#endif
  col += base * amb * 0.6;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Build the strand mesh + simulation for a groom. */
export function createHairStrands(groom: JadeGroom, opts: HairRenderOptions): HairStrands {
  const G = groom.guides.length;
  const P = groom.points;
  const sim = new HairSim(groom.guides, {
    drag: 0.04,
    iterations: opts.iterations ?? 3,
    step: opts.step ?? 1 / 90,
  });
  // Collisions (head space = character space): skull, neck, shoulders.
  const head = opts.headAt;
  const colliders: Collider[] = [
    { frame: "head", a: [0, 57.2, -0.9], r: 3.05 },
    { frame: "head", a: [0, 55.0, 0.0], b: [0, 53.0, 0.6], r: 2.1 },
    { frame: "body", a: [0, 49.4, -0.9], b: [0, 53.2, -0.85], r: 1.95 },
    { frame: "body", a: [-4.6, 48.6, -0.6], b: [4.6, 48.6, -0.6], r: 1.25 },
  ];
  for (const c of colliders) sim.addCollider(c);

  // Instances: every child strand of every guide.
  const r = rng(0x5eed);
  const strand: number[] = [];
  const shape: number[] = [];
  const look: number[] = [];
  groom.guides.forEach((g, gi) => {
    const n = Math.max(
      g.kind === "wisp" || g.kind === "flyaway" ? 1 : 2,
      Math.round(g.children * opts.childShare),
    );
    for (let c = 0; c < n; c++) {
      // Across: denser in the clump's middle; depth: most strands near the surface.
      const across = (r() + r() + r()) / 1.5 - 1;
      const depth = Math.pow(r(), 1.6);
      strand.push(gi, across, depth, r() * Math.PI * 2);
      shape.push(g.spreadRoot, g.spreadTip, g.depth, g.curl * (0.5 + r()));
      look.push(
        g.curlTurns * (0.7 + 0.6 * r()),
        g.width * (0.7 + 0.6 * r()),
        r(),
        0.82 + 0.18 * r(),
      );
    }
  });
  const count = strand.length / 4;

  const base = new THREE.InstancedBufferGeometry();
  const seg = new Float32Array(P * 2);
  const sideA = new Float32Array(P * 2);
  for (let i = 0; i < P; i++) {
    seg[i * 2] = i;
    seg[i * 2 + 1] = i;
    sideA[i * 2] = -1;
    sideA[i * 2 + 1] = 1;
  }
  const idx: number[] = [];
  for (let i = 0; i < P - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  // `position` is unused by the shader but three needs one for the draw range.
  base.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P * 2 * 3), 3));
  base.setAttribute("aSeg", new THREE.BufferAttribute(seg, 1));
  base.setAttribute("aSide", new THREE.BufferAttribute(sideA, 1));
  base.setIndex(idx);
  base.setAttribute("aStrand", new THREE.InstancedBufferAttribute(new Float32Array(strand), 4));
  base.setAttribute("aShape", new THREE.InstancedBufferAttribute(new Float32Array(shape), 4));
  base.setAttribute("aLook", new THREE.InstancedBufferAttribute(new Float32Array(look), 4));
  base.instanceCount = count;

  const posData = new Float32Array(P * G * 4);
  const nrmData = new Float32Array(P * G * 4);
  const posTex = new THREE.DataTexture(posData, P, G, THREE.RGBAFormat, THREE.FloatType);
  const nrmTex = new THREE.DataTexture(nrmData, P, G, THREE.RGBAFormat, THREE.FloatType);
  for (const t of [posTex, nrmTex]) {
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
  }
  // Rest data in character space as the first upload.
  const restNormals = new Float32Array(P * G * 3);
  groom.guides.forEach((g, gi) => {
    for (let i = 0; i < P; i++) {
      const k = gi * P + i;
      posData[k * 4] = g.rest[i * 3]!;
      posData[k * 4 + 1] = g.rest[i * 3 + 1]!;
      posData[k * 4 + 2] = g.rest[i * 3 + 2]!;
      restNormals[k * 3] = g.normals[i * 3]!;
      restNormals[k * 3 + 1] = g.normals[i * 3 + 1]!;
      restNormals[k * 3 + 2] = g.normals[i * 3 + 2]!;
      nrmData[k * 4] = g.normals[i * 3]!;
      nrmData[k * 4 + 1] = g.normals[i * 3 + 1]!;
      nrmData[k * 4 + 2] = g.normals[i * 3 + 2]!;
    }
  });

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    lights: true,
    side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      {
        uPos: { value: null },
        uNrm: { value: null },
        uPoints: { value: P },
        uGuides: { value: G },
        uMinPixel: { value: opts.minPixel ?? 0.9 },
        uViewport: { value: new THREE.Vector2(1280, 800) },
        uColor: { value: null },
      },
    ]),
  });
  material.uniforms.uPos!.value = posTex;
  material.uniforms.uNrm!.value = nrmTex;
  // Shared colour object: the wardrobe recolours the sculpted hair and the strands together.
  material.uniforms.uColor!.value = opts.color;

  const mesh = new THREE.Mesh(base, material);
  mesh.name = "hairStrands";
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const vp = new THREE.Vector4();
  mesh.onBeforeRender = (renderer) => {
    renderer.getCurrentViewport(vp);
    (material.uniforms.uViewport!.value as THREE.Vector2).set(vp.z, vp.w);
  };

  // Scratch for the per-frame mapping.
  const headM = new THREE.Matrix4();
  const torsoM = new THREE.Matrix4();
  const offH = new THREE.Matrix4().makeTranslation(-head[0], -head[1], -head[2]);
  const offT = new THREE.Matrix4().makeTranslation(
    -opts.torsoAt[0],
    -opts.torsoAt[1],
    -opts.torsoAt[2],
  );
  const invInner = new THREE.Matrix4();
  const rot = new THREE.Matrix3();
  const scale = new THREE.Vector3();
  const v = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const relM = new THREE.Matrix4();

  return {
    mesh,
    sim,
    update(dt, headBone, torsoBone, inner) {
      headM.multiplyMatrices(headBone.matrixWorld, offH);
      torsoM.multiplyMatrices(torsoBone.matrixWorld, offT);
      inner.matrixWorld.decompose(v, quat, scale);
      const unit = scale.x || 1;
      sim.setScale(unit);
      // Gravity: 9.81 m/s² with 1 model voxel ≈ 2.78 cm.
      sim.setGravity([0, (-9.81 / 0.0278) * unit, 0]);
      sim.update(dt, headM.elements, torsoM.elements);
      // World → inner (character units) for drawing.
      invInner.copy(inner.matrixWorld).invert();
      const e = invInner.elements;
      const p = sim.pos;
      for (let k = 0, n = P * G; k < n; k++) {
        const x = p[k * 3]!;
        const y = p[k * 3 + 1]!;
        const z = p[k * 3 + 2]!;
        posData[k * 4] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
        posData[k * 4 + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
        posData[k * 4 + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
      }
      // Normals: the rest normals turned with the head (relative to the inner group).
      const rel = relM.multiplyMatrices(invInner, headBone.matrixWorld);
      rot.setFromMatrix4(rel);
      const m = rot.elements;
      for (let k = 0, n = P * G; k < n; k++) {
        const x = restNormals[k * 3]!;
        const y = restNormals[k * 3 + 1]!;
        const z = restNormals[k * 3 + 2]!;
        const nx = m[0]! * x + m[3]! * y + m[6]! * z;
        const ny = m[1]! * x + m[4]! * y + m[7]! * z;
        const nz = m[2]! * x + m[5]! * y + m[8]! * z;
        const l = Math.hypot(nx, ny, nz) || 1;
        nrmData[k * 4] = nx / l;
        nrmData[k * 4 + 1] = ny / l;
        nrmData[k * 4 + 2] = nz / l;
      }
      posTex.needsUpdate = true;
      nrmTex.needsUpdate = true;
    },
    dispose() {
      base.dispose();
      material.dispose();
      posTex.dispose();
      nrmTex.dispose();
    },
  };
}

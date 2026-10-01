/**
 * Hero materials — physically based shading for the "real" characters.
 * =====================================================================
 *
 * Every hero surface is a `MeshPhysicalMaterial` with a procedural layer
 * injected through `onBeforeCompile`: the builder passes each vertex's
 * rest position (`rest`, character space in model voxels), and the
 * fragment shader paints and bumps the surface from it — no textures, so
 * any look recolours instantly and the detail never blurs up close.
 *
 *  - skin:  mottling, warm cheeks / nose / ears, silver lids, a winged
 *           liner, copper brows, dusty lips; pore-scale bump; sheen as a
 *           cheap subsurface glow at grazing angles
 *  - hair:  strands along the flow, darker roots, lighter ends, a streaky
 *           bump so highlights break up like real hair
 *  - cloth: shirt weave, the geometric print inside the stand collar,
 *           twill on the trousers, the lab coat's poplin
 *  - boots: leather grain, a darker sole and the welt stitching
 *  - eyes:  sclera, a brown fibrous iris, pupil, limbal ring, a clearcoat
 *           cornea
 *
 * Bumps are faded by the pixel footprint (`fwidth`), so the in-game view
 * (a character ~150 px tall) never shimmers.
 */
import * as THREE from "three";
import type { HeroMaterial } from "@/lib/world/hero/jade-sculpt";
import { JADE_HEX, type HeroColorKey } from "@/lib/world/hero/look-colors";

export type HeroMaterialKey = HeroMaterial | "eye" | "coat" | "belt" | "watch";

export interface HeroColors {
  skin: THREE.Color;
  hair: THREE.Color;
  brows: THREE.Color;
  shirt: THREE.Color;
  shirtAccent: THREE.Color;
  trousers: THREE.Color;
  boots: THREE.Color;
  coat: THREE.Color;
  belt: THREE.Color;
  watch: THREE.Color;
  /** The watch's lit dial ring (defaults to `watch`). */
  watchFace?: THREE.Color;
  iris: THREE.Color;
}

export function srgb(hex: string): THREE.Color {
  return new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
}

/** HeroColors from sRGB hex strings (see lib/world/hero/look-colors.ts). */
export function heroColorsFromHex(h: Readonly<Record<HeroColorKey, string>>): HeroColors {
  return {
    skin: srgb(h.skin),
    hair: srgb(h.hair),
    brows: srgb(h.brows),
    shirt: srgb(h.shirt),
    shirtAccent: srgb(h.shirtAccent),
    trousers: srgb(h.trousers),
    boots: srgb(h.boots),
    coat: srgb(h.coat),
    belt: srgb(h.belt),
    watch: srgb(h.watch),
    watchFace: srgb(h.watchFace),
    iris: srgb(h.iris),
  };
}

export const JADE_DEFAULT_COLORS = (): HeroColors => heroColorsFromHex(JADE_HEX);

// ── GLSL building blocks ────────────────────────────────────────

const NOISE = /* glsl */ `
float hHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float hNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hHash(i + vec3(0, 0, 0)), hHash(i + vec3(1, 0, 0)), f.x),
                 mix(hHash(i + vec3(0, 1, 0)), hHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hHash(i + vec3(0, 0, 1)), hHash(i + vec3(1, 0, 1)), f.x),
                 mix(hHash(i + vec3(0, 1, 1)), hHash(i + vec3(1, 1, 1)), f.x), f.y), f.z) * 2.0 - 1.0;
}
float hFbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * hNoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
/** Detail fade: 1 while a feature of frequency f (cycles / voxel) is resolved by the pixels. */
float hResolve(vec3 p, float f) {
  float fw = length(fwidth(p));
  return 1.0 - smoothstep(0.25, 0.7, fw * f);
}
/** Mikkelsen's surface-gradient bump (unnormalised sigmas: height in view units). */
vec3 hPerturb(vec3 surfPos, vec3 n, float h, float faceDirection) {
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDirection;
  vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  vec3 bn = abs(det) * n - grad;
  return abs(det) > 1e-12 && dot(bn, bn) > 1e-20 ? normalize(bn) : n;
}
`;

/**
 * Skin lighting: the physical chunk with a red-shifted wrap on the diffuse
 * term — light bleeds a little past the terminator, more in red than in
 * blue, like light scattering under real skin (cheap subsurface).
 */
const SSS_DIFFUSE =
  "\treflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );";
const SSS_WRAPPED = `\tfloat ndlW = dot( geometryNormal, directLight.direction );
\tvec3 wrapIrr = vec3( saturate( ( ndlW + 0.5 ) / 1.5 ), saturate( ( ndlW + 0.24 ) / 1.24 ), saturate( ( ndlW + 0.16 ) / 1.16 ) );
\treflectedLight.directDiffuse += wrapIrr * directLight.color * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F ) * 0.92;`;

function skinLightsChunk(): string {
  const src = THREE.ShaderChunk.lights_physical_pars_fragment;
  return src.includes(SSS_DIFFUSE) ? src.replace(SSS_DIFFUSE, SSS_WRAPPED) : src;
}

/**
 * Strand shells: the hair paint, plus a mask of thin strands along the flow
 * that discards the gaps. `thr` = share of the shell left out; `lowRes` =
 * what the shell does when the strands are below a pixel (1 keep, 0 drop).
 */
function HAIR_SHELL(thr: number, lowRes: number): string {
  return /* glsl */ `
    vec3 p = vRest;
    float th = atan(p.x - 0.2, p.z + 0.9);
    float along = length(p - vec3(0.2, 62.3, -0.9));
    float s1 = hNoise(vec3(th * 13.0, along * 0.22, 0.5));
    float s2 = hNoise(vec3(th * 55.0 + s1 * 2.0, along * 0.45, 2.5));
    float strands = hNoise(vec3(th * 150.0 + s1 * 9.0 + s2 * 3.0, along * 0.3, 11.5)) * 0.5 + 0.5;
    float res = hResolve(p, 40.0);
    float keep = mix(${lowRes.toFixed(2)}, step(${thr.toFixed(2)}, strands), res);
    if (keep < 0.5) discard;
    paint = uBase * (0.74 + 0.22 * s1 + 0.14 * s2) * mix(0.66, 1.1, smoothstep(54.0, 62.0, p.y));
    paint = mix(paint, uBase * vec3(1.3, 1.18, 0.86), smoothstep(0.75, 0.95, strands) * 0.4);
    rough = 0.42 + 0.1 * s1;
    bump = 0.01 * s2 * hResolve(p, 10.0);
  `;
}

/** Per-material paint + bump: sets `paint` (albedo), `rough`, `bump` (height in voxels). */
const PAINT: Record<HeroMaterialKey, string> = {
  skin: /* glsl */ `
    vec3 p = vRest;
    paint = uBase;
    rough = 0.5;
    float mottled = hFbm(p * 2.6);
    paint *= 1.0 + 0.05 * mottled;
    float front = smoothstep(1.2, 2.2, p.z);
    // Warmth: cheeks, nose tip, ears, knuckles.
    float warm = 0.0;
    for (int i = 0; i < 2; i++) {
      float s = i == 0 ? -1.0 : 1.0;
      vec2 c = (p.xy - vec2(s * 1.5, 55.1)) / vec2(0.95, 0.75);
      warm += exp(-dot(c, c)) * front;
      warm += smoothstep(2.1, 2.55, abs(p.x)) * smoothstep(-1.4, -0.2, p.z) * smoothstep(1.2, 0.2, p.z) * smoothstep(54.8, 55.6, p.y) * smoothstep(57.6, 56.9, p.y) * 0.8;
    }
    float nt = length(p - vec3(0.0, 55.45, 3.4));
    warm += 0.7 * exp(-nt * nt * 4.0);
    warm += 0.5 * smoothstep(31.0, 26.0, p.y);
    paint = mix(paint, paint * vec3(1.0, 0.8, 0.76), clamp(warm, 0.0, 1.0) * 0.42);
    // Colour zones: cooler, a touch darker under the eyes; a warm nose bridge and chin.
    for (int i = 0; i < 2; i++) {
      float s = i == 0 ? -1.0 : 1.0;
      vec2 ue = (p.xy - vec2(s * 1.05, 56.1)) / vec2(0.5, 0.18);
      paint *= 1.0 - 0.06 * exp(-dot(ue, ue)) * front * vec3(1.0, 1.1, 0.7);
    }
    float bridge = exp(-pow(p.x / 0.3, 2.0)) * smoothstep(54.9, 55.6, p.y) * smoothstep(57.2, 56.4, p.y) * front;
    paint = mix(paint, paint * vec3(1.0, 0.86, 0.82), bridge * 0.3);
    float chin = exp(-dot((p.xy - vec2(0.0, 53.0)) / vec2(0.6, 0.45), (p.xy - vec2(0.0, 53.0)) / vec2(0.6, 0.45))) * front;
    paint = mix(paint, paint * vec3(1.0, 0.88, 0.84), chin * 0.25);
    // Oil: the T-zone shines a little more.
    float tz = max(exp(-pow(p.x / 0.35, 2.0)) * smoothstep(54.9, 55.5, p.y), exp(-pow(p.x / 1.4, 2.0)) * smoothstep(57.4, 58.2, p.y)) * front;
    rough = mix(rough, 0.36, tz);
    // Freckles, faint.
    float fr = smoothstep(0.62, 0.8, hNoise(p * 14.0)) * front * smoothstep(57.5, 55.5, p.y) * smoothstep(54.2, 55.0, p.y);
    paint = mix(paint, paint * vec3(0.86, 0.68, 0.58), fr * 0.35);
    // Eyes: silver lids, the winged liner, lash lines, brows.
    for (int i = 0; i < 2; i++) {
      float s = i == 0 ? -1.0 : 1.0;
      float u = (s * p.x - 1.1) / 0.55;
      float v = p.y - 56.55;
      float fz = smoothstep(1.65, 2.08, p.z);
      // Same almond as the sculpted lids (jade-sculpt.ts lidShell): a smiling eye.
      float upper = 0.16 * (1.0 - u * u) + 0.05 * u - 0.03;
      float lower = -0.11 * (1.0 - u * u) + 0.04 * u - 0.02;
      // Eyeshadow: pearly silver from the lash line up to the brow (the portrait).
      float shadowTop = upper + 0.62 - 0.1 * u * u;
      float sh = smoothstep(1.45, 1.1, abs(u)) * smoothstep(upper - 0.02, upper + 0.03, v) * smoothstep(shadowTop + 0.12, shadowTop - 0.08, v);
      sh += 0.6 * smoothstep(1.7, 1.2, u) * smoothstep(0.8, 1.2, u) * smoothstep(upper + 0.35, upper, v) * smoothstep(upper - 0.25, upper, v);
      sh = clamp(sh, 0.0, 1.0) * fz;
      paint = mix(paint, vec3(0.86, 0.88, 0.93), sh * 0.95);
      rough = mix(rough, 0.26, sh);
      // Liner on the upper lash line, thickening outwards, then the wing.
      float lu = abs(u) < 1.02 ? abs(v - upper) - (0.026 + 0.055 * max(u, 0.0)) : 1.0;
      vec2 w0 = vec2(0.9, 0.06);
      vec2 w1 = vec2(1.95, 0.68);
      vec2 q = vec2(u, v / 0.55) - w0;
      vec2 wd = w1 - w0;
      float t = clamp(dot(q, wd) / dot(wd, wd), 0.0, 1.0);
      float wing = length(q - wd * t) * 0.55 - mix(0.06, 0.005, t);
      float liner = min(lu, wing);
      float lin = (1.0 - smoothstep(-0.004, 0.012, liner)) * fz;
      // Lower lash line: soft, outer half.
      float ll = (1.0 - smoothstep(0.0, 0.03, abs(v - lower) - 0.008)) * smoothstep(-0.2, 0.6, u) * step(abs(u), 1.0) * fz * 0.6;
      paint = mix(paint, vec3(0.015, 0.012, 0.012), clamp(lin + ll, 0.0, 1.0));
      rough = mix(rough, 0.35, lin);
      // Brows: a soft arch of fine strands.
      float bu = u + 0.05;
      float by = 57.27 + 0.2 * (1.0 - 0.6 * (bu - 0.25) * (bu - 0.25)) - 56.55;
      float bw = mix(0.13, 0.05, smoothstep(-0.8, 1.35, bu));
      float bm = smoothstep(bw, bw * 0.4, abs(v - by)) * smoothstep(1.45, 1.2, bu) * smoothstep(-1.05, -0.8, bu);
      float strand = 0.6 + 0.4 * hNoise(vec3(u * 40.0 + v * 30.0, v * 8.0, 1.0));
      paint = mix(paint, uAccent, bm * strand * front);
    }
    // Soft hairline: fine copper baby hairs fading into the skin.
    float hl = 56.5 + (p.z + 0.9) * 0.55 + 0.25 * max(0.0, 1.0 - (p.x / 2.2) * (p.x / 2.2)) * smoothstep(0.6, 2.2, p.z);
    float below = hl - p.y;
    float edge = smoothstep(0.28, 0.0, below) * step(-0.9, p.z) * step(53.8, p.y);
    float hairs = smoothstep(0.1, 0.7, hNoise(vec3(atan(p.x - 0.2, p.z + 0.9) * 90.0, p.y * 3.0, 0.0)));
    paint = mix(paint, uAccent * 0.85, edge * mix(0.05, 0.22, hairs) * smoothstep(-0.1, 0.2, 0.28 - below));
    // Nasolabial folds: a soft shadow line from the nose wing to the mouth corner.
    for (int i = 0; i < 2; i++) {
      float s = i == 0 ? -1.0 : 1.0;
      vec2 a0 = vec2(s * 0.5, 55.08);
      vec2 a1 = vec2(s * 0.98, 54.2);
      vec2 ab = a1 - a0;
      float tt = clamp(dot(p.xy - a0, ab) / dot(ab, ab), 0.0, 1.0);
      float dd = length(p.xy - (a0 + ab * tt));
      float fold = exp(-dd * dd / 0.004) * smoothstep(0.0, 0.25, tt) * smoothstep(1.0, 0.7, tt) * front;
      paint *= 1.0 - 0.12 * fold;
    }
    // Lips: the vermilion between the mouth line and the lip borders —
    // a cupid's bow on top, a fuller curve below; dusty rose, a little glossy.
    float mlY = 54.6 + 0.12 * p.x * p.x;
    float ax = abs(p.x);
    float upB = 54.77 + 0.03 * smoothstep(0.0, 0.18, ax) - 0.03 * smoothstep(0.18, 0.4, ax) - 0.12 * smoothstep(0.35, 1.2, ax) * smoothstep(0.35, 1.2, ax) + 0.12 * p.x * p.x;
    float loB = 54.36 + 0.24 * p.x * p.x;
    float inUp = smoothstep(upB + 0.015, upB - 0.02, p.y) * smoothstep(mlY - 0.01, mlY + 0.01, p.y);
    float inLo = smoothstep(loB - 0.02, loB + 0.025, p.y) * smoothstep(mlY + 0.01, mlY - 0.01, p.y);
    float lips = clamp(inUp + inLo, 0.0, 1.0) * smoothstep(1.2, 1.02, ax) * smoothstep(1.9, 2.2, p.z);
    // Pale rose (the portrait): close to the skin, a touch pinker.
    vec3 lipCol = vec3(0.62, 0.3, 0.3) * mix(0.85, 1.0, inLo);
    paint = mix(paint, lipCol, lips * 0.7);
    rough = mix(rough, mix(0.4, 0.28, inLo), lips);
    // The darker line where the lips meet.
    float ml = 1.0 - smoothstep(0.0, 0.025, abs(p.y - mlY));
    paint = mix(paint, vec3(0.3, 0.1, 0.1), ml * smoothstep(0.95, 0.5, ax) * smoothstep(2.0, 2.3, p.z) * 0.7);
    // Pores and fine lines.
    bump = 0.004 * hNoise(p * 45.0) * hResolve(p, 45.0) + 0.006 * hFbm(p * 9.0) * hResolve(p, 9.0);
  `,
  hair: /* glsl */ `
    vec3 p = vRest;
    // Strands run towards the twist on top: azimuth around it is the strand id.
    float th = atan(p.x - 0.2, p.z + 0.9);
    float along = length(p - vec3(0.2, 62.3, -0.9));
    float s1 = hNoise(vec3(th * 13.0, along * 0.22, 0.5));
    float s2 = hNoise(vec3(th * 55.0 + s1 * 2.0, along * 0.45, 2.5));
    float s3 = hNoise(vec3(th * 170.0 + s1 * 6.0, along * 0.8, 4.5));
    float s4 = hNoise(vec3(th * 420.0 + s2 * 9.0, along * 1.4, 7.5));
    float clump = hFbm(p * 0.7);
    float r3 = hResolve(p, 25.0);
    float r4 = hResolve(p, 60.0);
    // Base: deep copper under-layers, bright copper on top, a few golden strands.
    paint = uBase * (0.72 + 0.2 * s1 + 0.12 * s2 + 0.1 * s3 * r3 + 0.06 * s4 * r4 + 0.08 * clump);
    float gold = smoothstep(0.55, 0.85, s3) * r3;
    paint = mix(paint, uBase * vec3(1.25, 1.15, 0.85), gold * 0.35);
    // Deeper at the roots and the nape, brighter where the strands lift.
    paint *= mix(0.62, 1.12, smoothstep(54.0, 62.0, p.y));
    // Clumps separate: dark gaps between them.
    paint *= 1.0 - 0.28 * smoothstep(0.35, 0.8, -s2) * r3;
    // Under the strand shells: the inner layers get a little less light.
    paint *= 0.9;
    rough = 0.44 + 0.12 * s1 + 0.06 * s3;
    bump = 0.016 * s2 * hResolve(p, 10.0) + 0.007 * s3 * r3 + 0.003 * s4 * r4;
  `,
  hairShell: HAIR_SHELL(0.55, 1.0),
  hairShell2: HAIR_SHELL(0.78, 0.0),
  shirt: /* glsl */ `
    vec3 p = vRest;
    paint = uBase;
    rough = 0.78;
    float weave = sin(p.x * 60.0 + p.z * 60.0) * sin(p.y * 60.0);
    // Geometric print inside the stand collar and under the placket.
    float r = length(vec2(p.x, p.z + 0.8));
    float R = 2.07 - (p.y - 50.0) * 0.05;
    float inner = step(49.9, p.y) * step(r, R - 0.02);
    vec2 g = vec2(p.x + p.y, p.y - p.x + p.z) * 2.2;
    float tri = step(0.5, fract(g.x)) * step(fract(g.y), fract(g.x));
    float geo = mix(0.2, 0.62, tri);
    paint = mix(paint, uAccent * geo * 1.4, inner);
    paint *= 0.97 + 0.03 * hNoise(p * 3.0);
    bump = 0.0025 * weave * hResolve(p, 20.0);
  `,
  coat: /* glsl */ `
    vec3 p = vRest;
    paint = uBase * (0.96 + 0.04 * hNoise(p * 2.0));
    rough = 0.72;
    bump = 0.002 * sin(p.x * 70.0 + p.y * 70.0) * hResolve(p, 22.0);
  `,
  trousers: /* glsl */ `
    vec3 p = vRest;
    float twill = sin((p.y + p.x * 0.8 + p.z * 0.8) * 42.0);
    paint = uBase * (0.93 + 0.07 * hNoise(p * 1.6) + 0.03 * twill);
    rough = 0.82;
    bump = 0.003 * twill * hResolve(p, 13.0);
  `,
  boots: /* glsl */ `
    vec3 p = vRest;
    float grain = hFbm(p * 16.0);
    paint = uBase * (0.9 + 0.12 * grain);
    rough = 0.42 + 0.1 * grain;
    // Sole and welt stitching.
    float sole = 1.0 - smoothstep(0.34, 0.4, p.y);
    paint = mix(paint, vec3(0.03, 0.028, 0.026), sole);
    rough = mix(rough, 0.8, sole);
    float stitch = step(0.5, fract((p.x + p.z) * 9.0)) * smoothstep(0.52, 0.47, abs(p.y - 0.5)) * (1.0 - sole);
    paint = mix(paint, uAccent, stitch * 0.0);
    // Creases over the instep.
    float crease = smoothstep(0.7, 1.0, hNoise(vec3(p.z * 5.0, p.y * 1.0, p.x))) * smoothstep(1.2, 2.2, p.y) * smoothstep(3.6, 2.6, p.y);
    bump = 0.004 * grain * hResolve(p, 16.0) - 0.02 * crease;
  `,
  trim: /* glsl */ `
    paint = uBase;
    rough = 0.22;
    bump = 0.0;
  `,
  belt: /* glsl */ `
    vec3 p = vRest;
    float grain = hFbm(p * 14.0);
    paint = uBase * (0.88 + 0.14 * grain);
    rough = 0.5;
    bump = 0.003 * grain * hResolve(p, 14.0);
  `,
  watch: /* glsl */ `
    vec3 p = vRest;
    // Band in the colourway; the dial on the outer side is dark glass with a lit ring.
    float dial = smoothstep(7.86, 7.9, p.x);
    vec2 dc = vec2(p.y - 30.95, p.z + 0.25);
    float ring = smoothstep(0.05, 0.0, abs(length(dc) - 0.24));
    paint = mix(uBase * 0.9, vec3(0.02, 0.025, 0.03), dial);
    paint = mix(paint, uAccent * 1.6, ring * dial);
    rough = mix(0.45, 0.08, dial);
    bump = 0.0;
  `,
  eye: /* glsl */ `
    vec3 d = normalize(vRest);
    float a = acos(clamp(d.z, -1.0, 1.0));
    // A large dark iris and a soft, shaded sclera (the portrait).
    float iris = 0.67;
    float pupil = 0.26;
    vec3 sclera = vec3(0.56, 0.53, 0.51) * (1.0 - 0.25 * smoothstep(0.7, 1.5, a));
    float veins = smoothstep(0.55, 0.8, hNoise(d * 18.0)) * smoothstep(1.0, 1.6, a) * 0.3;
    sclera = mix(sclera, vec3(0.75, 0.35, 0.33), veins);
    float ang = atan(d.y, d.x);
    float fib = 0.75 + 0.25 * hNoise(vec3(ang * 12.0, a * 30.0, 0.0));
    vec3 irisC = uBase * fib * mix(1.35, 0.7, smoothstep(pupil, iris, a));
    irisC = mix(irisC, uBase * 1.9, smoothstep(0.4, 0.33, a) * 0.35);
    float limbal = smoothstep(iris - 0.12, iris, a);
    irisC = mix(irisC, vec3(0.03), limbal * 0.8);
    paint = mix(irisC, sclera, smoothstep(iris - 0.01, iris + 0.03, a));
    paint = mix(vec3(0.005), paint, smoothstep(pupil - 0.02, pupil + 0.01, a));
    rough = 0.1;
    bump = 0.0;
  `,
};

export interface HeroMaterialSpec {
  base: THREE.Color;
  accent?: THREE.Color;
  sheen?: number;
  sheenColor?: THREE.Color;
  clearcoat?: number;
  metalness?: number;
  /** Anisotropic highlight along the vertex tangents (hair strands). */
  anisotropy?: number;
  /** Tinted specular (hair: the coloured second lobe) and its strength. */
  specularColor?: THREE.Color;
  specularIntensity?: number;
}

/** Units per model voxel (the bump heights are authored in voxels). */
export const HERO_UNIT_DEFAULT = 0.09;

export type HeroShaderMaterial = THREE.MeshPhysicalMaterial & {
  userData: {
    heroUniforms: {
      uBase: THREE.IUniform<THREE.Color>;
      uAccent: THREE.IUniform<THREE.Color>;
      uUnit: THREE.IUniform<number>;
      uFace: THREE.IUniform<THREE.Texture | null>;
      uFaceOn: THREE.IUniform<number>;
    };
  };
};

/** A physical material with the procedural layer of `key`. */
export function heroMaterial(
  key: HeroMaterialKey,
  spec: HeroMaterialSpec,
  unit = HERO_UNIT_DEFAULT,
): HeroShaderMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: spec.metalness ?? 0,
    sheen: spec.sheen ?? 0,
    sheenRoughness: 0.6,
    sheenColor: spec.sheenColor ?? new THREE.Color(1, 1, 1),
    clearcoat: spec.clearcoat ?? 0,
    clearcoatRoughness: 0.08,
    anisotropy: spec.anisotropy ?? 0,
    specularColor: spec.specularColor ?? new THREE.Color(1, 1, 1),
    specularIntensity: spec.specularIntensity ?? 1,
  }) as HeroShaderMaterial;
  const uniforms = {
    uBase: { value: spec.base.clone() },
    uAccent: { value: (spec.accent ?? spec.base).clone() },
    uUnit: { value: unit },
    uFace: { value: key === "skin" ? faceMap() : null },
    // Off until the texture really loaded (it is local-only, see faceMap).
    uFaceOn: { value: key === "skin" && faceLoaded ? 1 : 0 },
  };
  if (key === "skin" && !faceLoaded) faceSwitches.push(uniforms.uFaceOn);
  m.userData.heroUniforms = uniforms;
  m.customProgramCacheKey = () => `hero-${key}`;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (key === "skin")
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_physical_pars_fragment>",
        skinLightsChunk(),
      );
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 rest;\nattribute float ao;\nvarying vec3 vRest;\nvarying vec3 vRestN;\nvarying float vAo;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvRest = rest;\nvRestN = normal;\nvAo = ao;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vRest;\nvarying vec3 vRestN;\nvarying float vAo;\nuniform vec3 uBase;\nuniform vec3 uAccent;\nuniform float uUnit;\nuniform sampler2D uFace;\nuniform float uFaceOn;\n${NOISE}\nvec3 paint; float rough; float bump; float aoK;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\naoK = vAo;\n{\n${PAINT[key]}\n${key === "skin" ? FACE_PROJECTION : ""}\n}\ndiffuseColor.rgb *= paint;`,
      )
      .replace(
        "#include <aomap_fragment>",
        "#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= aoK;\nreflectedLight.indirectSpecular *= mix(1.0, aoK, 0.8);\nreflectedLight.directDiffuse *= mix(1.0, aoK, 0.45);\nreflectedLight.directSpecular *= mix(1.0, aoK, 0.3);",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = rough;",
      )
      .replace(
        "#include <normal_fragment_maps>",
        "#include <normal_fragment_maps>\nnormal = hPerturb(-vViewPosition, normal, bump * uUnit, faceDirection);",
      );
  };
  return m;
}

/**
 * The portrait projected front-on onto the face (public/hero/jade-face.webp,
 * made by scripts/hero/face-texture.mjs). Mapping from the landmarks: 122.7
 * px per voxel, face centre x = 0 at texture x 400, eye line y = 56.55 at
 * texture row 299. Faded out towards the sides (rest normal), the neck and
 * the hairline; the lighting stays the scene's (the texture is de-lit).
 */
const FACE_PROJECTION = /* glsl */ `
  if (uFaceOn > 0.5) {
    vec3 fp = vRest;
    vec2 fuv = vec2((fp.x * 122.7 + 400.0) / 800.0, 1.0 - (299.0 - (fp.y - 56.55) * 122.7) / 800.0);
    float facing = smoothstep(0.2, 0.62, normalize(vRestN).z);
    float region = smoothstep(2.3, 1.85, abs(fp.x)) * smoothstep(52.75, 53.25, fp.y) * smoothstep(58.3, 57.95, fp.y);
    float m = facing * region * step(0.0, fuv.x) * step(fuv.x, 1.0);
    // The photo's narrow shadow under the nose would read as a moustache: lighter there.
    m *= 1.0 - 0.9 * smoothstep(0.65, 0.25, abs(fp.x)) * smoothstep(54.72, 54.86, fp.y) * smoothstep(55.3, 55.12, fp.y);
    vec3 photo = texture2D(uFace, fuv).rgb;
    paint = mix(paint, photo * 1.02, m * 0.97);
    // The photo already holds the face's occlusion: don't darken its sockets twice.
    aoK = mix(vAo, 1.0, m * 0.75);
    bump *= 1.0 - 0.5 * m;
  }
`;

let faceTex: THREE.Texture | null | undefined;
let faceLoaded = false;
const faceSwitches: { value: number }[] = [];
/** The face texture (browser only; null in Node / tests). */
function faceMap(): THREE.Texture | null {
  if (faceTex !== undefined) return faceTex;
  if (typeof document === "undefined") return (faceTex = null);
  // Derived from the private reference portrait: not in the repository, built
  // locally (scripts/hero/face-texture.mjs) — missing file = no projection.
  faceTex = new THREE.TextureLoader().load("/hero/jade-face.webp", () => {
    faceLoaded = true;
    for (const u of faceSwitches) u.value = 1;
  });
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 4;
  return faceTex;
}

/**
 * Skin with a real texture (the baked portrait on the MPFB head): the same
 * red-shifted wrap lighting as the procedural skin, a soft reddish sheen for
 * the light scattered just under the surface, fine pores from noise.
 */
export function texturedSkinMaterial(
  map: THREE.Texture | null,
  unit = HERO_UNIT_DEFAULT,
): THREE.MeshPhysicalMaterial {
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  }
  const m = new THREE.MeshPhysicalMaterial({
    map,
    color: 0xffffff,
    roughness: 0.52,
    sheen: 0.32,
    sheenRoughness: 0.55,
    sheenColor: srgb("#ff7a5c"),
    specularIntensity: 0.55,
    clearcoat: 0.04,
    clearcoatRoughness: 0.35,
  });
  m.customProgramCacheKey = () => "hero-skin-tex";
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uUnit = { value: unit };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <lights_physical_pars_fragment>", skinLightsChunk())
      .replace("#include <common>", `#include <common>\nuniform float uUnit;\n${NOISE}`)
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\n// T-zone a touch shinier, cheeks matte (from the texture's brightness).\nroughnessFactor = clamp(roughnessFactor - 0.06 * (diffuseColor.r - 0.6), 0.32, 0.7);",
      );
  };
  return m;
}

/** Alpha cards (brows): textured, cut out, double-sided. */
export function cardMaterial(map: THREE.Texture | null): THREE.MeshPhysicalMaterial {
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshPhysicalMaterial({
    map,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.7,
    sheen: 0.3,
  });
}

export type HeroMaterials = Record<HeroMaterialKey, HeroShaderMaterial>;

export function createHeroMaterials(c: HeroColors, unit = HERO_UNIT_DEFAULT): HeroMaterials {
  return {
    skin: heroMaterial(
      "skin",
      { base: c.skin, accent: c.brows, sheen: 0.35, sheenColor: srgb("#ff7a5c") },
      unit,
    ),
    hair: heroMaterial(
      "hair",
      {
        base: c.hair,
        sheen: 0.45,
        sheenColor: srgb("#ffb070"),
        anisotropy: 0.75,
        specularColor: srgb("#ffc49a"),
        specularIntensity: 0.6,
      },
      unit,
    ),
    hairShell: heroMaterial(
      "hairShell",
      {
        base: c.hair,
        sheen: 0.6,
        sheenColor: srgb("#ffb070"),
        specularColor: srgb("#ffc49a"),
        specularIntensity: 0.55,
      },
      unit,
    ),
    hairShell2: heroMaterial(
      "hairShell2",
      {
        base: c.hair,
        sheen: 0.7,
        sheenColor: srgb("#ffc080"),
        specularColor: srgb("#ffd0a8"),
        specularIntensity: 0.5,
      },
      unit,
    ),
    shirt: heroMaterial(
      "shirt",
      { base: c.shirt, accent: c.shirtAccent, sheen: 0.4, sheenColor: srgb("#ffffff") },
      unit,
    ),
    coat: heroMaterial("coat", { base: c.coat, sheen: 0.35, sheenColor: srgb("#ffffff") }, unit),
    trousers: heroMaterial(
      "trousers",
      { base: c.trousers, sheen: 0.6, sheenColor: srgb("#8a93a8") },
      unit,
    ),
    boots: heroMaterial("boots", { base: c.boots, accent: srgb("#d9c7a0") }, unit),
    trim: heroMaterial("trim", { base: srgb("#d8d4cc") }, unit),
    belt: heroMaterial("belt", { base: c.belt }, unit),
    watch: heroMaterial(
      "watch",
      { base: c.watch, accent: c.watchFace ?? c.watch, metalness: 0.3 },
      unit,
    ),
    eye: heroMaterial("eye", { base: c.iris, clearcoat: 1 }, unit),
  };
}

/** Recolour in place (wardrobe change): no recompile, just uniforms. */
export function setHeroColors(m: HeroMaterials, c: HeroColors): void {
  const set = (k: HeroMaterialKey, base: THREE.Color, accent?: THREE.Color) => {
    m[k].userData.heroUniforms.uBase.value.copy(base);
    if (accent) m[k].userData.heroUniforms.uAccent.value.copy(accent);
  };
  set("skin", c.skin, c.brows);
  set("hair", c.hair);
  set("hairShell", c.hair);
  set("hairShell2", c.hair);
  set("shirt", c.shirt, c.shirtAccent);
  set("coat", c.coat);
  set("trousers", c.trousers);
  set("boots", c.boots);
  set("belt", c.belt);
  set("watch", c.watch, c.watchFace ?? c.watch);
  set("eye", c.iris);
}

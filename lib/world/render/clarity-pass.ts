/**
 * Clarity passes — the voxel world and the one real thing in it.
 * ===============================================================
 *
 * Composer order (LabEngine):
 *
 *   RenderPass (world, hero layer excluded)
 *   → ClarityGradePass   colour grade, NaN guard, era wave ring; copies the
 *                        depth so the hero can be depth-tested
 *   → HeroPass           Jade, full resolution, depth-tested against the
 *                        world's depth
 *   → bloom → CRT → output
 *
 * The world is never pixelated: clarity comes from the voxels themselves
 * (smaller cubes every few eras, see lib/world/clarity.ts). The grade pass
 * only shifts colour (muted → rich) and draws the era wave.
 */
import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";

/** Render layer of the hero character (never drawn by the world pass). */
export const HERO_LAYER = 5;

const GradeShader = {
  uniforms: {
    tColor: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uSaturation: { value: 1 },
    uContrast: { value: 1 },
    /** Wave centre (render-target pixels) and radius (px, < 0 = no wave). */
    uCenter: { value: new THREE.Vector2(0, 0) },
    uRadius: { value: -1 },
    /** Screen-space ambient occlusion (crystal age, GTAO) and its strength (0 = off). */
    tAO: { value: null as THREE.Texture | null },
    uAO: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform float uSaturation;
    uniform float uContrast;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform sampler2D tAO;
    uniform float uAO;
    varying vec2 vUv;

    vec3 grade(vec3 c) {
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(luma), c, uSaturation), 0.0);
      return max((c - 0.18) * uContrast + 0.18, 0.0);
    }

    void main() {
      vec4 c = texture2D(tColor, vUv);
      // Never let a NaN reach bloom (it would smear over the whole frame).
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      if (uAO > 0.0) {
        // Contact shadows in creases and under objects; glowing surfaces stay bright.
        float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        float ao = clamp(texture2D(tAO, vUv).r, 0.0, 1.0);
        c.rgb *= mix(1.0, ao, uAO * (1.0 - smoothstep(0.9, 1.8, luma)));
      }
      c.rgb = grade(c.rgb);
      if (uRadius >= 0.0) {
        // The era wave front: a thin bright ring spreading from Jade.
        float r = distance(vUv * uResolution, uCenter);
        float k = (r - uRadius) / 7.0;
        c.rgb += exp(-k * k) * vec3(0.55, 0.85, 1.0) * 0.35;
      }
      gl_FragColor = c;
      gl_FragDepth = texture2D(tDepth, vUv).x;
    }
  `,
};

/** Grade the world; keeps a matching depth buffer for the hero pass. */
export class ClarityGradePass extends Pass {
  readonly material: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;

  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(GradeShader.uniforms),
      vertexShader: GradeShader.vertexShader,
      fragmentShader: GradeShader.fragmentShader,
      depthTest: true,
      depthFunc: THREE.AlwaysDepth,
      depthWrite: true,
    });
    this.quad = new FullScreenQuad(this.material);
    this.needsSwap = true;
  }

  /** The era wave: centre and radius in render-target pixels (radius < 0 = off). */
  setWave(cx: number, cy: number, radius: number): void {
    this.material.uniforms.uCenter!.value.set(cx, cy);
    this.material.uniforms.uRadius!.value = radius;
  }

  /** Screen-space AO texture (red channel) and strength; null / 0 = off. */
  setAO(texture: THREE.Texture | null, strength: number): void {
    this.material.uniforms.tAO!.value = texture;
    this.material.uniforms.uAO!.value = texture ? strength : 0;
  }

  /** World colour grade (1 = neutral). */
  setGrade(saturation: number, contrast: number): void {
    this.material.uniforms.uSaturation!.value = saturation;
    this.material.uniforms.uContrast!.value = contrast;
  }

  override setSize(width: number, height: number): void {
    this.material.uniforms.uResolution!.value.set(width, height);
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    const u = this.material.uniforms;
    u.tColor!.value = readBuffer.texture;
    u.tDepth!.value = readBuffer.depthTexture;
    u.uResolution!.value.set(readBuffer.width, readBuffer.height);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    renderer.clear(true, true, true);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}

/**
 * Draws the hero layer on top of the graded world in the read buffer.
 * Lights must be on the hero layer too (`LabEngine` enables it on every
 * light); the shadow maps of the world pass are reused, not re-rendered.
 */
export class HeroPass extends Pass {
  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    super();
    this.needsSwap = false;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    const mask = this.camera.layers.mask;
    const autoClear = renderer.autoClear;
    const shadowAuto = renderer.shadowMap.autoUpdate;
    const bg = this.scene.background;
    this.camera.layers.set(HERO_LAYER);
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    this.scene.background = null;
    renderer.setRenderTarget(readBuffer);
    renderer.clearStencil();
    renderer.render(this.scene, this.camera);
    this.scene.background = bg;
    renderer.shadowMap.autoUpdate = shadowAuto;
    renderer.autoClear = autoClear;
    this.camera.layers.mask = mask;
  }
}

/** Render target for the composer with a sampleable depth + stencil texture. */
export function clarityRenderTarget(w: number, h: number): THREE.WebGLRenderTarget {
  const depth = new THREE.DepthTexture(w, h, THREE.UnsignedInt248Type);
  depth.format = THREE.DepthStencilFormat;
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    stencilBuffer: true,
    depthTexture: depth,
  });
}

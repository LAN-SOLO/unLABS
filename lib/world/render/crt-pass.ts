/**
 * CRT finishing pass: vignette, film grain, subtle chromatic aberration,
 * a slow scan band and a fade/letterbox overlay for scenes. Runs after
 * bloom, before the output (tone-mapping/sRGB) pass.
 */
import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const CrtShader = {
  name: "LabCrtShader",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.045 },
    uAberration: { value: 0.0012 },
    uScanBand: { value: 0.04 },
    uFade: { value: 0 },
    uLetterbox: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uScanBand;
    uniform float uFade;
    uniform float uLetterbox;
    uniform vec3 uTint;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 43.0) * 43758.5453);
    }

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * uAberration * (1.0 + r2 * 4.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;

      // Slow rolling scan band, like a monitor refresh bar.
      float band = smoothstep(0.0, 0.08, abs(fract(vUv.y - uTime * 0.05) - 0.5));
      col *= 1.0 - uScanBand * (1.0 - band);

      float vig = smoothstep(0.85, 0.2, length(c * vec2(uAspect * 0.85, 1.0)));
      col *= mix(1.0, vig, uVignette);

      col += (hash(vUv * 1000.0) - 0.5) * uGrain;
      col *= uTint;

      col = mix(col, vec3(0.0), uFade);
      float lb = uLetterbox * 0.11;
      if (vUv.y < lb || vUv.y > 1.0 - lb) col = vec3(0.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export type CrtPass = ShaderPass & {
  uniforms: {
    uTime: THREE.IUniform<number>;
    uVignette: THREE.IUniform<number>;
    uGrain: THREE.IUniform<number>;
    uAberration: THREE.IUniform<number>;
    uScanBand: THREE.IUniform<number>;
    uFade: THREE.IUniform<number>;
    uLetterbox: THREE.IUniform<number>;
    uTint: THREE.IUniform<THREE.Color>;
    uAspect: THREE.IUniform<number>;
  };
};

export function createCrtPass(): CrtPass {
  return new ShaderPass(CrtShader) as CrtPass;
}

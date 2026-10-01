"use client";

/**
 * Damien studio (dev tool): the real Damien as the game shows him — veiled.
 * `?view=full|portrait|turn`, `&reveal=1` for the dev-only plain preview,
 * `&detail=game|portrait`. Dev handle: `window.__studio`.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { HeroDetail } from "@/lib/world/hero/build";
import { loadDamienHero } from "@/lib/world/hero/damien-load";
import { DAMIEN_UNIT } from "@/lib/world/hero/damien-skeleton";
import { buildDamienRig, type DamienRig } from "@/lib/world/render/hero/damien-rig";

type View = "portrait" | "full" | "turn";

const U = DAMIEN_UNIT;
const VIEWS: Record<
  View,
  { eye: [number, number, number]; at: [number, number, number]; fov: number }
> = {
  portrait: { eye: [0.3 * U, 57.5 * U, 55 * U], at: [0, 56.5 * U, 0], fov: 20 },
  full: { eye: [0, 36 * U, 200 * U], at: [0, 32 * U, 0], fov: 22 },
  turn: { eye: [0, 36 * U, 200 * U], at: [0, 32 * U, 0], fov: 22 },
};

export function DamienStudio() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("…");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const params = new URLSearchParams(window.location.search);
    let view = (params.get("view") as View | null) ?? "full";
    const detail = (params.get("detail") as HeroDetail | null) ?? "game";
    const reveal = params.get("reveal") === "1";
    const yaw0 = Number(params.get("yaw") ?? "0.35");

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#04070a");
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.3;
    const key = new THREE.DirectionalLight("#dfeaff", 1.8);
    key.position.set(-4, 8, 6);
    scene.add(key, new THREE.HemisphereLight("#2a3a48", "#05080a", 0.6));
    // A dark lab floor with a faint cyan pool where he stands.
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(6, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: "#0b1216", roughness: 0.4, metalness: 0.3 }),
    );
    scene.add(floor);
    const pool = new THREE.PointLight("#3fe6ff", reveal ? 0 : 6, 6, 1.5);
    pool.position.set(0, 0.6, 0.6);
    scene.add(pool);

    const camera = new THREE.PerspectiveCamera(20, el.clientWidth / el.clientHeight, 0.05, 200);
    const applyView = () => {
      const v = VIEWS[view];
      camera.fov = v.fov;
      camera.position.set(...v.eye);
      camera.lookAt(new THREE.Vector3(...v.at));
      camera.updateProjectionMatrix();
    };
    applyView();

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(el.clientWidth, el.clientHeight),
      reveal ? 0.12 : 0.9,
      0.5,
      reveal ? 1.5 : 0.35,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    let rig: DamienRig | null = null;
    let yaw = yaw0;
    let disposed = false;
    const t0 = performance.now();
    void loadDamienHero(detail).then((layers) => {
      if (disposed) return;
      rig = buildDamienRig(layers, { veiled: !reveal });
      rig.root.rotation.y = yaw;
      scene.add(rig.root);
      const tris = layers.reduce((n, l) => n + l.indices.length / 3, 0);
      setStatus(
        `Damien · ${reveal ? "revealed (dev preview)" : "veiled"} · ${detail} · ${Math.round(tris / 1000)}k tris · ${Math.round(performance.now() - t0)} ms`,
      );
      window.__studio = {
        ready: true,
        ms: performance.now() - t0,
        tris,
        view(v) {
          if (v in VIEWS) view = v as View;
          applyView();
        },
        yaw(r) {
          yaw = r;
        },
      };
    });

    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      composer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);
    renderer.setAnimationLoop((now) => {
      const t = now / 1000;
      if (rig) {
        if (view === "turn") yaw = t * 0.4;
        rig.root.rotation.y = yaw;
        rig.tick(t);
      }
      pool.intensity = reveal ? 0 : 5 + Math.sin(t * 3) * 1.2;
      composer.render();
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      rig?.dispose();
      composer.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#04070a]">
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-xs text-cyan-200/70">
        {status}
      </div>
    </div>
  );
}

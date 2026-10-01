"use client";

/**
 * Hero studio — a photo studio for the "real" characters (dev tool).
 * ==================================================================
 *
 * Renders Jade's hero mesh with studio lighting: a soft warm key, a hot
 * copper rim from behind, a cool fill and a dark umber backdrop. Views:
 * `?view=portrait|bust|full|turn` (turn = slow turntable), drag to orbit,
 * `?detail=game` to check the in-game mesh. Dev handle: `window.__studio`.
 */
import { loadHeroHead } from "@/lib/world/render/hero/head-glb";
import { characterPose, type CharacterPoseKind, type RigPartName } from "@/lib/world/models/rig";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadJadeHero } from "@/lib/world/hero/load";
import { jadeGroom } from "@/lib/world/hero/jade-groom";
import { GROOM_DENSITY, meshLayerAt, unionField, type HeroDetail } from "@/lib/world/hero/build";
import { jadeLayers } from "@/lib/world/hero/jade-sculpt";
import { buildHeroRig, type HeroRig } from "@/lib/world/render/hero/hero-rig";
import { JADE_DEFAULT_COLORS } from "@/lib/world/render/hero/materials";

type View = "portrait" | "face" | "bust" | "full" | "turn" | "back" | "side" | "hands" | "game";

const VIEWS: Record<
  View,
  { eye: [number, number, number]; at: [number, number, number]; fov: number }
> = {
  portrait: { eye: [0.05, 58.4, 46], at: [0, 57.6, 0], fov: 20 },
  face: { eye: [0.0, 56.2, 40], at: [0, 55.9, 0], fov: 11 },
  bust: { eye: [0.3, 55, 70], at: [0, 52.5, 0], fov: 20 },
  full: { eye: [0, 36, 190], at: [0, 31.5, 0], fov: 22 },
  turn: { eye: [0, 36, 190], at: [0, 31.5, 0], fov: 22 },
  back: { eye: [0, 57, -60], at: [0, 57, 0], fov: 20 },
  side: { eye: [45, 57, 12], at: [0, 56.4, 0.5], fov: 18 },
  hands: { eye: [22, 30, 34], at: [6.6, 28.5, 0], fov: 18 },
  // The lab's camera: isometric-ish from above, Jade ~150 px tall (orthographic in game).
  game: { eye: [200, 230, 200], at: [0, 31, 0], fov: 14 },
};

declare global {
  interface Window {
    __studio?: {
      ready: boolean;
      view(v: View): void;
      yaw(r: number): void;
      ms: number;
      tris: number;
    };
  }
}

export function HeroStudio() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("sculpting Jade …");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const params = new URLSearchParams(window.location.search);
    let view = (params.get("view") as View | null) ?? "portrait";
    const detail = (params.get("detail") as HeroDetail | null) ?? "portrait";

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.28;

    // Key: soft warm white, front left, above.
    const key = new THREE.DirectionalLight("#ffe4d2", 2.0);
    key.position.set(-85, 75, 70);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, {
      left: -40,
      right: 40,
      top: 70,
      bottom: -5,
      near: 1,
      far: 300,
    });
    // Rim: hot copper from behind, upper right — lights the hair like the look sheet.
    const rim = new THREE.SpotLight("#ff5a1a", 1300, 0, Math.PI / 5, 0.6, 1.5);
    rim.position.set(30, 85, -45);
    rim.target.position.set(0, 50, 0);
    // Second rim, lower left, redder.
    const rim2 = new THREE.SpotLight("#ff3b2a", 380, 0, Math.PI / 5, 0.7, 1.5);
    rim2.position.set(-40, 55, -30);
    rim2.target.position.set(0, 50, 0);
    // Soft frontal key, like the portrait's beauty light (from the camera, a little above).
    const front = new THREE.DirectionalLight("#fff2ea", 1.1);
    front.position.set(0, 70, 140);
    scene.add(front);
    // Cool fill from the right.
    const fill = new THREE.DirectionalLight("#ff9a7a", 0.45);
    fill.position.set(70, 40, 40);
    scene.add(
      key,
      rim,
      rim.target,
      rim2,
      rim2.target,
      fill,
      new THREE.HemisphereLight("#6e4a3a", "#140a08", 0.35),
    );
    // Floor catching the shadow (full views).
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: "#2a1712", roughness: 0.9 }),
    );
    floor.receiveShadow = true;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(20, el.clientWidth / el.clientHeight, 0.5, 2000);
    const stage = new THREE.Group();
    stage.scale.setScalar(1);
    scene.add(stage);
    let hero: HeroRig | null = null;
    let yaw = 0;

    const applyView = () => {
      const v = VIEWS[view];
      camera.fov = v.fov;
      camera.position.set(...v.eye);
      camera.lookAt(new THREE.Vector3(...v.at));
      camera.updateProjectionMatrix();
      floor.visible = view === "full" || view === "turn";
    };
    applyView();

    const t0 = performance.now();
    let disposed = false;
    // Building takes a while (portrait ≈ 20 s: surface nets + hair groom): show it ticking.
    let ready = false;
    const ticker = window.setInterval(() => {
      if (ready || disposed) return;
      const sec = Math.round((performance.now() - t0) / 1000);
      setStatus(
        detail === "portrait"
          ? `sculpting Jade … ${sec} s (portrait detail takes ~20 s; ?detail=game ~3 s)`
          : `sculpting Jade … ${sec} s`,
      );
    }, 1000);
    const only = params.get("only")?.split(",");
    yaw = Number(params.get("yaw") ?? 0);
    const noHair = params.get("hair") === "0";
    const source = only
      ? Promise.resolve().then(() => {
          const all = jadeLayers(detail);
          const world = unionField(all);
          const layers = all
            .filter((l) => only.includes(l.id))
            .map((l) => meshLayerAt(l, detail, world));
          return {
            layers,
            groom: only.includes("strands") ? jadeGroom(GROOM_DENSITY[detail]) : undefined,
          };
        })
      : loadJadeHero(detail);
    // Real head (Blender/MPFB) unless ?head=sdf.
    const headP = params.get("head") === "sdf" ? Promise.resolve(null) : loadHeroHead();
    Promise.all([source, headP]).then(([{ layers, groom }, head]) => {
      if (disposed) return;
      const ms = Math.round(performance.now() - t0);
      // The studio works in model voxels (unit 1); bumps still read in voxels.
      hero = buildHeroRig(layers, {
        colors: JADE_DEFAULT_COLORS(),
        unit: 1,
        head,
        ...(groom && !noHair ? { groom, hairShare: detail === "game" ? 0.22 : 1 } : {}),
      });
      stage.add(hero.root);
      // Dev: a pose of the voxel rig, frozen (`?pose=walk&t=0.4&speed=4`).
      const pose = params.get("pose") as CharacterPoseKind | null;
      if (pose) {
        const p = characterPose(
          pose,
          Number(params.get("t") ?? 0.4),
          Number(params.get("speed") ?? 4),
        );
        for (const [name, j] of hero.joints) {
          const pp = p[name as RigPartName];
          if (!pp) continue;
          j.rotation.set(pp.rot[0], pp.rot[1], pp.rot[2]);
          const r = hero.rest.get(name)!;
          j.position.set(
            r.x + (pp.pos?.[0] ?? 0),
            r.y + (pp.pos?.[1] ?? 0),
            r.z + (pp.pos?.[2] ?? 0),
          );
        }
      }
      hero.setBlink(Number(params.get("blink") ?? 0));
      hero.setGaze(Number(params.get("gaze") ?? 0));
      const tris = layers.reduce((n, l) => n + l.indices.length / 3, 0);
      ready = true;
      window.clearInterval(ticker);
      setStatus(`Jade · ${detail} · ${Math.round(tris / 1000)}k tris · ${ms} ms`);
      window.__studio = {
        ready: true,
        ms,
        tris,
        view(v) {
          view = v;
          applyView();
        },
        yaw(r) {
          yaw = r;
        },
      };
    });

    let drag: { x: number; yaw: number } | null = null;
    const down = (e: PointerEvent) => (drag = { x: e.clientX, yaw });
    const move = (e: PointerEvent) => {
      if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    };
    const up = () => (drag = null);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);

    let lastT = 0;
    renderer.setAnimationLoop((now) => {
      const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
      lastT = now;
      if (view === "turn" && !drag) yaw = now * 0.0004;
      if (hero) {
        hero.root.rotation.y = yaw;
        hero.update(dt);
      }
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      window.clearInterval(ticker);
      renderer.setAnimationLoop(null);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("resize", resize);
      hero?.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      className="fixed inset-0"
      style={{
        background: "radial-gradient(ellipse at 50% 40%, #4a2418 0%, #2a120c 55%, #120705 100%)",
      }}
    >
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-xs text-orange-200/70">
        {status}
      </div>
    </div>
  );
}

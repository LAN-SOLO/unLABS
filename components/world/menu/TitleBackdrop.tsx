"use client";

import { useEffect, useRef, useState } from "react";
import { getSettings, useSettings } from "@/lib/world/settings";
import type { TitleDiorama } from "@/lib/world/render/title-diorama";

/** True when the browser can create a WebGL context (probe context is released at once). */
export function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// ── 2D fallback: drifting isometric voxel field ──────────────────

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Flat canvas backdrop (used when WebGL is off, unavailable or the context is lost). */
export function VoxelField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let last = 0;
    let drift = 0;
    const T = 28; // tile half-width
    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.fillStyle = "#050805";
      ctx.fillRect(0, 0, w, h);
      const off = drift % 1;
      const base = Math.floor(drift);
      const n = Math.ceil((w / T + h / (T / 2)) / 2) + 4;
      const cx = w / 2;
      const cy = h / 2;
      const cells: { x: number; y: number; v: number; hgt: number }[] = [];
      ctx.strokeStyle = "rgba(51,255,51,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -n; i <= n; i++) {
        for (let j = -n; j <= n; j++) {
          const x = (i - off - j) * T + cx;
          const y = (i - off + j) * (T / 2) + cy;
          if (x < -2 * T || x > w + 2 * T || y < -4 * T || y > h + 2 * T) continue;
          ctx.moveTo(x, y - T / 2);
          ctx.lineTo(x + T, y);
          ctx.lineTo(x, y + T / 2);
          ctx.lineTo(x - T, y);
          ctx.closePath();
          const v = hash(i + base, j);
          if (v >= 0.9)
            cells.push({ x, y, v, hgt: (1 + Math.floor(hash(j, i + base) * 3)) * T * 0.7 });
        }
      }
      ctx.stroke();
      cells.sort((p, q) => p.y - q.y);
      const face = (pts: readonly (readonly [number, number])[], fill: string) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.fill();
      };
      for (const { x, y, v, hgt } of cells) {
        const glow = v > 0.985;
        face(
          [
            [x, y - T / 2 - hgt],
            [x + T, y - hgt],
            [x, y + T / 2 - hgt],
            [x - T, y - hgt],
          ],
          glow ? "rgba(255,184,0,0.16)" : "rgba(51,255,51,0.08)",
        );
        face(
          [
            [x - T, y - hgt],
            [x, y + T / 2 - hgt],
            [x, y + T / 2],
            [x - T, y],
          ],
          glow ? "rgba(255,184,0,0.08)" : "rgba(51,255,51,0.04)",
        );
        face(
          [
            [x + T, y - hgt],
            [x, y + T / 2 - hgt],
            [x, y + T / 2],
            [x + T, y],
          ],
          glow ? "rgba(255,184,0,0.05)" : "rgba(0,255,255,0.03)",
        );
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < 33) return; // ~30 fps is plenty for a backdrop
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (!getSettings().accessibility.reduceMotion) drift += dt * 0.12;
      draw();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}

// ── Live 3D diorama ──────────────────────────────────────────────

type Mode = "fallback" | "loading" | "live";

/**
 * Title background: the live voxel diorama (three.js, loaded on demand) with
 * the 2D field underneath until it is ready — and instead of it when WebGL is
 * missing, the context is lost or the player switched it off
 * (Einstellungen → Grafik → Titelbildschirm-Diorama).
 */
export function TitleBackdrop() {
  const [s] = useSettings();
  const enabled = s.graphics.menuScene;
  const reduceMotion = s.accessibility.reduceMotion;
  const bloom = s.graphics.bloom;
  const hostRef = useRef<HTMLDivElement>(null);
  const dioramaRef = useRef<TitleDiorama | null>(null);
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState(false);
  // Probed once per mount (client only; the title screen never renders on the server).
  const [canGl] = useState(webglAvailable);
  const mode: Mode = !enabled || failed || !canGl ? "fallback" : live ? "live" : "loading";

  useEffect(() => {
    const host = hostRef.current;
    if (!enabled || !canGl || !host) return;
    let cancelled = false;
    import("@/lib/world/render/title-diorama")
      .then(({ TitleDiorama }) => {
        if (cancelled) return;
        const settings = getSettings();
        const d = TitleDiorama.create(host, {
          reduceMotion: settings.accessibility.reduceMotion,
          bloom: settings.graphics.bloom,
          onFail: () => {
            dioramaRef.current?.dispose();
            dioramaRef.current = null;
            setLive(false);
            setFailed(true);
          },
        });
        if (!d) {
          setFailed(true);
          return;
        }
        dioramaRef.current = d;
        setLive(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      dioramaRef.current?.dispose();
      dioramaRef.current = null;
      setLive(false);
    };
  }, [enabled, canGl]);

  useEffect(() => {
    dioramaRef.current?.setReduceMotion(reduceMotion);
  }, [reduceMotion, live]);
  useEffect(() => {
    dioramaRef.current?.setBloom(bloom);
  }, [bloom, live]);

  return (
    <div aria-hidden className="absolute inset-0" data-backdrop={mode}>
      {mode !== "live" && <VoxelField />}
      <div
        ref={hostRef}
        className="absolute inset-0 transition-opacity duration-1000"
        style={{ opacity: mode === "live" ? 1 : 0 }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CrtButton } from "@/components/world/puzzles/ui";
import { getSettings, useSettings } from "@/lib/world/settings";
import { tr } from "@/lib/i18n";

export { CrtButton };

export const SCANLINES =
  "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)";

/** True inside the Electron desktop shell. */
export function isElectron(): boolean {
  if (typeof window === "undefined") return false;
  return "__ELECTRON_CONFIG__" in window || navigator.userAgent.includes("Electron");
}

/** "Quit": close the desktop window, or leave to the terminal on the web. */
export function quitGame(onWeb: () => void): void {
  if (isElectron()) window.close();
  else onWeb();
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
}

// Only the top-most open layer reacts to Esc (all listeners sit on window,
// so stopPropagation alone cannot keep a parent panel from closing too).
const escLayers: symbol[] = [];

/** Register an Esc handler that fires only while this layer is the top-most one. */
export function useEscLayer(onEsc: () => void, enabled = true): void {
  const cb = useRef(onEsc);
  useEffect(() => {
    cb.current = onEsc;
  });
  useEffect(() => {
    if (!enabled) return;
    const token = Symbol("esc-layer");
    escLayers.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || escLayers[escLayers.length - 1] !== token) return;
      e.preventDefault();
      e.stopPropagation();
      cb.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = escLayers.indexOf(token);
      if (i >= 0) escLayers.splice(i, 1);
    };
  }, [enabled]);
}

/** True while any menu layer is open (lets the game ignore its own Esc handling). */
export function menuLayerOpen(): boolean {
  return escLayers.length > 0;
}

function Screw({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute h-2 w-2 rounded-full bg-[#3A3A3A] shadow-[inset_0_0_1px_#000,0_0_0_1px_#555] ${className}`}
    />
  );
}

/** Scales its children with the accessibility UI scale. */
export function UiScale({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [s] = useSettings();
  const scale = s.accessibility.uiScale;
  return (
    <div className={className} style={scale === 1 ? undefined : { zoom: scale }}>
      {children}
    </div>
  );
}

/**
 * CRT modal panel for menu sub-screens (same look as `Panel` in ui.tsx, but
 * stacks above the title/pause screens and can suspend its Esc handler).
 */
export function MenuPanel({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  accent = "#FFB800",
  escEnabled = true,
  z = 80,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  accent?: string;
  escEnabled?: boolean;
  z?: number;
}) {
  useEscLayer(onClose, escEnabled);
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 p-4"
      style={{ zIndex: z }}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <UiScale className="flex max-h-[90vh] w-full justify-center">
        <div
          className={`relative flex max-h-[90vh] w-full flex-col rounded-sm border bg-[#0D0D0D]/95 font-mono text-[#33FF33] shadow-[0_0_40px_rgba(0,0,0,0.8)] ${wide ? "max-w-5xl" : "max-w-2xl"}`}
          style={{ borderColor: `${accent}66` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Screw className="top-1.5 left-1.5" />
          <Screw className="top-1.5 right-1.5" />
          <Screw className="bottom-1.5 left-1.5" />
          <Screw className="right-1.5 bottom-1.5" />
          <div className="pointer-events-none absolute inset-0" style={{ background: SCANLINES }} />
          <div
            className="flex items-start justify-between gap-4 border-b px-5 pt-4 pb-3"
            style={{ borderColor: `${accent}33` }}
          >
            <div>
              <h2 className="text-sm tracking-[0.2em] uppercase" style={{ color: accent }}>
                {title}
              </h2>
              {subtitle && <p className="mt-1 text-xs text-[#33FF33]/60">{subtitle}</p>}
            </div>
            <CrtButton tone="amber" onClick={onClose} aria-label={tr("Close")}>
              Esc
            </CrtButton>
          </div>
          <div className="relative overflow-y-auto px-5 py-4 text-sm leading-relaxed">
            {children}
          </div>
        </div>
      </UiScale>
    </div>
  );
}

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  tone?: "green" | "amber" | "cyan" | "red";
  onSelect: () => void;
}

function nextEnabled(items: readonly MenuItem[], from: number, dir: 1 | -1): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + dir * k + n * k) % n;
    if (!items[i]!.disabled) return i;
  }
  return from;
}

/** Arrow/W/S navigation, Enter/Space select, Esc back (as an Esc layer). */
export function useMenuNav(
  items: readonly MenuItem[],
  active: boolean,
  onBack?: () => void,
): [number, (i: number) => void] {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      items.findIndex((i) => !i.disabled),
    ),
  );
  const itemsRef = useRef(items);
  const backRef = useRef(onBack);
  const indexRef = useRef(index);
  useEffect(() => {
    itemsRef.current = items;
    backRef.current = onBack;
    indexRef.current = index;
  });

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.repeat) return;
      const list = itemsRef.current;
      if (list.length === 0) return;
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        setIndex((i) => nextEnabled(list, i, 1));
      } else if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        setIndex((i) => nextEnabled(list, i, -1));
      } else if (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter") {
        const item = list[indexRef.current];
        if (item && !item.disabled) {
          e.preventDefault();
          item.onSelect();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEscLayer(() => backRef.current?.(), active && !!onBack);

  // Keep the cursor on an enabled entry when the list changes.
  const safe = items[index]?.disabled ? nextEnabled(items, index, 1) : index;
  return [Math.min(safe, Math.max(0, items.length - 1)), setIndex];
}

/** Vertical CRT menu list (keyboard state from `useMenuNav`). */
export function MenuList({
  items,
  index,
  onHover,
}: {
  items: readonly MenuItem[];
  index: number;
  onHover: (i: number) => void;
}) {
  return (
    <ul className="flex flex-col gap-1" role="menu">
      {items.map((item, i) => {
        const sel = i === index;
        const color =
          item.tone === "red"
            ? "#FF3333"
            : item.tone === "cyan"
              ? "#00FFFF"
              : item.tone === "amber"
                ? "#FFB800"
                : "#33FF33";
        return (
          <li key={item.id} role="none">
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onMouseEnter={() => !item.disabled && onHover(i)}
              onFocus={() => !item.disabled && onHover(i)}
              onClick={() => !item.disabled && item.onSelect()}
              className="group flex w-full items-baseline gap-3 rounded-sm border px-3 py-1.5 text-left font-mono text-sm tracking-[0.15em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00FFFF] disabled:cursor-not-allowed disabled:opacity-35"
              style={{
                color,
                borderColor: sel ? `${color}AA` : "transparent",
                background: sel ? `${color}14` : "transparent",
                textShadow: sel ? `0 0 8px ${color}99` : "none",
              }}
            >
              <span className="w-3 shrink-0" aria-hidden>
                {sel ? "▸" : ""}
              </span>
              <span>{item.label}</span>
              {item.hint && (
                <span className="ml-auto text-[10px] tracking-normal text-[#33FF33]/45 normal-case">
                  {item.hint}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Yes/no confirmation dialog (Enter = confirm, Esc = cancel). */
export function ConfirmDialog({
  title,
  text,
  confirmLabel = tr("Confirm"),
  onConfirm,
  onCancel,
  z = 90,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  z?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onConfirm]);
  return (
    <MenuPanel title={title} onClose={onCancel} accent="#FF3333" z={z}>
      <p className="text-[#d8ffd8]">{text}</p>
      <div className="mt-4 flex justify-end gap-2">
        <CrtButton onClick={onCancel}>{tr("Cancel")}</CrtButton>
        <CrtButton tone="red" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </CrtButton>
      </div>
    </MenuPanel>
  );
}

// ── Octahedron (the _unETH motif) ────────────────────────────────

const OCTA_VERTS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const OCTA_EDGES: readonly (readonly [number, number])[] = [
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [2, 4],
  [4, 3],
  [3, 5],
  [5, 2],
];

/** Rotating wireframe octahedron on a small canvas. */
export function Octahedron({
  size = 120,
  color = "#FFB800",
  glow = "#00FFFF",
}: {
  size?: number;
  color?: string;
  glow?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    let raf = 0;
    let t0 = performance.now();
    let angle = 0.6;
    const draw = (now: number) => {
      const motion = !getSettings().accessibility.reduceMotion;
      if (motion) angle += ((now - t0) / 1000) * 0.6;
      t0 = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const r = size * 0.36;
      const cy = Math.cos(angle);
      const sy = Math.sin(angle);
      const tilt = 0.45;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const pts = OCTA_VERTS.map(([x, y, z]) => {
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y2 = y * ct - z1 * st;
        const z2 = y * st + z1 * ct;
        return { x: size / 2 + x1 * r, y: size / 2 - y2 * r * 1.25, z: z2 };
      });
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 10;
      for (const [a, b] of OCTA_EDGES) {
        const pa = pts[a]!;
        const pb = pts[b]!;
        const back = (pa.z + pb.z) / 2 < -0.1;
        ctx.strokeStyle = back ? `${glow}55` : color;
        ctx.shadowColor = back ? "transparent" : color;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, color, glow]);
  return <canvas ref={ref} aria-hidden style={{ width: size, height: size }} />;
}

/** Cycles through `count` indices every `ms` (paused under reduceMotion). */
export function useRotatingIndex(count: number, ms: number, seed = 0): number {
  const [i, setI] = useState(() => (count > 0 ? seed % count : 0));
  useEffect(() => {
    if (count <= 1) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [count, ms]);
  return i;
}

/** Global CSS keyframes for the menus (inlined, no Tailwind config needed). */
export function MenuKeyframes() {
  return (
    <style>{`
@keyframes unlab-flicker { 0%,100%{opacity:1} 3%{opacity:.86} 6%{opacity:1} 41%{opacity:.97} 43%{opacity:1} 77%{opacity:.92} 78%{opacity:1} }
@keyframes unlab-glow { 0%,100%{text-shadow:0 0 12px rgba(51,255,51,.55),0 0 28px rgba(51,255,51,.25)} 50%{text-shadow:0 0 18px rgba(51,255,51,.8),0 0 40px rgba(0,255,255,.25)} }
@keyframes unlab-caret { 0%,49%{opacity:1} 50%,100%{opacity:0} }
@keyframes unlab-roll { from{transform:translateY(0)} to{transform:translateY(-100%)} }
@keyframes unlab-fade { from{opacity:0} to{opacity:1} }
`}</style>
  );
}

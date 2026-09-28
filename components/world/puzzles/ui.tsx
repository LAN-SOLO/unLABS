"use client";

import { fmtNum } from "@/components/world/format";
import { tr } from "@/lib/i18n";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import type { SfxName } from "@/lib/world/audio/sfx";
import type { PuzzleDef } from "@/lib/world/types";

/** Plays one of the world's procedural sound effects. */
export type PuzzleSound = (name: SfxName) => void;

/** Props every puzzle-kind component receives. */
export interface PuzzleProps {
  params: PuzzleDef["params"];
  /** Call when solved (PuzzleView guards against repeated calls). */
  onSolve: () => void;
  /** True once solved — components should stop accepting input. */
  solved: boolean;
  /**
   * Optional SFX hook (PuzzleView forwards `onSound`). Kinds emit `ui_click`
   * for plain manipulation, `keypad_beep` for a correct partial step and
   * `fail_buzz` for a wrong attempt. `puzzle_solved` is played by the host.
   */
  sound?: PuzzleSound;
}

// ---------------------------------------------------------------------------
// Accessibility / effect flags
// ---------------------------------------------------------------------------

export interface PuzzleFx {
  reduceMotion: boolean;
  reduceFlicker: boolean;
  highContrastFocus: boolean;
}

const NO_FX: PuzzleFx = { reduceMotion: false, reduceFlicker: false, highContrastFocus: false };
const PuzzleFxContext = createContext<PuzzleFx>(NO_FX);

/** PuzzleView provides the accessibility settings; standalone kinds get defaults. */
export const PuzzleFxProvider = PuzzleFxContext.Provider;

export function usePuzzleFx(): PuzzleFx {
  return useContext(PuzzleFxContext);
}

/** Stable sound emitter — a no-op when the host passes no `sound`. */
export function useSfx(sound: PuzzleSound | undefined): PuzzleSound {
  const ref = useRef(sound);
  useEffect(() => {
    ref.current = sound;
  }, [sound]);
  return useCallback((name: SfxName) => ref.current?.(name), []);
}

/**
 * Spring-damped follower for gauge needles ("needle inertia"). Returns the
 * target unchanged when `disabled` (reduceMotion).
 */
export function useInertia(target: number, disabled: boolean, stiffness = 70, damping = 11) {
  const [value, setValue] = useState(target);
  const state = useRef({ x: target, vel: 0, target });
  useEffect(() => {
    state.current.target = target;
  }, [target]);
  useEffect(() => {
    if (disabled || typeof requestAnimationFrame !== "function") return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const s = state.current;
      const acc = stiffness * (s.target - s.x) - damping * s.vel;
      s.vel += acc * dt;
      s.x += s.vel * dt;
      if (Math.abs(s.target - s.x) < 0.005 && Math.abs(s.vel) < 0.005) {
        s.x = s.target;
        s.vel = 0;
      }
      setValue((v) => (Math.abs(v - s.x) > 0.01 ? s.x : v));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [disabled, stiffness, damping]);
  return disabled ? target : value;
}

/** Fires `onEnter` once each time `cond` flips from false to true. */
export function useRisingEdge(cond: boolean, onEnter: () => void, onLeave?: () => void) {
  const prev = useRef(cond);
  const cb = useRef({ onEnter, onLeave });
  useEffect(() => {
    cb.current = { onEnter, onLeave };
  });
  useEffect(() => {
    if (cond && !prev.current) cb.current.onEnter();
    else if (!cond && prev.current) cb.current.onLeave?.();
    prev.current = cond;
  }, [cond]);
}

/**
 * Failure feedback: returns a class that shakes the element and flashes it
 * red, re-triggered on every `fail()` call (alternating animation names
 * restart the keyframes), plus the counter itself for aria-live messages.
 */
export function useFailFx(): { failClass: string; fail: () => void; count: number } {
  const [count, setCount] = useState(0);
  const fail = useCallback(() => setCount((c) => c + 1), []);
  const failClass = count === 0 ? "" : count % 2 ? "pz-fail-a" : "pz-fail-b";
  return { failClass, fail, count };
}

/** True when a key event comes from a text field (typing must not trigger hotkeys). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["range", "checkbox", "radio", "button"].includes(target.type);
  }
  return false;
}

/**
 * True when a claimed Enter/Space on this focused control belongs to the
 * puzzle: a control inside the open puzzle that is not an action button.
 */
function claimable(target: HTMLElement): boolean {
  if (target.closest("[data-pz-native-keys]")) return false;
  const root = document.querySelector(".pz-root");
  return !root || root.contains(target);
}

/**
 * Window-level puzzle hotkeys. The handler returns `true` when it consumed
 * the key (→ preventDefault). Escape, modified keys, key repeat (unless
 * `repeat`) and keys typed into text fields never reach it, so the host's
 * Esc layer keeps working.
 *
 * A focused button normally keeps Enter/Space (native click). Keys listed in
 * `claim` are documented puzzle hotkeys (Enter = confirm, Space = action):
 * they reach the handler even while a puzzle control has focus (e.g. an era
 * button after autofocus, a digit after a mouse click) — except on buttons
 * marked `data-pz-native-keys` (actions, reset, cancel), which stay natively clickable.
 */
export function useHotkeys(
  handler: (key: string, e: KeyboardEvent) => boolean | void,
  enabled = true,
  { repeat = true, claim = [] }: { repeat?: boolean; claim?: readonly ("Enter" | " ")[] } = {},
) {
  const claimRef = useRef(claim);
  useEffect(() => {
    claimRef.current = claim;
  });
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat && !repeat) return;
      if (e.defaultPrevented || isTypingTarget(e.target)) return;
      // Sliders own their arrow keys.
      if (
        e.target instanceof HTMLInputElement &&
        e.target.type === "range" &&
        /^(Arrow|Page|Home|End)/.test(e.key)
      )
        return;
      // Buttons handle Enter/Space themselves (native click) — unless the
      // puzzle claims that key and the button is one of its controls.
      if (
        (e.key === "Enter" || e.key === " ") &&
        e.target instanceof HTMLElement &&
        e.target.closest("button, [role='button'], [role='gridcell'], [role='option']") &&
        !((claimRef.current as readonly string[]).includes(e.key) && claimable(e.target))
      )
        return;
      if (ref.current(e.key, e) === true) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, repeat]);
}

/** Arrow keys + WASD → direction delta (null for any other key). */
export function arrowDelta(key: string): readonly [number, number] | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return [0, -1];
    case "ArrowDown":
    case "s":
    case "S":
      return [0, 1];
    case "ArrowLeft":
    case "a":
    case "A":
      return [-1, 0];
    case "ArrowRight":
    case "d":
    case "D":
      return [1, 0];
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shared styles (keyframes + a11y overrides), scoped to `.pz-root`
// ---------------------------------------------------------------------------

const PUZZLE_CSS = `
@keyframes pz-flow { to { stroke-dashoffset: -20; } }
@keyframes pz-flip { 0% { transform: rotateX(90deg); opacity: .15; } 100% { transform: rotateX(0); opacity: 1; } }
@keyframes pz-ripple { 0% { transform: scale(.45); opacity: .9; } 100% { transform: scale(1.9); opacity: 0; } }
@keyframes pz-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
@keyframes pz-pop { 0% { transform: scale(1); } 40% { transform: scale(1.14); } 100% { transform: scale(1); } }
@keyframes pz-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes pz-sweep { 0% { transform: translateY(-120%); } 100% { transform: translateY(520%); } }
@keyframes pz-stamp { 0% { transform: scale(2.8) rotate(-16deg); opacity: 0; } 55% { transform: scale(.92) rotate(-7deg); opacity: 1; } 75% { transform: scale(1.05) rotate(-8deg); } 100% { transform: scale(1) rotate(-8deg); opacity: 1; } }
@keyframes pz-flash { 0% { opacity: .5; } 100% { opacity: 0; } }
@keyframes pz-flicker { 0%,100% { opacity: .5; } 47% { opacity: .5; } 50% { opacity: .35; } 53% { opacity: .5; } }
@keyframes pz-glow { 0%,100% { filter: drop-shadow(0 0 1px currentColor); } 50% { filter: drop-shadow(0 0 6px currentColor); } }
@keyframes pz-turn { from { transform: rotate(-90deg); } to { transform: none; } }
@keyframes pz-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
.pz-flow { stroke-dasharray: 6 14; animation: pz-flow .55s linear infinite; }
.pz-flow-slow { stroke-dasharray: 4 16; animation: pz-flow 1.4s linear infinite; }
.pz-flip { display: inline-block; animation: pz-flip .3s ease-out both; }
.pz-ripple { transform-box: fill-box; transform-origin: center; animation: pz-ripple .6s ease-out forwards; pointer-events: none; }
.pz-shake { animation: pz-shake .35s ease-in-out; }
.pz-pop { transform-box: fill-box; transform-origin: center; animation: pz-pop .28s ease-out; }
.pz-fade-in { animation: pz-fade-in .25s ease-out both; }
.pz-glow { animation: pz-glow 1.6s ease-in-out infinite; }
.pz-turn { animation: pz-turn .16s ease-out; }
.pz-blink { animation: pz-blink 1s steps(1) infinite; }
.pz-sweep { animation: pz-sweep .75s cubic-bezier(.3,.1,.3,1) both; }
.pz-stamp { animation: pz-stamp .45s cubic-bezier(.2,.9,.3,1.2) .2s both; }
.pz-flash { animation: pz-flash .5s ease-out forwards; }
.pz-crt-flicker { animation: pz-flicker 4.5s steps(1) infinite; }
@keyframes pz-fail-a { 0%,100% { transform: translateX(0); box-shadow: 0 0 0 0 rgba(255,64,64,0); } 15% { transform: translateX(-6px); box-shadow: 0 0 0 2px rgba(255,64,64,.9), 0 0 18px rgba(255,64,64,.55); } 35% { transform: translateX(5px); } 55% { transform: translateX(-3px); } 75% { transform: translateX(2px); box-shadow: 0 0 0 1px rgba(255,64,64,.5), 0 0 8px rgba(255,64,64,.3); } }
@keyframes pz-fail-b { 0%,100% { transform: translateX(0); box-shadow: 0 0 0 0 rgba(255,64,64,0); } 15% { transform: translateX(-6px); box-shadow: 0 0 0 2px rgba(255,64,64,.9), 0 0 18px rgba(255,64,64,.55); } 35% { transform: translateX(5px); } 55% { transform: translateX(-3px); } 75% { transform: translateX(2px); box-shadow: 0 0 0 1px rgba(255,64,64,.5), 0 0 8px rgba(255,64,64,.3); } }
@keyframes pz-ok { 0% { box-shadow: 0 0 0 0 rgba(51,255,51,0); } 30% { box-shadow: 0 0 0 2px rgba(51,255,51,.9), 0 0 16px rgba(51,255,51,.5); } 100% { box-shadow: 0 0 0 0 rgba(51,255,51,0); } }
.pz-fail-a { animation: pz-fail-a .42s ease-in-out; border-radius: 2px; }
.pz-fail-b { animation: pz-fail-b .42s ease-in-out; border-radius: 2px; }
.pz-ok { animation: pz-ok .5s ease-out; }
.pz-root kbd { display: inline-block; min-width: 1.4em; padding: 0 .3em; border: 1px solid rgba(51,255,51,.35); border-bottom-width: 2px; border-radius: 3px; background: rgba(0,0,0,.6); color: #33FF33; font-size: .95em; line-height: 1.35; text-align: center; }
.pz-root[data-rm="1"] .pz-fail-a, .pz-root[data-rm="1"] .pz-fail-b { animation: none !important; outline: 2px solid rgba(255,64,64,.9); outline-offset: 2px; }
.pz-root button:not(:disabled), .pz-root [role="button"], .pz-root [role="gridcell"][tabindex] { cursor: pointer; }
.pz-root button:not(:disabled):active { transform: translateY(1px); }
.pz-root :focus-visible { outline: 2px solid #00FFFF; outline-offset: 2px; }
.pz-focus { opacity: 0; pointer-events: none; }
.pz-cell:focus-visible .pz-focus, .pz-cell:focus .pz-focus { opacity: 1; }
.pz-root[data-hc="1"] :focus-visible { outline: 3px solid #FFFF00 !important; outline-offset: 3px !important; box-shadow: 0 0 0 6px #000, 0 0 14px #FFFF00 !important; }
.pz-root[data-hc="1"] .pz-cursor { stroke: #FFFF00 !important; stroke-opacity: 1 !important; stroke-width: 3 !important; }
.pz-root[data-hc="1"] .pz-focus { stroke: #FFFF00 !important; stroke-width: 3 !important; stroke-dasharray: none !important; }
.pz-root[data-rf="1"] .animate-pulse, .pz-root[data-rf="1"] .animate-ping, .pz-root[data-rf="1"] .pz-crt-flicker, .pz-root[data-rf="1"] .pz-blink, .pz-root[data-rf="1"] .pz-glow { animation: none !important; }
.pz-root[data-rf="1"] .animate-ping, .pz-root[data-rf="1"] .pz-flash { display: none !important; }
.pz-root[data-rm="1"] *, .pz-root[data-rm="1"] *::before, .pz-root[data-rm="1"] *::after { animation-duration: 1ms !important; animation-delay: 0ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
`;

/** Keyframes and focus/motion rules; rendered once by PuzzleView. */
export function PuzzleStyles() {
  return <style>{PUZZLE_CSS}</style>;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

type Tone = "green" | "amber" | "cyan" | "red";

const TONE_CLASS: Record<Tone, string> = {
  green:
    "border-[#33FF33]/60 text-[#33FF33] hover:bg-[#33FF33]/10 hover:shadow-[0_0_8px_rgba(51,255,51,0.35)]",
  amber:
    "border-[#FFB800]/60 text-[#FFB800] hover:bg-[#FFB800]/10 hover:shadow-[0_0_8px_rgba(255,184,0,0.35)]",
  cyan: "border-[#00FFFF]/60 text-[#00FFFF] hover:bg-[#00FFFF]/10 hover:shadow-[0_0_8px_rgba(0,255,255,0.35)]",
  red: "border-red-500/60 text-red-400 hover:bg-red-500/10 hover:shadow-[0_0_8px_rgba(255,64,64,0.35)]",
};

export function CrtButton({
  tone = "green",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`rounded-sm border bg-black/40 px-3 py-1 font-mono text-xs tracking-wider uppercase transition-[background-color,box-shadow,transform] duration-100 [text-shadow:0_0_4px_currentColor] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${TONE_CLASS[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Gauges
// ---------------------------------------------------------------------------

/** Horizontal gauge with a green zone and a value marker (needle has inertia). */
export function Gauge({
  label,
  value,
  zone,
  unit = "",
}: {
  label: string;
  value: number;
  zone: readonly [number, number];
  unit?: string;
}) {
  const { reduceMotion } = usePuzzleFx();
  const shown = useInertia(value, reduceMotion, 140, 18);
  const v = Math.max(0, Math.min(100, shown));
  const ok = value >= zone[0] && value <= zone[1];
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[#FFB800]">{label}</span>
        <span
          className={`tabular-nums ${ok ? "text-[#33FF33] [text-shadow:0_0_6px_#33FF33]" : "text-red-400"}`}
        >
          {fmtNum(value, 1)}
          {unit}
        </span>
      </div>
      <div className="relative h-4 w-full overflow-hidden rounded-sm border border-[#33FF33]/30 bg-black">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute bottom-0 h-1.5 w-px bg-[#33FF33]/25"
            style={{ left: `${(i + 1) * 10}%` }}
          />
        ))}
        <div
          className={`absolute inset-y-0 transition-colors ${ok ? "bg-[#33FF33]/30 shadow-[0_0_10px_rgba(51,255,51,0.5)]" : "bg-[#33FF33]/15"}`}
          style={{ left: `${zone[0]}%`, width: `${zone[1] - zone[0]}%` }}
        />
        <div
          className="absolute inset-y-0 w-1 -translate-x-1/2 bg-[#00FFFF] shadow-[0_0_6px_#00FFFF]"
          style={{ left: `${v}%` }}
        />
      </div>
    </div>
  );
}

/** Analog half-dial with a zone arc and a spring-loaded needle (0..100 scale). */
export function DialGauge({
  label,
  value,
  zone,
  unit = "",
  size = 150,
}: {
  label: string;
  value: number;
  zone: readonly [number, number];
  unit?: string;
  size?: number;
}) {
  const { reduceMotion } = usePuzzleFx();
  const shown = useInertia(value, reduceMotion);
  const ok = value >= zone[0] && value <= zone[1];
  const cx = 60;
  const cy = 62;
  const r = 48;
  const pt = (v: number, rr: number): [number, number] => {
    const a = Math.PI * (1 - Math.max(-3, Math.min(103, v)) / 100);
    return [cx + Math.cos(a) * rr, cy - Math.sin(a) * rr];
  };
  const arc = (from: number, to: number, rr: number) => {
    const [x1, y1] = pt(from, rr);
    const [x2, y2] = pt(to, rr);
    return `M ${x1} ${y1} A ${rr} ${rr} 0 0 1 ${x2} ${y2}`;
  };
  const [nx, ny] = pt(shown, r - 6);
  const color = ok ? "#33FF33" : "#00FFFF";
  return (
    <figure
      className="flex flex-col items-center"
      aria-label={`${label}: ${fmtNum(value, 1)}${unit}`}
    >
      <svg viewBox="0 0 120 76" style={{ width: size }} aria-hidden>
        <path
          d={arc(0, 100, r)}
          stroke="#33FF33"
          strokeOpacity={0.25}
          strokeWidth={6}
          fill="none"
        />
        <path
          d={arc(zone[0], zone[1], r)}
          stroke="#33FF33"
          strokeOpacity={ok ? 0.9 : 0.55}
          strokeWidth={6}
          fill="none"
          style={ok ? { filter: "drop-shadow(0 0 4px #33FF33)" } : undefined}
        />
        {Array.from({ length: 11 }, (_, i) => {
          const [x1, y1] = pt(i * 10, r + 5);
          const [x2, y2] = pt(i * 10, r + (i % 5 === 0 ? 11 : 8));
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#33FF33" strokeOpacity={0.5} />
          );
        })}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
        <circle cx={cx} cy={cy} r={4.5} fill="#1A1A1A" stroke={color} strokeWidth={1.5} />
      </svg>
      <figcaption className="-mt-1 flex w-full justify-between gap-2 px-1 text-[11px]">
        <span className="text-[#FFB800]">{label}</span>
        <span
          className={`tabular-nums ${ok ? "text-[#33FF33] [text-shadow:0_0_6px_#33FF33]" : "text-red-400"}`}
        >
          {fmtNum(value, 1)}
          {unit}
        </span>
      </figcaption>
    </figure>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const p = Math.max(0, Math.min(1, value));
  return (
    <div className="w-full">
      <div className="mb-1 text-xs text-[#FFB800]">{label}</div>
      <div
        className="relative h-2 w-full overflow-hidden rounded-sm border border-[#33FF33]/30 bg-black"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
        aria-label={label}
      >
        <div
          className="h-full bg-[#00FF66] shadow-[0_0_8px_#00FF66] transition-[width] duration-150"
          style={{ width: `${p * 100}%` }}
        />
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-y-0 w-px bg-black/60"
            style={{ left: `${(i + 1) * 10}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Row of pips for step-based progress (rounds, pairs, streaks). */
export function StepPips({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <span
      className="flex items-center gap-1"
      role="img"
      aria-label={`${label}: ${done} / ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`inline-block h-2 w-4 rounded-sm border transition-colors ${
            i < done
              ? "border-[#33FF33] bg-[#33FF33] shadow-[0_0_6px_#33FF33]"
              : "border-[#33FF33]/40 bg-black"
          }`}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Seven-segment display
// ---------------------------------------------------------------------------

type Seg = "a" | "b" | "c" | "d" | "e" | "f" | "g";

const SEG_MAP: Record<string, readonly Seg[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "d", "c"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  _: ["d"],
  "-": ["g"],
  E: ["a", "d", "e", "f", "g"],
  F: ["a", "e", "f", "g"],
  H: ["b", "c", "e", "f", "g"],
  L: ["d", "e", "f"],
  R: ["e", "g"],
  O: ["a", "b", "c", "d", "e", "f"],
  K: ["b", "c", "e", "f", "g"],
  " ": [],
};

const T = 6;
function hSeg(x1: number, x2: number, y: number): string {
  const h = T / 2;
  return `${x1},${y} ${x1 + h},${y - h} ${x2 - h},${y - h} ${x2},${y} ${x2 - h},${y + h} ${x1 + h},${y + h}`;
}
function vSeg(x: number, y1: number, y2: number): string {
  const h = T / 2;
  return `${x},${y1} ${x + h},${y1 + h} ${x + h},${y2 - h} ${x},${y2} ${x - h},${y2 - h} ${x - h},${y1 + h}`;
}
const SEG_POLY: Record<Seg, string> = {
  a: hSeg(8, 32, 5),
  b: vSeg(34, 7, 33),
  c: vSeg(34, 37, 63),
  d: hSeg(8, 32, 65),
  e: vSeg(6, 37, 63),
  f: vSeg(6, 7, 33),
  g: hSeg(8, 32, 35),
};
const ALL_SEGS: readonly Seg[] = ["a", "b", "c", "d", "e", "f", "g"];

/** Seven-segment readout with dim "ghost" segments. */
export function SegmentDisplay({
  text,
  color = "#33FF33",
  height = 44,
  label,
}: {
  text: string;
  color?: string;
  height?: number;
  label?: string;
}) {
  const chars = text.toUpperCase().split("");
  return (
    <span className="inline-flex gap-1" role="img" aria-label={label ?? text}>
      {chars.map((ch, i) => {
        const on = new Set(SEG_MAP[ch] ?? []);
        return (
          <svg
            key={i}
            viewBox="0 0 46 70"
            style={{ height, width: (height * 46) / 70 }}
            aria-hidden
          >
            <g transform="skewX(-6) translate(6 0)">
              {ALL_SEGS.map((s) => (
                <polygon
                  key={s}
                  points={SEG_POLY[s]}
                  fill={color}
                  opacity={on.has(s) ? 1 : 0.08}
                  style={on.has(s) ? { filter: `drop-shadow(0 0 3px ${color})` } : undefined}
                />
              ))}
            </g>
          </svg>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hints & status
// ---------------------------------------------------------------------------

/**
 * Counts failed attempts and flips `hint` on after `threshold` failures or,
 * optionally, after `afterSeconds` of play (whichever comes first).
 */
export function useFailHint(threshold = 3, afterSeconds?: number, sound?: PuzzleSound) {
  const [fails, setFails] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (afterSeconds === undefined) return;
    const id = window.setTimeout(() => setTimedOut(true), afterSeconds * 1000);
    return () => window.clearTimeout(id);
  }, [afterSeconds]);
  const fail = useCallback(() => setFails((f) => f + 1), []);
  const hint = fails >= threshold || timedOut;
  // A soft chime the moment the MCP hint unlocks.
  useRisingEdge(hint, () => sound?.("hint_pop"));
  return { fails, fail, hint };
}

/** Small amber MCP hint box, shown once a puzzle unlocks its hint. */
export function HintBox({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <div
      className="pz-fade-in rounded-sm border border-[#FFB800]/50 bg-[#FFB800]/10 px-3 py-2 text-xs leading-relaxed text-[#FFB800] shadow-[0_0_10px_rgba(255,184,0,0.15)]"
      role="note"
    >
      <span className="mr-2 tracking-widest [text-shadow:0_0_5px_#FFB800]">{tr("MCP HINT ›")}</span>
      {children}
    </div>
  );
}

/** Transient status line: green for success, red for failure, dim otherwise. */
export function StatusLine({
  tone,
  children,
}: {
  tone: "ok" | "bad" | "info";
  children: ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "text-[#33FF33] [text-shadow:0_0_6px_#33FF33]"
      : tone === "bad"
        ? "text-red-400 [text-shadow:0_0_5px_rgba(255,64,64,0.6)]"
        : "text-[#33FF33]/70";
  return (
    <p className={`min-h-[1.25rem] text-xs ${cls}`} aria-live="polite">
      <span aria-hidden className="mr-1 opacity-60">
        {tone === "ok" ? "▣" : tone === "bad" ? "▲" : "›"}
      </span>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Help line + reset
// ---------------------------------------------------------------------------

/**
 * Standard footer of every kind: a keyboard help line (use `<kbd>` inside)
 * and an optional reset button. `extra` renders between the two (counters).
 */
export function PuzzleFooter({
  help,
  onReset,
  resetDisabled = false,
  resetLabel = tr("Reset"),
  extra,
}: {
  help: ReactNode;
  onReset?: () => void;
  resetDisabled?: boolean;
  resetLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#33FF33]/10 pt-2">
      <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-[#33FF33]/60" data-pz-help>
        <span aria-hidden className="mr-1 text-[#FFB800]/70">
          ⌨
        </span>
        {help}
      </p>
      {extra}
      {onReset && (
        <CrtButton tone="amber" onClick={onReset} disabled={resetDisabled} data-pz-native-keys>
          ↺ {resetLabel}
        </CrtButton>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colour-blind cues
// ---------------------------------------------------------------------------

/** Distinct shapes paired with colours so no puzzle relies on hue alone. */
export const SHAPES = [
  "circle",
  "triangle",
  "square",
  "diamond",
  "star",
  "cross",
  "hex",
  "ring",
] as const;
export type ShapeName = (typeof SHAPES)[number];
/** Text glyphs matching `SHAPES` (for HTML labels). */
export const SHAPE_GLYPH: Record<ShapeName, string> = {
  circle: "●",
  triangle: "▲",
  square: "■",
  diamond: "◆",
  star: "★",
  cross: "✚",
  hex: "⬢",
  ring: "○",
};

export function shapeAt(i: number): ShapeName {
  return SHAPES[((i % SHAPES.length) + SHAPES.length) % SHAPES.length]!;
}

/** SVG shape centred on (cx, cy) with radius r — usable inside any <svg>. */
export function ShapeMark({
  shape,
  cx,
  cy,
  r,
  fill = "currentColor",
  stroke,
  strokeWidth = 1,
  opacity,
}: {
  shape: ShapeName;
  cx: number;
  cy: number;
  r: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  const common = { fill, stroke, strokeWidth, opacity, "aria-hidden": true } as const;
  const poly = (pts: readonly (readonly [number, number])[]) =>
    pts.map(([x, y]) => `${cx + x * r},${cy + y * r}`).join(" ");
  switch (shape) {
    case "circle":
      return <circle cx={cx} cy={cy} r={r * 0.9} {...common} />;
    case "ring":
      return (
        <circle
          cx={cx}
          cy={cy}
          r={r * 0.75}
          {...common}
          fill="none"
          stroke={stroke ?? fill}
          strokeWidth={Math.max(strokeWidth, r * 0.35)}
        />
      );
    case "triangle":
      return (
        <polygon
          points={poly([
            [0, -1],
            [0.95, 0.75],
            [-0.95, 0.75],
          ])}
          {...common}
        />
      );
    case "square":
      return (
        <rect x={cx - r * 0.8} y={cy - r * 0.8} width={r * 1.6} height={r * 1.6} {...common} />
      );
    case "diamond":
      return (
        <polygon
          points={poly([
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ])}
          {...common}
        />
      );
    case "star": {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? 0.45 : 1;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      return <polygon points={poly(pts)} {...common} />;
    }
    case "cross":
      return (
        <polygon
          points={poly([
            [-0.3, -1],
            [0.3, -1],
            [0.3, -0.3],
            [1, -0.3],
            [1, 0.3],
            [0.3, 0.3],
            [0.3, 1],
            [-0.3, 1],
            [-0.3, 0.3],
            [-1, 0.3],
            [-1, -0.3],
            [-0.3, -0.3],
          ])}
          {...common}
        />
      );
    case "hex": {
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        pts.push([Math.cos(a), Math.sin(a)]);
      }
      return <polygon points={poly(pts)} {...common} />;
    }
  }
}

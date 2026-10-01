/**
 * Lab World — player settings.
 * ============================
 *
 * One typed `Settings` object persisted in localStorage (`unlabs.settings.v1`).
 * Loading merges the stored blob onto the defaults field by field (type-checked,
 * clamped, enum-validated), so old or hand-edited saves never break the game.
 *
 * Non-React code (the render engine) reads `getSettings()` and listens with
 * `subscribeSettings()`; React components use `useSettings()`.
 */

import {
  FOOTSTEP_MODES,
  MUSIC_STYLES,
  MUSIC_SWITCH_MODES,
  SONG_LENGTHS,
  type FootstepMode,
  type MusicStyle,
  type MusicSwitchMode,
  type SongLength,
} from "@/lib/world/audio/songs/styles";
import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALES, getLocale, tr, type Locale } from "@/lib/i18n";
import {
  CLARITY_MODES,
  CRYSTAL_MODES,
  type ClarityMode,
  type CrystalMode,
} from "@/lib/world/clarity-mode";

export const SETTINGS_KEY = "unlabs.settings.v1";

// ── Types ────────────────────────────────────────────────────────

export const GRAPHICS_PRESETS = ["niedrig", "mittel", "hoch", "ultra"] as const;
export type GraphicsPreset = (typeof GRAPHICS_PRESETS)[number];
export const VOXEL_DETAILS = [4, 6, 8] as const;
export type VoxelDetail = (typeof VOXEL_DETAILS)[number];
/** "eigen" = the player tweaked a knob after picking a preset. */
export type GraphicsPresetState = GraphicsPreset | "eigen";

export const SHADOW_QUALITIES = ["aus", "niedrig", "hoch"] as const;
export type ShadowQuality = (typeof SHADOW_QUALITIES)[number];

/** 0 = unbegrenzt. */
export const FPS_LIMITS = [30, 60, 120, 0] as const;
export type FpsLimit = (typeof FPS_LIMITS)[number];

export const TEXT_SPEEDS = ["langsam", "normal", "schnell", "sofort"] as const;
export type TextSpeed = (typeof TEXT_SPEEDS)[number];

/** Seconds; 0 = aus. */
export const AUTOSAVE_INTERVALS = [30, 60, 120, 0] as const;
export type AutosaveInterval = (typeof AUTOSAVE_INTERVALS)[number];

/** HUD density: everything, a folded button row, or only status + compass + minimap. */
export const HUD_MODES = ["full", "compact", "minimal"] as const;
export type HudMode = (typeof HUD_MODES)[number];

/**
 * Biorhythm (lib/world/biorhythm.ts): normal decay, relaxed (half decay) or
 * off (frozen, hidden, no effects).
 */
export const BIORHYTHM_MODES = ["normal", "relaxed", "off"] as const;
export type BiorhythmMode = (typeof BIORHYTHM_MODES)[number];

export const COLORBLIND_MODES = ["aus", "protan", "deutan", "tritan"] as const;
export type ColorblindMode = (typeof COLORBLIND_MODES)[number];

export const CONTROL_ACTIONS = [
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "interact",
  "rotateLeft",
  "rotateRight",
  "zoomIn",
  "zoomOut",
  "inventory",
  "workbench",
  "journal",
  "power",
  "pause",
  "quicksave",
  "quickload",
  "help",
] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];
export type Controls = Record<ControlAction, string>;

export const AUDIO_CHANNELS = ["music", "sfx", "ambience", "ui", "voice"] as const;
export type AudioChannel = (typeof AUDIO_CHANNELS)[number];

export interface GraphicsSettings {
  preset: GraphicsPresetState;
  /** Renderer pixel ratio 0.5..2 (capped by the device pixel ratio, see `effectivePixelRatio`). */
  pixelRatio: number;
  shadows: ShadowQuality;
  bloom: boolean;
  /** 0..1.5 (engine default look: 0.4). */
  bloomStrength: number;
  /** Particle density 0..1. */
  particles: number;
  /**
   * Finest voxel division the clarity eras may reach (cubes per source voxel
   * edge: 4, 6 or 8). The story still sharpens the world, it just stops
   * splitting the voxels here — fine voxels cost triangles.
   */
  voxelDetail: VoxelDetail;
  fpsLimit: FpsLimit;
  showFps: boolean;
  /** Live 3D diorama behind the title screen (off = flat 2D backdrop, saves GPU). */
  menuScene: boolean;
  /** How clear the world looks: follow the story (sharpens as Jade invents), always clear or always big blocks. */
  clarity: ClarityMode;
  /** Crystal age: real surfaces after era 42 (story), always, or never (docs/CRYSTAL.md). */
  crystal: CrystalMode;
  /** Draw Jade as a real person (off = the voxel Jade, saves GPU / build time). */
  realJade: boolean;
}

export interface CameraSettings {
  /** Orthographic view height 18..140 (engine default 46; smaller = closer). */
  defaultZoom: number;
  /** Multiplier 0.25..3 for Q/R rotation speed. */
  rotateSpeed: number;
  /** 0 = snappy, 1 = very soft follow. */
  followSmoothing: number;
}

export interface AudioSettings {
  /** Soundtrack: adaptive songs, one genre, or the generative score. */
  musicStyle: MusicStyle;
  /** A style change crossfades right away (`now`) or after the current song (`afterSong`). */
  musicSwitch: MusicSwitchMode;
  /** Song length: as composed, long (~10 min) or epic (20+ min) with variation passes. */
  songLength: SongLength;
  /** Footstep sound set: `auto` follows Jade's shoes, otherwise one fixed set. */
  footsteps: FootstepMode;
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  ui: number;
  voice: number;
  mute: boolean;
}

export interface GameplaySettings {
  textSpeed: TextSpeed;
  hints: boolean;
  /** 2..15 */
  toastSeconds: number;
  autosaveSeconds: AutosaveInterval;
  confirmDestructive: boolean;
  /** HUD density (`full` shows every button and the control legend). */
  hud: HudMode;
  /** Jade's needs (food, drink, rest, fitness): normal, relaxed or off. */
  biorhythm: BiorhythmMode;
}

export interface AccessibilitySettings {
  reduceFlicker: boolean;
  reduceMotion: boolean;
  highContrastFocus: boolean;
  /** 0.85..1.3 */
  uiScale: number;
  /** Dialogue / subtitle text size 0.85..1.6 (CSS var `--unlab-subtitle-scale`). */
  subtitleScale: number;
  colorblindMode: ColorblindMode;
}

export interface Settings {
  version: 1;
  /** UI language. Changing it reloads the page (see `setLocale` in lib/i18n). */
  language: Locale;
  graphics: GraphicsSettings;
  camera: CameraSettings;
  audio: AudioSettings;
  gameplay: GameplaySettings;
  accessibility: AccessibilitySettings;
  controls: Controls;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// ── Defaults & presets ───────────────────────────────────────────

/** Knobs a graphics preset sets (fps cap, FPS counter and the menu scene stay the player's). */
export type PresetGraphics = Omit<
  GraphicsSettings,
  "preset" | "fpsLimit" | "showFps" | "menuScene" | "clarity" | "crystal" | "realJade"
>;

export const PRESET_GRAPHICS: Record<GraphicsPreset, PresetGraphics> = {
  niedrig: {
    pixelRatio: 0.75,
    shadows: "aus",
    bloom: false,
    bloomStrength: 0,
    particles: 0.3,
    voxelDetail: 4,
  },
  mittel: {
    pixelRatio: 1,
    shadows: "niedrig",
    bloom: true,
    bloomStrength: 0.3,
    particles: 0.6,
    voxelDetail: 6,
  },
  hoch: {
    pixelRatio: 2,
    shadows: "hoch",
    bloom: true,
    bloomStrength: 0.4,
    particles: 1,
    voxelDetail: 8,
  },
  ultra: {
    pixelRatio: 2,
    shadows: "hoch",
    bloom: true,
    bloomStrength: 0.7,
    particles: 1,
    voxelDetail: 8,
  },
};

export const DEFAULT_CONTROLS: Readonly<Controls> = Object.freeze({
  moveUp: "KeyW",
  moveDown: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  interact: "KeyE",
  rotateLeft: "KeyQ",
  rotateRight: "KeyR",
  zoomIn: "Equal",
  zoomOut: "Minus",
  inventory: "KeyI",
  workbench: "KeyB",
  journal: "KeyJ",
  power: "KeyP",
  pause: "Escape",
  quicksave: "F5",
  quickload: "F9",
  help: "KeyH",
});

/**
 * Fixed secondary bindings (not rebindable, mirror what the engine already
 * accepts). A rebound primary key wins over these.
 */
export const SECONDARY_CODES: Readonly<Partial<Record<ControlAction, readonly string[]>>> = {
  moveUp: ["ArrowUp"],
  moveDown: ["ArrowDown"],
  moveLeft: ["ArrowLeft"],
  moveRight: ["ArrowRight"],
  interact: ["Space", "Enter"],
  zoomIn: ["NumpadAdd"],
  zoomOut: ["NumpadSubtract"],
  inventory: ["Tab"],
  help: ["F1"],
};

export const ACTION_LABEL: Record<ControlAction, string> = {
  moveUp: tr("Move up"),
  moveDown: tr("Move down"),
  moveLeft: tr("Move left"),
  moveRight: tr("Move right"),
  interact: tr("Interact"),
  rotateLeft: tr("Rotate camera left"),
  rotateRight: tr("Rotate camera right"),
  zoomIn: tr("Zoom in"),
  zoomOut: tr("Zoom out"),
  inventory: tr("Inventory"),
  workbench: tr("Workbench"),
  journal: tr("Journal"),
  power: tr("Power grid"),
  pause: tr("Pause / Menu"),
  quicksave: tr("Quicksave"),
  quickload: tr("Quickload"),
  help: tr("Help"),
};

// Display labels for the stored option ids (the ids themselves stay German: they are persisted).

export const PRESET_LABEL: Record<GraphicsPresetState, string> = {
  niedrig: tr("low"),
  mittel: tr("medium"),
  hoch: tr("high"),
  ultra: tr("ultra"),
  eigen: tr("custom"),
};

export const CLARITY_LABEL: Record<ClarityMode, string> = {
  story: tr("story"),
  clear: tr("always clear"),
  pixel: tr("always blocky"),
};

export { CLARITY_MODES };

export const CRYSTAL_LABEL: Record<CrystalMode, string> = {
  story: tr("after era 42"),
  always: tr("always"),
  off: tr("never"),
};

export { CRYSTAL_MODES };

export const SHADOW_LABEL: Record<ShadowQuality, string> = {
  aus: tr("off"),
  niedrig: tr("low"),
  hoch: tr("high"),
};

export const TEXT_SPEED_LABEL: Record<TextSpeed, string> = {
  langsam: tr("slow"),
  normal: tr("normal"),
  schnell: tr("fast"),
  sofort: tr("instant"),
};

export const HUD_LABEL: Record<HudMode, string> = {
  full: tr("hud::Full"),
  compact: tr("hud::Compact"),
  minimal: tr("hud::Minimal"),
};

export const BIORHYTHM_LABEL: Record<BiorhythmMode, string> = {
  normal: tr("bio::Normal"),
  relaxed: tr("bio::Relaxed"),
  off: tr("off"),
};

export const COLORBLIND_LABEL: Record<ColorblindMode, string> = {
  aus: tr("off"),
  protan: tr("Protanopia"),
  deutan: tr("Deuteranopia"),
  tritan: tr("Tritanopia"),
};

/** Language names are always shown in their own language. */
export const LANGUAGE_LABEL: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
};

function defaultReduceMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

function buildDefaults(reduceMotion: boolean): Settings {
  return {
    version: 1,
    language: DEFAULT_LOCALE,
    graphics: {
      preset: "hoch",
      ...PRESET_GRAPHICS.hoch,
      fpsLimit: 60,
      showFps: false,
      menuScene: true,
      clarity: "story",
      crystal: "story",
      realJade: true,
    },
    camera: { defaultZoom: 46, rotateSpeed: 1, followSmoothing: 0.5 },
    audio: {
      musicStyle: "adaptive",
      musicSwitch: "now",
      songLength: "long",
      footsteps: "auto",
      master: 0.8,
      music: 0.6,
      sfx: 0.8,
      ambience: 0.6,
      ui: 0.7,
      voice: 0.9,
      mute: false,
    },
    gameplay: {
      textSpeed: "normal",
      hints: true,
      toastSeconds: 5,
      autosaveSeconds: 60,
      confirmDestructive: true,
      hud: "full",
      biorhythm: "normal",
    },
    accessibility: {
      reduceFlicker: reduceMotion,
      reduceMotion,
      highContrastFocus: false,
      uiScale: 1,
      subtitleScale: 1,
      colorblindMode: "aus",
    },
    controls: { ...DEFAULT_CONTROLS },
  };
}

/** Static defaults (stable reference — also the server snapshot for SSR). */
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze(buildDefaults(false));

/** Fresh defaults; respects `prefers-reduced-motion` on first run. */
export function defaultSettings(): Settings {
  return buildDefaults(defaultReduceMotion());
}

// ── Sanitizing merge ─────────────────────────────────────────────

const RANGES: Record<string, readonly [number, number]> = {
  "graphics.pixelRatio": [0.5, 2],
  "graphics.bloomStrength": [0, 1.5],
  "graphics.particles": [0, 1],
  "camera.defaultZoom": [18, 140],
  "camera.rotateSpeed": [0.25, 3],
  "camera.followSmoothing": [0, 1],
  "audio.master": [0, 1],
  "audio.music": [0, 1],
  "audio.sfx": [0, 1],
  "audio.ambience": [0, 1],
  "audio.ui": [0, 1],
  "audio.voice": [0, 1],
  "gameplay.toastSeconds": [2, 15],
  "accessibility.uiScale": [0.85, 1.3],
  "accessibility.subtitleScale": [0.85, 1.6],
};

const ENUMS: Record<string, readonly (string | number)[]> = {
  "graphics.preset": [...GRAPHICS_PRESETS, "eigen"],
  "graphics.shadows": SHADOW_QUALITIES,
  "graphics.fpsLimit": FPS_LIMITS,
  "graphics.clarity": CLARITY_MODES,
  "graphics.crystal": CRYSTAL_MODES,
  "graphics.voxelDetail": VOXEL_DETAILS,
  "gameplay.textSpeed": TEXT_SPEEDS,
  "gameplay.autosaveSeconds": AUTOSAVE_INTERVALS,
  "gameplay.hud": HUD_MODES,
  "gameplay.biorhythm": BIORHYTHM_MODES,
  "audio.musicStyle": MUSIC_STYLES,
  "audio.musicSwitch": MUSIC_SWITCH_MODES,
  "audio.songLength": SONG_LENGTHS,
  "audio.footsteps": FOOTSTEP_MODES,
  "accessibility.colorblindMode": COLORBLIND_MODES,
  language: LOCALES,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Merge one leaf value if it is valid for its path; otherwise keep the base. */
function mergeLeaf(path: string, base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base;
  const allowed = ENUMS[path];
  if (allowed) return allowed.includes(patch as string | number) ? patch : base;
  if (typeof base === "number") {
    if (typeof patch !== "number" || !Number.isFinite(patch)) return base;
    const r = RANGES[path];
    return r ? clamp(patch, r[0], r[1]) : patch;
  }
  if (typeof base === "boolean") return typeof patch === "boolean" ? patch : base;
  if (typeof base === "string") return typeof patch === "string" && patch.length > 0 ? patch : base;
  return base;
}

function mergeSection<T extends object>(section: string, base: T, patch: unknown): T {
  if (!isRecord(patch)) return { ...base };
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(out)) {
    out[key] = mergeLeaf(`${section}.${key}`, out[key], patch[key]);
  }
  return out as T;
}

/**
 * Merge an unknown blob (stored JSON or a partial patch) onto `base`.
 * Unknown keys are dropped, wrong types ignored, numbers clamped.
 */
export function mergeSettings(base: Settings, patch: unknown): Settings {
  if (!isRecord(patch)) return cloneSettings(base);
  return {
    version: 1,
    language: mergeLeaf("language", base.language, patch.language) as Locale,
    graphics: mergeSection("graphics", base.graphics, patch.graphics),
    camera: mergeSection("camera", base.camera, patch.camera),
    audio: mergeSection("audio", base.audio, patch.audio),
    gameplay: mergeSection("gameplay", base.gameplay, patch.gameplay),
    accessibility: mergeSection("accessibility", base.accessibility, patch.accessibility),
    controls: repairControls(mergeSection("controls", base.controls, patch.controls)),
  };
}

export function cloneSettings(s: Settings): Settings {
  return {
    version: 1,
    language: s.language,
    graphics: { ...s.graphics },
    camera: { ...s.camera },
    audio: { ...s.audio },
    gameplay: { ...s.gameplay },
    accessibility: { ...s.accessibility },
    controls: { ...s.controls },
  };
}

// ── Presets ──────────────────────────────────────────────────────

/** Returns a copy of `s` with the preset's graphics bundle applied. */
export function applyPreset(s: Settings, preset: GraphicsPreset): Settings {
  const next = cloneSettings(s);
  next.graphics = { ...next.graphics, ...PRESET_GRAPHICS[preset], preset };
  return next;
}

/** Which preset the current graphics knobs match exactly, or "eigen". */
export function detectPreset(g: GraphicsSettings): GraphicsPresetState {
  for (const p of GRAPHICS_PRESETS) {
    const b = PRESET_GRAPHICS[p];
    if (
      b.pixelRatio === g.pixelRatio &&
      b.shadows === g.shadows &&
      b.bloom === g.bloom &&
      b.bloomStrength === g.bloomStrength &&
      b.particles === g.particles &&
      b.voxelDetail === g.voxelDetail
    )
      return p;
  }
  return "eigen";
}

// ── Store ────────────────────────────────────────────────────────

let cache: Settings | null = null;
const listeners = new Set<() => void>();
let storageBound = false;

export function loadSettings(): Settings {
  const defaults = defaultSettings();
  try {
    if (typeof localStorage === "undefined") return defaults;
    const text = localStorage.getItem(SETTINGS_KEY);
    if (!text) return defaults;
    return mergeSettings(defaults, JSON.parse(text) as unknown);
  } catch {
    return defaults;
  }
}

function notify(): void {
  listeners.forEach((l) => l());
}

export function saveSettings(s: Settings): void {
  cache = mergeSettings(cache ?? defaultSettings(), s);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(cache));
  } catch {
    // Storage blocked — settings still apply for this session.
  }
  notify();
}

function bindStorageEvent(): void {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== SETTINGS_KEY) return;
    cache = loadSettings();
    notify();
  });
}

/** Cached accessor — cheap enough to call every frame. Stable reference until changed. */
export function getSettings(): Settings {
  if (!cache) {
    cache = loadSettings();
    bindStorageEvent();
    bindDocumentEffects();
  }
  return cache;
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  bindStorageEvent();
  return () => {
    listeners.delete(fn);
  };
}

/** Deep-merge a partial patch into the current settings and persist. */
export function updateSettings(patch: DeepPartial<Settings>): Settings {
  const merged = mergeSettings(getSettings(), patch);
  // A manual graphics tweak (without an explicit preset) re-derives the preset label.
  if (isRecord(patch.graphics) && patch.graphics.preset === undefined) {
    merged.graphics.preset = detectPreset(merged.graphics);
  }
  saveSettings(merged);
  return getSettings();
}

/** Restore all defaults (the chosen language is kept). */
export function resetSettings(): Settings {
  saveSettings({ ...defaultSettings(), language: getSettings().language });
  return getSettings();
}

/** For tests: drop the in-memory cache so the next read hits storage. */
export function _resetSettingsCache(): void {
  cache = null;
}

const serverSnapshot = (): Settings => DEFAULT_SETTINGS as Settings;

export function useSettings(): [Settings, (patch: DeepPartial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribeSettings, getSettings, serverSnapshot);
  const update = useCallback((patch: DeepPartial<Settings>) => {
    updateSettings(patch);
  }, []);
  return [settings, update];
}

// ── Controls ─────────────────────────────────────────────────────

/** The action currently bound to `code` (primary first, then fixed secondaries). */
export function actionForCode(
  code: string,
  controls: Controls = getSettings().controls,
): ControlAction | null {
  for (const a of CONTROL_ACTIONS) if (controls[a] === code) return a;
  for (const a of CONTROL_ACTIONS) {
    const sec = SECONDARY_CODES[a];
    if (sec && sec.includes(code)) return a;
  }
  return null;
}

/** All codes that trigger `action` (primary + secondaries not stolen by another primary). */
export function codesForAction(
  action: ControlAction,
  controls: Controls = getSettings().controls,
): string[] {
  const primaries = new Set(Object.values(controls));
  const sec = (SECONDARY_CODES[action] ?? []).filter(
    (c) => !primaries.has(c) || controls[action] === c,
  );
  return [controls[action], ...sec.filter((c) => c !== controls[action])];
}

/** The other action already using `code` as its primary key, if any. */
export function findConflict(
  controls: Controls,
  action: ControlAction,
  code: string,
): ControlAction | null {
  for (const a of CONTROL_ACTIONS) if (a !== action && controls[a] === code) return a;
  return null;
}

/**
 * Undo double bindings (hand-edited or legacy storage): the later action of a
 * pair falls back to its default key when that is free; reserved codes fall
 * back to the default too. Anything still clashing stays and is reported by
 * `controlIssues`.
 */
export function repairControls(controls: Controls): Controls {
  const out = { ...controls };
  const used = new Set<string>();
  for (const a of CONTROL_ACTIONS) {
    let code = out[a];
    if (RESERVED_CODES.includes(code)) code = DEFAULT_CONTROLS[a];
    if (used.has(code)) {
      const taken = new Set(Object.values(out));
      if (!taken.has(DEFAULT_CONTROLS[a])) code = DEFAULT_CONTROLS[a];
    }
    out[a] = code;
    used.add(code);
  }
  return out;
}

export type ControlIssue =
  /** Two actions share a primary key (only possible after manual edits). */
  | { kind: "doppelt"; code: string; actions: ControlAction[] }
  /** A primary key takes over another action's fixed secondary key. */
  | { kind: "verdeckt"; code: string; action: ControlAction; loser: ControlAction }
  /** The key is also used by the menus (↑/↓/Enter/Space navigate there). */
  | { kind: "menu"; code: string; action: ControlAction };

/** Codes the menus always use for navigation (see components/world/menu/shared.tsx). */
export const MENU_CODES: readonly string[] = ["ArrowUp", "ArrowDown", "Enter", "NumpadEnter"];

/** Every binding problem worth telling the player about, in action order. */
export function controlIssues(controls: Controls): ControlIssue[] {
  const out: ControlIssue[] = [];
  const byCode = new Map<string, ControlAction[]>();
  for (const a of CONTROL_ACTIONS) {
    const list = byCode.get(controls[a]) ?? [];
    list.push(a);
    byCode.set(controls[a], list);
  }
  for (const [code, actions] of byCode)
    if (actions.length > 1) out.push({ kind: "doppelt", code, actions });
  for (const a of CONTROL_ACTIONS) {
    const code = controls[a];
    for (const b of CONTROL_ACTIONS) {
      if (b === a) continue;
      if (SECONDARY_CODES[b]?.includes(code) && controls[b] !== code)
        out.push({ kind: "verdeckt", code, action: a, loser: b });
    }
    const nav = SECONDARY_CODES[a]?.includes(code) ?? false;
    if (MENU_CODES.includes(code) && !nav) out.push({ kind: "menu", code, action: a });
  }
  return out;
}

/** True when every primary binding equals the default. */
export function controlsAreDefault(controls: Controls): boolean {
  return CONTROL_ACTIONS.every((a) => controls[a] === DEFAULT_CONTROLS[a]);
}

/** Codes that can never be bound (browser/OS reserved or modifiers alone). */
export const RESERVED_CODES: readonly string[] = [
  "MetaLeft",
  "MetaRight",
  "OSLeft",
  "OSRight",
  "ContextMenu",
  "F11",
  "F12",
];

export interface RebindResult {
  controls: Controls;
  /** The action whose key was swapped to the old key of `action`. */
  swapped: ControlAction | null;
  ok: boolean;
}

/**
 * Bind `code` to `action`. If another action already uses it, the two keys
 * are swapped so no action is ever left unbound.
 */
export function rebind(controls: Controls, action: ControlAction, code: string): RebindResult {
  if (!code || RESERVED_CODES.includes(code)) return { controls, swapped: null, ok: false };
  const next = { ...controls };
  const conflict = findConflict(controls, action, code);
  if (conflict) next[conflict] = controls[action];
  next[action] = code;
  return { controls: next, swapped: conflict, ok: true };
}

const NAMED_CODES: Record<string, string> = {
  Escape: "Esc",
  Space: tr("key::Space"),
  Enter: tr("key::Enter"),
  NumpadEnter: tr("key::Num Enter"),
  Tab: "Tab",
  Backspace: tr("key::Backspace"),
  Delete: tr("key::Del"),
  Insert: tr("key::Ins"),
  Home: tr("key::Home"),
  End: tr("key::End"),
  PageUp: tr("key::Page ↑"),
  PageDown: tr("key::Page ↓"),
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ShiftLeft: tr("key::Shift left"),
  ShiftRight: tr("key::Shift right"),
  ControlLeft: tr("key::Ctrl left"),
  ControlRight: tr("key::Ctrl right"),
  AltLeft: "Alt",
  AltRight: "Alt Gr",
  CapsLock: tr("key::Caps Lock"),
  // Punctuation: US-layout label in English, "QWERTZ / US" in German.
  Equal: tr("key Equal::="),
  Minus: tr("key Minus::-"),
  BracketLeft: tr("key BracketLeft::["),
  BracketRight: tr("key BracketRight::]"),
  Semicolon: tr("key Semicolon::;"),
  Quote: tr("key Quote::'"),
  Backquote: tr("key Backquote::`"),
  Backslash: tr("key Backslash::\\"),
  IntlBackslash: "< >",
  Comma: ",",
  Period: ".",
  Slash: tr("key Slash::/"),
  NumpadAdd: "Num +",
  NumpadSubtract: "Num −",
  NumpadMultiply: "Num ×",
  NumpadDivide: "Num ÷",
  NumpadDecimal: tr("key::Num ."),
  PrintScreen: tr("key::Print"),
  ScrollLock: tr("key::Scroll Lock"),
  Pause: "Pause",
};

/**
 * Human label for a KeyboardEvent.code. Codes are physical positions (US
 * layout names); on a German QWERTZ keyboard `KeyZ` sits where the Y is, so
 * letter keys keep their code letter except Y/Z which get both labels.
 */
export function labelForCode(code: string): string {
  if (!code) return "—";
  if (NAMED_CODES[code]) return NAMED_CODES[code];
  if (code === "KeyZ") return "Z (QWERTZ: Y)";
  if (code === "KeyY") return "Y (QWERTZ: Z)";
  const key = /^Key([A-Z])$/.exec(code);
  if (key) return key[1]!;
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return digit[1]!;
  const num = /^Numpad(\d)$/.exec(code);
  if (num) return `Num ${num[1]}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  return code;
}

// ── Derived helpers for the engine / UI ──────────────────────────

export const SHADOW_MAP_SIZE: Record<ShadowQuality, number> = { aus: 0, niedrig: 1024, hoch: 2048 };

export function shadowMapSize(g: GraphicsSettings): number {
  return SHADOW_MAP_SIZE[g.shadows];
}

/** Renderer pixel ratio: the setting, never above the screen's own ratio (min 1). */
export function effectivePixelRatio(g: GraphicsSettings, devicePixelRatio: number): number {
  return clamp(Math.min(g.pixelRatio, Math.max(1, devicePixelRatio)), 0.5, 2);
}

/** Minimum ms between frames, 0 = unbegrenzt. */
export function frameIntervalMs(g: GraphicsSettings): number {
  return g.fpsLimit === 0 ? 0 : 1000 / g.fpsLimit;
}

/** Camera follow lerp rate per second (engine default 6 at smoothing 0.5). */
export function followLerpRate(c: CameraSettings): number {
  return 2 + (1 - c.followSmoothing) * 8;
}

/** Final gain for a channel, including master and mute. */
export function effectiveVolume(a: AudioSettings, channel: AudioChannel): number {
  return a.mute ? 0 : a.master * a[channel];
}

/** Typewriter speed in characters per second (Infinity = instant). */
export function textCharsPerSecond(speed: TextSpeed): number {
  switch (speed) {
    case "langsam":
      return 25;
    case "normal":
      return 50;
    case "schnell":
      return 110;
    case "sofort":
      return Number.POSITIVE_INFINITY;
  }
}

// ── Colour-blind correction (daltonization) ──────────────────────

/** Row-major 3×3. */
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** Dichromat simulation matrices (linear RGB, Viénot/Brettel style). */
const CB_SIMULATE: Record<Exclude<ColorblindMode, "aus">, Mat3> = {
  protan: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deutan: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritan: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
};

/** Where the lost contrast is shifted to (red/green → blue/luma, blue/yellow → red/green). */
const CB_SHIFT: Record<Exclude<ColorblindMode, "aus">, Mat3> = {
  protan: [0, 0, 0, 0.7, 1, 0, 0.7, 0, 1],
  deutan: [0, 0, 0, 0.7, 1, 0, 0.7, 0, 1],
  tritan: [1, 0, 0.7, 0, 1, 0.7, 0, 0, 0],
};

function mul3(a: Mat3, b: Mat3): Mat3 {
  const o: number[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o.push(a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!);
  return o as unknown as Mat3;
}

/**
 * Daltonization as one colour matrix: out = rgb + SHIFT · (rgb − SIM · rgb),
 * i.e. M = I + SHIFT · (I − SIM). Identity for "aus".
 */
export function colorblindMatrix(mode: ColorblindMode): Mat3 {
  const id: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (mode === "aus") return id;
  const sim = CB_SIMULATE[mode];
  const err = id.map((v, i) => v - sim[i]!) as unknown as Mat3;
  const shift = mul3(CB_SHIFT[mode], err);
  return id.map((v, i) => Math.round((v + shift[i]!) * 1e4) / 1e4) as unknown as Mat3;
}

/** DOM id of the SVG filter for `mode` (injected by `applyDocumentSettings`). */
export function colorblindFilterId(mode: Exclude<ColorblindMode, "aus">): string {
  return `unlab-cb-${mode}`;
}

/**
 * CSS `filter` value for the colour-blind correction, applied to the canvas/HUD
 * wrapper. References an SVG colour-matrix filter that `applyDocumentSettings`
 * injects; if it is missing the browser simply renders unfiltered.
 */
export function colorblindFilter(mode: ColorblindMode): string {
  return mode === "aus" ? "none" : `url(#${colorblindFilterId(mode)})`;
}

// ── Document-level effects (CSS vars, focus ring, SVG filters) ──

const STYLE_ID = "unlab-settings-style";
const SVG_ID = "unlab-settings-filters";

const GLOBAL_CSS = `
html[data-unlab-focus="high"] :focus-visible {
  outline: 3px solid #ffffff !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 5px #000000, 0 0 12px 5px #00ffff !important;
}
html[data-unlab-motion="reduce"] * { scroll-behavior: auto !important; }
`;

function filterMarkup(): string {
  const modes = COLORBLIND_MODES.filter((m): m is Exclude<ColorblindMode, "aus"> => m !== "aus");
  return modes
    .map((m) => {
      const k = colorblindMatrix(m);
      const values = [
        ...k.slice(0, 3),
        0,
        0,
        ...k.slice(3, 6),
        0,
        0,
        ...k.slice(6, 9),
        0,
        0,
        0,
        0,
        0,
        1,
        0,
      ].join(" ");
      return `<filter id="${colorblindFilterId(m)}" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${values}"/></filter>`;
    })
    .join("");
}

/**
 * Push the settings that live outside React/three onto the document:
 * `--unlab-ui-scale`, `--unlab-subtitle-scale`, `data-unlab-focus`
 * (high-contrast focus ring for every focusable element), `data-unlab-motion`,
 * `data-unlab-flicker`, plus the colour-blind SVG filters. Idempotent.
 */
export function applyDocumentSettings(
  s: Settings,
  doc: Document | undefined = globalThis.document,
): void {
  if (!doc?.documentElement) return;
  const root = doc.documentElement;
  const a = s.accessibility;
  root.style.setProperty("--unlab-ui-scale", String(a.uiScale));
  root.style.setProperty("--unlab-subtitle-scale", String(a.subtitleScale));
  root.dataset.unlabFocus = a.highContrastFocus ? "high" : "normal";
  root.dataset.unlabMotion = a.reduceMotion ? "reduce" : "full";
  root.dataset.unlabFlicker = a.reduceFlicker ? "calm" : "full";
  root.dataset.unlabColorblind = a.colorblindMode;
  root.lang = getLocale();
  if (!doc.getElementById(STYLE_ID) && doc.head) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = GLOBAL_CSS;
    doc.head.appendChild(style);
  }
  if (!doc.getElementById(SVG_ID) && doc.body) {
    const holder = doc.createElement("div");
    holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" id="${SVG_ID}" aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none">${filterMarkup()}</svg>`;
    const svg = holder.firstElementChild;
    if (svg) doc.body.appendChild(svg);
  }
}

let docBound = false;

/** Apply document effects now and on every change (client only, once). */
function bindDocumentEffects(): void {
  if (docBound || typeof window === "undefined" || typeof document === "undefined") return;
  docBound = true;
  listeners.add(() => applyDocumentSettings(getSettings()));
  // Deferred: getSettings() may run inside a React render; never touch the DOM there.
  setTimeout(() => applyDocumentSettings(getSettings()), 0);
}

/** True if any code bound to `action` is in the held-keys set (engine movement polling). */
export function actionHeld(
  keys: ReadonlySet<string>,
  action: ControlAction,
  controls: Controls = getSettings().controls,
): boolean {
  return codesForAction(action, controls).some((c) => keys.has(c));
}

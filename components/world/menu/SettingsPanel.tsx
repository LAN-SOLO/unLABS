"use client";

import { fmtNum } from "@/components/world/format";
import { GENRE_LABEL, STYLE_LABEL, mmss } from "@/lib/world/audio/songs/labels";
import {
  FOOTSTEP_MODES,
  MUSIC_STYLES,
  MUSIC_SWITCH_MODES,
  SONG_LENGTHS,
} from "@/lib/world/audio/songs/styles";
import { FOOTSTEP_MODE_LABEL, LENGTH_LABEL, SWITCH_LABEL } from "@/lib/world/audio/audio-labels";
import { activeAudio } from "@/lib/world/audio/active";
import type { MusicStatus } from "@/lib/world/audio/music";
import { getLocale, setLocale, tr, LOCALES } from "@/lib/i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog, CrtButton, MenuPanel } from "@/components/world/menu/shared";
import {
  ACTION_LABEL,
  AUTOSAVE_INTERVALS,
  BIORHYTHM_LABEL,
  BIORHYTHM_MODES,
  CLARITY_LABEL,
  CLARITY_MODES,
  CRYSTAL_LABEL,
  CRYSTAL_MODES,
  VOXEL_DETAILS,
  COLORBLIND_LABEL,
  COLORBLIND_MODES,
  CONTROL_ACTIONS,
  DEFAULT_CONTROLS,
  FPS_LIMITS,
  GRAPHICS_PRESETS,
  HUD_LABEL,
  HUD_MODES,
  LANGUAGE_LABEL,
  PRESET_LABEL,
  SECONDARY_CODES,
  SHADOW_LABEL,
  SHADOW_QUALITIES,
  TEXT_SPEED_LABEL,
  TEXT_SPEEDS,
  applyPreset,
  colorblindFilter,
  controlIssues,
  controlsAreDefault,
  defaultSettings,
  effectiveVolume,
  followLerpRate,
  getSettings,
  labelForCode,
  rebind,
  saveSettings,
  textCharsPerSecond,
  useSettings,
  type AudioChannel,
  type AudioSettings,
  type ControlAction,
  type ControlIssue,
  type DeepPartial,
  type Settings,
  type TextSpeed,
} from "@/lib/world/settings";

export const SETTINGS_TABS = [
  "grafik",
  "kamera",
  "audio",
  "spiel",
  "barrierefreiheit",
  "steuerung",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const TAB_LABEL: Record<SettingsTab, string> = {
  grafik: tr("Graphics"),
  kamera: tr("Camera"),
  audio: tr("Audio"),
  spiel: tr("Game"),
  barrierefreiheit: tr("Accessibility"),
  steuerung: tr("Controls"),
};

// ── Controls ─────────────────────────────────────────────────────

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#33FF33]/10 py-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="sm:w-56 sm:shrink-0">
        <div className="text-xs text-[#d8ffd8]">{label}</div>
        {hint && <div className="text-[10px] text-[#33FF33]/45">{hint}</div>}
      </div>
      <div className="flex flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer accent-[#33FF33]"
      />
      <span className="w-14 text-right text-xs text-[#FFB800] tabular-nums">
        {format ? format(value) : fmtNum(value, 2)}
      </span>
    </Row>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-10 rounded-sm border transition-colors focus-visible:outline-2 focus-visible:outline-[#00FFFF] ${
          value ? "border-[#33FF33] bg-[#33FF33]/20" : "border-[#33FF33]/30 bg-black"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-4 rounded-[1px] transition-all ${
            value ? "left-5 bg-[#33FF33] shadow-[0_0_6px_#33FF33]" : "left-0.5 bg-[#33FF33]/40"
          }`}
        />
      </button>
      <span className="text-xs text-[#33FF33]/70">{value ? tr("on") : tr("off")}</span>
    </Row>
  );
}

function Choice<T extends string | number>({
  label,
  hint,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly T[];
  format?: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={o === value}
            onClick={() => onChange(o)}
            className={`rounded-sm border px-2 py-0.5 font-mono text-[11px] tracking-wider uppercase transition-colors focus-visible:outline-2 focus-visible:outline-[#00FFFF] ${
              o === value
                ? "border-[#00FFFF] bg-[#00FFFF]/10 text-[#00FFFF]"
                : "border-[#33FF33]/25 text-[#33FF33]/70 hover:border-[#33FF33]/60"
            }`}
          >
            {format ? format(o) : String(o)}
          </button>
        ))}
      </div>
    </Row>
  );
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

// ── Live previews ────────────────────────────────────────────────

let testCtx: AudioContext | null = null;

/** Short blip at the channel's effective volume (master × channel, mute respected). */
export function playTestTone(a: AudioSettings, channel: AudioChannel): void {
  const gain = effectiveVolume(a, channel);
  if (gain <= 0 || typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    testCtx ??= new Ctor();
    const ctx = testCtx;
    void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const freq: Record<AudioChannel, number> = {
      music: 440,
      sfx: 660,
      ambience: 220,
      ui: 990,
      voice: 330,
    };
    osc.type = channel === "ambience" ? "sine" : "square";
    osc.frequency.setValueAtTime(freq[channel], t);
    osc.frequency.exponentialRampToValueAtTime(freq[channel] * 1.5, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.25 * gain), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  } catch {
    // Audio blocked — the preview is optional.
  }
}

/** A dot chasing a target with the configured follow rate (same lerp as the engine camera). */
function FollowPreview({ rate, still }: { rate: number; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rateRef = useRef(rate);
  useEffect(() => {
    rateRef.current = rate;
  });
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    let raf = 0;
    let last = 0;
    let t = 0;
    let cam = W / 2;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!still) t += dt;
      // Target walks left/right with pauses, like Lawrence crossing a room.
      const phase = (t * 0.35) % 2;
      const u = phase < 1 ? phase : 2 - phase;
      const eased = u < 0.2 ? 0 : u > 0.8 ? 1 : (u - 0.2) / 0.6;
      const target = 24 + eased * (W - 48);
      cam += (target - cam) * (1 - Math.exp(-dt * rateRef.current));
      ctx.fillStyle = "#050805";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(51,255,51,0.12)";
      for (let x = 0; x < W; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
        ctx.stroke();
      }
      ctx.fillStyle = "#FFB800";
      ctx.fillRect(target - 3, H / 2 - 3, 6, 6);
      ctx.strokeStyle = "#00FFFF";
      ctx.strokeRect(cam - 18, H / 2 - 12, 36, 24);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [still]);
  return (
    <Row label={tr("Preview")} hint={tr("Yellow = character, cyan = camera")}>
      <canvas
        ref={ref}
        width={240}
        height={40}
        aria-hidden
        className="h-10 w-60 rounded-sm border border-[#33FF33]/20"
      />
    </Row>
  );
}

const PREVIEW_LINE = tr("Cryo pod opened. Residual charge 0.3 %. Please do not panic.");

/** The configured typewriter speed on a sample line (restarts on change). */
function TypewriterPreview({ speed, scale }: { speed: TextSpeed; scale: number }) {
  const cps = textCharsPerSecond(speed);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(cps)) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const k = Math.floor(((performance.now() - start) / 1000) * cps);
      // Hold the full line for a moment, then restart.
      setN(k > PREVIEW_LINE.length + cps ? 0 : k);
      if (k > PREVIEW_LINE.length + cps) window.clearInterval(id);
    }, 30);
    return () => window.clearInterval(id);
  }, [cps, speed]);
  const shown = Number.isFinite(cps) ? PREVIEW_LINE.slice(0, n) : PREVIEW_LINE;
  return (
    <Row label={tr("Preview")}>
      <span
        className="min-h-5 font-mono text-[#d8ffd8]"
        style={{ fontSize: `calc(0.75rem * ${scale})` }}
        aria-hidden
      >
        {shown}
        <span className="text-[#33FF33]">▌</span>
      </span>
    </Row>
  );
}

const SWATCHES: readonly (readonly [string, string])[] = [
  ["#33FF33", tr("on")],
  ["#FF3333", tr("Alarm")],
  ["#FFB800", tr("Warning")],
  ["#00FFFF", tr("Info")],
  ["#8B00FF", tr("Anomaly")],
  ["#ff2a1a", "MCP"],
];

/** Status colours of the lab with the colour-blind filter applied. */
function PalettePreview({ filter }: { filter: string }) {
  return (
    <Row label={tr("Preview")} hint={tr("Status colours with the active filter")}>
      <div className="flex flex-wrap gap-1.5" style={{ filter }}>
        {SWATCHES.map(([c, l]) => (
          <span key={l} className="flex flex-col items-center gap-0.5 text-[9px] text-[#d8ffd8]">
            <span
              className="h-5 w-8 rounded-sm border border-black"
              style={{ background: c, boxShadow: `0 0 6px ${c}` }}
            />
            {l}
          </span>
        ))}
      </div>
    </Row>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────

type Update = (patch: DeepPartial<Settings>) => void;

function GraphicsTab({ s, update }: { s: Settings; update: Update }) {
  const g = s.graphics;
  return (
    <>
      <Choice
        label={tr("Preset")}
        hint={g.preset === "eigen" ? tr("Custom settings active") : undefined}
        value={g.preset === "eigen" ? ("eigen" as const) : g.preset}
        options={[...GRAPHICS_PRESETS]}
        format={(p) => PRESET_LABEL[p]}
        onChange={(p) => {
          if (p !== "eigen") saveSettings(applyPreset(getSettings(), p));
        }}
      />
      <Slider
        label={tr("Resolution scale")}
        hint={tr("Renderer pixel ratio (max. screen)")}
        value={g.pixelRatio}
        min={0.5}
        max={2}
        step={0.25}
        format={(v) => `${fmtNum(v, 2)}×`}
        onChange={(v) => update({ graphics: { pixelRatio: v } })}
      />
      <Choice
        label={tr("Shadows")}
        value={g.shadows}
        options={SHADOW_QUALITIES}
        format={(v) => SHADOW_LABEL[v]}
        onChange={(v) => update({ graphics: { shadows: v } })}
      />
      <Toggle
        label={tr("Bloom (glow)")}
        value={g.bloom}
        onChange={(v) => update({ graphics: { bloom: v } })}
      />
      <Slider
        label={tr("Bloom strength")}
        value={g.bloomStrength}
        min={0}
        max={1.5}
        step={0.05}
        onChange={(v) => update({ graphics: { bloomStrength: v } })}
      />
      <Slider
        label={tr("Particle density")}
        value={g.particles}
        min={0}
        max={1}
        step={0.05}
        format={pct}
        onChange={(v) => update({ graphics: { particles: v } })}
      />
      <Choice
        label={tr("Voxel detail")}
        hint={tr("How fine the voxels may get as the world clears up (finer = more GPU)")}
        value={g.voxelDetail}
        options={VOXEL_DETAILS}
        format={(v) => tr("{n}× per voxel", { n: v })}
        onChange={(v) => update({ graphics: { voxelDetail: v } })}
      />
      <Toggle
        label={tr("Title screen diorama")}
        hint={tr("Live 3D lab behind the main menu (off = flat backdrop)")}
        value={g.menuScene}
        onChange={(v) => update({ graphics: { menuScene: v } })}
      />
      <Choice
        label={tr("World clarity")}
        hint={tr(
          "Story: the voxels get finer with every invention. Always clear / always blocky fix the look.",
        )}
        value={g.clarity}
        options={CLARITY_MODES}
        format={(v) => CLARITY_LABEL[v]}
        onChange={(v) => update({ graphics: { clarity: v } })}
      />
      <Choice
        label={tr("Crystal age")}
        hint={tr(
          "When the voxels give way to real, rendered surfaces: after the last era, always, or never.",
        )}
        value={g.crystal}
        options={CRYSTAL_MODES}
        format={(v) => CRYSTAL_LABEL[v]}
        onChange={(v) => update({ graphics: { crystal: v } })}
      />
      <Toggle
        label={tr("Realistic Jade")}
        hint={tr(
          "Jade as a real person in the voxel world (off = voxel Jade; applies on the next load)",
        )}
        value={g.realJade}
        onChange={(v) => update({ graphics: { realJade: v } })}
      />
      <Choice
        label={tr("Frame rate limit")}
        value={g.fpsLimit}
        options={FPS_LIMITS}
        format={(v) => (v === 0 ? tr("unlimited") : tr("{n} fps", { n: v }))}
        onChange={(v) => update({ graphics: { fpsLimit: v } })}
      />
      <Toggle
        label={tr("Show FPS")}
        value={g.showFps}
        onChange={(v) => update({ graphics: { showFps: v } })}
      />
    </>
  );
}

function CameraTab({ s, update }: { s: Settings; update: Update }) {
  const c = s.camera;
  return (
    <>
      <Slider
        label={tr("Default zoom")}
        hint={tr("Smaller = closer")}
        value={c.defaultZoom}
        min={18}
        max={140}
        step={1}
        format={(v) => v.toFixed(0)}
        onChange={(v) => update({ camera: { defaultZoom: v } })}
      />
      <Slider
        label={tr("Rotation speed")}
        value={c.rotateSpeed}
        min={0.25}
        max={3}
        step={0.05}
        format={(v) => `${fmtNum(v, 2)}×`}
        onChange={(v) => update({ camera: { rotateSpeed: v } })}
      />
      <Slider
        label={tr("Camera follow")}
        hint={tr("0 % = direct, 100 % = very soft")}
        value={c.followSmoothing}
        min={0}
        max={1}
        step={0.05}
        format={pct}
        onChange={(v) => update({ camera: { followSmoothing: v } })}
      />
      <FollowPreview rate={followLerpRate(c)} still={s.accessibility.reduceMotion} />
    </>
  );
}

/**
 * What the music does right now: the song playing and, with "after the
 * song", which style takes over when it ends. Reads the active audio system
 * (title screen or game) twice a second; hidden while nothing plays.
 */
function MusicNowLine() {
  const [st, setSt] = useState<MusicStatus | null>(null);
  useEffect(() => {
    const read = () => setSt(activeAudio()?.musicStatus() ?? null);
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, []);
  if (!st) return null;
  const now = st.song
    ? tr("Now playing: {title} ({genre}) · {pos} / {total}", {
        title: st.song.title,
        genre: GENRE_LABEL[st.song.genre],
        pos: mmss(st.seconds),
        total: mmss(st.total),
      })
    : st.style === "generative"
      ? tr("Now playing: the generative score")
      : null;
  return (
    <div
      className="border-b border-[#33FF33]/10 py-1.5 text-[11px]"
      aria-live="polite"
      data-music-now
    >
      {now && <div className="text-[#33FF33]/70">♪ {now}</div>}
      {st.pending && (
        <div className="text-[#FFB800]">
          {st.song
            ? tr("Switches after this song ({left} left) → {style}", {
                left: mmss(Math.max(0, st.total - st.seconds)),
                style: STYLE_LABEL[st.pending],
              })
            : tr("Next: {style}", { style: STYLE_LABEL[st.pending] })}
        </div>
      )}
    </div>
  );
}

function AudioTab({ s, update }: { s: Settings; update: Update }) {
  const a = s.audio;
  const channels = [
    ["master", tr("Master volume")],
    ["music", tr("Music")],
    ["sfx", tr("Effects")],
    ["ambience", tr("Ambience")],
    ["ui", tr("Interface")],
    ["voice", tr("Voices")],
  ] as const;
  return (
    <>
      <Toggle label={tr("Mute")} value={a.mute} onChange={(v) => update({ audio: { mute: v } })} />
      <Choice
        label={tr("Music style")}
        hint={tr(
          "Adaptive picks songs that fit the room and the moment; a genre plays only that; generative is the original endless score",
        )}
        value={a.musicStyle}
        options={MUSIC_STYLES}
        format={(v) => STYLE_LABEL[v]}
        onChange={(v) => update({ audio: { musicStyle: v } })}
      />
      <Choice
        label={tr("Style change")}
        hint={
          a.musicSwitch === "now"
            ? tr(
                "Right away: a new style crossfades to a fitting song within about 1.5 seconds (a song that already fits keeps playing).",
              )
            : tr(
                "After the song: the current piece always plays to its end, then the next one comes from the new style. The room never cuts a song short either.",
              )
        }
        value={a.musicSwitch}
        options={MUSIC_SWITCH_MODES}
        format={(v) => SWITCH_LABEL[v]}
        onChange={(v) => update({ audio: { musicSwitch: v } })}
      />
      <MusicNowLine />
      <Choice
        label={tr("Song length")}
        hint={tr(
          "Long and epic add variation passes (breakdowns, solos, drums dropping out, a key shift) before the outro. Applies from the next song.",
        )}
        value={a.songLength}
        options={SONG_LENGTHS}
        format={(v) => LENGTH_LABEL[v]}
        onChange={(v) => update({ audio: { songLength: v } })}
      />
      <Choice
        label={tr("Footsteps")}
        hint={tr(
          "Auto uses the shoes Jade is wearing (and what jingles on her); a fixed set always sounds the same. Volume follows Effects.",
        )}
        value={a.footsteps}
        options={FOOTSTEP_MODES}
        format={(v) => FOOTSTEP_MODE_LABEL[v]}
        onChange={(v) => update({ audio: { footsteps: v } })}
      />
      {channels.map(([key, label]) => (
        <div key={key} className="flex items-center gap-2">
          <div className="flex-1">
            <Slider
              label={label}
              value={a[key]}
              min={0}
              max={1}
              step={0.05}
              format={pct}
              onChange={(v) => update({ audio: { [key]: v } })}
            />
          </div>
          <button
            type="button"
            onClick={() => playTestTone(a, key === "master" ? "sfx" : key)}
            aria-label={tr("Test {channel}", { channel: label })}
            title={tr("Test tone")}
            className="rounded-sm border border-[#33FF33]/30 px-1.5 py-0.5 text-[10px] text-[#33FF33]/80 hover:border-[#33FF33] focus-visible:outline-2 focus-visible:outline-[#00FFFF]"
          >
            ▶
          </button>
        </div>
      ))}
    </>
  );
}

function GameplayTab({ s, update }: { s: Settings; update: Update }) {
  const g = s.gameplay;
  return (
    <>
      <Choice
        label={tr("Language / Sprache")}
        hint={tr("Reloads the game (progress is saved)")}
        value={getLocale()}
        options={LOCALES}
        format={(l) => LANGUAGE_LABEL[l]}
        onChange={(l) => {
          if (l === getLocale()) return;
          update({ language: l });
          setLocale(l);
        }}
      />
      <Choice
        label={tr("Text speed")}
        value={g.textSpeed}
        options={TEXT_SPEEDS}
        format={(v) => TEXT_SPEED_LABEL[v]}
        onChange={(v) => update({ gameplay: { textSpeed: v } })}
      />
      <TypewriterPreview speed={g.textSpeed} scale={s.accessibility.subtitleScale} />
      <Toggle
        label={tr("Hints")}
        hint={tr("Gentle tips when you are stuck")}
        value={g.hints}
        onChange={(v) => update({ gameplay: { hints: v } })}
      />
      <Choice
        label={tr("HUD")}
        hint={tr("Compact folds the buttons into one menu; minimal keeps status, compass and map")}
        value={g.hud}
        options={HUD_MODES}
        format={(v) => HUD_LABEL[v]}
        onChange={(v) => update({ gameplay: { hud: v } })}
      />
      <Choice
        label={tr("Biorhythm")}
        hint={tr("Jade's food, drink, sleep and fitness — relaxed halves the decay, off hides it")}
        value={g.biorhythm}
        options={BIORHYTHM_MODES}
        format={(v) => BIORHYTHM_LABEL[v]}
        onChange={(v) => update({ gameplay: { biorhythm: v } })}
      />
      <Slider
        label={tr("Message duration")}
        value={g.toastSeconds}
        min={2}
        max={15}
        step={1}
        format={(v) => tr("{n} s", { n: v })}
        onChange={(v) => update({ gameplay: { toastSeconds: v } })}
      />
      <Choice
        label={tr("Autosave")}
        value={g.autosaveSeconds}
        options={AUTOSAVE_INTERVALS}
        format={(v) => (v === 0 ? tr("off") : tr("{n} s", { n: v }))}
        onChange={(v) => update({ gameplay: { autosaveSeconds: v } })}
      />
      <Toggle
        label={tr("Confirm delete/overwrite")}
        value={g.confirmDestructive}
        onChange={(v) => update({ gameplay: { confirmDestructive: v } })}
      />
    </>
  );
}

function AccessibilityTab({ s, update }: { s: Settings; update: Update }) {
  const a = s.accessibility;
  return (
    <>
      <Toggle
        label={tr("Reduce flicker")}
        hint={tr("No phosphor flicker, no flashes")}
        value={a.reduceFlicker}
        onChange={(v) => update({ accessibility: { reduceFlicker: v } })}
      />
      <Toggle
        label={tr("Reduce motion")}
        hint={tr("Less animation in menus and camera")}
        value={a.reduceMotion}
        onChange={(v) => update({ accessibility: { reduceMotion: v } })}
      />
      <Toggle
        label={tr("High-contrast focus ring")}
        value={a.highContrastFocus}
        onChange={(v) => update({ accessibility: { highContrastFocus: v } })}
      />
      <Slider
        label={tr("Interface size")}
        value={a.uiScale}
        min={0.85}
        max={1.3}
        step={0.05}
        format={pct}
        onChange={(v) => update({ accessibility: { uiScale: v } })}
      />
      <Slider
        label={tr("Subtitle & dialogue size")}
        hint={tr("Text size in conversations, terminals and scenes")}
        value={a.subtitleScale}
        min={0.85}
        max={1.6}
        step={0.05}
        format={pct}
        onChange={(v) => update({ accessibility: { subtitleScale: v } })}
      />
      <p
        className="border-b border-[#33FF33]/10 py-2 text-[#d8ffd8]"
        style={{ fontSize: `calc(0.8rem * ${a.subtitleScale})` }}
      >
        <span className="text-[#FF3333]">MCP:</span>{" "}
        {tr("You now have enough power to fail at more interesting things.")}
      </p>
      <Choice
        label={tr("Colour vision deficiency")}
        value={a.colorblindMode}
        options={COLORBLIND_MODES}
        format={(v) => COLORBLIND_LABEL[v]}
        onChange={(v) => update({ accessibility: { colorblindMode: v } })}
      />
      <PalettePreview filter={colorblindFilter(a.colorblindMode)} />
    </>
  );
}

/** One sentence per binding problem. */
export function issueText(i: ControlIssue): string {
  switch (i.kind) {
    case "doppelt":
      return tr("{key} is bound more than once: {actions}.", {
        key: labelForCode(i.code),
        actions: i.actions.map((a) => ACTION_LABEL[a]).join(", "),
      });
    case "verdeckt":
      return tr("{key} (“{action}”) replaces the secondary key of “{loser}”.", {
        key: labelForCode(i.code),
        action: ACTION_LABEL[i.action],
        loser: ACTION_LABEL[i.loser],
      });
    case "menu":
      return tr("{key} (“{action}”) also controls the menus — in a menu the key acts there.", {
        key: labelForCode(i.code),
        action: ACTION_LABEL[i.action],
      });
  }
}

/** Key rebinding list. Exported for a standalone "Controls" view. */
export function ControlsTab({
  capturing,
  setCapturing,
}: {
  capturing: ControlAction | null;
  setCapturing: (a: ControlAction | null) => void;
}) {
  const [s] = useSettings();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === "Escape" && capturing !== "pause") {
        setCapturing(null);
        setNotice(null);
        return;
      }
      const current = getSettings().controls;
      const r = rebind(current, capturing, e.code);
      if (!r.ok) {
        setNotice(tr("{key} is reserved and cannot be bound.", { key: labelForCode(e.code) }));
        return;
      }
      saveSettings({ ...getSettings(), controls: r.controls });
      setNotice(
        r.swapped
          ? tr("{key} was bound to “{action}” — swapped: “{action}” is now on {newKey}.", {
              key: labelForCode(e.code),
              action: ACTION_LABEL[r.swapped],
              newKey: labelForCode(r.controls[r.swapped]),
            })
          : null,
      );
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, setCapturing]);

  const resetOne = (a: ControlAction) => {
    const r = rebind(getSettings().controls, a, DEFAULT_CONTROLS[a]);
    saveSettings({ ...getSettings(), controls: r.controls });
    setNotice(
      r.swapped
        ? tr("“{action}” was on {oldKey} and has been moved to {newKey}.", {
            action: ACTION_LABEL[r.swapped],
            oldKey: labelForCode(DEFAULT_CONTROLS[a]),
            newKey: labelForCode(r.controls[r.swapped]),
          })
        : null,
    );
  };
  const resetAll = () => {
    saveSettings({ ...getSettings(), controls: { ...DEFAULT_CONTROLS } });
    setCapturing(null);
    setNotice(tr("All keys reset to default."));
  };
  const issues = controlIssues(s.controls);
  const flagged = new Set<ControlAction>(
    issues.flatMap((i) => (i.kind === "doppelt" ? i.actions : [i.action])),
  );

  return (
    <div>
      <p className="mb-2 text-[11px] text-[#33FF33]/55">
        {tr(
          "Click a key, then press the new binding. Esc cancels. Keys that are already taken are swapped.",
        )}
      </p>
      {notice && (
        <p
          className="mb-2 rounded-sm border border-[#FFB800]/40 bg-[#FFB800]/5 px-2 py-1 text-[11px] text-[#FFB800]"
          role="status"
        >
          {notice}
        </p>
      )}
      {issues.length > 0 && (
        <ul
          className="mb-2 flex flex-col gap-0.5 rounded-sm border border-[#FF3333]/40 bg-[#FF3333]/5 px-2 py-1 text-[11px] text-[#FF9A9A]"
          aria-label={tr("Conflicts")}
        >
          {issues.map((i) => (
            <li key={`${i.kind}-${i.code}-${i.kind === "doppelt" ? "" : i.action}`}>
              {issueText(i)}
            </li>
          ))}
        </ul>
      )}
      <div className="mb-2 flex justify-end">
        <CrtButton tone="amber" disabled={controlsAreDefault(s.controls)} onClick={resetAll}>
          {tr("Reset all keys")}
        </CrtButton>
      </div>
      <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
        {CONTROL_ACTIONS.map((a) => {
          const code = s.controls[a];
          const sec = SECONDARY_CODES[a] ?? [];
          const isDefault = code === DEFAULT_CONTROLS[a];
          return (
            <div
              key={a}
              className="flex items-center gap-2 border-b border-[#33FF33]/10 py-1.5 text-xs"
            >
              <span className="flex-1 text-[#d8ffd8]">{ACTION_LABEL[a]}</span>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setCapturing(capturing === a ? null : a);
                }}
                aria-label={tr("Rebind {action}", { action: ACTION_LABEL[a] })}
                className={`min-w-20 rounded-sm border px-2 py-0.5 font-mono text-[11px] focus-visible:outline-2 focus-visible:outline-[#00FFFF] ${
                  capturing === a
                    ? "animate-pulse border-[#FFB800] text-[#FFB800]"
                    : flagged.has(a)
                      ? "border-[#FF3333] text-[#FF6666]"
                      : "border-[#33FF33]/40 text-[#33FF33] hover:border-[#33FF33]"
                }`}
              >
                {capturing === a ? tr("Key …") : labelForCode(code)}
              </button>
              <span className="hidden w-24 truncate text-[10px] text-[#33FF33]/40 sm:inline">
                {sec.map(labelForCode).join(" · ")}
              </span>
              <button
                type="button"
                disabled={isDefault}
                onClick={() => resetOne(a)}
                title={tr("Default")}
                aria-label={tr("Reset {action}", { action: ACTION_LABEL[a] })}
                className="w-5 text-[#FFB800] disabled:opacity-20"
              >
                ↺
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────

/** Tabbed settings overlay; every change is applied and persisted immediately. */
export function SettingsPanel({
  onClose,
  initialTab = "grafik",
  z = 80,
}: {
  onClose: () => void;
  initialTab?: SettingsTab;
  z?: number;
}) {
  const [s, update] = useSettings();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [capturing, setCapturing] = useState<ControlAction | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const resetTab = () => {
    const d = defaultSettings();
    const cur = getSettings();
    const next: Settings = { ...cur };
    if (tab === "grafik") next.graphics = d.graphics;
    else if (tab === "kamera") next.camera = d.camera;
    else if (tab === "audio") next.audio = d.audio;
    else if (tab === "spiel") next.gameplay = d.gameplay;
    else if (tab === "barrierefreiheit") next.accessibility = d.accessibility;
    else next.controls = { ...DEFAULT_CONTROLS };
    saveSettings(next);
    setConfirmReset(false);
  };

  return (
    <MenuPanel
      title={tr("Settings")}
      subtitle={tr("Changes apply immediately.")}
      onClose={onClose}
      wide
      z={z}
      escEnabled={!capturing && !confirmReset}
    >
      <div
        className="mb-3 flex flex-wrap gap-1"
        role="tablist"
        aria-label={tr("Categories")}
        onKeyDown={(e) => {
          if (capturing || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
          e.preventDefault();
          const i = SETTINGS_TABS.indexOf(tab);
          const n = SETTINGS_TABS.length;
          const next = SETTINGS_TABS[(i + (e.key === "ArrowRight" ? 1 : n - 1)) % n]!;
          setTab(next);
          const el = e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`);
          el?.focus();
        }}
      >
        {SETTINGS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            data-tab={t}
            aria-selected={t === tab}
            tabIndex={t === tab ? 0 : -1}
            onClick={() => {
              setCapturing(null);
              setTab(t);
            }}
            className={`rounded-sm border px-3 py-1 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-[#00FFFF] ${
              t === tab
                ? "border-[#FFB800] bg-[#FFB800]/10 text-[#FFB800]"
                : "border-[#33FF33]/25 text-[#33FF33]/70 hover:border-[#33FF33]/60"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TAB_LABEL[tab]}>
        {tab === "grafik" && <GraphicsTab s={s} update={update} />}
        {tab === "kamera" && <CameraTab s={s} update={update} />}
        {tab === "audio" && <AudioTab s={s} update={update} />}
        {tab === "spiel" && <GameplayTab s={s} update={update} />}
        {tab === "barrierefreiheit" && <AccessibilityTab s={s} update={update} />}
        {tab === "steuerung" && <ControlsTab capturing={capturing} setCapturing={setCapturing} />}
      </div>

      <div className="mt-4 flex justify-between gap-2">
        <CrtButton tone="red" onClick={() => setConfirmReset(true)}>
          {tr("Restore defaults")}
        </CrtButton>
        <CrtButton tone="amber" onClick={onClose}>
          {tr("Done")}
        </CrtButton>
      </div>

      {confirmReset && (
        <ConfirmDialog
          z={z + 10}
          title={tr("Restore defaults?")}
          text={tr("All values in “{tab}” will be reset to their defaults.", {
            tab: TAB_LABEL[tab],
          })}
          confirmLabel={tr("Reset")}
          onCancel={() => setConfirmReset(false)}
          onConfirm={resetTab}
        />
      )}
    </MenuPanel>
  );
}

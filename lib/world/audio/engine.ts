/**
 * AudioSystem — the lab's procedural sound engine.
 * ================================================
 *
 * Buses:  sfx ─┐
 *         ui ──┤
 *         voice┼─► master ─► compressor ─► destination
 *         ambience        ▲
 *         music┘          │
 *   sfx/voice/ambience ─► reverb send (room-sized, see reverb.ts)
 *
 * Positional device ambience: `setListenerAt(x, z, floor, yaw)` +
 * `setEmitters([...])` keep the nearest six device voices (hum / fan /
 * crystal chime / quantum warble; brownout = pitch sag + crackle).
 * Adaptive score: `setMusicState` (focus / danger / floor darkness /
 * scenes) + `musicSting()`.
 *
 * Page lifecycle (round 7): the context's running / suspended state is a
 * *reconciliation* — `resume()`, `setHidden()`, gestures, `pagehide` /
 * `pageshow`, `focus`, `statechange` and a 1 s watchdog all only record
 * what is wanted (unlocked by a gesture and visible → running, else
 * suspended) and queue one serialized `settle()` pass that drives the
 * context there, re-checking after every await. A late `suspend()` promise
 * can no longer win against an earlier return to the tab (the old bug: the
 * tab came back before `suspend()` settled, `resume()` saw "running" and
 * skipped, then the suspend landed → silence until reload). Hung promises
 * time out; Safari's "interrupted" state is resumed like "suspended".
 * `bindPageLifecycle()` wires all of it to window/document in one call.
 *
 * No audio files: every sound is synthesised (see sfx.ts, voice.ts,
 * ambience.ts, music.ts). The AudioContext is created lazily in
 * `resume()`, which must be called from a user gesture (click/keydown).
 * Without Web Audio (SSR, jsdom, old browsers) every method is a silent
 * no-op. Requested ambience / music state is remembered and applied as
 * soon as the context starts.
 */
import {
  AmbienceBeds,
  DeviceHums,
  ambienceFor,
  type DeviceEmitter,
  type DeviceHumSource,
} from "@/lib/world/audio/ambience";
import {
  MusicSystem,
  type MusicState,
  type NowPlaying,
  type StingKind,
} from "@/lib/world/audio/music";
import { playDrum, type DrumPiece } from "@/lib/world/audio/songs/drums";
import { playNote } from "@/lib/world/audio/songs/instruments";
import type { InstrumentId, Kit, Part, SongDef } from "@/lib/world/audio/songs/types";
import { RoomReverb, reverbFor, type ReverbSpec } from "@/lib/world/audio/reverb";
import {
  FOOTSTEP_GAIN,
  SFX,
  SFX_BUS,
  type BusName,
  type SfxName,
  type Surface,
} from "@/lib/world/audio/sfx";
import { clamp, spatialize, type SynthTarget } from "@/lib/world/audio/synth";
import {
  footwearGain,
  renderMotion,
  renderStep,
  type Footwear,
  type MotionLayerKind,
  type StepKind,
} from "@/lib/world/audio/footfall";
import type { MusicPrefs, MusicStatus } from "@/lib/world/audio/music";
import {
  renderSpeech,
  speakerPitch,
  speechPlan,
  voiceFor,
  type VoiceId,
} from "@/lib/world/audio/voice";
import { VoiceCounter, WebAudioTarget, createNoiseBuffer } from "@/lib/world/audio/webaudio";

export type BusVolumes = Partial<Record<BusName, number>>;

export const DEFAULT_VOLUMES: Record<BusName, number> = {
  master: 0.8,
  music: 0.45,
  sfx: 0.8,
  ambience: 0.6,
  ui: 0.5,
  voice: 0.7,
};

export interface PlayOptions {
  /** World position (voxel x/z) for attenuation + pan. */
  pos?: readonly [number, number];
  /** Listener position; defaults to the last `setListener()`. */
  listener?: readonly [number, number];
  /** Frequency multiplier (1 = unchanged). */
  pitch?: number;
  /** Gain multiplier. */
  gain?: number;
  /** Footstep surface. */
  surface?: Surface;
  /** Seconds from now. */
  delay?: number;
}

type AudioCtor = new () => AudioContext;

/** One footfall for `AudioSystem.step()`. */
export interface StepOptions {
  surface: Surface;
  footwear: Footwear;
  foot?: 0 | 1;
  pace?: number;
  kind?: StepKind;
  interval?: number;
  /** Motion layers of worn pieces (keys, tools, …). */
  layers?: readonly MotionLayerKind[];
  /** Step counter for layers that sound every n-th step. */
  index?: number;
  pos?: readonly [number, number];
  gain?: number;
}

/** Longest we wait for a `resume()` / `suspend()` promise before re-checking. */
const LIFECYCLE_TIMEOUT_MS = 1500;
/** Watchdog period: re-resume a context that stopped while it should run. */
const WATCHDOG_MS = 1000;

/** Resolve true when `p` settles in time, false on rejection or timeout. */
function settled(p: Promise<unknown> | undefined, ms = LIFECYCLE_TIMEOUT_MS): Promise<boolean> {
  if (!p || typeof (p as { then?: unknown }).then !== "function") return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    p.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}

function findAudioContext(): AudioCtor | null {
  const g = globalThis as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

interface Graph {
  ctx: AudioContext;
  buses: Record<BusName, GainNode>;
  noise: AudioBuffer;
  counter: VoiceCounter;
  beds: AmbienceBeds;
  hums: DeviceHums;
  music: MusicSystem;
  reverb: RoomReverb;
  sends: GainNode[];
}

/** Reverb send level per bus (music has its own echo, UI stays dry). */
const REVERB_SENDS: Partial<Record<BusName, number>> = { sfx: 1, voice: 0.55, ambience: 0.3 };

export interface AudioSystemOptions {
  volumes?: BusVolumes;
  /** Override for tests; return null to force silent mode. */
  createContext?: () => AudioContext | null;
  /** Max simultaneous one-shot sources. */
  voiceLimit?: number;
}

export class AudioSystem {
  private graph: Graph | null = null;
  private readonly volumes: Record<BusName, number>;
  private muted = false;
  private disposed = false;
  private listener: [number, number] = [0, 0];
  private yaw = Math.PI / 4;
  private ambience: { theme: string; powered: boolean } | null = null;
  private musicState: MusicState | null = null;
  private reverbSpec: ReverbSpec = reverbFor(null);
  private emitters: readonly DeviceEmitter[] = [];
  private listenerFloor: number | null = null;
  private hidden = false;
  /** Pending panner clean-ups, cancelled on dispose. */
  private readonly pannerTimers = new Set<ReturnType<typeof setTimeout>>();
  /** `resume()` was called at least once (from a user gesture). */
  private unlocked = false;
  private speechEnds = 0;
  private speechGain: GainNode | null = null;
  private readonly createContext: () => AudioContext | null;
  private readonly voiceLimit: number;
  /** Serialized lifecycle work (resume / suspend never overlap). */
  private opChain: Promise<void> = Promise.resolve();
  private settling = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  /** Reads `document.hidden` (set by `bindPageLifecycle`) for the watchdog. */
  private hiddenProbe: (() => boolean) | null = null;
  private musicPrefs: MusicPrefs = { switchMode: "now", length: "standard" };
  /** How often settle() had to call ctx.resume() (tests, dev handle). */
  resumeCalls = 0;

  constructor(opts: AudioSystemOptions = {}) {
    this.volumes = { ...DEFAULT_VOLUMES, ...opts.volumes };
    this.voiceLimit = opts.voiceLimit ?? 64;
    this.createContext =
      opts.createContext ??
      (() => {
        const Ctor = findAudioContext();
        if (!Ctor) return null;
        try {
          return new Ctor();
        } catch {
          return null;
        }
      });
  }

  /** Web Audio exists in this environment (does not mean it is running). */
  get available(): boolean {
    return findAudioContext() !== null;
  }

  /** The context exists and is running. */
  get running(): boolean {
    return this.graph?.ctx.state === "running";
  }

  /** Current audio time (0 when silent). */
  get time(): number {
    return this.graph?.ctx.currentTime ?? 0;
  }

  /**
   * Create / resume the context. Call from a user gesture (first click or
   * key press). Safe to call repeatedly. While the tab is hidden it only
   * records the unlock; the context starts once the tab is visible.
   */
  resume(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.unlocked = true;
    this.startWatchdog();
    if (!this.hidden) {
      // Inside the gesture's own call stack: create + kick the context
      // synchronously (Safari / iOS only honour a resume made right here).
      if (!this.graph) this.graph = this.build();
      const g = this.graph;
      if (g && g.ctx.state !== "running" && g.ctx.state !== "closed") {
        try {
          void g.ctx.resume().catch(() => undefined);
        } catch {
          /* settle() retries */
        }
      }
    }
    return this.reconcile();
  }

  /** The player has interacted at least once (context may be created). */
  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /**
   * Tab visibility: fade out and suspend while hidden; on return resume
   * only if the player already unlocked audio with a gesture. Any order of
   * calls ends in the state that matches the last one.
   */
  setHidden(hidden: boolean): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.hidden !== hidden) {
      this.hidden = hidden;
      this.applyVolumes();
    }
    return this.reconcile();
  }

  get isHidden(): boolean {
    return this.hidden;
  }

  /** Pause output (e.g. tab hidden). `resume()` continues. */
  suspend(): Promise<void> {
    return this.setHidden(true);
  }

  /** Queue one settle pass behind whatever lifecycle work is in flight. */
  private reconcile(): Promise<void> {
    const run = this.opChain.then(() => this.settle());
    this.opChain = run.catch(() => undefined);
    return run;
  }

  /** Drive the context to the wanted state, re-checking after every await. */
  private async settle(): Promise<void> {
    this.settling++;
    try {
      for (let i = 0; i < 4; i++) {
        if (this.disposed) return;
        const want = this.unlocked && !this.hidden;
        if (want && !this.graph) this.graph = this.build();
        const g = this.graph;
        if (!g) return;
        const state = g.ctx.state as string;
        if (state === "closed") return;
        const running = state === "running";
        if (want === running) {
          if (running) this.onRunning(g);
          return;
        }
        let ok: boolean;
        if (want) {
          this.resumeCalls++;
          ok = await settled(safeCall(() => g.ctx.resume()));
        } else {
          ok = await settled(safeCall(() => g.ctx.suspend()));
        }
        // A rejected / hung call and no change: leave it to the watchdog / next gesture.
        if (!ok && (g.ctx.state as string) === state) return;
      }
    } finally {
      this.settling--;
    }
  }

  /** The context runs (again): re-apply everything that needs a running context. */
  private onRunning(g: Graph): void {
    if (this.ambience) g.beds.set(ambienceFor(this.ambience.theme, this.ambience.powered));
    if (this.musicState) {
      g.music.setState(this.musicState);
      if (!g.music.playing) g.music.start();
    }
    g.music.setPrefs(this.musicPrefs);
    this.hookSongs();
    g.reverb.set(this.reverbSpec);
    this.updateEmitters();
    this.applyVolumes();
  }

  private startWatchdog(): void {
    if (this.watchdog || this.disposed) return;
    this.watchdog = setInterval(() => this.watch(), WATCHDOG_MS);
  }

  /** Periodic check: visibility we may have missed, a context that stopped. */
  private watch(): void {
    if (this.disposed || this.settling > 0) return;
    const probe = this.hiddenProbe;
    if (probe) {
      let h = this.hidden;
      try {
        h = probe();
      } catch {
        /* keep */
      }
      if (h !== this.hidden) {
        void this.setHidden(h);
        return;
      }
    }
    const g = this.graph;
    if (!g || !this.unlocked || this.hidden) return;
    const state = g.ctx.state as string;
    if (state !== "running" && state !== "closed") void this.reconcile();
  }

  /**
   * Wire gestures and the page lifecycle (visibility, bfcache, focus,
   * freeze / resume) to this system. Returns the unbind function.
   */
  bindPageLifecycle(
    opts: {
      win?: Window;
      doc?: Document;
      /** Called after every gesture (e.g. to start title music). */
      onGesture?: () => void;
    } = {},
  ): () => void {
    const win = opts.win ?? (typeof window !== "undefined" ? window : undefined);
    const doc = opts.doc ?? (typeof document !== "undefined" ? document : undefined);
    if (!win || !doc) return () => undefined;
    const gesture = () => {
      void this.resume();
      opts.onGesture?.();
    };
    const sync = () => void this.setHidden(doc.hidden);
    const hide = () => void this.setHidden(true);
    this.hiddenProbe = () => doc.hidden;
    const winEvents: [string, () => void][] = [
      ["pointerdown", gesture],
      ["keydown", gesture],
      ["touchend", gesture],
      ["pagehide", hide],
      ["pageshow", sync],
      ["focus", sync],
    ];
    const docEvents: [string, () => void][] = [
      ["visibilitychange", sync],
      ["freeze", hide],
      ["resume", sync],
    ];
    for (const [e, f] of winEvents) win.addEventListener(e, f);
    for (const [e, f] of docEvents) doc.addEventListener(e, f);
    if (doc.hidden) sync();
    return () => {
      for (const [e, f] of winEvents) win.removeEventListener(e, f);
      for (const [e, f] of docEvents) doc.removeEventListener(e, f);
      if (this.hiddenProbe) this.hiddenProbe = null;
    };
  }

  setVolumes(v: BusVolumes): void {
    for (const k of Object.keys(v) as BusName[]) {
      const val = v[k];
      if (typeof val === "number" && Number.isFinite(val)) this.volumes[k] = clamp(val, 0, 1);
    }
    this.applyVolumes();
  }

  getVolumes(): Record<BusName, number> {
    return { ...this.volumes };
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  /** Listener position (player x/z) and camera yaw for panning. */
  setListener(pos: readonly [number, number], yaw?: number): void {
    this.listener = [pos[0], pos[1]];
    if (yaw !== undefined) this.yaw = yaw;
  }

  /** Listener position + floor (emitters on other floors fall silent). */
  setListenerAt(x: number, z: number, floor: number, yaw?: number): void {
    this.setListener([x, z], yaw);
    const changed = this.listenerFloor !== floor;
    this.listenerFloor = floor;
    if (changed) this.updateEmitters();
  }

  /**
   * Positional device ambience. Pass every device (with `floor`); the
   * nearest six audible ones on the listener's floor sound. Call a few
   * times per second, not every frame.
   */
  setEmitters(emitters: readonly DeviceEmitter[]): void {
    this.emitters = emitters;
    this.updateEmitters();
  }

  /** Emitters that can currently be heard (listener floor filter applied). */
  audibleEmitters(): DeviceEmitter[] {
    const f = this.listenerFloor;
    return this.emitters.filter((e) => f === null || e.floor === undefined || e.floor === f);
  }

  /** Ids of the device voices currently sounding (empty when silent). */
  activeEmitters(): string[] {
    return this.graph?.hums.active() ?? [];
  }

  /** Room acoustics: pass the room (w, d, theme) or a ready spec. */
  setReverb(spec: ReverbSpec): void {
    this.reverbSpec = { ...spec };
    const g = this.graph;
    if (g && g.ctx.state === "running") g.reverb.set(this.reverbSpec);
  }

  setRoomAcoustics(room: { w: number; d: number; theme?: string } | null | undefined): void {
    this.setReverb(reverbFor(room));
  }

  get reverb(): ReverbSpec {
    return { ...this.reverbSpec };
  }

  /** A footstep on `surface` with per-surface loudness and slight jitter. */
  footstep(surface: Surface, opts: Omit<PlayOptions, "surface"> = {}): void {
    const jitter = 0.95 + Math.random() * 0.1;
    this.play("footstep", {
      ...opts,
      surface,
      pitch: (opts.pitch ?? 1) * jitter,
      gain: (opts.gain ?? 1) * FOOTSTEP_GAIN[surface],
    });
  }

  /**
   * A designed footfall: footwear × surface, foot, pace, kind (step / scuff /
   * stop / land) plus the motion layers of worn pieces — one panner, a few
   * nodes. Gain follows the surface and the footwear set (sfx bus).
   */
  step(o: StepOptions): void {
    const gain = (o.gain ?? 1) * FOOTSTEP_GAIN[o.surface] * footwearGain(o.footwear);
    const params = {
      surface: o.surface,
      footwear: o.footwear,
      foot: o.foot ?? 0,
      pace: o.pace ?? 1,
      kind: o.kind ?? "step",
      interval: o.interval ?? 0.3,
    } as const;
    this.emit(
      (t) => {
        renderStep(t, params);
        if (o.layers?.length)
          renderMotion(t, o.layers, {
            foot: params.foot,
            pace: params.pace,
            kind: params.kind,
            index: o.index ?? 0,
          });
      },
      "sfx",
      { gain, ...(o.pos ? { pos: o.pos } : {}), panBias: params.foot === 0 ? -0.06 : 0.06 },
    );
  }

  /** Short musical cue in the current key (discovery, insight, solved, danger). */
  musicSting(kind: StingKind): void {
    const g = this.graph;
    if (!g || g.ctx.state !== "running") return;
    g.music.sting(kind);
  }

  /** Play a one-shot effect. */
  play(name: SfxName, opts: PlayOptions = {}): void {
    const recipe = SFX[name];
    if (!recipe) return;
    const params = opts.surface ? { surface: opts.surface } : {};
    this.emit((t) => recipe(t, params), SFX_BUS[name] ?? "sfx", opts);
  }

  /** Render a recipe into a one-shot target on `busName` (spatialised, capped). */
  private emit(
    render: (t: SynthTarget) => void,
    busName: BusName,
    opts: PlayOptions & { panBias?: number },
  ): void {
    const g = this.graph;
    if (!g || g.ctx.state !== "running" || g.counter.full) return;
    let gain = opts.gain ?? 1;
    let pan = opts.panBias ?? 0;
    if (opts.pos) {
      const s = spatialize(opts.pos, opts.listener ?? this.listener, this.yaw);
      gain *= s.gain;
      pan = clamp(pan + s.pan, -1, 1);
      if (gain < 0.01) return;
    }
    const bus = g.buses[busName];
    let out: AudioNode = bus;
    let panner: StereoPannerNode | null = null;
    if (pan !== 0 && typeof g.ctx.createStereoPanner === "function") {
      panner = g.ctx.createStereoPanner();
      panner.pan.value = pan;
      panner.connect(bus);
      out = panner;
    }
    const t0 = g.ctx.currentTime + 0.005 + Math.max(0, opts.delay ?? 0);
    const target = new WebAudioTarget(g.ctx, out, g.noise, t0, opts.pitch ?? 1, gain, g.counter);
    render(target);
    if (panner) {
      const p = panner;
      const t = setTimeout(() => {
        this.pannerTimers.delete(t);
        p.disconnect();
      }, 6000);
      this.pannerTimers.add(t);
    }
  }

  /**
   * Typing-voice bleeps for a dialogue line. Returns the spoken duration
   * in seconds (also when silent, so subtitles can use it for timing).
   */
  speak(text: string, voice: VoiceId | string = "mcp"): number {
    const id = voiceFor(voice);
    const plan = speechPlan(text, id);
    const g = this.graph;
    if (!g || g.ctx.state !== "running") return plan.duration;
    this.stopSpeech();
    const gate = g.ctx.createGain();
    gate.connect(g.buses.voice);
    this.speechGain = gate;
    const t0 = g.ctx.currentTime + 0.02;
    const pitch = speakerPitch(voice);
    renderSpeech(new WebAudioTarget(g.ctx, gate, g.noise, t0, pitch), plan.bleeps, id);
    this.speechEnds = t0 + plan.duration;
    return plan.duration;
  }

  /** True while a `speak()` line is still bleeping. */
  get speaking(): boolean {
    return !!this.graph && this.graph.ctx.currentTime < this.speechEnds;
  }

  stopSpeech(): void {
    const g = this.graph;
    const gate = this.speechGain;
    if (!g || !gate) return;
    const now = g.ctx.currentTime;
    gate.gain.setValueAtTime(gate.gain.value, now);
    gate.gain.linearRampToValueAtTime(0, now + 0.05);
    setTimeout(() => gate.disconnect(), 400);
    this.speechGain = null;
    this.speechEnds = 0;
  }

  /** Crossfade the room bed. `theme` is a RoomTheme (unknown → generic). */
  setAmbience(theme: string, powered: boolean): void {
    this.ambience = { theme, powered };
    const g = this.graph;
    if (g && g.ctx.state === "running") g.beds.set(ambienceFor(theme, powered));
  }

  /** Spatial hums of nearby powered devices (call ~4×/s, not every frame). */
  setDeviceHums(devices: readonly DeviceHumSource[], listener?: readonly [number, number]): void {
    const g = this.graph;
    if (!g || g.ctx.state !== "running") return;
    g.hums.update(devices, listener ?? this.listener, this.yaw);
  }

  private updateEmitters(): void {
    const g = this.graph;
    if (!g || g.ctx.state !== "running") return;
    g.hums.update(this.audibleEmitters(), this.listener, this.yaw);
  }

  setMusicState(state: MusicState): void {
    this.musicState = { ...state };
    const g = this.graph;
    if (!g || g.ctx.state !== "running") return;
    g.music.setState(this.musicState);
    if (!g.music.playing) g.music.start();
  }

  // ── Songs, jukebox, studio ─────────────────────────────────────

  /** The song playing now (null in scenes, generative mode or silence). */
  nowPlaying(): NowPlaying | null {
    return this.graph?.music.nowPlaying() ?? null;
  }

  private readonly songListeners = new Set<(song: SongDef, jukebox: boolean) => void>();
  private songUnsub: (() => void) | null = null;

  /** Subscribe to song changes (now-playing toast, studio). */
  onSong(cb: (song: SongDef, jukebox: boolean) => void): () => void {
    this.songListeners.add(cb);
    this.hookSongs();
    return () => this.songListeners.delete(cb);
  }

  private hookSongs(): void {
    const g = this.graph;
    if (!g || this.songUnsub) return;
    this.songUnsub = g.music.onSong((song, jb) => {
      for (const cb of this.songListeners) cb(song, jb);
    });
  }

  /** Style-switch mode + song length (settings); applied now and on every restart. */
  setMusicPrefs(prefs: Partial<MusicPrefs>): void {
    this.musicPrefs = { ...this.musicPrefs, ...prefs };
    this.graph?.music.setPrefs(this.musicPrefs);
  }

  /** Style in effect, a waiting style change and the current song (settings indicator). */
  musicStatus(): MusicStatus | null {
    const g = this.graph;
    if (!g) return null;
    return g.music.status();
  }

  /**
   * Title screen with `afterSong`: play `id` after the current song (null =
   * hand back to the generative / scene score then).
   */
  queueSong(id: string | null, loop = false): boolean {
    const g = this.graph;
    if (!g || g.ctx.state !== "running") return false;
    const ok = g.music.queueSong(id, loop);
    if (ok && id !== null && !g.music.playing) g.music.start();
    return ok;
  }

  /** Studio jukebox: play a song now (crossfade). */
  playSong(id: string, loop = false, fade = 1.2): boolean {
    const g = this.graph;
    if (!g || g.ctx.state !== "running") return false;
    const ok = g.music.playSong(id, loop, fade);
    // Outside the game (title screen) nobody has set a music state yet.
    if (ok && !g.music.playing) g.music.start();
    return ok;
  }

  /** Give song choice back to the game (`fadeNow`: fade the current song out right away). */
  releaseJukebox(fadeNow?: number): void {
    this.graph?.music.releaseJukebox(fadeNow);
  }

  setSongLoop(loop: boolean): void {
    this.graph?.music.setLoop(loop);
  }

  skipSong(): void {
    this.graph?.music.skip();
  }

  setPartLevel(part: Part, v: number): void {
    this.graph?.music.setPartLevel(part, v);
  }

  partLevels(): Record<Part, number> | null {
    return this.graph?.music.partLevels() ?? null;
  }

  setLeadInstrument(inst: InstrumentId | undefined): void {
    this.graph?.music.setLeadInstrument(inst);
  }

  /** Play one instrument note on the music bus (studio keyboard / sequencer). */
  studioNote(
    inst: InstrumentId,
    midi: number,
    opts: { delay?: number; dur?: number; vel?: number; pan?: number } = {},
  ): void {
    const g = this.graph;
    if (!g || g.ctx.state !== "running" || g.counter.full) return;
    const t0 = g.ctx.currentTime + 0.01 + Math.max(0, opts.delay ?? 0);
    const t = new WebAudioTarget(g.ctx, g.buses.music, g.noise, t0, 1, 1, g.counter);
    playNote(t, inst, {
      midi,
      at: 0,
      dur: opts.dur ?? 0.4,
      vel: opts.vel ?? 0.9,
      ...(opts.pan !== undefined ? { pan: opts.pan } : {}),
    });
  }

  /** Play one drum hit on the music bus (studio pads / sequencer). */
  studioDrum(kit: Kit, piece: DrumPiece, opts: { delay?: number; vel?: number } = {}): void {
    const g = this.graph;
    if (!g || g.ctx.state !== "running" || g.counter.full) return;
    const t0 = g.ctx.currentTime + 0.01 + Math.max(0, opts.delay ?? 0);
    playDrum(
      new WebAudioTarget(g.ctx, g.buses.music, g.noise, t0, 1, 1, g.counter),
      kit,
      piece,
      0,
      opts.vel ?? 1,
    );
  }

  stopMusic(fade = 2): void {
    this.musicState = null;
    this.graph?.music.stop(fade);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.hiddenProbe = null;
    for (const t of this.pannerTimers) clearTimeout(t);
    this.pannerTimers.clear();
    const g = this.graph;
    this.graph = null;
    if (!g) return;
    this.speechGain?.disconnect();
    this.speechGain = null;
    this.songUnsub?.();
    this.songUnsub = null;
    this.songListeners.clear();
    g.music.dispose();
    g.beds.dispose();
    g.hums.dispose();
    g.reverb.dispose();
    g.sends.forEach((n) => n.disconnect());
    Object.values(g.buses).forEach((b) => b.disconnect());
    void g.ctx.close().catch(() => undefined);
  }

  // ── internals ──

  private build(): Graph | null {
    let ctx: AudioContext | null;
    try {
      ctx = this.createContext();
    } catch {
      return null;
    }
    if (!ctx) return null;
    try {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      const master = ctx.createGain();
      master.connect(comp);
      const bus = (): GainNode => {
        const n = ctx.createGain();
        n.connect(master);
        return n;
      };
      const buses: Record<BusName, GainNode> = {
        master,
        music: bus(),
        sfx: bus(),
        ambience: bus(),
        ui: bus(),
        voice: bus(),
      };
      const noise = createNoiseBuffer(ctx);
      const reverb = new RoomReverb(ctx, master);
      const sends: GainNode[] = [];
      for (const [bus, level] of Object.entries(REVERB_SENDS) as [BusName, number][]) {
        const send = ctx.createGain();
        send.gain.value = level;
        buses[bus].connect(send).connect(reverb.input);
        sends.push(send);
      }
      const graph: Graph = {
        ctx,
        buses,
        noise,
        counter: new VoiceCounter(this.voiceLimit),
        beds: new AmbienceBeds(ctx, buses.ambience, noise),
        hums: new DeviceHums(ctx, buses.ambience, noise),
        music: new MusicSystem(ctx, buses.music),
        reverb,
        sends,
      };
      this.graph = graph;
      graph.music.setPrefs(this.musicPrefs);
      // The browser changed the state by itself (Safari "interrupted", an OS
      // audio session, a device change): reconcile once it has settled.
      const onState = () => {
        if (this.disposed || this.graph !== graph) return;
        const st = ctx.state as string;
        const want = this.unlocked && !this.hidden;
        if ((want && st !== "running") || (!want && st === "running"))
          setTimeout(() => void this.reconcile(), 50);
      };
      if (typeof ctx.addEventListener === "function") ctx.addEventListener("statechange", onState);
      this.applyVolumes();
      return graph;
    } catch {
      void ctx.close().catch(() => undefined);
      return null;
    }
  }

  private applyVolumes(): void {
    const g = this.graph;
    if (!g) return;
    const now = g.ctx.currentTime;
    for (const k of Object.keys(g.buses) as BusName[]) {
      const v = k === "master" && (this.muted || this.hidden) ? 0 : this.volumes[k];
      g.buses[k].gain.setTargetAtTime(v, now, 0.05);
    }
  }
}

/** Call a context method that may throw synchronously (old Safari) as a promise. */
function safeCall(f: () => Promise<void>): Promise<void> {
  try {
    return f();
  } catch (e) {
    return Promise.reject(e);
  }
}

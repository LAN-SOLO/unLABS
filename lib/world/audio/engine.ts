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
 * scenes) + `musicSting()`. `setHidden()` mutes and suspends while the
 * tab is hidden and only resumes a context the player already unlocked.
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
import { MusicSystem, type MusicState, type StingKind } from "@/lib/world/audio/music";
import { RoomReverb, reverbFor, type ReverbSpec } from "@/lib/world/audio/reverb";
import {
  FOOTSTEP_GAIN,
  SFX,
  SFX_BUS,
  type BusName,
  type SfxName,
  type Surface,
} from "@/lib/world/audio/sfx";
import { clamp, spatialize } from "@/lib/world/audio/synth";
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
   * key press). Safe to call repeatedly.
   */
  async resume(): Promise<void> {
    if (this.disposed) return;
    this.unlocked = true;
    if (this.hidden) return;
    if (!this.graph) this.graph = this.build();
    const g = this.graph;
    if (!g) return;
    // "suspended", or Safari's "interrupted" after a phone call / lock.
    if (g.ctx.state !== "running" && g.ctx.state !== "closed") {
      try {
        await g.ctx.resume();
      } catch {
        return;
      }
    }
    if (this.ambience) g.beds.set(ambienceFor(this.ambience.theme, this.ambience.powered));
    if (this.musicState) {
      g.music.setState(this.musicState);
      if (!g.music.playing) g.music.start();
    }
    g.reverb.set(this.reverbSpec);
    this.applyVolumes();
  }

  /** The player has interacted at least once (context may be created). */
  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /**
   * Tab visibility: fade out and suspend while hidden; on return resume
   * only if the player already unlocked audio with a gesture.
   */
  async setHidden(hidden: boolean): Promise<void> {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    this.applyVolumes();
    if (hidden) {
      await this.suspend();
      return;
    }
    if (this.unlocked) await this.resume();
  }

  /** Pause output (e.g. tab hidden). `resume()` continues. */
  async suspend(): Promise<void> {
    const g = this.graph;
    if (!g || g.ctx.state !== "running") return;
    try {
      await g.ctx.suspend();
    } catch {
      /* ignore */
    }
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

  /** Short musical cue in the current key (discovery, insight, solved, danger). */
  musicSting(kind: StingKind): void {
    const g = this.graph;
    if (!g || g.ctx.state !== "running") return;
    g.music.sting(kind);
  }

  /** Play a one-shot effect. */
  play(name: SfxName, opts: PlayOptions = {}): void {
    const g = this.graph;
    if (!g || g.ctx.state !== "running" || g.counter.full) return;
    const recipe = SFX[name];
    if (!recipe) return;
    let gain = opts.gain ?? 1;
    let pan = 0;
    if (opts.pos) {
      const s = spatialize(opts.pos, opts.listener ?? this.listener, this.yaw);
      gain *= s.gain;
      pan = s.pan;
      if (gain < 0.01) return;
    }
    const bus = g.buses[SFX_BUS[name] ?? "sfx"];
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
    recipe(target, opts.surface ? { surface: opts.surface } : {});
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

  stopMusic(fade = 2): void {
    this.musicState = null;
    this.graph?.music.stop(fade);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const t of this.pannerTimers) clearTimeout(t);
    this.pannerTimers.clear();
    const g = this.graph;
    this.graph = null;
    if (!g) return;
    this.speechGain?.disconnect();
    this.speechGain = null;
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

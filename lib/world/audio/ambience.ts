/**
 * Ambience beds and device hums.
 * ==============================
 *
 * Room themes map to a handful of looping beds (lab hum, server fans,
 * geothermal rumble, cooling drips, anomaly shimmer, forge drone, reactor
 * thrum). Beds are built from a couple of oscillators and filtered noise
 * each and crossfade when the player changes rooms. Nearby powered devices
 * add a quiet spatialised hum (max four at a time) whose timbre depends on
 * the device category (generator throb, server fan whoosh, quantum
 * shimmer, reactor pulse).
 *
 * Accepted themes are `RoomTheme`s plus a few theme names other systems may
 * pass as plain strings: "shaft", "library", "kantine".
 */
import { clamp, spatialize, type FilterKind, type Wave } from "@/lib/world/audio/synth";
import type { RoomTheme } from "@/lib/world/types";

export const AMBIENCE_KINDS = [
  "room_tone",
  "lab_hum",
  "server_fans",
  "geothermal_rumble",
  "cooling_drips",
  "anomaly_shimmer",
  "forge_drone",
  "reactor_thrum",
  "fridge_hum",
  "clock_tick",
  "water_trickle",
  "greenhouse_air",
  "dome_wind",
  "dome_servo",
  "cave_drips",
  "rock_settle",
  "library_tone",
  "coffee_idle",
] as const;
export type AmbienceKind = (typeof AMBIENCE_KINDS)[number];

export type AmbienceLayer =
  | {
      type: "hum";
      wave: Wave;
      freq: number;
      gain: number;
      detune?: number;
      /** Amplitude LFO. */
      lfo?: { rate: number; depth: number };
      filter?: number;
    }
  | {
      type: "noise";
      filter: FilterKind;
      freq: number;
      q?: number;
      gain: number;
      lfo?: { rate: number; depth: number };
    }
  | {
      type: "drip";
      every: readonly [number, number];
      freq: readonly [number, number];
      gain: number;
      /** Seconds until a quieter reflection (caves, shafts). */
      echo?: number;
    }
  | {
      /** Regular clicks (wall clock): alternates between the two pitches. */
      type: "tick";
      period: number;
      freq: readonly [number, number];
      gain: number;
    }
  | {
      /** Sparse one-off events: rock settling, servo moves, steam sighs. */
      type: "burst";
      every: readonly [number, number];
      source: "noise" | Wave;
      filter: FilterKind;
      freq: readonly [number, number];
      /** Frequency glide ratio over the burst. */
      glide?: number;
      dur: readonly [number, number];
      gain: number;
    };

export const AMBIENCE_LAYERS: Record<AmbienceKind, readonly AmbienceLayer[]> = {
  room_tone: [
    { type: "noise", filter: "lowpass", freq: 180, gain: 0.05, lfo: { rate: 0.07, depth: 0.4 } },
  ],
  lab_hum: [
    { type: "hum", wave: "sawtooth", freq: 50, gain: 0.018, filter: 240 },
    { type: "hum", wave: "sine", freq: 100, gain: 0.02, lfo: { rate: 0.2, depth: 0.25 } },
    { type: "noise", filter: "bandpass", freq: 900, q: 0.6, gain: 0.012 },
  ],
  server_fans: [
    {
      type: "noise",
      filter: "bandpass",
      freq: 2400,
      q: 0.5,
      gain: 0.04,
      lfo: { rate: 0.3, depth: 0.15 },
    },
    { type: "noise", filter: "lowpass", freq: 500, gain: 0.03 },
    { type: "hum", wave: "sine", freq: 3150, gain: 0.003, lfo: { rate: 0.13, depth: 0.8 } },
  ],
  geothermal_rumble: [
    { type: "noise", filter: "lowpass", freq: 90, gain: 0.14, lfo: { rate: 0.11, depth: 0.5 } },
    { type: "hum", wave: "sine", freq: 31, gain: 0.08, lfo: { rate: 0.05, depth: 0.4 } },
    {
      type: "noise",
      filter: "bandpass",
      freq: 380,
      q: 1.5,
      gain: 0.015,
      lfo: { rate: 0.4, depth: 0.6 },
    },
  ],
  cooling_drips: [
    { type: "noise", filter: "bandpass", freq: 1600, q: 0.8, gain: 0.018 },
    { type: "drip", every: [0.6, 2.4], freq: [900, 1900], gain: 0.07 },
  ],
  anomaly_shimmer: [
    { type: "hum", wave: "sine", freq: 1318.5, gain: 0.01, lfo: { rate: 0.31, depth: 0.9 } },
    {
      type: "hum",
      wave: "sine",
      freq: 1975.5,
      gain: 0.008,
      detune: 7,
      lfo: { rate: 0.23, depth: 0.9 },
    },
    { type: "hum", wave: "triangle", freq: 82.4, gain: 0.03, lfo: { rate: 0.09, depth: 0.5 } },
    {
      type: "noise",
      filter: "bandpass",
      freq: 5200,
      q: 6,
      gain: 0.01,
      lfo: { rate: 0.5, depth: 0.8 },
    },
  ],
  forge_drone: [
    {
      type: "hum",
      wave: "sawtooth",
      freq: 36.7,
      gain: 0.04,
      filter: 160,
      lfo: { rate: 0.06, depth: 0.3 },
    },
    { type: "hum", wave: "sine", freq: 73.4, gain: 0.05 },
    {
      type: "hum",
      wave: "sine",
      freq: 110,
      gain: 0.02,
      detune: 5,
      lfo: { rate: 0.117, depth: 0.7 },
    },
    {
      type: "noise",
      filter: "bandpass",
      freq: 700,
      q: 3,
      gain: 0.012,
      lfo: { rate: 0.19, depth: 0.7 },
    },
  ],
  reactor_thrum: [
    {
      type: "hum",
      wave: "square",
      freq: 41.2,
      gain: 0.02,
      filter: 140,
      lfo: { rate: 1.6, depth: 0.5 },
    },
    { type: "hum", wave: "sine", freq: 82.4, gain: 0.04, lfo: { rate: 1.6, depth: 0.35 } },
    { type: "noise", filter: "lowpass", freq: 260, gain: 0.05 },
  ],
  // Quarters / kantine: fridge compressor with its slow cycling.
  fridge_hum: [
    { type: "hum", wave: "sine", freq: 60, gain: 0.012, lfo: { rate: 0.021, depth: 0.6 } },
    {
      type: "hum",
      wave: "sawtooth",
      freq: 120,
      gain: 0.005,
      filter: 320,
      lfo: { rate: 0.021, depth: 0.7 },
    },
    { type: "noise", filter: "lowpass", freq: 420, gain: 0.008 },
  ],
  clock_tick: [{ type: "tick", period: 1, freq: [3300, 2700], gain: 0.025 }],
  water_trickle: [
    {
      type: "noise",
      filter: "bandpass",
      freq: 1800,
      q: 1.2,
      gain: 0.02,
      lfo: { rate: 0.7, depth: 0.5 },
    },
    {
      type: "noise",
      filter: "bandpass",
      freq: 3400,
      q: 3,
      gain: 0.008,
      lfo: { rate: 1.3, depth: 0.8 },
    },
    { type: "drip", every: [0.25, 0.9], freq: [1400, 2600], gain: 0.022 },
  ],
  greenhouse_air: [
    { type: "noise", filter: "lowpass", freq: 700, gain: 0.03, lfo: { rate: 0.05, depth: 0.5 } },
    {
      type: "noise",
      filter: "highpass",
      freq: 6000,
      gain: 0.004,
      lfo: { rate: 0.13, depth: 0.7 },
    },
  ],
  dome_wind: [
    {
      type: "noise",
      filter: "bandpass",
      freq: 500,
      q: 2,
      gain: 0.05,
      lfo: { rate: 0.07, depth: 0.7 },
    },
    {
      type: "noise",
      filter: "bandpass",
      freq: 1300,
      q: 6,
      gain: 0.012,
      lfo: { rate: 0.11, depth: 0.9 },
    },
    { type: "hum", wave: "sine", freq: 42, gain: 0.02, lfo: { rate: 0.04, depth: 0.6 } },
  ],
  dome_servo: [
    {
      type: "burst",
      every: [6, 16],
      source: "sawtooth",
      filter: "lowpass",
      freq: [140, 220],
      glide: 1.15,
      dur: [0.8, 2],
      gain: 0.012,
    },
  ],
  cave_drips: [
    { type: "noise", filter: "lowpass", freq: 140, gain: 0.04, lfo: { rate: 0.06, depth: 0.4 } },
    { type: "drip", every: [0.8, 3], freq: [700, 1600], gain: 0.06, echo: 0.26 },
  ],
  rock_settle: [
    {
      type: "burst",
      every: [9, 25],
      source: "noise",
      filter: "lowpass",
      freq: [120, 300],
      glide: 0.6,
      dur: [0.6, 1.6],
      gain: 0.06,
    },
    {
      type: "burst",
      every: [5, 14],
      source: "noise",
      filter: "bandpass",
      freq: [1800, 3600],
      dur: [0.02, 0.05],
      gain: 0.03,
    },
  ],
  library_tone: [
    { type: "noise", filter: "lowpass", freq: 240, gain: 0.025, lfo: { rate: 0.04, depth: 0.3 } },
    { type: "noise", filter: "highpass", freq: 5000, gain: 0.002 },
    { type: "hum", wave: "sine", freq: 50, gain: 0.004 },
  ],
  coffee_idle: [
    { type: "hum", wave: "sine", freq: 100, gain: 0.006, lfo: { rate: 0.09, depth: 0.3 } },
    {
      type: "burst",
      every: [5, 14],
      source: "noise",
      filter: "bandpass",
      freq: [2500, 4000],
      dur: [0.3, 0.9],
      gain: 0.01,
    },
    {
      type: "burst",
      every: [4, 12],
      source: "sine",
      filter: "lowpass",
      freq: [300, 600],
      glide: 1.6,
      dur: [0.04, 0.08],
      gain: 0.015,
    },
  ],
};

const HUM_THEMES = new Set<string>([
  "control",
  "office",
  "corridor",
  "workshop",
  "airlock",
  "elevator",
  "hub",
  "storage",
  "audio",
  "lab",
  "hangar",
  "vault",
  "botdepot",
  "generic",
  "power",
  "factory",
  "server",
  "geothermal",
  "cooling",
]);

/** Rooms where the score switches to its calm "safe room" mode. */
export const SAFE_ROOM_THEMES: ReadonlySet<string> = new Set(["quarters", "kantine"]);

/** Which beds play for a room theme, powered or not. */
export function ambienceFor(
  theme: RoomTheme | string | undefined,
  powered: boolean,
): AmbienceKind[] {
  const out: AmbienceKind[] = [];
  const t: string | undefined = theme;
  // Things that sound regardless of the grid.
  if (t === "geothermal") out.push("geothermal_rumble");
  if (t === "anomaly" || t === "portal" || t === "containment") out.push("anomaly_shimmer");
  if (t === "forge") out.push("forge_drone");
  if (t === "cooling" || t === "cryo") out.push("cooling_drips");
  if (t === "quarters") out.push("clock_tick");
  if (t === "greenhouse") out.push("water_trickle");
  if (t === "observatory") out.push("dome_wind");
  if (t === "shaft") out.push("cave_drips", "rock_settle");
  if (t === "library" || t === "archive") out.push("library_tone");
  if (!powered) {
    out.push("room_tone");
    return [...new Set(out)];
  }
  if (t === "server" || t === "cryo" || t === "factory") out.push("server_fans");
  if (t === "reactor" || t === "containment" || t === "power") out.push("reactor_thrum");
  if (t === "quarters" || t === "kantine") out.push("fridge_hum");
  if (t === "kantine") out.push("coffee_idle");
  if (t === "greenhouse") out.push("greenhouse_air");
  if (t === "observatory") out.push("dome_servo");
  if (t === undefined || HUM_THEMES.has(t)) out.push("lab_hum");
  if (out.length === 0) out.push("room_tone");
  return [...new Set(out)];
}

// ── Web Audio beds ────────────────────────────────────────────────

interface Bed {
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  timers: ReturnType<typeof setTimeout>[];
  alive: boolean;
}

const FADE = 2;

export class AmbienceBeds {
  private readonly beds = new Map<AmbienceKind, Bed>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noiseBuf: AudioBuffer,
  ) {}

  /** Crossfade to exactly these beds. */
  set(kinds: readonly AmbienceKind[]): void {
    const want = new Set(kinds);
    const now = this.ctx.currentTime;
    for (const [kind, bed] of this.beds) {
      if (want.has(kind)) continue;
      this.beds.delete(kind);
      this.stopBed(bed, now);
    }
    for (const kind of want) {
      if (this.beds.has(kind)) continue;
      const bed = this.buildBed(kind);
      bed.gain.gain.setValueAtTime(0.0001, now);
      bed.gain.gain.exponentialRampToValueAtTime(1, now + FADE);
      this.beds.set(kind, bed);
    }
  }

  active(): AmbienceKind[] {
    return [...this.beds.keys()];
  }

  dispose(): void {
    const now = this.ctx.currentTime;
    for (const bed of this.beds.values()) this.stopBed(bed, now, 0.1);
    this.beds.clear();
  }

  private stopBed(bed: Bed, now: number, fade = FADE): void {
    bed.alive = false;
    bed.timers.forEach((t) => clearTimeout(t));
    bed.gain.gain.cancelScheduledValues(now);
    bed.gain.gain.setValueAtTime(Math.max(0.0001, bed.gain.gain.value), now);
    bed.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    for (const s of bed.sources) s.stop(now + fade + 0.05);
    const last = bed.sources[0];
    const cleanup = () => {
      for (const n of bed.nodes) n.disconnect();
      bed.gain.disconnect();
    };
    if (last) last.onended = cleanup;
    else cleanup();
  }

  private buildBed(kind: AmbienceKind): Bed {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.connect(this.out);
    const bed: Bed = { gain, sources: [], nodes: [], timers: [], alive: true };
    for (const layer of AMBIENCE_LAYERS[kind]) {
      if (layer.type === "drip") {
        this.scheduleDrip(bed, layer);
        continue;
      }
      if (layer.type === "tick") {
        this.scheduleTicks(bed, layer);
        continue;
      }
      if (layer.type === "burst") {
        this.scheduleBursts(bed, layer);
        continue;
      }
      const lg = ctx.createGain();
      lg.gain.value = layer.gain;
      let src: AudioScheduledSourceNode;
      let head: AudioNode;
      if (layer.type === "hum") {
        const osc = ctx.createOscillator();
        osc.type = layer.wave;
        osc.frequency.value = layer.freq;
        if (layer.detune) osc.detune.value = layer.detune;
        src = osc;
        head = osc;
        if (layer.filter) {
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.value = layer.filter;
          head.connect(f);
          head = f;
          bed.nodes.push(f);
        }
      } else {
        const n = ctx.createBufferSource();
        n.buffer = this.noiseBuf;
        n.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = layer.filter;
        f.frequency.value = layer.freq;
        f.Q.value = layer.q ?? 0.7;
        n.connect(f);
        src = n;
        head = f;
        bed.nodes.push(f);
      }
      head.connect(lg).connect(gain);
      bed.nodes.push(src, lg);
      if (layer.lfo) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = layer.lfo.rate;
        const depth = ctx.createGain();
        depth.gain.value = layer.gain * clamp(layer.lfo.depth, 0, 1);
        lfo.connect(depth).connect(lg.gain);
        lfo.start();
        bed.sources.push(lfo);
        bed.nodes.push(lfo, depth);
      }
      src.start();
      bed.sources.push(src);
    }
    return bed;
  }

  /** Keep a bed's timer list short (fired timers are harmless to clear). */
  private addTimer(bed: Bed, fn: () => void, seconds: number): void {
    bed.timers.push(setTimeout(fn, seconds * 1000));
    if (bed.timers.length > 8) bed.timers.splice(0, bed.timers.length - 8);
  }

  /** One short enveloped voice into the bed (self-disconnecting). */
  private blip(
    bed: Bed,
    t: number,
    source: "noise" | Wave,
    freq: number,
    freqEnd: number | undefined,
    dur: number,
    gain: number,
    filter?: { type: FilterKind; freq: number; q?: number },
  ): void {
    const ctx = this.ctx;
    let src: AudioScheduledSourceNode;
    const chain: AudioNode[] = [];
    let head: AudioNode;
    if (source === "noise") {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      n.loop = true;
      src = n;
      head = n;
    } else {
      const osc = ctx.createOscillator();
      osc.type = source;
      osc.frequency.setValueAtTime(freq, t);
      if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      src = osc;
      head = osc;
    }
    chain.push(src);
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.setValueAtTime(filter.freq, t);
      if (source === "noise" && freqEnd !== undefined) {
        f.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), t + dur);
      }
      f.Q.value = filter.q ?? 0.8;
      head.connect(f);
      head = f;
      chain.push(f);
    }
    const g = ctx.createGain();
    const attack = Math.min(0.2, dur * 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.max(0.002, attack));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    head.connect(g).connect(bed.gain);
    chain.push(g);
    src.start(t);
    src.stop(t + dur + 0.03);
    src.onended = () => chain.forEach((n) => n.disconnect());
  }

  private scheduleDrip(bed: Bed, layer: Extract<AmbienceLayer, { type: "drip" }>): void {
    const next = () => {
      if (!bed.alive) return;
      const t = this.ctx.currentTime + 0.02;
      const f0 = layer.freq[0] + Math.random() * (layer.freq[1] - layer.freq[0]);
      this.blip(bed, t, "sine", f0, f0 * 0.55, 0.12, layer.gain);
      if (layer.echo)
        this.blip(bed, t + layer.echo, "sine", f0 * 0.98, f0 * 0.5, 0.12, layer.gain * 0.35);
      const wait = layer.every[0] + Math.random() * (layer.every[1] - layer.every[0]);
      this.addTimer(bed, next, wait);
    };
    this.addTimer(bed, next, 0.3);
  }

  /** Clock ticks, scheduled in sample-accurate batches of four seconds. */
  private scheduleTicks(bed: Bed, layer: Extract<AmbienceLayer, { type: "tick" }>): void {
    const BATCH = 4;
    let at = this.ctx.currentTime + 0.1;
    let n = 0;
    const next = () => {
      if (!bed.alive) return;
      const now = this.ctx.currentTime;
      if (at < now) at = now + 0.05;
      const until = now + BATCH + 0.5;
      while (at < until) {
        const f = layer.freq[n++ % 2]!;
        this.blip(bed, at, "noise", f, undefined, 0.02, layer.gain, {
          type: "bandpass",
          freq: f,
          q: 6,
        });
        at += layer.period;
      }
      this.addTimer(bed, next, BATCH);
    };
    next();
  }

  private scheduleBursts(bed: Bed, layer: Extract<AmbienceLayer, { type: "burst" }>): void {
    const pick = (r: readonly [number, number]): number => r[0] + Math.random() * (r[1] - r[0]);
    const next = () => {
      if (!bed.alive) return;
      const t = this.ctx.currentTime + 0.02;
      const f = pick(layer.freq);
      const end = layer.glide ? f * layer.glide : undefined;
      this.blip(bed, t, layer.source, f, end, pick(layer.dur), layer.gain, {
        type: layer.filter,
        freq: layer.source === "noise" ? f : Math.max(f * 5, 400),
        q: layer.filter === "bandpass" ? 2 : 0.8,
      });
      this.addTimer(bed, next, pick(layer.every));
    };
    this.addTimer(bed, next, pick(layer.every) * 0.5);
  }
}

// ── Device hums (positional device ambience) ─────────────────────

export const HUM_CATEGORIES = [
  "generator",
  "server",
  "quantum",
  "reactor",
  "machine",
  "crystal",
  "fan",
] as const;
export type HumCategory = (typeof HUM_CATEGORIES)[number];

export interface DeviceHumSource {
  id: string;
  x: number;
  z: number;
  powered: boolean;
  /** Timbre family; inferred from the device id prefix when omitted. */
  category?: HumCategory;
  /** How hard the device works, 0..1 (louder, faster throb, brighter). Default 0.5. */
  load?: number;
  /**
   * Built and switched on but starved (brownout / overheating): still
   * audible although not powered — the pitch sags and it crackles.
   */
  brownout?: boolean;
  /** Floor of the device; `AudioSystem.setEmitters` drops other floors. */
  floor?: number;
}

/** Alias used by the emitter API (`AudioSystem.setEmitters`). */
export type DeviceEmitter = DeviceHumSource;

const PREFIX_CATEGORY: Readonly<Record<string, HumCategory>> = {
  BAT: "generator",
  PWR: "generator",
  PWD: "generator",
  VLT: "generator",
  RMG: "generator",
  ATK: "generator",
  UEC: "reactor",
  MFR: "reactor",
  MCP: "server",
  MEM: "server",
  CPU: "server",
  NET: "server",
  DGN: "server",
  AIC: "server",
  SCA: "server",
  TMP: "server",
  OSC: "server",
  VNT: "fan",
  THM: "fan",
  CDC: "crystal",
  ECR: "crystal",
  QCP: "quantum",
  QSM: "quantum",
  QAN: "quantum",
  DIM: "quantum",
  EMC: "quantum",
  TLP: "quantum",
  NXS: "quantum",
  AND: "quantum",
  INT: "quantum",
  LCT: "quantum",
};

/** Timbre family for a device (explicit category wins over the id prefix). */
export function humCategory(id: string, explicit?: HumCategory): HumCategory {
  if (explicit) return explicit;
  const prefix = id.split("-")[0]?.toUpperCase() ?? "";
  return PREFIX_CATEGORY[prefix] ?? "machine";
}

/** Relative loudness per category (fans and reactors carry, shimmer stays faint). */
const CATEGORY_GAIN: Record<HumCategory, number> = {
  generator: 1,
  server: 0.9,
  quantum: 0.45,
  reactor: 1.3,
  machine: 1,
  crystal: 0.6,
  fan: 0.85,
};

const HUM_BASES = [55, 61.7, 73.4, 82.4, 98, 110] as const;
/** Simultaneous device voices (nearest first). */
export const MAX_DEVICE_HUMS = 6;
/** Brownout pitch sag in cents. */
export const BROWNOUT_SAG_CENTS = -140;
/** Starved devices are quieter than running ones. */
const BROWNOUT_GAIN = 0.6;

/** Deterministic hum pitch per device id. */
export function humFrequency(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return HUM_BASES[h % HUM_BASES.length]!;
}

export interface SelectedHum {
  id: string;
  gain: number;
  pan: number;
  freq: number;
  category: HumCategory;
  load: number;
  brownout: boolean;
}

/**
 * Pure selection: the nearest audible devices (powered, or starved and
 * crackling) with their gain/pan, capped at `max` voices.
 */
export function selectHums(
  devices: readonly DeviceHumSource[],
  listener: readonly [number, number],
  yaw?: number,
  max: number = MAX_DEVICE_HUMS,
): SelectedHum[] {
  return devices
    .filter((d) => d.powered || d.brownout)
    .map((d) => {
      const s = spatialize([d.x + 0.5, d.z + 0.5], listener, yaw, 2.5, 16);
      const brownout = !d.powered && !!d.brownout;
      return {
        id: d.id,
        gain: s.gain * (brownout ? BROWNOUT_GAIN : 1),
        pan: s.pan,
        freq: humFrequency(d.id),
        category: humCategory(d.id, d.category),
        load: clamp(d.load ?? 0.5, 0, 1),
        brownout,
      };
    })
    .filter((h) => h.gain > 0.01)
    .sort((a, b) => b.gain - a.gain || (a.id < b.id ? -1 : 1))
    .slice(0, Math.max(0, max));
}

/**
 * Pure description of a category's timbre (what `DeviceHums` builds).
 * Tones are oscillator partials; noise entries are filtered noise; `lfo`
 * modulates the whole voice's amplitude (throb / pulse / shimmer);
 * `warble` modulates pitch (cents); `chimes` are sparse bell pings.
 */
export interface HumVoice {
  tones: { wave: Wave; freq: number; gain: number; detune?: number }[];
  noise: { filter: FilterKind; freq: number; q: number; gain: number }[];
  filter: number;
  lfo?: { rate: number; depth: number };
  warble?: { rate: number; cents: number };
  chimes?: {
    every: readonly [number, number];
    freqs: readonly number[];
    gain: number;
  };
}

export function humVoice(category: HumCategory, freq: number): HumVoice {
  switch (category) {
    case "generator":
      // Low mechanical throb.
      return {
        tones: [
          { wave: "sawtooth", freq: freq * 0.75, gain: 1 },
          { wave: "sine", freq: freq * 1.5, gain: 0.6 },
        ],
        noise: [],
        filter: 220,
        lfo: { rate: 1.8 + (freq % 7) * 0.1, depth: 0.55 },
      };
    case "server":
      // Fan whoosh with a faint blade tone.
      return {
        tones: [{ wave: "sine", freq: freq * 24, gain: 0.05 }],
        noise: [
          { filter: "bandpass", freq: 1600 + freq * 6, q: 0.6, gain: 1.1 },
          { filter: "lowpass", freq: 450, q: 0.7, gain: 0.6 },
        ],
        filter: 6000,
        lfo: { rate: 0.25, depth: 0.12 },
      };
    case "fan":
      // Big slow ventilation fan: broadband air, blade-pass flutter.
      return {
        tones: [{ wave: "sine", freq: freq * 4, gain: 0.06 }],
        noise: [
          { filter: "bandpass", freq: 900, q: 0.4, gain: 1.2 },
          { filter: "lowpass", freq: 280, q: 0.7, gain: 0.7 },
        ],
        filter: 4000,
        lfo: { rate: 0.6 + (freq % 5) * 0.08, depth: 0.2 },
      };
    case "quantum":
      // High, beating shimmer that warbles in pitch.
      return {
        tones: [
          { wave: "sine", freq: freq * 16, gain: 0.5 },
          { wave: "sine", freq: freq * 16, gain: 0.5, detune: 9 },
          { wave: "triangle", freq: freq * 24, gain: 0.2 },
        ],
        noise: [],
        filter: 9000,
        lfo: { rate: 0.4, depth: 0.8 },
        warble: { rate: 3.1 + (freq % 3) * 0.4, cents: 22 },
      };
    case "crystal":
      // Glassy drone with sparse bell chimes (harmonics of the device pitch).
      return {
        tones: [
          { wave: "sine", freq: freq * 8, gain: 0.25 },
          { wave: "sine", freq: freq * 12, gain: 0.15, detune: 4 },
        ],
        noise: [],
        filter: 8000,
        lfo: { rate: 0.15, depth: 0.5 },
        chimes: {
          every: [1.6, 5],
          freqs: [freq * 16, freq * 20, freq * 24, freq * 32],
          gain: 0.5,
        },
      };
    case "reactor":
      // Deep, slow pulse.
      return {
        tones: [
          { wave: "sine", freq: freq * 0.6, gain: 1.2 },
          { wave: "square", freq: freq * 0.6, gain: 0.25 },
        ],
        noise: [{ filter: "lowpass", freq: 160, q: 0.7, gain: 0.4 }],
        filter: 140,
        lfo: { rate: 0.9, depth: 0.7 },
      };
    default:
      return {
        tones: [
          { wave: "sawtooth", freq, gain: 1 },
          { wave: "sine", freq: freq * 2.003, gain: 1 },
        ],
        noise: [],
        filter: 320,
      };
  }
}

/** Gain multiplier for a device's load (0..1). */
export function loadGain(load: number): number {
  return 0.65 + 0.5 * clamp(load, 0, 1);
}

/** Pure description of how a hum sounds right now (targets for the node graph). */
export interface HumTargets {
  gain: number;
  /** Cents added to every oscillator (brownout sag). */
  detune: number;
  filter: number;
  lfoRate: number | null;
  /** Mean seconds between crackles (null = none). */
  crackleEvery: number | null;
}

export function humTargets(sel: SelectedHum, voice: HumVoice, level: number): HumTargets {
  const load = clamp(sel.load, 0, 1);
  return {
    gain: sel.gain * 0.045 * level * loadGain(load),
    detune: sel.brownout ? BROWNOUT_SAG_CENTS : 0,
    filter: voice.filter * (sel.brownout ? 0.45 : 0.75 + 0.5 * load),
    lfoRate: voice.lfo ? voice.lfo.rate * (sel.brownout ? 0.5 : 0.8 + 0.5 * load) : null,
    crackleEvery: sel.brownout ? 0.35 : null,
  };
}

interface HumOsc {
  osc: OscillatorNode;
  detune: number;
}

interface Hum {
  sources: AudioScheduledSourceNode[];
  gain: GainNode;
  pan: StereoPannerNode | null;
  filter: BiquadFilterNode;
  lfo: OscillatorNode | null;
  oscs: HumOsc[];
  nodes: AudioNode[];
  level: number;
  voice: HumVoice;
  brownout: boolean;
  alive: boolean;
  timers: Set<ReturnType<typeof setTimeout>>;
}

export class DeviceHums {
  private readonly hums = new Map<string, Hum>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noiseBuf: AudioBuffer | null = null,
  ) {}

  /** Ids currently sounding (for tests / debugging). */
  active(): string[] {
    return [...this.hums.keys()];
  }

  update(
    devices: readonly DeviceHumSource[],
    listener: readonly [number, number],
    yaw?: number,
  ): void {
    const now = this.ctx.currentTime;
    const chosen = selectHums(devices, listener, yaw);
    const keep = new Set(chosen.map((c) => c.id));
    for (const [id, hum] of this.hums) {
      if (keep.has(id)) continue;
      this.hums.delete(id);
      this.release(hum, now);
    }
    for (const c of chosen) {
      let hum = this.hums.get(c.id);
      if (!hum) {
        hum = this.build(c.category, c.freq);
        this.hums.set(c.id, hum);
      }
      const t = humTargets(c, hum.voice, hum.level);
      hum.gain.gain.setTargetAtTime(Math.max(0.0001, t.gain), now, 0.2);
      hum.pan?.pan.setTargetAtTime(c.pan, now, 0.2);
      hum.filter.frequency.setTargetAtTime(t.filter, now, 0.4);
      if (hum.lfo && t.lfoRate !== null) hum.lfo.frequency.setTargetAtTime(t.lfoRate, now, 0.5);
      if (c.brownout !== hum.brownout) {
        hum.brownout = c.brownout;
        // Sag slowly into the brownout, recover a little faster.
        const tau = c.brownout ? 0.45 : 0.25;
        for (const o of hum.oscs) o.osc.detune.setTargetAtTime(o.detune + t.detune, now, tau);
        if (c.brownout) this.crackle(hum);
      }
    }
  }

  dispose(): void {
    for (const hum of this.hums.values()) {
      this.clearTimers(hum);
      for (const src of hum.sources) {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }
      hum.nodes.forEach((n) => n.disconnect());
    }
    this.hums.clear();
  }

  private clearTimers(hum: Hum): void {
    hum.alive = false;
    hum.timers.forEach((t) => clearTimeout(t));
    hum.timers.clear();
  }

  private later(hum: Hum, fn: () => void, seconds: number): void {
    const id = setTimeout(() => {
      hum.timers.delete(id);
      if (hum.alive) fn();
    }, seconds * 1000);
    hum.timers.add(id);
  }

  private release(hum: Hum, now: number): void {
    this.clearTimers(hum);
    hum.gain.gain.setTargetAtTime(0.0001, now, 0.25);
    for (const src of hum.sources) src.stop(now + 1.2);
    const first = hum.sources[0];
    if (first) first.onended = () => hum.nodes.forEach((n) => n.disconnect());
    else hum.nodes.forEach((n) => n.disconnect());
  }

  /** One short self-disconnecting voice into a hum's post-LFO gain. */
  private ping(
    hum: Hum,
    kind: "noise" | "sine",
    freq: number,
    dur: number,
    gain: number,
    filter?: { type: FilterKind; freq: number; q: number },
  ): void {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    let src: AudioScheduledSourceNode;
    if (kind === "noise") {
      if (!this.noiseBuf) return;
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      n.loop = true;
      src = n;
    } else {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      src = o;
    }
    const chain: AudioNode[] = [src];
    let head: AudioNode = src;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.freq;
      f.Q.value = filter.q;
      head.connect(f);
      head = f;
      chain.push(f);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    head.connect(g).connect(hum.gain);
    chain.push(g);
    src.start(t);
    src.stop(t + dur + 0.03);
    src.onended = () => chain.forEach((n) => n.disconnect());
  }

  /** Electrical crackle while a device is starved (random bursts of 1-3 pops). */
  private crackle(hum: Hum): void {
    const next = () => {
      if (!hum.brownout) return;
      const pops = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pops; i++) {
        this.ping(hum, "noise", 0, 0.012 + Math.random() * 0.03, 1.5 + Math.random() * 2, {
          type: "bandpass",
          freq: 2200 + Math.random() * 3800,
          q: 1.5,
        });
      }
      this.later(hum, next, 0.08 + Math.random() * 0.6);
    };
    this.later(hum, next, 0.05);
  }

  private scheduleChimes(hum: Hum, chimes: NonNullable<HumVoice["chimes"]>): void {
    const next = () => {
      const f = chimes.freqs[Math.floor(Math.random() * chimes.freqs.length)] ?? 880;
      // Starved crystals ring flat and short.
      const sag = hum.brownout ? 0.94 : 1;
      this.ping(hum, "sine", f * sag, hum.brownout ? 0.4 : 1.6, chimes.gain * 2);
      const [lo, hi] = chimes.every;
      this.later(hum, next, lo + Math.random() * (hi - lo));
    };
    this.later(hum, next, 0.4 + Math.random() * chimes.every[0]);
  }

  private build(category: HumCategory, freq: number): Hum {
    const ctx = this.ctx;
    // Fans need noise; without a buffer fall back to the generic machine hum.
    const cat =
      (category === "server" || category === "fan") && !this.noiseBuf ? "machine" : category;
    const voice = humVoice(cat, freq);
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const oscs: HumOsc[] = [];
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = voice.filter;
    // Inner gain carries the LFO, outer gain the distance attenuation.
    const inner = ctx.createGain();
    inner.gain.value = 1;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const pan = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
    f.connect(inner).connect(gain);
    if (pan) gain.connect(pan).connect(this.out);
    else gain.connect(this.out);
    nodes.push(f, inner, gain);
    if (pan) nodes.push(pan);
    let warbleDepth: GainNode | null = null;
    if (voice.warble) {
      const w = ctx.createOscillator();
      w.frequency.value = voice.warble.rate;
      warbleDepth = ctx.createGain();
      warbleDepth.gain.value = voice.warble.cents;
      w.connect(warbleDepth);
      sources.push(w);
      nodes.push(w, warbleDepth);
    }
    for (const tone of voice.tones) {
      const osc = ctx.createOscillator();
      osc.type = tone.wave;
      osc.frequency.value = tone.freq;
      const det = tone.detune ?? 0;
      if (det) osc.detune.value = det;
      if (warbleDepth) warbleDepth.connect(osc.detune);
      const tg = ctx.createGain();
      tg.gain.value = tone.gain;
      osc.connect(tg).connect(f);
      sources.push(osc);
      nodes.push(osc, tg);
      oscs.push({ osc, detune: det });
    }
    if (this.noiseBuf) {
      for (const nz of voice.noise) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const nf = ctx.createBiquadFilter();
        nf.type = nz.filter;
        nf.frequency.value = nz.freq;
        nf.Q.value = nz.q;
        const ng = ctx.createGain();
        ng.gain.value = nz.gain;
        src.connect(nf).connect(ng).connect(f);
        sources.push(src);
        nodes.push(src, nf, ng);
      }
    }
    let lfo: OscillatorNode | null = null;
    if (voice.lfo) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = voice.lfo.rate;
      const depth = ctx.createGain();
      depth.gain.value = clamp(voice.lfo.depth, 0, 1) * 0.5;
      inner.gain.value = 1 - depth.gain.value;
      lfo.connect(depth).connect(inner.gain);
      sources.push(lfo);
      nodes.push(lfo, depth);
    }
    for (const src of sources) src.start();
    const hum: Hum = {
      sources,
      gain,
      pan,
      filter: f,
      lfo,
      oscs,
      nodes,
      level: CATEGORY_GAIN[cat],
      voice,
      brownout: false,
      alive: true,
      timers: new Set(),
    };
    if (voice.chimes) this.scheduleChimes(hum, voice.chimes);
    return hum;
  }
}

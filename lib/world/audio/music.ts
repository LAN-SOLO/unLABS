/**
 * Generative ambient score.
 * =========================
 *
 * Slow modal pads (a chord every two bars), sparse echoing arpeggios,
 * a bass pulse that appears with tension and a high shimmer that grows
 * with progress. Each floor has its own key/mode; the intro and each of
 * the four endings have their own theme (the Frequenz ending quotes the
 * four handshake tones 3-6-4-8).
 *
 * Long-play variation: every floor has several chord progressions and each
 * phrase (one pass through a progression) gets its own shape — arp density,
 * chord voicing, bass pattern, occasional "breathing" phrases with the arp
 * resting. Choices are seeded per session so two sessions differ but a
 * phrase is reproducible (see `phrasePlan`). Once the player knows the
 * handshake (`MusicState.motifs`), its four tones surface faintly now and
 * then. Quarters / kantine switch to a calm "safe room" theme (`safe`).
 *
 * Adaptive layers (round 5): `focus` (a puzzle is open) thins the score to
 * pad + a soft ticking pulse; `danger` (brownout, alarm) adds a heartbeat
 * thump; deep floors (−3 and below) get a darker master filter. Theme
 * changes crossfade between two stems instead of cutting, and short
 * `sting`s (discovery, insight, solved, danger) play in the current key
 * while the bed ducks under them.
 *
 * The theory (`themeFor`, `layerLevels`, `chordNotes`, `phrasePlan`,
 * `stingNotes`) is pure and tested; `MusicSystem` schedules it with a
 * look-ahead timer (one setInterval).
 */
import { clamp, mtof, mulberry32, type Wave } from "@/lib/world/audio/synth";

export const MUSIC_SCENES = [
  "intro",
  "ending_frequenz",
  "ending_substrat",
  "ending_rueckkehr",
  "ending_halo",
] as const;
export type MusicScene = (typeof MUSIC_SCENES)[number];

export interface MusicState {
  floor: number;
  /** Overall game progress 0..1. */
  progress: number;
  /** Danger / urgency 0..1 (brownout, overheating, anomalies). */
  tension: number;
  scene?: MusicScene | null;
  /** The player knows the handshake (3-6-4-8): let it surface in the score. */
  motifs?: boolean;
  /** Calm "safe room" mode (quarters, kantine). */
  safe?: boolean;
  /** A puzzle / minigame has focus: thin, pulsing, low-distraction score. */
  focus?: boolean;
  /** Acute danger 0..1 (brownout, overheating, alarm): heartbeat layer. */
  danger?: number;
}

/** The four handshake tones 3-6-4-8 as 0-based scale degrees. */
export const HANDSHAKE_DEGREES: readonly number[] = [2, 5, 3, 7];

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
} as const;

export interface Theme {
  id: string;
  /** Root MIDI note of the pad register. */
  root: number;
  mode: readonly number[];
  tempo: number;
  /** Scale degrees, one chord per two bars. */
  progression: readonly number[];
  /** Alternative progressions that rotate in on later phrases. */
  alternates?: readonly (readonly number[])[];
  padWave: Wave;
  arpWave: Wave;
  /** Base levels 0..1 before state modulation. */
  pad: number;
  arp: number;
  bass: number;
  shimmer: number;
  /** Scale degrees of a recurring motif (played every four bars). */
  motif?: readonly number[];
}

const FLOOR_THEMES: readonly Theme[] = [
  {
    id: "floor0",
    root: 50,
    mode: MODES.dorian,
    tempo: 60,
    progression: [0, 5, 3, 4],
    alternates: [
      [0, 3, 4, 0],
      [5, 3, 0, 4],
      [0, 6, 3, 4],
    ],
    padWave: "triangle",
    arpWave: "triangle",
    pad: 0.7,
    arp: 0.25,
    bass: 0,
    shimmer: 0,
  },
  {
    id: "floor1",
    root: 45,
    mode: MODES.aeolian,
    tempo: 60,
    progression: [0, 3, 5, 4],
    alternates: [
      [0, 5, 6, 4],
      [3, 4, 0, 0],
      [0, 6, 5, 3],
    ],
    padWave: "sawtooth",
    arpWave: "triangle",
    pad: 0.65,
    arp: 0.3,
    bass: 0.2,
    shimmer: 0,
  },
  {
    id: "floor2",
    root: 52,
    mode: MODES.phrygian,
    tempo: 58,
    progression: [0, 1, 0, 6],
    alternates: [
      [0, 6, 5, 1],
      [0, 3, 1, 0],
    ],
    padWave: "triangle",
    arpWave: "sine",
    pad: 0.7,
    arp: 0.35,
    bass: 0.1,
    shimmer: 0.2,
  },
  {
    id: "floor3",
    root: 49,
    mode: MODES.phrygian,
    tempo: 56,
    progression: [0, 1, 5, 6],
    alternates: [
      [0, 6, 1, 0],
      [5, 6, 0, 1],
    ],
    padWave: "sawtooth",
    arpWave: "sine",
    pad: 0.75,
    arp: 0.3,
    bass: 0.35,
    shimmer: 0.3,
  },
  {
    id: "floor4",
    root: 47,
    mode: MODES.aeolian,
    tempo: 54,
    progression: [0, 5, 2, 6],
    alternates: [
      [0, 3, 6, 5],
      [0, 0, 5, 6],
    ],
    padWave: "sawtooth",
    arpWave: "triangle",
    pad: 0.75,
    arp: 0.25,
    bass: 0.4,
    shimmer: 0.25,
  },
  {
    id: "floor5",
    root: 44,
    mode: MODES.phrygian,
    tempo: 50,
    progression: [0, 1, 6, 0],
    alternates: [
      [0, 5, 1, 6],
      [1, 0, 6, 0],
    ],
    padWave: "sine",
    arpWave: "sine",
    pad: 0.8,
    arp: 0.2,
    bass: 0.5,
    shimmer: 0.4,
  },
];

/** Calm themes for safe rooms (alternate by floor parity). */
const SAFE_THEMES: readonly Theme[] = [
  {
    id: "safe_a",
    root: 53,
    mode: MODES.lydian,
    tempo: 52,
    progression: [0, 4, 5, 3],
    alternates: [
      [0, 3, 1, 4],
      [5, 3, 0, 0],
    ],
    padWave: "sine",
    arpWave: "sine",
    pad: 0.6,
    arp: 0.3,
    bass: 0,
    shimmer: 0.15,
  },
  {
    id: "safe_b",
    root: 50,
    mode: MODES.ionian,
    tempo: 50,
    progression: [0, 5, 3, 4],
    alternates: [
      [0, 3, 0, 4],
      [3, 4, 5, 0],
    ],
    padWave: "triangle",
    arpWave: "sine",
    pad: 0.55,
    arp: 0.3,
    bass: 0,
    shimmer: 0.2,
  },
];

const SCENE_THEMES: Record<MusicScene, Theme> = {
  intro: {
    id: "intro",
    root: 50,
    mode: MODES.aeolian,
    tempo: 50,
    progression: [0, 0, 5, 6],
    padWave: "sawtooth",
    arpWave: "sine",
    pad: 0.55,
    arp: 0.08,
    bass: 0.5,
    shimmer: 0,
  },
  ending_frequenz: {
    id: "ending_frequenz",
    root: 57,
    mode: MODES.lydian,
    tempo: 60,
    progression: [0, 4, 5, 3],
    padWave: "triangle",
    arpWave: "sine",
    pad: 0.8,
    arp: 0.3,
    bass: 0.3,
    shimmer: 0.4,
    // The handshake keys 3-6-4-8 as scale degrees (1-based → 0-based).
    motif: [2, 5, 3, 7],
  },
  ending_substrat: {
    id: "ending_substrat",
    root: 52,
    mode: MODES.dorian,
    tempo: 72,
    progression: [0, 3, 6, 4],
    padWave: "sawtooth",
    arpWave: "square",
    pad: 0.6,
    arp: 0.85,
    bass: 0.4,
    shimmer: 0.2,
    motif: [0, 2, 4, 6, 4, 2],
  },
  ending_rueckkehr: {
    id: "ending_rueckkehr",
    root: 48,
    mode: MODES.ionian,
    tempo: 64,
    progression: [0, 4, 5, 3],
    padWave: "triangle",
    arpWave: "triangle",
    pad: 0.85,
    arp: 0.4,
    bass: 0.5,
    shimmer: 0.3,
    motif: [4, 3, 2, 0],
  },
  ending_halo: {
    id: "ending_halo",
    root: 54,
    mode: MODES.lydian,
    tempo: 40,
    progression: [0, 1, 0, 4],
    padWave: "sine",
    arpWave: "sine",
    pad: 0.9,
    arp: 0.15,
    bass: 0,
    shimmer: 0.9,
  },
};

export function themeFor(state: MusicState): Theme {
  if (state.scene) return SCENE_THEMES[state.scene];
  const f = clamp(Math.round(state.floor), 0, FLOOR_THEMES.length - 1);
  if (state.safe) return SAFE_THEMES[f % SAFE_THEMES.length]!;
  return FLOOR_THEMES[f]!;
}

export interface LayerLevels {
  pad: number;
  arp: number;
  bass: number;
  shimmer: number;
  /** Pad lowpass cutoff in Hz. */
  cutoff: number;
  /** Soft ticking ostinato (puzzle focus). */
  pulse: number;
  /** Low double thump (danger). */
  heartbeat: number;
  /** 0..1 how dark the floor sounds (master lowpass). */
  darkness: number;
}

/** Deep floors sound darker: 0 on floors 0-2, rising to 1 on floor 5. */
export function floorDarkness(floor: number): number {
  return clamp((floor - 2) / 3, 0, 1);
}

/** Master lowpass for the whole score (smoothly automated). */
export function masterCutoff(lv: Pick<LayerLevels, "darkness" | "pulse">): number {
  return 14000 * (1 - 0.6 * lv.darkness) * (lv.pulse > 0 ? 0.55 : 1);
}

export function layerLevels(state: MusicState, theme: Theme = themeFor(state)): LayerLevels {
  const p = clamp(state.progress, 0, 1);
  const t = clamp(state.tension, 0, 1);
  if (state.scene) {
    return {
      pad: theme.pad,
      arp: theme.arp,
      bass: theme.bass,
      shimmer: theme.shimmer,
      cutoff: 2200,
      pulse: 0,
      heartbeat: 0,
      darkness: 0,
    };
  }
  const darkness = floorDarkness(state.floor);
  const danger = clamp(state.danger ?? 0, 0, 1);
  let lv: LayerLevels;
  if (state.safe) {
    // Safe rooms ignore most of the tension: no bass, closed filter.
    lv = {
      pad: theme.pad,
      arp: clamp(theme.arp + p * 0.15, 0, 1),
      bass: 0,
      shimmer: clamp(theme.shimmer + p * 0.2, 0, 1),
      cutoff: 900 + p * 300 + t * 200,
      pulse: 0,
      heartbeat: 0,
      darkness: darkness * 0.5,
    };
  } else {
    lv = {
      pad: clamp(theme.pad + t * 0.2, 0, 1),
      arp: clamp(theme.arp + p * 0.5 + t * 0.2 - 0.1, 0, 1),
      bass: clamp(theme.bass + (t > 0.35 ? t * 0.6 : 0) + danger * 0.2, 0, 1),
      shimmer: clamp(theme.shimmer + (p > 0.5 ? (p - 0.5) * 1.2 : 0), 0, 1) * (1 - darkness * 0.4),
      cutoff: (700 + p * 900 + t * 1800) * (1 - darkness * 0.3),
      pulse: 0,
      heartbeat: danger > 0.2 ? danger : 0,
      darkness,
    };
  }
  if (state.focus) {
    // Puzzle focus: keep the harmony, drop the busy layers, add a pulse.
    lv = {
      ...lv,
      pad: lv.pad * 0.75,
      arp: lv.arp * 0.3,
      bass: lv.bass * 0.3,
      shimmer: lv.shimmer * 0.3,
      cutoff: lv.cutoff * 0.7,
      pulse: 0.6,
      heartbeat: lv.heartbeat * 0.5,
    };
  }
  return lv;
}

export const STING_KINDS = ["discovery", "insight", "solved", "danger"] as const;
export type StingKind = (typeof STING_KINDS)[number];

export interface StingNote {
  /** MIDI note. */
  midi: number;
  /** Seconds from the sting start. */
  at: number;
  dur: number;
  gain: number;
  wave: Wave;
}

/** A short cue in the current key (pure; `MusicSystem.sting` plays it). */
export function stingNotes(theme: Theme, kind: StingKind): StingNote[] {
  const n = (deg: number, oct = 12) => scaleNote(theme, deg) + oct;
  switch (kind) {
    case "discovery":
      // Rising open fifth-and-ninth figure, bell-like.
      return [0, 4, 7, 8].map((d, i) => ({
        midi: n(d, 24),
        at: i * 0.11,
        dur: 0.5 + i * 0.15,
        gain: 0.05,
        wave: "sine" as const,
      }));
    case "insight":
      return [
        { midi: n(2, 24), at: 0, dur: 1.2, gain: 0.045, wave: "sine" },
        { midi: n(4, 24), at: 0.18, dur: 1.2, gain: 0.04, wave: "sine" },
        { midi: n(6, 36), at: 0.36, dur: 1.6, gain: 0.03, wave: "triangle" },
      ];
    case "solved":
      return [0, 2, 4, 7].map((d, i) => ({
        midi: n(d, 24),
        at: i * 0.07,
        dur: 0.3,
        gain: 0.05,
        wave: "triangle" as const,
      }));
    case "danger":
      // Low minor second, pulsing twice.
      return [
        { midi: n(0, -12), at: 0, dur: 0.8, gain: 0.09, wave: "sawtooth" },
        { midi: n(0, -12) + 1, at: 0.02, dur: 0.8, gain: 0.07, wave: "sawtooth" },
        { midi: n(0, -12), at: 0.9, dur: 0.9, gain: 0.08, wave: "sawtooth" },
        { midi: n(0, -12) + 1, at: 0.92, dur: 0.9, gain: 0.06, wave: "sawtooth" },
      ];
  }
}

/** MIDI note of a scale degree (degrees wrap into octaves). */
export function scaleNote(theme: Theme, degree: number): number {
  const n = theme.mode.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return theme.root + oct * 12 + theme.mode[idx]!;
}

/** Seventh chord (root, 3rd, 5th, 7th in-scale) on a scale degree. */
export function chordNotes(theme: Theme, degree: number): number[] {
  return [0, 2, 4, 6].map((k) => scaleNote(theme, degree + k));
}

/** Revoice a chord: 0 = root position, 1 = first inversion, 2 = spread (7th down). */
export function voiceChord(chord: readonly number[], voicing: number): number[] {
  const out = [...chord];
  if (voicing === 1 && out.length) out.push(out.shift()! + 12);
  if (voicing === 2 && out.length >= 4) out[3] = out[3]! - 12;
  return out;
}

export interface PhrasePlan {
  progression: readonly number[];
  /** Arp density multiplier (0 = a resting, "breathing" phrase). */
  arpMul: number;
  shimmerMul: number;
  voicing: 0 | 1 | 2;
  /** 0 = pulse every bar, 1 = root + fifth push, 2 = sparse. */
  bassPattern: 0 | 1 | 2;
  /** Octave offset for the arpeggio register. */
  arpOctave: 12 | 24;
  /** Faint handshake quote (3-6-4-8) in this phrase. */
  handshake: boolean;
}

function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x5bd1e995, 0x27d4eb2d) ^ Math.imul(b + 0x165667b1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * Shape of phrase `phrase` (0-based) for a theme and session seed. Phrase 0
 * always plays the theme's main progression in its plain form so floors
 * are recognisable on arrival; later phrases rotate alternates and vary.
 */
export function phrasePlan(
  theme: Theme,
  phrase: number,
  seed: number,
  state: Pick<MusicState, "motifs" | "scene"> = {},
): PhrasePlan {
  const rng = mulberry32(hash2(phrase, seed ^ (theme.root * 131 + theme.id.length)));
  const plain = phrase === 0;
  const alts = theme.alternates ?? [];
  let progression = theme.progression;
  if (!plain && alts.length && rng() < 0.55) {
    progression = alts[Math.floor(rng() * alts.length) % alts.length]!;
  }
  const r = rng();
  const arpMul = plain ? 1 : r < 0.15 ? 0 : r < 0.45 ? 0.55 : r < 0.8 ? 1 : 1.4;
  const shimmerMul = plain ? 1 : 0.6 + rng() * 0.8;
  const voicing = (plain ? 0 : Math.floor(rng() * 3)) as 0 | 1 | 2;
  const bassPattern = (plain ? 0 : Math.floor(rng() * 3)) as 0 | 1 | 2;
  const arpOctave = rng() < 0.3 ? 24 : 12;
  const handshake = !!state.motifs && !state.scene && !plain && hash2(phrase, seed) % 5 === 2;
  return { progression, arpMul, shimmerMul, voicing, bassPattern, arpOctave, handshake };
}

// ── Web Audio scheduler ───────────────────────────────────────────

const LOOKAHEAD = 0.3;
const TICK_MS = 60;

const STEM_FADE = 2.5;

export class MusicSystem {
  private readonly out: GainNode;
  /** Current stem: every note of the current theme goes here. */
  private stem: GainNode;
  /** Master tone (darkness / focus), smoothly automated. */
  private readonly tone: BiquadFilterNode;
  /** Ducks the bed under stings. */
  private readonly duck: GainNode;
  /** Stings bypass `out` so they sound even when the score is stopped. */
  private readonly stingOut: GainNode;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  /** Stems fading out after a theme change (freed by timer or dispose). */
  private readonly retired = new Set<GainNode>();
  private readonly echo: DelayNode;
  private readonly echoIn: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: MusicState = { floor: 0, progress: 0, tension: 0, scene: null };
  private theme: Theme = themeFor(this.state);
  private levels: LayerLevels = layerLevels(this.state);
  private beat = 0;
  private nextTime = 0;
  /** Per-session seed: each session phrases the score differently. */
  private readonly seed: number;
  private plan: { phrase: number; plan: PhrasePlan } | null = null;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    seed: number = Math.floor(Math.random() * 0x7fffffff),
  ) {
    this.seed = seed;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.duck = ctx.createGain();
    this.tone = ctx.createBiquadFilter();
    this.tone.type = "lowpass";
    this.tone.frequency.value = masterCutoff(this.levels);
    this.tone.Q.value = 0.5;
    this.tone.connect(this.duck).connect(this.out);
    this.out.connect(destination);
    this.stem = ctx.createGain();
    this.stem.connect(this.tone);
    this.stingOut = ctx.createGain();
    this.stingOut.gain.value = 1;
    this.stingOut.connect(destination);
    // A single feedback echo gives arpeggios their space.
    this.echoIn = ctx.createGain();
    this.echoIn.gain.value = 0.35;
    this.echo = ctx.createDelay(2);
    this.echo.delayTime.value = 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2200;
    this.echoIn.connect(this.echo);
    this.echo.connect(damp).connect(fb).connect(this.echo);
    damp.connect(this.tone);
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  setState(state: MusicState): void {
    const prevId = this.theme.id;
    this.state = { ...state };
    this.theme = themeFor(this.state);
    this.levels = layerLevels(this.state, this.theme);
    const now = this.ctx.currentTime;
    this.echo.delayTime.setTargetAtTime(30 / this.theme.tempo, now, 0.5);
    this.tone.frequency.setTargetAtTime(masterCutoff(this.levels), now, 1.2);
    if (this.theme.id !== prevId) {
      // Start the new theme on a fresh phrase, crossfading stems.
      this.beat = 0;
      this.plan = null;
      this.nextTime = Math.max(this.nextTime, now + 0.1);
      this.crossfade(now);
    }
  }

  /** Current theme id (for tests / debugging). */
  get themeId(): string {
    return this.theme.id;
  }

  /** Play a short cue in the current key; the bed ducks under it. */
  sting(kind: StingKind): void {
    const now = this.ctx.currentTime;
    const t0 = now + 0.03;
    let end = 0;
    for (const n of stingNotes(this.theme, kind)) {
      this.note(n.wave, mtof(n.midi), t0 + n.at, n.dur, n.gain, 0.01, 0.9, false, this.stingOut);
      end = Math.max(end, n.at + n.dur + 0.9);
    }
    const d = this.duck.gain;
    d.cancelScheduledValues(now);
    d.setValueAtTime(Math.max(0.0001, d.value || 1), now);
    d.linearRampToValueAtTime(0.45, now + 0.15);
    d.setValueAtTime(0.45, now + Math.max(0.3, end * 0.6));
    d.linearRampToValueAtTime(1, now + end + 0.8);
  }

  private crossfade(now: number): void {
    const old = this.stem;
    const next = this.ctx.createGain();
    next.gain.setValueAtTime(0.0001, now);
    next.gain.exponentialRampToValueAtTime(1, now + STEM_FADE);
    next.connect(this.tone);
    this.stem = next;
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(Math.max(0.0001, old.gain.value), now);
    old.gain.exponentialRampToValueAtTime(0.0001, now + STEM_FADE);
    // Pads already scheduled on the old stem ring up to ~11 s; free it after.
    this.retired.add(old);
    const id = setTimeout(() => {
      this.timers.delete(id);
      this.retired.delete(old);
      old.disconnect();
    }, 12_000);
    this.timers.add(id);
  }

  start(): void {
    if (this.timer) return;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), now);
    this.out.gain.exponentialRampToValueAtTime(1, now + 3);
    this.nextTime = now + 0.1;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(fade = 2): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), now);
    this.out.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fade));
  }

  dispose(): void {
    this.stop(0.05);
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.retired.forEach((g) => g.disconnect());
    this.retired.clear();
    this.stem.disconnect();
    this.tone.disconnect();
    this.duck.disconnect();
    this.out.disconnect();
    this.stingOut.disconnect();
    this.echo.disconnect();
    this.echoIn.disconnect();
  }

  private tick(): void {
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    // Recover from a suspended context / backgrounded tab without a burst.
    if (this.nextTime < this.ctx.currentTime - 1) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < horizon) {
      this.scheduleBeat(this.beat, this.nextTime);
      this.beat++;
      this.nextTime += 60 / this.theme.tempo;
    }
  }

  private phraseAt(b: number): PhrasePlan {
    const th = this.theme;
    const phrase = Math.floor(b / (th.progression.length * 8));
    if (!this.plan || this.plan.phrase !== phrase) {
      // Scenes are short and scripted: always their plain form.
      const idx = this.state.scene ? 0 : phrase;
      this.plan = { phrase, plan: phrasePlan(th, idx, this.seed, this.state) };
    }
    return this.plan.plan;
  }

  private scheduleBeat(b: number, t: number): void {
    const th = this.theme;
    const lv = this.levels;
    const beatLen = 60 / th.tempo;
    const plan = this.phraseAt(b);
    const phraseLen = th.progression.length * 8;
    const inPhrase = b % phraseLen;
    const rng = mulberry32(b * 977 + th.id.length * 131 + th.root + this.seed);
    const prog = plan.progression;
    const degree = prog[Math.floor(inPhrase / 8) % prog.length]!;
    const chord = voiceChord(chordNotes(th, degree), plan.voicing);
    if (b % 8 === 0 && lv.pad > 0) this.pad(chord, t, beatLen * 8, lv);
    if (lv.bass > 0.05) {
      const root = mtof(Math.min(...chord) - 12);
      const g = 0.09 * lv.bass;
      if (plan.bassPattern === 0 && b % 4 === 0) {
        this.note("sine", root, t, beatLen * 3, g, 0.08, 1.2, false);
      } else if (plan.bassPattern === 1 && (b % 8 === 0 || b % 8 === 3)) {
        const f = b % 8 === 0 ? root : root * 1.5;
        this.note("sine", f, t, beatLen * 2, g * (b % 8 === 0 ? 1 : 0.7), 0.06, 0.9, false);
      } else if (plan.bassPattern === 2 && b % 8 === 0) {
        this.note("sine", root, t, beatLen * 6, g, 0.3, 2, false);
      }
    }
    if (th.motif && b % 16 === 4) {
      th.motif.forEach((d, i) => {
        const at = t + i * beatLen * (th.id === "ending_substrat" ? 0.25 : 0.75);
        this.note(
          th.arpWave,
          mtof(scaleNote(th, d) + 12),
          at,
          beatLen * 0.6,
          0.05,
          0.01,
          0.9,
          true,
        );
      });
    }
    // The handshake surfaces faintly, high and echoing, mid-phrase.
    if (plan.handshake && inPhrase === 12) {
      HANDSHAKE_DEGREES.forEach((d, i) => {
        this.note(
          "sine",
          mtof(scaleNote(th, d) + 24),
          t + i * beatLen,
          beatLen * 0.7,
          0.018,
          0.04,
          1.4,
          true,
        );
      });
    }
    const safe = !!this.state.safe;
    for (const half of [0, 0.5]) {
      if (rng() < lv.arp * 0.5 * plan.arpMul) {
        const pick = chord[Math.floor(rng() * chord.length)]! + plan.arpOctave;
        const gain = th.arpWave === "square" ? 0.018 : safe ? 0.03 : 0.04;
        // Safe rooms: music-box plinks with long tails.
        const release = safe ? 1.4 : 0.6;
        this.note(
          th.arpWave,
          mtof(pick + (safe ? 12 : 0)),
          t + half * beatLen,
          beatLen * 0.4,
          gain,
          0.005,
          release,
          true,
        );
      }
    }
    if (lv.pulse > 0) {
      // Focus pulse: a soft ticking on every beat, accent on the bar.
      const root = Math.min(...chord);
      const accent = b % 4 === 0;
      this.note(
        "sine",
        mtof(root + (accent ? 36 : 31)),
        t,
        0.04,
        0.014 * lv.pulse * (accent ? 1.3 : 1),
        0.002,
        0.12,
        accent,
      );
    }
    if (lv.heartbeat > 0 && b % 2 === 0) {
      // Danger: lub-dub, faster feel on half beats when it is acute.
      const g = 0.12 * lv.heartbeat;
      this.note("sine", 55, t, 0.08, g, 0.004, 0.18, false);
      this.note("sine", 49, t + 0.26, 0.07, g * 0.7, 0.004, 0.16, false);
    }
    if (b % 2 === 0 && rng() < lv.shimmer * 0.45 * plan.shimmerMul) {
      const pick = chord[Math.floor(rng() * chord.length)]! + 36;
      this.note("sine", mtof(pick), t, beatLen * 3, 0.012, 0.8, 2, true);
    }
  }

  private pad(chord: readonly number[], t: number, dur: number, lv: LayerLevels): void {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lv.cutoff;
    f.Q.value = 0.4;
    const g = ctx.createGain();
    const peak = 0.028 * lv.pad;
    const attack = Math.min(3, dur * 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + dur - 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 3);
    f.connect(g).connect(this.stem);
    const oscs: OscillatorNode[] = [];
    for (const m of chord) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = this.theme.padWave;
        o.frequency.value = mtof(m);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 3.1);
        oscs.push(o);
      }
    }
    oscs[0]!.onended = () => {
      oscs.forEach((o) => o.disconnect());
      f.disconnect();
      g.disconnect();
    };
  }

  private note(
    wave: Wave,
    freq: number,
    t: number,
    dur: number,
    gain: number,
    attack: number,
    release: number,
    echo: boolean,
    dest: AudioNode = this.stem,
  ): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.max(0.003, attack));
    g.gain.setValueAtTime(Math.max(0.0002, gain), t + Math.max(attack, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    o.connect(g).connect(dest);
    if (echo) g.connect(this.echoIn);
    o.start(t);
    o.stop(t + dur + release + 0.05);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
}

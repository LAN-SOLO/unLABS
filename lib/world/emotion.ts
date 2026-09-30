/**
 * Emotion model (pure) — how Jade feels, and how it shows.
 * ========================================================
 *
 * Three layers, the usual split of affective-computing models:
 *
 * 1. **Emotions** — fifteen discrete emotions with an intensity 0..1. Events
 *    are *appraised* (OCC style: how desirable, how expected, who caused it,
 *    how much it is under her control, how much effort went in) and push
 *    intensities; every emotion then decays with its own half-life (a jolt
 *    of surprise is gone in seconds, pride lingers).
 * 2. **Mood** — a slow pleasure / arousal / dominance vector (PAD). It
 *    follows the emotions' PAD directions, weighted by intensity, over tens
 *    of seconds, and it colours the next appraisals (a bad mood makes a
 *    failed repair sting more, a good one makes a gift feel better).
 * 3. **Needs** — energy (drains while working, returns while sitting,
 *    drinking or relaxing) and thirst (rises steadily). Low energy shows up
 *    as fatigue; needs drive what she wants to do next (`wants`).
 *
 * `expression()` turns the state into a face and a posture — brows, lids,
 * mouth shape, head pitch / roll, torso slump, a fidget amplitude and an
 * emote icon — that the renderer layers on top of an animation pose.
 */

export const EMOTIONS = [
  "joy",
  "pride",
  "relief",
  "gratitude",
  "amusement",
  "interest",
  "focus",
  "surprise",
  "frustration",
  "anger",
  "sadness",
  "fear",
  "boredom",
  "fatigue",
  "contentment",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** Pleasure, arousal, dominance (−1..1 each). */
export type PAD = readonly [number, number, number];

export interface EmotionSpec {
  /** Seconds until the intensity halves. */
  halfLife: number;
  /** Direction in PAD space the emotion pulls the mood. */
  pad: PAD;
}

export const EMOTION_SPECS: Readonly<Record<Emotion, EmotionSpec>> = {
  joy: { halfLife: 14, pad: [0.8, 0.5, 0.4] },
  pride: { halfLife: 18, pad: [0.7, 0.3, 0.8] },
  relief: { halfLife: 10, pad: [0.6, -0.4, 0.3] },
  gratitude: { halfLife: 20, pad: [0.7, 0.1, -0.1] },
  amusement: { halfLife: 9, pad: [0.7, 0.4, 0.3] },
  interest: { halfLife: 18, pad: [0.4, 0.5, 0.3] },
  focus: { halfLife: 25, pad: [0.2, 0.3, 0.5] },
  surprise: { halfLife: 2.5, pad: [0, 0.9, -0.2] },
  frustration: { halfLife: 22, pad: [-0.6, 0.5, -0.2] },
  anger: { halfLife: 12, pad: [-0.7, 0.8, 0.5] },
  sadness: { halfLife: 28, pad: [-0.7, -0.5, -0.5] },
  fear: { halfLife: 6, pad: [-0.6, 0.8, -0.7] },
  boredom: { halfLife: 30, pad: [-0.3, -0.7, -0.2] },
  fatigue: { halfLife: 1e9, pad: [-0.3, -0.8, -0.3] },
  contentment: { halfLife: 40, pad: [0.6, -0.4, 0.3] },
};

/** How an event is judged (all optional, defaults neutral). */
export interface Appraisal {
  /** Good (+) or bad (−) for her goals, −1..1. */
  desirability?: number;
  /** 0 expected … 1 completely unexpected. */
  unexpectedness?: number;
  /** Who caused it: herself, someone else (a bot), or nobody / the lab. */
  agent?: "self" | "other" | "world";
  /** 0 nothing she can do … 1 fully in her hands. */
  control?: number;
  /** Effort she had put in (0..1) — success after effort makes proud, failure after effort frustrates. */
  effort?: number;
  /** A physical threat nearby (sparks, a bang), 0..1. */
  danger?: number;
  /** Novelty / something to figure out, 0..1. */
  novelty?: number;
  /** It is funny (a bot bumping a chair, a spin), 0..1. */
  comic?: number;
  /** A frustration that has just been resolved (−) … */
  resolves?: boolean;
}

/** Named events of the lab and their appraisals. */
export const EVENTS = {
  repair_success: { desirability: 0.9, agent: "self", control: 0.8, effort: 0.8, resolves: true },
  repair_fail: { desirability: -0.7, agent: "self", control: 0.6, effort: 0.7 },
  repair_progress: { desirability: 0.25, agent: "self", control: 0.8, effort: 0.3 },
  device_break: {
    desirability: -0.6,
    unexpectedness: 0.9,
    agent: "world",
    control: 0.2,
    danger: 0.5,
  },
  device_glitch: { desirability: -0.2, unexpectedness: 0.6, agent: "world", novelty: 0.3 },
  explosion: { desirability: -0.4, unexpectedness: 1, agent: "world", danger: 0.9, comic: 0.3 },
  gift: { desirability: 0.8, unexpectedness: 0.4, agent: "other" },
  bot_help: { desirability: 0.6, agent: "other", resolves: true },
  bot_mischief: { desirability: -0.2, unexpectedness: 0.9, agent: "other", comic: 0.8 },
  bot_greets: { desirability: 0.3, agent: "other", comic: 0.2 },
  idea: { desirability: 0.5, unexpectedness: 0.7, agent: "self", novelty: 0.9 },
  spin: { desirability: 0.4, agent: "self", comic: 0.6 },
  drink: { desirability: 0.5, agent: "self" },
  typing_progress: { desirability: 0.2, agent: "self", control: 0.9, effort: 0.2, novelty: 0.2 },
  mcp_snark: { desirability: -0.1, agent: "other", comic: 0.5 },
  nothing_to_do: { desirability: -0.15, agent: "world", novelty: 0 },
} as const satisfies Record<string, Appraisal>;
export type LabEvent = keyof typeof EVENTS;

export interface Needs {
  /** 1 rested … 0 exhausted. */
  energy: number;
  /** 0 fine … 1 parched. */
  thirst: number;
}

export interface EmotionState {
  e: Record<Emotion, number>;
  mood: [number, number, number];
  needs: Needs;
  /** Consecutive failures (sharpens frustration). */
  streak: number;
}

export function initialEmotions(): EmotionState {
  const e = Object.fromEntries(EMOTIONS.map((k) => [k, 0])) as Record<Emotion, number>;
  e.interest = 0.3;
  e.contentment = 0.2;
  return { e, mood: [0.15, 0.1, 0.2], needs: { energy: 0.9, thirst: 0.2 }, streak: 0 };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampS = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

/** Add intensity with diminishing returns (never above 1). */
function push(s: EmotionState, k: Emotion, amount: number): void {
  if (amount <= 0) {
    s.e[k] = clamp01(s.e[k] + amount);
    return;
  }
  s.e[k] = clamp01(s.e[k] + amount * (1 - s.e[k] * 0.6));
}

/**
 * Appraise an event: its judgement becomes emotion impulses, coloured by the
 * current mood (pleasure scales good and bad news) and the failure streak.
 */
export function appraise(s: EmotionState, event: LabEvent | Appraisal, strength = 1): void {
  const a: Appraisal = typeof event === "string" ? EVENTS[event] : event;
  const d = (a.desirability ?? 0) * strength;
  const u = a.unexpectedness ?? 0;
  const ctl = a.control ?? 0.5;
  const eff = a.effort ?? 0;
  const moodP = s.mood[0];
  if (d > 0) {
    // Good news lands softer in a bad mood.
    const g = d * (0.8 + 0.3 * moodP);
    push(s, "joy", g * 0.7);
    if (a.agent === "self") push(s, "pride", g * (0.2 + eff * 0.5));
    if (a.agent === "other") push(s, "gratitude", g * 0.9);
    if (a.resolves) {
      push(s, "relief", clamp01(s.e.frustration + s.e.fear) * 0.9 + g * 0.2);
      push(s, "frustration", -0.7 * strength);
      push(s, "anger", -0.6 * strength);
      push(s, "sadness", -0.4 * strength);
      s.streak = 0;
    }
    push(s, "boredom", -0.4 * g);
    push(s, "contentment", g * 0.2);
  } else if (d < 0) {
    const b = -d * (1 - 0.3 * moodP);
    if (a.agent === "self") {
      s.streak += 1;
      const sting = b * (0.4 + eff * 0.5) * (1 + 0.35 * Math.min(3, s.streak - 1));
      push(s, "frustration", sting);
      if (s.e.frustration > 0.65) push(s, "anger", sting * 0.6);
      push(s, "sadness", b * 0.2);
      push(s, "focus", -0.25 * b);
    } else {
      push(s, "frustration", b * (0.3 + (1 - ctl) * 0.3));
      push(s, "sadness", b * 0.15);
    }
    push(s, "joy", -0.5 * b);
    push(s, "contentment", -0.4 * b);
  }
  if (u > 0) push(s, "surprise", u * strength);
  if (a.danger) push(s, "fear", a.danger * strength * (1 - s.mood[2] * 0.3));
  if (a.novelty) push(s, "interest", a.novelty * strength * 0.8);
  if (a.comic) push(s, "amusement", a.comic * strength * (0.7 + 0.3 * Math.max(0, moodP)));
  if (a.effort && d >= 0) push(s, "focus", a.effort * 0.4 * strength);
  if (event === "drink") {
    s.needs.thirst = 0;
    s.needs.energy = clamp01(s.needs.energy + 0.25);
  }
  if (event === "gift") {
    s.needs.thirst = Math.max(0, s.needs.thirst - 0.8);
    s.needs.energy = clamp01(s.needs.energy + 0.2);
  }
}

/** What she is doing right now, for the needs. */
export type Activity = "work" | "type" | "walk" | "rest" | "idle" | "celebrate" | "drink";

const DRAIN: Record<Activity, number> = {
  work: -0.012,
  type: -0.008,
  walk: -0.004,
  rest: 0.03,
  idle: 0.002,
  celebrate: -0.004,
  drink: 0.01,
};

/** Advance decay, mood and needs by `dt` seconds. */
export function stepEmotions(s: EmotionState, dt: number, activity: Activity = "idle"): void {
  for (const k of EMOTIONS) {
    if (k === "fatigue") continue;
    const hl = EMOTION_SPECS[k].halfLife;
    s.e[k] *= Math.pow(0.5, dt / hl);
  }
  // Needs.
  s.needs.energy = clamp01(s.needs.energy + DRAIN[activity] * dt);
  s.needs.thirst = clamp01(s.needs.thirst + 0.004 * dt * (activity === "work" ? 1.4 : 1));
  s.e.fatigue = clamp01((0.55 - s.needs.energy) / 0.55);
  // Focus builds slowly while working, boredom while idle.
  if (activity === "work" || activity === "type") push(s, "focus", 0.02 * dt);
  if (activity === "idle") push(s, "boredom", 0.012 * dt);
  if (activity === "rest") push(s, "contentment", 0.015 * dt);
  // Mood: exponential follow of the intensity-weighted PAD mean (τ ≈ 20 s).
  let w = 0;
  const target = [0, 0, 0];
  for (const k of EMOTIONS) {
    const v = s.e[k];
    if (v < 1e-3) continue;
    const p = EMOTION_SPECS[k].pad;
    target[0] += p[0] * v;
    target[1] += p[1] * v;
    target[2] += p[2] * v;
    w += v;
  }
  if (w > 0) for (let i = 0; i < 3; i++) target[i]! /= Math.max(1, w);
  const k = 1 - Math.exp(-dt / 20);
  for (let i = 0; i < 3; i++) s.mood[i] = clampS(s.mood[i]! + (target[i]! - s.mood[i]!) * k);
}

/** Strongest emotion (and its intensity); "contentment" when nothing stands out. */
export function dominant(s: EmotionState): { emotion: Emotion; intensity: number } {
  let best: Emotion = "contentment";
  let v = 0.12;
  for (const k of EMOTIONS)
    if (s.e[k] > v) {
      v = s.e[k];
      best = k;
    }
  return { emotion: best, intensity: v };
}

/** What the needs and feelings ask for next (the behaviour layer picks from it). */
export type Want = "drink" | "rest" | "break" | "celebrate" | "work" | "play";

export function wants(s: EmotionState): Want {
  if (s.needs.thirst > 0.7) return "drink";
  if (s.needs.energy < 0.3) return "rest";
  if (s.e.frustration > 0.75 || s.e.anger > 0.5) return "break";
  if (s.e.joy > 0.55 && s.e.joy + s.e.pride > 1.1) return "celebrate";
  if (s.e.boredom > 0.5 || s.e.amusement > 0.6) return "play";
  return "work";
}

// ── Expression ───────────────────────────────────────────────────

export type MouthShape =
  | "neutral"
  | "smile"
  | "grin"
  | "open"
  | "frown"
  | "flat"
  | "gritted"
  | "smirk"
  | "yawn"
  | "pout";

export const MOUTH_SHAPES: readonly MouthShape[] = [
  "neutral",
  "smile",
  "grin",
  "open",
  "frown",
  "flat",
  "gritted",
  "smirk",
  "yawn",
  "pout",
];

export type EmoteIcon =
  | "!"
  | "?"
  | "heart"
  | "anger"
  | "sweat"
  | "sparkle"
  | "zz"
  | "note"
  | "idea"
  | "dots"
  | "tear";

export interface Expression {
  /** Brow lift −1 furrowed … 1 raised. */
  brows: number;
  /** Brow tilt (rad), sceptical / worried. */
  browTilt: number;
  /** Extra lid closure 0 open … 0.9 nearly shut (tired, content). */
  lids: number;
  mouth: MouthShape;
  /** Head pitch (rad, + = looking down), roll (rad). */
  headPitch: number;
  headRoll: number;
  /** Torso slump 0 upright … 1 deflated; negative = chest out (pride). */
  slump: number;
  /** Nervous / excited micro-movement amplitude 0..1. */
  jitter: number;
  /** Icon above the head (strong emotions), or null. */
  icon: EmoteIcon | null;
}

interface Face {
  brows: number;
  browTilt: number;
  lids: number;
  mouth: MouthShape;
  headPitch: number;
  headRoll: number;
  slump: number;
  jitter: number;
  icon: EmoteIcon | null;
  /** Intensity needed before the icon shows. */
  iconAt: number;
}

const FACES: Readonly<Record<Emotion, Face>> = {
  joy: {
    brows: 0.5,
    browTilt: 0,
    lids: 0.1,
    mouth: "grin",
    headPitch: -0.12,
    headRoll: 0.05,
    slump: -0.2,
    jitter: 0.3,
    icon: "note",
    iconAt: 0.7,
  },
  pride: {
    brows: 0.3,
    browTilt: 0,
    lids: 0.15,
    mouth: "smile",
    headPitch: -0.2,
    headRoll: 0,
    slump: -0.5,
    jitter: 0,
    icon: "sparkle",
    iconAt: 0.55,
  },
  relief: {
    brows: 0.2,
    browTilt: 0,
    lids: 0.35,
    mouth: "smile",
    headPitch: 0.05,
    headRoll: -0.08,
    slump: 0.25,
    jitter: 0,
    icon: null,
    iconAt: 1,
  },
  gratitude: {
    brows: 0.6,
    browTilt: 0,
    lids: 0.2,
    mouth: "grin",
    headPitch: 0.1,
    headRoll: 0.12,
    slump: 0,
    jitter: 0.1,
    icon: "heart",
    iconAt: 0.45,
  },
  amusement: {
    brows: 0.4,
    browTilt: 0.1,
    lids: 0.3,
    mouth: "grin",
    headPitch: -0.05,
    headRoll: 0.15,
    slump: 0,
    jitter: 0.35,
    icon: "note",
    iconAt: 0.75,
  },
  interest: {
    brows: 0.45,
    browTilt: 0.08,
    lids: 0,
    mouth: "neutral",
    headPitch: 0.05,
    headRoll: 0.1,
    slump: -0.1,
    jitter: 0,
    icon: "?",
    iconAt: 0.8,
  },
  focus: {
    brows: -0.35,
    browTilt: 0,
    lids: 0.2,
    mouth: "flat",
    headPitch: 0.18,
    headRoll: 0,
    slump: 0.05,
    jitter: 0,
    icon: null,
    iconAt: 1,
  },
  surprise: {
    brows: 1,
    browTilt: 0,
    lids: -0.3,
    mouth: "open",
    headPitch: -0.12,
    headRoll: 0,
    slump: -0.2,
    jitter: 0.2,
    icon: "!",
    iconAt: 0.45,
  },
  frustration: {
    brows: -0.8,
    browTilt: 0.15,
    lids: 0.25,
    mouth: "gritted",
    headPitch: 0.12,
    headRoll: -0.05,
    slump: 0.2,
    jitter: 0.25,
    icon: "sweat",
    iconAt: 0.55,
  },
  anger: {
    brows: -1,
    browTilt: 0,
    lids: 0.3,
    mouth: "gritted",
    headPitch: 0.15,
    headRoll: 0,
    slump: -0.3,
    jitter: 0.5,
    icon: "anger",
    iconAt: 0.45,
  },
  sadness: {
    brows: 0.2,
    browTilt: -0.3,
    lids: 0.45,
    mouth: "frown",
    headPitch: 0.3,
    headRoll: 0.1,
    slump: 0.7,
    jitter: 0,
    icon: "tear",
    iconAt: 0.65,
  },
  fear: {
    brows: 0.8,
    browTilt: -0.2,
    lids: -0.2,
    mouth: "open",
    headPitch: 0.05,
    headRoll: 0,
    slump: 0.3,
    jitter: 0.7,
    icon: "!",
    iconAt: 0.6,
  },
  boredom: {
    brows: -0.1,
    browTilt: 0,
    lids: 0.5,
    mouth: "pout",
    headPitch: 0.15,
    headRoll: 0.25,
    slump: 0.5,
    jitter: 0,
    icon: "dots",
    iconAt: 0.6,
  },
  fatigue: {
    brows: -0.1,
    browTilt: -0.1,
    lids: 0.6,
    mouth: "neutral",
    headPitch: 0.22,
    headRoll: 0.08,
    slump: 0.6,
    jitter: 0,
    icon: "zz",
    iconAt: 0.75,
  },
  contentment: {
    brows: 0.1,
    browTilt: 0,
    lids: 0.25,
    mouth: "smile",
    headPitch: 0,
    headRoll: 0.04,
    slump: 0,
    jitter: 0,
    icon: null,
    iconAt: 1,
  },
};

/**
 * Face and posture for the current state: the dominant emotion sets the
 * mouth and icon, the top two blend the continuous parameters, the mood
 * tints the baseline (a slight smile when things go well).
 */
export function expression(s: EmotionState): Expression {
  const ranked = [...EMOTIONS].sort((a, b) => s.e[b] - s.e[a]);
  const a = ranked[0]!;
  const b = ranked[1]!;
  const va = s.e[a];
  const vb = s.e[b];
  const top = va < 0.12 ? "contentment" : a;
  const fa = FACES[top];
  const fb = FACES[b];
  const wa = va < 0.12 ? 0.3 : Math.min(1, va);
  const wb = Math.min(1, vb) * 0.5;
  const mix = (ka: number, kb: number) =>
    ((ka * wa + kb * wb) / Math.max(1e-6, wa + wb)) * Math.min(1, wa + wb);
  const moodP = s.mood[0];
  let mouth = fa.mouth;
  if (mouth === "neutral" && moodP > 0.35) mouth = "smile";
  if (mouth === "neutral" && moodP < -0.35) mouth = "flat";
  if (top === "fatigue" && s.needs.energy < 0.15) mouth = "yawn";
  return {
    brows: mix(fa.brows, fb.brows) + moodP * 0.1,
    browTilt: mix(fa.browTilt, fb.browTilt),
    lids: Math.max(-0.3, Math.min(0.9, mix(fa.lids, fb.lids) + s.e.fatigue * 0.25)),
    mouth,
    headPitch: mix(fa.headPitch, fb.headPitch) + s.e.fatigue * 0.1,
    headRoll: mix(fa.headRoll, fb.headRoll),
    slump: mix(fa.slump, fb.slump) + s.e.fatigue * 0.3 - Math.max(0, s.mood[2]) * 0.1,
    jitter: mix(fa.jitter, fb.jitter) * (0.5 + Math.max(0, s.mood[1]) * 0.5),
    icon: va >= fa.iconAt ? fa.icon : null,
  };
}

// ── Mouth shapes (voxel overlays for the head's mouth area) ──────

/**
 * 6 × 3 voxel mouth overlays for Jade's head (columns x 4..9, rows y 4..2,
 * front face). `.` skin, `M` lips, `d` dark mouth, `W` teeth.
 */
export const MOUTH_ART: Readonly<Record<MouthShape, readonly [string, string, string]>> = {
  neutral: ["sMMMMs", ".lMMl.", "......"],
  smile: ["M....M", ".MMMM.", "......"],
  grin: ["MWWWWM", ".MddM.", "..MM.."],
  open: ["..MM..", ".MddM.", "..MM.."],
  frown: [".MMMM.", "M....M", "......"],
  flat: ["......", "MMMMMM", "......"],
  gritted: ["MMMMMM", "WdWdWW", "MMMMMM"],
  smirk: [".....M", "MMMMM.", "......"],
  yawn: [".MddM.", "MddddM", ".MddM."],
  pout: ["......", "..MM..", "..MM.."],
};

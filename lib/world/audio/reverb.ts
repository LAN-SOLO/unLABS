/**
 * Room reverb.
 * ============
 *
 * One shared reverb on a send: sfx, voice and (a little) ambience feed
 * `RoomReverb.input`, the wet signal returns to the master bus. The size
 * depends on the room: `reverbFor()` buckets the floor area (w × d voxels)
 * and nudges it by theme — soft rooms (quarters, office, archive, studio)
 * stay dry, halls, caves and the elevator shafts ring.
 *
 * With a `ConvolverNode` the tail is a generated impulse response
 * (decaying, progressively darker noise; cached per size). Without one
 * (old browsers, test fakes) a small feedback-delay network stands in.
 * Changing rooms crossfades between the old and the new tail; the old
 * stage is disconnected once its tail has died away.
 */
import { clamp, mulberry32 } from "@/lib/world/audio/synth";

export const REVERB_SIZES = ["dry", "small", "medium", "large", "huge"] as const;
export type ReverbSize = (typeof REVERB_SIZES)[number];

export interface ReverbSpec {
  size: ReverbSize;
  /** Return level of the wet signal (0..1). */
  wet: number;
  /** RT60-ish tail length in seconds. */
  decay: number;
  /** Seconds before the first reflection. */
  preDelay: number;
  /** Lowpass of the tail in Hz (bigger rooms are darker). */
  damp: number;
}

const SPECS: Record<ReverbSize, Omit<ReverbSpec, "size">> = {
  dry: { wet: 0.05, decay: 0.35, preDelay: 0.004, damp: 5200 },
  small: { wet: 0.1, decay: 0.6, preDelay: 0.008, damp: 4600 },
  medium: { wet: 0.17, decay: 1.1, preDelay: 0.014, damp: 4000 },
  large: { wet: 0.26, decay: 1.9, preDelay: 0.024, damp: 3300 },
  huge: { wet: 0.36, decay: 3.2, preDelay: 0.04, damp: 2600 },
};

/** Soft furnishing: one step drier. */
const ABSORBENT = new Set(["quarters", "office", "archive", "audio", "greenhouse", "kantine"]);
/** Hard, tall or cavernous: one step wetter. */
const REFLECTIVE = new Set([
  "geothermal",
  "hangar",
  "forge",
  "anomaly",
  "reactor",
  "portal",
  "containment",
  "observatory",
  "vault",
]);
/** Vertical shafts: always at least "large". */
const SHAFTS = new Set(["elevator", "shaft"]);

/** Size bucket for a floor area in voxels² (rooms span roughly 300..2500). */
export function sizeForArea(area: number): number {
  if (!(area > 0)) return 1;
  if (area < 500) return 1;
  if (area < 1000) return 2;
  if (area < 1600) return 3;
  return 4;
}

export interface ReverbRoom {
  w: number;
  d: number;
  theme?: string;
}

/** Reverb for a room (null / unknown → a neutral medium room). */
export function reverbFor(room: ReverbRoom | null | undefined): ReverbSpec {
  if (!room) return { size: "medium", ...SPECS.medium };
  let idx = sizeForArea(room.w * room.d);
  const theme = room.theme ?? "";
  if (ABSORBENT.has(theme)) idx -= 1;
  if (REFLECTIVE.has(theme)) idx += 1;
  if (SHAFTS.has(theme)) idx = Math.max(idx, 3);
  const size = REVERB_SIZES[clamp(idx, 0, REVERB_SIZES.length - 1)]!;
  return { size, ...SPECS[size] };
}

/**
 * Impulse response samples for one channel: exponentially decaying noise
 * (−60 dB at `decay`) run through a one-pole lowpass that closes over time
 * so the tail gets darker. Pure and deterministic per seed.
 */
export function impulseSamples(
  sampleRate: number,
  decay: number,
  damp: number,
  seed = 1,
): Float32Array {
  const len = Math.max(1, Math.floor(sampleRate * Math.max(0.05, decay)));
  const out = new Float32Array(len);
  const rng = mulberry32(seed);
  // Start fairly open, end at `damp`.
  const aStart = clamp((2 * Math.PI * Math.min(12000, sampleRate / 2.2)) / sampleRate, 0, 1);
  const aEnd = clamp((2 * Math.PI * damp) / sampleRate, 0.001, 1);
  let y = 0;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const env = Math.exp(-6.9 * t);
    const a = aStart + (aEnd - aStart) * Math.min(1, t * 2);
    const x = (rng() * 2 - 1) * env;
    y += a * (x - y);
    out[i] = y;
  }
  // Short fade-in avoids a click on the direct path.
  const fade = Math.min(len, Math.floor(sampleRate * 0.002));
  for (let i = 0; i < fade; i++) out[i]! *= i / fade;
  return out;
}

interface Stage {
  nodes: AudioNode[];
  gain: GainNode;
}

const XFADE = 0.6;

export class RoomReverb {
  /** Connect sends here. */
  readonly input: GainNode;
  private readonly out: GainNode;
  private readonly pre: DelayNode;
  private stage: Stage | null = null;
  private spec: ReverbSpec | null = null;
  private readonly irCache = new Map<ReverbSize, AudioBuffer>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private disposed = false;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
  ) {
    this.input = ctx.createGain();
    this.pre = ctx.createDelay(0.2);
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.input.connect(this.pre);
    this.out.connect(destination);
  }

  get current(): ReverbSpec | null {
    return this.spec;
  }

  /** True when a real convolver is used (false → feedback-delay fallback). */
  get convolution(): boolean {
    return typeof this.ctx.createConvolver === "function";
  }

  set(spec: ReverbSpec): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    this.pre.delayTime.setTargetAtTime(spec.preDelay, now, 0.1);
    this.out.gain.setTargetAtTime(spec.wet, now, 0.3);
    const prev = this.spec;
    this.spec = { ...spec };
    if (prev && prev.size === spec.size && this.stage) return;
    const next = this.buildStage(spec);
    next.gain.gain.setValueAtTime(0.0001, now);
    next.gain.gain.exponentialRampToValueAtTime(1, now + XFADE);
    const old = this.stage;
    this.stage = next;
    if (old) this.retire(old, now, prev?.decay ?? 3);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    if (this.stage) this.stage.nodes.forEach((n) => n.disconnect());
    this.stage = null;
    this.input.disconnect();
    this.pre.disconnect();
    this.out.disconnect();
  }

  private retire(stage: Stage, now: number, decay: number): void {
    stage.gain.gain.cancelScheduledValues(now);
    stage.gain.gain.setValueAtTime(Math.max(0.0001, stage.gain.gain.value), now);
    stage.gain.gain.exponentialRampToValueAtTime(0.0001, now + XFADE);
    // Cut the input right away; let the tail ring out, then free the nodes.
    const head = stage.nodes[0];
    if (head) {
      try {
        this.pre.disconnect(head);
      } catch {
        /* not connected */
      }
    }
    const id = setTimeout(
      () => {
        this.timers.delete(id);
        stage.nodes.forEach((n) => n.disconnect());
      },
      (XFADE + decay + 0.2) * 1000,
    );
    this.timers.add(id);
  }

  private impulse(spec: ReverbSpec): AudioBuffer {
    const cached = this.irCache.get(spec.size);
    if (cached) return cached;
    const sr = this.ctx.sampleRate;
    const left = impulseSamples(sr, spec.decay, spec.damp, 11);
    const right = impulseSamples(sr, spec.decay, spec.damp, 23);
    const buf = this.ctx.createBuffer(2, left.length, sr);
    buf.getChannelData(0).set(left);
    buf.getChannelData(1).set(right);
    this.irCache.set(spec.size, buf);
    return buf;
  }

  private buildStage(spec: ReverbSpec): Stage {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.connect(this.out);
    if (typeof ctx.createConvolver === "function") {
      const conv = ctx.createConvolver();
      conv.normalize = true;
      conv.buffer = this.impulse(spec);
      this.pre.connect(conv);
      conv.connect(gain);
      return { nodes: [conv, gain], gain };
    }
    // Fallback: two damped feedback combs in parallel (Schroeder-ish).
    const nodes: AudioNode[] = [];
    const split = ctx.createGain();
    this.pre.connect(split);
    nodes.push(split);
    const scale = 0.6 + spec.decay * 0.25;
    for (const base of [0.0297, 0.0371, 0.0411]) {
      const delay = ctx.createDelay(1);
      const time = base * scale;
      delay.delayTime.value = time;
      const fb = ctx.createGain();
      // Feedback for −60 dB after `decay` seconds.
      fb.gain.value = clamp(Math.pow(10, (-3 * time) / Math.max(0.1, spec.decay)), 0, 0.93);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = spec.damp;
      split.connect(delay);
      delay.connect(lp).connect(fb).connect(delay);
      lp.connect(gain);
      nodes.push(delay, fb, lp);
    }
    nodes.push(gain);
    return { nodes, gain };
  }
}

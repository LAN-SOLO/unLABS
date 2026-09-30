/**
 * Web Audio implementation of `SynthTarget`.
 * ==========================================
 *
 * Every tone / noise burst becomes a short-lived node chain
 * (source → [filter] → envelope → out) that disconnects itself when done.
 */
import type { NoiseSpec, SynthTarget, ToneSpec } from "@/lib/world/audio/synth";

const MIN = 0.0001;

/** Two seconds of white noise, shared by every noise source. */
export function createNoiseBuffer(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 0x9e3779b9;
  for (let i = 0; i < len; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return buf;
}

/** Tracks live sources so bursts can be capped (keeps CPU light). */
export class VoiceCounter {
  active = 0;
  constructor(readonly limit: number) {}
  get full(): boolean {
    return this.active >= this.limit;
  }
}

export class WebAudioTarget implements SynthTarget {
  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
    private readonly noiseBuf: AudioBuffer,
    private readonly t0: number,
    private readonly pitch = 1,
    private readonly gainMul = 1,
    private readonly counter?: VoiceCounter,
    private readonly rng: () => number = Math.random,
  ) {}

  rand(): number {
    return this.rng();
  }

  private envelope(
    start: number,
    dur: number,
    peak: number,
    attack: number,
    release: number,
  ): GainNode {
    const g = this.ctx.createGain();
    const p = Math.max(MIN, peak * this.gainMul);
    g.gain.setValueAtTime(MIN, start);
    g.gain.exponentialRampToValueAtTime(p, start + Math.max(0.001, attack));
    const holdEnd = Math.max(start + attack, start + dur);
    g.gain.setValueAtTime(p, holdEnd);
    g.gain.exponentialRampToValueAtTime(MIN, holdEnd + Math.max(0.01, release));
    return g;
  }

  /** Output for one sound: a stereo panner when `pan` is set and supported. */
  private pan(pan: number | undefined, nodes: AudioNode[]): AudioNode {
    if (!pan || typeof this.ctx.createStereoPanner !== "function") return this.out;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.out);
    nodes.push(p);
    return p;
  }

  private track(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    if (this.counter) this.counter.active++;
    src.onended = () => {
      if (this.counter) this.counter.active = Math.max(0, this.counter.active - 1);
      for (const n of nodes) n.disconnect();
    };
  }

  tone(s: ToneSpec): void {
    if (this.counter?.full) return;
    const start = this.t0 + (s.at ?? 0);
    const attack = s.attack ?? 0.005;
    const release = s.release ?? 0.05;
    const osc = this.ctx.createOscillator();
    osc.type = s.wave;
    osc.frequency.setValueAtTime(Math.max(1, s.freq * this.pitch), start);
    if (s.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, s.freqEnd * this.pitch),
        start + s.dur,
      );
    }
    if (s.detune) osc.detune.setValueAtTime(s.detune, start);
    const nodes: AudioNode[] = [osc];
    let lfo: OscillatorNode | null = null;
    if (s.vibrato) {
      lfo = this.ctx.createOscillator();
      lfo.frequency.value = s.vibrato.rate;
      const depth = this.ctx.createGain();
      depth.gain.value = s.vibrato.depth * this.pitch;
      lfo.connect(depth).connect(osc.frequency);
      nodes.push(lfo, depth);
    }
    const env = this.envelope(start, s.dur, s.gain, attack, release);
    nodes.push(env);
    let head: AudioNode = osc;
    if (s.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = s.filter.type;
      f.frequency.value = s.filter.freq;
      if (s.filter.freqEnd !== undefined) {
        f.frequency.setValueAtTime(s.filter.freq, start);
        f.frequency.exponentialRampToValueAtTime(
          Math.max(20, s.filter.freqEnd),
          start + Math.max(0.01, s.dur),
        );
      }
      f.Q.value = s.filter.q ?? 0.7;
      head.connect(f);
      head = f;
      nodes.push(f);
    }
    head.connect(env).connect(this.pan(s.pan, nodes));
    const stop = start + Math.max(s.dur, attack) + release + 0.05;
    osc.start(start);
    osc.stop(stop);
    if (lfo) {
      lfo.start(start);
      lfo.stop(stop);
    }
    this.track(osc, nodes);
  }

  noise(s: NoiseSpec): void {
    if (this.counter?.full) return;
    const start = this.t0 + (s.at ?? 0);
    const attack = s.attack ?? 0.003;
    const release = s.release ?? 0.04;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = s.filter;
    f.frequency.setValueAtTime(s.freq, start);
    if (s.freqEnd !== undefined) {
      f.frequency.exponentialRampToValueAtTime(Math.max(10, s.freqEnd), start + s.dur);
    }
    f.Q.value = s.q ?? 0.8;
    const env = this.envelope(start, s.dur, s.gain, attack, release);
    const extra: AudioNode[] = [];
    src.connect(f).connect(env).connect(this.pan(s.pan, extra));
    src.start(start, this.rng() * Math.max(0, this.noiseBuf.duration - 0.5));
    src.stop(start + Math.max(s.dur, attack) + release + 0.05);
    this.track(src, [src, f, env, ...extra]);
  }
}

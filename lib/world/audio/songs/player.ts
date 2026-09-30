/**
 * SongPlayer — schedules one song bar by bar on Web Audio.
 * ========================================================
 *
 * Each part (lead, counter, bell, arp, pad, bass, drums) has its own
 * channel (gain → song out, plus echo / hall sends), so the studio mixer
 * can ride faders and mute parts while the game keeps playing. Bars are
 * rendered by the pure arranger into `WebAudioTarget`s shortly before they
 * are due (`tick(horizon)`), so a song costs only a few nodes per note.
 */
import { WebAudioTarget, type VoiceCounter } from "@/lib/world/audio/webaudio";
import { mulberry32 } from "@/lib/world/audio/synth";
import {
  renderBar,
  songPlan,
  type PartTargets,
  type SongPlan,
  type VaryKind,
} from "@/lib/world/audio/songs/arrange";
import type { SongLength } from "@/lib/world/audio/songs/styles";
import { ECHO_SEND, HALL_SEND } from "@/lib/world/audio/songs/offline";
import { songGain } from "@/lib/world/audio/songs/level";
import { PARTS, type InstrumentId, type Part, type SongDef } from "@/lib/world/audio/songs/types";

export interface PartChannel {
  gain: GainNode;
  nodes: AudioNode[];
}

export interface SongPlayerOptions {
  noise: AudioBuffer;
  /** Echo input (dotted-eighth delay of the music bus). */
  echo?: AudioNode;
  /** Hall input (convolver of the music bus). */
  hall?: AudioNode;
  counter?: VoiceCounter;
  /** Fader levels 0..1 per part (studio mixer). */
  levels?: Partial<Record<Part, number>>;
  seed?: number;
  /** Lead instrument override (studio). */
  lead?: InstrumentId;
  /** Arrangement length (setting `audio.songLength`; default the composed form). */
  length?: SongLength;
}

export class SongPlayer {
  readonly song: SongDef;
  private readonly out: GainNode;
  private readonly parts: Record<Part, PartChannel>;
  private bar: number;
  private nextTime: number;
  private readonly startTime: number;
  private readonly startBar: number;
  private stopped = false;
  private readonly seed: number;
  private lead: InstrumentId | undefined;
  readonly length: SongLength;
  /** Bars skipped because the scheduler fell behind (tab throttled / context stalled). */
  skippedBars = 0;
  /** Loop the song instead of ending (jukebox repeat). */
  loop = false;

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    song: SongDef,
    private readonly opts: SongPlayerOptions,
    at = ctx.currentTime + 0.05,
    fromBar = 0,
    fadeIn = 0,
  ) {
    this.song = song;
    this.seed = opts.seed ?? 0;
    this.lead = opts.lead;
    this.length = opts.length ?? "standard";
    this.out = ctx.createGain();
    // Even out loudness between songs and genres (measured table).
    const level = songGain(song);
    if (fadeIn > 0) {
      this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.out.gain.exponentialRampToValueAtTime(level, at + fadeIn);
    } else {
      this.out.gain.value = level;
    }
    this.out.connect(destination);
    const parts = {} as Record<Part, PartChannel>;
    for (const p of PARTS) {
      const gain = ctx.createGain();
      gain.gain.value = opts.levels?.[p] ?? 1;
      gain.connect(this.out);
      const nodes: AudioNode[] = [gain];
      if (opts.echo && ECHO_SEND[p] > 0) {
        const s = ctx.createGain();
        s.gain.value = ECHO_SEND[p];
        gain.connect(s).connect(opts.echo);
        nodes.push(s);
      }
      if (opts.hall && HALL_SEND[p] > 0) {
        const s = ctx.createGain();
        s.gain.value = HALL_SEND[p];
        gain.connect(s).connect(opts.hall);
        nodes.push(s);
      }
      parts[p] = { gain, nodes };
    }
    this.parts = parts;
    this.bar = fromBar;
    this.startBar = fromBar;
    this.nextTime = at;
    this.startTime = at;
  }

  get plan(): SongPlan {
    return songPlan(this.song, this.length);
  }

  /** All bars scheduled (and not looping). */
  get finishedScheduling(): boolean {
    return !this.loop && this.bar >= this.plan.bars.length;
  }

  /** Audio time when the last scheduled bar ends. */
  get endTime(): number {
    return this.nextTime;
  }

  /** Seconds into the song and its length (for the studio / now playing). */
  position(now: number): { bar: number; seconds: number; total: number; pass: VaryKind | null } {
    const plan = this.plan;
    const seconds = Math.max(0, now - this.startTime) + this.startBar * plan.barSeconds;
    const total = plan.totalSeconds;
    const s = this.loop ? seconds % total : Math.min(seconds, total);
    const bar = Math.min(plan.bars.length - 1, Math.floor(s / plan.barSeconds));
    return { bar, seconds: s, total, pass: plan.bars[bar]?.vary?.kind ?? null };
  }

  setLevel(part: Part, v: number): void {
    const g = this.parts[part].gain.gain;
    g.setTargetAtTime(Math.max(0, Math.min(1.5, v)), this.ctx.currentTime, 0.05);
  }

  setLead(inst: InstrumentId | undefined): void {
    this.lead = inst;
  }

  /** Schedule every bar that starts before `horizon` (audio time). */
  tick(horizon: number): void {
    if (this.stopped) return;
    const plan = this.plan;
    const n = plan.bars.length;
    // Fell behind (throttled timers, a stalled context): skip the bars that are
    // already over instead of firing them all at once, and rejoin at the next
    // bar line. A song that ran out meanwhile simply ends (the caller moves on).
    const now = this.ctx.currentTime;
    while (this.nextTime < now - 0.05 && (this.loop || this.bar < n)) {
      if (this.bar >= n) this.bar = 0;
      this.bar++;
      this.nextTime += plan.barSeconds;
      this.skippedBars++;
    }
    while (this.nextTime < horizon) {
      if (this.bar >= n) {
        if (!this.loop) return;
        this.bar = 0;
      }
      const t0 = this.nextTime;
      const rng = mulberry32((this.bar + 1) * 7919 + this.seed);
      const targets: PartTargets = {};
      for (const p of PARTS) {
        targets[p] = new WebAudioTarget(
          this.ctx,
          this.parts[p].gain,
          this.opts.noise,
          t0,
          1,
          1,
          this.opts.counter,
          rng,
        );
      }
      renderBar(this.song, this.bar, targets, {
        seed: this.seed,
        length: this.length,
        ...(this.lead ? { lead: this.lead } : {}),
      });
      this.bar++;
      this.nextTime += plan.barSeconds;
    }
  }

  /** Fade out and free the channels afterwards. */
  stop(fade = 2.5): void {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.ctx.currentTime;
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value || 1), now);
    g.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fade));
    // Notes already scheduled ring out; free the graph once they are done.
    setTimeout(() => this.dispose(), (Math.max(fade, this.nextTime - now) + 4) * 1000);
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  dispose(): void {
    this.stopped = true;
    for (const p of PARTS) for (const n of this.parts[p].nodes) n.disconnect();
    this.out.disconnect();
  }
}

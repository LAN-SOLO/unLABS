/**
 * CameraDirector — cinematic camera shots for the lab engine.
 * ===========================================================
 *
 * Pure math (no three import) so it runs in tests. The director owns a
 * queue of shots; while it plays, `update(dt)` returns the pose the
 * engine should use instead of following the player, plus letterbox and
 * fade amounts for the overlay. When idle it returns `null` and the
 * engine's own smoothing brings the camera back to the player.
 *
 * Poses use the engine's parameters: `target` (look-at point), `zoom`
 * (visible world height of the orthographic camera) and `yaw`.
 */

export type EaseName = "linear" | "in" | "out" | "inOut" | "smooth";

export const EASE: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  smooth: (t) => t * t * (3 - 2 * t),
};

export interface CameraShot {
  target: readonly [number, number, number];
  zoom: number;
  /** Absolute yaw in radians; omitted = keep the current yaw. */
  yaw?: number;
  /** Seconds to move from the previous pose (0 = cut). */
  duration: number;
  ease?: EaseName;
  /** Seconds to hold after arriving. */
  hold?: number;
  /** Fade (0 clear .. 1 black) reached at the end of the move. */
  fade?: number;
  /** Letterbox amount while this shot plays (default 1). */
  letterbox?: number;
}

export interface CameraPose {
  target: [number, number, number];
  zoom: number;
  yaw: number;
}

export interface DirectorFrame extends CameraPose {
  /** 0..1 — bar height factor for the cinematic bars. */
  letterbox: number;
  /** 0..1 — black overlay opacity. */
  fade: number;
  /**
   * True while a session is active: the engine should use target/zoom/yaw.
   * False while only the letterbox/fade are easing out (or a kept fade):
   * apply the overlay but let the camera follow the player again.
   */
  controlsCamera: boolean;
}

const LETTERBOX_SPEED = 1 / 0.6;
const FADE_OUT_SPEED = 1 / 0.8;

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Interpolate yaw along the shortest arc. */
export function lerpAngle(a: number, b: number, k: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/** Total playing time of a shot list. */
export function shotsDuration(shots: readonly CameraShot[]): number {
  return shots.reduce((t, s) => t + Math.max(0, s.duration) + Math.max(0, s.hold ?? 0), 0);
}

function approach(v: number, goal: number, step: number): number {
  return v < goal ? Math.min(goal, v + step) : Math.max(goal, v - step);
}

export class CameraDirector {
  private pose: CameraPose = { target: [0, 0, 0], zoom: 46, yaw: Math.PI / 4 };
  private from: CameraPose = { target: [0, 0, 0], zoom: 46, yaw: Math.PI / 4 };
  private fromFade = 0;
  private readonly queue: CameraShot[] = [];
  private shot: CameraShot | null = null;
  private t = 0;
  private active = false;
  private autoEnd = false;
  private keepFade = false;
  private letterbox = 0;
  private letterboxGoal = 0;
  private fade = 0;
  private onDone: (() => void) | null = null;
  private fadeGoal: number | null = null;
  private fadeSpeed = 0;

  /** A session is running (shots queued / holding). */
  get isPlaying(): boolean {
    return this.active;
  }

  /** Still producing frames (playing or easing letterbox/fade out). */
  get isVisible(): boolean {
    return this.active || this.letterbox > 0 || this.fade > 0;
  }

  get current(): Readonly<CameraPose> {
    return this.pose;
  }

  /**
   * Start a session from the engine's current camera pose. Shots added
   * with `enqueue()` play in order; the last shot holds until `end()`.
   */
  begin(from: CameraPose, fade = this.fade): void {
    this.pose = clonePose(from);
    this.from = clonePose(from);
    this.fade = fade;
    this.fromFade = fade;
    this.active = true;
    this.autoEnd = false;
    this.keepFade = false;
    this.letterboxGoal = 1;
  }

  enqueue(shots: readonly CameraShot[]): void {
    if (!this.active) {
      const first = shots[0];
      if (!first) return;
      this.begin({ target: [...first.target], zoom: first.zoom, yaw: first.yaw ?? this.pose.yaw });
    }
    this.queue.push(...shots);
  }

  /**
   * One-shot convenience: begin, play all shots, end automatically and
   * call `onDone`. Without `from` the first shot is a cut.
   */
  play(shots: readonly CameraShot[], onDone?: () => void, from?: CameraPose): void {
    const first = shots[0];
    const start: CameraPose =
      from ??
      (first
        ? { target: [...first.target], zoom: first.zoom, yaw: first.yaw ?? this.pose.yaw }
        : clonePose(this.pose));
    this.queue.length = 0;
    this.shot = null;
    this.begin(start);
    this.queue.push(...shots);
    this.autoEnd = true;
    this.onDone = onDone ?? null;
  }

  /** Fade to `value` over `seconds` independently of shots. */
  fadeTo(value: number, seconds: number): void {
    this.enqueueFade(value, seconds);
  }

  /** Finish the session: letterbox (and fade unless kept) ease out. */
  end(keepFade = false): void {
    this.active = false;
    this.queue.length = 0;
    this.shot = null;
    this.letterboxGoal = 0;
    this.keepFade = keepFade;
    if (!keepFade) this.fadeGoal = null;
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  /** Jump to the final pose of all pending shots and end. */
  skip(): void {
    if (!this.active) return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.shot;
    if (last) {
      this.pose = {
        target: [...last.target],
        zoom: last.zoom,
        yaw: last.yaw ?? this.pose.yaw,
      };
    }
    this.end(false);
  }

  /** Advance. Returns the pose to render, or null when idle. */
  update(dt: number): DirectorFrame | null {
    if (!this.isVisible && this.fadeGoal === null) return null;
    let left = Math.max(0, dt);
    // Consume shots; leftover time flows into the next one.
    for (let guard = 0; this.active && guard < 64; guard++) {
      if (!this.shot) {
        const next = this.queue.shift();
        if (!next) {
          if (this.autoEnd) this.end(false);
          break;
        }
        this.shot = next;
        this.t = 0;
        this.from = clonePose(this.pose);
        this.fromFade = this.fade;
      }
      const s = this.shot;
      const dur = Math.max(0, s.duration);
      const total = dur + Math.max(0, s.hold ?? 0);
      const step = Math.min(left, total - this.t);
      this.t += step;
      left -= step;
      const k = dur <= 0 ? 1 : EASE[s.ease ?? "inOut"](Math.min(1, this.t / dur));
      this.pose.target = [
        lerp(this.from.target[0], s.target[0], k),
        lerp(this.from.target[1], s.target[1], k),
        lerp(this.from.target[2], s.target[2], k),
      ];
      this.pose.zoom = lerp(this.from.zoom, s.zoom, k);
      if (s.yaw !== undefined) this.pose.yaw = lerpAngle(this.from.yaw, s.yaw, k);
      if (s.fade !== undefined) this.fade = lerp(this.fromFade, s.fade, k);
      this.letterboxGoal = s.letterbox ?? 1;
      if (this.t >= total - 1e-9) {
        // Keep holding the final shot of a manual session.
        if (this.queue.length === 0 && !this.autoEnd) break;
        this.shot = null;
        if (left <= 0 && this.queue.length > 0) break;
      } else break;
    }
    this.letterbox = approach(this.letterbox, this.letterboxGoal, dt * LETTERBOX_SPEED);
    if (!this.active && !this.keepFade) this.fade = approach(this.fade, 0, dt * FADE_OUT_SPEED);
    this.stepFade(dt);
    return {
      target: [...this.pose.target],
      zoom: this.pose.zoom,
      yaw: this.pose.yaw,
      letterbox: this.letterbox,
      fade: this.fade,
      controlsCamera: this.active,
    };
  }

  // Independent fades (fadeTo) — applied on top of shot fades.
  private enqueueFade(value: number, seconds: number): void {
    this.fadeGoal = Math.min(1, Math.max(0, value));
    this.fadeSpeed = seconds <= 0 ? Infinity : Math.abs(this.fadeGoal - this.fade) / seconds;
    if (seconds <= 0) {
      this.fade = this.fadeGoal;
      this.fadeGoal = null;
    }
    if (this.fade > 0 || (this.fadeGoal ?? 0) > 0) this.keepFade = true;
  }

  private stepFade(dt: number): void {
    if (this.fadeGoal === null) return;
    this.fade = approach(this.fade, this.fadeGoal, dt * this.fadeSpeed);
    if (this.fade === this.fadeGoal) {
      if (this.fadeGoal === 0) this.keepFade = false;
      this.fadeGoal = null;
    }
  }
}

function clonePose(p: CameraPose): CameraPose {
  return { target: [p.target[0], p.target[1], p.target[2]], zoom: p.zoom, yaw: p.yaw };
}

/**
 * Tiny screen shake. `add()` stacks trauma; `update(dt)` returns an
 * offset in world units along the camera's screen axes [right, up].
 */
export class ScreenShake {
  private trauma = 0;
  private time = 0;

  constructor(
    /** Max offset in world units at full trauma. */
    readonly amplitude = 1.2,
    /** Trauma decay per second. */
    readonly decay = 1.6,
  ) {}

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  get active(): boolean {
    return this.trauma > 0;
  }

  update(dt: number): [number, number] {
    if (this.trauma <= 0) return [0, 0];
    this.time += dt;
    const k = this.trauma * this.trauma * this.amplitude;
    this.trauma = Math.max(0, this.trauma - dt * this.decay);
    const t = this.time * 38;
    return [
      k * (Math.sin(t) * 0.6 + Math.sin(t * 2.31 + 1.7) * 0.4),
      k * (Math.sin(t * 1.13 + 4.2) * 0.6 + Math.sin(t * 2.77) * 0.4),
    ];
  }
}

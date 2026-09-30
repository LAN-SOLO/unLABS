/**
 * Footstep timing from walked distance.
 * =====================================
 *
 * Feed the per-frame horizontal distance of the walker; it reports when a
 * foot lands (every `stride` voxels, alternating left/right). Pure.
 */
export class FootstepClock {
  private acc = 0;
  private foot: 0 | 1 = 0;

  constructor(readonly stride = 1.7) {}

  /**
   * Advance by `distance` voxels. Returns the foot that landed (0 = left,
   * 1 = right) or null. Standing still resets so the first step after
   * stopping lands quickly.
   */
  update(distance: number): 0 | 1 | null {
    if (!(distance > 0.0005)) {
      this.acc = this.stride * 0.6;
      return null;
    }
    this.acc += distance;
    if (this.acc < this.stride) return null;
    this.acc -= this.stride;
    if (this.acc > this.stride) this.acc = 0;
    this.foot = this.foot === 0 ? 1 : 0;
    return this.foot;
  }
}

/** Seconds between steps at the normal walking speed (stride 1.7 / ~6.5 u/s). */
export const NOMINAL_STEP_INTERVAL = 0.27;

export interface StepEvent {
  kind: "step" | "scuff" | "land";
  foot: 0 | 1;
  /** 1 = normal walk, < 1 slower, > 1.3 running. */
  pace: number;
  /** Expected seconds to the next step. */
  interval: number;
  /** Running step counter (motion layers sound on every n-th step). */
  index: number;
}

/**
 * Turns raw footfalls (time + position) into step events: alternating feet,
 * pace from the cadence, a scuff when the path turns sharply, a landing on
 * the first step after a floor change, and a `stop` once steps cease. Pure
 * (times in seconds are passed in), so the director stays thin and tests can
 * drive it.
 */
export class StepTracker {
  private lastAt = -Infinity;
  private lastPos: [number, number] | null = null;
  private lastDir: [number, number] | null = null;
  private interval = NOMINAL_STEP_INTERVAL;
  private foot: 0 | 1 = 1;
  private index = 0;
  private landPending = false;
  private stopArmed = false;
  private lastPace = 1;

  /** The next step lands after a ladder / elevator ride or a fall. */
  landNext(): void {
    this.landPending = true;
  }

  /** A foot landed at `now` (seconds) at (x, z): the events to play. */
  step(now: number, x: number, z: number): StepEvent[] {
    const dt = now - this.lastAt;
    const fresh = !(dt < 1.2);
    // Cadence: smoothed interval (fresh starts use the nominal one).
    this.interval = fresh
      ? NOMINAL_STEP_INTERVAL
      : this.interval * 0.6 + Math.max(0.08, Math.min(0.9, dt)) * 0.4;
    const pace = Math.max(0.4, Math.min(2, NOMINAL_STEP_INTERVAL / this.interval));
    this.foot = this.foot === 0 ? 1 : 0;
    const events: StepEvent[] = [];
    let dir: [number, number] | null = null;
    if (this.lastPos && !fresh) {
      const dx = x - this.lastPos[0];
      const dz = z - this.lastPos[1];
      const len = Math.hypot(dx, dz);
      if (len > 0.2) dir = [dx / len, dz / len];
    }
    // A sharp change of heading between strides: the sole drags round.
    if (dir && this.lastDir) {
      const dot = dir[0] * this.lastDir[0] + dir[1] * this.lastDir[1];
      if (dot < 0.5) events.push(this.event("scuff", pace));
    }
    const kind = this.landPending ? "land" : "step";
    this.landPending = false;
    events.push(this.event(kind, pace));
    this.index++;
    this.lastAt = now;
    this.lastPos = [x, z];
    this.lastDir = dir ?? (fresh ? null : this.lastDir);
    this.stopArmed = true;
    this.lastPace = pace;
    return events;
  }

  /**
   * Call every frame: once the next step is overdue (the player stopped) this
   * returns a `stop` event for the settling foot, once.
   */
  poll(now: number): (Omit<StepEvent, "kind"> & { kind: "stop"; at: [number, number] }) | null {
    if (!this.stopArmed || !this.lastPos) return null;
    if (now - this.lastAt < this.interval * 1.45) return null;
    this.stopArmed = false;
    this.lastDir = null;
    this.foot = this.foot === 0 ? 1 : 0;
    return {
      kind: "stop",
      foot: this.foot,
      pace: this.lastPace,
      interval: this.interval,
      index: this.index,
      at: [this.lastPos[0], this.lastPos[1]],
    };
  }

  private event(kind: StepEvent["kind"], pace: number): StepEvent {
    return { kind, foot: this.foot, pace, interval: this.interval, index: this.index };
  }
}

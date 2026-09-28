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

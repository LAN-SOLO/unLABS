// _unTETRIS - Web Audio API inverted sound effects
// All sounds are procedurally generated with descending/reversed tones

export class TetrisAudio {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private _muted = false

  get muted() { return this._muted }

  init() {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.3
    this.masterGain.connect(this.ctx.destination)
  }

  setMuted(muted: boolean) {
    this._muted = muted
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.3
    }
  }

  private ensureCtx(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.ctx || !this.masterGain) {
      this.init()
    }
    if (!this.ctx || !this.masterGain) return null
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return { ctx: this.ctx, out: this.masterGain }
  }

  // Low square-wave click (200Hz)
  playMove() {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 200
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.connect(gain)
    gain.connect(out)
    osc.start(now)
    osc.stop(now + 0.05)
  }

  // Descending chirp 600Hz -> 300Hz
  playRotate() {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08)
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    osc.connect(gain)
    gain.connect(out)
    osc.start(now)
    osc.stop(now + 0.1)
  }

  // Rising impact sweep 80Hz -> 400Hz (piece slams upward)
  playHardDrop() {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(80, now)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1)
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.connect(gain)
    gain.connect(out)
    osc.start(now)
    osc.stop(now + 0.15)
  }

  // Rising thunk 150Hz -> 300Hz
  playLock() {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(150, now)
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.06)
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(gain)
    gain.connect(out)
    osc.start(now)
    osc.stop(now + 0.08)
  }

  // Descending cascade - more lines = deeper sweep; Tetris gets bass thump
  // tier: aged clear tier — higher tiers get richer sound
  playLineClear(linesCleared: number, tier?: string) {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const startFreq = 800 + linesCleared * 200
    const endFreq = 100 - linesCleared * 15
    const duration = 0.15 + linesCleared * 0.05

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 30), now + duration)
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.05)
    osc.connect(gain)
    gain.connect(out)
    osc.start(now)
    osc.stop(now + duration + 0.05)

    // Bass thump for Tetris
    if (linesCleared === 4) {
      const bass = ctx.createOscillator()
      const bassGain = ctx.createGain()
      bass.type = 'sine'
      bass.frequency.value = 50
      bassGain.gain.setValueAtTime(0.3, now)
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      bass.connect(bassGain)
      bassGain.connect(out)
      bass.start(now)
      bass.stop(now + 0.3)
    }

    // Aged tier enhancements
    if (tier === 'AGED' || tier === 'VINTAGE' || tier === 'CRITICAL') {
      // Extended reverb tail — longer sine sweep
      const tail = ctx.createOscillator()
      const tailGain = ctx.createGain()
      tail.type = 'sine'
      tail.frequency.setValueAtTime(startFreq * 0.5, now)
      tail.frequency.exponentialRampToValueAtTime(60, now + 0.4)
      tailGain.gain.setValueAtTime(0.08, now)
      tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      tail.connect(tailGain)
      tailGain.connect(out)
      tail.start(now)
      tail.stop(now + 0.4)
    }

    if (tier === 'VINTAGE' || tier === 'CRITICAL') {
      // Sub-bass rumble
      const sub = ctx.createOscillator()
      const subGain = ctx.createGain()
      sub.type = 'sine'
      sub.frequency.value = 40
      subGain.gain.setValueAtTime(0.2, now)
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      sub.connect(subGain)
      subGain.connect(out)
      sub.start(now)
      sub.stop(now + 0.35)
    }

    if (tier === 'CRITICAL') {
      // Chord impact — two extra tones for a power chord feel
      const freqs = [220, 330]
      for (const freq of freqs) {
        const chord = ctx.createOscillator()
        const chordGain = ctx.createGain()
        chord.type = 'sawtooth'
        chord.frequency.value = freq
        chordGain.gain.setValueAtTime(0.12, now)
        chordGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        chord.connect(chordGain)
        chordGain.connect(out)
        chord.start(now)
        chord.stop(now + 0.25)
      }
    }
  }

  // Subtle static crackle for cell decay
  playDecay() {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const bufferSize = Math.floor(ctx.sampleRate * 0.08)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 2000
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(out)
    noise.start(now)
    noise.stop(now + 0.08)
  }

  // Descending arpeggio 660 -> 550 -> 440 -> 330Hz
  playLevelUp() {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const notes = [660, 550, 440, 330]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      const start = now + i * 0.1
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1)
      osc.connect(gain)
      gain.connect(out)
      osc.start(start)
      osc.stop(start + 0.12)
    })
  }

  // Three descending doom notes (inverted victory fanfare)
  playGameOver() {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const notes = [440, 330, 220]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      const start = now + i * 0.3
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
      osc.connect(gain)
      gain.connect(out)
      osc.start(start)
      osc.stop(start + 0.35)
    })
  }

  // Low-pass filtered noise burst
  playGarbage() {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const bufferSize = ctx.sampleRate * 0.1
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(out)
    noise.start(now)
    noise.stop(now + 0.1)
  }

  playHold() {
    const audio = this.ensureCtx()
    if (!audio) return
    const { ctx, out } = audio
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(500, now)
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.06)
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(gain)
    gain.connect(out)
    osc.start(now)
    osc.stop(now + 0.08)
  }

  destroy() {
    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
      this.masterGain = null
    }
  }
}

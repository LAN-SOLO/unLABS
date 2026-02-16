// _unOS Kernel — Memory Manager

import type { MemoryStats } from './types'
import type { DmesgBuffer } from './dmesg'
import type { ProcessManager } from './process'
import { TOTAL_MEMORY_KB } from './constants'

export class MemoryManager {
  private stats: MemoryStats
  private dmesg: DmesgBuffer | null = null
  private processManager: ProcessManager | null = null

  constructor() {
    this.stats = {
      totalKB: TOTAL_MEMORY_KB,
      freeKB: 8_192_000,
      availableKB: 12_288_000,
      buffersKB: 512_000,
      cachedKB: 4_096_000,
      swapTotalKB: 2_048_000,
      swapFreeKB: 2_048_000,
      slabKB: 256_000,
      kernelUsedKB: 2_048_000,
      userUsedKB: 0,
      deviceUsedKB: 1_024_000,
    }
  }

  init(dmesg: DmesgBuffer, processManager: ProcessManager) {
    this.dmesg = dmesg
    this.processManager = processManager
    this.recalculate()
  }

  /** Recalculate user memory from process table */
  private recalculate() {
    if (!this.processManager) return
    let userRSS = 0
    for (const proc of this.processManager.listAll()) {
      if (proc.uid !== 0) {
        userRSS += proc.memoryRSS
      }
    }
    this.stats.userUsedKB = userRSS
    this.updateDerived()
  }

  private updateDerived() {
    const used = this.stats.kernelUsedKB + this.stats.userUsedKB + this.stats.deviceUsedKB
    this.stats.freeKB = Math.max(0, this.stats.totalKB - used - this.stats.buffersKB - this.stats.cachedKB)
    this.stats.availableKB = this.stats.freeKB + this.stats.cachedKB + this.stats.buffersKB * 0.5
  }

  allocate(pid: number, sizeKB: number): boolean {
    if (!this.processManager) return false
    const proc = this.processManager.getByPid(pid)
    if (!proc) return false

    proc.memoryRSS += sizeKB
    proc.memoryVSZ += sizeKB
    this.recalculate()
    return true
  }

  free(pid: number, sizeKB: number): boolean {
    if (!this.processManager) return false
    const proc = this.processManager.getByPid(pid)
    if (!proc) return false

    proc.memoryRSS = Math.max(0, proc.memoryRSS - sizeKB)
    proc.memoryVSZ = Math.max(0, proc.memoryVSZ - sizeKB)
    this.recalculate()
    return true
  }

  /** Tick: slight fluctuation in buffers/cached for realism */
  tick() {
    // Fluctuate buffers +/- 1%
    const buffDelta = (Math.random() - 0.5) * this.stats.buffersKB * 0.02
    this.stats.buffersKB = Math.max(100_000, Math.min(800_000, this.stats.buffersKB + buffDelta))

    // Fluctuate cached +/- 0.5%
    const cacheDelta = (Math.random() - 0.5) * this.stats.cachedKB * 0.01
    this.stats.cachedKB = Math.max(1_000_000, Math.min(6_000_000, this.stats.cachedKB + cacheDelta))

    this.recalculate()
    this.oomCheck()
  }

  /** OOM check: if free < 1% total, kill largest non-kernel process */
  private oomCheck() {
    if (!this.processManager || !this.dmesg) return
    if (this.stats.freeKB >= this.stats.totalKB * 0.01) return

    // Find largest non-kernel user process
    let largest: { pid: number; name: string; rss: number } | null = null
    for (const proc of this.processManager.listAll()) {
      if (proc.uid === 0) continue
      if (proc.state === 'zombie' || proc.state === 'dead') continue
      if (!largest || proc.memoryRSS > largest.rss) {
        largest = { pid: proc.pid, name: proc.name, rss: proc.memoryRSS }
      }
    }

    if (largest) {
      this.dmesg.write('CRIT', 'kernel', `Out of memory: Kill process ${largest.pid} (${largest.name}) score ${Math.floor(largest.rss / 1024)} or sacrifice child`)
      this.processManager.kill(largest.pid, 9) // SIGKILL
    }
  }

  getStats(): MemoryStats {
    this.recalculate()
    return { ...this.stats }
  }

  getProcessMemory(pid: number): { rss: number; vsz: number } | null {
    if (!this.processManager) return null
    const proc = this.processManager.getByPid(pid)
    if (!proc) return null
    return { rss: proc.memoryRSS, vsz: proc.memoryVSZ }
  }

  toJSON(): MemoryStats {
    return { ...this.stats }
  }

  fromJSON(stats: MemoryStats) {
    this.stats = { ...stats }
  }
}

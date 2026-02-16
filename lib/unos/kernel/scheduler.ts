// _unOS Kernel — CFS-like Scheduler

import type { SchedulerStats, KernelProcess } from './types'
import type { ProcessManager } from './process'

export class Scheduler {
  private stats: SchedulerStats = {
    contextSwitches: 0,
    loadAvg1: 0,
    loadAvg5: 0,
    loadAvg15: 0,
    totalCPUTime: 0,
    idleCPUTime: 0,
    runQueueLength: 0,
  }

  private processManager: ProcessManager | null = null
  private totalElapsed = 0

  init(processManager: ProcessManager) {
    this.processManager = processManager
  }

  /** Tick: update load averages, CPU times, context switches */
  tick(dt: number) {
    if (!this.processManager) return

    this.totalElapsed += dt

    const running = this.processManager.getRunningCount()
    // Sleeping processes that could wake count toward load
    const sleeping = this.processManager.listAll().filter(p => p.state === 'sleeping').length
    // Load = running + a fraction of sleeping (simulating I/O wait)
    const instantLoad = running + sleeping * 0.1

    this.stats.runQueueLength = running

    // Exponential moving average for load averages
    // 1 min: exp(-dt/60000), 5 min: exp(-dt/300000), 15 min: exp(-dt/900000)
    const decay1 = Math.exp(-dt / 60000)
    const decay5 = Math.exp(-dt / 300000)
    const decay15 = Math.exp(-dt / 900000)

    this.stats.loadAvg1 = this.stats.loadAvg1 * decay1 + instantLoad * (1 - decay1)
    this.stats.loadAvg5 = this.stats.loadAvg5 * decay5 + instantLoad * (1 - decay5)
    this.stats.loadAvg15 = this.stats.loadAvg15 * decay15 + instantLoad * (1 - decay15)

    // CPU time accounting
    this.stats.totalCPUTime += dt
    if (running === 0) {
      this.stats.idleCPUTime += dt
    } else {
      // Partial idle: 8 cores, so if only 2 running, 6 cores idle
      const cores = 8
      const idleFraction = Math.max(0, (cores - running) / cores)
      this.stats.idleCPUTime += dt * idleFraction
    }

    // Context switches: proportional to number of running processes
    this.stats.contextSwitches += Math.max(1, running) * Math.floor(dt / 100)
  }

  getLoadAverage(): [number, number, number] {
    return [
      Math.round(this.stats.loadAvg1 * 100) / 100,
      Math.round(this.stats.loadAvg5 * 100) / 100,
      Math.round(this.stats.loadAvg15 * 100) / 100,
    ]
  }

  getTopProcesses(n: number): (KernelProcess & { cpuPercent: number; memPercent: number })[] {
    if (!this.processManager) return []

    const procs = this.processManager.listAll()
      .filter(p => p.state !== 'zombie' && p.state !== 'dead')
      .map(p => {
        const elapsed = Math.max(1, this.totalElapsed)
        const cpuPercent = Math.min(99.9, (p.cpuTime / elapsed) * 100)
        const memPercent = (p.memoryRSS / 16_384_000) * 100
        return { ...p, cpuPercent, memPercent }
      })
      .sort((a, b) => b.cpuPercent - a.cpuPercent)

    return procs.slice(0, n)
  }

  getStats(): SchedulerStats {
    return { ...this.stats }
  }

  toJSON(): SchedulerStats {
    return { ...this.stats }
  }

  fromJSON(stats: SchedulerStats) {
    this.stats = { ...stats }
  }
}

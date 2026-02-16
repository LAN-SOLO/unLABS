// _unOS Kernel — Process Manager

import type { KernelProcess, ProcessState } from './types'
import { MAX_PID, INIT_PID, DAEMON_PROCESSES, SIGNALS } from './constants'
import type { DmesgBuffer } from './dmesg'

export class ProcessManager {
  private processes = new Map<number, KernelProcess>()
  private nextPid = INIT_PID
  private dmesg: DmesgBuffer | null = null
  private bootTime = 0
  private totalCreated = 0

  init(dmesg: DmesgBuffer, bootTime: number) {
    this.dmesg = dmesg
    this.bootTime = bootTime
  }

  /** Spawn all daemon processes at boot */
  spawnDaemons(): void {
    for (const daemon of DAEMON_PROCESSES) {
      this.spawn(daemon.name, daemon.cmdline, daemon.name === 'init' ? 0 : INIT_PID, {
        uid: daemon.uid,
        gid: daemon.uid,
        memoryRSS: daemon.memoryRSS,
        memoryVSZ: daemon.memoryVSZ,
        tty: daemon.tty,
        nice: daemon.nice,
        state: daemon.name.startsWith('kworker') || daemon.name.startsWith('ksoftirq') || daemon.name === 'rcu_sched' || daemon.name === 'kcompactd0'
          ? 'sleeping'
          : 'sleeping',
      })
    }
  }

  spawn(
    name: string,
    cmdline: string,
    ppid: number,
    opts: {
      uid?: number
      gid?: number
      memoryRSS?: number
      memoryVSZ?: number
      tty?: string
      nice?: number
      state?: ProcessState
    } = {}
  ): number {
    const pid = this.allocatePid()
    const now = Date.now()
    const startTime = this.bootTime > 0 ? now - this.bootTime : 0

    const proc: KernelProcess = {
      pid,
      ppid,
      name,
      cmdline,
      state: opts.state ?? 'running',
      uid: opts.uid ?? 1001,
      gid: opts.gid ?? opts.uid ?? 1001,
      priority: 20 + (opts.nice ?? 0),
      nice: opts.nice ?? 0,
      startTime,
      cpuTime: 0,
      memoryRSS: opts.memoryRSS ?? 2048,
      memoryVSZ: opts.memoryVSZ ?? 8192,
      tty: opts.tty ?? 'pts/0',
      children: [],
    }

    this.processes.set(pid, proc)
    this.totalCreated++

    // Add as child of parent
    const parent = this.processes.get(ppid)
    if (parent && parent.pid !== pid) {
      parent.children.push(pid)
    }

    return pid
  }

  exit(pid: number, exitCode: number): boolean {
    const proc = this.processes.get(pid)
    if (!proc) return false
    if (pid === INIT_PID) return false // can't kill init

    proc.state = 'zombie'
    proc.exitCode = exitCode

    // Reparent children to init
    for (const childPid of proc.children) {
      const child = this.processes.get(childPid)
      if (child) {
        child.ppid = INIT_PID
        const init = this.processes.get(INIT_PID)
        if (init) init.children.push(childPid)
      }
    }
    proc.children = []

    return true
  }

  kill(pid: number, signal: number): { success: boolean; message: string } {
    const proc = this.processes.get(pid)
    if (!proc) return { success: false, message: `kill: (${pid}) - No such process` }
    if (pid === INIT_PID && signal !== 0) return { success: false, message: `kill: (${pid}) - Operation not permitted` }

    if (signal === 0) {
      // Signal 0: just check if process exists
      return { success: true, message: '' }
    }

    if (signal === SIGNALS.SIGKILL) {
      proc.state = 'zombie'
      proc.exitCode = 137
      this.dmesg?.write('INFO', 'kernel', `process ${pid} (${proc.name}) killed by SIGKILL`)
      return { success: true, message: '' }
    }

    if (signal === SIGNALS.SIGSTOP || signal === SIGNALS.SIGTSTP) {
      proc.state = 'stopped'
      return { success: true, message: '' }
    }

    if (signal === SIGNALS.SIGCONT) {
      if (proc.state === 'stopped') proc.state = 'sleeping'
      return { success: true, message: '' }
    }

    if (signal === SIGNALS.SIGTERM) {
      proc.state = 'zombie'
      proc.exitCode = 143
      this.dmesg?.write('INFO', 'kernel', `process ${pid} (${proc.name}) terminated by SIGTERM`)
      return { success: true, message: '' }
    }

    // Default: treat as SIGTERM
    proc.state = 'zombie'
    proc.exitCode = 128 + signal
    return { success: true, message: '' }
  }

  reap(pid: number): boolean {
    const proc = this.processes.get(pid)
    if (!proc) return false
    if (proc.state !== 'zombie' && proc.state !== 'dead') return false

    // Remove from parent's children
    const parent = this.processes.get(proc.ppid)
    if (parent) {
      parent.children = parent.children.filter(c => c !== pid)
    }

    this.processes.delete(pid)
    return true
  }

  getByPid(pid: number): KernelProcess | undefined {
    return this.processes.get(pid)
  }

  listAll(): KernelProcess[] {
    return Array.from(this.processes.values())
  }

  getChildren(pid: number): KernelProcess[] {
    const proc = this.processes.get(pid)
    if (!proc) return []
    return proc.children
      .map(cpid => this.processes.get(cpid))
      .filter((p): p is KernelProcess => p !== undefined)
  }

  getRunningCount(): number {
    let count = 0
    for (const proc of this.processes.values()) {
      if (proc.state === 'running') count++
    }
    return count
  }

  getTotalCount(): number {
    return this.processes.size
  }

  get totalProcessesCreated(): number {
    return this.totalCreated
  }

  getLastPid(): number {
    return this.nextPid - 1
  }

  /** Set nice value for a process */
  setNice(pid: number, nice: number): { success: boolean; message: string } {
    const proc = this.processes.get(pid)
    if (!proc) return { success: false, message: `renice: (${pid}) - No such process` }
    if (nice < -20) nice = -20
    if (nice > 19) nice = 19
    const oldNice = proc.nice
    proc.nice = nice
    proc.priority = 20 + nice
    return { success: true, message: `${pid} (process ID) old priority ${oldNice}, new priority ${nice}` }
  }

  /** Tick: update CPU time for running processes, reap old zombies */
  tick(dt: number) {
    const runningProcs: KernelProcess[] = []
    const zombiesToReap: number[] = []

    for (const proc of this.processes.values()) {
      if (proc.state === 'running') {
        runningProcs.push(proc)
      } else if (proc.state === 'zombie') {
        // Auto-reap zombies after 10s
        const age = (Date.now() - this.bootTime) - proc.startTime
        if (age > 10000 && proc.pid !== INIT_PID) {
          zombiesToReap.push(proc.pid)
        }
      }
    }

    // Distribute CPU time among running processes weighted by inverse nice
    if (runningProcs.length > 0) {
      for (const proc of runningProcs) {
        // Higher priority (lower nice) gets more CPU
        const weight = Math.max(1, 20 - proc.nice)
        const totalWeight = runningProcs.reduce((s, p) => s + Math.max(1, 20 - p.nice), 0)
        proc.cpuTime += (dt * weight) / totalWeight
      }
    }

    // Reap old zombies
    for (const pid of zombiesToReap) {
      this.reap(pid)
    }
  }

  private allocatePid(): number {
    const pid = this.nextPid
    this.nextPid++
    if (this.nextPid >= MAX_PID) {
      this.nextPid = 100 // wrap, skip low pids
    }
    return pid
  }

  /** Get next PID that would be allocated (for serialization) */
  getNextPid(): number {
    return this.nextPid
  }

  setNextPid(pid: number) {
    this.nextPid = pid
  }

  toJSON(): KernelProcess[] {
    // Persist daemon processes only (not transient command processes)
    return Array.from(this.processes.values()).filter(p =>
      DAEMON_PROCESSES.some(d => d.name === p.name) || p.pid === INIT_PID
    )
  }

  fromJSON(procs: KernelProcess[]) {
    this.processes.clear()
    for (const p of procs) {
      this.processes.set(p.pid, { ...p, children: [...(p.children || [])] })
    }
    // Recalculate nextPid
    let maxPid = 0
    for (const pid of this.processes.keys()) {
      if (pid > maxPid) maxPid = pid
    }
    this.nextPid = maxPid + 1
  }
}

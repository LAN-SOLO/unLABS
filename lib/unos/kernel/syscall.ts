// _unOS Kernel — Syscall Interface

import type { SyscallEntry, StraceEntry } from './types'
import { SYSCALL_TABLE, STRACE_BUFFER_SIZE } from './constants'

export class SyscallManager {
  private table = new Map<number, SyscallEntry>()
  private straceBuffer: StraceEntry[] = []

  constructor() {
    for (const def of SYSCALL_TABLE) {
      this.table.set(def.number, {
        number: def.number,
        name: def.name,
        callCount: 0,
        lastCalled: 0,
      })
    }
  }

  /** Record a syscall invocation */
  invoke(num: number, pid: number, args: string = ''): number {
    const entry = this.table.get(num)
    if (!entry) return -1

    entry.callCount++
    entry.lastCalled = Date.now()

    // Push to strace buffer
    this.straceBuffer.push({
      timestamp: Date.now(),
      pid,
      syscall: entry.name,
      args,
      ret: 0,
    })

    if (this.straceBuffer.length > STRACE_BUFFER_SIZE) {
      this.straceBuffer.shift()
    }

    return 0
  }

  /** Simulate background syscall activity from daemons */
  simulateActivity(daemonPids: number[]) {
    // Common daemon syscalls
    const commonSyscalls = [0, 1, 7, 35, 9, 12] // read, write, poll, nanosleep, mmap, brk
    for (const pid of daemonPids) {
      const num = commonSyscalls[Math.floor(Math.random() * commonSyscalls.length)]
      this.invoke(num, pid, '')
    }
  }

  getTable(): SyscallEntry[] {
    return Array.from(this.table.values()).sort((a, b) => a.number - b.number)
  }

  getStrace(pid?: number, limit: number = 20): StraceEntry[] {
    let entries = [...this.straceBuffer]
    if (pid !== undefined) {
      entries = entries.filter(e => e.pid === pid)
    }
    return entries.slice(-limit)
  }

  toJSON(): { number: number; callCount: number }[] {
    return Array.from(this.table.values())
      .filter(e => e.callCount > 0)
      .map(e => ({ number: e.number, callCount: e.callCount }))
  }

  fromJSON(counts: { number: number; callCount: number }[]) {
    for (const c of counts) {
      const entry = this.table.get(c.number)
      if (entry) {
        entry.callCount = c.callCount
      }
    }
  }
}

// _unOS Kernel — Ring Buffer (dmesg)

import type { DmesgEntry, DmesgLevel } from './types'
import { DMESG_BUFFER_SIZE } from './constants'

export class DmesgBuffer {
  private buffer: DmesgEntry[] = []
  private bootTime = 0

  init(bootTime: number) {
    this.bootTime = bootTime
  }

  write(level: DmesgLevel, facility: string, message: string) {
    const timestamp = this.bootTime > 0
      ? (Date.now() - this.bootTime) / 1000
      : 0

    this.buffer.push({ timestamp, level, facility, message })

    // Circular: drop oldest when full
    if (this.buffer.length > DMESG_BUFFER_SIZE) {
      this.buffer.shift()
    }
  }

  read(filter?: { level?: DmesgLevel; facility?: string }): DmesgEntry[] {
    if (!filter) return [...this.buffer]
    return this.buffer.filter(e => {
      if (filter.level && e.level !== filter.level) return false
      if (filter.facility && e.facility !== filter.facility) return false
      return true
    })
  }

  clear() {
    this.buffer = []
  }

  get entries(): DmesgEntry[] {
    return [...this.buffer]
  }

  get length(): number {
    return this.buffer.length
  }

  toJSON(): DmesgEntry[] {
    // Persist last 100 entries
    return this.buffer.slice(-100)
  }

  fromJSON(entries: DmesgEntry[]) {
    this.buffer = entries
  }
}

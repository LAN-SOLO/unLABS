// _unOS v2.0 — System Journal (journalctl backend)

export interface JournalEntry {
  timestamp: number
  unit: string
  priority: number  // 0=emerg, 1=alert, 2=crit, 3=err, 4=warn, 5=notice, 6=info, 7=debug
  message: string
  pid?: number
}

export interface JournalQueryOptions {
  unit?: string
  priority?: number
  since?: number
  until?: number
  tail?: number
  boot?: boolean
}

const PRIORITY_NAMES = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug']

const MAX_ENTRIES = 256

export class Journal {
  private entries: JournalEntry[] = []
  private bootTime: number

  constructor() {
    this.bootTime = Date.now()
  }

  write(unit: string, priority: number, message: string, pid?: number): void {
    this.entries.push({
      timestamp: Date.now(),
      unit,
      priority: Math.max(0, Math.min(7, priority)),
      message,
      pid,
    })
    // Circular buffer — drop oldest
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES)
    }
  }

  query(options: JournalQueryOptions = {}): JournalEntry[] {
    let result = [...this.entries]

    if (options.boot) {
      result = result.filter(e => e.timestamp >= this.bootTime)
    }
    if (options.unit) {
      const u = options.unit.toLowerCase()
      result = result.filter(e => e.unit.toLowerCase() === u)
    }
    if (options.priority !== undefined) {
      result = result.filter(e => e.priority <= options.priority!)
    }
    if (options.since) {
      result = result.filter(e => e.timestamp >= options.since!)
    }
    if (options.until) {
      result = result.filter(e => e.timestamp <= options.until!)
    }
    if (options.tail) {
      result = result.slice(-options.tail)
    }

    return result
  }

  getBootTime(): number {
    return this.bootTime
  }

  static formatEntry(entry: JournalEntry): string {
    const date = new Date(entry.timestamp)
    const ts = date.toLocaleString('en-US', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
    const prio = PRIORITY_NAMES[entry.priority] ?? 'info'
    const pid = entry.pid ? `[${entry.pid}]` : ''
    return `${ts} _unLAB ${entry.unit}${pid}: <${prio}> ${entry.message}`
  }

  static priorityFromName(name: string): number {
    const idx = PRIORITY_NAMES.indexOf(name.toLowerCase())
    return idx >= 0 ? idx : 6
  }

  toJSON(): { entries: JournalEntry[]; bootTime: number } {
    return { entries: this.entries, bootTime: this.bootTime }
  }

  static fromJSON(data: { entries: JournalEntry[]; bootTime: number }): Journal {
    const j = new Journal()
    j.entries = data.entries || []
    j.bootTime = data.bootTime || Date.now()
    return j
  }
}

// _unOS v2.0 — Cron Scheduler (simulated crontab)

export interface CronEntry {
  id: number
  schedule: string
  command: string
  user: string
  enabled: boolean
}

let nextId = 1

const DEFAULT_ENTRIES: Omit<CronEntry, 'id'>[] = [
  { schedule: '*/5 * * * *', command: '/unbin/volatility-check', user: 'root', enabled: true },
  { schedule: '0 * * * *', command: '/unbin/crystal-sync', user: 'operator', enabled: true },
  { schedule: '0 0 * * *', command: '/unbin/log-rotate', user: 'root', enabled: true },
  { schedule: '*/15 * * * *', command: '/unbin/blockchain-heartbeat', user: 'root', enabled: true },
  { schedule: '30 2 * * 0', command: '/unbin/system-backup', user: 'root', enabled: true },
]

export class CronManager {
  private entries: CronEntry[] = []

  constructor() {
    for (const def of DEFAULT_ENTRIES) {
      this.entries.push({ ...def, id: nextId++ })
    }
  }

  list(): CronEntry[] {
    return [...this.entries]
  }

  add(schedule: string, command: string, user: string = 'operator'): CronEntry {
    const entry: CronEntry = { id: nextId++, schedule, command, user, enabled: true }
    this.entries.push(entry)
    return entry
  }

  remove(id: number): boolean {
    const idx = this.entries.findIndex(e => e.id === id)
    if (idx < 0) return false
    this.entries.splice(idx, 1)
    return true
  }

  get(id: number): CronEntry | undefined {
    return this.entries.find(e => e.id === id)
  }

  toJSON(): { entries: CronEntry[]; nextId: number } {
    return { entries: this.entries, nextId }
  }

  static fromJSON(data: { entries: CronEntry[]; nextId: number }): CronManager {
    const mgr = new CronManager()
    mgr.entries = data.entries || []
    nextId = data.nextId || mgr.entries.length + 1
    return mgr
  }
}

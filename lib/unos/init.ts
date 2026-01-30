// _unOS v2.0 — Init System (unsystemd)

import type { Service, ServiceState } from './types'

const DEFAULT_SERVICES: Omit<Service, 'state' | 'pid' | 'startedAt'>[] = [
  { name: 'und', description: '_unOS system daemon', dependencies: [] },
  { name: 'undev', description: 'Device manager daemon', dependencies: ['und'] },
  { name: 'unchain', description: 'Blockchain connector', dependencies: ['und', 'unnet'] },
  { name: 'untick', description: 'Game tick engine', dependencies: ['und'] },
  { name: 'unnet', description: 'Network manager', dependencies: ['und'] },
  { name: 'unpod', description: 'Container runtime', dependencies: ['und', 'unnet'] },
]

export class InitSystem {
  private services: Map<string, Service>

  constructor() {
    this.services = new Map()
    for (const svc of DEFAULT_SERVICES) {
      this.services.set(svc.name, {
        ...svc,
        state: 'stopped',
      })
    }
  }

  async startAll(): Promise<{ started: string[]; failed: string[] }> {
    const started: string[] = []
    const failed: string[] = []

    // Start in dependency order
    const order = this.getStartOrder()
    for (const name of order) {
      const result = this.start(name)
      if (result.success) started.push(name)
      else failed.push(name)
    }

    return { started, failed }
  }

  private getStartOrder(): string[] {
    const visited = new Set<string>()
    const order: string[] = []

    const visit = (name: string) => {
      if (visited.has(name)) return
      visited.add(name)
      const svc = this.services.get(name)
      if (!svc) return
      for (const dep of svc.dependencies) {
        visit(dep)
      }
      order.push(name)
    }

    for (const name of this.services.keys()) {
      visit(name)
    }
    return order
  }

  start(name: string): { success: boolean; message: string } {
    const svc = this.services.get(name)
    if (!svc) return { success: false, message: `Service ${name} not found` }
    if (svc.state === 'running') return { success: true, message: `${name} already running` }

    // Check dependencies
    for (const dep of svc.dependencies) {
      const depSvc = this.services.get(dep)
      if (!depSvc || depSvc.state !== 'running') {
        return { success: false, message: `${name}: dependency ${dep} not running` }
      }
    }

    svc.state = 'running'
    svc.pid = 1000 + Math.floor(Math.random() * 9000)
    svc.startedAt = Date.now()
    return { success: true, message: `${name} started (PID ${svc.pid})` }
  }

  stop(name: string): { success: boolean; message: string } {
    const svc = this.services.get(name)
    if (!svc) return { success: false, message: `Service ${name} not found` }
    if (svc.state === 'stopped') return { success: true, message: `${name} already stopped` }

    svc.state = 'stopped'
    svc.pid = undefined
    svc.startedAt = undefined
    return { success: true, message: `${name} stopped` }
  }

  restart(name: string): { success: boolean; message: string } {
    this.stop(name)
    return this.start(name)
  }

  status(name?: string): Service | Service[] {
    if (name) {
      return this.services.get(name) ?? { name, description: 'unknown', state: 'stopped' as ServiceState, dependencies: [] }
    }
    return Array.from(this.services.values())
  }

  list(): Service[] {
    return Array.from(this.services.values())
  }

  toJSON(): Service[] {
    return Array.from(this.services.values())
  }

  static fromJSON(data: Service[]): InitSystem {
    const init = new InitSystem()
    init.services.clear()
    for (const svc of data) {
      init.services.set(svc.name, { ...svc })
    }
    return init
  }
}

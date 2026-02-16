// _unOS v2.0 — Init System (unsystemd)

import type { Service, ServiceState } from './types'
import type { Kernel } from './kernel'
import type { Journal } from './journal'

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
  private enabled: Set<string>

  constructor() {
    this.services = new Map()
    this.enabled = new Set()
    for (const svc of DEFAULT_SERVICES) {
      this.services.set(svc.name, {
        ...svc,
        state: 'stopped',
      })
      this.enabled.add(svc.name)
    }
  }

  async startAll(kernel?: Kernel, journal?: Journal): Promise<{ started: string[]; failed: string[] }> {
    const started: string[] = []
    const failed: string[] = []

    // Start in dependency order
    const order = this.getStartOrder()
    for (const name of order) {
      const result = this.start(name, kernel, journal)
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

  start(name: string, kernel?: Kernel, journal?: Journal): { success: boolean; message: string } {
    const svc = this.services.get(name)
    if (!svc) return { success: false, message: `Service ${name} not found` }
    if (svc.state === 'running') return { success: true, message: `${name} already running` }

    // Check dependencies
    for (const dep of svc.dependencies) {
      const depSvc = this.services.get(dep)
      if (!depSvc || depSvc.state !== 'running') {
        journal?.write(name, 3, `Failed to start: dependency ${dep} not running`)
        return { success: false, message: `${name}: dependency ${dep} not running` }
      }
    }

    svc.state = 'running'

    // Use kernel process table for PID if available
    if (kernel) {
      // Look for a matching daemon process in the kernel
      const procs = kernel.process.listAll()
      const match = procs.find(p => {
        // Match service name to daemon process names
        const svcMap: Record<string, string> = {
          'und': 'init',
          'undev': 'device-monitor',
          'unchain': 'blockchain-sync',
          'untick': 'tick-engine',
          'unnet': 'network-daemon',
          'unpod': 'container-runtime',
        }
        return p.name === (svcMap[name] ?? name)
      })
      svc.pid = match?.pid ?? kernel.process.spawn(`${name}d`, `/unbin/${name}d`, 1, { uid: 0 })
    } else {
      svc.pid = 1000 + Math.floor(Math.random() * 9000)
    }

    svc.startedAt = Date.now()
    journal?.write(name, 6, `Started ${svc.description} (PID ${svc.pid})`, svc.pid)
    return { success: true, message: `${name} started (PID ${svc.pid})` }
  }

  stop(name: string, journal?: Journal): { success: boolean; message: string } {
    const svc = this.services.get(name)
    if (!svc) return { success: false, message: `Service ${name} not found` }
    if (svc.state === 'stopped') return { success: true, message: `${name} already stopped` }

    journal?.write(name, 6, `Stopped ${svc.description}`, svc.pid)
    svc.state = 'stopped'
    svc.pid = undefined
    svc.startedAt = undefined
    return { success: true, message: `${name} stopped` }
  }

  restart(name: string, kernel?: Kernel, journal?: Journal): { success: boolean; message: string } {
    this.stop(name, journal)
    return this.start(name, kernel, journal)
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

  enable(name: string): { success: boolean; message: string } {
    if (!this.services.has(name)) return { success: false, message: `Unit ${name}.service not found` }
    this.enabled.add(name)
    return { success: true, message: `Created symlink /unetc/unOS/unsystemd/${name}.service -> enabled` }
  }

  disable(name: string): { success: boolean; message: string } {
    if (!this.services.has(name)) return { success: false, message: `Unit ${name}.service not found` }
    this.enabled.delete(name)
    return { success: true, message: `Removed /unetc/unOS/unsystemd/${name}.service` }
  }

  isEnabled(name: string): boolean {
    return this.enabled.has(name)
  }

  toJSON(): { services: Service[]; enabled: string[] } {
    return {
      services: Array.from(this.services.values()),
      enabled: Array.from(this.enabled),
    }
  }

  static fromJSON(data: Service[] | { services: Service[]; enabled?: string[] }): InitSystem {
    const init = new InitSystem()
    init.services.clear()
    const services = Array.isArray(data) ? data : data.services
    for (const svc of services) {
      init.services.set(svc.name, { ...svc })
    }
    if (!Array.isArray(data) && data.enabled) {
      init.enabled = new Set(data.enabled)
    } else {
      // Default: all services enabled
      init.enabled = new Set(services.map(s => s.name))
    }
    return init
  }
}

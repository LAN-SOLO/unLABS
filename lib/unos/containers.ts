// _unOS v2.0 — Container Runtime (unpod)
// Placeholder for future container/sandbox support

export interface Container {
  id: string
  name: string
  image: string
  state: 'running' | 'stopped' | 'paused'
  created: number
  ports: { host: number; container: number }[]
}

export class ContainerRuntime {
  private containers: Map<string, Container> = new Map()

  list(): Container[] {
    return Array.from(this.containers.values())
  }

  run(name: string, image: string): { success: boolean; message: string } {
    const id = `unpod-${Date.now().toString(36)}`
    this.containers.set(id, {
      id,
      name,
      image,
      state: 'running',
      created: Date.now(),
      ports: [],
    })
    return { success: true, message: `Container ${name} started (${id})` }
  }

  stop(id: string): { success: boolean; message: string } {
    const c = this.containers.get(id)
    if (!c) return { success: false, message: `Container ${id} not found` }
    c.state = 'stopped'
    return { success: true, message: `Container ${c.name} stopped` }
  }

  rm(id: string): { success: boolean; message: string } {
    if (!this.containers.has(id)) return { success: false, message: `Container ${id} not found` }
    this.containers.delete(id)
    return { success: true, message: `Container removed` }
  }

  toJSON(): Container[] {
    return Array.from(this.containers.values())
  }

  static fromJSON(data: Container[]): ContainerRuntime {
    const rt = new ContainerRuntime()
    for (const c of data) {
      rt.containers.set(c.id, { ...c })
    }
    return rt
  }
}

// _unOS Kernel — Module Manager (lsmod/modprobe/rmmod)

import type { KernelModule } from './types'
import { DEFAULT_MODULES } from './constants'
import type { DmesgBuffer } from './dmesg'

export class ModuleManager {
  private modules = new Map<string, KernelModule>()
  private dmesg: DmesgBuffer | null = null

  constructor() {
    for (const def of DEFAULT_MODULES) {
      this.modules.set(def.name, {
        name: def.name,
        description: def.description,
        version: def.version,
        size: def.size,
        dependencies: [...def.dependencies],
        loaded: false,
        refCount: 0,
        params: {},
      })
    }
  }

  init(dmesg: DmesgBuffer) {
    this.dmesg = dmesg
  }

  /** Load a module */
  load(name: string): { success: boolean; message: string } {
    const mod = this.modules.get(name)
    if (!mod) return { success: false, message: `modprobe: FATAL: Module ${name} not found` }
    if (mod.loaded) return { success: true, message: `${name} already loaded` }

    // Check dependencies
    for (const dep of mod.dependencies) {
      const depMod = this.modules.get(dep)
      if (!depMod || !depMod.loaded) {
        return { success: false, message: `modprobe: FATAL: Module ${name} depends on ${dep} which is not loaded` }
      }
    }

    mod.loaded = true
    // Increment refCount of dependencies
    for (const dep of mod.dependencies) {
      const depMod = this.modules.get(dep)
      if (depMod) depMod.refCount++
    }

    this.dmesg?.write('INFO', 'kernel', `${name}: module loaded (v${mod.version}, ${mod.size}K)`)
    return { success: true, message: `${name} loaded` }
  }

  /** Unload a module */
  unload(name: string): { success: boolean; message: string } {
    const mod = this.modules.get(name)
    if (!mod) return { success: false, message: `rmmod: ERROR: Module ${name} not found` }
    if (!mod.loaded) return { success: false, message: `rmmod: ERROR: Module ${name} is not currently loaded` }
    if (mod.refCount > 0) return { success: false, message: `rmmod: ERROR: Module ${name} is in use (refcount: ${mod.refCount})` }

    mod.loaded = false
    // Decrement refCount of dependencies
    for (const dep of mod.dependencies) {
      const depMod = this.modules.get(dep)
      if (depMod && depMod.refCount > 0) depMod.refCount--
    }

    this.dmesg?.write('INFO', 'kernel', `${name}: module unloaded`)
    return { success: true, message: `${name} unloaded` }
  }

  /** Load a module with all its dependencies (modprobe behavior) */
  probe(name: string): { success: boolean; messages: string[] } {
    const mod = this.modules.get(name)
    if (!mod) return { success: false, messages: [`modprobe: FATAL: Module ${name} not found`] }
    if (mod.loaded) return { success: true, messages: [`${name} already loaded`] }

    const messages: string[] = []

    // Recursively load dependencies first
    for (const dep of mod.dependencies) {
      const depMod = this.modules.get(dep)
      if (depMod && !depMod.loaded) {
        const result = this.probe(dep)
        messages.push(...result.messages)
        if (!result.success) return { success: false, messages }
      }
    }

    const result = this.load(name)
    messages.push(result.message)
    return { success: result.success, messages }
  }

  /** Load all default modules at boot */
  loadAll() {
    // Load in dependency order
    const loaded = new Set<string>()
    const loadOrder = (name: string) => {
      const mod = this.modules.get(name)
      if (!mod || loaded.has(name)) return
      for (const dep of mod.dependencies) loadOrder(dep)
      this.load(name)
      loaded.add(name)
    }
    for (const name of this.modules.keys()) loadOrder(name)
  }

  list(): KernelModule[] {
    return Array.from(this.modules.values())
  }

  get(name: string): KernelModule | undefined {
    return this.modules.get(name)
  }

  toJSON(): KernelModule[] {
    return Array.from(this.modules.values())
  }

  fromJSON(modules: KernelModule[]) {
    this.modules.clear()
    for (const m of modules) {
      this.modules.set(m.name, { ...m, dependencies: [...m.dependencies], params: { ...m.params } })
    }
  }
}

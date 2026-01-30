// _unOS v2.0 — Main Orchestrator
// Unified entry point for the _unOS operating system

import { VirtualFS } from './filesystem'
import { UserManager } from './users'
import { DeviceManager } from './devices'
import { PackageManager } from './packages'
import { NetworkManager } from './network'
import { InitSystem } from './init'
import { ContainerRuntime } from './containers'
import { UnShell } from './shell'
import { UNOS_VERSION, UNOS_CODENAME } from './constants'
import type { BootResult, UnOSState } from './types'

export class UnOS {
  readonly version = UNOS_VERSION
  readonly codename = UNOS_CODENAME

  fs: VirtualFS
  users: UserManager
  devices: DeviceManager
  packages: PackageManager
  network: NetworkManager
  init: InitSystem
  containers: ContainerRuntime
  shell: UnShell

  private _booted = false
  private _bootTime = 0

  constructor(state?: Partial<UnOSState>) {
    if (state?.filesystem) {
      this.fs = VirtualFS.fromJSON(state.filesystem)
    } else {
      this.fs = new VirtualFS()
    }

    if (state?.users) {
      this.users = UserManager.fromJSON(state.users)
    } else {
      this.users = new UserManager()
    }

    if (state?.devices) {
      this.devices = DeviceManager.fromJSON(state.devices)
    } else {
      this.devices = new DeviceManager()
    }

    if (state?.packages) {
      this.packages = PackageManager.fromJSON(state.packages)
    } else {
      this.packages = new PackageManager()
    }

    if (state?.network) {
      this.network = NetworkManager.fromJSON(state.network)
    } else {
      this.network = new NetworkManager()
    }

    this.init = new InitSystem()
    this.containers = new ContainerRuntime()
    this.shell = new UnShell()

    // Sync fs home user with user manager
    this.fs.setHomeUser(this.users.currentUsername)

    if (state?.bootTime) {
      this._booted = true
      this._bootTime = state.bootTime
    }
  }

  get booted(): boolean {
    return this._booted
  }

  get bootTime(): number {
    return this._bootTime
  }

  get uptime(): number {
    if (!this._booted) return 0
    return Date.now() - this._bootTime
  }

  async boot(): Promise<BootResult> {
    const start = Date.now()
    const services: BootResult['services'] = []
    const errors: string[] = []

    // 1. Start devices
    this.devices.start()

    // 2. Start init services
    const initResult = await this.init.startAll()
    for (const name of initResult.started) {
      services.push({ name, status: 'ok' })
    }
    for (const name of initResult.failed) {
      services.push({ name, status: 'failed' })
      errors.push(`Service ${name} failed to start`)
    }

    this._booted = true
    this._bootTime = Date.now()

    return {
      success: errors.length === 0,
      duration: Date.now() - start,
      services,
      errors,
    }
  }

  shutdown() {
    this.init.list().forEach(svc => this.init.stop(svc.name))
    this.devices.stop()
    this._booted = false
  }

  // Keep fs and users in sync when switching users
  switchUser(username: string, password?: string) {
    const result = this.users.su(username, password)
    if (result.success) {
      this.fs.setHomeUser(this.users.currentUsername)
    }
    return result
  }

  toJSON(): UnOSState {
    return {
      version: this.version,
      filesystem: this.fs.toJSON(),
      users: this.users.toJSON(),
      devices: this.devices.toJSON(),
      packages: this.packages.toJSON(),
      network: this.network.toJSON(),
      bootTime: this._bootTime,
    }
  }

  static fromJSON(json: string): UnOS {
    try {
      const state = JSON.parse(json) as UnOSState
      return new UnOS(state)
    } catch {
      return new UnOS()
    }
  }
}

// Re-export everything for convenient imports
export { VirtualFS } from './filesystem'
export { UserManager } from './users'
export { DeviceManager } from './devices'
export { PackageManager } from './packages'
export { NetworkManager } from './network'
export { InitSystem } from './init'
export { ContainerRuntime } from './containers'
export { UnShell } from './shell'
export { UNOS_PATHS, PATH_ALIASES, UNOS_VERSION, UNOS_CODENAME, DEVICE_IDS, DEVICE_CATEGORIES } from './constants'
export type { DeviceCategory } from './constants'
export type * from './types'

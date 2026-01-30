// _unOS v2.0 — Type definitions

import type { DeviceCategory } from './constants'

// --- Filesystem ---

export interface VNode {
  name: string
  type: 'file' | 'dir' | 'symlink' | 'device' | 'socket'
  content?: string
  children?: Map<string, VNode>
  permissions: number
  owner: string
  group: string
  created: number
  modified: number
  accessed: number
  size: number
  target?: string        // symlink target
  deviceType?: 'char' | 'block'
  major?: number
  minor?: number
}

export interface MountPoint {
  path: string
  type: 'tmpfs' | 'devfs' | 'procfs' | 'sysfs' | 'bind'
  options: string[]
  source?: string
}

export interface FilesystemStats {
  total: number
  used: number
  available: number
  inodes: number
  inodesUsed: number
}

// --- Users ---

export interface UnOSUser {
  uid: number
  username: string
  groups: string[]
  home: string
  shell: string
  isRoot: boolean
}

// --- Devices ---

export type DeviceState = 'online' | 'offline' | 'standby' | 'error' | 'testing'

export interface DevicePowerSpec {
  fullLoad: number   // watts
  idle: number
  standby: number
  current: number
}

export interface DeviceInfo {
  id: string
  name: string
  category: DeviceCategory
  version: string
  state: DeviceState
  power: DevicePowerSpec
  metrics: Record<string, number | string>
}

// --- Packages ---

export interface Package {
  name: string
  version: string
  description: string
  depends: string[]
  provides: string[]
  size: number
  installedSize: number
  installed: boolean
  repository: string
}

// --- Network ---

export type InterfaceState = 'up' | 'down' | 'dormant'

export interface NetworkInterface {
  name: string
  type: 'ethernet' | 'loopback' | 'bridge' | 'quantum'
  hwaddr: string
  address: string
  netmask: string
  gateway?: string
  dns?: string[]
  state: InterfaceState
  stats: {
    rxBytes: number
    txBytes: number
    rxPackets: number
    txPackets: number
    rxErrors: number
    txErrors: number
  }
}

// --- Init/Services ---

export type ServiceState = 'running' | 'stopped' | 'failed' | 'activating'

export interface Service {
  name: string
  description: string
  state: ServiceState
  pid?: number
  startedAt?: number
  dependencies: string[]
}

// --- Boot ---

export interface BootResult {
  success: boolean
  duration: number
  services: { name: string; status: 'ok' | 'failed' }[]
  errors: string[]
}

// --- Full state for serialization ---

export interface UnOSState {
  version: string
  filesystem: string  // serialized VirtualFS JSON
  users: string       // serialized UserManager JSON
  devices: DeviceInfo[]
  packages: Package[]
  network: NetworkInterface[]
  bootTime: number
}

// _unOS v2.0 — Device Manager
// Manages all 14 lab devices with power states and diagnostics

import type { DeviceInfo, DeviceState } from './types'
import type { DeviceCategory } from './constants'
import { DEVICE_IDS } from './constants'

interface DeviceSpec {
  id: string
  name: string
  category: DeviceCategory
  version: string
  power: { fullLoad: number; idle: number; standby: number }
}

const DEVICE_SPECS: DeviceSpec[] = [
  { id: 'UEC-001', name: 'Universal Energy Controller', category: 'power', version: '3.2.1', power: { fullLoad: 0, idle: 0, standby: 0 } },
  { id: 'MFR-001', name: 'Microfusion Reactor', category: 'power', version: '2.8.0', power: { fullLoad: -200, idle: -150, standby: -50 } },
  { id: 'BAT-001', name: 'Battery Array', category: 'power', version: '1.5.3', power: { fullLoad: -100, idle: -80, standby: -20 } },
  { id: 'CDC-001', name: 'Crystal Data Cache', category: 'crystal', version: '4.1.0', power: { fullLoad: 15, idle: 8, standby: 1 } },
  { id: 'HMS-001', name: 'Harmonic Sound System', category: 'audio', version: '2.0.1', power: { fullLoad: 8, idle: 4, standby: 1 } },
  { id: 'ECR-001', name: 'Echo Resonator', category: 'audio', version: '1.3.0', power: { fullLoad: 6, idle: 3, standby: 1 } },
  { id: 'IPL-001', name: 'Interpolation Engine', category: 'compute', version: '3.0.2', power: { fullLoad: 20, idle: 10, standby: 2 } },
  { id: 'AIC-001', name: 'AI Assistant Core', category: 'compute', version: '5.1.0', power: { fullLoad: 30, idle: 15, standby: 3 } },
  { id: 'VNT-001', name: 'Ventilation System', category: 'field', version: '1.1.0', power: { fullLoad: 5, idle: 3, standby: 1 } },
  { id: 'SCA-001', name: 'Supercomputer Array', category: 'compute', version: '2.4.1', power: { fullLoad: 45, idle: 20, standby: 5 } },
  { id: 'EXD-001', name: 'Exotic Matter Detector', category: 'field', version: '2.2.0', power: { fullLoad: 18, idle: 9, standby: 2 } },
  { id: 'QSM-001', name: 'Quantum State Monitor', category: 'quantum', version: '1.2.0', power: { fullLoad: 12, idle: 7, standby: 1 } },
  { id: 'EMC-001', name: 'Exotic Matter Containment', category: 'quantum', version: '4.0.1', power: { fullLoad: 40, idle: 18, standby: 2 } },
  { id: 'QUA-001', name: 'Quantum Analyzer', category: 'quantum', version: '3.7.2', power: { fullLoad: 25, idle: 10, standby: 2 } },
]

export class DeviceManager {
  private devices: Map<string, DeviceInfo> = new Map()

  constructor() {
    this.initDevices()
  }

  private initDevices() {
    for (const spec of DEVICE_SPECS) {
      this.devices.set(spec.id, {
        id: spec.id,
        name: spec.name,
        category: spec.category,
        version: spec.version,
        state: 'offline',
        power: {
          fullLoad: spec.power.fullLoad,
          idle: spec.power.idle,
          standby: spec.power.standby,
          current: 0,
        },
        metrics: {},
      })
    }
  }

  start() {
    // Power on all devices during boot
    for (const id of DEVICE_IDS) {
      this.powerOn(id)
    }
  }

  stop() {
    for (const id of DEVICE_IDS) {
      this.powerOff(id)
    }
  }

  list(filter?: { category?: DeviceCategory; state?: DeviceState }): DeviceInfo[] {
    let devices = Array.from(this.devices.values())
    if (filter?.category) {
      devices = devices.filter(d => d.category === filter.category)
    }
    if (filter?.state) {
      devices = devices.filter(d => d.state === filter.state)
    }
    return devices
  }

  info(id: string): DeviceInfo | undefined {
    return this.devices.get(id)
  }

  powerOn(id: string): { success: boolean; message: string } {
    const device = this.devices.get(id)
    if (!device) return { success: false, message: `Device ${id} not found` }
    if (device.state === 'online') return { success: true, message: `${id} already online` }
    device.state = 'online'
    device.power.current = device.power.idle
    return { success: true, message: `${id} powered on` }
  }

  powerOff(id: string): { success: boolean; message: string } {
    const device = this.devices.get(id)
    if (!device) return { success: false, message: `Device ${id} not found` }
    if (device.state === 'offline') return { success: true, message: `${id} already offline` }
    device.state = 'offline'
    device.power.current = 0
    return { success: true, message: `${id} powered off` }
  }

  setStandby(id: string): { success: boolean; message: string } {
    const device = this.devices.get(id)
    if (!device) return { success: false, message: `Device ${id} not found` }
    device.state = 'standby'
    device.power.current = device.power.standby
    return { success: true, message: `${id} set to standby` }
  }

  runTest(id: string): { success: boolean; message: string; results?: Record<string, string> } {
    const device = this.devices.get(id)
    if (!device) return { success: false, message: `Device ${id} not found` }
    if (device.state !== 'online') return { success: false, message: `${id} must be online to test` }

    const prevState = device.state
    device.state = 'testing'

    // Simulate test
    const results: Record<string, string> = {
      'power_test': 'PASS',
      'comm_test': 'PASS',
      'self_test': 'PASS',
      'firmware_check': `v${device.version} OK`,
    }

    device.state = prevState
    return { success: true, message: `${id} diagnostics complete`, results }
  }

  getPowerSummary(): { totalDraw: number; totalGeneration: number; netPower: number; deviceCount: number; onlineCount: number } {
    let totalDraw = 0
    let totalGeneration = 0
    let onlineCount = 0

    for (const device of this.devices.values()) {
      if (device.state === 'online' || device.state === 'standby') {
        onlineCount++
        if (device.power.current < 0) {
          totalGeneration += Math.abs(device.power.current)
        } else {
          totalDraw += device.power.current
        }
      }
    }

    return {
      totalDraw,
      totalGeneration,
      netPower: totalGeneration - totalDraw,
      deviceCount: this.devices.size,
      onlineCount,
    }
  }

  setState(id: string, state: DeviceState) {
    const device = this.devices.get(id)
    if (device) {
      device.state = state
      if (state === 'online') device.power.current = device.power.idle
      else if (state === 'standby') device.power.current = device.power.standby
      else device.power.current = 0
    }
  }

  setMetrics(id: string, metrics: Record<string, number | string>) {
    const device = this.devices.get(id)
    if (device) {
      device.metrics = { ...device.metrics, ...metrics }
    }
  }

  toJSON(): DeviceInfo[] {
    return Array.from(this.devices.values())
  }

  static fromJSON(data: DeviceInfo[]): DeviceManager {
    const mgr = new DeviceManager()
    for (const info of data) {
      mgr.devices.set(info.id, { ...info })
    }
    return mgr
  }
}

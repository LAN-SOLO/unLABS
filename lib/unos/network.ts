// _unOS v2.0 — Network Manager

import type { NetworkInterface } from './types'

const DEFAULT_INTERFACES: NetworkInterface[] = [
  {
    name: 'unlo',
    type: 'loopback',
    hwaddr: '00:00:00:00:00:00',
    address: '127.0.0.1',
    netmask: '255.0.0.0',
    state: 'up',
    stats: { rxBytes: 0, txBytes: 0, rxPackets: 0, txPackets: 0, rxErrors: 0, txErrors: 0 },
  },
  {
    name: 'uneth0',
    type: 'ethernet',
    hwaddr: 'UN:OS:00:00:00:01',
    address: '10.0.0.1',
    netmask: '255.255.255.0',
    gateway: '10.0.0.254',
    dns: ['10.0.0.253', '1.1.1.1'],
    state: 'up',
    stats: { rxBytes: 1048576, txBytes: 524288, rxPackets: 8192, txPackets: 4096, rxErrors: 0, txErrors: 0 },
  },
  {
    name: 'unbr0',
    type: 'bridge',
    hwaddr: 'UN:OS:00:00:00:02',
    address: '172.17.0.1',
    netmask: '255.255.0.0',
    state: 'up',
    stats: { rxBytes: 0, txBytes: 0, rxPackets: 0, txPackets: 0, rxErrors: 0, txErrors: 0 },
  },
  {
    name: 'unq0',
    type: 'quantum',
    hwaddr: 'UN:QM:00:00:00:01',
    address: 'q://entangled.0',
    netmask: 'n/a',
    state: 'dormant',
    stats: { rxBytes: 0, txBytes: 0, rxPackets: 0, txPackets: 0, rxErrors: 0, txErrors: 0 },
  },
]

export class NetworkManager {
  private interfaces: Map<string, NetworkInterface>

  constructor() {
    this.interfaces = new Map()
    for (const iface of DEFAULT_INTERFACES) {
      this.interfaces.set(iface.name, { ...iface })
    }
  }

  list(): NetworkInterface[] {
    return Array.from(this.interfaces.values())
  }

  info(name: string): NetworkInterface | undefined {
    return this.interfaces.get(name)
  }

  ifup(name: string): { success: boolean; message: string } {
    const iface = this.interfaces.get(name)
    if (!iface) return { success: false, message: `Interface ${name} not found` }
    if (iface.state === 'up') return { success: true, message: `${name} already up` }
    iface.state = 'up'
    return { success: true, message: `${name} brought up` }
  }

  ifdown(name: string): { success: boolean; message: string } {
    const iface = this.interfaces.get(name)
    if (!iface) return { success: false, message: `Interface ${name} not found` }
    if (iface.name === 'unlo') return { success: false, message: `Cannot bring down loopback interface` }
    iface.state = 'down'
    return { success: true, message: `${name} brought down` }
  }

  getStats(): { totalRx: number; totalTx: number; activeInterfaces: number } {
    let totalRx = 0, totalTx = 0, active = 0
    for (const iface of this.interfaces.values()) {
      if (iface.state === 'up') {
        active++
        totalRx += iface.stats.rxBytes
        totalTx += iface.stats.txBytes
      }
    }
    return { totalRx, totalTx, activeInterfaces: active }
  }

  toJSON(): NetworkInterface[] {
    return Array.from(this.interfaces.values())
  }

  static fromJSON(data: NetworkInterface[]): NetworkManager {
    const mgr = new NetworkManager()
    mgr.interfaces.clear()
    for (const iface of data) {
      mgr.interfaces.set(iface.name, { ...iface })
    }
    return mgr
  }
}

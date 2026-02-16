// _unOS v2.0 — Network Manager

import type { NetworkInterface } from './types'

export interface Route {
  destination: string
  gateway: string
  iface: string
  metric: number
  flags: string
  proto: string
}

export interface Connection {
  proto: 'tcp' | 'udp'
  localAddr: string
  localPort: number
  remoteAddr: string
  remotePort: number
  state: string
  pid: number
  process: string
}

export interface PingResult {
  success: boolean
  host: string
  rtt: number
  ttl: number
  seq: number
}

export interface TracerouteHop {
  hop: number
  host: string
  rtt: number
}

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

const DEFAULT_ROUTES: Route[] = [
  { destination: 'default', gateway: '10.0.0.254', iface: 'uneth0', metric: 100, flags: 'UG', proto: 'static' },
  { destination: '10.0.0.0/24', gateway: '0.0.0.0', iface: 'uneth0', metric: 100, flags: 'U', proto: 'kernel' },
  { destination: '172.17.0.0/16', gateway: '0.0.0.0', iface: 'unbr0', metric: 0, flags: 'U', proto: 'kernel' },
  { destination: '127.0.0.0/8', gateway: '0.0.0.0', iface: 'unlo', metric: 0, flags: 'U', proto: 'kernel' },
]

const DEFAULT_CONNECTIONS: Connection[] = [
  { proto: 'tcp', localAddr: '10.0.0.1', localPort: 443, remoteAddr: '0.0.0.0', remotePort: 0, state: 'LISTEN', pid: 1201, process: 'unchain' },
  { proto: 'tcp', localAddr: '10.0.0.1', localPort: 8080, remoteAddr: '0.0.0.0', remotePort: 0, state: 'LISTEN', pid: 1205, process: 'crystal-engine' },
  { proto: 'tcp', localAddr: '10.0.0.1', localPort: 38742, remoteAddr: '149.91.3.17', remotePort: 8899, state: 'ESTABLISHED', pid: 1201, process: 'unchain' },
  { proto: 'tcp', localAddr: '10.0.0.1', localPort: 42100, remoteAddr: '149.91.3.17', remotePort: 8900, state: 'ESTABLISHED', pid: 1201, process: 'unchain' },
  { proto: 'udp', localAddr: '10.0.0.1', localPort: 5353, remoteAddr: '0.0.0.0', remotePort: 0, state: '', pid: 1100, process: 'unnet' },
  { proto: 'tcp', localAddr: '172.17.0.1', localPort: 2375, remoteAddr: '0.0.0.0', remotePort: 0, state: 'LISTEN', pid: 1300, process: 'unpod' },
]

const DNS_HOSTS: Record<string, string> = {
  '_unLAB': '127.0.0.1',
  'localhost': '127.0.0.1',
  'gateway': '10.0.0.254',
  'dns.unlab': '10.0.0.253',
  'solana-rpc.devnet': '149.91.3.17',
  'api.devnet.solana.com': '149.91.3.17',
  'repo.unstablelabs.io': '10.0.0.100',
  'blockchain.unlab': '10.0.0.50',
  'quantum.unlab': '10.0.0.60',
  '1.1.1.1': '1.1.1.1',
  '8.8.8.8': '8.8.8.8',
  '10.0.0.1': '10.0.0.1',
  '10.0.0.254': '10.0.0.254',
}

export class NetworkManager {
  private interfaces: Map<string, NetworkInterface>
  private routes: Route[]
  private connections: Connection[]

  constructor() {
    this.interfaces = new Map()
    for (const iface of DEFAULT_INTERFACES) {
      this.interfaces.set(iface.name, { ...iface })
    }
    this.routes = DEFAULT_ROUTES.map(r => ({ ...r }))
    this.connections = DEFAULT_CONNECTIONS.map(c => ({ ...c }))
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

  // --- New networking capabilities ---

  getRoutes(): Route[] {
    return [...this.routes]
  }

  getDNS(): string[] {
    const eth0 = this.interfaces.get('uneth0')
    return eth0?.dns ? [...eth0.dns] : ['10.0.0.253', '1.1.1.1']
  }

  getConnections(): Connection[] {
    return [...this.connections]
  }

  resolveDNS(hostname: string): string | null {
    return DNS_HOSTS[hostname] ?? null
  }

  ping(host: string, count: number = 4): PingResult[] {
    const ip = DNS_HOSTS[host] ?? host
    const results: PingResult[] = []

    // Check if host is reachable
    const isLocal = ip.startsWith('10.0.0.') || ip.startsWith('127.') || ip.startsWith('172.17.')
    const isKnown = Object.values(DNS_HOSTS).includes(ip) || isLocal

    for (let i = 0; i < count; i++) {
      if (!isKnown) {
        results.push({ success: false, host: ip, rtt: 0, ttl: 0, seq: i + 1 })
      } else if (ip.startsWith('127.')) {
        results.push({ success: true, host: ip, rtt: +(0.01 + Math.random() * 0.05).toFixed(3), ttl: 64, seq: i + 1 })
      } else if (isLocal) {
        results.push({ success: true, host: ip, rtt: +(0.5 + Math.random() * 5).toFixed(3), ttl: 64, seq: i + 1 })
      } else {
        results.push({ success: true, host: ip, rtt: +(15 + Math.random() * 85).toFixed(3), ttl: 52, seq: i + 1 })
      }
    }
    return results
  }

  traceroute(host: string): TracerouteHop[] {
    const ip = DNS_HOSTS[host] ?? host
    const isLocal = ip.startsWith('10.0.0.') || ip.startsWith('127.')

    if (ip.startsWith('127.')) {
      return [{ hop: 1, host: '127.0.0.1', rtt: +(0.01 + Math.random() * 0.05).toFixed(3) }]
    }

    const hops: TracerouteHop[] = [
      { hop: 1, host: '10.0.0.254', rtt: +(0.5 + Math.random() * 2).toFixed(3) },
    ]

    if (isLocal) {
      hops.push({ hop: 2, host: ip, rtt: +(1 + Math.random() * 5).toFixed(3) })
    } else {
      hops.push(
        { hop: 2, host: '192.168.1.1', rtt: +(5 + Math.random() * 10).toFixed(3) },
        { hop: 3, host: '72.14.215.85', rtt: +(10 + Math.random() * 15).toFixed(3) },
        { hop: 4, host: '108.170.250.33', rtt: +(15 + Math.random() * 20).toFixed(3) },
        { hop: 5, host: ip, rtt: +(20 + Math.random() * 50).toFixed(3) },
      )
    }

    return hops
  }

  toJSON(): { interfaces: NetworkInterface[]; routes: Route[]; connections: Connection[] } {
    return {
      interfaces: Array.from(this.interfaces.values()),
      routes: this.routes,
      connections: this.connections,
    }
  }

  static fromJSON(data: NetworkInterface[] | { interfaces: NetworkInterface[]; routes?: Route[]; connections?: Connection[] }): NetworkManager {
    const mgr = new NetworkManager()
    mgr.interfaces.clear()
    const ifaces = Array.isArray(data) ? data : data.interfaces
    for (const iface of ifaces) {
      mgr.interfaces.set(iface.name, { ...iface })
    }
    if (!Array.isArray(data)) {
      if (data.routes) mgr.routes = data.routes
      if (data.connections) mgr.connections = data.connections
    }
    return mgr
  }
}

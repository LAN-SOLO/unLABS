// _unOS v2.0 — Package Manager (unapt)

import type { Package } from './types'

const DEFAULT_PACKAGES: Package[] = [
  { name: 'unos-core', version: '2.0.0', description: '_unOS core system', depends: [], provides: ['system'], size: 2048, installedSize: 8192, installed: true, repository: 'stable' },
  { name: 'undev-tools', version: '1.0.0', description: 'Device management tools', depends: ['unos-core'], provides: ['undev'], size: 512, installedSize: 2048, installed: true, repository: 'stable' },
  { name: 'crystal-toolkit', version: '4.1.0', description: 'Crystal data cache toolkit', depends: ['unos-core'], provides: ['cdc-cli'], size: 1024, installedSize: 4096, installed: true, repository: 'stable' },
  { name: 'quantum-libs', version: '1.2.0', description: 'Quantum computing libraries', depends: ['unos-core'], provides: ['libquantum'], size: 3072, installedSize: 12288, installed: true, repository: 'stable' },
  { name: 'unnet-tools', version: '1.0.0', description: 'Network diagnostic tools', depends: ['unos-core'], provides: ['unnet'], size: 256, installedSize: 1024, installed: true, repository: 'stable' },
  { name: 'blockchain-connector', version: '2.0.0', description: 'Solana blockchain interface', depends: ['unos-core', 'unnet-tools'], provides: ['unchain'], size: 2048, installedSize: 8192, installed: true, repository: 'stable' },
  { name: 'screw-buttons', version: '1.0.0', description: 'Screw button multiplayer system', depends: ['unos-core', 'unnet-tools'], provides: ['screwbuttons'], size: 512, installedSize: 2048, installed: true, repository: 'stable' },
  // Available but not installed
  { name: 'unos-debug', version: '1.0.0', description: 'Debug and profiling tools', depends: ['unos-core'], provides: ['undebug'], size: 768, installedSize: 3072, installed: false, repository: 'stable' },
  { name: 'crystal-miner', version: '0.9.0', description: 'Automated crystal mining daemon', depends: ['crystal-toolkit'], provides: ['unminer'], size: 1536, installedSize: 6144, installed: false, repository: 'experimental' },
  { name: 'quantum-entangler', version: '0.5.0', description: 'Quantum entanglement tools', depends: ['quantum-libs'], provides: ['qentangle'], size: 4096, installedSize: 16384, installed: false, repository: 'experimental' },
]

export class PackageManager {
  private packages: Map<string, Package>

  constructor() {
    this.packages = new Map()
    for (const pkg of DEFAULT_PACKAGES) {
      this.packages.set(pkg.name, { ...pkg })
    }
  }

  list(filter?: { installed?: boolean; repository?: string }): Package[] {
    let pkgs = Array.from(this.packages.values())
    if (filter?.installed !== undefined) {
      pkgs = pkgs.filter(p => p.installed === filter.installed)
    }
    if (filter?.repository) {
      pkgs = pkgs.filter(p => p.repository === filter.repository)
    }
    return pkgs.sort((a, b) => a.name.localeCompare(b.name))
  }

  search(query: string): Package[] {
    const q = query.toLowerCase()
    return Array.from(this.packages.values())
      .filter(p => p.name.includes(q) || p.description.toLowerCase().includes(q))
  }

  info(name: string): Package | undefined {
    return this.packages.get(name)
  }

  install(name: string): { success: boolean; message: string } {
    const pkg = this.packages.get(name)
    if (!pkg) return { success: false, message: `E: Unable to locate package ${name}` }
    if (pkg.installed) return { success: false, message: `${name} is already installed` }

    // Check dependencies
    for (const dep of pkg.depends) {
      const depPkg = Array.from(this.packages.values()).find(p => p.name === dep || p.provides.includes(dep))
      if (!depPkg?.installed) {
        return { success: false, message: `E: Dependency ${dep} not satisfied` }
      }
    }

    pkg.installed = true
    return { success: true, message: `${name} (${pkg.version}) installed successfully` }
  }

  remove(name: string): { success: boolean; message: string } {
    const pkg = this.packages.get(name)
    if (!pkg) return { success: false, message: `E: Package ${name} not found` }
    if (!pkg.installed) return { success: false, message: `${name} is not installed` }

    // Check if anything depends on this
    const dependents = Array.from(this.packages.values())
      .filter(p => p.installed && p.depends.includes(name))
    if (dependents.length > 0) {
      return { success: false, message: `E: Cannot remove ${name}: required by ${dependents.map(d => d.name).join(', ')}` }
    }

    pkg.installed = false
    return { success: true, message: `${name} removed successfully` }
  }

  update(): { updated: string[]; message: string } {
    // Simulated — all packages are "up to date"
    return { updated: [], message: 'All packages are up to date.' }
  }

  toJSON(): Package[] {
    return Array.from(this.packages.values())
  }

  static fromJSON(data: Package[]): PackageManager {
    const mgr = new PackageManager()
    mgr.packages.clear()
    for (const pkg of data) {
      mgr.packages.set(pkg.name, { ...pkg })
    }
    return mgr
  }
}

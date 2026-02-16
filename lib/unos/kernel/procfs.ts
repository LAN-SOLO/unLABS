// _unOS Kernel — Dynamic /unproc Content Generator

import type { ProcessManager } from './process'
import type { MemoryManager } from './memory'
import type { Scheduler } from './scheduler'
import type { ModuleManager } from './modules'
import type { KernelInfo, SysctlEntry } from './types'
import { KERNEL_VERSION, KERNEL_RELEASE, KERNEL_ARCH } from './constants'

export class ProcFS {
  private processManager: ProcessManager | null = null
  private memoryManager: MemoryManager | null = null
  private scheduler: Scheduler | null = null
  private moduleManager: ModuleManager | null = null
  private kernelInfo: KernelInfo | null = null
  private sysctlEntries: SysctlEntry[] = []

  init(
    processManager: ProcessManager,
    memoryManager: MemoryManager,
    scheduler: Scheduler,
    moduleManager: ModuleManager,
    kernelInfo: KernelInfo,
    sysctlEntries: SysctlEntry[]
  ) {
    this.processManager = processManager
    this.memoryManager = memoryManager
    this.scheduler = scheduler
    this.moduleManager = moduleManager
    this.kernelInfo = kernelInfo
    this.sysctlEntries = sysctlEntries
  }

  /** Generate content for a /unproc path. Returns null if path not handled. */
  generate(path: string): string | null {
    // Normalize path: strip leading /unproc or /proc
    let p = path
    if (p.startsWith('/unproc')) p = p.slice(7)
    else if (p.startsWith('/proc')) p = p.slice(5)
    if (!p.startsWith('/')) p = '/' + p

    // /unproc/version
    if (p === '/version') {
      return `_unOS version ${KERNEL_VERSION} (uncc 12.2.0) #1 SMP PREEMPT_DYNAMIC ${KERNEL_ARCH}\n`
    }

    // /unproc/cpuinfo
    if (p === '/cpuinfo') {
      const [load1] = this.scheduler?.getLoadAverage() ?? [0]
      const utilization = Math.min(100, load1 * 12.5) // Rough: 8 cores
      return [
        'processor\t: 0',
        'vendor_id\t: UnstableLabs',
        'cpu family\t: 6',
        'model\t\t: 42',
        'model name\t: _unSC Quantum Core v2',
        `cpu MHz\t\t: ${(4200 * (0.95 + Math.random() * 0.1)).toFixed(3)}`,
        'cache size\t: 32768 KB',
        'physical id\t: 0',
        'siblings\t: 8',
        'cpu cores\t: 8',
        `cpu utilization\t: ${utilization.toFixed(1)}%`,
        'fpu\t\t: yes',
        'flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat sse sse2 sse3 ssse3 sse4_1 sse4_2 avx avx2 aes quantum',
        'bogomips\t: 8400.00',
        `clflush size\t: 64`,
        `cache_alignment\t: 64`,
        '',
      ].join('\n')
    }

    // /unproc/meminfo
    if (p === '/meminfo') {
      const stats = this.memoryManager?.getStats()
      if (!stats) return null
      const pad = (label: string, val: number) => `${label}:${' '.repeat(Math.max(1, 16 - label.length))}${String(Math.floor(val)).padStart(10)} kB`
      return [
        pad('MemTotal', stats.totalKB),
        pad('MemFree', stats.freeKB),
        pad('MemAvailable', stats.availableKB),
        pad('Buffers', stats.buffersKB),
        pad('Cached', stats.cachedKB),
        pad('SwapCached', 0),
        pad('SwapTotal', stats.swapTotalKB),
        pad('SwapFree', stats.swapFreeKB),
        pad('Slab', stats.slabKB),
        pad('SReclaimable', Math.floor(stats.slabKB * 0.7)),
        pad('SUnreclaim', Math.floor(stats.slabKB * 0.3)),
        pad('KernelStack', 8192),
        pad('PageTables', 32768),
        pad('Committed_AS', stats.kernelUsedKB + stats.userUsedKB),
        '',
      ].join('\n')
    }

    // /unproc/uptime
    if (p === '/uptime') {
      if (!this.kernelInfo) return '0.00 0.00\n'
      const uptimeSec = (Date.now() - this.kernelInfo.bootTime) / 1000
      const schedStats = this.scheduler?.getStats()
      const idleSec = schedStats ? schedStats.idleCPUTime / 1000 : uptimeSec * 0.85
      return `${uptimeSec.toFixed(2)} ${idleSec.toFixed(2)}\n`
    }

    // /unproc/loadavg
    if (p === '/loadavg') {
      const [l1, l5, l15] = this.scheduler?.getLoadAverage() ?? [0, 0, 0]
      const running = this.processManager?.getRunningCount() ?? 0
      const total = this.processManager?.getTotalCount() ?? 0
      const lastPid = this.processManager?.getLastPid() ?? 0
      return `${l1.toFixed(2)} ${l5.toFixed(2)} ${l15.toFixed(2)} ${running}/${total} ${lastPid}\n`
    }

    // /unproc/stat
    if (p === '/stat') {
      const schedStats = this.scheduler?.getStats()
      const totalCpu = schedStats ? Math.floor(schedStats.totalCPUTime / 10) : 0
      const idleCpu = schedStats ? Math.floor(schedStats.idleCPUTime / 10) : 0
      const userCpu = Math.floor((totalCpu - idleCpu) * 0.6)
      const systemCpu = Math.floor((totalCpu - idleCpu) * 0.3)
      const iowait = Math.floor((totalCpu - idleCpu) * 0.1)
      const ctxt = schedStats?.contextSwitches ?? 0
      const procs = this.processManager?.totalProcessesCreated ?? 0
      return [
        `cpu  ${userCpu} 0 ${systemCpu} ${idleCpu} ${iowait} 0 0 0 0 0`,
        `cpu0 ${Math.floor(userCpu / 8)} 0 ${Math.floor(systemCpu / 8)} ${Math.floor(idleCpu / 8)} ${Math.floor(iowait / 8)} 0 0 0 0 0`,
        `intr ${ctxt * 2} 0 0 0 0 0 0 0 0 0`,
        `ctxt ${ctxt}`,
        `btime ${this.kernelInfo ? Math.floor(this.kernelInfo.bootTime / 1000) : 0}`,
        `processes ${procs}`,
        `procs_running ${this.processManager?.getRunningCount() ?? 0}`,
        `procs_blocked 0`,
        '',
      ].join('\n')
    }

    // /unproc/modules
    if (p === '/modules') {
      const modules = this.moduleManager?.list() ?? []
      return modules
        .filter(m => m.loaded)
        .map(m => `${m.name} ${m.size * 1024} ${m.refCount} ${m.dependencies.length > 0 ? m.dependencies.join(',') : '-'} Live 0x${(0xffffffffa0000000 + Math.floor(Math.random() * 0x10000000)).toString(16)}`)
        .join('\n') + '\n'
    }

    // /unproc/mounts
    if (p === '/mounts') {
      return [
        'unfs / unfs rw,relatime 0 0',
        'procfs /unproc procfs ro,relatime 0 0',
        'devfs /undev devfs rw,relatime 0 0',
        'tmpfs /untmp tmpfs rw,size=65536k 0 0',
        '',
      ].join('\n')
    }

    // /unproc/[pid]/status
    const pidStatusMatch = p.match(/^\/(\d+)\/status$/)
    if (pidStatusMatch) {
      const pid = parseInt(pidStatusMatch[1])
      const proc = this.processManager?.getByPid(pid)
      if (!proc) return null
      const stateChar = proc.state === 'running' ? 'R' : proc.state === 'sleeping' ? 'S' : proc.state === 'stopped' ? 'T' : proc.state === 'zombie' ? 'Z' : 'X'
      return [
        `Name:\t${proc.name}`,
        `State:\t${stateChar} (${proc.state})`,
        `Tgid:\t${proc.pid}`,
        `Pid:\t${proc.pid}`,
        `PPid:\t${proc.ppid}`,
        `Uid:\t${proc.uid}\t${proc.uid}\t${proc.uid}\t${proc.uid}`,
        `Gid:\t${proc.gid}\t${proc.gid}\t${proc.gid}\t${proc.gid}`,
        `VmSize:\t${proc.memoryVSZ} kB`,
        `VmRSS:\t${proc.memoryRSS} kB`,
        `Threads:\t1`,
        '',
      ].join('\n')
    }

    // /unproc/[pid]/cmdline
    const pidCmdlineMatch = p.match(/^\/(\d+)\/cmdline$/)
    if (pidCmdlineMatch) {
      const pid = parseInt(pidCmdlineMatch[1])
      const proc = this.processManager?.getByPid(pid)
      if (!proc) return null
      return proc.cmdline + '\n'
    }

    // /unproc/sys/kernel/*
    if (p === '/sys/kernel/hostname') return (this.kernelInfo?.hostname ?? '_unLAB') + '\n'
    if (p === '/sys/kernel/osrelease') return KERNEL_RELEASE + '\n'
    if (p === '/sys/kernel/version') return `#1 SMP PREEMPT_DYNAMIC ${KERNEL_ARCH}\n`

    return null
  }

  /** List dynamic entries for a /unproc directory */
  listDir(path: string): string[] | null {
    let p = path
    if (p.startsWith('/unproc')) p = p.slice(7)
    else if (p.startsWith('/proc')) p = p.slice(5)
    if (!p || p === '/') {
      // Root of /unproc — add PID directories
      const pids = this.processManager?.listAll().map(proc => String(proc.pid)) ?? []
      return pids
    }
    // /unproc/[pid] — list available pseudo-files
    const pidMatch = p.match(/^\/(\d+)$/)
    if (pidMatch) {
      const pid = parseInt(pidMatch[1])
      const proc = this.processManager?.getByPid(pid)
      if (!proc) return null
      return ['status', 'cmdline']
    }
    return null
  }
}

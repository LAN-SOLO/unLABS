// _unOS Kernel — Central Hub

import type { KernelInfo, KernelState, KernelSerializedState, SysctlEntry, DmesgEntry } from './types'
import { KERNEL_VERSION, KERNEL_RELEASE, KERNEL_ARCH, KERNEL_HOSTNAME, TOTAL_MEMORY_KB, DEFAULT_SYSCTL } from './constants'
import { DmesgBuffer } from './dmesg'
import { ProcessManager } from './process'
import { MemoryManager } from './memory'
import { Scheduler } from './scheduler'
import { SyscallManager } from './syscall'
import { IPCManager } from './ipc'
import { ModuleManager } from './modules'
import { ProcFS } from './procfs'

export class Kernel {
  readonly dmesg = new DmesgBuffer()
  readonly process = new ProcessManager()
  readonly memory = new MemoryManager()
  readonly scheduler = new Scheduler()
  readonly syscall = new SyscallManager()
  readonly ipc = new IPCManager()
  readonly modules = new ModuleManager()
  readonly procfs = new ProcFS()

  private info: KernelInfo
  private sysctl: SysctlEntry[]
  private tickHandle: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.info = {
      version: KERNEL_VERSION,
      release: KERNEL_RELEASE,
      hostname: KERNEL_HOSTNAME,
      arch: KERNEL_ARCH,
      bootTime: 0,
      bootParams: 'root=/unfs ro quiet splash',
      state: 'boot',
    }
    this.sysctl = DEFAULT_SYSCTL.map(s => ({ ...s }))
  }

  get state(): KernelState {
    return this.info.state
  }

  get bootTime(): number {
    return this.info.bootTime
  }

  get uptime(): number {
    if (this.info.bootTime === 0) return 0
    return Date.now() - this.info.bootTime
  }

  get hostname(): string {
    return this.info.hostname
  }

  /** Boot the kernel — generates dmesg entries for each boot phase */
  boot(): DmesgEntry[] {
    this.info.bootTime = Date.now()
    this.info.state = 'boot'

    // Initialize subsystems
    this.dmesg.init(this.info.bootTime)
    this.process.init(this.dmesg, this.info.bootTime)
    this.memory.init(this.dmesg, this.process)
    this.scheduler.init(this.process)
    this.ipc.init(this.process)
    this.modules.init(this.dmesg)
    this.procfs.init(this.process, this.memory, this.scheduler, this.modules, this.info, this.sysctl)

    // Boot sequence dmesg entries
    this.dmesg.write('INFO', 'kernel', `_unOS Kernel ${KERNEL_VERSION} booting...`)
    this.dmesg.write('INFO', 'kernel', `Command line: ${this.info.bootParams}`)
    this.dmesg.write('INFO', 'kernel', `Architecture: ${KERNEL_ARCH}`)
    this.dmesg.write('INFO', 'kernel', `Memory: ${TOTAL_MEMORY_KB}K available`)
    this.dmesg.write('INFO', 'kernel', `CPU: _unSC Quantum Core v2 (8 cores @ 4200 MHz)`)

    // Memory init
    this.dmesg.write('INFO', 'kernel', 'Memory: kernel reserved 2048000K')
    this.dmesg.write('INFO', 'kernel', 'Memory: device reserved 1024000K')
    this.dmesg.write('INFO', 'kernel', 'SLUB: HWalign=64, Order=0-3, MinObjects=0, CPUs=8, Nodes=1')

    // Scheduler
    this.dmesg.write('INFO', 'kernel', 'CFS scheduler initialized (8 runqueues)')

    // Syscalls
    this.dmesg.write('INFO', 'kernel', `Registered ${this.syscall.getTable().length} syscalls`)

    // Modules
    this.modules.loadAll()

    // Mount root filesystem
    this.dmesg.write('INFO', 'kernel', 'VFS: Mounted root (unfs) read-write on device 0:1')
    this.dmesg.write('INFO', 'kernel', 'Freeing unused kernel memory: 1024K')

    // Spawn processes
    this.process.spawnDaemons()
    this.dmesg.write('INFO', 'kernel', 'Started init as PID 1')

    // Block devices
    this.dmesg.write('INFO', 'kernel', 'Block device unsda registered: 64GB (253:0)')
    this.dmesg.write('INFO', 'kernel', ' unsda: unsda1 unsda2')
    this.dmesg.write('INFO', 'kernel', 'Block device unsdb registered: 128GB (253:16)')

    // Additional mounts
    this.dmesg.write('INFO', 'kernel', 'VFS: Mounted /unboot (ext4) read-only')
    this.dmesg.write('INFO', 'kernel', 'VFS: Mounted /unsys (sysfs)')
    this.dmesg.write('INFO', 'kernel', 'VFS: Mounted /unproc (procfs)')
    this.dmesg.write('INFO', 'kernel', 'VFS: Mounted /undev (devtmpfs)')

    // Networking
    this.dmesg.write('INFO', 'kernel', 'uneth0: link becomes ready')
    this.dmesg.write('INFO', 'kernel', 'uneth0: 10.0.0.100/24 via 10.0.0.254')

    // Systemd-style service init
    this.dmesg.write('INFO', 'kernel', 'systemd[1]: Started Journal Service')
    this.dmesg.write('INFO', 'kernel', 'systemd[1]: Loaded shell environment')
    this.dmesg.write('INFO', 'kernel', 'systemd[1]: Started Cron Scheduler')
    this.dmesg.write('INFO', 'kernel', 'systemd[1]: Reached target multi-user.target')

    // Initialize IPC between crystal-engine and blockchain-sync
    const procs = this.process.listAll()
    const crystalEngine = procs.find(p => p.name === 'crystal-engine')
    const blockchainSync = procs.find(p => p.name === 'blockchain-sync')
    if (crystalEngine && blockchainSync) {
      this.ipc.setupBootIPC(crystalEngine.pid, blockchainSync.pid)
    }

    this.dmesg.write('INFO', 'kernel', '_unOS boot complete')
    this.info.state = 'running'

    return this.dmesg.entries
  }

  /** Tick — called periodically to update subsystems */
  tick() {
    if (this.info.state !== 'running') return
    const dt = 2000 // Tick interval in ms
    this.process.tick(dt)
    this.scheduler.tick(dt)
    this.memory.tick()

    // Simulate some background syscall activity
    const daemonPids = this.process.listAll()
      .filter(p => p.state === 'sleeping' && p.uid !== 0)
      .map(p => p.pid)
      .slice(0, 5)
    if (daemonPids.length > 0) {
      this.syscall.simulateActivity(daemonPids)
    }
  }

  /** Start periodic ticking */
  startTicking(intervalMs: number = 2000) {
    if (this.tickHandle) return
    this.tickHandle = setInterval(() => this.tick(), intervalMs)
  }

  /** Stop periodic ticking */
  stopTicking() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle)
      this.tickHandle = null
    }
  }

  /** Execute a terminal command as a short-lived process */
  execCommand(name: string, args: string[], uid: number = 1001): number {
    const cmdline = `/unbin/${name} ${args.join(' ')}`.trim()
    const pid = this.process.spawn(name, cmdline, 2, { uid, tty: 'pts/0' }) // ppid=2 (unsh)

    // Record execve syscall
    this.syscall.invoke(59, pid, cmdline)

    return pid
  }

  /** Finish a command process */
  finishCommand(pid: number, exitCode: number) {
    // Record exit syscall
    this.syscall.invoke(60, pid, String(exitCode))
    this.process.exit(pid, exitCode)
  }

  /** Kernel panic */
  panic(reason: string) {
    this.info.state = 'panic'
    this.dmesg.write('EMERG', 'kernel', `Kernel panic - not syncing: ${reason}`)
    this.dmesg.write('EMERG', 'kernel', 'end Kernel panic - not syncing: ' + reason)
    this.stopTicking()
  }

  /** Graceful shutdown */
  shutdown() {
    this.dmesg.write('INFO', 'kernel', 'System going down for shutdown')
    this.info.state = 'shutdown'
    this.stopTicking()

    // Kill all processes except init
    for (const proc of this.process.listAll()) {
      if (proc.pid !== 1) {
        this.process.kill(proc.pid, 15) // SIGTERM
      }
    }
  }

  // --- Sysctl ---

  getSysctl(): SysctlEntry[] {
    return this.sysctl.map(s => ({ ...s }))
  }

  getSysctlValue(key: string): string | null {
    const entry = this.sysctl.find(s => s.key === key)
    return entry ? entry.value : null
  }

  setSysctlValue(key: string, value: string): { success: boolean; message: string } {
    const entry = this.sysctl.find(s => s.key === key)
    if (!entry) return { success: false, message: `sysctl: cannot stat /unproc/sys/${key.replace(/\./g, '/')}: No such file or directory` }
    if (!entry.writable) return { success: false, message: `sysctl: permission denied on key '${key}'` }
    entry.value = value
    // Apply special effects
    if (key === 'kernel.hostname') this.info.hostname = value
    return { success: true, message: `${key} = ${value}` }
  }

  // --- Uname ---

  getUname(): { sysname: string; nodename: string; release: string; version: string; machine: string } {
    return {
      sysname: '_unOS',
      nodename: this.info.hostname,
      release: this.info.release,
      version: `#1 SMP PREEMPT_DYNAMIC`,
      machine: this.info.arch,
    }
  }

  // --- Serialization ---

  toJSON(): KernelSerializedState {
    return {
      info: { ...this.info },
      dmesg: this.dmesg.toJSON(),
      processes: this.process.toJSON(),
      memoryStats: this.memory.toJSON(),
      schedulerStats: this.scheduler.toJSON(),
      modules: this.modules.toJSON(),
      syscallCounts: this.syscall.toJSON(),
      nextPid: this.process.getNextPid(),
      sysctl: this.sysctl.map(s => ({ ...s })),
    }
  }

  fromJSON(state: KernelSerializedState) {
    // Restore info
    this.info = { ...state.info }

    // Initialize subsystems with restored boot time
    this.dmesg.init(this.info.bootTime)
    this.dmesg.fromJSON(state.dmesg)

    this.process.init(this.dmesg, this.info.bootTime)
    this.process.fromJSON(state.processes)
    if (state.nextPid) this.process.setNextPid(state.nextPid)

    this.memory.init(this.dmesg, this.process)
    this.memory.fromJSON(state.memoryStats)

    this.scheduler.init(this.process)
    this.scheduler.fromJSON(state.schedulerStats)

    this.ipc.init(this.process)
    this.modules.init(this.dmesg)
    this.modules.fromJSON(state.modules)

    this.syscall.fromJSON(state.syscallCounts)

    if (state.sysctl) {
      this.sysctl = state.sysctl.map(s => ({ ...s }))
    }

    this.procfs.init(this.process, this.memory, this.scheduler, this.modules, this.info, this.sysctl)

    // If kernel was running, resume ticking
    if (this.info.state === 'running') {
      this.startTicking()
    }
  }
}

// Re-export all types
export type * from './types'
export { KERNEL_VERSION, KERNEL_RELEASE, KERNEL_ARCH, SIGNALS, SIGNAL_NAMES } from './constants'

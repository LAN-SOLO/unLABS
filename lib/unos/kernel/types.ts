// _unOS Kernel — Type definitions

export type ProcessState = 'running' | 'sleeping' | 'stopped' | 'zombie' | 'dead'

export interface KernelProcess {
  pid: number
  ppid: number
  name: string
  cmdline: string
  state: ProcessState
  uid: number
  gid: number
  priority: number
  nice: number
  startTime: number        // boot-relative ms
  cpuTime: number          // accumulated CPU ms
  memoryRSS: number        // KB
  memoryVSZ: number        // KB
  tty: string
  children: number[]
  exitCode?: number
}

export type KernelState = 'boot' | 'running' | 'shutdown' | 'panic'

export interface KernelInfo {
  version: string
  release: string
  hostname: string
  arch: string
  bootTime: number         // Date.now() at boot
  bootParams: string
  state: KernelState
}

export interface MemoryStats {
  totalKB: number
  freeKB: number
  availableKB: number
  buffersKB: number
  cachedKB: number
  swapTotalKB: number
  swapFreeKB: number
  slabKB: number
  kernelUsedKB: number
  userUsedKB: number
  deviceUsedKB: number
}

export interface SchedulerStats {
  contextSwitches: number
  loadAvg1: number
  loadAvg5: number
  loadAvg15: number
  totalCPUTime: number     // ms
  idleCPUTime: number      // ms
  runQueueLength: number
}

export type DmesgLevel = 'EMERG' | 'ALERT' | 'CRIT' | 'ERR' | 'WARNING' | 'NOTICE' | 'INFO' | 'DEBUG'

export interface DmesgEntry {
  timestamp: number        // boot-relative seconds
  level: DmesgLevel
  facility: string
  message: string
}

export interface KernelModule {
  name: string
  description: string
  version: string
  size: number             // KB
  dependencies: string[]
  loaded: boolean
  refCount: number
  params: Record<string, string>
}

export interface SyscallEntry {
  number: number
  name: string
  callCount: number
  lastCalled: number       // timestamp
}

export interface StraceEntry {
  timestamp: number
  pid: number
  syscall: string
  args: string
  ret: number
}

export interface Pipe {
  id: number
  readEnd: number          // pid
  writeEnd: number         // pid
  buffer: string[]
  capacity: number
}

export interface SharedMemorySegment {
  id: number
  key: number
  size: number
  owner: number            // pid
  attached: number[]       // pids
}

export interface MessageQueue {
  id: number
  key: number
  messages: { type: number; data: string }[]
  owner: number            // pid
}

export interface SysctlEntry {
  key: string
  value: string
  writable: boolean
}

export interface KernelSerializedState {
  info: KernelInfo
  dmesg: DmesgEntry[]
  processes: KernelProcess[]
  memoryStats: MemoryStats
  schedulerStats: SchedulerStats
  modules: KernelModule[]
  syscallCounts: { number: number; callCount: number }[]
  nextPid: number
  sysctl: SysctlEntry[]
}

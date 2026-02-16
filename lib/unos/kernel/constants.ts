// _unOS Kernel — Constants

export const KERNEL_VERSION = '6.1.0-_unSC'
export const KERNEL_RELEASE = '6.1.0-_unSC #1 SMP PREEMPT_DYNAMIC'
export const KERNEL_ARCH = 'un_x86_64'
export const KERNEL_HOSTNAME = '_unLAB'

export const TOTAL_MEMORY_KB = 16_384_000  // 16 GB
export const MAX_PID = 32768
export const INIT_PID = 1
export const DMESG_BUFFER_SIZE = 512
export const STRACE_BUFFER_SIZE = 256

// Syscall numbers (Linux x86_64 convention)
export const SYSCALL_TABLE: { number: number; name: string }[] = [
  { number: 0, name: 'read' },
  { number: 1, name: 'write' },
  { number: 2, name: 'open' },
  { number: 3, name: 'close' },
  { number: 4, name: 'stat' },
  { number: 5, name: 'fstat' },
  { number: 6, name: 'lstat' },
  { number: 7, name: 'poll' },
  { number: 8, name: 'lseek' },
  { number: 9, name: 'mmap' },
  { number: 10, name: 'mprotect' },
  { number: 11, name: 'munmap' },
  { number: 12, name: 'brk' },
  { number: 20, name: 'writev' },
  { number: 21, name: 'access' },
  { number: 22, name: 'pipe' },
  { number: 35, name: 'nanosleep' },
  { number: 39, name: 'getpid' },
  { number: 56, name: 'clone' },
  { number: 57, name: 'fork' },
  { number: 59, name: 'execve' },
  { number: 60, name: 'exit' },
  { number: 61, name: 'wait4' },
  { number: 62, name: 'kill' },
  { number: 63, name: 'uname' },
  { number: 72, name: 'fcntl' },
  { number: 78, name: 'getdents' },
  { number: 79, name: 'getcwd' },
  { number: 102, name: 'getuid' },
  { number: 110, name: 'getppid' },
  { number: 158, name: 'sched_yield' },
  { number: 231, name: 'exit_group' },
]

// Signal numbers
export const SIGNALS: Record<string, number> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGILL: 4,
  SIGTRAP: 5,
  SIGABRT: 6,
  SIGBUS: 7,
  SIGFPE: 8,
  SIGKILL: 9,
  SIGUSR1: 10,
  SIGSEGV: 11,
  SIGUSR2: 12,
  SIGPIPE: 13,
  SIGALRM: 14,
  SIGTERM: 15,
  SIGSTKFLT: 16,
  SIGCHLD: 17,
  SIGCONT: 18,
  SIGSTOP: 19,
  SIGTSTP: 20,
  SIGTTIN: 21,
  SIGTTOU: 22,
  SIGURG: 23,
  SIGXCPU: 24,
  SIGXFSZ: 25,
  SIGVTALRM: 26,
  SIGPROF: 27,
  SIGWINCH: 28,
  SIGIO: 29,
  SIGPWR: 30,
  SIGSYS: 31,
}

export const SIGNAL_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(SIGNALS).map(([k, v]) => [v, k])
)

// Default kernel modules
export const DEFAULT_MODULES: {
  name: string
  description: string
  version: string
  size: number
  dependencies: string[]
}[] = [
  { name: 'unfs', description: '_unOS Virtual Filesystem', version: '2.0.0', size: 1024, dependencies: [] },
  { name: 'unnet', description: '_unOS Network Stack', version: '2.0.0', size: 768, dependencies: [] },
  { name: 'undev', description: '_unOS Device Framework', version: '2.0.0', size: 512, dependencies: [] },
  { name: 'uncrypto', description: '_unOS Cryptographic Subsystem', version: '1.4.0', size: 384, dependencies: [] },
  { name: 'unquantum', description: 'Quantum Processing Module', version: '3.1.0', size: 2048, dependencies: ['uncrypto'] },
  { name: 'unsound', description: 'Audio Subsystem Driver', version: '1.2.0', size: 256, dependencies: ['undev'] },
  { name: 'uncrystal', description: 'Crystal Interface Driver', version: '2.0.0', size: 1536, dependencies: ['undev', 'unfs'] },
  { name: 'uncontain', description: 'Container Runtime Module', version: '1.0.0', size: 896, dependencies: ['unfs', 'unnet'] },
]

// Daemon processes spawned at boot
export const DAEMON_PROCESSES: {
  name: string
  cmdline: string
  uid: number
  memoryRSS: number
  memoryVSZ: number
  tty: string
  nice: number
}[] = [
  { name: 'init', cmdline: '/unbin/init', uid: 0, memoryRSS: 8192, memoryVSZ: 32768, tty: '?', nice: 0 },
  { name: 'unsh', cmdline: '/unbin/unsh --login', uid: 1001, memoryRSS: 4096, memoryVSZ: 16384, tty: 'pts/0', nice: 0 },
  { name: 'crystal-engine', cmdline: '/unusr/bin/crystal-engine --daemon', uid: 1001, memoryRSS: 65536, memoryVSZ: 131072, tty: '?', nice: -5 },
  { name: 'blockchain-sync', cmdline: '/unusr/bin/blockchain-sync --chain=solana', uid: 1001, memoryRSS: 32768, memoryVSZ: 65536, tty: '?', nice: 0 },
  { name: 'device-monitor', cmdline: '/unusr/bin/device-monitor --all', uid: 0, memoryRSS: 16384, memoryVSZ: 32768, tty: '?', nice: 0 },
  { name: 'tick-engine', cmdline: '/unusr/bin/tick-engine --interval=2000', uid: 1001, memoryRSS: 8192, memoryVSZ: 16384, tty: '?', nice: -10 },
  { name: 'volatility-tracker', cmdline: '/unusr/bin/volatility-tracker --tps', uid: 1001, memoryRSS: 12288, memoryVSZ: 24576, tty: '?', nice: 5 },
  { name: 'network-daemon', cmdline: '/unusr/bin/unnetd', uid: 0, memoryRSS: 8192, memoryVSZ: 16384, tty: '?', nice: 0 },
  { name: 'container-runtime', cmdline: '/unusr/bin/unpod-runtime', uid: 0, memoryRSS: 24576, memoryVSZ: 49152, tty: '?', nice: 0 },
  { name: 'quantum-monitor', cmdline: '/unusr/bin/quantum-monitor --qubits=127', uid: 1001, memoryRSS: 16384, memoryVSZ: 32768, tty: '?', nice: 5 },
  { name: 'kworker/0:0', cmdline: '[kworker/0:0-events]', uid: 0, memoryRSS: 512, memoryVSZ: 1024, tty: '?', nice: -20 },
  { name: 'kworker/0:1', cmdline: '[kworker/0:1-mm_percpu_wq]', uid: 0, memoryRSS: 512, memoryVSZ: 1024, tty: '?', nice: -20 },
  { name: 'ksoftirqd/0', cmdline: '[ksoftirqd/0]', uid: 0, memoryRSS: 256, memoryVSZ: 512, tty: '?', nice: -20 },
  { name: 'rcu_sched', cmdline: '[rcu_sched]', uid: 0, memoryRSS: 256, memoryVSZ: 512, tty: '?', nice: -20 },
  { name: 'kcompactd0', cmdline: '[kcompactd0]', uid: 0, memoryRSS: 256, memoryVSZ: 512, tty: '?', nice: 20 },
]

// Default sysctl values
export const DEFAULT_SYSCTL: { key: string; value: string; writable: boolean }[] = [
  { key: 'kernel.hostname', value: '_unLAB', writable: true },
  { key: 'kernel.osrelease', value: KERNEL_VERSION, writable: false },
  { key: 'kernel.ostype', value: '_unOS', writable: false },
  { key: 'kernel.pid_max', value: String(MAX_PID), writable: true },
  { key: 'kernel.threads-max', value: '256', writable: true },
  { key: 'kernel.sched_child_runs_first', value: '0', writable: true },
  { key: 'kernel.panic', value: '0', writable: true },
  { key: 'kernel.printk', value: '4 4 1 7', writable: true },
  { key: 'vm.swappiness', value: '60', writable: true },
  { key: 'vm.dirty_ratio', value: '20', writable: true },
  { key: 'vm.dirty_background_ratio', value: '10', writable: true },
  { key: 'vm.overcommit_memory', value: '0', writable: true },
  { key: 'vm.min_free_kbytes', value: '65536', writable: true },
  { key: 'net.ipv4.ip_forward', value: '1', writable: true },
  { key: 'net.ipv4.tcp_syncookies', value: '1', writable: true },
  { key: 'net.core.somaxconn', value: '4096', writable: true },
  { key: 'fs.file-max', value: '65536', writable: true },
  { key: 'fs.nr_open', value: '1048576', writable: false },
]

import type {
  UserBalance,
  Crystal,
  TechProgress,
  CommandHistoryEntry,
} from '@/app/(game)/terminal/actions/data'
import type {
  MintResult,
  CrystalDetails,
  RenameResult,
} from '@/app/(game)/terminal/actions/crystals'

export interface TerminalLine {
  id: string
  type: 'input' | 'output' | 'error' | 'system' | 'ascii'
  content: string
  timestamp: Date
}

export interface Command {
  name: string
  aliases?: string[]
  description: string
  usage?: string
  execute: (args: string[], context: CommandContext) => Promise<CommandResult>
}

// CDC Device state type for terminal sync
export type CDCDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface CDCDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  getState: () => {
    deviceState: CDCDeviceState
    statusMessage: string
    isPowered: boolean
    crystalCount: number
    sliceCount: number
    totalPower: number
    currentDraw: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    category: string
    priority: number
  }
}

// UEC Device state type for terminal sync
export type UECDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface UECDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  getState: () => {
    deviceState: UECDeviceState
    statusMessage: string
    isPowered: boolean
    volatilityTier: number
    tps: number
    energyOutput: number
    fieldStability: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    outputMax: number
    outputPerTier: number
    selfConsume: number
    standby: number
    category: string
    priority: number
  }
}

// BAT Device state type for terminal sync
export type BATDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown' | 'charging' | 'discharging'

export interface BATDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setAutoRegen: (enabled: boolean) => void
  getState: () => {
    deviceState: BATDeviceState
    statusMessage: string
    isPowered: boolean
    currentCharge: number
    chargePercent: number
    isCharging: boolean
    isDischarging: boolean
    cellHealth: number[]
    temperature: number
    autoRegen: boolean
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    capacity: number
    chargeRate: number
    dischargeRate: number
    selfDischarge: number
    standbyDrain: number
    category: string
    priority: number
  }
}

// HMS Device state type for terminal sync
export type HMSDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface HMSDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setKnobValue: (knob: 'pulse' | 'tempo' | 'freq', value: number) => void
  setWaveform: (type: 'sine' | 'square' | 'saw' | 'triangle') => void
  getState: () => {
    deviceState: HMSDeviceState
    statusMessage: string
    isPowered: boolean
    pulseValue: number
    tempoValue: number
    freqValue: number
    currentTier: number
    oscillatorCount: number
    waveformType: 'sine' | 'square' | 'saw' | 'triangle'
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    resonance: number
    category: string
    priority: number
  }
}

// ECR Device state type for terminal sync
export type ECRDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface ECRDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setKnobValue: (knob: 'pulse' | 'bloom', value: number) => void
  setRecording: (recording: boolean) => void
  getState: () => {
    deviceState: ECRDeviceState
    statusMessage: string
    isPowered: boolean
    pulseValue: number
    bloomValue: number
    tickerTap: number
    isRecording: boolean
    signalStrength: number
    currentTier: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    recording: number
    category: string
    priority: number
  }
}

// IPL Device state type for terminal sync
export type IPLDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface IPLDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  getState: () => {
    deviceState: IPLDeviceState
    statusMessage: string
    isPowered: boolean
    spectrumWidth: number
    interpolationAccuracy: number
    inputStreams: number
    predictionHorizon: number
    currentTier: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    predictive: number
    category: string
    priority: number
  }
}

// MFR Device state type for terminal sync
export type MFRDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface MFRDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  getState: () => {
    deviceState: MFRDeviceState
    statusMessage: string
    isPowered: boolean
    powerOutput: number
    stability: number
    plasmaTemp: number
    efficiency: number
    ringSpeed: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    startupCost: number
    efficiency: number
    category: string
    tier: number
  }
}

// VNT Device state type for terminal sync
export type VNTDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface VNTDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setFanSpeed: (fanId: 'cpu' | 'gpu', speed: number) => void
  setFanMode: (fanId: 'cpu' | 'gpu', mode: 'AUTO' | 'LOW' | 'MED' | 'HIGH') => void
  toggleFan: (fanId: 'cpu' | 'gpu', on: boolean) => void
  emergencyPurge: () => Promise<void>
  getState: () => {
    deviceState: VNTDeviceState
    statusMessage: string
    isPowered: boolean
    cpuFan: { speed: number; rpm: number; mode: string; isOn: boolean }
    gpuFan: { speed: number; rpm: number; mode: string; isOn: boolean }
    cpuTemp: number
    gpuTemp: number
    currentDraw: number
    filterHealth: number
    airQuality: number
    humidity: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    emergency: number
    category: string
    priority: number
  }
}

// AIC Device state type for terminal sync
export type AICDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface AICDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setLearningMode: (enabled: boolean) => void
  getState: () => {
    deviceState: AICDeviceState
    statusMessage: string
    isPowered: boolean
    taskQueue: number
    efficiency: number
    isLearning: boolean
    nodeActivity: number[]
    anomalyCount: number
    uptime: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    learning: number
    category: string
    priority: number
  }
}

// EXD Device state type for terminal sync
export type EXDDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface EXDDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  deploy: () => void
  recall: () => void
  getState: () => {
    deviceState: EXDDeviceState
    statusMessage: string
    isPowered: boolean
    range: number
    battery: number
    altitude: number
    speed: number
    gpsSignal: number
    cargoLoad: number
    flightTime: number
    radarActive: boolean
    isDeployed: boolean
    currentDraw: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    highSpeed: number
    category: string
    priority: number
  }
}

// SCA Device state type for terminal sync
export type SCADeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface SCADeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  getState: () => {
    deviceState: SCADeviceState
    statusMessage: string
    isPowered: boolean
    flops: number
    utilization: number
    activeNodes: number
    jobQueue: number
    temperature: number
    memoryUsage: number
    interconnectBandwidth: number
    uptime: number
    currentDraw: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    benchmark: number
    category: string
    priority: number
  }
}

// EMC Device state type for terminal sync
export type EMCDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface EMCDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  getState: () => {
    deviceState: EMCDeviceState
    statusMessage: string
    isPowered: boolean
    units: number
    stability: number
    fieldStrength: number
    temperature: number
    isContained: boolean
    currentDraw: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    scan: number
    category: string
    priority: number
  }
}

// QUA Device state type for terminal sync
export type QUADeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface QUADeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setMode: (mode: 'ANOMALY' | 'RESOURCE' | 'DECRYPT' | 'DIAGNOSE' | 'SIMULATE' | 'SCAN') => void
  setSensitivity: (value: number) => void
  setDepth: (value: number) => void
  setFrequency: (value: number) => void
  getState: () => {
    deviceState: QUADeviceState
    statusMessage: string
    isPowered: boolean
    mode: string
    sensitivity: number
    depth: number
    frequency: number
    coherence: number
    isAnalyzing: boolean
    currentDraw: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    analysis: number
    category: string
    priority: number
  }
}

// QSM Device state type for terminal sync
export type QSMDeviceStateTerm = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface QSMDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  getState: () => {
    deviceState: QSMDeviceStateTerm
    statusMessage: string
    isPowered: boolean
    coherence: number
    qubits: number
    isEntangled: boolean
    currentDraw: number
    errorRate: number
    temperature: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    scan: number
    category: string
    priority: number
  }
}

// BTK Device state type for terminal sync
export type BTKDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface BTKDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  getState: () => {
    deviceState: BTKDeviceState
    statusMessage: string
    isPowered: boolean
    currentDraw: number
    selectedTool: string | null
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    category: string
    priority: number
  }
}

// PWB Device state type for terminal sync
export type PWBDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'

export interface PWBDeviceActions {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  getState: () => {
    deviceState: PWBDeviceState
    statusMessage: string
    isPowered: boolean
    currentDraw: number
    activeSlot: number | null
    queuedItems: number
    craftingProgress: number
  }
  getFirmware: () => {
    version: string
    build: string
    checksum: string
    features: string[]
    securityPatch: string
  }
  getPowerSpecs: () => {
    full: number
    idle: number
    standby: number
    category: string
    priority: number
  }
}

// ScrewButton types for terminal sync
export type ScrewButtonId = 'SB-01' | 'SB-02' | 'SB-03' | 'SB-04'

export interface ScrewButtonDeviceActions {
  activate: (id: ScrewButtonId) => Promise<boolean>
  deactivate: (id: ScrewButtonId) => Promise<boolean>
  isUnlocked: (id: ScrewButtonId) => boolean
  isActive: (id: ScrewButtonId) => boolean
  getState: (id: ScrewButtonId) => { unlocked: boolean; active: boolean; unlockedAt: number | null; activatedAt: number | null; totalActiveTime: number }
  getAllStates: () => Record<ScrewButtonId, { unlocked: boolean; active: boolean; unlockedAt: number | null; activatedAt: number | null; totalActiveTime: number }>
  getNodeSyncStats: () => { connectedNodes: number; totalNodes: number; syncRate: string; hashRate: string; latency: string; uptime: string; lastSync: string; peersOnline: number; bandwidthIn: string; bandwidthOut: string }
  getPoolStats: () => { poolName: string; members: number; maxMembers: number; totalHashRate: string; yourContribution: string; pendingRewards: number; blocksFound: number; efficiency: string; uptime: string }
  getMeshCastStats: () => { activeBroadcasts: number; receivedBuffs: string[]; networkReach: number; signalStrength: string; memesGenerated: number; memesReceived: number; bandwidth: string }
  getBridgeStats: () => { linkedLab: string; bridgeStability: string; entanglementFidelity: string; dataTransferred: string; sharedCrystals: number; coAssemblies: number; chatMessages: number; bridgeUptime: string; quantumChannel: string }
  getFeature: (id: ScrewButtonId) => { id: ScrewButtonId; name: string; fullName: string; description: string; unlockRequirement: string; activationCost: number }
}

export interface ThemeActions {
  list: () => { name: string; fg: string; index: number }[]
  get: () => { name: string; fg: string; index: number }
  set: (index: number) => void
  getByName: (name: string) => number | null
}

export interface FilesystemActions {
  getCwd: () => string
  ls: (path?: string, flags?: { long?: boolean; all?: boolean }) => string[]
  cd: (path: string) => string | null
  cat: (path: string, user: string, groups: string[]) => string | null
  mkdir: (path: string, parents?: boolean) => string | null
  touch: (path: string) => string | null
  rm: (path: string, recursive?: boolean) => string | null
  tree: (path?: string, depth?: number) => string[]
  stat: (path: string) => { permissions: number; owner: string; group: string; size: number; modified: number; type: string } | null
  chmod: (path: string, mode: number) => string | null
  chown: (path: string, owner: string, group?: string) => string | null
  cp: (src: string, dest: string, recursive?: boolean) => string | null
  mv: (src: string, dest: string) => string | null
  ln: (target: string, linkName: string, symbolic?: boolean) => string | null
  head: (path: string, lines?: number) => string | null
  tail: (path: string, lines?: number) => string | null
  write: (path: string, content: string) => string | null
  pwd: () => string
  resolve: (path: string) => boolean
  formatPermissions: (path: string) => string | null
  toJSON: () => string
}

export interface UserActions {
  whoami: () => string
  id: (username?: string) => string
  su: (targetUser: string, password?: string) => { success: boolean; message: string }
  sudo: (callback: () => void) => boolean
  canSudo: () => boolean
  isRoot: () => boolean
  passwd: (user: string, newPass: string) => { success: boolean; message: string }
  useradd: (name: string, opts?: { uid?: number; groups?: string[]; home?: string }) => { success: boolean; message: string }
  userdel: (name: string) => { success: boolean; message: string }
  usermod: (name: string, opts: { groups?: string[] }) => { success: boolean; message: string }
  groups: (user?: string) => string
  getCurrentUser: () => { uid: number; username: string; groups: string[]; home: string; isRoot: boolean }
  verifyPassword: (username: string, password: string) => boolean
  toJSON: () => string
}

export interface DataFetchers {
  fetchBalance: () => Promise<UserBalance | null>
  fetchCrystals: () => Promise<Crystal[]>
  fetchResearchProgress: () => Promise<TechProgress[]>
  fetchCommandHistory: (limit?: number) => Promise<CommandHistoryEntry[]>
  fetchVolatility: () => Promise<{ tps: number; tier: string; block_time_ms: number } | null>
  logCommand: (
    command: string,
    args: string[],
    output: string,
    success: boolean,
    executionTimeMs: number
  ) => Promise<void>
  mintCrystal: (name: string) => Promise<MintResult>
  fetchCrystalByName: (name: string) => Promise<CrystalDetails | null>
  renameCrystal: (oldName: string, newName: string) => Promise<RenameResult>
  // Panel state save/restore
  saveAllDeviceState?: () => void
  // Device actions for bidirectional sync
  cdcDevice?: CDCDeviceActions
  uecDevice?: UECDeviceActions
  batDevice?: BATDeviceActions
  hmsDevice?: HMSDeviceActions
  ecrDevice?: ECRDeviceActions
  iplDevice?: IPLDeviceActions
  mfrDevice?: MFRDeviceActions
  aicDevice?: AICDeviceActions
  vntDevice?: VNTDeviceActions
  scaDevice?: SCADeviceActions
  exdDevice?: EXDDeviceActions
  emcDevice?: EMCDeviceActions
  qsmDevice?: QSMDeviceActions
  quaDevice?: QUADeviceActions
  pwbDevice?: PWBDeviceActions
  btkDevice?: BTKDeviceActions
  // Screw button actions
  screwButtons?: ScrewButtonDeviceActions
  // Filesystem and user management
  filesystemActions?: FilesystemActions
  userActions?: UserActions
  // Theme management
  themeActions?: ThemeActions
}

export interface CommandContext {
  userId: string
  username: string | null
  balance: number
  addOutput: (content: string, type?: TerminalLine['type']) => void
  clearScreen: () => void
  setTyping: (typing: boolean) => void
  data: DataFetchers
}

export interface CommandResult {
  success: boolean
  output?: string[]
  error?: string
  navigate?: string  // URL to navigate to after command execution
  clearPanelAccess?: boolean  // Clear panel access token
  refresh?: boolean  // Force page refresh after command execution
}

export interface TerminalState {
  lines: TerminalLine[]
  history: string[]
  historyIndex: number
  isTyping: boolean
}

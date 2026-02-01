const STORAGE_KEY = 'unlabs_panel_state'

export interface PanelSaveData {
  version: 1
  timestamp: number
  filesystem?: string
  users?: string
  themeIndex?: number
  devices: {
    cdc: { isPowered: boolean; isExpanded?: boolean }
    uec: { isPowered: boolean; isExpanded?: boolean }
    bat: { isPowered: boolean; currentCharge: number; autoRegen: boolean; isExpanded?: boolean }
    hms: { isPowered: boolean; pulseValue: number; tempoValue: number; freqValue: number; waveformType: string; isExpanded?: boolean }
    ecr: { isPowered: boolean; pulseValue: number; bloomValue: number; isRecording: boolean; isExpanded?: boolean }
    ipl: { isPowered: boolean; isExpanded?: boolean }
    mfr: { isPowered: boolean; isExpanded?: boolean }
    aic: { isPowered: boolean; isLearning: boolean; isExpanded?: boolean }
    vnt: { isPowered: boolean; cpuFanSpeed: number; gpuFanSpeed: number; fanMode: string; isExpanded?: boolean }
    sca: { isPowered: boolean; isExpanded?: boolean }
    exd: { isPowered: boolean; isDeployed: boolean; isExpanded?: boolean }
    emc?: { isPowered: boolean; isExpanded?: boolean }
    qsm?: { isPowered: boolean; isExpanded?: boolean }
    qua?: { isPowered: boolean; mode?: string; sensitivity?: number; depth?: number; frequency?: number; isExpanded?: boolean }
    pwb?: { isPowered: boolean; isExpanded?: boolean }
    btk?: { isPowered: boolean; isExpanded?: boolean }
    rmg?: { isPowered: boolean; strength?: number; isExpanded?: boolean }
    msc?: { isPowered: boolean; isExpanded?: boolean }
    net?: { isPowered: boolean; bandwidth?: number; latencyMs?: number; isExpanded?: boolean }
    tmp?: { isPowered: boolean; temperature?: number; isExpanded?: boolean }
    dim?: { isPowered: boolean; dimension?: number; stability?: number; isExpanded?: boolean }
    cpu?: { isPowered: boolean; cores?: number; utilization?: number; frequency?: number; isExpanded?: boolean }
    clk?: { isPowered: boolean; displayMode?: string; isExpanded?: boolean }
    mem?: { isPowered: boolean; totalMemory?: number; usedMemory?: number; displayMode?: string; isExpanded?: boolean }
    and?: { isPowered: boolean; signalStrength?: number; anomaliesFound?: number; displayMode?: string; isExpanded?: boolean }
    qcp?: { isPowered: boolean; anomalyDirection?: number; anomalyDistance?: number; displayMode?: string; isExpanded?: boolean }
    tlp?: { isPowered: boolean; chargeLevel?: number; lastDestination?: string; displayMode?: string; isExpanded?: boolean }
    lct?: { isPowered: boolean; laserPower?: number; precision?: number; displayMode?: string; isExpanded?: boolean }
    p3d?: { isPowered: boolean; progress?: number; layerCount?: number; bedTemp?: number; displayMode?: string; isExpanded?: boolean }
    spk?: { isPowered: boolean; volume?: number; isMuted?: boolean; filters?: { bass: boolean; mid: boolean; high: boolean }; isExpanded?: boolean }
    dgn?: { isPowered: boolean; category?: string; scanDepth?: number; isExpanded?: boolean }
    screwButtons?: { [key: string]: { unlocked: boolean; active: boolean; totalActiveTime: number } }
  }
}

export function savePanelState(data: PanelSaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadPanelState(): PanelSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return null
    return parsed as PanelSaveData
  } catch {
    return null
  }
}

export function clearPanelState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

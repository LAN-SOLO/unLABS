const STORAGE_KEY = 'unlabs_panel_state'

export interface PanelSaveData {
  version: 1
  timestamp: number
  filesystem?: string
  users?: string
  themeIndex?: number
  devices: {
    cdc: { isPowered: boolean }
    uec: { isPowered: boolean }
    bat: { isPowered: boolean; currentCharge: number; autoRegen: boolean }
    hms: { isPowered: boolean; pulseValue: number; tempoValue: number; freqValue: number; waveformType: string }
    ecr: { isPowered: boolean; pulseValue: number; bloomValue: number; isRecording: boolean }
    ipl: { isPowered: boolean }
    mfr: { isPowered: boolean }
    aic: { isPowered: boolean; isLearning: boolean }
    vnt: { isPowered: boolean; cpuFanSpeed: number; gpuFanSpeed: number; fanMode: string }
    sca: { isPowered: boolean }
    exd: { isPowered: boolean; isDeployed: boolean }
    emc?: { isPowered: boolean }
    qsm?: { isPowered: boolean }
    qua?: { isPowered: boolean; mode?: string; sensitivity?: number; depth?: number; frequency?: number }
    pwb?: { isPowered: boolean }
    btk?: { isPowered: boolean }
    rmg?: { isPowered: boolean; strength?: number }
    msc?: { isPowered: boolean }
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

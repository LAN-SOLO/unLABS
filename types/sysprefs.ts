// =================================
// SYSPREFS APPLICATION TYPES
// =================================

// --- Enums / Unions ---

export type ThemeId = 'green' | 'amber' | 'cyan' | 'white' | 'red' | 'purple' | 'custom'

export type SoundProfileId = 'standard' | 'retro' | 'minimal' | 'scifi' | 'silent'

export type CursorStyle = 'block' | 'underline' | 'bar'

export type PromptStyle = 'standard' | 'minimal' | 'full' | 'custom'

export type ConnectionQuality = 'auto' | 'low' | 'medium' | 'high'

export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'full'

export type TimeFormat = '12' | '24'

export type FirstDayOfWeek = 'monday' | 'sunday'

export type PreferredRegion = 'auto' | 'us-east' | 'us-west' | 'eu-west' | 'eu-central' | 'asia-east'

export type SysprefAuditArea = 'display' | 'sound' | 'datetime' | 'network' | 'user' | 'system'

export type SysprefArea = 'display' | 'sound' | 'datetime' | 'network'

// --- Application Interfaces ---

export interface DisplayPreferences {
  theme: ThemeId
  primaryColor: string
  secondaryColor: string
  backgroundColor: string

  effectScanlines: boolean
  effectCurvature: boolean
  effectFlicker: boolean
  effectGlowIntensity: number
  effectGlitch: boolean
  effectMatrixRain: boolean

  fontFamily: string
  fontSize: number
  lineSpacing: number
  letterSpacing: number

  terminalColumns: number
  terminalRows: number
  promptStyle: PromptStyle
  cursorStyle: CursorStyle
  cursorBlink: boolean

  plainMode: boolean
  highContrast: boolean
  largeText: boolean
  reducedMotion: boolean
}

export interface SoundPreferences {
  masterVolume: number
  muted: boolean
  soundProfile: SoundProfileId

  terminalClicks: boolean
  terminalClicksVolume: number
  commandBeeps: boolean
  commandBeepsVolume: number
  errorBuzzer: boolean
  errorBuzzerVolume: number
  successChime: boolean
  successChimeVolume: number
  tabCompleteSound: boolean
  tabCompleteVolume: number

  backgroundHum: boolean
  backgroundHumVolume: number
  idleStatic: boolean
  idleStaticVolume: number
  deviceWhir: boolean
  deviceWhirVolume: number
  quantumWhisper: boolean
  quantumWhisperVolume: number

  notificationResearchComplete: boolean
  notificationTradeAccepted: boolean
  notificationVolatilityAlert: boolean
  notificationQuestComplete: boolean
  notificationVolume: number
  voiceAlerts: boolean
}

export interface DatetimePreferences {
  timezone: string
  timeFormat: TimeFormat
  showSeconds: boolean
  showMilliseconds: boolean
  dateFormat: DateFormat
  firstDayOfWeek: FirstDayOfWeek
}

export interface NetworkPreferences {
  autoReconnect: boolean
  pingIntervalSeconds: number
  preferredRegion: PreferredRegion | null
  connectionQuality: ConnectionQuality
  notifyConnectionLost: boolean
  notifyServerRestart: boolean
}

export interface SystemInfo {
  osVersion: string
  osCodename: string
  osBuild: string
  kernelVersion: string
  cpuModel: string
  cpuCores: number
  memoryTotalGb: number
  storageSlotsTotal: number
  hostname: string
  ntpEnabled: boolean
  ntpServers: string[]
  ntpIntervalSeconds: number
  lastNtpSync: string | null
  dnsServers: string[]
  dnsSearchDomain: string | null
  firewallEnabled: boolean
  firewallDefaultIncoming: string
  firewallDefaultOutgoing: string
  firewallAllowedPorts: string[]
  gameServerUrl: string
  blockchainProxyUrl: string
  oracleFeedUrl: string
}

export interface AllPreferences {
  display: DisplayPreferences
  sound: SoundPreferences
  datetime: DatetimePreferences
  network: NetworkPreferences
}

export interface DisplayTheme {
  id: string
  name: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  description: string | null
  isDefault: boolean
  sortOrder: number
}

export interface DisplayFont {
  id: string
  name: string
  style: string
  license: string
  cssImportUrl: string | null
  isDefault: boolean
  sortOrder: number
}

export interface SoundProfile {
  id: string
  name: string
  description: string | null
  settings: Record<string, unknown>
  isDefault: boolean
  sortOrder: number
}

export interface SysprefAuditEntry {
  id: string
  playerId: string | null
  area: SysprefAuditArea
  settingKey: string
  oldValue: string | null
  newValue: string | null
  changedBy: string | null
  changeReason: string | null
  changedAt: string
}

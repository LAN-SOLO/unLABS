export type SystemPowerState = 'running' | 'countdown' | 'shutting-down' | 'rebooting' | 'booting' | 'off'
export type PowerAction = 'shutdown' | 'reboot'
/** 'os' = _unOS/terminal only, 'system' = full system */
export type PowerScope = 'os' | 'system'

export interface ParsedTime {
  seconds: number
  wasAdjusted: boolean
  original: string
  error?: string
  errorCode?: string
}

export interface SystemPowerContextValue {
  systemState: SystemPowerState
  countdownSeconds: number | null
  countdownAction: PowerAction | null
  powerScope: PowerScope | null
  scheduleShutdown: (seconds: number, scope?: PowerScope) => void
  scheduleReboot: (seconds: number, scope?: PowerScope) => void
  shutdownNow: (scope?: PowerScope) => void
  rebootNow: (scope?: PowerScope) => void
  cancelCountdown: () => void
  powerOn: (scope?: PowerScope) => void
  finishBoot: () => void
}

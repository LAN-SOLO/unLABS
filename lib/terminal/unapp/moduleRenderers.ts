import type { CommandContext } from '@/lib/terminal/types'
import type { AppRegistryEntry } from '@/types/unapp'

// Device ID → context key mapping
const DEVICE_CTX_MAP: Record<string, string> = {
  'UEC-001': 'uecDevice', 'CDC-001': 'cdcDevice', 'BAT-001': 'batDevice',
  'HMS-001': 'hmsDevice', 'ECR-001': 'ecrDevice', 'MFR-001': 'mfrDevice',
  'AIC-001': 'aicDevice', 'VNT-001': 'vntDevice', 'SCA-001': 'scaDevice',
  'EXD-001': 'exdDevice', 'EMC-001': 'emcDevice', 'QSM-001': 'qsmDevice',
  'BTK-001': 'btkDevice', 'RMG-001': 'rmgDevice', 'MSC-001': 'mscDevice',
  'NET-001': 'netDevice', 'TMP-001': 'tmpDevice', 'DIM-001': 'dimDevice',
  'CPU-001': 'cpuDevice', 'CLK-001': 'clkDevice', 'MEM-001': 'memDevice',
  'AND-001': 'andDevice', 'QCP-001': 'qcpDevice', 'TLP-001': 'tlpDevice',
  'LCT-001': 'lctDevice', 'P3D-001': 'p3dDevice', 'SPK-001': 'spkDevice',
  'DGN-001': 'dgnDevice', 'INT-001': 'iplDevice',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDeviceActions(deviceId: string, ctx: CommandContext): any {
  const key = DEVICE_CTX_MAP[deviceId]
  if (!key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctx.data as any)[key] ?? null
}

function bar(value: number, max: number, width: number = 10): string {
  const filled = Math.round((value / max) * width)
  return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(width - filled, 0))
}

export function renderStatusModule(deviceId: string, ctx: CommandContext, app: AppRegistryEntry): string[] {
  const dev = getDeviceActions(deviceId, ctx)
  if (!dev) {
    return [
      '  STATUS MODULE',
      '  ─────────────────────────',
      `  Device ${deviceId} not available in current session.`,
      '  Ensure the device panel is loaded.',
    ]
  }
  const state = dev.getState()
  const fw = dev.getFirmware?.()
  const power = dev.getPowerSpecs?.()

  const lines = [
    '  STATUS OVERVIEW',
    '  ─────────────────────────',
    `  Device:       ${app.name}`,
    `  ID:           ${deviceId}`,
    `  State:        ${state.deviceState?.toUpperCase() ?? 'UNKNOWN'}`,
    `  Power:        ${state.isPowered ? 'ON' : 'OFF'}`,
    `  Message:      ${state.statusMessage ?? '-'}`,
  ]

  if (fw) {
    lines.push(`  Firmware:     v${fw.version} (${fw.build})`)
  }
  if (power) {
    if (power.category) lines.push(`  Category:     ${power.category}`)
  }

  // Add device-specific status fields
  if (state.energyOutput !== undefined) lines.push(`  Energy Out:   ${state.energyOutput} E/s`)
  if (state.fieldStability !== undefined) lines.push(`  Stability:    ${bar(state.fieldStability, 100)} ${state.fieldStability}%`)
  if (state.currentCharge !== undefined) lines.push(`  Charge:       ${bar(state.chargePercent ?? 0, 100)} ${state.chargePercent ?? 0}%`)
  if (state.temperature !== undefined) lines.push(`  Temperature:  ${state.temperature}°C`)
  if (state.utilization !== undefined) lines.push(`  Utilization:  ${bar(state.utilization, 100)} ${state.utilization}%`)
  if (state.coherence !== undefined) lines.push(`  Coherence:    ${bar(state.coherence, 100)} ${state.coherence}%`)
  if (state.currentDraw !== undefined) lines.push(`  Power Draw:   ${state.currentDraw}W`)

  return lines
}

export function renderConfigModule(deviceId: string, _ctx: CommandContext, app: AppRegistryEntry): string[] {
  return [
    '  CONFIGURATION',
    '  ─────────────────────────',
    `  App:          ${app.name}`,
    `  Version:      ${app.version}`,
    `  Auto-install: ${app.auto_install ? 'YES' : 'NO'}`,
    `  Permissions:  ${app.permissions.join(', ')}`,
    '',
    '  No custom configuration loaded.',
    '  Use unapp config <app-id> set <key> <value> to configure.',
  ]
}

export function renderDiagnosticsModule(deviceId: string, ctx: CommandContext, app: AppRegistryEntry): string[] {
  const dev = getDeviceActions(deviceId, ctx)
  if (!dev) {
    return [
      '  DIAGNOSTICS',
      '  ─────────────────────────',
      `  Device ${deviceId} unavailable.`,
    ]
  }
  const state = dev.getState()
  const isPowered = state.isPowered ?? false

  return [
    '  DIAGNOSTICS',
    '  ─────────────────────────',
    `  Target:       ${app.name} [${deviceId}]`,
    `  Power State:  ${isPowered ? 'ONLINE' : 'OFFLINE'}`,
    '',
    `  [${isPowered ? '✓' : '✗'}] Power subsystem`,
    `  [${isPowered ? '✓' : '─'}] Communication bus`,
    `  [${isPowered ? '✓' : '─'}] Memory integrity`,
    `  [${isPowered ? '✓' : '─'}] Sensor calibration`,
    `  [${isPowered ? '✓' : '─'}] Firmware checksum`,
    '',
    `  Result: ${isPowered ? 'ALL CHECKS PASSED' : 'DEVICE OFFLINE — power on to run diagnostics'}`,
  ]
}

export function renderFirmwareModule(deviceId: string, ctx: CommandContext, app: AppRegistryEntry): string[] {
  const dev = getDeviceActions(deviceId, ctx)
  const fw = dev?.getFirmware?.()

  const lines = [
    '  FIRMWARE MANAGEMENT',
    '  ─────────────────────────',
    `  App Version:  ${app.version}`,
  ]

  if (fw) {
    lines.push(
      `  FW Version:   ${fw.version}`,
      `  Build:        ${fw.build}`,
      `  Checksum:     ${fw.checksum}`,
      `  Sec. Patch:   ${fw.securityPatch}`,
      `  Features:     ${fw.features.join(', ')}`,
    )
  } else {
    lines.push('  Firmware data unavailable.')
  }

  lines.push('', '  No updates available.')
  return lines
}

export function renderQuickStatus(deviceId: string, ctx: CommandContext, app: AppRegistryEntry): string {
  const dev = getDeviceActions(deviceId, ctx)
  if (!dev) return `${app.app_id} ${app.name.padEnd(25)} [UNAVAILABLE]`
  const state = dev.getState()
  const status = state.isPowered ? 'ONLINE' : 'OFFLINE'
  const extra: string[] = []
  if (state.energyOutput !== undefined) extra.push(`${state.energyOutput}E/s`)
  if (state.chargePercent !== undefined) extra.push(`${state.chargePercent}%`)
  if (state.utilization !== undefined) extra.push(`${state.utilization}%util`)
  if (state.temperature !== undefined) extra.push(`${state.temperature}°C`)
  const suffix = extra.length > 0 ? ` (${extra.join(', ')})` : ''
  return `${app.app_id}  ${app.name.padEnd(25)} ${status.padEnd(10)}${suffix}`
}

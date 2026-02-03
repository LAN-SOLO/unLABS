import type { CommandContext } from '@/lib/terminal/types'
import type { AppRegistryEntry } from '@/types/unapp'
import {
  renderStatusModule,
  renderConfigModule,
  renderDiagnosticsModule,
  renderFirmwareModule,
  renderQuickStatus,
} from './moduleRenderers'
import { getDeviceModules } from './deviceApps'

const STANDARD_MODULES: Record<string, (deviceId: string, ctx: CommandContext, app: AppRegistryEntry) => string[]> = {
  'status': renderStatusModule,
  'config': renderConfigModule,
  'diagnostics': renderDiagnosticsModule,
  'firmware': renderFirmwareModule,
}

export function renderAppHeader(app: AppRegistryEntry): string[] {
  const title = `${app.app_id} — ${app.name}`
  const ver = `v${app.version}`
  const device = app.device_id ? `DEVICE: ${app.device_id}` : 'SYSTEM APP'
  const innerWidth = Math.max(title.length + ver.length + 6, device.length + 20)

  return [
    '',
    '╔' + '═'.repeat(innerWidth + 2) + '╗',
    '║  ' + title + ' '.repeat(innerWidth - title.length - ver.length) + ver + ' ║',
    '║  ' + device + ' '.repeat(innerWidth - device.length) + ' ║',
    '╚' + '═'.repeat(innerWidth + 2) + '╝',
    '',
  ]
}

export function renderModuleMenu(app: AppRegistryEntry): string[] {
  const lines = ['  MODULES:']
  const mods = app.modules
  const cols = 2
  for (let i = 0; i < mods.length; i += cols) {
    const items = mods.slice(i, i + cols).map((m, j) => {
      const num = `[${i + j + 1}]`
      const label = m.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      return `${num} ${label}`.padEnd(30)
    })
    lines.push('  ' + items.join(''))
  }
  lines.push('')
  lines.push('  Use: unapp run ' + app.app_id + ' --module <name>')
  return lines
}

export function renderApp(app: AppRegistryEntry, moduleName: string | null, ctx: CommandContext, quick: boolean): string[] {
  // Quick mode: single-line status
  if (quick) {
    return [renderQuickStatus(app.device_id ?? app.app_id, ctx, app)]
  }

  const header = renderAppHeader(app)
  const targetModule = (moduleName ?? 'status').toLowerCase()

  // Try standard modules first
  if (STANDARD_MODULES[targetModule] && app.device_id) {
    return [
      ...header,
      ...STANDARD_MODULES[targetModule](app.device_id, ctx, app),
      '',
      ...renderModuleMenu(app),
    ]
  }

  // Try device-specific custom modules
  if (app.device_id) {
    const customModules = getDeviceModules(app.app_id)
    if (customModules && customModules[targetModule]) {
      return [
        ...header,
        ...customModules[targetModule](ctx, app),
        '',
        ...renderModuleMenu(app),
      ]
    }
  }

  // System/utility apps or unknown module — render generic
  const sysModules = getDeviceModules(app.app_id)
  if (sysModules && sysModules[targetModule]) {
    return [
      ...header,
      ...sysModules[targetModule](ctx, app),
      '',
      ...renderModuleMenu(app),
    ]
  }

  // Default: show status for device apps, or module menu for others
  if (app.device_id && targetModule === 'status') {
    return [
      ...header,
      ...renderStatusModule(app.device_id, ctx, app),
      '',
      ...renderModuleMenu(app),
    ]
  }

  return [
    ...header,
    `  Module '${targetModule}' not found for ${app.app_id}.`,
    '',
    ...renderModuleMenu(app),
  ]
}

'use client'

import type { DeviceListItem as DeviceListItemData, DeviceCategory } from '@/types/devices'

interface DeviceListItemProps {
  device: DeviceListItemData
  selected?: boolean
  onClick: (device_id: string) => void
}

const STATE_COLORS: Record<string, string> = {
  online: 'text-green-400',
  standby: 'text-amber-400',
  offline: 'text-green-500/30',
  error: 'text-red-500',
  upgrading: 'text-cyan-400',
}

const STATE_LABELS: Record<string, string> = {
  online: 'ONLINE',
  standby: 'STNBY',
  offline: 'OFF',
  error: 'ERROR',
  upgrading: 'UPGRD',
}

const CATEGORY_SHORT: Record<DeviceCategory, string> = {
  generator: 'gen',
  heavy: 'hvy',
  medium: 'med',
  light: 'lgt',
  storage: 'str',
}

function padRight(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length)
}

function padLeft(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s
}

export function DeviceListItem({ device, selected, onClick }: DeviceListItemProps) {
  const d = device
  const stateColor = STATE_COLORS[d.state] ?? 'text-green-500/30'
  const stateLabel = STATE_LABELS[d.state] ?? d.state.toUpperCase()
  const powerStr = (d.power_current >= 0 ? '+' : '') + d.power_current.toFixed(0)
  const healthColor = d.health >= 80 ? 'text-green-400' : d.health >= 50 ? 'text-amber-400' : 'text-red-500'

  return (
    <div
      onClick={() => onClick(d.device_id)}
      className={`
        font-mono text-[10px] leading-[18px] cursor-pointer select-none
        flex whitespace-pre
        hover:bg-green-500/5 transition-colors
        ${selected ? 'bg-green-500/10 text-green-300' : 'text-green-400/80'}
      `}
    >
      <span className="text-green-500/40">║ </span>
      <span className="text-green-400">{padRight(d.device_id, 8)}</span>
      <span className="text-green-500/40"> ║ </span>
      <span>{padRight(d.name, 25)}</span>
      <span className="text-green-500/40"> ║ </span>
      <span className="text-green-500/60">{padRight('T' + d.tier, 5)}</span>
      <span className="text-green-500/40"> ║ </span>
      <span className={stateColor}>{padRight(stateLabel, 7)}</span>
      <span className="text-green-500/40"> ║ </span>
      <span className={d.power_current >= 0 ? 'text-green-400' : 'text-red-400/80'}>
        {padLeft(powerStr, 5)}
      </span>
      <span className="text-green-500/60"> E/s</span>
      <span className="text-green-500/40"> ║ </span>
      <span className="text-green-500/60">{padRight(CATEGORY_SHORT[d.category], 4)}</span>
      <span className="text-green-500/40"> ║ </span>
      <span className={healthColor}>{padLeft(d.health.toFixed(0) + '%', 5)}</span>
      <span className="text-green-500/40"> ║</span>
    </div>
  )
}

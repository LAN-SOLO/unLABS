'use client'

import type { Device, DeviceRuntimeState, PlayerDeviceState } from '@/types/devices'
import { HealthIndicator } from '../metrics/HealthIndicator'
import { LoadIndicator } from '../metrics/LoadIndicator'
import { TemperatureGauge } from '../metrics/TemperatureGauge'
import { DevicePowerChart } from './DevicePowerChart'

interface DeviceInfoSectionProps {
  device: Device
  state: DeviceRuntimeState | null
  playerState: PlayerDeviceState | null
}

const STATE_COLORS: Record<string, string> = {
  online: 'text-green-400',
  standby: 'text-amber-400',
  offline: 'text-green-500/30',
  error: 'text-red-500',
  upgrading: 'text-cyan-400',
}

const CATEGORY_LABELS: Record<string, string> = {
  generator: 'Power Generator',
  heavy: 'Heavy Consumer',
  medium: 'Medium Consumer',
  light: 'Light Consumer',
  storage: 'Storage',
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 leading-[18px]">
      <span className="text-green-500/60 w-[100px] text-right">{label}:</span>
      <span>{children}</span>
    </div>
  )
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  const titleLen = title.length + 2
  const lineLen = Math.max(60, titleLen + 10)
  const afterTitle = lineLen - titleLen - 2
  return (
    <div className="font-mono text-[10px]">
      <div className="text-green-500/30 whitespace-pre">
        {'┌─ '}<span className="text-green-500/60">{title}</span>{' ' + '─'.repeat(Math.max(0, afterTitle)) + '┐'}
      </div>
      <div className="border-l border-r border-green-500/15 px-2 py-1">
        {children}
      </div>
      <div className="text-green-500/30 whitespace-pre">
        {'└' + '─'.repeat(lineLen) + '┘'}
      </div>
    </div>
  )
}

export function DeviceInfoSection({ device, state, playerState }: DeviceInfoSectionProps) {
  const d = device
  const s = state
  const currentState = playerState?.current_state ?? s?.state ?? 'offline'
  const stateColor = STATE_COLORS[currentState] ?? 'text-green-500/30'

  return (
    <div className="space-y-2">
      {/* Core Specifications */}
      <SectionBox title="CORE SPECIFICATIONS">
        <div className="grid grid-cols-2 gap-x-8 gap-y-0">
          <SpecRow label="VERSION">
            <span className="text-green-400">{d.version}</span>
          </SpecRow>
          <SpecRow label="CATEGORY">
            <span className="text-green-400">{CATEGORY_LABELS[d.category] ?? d.category}</span>
          </SpecRow>
          <SpecRow label="TECH TREE">
            <span className="text-cyan-400">{d.tech_tree}</span>
          </SpecRow>
          <SpecRow label="TIER">
            <span className="text-green-400">T{d.tier}</span>
          </SpecRow>
          <SpecRow label="STATE">
            <span className={stateColor}>{currentState.toUpperCase()}</span>
          </SpecRow>
          <SpecRow label="HEALTH">
            {s ? <HealthIndicator health={s.health} width={14} /> : <span className="text-green-500/30">N/A</span>}
          </SpecRow>
          <SpecRow label="UPTIME">
            <span className="text-green-400">{s ? formatUptime(s.uptime_seconds) : '--'}</span>
          </SpecRow>
          <SpecRow label="LOAD">
            {s ? <LoadIndicator load={s.load} width={14} /> : <span className="text-green-500/30">N/A</span>}
          </SpecRow>
        </div>
      </SectionBox>

      {/* Power Profile */}
      <SectionBox title="POWER PROFILE">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-x-8 gap-y-0">
            <SpecRow label="FULL LOAD">
              <span className={d.power_full >= 0 ? 'text-green-400' : 'text-red-400/80'}>
                {d.power_full > 0 ? '+' : ''}{d.power_full.toFixed(1)} E/s
              </span>
            </SpecRow>
            <SpecRow label="IDLE">
              <span className={d.power_idle >= 0 ? 'text-green-400' : 'text-red-400/80'}>
                {d.power_idle > 0 ? '+' : ''}{d.power_idle.toFixed(1)} E/s
              </span>
            </SpecRow>
            <SpecRow label="STANDBY">
              <span className={d.power_standby >= 0 ? 'text-green-400' : 'text-red-400/80'}>
                {d.power_standby > 0 ? '+' : ''}{d.power_standby.toFixed(1)} E/s
              </span>
            </SpecRow>
            <SpecRow label="CURRENT">
              <span className="text-amber-400">
                {s ? `${s.power_current > 0 ? '+' : ''}${s.power_current.toFixed(1)} E/s` : '--'}
              </span>
            </SpecRow>
          </div>
          <DevicePowerChart
            powerFull={d.power_full}
            powerIdle={d.power_idle}
            powerStandby={d.power_standby}
            powerCurrent={s?.power_current ?? 0}
          />
        </div>
      </SectionBox>

      {/* Operational Metrics */}
      <SectionBox title="OPERATIONAL METRICS">
        <div className="space-y-1">
          {s ? (
            <TemperatureGauge temperature={s.temperature} />
          ) : (
            <span className="text-green-500/30">NO TELEMETRY</span>
          )}
        </div>
      </SectionBox>

      {/* Capabilities */}
      <SectionBox title="CAPABILITIES">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {d.capabilities.map((cap) => (
            <span key={cap} className="text-cyan-400/80">
              <span className="text-green-500/30">▸ </span>{cap}
            </span>
          ))}
          {d.capabilities.length === 0 && (
            <span className="text-green-500/30">NONE LISTED</span>
          )}
        </div>
      </SectionBox>
    </div>
  )
}

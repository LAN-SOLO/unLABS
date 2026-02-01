'use client'

import type { DevicePowerSummary, DeviceCategory } from '@/types/devices'

interface DeviceListHeaderProps {
  totalCount: number
  filteredCount: number
  powerSummary: DevicePowerSummary | null
  loading?: boolean
}

const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  generator: 'GEN',
  heavy: 'HVY',
  medium: 'MED',
  light: 'LGT',
  storage: 'STR',
}

const CATEGORY_COLORS: Record<DeviceCategory, string> = {
  generator: 'bg-green-500',
  heavy: 'bg-red-500',
  medium: 'bg-amber-500',
  light: 'bg-cyan-500',
  storage: 'bg-violet-500',
}

function PowerBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.abs(value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 font-mono text-[10px]">
      <span className="text-green-500/60 w-[32px] text-right">{label}</span>
      <div className="flex-1 h-[6px] bg-green-900/30 border border-green-500/20">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-green-400 w-[60px] text-right">{value.toFixed(1)} E/s</span>
    </div>
  )
}

export function DeviceListHeader({ totalCount, filteredCount, powerSummary, loading }: DeviceListHeaderProps) {
  const ps = powerSummary
  const netStatus = !ps ? 'OFFLINE' : ps.net_power > 0 ? 'NOMINAL' : ps.net_power === 0 ? 'BALANCED' : 'DEFICIT'
  const netColor = !ps ? 'text-green-500/40' : ps.net_power > 0 ? 'text-green-400' : ps.net_power === 0 ? 'text-amber-400' : 'text-red-500'
  const headroom = ps ? ps.headroom_percent : 0
  const isAlert = ps ? ps.net_power < 0 || headroom < 20 : false

  return (
    <div className="font-mono text-[10px] space-y-1">
      {/* Top row: counts */}
      <div className="flex items-center justify-between text-green-500/80">
        <div className="flex gap-4">
          <span>DEVICES: <span className="text-green-400">{filteredCount}</span>/{totalCount}</span>
          {ps && (
            <>
              <span>ON: <span className="text-green-400">{ps.device_count_online}</span></span>
              <span>SBY: <span className="text-amber-400">{ps.device_count_standby}</span></span>
              <span>OFF: <span className="text-green-500/40">{ps.device_count_offline}</span></span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-500/60">STATUS:</span>
          <span className={netColor}>{loading ? 'LOADING...' : netStatus}</span>
          {isAlert && <span className="text-red-500 animate-pulse">!</span>}
        </div>
      </div>

      {/* Power bars */}
      {ps && (
        <div className="space-y-0.5">
          <PowerBar label="GEN" value={ps.total_generation} max={Math.max(ps.total_generation, ps.total_consumption)} color="bg-green-500" />
          <PowerBar label="USE" value={ps.total_consumption} max={Math.max(ps.total_generation, ps.total_consumption)} color="bg-red-500/80" />
          <div className="flex items-center gap-2">
            <span className="text-green-500/60 w-[32px] text-right">NET</span>
            <div className="flex-1 border-t border-green-500/20" />
            <span className={`w-[60px] text-right ${netColor}`}>
              {ps.net_power > 0 ? '+' : ''}{ps.net_power.toFixed(1)} E/s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500/60 w-[32px] text-right">HDR</span>
            <div className="flex-1 border-t border-green-500/20" />
            <span className={`w-[60px] text-right ${headroom < 20 ? 'text-red-500' : headroom < 40 ? 'text-amber-400' : 'text-green-400'}`}>
              {headroom.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {ps && (
        <div className="flex gap-3 pt-0.5">
          {(Object.keys(CATEGORY_LABELS) as DeviceCategory[]).map((cat) => {
            const data = ps.by_category[cat]
            return (
              <div key={cat} className="flex items-center gap-1">
                <div className={`w-[6px] h-[6px] ${CATEGORY_COLORS[cat]}`} />
                <span className="text-green-500/60">{CATEGORY_LABELS[cat]}</span>
                <span className="text-green-400">{data.count}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Alert banner */}
      {isAlert && ps && (
        <div className="border border-red-500/40 bg-red-500/5 px-2 py-0.5 text-red-500 flex items-center gap-2">
          <span className="animate-pulse">&#9888;</span>
          {ps.net_power < 0 && <span>POWER DEFICIT: {Math.abs(ps.net_power).toFixed(1)} E/s shortfall</span>}
          {ps.net_power >= 0 && headroom < 20 && <span>LOW HEADROOM: {headroom.toFixed(1)}% - defer heavy ops</span>}
        </div>
      )}
    </div>
  )
}

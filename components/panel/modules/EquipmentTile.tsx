'use client'

import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { Knob } from '../controls/Knob'
import { LED } from '../controls/LED'

interface EquipmentTileProps {
  title: string
  subtitle?: string
  variant?: 'default' | 'teal' | 'military'
  status?: 'active' | 'standby' | 'offline'
  value?: string | number
  unit?: string
  children?: React.ReactNode
  className?: string
}

export function EquipmentTile({
  title,
  subtitle,
  variant = 'default',
  status = 'offline',
  value,
  unit,
  children,
  className,
}: EquipmentTileProps) {
  const statusColors = {
    active: 'green',
    standby: 'amber',
    offline: 'red',
  } as const

  return (
    <PanelFrame
      variant={variant}
      className={cn('p-2', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--neon-amber)]">
            {title}
          </div>
          {subtitle && (
            <div className="font-mono text-[8px] text-white/40">{subtitle}</div>
          )}
        </div>
        <LED on={status !== 'offline'} color={statusColors[status]} size="sm" />
      </div>

      {/* Value display */}
      {value !== undefined && (
        <div className="flex items-baseline gap-1 mb-2">
          <span className="font-mono text-lg text-[var(--neon-cyan)] text-glow-cyan">
            {value}
          </span>
          {unit && (
            <span className="font-mono text-[10px] text-white/50">{unit}</span>
          )}
        </div>
      )}

      {/* Custom content */}
      {children}
    </PanelFrame>
  )
}

export function CrystalDataCache({ className }: { className?: string }) {
  return (
    <EquipmentTile
      title="Crystal Data Cache"
      status="active"
      variant="default"
      className={className}
    >
      <div className="grid grid-cols-3 gap-1">
        <div className="bg-black/30 p-1 rounded">
          <div className="font-mono text-[8px] text-white/40">Crystals</div>
          <div className="font-mono text-sm text-[var(--neon-green)]">0</div>
        </div>
        <div className="bg-black/30 p-1 rounded">
          <div className="font-mono text-[8px] text-white/40">Slices</div>
          <div className="font-mono text-sm text-[var(--neon-cyan)]">0</div>
        </div>
        <div className="bg-black/30 p-1 rounded">
          <div className="font-mono text-[8px] text-white/40">Power</div>
          <div className="font-mono text-sm text-[var(--neon-amber)]">0</div>
        </div>
      </div>
    </EquipmentTile>
  )
}

export function EnergyCore({ className }: { className?: string }) {
  return (
    <EquipmentTile
      title="Unstable Energy Core"
      value="i2.5"
      status="standby"
      variant="default"
      className={className}
    >
      <div className="flex items-center gap-2">
        <Knob value={25} onChange={() => {}} size="sm" label="LEVEL" />
        <div className="flex-1 h-2 bg-black/30 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--neon-amber)] to-[var(--neon-orange)]"
            style={{ width: '25%' }}
          />
        </div>
      </div>
    </EquipmentTile>
  )
}

export function BatteryPack({ className }: { className?: string }) {
  return (
    <EquipmentTile
      title="01_Portable Battery Pack"
      subtitle="AUTOMATIC REGENERATION"
      status="active"
      variant="military"
      className={className}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          {[100, 80, 60, 40, 20].map((level, i) => (
            <div
              key={i}
              className={cn(
                'w-8 h-1.5 rounded-sm',
                level <= 60 ? 'bg-[var(--neon-green)]' : 'bg-white/10'
              )}
            />
          ))}
        </div>
        <div className="text-right">
          <div className="font-mono text-lg text-[var(--neon-green)]">60%</div>
          <div className="font-mono text-[8px] text-white/40">CHARGED</div>
        </div>
      </div>
    </EquipmentTile>
  )
}

export function HandmadeSynthesizer({ className }: { className?: string }) {
  return (
    <EquipmentTile
      title="Handmade Synthesizer"
      status="standby"
      variant="teal"
      className={className}
    >
      <div className="flex items-center justify-between">
        <Knob value={50} onChange={() => {}} size="sm" label="PULSE" />
        <Knob value={30} onChange={() => {}} size="sm" label="TEMPO" />
        <Knob value={70} onChange={() => {}} size="sm" label="FREQ" />
      </div>
    </EquipmentTile>
  )
}

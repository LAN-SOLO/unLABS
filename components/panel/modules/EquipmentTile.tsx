'use client'

import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { Knob } from '../controls/Knob'
import { LED } from '../controls/LED'
import type { TechTreeProgress } from '@/app/(game)/terminal/actions/equipment'

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

// ==================================================
// CRYSTAL DATA CACHE - Shows crystal inventory stats
// ==================================================
interface CrystalDataCacheProps {
  crystalCount?: number
  sliceCount?: number
  totalPower?: number
  className?: string
}

export function CrystalDataCache({
  crystalCount = 0,
  sliceCount = 0,
  totalPower = 0,
  className,
}: CrystalDataCacheProps) {
  const status = crystalCount > 0 ? 'active' : 'standby'

  return (
    <EquipmentTile
      title="Crystal Data Cache"
      status={status}
      variant="default"
      className={className}
    >
      <div className="grid grid-cols-3 gap-1">
        <div className="bg-black/30 p-1 rounded">
          <div className="font-mono text-[8px] text-white/40">Crystals</div>
          <div className="font-mono text-sm text-[var(--neon-green)]">{crystalCount}</div>
        </div>
        <div className="bg-black/30 p-1 rounded">
          <div className="font-mono text-[8px] text-white/40">Slices</div>
          <div className="font-mono text-sm text-[var(--neon-cyan)]">{sliceCount}</div>
        </div>
        <div className="bg-black/30 p-1 rounded">
          <div className="font-mono text-[8px] text-white/40">Power</div>
          <div className="font-mono text-sm text-[var(--neon-amber)]">{totalPower.toFixed(1)}</div>
        </div>
      </div>
    </EquipmentTile>
  )
}

// ==================================================
// ENERGY CORE - Links to volatility/network energy
// ==================================================
interface EnergyCoreProps {
  volatilityTier?: number
  tps?: number
  className?: string
}

export function EnergyCore({
  volatilityTier = 1,
  tps = 1000,
  className,
}: EnergyCoreProps) {
  // Energy level based on volatility tier (1-5 maps to 20-100%)
  const energyLevel = volatilityTier * 20
  const status = volatilityTier >= 3 ? 'active' : volatilityTier >= 2 ? 'standby' : 'offline'

  return (
    <EquipmentTile
      title="Unstable Energy Core"
      value={`T${volatilityTier}`}
      status={status}
      variant="default"
      className={className}
    >
      <div className="flex items-center gap-2">
        <Knob
          value={energyLevel}
          onChange={() => {}}
          size="sm"
          label="LEVEL"
          disabled
        />
        <div className="flex-1">
          <div className="h-2 bg-black/30 rounded overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${energyLevel}%`,
                background: `linear-gradient(90deg, var(--neon-amber), ${
                  volatilityTier >= 4 ? 'var(--neon-red)' : 'var(--neon-orange)'
                })`,
              }}
            />
          </div>
          <div className="font-mono text-[8px] text-white/40 mt-1">
            TPS: {tps.toLocaleString()}
          </div>
        </div>
      </div>
    </EquipmentTile>
  )
}

// ==================================================
// BATTERY PACK - Shows user balance/staking
// ==================================================
interface BatteryPackProps {
  available?: number
  staked?: number
  locked?: number
  className?: string
}

export function BatteryPack({
  available = 100,
  staked = 0,
  locked = 0,
  className,
}: BatteryPackProps) {
  const total = available + staked + locked
  const chargePercent = total > 0 ? Math.min(100, (available / 200) * 100) : 0
  const status = available >= 50 ? 'active' : available >= 20 ? 'standby' : 'offline'

  // Battery segments (5 levels)
  const segments = [100, 80, 60, 40, 20]
  const activeSegments = segments.filter(level => chargePercent >= level).length

  return (
    <EquipmentTile
      title="01_Portable Battery Pack"
      subtitle="AUTOMATIC REGENERATION"
      status={status}
      variant="military"
      className={className}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          {segments.map((level, i) => (
            <div
              key={i}
              className={cn(
                'w-8 h-1.5 rounded-sm transition-colors duration-300',
                i >= (5 - activeSegments) ? 'bg-[var(--neon-green)]' : 'bg-white/10'
              )}
            />
          ))}
        </div>
        <div className="text-right">
          <div className="font-mono text-lg text-[var(--neon-green)]">
            {available.toFixed(0)}
          </div>
          <div className="font-mono text-[8px] text-white/40">_unSC</div>
          {staked > 0 && (
            <div className="font-mono text-[8px] text-[var(--neon-cyan)]">
              +{staked.toFixed(0)} staked
            </div>
          )}
        </div>
      </div>
    </EquipmentTile>
  )
}

// ==================================================
// TECH TREE MODULES - Based on documentation specs
// ==================================================

// Tier names from documentation
const TIER_NAMES: Record<string, string[]> = {
  devices: ['Offline', 'Basic Assembly Rig', 'Precision Rotator', 'Quantum Chamber', 'Assembly AI', 'Halo Fabricator'],
  optics: ['Offline', 'Prism Rack α', 'Laser Etalon β', 'Wave-Splitter Γ', 'Holo Projector Ω', 'Planck-Lens'],
  adapters: ['Offline', 'Ticker Tap α', 'Oracle Dock β', 'Multi-Oracle Γ', 'Data Bank Ω', 'Predictive AI'],
  synthesizers: ['Offline', 'Micro-Shard', 'State-Tuner', 'Color Fuser β', 'Hybrid-Splicer Ω', 'Reality Weaver'],
}

// Capabilities unlocked per tier
const TIER_CAPABILITIES: Record<string, string[]> = {
  devices: ['—', 'Vol ≤2', 'Vol ≤3', 'Vol ≤4', 'Vol ≤5', 'No limit'],
  optics: ['—', '≤Orange/8-bit', '≤Green/16-bit', '≤Blue/32-bit', '≤Violet/64-bit', 'Gamma/∞'],
  adapters: ['—', 'ETH trend', '+1 chain', 'Multi-chain', 'Historical', 'Predictive'],
  synthesizers: ['—', 'Create Vol1', 'State toggle', 'Color fuse', 'Hybrid splice', 'Any trait'],
}

interface TechTreeModuleProps {
  progress?: TechTreeProgress
  category: 'devices' | 'optics' | 'adapters' | 'synthesizers'
  className?: string
}

export function TechTreeModule({
  progress,
  category,
  className,
}: TechTreeModuleProps) {
  const tier = progress?.currentTier ?? 0
  const maxTier = progress?.maxTier ?? 5
  const exp = progress?.experience ?? 0
  const expToNext = progress?.experienceToNext ?? 100

  const tierName = TIER_NAMES[category]?.[tier] ?? `Tier ${tier}`
  const capability = TIER_CAPABILITIES[category]?.[tier] ?? '—'

  const status = tier >= 3 ? 'active' : tier >= 1 ? 'standby' : 'offline'
  const expPercent = tier < maxTier ? (exp / expToNext) * 100 : 100

  const titleMap: Record<string, string> = {
    devices: 'DEVICES',
    optics: 'OPTICS',
    adapters: 'ADAPTERS',
    synthesizers: 'SYNTHESIZERS',
  }

  const accentMap: Record<string, string> = {
    devices: 'var(--neon-amber)',
    optics: 'var(--neon-cyan)',
    adapters: 'var(--neon-green)',
    synthesizers: 'var(--neon-purple, #9d00ff)',
  }

  return (
    <EquipmentTile
      title={titleMap[category]}
      subtitle={tierName}
      status={status}
      variant="default"
      className={className}
    >
      <div className="space-y-2">
        {/* Tier indicator */}
        <div className="flex items-center gap-1">
          {Array.from({ length: maxTier }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-1 rounded-full transition-colors',
                i < tier ? 'bg-[var(--neon-green)]' : 'bg-white/10'
              )}
              style={{
                boxShadow: i < tier ? `0 0 4px var(--neon-green)` : undefined,
              }}
            />
          ))}
        </div>

        {/* Experience progress */}
        {tier < maxTier && (
          <div className="h-1 bg-black/30 rounded overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${expPercent}%`,
                backgroundColor: accentMap[category],
              }}
            />
          </div>
        )}

        {/* Capability */}
        <div className="font-mono text-[9px] text-white/60">
          {capability}
        </div>
      </div>
    </EquipmentTile>
  )
}

// ==================================================
// HANDMADE SYNTHESIZER - Synthesizers tech tree
// ==================================================
interface HandmadeSynthesizerProps {
  progress?: TechTreeProgress
  className?: string
}

export function HandmadeSynthesizer({
  progress,
  className,
}: HandmadeSynthesizerProps) {
  const tier = progress?.currentTier ?? 0
  const status = tier >= 2 ? 'active' : tier >= 1 ? 'standby' : 'offline'

  // Knob values based on tier
  const pulseValue = tier * 15 + 20
  const tempoValue = tier * 10 + 30
  const freqValue = tier * 12 + 25

  return (
    <EquipmentTile
      title="Handmade Synthesizer"
      subtitle={TIER_NAMES.synthesizers[tier]}
      status={status}
      variant="teal"
      className={className}
    >
      <div className="flex items-center justify-between">
        <Knob value={pulseValue} onChange={() => {}} size="sm" label="PULSE" accentColor="var(--neon-cyan)" />
        <Knob value={tempoValue} onChange={() => {}} size="sm" label="TEMPO" accentColor="var(--neon-amber)" />
        <Knob value={freqValue} onChange={() => {}} size="sm" label="FREQ" accentColor="var(--neon-green)" />
      </div>
      {tier > 0 && (
        <div className="mt-2 font-mono text-[8px] text-[var(--neon-cyan)]">
          {TIER_CAPABILITIES.synthesizers[tier]}
        </div>
      )}
    </EquipmentTile>
  )
}

// ==================================================
// ECHO RECORDER - Adapters tech tree visualization
// ==================================================
interface EchoRecorderProps {
  progress?: TechTreeProgress
  className?: string
}

export function EchoRecorder({
  progress,
  className,
}: EchoRecorderProps) {
  const tier = progress?.currentTier ?? 0
  const status = tier >= 2 ? 'active' : tier >= 1 ? 'standby' : 'offline'

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-amber)]">
          ECHO RECORDER
        </div>
        <LED on={status !== 'offline'} color={status === 'active' ? 'green' : 'amber'} size="sm" />
      </div>
      <div className="font-mono text-[8px] text-white/40 mb-2">
        {TIER_NAMES.adapters[tier]}
      </div>
      <div className="flex items-center gap-2">
        <Knob value={40 + tier * 10} onChange={() => {}} size="sm" label="PULSE" />
        <Knob value={60 + tier * 5} onChange={() => {}} size="sm" label="BLOOM" />
      </div>
    </PanelFrame>
  )
}

// ==================================================
// INTERPOLATOR - Optics tech tree visualization
// ==================================================
interface InterpolatorProps {
  progress?: TechTreeProgress
  className?: string
}

export function Interpolator({
  progress,
  className,
}: InterpolatorProps) {
  const tier = progress?.currentTier ?? 0

  // Color range based on tier
  const colors = ['#800000', '#ff0000', '#ff6600', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3', '#ff00ff']
  const maxColorIndex = Math.min(tier * 2, colors.length - 1)

  return (
    <PanelFrame variant="military" className={cn('p-2', className)}>
      <div className="font-mono text-[9px] text-[var(--neon-lime, #bfff00)] mb-1">
        INTERPOLATOR
      </div>
      <div className="font-mono text-[8px] text-white/40 mb-2">
        {TIER_NAMES.optics[tier]}
      </div>
      <div
        className="h-8 bg-black/30 rounded flex items-center justify-center overflow-hidden"
        style={{
          background: tier > 0
            ? `linear-gradient(90deg, ${colors.slice(0, maxColorIndex + 1).join(', ')})`
            : 'rgba(0,0,0,0.3)',
        }}
      >
        {tier === 0 && (
          <span className="font-mono text-[10px] text-white/30">OFFLINE</span>
        )}
      </div>
      {tier > 0 && (
        <div className="mt-1 font-mono text-[8px] text-[var(--neon-lime, #bfff00)]">
          {TIER_CAPABILITIES.optics[tier]}
        </div>
      )}
    </PanelFrame>
  )
}

// ==================================================
// BASIC TOOLKIT - Fundamental laboratory hand tools
// ==================================================
interface BasicToolkitProps {
  className?: string
}

export function BasicToolkit({ className }: BasicToolkitProps) {
  // Tool status indicators
  const tools = [
    { name: 'PROBE', active: true, color: 'var(--neon-cyan)' },
    { name: 'CLAMP', active: true, color: 'var(--neon-green)' },
    { name: 'LASER', active: false, color: 'var(--neon-red)' },
    { name: 'DRILL', active: true, color: 'var(--neon-amber)' },
  ]

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[9px] text-[var(--neon-amber)]">
          BASIC TOOLKIT
        </div>
        <div className="font-mono text-[7px] text-white/30">T1</div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className="flex items-center gap-1 bg-black/30 px-1 py-0.5 rounded"
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: tool.active ? tool.color : '#333',
                boxShadow: tool.active ? `0 0 4px ${tool.color}` : 'none',
              }}
            />
            <span className="font-mono text-[7px] text-white/60">{tool.name}</span>
          </div>
        ))}
      </div>
    </PanelFrame>
  )
}

// ==================================================
// MATERIAL SCANNER - Resource detection device
// ==================================================
interface MaterialScannerProps {
  scanProgress?: number
  detectedMaterials?: number
  className?: string
}

export function MaterialScanner({
  scanProgress = 67,
  detectedMaterials = 3,
  className,
}: MaterialScannerProps) {
  return (
    <PanelFrame variant="teal" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-cyan)]">
          MATERIAL SCANNER
        </div>
        <LED on={true} color="cyan" size="sm" />
      </div>

      {/* Scanning visualization */}
      <div className="relative h-6 bg-black/40 rounded overflow-hidden mb-1">
        {/* Scan line animation */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[var(--neon-cyan)]"
          style={{
            left: `${scanProgress}%`,
            boxShadow: '0 0 8px var(--neon-cyan), 0 0 16px var(--neon-cyan)',
            animation: 'scan-sweep 2s ease-in-out infinite',
          }}
        />
        {/* Detection blips */}
        {Array.from({ length: detectedMaterials }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[var(--neon-green)]"
            style={{
              left: `${20 + i * 25}%`,
              top: '50%',
              transform: 'translateY(-50%)',
              boxShadow: '0 0 4px var(--neon-green)',
            }}
          />
        ))}
      </div>

      <div className="flex justify-between font-mono text-[7px]">
        <span className="text-white/40">MATERIALS</span>
        <span className="text-[var(--neon-green)]">{detectedMaterials} FOUND</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// RESOURCE MAGNET - Passive resource attraction
// ==================================================
interface ResourceMagnetProps {
  magnetStrength?: number
  isActive?: boolean
  className?: string
}

export function ResourceMagnet({
  magnetStrength = 45,
  isActive = true,
  className,
}: ResourceMagnetProps) {
  return (
    <PanelFrame variant="military" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-lime, #bfff00)]">
          RESOURCE MAGNET
        </div>
        <LED on={isActive} color="green" size="sm" />
      </div>

      {/* Magnet field visualization */}
      <div className="relative h-8 bg-black/40 rounded flex items-center justify-center overflow-hidden">
        {/* Concentric rings */}
        {[3, 2, 1].map((ring) => (
          <div
            key={ring}
            className="absolute rounded-full border border-[var(--neon-green)]/30"
            style={{
              width: `${ring * 30}%`,
              height: `${ring * 60}%`,
              opacity: isActive ? 0.3 + (4 - ring) * 0.2 : 0.1,
            }}
          />
        ))}
        {/* Center core */}
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: isActive ? 'var(--neon-green)' : '#333',
            boxShadow: isActive ? '0 0 8px var(--neon-green)' : 'none',
          }}
        />
      </div>

      <div className="flex items-center justify-between mt-1">
        <Knob value={magnetStrength} onChange={() => {}} size="sm" label="STR" accentColor="var(--neon-green)" />
        <div className="text-right">
          <div className="font-mono text-[10px] text-[var(--neon-green)]">{magnetStrength}%</div>
          <div className="font-mono text-[7px] text-white/30">FIELD</div>
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// QUANTUM COMPASS - Anomaly detection device
// ==================================================
interface QuantumCompassProps {
  anomalyDirection?: number // 0-360 degrees
  anomalyDistance?: number // 0-100
  className?: string
}

export function QuantumCompass({
  anomalyDirection = 45,
  anomalyDistance = 72,
  className,
}: QuantumCompassProps) {
  const hasAnomaly = anomalyDistance < 100

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-purple, #9d00ff)]">
          QUANTUM COMPASS
        </div>
        <LED on={hasAnomaly} color="amber" size="sm" />
      </div>

      {/* Compass visualization */}
      <div className="relative h-10 bg-black/40 rounded flex items-center justify-center">
        {/* Compass ring */}
        <div className="relative w-8 h-8 rounded-full border border-[var(--neon-purple, #9d00ff)]/40">
          {/* Cardinal points */}
          {['N', 'E', 'S', 'W'].map((dir, i) => (
            <div
              key={dir}
              className="absolute font-mono text-[6px] text-white/40"
              style={{
                top: i === 0 ? '-2px' : i === 2 ? 'auto' : '50%',
                bottom: i === 2 ? '-2px' : 'auto',
                left: i === 3 ? '-4px' : i === 1 ? 'auto' : '50%',
                right: i === 1 ? '-4px' : 'auto',
                transform: i % 2 === 0 ? 'translateX(-50%)' : 'translateY(-50%)',
              }}
            >
              {dir}
            </div>
          ))}
          {/* Anomaly indicator needle */}
          {hasAnomaly && (
            <div
              className="absolute w-0.5 h-3 bg-[var(--neon-amber)] origin-bottom"
              style={{
                left: '50%',
                bottom: '50%',
                transform: `translateX(-50%) rotate(${anomalyDirection}deg)`,
                boxShadow: '0 0 4px var(--neon-amber)',
              }}
            />
          )}
          {/* Center dot */}
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-[var(--neon-purple, #9d00ff)] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ boxShadow: '0 0 4px var(--neon-purple, #9d00ff)' }}
          />
        </div>

        {/* Distance indicator */}
        <div className="absolute right-1 font-mono text-[8px] text-[var(--neon-amber)]">
          {anomalyDistance}m
        </div>
      </div>

      <div className="font-mono text-[7px] text-white/40 text-center mt-1">
        {hasAnomaly ? 'ANOMALY DETECTED' : 'SCANNING...'}
      </div>
    </PanelFrame>
  )
}

// ==================================================
// PORTABLE WORKBENCH - Mobile crafting station
// ==================================================
interface PortableWorkbenchProps {
  queuedItems?: number
  craftingProgress?: number
  className?: string
}

export function PortableWorkbench({
  queuedItems = 2,
  craftingProgress = 35,
  className,
}: PortableWorkbenchProps) {
  const isCrafting = craftingProgress > 0 && craftingProgress < 100

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-amber)]">
          PORTABLE WORKBENCH
        </div>
        <LED on={isCrafting} color={isCrafting ? 'amber' : 'green'} size="sm" />
      </div>

      {/* Crafting slots */}
      <div className="flex gap-1 mb-1">
        {[0, 1, 2].map((slot) => (
          <div
            key={slot}
            className="flex-1 h-4 bg-black/40 rounded border"
            style={{
              borderColor: slot < queuedItems ? 'var(--neon-amber)' : 'rgba(255,255,255,0.1)',
              boxShadow: slot < queuedItems ? 'inset 0 0 4px var(--neon-amber)' : 'none',
            }}
          >
            {slot < queuedItems && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-2 h-2 bg-[var(--neon-amber)]/60 rounded-sm" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-black/40 rounded overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${craftingProgress}%`,
            background: 'linear-gradient(90deg, var(--neon-amber), var(--neon-orange))',
            boxShadow: isCrafting ? '0 0 4px var(--neon-amber)' : 'none',
          }}
        />
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-white/40">QUEUE: {queuedItems}</span>
        <span className="text-[var(--neon-amber)]">{craftingProgress}%</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// ABSTRACTUM CONTAINER - Raw material storage
// ==================================================
interface AbstractumContainerProps {
  amount?: number
  capacity?: number
  purity?: number
  className?: string
}

export function AbstractumContainer({
  amount = 127,
  capacity = 500,
  purity = 94,
  className,
}: AbstractumContainerProps) {
  const fillPercent = (amount / capacity) * 100

  return (
    <PanelFrame variant="teal" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-cyan)]">
          ABSTRACTUM TANK
        </div>
        <div className="font-mono text-[7px] text-white/30">RES-1</div>
      </div>

      {/* Tank visualization */}
      <div className="relative h-10 bg-black/40 rounded border border-[var(--neon-cyan)]/20 overflow-hidden">
        {/* Liquid level */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-500"
          style={{
            height: `${fillPercent}%`,
            background: 'linear-gradient(180deg, var(--neon-cyan) 0%, rgba(0,255,255,0.3) 100%)',
            boxShadow: 'inset 0 2px 10px rgba(0,255,255,0.3)',
          }}
        />
        {/* Bubbles */}
        <div className="absolute bottom-1 left-2 w-1 h-1 rounded-full bg-white/30 animate-pulse" />
        <div className="absolute bottom-3 right-3 w-0.5 h-0.5 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: '0.5s' }} />

        {/* Level marks */}
        {[25, 50, 75].map((level) => (
          <div
            key={level}
            className="absolute left-0 right-0 border-t border-white/10"
            style={{ bottom: `${level}%` }}
          />
        ))}
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-cyan)]">{amount}/{capacity}</span>
        <span className="text-white/40">PURITY: {purity}%</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// ENERGY TANK - Stores processed energy
// ==================================================
interface EnergyTankProps {
  amount?: number
  capacity?: number
  flowRate?: number
  className?: string
}

export function EnergyTank({
  amount = 340,
  capacity = 1000,
  flowRate = 12.5,
  className,
}: EnergyTankProps) {
  const fillPercent = (amount / capacity) * 100

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-amber)]">
          ENERGY RESERVOIR
        </div>
        <div className="font-mono text-[7px] text-white/30">RES-2</div>
      </div>

      <div className="relative h-10 bg-black/40 rounded border border-[var(--neon-amber)]/20 overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-500"
          style={{
            height: `${fillPercent}%`,
            background: 'linear-gradient(180deg, var(--neon-amber) 0%, rgba(255,184,0,0.3) 100%)',
            boxShadow: 'inset 0 0 15px rgba(255,184,0,0.4)',
          }}
        />
        {/* Energy sparks */}
        <div className="absolute inset-0 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute w-0.5 h-2 bg-white/60"
              style={{
                left: `${20 + i * 25}%`,
                bottom: `${Math.min(fillPercent - 5, 10 + i * 15)}%`,
                animation: `spark-flicker 0.${i + 2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-amber)]">{amount}/{capacity}</span>
        <span className="text-white/40">+{flowRate}/s</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// ALLOY FORGE - Advanced Alloy production
// ==================================================
interface AlloyForgeProps {
  temperature?: number
  output?: number
  isActive?: boolean
  className?: string
}

export function AlloyForge({
  temperature = 1450,
  output = 3.2,
  isActive = true,
  className,
}: AlloyForgeProps) {
  const tempPercent = Math.min(100, (temperature / 2000) * 100)

  return (
    <PanelFrame variant="military" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-orange)]">
          ALLOY FORGE
        </div>
        <LED on={isActive} color="red" size="sm" />
      </div>

      {/* Forge visualization */}
      <div className="relative h-8 bg-black/40 rounded overflow-hidden">
        {/* Heat gradient */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-300"
          style={{
            height: `${tempPercent}%`,
            background: `linear-gradient(180deg,
              ${temperature > 1500 ? '#ff3333' : temperature > 1000 ? '#ff6600' : '#ffaa00'} 0%,
              rgba(255,100,0,0.2) 100%)`,
          }}
        />
        {/* Forge core */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              background: isActive ? 'radial-gradient(circle, #fff 0%, #ff6600 50%, transparent 100%)' : '#333',
              boxShadow: isActive ? '0 0 20px #ff6600' : 'none',
            }}
          />
        </div>
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-orange)]">{temperature}°K</span>
        <span className="text-white/40">{output} u/min</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// NANOMATERIAL SYNTHESIZER - Tier 3 resource
// ==================================================
interface NanoSynthesizerProps {
  particles?: number
  density?: number
  isProcessing?: boolean
  className?: string
}

export function NanoSynthesizer({
  particles = 1247000,
  density = 89,
  isProcessing = true,
  className,
}: NanoSynthesizerProps) {
  return (
    <PanelFrame variant="teal" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-purple, #9d00ff)]">
          NANO SYNTHESIZER
        </div>
        <LED on={isProcessing} color="cyan" size="sm" />
      </div>

      {/* Nano cloud visualization */}
      <div className="relative h-8 bg-black/40 rounded overflow-hidden">
        {/* Particle field */}
        <div className="absolute inset-0">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 rounded-full bg-[var(--neon-purple, #9d00ff)]"
              style={{
                left: `${10 + (i % 4) * 25}%`,
                top: `${15 + Math.floor(i / 4) * 30}%`,
                opacity: isProcessing ? 0.8 : 0.2,
                animation: isProcessing ? `nano-float ${0.5 + (i % 3) * 0.2}s ease-in-out infinite` : 'none',
              }}
            />
          ))}
        </div>
        {/* Center density indicator */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border"
          style={{
            borderColor: 'var(--neon-purple, #9d00ff)',
            opacity: density / 100,
            boxShadow: isProcessing ? '0 0 10px var(--neon-purple, #9d00ff)' : 'none',
          }}
        />
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-purple, #9d00ff)]">{(particles / 1000000).toFixed(2)}M</span>
        <span className="text-white/40">ρ {density}%</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// MICROFUSION REACTOR - Tier 2 Tech power source
// ==================================================
interface MicrofusionReactorProps {
  powerOutput?: number
  stability?: number
  isOnline?: boolean
  className?: string
}

export function MicrofusionReactor({
  powerOutput = 847,
  stability = 94,
  isOnline = true,
  className,
}: MicrofusionReactorProps) {
  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-cyan)]">
          MICROFUSION REACTOR
        </div>
        <div className="flex items-center gap-1">
          <div className="font-mono text-[7px] text-white/30">T2</div>
          <LED on={isOnline} color={stability > 80 ? 'green' : 'amber'} size="sm" />
        </div>
      </div>

      {/* Reactor core visualization */}
      <div className="relative h-12 bg-black/40 rounded overflow-hidden flex items-center justify-center">
        {/* Rotating rings */}
        {[1, 2, 3].map((ring) => (
          <div
            key={ring}
            className="absolute rounded-full border"
            style={{
              width: `${ring * 25}%`,
              height: `${ring * 50}%`,
              borderColor: isOnline ? 'var(--neon-cyan)' : '#333',
              opacity: isOnline ? 0.3 + ring * 0.15 : 0.1,
              animation: isOnline ? `spin ${3 + ring}s linear infinite ${ring % 2 === 0 ? 'reverse' : ''}` : 'none',
            }}
          />
        ))}
        {/* Core */}
        <div
          className="w-3 h-3 rounded-full"
          style={{
            background: isOnline ? 'radial-gradient(circle, #fff 0%, var(--neon-cyan) 60%, transparent 100%)' : '#333',
            boxShadow: isOnline ? '0 0 15px var(--neon-cyan)' : 'none',
          }}
        />
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-cyan)]">{powerOutput} MW</span>
        <span className={stability > 80 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-amber)]'}>
          {stability}% STABLE
        </span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// AI ASSISTANT CORE - Tier 2 Tech automation
// ==================================================
interface AIAssistantProps {
  taskQueue?: number
  efficiency?: number
  isLearning?: boolean
  className?: string
}

export function AIAssistant({
  taskQueue = 7,
  efficiency = 156,
  isLearning = true,
  className,
}: AIAssistantProps) {
  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-green)]">
          AI ASSISTANT CORE
        </div>
        <div className="flex items-center gap-1">
          <div className="font-mono text-[7px] text-white/30">T2</div>
          <LED on={true} color="green" size="sm" />
        </div>
      </div>

      {/* Neural network visualization */}
      <div className="relative h-10 bg-black/40 rounded overflow-hidden">
        {/* Neural nodes */}
        <div className="absolute inset-0 flex items-center justify-around px-2">
          {[0, 1, 2, 3, 4].map((node) => (
            <div key={node} className="flex flex-col items-center gap-1">
              <div
                className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)]"
                style={{
                  opacity: 0.5 + (node % 3) * 0.2,
                  animation: isLearning ? `pulse ${0.8 + node * 0.1}s ease-in-out infinite` : 'none',
                }}
              />
              <div
                className="w-0.5 h-3 bg-[var(--neon-green)]/30"
                style={{ transform: `rotate(${-20 + node * 10}deg)` }}
              />
            </div>
          ))}
        </div>
        {/* Processing indicator */}
        {isLearning && (
          <div className="absolute bottom-1 left-1 right-1 h-0.5 bg-black/50 rounded overflow-hidden">
            <div
              className="h-full bg-[var(--neon-green)]"
              style={{ width: '60%', animation: 'loading 1.5s ease-in-out infinite' }}
            />
          </div>
        )}
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-white/40">QUEUE: {taskQueue}</span>
        <span className="text-[var(--neon-green)]">{efficiency}% EFF</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// EXPLORER DRONE - Tier 2 Tools field unit
// ==================================================
interface ExplorerDroneProps {
  range?: number
  battery?: number
  isDeployed?: boolean
  className?: string
}

export function ExplorerDrone({
  range = 2.4,
  battery = 78,
  isDeployed = true,
  className,
}: ExplorerDroneProps) {
  return (
    <PanelFrame variant="military" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-lime, #bfff00)]">
          EXPLORER DRONE
        </div>
        <div className="flex items-center gap-1">
          <div className="font-mono text-[7px] text-white/30">T2</div>
          <LED on={isDeployed} color={battery > 30 ? 'green' : 'amber'} size="sm" />
        </div>
      </div>

      {/* Drone radar visualization */}
      <div className="relative h-10 bg-black/40 rounded overflow-hidden">
        {/* Radar sweep */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-full h-full"
            style={{
              background: isDeployed
                ? 'conic-gradient(from 0deg, transparent 0deg, var(--neon-lime, #bfff00) 30deg, transparent 60deg)'
                : 'none',
              opacity: 0.3,
              animation: isDeployed ? 'spin 2s linear infinite' : 'none',
            }}
          />
        </div>
        {/* Grid lines */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border border-white/10" />
          <div className="absolute w-4 h-4 rounded-full border border-white/10" />
        </div>
        {/* Drone blip */}
        {isDeployed && (
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-[var(--neon-lime, #bfff00)]"
            style={{
              top: '30%',
              left: '60%',
              boxShadow: '0 0 6px var(--neon-lime, #bfff00)',
            }}
          />
        )}
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-lime, #bfff00)]">{range} km</span>
        <span className="text-white/40">BAT: {battery}%</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// ANOMALY DETECTOR - Tier 2 Gadget scanner
// ==================================================
interface AnomalyDetectorProps {
  signalStrength?: number
  anomaliesFound?: number
  isScanning?: boolean
  className?: string
}

export function AnomalyDetector({
  signalStrength = 67,
  anomaliesFound = 3,
  isScanning = true,
  className,
}: AnomalyDetectorProps) {
  return (
    <PanelFrame variant="teal" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-magenta, #e91e8c)]">
          ANOMALY DETECTOR
        </div>
        <div className="flex items-center gap-1">
          <div className="font-mono text-[7px] text-white/30">T2</div>
          <LED on={isScanning} color="amber" size="sm" />
        </div>
      </div>

      {/* Signal visualization */}
      <div className="relative h-8 bg-black/40 rounded overflow-hidden">
        {/* Waveform */}
        <div className="absolute inset-0 flex items-center">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 mx-px"
              style={{
                height: `${20 + Math.sin(i * 0.5) * signalStrength * 0.5}%`,
                background: 'var(--neon-magenta, #e91e8c)',
                opacity: isScanning ? 0.6 : 0.2,
                animation: isScanning ? `wave ${0.3 + i * 0.02}s ease-in-out infinite alternate` : 'none',
              }}
            />
          ))}
        </div>
        {/* Anomaly markers */}
        {Array.from({ length: anomaliesFound }).map((_, i) => (
          <div
            key={i}
            className="absolute top-1 w-1 h-1 rounded-full bg-[var(--neon-red)]"
            style={{
              left: `${20 + i * 30}%`,
              boxShadow: '0 0 4px var(--neon-red)',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          />
        ))}
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-magenta, #e91e8c)]">SIG: {signalStrength}%</span>
        <span className="text-[var(--neon-red)]">{anomaliesFound} DETECTED</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// TELEPORT PAD - Tier 2 Gadget transport
// ==================================================
interface TeleportPadProps {
  chargeLevel?: number
  lastDestination?: string
  isReady?: boolean
  className?: string
}

export function TeleportPad({
  chargeLevel = 85,
  lastDestination = 'LAB-α',
  isReady = true,
  className,
}: TeleportPadProps) {
  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-blue)]">
          TELEPORT PAD
        </div>
        <div className="flex items-center gap-1">
          <div className="font-mono text-[7px] text-white/30">T2</div>
          <LED on={isReady} color="cyan" size="sm" />
        </div>
      </div>

      {/* Pad visualization */}
      <div className="relative h-10 bg-black/40 rounded overflow-hidden flex items-center justify-center">
        {/* Portal rings */}
        {[1, 2, 3].map((ring) => (
          <div
            key={ring}
            className="absolute rounded-full border-2"
            style={{
              width: `${ring * 25}%`,
              height: `${ring * 60}%`,
              borderColor: isReady ? 'var(--neon-blue)' : '#333',
              opacity: isReady ? 0.2 + ring * 0.15 : 0.1,
              animation: isReady ? `pulse ${1 + ring * 0.3}s ease-in-out infinite` : 'none',
            }}
          />
        ))}
        {/* Center portal */}
        <div
          className="w-4 h-4 rounded-full"
          style={{
            background: isReady
              ? 'radial-gradient(circle, var(--neon-blue) 0%, transparent 70%)'
              : '#222',
            boxShadow: isReady ? '0 0 20px var(--neon-blue)' : 'none',
          }}
        />
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-blue)]">{chargeLevel}%</span>
        <span className="text-white/40">→ {lastDestination}</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// PRECISION LASER CUTTER - Tier 2 Tools fabrication
// ==================================================
interface LaserCutterProps {
  power?: number
  precision?: number
  isActive?: boolean
  className?: string
}

export function LaserCutter({
  power = 450,
  precision = 0.01,
  isActive = true,
  className,
}: LaserCutterProps) {
  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-red)]">
          PRECISION LASER
        </div>
        <div className="flex items-center gap-1">
          <div className="font-mono text-[7px] text-white/30">T2</div>
          <LED on={isActive} color="red" size="sm" />
        </div>
      </div>

      {/* Laser beam visualization */}
      <div className="relative h-8 bg-black/40 rounded overflow-hidden">
        {/* Target grid */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-px opacity-20">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border border-white/20" />
          ))}
        </div>
        {/* Laser beam */}
        {isActive && (
          <div
            className="absolute top-0 w-0.5 bg-[var(--neon-red)]"
            style={{
              left: '50%',
              height: '100%',
              boxShadow: '0 0 8px var(--neon-red), 0 0 16px var(--neon-red)',
              animation: 'laser-pulse 0.1s ease-in-out infinite',
            }}
          />
        )}
        {/* Focus point */}
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
          style={{
            background: isActive ? 'var(--neon-red)' : '#333',
            boxShadow: isActive ? '0 0 10px var(--neon-red)' : 'none',
          }}
        />
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-red)]">{power}W</span>
        <span className="text-white/40">±{precision}mm</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// 3D PRINTER - Tier 2 Tools fabrication
// ==================================================
interface Printer3DProps {
  progress?: number
  layerCount?: number
  isPrinting?: boolean
  className?: string
}

export function Printer3D({
  progress = 67,
  layerCount = 234,
  isPrinting = true,
  className,
}: Printer3DProps) {
  return (
    <PanelFrame variant="military" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-amber)]">
          3D FABRICATOR
        </div>
        <div className="flex items-center gap-1">
          <div className="font-mono text-[7px] text-white/30">T2</div>
          <LED on={isPrinting} color="amber" size="sm" />
        </div>
      </div>

      {/* Print bed visualization */}
      <div className="relative h-10 bg-black/40 rounded overflow-hidden">
        {/* Build layers */}
        <div
          className="absolute bottom-0 left-2 right-2 bg-[var(--neon-amber)]/30 transition-all duration-300"
          style={{ height: `${progress}%` }}
        >
          {/* Layer lines */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-px bg-[var(--neon-amber)]/50"
              style={{ bottom: `${i * 20}%` }}
            />
          ))}
        </div>
        {/* Print head */}
        {isPrinting && (
          <div
            className="absolute w-full h-0.5 bg-[var(--neon-amber)]"
            style={{
              bottom: `${progress}%`,
              boxShadow: '0 0 4px var(--neon-amber)',
              animation: 'print-head 0.5s ease-in-out infinite',
            }}
          />
        )}
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-amber)]">{progress}%</span>
        <span className="text-white/40">L:{layerCount}</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// EXOTIC MATTER CONTAINMENT - Tier 4 resource
// ==================================================
interface ExoticMatterProps {
  units?: number
  stability?: number
  isContained?: boolean
  className?: string
}

export function ExoticMatterContainment({
  units = 12,
  stability = 76,
  isContained = true,
  className,
}: ExoticMatterProps) {
  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-pink)]">
          EXOTIC MATTER
        </div>
        <div className="font-mono text-[7px] text-white/30">RES-X</div>
      </div>

      {/* Containment field visualization */}
      <div className="relative h-10 bg-black/40 rounded overflow-hidden flex items-center justify-center">
        {/* Containment field */}
        <div
          className="absolute inset-2 rounded-full border-2"
          style={{
            borderColor: isContained ? 'var(--neon-pink)' : '#ff0000',
            animation: isContained ? 'containment-pulse 2s ease-in-out infinite' : 'containment-warning 0.5s ease-in-out infinite',
          }}
        />
        {/* Exotic particles */}
        {Array.from({ length: units }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: 'var(--neon-pink)',
              left: `${30 + (i % 4) * 15}%`,
              top: `${25 + Math.floor(i / 4) * 20}%`,
              boxShadow: '0 0 4px var(--neon-pink)',
              animation: `exotic-float ${1 + (i % 3) * 0.3}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-pink)]">{units} UNITS</span>
        <span className={stability > 70 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-red)]'}>
          {stability}% STABLE
        </span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// SUPERCOMPUTER ARRAY - Tier 3 Tech computation
// ==================================================
interface SupercomputerProps {
  flops?: number
  utilization?: number
  isOnline?: boolean
  className?: string
}

export function SupercomputerArray({
  flops = 2.4,
  utilization = 87,
  isOnline = true,
  className,
}: SupercomputerProps) {
  return (
    <PanelFrame variant="teal" className={cn('p-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[9px] text-[var(--neon-cyan)]">
          SUPERCOMPUTER
        </div>
        <div className="flex items-center gap-1">
          <div className="font-mono text-[7px] text-white/30">T3</div>
          <LED on={isOnline} color="cyan" size="sm" />
        </div>
      </div>

      {/* Compute nodes visualization */}
      <div className="relative h-8 bg-black/40 rounded overflow-hidden p-1">
        <div className="grid grid-cols-8 grid-rows-2 gap-0.5 h-full">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{
                background: i < Math.floor(utilization / 6.25)
                  ? 'var(--neon-cyan)'
                  : 'rgba(255,255,255,0.1)',
                opacity: isOnline ? (i < Math.floor(utilization / 6.25) ? 0.8 : 0.3) : 0.1,
                animation: isOnline && i < Math.floor(utilization / 6.25)
                  ? `node-blink ${0.5 + (i % 4) * 0.1}s ease-in-out infinite`
                  : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-between font-mono text-[7px] mt-1">
        <span className="text-[var(--neon-cyan)]">{flops} PFLOPS</span>
        <span className="text-white/40">{utilization}% LOAD</span>
      </div>
    </PanelFrame>
  )
}

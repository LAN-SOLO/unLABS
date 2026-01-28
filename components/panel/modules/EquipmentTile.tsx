'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { Knob } from '../controls/Knob'
import { LED } from '../controls/LED'
import { usePowerManagerOptional } from '@/contexts/PowerManager'
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
// Device ID: CDC-001 | Version: 1.4.2
// Compatible: EnergyCore, BatteryPack, Synthesizers
// unOS Commands: DEVICE CACHE [TEST|RESET|STATUS]
// ==================================================
interface CrystalDataCacheProps {
  crystalCount?: number
  sliceCount?: number
  totalPower?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

type DeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type TestPhase = 'memory' | 'bus' | 'cache' | 'power' | 'protocol' | 'complete' | null

export function CrystalDataCache({
  crystalCount = 0,
  sliceCount = 0,
  totalPower = 0,
  className,
  onTest,
  onReset,
}: CrystalDataCacheProps) {
  const [deviceState, setDeviceState] = useState<DeviceState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<TestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [displayValues, setDisplayValues] = useState({ crystals: '--', slices: '--', power: '--' })

  const status = crystalCount > 0 ? 'active' : 'standby'

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('POST check...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Memory init...')
      setBootPhase(2)
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Cache allocate...')
      setBootPhase(3)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Bus connect...')
      setBootPhase(4)
      setDisplayValues({ crystals: '0', slices: '0', power: '0.0' })
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Data sync...')
      setBootPhase(5)
      await new Promise(r => setTimeout(r, 400))

      // Final boot - show real values
      setDisplayValues({
        crystals: String(crystalCount),
        slices: String(sliceCount),
        power: totalPower.toFixed(1),
      })
      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage(crystalCount > 0 ? 'Cache synchronized' : 'Awaiting data')
    }

    bootSequence()
  }, []) // Only run on mount

  // Update display values when props change (after boot)
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues({
        crystals: String(crystalCount),
        slices: String(sliceCount),
        power: totalPower.toFixed(1),
      })
      setStatusMessage(crystalCount > 0 ? 'Cache synchronized' : 'Awaiting data')
    }
  }, [crystalCount, sliceCount, totalPower, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<TestPhase>[] = ['memory', 'bus', 'cache', 'power', 'protocol', 'complete']
    const phaseMessages: Record<NonNullable<TestPhase>, string> = {
      memory: 'Testing memory integrity...',
      bus: 'Testing data bus...',
      cache: 'Verifying cache coherence...',
      power: 'Checking power supply...',
      protocol: 'Testing protocol...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 400))
    }

    // All tests pass
    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    // Clear result after 3 seconds
    setTimeout(() => {
      setTestResult(null)
      setStatusMessage(crystalCount > 0 ? 'Cache synchronized' : 'Awaiting data')
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    // Shutdown sequence
    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Flushing buffers...')
    setDisplayValues({ crystals: '--', slices: '--', power: '--' })
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Releasing resources...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 400))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('POST check...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Memory init...')
    setBootPhase(2)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Cache allocate...')
    setBootPhase(3)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Bus connect...')
    setBootPhase(4)
    setDisplayValues({ crystals: '0', slices: '0', power: '0.0' })
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Data sync...')
    setBootPhase(5)
    await new Promise(r => setTimeout(r, 400))

    // Final - show real values
    setDisplayValues({
      crystals: String(crystalCount),
      slices: String(sliceCount),
      power: totalPower.toFixed(1),
    })
    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage(crystalCount > 0 ? 'Cache synchronized' : 'Awaiting data')
    onReset?.()
  }

  // LED color based on state
  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : 'amber'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      {/* Header with status LED */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <LED
            on={isLedOn}
            color={getLedColor()}
            size="sm"
          />
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--neon-amber)]">
              Crystal Data
            </div>
            <div className="font-mono text-[6px] text-white/30">CACHE</div>
          </div>
        </div>
        <div className="font-mono text-[6px] text-white/20">CDC-001</div>
      </div>

      {/* Data display grid */}
      <div className="grid grid-cols-3 gap-1 mb-1.5">
        <div className="bg-black/40 p-1 rounded border border-white/5 relative overflow-hidden">
          <div className="font-mono text-[6px] text-white/40">Crystals</div>
          <div
            className={cn(
              'font-mono text-sm tabular-nums transition-all duration-300',
              deviceState === 'booting' && bootPhase < 4 && 'opacity-50'
            )}
            style={{
              color: 'var(--neon-green)',
              textShadow: displayValues.crystals !== '--' && displayValues.crystals !== '0' ? '0 0 6px var(--neon-green)' : 'none',
            }}
          >
            {displayValues.crystals}
          </div>
          {deviceState === 'testing' && testPhase === 'cache' && (
            <div className="absolute inset-0 bg-[var(--neon-cyan)]/10 animate-pulse" />
          )}
        </div>
        <div className="bg-black/40 p-1 rounded border border-white/5 relative overflow-hidden">
          <div className="font-mono text-[6px] text-white/40">Slices</div>
          <div
            className={cn(
              'font-mono text-sm tabular-nums transition-all duration-300',
              deviceState === 'booting' && bootPhase < 4 && 'opacity-50'
            )}
            style={{
              color: 'var(--neon-cyan)',
              textShadow: displayValues.slices !== '--' && displayValues.slices !== '0' ? '0 0 6px var(--neon-cyan)' : 'none',
            }}
          >
            {displayValues.slices}
          </div>
          {deviceState === 'testing' && testPhase === 'memory' && (
            <div className="absolute inset-0 bg-[var(--neon-cyan)]/10 animate-pulse" />
          )}
        </div>
        <div className="bg-black/40 p-1 rounded border border-white/5 relative overflow-hidden">
          <div className="font-mono text-[6px] text-white/40">Power</div>
          <div
            className={cn(
              'font-mono text-sm tabular-nums transition-all duration-300',
              deviceState === 'booting' && bootPhase < 4 && 'opacity-50'
            )}
            style={{
              color: 'var(--neon-amber)',
              textShadow: displayValues.power !== '--' && displayValues.power !== '0.0' ? '0 0 6px var(--neon-amber)' : 'none',
            }}
          >
            {displayValues.power}
          </div>
          {deviceState === 'testing' && testPhase === 'power' && (
            <div className="absolute inset-0 bg-[var(--neon-amber)]/10 animate-pulse" />
          )}
        </div>
      </div>

      {/* Status bar with micro buttons */}
      <div className="mt-1 pt-1 border-t border-white/5 flex items-center gap-1">
        <span className={cn(
          'font-mono text-[5px] transition-colors flex-1 truncate',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/30'
        )}>
          {statusMessage}
        </span>

        {/* Micro square buttons */}
        <button
          onClick={handleTest}
          disabled={deviceState !== 'online'}
          className={cn(
            'w-3.5 h-3 rounded-sm font-mono text-[5px] transition-all border flex items-center justify-center',
            deviceState === 'testing'
              ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border-[var(--neon-cyan)]/50'
              : testResult === 'pass'
              ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]/50'
              : testResult === 'fail'
              ? 'bg-[var(--neon-red)]/20 text-[var(--neon-red)] border-[var(--neon-red)]/50'
              : 'bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20 disabled:opacity-30'
          )}
          title="Test"
        >
          {deviceState === 'testing' ? '·' : testResult === 'pass' ? '✓' : testResult === 'fail' ? '✗' : 'T'}
        </button>
        <button
          onClick={handleReboot}
          disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
          className={cn(
            'w-3.5 h-3 rounded-sm font-mono text-[5px] transition-all border flex items-center justify-center',
            deviceState === 'rebooting' || deviceState === 'booting'
              ? 'bg-[var(--neon-amber)]/20 text-[var(--neon-amber)] border-[var(--neon-amber)]/50'
              : 'bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20 disabled:opacity-30'
          )}
          title="Reboot"
        >
          {deviceState === 'rebooting' || deviceState === 'booting' ? '·' : 'R'}
        </button>

        {/* Status indicators */}
        <div className="flex gap-0.5 ml-0.5">
          <div className={cn('w-1 h-1 rounded-full transition-colors',
            deviceState === 'online' && crystalCount > 0 ? 'bg-[var(--neon-green)]' : 'bg-white/20'
          )} />
          <div className={cn('w-1 h-1 rounded-full transition-colors',
            deviceState === 'online' && sliceCount > 0 ? 'bg-[var(--neon-cyan)]' : 'bg-white/20'
          )} />
          <div className={cn('w-1 h-1 rounded-full transition-colors',
            deviceState === 'online' && totalPower > 0 ? 'bg-[var(--neon-amber)]' : 'bg-white/20'
          )} />
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// ENERGY CORE - Links to volatility/network energy
// Device ID: UEC-001 | Version: 2.0.1
// Compatible: CrystalDataCache, BatteryPack, QuantumAnalyzer
// unOS Commands: DEVICE CORE [TEST|RESET|STATUS]
// ==================================================
interface EnergyCoreProps {
  volatilityTier?: number
  tps?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

type EnergyCoreState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type EnergyCoreTestPhase = 'voltage' | 'frequency' | 'stability' | 'output' | 'sync' | 'complete' | null

export function EnergyCore({
  volatilityTier = 1,
  tps = 1000,
  className,
  onTest,
  onReset,
}: EnergyCoreProps) {
  const [deviceState, setDeviceState] = useState<EnergyCoreState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<EnergyCoreTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [displayValues, setDisplayValues] = useState({ tier: '--', level: 0, tps: '----' })

  // Energy level based on volatility tier (1-5 maps to 20-100%)
  const energyLevel = volatilityTier * 20
  const status = volatilityTier >= 3 ? 'active' : volatilityTier >= 2 ? 'standby' : 'offline'

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('POST check...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Voltage calibration...')
      setBootPhase(2)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Frequency sync...')
      setBootPhase(3)
      setDisplayValues(prev => ({ ...prev, tier: '0', level: 0 }))
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Network connect...')
      setBootPhase(4)
      setDisplayValues(prev => ({ ...prev, tps: '0' }))
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Energy stabilize...')
      setBootPhase(5)
      await new Promise(r => setTimeout(r, 350))

      // Final boot - show real values
      setDisplayValues({
        tier: `T${volatilityTier}`,
        level: energyLevel,
        tps: tps.toLocaleString(),
      })
      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage('Core stable')
    }

    bootSequence()
  }, []) // Only run on mount

  // Update display values when props change (after boot)
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues({
        tier: `T${volatilityTier}`,
        level: energyLevel,
        tps: tps.toLocaleString(),
      })
    }
  }, [volatilityTier, tps, energyLevel, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<EnergyCoreTestPhase>[] = ['voltage', 'frequency', 'stability', 'output', 'sync', 'complete']
    const phaseMessages: Record<NonNullable<EnergyCoreTestPhase>, string> = {
      voltage: 'Testing voltage regulators...',
      frequency: 'Checking frequency sync...',
      stability: 'Verifying field stability...',
      output: 'Measuring power output...',
      sync: 'Testing network sync...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 350))
    }

    // All tests pass
    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    // Clear result after 3 seconds
    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('Core stable')
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    // Shutdown sequence
    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Draining capacitors...')
    setDisplayValues({ tier: '--', level: 0, tps: '----' })
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Releasing field...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Core halted')
    await new Promise(r => setTimeout(r, 350))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('POST check...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Voltage calibration...')
    setBootPhase(2)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Frequency sync...')
    setBootPhase(3)
    setDisplayValues(prev => ({ ...prev, tier: '0', level: 0 }))
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Network connect...')
    setBootPhase(4)
    setDisplayValues(prev => ({ ...prev, tps: '0' }))
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Energy stabilize...')
    setBootPhase(5)
    await new Promise(r => setTimeout(r, 350))

    // Final - show real values
    setDisplayValues({
      tier: `T${volatilityTier}`,
      level: energyLevel,
      tps: tps.toLocaleString(),
    })
    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage('Core stable')
    onReset?.()
  }

  // LED color based on state
  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      {/* Header with status LED */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <LED
            on={isLedOn}
            color={getLedColor()}
            size="sm"
          />
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--neon-amber)]">
              Energy Core
            </div>
            <div className="font-mono text-[6px] text-white/30">UNSTABLE</div>
          </div>
        </div>
        <div className="font-mono text-[6px] text-white/20">UEC-001</div>
      </div>

      {/* Main display - Tier and Energy bar */}
      <div className="flex items-center gap-2 mb-1.5">
        {/* Tier display */}
        <div className={cn(
          'bg-black/40 px-2 py-1 rounded border border-white/5 relative overflow-hidden',
          deviceState === 'testing' && testPhase === 'output' && 'ring-1 ring-[var(--neon-amber)]/50'
        )}>
          <div
            className={cn(
              'font-mono text-lg font-bold tabular-nums transition-all duration-300',
              deviceState === 'booting' && bootPhase < 3 && 'opacity-50'
            )}
            style={{
              color: volatilityTier >= 4 ? 'var(--neon-red)' : 'var(--neon-amber)',
              textShadow: displayValues.tier !== '--' ? `0 0 8px ${volatilityTier >= 4 ? 'var(--neon-red)' : 'var(--neon-amber)'}` : 'none',
            }}
          >
            {displayValues.tier}
          </div>
        </div>

        {/* Energy bar and TPS */}
        <div className="flex-1">
          <div className={cn(
            'h-3 bg-black/40 rounded overflow-hidden border border-white/5 relative',
            deviceState === 'testing' && testPhase === 'stability' && 'ring-1 ring-[var(--neon-cyan)]/50'
          )}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${displayValues.level}%`,
                background: `linear-gradient(90deg, var(--neon-amber), ${
                  volatilityTier >= 4 ? 'var(--neon-red)' : 'var(--neon-orange)'
                })`,
                boxShadow: displayValues.level > 0 ? 'inset 0 0 8px rgba(255,184,0,0.3)' : 'none',
              }}
            />
            {/* Energy pulse effect when online */}
            {deviceState === 'online' && displayValues.level > 0 && (
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  animation: 'energy-pulse 2s ease-in-out infinite',
                }}
              />
            )}
          </div>
          <div className={cn(
            'flex justify-between mt-0.5',
            deviceState === 'testing' && testPhase === 'sync' && 'text-[var(--neon-cyan)]'
          )}>
            <span className="font-mono text-[6px] text-white/30">LEVEL</span>
            <span className="font-mono text-[7px] text-white/50">TPS: {displayValues.tps}</span>
          </div>
        </div>
      </div>

      {/* Status bar with micro buttons */}
      <div className="mt-1 pt-1 border-t border-white/5 flex items-center gap-1">
        <span className={cn(
          'font-mono text-[5px] transition-colors flex-1 truncate',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/30'
        )}>
          {statusMessage}
        </span>

        {/* Micro buttons */}
        <button
          onClick={handleTest}
          disabled={deviceState !== 'online'}
          className={cn(
            'w-4 h-3 rounded-sm font-mono text-[5px] transition-all border flex items-center justify-center',
            deviceState === 'testing'
              ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border-[var(--neon-cyan)]/50 animate-pulse'
              : testResult === 'pass'
              ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]/50'
              : testResult === 'fail'
              ? 'bg-[var(--neon-red)]/20 text-[var(--neon-red)] border-[var(--neon-red)]/50'
              : 'bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20 disabled:opacity-30'
          )}
          title="Test"
        >
          {deviceState === 'testing' ? '·' : testResult === 'pass' ? '✓' : testResult === 'fail' ? '✗' : 'T'}
        </button>
        <button
          onClick={handleReboot}
          disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
          className={cn(
            'w-4 h-3 rounded-sm font-mono text-[5px] transition-all border flex items-center justify-center',
            deviceState === 'rebooting' || deviceState === 'booting'
              ? 'bg-[var(--neon-amber)]/20 text-[var(--neon-amber)] border-[var(--neon-amber)]/50 animate-pulse'
              : 'bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20 disabled:opacity-30'
          )}
          title="Reboot"
        >
          {deviceState === 'rebooting' || deviceState === 'booting' ? '·' : 'R'}
        </button>

        {/* Status indicators */}
        <div className="flex gap-0.5 ml-0.5">
          <div className={cn('w-1 h-1 rounded-full transition-colors',
            deviceState === 'online' && volatilityTier >= 1 ? 'bg-[var(--neon-amber)]' : 'bg-white/20'
          )} />
          <div className={cn('w-1 h-1 rounded-full transition-colors',
            deviceState === 'online' && volatilityTier >= 3 ? 'bg-[var(--neon-orange)]' : 'bg-white/20'
          )} />
          <div className={cn('w-1 h-1 rounded-full transition-colors',
            deviceState === 'online' && volatilityTier >= 5 ? 'bg-[var(--neon-red)]' : 'bg-white/20'
          )} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes energy-pulse {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// BATTERY PACK - Shows user balance/staking
// Device ID: BAT-001 | Version: 1.8.0
// Compatible: EnergyCore, CrystalDataCache
// unOS Commands: DEVICE BATTERY [TEST|RESET|STATUS]
// ==================================================
interface BatteryPackProps {
  available?: number
  staked?: number
  locked?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

type BatteryState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type BatteryTestPhase = 'cells' | 'voltage' | 'current' | 'capacity' | 'regen' | 'complete' | null

export function BatteryPack({
  available = 100,
  staked = 0,
  locked = 0,
  className,
  onTest,
  onReset,
}: BatteryPackProps) {
  const [deviceState, setDeviceState] = useState<BatteryState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<BatteryTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [displayValues, setDisplayValues] = useState({ available: '--', staked: '--', segments: 0 })

  const total = available + staked + locked
  const chargePercent = total > 0 ? Math.min(100, (available / 200) * 100) : 0
  const status = available >= 50 ? 'active' : available >= 20 ? 'standby' : 'offline'

  // Battery segments (5 levels)
  const segments = [100, 80, 60, 40, 20]
  const activeSegments = segments.filter(level => chargePercent >= level).length

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Cell check...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 200))

      setStatusMessage('Voltage sense...')
      setBootPhase(2)
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Current monitor...')
      setBootPhase(3)
      setDisplayValues(prev => ({ ...prev, segments: 1 }))
      await new Promise(r => setTimeout(r, 200))

      setStatusMessage('Capacity scan...')
      setBootPhase(4)
      setDisplayValues(prev => ({ ...prev, segments: 3, available: '0' }))
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Regen link...')
      setBootPhase(5)
      await new Promise(r => setTimeout(r, 300))

      // Final boot - show real values
      setDisplayValues({
        available: available.toFixed(0),
        staked: staked > 0 ? `+${staked.toFixed(0)}` : '',
        segments: activeSegments,
      })
      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage('Auto-regen active')
    }

    bootSequence()
  }, []) // Only run on mount

  // Update display values when props change (after boot)
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues({
        available: available.toFixed(0),
        staked: staked > 0 ? `+${staked.toFixed(0)}` : '',
        segments: activeSegments,
      })
    }
  }, [available, staked, activeSegments, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<BatteryTestPhase>[] = ['cells', 'voltage', 'current', 'capacity', 'regen', 'complete']
    const phaseMessages: Record<NonNullable<BatteryTestPhase>, string> = {
      cells: 'Testing cell integrity...',
      voltage: 'Checking voltage levels...',
      current: 'Measuring current flow...',
      capacity: 'Verifying capacity...',
      regen: 'Testing regeneration...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 300))
    }

    // All tests pass
    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    // Clear result after 3 seconds
    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('Auto-regen active')
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    // Shutdown sequence
    setStatusMessage('Disconnecting...')
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Discharging caps...')
    setDisplayValues({ available: '--', staked: '--', segments: 0 })
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Safe mode...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Pack offline')
    await new Promise(r => setTimeout(r, 300))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Cell check...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Voltage sense...')
    setBootPhase(2)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Current monitor...')
    setBootPhase(3)
    setDisplayValues(prev => ({ ...prev, segments: 1 }))
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Capacity scan...')
    setBootPhase(4)
    setDisplayValues(prev => ({ ...prev, segments: 3, available: '0' }))
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Regen link...')
    setBootPhase(5)
    await new Promise(r => setTimeout(r, 300))

    // Final - show real values
    setDisplayValues({
      available: available.toFixed(0),
      staked: staked > 0 ? `+${staked.toFixed(0)}` : '',
      segments: activeSegments,
    })
    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage('Auto-regen active')
    onReset?.()
  }

  // LED color based on state
  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)

  return (
    <PanelFrame variant="military" className={cn('p-2', className)}>
      {/* Header with status LED */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <LED
            on={isLedOn}
            color={getLedColor()}
            size="sm"
          />
          <div>
            <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--neon-lime,#bfff00)]">
              01_Portable Battery Pack
            </div>
            <div className="font-mono text-[5px] text-white/30">AUTOMATIC REGENERATION</div>
          </div>
        </div>
        <div className="font-mono text-[5px] text-white/20">BAT-001</div>
      </div>

      {/* Main display - Battery segments and value */}
      <div className="flex items-center justify-between mb-1.5">
        {/* Battery segments */}
        <div className={cn(
          'flex flex-col gap-0.5 relative',
          deviceState === 'testing' && testPhase === 'cells' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded p-0.5'
        )}>
          {segments.map((level, i) => {
            const isActive = deviceState === 'online'
              ? i >= (5 - displayValues.segments)
              : i >= (5 - displayValues.segments) && bootPhase >= 3

            return (
              <div
                key={i}
                className={cn(
                  'w-8 h-1.5 rounded-sm transition-all duration-300',
                  isActive ? 'bg-[var(--neon-green)]' : 'bg-white/10',
                  deviceState === 'testing' && testPhase === 'capacity' && isActive && 'animate-pulse'
                )}
                style={{
                  boxShadow: isActive ? '0 0 4px var(--neon-green)' : 'none',
                }}
              />
            )
          })}
        </div>

        {/* Value display */}
        <div className={cn(
          'text-right',
          deviceState === 'testing' && testPhase === 'voltage' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded px-1'
        )}>
          <div
            className={cn(
              'font-mono text-lg tabular-nums transition-all duration-300',
              deviceState === 'booting' && bootPhase < 4 && 'opacity-50'
            )}
            style={{
              color: 'var(--neon-green)',
              textShadow: displayValues.available !== '--' && displayValues.available !== '0' ? '0 0 8px var(--neon-green)' : 'none',
            }}
          >
            {displayValues.available}
          </div>
          <div className="font-mono text-[8px] text-white/40">_unSC</div>
          {displayValues.staked && (
            <div
              className={cn(
                'font-mono text-[8px] transition-opacity',
                deviceState === 'booting' && bootPhase < 5 ? 'opacity-0' : 'opacity-100'
              )}
              style={{ color: 'var(--neon-cyan)' }}
            >
              {displayValues.staked} staked
            </div>
          )}
        </div>
      </div>

      {/* Status bar with micro buttons */}
      <div className="mt-1 pt-1 border-t border-white/5 flex items-center gap-1">
        <span className={cn(
          'font-mono text-[5px] transition-colors flex-1 truncate',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/30'
        )}>
          {statusMessage}
        </span>

        {/* Micro military-style buttons */}
        <button
          onClick={handleTest}
          disabled={deviceState !== 'online'}
          className={cn(
            'w-4 h-3 font-mono text-[5px] transition-all border border-dashed flex items-center justify-center',
            deviceState === 'testing'
              ? 'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border-[var(--neon-cyan)]'
              : testResult === 'pass'
              ? 'bg-[var(--neon-green)]/10 text-[var(--neon-green)] border-[var(--neon-green)]'
              : testResult === 'fail'
              ? 'bg-[var(--neon-red)]/10 text-[var(--neon-red)] border-[var(--neon-red)]'
              : 'bg-[#0a0a0f] text-[var(--neon-lime,#bfff00)]/60 border-[var(--neon-lime,#bfff00)]/30 hover:border-[var(--neon-lime,#bfff00)]/60 disabled:opacity-30'
          )}
          title="Test"
        >
          {deviceState === 'testing' ? '·' : testResult === 'pass' ? '●' : testResult === 'fail' ? '✕' : '◇'}
        </button>
        <button
          onClick={handleReboot}
          disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
          className={cn(
            'w-4 h-3 font-mono text-[5px] transition-all border border-dashed flex items-center justify-center',
            deviceState === 'rebooting' || deviceState === 'booting'
              ? 'bg-[var(--neon-amber)]/10 text-[var(--neon-amber)] border-[var(--neon-amber)]'
              : 'bg-[#0a0a0f] text-[var(--neon-lime,#bfff00)]/60 border-[var(--neon-lime,#bfff00)]/30 hover:border-[var(--neon-lime,#bfff00)]/60 disabled:opacity-30'
          )}
          title="Cycle"
        >
          {deviceState === 'rebooting' || deviceState === 'booting' ? '·' : '↻'}
        </button>

        {/* Status indicators */}
        <div className="flex gap-0.5 ml-0.5">
          <div className={cn('w-1 h-1 rounded-full transition-colors',
            deviceState === 'online' && available > 0 ? 'bg-[var(--neon-green)]' : 'bg-white/20'
          )} />
          <div className={cn('w-1 h-1 rounded-full transition-colors',
            deviceState === 'online' && staked > 0 ? 'bg-[var(--neon-cyan)]' : 'bg-white/20'
          )} />
          <div className={cn('w-1 h-1 rounded-full transition-colors',
            deviceState === 'online' && locked > 0 ? 'bg-[var(--neon-amber)]' : 'bg-white/20'
          )} />
        </div>
      </div>
    </PanelFrame>
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
// Device ID: HMS-001 | Version: 3.2.1
// Compatible: CrystalDataCache, Interpolator
// unOS Commands: DEVICE SYNTH [TEST|RESET|STATUS]
// Functions: Slice creation, State toggle, Color fuse
// ==================================================
interface HandmadeSynthesizerProps {
  progress?: TechTreeProgress
  className?: string
  onTest?: () => void
  onReset?: () => void
}

type SynthState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type SynthTestPhase = 'oscillator' | 'waveform' | 'filter' | 'output' | 'calibrate' | 'complete' | null

export function HandmadeSynthesizer({
  progress,
  className,
  onTest,
  onReset,
}: HandmadeSynthesizerProps) {
  const [deviceState, setDeviceState] = useState<SynthState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<SynthTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [knobValues, setKnobValues] = useState({ pulse: 0, tempo: 0, freq: 0 })

  const tier = progress?.currentTier ?? 0
  const status = tier >= 2 ? 'active' : tier >= 1 ? 'standby' : 'offline'

  // Target knob values based on tier
  const targetPulse = tier * 15 + 20
  const targetTempo = tier * 10 + 30
  const targetFreq = tier * 12 + 25

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Power on...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 200))

      setStatusMessage('Oscillator init...')
      setBootPhase(2)
      setKnobValues({ pulse: 10, tempo: 10, freq: 10 })
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Waveform gen...')
      setBootPhase(3)
      setKnobValues({ pulse: targetPulse / 2, tempo: targetTempo / 2, freq: targetFreq / 2 })
      await new Promise(r => setTimeout(r, 200))

      setStatusMessage('Filter bank...')
      setBootPhase(4)
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Calibrating...')
      setBootPhase(5)
      await new Promise(r => setTimeout(r, 300))

      // Final boot - show real values
      setKnobValues({ pulse: targetPulse, tempo: targetTempo, freq: targetFreq })
      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage(tier > 0 ? TIER_CAPABILITIES.synthesizers[tier] : 'Awaiting upgrade')
    }

    bootSequence()
  }, []) // Only run on mount

  // Update knob values when tier changes (after boot)
  useEffect(() => {
    if (deviceState === 'online') {
      setKnobValues({ pulse: targetPulse, tempo: targetTempo, freq: targetFreq })
      setStatusMessage(tier > 0 ? TIER_CAPABILITIES.synthesizers[tier] : 'Awaiting upgrade')
    }
  }, [tier, targetPulse, targetTempo, targetFreq, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<SynthTestPhase>[] = ['oscillator', 'waveform', 'filter', 'output', 'calibrate', 'complete']
    const phaseMessages: Record<NonNullable<SynthTestPhase>, string> = {
      oscillator: 'Testing oscillators...',
      waveform: 'Checking waveforms...',
      filter: 'Verifying filters...',
      output: 'Testing output stage...',
      calibrate: 'Calibration check...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 300))
    }

    // All tests pass
    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    // Clear result after 3 seconds
    setTimeout(() => {
      setTestResult(null)
      setStatusMessage(tier > 0 ? TIER_CAPABILITIES.synthesizers[tier] : 'Awaiting upgrade')
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    // Shutdown sequence
    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Draining buffers...')
    setKnobValues({ pulse: 0, tempo: 0, freq: 0 })
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Power off...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Synth offline')
    await new Promise(r => setTimeout(r, 300))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Power on...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Oscillator init...')
    setBootPhase(2)
    setKnobValues({ pulse: 10, tempo: 10, freq: 10 })
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Waveform gen...')
    setBootPhase(3)
    setKnobValues({ pulse: targetPulse / 2, tempo: targetTempo / 2, freq: targetFreq / 2 })
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Filter bank...')
    setBootPhase(4)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Calibrating...')
    setBootPhase(5)
    await new Promise(r => setTimeout(r, 300))

    // Final - show real values
    setKnobValues({ pulse: targetPulse, tempo: targetTempo, freq: targetFreq })
    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage(tier > 0 ? TIER_CAPABILITIES.synthesizers[tier] : 'Awaiting upgrade')
    onReset?.()
  }

  // LED color based on state
  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)

  return (
    <PanelFrame variant="teal" className={cn('p-2', className)}>
      {/* Header with status LED and micro buttons */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <LED
            on={isLedOn}
            color={getLedColor()}
            size="sm"
          />
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--neon-cyan)]">
              Handmade Synthesizer
            </div>
            <div className="font-mono text-[6px] text-white/40">
              {TIER_NAMES.synthesizers[tier]}
            </div>
          </div>
        </div>

        {/* Micro LED-style buttons */}
        <div className="flex gap-1 items-center">
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div className={cn(
              'w-2.5 h-2.5 rounded-full border transition-all',
              deviceState === 'testing'
                ? 'bg-[var(--neon-cyan)] border-[var(--neon-cyan)] shadow-[0_0_6px_var(--neon-cyan)]'
                : testResult === 'pass'
                ? 'bg-[var(--neon-green)] border-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]'
                : testResult === 'fail'
                ? 'bg-[var(--neon-red)] border-[var(--neon-red)] shadow-[0_0_6px_var(--neon-red)]'
                : 'bg-[#0a0a0f] border-[var(--neon-cyan)]/30 group-hover:border-[var(--neon-cyan)]/60'
            )} />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-mono text-[4px] text-white/30">T</span>
          </button>
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reset"
          >
            <div className={cn(
              'w-2.5 h-2.5 rounded-full border transition-all',
              deviceState === 'rebooting' || deviceState === 'booting'
                ? 'bg-[var(--neon-amber)] border-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber)]'
                : 'bg-[#0a0a0f] border-[var(--neon-amber)]/30 group-hover:border-[var(--neon-amber)]/60'
            )} />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-mono text-[4px] text-white/30">R</span>
          </button>
          <div className="font-mono text-[5px] text-white/20 ml-1">HMS-001</div>
        </div>
      </div>

      {/* Knobs row */}
      <div className={cn(
        'flex items-center justify-between transition-opacity duration-300',
        deviceState === 'booting' && bootPhase < 3 ? 'opacity-50' : 'opacity-100'
      )}>
        <div className={cn(
          'transition-all',
          deviceState === 'testing' && testPhase === 'oscillator' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
        )}>
          <Knob value={knobValues.pulse} onChange={() => {}} size="sm" label="PULSE" accentColor="var(--neon-cyan)" />
        </div>
        <div className={cn(
          'transition-all',
          deviceState === 'testing' && testPhase === 'waveform' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
        )}>
          <Knob value={knobValues.tempo} onChange={() => {}} size="sm" label="TEMPO" accentColor="var(--neon-amber)" />
        </div>
        <div className={cn(
          'transition-all',
          deviceState === 'testing' && testPhase === 'filter' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
        )}>
          <Knob value={knobValues.freq} onChange={() => {}} size="sm" label="FREQ" accentColor="var(--neon-green)" />
        </div>
      </div>

      {/* Status bar */}
      <div className="mt-1.5 pt-1 border-t border-white/5 flex items-center justify-between">
        <span className={cn(
          'font-mono text-[6px] transition-colors truncate',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          tier > 0 ? 'text-[var(--neon-cyan)]' : 'text-white/30'
        )}>
          {statusMessage}
        </span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(t => (
            <div
              key={t}
              className={cn('w-1 h-1 rounded-full transition-colors',
                deviceState === 'online' && tier >= t ? 'bg-[var(--neon-cyan)]' : 'bg-white/10'
              )}
            />
          ))}
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// ECHO RECORDER - Adapters tech tree visualization
// Device ID: ECR-001 | Version: 1.1.0
// Compatible: HandmadeSynthesizer, Oscilloscope
// unOS Commands: DEVICE RECORDER [TEST|RESET|STATUS]
// Functions: Blockchain data feeds, Rotation trait
// ==================================================
interface EchoRecorderProps {
  progress?: TechTreeProgress
  className?: string
  onTest?: () => void
  onReset?: () => void
}

type RecorderState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type RecorderTestPhase = 'antenna' | 'decoder' | 'buffer' | 'sync' | 'output' | 'complete' | null

export function EchoRecorder({
  progress,
  className,
  onTest,
  onReset,
}: EchoRecorderProps) {
  const [deviceState, setDeviceState] = useState<RecorderState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<RecorderTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [knobValues, setKnobValues] = useState({ pulse: 0, bloom: 0 })

  const tier = progress?.currentTier ?? 0
  const status = tier >= 2 ? 'active' : tier >= 1 ? 'standby' : 'offline'

  // Target knob values based on tier
  const targetPulse = 40 + tier * 10
  const targetBloom = 60 + tier * 5

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Antenna scan...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 200))

      setStatusMessage('Decoder init...')
      setBootPhase(2)
      setKnobValues({ pulse: 20, bloom: 30 })
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Buffer alloc...')
      setBootPhase(3)
      await new Promise(r => setTimeout(r, 200))

      setStatusMessage('Oracle sync...')
      setBootPhase(4)
      setKnobValues({ pulse: targetPulse / 2, bloom: targetBloom / 2 })
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Signal lock...')
      setBootPhase(5)
      await new Promise(r => setTimeout(r, 250))

      // Final boot
      setKnobValues({ pulse: targetPulse, bloom: targetBloom })
      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage(TIER_NAMES.adapters[tier])
    }

    bootSequence()
  }, [])

  // Update knob values when tier changes (after boot)
  useEffect(() => {
    if (deviceState === 'online') {
      setKnobValues({ pulse: targetPulse, bloom: targetBloom })
      setStatusMessage(TIER_NAMES.adapters[tier])
    }
  }, [tier, targetPulse, targetBloom, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<RecorderTestPhase>[] = ['antenna', 'decoder', 'buffer', 'sync', 'output', 'complete']
    const phaseMessages: Record<NonNullable<RecorderTestPhase>, string> = {
      antenna: 'Testing antenna...',
      decoder: 'Checking decoder...',
      buffer: 'Verifying buffer...',
      sync: 'Testing oracle sync...',
      output: 'Output check...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 280))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage(TIER_NAMES.adapters[tier])
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Disconnecting...')
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Flush buffer...')
    setKnobValues({ pulse: 0, bloom: 0 })
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Antenna off...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Recorder offline')
    await new Promise(r => setTimeout(r, 300))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Antenna scan...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Decoder init...')
    setBootPhase(2)
    setKnobValues({ pulse: 20, bloom: 30 })
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Buffer alloc...')
    setBootPhase(3)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Oracle sync...')
    setBootPhase(4)
    setKnobValues({ pulse: targetPulse / 2, bloom: targetBloom / 2 })
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Signal lock...')
    setBootPhase(5)
    await new Promise(r => setTimeout(r, 250))

    setKnobValues({ pulse: targetPulse, bloom: targetBloom })
    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage(TIER_NAMES.adapters[tier])
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <LED on={isLedOn} color={getLedColor()} size="sm" />
          <div className="font-mono text-[9px] text-[var(--neon-amber)]">
            ECHO RECORDER
          </div>
        </div>

        {/* Micro push buttons with nano LEDs */}
        <div className="flex gap-1.5 items-center">
          {/* Test button - push style with nano LED */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div className={cn(
              'w-3 h-3 rounded-sm border-2 transition-all flex items-center justify-center',
              'bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a]',
              'border-[#3a3a4a] border-b-[#0a0a0f]',
              'active:border-t-[#0a0a0f] active:border-b-[#3a3a4a] active:from-[#1a1a2a] active:to-[#2a2a3a]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
              deviceState === 'testing' && 'from-[#1a1a2a] to-[#2a2a3a]'
            )}>
              {/* Nano LED inside button */}
              <div className={cn(
                'w-1 h-1 rounded-full transition-all',
                deviceState === 'testing'
                  ? 'bg-[var(--neon-cyan)] shadow-[0_0_4px_var(--neon-cyan)]'
                  : testResult === 'pass'
                  ? 'bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]'
                  : testResult === 'fail'
                  ? 'bg-[var(--neon-red)] shadow-[0_0_4px_var(--neon-red)]'
                  : 'bg-white/20 group-hover:bg-white/40'
              )} />
            </div>
          </button>

          {/* Reset button - push style with nano LED */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reset"
          >
            <div className={cn(
              'w-3 h-3 rounded-sm border-2 transition-all flex items-center justify-center',
              'bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a]',
              'border-[#3a3a4a] border-b-[#0a0a0f]',
              'active:border-t-[#0a0a0f] active:border-b-[#3a3a4a] active:from-[#1a1a2a] active:to-[#2a2a3a]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
              (deviceState === 'rebooting' || deviceState === 'booting') && 'from-[#1a1a2a] to-[#2a2a3a]'
            )}>
              {/* Nano LED inside button */}
              <div className={cn(
                'w-1 h-1 rounded-full transition-all',
                deviceState === 'rebooting' || deviceState === 'booting'
                  ? 'bg-[var(--neon-amber)] shadow-[0_0_4px_var(--neon-amber)]'
                  : 'bg-white/20 group-hover:bg-white/40'
              )} />
            </div>
          </button>
        </div>
      </div>

      {/* Tier name */}
      <div className={cn(
        'font-mono text-[7px] text-white/40 mb-1.5 transition-opacity',
        deviceState === 'booting' && bootPhase < 4 ? 'opacity-50' : 'opacity-100'
      )}>
        {TIER_NAMES.adapters[tier]}
      </div>

      {/* Knobs row */}
      <div className={cn(
        'flex items-center gap-2 transition-opacity duration-300',
        deviceState === 'booting' && bootPhase < 2 ? 'opacity-50' : 'opacity-100'
      )}>
        <div className={cn(
          'transition-all',
          deviceState === 'testing' && testPhase === 'antenna' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
        )}>
          <Knob value={knobValues.pulse} onChange={() => {}} size="sm" label="PULSE" />
        </div>
        <div className={cn(
          'transition-all',
          deviceState === 'testing' && testPhase === 'output' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
        )}>
          <Knob value={knobValues.bloom} onChange={() => {}} size="sm" label="BLOOM" />
        </div>

        {/* Recording indicator */}
        <div className="flex-1 flex justify-end">
          <div className={cn(
            'w-1.5 h-1.5 rounded-full transition-all',
            deviceState === 'online' && tier > 0
              ? 'bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber)] animate-pulse'
              : 'bg-white/10'
          )} />
        </div>
      </div>

      {/* Status bar */}
      <div className="mt-1.5 pt-1 border-t border-white/5 flex items-center justify-between">
        <span className={cn(
          'font-mono text-[5px] transition-colors truncate',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/30'
        )}>
          {statusMessage}
        </span>
        <span className="font-mono text-[5px] text-white/20">ECR-001</span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// INTERPOLATOR - Optics tech tree visualization
// Device ID: INT-001 | Version: 2.5.3
// Compatible: HandmadeSynthesizer, Oscilloscope
// unOS Commands: DEVICE INTERPOLATOR [TEST|RESET|STATUS]
// Functions: Color interpolation, Era manipulation
// ==================================================
interface InterpolatorProps {
  progress?: TechTreeProgress
  className?: string
  onTest?: () => void
  onReset?: () => void
}

type InterpolatorState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type InterpolatorTestPhase = 'prism' | 'spectrum' | 'lens' | 'calibrate' | 'output' | 'complete' | null

export function Interpolator({
  progress,
  className,
  onTest,
  onReset,
}: InterpolatorProps) {
  const [deviceState, setDeviceState] = useState<InterpolatorState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<InterpolatorTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [spectrumWidth, setSpectrumWidth] = useState(0)

  const tier = progress?.currentTier ?? 0
  const status = tier >= 2 ? 'active' : tier >= 1 ? 'standby' : 'offline'

  // Color range based on tier
  const colors = ['#800000', '#ff0000', '#ff6600', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3', '#ff00ff']
  const maxColorIndex = Math.min(tier * 2, colors.length - 1)

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Prism align...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 200))

      setStatusMessage('Spectrum init...')
      setBootPhase(2)
      setSpectrumWidth(20)
      await new Promise(r => setTimeout(r, 250))

      setStatusMessage('Lens focus...')
      setBootPhase(3)
      setSpectrumWidth(50)
      await new Promise(r => setTimeout(r, 200))

      setStatusMessage('Wavelength cal...')
      setBootPhase(4)
      setSpectrumWidth(80)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Output ready...')
      setBootPhase(5)
      await new Promise(r => setTimeout(r, 250))

      setSpectrumWidth(100)
      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage(tier > 0 ? TIER_CAPABILITIES.optics[tier] : 'Awaiting upgrade')
    }

    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setStatusMessage(tier > 0 ? TIER_CAPABILITIES.optics[tier] : 'Awaiting upgrade')
    }
  }, [tier, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<InterpolatorTestPhase>[] = ['prism', 'spectrum', 'lens', 'calibrate', 'output', 'complete']
    const phaseMessages: Record<NonNullable<InterpolatorTestPhase>, string> = {
      prism: 'Testing prism array...',
      spectrum: 'Checking spectrum...',
      lens: 'Verifying lens focus...',
      calibrate: 'Calibration test...',
      output: 'Output verification...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 280))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage(tier > 0 ? TIER_CAPABILITIES.optics[tier] : 'Awaiting upgrade')
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Retracting prism...')
    setSpectrumWidth(50)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Lens park...')
    setSpectrumWidth(0)
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Interpolator offline')
    await new Promise(r => setTimeout(r, 300))

    // Boot
    setDeviceState('booting')
    setStatusMessage('Prism align...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Spectrum init...')
    setBootPhase(2)
    setSpectrumWidth(20)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Lens focus...')
    setBootPhase(3)
    setSpectrumWidth(50)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Wavelength cal...')
    setBootPhase(4)
    setSpectrumWidth(80)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Output ready...')
    setBootPhase(5)
    await new Promise(r => setTimeout(r, 250))

    setSpectrumWidth(100)
    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage(tier > 0 ? TIER_CAPABILITIES.optics[tier] : 'Awaiting upgrade')
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)

  return (
    <PanelFrame variant="military" className={cn('p-2', className)}>
      {/* Header with LED and micro toggle buttons */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <LED on={isLedOn} color={getLedColor()} size="sm" />
          <div className="font-mono text-[9px] text-[var(--neon-lime,#bfff00)]">
            INTERPOLATOR
          </div>
        </div>

        {/* Micro toggle switch style buttons */}
        <div className="flex gap-1 items-center">
          {/* Test - toggle switch */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div className={cn(
              'w-4 h-2 rounded-full transition-all relative',
              'bg-gradient-to-b from-[#1a1a2a] to-[#0a0a0f]',
              'border border-[#3a3a4a]',
              'shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
            )}>
              {/* Toggle knob with nano LED */}
              <div className={cn(
                'absolute top-0 h-2 w-2 rounded-full transition-all',
                'bg-gradient-to-b from-[#4a4a5a] to-[#2a2a3a]',
                'border border-[#5a5a6a]',
                'flex items-center justify-center',
                deviceState === 'testing' || testResult ? 'left-2' : 'left-0'
              )}>
                <div className={cn(
                  'w-0.5 h-0.5 rounded-full transition-all',
                  deviceState === 'testing'
                    ? 'bg-[var(--neon-cyan)] shadow-[0_0_3px_var(--neon-cyan)]'
                    : testResult === 'pass'
                    ? 'bg-[var(--neon-green)] shadow-[0_0_3px_var(--neon-green)]'
                    : testResult === 'fail'
                    ? 'bg-[var(--neon-red)] shadow-[0_0_3px_var(--neon-red)]'
                    : 'bg-white/30'
                )} />
              </div>
            </div>
          </button>

          {/* Reset - toggle switch */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reset"
          >
            <div className={cn(
              'w-4 h-2 rounded-full transition-all relative',
              'bg-gradient-to-b from-[#1a1a2a] to-[#0a0a0f]',
              'border border-[#3a3a4a]',
              'shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
            )}>
              <div className={cn(
                'absolute top-0 h-2 w-2 rounded-full transition-all',
                'bg-gradient-to-b from-[#4a4a5a] to-[#2a2a3a]',
                'border border-[#5a5a6a]',
                'flex items-center justify-center',
                deviceState === 'rebooting' || deviceState === 'booting' ? 'left-2' : 'left-0'
              )}>
                <div className={cn(
                  'w-0.5 h-0.5 rounded-full transition-all',
                  deviceState === 'rebooting' || deviceState === 'booting'
                    ? 'bg-[var(--neon-amber)] shadow-[0_0_3px_var(--neon-amber)]'
                    : 'bg-white/30'
                )} />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Tier name */}
      <div className={cn(
        'font-mono text-[7px] text-white/40 mb-1 transition-opacity',
        deviceState === 'booting' && bootPhase < 3 ? 'opacity-50' : 'opacity-100'
      )}>
        {TIER_NAMES.optics[tier]}
      </div>

      {/* Spectrum bar */}
      <div
        className={cn(
          'h-6 bg-black/30 rounded flex items-center justify-center overflow-hidden relative',
          deviceState === 'testing' && testPhase === 'spectrum' && 'ring-1 ring-[var(--neon-cyan)]/50'
        )}
      >
        {tier > 0 && deviceState !== 'offline' ? (
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${spectrumWidth}%`,
              background: `linear-gradient(90deg, ${colors.slice(0, maxColorIndex + 1).join(', ')})`,
              opacity: deviceState === 'booting' ? 0.5 : 1,
            }}
          />
        ) : (
          <span className="font-mono text-[8px] text-white/30">
            {deviceState === 'booting' ? 'LOADING...' : 'OFFLINE'}
          </span>
        )}

        {/* Scanning line during test */}
        {deviceState === 'testing' && testPhase === 'spectrum' && (
          <div
            className="absolute inset-y-0 w-0.5 bg-white/80"
            style={{ animation: 'scan-line 1s ease-in-out infinite' }}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="mt-1 pt-1 border-t border-white/5 flex items-center justify-between">
        <span className={cn(
          'font-mono text-[5px] transition-colors truncate flex-1',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          tier > 0 ? 'text-[var(--neon-lime,#bfff00)]' : 'text-white/30'
        )}>
          {statusMessage}
        </span>
        <span className="font-mono text-[5px] text-white/20">INT-001</span>
      </div>

      <style jsx global>{`
        @keyframes scan-line {
          0%, 100% { left: 0; }
          50% { left: calc(100% - 2px); }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// BASIC TOOLKIT - Fundamental laboratory hand tools
// ==================================================
// BASIC TOOLKIT - Tier 1 Hand Tools
// ==================================================
type ToolkitState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type ToolkitTestPhase = 'probe' | 'clamp' | 'laser' | 'drill' | 'calibrate' | 'complete' | null
type ToolkitBootPhase = 'init' | 'tools' | 'interface' | 'ready' | null

interface BasicToolkitProps {
  className?: string
}

export function BasicToolkit({ className }: BasicToolkitProps) {
  const [deviceState, setDeviceState] = useState<ToolkitState>('booting')
  const [testPhase, setTestPhase] = useState<ToolkitTestPhase>(null)
  const [bootPhase, setBootPhase] = useState<ToolkitBootPhase>('init')
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  // Random logo position (memoized on mount)
  const [logoPosition] = useState(() => {
    const positions = [
      { bottom: '4px', right: '4px' },
      { bottom: '4px', left: '4px' },
      { top: '20px', right: '4px' },
      { top: '20px', left: '4px' },
    ]
    return positions[Math.floor(Math.random() * positions.length)]
  })

  // Tool status indicators
  const tools = [
    { name: 'PROBE', active: deviceState === 'online', color: 'var(--neon-cyan)', testPhase: 'probe' as const },
    { name: 'CLAMP', active: deviceState === 'online', color: 'var(--neon-green)', testPhase: 'clamp' as const },
    { name: 'LASER', active: deviceState === 'online' && selectedTool === 'LASER', color: 'var(--neon-red)', testPhase: 'laser' as const },
    { name: 'DRILL', active: deviceState === 'online', color: 'var(--neon-amber)', testPhase: 'drill' as const },
  ]

  // Boot sequence
  useEffect(() => {
    if (deviceState === 'booting') {
      const bootSequence = async () => {
        setBootPhase('init')
        await new Promise(r => setTimeout(r, 400))
        setBootPhase('tools')
        await new Promise(r => setTimeout(r, 500))
        setBootPhase('interface')
        await new Promise(r => setTimeout(r, 400))
        setBootPhase('ready')
        await new Promise(r => setTimeout(r, 300))
        setDeviceState('online')
        setBootPhase(null)
      }
      bootSequence()
    }
  }, [deviceState])

  // Test sequence handler
  const runTest = useCallback(() => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    const testSequence = async () => {
      setTestPhase('probe')
      await new Promise(r => setTimeout(r, 600))
      setTestPhase('clamp')
      await new Promise(r => setTimeout(r, 500))
      setTestPhase('laser')
      await new Promise(r => setTimeout(r, 700))
      setTestPhase('drill')
      await new Promise(r => setTimeout(r, 600))
      setTestPhase('calibrate')
      await new Promise(r => setTimeout(r, 500))
      setTestPhase('complete')
      await new Promise(r => setTimeout(r, 400))
      setTestPhase(null)
      setDeviceState('online')
    }
    testSequence()
  }, [deviceState])

  // Reboot handler
  const reboot = useCallback(() => {
    setDeviceState('rebooting')
    setTestPhase(null)
    setTimeout(() => {
      setDeviceState('booting')
    }, 800)
  }, [])

  // Tool select handler
  const selectTool = useCallback((toolName: string) => {
    if (deviceState !== 'online') return
    setSelectedTool(prev => prev === toolName ? null : toolName)
  }, [deviceState])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'offline': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }

  return (
    <PanelFrame variant="default" className={cn('p-2 relative overflow-hidden', className)}>
      {/* Round nano buttons with illuminated edges - top */}
      <div className="absolute top-1 right-1 flex gap-1 z-10">
        {/* Test button */}
        <button
          onClick={runTest}
          disabled={deviceState !== 'online'}
          className="group relative"
          title="Test"
        >
          <div
            className="w-3 h-3 rounded-full border transition-all"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
              borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a',
              boxShadow: deviceState === 'testing'
                ? '0 0 6px var(--neon-purple), inset 0 0 3px var(--neon-purple)'
                : 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}
          />
          {/* Illuminated edge ring */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: '1px solid',
              borderColor: deviceState === 'online' ? 'var(--neon-cyan)' : 'transparent',
              opacity: deviceState === 'online' ? 0.6 : 0,
              animation: deviceState === 'testing' ? 'pulse 0.5s ease-in-out infinite' : 'none',
            }}
          />
        </button>
        {/* Reboot button */}
        <button
          onClick={reboot}
          disabled={deviceState === 'booting' || deviceState === 'rebooting'}
          className="group relative"
          title="Reboot"
        >
          <div
            className="w-3 h-3 rounded-full border transition-all"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
              borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a',
              boxShadow: deviceState === 'rebooting'
                ? '0 0 6px var(--neon-amber), inset 0 0 3px var(--neon-amber)'
                : 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}
          />
          {/* Illuminated edge ring */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: '1px solid',
              borderColor: deviceState === 'online' ? 'var(--neon-amber)' : 'transparent',
              opacity: deviceState === 'online' ? 0.5 : 0,
              animation: deviceState === 'rebooting' ? 'pulse 0.3s ease-in-out infinite' : 'none',
            }}
          />
        </button>
      </div>

      {/* Company logo - HNDX (Handex Tools) */}
      <div
        className="absolute font-mono text-[5px] text-white/20 pointer-events-none z-0"
        style={logoPosition}
      >
        HNDX
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 4px ${getStatusColor()}`,
              animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
            }}
          />
          <div className="font-mono text-[9px] text-[var(--neon-amber)]">
            BASIC TOOLKIT
          </div>
        </div>
        <div className="font-mono text-[7px] text-white/30">T1</div>
      </div>

      {/* Boot overlay */}
      {deviceState === 'booting' && bootPhase && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="font-mono text-[8px] text-[var(--neon-cyan)] mb-1">
              {bootPhase === 'init' && 'INITIALIZING...'}
              {bootPhase === 'tools' && 'LOADING TOOLS...'}
              {bootPhase === 'interface' && 'I/O INTERFACE...'}
              {bootPhase === 'ready' && 'READY'}
            </div>
            <div className="flex gap-0.5 justify-center">
              {['init', 'tools', 'interface', 'ready'].map((phase, i) => (
                <div
                  key={phase}
                  className="w-1 h-1 rounded-full"
                  style={{
                    backgroundColor: ['init', 'tools', 'interface', 'ready'].indexOf(bootPhase) >= i
                      ? 'var(--neon-cyan)'
                      : '#333',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reboot overlay */}
      {deviceState === 'rebooting' && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20">
          <div className="font-mono text-[8px] text-[var(--neon-amber)] animate-pulse">
            REBOOTING...
          </div>
        </div>
      )}

      {/* Tool grid */}
      <div className="grid grid-cols-2 gap-1">
        {tools.map((tool) => {
          const isBeingTested = deviceState === 'testing' && testPhase === tool.testPhase
          const isSelected = selectedTool === tool.name
          return (
            <button
              key={tool.name}
              onClick={() => selectTool(tool.name)}
              disabled={deviceState !== 'online'}
              className={cn(
                'flex items-center gap-1 px-1 py-0.5 rounded transition-all',
                isSelected ? 'bg-white/10 border border-white/20' : 'bg-black/30',
                deviceState === 'online' && 'hover:bg-white/5'
              )}
            >
              <div
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: tool.active || isBeingTested ? tool.color : '#333',
                  boxShadow: tool.active || isBeingTested ? `0 0 4px ${tool.color}` : 'none',
                  animation: isBeingTested ? 'pulse 0.3s ease-in-out infinite' : 'none',
                }}
              />
              <span
                className="font-mono text-[7px] transition-colors"
                style={{
                  color: isBeingTested ? tool.color : tool.active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
                }}
              >
                {tool.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* Test status bar */}
      {deviceState === 'testing' && testPhase && (
        <div className="mt-1.5 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[6px] text-[var(--neon-purple)]">
              TEST: {testPhase.toUpperCase()}
            </span>
            <div className="flex gap-0.5">
              {['probe', 'clamp', 'laser', 'drill', 'calibrate'].map((phase) => (
                <div
                  key={phase}
                  className="w-1 h-1 rounded-sm"
                  style={{
                    backgroundColor:
                      testPhase === phase ? 'var(--neon-purple)' :
                      ['probe', 'clamp', 'laser', 'drill', 'calibrate'].indexOf(phase) <
                      ['probe', 'clamp', 'laser', 'drill', 'calibrate'].indexOf(testPhase || 'probe')
                        ? 'var(--neon-green)' : '#333',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected tool info */}
      {deviceState === 'online' && selectedTool && (
        <div className="mt-1.5 pt-1 border-t border-white/10">
          <div className="font-mono text-[6px] text-white/50">
            {selectedTool === 'PROBE' && 'Digital probe for I/O testing'}
            {selectedTool === 'CLAMP' && 'Precision grip for assembly'}
            {selectedTool === 'LASER' && 'Micro-laser for fine cuts'}
            {selectedTool === 'DRILL' && 'High-speed drill bit'}
          </div>
        </div>
      )}
    </PanelFrame>
  )
}

// ==================================================
// MATERIAL SCANNER - Resource detection device
// ==================================================
// ==================================================
// MATERIAL SCANNER - Tier 1 Resource Detection
// ==================================================
type ScannerState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type ScannerTestPhase = 'emitter' | 'receiver' | 'calibrate' | 'sweep' | 'complete' | null
type ScannerBootPhase = 'init' | 'sensors' | 'calibrate' | 'ready' | null

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
  const [deviceState, setDeviceState] = useState<ScannerState>('booting')
  const [testPhase, setTestPhase] = useState<ScannerTestPhase>(null)
  const [bootPhase, setBootPhase] = useState<ScannerBootPhase>('init')
  const [scanLine, setScanLine] = useState(0)
  const [foundMaterials, setFoundMaterials] = useState<number[]>([])

  // Random logo position (memoized on mount)
  const [logoPosition] = useState(() => {
    const positions = [
      { bottom: '2px', right: '2px' },
      { bottom: '2px', left: '2px' },
      { top: '16px', right: '2px' },
    ]
    return positions[Math.floor(Math.random() * positions.length)]
  })

  // Boot sequence
  useEffect(() => {
    if (deviceState === 'booting') {
      const bootSequence = async () => {
        setBootPhase('init')
        await new Promise(r => setTimeout(r, 350))
        setBootPhase('sensors')
        await new Promise(r => setTimeout(r, 400))
        setBootPhase('calibrate')
        await new Promise(r => setTimeout(r, 450))
        setBootPhase('ready')
        await new Promise(r => setTimeout(r, 300))
        setDeviceState('online')
        setBootPhase(null)
      }
      bootSequence()
    }
  }, [deviceState])

  // Scanning animation when online
  useEffect(() => {
    if (deviceState !== 'online') return

    const scanInterval = setInterval(() => {
      setScanLine(prev => {
        const next = prev + 2
        if (next > 100) {
          // Reset and generate new material positions
          setFoundMaterials(
            Array.from({ length: detectedMaterials }, () =>
              Math.floor(Math.random() * 80) + 10
            ).sort((a, b) => a - b)
          )
          return 0
        }
        return next
      })
    }, 50)

    return () => clearInterval(scanInterval)
  }, [deviceState, detectedMaterials])

  // Initialize materials on first online
  useEffect(() => {
    if (deviceState === 'online' && foundMaterials.length === 0) {
      setFoundMaterials(
        Array.from({ length: detectedMaterials }, (_, i) => 20 + i * 25)
      )
    }
  }, [deviceState, detectedMaterials, foundMaterials.length])

  // Test sequence handler
  const runTest = useCallback(() => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    const testSequence = async () => {
      setTestPhase('emitter')
      await new Promise(r => setTimeout(r, 500))
      setTestPhase('receiver')
      await new Promise(r => setTimeout(r, 500))
      setTestPhase('calibrate')
      await new Promise(r => setTimeout(r, 600))
      setTestPhase('sweep')
      await new Promise(r => setTimeout(r, 700))
      setTestPhase('complete')
      await new Promise(r => setTimeout(r, 400))
      setTestPhase(null)
      setDeviceState('online')
    }
    testSequence()
  }, [deviceState])

  // Reboot handler
  const reboot = useCallback(() => {
    setDeviceState('rebooting')
    setTestPhase(null)
    setFoundMaterials([])
    setScanLine(0)
    setTimeout(() => {
      setDeviceState('booting')
    }, 600)
  }, [])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-cyan)'
      case 'booting': return 'var(--neon-green)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'offline': return 'var(--neon-red)'
      default: return 'var(--neon-cyan)'
    }
  }

  return (
    <PanelFrame variant="teal" className={cn('p-2 relative overflow-hidden', className)}>
      {/* Ultra thin stacked nano buttons - top right */}
      <div className="absolute top-1 right-1 flex flex-col gap-px z-10">
        {/* Test button - ultra thin */}
        <button
          onClick={runTest}
          disabled={deviceState !== 'online'}
          className="group relative"
          title="Test"
        >
          <div
            className="w-4 h-1.5 rounded-sm border transition-all"
            style={{
              background: 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2a 100%)',
              borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a',
              boxShadow: deviceState === 'testing'
                ? '0 0 4px var(--neon-purple), inset 0 0 2px var(--neon-purple)'
                : 'inset 0 0.5px 1px rgba(0,0,0,0.5)',
            }}
          />
          {/* Illuminated edge - top */}
          <div
            className="absolute inset-x-0 top-0 h-px rounded-t-sm"
            style={{
              background: deviceState === 'online' ? 'var(--neon-cyan)' : 'transparent',
              opacity: deviceState === 'online' ? 0.7 : 0,
              boxShadow: deviceState === 'online' ? '0 0 3px var(--neon-cyan)' : 'none',
            }}
          />
        </button>
        {/* Reboot button - ultra thin */}
        <button
          onClick={reboot}
          disabled={deviceState === 'booting' || deviceState === 'rebooting'}
          className="group relative"
          title="Reboot"
        >
          <div
            className="w-4 h-1.5 rounded-sm border transition-all"
            style={{
              background: 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2a 100%)',
              borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a',
              boxShadow: deviceState === 'rebooting'
                ? '0 0 4px var(--neon-amber), inset 0 0 2px var(--neon-amber)'
                : 'inset 0 0.5px 1px rgba(0,0,0,0.5)',
            }}
          />
          {/* Illuminated edge - bottom */}
          <div
            className="absolute inset-x-0 bottom-0 h-px rounded-b-sm"
            style={{
              background: deviceState === 'online' ? 'var(--neon-amber)' : 'transparent',
              opacity: deviceState === 'online' ? 0.5 : 0,
              boxShadow: deviceState === 'online' ? '0 0 3px var(--neon-amber)' : 'none',
            }}
          />
        </button>
      </div>

      {/* Company logo - SCNR (Scanner Tech) */}
      <div
        className="absolute font-mono text-[4px] text-white/15 pointer-events-none z-0"
        style={logoPosition}
      >
        SCNR
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <div
            className="w-1.5 h-1.5 rounded-full transition-all"
            style={{
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 4px ${getStatusColor()}`,
              animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
            }}
          />
          <div className="font-mono text-[9px] text-[var(--neon-cyan)]">
            MATERIAL SCANNER
          </div>
        </div>
      </div>

      {/* Boot overlay */}
      {deviceState === 'booting' && bootPhase && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20 rounded">
          <div className="text-center">
            <div className="font-mono text-[7px] text-[var(--neon-cyan)] mb-1">
              {bootPhase === 'init' && 'INIT...'}
              {bootPhase === 'sensors' && 'SENSORS...'}
              {bootPhase === 'calibrate' && 'CALIBRATE...'}
              {bootPhase === 'ready' && 'READY'}
            </div>
            <div className="flex gap-0.5 justify-center">
              {['init', 'sensors', 'calibrate', 'ready'].map((phase, i) => (
                <div
                  key={phase}
                  className="w-1 h-0.5 rounded-sm"
                  style={{
                    backgroundColor: ['init', 'sensors', 'calibrate', 'ready'].indexOf(bootPhase) >= i
                      ? 'var(--neon-cyan)'
                      : '#333',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reboot overlay */}
      {deviceState === 'rebooting' && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20 rounded">
          <div className="font-mono text-[7px] text-[var(--neon-amber)] animate-pulse">
            REBOOTING...
          </div>
        </div>
      )}

      {/* Scanning visualization */}
      <div className="relative h-6 bg-black/40 rounded overflow-hidden mb-1">
        {/* Test overlay */}
        {deviceState === 'testing' && testPhase && (
          <div className="absolute inset-0 bg-[var(--neon-purple)]/10 z-10 flex items-center justify-center">
            <span className="font-mono text-[6px] text-[var(--neon-purple)]">
              {testPhase.toUpperCase()}
            </span>
          </div>
        )}

        {/* Scan line animation */}
        {deviceState === 'online' && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--neon-cyan)]"
            style={{
              left: `${scanLine}%`,
              boxShadow: '0 0 8px var(--neon-cyan), 0 0 16px var(--neon-cyan)',
            }}
          />
        )}

        {/* Detection blips */}
        {deviceState === 'online' && foundMaterials.map((pos, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[var(--neon-green)] transition-opacity"
            style={{
              left: `${pos}%`,
              top: '50%',
              transform: 'translateY(-50%)',
              boxShadow: '0 0 4px var(--neon-green)',
              opacity: scanLine > pos ? 1 : 0.3,
            }}
          />
        ))}

        {/* Grid lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'linear-gradient(90deg, var(--neon-cyan) 1px, transparent 1px)',
            backgroundSize: '20% 100%',
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-between font-mono text-[7px]">
        <span className="text-white/40">MATERIALS</span>
        <span className="text-[var(--neon-green)]">
          {deviceState === 'online' ? `${foundMaterials.length} FOUND` : '-- --'}
        </span>
      </div>

      {/* Test status */}
      {deviceState === 'testing' && testPhase && (
        <div className="mt-1 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[5px] text-[var(--neon-purple)]">
              TEST: {testPhase.toUpperCase()}
            </span>
            <div className="flex gap-0.5">
              {['emitter', 'receiver', 'calibrate', 'sweep'].map((phase) => (
                <div
                  key={phase}
                  className="w-1 h-1 rounded-sm"
                  style={{
                    backgroundColor:
                      testPhase === phase ? 'var(--neon-purple)' :
                      ['emitter', 'receiver', 'calibrate', 'sweep'].indexOf(phase) <
                      ['emitter', 'receiver', 'calibrate', 'sweep'].indexOf(testPhase || 'emitter')
                        ? 'var(--neon-green)' : '#333',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </PanelFrame>
  )
}

// ==================================================
// RESOURCE MAGNET - Tier 1 Gadget passive resource attraction
// ==================================================
type MagnetState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type MagnetTestPhase = 'coils' | 'field' | 'flux' | 'calibrate' | 'complete' | null

interface ResourceMagnetProps {
  magnetStrength?: number
  isActive?: boolean
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function ResourceMagnet({
  magnetStrength = 45,
  isActive = true,
  className,
  onTest,
  onReset,
}: ResourceMagnetProps) {
  const [deviceState, setDeviceState] = useState<MagnetState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<MagnetTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayValues, setDisplayValues] = useState({ strength: 0, fieldActive: false })
  const [strength, setStrength] = useState(magnetStrength)

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Coil check...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 280))

      setStatusMessage('Flux gen...')
      setBootPhase(2)
      setDisplayValues({ strength: 10, fieldActive: false })
      await new Promise(r => setTimeout(r, 320))

      setStatusMessage('Field init...')
      setBootPhase(3)
      setDisplayValues({ strength: 25, fieldActive: true })
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Calibrate...')
      setBootPhase(4)
      setDisplayValues({ strength: 35, fieldActive: true })
      await new Promise(r => setTimeout(r, 350))

      // Final boot
      setDisplayValues({ strength: magnetStrength, fieldActive: true })
      setBootPhase(5)
      setDeviceState('online')
      setStatusMessage('ACTIVE')
    }

    bootSequence()
  }, [])

  // Update strength display when knob changes
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues(prev => ({ ...prev, strength: strength }))
    }
  }, [strength, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<MagnetTestPhase>[] = ['coils', 'field', 'flux', 'calibrate', 'complete']
    const phaseMessages: Record<NonNullable<MagnetTestPhase>, string> = {
      coils: 'Testing coils...',
      field: 'Field strength...',
      flux: 'Flux density...',
      calibrate: 'Calibrating...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 350))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('ACTIVE')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Field off...')
    setDisplayValues(prev => ({ ...prev, fieldActive: false }))
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Discharge...')
    setDisplayValues({ strength: 0, fieldActive: false })
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Offline')
    await new Promise(r => setTimeout(r, 300))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Coil check...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 280))

    setStatusMessage('Flux gen...')
    setBootPhase(2)
    setDisplayValues({ strength: 10, fieldActive: false })
    await new Promise(r => setTimeout(r, 320))

    setStatusMessage('Field init...')
    setBootPhase(3)
    setDisplayValues({ strength: 25, fieldActive: true })
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Calibrate...')
    setBootPhase(4)
    setDisplayValues({ strength: 35, fieldActive: true })
    await new Promise(r => setTimeout(r, 350))

    setDisplayValues({ strength: strength, fieldActive: true })
    setBootPhase(5)
    setDeviceState('online')
    setStatusMessage('ACTIVE')
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return 'green'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)
  const fieldActive = displayValues.fieldActive && (deviceState === 'online' || deviceState === 'testing')

  return (
    <PanelFrame variant="military" className={cn('p-2', className)}>
      {/* Header with shiny metal buttons */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <LED on={isLedOn} color={getLedColor()} size="sm" />
          <div className="font-mono text-[8px] text-[var(--neon-lime,#bfff00)]">
            RESOURCE MAGNET
          </div>
        </div>

        {/* Shiny metal micro buttons - chrome/nickel style */}
        <div className="flex items-center gap-0.5">
          {/* Mini logo - TESLA coil reference */}
          <div
            className="font-mono text-[3px] text-white/40 px-0.5 mr-0.5"
            style={{
              background: 'linear-gradient(180deg, #4a4a4a 0%, #2a2a2a 100%)',
              border: '0.5px solid #5a5a5a',
              borderRadius: '1px',
            }}
          >
            TESLA
          </div>
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div className={cn(
              'w-3 h-2 rounded-[2px] transition-all',
              'flex items-center justify-center',
              'group-active:scale-95'
            )}
            style={{
              background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 15%, #a0a0a0 50%, #808080 85%, #606060 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)',
              border: '0.5px solid #707070',
            }}
            >
              {/* Chrome reflection */}
              <div className="absolute inset-0 rounded-[2px] opacity-40"
                style={{
                  backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.2) 100%)',
                }}
              />
              {/* Status dot */}
              <div className={cn(
                'w-1 h-1 rounded-full transition-all z-10',
                deviceState === 'testing'
                  ? 'bg-[var(--neon-cyan)] shadow-[0_0_3px_var(--neon-cyan)]'
                  : testResult === 'pass'
                  ? 'bg-[var(--neon-green)] shadow-[0_0_3px_var(--neon-green)]'
                  : 'bg-[#404040]'
              )} />
            </div>
          </button>
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div className={cn(
              'w-3 h-2 rounded-[2px] transition-all',
              'flex items-center justify-center',
              'group-active:scale-95'
            )}
            style={{
              background: 'linear-gradient(180deg, #f0d0a0 0%, #d4a060 15%, #b08040 50%, #906020 85%, #704000 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)',
              border: '0.5px solid #8a6030',
            }}
            >
              {/* Brass reflection */}
              <div className="absolute inset-0 rounded-[2px] opacity-40"
                style={{
                  backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 40%, transparent 60%, rgba(255,220,150,0.3) 100%)',
                }}
              />
              {/* Status dot */}
              <div className={cn(
                'w-1 h-1 rounded-full transition-all z-10',
                deviceState === 'rebooting' || deviceState === 'booting'
                  ? 'bg-[var(--neon-amber)] shadow-[0_0_3px_var(--neon-amber)]'
                  : 'bg-[#5a4020]'
              )} />
            </div>
          </button>
          <div className="font-mono text-[5px] text-white/30">T1</div>
        </div>
      </div>

      {/* Magnet field visualization */}
      <div className={cn(
        'relative h-8 bg-black/40 rounded flex items-center justify-center overflow-hidden',
        deviceState === 'testing' && testPhase === 'field' && 'ring-1 ring-[var(--neon-green)]/50'
      )}>
        {/* Concentric rings */}
        {[3, 2, 1].map((ring) => (
          <div
            key={ring}
            className={cn(
              'absolute rounded-full border transition-all duration-300',
              fieldActive ? 'border-[var(--neon-green)]/30' : 'border-white/10',
              deviceState === 'testing' && testPhase === 'flux' && 'border-[var(--neon-cyan)]/50'
            )}
            style={{
              width: `${ring * 30}%`,
              height: `${ring * 60}%`,
              opacity: fieldActive ? 0.3 + (4 - ring) * 0.2 : 0.1,
              animation: fieldActive ? `pulse ${1 + ring * 0.3}s ease-in-out infinite` : 'none',
            }}
          />
        ))}
        {/* Center core */}
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-all duration-300',
            deviceState === 'testing' && testPhase === 'coils' && 'ring-2 ring-[var(--neon-cyan)]/50'
          )}
          style={{
            backgroundColor: fieldActive ? 'var(--neon-green)' : '#333',
            boxShadow: fieldActive ? '0 0 8px var(--neon-green)' : 'none',
          }}
        />

        {/* Test overlay */}
        {deviceState === 'testing' && testPhase === 'calibrate' && (
          <div className="absolute inset-0 bg-[var(--neon-green)]/10 animate-pulse" />
        )}
      </div>

      {/* Controls row with fixed layout */}
      <div className="flex items-center justify-between mt-1">
        <Knob
          value={strength}
          onChange={setStrength}
          size="sm"
          label="STR"
          accentColor="var(--neon-green)"
          disabled={deviceState !== 'online'}
        />
        <div className="flex-1 flex flex-col items-end">
          <div className="flex items-center gap-1">
            <span className={cn(
              'font-mono text-[5px] transition-colors whitespace-nowrap overflow-hidden text-ellipsis max-w-[40px]',
              deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
              deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              'text-white/30'
            )}>
              {statusMessage}
            </span>
          </div>
          <div className="font-mono text-[10px] text-[var(--neon-green)]">{displayValues.strength}%</div>
          <div className="font-mono text-[6px] text-white/30">FIELD</div>
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// QUANTUM COMPASS - Anomaly detection device
// Device ID: QCP-001 | Version: 1.5.0
// Compatible: AND-001, DIM-001, QSM-001, EMC-001
// unOS Commands: DEVICE COMPASS [TEST|RESET|STATUS]
// ==================================================
type CompassState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type CompassTestPhase = 'gyro' | 'magnetometer' | 'quantum-link' | 'calibrate' | 'verify' | 'complete' | null

interface QuantumCompassProps {
  anomalyDirection?: number // 0-360 degrees
  anomalyDistance?: number // 0-100
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function QuantumCompass({
  anomalyDirection = 45,
  anomalyDistance = 42,
  className,
  onTest,
  onReset,
}: QuantumCompassProps) {
  const [deviceState, setDeviceState] = useState<CompassState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<CompassTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayDirection, setDisplayDirection] = useState(0)
  const [displayDistance, setDisplayDistance] = useState(999)
  const [needleWobble, setNeedleWobble] = useState(0)

  // Animate needle wobble
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      const wobbleAmount = deviceState === 'testing' ? 15 : 3
      setNeedleWobble((Math.random() - 0.5) * wobbleAmount)
    }, 150)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Gyro init...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Magnetometer...')
      setBootPhase(2)
      setDisplayDirection(180)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Quantum link...')
      setBootPhase(3)
      setDisplayDirection(90)
      setDisplayDistance(500)
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Calibrating...')
      setBootPhase(4)
      setDisplayDirection(anomalyDirection)
      setDisplayDistance(200)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Locking target...')
      setBootPhase(5)
      setDisplayDistance(anomalyDistance)
      await new Promise(r => setTimeout(r, 300))

      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage('ANOMALY DETECTED')
    }
    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayDirection(anomalyDirection)
      setDisplayDistance(anomalyDistance)
    }
  }, [anomalyDirection, anomalyDistance, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<CompassTestPhase>[] = ['gyro', 'magnetometer', 'quantum-link', 'calibrate', 'verify', 'complete']
    const msgs: Record<NonNullable<CompassTestPhase>, string> = {
      gyro: 'Testing gyro...',
      magnetometer: 'Magnetometer...',
      'quantum-link': 'Quantum link...',
      calibrate: 'Calibrating...',
      verify: 'Verifying...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      if (phase === 'quantum-link') {
        // Spin the needle during quantum link test
        for (let i = 0; i < 8; i++) {
          setDisplayDirection(prev => (prev + 45) % 360)
          await new Promise(r => setTimeout(r, 100))
        }
      } else {
        await new Promise(r => setTimeout(r, 350))
      }
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setDisplayDirection(anomalyDirection)
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('ANOMALY DETECTED')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutdown...')
    setDisplayDirection(0)
    setDisplayDistance(999)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 350))

    // Boot
    setDeviceState('booting')
    setStatusMessage('Gyro init...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Quantum link...')
    setBootPhase(3)
    setDisplayDirection(anomalyDirection)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Locking...')
    setBootPhase(5)
    setDisplayDistance(anomalyDistance)
    await new Promise(r => setTimeout(r, 250))

    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage('ANOMALY DETECTED')
    onReset?.()
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const hasAnomaly = displayDistance < 100

  return (
    <PanelFrame variant="default" className={cn('p-1.5', className)}>
      {/* Header with logo */}
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[8px] text-[var(--neon-amber)]">
          QUANTUM COMPASS
        </div>
        <div className="flex items-center gap-1">
          {/* QNTM logo */}
          <div
            className="font-mono text-[3px] text-[#ffaa00] px-0.5 leading-none"
            style={{
              background: 'linear-gradient(180deg, #2a2a1a 0%, #1a1a0a 100%)',
              border: '0.5px solid #3a3a2a',
              borderRadius: '1px',
            }}
          >
            QNTM
          </div>
        </div>
      </div>

      {/* Compass visualization */}
      <div className={cn(
        'relative h-12 bg-black/40 rounded flex items-center justify-center',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-amber)]/30'
      )}>
        {/* Compass ring */}
        <div className="relative w-10 h-10 rounded-full border border-[var(--neon-amber)]/40">
          {/* Tick marks */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-px bg-[var(--neon-amber)]/30"
              style={{
                height: i % 3 === 0 ? '4px' : '2px',
                left: '50%',
                top: '0',
                transformOrigin: '50% 20px',
                transform: `translateX(-50%) rotate(${i * 30}deg)`,
              }}
            />
          ))}
          {/* Cardinal points */}
          {['N', 'E', 'S', 'W'].map((dir, i) => (
            <div
              key={dir}
              className="absolute font-mono text-[5px]"
              style={{
                color: dir === 'N' ? 'var(--neon-red)' : 'var(--neon-amber)',
                opacity: isActive ? 0.8 : 0.3,
                top: i === 0 ? '1px' : i === 2 ? 'auto' : '50%',
                bottom: i === 2 ? '1px' : 'auto',
                left: i === 3 ? '1px' : i === 1 ? 'auto' : '50%',
                right: i === 1 ? '1px' : 'auto',
                transform: i % 2 === 0 ? 'translateX(-50%)' : 'translateY(-50%)',
              }}
            >
              {dir}
            </div>
          ))}
          {/* Anomaly indicator needle */}
          {isActive && hasAnomaly && (
            <div
              className="absolute w-0.5 origin-bottom transition-transform duration-150"
              style={{
                height: '14px',
                left: '50%',
                bottom: '50%',
                transform: `translateX(-50%) rotate(${displayDirection + needleWobble}deg)`,
                background: 'linear-gradient(to top, var(--neon-amber) 0%, var(--neon-red) 100%)',
                boxShadow: '0 0 6px var(--neon-amber)',
                borderRadius: '1px',
              }}
            />
          )}
          {/* Center dot */}
          <div
            className="absolute w-2 h-2 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              background: isActive
                ? 'radial-gradient(circle, var(--neon-amber) 0%, #664400 100%)'
                : '#333',
              boxShadow: isActive ? '0 0 6px var(--neon-amber)' : 'none',
            }}
          />
        </div>

        {/* Distance indicator */}
        <div className="absolute right-1.5 top-1 font-mono text-[8px] text-[var(--neon-amber)]">
          {isActive ? `${displayDistance}m` : '--'}
        </div>

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
            <span className="font-mono text-[6px] text-[var(--neon-amber)] animate-pulse">
              {statusMessage}
            </span>
          </div>
        )}
      </div>

      {/* Status bar with shiny buttons */}
      <div className="flex items-center justify-between font-mono text-[6px] mt-1">
        {/* Shiny test button - bottom left */}
        <button
          onClick={handleTest}
          disabled={deviceState !== 'online'}
          className="group relative disabled:opacity-30"
          title="Test"
        >
          <div
            className="w-3 h-3 rounded-full transition-all group-active:scale-95"
            style={{
              background: deviceState === 'testing'
                ? 'radial-gradient(circle at 30% 30%, #ffffaa 0%, var(--neon-amber) 40%, #886600 80%, #443300 100%)'
                : testResult === 'pass'
                ? 'radial-gradient(circle at 30% 30%, #aaffaa 0%, var(--neon-green) 40%, #006600 80%, #003300 100%)'
                : 'radial-gradient(circle at 30% 30%, #666666 0%, #444444 40%, #222222 80%, #111111 100%)',
              boxShadow: deviceState === 'testing'
                ? '0 0 8px var(--neon-amber), 0 0 16px var(--neon-amber), inset 0 -2px 4px rgba(0,0,0,0.5)'
                : testResult === 'pass'
                ? '0 0 8px var(--neon-green), inset 0 -2px 4px rgba(0,0,0,0.5)'
                : 'inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.5)',
              border: '1px solid #555',
            }}
          />
        </button>

        <span className={cn(
          'text-[5px] flex-1 text-center',
          isActive && hasAnomaly ? 'text-[var(--neon-amber)]' : 'text-white/40'
        )}>
          {statusMessage}
        </span>

        {/* Shiny reset button - bottom right */}
        <button
          onClick={handleReboot}
          disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
          className="group relative disabled:opacity-30"
          title="Reboot"
        >
          <div
            className="w-3 h-3 rounded-full transition-all group-active:scale-95"
            style={{
              background: (deviceState === 'rebooting' || deviceState === 'booting')
                ? 'radial-gradient(circle at 30% 30%, #ffaaaa 0%, var(--neon-red) 40%, #880000 80%, #440000 100%)'
                : 'radial-gradient(circle at 30% 30%, #555555 0%, #333333 40%, #1a1a1a 80%, #0a0a0a 100%)',
              boxShadow: (deviceState === 'rebooting' || deviceState === 'booting')
                ? '0 0 8px var(--neon-red), 0 0 16px var(--neon-red), inset 0 -2px 4px rgba(0,0,0,0.5)'
                : 'inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.5)',
              border: '1px solid #444',
            }}
          />
        </button>
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
        <div className="absolute bottom-3 right-3 w-0.5 h-0.5 rounded-full bg-white/20" style={{ animationName: 'pulse', animationDuration: '2s', animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)', animationIterationCount: 'infinite', animationDelay: '0.5s' }} />

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
// ABSTRACTUM TANK - Raw Abstractum storage
// ==================================================
type TankState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type TankTestPhase = 'seals' | 'pressure' | 'purity' | 'flow' | 'complete' | null

interface AbstractumTankProps {
  amount?: number
  capacity?: number
  purity?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function AbstractumTank({
  amount = 127,
  capacity = 500,
  purity = 94,
  className,
  onTest,
  onReset,
}: AbstractumTankProps) {
  const [deviceState, setDeviceState] = useState<TankState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<TankTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayValues, setDisplayValues] = useState({ amount: 0, purity: 0, active: false })

  const fillPercent = (displayValues.amount / capacity) * 100

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Seal check...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Pressure...')
      setBootPhase(2)
      setDisplayValues({ amount: 0, purity: 50, active: false })
      await new Promise(r => setTimeout(r, 320))

      setStatusMessage('Flow init...')
      setBootPhase(3)
      setDisplayValues({ amount: Math.floor(amount * 0.3), purity: 70, active: true })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Purity scan...')
      setBootPhase(4)
      setDisplayValues({ amount: Math.floor(amount * 0.7), purity: 85, active: true })
      await new Promise(r => setTimeout(r, 300))

      // Final boot
      setDisplayValues({ amount: amount, purity: purity, active: true })
      setBootPhase(5)
      setDeviceState('online')
      setStatusMessage('NOMINAL')
    }

    bootSequence()
  }, [])

  // Update display when props change
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues(prev => ({ ...prev, amount: amount, purity: purity }))
    }
  }, [amount, purity, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<TankTestPhase>[] = ['seals', 'pressure', 'purity', 'flow', 'complete']
    const phaseMessages: Record<NonNullable<TankTestPhase>, string> = {
      seals: 'Testing seals...',
      pressure: 'Pressure test...',
      purity: 'Purity check...',
      flow: 'Flow rate test...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 380))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('NOMINAL')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Valve close...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Depressure...')
    setDisplayValues(prev => ({ ...prev, active: false }))
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Standby...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 300))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Seal check...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Pressure...')
    setBootPhase(2)
    setDisplayValues({ amount: displayValues.amount, purity: 50, active: false })
    await new Promise(r => setTimeout(r, 320))

    setStatusMessage('Flow init...')
    setBootPhase(3)
    setDisplayValues(prev => ({ ...prev, purity: 70, active: true }))
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Purity scan...')
    setBootPhase(4)
    setDisplayValues(prev => ({ ...prev, purity: 85 }))
    await new Promise(r => setTimeout(r, 300))

    setDisplayValues({ amount: amount, purity: purity, active: true })
    setBootPhase(5)
    setDeviceState('online')
    setStatusMessage('NOMINAL')
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return 'cyan'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)

  return (
    <PanelFrame variant="teal" className={cn('p-2', className)}>
      {/* Header with LED framed buttons */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <LED on={isLedOn} color={getLedColor()} size="sm" />
          <div className="font-mono text-[8px] text-[var(--neon-cyan)]">
            ABSTRACTUM TANK
          </div>
        </div>

        {/* LED buttons with frames - square and round style */}
        <div className="flex items-center gap-1">
          {/* Company logo - SIEMENS industrial style */}
          <div
            className="font-mono text-[3px] text-[#5ac8d8] px-0.5"
            style={{
              background: 'linear-gradient(180deg, #1a3a4a 0%, #0a2a3a 100%)',
              border: '0.5px solid #3a5a6a',
              borderRadius: '1px',
            }}
          >
            SIEM
          </div>

          {/* Square LED test button with frame */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div
              className="w-3.5 h-3 rounded-[1px] p-[2px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #3a4a5a 0%, #2a3a4a 50%, #1a2a3a 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 2px rgba(0,0,0,0.5)',
                border: '1px solid #4a5a6a',
              }}
            >
              {/* Inner LED area */}
              <div
                className={cn(
                  'w-full h-full rounded-[1px] flex items-center justify-center transition-all',
                  deviceState === 'testing'
                    ? 'bg-[var(--neon-cyan)] shadow-[0_0_6px_var(--neon-cyan)]'
                    : testResult === 'pass'
                    ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]'
                    : testResult === 'fail'
                    ? 'bg-[var(--neon-red)] shadow-[0_0_6px_var(--neon-red)]'
                    : 'bg-[#0a1a2a]'
                )}
              >
                <span className="font-mono text-[4px] text-black/60 font-bold">T</span>
              </div>
            </div>
          </button>

          {/* Round LED reset button with frame */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div
              className="w-3.5 h-3 rounded-full p-[2px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #4a3a3a 0%, #3a2a2a 50%, #2a1a1a 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 2px rgba(0,0,0,0.5)',
                border: '1px solid #5a4a4a',
              }}
            >
              {/* Inner LED area */}
              <div
                className={cn(
                  'w-full h-full rounded-full flex items-center justify-center transition-all',
                  deviceState === 'rebooting' || deviceState === 'booting'
                    ? 'bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber)]'
                    : 'bg-[#1a0a0a]'
                )}
              >
                <span className="font-mono text-[4px] text-black/60 font-bold">R</span>
              </div>
            </div>
          </button>

          <div className="font-mono text-[5px] text-white/30">RES-1</div>
        </div>
      </div>

      {/* Tank visualization */}
      <div className={cn(
        'relative h-6 bg-black/40 rounded border border-[var(--neon-cyan)]/20 overflow-hidden',
        deviceState === 'testing' && testPhase === 'seals' && 'ring-1 ring-[var(--neon-cyan)]/50'
      )}>
        {/* Fill level */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 transition-all duration-500',
            deviceState === 'testing' && testPhase === 'pressure' && 'animate-pulse'
          )}
          style={{
            height: `${fillPercent}%`,
            background: displayValues.active
              ? 'linear-gradient(180deg, var(--neon-cyan) 0%, rgba(0,255,255,0.3) 100%)'
              : 'linear-gradient(180deg, #333 0%, #222 100%)',
            boxShadow: displayValues.active ? 'inset 0 0 15px rgba(0,255,255,0.4)' : 'none',
          }}
        />
        {/* Flow particles */}
        {displayValues.active && (
          <div className="absolute inset-0 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="absolute w-0.5 h-1 bg-white/40 rounded-full"
                style={{
                  left: `${15 + i * 25}%`,
                  bottom: `${Math.min(fillPercent - 5, 5 + i * 10)}%`,
                  animationName: 'float-up',
                  animationDuration: `${0.8 + i * 0.2}s`,
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Test overlay */}
        {deviceState === 'testing' && testPhase === 'purity' && (
          <div className="absolute inset-0 bg-[var(--neon-cyan)]/10 animate-pulse" />
        )}
      </div>

      {/* Status bar with fixed layout */}
      <div className="flex items-center justify-between font-mono text-[7px] mt-1">
        <span className={cn(
          'w-12 shrink-0 transition-colors',
          displayValues.active ? 'text-[var(--neon-cyan)]' : 'text-white/30'
        )}>
          {displayValues.amount}/{capacity}
        </span>
        <span className={cn(
          'flex-1 text-[5px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/30'
        )}>
          {statusMessage}
        </span>
        <span className="w-14 shrink-0 text-right text-white/40">
          PURITY: {displayValues.purity}%
        </span>
      </div>

      <style jsx global>{`
        @keyframes float-up {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 0.8; }
        }
      `}</style>
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
// Device ID: MFR-001 | Version: 2.3.0
// Compatible: EnergyCore, BatteryPack, QuantumAnalyzer
// unOS Commands: DEVICE REACTOR [TEST|REBOOT|STATUS]
// Functions: Power generation, Plasma containment
// ==================================================
interface MicrofusionReactorProps {
  powerOutput?: number
  stability?: number
  isOnline?: boolean
  className?: string
  onTest?: () => void
  onReset?: () => void
}

type ReactorState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type ReactorTestPhase = 'plasma' | 'containment' | 'coolant' | 'output' | 'safety' | 'complete' | null

export function MicrofusionReactor({
  powerOutput = 847,
  stability = 94,
  isOnline = true,
  className,
  onTest,
  onReset,
}: MicrofusionReactorProps) {
  const [deviceState, setDeviceState] = useState<ReactorState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<ReactorTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [displayValues, setDisplayValues] = useState({ power: 0, stability: 0, ringSpeed: 0 })

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Plasma ignition...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Containment field...')
      setBootPhase(2)
      setDisplayValues({ power: 0, stability: 20, ringSpeed: 0.3 })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Coolant flow...')
      setBootPhase(3)
      setDisplayValues({ power: 200, stability: 50, ringSpeed: 0.5 })
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Power ramp...')
      setBootPhase(4)
      setDisplayValues({ power: 500, stability: 75, ringSpeed: 0.8 })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Stabilizing...')
      setBootPhase(5)
      await new Promise(r => setTimeout(r, 400))

      // Final boot
      setDisplayValues({ power: powerOutput, stability: stability, ringSpeed: 1 })
      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage(`${stability}% STABLE`)
    }

    bootSequence()
  }, [])

  // Update values when props change (after boot)
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues({ power: powerOutput, stability: stability, ringSpeed: 1 })
      setStatusMessage(`${stability}% STABLE`)
    }
  }, [powerOutput, stability, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<ReactorTestPhase>[] = ['plasma', 'containment', 'coolant', 'output', 'safety', 'complete']
    const phaseMessages: Record<NonNullable<ReactorTestPhase>, string> = {
      plasma: 'Testing plasma density...',
      containment: 'Checking containment...',
      coolant: 'Verifying coolant...',
      output: 'Testing power output...',
      safety: 'Safety systems check...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 350))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage(`${stability}% STABLE`)
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('SCRAM initiated...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Plasma cooling...')
    setDisplayValues(prev => ({ ...prev, power: 200, ringSpeed: 0.3 }))
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Field collapse...')
    setDisplayValues({ power: 0, stability: 0, ringSpeed: 0 })
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reactor offline')
    await new Promise(r => setTimeout(r, 400))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Plasma ignition...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Containment field...')
    setBootPhase(2)
    setDisplayValues({ power: 0, stability: 20, ringSpeed: 0.3 })
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Coolant flow...')
    setBootPhase(3)
    setDisplayValues({ power: 200, stability: 50, ringSpeed: 0.5 })
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Power ramp...')
    setBootPhase(4)
    setDisplayValues({ power: 500, stability: 75, ringSpeed: 0.8 })
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Stabilizing...')
    setBootPhase(5)
    await new Promise(r => setTimeout(r, 400))

    setDisplayValues({ power: powerOutput, stability: stability, ringSpeed: 1 })
    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage(`${stability}% STABLE`)
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return displayValues.stability > 80 ? 'green' : 'amber'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)
  const coreActive = deviceState === 'online' || deviceState === 'testing' || (deviceState === 'booting' && bootPhase >= 2)

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      {/* Header with nano LED buttons */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <LED on={isLedOn} color={getLedColor()} size="sm" />
          <div className="font-mono text-[9px] text-[var(--neon-cyan)]">
            MICROFUSION REACTOR
          </div>
        </div>

        {/* Micro nano LED buttons - hexagonal style */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div className={cn(
              'w-2.5 h-2.5 transition-all',
              'bg-[#0a0a0f] border border-[var(--neon-cyan)]/30',
              'clip-path-hexagon',
              'flex items-center justify-center',
              'group-hover:border-[var(--neon-cyan)]/60'
            )}
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            >
              <div className={cn(
                'w-1 h-1 rounded-full transition-all',
                deviceState === 'testing'
                  ? 'bg-[var(--neon-cyan)] shadow-[0_0_4px_var(--neon-cyan)]'
                  : testResult === 'pass'
                  ? 'bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]'
                  : testResult === 'fail'
                  ? 'bg-[var(--neon-red)] shadow-[0_0_4px_var(--neon-red)]'
                  : 'bg-white/20'
              )} />
            </div>
          </button>
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div className={cn(
              'w-2.5 h-2.5 transition-all',
              'bg-[#0a0a0f] border border-[var(--neon-amber)]/30',
              'flex items-center justify-center',
              'group-hover:border-[var(--neon-amber)]/60'
            )}
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            >
              <div className={cn(
                'w-1 h-1 rounded-full transition-all',
                deviceState === 'rebooting' || deviceState === 'booting'
                  ? 'bg-[var(--neon-amber)] shadow-[0_0_4px_var(--neon-amber)]'
                  : 'bg-white/20'
              )} />
            </div>
          </button>
          <div className="font-mono text-[6px] text-white/30 ml-0.5">T2</div>
        </div>
      </div>

      {/* Reactor core visualization */}
      <div className={cn(
        'relative h-12 bg-black/40 rounded overflow-hidden flex items-center justify-center',
        deviceState === 'testing' && testPhase === 'containment' && 'ring-1 ring-[var(--neon-cyan)]/50'
      )}>
        {/* Rotating rings */}
        {[1, 2, 3].map((ring) => (
          <div
            key={ring}
            className="absolute rounded-full border transition-all duration-500"
            style={{
              width: `${ring * 25}%`,
              height: `${ring * 50}%`,
              borderColor: coreActive ? 'var(--neon-cyan)' : '#333',
              opacity: coreActive ? (0.3 + ring * 0.15) * displayValues.ringSpeed : 0.1,
              animation: coreActive && displayValues.ringSpeed > 0
                ? `spin ${(3 + ring) / displayValues.ringSpeed}s linear infinite ${ring % 2 === 0 ? 'reverse' : ''}`
                : 'none',
            }}
          />
        ))}
        {/* Core */}
        <div
          className="w-3 h-3 rounded-full transition-all duration-300"
          style={{
            background: coreActive
              ? `radial-gradient(circle, #fff 0%, var(--neon-cyan) 60%, transparent 100%)`
              : '#333',
            boxShadow: coreActive ? `0 0 ${10 + displayValues.ringSpeed * 10}px var(--neon-cyan)` : 'none',
            opacity: deviceState === 'booting' ? 0.5 + bootPhase * 0.1 : 1,
          }}
        />

        {/* Test overlay for plasma phase */}
        {deviceState === 'testing' && testPhase === 'plasma' && (
          <div className="absolute inset-0 bg-[var(--neon-cyan)]/10 animate-pulse" />
        )}
      </div>

      {/* Status bar with values - fixed layout to prevent shifts */}
      <div className="flex items-center font-mono text-[7px] mt-1 pt-1 border-t border-white/5">
        <span className={cn(
          'w-10 shrink-0 transition-colors',
          deviceState === 'booting' && bootPhase < 4 ? 'text-white/30' : 'text-[var(--neon-cyan)]'
        )}>
          {displayValues.power} MW
        </span>
        <span className={cn(
          'flex-1 text-[5px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/30'
        )}>
          {statusMessage}
        </span>
        <span className={cn(
          'w-6 shrink-0 text-right transition-colors',
          displayValues.stability > 80 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-amber)]'
        )}>
          {displayValues.stability}%
        </span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// AI ASSISTANT CORE - Tier 2 Tech automation
// ==================================================
type AIState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type AITestPhase = 'neural' | 'memory' | 'logic' | 'learning' | 'optimization' | 'complete' | null

interface AIAssistantProps {
  taskQueue?: number
  efficiency?: number
  isLearning?: boolean
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function AIAssistant({
  taskQueue = 7,
  efficiency = 156,
  isLearning = true,
  className,
  onTest,
  onReset,
}: AIAssistantProps) {
  const [deviceState, setDeviceState] = useState<AIState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<AITestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [displayValues, setDisplayValues] = useState({ queue: 0, efficiency: 0, nodeActivity: [0, 0, 0, 0, 0] })

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Loading neural core...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Initializing memory banks...')
      setBootPhase(2)
      setDisplayValues({ queue: 0, efficiency: 20, nodeActivity: [0.3, 0, 0, 0, 0] })
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Activating nodes...')
      setBootPhase(3)
      setDisplayValues({ queue: 2, efficiency: 50, nodeActivity: [0.5, 0.4, 0.3, 0, 0] })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Training models...')
      setBootPhase(4)
      setDisplayValues({ queue: 4, efficiency: 80, nodeActivity: [0.7, 0.6, 0.5, 0.4, 0.3] })
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Calibrating efficiency...')
      setBootPhase(5)
      await new Promise(r => setTimeout(r, 300))

      // Final boot
      setDisplayValues({ queue: taskQueue, efficiency: efficiency, nodeActivity: [0.9, 0.8, 0.7, 0.8, 0.9] })
      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage('LEARNING')
    }

    bootSequence()
  }, [])

  // Update values when props change (after boot)
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues(prev => ({ ...prev, queue: taskQueue, efficiency: efficiency }))
    }
  }, [taskQueue, efficiency, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<AITestPhase>[] = ['neural', 'memory', 'logic', 'learning', 'optimization', 'complete']
    const phaseMessages: Record<NonNullable<AITestPhase>, string> = {
      neural: 'Testing neural pathways...',
      memory: 'Verifying memory integrity...',
      logic: 'Checking logic gates...',
      learning: 'Validating learning rate...',
      optimization: 'Benchmarking optimizer...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 380))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('LEARNING')
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Halting processes...')
    setDisplayValues(prev => ({ ...prev, queue: 0, nodeActivity: [0.3, 0.2, 0.1, 0, 0] }))
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Neural shutdown...')
    setDisplayValues({ queue: 0, efficiency: 0, nodeActivity: [0, 0, 0, 0, 0] })
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Core offline')
    await new Promise(r => setTimeout(r, 400))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Loading neural core...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Initializing memory banks...')
    setBootPhase(2)
    setDisplayValues({ queue: 0, efficiency: 20, nodeActivity: [0.3, 0, 0, 0, 0] })
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Activating nodes...')
    setBootPhase(3)
    setDisplayValues({ queue: 2, efficiency: 50, nodeActivity: [0.5, 0.4, 0.3, 0, 0] })
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Training models...')
    setBootPhase(4)
    setDisplayValues({ queue: 4, efficiency: 80, nodeActivity: [0.7, 0.6, 0.5, 0.4, 0.3] })
    await new Promise(r => setTimeout(r, 400))

    setStatusMessage('Calibrating efficiency...')
    setBootPhase(5)
    await new Promise(r => setTimeout(r, 300))

    setDisplayValues({ queue: taskQueue, efficiency: efficiency, nodeActivity: [0.9, 0.8, 0.7, 0.8, 0.9] })
    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage('LEARNING')
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return 'green'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)
  const nodesActive = deviceState === 'online' || deviceState === 'testing' || (deviceState === 'booting' && bootPhase >= 3)

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      {/* Header with worn rubber micro buttons */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <LED on={isLedOn} color={getLedColor()} size="sm" />
          <div className="font-mono text-[9px] text-[var(--neon-green)]">
            AI ASSISTANT CORE
          </div>
        </div>

        {/* Worn rubber micro buttons - rounded soft style with wear marks */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div className={cn(
              'w-2.5 h-2 rounded-sm transition-all',
              'flex items-center justify-center',
              deviceState === 'testing'
                ? 'bg-[#1a3a2a]'
                : 'bg-[#1a1f1a]',
              'border border-[#2a3a2a]/60',
              'group-hover:border-[var(--neon-green)]/40',
              'group-active:scale-95'
            )}
            style={{
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), inset 0 -0.5px 0 rgba(255,255,255,0.05)',
              background: deviceState === 'testing'
                ? 'linear-gradient(180deg, #0d2818 0%, #1a3a2a 40%, #153020 100%)'
                : 'linear-gradient(180deg, #0d120d 0%, #1a1f1a 40%, #151a15 100%)',
            }}
            >
              {/* Worn texture overlay */}
              <div className="absolute inset-0 rounded-sm opacity-30"
                style={{
                  backgroundImage: 'radial-gradient(circle at 30% 70%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                }}
              />
              {/* Nano LED indicator */}
              <div className={cn(
                'w-1 h-1 rounded-full transition-all',
                deviceState === 'testing'
                  ? 'bg-[var(--neon-green)] shadow-[0_0_3px_var(--neon-green)]'
                  : testResult === 'pass'
                  ? 'bg-[var(--neon-green)] shadow-[0_0_3px_var(--neon-green)]'
                  : testResult === 'fail'
                  ? 'bg-[var(--neon-red)] shadow-[0_0_3px_var(--neon-red)]'
                  : 'bg-[#2a3a2a]'
              )} />
            </div>
          </button>
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div className={cn(
              'w-2.5 h-2 rounded-sm transition-all',
              'flex items-center justify-center',
              deviceState === 'rebooting' || deviceState === 'booting'
                ? 'bg-[#3a2a1a]'
                : 'bg-[#1f1a1a]',
              'border border-[#3a2a2a]/60',
              'group-hover:border-[var(--neon-amber)]/40',
              'group-active:scale-95'
            )}
            style={{
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), inset 0 -0.5px 0 rgba(255,255,255,0.05)',
              background: deviceState === 'rebooting' || deviceState === 'booting'
                ? 'linear-gradient(180deg, #281a0d 0%, #3a2a1a 40%, #302015 100%)'
                : 'linear-gradient(180deg, #120d0d 0%, #1f1a1a 40%, #1a1515 100%)',
            }}
            >
              {/* Worn texture overlay */}
              <div className="absolute inset-0 rounded-sm opacity-30"
                style={{
                  backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                }}
              />
              {/* Nano LED indicator */}
              <div className={cn(
                'w-1 h-1 rounded-full transition-all',
                deviceState === 'rebooting' || deviceState === 'booting'
                  ? 'bg-[var(--neon-amber)] shadow-[0_0_3px_var(--neon-amber)]'
                  : 'bg-[#3a2a2a]'
              )} />
            </div>
          </button>
          <div className="font-mono text-[6px] text-white/30 ml-0.5">T2</div>
        </div>
      </div>

      {/* Neural network visualization */}
      <div className={cn(
        'relative h-10 bg-black/40 rounded overflow-hidden',
        deviceState === 'testing' && testPhase === 'neural' && 'ring-1 ring-[var(--neon-green)]/50'
      )}>
        {/* Neural nodes */}
        <div className="absolute inset-0 flex items-center justify-around px-2">
          {[0, 1, 2, 3, 4].map((node) => (
            <div key={node} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all duration-300',
                  nodesActive ? 'bg-[var(--neon-green)]' : 'bg-[#333]',
                  deviceState === 'testing' && testPhase === 'neural' && 'ring-1 ring-[var(--neon-cyan)]'
                )}
                style={{
                  opacity: nodesActive ? 0.4 + displayValues.nodeActivity[node] * 0.6 : 0.2,
                  animation: nodesActive && isLearning ? `pulse ${0.8 + node * 0.1}s ease-in-out infinite` : 'none',
                  boxShadow: nodesActive ? `0 0 ${4 + displayValues.nodeActivity[node] * 4}px var(--neon-green)` : 'none',
                }}
              />
              <div
                className={cn(
                  'w-0.5 h-3 transition-all duration-300',
                  nodesActive ? 'bg-[var(--neon-green)]/30' : 'bg-[#333]/30',
                  deviceState === 'testing' && testPhase === 'logic' && 'bg-[var(--neon-cyan)]/50'
                )}
                style={{ transform: `rotate(${-20 + node * 10}deg)` }}
              />
            </div>
          ))}
        </div>
        {/* Processing indicator */}
        <div className={cn(
          'absolute bottom-1 left-1 right-1 h-0.5 bg-black/50 rounded overflow-hidden',
          deviceState === 'testing' && testPhase === 'memory' && 'ring-1 ring-[var(--neon-cyan)]/50'
        )}>
          <div
            className={cn(
              'h-full transition-all duration-300',
              nodesActive ? 'bg-[var(--neon-green)]' : 'bg-[#333]'
            )}
            style={{
              width: nodesActive ? '60%' : '0%',
              animation: nodesActive && isLearning ? 'loading 1.5s ease-in-out infinite' : 'none',
            }}
          />
        </div>

        {/* Test overlay for learning/optimization phases */}
        {deviceState === 'testing' && (testPhase === 'learning' || testPhase === 'optimization') && (
          <div className="absolute inset-0 bg-[var(--neon-green)]/10 animate-pulse" />
        )}
      </div>

      {/* Status bar with fixed layout */}
      <div className="flex items-center font-mono text-[7px] mt-1">
        <span className={cn(
          'w-12 shrink-0 transition-colors',
          deviceState === 'booting' && bootPhase < 3 ? 'text-white/30' : 'text-white/40'
        )}>
          QUEUE: {displayValues.queue}
        </span>
        <span className={cn(
          'flex-1 text-[5px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/30'
        )}>
          {statusMessage}
        </span>
        <span className={cn(
          'w-12 shrink-0 text-right transition-colors',
          nodesActive ? 'text-[var(--neon-green)]' : 'text-white/30'
        )}>
          {displayValues.efficiency}% EFF
        </span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// EXPLORER DRONE - Tier 2 Tools field unit
// ==================================================
type DroneState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type DroneTestPhase = 'motors' | 'gps' | 'camera' | 'radio' | 'battery' | 'gyro' | 'complete' | null

interface ExplorerDroneProps {
  range?: number
  battery?: number
  isDeployed?: boolean
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function ExplorerDrone({
  range = 2.4,
  battery = 78,
  isDeployed = true,
  className,
  onTest,
  onReset,
}: ExplorerDroneProps) {
  const [deviceState, setDeviceState] = useState<DroneState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<DroneTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [displayValues, setDisplayValues] = useState({ range: 0, battery: 0, radarActive: false })

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Power on...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('IMU calibration...')
      setBootPhase(2)
      setDisplayValues({ range: 0, battery: 20, radarActive: false })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('GPS lock...')
      setBootPhase(3)
      setDisplayValues({ range: 0.5, battery: 40, radarActive: false })
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Motor test...')
      setBootPhase(4)
      setDisplayValues({ range: 1.2, battery: 60, radarActive: true })
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Radio link...')
      setBootPhase(5)
      setDisplayValues({ range: 1.8, battery: 75, radarActive: true })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Flight ready...')
      setBootPhase(6)
      await new Promise(r => setTimeout(r, 300))

      // Final boot
      setDisplayValues({ range: range, battery: battery, radarActive: true })
      setBootPhase(7)
      setDeviceState('online')
      setStatusMessage('DEPLOYED')
    }

    bootSequence()
  }, [])

  // Update values when props change (after boot)
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues(prev => ({ ...prev, range: range, battery: battery }))
    }
  }, [range, battery, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<DroneTestPhase>[] = ['motors', 'gps', 'camera', 'radio', 'battery', 'gyro', 'complete']
    const phaseMessages: Record<NonNullable<DroneTestPhase>, string> = {
      motors: 'Testing rotors...',
      gps: 'Checking GPS fix...',
      camera: 'Camera calibration...',
      radio: 'Radio link test...',
      battery: 'Battery health...',
      gyro: 'Gyroscope check...',
      complete: 'Preflight complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 380))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('DEPLOYED')
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('RTH initiated...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Landing...')
    setDisplayValues(prev => ({ ...prev, radarActive: false }))
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Motors off...')
    setDisplayValues({ range: 0, battery: 0, radarActive: false })
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('System offline')
    await new Promise(r => setTimeout(r, 400))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Power on...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('IMU calibration...')
    setBootPhase(2)
    setDisplayValues({ range: 0, battery: 20, radarActive: false })
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('GPS lock...')
    setBootPhase(3)
    setDisplayValues({ range: 0.5, battery: 40, radarActive: false })
    await new Promise(r => setTimeout(r, 400))

    setStatusMessage('Motor test...')
    setBootPhase(4)
    setDisplayValues({ range: 1.2, battery: 60, radarActive: true })
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Radio link...')
    setBootPhase(5)
    setDisplayValues({ range: 1.8, battery: 75, radarActive: true })
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Flight ready...')
    setBootPhase(6)
    await new Promise(r => setTimeout(r, 300))

    setDisplayValues({ range: range, battery: battery, radarActive: true })
    setBootPhase(7)
    setDeviceState('online')
    setStatusMessage('DEPLOYED')
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return displayValues.battery > 30 ? 'green' : 'amber'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)
  const radarActive = displayValues.radarActive && (deviceState === 'online' || deviceState === 'testing')

  return (
    <PanelFrame variant="military" className={cn('p-2', className)}>
      {/* Header with worn metal micro buttons */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <LED on={isLedOn} color={getLedColor()} size="sm" />
          <div className="font-mono text-[8px] text-[var(--neon-lime,#bfff00)]">
            EXPLORER DRONE
          </div>
        </div>

        {/* Worn metal micro buttons - anodized aluminum style */}
        <div className="flex items-center gap-0.5">
          {/* Mini company logo - DJI style */}
          <div
            className="font-mono text-[3px] text-[#8a9a6a] px-0.5 rounded-[1px] mr-0.5"
            style={{
              background: 'linear-gradient(180deg, #3a4a2a 0%, #2a3a1a 100%)',
              border: '0.5px solid #4a5a3a',
            }}
          >
            DJI
          </div>
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div className={cn(
              'w-2.5 h-[7px] rounded-[1px] transition-all',
              'flex items-center justify-center',
              'group-hover:brightness-110',
              'group-active:scale-95'
            )}
            style={{
              background: 'linear-gradient(180deg, #4a5a3a 0%, #3a4a2a 30%, #2a3a1a 70%, #1a2a0a 100%)',
              boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.15), inset 0 -0.5px 0 rgba(0,0,0,0.4), 0 1px 1px rgba(0,0,0,0.3)',
              border: '0.5px solid #3a4a2a',
            }}
            >
              {/* Scratched metal texture */}
              <div className="absolute inset-0 rounded-[1px] opacity-20"
                style={{
                  backgroundImage: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
                }}
              />
              {/* Status LED */}
              <div className={cn(
                'w-[3px] h-[3px] rounded-full transition-all z-10',
                deviceState === 'testing'
                  ? 'bg-[var(--neon-lime,#bfff00)] shadow-[0_0_2px_var(--neon-lime,#bfff00)]'
                  : testResult === 'pass'
                  ? 'bg-[var(--neon-green)] shadow-[0_0_2px_var(--neon-green)]'
                  : testResult === 'fail'
                  ? 'bg-[var(--neon-red)] shadow-[0_0_2px_var(--neon-red)]'
                  : 'bg-[#1a2a0a]'
              )} />
            </div>
          </button>
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div className={cn(
              'w-2.5 h-[7px] rounded-[1px] transition-all',
              'flex items-center justify-center',
              'group-hover:brightness-110',
              'group-active:scale-95'
            )}
            style={{
              background: 'linear-gradient(180deg, #5a4a3a 0%, #4a3a2a 30%, #3a2a1a 70%, #2a1a0a 100%)',
              boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.15), inset 0 -0.5px 0 rgba(0,0,0,0.4), 0 1px 1px rgba(0,0,0,0.3)',
              border: '0.5px solid #4a3a2a',
            }}
            >
              {/* Scratched metal texture */}
              <div className="absolute inset-0 rounded-[1px] opacity-20"
                style={{
                  backgroundImage: 'linear-gradient(-45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
                }}
              />
              {/* Status LED */}
              <div className={cn(
                'w-[3px] h-[3px] rounded-full transition-all z-10',
                deviceState === 'rebooting' || deviceState === 'booting'
                  ? 'bg-[var(--neon-amber)] shadow-[0_0_2px_var(--neon-amber)]'
                  : 'bg-[#2a1a0a]'
              )} />
            </div>
          </button>
          <div className="font-mono text-[5px] text-white/30">T2</div>
        </div>
      </div>

      {/* Drone radar visualization */}
      <div className={cn(
        'relative h-10 bg-black/40 rounded overflow-hidden',
        deviceState === 'testing' && testPhase === 'gps' && 'ring-1 ring-[var(--neon-lime,#bfff00)]/50'
      )}>
        {/* Radar sweep */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-full h-full transition-opacity duration-300"
            style={{
              background: radarActive
                ? 'conic-gradient(from 0deg, transparent 0deg, var(--neon-lime, #bfff00) 30deg, transparent 60deg)'
                : 'none',
              opacity: radarActive ? 0.3 : 0,
              animation: radarActive ? 'spin 2s linear infinite' : 'none',
            }}
          />
        </div>
        {/* Grid lines */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={cn(
            'w-8 h-8 rounded-full border transition-colors duration-300',
            radarActive ? 'border-white/10' : 'border-white/5'
          )} />
          <div className={cn(
            'absolute w-4 h-4 rounded-full border transition-colors duration-300',
            radarActive ? 'border-white/10' : 'border-white/5'
          )} />
        </div>
        {/* Drone blip */}
        {radarActive && (
          <div
            className={cn(
              'absolute w-1.5 h-1.5 rounded-full bg-[var(--neon-lime,#bfff00)]',
              deviceState === 'testing' && testPhase === 'camera' && 'ring-2 ring-[var(--neon-cyan)]/50'
            )}
            style={{
              top: '30%',
              left: '60%',
              boxShadow: '0 0 6px var(--neon-lime, #bfff00)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        )}

        {/* Test overlay for motors phase */}
        {deviceState === 'testing' && testPhase === 'motors' && (
          <div className="absolute inset-0 bg-[var(--neon-lime,#bfff00)]/10 animate-pulse" />
        )}
      </div>

      {/* Status bar with fixed layout */}
      <div className="flex items-center font-mono text-[7px] mt-1">
        <span className={cn(
          'w-8 shrink-0 transition-colors',
          radarActive ? 'text-[var(--neon-lime,#bfff00)]' : 'text-white/30'
        )}>
          {displayValues.range.toFixed(1)} km
        </span>
        <span className={cn(
          'flex-1 text-[5px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/30'
        )}>
          {statusMessage}
        </span>
        <span className={cn(
          'w-10 shrink-0 text-right transition-colors',
          displayValues.battery > 30 ? 'text-white/40' : 'text-[var(--neon-amber)]'
        )}>
          BAT: {displayValues.battery}%
        </span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// ANOMALY DETECTOR - Tier 2 Gadget scanner
// Device ID: AND-001 | Version: 2.3.0
// Compatible: QSM-001, DIM-001, EMC-001, QAN-001
// unOS Commands: DEVICE ANOMALY [TEST|RESET|STATUS]
// ==================================================
type AnomalyState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type AnomalyTestPhase = 'sensors' | 'calibrate' | 'sweep' | 'analyze' | 'verify' | 'complete' | null

interface AnomalyDetectorProps {
  signalStrength?: number
  anomaliesFound?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function AnomalyDetector({
  signalStrength = 67,
  anomaliesFound = 3,
  className,
  onTest,
  onReset,
}: AnomalyDetectorProps) {
  const [deviceState, setDeviceState] = useState<AnomalyState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<AnomalyTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displaySignal, setDisplaySignal] = useState(0)
  const [displayAnomalies, setDisplayAnomalies] = useState(0)
  const [waveOffset, setWaveOffset] = useState(0)

  // Animate waveform
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      setWaveOffset(prev => (prev + 1) % 100)
      if (deviceState === 'online') {
        // Slight signal fluctuation
        setDisplaySignal(prev => {
          const target = signalStrength
          return prev + (target - prev) * 0.1 + (Math.random() - 0.5) * 5
        })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [deviceState, signalStrength])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Sensor init...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Calibrating...')
      setBootPhase(2)
      setDisplaySignal(20)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Freq sweep...')
      setBootPhase(3)
      setDisplaySignal(40)
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Scanning...')
      setBootPhase(4)
      setDisplaySignal(signalStrength)
      setDisplayAnomalies(1)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Analysis...')
      setBootPhase(5)
      setDisplayAnomalies(anomaliesFound)
      await new Promise(r => setTimeout(r, 300))

      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage('SCANNING')
    }
    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayAnomalies(anomaliesFound)
    }
  }, [anomaliesFound, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<AnomalyTestPhase>[] = ['sensors', 'calibrate', 'sweep', 'analyze', 'verify', 'complete']
    const msgs: Record<NonNullable<AnomalyTestPhase>, string> = {
      sensors: 'Testing sensors...',
      calibrate: 'Calibration...',
      sweep: 'Full sweep...',
      analyze: 'Deep analysis...',
      verify: 'Verifying...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      if (phase === 'sweep') {
        setDisplaySignal(95)
        await new Promise(r => setTimeout(r, 500))
      } else {
        await new Promise(r => setTimeout(r, 350))
      }
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setDisplaySignal(signalStrength)
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('SCANNING')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutdown...')
    setDisplaySignal(0)
    setDisplayAnomalies(0)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 350))

    // Boot
    setDeviceState('booting')
    setStatusMessage('Sensor init...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Calibrating...')
    setBootPhase(2)
    setDisplaySignal(30)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Scanning...')
    setBootPhase(4)
    setDisplaySignal(signalStrength)
    setDisplayAnomalies(anomaliesFound)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage('SCANNING')
    onReset?.()
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'

  return (
    <PanelFrame variant="teal" className={cn('p-1.5', className)}>
      {/* Header with logo */}
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[8px] text-[var(--neon-magenta,#e91e8c)]">
          ANOMALY DETECTOR
        </div>
        <div className="flex items-center gap-1">
          {/* HALO logo (Halo Plane reference) */}
          <div
            className="font-mono text-[3px] text-[#ff66cc] px-0.5 leading-none"
            style={{
              background: 'linear-gradient(180deg, #3a1a2a 0%, #2a0a1a 100%)',
              border: '0.5px solid #4a2a3a',
              borderRadius: '1px',
            }}
          >
            HALO
          </div>
          <div className="font-mono text-[6px] text-white/30">T2</div>
        </div>
      </div>

      {/* Signal visualization */}
      <div className={cn(
        'relative h-10 bg-black/40 rounded overflow-hidden',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-magenta,#e91e8c)]/30'
      )}>
        {/* Waveform */}
        <div className="absolute inset-0 flex items-center justify-center">
          {Array.from({ length: 24 }).map((_, i) => {
            const waveHeight = isActive
              ? 15 + Math.sin((i + waveOffset) * 0.4) * (displaySignal * 0.4) + Math.random() * 5
              : 5
            return (
              <div
                key={i}
                className="flex-1 mx-px rounded-sm transition-all duration-100"
                style={{
                  height: `${Math.max(5, Math.min(90, waveHeight))}%`,
                  background: deviceState === 'testing'
                    ? 'var(--neon-cyan)'
                    : 'var(--neon-magenta,#e91e8c)',
                  opacity: isActive ? 0.7 : 0.2,
                }}
              />
            )
          })}
        </div>

        {/* Anomaly markers */}
        {isActive && Array.from({ length: displayAnomalies }).map((_, i) => (
          <div
            key={i}
            className="absolute top-1 w-1.5 h-1.5 rounded-full"
            style={{
              left: `${15 + i * 28}%`,
              background: 'var(--neon-red)',
              boxShadow: '0 0 6px var(--neon-red), 0 0 12px var(--neon-red)',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          />
        ))}

        {/* Scan line */}
        {isActive && (
          <div
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: `${(waveOffset * 1.5) % 100}%`,
              background: 'var(--neon-magenta,#e91e8c)',
              boxShadow: '0 0 4px var(--neon-magenta,#e91e8c)',
              opacity: 0.8,
            }}
          />
        )}

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="font-mono text-[6px] text-[var(--neon-magenta,#e91e8c)] animate-pulse">
              {statusMessage}
            </span>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between font-mono text-[6px] mt-1">
        <span className="text-[var(--neon-magenta,#e91e8c)]">
          SIG: {isActive ? Math.round(displaySignal) : '--'}%
        </span>

        {/* LED buttons - bottom center */}
        <div className="flex items-center gap-1">
          {/* Worn round test LED with magenta glow */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #3a2a3a 0%, #2a1a2a 30%, #1a0a1a 70%, #0a000a 100%)',
                boxShadow: 'inset 0 -1px 2px rgba(255,100,200,0.1), inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.6)',
                border: '1px solid #4a3a4a',
              }}
            >
              <div
                className="w-full h-full rounded-full transition-all"
                style={{
                  background: deviceState === 'testing'
                    ? 'radial-gradient(circle at 30% 30%, #ff88cc 0%, var(--neon-magenta,#e91e8c) 50%, #660033 100%)'
                    : testResult === 'pass'
                    ? 'radial-gradient(circle at 30% 30%, #88ff88 0%, var(--neon-green) 50%, #006600 100%)'
                    : 'radial-gradient(circle at 30% 30%, #3a2a3a 0%, #2a1a2a 50%, #1a0a1a 100%)',
                  boxShadow: deviceState === 'testing'
                    ? '0 0 8px var(--neon-magenta,#e91e8c), 0 0 16px var(--neon-magenta,#e91e8c)'
                    : testResult === 'pass'
                    ? '0 0 8px var(--neon-green), 0 0 16px var(--neon-green)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              />
            </div>
          </button>

          {/* Worn round reset LED with red glow */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #3a2a2a 0%, #2a1a1a 30%, #1a0a0a 70%, #0a0000 100%)',
                boxShadow: 'inset 0 -1px 2px rgba(255,100,100,0.1), inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.6)',
                border: '1px solid #4a3a3a',
              }}
            >
              <div
                className="w-full h-full rounded-full transition-all"
                style={{
                  background: (deviceState === 'rebooting' || deviceState === 'booting')
                    ? 'radial-gradient(circle at 30% 30%, #ff8888 0%, var(--neon-red) 50%, #660000 100%)'
                    : 'radial-gradient(circle at 30% 30%, #3a2a2a 0%, #2a1a1a 50%, #1a0a0a 100%)',
                  boxShadow: (deviceState === 'rebooting' || deviceState === 'booting')
                    ? '0 0 8px var(--neon-red), 0 0 16px var(--neon-red)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              />
            </div>
          </button>
        </div>

        <span className={cn(
          'transition-colors',
          displayAnomalies > 0 ? 'text-[var(--neon-red)]' : 'text-white/40'
        )}>
          {isActive ? displayAnomalies : '-'} DETECTED
        </span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// TELEPORT PAD - Tier 2 Gadget transport
// Device ID: TLP-001 | Version: 2.2.0
// Compatible: UEC-001, MFR-001, DIM-001, QSM-001
// unOS Commands: DEVICE TELEPORT [TEST|RESET|STATUS]
// ==================================================
type TeleportState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type TeleportTestPhase = 'capacitor' | 'matrix' | 'quantum-lock' | 'coordinates' | 'stabilize' | 'complete' | null

interface TeleportPadProps {
  chargeLevel?: number
  lastDestination?: string
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function TeleportPad({
  chargeLevel = 65,
  lastDestination = 'LAB-Ω',
  className,
  onTest,
  onReset,
}: TeleportPadProps) {
  const [deviceState, setDeviceState] = useState<TeleportState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<TeleportTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayCharge, setDisplayCharge] = useState(0)
  const [ringPulse, setRingPulse] = useState(0)

  // Animate portal rings
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      setRingPulse(prev => (prev + 1) % 100)
    }, 50)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Capacitor charge...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Matrix align...')
      setBootPhase(2)
      setDisplayCharge(20)
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Quantum lock...')
      setBootPhase(3)
      setDisplayCharge(45)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Loading coords...')
      setBootPhase(4)
      setDisplayCharge(70)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Stabilizing...')
      setBootPhase(5)
      setDisplayCharge(chargeLevel)
      await new Promise(r => setTimeout(r, 300))

      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage('READY')
    }
    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayCharge(chargeLevel)
    }
  }, [chargeLevel, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<TeleportTestPhase>[] = ['capacitor', 'matrix', 'quantum-lock', 'coordinates', 'stabilize', 'complete']
    const msgs: Record<NonNullable<TeleportTestPhase>, string> = {
      capacitor: 'Capacitor test...',
      matrix: 'Matrix verify...',
      'quantum-lock': 'Quantum lock...',
      coordinates: 'Coord check...',
      stabilize: 'Stabilizing...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      if (phase === 'quantum-lock') {
        setDisplayCharge(100)
        await new Promise(r => setTimeout(r, 500))
      } else {
        await new Promise(r => setTimeout(r, 350))
      }
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setDisplayCharge(chargeLevel)
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('READY')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Discharge...')
    setDisplayCharge(0)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Reset matrix...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 400))

    // Boot
    setDeviceState('booting')
    setStatusMessage('Capacitor charge...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Quantum lock...')
    setBootPhase(3)
    setDisplayCharge(50)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Stabilizing...')
    setBootPhase(5)
    setDisplayCharge(chargeLevel)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage('READY')
    onReset?.()
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const portalIntensity = deviceState === 'testing' ? 1 : displayCharge / 100

  return (
    <PanelFrame variant="default" className={cn('p-1.5', className)}>
      {/* Header with logo */}
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[8px] text-[var(--neon-blue)]">
          TELEPORT PAD
        </div>
        <div className="flex items-center gap-1">
          {/* WARP logo */}
          <div
            className="font-mono text-[3px] text-[#66aaff] px-0.5 leading-none"
            style={{
              background: 'linear-gradient(180deg, #1a2a4a 0%, #0a1a3a 100%)',
              border: '0.5px solid #2a3a5a',
              borderRadius: '1px',
            }}
          >
            WARP
          </div>
          <div className="font-mono text-[6px] text-white/30">T2</div>
        </div>
      </div>

      {/* Pad visualization */}
      <div className={cn(
        'relative h-12 bg-black/40 rounded overflow-hidden flex items-center justify-center',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-blue)]/30'
      )}>
        {/* Portal rings */}
        {[1, 2, 3, 4].map((ring) => {
          const pulseOffset = (ringPulse + ring * 25) % 100
          const scale = isActive ? 1 + Math.sin(pulseOffset * 0.063) * 0.1 : 1
          return (
            <div
              key={ring}
              className="absolute rounded-full border transition-all"
              style={{
                width: `${ring * 20}%`,
                height: `${ring * 50}%`,
                borderWidth: ring === 1 ? '2px' : '1px',
                borderColor: isActive ? 'var(--neon-blue)' : '#333',
                opacity: isActive ? (0.15 + ring * 0.12) * portalIntensity : 0.1,
                transform: `scale(${scale})`,
                boxShadow: isActive && ring <= 2 ? `0 0 ${ring * 4}px var(--neon-blue)` : 'none',
              }}
            />
          )
        })}

        {/* Center portal */}
        <div
          className="w-5 h-5 rounded-full transition-all duration-300"
          style={{
            background: isActive
              ? `radial-gradient(circle, rgba(100,200,255,${portalIntensity}) 0%, var(--neon-blue) 30%, transparent 70%)`
              : '#222',
            boxShadow: isActive
              ? `0 0 ${15 * portalIntensity}px var(--neon-blue), 0 0 ${30 * portalIntensity}px var(--neon-blue)`
              : 'none',
          }}
        />

        {/* Destination indicator */}
        <div className="absolute right-1.5 top-1 font-mono text-[6px] text-white/40">
          → {lastDestination}
        </div>

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
            <span className="font-mono text-[6px] text-[var(--neon-blue)] animate-pulse">
              {statusMessage}
            </span>
          </div>
        )}

        {/* Test effect - energy surge */}
        {deviceState === 'testing' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, var(--neon-blue) 0%, transparent 60%)',
              animation: 'teleport-surge 0.5s ease-out infinite',
              opacity: 0.3,
            }}
          />
        )}
      </div>

      {/* Status bar with square nano buttons */}
      <div className="flex items-center justify-between font-mono text-[6px] mt-1">
        {/* Square nano test button - bottom left */}
        <button
          onClick={handleTest}
          disabled={deviceState !== 'online'}
          className="group relative disabled:opacity-30"
          title="Test"
        >
          <div
            className="w-2.5 h-2.5 rounded-sm transition-all group-active:scale-95"
            style={{
              background: deviceState === 'testing'
                ? 'linear-gradient(135deg, #88ccff 0%, var(--neon-blue) 50%, #004488 100%)'
                : testResult === 'pass'
                ? 'linear-gradient(135deg, #88ff88 0%, var(--neon-green) 50%, #004400 100%)'
                : 'linear-gradient(135deg, #3a3a4a 0%, #2a2a3a 50%, #1a1a2a 100%)',
              boxShadow: deviceState === 'testing'
                ? '0 0 6px var(--neon-blue), 0 0 12px var(--neon-blue), inset 0 1px 0 rgba(255,255,255,0.3)'
                : testResult === 'pass'
                ? '0 0 6px var(--neon-green), inset 0 1px 0 rgba(255,255,255,0.3)'
                : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)',
              border: '1px solid #4a4a5a',
            }}
          />
        </button>

        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-[var(--neon-blue)]">
            {isActive ? `${displayCharge}%` : '--%'}
          </span>
          <span className={cn(
            'text-[5px]',
            deviceState === 'testing' ? 'text-[var(--neon-blue)]' :
            testResult === 'pass' ? 'text-[var(--neon-green)]' :
            'text-white/30'
          )}>
            {statusMessage}
          </span>
        </div>

        {/* Square nano reset button - bottom right */}
        <button
          onClick={handleReboot}
          disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
          className="group relative disabled:opacity-30"
          title="Reboot"
        >
          <div
            className="w-2.5 h-2.5 rounded-sm transition-all group-active:scale-95"
            style={{
              background: (deviceState === 'rebooting' || deviceState === 'booting')
                ? 'linear-gradient(135deg, #ffaa88 0%, var(--neon-amber) 50%, #884400 100%)'
                : 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              boxShadow: (deviceState === 'rebooting' || deviceState === 'booting')
                ? '0 0 6px var(--neon-amber), 0 0 12px var(--neon-amber), inset 0 1px 0 rgba(255,255,255,0.3)'
                : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)',
              border: '1px solid #4a4a4a',
            }}
          />
        </button>
      </div>

      <style jsx global>{`
        @keyframes teleport-surge {
          0% { transform: scale(0.5); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// PRECISION LASER CUTTER - Tier 2 Tools fabrication
// ==================================================
type LaserState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type LaserTestPhase = 'alignment' | 'power' | 'calibration' | 'focus' | 'complete' | null

interface LaserCutterProps {
  power?: number
  precision?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function LaserCutter({
  power = 450,
  precision = 0.01,
  className,
  onTest,
  onReset,
}: LaserCutterProps) {
  const [deviceState, setDeviceState] = useState<LaserState>('booting')
  const [testPhase, setTestPhase] = useState<LaserTestPhase>(null)
  const [bootStatus, setBootStatus] = useState('INITIALIZING...')
  const [laserPosition, setLaserPosition] = useState(50)
  const [currentPower, setCurrentPower] = useState(0)

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setBootStatus('INITIALIZING...')
      await new Promise(r => setTimeout(r, 300))
      setBootStatus('LOADING FIRMWARE...')
      await new Promise(r => setTimeout(r, 400))
      setBootStatus('OPTICS CHECK...')
      await new Promise(r => setTimeout(r, 350))
      setBootStatus('LASER INIT...')
      setCurrentPower(100)
      await new Promise(r => setTimeout(r, 300))
      setCurrentPower(250)
      await new Promise(r => setTimeout(r, 200))
      setCurrentPower(power)
      setBootStatus('CALIBRATING...')
      await new Promise(r => setTimeout(r, 400))
      setBootStatus('READY')
      setDeviceState('online')
    }
    if (deviceState === 'booting') {
      bootSequence()
    }
  }, [deviceState, power])

  // Laser animation when online
  useEffect(() => {
    if (deviceState !== 'online' && deviceState !== 'testing') return
    const interval = setInterval(() => {
      setLaserPosition(prev => {
        const delta = (Math.random() - 0.5) * 8
        return Math.min(90, Math.max(10, prev + delta))
      })
    }, 100)
    return () => clearInterval(interval)
  }, [deviceState])

  // Test sequence
  const handleTest = () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    onTest?.()

    const runTest = async () => {
      setTestPhase('alignment')
      for (let i = 0; i < 5; i++) {
        setLaserPosition(20 + i * 15)
        await new Promise(r => setTimeout(r, 200))
      }
      setTestPhase('power')
      setCurrentPower(100)
      await new Promise(r => setTimeout(r, 300))
      setCurrentPower(250)
      await new Promise(r => setTimeout(r, 300))
      setCurrentPower(450)
      await new Promise(r => setTimeout(r, 300))
      setCurrentPower(power)
      setTestPhase('calibration')
      await new Promise(r => setTimeout(r, 500))
      setTestPhase('focus')
      setLaserPosition(50)
      await new Promise(r => setTimeout(r, 400))
      setTestPhase('complete')
      await new Promise(r => setTimeout(r, 300))
      setTestPhase(null)
      setDeviceState('online')
    }
    runTest()
  }

  // Reboot sequence
  const handleReboot = () => {
    onReset?.()
    setDeviceState('rebooting')
    setTestPhase(null)
    setCurrentPower(0)

    setTimeout(() => {
      setBootStatus('SHUTDOWN...')
    }, 100)
    setTimeout(() => {
      setBootStatus('POWER OFF')
    }, 400)
    setTimeout(() => {
      setDeviceState('booting')
    }, 800)
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const isTesting = deviceState === 'testing'

  // Company logo position (random on mount)
  const [logoPosition] = useState(() => {
    const positions = ['top-right', 'bottom-right', 'top-left'] as const
    return positions[Math.floor(Math.random() * positions.length)]
  })

  const logoPositionClass = {
    'top-right': 'top-0.5 right-0.5',
    'bottom-right': 'bottom-0.5 right-0.5',
    'top-left': 'top-0.5 left-8',
  }[logoPosition]

  return (
    <PanelFrame variant="default" className={cn('p-2 flex', className)}>
      {/* Left side - Square nano buttons */}
      <div className="flex flex-col gap-1.5 mr-2 justify-center shrink-0">
        {/* Test button - lightly illuminated nano */}
        <button
          onClick={handleTest}
          disabled={deviceState !== 'online'}
          className={cn(
            'w-3 h-3 rounded-[2px] border transition-all duration-200',
            'flex items-center justify-center',
            deviceState === 'online'
              ? 'border-[var(--neon-red)]/50 bg-[var(--neon-red)]/10 hover:bg-[var(--neon-red)]/30 cursor-pointer'
              : 'border-white/10 bg-black/30 cursor-not-allowed opacity-50'
          )}
          style={{
            boxShadow: deviceState === 'online'
              ? '0 0 4px rgba(255,100,100,0.3), inset 0 0 2px rgba(255,100,100,0.2)'
              : 'none',
          }}
          title="TEST"
        >
          <div
            className="w-1 h-1 rounded-[1px]"
            style={{
              background: isTesting ? 'var(--neon-red)' : (deviceState === 'online' ? 'rgba(255,100,100,0.5)' : '#333'),
              boxShadow: isTesting ? '0 0 4px var(--neon-red)' : 'none',
            }}
          />
        </button>

        {/* Reset button - lightly illuminated nano */}
        <button
          onClick={handleReboot}
          disabled={deviceState === 'booting' || deviceState === 'rebooting'}
          className={cn(
            'w-3 h-3 rounded-[2px] border transition-all duration-200',
            'flex items-center justify-center',
            deviceState !== 'booting' && deviceState !== 'rebooting'
              ? 'border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/30 cursor-pointer'
              : 'border-white/10 bg-black/30 cursor-not-allowed opacity-50'
          )}
          style={{
            boxShadow: deviceState !== 'booting' && deviceState !== 'rebooting'
              ? '0 0 4px rgba(255,180,100,0.3), inset 0 0 2px rgba(255,180,100,0.2)'
              : 'none',
          }}
          title="RESET"
        >
          <div
            className="w-1 h-1 rounded-[1px]"
            style={{
              background: deviceState === 'rebooting' ? 'var(--neon-amber)' : (deviceState !== 'booting' ? 'rgba(255,180,100,0.5)' : '#333'),
              boxShadow: deviceState === 'rebooting' ? '0 0 4px var(--neon-amber)' : 'none',
            }}
          />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="font-mono text-[9px] text-[var(--neon-red)]">
            PRECISION LASER
          </div>
          <div className="flex items-center gap-1">
            <div className="font-mono text-[7px] text-white/30">T2</div>
            <LED
              on={isActive}
              color="red"
              size="sm"
              className={isTesting ? 'animate-pulse' : ''}
            />
          </div>
        </div>

        {/* Laser beam visualization */}
        <div className="relative flex-1 min-h-[2rem] bg-black/40 rounded overflow-hidden">
          {/* Company logo */}
          <div
            className={cn(
              'absolute font-mono text-[5px] font-bold z-10',
              logoPositionClass
            )}
            style={{
              color: 'rgba(255,100,100,0.4)',
              textShadow: '0 0 2px rgba(255,100,100,0.3)',
            }}
          >
            OPTX
          </div>

          {/* Target grid */}
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-px opacity-20">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border border-white/20" />
            ))}
          </div>

          {/* Status display when booting/rebooting */}
          {(deviceState === 'booting' || deviceState === 'rebooting') && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-mono text-[7px] animate-pulse"
                style={{ color: 'var(--neon-red)' }}
              >
                {bootStatus}
              </span>
            </div>
          )}

          {/* Test phase indicator */}
          {testPhase && testPhase !== 'complete' && (
            <div className="absolute top-0.5 left-0.5 font-mono text-[6px] text-[var(--neon-red)] bg-black/60 px-0.5 rounded">
              {testPhase.toUpperCase()}
            </div>
          )}

          {/* Laser beam */}
          {isActive && (
            <div
              className="absolute top-0 w-0.5 bg-[var(--neon-red)]"
              style={{
                left: `${laserPosition}%`,
                height: '100%',
                boxShadow: '0 0 8px var(--neon-red), 0 0 16px var(--neon-red)',
                opacity: isTesting ? 1 : 0.9,
                transition: isTesting ? 'left 0.2s ease-out' : 'left 0.1s ease-out',
              }}
            />
          )}

          {/* Focus point */}
          <div
            className="absolute bottom-1.5 -translate-x-1/2 w-2 h-2 rounded-full transition-all duration-200"
            style={{
              left: `${laserPosition}%`,
              background: isActive ? 'var(--neon-red)' : '#333',
              boxShadow: isActive ? '0 0 10px var(--neon-red), 0 0 20px var(--neon-red)' : 'none',
            }}
          />

          {/* Scan line effect during testing */}
          {isTesting && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent 0%, rgba(255,100,100,0.1) 50%, transparent 100%)',
                animation: 'scan-line 1s linear infinite',
              }}
            />
          )}
        </div>

        <div className="flex justify-between font-mono text-[7px] mt-1">
          <span className="text-[var(--neon-red)]">{currentPower}W</span>
          <span className="text-white/40">±{precision}mm</span>
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// 3D PRINTER - Tier 2 Tools fabrication
// ==================================================
type PrinterState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type PrinterTestPhase = 'bed' | 'nozzle' | 'extrusion' | 'layer' | 'complete' | null

interface Printer3DProps {
  progress?: number
  layerCount?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function Printer3D({
  progress = 67,
  layerCount = 234,
  className,
  onTest,
  onReset,
}: Printer3DProps) {
  const [deviceState, setDeviceState] = useState<PrinterState>('booting')
  const [testPhase, setTestPhase] = useState<PrinterTestPhase>(null)
  const [bootStatus, setBootStatus] = useState('INITIALIZING...')
  const [currentProgress, setCurrentProgress] = useState(0)
  const [currentLayer, setCurrentLayer] = useState(0)
  const [headPosition, setHeadPosition] = useState(50)
  const [bedTemp, setBedTemp] = useState(0)

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setBootStatus('INITIALIZING...')
      await new Promise(r => setTimeout(r, 300))
      setBootStatus('FIRMWARE v3.2.1')
      await new Promise(r => setTimeout(r, 350))
      setBootStatus('HEATING BED...')
      setBedTemp(25)
      await new Promise(r => setTimeout(r, 200))
      setBedTemp(45)
      await new Promise(r => setTimeout(r, 200))
      setBedTemp(60)
      await new Promise(r => setTimeout(r, 150))
      setBootStatus('HOMING AXES...')
      setHeadPosition(0)
      await new Promise(r => setTimeout(r, 200))
      setHeadPosition(100)
      await new Promise(r => setTimeout(r, 200))
      setHeadPosition(50)
      setBootStatus('CALIBRATING...')
      await new Promise(r => setTimeout(r, 400))
      setBootStatus('READY')
      setCurrentProgress(progress)
      setCurrentLayer(layerCount)
      setDeviceState('online')
    }
    if (deviceState === 'booting') {
      bootSequence()
    }
  }, [deviceState, progress, layerCount])

  // Print head animation when online
  useEffect(() => {
    if (deviceState !== 'online') return
    const interval = setInterval(() => {
      setHeadPosition(prev => {
        const delta = (Math.random() - 0.5) * 6
        return Math.min(95, Math.max(5, prev + delta))
      })
    }, 150)
    return () => clearInterval(interval)
  }, [deviceState])

  // Test sequence
  const handleTest = () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    onTest?.()

    const runTest = async () => {
      setTestPhase('bed')
      setBedTemp(40)
      await new Promise(r => setTimeout(r, 300))
      setBedTemp(55)
      await new Promise(r => setTimeout(r, 300))
      setBedTemp(60)
      setTestPhase('nozzle')
      setHeadPosition(10)
      await new Promise(r => setTimeout(r, 250))
      setHeadPosition(90)
      await new Promise(r => setTimeout(r, 250))
      setHeadPosition(50)
      setTestPhase('extrusion')
      await new Promise(r => setTimeout(r, 400))
      setTestPhase('layer')
      for (let i = 0; i <= 100; i += 20) {
        setCurrentProgress(i)
        await new Promise(r => setTimeout(r, 150))
      }
      setCurrentProgress(progress)
      setTestPhase('complete')
      await new Promise(r => setTimeout(r, 300))
      setTestPhase(null)
      setDeviceState('online')
    }
    runTest()
  }

  // Reboot sequence
  const handleReboot = () => {
    onReset?.()
    setDeviceState('rebooting')
    setTestPhase(null)
    setCurrentProgress(0)
    setCurrentLayer(0)
    setBedTemp(0)

    setTimeout(() => {
      setBootStatus('COOLING...')
    }, 100)
    setTimeout(() => {
      setBootStatus('SHUTDOWN')
    }, 400)
    setTimeout(() => {
      setDeviceState('booting')
    }, 800)
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const isTesting = deviceState === 'testing'

  // Company logo position (random on mount)
  const [logoPosition] = useState(() => {
    const positions = ['top-left', 'top-right', 'bottom-left'] as const
    return positions[Math.floor(Math.random() * positions.length)]
  })

  const logoPositionClass = {
    'top-left': 'top-0.5 left-0.5',
    'top-right': 'top-0.5 right-0.5',
    'bottom-left': 'bottom-0.5 left-0.5',
  }[logoPosition]

  return (
    <PanelFrame variant="military" className={cn('p-2 flex', className)}>
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="font-mono text-[9px] text-[var(--neon-amber)]">
            3D FABRICATOR
          </div>
          <div className="flex items-center gap-1">
            <div className="font-mono text-[7px] text-white/30">T2</div>
            <LED
              on={isActive}
              color="amber"
              size="sm"
              className={isTesting ? 'animate-pulse' : ''}
            />
          </div>
        </div>

        {/* Print bed visualization */}
        <div className="relative flex-1 min-h-[2.5rem] bg-black/40 rounded overflow-hidden">
          {/* Company logo */}
          <div
            className={cn(
              'absolute font-mono text-[5px] font-bold z-10',
              logoPositionClass
            )}
            style={{
              color: 'rgba(255,180,100,0.4)',
              textShadow: '0 0 2px rgba(255,180,100,0.3)',
            }}
          >
            PRSA
          </div>

          {/* Status display when booting/rebooting */}
          {(deviceState === 'booting' || deviceState === 'rebooting') && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-mono text-[7px] animate-pulse"
                style={{ color: 'var(--neon-amber)' }}
              >
                {bootStatus}
              </span>
            </div>
          )}

          {/* Test phase indicator */}
          {testPhase && testPhase !== 'complete' && (
            <div className="absolute top-0.5 left-0.5 font-mono text-[6px] text-[var(--neon-amber)] bg-black/60 px-0.5 rounded z-20">
              {testPhase.toUpperCase()}
            </div>
          )}

          {/* Build layers */}
          {isActive && (
            <div
              className="absolute bottom-0 left-2 right-2 bg-[var(--neon-amber)]/30 transition-all duration-300"
              style={{ height: `${currentProgress}%` }}
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
          )}

          {/* Print head */}
          {isActive && (
            <div
              className="absolute h-0.5 bg-[var(--neon-amber)] transition-all"
              style={{
                bottom: `${currentProgress}%`,
                left: `${headPosition - 10}%`,
                width: '20%',
                boxShadow: '0 0 4px var(--neon-amber)',
                transitionDuration: isTesting ? '200ms' : '150ms',
              }}
            />
          )}

          {/* Bed temperature indicator */}
          {isActive && (
            <div
              className="absolute bottom-0.5 right-0.5 font-mono text-[5px]"
              style={{ color: 'rgba(255,180,100,0.6)' }}
            >
              {bedTemp}°C
            </div>
          )}
        </div>

        <div className="flex justify-between font-mono text-[7px] mt-1">
          <span className="text-[var(--neon-amber)]">{currentProgress}%</span>
          <span className="text-white/40">L:{currentLayer}</span>
        </div>
      </div>

      {/* Right side - Square metal knurled buttons at bottom edge */}
      <div className="flex flex-col justify-end ml-1.5 shrink-0 pb-0">
        <div className="flex flex-col gap-1">
          {/* Test button - metal knurled */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className={cn(
              'w-3.5 h-3.5 rounded-[2px] border transition-all duration-200',
              'flex items-center justify-center relative overflow-hidden',
              deviceState === 'online'
                ? 'border-white/30 cursor-pointer hover:border-[var(--neon-amber)]/60'
                : 'border-white/10 cursor-not-allowed opacity-50'
            )}
            style={{
              background: deviceState === 'online'
                ? 'linear-gradient(135deg, #4a4a5a 0%, #2a2a3a 50%, #3a3a4a 100%)'
                : 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
              boxShadow: isTesting
                ? '0 0 4px var(--neon-amber), inset 0 1px 0 rgba(255,255,255,0.1)'
                : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)',
            }}
            title="TEST"
          >
            {/* Knurl pattern - diagonal lines */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent 0px,
                  transparent 1px,
                  rgba(255,255,255,0.1) 1px,
                  rgba(255,255,255,0.1) 2px
                )`,
              }}
            />
            <div
              className="w-1.5 h-1.5 rounded-[1px] relative z-10"
              style={{
                background: isTesting
                  ? 'var(--neon-amber)'
                  : 'linear-gradient(135deg, #5a5a6a 0%, #3a3a4a 100%)',
                boxShadow: isTesting
                  ? '0 0 4px var(--neon-amber)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            />
          </button>

          {/* Reset button - metal knurled */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting'}
            className={cn(
              'w-3.5 h-3.5 rounded-[2px] border transition-all duration-200',
              'flex items-center justify-center relative overflow-hidden',
              deviceState !== 'booting' && deviceState !== 'rebooting'
                ? 'border-white/30 cursor-pointer hover:border-red-500/60'
                : 'border-white/10 cursor-not-allowed opacity-50'
            )}
            style={{
              background: deviceState !== 'booting' && deviceState !== 'rebooting'
                ? 'linear-gradient(135deg, #4a4a5a 0%, #2a2a3a 50%, #3a3a4a 100%)'
                : 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
              boxShadow: deviceState === 'rebooting'
                ? '0 0 4px var(--neon-red), inset 0 1px 0 rgba(255,255,255,0.1)'
                : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)',
            }}
            title="RESET"
          >
            {/* Knurl pattern - diagonal lines */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  -45deg,
                  transparent 0px,
                  transparent 1px,
                  rgba(255,255,255,0.1) 1px,
                  rgba(255,255,255,0.1) 2px
                )`,
              }}
            />
            <div
              className="w-1.5 h-1.5 rounded-[1px] relative z-10"
              style={{
                background: deviceState === 'rebooting'
                  ? 'var(--neon-red)'
                  : 'linear-gradient(135deg, #5a5a6a 0%, #3a3a4a 100%)',
                boxShadow: deviceState === 'rebooting'
                  ? '0 0 4px var(--neon-red)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            />
          </button>
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// EXOTIC MATTER CONTAINMENT - Tier 4 resource
// ==================================================
// EXOTIC MATTER CONTAINMENT - Tier 4+ rare resource storage
// ==================================================
type ExoticState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type ExoticTestPhase = 'containment' | 'field' | 'stability' | 'particles' | 'complete' | null

interface ExoticMatterProps {
  units?: number
  stability?: number
  isContained?: boolean
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function ExoticMatterContainment({
  units = 42,
  stability = 76,
  isContained = true,
  className,
  onTest,
  onReset,
}: ExoticMatterProps) {
  const [deviceState, setDeviceState] = useState<ExoticState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<ExoticTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayValues, setDisplayValues] = useState({ units: 0, stability: 0, contained: false })

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Field gen...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Containment...')
      setBootPhase(2)
      setDisplayValues({ units: 0, stability: 30, contained: false })
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Particle load...')
      setBootPhase(3)
      setDisplayValues({ units: Math.floor(units * 0.5), stability: 50, contained: true })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Stabilizing...')
      setBootPhase(4)
      setDisplayValues({ units: units, stability: 65, contained: true })
      await new Promise(r => setTimeout(r, 400))

      // Final boot
      setDisplayValues({ units: units, stability: stability, contained: isContained })
      setBootPhase(5)
      setDeviceState('online')
      setStatusMessage('CONTAINED')
    }

    bootSequence()
  }, [])

  // Update display when props change
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues({ units: units, stability: stability, contained: isContained })
    }
  }, [units, stability, isContained, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<ExoticTestPhase>[] = ['containment', 'field', 'stability', 'particles', 'complete']
    const phaseMessages: Record<NonNullable<ExoticTestPhase>, string> = {
      containment: 'Testing containment...',
      field: 'Field integrity...',
      stability: 'Stability check...',
      particles: 'Particle scan...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 420))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('CONTAINED')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Field collapse...')
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Particle hold...')
    setDisplayValues(prev => ({ ...prev, contained: false, stability: 40 }))
    await new Promise(r => setTimeout(r, 400))

    setStatusMessage('Standby...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 350))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Field gen...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Containment...')
    setBootPhase(2)
    setDisplayValues({ units: displayValues.units, stability: 30, contained: false })
    await new Promise(r => setTimeout(r, 400))

    setStatusMessage('Particle load...')
    setBootPhase(3)
    setDisplayValues(prev => ({ ...prev, stability: 50, contained: true }))
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Stabilizing...')
    setBootPhase(4)
    setDisplayValues(prev => ({ ...prev, stability: 65 }))
    await new Promise(r => setTimeout(r, 400))

    setDisplayValues({ units: units, stability: stability, contained: isContained })
    setBootPhase(5)
    setDeviceState('online')
    setStatusMessage('CONTAINED')
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return displayValues.stability > 70 ? 'green' : 'amber'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)
  const fieldActive = displayValues.contained && (deviceState === 'online' || deviceState === 'testing')

  return (
    <PanelFrame variant="default" className={cn('p-1', className)}>
      {/* Compact header */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-0.5">
          <LED on={isLedOn} color={getLedColor()} size="sm" className="scale-75" />
          <div className="font-mono text-[5px] text-[var(--neon-pink)]">EXOTIC MATTER</div>
          {/* CERN logo */}
          <div
            className="font-mono text-[3px] text-[#d060d0] px-0.5 leading-none"
            style={{
              background: 'linear-gradient(180deg, #3a2a3a 0%, #2a1a2a 100%)',
              border: '0.5px solid #5a3a5a',
              borderRadius: '1px',
            }}
          >
            CERN
          </div>
        </div>

        {/* Tiny LED buttons */}
        <div className="flex items-center gap-0.5">
          {/* Round LED test button */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div
              className="w-2.5 h-2 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #5a3a5a 0%, #4a2a4a 50%, #3a1a3a 100%)',
                boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.1), 0 0.5px 1px rgba(0,0,0,0.5)',
                border: '0.5px solid #6a4a6a',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-full transition-all',
                  deviceState === 'testing'
                    ? 'bg-[var(--neon-pink)] shadow-[0_0_4px_var(--neon-pink)]'
                    : testResult === 'pass'
                    ? 'bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]'
                    : testResult === 'fail'
                    ? 'bg-[var(--neon-red)] shadow-[0_0_4px_var(--neon-red)]'
                    : 'bg-[#1a0a1a]'
                )}
              />
            </div>
          </button>

          {/* Square LED reset button */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div
              className="w-2.5 h-2 rounded-[1px] p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #4a3a3a 0%, #3a2a2a 50%, #2a1a1a 100%)',
                boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.1), 0 0.5px 1px rgba(0,0,0,0.5)',
                border: '0.5px solid #5a4a4a',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-[0.5px] transition-all',
                  deviceState === 'rebooting' || deviceState === 'booting'
                    ? 'bg-[var(--neon-amber)] shadow-[0_0_4px_var(--neon-amber)]'
                    : 'bg-[#0a0505]'
                )}
              />
            </div>
          </button>
          <div className="font-mono text-[3px] text-white/20">RES-X</div>
        </div>
      </div>

      {/* Tall containment field visualization - 3 rows */}
      <div className={cn(
        'relative h-14 bg-black/60 rounded overflow-hidden',
        deviceState === 'testing' && testPhase === 'containment' && 'ring-1 ring-[var(--neon-pink)]/50'
      )}>
        {/* Containment field border */}
        <div
          className={cn(
            'absolute inset-[2px] rounded border transition-all duration-300',
            deviceState === 'testing' && testPhase === 'field' && 'ring-1 ring-[var(--neon-cyan)]/50'
          )}
          style={{
            borderColor: fieldActive ? 'var(--neon-pink)' : '#333',
            boxShadow: fieldActive ? '0 0 6px var(--neon-pink), inset 0 0 12px rgba(255,0,255,0.15)' : 'none',
            animation: fieldActive ? 'containment-pulse 2s ease-in-out infinite' : 'none',
          }}
        />

        {/* Exotic particles spread across full screen */}
        <div className="absolute inset-[4px]">
          {Array.from({ length: displayValues.units }).map((_, i) => {
            const isTesting = deviceState === 'testing'
            const isBooting = deviceState === 'booting' || deviceState === 'rebooting'

            // Different colors for different states
            const testColors = ['var(--neon-pink)', 'var(--neon-cyan)', 'var(--neon-purple)', '#fff', 'var(--neon-green)']
            const bootColors = ['var(--neon-amber)', 'var(--neon-pink)', '#ff6600', 'var(--neon-amber)']

            const particleColor = isTesting
              ? testColors[i % testColors.length]
              : isBooting
              ? bootColors[i % bootColors.length]
              : fieldActive ? 'var(--neon-pink)' : '#444'

            // Distribute particles in a grid pattern across full area
            const cols = 14
            const rows = 3
            const col = i % cols
            const row = Math.floor(i / cols) % rows
            const xPos = 4 + (col / (cols - 1)) * 92 // 4% to 96%
            const yPos = 15 + (row / (rows - 1 || 1)) * 70 // 15% to 85%

            // Different animations for boot vs test
            let animationName = 'none'
            let animationDuration = '1s'
            let animationTimingFunction = 'ease-in-out'
            let animationDelay = '0s'

            if (isTesting) {
              // Test: chaotic quantum fluctuation
              animationName = 'exotic-test'
              animationDuration = `${0.15 + (i % 6) * 0.08}s`
              animationDelay = `${i * 0.015}s`
            } else if (isBooting) {
              // Boot: materialize from center outward
              animationName = 'exotic-boot'
              animationDuration = `${0.4 + (i % 4) * 0.15}s`
              animationTimingFunction = 'ease-out'
              animationDelay = `${(row * 0.1) + (col * 0.03)}s`
            } else if (fieldActive) {
              // Normal: gentle float
              animationName = 'exotic-float'
              animationDuration = `${1 + (i % 5) * 0.15}s`
              animationDelay = `${i * 0.02}s`
            }

            return (
              <div
                key={i}
                className="absolute w-[5px] h-[5px] rounded-full"
                style={{
                  left: `${xPos}%`,
                  top: `${yPos}%`,
                  background: particleColor,
                  boxShadow: `0 0 ${isTesting ? '8' : isBooting ? '5' : '3'}px ${particleColor}`,
                  animationName,
                  animationDuration,
                  animationTimingFunction,
                  animationIterationCount: 'infinite',
                  animationDelay,
                }}
              />
            )
          })}
        </div>

        {/* Test overlay - quantum interference */}
        {deviceState === 'testing' && (
          <>
            {testPhase === 'stability' && (
              <div className="absolute inset-0 bg-[var(--neon-pink)]/10 animate-pulse" />
            )}
            {/* Vertical scan lines */}
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 2px, var(--neon-cyan) 2px, var(--neon-cyan) 3px)',
                animation: 'exotic-scan 0.3s linear infinite',
              }}
            />
            {/* Radial quantum distortion */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, var(--neon-purple) 0%, transparent 50%)',
                opacity: 0.25,
                animation: 'exotic-quantum 0.4s ease-in-out infinite',
              }}
            />
            {/* Horizontal wave */}
            <div
              className="absolute inset-0 pointer-events-none opacity-15"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 4px, var(--neon-pink) 4px, var(--neon-pink) 5px)',
                animation: 'exotic-wave 0.2s linear infinite',
              }}
            />
          </>
        )}

        {/* Boot/reboot overlay - energy field forming */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <>
            {/* Expanding rings */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at center, transparent 0%, var(--neon-amber) 30%, transparent 50%)',
                opacity: 0.3,
                animation: 'exotic-materialize 0.8s ease-out infinite',
              }}
            />
            {/* Grid forming effect */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: `
                  linear-gradient(var(--neon-amber) 1px, transparent 1px),
                  linear-gradient(90deg, var(--neon-amber) 1px, transparent 1px)
                `,
                backgroundSize: '8px 8px',
                animation: 'exotic-grid 0.6s ease-in-out infinite',
              }}
            />
          </>
        )}
      </div>

      {/* Compact status bar */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        <span className={cn(
          'w-10 shrink-0 transition-colors',
          fieldActive ? 'text-[var(--neon-pink)]' : 'text-white/30'
        )}>
          {displayValues.units} UNITS
        </span>
        <span className={cn(
          'flex-1 text-[4px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
          deviceState === 'testing' ? 'text-[var(--neon-pink)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/20'
        )}>
          {statusMessage}
        </span>
        <span className={cn(
          'w-12 shrink-0 text-right transition-colors',
          displayValues.stability > 70 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-red)]'
        )}>
          {displayValues.stability}% STABLE
        </span>
      </div>

      <style jsx global>{`
        @keyframes containment-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes exotic-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        /* TEST: Chaotic quantum fluctuation - particles jitter wildly */
        @keyframes exotic-test {
          0% { transform: translate(0, 0) scale(1); filter: hue-rotate(0deg); }
          20% { transform: translate(3px, -4px) scale(1.4); filter: hue-rotate(60deg); }
          40% { transform: translate(-4px, 3px) scale(0.6); filter: hue-rotate(120deg); }
          60% { transform: translate(4px, 2px) scale(1.3); filter: hue-rotate(180deg); }
          80% { transform: translate(-2px, -3px) scale(0.8); filter: hue-rotate(240deg); }
          100% { transform: translate(0, 0) scale(1); filter: hue-rotate(360deg); }
        }
        /* BOOT: Particles materialize with pulsing glow */
        @keyframes exotic-boot {
          0% { transform: scale(0); opacity: 0; filter: brightness(3); }
          30% { transform: scale(1.5); opacity: 1; filter: brightness(2); }
          60% { transform: scale(0.8); opacity: 0.7; filter: brightness(1.5); }
          100% { transform: scale(1); opacity: 1; filter: brightness(1); }
        }
        /* Scan line effect */
        @keyframes exotic-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        /* Horizontal wave for test */
        @keyframes exotic-wave {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        /* Quantum distortion pulse */
        @keyframes exotic-quantum {
          0%, 100% { transform: scale(0.5); opacity: 0.1; }
          50% { transform: scale(1.5); opacity: 0.4; }
        }
        /* Materialize rings for boot */
        @keyframes exotic-materialize {
          0% { transform: scale(0.3); opacity: 0.5; }
          50% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        /* Grid formation for boot */
        @keyframes exotic-grid {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// QUANTUM STATE MONITOR - Tech Tier 2 quantum coherence
// ==================================================
type QuantumState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type QuantumTestPhase = 'coherence' | 'entanglement' | 'decoherence' | 'error' | 'complete' | null

interface QuantumStateProps {
  coherence?: number
  qubits?: number
  isEntangled?: boolean
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function QuantumStateMonitor({
  coherence = 94,
  qubits = 127,
  isEntangled = true,
  className,
  onTest,
  onReset,
}: QuantumStateProps) {
  const [deviceState, setDeviceState] = useState<QuantumState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<QuantumTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayValues, setDisplayValues] = useState({ coherence: 0, qubits: 0, entangled: false })
  const [wavePhase, setWavePhase] = useState(0)

  // Animate wave function
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      setWavePhase(p => (p + 0.15) % (Math.PI * 2))
    }, 50)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Cooling qubits...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Calibrating...')
      setBootPhase(2)
      setDisplayValues({ coherence: 30, qubits: Math.floor(qubits * 0.3), entangled: false })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Entangling...')
      setBootPhase(3)
      setDisplayValues({ coherence: 60, qubits: Math.floor(qubits * 0.7), entangled: false })
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Stabilizing...')
      setBootPhase(4)
      setDisplayValues({ coherence: 85, qubits: qubits, entangled: true })
      await new Promise(r => setTimeout(r, 350))

      setDisplayValues({ coherence, qubits, entangled: isEntangled })
      setBootPhase(5)
      setDeviceState('online')
      setStatusMessage('COHERENT')
    }
    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues({ coherence, qubits, entangled: isEntangled })
    }
  }, [coherence, qubits, isEntangled, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<QuantumTestPhase>[] = ['coherence', 'entanglement', 'decoherence', 'error', 'complete']
    const msgs: Record<NonNullable<QuantumTestPhase>, string> = {
      coherence: 'Measuring coherence...',
      entanglement: 'Verifying entanglement...',
      decoherence: 'Decoherence test...',
      error: 'Error correction...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      await new Promise(r => setTimeout(r, 380))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('COHERENT')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Collapsing state...')
    setDisplayValues(prev => ({ ...prev, coherence: 20, entangled: false }))
    await new Promise(r => setTimeout(r, 400))

    setStatusMessage('Re-cooling...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 350))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Cooling qubits...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Calibrating...')
    setBootPhase(2)
    setDisplayValues({ coherence: 40, qubits: Math.floor(qubits * 0.5), entangled: false })
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Entangling...')
    setBootPhase(3)
    setDisplayValues({ coherence: 70, qubits: qubits, entangled: true })
    await new Promise(r => setTimeout(r, 350))

    setDisplayValues({ coherence, qubits, entangled: isEntangled })
    setBootPhase(5)
    setDeviceState('online')
    setStatusMessage('COHERENT')
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    return displayValues.coherence > 80 ? 'cyan' : 'amber'
  }

  const isLedOn = deviceState !== 'offline'
  const isActive = deviceState === 'online' || deviceState === 'testing'

  return (
    <PanelFrame variant="teal" className={cn('p-1', className)}>
      {/* Header with wooden buttons */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-0.5">
          <LED on={isLedOn} color={getLedColor()} size="sm" className="scale-75" />
          <div className="font-mono text-[5px] text-[var(--neon-cyan)]">QUANTUM</div>
          {/* IBM style logo */}
          <div
            className="font-mono text-[3px] text-[#6090c0] px-0.5 leading-none font-bold"
            style={{
              background: 'linear-gradient(180deg, #2a3a4a 0%, #1a2a3a 100%)',
              border: '0.5px solid #4a5a6a',
              borderRadius: '1px',
            }}
          >
            IBM
          </div>
        </div>

        {/* Worn wooden buttons */}
        <div className="flex items-center gap-0.5">
          {/* Round wooden test button */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #8b6914 0%, #5a4510 50%, #3a2a08 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,220,150,0.3), inset 0 -1px 2px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
                border: '0.5px solid #2a1a00',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-full flex items-center justify-center',
                  deviceState === 'testing' && 'shadow-[0_0_4px_var(--neon-cyan)]'
                )}
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #a07820 0%, #6a4a12 60%, #4a3008 100%)',
                }}
              >
                <span className="font-mono text-[3px] text-[#2a1a00] font-bold">T</span>
              </div>
            </div>
          </button>

          {/* Square wooden reset button */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div
              className="w-2.5 h-2.5 rounded-[2px] p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #6a4a20 0%, #4a3010 50%, #2a1a05 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,200,100,0.2), inset 0 -1px 2px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
                border: '0.5px solid #1a0a00',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-[1px] flex items-center justify-center',
                  (deviceState === 'rebooting' || deviceState === 'booting') && 'shadow-[0_0_4px_var(--neon-amber)]'
                )}
                style={{
                  background: 'linear-gradient(135deg, #7a5a18 0%, #5a3a10 50%, #3a2008 100%)',
                }}
              >
                <span className="font-mono text-[3px] text-[#1a0a00] font-bold">R</span>
              </div>
            </div>
          </button>
          <div className="font-mono text-[3px] text-white/20">QSM-2</div>
        </div>
      </div>

      {/* Quantum state visualization */}
      <div className={cn(
        'relative h-10 bg-black/60 rounded overflow-hidden',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-cyan)]/30'
      )}>
        {/* Wave function display */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Animated wave */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0" />
                <stop offset="50%" stopColor="var(--neon-cyan)" stopOpacity={isActive ? "0.6" : "0.2"} />
                <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M 0 20 ${Array.from({ length: 20 }, (_, i) => {
                const x = (i / 19) * 100
                const y = 20 + Math.sin(wavePhase + i * 0.5) * (isActive ? 8 : 3) * (deviceState === 'testing' ? 1.5 : 1)
                return `L ${x} ${y}`
              }).join(' ')}`}
              stroke="url(#waveGrad)"
              strokeWidth={deviceState === 'testing' ? "2" : "1.5"}
              fill="none"
              style={{
                filter: isActive ? 'drop-shadow(0 0 3px var(--neon-cyan))' : 'none',
              }}
            />
          </svg>

          {/* Psi symbol */}
          <div
            className={cn(
              'relative z-10 font-mono text-[14px] transition-all',
              isActive ? 'text-[var(--neon-cyan)]' : 'text-[var(--neon-cyan)]/30'
            )}
            style={{
              textShadow: isActive ? '0 0 8px var(--neon-cyan)' : 'none',
              animation: deviceState === 'testing' ? 'quantum-pulse 0.3s ease-in-out infinite' : 'none',
            }}
          >
            |ψ⟩
          </div>
        </div>

        {/* Test overlays */}
        {deviceState === 'testing' && (
          <>
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 5px, var(--neon-cyan) 5px, var(--neon-cyan) 6px)',
                animation: 'quantum-scan 0.5s linear infinite',
              }}
            />
          </>
        )}

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, var(--neon-amber) 0%, transparent 60%)',
              opacity: 0.2,
              animation: 'quantum-init 0.6s ease-out infinite',
            }}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        <span className={cn(
          'w-10 shrink-0 transition-colors',
          isActive ? 'text-[var(--neon-cyan)]' : 'text-white/30'
        )}>
          {displayValues.coherence}% COH
        </span>
        <span className={cn(
          'flex-1 text-[4px] text-center whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'booting' || deviceState === 'rebooting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          'text-white/20'
        )}>
          {statusMessage}
        </span>
        <span className={cn(
          'w-10 shrink-0 text-right transition-colors',
          displayValues.entangled ? 'text-[var(--neon-cyan)]' : 'text-white/30'
        )}>
          {displayValues.qubits}Q
        </span>
      </div>

      <style jsx global>{`
        @keyframes quantum-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes quantum-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes quantum-init {
          0% { transform: scale(0.5); opacity: 0.3; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// NETWORK MONITOR - Tech Tier 2/4 network throughput
// ==================================================
type NetworkState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type NetworkTestPhase = 'latency' | 'bandwidth' | 'packet' | 'security' | 'complete' | null

interface NetworkMonitorProps {
  bandwidth?: number
  latency?: number
  isConnected?: boolean
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function NetworkMonitor({
  bandwidth = 2.4,
  latency = 12,
  isConnected = true,
  className,
  onTest,
  onReset,
}: NetworkMonitorProps) {
  const [deviceState, setDeviceState] = useState<NetworkState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<NetworkTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayValues, setDisplayValues] = useState({ bandwidth: 0, latency: 0, connected: false })
  const [bars, setBars] = useState([20, 35, 25, 45, 30, 50, 40, 55, 35, 45])

  // Animate bandwidth bars
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      setBars(prev => prev.map((v, i) => {
        const base = deviceState === 'testing' ? 70 : 50
        const variance = deviceState === 'testing' ? 30 : 40
        return Math.max(15, Math.min(95, base + (Math.random() - 0.5) * variance))
      }))
    }, 200)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Detecting NIC...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('DHCP request...')
      setBootPhase(2)
      setDisplayValues({ bandwidth: 0, latency: 999, connected: false })
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Handshake...')
      setBootPhase(3)
      setDisplayValues({ bandwidth: bandwidth * 0.3, latency: 80, connected: false })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Sync routes...')
      setBootPhase(4)
      setDisplayValues({ bandwidth: bandwidth * 0.7, latency: 30, connected: true })
      await new Promise(r => setTimeout(r, 400))

      setDisplayValues({ bandwidth, latency, connected: isConnected })
      setBootPhase(5)
      setDeviceState('online')
      setStatusMessage('CONNECTED')
    }
    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues({ bandwidth, latency, connected: isConnected })
    }
  }, [bandwidth, latency, isConnected, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<NetworkTestPhase>[] = ['latency', 'bandwidth', 'packet', 'security', 'complete']
    const msgs: Record<NonNullable<NetworkTestPhase>, string> = {
      latency: 'Ping test...',
      bandwidth: 'Bandwidth test...',
      packet: 'Packet integrity...',
      security: 'Security check...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      await new Promise(r => setTimeout(r, 420))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('CONNECTED')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Disconnect...')
    setDisplayValues(prev => ({ ...prev, connected: false, bandwidth: 0 }))
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Reset NIC...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 400))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('Detecting NIC...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('DHCP request...')
    setBootPhase(2)
    setDisplayValues({ bandwidth: 0, latency: 200, connected: false })
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Handshake...')
    setBootPhase(3)
    setDisplayValues({ bandwidth: bandwidth * 0.5, latency: 50, connected: true })
    await new Promise(r => setTimeout(r, 350))

    setDisplayValues({ bandwidth, latency, connected: isConnected })
    setBootPhase(5)
    setDeviceState('online')
    setStatusMessage('CONNECTED')
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    return displayValues.connected ? 'lime' : 'red'
  }

  const isLedOn = deviceState !== 'offline'
  const isActive = deviceState === 'online' || deviceState === 'testing'

  return (
    <PanelFrame variant="military" className={cn('p-1', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-0.5">
          <div className="font-mono text-[5px] text-[var(--neon-lime,#bfff00)]">NETWORK</div>
          {/* Cisco style logo */}
          <div
            className="font-mono text-[3px] text-[#60c0a0] px-0.5 leading-none"
            style={{
              background: 'linear-gradient(180deg, #1a3a2a 0%, #0a2a1a 100%)',
              border: '0.5px solid #3a5a4a',
              borderRadius: '1px',
            }}
          >
            CSCO
          </div>
        </div>
        <div className="font-mono text-[3px] text-white/20">NET-2</div>
      </div>

      {/* Bandwidth visualization - expanded */}
      <div className={cn(
        'relative h-12 bg-black/60 rounded overflow-hidden p-1',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-lime,#bfff00)]/30'
      )}>
        {/* Bandwidth bars */}
        <div className="h-full flex items-end gap-[2px]">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t transition-all duration-200"
              style={{
                height: `${isActive ? h : h * 0.3}%`,
                background: isActive
                  ? `linear-gradient(180deg, var(--neon-lime,#bfff00) 0%, #5a8a00 100%)`
                  : '#333',
                boxShadow: isActive ? '0 0 4px var(--neon-lime,#bfff00)' : 'none',
                opacity: deviceState === 'testing' ? (testPhase === 'bandwidth' ? 1 : 0.7) : 0.8,
              }}
            />
          ))}
        </div>

        {/* Test overlay */}
        {deviceState === 'testing' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, var(--neon-lime,#bfff00) 3px, var(--neon-lime,#bfff00) 4px)',
              animation: 'network-scan 0.4s linear infinite',
            }}
          />
        )}

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <div className="font-mono text-[6px] text-[var(--neon-amber)] animate-pulse">
              {statusMessage}
            </div>
          </div>
        )}
      </div>

      {/* Status bar with LED buttons on left */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        {/* LED buttons - bottom left */}
        <div className="flex items-center gap-0.5">
          {/* Round LED test button with glow */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #2a3a2a 0%, #1a2a1a 50%, #0a1a0a 100%)',
                boxShadow: 'inset 0 1px 0 rgba(100,255,100,0.1), 0 1px 2px rgba(0,0,0,0.5)',
                border: '1px solid #3a4a3a',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-full transition-all',
                  deviceState === 'testing'
                    ? 'bg-[var(--neon-lime,#bfff00)] shadow-[0_0_6px_var(--neon-lime,#bfff00),0_0_12px_var(--neon-lime,#bfff00)]'
                    : testResult === 'pass'
                    ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]'
                    : 'bg-[#1a2a1a]'
                )}
              />
            </div>
          </button>

          {/* Round LED reset button with glow */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #3a2a1a 0%, #2a1a0a 50%, #1a0a00 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,150,50,0.1), 0 1px 2px rgba(0,0,0,0.5)',
                border: '1px solid #4a3a2a',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-full transition-all',
                  (deviceState === 'rebooting' || deviceState === 'booting')
                    ? 'bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber),0_0_12px_var(--neon-amber)]'
                    : 'bg-[#2a1a0a]'
                )}
              />
            </div>
          </button>

          <span className={cn(
            'transition-colors ml-0.5',
            isActive ? 'text-[var(--neon-lime,#bfff00)]' : 'text-white/30'
          )}>
            {displayValues.bandwidth.toFixed(1)} Gbps
          </span>
        </div>

        <span className={cn(
          'text-[4px] transition-colors',
          deviceState === 'testing' ? 'text-[var(--neon-lime,#bfff00)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          'text-white/20'
        )}>
          {deviceState === 'online' || deviceState === 'testing' ? `${displayValues.latency}ms` : statusMessage}
        </span>
      </div>

      <style jsx global>{`
        @keyframes network-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// TEMPERATURE MONITOR - Thermal monitoring system
// ==================================================
type TempState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type TempTestPhase = 'sensors' | 'calibration' | 'threshold' | 'cooling' | 'complete' | null

interface TemperatureMonitorProps {
  temperature?: number
  maxTemp?: number
  minTemp?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function TemperatureMonitor({
  temperature = 28.4,
  maxTemp = 85,
  minTemp = 15,
  className,
  onTest,
  onReset,
}: TemperatureMonitorProps) {
  const [deviceState, setDeviceState] = useState<TempState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<TempTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayTemp, setDisplayTemp] = useState(0)
  const [fluctuation, setFluctuation] = useState(0)

  // Animate temperature fluctuation
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      const variance = deviceState === 'testing' ? 2 : 0.3
      setFluctuation((Math.random() - 0.5) * variance)
    }, 500)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Sensor init...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Probing thermal...')
      setBootPhase(2)
      setDisplayTemp(50)
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Calibrating...')
      setBootPhase(3)
      setDisplayTemp(35)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Reading temps...')
      setBootPhase(4)
      setDisplayTemp(temperature)
      await new Promise(r => setTimeout(r, 300))

      setBootPhase(5)
      setDeviceState('online')
      setStatusMessage('NOMINAL')
    }
    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayTemp(temperature)
    }
  }, [temperature, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<TempTestPhase>[] = ['sensors', 'calibration', 'threshold', 'cooling', 'complete']
    const msgs: Record<NonNullable<TempTestPhase>, string> = {
      sensors: 'Testing sensors...',
      calibration: 'Calibration check...',
      threshold: 'Threshold verify...',
      cooling: 'Cooling system...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      await new Promise(r => setTimeout(r, 400))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('NOMINAL')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutdown...')
    setDisplayTemp(0)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Reset sensors...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 400))

    // Boot
    setDeviceState('booting')
    setStatusMessage('Sensor init...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Probing thermal...')
    setBootPhase(2)
    setDisplayTemp(40)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Calibrating...')
    setBootPhase(3)
    setDisplayTemp(temperature)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase(5)
    setDeviceState('online')
    setStatusMessage('NOMINAL')
    onReset?.()
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const currentTemp = displayTemp + fluctuation
  const tempPercent = ((currentTemp - minTemp) / (maxTemp - minTemp)) * 100
  const tempColor = currentTemp < 40 ? 'var(--neon-cyan)' : currentTemp < 60 ? 'var(--neon-green)' : currentTemp < 75 ? 'var(--neon-amber)' : 'var(--neon-red)'

  return (
    <PanelFrame variant="default" className={cn('p-1', className)}>
      {/* Header with company logo */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-0.5">
          <div className="font-mono text-[5px] text-[var(--neon-amber)]">TEMP</div>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Intel style logo */}
          <div
            className="font-mono text-[3px] text-[#0088cc] px-0.5 leading-none"
            style={{
              background: 'linear-gradient(180deg, #1a2a4a 0%, #0a1a3a 100%)',
              border: '0.5px solid #3a4a6a',
              borderRadius: '1px',
            }}
          >
            INTL
          </div>
          <div className="font-mono text-[3px] text-white/20">TMP-1</div>
        </div>
      </div>

      {/* Temperature visualization - expanded */}
      <div className={cn(
        'relative h-10 bg-black/60 rounded overflow-hidden',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-amber)]/30'
      )}>
        {/* Temperature gradient bar */}
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-3 rounded overflow-hidden">
          {/* Background gradient */}
          <div
            className="absolute inset-0 rounded"
            style={{
              background: 'linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-green) 35%, var(--neon-amber) 65%, var(--neon-red) 100%)',
              opacity: isActive ? 0.8 : 0.3,
            }}
          />
          {/* Temperature indicator */}
          {isActive && (
            <div
              className="absolute top-0 bottom-0 w-1 rounded transition-all duration-300"
              style={{
                left: `${Math.max(0, Math.min(100, tempPercent))}%`,
                transform: 'translateX(-50%)',
                background: '#fff',
                boxShadow: `0 0 6px ${tempColor}, 0 0 12px ${tempColor}`,
              }}
            />
          )}
          {/* Grid lines */}
          <div className="absolute inset-0 flex justify-between px-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-px h-full bg-white/20" />
            ))}
          </div>
        </div>

        {/* Temperature labels */}
        <div className="absolute inset-x-2 bottom-0.5 flex justify-between">
          <span className="font-mono text-[4px] text-[var(--neon-cyan)]/60">{minTemp}°</span>
          <span className="font-mono text-[4px] text-[var(--neon-green)]/60">40°</span>
          <span className="font-mono text-[4px] text-[var(--neon-amber)]/60">60°</span>
          <span className="font-mono text-[4px] text-[var(--neon-red)]/60">{maxTemp}°</span>
        </div>

        {/* Test overlay */}
        {deviceState === 'testing' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 4px, var(--neon-amber) 4px, var(--neon-amber) 5px)',
              animation: 'temp-scan 0.5s linear infinite',
            }}
          />
        )}

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="font-mono text-[5px] text-[var(--neon-amber)] animate-pulse">{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Status bar with LED buttons on right */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        <span className={cn(
          'transition-colors',
          isActive ? (currentTemp > 60 ? 'text-[var(--neon-amber)]' : 'text-[var(--neon-green)]') : 'text-white/30'
        )}>
          {isActive ? `${currentTemp.toFixed(1)}°C` : '--.-°C'}
        </span>

        <span className={cn(
          'text-[4px] flex-1 text-center',
          deviceState === 'testing' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          'text-white/20'
        )}>
          {deviceState === 'online' ? statusMessage : ''}
        </span>

        {/* LED buttons - bottom right */}
        <div className="flex items-center gap-0.5">
          {/* Round LED test button with orange glow */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #4a3a2a 0%, #3a2a1a 50%, #2a1a0a 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,200,100,0.15), 0 1px 2px rgba(0,0,0,0.5)',
                border: '1px solid #5a4a3a',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-full transition-all',
                  deviceState === 'testing'
                    ? 'bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber),0_0_12px_var(--neon-amber)]'
                    : testResult === 'pass'
                    ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]'
                    : 'bg-[#2a1a0a]'
                )}
              />
            </div>
          </button>

          {/* Round LED reset button with red glow */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #4a2a2a 0%, #3a1a1a 50%, #2a0a0a 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,100,100,0.15), 0 1px 2px rgba(0,0,0,0.5)',
                border: '1px solid #5a3a3a',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-full transition-all',
                  (deviceState === 'rebooting' || deviceState === 'booting')
                    ? 'bg-[var(--neon-red)] shadow-[0_0_6px_var(--neon-red),0_0_12px_var(--neon-red)]'
                    : 'bg-[#2a0a0a]'
                )}
              />
            </div>
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes temp-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// SUPERCOMPUTER ARRAY - Tier 3 Tech computation
// ==================================================
// SUPERCOMPUTER ARRAY - Tier 3 Tech heavy computation
// ==================================================
type SupercomputerState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type SupercomputerTestPhase = 'nodes' | 'interconnect' | 'memory' | 'cache' | 'scheduler' | 'benchmark' | 'complete' | null

interface SupercomputerProps {
  flops?: number
  utilization?: number
  isOnline?: boolean
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function SupercomputerArray({
  flops = 2.4,
  utilization = 87,
  isOnline = true,
  className,
  onTest,
  onReset,
}: SupercomputerProps) {
  const [deviceState, setDeviceState] = useState<SupercomputerState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<SupercomputerTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Initializing...')
  const [displayValues, setDisplayValues] = useState({ flops: 0, load: 0, activeNodes: 0 })

  // Boot sequence on mount
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('POST check...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Node discovery...')
      setBootPhase(2)
      setDisplayValues({ flops: 0, load: 5, activeNodes: 4 })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Interconnect init...')
      setBootPhase(3)
      setDisplayValues({ flops: 0.4, load: 15, activeNodes: 8 })
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Memory allocation...')
      setBootPhase(4)
      setDisplayValues({ flops: 1.2, load: 35, activeNodes: 12 })
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Scheduler online...')
      setBootPhase(5)
      setDisplayValues({ flops: 1.8, load: 55, activeNodes: 14 })
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Benchmark calibrate...')
      setBootPhase(6)
      await new Promise(r => setTimeout(r, 400))

      // Final boot
      setDisplayValues({ flops: flops, load: utilization, activeNodes: 16 })
      setBootPhase(7)
      setDeviceState('online')
      setStatusMessage('READY')
    }

    bootSequence()
  }, [])

  // Update values when props change (after boot)
  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayValues(prev => ({ ...prev, flops: flops, load: utilization }))
    }
  }, [flops, utilization, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<SupercomputerTestPhase>[] = ['nodes', 'interconnect', 'memory', 'cache', 'scheduler', 'benchmark', 'complete']
    const phaseMessages: Record<NonNullable<SupercomputerTestPhase>, string> = {
      nodes: 'Testing compute nodes...',
      interconnect: 'Checking interconnect...',
      memory: 'Verifying ECC memory...',
      cache: 'Testing L3 cache...',
      scheduler: 'Validating scheduler...',
      benchmark: 'Running LINPACK...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 400))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('READY')
    }, 3000)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Draining jobs...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Node shutdown...')
    setDisplayValues(prev => ({ ...prev, activeNodes: 8, load: 20 }))
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Power cycle...')
    setDisplayValues({ flops: 0, load: 0, activeNodes: 0 })
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 400))

    setStatusMessage('Cluster offline')
    await new Promise(r => setTimeout(r, 350))

    // Boot sequence
    setDeviceState('booting')
    setStatusMessage('POST check...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Node discovery...')
    setBootPhase(2)
    setDisplayValues({ flops: 0, load: 5, activeNodes: 4 })
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Interconnect init...')
    setBootPhase(3)
    setDisplayValues({ flops: 0.4, load: 15, activeNodes: 8 })
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Memory allocation...')
    setBootPhase(4)
    setDisplayValues({ flops: 1.2, load: 35, activeNodes: 12 })
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Scheduler online...')
    setBootPhase(5)
    setDisplayValues({ flops: 1.8, load: 55, activeNodes: 14 })
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Benchmark calibrate...')
    setBootPhase(6)
    await new Promise(r => setTimeout(r, 400))

    setDisplayValues({ flops: flops, load: utilization, activeNodes: 16 })
    setBootPhase(7)
    setDeviceState('online')
    setStatusMessage('READY')
    onReset?.()
  }

  const getLedColor = () => {
    if (deviceState === 'offline' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return 'cyan'
  }

  const isLedOn = deviceState !== 'offline' && !(deviceState === 'rebooting' && bootPhase === 0)
  const nodesActive = deviceState === 'online' || deviceState === 'testing' || (deviceState === 'booting' && bootPhase >= 2)

  return (
    <PanelFrame variant="teal" className={cn('p-2', className)}>
      {/* Header with worn metal micro buttons */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <LED on={isLedOn} color={getLedColor()} size="sm" />
          <div className="font-mono text-[8px] text-[var(--neon-cyan)]">
            SUPERCOMPUTER
          </div>
        </div>

        {/* Worn metal micro buttons - brushed steel style */}
        <div className="flex items-center gap-0.5">
          {/* Mini company logo - CRAY style */}
          <div
            className="font-mono text-[3px] text-white/25 px-0.5 border border-white/10 rounded-[1px] mr-0.5"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.1) 100%)',
            }}
          >
            CRAY
          </div>
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div className={cn(
              'w-2.5 h-[7px] rounded-[1px] transition-all',
              'flex items-center justify-center',
              'border border-[#4a5a6a]/60',
              'group-hover:border-[var(--neon-cyan)]/50',
              'group-active:scale-95'
            )}
            style={{
              background: 'linear-gradient(180deg, #5a6a7a 0%, #3a4a5a 20%, #2a3a4a 80%, #1a2a3a 100%)',
              boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.2), inset 0 -0.5px 0 rgba(0,0,0,0.3)',
            }}
            >
              {/* Brushed metal texture + wear */}
              <div className="absolute inset-0 rounded-[1px] opacity-30"
                style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, rgba(255,255,255,0.1) 1px, transparent 2px)',
                }}
              />
              {/* Status indicator dot */}
              <div className={cn(
                'w-[3px] h-[3px] rounded-full transition-all z-10',
                deviceState === 'testing'
                  ? 'bg-[var(--neon-cyan)] shadow-[0_0_2px_var(--neon-cyan)]'
                  : testResult === 'pass'
                  ? 'bg-[var(--neon-green)] shadow-[0_0_2px_var(--neon-green)]'
                  : testResult === 'fail'
                  ? 'bg-[var(--neon-red)] shadow-[0_0_2px_var(--neon-red)]'
                  : 'bg-[#1a2a3a]'
              )} />
            </div>
          </button>
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div className={cn(
              'w-2.5 h-[7px] rounded-[1px] transition-all',
              'flex items-center justify-center',
              'border border-[#6a5a4a]/60',
              'group-hover:border-[var(--neon-amber)]/50',
              'group-active:scale-95'
            )}
            style={{
              background: 'linear-gradient(180deg, #7a6a5a 0%, #5a4a3a 20%, #4a3a2a 80%, #3a2a1a 100%)',
              boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.2), inset 0 -0.5px 0 rgba(0,0,0,0.3)',
            }}
            >
              {/* Brushed metal texture + wear */}
              <div className="absolute inset-0 rounded-[1px] opacity-30"
                style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, rgba(255,255,255,0.1) 1px, transparent 2px)',
                }}
              />
              {/* Status indicator dot */}
              <div className={cn(
                'w-[3px] h-[3px] rounded-full transition-all z-10',
                deviceState === 'rebooting' || deviceState === 'booting'
                  ? 'bg-[var(--neon-amber)] shadow-[0_0_2px_var(--neon-amber)]'
                  : 'bg-[#2a1a0a]'
              )} />
            </div>
          </button>
          <div className="font-mono text-[5px] text-white/30">T3</div>
        </div>
      </div>

      {/* Compute nodes visualization */}
      <div className={cn(
        'relative h-8 bg-black/40 rounded overflow-hidden p-1',
        deviceState === 'testing' && testPhase === 'nodes' && 'ring-1 ring-[var(--neon-cyan)]/50'
      )}>
        <div className="grid grid-cols-8 grid-rows-2 gap-0.5 h-full">
          {Array.from({ length: 16 }).map((_, i) => {
            const isActive = nodesActive && i < displayValues.activeNodes
            const nodeLoad = i < Math.floor(displayValues.load / 6.25)
            return (
              <div
                key={i}
                className={cn(
                  'rounded-sm transition-all duration-300',
                  deviceState === 'testing' && testPhase === 'interconnect' && isActive && 'ring-1 ring-[var(--neon-green)]/50'
                )}
                style={{
                  background: isActive && nodeLoad
                    ? 'var(--neon-cyan)'
                    : isActive
                    ? 'rgba(0,255,255,0.3)'
                    : 'rgba(255,255,255,0.1)',
                  opacity: isActive ? (nodeLoad ? 0.8 : 0.4) : 0.15,
                  animation: isActive && nodeLoad
                    ? `node-blink ${0.5 + (i % 4) * 0.1}s ease-in-out infinite`
                    : 'none',
                  boxShadow: isActive && nodeLoad ? '0 0 4px var(--neon-cyan)' : 'none',
                }}
              />
            )
          })}
        </div>

        {/* Test overlay for memory/cache phases */}
        {deviceState === 'testing' && (testPhase === 'memory' || testPhase === 'cache') && (
          <div className="absolute inset-0 bg-[var(--neon-cyan)]/10 animate-pulse" />
        )}
      </div>

      {/* Status bar with fixed layout */}
      <div className="flex items-center font-mono text-[7px] mt-1">
        <span className={cn(
          'w-12 shrink-0 transition-colors',
          nodesActive ? 'text-[var(--neon-cyan)]' : 'text-white/30'
        )}>
          {displayValues.flops.toFixed(1)} PFLOPS
        </span>
        <span className={cn(
          'flex-1 text-[5px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          testResult === 'fail' ? 'text-[var(--neon-red)]' :
          'text-white/30'
        )}>
          {statusMessage}
        </span>
        <span className={cn(
          'w-10 shrink-0 text-right transition-colors',
          'text-white/40'
        )}>
          {displayValues.load}% LOAD
        </span>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// DIMENSION MONITOR - Dimensional stability tracker
// Device ID: DIM-001 | Version: 1.0.0
// Compatible: QuantumStateMonitor, ExoticMatterContainment
// unOS Commands: DEVICE DIM [TEST|RESET|STATUS]
// ==================================================
type DimState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type DimTestPhase = 'sensors' | 'rift-scan' | 'stability' | 'calibration' | 'complete' | null

interface DimensionMonitorProps {
  dimension?: number
  stability?: number
  riftActivity?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function DimensionMonitor({
  dimension = 3.14,
  stability = 98,
  riftActivity = 0.02,
  className,
  onTest,
  onReset,
}: DimensionMonitorProps) {
  const [deviceState, setDeviceState] = useState<DimState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<DimTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayDim, setDisplayDim] = useState(0)
  const [displayStability, setDisplayStability] = useState(0)
  const [fluctuation, setFluctuation] = useState(0)

  // Dimensional fluctuation animation
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      const variance = deviceState === 'testing' ? 0.05 : 0.01
      setFluctuation((Math.random() - 0.5) * variance)
    }, 300)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Sensor init...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Probing D-space...')
      setBootPhase(2)
      setDisplayDim(1.0)
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Calibrating rift...')
      setBootPhase(3)
      setDisplayDim(2.5)
      setDisplayStability(50)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Locking dimension...')
      setBootPhase(4)
      setDisplayDim(dimension)
      setDisplayStability(stability)
      await new Promise(r => setTimeout(r, 300))

      setBootPhase(5)
      setDeviceState('online')
      setStatusMessage('STABLE')
    }
    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayDim(dimension)
      setDisplayStability(stability)
    }
  }, [dimension, stability, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<DimTestPhase>[] = ['sensors', 'rift-scan', 'stability', 'calibration', 'complete']
    const msgs: Record<NonNullable<DimTestPhase>, string> = {
      sensors: 'Testing sensors...',
      'rift-scan': 'Scanning rifts...',
      stability: 'Stability check...',
      calibration: 'Calibrating D-lock...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      await new Promise(r => setTimeout(r, 400))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('STABLE')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutdown...')
    setDisplayDim(0)
    setDisplayStability(0)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Reset D-lock...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 400))

    // Boot
    setDeviceState('booting')
    setStatusMessage('Sensor init...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Probing D-space...')
    setBootPhase(2)
    setDisplayDim(2.0)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Locking dimension...')
    setBootPhase(3)
    setDisplayDim(dimension)
    setDisplayStability(stability)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase(5)
    setDeviceState('online')
    setStatusMessage('STABLE')
    onReset?.()
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const currentDim = displayDim + fluctuation
  const stabilityColor = displayStability > 80 ? 'var(--neon-green)' : displayStability > 50 ? 'var(--neon-amber)' : 'var(--neon-red)'

  // Additional computed values
  const haloProximity = Math.max(0, 100 - displayStability + riftActivity * 100)
  const entanglementStrength = displayStability > 90 ? 'STRONG' : displayStability > 70 ? 'MODERATE' : 'WEAK'

  return (
    <PanelFrame variant="teal" className={cn('p-1 flex flex-col', className)}>
      {/* Header with company logo */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-0.5">
          <div className="font-mono text-[5px] text-[var(--neon-purple,#9d00ff)]">DIM</div>
          {/* LED buttons at header */}
          <div className="flex items-center gap-0.5 ml-1">
            {/* Round LED test button with purple glow */}
            <button
              onClick={handleTest}
              disabled={deviceState !== 'online'}
              className="group relative disabled:opacity-30"
              title="Test"
            >
              <div
                className="w-2 h-2 rounded-full p-[1px] transition-all group-active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #3a2a4a 0%, #2a1a3a 50%, #1a0a2a 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(200,100,255,0.15), 0 1px 2px rgba(0,0,0,0.5)',
                  border: '1px solid #4a3a5a',
                }}
              >
                <div
                  className={cn(
                    'w-full h-full rounded-full transition-all',
                    deviceState === 'testing'
                      ? 'bg-[var(--neon-purple,#9d00ff)] shadow-[0_0_6px_var(--neon-purple,#9d00ff),0_0_12px_var(--neon-purple,#9d00ff)]'
                      : testResult === 'pass'
                      ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]'
                      : 'bg-[#1a0a2a]'
                  )}
                />
              </div>
            </button>

            {/* Round LED reset button with magenta glow */}
            <button
              onClick={handleReboot}
              disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
              className="group relative disabled:opacity-30"
              title="Reboot"
            >
              <div
                className="w-2 h-2 rounded-full p-[1px] transition-all group-active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #4a2a3a 0%, #3a1a2a 50%, #2a0a1a 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,100,200,0.15), 0 1px 2px rgba(0,0,0,0.5)',
                  border: '1px solid #5a3a4a',
                }}
              >
                <div
                  className={cn(
                    'w-full h-full rounded-full transition-all',
                    (deviceState === 'rebooting' || deviceState === 'booting')
                      ? 'bg-[var(--neon-pink)] shadow-[0_0_6px_var(--neon-pink),0_0_12px_var(--neon-pink)]'
                      : 'bg-[#2a0a1a]'
                  )}
                />
              </div>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {/* DIME logo (Dimensional Monitoring Electronics) */}
          <div
            className="font-mono text-[3px] text-[#cc00ff] px-0.5 leading-none"
            style={{
              background: 'linear-gradient(180deg, #2a1a4a 0%, #1a0a3a 100%)',
              border: '0.5px solid #4a3a6a',
              borderRadius: '1px',
            }}
          >
            DIME
          </div>
          <div className="font-mono text-[3px] text-white/20">DIM-1</div>
        </div>
      </div>

      {/* Dimensional visualization - expanded to fill space */}
      <div className={cn(
        'relative flex-1 min-h-[3rem] bg-black/60 rounded overflow-hidden',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-purple,#9d00ff)]/30'
      )}>
        {/* Dimensional grid pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(90deg, var(--neon-purple,#9d00ff) 1px, transparent 1px),
              linear-gradient(var(--neon-purple,#9d00ff) 1px, transparent 1px)
            `,
            backgroundSize: '10px 10px',
            transform: isActive ? `perspective(100px) rotateX(${5 + fluctuation * 10}deg)` : 'none',
            transition: 'transform 0.3s ease',
          }}
        />

        {/* Central dimension indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Glow ring */}
            {isActive && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  width: '32px',
                  height: '32px',
                  margin: '-6px',
                  background: `radial-gradient(circle, var(--neon-purple,#9d00ff) 0%, transparent 70%)`,
                  opacity: 0.3 + (deviceState === 'testing' ? Math.sin(Date.now() / 200) * 0.2 : 0),
                  animation: deviceState === 'testing' ? 'dim-pulse 1s ease-in-out infinite' : 'none',
                }}
              />
            )}
            {/* Dimension value */}
            <span
              className="font-mono text-[14px] relative z-10"
              style={{
                color: isActive ? 'var(--neon-purple,#9d00ff)' : 'white/30',
                textShadow: isActive ? '0 0 8px var(--neon-purple,#9d00ff)' : 'none',
              }}
            >
              D-{currentDim.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Left side info panel */}
        <div className="absolute left-1 top-1 bottom-1 flex flex-col justify-between">
          <div>
            <div className="font-mono text-[4px] text-white/30">RIFT ACTIVITY</div>
            <div className="font-mono text-[5px] text-[var(--neon-pink)]">{(riftActivity * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="font-mono text-[4px] text-white/30">HALO PROX</div>
            <div className="font-mono text-[5px]" style={{ color: haloProximity > 20 ? 'var(--neon-amber)' : 'var(--neon-cyan)' }}>
              {haloProximity.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Right side info panel */}
        <div className="absolute right-1 top-1 bottom-1 flex flex-col justify-between items-end">
          <div className="text-right">
            <div className="font-mono text-[4px] text-white/30">STABILITY</div>
            <div className="font-mono text-[5px]" style={{ color: stabilityColor }}>{displayStability}%</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[4px] text-white/30">ENTANGLE</div>
            <div className="font-mono text-[5px]" style={{
              color: entanglementStrength === 'STRONG' ? 'var(--neon-green)' :
                     entanglementStrength === 'MODERATE' ? 'var(--neon-amber)' : 'var(--neon-red)'
            }}>
              {entanglementStrength}
            </div>
          </div>
        </div>

        {/* Stability bar at bottom */}
        <div className="absolute inset-x-2 bottom-1.5 h-1.5 bg-black/40 rounded overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${displayStability}%`,
              background: `linear-gradient(90deg, ${stabilityColor} 0%, var(--neon-purple,#9d00ff) 100%)`,
              boxShadow: `0 0 4px ${stabilityColor}`,
            }}
          />
          {/* Grid markers */}
          <div className="absolute inset-0 flex justify-between">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-px h-full bg-white/20" />
            ))}
          </div>
        </div>

        {/* Test overlay - rift scan effect */}
        {deviceState === 'testing' && testPhase === 'rift-scan' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, transparent 0%, var(--neon-purple,#9d00ff) 50%, transparent 100%)',
              animation: 'dim-scan 0.8s ease-out infinite',
              opacity: 0.3,
            }}
          />
        )}

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="font-mono text-[6px] text-[var(--neon-purple,#9d00ff)] animate-pulse">{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        <span className={cn(
          'text-[4px]',
          deviceState === 'testing' ? 'text-[var(--neon-purple,#9d00ff)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          isActive ? 'text-white/40' : 'text-white/20'
        )}>
          {statusMessage}
        </span>

        <span className={cn(
          'text-[4px] transition-colors',
          isActive ? 'text-[var(--neon-green)]' : 'text-white/30'
        )}>
          {isActive ? 'LOCKED' : 'OFFLINE'}
        </span>
      </div>

      <style jsx global>{`
        @keyframes dim-pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.2); opacity: 0.5; }
        }
        @keyframes dim-scan {
          0% { transform: scale(0); opacity: 0.5; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// CPU MONITOR - Multi-core processor utilization
// Device ID: CPU-001 | Version: 3.2.1
// Compatible: TMP-001, VNT-001, SCA-001, MFR-001
// unOS Commands: DEVICE CPU [TEST|RESET|STATUS]
// ==================================================
type CpuState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type CpuTestPhase = 'cores' | 'cache' | 'frequency' | 'thermal' | 'stress' | 'complete' | null

interface CpuMonitorProps {
  cores?: number
  utilization?: number
  frequency?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function CpuMonitor({
  cores = 8,
  utilization = 67,
  frequency = 4.2,
  className,
  onTest,
  onReset,
}: CpuMonitorProps) {
  const [deviceState, setDeviceState] = useState<CpuState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<CpuTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayUtil, setDisplayUtil] = useState(0)
  const [coreLoads, setCoreLoads] = useState<number[]>(Array(cores).fill(0))

  // Animate core loads
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      if (deviceState === 'online' || deviceState === 'testing') {
        setCoreLoads(prev => prev.map((_, i) => {
          const base = deviceState === 'testing' ? 85 : utilization
          const variance = deviceState === 'testing' ? 15 : 25
          return Math.max(5, Math.min(100, base + (Math.random() - 0.5) * variance + (i % 2) * 10))
        }))
      }
    }, 200)
    return () => clearInterval(interval)
  }, [deviceState, utilization, cores])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('POST check...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Detecting cores...')
      setBootPhase(2)
      setCoreLoads(Array(cores).fill(10))
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Init L1/L2 cache...')
      setBootPhase(3)
      setCoreLoads(prev => prev.map((_, i) => 20 + i * 5))
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Freq scaling...')
      setBootPhase(4)
      setDisplayUtil(30)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Calibrating...')
      setBootPhase(5)
      setDisplayUtil(utilization)
      await new Promise(r => setTimeout(r, 300))

      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage('READY')
    }
    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayUtil(utilization)
    }
  }, [utilization, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<CpuTestPhase>[] = ['cores', 'cache', 'frequency', 'thermal', 'stress', 'complete']
    const msgs: Record<NonNullable<CpuTestPhase>, string> = {
      cores: 'Testing cores...',
      cache: 'Cache integrity...',
      frequency: 'Freq validation...',
      thermal: 'Thermal check...',
      stress: 'Stress test...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      if (phase === 'stress') {
        setCoreLoads(Array(cores).fill(95))
        await new Promise(r => setTimeout(r, 600))
      } else {
        await new Promise(r => setTimeout(r, 350))
      }
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('READY')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutdown...')
    setCoreLoads(Array(cores).fill(0))
    setDisplayUtil(0)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Reset...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 400))

    // Boot
    setDeviceState('booting')
    setStatusMessage('POST check...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Detecting cores...')
    setBootPhase(2)
    setCoreLoads(Array(cores).fill(15))
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Init cache...')
    setBootPhase(3)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Calibrating...')
    setBootPhase(5)
    setDisplayUtil(utilization)
    await new Promise(r => setTimeout(r, 250))

    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage('READY')
    onReset?.()
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const avgLoad = coreLoads.length > 0 ? Math.round(coreLoads.reduce((a, b) => a + b, 0) / coreLoads.length) : 0

  return (
    <PanelFrame variant="teal" className={cn('p-1 flex flex-col', className)}>
      {/* Header with lamps at top middle and logo */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="font-mono text-[5px] text-[var(--neon-cyan)]">CPU</div>

        {/* Worn round lamps at top middle */}
        <div className="flex items-center gap-1">
          {/* Test lamp - cyan glow */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div
              className="w-3 h-3 rounded-full p-[2px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #3a4a4a 0%, #2a3a3a 30%, #1a2a2a 70%, #0a1a1a 100%)',
                boxShadow: 'inset 0 -1px 2px rgba(0,255,255,0.1), inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.6)',
                border: '1px solid #4a5a5a',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-full transition-all',
                  deviceState === 'testing'
                    ? 'bg-[var(--neon-cyan)] shadow-[0_0_8px_var(--neon-cyan),0_0_16px_var(--neon-cyan),inset_0_-1px_2px_rgba(0,0,0,0.3)]'
                    : testResult === 'pass'
                    ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]'
                    : 'bg-[#1a2a2a] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                )}
                style={{
                  background: deviceState === 'testing'
                    ? 'radial-gradient(circle at 30% 30%, #88ffff 0%, var(--neon-cyan) 50%, #006666 100%)'
                    : testResult === 'pass'
                    ? 'radial-gradient(circle at 30% 30%, #88ff88 0%, var(--neon-green) 50%, #006600 100%)'
                    : 'radial-gradient(circle at 30% 30%, #2a3a3a 0%, #1a2a2a 50%, #0a1a1a 100%)',
                }}
              />
            </div>
          </button>

          {/* Reset lamp - amber/red glow */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div
              className="w-3 h-3 rounded-full p-[2px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #4a3a2a 0%, #3a2a1a 30%, #2a1a0a 70%, #1a0a00 100%)',
                boxShadow: 'inset 0 -1px 2px rgba(255,150,0,0.1), inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.6)',
                border: '1px solid #5a4a3a',
              }}
            >
              <div
                className={cn(
                  'w-full h-full rounded-full transition-all',
                  (deviceState === 'rebooting' || deviceState === 'booting')
                    ? 'shadow-[0_0_8px_var(--neon-amber),0_0_16px_var(--neon-amber)]'
                    : ''
                )}
                style={{
                  background: (deviceState === 'rebooting' || deviceState === 'booting')
                    ? 'radial-gradient(circle at 30% 30%, #ffcc88 0%, var(--neon-amber) 50%, #663300 100%)'
                    : 'radial-gradient(circle at 30% 30%, #3a2a1a 0%, #2a1a0a 50%, #1a0a00 100%)',
                }}
              />
            </div>
          </button>
        </div>

        {/* AMTD logo (Advanced Micro-Thermal Dynamics) - top right */}
        <div className="flex items-center gap-0.5">
          <div
            className="font-mono text-[3px] text-[#00cc99] px-0.5 leading-none"
            style={{
              background: 'linear-gradient(180deg, #1a3a2a 0%, #0a2a1a 100%)',
              border: '0.5px solid #2a4a3a',
              borderRadius: '1px',
            }}
          >
            AMTD
          </div>
        </div>
      </div>

      {/* CPU visualization - expanded to fill space */}
      <div className={cn(
        'relative flex-1 min-h-[2.5rem] bg-black/60 rounded overflow-hidden',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-cyan)]/30'
      )}>
        {/* Core bars */}
        <div className="absolute inset-1 flex items-end gap-px">
          {coreLoads.map((load, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full">
              <div
                className="w-full transition-all duration-150 rounded-t-sm"
                style={{
                  height: `${isActive ? load : 0}%`,
                  background: load > 80
                    ? 'linear-gradient(180deg, var(--neon-red) 0%, var(--neon-amber) 100%)'
                    : load > 50
                    ? 'linear-gradient(180deg, var(--neon-amber) 0%, var(--neon-cyan) 100%)'
                    : 'linear-gradient(180deg, var(--neon-cyan) 0%, #006666 100%)',
                  boxShadow: isActive ? `0 0 4px ${load > 80 ? 'var(--neon-red)' : 'var(--neon-cyan)'}` : 'none',
                  opacity: isActive ? 1 : 0.3,
                }}
              />
            </div>
          ))}
        </div>

        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'linear-gradient(0deg, transparent 0%, transparent 24%, rgba(255,255,255,0.1) 25%, transparent 26%)',
            backgroundSize: '100% 25%',
          }}
        />

        {/* Frequency indicator */}
        <div className="absolute top-1 right-1 font-mono text-[4px] text-[var(--neon-cyan)]/60">
          {frequency.toFixed(1)} GHz
        </div>

        {/* Core count */}
        <div className="absolute top-1 left-1 font-mono text-[4px] text-white/40">
          {cores} CORES
        </div>

        {/* Test overlay - stress pattern */}
        {deviceState === 'testing' && testPhase === 'stress' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 2px, var(--neon-cyan) 2px, var(--neon-cyan) 3px)',
              animation: 'cpu-stress 0.2s linear infinite',
              opacity: 0.2,
            }}
          />
        )}

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="font-mono text-[5px] text-[var(--neon-cyan)] animate-pulse">{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        <span className={cn(
          'transition-colors',
          isActive ? (avgLoad > 80 ? 'text-[var(--neon-red)]' : 'text-[var(--neon-cyan)]') : 'text-white/30'
        )}>
          {isActive ? `${avgLoad}%` : '--%'}
        </span>

        <span className={cn(
          'text-[4px]',
          deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          'text-white/20'
        )}>
          {statusMessage}
        </span>

        <span className="text-[3px] text-white/20">CPU-1</span>
      </div>

      <style jsx global>{`
        @keyframes cpu-stress {
          0% { transform: translateX(0); }
          100% { transform: translateX(3px); }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// LAB CLOCK - Multi-mode time display system
// Device ID: CLK-001 | Version: 2.4.0
// Compatible: DGN-001, SCA-001, all monitoring devices
// unOS Commands: DEVICE CLOCK [TEST|RESET|STATUS|MODE]
// ==================================================
type ClockState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type ClockTestPhase = 'crystal' | 'sync' | 'drift' | 'accuracy' | 'complete' | null
type ClockMode = 'local' | 'utc' | 'date' | 'uptime' | 'countdown' | 'stopwatch'

interface LabClockProps {
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function LabClock({
  className,
  onTest,
  onReset,
}: LabClockProps) {
  const [deviceState, setDeviceState] = useState<ClockState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<ClockTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayMode, setDisplayMode] = useState<ClockMode>('local')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [uptime, setUptime] = useState(0)
  const [stopwatchTime, setStopwatchTime] = useState(0)
  const [stopwatchRunning, setStopwatchRunning] = useState(false)
  const [countdownTime, setCountdownTime] = useState(3600) // 1 hour default
  const [countdownRunning, setCountdownRunning] = useState(false)

  // Update time every second
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      if (deviceState === 'online') {
        setUptime(prev => prev + 1)
      }
      if (stopwatchRunning) {
        setStopwatchTime(prev => prev + 1)
      }
      if (countdownRunning && countdownTime > 0) {
        setCountdownTime(prev => Math.max(0, prev - 1))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [deviceState, stopwatchRunning, countdownRunning, countdownTime])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Crystal init...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('RTC sync...')
      setBootPhase(2)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('NTP query...')
      setBootPhase(3)
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Calibrating...')
      setBootPhase(4)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Drift comp...')
      setBootPhase(5)
      await new Promise(r => setTimeout(r, 250))

      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage('SYNCED')
    }
    bootSequence()
  }, [])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<ClockTestPhase>[] = ['crystal', 'sync', 'drift', 'accuracy', 'complete']
    const msgs: Record<NonNullable<ClockTestPhase>, string> = {
      crystal: 'Testing crystal...',
      sync: 'Sync check...',
      drift: 'Drift analysis...',
      accuracy: 'Accuracy test...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      await new Promise(r => setTimeout(r, 400))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('SYNCED')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutdown...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset RTC...')
    setBootPhase(0)
    setUptime(0)
    await new Promise(r => setTimeout(r, 350))

    // Boot
    setDeviceState('booting')
    setStatusMessage('Crystal init...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('RTC sync...')
    setBootPhase(2)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Calibrating...')
    setBootPhase(4)
    await new Promise(r => setTimeout(r, 250))

    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage('SYNCED')
    onReset?.()
  }

  const cycleMode = () => {
    if (deviceState !== 'online') return
    const modes: ClockMode[] = ['local', 'utc', 'date', 'uptime', 'countdown', 'stopwatch']
    const currentIndex = modes.indexOf(displayMode)
    setDisplayMode(modes[(currentIndex + 1) % modes.length])
  }

  const toggleStopwatch = () => {
    if (displayMode === 'stopwatch') {
      setStopwatchRunning(!stopwatchRunning)
    }
  }

  const resetStopwatch = () => {
    if (displayMode === 'stopwatch') {
      setStopwatchTime(0)
      setStopwatchRunning(false)
    }
  }

  const toggleCountdown = () => {
    if (displayMode === 'countdown') {
      setCountdownRunning(!countdownRunning)
    }
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'

  const getDisplayContent = () => {
    if (!isActive) return { main: '--:--:--', sub: 'OFFLINE', label: 'TIME' }

    switch (displayMode) {
      case 'local':
        return {
          main: currentTime.toLocaleTimeString('en-US', { hour12: false }),
          sub: Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop() || 'LOCAL',
          label: 'LOCAL',
        }
      case 'utc':
        return {
          main: currentTime.toISOString().slice(11, 19),
          sub: 'ZULU',
          label: 'UTC',
        }
      case 'date':
        return {
          main: currentTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
          sub: currentTime.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
          label: 'DATE',
        }
      case 'uptime':
        return {
          main: formatTime(uptime),
          sub: 'SESSION',
          label: 'UPTIME',
        }
      case 'countdown':
        return {
          main: formatTime(countdownTime),
          sub: countdownRunning ? 'RUNNING' : 'PAUSED',
          label: 'COUNTDOWN',
        }
      case 'stopwatch':
        return {
          main: formatTime(stopwatchTime),
          sub: stopwatchRunning ? 'RUNNING' : 'STOPPED',
          label: 'STOPWATCH',
        }
    }
  }

  const display = getDisplayContent()

  return (
    <PanelFrame variant="default" className={cn('p-1 flex flex-col', className)}>
      {/* Header with mode button and logo */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1">
          <div className="font-mono text-[5px] text-[var(--neon-green)]">CLOCK</div>
          {/* Mode cycle button */}
          <button
            onClick={cycleMode}
            disabled={!isActive}
            className="group disabled:opacity-30"
            title="Cycle Mode"
          >
            <div
              className="px-1 py-0.5 rounded transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #2a3a2a 0%, #1a2a1a 100%)',
                border: '0.5px solid #3a4a3a',
                fontSize: '4px',
                color: 'var(--neon-green)',
              }}
            >
              MODE
            </div>
          </button>
        </div>

        {/* SIKO logo (Seiko-style) - top right */}
        <div className="flex items-center gap-0.5">
          <div
            className="font-mono text-[3px] text-[#ffcc00] px-0.5 leading-none font-bold"
            style={{
              background: 'linear-gradient(180deg, #3a3a1a 0%, #2a2a0a 100%)',
              border: '0.5px solid #4a4a2a',
              borderRadius: '1px',
            }}
          >
            SIKO
          </div>
        </div>
      </div>

      {/* Clock display - expanded to fill space */}
      <div className={cn(
        'relative flex-1 min-h-[2.5rem] bg-black/60 rounded overflow-hidden',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-green)]/30'
      )}>
        {/* Mode label */}
        <div className="absolute top-1 left-1 font-mono text-[4px] text-white/30">
          {display.label}
        </div>

        {/* Main time display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono text-[16px] tabular-nums tracking-wider"
            style={{
              color: isActive ? 'var(--neon-green)' : 'white/30',
              textShadow: isActive ? '0 0 10px var(--neon-green), 0 0 20px var(--neon-green)' : 'none',
            }}
          >
            {display.main}
          </span>
        </div>

        {/* Sub label */}
        <div className="absolute bottom-1 left-1 font-mono text-[4px]" style={{ color: 'var(--neon-green)', opacity: 0.6 }}>
          {display.sub}
        </div>

        {/* Mode-specific controls */}
        {displayMode === 'stopwatch' && isActive && (
          <div className="absolute bottom-1 right-1 flex gap-1">
            <button
              onClick={toggleStopwatch}
              className="font-mono text-[4px] px-1 rounded"
              style={{
                background: stopwatchRunning ? 'var(--neon-red)' : 'var(--neon-green)',
                color: '#000',
              }}
            >
              {stopwatchRunning ? 'STOP' : 'START'}
            </button>
            <button
              onClick={resetStopwatch}
              className="font-mono text-[4px] px-1 rounded"
              style={{ background: 'var(--neon-amber)', color: '#000' }}
            >
              RST
            </button>
          </div>
        )}

        {displayMode === 'countdown' && isActive && (
          <div className="absolute bottom-1 right-1 flex gap-1">
            <button
              onClick={toggleCountdown}
              className="font-mono text-[4px] px-1 rounded"
              style={{
                background: countdownRunning ? 'var(--neon-red)' : 'var(--neon-green)',
                color: '#000',
              }}
            >
              {countdownRunning ? 'PAUSE' : 'START'}
            </button>
          </div>
        )}

        {/* Seconds indicator dots */}
        {isActive && (displayMode === 'local' || displayMode === 'utc') && (
          <div className="absolute top-1 right-1 flex gap-0.5">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="w-1 h-1 rounded-full transition-all duration-200"
                style={{
                  background: currentTime.getSeconds() % 4 === i ? 'var(--neon-green)' : 'var(--neon-green)',
                  opacity: currentTime.getSeconds() % 4 === i ? 1 : 0.2,
                  boxShadow: currentTime.getSeconds() % 4 === i ? '0 0 4px var(--neon-green)' : 'none',
                }}
              />
            ))}
          </div>
        )}

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="font-mono text-[6px] text-[var(--neon-green)] animate-pulse">{statusMessage}</span>
          </div>
        )}

        {/* Test overlay - sync animation */}
        {deviceState === 'testing' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 3px, var(--neon-green) 3px, var(--neon-green) 4px)',
              animation: 'clock-scan 0.3s linear infinite',
              opacity: 0.1,
            }}
          />
        )}
      </div>

      {/* Status bar with LED buttons at bottom right center */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        <span className={cn(
          'text-[4px]',
          deviceState === 'testing' ? 'text-[var(--neon-green)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          'text-white/20'
        )}>
          {statusMessage}
        </span>

        {/* LED buttons - bottom right center */}
        <div className="flex items-center gap-1">
          {/* Worn round test LED with green glow */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #2a3a2a 0%, #1a2a1a 30%, #0a1a0a 70%, #001a00 100%)',
                boxShadow: 'inset 0 -1px 2px rgba(0,255,0,0.1), inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.6)',
                border: '1px solid #3a4a3a',
              }}
            >
              <div
                className="w-full h-full rounded-full transition-all"
                style={{
                  background: deviceState === 'testing'
                    ? 'radial-gradient(circle at 30% 30%, #88ff88 0%, var(--neon-green) 50%, #006600 100%)'
                    : testResult === 'pass'
                    ? 'radial-gradient(circle at 30% 30%, #88ff88 0%, var(--neon-green) 50%, #006600 100%)'
                    : 'radial-gradient(circle at 30% 30%, #2a3a2a 0%, #1a2a1a 50%, #0a1a0a 100%)',
                  boxShadow: deviceState === 'testing' || testResult === 'pass'
                    ? '0 0 8px var(--neon-green), 0 0 16px var(--neon-green)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              />
            </div>
          </button>

          {/* Worn round reset LED with amber glow */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #3a3a2a 0%, #2a2a1a 30%, #1a1a0a 70%, #1a0a00 100%)',
                boxShadow: 'inset 0 -1px 2px rgba(255,180,0,0.1), inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.6)',
                border: '1px solid #4a4a3a',
              }}
            >
              <div
                className="w-full h-full rounded-full transition-all"
                style={{
                  background: (deviceState === 'rebooting' || deviceState === 'booting')
                    ? 'radial-gradient(circle at 30% 30%, #ffdd88 0%, var(--neon-amber) 50%, #664400 100%)'
                    : 'radial-gradient(circle at 30% 30%, #3a3a2a 0%, #2a2a1a 50%, #1a1a0a 100%)',
                  boxShadow: (deviceState === 'rebooting' || deviceState === 'booting')
                    ? '0 0 8px var(--neon-amber), 0 0 16px var(--neon-amber)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              />
            </div>
          </button>
        </div>

        <span className="text-[3px] text-white/20">CLK-1</span>
      </div>

      <style jsx global>{`
        @keyframes clock-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// MEMORY MONITOR - Multi-mode RAM/memory display
// Device ID: MEM-001 | Version: 3.1.0
// Compatible: CPU-001, SCA-001, DGN-001
// unOS Commands: DEVICE MEM [TEST|RESET|STATUS|MODE]
// ==================================================
type MemState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type MemTestPhase = 'modules' | 'timing' | 'integrity' | 'bandwidth' | 'stress' | 'complete' | null
type MemMode = 'usage' | 'heap' | 'cache' | 'swap' | 'processes' | 'allocation'

interface MemoryMonitorProps {
  totalMemory?: number // in GB
  usedMemory?: number // in GB
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function MemoryMonitor({
  totalMemory = 16,
  usedMemory = 11.5,
  className,
  onTest,
  onReset,
}: MemoryMonitorProps) {
  const [deviceState, setDeviceState] = useState<MemState>('booting')
  const [bootPhase, setBootPhase] = useState(0)
  const [testPhase, setTestPhase] = useState<MemTestPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Init...')
  const [displayMode, setDisplayMode] = useState<MemMode>('usage')
  const [displayUsed, setDisplayUsed] = useState(0)
  const [fluctuation, setFluctuation] = useState(0)

  // Simulated memory data for different modes
  const [memData, setMemData] = useState({
    heap: { used: 2.8, total: 4.0 },
    cache: { used: 3.2, total: 4.0 },
    swap: { used: 0.5, total: 8.0 },
    processes: [
      { name: 'quantum-sim', mem: 2.4 },
      { name: 'crystal-idx', mem: 1.8 },
      { name: 'nft-sync', mem: 1.2 },
      { name: 'ui-render', mem: 0.9 },
      { name: 'network-io', mem: 0.6 },
    ],
    allocation: { kernel: 1.2, user: 8.5, buffers: 1.8 },
  })

  // Memory fluctuation animation
  useEffect(() => {
    if (deviceState === 'offline') return
    const interval = setInterval(() => {
      const variance = deviceState === 'testing' ? 0.5 : 0.2
      setFluctuation((Math.random() - 0.5) * variance)
      // Fluctuate process memory slightly
      if (deviceState === 'online') {
        setMemData(prev => ({
          ...prev,
          processes: prev.processes.map(p => ({
            ...p,
            mem: Math.max(0.1, p.mem + (Math.random() - 0.5) * 0.1)
          }))
        }))
      }
    }, 500)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setDeviceState('booting')
      setStatusMessage('Detecting DIMMs...')
      setBootPhase(1)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('SPD read...')
      setBootPhase(2)
      setDisplayUsed(totalMemory * 0.3)
      await new Promise(r => setTimeout(r, 350))

      setStatusMessage('Timing config...')
      setBootPhase(3)
      setDisplayUsed(totalMemory * 0.5)
      await new Promise(r => setTimeout(r, 300))

      setStatusMessage('Memory test...')
      setBootPhase(4)
      setDisplayUsed(totalMemory * 0.7)
      await new Promise(r => setTimeout(r, 400))

      setStatusMessage('Mapping...')
      setBootPhase(5)
      setDisplayUsed(usedMemory)
      await new Promise(r => setTimeout(r, 250))

      setBootPhase(6)
      setDeviceState('online')
      setStatusMessage('READY')
    }
    bootSequence()
  }, [])

  useEffect(() => {
    if (deviceState === 'online') {
      setDisplayUsed(usedMemory)
    }
  }, [usedMemory, deviceState])

  const handleTest = async () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<MemTestPhase>[] = ['modules', 'timing', 'integrity', 'bandwidth', 'stress', 'complete']
    const msgs: Record<NonNullable<MemTestPhase>, string> = {
      modules: 'Testing modules...',
      timing: 'Timing check...',
      integrity: 'Data integrity...',
      bandwidth: 'Bandwidth test...',
      stress: 'Stress test...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(msgs[phase])
      if (phase === 'stress') {
        setDisplayUsed(totalMemory * 0.95)
        await new Promise(r => setTimeout(r, 600))
      } else {
        await new Promise(r => setTimeout(r, 350))
      }
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setDisplayUsed(usedMemory)
    setStatusMessage('PASSED')
    onTest?.()

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('READY')
    }, 2500)
  }

  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting') return
    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Flushing...')
    setDisplayUsed(0)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset controller...')
    setBootPhase(0)
    await new Promise(r => setTimeout(r, 350))

    // Boot
    setDeviceState('booting')
    setStatusMessage('Detecting DIMMs...')
    setBootPhase(1)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('SPD read...')
    setBootPhase(2)
    setDisplayUsed(totalMemory * 0.4)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Mapping...')
    setBootPhase(4)
    setDisplayUsed(usedMemory)
    await new Promise(r => setTimeout(r, 250))

    setBootPhase(6)
    setDeviceState('online')
    setStatusMessage('READY')
    onReset?.()
  }

  const cycleMode = () => {
    if (deviceState !== 'online') return
    const modes: MemMode[] = ['usage', 'heap', 'cache', 'swap', 'processes', 'allocation']
    const currentIndex = modes.indexOf(displayMode)
    setDisplayMode(modes[(currentIndex + 1) % modes.length])
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const currentUsed = displayUsed + fluctuation
  const usagePercent = (currentUsed / totalMemory) * 100
  const usageColor = usagePercent > 85 ? 'var(--neon-red)' : usagePercent > 70 ? 'var(--neon-amber)' : 'var(--neon-amber)'

  const getModeLabel = () => {
    switch (displayMode) {
      case 'usage': return 'RAM USAGE'
      case 'heap': return 'HEAP'
      case 'cache': return 'CACHE'
      case 'swap': return 'SWAP'
      case 'processes': return 'TOP PROC'
      case 'allocation': return 'ALLOC'
    }
  }

  return (
    <PanelFrame variant="military" className={cn('p-1 flex flex-col', className)}>
      {/* Header with mode button and logo */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1">
          <div className="font-mono text-[5px] text-[var(--neon-amber)]">MEM</div>
          {/* Mode cycle button */}
          <button
            onClick={cycleMode}
            disabled={!isActive}
            className="group disabled:opacity-30"
            title="Cycle Mode"
          >
            <div
              className="px-1 py-0.5 rounded transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #3a2a1a 0%, #2a1a0a 100%)',
                border: '0.5px solid #4a3a2a',
                fontSize: '4px',
                color: 'var(--neon-amber)',
              }}
            >
              MODE
            </div>
          </button>
        </div>

        {/* CRSR logo (Corsair-style) - top right */}
        <div className="flex items-center gap-0.5">
          <div
            className="font-mono text-[3px] text-[#ffaa00] px-0.5 leading-none font-bold"
            style={{
              background: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)',
              border: '0.5px solid #3a3a3a',
              borderRadius: '1px',
            }}
          >
            CRSR
          </div>
        </div>
      </div>

      {/* Memory display - expanded to fill space */}
      <div className={cn(
        'relative flex-1 min-h-[2.5rem] bg-black/60 rounded overflow-hidden',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-amber)]/30'
      )}>
        {/* Mode label */}
        <div className="absolute top-1 left-1 font-mono text-[4px] text-white/30">
          {getModeLabel()}
        </div>

        {/* Mode-specific content */}
        {displayMode === 'usage' && (
          <>
            {/* Main usage bar */}
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-3 bg-black/40 rounded overflow-hidden">
              <div
                className="h-full transition-all duration-300 rounded"
                style={{
                  width: isActive ? `${usagePercent}%` : '0%',
                  background: `linear-gradient(90deg, var(--neon-amber) 0%, ${usageColor} 100%)`,
                  boxShadow: isActive ? `0 0 6px ${usageColor}` : 'none',
                }}
              />
              {/* Grid markers */}
              <div className="absolute inset-0 flex justify-between px-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-px h-full bg-white/20" />
                ))}
              </div>
            </div>
            {/* Usage text */}
            <div className="absolute bottom-1 left-2 font-mono text-[5px]" style={{ color: usageColor }}>
              {isActive ? `${currentUsed.toFixed(1)}G` : '--'}
            </div>
            <div className="absolute bottom-1 right-2 font-mono text-[5px] text-white/40">
              / {totalMemory}G
            </div>
          </>
        )}

        {displayMode === 'heap' && (
          <div className="absolute inset-2 flex flex-col justify-center gap-1">
            <div className="flex items-center gap-1">
              <span className="font-mono text-[4px] text-white/40 w-6">HEAP</span>
              <div className="flex-1 h-2 bg-black/40 rounded overflow-hidden">
                <div
                  className="h-full bg-[var(--neon-cyan)] transition-all"
                  style={{ width: isActive ? `${(memData.heap.used / memData.heap.total) * 100}%` : '0%' }}
                />
              </div>
              <span className="font-mono text-[4px] text-[var(--neon-cyan)]">
                {isActive ? `${memData.heap.used.toFixed(1)}G` : '--'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[4px] text-white/40 w-6">STACK</span>
              <div className="flex-1 h-2 bg-black/40 rounded overflow-hidden">
                <div className="h-full bg-[var(--neon-green)] transition-all" style={{ width: isActive ? '35%' : '0%' }} />
              </div>
              <span className="font-mono text-[4px] text-[var(--neon-green)]">{isActive ? '1.4G' : '--'}</span>
            </div>
          </div>
        )}

        {displayMode === 'cache' && (
          <div className="absolute inset-2 flex flex-col justify-center gap-1">
            <div className="flex items-center gap-1">
              <span className="font-mono text-[4px] text-white/40 w-6">L1</span>
              <div className="flex-1 h-1.5 bg-black/40 rounded overflow-hidden">
                <div className="h-full bg-[var(--neon-pink)] transition-all" style={{ width: isActive ? '78%' : '0%' }} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[4px] text-white/40 w-6">L2</span>
              <div className="flex-1 h-1.5 bg-black/40 rounded overflow-hidden">
                <div className="h-full bg-[var(--neon-purple,#9d00ff)] transition-all" style={{ width: isActive ? '65%' : '0%' }} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[4px] text-white/40 w-6">L3</span>
              <div className="flex-1 h-1.5 bg-black/40 rounded overflow-hidden">
                <div className="h-full bg-[var(--neon-cyan)] transition-all" style={{ width: isActive ? '52%' : '0%' }} />
              </div>
            </div>
          </div>
        )}

        {displayMode === 'swap' && (
          <div className="absolute inset-2 flex flex-col justify-center">
            <div className="font-mono text-[4px] text-white/40 mb-1">SWAP USAGE</div>
            <div className="h-2.5 bg-black/40 rounded overflow-hidden">
              <div
                className="h-full bg-[var(--neon-red)] transition-all"
                style={{ width: isActive ? `${(memData.swap.used / memData.swap.total) * 100}%` : '0%' }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-mono text-[4px] text-[var(--neon-red)]">
                {isActive ? `${memData.swap.used.toFixed(1)}G` : '--'}
              </span>
              <span className="font-mono text-[4px] text-white/40">/ {memData.swap.total}G</span>
            </div>
          </div>
        )}

        {displayMode === 'processes' && (
          <div className="absolute inset-1 flex flex-col justify-center gap-0.5 overflow-hidden">
            {memData.processes.slice(0, 5).map((proc, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="font-mono text-[3px] text-white/40 w-8 truncate">{proc.name}</span>
                <div className="flex-1 h-1 bg-black/40 rounded overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: isActive ? `${(proc.mem / 3) * 100}%` : '0%',
                      background: i === 0 ? 'var(--neon-red)' : i === 1 ? 'var(--neon-amber)' : 'var(--neon-cyan)',
                    }}
                  />
                </div>
                <span className="font-mono text-[3px] text-white/40">{isActive ? `${proc.mem.toFixed(1)}G` : '--'}</span>
              </div>
            ))}
          </div>
        )}

        {displayMode === 'allocation' && (
          <div className="absolute inset-2 flex items-center justify-center">
            {/* Stacked bar showing allocation */}
            <div className="w-full h-4 bg-black/40 rounded overflow-hidden flex">
              <div
                className="h-full bg-[var(--neon-red)] transition-all"
                style={{ width: isActive ? `${(memData.allocation.kernel / totalMemory) * 100}%` : '0%' }}
              />
              <div
                className="h-full bg-[var(--neon-amber)] transition-all"
                style={{ width: isActive ? `${(memData.allocation.user / totalMemory) * 100}%` : '0%' }}
              />
              <div
                className="h-full bg-[var(--neon-cyan)] transition-all"
                style={{ width: isActive ? `${(memData.allocation.buffers / totalMemory) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {displayMode === 'allocation' && isActive && (
          <div className="absolute bottom-1 inset-x-2 flex justify-between font-mono text-[3px]">
            <span className="text-[var(--neon-red)]">KRN {memData.allocation.kernel}G</span>
            <span className="text-[var(--neon-amber)]">USR {memData.allocation.user}G</span>
            <span className="text-[var(--neon-cyan)]">BUF {memData.allocation.buffers}G</span>
          </div>
        )}

        {/* Boot overlay */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="font-mono text-[6px] text-[var(--neon-amber)] animate-pulse">{statusMessage}</span>
          </div>
        )}

        {/* Test overlay */}
        {deviceState === 'testing' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, var(--neon-amber) 2px, var(--neon-amber) 3px)',
              animation: 'mem-scan 0.4s linear infinite',
              opacity: 0.1,
            }}
          />
        )}
      </div>

      {/* Status bar with LED buttons at bottom right center */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        <span className={cn(
          'text-[4px]',
          deviceState === 'testing' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          'text-white/20'
        )}>
          {statusMessage}
        </span>

        {/* LED buttons - bottom right center */}
        <div className="flex items-center gap-1">
          {/* Worn round test LED with amber glow */}
          <button
            onClick={handleTest}
            disabled={deviceState !== 'online'}
            className="group relative disabled:opacity-30"
            title="Test"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #3a3a2a 0%, #2a2a1a 30%, #1a1a0a 70%, #0a0a00 100%)',
                boxShadow: 'inset 0 -1px 2px rgba(255,180,0,0.1), inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.6)',
                border: '1px solid #4a4a3a',
              }}
            >
              <div
                className="w-full h-full rounded-full transition-all"
                style={{
                  background: deviceState === 'testing'
                    ? 'radial-gradient(circle at 30% 30%, #ffdd88 0%, var(--neon-amber) 50%, #664400 100%)'
                    : testResult === 'pass'
                    ? 'radial-gradient(circle at 30% 30%, #88ff88 0%, var(--neon-green) 50%, #006600 100%)'
                    : 'radial-gradient(circle at 30% 30%, #3a3a2a 0%, #2a2a1a 50%, #1a1a0a 100%)',
                  boxShadow: deviceState === 'testing'
                    ? '0 0 8px var(--neon-amber), 0 0 16px var(--neon-amber)'
                    : testResult === 'pass'
                    ? '0 0 8px var(--neon-green), 0 0 16px var(--neon-green)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              />
            </div>
          </button>

          {/* Worn round reset LED with red glow */}
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="group relative disabled:opacity-30"
            title="Reboot"
          >
            <div
              className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #3a2a2a 0%, #2a1a1a 30%, #1a0a0a 70%, #0a0000 100%)',
                boxShadow: 'inset 0 -1px 2px rgba(255,100,100,0.1), inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.6)',
                border: '1px solid #4a3a3a',
              }}
            >
              <div
                className="w-full h-full rounded-full transition-all"
                style={{
                  background: (deviceState === 'rebooting' || deviceState === 'booting')
                    ? 'radial-gradient(circle at 30% 30%, #ff8888 0%, var(--neon-red) 50%, #660000 100%)'
                    : 'radial-gradient(circle at 30% 30%, #3a2a2a 0%, #2a1a1a 50%, #1a0a0a 100%)',
                  boxShadow: (deviceState === 'rebooting' || deviceState === 'booting')
                    ? '0 0 8px var(--neon-red), 0 0 16px var(--neon-red)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              />
            </div>
          </button>
        </div>

        <span className="text-[3px] text-white/20">MEM-1</span>
      </div>

      <style jsx global>{`
        @keyframes mem-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </PanelFrame>
  )
}

// ==================================================
// VOLT METER - Power monitoring display with mode switching
// Device ID: VLT-001 | Version: 1.1.0
// Compatible: PWR-001, UEC-001, MFR-001, BAT-001
// unOS Commands: power status, power devices
// Displays real-time data from power management system
// Mode button cycles: VOLT → GEN → LOAD → BAL → BAT → LPCT
// ==================================================

// Display modes matching power command data
type VoltMeterMode = 'VOLT' | 'GEN' | 'LOAD' | 'BAL' | 'BAT' | 'LPCT'

interface VoltMeterProps {
  className?: string
  // Power system data from unOS power command
  totalGeneration?: number      // Total power generation in watts
  totalConsumption?: number     // Total power consumption in watts
  storagePercent?: number       // Battery storage percentage
  storageWh?: number            // Battery storage in Wh
  storageCapacity?: number      // Battery capacity in Wh
  // Optional direct voltage override
  voltage?: number
  // Initial mode
  initialMode?: VoltMeterMode
}

export function VoltMeter({
  className,
  totalGeneration: propGeneration,
  totalConsumption: propConsumption,
  storagePercent: propStoragePercent,
  storageWh: propStorageWh,
  storageCapacity: propStorageCapacity,
  voltage: propVoltage,
  initialMode = 'VOLT',
}: VoltMeterProps) {
  // Get power data from context if available
  const powerManager = usePowerManagerOptional()

  // Use context values if available, otherwise fall back to props or defaults
  // Units: E/s (Energy per second) per GD_SPEC_device-power_v1_0.md
  const totalGeneration = powerManager?.totalGeneration ?? propGeneration ?? 300
  const totalConsumption = powerManager?.totalConsumption ?? propConsumption ?? 185
  const storagePercent = powerManager?.storagePercent ?? propStoragePercent ?? 85
  const storageE = powerManager?.storageE ?? propStorageWh ?? 4250
  const storageCapacity = powerManager?.storageCapacity ?? propStorageCapacity ?? 5000
  const voltage = powerManager?.voltage ?? propVoltage

  const [mode, setMode] = useState<VoltMeterMode>(initialMode)
  const [displayValue, setDisplayValue] = useState('--.-')
  const [isBooting, setIsBooting] = useState(true)
  const [flickerIntensity, setFlickerIntensity] = useState(1)

  // Calculate derived values
  const powerBalance = totalGeneration - totalConsumption
  const loadPercent = totalGeneration > 0 ? Math.round((totalConsumption / totalGeneration) * 100) : 0

  // Calculate voltage from power balance (base 120V, scales based on balance)
  const calculatedVoltage = voltage ?? (() => {
    if (totalGeneration === 0) return 0
    const balancePercent = powerBalance / totalGeneration
    return 120 + (balancePercent * 20)
  })()

  // Mode definitions with labels and value getters
  // Units: E/s (Energy per second) per GD_SPEC_device-power_v1_0.md
  const modeConfig: Record<VoltMeterMode, { label: string; getValue: () => string; unit?: string }> = {
    VOLT: {
      label: 'VOLT',
      getValue: () => calculatedVoltage.toFixed(1),
    },
    GEN: {
      label: 'GEN',
      getValue: () => totalGeneration.toFixed(1),
      unit: 'E/s',
    },
    LOAD: {
      label: 'LOAD',
      getValue: () => totalConsumption.toFixed(1),
      unit: 'E/s',
    },
    BAL: {
      label: 'BAL',
      getValue: () => (powerBalance >= 0 ? '+' : '') + powerBalance.toFixed(1),
      unit: 'E/s',
    },
    BAT: {
      label: 'BAT',
      getValue: () => String(storagePercent),
      unit: '%',
    },
    LPCT: {
      label: 'LPCT',
      getValue: () => String(loadPercent),
      unit: '%',
    },
  }

  const modeOrder: VoltMeterMode[] = ['VOLT', 'GEN', 'LOAD', 'BAL', 'BAT', 'LPCT']

  // Cycle to next mode
  const cycleMode = () => {
    const currentIndex = modeOrder.indexOf(mode)
    const nextIndex = (currentIndex + 1) % modeOrder.length
    setMode(modeOrder[nextIndex])
  }

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setIsBooting(true)
      setDisplayValue('--.-')
      await new Promise(r => setTimeout(r, 200))
      setDisplayValue('888')
      await new Promise(r => setTimeout(r, 150))
      setDisplayValue('--.-')
      await new Promise(r => setTimeout(r, 100))
      setDisplayValue(modeConfig[mode].getValue())
      setIsBooting(false)
    }
    bootSequence()
  }, [])

  // Update display when mode or values change
  useEffect(() => {
    if (!isBooting) {
      setDisplayValue(modeConfig[mode].getValue())
    }
  }, [mode, totalGeneration, totalConsumption, storagePercent, calculatedVoltage, isBooting])

  // Subtle flicker effect for realism
  useEffect(() => {
    const flickerInterval = setInterval(() => {
      setFlickerIntensity(0.95 + Math.random() * 0.1)
    }, 100 + Math.random() * 200)
    return () => clearInterval(flickerInterval)
  }, [])

  // Determine status color based on current mode and value
  const getStatus = (): 'normal' | 'warning' | 'critical' => {
    switch (mode) {
      case 'VOLT':
        if (calculatedVoltage < 100 || calculatedVoltage > 150) return 'critical'
        if (calculatedVoltage < 115 || calculatedVoltage > 140) return 'warning'
        return 'normal'
      case 'LOAD':
      case 'LPCT':
        if (loadPercent > 95) return 'critical'
        if (loadPercent > 80) return 'warning'
        return 'normal'
      case 'BAL':
        if (powerBalance < -50) return 'critical'
        if (powerBalance < 0) return 'warning'
        return 'normal'
      case 'BAT':
        if (storagePercent < 10) return 'critical'
        if (storagePercent < 25) return 'warning'
        return 'normal'
      default:
        return 'normal'
    }
  }

  const status = getStatus()
  const currentConfig = modeConfig[mode]

  return (
    <div
      className={cn(
        'relative inline-flex items-center gap-0.5 rounded-sm overflow-hidden',
        className
      )}
      style={{
        background: 'linear-gradient(180deg, #1a1208 0%, #0d0904 50%, #080602 100%)',
        border: '1px solid #3a3020',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(60,50,30,0.2)',
        padding: '3px 6px',
      }}
    >
      {/* Mode switch button (left side) */}
      <button
        onClick={cycleMode}
        className="mr-1 flex items-center justify-center transition-all active:scale-95"
        style={{
          width: '10px',
          height: '10px',
          background: 'linear-gradient(180deg, #3a3020 0%, #2a2010 50%, #1a1008 100%)',
          border: '1px solid #4a4030',
          borderRadius: '2px',
          boxShadow: 'inset 0 1px 1px rgba(255,200,100,0.1), 0 1px 2px rgba(0,0,0,0.5)',
        }}
        title="Switch display mode"
      >
        <div
          className="w-1 h-1 rounded-full"
          style={{
            background: '#ffaa00',
            boxShadow: '0 0 3px #ffaa00',
          }}
        />
      </button>

      {/* Label */}
      <span
        className="font-mono text-[8px] tracking-wider select-none min-w-[24px]"
        style={{
          color: '#ffaa00',
          textShadow: '0 0 4px rgba(255,170,0,0.5)',
          opacity: flickerIntensity,
        }}
      >
        {currentConfig.label}
      </span>

      {/* 7-segment style display */}
      <div
        className="font-mono text-[11px] font-bold tracking-tight ml-1 select-none min-w-[40px] text-right"
        style={{
          fontFamily: "'DSEG7 Classic', 'Courier New', monospace",
          color: status === 'critical' ? '#ff4444' :
                 status === 'warning' ? '#ffaa00' : '#ffbb22',
          textShadow: status === 'critical'
            ? '0 0 8px rgba(255,68,68,0.8), 0 0 16px rgba(255,68,68,0.4)'
            : status === 'warning'
            ? '0 0 8px rgba(255,170,0,0.8), 0 0 16px rgba(255,170,0,0.4)'
            : '0 0 8px rgba(255,187,34,0.8), 0 0 16px rgba(255,170,0,0.4)',
          opacity: flickerIntensity,
          letterSpacing: '0.5px',
        }}
      >
        {displayValue}
      </div>

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)',
        }}
      />

      {/* Glass reflection */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)',
        }}
      />

      {/* Status indicator dot */}
      <div
        className="absolute top-1 right-1 w-1 h-1 rounded-full"
        style={{
          background: status === 'critical' ? '#ff4444' :
                     status === 'warning' ? '#ffaa00' : '#44ff44',
          boxShadow: status === 'critical'
            ? '0 0 4px #ff4444'
            : status === 'warning'
            ? '0 0 4px #ffaa00'
            : '0 0 4px #44ff44',
          animationName: status !== 'normal' ? 'volt-blink' : 'none',
          animationDuration: status === 'critical' ? '0.3s' : '1s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        }}
      />

      <style jsx global>{`
        @keyframes volt-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

// ==================================================
// POWER DISPLAY - Full power monitoring panel
// Device ID: PWD-001 | Version: 1.0.0
// Compatible: PWR-001, VLT-001, all power devices
// Shows generation, consumption, and balance metrics
// ==================================================
interface PowerDisplayProps {
  totalGeneration?: number
  totalConsumption?: number
  storagePercent?: number
  className?: string
}

export function PowerDisplay({
  totalGeneration = 650,
  totalConsumption = 522,
  storagePercent = 85,
  className,
}: PowerDisplayProps) {
  const [isBooting, setIsBooting] = useState(true)
  const [displayGen, setDisplayGen] = useState('---')
  const [displayCon, setDisplayCon] = useState('---')
  const [displayBat, setDisplayBat] = useState('--')

  const powerBalance = totalGeneration - totalConsumption
  const loadPercent = Math.round((totalConsumption / totalGeneration) * 100)

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setIsBooting(true)
      await new Promise(r => setTimeout(r, 300))
      setDisplayGen(String(totalGeneration))
      await new Promise(r => setTimeout(r, 200))
      setDisplayCon(String(totalConsumption))
      await new Promise(r => setTimeout(r, 200))
      setDisplayBat(String(storagePercent))
      setIsBooting(false)
    }
    bootSequence()
  }, [])

  // Update when values change
  useEffect(() => {
    if (!isBooting) {
      setDisplayGen(String(totalGeneration))
      setDisplayCon(String(totalConsumption))
      setDisplayBat(String(storagePercent))
    }
  }, [totalGeneration, totalConsumption, storagePercent, isBooting])

  const getLoadColor = () => {
    if (loadPercent > 95) return '#ff4444'
    if (loadPercent > 80) return '#ffaa00'
    return '#44ff88'
  }

  return (
    <PanelFrame
      variant="default"
      className={cn('p-2', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--neon-amber)]">
          PWR-001
        </div>
        <LED on={!isBooting} color="green" size="sm" />
      </div>

      {/* Volt Meter */}
      <div className="mb-2">
        <VoltMeter
          totalGeneration={totalGeneration}
          totalConsumption={totalConsumption}
          storagePercent={storagePercent}
        />
      </div>

      {/* Power metrics */}
      <div className="space-y-1 text-[7px] font-mono">
        {/* Generation */}
        <div className="flex items-center justify-between">
          <span className="text-white/50">GEN</span>
          <span className="text-[var(--neon-green)]">{displayGen}W</span>
        </div>

        {/* Consumption */}
        <div className="flex items-center justify-between">
          <span className="text-white/50">LOAD</span>
          <span style={{ color: getLoadColor() }}>{displayCon}W</span>
        </div>

        {/* Balance bar */}
        <div className="mt-1">
          <div className="flex items-center justify-between text-[6px] mb-0.5">
            <span className="text-white/40">LOAD</span>
            <span className="text-white/40">{loadPercent}%</span>
          </div>
          <div
            className="h-1.5 rounded-sm overflow-hidden"
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
            }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, loadPercent)}%`,
                background: `linear-gradient(90deg, ${getLoadColor()}88, ${getLoadColor()})`,
                boxShadow: `0 0 4px ${getLoadColor()}`,
              }}
            />
          </div>
        </div>

        {/* Battery */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-white/50">BAT</span>
          <div className="flex items-center gap-1">
            <div
              className="w-6 h-2 rounded-sm overflow-hidden"
              style={{
                background: '#1a1a1a',
                border: '1px solid #333',
              }}
            >
              <div
                className="h-full"
                style={{
                  width: `${storagePercent}%`,
                  background: storagePercent > 20
                    ? 'linear-gradient(90deg, #44ff8888, #44ff88)'
                    : 'linear-gradient(90deg, #ff444488, #ff4444)',
                  boxShadow: storagePercent > 20
                    ? '0 0 4px #44ff88'
                    : '0 0 4px #ff4444',
                }}
              />
            </div>
            <span className="text-[var(--neon-cyan)]">{displayBat}%</span>
          </div>
        </div>
      </div>

      {/* Status line */}
      <div className="mt-1.5 pt-1 border-t border-white/10">
        <div className="flex items-center justify-between text-[5px] font-mono">
          <span className={cn(
            powerBalance >= 0 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-red)]'
          )}>
            {powerBalance >= 0 ? 'NOMINAL' : 'DEFICIT'}
          </span>
          <span className="text-white/30">PWR-MGR v1.0</span>
        </div>
      </div>
    </PanelFrame>
  )
}

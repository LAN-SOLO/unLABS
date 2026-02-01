'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { Knob } from '../controls/Knob'
import { LED } from '../controls/LED'
import { usePowerManagerOptional } from '@/contexts/PowerManager'
import { usePWBManagerOptional } from '@/contexts/PWBManager'
import { useBTKManagerOptional } from '@/contexts/BTKManager'
import { useRMGManagerOptional } from '@/contexts/RMGManager'
import { useMSCManagerOptional } from '@/contexts/MSCManager'
import { useNETManagerOptional } from '@/contexts/NETManager'
import { useTMPManagerOptional } from '@/contexts/TMPManager'
import { useDIMManagerOptional } from '@/contexts/DIMManager'
import { useCPUManagerOptional } from '@/contexts/CPUManager'
import { useCLKManagerOptional } from '@/contexts/CLKManager'
import { useMEMManagerOptional } from '@/contexts/MEMManager'
import { useANDManagerOptional } from '@/contexts/ANDManager'
import { useQCPManagerOptional } from '@/contexts/QCPManager'
import { useTLPManagerOptional } from '@/contexts/TLPManager'
import { useLCTManagerOptional } from '@/contexts/LCTManager'
import { useP3DManagerOptional } from '@/contexts/P3DManager'
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
// CRYSTAL DATA CACHE - CDC-001
// Uses CDCManager context for bidirectional sync with terminal
// Firmware: v1.4.2 | Tech Tree: Tech Tier 1
// Function: Crystalline data storage for research archives
// Power: Full 15 E/s | Idle 5 E/s | Standby 1 E/s
// ==================================================
import { CDC_FIRMWARE, CDC_POWER_SPECS, useCDCManagerOptional } from '@/contexts/CDCManager'

interface CrystalDataCacheProps {
  crystalCount?: number
  sliceCount?: number
  totalPower?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
  onPowerChange?: (isOn: boolean) => void
}

export function CrystalDataCache({
  crystalCount = 0,
  sliceCount = 0,
  totalPower = 0,
  className,
  onTest,
  onReset,
  onPowerChange,
}: CrystalDataCacheProps) {
  // Use shared CDCManager context for bidirectional sync
  const cdcManager = useCDCManagerOptional()

  // Local state fallback when CDCManager not available
  const [localDeviceState, setLocalDeviceState] = useState<'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'>('booting')
  const [localBootPhase, setLocalBootPhase] = useState(0)
  const [localTestPhase, setLocalTestPhase] = useState<'memory' | 'bus' | 'cache' | 'power' | 'protocol' | 'complete' | null>(null)
  const [localShutdownPhase, setLocalShutdownPhase] = useState<'saving' | 'flushing' | 'releasing' | 'halted' | null>(null)
  const [localTestResult, setLocalTestResult] = useState<'pass' | 'fail' | null>(null)
  const [localStatusMessage, setLocalStatusMessage] = useState('Initializing...')
  const [localDisplayValues, setLocalDisplayValues] = useState({ crystals: '--', slices: '--', power: '--' })
  const [localIsPowered, setLocalIsPowered] = useState(true)

  // Use context state if available, otherwise local state
  const deviceState = cdcManager?.deviceState ?? localDeviceState
  const bootPhase = cdcManager?.bootPhase ?? (localBootPhase > 0 ? ['post', 'memory', 'cache', 'bus', 'sync', 'ready'][localBootPhase - 1] as 'post' | 'memory' | 'cache' | 'bus' | 'sync' | 'ready' : null)
  const testPhase = cdcManager?.testPhase ?? localTestPhase
  const shutdownPhase = cdcManager?.shutdownPhase ?? localShutdownPhase
  const testResult = cdcManager?.testResult ?? localTestResult
  const statusMessage = cdcManager?.statusMessage ?? localStatusMessage
  const isPowered = cdcManager?.isPowered ?? localIsPowered

  // Display values
  const displayValues = cdcManager ? {
    crystals: deviceState === 'standby' ? '0' : String(cdcManager.crystalCount),
    slices: deviceState === 'standby' ? '0' : String(cdcManager.sliceCount),
    power: deviceState === 'standby' ? '0.0' : cdcManager.totalPower.toFixed(1),
  } : localDisplayValues

  const bootPhaseNum = cdcManager ?
    (bootPhase === 'post' ? 1 : bootPhase === 'memory' ? 2 : bootPhase === 'cache' ? 3 : bootPhase === 'bus' ? 4 : bootPhase === 'sync' ? 5 : bootPhase === 'ready' ? 6 : 0)
    : localBootPhase

  const status = crystalCount > 0 ? 'active' : 'idle'

  // Update CDCManager with prop data when available
  useEffect(() => {
    if (cdcManager) {
      cdcManager.updateData(crystalCount, sliceCount, totalPower)
    }
  }, [cdcManager, crystalCount, sliceCount, totalPower])

  // Local boot sequence (fallback when no CDCManager)
  const runLocalBootSequence = useCallback(async () => {
    setLocalDeviceState('booting')
    setLocalStatusMessage('POST check...')
    setLocalBootPhase(1)
    await new Promise(r => setTimeout(r, 300))

    setLocalStatusMessage('Memory init...')
    setLocalBootPhase(2)
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Cache allocate...')
    setLocalBootPhase(3)
    await new Promise(r => setTimeout(r, 300))

    setLocalStatusMessage('Bus connect...')
    setLocalBootPhase(4)
    setLocalDisplayValues({ crystals: '0', slices: '0', power: '0.0' })
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Data sync...')
    setLocalBootPhase(5)
    await new Promise(r => setTimeout(r, 400))

    setLocalDisplayValues({
      crystals: String(crystalCount),
      slices: String(sliceCount),
      power: totalPower.toFixed(1),
    })
    setLocalBootPhase(6)
    setLocalDeviceState('online')
    setLocalStatusMessage(crystalCount > 0 ? 'Cache synchronized' : 'Awaiting data')
  }, [crystalCount, sliceCount, totalPower])

  // Local shutdown sequence (fallback)
  const runLocalShutdownSequence = useCallback(async () => {
    setLocalDeviceState('shutdown')

    setLocalShutdownPhase('saving')
    setLocalStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 300))

    setLocalShutdownPhase('flushing')
    setLocalStatusMessage('Flushing buffers...')
    setLocalDisplayValues({ crystals: '--', slices: '--', power: '--' })
    await new Promise(r => setTimeout(r, 300))

    setLocalShutdownPhase('releasing')
    setLocalStatusMessage('Releasing resources...')
    setLocalBootPhase(0)
    await new Promise(r => setTimeout(r, 300))

    setLocalShutdownPhase('halted')
    setLocalStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setLocalShutdownPhase(null)
    setLocalDeviceState('standby')
    setLocalStatusMessage('Standby mode')
  }, [])

  // Boot on mount (local fallback only)
  useEffect(() => {
    if (!cdcManager && localIsPowered) {
      runLocalBootSequence()
    }
  }, []) // Only run on mount

  // Update local display values when props change (local fallback)
  useEffect(() => {
    if (!cdcManager && localDeviceState === 'online') {
      setLocalDisplayValues({
        crystals: String(crystalCount),
        slices: String(sliceCount),
        power: totalPower.toFixed(1),
      })
      setLocalStatusMessage(crystalCount > 0 ? 'Cache synchronized' : 'Awaiting data')
    }
  }, [cdcManager, crystalCount, sliceCount, totalPower, localDeviceState])

  // Power toggle handler - uses context or local
  const handlePowerToggle = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting') return

    if (cdcManager) {
      // Use shared context
      if (isPowered && deviceState !== 'standby') {
        await cdcManager.powerOff()
        onPowerChange?.(false)
      } else {
        await cdcManager.powerOn()
        onPowerChange?.(true)
      }
    } else {
      // Local fallback
      if (localIsPowered && localDeviceState !== 'standby') {
        setLocalIsPowered(false)
        await runLocalShutdownSequence()
        onPowerChange?.(false)
      } else {
        setLocalIsPowered(true)
        await runLocalBootSequence()
        onPowerChange?.(true)
      }
    }
  }, [cdcManager, isPowered, deviceState, localIsPowered, localDeviceState, runLocalShutdownSequence, runLocalBootSequence, onPowerChange])

  // Test handler - uses context or local
  const handleTest = async () => {
    if (deviceState !== 'online') return

    if (cdcManager) {
      await cdcManager.runTest()
      onTest?.()
    } else {
      // Local fallback
      setLocalDeviceState('testing')
      setLocalTestResult(null)

      const phases: ('memory' | 'bus' | 'cache' | 'power' | 'protocol' | 'complete')[] = ['memory', 'bus', 'cache', 'power', 'protocol', 'complete']
      const phaseMessages: Record<string, string> = {
        memory: 'Testing memory integrity...',
        bus: 'Testing data bus...',
        cache: 'Verifying cache coherence...',
        power: 'Checking power supply...',
        protocol: 'Testing protocol...',
        complete: 'Diagnostics complete',
      }

      for (const phase of phases) {
        setLocalTestPhase(phase)
        setLocalStatusMessage(phaseMessages[phase])
        await new Promise(r => setTimeout(r, 400))
      }

      setLocalTestResult('pass')
      setLocalTestPhase(null)
      setLocalDeviceState('online')
      setLocalStatusMessage('All tests PASSED')
      onTest?.()

      setTimeout(() => {
        setLocalTestResult(null)
        setLocalStatusMessage(crystalCount > 0 ? 'Cache synchronized' : 'Awaiting data')
      }, 3000)
    }
  }

  // Reboot handler - uses context or local
  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    if (cdcManager) {
      await cdcManager.reboot()
      onReset?.()
    } else {
      // Local fallback
      setLocalDeviceState('rebooting')
      setLocalTestResult(null)

      setLocalStatusMessage('Shutting down...')
      await new Promise(r => setTimeout(r, 300))

      setLocalStatusMessage('Flushing buffers...')
      setLocalDisplayValues({ crystals: '--', slices: '--', power: '--' })
      await new Promise(r => setTimeout(r, 300))

      setLocalStatusMessage('Releasing resources...')
      setLocalBootPhase(0)
      await new Promise(r => setTimeout(r, 300))

      setLocalStatusMessage('System halted')
      await new Promise(r => setTimeout(r, 400))

      await runLocalBootSequence()
      onReset?.()
    }
  }

  // LED color based on state
  const getLedColor = () => {
    if (deviceState === 'standby') return 'amber'
    if (deviceState === 'shutdown' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : 'amber'
  }

  const isLedOn = deviceState !== 'shutdown' || shutdownPhase !== null

  // Fold state from context
  const isExpanded = cdcManager?.isExpanded ?? true
  const handleToggleExpand = () => cdcManager?.toggleExpanded()

  // Folded info toggle (local, with 5-min inactivity auto-close)
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = () => {
    const next = !showFoldedInfo
    setShowFoldedInfo(next)
    if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
    if (next) {
      foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
    }
  }

  // Auto-close folded info when powered off
  useEffect(() => {
    if (!isPowered) setShowFoldedInfo(false)
  }, [isPowered])

  // Cleanup timer
  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  // State label for folded display
  const stateLabel = deviceState === 'standby' ? 'STANDBY' :
    deviceState === 'booting' ? 'BOOTING' :
    deviceState === 'testing' ? 'TESTING' :
    deviceState === 'rebooting' ? 'REBOOT' :
    deviceState === 'shutdown' ? 'SHUTDOWN' : 'ONLINE'

  const isTransitioning = deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'

  // Shared micro button style helper
  const microBtnClass = (active: boolean, color: string) => cn(
    'w-3.5 h-3 rounded-sm font-mono text-[5px] transition-all border flex items-center justify-center shrink-0',
    active
      ? `bg-[var(--neon-${color})]/20 text-[var(--neon-${color})] border-[var(--neon-${color})]/50`
      : 'bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20 disabled:opacity-30'
  )

  return (
    <PanelFrame
      variant="default"
      className={cn('relative overflow-hidden', className)}
      style={{ perspective: '600px' }}
    >
      {/* ═══ FOLDED FRONT PANEL ═══ */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 400ms cubic-bezier(0.4,0,0.2,1), opacity 350ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
        }}
        className="w-full"
      >
        <div className="p-1.5 px-2">
          {/* Main folded row */}
          <div className="flex items-center gap-1.5">
            <LED on={isLedOn} color={getLedColor()} size="sm" />
            <span className="font-mono text-[8px] text-[var(--neon-amber)] tracking-wider font-bold">CDC-001</span>
            <span className={cn(
              'font-mono text-[6px] tracking-wide',
              deviceState === 'online' ? 'text-[var(--neon-green)]' :
              deviceState === 'standby' ? 'text-white/40' :
              'text-[var(--neon-amber)]'
            )}>
              {stateLabel}
            </span>
            <div className="flex-1" />

            {/* Folded action buttons — only show T/R when powered */}
            {isPowered && deviceState !== 'standby' && (
              <>
                <button
                  onClick={handleTest}
                  disabled={deviceState !== 'online'}
                  className={microBtnClass(deviceState === 'testing', 'cyan')}
                  title="Test"
                >
                  {deviceState === 'testing' ? '·' : testResult === 'pass' ? '✓' : testResult === 'fail' ? '✗' : 'T'}
                </button>
                <button
                  onClick={handleReboot}
                  disabled={isTransitioning}
                  className={microBtnClass(deviceState === 'rebooting' || deviceState === 'booting', 'amber')}
                  title="Reboot"
                >
                  {deviceState === 'rebooting' || deviceState === 'booting' ? '·' : 'R'}
                </button>
              </>
            )}

            {/* Power button */}
            <button
              onClick={handlePowerToggle}
              disabled={isTransitioning}
              className="w-3.5 h-3 rounded-sm font-mono text-[5px] transition-all border flex items-center justify-center shrink-0"
              style={{
                background: isPowered && deviceState !== 'standby' ? 'rgba(0,255,102,0.15)' : '#0a0a0f',
                color: isPowered && deviceState !== 'standby' ? 'var(--neon-green)' : 'rgba(255,255,255,0.4)',
                borderColor: isPowered && deviceState !== 'standby' ? 'rgba(0,255,102,0.5)' : 'rgba(255,255,255,0.1)',
              }}
              title={isPowered && deviceState !== 'standby' ? 'Power Off' : 'Power On'}
            >
              ⏻
            </button>

            {/* Info toggle / Unfold chevron */}
            {isPowered && deviceState !== 'standby' ? (
              <button
                onClick={showFoldedInfo ? () => { setShowFoldedInfo(false); handleToggleExpand() } : toggleFoldedInfo}
                className="w-3.5 h-3 rounded-sm font-mono text-[6px] transition-all border flex items-center justify-center shrink-0 bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20"
                title={showFoldedInfo ? 'Unfold' : 'More info'}
              >
                {showFoldedInfo ? '▲' : '▼'}
              </button>
            ) : (
              <button
                onClick={handleToggleExpand}
                className="w-3.5 h-3 rounded-sm font-mono text-[6px] transition-all border flex items-center justify-center shrink-0 bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20"
                title="Unfold"
              >
                ▼
              </button>
            )}
          </div>

          {/* Folded info expansion */}
          <div
            style={{
              maxHeight: showFoldedInfo ? '48px' : '0px',
              transition: 'max-height 300ms ease, opacity 300ms ease',
              opacity: showFoldedInfo ? 1 : 0,
              overflow: 'hidden',
            }}
          >
            <div className="mt-1 pt-1 border-t border-white/5 grid grid-cols-3 gap-2">
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Crystals </span>
                <span className="text-[var(--neon-green)]">{displayValues.crystals}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Slices </span>
                <span className="text-[var(--neon-cyan)]">{displayValues.slices}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Power </span>
                <span className="text-[var(--neon-amber)]">{displayValues.power}</span>
              </div>
            </div>
            <div className="mt-0.5 grid grid-cols-3 gap-2">
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Mode </span>
                <span className="text-white/50">{deviceState === 'testing' ? 'DIAG' : 'IDLE'}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Draw </span>
                <span className="text-white/50">{cdcManager?.currentDraw ?? 5}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Tier </span>
                <span className="text-white/50">T1</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ UNFOLDED INNER PANEL ═══ */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 400ms cubic-bezier(0.4,0,0.2,1), opacity 350ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
        }}
        className="w-full p-2"
      >
        {/* Top-right buttons: fold chevron + power */}
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
          <button
            onClick={handleToggleExpand}
            className="group"
            title="Fold"
          >
            <div
              className="w-2.5 h-2.5 rounded-sm border transition-all flex items-center justify-center"
              style={{
                background: '#0a0a0f',
                borderColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <span className="font-mono text-[5px] text-white/40 group-hover:text-white/70 transition-colors">▲</span>
            </div>
          </button>
          <button
            onClick={handlePowerToggle}
            disabled={isTransitioning}
            className="group"
            title={isPowered && deviceState !== 'standby' ? 'Power Off' : 'Power On'}
          >
            <div
              className="w-2.5 h-2.5 rounded-full border transition-all flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: isPowered && deviceState !== 'standby'
                  ? 'var(--neon-green)'
                  : deviceState === 'standby' ? 'var(--neon-amber)' : '#3a3a4a',
                boxShadow: isPowered && deviceState !== 'standby'
                  ? '0 0 4px var(--neon-green), inset 0 0 2px rgba(0,255,0,0.3)'
                  : deviceState === 'standby' ? '0 0 3px var(--neon-amber)' : 'none',
              }}
            >
              <div
                className="w-1 h-1 rounded-full"
                style={{
                  backgroundColor: isPowered && deviceState !== 'standby'
                    ? 'var(--neon-green)'
                    : deviceState === 'standby' ? 'var(--neon-amber)' : '#333',
                }}
              />
            </div>
          </button>
        </div>

        {/* Header with status LED */}
        <div className="flex items-center justify-between mb-1.5 pr-12">
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
          <div className="font-mono text-[5px] text-white/20">CDC-001</div>
        </div>

        {/* Data display grid */}
        <div className="grid grid-cols-3 gap-1 mb-1.5">
          <div className="bg-black/40 p-1 rounded border border-white/5 relative overflow-hidden">
            <div className="font-mono text-[6px] text-white/40">Crystals</div>
            <div
              className={cn(
                'font-mono text-sm tabular-nums transition-all duration-300',
                (deviceState === 'booting' && bootPhaseNum < 4) || deviceState === 'standby' ? 'opacity-50' : ''
              )}
              style={{
                color: 'var(--neon-green)',
                textShadow: displayValues.crystals !== '--' && displayValues.crystals !== '0' ? '0 0 6px var(--neon-green)' : 'none',
              }}
            >
              {deviceState === 'standby' ? '0' : displayValues.crystals}
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
                (deviceState === 'booting' && bootPhaseNum < 4) || deviceState === 'standby' ? 'opacity-50' : ''
              )}
              style={{
                color: 'var(--neon-cyan)',
                textShadow: displayValues.slices !== '--' && displayValues.slices !== '0' ? '0 0 6px var(--neon-cyan)' : 'none',
              }}
            >
              {deviceState === 'standby' ? '0' : displayValues.slices}
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
                (deviceState === 'booting' && bootPhaseNum < 4) || deviceState === 'standby' ? 'opacity-50' : ''
              )}
              style={{
                color: 'var(--neon-amber)',
                textShadow: displayValues.power !== '--' && displayValues.power !== '0.0' ? '0 0 6px var(--neon-amber)' : 'none',
              }}
            >
              {deviceState === 'standby' ? '0.0' : displayValues.power}
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
            deviceState === 'rebooting' || deviceState === 'booting' || deviceState === 'shutdown' ? 'text-[var(--neon-amber)]' :
            deviceState === 'standby' ? 'text-white/40' :
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
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown'}
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
      </div>
    </PanelFrame>
  )
}

// Export firmware and power specs for terminal access
export { CDC_FIRMWARE, CDC_POWER_SPECS }

// ==================================================
// ENERGY CORE - UEC-001
// Uses UECManager context for bidirectional sync with terminal
// Firmware: v2.0.1 | Power Generator Device
// Function: Converts blockchain volatility to energy output
// Output: 100 E/s per tier | Self-consume: 10 E/s | Standby: 2 E/s
// ==================================================
import { UEC_FIRMWARE, UEC_POWER_SPECS, useUECManagerOptional } from '@/contexts/UECManager'

interface EnergyCoreProps {
  volatilityTier?: number
  tps?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
  onPowerChange?: (isOn: boolean) => void
}

export function EnergyCore({
  volatilityTier = 1,
  tps = 1000,
  className,
  onTest,
  onReset,
  onPowerChange,
}: EnergyCoreProps) {
  // Use shared UECManager context for bidirectional sync
  const uecManager = useUECManagerOptional()

  // Local state fallback when UECManager not available
  const [localDeviceState, setLocalDeviceState] = useState<'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'>('booting')
  const [localBootPhase, setLocalBootPhase] = useState(0)
  const [localTestPhase, setLocalTestPhase] = useState<'voltage' | 'frequency' | 'stability' | 'output' | 'sync' | 'complete' | null>(null)
  const [localShutdownPhase, setLocalShutdownPhase] = useState<'draining' | 'releasing' | 'halted' | null>(null)
  const [localTestResult, setLocalTestResult] = useState<'pass' | 'fail' | null>(null)
  const [localStatusMessage, setLocalStatusMessage] = useState('Initializing...')
  const [localIsPowered, setLocalIsPowered] = useState(true)
  const [localDisplayValues, setLocalDisplayValues] = useState({ tier: '--', level: 0, tps: '----' })

  // Use context state if available, otherwise local state
  const deviceState = uecManager?.deviceState ?? localDeviceState
  const bootPhase = uecManager?.bootPhase
  const testPhase = uecManager?.testPhase ?? localTestPhase
  const shutdownPhase = uecManager?.shutdownPhase ?? localShutdownPhase
  const testResult = uecManager?.testResult ?? localTestResult
  const statusMessage = uecManager?.statusMessage ?? localStatusMessage
  const isPowered = uecManager?.isPowered ?? localIsPowered

  // Energy level based on volatility tier (1-5 maps to 20-100%)
  const energyLevel = volatilityTier * 20
  const status = volatilityTier >= 3 ? 'active' : volatilityTier >= 2 ? 'standby' : 'offline'

  // Display values from context or local
  const displayValues = uecManager ? {
    tier: deviceState === 'standby' ? '--' : `T${uecManager.volatilityTier}`,
    level: deviceState === 'standby' ? 0 : uecManager.volatilityTier * 20,
    tps: deviceState === 'standby' ? '----' : uecManager.tps.toLocaleString(),
  } : localDisplayValues

  const bootPhaseNum = uecManager ?
    (bootPhase === 'post' ? 1 : bootPhase === 'voltage' ? 2 : bootPhase === 'frequency' ? 3 : bootPhase === 'network' ? 4 : bootPhase === 'stabilize' ? 5 : bootPhase === 'ready' ? 6 : 0)
    : localBootPhase

  // Update UECManager with prop data when available
  useEffect(() => {
    if (uecManager) {
      uecManager.updateVolatility(volatilityTier, tps)
    }
  }, [uecManager, volatilityTier, tps])

  // Local boot sequence (fallback when no UECManager)
  const runLocalBootSequence = useCallback(async () => {
    setLocalDeviceState('booting')
    setLocalStatusMessage('POST check...')
    setLocalBootPhase(1)
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Voltage calibration...')
    setLocalBootPhase(2)
    await new Promise(r => setTimeout(r, 300))

    setLocalStatusMessage('Frequency sync...')
    setLocalBootPhase(3)
    setLocalDisplayValues(prev => ({ ...prev, tier: '0', level: 0 }))
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Network connect...')
    setLocalBootPhase(4)
    setLocalDisplayValues(prev => ({ ...prev, tps: '0' }))
    await new Promise(r => setTimeout(r, 300))

    setLocalStatusMessage('Energy stabilize...')
    setLocalBootPhase(5)
    await new Promise(r => setTimeout(r, 350))

    setLocalDisplayValues({
      tier: `T${volatilityTier}`,
      level: energyLevel,
      tps: tps.toLocaleString(),
    })
    setLocalBootPhase(6)
    setLocalDeviceState('online')
    setLocalStatusMessage('Core stable')
  }, [volatilityTier, energyLevel, tps])

  // Local shutdown sequence (fallback)
  const runLocalShutdownSequence = useCallback(async () => {
    setLocalDeviceState('shutdown')

    setLocalShutdownPhase('draining')
    setLocalStatusMessage('Draining capacitors...')
    await new Promise(r => setTimeout(r, 300))

    setLocalShutdownPhase('releasing')
    setLocalStatusMessage('Releasing field...')
    setLocalDisplayValues({ tier: '--', level: 0, tps: '----' })
    await new Promise(r => setTimeout(r, 300))

    setLocalShutdownPhase('halted')
    setLocalStatusMessage('Core halted')
    await new Promise(r => setTimeout(r, 200))

    setLocalShutdownPhase(null)
    setLocalDeviceState('standby')
    setLocalStatusMessage('Standby mode')
  }, [])

  // Boot on mount (local fallback only)
  useEffect(() => {
    if (!uecManager && localIsPowered) {
      runLocalBootSequence()
    }
  }, []) // Only run on mount

  // Update local display values when props change (local fallback)
  useEffect(() => {
    if (!uecManager && localDeviceState === 'online') {
      setLocalDisplayValues({
        tier: `T${volatilityTier}`,
        level: energyLevel,
        tps: tps.toLocaleString(),
      })
    }
  }, [uecManager, volatilityTier, tps, energyLevel, localDeviceState])

  // Power toggle handler
  const handlePowerToggle = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting') return

    if (uecManager) {
      if (isPowered && deviceState !== 'standby') {
        await uecManager.powerOff()
        onPowerChange?.(false)
      } else {
        await uecManager.powerOn()
        onPowerChange?.(true)
      }
    } else {
      if (localIsPowered && localDeviceState !== 'standby') {
        setLocalIsPowered(false)
        await runLocalShutdownSequence()
        onPowerChange?.(false)
      } else {
        setLocalIsPowered(true)
        await runLocalBootSequence()
        onPowerChange?.(true)
      }
    }
  }, [uecManager, isPowered, deviceState, localIsPowered, localDeviceState, runLocalShutdownSequence, runLocalBootSequence, onPowerChange])

  // Test handler
  const handleTest = async () => {
    if (deviceState !== 'online') return

    if (uecManager) {
      await uecManager.runTest()
      onTest?.()
    } else {
      setLocalDeviceState('testing')
      setLocalTestResult(null)

      const phases: ('voltage' | 'frequency' | 'stability' | 'output' | 'sync' | 'complete')[] = ['voltage', 'frequency', 'stability', 'output', 'sync', 'complete']
      const phaseMessages: Record<string, string> = {
        voltage: 'Testing voltage regulators...',
        frequency: 'Checking frequency sync...',
        stability: 'Verifying field stability...',
        output: 'Measuring power output...',
        sync: 'Testing network sync...',
        complete: 'Diagnostics complete',
      }

      for (const phase of phases) {
        setLocalTestPhase(phase)
        setLocalStatusMessage(phaseMessages[phase])
        await new Promise(r => setTimeout(r, 350))
      }

      setLocalTestResult('pass')
      setLocalTestPhase(null)
      setLocalDeviceState('online')
      setLocalStatusMessage('All tests PASSED')
      onTest?.()

      setTimeout(() => {
        setLocalTestResult(null)
        setLocalStatusMessage('Core stable')
      }, 3000)
    }
  }

  // Reboot handler
  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    if (uecManager) {
      await uecManager.reboot()
      onReset?.()
    } else {
      setLocalDeviceState('rebooting')
      setLocalTestResult(null)

      setLocalStatusMessage('Shutting down...')
      await new Promise(r => setTimeout(r, 250))

      setLocalStatusMessage('Draining capacitors...')
      setLocalDisplayValues({ tier: '--', level: 0, tps: '----' })
      await new Promise(r => setTimeout(r, 300))

      setLocalStatusMessage('Releasing field...')
      setLocalBootPhase(0)
      await new Promise(r => setTimeout(r, 250))

      setLocalStatusMessage('Core halted')
      await new Promise(r => setTimeout(r, 350))

      await runLocalBootSequence()
      onReset?.()
    }
  }

  // LED color based on state
  const getLedColor = () => {
    if (deviceState === 'standby') return 'amber'
    if (deviceState === 'shutdown' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = deviceState !== 'shutdown' || shutdownPhase !== null

  // Fold state from context
  const isExpanded = uecManager?.isExpanded ?? true
  const handleToggleExpand = () => uecManager?.toggleExpanded()

  // Folded info toggle (local, with 5-min inactivity auto-close)
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = () => {
    const next = !showFoldedInfo
    setShowFoldedInfo(next)
    if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
    if (next) {
      foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
    }
  }

  // Auto-close folded info when powered off
  useEffect(() => {
    if (!isPowered) setShowFoldedInfo(false)
  }, [isPowered])

  // Cleanup timer
  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  // State label for folded display
  const stateLabel = deviceState === 'standby' ? 'STANDBY' :
    deviceState === 'booting' ? 'BOOTING' :
    deviceState === 'testing' ? 'TESTING' :
    deviceState === 'rebooting' ? 'REBOOT' :
    deviceState === 'shutdown' ? 'SHUTDOWN' : 'ONLINE'

  const isTransitioning = deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'

  // Shared micro button style helper
  const microBtnClass = (active: boolean, color: string) => cn(
    'w-3.5 h-3 rounded-sm font-mono text-[5px] transition-all border flex items-center justify-center shrink-0',
    active
      ? `bg-[var(--neon-${color})]/20 text-[var(--neon-${color})] border-[var(--neon-${color})]/50`
      : 'bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20 disabled:opacity-30'
  )

  return (
    <PanelFrame
      variant="default"
      className={cn('relative overflow-hidden', className)}
      style={{ perspective: '600px' }}
    >
      {/* ═══ FOLDED FRONT PANEL ═══ */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 400ms cubic-bezier(0.4,0,0.2,1), opacity 350ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
        }}
        className="w-full"
      >
        <div className="p-1.5 px-2">
          {/* Main folded row */}
          <div className="flex items-center gap-1.5">
            <LED on={isLedOn} color={getLedColor()} size="sm" />
            <span className="font-mono text-[8px] text-[var(--neon-amber)] tracking-wider font-bold">UEC-001</span>
            <span className={cn(
              'font-mono text-[6px] tracking-wide',
              deviceState === 'online' ? 'text-[var(--neon-green)]' :
              deviceState === 'standby' ? 'text-white/40' :
              'text-[var(--neon-amber)]'
            )}>
              {stateLabel}
            </span>
            <div className="flex-1" />

            {/* Folded action buttons — only show T/R when powered */}
            {isPowered && deviceState !== 'standby' && (
              <>
                <button
                  onClick={handleTest}
                  disabled={deviceState !== 'online'}
                  className={microBtnClass(deviceState === 'testing', 'cyan')}
                  title="Test"
                >
                  {deviceState === 'testing' ? '·' : testResult === 'pass' ? '✓' : testResult === 'fail' ? '✗' : 'T'}
                </button>
                <button
                  onClick={handleReboot}
                  disabled={isTransitioning}
                  className={microBtnClass(deviceState === 'rebooting' || deviceState === 'booting', 'amber')}
                  title="Reboot"
                >
                  {deviceState === 'rebooting' || deviceState === 'booting' ? '·' : 'R'}
                </button>
              </>
            )}

            {/* Power button */}
            <button
              onClick={handlePowerToggle}
              disabled={isTransitioning}
              className="w-3.5 h-3 rounded-sm font-mono text-[5px] transition-all border flex items-center justify-center shrink-0"
              style={{
                background: isPowered && deviceState !== 'standby' ? 'rgba(255,184,0,0.15)' : '#0a0a0f',
                color: isPowered && deviceState !== 'standby' ? 'var(--neon-amber)' : 'rgba(255,255,255,0.4)',
                borderColor: isPowered && deviceState !== 'standby' ? 'rgba(255,184,0,0.5)' : 'rgba(255,255,255,0.1)',
              }}
              title={isPowered && deviceState !== 'standby' ? 'Power Off' : 'Power On'}
            >
              ⏻
            </button>

            {/* Info toggle / Unfold chevron */}
            {isPowered && deviceState !== 'standby' ? (
              <button
                onClick={showFoldedInfo ? () => { setShowFoldedInfo(false); handleToggleExpand() } : toggleFoldedInfo}
                className="w-3.5 h-3 rounded-sm font-mono text-[6px] transition-all border flex items-center justify-center shrink-0 bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20"
                title={showFoldedInfo ? 'Unfold' : 'More info'}
              >
                {showFoldedInfo ? '▲' : '▼'}
              </button>
            ) : (
              <button
                onClick={handleToggleExpand}
                className="w-3.5 h-3 rounded-sm font-mono text-[6px] transition-all border flex items-center justify-center shrink-0 bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20"
                title="Unfold"
              >
                ▼
              </button>
            )}
          </div>

          {/* Folded info expansion */}
          <div
            style={{
              maxHeight: showFoldedInfo ? '48px' : '0px',
              transition: 'max-height 300ms ease, opacity 300ms ease',
              opacity: showFoldedInfo ? 1 : 0,
              overflow: 'hidden',
            }}
          >
            <div className="mt-1 pt-1 border-t border-white/5 grid grid-cols-3 gap-2">
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Tier </span>
                <span className="text-[var(--neon-amber)]">{displayValues.tier}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">TPS </span>
                <span className="text-[var(--neon-cyan)]">{displayValues.tps}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Output </span>
                <span className="text-[var(--neon-green)]">{uecManager?.energyOutput ?? 0}</span>
              </div>
            </div>
            <div className="mt-0.5 grid grid-cols-3 gap-2">
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Draw </span>
                <span className="text-white/50">{UEC_POWER_SPECS.selfConsume}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Field </span>
                <span className="text-white/50">{uecManager?.fieldStability ?? 0}%</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Level </span>
                <span className="text-white/50">{displayValues.level}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ UNFOLDED INNER PANEL ═══ */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 400ms cubic-bezier(0.4,0,0.2,1), opacity 350ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
        }}
        className="w-full p-2"
      >
        {/* Top-right buttons: fold chevron + hexagonal power */}
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
          <button
            onClick={handleToggleExpand}
            className="group"
            title="Fold"
          >
            <div
              className="w-2.5 h-2.5 rounded-sm border transition-all flex items-center justify-center"
              style={{
                background: '#0a0a0f',
                borderColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <span className="font-mono text-[5px] text-white/40 group-hover:text-white/70 transition-colors">▲</span>
            </div>
          </button>
          <button
            onClick={handlePowerToggle}
            disabled={isTransitioning}
            className="group"
            title={isPowered && deviceState !== 'standby' ? 'Power Off' : 'Power On'}
          >
            <div
              className="w-3 h-3 relative flex items-center justify-center transition-all"
              style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                background: isPowered && deviceState !== 'standby'
                  ? 'linear-gradient(180deg, var(--neon-amber) 0%, var(--neon-orange) 100%)'
                  : deviceState === 'standby' ? 'linear-gradient(180deg, #4a3a0a 0%, #2a2a2a 100%)' : '#1a1a1a',
                boxShadow: isPowered && deviceState !== 'standby'
                  ? '0 0 6px var(--neon-amber), inset 0 0 3px rgba(255,200,0,0.5)'
                  : 'none',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: isPowered && deviceState !== 'standby'
                    ? 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,200,0,0.3) 100%)'
                    : deviceState === 'standby' ? 'radial-gradient(circle, rgba(255,180,0,0.3) 0%, transparent 100%)' : '#333',
                }}
              />
            </div>
            {isPowered && deviceState === 'online' && (
              <div
                className="absolute inset-0 animate-ping"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  background: 'var(--neon-amber)',
                  opacity: 0.3,
                }}
              />
            )}
          </button>
        </div>

        {/* Header with status LED */}
        <div className="flex items-center justify-between mb-1.5 pr-12">
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
          <div className="font-mono text-[5px] text-white/20">UEC-001</div>
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
                (deviceState === 'booting' && bootPhaseNum < 3) || deviceState === 'standby' ? 'opacity-50' : ''
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
            deviceState === 'rebooting' || deviceState === 'booting' || deviceState === 'shutdown' ? 'text-[var(--neon-amber)]' :
            deviceState === 'standby' ? 'text-white/40' :
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
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown'}
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

// Export UEC firmware and power specs for terminal access
export { UEC_FIRMWARE, UEC_POWER_SPECS }

// ==================================================
// BATTERY PACK - Shows user balance/staking
// Device ID: BAT-001 | Version: 1.8.0
// Compatible: EnergyCore, CrystalDataCache
// unOS Commands: bat [STATUS|TEST|RESET|POWER]
// Firmware: v1.8.0 | Features: cell-monitor, auto-regen, capacity-track, thermal-protect, cdc-handshake
// ==================================================
import { BAT_FIRMWARE, BAT_POWER_SPECS, useBATManagerOptional } from '@/contexts/BATManager'
import { HMS_FIRMWARE, HMS_POWER_SPECS, useHMSManagerOptional } from '@/contexts/HMSManager'
import { ECR_FIRMWARE, ECR_POWER_SPECS, useECRManagerOptional } from '@/contexts/ECRManager'
import { IPL_FIRMWARE, IPL_POWER_SPECS, useIPLManagerOptional } from '@/contexts/IPLManager'
import { MFR_FIRMWARE, MFR_POWER_SPECS, useMFRManagerOptional } from '@/contexts/MFRManager'

interface BatteryPackProps {
  available?: number
  staked?: number
  locked?: number
  className?: string
  onTest?: () => void
  onReset?: () => void
  onPowerChange?: (isOn: boolean) => void
}

type BatteryState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type BatteryTestPhase = 'cells' | 'voltage' | 'current' | 'capacity' | 'regen' | 'complete' | null
type BatteryShutdownPhase = 'saving' | 'disconnect' | 'hibernate' | null

export function BatteryPack({
  available = 100,
  staked = 0,
  locked = 0,
  className,
  onTest,
  onReset,
  onPowerChange,
}: BatteryPackProps) {
  // Use shared BATManager context for bidirectional sync
  const batManager = useBATManagerOptional()

  // Local state fallback when BATManager not available
  const [localDeviceState, setLocalDeviceState] = useState<BatteryState>('booting')
  const [localBootPhase, setLocalBootPhase] = useState(0)
  const [localTestPhase, setLocalTestPhase] = useState<BatteryTestPhase>(null)
  const [localShutdownPhase, setLocalShutdownPhase] = useState<BatteryShutdownPhase>(null)
  const [localTestResult, setLocalTestResult] = useState<'pass' | 'fail' | null>(null)
  const [localStatusMessage, setLocalStatusMessage] = useState('Initializing...')
  const [localIsPowered, setLocalIsPowered] = useState(true)
  const [localDisplayValues, setLocalDisplayValues] = useState({ available: '--', staked: '--', segments: 0 })

  // Use context state if available, otherwise local state
  const deviceState = batManager?.deviceState ?? localDeviceState
  const testPhase = batManager?.testPhase ?? localTestPhase
  const shutdownPhase = batManager?.shutdownPhase ?? localShutdownPhase
  const testResult = batManager?.testResult ?? localTestResult
  const statusMessage = batManager?.statusMessage ?? localStatusMessage
  const isPowered = batManager?.isPowered ?? localIsPowered
  const bootPhaseFromContext = batManager?.bootPhase
  const bootPhase = batManager ?
    (bootPhaseFromContext === 'init' ? 1 : bootPhaseFromContext === 'cells' ? 2 : bootPhaseFromContext === 'calibrate' ? 3 : bootPhaseFromContext === 'handshake' ? 4 : bootPhaseFromContext === 'ready' ? 6 : 0)
    : localBootPhase

  const total = available + staked + locked
  const chargePercent = total > 0 ? Math.min(100, (available / 200) * 100) : 0
  const status = available >= 50 ? 'active' : available >= 20 ? 'standby' : 'offline'

  // Battery segments (5 levels)
  const segments = [100, 80, 60, 40, 20]
  const activeSegments = segments.filter(level => chargePercent >= level).length

  // Display values from context or local
  const displayValues = batManager ? {
    available: deviceState === 'standby' ? '--' : available.toFixed(0),
    staked: deviceState === 'standby' ? '--' : (staked > 0 ? `+${staked.toFixed(0)}` : ''),
    segments: deviceState === 'standby' ? 0 : activeSegments,
  } : localDisplayValues

  // Local boot sequence (fallback when no BATManager)
  const runLocalBootSequence = useCallback(async () => {
    setLocalDeviceState('booting')
    setLocalStatusMessage('Cell check...')
    setLocalBootPhase(1)
    await new Promise(r => setTimeout(r, 200))

    setLocalStatusMessage('Voltage sense...')
    setLocalBootPhase(2)
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Current monitor...')
    setLocalBootPhase(3)
    setLocalDisplayValues(prev => ({ ...prev, segments: 1 }))
    await new Promise(r => setTimeout(r, 200))

    setLocalStatusMessage('Capacity scan...')
    setLocalBootPhase(4)
    setLocalDisplayValues(prev => ({ ...prev, segments: 3, available: '0' }))
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Regen link...')
    setLocalBootPhase(5)
    await new Promise(r => setTimeout(r, 300))

    // Final boot - show real values
    setLocalDisplayValues({
      available: available.toFixed(0),
      staked: staked > 0 ? `+${staked.toFixed(0)}` : '',
      segments: activeSegments,
    })
    setLocalBootPhase(6)
    setLocalDeviceState('online')
    setLocalStatusMessage('Auto-regen: active')
  }, [available, staked, activeSegments])

  // Local shutdown sequence (fallback)
  const runLocalShutdownSequence = useCallback(async () => {
    setLocalDeviceState('shutdown')

    setLocalShutdownPhase('saving')
    setLocalStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 200))

    setLocalShutdownPhase('disconnect')
    setLocalStatusMessage('Disconnecting...')
    setLocalDisplayValues({ available: '--', staked: '--', segments: 0 })
    await new Promise(r => setTimeout(r, 200))

    setLocalShutdownPhase('hibernate')
    setLocalStatusMessage('Hibernating...')
    await new Promise(r => setTimeout(r, 200))

    setLocalShutdownPhase(null)
    setLocalDeviceState('standby')
    setLocalStatusMessage('Standby mode')
  }, [])

  // Boot on mount (local fallback only)
  useEffect(() => {
    if (!batManager && localIsPowered) {
      runLocalBootSequence()
    }
  }, []) // Only run on mount

  // Update local display values when props change (local fallback)
  useEffect(() => {
    if (!batManager && localDeviceState === 'online') {
      setLocalDisplayValues({
        available: available.toFixed(0),
        staked: staked > 0 ? `+${staked.toFixed(0)}` : '',
        segments: activeSegments,
      })
    }
  }, [batManager, available, staked, activeSegments, localDeviceState])

  // Power toggle handler
  const handlePowerToggle = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting') return

    if (batManager) {
      if (isPowered && deviceState !== 'standby') {
        await batManager.powerOff()
        onPowerChange?.(false)
      } else {
        await batManager.powerOn()
        onPowerChange?.(true)
      }
    } else {
      if (localIsPowered && localDeviceState !== 'standby') {
        setLocalIsPowered(false)
        await runLocalShutdownSequence()
        onPowerChange?.(false)
      } else {
        setLocalIsPowered(true)
        await runLocalBootSequence()
        onPowerChange?.(true)
      }
    }
  }, [batManager, isPowered, deviceState, localIsPowered, localDeviceState, runLocalShutdownSequence, runLocalBootSequence, onPowerChange])

  // Test handler
  const handleTest = async () => {
    if (deviceState !== 'online') return

    if (batManager) {
      await batManager.runTest()
      onTest?.()
    } else {
      setLocalDeviceState('testing')
      setLocalTestResult(null)

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
        setLocalTestPhase(phase)
        setLocalStatusMessage(phaseMessages[phase])
        await new Promise(r => setTimeout(r, 300))
      }

      setLocalTestResult('pass')
      setLocalTestPhase(null)
      setLocalDeviceState('online')
      setLocalStatusMessage('All tests PASSED')
      onTest?.()

      setTimeout(() => {
        setLocalTestResult(null)
        setLocalStatusMessage('Auto-regen: active')
      }, 3000)
    }
  }

  // Reboot handler
  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    if (batManager) {
      await batManager.reboot()
      onReset?.()
    } else {
      setLocalDeviceState('rebooting')
      setLocalTestResult(null)

      setLocalStatusMessage('Disconnecting...')
      await new Promise(r => setTimeout(r, 200))

      setLocalStatusMessage('Discharging caps...')
      setLocalDisplayValues({ available: '--', staked: '--', segments: 0 })
      await new Promise(r => setTimeout(r, 250))

      setLocalStatusMessage('Safe mode...')
      setLocalBootPhase(0)
      await new Promise(r => setTimeout(r, 200))

      setLocalStatusMessage('Pack offline')
      await new Promise(r => setTimeout(r, 300))

      // Boot sequence
      await runLocalBootSequence()
      onReset?.()
    }
  }

  // LED color based on state
  const getLedColor = () => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return 'amber'
    if (deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = deviceState !== 'standby' && deviceState !== 'shutdown' && !(deviceState === 'rebooting' && bootPhase === 0)

  // Fold state from context
  const isExpanded = batManager?.isExpanded ?? true
  const handleToggleExpand = () => batManager?.toggleExpanded()

  // Folded info toggle (local, with 5-min inactivity auto-close)
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = () => {
    const next = !showFoldedInfo
    setShowFoldedInfo(next)
    if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
    if (next) {
      foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
    }
  }

  // Auto-close folded info when powered off
  useEffect(() => {
    if (!isPowered) setShowFoldedInfo(false)
  }, [isPowered])

  // Cleanup timer
  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  // State label for folded display
  const stateLabel = deviceState === 'standby' ? 'STANDBY' :
    deviceState === 'booting' ? 'BOOTING' :
    deviceState === 'testing' ? 'TESTING' :
    deviceState === 'rebooting' ? 'REBOOT' :
    deviceState === 'shutdown' ? 'SHUTDOWN' : 'ONLINE'

  const isTransitioning = deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'

  // Military-style dashed micro button helper
  const milBtnClass = (active: boolean, color: string) => cn(
    'w-3.5 h-3 font-mono text-[5px] transition-all border border-dashed flex items-center justify-center shrink-0',
    active
      ? `bg-[var(--neon-${color})]/10 text-[var(--neon-${color})] border-[var(--neon-${color})]`
      : 'bg-[#0a0a0f] text-[var(--neon-lime,#bfff00)]/60 border-[var(--neon-lime,#bfff00)]/30 hover:border-[var(--neon-lime,#bfff00)]/60 disabled:opacity-30'
  )

  return (
    <PanelFrame
      variant="military"
      className={cn('relative overflow-hidden', className)}
      style={{ perspective: '600px' }}
    >
      {/* ═══ FOLDED FRONT PANEL ═══ */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
        }}
        className="w-full"
      >
        <div className="p-1.5 px-2">
          {/* Main folded row */}
          <div className="flex items-center gap-1.5">
            <LED on={isLedOn} color={getLedColor()} size="sm" />
            <span className="font-mono text-[8px] text-[var(--neon-lime,#bfff00)] tracking-wider font-bold">BAT-001</span>
            <span className={cn(
              'font-mono text-[6px] tracking-wide',
              deviceState === 'online' ? 'text-[var(--neon-green)]' :
              deviceState === 'standby' ? 'text-white/40' :
              'text-[var(--neon-amber)]'
            )}>
              {stateLabel}
            </span>
            <div className="flex-1" />

            {/* Folded action buttons — only show T/R when powered */}
            {isPowered && deviceState !== 'standby' && (
              <>
                <button
                  onClick={handleTest}
                  disabled={deviceState !== 'online'}
                  className={milBtnClass(deviceState === 'testing', 'cyan')}
                  title="Test"
                >
                  {deviceState === 'testing' ? '·' : testResult === 'pass' ? '●' : testResult === 'fail' ? '✕' : '◇'}
                </button>
                <button
                  onClick={handleReboot}
                  disabled={isTransitioning}
                  className={milBtnClass(deviceState === 'rebooting' || deviceState === 'booting', 'amber')}
                  title="Cycle"
                >
                  {deviceState === 'rebooting' || deviceState === 'booting' ? '·' : '↻'}
                </button>
              </>
            )}

            {/* Power button */}
            <button
              onClick={handlePowerToggle}
              disabled={isTransitioning}
              className="w-3.5 h-3 font-mono text-[5px] transition-all border border-dashed flex items-center justify-center shrink-0"
              style={{
                background: isPowered && deviceState !== 'standby' ? 'rgba(191,255,0,0.1)' : '#0a0a0f',
                color: isPowered && deviceState !== 'standby' ? 'var(--neon-lime, #bfff00)' : 'rgba(255,255,255,0.4)',
                borderColor: isPowered && deviceState !== 'standby' ? 'rgba(191,255,0,0.5)' : 'rgba(255,255,255,0.1)',
              }}
              title={isPowered && deviceState !== 'standby' ? 'Power Off' : 'Power On'}
            >
              ⏻
            </button>

            {/* Info toggle / Unfold chevron */}
            {isPowered && deviceState !== 'standby' ? (
              <button
                onClick={showFoldedInfo ? () => { setShowFoldedInfo(false); handleToggleExpand() } : toggleFoldedInfo}
                className="w-3.5 h-3 font-mono text-[6px] transition-all border border-dashed flex items-center justify-center shrink-0 bg-[#0a0a0f] text-[var(--neon-lime,#bfff00)]/60 border-[var(--neon-lime,#bfff00)]/30 hover:border-[var(--neon-lime,#bfff00)]/60"
                title={showFoldedInfo ? 'Unfold' : 'More info'}
              >
                {showFoldedInfo ? '▲' : '▼'}
              </button>
            ) : (
              <button
                onClick={handleToggleExpand}
                className="w-3.5 h-3 font-mono text-[6px] transition-all border border-dashed flex items-center justify-center shrink-0 bg-[#0a0a0f] text-[var(--neon-lime,#bfff00)]/60 border-[var(--neon-lime,#bfff00)]/30 hover:border-[var(--neon-lime,#bfff00)]/60"
                title="Unfold"
              >
                ▼
              </button>
            )}
          </div>

          {/* Folded info expansion */}
          <div
            style={{
              maxHeight: showFoldedInfo ? '48px' : '0px',
              transition: 'max-height 400ms ease, opacity 400ms ease',
              opacity: showFoldedInfo ? 1 : 0,
              overflow: 'hidden',
            }}
          >
            <div className="mt-1 pt-1 border-t border-white/5 grid grid-cols-3 gap-2">
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Avail </span>
                <span className="text-[var(--neon-green)]">{displayValues.available}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Staked </span>
                <span className="text-[var(--neon-cyan)]">{displayValues.staked || '0'}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Charge </span>
                <span className="text-[var(--neon-lime,#bfff00)]">{batManager?.chargePercent ?? chargePercent}%</span>
              </div>
            </div>
            <div className="mt-0.5 grid grid-cols-3 gap-2">
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Cells </span>
                <span className="text-white/50">{batManager?.cellHealth?.length ?? 4}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Temp </span>
                <span className="text-white/50">{batManager?.temperature ?? 28}C</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Regen </span>
                <span className="text-white/50">{batManager?.autoRegen ? 'ON' : 'OFF'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ UNFOLDED INNER PANEL ═══ */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
        }}
        className="w-full p-2"
      >
        {/* Top-right buttons: fold chevron + battery cell power */}
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
          <button
            onClick={handleToggleExpand}
            className="group"
            title="Fold"
          >
            <div
              className="w-2.5 h-2.5 rounded-sm border border-dashed transition-all flex items-center justify-center"
              style={{
                background: '#0a0a0f',
                borderColor: 'rgba(191,255,0,0.2)',
              }}
            >
              <span className="font-mono text-[5px] text-[var(--neon-lime,#bfff00)]/40 group-hover:text-[var(--neon-lime,#bfff00)]/70 transition-colors">▲</span>
            </div>
          </button>
          <button
            onClick={handlePowerToggle}
            disabled={isTransitioning}
            className="group"
            title={isPowered && deviceState !== 'standby' ? 'Power Off' : 'Power On'}
          >
            <div
              className="w-2.5 h-4 relative flex flex-col items-center justify-center gap-[1px] rounded-sm transition-all border"
              style={{
                background: isPowered && deviceState !== 'standby'
                  ? 'linear-gradient(180deg, #1a3a1a 0%, #0a1f0a 100%)'
                  : deviceState === 'standby' ? 'linear-gradient(180deg, #2a2a1a 0%, #1a1a0a 100%)' : '#0a0a0a',
                borderColor: isPowered && deviceState !== 'standby'
                  ? 'var(--neon-lime, #bfff00)'
                  : deviceState === 'standby' ? '#4a4a2a' : '#2a2a2a',
                boxShadow: isPowered && deviceState !== 'standby'
                  ? '0 0 4px rgba(191, 255, 0, 0.4), inset 0 0 3px rgba(191, 255, 0, 0.2)'
                  : 'none',
              }}
            >
              <div
                className="absolute -top-[2px] w-1 h-[2px] rounded-t-sm"
                style={{
                  background: isPowered && deviceState !== 'standby' ? 'var(--neon-lime, #bfff00)' : '#3a3a3a',
                }}
              />
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-[3px] rounded-[1px] transition-all"
                  style={{
                    background: isPowered && deviceState !== 'standby'
                      ? i === 0 ? 'var(--neon-lime, #bfff00)' : 'var(--neon-green)'
                      : '#2a2a2a',
                    boxShadow: isPowered && deviceState !== 'standby' && i < 2
                      ? '0 0 3px var(--neon-lime, #bfff00)'
                      : 'none',
                    opacity: isPowered && deviceState !== 'standby' ? 1 - (i * 0.2) : 0.3,
                  }}
                />
              ))}
            </div>
          </button>
        </div>

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
              <div className="font-mono text-[5px] text-white/30">
                {deviceState === 'standby' ? 'STANDBY MODE' : 'AUTOMATIC REGENERATION'}
              </div>
            </div>
          </div>
          <div className="font-mono text-[5px] text-white/20 mr-8">BAT-001</div>
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
              'w-3.5 h-3 font-mono text-[5px] transition-all border border-dashed flex items-center justify-center',
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
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown'}
            className={cn(
              'w-3.5 h-3 font-mono text-[5px] transition-all border border-dashed flex items-center justify-center',
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
// Uses HMSManager context for bidirectional sync with terminal
// Firmware: v3.2.1 | Tech Tree: Synthesizers
// Function: Slice creation, State toggle, Color fuse, Waveform generation
// Power: Full 8 E/s | Idle 3 E/s | Standby 0.5 E/s | Resonance 12 E/s
// ==================================================
interface HandmadeSynthesizerProps {
  progress?: TechTreeProgress
  className?: string
  onTest?: () => void
  onReset?: () => void
  onPowerChange?: (isOn: boolean) => void
}

export function HandmadeSynthesizer({
  progress,
  className,
  onTest,
  onReset,
  onPowerChange,
}: HandmadeSynthesizerProps) {
  // Use shared HMSManager context for bidirectional sync
  const hmsManager = useHMSManagerOptional()

  // Local state fallback when HMSManager not available
  const [localDeviceState, setLocalDeviceState] = useState<'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'>('booting')
  const [localBootPhase, setLocalBootPhase] = useState(0)
  const [localTestPhase, setLocalTestPhase] = useState<'oscillator' | 'waveform' | 'filter' | 'output' | 'calibrate' | 'complete' | null>(null)
  const [localTestResult, setLocalTestResult] = useState<'pass' | 'fail' | null>(null)
  const [localStatusMessage, setLocalStatusMessage] = useState('Initializing...')
  const [localKnobValues, setLocalKnobValues] = useState({ pulse: 0, tempo: 0, freq: 0 })
  const [localIsPowered, setLocalIsPowered] = useState(true)

  // Use context state if available, otherwise local state
  const deviceState = hmsManager?.deviceState ?? localDeviceState
  const bootPhase = hmsManager?.bootPhase
  const testPhase = hmsManager?.testPhase ?? localTestPhase
  const testResult = hmsManager?.testResult ?? localTestResult
  const statusMessage = hmsManager?.statusMessage ?? localStatusMessage
  const isPowered = hmsManager?.isPowered ?? localIsPowered
  const waveformType = hmsManager?.waveformType ?? 'sine'

  // Knob values from context or local
  const knobValues = hmsManager ? {
    pulse: hmsManager.pulseValue,
    tempo: hmsManager.tempoValue,
    freq: hmsManager.freqValue,
  } : localKnobValues

  const tier = progress?.currentTier ?? (hmsManager?.currentTier ?? 1)
  const status = tier >= 2 ? 'active' : tier >= 1 ? 'standby' : 'offline'

  // Target knob values based on tier
  const targetPulse = tier * 15 + 20
  const targetTempo = tier * 10 + 30
  const targetFreq = tier * 12 + 25

  const bootPhaseNum = bootPhase === 'power' ? 1 : bootPhase === 'oscillator' ? 2 : bootPhase === 'waveform' ? 3 : bootPhase === 'filter' ? 4 : bootPhase === 'calibrate' ? 5 : bootPhase === 'ready' ? 6 : localBootPhase

  // Update HMS tier when progress changes
  useEffect(() => {
    if (hmsManager && progress?.currentTier !== undefined) {
      hmsManager.updateTier(progress.currentTier)
    }
  }, [hmsManager, progress?.currentTier])

  // Local boot sequence (fallback when no HMSManager)
  const runLocalBootSequence = useCallback(async () => {
    setLocalDeviceState('booting')
    setLocalStatusMessage('Power on...')
    setLocalBootPhase(1)
    await new Promise(r => setTimeout(r, 200))

    setLocalStatusMessage('Oscillator init...')
    setLocalBootPhase(2)
    setLocalKnobValues({ pulse: 10, tempo: 10, freq: 10 })
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Waveform gen...')
    setLocalBootPhase(3)
    setLocalKnobValues({ pulse: targetPulse / 2, tempo: targetTempo / 2, freq: targetFreq / 2 })
    await new Promise(r => setTimeout(r, 200))

    setLocalStatusMessage('Filter bank...')
    setLocalBootPhase(4)
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Calibrating...')
    setLocalBootPhase(5)
    await new Promise(r => setTimeout(r, 300))

    setLocalKnobValues({ pulse: targetPulse, tempo: targetTempo, freq: targetFreq })
    setLocalBootPhase(6)
    setLocalDeviceState('online')
    setLocalStatusMessage('Synth ready')
  }, [targetPulse, targetTempo, targetFreq])

  // Local shutdown sequence (fallback)
  const runLocalShutdownSequence = useCallback(async () => {
    setLocalDeviceState('shutdown')
    setLocalStatusMessage('Draining buffers...')
    setLocalKnobValues({ pulse: 0, tempo: 0, freq: 0 })
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Power down...')
    await new Promise(r => setTimeout(r, 200))

    setLocalStatusMessage('Standby mode')
    setLocalBootPhase(0)
    await new Promise(r => setTimeout(r, 150))

    setLocalDeviceState('standby')
    setLocalStatusMessage('Standby')
  }, [])

  // Power toggle handler
  const handlePowerToggle = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'shutdown') return

    if (hmsManager) {
      if (deviceState === 'standby') {
        await hmsManager.powerOn()
        onPowerChange?.(true)
      } else if (deviceState === 'online') {
        await hmsManager.powerOff()
        onPowerChange?.(false)
      }
    } else {
      // Local fallback
      if (deviceState === 'standby') {
        setLocalIsPowered(true)
        await runLocalBootSequence()
        onPowerChange?.(true)
      } else if (deviceState === 'online') {
        setLocalIsPowered(false)
        await runLocalShutdownSequence()
        onPowerChange?.(false)
      }
    }
  }

  // Test handler
  const handleTest = async () => {
    if (deviceState !== 'online') return

    if (hmsManager) {
      await hmsManager.runTest()
    } else {
      // Local fallback test sequence
      setLocalDeviceState('testing')
      setLocalTestResult(null)

      const phases: ('oscillator' | 'waveform' | 'filter' | 'output' | 'calibrate' | 'complete')[] = ['oscillator', 'waveform', 'filter', 'output', 'calibrate', 'complete']
      const phaseMessages = {
        oscillator: 'Testing oscillators...',
        waveform: 'Checking waveforms...',
        filter: 'Verifying filters...',
        output: 'Testing output stage...',
        calibrate: 'Calibration check...',
        complete: 'Diagnostics complete',
      }

      for (const phase of phases) {
        setLocalTestPhase(phase)
        setLocalStatusMessage(phaseMessages[phase])
        await new Promise(r => setTimeout(r, 300))
      }

      setLocalTestResult('pass')
      setLocalTestPhase(null)
      setLocalDeviceState('online')
      setLocalStatusMessage('All tests PASSED')

      setTimeout(() => {
        setLocalTestResult(null)
        setLocalStatusMessage('Synth ready')
      }, 3000)
    }
    onTest?.()
  }

  // Reboot handler
  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    if (hmsManager) {
      await hmsManager.reboot()
    } else {
      // Local fallback reboot
      setLocalDeviceState('rebooting')
      setLocalTestResult(null)
      setLocalStatusMessage('Shutting down...')
      await new Promise(r => setTimeout(r, 200))
      setLocalStatusMessage('Draining buffers...')
      setLocalKnobValues({ pulse: 0, tempo: 0, freq: 0 })
      await new Promise(r => setTimeout(r, 250))
      setLocalStatusMessage('Power off...')
      setLocalBootPhase(0)
      await new Promise(r => setTimeout(r, 200))
      setLocalStatusMessage('Synth offline')
      await new Promise(r => setTimeout(r, 300))
      await runLocalBootSequence()
    }
    onReset?.()
  }

  // Knob change handler - syncs with context
  const handleKnobChange = (knob: 'pulse' | 'tempo' | 'freq', value: number) => {
    if (deviceState !== 'online') return

    if (hmsManager) {
      hmsManager.setKnobValue(knob, value)
    } else {
      setLocalKnobValues(prev => ({ ...prev, [knob]: value }))
    }
  }

  // Auto-boot on mount (when no HMSManager)
  useEffect(() => {
    if (!hmsManager) {
      runLocalBootSequence()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // LED color based on state
  const getLedColor = () => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return 'red'
    if (deviceState === 'rebooting') return 'amber'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = deviceState !== 'standby' && deviceState !== 'shutdown' && !(deviceState === 'rebooting' && bootPhaseNum === 0)

  // Fold state from context
  const isExpanded = hmsManager?.isExpanded ?? true
  const handleToggleExpand = () => hmsManager?.toggleExpanded()

  // Folded info toggle (local, with 5-min inactivity auto-close)
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = () => {
    const next = !showFoldedInfo
    setShowFoldedInfo(next)
    if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
    if (next) {
      foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
    }
  }

  useEffect(() => {
    if (!isPowered) setShowFoldedInfo(false)
  }, [isPowered])

  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  const stateLabel = deviceState === 'standby' ? 'STANDBY' :
    deviceState === 'booting' ? 'BOOTING' :
    deviceState === 'testing' ? 'TESTING' :
    deviceState === 'rebooting' ? 'REBOOT' :
    deviceState === 'shutdown' ? 'SHUTDOWN' : 'ONLINE'

  const isTransitioning = deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'

  // Waveform power button - creative sine wave shape
  const WaveformPowerButton = ({ small }: { small?: boolean }) => {
    const isOn = deviceState === 'online' || deviceState === 'testing'
    const isTransBtn = deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting'
    const canToggle = !isTransBtn && deviceState !== 'testing'

    const getWaveformPath = () => {
      switch (waveformType) {
        case 'sine': return 'M2,8 Q5,2 8,8 Q11,14 14,8 Q17,2 20,8'
        case 'square': return 'M2,10 L2,4 L8,4 L8,12 L14,12 L14,4 L20,4 L20,10'
        case 'saw': return 'M2,12 L8,4 L8,12 L14,4 L14,12 L20,4'
        case 'triangle': return 'M2,8 L6,3 L10,13 L14,3 L18,13 L20,8'
        default: return 'M2,8 Q5,2 8,8 Q11,14 14,8 Q17,2 20,8'
      }
    }

    return (
      <button
        onClick={handlePowerToggle}
        disabled={!canToggle}
        className={cn(
          'relative rounded transition-all duration-300',
          small ? 'w-5 h-3' : 'w-6 h-4',
          canToggle ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-50',
          isOn ? 'bg-[#0a1a1a]' : 'bg-[#0a0a0f]',
        )}
        title={isOn ? 'Power Off' : 'Power On'}
        style={{
          border: `1px solid ${isOn ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.2)'}`,
          boxShadow: isOn ? '0 0 8px var(--neon-cyan), inset 0 0 4px rgba(0,255,255,0.1)' : 'none',
        }}
      >
        <svg
          viewBox="0 0 22 16"
          className={cn('absolute inset-0 w-full h-full transition-all', isTransBtn && 'animate-pulse')}
          style={{ filter: isOn ? 'drop-shadow(0 0 2px var(--neon-cyan))' : 'none' }}
        >
          <path d={getWaveformPath()} fill="none" stroke={isOn ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5" strokeLinecap="round" className={cn(isOn && 'animate-pulse')} />
        </svg>
        <div className={cn('absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-all', isOn ? 'bg-[var(--neon-cyan)] shadow-[0_0_4px_var(--neon-cyan)]' : 'bg-white/20')} />
      </button>
    )
  }

  // Micro button helper for folded bar
  const microBtnClass = (active: boolean, color: string) => cn(
    'w-3.5 h-3 rounded-sm font-mono text-[5px] transition-all border flex items-center justify-center shrink-0',
    active
      ? `bg-[var(--neon-${color})]/20 text-[var(--neon-${color})] border-[var(--neon-${color})]/50`
      : 'bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20 disabled:opacity-30'
  )

  return (
    <PanelFrame
      variant="teal"
      className={cn('relative overflow-hidden', className)}
      style={{ perspective: '600px' }}
    >
      {/* ═══ FOLDED FRONT PANEL ═══ */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
        }}
        className="w-full"
      >
        <div className="p-1.5 px-2">
          <div className="flex items-center gap-1.5">
            <LED on={isLedOn} color={getLedColor()} size="sm" />
            <span className="font-mono text-[8px] text-[var(--neon-cyan)] tracking-wider font-bold">HMS-001</span>
            <span className={cn(
              'font-mono text-[6px] tracking-wide',
              deviceState === 'online' ? 'text-[var(--neon-green)]' :
              deviceState === 'standby' ? 'text-white/40' :
              'text-[var(--neon-amber)]'
            )}>
              {stateLabel}
            </span>
            <div className="flex-1" />

            {isPowered && deviceState !== 'standby' && (
              <>
                <button
                  onClick={handleTest}
                  disabled={deviceState !== 'online'}
                  className={microBtnClass(deviceState === 'testing', 'cyan')}
                  title="Test"
                >
                  {deviceState === 'testing' ? '·' : testResult === 'pass' ? '✓' : testResult === 'fail' ? '✗' : 'T'}
                </button>
                <button
                  onClick={handleReboot}
                  disabled={isTransitioning}
                  className={microBtnClass(deviceState === 'rebooting' || deviceState === 'booting', 'amber')}
                  title="Reboot"
                >
                  {deviceState === 'rebooting' || deviceState === 'booting' ? '·' : 'R'}
                </button>
              </>
            )}

            <WaveformPowerButton small />

            {isPowered && deviceState !== 'standby' ? (
              <button
                onClick={showFoldedInfo ? () => { setShowFoldedInfo(false); handleToggleExpand() } : toggleFoldedInfo}
                className="w-3.5 h-3 rounded-sm font-mono text-[6px] transition-all border flex items-center justify-center shrink-0 bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20"
                title={showFoldedInfo ? 'Unfold' : 'More info'}
              >
                {showFoldedInfo ? '▲' : '▼'}
              </button>
            ) : (
              <button
                onClick={handleToggleExpand}
                className="w-3.5 h-3 rounded-sm font-mono text-[6px] transition-all border flex items-center justify-center shrink-0 bg-[#0a0a0f] text-white/40 border-white/10 hover:text-white/60 hover:border-white/20"
                title="Unfold"
              >
                ▼
              </button>
            )}
          </div>

          {/* Folded info expansion */}
          <div
            style={{
              maxHeight: showFoldedInfo ? '48px' : '0px',
              transition: 'max-height 400ms ease, opacity 400ms ease',
              opacity: showFoldedInfo ? 1 : 0,
              overflow: 'hidden',
            }}
          >
            <div className="mt-1 pt-1 border-t border-white/5 grid grid-cols-3 gap-2">
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Pulse </span>
                <span className="text-[var(--neon-cyan)]">{knobValues.pulse}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Tempo </span>
                <span className="text-[var(--neon-amber)]">{knobValues.tempo}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Freq </span>
                <span className="text-[var(--neon-green)]">{knobValues.freq}</span>
              </div>
            </div>
            <div className="mt-0.5 grid grid-cols-3 gap-2">
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Wave </span>
                <span className="text-white/50">{waveformType.slice(0, 3).toUpperCase()}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Tier </span>
                <span className="text-white/50">T{tier}</span>
              </div>
              <div className="font-mono text-[5px]">
                <span className="text-white/30">Osc </span>
                <span className="text-white/50">{hmsManager?.oscillatorCount ?? 4}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ UNFOLDED INNER PANEL ═══ */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
        }}
        className="w-full p-2"
      >
        {/* Header with status LED, power button, and micro buttons */}
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
                {deviceState === 'standby' ? 'Standby' : TIER_NAMES.synthesizers[tier]}
              </div>
            </div>
          </div>

          {/* Control cluster: fold + Waveform power + Test + Reset */}
          <div className="flex gap-1.5 items-center">
            <button
              onClick={handleToggleExpand}
              className="group"
              title="Fold"
            >
              <div
                className="w-2.5 h-2.5 rounded-sm border transition-all flex items-center justify-center"
                style={{ background: '#0a0a0f', borderColor: 'rgba(255,255,255,0.15)' }}
              >
                <span className="font-mono text-[5px] text-white/40 group-hover:text-white/70 transition-colors">▲</span>
              </div>
            </button>

            <WaveformPowerButton />

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
              disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown'}
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

            <div className="font-mono text-[5px] text-white/20 ml-0.5">HMS-001</div>
          </div>
        </div>

        {/* Knobs row - interactive when online, dim when standby */}
        <div className={cn(
          'flex items-center justify-between transition-opacity duration-300',
          deviceState === 'standby' || deviceState === 'shutdown' ? 'opacity-30' :
          deviceState === 'booting' && bootPhaseNum < 3 ? 'opacity-50' : 'opacity-100'
        )}>
          <div className={cn(
            'transition-all',
            deviceState === 'testing' && testPhase === 'oscillator' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
          )}>
            <Knob
              value={knobValues.pulse}
              onChange={(v) => handleKnobChange('pulse', v)}
              size="sm"
              label="PULSE"
              accentColor="var(--neon-cyan)"
              disabled={deviceState !== 'online'}
            />
          </div>
          <div className={cn(
            'transition-all',
            deviceState === 'testing' && testPhase === 'waveform' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
          )}>
            <Knob
              value={knobValues.tempo}
              onChange={(v) => handleKnobChange('tempo', v)}
              size="sm"
              label="TEMPO"
              accentColor="var(--neon-amber)"
              disabled={deviceState !== 'online'}
            />
          </div>
          <div className={cn(
            'transition-all',
            deviceState === 'testing' && testPhase === 'filter' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
          )}>
            <Knob
              value={knobValues.freq}
              onChange={(v) => handleKnobChange('freq', v)}
              size="sm"
              label="FREQ"
              accentColor="var(--neon-green)"
              disabled={deviceState !== 'online'}
            />
          </div>
        </div>

        {/* Status bar with waveform indicator */}
        <div className="mt-1.5 pt-1 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className={cn(
              'font-mono text-[5px] px-1 rounded',
              deviceState === 'online' ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]' : 'bg-white/5 text-white/20'
            )}>
              {waveformType.toUpperCase().slice(0, 3)}
            </div>
            <span className={cn(
              'font-mono text-[6px] transition-colors truncate',
              deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
              deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
              deviceState === 'standby' || deviceState === 'shutdown' ? 'text-white/30' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              testResult === 'fail' ? 'text-[var(--neon-red)]' :
              tier > 0 ? 'text-[var(--neon-cyan)]' : 'text-white/30'
            )}>
              {statusMessage}
            </span>
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(t => (
              <div
                key={t}
                className={cn('w-1 h-1 rounded-full transition-colors',
                  deviceState !== 'standby' && deviceState !== 'shutdown' && tier >= t ? 'bg-[var(--neon-cyan)]' : 'bg-white/10'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// ECHO RECORDER - Adapters tech tree visualization
// Device ID: ECR-001 | Version: 1.1.0
// Uses ECRManager context for bidirectional sync with terminal
// Firmware: v1.1.0 | Tech Tree: Adapters
// Function: Blockchain data feeds, Rotation trait, Oracle sync
// Power: Full 5 E/s | Idle 2 E/s | Standby 0.3 E/s | Recording 7 E/s
// ==================================================
interface EchoRecorderProps {
  progress?: TechTreeProgress
  className?: string
  onTest?: () => void
  onReset?: () => void
  onPowerChange?: (isOn: boolean) => void
}

export function EchoRecorder({
  progress,
  className,
  onTest,
  onReset,
  onPowerChange,
}: EchoRecorderProps) {
  // Use shared ECRManager context for bidirectional sync
  const ecrManager = useECRManagerOptional()

  // Local state fallback when ECRManager not available
  const [localDeviceState, setLocalDeviceState] = useState<'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'>('booting')
  const [localBootPhase, setLocalBootPhase] = useState(0)
  const [localTestPhase, setLocalTestPhase] = useState<'antenna' | 'decoder' | 'buffer' | 'sync' | 'output' | 'complete' | null>(null)
  const [localTestResult, setLocalTestResult] = useState<'pass' | 'fail' | null>(null)
  const [localStatusMessage, setLocalStatusMessage] = useState('Initializing...')
  const [localKnobValues, setLocalKnobValues] = useState({ pulse: 0, bloom: 0 })
  const [localIsPowered, setLocalIsPowered] = useState(true)
  const [localTickerTap, setLocalTickerTap] = useState(0)

  // Use context state if available, otherwise local state
  const deviceState = ecrManager?.deviceState ?? localDeviceState
  const bootPhase = ecrManager?.bootPhase
  const testPhase = ecrManager?.testPhase ?? localTestPhase
  const testResult = ecrManager?.testResult ?? localTestResult
  const statusMessage = ecrManager?.statusMessage ?? localStatusMessage
  const isPowered = ecrManager?.isPowered ?? localIsPowered
  const tickerTap = ecrManager?.tickerTap ?? localTickerTap
  const isRecording = ecrManager?.isRecording ?? false
  const signalStrength = ecrManager?.signalStrength ?? 85

  // Knob values from context or local
  const knobValues = ecrManager ? {
    pulse: ecrManager.pulseValue,
    bloom: ecrManager.bloomValue,
  } : localKnobValues

  const tier = progress?.currentTier ?? (ecrManager?.currentTier ?? 1)
  const status = tier >= 2 ? 'active' : tier >= 1 ? 'standby' : 'offline'

  // Target knob values based on tier
  const targetPulse = 40 + tier * 10
  const targetBloom = 60 + tier * 5

  const bootPhaseNum = bootPhase === 'antenna' ? 1 : bootPhase === 'decoder' ? 2 : bootPhase === 'buffer' ? 3 : bootPhase === 'oracle' ? 4 : bootPhase === 'signal' ? 5 : bootPhase === 'ready' ? 6 : localBootPhase

  // Update ECR tier when progress changes
  useEffect(() => {
    if (ecrManager && progress?.currentTier !== undefined) {
      ecrManager.updateTier(progress.currentTier)
    }
  }, [ecrManager, progress?.currentTier])

  // Local ticker simulation (fallback)
  useEffect(() => {
    if (!ecrManager && localDeviceState === 'online') {
      const interval = setInterval(() => {
        setLocalTickerTap(prev => prev + 1)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [ecrManager, localDeviceState])

  // Local boot sequence (fallback when no ECRManager)
  const runLocalBootSequence = useCallback(async () => {
    setLocalDeviceState('booting')
    setLocalStatusMessage('Antenna scan...')
    setLocalBootPhase(1)
    await new Promise(r => setTimeout(r, 200))

    setLocalStatusMessage('Decoder init...')
    setLocalBootPhase(2)
    setLocalKnobValues({ pulse: 20, bloom: 30 })
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Buffer alloc...')
    setLocalBootPhase(3)
    await new Promise(r => setTimeout(r, 200))

    setLocalStatusMessage('Oracle sync...')
    setLocalBootPhase(4)
    setLocalKnobValues({ pulse: targetPulse / 2, bloom: targetBloom / 2 })
    await new Promise(r => setTimeout(r, 300))

    setLocalStatusMessage('Signal lock...')
    setLocalBootPhase(5)
    await new Promise(r => setTimeout(r, 250))

    setLocalKnobValues({ pulse: targetPulse, bloom: targetBloom })
    setLocalBootPhase(6)
    setLocalDeviceState('online')
    setLocalStatusMessage('Ticker Tap 0')
  }, [targetPulse, targetBloom])

  // Local shutdown sequence (fallback)
  const runLocalShutdownSequence = useCallback(async () => {
    setLocalDeviceState('shutdown')
    setLocalStatusMessage('Disconnecting...')
    await new Promise(r => setTimeout(r, 250))

    setLocalStatusMessage('Flush buffer...')
    setLocalKnobValues({ pulse: 0, bloom: 0 })
    await new Promise(r => setTimeout(r, 200))

    setLocalStatusMessage('Antenna off...')
    setLocalBootPhase(0)
    await new Promise(r => setTimeout(r, 200))

    setLocalDeviceState('standby')
    setLocalStatusMessage('Standby')
  }, [])

  // Power toggle handler
  const handlePowerToggle = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'shutdown') return

    if (ecrManager) {
      if (deviceState === 'standby') {
        await ecrManager.powerOn()
        onPowerChange?.(true)
      } else if (deviceState === 'online') {
        await ecrManager.powerOff()
        onPowerChange?.(false)
      }
    } else {
      // Local fallback
      if (deviceState === 'standby') {
        setLocalIsPowered(true)
        await runLocalBootSequence()
        onPowerChange?.(true)
      } else if (deviceState === 'online') {
        setLocalIsPowered(false)
        await runLocalShutdownSequence()
        onPowerChange?.(false)
      }
    }
  }

  // Test handler
  const handleTest = async () => {
    if (deviceState !== 'online') return

    if (ecrManager) {
      await ecrManager.runTest()
    } else {
      // Local fallback test sequence
      setLocalDeviceState('testing')
      setLocalTestResult(null)

      const phases: ('antenna' | 'decoder' | 'buffer' | 'sync' | 'output' | 'complete')[] = ['antenna', 'decoder', 'buffer', 'sync', 'output', 'complete']
      const phaseMessages = {
        antenna: 'Testing antenna...',
        decoder: 'Checking decoder...',
        buffer: 'Verifying buffer...',
        sync: 'Testing oracle sync...',
        output: 'Output check...',
        complete: 'Diagnostics complete',
      }

      for (const phase of phases) {
        setLocalTestPhase(phase)
        setLocalStatusMessage(phaseMessages[phase])
        await new Promise(r => setTimeout(r, 280))
      }

      setLocalTestResult('pass')
      setLocalTestPhase(null)
      setLocalDeviceState('online')
      setLocalStatusMessage('All tests PASSED')

      setTimeout(() => {
        setLocalTestResult(null)
        setLocalStatusMessage('Ticker Tap ' + localTickerTap)
      }, 3000)
    }
    onTest?.()
  }

  // Reboot handler
  const handleReboot = async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    if (ecrManager) {
      await ecrManager.reboot()
    } else {
      // Local fallback reboot
      setLocalDeviceState('rebooting')
      setLocalTestResult(null)
      setLocalStatusMessage('Disconnecting...')
      await new Promise(r => setTimeout(r, 200))
      setLocalStatusMessage('Flush buffer...')
      setLocalKnobValues({ pulse: 0, bloom: 0 })
      await new Promise(r => setTimeout(r, 250))
      setLocalStatusMessage('Antenna off...')
      setLocalBootPhase(0)
      await new Promise(r => setTimeout(r, 200))
      setLocalStatusMessage('Recorder offline')
      await new Promise(r => setTimeout(r, 300))
      await runLocalBootSequence()
    }
    onReset?.()
  }

  // Knob change handler - syncs with context
  const handleKnobChange = (knob: 'pulse' | 'bloom', value: number) => {
    if (deviceState !== 'online') return

    if (ecrManager) {
      ecrManager.setKnobValue(knob, value)
    } else {
      setLocalKnobValues(prev => ({ ...prev, [knob]: value }))
    }
  }

  // Auto-boot on mount (when no ECRManager)
  useEffect(() => {
    if (!ecrManager) {
      runLocalBootSequence()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // LED color based on state
  const getLedColor = () => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return 'red'
    if (deviceState === 'rebooting') return 'amber'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = deviceState !== 'standby' && deviceState !== 'shutdown' && !(deviceState === 'rebooting' && bootPhaseNum === 0)

  // Signal pulse power button - creative radio wave shape
  const SignalPowerButton = () => {
    const isOn = deviceState === 'online' || deviceState === 'testing'
    const isTransitioning = deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting'
    const canToggle = !isTransitioning && deviceState !== 'testing'

    return (
      <button
        onClick={handlePowerToggle}
        disabled={!canToggle}
        className={cn(
          'relative w-5 h-5 rounded transition-all duration-300',
          canToggle ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-50',
          isOn ? 'bg-[#1a1810]' : 'bg-[#0a0a0f]',
        )}
        title={isOn ? 'Power Off' : 'Power On'}
        style={{
          border: `1px solid ${isOn ? 'var(--neon-amber)' : 'rgba(255,255,255,0.2)'}`,
          boxShadow: isOn ? '0 0 6px rgba(255,170,0,0.4), inset 0 0 3px rgba(255,170,0,0.1)' : 'none',
        }}
      >
        {/* Radio signal waves emanating from center */}
        <svg
          viewBox="0 0 20 20"
          className={cn(
            'absolute inset-0 w-full h-full transition-all',
            isTransitioning && 'animate-pulse'
          )}
        >
          {/* Center dot (antenna) */}
          <circle
            cx="10"
            cy="10"
            r="2"
            fill={isOn ? 'var(--neon-amber)' : 'rgba(255,255,255,0.3)'}
            className={cn(isOn && isRecording && 'animate-pulse')}
          />
          {/* Signal waves */}
          <path
            d="M6,10 Q6,6 10,6"
            fill="none"
            stroke={isOn ? 'var(--neon-amber)' : 'rgba(255,255,255,0.2)'}
            strokeWidth="1"
            strokeLinecap="round"
            opacity={isOn ? 0.8 : 0.3}
          />
          <path
            d="M4,10 Q4,4 10,4"
            fill="none"
            stroke={isOn ? 'var(--neon-amber)' : 'rgba(255,255,255,0.15)'}
            strokeWidth="1"
            strokeLinecap="round"
            opacity={isOn ? 0.5 : 0.2}
          />
          <path
            d="M14,10 Q14,6 10,6"
            fill="none"
            stroke={isOn ? 'var(--neon-amber)' : 'rgba(255,255,255,0.2)'}
            strokeWidth="1"
            strokeLinecap="round"
            opacity={isOn ? 0.8 : 0.3}
          />
          <path
            d="M16,10 Q16,4 10,4"
            fill="none"
            stroke={isOn ? 'var(--neon-amber)' : 'rgba(255,255,255,0.15)'}
            strokeWidth="1"
            strokeLinecap="round"
            opacity={isOn ? 0.5 : 0.2}
          />
        </svg>
      </button>
    )
  }

  // Fold state
  const isExpanded = ecrManager?.isExpanded ?? true
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleToggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
      if (next) {
        foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }

  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  // Push-style nano button helper (matching existing ECR style)
  const nanoBtn = (onClick: () => void, disabled: boolean, title: string, ledColor?: string, isActive?: boolean) => (
    <button onClick={onClick} disabled={disabled} className="group relative disabled:opacity-30" title={title}>
      <div className={cn(
        'w-3 h-3 rounded-sm border-2 transition-all flex items-center justify-center',
        'bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a]',
        'border-[#3a3a4a] border-b-[#0a0a0f]',
        'active:border-t-[#0a0a0f] active:border-b-[#3a3a4a] active:from-[#1a1a2a] active:to-[#2a2a3a]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
        isActive && 'from-[#1a1a2a] to-[#2a2a3a]'
      )}>
        <div className={cn(
          'w-1 h-1 rounded-full transition-all',
          ledColor || 'bg-white/20 group-hover:bg-white/40'
        )} />
      </div>
    </button>
  )

  const testLedColor = deviceState === 'testing'
    ? 'bg-[var(--neon-cyan)] shadow-[0_0_4px_var(--neon-cyan)]'
    : testResult === 'pass'
    ? 'bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]'
    : testResult === 'fail'
    ? 'bg-[var(--neon-red)] shadow-[0_0_4px_var(--neon-red)]'
    : undefined

  const rebootLedColor = (deviceState === 'rebooting' || deviceState === 'booting')
    ? 'bg-[var(--neon-amber)] shadow-[0_0_4px_var(--neon-amber)]'
    : undefined

  return (
    <PanelFrame variant="default" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>

      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%',
        left: 0,
        top: 0,
      }}>
        <div className="p-2">
          <div className="flex items-center gap-1.5">
            <LED on={isLedOn} color={getLedColor()} size="sm" />
            <span className="font-mono text-[9px] text-[var(--neon-amber)] font-medium">ECR-001</span>
            <span className={cn(
              'font-mono text-[7px] ml-1',
              isPowered ? 'text-[var(--neon-green)]' : 'text-white/30'
            )}>
              {isPowered ? (deviceState === 'online' ? 'ONLINE' : deviceState.toUpperCase()) : 'STANDBY'}
            </span>
            <div className="flex-1" />
            {isPowered && (
              <>
                {nanoBtn(handleTest, deviceState !== 'online', 'Test', testLedColor, deviceState === 'testing')}
                {nanoBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reset', rebootLedColor, deviceState === 'rebooting' || deviceState === 'booting')}
              </>
            )}
            <SignalPowerButton />
            <button
              onClick={isPowered ? handleToggleFoldedInfo : undefined}
              className={cn(
                'w-3 h-3 flex items-center justify-center rounded-sm transition-all',
                'border border-[#3a3a4a] bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a]',
                isPowered ? 'cursor-pointer hover:border-[var(--neon-amber)]/50' : 'opacity-30 cursor-default',
              )}
              title={showFoldedInfo ? 'Hide info' : 'Show info'}
            >
              <span className="text-[6px] text-white/50">{showFoldedInfo ? '▲' : '▼'}</span>
            </button>
          </div>

          {/* Folded info expansion */}
          <div style={{
            maxHeight: showFoldedInfo && isPowered ? '80px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}>
            <div className="mt-1.5 pt-1 border-t border-white/5 grid grid-cols-3 gap-x-3 gap-y-0.5">
              {[
                ['Pulse', `${knobValues.pulse}%`],
                ['Bloom', `${knobValues.bloom}%`],
                ['Signal', `${signalStrength}%`],
                ['Ticker', `${tickerTap}`],
                ['Tier', `T${tier}`],
                ['Rec', isRecording ? 'ON' : 'OFF'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="font-mono text-[6px] text-white/30">{label}</span>
                  <span className="font-mono text-[6px] text-[var(--neon-amber)]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%',
        left: 0,
        top: 0,
      }}>
        <div className="p-2">
          {/* Fold chevron */}
          <button
            onClick={() => ecrManager?.toggleExpanded()}
            className="absolute top-1 right-1 w-3 h-3 flex items-center justify-center rounded-sm z-10 border border-[#3a3a4a] bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] cursor-pointer hover:border-[var(--neon-amber)]/50 transition-all"
            title="Fold"
          >
            <span className="text-[6px] text-white/50">▲</span>
          </button>

          {/* Header with power button */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <LED on={isLedOn} color={getLedColor()} size="sm" />
              <div className="font-mono text-[9px] text-[var(--neon-amber)]">
                ECHO RECORDER
              </div>
            </div>

            {/* Control cluster: Signal power + Test + Reset */}
            <div className="flex gap-1 items-center mr-4">
              <SignalPowerButton />
              {nanoBtn(handleTest, deviceState !== 'online', 'Test', testLedColor, deviceState === 'testing')}
              {nanoBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reset', rebootLedColor, deviceState === 'rebooting' || deviceState === 'booting')}
            </div>
          </div>

          {/* Tier name with ticker */}
          <div className={cn(
            'font-mono text-[7px] text-white/40 mb-1.5 transition-opacity flex items-center justify-between',
            deviceState === 'standby' || deviceState === 'shutdown' ? 'opacity-50' :
            deviceState === 'booting' && bootPhaseNum < 4 ? 'opacity-50' : 'opacity-100'
          )}>
            <span>{deviceState === 'standby' ? 'Standby' : `Ticker Tap ${tickerTap}`}</span>
            {/* Signal strength indicator */}
            <div className="flex gap-px">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={cn(
                    'w-0.5 transition-all',
                    deviceState === 'online' && signalStrength >= i * 25
                      ? 'bg-[var(--neon-amber)]'
                      : 'bg-white/10'
                  )}
                  style={{ height: `${i * 2 + 2}px` }}
                />
              ))}
            </div>
          </div>

          {/* Knobs row - interactive when online */}
          <div className={cn(
            'flex items-center gap-2 transition-opacity duration-300',
            deviceState === 'standby' || deviceState === 'shutdown' ? 'opacity-30' :
            deviceState === 'booting' && bootPhaseNum < 2 ? 'opacity-50' : 'opacity-100'
          )}>
            <div className={cn(
              'transition-all',
              deviceState === 'testing' && testPhase === 'antenna' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
            )}>
              <Knob
                value={knobValues.pulse}
                onChange={(v) => handleKnobChange('pulse', v)}
                size="sm"
                label="PULSE"
                disabled={deviceState !== 'online'}
              />
            </div>
            <div className={cn(
              'transition-all',
              deviceState === 'testing' && testPhase === 'output' && 'ring-1 ring-[var(--neon-cyan)]/50 rounded-full'
            )}>
              <Knob
                value={knobValues.bloom}
                onChange={(v) => handleKnobChange('bloom', v)}
                size="sm"
                label="BLOOM"
                disabled={deviceState !== 'online'}
              />
            </div>

            {/* Recording indicator */}
            <div className="flex-1 flex justify-end">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full transition-all',
                deviceState === 'online' && (isRecording || tier > 0)
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
              deviceState === 'standby' || deviceState === 'shutdown' ? 'text-white/30' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              testResult === 'fail' ? 'text-[var(--neon-red)]' :
              'text-[var(--neon-amber)]/70'
            )}>
              {statusMessage}
            </span>
            <span className="font-mono text-[5px] text-white/20">ECR-001</span>
          </div>
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// INTERPOLATOR - Optics tech tree visualization
// Device ID: INT-001 | Version: 2.5.3
// Compatible: HandmadeSynthesizer, Oscilloscope
// unOS Commands: ipl [status|power|firmware|test|reset|info]
// Functions: Color interpolation, Era manipulation, Prediction engine
// Power: Full 20 E/s | Idle 6 E/s | Standby 1 E/s | Predictive 30 E/s
// ==================================================
interface InterpolatorProps {
  progress?: TechTreeProgress
  className?: string
  onTest?: () => void
  onReset?: () => void
  onPowerChange?: (powered: boolean) => void
}

export function Interpolator({
  progress,
  className,
  onTest,
  onReset,
  onPowerChange,
}: InterpolatorProps) {
  // Use shared IPLManager context for bidirectional sync
  const iplManager = useIPLManagerOptional()

  // Derive all state from context when available
  const deviceState = iplManager?.deviceState ?? 'booting'
  const testPhase = iplManager?.testPhase ?? null
  const testResult = iplManager?.testResult ?? null
  const statusMessage = iplManager?.statusMessage ?? 'Initializing...'
  const spectrumWidth = iplManager?.spectrumWidth ?? 0
  const isPowered = iplManager?.isPowered ?? true
  const bootPhase = iplManager?.bootPhase

  const tier = progress?.currentTier ?? 0
  const status = tier >= 2 ? 'active' : tier >= 1 ? 'standby' : 'offline'

  // Color range based on tier
  const colors = ['#800000', '#ff0000', '#ff6600', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3', '#ff00ff']
  const maxColorIndex = Math.min(tier * 2, colors.length - 1)

  // Update tier in manager when progress changes
  useEffect(() => {
    if (iplManager && tier > 0) {
      iplManager.updateTier(tier)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier])

  const handlePowerToggle = async () => {
    if (!iplManager) return
    if (deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing') return

    if (isPowered && deviceState === 'online') {
      await iplManager.powerOff()
      onPowerChange?.(false)
    } else if (!isPowered && deviceState === 'standby') {
      await iplManager.powerOn()
      onPowerChange?.(true)
    }
  }

  const handleTest = async () => {
    if (!iplManager || deviceState !== 'online') return
    await iplManager.runTest()
    onTest?.()
  }

  const handleReboot = async () => {
    if (!iplManager) return
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return
    await iplManager.reboot()
    onReset?.()
  }

  const getLedColor = () => {
    if (!isPowered || deviceState === 'standby' || deviceState === 'shutdown') return 'red'
    if (deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return status === 'active' ? 'green' : status === 'standby' ? 'amber' : 'red'
  }

  const isLedOn = isPowered && deviceState !== 'standby' && deviceState !== 'shutdown'

  // Fold state
  const isExpanded = iplManager?.isExpanded ?? true
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleToggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
      if (next) {
        foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }

  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  // Prism power button helper (reused in both panels)
  const PrismPowerButton = () => (
    <button
      onClick={handlePowerToggle}
      disabled={deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'}
      className="group relative disabled:opacity-30"
      title={isPowered && deviceState === 'online' ? 'Power Off' : 'Power On'}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" className="transition-all">
        <polygon
          points="5,1 9,9 1,9"
          fill="none"
          stroke={isPowered && deviceState === 'online' ? 'var(--neon-lime, #bfff00)' : '#3a3a4a'}
          strokeWidth="0.8"
          className="transition-all"
        />
        {isPowered && deviceState === 'online' && (
          <>
            <line x1="4" y1="4" x2="2.5" y2="8" stroke="#ff0000" strokeWidth="0.4" opacity="0.7" />
            <line x1="5" y1="4" x2="5" y2="8" stroke="#00ff00" strokeWidth="0.4" opacity="0.7" />
            <line x1="6" y1="4" x2="7.5" y2="8" stroke="#0066ff" strokeWidth="0.4" opacity="0.7" />
          </>
        )}
        <circle cx="5" cy="6" r="0.8" fill={isPowered && deviceState === 'online' ? 'var(--neon-lime, #bfff00)' : '#2a2a3a'} className="transition-all">
          {isPowered && deviceState === 'online' && (
            <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
          )}
        </circle>
      </svg>
      {isPowered && deviceState === 'online' && (
        <div className="absolute inset-0 rounded-full opacity-30" style={{ boxShadow: '0 0 4px var(--neon-lime, #bfff00)' }} />
      )}
    </button>
  )

  // Toggle switch helper (reused for test/reset)
  const ToggleSwitch = ({ onClick, disabled, title, isActive, ledColor }: { onClick: () => void; disabled: boolean; title: string; isActive: boolean; ledColor?: string }) => (
    <button onClick={onClick} disabled={disabled} className="group relative disabled:opacity-30" title={title}>
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
          isActive ? 'left-2' : 'left-0'
        )}>
          <div className={cn('w-0.5 h-0.5 rounded-full transition-all', ledColor || 'bg-white/30')} />
        </div>
      </div>
    </button>
  )

  const testLedColor = deviceState === 'testing'
    ? 'bg-[var(--neon-cyan)] shadow-[0_0_3px_var(--neon-cyan)]'
    : testResult === 'pass'
    ? 'bg-[var(--neon-green)] shadow-[0_0_3px_var(--neon-green)]'
    : testResult === 'fail'
    ? 'bg-[var(--neon-red)] shadow-[0_0_3px_var(--neon-red)]'
    : undefined

  const rebootLedColor = (deviceState === 'rebooting' || deviceState === 'booting')
    ? 'bg-[var(--neon-amber)] shadow-[0_0_3px_var(--neon-amber)]'
    : undefined

  // Chevron button helper
  const chevronBtn = (onClick: () => void, label: string, title: string) => (
    <button
      onClick={onClick}
      className="w-3 h-3 flex items-center justify-center rounded-sm border border-[#3a3a4a] bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] cursor-pointer hover:border-[var(--neon-lime,#bfff00)]/50 transition-all"
      title={title}
    >
      <span className="text-[6px] text-white/50">{label}</span>
    </button>
  )

  return (
    <PanelFrame variant="military" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>

      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%',
        left: 0,
        top: 0,
      }}>
        <div className="p-2">
          <div className="flex items-center gap-1.5">
            <LED on={isLedOn} color={getLedColor()} size="sm" />
            <span className="font-mono text-[9px] text-[var(--neon-lime,#bfff00)] font-medium">INT-001</span>
            <span className={cn(
              'font-mono text-[7px] ml-1',
              isPowered ? 'text-[var(--neon-green)]' : 'text-white/30'
            )}>
              {isPowered ? (deviceState === 'online' ? 'ONLINE' : deviceState.toUpperCase()) : 'STANDBY'}
            </span>
            <div className="flex-1" />
            {isPowered && (
              <>
                <ToggleSwitch onClick={handleTest} disabled={deviceState !== 'online'} title="Test" isActive={!!(deviceState === 'testing' || testResult)} ledColor={testLedColor} />
                <ToggleSwitch onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown'} title="Reset" isActive={deviceState === 'rebooting' || deviceState === 'booting'} ledColor={rebootLedColor} />
              </>
            )}
            <PrismPowerButton />
            {chevronBtn(
              isPowered ? handleToggleFoldedInfo : () => {},
              showFoldedInfo ? '▲' : '▼',
              showFoldedInfo ? 'Hide info' : 'Show info'
            )}
          </div>

          {/* Folded info expansion */}
          <div style={{
            maxHeight: showFoldedInfo && isPowered ? '80px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}>
            <div className="mt-1.5 pt-1 border-t border-white/5 grid grid-cols-3 gap-x-3 gap-y-0.5">
              {[
                ['Spectrum', `${spectrumWidth}%`],
                ['Accuracy', `${iplManager?.interpolationAccuracy?.toFixed(1) ?? '97.5'}%`],
                ['Streams', `${iplManager?.inputStreams ?? 8}`],
                ['Horizon', `${iplManager?.predictionHorizon ?? 60}s`],
                ['Tier', `T${tier}`],
                ['Draw', `${isPowered ? '20' : '1'} E/s`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="font-mono text-[6px] text-white/30">{label}</span>
                  <span className="font-mono text-[6px] text-[var(--neon-lime,#bfff00)]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%',
        left: 0,
        top: 0,
      }}>
        <div className="p-2">
          {/* Fold chevron */}
          <div className="absolute top-1 right-1 z-10">
            {chevronBtn(() => iplManager?.toggleExpanded(), '▲', 'Fold')}
          </div>

          {/* Header with LED, power button, and micro toggle buttons */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <LED on={isLedOn} color={getLedColor()} size="sm" />
              <div className="font-mono text-[9px] text-[var(--neon-lime,#bfff00)]">
                INTERPOLATOR
              </div>
            </div>

            <div className="flex gap-1 items-center mr-4">
              <PrismPowerButton />
              <ToggleSwitch onClick={handleTest} disabled={deviceState !== 'online'} title="Test" isActive={!!(deviceState === 'testing' || testResult)} ledColor={testLedColor} />
              <ToggleSwitch onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown'} title="Reset" isActive={deviceState === 'rebooting' || deviceState === 'booting'} ledColor={rebootLedColor} />
            </div>
          </div>

          {/* Tier name */}
          <div className={cn(
            'font-mono text-[7px] text-white/40 mb-1 transition-opacity',
            deviceState === 'booting' && bootPhase ? 'opacity-50' : 'opacity-100'
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
            {tier > 0 && isPowered && deviceState !== 'standby' && deviceState !== 'shutdown' ? (
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
                {deviceState === 'booting' ? 'LOADING...' : !isPowered || deviceState === 'standby' ? 'STANDBY' : 'OFFLINE'}
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
              !isPowered || deviceState === 'standby' ? 'text-white/20' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              testResult === 'fail' ? 'text-[var(--neon-red)]' :
              tier > 0 ? 'text-[var(--neon-lime,#bfff00)]' : 'text-white/30'
            )}>
              {statusMessage}
            </span>
            <span className="font-mono text-[5px] text-white/20">INT-001</span>
          </div>
        </div>
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
type ToolkitState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type ToolkitTestPhase = 'probe' | 'clamp' | 'laser' | 'drill' | 'calibrate' | 'complete' | null
type ToolkitBootPhase = 'post' | 'tools' | 'interface' | 'ready' | null

interface BasicToolkitProps {
  className?: string
}

export function BasicToolkit({ className }: BasicToolkitProps) {
  const btk = useBTKManagerOptional()
  const deviceState = btk?.deviceState ?? 'online'
  const testPhase = btk?.testPhase ?? null
  const bootPhase = btk?.bootPhase ?? null
  const shutdownPhase = btk?.shutdownPhase ?? null
  const selectedTool = btk?.selectedTool ?? null
  const isPowered = btk?.isPowered ?? true
  const isExpanded = btk?.isExpanded ?? true

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

  const runTest = useCallback(() => btk?.runTest(), [btk])
  const reboot = useCallback(() => btk?.reboot(), [btk])
  const selectTool = useCallback((toolName: string) => btk?.selectTool(toolName), [btk])
  const handlePower = useCallback(() => {
    if (deviceState === 'online') btk?.powerOff()
    else if (deviceState === 'standby') btk?.powerOn()
  }, [btk, deviceState])
  const handleFoldToggle = useCallback(() => btk?.toggleExpanded(), [btk])

  // Folded info toggle
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) {
        foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }

  useEffect(() => {
    return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) }
  }, [])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': return 'var(--neon-red)'
      case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }

  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  // Nano button helper for folded bar
  const nanoBtn = (onClick: () => void, disabled: boolean, title: string, borderColor: string, glowColor?: string) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative"
      title={title}
    >
      <div
        className="w-3 h-3 rounded-full border transition-all"
        style={{
          background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
          borderColor: glowColor ?? borderColor,
          boxShadow: glowColor
            ? `0 0 6px ${glowColor}, inset 0 0 3px ${glowColor}`
            : 'inset 0 1px 2px rgba(0,0,0,0.5)',
          opacity: disabled ? 0.3 : 1,
        }}
      />
    </button>
  )

  return (
    <PanelFrame variant="default" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
        }}
        className="w-full"
      >
        {/* Main folded bar */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* LED */}
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 4px ${getStatusColor()}`,
              animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
            }}
          />
          {/* Device ID */}
          <span className="font-mono text-[8px] font-bold text-[var(--neon-amber)]">BTK-001</span>
          {/* State */}
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-amber)]/70' : 'text-white/30')}>
            {stateLabel}
          </span>
          <div className="flex-1" />
          {/* Buttons */}
          {isPowered && (
            <>
              {nanoBtn(runTest, deviceState !== 'online', 'Test',
                '#3a3a4a', deviceState === 'testing' ? 'var(--neon-purple)' : undefined)}
              {nanoBtn(reboot, deviceState === 'booting' || deviceState === 'rebooting', 'Reboot',
                '#3a3a4a', deviceState === 'rebooting' ? 'var(--neon-amber)' : undefined)}
            </>
          )}
          {/* Power rocker */}
          <button
            onClick={handlePower}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'shutdown'}
            className="group relative"
            title="Power"
          >
            <div
              className="rounded-sm border transition-all"
              style={{
                width: '7px',
                height: '3px',
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: isPowered && deviceState !== 'standby' ? 'var(--neon-green)' : deviceState === 'standby' ? 'var(--neon-red)' : '#3a3a4a',
                boxShadow: isPowered && deviceState !== 'standby'
                  ? '0 0 3px var(--neon-green)'
                  : deviceState === 'standby' ? '0 0 3px var(--neon-red)' : 'none',
              }}
            />
          </button>
          {/* Info toggle */}
          {isPowered ? (
            <button
              onClick={toggleFoldedInfo}
              className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-amber)]/40 transition-colors"
              style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}
              title={showFoldedInfo ? 'Hide info' : 'Show info'}
            >
              <span className="font-mono text-[6px] text-[var(--neon-amber)]/60">{showFoldedInfo ? '▲' : '▼'}</span>
            </button>
          ) : (
            <div className="w-3" />
          )}
        </div>

        {/* Folded info expansion */}
        <div
          style={{
            maxHeight: showFoldedInfo && isPowered ? '40px' : '0px',
            transition: 'max-height 400ms ease, opacity 300ms ease',
            opacity: showFoldedInfo && isPowered ? 1 : 0,
            overflow: 'hidden',
          }}
        >
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-amber)]/60 flex gap-3 flex-wrap">
            {tools.map(t => (
              <span key={t.name} className="flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full inline-block" style={{ backgroundColor: t.active ? t.color : '#333' }} />
                {t.name}
              </span>
            ))}
            <span>Tier: T1</span>
            <span>Draw: {btk?.currentDraw?.toFixed(1) ?? '0.0'} E/s</span>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
        }}
        className="w-full p-2"
      >
        {/* Round nano buttons with illuminated edges - top */}
        <div className="absolute top-1 right-1 flex gap-1 z-10">
          {/* Fold chevron */}
          <button
            onClick={handleFoldToggle}
            className="group relative"
            title="Fold"
          >
            <div
              className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center transition-all hover:border-[var(--neon-amber)]/40"
              style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}
            >
              <span className="font-mono text-[6px] text-[var(--neon-amber)]/60">▴</span>
            </div>
          </button>
          {/* Power rocker */}
          <button
            onClick={handlePower}
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'shutdown'}
            className="group relative"
            title="Power"
          >
            <div
              className="rounded-sm border transition-all"
              style={{
                width: '7px',
                height: '3px',
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: isPowered && deviceState !== 'standby' ? 'var(--neon-green)' : deviceState === 'standby' ? 'var(--neon-red)' : '#3a3a4a',
                boxShadow: isPowered && deviceState !== 'standby'
                  ? '0 0 3px var(--neon-green)'
                  : deviceState === 'standby' ? '0 0 3px var(--neon-red)' : 'none',
                opacity: deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'shutdown' ? 0.3 : 1,
              }}
            />
          </button>
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

        {/* Tool grid */}
        <div className="relative grid grid-cols-2 gap-1">
          {deviceState === 'booting' && bootPhase && (
            <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center rounded">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[6px] text-[var(--neon-cyan)]">
                  {bootPhase === 'post' && 'POST'}
                  {bootPhase === 'tools' && 'TOOLS'}
                  {bootPhase === 'interface' && 'I/O'}
                  {bootPhase === 'ready' && 'READY'}
                </span>
                <div className="flex gap-0.5">
                  {['post', 'tools', 'interface', 'ready'].map((phase, i) => (
                    <div
                      key={phase}
                      className="w-1 h-1 rounded-full"
                      style={{
                        backgroundColor: ['post', 'tools', 'interface', 'ready'].indexOf(bootPhase) >= i
                          ? 'var(--neon-cyan)'
                          : '#333',
                        boxShadow: bootPhase === phase ? '0 0 4px var(--neon-cyan)' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {deviceState === 'rebooting' && (
            <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center rounded">
              <span className="font-mono text-[6px] text-[var(--neon-amber)] animate-pulse">
                REBOOTING...
              </span>
            </div>
          )}

          {(deviceState === 'standby' || deviceState === 'shutdown') && (
            <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center rounded">
              <span className="font-mono text-[6px] text-[var(--neon-red)]/60">
                {shutdownPhase ? shutdownPhase.toUpperCase() : 'STANDBY'}
              </span>
            </div>
          )}

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
      </div>
    </PanelFrame>
  )
}

// ==================================================
// MATERIAL SCANNER - Resource detection device
// ==================================================
// ==================================================
// MATERIAL SCANNER - Tier 1 Resource Detection
// ==================================================
type ScannerState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type ScannerTestPhase = 'emitter' | 'receiver' | 'calibrate' | 'sweep' | 'complete' | null
type ScannerBootPhase = 'post' | 'sensors' | 'calibrate' | 'ready' | null

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
  const manager = useMSCManagerOptional()
  const deviceState: ScannerState = manager?.deviceState ?? 'booting'
  const testPhase: ScannerTestPhase = manager?.testPhase ?? null
  const bootPhase: ScannerBootPhase = manager?.bootPhase ?? null
  const isPowered = manager?.isPowered ?? true
  const isExpanded = manager?.isExpanded ?? true
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

  const handlePower = useCallback(() => {
    if (!manager) return
    if (deviceState === 'standby') manager.powerOn()
    else if (deviceState === 'online') manager.powerOff()
  }, [manager, deviceState])
  const handleFoldToggle = useCallback(() => manager?.toggleExpanded(), [manager])

  // Folded info toggle
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) {
        foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }

  useEffect(() => {
    return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) }
  }, [])

  // Scanning animation when online
  useEffect(() => {
    if (deviceState !== 'online') return

    const scanInterval = setInterval(() => {
      setScanLine(prev => {
        const next = prev + 2
        if (next > 100) {
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

  // Clear scan data when powered off
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') {
      setScanLine(0)
      setFoundMaterials([])
    }
  }, [deviceState])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-cyan)'
      case 'booting': return 'var(--neon-green)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-cyan)'
    }
  }

  const stateLabel = deviceState === 'online' ? 'SCANNING' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  // Ultra-thin nano button helper
  const thinBtn = (onClick: () => void, disabled: boolean, title: string, activeColor: string, isActive: boolean, edgePos: 'top' | 'bottom', edgeColor: string, edgeVisible: boolean) => (
    <button onClick={onClick} disabled={disabled} className="group relative" title={title}>
      <div className="w-4 h-1.5 rounded-sm border transition-all" style={{
        background: 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2a 100%)',
        borderColor: isActive ? activeColor : '#3a3a4a',
        boxShadow: isActive ? `0 0 4px ${activeColor}, inset 0 0 2px ${activeColor}` : 'inset 0 0.5px 1px rgba(0,0,0,0.5)',
      }} />
      <div className={cn('absolute inset-x-0 h-px', edgePos === 'top' ? 'top-0 rounded-t-sm' : 'bottom-0 rounded-b-sm')} style={{
        background: edgeVisible ? edgeColor : 'transparent',
        opacity: edgeVisible ? 0.7 : 0,
        boxShadow: edgeVisible ? `0 0 3px ${edgeColor}` : 'none',
      }} />
    </button>
  )

  return (
    <PanelFrame variant="teal" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
        }}
        className="w-full"
      >
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* LED */}
          <div className="w-1.5 h-1.5 rounded-full shrink-0 transition-all" style={{
            backgroundColor: getStatusColor(),
            boxShadow: `0 0 4px ${getStatusColor()}`,
            animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }} />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-cyan)]">MSC-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-cyan)]/70' : 'text-white/30')}>
            {stateLabel}
          </span>
          <div className="flex-1" />
          {isPowered && (
            <>
              {thinBtn(() => manager?.runTest(), deviceState !== 'online', 'Test', 'var(--neon-purple)', deviceState === 'testing', 'top', 'var(--neon-cyan)', deviceState === 'online')}
              {thinBtn(() => manager?.reboot(), deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot', 'var(--neon-amber)', deviceState === 'rebooting', 'bottom', 'var(--neon-amber)', deviceState === 'online')}
            </>
          )}
          {/* Power dot */}
          <button
            onClick={handlePower}
            disabled={!manager || (deviceState !== 'online' && deviceState !== 'standby')}
            className="group"
            title={deviceState === 'standby' ? 'Power On' : 'Power Off'}
          >
            <div className="w-[5px] h-[5px] rounded-full border transition-all" style={{
              background: deviceState === 'standby' ? 'radial-gradient(circle, #1a1a2a 40%, #0a0a1a 100%)' : 'radial-gradient(circle, #2a3a2a 40%, #1a2a1a 100%)',
              borderColor: deviceState === 'online' ? 'var(--neon-cyan)' : '#333',
              boxShadow: deviceState === 'online' ? '0 0 3px var(--neon-cyan), inset 0 0 1px var(--neon-cyan)' : 'inset 0 0.5px 1px rgba(0,0,0,0.5)',
            }} />
          </button>
          {/* Info toggle */}
          {isPowered ? (
            <button onClick={toggleFoldedInfo} className="group relative" title={showFoldedInfo ? 'Hide info' : 'Show info'}>
              <div className="w-4 h-1.5 rounded-sm border border-white/20 flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2a 100%)' }}>
                <span className="font-mono text-[5px] text-[var(--neon-cyan)]/60">{showFoldedInfo ? '▲' : '▼'}</span>
              </div>
            </button>
          ) : <div className="w-4" />}
        </div>

        {/* Folded info expansion */}
        <div style={{
          maxHeight: showFoldedInfo && isPowered ? '40px' : '0px',
          transition: 'max-height 400ms ease, opacity 300ms ease',
          opacity: showFoldedInfo && isPowered ? 1 : 0,
          overflow: 'hidden',
        }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-cyan)]/60 flex gap-3 flex-wrap">
            <span>Materials: {deviceState === 'online' ? foundMaterials.length : '--'}</span>
            <span>Tier: T1</span>
            <span>Draw: {manager?.currentDraw?.toFixed(1) ?? '0.0'} E/s</span>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
        }}
        className="w-full p-2"
      >
        {/* Standby / Shutdown overlay */}
        {(deviceState === 'standby' || deviceState === 'shutdown') && (
          <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center">
            <span className="font-mono text-[7px] text-white/30">
              {deviceState === 'shutdown' ? 'SHUTTING DOWN...' : 'STANDBY'}
            </span>
          </div>
        )}

        {/* Power button — bottom-left */}
        <button
          onClick={handlePower}
          disabled={!manager || (deviceState !== 'online' && deviceState !== 'standby')}
          className="absolute bottom-1 left-1 z-30 group"
          title={deviceState === 'standby' ? 'Power On' : 'Power Off'}
        >
          <div className="w-[5px] h-[5px] rounded-full border transition-all" style={{
            background: deviceState === 'standby' ? 'radial-gradient(circle, #1a1a2a 40%, #0a0a1a 100%)' : 'radial-gradient(circle, #2a3a2a 40%, #1a2a1a 100%)',
            borderColor: deviceState === 'online' ? 'var(--neon-cyan)' : '#333',
            boxShadow: deviceState === 'online' ? '0 0 3px var(--neon-cyan), inset 0 0 1px var(--neon-cyan)' : 'inset 0 0.5px 1px rgba(0,0,0,0.5)',
          }} />
        </button>

        {/* Stacked nano buttons - top right */}
        <div className="absolute top-1 right-1 flex flex-col gap-px z-10">
          {/* Fold chevron */}
          <button onClick={handleFoldToggle} className="group relative" title="Fold">
            <div className="w-4 h-1.5 rounded-sm border border-white/20 flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2a 100%)' }}>
              <span className="font-mono text-[5px] text-[var(--neon-cyan)]/60">▴</span>
            </div>
          </button>
          {/* Test button */}
          {thinBtn(() => manager?.runTest(), deviceState !== 'online', 'Test', 'var(--neon-purple)', deviceState === 'testing', 'top', 'var(--neon-cyan)', deviceState === 'online')}
          {/* Reboot button */}
          {thinBtn(() => manager?.reboot(), deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot', 'var(--neon-amber)', deviceState === 'rebooting', 'bottom', 'var(--neon-amber)', deviceState === 'online')}
        </div>

        {/* Company logo */}
        <div className="absolute font-mono text-[4px] text-white/15 pointer-events-none z-0" style={logoPosition}>SCNR</div>

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full transition-all" style={{
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 4px ${getStatusColor()}`,
              animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
            }} />
            <div className="font-mono text-[9px] text-[var(--neon-cyan)]">MATERIAL SCANNER</div>
          </div>
        </div>

        {/* Scanning visualization */}
        <div className="relative h-6 bg-black/40 rounded overflow-hidden mb-1">
          {deviceState === 'booting' && bootPhase && (
            <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[6px] text-[var(--neon-cyan)]">
                  {bootPhase === 'post' && 'POST'}
                  {bootPhase === 'sensors' && 'SENSORS'}
                  {bootPhase === 'calibrate' && 'CALIBRATE'}
                  {bootPhase === 'ready' && 'READY'}
                </span>
                <div className="flex gap-0.5">
                  {(['post', 'sensors', 'calibrate', 'ready'] as const).map((phase, i) => (
                    <div key={phase} className="w-1 h-1 rounded-full" style={{
                      backgroundColor: (['post', 'sensors', 'calibrate', 'ready'] as const).indexOf(bootPhase!) >= i ? 'var(--neon-cyan)' : '#333',
                      boxShadow: bootPhase === phase ? '0 0 4px var(--neon-cyan)' : 'none',
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {deviceState === 'rebooting' && (
            <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center">
              <span className="font-mono text-[6px] text-[var(--neon-amber)] animate-pulse">REBOOTING...</span>
            </div>
          )}

          {deviceState === 'testing' && testPhase && (
            <div className="absolute inset-0 bg-black/80 z-10 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[6px] text-[var(--neon-purple)]">{testPhase.toUpperCase()}</span>
                <div className="flex gap-0.5">
                  {(['emitter', 'receiver', 'calibrate', 'sweep'] as const).map((phase) => (
                    <div key={phase} className="w-1 h-1 rounded-full" style={{
                      backgroundColor: testPhase === phase ? 'var(--neon-purple)' :
                        (['emitter', 'receiver', 'calibrate', 'sweep'] as const).indexOf(phase) <
                        (['emitter', 'receiver', 'calibrate', 'sweep'] as const).indexOf(testPhase as 'emitter' | 'receiver' | 'calibrate' | 'sweep')
                          ? 'var(--neon-green)' : '#333',
                      boxShadow: testPhase === phase ? '0 0 4px var(--neon-purple)' : 'none',
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {deviceState === 'online' && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--neon-cyan)]" style={{
              left: `${scanLine}%`,
              boxShadow: '0 0 8px var(--neon-cyan), 0 0 16px var(--neon-cyan)',
            }} />
          )}

          {deviceState === 'online' && foundMaterials.map((pos, i) => (
            <div key={i} className="absolute w-1 h-1 rounded-full bg-[var(--neon-green)] transition-opacity" style={{
              left: `${pos}%`, top: '50%', transform: 'translateY(-50%)',
              boxShadow: '0 0 4px var(--neon-green)', opacity: scanLine > pos ? 1 : 0.3,
            }} />
          ))}

          <div className="absolute inset-0 pointer-events-none opacity-20" style={{
            backgroundImage: 'linear-gradient(90deg, var(--neon-cyan) 1px, transparent 1px)',
            backgroundSize: '20% 100%',
          }} />
        </div>

        {/* Footer */}
        <div className="flex justify-between font-mono text-[7px]">
          <span className="text-white/40">MATERIALS</span>
          <span className="text-[var(--neon-green)]">
            {deviceState === 'online' ? `${foundMaterials.length} FOUND` : '-- --'}
          </span>
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// RESOURCE MAGNET - Tier 1 Gadget passive resource attraction
// ==================================================
type MagnetState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
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
  const rmg = useRMGManagerOptional()
  const deviceState = rmg?.deviceState ?? 'online'
  const testPhase = rmg?.testPhase ?? null
  const bootPhase = rmg?.bootPhase ?? null
  const shutdownPhase = rmg?.shutdownPhase ?? null
  const testResult = rmg?.testResult ?? null
  const statusMessage = rmg?.statusMessage ?? 'ACTIVE'
  const isPowered = rmg?.isPowered ?? true
  const isExpanded = rmg?.isExpanded ?? true
  const strength = rmg?.strength ?? magnetStrength
  const fieldActive = (rmg?.fieldActive ?? true) && (deviceState === 'online' || deviceState === 'testing')
  const displayStrength = deviceState === 'online' || deviceState === 'testing' ? strength : 0

  const handleTest = useCallback(() => { rmg?.runTest(); onTest?.() }, [rmg, onTest])
  const handleReboot = useCallback(() => { rmg?.reboot(); onReset?.() }, [rmg, onReset])
  const handleSetStrength = useCallback((value: number) => rmg?.setStrength(value), [rmg])
  const handlePower = useCallback(() => {
    if (deviceState === 'online') rmg?.powerOff()
    else if (deviceState === 'standby') rmg?.powerOn()
  }, [rmg, deviceState])
  const handleFoldToggle = useCallback(() => rmg?.toggleExpanded(), [rmg])

  // Folded info toggle
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) {
        foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }

  useEffect(() => {
    return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) }
  }, [])

  const getLedColor = () => {
    if (deviceState === 'standby' || deviceState === 'shutdown' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return 'green'
  }

  const isLedOn = deviceState !== 'standby' && deviceState !== 'shutdown' && !(deviceState === 'rebooting')
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  // Chrome metal button helper
  const chromeBtn = (onClick: () => void, disabled: boolean, title: string, style: 'chrome' | 'brass', dotColor: string, dotGlow?: string) => (
    <button onClick={onClick} disabled={disabled} className="group relative disabled:opacity-30" title={title}>
      <div className={cn('w-3 h-2 rounded-[2px] transition-all flex items-center justify-center group-active:scale-95')}
        style={{
          background: style === 'chrome'
            ? 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 15%, #a0a0a0 50%, #808080 85%, #606060 100%)'
            : 'linear-gradient(180deg, #f0d0a0 0%, #d4a060 15%, #b08040 50%, #906020 85%, #704000 100%)',
          boxShadow: style === 'chrome'
            ? 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)'
            : 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)',
          border: style === 'chrome' ? '0.5px solid #707070' : '0.5px solid #8a6030',
        }}
      >
        <div className="absolute inset-0 rounded-[2px] opacity-40" style={{
          backgroundImage: style === 'chrome'
            ? 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.2) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 40%, transparent 60%, rgba(255,220,150,0.3) 100%)',
        }} />
        <div className={cn('w-1 h-1 rounded-full transition-all z-10')} style={{
          backgroundColor: dotColor,
          boxShadow: dotGlow ? `0 0 3px ${dotGlow}` : 'none',
        }} />
      </div>
    </button>
  )

  // Copper power toggle
  const copperPowerBtn = (
    <button
      onClick={handlePower}
      disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'shutdown'}
      className="group relative disabled:opacity-30"
      title="Power"
    >
      <div className="flex items-center justify-center group-active:scale-95"
        style={{
          width: '3px', height: '5px',
          background: 'linear-gradient(180deg, #c09060 0%, #906030 50%, #604020 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 1px rgba(0,0,0,0.4)',
          border: '0.5px solid #7a5030', borderRadius: '1px',
        }}
      >
        <div className="w-0.5 h-0.5 rounded-full" style={{
          backgroundColor: isPowered && deviceState !== 'standby' ? 'var(--neon-green)' : deviceState === 'standby' ? 'var(--neon-red)' : '#5a4020',
          boxShadow: isPowered && deviceState !== 'standby' ? '0 0 2px var(--neon-green)' : deviceState === 'standby' ? '0 0 2px var(--neon-red)' : 'none',
        }} />
      </div>
    </button>
  )

  return (
    <PanelFrame variant="military" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
        }}
        className="w-full"
      >
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <LED on={isLedOn} color={getLedColor()} size="sm" />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-lime,#bfff00)]">RMG-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-lime,#bfff00)]/70' : 'text-white/30')}>
            {stateLabel}
          </span>
          <div className="flex-1" />
          {isPowered && (
            <>
              {chromeBtn(handleTest, deviceState !== 'online', 'Test', 'chrome',
                deviceState === 'testing' ? 'var(--neon-cyan)' : testResult === 'pass' ? 'var(--neon-green)' : '#404040',
                deviceState === 'testing' ? 'var(--neon-cyan)' : testResult === 'pass' ? 'var(--neon-green)' : undefined)}
              {chromeBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing', 'Reboot', 'brass',
                deviceState === 'rebooting' || deviceState === 'booting' ? 'var(--neon-amber)' : '#5a4020',
                deviceState === 'rebooting' || deviceState === 'booting' ? 'var(--neon-amber)' : undefined)}
            </>
          )}
          {copperPowerBtn}
          {isPowered ? (
            <button
              onClick={toggleFoldedInfo}
              className="group relative"
              title={showFoldedInfo ? 'Hide info' : 'Show info'}
            >
              <div className="w-3 h-2 rounded-[2px] flex items-center justify-center"
                style={{
                  background: 'linear-gradient(180deg, #e8e8e8 0%, #a0a0a0 50%, #606060 100%)',
                  border: '0.5px solid #707070',
                }}
              >
                <span className="font-mono text-[6px] text-[#333] relative z-10">{showFoldedInfo ? '▲' : '▼'}</span>
              </div>
            </button>
          ) : <div className="w-3" />}
        </div>

        {/* Folded info expansion */}
        <div style={{
          maxHeight: showFoldedInfo && isPowered ? '40px' : '0px',
          transition: 'max-height 400ms ease, opacity 300ms ease',
          opacity: showFoldedInfo && isPowered ? 1 : 0,
          overflow: 'hidden',
        }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-lime,#bfff00)]/60 flex gap-3 flex-wrap">
            <span>Strength: {displayStrength}%</span>
            <span>Field: {fieldActive ? 'ACTIVE' : 'OFF'}</span>
            <span>Tier: T1</span>
            <span>Draw: {rmg?.currentDraw?.toFixed(1) ?? '0.0'} E/s</span>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
        }}
        className="w-full p-2"
      >
        {/* Header with shiny metal buttons */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <LED on={isLedOn} color={getLedColor()} size="sm" />
            <div className="font-mono text-[8px] text-[var(--neon-lime,#bfff00)]">
              RESOURCE MAGNET
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            {/* Fold chevron - chrome style */}
            <button onClick={handleFoldToggle} className="group relative" title="Fold">
              <div className="w-3 h-2 rounded-[2px] flex items-center justify-center group-active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #e8e8e8 0%, #a0a0a0 50%, #606060 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)',
                  border: '0.5px solid #707070',
                }}
              >
                <span className="font-mono text-[6px] text-[#333] relative z-10">▴</span>
              </div>
            </button>
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
            {chromeBtn(handleTest, deviceState !== 'online', 'Test', 'chrome',
              deviceState === 'testing' ? 'var(--neon-cyan)' : testResult === 'pass' ? 'var(--neon-green)' : '#404040',
              deviceState === 'testing' ? 'var(--neon-cyan)' : testResult === 'pass' ? 'var(--neon-green)' : undefined)}
            {chromeBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing', 'Reboot', 'brass',
              deviceState === 'rebooting' || deviceState === 'booting' ? 'var(--neon-amber)' : '#5a4020',
              deviceState === 'rebooting' || deviceState === 'booting' ? 'var(--neon-amber)' : undefined)}
            {copperPowerBtn}
            <div className="font-mono text-[5px] text-white/30">T1</div>
          </div>
        </div>

        {/* Magnet field visualization */}
        <div className={cn(
          'relative h-8 bg-black/40 rounded flex items-center justify-center overflow-hidden',
          deviceState === 'testing' && testPhase === 'field' && 'ring-1 ring-[var(--neon-green)]/50'
        )}>
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

          {deviceState === 'testing' && testPhase === 'calibrate' && (
            <div className="absolute inset-0 bg-[var(--neon-green)]/10 animate-pulse" />
          )}

          {(deviceState === 'standby' || deviceState === 'shutdown') && (
            <div className="absolute inset-0 bg-black/80 z-10 flex items-center justify-center rounded">
              <span className="font-mono text-[6px] text-[var(--neon-red)]/60">
                {shutdownPhase ? shutdownPhase.toUpperCase() : 'STANDBY'}
              </span>
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between mt-1">
          <Knob
            value={strength}
            onChange={handleSetStrength}
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
            <div className="font-mono text-[10px] text-[var(--neon-green)]">{displayStrength}%</div>
            <div className="font-mono text-[6px] text-white/30">FIELD</div>
          </div>
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
interface QuantumCompassProps {
  className?: string
}

export function QuantumCompass({
  className,
}: QuantumCompassProps) {
  const qcpManager = useQCPManagerOptional()
  const [needleWobble, setNeedleWobble] = useState(0)

  // Read state from manager with fallback defaults
  const deviceState = qcpManager?.deviceState ?? 'online'
  const statusMessage = qcpManager?.statusMessage ?? 'ANOMALY DETECTED'
  const displayDirection = qcpManager?.anomalyDirection ?? 127
  const displayDistance = qcpManager?.anomalyDistance ?? 42
  const testResult = qcpManager?.testResult ?? null
  const isPowered = qcpManager?.isPowered ?? true
  const isExpanded = qcpManager?.isExpanded ?? true

  const handleFoldToggle = useCallback(() => qcpManager?.toggleExpanded(), [qcpManager])

  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) { foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000) }
      return next
    })
  }
  useEffect(() => { return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) } }, [])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  // Animate needle wobble (pure visual, stays local)
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return
    const interval = setInterval(() => {
      const wobbleAmount = deviceState === 'testing' ? 15 : 3
      setNeedleWobble((Math.random() - 0.5) * wobbleAmount)
    }, 150)
    return () => clearInterval(interval)
  }, [deviceState])

  const handleTest = () => {
    qcpManager?.runTest()
  }

  const handleReboot = () => {
    qcpManager?.reboot()
  }

  const handlePowerToggle = () => {
    if (qcpManager?.isPowered) {
      qcpManager?.powerOff()
    } else {
      qcpManager?.powerOn()
    }
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const hasAnomaly = displayDistance < 100

  return (
    <PanelFrame variant="default" className={cn('overflow-hidden relative', className)} style={{ perspective: '600px' }}>
      {/* Folded front panel */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
      }} className="w-full">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
            backgroundColor: getStatusColor(), boxShadow: `0 0 4px ${getStatusColor()}`,
            animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }} />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-amber)]">QCP-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-amber)]/70' : 'text-white/30')}>{stateLabel}</span>
          <div className="flex-1" />
          {isPowered && (<>
            <button onClick={handleTest} disabled={deviceState !== 'online'} className="group relative" title="Test">
              <div className="w-3 h-3 rounded-full border transition-all" style={{
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a',
                boxShadow: deviceState === 'testing' ? '0 0 6px var(--neon-purple), inset 0 0 3px var(--neon-purple)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                opacity: deviceState !== 'online' ? 0.3 : 1,
              }} />
            </button>
            <button onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting'} className="group relative" title="Reboot">
              <div className="w-3 h-3 rounded-full border transition-all" style={{
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a',
                boxShadow: deviceState === 'rebooting' ? '0 0 6px var(--neon-amber), inset 0 0 3px var(--neon-amber)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                opacity: deviceState === 'booting' || deviceState === 'rebooting' ? 0.3 : 1,
              }} />
            </button>
          </>)}
          {/* Triangular power button */}
          <button onClick={handlePowerToggle} className="relative" title={isPowered ? 'Power off' : 'Power on'}>
            <div style={{
              width: '5px', height: '5px',
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              background: isPowered ? 'var(--neon-amber)' : '#333',
              boxShadow: isPowered ? '0 0 4px var(--neon-amber)' : 'none',
              transition: 'all 0.2s ease',
            }} />
          </button>
          {/* Info toggle */}
          {isPowered ? (
            <button onClick={toggleFoldedInfo} className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-amber)]/40 transition-colors" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }} title={showFoldedInfo ? 'Hide info' : 'Show info'}>
              <span className="font-mono text-[6px] text-[var(--neon-amber)]/60">{showFoldedInfo ? '\u25B2' : '\u25BC'}</span>
            </button>
          ) : <div className="w-3" />}
        </div>
        <div style={{ maxHeight: showFoldedInfo && isPowered ? '40px' : '0px', transition: 'max-height 400ms ease, opacity 300ms ease', opacity: showFoldedInfo && isPowered ? 1 : 0, overflow: 'hidden' }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-amber)]/60 flex gap-3 flex-wrap">
            <span>Dir: {displayDirection}&deg;</span>
            <span>Dist: {displayDistance}m</span>
            <span>Tier: T1</span>
          </div>
        </div>
      </div>

      {/* Unfolded inner panel */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
      }} className="w-full p-1.5">
        <button onClick={handleFoldToggle} className="absolute top-1 right-1 z-10 group" title="Fold">
          <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center transition-all hover:border-[var(--neon-amber)]/40" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}>
            <span className="font-mono text-[6px] text-[var(--neon-amber)]/60">{'\u25B4'}</span>
          </div>
        </button>

        {/* Header with logo */}
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[8px] text-[var(--neon-amber)]">
          QUANTUM COMPASS
        </div>
        <div className="flex items-center gap-1">
          {/* Power button - triangular */}
          <button
            onClick={handlePowerToggle}
            title={isPowered ? 'Power off' : 'Power on'}
            className="relative"
          >
            <div
              style={{
                width: '5px',
                height: '5px',
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                background: isPowered ? 'var(--neon-amber)' : '#333',
                boxShadow: isPowered ? '0 0 4px var(--neon-amber)' : 'none',
                transition: 'all 0.2s ease',
              }}
            />
          </button>
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

        {/* Standby overlay */}
        {(deviceState === 'standby' || deviceState === 'shutdown') && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 rounded">
            <span className="font-mono text-[7px] text-white/40">
              STANDBY
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
      </div>
    </PanelFrame>
  )
}

// ==================================================
// PORTABLE WORKBENCH - Mobile crafting station
// ==================================================
// PWB-001 - Tier 1 Mobile Bench for prototyping
// ==================================================
type WorkbenchState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline' | 'standby' | 'shutdown'
type WorkbenchTestPhase = 'motors' | 'clamps' | 'sensors' | 'calibrate' | 'complete' | null
type WorkbenchBootPhase = 'init' | 'motors' | 'surface' | 'ready' | null

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
  const pwb = usePWBManagerOptional()

  // Use manager state if available, otherwise fall back to local defaults
  const deviceState = pwb?.deviceState ?? 'online'
  const testPhase = pwb?.testPhase ?? null
  const bootPhase = pwb?.bootPhase ?? null
  const activeSlot = pwb?.activeSlot ?? null
  const isPowered = pwb?.isPowered ?? true
  const shutdownPhase = pwb?.shutdownPhase ?? null
  const isExpanded = pwb?.isExpanded ?? true
  const currentDraw = pwb?.currentDraw ?? 0.8

  const isCrafting = craftingProgress > 0 && craftingProgress < 100

  // Folded info toggle
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = useCallback(() => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
      if (next) {
        foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }, [])

  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  // Random button style for nano buttons (memoized on mount)
  const [buttonStyle] = useState(() => {
    const styles = ['round', 'square', 'pill'] as const
    return styles[Math.floor(Math.random() * styles.length)]
  })

  // Random logo position (memoized on mount)
  const [logoPosition] = useState(() => {
    const positions = [
      { bottom: '3px', right: '3px' },
      { bottom: '3px', left: '24px' },
      { top: '18px', right: '3px' },
      { top: '18px', left: '24px' },
    ]
    return positions[Math.floor(Math.random() * positions.length)]
  })

  // Manager-driven callbacks
  const runTest = useCallback(() => pwb?.runTest(), [pwb])
  const reboot = useCallback(() => pwb?.reboot(), [pwb])
  const selectSlot = useCallback((slot: number) => pwb?.selectSlot(slot), [pwb])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': return 'var(--neon-red)'
      case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }

  const getStatusLabel = () => {
    switch (deviceState) {
      case 'online': return 'ONLINE'
      case 'booting': return 'BOOT'
      case 'testing': return 'TEST'
      case 'rebooting': return 'REBOOT'
      case 'standby': return 'STANDBY'
      case 'shutdown': return 'SHTDWN'
      default: return 'ONLINE'
    }
  }

  // Button shape based on random style
  const getButtonClass = () => {
    switch (buttonStyle) {
      case 'round': return 'rounded-full'
      case 'square': return 'rounded-sm'
      case 'pill': return 'rounded-full'
      default: return 'rounded-full'
    }
  }

  const getButtonSize = () => {
    switch (buttonStyle) {
      case 'pill': return 'w-4 h-2'
      default: return 'w-2.5 h-2.5'
    }
  }

  return (
    <PanelFrame variant="default" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%', left: 0, top: 0,
      }}>
        <div className="px-2 py-1.5">
          {/* Main folded row */}
          <div className="flex items-center gap-1.5">
            {/* Status LED */}
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: getStatusColor(),
                boxShadow: `0 0 4px ${getStatusColor()}`,
                animation: (deviceState === 'booting' || deviceState === 'rebooting') ? 'pulse 0.5s ease-in-out infinite' : 'none',
              }}
            />
            {/* Device ID */}
            <span className="font-mono text-[8px] text-[var(--neon-amber)] font-bold tracking-wide">PWB-001</span>
            {/* Status label */}
            <span className="font-mono text-[7px] text-white/50">{getStatusLabel()}</span>
            <div className="flex-1" />

            {/* Action buttons - only when powered */}
            {isPowered && (
              <>
                {/* Test nano button */}
                <button
                  onClick={runTest}
                  disabled={deviceState !== 'online'}
                  className="group relative"
                  title="Test"
                >
                  <div
                    className={cn('transition-all border', getButtonClass(), getButtonSize())}
                    style={{
                      background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                      borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a',
                      boxShadow: deviceState === 'testing'
                        ? '0 0 5px var(--neon-purple), inset 0 0 2px var(--neon-purple)'
                        : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                    }}
                  />
                </button>
                {/* Reboot nano button */}
                <button
                  onClick={reboot}
                  disabled={!isPowered}
                  className="group relative"
                  title="Reboot"
                >
                  <div
                    className={cn('transition-all border', getButtonClass(), getButtonSize())}
                    style={{
                      background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                      borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a',
                      boxShadow: deviceState === 'rebooting'
                        ? '0 0 5px var(--neon-amber), inset 0 0 2px var(--neon-amber)'
                        : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                    }}
                  />
                </button>
              </>
            )}

            {/* Power micro-toggle */}
            <button
              onClick={() => {
                if (deviceState === 'online') pwb?.powerOff()
                else if (deviceState === 'standby') pwb?.powerOn()
              }}
              disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'shutdown'}
              className="group relative flex items-center justify-center flex-shrink-0"
              title="Power"
              style={{ width: '6px', height: '6px' }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, #0a0a0f 0%, #1a1a2a 70%)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 0.5px 0 rgba(255,255,255,0.05)',
                  border: '0.5px solid #2a2a3a',
                }}
              />
              <div
                className="relative rounded-full"
                style={{
                  width: '2px', height: '2px',
                  backgroundColor: isPowered ? 'var(--neon-green)' : 'var(--neon-red)',
                  boxShadow: isPowered ? '0 0 3px var(--neon-green)' : '0 0 2px var(--neon-red)',
                  opacity: deviceState === 'shutdown' ? 0.3 : 0.7,
                }}
              />
            </button>

            {/* Info / Unfold toggle */}
            {isPowered ? (
              <button
                onClick={toggleFoldedInfo}
                className="font-mono text-[7px] text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
                title={showFoldedInfo ? 'Hide info' : 'Show info'}
              >
                {showFoldedInfo ? '▲' : '▼'}
              </button>
            ) : (
              <button
                onClick={() => pwb?.setExpanded(true)}
                className="font-mono text-[7px] text-white/30 hover:text-white/50 transition-colors flex-shrink-0"
                title="Unfold"
              >
                ▼
              </button>
            )}
          </div>

          {/* Folded info expansion */}
          <div style={{
            maxHeight: showFoldedInfo && isPowered ? '40px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}>
            <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 font-mono text-[6px]">
              <span className="text-white/30">Slots: <span className="text-[var(--neon-amber)]">3</span></span>
              <span className="text-white/30">Queue: <span className="text-[var(--neon-amber)]">{queuedItems}</span></span>
              <span className="text-white/30">Prog: <span className="text-[var(--neon-amber)]">{craftingProgress}%</span></span>
              <span className="text-white/30">Active: <span className="text-[var(--neon-cyan)]">{activeSlot !== null ? `S${activeSlot}` : '--'}</span></span>
              <span className="text-white/30">Draw: <span className="text-[var(--neon-amber)]">{currentDraw.toFixed(1)}</span></span>
              <span className="text-white/30">Tier: <span className="text-white/50">T1</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%', left: 0, top: 0,
      }}>
        {/* Fold chevron */}
        <button
          onClick={() => pwb?.setExpanded(false)}
          className="absolute top-0.5 right-1 z-20 font-mono text-[7px] text-white/30 hover:text-white/60 transition-colors"
          title="Fold"
        >
          ▴
        </button>

        <div className="p-2">
          {/* Thin nano buttons - LEFT SIDE vertical strip */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
            {/* Test button */}
            <button
              onClick={runTest}
              disabled={deviceState !== 'online'}
              className="group relative"
              title="Test"
            >
              <div
                className={cn('transition-all border', getButtonClass(), getButtonSize())}
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                  borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a',
                  boxShadow: deviceState === 'testing'
                    ? '0 0 5px var(--neon-purple), inset 0 0 2px var(--neon-purple)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              />
              <div
                className={cn('absolute inset-0 pointer-events-none', getButtonClass())}
                style={{
                  border: '1px solid',
                  borderColor: deviceState === 'online' ? 'var(--neon-cyan)' : 'transparent',
                  opacity: deviceState === 'online' ? 0.5 : 0,
                  animation: deviceState === 'testing' ? 'pulse 0.4s ease-in-out infinite' : 'none',
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
                className={cn('transition-all border', getButtonClass(), getButtonSize())}
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                  borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a',
                  boxShadow: deviceState === 'rebooting'
                    ? '0 0 5px var(--neon-amber), inset 0 0 2px var(--neon-amber)'
                    : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                }}
              />
              <div
                className={cn('absolute inset-0 pointer-events-none', getButtonClass())}
                style={{
                  border: '1px solid',
                  borderColor: deviceState === 'online' ? 'var(--neon-amber)' : 'transparent',
                  opacity: deviceState === 'online' ? 0.4 : 0,
                  animation: deviceState === 'rebooting' ? 'pulse 0.3s ease-in-out infinite' : 'none',
                }}
              />
            </button>
            {/* Power micro-toggle */}
            <button
              onClick={() => {
                if (deviceState === 'online') pwb?.powerOff()
                else if (deviceState === 'standby') pwb?.powerOn()
              }}
              disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'shutdown'}
              className="group relative flex items-center justify-center"
              title="Power"
              style={{ width: '6px', height: '6px' }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, #0a0a0f 0%, #1a1a2a 70%)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 0.5px 0 rgba(255,255,255,0.05)',
                  border: '0.5px solid #2a2a3a',
                }}
              />
              <div
                className="relative rounded-full"
                style={{
                  width: '2px',
                  height: '2px',
                  backgroundColor: (deviceState === 'online' || deviceState === 'booting' || deviceState === 'testing' || deviceState === 'rebooting')
                    ? 'var(--neon-green)'
                    : 'var(--neon-red)',
                  boxShadow: (deviceState === 'online' || deviceState === 'booting' || deviceState === 'testing' || deviceState === 'rebooting')
                    ? '0 0 3px var(--neon-green)'
                    : '0 0 2px var(--neon-red)',
                  opacity: (deviceState === 'shutdown') ? 0.3 : 0.7,
                }}
              />
            </button>
          </div>

          {/* Company logo - FABX (Fabrication Systems) */}
          <div
            className="absolute font-mono text-[5px] text-white/15 pointer-events-none z-0 tracking-wider"
            style={logoPosition}
          >
            FABX
          </div>

          {/* Header with left margin for buttons */}
          <div className="flex items-center justify-between mb-1 ml-5">
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
                PORTABLE WORKBENCH
              </div>
            </div>
            <div className="font-mono text-[7px] text-white/30">T1</div>
          </div>

          {/* Crafting slots area - all animations happen inside */}
          <div className="relative flex gap-1 mb-1 ml-5">
            {/* Boot animation inside slots area */}
            {deviceState === 'booting' && bootPhase && (
              <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center rounded">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[6px] text-[var(--neon-cyan)]">
                    {bootPhase === 'post' && 'POST'}
                    {bootPhase === 'firmware' && 'FIRMWARE'}
                    {bootPhase === 'calibration' && 'CALIBRATE'}
                    {bootPhase === 'tools' && 'TOOLS'}
                    {bootPhase === 'ready' && 'READY'}
                  </span>
                  <div className="flex gap-0.5">
                    {['post', 'firmware', 'calibration', 'tools', 'ready'].map((phase, i) => (
                      <div
                        key={phase}
                        className="w-1 h-1 rounded-full"
                        style={{
                          backgroundColor: ['post', 'firmware', 'calibration', 'tools', 'ready'].indexOf(bootPhase) >= i
                            ? 'var(--neon-cyan)'
                            : '#333',
                          boxShadow: bootPhase === phase ? '0 0 4px var(--neon-cyan)' : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Reboot animation inside slots area */}
            {deviceState === 'rebooting' && (
              <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center rounded">
                <span className="font-mono text-[6px] text-[var(--neon-amber)] animate-pulse">
                  REBOOTING...
                </span>
              </div>
            )}

            {/* Standby/Shutdown overlay */}
            {(deviceState === 'standby' || deviceState === 'shutdown') && (
              <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center rounded">
                <span className="font-mono text-[6px] text-[var(--neon-red)]/60">
                  {shutdownPhase ? shutdownPhase.toUpperCase() : 'STANDBY'}
                </span>
              </div>
            )}

            {/* Test animation inside slots area */}
            {deviceState === 'testing' && testPhase && (
              <div className="absolute inset-0 bg-black/80 z-10 flex items-center justify-center rounded">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[6px] text-[var(--neon-purple)]">
                    {testPhase.toUpperCase()}
                  </span>
                  <div className="flex gap-0.5">
                    {['motors', 'clamps', 'sensors', 'calibrate'].map((phase) => (
                      <div
                        key={phase}
                        className="w-1 h-1 rounded-full"
                        style={{
                          backgroundColor:
                            testPhase === phase ? 'var(--neon-purple)' :
                            ['motors', 'clamps', 'sensors', 'calibrate'].indexOf(phase) <
                            ['motors', 'clamps', 'sensors', 'calibrate'].indexOf(testPhase || 'motors')
                              ? 'var(--neon-green)' : '#333',
                          boxShadow: testPhase === phase ? '0 0 4px var(--neon-purple)' : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Crafting slot buttons */}
            {[0, 1, 2].map((slot) => {
              const hasItem = slot < queuedItems
              const isActive = activeSlot === slot
              return (
                <button
                  key={slot}
                  onClick={() => selectSlot(slot)}
                  disabled={deviceState !== 'online'}
                  className="flex-1 h-4 bg-black/40 rounded border transition-all"
                  style={{
                    borderColor: isActive
                      ? 'var(--neon-cyan)'
                      : hasItem ? 'var(--neon-amber)' : 'rgba(255,255,255,0.1)',
                    boxShadow: isActive
                      ? 'inset 0 0 6px var(--neon-cyan)'
                      : hasItem ? 'inset 0 0 4px var(--neon-amber)' : 'none',
                  }}
                >
                  {hasItem && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div
                        className="w-2 h-2 rounded-sm transition-all"
                        style={{
                          backgroundColor: isActive ? 'var(--neon-cyan)' : 'var(--neon-amber)',
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Progress bar with left margin */}
          <div className="h-1.5 bg-black/40 rounded overflow-hidden ml-5">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: deviceState === 'online' ? `${craftingProgress}%` : '0%',
                background: 'linear-gradient(90deg, var(--neon-amber), var(--neon-orange))',
                boxShadow: isCrafting && deviceState === 'online' ? '0 0 4px var(--neon-amber)' : 'none',
              }}
            />
          </div>

          <div className="flex justify-between font-mono text-[7px] mt-1 ml-5">
            <span className="text-white/40">QUEUE: {queuedItems}</span>
            <span className="text-[var(--neon-amber)]">{deviceState === 'online' ? `${craftingProgress}%` : '--'}</span>
          </div>
        </div>
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
// unOS Commands: mfr [status|power|firmware|test|reset|info]
// Functions: Power generation, Plasma containment
// Power: Full +250 E/s | Idle +150 E/s | Standby +25 E/s | Startup -500 E
// ==================================================
interface MicrofusionReactorProps {
  className?: string
  onTest?: () => void
  onReset?: () => void
  onPowerChange?: (powered: boolean) => void
}

export function MicrofusionReactor({
  className,
  onTest,
  onReset,
  onPowerChange,
}: MicrofusionReactorProps) {
  // Use shared MFRManager context for bidirectional sync
  const mfrManager = useMFRManagerOptional()

  // Derive all state from context when available
  const deviceState = mfrManager?.deviceState ?? 'booting'
  const bootPhase = mfrManager?.bootPhase
  const testPhase = mfrManager?.testPhase ?? null
  const testResult = mfrManager?.testResult ?? null
  const statusMessage = mfrManager?.statusMessage ?? 'Initializing...'
  const isPowered = mfrManager?.isPowered ?? true
  const powerOutput = mfrManager?.powerOutput ?? 0
  const stability = mfrManager?.stability ?? 0
  const ringSpeed = mfrManager?.ringSpeed ?? 0

  const handlePowerToggle = async () => {
    if (!mfrManager) return
    if (deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing') return

    if (isPowered && deviceState === 'online') {
      await mfrManager.powerOff()
      onPowerChange?.(false)
    } else if (!isPowered && deviceState === 'standby') {
      await mfrManager.powerOn()
      onPowerChange?.(true)
    }
  }

  const handleTest = async () => {
    if (!mfrManager || deviceState !== 'online') return
    await mfrManager.runTest()
    onTest?.()
  }

  const handleReboot = async () => {
    if (!mfrManager) return
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return
    await mfrManager.reboot()
    onReset?.()
  }

  const getLedColor = () => {
    if (!isPowered || deviceState === 'standby' || deviceState === 'shutdown') return 'red'
    if (deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return stability > 80 ? 'green' : 'amber'
  }

  const isLedOn = isPowered && deviceState !== 'standby' && deviceState !== 'shutdown'
  const coreActive = isPowered && (deviceState === 'online' || deviceState === 'testing' || (deviceState === 'booting' && bootPhase && bootPhase !== 'ignition'))

  // Fold state
  const isExpanded = mfrManager?.isExpanded ?? true
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleToggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
      if (next) {
        foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }

  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  // Atomic power button helper
  const AtomicPowerButton = () => (
    <button
      onClick={handlePowerToggle}
      disabled={deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'}
      className="group relative disabled:opacity-30"
      title={isPowered && deviceState === 'online' ? 'SCRAM (Power Off)' : 'Ignite (Power On)'}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" className="transition-all">
        {[0, 60, 120].map(angle => (
          <ellipse key={angle} cx="6" cy="6" rx="5" ry="2.5" fill="none"
            stroke={isPowered && deviceState === 'online' ? 'var(--neon-cyan)' : '#3a3a4a'}
            strokeWidth="0.4" transform={`rotate(${angle} 6 6)`} opacity="0.6" />
        ))}
        <circle cx="6" cy="6" r="1.5" fill={isPowered && deviceState === 'online' ? 'var(--neon-cyan)' : '#2a2a3a'} className="transition-all">
          {isPowered && deviceState === 'online' && (
            <animate attributeName="r" values="1.5;1.8;1.5" dur="1.5s" repeatCount="indefinite" />
          )}
        </circle>
        {isPowered && deviceState === 'online' && (
          <circle cx="6" cy="6" r="0.6" fill="#ffffff" opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      {isPowered && deviceState === 'online' && (
        <div className="absolute inset-0 rounded-full opacity-30" style={{ boxShadow: '0 0 6px var(--neon-cyan)' }} />
      )}
    </button>
  )

  // Hexagonal button helper
  const hexBtn = (onClick: () => void, disabled: boolean, title: string, borderColor: string, hoverColor: string, ledColor: string) => (
    <button onClick={onClick} disabled={disabled} className="group relative disabled:opacity-30" title={title}>
      <div className={cn(
        'w-2.5 h-2.5 transition-all',
        `bg-[#0a0a0f] border ${borderColor}`,
        'flex items-center justify-center',
        `group-hover:${hoverColor}`
      )}
      style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
      >
        <div className={cn('w-1 h-1 rounded-full transition-all', ledColor)} />
      </div>
    </button>
  )

  const testLedColor = deviceState === 'testing'
    ? 'bg-[var(--neon-cyan)] shadow-[0_0_4px_var(--neon-cyan)]'
    : testResult === 'pass'
    ? 'bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]'
    : testResult === 'fail'
    ? 'bg-[var(--neon-red)] shadow-[0_0_4px_var(--neon-red)]'
    : 'bg-white/20'

  const rebootLedColor = (deviceState === 'rebooting' || deviceState === 'booting')
    ? 'bg-[var(--neon-amber)] shadow-[0_0_4px_var(--neon-amber)]'
    : 'bg-white/20'

  const chevronBtn = (onClick: () => void, label: string, title: string, enabled = true) => (
    <button
      onClick={enabled ? onClick : undefined}
      className={cn(
        'w-3 h-3 flex items-center justify-center rounded-sm border border-[#3a3a4a] bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] transition-all',
        enabled ? 'cursor-pointer hover:border-[var(--neon-cyan)]/50' : 'opacity-30 cursor-default',
      )}
      title={title}
    >
      <span className="text-[6px] text-white/50">{label}</span>
    </button>
  )

  return (
    <PanelFrame variant="default" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>

      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%',
        left: 0,
        top: 0,
      }}>
        <div className="p-2">
          <div className="flex items-center gap-1.5">
            <LED on={isLedOn} color={getLedColor()} size="sm" />
            <span className="font-mono text-[9px] text-[var(--neon-cyan)] font-medium">MFR-001</span>
            <span className={cn(
              'font-mono text-[7px] ml-1',
              isPowered ? 'text-[var(--neon-green)]' : 'text-white/30'
            )}>
              {isPowered ? (deviceState === 'online' ? 'ONLINE' : deviceState.toUpperCase()) : 'STANDBY'}
            </span>
            <div className="flex-1" />
            {isPowered && (
              <>
                {hexBtn(handleTest, deviceState !== 'online', 'Test', 'border-[var(--neon-cyan)]/30', 'border-[var(--neon-cyan)]/60', testLedColor)}
                {hexBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot', 'border-[var(--neon-amber)]/30', 'border-[var(--neon-amber)]/60', rebootLedColor)}
              </>
            )}
            <AtomicPowerButton />
            {chevronBtn(handleToggleFoldedInfo, showFoldedInfo ? '▲' : '▼', showFoldedInfo ? 'Hide info' : 'Show info', isPowered)}
          </div>

          {/* Folded info expansion */}
          <div style={{
            maxHeight: showFoldedInfo && isPowered ? '80px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}>
            <div className="mt-1.5 pt-1 border-t border-white/5 grid grid-cols-3 gap-x-3 gap-y-0.5">
              {[
                ['Output', `${Math.round(powerOutput)} MW`],
                ['Stable', `${Math.round(stability)}%`],
                ['Plasma', `${Math.round(mfrManager?.plasmaTemp ?? 0)}K`],
                ['Effic', `${Math.round(mfrManager?.efficiency ?? 92)}%`],
                ['Tier', 'T2'],
                ['Type', 'GEN'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="font-mono text-[6px] text-white/30">{label}</span>
                  <span className="font-mono text-[6px] text-[var(--neon-cyan)]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%',
        left: 0,
        top: 0,
      }}>
        <div className="p-2">
          {/* Fold chevron */}
          <div className="absolute top-1 right-1 z-10">
            {chevronBtn(() => mfrManager?.toggleExpanded(), '▲', 'Fold')}
          </div>

          {/* Header with power button and nano LED buttons */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <LED on={isLedOn} color={getLedColor()} size="sm" />
              <div className="font-mono text-[9px] text-[var(--neon-cyan)]">
                MICROFUSION REACTOR
              </div>
            </div>

            <div className="flex items-center gap-1 mr-4">
              <AtomicPowerButton />
              {hexBtn(handleTest, deviceState !== 'online', 'Test', 'border-[var(--neon-cyan)]/30', 'border-[var(--neon-cyan)]/60', testLedColor)}
              {hexBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot', 'border-[var(--neon-amber)]/30', 'border-[var(--neon-amber)]/60', rebootLedColor)}
              <div className="font-mono text-[6px] text-white/30 ml-0.5">T2</div>
            </div>
          </div>

          {/* Reactor core visualization */}
          <div className={cn(
            'relative h-12 bg-black/40 rounded overflow-hidden flex items-center justify-center',
            deviceState === 'testing' && testPhase === 'containment' && 'ring-1 ring-[var(--neon-cyan)]/50'
          )}>
            {[1, 2, 3].map((ring) => (
              <div
                key={ring}
                className="absolute rounded-full border transition-all duration-500"
                style={{
                  width: `${ring * 25}%`,
                  height: `${ring * 50}%`,
                  borderColor: coreActive ? 'var(--neon-cyan)' : '#333',
                  opacity: coreActive ? (0.3 + ring * 0.15) * ringSpeed : 0.1,
                  animation: coreActive && ringSpeed > 0
                    ? `spin ${(3 + ring) / ringSpeed}s linear infinite ${ring % 2 === 0 ? 'reverse' : ''}`
                    : 'none',
                }}
              />
            ))}
            <div
              className="w-3 h-3 rounded-full transition-all duration-300"
              style={{
                background: coreActive
                  ? `radial-gradient(circle, #fff 0%, var(--neon-cyan) 60%, transparent 100%)`
                  : '#333',
                boxShadow: coreActive ? `0 0 ${10 + ringSpeed * 10}px var(--neon-cyan)` : 'none',
                opacity: deviceState === 'booting' ? 0.6 : 1,
              }}
            />
            {deviceState === 'testing' && testPhase === 'plasma' && (
              <div className="absolute inset-0 bg-[var(--neon-cyan)]/10 animate-pulse" />
            )}
            {(!isPowered || deviceState === 'standby') && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-[8px] text-white/30">STANDBY</span>
              </div>
            )}
          </div>

          {/* Status bar with values */}
          <div className="flex items-center font-mono text-[7px] mt-1 pt-1 border-t border-white/5">
            <span className={cn(
              'w-10 shrink-0 transition-colors',
              !isPowered || deviceState === 'standby' ? 'text-white/20' :
              deviceState === 'booting' ? 'text-white/30' : 'text-[var(--neon-cyan)]'
            )}>
              {Math.round(powerOutput)} MW
            </span>
            <span className={cn(
              'flex-1 text-[5px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
              deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
              deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
              !isPowered || deviceState === 'standby' ? 'text-white/20' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              testResult === 'fail' ? 'text-[var(--neon-red)]' :
              'text-white/30'
            )}>
              {statusMessage}
            </span>
            <span className={cn(
              'w-6 shrink-0 text-right transition-colors',
              !isPowered || deviceState === 'standby' ? 'text-white/20' :
              stability > 80 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-amber)]'
            )}>
              {Math.round(stability)}%
            </span>
          </div>
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// AI ASSISTANT CORE - Tier 2 Tech automation
// Uses AICManager context for bidirectional sync
// ==================================================
import { useAICManagerOptional } from '@/contexts/AICManager'

interface AIAssistantProps {
  className?: string
}

export function AIAssistant({ className }: AIAssistantProps) {
  const aicManager = useAICManagerOptional()

  // Get state from context with fallbacks
  const deviceState = aicManager?.deviceState ?? 'standby'
  const bootPhase = aicManager?.bootPhase
  const testPhase = aicManager?.testPhase
  const testResult = aicManager?.testResult ?? null
  const statusMessage = aicManager?.statusMessage ?? 'No context'
  const isPowered = aicManager?.isPowered ?? false
  const taskQueue = aicManager?.taskQueue ?? 0
  const efficiency = aicManager?.efficiency ?? 0
  const isLearning = aicManager?.isLearning ?? false
  const nodeActivity = aicManager?.nodeActivity ?? [0, 0, 0, 0, 0]

  const handlePowerToggle = async () => {
    if (!aicManager) return
    if (deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing') return

    if (deviceState === 'standby') {
      await aicManager.powerOn()
    } else if (deviceState === 'online') {
      await aicManager.powerOff()
    }
  }

  const handleTest = async () => {
    if (!aicManager || deviceState !== 'online') return
    await aicManager.runTest()
  }

  const handleReboot = async () => {
    if (!aicManager) return
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return
    await aicManager.reboot()
  }

  const getLedColor = () => {
    if (deviceState === 'standby' || deviceState === 'shutdown' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return 'green'
  }

  const isLedOn = deviceState !== 'standby' && deviceState !== 'shutdown' && !(deviceState === 'rebooting' && !bootPhase)
  const nodesActive = deviceState === 'online' || deviceState === 'testing' || (deviceState === 'booting' && bootPhase && ['nodes', 'training', 'calibrate', 'ready'].includes(bootPhase))
  const isTransitioning = deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting'

  // Fold state
  const isExpanded = aicManager?.isExpanded ?? true
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleToggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
      if (next) {
        foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }

  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  // Neural brain power button helper
  const NeuralPowerButton = () => (
    <button
      onClick={handlePowerToggle}
      disabled={isTransitioning || deviceState === 'testing'}
      className="group relative disabled:opacity-50"
      title={isPowered ? 'Power Off' : 'Power On'}
    >
      <div className={cn(
        'w-4 h-4 rounded-full relative transition-all duration-300 border',
        isPowered ? 'border-[var(--neon-green)]/60 bg-[#0a1a0f]' : 'border-white/20 bg-[#0a0a0a]',
        'group-hover:border-[var(--neon-green)]/80 group-active:scale-95',
        isTransitioning && 'animate-pulse'
      )}
      style={{
        boxShadow: isPowered ? '0 0 6px var(--neon-green), inset 0 0 4px rgba(0,255,100,0.2)' : 'inset 0 1px 3px rgba(0,0,0,0.8)',
      }}
      >
        <svg viewBox="0 0 16 16" className="absolute inset-0 w-full h-full">
          {[{ cx: 5.5, cy: 8, rx: 2.5, ry: 3 }, { cx: 10.5, cy: 8, rx: 2.5, ry: 3 }].map((lobe, i) => (
            <ellipse key={i} cx={lobe.cx} cy={lobe.cy} rx={lobe.rx} ry={lobe.ry} fill="none"
              stroke={isPowered ? 'var(--neon-green)' : '#333'} strokeWidth="0.5"
              className="transition-all duration-300"
              style={{ opacity: isPowered ? 0.8 : 0.3, filter: isPowered ? 'drop-shadow(0 0 2px var(--neon-green))' : 'none' }}
            />
          ))}
          <line x1="6" y1="8" x2="10" y2="8" stroke={isPowered ? 'var(--neon-green)' : '#333'} strokeWidth="0.5" style={{ opacity: isPowered ? 0.6 : 0.2 }} />
          {[{ cx: 4, cy: 6.5 }, { cx: 5.5, cy: 5.5 }, { cx: 7, cy: 7 }, { cx: 9, cy: 7 }, { cx: 10.5, cy: 5.5 }, { cx: 12, cy: 6.5 }, { cx: 5, cy: 9.5 }, { cx: 8, cy: 10 }, { cx: 11, cy: 9.5 }].map((node, i) => (
            <circle key={i} cx={node.cx} cy={node.cy} r={isPowered && isLearning ? 0.6 : 0.4}
              fill={isPowered ? 'var(--neon-green)' : '#222'} className="transition-all duration-300"
              style={{
                opacity: isPowered ? 0.4 + (nodeActivity[i % 5] || 0) * 0.6 : 0.2,
                filter: isPowered ? `drop-shadow(0 0 ${1 + (nodeActivity[i % 5] || 0) * 2}px var(--neon-green))` : 'none',
                animation: isPowered && isLearning ? `pulse ${0.6 + i * 0.15}s ease-in-out infinite` : 'none',
              }}
            />
          ))}
        </svg>
      </div>
    </button>
  )

  // Worn rubber button helper
  const rubberBtn = (onClick: () => void, disabled: boolean, title: string, isActive: boolean, activeBg: string, inactiveBg: string, borderColor: string, hoverColor: string, ledColor: string) => (
    <button onClick={onClick} disabled={disabled} className="group relative disabled:opacity-30" title={title}>
      <div className={cn(
        'w-2.5 h-2 rounded-sm transition-all flex items-center justify-center',
        isActive ? activeBg : inactiveBg,
        `border ${borderColor}`,
        `group-hover:${hoverColor}`,
        'group-active:scale-95'
      )}
      style={{
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), inset 0 -0.5px 0 rgba(255,255,255,0.05)',
      }}
      >
        <div className="absolute inset-0 rounded-sm opacity-30"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, rgba(255,255,255,0.1) 0%, transparent 50%)' }}
        />
        <div className={cn('w-1 h-1 rounded-full transition-all', ledColor)} />
      </div>
    </button>
  )

  const testLedColor = deviceState === 'testing' || testResult === 'pass'
    ? 'bg-[var(--neon-green)] shadow-[0_0_3px_var(--neon-green)]'
    : testResult === 'fail'
    ? 'bg-[var(--neon-red)] shadow-[0_0_3px_var(--neon-red)]'
    : 'bg-[#2a3a2a]'

  const rebootLedColor = (deviceState === 'rebooting' || deviceState === 'booting')
    ? 'bg-[var(--neon-amber)] shadow-[0_0_3px_var(--neon-amber)]'
    : 'bg-[#3a2a2a]'

  const chevronBtn = (onClick: () => void, label: string, title: string, enabled = true) => (
    <button
      onClick={enabled ? onClick : undefined}
      className={cn(
        'w-3 h-3 flex items-center justify-center rounded-sm border border-[#2a3a2a]/60 bg-gradient-to-b from-[#1a1f1a] to-[#0d120d] transition-all',
        enabled ? 'cursor-pointer hover:border-[var(--neon-green)]/50' : 'opacity-30 cursor-default',
      )}
      title={title}
    >
      <span className="text-[6px] text-white/50">{label}</span>
    </button>
  )

  return (
    <PanelFrame variant="default" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>

      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%',
        left: 0,
        top: 0,
      }}>
        <div className="p-2">
          <div className="flex items-center gap-1.5">
            <NeuralPowerButton />
            <LED on={isLedOn} color={getLedColor()} size="sm" />
            <span className="font-mono text-[9px] text-[var(--neon-green)] font-medium">AIC-001</span>
            <span className={cn(
              'font-mono text-[7px] ml-1',
              isPowered ? 'text-[var(--neon-green)]' : 'text-white/30'
            )}>
              {isPowered ? (deviceState === 'online' ? (isLearning ? 'LEARNING' : 'MONITOR') : deviceState.toUpperCase()) : 'STANDBY'}
            </span>
            <div className="flex-1" />
            {isPowered && (
              <>
                {rubberBtn(handleTest, deviceState !== 'online', 'Test', deviceState === 'testing', 'bg-[#1a3a2a]', 'bg-[#1a1f1a]', 'border-[#2a3a2a]/60', 'border-[var(--neon-green)]/40', testLedColor)}
                {rubberBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot', deviceState === 'rebooting' || deviceState === 'booting', 'bg-[#3a2a1a]', 'bg-[#1f1a1a]', 'border-[#3a2a2a]/60', 'border-[var(--neon-amber)]/40', rebootLedColor)}
              </>
            )}
            {chevronBtn(handleToggleFoldedInfo, showFoldedInfo ? '▲' : '▼', showFoldedInfo ? 'Hide info' : 'Show info', isPowered)}
          </div>

          {/* Folded info expansion */}
          <div style={{
            maxHeight: showFoldedInfo && isPowered ? '80px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}>
            <div className="mt-1.5 pt-1 border-t border-white/5 grid grid-cols-3 gap-x-3 gap-y-0.5">
              {[
                ['Queue', `${taskQueue}`],
                ['Effic', `${efficiency}%`],
                ['Mode', isLearning ? 'LEARN' : 'MON'],
                ['Nodes', `${nodeActivity.filter(n => n > 0.5).length}/5`],
                ['Tier', 'T2'],
                ['Draw', `${isLearning ? '50' : '35'} E/s`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="font-mono text-[6px] text-white/30">{label}</span>
                  <span className="font-mono text-[6px] text-[var(--neon-green)]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%',
        left: 0,
        top: 0,
      }}>
        <div className="p-2">
          {/* Fold chevron */}
          <div className="absolute top-1 right-1 z-10">
            {chevronBtn(() => aicManager?.toggleExpanded(), '▲', 'Fold')}
          </div>

          {/* Header with neural brain power button */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <NeuralPowerButton />
              <LED on={isLedOn} color={getLedColor()} size="sm" />
              <div className="font-mono text-[9px] text-[var(--neon-green)]">
                AI ASSISTANT CORE
              </div>
            </div>

            <div className="flex items-center gap-1 mr-4">
              {rubberBtn(handleTest, deviceState !== 'online', 'Test', deviceState === 'testing', 'bg-[#1a3a2a]', 'bg-[#1a1f1a]', 'border-[#2a3a2a]/60', 'border-[var(--neon-green)]/40', testLedColor)}
              {rubberBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot', deviceState === 'rebooting' || deviceState === 'booting', 'bg-[#3a2a1a]', 'bg-[#1f1a1a]', 'border-[#3a2a2a]/60', 'border-[var(--neon-amber)]/40', rebootLedColor)}
              <div className="font-mono text-[6px] text-white/30 ml-0.5">T2</div>
            </div>
          </div>

          {/* Neural network visualization */}
          <div className={cn(
            'relative h-10 bg-black/40 rounded overflow-hidden',
            deviceState === 'testing' && testPhase === 'neural' && 'ring-1 ring-[var(--neon-green)]/50'
          )}>
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
                      opacity: nodesActive ? 0.4 + nodeActivity[node] * 0.6 : 0.2,
                      animation: nodesActive && isLearning ? `pulse ${0.8 + node * 0.1}s ease-in-out infinite` : 'none',
                      boxShadow: nodesActive ? `0 0 ${4 + nodeActivity[node] * 4}px var(--neon-green)` : 'none',
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
            <div className={cn(
              'absolute bottom-1 left-1 right-1 h-0.5 bg-black/50 rounded overflow-hidden',
              deviceState === 'testing' && testPhase === 'memory' && 'ring-1 ring-[var(--neon-cyan)]/50'
            )}>
              <div
                className={cn('h-full transition-all duration-300', nodesActive ? 'bg-[var(--neon-green)]' : 'bg-[#333]')}
                style={{
                  width: nodesActive ? '60%' : '0%',
                  animation: nodesActive && isLearning ? 'loading 1.5s ease-in-out infinite' : 'none',
                }}
              />
            </div>
            {deviceState === 'testing' && (testPhase === 'learning' || testPhase === 'optimization') && (
              <div className="absolute inset-0 bg-[var(--neon-green)]/10 animate-pulse" />
            )}
          </div>

          {/* Status bar */}
          <div className="flex items-center font-mono text-[7px] mt-1">
            <span className={cn(
              'w-12 shrink-0 transition-colors',
              deviceState === 'booting' && bootPhase && ['neural', 'memory'].includes(bootPhase) ? 'text-white/30' : 'text-white/40'
            )}>
              QUEUE: {taskQueue}
            </span>
            <span className={cn(
              'flex-1 text-[5px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
              deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
              deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              testResult === 'fail' ? 'text-[var(--neon-red)]' :
              deviceState === 'standby' ? 'text-white/20' :
              'text-white/30'
            )}>
              {statusMessage}
            </span>
            <span className={cn(
              'w-12 shrink-0 text-right transition-colors',
              nodesActive ? 'text-[var(--neon-green)]' : 'text-white/30'
            )}>
              {efficiency}% EFF
            </span>
          </div>
        </div>
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
  onTest?: () => void
  onReset?: () => void
}

export function ExplorerDrone({
  range = 2.4,
  battery = 78,
  isDeployed = true,
  className,
}: ExplorerDroneProps) {
  const exdManager = useEXDManagerOptional()

  // Derive all state from manager when available, otherwise use props
  const deviceState = exdManager?.deviceState ?? 'online'
  const testPhase = exdManager?.testPhase ?? null
  const testResult = exdManager?.testResult ?? null
  const statusMessage = exdManager?.statusMessage ?? 'DEPLOYED'
  const displayRange = exdManager?.range ?? range
  const displayBattery = exdManager?.battery ?? battery
  const isRadarActive = exdManager?.radarActive ?? true
  const exdStandby = exdManager?.deviceState === 'standby'
  const isTransitioning = ['booting', 'shutdown', 'rebooting', 'testing'].includes(deviceState)
  const isExpanded = exdManager?.isExpanded ?? true

  // Folded info toggle
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = useCallback(() => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) {
        foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }, [])

  useEffect(() => {
    return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) }
  }, [])

  const handlePowerToggle = () => {
    if (!exdManager) return
    if (exdManager.deviceState === 'standby') {
      exdManager.powerOn()
    } else if (exdManager.deviceState === 'online') {
      exdManager.powerOff()
    }
  }

  const handleTest = () => {
    exdManager?.runTest()
  }

  const handleReboot = () => {
    exdManager?.reboot()
  }

  const getLedColor = () => {
    if (exdStandby || deviceState === 'shutdown') return 'red'
    if (deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return displayBattery > 30 ? 'green' : 'amber'
  }

  const isLedOn = !exdStandby && deviceState !== 'shutdown'
  const radarActive = isRadarActive && (deviceState === 'online' || deviceState === 'testing')

  // Propeller power button
  const PropellerPowerButton = () => (
    <button
      onClick={handlePowerToggle}
      disabled={isTransitioning}
      className="group relative disabled:opacity-30"
      title={exdStandby ? 'Power On' : 'Power Off'}
    >
      <div
        className="w-3 h-3 flex items-center justify-center transition-all"
        style={{
          background: !exdStandby
            ? 'radial-gradient(circle, rgba(191,255,0,0.4) 0%, rgba(191,255,0,0.1) 50%, transparent 70%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 50%)',
          borderRadius: '50%',
          boxShadow: !exdStandby ? '0 0 4px rgba(191,255,0,0.3)' : 'none',
          animation: !exdStandby && deviceState === 'online' ? 'spin 1s linear infinite' : 'none',
        }}
      >
        <div className="relative w-2.5 h-2.5">
          <div
            className="absolute inset-0"
            style={{
              background: !exdStandby
                ? 'linear-gradient(0deg, transparent 40%, var(--neon-lime, #bfff00) 40%, var(--neon-lime, #bfff00) 60%, transparent 60%), linear-gradient(90deg, transparent 40%, var(--neon-lime, #bfff00) 40%, var(--neon-lime, #bfff00) 60%, transparent 60%)'
                : 'linear-gradient(0deg, transparent 40%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.3) 60%, transparent 60%), linear-gradient(90deg, transparent 40%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.3) 60%, transparent 60%)',
              borderRadius: '50%',
            }}
          />
          <div className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full',
            !exdStandby ? 'bg-[var(--neon-lime,#bfff00)]' : 'bg-white/30'
          )} />
        </div>
      </div>
    </button>
  )

  // Anodized aluminum micro button for folded bar
  const milBtn = (label: string, onClick: () => void, disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="font-mono transition-all"
      style={{
        fontSize: '6px',
        lineHeight: 1,
        padding: '2px 3px',
        background: 'linear-gradient(180deg, #4a5a3a 0%, #2a3a1a 100%)',
        border: '0.5px solid #3a4a2a',
        borderRadius: '1px',
        color: disabled ? '#333' : '#8a9a6a',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.15), inset 0 -0.5px 0 rgba(0,0,0,0.4)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  )

  // State label for folded bar
  const stateLabel = exdStandby ? 'STANDBY' : isTransitioning ? deviceState.toUpperCase() : (exdManager?.isDeployed ? 'DEPLOYED' : 'DOCKED')
  const stateLedColor = exdStandby ? '#555' : isTransitioning ? 'var(--neon-amber)' : 'var(--neon-lime, #bfff00)'

  return (
    <PanelFrame variant="military" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ═══════════ FOLDED FRONT PANEL ═══════════ */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
          width: '100%', left: 0, top: 0,
        }}
      >
        <div className="flex items-center gap-1 px-1.5 py-1">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: stateLedColor,
              boxShadow: !exdStandby ? `0 0 4px ${stateLedColor}` : 'none',
            }}
          />
          <span className="font-mono text-[7px] font-bold shrink-0" style={{ color: 'var(--neon-lime, #bfff00)' }}>EXD-001</span>
          <span className="font-mono text-[6px] shrink-0" style={{ color: stateLedColor }}>{stateLabel}</span>
          <div className="flex-1" />
          {!exdStandby && (
            <div className="flex gap-0.5">
              {milBtn('T', handleTest, isTransitioning || exdStandby)}
              {milBtn('R', handleReboot, isTransitioning || exdStandby)}
            </div>
          )}
          <PropellerPowerButton />
          {!exdStandby && (
            <button
              onClick={toggleFoldedInfo}
              className="font-mono transition-all"
              style={{
                fontSize: '8px', lineHeight: 1, padding: '1px 2px',
                color: showFoldedInfo ? 'var(--neon-lime, #bfff00)' : '#556',
                cursor: 'pointer', background: 'none', border: 'none',
              }}
              title={showFoldedInfo ? 'Hide info' : 'Show info'}
            >
              {showFoldedInfo ? '▲' : '▼'}
            </button>
          )}
        </div>

        <div
          style={{
            maxHeight: showFoldedInfo && !exdStandby ? '60px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}
        >
          <div className="px-2 pb-1.5 grid grid-cols-3 gap-x-3 gap-y-0.5">
            {[
              { label: 'Range', value: `${displayRange.toFixed(1)} km` },
              { label: 'BAT', value: `${Math.round(displayBattery)}%` },
              { label: 'GPS', value: `${Math.round(exdManager?.gpsSignal ?? 95)}%` },
              { label: 'Speed', value: `${Math.round(exdManager?.speed ?? 25)} km/h` },
              { label: 'Cargo', value: `${exdManager?.cargoLoad ?? 0}` },
              { label: 'Draw', value: `${Math.round(exdManager?.currentDraw ?? 40)} E/s` },
            ].map(({ label: l, value: v }) => (
              <div key={l} className="flex justify-between">
                <span className="font-mono text-[5px] text-white/30">{l}</span>
                <span className="font-mono text-[6px]" style={{ color: 'var(--neon-lime, #bfff00)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ UNFOLDED INNER PANEL ═══════════ */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
          width: '100%', left: 0, top: 0,
        }}
      >
        {/* Fold chevron */}
        {exdManager && (
          <button
            onClick={() => exdManager.toggleExpanded()}
            className="absolute top-0.5 right-0.5 z-10 font-mono transition-all"
            style={{
              fontSize: '7px', lineHeight: 1, padding: '1px 2px',
              color: '#445', cursor: 'pointer',
              background: 'rgba(0,0,0,0.3)', border: '1px solid #222',
              borderRadius: '2px',
            }}
            title="Fold panel"
          >
            ▴
          </button>
        )}

        {/* Original full content */}
        <div className={cn('p-2 transition-opacity', exdStandby && 'opacity-50')}>
          {/* Header with power button and worn metal micro buttons */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <LED on={isLedOn} color={getLedColor()} size="sm" />
              <div className="font-mono text-[8px] text-[var(--neon-lime,#bfff00)]">
                EXPLORER DRONE
              </div>
              <PropellerPowerButton />
              {exdManager && (
                <span className="font-mono text-[4px] text-white/20">v{EXD_FIRMWARE.version}</span>
              )}
            </div>

            {/* Worn metal micro buttons - anodized aluminum style */}
            <div className="flex items-center gap-0.5">
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
                  <div className="absolute inset-0 rounded-[1px] opacity-20"
                    style={{
                      backgroundImage: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
                    }}
                  />
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
                disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || exdStandby}
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
                  <div className="absolute inset-0 rounded-[1px] opacity-20"
                    style={{
                      backgroundImage: 'linear-gradient(-45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
                    }}
                  />
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
            {exdStandby && (
              <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60">
                <span className="font-mono text-[8px] text-white/40">STANDBY</span>
              </div>
            )}
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
              {exdStandby ? '---' : `${displayRange.toFixed(1)} km`}
            </span>
            <span className={cn(
              'flex-1 text-[5px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
              deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
              deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
              deviceState === 'shutdown' ? 'text-[var(--neon-red)]' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              testResult === 'fail' ? 'text-[var(--neon-red)]' :
              'text-white/30'
            )}>
              {statusMessage}
            </span>
            <span className={cn(
              'w-10 shrink-0 text-right transition-colors',
              exdStandby ? 'text-white/30' :
              displayBattery > 30 ? 'text-white/40' : 'text-[var(--neon-amber)]'
            )}>
              {exdStandby ? 'BAT: ---' : `BAT: ${Math.round(displayBattery)}%`}
            </span>
          </div>
        </div>
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
interface AnomalyDetectorProps {
  className?: string
}

export function AnomalyDetector({ className }: AnomalyDetectorProps) {
  const andManager = useANDManagerOptional()
  const deviceState = andManager?.deviceState ?? 'online'
  const signalStrength = andManager?.signalStrength ?? 67
  const anomaliesFound = andManager?.anomaliesFound ?? 3
  const isPowered = andManager?.isPowered ?? true
  const testResult = andManager?.testResult ?? null
  const statusMessage = andManager?.statusMessage ?? 'SCANNING'
  const isExpanded = andManager?.isExpanded ?? true

  const handleFoldToggle = useCallback(() => andManager?.toggleExpanded(), [andManager])

  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) { foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000) }
      return next
    })
  }
  useEffect(() => { return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) } }, [])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  // Local waveOffset for visual animation
  const [waveOffset, setWaveOffset] = useState(0)

  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return
    const interval = setInterval(() => {
      setWaveOffset(prev => (prev + 1) % 100)
    }, 100)
    return () => clearInterval(interval)
  }, [deviceState])

  const handleTest = () => {
    andManager?.runTest()
  }

  const handleReboot = () => {
    andManager?.reboot()
  }

  const handlePowerToggle = () => {
    if (isPowered) {
      andManager?.powerOff()
    } else {
      andManager?.powerOn()
    }
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'

  return (
    <PanelFrame variant="teal" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* FOLDED FRONT PANEL */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
      }} className="w-full">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
            backgroundColor: getStatusColor(), boxShadow: `0 0 4px ${getStatusColor()}`,
            animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }} />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-magenta,#e91e8c)]">AND-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-magenta,#e91e8c)]/70' : 'text-white/30')}>{stateLabel}</span>
          <div className="flex-1" />
          {isPowered && (<>
            <button onClick={handleTest} disabled={deviceState !== 'online'} className="group relative" title="Test">
              <div className="w-3 h-3 rounded-full border transition-all" style={{
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a',
                boxShadow: deviceState === 'testing' ? '0 0 6px var(--neon-purple), inset 0 0 3px var(--neon-purple)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                opacity: deviceState !== 'online' ? 0.3 : 1,
              }} />
            </button>
            <button onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting'} className="group relative" title="Reboot">
              <div className="w-3 h-3 rounded-full border transition-all" style={{
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a',
                boxShadow: deviceState === 'rebooting' ? '0 0 6px var(--neon-amber), inset 0 0 3px var(--neon-amber)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                opacity: deviceState === 'booting' || deviceState === 'rebooting' ? 0.3 : 1,
              }} />
            </button>
          </>)}
          {/* Hexagonal power button */}
          <button onClick={handlePowerToggle} className="relative group" title={isPowered ? 'Power Off' : 'Power On'}>
            <div style={{
              width: '5px', height: '5px',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: isPowered ? 'var(--neon-magenta,#e91e8c)' : '#2a1a2a',
              boxShadow: isPowered ? '0 0 4px var(--neon-magenta,#e91e8c), 0 0 8px var(--neon-magenta,#e91e8c)' : 'none',
              transition: 'all 0.2s ease',
            }} />
          </button>
          {isPowered ? (
            <button onClick={toggleFoldedInfo} className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-magenta,#e91e8c)]/40 transition-colors" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }} title={showFoldedInfo ? 'Hide info' : 'Show info'}>
              <span className="font-mono text-[6px] text-[var(--neon-magenta,#e91e8c)]/60">{showFoldedInfo ? '\u25B2' : '\u25BC'}</span>
            </button>
          ) : <div className="w-3" />}
        </div>
        <div style={{ maxHeight: showFoldedInfo && isPowered ? '40px' : '0px', transition: 'max-height 400ms ease, opacity 300ms ease', opacity: showFoldedInfo && isPowered ? 1 : 0, overflow: 'hidden' }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-magenta,#e91e8c)]/60 flex gap-3 flex-wrap">
            <span>Signal: {Math.round(signalStrength)}%</span>
            <span>Found: {anomaliesFound}</span>
            <span>Tier: T2</span>
          </div>
        </div>
      </div>

      {/* UNFOLDED INNER PANEL */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
      }} className="w-full p-1.5">
        <button onClick={handleFoldToggle} className="absolute top-1 right-1 z-10 group" title="Fold">
          <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center transition-all hover:border-[var(--neon-magenta,#e91e8c)]/40" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}>
            <span className="font-mono text-[6px] text-[var(--neon-magenta,#e91e8c)]/60">{'\u25B4'}</span>
          </div>
        </button>

      {/* Standby overlay */}
      {(deviceState === 'standby' || deviceState === 'shutdown') && (
        <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center rounded">
          <span className="font-mono text-[7px] text-white/40 tracking-widest">STANDBY</span>
        </div>
      )}

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
          {/* Hexagonal power button */}
          <button
            onClick={handlePowerToggle}
            className="relative group"
            title={isPowered ? 'Power Off' : 'Power On'}
          >
            <div
              style={{
                width: '5px',
                height: '5px',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                background: isPowered
                  ? 'var(--neon-magenta,#e91e8c)'
                  : '#2a1a2a',
                boxShadow: isPowered
                  ? '0 0 4px var(--neon-magenta,#e91e8c), 0 0 8px var(--neon-magenta,#e91e8c)'
                  : 'none',
                transition: 'all 0.2s ease',
              }}
            />
          </button>
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
              ? 15 + Math.sin((i + waveOffset) * 0.4) * (signalStrength * 0.4) + Math.random() * 5
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
        {isActive && Array.from({ length: anomaliesFound }).map((_, i) => (
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
          SIG: {isActive ? Math.round(signalStrength) : '--'}%
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
          anomaliesFound > 0 ? 'text-[var(--neon-red)]' : 'text-white/40'
        )}>
          {isActive ? anomaliesFound : '-'} DETECTED
        </span>
      </div>
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

interface TeleportPadProps {
  className?: string
}

export function TeleportPad({ className }: TeleportPadProps) {
  const tlpManager = useTLPManagerOptional()

  const deviceState = tlpManager?.deviceState ?? 'online'
  const statusMessage = tlpManager?.statusMessage ?? 'READY'
  const displayCharge = tlpManager?.chargeLevel ?? 65
  const lastDestination = tlpManager?.lastDestination ?? 'LAB-Ω'
  const testResult = tlpManager?.testResult ?? null
  const isPowered = tlpManager?.isPowered ?? true
  const isExpanded = tlpManager?.isExpanded ?? true

  const handleFoldToggle = useCallback(() => tlpManager?.toggleExpanded(), [tlpManager])

  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) { foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000) }
      return next
    })
  }
  useEffect(() => { return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) } }, [])

  const [ringPulse, setRingPulse] = useState(0)

  // Animate portal rings
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return
    const interval = setInterval(() => {
      setRingPulse(prev => (prev + 1) % 100)
    }, 50)
    return () => clearInterval(interval)
  }, [deviceState])

  const handleTest = () => {
    tlpManager?.runTest()
  }

  const handleReboot = () => {
    tlpManager?.reboot()
  }

  const handlePowerToggle = () => {
    if (isPowered) {
      tlpManager?.powerOff()
    } else {
      tlpManager?.powerOn()
    }
  }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const portalIntensity = deviceState === 'testing' ? 1 : displayCharge / 100

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  return (
    <PanelFrame variant="default" className={cn('overflow-hidden relative', className)} style={{ perspective: '600px' }}>
      {/* Folded front panel */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
      }} className="w-full">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
            backgroundColor: getStatusColor(), boxShadow: `0 0 4px ${getStatusColor()}`,
            animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }} />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-blue)]">TLP-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-blue)]/70' : 'text-white/30')}>{stateLabel}</span>
          <div className="flex-1" />
          {isPowered && (<>
            <button onClick={handleTest} disabled={deviceState !== 'online'} className="group relative" title="Test">
              <div className="w-3 h-3 rounded-full border transition-all" style={{
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a',
                boxShadow: deviceState === 'testing' ? '0 0 6px var(--neon-purple), inset 0 0 3px var(--neon-purple)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                opacity: deviceState !== 'online' ? 0.3 : 1,
              }} />
            </button>
            <button onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting'} className="group relative" title="Reboot">
              <div className="w-3 h-3 rounded-full border transition-all" style={{
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a',
                boxShadow: deviceState === 'rebooting' ? '0 0 6px var(--neon-amber), inset 0 0 3px var(--neon-amber)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                opacity: deviceState === 'booting' || deviceState === 'rebooting' ? 0.3 : 1,
              }} />
            </button>
          </>)}
          {/* Diamond power button */}
          <div
            onClick={handlePowerToggle}
            className="cursor-pointer"
            title={isPowered ? 'Power Off' : 'Power On'}
            style={{
              width: '4px',
              height: '4px',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              background: isPowered
                ? 'linear-gradient(135deg, #88ccff 0%, var(--neon-blue) 100%)'
                : '#333',
              boxShadow: isPowered ? '0 0 4px var(--neon-blue)' : 'none',
            }}
          />
          {/* Info toggle */}
          {isPowered ? (
            <button onClick={toggleFoldedInfo} className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-blue)]/40 transition-colors" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }} title={showFoldedInfo ? 'Hide info' : 'Show info'}>
              <span className="font-mono text-[6px] text-[var(--neon-blue)]/60">{showFoldedInfo ? '▲' : '▼'}</span>
            </button>
          ) : <div className="w-3" />}
        </div>
        <div style={{ maxHeight: showFoldedInfo && isPowered ? '40px' : '0px', transition: 'max-height 400ms ease, opacity 300ms ease', opacity: showFoldedInfo && isPowered ? 1 : 0, overflow: 'hidden' }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-blue)]/60 flex gap-3 flex-wrap">
            <span>Charge: {displayCharge}%</span>
            <span>Dest: {lastDestination}</span>
            <span>Tier: T2</span>
          </div>
        </div>
      </div>

      {/* Unfolded inner panel */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
      }} className="w-full p-1.5">
        <button onClick={handleFoldToggle} className="absolute top-1 right-1 z-10 group" title="Fold">
          <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center transition-all hover:border-[var(--neon-blue)]/40" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}>
            <span className="font-mono text-[6px] text-[var(--neon-blue)]/60">▴</span>
          </div>
        </button>

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
          {/* Diamond power button */}
          <div
            onClick={handlePowerToggle}
            className="cursor-pointer"
            title={isPowered ? 'Power Off' : 'Power On'}
            style={{
              width: '4px',
              height: '4px',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              background: isPowered
                ? 'linear-gradient(135deg, #88ccff 0%, var(--neon-blue) 100%)'
                : '#333',
              boxShadow: isPowered ? '0 0 4px var(--neon-blue)' : 'none',
            }}
          />
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

        {/* Standby overlay */}
        {(deviceState === 'standby' || deviceState === 'shutdown') && (
          <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center rounded">
            <span className="font-mono text-[7px] text-white/40">STANDBY</span>
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

interface LaserCutterProps {
  className?: string
}

export function LaserCutter({ className }: LaserCutterProps) {
  const lctManager = useLCTManagerOptional()

  const deviceState = lctManager?.deviceState ?? 'booting'
  const testPhase = lctManager?.testPhase ?? null
  const statusMessage = lctManager?.statusMessage ?? 'INITIALIZING...'
  const laserPosition = lctManager?.laserPosition ?? 50
  const currentPower = lctManager?.laserPower ?? 450
  const isPowered = lctManager?.isPowered ?? true
  const isExpanded = lctManager?.isExpanded ?? true

  const handleFoldToggle = useCallback(() => lctManager?.toggleExpanded(), [lctManager])

  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) { foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000) }
      return next
    })
  }
  useEffect(() => { return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) } }, [])

  const handleTest = () => {
    lctManager?.runTest()
  }

  const handleReboot = () => {
    lctManager?.reboot()
  }

  const handlePowerToggle = () => {
    if (!lctManager?.isPowered) {
      lctManager?.powerOn()
    } else {
      lctManager?.powerOff()
    }
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

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  return (
    <PanelFrame variant="default" className={cn('overflow-hidden relative', className)} style={{ perspective: '600px' }}>
      {/* Folded front panel */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
      }} className="w-full">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
            backgroundColor: getStatusColor(), boxShadow: `0 0 4px ${getStatusColor()}`,
            animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }} />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-red)]">LCT-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-red)]/70' : 'text-white/30')}>{stateLabel}</span>
          <div className="flex-1" />
          {isPowered && (<>
            <button onClick={handleTest} disabled={deviceState !== 'online'} className="group relative" title="Test">
              <div className="w-3 h-3 rounded-full border transition-all" style={{
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a',
                boxShadow: deviceState === 'testing' ? '0 0 6px var(--neon-purple), inset 0 0 3px var(--neon-purple)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                opacity: deviceState !== 'online' ? 0.3 : 1,
              }} />
            </button>
            <button onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting'} className="group relative" title="Reboot">
              <div className="w-3 h-3 rounded-full border transition-all" style={{
                background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)',
                borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a',
                boxShadow: deviceState === 'rebooting' ? '0 0 6px var(--neon-amber), inset 0 0 3px var(--neon-amber)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
                opacity: deviceState === 'booting' || deviceState === 'rebooting' ? 0.3 : 1,
              }} />
            </button>
          </>)}
          {/* Laser beam power button */}
          <button
            onClick={handlePowerToggle}
            className="flex items-center justify-center cursor-pointer"
            title={isPowered ? 'Power Off' : 'Power On'}
          >
            <div
              style={{
                width: '2px',
                height: '12px',
                borderRadius: '1px',
                background: isPowered
                  ? 'linear-gradient(180deg, #ff6666 0%, var(--neon-red) 50%, #ff6666 100%)'
                  : '#333',
                boxShadow: isPowered
                  ? '0 0 4px var(--neon-red), 0 0 8px var(--neon-red), 0 0 12px rgba(255,80,80,0.4)'
                  : 'none',
                transition: 'all 0.2s ease',
              }}
            />
          </button>
          {/* Info toggle */}
          {isPowered ? (
            <button onClick={toggleFoldedInfo} className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-red)]/40 transition-colors" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }} title={showFoldedInfo ? 'Hide info' : 'Show info'}>
              <span className="font-mono text-[6px] text-[var(--neon-red)]/60">{showFoldedInfo ? '\u25B2' : '\u25BC'}</span>
            </button>
          ) : <div className="w-3" />}
        </div>
        <div style={{ maxHeight: showFoldedInfo && isPowered ? '40px' : '0px', transition: 'max-height 400ms ease, opacity 300ms ease', opacity: showFoldedInfo && isPowered ? 1 : 0, overflow: 'hidden' }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-red)]/60 flex gap-3 flex-wrap">
            <span>Power: {currentPower}W</span>
            <span>Precision: ±0.01mm</span>
            <span>Tier: T2</span>
          </div>
        </div>
      </div>

      {/* Unfolded inner panel */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
      }} className="w-full p-2 flex">
        <button onClick={handleFoldToggle} className="absolute top-1 right-1 z-10 group" title="Fold">
          <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center transition-all hover:border-[var(--neon-red)]/40" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}>
            <span className="font-mono text-[6px] text-[var(--neon-red)]/60">\u25B4</span>
          </div>
        </button>

      {/* Left side - Square nano buttons */}
      <div className="flex flex-col gap-1.5 mr-2 justify-center shrink-0">
        {/* Power button - laser beam shaped */}
        <button
          onClick={handlePowerToggle}
          className="flex items-center justify-center cursor-pointer"
          title={isPowered ? 'Power Off' : 'Power On'}
        >
          <div
            style={{
              width: '2px',
              height: '12px',
              borderRadius: '1px',
              background: isPowered
                ? 'linear-gradient(180deg, #ff6666 0%, var(--neon-red) 50%, #ff6666 100%)'
                : '#333',
              boxShadow: isPowered
                ? '0 0 4px var(--neon-red), 0 0 8px var(--neon-red), 0 0 12px rgba(255,80,80,0.4)'
                : 'none',
              transition: 'all 0.2s ease',
            }}
          />
        </button>

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
                {statusMessage}
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

          {/* Standby overlay */}
          {!isPowered && lctManager && (
            <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center rounded">
              <span className="font-mono text-[7px] text-white/40">STANDBY</span>
            </div>
          )}
        </div>

        <div className="flex justify-between font-mono text-[7px] mt-1">
          <span className="text-[var(--neon-red)]">{currentPower}W</span>
          <span className="text-white/40">&plusmn;0.01mm</span>
        </div>
      </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// 3D PRINTER - Tier 2 Tools fabrication
// Uses P3DManager for bidirectional terminal<->UI sync
// ==================================================

interface Printer3DProps {
  className?: string
}

export function Printer3D({
  className,
}: Printer3DProps) {
  const p3dManager = useP3DManagerOptional()

  const deviceState = p3dManager?.deviceState ?? 'booting'
  const testPhase = p3dManager?.testPhase ?? null
  const bootStatus = p3dManager?.statusMessage ?? 'INITIALIZING...'
  const currentProgress = p3dManager?.progress ?? 67
  const currentLayer = p3dManager?.layerCount ?? 234
  const headPosition = p3dManager?.headPosition ?? 50
  const bedTemp = p3dManager?.bedTemp ?? 60
  const isPowered = p3dManager?.isPowered ?? true
  const isExpanded = p3dManager?.isExpanded ?? true
  const displayMode = p3dManager?.displayMode ?? 'plastic'

  const handleTest = () => { p3dManager?.runTest() }
  const handleReboot = () => { p3dManager?.reboot() }
  const handlePower = () => {
    if (!p3dManager?.isPowered) { p3dManager?.powerOn() } else { p3dManager?.powerOff() }
  }
  const handleFoldToggle = () => { p3dManager?.toggleExpanded() }

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const isTesting = deviceState === 'testing'

  // Folded info toggle
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) {
        foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }

  useEffect(() => {
    return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) }
  }, [])

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

  // Status label for folded bar
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  // Knurled micro button helper
  const knurlBtn = (onClick: () => void, disabled: boolean, title: string, icon: React.ReactNode, glowColor?: string) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-3.5 h-3.5 rounded-[2px] border transition-all duration-200',
        'flex items-center justify-center relative overflow-hidden',
        !disabled ? 'border-white/30 cursor-pointer hover:border-[var(--neon-amber)]/60' : 'border-white/10 cursor-not-allowed opacity-50'
      )}
      style={{
        background: !disabled
          ? 'linear-gradient(135deg, #4a4a5a 0%, #2a2a3a 50%, #3a3a4a 100%)'
          : 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
        boxShadow: glowColor
          ? `0 0 4px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.1)`
          : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)',
      }}
      title={title}
    >
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent 0px, transparent 1px, rgba(255,255,255,0.1) 1px, rgba(255,255,255,0.1) 2px)`,
      }} />
      {icon}
    </button>
  )

  return (
    <PanelFrame variant="military" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
        }}
        className="w-full"
      >
        {/* Main folded bar */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* LED */}
          <LED on={isPowered && isActive} color="amber" size="sm" className={isTesting ? 'animate-pulse' : ''} />
          {/* Device ID */}
          <span className="font-mono text-[8px] font-bold text-[var(--neon-amber)]">P3D-001</span>
          {/* State */}
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-amber)]/70' : 'text-white/30')}>
            {stateLabel}
          </span>
          <div className="flex-1" />
          {/* Buttons */}
          {isPowered && (
            <>
              {knurlBtn(handleTest, deviceState !== 'online', 'TEST',
                <div className="w-1.5 h-1.5 rounded-[1px] relative z-10" style={{
                  background: isTesting ? 'var(--neon-amber)' : 'linear-gradient(135deg, #5a5a6a 0%, #3a3a4a 100%)',
                  boxShadow: isTesting ? '0 0 4px var(--neon-amber)' : 'inset 0 1px 0 rgba(255,255,255,0.2)',
                }} />,
                isTesting ? 'var(--neon-amber)' : undefined
              )}
              {knurlBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting', 'RESET',
                <div className="w-1.5 h-1.5 rounded-[1px] relative z-10" style={{
                  background: deviceState === 'rebooting' ? 'var(--neon-red)' : 'linear-gradient(135deg, #5a5a6a 0%, #3a3a4a 100%)',
                  boxShadow: deviceState === 'rebooting' ? '0 0 4px var(--neon-red)' : 'inset 0 1px 0 rgba(255,255,255,0.2)',
                }} />,
                deviceState === 'rebooting' ? 'var(--neon-red)' : undefined
              )}
            </>
          )}
          {/* Power button - nozzle shape */}
          <button
            onClick={handlePower}
            className={cn(
              'w-3.5 h-3.5 rounded-[2px] border transition-all duration-200',
              'flex items-center justify-center relative overflow-hidden',
              'border-white/20 cursor-pointer',
              isPowered ? 'hover:border-[var(--neon-amber)]/60' : 'hover:border-white/40'
            )}
            style={{
              background: 'linear-gradient(135deg, #3a3a4a 0%, #1a1a2a 100%)',
              boxShadow: isPowered
                ? '0 0 3px rgba(255,180,100,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                : 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3)',
            }}
            title={isPowered ? 'POWER OFF' : 'POWER ON'}
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className="relative z-10">
              <polygon points="1,0 5,0 3,5" fill={isPowered ? 'var(--neon-amber)' : '#3a3a4a'} stroke={isPowered ? 'var(--neon-amber)' : '#5a5a6a'} strokeWidth="0.5" style={{ filter: isPowered ? 'drop-shadow(0 0 2px var(--neon-amber))' : 'none' }} />
            </svg>
          </button>
          {/* Info / Fold toggle */}
          {isPowered ? (
            <button
              onClick={toggleFoldedInfo}
              className="w-3.5 h-3.5 rounded-[2px] border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-amber)]/40 transition-colors"
              style={{ background: 'linear-gradient(135deg, #3a3a4a 0%, #1a1a2a 100%)' }}
              title={showFoldedInfo ? 'Hide info' : 'Show info'}
            >
              <span className="font-mono text-[7px] text-[var(--neon-amber)]/60">{showFoldedInfo ? '▲' : '▼'}</span>
            </button>
          ) : (
            <div className="w-3.5" />
          )}
        </div>

        {/* Folded info expansion */}
        <div
          style={{
            maxHeight: showFoldedInfo && isPowered ? '60px' : '0px',
            transition: 'max-height 400ms ease, opacity 300ms ease',
            opacity: showFoldedInfo && isPowered ? 1 : 0,
            overflow: 'hidden',
          }}
        >
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-amber)]/60 grid grid-cols-3 gap-x-2 gap-y-0.5">
            <span>Progress: {currentProgress}%</span>
            <span>Layers: {currentLayer}</span>
            <span>Bed: {bedTemp}°C</span>
            <span>Mode: {displayMode.toUpperCase()}</span>
            <span>Tier: T2</span>
            <span>Draw: {p3dManager?.currentDraw?.toFixed(1) ?? '0.0'} W</span>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
        }}
        className="w-full p-2 flex"
      >
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="font-mono text-[9px] text-[var(--neon-amber)]">
              3D FABRICATOR
            </div>
            <div className="flex items-center gap-1">
              <div className="font-mono text-[7px] text-white/30">T2</div>
              <LED on={isActive} color="amber" size="sm" className={isTesting ? 'animate-pulse' : ''} />
            </div>
          </div>

          {/* Print bed visualization */}
          <div className="relative flex-1 min-h-[2.5rem] bg-black/40 rounded overflow-hidden">
            {/* Company logo */}
            <div className={cn('absolute font-mono text-[5px] font-bold z-10', logoPositionClass)} style={{ color: 'rgba(255,180,100,0.4)', textShadow: '0 0 2px rgba(255,180,100,0.3)' }}>PRSA</div>

            {/* Status display when booting/rebooting */}
            {(deviceState === 'booting' || deviceState === 'rebooting') && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-[7px] animate-pulse" style={{ color: 'var(--neon-amber)' }}>{bootStatus}</span>
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
              <div className="absolute bottom-0 left-2 right-2 bg-[var(--neon-amber)]/30 transition-all duration-300" style={{ height: `${currentProgress}%` }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 h-px bg-[var(--neon-amber)]/50" style={{ bottom: `${i * 20}%` }} />
                ))}
              </div>
            )}

            {/* Print head */}
            {isActive && (
              <div className="absolute h-0.5 bg-[var(--neon-amber)] transition-all" style={{
                bottom: `${currentProgress}%`, left: `${headPosition - 10}%`, width: '20%',
                boxShadow: '0 0 4px var(--neon-amber)', transitionDuration: isTesting ? '200ms' : '150ms',
              }} />
            )}

            {/* Bed temperature indicator */}
            {isActive && (
              <div className="absolute bottom-0.5 right-0.5 font-mono text-[5px]" style={{ color: 'rgba(255,180,100,0.6)' }}>{bedTemp}°C</div>
            )}

            {/* Standby overlay */}
            {!isPowered && p3dManager && (
              <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center rounded">
                <span className="font-mono text-[7px] text-white/40">STANDBY</span>
              </div>
            )}
          </div>

          <div className="flex justify-between font-mono text-[7px] mt-1">
            <span className="text-[var(--neon-amber)]">{currentProgress}%</span>
            <span className="text-white/40">L:{currentLayer}</span>
          </div>
        </div>

        {/* Right side buttons */}
        <div className="flex flex-col justify-end ml-1.5 shrink-0 pb-0">
          <div className="flex flex-col gap-1">
            {/* Fold chevron */}
            <button
              onClick={handleFoldToggle}
              className="w-3.5 h-3.5 rounded-[2px] border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-amber)]/40 transition-colors"
              style={{ background: 'linear-gradient(135deg, #3a3a4a 0%, #1a1a2a 100%)' }}
              title="Fold"
            >
              <span className="font-mono text-[7px] text-[var(--neon-amber)]/60">▴</span>
            </button>

            {/* Power button - nozzle shape */}
            <button
              onClick={handlePower}
              className={cn(
                'w-3.5 h-3.5 rounded-[2px] border transition-all duration-200',
                'flex items-center justify-center relative overflow-hidden',
                'border-white/20 cursor-pointer',
                isPowered ? 'hover:border-[var(--neon-amber)]/60' : 'hover:border-white/40'
              )}
              style={{
                background: 'linear-gradient(135deg, #3a3a4a 0%, #1a1a2a 100%)',
                boxShadow: isPowered
                  ? '0 0 3px rgba(255,180,100,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3)',
              }}
              title={isPowered ? 'POWER OFF' : 'POWER ON'}
            >
              <svg width="6" height="6" viewBox="0 0 6 6" className="relative z-10">
                <polygon points="1,0 5,0 3,5" fill={isPowered ? 'var(--neon-amber)' : '#3a3a4a'} stroke={isPowered ? 'var(--neon-amber)' : '#5a5a6a'} strokeWidth="0.5" style={{ filter: isPowered ? 'drop-shadow(0 0 2px var(--neon-amber))' : 'none' }} />
              </svg>
            </button>

            {/* Test button */}
            {knurlBtn(handleTest, deviceState !== 'online', 'TEST',
              <div className="w-1.5 h-1.5 rounded-[1px] relative z-10" style={{
                background: isTesting ? 'var(--neon-amber)' : 'linear-gradient(135deg, #5a5a6a 0%, #3a3a4a 100%)',
                boxShadow: isTesting ? '0 0 4px var(--neon-amber)' : 'inset 0 1px 0 rgba(255,255,255,0.2)',
              }} />,
              isTesting ? 'var(--neon-amber)' : undefined
            )}

            {/* Reset button */}
            {knurlBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting', 'RESET',
              <div className="w-1.5 h-1.5 rounded-[1px] relative z-10" style={{
                background: deviceState === 'rebooting' ? 'var(--neon-red)' : 'linear-gradient(135deg, #5a5a6a 0%, #3a3a4a 100%)',
                boxShadow: deviceState === 'rebooting' ? '0 0 4px var(--neon-red)' : 'inset 0 1px 0 rgba(255,255,255,0.2)',
              }} />,
              deviceState === 'rebooting' ? 'var(--neon-red)' : undefined
            )}
          </div>
        </div>
      </div>
    </PanelFrame>
  )
}

// ==================================================
// EXOTIC MATTER CONTAINMENT - Tier 4 resource
// ==================================================
// EXOTIC MATTER CONTAINMENT - Tier 4+ rare resource storage
// Uses EMCManager for bidirectional terminal<->UI sync
// ==================================================
import { useEMCManagerOptional } from '@/contexts/EMCManager'
type ExoticState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline' | 'standby' | 'shutdown'
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
  units: propUnits = 42,
  stability: propStability = 76,
  isContained: propContained = true,
  className,
  onTest,
  onReset,
}: ExoticMatterProps) {
  const emcManager = useEMCManagerOptional()

  const deviceState = emcManager?.deviceState ?? 'online'
  const testResult = emcManager?.testResult ?? null
  const statusMessage = emcManager?.statusMessage ?? 'CONTAINED'
  const isStandby = deviceState === 'standby'
  const isTransitioning = ['booting', 'shutdown', 'rebooting'].includes(deviceState)
  const isExpanded = emcManager?.isExpanded ?? true

  const displayUnits = emcManager?.units ?? propUnits
  const displayStability = emcManager?.stability ?? propStability
  const displayContained = emcManager?.isContained ?? propContained
  const displayField = emcManager?.fieldStrength ?? 95
  const displayTemp = emcManager?.temperature ?? 1050
  const displayDraw = emcManager?.currentDraw ?? 18

  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 5-min auto-close for folded info
  useEffect(() => {
    if (showFoldedInfo) {
      foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) }
    }
  }, [showFoldedInfo])

  const handleTest = async () => {
    if (emcManager) await emcManager.runTest()
    onTest?.()
  }

  const handleReboot = async () => {
    if (emcManager) await emcManager.reboot()
    onReset?.()
  }

  const getLedColor = () => {
    if (isStandby) return 'red'
    if (deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting' || deviceState === 'shutdown') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return displayStability > 70 ? 'green' : 'amber'
  }

  const isLedOn = !isStandby
  const fieldActive = displayContained && (deviceState === 'online' || deviceState === 'testing')

  // Biohazard power button rotation animation
  const [btnRotation, setBtnRotation] = useState(0)
  useEffect(() => {
    if (isStandby) return
    const interval = setInterval(() => {
      setBtnRotation(r => (r + 1) % 360)
    }, 50)
    return () => clearInterval(interval)
  }, [isStandby])

  // Biohazard power button component
  const BiohazardPowerButton = () => emcManager ? (
    <button
      onClick={() => isStandby ? emcManager.powerOn() : emcManager.powerOff()}
      disabled={isTransitioning}
      className="relative transition-all"
      style={{
        width: '11px',
        height: '11px',
        opacity: isTransitioning ? 0.4 : 1,
        cursor: isTransitioning ? 'not-allowed' : 'pointer',
      }}
      title={isStandby ? 'Power ON' : 'Power OFF'}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `1px solid ${isStandby ? '#2a1a2a' : 'var(--neon-pink)'}`,
          boxShadow: isStandby ? 'none' : '0 0 4px var(--neon-pink), inset 0 0 2px rgba(255,0,255,0.3)',
          transform: `rotate(${btnRotation}deg)`,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '3px', height: '3px', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: isStandby ? '#1a0a1a' : 'var(--neon-pink)',
          boxShadow: isStandby ? 'none' : '0 0 3px var(--neon-pink)',
        }}
      />
      {[0, 120, 240].map(angle => (
        <div
          key={angle}
          className="absolute"
          style={{
            width: '1px', height: '4px',
            background: isStandby ? '#2a1a2a' : 'var(--neon-pink)',
            top: '1px', left: '50%',
            transformOrigin: '50% 4.5px',
            transform: `translateX(-50%) rotate(${angle}deg)`,
            boxShadow: isStandby ? 'none' : '0 0 2px var(--neon-pink)',
          }}
        />
      ))}
    </button>
  ) : null

  // LED micro button helper
  const ledBtn = (onClick: () => void, disabled: boolean, round: boolean, title: string, activeColor?: string) => (
    <button onClick={onClick} disabled={disabled} className="group relative disabled:opacity-30" title={title}>
      <div
        className={cn('w-2.5 h-2 p-[1px] transition-all group-active:scale-95', round ? 'rounded-full' : 'rounded-[1px]')}
        style={{
          background: round
            ? 'linear-gradient(180deg, #5a3a5a 0%, #4a2a4a 50%, #3a1a3a 100%)'
            : 'linear-gradient(180deg, #4a3a3a 0%, #3a2a2a 50%, #2a1a1a 100%)',
          boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.1), 0 0.5px 1px rgba(0,0,0,0.5)',
          border: round ? '0.5px solid #6a4a6a' : '0.5px solid #5a4a4a',
        }}
      >
        <div className={cn(
          'w-full h-full transition-all', round ? 'rounded-full' : 'rounded-[0.5px]',
          activeColor ?? 'bg-[#1a0a1a]'
        )} />
      </div>
    </button>
  )

  const testBtnColor = deviceState === 'testing'
    ? 'bg-[var(--neon-pink)] shadow-[0_0_4px_var(--neon-pink)]'
    : testResult === 'pass'
    ? 'bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]'
    : testResult === 'fail'
    ? 'bg-[var(--neon-red)] shadow-[0_0_4px_var(--neon-red)]'
    : undefined

  const rebootBtnColor = (deviceState === 'rebooting' || deviceState === 'booting')
    ? 'bg-[var(--neon-amber)] shadow-[0_0_4px_var(--neon-amber)]'
    : 'bg-[#0a0505]'

  const stateLabel = isStandby ? 'STANDBY' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'testing' ? 'TESTING' : deviceState === 'rebooting' ? 'REBOOTING' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'ONLINE'

  return (
    <PanelFrame variant="default" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%', left: 0, top: 0,
      }}>
        <div className="flex items-center gap-1 px-1 py-0.5">
          <LED on={isLedOn} color={getLedColor()} size="sm" className="scale-75 shrink-0" />
          <span className="font-mono text-[5px] text-[var(--neon-pink)] shrink-0">EMC-001</span>
          <span className={cn(
            'font-mono text-[4px] shrink-0',
            isStandby ? 'text-white/30' : 'text-[var(--neon-pink)]/70'
          )}>{stateLabel}</span>
          <div className="flex-1" />

          {!isStandby && (
            <>
              {ledBtn(handleTest, deviceState !== 'online', true, 'Test', testBtnColor)}
              {ledBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || isStandby, false, 'Reboot', rebootBtnColor)}
            </>
          )}
          <BiohazardPowerButton />
          {!isStandby ? (
            <button
              onClick={() => setShowFoldedInfo(p => !p)}
              className="font-mono text-[5px] text-[var(--neon-pink)]/50 hover:text-[var(--neon-pink)] transition-colors px-0.5"
              title={showFoldedInfo ? 'Hide info' : 'Show info'}
            >{showFoldedInfo ? '▲' : '▼'}</button>
          ) : null}
        </div>

        {/* Folded info expansion */}
        <div style={{
          maxHeight: showFoldedInfo && !isStandby ? '60px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 300ms ease',
        }}>
          <div className="px-1.5 pb-1 grid grid-cols-3 gap-x-2 gap-y-0 font-mono text-[4px]">
            <span className="text-white/40">Units: <span className="text-[var(--neon-pink)]">{displayUnits}</span></span>
            <span className="text-white/40">Stab: <span className="text-[var(--neon-pink)]">{displayStability}%</span></span>
            <span className="text-white/40">Field: <span className="text-[var(--neon-pink)]">{displayField}%</span></span>
            <span className="text-white/40">Temp: <span className="text-[var(--neon-pink)]">{displayTemp}°K</span></span>
            <span className="text-white/40">Cont: <span className="text-[var(--neon-pink)]">{displayContained ? 'YES' : 'NO'}</span></span>
            <span className="text-white/40">Draw: <span className="text-[var(--neon-pink)]">{displayDraw} E/s</span></span>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%', left: 0, top: 0,
      }}>
        {/* Fold chevron */}
        {emcManager && !isStandby && (
          <button
            onClick={() => emcManager.toggleExpanded()}
            className="absolute top-[2px] right-[2px] z-10 font-mono text-[5px] text-[var(--neon-pink)]/40 hover:text-[var(--neon-pink)] transition-colors"
            title="Fold"
          >▴</button>
        )}

        <div className="p-1">
          {/* Compact header */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-0.5">
              <LED on={isLedOn} color={getLedColor()} size="sm" className="scale-75" />
              <div className="font-mono text-[5px] text-[var(--neon-pink)]">EXOTIC MATTER</div>
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
              <BiohazardPowerButton />
            </div>

            <div className="flex items-center gap-0.5">
              {ledBtn(handleTest, deviceState !== 'online', true, 'Test', testBtnColor)}
              {ledBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || isStandby, false, 'Reboot', rebootBtnColor)}
              <div className="font-mono text-[3px] text-white/20">RES-X</div>
            </div>
          </div>

          {/* Tall containment field visualization - 3 rows */}
          <div className={cn(
            'relative h-14 bg-black/60 rounded overflow-hidden',
            deviceState === 'testing' && 'ring-1 ring-[var(--neon-pink)]/50'
          )}>
            {/* Containment field border */}
            <div
              className="absolute inset-[2px] rounded border transition-all duration-300"
              style={{
                borderColor: fieldActive ? 'var(--neon-pink)' : isStandby ? '#1a1a1a' : '#333',
                boxShadow: fieldActive ? '0 0 6px var(--neon-pink), inset 0 0 12px rgba(255,0,255,0.15)' : 'none',
                animation: fieldActive ? 'containment-pulse 2s ease-in-out infinite' : 'none',
              }}
            />

            {isStandby && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="font-mono text-[6px] text-white/15 tracking-widest">STANDBY</div>
              </div>
            )}

            {!isStandby && (
              <div className="absolute inset-[4px]">
                {Array.from({ length: displayUnits }).map((_, i) => {
                  const isTesting = deviceState === 'testing'
                  const isBooting = deviceState === 'booting' || deviceState === 'rebooting'
                  const isShutdown = deviceState === 'shutdown'

                  const testColors = ['var(--neon-pink)', 'var(--neon-cyan)', 'var(--neon-purple)', '#fff', 'var(--neon-green)']
                  const bootColors = ['var(--neon-amber)', 'var(--neon-pink)', '#ff6600', 'var(--neon-amber)']

                  const particleColor = isTesting
                    ? testColors[i % testColors.length]
                    : isBooting
                    ? bootColors[i % bootColors.length]
                    : isShutdown
                    ? '#663366'
                    : fieldActive ? 'var(--neon-pink)' : '#444'

                  const cols = 14
                  const rows = 3
                  const col = i % cols
                  const row = Math.floor(i / cols) % rows
                  const xPos = 4 + (col / (cols - 1)) * 92
                  const yPos = 15 + (row / (rows - 1 || 1)) * 70

                  let animationName = 'none'
                  let animationDuration = '1s'
                  let animationTimingFunction = 'ease-in-out'
                  let animationDelay = '0s'

                  if (isTesting) {
                    animationName = 'exotic-test'
                    animationDuration = `${0.15 + (i % 6) * 0.08}s`
                    animationDelay = `${i * 0.015}s`
                  } else if (isBooting) {
                    animationName = 'exotic-boot'
                    animationDuration = `${0.4 + (i % 4) * 0.15}s`
                    animationTimingFunction = 'ease-out'
                    animationDelay = `${(row * 0.1) + (col * 0.03)}s`
                  } else if (fieldActive) {
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
                        opacity: isShutdown ? 0.3 : 1,
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
            )}

            {/* Test overlay - quantum interference */}
            {deviceState === 'testing' && (
              <>
                <div
                  className="absolute inset-0 pointer-events-none opacity-25"
                  style={{
                    background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 2px, var(--neon-cyan) 2px, var(--neon-cyan) 3px)',
                    animation: 'exotic-scan 0.3s linear infinite',
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at center, var(--neon-purple) 0%, transparent 50%)',
                    opacity: 0.25,
                    animation: 'exotic-quantum 0.4s ease-in-out infinite',
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none opacity-15"
                  style={{
                    background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 4px, var(--neon-pink) 4px, var(--neon-pink) 5px)',
                    animation: 'exotic-wave 0.2s linear infinite',
                  }}
                />
              </>
            )}

            {/* Boot/reboot overlay */}
            {(deviceState === 'booting' || deviceState === 'rebooting') && (
              <>
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at center, transparent 0%, var(--neon-amber) 30%, transparent 50%)',
                    opacity: 0.3,
                    animation: 'exotic-materialize 0.8s ease-out infinite',
                  }}
                />
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
              {isStandby ? '--' : displayUnits} UNITS
            </span>
            <span className={cn(
              'flex-1 text-[4px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
              deviceState === 'testing' ? 'text-[var(--neon-pink)]' :
              deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
              isStandby ? 'text-white/15' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              testResult === 'fail' ? 'text-[var(--neon-red)]' :
              'text-white/20'
            )}>
              {isStandby ? 'STANDBY' : statusMessage}
            </span>
            <span className={cn(
              'w-12 shrink-0 text-right transition-colors',
              isStandby ? 'text-white/30' :
              displayStability > 70 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-red)]'
            )}>
              {isStandby ? '--' : displayStability}% STABLE
            </span>
          </div>
        </div>
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
        @keyframes exotic-test {
          0% { transform: translate(0, 0) scale(1); filter: hue-rotate(0deg); }
          20% { transform: translate(3px, -4px) scale(1.4); filter: hue-rotate(60deg); }
          40% { transform: translate(-4px, 3px) scale(0.6); filter: hue-rotate(120deg); }
          60% { transform: translate(4px, 2px) scale(1.3); filter: hue-rotate(180deg); }
          80% { transform: translate(-2px, -3px) scale(0.8); filter: hue-rotate(240deg); }
          100% { transform: translate(0, 0) scale(1); filter: hue-rotate(360deg); }
        }
        @keyframes exotic-boot {
          0% { transform: scale(0); opacity: 0; filter: brightness(3); }
          30% { transform: scale(1.5); opacity: 1; filter: brightness(2); }
          60% { transform: scale(0.8); opacity: 0.7; filter: brightness(1.5); }
          100% { transform: scale(1); opacity: 1; filter: brightness(1); }
        }
        @keyframes exotic-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes exotic-wave {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes exotic-quantum {
          0%, 100% { transform: scale(0.5); opacity: 0.1; }
          50% { transform: scale(1.5); opacity: 0.4; }
        }
        @keyframes exotic-materialize {
          0% { transform: scale(0.3); opacity: 0.5; }
          50% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(1.5); opacity: 0; }
        }
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
// Uses QSMManager for bidirectional terminal<->UI sync
// ==================================================
import { useQSMManagerOptional } from '@/contexts/QSMManager'
type QuantumState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline' | 'standby' | 'shutdown'
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
  coherence: propCoherence = 94,
  qubits: propQubits = 127,
  isEntangled: propEntangled = true,
  className,
  onTest,
  onReset,
}: QuantumStateProps) {
  const qsmManager = useQSMManagerOptional()

  const deviceState = qsmManager?.deviceState ?? 'online'
  const testResult = qsmManager?.testResult ?? null
  const statusMessage = qsmManager?.statusMessage ?? 'COHERENT'
  const isStandby = deviceState === 'standby'
  const isTransitioning = ['booting', 'shutdown', 'rebooting'].includes(deviceState)
  const isExpanded = qsmManager?.isExpanded ?? true

  const displayCoherence = qsmManager?.coherence ?? propCoherence
  const displayQubits = qsmManager?.qubits ?? propQubits
  const displayEntangled = qsmManager?.isEntangled ?? propEntangled
  const displayDraw = qsmManager?.currentDraw ?? 7
  const displayError = qsmManager?.errorRate ?? 0.8
  const displayTemp = qsmManager?.temperature ?? 15

  const [wavePhase, setWavePhase] = useState(0)
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animate wave function
  useEffect(() => {
    if (isStandby) return
    const interval = setInterval(() => {
      setWavePhase(p => (p + 0.15) % (Math.PI * 2))
    }, 50)
    return () => clearInterval(interval)
  }, [isStandby])

  // 5-min auto-close for folded info
  useEffect(() => {
    if (showFoldedInfo) {
      foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) }
    }
  }, [showFoldedInfo])

  const handleTest = async () => {
    if (qsmManager) await qsmManager.runTest()
    onTest?.()
  }

  const handleReboot = async () => {
    if (qsmManager) await qsmManager.reboot()
    onReset?.()
  }

  const getLedColor = () => {
    if (isStandby) return 'red'
    if (deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting' || deviceState === 'shutdown') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    return displayCoherence > 80 ? 'cyan' : 'amber'
  }

  const isLedOn = !isStandby
  const isActive = deviceState === 'online' || deviceState === 'testing'

  // Triangular crystal power button
  const CrystalPowerButton = () => qsmManager ? (
    <button
      onClick={() => isStandby ? qsmManager.powerOn() : qsmManager.powerOff()}
      disabled={isTransitioning}
      className="transition-all"
      style={{
        width: '10px',
        height: '10px',
        background: isStandby ? '#0a1a2a' : 'rgba(0,220,255,0.1)',
        border: `1px solid ${isStandby ? '#1a3a4a' : 'var(--neon-cyan)'}`,
        boxShadow: isStandby ? 'none' : '0 0 4px var(--neon-cyan), inset 0 0 3px rgba(0,220,255,0.2)',
        opacity: isTransitioning ? 0.4 : 1,
        cursor: isTransitioning ? 'not-allowed' : 'pointer',
        clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
      }}
      title={isStandby ? 'Power ON' : 'Power OFF'}
    />
  ) : null

  // Wooden micro button helper
  const woodBtn = (label: string, onClick: () => void, disabled: boolean, round: boolean, title: string, glowColor?: string) => (
    <button onClick={onClick} disabled={disabled} className="group relative disabled:opacity-30" title={title}>
      <div
        className={cn('w-2.5 h-2.5 p-[1px] transition-all group-active:scale-95', round ? 'rounded-full' : 'rounded-[2px]')}
        style={{
          background: round
            ? 'linear-gradient(180deg, #8b6914 0%, #5a4510 50%, #3a2a08 100%)'
            : 'linear-gradient(180deg, #6a4a20 0%, #4a3010 50%, #2a1a05 100%)',
          boxShadow: round
            ? 'inset 0 1px 0 rgba(255,220,150,0.3), inset 0 -1px 2px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)'
            : 'inset 0 1px 0 rgba(255,200,100,0.2), inset 0 -1px 2px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
          border: round ? '0.5px solid #2a1a00' : '0.5px solid #1a0a00',
        }}
      >
        <div
          className={cn('w-full h-full flex items-center justify-center', round ? 'rounded-full' : 'rounded-[1px]', glowColor)}
          style={{
            background: round
              ? 'radial-gradient(circle at 30% 30%, #a07820 0%, #6a4a12 60%, #4a3008 100%)'
              : 'linear-gradient(135deg, #7a5a18 0%, #5a3a10 50%, #3a2008 100%)',
          }}
        >
          <span className={cn('font-mono text-[3px] font-bold', round ? 'text-[#2a1a00]' : 'text-[#1a0a00]')}>{label}</span>
        </div>
      </div>
    </button>
  )

  const stateLabel = isStandby ? 'STANDBY' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'testing' ? 'TESTING' : deviceState === 'rebooting' ? 'REBOOTING' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'ONLINE'

  return (
    <PanelFrame variant="teal" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%', left: 0, top: 0,
      }}>
        <div className="flex items-center gap-1 px-1 py-0.5">
          <LED on={isLedOn} color={getLedColor()} size="sm" className="scale-75 shrink-0" />
          <span className="font-mono text-[5px] text-[var(--neon-cyan)] shrink-0">QSM-001</span>
          <span className={cn(
            'font-mono text-[4px] shrink-0',
            isStandby ? 'text-white/30' : 'text-[var(--neon-cyan)]/70'
          )}>{stateLabel}</span>
          <div className="flex-1" />

          {!isStandby && (
            <>
              {woodBtn('T', handleTest, deviceState !== 'online', true, 'Test',
                deviceState === 'testing' ? 'shadow-[0_0_4px_var(--neon-cyan)]' : undefined)}
              {woodBtn('R', handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || isStandby, false, 'Reboot',
                (deviceState === 'rebooting' || deviceState === 'booting') ? 'shadow-[0_0_4px_var(--neon-amber)]' : undefined)}
            </>
          )}
          <CrystalPowerButton />
          {/* Info toggle / fold toggle */}
          {!isStandby ? (
            <button
              onClick={() => setShowFoldedInfo(p => !p)}
              className="font-mono text-[5px] text-[var(--neon-cyan)]/50 hover:text-[var(--neon-cyan)] transition-colors px-0.5"
              title={showFoldedInfo ? 'Hide info' : 'Show info'}
            >{showFoldedInfo ? '▲' : '▼'}</button>
          ) : null}
        </div>

        {/* Folded info expansion */}
        <div style={{
          maxHeight: showFoldedInfo && !isStandby ? '60px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 300ms ease',
        }}>
          <div className="px-1.5 pb-1 grid grid-cols-3 gap-x-2 gap-y-0 font-mono text-[4px]">
            <span className="text-white/40">COH: <span className="text-[var(--neon-cyan)]">{displayCoherence}%</span></span>
            <span className="text-white/40">Qubits: <span className="text-[var(--neon-cyan)]">{displayQubits}</span></span>
            <span className="text-white/40">Entgl: <span className="text-[var(--neon-cyan)]">{displayEntangled ? 'YES' : 'NO'}</span></span>
            <span className="text-white/40">Err: <span className="text-[var(--neon-cyan)]">{displayError}%</span></span>
            <span className="text-white/40">Temp: <span className="text-[var(--neon-cyan)]">{displayTemp}°K</span></span>
            <span className="text-white/40">Draw: <span className="text-[var(--neon-cyan)]">{displayDraw} E/s</span></span>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%', left: 0, top: 0,
      }}>
        {/* Fold chevron */}
        {qsmManager && !isStandby && (
          <button
            onClick={() => qsmManager.toggleExpanded()}
            className="absolute top-[2px] right-[2px] z-10 font-mono text-[5px] text-[var(--neon-cyan)]/40 hover:text-[var(--neon-cyan)] transition-colors"
            title="Fold"
          >▴</button>
        )}

        <div className="p-1">
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
              <CrystalPowerButton />
            </div>

            {/* Worn wooden buttons */}
            <div className="flex items-center gap-0.5">
              {woodBtn('T', handleTest, deviceState !== 'online', true, 'Test',
                deviceState === 'testing' ? 'shadow-[0_0_4px_var(--neon-cyan)]' : undefined)}
              {woodBtn('R', handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || isStandby, false, 'Reboot',
                (deviceState === 'rebooting' || deviceState === 'booting') ? 'shadow-[0_0_4px_var(--neon-amber)]' : undefined)}
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
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0" />
                    <stop offset="50%" stopColor="var(--neon-cyan)" stopOpacity={isActive ? "0.6" : isStandby ? "0.05" : "0.2"} />
                    <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`M 0 20 ${Array.from({ length: 20 }, (_, i) => {
                    const x = (i / 19) * 100
                    const amplitude = isStandby ? 1 : isActive ? 8 : 3
                    const testMul = deviceState === 'testing' ? 1.5 : 1
                    const y = 20 + Math.sin(wavePhase + i * 0.5) * amplitude * testMul
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
                  isActive ? 'text-[var(--neon-cyan)]' :
                  isStandby ? 'text-[var(--neon-cyan)]/10' :
                  'text-[var(--neon-cyan)]/30'
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
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 5px, var(--neon-cyan) 5px, var(--neon-cyan) 6px)',
                  animation: 'quantum-scan 0.5s linear infinite',
                }}
              />
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
              {isStandby ? '--' : displayCoherence}% COH
            </span>
            <span className={cn(
              'flex-1 text-[4px] text-center whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
              isStandby ? 'text-white/30' :
              deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
              deviceState === 'booting' || deviceState === 'rebooting' ? 'text-[var(--neon-amber)]' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              'text-white/20'
            )}>
              {isStandby ? 'STANDBY' : statusMessage}
            </span>
            <span className={cn(
              'w-10 shrink-0 text-right transition-colors',
              !isStandby && displayEntangled ? 'text-[var(--neon-cyan)]' : 'text-white/30'
            )}>
              {isStandby ? '--' : displayQubits}Q
            </span>
          </div>
        </div>
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
  const manager = useNETManagerOptional()
  const deviceState = manager?.deviceState ?? 'online'
  const testPhase = manager?.testPhase ?? null
  const testResult = manager?.testResult ?? null
  const statusMessage = manager?.statusMessage ?? 'CONNECTED'
  const isPowered = manager?.isPowered ?? true
  const isExpanded = manager?.isExpanded ?? true
  const shutdownPhase = manager?.shutdownPhase ?? null
  const currentDraw = manager?.currentDraw ?? 0.8

  const displayBandwidth = manager?.bandwidth ?? bandwidth
  const displayLatency = manager?.latencyMs ?? latency
  const displayConnected = manager?.isConnected ?? isConnected

  const [bars, setBars] = useState([20, 35, 25, 45, 30, 50, 40, 55, 35, 45])

  // Folded info toggle
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = useCallback(() => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
      if (next) {
        foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }, [])

  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  // Animate bandwidth bars
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => {
        const base = deviceState === 'testing' ? 70 : 50
        const variance = deviceState === 'testing' ? 30 : 40
        return Math.max(15, Math.min(95, base + (Math.random() - 0.5) * variance))
      }))
    }, 200)
    return () => clearInterval(interval)
  }, [deviceState])

  const handleTest = () => {
    if (manager) { manager.runTest(); onTest?.() }
  }

  const handleReboot = () => {
    if (manager) { manager.reboot(); onReset?.() }
  }

  const handlePowerToggle = () => {
    if (!manager) return
    if (isPowered && deviceState !== 'standby') {
      manager.powerOff()
    } else if (deviceState === 'standby') {
      manager.powerOn()
    }
  }

  const getLedColor = () => {
    if (deviceState === 'standby' || deviceState === 'shutdown' || deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    return displayConnected ? 'lime' : 'red'
  }

  const isLedOn = deviceState !== 'standby' && deviceState !== 'shutdown'
  const isActive = deviceState === 'online' || deviceState === 'testing'

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-lime,#bfff00)'
      case 'booting': return 'var(--neon-amber)'
      case 'testing': return 'var(--neon-cyan)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': return 'var(--neon-red)'
      case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-lime,#bfff00)'
    }
  }

  const getStatusLabel = () => {
    switch (deviceState) {
      case 'online': return displayConnected ? 'CONNECTED' : 'ONLINE'
      case 'booting': return 'BOOT'
      case 'testing': return 'TEST'
      case 'rebooting': return 'REBOOT'
      case 'standby': return 'STANDBY'
      case 'shutdown': return 'SHTDWN'
      default: return 'ONLINE'
    }
  }

  // Toggle power switch helper for folded & unfolded
  const powerSwitch = (
    <button
      onClick={handlePowerToggle}
      disabled={deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'}
      className="group flex-shrink-0"
      title={isPowered && deviceState !== 'standby' ? 'Power Off' : 'Power On'}
    >
      <div
        className="w-[7px] h-[4px] rounded-full border transition-all relative overflow-hidden"
        style={{
          background: '#0a0a0a',
          borderColor: isPowered && deviceState !== 'standby' ? '#5a8a00' : deviceState === 'standby' ? '#8a6a00' : '#2a2a2a',
          boxShadow: isPowered && deviceState !== 'standby' ? '0 0 3px rgba(191,255,0,0.4)' : 'none',
        }}
      >
        <div
          className="absolute top-[0.5px] w-[3px] h-[2px] rounded-full transition-all"
          style={{
            left: isPowered && deviceState !== 'standby' ? '3px' : '0.5px',
            backgroundColor: isPowered && deviceState !== 'standby' ? 'var(--neon-lime,#bfff00)' : deviceState === 'standby' ? '#8a6a00' : '#333',
            boxShadow: isPowered && deviceState !== 'standby' ? '0 0 2px var(--neon-lime,#bfff00)' : 'none',
          }}
        />
      </div>
    </button>
  )

  // LED button helper
  const ledBtn = (onClick: () => void, disabled: boolean, title: string, bgGrad: string, borderColor: string, activeClass: string, inactiveClass: string, isActiveState: boolean) => (
    <button onClick={onClick} disabled={disabled} className="group relative disabled:opacity-30" title={title}>
      <div className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
        style={{ background: bgGrad, boxShadow: `inset 0 1px 0 rgba(100,255,100,0.1), 0 1px 2px rgba(0,0,0,0.5)`, border: `1px solid ${borderColor}` }}>
        <div className={cn('w-full h-full rounded-full transition-all', isActiveState ? activeClass : inactiveClass)} />
      </div>
    </button>
  )

  return (
    <PanelFrame variant="military" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%', left: 0, top: 0,
      }}>
        <div className="px-2 py-1.5">
          {/* Main folded row */}
          <div className="flex items-center gap-1.5">
            {/* Status LED */}
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 4px ${getStatusColor()}`,
              animation: (deviceState === 'booting' || deviceState === 'rebooting') ? 'pulse 0.5s ease-in-out infinite' : 'none',
            }} />
            <span className="font-mono text-[8px] text-[var(--neon-lime,#bfff00)] font-bold tracking-wide">NET-001</span>
            <span className="font-mono text-[7px] text-white/50">{getStatusLabel()}</span>
            <div className="flex-1" />

            {/* Action buttons - only when powered */}
            {isPowered && (
              <>
                {ledBtn(handleTest, deviceState !== 'online', 'Test',
                  'linear-gradient(180deg, #2a3a2a 0%, #1a2a1a 50%, #0a1a0a 100%)', '#3a4a3a',
                  'bg-[var(--neon-lime,#bfff00)] shadow-[0_0_6px_var(--neon-lime,#bfff00),0_0_12px_var(--neon-lime,#bfff00)]',
                  testResult === 'pass' ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]' : 'bg-[#1a2a1a]',
                  deviceState === 'testing')}
                {ledBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot',
                  'linear-gradient(180deg, #3a2a1a 0%, #2a1a0a 50%, #1a0a00 100%)', '#4a3a2a',
                  'bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber),0_0_12px_var(--neon-amber)]',
                  'bg-[#2a1a0a]',
                  deviceState === 'rebooting' || deviceState === 'booting')}
              </>
            )}

            {powerSwitch}

            {/* Info / Unfold toggle */}
            {isPowered ? (
              <button
                onClick={toggleFoldedInfo}
                className="font-mono text-[7px] text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
                title={showFoldedInfo ? 'Hide info' : 'Show info'}
              >
                {showFoldedInfo ? '▲' : '▼'}
              </button>
            ) : (
              <button
                onClick={() => manager?.setExpanded(true)}
                className="font-mono text-[7px] text-white/30 hover:text-white/50 transition-colors flex-shrink-0"
                title="Unfold"
              >
                ▼
              </button>
            )}
          </div>

          {/* Folded info expansion */}
          <div style={{
            maxHeight: showFoldedInfo && isPowered ? '40px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}>
            <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 font-mono text-[6px]">
              <span className="text-white/30">BW: <span className="text-[var(--neon-lime,#bfff00)]">{displayBandwidth.toFixed(1)} Gbps</span></span>
              <span className="text-white/30">Lat: <span className="text-[var(--neon-lime,#bfff00)]">{displayLatency}ms</span></span>
              <span className="text-white/30">Link: <span className="text-[var(--neon-lime,#bfff00)]">{displayConnected ? 'UP' : 'DOWN'}</span></span>
              <span className="text-white/30">Loss: <span className="text-[var(--neon-lime,#bfff00)]">{manager?.packetLoss ?? 0}%</span></span>
              <span className="text-white/30">Draw: <span className="text-[var(--neon-lime,#bfff00)]">{currentDraw.toFixed(1)}</span></span>
              <span className="text-white/30">Tier: <span className="text-white/50">T1</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%', left: 0, top: 0,
      }}>
        {/* Fold chevron */}
        <button
          onClick={() => manager?.setExpanded(false)}
          className="absolute top-0.5 right-1 z-20 font-mono text-[7px] text-white/30 hover:text-white/60 transition-colors"
          title="Fold"
        >
          ▴
        </button>

        <div className="p-1 relative">
          {/* Tiny toggle power switch — top-right */}
          <div className="absolute top-[3px] right-[10px] z-10">
            {powerSwitch}
          </div>

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
            <div className="font-mono text-[3px] text-white/20 mr-5">NET-001</div>
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

            {/* Standby/Shutdown overlay */}
            {(deviceState === 'standby' || deviceState === 'shutdown') && (
              <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center rounded">
                <span className="font-mono text-[6px] text-[var(--neon-red)]/60">
                  {shutdownPhase ? shutdownPhase.toUpperCase() : 'STANDBY'}
                </span>
              </div>
            )}
          </div>

          {/* Status bar with LED buttons on left */}
          <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
            {/* LED buttons - bottom left */}
            <div className="flex items-center gap-0.5">
              {ledBtn(handleTest, deviceState !== 'online', 'Test',
                'linear-gradient(180deg, #2a3a2a 0%, #1a2a1a 50%, #0a1a0a 100%)', '#3a4a3a',
                'bg-[var(--neon-lime,#bfff00)] shadow-[0_0_6px_var(--neon-lime,#bfff00),0_0_12px_var(--neon-lime,#bfff00)]',
                testResult === 'pass' ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]' : 'bg-[#1a2a1a]',
                deviceState === 'testing')}
              {ledBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot',
                'linear-gradient(180deg, #3a2a1a 0%, #2a1a0a 50%, #1a0a00 100%)', '#4a3a2a',
                'bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber),0_0_12px_var(--neon-amber)]',
                'bg-[#2a1a0a]',
                deviceState === 'rebooting' || deviceState === 'booting')}

              <span className={cn(
                'transition-colors ml-0.5',
                isActive ? 'text-[var(--neon-lime,#bfff00)]' : 'text-white/30'
              )}>
                {displayBandwidth.toFixed(1)} Gbps
              </span>
            </div>

            <span className={cn(
              'text-[4px] transition-colors',
              deviceState === 'testing' ? 'text-[var(--neon-lime,#bfff00)]' :
              testResult === 'pass' ? 'text-[var(--neon-green)]' :
              'text-white/20'
            )}>
              {deviceState === 'online' || deviceState === 'testing' ? `${displayLatency}ms` : statusMessage}
            </span>
          </div>
        </div>
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
  const manager = useTMPManagerOptional()
  const deviceState = manager?.deviceState ?? 'online'
  const testPhase = manager?.testPhase ?? null
  const testResult = manager?.testResult ?? null
  const statusMessage = manager?.statusMessage ?? 'NOMINAL'
  const isPowered = manager?.isPowered ?? true
  const isExpanded = manager?.isExpanded ?? true
  const shutdownPhase = manager?.shutdownPhase ?? null
  const currentDraw = manager?.currentDraw ?? 0.8

  const displayTemp = manager?.temperature ?? temperature
  const displayFluctuation = manager?.fluctuation ?? 0
  const displayMaxTemp = manager?.maxTemp ?? maxTemp
  const displayMinTemp = manager?.minTemp ?? minTemp

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const currentTemp = displayTemp + displayFluctuation
  const tempPercent = ((currentTemp - displayMinTemp) / (displayMaxTemp - displayMinTemp)) * 100
  const tempColor = currentTemp < 40 ? 'var(--neon-cyan)' : currentTemp < 60 ? 'var(--neon-green)' : currentTemp < 75 ? 'var(--neon-amber)' : 'var(--neon-red)'

  // Folded info toggle
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = useCallback(() => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current)
      if (next) {
        foldedInfoTimerRef.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }, [])

  useEffect(() => {
    return () => { if (foldedInfoTimerRef.current) clearTimeout(foldedInfoTimerRef.current) }
  }, [])

  const handleTest = () => {
    if (manager) { manager.runTest(); onTest?.() }
  }

  const handleReboot = () => {
    if (manager) { manager.reboot(); onReset?.() }
  }

  const handlePowerToggle = () => {
    if (!manager) return
    if (isPowered && deviceState !== 'standby') {
      manager.powerOff()
    } else if (deviceState === 'standby') {
      manager.powerOn()
    }
  }

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-amber)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': return 'var(--neon-red)'
      case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-amber)'
    }
  }

  const getStatusLabel = () => {
    switch (deviceState) {
      case 'online': return isActive ? `${currentTemp.toFixed(1)}°C` : 'ONLINE'
      case 'booting': return 'BOOT'
      case 'testing': return 'TEST'
      case 'rebooting': return 'REBOOT'
      case 'standby': return 'STANDBY'
      case 'shutdown': return 'SHTDWN'
      default: return 'ONLINE'
    }
  }

  // Hex power button helper
  const hexPowerBtn = (
    <button
      onClick={handlePowerToggle}
      disabled={deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'}
      className="group flex-shrink-0"
      title={isPowered && deviceState !== 'standby' ? 'Power Off' : 'Power On'}
    >
      <div
        className="w-[6px] h-[6px] transition-all"
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          background: isPowered && deviceState !== 'standby'
            ? 'linear-gradient(135deg, var(--neon-amber) 0%, #8a5a00 100%)'
            : deviceState === 'standby' ? '#4a3a1a' : '#2a2a2a',
          boxShadow: isPowered && deviceState !== 'standby' ? '0 0 3px var(--neon-amber)' : 'none',
        }}
      />
    </button>
  )

  // LED button helper
  const ledBtn = (onClick: () => void, disabled: boolean, title: string, bgGrad: string, borderColor: string, activeClass: string, inactiveClass: string, isActiveState: boolean) => (
    <button onClick={onClick} disabled={disabled} className="group relative disabled:opacity-30" title={title}>
      <div className="w-2.5 h-2.5 rounded-full p-[1px] transition-all group-active:scale-95"
        style={{ background: bgGrad, boxShadow: `inset 0 1px 0 rgba(255,200,100,0.15), 0 1px 2px rgba(0,0,0,0.5)`, border: `1px solid ${borderColor}` }}>
        <div className={cn('w-full h-full rounded-full transition-all', isActiveState ? activeClass : inactiveClass)} />
      </div>
    </button>
  )

  return (
    <PanelFrame variant="default" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%', left: 0, top: 0,
      }}>
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            {/* Status LED */}
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 4px ${getStatusColor()}`,
              animation: (deviceState === 'booting' || deviceState === 'rebooting') ? 'pulse 0.5s ease-in-out infinite' : 'none',
            }} />
            <span className="font-mono text-[8px] text-[var(--neon-amber)] font-bold tracking-wide">TMP-001</span>
            <span className="font-mono text-[7px] text-white/50">{getStatusLabel()}</span>
            <div className="flex-1" />

            {isPowered && (
              <>
                {ledBtn(handleTest, deviceState !== 'online', 'Test',
                  'linear-gradient(180deg, #4a3a2a 0%, #3a2a1a 50%, #2a1a0a 100%)', '#5a4a3a',
                  'bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber),0_0_12px_var(--neon-amber)]',
                  testResult === 'pass' ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]' : 'bg-[#2a1a0a]',
                  deviceState === 'testing')}
                {ledBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot',
                  'linear-gradient(180deg, #4a2a2a 0%, #3a1a1a 50%, #2a0a0a 100%)', '#5a3a3a',
                  'bg-[var(--neon-red)] shadow-[0_0_6px_var(--neon-red),0_0_12px_var(--neon-red)]',
                  'bg-[#2a0a0a]',
                  deviceState === 'rebooting' || deviceState === 'booting')}
              </>
            )}

            {hexPowerBtn}

            {isPowered ? (
              <button
                onClick={toggleFoldedInfo}
                className="font-mono text-[7px] text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
                title={showFoldedInfo ? 'Hide info' : 'Show info'}
              >
                {showFoldedInfo ? '▲' : '▼'}
              </button>
            ) : (
              <button
                onClick={() => manager?.setExpanded(true)}
                className="font-mono text-[7px] text-white/30 hover:text-white/50 transition-colors flex-shrink-0"
                title="Unfold"
              >
                ▼
              </button>
            )}
          </div>

          {/* Folded info expansion */}
          <div style={{
            maxHeight: showFoldedInfo && isPowered ? '40px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}>
            <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 font-mono text-[6px]">
              <span className="text-white/30">Temp: <span style={{ color: tempColor }}>{currentTemp.toFixed(1)}°C</span></span>
              <span className="text-white/30">Range: <span className="text-[var(--neon-amber)]">{displayMinTemp}-{displayMaxTemp}°</span></span>
              <span className="text-white/30">Status: <span className="text-[var(--neon-green)]">{statusMessage}</span></span>
              <span className="text-white/30">Draw: <span className="text-[var(--neon-amber)]">{currentDraw.toFixed(1)}</span></span>
              <span className="text-white/30">Tier: <span className="text-white/50">T1</span></span>
              <span className="text-white/30">Mode: <span className="text-[var(--neon-amber)]">AUTO</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%', left: 0, top: 0,
      }}>
        {/* Fold chevron */}
        <button
          onClick={() => manager?.setExpanded(false)}
          className="absolute top-0.5 right-1 z-20 font-mono text-[7px] text-white/30 hover:text-white/60 transition-colors"
          title="Fold"
        >
          ▴
        </button>

        <div className="p-1 relative">
          {/* Tiny hexagonal power button — top left */}
          <div className="absolute top-[3px] left-[3px] z-10">
            {hexPowerBtn}
          </div>

          {/* Header with company logo */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-0.5">
              <div className="font-mono text-[5px] text-[var(--neon-amber)] ml-2">TEMP</div>
            </div>
            <div className="flex items-center gap-0.5 mr-3">
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
              <div className="font-mono text-[3px] text-white/20">TMP-001</div>
            </div>
          </div>

          {/* Temperature visualization - expanded */}
          <div className={cn(
            'relative h-10 bg-black/60 rounded overflow-hidden',
            deviceState === 'testing' && 'ring-1 ring-[var(--neon-amber)]/30'
          )}>
            {/* Temperature gradient bar */}
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-3 rounded overflow-hidden">
              <div
                className="absolute inset-0 rounded"
                style={{
                  background: 'linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-green) 35%, var(--neon-amber) 65%, var(--neon-red) 100%)',
                  opacity: isActive ? 0.8 : 0.3,
                }}
              />
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
              <div className="absolute inset-0 flex justify-between px-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-px h-full bg-white/20" />
                ))}
              </div>
            </div>

            <div className="absolute inset-x-2 bottom-0.5 flex justify-between">
              <span className="font-mono text-[4px] text-[var(--neon-cyan)]/60">{displayMinTemp}°</span>
              <span className="font-mono text-[4px] text-[var(--neon-green)]/60">40°</span>
              <span className="font-mono text-[4px] text-[var(--neon-amber)]/60">60°</span>
              <span className="font-mono text-[4px] text-[var(--neon-red)]/60">{displayMaxTemp}°</span>
            </div>

            {deviceState === 'testing' && (
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 4px, var(--neon-amber) 4px, var(--neon-amber) 5px)',
                  animation: 'temp-scan 0.5s linear infinite',
                }}
              />
            )}

            {(deviceState === 'booting' || deviceState === 'rebooting') && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="font-mono text-[5px] text-[var(--neon-amber)] animate-pulse">{statusMessage}</span>
              </div>
            )}

            {(deviceState === 'standby' || deviceState === 'shutdown') && (
              <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center rounded">
                <span className="font-mono text-[6px] text-[var(--neon-red)]/60">
                  {shutdownPhase ? shutdownPhase.toUpperCase() : 'STANDBY'}
                </span>
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

            <div className="flex items-center gap-0.5">
              {ledBtn(handleTest, deviceState !== 'online', 'Test',
                'linear-gradient(180deg, #4a3a2a 0%, #3a2a1a 50%, #2a1a0a 100%)', '#5a4a3a',
                'bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber),0_0_12px_var(--neon-amber)]',
                testResult === 'pass' ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]' : 'bg-[#2a1a0a]',
                deviceState === 'testing')}
              {ledBtn(handleReboot, deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown', 'Reboot',
                'linear-gradient(180deg, #4a2a2a 0%, #3a1a1a 50%, #2a0a0a 100%)', '#5a3a3a',
                'bg-[var(--neon-red)] shadow-[0_0_6px_var(--neon-red),0_0_12px_var(--neon-red)]',
                'bg-[#2a0a0a]',
                deviceState === 'rebooting' || deviceState === 'booting')}
            </div>
          </div>
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
// SUPERCOMPUTER ARRAY - Tier 3 Tech heavy computation
// ==================================================
import { useSCAManagerOptional, SCA_FIRMWARE } from '@/contexts/SCAManager'
import { useEXDManagerOptional, EXD_FIRMWARE } from '@/contexts/EXDManager'

interface SupercomputerProps {
  flops?: number
  utilization?: number
  isOnline?: boolean
  className?: string
  onTest?: () => void
  onReset?: () => void
}

export function SupercomputerArray({
  className,
}: SupercomputerProps) {
  const scaManager = useSCAManagerOptional()

  // Derive all state from manager when available
  const deviceState = scaManager?.deviceState ?? 'online'
  const testPhase = scaManager?.testPhase ?? null
  const testResult = scaManager?.testResult ?? null
  const statusMessage = scaManager?.statusMessage ?? 'READY'
  const activeNodes = scaManager?.activeNodes ?? 16
  const displayFlops = scaManager?.flops ?? 2.4
  const displayLoad = scaManager?.utilization ?? 87
  const isStandby = deviceState === 'standby'
  const isTransitioning = ['booting', 'shutdown', 'rebooting', 'testing'].includes(deviceState)
  const isExpanded = scaManager?.isExpanded ?? true

  // Folded info toggle
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFoldedInfo = useCallback(() => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) {
        foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      }
      return next
    })
  }, [])

  useEffect(() => {
    return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) }
  }, [])

  const handleTest = () => scaManager?.runTest()
  const handleReboot = () => scaManager?.reboot()
  const handlePowerToggle = () => {
    if (isStandby) scaManager?.powerOn()
    else if (deviceState === 'online') scaManager?.powerOff()
  }

  const getLedColor = () => {
    if (isStandby || deviceState === 'shutdown') return 'red'
    if (deviceState === 'rebooting') return 'amber'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    if (testResult === 'pass') return 'green'
    if (testResult === 'fail') return 'red'
    return 'cyan'
  }

  const isLedOn = !isStandby
  const nodesActive = deviceState === 'online' || deviceState === 'testing' || deviceState === 'booting'

  // Hexagonal power button for SCA
  const HexPowerButton = ({ small }: { small?: boolean }) => {
    if (!scaManager) return null
    const size = small ? '12px' : '12px'
    return (
      <button
        onClick={handlePowerToggle}
        disabled={isTransitioning}
        className="group relative"
        title={isStandby ? 'Power ON' : 'Power OFF'}
        style={{ opacity: isTransitioning ? 0.4 : 1, cursor: isTransitioning ? 'not-allowed' : 'pointer' }}
      >
        <div
          className="flex items-center justify-center transition-all"
          style={{
            width: size,
            height: size,
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            background: isStandby
              ? 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)'
              : 'linear-gradient(180deg, rgba(0,255,255,0.3) 0%, rgba(0,180,200,0.2) 100%)',
            boxShadow: isStandby ? 'none' : '0 0 6px rgba(0,255,255,0.4)',
          }}
        >
          <span style={{
            fontSize: '6px',
            color: isStandby ? '#444' : 'var(--neon-cyan)',
            textShadow: isStandby ? 'none' : '0 0 3px var(--neon-cyan)',
            lineHeight: 1,
          }}>⏻</span>
        </div>
      </button>
    )
  }

  // Brushed steel micro button
  const steelBtn = (label: string, onClick: () => void, disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="font-mono transition-all"
      style={{
        fontSize: '6px',
        lineHeight: 1,
        padding: '2px 3px',
        background: '#2a3a4a',
        border: '1px solid #4a5a6a',
        borderRadius: '1px',
        color: disabled ? '#333' : '#8899aa',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.15), inset 0 -0.5px 0 rgba(0,0,0,0.3)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  )

  // State label for folded bar
  const stateLabel = isStandby ? 'STANDBY' : isTransitioning ? deviceState.toUpperCase() : 'ONLINE'
  const stateLedColor = isStandby ? '#555' : isTransitioning ? 'var(--neon-amber)' : 'var(--neon-cyan)'

  return (
    <PanelFrame variant="teal" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* ═══════════ FOLDED FRONT PANEL ═══════════ */}
      <div
        style={{
          transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? 'absolute' : 'relative',
          pointerEvents: isExpanded ? 'none' : 'auto',
          zIndex: isExpanded ? 0 : 2,
          width: '100%', left: 0, top: 0,
        }}
      >
        {/* Main folded bar */}
        <div className="flex items-center gap-1 px-1.5 py-1">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: stateLedColor,
              boxShadow: !isStandby ? `0 0 4px ${stateLedColor}` : 'none',
            }}
          />
          <span className="font-mono text-[7px] font-bold shrink-0" style={{ color: 'var(--neon-cyan)' }}>SCA-001</span>
          <span className="font-mono text-[6px] shrink-0" style={{ color: stateLedColor }}>{stateLabel}</span>
          <div className="flex-1" />
          {!isStandby && (
            <div className="flex gap-0.5">
              {steelBtn('T', handleTest, isTransitioning || isStandby)}
              {steelBtn('R', handleReboot, isTransitioning || isStandby)}
            </div>
          )}
          <HexPowerButton small />
          {!isStandby && (
            <button
              onClick={toggleFoldedInfo}
              className="font-mono transition-all"
              style={{
                fontSize: '8px', lineHeight: 1, padding: '1px 2px',
                color: showFoldedInfo ? 'var(--neon-cyan)' : '#556',
                cursor: 'pointer', background: 'none', border: 'none',
              }}
              title={showFoldedInfo ? 'Hide info' : 'Show info'}
            >
              {showFoldedInfo ? '▲' : '▼'}
            </button>
          )}
        </div>

        {/* Folded info expansion */}
        <div
          style={{
            maxHeight: showFoldedInfo && !isStandby ? '60px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}
        >
          <div className="px-2 pb-1.5 grid grid-cols-3 gap-x-3 gap-y-0.5">
            {[
              { label: 'PFLOPS', value: `${displayFlops.toFixed(1)}` },
              { label: 'Load', value: `${Math.round(displayLoad)}%` },
              { label: 'Nodes', value: `${activeNodes}/16` },
              { label: 'Jobs', value: `${scaManager?.jobQueue ?? 0}` },
              { label: 'Temp', value: `${Math.round(scaManager?.temperature ?? 42)}°C` },
              { label: 'Draw', value: `${Math.round(scaManager?.currentDraw ?? 15)} E/s` },
            ].map(({ label: l, value: v }) => (
              <div key={l} className="flex justify-between">
                <span className="font-mono text-[5px] text-white/30">{l}</span>
                <span className="font-mono text-[6px]" style={{ color: 'var(--neon-cyan)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ UNFOLDED INNER PANEL ═══════════ */}
      <div
        style={{
          transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
          transformOrigin: 'top center',
          transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? 'relative' : 'absolute',
          pointerEvents: isExpanded ? 'auto' : 'none',
          zIndex: isExpanded ? 2 : 0,
          width: '100%', left: 0, top: 0,
        }}
      >
        {/* Fold chevron */}
        {scaManager && (
          <button
            onClick={() => scaManager.toggleExpanded()}
            className="absolute top-0.5 right-0.5 z-10 font-mono transition-all"
            style={{
              fontSize: '7px', lineHeight: 1, padding: '1px 2px',
              color: '#445', cursor: 'pointer',
              background: 'rgba(0,0,0,0.3)', border: '1px solid #222',
              borderRadius: '2px',
            }}
            title="Fold panel"
          >
            ▴
          </button>
        )}

        {/* Original full content */}
        <div className={cn('p-2', isStandby && 'opacity-50')}>
          {/* Header with worn metal micro buttons */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <LED on={isLedOn} color={getLedColor()} size="sm" />
              <div className="font-mono text-[8px] text-[var(--neon-cyan)]">
                SUPERCOMPUTER
              </div>
              <span className="font-mono text-[4px] text-white/15">v{SCA_FIRMWARE.version}</span>
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
              <HexPowerButton />
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
                  <div className="absolute inset-0 rounded-[1px] opacity-30"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, rgba(255,255,255,0.1) 1px, transparent 2px)',
                    }}
                  />
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
                disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || isStandby}
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
                  <div className="absolute inset-0 rounded-[1px] opacity-30"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, rgba(255,255,255,0.1) 1px, transparent 2px)',
                    }}
                  />
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
                const isActive = nodesActive && i < activeNodes
                const nodeLoad = i < Math.floor(displayLoad / 6.25)
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
                      animation: isActive && nodeLoad && !isStandby
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

            {/* Standby overlay */}
            {isStandby && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-[7px] text-white/30">STANDBY</span>
              </div>
            )}
          </div>

          {/* Status bar with fixed layout */}
          <div className="flex items-center font-mono text-[7px] mt-1">
            <span className={cn(
              'w-12 shrink-0 transition-colors',
              nodesActive && !isStandby ? 'text-[var(--neon-cyan)]' : 'text-white/30'
            )}>
              {isStandby ? '---' : `${displayFlops.toFixed(1)} PFLOPS`}
            </span>
            <span className={cn(
              'flex-1 text-[5px] text-center transition-colors whitespace-nowrap overflow-hidden text-ellipsis px-0.5',
              deviceState === 'testing' ? 'text-[var(--neon-cyan)]' :
              deviceState === 'rebooting' || deviceState === 'booting' ? 'text-[var(--neon-amber)]' :
              deviceState === 'shutdown' ? 'text-[var(--neon-red)]' :
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
              {isStandby ? '---' : `${Math.round(displayLoad)}% LOAD`}
            </span>
          </div>
        </div>
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
  const dim = useDIMManagerOptional()

  const deviceState = dim?.deviceState ?? 'online'
  const bootPhase = dim?.bootPhase ?? null
  const testPhase = dim?.testPhase ?? null
  const testResult = dim?.testResult ?? null
  const statusMessage = dim?.statusMessage ?? 'STABLE'
  const isPowered = dim?.isPowered ?? true
  const shutdownPhase = dim?.shutdownPhase ?? null
  const displayDim = dim?.dimension ?? dimension
  const displayStability = dim?.stability ?? stability
  const displayRiftActivity = dim?.riftActivity ?? riftActivity
  const fluctuation = dim?.fluctuation ?? 0
  const isExpanded = dim?.isExpanded ?? true

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const currentDim = (dim?.dimension ?? dimension) + (dim?.fluctuation ?? fluctuation)
  const stabilityColor = displayStability > 80 ? 'var(--neon-green)' : displayStability > 50 ? 'var(--neon-amber)' : 'var(--neon-red)'

  // Additional computed values
  const haloProximity = Math.max(0, 100 - displayStability + displayRiftActivity * 100)
  const entanglementStrength = displayStability > 90 ? 'STRONG' : displayStability > 70 ? 'MODERATE' : 'WEAK'

  const handleFoldToggle = useCallback(() => dim?.toggleExpanded(), [dim])

  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) { foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000) }
      return next
    })
  }
  useEffect(() => { return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) } }, [])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  const handleTest = () => {
    if (dim) { dim.runTest(); onTest?.() }
  }

  const handleReboot = () => {
    if (dim) { dim.reboot(); onReset?.() }
  }

  const handlePowerToggle = () => {
    if (!dim) return
    if (isPowered && deviceState !== 'standby') {
      dim.powerOff()
    } else if (deviceState === 'standby') {
      dim.powerOn()
    }
  }

  return (
    <PanelFrame variant="teal" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* FOLDED FRONT PANEL */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
      }} className="w-full">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
            backgroundColor: getStatusColor(), boxShadow: `0 0 4px ${getStatusColor()}`,
            animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }} />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-purple,#9d00ff)]">DIM-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-purple,#9d00ff)]/70' : 'text-white/30')}>{stateLabel}</span>
          <div className="flex-1" />
          {isPowered && (<>
            <button onClick={handleTest} disabled={deviceState !== 'online'} className="group relative" title="Test">
              <div className="w-3 h-3 rounded-full border transition-all" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)', borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a', boxShadow: deviceState === 'testing' ? '0 0 6px var(--neon-purple), inset 0 0 3px var(--neon-purple)' : 'inset 0 1px 2px rgba(0,0,0,0.5)', opacity: deviceState !== 'online' ? 0.3 : 1 }} />
            </button>
            <button onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting'} className="group relative" title="Reboot">
              <div className="w-3 h-3 rounded-full border transition-all" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)', borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a', boxShadow: deviceState === 'rebooting' ? '0 0 6px var(--neon-amber), inset 0 0 3px var(--neon-amber)' : 'inset 0 1px 2px rgba(0,0,0,0.5)', opacity: deviceState === 'booting' || deviceState === 'rebooting' ? 0.3 : 1 }} />
            </button>
          </>)}
          {/* Diamond power button */}
          <button
            onClick={handlePowerToggle}
            disabled={deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="relative disabled:opacity-30"
            title={isPowered ? 'Power Off' : 'Power On'}
          >
            <div style={{
              width: '6px', height: '6px', transform: 'rotate(45deg)',
              background: isPowered && deviceState !== 'standby' ? 'var(--neon-purple, #9d00ff)' : '#1a0a2a',
              boxShadow: isPowered && deviceState !== 'standby' ? '0 0 4px var(--neon-purple, #9d00ff), 0 0 8px var(--neon-purple, #9d00ff)' : 'none',
              border: '0.5px solid #4a3a5a', transition: 'all 0.2s ease',
            }} />
          </button>
          {/* Info toggle */}
          {isPowered ? (
            <button onClick={toggleFoldedInfo} className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-purple,#9d00ff)]/40 transition-colors" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }} title={showFoldedInfo ? 'Hide info' : 'Show info'}>
              <span className="font-mono text-[6px] text-[var(--neon-purple,#9d00ff)]/60">{showFoldedInfo ? '▲' : '▼'}</span>
            </button>
          ) : <div className="w-3" />}
        </div>
        <div style={{ maxHeight: showFoldedInfo && isPowered ? '40px' : '0px', transition: 'max-height 400ms ease, opacity 300ms ease', opacity: showFoldedInfo && isPowered ? 1 : 0, overflow: 'hidden' }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-purple,#9d00ff)]/60 flex gap-3 flex-wrap">
            <span>Dim: D-{currentDim.toFixed(2)}</span>
            <span>Stability: {displayStability}%</span>
            <span>Rift: {(displayRiftActivity * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* UNFOLDED INNER PANEL */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
      }} className="w-full p-1 flex flex-col">
        <button onClick={handleFoldToggle} className="absolute top-1 right-1 z-10 group" title="Fold">
          <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center transition-all hover:border-[var(--neon-purple,#9d00ff)]/40" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}>
            <span className="font-mono text-[6px] text-[var(--neon-purple,#9d00ff)]/60">▴</span>
          </div>
        </button>

      {/* Standby/Shutdown overlay */}
      {(dim?.deviceState === 'standby' || dim?.deviceState === 'shutdown') && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 rounded pointer-events-none">
          <span className="font-mono text-[7px] text-white/50 tracking-widest">
            {dim?.deviceState === 'shutdown' ? dim?.statusMessage : 'STANDBY'}
          </span>
        </div>
      )}

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
              disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown'}
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
          <div className="font-mono text-[3px] text-white/20">DIM-001</div>
        </div>
      </div>

      {/* Dimensional visualization - expanded to fill space */}
      <div className={cn(
        'relative flex-1 min-h-[3rem] bg-black/60 rounded overflow-hidden',
        deviceState === 'testing' && 'ring-1 ring-[var(--neon-purple,#9d00ff)]/50',
        (deviceState === 'booting' || deviceState === 'rebooting') && 'ring-1 ring-[var(--neon-pink)]/30',
      )}>
        {/* Dimensional grid pattern - animates with perspective */}
        <div
          className={cn('absolute inset-0 transition-opacity duration-300', isActive ? 'opacity-30' : 'opacity-10')}
          style={{
            backgroundImage: `
              linear-gradient(90deg, var(--neon-purple,#9d00ff) 1px, transparent 1px),
              linear-gradient(var(--neon-purple,#9d00ff) 1px, transparent 1px)
            `,
            backgroundSize: '10px 10px',
            transform: isActive
              ? `perspective(80px) rotateX(${5 + fluctuation * 8}deg) rotateY(${fluctuation * 3}deg)`
              : deviceState === 'booting' || deviceState === 'rebooting'
              ? `perspective(80px) rotateX(${fluctuation * 12}deg)`
              : 'perspective(80px) rotateX(0deg)',
            transition: 'transform 0.15s ease-out',
          }}
        />

        {/* Ambient glow - pulses when active */}
        {isActive && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, var(--neon-purple,#9d00ff) 0%, transparent 65%)',
              opacity: 0.08,
              animation: 'dim-ambient 3s ease-in-out infinite',
            }}
          />
        )}

        {/* Central dimension indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Glow ring - pulses in all active states */}
            {(isActive || deviceState === 'booting' || deviceState === 'rebooting') && (
              <div
                className="absolute rounded-full"
                style={{
                  width: '36px',
                  height: '36px',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle, var(--neon-purple,#9d00ff) 0%, transparent 70%)`,
                  opacity: deviceState === 'testing' ? 0.5 : deviceState === 'booting' || deviceState === 'rebooting' ? 0.25 : 0.15,
                  animation: deviceState === 'testing'
                    ? 'dim-pulse 0.6s ease-in-out infinite'
                    : deviceState === 'booting' || deviceState === 'rebooting'
                    ? 'dim-pulse 1.2s ease-in-out infinite'
                    : 'dim-pulse 3s ease-in-out infinite',
                }}
              />
            )}
            {/* Dimension value */}
            <span
              className={cn('font-mono text-[14px] relative z-10 transition-all duration-200',
                deviceState === 'testing' && 'scale-105',
              )}
              style={{
                color: isActive ? 'var(--neon-purple,#9d00ff)' : (deviceState === 'booting' || deviceState === 'rebooting') ? 'var(--neon-purple,#9d00ff)' : 'rgba(255,255,255,0.2)',
                textShadow: isActive
                  ? `0 0 8px var(--neon-purple,#9d00ff), 0 0 ${deviceState === 'testing' ? '16' : '4'}px var(--neon-purple,#9d00ff)`
                  : (deviceState === 'booting' || deviceState === 'rebooting')
                  ? '0 0 4px var(--neon-purple,#9d00ff)'
                  : 'none',
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
            <div className="font-mono text-[5px] text-[var(--neon-pink)]">{(displayRiftActivity * 100).toFixed(1)}%</div>
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

        {/* Test overlay - rift scan expanding rings */}
        {deviceState === 'testing' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: testPhase === 'rift-scan'
                ? 'radial-gradient(circle at center, transparent 0%, var(--neon-purple,#9d00ff) 40%, transparent 70%)'
                : testPhase === 'stability'
                ? 'radial-gradient(circle at center, var(--neon-green) 0%, transparent 50%)'
                : testPhase === 'calibration'
                ? 'radial-gradient(circle at center, var(--neon-amber) 0%, transparent 50%)'
                : 'radial-gradient(circle at center, var(--neon-purple,#9d00ff) 0%, transparent 60%)',
              animation: testPhase === 'rift-scan' ? 'dim-scan 0.8s ease-out infinite' : 'dim-pulse 0.8s ease-in-out infinite',
              opacity: 0.25,
            }}
          />
        )}

        {/* Boot/Reboot overlay with scanline */}
        {(deviceState === 'booting' || deviceState === 'rebooting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
            {/* Scanning line */}
            <div
              className="absolute left-0 right-0 h-px pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, var(--neon-purple,#9d00ff) 50%, transparent 100%)',
                boxShadow: '0 0 6px var(--neon-purple,#9d00ff)',
                animation: 'dim-scanline 1.5s ease-in-out infinite',
              }}
            />
            <span className="font-mono text-[6px] text-[var(--neon-purple,#9d00ff)] animate-pulse relative z-10">{statusMessage}</span>
          </div>
        )}

        {/* Shutdown overlay - fade to black */}
        {deviceState === 'shutdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="font-mono text-[6px] text-[var(--neon-pink)] animate-pulse">{statusMessage}</span>
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

        <div className="flex items-center gap-1">
          <span className={cn(
            'text-[4px] transition-colors',
            isActive ? 'text-[var(--neon-green)]' : 'text-white/30'
          )}>
            {isActive ? 'LOCKED' : 'OFFLINE'}
          </span>

          {/* Diamond power button */}
          <button
            onClick={handlePowerToggle}
            disabled={deviceState === 'booting' || deviceState === 'shutdown' || deviceState === 'rebooting' || deviceState === 'testing'}
            className="relative disabled:opacity-30"
            title={isPowered ? 'Power Off' : 'Power On'}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                transform: 'rotate(45deg)',
                background: isPowered && deviceState !== 'standby'
                  ? 'var(--neon-purple, #9d00ff)'
                  : '#1a0a2a',
                boxShadow: isPowered && deviceState !== 'standby'
                  ? '0 0 4px var(--neon-purple, #9d00ff), 0 0 8px var(--neon-purple, #9d00ff)'
                  : 'none',
                border: '0.5px solid #4a3a5a',
                transition: 'all 0.2s ease',
              }}
            />
          </button>
        </div>
      </div>

      </div>
      {/* END UNFOLDED INNER PANEL */}

      <style jsx global>{`
        @keyframes dim-pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.3); opacity: 0.5; }
        }
        @keyframes dim-scan {
          0% { transform: scale(0); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes dim-ambient {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.12; }
        }
        @keyframes dim-scanline {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
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
export function CpuMonitor({ className }: { className?: string }) {
  const cpuManager = useCPUManagerOptional()

  // Fallback values if no context
  const deviceState = cpuManager?.deviceState ?? 'online'
  const isPowered = cpuManager?.isPowered ?? true
  const statusMessage = cpuManager?.statusMessage ?? 'READY'
  const testResult = cpuManager?.testResult ?? null
  const testPhase = cpuManager?.testPhase ?? null
  const bootPhase = cpuManager?.bootPhase ?? null
  const shutdownPhase = cpuManager?.shutdownPhase ?? null
  const coreLoads = cpuManager?.coreLoads ?? Array(8).fill(67)
  const cores = cpuManager?.cores ?? 8
  const frequency = cpuManager?.frequency ?? 4.2
  const utilization = cpuManager?.utilization ?? 67
  const temperature = cpuManager?.temperature ?? 62
  const isExpanded = cpuManager?.isExpanded ?? true

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const avgLoad = coreLoads.length > 0 ? Math.round(coreLoads.reduce((a, b) => a + b, 0) / coreLoads.length) : 0

  const handleFoldToggle = useCallback(() => cpuManager?.toggleExpanded(), [cpuManager])

  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) { foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000) }
      return next
    })
  }
  useEffect(() => { return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) } }, [])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  // Handlers call context methods
  const handleTest = () => cpuManager?.runTest()
  const handleReboot = () => cpuManager?.reboot()
  const handlePowerToggle = () => {
    if (isPowered) cpuManager?.powerOff()
    else cpuManager?.powerOn()
  }

  return (
    <PanelFrame variant="teal" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
      {/* FOLDED FRONT PANEL */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
      }} className="w-full">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
            backgroundColor: getStatusColor(), boxShadow: `0 0 4px ${getStatusColor()}`,
            animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }} />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-cyan)]">CPU-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-cyan)]/70' : 'text-white/30')}>{stateLabel}</span>
          <div className="flex-1" />
          {isPowered && (<>
            <button onClick={handleTest} disabled={deviceState !== 'online'} className="group relative" title="Test">
              <div className="w-3 h-3 rounded-full border transition-all" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)', borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a', boxShadow: deviceState === 'testing' ? '0 0 6px var(--neon-purple), inset 0 0 3px var(--neon-purple)' : 'inset 0 1px 2px rgba(0,0,0,0.5)', opacity: deviceState !== 'online' ? 0.3 : 1 }} />
            </button>
            <button onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting'} className="group relative" title="Reboot">
              <div className="w-3 h-3 rounded-full border transition-all" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)', borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a', boxShadow: deviceState === 'rebooting' ? '0 0 6px var(--neon-amber), inset 0 0 3px var(--neon-amber)' : 'inset 0 1px 2px rgba(0,0,0,0.5)', opacity: deviceState === 'booting' || deviceState === 'rebooting' ? 0.3 : 1 }} />
            </button>
          </>)}
          {/* Hexagonal power button */}
          <button
            onClick={handlePowerToggle}
            className="relative group"
            title={isPowered ? 'Power OFF' : 'Power ON'}
            style={{
              width: '6px', height: '6px',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: isPowered ? 'linear-gradient(135deg, #00ffff 0%, #00cccc 100%)' : 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
              boxShadow: isPowered ? '0 0 4px rgba(0,255,255,0.8), 0 0 8px rgba(0,255,255,0.4), inset 0 0 2px rgba(255,255,255,0.5)' : 'inset 0 1px 1px rgba(0,0,0,0.5)',
              transition: 'all 0.2s ease',
            }}
          />
          {/* Info toggle */}
          {isPowered ? (
            <button onClick={toggleFoldedInfo} className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-cyan)]/40 transition-colors" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }} title={showFoldedInfo ? 'Hide info' : 'Show info'}>
              <span className="font-mono text-[6px] text-[var(--neon-cyan)]/60">{showFoldedInfo ? '▲' : '▼'}</span>
            </button>
          ) : <div className="w-3" />}
        </div>
        <div style={{ maxHeight: showFoldedInfo && isPowered ? '40px' : '0px', transition: 'max-height 400ms ease, opacity 300ms ease', opacity: showFoldedInfo && isPowered ? 1 : 0, overflow: 'hidden' }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-cyan)]/60 flex gap-3 flex-wrap">
            <span>Load: {avgLoad}%</span>
            <span>Cores: {cores}</span>
            <span>Freq: {frequency.toFixed(1)} GHz</span>
            <span>Temp: {temperature}&deg;C</span>
          </div>
        </div>
      </div>

      {/* UNFOLDED INNER PANEL */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
      }} className="w-full p-1 flex flex-col">
        <button onClick={handleFoldToggle} className="absolute top-1 right-1 z-10 group" title="Fold">
          <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center transition-all hover:border-[var(--neon-cyan)]/40" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}>
            <span className="font-mono text-[6px] text-[var(--neon-cyan)]/60">▴</span>
          </div>
        </button>

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

        {/* Shutdown overlay */}
        {deviceState === 'shutdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="font-mono text-[5px] text-[var(--neon-amber)] animate-pulse">{statusMessage}</span>
          </div>
        )}

        {/* Standby overlay */}
        {deviceState === 'standby' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <span className="font-mono text-[6px] text-white/30 tracking-wide">STANDBY</span>
          </div>
        )}
      </div>

      {/* Status bar with power button */}
      <div className="relative flex items-center justify-between font-mono text-[5px] mt-0.5">
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
          deviceState === 'standby' ? 'text-white/20' :
          'text-white/20'
        )}>
          {statusMessage}
        </span>

        <div className="flex items-center gap-1">
          <span className="text-[3px] text-white/20">CPU-1</span>

          {/* Hexagonal power button */}
          <button
            onClick={handlePowerToggle}
            className="relative group"
            title={isPowered ? 'Power OFF' : 'Power ON'}
            style={{
              width: '6px',
              height: '6px',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: isPowered
                ? 'linear-gradient(135deg, #00ffff 0%, #00cccc 100%)'
                : 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
              boxShadow: isPowered
                ? '0 0 4px rgba(0,255,255,0.8), 0 0 8px rgba(0,255,255,0.4), inset 0 0 2px rgba(255,255,255,0.5)'
                : 'inset 0 1px 1px rgba(0,0,0,0.5)',
              transition: 'all 0.2s ease',
            }}
          />
        </div>
      </div>

      </div>
      {/* END UNFOLDED INNER PANEL */}

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

export function LabClock({ className }: { className?: string }) {
  const clk = useCLKManagerOptional()

  const deviceState = clk?.deviceState ?? 'online'
  const isPowered = clk?.isPowered ?? true
  const statusMessage = clk?.statusMessage ?? 'SYNCED'
  const testResult = clk?.testResult ?? null
  const testPhase = clk?.testPhase ?? null
  const shutdownPhase = clk?.shutdownPhase ?? null
  const displayMode = clk?.displayMode ?? 'local'
  const currentTime = clk?.currentTime ?? new Date()
  const uptime = clk?.uptime ?? 0
  const stopwatchTime = clk?.stopwatchTime ?? 0
  const stopwatchRunning = clk?.stopwatchRunning ?? false
  const countdownTime = clk?.countdownTime ?? 3600
  const countdownRunning = clk?.countdownRunning ?? false

  const isExpanded = clk?.isExpanded ?? true

  const isActive = deviceState === 'online' || deviceState === 'testing'

  const handleTest = () => clk?.runTest()
  const handleReboot = () => clk?.reboot()
  const handlePowerToggle = () => {
    if (isPowered) clk?.powerOff()
    else clk?.powerOn()
  }
  const handleFoldToggle = useCallback(() => clk?.toggleExpanded(), [clk])
  const cycleMode = () => clk?.cycleMode()
  const toggleStopwatch = () => clk?.toggleStopwatch()
  const resetStopwatch = () => clk?.resetStopwatch()
  const toggleCountdown = () => clk?.toggleCountdown()

  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current)
      if (next) { foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000) }
      return next
    })
  }
  useEffect(() => { return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) } }, [])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Countdown timer color/weight tiers
  const getCountdownStyle = (seconds: number) => {
    if (seconds <= 5) return { numColor: '#ff1a1a', colonColor: '#ff1a1a', weight: 700, flash: true }
    if (seconds <= 10) return { numColor: '#ef4444', colonColor: '#ff1a1a', weight: 700, flash: false }
    if (seconds <= 30) return { numColor: '#ef4444', colonColor: '#eab308', weight: 700, flash: false }
    if (seconds <= 120) return { numColor: '#eab308', colonColor: '#22c55e', weight: 400, flash: false }
    return { numColor: '#22c55e', colonColor: '#0d9488', weight: 300, flash: false }
  }

  const renderCountdownDisplay = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    const style = getCountdownStyle(seconds)
    const nums = [
      h.toString().padStart(2, '0'),
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0'),
    ]
    return (
      <span
        className="font-mono text-[16px] tabular-nums tracking-wider"
        style={{ fontWeight: style.weight, animation: style.flash ? 'blink 0.5s steps(1) infinite' : undefined }}
      >
        <span style={{ color: style.numColor, textShadow: `0 0 8px ${style.numColor}66` }}>{nums[0]}</span>
        <span style={{ color: style.colonColor }}>:</span>
        <span style={{ color: style.numColor, textShadow: `0 0 8px ${style.numColor}66` }}>{nums[1]}</span>
        <span style={{ color: style.colonColor }}>:</span>
        <span style={{ color: style.numColor, textShadow: `0 0 8px ${style.numColor}66` }}>{nums[2]}</span>
      </span>
    )
  }

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
    <PanelFrame variant="default" className={cn('overflow-hidden relative', className)} style={{ perspective: '600px' }}>
      {/* FOLDED FRONT PANEL */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
      }} className="w-full">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
            backgroundColor: getStatusColor(), boxShadow: `0 0 4px ${getStatusColor()}`,
            animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }} />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-green)]">CLK-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-green)]/70' : 'text-white/30')}>{stateLabel}</span>
          <div className="flex-1" />
          {isPowered && (<>
            <button onClick={handleTest} disabled={deviceState !== 'online'} className="group relative" title="Test">
              <div className="w-3 h-3 rounded-full border transition-all" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)', borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a', boxShadow: deviceState === 'testing' ? '0 0 6px var(--neon-purple), inset 0 0 3px var(--neon-purple)' : 'inset 0 1px 2px rgba(0,0,0,0.5)', opacity: deviceState !== 'online' ? 0.3 : 1 }} />
            </button>
            <button onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting'} className="group relative" title="Reboot">
              <div className="w-3 h-3 rounded-full border transition-all" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)', borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a', boxShadow: deviceState === 'rebooting' ? '0 0 6px var(--neon-amber), inset 0 0 3px var(--neon-amber)' : 'inset 0 1px 2px rgba(0,0,0,0.5)', opacity: deviceState === 'booting' || deviceState === 'rebooting' ? 0.3 : 1 }} />
            </button>
          </>)}
          {/* Power button - capsule */}
          <button
            onClick={handlePowerToggle}
            className="group relative"
            title={isPowered ? 'Power Off' : 'Power On'}
          >
            <div
              className="w-2 h-1 rounded-full flex items-center px-0.5 transition-all"
              style={{
                background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
                border: '0.5px solid #2a2a2a',
              }}
            >
              <div
                className="w-0.5 h-0.5 rounded-full transition-all duration-200"
                style={{
                  background: isPowered
                    ? 'radial-gradient(circle, var(--neon-green) 0%, #00aa00 100%)'
                    : '#1a1a1a',
                  boxShadow: isPowered ? '0 0 2px var(--neon-green)' : 'none',
                  transform: isPowered ? 'translateX(0.5px)' : 'translateX(-0.5px)',
                }}
              />
            </div>
          </button>
          {/* Info toggle */}
          {isPowered ? (
            <button onClick={toggleFoldedInfo} className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-green)]/40 transition-colors" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }} title={showFoldedInfo ? 'Hide info' : 'Show info'}>
              <span className="font-mono text-[6px] text-[var(--neon-green)]/60">{showFoldedInfo ? '\u25B2' : '\u25BC'}</span>
            </button>
          ) : <div className="w-3" />}
        </div>
        <div style={{ maxHeight: showFoldedInfo && isPowered ? '40px' : '0px', transition: 'max-height 400ms ease, opacity 300ms ease', opacity: showFoldedInfo && isPowered ? 1 : 0, overflow: 'hidden' }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-green)]/60 flex gap-3 flex-wrap">
            <span>Mode: {displayMode.toUpperCase()}</span>
            <span>Time: {display.main}</span>
            <span>Tier: T1</span>
          </div>
        </div>
      </div>

      {/* UNFOLDED INNER PANEL */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
      }} className="w-full p-1 flex flex-col">
        <button onClick={handleFoldToggle} className="absolute top-1 right-1 z-10 group" title="Fold">
          <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center transition-all hover:border-[var(--neon-green)]/40" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}>
            <span className="font-mono text-[6px] text-[var(--neon-green)]/60">{'\u25B4'}</span>
          </div>
        </button>

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
          {displayMode === 'countdown' && isActive && countdownRunning ? (
            renderCountdownDisplay(countdownTime)
          ) : (
            <span
              className="font-mono text-[16px] tabular-nums tracking-wider"
              style={{
                color: isActive ? 'var(--neon-green)' : 'white/30',
                textShadow: isActive ? '0 0 10px var(--neon-green), 0 0 20px var(--neon-green)' : 'none',
              }}
            >
              {display.main}
            </span>
          )}
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

        {/* Standby/Shutdown overlay */}
        {(deviceState === 'standby' || deviceState === 'shutdown') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <span className="font-mono text-[6px] text-white/40">{statusMessage.toUpperCase()}</span>
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

      {/* Status bar with power button, status message, LED buttons, and device ID */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        {/* Left: Power button + Status message */}
        <div className="flex items-center gap-1">
          {/* Tiny capsule power button */}
          <button
            onClick={handlePowerToggle}
            className="group relative"
            title={isPowered ? 'Power Off' : 'Power On'}
          >
            <div
              className="w-2 h-1 rounded-full flex items-center px-0.5 transition-all"
              style={{
                background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
                border: '0.5px solid #2a2a2a',
              }}
            >
              <div
                className="w-0.5 h-0.5 rounded-full transition-all duration-200"
                style={{
                  background: isPowered
                    ? 'radial-gradient(circle, var(--neon-green) 0%, #00aa00 100%)'
                    : '#1a1a1a',
                  boxShadow: isPowered ? '0 0 2px var(--neon-green)' : 'none',
                  transform: isPowered ? 'translateX(0.5px)' : 'translateX(-0.5px)',
                }}
              />
            </div>
          </button>

          <span className={cn(
            'text-[4px]',
            deviceState === 'testing' ? 'text-[var(--neon-green)]' :
            testResult === 'pass' ? 'text-[var(--neon-green)]' :
            'text-white/20'
          )}>
            {statusMessage}
          </span>
        </div>

        {/* Center: LED buttons */}
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

        {/* Right: Device ID */}
        <span className="text-[3px] text-white/20">CLK-1</span>
      </div>
      </div>{/* end UNFOLDED INNER PANEL */}

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

export function MemoryMonitor({ className }: { className?: string }) {
  const memManager = useMEMManagerOptional()

  // Context state with fallbacks
  const deviceState = memManager?.deviceState ?? 'online'
  const isPowered = memManager?.isPowered ?? true
  const statusMessage = memManager?.statusMessage ?? 'READY'
  const testResult = memManager?.testResult ?? null
  const testPhase = memManager?.testPhase ?? null
  const bootPhase = memManager?.bootPhase ?? null
  const shutdownPhase = memManager?.shutdownPhase ?? null
  const displayMode = memManager?.displayMode ?? 'usage'
  const totalMemory = memManager?.totalMemory ?? 16
  const usedMemory = memManager?.usedMemory ?? 11.5
  const memData = memManager?.memData ?? {
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
  }
  const currentDraw = memManager?.currentDraw ?? 0.4
  const isExpanded = memManager?.isExpanded ?? true

  const isActive = deviceState === 'online' || deviceState === 'testing'
  const usagePercent = (usedMemory / totalMemory) * 100
  const usageColor = usagePercent > 85 ? 'var(--neon-red)' : usagePercent > 70 ? 'var(--neon-amber)' : 'var(--neon-amber)'

  // Handlers call context methods
  const handleTest = () => memManager?.runTest()
  const handleReboot = () => memManager?.reboot()
  const handleCycleMode = () => memManager?.cycleMode()
  const handlePowerToggle = () => {
    if (isPowered) memManager?.powerOff()
    else memManager?.powerOn()
  }
  const handleFoldToggle = useCallback(() => memManager?.toggleExpanded(), [memManager])

  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimerMem = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleFoldedInfo = () => {
    setShowFoldedInfo(prev => {
      const next = !prev
      if (foldedInfoTimerMem.current) clearTimeout(foldedInfoTimerMem.current)
      if (next) { foldedInfoTimerMem.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000) }
      return next
    })
  }
  useEffect(() => { return () => { if (foldedInfoTimerMem.current) clearTimeout(foldedInfoTimerMem.current) } }, [])

  const getStatusColor = () => {
    switch (deviceState) {
      case 'online': return 'var(--neon-green)'
      case 'booting': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'rebooting': return 'var(--neon-amber)'
      case 'standby': case 'shutdown': return 'var(--neon-red)'
      default: return 'var(--neon-green)'
    }
  }
  const stateLabel = deviceState === 'online' ? 'ONLINE' : deviceState === 'testing' ? 'TESTING' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'rebooting' ? 'REBOOT' : deviceState === 'shutdown' ? 'SHUTDOWN' : 'STANDBY'

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
    <PanelFrame variant="military" className={cn('overflow-hidden relative', className)} style={{ perspective: '600px' }}>
      {/* FOLDED FRONT PANEL */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
      }} className="w-full">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
            backgroundColor: getStatusColor(), boxShadow: `0 0 4px ${getStatusColor()}`,
            animation: deviceState === 'booting' || deviceState === 'rebooting' ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }} />
          <span className="font-mono text-[8px] font-bold text-[var(--neon-amber)]">MEM-001</span>
          <span className={cn('font-mono text-[7px]', isPowered ? 'text-[var(--neon-amber)]/70' : 'text-white/30')}>{stateLabel}</span>
          <div className="flex-1" />
          {isPowered && (<>
            <button onClick={handleTest} disabled={deviceState !== 'online'} className="group relative" title="Test">
              <div className="w-3 h-3 rounded-full border transition-all" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)', borderColor: deviceState === 'testing' ? 'var(--neon-purple)' : '#3a3a4a', boxShadow: deviceState === 'testing' ? '0 0 6px var(--neon-purple), inset 0 0 3px var(--neon-purple)' : 'inset 0 1px 2px rgba(0,0,0,0.5)', opacity: deviceState !== 'online' ? 0.3 : 1 }} />
            </button>
            <button onClick={handleReboot} disabled={deviceState === 'booting' || deviceState === 'rebooting'} className="group relative" title="Reboot">
              <div className="w-3 h-3 rounded-full border transition-all" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)', borderColor: deviceState === 'rebooting' ? 'var(--neon-amber)' : '#3a3a4a', boxShadow: deviceState === 'rebooting' ? '0 0 6px var(--neon-amber), inset 0 0 3px var(--neon-amber)' : 'inset 0 1px 2px rgba(0,0,0,0.5)', opacity: deviceState === 'booting' || deviceState === 'rebooting' ? 0.3 : 1 }} />
            </button>
          </>)}
          {/* Power button - diamond */}
          <button
            onClick={handlePowerToggle}
            className="relative group"
            title={isPowered ? 'Power OFF' : 'Power ON'}
          >
            <div
              style={{
                width: '5px',
                height: '5px',
                transform: 'rotate(45deg)',
                background: isPowered
                  ? 'linear-gradient(135deg, #ffcc00 0%, #ff9900 100%)'
                  : 'linear-gradient(135deg, #2a2a1a 0%, #1a1a0a 100%)',
                boxShadow: isPowered
                  ? '0 0 4px rgba(255,170,0,0.8), 0 0 8px rgba(255,170,0,0.4), inset 0 0 2px rgba(255,255,200,0.5)'
                  : 'inset 0 1px 1px rgba(0,0,0,0.5)',
                border: isPowered ? '0.5px solid #ffcc66' : '0.5px solid #3a3a2a',
                transition: 'all 0.2s ease',
              }}
            />
          </button>
          {/* Info toggle */}
          {isPowered ? (
            <button onClick={toggleFoldedInfo} className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:border-[var(--neon-amber)]/40 transition-colors" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }} title={showFoldedInfo ? 'Hide info' : 'Show info'}>
              <span className="font-mono text-[6px] text-[var(--neon-amber)]/60">{showFoldedInfo ? '\u25B2' : '\u25BC'}</span>
            </button>
          ) : <div className="w-3" />}
        </div>
        <div style={{ maxHeight: showFoldedInfo && isPowered ? '40px' : '0px', transition: 'max-height 400ms ease, opacity 300ms ease', opacity: showFoldedInfo && isPowered ? 1 : 0, overflow: 'hidden' }}>
          <div className="px-2 pb-1.5 font-mono text-[7px] text-[var(--neon-amber)]/60 flex gap-3 flex-wrap">
            <span>Used: {usedMemory.toFixed(1)}G / {totalMemory}G</span>
            <span>Mode: {displayMode.toUpperCase()}</span>
            <span>Draw: {currentDraw.toFixed(1)} E/s</span>
          </div>
        </div>
      </div>

      {/* UNFOLDED INNER PANEL */}
      <div style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
      }} className="w-full p-1 flex flex-col">
        <button onClick={handleFoldToggle} className="absolute top-1 right-1 z-10 group" title="Fold">
          <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center transition-all hover:border-[var(--neon-amber)]/40" style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0a0a0f 70%)' }}>
            <span className="font-mono text-[6px] text-[var(--neon-amber)]/60">{'\u25B4'}</span>
          </div>
        </button>

      {/* Header with mode button, diamond power button, and logo */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1">
          <div className="font-mono text-[5px] text-[var(--neon-amber)]">MEM</div>
          {/* Mode cycle button */}
          <button
            onClick={handleCycleMode}
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

        {/* Diamond/rhombus power button - center header */}
        <button
          onClick={handlePowerToggle}
          className="relative group"
          title={isPowered ? 'Power OFF' : 'Power ON'}
        >
          <div
            style={{
              width: '5px',
              height: '5px',
              transform: 'rotate(45deg)',
              background: isPowered
                ? 'linear-gradient(135deg, #ffcc00 0%, #ff9900 100%)'
                : 'linear-gradient(135deg, #2a2a1a 0%, #1a1a0a 100%)',
              boxShadow: isPowered
                ? '0 0 4px rgba(255,170,0,0.8), 0 0 8px rgba(255,170,0,0.4), inset 0 0 2px rgba(255,255,200,0.5)'
                : 'inset 0 1px 1px rgba(0,0,0,0.5)',
              border: isPowered ? '0.5px solid #ffcc66' : '0.5px solid #3a3a2a',
              transition: 'all 0.2s ease',
            }}
          />
        </button>

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
              {isActive ? `${usedMemory.toFixed(1)}G` : '--'}
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

        {/* Shutdown overlay */}
        {deviceState === 'shutdown' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 pointer-events-none">
            <span className="font-mono text-[5px] text-[var(--neon-amber)] animate-pulse">
              {shutdownPhase ? shutdownPhase.toUpperCase() : 'SHUTTING DOWN'}
            </span>
          </div>
        )}

        {/* Standby overlay */}
        {deviceState === 'standby' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 pointer-events-none">
            <span className="font-mono text-[6px] text-white/30 tracking-wide">STANDBY</span>
          </div>
        )}
      </div>

      {/* Status bar with LED buttons at bottom right center */}
      <div className="flex items-center justify-between font-mono text-[5px] mt-0.5">
        <span className={cn(
          'text-[4px]',
          deviceState === 'testing' ? 'text-[var(--neon-amber)]' :
          testResult === 'pass' ? 'text-[var(--neon-green)]' :
          deviceState === 'standby' ? 'text-white/20' :
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
            disabled={deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'testing' || deviceState === 'standby' || deviceState === 'shutdown'}
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
      </div>{/* end UNFOLDED INNER PANEL */}

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

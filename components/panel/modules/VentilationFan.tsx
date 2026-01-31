'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { LED } from '../controls/LED'
import { KnurledWheel } from '../controls/KnurledWheel'
import { useThermalManagerOptional } from '@/contexts/ThermalManager'
import { useVNTManagerOptional, VNT_FIRMWARE } from '@/contexts/VNTManager'

interface VentilationFanProps {
  className?: string
  label?: string
  fanId?: 'cpu' | 'gpu'
  systemLoad?: number
  targetTemp?: number
}

// Individual fan unit with retro industrial design
function FanUnit({ speed, isOn }: { speed: number; isOn: boolean }) {
  // Smooth duration calculation - faster at high speed
  const duration = isOn && speed > 0 ? Math.max(0.04, 1.2 - (speed / 100) * 1.15) : 0
  const bladeColor = isOn ? '#8899aa' : '#556677'
  const bladeColorDark = isOn ? '#556677' : '#334455'
  const hubColor = isOn ? '#667788' : '#445566'

  return (
    <div className="relative w-full aspect-square bg-[#050508] rounded-sm border border-[#1a1a2a] flex items-center justify-center overflow-hidden">
      {/* Outer casing ring */}
      <div
        className="absolute rounded-full border-2 border-[#2a2a3a]"
        style={{
          top: '3px',
          left: '3px',
          right: '3px',
          bottom: '3px',
          background: 'radial-gradient(circle at 30% 30%, #1a1a2a 0%, #0a0a12 60%, #050508 100%)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8), inset 0 -1px 4px rgba(255,255,255,0.05)',
        }}
      />

      {/* SVG fan blades - rendered on top for guaranteed visibility */}
      <svg
        viewBox="-50 -50 100 100"
        className="absolute"
        style={{
          top: '6px',
          left: '6px',
          right: '6px',
          bottom: '6px',
          width: 'calc(100% - 12px)',
          height: 'calc(100% - 12px)',
          animation: isOn && speed > 0 ? `smoothSpin ${duration}s linear infinite` : 'none',
          willChange: 'transform',
        }}
      >
        {/* 6 curved fan blades */}
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <path
            key={angle}
            d="M 0,-4 C 4,-6 10,-30 6,-44 C 5,-46 1,-46 0,-44 C -1,-46 -5,-46 -6,-44 C -10,-30 -4,-6 0,-4 Z"
            transform={`rotate(${angle})`}
            fill={bladeColor}
            stroke={bladeColorDark}
            strokeWidth="0.5"
            opacity={isOn ? 0.9 : 0.7}
          />
        ))}
        {/* Center hub */}
        <circle cx="0" cy="0" r="8" fill={hubColor} stroke="#3a4a5a" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="3" fill="#3a4a5a" stroke="#2a3a4a" strokeWidth="0.5" />
        {/* Hub highlight */}
        <circle cx="-2" cy="-2" r="2" fill="rgba(255,255,255,0.1)" />
      </svg>

      {/* Glow effect when running */}
      {isOn && speed > 0 && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            top: '3px', left: '3px', right: '3px', bottom: '3px',
            background: 'radial-gradient(circle at center, rgba(0,255,255,0.06) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Corner screws */}
      {[
        { top: '2px', left: '2px' },
        { top: '2px', right: '2px' },
        { bottom: '2px', left: '2px' },
        { bottom: '2px', right: '2px' },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            ...pos,
            background: 'linear-gradient(135deg, #4a4a5a 0%, #2a2a3a 100%)',
            boxShadow: 'inset 0 0.5px 1px rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </div>
  )
}

// VNT power button - circular with fan blade icon
function VntPowerButton({ isPowered, isTransitioning, onToggle }: { isPowered: boolean; isTransitioning: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={isTransitioning}
      className="flex items-center justify-center rounded-full transition-all"
      style={{
        width: '14px',
        height: '14px',
        background: isPowered ? 'rgba(0,255,255,0.15)' : '#1a1a2a',
        border: `1px solid ${isPowered ? 'var(--neon-cyan)' : '#333'}`,
        color: isPowered ? 'var(--neon-cyan)' : '#555',
        boxShadow: isPowered ? '0 0 4px var(--neon-cyan)' : 'none',
        opacity: isTransitioning ? 0.5 : 1,
        cursor: isTransitioning ? 'not-allowed' : 'pointer',
        fontSize: '7px',
        lineHeight: 1,
      }}
      title={isPowered ? 'Power OFF' : 'Power ON'}
    >
      ⏻
    </button>
  )
}

// Industrial micro button for folded bar
function indBtn(label: string, onClick: () => void, disabled: boolean, active?: boolean) {
  return (
    <button
      key={label}
      onClick={onClick}
      disabled={disabled}
      className="font-mono transition-all"
      style={{
        fontSize: '6px',
        lineHeight: 1,
        padding: '2px 3px',
        background: active ? 'rgba(0,255,255,0.2)' : '#0a0a12',
        border: `1px solid ${active ? 'var(--neon-cyan)' : '#2a2a3a'}`,
        borderRadius: '2px',
        color: active ? 'var(--neon-cyan)' : disabled ? '#333' : '#667',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: active ? '0 0 3px rgba(0,255,255,0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )
}

export function VentilationFan({
  className,
  label = 'COOL',
  fanId = 'cpu',
  systemLoad = 50,
  targetTemp = 32
}: VentilationFanProps) {
  // Try to use managers if available
  const thermalManager = useThermalManagerOptional()
  const vntManager = useVNTManagerOptional()
  const vntOnline = vntManager ? vntManager.deviceState === 'online' : true
  const vntTransitioning = vntManager ? ['booting', 'shutdown', 'testing', 'rebooting'].includes(vntManager.deviceState) : false
  const vntStandby = vntManager ? vntManager.deviceState === 'standby' : false
  const isExpanded = vntManager?.isExpanded ?? true

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

  // Local state (used when thermal manager not available)
  const [localIsOn, setLocalIsOn] = useState(true)
  const [localSpeed, setLocalSpeed] = useState(65)
  const [localMode, setLocalMode] = useState<'AUTO' | 'LOW' | 'MED' | 'HIGH'>('AUTO')
  const [localTemp, setLocalTemp] = useState(34)
  const [localRpm, setLocalRpm] = useState(2400)

  // Use thermal manager state if available, otherwise use local state
  const fanState = thermalManager?.state.fans[fanId]
  const zoneTemp = thermalManager?.state.zones[fanId]?.temperature
  const overallStatus = thermalManager?.state.overallStatus ?? 'nominal'

  const isOn = fanState?.isOn ?? localIsOn
  const speed = fanState?.speed ?? localSpeed
  const mode = fanState?.mode ?? localMode
  const temp = zoneTemp ?? localTemp
  const rpm = fanState?.rpm ?? localRpm

  // Flashing warning state
  const [flashOn, setFlashOn] = useState(true)

  // Flash warning light when overheating
  useEffect(() => {
    if (overallStatus === 'critical' || overallStatus === 'warning') {
      const flashInterval = setInterval(() => {
        setFlashOn(prev => !prev)
      }, overallStatus === 'critical' ? 250 : 500)
      return () => clearInterval(flashInterval)
    } else {
      setFlashOn(true)
    }
  }, [overallStatus])

  // Local auto-adjust speed based on system load when in AUTO mode (fallback)
  useEffect(() => {
    if (thermalManager) return // Skip if using thermal manager

    if (localMode === 'AUTO' && localIsOn) {
      const autoSpeed = Math.min(100, Math.max(20, systemLoad + 15 + (localTemp > targetTemp ? (localTemp - targetTemp) * 3 : 0)))
      setLocalSpeed(Math.round(autoSpeed))
    }
  }, [thermalManager, localMode, localIsOn, systemLoad, localTemp, targetTemp])

  // Local RPM calculation (fallback)
  useEffect(() => {
    if (thermalManager) return

    if (!localIsOn) {
      setLocalRpm(0)
      return
    }
    const baseRpm = (localSpeed / 100) * 4000 + 800
    setLocalRpm(Math.round(baseRpm))
  }, [thermalManager, localSpeed, localIsOn])

  // Local temperature simulation (fallback)
  useEffect(() => {
    if (thermalManager) return

    const interval = setInterval(() => {
      setLocalTemp(prev => {
        const delta = (Math.random() - 0.5) * 2
        const heatFromLoad = systemLoad * 0.3
        const coolingFromFan = localIsOn ? localSpeed * 0.2 : 0
        const target = 25 + heatFromLoad - coolingFromFan
        return Math.round((prev + (target - prev) * 0.1 + delta) * 10) / 10
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [thermalManager, localIsOn, localSpeed, systemLoad])

  const handleSpeedChange = useCallback((v: number) => {
    if (thermalManager) {
      thermalManager.setFanSpeed(fanId, v)
    } else {
      setLocalSpeed(v)
      if (localMode === 'AUTO') setLocalMode('MED')
    }
  }, [thermalManager, fanId, localMode])

  const handleModeChange = useCallback((m: 'AUTO' | 'LOW' | 'MED' | 'HIGH') => {
    if (thermalManager) {
      thermalManager.setFanMode(fanId, m)
    } else {
      setLocalMode(m)
      if (m === 'LOW') setLocalSpeed(25)
      else if (m === 'MED') setLocalSpeed(50)
      else if (m === 'HIGH') setLocalSpeed(100)
    }
  }, [thermalManager, fanId])

  const handlePowerToggle = useCallback(() => {
    if (thermalManager) {
      thermalManager.toggleFan(fanId, !isOn)
    } else {
      setLocalIsOn(!localIsOn)
    }
  }, [thermalManager, fanId, isOn, localIsOn])

  const getTempColor = () => {
    if (thermalManager) {
      return thermalManager.getTemperatureColor(temp)
    }
    if (temp < 30) return 'var(--neon-cyan)'
    if (temp < 38) return 'var(--neon-green)'
    if (temp < 45) return 'var(--neon-amber)'
    return 'var(--neon-red)'
  }

  const getWarningLedColor = (): 'red' | 'amber' | undefined => {
    if (overallStatus === 'critical') return flashOn ? 'red' : undefined
    if (overallStatus === 'warning') return flashOn ? 'amber' : undefined
    return undefined
  }

  const showWarningLed = (overallStatus === 'critical' || overallStatus === 'warning') && flashOn

  // State label for folded bar
  const stateLabel = vntStandby ? 'STANDBY' : vntTransitioning ? (vntManager?.deviceState?.toUpperCase() ?? '...') : 'ONLINE'
  const stateLedColor = vntStandby ? '#555' : vntTransitioning ? 'var(--neon-amber)' : 'var(--neon-cyan)'

  return (
    <PanelFrame variant="default" className={cn('relative overflow-hidden', className)} style={{ perspective: '600px' }}>
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
          {/* LED */}
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: stateLedColor,
              boxShadow: !vntStandby ? `0 0 4px ${stateLedColor}` : 'none',
            }}
          />
          <span className="font-mono text-[7px] font-bold shrink-0" style={{ color: 'var(--neon-cyan)' }}>VNT-001</span>
          <span className="font-mono text-[6px] shrink-0" style={{ color: stateLedColor }}>{stateLabel}</span>
          <div className="flex-1" />
          {/* Action buttons */}
          {!vntStandby && (
            <div className="flex gap-0.5">
              {indBtn('T', () => vntManager?.runTest(), vntTransitioning || vntStandby)}
              {indBtn('R', () => vntManager?.reboot(), vntTransitioning || vntStandby)}
            </div>
          )}
          {vntManager && (
            <VntPowerButton
              isPowered={!vntStandby}
              isTransitioning={vntTransitioning}
              onToggle={() => vntStandby ? vntManager.powerOn() : vntManager.powerOff()}
            />
          )}
          {/* Info toggle / Unfold */}
          {!vntStandby && (
            <button
              onClick={toggleFoldedInfo}
              className="font-mono transition-all"
              style={{
                fontSize: '8px',
                lineHeight: 1,
                padding: '1px 2px',
                color: showFoldedInfo ? 'var(--neon-cyan)' : '#556',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
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
            maxHeight: showFoldedInfo && !vntStandby ? '60px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 300ms ease',
          }}
        >
          <div className="px-2 pb-1.5 grid grid-cols-3 gap-x-3 gap-y-0.5">
            {[
              { label: 'CPU', value: `${temp.toFixed(0)}°C` },
              { label: 'RPM', value: `${rpm}` },
              { label: 'Mode', value: mode },
              { label: 'Speed', value: `${speed}%` },
              { label: 'Filter', value: `${vntManager?.filterHealth ?? 98}%` },
              { label: 'Draw', value: `${vntManager?.currentDraw ?? 2} E/s` },
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
        {vntManager && (
          <button
            onClick={() => vntManager.toggleExpanded()}
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
        <div className={cn('flex flex-col flex-1 min-h-0', vntStandby && 'opacity-60')}>
          {/* Header */}
          <div className="flex items-center justify-between px-1.5 py-1 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1">
              <LED on={isOn && !vntStandby} color={isOn && !vntStandby ? 'green' : 'red'} size="sm" />
              {/* Warning LED - flashes when overheating */}
              <LED
                on={showWarningLed}
                color={getWarningLedColor() || 'red'}
                size="sm"
              />
              <span className="font-mono text-[7px] text-[var(--neon-cyan)] font-bold">{label}</span>
              {/* VNT Power button */}
              {vntManager && (
                <VntPowerButton
                  isPowered={!vntStandby}
                  isTransitioning={vntTransitioning}
                  onToggle={() => vntStandby ? vntManager.powerOn() : vntManager.powerOff()}
                />
              )}
              <span className="font-mono text-[5px] text-white/20">v{VNT_FIRMWARE.version}</span>
            </div>
            <span className="font-mono text-[6px] text-white/40">{vntStandby ? '---' : `${rpm} RPM`}</span>
          </div>

          {/* 4 Fans Vertical Stack */}
          <div className="flex-1 min-h-0 p-1.5 flex flex-col gap-1">
            <div className="flex-1 flex flex-col gap-1 justify-center">
              <FanUnit speed={speed} isOn={isOn && !vntStandby} />
              <FanUnit speed={speed} isOn={isOn && !vntStandby} />
              <FanUnit speed={speed} isOn={isOn && !vntStandby} />
              <FanUnit speed={speed} isOn={isOn && !vntStandby} />
            </div>

            {/* Temperature display / status display */}
            <div className="flex justify-center shrink-0">
              {vntTransitioning ? (
                <div
                  className="font-mono text-[8px] px-2 py-0.5 rounded border animate-pulse"
                  style={{
                    color: 'var(--neon-amber)',
                    borderColor: 'rgba(255,191,0,0.3)',
                    backgroundColor: 'rgba(255,191,0,0.05)',
                    textShadow: '0 0 6px var(--neon-amber)',
                  }}
                >
                  {vntManager?.statusMessage ?? '...'}
                </div>
              ) : vntStandby ? (
                <div
                  className="font-mono text-[8px] px-2 py-0.5 rounded border"
                  style={{
                    color: '#555',
                    borderColor: '#333',
                    backgroundColor: '#111',
                  }}
                >
                  STANDBY
                </div>
              ) : (
                <div
                  className={cn(
                    "font-mono text-[9px] px-2 py-0.5 rounded border relative",
                    (overallStatus === 'critical' || overallStatus === 'warning') && "animate-pulse"
                  )}
                  style={{
                    color: getTempColor(),
                    borderColor: `${getTempColor()}50`,
                    backgroundColor: `${getTempColor()}10`,
                    textShadow: `0 0 6px ${getTempColor()}`,
                  }}
                >
                  {temp.toFixed(1)}°C
                  {/* Overheat indicator */}
                  {(overallStatus === 'critical' || overallStatus === 'warning') && (
                    <span
                      className="absolute -right-1 -top-1 w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: overallStatus === 'critical' ? 'var(--neon-red)' : 'var(--neon-amber)',
                        boxShadow: `0 0 6px ${overallStatus === 'critical' ? 'var(--neon-red)' : 'var(--neon-amber)'}`,
                        animation: 'pulse 0.5s ease-in-out infinite',
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="px-1.5 pb-1.5 shrink-0">
            {/* Main control row - Knurled wheel + Mode buttons */}
            <div className="flex gap-1.5 items-stretch">
              {/* Knurled wheel for fine adjustment */}
              <div className="flex flex-col items-center">
                <KnurledWheel
                  value={speed}
                  min={0}
                  max={100}
                  onChange={handleSpeedChange}
                  disabled={!isOn || vntStandby}
                  label="SPD"
                  size="sm"
                />
              </div>

              {/* Mode buttons + Power */}
              <div className="flex-1 flex flex-col gap-0.5 justify-center">
                {/* Mode buttons - 2x2 grid */}
                <div className="grid grid-cols-2 gap-0.5">
                  {(['AUTO', 'LOW', 'MED', 'HIGH'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleModeChange(m)}
                      disabled={!isOn || vntStandby}
                      className={cn(
                        'py-0.5 rounded font-mono text-[5px] transition-all border',
                        mode === m
                          ? 'bg-[var(--neon-cyan)] text-black font-bold border-[var(--neon-cyan)] shadow-[0_0_4px_var(--neon-cyan)]'
                          : 'bg-[#0a0a0f] text-white/40 border-[#1a1a2a] hover:text-white/60 hover:border-white/20 disabled:opacity-50'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Power button */}
                <button
                  onClick={handlePowerToggle}
                  className={cn(
                    'w-full py-0.5 rounded font-mono text-[5px] transition-all border',
                    isOn
                      ? 'bg-[var(--neon-red)]/20 text-[var(--neon-red)] border-[var(--neon-red)]/50'
                      : 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]/50'
                  )}
                >
                  {isOn ? 'STOP' : 'START'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes smoothSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </PanelFrame>
  )
}

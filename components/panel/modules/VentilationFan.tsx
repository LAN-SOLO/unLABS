'use client'

import { useState, useEffect, useCallback } from 'react'
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

  // Local state (used when thermal manager not available)
  const [localIsOn, setLocalIsOn] = useState(true)
  const [localSpeed, setLocalSpeed] = useState(65)
  const [localMode, setLocalMode] = useState<'AUTO' | 'LOW' | 'MED' | 'HIGH'>('AUTO')
  const [localTemp, setLocalTemp] = useState(34)
  const [localRpm, setLocalRpm] = useState(2400)

  // Use thermal manager state if available, otherwise use local state
  const fanState = thermalManager?.state.fans[fanId]
  const zoneTemp = thermalManager?.state.zones[fanId]?.temperature
  const isOverheating = thermalManager?.state.isOverheating ?? false
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

  return (
    <PanelFrame variant="default" className={cn('flex flex-col flex-1 min-h-0', vntStandby && 'opacity-60', className)}>
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
            <button
              onClick={() => vntStandby ? vntManager.powerOn() : vntManager.powerOff()}
              disabled={vntTransitioning}
              className="flex items-center justify-center rounded-full transition-all"
              style={{
                width: '12px',
                height: '12px',
                fontSize: '7px',
                lineHeight: 1,
                background: vntStandby ? '#1a1a2a' : 'rgba(0,255,255,0.15)',
                border: `1px solid ${vntStandby ? '#333' : 'var(--neon-cyan)'}`,
                color: vntStandby ? '#555' : 'var(--neon-cyan)',
                boxShadow: vntStandby ? 'none' : '0 0 4px var(--neon-cyan)',
                opacity: vntTransitioning ? 0.5 : 1,
                cursor: vntTransitioning ? 'not-allowed' : 'pointer',
              }}
              title={vntStandby ? 'Power ON' : 'Power OFF'}
            >
              ⏻
            </button>
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { LED } from '../controls/LED'
import { KnurledWheel } from '../controls/KnurledWheel'
import { useThermalManagerOptional } from '@/contexts/ThermalManager'

interface VentilationFanProps {
  className?: string
  label?: string
  fanId?: 'cpu' | 'gpu'
  systemLoad?: number
  targetTemp?: number
}

// Individual fan unit with retro industrial design
function FanUnit({ speed, isOn }: { speed: number; isOn: boolean }) {
  const rpm = isOn && speed > 0 ? Math.round((speed / 100) * 4000 + 800) : 0
  // Smooth duration calculation - faster at high speed
  const duration = isOn && speed > 0 ? Math.max(0.04, 1.2 - (speed / 100) * 1.15) : 0

  return (
    <div className="flex-1 relative bg-[#050508] rounded-sm border border-[#1a1a2a] flex items-center justify-center overflow-hidden">
      {/* Outer casing ring */}
      <div
        className="absolute inset-1 rounded-full border-2 border-[#2a2a3a]"
        style={{
          background: 'radial-gradient(circle at 30% 30%, #1a1a2a 0%, #0a0a0f 60%, #050508 100%)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8), inset 0 -1px 4px rgba(255,255,255,0.05)'
        }}
      >
        {/* Wire mesh grill */}
        <div
          className="absolute inset-0 rounded-full opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(0deg, transparent 49%, #3a3a4a 49%, #3a3a4a 51%, transparent 51%),
              linear-gradient(90deg, transparent 49%, #3a3a4a 49%, #3a3a4a 51%, transparent 51%)
            `,
            backgroundSize: '8px 8px'
          }}
        />

        {/* Rotating fan assembly */}
        <div
          className="absolute inset-2 rounded-full"
          style={{
            animation: isOn && speed > 0 ? `smoothSpin ${duration}s linear infinite` : 'none',
            willChange: 'transform',
          }}
        >
          {/* 5 Fan blades */}
          {[0, 72, 144, 216, 288].map((angle) => (
            <div
              key={angle}
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <div
                className="absolute w-[14%] origin-bottom"
                style={{
                  height: '42%',
                  bottom: '50%',
                  background: isOn
                    ? 'linear-gradient(to right, #4a4a5a 0%, #6a6a7a 30%, #5a5a6a 70%, #3a3a4a 100%)'
                    : 'linear-gradient(to right, #2a2a3a 0%, #3a3a4a 50%, #2a2a3a 100%)',
                  borderRadius: '2px 2px 0 0',
                  boxShadow: isOn ? '0 0 4px rgba(0,255,255,0.1)' : 'none',
                  transform: 'skewX(-8deg)',
                }}
              />
            </div>
          ))}

          {/* Center hub */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] h-[22%] rounded-full"
            style={{
              background: 'radial-gradient(circle at 40% 40%, #4a4a5a 0%, #2a2a3a 50%, #1a1a2a 100%)',
              boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            {/* Center screw */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full"
              style={{
                background: 'linear-gradient(135deg, #5a5a6a 0%, #2a2a3a 100%)',
              }}
            />
          </div>
        </div>

        {/* Glow effect when running */}
        {isOn && speed > 0 && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(0,255,255,0.05) 0%, transparent 70%)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        )}
      </div>

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
  // Try to use thermal manager if available
  const thermalManager = useThermalManagerOptional()

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
    <PanelFrame variant="default" className={cn('flex flex-col flex-1 min-h-0', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-1.5 py-1 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1">
          <LED on={isOn} color={isOn ? 'green' : 'red'} size="sm" />
          {/* Warning LED - flashes when overheating */}
          <LED
            on={showWarningLed}
            color={getWarningLedColor() || 'red'}
            size="sm"
          />
          <span className="font-mono text-[7px] text-[var(--neon-cyan)] font-bold">{label}</span>
        </div>
        <span className="font-mono text-[6px] text-white/40">{rpm} RPM</span>
      </div>

      {/* 4 Fans Vertical Stack */}
      <div className="flex-1 min-h-0 p-1.5 flex flex-col gap-1">
        <div className="flex-1 flex flex-col gap-1">
          <FanUnit speed={speed} isOn={isOn} />
          <FanUnit speed={speed} isOn={isOn} />
          <FanUnit speed={speed} isOn={isOn} />
          <FanUnit speed={speed} isOn={isOn} />
        </div>

        {/* Temperature display with warning indicator */}
        <div className="flex justify-center shrink-0">
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
              disabled={!isOn}
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
                  disabled={!isOn}
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

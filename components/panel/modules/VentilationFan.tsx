'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { LED } from '../controls/LED'
import { KnurledWheel } from '../controls/KnurledWheel'

interface VentilationFanProps {
  className?: string
  label?: string
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

export function VentilationFan({ className, label = 'COOL', systemLoad = 50, targetTemp = 32 }: VentilationFanProps) {
  const [isOn, setIsOn] = useState(true)
  const [speed, setSpeed] = useState(65)
  const [mode, setMode] = useState<'AUTO' | 'LOW' | 'MED' | 'HIGH'>('AUTO')
  const [temp, setTemp] = useState(34)
  const [rpm, setRpm] = useState(2400)

  // Auto-adjust speed based on system load when in AUTO mode
  useEffect(() => {
    if (mode === 'AUTO' && isOn) {
      const autoSpeed = Math.min(100, Math.max(20, systemLoad + 15 + (temp > targetTemp ? (temp - targetTemp) * 3 : 0)))
      setSpeed(Math.round(autoSpeed))
    }
  }, [mode, isOn, systemLoad, temp, targetTemp])

  useEffect(() => {
    if (!isOn) {
      setRpm(0)
      return
    }
    const baseRpm = (speed / 100) * 4000 + 800
    setRpm(Math.round(baseRpm))
  }, [speed, isOn])

  useEffect(() => {
    const interval = setInterval(() => {
      setTemp(prev => {
        const delta = (Math.random() - 0.5) * 2
        const heatFromLoad = systemLoad * 0.3
        const coolingFromFan = isOn ? speed * 0.2 : 0
        const target = 25 + heatFromLoad - coolingFromFan
        return Math.round((prev + (target - prev) * 0.1 + delta) * 10) / 10
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [isOn, speed, systemLoad])

  const getTempColor = () => {
    if (temp < 30) return 'var(--neon-cyan)'
    if (temp < 38) return 'var(--neon-green)'
    if (temp < 45) return 'var(--neon-amber)'
    return 'var(--neon-red)'
  }

  return (
    <PanelFrame variant="default" className={cn('flex flex-col flex-1 min-h-0', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-1.5 py-1 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1">
          <LED on={isOn} color={isOn ? 'green' : 'red'} size="sm" />
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

        {/* Temperature display */}
        <div className="flex justify-center shrink-0">
          <div
            className="font-mono text-[9px] px-2 py-0.5 rounded border"
            style={{
              color: getTempColor(),
              borderColor: `${getTempColor()}50`,
              backgroundColor: `${getTempColor()}10`,
              textShadow: `0 0 6px ${getTempColor()}`,
            }}
          >
            {temp}°C
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
              onChange={(v) => {
                setSpeed(v)
                if (mode === 'AUTO') setMode('MED') // Switch to manual when wheel is used
              }}
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
                  onClick={() => {
                    setMode(m)
                    if (m === 'LOW') setSpeed(25)
                    else if (m === 'MED') setSpeed(50)
                    else if (m === 'HIGH') setSpeed(100)
                  }}
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
              onClick={() => setIsOn(!isOn)}
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

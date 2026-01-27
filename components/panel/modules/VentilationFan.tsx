'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { LED } from '../controls/LED'

interface VentilationFanProps {
  className?: string
}

export function VentilationFan({ className }: VentilationFanProps) {
  const [isOn, setIsOn] = useState(true)
  const [speed, setSpeed] = useState(65) // 0-100
  const [mode, setMode] = useState<'AUTO' | 'LOW' | 'MED' | 'HIGH'>('AUTO')
  const [temp, setTemp] = useState(34)
  const [rpm, setRpm] = useState(2400)

  // Update RPM based on speed
  useEffect(() => {
    if (!isOn) {
      setRpm(0)
      return
    }
    const baseRpm = (speed / 100) * 4000 + 800
    setRpm(Math.round(baseRpm))
  }, [speed, isOn])

  // Simulate temperature fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setTemp(prev => {
        const delta = (Math.random() - 0.5) * 2
        const target = isOn ? 28 + (100 - speed) * 0.1 : 45
        return Math.round((prev + (target - prev) * 0.1 + delta) * 10) / 10
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [isOn, speed])

  // Calculate rotation speed (CSS animation duration)
  const rotationDuration = isOn ? Math.max(0.1, 2 - (speed / 100) * 1.8) : 0

  const getTempColor = () => {
    if (temp < 30) return 'var(--neon-cyan)'
    if (temp < 38) return 'var(--neon-green)'
    if (temp < 45) return 'var(--neon-amber)'
    return 'var(--neon-red)'
  }

  return (
    <PanelFrame variant="default" className={cn('p-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <LED on={isOn} color={isOn ? 'green' : 'red'} size="sm" />
          <span className="font-mono text-[9px] text-[var(--neon-cyan)] font-bold">VENTILATION</span>
        </div>
        <span className="font-mono text-[7px] text-white/40">SYS-COOL</span>
      </div>

      {/* Fan Display */}
      <div className="relative w-full aspect-square bg-[#0a0a0a] rounded-lg border border-[#1a1a2a] mb-2 overflow-hidden">
        {/* Fan housing */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border-2 border-[#0a0a0a]"
          style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)' }}
        >
          {/* Fan blades */}
          <div
            className="absolute inset-1 rounded-full flex items-center justify-center"
            style={{
              animation: isOn ? `spin ${rotationDuration}s linear infinite` : 'none',
            }}
          >
            {/* Center hub */}
            <div className="absolute w-4 h-4 rounded-full bg-gradient-to-br from-[#3a3a3a] to-[#1a1a1a] border border-[#0a0a0a] z-10" />

            {/* Blades */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <div
                key={angle}
                className="absolute w-1 bg-gradient-to-t from-[#4a4a4a] to-[#2a2a2a]"
                style={{
                  height: '45%',
                  transformOrigin: 'bottom center',
                  transform: `rotate(${angle}deg) translateY(-50%)`,
                  borderRadius: '2px',
                }}
              />
            ))}
          </div>

          {/* Grill overlay */}
          <div className="absolute inset-0 rounded-full"
            style={{
              background: `
                repeating-conic-gradient(
                  from 0deg,
                  transparent 0deg 10deg,
                  rgba(0,0,0,0.3) 10deg 20deg
                )
              `,
            }}
          />
        </div>

        {/* Air flow indicators */}
        {isOn && (
          <div className="absolute inset-0 pointer-events-none">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--neon-cyan)]/20"
                style={{
                  width: `${60 + i * 20}%`,
                  height: `${60 + i * 20}%`,
                  animation: `pulse ${1.5 + i * 0.3}s ease-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                  opacity: 0.3 - i * 0.1,
                }}
              />
            ))}
          </div>
        )}

        {/* RPM display overlay */}
        <div className="absolute bottom-1 left-1 right-1 flex justify-between">
          <span className="font-mono text-[7px] text-[var(--neon-cyan)]/60">{rpm} RPM</span>
          <span className="font-mono text-[7px]" style={{ color: getTempColor() }}>{temp}°C</span>
        </div>
      </div>

      {/* Speed Slider */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[6px] text-white/40">SPEED</span>
          <span className="font-mono text-[8px] text-[var(--neon-cyan)]">{speed}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          disabled={!isOn}
          className="w-full h-2 bg-[#1a1a1a] rounded appearance-none cursor-pointer disabled:opacity-50"
          style={{
            background: `linear-gradient(to right, var(--neon-cyan) 0%, var(--neon-cyan) ${speed}%, #1a1a1a ${speed}%, #1a1a1a 100%)`,
          }}
        />
      </div>

      {/* Mode buttons */}
      <div className="grid grid-cols-4 gap-0.5 mb-2">
        {(['AUTO', 'LOW', 'MED', 'HIGH'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m)
              if (m === 'LOW') setSpeed(25)
              else if (m === 'MED') setSpeed(50)
              else if (m === 'HIGH') setSpeed(100)
              // AUTO keeps current
            }}
            disabled={!isOn}
            className={cn(
              'py-1 rounded font-mono text-[6px] transition-all',
              mode === m
                ? 'bg-[var(--neon-cyan)] text-black font-bold'
                : 'bg-[#1a1a1a] text-white/40 hover:text-white/60 disabled:opacity-50'
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className={cn(
            'w-1.5 h-1.5 rounded-full',
            isOn ? 'bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]' : 'bg-[#3a3a3a]'
          )} />
          <span className="font-mono text-[6px] text-white/40">{isOn ? 'RUNNING' : 'OFF'}</span>
        </div>
        <button
          onClick={() => setIsOn(!isOn)}
          className={cn(
            'px-2 py-0.5 rounded font-mono text-[7px] transition-all',
            isOn
              ? 'bg-[var(--neon-red)]/20 text-[var(--neon-red)] border border-[var(--neon-red)]/30'
              : 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/30'
          )}
        >
          {isOn ? 'STOP' : 'START'}
        </button>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
        }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 10px;
          height: 10px;
          background: var(--neon-cyan);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 6px var(--neon-cyan);
        }
      `}</style>
    </PanelFrame>
  )
}

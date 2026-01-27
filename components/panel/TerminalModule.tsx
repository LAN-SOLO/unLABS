'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Terminal } from '@/components/terminal'

interface TerminalModuleProps {
  userId: string
  username: string | null
  balance: number
  className?: string
}

// Screw component for corners
function Screw({ className }: { className?: string }) {
  return (
    <div className={cn(
      'w-3 h-3 rounded-full bg-gradient-to-br from-[#4a4a4a] to-[#2a2a2a] border border-[#1a1a1a] flex items-center justify-center',
      className
    )}>
      <div className="w-1.5 h-0.5 bg-[#1a1a1a] rotate-45" />
    </div>
  )
}

// Vent holes component
function VentHoles({ count = 8, vertical = false }: { count?: number; vertical?: boolean }) {
  return (
    <div className={cn('flex gap-0.5', vertical ? 'flex-col' : 'flex-row')}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-[#0a0a0a] rounded-sm',
            vertical ? 'w-3 h-0.5' : 'w-0.5 h-3'
          )}
        />
      ))}
    </div>
  )
}

// System status messages for ticker
const STATUS_MESSAGES = [
  '◈ QUANTUM CORE STABLE ◈ FLUX: 98.7%',
  '◈ MEMORY BANKS ONLINE ◈ 64TB AVAILABLE',
  '◈ NEURAL LINK ACTIVE ◈ LATENCY: 0.3ms',
  '◈ POWER GRID NOMINAL ◈ 847MW OUTPUT',
  '◈ COOLING SYSTEM OK ◈ TEMP: 28.4°C',
  '◈ NETWORK SYNC ◈ 2.4 Gbps THROUGHPUT',
  '◈ CRYPTO PROCESSOR ◈ HASH RATE: 142 TH/s',
  '◈ SHIELD GENERATOR ◈ INTEGRITY: 100%',
  '◈ DIMENSIONAL ANCHOR ◈ D-3.14 LOCKED',
  '◈ ANOMALY SCAN ◈ NO THREATS DETECTED',
  '◈ QUANTUM ENTANGLE ◈ PAIR STATUS: SYNC',
  '◈ AI SUBSYSTEM ◈ LEARNING MODE ACTIVE',
  '◈ REACTOR CORE ◈ FUSION STABLE',
  '◈ GRAVITY WELL ◈ 1.0G MAINTAINED',
  '◈ TIME CRYSTAL ◈ OSCILLATION NORMAL',
  '◈ VOID SCANNER ◈ RANGE: 2.4 LY',
  '◈ MATTER COMPILER ◈ QUEUE: 7 ITEMS',
  '◈ TELEPORT PAD ◈ CHARGE: 85%',
  '◈ STEALTH FIELD ◈ SIGNATURE: MINIMAL',
  '◈ COMM ARRAY ◈ 47 CHANNELS OPEN',
]

// Scrolling status ticker component
function StatusTicker() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % STATUS_MESSAGES.length)
        setIsAnimating(false)
      }, 500)
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="w-[280px] h-5 rounded overflow-hidden relative"
      style={{
        background: 'linear-gradient(180deg, #0a0a0a 0%, #0f0f12 50%, #0a0a0a 100%)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), inset 0 -1px 1px rgba(255,255,255,0.03)',
        border: '1px solid #1a1a2a',
      }}
    >
      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(0,255,100,0.03) 1px, rgba(0,255,100,0.03) 2px)',
        }}
      />

      {/* Text container */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <span
          className={cn(
            'font-mono text-[8px] tracking-wide whitespace-nowrap transition-all duration-500',
            isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          )}
          style={{
            color: 'var(--neon-green)',
            textShadow: '0 0 8px var(--neon-green), 0 0 2px var(--neon-green)',
          }}
        >
          {STATUS_MESSAGES[currentIndex]}
        </span>
      </div>

      {/* Edge fade */}
      <div
        className="absolute inset-y-0 left-0 w-4 pointer-events-none"
        style={{ background: 'linear-gradient(to right, #0a0a0a 0%, transparent 100%)' }}
      />
      <div
        className="absolute inset-y-0 right-0 w-4 pointer-events-none"
        style={{ background: 'linear-gradient(to left, #0a0a0a 0%, transparent 100%)' }}
      />
    </div>
  )
}

export function TerminalModule({
  userId,
  username,
  balance,
  className,
}: TerminalModuleProps) {
  const [time, setTime] = useState<string>('--:--:--')
  const [powerLed, setPowerLed] = useState(true)

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Blink power LED slowly
  useEffect(() => {
    const interval = setInterval(() => {
      setPowerLed(prev => !prev)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className={cn('relative', className)}
      style={{
        width: '640px',
        height: '480px',
        minWidth: '640px',
        minHeight: '480px',
        maxWidth: '640px',
        maxHeight: '480px',
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      {/* OUTER BEZEL - Main frame */}
      <div className="absolute inset-0 rounded-lg overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #3a3a3a 0%, #252525 50%, #1a1a1a 100%)',
          boxShadow: `
            inset 2px 2px 4px rgba(255,255,255,0.1),
            inset -2px -2px 4px rgba(0,0,0,0.5),
            0 4px 20px rgba(0,0,0,0.8),
            0 0 40px rgba(0,0,0,0.5)
          `,
        }}
      >
        {/* Top bezel section */}
        <div className="h-8 flex items-center justify-between px-3 border-b border-[#1a1a1a]"
          style={{
            background: 'linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%)',
          }}
        >
          {/* Left: Brand and vents */}
          <div className="flex items-center gap-3">
            <Screw />
            <VentHoles count={6} />
            <div className="flex flex-col">
              <span className="font-mono text-[8px] text-[#8a8a8a] font-bold tracking-wider">UNSTABLE</span>
              <span className="font-mono text-[6px] text-[#5a5a5a]">LABORATORIES</span>
            </div>
          </div>

          {/* Center: Model name */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="bg-[#1a1a1a] px-3 py-0.5 rounded border border-[#0a0a0a]"
              style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)' }}
            >
              <span className="font-mono text-[9px] text-[var(--neon-green)] tracking-widest">_unOS TERMINAL</span>
            </div>
          </div>

          {/* Right: LEDs and vents */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    powerLed ? 'bg-[var(--neon-green)] shadow-[0_0_8px_var(--neon-green)]' : 'bg-[#1a3a1a]'
                  )}
                />
                <span className="font-mono text-[5px] text-[#5a5a5a] mt-0.5">PWR</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber)]" />
                <span className="font-mono text-[5px] text-[#5a5a5a] mt-0.5">HDD</span>
              </div>
            </div>
            <VentHoles count={6} />
            <Screw />
          </div>
        </div>

        {/* Main content area with inner bezel */}
        <div className="absolute top-8 left-3 right-3 bottom-10">
          {/* INNER BEZEL - Screen frame */}
          <div
            className="absolute inset-0 rounded"
            style={{
              background: 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)',
              boxShadow: `
                inset 3px 3px 6px rgba(0,0,0,0.8),
                inset -1px -1px 2px rgba(255,255,255,0.05)
              `,
              padding: '6px',
            }}
          >
            {/* SCREEN GLASS - Curved CRT effect */}
            <div
              className="relative w-full h-full rounded overflow-hidden"
              style={{
                background: '#0a0f0a',
                boxShadow: `
                  inset 0 0 100px rgba(34, 197, 94, 0.03),
                  inset 0 0 30px rgba(0, 0, 0, 0.8)
                `,
              }}
            >
              {/* CRT curvature overlay */}
              <div
                className="pointer-events-none absolute inset-0 z-20"
                style={{
                  background: `
                    radial-gradient(ellipse at center, transparent 0%, transparent 70%, rgba(0,0,0,0.3) 100%)
                  `,
                  borderRadius: '4px',
                }}
              />

              {/* CRT scanlines */}
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background:
                    'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
                }}
              />

              {/* Horizontal scan line animation */}
              <div
                className="pointer-events-none absolute left-0 right-0 h-[2px] z-10 opacity-30"
                style={{
                  background: 'linear-gradient(180deg, transparent, rgba(34,197,94,0.5), transparent)',
                  animation: 'scanline 8s linear infinite',
                }}
              />

              {/* CRT phosphor glow */}
              <div
                className="pointer-events-none absolute inset-0 z-[5]"
                style={{
                  boxShadow: 'inset 0 0 80px rgba(34, 197, 94, 0.06)',
                }}
              />

              {/* Screen reflection */}
              <div
                className="pointer-events-none absolute inset-0 z-20"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, transparent 100%)',
                }}
              />

              {/* Terminal title bar */}
              <div className="relative z-[1] flex items-center justify-between px-2 py-1 border-b border-[var(--neon-green)]/20 bg-[#0a1a0a]/80">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)]/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-amber)]/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)]/60" />
                  </div>
                  <span className="text-[var(--neon-green)]/80 text-[9px] font-mono tracking-wide">
                    _unOS Terminal v1.0
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
                  <span className="text-[7px] font-mono text-[var(--neon-green)]/60">ONLINE</span>
                </div>
              </div>

              {/* Terminal content */}
              <div className="relative z-[1] h-[calc(100%-44px)] overflow-hidden p-2">
                <Terminal userId={userId} username={username} balance={balance} />
              </div>

              {/* Terminal status bar */}
              <div className="relative z-[1] flex items-center justify-between px-2 py-0.5 border-t border-[var(--neon-green)]/20 bg-[#0a1a0a]/80 text-[8px] font-mono">
                <span className="text-[var(--neon-green)]/60">READY</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--neon-green)]/40">MEM: 2.4M</span>
                  <span className="text-[var(--neon-green)]/40">CPU: 12%</span>
                  <span className="text-[var(--neon-green)]/80">{time}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bezel section */}
        <div className="absolute bottom-0 left-0 right-0 h-10 flex items-center justify-between px-3 border-t border-[#3a3a3a]"
          style={{
            background: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)',
          }}
        >
          {/* Left: Screw and model info */}
          <div className="flex items-center gap-3">
            <Screw />
            <div className="flex items-center gap-2">
              <VentHoles count={4} vertical />
              <div className="bg-[#1a1a1a] px-2 py-0.5 rounded border border-[#0a0a0a]">
                <span className="font-mono text-[6px] text-[#4a4a4a]">MODEL: UDT-9000</span>
              </div>
            </div>
          </div>

          {/* Center: Status ticker display */}
          <StatusTicker />

          {/* Right: Controls and screw */}
          <div className="flex items-center gap-3">
            {/* Brightness/Contrast dials (decorative) */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#3a3a3a] to-[#1a1a1a] border border-[#0a0a0a] flex items-center justify-center">
                  <div className="w-0.5 h-1.5 bg-[#5a5a5a] rounded" />
                </div>
                <span className="font-mono text-[4px] text-[#4a4a4a] mt-0.5">BRT</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#3a3a3a] to-[#1a1a1a] border border-[#0a0a0a] flex items-center justify-center">
                  <div className="w-0.5 h-1.5 bg-[#5a5a5a] rounded rotate-45" />
                </div>
                <span className="font-mono text-[4px] text-[#4a4a4a] mt-0.5">CON</span>
              </div>
            </div>
            <VentHoles count={4} vertical />
            <Screw />
          </div>
        </div>

        {/* Corner screws */}
        <Screw className="absolute top-2 left-2" />
        <Screw className="absolute top-2 right-2" />
        <Screw className="absolute bottom-2 left-2" />
        <Screw className="absolute bottom-2 right-2" />
      </div>

      {/* CSS for scanline animation */}
      <style jsx>{`
        @keyframes scanline {
          0% { top: -2px; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Terminal } from '@/components/terminal'
import { ScrewButton } from '@/components/panel/ScrewButton'
import { useScrewButtonManagerOptional } from '@/contexts/ScrewButtonManager'

// CRT color themes
const CRT_THEMES = [
  { name: 'PHOSPHOR',  fg: '#33ff33', glow: '34,197,94',   screen: '#0a0f0a', bar: '#0a1a0a' },
  { name: 'AMBER',     fg: '#ffaa00', glow: '255,170,0',   screen: '#0f0d08', bar: '#1a1508' },
  { name: 'CYAN',      fg: '#00ffff', glow: '0,255,255',   screen: '#080f0f', bar: '#0a1a1a' },
  { name: 'HOT PINK',  fg: '#ff3399', glow: '255,51,153',  screen: '#0f080c', bar: '#1a0a14' },
  { name: 'ICE BLUE',  fg: '#66aaff', glow: '102,170,255', screen: '#080a0f', bar: '#0a0e1a' },
  { name: 'LIME',      fg: '#aaff00', glow: '170,255,0',   screen: '#0c0f08', bar: '#141a0a' },
  { name: 'VIOLET',    fg: '#aa66ff', glow: '170,102,255', screen: '#0c080f', bar: '#140a1a' },
  { name: 'RED',       fg: '#ff3333', glow: '255,51,51',   screen: '#0f0808', bar: '#1a0a0a' },
  { name: 'WHITE',     fg: '#cccccc', glow: '200,200,200', screen: '#0a0a0a', bar: '#111111' },
  { name: 'SOLAR',     fg: '#ff8800', glow: '255,136,0',   screen: '#0f0c08', bar: '#1a140a' },
  // Strange themes
  { name: 'ACID',      fg: '#39ff14', glow: '57,255,20',   screen: '#0d0f04', bar: '#0a0d02' },
  { name: 'BLOODMOON', fg: '#cc0033', glow: '204,0,51',    screen: '#10050a', bar: '#180610' },
  { name: 'VOID',      fg: '#4400aa', glow: '68,0,170',    screen: '#06040c', bar: '#0a0614' },
  { name: 'RUST',      fg: '#b85c2a', glow: '184,92,42',   screen: '#0e0a06', bar: '#16100a' },
  { name: 'PLASMA',    fg: '#ff00ff', glow: '255,0,255',    screen: '#0f040f', bar: '#1a081a' },
  { name: 'TOXIC',     fg: '#ccff00', glow: '204,255,0',    screen: '#0c0e04', bar: '#14180a' },
  { name: 'GHOST',     fg: '#556677', glow: '85,102,119',   screen: '#070808', bar: '#0c0e0e' },
  { name: 'CORAL',     fg: '#ff6f61', glow: '255,111,97',   screen: '#0f0908', bar: '#1a100e' },
  { name: 'MATRIX',    fg: '#003b00', glow: '0,59,0',       screen: '#010400', bar: '#020600' },
  { name: 'GLITCH',    fg: '#fe01b1', glow: '254,1,177',    screen: '#0e020c', bar: '#160416' },
] as const

// Hue rotation from base green (#33ff33 ≈ 120deg) to each theme's fg color
function getHueShift(index: number): number {
  const hueShifts = [
    //green amber cyan  pink  blue  lime  violet red  white solar
    0,     -75,   60,   -180, -150, -30,  -210, -120, 0,   -90,
    //acid  blood void  rust  plasma toxic ghost coral matrix glitch
    -5,    -135,  -240, -100, -180, -45,  -150, -110, 0,    -175,
  ]
  return hueShifts[index] ?? 0
}
function getSaturation(index: number): number {
  const saturations = [
    //green amber cyan pink blue lime violet red white solar
    1,     1.2,  1,   1.2, 0.9, 1.1, 1,    1.2, 0,   1.2,
    //acid  blood void rust plasma toxic ghost coral matrix glitch
    1.4,   1.5,  1.3, 0.7, 1.8,  1.3, 0.3,  0.9, 0.6,  1.6,
  ]
  return saturations[index] ?? 1
}

interface TerminalModuleProps {
  userId: string
  username: string | null
  balance: number
  className?: string
}

// Screw component for corners
function Screw({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-4 h-4 rounded-full flex items-center justify-center relative',
        className
      )}
      style={{
        background: 'radial-gradient(circle at 40% 35%, #a8acb2 0%, #8a8e94 20%, #6e7278 45%, #555960 70%, #484c52 100%)',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.6), 0 0 0 0.5px #33373d',
      }}
    >
      {/* Outer rim / countersink ring */}
      <div className="absolute inset-[1px] rounded-full" style={{
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15), inset 0 0 0 2px rgba(255,255,255,0.06)',
      }} />
      {/* Phillips cross slot */}
      <div className="absolute w-[7px] h-[1.5px] rounded-[0.5px]" style={{
        background: 'linear-gradient(180deg, #2a2e34 0%, #3a3e44 50%, #2a2e34 100%)',
        boxShadow: '0 0.5px 0 rgba(255,255,255,0.08)',
      }} />
      <div className="absolute w-[1.5px] h-[7px] rounded-[0.5px]" style={{
        background: 'linear-gradient(90deg, #2a2e34 0%, #3a3e44 50%, #2a2e34 100%)',
        boxShadow: '0.5px 0 0 rgba(255,255,255,0.08)',
      }} />
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
            'bg-[#2a2e34] rounded-sm',
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
  const screwManager = useScrewButtonManagerOptional()
  const [time, setTime] = useState<string>('--:--:--')
  const [powerLed, setPowerLed] = useState(true)
  const [themeIndex, setThemeIndex] = useState(0)
  const theme = CRT_THEMES[themeIndex]

  const cycleTheme = useCallback(() => {
    setThemeIndex(prev => (prev + 1) % CRT_THEMES.length)
  }, [])

  const resetTheme = useCallback(() => {
    setThemeIndex(0)
  }, [])

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
      {/* OUTER BEZEL - Worn brushed steel frame */}
      <div className="absolute inset-0 rounded-lg overflow-hidden"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent 0px,
              rgba(255,255,255,0.04) 1px,
              transparent 2px,
              rgba(0,0,0,0.03) 3px,
              transparent 4px
            ),
            repeating-linear-gradient(
              120deg,
              transparent 0px,
              transparent 30px,
              rgba(255,255,255,0.02) 31px,
              transparent 32px,
              transparent 55px,
              rgba(0,0,0,0.015) 56px,
              transparent 57px
            ),
            radial-gradient(ellipse at 15% 10%, rgba(255,255,255,0.06) 0%, transparent 40%),
            radial-gradient(ellipse at 85% 90%, rgba(0,0,0,0.08) 0%, transparent 40%),
            linear-gradient(170deg, #686e76 0%, #5c6168 15%, #606670 30%, #585d64 48%, #636870 60%, #5a5f66 75%, #5e636a 90%, #555a62 100%)
          `,
          boxShadow: `
            inset 2px 2px 4px rgba(255,255,255,0.12),
            inset -2px -2px 4px rgba(0,0,0,0.4),
            0 4px 20px rgba(0,0,0,0.8),
            0 0 40px rgba(0,0,0,0.5)
          `,
        }}
      >
        {/* Top bezel section */}
        <div className="h-8 flex items-center justify-between px-3 border-b border-[#484c52]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent 0px, rgba(255,255,255,0.035) 1px, transparent 2px, transparent 4px),
              linear-gradient(180deg, #6a6f76 0%, #5a5f66 100%)
            `,
          }}
        >
          {/* Left: Brand and vents */}
          <div className="flex items-center gap-3">
            {screwManager ? (
              <ScrewButton
                position="top-left"
                featureId="SB-01"
                isUnlocked={screwManager.isUnlocked('SB-01')}
                isActive={screwManager.isActive('SB-01')}
                onActivate={() => screwManager.activate('SB-01')}
                onDeactivate={() => screwManager.deactivate('SB-01')}
              />
            ) : (
              <Screw />
            )}
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
            {screwManager ? (
              <ScrewButton
                position="top-right"
                featureId="SB-02"
                isUnlocked={screwManager.isUnlocked('SB-02')}
                isActive={screwManager.isActive('SB-02')}
                onActivate={() => screwManager.activate('SB-02')}
                onDeactivate={() => screwManager.deactivate('SB-02')}
              />
            ) : (
              <Screw />
            )}
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
              className="relative w-full h-full rounded overflow-hidden transition-colors duration-500"
              style={{
                background: theme.screen,
                boxShadow: `
                  inset 0 0 100px rgba(${theme.glow}, 0.03),
                  inset 0 0 30px rgba(0, 0, 0, 0.8)
                `,
              }}
            >
              {/* CRT curvature overlay */}
              <div
                className="pointer-events-none absolute inset-0 z-20"
                style={{
                  background: `
                    radial-gradient(ellipse at center, transparent 0%, transparent 75%, rgba(0,0,0,0.15) 100%)
                  `,
                  borderRadius: '4px',
                }}
              />

              {/* CRT scanlines */}
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background:
                    'repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 2px)',
                }}
              />

              {/* Horizontal scan line animation */}
              <div
                className="pointer-events-none absolute left-0 right-0 h-[2px] z-10 opacity-15"
                style={{
                  background: `linear-gradient(180deg, transparent, rgba(${theme.glow},0.5), transparent)`,
                  animation: 'scanline 8s linear infinite',
                }}
              />

              {/* CRT phosphor glow */}
              <div
                className="pointer-events-none absolute inset-0 z-[5]"
                style={{
                  boxShadow: `inset 0 0 80px rgba(${theme.glow}, 0.06)`,
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
              <div
                className="relative z-[1] flex items-center justify-between px-2 py-1 transition-colors duration-500"
                style={{ borderBottom: `1px solid ${theme.fg}33`, background: `${theme.bar}cc` }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)]/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-amber)]/60" />
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: `${theme.fg}99` }} />
                  </div>
                  <span className="text-[9px] font-mono tracking-wide transition-colors duration-500" style={{ color: `${theme.fg}cc` }}>
                    _unOS Terminal v2.0
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: theme.fg }} />
                  <span className="text-[7px] font-mono transition-colors duration-500" style={{ color: `${theme.fg}99` }}>ONLINE</span>
                </div>
              </div>

              {/* Terminal content */}
              <div
                className="relative z-[1] h-[calc(100%-44px)] overflow-hidden p-2 transition-colors duration-500 flex flex-col"
                style={{
                  '--tw-text-opacity': '1',
                  color: theme.fg,
                  caretColor: theme.fg,
                } as React.CSSProperties}
              >
                <div className="flex flex-col flex-1 min-h-0" style={{ filter: themeIndex === 0 ? 'none' : `hue-rotate(${getHueShift(themeIndex)}deg) saturate(${getSaturation(themeIndex)})` }}>
                  <Terminal userId={userId} username={username} balance={balance} themeIndex={themeIndex} setThemeIndex={setThemeIndex} themes={CRT_THEMES} />
                </div>
              </div>

              {/* Terminal status bar */}
              <div
                className="relative z-[1] flex items-center justify-between px-2 py-0.5 text-[8px] font-mono transition-colors duration-500"
                style={{ borderTop: `1px solid ${theme.fg}33`, background: `${theme.bar}cc` }}
              >
                <span style={{ color: `${theme.fg}99` }}>READY</span>
                <div className="flex items-center gap-3">
                  <span style={{ color: `${theme.fg}66` }}>MEM: 2.4M</span>
                  <span style={{ color: `${theme.fg}66` }}>CPU: 12%</span>
                  <span style={{ color: `${theme.fg}cc` }}>{time}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bezel section */}
        <div className="absolute bottom-0 left-0 right-0 h-10 flex items-center justify-between px-3 border-t border-[#6a6f76]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent 0px, rgba(255,255,255,0.035) 1px, transparent 2px, transparent 4px),
              linear-gradient(180deg, #5e636a 0%, #525760 100%)
            `,
          }}
        >
          {/* Left: Screw and model info */}
          <div className="flex items-center gap-3">
            {screwManager ? (
              <ScrewButton
                position="bottom-left"
                featureId="SB-03"
                isUnlocked={screwManager.isUnlocked('SB-03')}
                isActive={screwManager.isActive('SB-03')}
                onActivate={() => screwManager.activate('SB-03')}
                onDeactivate={() => screwManager.deactivate('SB-03')}
              />
            ) : (
              <Screw />
            )}
            <div className="flex items-center gap-2">
              <VentHoles count={4} vertical />
              <div className="bg-[#3a3e44] px-2 py-0.5 rounded border border-[#33373d]">
                <span className="font-mono text-[6px] text-[#8a8e94]">MODEL: UDT-9000</span>
              </div>
            </div>
          </div>

          {/* Center: Status ticker display */}
          <StatusTicker />

          {/* Right: Controls and screw */}
          <div className="flex items-center gap-3">
            {/* Theme controls */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <button
                  onClick={cycleTheme}
                  className="w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer hover:brightness-110 active:brightness-90 transition-all"
                  style={{
                    background: `radial-gradient(circle at 38% 35%, #a8acb2 0%, #8a8e94 25%, #6e7278 50%, #555960 100%)`,
                    borderColor: '#33373d',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.5)',
                  }}
                  title={`Theme: ${theme.name}`}
                >
                  <div className="w-1 h-1 rounded-full" style={{ background: theme.fg, boxShadow: `0 0 3px ${theme.fg}` }} />
                </button>
                <span className="font-mono text-[4px] text-[#8a8e94] mt-0.5">CLR</span>
              </div>
              <div className="flex flex-col items-center">
                <button
                  onClick={resetTheme}
                  className="w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer hover:brightness-110 active:brightness-90 transition-all"
                  style={{
                    background: `radial-gradient(circle at 38% 35%, #a8acb2 0%, #8a8e94 25%, #6e7278 50%, #555960 100%)`,
                    borderColor: '#33373d',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.5)',
                  }}
                  title="Reset theme"
                >
                  <div className="w-1.5 h-[1px] bg-[#a0a4aa] rounded-full" />
                </button>
                <span className="font-mono text-[4px] text-[#8a8e94] mt-0.5">RST</span>
              </div>
            </div>
            <VentHoles count={4} vertical />
            {screwManager ? (
              <ScrewButton
                position="bottom-right"
                featureId="SB-04"
                isUnlocked={screwManager.isUnlocked('SB-04')}
                isActive={screwManager.isActive('SB-04')}
                onActivate={() => screwManager.activate('SB-04')}
                onDeactivate={() => screwManager.deactivate('SB-04')}
              />
            ) : (
              <Screw />
            )}
          </div>
        </div>

        {/* Corner screws removed - top and bottom bezels have inline screws */}
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

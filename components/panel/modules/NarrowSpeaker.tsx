'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LED } from '../controls/LED'

interface NarrowSpeakerProps {
  className?: string
}

export function NarrowSpeaker({ className }: NarrowSpeakerProps) {
  const [isOn, setIsOn] = useState(true)
  const [volume, setVolume] = useState(45)
  const [isMuted, setIsMuted] = useState(false)
  const [filters, setFilters] = useState({
    bass: false,
    mid: true,
    high: false,
    noise: false,
  })
  const [audioLevel, setAudioLevel] = useState<number[]>([0, 0, 0, 0, 0])

  // Simulate audio level visualization
  useEffect(() => {
    if (!isOn || isMuted) {
      setAudioLevel([0, 0, 0, 0, 0])
      return
    }

    const interval = setInterval(() => {
      setAudioLevel(
        Array.from({ length: 5 }, () =>
          Math.random() * (volume / 100) * 100
        )
      )
    }, 100)

    return () => clearInterval(interval)
  }, [isOn, isMuted, volume])

  const toggleFilter = (filter: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [filter]: !prev[filter] }))
  }

  const effectiveVolume = isMuted ? 0 : volume

  return (
    <div className={cn(
      'w-10 h-full bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded border border-[#2a2a3a] flex flex-col p-1 gap-1',
      className
    )}>
      {/* Power button */}
      <button
        onClick={() => setIsOn(!isOn)}
        className={cn(
          'w-full aspect-square rounded flex items-center justify-center transition-all',
          isOn
            ? 'bg-[var(--neon-green)]/20 border border-[var(--neon-green)]/50'
            : 'bg-[#1a1a1a] border border-[#2a2a3a]'
        )}
      >
        <div className={cn(
          'w-2 h-2 rounded-full transition-all',
          isOn ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]' : 'bg-[#3a3a3a]'
        )} />
      </button>

      {/* Speaker label */}
      <div className="text-center">
        <span className="font-mono text-[5px] text-white/40 writing-vertical">SPK</span>
      </div>

      {/* Speaker grille */}
      <div className="flex-1 bg-[#0a0a0a] rounded border border-[#1a1a2a] overflow-hidden relative">
        {/* Grille pattern */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at center, #2a2a2a 1px, transparent 1px)
            `,
            backgroundSize: '4px 4px',
          }}
        />

        {/* Audio level bars */}
        <div className="absolute inset-1 flex flex-col justify-end gap-px">
          {audioLevel.map((level, i) => (
            <div
              key={i}
              className="w-full h-1 bg-[#1a1a1a] rounded overflow-hidden"
            >
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${level}%`,
                  background: level > 80
                    ? 'var(--neon-red)'
                    : level > 50
                    ? 'var(--neon-amber)'
                    : 'var(--neon-green)',
                }}
              />
            </div>
          ))}
        </div>

        {/* Speaker cone (decorative) */}
        <div className="absolute inset-2 rounded-full border border-[#2a2a2a]"
          style={{
            background: 'radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%)',
          }}
        >
          <div className="absolute inset-2 rounded-full border border-[#1a1a1a]" />
          <div className="absolute inset-[40%] rounded-full bg-[#2a2a2a]" />
        </div>
      </div>

      {/* Volume slider (vertical) */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-mono text-[5px] text-white/40">VOL</span>
        <div className="relative w-2 h-16 bg-[#0a0a0a] rounded border border-[#1a1a2a]">
          {/* Volume fill */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-b transition-all"
            style={{
              height: `${effectiveVolume}%`,
              background: effectiveVolume > 80
                ? 'var(--neon-red)'
                : effectiveVolume > 50
                ? 'var(--neon-amber)'
                : 'var(--neon-green)',
              boxShadow: `0 0 4px ${effectiveVolume > 80 ? 'var(--neon-red)' : effectiveVolume > 50 ? 'var(--neon-amber)' : 'var(--neon-green)'}`,
            }}
          />
          {/* Clickable area for volume control */}
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            disabled={!isOn}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
            }}
          />
        </div>
        <span className="font-mono text-[6px] text-[var(--neon-green)]">{volume}</span>
      </div>

      {/* Mute button */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        disabled={!isOn}
        className={cn(
          'w-full py-1 rounded font-mono text-[5px] transition-all',
          isMuted
            ? 'bg-[var(--neon-red)]/30 text-[var(--neon-red)] border border-[var(--neon-red)]/50'
            : 'bg-[#1a1a1a] text-white/40 border border-[#2a2a3a] hover:text-white/60'
        )}
      >
        {isMuted ? 'X' : 'M'}
      </button>

      {/* Filter toggles */}
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[4px] text-white/30 text-center">FLT</span>
        {[
          { key: 'bass' as const, label: 'B', color: 'var(--neon-red)' },
          { key: 'mid' as const, label: 'M', color: 'var(--neon-amber)' },
          { key: 'high' as const, label: 'H', color: 'var(--neon-cyan)' },
          { key: 'noise' as const, label: 'N', color: 'var(--neon-purple)' },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => toggleFilter(filter.key)}
            disabled={!isOn}
            className={cn(
              'w-full py-0.5 rounded font-mono text-[5px] transition-all',
              filters[filter.key]
                ? 'font-bold'
                : 'bg-[#1a1a1a] text-white/30 border border-[#2a2a3a]'
            )}
            style={{
              backgroundColor: filters[filter.key] ? `${filter.color}30` : undefined,
              color: filters[filter.key] ? filter.color : undefined,
              borderColor: filters[filter.key] ? `${filter.color}50` : undefined,
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Status indicator */}
      <div className="flex justify-center">
        <LED on={isOn && !isMuted} color={isMuted ? 'red' : 'green'} size="sm" />
      </div>
    </div>
  )
}

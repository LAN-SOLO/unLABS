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
  })
  const [audioLevel, setAudioLevel] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0])

  // Simulate audio level visualization
  useEffect(() => {
    if (!isOn || isMuted) {
      setAudioLevel([0, 0, 0, 0, 0, 0, 0, 0])
      return
    }

    const interval = setInterval(() => {
      setAudioLevel(
        Array.from({ length: 8 }, () =>
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
      'w-12 shrink-0 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded border border-[#2a2a3a] flex flex-col p-1 gap-1',
      className
    )}>
      {/* Header with power LED */}
      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[5px] text-white/40">SPK</span>
        <button onClick={() => setIsOn(!isOn)}>
          <LED on={isOn} color={isOn ? 'green' : 'red'} size="sm" />
        </button>
      </div>

      {/* Speaker grille with level meters */}
      <div className="flex-1 min-h-[60px] bg-[#0a0a0a] rounded border border-[#1a1a2a] overflow-hidden relative">
        {/* Grille pattern */}
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at center, #3a3a3a 1px, transparent 1px)`,
            backgroundSize: '3px 3px',
          }}
        />

        {/* Audio level bars - vertical */}
        <div className="absolute inset-1 flex gap-px justify-center">
          {audioLevel.map((level, i) => (
            <div
              key={i}
              className="w-1 h-full bg-[#1a1a1a] rounded-sm overflow-hidden flex flex-col justify-end"
            >
              <div
                className="w-full transition-all duration-75 rounded-sm"
                style={{
                  height: `${level}%`,
                  background: level > 80
                    ? 'var(--neon-red)'
                    : level > 50
                    ? 'var(--neon-amber)'
                    : 'var(--neon-green)',
                  boxShadow: level > 0 ? `0 0 3px ${level > 80 ? 'var(--neon-red)' : level > 50 ? 'var(--neon-amber)' : 'var(--neon-green)'}` : 'none',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Volume control */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1 w-full">
          <span className="font-mono text-[5px] text-white/30">V</span>
          <div className="relative flex-1 h-1.5 bg-[#0a0a0a] rounded border border-[#1a1a2a]">
            <div
              className="absolute inset-y-0 left-0 rounded transition-all"
              style={{
                width: `${effectiveVolume}%`,
                background: effectiveVolume > 80
                  ? 'var(--neon-red)'
                  : effectiveVolume > 50
                  ? 'var(--neon-amber)'
                  : 'var(--neon-green)',
              }}
            />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              disabled={!isOn}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
        <span className="font-mono text-[6px] text-[var(--neon-green)]">{volume}</span>
      </div>

      {/* Mute button */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        disabled={!isOn}
        className={cn(
          'w-full py-0.5 rounded font-mono text-[5px] transition-all',
          isMuted
            ? 'bg-[var(--neon-red)]/30 text-[var(--neon-red)] border border-[var(--neon-red)]/50'
            : 'bg-[#1a1a1a] text-white/40 border border-[#2a2a3a] hover:text-white/60'
        )}
      >
        {isMuted ? 'MUTE' : 'M'}
      </button>

      {/* Filter toggles - horizontal row */}
      <div className="flex gap-0.5">
        {[
          { key: 'bass' as const, label: 'B', color: 'var(--neon-red)' },
          { key: 'mid' as const, label: 'M', color: 'var(--neon-amber)' },
          { key: 'high' as const, label: 'H', color: 'var(--neon-cyan)' },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => toggleFilter(filter.key)}
            disabled={!isOn}
            className={cn(
              'flex-1 py-0.5 rounded font-mono text-[5px] transition-all',
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
    </div>
  )
}

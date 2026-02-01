'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { LED } from '../controls/LED'
import { useSPKManagerOptional } from '@/contexts/SPKManager'

interface NarrowSpeakerProps {
  className?: string
}

export function NarrowSpeaker({ className }: NarrowSpeakerProps) {
  const spk = useSPKManagerOptional()

  // Local fallback state (when manager not available)
  const [localIsOn, setLocalIsOn] = useState(true)
  const [localVolume, setLocalVolume] = useState(45)
  const [localIsMuted, setLocalIsMuted] = useState(false)
  const [localFilters, setLocalFilters] = useState({ bass: false, mid: true, high: false })

  // Power button hold state for the tiny rocker switch
  const [powerHeld, setPowerHeld] = useState(false)
  const [powerTimer, setPowerTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Use manager state if available, otherwise local
  const isOn = spk ? (spk.deviceState === 'online') : localIsOn
  const isBooting = spk ? (spk.deviceState === 'booting') : false
  const isShuttingDown = spk ? (spk.deviceState === 'shutdown') : false
  const isTesting = spk ? (spk.deviceState === 'testing') : false
  const isRebooting = spk ? (spk.deviceState === 'rebooting') : false
  const volume = spk?.volume ?? localVolume
  const isMuted = spk?.isMuted ?? localIsMuted
  const filters = spk?.filters ?? localFilters
  const audioLevel = spk?.audioLevel ?? [0, 0, 0, 0, 0, 0, 0, 0]
  const statusMessage = spk?.statusMessage ?? ''
  const isPowered = spk?.isPowered ?? localIsOn
  const testResult = spk?.testResult ?? null
  const bootPhase = spk?.bootPhase ?? null
  const shutdownPhase = spk?.shutdownPhase ?? null

  const effectiveVolume = isMuted ? 0 : volume

  // Power rocker switch — hold 600ms to toggle
  const handlePowerDown = useCallback(() => {
    setPowerHeld(true)
    const timer = setTimeout(() => {
      if (spk) {
        if (spk.deviceState === 'online') {
          spk.powerOff()
        } else if (spk.deviceState === 'standby') {
          spk.powerOn()
        }
      } else {
        setLocalIsOn(prev => !prev)
      }
      setPowerHeld(false)
    }, 600)
    setPowerTimer(timer)
  }, [spk])

  const handlePowerUp = useCallback(() => {
    setPowerHeld(false)
    if (powerTimer) {
      clearTimeout(powerTimer)
      setPowerTimer(null)
    }
  }, [powerTimer])

  const handleVolumeChange = useCallback((v: number) => {
    if (spk) {
      spk.setVolume(v)
    } else {
      setLocalVolume(v)
    }
  }, [spk])

  const handleMuteToggle = useCallback(() => {
    if (spk) {
      spk.toggleMute()
    } else {
      setLocalIsMuted(prev => !prev)
    }
  }, [spk])

  const handleFilterToggle = useCallback((filter: 'bass' | 'mid' | 'high') => {
    if (spk) {
      spk.toggleFilter(filter)
    } else {
      setLocalFilters(prev => ({ ...prev, [filter]: !prev[filter] }))
    }
  }, [spk])

  // LED color based on device state
  const getLedColor = (): 'green' | 'amber' | 'red' | 'cyan' => {
    if (isBooting || isRebooting) return 'cyan'
    if (isTesting) return 'amber'
    if (isShuttingDown) return 'red'
    if (isOn) return 'green'
    return 'red'
  }

  const isBusy = isBooting || isShuttingDown || isRebooting || isTesting

  return (
    <div className={cn(
      'w-12 shrink-0 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded border border-[#2a2a3a] flex flex-col p-1 gap-1',
      className
    )}>
      {/* Header with power rocker switch */}
      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[5px] text-white/40">SPK</span>

        {/* Tiny rocker power switch — hold to toggle */}
        <button
          onPointerDown={handlePowerDown}
          onPointerUp={handlePowerUp}
          onPointerLeave={handlePowerUp}
          disabled={isBusy}
          className={cn(
            'relative w-[14px] h-[8px] rounded-[2px] transition-all duration-200 border',
            'focus:outline-none',
            isPowered
              ? 'bg-gradient-to-b from-[#2a3a2a] to-[#1a2a1a] border-[var(--neon-green)]/40'
              : 'bg-gradient-to-b from-[#3a2a2a] to-[#2a1a1a] border-white/20',
            powerHeld && 'scale-95 brightness-125',
            isBusy && 'opacity-50'
          )}
          title={isPowered ? 'Hold to power off' : 'Hold to power on'}
        >
          {/* Rocker indicator nub */}
          <div
            className={cn(
              'absolute top-[1px] w-[5px] h-[4px] rounded-[1px] transition-all duration-300',
              isPowered
                ? 'right-[1px] bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]'
                : 'left-[1px] bg-white/30'
            )}
          />
          {/* Tiny power LED dot */}
          <div
            className={cn(
              'absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full transition-all duration-300',
              isPowered
                ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]'
                : 'bg-white/10'
            )}
          />
        </button>
      </div>

      {/* Status indicator (shows during boot/shutdown/test) */}
      {isBusy && (
        <div className="px-0.5">
          <div className="font-mono text-[4px] text-center truncate" style={{
            color: isBooting || isRebooting ? 'var(--neon-cyan)' : isTesting ? 'var(--neon-amber)' : 'var(--neon-red)',
          }}>
            {bootPhase || shutdownPhase || (isTesting ? 'TEST' : isRebooting ? 'REBT' : '...')}
          </div>
          {/* Tiny progress bar */}
          <div className="h-[2px] bg-[#0a0a0a] rounded overflow-hidden mt-0.5">
            <div
              className="h-full transition-all duration-200"
              style={{
                width: isBooting ? `${((['driver', 'amplifier', 'dac', 'calibrate', 'output', 'ready'].indexOf(bootPhase ?? 'ready') + 1) / 6) * 100}%` :
                       isShuttingDown ? `${((['mute', 'drain', 'driver-off'].indexOf(shutdownPhase ?? 'driver-off') + 1) / 3) * 100}%` :
                       '50%',
                background: isBooting || isRebooting ? 'var(--neon-cyan)' : isTesting ? 'var(--neon-amber)' : 'var(--neon-red)',
              }}
            />
          </div>
        </div>
      )}

      {/* Test result flash */}
      {testResult && (
        <div className={cn(
          'font-mono text-[5px] text-center py-0.5 rounded',
          testResult === 'pass' ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)]' : 'bg-[var(--neon-red)]/20 text-[var(--neon-red)]'
        )}>
          {testResult === 'pass' ? 'PASS' : 'FAIL'}
        </div>
      )}

      {/* Speaker grille with level meters */}
      <div className={cn(
        'flex-1 min-h-[60px] bg-[#0a0a0a] rounded border overflow-hidden relative transition-all duration-500',
        isOn ? 'border-[#1a1a2a]' : 'border-[#1a1a1a]',
        !isPowered && 'opacity-40'
      )}>
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

        {/* Standby overlay */}
        {!isPowered && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[6px] text-white/20">OFF</span>
          </div>
        )}
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
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              disabled={!isOn}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
        <span className={cn(
          'font-mono text-[6px] transition-colors',
          isOn ? 'text-[var(--neon-green)]' : 'text-white/20'
        )}>{volume}</span>
      </div>

      {/* Mute button */}
      <button
        onClick={handleMuteToggle}
        disabled={!isOn}
        className={cn(
          'w-full py-0.5 rounded font-mono text-[5px] transition-all',
          isMuted
            ? 'bg-[var(--neon-red)]/30 text-[var(--neon-red)] border border-[var(--neon-red)]/50'
            : 'bg-[#1a1a1a] text-white/40 border border-[#2a2a3a] hover:text-white/60',
          !isOn && 'opacity-40 pointer-events-none'
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
            onClick={() => handleFilterToggle(filter.key)}
            disabled={!isOn}
            className={cn(
              'flex-1 py-0.5 rounded font-mono text-[5px] transition-all',
              filters[filter.key]
                ? 'font-bold'
                : 'bg-[#1a1a1a] text-white/30 border border-[#2a2a3a]',
              !isOn && 'opacity-40 pointer-events-none'
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

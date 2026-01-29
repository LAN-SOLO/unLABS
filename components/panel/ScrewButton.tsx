'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// TYPES
// ============================================================================

export type ScrewButtonId = 'SB-01' | 'SB-02' | 'SB-03' | 'SB-04'
export type ScrewPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type PressState = 'idle' | 'pressing' | 'activating' | 'active'
export type LedColor = 'off' | 'red' | 'amber' | 'green'

export interface ScrewButtonFeature {
  id: ScrewButtonId
  name: string
  fullName: string
  description: string
  unlockRequirement: string
  activationCost: number
}

export interface ScrewButtonState {
  unlocked: boolean
  unlockedAt: number | null
  active: boolean
  activatedAt: number | null
  totalActiveTime: number
}

export interface ScrewButtonProps {
  position: ScrewPosition
  featureId: ScrewButtonId
  isUnlocked: boolean
  isActive: boolean
  onActivate: () => Promise<boolean>
  onDeactivate: () => Promise<boolean>
  className?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SCREW_FEATURES: Record<ScrewButtonId, ScrewButtonFeature> = {
  'SB-01': {
    id: 'SB-01',
    name: 'NODE-SYNC',
    fullName: 'Network Node Synchronization',
    description: 'Synchronize with the global lab network for collaborative processing',
    unlockRequirement: 'Tech Tier 4 + Omni-Link Network Hub',
    activationCost: 500,
  },
  'SB-02': {
    id: 'SB-02',
    name: 'POOL-LINK',
    fullName: 'Mining Pool Linkage',
    description: 'Connect to collaborative slice mining pools',
    unlockRequirement: 'SB-01 active + Quantum Communicator',
    activationCost: 750,
  },
  'SB-03': {
    id: 'SB-03',
    name: 'MESH-CAST',
    fullName: 'Memetic Mesh Broadcasting',
    description: 'Broadcast and receive memetic buffs across the network',
    unlockRequirement: 'Tech Tier 4 + Memetic Transmitter',
    activationCost: 600,
  },
  'SB-04': {
    id: 'SB-04',
    name: 'QUANTUM-BRIDGE',
    fullName: 'Quantum Dimensional Bridge',
    description: 'Establish persistent quantum link with another lab',
    unlockRequirement: 'Tech Tier 4 + Dimensional Bridge',
    activationCost: 1000,
  },
}

const LONG_PRESS_DURATION = 2000

// ============================================================================
// COMPONENT
// ============================================================================

export function ScrewButton({
  position,
  featureId,
  isUnlocked,
  isActive,
  onActivate,
  onDeactivate,
  className,
}: ScrewButtonProps) {
  const [pressState, setPressState] = useState<PressState>(isActive ? 'active' : 'idle')
  const [pressProgress, setPressProgress] = useState(0)
  const [ledColor, setLedColor] = useState<LedColor>(isActive ? 'green' : 'off')

  const pressStartTime = useRef<number | null>(null)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  // Sync with external state
  useEffect(() => {
    if (isActive) {
      setPressState('active')
      setLedColor('green')
    } else {
      setPressState('idle')
      setLedColor('off')
    }
  }, [isActive])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [])

  const handleLongPressComplete = useCallback(async () => {
    setPressState('activating')
    setLedColor('amber')

    const wasActive = isActiveRef.current
    const success = wasActive
      ? await onDeactivate()
      : await onActivate()

    if (success) {
      setPressState(wasActive ? 'idle' : 'active')
      setLedColor(wasActive ? 'off' : 'green')
    } else {
      setPressState(wasActive ? 'active' : 'idle')
      setLedColor(wasActive ? 'green' : 'off')
    }

    setPressProgress(0)
    pressStartTime.current = null
  }, [onActivate, onDeactivate])

  const handlePressStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()

    if (!isUnlocked) {
      setLedColor('red')
      setTimeout(() => setLedColor(isActiveRef.current ? 'green' : 'off'), 300)
      return
    }

    pressStartTime.current = Date.now()
    setPressState('pressing')
    setLedColor('red')
    setPressProgress(0)

    progressInterval.current = setInterval(() => {
      if (!pressStartTime.current) return

      const elapsed = Date.now() - pressStartTime.current
      const progress = Math.min((elapsed / LONG_PRESS_DURATION) * 100, 100)
      setPressProgress(progress)

      if (progress >= 100) {
        if (progressInterval.current) {
          clearInterval(progressInterval.current)
          progressInterval.current = null
        }
        handleLongPressComplete()
      }
    }, 50)
  }, [isUnlocked, handleLongPressComplete])

  const handlePressEnd = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
      progressInterval.current = null
    }

    if (!pressStartTime.current || !isUnlocked) {
      pressStartTime.current = null
      return
    }

    pressStartTime.current = null
    setPressState(isActiveRef.current ? 'active' : 'idle')
    setLedColor(isActiveRef.current ? 'green' : 'off')
    setPressProgress(0)
  }, [isUnlocked])

  const feature = SCREW_FEATURES[featureId]

  // LED ring color CSS
  const ledBorderColor = ledColor === 'green' ? 'var(--screw-led-green)'
    : ledColor === 'red' ? 'var(--screw-led-red)'
    : ledColor === 'amber' ? 'var(--screw-led-amber)'
    : 'transparent'

  const ledGlowColor = ledColor === 'green' ? 'var(--screw-led-green-glow)'
    : ledColor === 'red' ? 'var(--screw-led-red-glow)'
    : ledColor === 'amber' ? 'var(--screw-led-amber-glow)'
    : 'transparent'

  const animationClass = pressState === 'pressing' ? 'animate-screw-led-charge'
    : pressState === 'activating' ? 'animate-screw-led-transition'
    : pressState === 'active' ? 'animate-screw-led-active'
    : ''

  return (
    <div
      className={cn(
        'w-4 h-4 rounded-full flex items-center justify-center relative',
        isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed',
        className
      )}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      title={isUnlocked
        ? `${feature.name}: ${isActive ? 'Active — hold to deactivate' : 'Hold 2s to activate'}`
        : `Locked: ${feature.unlockRequirement}`
      }
      role="button"
      aria-pressed={isActive}
      aria-label={`${feature.fullName} - ${isActive ? 'Active' : 'Inactive'}`}
      tabIndex={0}
      style={{
        background: 'radial-gradient(circle at 40% 35%, #a8acb2 0%, #8a8e94 20%, #6e7278 45%, #555960 70%, #484c52 100%)',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.6), 0 0 0 0.5px #33373d',
      }}
    >
      {/* LED Ring */}
      <div
        className={cn('absolute inset-[-3px] rounded-full pointer-events-none', animationClass)}
        style={{
          border: `1.5px solid ${ledBorderColor}`,
          boxShadow: ledColor !== 'off' ? `0 0 8px ${ledGlowColor}` : 'none',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      />

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

      {/* Progress ring SVG during long press */}
      {pressState === 'pressing' && (
        <svg
          className="absolute pointer-events-none"
          style={{ inset: '-5px', width: 'calc(100% + 10px)', height: 'calc(100% + 10px)' }}
          viewBox="0 0 36 36"
        >
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="var(--screw-led-red)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${pressProgress} ${100 - pressProgress}`}
            transform="rotate(-90 18 18)"
            style={{ transition: 'stroke-dasharray 0.05s linear' }}
          />
        </svg>
      )}
    </div>
  )
}

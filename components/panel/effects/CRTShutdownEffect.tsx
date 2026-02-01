'use client'

import { useState, useEffect, useRef } from 'react'

interface CRTShutdownEffectProps {
  active: boolean
  onComplete: () => void
  /** Keep black screen after animation completes (for reboot transition) */
  holdBlack?: boolean
  /** 'system' = full screen (fixed), 'os' = container-scoped (absolute) */
  scope?: 'system' | 'os'
}

/**
 * Full-screen CRT power-off animation.
 * Sequence: brightness surge → horizontal collapse → vertical collapse → phosphor fade → black
 */
export function CRTShutdownEffect({ active, onComplete, holdBlack = false, scope = 'system' }: CRTShutdownEffectProps) {
  const [phase, setPhase] = useState<'idle' | 'surge' | 'collapse-h' | 'collapse-v' | 'phosphor' | 'black' | 'hold'>('idle')
  const completedRef = useRef(false)

  useEffect(() => {
    if (!active) {
      // If holdBlack is true, keep showing black (reboot transition)
      if (holdBlack) {
        setPhase(prev => prev === 'idle' ? 'idle' : 'hold')
        return
      }
      // Otherwise go idle if animation hasn't completed naturally
      if (!completedRef.current) {
        setPhase('idle')
      }
      return
    }

    completedRef.current = false
    setPhase('surge')

    const t1 = setTimeout(() => setPhase('collapse-h'), 100)
    const t2 = setTimeout(() => setPhase('collapse-v'), 400)
    const t3 = setTimeout(() => setPhase('phosphor'), 600)
    const t4 = setTimeout(() => setPhase('black'), 1000)
    const t5 = setTimeout(() => {
      completedRef.current = true
      if (holdBlack) {
        setPhase('hold')
      }
      onComplete()
    }, 1200)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
    }
  }, [active, onComplete, holdBlack])

  // When holdBlack changes to false after completion, dismiss
  useEffect(() => {
    if (!holdBlack && phase === 'hold') {
      setPhase('idle')
      completedRef.current = false
    }
  }, [holdBlack, phase])

  if (phase === 'idle') return null

  return (
    <div
      className={`${scope === 'os' ? 'absolute' : 'fixed'} inset-0 ${scope === 'os' ? 'z-50' : 'z-[9999]'} pointer-events-auto`}
      style={{ perspective: '600px' }}
    >
      {/* Black backdrop */}
      <div
        className="absolute inset-0 bg-black transition-opacity"
        style={{
          opacity: phase === 'surge' ? 0 : 1,
          transitionDuration: phase === 'surge' ? '0ms' : '200ms',
        }}
      />

      {/* Brightness surge overlay */}
      {phase === 'surge' && (
        <div
          className="absolute inset-0"
          style={{
            background: 'white',
            opacity: 0.3,
            animation: 'crt-surge 100ms ease-out forwards',
          }}
        />
      )}

      {/* Collapsing screen content */}
      {(phase === 'collapse-h' || phase === 'collapse-v') && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            style={{
              width: phase === 'collapse-v' ? '4px' : '100%',
              height: '2px',
              background: 'rgba(255, 255, 255, 0.8)',
              boxShadow: '0 0 20px rgba(0, 255, 100, 0.6), 0 0 40px rgba(0, 255, 100, 0.3)',
              transition: 'width 200ms cubic-bezier(0.2, 0, 0.8, 1)',
            }}
          />
        </div>
      )}

      {/* Phosphor dot */}
      {phase === 'phosphor' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'white',
              boxShadow: '0 0 8px 4px rgba(255, 255, 255, 0.6), 0 0 20px 8px rgba(0, 255, 100, 0.4), 0 0 40px 16px rgba(0, 255, 100, 0.2)',
              animation: 'crt-phosphor-fade 400ms ease-out forwards',
            }}
          />
        </div>
      )}

      {/* Final black / hold */}
      {(phase === 'black' || phase === 'hold') && (
        <div className="absolute inset-0 bg-black" />
      )}
    </div>
  )
}

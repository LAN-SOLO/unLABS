'use client'

import { useState, useEffect, useRef } from 'react'

interface BootSequenceProps {
  active: boolean
  onComplete: () => void
  /** 'system' = full screen (fixed), 'os' = container-scoped (absolute) */
  scope?: 'system' | 'os'
}

const BOOT_LINES = [
  { text: '', delay: 200 },
  { text: '_unOS v4.2.1 (quantum-core 5.15.0)', delay: 300 },
  { text: 'Copyright (c) UnstableLabs Research Division', delay: 200 },
  { text: '', delay: 150 },
  { text: '[  OK  ] Starting quantum kernel...', delay: 350 },
  { text: '[  OK  ] Mounting /dev/crystal_cache', delay: 280 },
  { text: '[  OK  ] Loading equipment drivers', delay: 320 },
  { text: '[  OK  ] Starting network subsystem', delay: 250 },
  { text: '[  OK  ] Calibrating oscilloscope array', delay: 300 },
  { text: '[  OK  ] Initializing power management', delay: 270 },
  { text: '[  OK  ] Starting thermal controller', delay: 230 },
  { text: '[  OK  ] Starting panel interface', delay: 350 },
  { text: '', delay: 200 },
  { text: 'System ready. Welcome back, operator.', delay: 400 },
  { text: '', delay: 300 },
]

export function BootSequence({ active, onComplete, scope = 'system' }: BootSequenceProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([])
  const [fading, setFading] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (!active) {
      setVisibleLines([])
      setFading(false)
      return
    }

    setVisibleLines([])
    setFading(false)

    let cumulativeDelay = 500 // initial pause before boot text
    const timeouts: ReturnType<typeof setTimeout>[] = []

    BOOT_LINES.forEach((line, i) => {
      cumulativeDelay += line.delay
      const t = setTimeout(() => {
        setVisibleLines(prev => [...prev, line.text])
      }, cumulativeDelay)
      timeouts.push(t)
    })

    // Start fade after all lines
    cumulativeDelay += 600
    const fadeT = setTimeout(() => setFading(true), cumulativeDelay)
    timeouts.push(fadeT)

    // Complete after fade
    cumulativeDelay += 500
    const doneT = setTimeout(() => onComplete(), cumulativeDelay)
    timeouts.push(doneT)

    timeoutsRef.current = timeouts

    return () => {
      timeouts.forEach(t => clearTimeout(t))
    }
  }, [active, onComplete])

  if (!active && visibleLines.length === 0) return null

  return (
    <div
      className={`${scope === 'os' ? 'absolute' : 'fixed'} inset-0 z-[9999] bg-black flex items-start justify-center overflow-hidden`}
      style={{
        opacity: fading ? 0 : 1,
        transition: 'opacity 500ms ease-out',
      }}
    >
      <div className="w-full max-w-2xl p-8 pt-16 font-mono text-sm">
        {visibleLines.map((line, i) => (
          <div
            key={i}
            className="leading-6"
            style={{
              color: line.startsWith('[  OK  ]')
                ? 'var(--neon-green, #00ff66)'
                : line.startsWith('_unOS') || line.startsWith('Copyright')
                  ? 'var(--neon-amber, #ffb800)'
                  : line.startsWith('System ready')
                    ? 'var(--neon-cyan, #00e5ff)'
                    : 'rgba(0, 255, 100, 0.7)',
              textShadow: line.startsWith('[  OK  ]')
                ? '0 0 6px rgba(0, 255, 100, 0.4)'
                : 'none',
            }}
          >
            {line || '\u00A0'}
          </div>
        ))}
        {/* Blinking cursor */}
        {!fading && visibleLines.length > 0 && (
          <span
            className="inline-block w-2 h-4 mt-1"
            style={{
              backgroundColor: 'var(--neon-green, #00ff66)',
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
      </div>
    </div>
  )
}

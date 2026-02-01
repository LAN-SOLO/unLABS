'use client'

import { useState, useRef, useCallback } from 'react'
import { useSystemPower } from '@/contexts/SystemPowerManager'
import { formatCountdown } from '@/lib/power/timeParser'
import { PowerMenu } from './PowerMenu'

export function PowerButton() {
  const { systemState, countdownSeconds, shutdownNow } = useSystemPower()
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStartRef = useRef<number>(0)

  const handlePointerDown = useCallback(() => {
    pressStartRef.current = Date.now()
    longPressRef.current = setTimeout(() => {
      // Long press (2s) = force shutdown
      shutdownNow()
    }, 2000)
  }, [shutdownNow])

  const handlePointerUp = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
    // Short click = open menu (only if held < 500ms)
    const elapsed = Date.now() - pressStartRef.current
    if (elapsed < 500 && systemState !== 'shutting-down' && systemState !== 'rebooting' && systemState !== 'booting') {
      setMenuOpen(true)
    }
  }, [systemState])

  const handlePointerLeave = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }, [])

  // LED colors per state
  const getLedColor = () => {
    switch (systemState) {
      case 'running': return 'var(--neon-green, #00ff66)'
      case 'countdown': return 'var(--neon-amber, #ffb800)'
      case 'shutting-down':
      case 'rebooting': return 'var(--neon-red, #ff3333)'
      case 'booting': return 'var(--neon-cyan, #00e5ff)'
      case 'off': return 'rgba(255, 255, 255, 0.15)'
    }
  }

  const getAnimation = () => {
    switch (systemState) {
      case 'countdown': return 'power-pulse 1.5s ease-in-out infinite'
      case 'shutting-down':
      case 'rebooting': return 'power-pulse 0.4s ease-in-out infinite'
      case 'booting': return 'power-pulse 2s ease-in-out infinite'
      default: return 'none'
    }
  }

  const ledColor = getLedColor()
  const isDisabled = systemState === 'shutting-down' || systemState === 'rebooting' || systemState === 'booting'

  return (
    <>
      <div className="relative flex items-center gap-1.5">
        {/* Countdown label */}
        {systemState === 'countdown' && countdownSeconds !== null && (
          <span
            className="font-mono text-[9px] tabular-nums"
            style={{ color: 'var(--neon-amber, #ffb800)' }}
          >
            {formatCountdown(countdownSeconds)}
          </span>
        )}

        {/* Power button */}
        <button
          className="relative flex items-center justify-center select-none"
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--panel-surface-light, #1a1a2e)',
            border: `1.5px solid ${ledColor}`,
            boxShadow: systemState !== 'off' ? `0 0 6px ${ledColor}40, inset 0 0 4px ${ledColor}20` : 'none',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            animation: getAnimation(),
            transition: 'border-color 300ms, box-shadow 300ms',
          }}
          onPointerDown={isDisabled ? undefined : handlePointerDown}
          onPointerUp={isDisabled ? undefined : handlePointerUp}
          onPointerLeave={handlePointerLeave}
          aria-label="Power menu"
          title={systemState === 'countdown' && countdownSeconds !== null
            ? `${formatCountdown(countdownSeconds)} until action`
            : 'Power options (hold 2s for force shutdown)'}
        >
          {/* Power icon (⏻ simplified as circle+line) */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M6 1.5V5.5"
              stroke={ledColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M3.5 3C2.3 3.9 1.5 5.3 1.5 6.8C1.5 9.3 3.5 11 6 11C8.5 11 10.5 9.3 10.5 6.8C10.5 5.3 9.7 3.9 8.5 3"
              stroke={ledColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Power menu overlay */}
      {menuOpen && (
        <PowerMenu onClose={() => setMenuOpen(false)} />
      )}
    </>
  )
}

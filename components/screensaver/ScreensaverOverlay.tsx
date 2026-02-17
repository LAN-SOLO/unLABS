'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ScreensaverCanvas } from './ScreensaverCanvas'
import { loadScreensaverConfig } from './types'
import type { ScreensaverPattern } from './types'

interface ScreensaverOverlayProps {
  onDismiss: () => void
  overridePattern?: ScreensaverPattern
}

export function ScreensaverOverlay({ onDismiss, overridePattern }: ScreensaverOverlayProps) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [showHint, setShowHint] = useState(true)
  const mouseStartRef = useRef<{ x: number; y: number } | null>(null)
  const config = useRef(loadScreensaverConfig()).current

  const pattern = overridePattern ?? config.activePattern
  const params = config.patterns[pattern]
  const color = config.colorSource === 'custom' ? config.customColor : 'var(--neon-amber, #00FF41)'

  // Resolve CSS variable to actual color
  const [resolvedColor, setResolvedColor] = useState(config.customColor)
  useEffect(() => {
    if (config.colorSource === 'theme') {
      const el = document.documentElement
      const computed = getComputedStyle(el).getPropertyValue('--neon-amber').trim()
      setResolvedColor(computed || '#00FF41')
    } else {
      setResolvedColor(config.customColor)
    }
  }, [config.colorSource, config.customColor])

  // Resize listener
  useEffect(() => {
    const handleResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fade out hint after 3s
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  // Dismiss on keydown
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault()
      onDismiss()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onDismiss])

  // Dismiss on click
  const handleClick = useCallback(() => onDismiss(), [onDismiss])

  // Dismiss on mouse move > 10px
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseStartRef.current) {
      mouseStartRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    const dx = e.clientX - mouseStartRef.current.x
    const dy = e.clientY - mouseStartRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      onDismiss()
    }
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 9999, cursor: 'none', backgroundColor: '#000' }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    >
      <ScreensaverCanvas
        pattern={pattern}
        params={params}
        color={resolvedColor}
        brightness={config.globalBrightness}
        width={size.w}
        height={size.h}
        crtOverlay={config.crtOverlay}
      />
      {showHint && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-sm transition-opacity duration-1000"
          style={{
            color: 'rgba(255,255,255,0.4)',
            opacity: showHint ? 1 : 0,
            pointerEvents: 'none',
          }}
        >
          Press any key to exit
        </div>
      )}
    </div>
  )
}

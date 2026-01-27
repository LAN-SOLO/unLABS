'use client'

import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

interface KnobProps {
  value?: number
  min?: number
  max?: number
  onChange?: (value: number) => void
  label?: string
  size?: 'sm' | 'md' | 'lg'
  accentColor?: string
  showValue?: boolean
  unit?: string
  className?: string
  disabled?: boolean
}

export function Knob({
  value = 50,
  min = 0,
  max = 100,
  onChange,
  label,
  size = 'md',
  accentColor = 'var(--neon-amber)',
  showValue = false,
  unit = '',
  className,
  disabled = false,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false)
  const knobRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startValueRef = useRef(value)

  const sizePx = {
    sm: 40,
    md: 56,
    lg: 80,
  }

  const indicatorSizes = {
    sm: { width: 2, height: 10, top: 5 },
    md: { width: 3, height: 14, top: 6 },
    lg: { width: 4, height: 18, top: 8 },
  }

  // Convert value to rotation (-135 to 135 degrees)
  const rotation = ((value - min) / (max - min)) * 270 - 135

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      setIsDragging(true)
      startYRef.current = e.clientY
      startValueRef.current = value

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startYRef.current - moveEvent.clientY
        const range = max - min
        const sensitivity = range / 100
        const newValue = Math.max(
          min,
          Math.min(max, startValueRef.current + delta * sensitivity)
        )
        onChange?.(Math.round(newValue))
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [value, min, max, onChange, disabled]
  )

  const knobSize = sizePx[size]
  const indicator = indicatorSizes[size]

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {label && (
        <span
          className="font-mono text-[9px] uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          {label}
        </span>
      )}
      {/* Container for knob + shadow */}
      <div
        className="relative"
        style={{
          width: knobSize,
          height: knobSize + 6,
        }}
      >
        {/* Shadow element - BELOW the knob (light from above) */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: knobSize - 4,
            height: knobSize - 4,
            left: 2,
            top: 6, // Shadow is offset DOWN
            background: 'rgba(0, 0, 0, 0.4)',
            filter: 'blur(4px)',
          }}
        />
        {/* Knob body */}
        <div
          ref={knobRef}
          className={cn(
            'absolute select-none cursor-grab rounded-full',
            isDragging && 'cursor-grabbing',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          style={{
            width: knobSize,
            height: knobSize,
            top: 0,
            left: 0,
            transform: `rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            // Light from above: top is lighter, bottom is darker
            background: `
              radial-gradient(ellipse 80% 40% at 50% 15%, rgba(255,255,255,0.2) 0%, transparent 50%),
              linear-gradient(180deg, #5a5a5a 0%, #3a3a3a 40%, #1a1a1a 100%)
            `,
            border: '2px solid #0a0a0a',
            // Inner shadows for 3D depth
            boxShadow: `
              inset 0 3px 6px rgba(255, 255, 255, 0.15),
              inset 0 -3px 6px rgba(0, 0, 0, 0.4)
            `,
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Indicator line */}
          <div
            className="absolute left-1/2 rounded-full"
            style={{
              width: indicator.width,
              height: indicator.height,
              top: indicator.top,
              transform: 'translateX(-50%)',
              backgroundColor: accentColor,
              boxShadow: `0 0 6px ${accentColor}`,
            }}
          />
        </div>
      </div>
      {showValue && (
        <span
          className="font-mono text-[10px]"
          style={{ color: accentColor }}
        >
          {value}
          {unit}
        </span>
      )}
    </div>
  )
}

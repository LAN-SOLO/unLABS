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

  const sizeStyles = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  }

  const indicatorSizes = {
    sm: 'w-0.5 h-2 top-1',
    md: 'w-0.5 h-3 top-2',
    lg: 'w-1 h-4 top-2',
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
      <div
        ref={knobRef}
        className={cn(
          'knob relative select-none',
          sizeStyles[size],
          isDragging && 'scale-105',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'hover:brightness-110'
        )}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Indicator line */}
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 rounded-full',
            indicatorSizes[size]
          )}
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 0 6px ${accentColor}`,
          }}
        />
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

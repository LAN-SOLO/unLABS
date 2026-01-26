'use client'

import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

interface SliderProps {
  value?: number
  min?: number
  max?: number
  onChange?: (value: number) => void
  label?: string
  orientation?: 'vertical' | 'horizontal'
  height?: number
  width?: number
  accentColor?: string
  showValue?: boolean
  className?: string
  disabled?: boolean
}

export function Slider({
  value = 50,
  min = 0,
  max = 100,
  onChange,
  label,
  orientation = 'vertical',
  height = 80,
  width = 12,
  accentColor = 'var(--neon-cyan)',
  showValue = false,
  className,
  disabled = false,
}: SliderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const fillPercent = ((value - min) / (max - min)) * 100

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || !trackRef.current) return
      e.preventDefault()
      setIsDragging(true)

      const updateValue = (clientY: number) => {
        const rect = trackRef.current!.getBoundingClientRect()
        let percent: number

        if (orientation === 'vertical') {
          percent = 1 - (clientY - rect.top) / rect.height
        } else {
          percent = (clientY - rect.left) / rect.width
        }

        percent = Math.max(0, Math.min(1, percent))
        const newValue = min + percent * (max - min)
        onChange?.(Math.round(newValue))
      }

      updateValue(orientation === 'vertical' ? e.clientY : e.clientX)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateValue(
          orientation === 'vertical' ? moveEvent.clientY : moveEvent.clientX
        )
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [value, min, max, onChange, orientation, disabled]
  )

  const isVertical = orientation === 'vertical'

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        isVertical ? 'flex-col' : 'flex-row',
        className
      )}
    >
      {label && (
        <span
          className="font-mono text-[9px] uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          {label}
        </span>
      )}
      <div
        ref={trackRef}
        className={cn(
          'relative bg-[#111] rounded border border-[#333]',
          'shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer'
        )}
        style={{
          width: isVertical ? width : height,
          height: isVertical ? height : width,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Fill */}
        <div
          className="absolute rounded transition-all"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 0 8px ${accentColor}`,
            ...(isVertical
              ? {
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${fillPercent}%`,
                }
              : {
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${fillPercent}%`,
                }),
            transition: isDragging ? 'none' : 'all 0.1s ease-out',
          }}
        />
        {/* Handle */}
        <div
          className={cn(
            'absolute bg-gradient-to-b from-[#5a5a5a] to-[#3a3a3a]',
            'border border-[#555] rounded-sm',
            'shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]',
            isDragging && 'brightness-125'
          )}
          style={{
            ...(isVertical
              ? {
                  width: width + 8,
                  height: 8,
                  left: -4,
                  bottom: `calc(${fillPercent}% - 4px)`,
                }
              : {
                  width: 8,
                  height: width + 8,
                  top: -4,
                  left: `calc(${fillPercent}% - 4px)`,
                }),
            transition: isDragging ? 'none' : 'all 0.1s ease-out',
          }}
        />
      </div>
      {showValue && (
        <span
          className="font-mono text-[10px]"
          style={{ color: accentColor }}
        >
          {value}
        </span>
      )}
    </div>
  )
}

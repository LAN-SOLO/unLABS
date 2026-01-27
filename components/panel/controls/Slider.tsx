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
      {/* Track container with shadow */}
      <div
        className="relative"
        style={{
          width: isVertical ? width + 4 : height,
          height: isVertical ? height : width + 4,
        }}
      >
        {/* Shadow below track (light from above) */}
        <div
          className="absolute rounded pointer-events-none"
          style={{
            width: isVertical ? width - 2 : height - 4,
            height: isVertical ? height - 4 : width - 2,
            left: isVertical ? 3 : 2,
            top: isVertical ? 4 : 3,
            background: 'rgba(0, 0, 0, 0.3)',
            filter: 'blur(3px)',
          }}
        />
        {/* Track */}
        <div
          ref={trackRef}
          className={cn(
            'absolute rounded',
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && 'cursor-pointer'
          )}
          style={{
            width: isVertical ? width : height,
            height: isVertical ? height : width,
            left: 0,
            top: 0,
            background: `
              linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(255,255,255,0.03) 100%),
              #111
            `,
            border: '1px solid #333',
            boxShadow: `
              inset 0 2px 4px rgba(0, 0, 0, 0.5),
              inset 0 -1px 2px rgba(255, 255, 255, 0.05)
            `,
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Fill */}
          <div
            className="absolute rounded transition-all"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 8px ${accentColor}, inset 0 1px 2px rgba(255,255,255,0.2)`,
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
          {/* Handle with top lighting */}
          <div
            className="absolute"
            style={{
              ...(isVertical
                ? {
                    width: width + 8,
                    height: 10,
                    left: -4,
                    bottom: `calc(${fillPercent}% - 5px)`,
                  }
                : {
                    width: 10,
                    height: width + 8,
                    top: -4,
                    left: `calc(${fillPercent}% - 5px)`,
                  }),
              // 3D handle with light from above
              background: `
                linear-gradient(175deg, #666 0%, #444 30%, #2a2a2a 100%)
              `,
              border: '1px solid #222',
              borderRadius: 2,
              boxShadow: `
                inset 0 1px 2px rgba(255, 255, 255, 0.25),
                inset 0 -1px 2px rgba(0, 0, 0, 0.3),
                0 2px 4px rgba(0, 0, 0, 0.4)
              `,
              transition: isDragging ? 'none' : 'all 0.1s ease-out',
            }}
          >
            {/* Handle grip lines */}
            <div
              className="absolute inset-x-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5"
              style={{ opacity: 0.4 }}
            >
              <div className="h-px bg-white/30" />
              <div className="h-px bg-black/30" />
              <div className="h-px bg-white/30" />
            </div>
          </div>
        </div>
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

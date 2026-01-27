'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface KnurledWheelProps {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  label?: string
  showValue?: boolean
  vertical?: boolean
  size?: 'sm' | 'md'
}

export function KnurledWheel({
  value,
  min = 0,
  max = 100,
  onChange,
  disabled = false,
  className,
  label,
  showValue = true,
  vertical = true,
  size = 'md',
}: KnurledWheelProps) {
  const [isDragging, setIsDragging] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const startValue = useRef(value)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    setIsDragging(true)
    startY.current = e.clientY
    startValue.current = value
    e.preventDefault()
  }, [disabled, value])

  // Attach global mouse events when dragging
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY.current - e.clientY
      const sensitivity = (max - min) / 80
      const newValue = Math.min(max, Math.max(min, startValue.current + deltaY * sensitivity))
      onChange(Math.round(newValue))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, min, max, onChange])

  // Calculate knurl rotation based on value
  const rotation = ((value - min) / (max - min)) * 360 * 2

  const wheelHeight = size === 'sm' ? 'h-12' : 'h-16'
  const wheelWidth = size === 'sm' ? 'w-3' : 'w-4'
  const knurlCount = size === 'sm' ? 16 : 20

  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      {label && (
        <span className="font-mono text-[5px] text-white/40 uppercase">{label}</span>
      )}

      {/* Wheel container */}
      <div
        ref={wheelRef}
        onMouseDown={handleMouseDown}
        className={cn(
          'relative rounded-sm cursor-ns-resize select-none overflow-hidden',
          wheelWidth,
          wheelHeight,
          disabled && 'opacity-50 cursor-not-allowed',
          isDragging && 'ring-1 ring-[var(--neon-cyan)]/50'
        )}
        style={{
          background: 'linear-gradient(90deg, #1a1a2a 0%, #2a2a3a 20%, #3a3a4a 50%, #2a2a3a 80%, #1a1a2a 100%)',
          boxShadow: 'inset 0 0 4px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        {/* Knurl pattern - vertical ridges that move */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 1px,
              rgba(0,0,0,0.4) 1px,
              rgba(0,0,0,0.4) 2px,
              transparent 2px,
              transparent 3px,
              rgba(255,255,255,0.1) 3px,
              rgba(255,255,255,0.1) 4px
            )`,
            backgroundSize: '100% 4px',
            backgroundPositionY: `${rotation % 100}px`,
            transition: isDragging ? 'none' : 'background-position 0.1s ease-out',
          }}
        />

        {/* Center highlight */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.1) 60%, transparent 100%)',
          }}
        />

        {/* Top/bottom shadows for 3D effect */}
        <div
          className="absolute inset-x-0 top-0 h-2 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-2 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
          }}
        />

        {/* Position indicator line */}
        <div
          className="absolute left-0 right-0 h-px pointer-events-none"
          style={{
            top: `${100 - ((value - min) / (max - min)) * 100}%`,
            background: 'var(--neon-cyan)',
            boxShadow: '0 0 4px var(--neon-cyan)',
            opacity: 0.8,
          }}
        />

        {/* Hidden input for accessibility */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="sr-only"
          aria-label={label}
        />
      </div>

      {showValue && (
        <span
          className="font-mono text-[7px] tabular-nums"
          style={{
            color: 'var(--neon-cyan)',
            textShadow: '0 0 4px var(--neon-cyan)',
          }}
        >
          {value}
        </span>
      )}
    </div>
  )
}

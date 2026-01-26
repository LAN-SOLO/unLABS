'use client'

import { cn } from '@/lib/utils'

interface LEDProps {
  on?: boolean
  color?: 'red' | 'green' | 'amber' | 'cyan' | 'blue'
  size?: 'sm' | 'md' | 'lg'
  blink?: boolean
  label?: string
  className?: string
}

export function LED({
  on = false,
  color = 'green',
  size = 'md',
  blink = false,
  label,
  className,
}: LEDProps) {
  const sizeStyles = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  const colorValues = {
    red: '#ff3333',
    green: '#00ff66',
    amber: '#ffb800',
    cyan: '#00ffff',
    blue: '#0066ff',
  }

  const ledColor = colorValues[color]

  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      <div
        className={cn(
          'rounded-full border border-[rgba(0,0,0,0.5)]',
          sizeStyles[size],
          blink && on && 'animate-pulse'
        )}
        style={{
          backgroundColor: on ? ledColor : '#333',
          boxShadow: on
            ? `inset 0 1px 2px rgba(255,255,255,0.3), 0 0 8px ${ledColor}, 0 0 16px ${ledColor}`
            : 'inset 0 1px 2px rgba(0,0,0,0.5)',
        }}
      />
      {label && (
        <span className="font-mono text-[7px] uppercase tracking-wide text-gray-500">
          {label}
        </span>
      )}
    </div>
  )
}

interface LEDBarProps {
  value: number
  max?: number
  segments?: number
  colorStops?: { threshold: number; color: 'green' | 'amber' | 'red' }[]
  className?: string
}

export function LEDBar({
  value,
  max = 100,
  segments = 8,
  colorStops = [
    { threshold: 0.6, color: 'green' },
    { threshold: 0.8, color: 'amber' },
    { threshold: 1, color: 'red' },
  ],
  className,
}: LEDBarProps) {
  const percent = value / max
  const activeSegments = Math.ceil(percent * segments)

  const getSegmentColor = (index: number) => {
    const segmentPercent = (index + 1) / segments
    for (const stop of colorStops) {
      if (segmentPercent <= stop.threshold) {
        return stop.color
      }
    }
    return 'green'
  }

  return (
    <div className={cn('flex flex-col-reverse gap-0.5', className)}>
      {Array.from({ length: segments }).map((_, i) => (
        <LED
          key={i}
          on={i < activeSegments}
          color={getSegmentColor(i)}
          size="sm"
        />
      ))}
    </div>
  )
}

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
  const sizePx = {
    sm: 8,
    md: 12,
    lg: 16,
  }

  const colorValues = {
    red: { on: '#ff3333', off: '#4a2222', glow: 'rgba(255, 51, 51, 0.8)' },
    green: { on: '#00ff66', off: '#224a33', glow: 'rgba(0, 255, 102, 0.8)' },
    amber: { on: '#ffb800', off: '#4a3a22', glow: 'rgba(255, 184, 0, 0.8)' },
    cyan: { on: '#00ffff', off: '#224a4a', glow: 'rgba(0, 255, 255, 0.8)' },
    blue: { on: '#0066ff', off: '#22334a', glow: 'rgba(0, 102, 255, 0.8)' },
  }

  const colorConfig = colorValues[color]
  const ledSize = sizePx[size]

  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      {/* LED container with shadow */}
      <div
        className="relative"
        style={{
          width: ledSize,
          height: ledSize + 2,
        }}
      >
        {/* Shadow below (light from above) */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: ledSize - 2,
            height: ledSize - 2,
            left: 1,
            top: 3,
            background: on ? colorConfig.glow : 'rgba(0, 0, 0, 0.3)',
            filter: on ? 'blur(3px)' : 'blur(2px)',
            opacity: on ? 0.6 : 0.4,
          }}
        />
        {/* LED body */}
        <div
          className={cn(
            'absolute rounded-full',
            blink && on && 'animate-pulse'
          )}
          style={{
            width: ledSize,
            height: ledSize,
            top: 0,
            left: 0,
            // Dome effect with light from above
            background: on
              ? `
                  radial-gradient(ellipse 70% 50% at 50% 30%, rgba(255,255,255,0.5) 0%, transparent 60%),
                  radial-gradient(circle at 40% 40%, ${colorConfig.on} 0%, transparent 60%),
                  ${colorConfig.on}
                `
              : `
                  radial-gradient(ellipse 60% 40% at 50% 35%, rgba(255,255,255,0.1) 0%, transparent 50%),
                  ${colorConfig.off}
                `,
            border: '1px solid rgba(0, 0, 0, 0.5)',
            boxShadow: on
              ? `
                  inset 0 1px 2px rgba(255, 255, 255, 0.4),
                  inset 0 -1px 2px rgba(0, 0, 0, 0.3),
                  0 0 ${ledSize}px ${colorConfig.glow},
                  0 0 ${ledSize * 2}px ${colorConfig.glow}
                `
              : `
                  inset 0 1px 1px rgba(255, 255, 255, 0.1),
                  inset 0 -1px 2px rgba(0, 0, 0, 0.4)
                `,
          }}
        />
      </div>
      {label && (
        <span className="font-mono text-[7px] uppercase tracking-wide text-white/40">
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

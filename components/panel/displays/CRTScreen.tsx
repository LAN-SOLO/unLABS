'use client'

import { cn } from '@/lib/utils'

interface CRTScreenProps {
  children: React.ReactNode
  variant?: 'green' | 'amber'
  showScanlines?: boolean
  showGlow?: boolean
  className?: string
}

export function CRTScreen({
  children,
  variant = 'green',
  showScanlines = true,
  showGlow = true,
  className,
}: CRTScreenProps) {
  const bgColor = variant === 'green' ? '#0a1a0a' : '#1a150a'
  const glowColor =
    variant === 'green'
      ? 'rgba(0, 255, 100, 0.08)'
      : 'rgba(255, 170, 0, 0.08)'

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded border-4 border-[#333]',
        'shadow-[inset_0_0_60px_rgba(0,0,0,0.5)]',
        className
      )}
      style={{ backgroundColor: bgColor }}
    >
      {/* Glow effect */}
      {showGlow && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-[1]">{children}</div>

      {/* Scanlines */}
      {showScanlines && (
        <div
          className="absolute inset-0 pointer-events-none z-[10]"
          style={{
            background: `repeating-linear-gradient(
              to bottom,
              transparent 0px,
              transparent 2px,
              rgba(0, 0, 0, 0.15) 2px,
              rgba(0, 0, 0, 0.15) 4px
            )`,
          }}
        />
      )}

      {/* Curvature vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-[11]"
        style={{
          boxShadow: 'inset 0 0 100px rgba(0, 0, 0, 0.4)',
        }}
      />
    </div>
  )
}

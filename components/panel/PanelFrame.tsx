'use client'

import { cn } from '@/lib/utils'

interface PanelFrameProps {
  children: React.ReactNode
  variant?: 'default' | 'teal' | 'military' | 'beige'
  glow?: 'amber' | 'green' | 'cyan' | 'none'
  className?: string
  title?: string
}

export function PanelFrame({
  children,
  variant = 'default',
  glow = 'none',
  className,
  title,
}: PanelFrameProps) {
  const variantStyles = {
    default: 'panel-frame',
    teal: 'panel-frame-teal',
    military: 'panel-frame-military',
    beige: 'bg-[#c4b998] border-[#8b7355]',
  }

  const glowStyles = {
    amber: 'shadow-[0_0_10px_rgba(255,184,0,0.3)]',
    green: 'shadow-[0_0_10px_rgba(0,255,102,0.3)]',
    cyan: 'shadow-[0_0_10px_rgba(0,255,255,0.3)]',
    none: '',
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        variantStyles[variant],
        glowStyles[glow],
        className
      )}
    >
      {title && (
        <div className="absolute top-1 left-2 font-mono text-[10px] uppercase tracking-wider text-[var(--neon-amber)] opacity-80">
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

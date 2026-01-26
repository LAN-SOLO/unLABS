'use client'

import { cn } from '@/lib/utils'

interface PushButtonProps {
  onClick?: () => void
  label?: string
  color?: 'red' | 'green' | 'amber' | 'blue' | 'gray'
  size?: 'sm' | 'md' | 'lg'
  active?: boolean
  disabled?: boolean
  className?: string
}

export function PushButton({
  onClick,
  label,
  color = 'gray',
  size = 'md',
  active = false,
  disabled = false,
  className,
}: PushButtonProps) {
  const sizeStyles = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  }

  const colorStyles = {
    red: {
      base: 'from-[#8b3a3a] to-[#5c2626]',
      glow: 'rgba(255, 51, 51, 0.6)',
      active: '#ff3333',
    },
    green: {
      base: 'from-[#3a8b5a] to-[#265c3a]',
      glow: 'rgba(0, 255, 102, 0.6)',
      active: '#00ff66',
    },
    amber: {
      base: 'from-[#8b6a3a] to-[#5c4626]',
      glow: 'rgba(255, 184, 0, 0.6)',
      active: '#ffb800',
    },
    blue: {
      base: 'from-[#3a5a8b] to-[#26405c]',
      glow: 'rgba(0, 102, 255, 0.6)',
      active: '#0066ff',
    },
    gray: {
      base: 'from-[#4a4a4a] to-[#2a2a2a]',
      glow: 'rgba(255, 255, 255, 0.3)',
      active: '#ffffff',
    },
  }

  const colorConfig = colorStyles[color]

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'rounded-full border-2 border-[#222]',
          'bg-gradient-to-br',
          colorConfig.base,
          'shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.4)]',
          'active:translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.4)]',
          'transition-all duration-75',
          disabled && 'opacity-50 cursor-not-allowed',
          sizeStyles[size]
        )}
        style={{
          boxShadow: active
            ? `inset 0 2px 4px rgba(255,255,255,0.3), 0 0 20px ${colorConfig.glow}, 0 4px 8px rgba(0,0,0,0.4)`
            : undefined,
        }}
      />
      {label && (
        <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--neon-amber)]">
          {label}
        </span>
      )}
    </div>
  )
}

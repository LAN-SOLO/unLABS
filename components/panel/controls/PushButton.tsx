'use client'

import { useState } from 'react'
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
  const [isPressed, setIsPressed] = useState(false)

  const sizePx = {
    sm: 24,
    md: 40,
    lg: 56,
  }

  const colorStyles = {
    red: {
      light: '#d44',
      mid: '#a33',
      dark: '#622',
      glow: 'rgba(255, 51, 51, 0.7)',
      highlight: 'rgba(255, 150, 150, 0.4)',
    },
    green: {
      light: '#4d4',
      mid: '#3a3',
      dark: '#262',
      glow: 'rgba(0, 255, 102, 0.7)',
      highlight: 'rgba(150, 255, 150, 0.4)',
    },
    amber: {
      light: '#da4',
      mid: '#a83',
      dark: '#642',
      glow: 'rgba(255, 184, 0, 0.7)',
      highlight: 'rgba(255, 220, 150, 0.4)',
    },
    blue: {
      light: '#48d',
      mid: '#36a',
      dark: '#246',
      glow: 'rgba(0, 102, 255, 0.7)',
      highlight: 'rgba(150, 180, 255, 0.4)',
    },
    gray: {
      light: '#666',
      mid: '#444',
      dark: '#222',
      glow: 'rgba(255, 255, 255, 0.3)',
      highlight: 'rgba(255, 255, 255, 0.2)',
    },
  }

  const colorConfig = colorStyles[color]
  const buttonSize = sizePx[size]

  const handleMouseDown = () => {
    if (!disabled) setIsPressed(true)
  }

  const handleMouseUp = () => {
    setIsPressed(false)
  }

  const handleClick = () => {
    if (!disabled) onClick?.()
  }

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {/* Button container with shadow */}
      <div
        className="relative"
        style={{
          width: buttonSize,
          height: buttonSize + 4, // Extra space for shadow
        }}
      >
        {/* Shadow element - always below (light from above) */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: buttonSize - 4,
            height: buttonSize - 4,
            left: 2,
            top: isPressed ? 5 : 6, // Shadow moves up when button pressed
            background: active
              ? `radial-gradient(circle, ${colorConfig.glow} 0%, rgba(0,0,0,0.4) 60%)`
              : 'rgba(0, 0, 0, 0.35)',
            filter: isPressed ? 'blur(2px)' : 'blur(4px)',
            transition: 'all 0.05s ease',
          }}
        />
        {/* Button body */}
        <button
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          disabled={disabled}
          className={cn(
            'absolute rounded-full border-2 border-[#1a1a1a]',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          style={{
            width: buttonSize,
            height: buttonSize,
            top: isPressed ? 2 : 0, // Button moves down when pressed
            left: 0,
            // Multi-layer gradient for 3D dome effect with light from above
            background: `
              radial-gradient(ellipse 70% 50% at 50% 30%, ${colorConfig.highlight} 0%, transparent 70%),
              radial-gradient(ellipse 60% 40% at 50% 80%, rgba(0,0,0,0.3) 0%, transparent 60%),
              radial-gradient(circle at 35% 35%, ${colorConfig.light} 0%, transparent 40%),
              linear-gradient(170deg, ${colorConfig.light} 0%, ${colorConfig.mid} 40%, ${colorConfig.dark} 100%)
            `,
            // Top highlight, bottom shadow for 3D depth
            boxShadow: active
              ? `
                  inset 0 2px 4px rgba(255, 255, 255, 0.3),
                  inset 0 -2px 4px rgba(0, 0, 0, 0.3),
                  0 0 15px ${colorConfig.glow},
                  0 0 30px ${colorConfig.glow}
                `
              : `
                  inset 0 2px 4px rgba(255, 255, 255, 0.2),
                  inset 0 -2px 4px rgba(0, 0, 0, 0.25),
                  0 1px 0 rgba(255, 255, 255, 0.05)
                `,
            transition: 'top 0.05s ease, box-shadow 0.1s ease',
          }}
        >
          {/* Specular highlight */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: buttonSize * 0.4,
              height: buttonSize * 0.25,
              top: buttonSize * 0.12,
              left: buttonSize * 0.2,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
              borderRadius: '50%',
              filter: 'blur(1px)',
            }}
          />
        </button>
      </div>
      {label && (
        <span className="font-mono text-[8px] uppercase tracking-wider text-white/60">
          {label}
        </span>
      )}
    </div>
  )
}

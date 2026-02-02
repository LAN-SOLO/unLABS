'use client'

import { useCallback } from 'react'

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label: string
  showPercent?: boolean
  suffix?: string
  disabled?: boolean
  focused?: boolean
}

export function Slider({ value, min, max, step = 1, onChange, label, showPercent = true, suffix, disabled, focused }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100
  const filled = Math.round(percent / 10)
  const empty = 10 - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  const display = showPercent ? `${Math.round(percent)}%` : `${value}${suffix ?? ''}`

  const adjust = useCallback((delta: number) => {
    if (disabled) return
    const next = Math.max(min, Math.min(max, value + delta * step))
    onChange(next)
  }, [disabled, min, max, value, step, onChange])

  return (
    <div
      className={`flex items-center gap-2 px-1 py-0.5 cursor-pointer select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${focused ? 'bg-[rgba(255,170,0,0.1)]' : ''}`}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'ArrowRight' || e.key === 'l') adjust(e.shiftKey ? 10 : 1)
        else if (e.key === 'ArrowLeft' || e.key === 'h') adjust(e.shiftKey ? -10 : -1)
        else if (e.key === 'Home') onChange(min)
        else if (e.key === 'End') onChange(max)
      }}
      tabIndex={disabled ? -1 : 0}
      role="slider"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
    >
      <span className="whitespace-nowrap inline-block w-[18ch] text-right">{label}:</span>
      <span className={focused ? 'text-[var(--neon-amber,#FFAA00)]' : ''}>
        {focused && '▸'}[{bar}]
      </span>
      <span className="inline-block w-[6ch]">{display}</span>
      {focused && <span className="text-[var(--neon-amber,#FFAA00)]">◂</span>}
    </div>
  )
}

'use client'

import { useCallback, useRef } from 'react'

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

  const barRef = useRef<HTMLSpanElement>(null)
  const draggingRef = useRef(false)

  const adjust = useCallback((delta: number) => {
    if (disabled) return
    const next = Math.max(min, Math.min(max, value + delta * step))
    onChange(next)
  }, [disabled, min, max, value, step, onChange])

  const setFromClientX = useCallback((clientX: number) => {
    if (disabled) return
    const span = barRef.current
    if (!span) return
    const rect = span.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + ratio * (max - min)
    const snapped = Math.round(raw / step) * step
    onChange(Math.max(min, Math.min(max, snapped)))
  }, [disabled, min, max, step, onChange])

  const handleBarClick = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation()
    setFromClientX(e.clientX)
  }, [setFromClientX])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    if (disabled) return
    e.preventDefault()
    draggingRef.current = true
    setFromClientX(e.clientX)

    const handleMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      setFromClientX(ev.clientX)
    }
    const handleMouseUp = () => {
      draggingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [disabled, setFromClientX])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return
    e.stopPropagation()
    const delta = e.deltaY < 0 ? 1 : -1
    adjust(e.shiftKey ? delta * 10 : delta)
  }, [disabled, adjust])

  return (
    <div
      className={`flex items-center gap-2 px-1 py-0.5 cursor-pointer select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${focused ? 'bg-[rgba(255,170,0,0.1)]' : ''}`}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); adjust(e.shiftKey ? 10 : 1) }
        else if (e.key === 'ArrowLeft' || e.key === 'h') { e.preventDefault(); adjust(e.shiftKey ? -10 : -1) }
        else if (e.key === 'Home') { e.preventDefault(); onChange(min) }
        else if (e.key === 'End') { e.preventDefault(); onChange(max) }
      }}
      onWheel={handleWheel}
      tabIndex={disabled ? -1 : 0}
      role="slider"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
    >
      <span className="whitespace-nowrap inline-block w-[18ch] text-right">{label}:</span>
      <span
        ref={barRef}
        className={`cursor-ew-resize ${focused ? 'text-[var(--neon-amber,#FFAA00)]' : ''}`}
        onClick={handleBarClick}
        onMouseDown={handleMouseDown}
      >
        {focused && '▸'}[{bar}]
      </span>
      <span className="inline-block w-[6ch]">{display}</span>
      {focused && <span className="text-[var(--neon-amber,#FFAA00)]">◂</span>}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'

interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  label: string
  disabled?: boolean
  focused?: boolean
}

export function Dropdown({ options, value, onChange, label, disabled, focused }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label ?? value

  useEffect(() => {
    if (open) {
      const idx = options.findIndex(o => o.value === value)
      if (idx >= 0) setHighlightIndex(idx)
    }
  }, [open, value, options])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex items-center gap-2 px-1 py-0.5 cursor-pointer select-none ${
          disabled ? 'opacity-40 cursor-not-allowed' : ''
        } ${focused ? 'bg-[rgba(255,170,0,0.1)]' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (open) {
              onChange(options[highlightIndex].value)
              setOpen(false)
            } else {
              setOpen(true)
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          } else if (open) {
            if (e.key === 'ArrowDown' || e.key === 'j') {
              e.preventDefault()
              setHighlightIndex(i => Math.min(i + 1, options.length - 1))
            } else if (e.key === 'ArrowUp' || e.key === 'k') {
              e.preventDefault()
              setHighlightIndex(i => Math.max(i - 1, 0))
            }
          }
        }}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="whitespace-nowrap inline-block w-[18ch] text-right">{label}:</span>
        <span className={focused ? 'text-[var(--neon-amber,#FFAA00)]' : ''}>
          [{selectedLabel.padEnd(24)}{open ? '▲' : '▼'}]
        </span>
      </div>
      {open && (
        <div className="absolute left-[18ch] top-full z-50 border border-current min-w-[28ch]" style={{ backgroundColor: '#0A0A0A' }}>
          {options.map((opt, i) => (
            <div
              key={opt.value}
              className={`px-1 py-0.5 cursor-pointer ${
                i === highlightIndex ? 'bg-[rgba(255,170,0,0.15)] text-[var(--neon-amber,#FFAA00)]' : ''
              }`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {opt.label} {opt.value === value ? '✓' : ' '}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

interface ToggleProps {
  value: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  focused?: boolean
}

export function Toggle({ value, onChange, label, description, disabled, focused }: ToggleProps) {
  const indicator = value ? '██████████' : '░░░░░░░░░░'
  const state = value ? 'ON ' : 'OFF'

  return (
    <div
      className={`flex items-center gap-2 px-1 py-0.5 cursor-pointer select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${focused ? 'bg-[rgba(255,170,0,0.1)]' : ''}`}
      onClick={() => !disabled && onChange(!value)}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onChange(!value)
        }
      }}
      tabIndex={disabled ? -1 : 0}
      role="switch"
      aria-checked={value}
      aria-label={label}
    >
      <span className="whitespace-nowrap inline-block w-[18ch] text-right">{label}:</span>
      <span className={focused ? 'text-[var(--neon-amber,#FFAA00)]' : ''}>
        {focused && '▸'}[{indicator}]
      </span>
      <span className="inline-block w-[4ch]">{state}</span>
      {description && <span className="text-[var(--state-offline,#666)] text-xs ml-2">({description})</span>}
    </div>
  )
}

'use client'

interface RadioOption {
  value: string
  label: string
  description?: string
}

interface RadioGroupProps {
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  label: string
  disabled?: boolean
  focusedIndex?: number
}

export function RadioGroup({ options, value, onChange, label, disabled, focusedIndex }: RadioGroupProps) {
  return (
    <div role="radiogroup" aria-label={label}>
      {label && <div className="mb-1 font-bold">{label}:</div>}
      {options.map((option, i) => {
        const selected = value === option.value
        const isFocused = focusedIndex === i
        return (
          <div
            key={option.value}
            className={`flex items-center gap-2 px-1 py-0.5 cursor-pointer select-none ${
              disabled ? 'opacity-40 cursor-not-allowed' : ''
            } ${isFocused ? 'bg-[rgba(255,170,0,0.1)] text-[var(--neon-amber,#FFAA00)]' : ''}`}
            onClick={() => !disabled && onChange(option.value)}
            onKeyDown={(e) => {
              if (disabled) return
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                onChange(option.value)
              }
            }}
            tabIndex={disabled ? -1 : 0}
            role="radio"
            aria-checked={selected}
          >
            <span>[{selected ? '●' : ' '}]</span>
            <span>{option.label}</span>
            {option.description && (
              <span className="text-[var(--state-offline,#666)] text-xs">— {option.description}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

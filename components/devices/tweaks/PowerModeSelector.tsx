'use client'

import type { TweakValue } from '../hooks/useTweakPanel'

interface PowerModeSelectorProps {
  tweak: TweakValue
  onChange: (value: string) => void
}

export function PowerModeSelector({ tweak, onChange }: PowerModeSelectorProps) {
  const options = tweak.options ?? []
  const current = String(tweak.current_value)
  const defaultVal = String(tweak.default_value)

  return (
    <div className="font-mono text-[10px] space-y-0.5">
      <div className="text-green-500/60 mb-1">{tweak.setting_name}</div>
      {options.map((opt) => {
        const selected = current === opt.value
        const isDefault = defaultVal === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-2 w-full text-left cursor-pointer py-0.5 px-1 hover:bg-green-500/5 ${
              selected ? 'bg-green-500/10' : ''
            }`}
          >
            <span className={selected ? 'text-green-400' : 'text-green-500/30'}>
              {selected ? '[●]' : '[ ]'}
            </span>
            <span className={selected ? 'text-green-400' : 'text-green-500/60'}>
              {opt.label}
            </span>
            <span className="flex-1" />
            <span className={opt.power_delta >= 0 ? 'text-green-500/50' : 'text-red-400/60'}>
              {opt.power_delta > 0 ? '+' : ''}{opt.power_delta} E/s
            </span>
            {isDefault && (
              <span className="text-green-500/30 text-[9px]">DEFAULT</span>
            )}
          </button>
        )
      })}
      {tweak.description && (
        <div className="text-green-500/30 text-[9px] pl-6 pt-0.5">{tweak.description}</div>
      )}
    </div>
  )
}

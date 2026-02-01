'use client'

import type { TweakValue } from '../hooks/useTweakPanel'

interface ToggleSwitchProps {
  tweak: TweakValue
  onChange: (value: boolean) => void
}

export function ToggleSwitch({ tweak, onChange }: ToggleSwitchProps) {
  const checked = tweak.current_value === true || tweak.current_value === 'true'

  return (
    <button
      onClick={() => onChange(!checked)}
      className="font-mono text-[10px] flex items-center gap-2 w-full text-left cursor-pointer py-0.5 px-1 hover:bg-green-500/5"
    >
      <span className={checked ? 'text-green-400' : 'text-green-500/30'}>
        {checked ? '[X]' : '[ ]'}
      </span>
      <span className={checked ? 'text-green-400' : 'text-green-500/60'}>
        {tweak.setting_name}
      </span>
      <span className="flex-1" />
      {tweak.power_impact !== 0 && (
        <span className={tweak.power_impact < 0 ? 'text-green-500/50' : 'text-red-400/60'}>
          {checked ? (tweak.power_impact < 0 ? 'Saves' : 'Costs') + ': ' : ''}
          {checked ? `~${Math.abs(tweak.power_impact)} E/s` : ''}
        </span>
      )}
    </button>
  )
}

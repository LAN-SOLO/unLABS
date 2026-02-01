'use client'

import type { TweakValue } from '../hooks/useTweakPanel'

interface TweakSliderProps {
  tweak: TweakValue
  onChange: (value: number) => void
}

const BAR_WIDTH = 16

export function TweakSlider({ tweak, onChange }: TweakSliderProps) {
  const value = Number(tweak.current_value) || 0
  const clamped = Math.max(0, Math.min(100, value))
  const filled = Math.round((clamped / 100) * BAR_WIDTH)
  const empty = BAR_WIDTH - filled

  // Derive labels from options or default to min/max
  const minLabel = tweak.options?.[0]?.label ?? 'MIN'
  const maxLabel = tweak.options?.[1]?.label ?? 'MAX'

  const powerDelta = tweak.power_impact * (clamped / 100)

  return (
    <div className="font-mono text-[10px] space-y-0.5 py-0.5 px-1">
      <div className="text-green-500/60">{tweak.setting_name}</div>
      <div className="flex items-center gap-2">
        <span className="text-green-500/40 w-[70px] text-right">{minLabel}</span>
        <span className="text-green-500/30">[</span>
        <span className="text-cyan-400">{'▓'.repeat(filled)}</span>
        <span className="text-green-500/15">{'░'.repeat(empty)}</span>
        <span className="text-green-500/30">]</span>
        <span className="text-green-500/40 w-[70px]">{maxLabel}</span>
        <span className="text-green-500/30">│</span>
        <span className={powerDelta >= 0 ? 'text-red-400/60' : 'text-green-500/50'}>
          {powerDelta > 0 ? '+' : ''}{powerDelta.toFixed(1)} E/s
        </span>
      </div>
      {/* Hidden native range input for interaction */}
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-[4px] appearance-none bg-green-500/10 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-green-400 [&::-webkit-slider-thumb]:cursor-grab"
      />
      {tweak.description && (
        <div className="text-green-500/30 text-[9px]">{tweak.description}</div>
      )}
    </div>
  )
}

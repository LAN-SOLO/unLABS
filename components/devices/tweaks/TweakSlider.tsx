"use client";

import type { TweakValue } from "../hooks/useTweakPanel";

interface TweakSliderProps {
  tweak: TweakValue;
  onChange: (value: number) => void;
}

const BAR_WIDTH = 16;

export function TweakSlider({ tweak, onChange }: TweakSliderProps) {
  const value = Number(tweak.current_value) || 0;
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;

  // Derive labels from options or default to min/max
  const minLabel = tweak.options?.[0]?.label ?? "MIN";
  const maxLabel = tweak.options?.[1]?.label ?? "MAX";

  const powerDelta = tweak.power_impact * (clamped / 100);

  return (
    <div className="space-y-0.5 px-1 py-0.5 font-mono text-[10px]">
      <div className="text-green-500/60">{tweak.setting_name}</div>
      <div className="flex items-center gap-2">
        <span className="w-[70px] text-right text-green-500/40">{minLabel}</span>
        <span className="text-green-500/30">[</span>
        <span className="text-cyan-400">{"▓".repeat(filled)}</span>
        <span className="text-green-500/15">{"░".repeat(empty)}</span>
        <span className="text-green-500/30">]</span>
        <span className="w-[70px] text-green-500/40">{maxLabel}</span>
        <span className="text-green-500/30">│</span>
        <span className={powerDelta >= 0 ? "text-red-400/60" : "text-green-500/50"}>
          {powerDelta > 0 ? "+" : ""}
          {powerDelta.toFixed(1)} E/s
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
        className="h-[4px] w-full cursor-pointer appearance-none bg-green-500/10 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-green-400"
      />
      {tweak.description && <div className="text-[9px] text-green-500/30">{tweak.description}</div>}
    </div>
  );
}

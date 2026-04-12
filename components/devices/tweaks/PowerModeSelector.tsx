"use client";

import type { TweakValue } from "../hooks/useTweakPanel";

interface PowerModeSelectorProps {
  tweak: TweakValue;
  onChange: (value: string) => void;
}

export function PowerModeSelector({ tweak, onChange }: PowerModeSelectorProps) {
  const options = tweak.options ?? [];
  const current = String(tweak.current_value);
  const defaultVal = String(tweak.default_value);

  return (
    <div className="space-y-0.5 font-mono text-[10px]">
      <div className="mb-1 text-green-500/60">{tweak.setting_name}</div>
      {options.map((opt) => {
        const selected = current === opt.value;
        const isDefault = defaultVal === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex w-full cursor-pointer items-center gap-2 px-1 py-0.5 text-left hover:bg-green-500/5 ${
              selected ? "bg-green-500/10" : ""
            }`}
          >
            <span className={selected ? "text-green-400" : "text-green-500/30"}>
              {selected ? "[●]" : "[ ]"}
            </span>
            <span className={selected ? "text-green-400" : "text-green-500/60"}>{opt.label}</span>
            <span className="flex-1" />
            <span className={opt.power_delta >= 0 ? "text-green-500/50" : "text-red-400/60"}>
              {opt.power_delta > 0 ? "+" : ""}
              {opt.power_delta} E/s
            </span>
            {isDefault && <span className="text-[9px] text-green-500/30">DEFAULT</span>}
          </button>
        );
      })}
      {tweak.description && (
        <div className="pt-0.5 pl-6 text-[9px] text-green-500/30">{tweak.description}</div>
      )}
    </div>
  );
}

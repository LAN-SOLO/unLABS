"use client";

import { useTweakPanel } from "../hooks/useTweakPanel";
import { PowerModeSelector } from "./PowerModeSelector";
import { PriorityList } from "./PriorityList";
import { ToggleSwitch } from "./ToggleSwitch";
import { TweakSlider } from "./TweakSlider";
import { PowerImpactDisplay } from "./PowerImpactDisplay";
import { PresetManager } from "./PresetManager";

interface TweakPanelProps {
  deviceId: string;
  playerId: string;
  onApply?: () => void;
  onBack?: () => void;
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  const lineLen = Math.max(64, title.length + 12);
  const afterTitle = lineLen - title.length - 4;
  return (
    <div className="font-mono text-[10px]">
      <div className="whitespace-pre text-green-500/30">
        {"┌─ "}
        <span className="text-green-500/60">{title}</span>
        {" " + "─".repeat(Math.max(0, afterTitle)) + "┐"}
      </div>
      <div className="border-r border-l border-green-500/15 px-2 py-1">{children}</div>
      <div className="whitespace-pre text-green-500/30">{"└" + "─".repeat(lineLen) + "┘"}</div>
    </div>
  );
}

export function TweakPanel({ deviceId, playerId, onApply, onBack }: TweakPanelProps) {
  const {
    grouped,
    dirty,
    loading,
    saving,
    error,
    powerImpact,
    presets,
    setValue,
    reorder,
    save,
    reset,
    savePreset,
    loadPreset,
    deletePreset,
  } = useTweakPanel({ deviceId, playerId });

  if (loading) {
    return (
      <div className="py-4 font-mono text-[10px] text-green-500/40">
        <span className="animate-pulse">LOADING TWEAK CONFIGURATION...</span>
      </div>
    );
  }

  const hasRadio = grouped.radio.length > 0;
  const hasToggle = grouped.toggle.length > 0;
  const hasSlider = grouped.slider.length > 0;
  const hasPriority = grouped.priority_list.length > 0;
  const hasAny = hasRadio || hasToggle || hasSlider || hasPriority;

  if (!hasAny) {
    return (
      <div className="py-4 font-mono text-[10px] text-green-500/40">
        NO CONFIGURABLE TWEAKS FOR THIS DEVICE
      </div>
    );
  }

  const handleApply = async () => {
    await save();
    onApply?.();
  };

  return (
    <div className="space-y-2">
      {/* Error */}
      {error && (
        <div className="border border-red-500/30 px-2 py-1 font-mono text-[10px] text-red-500">
          ERR: {error}
        </div>
      )}

      {/* Power Modes */}
      {hasRadio && (
        <SectionBox title="POWER MODES">
          <div className="space-y-2">
            {grouped.radio.map((t) => (
              <PowerModeSelector
                key={t.tweak_id}
                tweak={t}
                onChange={(v) => setValue(t.setting_id, v)}
              />
            ))}
          </div>
        </SectionBox>
      )}

      {/* Priority Lists */}
      {hasPriority && (
        <SectionBox title="PRIORITIES">
          <div className="space-y-2">
            {grouped.priority_list.map((t) => (
              <PriorityList
                key={t.tweak_id}
                tweak={t}
                onReorder={(from, to) => reorder(t.setting_id, from, to)}
              />
            ))}
          </div>
        </SectionBox>
      )}

      {/* Toggles */}
      {hasToggle && (
        <SectionBox title="TOGGLES">
          <div className="space-y-0.5">
            {grouped.toggle.map((t) => (
              <ToggleSwitch
                key={t.tweak_id}
                tweak={t}
                onChange={(v) => setValue(t.setting_id, v)}
              />
            ))}
          </div>
        </SectionBox>
      )}

      {/* Sliders */}
      {hasSlider && (
        <SectionBox title="PARAMETERS">
          <div className="space-y-1">
            {grouped.slider.map((t) => (
              <TweakSlider key={t.tweak_id} tweak={t} onChange={(v) => setValue(t.setting_id, v)} />
            ))}
          </div>
        </SectionBox>
      )}

      {/* Power Impact */}
      <PowerImpactDisplay
        defaultPower={powerImpact.default_power}
        currentPower={powerImpact.current_power}
        delta={powerImpact.delta}
      />

      {/* Presets */}
      <PresetManager
        presets={presets}
        onSave={savePreset}
        onLoad={loadPreset}
        onDelete={deletePreset}
        onReset={reset}
        dirty={dirty}
        saving={saving}
      />

      {/* Apply bar */}
      {dirty && (
        <div className="flex items-center gap-3 border border-green-500/20 px-2 py-1 font-mono text-[10px]">
          <span className="animate-pulse text-amber-400">UNSAVED CHANGES</span>
          <span className="flex-1" />
          <button
            onClick={handleApply}
            disabled={saving}
            className="cursor-pointer text-green-400 hover:text-green-300 disabled:text-green-500/20"
          >
            [{saving ? "SAVING..." : "APPLY"}]
          </button>
          <button
            onClick={reset}
            disabled={saving}
            className="cursor-pointer text-amber-400/60 hover:text-amber-400 disabled:text-green-500/20"
          >
            [DISCARD]
          </button>
        </div>
      )}
    </div>
  );
}

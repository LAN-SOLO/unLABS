"use client";

import { useState } from "react";
import type { TweakPreset } from "../hooks/useTweakPanel";

interface PresetManagerProps {
  presets: TweakPreset[];
  onSave: (name: string) => void;
  onLoad: (preset: TweakPreset) => void;
  onDelete: (name: string) => void;
  onReset: () => void;
  dirty: boolean;
  saving: boolean;
}

export function PresetManager({
  presets,
  onSave,
  onLoad,
  onDelete,
  onReset,
  dirty,
  saving,
}: PresetManagerProps) {
  const [naming, setNaming] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSave(presetName.trim());
      setPresetName("");
      setNaming(false);
    }
  };

  return (
    <div className="space-y-1 font-mono text-[10px]">
      <div className="whitespace-pre text-green-500/30">
        {"┌─ "}
        <span className="text-green-500/60">PRESETS</span>
        {" " + "─".repeat(55) + "┐"}
      </div>
      <div className="space-y-1 border-r border-l border-green-500/15 px-2 py-1">
        {/* Preset list */}
        {presets.length > 0 ? (
          <div className="space-y-0.5">
            {presets.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="text-green-500/30">▸</span>
                <span className="text-green-400">{p.name}</span>
                <span className="flex-1" />
                <button
                  onClick={() => onLoad(p)}
                  className="cursor-pointer text-cyan-400/60 hover:text-cyan-400"
                >
                  [LOAD]
                </button>
                <button
                  onClick={() => onDelete(p.name)}
                  className="cursor-pointer text-red-400/40 hover:text-red-400"
                >
                  [DEL]
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-green-500/30">NO SAVED PRESETS</div>
        )}

        {/* Save new preset */}
        {naming ? (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-green-500/60">NAME:</span>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
                if (e.key === "Escape") setNaming(false);
              }}
              placeholder="preset_name"
              className="w-[120px] border border-green-500/20 bg-transparent px-1 py-0 font-mono text-[10px] text-green-400 placeholder-green-500/20 caret-green-400 outline-none focus:border-green-500/50"
              autoFocus
              spellCheck={false}
            />
            <button
              onClick={handleSavePreset}
              className="cursor-pointer text-green-400/80 hover:text-green-400"
            >
              [OK]
            </button>
            <button
              onClick={() => setNaming(false)}
              className="cursor-pointer text-green-500/40 hover:text-green-500/60"
            >
              [X]
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setNaming(true)}
              className="cursor-pointer text-cyan-400/60 hover:text-cyan-400"
            >
              [SAVE PRESET]
            </button>
            <button
              onClick={onReset}
              disabled={saving}
              className="cursor-pointer text-amber-400/60 hover:text-amber-400 disabled:text-green-500/20"
            >
              [RESET DEFAULTS]
            </button>
          </div>
        )}
      </div>
      <div className="whitespace-pre text-green-500/30">{"└" + "─".repeat(64) + "┘"}</div>
    </div>
  );
}

'use client'

import { useState } from 'react'
import type { TweakPreset } from '../hooks/useTweakPanel'

interface PresetManagerProps {
  presets: TweakPreset[]
  onSave: (name: string) => void
  onLoad: (preset: TweakPreset) => void
  onDelete: (name: string) => void
  onReset: () => void
  dirty: boolean
  saving: boolean
}

export function PresetManager({ presets, onSave, onLoad, onDelete, onReset, dirty, saving }: PresetManagerProps) {
  const [naming, setNaming] = useState(false)
  const [presetName, setPresetName] = useState('')

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSave(presetName.trim())
      setPresetName('')
      setNaming(false)
    }
  }

  return (
    <div className="font-mono text-[10px] space-y-1">
      <div className="text-green-500/30 whitespace-pre">
        {'┌─ '}<span className="text-green-500/60">PRESETS</span>{' ' + '─'.repeat(55) + '┐'}
      </div>
      <div className="border-l border-r border-green-500/15 px-2 py-1 space-y-1">
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
                  className="text-cyan-400/60 hover:text-cyan-400 cursor-pointer"
                >
                  [LOAD]
                </button>
                <button
                  onClick={() => onDelete(p.name)}
                  className="text-red-400/40 hover:text-red-400 cursor-pointer"
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
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setNaming(false) }}
              placeholder="preset_name"
              className="bg-transparent text-green-400 font-mono text-[10px] border border-green-500/20 px-1 py-0 w-[120px] outline-none focus:border-green-500/50 placeholder-green-500/20 caret-green-400"
              autoFocus
              spellCheck={false}
            />
            <button onClick={handleSavePreset} className="text-green-400/80 hover:text-green-400 cursor-pointer">[OK]</button>
            <button onClick={() => setNaming(false)} className="text-green-500/40 hover:text-green-500/60 cursor-pointer">[X]</button>
          </div>
        ) : (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setNaming(true)}
              className="text-cyan-400/60 hover:text-cyan-400 cursor-pointer"
            >
              [SAVE PRESET]
            </button>
            <button
              onClick={onReset}
              disabled={saving}
              className="text-amber-400/60 hover:text-amber-400 cursor-pointer disabled:text-green-500/20"
            >
              [RESET DEFAULTS]
            </button>
          </div>
        )}
      </div>
      <div className="text-green-500/30 whitespace-pre">
        {'└' + '─'.repeat(64) + '┘'}
      </div>
    </div>
  )
}

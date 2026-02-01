'use client'

import type { CombinationWithDevice } from '../hooks/useCombinations'

interface ActiveSynergyCardProps {
  combo: CombinationWithDevice
  currentDeviceId: string
  onUnlink: (partnerId: string) => void
  linking: boolean
}

export function ActiveSynergyCard({ combo, currentDeviceId, onUnlink, linking }: ActiveSynergyCardProps) {
  return (
    <div className="font-mono text-[10px] space-y-0.5 py-1">
      {/* Header: linked devices */}
      <div className="flex items-center gap-1">
        <span className="text-green-400">✓</span>
        <span className="text-green-400">{currentDeviceId}</span>
        <span className="text-green-500/40">+</span>
        <span className="text-green-400">{combo.partner_id}</span>
        <span className="text-green-500/40">(</span>
        <span className="text-green-500/60">{combo.partner_name}</span>
        <span className="text-green-500/40">)</span>
      </div>

      {/* Combo name */}
      <div className="pl-4 flex items-center gap-1">
        <span className="text-green-500/40">=</span>
        <span className="text-amber-400">{combo.combo_name}</span>
      </div>

      {/* Effect */}
      {combo.effect_description && (
        <div className="pl-4 flex items-center gap-1">
          <span className="text-green-500/60">Effect:</span>
          <span className="text-green-400/80">{combo.effect_description}</span>
        </div>
      )}

      {/* Combined power */}
      <div className="pl-4 flex items-center gap-1">
        <span className="text-green-500/60">Combined Power:</span>
        <span className={combo.combined_power >= 0 ? 'text-green-400' : 'text-red-400/80'}>
          {combo.combined_power > 0 ? '+' : ''}{combo.combined_power.toFixed(0)} E/s
        </span>
      </div>

      {/* Unlink button */}
      <div className="pl-4">
        <button
          onClick={() => onUnlink(combo.partner_id)}
          disabled={linking}
          className="text-red-400/50 hover:text-red-400 cursor-pointer disabled:text-green-500/20"
        >
          [{linking ? 'UNLINKING...' : 'Unlink'}]
        </button>
      </div>
    </div>
  )
}

'use client'

import type { CombinationWithDevice } from '../hooks/useCombinations'
import { RequirementBadge } from './RequirementBadge'

interface AvailableCombinationCardProps {
  combo: CombinationWithDevice
  currentDeviceId: string
  onLink: (partnerId: string) => void
  linking: boolean
}

export function AvailableCombinationCard({ combo, currentDeviceId, onLink, linking }: AvailableCombinationCardProps) {
  const canLink = combo.is_unlocked
  const statusSymbol = canLink ? '○' : '●'
  const statusColor = canLink ? 'text-amber-400' : 'text-green-500/30'

  return (
    <div className={`font-mono text-[10px] space-y-0.5 py-1 ${canLink ? '' : 'opacity-60'}`}>
      {/* Header */}
      <div className="flex items-center gap-1">
        <span className={statusColor}>{statusSymbol}</span>
        <span className="text-green-400">{currentDeviceId}</span>
        <span className="text-green-500/40">+</span>
        <span className={canLink ? 'text-green-400' : 'text-green-500/40'}>{combo.partner_id}</span>
        <span className="text-green-500/40">(</span>
        <span className="text-green-500/60">{combo.partner_name}</span>
        <span className="text-green-500/40">)</span>
      </div>

      {/* Combo name */}
      <div className="pl-4 flex items-center gap-1">
        <span className="text-green-500/40">=</span>
        <span className={canLink ? 'text-amber-400/80' : 'text-green-500/40'}>{combo.combo_name}</span>
      </div>

      {/* Requirement */}
      {(combo.requirement_tree || combo.requirement_item) && (
        <div className="pl-4">
          <RequirementBadge
            tree={combo.requirement_tree}
            item={combo.requirement_item}
            isUnlocked={canLink}
          />
        </div>
      )}

      {/* Effect */}
      {combo.effect_description && (
        <div className="pl-4 flex items-center gap-1">
          <span className="text-green-500/60">Effect:</span>
          <span className="text-green-500/50">{combo.effect_description}</span>
        </div>
      )}

      {/* Combined power */}
      <div className="pl-4 flex items-center gap-1">
        <span className="text-green-500/60">Combined Power:</span>
        <span className={combo.combined_power >= 0 ? 'text-green-500/50' : 'text-red-400/50'}>
          {combo.combined_power > 0 ? '+' : ''}{combo.combined_power.toFixed(0)} E/s
        </span>
      </div>

      {/* Link button */}
      <div className="pl-4">
        {canLink ? (
          <button
            onClick={() => onLink(combo.partner_id)}
            disabled={linking}
            className="text-cyan-400/60 hover:text-cyan-400 cursor-pointer disabled:text-green-500/20"
          >
            [{linking ? 'LINKING...' : 'Link'}]
          </button>
        ) : (
          <span className="text-green-500/20">[LOCKED]</span>
        )}
      </div>
    </div>
  )
}

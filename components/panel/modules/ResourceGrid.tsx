'use client'

import { useEffect, useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import { useResourceManagerOptional } from '@/contexts/ResourceManager'
import { RESOURCE_CONTAINERS, TIER_LABELS, type ContainerState } from '@/types/resources'

export function ResourceGrid({ className }: { className?: string }) {
  const rm = useResourceManagerOptional()
  const [, setTick] = useState(0)

  // Re-render every 3s to reflect tick updates
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 3000)
    return () => clearInterval(interval)
  }, [])

  if (!rm) return null

  // Group containers by tier, only show tiers that have at least one unlocked container
  const tiers = new Map<number, { def: (typeof RESOURCE_CONTAINERS)[number]; state: ContainerState }[]>()

  for (const def of RESOURCE_CONTAINERS) {
    const cs = rm.getContainer(def.id)
    if (!cs) continue
    if (!tiers.has(def.tier)) tiers.set(def.tier, [])
    tiers.get(def.tier)!.push({ def, state: cs })
  }

  const sortedTiers = [...tiers.entries()].sort((a, b) => a[0] - b[0])

  return (
    <PanelFrame variant="default" className={`p-1.5 ${className ?? ''}`}>
      <div className="font-mono text-[7px] text-white/40 mb-1 tracking-wider">RESOURCE CONTAINERS</div>
      <div className="overflow-y-auto max-h-[200px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {sortedTiers.map(([tier, entries]) => {
          const hasUnlocked = entries.some(e => e.state.isUnlocked)
          if (!hasUnlocked) return null

          return (
            <div key={tier} className="mb-1">
              {/* Tier header */}
              <div className="flex items-center gap-1 mb-0.5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="font-mono text-[6px] text-white/30 px-1">
                  T{tier} · {TIER_LABELS[tier] ?? '???'}
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Container rows */}
              {entries.map(({ def, state }) => (
                <ContainerRow key={def.id} def={def} state={state} />
              ))}
            </div>
          )
        })}
      </div>
    </PanelFrame>
  )
}

function ContainerRow({
  def,
  state,
}: {
  def: (typeof RESOURCE_CONTAINERS)[number]
  state: ContainerState
}) {
  const fillPercent = state.capacity > 0 ? (state.amount / state.capacity) * 100 : 0
  const isLocked = !state.isUnlocked

  if (isLocked) {
    return (
      <div className="flex items-center gap-1 h-5 px-1 opacity-30">
        <span className="text-[8px]" style={{ color: def.color }}>○</span>
        <span className="font-mono text-[7px] text-white/40 w-[42px] shrink-0">{def.id}</span>
        <span className="font-mono text-[7px] text-white/30 flex-1 truncate">{def.name}</span>
        <span className="font-mono text-[6px] text-white/20">── LOCKED</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 h-5 px-1">
      {/* Status dot */}
      <span
        className="text-[8px] leading-none"
        style={{ color: def.color, filter: `drop-shadow(0 0 2px ${def.color})` }}
      >
        ●
      </span>

      {/* Container ID */}
      <span className="font-mono text-[7px] text-white/35 w-[42px] shrink-0">{def.id}</span>

      {/* Name */}
      <span className="font-mono text-[7px] text-white/70 w-[90px] shrink-0 truncate">{def.name}</span>

      {/* Progress bar */}
      <div className="w-[48px] h-[5px] bg-black/50 rounded-sm overflow-hidden shrink-0">
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{
            width: `${fillPercent}%`,
            background: def.color,
            boxShadow: `0 0 3px ${def.color}`,
          }}
        />
      </div>

      {/* Amount/Capacity */}
      <span className="font-mono text-[7px] text-white/60 w-[58px] text-right shrink-0">
        {formatAmount(state.amount)}/{formatAmount(state.capacity)}
      </span>

      {/* Flow rate */}
      {state.flowRate > 0 && (
        <span className="font-mono text-[6px] text-white/30 w-[32px] text-right shrink-0">
          +{state.flowRate.toFixed(1)}/s
        </span>
      )}
    </div>
  )
}

function formatAmount(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  return Math.floor(n).toString()
}

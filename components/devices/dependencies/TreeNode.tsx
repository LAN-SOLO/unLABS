'use client'

import type { DependencyStatus } from '@/types/devices'

interface TreeNodeProps {
  deviceId: string
  name: string
  tier: number
  techTree: string
  status: DependencyStatus
  isCrossTree: boolean
  isTarget: boolean
}

const STATUS_SYMBOL: Record<DependencyStatus, string> = {
  complete: '✓',
  researching: '→',
  locked: '●',
}

const STATUS_COLOR: Record<DependencyStatus, string> = {
  complete: 'text-green-400',
  researching: 'text-cyan-400',
  locked: 'text-green-500/30',
}

const STATUS_LABEL: Record<DependencyStatus, string> = {
  complete: 'COMPLETE',
  researching: 'RESEARCHING',
  locked: 'LOCKED',
}

export function TreeNodeDisplay({ deviceId, name, tier, techTree, status, isCrossTree, isTarget }: TreeNodeProps) {
  const symbolColor = STATUS_COLOR[status]
  const symbol = STATUS_SYMBOL[status]
  const label = STATUS_LABEL[status]
  const isAnimated = status === 'researching'

  return (
    <div className="font-mono text-[10px] leading-[16px] inline-flex flex-col">
      {/* Device name line */}
      <div className="flex items-center gap-1">
        <span className="text-green-500/60">T{tier}:</span>
        <span className={isTarget ? 'text-green-400 text-glow-green' : 'text-green-400'}>
          {name}
        </span>
        {isTarget && <span className="text-amber-400">◀</span>}
        {isCrossTree && (
          <span className="text-violet-400/60 text-[9px]">[{techTree}]</span>
        )}
      </div>
      {/* Status line */}
      <div className="flex items-center gap-1 pl-4">
        <span className={`${symbolColor} ${isAnimated ? 'animate-pulse' : ''}`}>{symbol}</span>
        <span className={`${symbolColor} text-[9px]`}>{label}</span>
      </div>
    </div>
  )
}

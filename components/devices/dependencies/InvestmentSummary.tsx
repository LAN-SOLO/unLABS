'use client'

import type { InvestmentTotals } from '../hooks/useDependencyTree'

interface InvestmentSummaryProps {
  investment: InvestmentTotals
}

export function InvestmentSummary({ investment }: InvestmentSummaryProps) {
  const { total_cost_unsc, total_time_hours, completed_steps, total_steps } = investment
  const progress = total_steps > 0 ? (completed_steps / total_steps) * 100 : 0
  const barWidth = 20
  const filled = Math.round((progress / 100) * barWidth)
  const empty = barWidth - filled

  return (
    <div className="font-mono text-[10px]">
      <div className="text-green-500/30 whitespace-pre">
        {'┌─ '}<span className="text-green-500/60">INVESTMENT SUMMARY</span>{' ' + '─'.repeat(40) + '┐'}
      </div>
      <div className="border-l border-r border-green-500/15 px-2 py-1 space-y-0.5">
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <span className="text-green-500/60 w-[80px] text-right">PROGRESS:</span>
          <span className="text-green-500/40">[</span>
          <span className="text-green-400">{'█'.repeat(filled)}</span>
          <span className="text-green-500/20">{'░'.repeat(empty)}</span>
          <span className="text-green-500/40">]</span>
          <span className="text-green-400">{progress.toFixed(0)}%</span>
          <span className="text-green-500/40">({completed_steps}/{total_steps})</span>
        </div>

        {/* Cost */}
        <div className="flex items-center gap-2">
          <span className="text-green-500/60 w-[80px] text-right">_unSC COST:</span>
          <span className="text-amber-400">{total_cost_unsc.toLocaleString()}</span>
          <span className="text-green-500/40">tokens</span>
        </div>

        {/* Time */}
        <div className="flex items-center gap-2">
          <span className="text-green-500/60 w-[80px] text-right">TIME EST:</span>
          <span className="text-cyan-400">{total_time_hours.toFixed(1)}h</span>
          <span className="text-green-500/40">research time</span>
        </div>
      </div>
      <div className="text-green-500/30 whitespace-pre">
        {'└' + '─'.repeat(62) + '┘'}
      </div>
    </div>
  )
}

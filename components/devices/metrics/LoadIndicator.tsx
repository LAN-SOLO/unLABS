'use client'

interface LoadIndicatorProps {
  load: number
  width?: number
}

export function LoadIndicator({ load, width = 20 }: LoadIndicatorProps) {
  const clamped = Math.max(0, Math.min(100, load))
  const filled = Math.round((clamped / 100) * width)
  const empty = width - filled

  const color =
    clamped <= 60 ? 'text-cyan-400' :
    clamped <= 80 ? 'text-amber-400' :
    'text-red-500'

  const dimColor =
    clamped <= 60 ? 'text-cyan-500/20' :
    clamped <= 80 ? 'text-amber-500/20' :
    'text-red-500/20'

  const warn = clamped > 90

  return (
    <span className="font-mono text-[10px] whitespace-pre">
      <span className="text-green-500/40">[</span>
      <span className={color}>{'▓'.repeat(filled)}</span>
      <span className={dimColor}>{'░'.repeat(empty)}</span>
      <span className="text-green-500/40">]</span>
      <span className={`${color} ml-1`}>{clamped.toFixed(0)}%</span>
      {warn && <span className="text-red-500 animate-pulse ml-1">HIGH</span>}
    </span>
  )
}

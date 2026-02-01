'use client'

interface HealthIndicatorProps {
  health: number
  width?: number
}

export function HealthIndicator({ health, width = 20 }: HealthIndicatorProps) {
  const clamped = Math.max(0, Math.min(100, health))
  const filled = Math.round((clamped / 100) * width)
  const empty = width - filled

  const color =
    clamped >= 80 ? 'text-green-400' :
    clamped >= 50 ? 'text-amber-400' :
    clamped >= 25 ? 'text-orange-400' :
    'text-red-500'

  const dimColor =
    clamped >= 80 ? 'text-green-500/20' :
    clamped >= 50 ? 'text-amber-500/20' :
    'text-red-500/20'

  return (
    <span className="font-mono text-[10px] whitespace-pre">
      <span className="text-green-500/40">[</span>
      <span className={color}>{'█'.repeat(filled)}</span>
      <span className={dimColor}>{'░'.repeat(empty)}</span>
      <span className="text-green-500/40">]</span>
      <span className={`${color} ml-1`}>{clamped.toFixed(0)}%</span>
    </span>
  )
}

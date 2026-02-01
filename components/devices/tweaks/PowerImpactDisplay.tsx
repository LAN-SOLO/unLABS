'use client'

interface PowerImpactDisplayProps {
  defaultPower: number
  currentPower: number
  delta: number
}

export function PowerImpactDisplay({ defaultPower, currentPower, delta }: PowerImpactDisplayProps) {
  const isWorse = delta > 0
  const isBetter = delta < 0
  const deltaColor = isBetter ? 'text-green-400' : isWorse ? 'text-red-400' : 'text-green-500/40'

  return (
    <div className="font-mono text-[10px]">
      <div className="text-green-500/30 whitespace-pre">
        {'┌─ '}<span className="text-green-500/60">POWER IMPACT</span>{' ' + '─'.repeat(48) + '┐'}
      </div>
      <div className="border-l border-r border-green-500/15 px-2 py-1 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="text-green-500/60">DEFAULT:</span>
          <span className="text-green-500/40">{defaultPower >= 0 ? '+' : ''}{defaultPower.toFixed(1)} E/s</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-green-500/60">CURRENT:</span>
          <span className="text-amber-400">{currentPower >= 0 ? '+' : ''}{currentPower.toFixed(1)} E/s</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-green-500/60">DELTA:</span>
          <span className={deltaColor}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)} E/s
            {isBetter && ' ▼'}
            {isWorse && ' ▲'}
          </span>
        </div>
      </div>
      <div className="text-green-500/30 whitespace-pre">
        {'└' + '─'.repeat(64) + '┘'}
      </div>
      {isWorse && Math.abs(delta) > 10 && (
        <div className="text-amber-400/80 text-[9px] mt-0.5 flex items-center gap-1">
          <span className="animate-pulse">&#9888;</span>
          SIGNIFICANT POWER INCREASE — CHECK HEADROOM
        </div>
      )}
    </div>
  )
}

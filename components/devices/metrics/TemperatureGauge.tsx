'use client'

interface TemperatureGaugeProps {
  temperature: number | null
  maxThreshold?: number
}

export function TemperatureGauge({ temperature, maxThreshold = 85 }: TemperatureGaugeProps) {
  if (temperature === null) {
    return (
      <span className="font-mono text-[10px] text-green-500/30 whitespace-pre">
        TEMP: --.-°C
      </span>
    )
  }

  const pct = Math.min(100, Math.max(0, (temperature / maxThreshold) * 100))
  const barWidth = 12
  const filled = Math.round((pct / 100) * barWidth)
  const empty = barWidth - filled

  const color =
    temperature < maxThreshold * 0.6 ? 'text-cyan-400' :
    temperature < maxThreshold * 0.8 ? 'text-amber-400' :
    'text-red-500'

  const warn = temperature >= maxThreshold * 0.9

  // ASCII thermometer
  return (
    <span className="font-mono text-[10px] whitespace-pre">
      <span className="text-green-500/60">TEMP:</span>
      <span className="text-green-500/40"> [</span>
      <span className={color}>{'█'.repeat(filled)}</span>
      <span className="text-green-500/15">{'░'.repeat(empty)}</span>
      <span className="text-green-500/40">]</span>
      <span className={`${color} ml-1`}>{temperature.toFixed(1)}°C</span>
      <span className="text-green-500/30">/{maxThreshold}°C</span>
      {warn && <span className="text-red-500 animate-pulse ml-1">&#9888;</span>}
    </span>
  )
}

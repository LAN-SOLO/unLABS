'use client'

interface DevicePowerChartProps {
  powerFull: number
  powerIdle: number
  powerStandby: number
  powerCurrent: number
}

const CHART_HEIGHT = 8
const CHART_WIDTH = 24

// Simulated 24h data from current power state
function generateBars(full: number, idle: number, current: number): number[] {
  const maxAbs = Math.max(Math.abs(full), 1)
  const bars: number[] = []
  // Generate a plausible 24h pattern: mostly idle, some full bursts
  for (let i = 0; i < CHART_WIDTH; i++) {
    const hour = i
    // Peak hours: 8-12, 14-18 → more load
    const isPeak = (hour >= 8 && hour <= 12) || (hour >= 14 && hour <= 18)
    const isNight = hour < 6 || hour > 22
    let value: number
    if (isNight) value = Math.abs(idle) * 0.8
    else if (isPeak) value = Math.abs(full) * (0.6 + Math.sin(hour * 0.8) * 0.3)
    else value = Math.abs(idle) + (Math.abs(full) - Math.abs(idle)) * 0.3
    bars.push(Math.min(1, value / maxAbs))
  }
  // Last bar = current
  bars[CHART_WIDTH - 1] = Math.min(1, Math.abs(current) / maxAbs)
  return bars
}

const BLOCK_CHARS = [' ', '░', '▒', '▓', '█']

export function DevicePowerChart({ powerFull, powerIdle, powerStandby, powerCurrent }: DevicePowerChartProps) {
  const isGenerator = powerFull > 0
  const bars = generateBars(powerFull, powerIdle, powerCurrent)
  const color = isGenerator ? 'text-green-400' : 'text-red-400/80'
  const dimColor = 'text-green-500/15'

  // Build rows top-down
  const rows: string[] = []
  for (let row = CHART_HEIGHT - 1; row >= 0; row--) {
    const threshold = (row + 1) / CHART_HEIGHT
    let line = ''
    for (let col = 0; col < CHART_WIDTH; col++) {
      const val = bars[col]
      if (val >= threshold) {
        // Filled
        const intensity = Math.min(4, Math.floor(val * 4))
        line += BLOCK_CHARS[intensity] || '█'
      } else if (val >= threshold - (1 / CHART_HEIGHT)) {
        // Partial
        line += '░'
      } else {
        line += ' '
      }
    }
    rows.push(line)
  }

  const maxLabel = Math.abs(powerFull).toFixed(0)
  const midLabel = (Math.abs(powerFull) / 2).toFixed(0)

  return (
    <div className="font-mono text-[10px] whitespace-pre">
      <div className="text-green-500/60 mb-0.5">
        24H POWER {isGenerator ? 'OUTPUT' : 'DRAW'} (E/s)
      </div>
      {/* Y-axis label + chart */}
      <div className="flex">
        <div className="flex flex-col justify-between text-green-500/40 text-right w-[36px] pr-1">
          <span>{maxLabel}</span>
          <span>{midLabel}</span>
          <span>0</span>
        </div>
        <div>
          <div className="text-green-500/30">{'┬'.repeat(CHART_WIDTH)}</div>
          {rows.map((row, i) => (
            <div key={i}>
              <span className="text-green-500/20">│</span>
              <span className={color}>{row}</span>
              <span className="text-green-500/20">│</span>
            </div>
          ))}
          <div className="text-green-500/30">{'┴'.repeat(CHART_WIDTH)}</div>
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex">
        <div className="w-[36px]" />
        <div className="text-green-500/40 flex justify-between" style={{ width: `${CHART_WIDTH}ch` }}>
          <span>0h</span>
          <span>12h</span>
          <span>NOW</span>
        </div>
      </div>
      {/* Legend */}
      <div className="text-green-500/40 mt-1 flex gap-4">
        <span>FULL: <span className={color}>{powerFull > 0 ? '+' : ''}{powerFull.toFixed(1)}</span></span>
        <span>IDLE: <span className="text-green-500/60">{powerIdle > 0 ? '+' : ''}{powerIdle.toFixed(1)}</span></span>
        <span>STBY: <span className="text-green-500/40">{powerStandby > 0 ? '+' : ''}{powerStandby.toFixed(1)}</span></span>
        <span>NOW: <span className="text-amber-400">{powerCurrent > 0 ? '+' : ''}{powerCurrent.toFixed(1)}</span></span>
      </div>
    </div>
  )
}

import type { CommandContext } from '@/lib/terminal/types'
import type { AppRegistryEntry } from '@/types/unapp'

type ModuleRenderer = (ctx: CommandContext, app: AppRegistryEntry) => string[]

function bar(value: number, max: number, width: number = 10): string {
  const filled = Math.round((value / max) * width)
  return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(width - filled, 0))
}

// ============================================================================
// Priority 1 — Core Lab
// ============================================================================

const uec001: Record<string, ModuleRenderer> = {
  'output-control': (ctx) => {
    const state = ctx.data.uecDevice?.getState()
    const output = state?.energyOutput ?? 0
    const pct = Math.min(Math.round((output / 60) * 100), 100)
    return [
      '  OUTPUT CONTROL',
      '  ─────────────────────────',
      `  Power Output: ${state?.isPowered ? `${output.toFixed(1)} E/s` : '0 E/s'}`,
      `  Throttle:     ${bar(pct, 100)} ${pct}%`,
      '  Mode:         STANDARD',
      `  Stability:    ${bar(state?.fieldStability ?? 0, 100)} ${state?.fieldStability ?? 0}%`,
    ]
  },
  'cascade-monitor': (ctx) => {
    const state = ctx.data.uecDevice?.getState()
    const stability = state?.fieldStability ?? 0
    const risk = stability > 80 ? 'LOW' : stability > 50 ? 'MODERATE' : stability > 25 ? 'HIGH' : 'CRITICAL'
    const riskColor = stability > 80 ? '●' : stability > 50 ? '◐' : '○'
    return [
      '  CASCADE MONITOR',
      '  ─────────────────────────',
      `  Field Stability:  ${bar(stability, 100)} ${stability}%`,
      `  Cascade Risk:     ${riskColor} ${risk}`,
      `  Volatility Tier:  T${state?.volatilityTier ?? '?'}`,
      `  TPS:              ${state?.tps ?? 0}`,
      `  Energy Output:    ${state?.energyOutput?.toFixed(1) ?? '0'} E/s`,
      '',
      '  Warning thresholds:',
      '  ├─ MODERATE  < 80% stability',
      '  ├─ HIGH      < 50% stability',
      '  └─ CRITICAL  < 25% stability',
    ]
  },
  'efficiency-analyzer': (ctx) => {
    const state = ctx.data.uecDevice?.getState()
    const specs = ctx.data.uecDevice?.getPowerSpecs()
    const output = state?.energyOutput ?? 0
    const max = specs?.outputMax ?? 60
    const eff = max > 0 ? Math.round((output / max) * 100) : 0
    return [
      '  EFFICIENCY ANALYZER',
      '  ─────────────────────────',
      `  Current Output:   ${output.toFixed(1)} E/s`,
      `  Maximum Output:   ${max} E/s`,
      `  Efficiency:       ${bar(eff, 100)} ${eff}%`,
      `  Self Consumption: ${specs?.selfConsume ?? 0}W`,
      `  Tier Bonus:       +${(specs?.outputPerTier ?? 0) * (state?.volatilityTier ?? 1)} E/s`,
    ]
  },
}

const cdc001: Record<string, ModuleRenderer> = {
  'storage-analytics': (ctx) => {
    const state = ctx.data.cdcDevice?.getState()
    return [
      '  STORAGE ANALYTICS',
      '  ─────────────────────────',
      `  Crystals:     ${state?.crystalCount ?? 0}`,
      `  Slices:       ${state?.sliceCount ?? 0}`,
      `  Power Draw:   ${state?.currentDraw ?? 0}W`,
      `  Capacity:     ${bar((state?.crystalCount ?? 0), 100, 20)} ${state?.crystalCount ?? 0}/100`,
    ]
  },
  'data-browser': (ctx) => {
    const state = ctx.data.cdcDevice?.getState()
    return [
      '  DATA BROWSER',
      '  ─────────────────────────',
      `  Total Crystals:  ${state?.crystalCount ?? 0}`,
      `  Total Slices:    ${state?.sliceCount ?? 0}`,
      '',
      '  Use "crystal list" for detailed crystal data.',
    ]
  },
  'archive-manager': () => {
    return [
      '  ARCHIVE MANAGER',
      '  ─────────────────────────',
      '  Archives:     0 active',
      '  Compression:  ZSTD-3',
      '  Auto-archive: ENABLED',
      '',
      '  No archived datasets.',
    ]
  },
  'io-monitor': (ctx) => {
    const state = ctx.data.cdcDevice?.getState()
    return [
      '  I/O MONITOR',
      '  ─────────────────────────',
      `  Read Rate:    ${state?.isPowered ? '12.4 MB/s' : '0 MB/s'}`,
      `  Write Rate:   ${state?.isPowered ? '8.7 MB/s' : '0 MB/s'}`,
      `  Queue Depth:  ${state?.isPowered ? '3' : '0'}`,
      `  Bus State:    ${state?.isPowered ? 'ACTIVE' : 'IDLE'}`,
    ]
  },
}

const btk001: Record<string, ModuleRenderer> = {
  'tool-inventory': (ctx) => {
    const state = ctx.data.btkDevice?.getState()
    return [
      '  TOOL INVENTORY',
      '  ─────────────────────────',
      `  Selected:     ${state?.selectedTool ?? 'None'}`,
      '  Available tools:',
      '  ├─ Soldering Iron    [READY]',
      '  ├─ Multimeter        [READY]',
      '  ├─ Oscilloscope Probe[READY]',
      '  ├─ Wire Stripper     [READY]',
      '  └─ Precision Tweezer [READY]',
    ]
  },
  'maintenance-schedule': () => {
    return [
      '  MAINTENANCE SCHEDULE',
      '  ─────────────────────────',
      '  Next calibration: 48h',
      '  Last maintenance: 12h ago',
      '  Tool condition:   GOOD',
      '',
      '  No upcoming maintenance tasks.',
    ]
  },
  'calibration-tracker': () => {
    return [
      '  CALIBRATION TRACKER',
      '  ─────────────────────────',
      '  All tools calibrated.',
      '  Last calibration: 2h ago',
      '  Accuracy drift:   0.02%',
    ]
  },
}

const pwr001: Record<string, ModuleRenderer> = {
  'power-routing': (ctx) => {
    const uec = ctx.data.uecDevice?.getState()
    return [
      '  POWER ROUTING',
      '  ─────────────────────────',
      `  Primary Source:  UEC-001 (${uec?.isPowered ? 'ONLINE' : 'OFFLINE'})`,
      `  Energy Supply:   ${uec?.energyOutput?.toFixed(1) ?? '0'} E/s`,
      '  Distribution:    AUTO',
      '  Priority Queue:  STANDARD',
    ]
  },
  'circuit-manager': () => {
    return [
      '  CIRCUIT MANAGER',
      '  ─────────────────────────',
      '  Active Circuits:  12',
      '  Breakers:         0 tripped',
      '  Load Factor:      72%',
      '  Redundancy:       N+1',
    ]
  },
  'load-balancing': () => {
    return [
      '  LOAD BALANCING',
      '  ─────────────────────────',
      '  Mode:            DYNAMIC',
      '  Balanced Nodes:  36',
      '  Imbalance:       2.1%',
      '  Efficiency:      97.8%',
    ]
  },
}

// ============================================================================
// Priority 2 — Active Gameplay
// ============================================================================

const p3d001: Record<string, ModuleRenderer> = {
  'print-queue': (ctx) => {
    const state = ctx.data.p3dDevice?.getState()
    return [
      '  PRINT QUEUE',
      '  ─────────────────────────',
      `  Progress:     ${bar(state?.progress ?? 0, 100)} ${state?.progress ?? 0}%`,
      `  Layer:        ${state?.layerCount ?? 0}`,
      `  Bed Temp:     ${state?.bedTemp ?? 0}°C`,
      `  Mode:         ${state?.displayMode?.toUpperCase() ?? 'PLASTIC'}`,
    ]
  },
  'material-library': () => ['  MATERIAL LIBRARY', '  ─────────────────────────', '  Loaded: 6 profiles', '  ├─ PLA Standard', '  ├─ ABS High-Temp', '  ├─ Crystal Composite', '  ├─ Nano-Carbon', '  ├─ Metal Alloy', '  └─ Prototype Mix'],
  'quality-presets': () => ['  QUALITY PRESETS', '  ─────────────────────────', '  [1] Draft      (0.3mm, fast)', '  [2] Standard   (0.2mm, balanced)', '  [3] Fine       (0.1mm, slow)', '  [4] Ultra-Fine (0.05mm, very slow)'],
  'model-viewer': () => ['  MODEL VIEWER', '  ─────────────────────────', '  No model loaded.', '  Use print-queue to start a job.'],
  'job-history': () => ['  JOB HISTORY', '  ─────────────────────────', '  No completed jobs.'],
}

const lct001: Record<string, ModuleRenderer> = {
  'beam-calibration': (ctx) => {
    const state = ctx.data.lctDevice?.getState()
    return [
      '  BEAM CALIBRATION',
      '  ─────────────────────────',
      `  Laser Power:  ${bar(state?.laserPower ?? 0, 100)} ${state?.laserPower ?? 0}%`,
      `  Precision:    ${bar(state?.precision ?? 0, 100)} ${state?.precision ?? 0}%`,
      `  Mode:         ${state?.displayMode?.toUpperCase() ?? 'CUTTING'}`,
    ]
  },
  'cutting-profiles': () => ['  CUTTING PROFILES', '  ─────────────────────────', '  [1] Precision Cut', '  [2] Deep Engrave', '  [3] Surface Mark', '  [4] Weld Joint'],
  'material-database': () => ['  MATERIAL DATABASE', '  ─────────────────────────', '  Known materials: 24', '  Last scan: 1h ago'],
  'burst-controller': () => ['  BURST CONTROLLER', '  ─────────────────────────', '  Burst Mode:   OFF', '  Pulse Rate:   100 Hz', '  Duration:     10ms'],
}

const hms001: Record<string, ModuleRenderer> = {
  'patch-editor': (ctx) => {
    const state = ctx.data.hmsDevice?.getState()
    return [
      '  PATCH EDITOR',
      '  ─────────────────────────',
      `  Waveform:     ${state?.waveformType?.toUpperCase() ?? 'SINE'}`,
      `  Frequency:    ${state?.freqValue ?? 440} Hz`,
      `  Pulse:        ${state?.pulseValue ?? 50}%`,
      `  Tempo:        ${state?.tempoValue ?? 120} BPM`,
    ]
  },
  'oscillator-bank': (ctx) => {
    const state = ctx.data.hmsDevice?.getState()
    return ['  OSCILLATOR BANK', '  ─────────────────────────', `  Active OSCs:  ${state?.oscillatorCount ?? 0}`, `  Tier:         T${state?.currentTier ?? 1}`]
  },
  'waveform-designer': () => ['  WAVEFORM DESIGNER', '  ─────────────────────────', '  Custom waveform editor.', '  Use patch-editor for basic editing.'],
  'preset-library': () => ['  PRESET LIBRARY', '  ─────────────────────────', '  Factory presets: 8', '  User presets:    0'],
  'resonance-mode': () => ['  RESONANCE MODE', '  ─────────────────────────', '  Resonance: OFF', '  Harmonic coupling: DISABLED'],
}

const ecr001: Record<string, ModuleRenderer> = {
  'session-manager': (ctx) => {
    const state = ctx.data.ecrDevice?.getState()
    return [
      '  SESSION MANAGER',
      '  ─────────────────────────',
      `  Recording:    ${state?.isRecording ? 'ACTIVE' : 'STOPPED'}`,
      `  Signal:       ${bar(state?.signalStrength ?? 0, 100)} ${state?.signalStrength ?? 0}%`,
      `  Ticker:       ${state?.tickerTap ?? 0}`,
    ]
  },
  'loop-editor': () => ['  LOOP EDITOR', '  ─────────────────────────', '  No loops recorded.'],
  'playback-controls': () => ['  PLAYBACK CONTROLS', '  ─────────────────────────', '  Status: STOPPED', '  Loop: OFF', '  Volume: 80%'],
  'sound-library': () => ['  SOUND LIBRARY', '  ─────────────────────────', '  Saved recordings: 0', '  Storage used: 0 KB'],
}

const exd001: Record<string, ModuleRenderer> = {
  'flight-planner': (ctx) => {
    const state = ctx.data.exdDevice?.getState()
    return [
      '  FLIGHT PLANNER',
      '  ─────────────────────────',
      `  Deployed:     ${state?.isDeployed ? 'YES' : 'NO'}`,
      `  Range:        ${state?.range ?? 0}m`,
      `  Battery:      ${bar(state?.battery ?? 0, 100)} ${state?.battery ?? 0}%`,
      `  Altitude:     ${state?.altitude ?? 0}m`,
    ]
  },
  'cargo-manager': (ctx) => {
    const state = ctx.data.exdDevice?.getState()
    return ['  CARGO MANAGER', '  ─────────────────────────', `  Cargo Load:   ${state?.cargoLoad ?? 0}%`, '  Manifest:     Empty']
  },
  'mission-log': () => ['  MISSION LOG', '  ─────────────────────────', '  No missions recorded.'],
  'exploration-map': () => ['  EXPLORATION MAP', '  ─────────────────────────', '  Mapped areas: 0', '  Discovery points: 0'],
  'high-speed-mode': (ctx) => {
    const state = ctx.data.exdDevice?.getState()
    return ['  HIGH-SPEED MODE', '  ─────────────────────────', `  Speed:     ${state?.speed ?? 0} m/s`, `  GPS Signal: ${bar(state?.gpsSignal ?? 0, 100)} ${state?.gpsSignal ?? 0}%`]
  },
}

const aic001: Record<string, ModuleRenderer> = {
  'model-manager': (ctx) => {
    const state = ctx.data.aicDevice?.getState()
    return [
      '  MODEL MANAGER',
      '  ─────────────────────────',
      `  Task Queue:   ${state?.taskQueue ?? 0}`,
      `  Efficiency:   ${bar(state?.efficiency ?? 0, 100)} ${state?.efficiency ?? 0}%`,
      `  Learning:     ${state?.isLearning ? 'ACTIVE' : 'IDLE'}`,
    ]
  },
  'inference-monitor': (ctx) => {
    const state = ctx.data.aicDevice?.getState()
    return ['  INFERENCE MONITOR', '  ─────────────────────────', `  Anomalies:    ${state?.anomalyCount ?? 0}`, `  Uptime:       ${state?.uptime ?? 0}s`]
  },
  'learning-analytics': () => ['  LEARNING ANALYTICS', '  ─────────────────────────', '  Training epochs: 0', '  Loss: N/A'],
  'persona-config': () => ['  PERSONA CONFIG', '  ─────────────────────────', '  Active persona: DEFAULT', '  Personality: NEUTRAL'],
}

// ============================================================================
// Priority 3 — Monitoring
// ============================================================================

const tmp001: Record<string, ModuleRenderer> = {
  'sensor-readings': (ctx) => {
    const state = ctx.data.tmpDevice?.getState()
    return ['  SENSOR READINGS', '  ─────────────────────────', `  Current:  ${state?.temperature ?? 0}°C`, `  Max:      ${state?.maxTemp ?? 0}°C`, `  Min:      ${state?.minTemp ?? 0}°C`]
  },
  'alert-thresholds': () => ['  ALERT THRESHOLDS', '  ─────────────────────────', '  Warning:  45°C', '  Critical: 60°C', '  Shutdown: 75°C'],
  'heatmap-display': () => ['  HEATMAP DISPLAY', '  ─────────────────────────', '  Heatmap data requires panel view.'],
  'history-charts': () => ['  HISTORY CHARTS', '  ─────────────────────────', '  Chart data requires panel view.'],
}

const cpu001: Record<string, ModuleRenderer> = {
  'core-loads': (ctx) => {
    const state = ctx.data.cpuDevice?.getState()
    const loads = state?.coreLoads ?? []
    const lines = ['  CORE LOADS', '  ─────────────────────────']
    loads.forEach((load: number, i: number) => {
      lines.push(`  Core ${i}: ${bar(load, 100)} ${load}%`)
    })
    if (loads.length === 0) lines.push('  No core data available.')
    return lines
  },
  'process-list': () => ['  PROCESS LIST', '  ─────────────────────────', '  PID  NAME           CPU%', '  1    init           0.1', '  42   unos-kernel    2.3', '  128  device-mgr     1.5'],
  'thread-analyzer': () => ['  THREAD ANALYZER', '  ─────────────────────────', '  Active threads: 24', '  Blocked: 0', '  Waiting: 3'],
  'performance-history': () => ['  PERFORMANCE HISTORY', '  ─────────────────────────', '  Chart data requires panel view.'],
}

const mem001: Record<string, ModuleRenderer> = {
  'usage-analytics': (ctx) => {
    const state = ctx.data.memDevice?.getState()
    const used = state?.usedMemory ?? 0
    const total = state?.totalMemory ?? 1
    const pct = Math.round((used / total) * 100)
    return ['  USAGE ANALYTICS', '  ─────────────────────────', `  Used:     ${bar(pct, 100)} ${pct}%`, `  Total:    ${total} MB`, `  Free:     ${total - used} MB`]
  },
  'allocation-map': () => ['  ALLOCATION MAP', '  ─────────────────────────', '  Map view requires panel display.'],
  'cache-stats': () => ['  CACHE STATS', '  ─────────────────────────', '  L1 Hit Rate: 98.2%', '  L2 Hit Rate: 94.7%', '  L3 Hit Rate: 88.1%'],
  'swap-monitor': () => ['  SWAP MONITOR', '  ─────────────────────────', '  Swap: 0 MB / 512 MB', '  Swappiness: 10'],
}

const net001: Record<string, ModuleRenderer> = {
  'traffic-analytics': (ctx) => {
    const state = ctx.data.netDevice?.getState()
    return ['  TRAFFIC ANALYTICS', '  ─────────────────────────', `  Bandwidth:    ${state?.bandwidth ?? 0} Mbps`, `  Latency:      ${state?.latencyMs ?? 0} ms`, `  Packet Loss:  ${state?.packetLoss ?? 0}%`]
  },
  'latency-monitor': (ctx) => {
    const state = ctx.data.netDevice?.getState()
    return ['  LATENCY MONITOR', '  ─────────────────────────', `  Current:  ${state?.latencyMs ?? 0} ms`, '  Average:  12 ms', '  Peak:     45 ms']
  },
  'peer-connections': (ctx) => {
    const state = ctx.data.netDevice?.getState()
    return ['  PEER CONNECTIONS', '  ─────────────────────────', `  Connected: ${state?.isConnected ? 'YES' : 'NO'}`, '  Peers: 3 active']
  },
  'bandwidth-usage': () => ['  BANDWIDTH USAGE', '  ─────────────────────────', '  In:  24.5 Mbps', '  Out: 12.1 Mbps'],
}

const clk001: Record<string, ModuleRenderer> = {
  'timer-management': (ctx) => {
    const state = ctx.data.clkDevice?.getState()
    return ['  TIMER MANAGEMENT', '  ─────────────────────────', `  Mode:       ${state?.displayMode ?? 'local'}`, `  Stopwatch:  ${state?.stopwatchRunning ? 'RUNNING' : 'STOPPED'} (${(state?.stopwatchTime ?? 0).toFixed(1)}s)`]
  },
  'alarm-scheduler': () => ['  ALARM SCHEDULER', '  ─────────────────────────', '  No alarms set.'],
  'time-sync': () => ['  TIME SYNC', '  ─────────────────────────', '  NTP Status: SYNCED', '  Drift: < 1ms', '  Source: pool.ntp.org'],
  'countdown-display': (ctx) => {
    const state = ctx.data.clkDevice?.getState()
    return ['  COUNTDOWN', '  ─────────────────────────', `  Running: ${state?.countdownRunning ? 'YES' : 'NO'}`, `  Time:    ${(state?.countdownTime ?? 0).toFixed(1)}s`]
  },
}

const vlt001: Record<string, ModuleRenderer> = {
  'voltage-readings': () => ['  VOLTAGE READINGS', '  ─────────────────────────', '  Main Bus:  48.2V', '  Logic:     3.3V', '  Aux:       12.1V'],
  'history-charts': () => ['  VOLTAGE HISTORY', '  ─────────────────────────', '  Chart data requires panel view.'],
  'alert-config': () => ['  ALERT CONFIG', '  ─────────────────────────', '  Undervolt:  < 44V', '  Overvolt:   > 52V', '  Spike:      > 5V/ms'],
  'calibration-tool': () => ['  CALIBRATION', '  ─────────────────────────', '  Last calibrated: 24h ago', '  Accuracy: ±0.01V'],
}

const pwd001: Record<string, ModuleRenderer> = {
  'flow-visualization': () => ['  POWER FLOW', '  ─────────────────────────', '  UEC → [BUS] → 36 devices', '  BAT → [BUS] (standby)'],
  'consumption-breakdown': () => ['  CONSUMPTION', '  ─────────────────────────', '  Compute:  42%', '  Thermal:  18%', '  Devices:  28%', '  Misc:     12%'],
  'custom-dashboards': () => ['  DASHBOARDS', '  ─────────────────────────', '  No custom dashboards.'],
  'history-viewer': () => ['  POWER HISTORY', '  ─────────────────────────', '  Chart data requires panel view.'],
}

const dim001: Record<string, ModuleRenderer> = {
  'stability-meter': (ctx) => {
    const state = ctx.data.dimDevice?.getState()
    return ['  STABILITY METER', '  ─────────────────────────', `  Stability:  ${bar(state?.stability ?? 0, 100)} ${state?.stability ?? 0}%`, `  Rift:       ${state?.riftActivity ?? 0}%`]
  },
  'rift-detection': (ctx) => {
    const state = ctx.data.dimDevice?.getState()
    return ['  RIFT DETECTION', '  ─────────────────────────', `  Activity:   ${state?.riftActivity ?? 0}%`, `  Fluctuation: ${state?.fluctuation ?? 0}%`]
  },
  'spatial-measurements': () => ['  SPATIAL MEASUREMENTS', '  ─────────────────────────', '  X: 0.000', '  Y: 0.000', '  Z: 0.000'],
  'drift-log': () => ['  DRIFT LOG', '  ─────────────────────────', '  No drift events recorded.'],
}

const dgn001: Record<string, ModuleRenderer> = {
  'test-profiles': (ctx) => {
    const state = ctx.data.dgnDevice?.getState()
    return ['  TEST PROFILES', '  ─────────────────────────', `  Category:   ${state?.category ?? 'SYSTEMS'}`, `  Scan Depth: ${state?.scanDepth ?? 75}%`, `  Health:     ${bar(state?.healthPercent ?? 0, 100)} ${state?.healthPercent ?? 0}%`]
  },
  'health-reports': (ctx) => {
    const state = ctx.data.dgnDevice?.getState()
    return ['  HEALTH REPORTS', '  ─────────────────────────', `  Overall:  ${state?.healthPercent ?? 0}%`, `  Alerts:   ${state?.alertCount ?? 0}`]
  },
  'repair-wizard': () => ['  REPAIR WIZARD', '  ─────────────────────────', '  No repairs needed.'],
  'component-viewer': () => ['  COMPONENT VIEWER', '  ─────────────────────────', '  36 device components registered.'],
}

const thm001: Record<string, ModuleRenderer> = {
  'zone-mapping': () => ['  ZONE MAPPING', '  ─────────────────────────', '  Zone A (Compute): 38°C', '  Zone B (Power):   42°C', '  Zone C (Storage): 31°C'],
  'cooling-control': () => ['  COOLING CONTROL', '  ─────────────────────────', '  Mode: AUTO', '  Fan Speed: 60%', '  Coolant Flow: NORMAL'],
  'heat-distribution': () => ['  HEAT DISTRIBUTION', '  ─────────────────────────', '  Heatmap requires panel view.'],
  'thermal-alerts': () => ['  THERMAL ALERTS', '  ─────────────────────────', '  No active thermal alerts.'],
}

const vnt001: Record<string, ModuleRenderer> = {
  'airflow-control': (ctx) => {
    const state = ctx.data.vntDevice?.getState()
    return ['  AIRFLOW CONTROL', '  ─────────────────────────', `  CPU Fan: ${state?.cpuFan?.rpm ?? 0} RPM (${state?.cpuFan?.mode ?? 'AUTO'})`, `  GPU Fan: ${state?.gpuFan?.rpm ?? 0} RPM (${state?.gpuFan?.mode ?? 'AUTO'})`]
  },
  'filter-status': (ctx) => {
    const state = ctx.data.vntDevice?.getState()
    return ['  FILTER STATUS', '  ─────────────────────────', `  Health:     ${bar(state?.filterHealth ?? 0, 100)} ${state?.filterHealth ?? 0}%`, `  Air Quality: ${state?.airQuality ?? 0}%`]
  },
  'environment-readings': (ctx) => {
    const state = ctx.data.vntDevice?.getState()
    return ['  ENVIRONMENT', '  ─────────────────────────', `  CPU Temp:   ${state?.cpuTemp ?? 0}°C`, `  GPU Temp:   ${state?.gpuTemp ?? 0}°C`, `  Humidity:   ${state?.humidity ?? 0}%`]
  },
  'zone-manager': () => ['  ZONE MANAGER', '  ─────────────────────────', '  All zones: AUTO mode'],
}

// ============================================================================
// Priority 4 — Advanced
// ============================================================================

const mfr001: Record<string, ModuleRenderer> = {
  'plasma-containment': (ctx) => {
    const state = ctx.data.mfrDevice?.getState()
    return ['  PLASMA CONTAINMENT', '  ─────────────────────────', `  Stability:  ${bar(state?.stability ?? 0, 100)} ${state?.stability ?? 0}%`, `  Plasma Temp: ${state?.plasmaTemp ?? 0}°K`]
  },
  'ignition-control': () => ['  IGNITION CONTROL', '  ─────────────────────────', '  Ignition: STANDBY', '  Fuel: READY'],
  'fusion-metrics': (ctx) => {
    const state = ctx.data.mfrDevice?.getState()
    return ['  FUSION METRICS', '  ─────────────────────────', `  Output:     ${state?.powerOutput ?? 0}W`, `  Efficiency: ${bar(state?.efficiency ?? 0, 100)} ${state?.efficiency ?? 0}%`, `  Ring Speed: ${state?.ringSpeed ?? 0} RPM`]
  },
  'thermal-link': () => ['  THERMAL LINK', '  ─────────────────────────', '  Linked to THM-001', '  Heat transfer: NOMINAL'],
}

const sca001: Record<string, ModuleRenderer> = {
  'job-manager': (ctx) => {
    const state = ctx.data.scaDevice?.getState()
    return ['  JOB MANAGER', '  ─────────────────────────', `  Queue:      ${state?.jobQueue ?? 0} jobs`, `  Active:     ${state?.activeNodes ?? 0} nodes`]
  },
  'core-allocator': (ctx) => {
    const state = ctx.data.scaDevice?.getState()
    return ['  CORE ALLOCATOR', '  ─────────────────────────', `  Utilization: ${bar(state?.utilization ?? 0, 100)} ${state?.utilization ?? 0}%`, `  FLOPS:       ${state?.flops ?? 0} TFLOPS`]
  },
  'benchmark-suite': () => ['  BENCHMARK SUITE', '  ─────────────────────────', '  Last benchmark: N/A', '  Run: undev SCA-001 test'],
  'cluster-monitor': (ctx) => {
    const state = ctx.data.scaDevice?.getState()
    return ['  CLUSTER MONITOR', '  ─────────────────────────', `  Nodes:      ${state?.activeNodes ?? 0}`, `  Memory:     ${bar(state?.memoryUsage ?? 0, 100)} ${state?.memoryUsage ?? 0}%`, `  Bandwidth:  ${state?.interconnectBandwidth ?? 0} GB/s`]
  },
}

const qan001: Record<string, ModuleRenderer> = {
  'analysis-queue': (ctx) => {
    const state = ctx.data.quaDevice?.getState()
    return ['  ANALYSIS QUEUE', '  ─────────────────────────', `  Mode:        ${state?.mode ?? 'SCAN'}`, `  Coherence:   ${bar(state?.coherence ?? 0, 100)} ${state?.coherence ?? 0}%`]
  },
  'state-viewer': () => ['  STATE VIEWER', '  ─────────────────────────', '  Quantum state visualization requires panel.'],
  'measurement-history': () => ['  MEASUREMENT HISTORY', '  ─────────────────────────', '  No measurements recorded.'],
  'entanglement-map': () => ['  ENTANGLEMENT MAP', '  ─────────────────────────', '  No entangled pairs detected.'],
}

const qsm001: Record<string, ModuleRenderer> = {
  'coherence-tracker': (ctx) => {
    const state = ctx.data.qsmDevice?.getState()
    return ['  COHERENCE TRACKER', '  ─────────────────────────', `  Coherence:  ${bar(state?.coherence ?? 0, 100)} ${state?.coherence ?? 0}%`, `  Qubits:     ${state?.qubits ?? 0}`, `  Error Rate: ${state?.errorRate ?? 0}%`]
  },
  'decoherence-alerts': () => ['  DECOHERENCE ALERTS', '  ─────────────────────────', '  No active alerts.'],
  'state-history': () => ['  STATE HISTORY', '  ─────────────────────────', '  No state transitions logged.'],
  'prediction-model': () => ['  PREDICTION MODEL', '  ─────────────────────────', '  Model: OFFLINE', '  Requires training data.'],
}

const emc001: Record<string, ModuleRenderer> = {
  'field-integrity': (ctx) => {
    const state = ctx.data.emcDevice?.getState()
    return ['  FIELD INTEGRITY', '  ─────────────────────────', `  Field:      ${bar(state?.fieldStrength ?? 0, 100)} ${state?.fieldStrength ?? 0}%`, `  Contained:  ${state?.isContained ? 'YES' : 'NO'}`, `  Stability:  ${bar(state?.stability ?? 0, 100)} ${state?.stability ?? 0}%`]
  },
  'breach-protocol': () => ['  BREACH PROTOCOL', '  ─────────────────────────', '  Status: ARMED', '  Auto-seal: ENABLED', '  Last breach: NEVER'],
  'sample-manager': (ctx) => {
    const state = ctx.data.emcDevice?.getState()
    return ['  SAMPLE MANAGER', '  ─────────────────────────', `  Units:     ${state?.units ?? 0}`, `  Temp:      ${state?.temperature ?? 0}°K`]
  },
  'safety-interlock': () => ['  SAFETY INTERLOCK', '  ─────────────────────────', '  All interlocks: ENGAGED', '  Override: LOCKED'],
}

const tlp001: Record<string, ModuleRenderer> = {
  'coordinate-manager': (ctx) => {
    const state = ctx.data.tlpDevice?.getState()
    return ['  COORDINATE MANAGER', '  ─────────────────────────', `  Last Dest:  ${state?.lastDestination ?? 'None'}`, `  Charge:     ${bar(state?.chargeLevel ?? 0, 100)} ${state?.chargeLevel ?? 0}%`]
  },
  'teleport-history': () => ['  TELEPORT HISTORY', '  ─────────────────────────', '  No teleport events.'],
  'energy-calculator': () => ['  ENERGY CALCULATOR', '  ─────────────────────────', '  Base cost: 50 E', '  Distance multiplier: 1.0x'],
  'safety-interlock': () => ['  SAFETY INTERLOCK', '  ─────────────────────────', '  All interlocks: ENGAGED'],
}

const and001: Record<string, ModuleRenderer> = {
  'scanner-interface': (ctx) => {
    const state = ctx.data.andDevice?.getState()
    return ['  SCANNER INTERFACE', '  ─────────────────────────', `  Signal:     ${bar(state?.signalStrength ?? 0, 100)} ${state?.signalStrength ?? 0}%`, `  Anomalies:  ${state?.anomaliesFound ?? 0}`, `  Mode:       ${state?.displayMode ?? 'waveform'}`]
  },
  'detection-map': () => ['  DETECTION MAP', '  ─────────────────────────', '  Map requires panel display.'],
  'alert-config': () => ['  ALERT CONFIG', '  ─────────────────────────', '  Threshold: MEDIUM', '  Auto-scan: ON'],
  'anomaly-database': () => ['  ANOMALY DATABASE', '  ─────────────────────────', '  Known patterns: 12', '  Unclassified: 0'],
  'deep-scan': () => ['  DEEP SCAN', '  ─────────────────────────', '  Deep scan: IDLE', '  Use undev AND-001 test to initiate.'],
}

const rmg001: Record<string, ModuleRenderer> = {
  'pull-radius': (ctx) => {
    const state = ctx.data.rmgDevice?.getState()
    return ['  PULL RADIUS', '  ─────────────────────────', `  Strength:  ${bar(state?.strength ?? 0, 100)} ${state?.strength ?? 0}%`, `  Field:     ${state?.fieldActive ? 'ACTIVE' : 'INACTIVE'}`]
  },
  'collection-stats': () => ['  COLLECTION STATS', '  ─────────────────────────', '  Collected: 0 units', '  Rate: 0/min'],
  'material-filter': () => ['  MATERIAL FILTER', '  ─────────────────────────', '  Filter: ALL', '  No exclusions set.'],
  'efficiency-optimizer': () => ['  EFFICIENCY OPTIMIZER', '  ─────────────────────────', '  Mode: AUTO', '  Efficiency: 95%'],
}

const qcp001: Record<string, ModuleRenderer> = {
  'bearing-readings': (ctx) => {
    const state = ctx.data.qcpDevice?.getState()
    return ['  BEARING READINGS', '  ─────────────────────────', `  Direction:  ${state?.anomalyDirection ?? 0}°`, `  Distance:   ${state?.anomalyDistance ?? 0}m`, `  Mode:       ${state?.displayMode ?? 'compass'}`]
  },
  'anomaly-proximity': (ctx) => {
    const state = ctx.data.qcpDevice?.getState()
    return ['  ANOMALY PROXIMITY', '  ─────────────────────────', `  Nearest: ${state?.anomalyDistance ?? 0}m at ${state?.anomalyDirection ?? 0}°`]
  },
  'navigation-mode': () => ['  NAVIGATION MODE', '  ─────────────────────────', '  Nav mode: STANDARD', '  Waypoints: 0'],
  'waypoint-manager': () => ['  WAYPOINT MANAGER', '  ─────────────────────────', '  No waypoints saved.'],
}

const osc001: Record<string, ModuleRenderer> = {
  'waveform-display': () => ['  WAVEFORM DISPLAY', '  ─────────────────────────', '  Waveform requires panel view.'],
  'trigger-settings': () => ['  TRIGGER SETTINGS', '  ─────────────────────────', '  Mode: AUTO', '  Level: 50%', '  Edge: RISING'],
  'measurement-tools': () => ['  MEASUREMENT TOOLS', '  ─────────────────────────', '  Cursors: OFF', '  Auto-measure: ON'],
  'capture-export': () => ['  CAPTURE EXPORT', '  ─────────────────────────', '  No captures saved.'],
}

const bat001: Record<string, ModuleRenderer> = {
  'charge-manager': (ctx) => {
    const state = ctx.data.batDevice?.getState()
    return ['  CHARGE MANAGER', '  ─────────────────────────', `  Charge:     ${bar(state?.chargePercent ?? 0, 100)} ${state?.chargePercent ?? 0}%`, `  Charging:   ${state?.isCharging ? 'YES' : 'NO'}`, `  Auto-Regen: ${state?.autoRegen ? 'ON' : 'OFF'}`]
  },
  'cell-health': (ctx) => {
    const state = ctx.data.batDevice?.getState()
    const cells = state?.cellHealth ?? []
    const lines = ['  CELL HEALTH', '  ─────────────────────────']
    cells.forEach((h: number, i: number) => lines.push(`  Cell ${i + 1}: ${bar(h, 100)} ${h}%`))
    if (cells.length === 0) lines.push('  No cell data.')
    return lines
  },
  'field-mode': () => ['  FIELD MODE', '  ─────────────────────────', '  Mode: STANDARD', '  Emergency reserve: 10%'],
}

const int001: Record<string, ModuleRenderer> = {
  'algorithm-selector': (ctx) => {
    const state = ctx.data.iplDevice?.getState()
    return ['  ALGORITHM SELECTOR', '  ─────────────────────────', `  Accuracy:   ${bar(state?.interpolationAccuracy ?? 0, 100)} ${state?.interpolationAccuracy ?? 0}%`, `  Streams:    ${state?.inputStreams ?? 0}`]
  },
  'data-pipeline': () => ['  DATA PIPELINE', '  ─────────────────────────', '  Pipeline: IDLE', '  Buffer: EMPTY'],
  'processing-queue': () => ['  PROCESSING QUEUE', '  ─────────────────────────', '  Queue: 0 jobs'],
  'visualization': () => ['  VISUALIZATION', '  ─────────────────────────', '  Visualization requires panel view.'],
}

const atk001: Record<string, ModuleRenderer> = {
  'tank-levels': () => ['  TANK LEVELS', '  ─────────────────────────', '  Primary:   ' + bar(45, 100) + ' 45%', '  Secondary: ' + bar(20, 100) + ' 20%'],
  'transfer-controls': () => ['  TRANSFER CONTROLS', '  ─────────────────────────', '  Intake: OPEN', '  Output: CLOSED', '  Flow rate: 0 L/min'],
  'purity-monitor': () => ['  PURITY MONITOR', '  ─────────────────────────', '  Purity: 99.7%', '  Contaminants: TRACE'],
  'flow-analytics': () => ['  FLOW ANALYTICS', '  ─────────────────────────', '  Throughput: 0 L/h', '  Pressure: NOMINAL'],
}

const spk001: Record<string, ModuleRenderer> = {
  'channel-routing': (ctx) => {
    const state = ctx.data.spkDevice?.getState()
    return ['  CHANNEL ROUTING', '  ─────────────────────────', `  Volume:  ${bar(state?.volume ?? 0, 100)} ${state?.volume ?? 0}%`, `  Muted:   ${state?.isMuted ? 'YES' : 'NO'}`]
  },
  'equalizer': (ctx) => {
    const state = ctx.data.spkDevice?.getState()
    const f = state?.filters ?? { bass: true, mid: true, high: true }
    return ['  EQUALIZER', '  ─────────────────────────', `  Bass:  ${f.bass ? 'ON' : 'OFF'}`, `  Mid:   ${f.mid ? 'ON' : 'OFF'}`, `  High:  ${f.high ? 'ON' : 'OFF'}`]
  },
  'volume-control': (ctx) => {
    const state = ctx.data.spkDevice?.getState()
    return ['  VOLUME CONTROL', '  ─────────────────────────', `  Level: ${bar(state?.volume ?? 0, 100)} ${state?.volume ?? 0}%`]
  },
  'frequency-response': () => ['  FREQUENCY RESPONSE', '  ─────────────────────────', '  Response curve requires panel view.'],
}

const msc001: Record<string, ModuleRenderer> = {
  'scan-interface': (ctx) => {
    const state = ctx.data.mscDevice?.getState()
    return ['  SCAN INTERFACE', '  ─────────────────────────', `  Scan Line:  ${state?.scanLine ?? 0}`, `  Detected:   ${state?.detectedMaterials ?? 0} materials`]
  },
  'material-database': () => ['  MATERIAL DATABASE', '  ─────────────────────────', '  Known: 48 materials', '  Last update: system boot'],
  'analysis-results': () => ['  ANALYSIS RESULTS', '  ─────────────────────────', '  No recent scans.'],
  'composition-log': () => ['  COMPOSITION LOG', '  ─────────────────────────', '  Log entries: 0'],
}

// ============================================================================
// Priority 5 — System/Utility Apps
// ============================================================================

const sysLab: Record<string, ModuleRenderer> = {
  'overview': (ctx) => {
    const uec = ctx.data.uecDevice?.getState()
    return [
      '  LAB OVERVIEW',
      '  ─────────────────────────',
      `  Energy:     ${uec?.energyOutput?.toFixed(1) ?? '0'} E/s`,
      `  Devices:    36 registered`,
      `  Status:     ${uec?.isPowered ? 'OPERATIONAL' : 'LOW POWER'}`,
    ]
  },
  'resource-summary': () => ['  RESOURCE SUMMARY', '  ─────────────────────────', '  Use "res list" for detailed resource data.'],
  'activity-feed': () => ['  ACTIVITY FEED', '  ─────────────────────────', '  No recent activity.'],
  'quick-actions': () => ['  QUICK ACTIONS', '  ─────────────────────────', '  [1] Run diagnostics (undev DGN-001 test)', '  [2] Check power (unapp run PWR-001)', '  [3] View inventory (crystal list)'],
}

const sysPwr: Record<string, ModuleRenderer> = {
  'grid-overview': (ctx) => {
    const uec = ctx.data.uecDevice?.getState()
    return ['  POWER GRID OVERVIEW', '  ─────────────────────────', `  Primary:    UEC-001 (${uec?.isPowered ? 'ONLINE' : 'OFFLINE'})`, `  Output:     ${uec?.energyOutput?.toFixed(1) ?? '0'} E/s`]
  },
  'load-planner': () => ['  LOAD PLANNER', '  ─────────────────────────', '  Total load: NOMINAL', '  Headroom: 35%'],
  'emergency-controls': () => ['  EMERGENCY CONTROLS', '  ─────────────────────────', '  All systems: NORMAL', '  Emergency shutdown: ARMED'],
  'power-history': () => ['  POWER HISTORY', '  ─────────────────────────', '  Chart data requires panel view.'],
}

const sysRes: Record<string, ModuleRenderer> = {
  'tree-browser': () => ['  TECH TREE BROWSER', '  ─────────────────────────', '  Use "research" command for full tree.'],
  'active-research': () => ['  ACTIVE RESEARCH', '  ─────────────────────────', '  No active research.'],
  'queue-manager': () => ['  RESEARCH QUEUE', '  ─────────────────────────', '  Queue: empty'],
  'unlock-preview': () => ['  UNLOCK PREVIEW', '  ─────────────────────────', '  Use "research" to see available unlocks.'],
}

const sysInv: Record<string, ModuleRenderer> = {
  'crystal-browser': () => ['  CRYSTAL BROWSER', '  ─────────────────────────', '  Use "crystal list" for crystal data.'],
  'slice-organizer': () => ['  SLICE ORGANIZER', '  ─────────────────────────', '  Use "inv" for inventory.'],
  'collection-stats': () => ['  COLLECTION STATS', '  ─────────────────────────', '  Use "inv" for stats.'],
  'trade-helper': () => ['  TRADE HELPER', '  ─────────────────────────', '  Trading: NOT AVAILABLE'],
}

const utlLog: Record<string, ModuleRenderer> = {
  'system-logs': () => ['  SYSTEM LOGS', '  ─────────────────────────', '  Use "history" for command history.'],
  'device-logs': () => ['  DEVICE LOGS', '  ─────────────────────────', '  No device logs available.'],
  'search-engine': () => ['  LOG SEARCH', '  ─────────────────────────', '  Use "history" with search term.'],
  'export-tool': () => ['  EXPORT TOOL', '  ─────────────────────────', '  Export: NOT AVAILABLE'],
}

const utlCfg: Record<string, ModuleRenderer> = {
  'config-browser': () => ['  CONFIG BROWSER', '  ─────────────────────────', '  Use "unsyspref" for system preferences.'],
  'validation': () => ['  VALIDATION', '  ─────────────────────────', '  All configs: VALID'],
  'backup-restore': () => ['  BACKUP/RESTORE', '  ─────────────────────────', '  Use UTL-BAK for backups.'],
}

const utlBak: Record<string, ModuleRenderer> = {
  'manual-backup': () => ['  MANUAL BACKUP', '  ─────────────────────────', '  No backup targets configured.'],
  'scheduled-backups': () => ['  SCHEDULED BACKUPS', '  ─────────────────────────', '  No schedules set.'],
  'restore-points': () => ['  RESTORE POINTS', '  ─────────────────────────', '  No restore points available.'],
}

// ============================================================================
// Registry
// ============================================================================

const APP_MODULES: Record<string, Record<string, ModuleRenderer>> = {
  'UEC-001': uec001,
  'CDC-001': cdc001,
  'BTK-001': btk001,
  'PWR-001': pwr001,
  'BAT-001': bat001,
  'P3D-001': p3d001,
  'LCT-001': lct001,
  'HMS-001': hms001,
  'ECR-001': ecr001,
  'EXD-001': exd001,
  'AIC-001': aic001,
  'MFR-001': mfr001,
  'SCA-001': sca001,
  'QAN-001': qan001,
  'QSM-001': qsm001,
  'EMC-001': emc001,
  'TLP-001': tlp001,
  'AND-001': and001,
  'RMG-001': rmg001,
  'QCP-001': qcp001,
  'OSC-001': osc001,
  'TMP-001': tmp001,
  'CPU-001': cpu001,
  'MEM-001': mem001,
  'NET-001': net001,
  'CLK-001': clk001,
  'VLT-001': vlt001,
  'PWD-001': pwd001,
  'DIM-001': dim001,
  'DGN-001': dgn001,
  'THM-001': thm001,
  'VNT-001': vnt001,
  'SPK-001': spk001,
  'MSC-001': msc001,
  'INT-001': int001,
  'ATK-001': atk001,
  // System apps
  'SYS-LAB': sysLab,
  'SYS-PWR': sysPwr,
  'SYS-RES': sysRes,
  'SYS-INV': sysInv,
  // Utility apps
  'UTL-LOG': utlLog,
  'UTL-CFG': utlCfg,
  'UTL-BAK': utlBak,
}

export function getDeviceModules(appId: string): Record<string, ModuleRenderer> | null {
  return APP_MODULES[appId] ?? null
}

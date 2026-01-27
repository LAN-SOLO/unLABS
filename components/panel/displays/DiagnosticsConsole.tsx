'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { LED } from '../controls/LED'
import { Knob } from '../controls/Knob'

interface DiagnosticsConsoleProps {
  className?: string
}

type DiagnosticCategory = 'SYSTEMS' | 'DEVICES' | 'ENERGY' | 'NETWORK' | 'CRYSTALS' | 'PROCESS'

interface ComponentStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'warning' | 'critical' | 'standby' | 'testing'
  value?: string
  detail?: string
  tier?: number
}

interface AlertEntry {
  id: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: Date
  category: DiagnosticCategory
}

// Simulated lab systems for diagnostics
const LAB_SYSTEMS: Record<DiagnosticCategory, ComponentStatus[]> = {
  SYSTEMS: [
    { id: 'sys-os', name: '_unOS Kernel', status: 'online', value: 'v4.2.1', detail: 'Primary operating system' },
    { id: 'sys-und', name: '_und Daemon', status: 'online', value: 'PID 2847', detail: 'Main game process' },
    { id: 'sys-terminal', name: 'Lab Terminal', status: 'online', value: 'Active', detail: 'Command interface', tier: 1 },
    { id: 'sys-cache', name: 'Crystal Data Cache', status: 'online', value: '2.4 GB', detail: 'Research archive', tier: 1 },
    { id: 'sys-computer', name: 'Supercomputer', status: 'online', value: '87% LOAD', detail: 'Compute array', tier: 3 },
    { id: 'sys-ai', name: 'AI Assistant', status: 'standby', value: 'Queue: 0', detail: 'Task automation', tier: 2 },
    { id: 'sys-overseer', name: 'AI Overseer', status: 'offline', value: 'Locked', detail: 'Requires Tier 4', tier: 4 },
    { id: 'sys-quantum', name: 'Quantum Core', status: 'online', value: '99.9%', detail: 'Coherence level' },
  ],
  DEVICES: [
    { id: 'dev-reactor', name: 'Microfusion Reactor', status: 'online', value: '85% EFF', detail: 'Power generation', tier: 1 },
    { id: 'dev-core', name: 'Energy Core', status: 'online', value: '12.5 MW', detail: 'Output capacity', tier: 1 },
    { id: 'dev-battery', name: 'Battery Pack', status: 'online', value: '100%', detail: 'Backup power', tier: 1 },
    { id: 'dev-synth', name: 'Synthesizer', status: 'online', value: 'Ready', detail: 'Material creation', tier: 2 },
    { id: 'dev-forge', name: 'Alloy Forge', status: 'warning', value: 'HOT', detail: 'Temperature high', tier: 2 },
    { id: 'dev-fab', name: '3D Fabricator', status: 'online', value: 'Idle', detail: 'Component printing', tier: 2 },
    { id: 'dev-laser', name: 'Precision Laser', status: 'online', value: 'Calibrated', detail: 'Crystal cutting', tier: 3 },
    { id: 'dev-singularity', name: 'Singularity Core', status: 'offline', value: 'Locked', detail: 'Requires Tier 5', tier: 5 },
  ],
  ENERGY: [
    { id: 'nrg-input', name: 'Power Input', status: 'online', value: '42.3 kW', detail: 'Total draw' },
    { id: 'nrg-output', name: 'Power Output', status: 'online', value: '12.5 MW', detail: 'Generation rate' },
    { id: 'nrg-storage', name: 'Energy Buffer', status: 'online', value: '847 MWh', detail: 'Reserve capacity' },
    { id: 'nrg-grid', name: 'Distribution Grid', status: 'online', value: '98.7%', detail: 'Efficiency rating' },
    { id: 'nrg-solar', name: 'Solar Array', status: 'standby', value: 'Night', detail: 'Charging disabled' },
    { id: 'nrg-fuel', name: 'Fusion Fuel', status: 'online', value: '340 units', detail: 'Remaining supply' },
    { id: 'nrg-waste', name: 'Waste Heat', status: 'warning', value: '67°C', detail: 'Above optimal' },
    { id: 'nrg-quantum', name: 'Quantum Flux', status: 'online', value: '1.23 σ', detail: 'Stability metric' },
  ],
  NETWORK: [
    { id: 'net-solana', name: 'Solana Devnet', status: 'online', value: '2847 TPS', detail: 'Blockchain connection' },
    { id: 'net-rpc', name: 'RPC Endpoint', status: 'online', value: '24ms', detail: 'Response latency' },
    { id: 'net-chain', name: '_unchain Service', status: 'online', value: 'Synced', detail: 'Block: 284729103' },
    { id: 'net-tick', name: '_untick Daemon', status: 'online', value: '60 Hz', detail: 'Volatility feed' },
    { id: 'net-comm', name: 'Quantum Comm', status: 'online', value: 'Encrypted', detail: 'Secure channel', tier: 2 },
    { id: 'net-hub', name: 'Omni-Link Hub', status: 'offline', value: 'Locked', detail: 'Requires Tier 4', tier: 4 },
    { id: 'net-market', name: 'Trade Server', status: 'online', value: 'Connected', detail: 'Marketplace link' },
    { id: 'net-firewall', name: 'Security Layer', status: 'online', value: 'MAXIMUM', detail: 'Threat level: 0' },
  ],
  CRYSTALS: [
    { id: 'cry-assembly', name: 'Assembly Bay', status: 'online', value: 'Ready', detail: 'Slice combining' },
    { id: 'cry-disasm', name: 'Disassembly Unit', status: 'standby', value: 'Idle', detail: 'Slice extraction' },
    { id: 'cry-scanner', name: 'Crystal Scanner', status: 'online', value: 'Calibrated', detail: 'Trait analysis' },
    { id: 'cry-stabilizer', name: 'Stabilization Field', status: 'online', value: '99.2%', detail: 'Prevents decay' },
    { id: 'cry-storage', name: 'Crystal Vault', status: 'online', value: '3/50', detail: 'Capacity used' },
    { id: 'cry-resonance', name: 'Resonance Chamber', status: 'online', value: 'Harmonic', detail: 'Frequency lock', tier: 2 },
    { id: 'cry-enhancer', name: 'Power Enhancer', status: 'warning', value: 'Cooling', detail: 'Overheat recovery', tier: 3 },
    { id: 'cry-quantum', name: 'Quantum Entangler', status: 'offline', value: 'Locked', detail: 'Requires Tier 4', tier: 4 },
  ],
  PROCESS: [
    { id: 'proc-research', name: 'Active Research', status: 'online', value: '3 jobs', detail: 'Tech tree progress' },
    { id: 'proc-mining', name: 'Resource Mining', status: 'online', value: '+2.4/s', detail: 'Abstractum rate' },
    { id: 'proc-refining', name: 'Material Refining', status: 'online', value: '12/hr', detail: 'Alloy production' },
    { id: 'proc-synthesis', name: 'Nano Synthesis', status: 'standby', value: 'Paused', detail: 'Awaiting input' },
    { id: 'proc-simulation', name: 'Sim Engine', status: 'online', value: '10K/s', detail: 'Iterations rate' },
    { id: 'proc-scan', name: 'Deep Scanner', status: 'online', value: 'Sector 7', detail: 'Area mapping' },
    { id: 'proc-automation', name: 'Auto-Tasks', status: 'online', value: '8 active', detail: 'Background jobs' },
    { id: 'proc-backup', name: 'Data Backup', status: 'online', value: 'Last: 5m', detail: 'State preservation' },
  ],
}

const CATEGORY_CONFIGS: Record<DiagnosticCategory, { color: string; icon: string; description: string }> = {
  SYSTEMS: { color: 'var(--neon-cyan)', icon: '⬡', description: 'Core system services & daemons' },
  DEVICES: { color: 'var(--neon-amber)', icon: '⚙', description: 'Lab equipment & machinery' },
  ENERGY: { color: 'var(--neon-lime)', icon: '⚡', description: 'Power generation & distribution' },
  NETWORK: { color: 'var(--neon-purple)', icon: '◎', description: 'Blockchain & communications' },
  CRYSTALS: { color: 'var(--neon-pink)', icon: '◇', description: 'Crystal operations & storage' },
  PROCESS: { color: 'var(--neon-green)', icon: '▶', description: 'Active tasks & background jobs' },
}

export function DiagnosticsConsole({ className }: DiagnosticsConsoleProps) {
  // Power state
  const [isPowered, setIsPowered] = useState(false)
  const [bootProgress, setBootProgress] = useState(0)
  const [isBooting, setIsBooting] = useState(false)

  // Diagnostic state
  const [category, setCategory] = useState<DiagnosticCategory>('SYSTEMS')
  const [isRunningDiag, setIsRunningDiag] = useState(false)
  const [diagProgress, setDiagProgress] = useState(0)
  const [testingComponent, setTestingComponent] = useState<string | null>(null)

  // Control values
  const [scanDepth, setScanDepth] = useState(75)
  const [refreshRate, setRefreshRate] = useState(60)

  // Component statuses (dynamically updated)
  const [componentStatuses, setComponentStatuses] = useState<Record<DiagnosticCategory, ComponentStatus[]>>(LAB_SYSTEMS)

  // Alerts
  const [alerts, setAlerts] = useState<AlertEntry[]>([])

  // Log output
  const [logOutput, setLogOutput] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logOutput])

  // Add log entry
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogOutput(prev => [...prev.slice(-50), `[${timestamp}] ${message}`])
  }, [])

  // Add alert
  const addAlert = useCallback((severity: AlertEntry['severity'], message: string, cat: DiagnosticCategory) => {
    const alert: AlertEntry = {
      id: `alert-${Date.now()}`,
      severity,
      message,
      timestamp: new Date(),
      category: cat,
    }
    setAlerts(prev => [alert, ...prev].slice(0, 20))
  }, [])

  // Boot sequence
  const handlePowerToggle = () => {
    if (isPowered) {
      // Shutdown
      addLog('SHUTDOWN: Diagnostic console powering down...')
      setIsPowered(false)
      setBootProgress(0)
      setLogOutput([])
      setAlerts([])
      setDiagProgress(0)
    } else {
      // Boot
      setIsBooting(true)
      setBootProgress(0)
      setLogOutput([
        'UNIVERSAL DIAGNOSTICS CONSOLE v2.0.4',
        '═══════════════════════════════════════════════',
        'Copyright (c) UnstableLabs Research Division',
        '',
      ])

      let progress = 0
      const bootSteps = [
        { p: 15, msg: '[INIT] Loading diagnostic kernel...' },
        { p: 30, msg: '[INIT] Mounting system interfaces...' },
        { p: 45, msg: '[INIT] Enumerating lab components...' },
        { p: 60, msg: '[INIT] Establishing sensor links...' },
        { p: 75, msg: '[INIT] Calibrating measurement probes...' },
        { p: 90, msg: '[INIT] Starting monitoring daemons...' },
        { p: 100, msg: '[READY] All diagnostic systems online.' },
      ]

      let stepIndex = 0
      const bootInterval = setInterval(() => {
        progress += Math.random() * 12 + 3
        if (progress >= bootSteps[stepIndex].p) {
          setLogOutput(prev => [...prev, bootSteps[stepIndex].msg])
          stepIndex = Math.min(stepIndex + 1, bootSteps.length - 1)
        }
        if (progress >= 100) {
          progress = 100
          clearInterval(bootInterval)
          setIsBooting(false)
          setIsPowered(true)
          setLogOutput(prev => [
            ...prev,
            '',
            '═══════════════════════════════════════════════',
            'Select category and run diagnostics.',
            '',
          ])
        }
        setBootProgress(progress)
      }, 120)
    }
  }

  // Run full diagnostic on current category
  const runDiagnostics = async () => {
    if (!isPowered || isRunningDiag) return

    setIsRunningDiag(true)
    setDiagProgress(0)
    addLog(`━━━ DIAGNOSTIC: ${category} ━━━`)
    addLog(`Depth: ${scanDepth}% | Refresh: ${refreshRate}Hz`)

    const components = componentStatuses[category]
    const totalComponents = components.length

    for (let i = 0; i < totalComponents; i++) {
      const component = components[i]
      setTestingComponent(component.id)

      // Simulate test duration based on scan depth
      const testDuration = 200 + (scanDepth / 100) * 300

      addLog(`Testing: ${component.name}...`)

      await new Promise(resolve => setTimeout(resolve, testDuration))

      // Randomly update status based on test
      const newStatus = simulateComponentTest(component)
      setComponentStatuses(prev => ({
        ...prev,
        [category]: prev[category].map(c =>
          c.id === component.id ? { ...c, ...newStatus } : c
        ),
      }))

      // Generate alerts if issues found
      if (newStatus.status === 'warning') {
        addAlert('warning', `${component.name}: ${newStatus.detail || 'Suboptimal performance'}`, category)
        addLog(`  └─ WARNING: ${newStatus.detail || 'Performance degraded'}`)
      } else if (newStatus.status === 'critical') {
        addAlert('critical', `${component.name}: ${newStatus.detail || 'Critical failure'}`, category)
        addLog(`  └─ CRITICAL: ${newStatus.detail || 'Immediate attention required'}`)
      } else if (newStatus.status === 'online' || newStatus.status === 'standby') {
        addLog(`  └─ OK: ${newStatus.value || 'Nominal'}`)
      }

      setDiagProgress(((i + 1) / totalComponents) * 100)
    }

    setTestingComponent(null)
    setIsRunningDiag(false)
    addLog(`━━━ DIAGNOSTIC COMPLETE ━━━`)
    addLog(``)

    // Summary
    const results = componentStatuses[category]
    const online = results.filter(c => c.status === 'online').length
    const warnings = results.filter(c => c.status === 'warning').length
    const critical = results.filter(c => c.status === 'critical').length
    addLog(`Results: ${online} OK | ${warnings} WARN | ${critical} CRIT`)
    addLog(``)
  }

  // Simulate individual component test
  const simulateComponentTest = (component: ComponentStatus): Partial<ComponentStatus> => {
    // If locked (tier requirement), keep offline
    if (component.status === 'offline' && component.detail?.includes('Locked')) {
      return {}
    }

    // Random chance of status change
    const roll = Math.random()
    if (roll < 0.05) {
      // 5% chance of critical
      return { status: 'critical', detail: 'Component failure detected' }
    } else if (roll < 0.15) {
      // 10% chance of warning
      const warnings = [
        'Performance degraded',
        'Temperature elevated',
        'Calibration drift',
        'Memory pressure',
        'Throughput reduced',
      ]
      return { status: 'warning', detail: warnings[Math.floor(Math.random() * warnings.length)] }
    }

    // Otherwise maintain or improve status
    if (component.status === 'warning' && Math.random() > 0.5) {
      return { status: 'online', detail: 'Recovered' }
    }

    return {}
  }

  // Run quick test on single component
  const testComponent = async (component: ComponentStatus) => {
    if (!isPowered || isRunningDiag) return

    setTestingComponent(component.id)
    addLog(`Quick test: ${component.name}`)

    await new Promise(resolve => setTimeout(resolve, 500))

    const newStatus = simulateComponentTest(component)
    setComponentStatuses(prev => ({
      ...prev,
      [category]: prev[category].map(c =>
        c.id === component.id ? { ...c, ...newStatus } : c
      ),
    }))

    if (Object.keys(newStatus).length > 0) {
      addLog(`  └─ Status: ${newStatus.status?.toUpperCase() || 'OK'}`)
    } else {
      addLog(`  └─ No change detected`)
    }

    setTestingComponent(null)
  }

  // Auto-refresh status when powered
  useEffect(() => {
    if (!isPowered) return

    const interval = setInterval(() => {
      // Randomly fluctuate some values
      setComponentStatuses(prev => {
        const newStatuses = { ...prev }
        Object.keys(newStatuses).forEach(cat => {
          newStatuses[cat as DiagnosticCategory] = newStatuses[cat as DiagnosticCategory].map(comp => {
            // Only fluctuate numeric values
            if (comp.value && /^\d/.test(comp.value)) {
              const match = comp.value.match(/^([\d.]+)(.*)$/)
              if (match) {
                const num = parseFloat(match[1])
                const suffix = match[2]
                const variance = (Math.random() - 0.5) * num * 0.02
                return { ...comp, value: `${(num + variance).toFixed(1)}${suffix}` }
              }
            }
            return comp
          })
        })
        return newStatuses
      })
    }, 1000 / (refreshRate / 10))

    return () => clearInterval(interval)
  }, [isPowered, refreshRate])

  const currentConfig = CATEGORY_CONFIGS[category]
  const currentComponents = componentStatuses[category]

  // Count statuses for summary
  const statusCounts = {
    online: currentComponents.filter(c => c.status === 'online').length,
    warning: currentComponents.filter(c => c.status === 'warning').length,
    critical: currentComponents.filter(c => c.status === 'critical').length,
    offline: currentComponents.filter(c => c.status === 'offline').length,
    standby: currentComponents.filter(c => c.status === 'standby').length,
  }

  const getStatusColor = (status: ComponentStatus['status']) => {
    switch (status) {
      case 'online': return 'var(--neon-green)'
      case 'warning': return 'var(--neon-amber)'
      case 'critical': return 'var(--neon-red)'
      case 'standby': return 'var(--neon-cyan)'
      case 'testing': return 'var(--neon-purple)'
      case 'offline':
      default: return '#4a4a4a'
    }
  }

  return (
    <div className={cn(
      'flex flex-col h-full bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded-lg border border-[#2a2a3a] overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0a0a12] border-b border-[#2a2a3a]">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePowerToggle}
            className={cn(
              'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
              isPowered
                ? 'bg-[#1a3a1a] border-[var(--neon-green)] shadow-[0_0_12px_var(--neon-green)]'
                : isBooting
                ? 'bg-[#2a2a1a] border-[var(--neon-amber)] animate-pulse'
                : 'bg-[#1a1a1a] border-[#3a3a3a] hover:border-[#5a5a5a]'
            )}
          >
            <svg
              className={cn('w-4 h-4', isPowered ? 'text-[var(--neon-green)]' : 'text-[#5a5a5a]')}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0" />
            </svg>
          </button>
          <div>
            <div className="font-mono text-[10px] text-[var(--neon-lime)] font-bold tracking-wide">
              UNIVERSAL DIAGNOSTICS
            </div>
            <div className="font-mono text-[7px] text-white/40">System Health Monitor v2.0</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <LED on={isPowered} color="green" size="sm" label="PWR" />
          <LED on={isRunningDiag} color="amber" size="sm" label="RUN" />
          <LED on={alerts.some(a => a.severity === 'critical')} color="red" size="sm" label="ALT" />
        </div>
      </div>

      {/* Boot/Off Screen */}
      {!isPowered && !isBooting ? (
        <div className="flex-1 flex items-center justify-center bg-[#050508]">
          <div className="text-center">
            <div className="font-mono text-[32px] text-[#151518] font-bold">UDC</div>
            <div className="font-mono text-[8px] text-white/10 mt-1">PRESS POWER TO START</div>
          </div>
        </div>
      ) : isBooting ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-[#050508]">
          <div className="font-mono text-[10px] text-[var(--neon-lime)] mb-3">INITIALIZING DIAGNOSTICS</div>
          <div className="w-56 h-2.5 bg-[#0a0a0a] rounded overflow-hidden border border-[#2a2a3a]">
            <div
              className="h-full bg-gradient-to-r from-[var(--neon-lime)] to-[var(--neon-green)] transition-all"
              style={{ width: `${bootProgress}%` }}
            />
          </div>
          <div className="font-mono text-[8px] text-white/40 mt-2">{Math.floor(bootProgress)}%</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
          {/* Category Tabs */}
          <div className="flex gap-0.5">
            {(Object.keys(CATEGORY_CONFIGS) as DiagnosticCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'flex-1 py-1.5 rounded-t font-mono text-[6px] transition-all border-b-2',
                  category === cat
                    ? 'text-black font-bold border-transparent'
                    : 'bg-[#0a0a12] text-white/40 border-[#1a1a2a] hover:text-white/60'
                )}
                style={{
                  backgroundColor: category === cat ? CATEGORY_CONFIGS[cat].color : undefined,
                  borderBottomColor: category === cat ? CATEGORY_CONFIGS[cat].color : undefined,
                }}
              >
                <span className="mr-0.5">{CATEGORY_CONFIGS[cat].icon}</span>
                {cat}
              </button>
            ))}
          </div>

          {/* Category Description */}
          <div className="font-mono text-[7px] text-center px-2" style={{ color: currentConfig.color }}>
            {currentConfig.description}
          </div>

          {/* Status Summary Bar */}
          <div className="flex items-center justify-between bg-[#0a0a12] rounded px-2 py-1.5 border border-[#1a1a2a]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[var(--neon-green)]" />
                <span className="font-mono text-[8px] text-[var(--neon-green)]">{statusCounts.online}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[var(--neon-amber)]" />
                <span className="font-mono text-[8px] text-[var(--neon-amber)]">{statusCounts.warning}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[var(--neon-red)]" />
                <span className="font-mono text-[8px] text-[var(--neon-red)]">{statusCounts.critical}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[var(--neon-cyan)]" />
                <span className="font-mono text-[8px] text-[var(--neon-cyan)]">{statusCounts.standby}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#4a4a4a]" />
                <span className="font-mono text-[8px] text-[#4a4a4a]">{statusCounts.offline}</span>
              </div>
            </div>
            <div className="font-mono text-[7px] text-white/30">
              {currentComponents.length} components
            </div>
          </div>

          {/* Component Grid */}
          <div className="flex-1 grid grid-cols-2 gap-1 overflow-y-auto pr-1 min-h-0">
            {currentComponents.map((comp) => (
              <button
                key={comp.id}
                onClick={() => testComponent(comp)}
                disabled={isRunningDiag || comp.status === 'offline'}
                className={cn(
                  'relative p-2 rounded text-left transition-all border',
                  testingComponent === comp.id
                    ? 'border-[var(--neon-purple)] bg-[var(--neon-purple)]/10 animate-pulse'
                    : comp.status === 'offline'
                    ? 'border-[#1a1a2a] bg-[#0a0a0a] opacity-50 cursor-not-allowed'
                    : 'border-[#1a1a2a] bg-[#0a0a12] hover:border-white/20 cursor-pointer'
                )}
              >
                {/* Status indicator */}
                <div
                  className="absolute top-2 right-2 w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: testingComponent === comp.id ? 'var(--neon-purple)' : getStatusColor(comp.status),
                    boxShadow: comp.status !== 'offline' ? `0 0 6px ${getStatusColor(comp.status)}` : 'none',
                  }}
                />

                {/* Component info */}
                <div className="font-mono text-[8px] text-white/80 font-medium pr-4">{comp.name}</div>
                <div className="font-mono text-[10px] font-bold mt-0.5" style={{ color: getStatusColor(comp.status) }}>
                  {comp.value || comp.status.toUpperCase()}
                </div>
                <div className="font-mono text-[6px] text-white/30 mt-0.5">{comp.detail}</div>
                {comp.tier && (
                  <div className="absolute bottom-1.5 right-2 font-mono text-[6px] text-white/20">
                    T{comp.tier}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between bg-[#0a0a12] rounded p-2 border border-[#1a1a2a]">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <span className="font-mono text-[5px] text-white/40">DEPTH</span>
                <Knob value={scanDepth} onChange={setScanDepth} size="sm" accentColor={currentConfig.color} />
                <span className="font-mono text-[6px]" style={{ color: currentConfig.color }}>{scanDepth}%</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-mono text-[5px] text-white/40">REFRESH</span>
                <Knob value={refreshRate} onChange={setRefreshRate} size="sm" accentColor={currentConfig.color} />
                <span className="font-mono text-[6px]" style={{ color: currentConfig.color }}>{refreshRate}Hz</span>
              </div>
            </div>

            <button
              onClick={runDiagnostics}
              disabled={isRunningDiag}
              className={cn(
                'px-3 py-1.5 rounded font-mono text-[8px] font-bold transition-all',
                isRunningDiag
                  ? 'bg-[var(--neon-amber)] text-black animate-pulse'
                  : 'hover:brightness-110'
              )}
              style={{
                backgroundColor: isRunningDiag ? undefined : currentConfig.color,
                color: 'black',
                boxShadow: `0 0 12px ${currentConfig.color}`,
              }}
            >
              {isRunningDiag ? `TESTING ${Math.floor(diagProgress)}%` : 'RUN FULL DIAGNOSTIC'}
            </button>
          </div>

          {/* Progress bar when running */}
          {isRunningDiag && (
            <div className="w-full h-1.5 bg-[#0a0a0a] rounded overflow-hidden border border-[#1a1a2a]">
              <div
                className="h-full transition-all"
                style={{
                  width: `${diagProgress}%`,
                  backgroundColor: currentConfig.color,
                }}
              />
            </div>
          )}

          {/* Alert Panel */}
          {alerts.length > 0 && (
            <div className="bg-[#0a0a0a] rounded border border-[#2a2a3a] p-1.5 max-h-16 overflow-y-auto">
              <div className="font-mono text-[6px] text-white/40 mb-1">RECENT ALERTS</div>
              {alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'font-mono text-[7px] flex items-center gap-1',
                    alert.severity === 'critical' ? 'text-[var(--neon-red)]' :
                    alert.severity === 'warning' ? 'text-[var(--neon-amber)]' :
                    'text-[var(--neon-cyan)]'
                  )}
                >
                  <span>{alert.severity === 'critical' ? '◉' : alert.severity === 'warning' ? '◈' : '◇'}</span>
                  <span className="text-white/40">[{alert.category}]</span>
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Log Output */}
          <div
            ref={logRef}
            className="flex-1 min-h-12 bg-[#050508] rounded border border-[#1a1a2a] p-1.5 overflow-y-auto"
          >
            <div className="font-mono text-[6px]">
              {logOutput.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'leading-relaxed whitespace-pre',
                    line.includes('CRITICAL') || line.includes('CRIT') ? 'text-[var(--neon-red)]' :
                    line.includes('WARNING') || line.includes('WARN') ? 'text-[var(--neon-amber)]' :
                    line.includes('OK') || line.includes('READY') || line.includes('COMPLETE') ? 'text-[var(--neon-green)]' :
                    line.startsWith('[') ? 'text-white/50' :
                    line.startsWith('━') || line.startsWith('═') ? 'text-[var(--neon-lime)]' :
                    line.includes('└─') ? 'text-white/40' :
                    'text-[var(--crt-green)]'
                  )}
                >
                  {line}
                </div>
              ))}
              {isPowered && <span className="inline-block w-1 h-2 bg-[var(--neon-lime)] animate-pulse" />}
            </div>
          </div>
        </div>
      )}

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#0a0a12] border-t border-[#2a2a3a]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[5px] text-white/30">CAT:</span>
          <span className="font-mono text-[6px]" style={{ color: currentConfig.color }}>{category}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[5px] text-white/30">HEALTH</span>
          <div className="w-16 h-1 bg-[#1a1a2a] rounded overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: isPowered ? `${Math.max(0, 100 - (statusCounts.warning * 10) - (statusCounts.critical * 30))}%` : '0%',
                backgroundColor: statusCounts.critical > 0 ? 'var(--neon-red)' :
                  statusCounts.warning > 0 ? 'var(--neon-amber)' : 'var(--neon-green)',
              }}
            />
          </div>
          <span
            className="font-mono text-[5px]"
            style={{
              color: statusCounts.critical > 0 ? 'var(--neon-red)' :
                statusCounts.warning > 0 ? 'var(--neon-amber)' : 'var(--neon-green)',
            }}
          >
            {isPowered ? `${Math.max(0, 100 - (statusCounts.warning * 10) - (statusCounts.critical * 30))}%` : '0%'}
          </span>
        </div>
      </div>
    </div>
  )
}

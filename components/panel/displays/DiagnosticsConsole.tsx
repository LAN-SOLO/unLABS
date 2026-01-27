'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { LED } from '../controls/LED'
import { Knob } from '../controls/Knob'

type DeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type TestPhase = 'memory' | 'systems' | 'network' | 'devices' | 'complete' | null

interface DiagnosticsConsoleProps {
  className?: string
  onTest?: () => void
  onReset?: () => void
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
    { id: 'sys-os', name: '_unOS Kernel', status: 'online', value: 'v4.2.1', detail: 'Primary OS' },
    { id: 'sys-und', name: '_und Daemon', status: 'online', value: 'PID 2847', detail: 'Main process' },
    { id: 'sys-terminal', name: 'Lab Terminal', status: 'online', value: 'Active', detail: 'Command interface', tier: 1 },
    { id: 'sys-cache', name: 'Data Cache', status: 'online', value: '2.4 GB', detail: 'Archive', tier: 1 },
    { id: 'sys-computer', name: 'Supercomputer', status: 'online', value: '87%', detail: 'Compute', tier: 3 },
    { id: 'sys-ai', name: 'AI Assistant', status: 'standby', value: 'Queue: 0', detail: 'Automation', tier: 2 },
  ],
  DEVICES: [
    { id: 'dev-reactor', name: 'Microfusion', status: 'online', value: '85%', detail: 'Power gen', tier: 1 },
    { id: 'dev-core', name: 'Energy Core', status: 'online', value: '12.5 MW', detail: 'Output', tier: 1 },
    { id: 'dev-battery', name: 'Battery Pack', status: 'online', value: '100%', detail: 'Backup', tier: 1 },
    { id: 'dev-synth', name: 'Synthesizer', status: 'online', value: 'Ready', detail: 'Materials', tier: 2 },
    { id: 'dev-forge', name: 'Alloy Forge', status: 'warning', value: 'HOT', detail: 'Temp high', tier: 2 },
    { id: 'dev-laser', name: 'Precision Laser', status: 'online', value: 'Cal', detail: 'Cutting', tier: 3 },
  ],
  ENERGY: [
    { id: 'nrg-input', name: 'Power Input', status: 'online', value: '42.3 kW', detail: 'Draw' },
    { id: 'nrg-output', name: 'Power Output', status: 'online', value: '12.5 MW', detail: 'Gen rate' },
    { id: 'nrg-storage', name: 'Energy Buffer', status: 'online', value: '847 MWh', detail: 'Reserve' },
    { id: 'nrg-grid', name: 'Distrib Grid', status: 'online', value: '98.7%', detail: 'Efficiency' },
    { id: 'nrg-fuel', name: 'Fusion Fuel', status: 'online', value: '340 u', detail: 'Supply' },
    { id: 'nrg-waste', name: 'Waste Heat', status: 'warning', value: '67°C', detail: 'High' },
  ],
  NETWORK: [
    { id: 'net-solana', name: 'Solana Devnet', status: 'online', value: '2847 TPS', detail: 'Blockchain' },
    { id: 'net-rpc', name: 'RPC Endpoint', status: 'online', value: '24ms', detail: 'Latency' },
    { id: 'net-chain', name: '_unchain', status: 'online', value: 'Synced', detail: 'Block sync' },
    { id: 'net-tick', name: '_untick', status: 'online', value: '60 Hz', detail: 'Volatility' },
    { id: 'net-comm', name: 'Quantum Comm', status: 'online', value: 'Encrypted', detail: 'Secure', tier: 2 },
    { id: 'net-firewall', name: 'Security', status: 'online', value: 'MAX', detail: 'Threat: 0' },
  ],
  CRYSTALS: [
    { id: 'cry-assembly', name: 'Assembly Bay', status: 'online', value: 'Ready', detail: 'Combining' },
    { id: 'cry-scanner', name: 'Scanner', status: 'online', value: 'Cal', detail: 'Analysis' },
    { id: 'cry-stabilizer', name: 'Stabilizer', status: 'online', value: '99.2%', detail: 'Field' },
    { id: 'cry-storage', name: 'Crystal Vault', status: 'online', value: '3/50', detail: 'Capacity' },
    { id: 'cry-resonance', name: 'Resonance', status: 'online', value: 'Harmonic', detail: 'Freq lock', tier: 2 },
    { id: 'cry-enhancer', name: 'Enhancer', status: 'warning', value: 'Cooling', detail: 'Recovery', tier: 3 },
  ],
  PROCESS: [
    { id: 'proc-research', name: 'Research', status: 'online', value: '3 jobs', detail: 'Tech tree' },
    { id: 'proc-mining', name: 'Mining', status: 'online', value: '+2.4/s', detail: 'Abstractum' },
    { id: 'proc-refining', name: 'Refining', status: 'online', value: '12/hr', detail: 'Alloy' },
    { id: 'proc-synthesis', name: 'Nano Synth', status: 'standby', value: 'Paused', detail: 'Input wait' },
    { id: 'proc-simulation', name: 'Sim Engine', status: 'online', value: '10K/s', detail: 'Iterations' },
    { id: 'proc-automation', name: 'Auto-Tasks', status: 'online', value: '8 active', detail: 'Background' },
  ],
}

const CATEGORY_CONFIGS: Record<DiagnosticCategory, { color: string; icon: string }> = {
  SYSTEMS: { color: 'var(--neon-cyan)', icon: '⬡' },
  DEVICES: { color: 'var(--neon-amber)', icon: '⚙' },
  ENERGY: { color: 'var(--neon-lime)', icon: '⚡' },
  NETWORK: { color: 'var(--neon-purple)', icon: '◎' },
  CRYSTALS: { color: 'var(--neon-pink)', icon: '◇' },
  PROCESS: { color: 'var(--neon-green)', icon: '▶' },
}

export function DiagnosticsConsole({ className, onTest, onReset }: DiagnosticsConsoleProps) {
  // Device state machine
  const [deviceState, setDeviceState] = useState<DeviceState>('booting')
  const [testPhase, setTestPhase] = useState<TestPhase>(null)
  const [bootProgress, setBootProgress] = useState(0)

  // Derived states
  const isPowered = deviceState === 'online' || deviceState === 'testing'
  const isBooting = deviceState === 'booting'

  // Diagnostic state
  const [category, setCategory] = useState<DiagnosticCategory>('SYSTEMS')
  const [isRunningDiag, setIsRunningDiag] = useState(false)
  const [diagProgress, setDiagProgress] = useState(0)
  const [testingComponent, setTestingComponent] = useState<string | null>(null)

  // Control values
  const [scanDepth, setScanDepth] = useState(75)

  // Company logo position (random on mount)
  const [logoPosition] = useState(() => {
    const positions = ['header-left', 'header-right', 'footer-left'] as const
    return positions[Math.floor(Math.random() * positions.length)]
  })

  // Component statuses
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
    setLogOutput(prev => [...prev.slice(-30), message])
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
    setAlerts(prev => [alert, ...prev].slice(0, 10))
  }, [])

  // Boot sequence effect
  useEffect(() => {
    if (deviceState !== 'booting') return

    setBootProgress(0)
    setLogOutput(['UNIVERSAL DIAGNOSTICS v2.0.4', ''])

    let progress = 0
    const bootInterval = setInterval(() => {
      progress += Math.random() * 20 + 10
      if (progress >= 100) {
        progress = 100
        clearInterval(bootInterval)
        setDeviceState('online')
        setLogOutput(['UDC v2.0.4 READY', 'Select category and run diagnostics.'])
      }
      setBootProgress(progress)
    }, 100)

    return () => clearInterval(bootInterval)
  }, [deviceState])

  // Power toggle
  const handlePowerToggle = () => {
    if (isPowered) {
      setDeviceState('offline')
      setBootProgress(0)
      setLogOutput([])
      setAlerts([])
      setDiagProgress(0)
    } else {
      setDeviceState('booting')
    }
  }

  // System test sequence
  const handleSystemTest = () => {
    if (deviceState !== 'online') return
    setDeviceState('testing')
    onTest?.()

    const runTest = async () => {
      addLog('')
      addLog('━ SYSTEM TEST ━')
      setTestPhase('memory')
      addLog('[TEST] Memory integrity...')
      await new Promise(r => setTimeout(r, 400))
      setTestPhase('systems')
      addLog('[TEST] Core systems...')
      await new Promise(r => setTimeout(r, 350))
      setTestPhase('network')
      addLog('[TEST] Network stack...')
      await new Promise(r => setTimeout(r, 400))
      setTestPhase('devices')
      addLog('[TEST] Device interfaces...')
      await new Promise(r => setTimeout(r, 350))
      setTestPhase('complete')
      addLog('[PASS] All tests passed')
      await new Promise(r => setTimeout(r, 300))
      setTestPhase(null)
      setDeviceState('online')
    }
    runTest()
  }

  // Reboot sequence
  const handleReboot = () => {
    onReset?.()
    setDeviceState('rebooting')
    setTestPhase(null)
    addLog('')
    addLog('━ REBOOT ━')

    setTimeout(() => addLog('[STOP] Services...'), 100)
    setTimeout(() => addLog('[STOP] Interfaces...'), 300)
    setTimeout(() => {
      setLogOutput([])
      setAlerts([])
      setDiagProgress(0)
      setBootProgress(0)
      setDeviceState('booting')
    }, 700)
  }

  // Run diagnostics
  const runDiagnostics = async () => {
    if (deviceState !== 'online' || isRunningDiag) return

    setIsRunningDiag(true)
    setDiagProgress(0)
    addLog(`━ DIAG: ${category} ━`)

    const components = componentStatuses[category]
    const totalComponents = components.length

    for (let i = 0; i < totalComponents; i++) {
      const component = components[i]
      setTestingComponent(component.id)

      const testDuration = 150 + (scanDepth / 100) * 200
      await new Promise(resolve => setTimeout(resolve, testDuration))

      const newStatus = simulateComponentTest(component)
      setComponentStatuses(prev => ({
        ...prev,
        [category]: prev[category].map(c =>
          c.id === component.id ? { ...c, ...newStatus } : c
        ),
      }))

      if (newStatus.status === 'warning') {
        addAlert('warning', `${component.name}: ${newStatus.detail || 'Issue'}`, category)
      } else if (newStatus.status === 'critical') {
        addAlert('critical', `${component.name}: ${newStatus.detail || 'Failure'}`, category)
      }

      setDiagProgress(((i + 1) / totalComponents) * 100)
    }

    setTestingComponent(null)
    setIsRunningDiag(false)

    const results = componentStatuses[category]
    const online = results.filter(c => c.status === 'online').length
    const warnings = results.filter(c => c.status === 'warning').length
    addLog(`Done: ${online} OK, ${warnings} WARN`)
  }

  // Simulate component test
  const simulateComponentTest = (component: ComponentStatus): Partial<ComponentStatus> => {
    if (component.status === 'offline' && component.detail?.includes('Locked')) {
      return {}
    }

    const roll = Math.random()
    if (roll < 0.05) {
      return { status: 'critical', detail: 'Failure detected' }
    } else if (roll < 0.15) {
      const warnings = ['Degraded', 'Temp high', 'Drift', 'Pressure', 'Reduced']
      return { status: 'warning', detail: warnings[Math.floor(Math.random() * warnings.length)] }
    }

    if (component.status === 'warning' && Math.random() > 0.5) {
      return { status: 'online', detail: 'Recovered' }
    }

    return {}
  }

  // Quick test single component
  const testComponent = async (component: ComponentStatus) => {
    if (!isPowered || isRunningDiag) return

    setTestingComponent(component.id)
    await new Promise(resolve => setTimeout(resolve, 300))

    const newStatus = simulateComponentTest(component)
    setComponentStatuses(prev => ({
      ...prev,
      [category]: prev[category].map(c =>
        c.id === component.id ? { ...c, ...newStatus } : c
      ),
    }))

    setTestingComponent(null)
  }

  // Auto-refresh values
  useEffect(() => {
    if (!isPowered) return

    const interval = setInterval(() => {
      setComponentStatuses(prev => {
        const newStatuses = { ...prev }
        Object.keys(newStatuses).forEach(cat => {
          newStatuses[cat as DiagnosticCategory] = newStatuses[cat as DiagnosticCategory].map(comp => {
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
    }, 2000)

    return () => clearInterval(interval)
  }, [isPowered])

  const currentConfig = CATEGORY_CONFIGS[category]
  const currentComponents = componentStatuses[category]

  // Count statuses
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

  const healthPercent = Math.max(0, 100 - (statusCounts.warning * 10) - (statusCounts.critical * 30))

  return (
    <div className={cn(
      'flex flex-col h-full bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded-lg border border-[#2a2a3a] overflow-hidden',
      className
    )}>
      {/* Top control bar with round nano buttons */}
      <div className="flex items-center justify-center gap-4 px-2 py-1 bg-gradient-to-b from-[#0a0a0a] to-[#0a0a12] border-b border-[#1a1a2a]">
        {/* Test button - round nano with illuminated edge */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleSystemTest}
            disabled={deviceState !== 'online'}
            className={cn(
              'w-5 h-5 rounded-full transition-all duration-200 relative',
              'flex items-center justify-center',
              deviceState === 'online'
                ? 'cursor-pointer'
                : 'cursor-not-allowed opacity-50'
            )}
            style={{
              background: 'radial-gradient(circle at 30% 30%, #4a4a5a 0%, #2a2a3a 50%, #1a1a2a 100%)',
              boxShadow: deviceState === 'testing'
                ? '0 0 8px var(--neon-lime), inset 0 0 3px rgba(0,0,0,0.5)'
                : 'inset 0 1px 2px rgba(255,255,255,0.1), inset 0 -1px 2px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.4)',
            }}
            title="SYSTEM TEST"
          >
            {/* Illuminated edge ring */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: deviceState === 'testing'
                  ? '1.5px solid var(--neon-lime)'
                  : deviceState === 'online'
                  ? '1.5px solid rgba(200,255,200,0.3)'
                  : '1.5px solid rgba(100,100,100,0.2)',
                boxShadow: deviceState === 'testing'
                  ? '0 0 6px var(--neon-lime), inset 0 0 4px var(--neon-lime)'
                  : deviceState === 'online'
                  ? '0 0 3px rgba(200,255,200,0.2)'
                  : 'none',
              }}
            />
            {/* Center dot */}
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: deviceState === 'testing'
                  ? 'var(--neon-lime)'
                  : 'linear-gradient(135deg, #5a5a6a 0%, #3a3a4a 100%)',
                boxShadow: deviceState === 'testing' ? '0 0 4px var(--neon-lime)' : 'none',
              }}
            />
          </button>
          <span className="font-mono text-[5px] text-white/30">TEST</span>
        </div>

        {/* Company logo - header position */}
        {(logoPosition === 'header-left' || logoPosition === 'header-right') && (
          <span
            className="font-mono text-[6px] font-bold"
            style={{ color: 'var(--neon-lime)', opacity: 0.4, textShadow: '0 0 3px var(--neon-lime)' }}
          >
            UDEX
          </span>
        )}

        {/* Reset button - round nano with illuminated edge */}
        <div className="flex items-center gap-1">
          <span className="font-mono text-[5px] text-white/30">RESET</span>
          <button
            onClick={handleReboot}
            disabled={deviceState === 'booting' || deviceState === 'rebooting'}
            className={cn(
              'w-5 h-5 rounded-full transition-all duration-200 relative',
              'flex items-center justify-center',
              deviceState !== 'booting' && deviceState !== 'rebooting'
                ? 'cursor-pointer'
                : 'cursor-not-allowed opacity-50'
            )}
            style={{
              background: 'radial-gradient(circle at 30% 30%, #5a4a4a 0%, #3a2a2a 50%, #2a1a1a 100%)',
              boxShadow: deviceState === 'rebooting'
                ? '0 0 8px var(--neon-amber), inset 0 0 3px rgba(0,0,0,0.5)'
                : 'inset 0 1px 2px rgba(255,255,255,0.1), inset 0 -1px 2px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.4)',
            }}
            title="REBOOT SYSTEM"
          >
            {/* Illuminated edge ring */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: deviceState === 'rebooting'
                  ? '1.5px solid var(--neon-amber)'
                  : deviceState !== 'booting'
                  ? '1.5px solid rgba(255,200,150,0.3)'
                  : '1.5px solid rgba(100,100,100,0.2)',
                boxShadow: deviceState === 'rebooting'
                  ? '0 0 6px var(--neon-amber), inset 0 0 4px var(--neon-amber)'
                  : deviceState !== 'booting'
                  ? '0 0 3px rgba(255,200,150,0.2)'
                  : 'none',
              }}
            />
            {/* Center dot */}
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: deviceState === 'rebooting'
                  ? 'var(--neon-amber)'
                  : 'linear-gradient(135deg, #6a5a5a 0%, #4a3a3a 100%)',
                boxShadow: deviceState === 'rebooting' ? '0 0 4px var(--neon-amber)' : 'none',
              }}
            />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#0a0a12] border-b border-[#2a2a3a]">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePowerToggle}
            className={cn(
              'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
              isPowered
                ? 'bg-[#1a3a1a] border-[var(--neon-green)] shadow-[0_0_10px_var(--neon-green)]'
                : isBooting || deviceState === 'rebooting'
                ? 'bg-[#2a2a1a] border-[var(--neon-amber)] animate-pulse'
                : 'bg-[#1a1a1a] border-[#3a3a3a] hover:border-[#5a5a5a]'
            )}
          >
            <svg
              className={cn('w-3 h-3', isPowered ? 'text-[var(--neon-green)]' : 'text-[#5a5a5a]')}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0" />
            </svg>
          </button>
          <div>
            <div className="font-mono text-[9px] text-[var(--neon-lime)] font-bold">UNIVERSAL DIAGNOSTICS</div>
            <div className="font-mono text-[6px] text-white/30">System Health Monitor v2.0</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <LED on={isPowered} color="green" size="sm" />
          <LED on={isRunningDiag || deviceState === 'testing'} color="amber" size="sm" />
          <LED on={alerts.some(a => a.severity === 'critical')} color="red" size="sm" />
        </div>
      </div>

      {/* Boot/Off Screen */}
      {deviceState === 'offline' ? (
        <div className="flex-1 flex items-center justify-center bg-[#050508]">
          <div className="text-center">
            <div className="font-mono text-[24px] text-[#151518] font-bold">UDC</div>
            <div className="font-mono text-[7px] text-white/10 mt-1">PRESS POWER</div>
          </div>
        </div>
      ) : deviceState === 'booting' || deviceState === 'rebooting' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-3 bg-[#050508]">
          <div className="font-mono text-[9px] text-[var(--neon-lime)] mb-2">
            {deviceState === 'rebooting' ? 'REBOOTING' : 'INITIALIZING'}
          </div>
          <div className="w-32 h-2 bg-[#0a0a0a] rounded overflow-hidden border border-[#2a2a3a]">
            <div
              className="h-full bg-gradient-to-r from-[var(--neon-lime)] to-[var(--neon-green)] transition-all"
              style={{ width: `${bootProgress}%` }}
            />
          </div>
          <div className="font-mono text-[7px] text-white/40 mt-1">{Math.floor(bootProgress)}%</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-1.5 gap-1 overflow-hidden">
          {/* Category Tabs - Compact */}
          <div className="flex gap-px">
            {(Object.keys(CATEGORY_CONFIGS) as DiagnosticCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'flex-1 py-1 rounded font-mono text-[6px] transition-all',
                  category === cat
                    ? 'text-black font-bold'
                    : 'bg-[#0a0a12] text-white/40 hover:text-white/60'
                )}
                style={{
                  backgroundColor: category === cat ? CATEGORY_CONFIGS[cat].color : undefined,
                }}
              >
                {cat.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Main Content - Horizontal Layout */}
          <div className="flex-1 flex gap-1.5 overflow-hidden">
            {/* LEFT: Component Grid */}
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              {/* Status summary */}
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)]" />
                  <span className="font-mono text-[7px] text-[var(--neon-green)]">{statusCounts.online}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-amber)]" />
                  <span className="font-mono text-[7px] text-[var(--neon-amber)]">{statusCounts.warning}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-cyan)]" />
                  <span className="font-mono text-[7px] text-[var(--neon-cyan)]">{statusCounts.standby}</span>
                </div>
                <span className="font-mono text-[6px] text-white/30 ml-auto">{currentComponents.length} items</span>
              </div>

              {/* Component Grid - 3 columns */}
              <div className="flex-1 grid grid-cols-3 gap-1 overflow-y-auto pr-0.5 min-h-0">
                {currentComponents.map((comp, index) => (
                  <button
                    key={comp.id}
                    onClick={() => testComponent(comp)}
                    disabled={isRunningDiag || comp.status === 'offline'}
                    className={cn(
                      'relative p-1.5 rounded text-left transition-all border overflow-hidden',
                      testingComponent === comp.id
                        ? 'border-[var(--neon-purple)] bg-[var(--neon-purple)]/10'
                        : comp.status === 'offline'
                        ? 'border-[#1a1a2a] bg-[#0a0a0a] opacity-50 cursor-not-allowed'
                        : 'border-[#1a1a2a] bg-[#0a0a12] hover:border-white/20 cursor-pointer'
                    )}
                  >
                    {/* Subtle corner accents */}
                    {comp.status !== 'offline' && (
                      <>
                        <div
                          className="absolute top-0 left-0 w-2 h-px"
                          style={{ backgroundColor: getStatusColor(comp.status), opacity: 0.4 }}
                        />
                        <div
                          className="absolute top-0 left-0 h-2 w-px"
                          style={{ backgroundColor: getStatusColor(comp.status), opacity: 0.4 }}
                        />
                        <div
                          className="absolute bottom-0 right-0 w-2 h-px"
                          style={{ backgroundColor: getStatusColor(comp.status), opacity: 0.3 }}
                        />
                        <div
                          className="absolute bottom-0 right-0 h-2 w-px"
                          style={{ backgroundColor: getStatusColor(comp.status), opacity: 0.3 }}
                        />
                      </>
                    )}

                    {/* Activity pulse - subtle background animation for online components */}
                    {comp.status === 'online' && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse at ${30 + (index % 3) * 20}% ${40 + (index % 2) * 30}%, ${getStatusColor(comp.status)}08 0%, transparent 70%)`,
                          animation: `pulse-subtle ${2 + (index % 3) * 0.5}s ease-in-out infinite`,
                        }}
                      />
                    )}

                    {/* Data flow indicator - tiny animated bar at bottom */}
                    {comp.status === 'online' && (
                      <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: '30%',
                            backgroundColor: getStatusColor(comp.status),
                            opacity: 0.5,
                            animation: `data-flow ${1.5 + (index % 4) * 0.3}s linear infinite`,
                          }}
                        />
                      </div>
                    )}

                    {/* Warning pulse effect */}
                    {comp.status === 'warning' && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          boxShadow: `inset 0 0 8px ${getStatusColor(comp.status)}20`,
                          animation: 'warning-pulse 2s ease-in-out infinite',
                        }}
                      />
                    )}

                    {/* Status dot with pulse */}
                    <div className="absolute top-1 right-1">
                      {/* Pulse ring for active components */}
                      {(comp.status === 'online' || comp.status === 'standby') && (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundColor: getStatusColor(comp.status),
                            opacity: 0.3,
                            animation: `dot-pulse ${comp.status === 'standby' ? '3s' : '2s'} ease-out infinite`,
                            transform: 'scale(1)',
                          }}
                        />
                      )}
                      <div
                        className="relative w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: testingComponent === comp.id ? 'var(--neon-purple)' : getStatusColor(comp.status),
                          boxShadow: comp.status !== 'offline' ? `0 0 4px ${getStatusColor(comp.status)}` : 'none',
                        }}
                      />
                    </div>

                    {/* Testing scan effect */}
                    {testingComponent === comp.id && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(180deg, transparent 0%, var(--neon-purple) 50%, transparent 100%)',
                          opacity: 0.15,
                          animation: 'scan-down 0.8s ease-in-out infinite',
                        }}
                      />
                    )}

                    {/* Interior micro visualization - activity bars */}
                    {comp.status !== 'offline' && (
                      <div className="absolute bottom-1 left-1.5 right-4 h-[3px] flex gap-px pointer-events-none">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm"
                            style={{
                              backgroundColor: getStatusColor(comp.status),
                              opacity: comp.status === 'online' ? 0.15 + Math.random() * 0.25 : 0.1,
                              animation: comp.status === 'online'
                                ? `bar-flicker ${0.8 + i * 0.2}s ease-in-out infinite ${i * 0.1}s`
                                : 'none',
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Interior micro waveform for active components */}
                    {comp.status === 'online' && (
                      <div
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-3 pointer-events-none overflow-hidden"
                        style={{ opacity: 0.4 }}
                      >
                        <svg viewBox="0 0 20 12" className="w-full h-full">
                          <path
                            d={`M0,6 Q2,${2 + index % 3} 4,6 T8,6 T12,6 T16,6 T20,6`}
                            fill="none"
                            stroke={getStatusColor(comp.status)}
                            strokeWidth="1"
                            style={{
                              animation: `wave-move ${1.5 + (index % 3) * 0.3}s linear infinite`,
                            }}
                          />
                        </svg>
                      </div>
                    )}

                    {/* Interior standby pulse rings */}
                    {comp.status === 'standby' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{
                            borderColor: getStatusColor(comp.status),
                            opacity: 0.2,
                            animation: 'standby-ring 3s ease-out infinite',
                          }}
                        />
                      </div>
                    )}

                    {/* Interior warning indicator - animated chevrons */}
                    {comp.status === 'warning' && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-[6px] flex flex-col gap-px pointer-events-none">
                        {[0, 1].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 h-0.5"
                            style={{
                              background: `linear-gradient(90deg, transparent 0%, ${getStatusColor(comp.status)} 50%, transparent 100%)`,
                              opacity: 0.4,
                              animationName: 'chevron-pulse',
                              animationDuration: '1s',
                              animationTimingFunction: 'ease-in-out',
                              animationIterationCount: 'infinite',
                              animationDelay: `${i * 0.15}s`,
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Interior data grid pattern for critical */}
                    {comp.status === 'critical' && (
                      <div
                        className="absolute inset-1 pointer-events-none"
                        style={{
                          backgroundImage: `
                            linear-gradient(90deg, ${getStatusColor(comp.status)}15 1px, transparent 1px),
                            linear-gradient(${getStatusColor(comp.status)}15 1px, transparent 1px)
                          `,
                          backgroundSize: '4px 4px',
                          animation: 'grid-flash 0.5s ease-in-out infinite',
                        }}
                      />
                    )}

                    <div className="font-mono text-[7px] text-white/70 truncate pr-3 relative z-10">{comp.name}</div>
                    <div className="font-mono text-[9px] font-bold relative z-10" style={{ color: getStatusColor(comp.status) }}>
                      {comp.value || comp.status.toUpperCase()}
                    </div>
                  </button>
                ))}
              </div>

              {/* Keyframe animations */}
              <style jsx>{`
                @keyframes pulse-subtle {
                  0%, 100% { opacity: 0.3; }
                  50% { opacity: 0.6; }
                }
                @keyframes data-flow {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(400%); }
                }
                @keyframes warning-pulse {
                  0%, 100% { opacity: 0.3; }
                  50% { opacity: 0.7; }
                }
                @keyframes dot-pulse {
                  0% { transform: scale(1); opacity: 0.4; }
                  50% { transform: scale(2); opacity: 0; }
                  100% { transform: scale(1); opacity: 0; }
                }
                @keyframes scan-down {
                  0% { transform: translateY(-100%); }
                  100% { transform: translateY(100%); }
                }
                @keyframes bar-flicker {
                  0%, 100% { opacity: 0.15; transform: scaleY(0.6); }
                  25% { opacity: 0.35; transform: scaleY(1); }
                  50% { opacity: 0.2; transform: scaleY(0.8); }
                  75% { opacity: 0.4; transform: scaleY(1); }
                }
                @keyframes wave-move {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-8px); }
                }
                @keyframes standby-ring {
                  0% { transform: scale(0.5); opacity: 0.4; }
                  50% { transform: scale(1.5); opacity: 0; }
                  100% { transform: scale(0.5); opacity: 0; }
                }
                @keyframes chevron-pulse {
                  0%, 100% { opacity: 0.2; transform: scaleX(0.8); }
                  50% { opacity: 0.6; transform: scaleX(1.2); }
                }
                @keyframes grid-flash {
                  0%, 100% { opacity: 0.3; }
                  50% { opacity: 0.7; }
                }
              `}</style>

              {/* Progress bar when running */}
              {isRunningDiag && (
                <div className="w-full h-1 bg-[#0a0a0a] rounded overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${diagProgress}%`, backgroundColor: currentConfig.color }}
                  />
                </div>
              )}
            </div>

            {/* RIGHT: Controls + Log */}
            <div className="w-[100px] flex flex-col gap-1">
              {/* Control knob */}
              <div className="bg-[#0a0a12] rounded p-1.5 border border-[#1a1a2a] flex flex-col items-center">
                <span className="font-mono text-[5px] text-white/40 mb-0.5">DEPTH</span>
                <Knob value={scanDepth} onChange={setScanDepth} size="sm" accentColor={currentConfig.color} />
                <span className="font-mono text-[6px] mt-0.5" style={{ color: currentConfig.color }}>{scanDepth}%</span>
              </div>

              {/* Run button */}
              <button
                onClick={runDiagnostics}
                disabled={isRunningDiag}
                className={cn(
                  'py-1.5 rounded font-mono text-[7px] font-bold transition-all',
                  isRunningDiag ? 'bg-[var(--neon-amber)] text-black animate-pulse' : 'hover:brightness-110'
                )}
                style={{
                  backgroundColor: isRunningDiag ? undefined : currentConfig.color,
                  color: 'black',
                  boxShadow: `0 0 8px ${currentConfig.color}`,
                }}
              >
                {isRunningDiag ? `${Math.floor(diagProgress)}%` : 'RUN'}
              </button>

              {/* Alert count */}
              {alerts.length > 0 && (
                <div className="bg-[#1a0a0a] rounded px-1.5 py-1 border border-[var(--neon-red)]/30">
                  <div className="font-mono text-[6px] text-[var(--neon-red)]">
                    {alerts.filter(a => a.severity === 'critical').length} CRIT
                  </div>
                  <div className="font-mono text-[6px] text-[var(--neon-amber)]">
                    {alerts.filter(a => a.severity === 'warning').length} WARN
                  </div>
                </div>
              )}

              {/* Log output - compact */}
              <div
                ref={logRef}
                className="flex-1 bg-[#050508] rounded border border-[#1a1a2a] p-1 overflow-y-auto min-h-0"
              >
                <div className="font-mono text-[5px]">
                  {logOutput.slice(-8).map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        'leading-tight',
                        line.includes('CRIT') ? 'text-[var(--neon-red)]' :
                        line.includes('WARN') ? 'text-[var(--neon-amber)]' :
                        line.includes('OK') || line.includes('Done') ? 'text-[var(--neon-green)]' :
                        'text-white/40'
                      )}
                    >
                      {line}
                    </div>
                  ))}
                  <span className="inline-block w-1 h-1.5 bg-[var(--neon-lime)] animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer - Compact */}
      <div className="flex items-center justify-between px-2 py-0.5 bg-[#0a0a12] border-t border-[#2a2a3a]">
        <div className="flex items-center gap-1">
          <span className="font-mono text-[5px] text-white/30">{CATEGORY_CONFIGS[category].icon}</span>
          <span className="font-mono text-[6px]" style={{ color: currentConfig.color }}>{category}</span>
          {/* Company logo - footer-left position */}
          {logoPosition === 'footer-left' && (
            <span
              className="font-mono text-[5px] font-bold ml-1"
              style={{ color: 'var(--neon-lime)', opacity: 0.4, textShadow: '0 0 2px var(--neon-lime)' }}
            >
              UDEX
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="w-12 h-1 bg-[#1a1a2a] rounded overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: isPowered ? `${healthPercent}%` : '0%',
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
            {isPowered ? `${healthPercent}%` : '0%'}
          </span>
        </div>
      </div>
    </div>
  )
}

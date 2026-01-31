'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { LED } from '../controls/LED'
import { Knob } from '../controls/Knob'
import { useQUAManagerOptional } from '@/contexts/QUAManager'

type DeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'offline'
type TestPhase = 'quantum-core' | 'sensors' | 'neural-net' | 'calibration' | 'complete' | null

interface QuantumAnalyzerProps {
  className?: string
  onTest?: () => void
  onReset?: () => void
}

type AnalysisMode = 'ANOMALY' | 'RESOURCE' | 'DECRYPT' | 'DIAGNOSE' | 'SIMULATE' | 'SCAN'

interface ScanResult {
  id: string
  type: string
  value: string
  status: 'normal' | 'warning' | 'critical' | 'optimal'
}

export function QuantumAnalyzer({ className, onTest, onReset }: QuantumAnalyzerProps) {
  const mgr = useQUAManagerOptional()

  // Device state machine - use manager if available
  const [localDeviceState, setDeviceState] = useState<DeviceState>('booting')
  const [testPhase, setTestPhase] = useState<TestPhase>(null)

  // Map manager state to component state
  const deviceState: DeviceState = mgr
    ? (mgr.deviceState === 'standby' || mgr.deviceState === 'shutdown' ? 'offline' : mgr.deviceState as DeviceState)
    : localDeviceState

  // Power state (derived from device state)
  const isPowered = deviceState === 'online' || deviceState === 'testing'
  const isBooting = deviceState === 'booting'
  const [bootProgress, setBootProgress] = useState(0)

  // Foldable state
  const isExpanded = mgr?.isExpanded ?? true
  const isStandby = mgr?.deviceState === 'standby'
  const [showFoldedInfo, setShowFoldedInfo] = useState(false)
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 5-min auto-close for folded info
  useEffect(() => {
    if (showFoldedInfo) {
      foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000)
      return () => { if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current) }
    }
  }, [showFoldedInfo])

  // Analysis mode - use manager if available
  const [localMode, setLocalMode] = useState<AnalysisMode>('ANOMALY')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const mode: AnalysisMode = mgr?.mode ?? localMode
  const setMode = mgr ? mgr.setMode : setLocalMode

  // Control values - use manager if available
  const [localSensitivity, setLocalSensitivity] = useState(65)
  const [localDepth, setLocalDepth] = useState(50)
  const [localFrequency, setLocalFrequency] = useState(40)
  const sensitivity = mgr?.sensitivity ?? localSensitivity
  const setSensitivity = mgr ? mgr.setSensitivity : setLocalSensitivity
  const depth = mgr?.depth ?? localDepth
  const setDepth = mgr ? mgr.setDepth : setLocalDepth
  const frequency = mgr?.frequency ?? localFrequency
  const setFrequency = mgr ? mgr.setFrequency : setLocalFrequency

  // Results
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [outputLog, setOutputLog] = useState<string[]>([])


  // Waveform data for display
  const [waveformData, setWaveformData] = useState<number[]>(Array(64).fill(50))

  // Ref for autoscroll
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Mode configurations
  const modeConfigs: Record<AnalysisMode, { color: string; icon: string; description: string }> = {
    ANOMALY: { color: 'var(--neon-pink)', icon: '◉', description: 'Detect & classify dimensional anomalies' },
    RESOURCE: { color: 'var(--neon-green)', icon: '◈', description: 'Optimize resource allocation & yield' },
    DECRYPT: { color: 'var(--neon-cyan)', icon: '◇', description: 'Decode encrypted signals & data' },
    DIAGNOSE: { color: 'var(--neon-amber)', icon: '◎', description: 'System health & fault detection' },
    SIMULATE: { color: 'var(--neon-purple)', icon: '▣', description: 'Run predictive simulations' },
    SCAN: { color: 'var(--neon-lime)', icon: '◐', description: 'Deep scan for hidden objects' },
  }

  // Company logo position (random on mount)
  const [logoPosition] = useState(() => {
    const positions = ['header-right', 'footer-left', 'footer-right'] as const
    return positions[Math.floor(Math.random() * positions.length)]
  })

  // Sync output log with manager state transitions
  const prevMgrState = useRef(mgr?.deviceState)
  useEffect(() => {
    if (!mgr) return
    const prev = prevMgrState.current
    prevMgrState.current = mgr.deviceState
    if (prev !== 'online' && mgr.deviceState === 'online' && outputLog.length === 0) {
      setOutputLog([
        'QUANTUM ANALYZER v3.7.2',
        '─────────────────────────────',
        'QUANTUM CORE: INITIALIZED',
        'SENSOR ARRAY: CALIBRATED',
        'NEURAL NETWORK: ONLINE',
        'ANALYSIS ENGINE: READY',
        '─────────────────────────────',
        '> System ready. Select analysis mode.',
      ])
    }
  }, [mgr, mgr?.deviceState, outputLog.length])

  // Boot sequence effect (only for local state - manager handles its own boot)
  useEffect(() => {
    if (mgr) return
    if (deviceState !== 'booting') return

    setBootProgress(0)
    setOutputLog(['QUANTUM ANALYZER v3.7.2', '─────────────────────────────'])

    let progress = 0
    const bootInterval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        progress = 100
        clearInterval(bootInterval)
        setDeviceState('online')
        setOutputLog(prev => [
          ...prev,
          'QUANTUM CORE: INITIALIZED',
          'SENSOR ARRAY: CALIBRATED',
          'NEURAL NETWORK: ONLINE',
          'ANALYSIS ENGINE: READY',
          '─────────────────────────────',
          '> System ready. Select analysis mode.'
        ])
      }
      setBootProgress(progress)
    }, 150)

    return () => clearInterval(bootInterval)
  }, [deviceState])

  // Power toggle
  const handlePowerToggle = () => {
    if (mgr) {
      if (isPowered) {
        mgr.powerOff()
        setOutputLog([])
        setScanResults([])
        setAnalysisProgress(0)
      } else {
        mgr.powerOn()
      }
      return
    }
    if (isPowered) {
      setDeviceState('offline')
      setBootProgress(0)
      setOutputLog([])
      setScanResults([])
      setAnalysisProgress(0)
    } else {
      setDeviceState('booting')
    }
  }

  // Test handler
  const handleTest = () => {
    if (deviceState !== 'online') return
    onTest?.()

    if (mgr) {
      mgr.runTest()
    } else {
      setDeviceState('testing')
      setTimeout(() => {
        setTestPhase(null)
        setDeviceState('online')
      }, 2000)
    }

    setOutputLog([
      '',
      '> QUANTUM ANALYZER DIAGNOSTICS',
      '',
      '  ■ QUANTUM CORE ─────── OK',
      '  ■ SENSORS ──────────── OK',
      '  ■ NEURAL NET ─────────── OK',
      '  ■ CALIBRATION ────────── OK',
      '',
      '═══════════════════════════════',
      '  ╔═══════════════════════════╗',
      '  ║   ALL SYSTEMS NOMINAL     ║',
      '  ║   4/4 TESTS PASSED        ║',
      `  ║   COHERENCE: ${mgr?.coherence ?? 87}%${' '.repeat(12 - String(mgr?.coherence ?? 87).length)}║`,
      '  ╚═══════════════════════════╝',
      '═══════════════════════════════',
      '',
      '> System test complete.',
    ])
  }

  // Reboot sequence
  const handleReboot = () => {
    onReset?.()

    if (mgr) {
      setOutputLog(prev => [...prev, '', '> SYSTEM REBOOT INITIATED...'])
      setScanResults([])
      setAnalysisProgress(0)
      mgr.reboot().then(() => {
        setOutputLog(['QUANTUM ANALYZER v3.7.2', '─────────────────────────────', '> System ready. Select analysis mode.'])
      })
      return
    }

    setDeviceState('rebooting')
    setTestPhase(null)
    setOutputLog(prev => [...prev, '', '> SYSTEM REBOOT INITIATED...'])

    setTimeout(() => {
      setOutputLog(prev => [...prev, '  [SHUTDOWN] Saving state...'])
    }, 200)
    setTimeout(() => {
      setOutputLog(prev => [...prev, '  [SHUTDOWN] Releasing resources...'])
    }, 400)
    setTimeout(() => {
      setOutputLog([])
      setScanResults([])
      setAnalysisProgress(0)
      setBootProgress(0)
      setDeviceState('booting')
    }, 800)
  }

  // Run analysis
  const runAnalysis = () => {
    if (deviceState !== 'online' || isAnalyzing) return

    setIsAnalyzing(true)
    setAnalysisProgress(0)
    setScanResults([])
    setOutputLog(prev => [...prev, ``, `> Initiating ${mode} analysis...`, `  Sensitivity: ${sensitivity}% | Depth: ${depth}% | Freq: ${frequency}Hz`])

    let progress = 0
    const analysisInterval = setInterval(() => {
      progress += Math.random() * 8 + 2
      if (progress >= 100) {
        progress = 100
        clearInterval(analysisInterval)
        setIsAnalyzing(false)
        generateResults()
      }
      setAnalysisProgress(progress)
    }, 100)
  }

  // Generate mode-specific results
  const generateResults = () => {
    const results: ScanResult[] = []
    const logs: string[] = []

    switch (mode) {
      case 'ANOMALY':
        results.push(
          { id: 'A1', type: 'Dimensional Rift', value: `${Math.floor(Math.random() * 50 + 10)}m`, status: Math.random() > 0.7 ? 'critical' : 'warning' },
          { id: 'A2', type: 'Energy Signature', value: `${(Math.random() * 500 + 100).toFixed(1)} TeV`, status: 'normal' },
          { id: 'A3', type: 'Temporal Flux', value: `${(Math.random() * 2).toFixed(3)}σ`, status: Math.random() > 0.5 ? 'warning' : 'normal' },
          { id: 'A4', type: 'Stability Index', value: `${Math.floor(Math.random() * 40 + 60)}%`, status: 'normal' },
        )
        logs.push('  └─ Detected 3 anomaly signatures', '  └─ Nearest rift: Sector 7-G', '  └─ Recommend: Deploy Containment Unit')
        break

      case 'RESOURCE':
        results.push(
          { id: 'R1', type: 'Abstractum Yield', value: `+${Math.floor(Math.random() * 30 + 10)}%`, status: 'optimal' },
          { id: 'R2', type: 'Energy Efficiency', value: `${Math.floor(Math.random() * 20 + 80)}%`, status: Math.random() > 0.3 ? 'optimal' : 'normal' },
          { id: 'R3', type: 'Waste Reduction', value: `${Math.floor(Math.random() * 15 + 5)}%`, status: 'normal' },
          { id: 'R4', type: 'Throughput', value: `${(Math.random() * 5 + 2).toFixed(1)}/s`, status: 'normal' },
        )
        logs.push('  └─ Optimization path found', '  └─ Reallocate: Forge → Synthesizer', '  └─ Est. gain: +18% overall')
        break

      case 'DECRYPT':
        const decrypted = Math.random() > 0.3
        results.push(
          { id: 'D1', type: 'Encryption Type', value: decrypted ? 'AES-512Q' : 'UNKNOWN', status: decrypted ? 'normal' : 'warning' },
          { id: 'D2', type: 'Key Length', value: `${Math.floor(Math.random() * 512 + 256)} bit`, status: 'normal' },
          { id: 'D3', type: 'Decode Status', value: decrypted ? 'SUCCESS' : 'PARTIAL', status: decrypted ? 'optimal' : 'warning' },
          { id: 'D4', type: 'Data Integrity', value: `${Math.floor(Math.random() * 10 + 90)}%`, status: 'normal' },
        )
        logs.push(decrypted ? '  └─ Decryption successful!' : '  └─ Partial decode achieved', '  └─ Quantum key extracted', '  └─ Data transferred to terminal')
        break

      case 'DIAGNOSE':
        const issues = Math.floor(Math.random() * 3)
        results.push(
          { id: 'H1', type: 'Core Temp', value: `${Math.floor(Math.random() * 20 + 25)}°C`, status: 'normal' },
          { id: 'H2', type: 'Power Draw', value: `${Math.floor(Math.random() * 500 + 800)}W`, status: Math.random() > 0.8 ? 'warning' : 'normal' },
          { id: 'H3', type: 'Memory Usage', value: `${Math.floor(Math.random() * 30 + 50)}%`, status: 'normal' },
          { id: 'H4', type: 'Faults Detected', value: `${issues}`, status: issues > 0 ? 'warning' : 'optimal' },
        )
        logs.push(issues > 0 ? `  └─ ${issues} minor fault(s) detected` : '  └─ All systems nominal', '  └─ Recommend: Schedule maintenance', '  └─ Next calibration: 24h')
        break

      case 'SIMULATE':
        results.push(
          { id: 'S1', type: 'Success Prob.', value: `${Math.floor(Math.random() * 30 + 65)}%`, status: Math.random() > 0.5 ? 'optimal' : 'normal' },
          { id: 'S2', type: 'Time to Complete', value: `${Math.floor(Math.random() * 60 + 10)}m`, status: 'normal' },
          { id: 'S3', type: 'Resource Cost', value: `${Math.floor(Math.random() * 200 + 50)} unSC`, status: Math.random() > 0.7 ? 'warning' : 'normal' },
          { id: 'S4', type: 'Risk Factor', value: `${(Math.random() * 0.3).toFixed(2)}`, status: 'normal' },
        )
        logs.push('  └─ Simulation complete: 10,000 iterations', '  └─ Optimal path identified', '  └─ Recommend: Proceed with caution')
        break

      case 'SCAN':
        const found = Math.floor(Math.random() * 5 + 1)
        results.push(
          { id: 'C1', type: 'Objects Found', value: `${found}`, status: found > 3 ? 'optimal' : 'normal' },
          { id: 'C2', type: 'Scan Depth', value: `${Math.floor(depth * 10)}m`, status: 'normal' },
          { id: 'C3', type: 'Signal Clarity', value: `${Math.floor(sensitivity)}%`, status: sensitivity > 70 ? 'optimal' : 'normal' },
          { id: 'C4', type: 'Hidden Caches', value: `${Math.floor(Math.random() * 2)}`, status: 'normal' },
        )
        logs.push(`  └─ Deep scan complete`, `  └─ ${found} object(s) in range`, '  └─ Coordinates logged to map')
        break
    }

    setScanResults(results)
    setOutputLog(prev => [...prev, ...logs, '', '> Analysis complete.'])
  }

  // Animate waveform when analyzing
  useEffect(() => {
    if (!isPowered) {
      setWaveformData(Array(64).fill(50))
      return
    }

    const interval = setInterval(() => {
      setWaveformData(prev =>
        prev.map((_, i) => {
          if (isAnalyzing) {
            return 50 + Math.sin(Date.now() * 0.01 + i * 0.3) * 30 + Math.random() * 20 * (sensitivity / 100)
          }
          return 50 + Math.sin(Date.now() * 0.003 + i * 0.2) * 10 + Math.random() * 5
        })
      )
    }, 50)

    return () => clearInterval(interval)
  }, [isPowered, isAnalyzing, sensitivity])

  // Autoscroll output log when new content is added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [outputLog])

  const currentConfig = modeConfigs[mode]

  const getLedColor = () => {
    if (isStandby) return 'red'
    if (deviceState === 'rebooting') return 'red'
    if (deviceState === 'booting') return 'amber'
    if (deviceState === 'testing') return 'cyan'
    return isPowered ? 'green' : 'red'
  }

  const stateLabel = isStandby ? 'STANDBY' : deviceState === 'booting' ? 'BOOTING' : deviceState === 'testing' ? 'TESTING' : deviceState === 'rebooting' ? 'REBOOTING' : deviceState === 'offline' ? 'OFFLINE' : 'ONLINE'

  return (
    <div className={cn(
      'flex flex-col bg-gradient-to-b from-[#1a1a2a] to-[#0a0a1a] rounded-lg border border-[#2a2a4a] overflow-hidden relative',
      isExpanded ? 'h-full' : '',
      className
    )} style={{ perspective: '600px' }}>
      {/* ===== FOLDED FRONT PANEL ===== */}
      <div style={{
        transform: isExpanded ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 0 : 1,
        position: isExpanded ? 'absolute' : 'relative',
        pointerEvents: isExpanded ? 'none' : 'auto',
        zIndex: isExpanded ? 0 : 2,
        width: '100%', left: 0, top: 0,
      }}>
        <div className="flex items-center gap-2 px-3 py-2">
          <LED on={isPowered || isBooting} color={getLedColor()} size="sm" />
          <span className="font-mono text-[10px] text-[var(--neon-cyan)] font-bold shrink-0">QUA-001</span>
          <span className={cn(
            'font-mono text-[8px] shrink-0',
            isStandby || deviceState === 'offline' ? 'text-white/30' : 'text-[var(--neon-cyan)]/70'
          )}>{stateLabel}</span>
          <div className="flex-1" />

          {isPowered && (
            <>
              {/* Compact test button */}
              <button
                onClick={handleTest}
                disabled={deviceState !== 'online'}
                className={cn(
                  'px-2 py-0.5 rounded font-mono text-[7px] border transition-all disabled:opacity-30',
                  deviceState === 'testing'
                    ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)] text-[var(--neon-cyan)]'
                    : 'bg-[#1a1a2a] border-[#3a3a4a] text-white/50 hover:border-white/30'
                )}
              >TEST</button>
              {/* Compact reset button */}
              <button
                onClick={handleReboot}
                disabled={!isPowered}
                className="px-2 py-0.5 rounded font-mono text-[7px] border transition-all disabled:opacity-30 bg-[#1a1a2a] border-[#3a3a4a] text-white/50 hover:border-white/30"
              >RST</button>
            </>
          )}

          {/* Power button */}
          <button
            onClick={handlePowerToggle}
            className={cn(
              'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
              isPowered
                ? 'bg-[#1a3a2a] border-[var(--neon-green)] shadow-[0_0_8px_var(--neon-green)]'
                : isBooting
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

          {/* Info toggle */}
          {isPowered && (
            <button
              onClick={() => setShowFoldedInfo(p => !p)}
              className="font-mono text-[8px] text-[var(--neon-cyan)]/50 hover:text-[var(--neon-cyan)] transition-colors px-0.5"
              title={showFoldedInfo ? 'Hide info' : 'Show info'}
            >{showFoldedInfo ? '▲' : '▼'}</button>
          )}
        </div>

        {/* Folded info expansion */}
        <div style={{
          maxHeight: showFoldedInfo && isPowered ? '60px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 300ms ease',
        }}>
          <div className="px-3 pb-2 grid grid-cols-3 gap-x-4 gap-y-0.5 font-mono text-[7px]">
            <span className="text-white/40">Mode: <span className="text-[var(--neon-cyan)]">{mode}</span></span>
            <span className="text-white/40">Sens: <span className="text-[var(--neon-cyan)]">{sensitivity}%</span></span>
            <span className="text-white/40">Depth: <span className="text-[var(--neon-cyan)]">{depth}%</span></span>
            <span className="text-white/40">Freq: <span className="text-[var(--neon-cyan)]">{frequency}Hz</span></span>
            <span className="text-white/40">COH: <span className="text-[var(--neon-cyan)]">{mgr?.coherence ?? 87}%</span></span>
            <span className="text-white/40">Draw: <span className="text-[var(--neon-cyan)]">{mgr?.currentDraw ?? 10} E/s</span></span>
          </div>
        </div>
      </div>

      {/* ===== UNFOLDED INNER PANEL ===== */}
      <div className={cn(isExpanded ? 'flex-1 flex flex-col overflow-hidden' : '')} style={{
        transform: isExpanded ? 'translateZ(0) rotateX(0deg)' : 'translateZ(-20px) rotateX(8deg)',
        transformOrigin: 'top center',
        transition: 'transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease',
        opacity: isExpanded ? 1 : 0,
        position: isExpanded ? 'relative' : 'absolute',
        pointerEvents: isExpanded ? 'auto' : 'none',
        zIndex: isExpanded ? 2 : 0,
        width: '100%', left: 0, top: 0,
      }}>
      {/* Fold chevron */}
      {mgr && isPowered && (
        <button
          onClick={() => mgr.toggleExpanded()}
          className="absolute top-[6px] right-[6px] z-10 font-mono text-[8px] text-[var(--neon-cyan)]/40 hover:text-[var(--neon-cyan)] transition-colors"
          title="Fold"
        >▴</button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0a0a1a] border-b border-[#2a2a4a]">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePowerToggle}
            className={cn(
              'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
              isPowered
                ? 'bg-[#1a3a2a] border-[var(--neon-green)] shadow-[0_0_12px_var(--neon-green)]'
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
            <div className="font-mono text-[10px] text-[var(--neon-cyan)] font-bold">QUANTUM ANALYZER</div>
            <div className="font-mono text-[7px] text-white/40">Universal Problem Solver v3.7</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Company logo - header-right position */}
          {logoPosition === 'header-right' && (
            <span
              className="font-mono text-[6px] font-bold mr-1"
              style={{ color: 'var(--neon-cyan)', opacity: 0.5, textShadow: '0 0 3px var(--neon-cyan)' }}
            >
              QNTX
            </span>
          )}
          <LED on={isPowered} color="green" size="sm" />
          <LED on={isAnalyzing || deviceState === 'testing'} color="amber" size="sm" />
          <LED on={scanResults.length > 0 && scanResults.some(r => r.status === 'critical')} color="red" size="sm" />
        </div>
      </div>

      {/* Boot screen or main content */}
      {deviceState === 'offline' ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="font-mono text-[24px] text-[#1a1a2a] font-bold">QA</div>
            <div className="font-mono text-[8px] text-white/15 mt-1">PRESS POWER TO ACTIVATE</div>
          </div>
        </div>
      ) : deviceState === 'booting' || deviceState === 'rebooting' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="font-mono text-[10px] text-[var(--neon-cyan)] mb-2">INITIALIZING QUANTUM CORE</div>
          <div className="w-48 h-2 bg-[#0a0a0a] rounded overflow-hidden border border-[#2a2a4a]">
            <div
              className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] transition-all"
              style={{ width: `${bootProgress}%` }}
            />
          </div>
          <div className="font-mono text-[8px] text-white/40 mt-1">{Math.floor(bootProgress)}%</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-2 gap-1.5 overflow-hidden">
          {/* Mode selector - compact */}
          <div className="flex gap-0.5 shrink-0">
            {(Object.keys(modeConfigs) as AnalysisMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 py-1 rounded font-mono text-[6px] transition-all',
                  mode === m
                    ? 'text-black font-bold shadow-lg'
                    : 'bg-[#1a1a2a] text-white/50 border border-[#2a2a4a] hover:border-white/20'
                )}
                style={{
                  backgroundColor: mode === m ? modeConfigs[m].color : undefined,
                  boxShadow: mode === m ? `0 0 8px ${modeConfigs[m].color}` : undefined,
                }}
              >
                <span className="mr-0.5">{modeConfigs[m].icon}</span>
                {m}
              </button>
            ))}
          </div>

          {/* Mode description - compact */}
          <div className="font-mono text-[6px] text-center shrink-0" style={{ color: currentConfig.color }}>
            {currentConfig.description}
          </div>

          {/* Waveform display - fixed height */}
          <div className="h-12 shrink-0 bg-[#050510] rounded border border-[#1a1a3a] relative overflow-hidden">
            <div className="absolute inset-0 flex items-end justify-around px-0.5 pb-0.5">
              {waveformData.map((height, i) => (
                <div
                  key={i}
                  className="w-0.5 transition-all duration-75"
                  style={{
                    height: `${height}%`,
                    backgroundColor: currentConfig.color,
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
            {/* Scan line effect */}
            {isAnalyzing && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-white/30"
                style={{
                  left: `${analysisProgress}%`,
                  boxShadow: '0 0 10px white',
                }}
              />
            )}
            {/* Grid overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: `
                linear-gradient(to right, ${currentConfig.color}10 1px, transparent 1px),
                linear-gradient(to bottom, ${currentConfig.color}10 1px, transparent 1px)
              `,
              backgroundSize: '10% 25%',
            }} />
          </div>

          {/* Controls + Results combined row */}
          <div className="flex gap-1.5 shrink-0">
            {/* Knobs */}
            <div className="flex items-center gap-2 bg-[#0a0a1a] rounded p-1.5 border border-[#1a1a3a]">
              <div className="flex flex-col items-center">
                <span className="font-mono text-[5px] text-white/40">SENS</span>
                <Knob value={sensitivity} onChange={setSensitivity} size="sm" accentColor={currentConfig.color} />
                <span className="font-mono text-[6px]" style={{ color: currentConfig.color }}>{sensitivity}%</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-mono text-[5px] text-white/40">DEPTH</span>
                <Knob value={depth} onChange={setDepth} size="sm" accentColor={currentConfig.color} />
                <span className="font-mono text-[6px]" style={{ color: currentConfig.color }}>{depth}%</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-mono text-[5px] text-white/40">FREQ</span>
                <Knob value={frequency} onChange={setFrequency} size="sm" accentColor={currentConfig.color} />
                <span className="font-mono text-[6px]" style={{ color: currentConfig.color }}>{frequency}Hz</span>
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className={cn(
                'flex-1 rounded font-mono text-[8px] font-bold transition-all',
                isAnalyzing
                  ? 'bg-[var(--neon-amber)] text-black animate-pulse'
                  : 'hover:brightness-110'
              )}
              style={{
                backgroundColor: isAnalyzing ? undefined : currentConfig.color,
                color: 'black',
                boxShadow: `0 0 12px ${currentConfig.color}`,
              }}
            >
              {isAnalyzing ? `${Math.floor(analysisProgress)}%` : 'RUN ANALYSIS'}
            </button>
          </div>

          {/* Results grid - fixed height */}
          <div className="grid grid-cols-4 gap-0.5 h-[36px] shrink-0">
            {scanResults.length > 0 ? (
              scanResults.map((result) => (
                <div
                  key={result.id}
                  className={cn(
                    'p-1 rounded border',
                    result.status === 'critical' ? 'bg-[var(--neon-red)]/10 border-[var(--neon-red)]/50' :
                    result.status === 'warning' ? 'bg-[var(--neon-amber)]/10 border-[var(--neon-amber)]/50' :
                    result.status === 'optimal' ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)]/50' :
                    'bg-[#1a1a2a] border-[#2a2a4a]'
                  )}
                >
                  <div className="font-mono text-[5px] text-white/50 truncate">{result.type}</div>
                  <div className={cn(
                    'font-mono text-[8px] font-bold',
                    result.status === 'critical' ? 'text-[var(--neon-red)]' :
                    result.status === 'warning' ? 'text-[var(--neon-amber)]' :
                    result.status === 'optimal' ? 'text-[var(--neon-green)]' :
                    'text-white'
                  )}>
                    {result.value}
                  </div>
                </div>
              ))
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-1 rounded border bg-[#0a0a15] border-[#1a1a2a]">
                  <div className="font-mono text-[5px] text-white/15">SLOT {i + 1}</div>
                  <div className="font-mono text-[8px] font-bold text-white/10">--</div>
                </div>
              ))
            )}
          </div>

          {/* Output log - Old CRT screen style */}
          <div className="flex-1 min-h-[60px] relative rounded overflow-hidden shrink-0"
            style={{
              background: '#020804',
              boxShadow: 'inset 0 0 30px rgba(0,20,0,0.8), inset 0 0 10px rgba(0,0,0,0.9)',
              border: '2px solid #1a1a1a',
              borderRadius: '4px',
            }}
          >
            {/* CRT screen bezel */}
            <div className="absolute inset-0 rounded"
              style={{
                background: 'linear-gradient(145deg, #2a2a2a 0%, #0a0a0a 50%, #1a1a1a 100%)',
                padding: '3px',
              }}
            >
              {/* Inner screen area */}
              <div className="relative w-full h-full rounded-sm overflow-hidden"
                style={{
                  background: '#010602',
                  boxShadow: 'inset 0 0 20px rgba(0,40,0,0.5)',
                }}
              >
                {/* Screen content */}
                <div
                  ref={logContainerRef}
                  className="absolute inset-1 overflow-y-auto font-mono text-[6px] leading-relaxed z-10"
                  style={{ textShadow: '0 0 2px rgba(0,255,0,0.5)' }}
                >
                  {outputLog.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        line.includes('SUCCESS') || line.includes('READY') || line.includes('complete') ? 'text-[#4eff4e]' :
                        line.includes('WARNING') || line.includes('fault') ? 'text-[#ffcc00]' :
                        line.includes('ERROR') || line.includes('CRITICAL') ? 'text-[#ff4444]' :
                        line.startsWith('─') || line.startsWith('>') ? 'text-[#00ffaa]' :
                        line.startsWith('  └') ? 'text-[#33aa33]' :
                        'text-[#33ff33]'
                      )}
                    >
                      {line}
                    </div>
                  ))}
                  {isPowered && <span className="inline-block w-1.5 h-2.5 bg-[#33ff33] animate-pulse ml-0.5" style={{ boxShadow: '0 0 4px #33ff33' }} />}
                </div>

                {/* CRT scanlines overlay */}
                <div className="absolute inset-0 pointer-events-none z-20"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(0,0,0,0.3) 1px, rgba(0,0,0,0.3) 2px)',
                    backgroundSize: '100% 2px',
                  }}
                />

                {/* Screen flicker effect */}
                <div className="absolute inset-0 pointer-events-none z-20 opacity-[0.02]"
                  style={{ animation: 'crt-flicker 0.1s infinite' }}
                />

                {/* Vignette/curvature effect */}
                <div className="absolute inset-0 pointer-events-none z-30"
                  style={{
                    background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0.8) 100%)',
                  }}
                />

                {/* Screen reflection */}
                <div className="absolute inset-0 pointer-events-none z-30 opacity-10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
                  }}
                />

                {/* Phosphor glow */}
                <div className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,60,0,0.15) 0%, transparent 70%)',
                  }}
                />
              </div>
            </div>

            <style jsx>{`
              @keyframes crt-flicker {
                0%, 100% { opacity: 0.02; }
                50% { opacity: 0.04; }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* Footer status bar with test/reset buttons */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#0a0a1a] border-t border-[#2a2a4a]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[6px] text-white/30">MODE:</span>
          <span className="font-mono text-[7px]" style={{ color: currentConfig.color }}>{mode}</span>
          {/* Company logo - footer-left position */}
          {logoPosition === 'footer-left' && (
            <span
              className="font-mono text-[5px] font-bold ml-1"
              style={{ color: 'var(--neon-cyan)', opacity: 0.4, textShadow: '0 0 2px var(--neon-cyan)' }}
            >
              QNTX
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[6px] text-white/30">QUANTUM COHERENCE</span>
          <div className="w-12 h-1.5 bg-[#1a1a2a] rounded overflow-hidden">
            <div className="h-full bg-[var(--neon-cyan)]" style={{ width: isPowered ? `${mgr?.coherence ?? 87}%` : '0%' }} />
          </div>
          <span className="font-mono text-[6px] text-[var(--neon-cyan)]">{isPowered ? `${mgr?.coherence ?? 87}%` : '0%'}</span>
          {/* Company logo - footer-right position */}
          {logoPosition === 'footer-right' && (
            <span
              className="font-mono text-[5px] font-bold"
              style={{ color: 'var(--neon-cyan)', opacity: 0.4, textShadow: '0 0 2px var(--neon-cyan)' }}
            >
              QNTX
            </span>
          )}
        </div>
      </div>

      {/* Bottom control bar with metal knurled buttons */}
      <div className="flex items-center justify-center gap-3 px-2 py-1.5 bg-gradient-to-t from-[#0a0a0a] to-[#0a0a1a] border-t border-[#1a1a2a]">
        {/* Test button - metal knurled square */}
        <button
          onClick={handleTest}
          disabled={deviceState !== 'online'}
          className={cn(
            'w-6 h-6 rounded-[3px] border transition-all duration-200 relative overflow-hidden',
            'flex items-center justify-center',
            deviceState === 'online'
              ? 'border-white/30 cursor-pointer hover:border-[var(--neon-cyan)]/60'
              : 'border-white/10 cursor-not-allowed opacity-50'
          )}
          style={{
            background: deviceState === 'online'
              ? 'linear-gradient(145deg, #4a4a5a 0%, #2a2a3a 40%, #3a3a4a 100%)'
              : 'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)',
            boxShadow: deviceState === 'testing'
              ? '0 0 8px var(--neon-cyan), inset 0 1px 0 rgba(255,255,255,0.15)'
              : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
          }}
          title="RUN TEST"
        >
          {/* Knurl pattern - cross-hatch */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                repeating-linear-gradient(45deg, transparent 0px, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 3px),
                repeating-linear-gradient(-45deg, transparent 0px, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 3px)
              `,
            }}
          />
          {/* Inner indicator */}
          <div
            className="w-2.5 h-2.5 rounded-[2px] relative z-10"
            style={{
              background: deviceState === 'testing'
                ? 'var(--neon-cyan)'
                : 'linear-gradient(145deg, #5a5a6a 0%, #3a3a4a 100%)',
              boxShadow: deviceState === 'testing'
                ? '0 0 6px var(--neon-cyan)'
                : 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)',
            }}
          />
        </button>

        <span className="font-mono text-[5px] text-white/20">TEST</span>

        <div className="w-px h-4 bg-white/10" />

        <span className="font-mono text-[5px] text-white/20">RESET</span>

        {/* Reset button - metal knurled square */}
        <button
          onClick={handleReboot}
          disabled={deviceState === 'booting' || deviceState === 'rebooting'}
          className={cn(
            'w-6 h-6 rounded-[3px] border transition-all duration-200 relative overflow-hidden',
            'flex items-center justify-center',
            deviceState !== 'booting' && deviceState !== 'rebooting'
              ? 'border-white/30 cursor-pointer hover:border-red-500/60'
              : 'border-white/10 cursor-not-allowed opacity-50'
          )}
          style={{
            background: deviceState !== 'booting' && deviceState !== 'rebooting'
              ? 'linear-gradient(145deg, #4a4a5a 0%, #2a2a3a 40%, #3a3a4a 100%)'
              : 'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)',
            boxShadow: deviceState === 'rebooting'
              ? '0 0 8px var(--neon-amber), inset 0 1px 0 rgba(255,255,255,0.15)'
              : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
          }}
          title="REBOOT SYSTEM"
        >
          {/* Knurl pattern - diamond */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                repeating-linear-gradient(60deg, transparent 0px, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 3px),
                repeating-linear-gradient(-60deg, transparent 0px, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 3px)
              `,
            }}
          />
          {/* Inner indicator */}
          <div
            className="w-2.5 h-2.5 rounded-[2px] relative z-10"
            style={{
              background: deviceState === 'rebooting'
                ? 'var(--neon-amber)'
                : 'linear-gradient(145deg, #5a5a6a 0%, #3a3a4a 100%)',
              boxShadow: deviceState === 'rebooting'
                ? '0 0 6px var(--neon-amber)'
                : 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>
      </div>
    </div>
  )
}

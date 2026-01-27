'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { PanelFrame } from '../PanelFrame'
import { LED } from '../controls/LED'
import { Knob } from '../controls/Knob'

interface QuantumAnalyzerProps {
  className?: string
}

type AnalysisMode = 'ANOMALY' | 'RESOURCE' | 'DECRYPT' | 'DIAGNOSE' | 'SIMULATE' | 'SCAN'

interface ScanResult {
  id: string
  type: string
  value: string
  status: 'normal' | 'warning' | 'critical' | 'optimal'
}

export function QuantumAnalyzer({ className }: QuantumAnalyzerProps) {
  // Power state
  const [isPowered, setIsPowered] = useState(false)
  const [bootProgress, setBootProgress] = useState(0)
  const [isBooting, setIsBooting] = useState(false)

  // Analysis mode
  const [mode, setMode] = useState<AnalysisMode>('ANOMALY')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)

  // Control values
  const [sensitivity, setSensitivity] = useState(65)
  const [depth, setDepth] = useState(50)
  const [frequency, setFrequency] = useState(40)

  // Results
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [outputLog, setOutputLog] = useState<string[]>([])

  // Waveform data for display
  const [waveformData, setWaveformData] = useState<number[]>(Array(64).fill(50))

  // Mode configurations
  const modeConfigs: Record<AnalysisMode, { color: string; icon: string; description: string }> = {
    ANOMALY: { color: 'var(--neon-pink)', icon: '◉', description: 'Detect & classify dimensional anomalies' },
    RESOURCE: { color: 'var(--neon-green)', icon: '◈', description: 'Optimize resource allocation & yield' },
    DECRYPT: { color: 'var(--neon-cyan)', icon: '◇', description: 'Decode encrypted signals & data' },
    DIAGNOSE: { color: 'var(--neon-amber)', icon: '◎', description: 'System health & fault detection' },
    SIMULATE: { color: 'var(--neon-purple)', icon: '▣', description: 'Run predictive simulations' },
    SCAN: { color: 'var(--neon-lime)', icon: '◐', description: 'Deep scan for hidden objects' },
  }

  // Boot sequence
  const handlePowerToggle = () => {
    if (isPowered) {
      // Shutdown
      setIsPowered(false)
      setBootProgress(0)
      setOutputLog([])
      setScanResults([])
      setAnalysisProgress(0)
    } else {
      // Boot
      setIsBooting(true)
      setBootProgress(0)
      setOutputLog(['QUANTUM ANALYZER v3.7.2', '─────────────────────────────'])

      let progress = 0
      const bootInterval = setInterval(() => {
        progress += Math.random() * 15 + 5
        if (progress >= 100) {
          progress = 100
          clearInterval(bootInterval)
          setIsBooting(false)
          setIsPowered(true)
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
    }
  }

  // Run analysis
  const runAnalysis = () => {
    if (!isPowered || isAnalyzing) return

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

  const currentConfig = modeConfigs[mode]

  return (
    <div className={cn(
      'flex flex-col h-full bg-gradient-to-b from-[#1a1a2a] to-[#0a0a1a] rounded-lg border border-[#2a2a4a] overflow-hidden',
      className
    )}>
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
          <LED on={isPowered} color="green" size="sm" />
          <LED on={isAnalyzing} color="amber" size="sm" />
          <LED on={scanResults.length > 0 && scanResults.some(r => r.status === 'critical')} color="red" size="sm" />
        </div>
      </div>

      {/* Boot screen or main content */}
      {!isPowered && !isBooting ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="font-mono text-[24px] text-[#1a1a2a] font-bold">QA</div>
            <div className="font-mono text-[8px] text-white/15 mt-1">PRESS POWER TO ACTIVATE</div>
          </div>
        </div>
      ) : isBooting ? (
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
        <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
          {/* Mode selector */}
          <div className="flex gap-1">
            {(Object.keys(modeConfigs) as AnalysisMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 py-1.5 rounded font-mono text-[7px] transition-all',
                  mode === m
                    ? 'text-black font-bold shadow-lg'
                    : 'bg-[#1a1a2a] text-white/50 border border-[#2a2a4a] hover:border-white/20'
                )}
                style={{
                  backgroundColor: mode === m ? modeConfigs[m].color : undefined,
                  boxShadow: mode === m ? `0 0 10px ${modeConfigs[m].color}` : undefined,
                }}
              >
                <span className="mr-1">{modeConfigs[m].icon}</span>
                {m}
              </button>
            ))}
          </div>

          {/* Mode description */}
          <div className="font-mono text-[7px] text-white/40 text-center" style={{ color: currentConfig.color }}>
            {currentConfig.description}
          </div>

          {/* Waveform display */}
          <div className="h-16 bg-[#050510] rounded border border-[#1a1a3a] relative overflow-hidden">
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

          {/* Controls row */}
          <div className="flex items-center justify-between bg-[#0a0a1a] rounded p-2 border border-[#1a1a3a]">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="font-mono text-[6px] text-white/40">SENS</span>
                <Knob value={sensitivity} onChange={setSensitivity} size="sm" accentColor={currentConfig.color} />
                <span className="font-mono text-[7px]" style={{ color: currentConfig.color }}>{sensitivity}%</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-mono text-[6px] text-white/40">DEPTH</span>
                <Knob value={depth} onChange={setDepth} size="sm" accentColor={currentConfig.color} />
                <span className="font-mono text-[7px]" style={{ color: currentConfig.color }}>{depth}%</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-mono text-[6px] text-white/40">FREQ</span>
                <Knob value={frequency} onChange={setFrequency} size="sm" accentColor={currentConfig.color} />
                <span className="font-mono text-[7px]" style={{ color: currentConfig.color }}>{frequency}Hz</span>
              </div>
            </div>

            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className={cn(
                'px-4 py-2 rounded font-mono text-[9px] font-bold transition-all',
                isAnalyzing
                  ? 'bg-[var(--neon-amber)] text-black animate-pulse'
                  : 'hover:brightness-110'
              )}
              style={{
                backgroundColor: isAnalyzing ? undefined : currentConfig.color,
                color: 'black',
                boxShadow: `0 0 15px ${currentConfig.color}`,
              }}
            >
              {isAnalyzing ? `ANALYZING ${Math.floor(analysisProgress)}%` : 'RUN ANALYSIS'}
            </button>
          </div>

          {/* Results grid */}
          {scanResults.length > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {scanResults.map((result) => (
                <div
                  key={result.id}
                  className={cn(
                    'p-1.5 rounded border',
                    result.status === 'critical' ? 'bg-[var(--neon-red)]/10 border-[var(--neon-red)]/50' :
                    result.status === 'warning' ? 'bg-[var(--neon-amber)]/10 border-[var(--neon-amber)]/50' :
                    result.status === 'optimal' ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)]/50' :
                    'bg-[#1a1a2a] border-[#2a2a4a]'
                  )}
                >
                  <div className="font-mono text-[6px] text-white/50">{result.type}</div>
                  <div className={cn(
                    'font-mono text-[10px] font-bold',
                    result.status === 'critical' ? 'text-[var(--neon-red)]' :
                    result.status === 'warning' ? 'text-[var(--neon-amber)]' :
                    result.status === 'optimal' ? 'text-[var(--neon-green)]' :
                    'text-white'
                  )}>
                    {result.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Output log */}
          <div className="flex-1 bg-[#050510] rounded border border-[#1a1a3a] p-1.5 overflow-hidden">
            <div className="h-full overflow-y-auto font-mono text-[7px]">
              {outputLog.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'leading-relaxed',
                    line.includes('SUCCESS') || line.includes('READY') || line.includes('complete') ? 'text-[var(--neon-green)]' :
                    line.includes('WARNING') || line.includes('fault') ? 'text-[var(--neon-amber)]' :
                    line.includes('ERROR') || line.includes('CRITICAL') ? 'text-[var(--neon-red)]' :
                    line.startsWith('─') || line.startsWith('>') ? 'text-[var(--neon-cyan)]' :
                    line.startsWith('  └') ? 'text-white/60' :
                    'text-[var(--crt-green)]'
                  )}
                >
                  {line}
                </div>
              ))}
              {isPowered && <span className="inline-block w-1.5 h-3 bg-[var(--crt-green)] animate-pulse ml-0.5" />}
            </div>
          </div>
        </div>
      )}

      {/* Footer status bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#0a0a1a] border-t border-[#2a2a4a]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[6px] text-white/30">MODE:</span>
          <span className="font-mono text-[7px]" style={{ color: currentConfig.color }}>{mode}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[6px] text-white/30">QUANTUM COHERENCE</span>
          <div className="w-12 h-1.5 bg-[#1a1a2a] rounded overflow-hidden">
            <div className="h-full bg-[var(--neon-cyan)]" style={{ width: isPowered ? '87%' : '0%' }} />
          </div>
          <span className="font-mono text-[6px] text-[var(--neon-cyan)]">{isPowered ? '87%' : '0%'}</span>
        </div>
      </div>
    </div>
  )
}

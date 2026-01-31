'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// QUA Device States
type QUADeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type QUATestPhase = 'quantum-core' | 'sensors' | 'neural-net' | 'calibration' | 'complete' | null
type QUABootPhase = 'core' | 'sensors' | 'neural' | 'calibrate' | 'ready' | null
type QUAShutdownPhase = 'save' | 'release' | 'offline' | null

type AnalysisMode = 'ANOMALY' | 'RESOURCE' | 'DECRYPT' | 'DIAGNOSE' | 'SIMULATE' | 'SCAN'

// Firmware metadata
export const QUA_FIRMWARE = {
  version: '3.7.2',
  build: '2026.01.29',
  checksum: 'Q7A3N5X8',
  features: ['quantum-core', 'neural-network', 'multi-mode', 'waveform-gen', 'deep-scan'],
  securityPatch: '2026.01.25',
}

// Power specs
export const QUA_POWER_SPECS = {
  full: 25,
  idle: 10,
  standby: 2,
  analysis: 35,
  category: 'heavy' as const,
  priority: 2 as const,
}

interface QUAState {
  deviceState: QUADeviceState
  bootPhase: QUABootPhase
  testPhase: QUATestPhase
  shutdownPhase: QUAShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  mode: AnalysisMode
  sensitivity: number
  depth: number
  frequency: number
  coherence: number
  isAnalyzing: boolean
  currentDraw: number
}

interface QUAManagerContextType extends QUAState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setMode: (mode: AnalysisMode) => void
  setSensitivity: (value: number) => void
  setDepth: (value: number) => void
  setFrequency: (value: number) => void
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  isExpanded: boolean
  firmware: typeof QUA_FIRMWARE
  powerSpecs: typeof QUA_POWER_SPECS
}

const QUAManagerContext = createContext<QUAManagerContextType | null>(null)

interface QUAManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered?: boolean; mode?: string; sensitivity?: number; depth?: number; frequency?: number; isExpanded?: boolean }
}

export function QUAManagerProvider({ children, initialState }: QUAManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered

  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])

  const [deviceState, setDeviceState] = useState<QUADeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<QUABootPhase>(startPowered ? 'core' : null)
  const [testPhase, setTestPhase] = useState<QUATestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<QUAShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(startPowered ? QUA_POWER_SPECS.full : QUA_POWER_SPECS.standby)

  const [mode, setMode] = useState<AnalysisMode>((initialState?.mode as AnalysisMode) ?? 'ANOMALY')
  const [sensitivity, setSensitivity] = useState(initialState?.sensitivity ?? 65)
  const [depth, setDepth] = useState(initialState?.depth ?? 50)
  const [frequency, setFrequency] = useState(initialState?.frequency ?? 40)
  const [coherence, setCoherence] = useState(0)
  const [isAnalyzing] = useState(false)

  // Simulate fluctuating coherence when online
  useEffect(() => {
    if (deviceState !== 'online') return

    const interval = setInterval(() => {
      setCoherence(prev => {
        const delta = (Math.random() - 0.5) * 6
        return Math.round(Math.max(80, Math.min(99, prev + delta)))
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(QUA_POWER_SPECS.full)

    setBootPhase('core')
    setStatusMessage('Quantum core init...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('sensors')
    setStatusMessage('Sensor calibration...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('neural')
    setStatusMessage('Neural network load...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('ready')
    setCoherence(87)
    setDeviceState('online')
    setCurrentDraw(QUA_POWER_SPECS.idle)
    setStatusMessage('READY')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(QUA_POWER_SPECS.idle)

    setShutdownPhase('save')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('release')
    setStatusMessage('Releasing resources...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('offline')
    setStatusMessage('Powering down...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(QUA_POWER_SPECS.standby)
    setStatusMessage('Standby mode')
    setCoherence(0)
  }, [])

  const powerOn = useCallback(async () => {
    if (deviceState !== 'standby') return
    setIsPowered(true)
    setIsExpanded(true)
    await runBootSequence()
  }, [deviceState, runBootSequence])

  const powerOff = useCallback(async () => {
    if (deviceState !== 'online') return
    setIsPowered(false)
    setIsExpanded(false)
    await runShutdownSequence()
  }, [deviceState, runShutdownSequence])

  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)
    setCurrentDraw(QUA_POWER_SPECS.analysis)

    const phases: NonNullable<QUATestPhase>[] = ['quantum-core', 'sensors', 'neural-net', 'calibration', 'complete']
    const phaseMessages: Record<NonNullable<QUATestPhase>, string> = {
      'quantum-core': 'Testing quantum core...',
      sensors: 'Verifying sensors...',
      'neural-net': 'Neural network check...',
      calibration: 'Calibration verify...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 450))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(QUA_POWER_SPECS.idle)
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('READY')
    }, 3000)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(QUA_POWER_SPECS.full)

    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Re-initializing...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Auto-boot on mount
  const hasBootedRef = useRef(false)
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true
      if (startPowered) {
        runBootSequence()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: QUAManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    mode,
    sensitivity,
    depth,
    frequency,
    coherence,
    isAnalyzing,
    currentDraw,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setMode,
    setSensitivity,
    setDepth,
    setFrequency,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: QUA_FIRMWARE,
    powerSpecs: QUA_POWER_SPECS,
  }

  return (
    <QUAManagerContext.Provider value={value}>
      {children}
    </QUAManagerContext.Provider>
  )
}

export function useQUAManager() {
  const context = useContext(QUAManagerContext)
  if (!context) {
    throw new Error('useQUAManager must be used within a QUAManagerProvider')
  }
  return context
}

export function useQUAManagerOptional() {
  return useContext(QUAManagerContext)
}

'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// AND Device States
type ANDDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type ANDTestPhase = 'sensors' | 'calibrate' | 'sweep' | 'analyze' | 'verify' | 'complete' | null
type ANDBootPhase = 'sensors' | 'calibrate' | 'freq-sweep' | 'scanning' | 'analysis' | 'ready' | null
type ANDShutdownPhase = 'saving' | 'sensor-stop' | 'halted' | null
export type ANDMode = 'waveform' | 'spectrum' | 'heatmap' | 'timeline' | 'frequency' | 'radar'

// Firmware metadata
export const AND_FIRMWARE = {
  version: '2.3.0',
  build: '2025.11.08',
  checksum: 'AN0MALY01',
  features: ['waveform-scan', 'anomaly-detect', 'signal-analysis', 'freq-sweep', 'multi-mode', 'halo-link'],
  securityPatch: '2025.11.01',
}

// Power specs
export const AND_POWER_SPECS = {
  full: 4,
  idle: 2,
  standby: 0.1,
  category: 'medium' as const,
  priority: 2 as const,
}

interface ANDState {
  deviceState: ANDDeviceState
  bootPhase: ANDBootPhase
  testPhase: ANDTestPhase
  shutdownPhase: ANDShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  signalStrength: number
  anomaliesFound: number
  displayMode: ANDMode
  waveOffset: number
}

interface ANDManagerContextType extends ANDState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  cycleMode: () => void
  setMode: (mode: ANDMode) => void
  setSignalStrength: (value: number) => void
  setAnomaliesFound: (value: number) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof AND_FIRMWARE
  powerSpecs: typeof AND_POWER_SPECS
}

const ANDManagerContext = createContext<ANDManagerContextType | null>(null)

interface ANDManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; signalStrength?: number; anomaliesFound?: number; displayMode?: ANDMode; isExpanded?: boolean }
}

export function ANDManagerProvider({ children, initialState }: ANDManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<ANDDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<ANDBootPhase>(startPowered ? 'sensors' : null)
  const [testPhase, setTestPhase] = useState<ANDTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<ANDShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Init...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(AND_POWER_SPECS.idle)
  const [displayMode, setDisplayMode] = useState<ANDMode>(initialState?.displayMode ?? 'waveform')
  const [signalStrength, setSignalStrengthState] = useState(initialState?.signalStrength ?? 67)
  const [anomaliesFound, setAnomaliesFoundState] = useState(initialState?.anomaliesFound ?? 3)
  const [waveOffset, setWaveOffset] = useState(0)

  const signalTargetRef = useRef(initialState?.signalStrength ?? 67)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(AND_POWER_SPECS.full)

    setBootPhase('sensors')
    setStatusMessage('Sensor init...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('freq-sweep')
    setStatusMessage('Freq sweep...')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('scanning')
    setStatusMessage('Scanning...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('analysis')
    setStatusMessage('Analysis...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(AND_POWER_SPECS.idle)
    setStatusMessage('SCANNING')
    setBootPhase(null)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(AND_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving data...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('sensor-stop')
    setStatusMessage('Sensor halt...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(AND_POWER_SPECS.standby)
    setStatusMessage('Standby mode')
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
    setCurrentDraw(AND_POWER_SPECS.full)

    const phases: NonNullable<ANDTestPhase>[] = ['sensors', 'calibrate', 'sweep', 'analyze', 'verify', 'complete']
    const phaseMessages: Record<NonNullable<ANDTestPhase>, string> = {
      sensors: 'Testing sensors...',
      calibrate: 'Calibrating...',
      sweep: 'Freq sweep...',
      analyze: 'Analyzing...',
      verify: 'Verifying...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      if (phase === 'sweep') {
        signalTargetRef.current = 95
        await new Promise(r => setTimeout(r, 500))
      } else {
        await new Promise(r => setTimeout(r, 400))
      }
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(AND_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('SCANNING')
      signalTargetRef.current = initialState?.signalStrength ?? 67
    }, 2500)
  }, [deviceState, initialState?.signalStrength])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(AND_POWER_SPECS.full)

    setStatusMessage('Shutdown...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset sensors...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const cycleMode = useCallback(() => {
    if (deviceState !== 'online') return
    const modes: ANDMode[] = ['waveform', 'spectrum', 'heatmap', 'timeline', 'frequency', 'radar']
    const currentIndex = modes.indexOf(displayMode)
    setDisplayMode(modes[(currentIndex + 1) % modes.length])
  }, [deviceState, displayMode])

  const setMode = useCallback((mode: ANDMode) => {
    if (deviceState !== 'online') return
    setDisplayMode(mode)
  }, [deviceState])

  const setSignalStrength = useCallback((value: number) => {
    signalTargetRef.current = Math.max(0, Math.min(100, value))
  }, [])

  const setAnomaliesFound = useCallback((value: number) => {
    setAnomaliesFoundState(value)
  }, [])

  // Signal fluctuation and wave offset animation
  useEffect(() => {
    if (deviceState !== 'online' && deviceState !== 'testing') return
    const interval = setInterval(() => {
      setSignalStrengthState(prev => {
        const target = signalTargetRef.current
        const fluctuation = (Math.random() - 0.5) * 5 // ±2.5
        const next = target + fluctuation
        return Math.max(0, Math.min(100, next))
      })
      setWaveOffset(prev => prev + 1)
    }, 100)
    return () => clearInterval(interval)
  }, [deviceState])

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

  const value: ANDManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    signalStrength,
    anomaliesFound,
    displayMode,
    waveOffset,
    powerOn,
    powerOff,
    runTest,
    reboot,
    cycleMode,
    setMode,
    setSignalStrength,
    setAnomaliesFound,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: AND_FIRMWARE,
    powerSpecs: AND_POWER_SPECS,
  }

  return (
    <ANDManagerContext.Provider value={value}>
      {children}
    </ANDManagerContext.Provider>
  )
}

export function useANDManager() {
  const context = useContext(ANDManagerContext)
  if (!context) {
    throw new Error('useANDManager must be used within a ANDManagerProvider')
  }
  return context
}

export function useANDManagerOptional() {
  return useContext(ANDManagerContext)
}

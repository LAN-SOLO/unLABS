'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// IPL Device States
type IPLDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type IPLTestPhase = 'prism' | 'spectrum' | 'lens' | 'calibrate' | 'output' | 'complete' | null
type IPLBootPhase = 'prism' | 'spectrum' | 'lens' | 'wavelength' | 'output' | 'ready' | null
type IPLShutdownPhase = 'retract' | 'park' | 'offline' | null

// Firmware metadata - Interpolator
export const IPL_FIRMWARE = {
  version: '2.5.3',
  build: '2024.02.10',
  checksum: 'F3A8C5D7',
  features: ['color-interp', 'era-manipulate', 'prism-array', 'spectrum-lock', 'prediction-engine'],
  securityPatch: '2024.02.05',
}

// Power specs - Interpolator is a medium consumer
export const IPL_POWER_SPECS = {
  full: 20,          // E/s at full operation
  idle: 6,           // E/s buffer maintenance
  standby: 1,        // E/s in standby
  predictive: 30,    // E/s in predictive mode
  category: 'medium' as const,
  priority: 2 as const,
}

interface IPLState {
  deviceState: IPLDeviceState
  bootPhase: IPLBootPhase
  testPhase: IPLTestPhase
  shutdownPhase: IPLShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  // Interpolator-specific state
  spectrumWidth: number
  interpolationAccuracy: number
  inputStreams: number
  predictionHorizon: number
  currentTier: number
}

interface IPLManagerContextType extends IPLState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  updateTier: (tier: number) => void
  // Read-only info
  firmware: typeof IPL_FIRMWARE
  powerSpecs: typeof IPL_POWER_SPECS
}

const IPLManagerContext = createContext<IPLManagerContextType | null>(null)

interface IPLManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean }
}

export function IPLManagerProvider({ children, initialState }: IPLManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<IPLDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<IPLBootPhase>(startPowered ? 'prism' : null)
  const [testPhase, setTestPhase] = useState<IPLTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<IPLShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [spectrumWidth, setSpectrumWidth] = useState(0)
  const [interpolationAccuracy, setInterpolationAccuracy] = useState(97.5)
  const [inputStreams, setInputStreams] = useState(8)
  const [predictionHorizon, setPredictionHorizon] = useState(60)
  const [currentTier, setCurrentTier] = useState(1)

  // Accuracy fluctuation simulation
  useEffect(() => {
    if (deviceState === 'online' && isPowered) {
      const interval = setInterval(() => {
        setInterpolationAccuracy(96.5 + Math.random() * 3)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [deviceState, isPowered])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')

    setBootPhase('prism')
    setStatusMessage('Prism align...')
    setSpectrumWidth(0)
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('spectrum')
    setStatusMessage('Spectrum init...')
    setSpectrumWidth(20)
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('lens')
    setStatusMessage('Lens focus...')
    setSpectrumWidth(50)
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('wavelength')
    setStatusMessage('Wavelength cal...')
    setSpectrumWidth(80)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('output')
    setStatusMessage('Output ready...')
    await new Promise(r => setTimeout(r, 250))

    setSpectrumWidth(100)
    setBootPhase('ready')
    setDeviceState('online')
    setStatusMessage('Interpolation active')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')

    setShutdownPhase('retract')
    setStatusMessage('Retracting prism...')
    setSpectrumWidth(50)
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('park')
    setStatusMessage('Lens park...')
    setSpectrumWidth(0)
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase('offline')
    setStatusMessage('Interpolator offline')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setStatusMessage('Standby')
  }, [])

  // Power ON
  const powerOn = useCallback(async () => {
    if (deviceState !== 'standby') return
    setIsPowered(true)
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Power OFF
  const powerOff = useCallback(async () => {
    if (deviceState !== 'online') return
    setIsPowered(false)
    await runShutdownSequence()
  }, [deviceState, runShutdownSequence])

  // Run test
  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<IPLTestPhase>[] = ['prism', 'spectrum', 'lens', 'calibrate', 'output', 'complete']
    const phaseMessages: Record<NonNullable<IPLTestPhase>, string> = {
      prism: 'Testing prism array...',
      spectrum: 'Checking spectrum...',
      lens: 'Verifying lens focus...',
      calibrate: 'Calibration test...',
      output: 'Output verification...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 280))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('Interpolation active')
    }, 3000)
  }, [deviceState])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Retracting prism...')
    setSpectrumWidth(50)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Lens park...')
    setSpectrumWidth(0)
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Interpolator offline')
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Update tier
  const updateTier = useCallback((tier: number) => {
    setCurrentTier(tier)
    // Adjust capabilities based on tier
    setInputStreams(8 + tier * 2)
    setPredictionHorizon(60 + tier * 15)
    setInterpolationAccuracy(96.5 + tier * 0.5)
  }, [])

  // Auto-boot on mount (skip if starting in standby)
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

  const value: IPLManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    spectrumWidth,
    interpolationAccuracy,
    inputStreams,
    predictionHorizon,
    currentTier,
    powerOn,
    powerOff,
    runTest,
    reboot,
    updateTier,
    firmware: IPL_FIRMWARE,
    powerSpecs: IPL_POWER_SPECS,
  }

  return (
    <IPLManagerContext.Provider value={value}>
      {children}
    </IPLManagerContext.Provider>
  )
}

export function useIPLManager() {
  const context = useContext(IPLManagerContext)
  if (!context) {
    throw new Error('useIPLManager must be used within an IPLManagerProvider')
  }
  return context
}

export function useIPLManagerOptional() {
  return useContext(IPLManagerContext)
}

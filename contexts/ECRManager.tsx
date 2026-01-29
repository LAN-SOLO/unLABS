'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// ECR Device States
type ECRDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type ECRTestPhase = 'antenna' | 'decoder' | 'buffer' | 'sync' | 'output' | 'complete' | null
type ECRBootPhase = 'antenna' | 'decoder' | 'buffer' | 'oracle' | 'signal' | 'ready' | null
type ECRShutdownPhase = 'disconnect' | 'flush' | 'antenna' | null

// Firmware metadata - Echo Recorder
export const ECR_FIRMWARE = {
  version: '1.1.0',
  build: '2024.01.28',
  checksum: 'D7E9F2A3',
  features: ['blockchain-feed', 'rotation-track', 'oracle-sync', 'signal-decode', 'ticker-tap'],
  securityPatch: '2024.01.25',
}

// Power specs - Echo Recorder is a low consumer
export const ECR_POWER_SPECS = {
  full: 5,           // E/s at full operation
  idle: 2,           // E/s warm standby
  standby: 0.3,      // E/s in standby
  recording: 7,      // E/s when actively recording
  category: 'low' as const,
  priority: 4 as const,
}

interface ECRState {
  deviceState: ECRDeviceState
  bootPhase: ECRBootPhase
  testPhase: ECRTestPhase
  shutdownPhase: ECRShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  // Recorder-specific state
  pulseValue: number
  bloomValue: number
  tickerTap: number
  isRecording: boolean
  signalStrength: number
  currentTier: number
}

interface ECRManagerContextType extends ECRState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setKnobValue: (knob: 'pulse' | 'bloom', value: number) => void
  setRecording: (recording: boolean) => void
  updateTier: (tier: number) => void
  // Read-only info
  firmware: typeof ECR_FIRMWARE
  powerSpecs: typeof ECR_POWER_SPECS
}

const ECRManagerContext = createContext<ECRManagerContextType | null>(null)

interface ECRManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; pulseValue: number; bloomValue: number; isRecording: boolean }
}

export function ECRManagerProvider({ children, initialState }: ECRManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<ECRDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<ECRBootPhase>(startPowered ? 'antenna' : null)
  const [testPhase, setTestPhase] = useState<ECRTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<ECRShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [pulseValue, setPulseValue] = useState(40)
  const [bloomValue, setBloomValue] = useState(60)
  const [tickerTap, setTickerTap] = useState(0)
  const [isRecording, setIsRecordingState] = useState(false)
  const [signalStrength, setSignalStrength] = useState(85)
  const [currentTier, setCurrentTier] = useState(1)

  // Ticker tap simulation
  useEffect(() => {
    if (deviceState === 'online' && isPowered) {
      const interval = setInterval(() => {
        setTickerTap(prev => prev + 1)
        setSignalStrength(85 + Math.floor(Math.random() * 10))
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [deviceState, isPowered])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')

    setBootPhase('antenna')
    setStatusMessage('Antenna scan...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('decoder')
    setStatusMessage('Decoder init...')
    setPulseValue(20)
    setBloomValue(30)
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('buffer')
    setStatusMessage('Buffer alloc...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('oracle')
    setStatusMessage('Oracle sync...')
    setPulseValue(30)
    setBloomValue(45)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('signal')
    setStatusMessage('Signal lock...')
    await new Promise(r => setTimeout(r, 250))

    // Final boot - set tier-based values
    const targetPulse = 40 + currentTier * 10
    const targetBloom = 60 + currentTier * 5
    setPulseValue(targetPulse)
    setBloomValue(targetBloom)

    setBootPhase('ready')
    setDeviceState('online')
    setStatusMessage('Ticker Tap ' + tickerTap)
    setBootPhase(null)
  }, [currentTier, tickerTap])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')

    setShutdownPhase('disconnect')
    setStatusMessage('Disconnecting...')
    setIsRecordingState(false)
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('flush')
    setStatusMessage('Flush buffer...')
    setPulseValue(0)
    setBloomValue(0)
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase('antenna')
    setStatusMessage('Antenna off...')
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

    const phases: NonNullable<ECRTestPhase>[] = ['antenna', 'decoder', 'buffer', 'sync', 'output', 'complete']
    const phaseMessages: Record<NonNullable<ECRTestPhase>, string> = {
      antenna: 'Testing antenna...',
      decoder: 'Checking decoder...',
      buffer: 'Verifying buffer...',
      sync: 'Testing oracle sync...',
      output: 'Output check...',
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
      setStatusMessage('Ticker Tap ' + tickerTap)
    }, 3000)
  }, [deviceState, tickerTap])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Disconnecting...')
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Flush buffer...')
    setPulseValue(0)
    setBloomValue(0)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Antenna off...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Recorder offline')
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Set knob value
  const setKnobValue = useCallback((knob: 'pulse' | 'bloom', value: number) => {
    if (deviceState !== 'online') return
    switch (knob) {
      case 'pulse': setPulseValue(value); break
      case 'bloom': setBloomValue(value); break
    }
  }, [deviceState])

  // Set recording state
  const setRecording = useCallback((recording: boolean) => {
    if (deviceState !== 'online') return
    setIsRecordingState(recording)
  }, [deviceState])

  // Update tier
  const updateTier = useCallback((tier: number) => {
    setCurrentTier(tier)
    if (deviceState === 'online') {
      const targetPulse = 40 + tier * 10
      const targetBloom = 60 + tier * 5
      setPulseValue(targetPulse)
      setBloomValue(targetBloom)
    }
  }, [deviceState])

  // Auto-boot on mount (skip if starting in standby)
  const hasBootedRef = useRef(false)
  const savedStateRef = useRef(initialState)
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true
      if (startPowered) {
        runBootSequence().then(() => {
          // Restore saved knob/recording values after boot completes
          if (savedStateRef.current) {
            setPulseValue(savedStateRef.current.pulseValue)
            setBloomValue(savedStateRef.current.bloomValue)
            setIsRecordingState(savedStateRef.current.isRecording)
          }
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: ECRManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    pulseValue,
    bloomValue,
    tickerTap,
    isRecording,
    signalStrength,
    currentTier,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setKnobValue,
    setRecording,
    updateTier,
    firmware: ECR_FIRMWARE,
    powerSpecs: ECR_POWER_SPECS,
  }

  return (
    <ECRManagerContext.Provider value={value}>
      {children}
    </ECRManagerContext.Provider>
  )
}

export function useECRManager() {
  const context = useContext(ECRManagerContext)
  if (!context) {
    throw new Error('useECRManager must be used within a ECRManagerProvider')
  }
  return context
}

export function useECRManagerOptional() {
  return useContext(ECRManagerContext)
}

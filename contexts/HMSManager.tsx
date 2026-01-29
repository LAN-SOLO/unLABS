'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// HMS Device States
type HMSDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type HMSTestPhase = 'oscillator' | 'waveform' | 'filter' | 'output' | 'calibrate' | 'complete' | null
type HMSBootPhase = 'power' | 'oscillator' | 'waveform' | 'filter' | 'calibrate' | 'ready' | null
type HMSShutdownPhase = 'draining' | 'powerdown' | 'standby' | null

// Firmware metadata - Handmade Synthesizer
export const HMS_FIRMWARE = {
  version: '3.2.1',
  build: '2024.02.15',
  checksum: 'C5D8E3F1',
  features: ['multi-osc', 'waveform-gen', 'filter-bank', 'slice-synthesis', 'trait-morph'],
  securityPatch: '2024.02.10',
}

// Power specs - Synthesizer is a medium consumer
export const HMS_POWER_SPECS = {
  full: 8,           // E/s at full operation
  idle: 3,           // E/s warm standby
  standby: 0.5,      // E/s in standby
  resonance: 12,     // E/s in resonance mode
  category: 'medium' as const,
  priority: 3 as const,
}

interface HMSState {
  deviceState: HMSDeviceState
  bootPhase: HMSBootPhase
  testPhase: HMSTestPhase
  shutdownPhase: HMSShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  // Synth-specific state
  pulseValue: number
  tempoValue: number
  freqValue: number
  currentTier: number
  oscillatorCount: number
  waveformType: 'sine' | 'square' | 'saw' | 'triangle'
}

interface HMSManagerContextType extends HMSState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setKnobValue: (knob: 'pulse' | 'tempo' | 'freq', value: number) => void
  setWaveform: (type: 'sine' | 'square' | 'saw' | 'triangle') => void
  updateTier: (tier: number) => void
  // Read-only info
  firmware: typeof HMS_FIRMWARE
  powerSpecs: typeof HMS_POWER_SPECS
}

const HMSManagerContext = createContext<HMSManagerContextType | null>(null)

interface HMSManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; pulseValue: number; tempoValue: number; freqValue: number; waveformType: string }
}

export function HMSManagerProvider({ children, initialState }: HMSManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<HMSDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<HMSBootPhase>(startPowered ? 'power' : null)
  const [testPhase, setTestPhase] = useState<HMSTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<HMSShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [pulseValue, setPulseValue] = useState(35)
  const [tempoValue, setTempoValue] = useState(40)
  const [freqValue, setFreqValue] = useState(37)
  const [currentTier, setCurrentTier] = useState(1)
  const [oscillatorCount, setOscillatorCount] = useState(4)
  const [waveformType, setWaveformType] = useState<'sine' | 'square' | 'saw' | 'triangle'>((initialState?.waveformType as 'sine' | 'square' | 'saw' | 'triangle') ?? 'sine')

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')

    setBootPhase('power')
    setStatusMessage('Power on...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('oscillator')
    setStatusMessage('Oscillator init...')
    setPulseValue(10)
    setTempoValue(10)
    setFreqValue(10)
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('waveform')
    setStatusMessage('Waveform gen...')
    setPulseValue(20)
    setTempoValue(20)
    setFreqValue(20)
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('filter')
    setStatusMessage('Filter bank...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    await new Promise(r => setTimeout(r, 300))

    // Final boot - set tier-based values
    const targetPulse = currentTier * 15 + 20
    const targetTempo = currentTier * 10 + 30
    const targetFreq = currentTier * 12 + 25
    setPulseValue(targetPulse)
    setTempoValue(targetTempo)
    setFreqValue(targetFreq)

    setBootPhase('ready')
    setDeviceState('online')
    setStatusMessage('Synth ready')
    setBootPhase(null)
  }, [currentTier])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')

    setShutdownPhase('draining')
    setStatusMessage('Draining buffers...')
    setPulseValue(0)
    setTempoValue(0)
    setFreqValue(0)
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('powerdown')
    setStatusMessage('Power down...')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase('standby')
    setStatusMessage('Standby mode')
    await new Promise(r => setTimeout(r, 150))

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

    const phases: NonNullable<HMSTestPhase>[] = ['oscillator', 'waveform', 'filter', 'output', 'calibrate', 'complete']
    const phaseMessages: Record<NonNullable<HMSTestPhase>, string> = {
      oscillator: 'Testing oscillators...',
      waveform: 'Checking waveforms...',
      filter: 'Verifying filters...',
      output: 'Testing output stage...',
      calibrate: 'Calibration check...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 300))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('Synth ready')
    }, 3000)
  }, [deviceState])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Draining buffers...')
    setPulseValue(0)
    setTempoValue(0)
    setFreqValue(0)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Power off...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Synth offline')
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Set knob value
  const setKnobValue = useCallback((knob: 'pulse' | 'tempo' | 'freq', value: number) => {
    if (deviceState !== 'online') return
    switch (knob) {
      case 'pulse': setPulseValue(value); break
      case 'tempo': setTempoValue(value); break
      case 'freq': setFreqValue(value); break
    }
  }, [deviceState])

  // Set waveform
  const setWaveform = useCallback((type: 'sine' | 'square' | 'saw' | 'triangle') => {
    if (deviceState !== 'online') return
    setWaveformType(type)
  }, [deviceState])

  // Update tier
  const updateTier = useCallback((tier: number) => {
    setCurrentTier(tier)
    setOscillatorCount(tier + 3) // 4-8 oscillators based on tier
    if (deviceState === 'online') {
      const targetPulse = tier * 15 + 20
      const targetTempo = tier * 10 + 30
      const targetFreq = tier * 12 + 25
      setPulseValue(targetPulse)
      setTempoValue(targetTempo)
      setFreqValue(targetFreq)
    }
  }, [deviceState])

  // Auto-boot on mount (skip if starting in standby)
  const hasBootedRef = useRef(false)
  const savedKnobsRef = useRef(initialState)
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true
      if (startPowered) {
        runBootSequence().then(() => {
          // Restore saved knob values after boot completes
          if (savedKnobsRef.current) {
            setPulseValue(savedKnobsRef.current.pulseValue)
            setTempoValue(savedKnobsRef.current.tempoValue)
            setFreqValue(savedKnobsRef.current.freqValue)
          }
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: HMSManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    pulseValue,
    tempoValue,
    freqValue,
    currentTier,
    oscillatorCount,
    waveformType,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setKnobValue,
    setWaveform,
    updateTier,
    firmware: HMS_FIRMWARE,
    powerSpecs: HMS_POWER_SPECS,
  }

  return (
    <HMSManagerContext.Provider value={value}>
      {children}
    </HMSManagerContext.Provider>
  )
}

export function useHMSManager() {
  const context = useContext(HMSManagerContext)
  if (!context) {
    throw new Error('useHMSManager must be used within a HMSManagerProvider')
  }
  return context
}

export function useHMSManagerOptional() {
  return useContext(HMSManagerContext)
}

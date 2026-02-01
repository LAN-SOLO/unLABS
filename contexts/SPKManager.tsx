'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// SPK Device States
type SPKDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type SPKTestPhase = 'driver' | 'amplifier' | 'dac' | 'filter' | 'output' | 'complete' | null
type SPKBootPhase = 'driver' | 'amplifier' | 'dac' | 'calibrate' | 'output' | 'ready' | null
type SPKShutdownPhase = 'mute' | 'drain' | 'driver-off' | null

// Firmware metadata - Narrow Speaker
export const SPK_FIRMWARE = {
  version: '1.0.0',
  build: '2024.01.20',
  checksum: 'A3C7F1E9',
  features: ['audio-output', 'volume-ctrl', 'freq-filter', 'level-meter', 'mute-gate', 'beam-focus'],
  securityPatch: '2024.01.18',
}

// Power specs - Narrow Speaker is a light consumer
export const SPK_POWER_SPECS = {
  full: 3,            // E/s at full volume
  idle: 0.5,          // E/s idle (powered, no audio)
  standby: 0.1,       // E/s in standby
  category: 'light' as const,
  priority: 3 as const,
}

// Audio specs
export const SPK_AUDIO_SPECS = {
  frequencyResponse: { min: 40, max: 18000 },  // Hz
  powerHandling: 50,   // W peak
  directivity: 30,     // degrees beam angle
  impedance: 8,        // ohms
  sensitivity: 89,     // dB/W/m
}

interface SPKState {
  deviceState: SPKDeviceState
  bootPhase: SPKBootPhase
  testPhase: SPKTestPhase
  shutdownPhase: SPKShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  // Speaker-specific state
  volume: number         // 0-100
  isMuted: boolean
  filters: { bass: boolean; mid: boolean; high: boolean }
  audioLevel: number[]   // 8-element array for level visualization
  peakLevel: number      // 0-100 current peak
}

interface SPKManagerContextType extends SPKState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  toggleMute: () => void
  setFilter: (filter: 'bass' | 'mid' | 'high', enabled: boolean) => void
  toggleFilter: (filter: 'bass' | 'mid' | 'high') => void
  // Fold state
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  // Read-only info
  firmware: typeof SPK_FIRMWARE
  powerSpecs: typeof SPK_POWER_SPECS
  audioSpecs: typeof SPK_AUDIO_SPECS
}

const SPKManagerContext = createContext<SPKManagerContextType | null>(null)

interface SPKManagerProviderProps {
  children: ReactNode
  initialState?: {
    isPowered?: boolean
    volume?: number
    isMuted?: boolean
    filters?: { bass: boolean; mid: boolean; high: boolean }
    isExpanded?: boolean
  }
}

export function SPKManagerProvider({ children, initialState }: SPKManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<SPKDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<SPKBootPhase>(startPowered ? 'driver' : null)
  const [testPhase, setTestPhase] = useState<SPKTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<SPKShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [volume, setVolumeState] = useState(initialState?.volume ?? 45)
  const [isMuted, setIsMutedState] = useState(initialState?.isMuted ?? false)
  const [filters, setFilters] = useState(initialState?.filters ?? { bass: false, mid: true, high: false })
  const [audioLevel, setAudioLevel] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0])
  const [peakLevel, setPeakLevel] = useState(0)

  // Fold state
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])

  // Audio level simulation
  useEffect(() => {
    if (deviceState !== 'online' || isMuted) {
      setAudioLevel([0, 0, 0, 0, 0, 0, 0, 0])
      setPeakLevel(0)
      return
    }

    const interval = setInterval(() => {
      const levels = Array.from({ length: 8 }, () =>
        Math.random() * (volume / 100) * 100
      )
      setAudioLevel(levels)
      setPeakLevel(Math.max(...levels))
    }, 100)

    return () => clearInterval(interval)
  }, [deviceState, isMuted, volume])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')

    setBootPhase('driver')
    setStatusMessage('Driver init...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('amplifier')
    setStatusMessage('Amp warmup...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('dac')
    setStatusMessage('DAC calibrate...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('calibrate')
    setStatusMessage('Freq calibrate...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('output')
    setStatusMessage('Output test...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('ready')
    setDeviceState('online')
    setStatusMessage('Ready')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')

    setShutdownPhase('mute')
    setStatusMessage('Muting output...')
    setAudioLevel([0, 0, 0, 0, 0, 0, 0, 0])
    setPeakLevel(0)
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase('drain')
    setStatusMessage('Draining amp...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('driver-off')
    setStatusMessage('Driver off...')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setStatusMessage('Standby')
  }, [])

  // Power ON
  const powerOn = useCallback(async () => {
    if (deviceState !== 'standby') return
    setIsPowered(true)
    setIsExpanded(true)
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Power OFF
  const powerOff = useCallback(async () => {
    if (deviceState !== 'online') return
    setIsPowered(false)
    await runShutdownSequence()
    setIsExpanded(false)
  }, [deviceState, runShutdownSequence])

  // Run test
  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<SPKTestPhase>[] = ['driver', 'amplifier', 'dac', 'filter', 'output', 'complete']
    const phaseMessages: Record<NonNullable<SPKTestPhase>, string> = {
      driver: 'Testing driver...',
      amplifier: 'Checking amplifier...',
      dac: 'Verifying DAC...',
      filter: 'Testing filters...',
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
      setStatusMessage('Ready')
    }, 3000)
  }, [deviceState])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Muting...')
    setAudioLevel([0, 0, 0, 0, 0, 0, 0, 0])
    setPeakLevel(0)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Draining amp...')
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Driver off...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Speaker offline')
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Volume control
  const setVolume = useCallback((v: number) => {
    if (deviceState !== 'online') return
    setVolumeState(Math.max(0, Math.min(100, v)))
  }, [deviceState])

  // Mute control
  const setMuted = useCallback((muted: boolean) => {
    if (deviceState !== 'online') return
    setIsMutedState(muted)
  }, [deviceState])

  const toggleMute = useCallback(() => {
    if (deviceState !== 'online') return
    setIsMutedState(prev => !prev)
  }, [deviceState])

  // Filter control
  const setFilter = useCallback((filter: 'bass' | 'mid' | 'high', enabled: boolean) => {
    if (deviceState !== 'online') return
    setFilters(prev => ({ ...prev, [filter]: enabled }))
  }, [deviceState])

  const toggleFilter = useCallback((filter: 'bass' | 'mid' | 'high') => {
    if (deviceState !== 'online') return
    setFilters(prev => ({ ...prev, [filter]: !prev[filter] }))
  }, [deviceState])

  // Auto-boot on mount
  const hasBootedRef = useRef(false)
  const savedStateRef = useRef(initialState)
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true
      if (startPowered) {
        runBootSequence().then(() => {
          if (savedStateRef.current) {
            if (savedStateRef.current.volume !== undefined) setVolumeState(savedStateRef.current.volume)
            if (savedStateRef.current.isMuted !== undefined) setIsMutedState(savedStateRef.current.isMuted)
            if (savedStateRef.current.filters) setFilters(savedStateRef.current.filters)
          }
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: SPKManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    volume,
    isMuted,
    filters,
    audioLevel,
    peakLevel,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setVolume,
    setMuted,
    toggleMute,
    setFilter,
    toggleFilter,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: SPK_FIRMWARE,
    powerSpecs: SPK_POWER_SPECS,
    audioSpecs: SPK_AUDIO_SPECS,
  }

  return (
    <SPKManagerContext.Provider value={value}>
      {children}
    </SPKManagerContext.Provider>
  )
}

export function useSPKManager() {
  const context = useContext(SPKManagerContext)
  if (!context) {
    throw new Error('useSPKManager must be used within a SPKManagerProvider')
  }
  return context
}

export function useSPKManagerOptional() {
  return useContext(SPKManagerContext)
}

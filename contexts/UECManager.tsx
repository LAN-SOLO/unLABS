'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// UEC Device States
type UECDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type UECTestPhase = 'voltage' | 'frequency' | 'stability' | 'output' | 'sync' | 'complete' | null
type UECBootPhase = 'post' | 'voltage' | 'frequency' | 'network' | 'stabilize' | 'ready' | null
type UECShutdownPhase = 'draining' | 'releasing' | 'halted' | null

// Firmware metadata - Unstable Energy Core
export const UEC_FIRMWARE = {
  version: '2.0.1',
  build: '2024.02.08',
  checksum: 'E9C4F7A2',
  features: ['volatility-tracking', 'tps-monitor', 'tier-calc', 'network-sync', 'field-stabilizer'],
  securityPatch: '2024.02.01',
}

// Power specs - Energy Core generates power, it's a producer not consumer
export const UEC_POWER_SPECS = {
  outputMax: 500,      // Max output E/s when T5
  outputPerTier: 100,  // Output per tier E/s
  selfConsume: 10,     // Self-consumption during operation
  standby: 2,          // Standby power consumption
  category: 'generator' as const,
  priority: 0 as const, // Highest priority - power source
}

interface UECState {
  deviceState: UECDeviceState
  bootPhase: UECBootPhase
  testPhase: UECTestPhase
  shutdownPhase: UECShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  isExpanded: boolean
  volatilityTier: number
  tps: number
  energyOutput: number
  fieldStability: number
}

interface UECManagerContextType extends UECState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  updateVolatility: (tier: number, tps: number) => void
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  // Read-only info
  firmware: typeof UEC_FIRMWARE
  powerSpecs: typeof UEC_POWER_SPECS
}

const UECManagerContext = createContext<UECManagerContextType | null>(null)

interface UECManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; isExpanded?: boolean }
}

export function UECManagerProvider({ children, initialState }: UECManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [deviceState, setDeviceState] = useState<UECDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<UECBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<UECTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<UECShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const [volatilityTier, setVolatilityTier] = useState(1)
  const [tps, setTps] = useState(1000)
  const [energyOutput, setEnergyOutput] = useState(0)
  const [fieldStability, setFieldStability] = useState(0)

  // Calculate energy output based on tier
  const calculateOutput = useCallback((tier: number) => {
    return tier * UEC_POWER_SPECS.outputPerTier
  }, [])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setEnergyOutput(0)
    setFieldStability(0)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('voltage')
    setStatusMessage('Voltage calibration...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('frequency')
    setStatusMessage('Frequency sync...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('network')
    setStatusMessage('Network connect...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('stabilize')
    setStatusMessage('Energy stabilize...')
    setFieldStability(50)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('ready')
    setDeviceState('online')
    setEnergyOutput(calculateOutput(volatilityTier))
    setFieldStability(100)
    setStatusMessage('Core stable')
    setBootPhase(null)
  }, [volatilityTier, calculateOutput])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')

    setShutdownPhase('draining')
    setStatusMessage('Draining capacitors...')
    setFieldStability(50)
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('releasing')
    setStatusMessage('Releasing field...')
    setEnergyOutput(0)
    setFieldStability(0)
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('Core halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setStatusMessage('Standby mode')
  }, [])

  // Toggle expanded
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
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

    const phases: NonNullable<UECTestPhase>[] = ['voltage', 'frequency', 'stability', 'output', 'sync', 'complete']
    const phaseMessages: Record<NonNullable<UECTestPhase>, string> = {
      voltage: 'Testing voltage regulators...',
      frequency: 'Checking frequency sync...',
      stability: 'Verifying field stability...',
      output: 'Measuring power output...',
      sync: 'Testing network sync...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 350))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')

    // Clear result after 3 seconds
    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('Core stable')
    }, 3000)
  }, [deviceState])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Draining capacitors...')
    setEnergyOutput(0)
    setFieldStability(0)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Releasing field...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Core halted')
    await new Promise(r => setTimeout(r, 350))

    // Boot sequence
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Update volatility data
  const updateVolatility = useCallback((tier: number, newTps: number) => {
    setVolatilityTier(tier)
    setTps(newTps)
    if (deviceState === 'online') {
      setEnergyOutput(calculateOutput(tier))
    }
  }, [deviceState, calculateOutput])

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

  const value: UECManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    isExpanded,
    volatilityTier,
    tps,
    energyOutput,
    fieldStability,
    powerOn,
    powerOff,
    runTest,
    reboot,
    updateVolatility,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: UEC_FIRMWARE,
    powerSpecs: UEC_POWER_SPECS,
  }

  return (
    <UECManagerContext.Provider value={value}>
      {children}
    </UECManagerContext.Provider>
  )
}

export function useUECManager() {
  const context = useContext(UECManagerContext)
  if (!context) {
    throw new Error('useUECManager must be used within a UECManagerProvider')
  }
  return context
}

export function useUECManagerOptional() {
  return useContext(UECManagerContext)
}

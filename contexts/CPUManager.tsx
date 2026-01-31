'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// CPU Device States
type CPUDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type CPUTestPhase = 'cores' | 'cache' | 'frequency' | 'thermal' | 'stress' | 'complete' | null
type CPUBootPhase = 'post' | 'detect-cores' | 'init-cache' | 'freq-scale' | 'calibrate' | null
type CPUShutdownPhase = 'saving' | 'flush-cache' | 'halted' | null

// Firmware metadata
export const CPU_FIRMWARE = {
  version: '3.2.1',
  build: '2025.08.15',
  checksum: 'CPU3M0N1',
  features: ['multi-core-monitor', 'freq-scaling', 'thermal-link', 'cache-analysis', 'stress-test'],
  securityPatch: '2025.08.01',
}

// Power specs
export const CPU_POWER_SPECS = {
  full: 0.8,
  idle: 0.5,
  standby: 0.05,
  category: 'light' as const,
  priority: 1 as const,
}

interface CPUState {
  deviceState: CPUDeviceState
  bootPhase: CPUBootPhase
  testPhase: CPUTestPhase
  shutdownPhase: CPUShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  cores: number
  utilization: number
  frequency: number
  coreLoads: number[]
  temperature: number
}

interface CPUManagerContextType extends CPUState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setCores: (value: number) => void
  setUtilization: (value: number) => void
  setFrequency: (value: number) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof CPU_FIRMWARE
  powerSpecs: typeof CPU_POWER_SPECS
}

const CPUManagerContext = createContext<CPUManagerContextType | null>(null)

interface CPUManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; cores?: number; utilization?: number; frequency?: number; isExpanded?: boolean }
}

export function CPUManagerProvider({ children, initialState }: CPUManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<CPUDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<CPUBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<CPUTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<CPUShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(CPU_POWER_SPECS.idle)
  const [cores, setCoresState] = useState(initialState?.cores ?? 8)
  const [utilization, setUtilizationState] = useState(initialState?.utilization ?? 67)
  const [frequency, setFrequencyState] = useState(initialState?.frequency ?? 4.2)
  const [coreLoads, setCoreLoads] = useState<number[]>(Array(initialState?.cores ?? 8).fill(0))
  const [temperature, setTemperature] = useState(62)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(CPU_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('detect-cores')
    setStatusMessage('Detecting cores...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('init-cache')
    setStatusMessage('Init L1/L2 cache...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('freq-scale')
    setStatusMessage('Freq scaling...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    setCoresState(initialState?.cores ?? 8)
    setUtilizationState(initialState?.utilization ?? 67)
    setFrequencyState(initialState?.frequency ?? 4.2)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase(null)
    setDeviceState('online')
    setCurrentDraw(CPU_POWER_SPECS.idle)
    setStatusMessage('READY')
  }, [initialState?.cores, initialState?.utilization, initialState?.frequency])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(CPU_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('flush-cache')
    setStatusMessage('Flushing cache...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(CPU_POWER_SPECS.standby)
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
    setCurrentDraw(CPU_POWER_SPECS.full)

    const phases: NonNullable<CPUTestPhase>[] = ['cores', 'cache', 'frequency', 'thermal', 'stress', 'complete']
    const phaseMessages: Record<NonNullable<CPUTestPhase>, string> = {
      cores: 'Core test...',
      cache: 'Cache test...',
      frequency: 'Frequency test...',
      thermal: 'Thermal test...',
      stress: 'Stress test...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      const duration = phase === 'stress' ? 600 : 350
      await new Promise(r => setTimeout(r, duration))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(CPU_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('READY')
    }, 2500)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(CPU_POWER_SPECS.full)

    setStatusMessage('Flushing cache...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset cores...')
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('System halted')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const setCores = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setCoresState(value)
    setCoreLoads(Array(value).fill(0))
  }, [deviceState])

  const setUtilization = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setUtilizationState(value)
  }, [deviceState])

  const setFrequency = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setFrequencyState(value)
  }, [deviceState])

  // Core load fluctuation effect (separate from base utilization)
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') {
      setCoreLoads(Array(cores).fill(0))
      return
    }
    const interval = setInterval(() => {
      if (deviceState === 'online') {
        setCoreLoads(Array(cores).fill(0).map(() => utilization + (Math.random() - 0.5) * 50))
      } else if (deviceState === 'testing') {
        setCoreLoads(Array(cores).fill(0).map(() => 85 + (Math.random() - 0.5) * 30))
      } else if (deviceState === 'booting' || deviceState === 'rebooting') {
        setCoreLoads(prev => prev.map((load, i) => Math.min(100, load + Math.random() * 15)))
      } else {
        setCoreLoads(Array(cores).fill(0))
      }
    }, 200)
    return () => clearInterval(interval)
  }, [deviceState, cores, utilization])

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

  const value: CPUManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    cores,
    utilization,
    frequency,
    coreLoads,
    temperature,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setCores,
    setUtilization,
    setFrequency,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: CPU_FIRMWARE,
    powerSpecs: CPU_POWER_SPECS,
  }

  return (
    <CPUManagerContext.Provider value={value}>
      {children}
    </CPUManagerContext.Provider>
  )
}

export function useCPUManager() {
  const context = useContext(CPUManagerContext)
  if (!context) {
    throw new Error('useCPUManager must be used within a CPUManagerProvider')
  }
  return context
}

export function useCPUManagerOptional() {
  return useContext(CPUManagerContext)
}

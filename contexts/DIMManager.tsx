'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// DIM Device States
type DIMDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type DIMTestPhase = 'sensors' | 'rift-scan' | 'stability' | 'calibration' | 'complete' | null
type DIMBootPhase = 'post' | 'sensors' | 'probe' | 'calibrate' | 'lock' | null
type DIMShutdownPhase = 'saving' | 'unlock' | 'halted' | null

// Firmware metadata
export const DIM_FIRMWARE = {
  version: '1.0.0',
  build: '2025.12.01',
  checksum: 'D1M3N501',
  features: ['d-space-probe', 'rift-scan', 'stability-lock', 'halo-monitor', 'auto-calibrate'],
  securityPatch: '2025.11.28',
}

// Power specs
export const DIM_POWER_SPECS = {
  full: 1.5,
  idle: 0.8,
  standby: 0.1,
  category: 'light' as const,
  priority: 2 as const,
}

interface DIMState {
  deviceState: DIMDeviceState
  bootPhase: DIMBootPhase
  testPhase: DIMTestPhase
  shutdownPhase: DIMShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  dimension: number
  stability: number
  riftActivity: number
  fluctuation: number
}

interface DIMManagerContextType extends DIMState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setDimension: (value: number) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof DIM_FIRMWARE
  powerSpecs: typeof DIM_POWER_SPECS
}

const DIMManagerContext = createContext<DIMManagerContextType | null>(null)

interface DIMManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; dimension?: number; stability?: number; isExpanded?: boolean }
}

export function DIMManagerProvider({ children, initialState }: DIMManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<DIMDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<DIMBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<DIMTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<DIMShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(DIM_POWER_SPECS.idle)
  const [dimension, setDimensionState] = useState(initialState?.dimension ?? 3.14)
  const [stability, setStability] = useState(initialState?.stability ?? 98)
  const [riftActivity, setRiftActivity] = useState(0.02)
  const [fluctuation, setFluctuation] = useState(0)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(DIM_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 280))

    setBootPhase('sensors')
    setStatusMessage('Sensor init...')
    await new Promise(r => setTimeout(r, 320))

    setBootPhase('probe')
    setStatusMessage('Probing D-space...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating rift...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('lock')
    setStatusMessage('Locking dimension...')
    setDimensionState(initialState?.dimension ?? 3.14)
    setStability(initialState?.stability ?? 98)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase(null)
    setDeviceState('online')
    setCurrentDraw(DIM_POWER_SPECS.idle)
    setStatusMessage('STABLE')
  }, [initialState?.dimension, initialState?.stability])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(DIM_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('unlock')
    setStatusMessage('Unlocking D-space...')
    await new Promise(r => setTimeout(r, 350))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(DIM_POWER_SPECS.standby)
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
    setCurrentDraw(DIM_POWER_SPECS.full)

    const phases: NonNullable<DIMTestPhase>[] = ['sensors', 'rift-scan', 'stability', 'calibration', 'complete']
    const phaseMessages: Record<NonNullable<DIMTestPhase>, string> = {
      sensors: 'Sensor test...',
      'rift-scan': 'Rift scan test...',
      stability: 'Stability test...',
      calibration: 'Calibration test...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 400))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(DIM_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('STABLE')
    }, 2500)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(DIM_POWER_SPECS.full)

    setStatusMessage('Unlocking D-space...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset D-lock...')
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('System halted')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const setDimension = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setDimensionState(value)
  }, [deviceState])

  // Fluctuation effect (separate from base dimension)
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') {
      setFluctuation(0)
      return
    }
    const interval = setInterval(() => {
      if (deviceState === 'online') {
        setFluctuation((Math.random() - 0.5) * 0.4)
      } else if (deviceState === 'testing') {
        setFluctuation((Math.random() - 0.5) * 1.2)
      } else if (deviceState === 'booting' || deviceState === 'rebooting') {
        setFluctuation((Math.random() - 0.5) * 0.8)
      } else {
        setFluctuation(0)
      }
    }, 300)
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

  const value: DIMManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    dimension,
    stability,
    riftActivity,
    fluctuation,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setDimension,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: DIM_FIRMWARE,
    powerSpecs: DIM_POWER_SPECS,
  }

  return (
    <DIMManagerContext.Provider value={value}>
      {children}
    </DIMManagerContext.Provider>
  )
}

export function useDIMManager() {
  const context = useContext(DIMManagerContext)
  if (!context) {
    throw new Error('useDIMManager must be used within a DIMManagerProvider')
  }
  return context
}

export function useDIMManagerOptional() {
  return useContext(DIMManagerContext)
}

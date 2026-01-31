'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// TMP Device States
type TMPDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type TMPTestPhase = 'sensors' | 'calibration' | 'threshold' | 'cooling' | 'complete' | null
type TMPBootPhase = 'post' | 'sensors' | 'calibrate' | 'reading' | 'ready' | null
type TMPShutdownPhase = 'saving' | 'cooldown' | 'halted' | null

// Firmware metadata
export const TMP_FIRMWARE = {
  version: '1.0.0',
  build: '2025.11.15',
  checksum: 'T3M1P4K2',
  features: ['thermal-probe', 'multi-sensor', 'threshold-alert', 'cooling-monitor', 'auto-calibrate'],
  securityPatch: '2025.11.10',
}

// Power specs
export const TMP_POWER_SPECS = {
  full: 1.2,
  idle: 0.8,
  standby: 0.1,
  category: 'light' as const,
  priority: 1 as const,
}

interface TMPState {
  deviceState: TMPDeviceState
  bootPhase: TMPBootPhase
  testPhase: TMPTestPhase
  shutdownPhase: TMPShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  temperature: number
  maxTemp: number
  minTemp: number
  fluctuation: number
}

interface TMPManagerContextType extends TMPState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setTemperature: (value: number) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof TMP_FIRMWARE
  powerSpecs: typeof TMP_POWER_SPECS
}

const TMPManagerContext = createContext<TMPManagerContextType | null>(null)

interface TMPManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; temperature?: number; isExpanded?: boolean }
}

export function TMPManagerProvider({ children, initialState }: TMPManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<TMPDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<TMPBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<TMPTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<TMPShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(TMP_POWER_SPECS.idle)
  const [temperature, setTemperatureState] = useState(initialState?.temperature ?? 28.4)
  const [maxTemp] = useState(85)
  const [minTemp] = useState(15)
  const [fluctuation, setFluctuation] = useState(0)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(TMP_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 280))

    setBootPhase('sensors')
    setStatusMessage('Sensor init...')
    await new Promise(r => setTimeout(r, 320))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('reading')
    setStatusMessage('Reading temps...')
    setTemperatureState(initialState?.temperature ?? 28.4)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(TMP_POWER_SPECS.idle)
    setStatusMessage('NOMINAL')
    setBootPhase(null)
  }, [initialState?.temperature])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(TMP_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('cooldown')
    setStatusMessage('Cooling down...')
    await new Promise(r => setTimeout(r, 350))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(TMP_POWER_SPECS.standby)
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
    setCurrentDraw(TMP_POWER_SPECS.full)

    const phases: NonNullable<TMPTestPhase>[] = ['sensors', 'calibration', 'threshold', 'cooling', 'complete']
    const phaseMessages: Record<NonNullable<TMPTestPhase>, string> = {
      sensors: 'Sensor test...',
      calibration: 'Calibration test...',
      threshold: 'Threshold test...',
      cooling: 'Cooling test...',
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
    setCurrentDraw(TMP_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('NOMINAL')
    }, 2500)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(TMP_POWER_SPECS.full)

    setStatusMessage('Cooling down...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset sensors...')
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('System halted')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const setTemperature = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setTemperatureState(value)
  }, [deviceState])

  // Temperature fluctuation effect (fluctuation is separate — does not modify base temp)
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') {
      setFluctuation(0)
      return
    }
    const interval = setInterval(() => {
      if (deviceState === 'online') {
        setFluctuation((Math.random() - 0.5) * 0.6)
      } else if (deviceState === 'testing') {
        setFluctuation((Math.random() - 0.5) * 4.0)
      } else {
        setFluctuation(0)
      }
    }, 500)
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

  const value: TMPManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    temperature,
    maxTemp,
    minTemp,
    fluctuation,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setTemperature,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: TMP_FIRMWARE,
    powerSpecs: TMP_POWER_SPECS,
  }

  return (
    <TMPManagerContext.Provider value={value}>
      {children}
    </TMPManagerContext.Provider>
  )
}

export function useTMPManager() {
  const context = useContext(TMPManagerContext)
  if (!context) {
    throw new Error('useTMPManager must be used within a TMPManagerProvider')
  }
  return context
}

export function useTMPManagerOptional() {
  return useContext(TMPManagerContext)
}

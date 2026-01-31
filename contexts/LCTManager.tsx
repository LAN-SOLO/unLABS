'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// LCT Device States
type LCTDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type LCTTestPhase = 'alignment' | 'power' | 'calibration' | 'focus' | 'complete' | null
type LCTBootPhase = 'firmware' | 'diode-array' | 'cooling' | 'optics' | 'calibrate' | 'ready' | null
type LCTShutdownPhase = 'cooldown' | 'diode-off' | 'halted' | null
export type LCTMode = 'cutting' | 'engraving' | 'welding' | 'marking' | 'drilling' | 'scanning'

// Firmware metadata
export const LCT_FIRMWARE = {
  version: '2.1.0',
  build: '2025.07.20',
  checksum: 'L4S3RCUT',
  features: ['diode-array', 'optics-check', 'focus-calibrate', 'power-regulate', 'thermal-protect', 'precision-cut'],
  securityPatch: '2025.07.15',
}

// Power specs
export const LCT_POWER_SPECS = {
  full: 25,
  idle: 4,
  standby: 0.5,
  category: 'heavy' as const,
  priority: 3 as const,
}

interface LCTState {
  deviceState: LCTDeviceState
  bootPhase: LCTBootPhase
  testPhase: LCTTestPhase
  shutdownPhase: LCTShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  laserPower: number
  precision: number
  laserPosition: number
  displayMode: LCTMode
}

interface LCTManagerContextType extends LCTState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  cycleMode: () => void
  setMode: (mode: LCTMode) => void
  setLaserPower: (value: number) => void
  setPrecision: (value: number) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof LCT_FIRMWARE
  powerSpecs: typeof LCT_POWER_SPECS
}

const LCTManagerContext = createContext<LCTManagerContextType | null>(null)

interface LCTManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered?: boolean; laserPower?: number; precision?: number; displayMode?: LCTMode; isExpanded?: boolean }
}

export function LCTManagerProvider({ children, initialState }: LCTManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<LCTDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<LCTBootPhase>(startPowered ? 'firmware' : null)
  const [testPhase, setTestPhase] = useState<LCTTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<LCTShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'INITIALIZING' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(LCT_POWER_SPECS.idle)
  const [displayMode, setDisplayMode] = useState<LCTMode>(initialState?.displayMode ?? 'cutting')
  const [laserPower, setLaserPowerState] = useState(initialState?.laserPower ?? 450)
  const [precision, setPrecisionState] = useState(initialState?.precision ?? 0.01)
  const [laserPosition, setLaserPosition] = useState(50)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(LCT_POWER_SPECS.idle)

    setBootPhase('firmware')
    setStatusMessage('FIRMWARE v2.1.0')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('diode-array')
    setStatusMessage('DIODE ARRAY')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('cooling')
    setStatusMessage('COOLING SYSTEM')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('optics')
    setStatusMessage('OPTICS CHECK')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('calibrate')
    setStatusMessage('CALIBRATING')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(LCT_POWER_SPECS.idle)
    setStatusMessage('READY')
    setBootPhase(null)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(LCT_POWER_SPECS.idle)

    setShutdownPhase('cooldown')
    setStatusMessage('Cooldown...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('diode-off')
    setStatusMessage('Diode off...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(LCT_POWER_SPECS.standby)
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
    setCurrentDraw(LCT_POWER_SPECS.full)

    setTestPhase('alignment')
    setStatusMessage('Testing alignment...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('power')
    setStatusMessage('Testing power...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('calibration')
    setStatusMessage('Calibration...')
    setLaserPowerState(450)
    await new Promise(r => setTimeout(r, 500))

    setTestPhase('focus')
    setStatusMessage('Focus check...')
    await new Promise(r => setTimeout(r, 350))

    setTestPhase('complete')
    setStatusMessage('Test complete')
    await new Promise(r => setTimeout(r, 350))

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(LCT_POWER_SPECS.idle)
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
    setCurrentDraw(LCT_POWER_SPECS.idle)

    setStatusMessage('Cooldown...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Diode off...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const cycleMode = useCallback(() => {
    if (deviceState !== 'online') return
    const modes: LCTMode[] = ['cutting', 'engraving', 'welding', 'marking', 'drilling', 'scanning']
    const currentIndex = modes.indexOf(displayMode)
    setDisplayMode(modes[(currentIndex + 1) % modes.length])
  }, [deviceState, displayMode])

  const setMode = useCallback((mode: LCTMode) => {
    if (deviceState !== 'online') return
    setDisplayMode(mode)
  }, [deviceState])

  const setLaserPower = useCallback((value: number) => {
    setLaserPowerState(Math.max(0, Math.min(450, value)))
  }, [])

  const setPrecision = useCallback((value: number) => {
    setPrecisionState(value)
  }, [])

  // Laser position sweep animation
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return
    const interval = setInterval(() => {
      setLaserPosition(prev => (prev + 1) % 100)
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

  const value: LCTManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    laserPower,
    precision,
    laserPosition,
    displayMode,
    powerOn,
    powerOff,
    runTest,
    reboot,
    cycleMode,
    setMode,
    setLaserPower,
    setPrecision,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: LCT_FIRMWARE,
    powerSpecs: LCT_POWER_SPECS,
  }

  return (
    <LCTManagerContext.Provider value={value}>
      {children}
    </LCTManagerContext.Provider>
  )
}

export function useLCTManager() {
  const context = useContext(LCTManagerContext)
  if (!context) {
    throw new Error('useLCTManager must be used within a LCTManagerProvider')
  }
  return context
}

export function useLCTManagerOptional() {
  return useContext(LCTManagerContext)
}

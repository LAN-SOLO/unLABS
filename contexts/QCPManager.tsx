'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// QCP Device States
type QCPDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type QCPTestPhase = 'gyro' | 'magnetometer' | 'quantum-link' | 'calibrate' | 'verify' | 'complete' | null
type QCPBootPhase = 'gyro' | 'magnetometer' | 'quantum-link' | 'calibrate' | 'lock-target' | 'ready' | null
type QCPShutdownPhase = 'saving' | 'gyro-stop' | 'halted' | null
export type QCPMode = 'compass' | 'radar' | 'heatmap' | 'trajectory' | 'triangulate' | 'history'

// Firmware metadata
export const QCP_FIRMWARE = {
  version: '1.5.0',
  build: '2025.09.22',
  checksum: 'QC0MPA55',
  features: ['gyroscope', 'magnetometer', 'quantum-link', 'anomaly-track', 'distance-calc', 'needle-stabilize'],
  securityPatch: '2025.09.15',
}

// Power specs
export const QCP_POWER_SPECS = {
  full: 2.5,
  idle: 0.8,
  standby: 0.2,
  category: 'light' as const,
  priority: 3 as const,
}

interface QCPState {
  deviceState: QCPDeviceState
  bootPhase: QCPBootPhase
  testPhase: QCPTestPhase
  shutdownPhase: QCPShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  anomalyDirection: number
  anomalyDistance: number
  needleWobble: number
  displayMode: QCPMode
}

interface QCPManagerContextType extends QCPState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  cycleMode: () => void
  setMode: (mode: QCPMode) => void
  setAnomalyDirection: (value: number) => void
  setAnomalyDistance: (value: number) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof QCP_FIRMWARE
  powerSpecs: typeof QCP_POWER_SPECS
}

const QCPManagerContext = createContext<QCPManagerContextType | null>(null)

interface QCPManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; anomalyDirection?: number; anomalyDistance?: number; displayMode?: QCPMode; isExpanded?: boolean }
}

export function QCPManagerProvider({ children, initialState }: QCPManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<QCPDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<QCPBootPhase>(startPowered ? 'gyro' : null)
  const [testPhase, setTestPhase] = useState<QCPTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<QCPShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Init...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(QCP_POWER_SPECS.idle)
  const [displayMode, setDisplayMode] = useState<QCPMode>(initialState?.displayMode ?? 'compass')
  const [anomalyDirection, setAnomalyDirectionState] = useState(initialState?.anomalyDirection ?? 127)
  const [anomalyDistance, setAnomalyDistanceState] = useState(initialState?.anomalyDistance ?? 42)
  const [needleWobble, setNeedleWobble] = useState(0)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(QCP_POWER_SPECS.full)

    setBootPhase('gyro')
    setStatusMessage('Gyro init...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('magnetometer')
    setStatusMessage('Magnetometer...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('quantum-link')
    setStatusMessage('Quantum link...')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('lock-target')
    setStatusMessage('Locking target...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(QCP_POWER_SPECS.idle)
    setStatusMessage('ANOMALY DETECTED')
    setBootPhase(null)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(QCP_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving coords...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('gyro-stop')
    setStatusMessage('Gyro halt...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(QCP_POWER_SPECS.standby)
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
    setCurrentDraw(QCP_POWER_SPECS.full)

    setTestPhase('gyro')
    setStatusMessage('Testing gyro...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('magnetometer')
    setStatusMessage('Testing magnetometer...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('quantum-link')
    setStatusMessage('Testing quantum-link...')
    // Spin needle: 8 iterations of +45deg every 100ms
    for (let i = 0; i < 8; i++) {
      setNeedleWobble(prev => prev + 45)
      await new Promise(r => setTimeout(r, 100))
    }

    setTestPhase('calibrate')
    setStatusMessage('Calibrating...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('verify')
    setStatusMessage('Verifying...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('complete')
    setStatusMessage('Test complete')
    await new Promise(r => setTimeout(r, 400))

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(QCP_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('ANOMALY DETECTED')
    }, 2500)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(QCP_POWER_SPECS.full)

    setStatusMessage('Shutdown...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset gyro...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const cycleMode = useCallback(() => {
    if (deviceState !== 'online') return
    const modes: QCPMode[] = ['compass', 'radar', 'heatmap', 'trajectory', 'triangulate', 'history']
    const currentIndex = modes.indexOf(displayMode)
    setDisplayMode(modes[(currentIndex + 1) % modes.length])
  }, [deviceState, displayMode])

  const setMode = useCallback((mode: QCPMode) => {
    if (deviceState !== 'online') return
    setDisplayMode(mode)
  }, [deviceState])

  const setAnomalyDirection = useCallback((value: number) => {
    setAnomalyDirectionState(Math.max(0, Math.min(360, value)))
  }, [])

  const setAnomalyDistance = useCallback((value: number) => {
    setAnomalyDistanceState(Math.max(0, Math.min(999, value)))
  }, [])

  // Needle wobble animation
  useEffect(() => {
    if (deviceState !== 'online' && deviceState !== 'testing') return
    const interval = setInterval(() => {
      const range = deviceState === 'testing' ? 15 : 3
      setNeedleWobble((Math.random() - 0.5) * 2 * range)
    }, 150)
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

  const value: QCPManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    anomalyDirection,
    anomalyDistance,
    needleWobble,
    displayMode,
    powerOn,
    powerOff,
    runTest,
    reboot,
    cycleMode,
    setMode,
    setAnomalyDirection,
    setAnomalyDistance,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: QCP_FIRMWARE,
    powerSpecs: QCP_POWER_SPECS,
  }

  return (
    <QCPManagerContext.Provider value={value}>
      {children}
    </QCPManagerContext.Provider>
  )
}

export function useQCPManager() {
  const context = useContext(QCPManagerContext)
  if (!context) {
    throw new Error('useQCPManager must be used within a QCPManagerProvider')
  }
  return context
}

export function useQCPManagerOptional() {
  return useContext(QCPManagerContext)
}

'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// MSC Device States
type MSCDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type MSCTestPhase = 'emitter' | 'receiver' | 'calibrate' | 'sweep' | 'complete' | null
type MSCBootPhase = 'post' | 'sensors' | 'calibrate' | 'ready' | null
type MSCShutdownPhase = 'saving' | 'depower' | 'halted' | null

// Firmware metadata
export const MSC_FIRMWARE = {
  version: '1.3.0',
  build: '2024.02.28',
  checksum: 'F7A3C9D2',
  features: ['material-detect', 'anomaly-flag', 'sweep-scan', 'auto-calibrate'],
  securityPatch: '2024.02.20',
}

// Power specs
export const MSC_POWER_SPECS = {
  full: 2,
  idle: 1,
  standby: 0.1,
  category: 'light' as const,
  priority: 2 as const,
}

interface MSCState {
  deviceState: MSCDeviceState
  bootPhase: MSCBootPhase
  testPhase: MSCTestPhase
  shutdownPhase: MSCShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  scanLine: number
  detectedMaterials: number
}

interface MSCManagerContextType extends MSCState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  firmware: typeof MSC_FIRMWARE
  powerSpecs: typeof MSC_POWER_SPECS
}

const MSCManagerContext = createContext<MSCManagerContextType | null>(null)

interface MSCManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean }
}

export function MSCManagerProvider({ children, initialState }: MSCManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<MSCDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<MSCBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<MSCTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<MSCShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(MSC_POWER_SPECS.idle)
  const [scanLine, setScanLine] = useState(0)
  const [detectedMaterials, setDetectedMaterials] = useState(0)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(MSC_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('sensors')
    setStatusMessage('Sensor init...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(MSC_POWER_SPECS.idle)
    setStatusMessage('SCANNING')
    setBootPhase(null)
    setDetectedMaterials(3)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(MSC_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('depower')
    setStatusMessage('Depowering emitter...')
    setScanLine(0)
    setDetectedMaterials(0)
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(MSC_POWER_SPECS.standby)
    setStatusMessage('Standby mode')
  }, [])

  const powerOn = useCallback(async () => {
    if (deviceState !== 'standby') return
    setIsPowered(true)
    await runBootSequence()
  }, [deviceState, runBootSequence])

  const powerOff = useCallback(async () => {
    if (deviceState !== 'online') return
    setIsPowered(false)
    await runShutdownSequence()
  }, [deviceState, runShutdownSequence])

  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)
    setCurrentDraw(MSC_POWER_SPECS.full)

    const phases: NonNullable<MSCTestPhase>[] = ['emitter', 'receiver', 'calibrate', 'sweep', 'complete']
    const phaseMessages: Record<NonNullable<MSCTestPhase>, string> = {
      emitter: 'Testing emitter...',
      receiver: 'Testing receiver...',
      calibrate: 'Calibrating...',
      sweep: 'Sweep test...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 450))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(MSC_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('SCANNING')
    }, 2500)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(MSC_POWER_SPECS.full)
    setScanLine(0)
    setDetectedMaterials(0)

    setStatusMessage('Emitter off...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Resetting...')
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('System halted')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

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

  const value: MSCManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    scanLine,
    detectedMaterials,
    powerOn,
    powerOff,
    runTest,
    reboot,
    firmware: MSC_FIRMWARE,
    powerSpecs: MSC_POWER_SPECS,
  }

  return (
    <MSCManagerContext.Provider value={value}>
      {children}
    </MSCManagerContext.Provider>
  )
}

export function useMSCManager() {
  const context = useContext(MSCManagerContext)
  if (!context) {
    throw new Error('useMSCManager must be used within a MSCManagerProvider')
  }
  return context
}

export function useMSCManagerOptional() {
  return useContext(MSCManagerContext)
}

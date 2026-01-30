'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// PWB Device States
type PWBDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type PWBTestPhase = 'motors' | 'clamps' | 'sensors' | 'calibrate' | 'complete' | null
type PWBBootPhase = 'post' | 'firmware' | 'calibration' | 'tools' | 'ready' | null
type PWBShutdownPhase = 'saving' | 'retracting' | 'powerdown' | 'halted' | null

// Firmware metadata
export const PWB_FIRMWARE = {
  version: '1.1.0',
  build: '2024.02.20',
  checksum: 'D4E8F1A3',
  features: ['slot-management', 'auto-calibrate', 'tool-tracking', 'assembly-queue'],
  securityPatch: '2024.02.15',
}

// Power specs from GD_SPEC_device-power_v1_0.md
export const PWB_POWER_SPECS = {
  full: 3,
  idle: 0.8,
  standby: 0.15,
  category: 'light' as const,
  priority: 2 as const,
}

interface PWBState {
  deviceState: PWBDeviceState
  bootPhase: PWBBootPhase
  testPhase: PWBTestPhase
  shutdownPhase: PWBShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  activeSlot: number | null
  queuedItems: number
  craftingProgress: number
}

interface PWBManagerContextType extends PWBState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  selectSlot: (slot: number) => void
  // Read-only info
  firmware: typeof PWB_FIRMWARE
  powerSpecs: typeof PWB_POWER_SPECS
}

const PWBManagerContext = createContext<PWBManagerContextType | null>(null)

interface PWBManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean }
}

export function PWBManagerProvider({ children, initialState }: PWBManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<PWBDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<PWBBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<PWBTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<PWBShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(PWB_POWER_SPECS.idle)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [queuedItems, setQueuedItems] = useState(2)
  const [craftingProgress, setCraftingProgress] = useState(35)

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(PWB_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('firmware')
    setStatusMessage('Firmware verify...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('calibration')
    setStatusMessage('Calibrating surface...')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('tools')
    setStatusMessage('Tool init...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(PWB_POWER_SPECS.idle)
    setStatusMessage('Workbench ready')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(PWB_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('retracting')
    setStatusMessage('Retracting tools...')
    await new Promise(r => setTimeout(r, 350))

    setShutdownPhase('powerdown')
    setStatusMessage('Power down...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(PWB_POWER_SPECS.standby)
    setStatusMessage('Standby mode')
    setActiveSlot(null)
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
    setCurrentDraw(PWB_POWER_SPECS.full)

    const phases: NonNullable<PWBTestPhase>[] = ['motors', 'clamps', 'sensors', 'calibrate', 'complete']
    const phaseMessages: Record<NonNullable<PWBTestPhase>, string> = {
      motors: 'Testing motor alignment...',
      clamps: 'Testing clamp integrity...',
      sensors: 'Checking sensors...',
      calibrate: 'Calibration check...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 450))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(PWB_POWER_SPECS.idle)
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('Workbench ready')
    }, 3000)
  }, [deviceState])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setActiveSlot(null)
    setCurrentDraw(PWB_POWER_SPECS.full)

    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Retracting tools...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('System halted')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 400))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Slot select
  const selectSlot = useCallback((slotIndex: number) => {
    if (deviceState !== 'online') return
    setActiveSlot(prev => prev === slotIndex ? null : slotIndex)
  }, [deviceState])

  // Auto-boot on mount
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

  const value: PWBManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    activeSlot,
    queuedItems,
    craftingProgress,
    powerOn,
    powerOff,
    runTest,
    reboot,
    selectSlot,
    firmware: PWB_FIRMWARE,
    powerSpecs: PWB_POWER_SPECS,
  }

  return (
    <PWBManagerContext.Provider value={value}>
      {children}
    </PWBManagerContext.Provider>
  )
}

export function usePWBManager() {
  const context = useContext(PWBManagerContext)
  if (!context) {
    throw new Error('usePWBManager must be used within a PWBManagerProvider')
  }
  return context
}

export function usePWBManagerOptional() {
  return useContext(PWBManagerContext)
}

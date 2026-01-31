'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// CDC Device States
type CDCDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type CDCTestPhase = 'memory' | 'bus' | 'cache' | 'power' | 'protocol' | 'complete' | null
type CDCBootPhase = 'post' | 'memory' | 'cache' | 'bus' | 'sync' | 'ready' | null
type CDCShutdownPhase = 'saving' | 'flushing' | 'releasing' | 'halted' | null

// Firmware metadata
export const CDC_FIRMWARE = {
  version: '1.4.2',
  build: '2024.01.15',
  checksum: 'A7F3B2E1',
  features: ['crystal-index', 'slice-tracking', 'power-calc', 'auto-sync'],
  securityPatch: '2024.01.10',
}

// Power specs from GD_SPEC_device-power_v1_0.md
export const CDC_POWER_SPECS = {
  full: 15,
  idle: 5,
  standby: 1,
  category: 'medium' as const,
  priority: 1 as const,
}

interface CDCState {
  deviceState: CDCDeviceState
  bootPhase: CDCBootPhase
  testPhase: CDCTestPhase
  shutdownPhase: CDCShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  isExpanded: boolean
  crystalCount: number
  sliceCount: number
  totalPower: number
  currentDraw: number
}

interface CDCManagerContextType extends CDCState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  updateData: (crystals: number, slices: number, power: number) => void
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  // Read-only info
  firmware: typeof CDC_FIRMWARE
  powerSpecs: typeof CDC_POWER_SPECS
}

const CDCManagerContext = createContext<CDCManagerContextType | null>(null)

interface CDCManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; isExpanded?: boolean }
}

export function CDCManagerProvider({ children, initialState }: CDCManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [deviceState, setDeviceState] = useState<CDCDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<CDCBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<CDCTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<CDCShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [crystalCount, setCrystalCount] = useState(0)
  const [sliceCount, setSliceCount] = useState(0)
  const [totalPower, setTotalPower] = useState(0)
  const [currentDraw, setCurrentDraw] = useState(CDC_POWER_SPECS.idle)
  const [isExpanded, setIsExpanded] = useState(startExpanded)

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(CDC_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('memory')
    setStatusMessage('Memory init...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('cache')
    setStatusMessage('Cache allocate...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('bus')
    setStatusMessage('Bus connect...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('sync')
    setStatusMessage('Data sync...')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(CDC_POWER_SPECS.idle)
    setStatusMessage(crystalCount > 0 ? 'Cache synchronized' : 'Awaiting data')
    setBootPhase(null)
  }, [crystalCount])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(CDC_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('flushing')
    setStatusMessage('Flushing buffers...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('releasing')
    setStatusMessage('Releasing resources...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(CDC_POWER_SPECS.standby)
    setStatusMessage('Standby mode')
  }, [])

  // Power ON — auto-unfold
  const powerOn = useCallback(async () => {
    if (deviceState !== 'standby') return
    setIsPowered(true)
    setIsExpanded(true)
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Power OFF — auto-fold
  const powerOff = useCallback(async () => {
    if (deviceState !== 'online') return
    setIsPowered(false)
    await runShutdownSequence()
    setIsExpanded(false)
  }, [deviceState, runShutdownSequence])

  // Expand/Collapse
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const setExpanded = useCallback((expanded: boolean) => {
    setIsExpanded(expanded)
  }, [])

  // Run test
  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)
    setCurrentDraw(CDC_POWER_SPECS.full)

    const phases: NonNullable<CDCTestPhase>[] = ['memory', 'bus', 'cache', 'power', 'protocol', 'complete']
    const phaseMessages: Record<NonNullable<CDCTestPhase>, string> = {
      memory: 'Testing memory integrity...',
      bus: 'Testing data bus...',
      cache: 'Verifying cache coherence...',
      power: 'Checking power supply...',
      protocol: 'Testing protocol...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 400))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(CDC_POWER_SPECS.idle)
    setStatusMessage('All tests PASSED')

    // Clear result after 3 seconds
    setTimeout(() => {
      setTestResult(null)
      setStatusMessage(crystalCount > 0 ? 'Cache synchronized' : 'Awaiting data')
    }, 3000)
  }, [deviceState, crystalCount])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(CDC_POWER_SPECS.full)

    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Flushing buffers...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Releasing resources...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 400))

    // Boot sequence
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Update data
  const updateData = useCallback((crystals: number, slices: number, power: number) => {
    setCrystalCount(crystals)
    setSliceCount(slices)
    setTotalPower(power)
    if (deviceState === 'online') {
      setStatusMessage(crystals > 0 ? 'Cache synchronized' : 'Awaiting data')
    }
  }, [deviceState])

  // Auto-boot on mount - run once when component mounts (skip if starting in standby)
  const hasBootedRef = useRef(false)
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true
      if (startPowered) {
        runBootSequence()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  const value: CDCManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    isExpanded,
    crystalCount,
    sliceCount,
    totalPower,
    currentDraw,
    powerOn,
    powerOff,
    runTest,
    reboot,
    updateData,
    toggleExpanded,
    setExpanded,
    firmware: CDC_FIRMWARE,
    powerSpecs: CDC_POWER_SPECS,
  }

  return (
    <CDCManagerContext.Provider value={value}>
      {children}
    </CDCManagerContext.Provider>
  )
}

export function useCDCManager() {
  const context = useContext(CDCManagerContext)
  if (!context) {
    throw new Error('useCDCManager must be used within a CDCManagerProvider')
  }
  return context
}

export function useCDCManagerOptional() {
  return useContext(CDCManagerContext)
}

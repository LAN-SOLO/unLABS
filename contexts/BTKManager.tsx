'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// BTK Device States
type BTKDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type BTKTestPhase = 'probe' | 'clamp' | 'laser' | 'drill' | 'calibrate' | 'complete' | null
type BTKBootPhase = 'post' | 'tools' | 'interface' | 'ready' | null
type BTKShutdownPhase = 'saving' | 'retracting' | 'halted' | null

// Firmware metadata
export const BTK_FIRMWARE = {
  version: '1.2.0',
  build: '2024.03.10',
  checksum: 'B3A7C5D2',
  features: ['probe-calibrate', 'clamp-feedback', 'laser-safety', 'drill-torque-ctrl'],
  securityPatch: '2024.03.05',
}

// Power specs
export const BTK_POWER_SPECS = {
  full: 0.5,
  idle: 0.3,
  standby: 0.05,
  category: 'light' as const,
  priority: 2 as const,
}

interface BTKState {
  deviceState: BTKDeviceState
  bootPhase: BTKBootPhase
  testPhase: BTKTestPhase
  shutdownPhase: BTKShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  selectedTool: string | null
}

interface BTKManagerContextType extends BTKState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  selectTool: (toolName: string) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof BTK_FIRMWARE
  powerSpecs: typeof BTK_POWER_SPECS
}

const BTKManagerContext = createContext<BTKManagerContextType | null>(null)

interface BTKManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; isExpanded?: boolean }
}

export function BTKManagerProvider({ children, initialState }: BTKManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<BTKDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<BTKBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<BTKTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<BTKShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(BTK_POWER_SPECS.idle)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(BTK_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('tools')
    setStatusMessage('Tool init...')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('interface')
    setStatusMessage('Interface check...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(BTK_POWER_SPECS.idle)
    setStatusMessage('Toolkit ready')
    setBootPhase(null)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(BTK_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('retracting')
    setStatusMessage('Retracting tools...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(BTK_POWER_SPECS.standby)
    setStatusMessage('Standby mode')
    setSelectedTool(null)
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
    await runShutdownSequence()
    setIsExpanded(false)
  }, [deviceState, runShutdownSequence])

  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)
    setCurrentDraw(BTK_POWER_SPECS.full)

    const phases: NonNullable<BTKTestPhase>[] = ['probe', 'clamp', 'laser', 'drill', 'calibrate', 'complete']
    const phaseMessages: Record<NonNullable<BTKTestPhase>, string> = {
      probe: 'Testing probe...',
      clamp: 'Testing clamp...',
      laser: 'Testing laser...',
      drill: 'Testing drill...',
      calibrate: 'Calibrating...',
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
    setCurrentDraw(BTK_POWER_SPECS.idle)
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('Toolkit ready')
    }, 3000)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setSelectedTool(null)
    setCurrentDraw(BTK_POWER_SPECS.full)

    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Retracting tools...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('System halted')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 400))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const selectTool = useCallback((toolName: string) => {
    if (deviceState !== 'online') return
    setSelectedTool(prev => prev === toolName ? null : toolName)
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

  const value: BTKManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    selectedTool,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    powerOn,
    powerOff,
    runTest,
    reboot,
    selectTool,
    firmware: BTK_FIRMWARE,
    powerSpecs: BTK_POWER_SPECS,
  }

  return (
    <BTKManagerContext.Provider value={value}>
      {children}
    </BTKManagerContext.Provider>
  )
}

export function useBTKManager() {
  const context = useContext(BTKManagerContext)
  if (!context) {
    throw new Error('useBTKManager must be used within a BTKManagerProvider')
  }
  return context
}

export function useBTKManagerOptional() {
  return useContext(BTKManagerContext)
}

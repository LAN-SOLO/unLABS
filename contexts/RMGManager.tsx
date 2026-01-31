'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// RMG Device States
type RMGDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type RMGTestPhase = 'coils' | 'field' | 'flux' | 'calibrate' | 'complete' | null
type RMGBootPhase = 'post' | 'coils' | 'flux' | 'field' | 'calibrate' | 'ready' | null
type RMGShutdownPhase = 'saving' | 'discharge' | 'halted' | null

// Firmware metadata
export const RMG_FIRMWARE = {
  version: '1.2.0',
  build: '2024.03.15',
  checksum: 'E2C4A8F6',
  features: ['coil-feedback', 'flux-stabilize', 'field-calibrate', 'auto-attract'],
  securityPatch: '2024.03.10',
}

// Power specs
export const RMG_POWER_SPECS = {
  full: 5,
  idle: 3,
  standby: 0.2,
  category: 'medium' as const,
  priority: 3 as const,
}

interface RMGState {
  deviceState: RMGDeviceState
  bootPhase: RMGBootPhase
  testPhase: RMGTestPhase
  shutdownPhase: RMGShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  strength: number
  fieldActive: boolean
}

interface RMGManagerContextType extends RMGState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setStrength: (value: number) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof RMG_FIRMWARE
  powerSpecs: typeof RMG_POWER_SPECS
}

const RMGManagerContext = createContext<RMGManagerContextType | null>(null)

interface RMGManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; strength?: number; isExpanded?: boolean }
}

export function RMGManagerProvider({ children, initialState }: RMGManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<RMGDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<RMGBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<RMGTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<RMGShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(RMG_POWER_SPECS.idle)
  const [strength, setStrengthState] = useState(initialState?.strength ?? 45)
  const [fieldActive, setFieldActive] = useState(false)
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(RMG_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 280))

    setBootPhase('coils')
    setStatusMessage('Coil check...')
    await new Promise(r => setTimeout(r, 320))

    setBootPhase('flux')
    setStatusMessage('Flux gen...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('field')
    setStatusMessage('Field init...')
    setFieldActive(true)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('calibrate')
    setStatusMessage('Calibrate...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(RMG_POWER_SPECS.idle)
    setStatusMessage('ACTIVE')
    setBootPhase(null)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(RMG_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('discharge')
    setStatusMessage('Discharging field...')
    setFieldActive(false)
    await new Promise(r => setTimeout(r, 350))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(RMG_POWER_SPECS.standby)
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
    await runShutdownSequence()
    setIsExpanded(false)
  }, [deviceState, runShutdownSequence])

  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)
    setCurrentDraw(RMG_POWER_SPECS.full)

    const phases: NonNullable<RMGTestPhase>[] = ['coils', 'field', 'flux', 'calibrate', 'complete']
    const phaseMessages: Record<NonNullable<RMGTestPhase>, string> = {
      coils: 'Testing coils...',
      field: 'Field strength...',
      flux: 'Flux density...',
      calibrate: 'Calibrating...',
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
    setCurrentDraw(RMG_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('ACTIVE')
    }, 2500)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(RMG_POWER_SPECS.full)

    setStatusMessage('Field off...')
    setFieldActive(false)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Discharge...')
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('System halted')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const setStrength = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setStrengthState(value)
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

  const value: RMGManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    strength,
    fieldActive,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setStrength,
    firmware: RMG_FIRMWARE,
    powerSpecs: RMG_POWER_SPECS,
  }

  return (
    <RMGManagerContext.Provider value={value}>
      {children}
    </RMGManagerContext.Provider>
  )
}

export function useRMGManager() {
  const context = useContext(RMGManagerContext)
  if (!context) {
    throw new Error('useRMGManager must be used within a RMGManagerProvider')
  }
  return context
}

export function useRMGManagerOptional() {
  return useContext(RMGManagerContext)
}

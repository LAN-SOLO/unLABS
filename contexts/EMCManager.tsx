'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// EMC Device States
type EMCDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type EMCTestPhase = 'containment' | 'field' | 'stability' | 'particles' | 'complete' | null
type EMCBootPhase = 'field' | 'containment' | 'particles' | 'stabilize' | 'ready' | null
type EMCShutdownPhase = 'decontain' | 'collapse' | 'cooldown' | null

// Firmware metadata
export const EMC_FIRMWARE = {
  version: '4.0.1',
  build: '2026.01.15',
  checksum: 'E8X4M2C7',
  features: ['containment-field', 'particle-tracking', 'stability-calc', 'matter-compress', 'field-harmonics'],
  securityPatch: '2026.01.10',
}

// Power specs
export const EMC_POWER_SPECS = {
  full: 40,
  idle: 18,
  standby: 2,
  scan: 55,
  category: 'heavy' as const,
  priority: 1 as const,
}

interface EMCState {
  deviceState: EMCDeviceState
  bootPhase: EMCBootPhase
  testPhase: EMCTestPhase
  shutdownPhase: EMCShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  units: number
  stability: number
  fieldStrength: number
  temperature: number
  isContained: boolean
  currentDraw: number
}

interface EMCManagerContextType extends EMCState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  isExpanded: boolean
  firmware: typeof EMC_FIRMWARE
  powerSpecs: typeof EMC_POWER_SPECS
}

const EMCManagerContext = createContext<EMCManagerContextType | null>(null)

interface EMCManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; isExpanded?: boolean }
}

export function EMCManagerProvider({ children, initialState }: EMCManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered

  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])

  const [deviceState, setDeviceState] = useState<EMCDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<EMCBootPhase>(startPowered ? 'field' : null)
  const [testPhase, setTestPhase] = useState<EMCTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<EMCShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(startPowered ? EMC_POWER_SPECS.full : EMC_POWER_SPECS.standby)

  const [units, setUnits] = useState(0)
  const [stability, setStability] = useState(0)
  const [fieldStrength, setFieldStrength] = useState(0)
  const [temperature, setTemperature] = useState(800)
  const [isContained, setIsContained] = useState(false)

  // Simulate fluctuating exotic matter metrics when online
  useEffect(() => {
    if (deviceState !== 'online') return

    const interval = setInterval(() => {
      setStability(prev => {
        const delta = (Math.random() - 0.5) * 8
        return Math.round(Math.max(60, Math.min(99, prev + delta)))
      })
      setFieldStrength(prev => {
        const delta = (Math.random() - 0.5) * 6
        return Math.round(Math.max(70, Math.min(100, prev + delta)))
      })
      setTemperature(prev => {
        const delta = (Math.random() - 0.5) * 100
        return Math.round(Math.max(800, Math.min(1200, prev + delta)))
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(EMC_POWER_SPECS.full)

    setBootPhase('field')
    setStatusMessage('Field gen...')
    setTemperature(900)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('containment')
    setStatusMessage('Containment...')
    setFieldStrength(40)
    setTemperature(950)
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('particles')
    setStatusMessage('Particle load...')
    setFieldStrength(70)
    setStability(50)
    setUnits(42)
    setTemperature(1000)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('stabilize')
    setStatusMessage('Stabilizing...')
    setStability(80)
    setFieldStrength(90)
    setIsContained(true)
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('ready')
    setStability(92)
    setFieldStrength(95)
    setUnits(42)
    setIsContained(true)
    setDeviceState('online')
    setCurrentDraw(EMC_POWER_SPECS.idle)
    setStatusMessage('CONTAINED')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(EMC_POWER_SPECS.idle)

    setShutdownPhase('decontain')
    setStatusMessage('Decontaining...')
    setIsContained(false)
    setStability(prev => Math.floor(prev * 0.5))
    await new Promise(r => setTimeout(r, 400))

    setShutdownPhase('collapse')
    setStatusMessage('Field collapse...')
    setFieldStrength(10)
    setUnits(0)
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('cooldown')
    setStatusMessage('Cooldown...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(EMC_POWER_SPECS.standby)
    setStatusMessage('Standby mode')
    setStability(0)
    setFieldStrength(0)
    setUnits(0)
    setIsContained(false)
    setTemperature(800)
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
    setCurrentDraw(EMC_POWER_SPECS.scan)

    const phases: NonNullable<EMCTestPhase>[] = ['containment', 'field', 'stability', 'particles', 'complete']
    const phaseMessages: Record<NonNullable<EMCTestPhase>, string> = {
      containment: 'Testing containment...',
      field: 'Verifying field...',
      stability: 'Stability check...',
      particles: 'Particle scan...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 420))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(EMC_POWER_SPECS.idle)
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('CONTAINED')
    }, 3000)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(EMC_POWER_SPECS.full)

    setStatusMessage('Decontaining...')
    setIsContained(false)
    setStability(prev => Math.floor(prev * 0.3))
    await new Promise(r => setTimeout(r, 400))

    setStatusMessage('Re-initializing field...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 350))

    await runBootSequence()
  }, [deviceState, runBootSequence])

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

  const value: EMCManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    units,
    stability,
    fieldStrength,
    temperature,
    isContained,
    currentDraw,
    powerOn,
    powerOff,
    runTest,
    reboot,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: EMC_FIRMWARE,
    powerSpecs: EMC_POWER_SPECS,
  }

  return (
    <EMCManagerContext.Provider value={value}>
      {children}
    </EMCManagerContext.Provider>
  )
}

export function useEMCManager() {
  const context = useContext(EMCManagerContext)
  if (!context) {
    throw new Error('useEMCManager must be used within a EMCManagerProvider')
  }
  return context
}

export function useEMCManagerOptional() {
  return useContext(EMCManagerContext)
}

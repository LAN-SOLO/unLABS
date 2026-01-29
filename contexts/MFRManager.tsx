'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// MFR Device States
type MFRDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type MFRTestPhase = 'plasma' | 'containment' | 'coolant' | 'output' | 'safety' | 'complete' | null
type MFRBootPhase = 'ignition' | 'containment' | 'coolant' | 'ramp' | 'stabilize' | 'ready' | null
type MFRShutdownPhase = 'scram' | 'cooling' | 'collapse' | null

// Firmware metadata - Microfusion Reactor
export const MFR_FIRMWARE = {
  version: '2.3.0',
  build: '2024.02.01',
  checksum: 'B8D4E6F2',
  features: ['plasma-contain', 'power-regulate', 'thermal-manage', 'auto-scram', 'efficiency-tune'],
  securityPatch: '2024.01.28',
}

// Power specs - Microfusion Reactor is a GENERATOR (outputs power)
export const MFR_POWER_SPECS = {
  full: 250,           // E/s output at full
  idle: 150,           // E/s output at idle
  standby: 25,         // E/s output in standby (plasma containment minimum)
  startupCost: 500,    // E one-time cost for ignition
  efficiency: 92,      // Base efficiency %
  category: 'generator' as const,
  tier: 2 as const,
}

interface MFRState {
  deviceState: MFRDeviceState
  bootPhase: MFRBootPhase
  testPhase: MFRTestPhase
  shutdownPhase: MFRShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  // Reactor-specific state
  powerOutput: number
  stability: number
  plasmaTemp: number
  efficiency: number
  ringSpeed: number
}

interface MFRManagerContextType extends MFRState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  // Read-only info
  firmware: typeof MFR_FIRMWARE
  powerSpecs: typeof MFR_POWER_SPECS
}

const MFRManagerContext = createContext<MFRManagerContextType | null>(null)

interface MFRManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean }
}

export function MFRManagerProvider({ children, initialState }: MFRManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<MFRDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<MFRBootPhase>(startPowered ? 'ignition' : null)
  const [testPhase, setTestPhase] = useState<MFRTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<MFRShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [powerOutput, setPowerOutput] = useState(0)
  const [stability, setStability] = useState(0)
  const [plasmaTemp, setPlasmaTemp] = useState(0)
  const [efficiency, setEfficiency] = useState(MFR_POWER_SPECS.efficiency)
  const [ringSpeed, setRingSpeed] = useState(0)

  // Stability fluctuation simulation
  useEffect(() => {
    if (deviceState === 'online' && isPowered) {
      const interval = setInterval(() => {
        setStability(prev => Math.max(85, Math.min(99, prev + (Math.random() - 0.5) * 2)))
        setPlasmaTemp(prev => Math.max(14000, Math.min(16000, prev + (Math.random() - 0.5) * 200)))
        setEfficiency(prev => Math.max(88, Math.min(96, prev + (Math.random() - 0.5) * 1)))
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [deviceState, isPowered])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')

    setBootPhase('ignition')
    setStatusMessage('Plasma ignition...')
    setPowerOutput(0)
    setStability(0)
    setRingSpeed(0)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('containment')
    setStatusMessage('Containment field...')
    setStability(20)
    setRingSpeed(0.3)
    setPlasmaTemp(5000)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('coolant')
    setStatusMessage('Coolant flow...')
    setPowerOutput(50)
    setStability(50)
    setRingSpeed(0.5)
    setPlasmaTemp(10000)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('ramp')
    setStatusMessage('Power ramp...')
    setPowerOutput(150)
    setStability(75)
    setRingSpeed(0.8)
    setPlasmaTemp(13000)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('stabilize')
    setStatusMessage('Stabilizing...')
    await new Promise(r => setTimeout(r, 400))

    // Final boot
    setPowerOutput(MFR_POWER_SPECS.full)
    setStability(94)
    setPlasmaTemp(15000)
    setRingSpeed(1)
    setBootPhase('ready')
    setDeviceState('online')
    setStatusMessage('94% STABLE')
    setBootPhase(null)
  }, [])

  // Shutdown sequence (SCRAM)
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')

    setShutdownPhase('scram')
    setStatusMessage('SCRAM initiated...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('cooling')
    setStatusMessage('Plasma cooling...')
    setPowerOutput(50)
    setRingSpeed(0.3)
    setPlasmaTemp(5000)
    await new Promise(r => setTimeout(r, 350))

    setShutdownPhase('collapse')
    setStatusMessage('Field collapse...')
    setPowerOutput(0)
    setStability(0)
    setRingSpeed(0)
    setPlasmaTemp(0)
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase(null)
    setDeviceState('standby')
    setStatusMessage('Standby')
  }, [])

  // Power ON
  const powerOn = useCallback(async () => {
    if (deviceState !== 'standby') return
    setIsPowered(true)
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Power OFF (SCRAM)
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

    const phases: NonNullable<MFRTestPhase>[] = ['plasma', 'containment', 'coolant', 'output', 'safety', 'complete']
    const phaseMessages: Record<NonNullable<MFRTestPhase>, string> = {
      plasma: 'Testing plasma density...',
      containment: 'Checking containment...',
      coolant: 'Verifying coolant...',
      output: 'Testing power output...',
      safety: 'Safety systems check...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 350))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage(`${Math.round(stability)}% STABLE`)
    }, 3000)
  }, [deviceState, stability])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('SCRAM initiated...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Plasma cooling...')
    setPowerOutput(50)
    setRingSpeed(0.3)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Field collapse...')
    setPowerOutput(0)
    setStability(0)
    setRingSpeed(0)
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reactor offline')
    await new Promise(r => setTimeout(r, 400))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Auto-boot on mount (skip if starting in standby)
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

  const value: MFRManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    powerOutput,
    stability,
    plasmaTemp,
    efficiency,
    ringSpeed,
    powerOn,
    powerOff,
    runTest,
    reboot,
    firmware: MFR_FIRMWARE,
    powerSpecs: MFR_POWER_SPECS,
  }

  return (
    <MFRManagerContext.Provider value={value}>
      {children}
    </MFRManagerContext.Provider>
  )
}

export function useMFRManager() {
  const context = useContext(MFRManagerContext)
  if (!context) {
    throw new Error('useMFRManager must be used within a MFRManagerProvider')
  }
  return context
}

export function useMFRManagerOptional() {
  return useContext(MFRManagerContext)
}

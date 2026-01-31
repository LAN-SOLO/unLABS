'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// QSM Device States
type QSMDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type QSMTestPhase = 'coherence' | 'entanglement' | 'decoherence' | 'error' | 'complete' | null
type QSMBootPhase = 'cooling' | 'calibrate' | 'entangle' | 'stabilize' | 'ready' | null
type QSMShutdownPhase = 'collapse' | 'decohere' | 'cooldown' | null

// Firmware metadata
export const QSM_FIRMWARE = {
  version: '1.2.0',
  build: '2026.01.20',
  checksum: 'Q7S4M1N9',
  features: ['qubit-array', 'coherence-tracking', 'entanglement-verify', 'error-correction', 'wave-function'],
  securityPatch: '2026.01.18',
}

// Power specs
export const QSM_POWER_SPECS = {
  full: 12,
  idle: 7,
  standby: 1,
  scan: 18,
  category: 'medium' as const,
  priority: 2 as const,
}

interface QSMState {
  deviceState: QSMDeviceState
  bootPhase: QSMBootPhase
  testPhase: QSMTestPhase
  shutdownPhase: QSMShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  coherence: number
  qubits: number
  isEntangled: boolean
  currentDraw: number
  errorRate: number
  temperature: number
}

interface QSMManagerContextType extends QSMState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  isExpanded: boolean
  firmware: typeof QSM_FIRMWARE
  powerSpecs: typeof QSM_POWER_SPECS
}

const QSMManagerContext = createContext<QSMManagerContextType | null>(null)

interface QSMManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; isExpanded?: boolean }
}

export function QSMManagerProvider({ children, initialState }: QSMManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered

  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])

  const [deviceState, setDeviceState] = useState<QSMDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<QSMBootPhase>(startPowered ? 'cooling' : null)
  const [testPhase, setTestPhase] = useState<QSMTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<QSMShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(startPowered ? QSM_POWER_SPECS.full : QSM_POWER_SPECS.standby)

  const [coherence, setCoherence] = useState(0)
  const [qubits, setQubits] = useState(0)
  const [isEntangled, setIsEntangled] = useState(false)
  const [errorRate, setErrorRate] = useState(0)
  const [temperature, setTemperature] = useState(15)

  // Simulate fluctuating quantum metrics when online
  useEffect(() => {
    if (deviceState !== 'online') return

    const interval = setInterval(() => {
      setCoherence(prev => {
        const delta = (Math.random() - 0.5) * 3
        return Math.round(Math.max(70, Math.min(99, prev + delta)))
      })
      setErrorRate(prev => {
        const delta = (Math.random() - 0.5) * 0.3
        return Math.round(Math.max(0.1, Math.min(5, prev + delta)) * 100) / 100
      })
      setTemperature(prev => {
        const delta = (Math.random() - 0.5) * 0.5
        return Math.round(Math.max(10, Math.min(25, prev + delta)) * 10) / 10
      })
    }, 2500)
    return () => clearInterval(interval)
  }, [deviceState])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(QSM_POWER_SPECS.full)

    setBootPhase('cooling')
    setStatusMessage('Cooling qubits...')
    setTemperature(25)
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    setCoherence(30)
    setQubits(Math.floor(127 * 0.3))
    setTemperature(18)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('entangle')
    setStatusMessage('Entangling...')
    setCoherence(60)
    setQubits(Math.floor(127 * 0.7))
    setIsEntangled(false)
    setTemperature(15)
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('stabilize')
    setStatusMessage('Stabilizing...')
    setCoherence(85)
    setQubits(127)
    setIsEntangled(true)
    setErrorRate(1.2)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('ready')
    setCoherence(94)
    setQubits(127)
    setIsEntangled(true)
    setErrorRate(0.8)
    setDeviceState('online')
    setCurrentDraw(QSM_POWER_SPECS.idle)
    setStatusMessage('COHERENT')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(QSM_POWER_SPECS.idle)

    setShutdownPhase('collapse')
    setStatusMessage('Collapsing state...')
    setCoherence(prev => Math.floor(prev * 0.5))
    setIsEntangled(false)
    await new Promise(r => setTimeout(r, 400))

    setShutdownPhase('decohere')
    setStatusMessage('Decoherence...')
    setCoherence(10)
    setQubits(0)
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('cooldown')
    setStatusMessage('Cooldown...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(QSM_POWER_SPECS.standby)
    setStatusMessage('Standby mode')
    setCoherence(0)
    setQubits(0)
    setIsEntangled(false)
    setErrorRate(0)
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
    setCurrentDraw(QSM_POWER_SPECS.scan)

    const phases: NonNullable<QSMTestPhase>[] = ['coherence', 'entanglement', 'decoherence', 'error', 'complete']
    const phaseMessages: Record<NonNullable<QSMTestPhase>, string> = {
      coherence: 'Measuring coherence...',
      entanglement: 'Verifying entanglement...',
      decoherence: 'Decoherence test...',
      error: 'Error correction...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 380))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(QSM_POWER_SPECS.idle)
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('COHERENT')
    }, 3000)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(QSM_POWER_SPECS.full)

    setStatusMessage('Collapsing state...')
    setCoherence(prev => Math.floor(prev * 0.3))
    setIsEntangled(false)
    await new Promise(r => setTimeout(r, 400))

    setStatusMessage('Re-cooling...')
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

  const value: QSMManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    coherence,
    qubits,
    isEntangled,
    currentDraw,
    errorRate,
    temperature,
    powerOn,
    powerOff,
    runTest,
    reboot,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: QSM_FIRMWARE,
    powerSpecs: QSM_POWER_SPECS,
  }

  return (
    <QSMManagerContext.Provider value={value}>
      {children}
    </QSMManagerContext.Provider>
  )
}

export function useQSMManager() {
  const context = useContext(QSMManagerContext)
  if (!context) {
    throw new Error('useQSMManager must be used within a QSMManagerProvider')
  }
  return context
}

export function useQSMManagerOptional() {
  return useContext(QSMManagerContext)
}

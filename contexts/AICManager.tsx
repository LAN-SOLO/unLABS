'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// AIC Device States
type AICDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type AICTestPhase = 'neural' | 'memory' | 'logic' | 'learning' | 'optimization' | 'complete' | null
type AICBootPhase = 'neural' | 'memory' | 'nodes' | 'training' | 'calibrate' | 'ready' | null
type AICShutdownPhase = 'save' | 'halt' | 'shutdown' | null

// Firmware metadata - AI Assistant Core
export const AIC_FIRMWARE = {
  version: '2.4.0',
  build: '2024.02.20',
  checksum: 'E7A9C3B5',
  features: ['neural-core', 'task-queue', 'auto-optimize', 'learning-mode', 'anomaly-detect'],
  securityPatch: '2024.02.15',
}

// Power specs - AI Assistant Core is a heavy consumer
export const AIC_POWER_SPECS = {
  full: 35,            // E/s at full operation
  idle: 12,            // E/s passive monitoring
  standby: 3,          // E/s wake-on-command
  learning: 50,        // E/s neural pathway optimization
  category: 'heavy' as const,
  priority: 1 as const,
}

interface AICState {
  deviceState: AICDeviceState
  bootPhase: AICBootPhase
  testPhase: AICTestPhase
  shutdownPhase: AICShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  // AI-specific state
  taskQueue: number
  efficiency: number
  isLearning: boolean
  nodeActivity: number[]
  anomalyCount: number
  uptime: number
}

interface AICManagerContextType extends AICState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setLearningMode: (enabled: boolean) => void
  // Fold state
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  // Read-only info
  firmware: typeof AIC_FIRMWARE
  powerSpecs: typeof AIC_POWER_SPECS
}

const AICManagerContext = createContext<AICManagerContextType | null>(null)

interface AICManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; isLearning: boolean; isExpanded?: boolean }
}

export function AICManagerProvider({ children, initialState }: AICManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<AICDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<AICBootPhase>(startPowered ? 'neural' : null)
  const [testPhase, setTestPhase] = useState<AICTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<AICShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [taskQueue, setTaskQueue] = useState(0)
  const [efficiency, setEfficiency] = useState(0)
  const [isLearning, setIsLearning] = useState(initialState?.isLearning ?? true)
  const [nodeActivity, setNodeActivity] = useState([0, 0, 0, 0, 0])
  const [anomalyCount, setAnomalyCount] = useState(0)
  const [uptime, setUptime] = useState(0)

  // Fold state
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])

  // Simulate AI activity
  useEffect(() => {
    if (deviceState === 'online' && isPowered) {
      const interval = setInterval(() => {
        // Fluctuate task queue
        setTaskQueue(prev => Math.max(0, Math.min(15, prev + Math.floor(Math.random() * 5) - 2)))
        // Fluctuate efficiency
        setEfficiency(prev => Math.max(120, Math.min(180, prev + Math.floor(Math.random() * 10) - 5)))
        // Fluctuate node activity
        setNodeActivity(prev => prev.map(() => 0.5 + Math.random() * 0.5))
        // Increment uptime
        setUptime(prev => prev + 2)
        // Rare anomaly detection
        if (Math.random() < 0.05) {
          setAnomalyCount(prev => prev + 1)
        }
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [deviceState, isPowered])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')

    setBootPhase('neural')
    setStatusMessage('Loading neural core...')
    setNodeActivity([0, 0, 0, 0, 0])
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('memory')
    setStatusMessage('Initializing memory banks...')
    setEfficiency(20)
    setNodeActivity([0.3, 0, 0, 0, 0])
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('nodes')
    setStatusMessage('Activating nodes...')
    setTaskQueue(2)
    setEfficiency(50)
    setNodeActivity([0.5, 0.4, 0.3, 0, 0])
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('training')
    setStatusMessage('Training models...')
    setTaskQueue(4)
    setEfficiency(80)
    setNodeActivity([0.7, 0.6, 0.5, 0.4, 0.3])
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating efficiency...')
    await new Promise(r => setTimeout(r, 300))

    // Final boot
    setTaskQueue(7)
    setEfficiency(156)
    setNodeActivity([0.9, 0.8, 0.7, 0.8, 0.9])
    setBootPhase('ready')
    setDeviceState('online')
    setStatusMessage('LEARNING')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')

    setShutdownPhase('save')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halt')
    setStatusMessage('Halting processes...')
    setTaskQueue(0)
    setNodeActivity([0.3, 0.2, 0.1, 0, 0])
    await new Promise(r => setTimeout(r, 350))

    setShutdownPhase('shutdown')
    setStatusMessage('Neural shutdown...')
    setEfficiency(0)
    setNodeActivity([0, 0, 0, 0, 0])
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase(null)
    setDeviceState('standby')
    setStatusMessage('Standby')
  }, [])

  // Power ON
  const powerOn = useCallback(async () => {
    if (deviceState !== 'standby') return
    setIsPowered(true)
    setIsExpanded(true)
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Power OFF
  const powerOff = useCallback(async () => {
    if (deviceState !== 'online') return
    setIsPowered(false)
    await runShutdownSequence()
    setIsExpanded(false)
  }, [deviceState, runShutdownSequence])

  // Run test
  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<AICTestPhase>[] = ['neural', 'memory', 'logic', 'learning', 'optimization', 'complete']
    const phaseMessages: Record<NonNullable<AICTestPhase>, string> = {
      neural: 'Testing neural pathways...',
      memory: 'Verifying memory integrity...',
      logic: 'Checking logic gates...',
      learning: 'Validating learning rate...',
      optimization: 'Benchmarking optimizer...',
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
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('LEARNING')
    }, 3000)
  }, [deviceState])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Halting processes...')
    setTaskQueue(0)
    setNodeActivity([0.3, 0.2, 0.1, 0, 0])
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Neural shutdown...')
    setEfficiency(0)
    setNodeActivity([0, 0, 0, 0, 0])
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Core offline')
    await new Promise(r => setTimeout(r, 400))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Set learning mode
  const setLearningMode = useCallback((enabled: boolean) => {
    if (deviceState !== 'online') return
    setIsLearning(enabled)
    setStatusMessage(enabled ? 'LEARNING' : 'MONITORING')
  }, [deviceState])

  // Auto-boot on mount (skip if starting in standby)
  const hasBootedRef = useRef(false)
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true
      if (startPowered) {
        runBootSequence().then(() => {
          // Restore learning mode after boot
          if (initialState && !initialState.isLearning) {
            setIsLearning(false)
            setStatusMessage('MONITORING')
          }
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: AICManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    taskQueue,
    efficiency,
    isLearning,
    nodeActivity,
    anomalyCount,
    uptime,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setLearningMode,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: AIC_FIRMWARE,
    powerSpecs: AIC_POWER_SPECS,
  }

  return (
    <AICManagerContext.Provider value={value}>
      {children}
    </AICManagerContext.Provider>
  )
}

export function useAICManager() {
  const context = useContext(AICManagerContext)
  if (!context) {
    throw new Error('useAICManager must be used within an AICManagerProvider')
  }
  return context
}

export function useAICManagerOptional() {
  return useContext(AICManagerContext)
}

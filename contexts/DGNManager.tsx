'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// DGN Device States
type DGNDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type DGNTestPhase = 'memory' | 'systems' | 'network' | 'devices' | 'complete' | null
type DGNBootPhase = 'memory' | 'kernel' | 'interfaces' | 'sensors' | 'calibrate' | 'ready' | null
type DGNShutdownPhase = 'flush-log' | 'stop-sensors' | 'power-down' | null
type DiagnosticCategory = 'SYSTEMS' | 'DEVICES' | 'ENERGY' | 'NETWORK' | 'CRYSTALS' | 'PROCESS'

// Firmware metadata - Universal Diagnostics Console
export const DGN_FIRMWARE = {
  version: '2.0.4',
  build: '2024.02.15',
  checksum: 'D9F3B2A7',
  features: ['system-diag', 'component-scan', 'health-monitor', 'alert-system', 'log-output', 'multi-category'],
  securityPatch: '2024.02.10',
}

// Power specs - Universal Diagnostics Console is a light consumer
export const DGN_POWER_SPECS = {
  full: 3,            // E/s at full scan
  idle: 1,            // E/s idle (powered, no scan)
  standby: 0.25,      // E/s in standby
  category: 'light' as const,
  priority: 2 as const,
}

// Diagnostic specs
export const DGN_DIAG_SPECS = {
  categories: ['SYSTEMS', 'DEVICES', 'ENERGY', 'NETWORK', 'CRYSTALS', 'PROCESS'] as const,
  totalComponents: 36,
  scanDepthRange: { min: 0, max: 100 },
  componentsPerCategory: 6,
}

interface DGNState {
  deviceState: DGNDeviceState
  bootPhase: DGNBootPhase
  testPhase: DGNTestPhase
  shutdownPhase: DGNShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  // Diagnostics-specific state
  category: DiagnosticCategory
  scanDepth: number        // 0-100
  healthPercent: number    // 0-100
  alertCount: number
  isRunningDiag: boolean
  diagProgress: number     // 0-100
}

interface DGNManagerContextType extends DGNState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setCategory: (category: DiagnosticCategory) => void
  setScanDepth: (depth: number) => void
  runDiagnostics: () => Promise<void>
  clearAlerts: () => void
  // Fold state
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  // Read-only info
  firmware: typeof DGN_FIRMWARE
  powerSpecs: typeof DGN_POWER_SPECS
  diagSpecs: typeof DGN_DIAG_SPECS
}

const DGNManagerContext = createContext<DGNManagerContextType | null>(null)

interface DGNManagerProviderProps {
  children: ReactNode
  initialState?: {
    isPowered?: boolean
    category?: string
    scanDepth?: number
    isExpanded?: boolean
  }
}

export function DGNManagerProvider({ children, initialState }: DGNManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<DGNDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<DGNBootPhase>(startPowered ? 'memory' : null)
  const [testPhase, setTestPhase] = useState<DGNTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<DGNShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [category, setCategoryState] = useState<DiagnosticCategory>(
    (initialState?.category as DiagnosticCategory) ?? 'SYSTEMS'
  )
  const [scanDepth, setScanDepthState] = useState(initialState?.scanDepth ?? 75)
  const [healthPercent, setHealthPercent] = useState(100)
  const [alertCount, setAlertCount] = useState(0)
  const [isRunningDiag, setIsRunningDiag] = useState(false)
  const [diagProgress, setDiagProgress] = useState(0)

  // Fold state
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')

    setBootPhase('memory')
    setStatusMessage('Memory check...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('kernel')
    setStatusMessage('Kernel load...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('interfaces')
    setStatusMessage('Init interfaces...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('sensors')
    setStatusMessage('Start sensors...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('ready')
    setDeviceState('online')
    setStatusMessage('Ready')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')

    setShutdownPhase('flush-log')
    setStatusMessage('Flushing logs...')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase('stop-sensors')
    setStatusMessage('Stopping sensors...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('power-down')
    setStatusMessage('Power down...')
    await new Promise(r => setTimeout(r, 200))

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

    const phases: NonNullable<DGNTestPhase>[] = ['memory', 'systems', 'network', 'devices', 'complete']
    const phaseMessages: Record<NonNullable<DGNTestPhase>, string> = {
      memory: 'Testing memory...',
      systems: 'Checking systems...',
      network: 'Verifying network...',
      devices: 'Testing devices...',
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
      setStatusMessage('Ready')
    }, 3000)
  }, [deviceState])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Flushing logs...')
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Stopping sensors...')
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Power down...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('DGN offline')
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Category control
  const setCategory = useCallback((cat: DiagnosticCategory) => {
    if (deviceState !== 'online' || isRunningDiag) return
    setCategoryState(cat)
  }, [deviceState, isRunningDiag])

  // Scan depth control
  const setScanDepth = useCallback((depth: number) => {
    if (deviceState !== 'online' || isRunningDiag) return
    setScanDepthState(Math.max(0, Math.min(100, depth)))
  }, [deviceState, isRunningDiag])

  // Run diagnostics
  const runDiagnostics = useCallback(async () => {
    if (deviceState !== 'online' || isRunningDiag) return

    setIsRunningDiag(true)
    setDiagProgress(0)
    setStatusMessage(`Scanning ${category}...`)

    // Simulate diagnostic scan over ~2 seconds
    const totalSteps = 20
    const stepDelay = 100

    for (let i = 0; i <= totalSteps; i++) {
      setDiagProgress(Math.floor((i / totalSteps) * 100))
      await new Promise(r => setTimeout(r, stepDelay))
    }

    // Update health and alerts with some randomness
    const newHealth = Math.max(75, Math.floor(Math.random() * 26) + 75) // 75-100
    const newAlerts = Math.floor(Math.random() * 5) // 0-4 alerts

    setHealthPercent(newHealth)
    setAlertCount(prev => prev + newAlerts)
    setIsRunningDiag(false)
    setDiagProgress(100)
    setStatusMessage(newAlerts > 0 ? `Scan complete: ${newAlerts} alert(s)` : 'Scan complete: OK')

    // Reset status after delay
    setTimeout(() => {
      setDiagProgress(0)
      setStatusMessage('Ready')
    }, 2000)
  }, [deviceState, isRunningDiag, category])

  // Clear alerts
  const clearAlerts = useCallback(() => {
    if (deviceState !== 'online') return
    setAlertCount(0)
    setStatusMessage('Alerts cleared')
    setTimeout(() => setStatusMessage('Ready'), 1500)
  }, [deviceState])

  // Auto-boot on mount
  const hasBootedRef = useRef(false)
  const savedStateRef = useRef(initialState)
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true
      if (startPowered) {
        runBootSequence().then(() => {
          if (savedStateRef.current) {
            if (savedStateRef.current.category) {
              setCategoryState(savedStateRef.current.category as DiagnosticCategory)
            }
            if (savedStateRef.current.scanDepth !== undefined) {
              setScanDepthState(savedStateRef.current.scanDepth)
            }
          }
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: DGNManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    category,
    scanDepth,
    healthPercent,
    alertCount,
    isRunningDiag,
    diagProgress,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setCategory,
    setScanDepth,
    runDiagnostics,
    clearAlerts,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: DGN_FIRMWARE,
    powerSpecs: DGN_POWER_SPECS,
    diagSpecs: DGN_DIAG_SPECS,
  }

  return (
    <DGNManagerContext.Provider value={value}>
      {children}
    </DGNManagerContext.Provider>
  )
}

export function useDGNManager() {
  const context = useContext(DGNManagerContext)
  if (!context) {
    throw new Error('useDGNManager must be used within a DGNManagerProvider')
  }
  return context
}

export function useDGNManagerOptional() {
  return useContext(DGNManagerContext)
}

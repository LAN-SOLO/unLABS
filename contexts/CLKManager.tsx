'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// CLK Device States
type CLKDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type CLKTestPhase = 'crystal' | 'sync' | 'drift' | 'accuracy' | 'complete' | null
type CLKBootPhase = 'crystal' | 'rtc' | 'ntp' | 'calibrate' | 'drift' | 'ready' | null
type CLKShutdownPhase = 'saving' | 'rtc-stop' | 'halted' | null
export type CLKMode = 'local' | 'utc' | 'date' | 'uptime' | 'countdown' | 'stopwatch'

// Firmware metadata
export const CLK_FIRMWARE = {
  version: '2.4.0',
  build: '2025.12.15',
  checksum: 'CL0CK241',
  features: ['crystal-osc', 'ntp-sync', 'drift-comp', 'multi-mode', 'stopwatch', 'countdown'],
  securityPatch: '2025.12.10',
}

// Power specs
export const CLK_POWER_SPECS = {
  full: 0.5,
  idle: 0.3,
  standby: 0.05,
  category: 'light' as const,
  priority: 1 as const,
}

interface CLKState {
  deviceState: CLKDeviceState
  bootPhase: CLKBootPhase
  testPhase: CLKTestPhase
  shutdownPhase: CLKShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  displayMode: CLKMode
  currentTime: Date
  uptime: number
  stopwatchTime: number
  stopwatchRunning: boolean
  countdownTime: number
  countdownRunning: boolean
}

interface CLKManagerContextType extends CLKState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  cycleMode: () => void
  setMode: (mode: CLKMode) => void
  toggleStopwatch: () => void
  resetStopwatch: () => void
  toggleCountdown: () => void
  resetCountdown: () => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof CLK_FIRMWARE
  powerSpecs: typeof CLK_POWER_SPECS
}

const CLKManagerContext = createContext<CLKManagerContextType | null>(null)

interface CLKManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; displayMode?: CLKMode; isExpanded?: boolean }
}

export function CLKManagerProvider({ children, initialState }: CLKManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<CLKDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<CLKBootPhase>(startPowered ? 'crystal' : null)
  const [testPhase, setTestPhase] = useState<CLKTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<CLKShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Init...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(CLK_POWER_SPECS.idle)
  const [displayMode, setDisplayMode] = useState<CLKMode>(initialState?.displayMode ?? 'local')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [uptime, setUptime] = useState(0)
  const [stopwatchTime, setStopwatchTime] = useState(0)
  const [stopwatchRunning, setStopwatchRunning] = useState(false)
  const [countdownTime, setCountdownTime] = useState(3600) // 1 hour default
  const [countdownRunning, setCountdownRunning] = useState(false)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(CLK_POWER_SPECS.full)

    setBootPhase('crystal')
    setStatusMessage('Crystal init...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('rtc')
    setStatusMessage('RTC sync...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('ntp')
    setStatusMessage('NTP query...')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('drift')
    setStatusMessage('Drift comp...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(CLK_POWER_SPECS.idle)
    setStatusMessage('SYNCED')
    setBootPhase(null)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(CLK_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving time...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('rtc-stop')
    setStatusMessage('RTC halt...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(CLK_POWER_SPECS.standby)
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
    setIsExpanded(false)
    await runShutdownSequence()
  }, [deviceState, runShutdownSequence])

  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)
    setCurrentDraw(CLK_POWER_SPECS.full)

    const phases: NonNullable<CLKTestPhase>[] = ['crystal', 'sync', 'drift', 'accuracy', 'complete']
    const phaseMessages: Record<NonNullable<CLKTestPhase>, string> = {
      crystal: 'Testing crystal...',
      sync: 'Sync check...',
      drift: 'Drift analysis...',
      accuracy: 'Accuracy test...',
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
    setCurrentDraw(CLK_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('SYNCED')
    }, 2500)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(CLK_POWER_SPECS.full)

    setStatusMessage('Shutdown...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset RTC...')
    setBootPhase(null)
    setUptime(0)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const cycleMode = useCallback(() => {
    if (deviceState !== 'online') return
    const modes: CLKMode[] = ['local', 'utc', 'date', 'uptime', 'countdown', 'stopwatch']
    const currentIndex = modes.indexOf(displayMode)
    setDisplayMode(modes[(currentIndex + 1) % modes.length])
  }, [deviceState, displayMode])

  const setMode = useCallback((mode: CLKMode) => {
    if (deviceState !== 'online') return
    setDisplayMode(mode)
  }, [deviceState])

  const toggleStopwatch = useCallback(() => {
    if (displayMode === 'stopwatch') {
      setStopwatchRunning(!stopwatchRunning)
    }
  }, [displayMode, stopwatchRunning])

  const resetStopwatch = useCallback(() => {
    if (displayMode === 'stopwatch') {
      setStopwatchTime(0)
      setStopwatchRunning(false)
    }
  }, [displayMode])

  const toggleCountdown = useCallback(() => {
    if (displayMode === 'countdown') {
      setCountdownRunning(!countdownRunning)
    }
  }, [displayMode, countdownRunning])

  const resetCountdown = useCallback(() => {
    if (displayMode === 'countdown') {
      setCountdownTime(3600)
      setCountdownRunning(false)
    }
  }, [displayMode])

  // Update time every second
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      if (deviceState === 'online') {
        setUptime(prev => prev + 1)
      }
      if (stopwatchRunning) {
        setStopwatchTime(prev => prev + 1)
      }
      if (countdownRunning && countdownTime > 0) {
        setCountdownTime(prev => Math.max(0, prev - 1))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [deviceState, stopwatchRunning, countdownRunning, countdownTime])

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

  const value: CLKManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    displayMode,
    currentTime,
    uptime,
    stopwatchTime,
    stopwatchRunning,
    countdownTime,
    countdownRunning,
    powerOn,
    powerOff,
    runTest,
    reboot,
    cycleMode,
    setMode,
    toggleStopwatch,
    resetStopwatch,
    toggleCountdown,
    resetCountdown,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: CLK_FIRMWARE,
    powerSpecs: CLK_POWER_SPECS,
  }

  return (
    <CLKManagerContext.Provider value={value}>
      {children}
    </CLKManagerContext.Provider>
  )
}

export function useCLKManager() {
  const context = useContext(CLKManagerContext)
  if (!context) {
    throw new Error('useCLKManager must be used within a CLKManagerProvider')
  }
  return context
}

export function useCLKManagerOptional() {
  return useContext(CLKManagerContext)
}

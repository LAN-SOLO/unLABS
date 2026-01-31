'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// MEM Device States
type MEMDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type MEMBootPhase = 'dimm-detect' | 'spd-read' | 'timing' | 'memtest' | 'mapping' | null
type MEMTestPhase = 'modules' | 'timing' | 'integrity' | 'bandwidth' | 'stress' | 'complete' | null
type MEMShutdownPhase = 'flushing' | 'controller-reset' | 'halted' | null

export type MEMMode = 'usage' | 'heap' | 'cache' | 'swap' | 'processes' | 'allocation'

// Firmware metadata
export const MEM_FIRMWARE = {
  version: '3.1.0',
  build: '2025.10.20',
  checksum: 'M3M0RY01',
  features: ['dimm-detect', 'spd-read', 'timing-config', 'bandwidth-test', 'multi-mode'],
  securityPatch: '2025.10.15',
}

// Power specs
export const MEM_POWER_SPECS = {
  full: 0.6,
  idle: 0.4,
  standby: 0.05,
  category: 'light' as const,
  priority: 1 as const,
}

interface MemData {
  heap: { used: number; total: number }
  cache: { used: number; total: number }
  swap: { used: number; total: number }
  processes: { name: string; mem: number }[]
  allocation: { kernel: number; user: number; buffers: number }
}

const DEFAULT_PROCESSES = [
  { name: 'crystal-engine', mem: 3.2 },
  { name: 'slice-renderer', mem: 2.8 },
  { name: 'terminal-daemon', mem: 1.4 },
  { name: 'blockchain-sync', mem: 1.9 },
  { name: 'volatility-mon', mem: 1.1 },
  { name: 'auth-service', mem: 1.1 },
]

const DEFAULT_MEM_DATA: MemData = {
  heap: { used: 6.4, total: 8.0 },
  cache: { used: 2.1, total: 4.0 },
  swap: { used: 0.3, total: 2.0 },
  processes: DEFAULT_PROCESSES,
  allocation: { kernel: 2.4, user: 8.2, buffers: 0.9 },
}

interface MEMState {
  deviceState: MEMDeviceState
  bootPhase: MEMBootPhase
  testPhase: MEMTestPhase
  shutdownPhase: MEMShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  totalMemory: number
  usedMemory: number
  displayMode: MEMMode
  memData: MemData
}

interface MEMManagerContextType extends MEMState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setTotalMemory: (value: number) => void
  setUsedMemory: (value: number) => void
  cycleMode: () => void
  setMode: (mode: MEMMode) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof MEM_FIRMWARE
  powerSpecs: typeof MEM_POWER_SPECS
}

const MEMManagerContext = createContext<MEMManagerContextType | null>(null)

interface MEMManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; totalMemory?: number; usedMemory?: number; displayMode?: string; isExpanded?: boolean }
}

const MODE_ORDER: MEMMode[] = ['usage', 'heap', 'cache', 'swap', 'processes', 'allocation']

export function MEMManagerProvider({ children, initialState }: MEMManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<MEMDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<MEMBootPhase>(startPowered ? 'dimm-detect' : null)
  const [testPhase, setTestPhase] = useState<MEMTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<MEMShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(MEM_POWER_SPECS.idle)
  const [totalMemory, setTotalMemoryState] = useState(initialState?.totalMemory ?? 16)
  const [usedMemory, setUsedMemoryState] = useState(initialState?.usedMemory ?? 11.5)
  const [displayMode, setDisplayMode] = useState<MEMMode>((initialState?.displayMode as MEMMode) ?? 'usage')
  const [memData, setMemData] = useState<MemData>(DEFAULT_MEM_DATA)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(MEM_POWER_SPECS.full)

    setBootPhase('dimm-detect')
    setStatusMessage('Detecting DIMMs...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('spd-read')
    setStatusMessage('Reading SPD data...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('timing')
    setStatusMessage('Configuring timings...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('memtest')
    setStatusMessage('Memory test...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('mapping')
    setStatusMessage('Mapping addresses...')
    setTotalMemoryState(initialState?.totalMemory ?? 16)
    setUsedMemoryState(initialState?.usedMemory ?? 11.5)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase(null)
    setDeviceState('online')
    setCurrentDraw(MEM_POWER_SPECS.idle)
    setStatusMessage('READY')
  }, [initialState?.totalMemory, initialState?.usedMemory])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(MEM_POWER_SPECS.idle)

    setShutdownPhase('flushing')
    setStatusMessage('Flushing buffers...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('controller-reset')
    setStatusMessage('Controller reset...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(MEM_POWER_SPECS.standby)
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
    setCurrentDraw(MEM_POWER_SPECS.full)

    const phases: NonNullable<MEMTestPhase>[] = ['modules', 'timing', 'integrity', 'bandwidth', 'stress', 'complete']
    const phaseMessages: Record<NonNullable<MEMTestPhase>, string> = {
      modules: 'Module test...',
      timing: 'Timing test...',
      integrity: 'Integrity test...',
      bandwidth: 'Bandwidth test...',
      stress: 'Stress test...',
      complete: 'Test complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      const duration = phase === 'stress' ? 600 : 350
      await new Promise(r => setTimeout(r, duration))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(MEM_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('READY')
    }, 2500)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(MEM_POWER_SPECS.full)

    setStatusMessage('Flushing buffers...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset controller...')
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('System halted')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const setTotalMemory = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setTotalMemoryState(value)
  }, [deviceState])

  const setUsedMemory = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setUsedMemoryState(value)
  }, [deviceState])

  const cycleMode = useCallback(() => {
    setDisplayMode(prev => {
      const idx = MODE_ORDER.indexOf(prev)
      return MODE_ORDER[(idx + 1) % MODE_ORDER.length]
    })
  }, [])

  const setMode = useCallback((mode: MEMMode) => {
    setDisplayMode(mode)
  }, [])

  // Memory data fluctuation effect
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return
    const interval = setInterval(() => {
      if (deviceState === 'online' || deviceState === 'testing') {
        setMemData(prev => ({
          ...prev,
          processes: prev.processes.map(p => ({
            ...p,
            mem: Math.max(0.1, p.mem + (Math.random() - 0.5) * 0.2),
          })),
        }))
      }
    }, 500)
    return () => clearInterval(interval)
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

  const value: MEMManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    totalMemory,
    usedMemory,
    displayMode,
    memData,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setTotalMemory,
    setUsedMemory,
    cycleMode,
    setMode,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: MEM_FIRMWARE,
    powerSpecs: MEM_POWER_SPECS,
  }

  return (
    <MEMManagerContext.Provider value={value}>
      {children}
    </MEMManagerContext.Provider>
  )
}

export function useMEMManager() {
  const context = useContext(MEMManagerContext)
  if (!context) {
    throw new Error('useMEMManager must be used within a MEMManagerProvider')
  }
  return context
}

export function useMEMManagerOptional() {
  return useContext(MEMManagerContext)
}

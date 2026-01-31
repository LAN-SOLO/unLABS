'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// SCA Device States
type SCADeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type SCATestPhase = 'nodes' | 'interconnect' | 'memory' | 'cache' | 'scheduler' | 'benchmark' | 'complete' | null
type SCABootPhase = 'post' | 'nodes' | 'interconnect' | 'memory' | 'scheduler' | 'benchmark' | 'ready' | null
type SCAShutdownPhase = 'drain' | 'nodes' | 'offline' | null

// Firmware metadata - Supercomputer Array
export const SCA_FIRMWARE = {
  version: '5.2.0',
  build: '2026.01.28',
  checksum: 'C8A5F2E7',
  features: ['16-node-cluster', 'ecc-memory', 'job-scheduler', 'linpack-bench', 'interconnect-mesh'],
  securityPatch: '2026.01.20',
}

// Power specs - Supercomputer Array is a heavy consumer
export const SCA_POWER_SPECS = {
  full: 45,            // E/s at full compute
  idle: 15,            // E/s idle monitoring
  standby: 5,          // E/s wake-on-job
  benchmark: 60,       // E/s during LINPACK
  category: 'heavy' as const,
  priority: 3 as const,
}

interface SCAState {
  deviceState: SCADeviceState
  bootPhase: SCABootPhase
  testPhase: SCATestPhase
  shutdownPhase: SCAShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  // SCA-specific state
  flops: number            // PFLOPS
  utilization: number      // 0-100%
  activeNodes: number      // 0-16
  jobQueue: number         // queued jobs
  temperature: number      // cluster avg temp
  memoryUsage: number      // % of ECC memory used
  interconnectBandwidth: number  // GB/s
  uptime: number           // seconds
  currentDraw: number      // E/s
}

interface SCAManagerContextType extends SCAState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  // Fold state
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  // Read-only info
  firmware: typeof SCA_FIRMWARE
  powerSpecs: typeof SCA_POWER_SPECS
}

const SCAManagerContext = createContext<SCAManagerContextType | null>(null)

interface SCAManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; isExpanded?: boolean }
}

export function SCAManagerProvider({ children, initialState }: SCAManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<SCADeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<SCABootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<SCATestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<SCAShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [flops, setFlops] = useState(0)
  const [utilization, setUtilization] = useState(0)
  const [activeNodes, setActiveNodes] = useState(0)
  const [jobQueue, setJobQueue] = useState(0)
  const [temperature, setTemperature] = useState(28)
  const [memoryUsage, setMemoryUsage] = useState(0)
  const [interconnectBandwidth, setInterconnectBandwidth] = useState(0)
  const [uptime, setUptime] = useState(0)
  const [currentDraw, setCurrentDraw] = useState(startPowered ? SCA_POWER_SPECS.full : SCA_POWER_SPECS.standby)

  // Simulate cluster activity when online
  useEffect(() => {
    if (deviceState === 'online' && isPowered) {
      const interval = setInterval(() => {
        // Fluctuate utilization
        setUtilization(prev => Math.max(55, Math.min(98, prev + (Math.random() - 0.48) * 8)))
        // Fluctuate job queue
        setJobQueue(prev => Math.max(0, Math.min(24, prev + Math.floor(Math.random() * 5) - 2)))
        // Fluctuate temperature based on utilization
        setTemperature(prev => Math.max(28, Math.min(72, prev + (Math.random() - 0.5) * 3)))
        // Fluctuate memory usage
        setMemoryUsage(prev => Math.max(40, Math.min(95, prev + (Math.random() - 0.5) * 5)))
        // Fluctuate interconnect
        setInterconnectBandwidth(prev => Math.max(80, Math.min(200, prev + (Math.random() - 0.5) * 20)))
        // Slight FLOPS variation
        setFlops(prev => Math.max(2.0, Math.min(2.8, prev + (Math.random() - 0.5) * 0.15)))
        // Update power draw based on utilization
        setCurrentDraw(SCA_POWER_SPECS.idle + ((SCA_POWER_SPECS.full - SCA_POWER_SPECS.idle) * (utilization / 100)))
        // Increment uptime
        setUptime(prev => prev + 2)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [deviceState, isPowered, utilization])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(SCA_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('nodes')
    setStatusMessage('Node discovery...')
    setActiveNodes(4)
    setUtilization(5)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('interconnect')
    setStatusMessage('Interconnect init...')
    setActiveNodes(8)
    setFlops(0.4)
    setInterconnectBandwidth(50)
    setUtilization(15)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('memory')
    setStatusMessage('Memory allocation...')
    setActiveNodes(12)
    setFlops(1.2)
    setMemoryUsage(30)
    setUtilization(35)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('scheduler')
    setStatusMessage('Scheduler online...')
    setActiveNodes(14)
    setFlops(1.8)
    setUtilization(55)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('benchmark')
    setStatusMessage('Benchmark calibrate...')
    await new Promise(r => setTimeout(r, 400))

    // Final boot
    setActiveNodes(16)
    setFlops(2.4)
    setUtilization(87)
    setMemoryUsage(62)
    setInterconnectBandwidth(156)
    setJobQueue(7)
    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(SCA_POWER_SPECS.idle)
    setStatusMessage('READY')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(SCA_POWER_SPECS.idle)

    setShutdownPhase('drain')
    setStatusMessage('Draining jobs...')
    setJobQueue(0)
    setUtilization(20)
    await new Promise(r => setTimeout(r, 350))

    setShutdownPhase('nodes')
    setStatusMessage('Node shutdown...')
    setActiveNodes(4)
    setFlops(0.2)
    setMemoryUsage(5)
    setInterconnectBandwidth(0)
    setUtilization(5)
    await new Promise(r => setTimeout(r, 400))

    setShutdownPhase('offline')
    setStatusMessage('Cluster offline')
    setActiveNodes(0)
    setFlops(0)
    setUtilization(0)
    setMemoryUsage(0)
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(SCA_POWER_SPECS.standby)
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
    setIsExpanded(false)
    await runShutdownSequence()
  }, [deviceState, runShutdownSequence])

  // Run test
  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)
    setCurrentDraw(SCA_POWER_SPECS.benchmark)

    const phases: NonNullable<SCATestPhase>[] = ['nodes', 'interconnect', 'memory', 'cache', 'scheduler', 'benchmark', 'complete']
    const phaseMessages: Record<NonNullable<SCATestPhase>, string> = {
      nodes: 'Testing compute nodes...',
      interconnect: 'Checking interconnect mesh...',
      memory: 'Verifying ECC memory...',
      cache: 'Testing L3 cache coherency...',
      scheduler: 'Validating job scheduler...',
      benchmark: 'Running LINPACK benchmark...',
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
    setCurrentDraw(SCA_POWER_SPECS.idle)
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('READY')
    }, 3000)
  }, [deviceState])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Draining jobs...')
    setJobQueue(0)
    setUtilization(20)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Node shutdown...')
    setActiveNodes(4)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Power cycle...')
    setFlops(0)
    setActiveNodes(0)
    setUtilization(0)
    setMemoryUsage(0)
    setInterconnectBandwidth(0)
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 400))

    setStatusMessage('Cluster offline')
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

  const value: SCAManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    flops,
    utilization,
    activeNodes,
    jobQueue,
    temperature,
    memoryUsage,
    interconnectBandwidth,
    uptime,
    currentDraw,
    powerOn,
    powerOff,
    runTest,
    reboot,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: SCA_FIRMWARE,
    powerSpecs: SCA_POWER_SPECS,
  }

  return (
    <SCAManagerContext.Provider value={value}>
      {children}
    </SCAManagerContext.Provider>
  )
}

export function useSCAManager() {
  const context = useContext(SCAManagerContext)
  if (!context) {
    throw new Error('useSCAManager must be used within an SCAManagerProvider')
  }
  return context
}

export function useSCAManagerOptional() {
  return useContext(SCAManagerContext)
}

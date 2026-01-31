'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// NET Device States
type NETDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type NETTestPhase = 'latency' | 'bandwidth' | 'packet' | 'security' | 'complete' | null
type NETBootPhase = 'post' | 'nic' | 'dhcp' | 'handshake' | 'routes' | 'ready' | null
type NETShutdownPhase = 'saving' | 'disconnect' | 'halted' | null

// Firmware metadata
export const NET_FIRMWARE = {
  version: '2.1.0',
  build: '2026.01.28',
  checksum: 'N7E4T2M1',
  features: ['nic-detect', 'dhcp-client', 'throughput-monitor', 'latency-track', 'packet-inspect'],
  securityPatch: '2026.01.20',
}

// Power specs
export const NET_POWER_SPECS = {
  full: 1.5,
  idle: 0.8,
  standby: 0.1,
  category: 'light' as const,
  priority: 2 as const,
}

interface NETState {
  deviceState: NETDeviceState
  bootPhase: NETBootPhase
  testPhase: NETTestPhase
  shutdownPhase: NETShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  bandwidth: number
  latencyMs: number
  isConnected: boolean
  packetLoss: number
}

interface NETManagerContextType extends NETState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setBandwidth: (value: number) => void
  setLatency: (value: number) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof NET_FIRMWARE
  powerSpecs: typeof NET_POWER_SPECS
}

const NETManagerContext = createContext<NETManagerContextType | null>(null)

interface NETManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; bandwidth?: number; latencyMs?: number; isExpanded?: boolean }
}

export function NETManagerProvider({ children, initialState }: NETManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<NETDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<NETBootPhase>(startPowered ? 'post' : null)
  const [testPhase, setTestPhase] = useState<NETTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<NETShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(NET_POWER_SPECS.idle)
  const [bandwidth, setBandwidthState] = useState(initialState?.bandwidth ?? 2.4)
  const [latencyMs, setLatencyState] = useState(initialState?.latencyMs ?? 12)
  const [isConnected, setIsConnected] = useState(false)
  const [packetLoss, setPacketLoss] = useState(0)

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(NET_POWER_SPECS.full)

    setBootPhase('post')
    setStatusMessage('POST check...')
    await new Promise(r => setTimeout(r, 280))

    setBootPhase('nic')
    setStatusMessage('Detecting NIC...')
    await new Promise(r => setTimeout(r, 320))

    setBootPhase('dhcp')
    setStatusMessage('DHCP request...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('handshake')
    setStatusMessage('Handshake...')
    setIsConnected(true)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('routes')
    setStatusMessage('Sync routes...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(NET_POWER_SPECS.idle)
    setStatusMessage('CONNECTED')
    setBootPhase(null)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(NET_POWER_SPECS.idle)

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('disconnect')
    setStatusMessage('Disconnecting...')
    setIsConnected(false)
    await new Promise(r => setTimeout(r, 350))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(NET_POWER_SPECS.standby)
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
    setCurrentDraw(NET_POWER_SPECS.full)

    const phases: NonNullable<NETTestPhase>[] = ['latency', 'bandwidth', 'packet', 'security', 'complete']
    const phaseMessages: Record<NonNullable<NETTestPhase>, string> = {
      latency: 'Ping test...',
      bandwidth: 'Bandwidth test...',
      packet: 'Packet integrity...',
      security: 'Security check...',
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
    setCurrentDraw(NET_POWER_SPECS.idle)
    setStatusMessage('PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('CONNECTED')
    }, 2500)
  }, [deviceState])

  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(NET_POWER_SPECS.full)

    setStatusMessage('Disconnect...')
    setIsConnected(false)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Reset NIC...')
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('System halted')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const setBandwidth = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setBandwidthState(value)
  }, [deviceState])

  const setLatency = useCallback((value: number) => {
    if (deviceState !== 'online') return
    setLatencyState(value)
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

  const value: NETManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    bandwidth,
    latencyMs,
    isConnected,
    packetLoss,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setBandwidth,
    setLatency,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: NET_FIRMWARE,
    powerSpecs: NET_POWER_SPECS,
  }

  return (
    <NETManagerContext.Provider value={value}>
      {children}
    </NETManagerContext.Provider>
  )
}

export function useNETManager() {
  const context = useContext(NETManagerContext)
  if (!context) {
    throw new Error('useNETManager must be used within a NETManagerProvider')
  }
  return context
}

export function useNETManagerOptional() {
  return useContext(NETManagerContext)
}

'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// TLP Device States
type TLPDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type TLPTestPhase = 'capacitor' | 'matrix' | 'quantum-lock' | 'coordinates' | 'stabilize' | 'complete' | null
type TLPBootPhase = 'capacitor' | 'matrix' | 'quantum-lock' | 'coordinates' | 'stabilize' | 'ready' | null
type TLPShutdownPhase = 'portal-close' | 'discharge' | 'halted' | null
export type TLPMode = 'standard' | 'precision' | 'express' | 'stealth' | 'cargo' | 'emergency'

// Firmware metadata
export const TLP_FIRMWARE = {
  version: '2.2.0',
  build: '2025.08.10',
  checksum: 'T3L3P0RT',
  features: ['capacitor-charge', 'matrix-align', 'quantum-lock', 'coord-load', 'stabilize', 'portal-gen'],
  securityPatch: '2025.08.05',
}

// Power specs
export const TLP_POWER_SPECS = {
  full: 35,
  idle: 3,
  standby: 0.5,
  category: 'heavy' as const,
  priority: 4 as const,
}

interface TLPState {
  deviceState: TLPDeviceState
  bootPhase: TLPBootPhase
  testPhase: TLPTestPhase
  shutdownPhase: TLPShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  chargeLevel: number
  lastDestination: string
  portalStability: number
  ringPulse: number
  displayMode: TLPMode
}

interface TLPManagerContextType extends TLPState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  cycleMode: () => void
  setMode: (mode: TLPMode) => void
  setChargeLevel: (value: number) => void
  setLastDestination: (value: string) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof TLP_FIRMWARE
  powerSpecs: typeof TLP_POWER_SPECS
}

const TLPManagerContext = createContext<TLPManagerContextType | null>(null)

interface TLPManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; chargeLevel?: number; lastDestination?: string; displayMode?: TLPMode; isExpanded?: boolean }
}

export function TLPManagerProvider({ children, initialState }: TLPManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<TLPDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<TLPBootPhase>(startPowered ? 'capacitor' : null)
  const [testPhase, setTestPhase] = useState<TLPTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<TLPShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Init...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(TLP_POWER_SPECS.idle)
  const [displayMode, setDisplayMode] = useState<TLPMode>(initialState?.displayMode ?? 'standard')
  const [chargeLevel, setChargeLevelState] = useState(initialState?.chargeLevel ?? 65)
  const [lastDestination, setLastDestinationState] = useState(initialState?.lastDestination ?? 'LAB-Ω')
  const [portalStability, setPortalStability] = useState(0)
  const [ringPulse, setRingPulse] = useState(0)

  // Compute portal stability from charge level
  useEffect(() => {
    setPortalStability(Math.min(100, Math.max(0, chargeLevel)))
  }, [chargeLevel])

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(TLP_POWER_SPECS.full)

    setBootPhase('capacitor')
    setStatusMessage('Capacitor charge...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('matrix')
    setStatusMessage('Matrix align...')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('quantum-lock')
    setStatusMessage('Quantum lock...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('coordinates')
    setStatusMessage('Loading coords...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('stabilize')
    setStatusMessage('Stabilizing...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(TLP_POWER_SPECS.idle)
    setStatusMessage('READY')
    setBootPhase(null)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(TLP_POWER_SPECS.idle)

    setShutdownPhase('portal-close')
    setStatusMessage('Portal closing...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('discharge')
    setStatusMessage('Discharging...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(TLP_POWER_SPECS.standby)
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
    setCurrentDraw(TLP_POWER_SPECS.full)

    setTestPhase('capacitor')
    setStatusMessage('Testing capacitor...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('matrix')
    setStatusMessage('Testing matrix...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('quantum-lock')
    setStatusMessage('Quantum lock...')
    setChargeLevelState(100)
    await new Promise(r => setTimeout(r, 500))

    setTestPhase('coordinates')
    setStatusMessage('Coord check...')
    await new Promise(r => setTimeout(r, 350))

    setTestPhase('stabilize')
    setStatusMessage('Stabilizing...')
    await new Promise(r => setTimeout(r, 350))

    setTestPhase('complete')
    setStatusMessage('Test complete')
    await new Promise(r => setTimeout(r, 350))

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(TLP_POWER_SPECS.idle)
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
    setCurrentDraw(TLP_POWER_SPECS.full)

    setStatusMessage('Portal closing...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Discharging...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const cycleMode = useCallback(() => {
    if (deviceState !== 'online') return
    const modes: TLPMode[] = ['standard', 'precision', 'express', 'stealth', 'cargo', 'emergency']
    const currentIndex = modes.indexOf(displayMode)
    setDisplayMode(modes[(currentIndex + 1) % modes.length])
  }, [deviceState, displayMode])

  const setMode = useCallback((mode: TLPMode) => {
    if (deviceState !== 'online') return
    setDisplayMode(mode)
  }, [deviceState])

  const setChargeLevel = useCallback((value: number) => {
    setChargeLevelState(Math.max(0, Math.min(100, value)))
  }, [])

  const setLastDestination = useCallback((value: string) => {
    setLastDestinationState(value)
  }, [])

  // Ring pulse animation
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return
    const interval = setInterval(() => {
      setRingPulse(prev => (prev + 1) % 100)
    }, 50)
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

  const value: TLPManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    chargeLevel,
    lastDestination,
    portalStability,
    ringPulse,
    displayMode,
    powerOn,
    powerOff,
    runTest,
    reboot,
    cycleMode,
    setMode,
    setChargeLevel,
    setLastDestination,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: TLP_FIRMWARE,
    powerSpecs: TLP_POWER_SPECS,
  }

  return (
    <TLPManagerContext.Provider value={value}>
      {children}
    </TLPManagerContext.Provider>
  )
}

export function useTLPManager() {
  const context = useContext(TLPManagerContext)
  if (!context) {
    throw new Error('useTLPManager must be used within a TLPManagerProvider')
  }
  return context
}

export function useTLPManagerOptional() {
  return useContext(TLPManagerContext)
}

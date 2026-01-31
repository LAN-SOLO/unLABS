'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// P3D Device States
type P3DDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type P3DTestPhase = 'bed' | 'nozzle' | 'extrusion' | 'layer' | 'complete' | null
type P3DBootPhase = 'firmware' | 'bed-heat' | 'homing' | 'nozzle' | 'calibrate' | 'ready' | null
type P3DShutdownPhase = 'cooling' | 'retract' | 'halted' | null
export type P3DMode = 'plastic' | 'metal' | 'crystal' | 'composite' | 'nano' | 'prototype'

// Firmware metadata
export const P3D_FIRMWARE = {
  version: '3.2.1',
  build: '2025.06.15',
  checksum: 'F4BR1C8R',
  features: ['bed-level', 'nozzle-calibrate', 'extrusion-ctrl', 'layer-track', 'thermal-manage', 'multi-material'],
  securityPatch: '2025.06.10',
}

// Power specs
export const P3D_POWER_SPECS = {
  full: 18,
  idle: 3,
  standby: 0.5,
  category: 'heavy' as const,
  priority: 3 as const,
}

interface P3DState {
  deviceState: P3DDeviceState
  bootPhase: P3DBootPhase
  testPhase: P3DTestPhase
  shutdownPhase: P3DShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentDraw: number
  progress: number
  layerCount: number
  bedTemp: number
  headPosition: number
  displayMode: P3DMode
}

interface P3DManagerContextType extends P3DState {
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  cycleMode: () => void
  setMode: (mode: P3DMode) => void
  setProgress: (value: number) => void
  setLayerCount: (value: number) => void
  setBedTemp: (value: number) => void
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  firmware: typeof P3D_FIRMWARE
  powerSpecs: typeof P3D_POWER_SPECS
}

const P3DManagerContext = createContext<P3DManagerContextType | null>(null)

interface P3DManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered?: boolean; progress?: number; layerCount?: number; bedTemp?: number; displayMode?: P3DMode; isExpanded?: boolean }
}

export function P3DManagerProvider({ children, initialState }: P3DManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<P3DDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<P3DBootPhase>(startPowered ? 'firmware' : null)
  const [testPhase, setTestPhase] = useState<P3DTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<P3DShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'INITIALIZING' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(P3D_POWER_SPECS.idle)
  const [displayMode, setDisplayMode] = useState<P3DMode>(initialState?.displayMode ?? 'plastic')
  const [progress, setProgressState] = useState(initialState?.progress ?? 67)
  const [layerCount, setLayerCountState] = useState(initialState?.layerCount ?? 234)
  const [bedTemp, setBedTempState] = useState(initialState?.bedTemp ?? 60)
  const [headPosition, setHeadPosition] = useState(50)
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(P3D_POWER_SPECS.idle)

    setBootPhase('firmware')
    setStatusMessage('FIRMWARE v3.2.1')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('bed-heat')
    setStatusMessage('HEATING BED')
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('homing')
    setStatusMessage('HOMING AXES')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('nozzle')
    setStatusMessage('NOZZLE CHECK')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('calibrate')
    setStatusMessage('CALIBRATING')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(P3D_POWER_SPECS.idle)
    setStatusMessage('READY')
    setBootPhase(null)
  }, [])

  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(P3D_POWER_SPECS.idle)

    setShutdownPhase('cooling')
    setStatusMessage('Cooling...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('retract')
    setStatusMessage('Retracting...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('halted')
    setStatusMessage('System halted')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(P3D_POWER_SPECS.standby)
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
    await runShutdownSequence()
    setIsExpanded(false)
  }, [deviceState, runShutdownSequence])

  const runTest = useCallback(async () => {
    if (deviceState !== 'online') return

    setDeviceState('testing')
    setTestResult(null)
    setCurrentDraw(P3D_POWER_SPECS.full)

    setTestPhase('bed')
    setStatusMessage('Testing bed...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('nozzle')
    setStatusMessage('Testing nozzle...')
    await new Promise(r => setTimeout(r, 400))

    setTestPhase('extrusion')
    setStatusMessage('Extrusion...')
    await new Promise(r => setTimeout(r, 500))

    setTestPhase('layer')
    setStatusMessage('Layer check...')
    await new Promise(r => setTimeout(r, 350))

    setTestPhase('complete')
    setStatusMessage('Test complete')
    await new Promise(r => setTimeout(r, 350))

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(P3D_POWER_SPECS.idle)
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
    setCurrentDraw(P3D_POWER_SPECS.idle)

    setStatusMessage('Cooling...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Retracting...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  const cycleMode = useCallback(() => {
    if (deviceState !== 'online') return
    const modes: P3DMode[] = ['plastic', 'metal', 'crystal', 'composite', 'nano', 'prototype']
    const currentIndex = modes.indexOf(displayMode)
    setDisplayMode(modes[(currentIndex + 1) % modes.length])
  }, [deviceState, displayMode])

  const setMode = useCallback((mode: P3DMode) => {
    if (deviceState !== 'online') return
    setDisplayMode(mode)
  }, [deviceState])

  const setProgress = useCallback((value: number) => {
    setProgressState(Math.max(0, Math.min(100, value)))
  }, [])

  const setLayerCount = useCallback((value: number) => {
    setLayerCountState(value)
  }, [])

  const setBedTemp = useCallback((value: number) => {
    setBedTempState(value)
  }, [])

  // Head position sweep animation
  useEffect(() => {
    if (deviceState === 'standby' || deviceState === 'shutdown') return
    const interval = setInterval(() => {
      setHeadPosition(prev => (prev + 1) % 100)
    }, 150)
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

  const value: P3DManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentDraw,
    progress,
    layerCount,
    bedTemp,
    headPosition,
    displayMode,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    powerOn,
    powerOff,
    runTest,
    reboot,
    cycleMode,
    setMode,
    setProgress,
    setLayerCount,
    setBedTemp,
    firmware: P3D_FIRMWARE,
    powerSpecs: P3D_POWER_SPECS,
  }

  return (
    <P3DManagerContext.Provider value={value}>
      {children}
    </P3DManagerContext.Provider>
  )
}

export function useP3DManager() {
  const context = useContext(P3DManagerContext)
  if (!context) {
    throw new Error('useP3DManager must be used within a P3DManagerProvider')
  }
  return context
}

export function useP3DManagerOptional() {
  return useContext(P3DManagerContext)
}

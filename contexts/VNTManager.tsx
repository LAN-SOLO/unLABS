'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useThermalManagerOptional } from '@/contexts/ThermalManager'

// VNT Device States
type VNTDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type VNTTestPhase = 'motor' | 'airflow' | 'filter' | 'damper' | 'calibrate' | 'complete' | null
type VNTBootPhase = 'power' | 'motor' | 'filter' | 'damper' | 'calibrate' | 'ready' | null
type VNTShutdownPhase = 'slowdown' | 'damper' | 'offline' | null

// Firmware metadata
export const VNT_FIRMWARE = {
  version: '1.0.0',
  build: '2026.01.28',
  checksum: 'V4F1N7E2',
  features: ['air-exchange', 'hepa-filter', 'humidity-ctrl', 'damper-ctrl', 'dual-fan'],
  securityPatch: '2026.01.20',
}

// Power specs
export const VNT_POWER_SPECS = {
  full: 4,
  idle: 2,
  standby: 0.5,
  emergency: 12,
  category: 'light' as const,
  priority: 1 as const,
}

interface VNTFanState {
  speed: number
  rpm: number
  mode: 'AUTO' | 'LOW' | 'MED' | 'HIGH' | 'MANUAL'
  isOn: boolean
}

interface VNTState {
  deviceState: VNTDeviceState
  bootPhase: VNTBootPhase
  testPhase: VNTTestPhase
  shutdownPhase: VNTShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  cpuFan: VNTFanState
  gpuFan: VNTFanState
  cpuTemp: number
  gpuTemp: number
  currentDraw: number
  filterHealth: number
  airQuality: number
  humidity: number
}

interface VNTManagerContextType extends VNTState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setFanSpeed: (fanId: 'cpu' | 'gpu', speed: number) => void
  setFanMode: (fanId: 'cpu' | 'gpu', mode: 'AUTO' | 'LOW' | 'MED' | 'HIGH') => void
  toggleFan: (fanId: 'cpu' | 'gpu', on: boolean) => void
  emergencyPurge: () => Promise<void>
  // Read-only info
  firmware: typeof VNT_FIRMWARE
  powerSpecs: typeof VNT_POWER_SPECS
}

const VNTManagerContext = createContext<VNTManagerContextType | null>(null)

interface VNTManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; cpuFanSpeed?: number; gpuFanSpeed?: number; fanMode?: string }
}

export function VNTManagerProvider({ children, initialState }: VNTManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const thermalManager = useThermalManagerOptional()

  const [deviceState, setDeviceState] = useState<VNTDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<VNTBootPhase>(startPowered ? 'power' : null)
  const [testPhase, setTestPhase] = useState<VNTTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<VNTShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentDraw, setCurrentDraw] = useState(VNT_POWER_SPECS.idle)

  // Local fan state (used when thermal manager not available or as defaults)
  const savedMode = (initialState?.fanMode as VNTFanState['mode']) || 'AUTO'
  const savedCpuSpeed = initialState?.cpuFanSpeed ?? 65
  const savedGpuSpeed = initialState?.gpuFanSpeed ?? 65
  const [localCpuFan, setLocalCpuFan] = useState<VNTFanState>({ speed: savedCpuSpeed, rpm: Math.round((savedCpuSpeed / 100) * 4000 + 800), mode: savedMode, isOn: true })
  const [localGpuFan, setLocalGpuFan] = useState<VNTFanState>({ speed: savedGpuSpeed, rpm: Math.round((savedGpuSpeed / 100) * 4000 + 800), mode: savedMode, isOn: true })
  const [localCpuTemp, setLocalCpuTemp] = useState(34)
  const [localGpuTemp, setLocalGpuTemp] = useState(38)
  const [filterHealth, setFilterHealth] = useState(98)
  const [airQuality, setAirQuality] = useState(95)
  const [humidity, setHumidity] = useState(42)

  // Derive fan state from thermal manager if available
  const cpuFanState = thermalManager?.state.fans.cpu
  const gpuFanState = thermalManager?.state.fans.gpu
  const cpuZoneTemp = thermalManager?.state.zones.cpu?.temperature
  const gpuZoneTemp = thermalManager?.state.zones.gpu?.temperature

  const cpuFan: VNTFanState = cpuFanState
    ? { speed: cpuFanState.speed, rpm: cpuFanState.rpm, mode: cpuFanState.mode, isOn: cpuFanState.isOn }
    : localCpuFan
  const gpuFan: VNTFanState = gpuFanState
    ? { speed: gpuFanState.speed, rpm: gpuFanState.rpm, mode: gpuFanState.mode, isOn: gpuFanState.isOn }
    : localGpuFan
  const cpuTemp = cpuZoneTemp ?? localCpuTemp
  const gpuTemp = gpuZoneTemp ?? localGpuTemp

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(VNT_POWER_SPECS.full)

    setBootPhase('power')
    setStatusMessage('Power check...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('motor')
    setStatusMessage('Motor init...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('filter')
    setStatusMessage('HEPA filter check...')
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('damper')
    setStatusMessage('Damper control...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating sensors...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('ready')
    setDeviceState('online')
    setCurrentDraw(VNT_POWER_SPECS.idle)
    setStatusMessage('Fans operational')
    setBootPhase(null)

    // Enable ThermalManager fans when VNT comes online
    if (thermalManager) {
      thermalManager.toggleFan('cpu', true)
      thermalManager.toggleFan('gpu', true)
    }
  }, [thermalManager])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(VNT_POWER_SPECS.idle)

    setShutdownPhase('slowdown')
    setStatusMessage('Decelerating fans...')
    await new Promise(r => setTimeout(r, 400))

    setShutdownPhase('damper')
    setStatusMessage('Closing dampers...')
    await new Promise(r => setTimeout(r, 300))

    setShutdownPhase('offline')
    setStatusMessage('System offline')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(VNT_POWER_SPECS.standby)
    setStatusMessage('Standby mode')

    // Disable ThermalManager fans when VNT goes to standby
    if (thermalManager) {
      thermalManager.toggleFan('cpu', false)
      thermalManager.toggleFan('gpu', false)
    }
  }, [thermalManager])

  // Power ON
  const powerOn = useCallback(async () => {
    if (deviceState !== 'standby') return
    setIsPowered(true)
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Power OFF
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
    setCurrentDraw(VNT_POWER_SPECS.full)

    const phases: NonNullable<VNTTestPhase>[] = ['motor', 'airflow', 'filter', 'damper', 'calibrate', 'complete']
    const phaseMessages: Record<NonNullable<VNTTestPhase>, string> = {
      motor: 'Testing motor bearings...',
      airflow: 'Measuring airflow rate...',
      filter: 'Checking HEPA filter...',
      damper: 'Testing damper control...',
      calibrate: 'Calibrating sensors...',
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
    setCurrentDraw(VNT_POWER_SPECS.idle)
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage('Fans operational')
    }, 3000)
  }, [deviceState])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)
    setCurrentDraw(VNT_POWER_SPECS.full)

    setStatusMessage('Fan slowdown...')
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Closing dampers...')
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('System offline')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 400))

    // Boot sequence
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Fan controls - delegate to thermal manager if available
  const setFanSpeed = useCallback((fanId: 'cpu' | 'gpu', speed: number) => {
    if (thermalManager) {
      thermalManager.setFanSpeed(fanId, speed)
    } else {
      const setter = fanId === 'cpu' ? setLocalCpuFan : setLocalGpuFan
      setter(prev => ({ ...prev, speed, mode: 'MED' as const }))
    }
  }, [thermalManager])

  const setFanMode = useCallback((fanId: 'cpu' | 'gpu', mode: 'AUTO' | 'LOW' | 'MED' | 'HIGH') => {
    if (thermalManager) {
      thermalManager.setFanMode(fanId, mode)
    } else {
      const setter = fanId === 'cpu' ? setLocalCpuFan : setLocalGpuFan
      const speed = mode === 'LOW' ? 25 : mode === 'MED' ? 50 : mode === 'HIGH' ? 100 : 65
      setter(prev => ({ ...prev, mode, speed }))
    }
  }, [thermalManager])

  const toggleFan = useCallback((fanId: 'cpu' | 'gpu', on: boolean) => {
    if (thermalManager) {
      thermalManager.toggleFan(fanId, on)
    } else {
      const setter = fanId === 'cpu' ? setLocalCpuFan : setLocalGpuFan
      setter(prev => ({ ...prev, isOn: on }))
    }
  }, [thermalManager])

  // Emergency purge - max fans for 5 seconds
  const emergencyPurge = useCallback(async () => {
    if (deviceState !== 'online') return
    setCurrentDraw(VNT_POWER_SPECS.emergency)
    setStatusMessage('EMERGENCY PURGE - MAX AIRFLOW')
    if (thermalManager) {
      thermalManager.setFanSpeed('cpu', 100)
      thermalManager.setFanSpeed('gpu', 100)
    } else {
      setLocalCpuFan(prev => ({ ...prev, speed: 100, mode: 'HIGH' }))
      setLocalGpuFan(prev => ({ ...prev, speed: 100, mode: 'HIGH' }))
    }
    await new Promise(r => setTimeout(r, 5000))
    setCurrentDraw(VNT_POWER_SPECS.idle)
    setStatusMessage('Purge complete - returning to normal')
    setTimeout(() => setStatusMessage('Fans operational'), 2000)
  }, [deviceState, thermalManager])

  // Local temperature simulation when no thermal manager
  useEffect(() => {
    if (thermalManager) return
    if (!isPowered || deviceState !== 'online') return

    const interval = setInterval(() => {
      setLocalCpuTemp(prev => {
        const delta = (Math.random() - 0.5) * 2
        return Math.round((prev + delta) * 10) / 10
      })
      setLocalGpuTemp(prev => {
        const delta = (Math.random() - 0.5) * 2
        return Math.round((prev + delta) * 10) / 10
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [thermalManager, isPowered, deviceState])

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

  const value: VNTManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    cpuFan,
    gpuFan,
    cpuTemp,
    gpuTemp,
    currentDraw,
    filterHealth,
    airQuality,
    humidity,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setFanSpeed,
    setFanMode,
    toggleFan,
    emergencyPurge,
    firmware: VNT_FIRMWARE,
    powerSpecs: VNT_POWER_SPECS,
  }

  return (
    <VNTManagerContext.Provider value={value}>
      {children}
    </VNTManagerContext.Provider>
  )
}

export function useVNTManager() {
  const context = useContext(VNTManagerContext)
  if (!context) {
    throw new Error('useVNTManager must be used within a VNTManagerProvider')
  }
  return context
}

export function useVNTManagerOptional() {
  return useContext(VNTManagerContext)
}

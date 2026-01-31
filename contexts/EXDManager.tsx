'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// EXD Device States
type EXDDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown'
type EXDTestPhase = 'motors' | 'gps' | 'camera' | 'radio' | 'battery' | 'gyro' | 'complete' | null
type EXDBootPhase = 'power' | 'imu' | 'gps' | 'motors' | 'radio' | 'flight' | 'ready' | null
type EXDShutdownPhase = 'rth' | 'landing' | 'offline' | null

// Firmware metadata - Explorer Drone
export const EXD_FIRMWARE = {
  version: '3.1.2',
  build: '2026.01.28',
  checksum: 'D3X1F7A9',
  features: ['autonomous-nav', 'resource-scan', 'cargo-haul', 'gps-lock', 'imu-stabilize'],
  securityPatch: '2026.01.20',
}

// Power specs - Explorer Drone is a heavy consumer
export const EXD_POWER_SPECS = {
  full: 40,            // E/s active flight
  idle: 15,            // E/s hover/stationary
  standby: 1,          // E/s docked
  highSpeed: 65,       // E/s rapid deployment
  category: 'heavy' as const,
  priority: 3 as const,
}

interface EXDState {
  deviceState: EXDDeviceState
  bootPhase: EXDBootPhase
  testPhase: EXDTestPhase
  shutdownPhase: EXDShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  // EXD-specific state
  range: number              // km
  battery: number            // 0-100%
  altitude: number           // meters
  speed: number              // km/h
  gpsSignal: number          // 0-100%
  cargoLoad: number          // 0-50 Abstractum units
  flightTime: number         // seconds remaining
  radarActive: boolean
  isDeployed: boolean
  currentDraw: number        // E/s
}

interface EXDManagerContextType extends EXDState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  deploy: () => void
  recall: () => void
  // Fold state
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  // Read-only info
  firmware: typeof EXD_FIRMWARE
  powerSpecs: typeof EXD_POWER_SPECS
}

const EXDManagerContext = createContext<EXDManagerContextType | null>(null)

interface EXDManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; isDeployed?: boolean; isExpanded?: boolean }
}

export function EXDManagerProvider({ children, initialState }: EXDManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const startDeployed = initialState?.isDeployed ?? true
  const startExpanded = initialState?.isExpanded ?? startPowered
  const [isExpanded, setIsExpanded] = useState(startExpanded)
  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev) }, [])
  const [deviceState, setDeviceState] = useState<EXDDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<EXDBootPhase>(startPowered ? 'power' : null)
  const [testPhase, setTestPhase] = useState<EXDTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<EXDShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [range, setRange] = useState(0)
  const [battery, setBattery] = useState(startPowered ? 78 : 0)
  const [altitude, setAltitude] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [gpsSignal, setGpsSignal] = useState(0)
  const [cargoLoad, setCargoLoad] = useState(0)
  const [flightTime, setFlightTime] = useState(0)
  const [radarActive, setRadarActive] = useState(false)
  const [isDeployed, setIsDeployed] = useState(startDeployed)
  const [currentDraw, setCurrentDraw] = useState(startPowered ? EXD_POWER_SPECS.full : EXD_POWER_SPECS.standby)

  // Simulate drone activity when online and deployed
  useEffect(() => {
    if (deviceState === 'online' && isPowered && isDeployed) {
      const interval = setInterval(() => {
        setRange(prev => Math.max(0.5, Math.min(5.0, prev + (Math.random() - 0.48) * 0.3)))
        setBattery(prev => Math.max(15, Math.min(100, prev + (Math.random() - 0.52) * 2)))
        setAltitude(prev => Math.max(10, Math.min(150, prev + (Math.random() - 0.5) * 10)))
        setSpeed(prev => Math.max(5, Math.min(80, prev + (Math.random() - 0.5) * 8)))
        setGpsSignal(prev => Math.max(70, Math.min(100, prev + (Math.random() - 0.5) * 5)))
        setCargoLoad(prev => Math.max(0, Math.min(50, prev + (Math.random() > 0.7 ? 1 : 0))))
        setFlightTime(prev => Math.max(0, prev - 2))
        setCurrentDraw(EXD_POWER_SPECS.idle + ((EXD_POWER_SPECS.full - EXD_POWER_SPECS.idle) * (speed / 80)))
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [deviceState, isPowered, isDeployed, speed])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')
    setCurrentDraw(EXD_POWER_SPECS.idle)

    setBootPhase('power')
    setStatusMessage('Power on...')
    setBattery(20)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('imu')
    setStatusMessage('IMU calibration...')
    setBattery(35)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('gps')
    setStatusMessage('GPS lock...')
    setGpsSignal(40)
    setRange(0.5)
    await new Promise(r => setTimeout(r, 400))

    setBootPhase('motors')
    setStatusMessage('Motor test...')
    setGpsSignal(70)
    setRange(1.2)
    setRadarActive(true)
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('radio')
    setStatusMessage('Radio link...')
    setGpsSignal(90)
    setRange(1.8)
    await new Promise(r => setTimeout(r, 350))

    setBootPhase('flight')
    setStatusMessage('Flight ready...')
    await new Promise(r => setTimeout(r, 300))

    // Final boot
    setBootPhase('ready')
    setRange(2.4)
    setBattery(78)
    setAltitude(45)
    setSpeed(25)
    setGpsSignal(95)
    setFlightTime(7200)
    setRadarActive(true)
    setDeviceState('online')
    setCurrentDraw(EXD_POWER_SPECS.full)
    setStatusMessage(isDeployed ? 'DEPLOYED' : 'DOCKED')
    setBootPhase(null)
  }, [isDeployed])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')
    setCurrentDraw(EXD_POWER_SPECS.idle)

    setShutdownPhase('rth')
    setStatusMessage('RTH initiated...')
    setSpeed(10)
    setAltitude(20)
    await new Promise(r => setTimeout(r, 350))

    setShutdownPhase('landing')
    setStatusMessage('Landing...')
    setRadarActive(false)
    setSpeed(0)
    setAltitude(0)
    setRange(0)
    await new Promise(r => setTimeout(r, 400))

    setShutdownPhase('offline')
    setStatusMessage('Motors off')
    setBattery(0)
    setGpsSignal(0)
    setFlightTime(0)
    setCargoLoad(0)
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase(null)
    setDeviceState('standby')
    setCurrentDraw(EXD_POWER_SPECS.standby)
    setStatusMessage('Standby')
    setIsDeployed(false)
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
    setCurrentDraw(EXD_POWER_SPECS.full)

    const phases: NonNullable<EXDTestPhase>[] = ['motors', 'gps', 'camera', 'radio', 'battery', 'gyro', 'complete']
    const phaseMessages: Record<NonNullable<EXDTestPhase>, string> = {
      motors: 'Testing rotors...',
      gps: 'Checking GPS fix...',
      camera: 'Camera calibration...',
      radio: 'Radio link test...',
      battery: 'Battery health...',
      gyro: 'Gyroscope check...',
      complete: 'Preflight complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 380))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setCurrentDraw(EXD_POWER_SPECS.full)
    setStatusMessage('All tests PASSED')

    setTimeout(() => {
      setTestResult(null)
      setStatusMessage(isDeployed ? 'DEPLOYED' : 'DOCKED')
    }, 3000)
  }, [deviceState, isDeployed])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('RTH initiated...')
    setSpeed(10)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('Landing...')
    setRadarActive(false)
    setSpeed(0)
    setAltitude(0)
    await new Promise(r => setTimeout(r, 350))

    setStatusMessage('Motors off...')
    setRange(0)
    setBattery(0)
    setGpsSignal(0)
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    setStatusMessage('System offline')
    await new Promise(r => setTimeout(r, 400))

    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Deploy/Recall
  const deploy = useCallback(() => {
    if (deviceState !== 'online') return
    setIsDeployed(true)
    setStatusMessage('DEPLOYED')
    setCurrentDraw(EXD_POWER_SPECS.full)
  }, [deviceState])

  const recall = useCallback(() => {
    if (deviceState !== 'online') return
    setIsDeployed(false)
    setStatusMessage('DOCKED')
    setCurrentDraw(EXD_POWER_SPECS.idle)
    setSpeed(0)
    setAltitude(0)
  }, [deviceState])

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

  const value: EXDManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    range,
    battery,
    altitude,
    speed,
    gpsSignal,
    cargoLoad,
    flightTime,
    radarActive,
    isDeployed,
    currentDraw,
    powerOn,
    powerOff,
    runTest,
    reboot,
    deploy,
    recall,
    isExpanded,
    toggleExpanded,
    setExpanded: setIsExpanded,
    firmware: EXD_FIRMWARE,
    powerSpecs: EXD_POWER_SPECS,
  }

  return (
    <EXDManagerContext.Provider value={value}>
      {children}
    </EXDManagerContext.Provider>
  )
}

export function useEXDManager() {
  const context = useContext(EXDManagerContext)
  if (!context) {
    throw new Error('useEXDManager must be used within an EXDManagerProvider')
  }
  return context
}

export function useEXDManagerOptional() {
  return useContext(EXDManagerContext)
}

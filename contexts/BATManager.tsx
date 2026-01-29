'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

// BAT Device States
type BATDeviceState = 'booting' | 'online' | 'testing' | 'rebooting' | 'standby' | 'shutdown' | 'charging' | 'discharging'
type BATTestPhase = 'cells' | 'voltage' | 'capacity' | 'discharge' | 'thermal' | 'complete' | null
type BATBootPhase = 'init' | 'cells' | 'calibrate' | 'handshake' | 'ready' | null
type BATShutdownPhase = 'saving' | 'disconnect' | 'hibernate' | null

// Firmware metadata - Portable Battery Pack
export const BAT_FIRMWARE = {
  version: '1.8.0',
  build: '2024.01.20',
  checksum: 'B4C7D9E2',
  features: ['cell-monitor', 'auto-regen', 'capacity-track', 'thermal-protect', 'cdc-handshake'],
  securityPatch: '2024.01.15',
}

// Power specs - Battery is storage, can charge and discharge
export const BAT_POWER_SPECS = {
  capacity: 5000,        // Max storage in E
  chargeRate: 100,       // E/s charge rate
  dischargeRate: 150,    // E/s discharge rate (burst)
  selfDischarge: 0.5,    // E/s passive drain when idle
  standbyDrain: 0.1,     // E/s minimal circuitry draw
  category: 'storage' as const,
  priority: 2 as const,  // P2 - Secondary to generator
}

interface BATState {
  deviceState: BATDeviceState
  bootPhase: BATBootPhase
  testPhase: BATTestPhase
  shutdownPhase: BATShutdownPhase
  testResult: 'pass' | 'fail' | null
  statusMessage: string
  isPowered: boolean
  currentCharge: number      // Current E stored (0-5000)
  chargePercent: number      // 0-100%
  isCharging: boolean
  isDischarging: boolean
  cellHealth: number[]       // 4 cells, 0-100% each
  temperature: number        // Celsius
  autoRegen: boolean
}

interface BATManagerContextType extends BATState {
  // Actions
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  runTest: () => Promise<void>
  reboot: () => Promise<void>
  setAutoRegen: (enabled: boolean) => void
  updateCharge: (amount: number) => void
  // Read-only info
  firmware: typeof BAT_FIRMWARE
  powerSpecs: typeof BAT_POWER_SPECS
}

const BATManagerContext = createContext<BATManagerContextType | null>(null)

interface BATManagerProviderProps {
  children: ReactNode
  initialState?: { isPowered: boolean; currentCharge: number; autoRegen: boolean }
}

export function BATManagerProvider({ children, initialState }: BATManagerProviderProps) {
  const startPowered = initialState?.isPowered ?? true
  const [deviceState, setDeviceState] = useState<BATDeviceState>(startPowered ? 'booting' : 'standby')
  const [bootPhase, setBootPhase] = useState<BATBootPhase>(startPowered ? 'init' : null)
  const [testPhase, setTestPhase] = useState<BATTestPhase>(null)
  const [shutdownPhase, setShutdownPhase] = useState<BATShutdownPhase>(null)
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null)
  const [statusMessage, setStatusMessage] = useState(startPowered ? 'Initializing...' : 'Standby mode')
  const [isPowered, setIsPowered] = useState(startPowered)
  const [currentCharge, setCurrentCharge] = useState(initialState?.currentCharge ?? 5000)
  const [chargePercent, setChargePercent] = useState(100)
  const [isCharging, setIsCharging] = useState(false)
  const [isDischarging, setIsDischarging] = useState(false)
  const [cellHealth, setCellHealth] = useState([98, 99, 97, 100]) // 4 cells
  const [temperature, setTemperature] = useState(28)
  const [autoRegen, setAutoRegenState] = useState(initialState?.autoRegen ?? true)

  // Update charge percent when charge changes
  useEffect(() => {
    setChargePercent(Math.round((currentCharge / BAT_POWER_SPECS.capacity) * 100))
  }, [currentCharge])

  // Boot sequence
  const runBootSequence = useCallback(async () => {
    setDeviceState('booting')

    setBootPhase('init')
    setStatusMessage('Initializing cells...')
    await new Promise(r => setTimeout(r, 200))

    setBootPhase('cells')
    setStatusMessage('Cell check...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('calibrate')
    setStatusMessage('Calibrating capacity...')
    await new Promise(r => setTimeout(r, 300))

    setBootPhase('handshake')
    setStatusMessage('CDC handshake...')
    await new Promise(r => setTimeout(r, 250))

    setBootPhase('ready')
    setDeviceState('online')
    setStatusMessage('Auto-regen: active')
    setBootPhase(null)
  }, [])

  // Shutdown sequence
  const runShutdownSequence = useCallback(async () => {
    setDeviceState('shutdown')

    setShutdownPhase('saving')
    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setShutdownPhase('disconnect')
    setStatusMessage('Disconnecting...')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase('hibernate')
    setStatusMessage('Hibernating...')
    await new Promise(r => setTimeout(r, 200))

    setShutdownPhase(null)
    setDeviceState('standby')
    setStatusMessage('Standby mode')
  }, [])

  // Power ON
  const powerOn = useCallback(async () => {
    if (deviceState !== 'standby') return
    setIsPowered(true)
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Power OFF
  const powerOff = useCallback(async () => {
    if (deviceState !== 'online' && deviceState !== 'charging' && deviceState !== 'discharging') return
    setIsPowered(false)
    await runShutdownSequence()
  }, [deviceState, runShutdownSequence])

  // Run test
  const runTest = useCallback(async () => {
    if (deviceState !== 'online' && deviceState !== 'charging' && deviceState !== 'discharging') return

    setDeviceState('testing')
    setTestResult(null)

    const phases: NonNullable<BATTestPhase>[] = ['cells', 'voltage', 'capacity', 'discharge', 'thermal', 'complete']
    const phaseMessages: Record<NonNullable<BATTestPhase>, string> = {
      cells: 'Testing cell array...',
      voltage: 'Checking voltage levels...',
      capacity: 'Verifying capacity...',
      discharge: 'Testing discharge rate...',
      thermal: 'Thermal sensor check...',
      complete: 'Diagnostics complete',
    }

    for (const phase of phases) {
      setTestPhase(phase)
      setStatusMessage(phaseMessages[phase])
      await new Promise(r => setTimeout(r, 300))
    }

    setTestResult('pass')
    setTestPhase(null)
    setDeviceState('online')
    setStatusMessage('All tests PASSED')

    // Clear result after 3 seconds
    setTimeout(() => {
      setTestResult(null)
      setStatusMessage(autoRegen ? 'Auto-regen: active' : 'Ready')
    }, 3000)
  }, [deviceState, autoRegen])

  // Reboot
  const reboot = useCallback(async () => {
    if (deviceState === 'booting' || deviceState === 'rebooting' || deviceState === 'standby' || deviceState === 'shutdown') return

    setDeviceState('rebooting')
    setTestResult(null)

    setStatusMessage('Shutting down...')
    await new Promise(r => setTimeout(r, 200))

    setStatusMessage('Saving state...')
    await new Promise(r => setTimeout(r, 250))

    setStatusMessage('Restarting...')
    setBootPhase(null)
    await new Promise(r => setTimeout(r, 300))

    // Boot sequence
    await runBootSequence()
  }, [deviceState, runBootSequence])

  // Set auto-regen
  const setAutoRegen = useCallback((enabled: boolean) => {
    setAutoRegenState(enabled)
    if (deviceState === 'online') {
      setStatusMessage(enabled ? 'Auto-regen: active' : 'Auto-regen: disabled')
    }
  }, [deviceState])

  // Update charge
  const updateCharge = useCallback((amount: number) => {
    setCurrentCharge(prev => Math.max(0, Math.min(BAT_POWER_SPECS.capacity, prev + amount)))
  }, [])

  // Auto-boot on mount (skip if starting in standby)
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

  const value: BATManagerContextType = {
    deviceState,
    bootPhase,
    testPhase,
    shutdownPhase,
    testResult,
    statusMessage,
    isPowered,
    currentCharge,
    chargePercent,
    isCharging,
    isDischarging,
    cellHealth,
    temperature,
    autoRegen,
    powerOn,
    powerOff,
    runTest,
    reboot,
    setAutoRegen,
    updateCharge,
    firmware: BAT_FIRMWARE,
    powerSpecs: BAT_POWER_SPECS,
  }

  return (
    <BATManagerContext.Provider value={value}>
      {children}
    </BATManagerContext.Provider>
  )
}

export function useBATManager() {
  const context = useContext(BATManagerContext)
  if (!context) {
    throw new Error('useBATManager must be used within a BATManagerProvider')
  }
  return context
}

export function useBATManagerOptional() {
  return useContext(BATManagerContext)
}

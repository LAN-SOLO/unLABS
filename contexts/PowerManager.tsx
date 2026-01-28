'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// Power units are E/s (Energy per second) as per GD_SPEC_device-power_v1_0.md

// Power states
type PowerState = 'full' | 'idle' | 'standby' | 'offline'

// Power source definition
interface PowerSource {
  id: string
  name: string
  tier: number
  output: { full: number; idle: number; standby: number }
  currentState: PowerState
  efficiency: number
  startupCost: number
}

// Power storage definition
interface PowerStorage {
  id: string
  name: string
  capacity: number
  stored: number
  chargeRate: number
  dischargeRate: number
  selfDischarge: number
  status: 'charging' | 'discharging' | 'full' | 'empty' | 'idle'
}

// Power consumer definition
interface PowerConsumer {
  id: string
  name: string
  category: 'heavy' | 'medium' | 'light'
  draw: { full: number; idle: number; standby: number }
  currentState: PowerState
  priority: 1 | 2 | 3 | 4  // 1=Critical, 2=Standard, 3=Non-essential, 4=High-power
}

// Overall power state
interface PowerSystemState {
  // Calculated values (E/s)
  totalGeneration: number
  totalMaxGeneration: number
  totalConsumption: number
  powerBalance: number
  loadPercent: number
  // Storage (E)
  storageE: number
  storageCapacity: number
  storagePercent: number
  // Status
  status: 'optimal' | 'caution' | 'critical' | 'emergency'
  // Voltage (calculated from balance)
  voltage: number
  // Raw data
  sources: PowerSource[]
  storage: PowerStorage[]
  consumers: PowerConsumer[]
  activeDeviceCount: number
  totalDeviceCount: number
}

interface PowerManagerContextType extends PowerSystemState {
  setDevicePower: (deviceId: string, state: PowerState) => void
  emergencyShutdown: () => void
  refreshPowerData: () => void
}

const PowerManagerContext = createContext<PowerManagerContextType | null>(null)

// Power sources from GD_SPEC_device-power_v1_0.md
const defaultSources: PowerSource[] = [
  {
    id: 'UEC-001',
    name: 'Unstable Energy Core',
    tier: 1,
    output: { full: 50, idle: 35, standby: 5 },
    currentState: 'full',
    efficiency: 75,
    startupCost: 100,
  },
  {
    id: 'MFR-001',
    name: 'Microfusion Reactor',
    tier: 2,
    output: { full: 250, idle: 150, standby: 25 },
    currentState: 'full',
    efficiency: 92,
    startupCost: 500,
  },
]

// Power storage from GD_SPEC_device-power_v1_0.md
const defaultStorage: PowerStorage[] = [
  {
    id: 'BAT-001',
    name: 'Battery Pack',
    capacity: 5000,
    stored: 4250,  // 85%
    chargeRate: 100,
    dischargeRate: 150,
    selfDischarge: 0.5,
    status: 'charging',
  },
]

// Power consumers from GD_SPEC_device-power_v1_0.md (Complete Device Power Summary)
const defaultConsumers: PowerConsumer[] = [
  // Heavy Consumers
  { id: 'SCA-001', name: 'Supercomputer Array', category: 'heavy', draw: { full: 150, idle: 45, standby: 8 }, currentState: 'idle', priority: 3 },
  { id: 'TLP-001', name: 'Teleport Pad', category: 'heavy', draw: { full: 100, idle: 15, standby: 3 }, currentState: 'standby', priority: 4 },
  { id: 'QAN-001', name: 'Quantum Analyzer', category: 'heavy', draw: { full: 80, idle: 20, standby: 5 }, currentState: 'idle', priority: 2 },
  { id: 'EMC-001', name: 'Exotic Matter Contain.', category: 'heavy', draw: { full: 75, idle: 40, standby: 40 }, currentState: 'idle', priority: 1 },
  { id: 'P3D-001', name: '3D Fabricator', category: 'heavy', draw: { full: 60, idle: 8, standby: 2 }, currentState: 'standby', priority: 3 },
  { id: 'LCT-001', name: 'Precision Laser', category: 'heavy', draw: { full: 55, idle: 10, standby: 2 }, currentState: 'standby', priority: 3 },
  { id: 'EXD-001', name: 'Explorer Drone', category: 'heavy', draw: { full: 40, idle: 15, standby: 1 }, currentState: 'standby', priority: 3 },
  { id: 'AIC-001', name: 'AI Assistant Core', category: 'heavy', draw: { full: 35, idle: 12, standby: 3 }, currentState: 'idle', priority: 1 },

  // Medium Consumers
  { id: 'QSM-001', name: 'Quantum State Monitor', category: 'medium', draw: { full: 22, idle: 7, standby: 1.5 }, currentState: 'idle', priority: 2 },
  { id: 'INT-001', name: 'Interpolator', category: 'medium', draw: { full: 20, idle: 6, standby: 1 }, currentState: 'idle', priority: 2 },
  { id: 'OSC-001', name: 'Oscilloscope Array', category: 'medium', draw: { full: 18, idle: 5, standby: 1 }, currentState: 'idle', priority: 2 },
  { id: 'CDC-001', name: 'Crystal Data Cache', category: 'medium', draw: { full: 15, idle: 5, standby: 1 }, currentState: 'idle', priority: 1 },
  { id: 'AND-001', name: 'Anomaly Detector', category: 'medium', draw: { full: 15, idle: 4, standby: 0.8 }, currentState: 'idle', priority: 2 },
  { id: 'RMG-001', name: 'Resource Magnet', category: 'medium', draw: { full: 10, idle: 3, standby: 0.5 }, currentState: 'idle', priority: 3 },
  { id: 'HMS-001', name: 'Handmade Synthesizer', category: 'medium', draw: { full: 8, idle: 3, standby: 0.5 }, currentState: 'idle', priority: 2 },
  { id: 'ECR-001', name: 'Echo Recorder', category: 'medium', draw: { full: 6, idle: 2, standby: 0.3 }, currentState: 'idle', priority: 2 },

  // Light Consumers
  { id: 'VNT-001', name: 'Ventilation System', category: 'light', draw: { full: 4, idle: 2, standby: 0.5 }, currentState: 'idle', priority: 1 },
  { id: 'THM-001', name: 'Thermal Manager', category: 'light', draw: { full: 4, idle: 1.5, standby: 0.3 }, currentState: 'idle', priority: 1 },
  { id: 'DIM-001', name: 'Dimension Monitor', category: 'light', draw: { full: 4, idle: 1.5, standby: 0.4 }, currentState: 'idle', priority: 2 },
  { id: 'MSC-001', name: 'Material Scanner', category: 'light', draw: { full: 3.5, idle: 1, standby: 0.2 }, currentState: 'idle', priority: 2 },
  { id: 'NET-001', name: 'Network Monitor', category: 'light', draw: { full: 3.5, idle: 1.5, standby: 0.3 }, currentState: 'idle', priority: 2 },
  { id: 'DGN-001', name: 'Diagnostics Console', category: 'light', draw: { full: 3, idle: 1, standby: 0.25 }, currentState: 'idle', priority: 1 },
  { id: 'SPK-001', name: 'Narrow Speaker', category: 'light', draw: { full: 3, idle: 0.5, standby: 0.1 }, currentState: 'idle', priority: 3 },
  { id: 'QCP-001', name: 'Quantum Compass', category: 'light', draw: { full: 2.5, idle: 0.8, standby: 0.2 }, currentState: 'idle', priority: 3 },
  { id: 'PWR-001', name: 'Power Management Sys.', category: 'light', draw: { full: 2.5, idle: 1, standby: 0.2 }, currentState: 'full', priority: 1 },
  { id: 'BTK-001', name: 'Basic Toolkit', category: 'light', draw: { full: 2, idle: 0.3, standby: 0.05 }, currentState: 'idle', priority: 2 },
  { id: 'CPU-001', name: 'CPU Monitor', category: 'light', draw: { full: 2, idle: 0.8, standby: 0.2 }, currentState: 'idle', priority: 1 },
  { id: 'MEM-001', name: 'Memory Monitor', category: 'light', draw: { full: 1.8, idle: 0.6, standby: 0.15 }, currentState: 'idle', priority: 1 },
  { id: 'TMP-001', name: 'Temperature Monitor', category: 'light', draw: { full: 1.5, idle: 0.8, standby: 0.2 }, currentState: 'idle', priority: 1 },
  { id: 'ATK-001', name: 'Abstractum Tank', category: 'light', draw: { full: 1.5, idle: 0.3, standby: 0.05 }, currentState: 'idle', priority: 1 },
  { id: 'PWD-001', name: 'Power Display Panel', category: 'light', draw: { full: 1, idle: 0.4, standby: 0.1 }, currentState: 'full', priority: 1 },
  { id: 'CLK-001', name: 'Lab Clock', category: 'light', draw: { full: 1, idle: 0.5, standby: 0.1 }, currentState: 'idle', priority: 1 },
  { id: 'VLT-001', name: 'Volt Meter Display', category: 'light', draw: { full: 0.8, idle: 0.3, standby: 0.1 }, currentState: 'full', priority: 1 },
]

export function PowerManagerProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<PowerSource[]>(defaultSources)
  const [storage, setStorage] = useState<PowerStorage[]>(defaultStorage)
  const [consumers, setConsumers] = useState<PowerConsumer[]>(defaultConsumers)

  // Calculate generation based on current state
  const totalGeneration = sources.reduce((sum, s) => {
    if (s.currentState === 'offline') return sum
    return sum + s.output[s.currentState]
  }, 0)

  const totalMaxGeneration = sources.reduce((sum, s) => sum + s.output.full, 0)

  // Calculate consumption based on current state
  const totalConsumption = consumers.reduce((sum, c) => {
    if (c.currentState === 'offline') return sum
    return sum + c.draw[c.currentState]
  }, 0)

  const powerBalance = totalGeneration - totalConsumption
  const loadPercent = totalGeneration > 0 ? Math.round((totalConsumption / totalGeneration) * 100) : 0

  // Storage calculations
  const storageE = storage.reduce((sum, s) => sum + s.stored, 0)
  const storageCapacity = storage.reduce((sum, s) => sum + s.capacity, 0)
  const storagePercent = storageCapacity > 0 ? Math.round((storageE / storageCapacity) * 100) : 0

  // Count devices
  const activeDeviceCount = consumers.filter(c => c.currentState !== 'offline' && c.currentState !== 'standby').length
  const totalDeviceCount = consumers.length

  // Calculate voltage from power balance
  // Base 120V, scales based on balance percentage (±30V range)
  const voltage = (() => {
    if (totalGeneration === 0) return 0
    const balancePercent = powerBalance / totalGeneration
    // Clamp between 80V and 150V
    return Math.max(80, Math.min(150, 120 + (balancePercent * 30)))
  })()

  // Determine system status per GD_SPEC_device-power_v1_0.md thresholds
  const status: PowerSystemState['status'] = (() => {
    const surplusPercent = (powerBalance / totalGeneration) * 100
    if (surplusPercent > 20) return 'optimal'      // >20% surplus
    if (surplusPercent >= 0) return 'caution'      // 0-20% surplus
    if (surplusPercent > -20) return 'critical'    // <0% (deficit)
    return 'emergency'                              // Sustained deficit
  })()

  // Actions
  const setDevicePower = useCallback((deviceId: string, state: PowerState) => {
    setConsumers(prev => prev.map(c =>
      c.id === deviceId ? { ...c, currentState: state } : c
    ))
  }, [])

  const emergencyShutdown = useCallback(() => {
    // Shut down all non-critical (P2, P3, P4) devices per priority
    setConsumers(prev => prev.map(c =>
      c.priority > 1 ? { ...c, currentState: 'offline' } : c
    ))
  }, [])

  const refreshPowerData = useCallback(() => {
    setSources([...sources])
  }, [sources])

  const value: PowerManagerContextType = {
    totalGeneration,
    totalMaxGeneration,
    totalConsumption,
    powerBalance,
    loadPercent,
    storageE,
    storageCapacity,
    storagePercent,
    status,
    voltage,
    sources,
    storage,
    consumers,
    activeDeviceCount,
    totalDeviceCount,
    setDevicePower,
    emergencyShutdown,
    refreshPowerData,
  }

  return (
    <PowerManagerContext.Provider value={value}>
      {children}
    </PowerManagerContext.Provider>
  )
}

export function usePowerManager() {
  const context = useContext(PowerManagerContext)
  if (!context) {
    throw new Error('usePowerManager must be used within a PowerManagerProvider')
  }
  return context
}

// Optional hook for components that can work without power manager
export function usePowerManagerOptional() {
  return useContext(PowerManagerContext)
}

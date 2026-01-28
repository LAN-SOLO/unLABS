'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// Power source definition
interface PowerSource {
  id: string
  name: string
  output: number
  maxOutput: number
  status: 'online' | 'offline' | 'standby'
  efficiency: number
  tier: number
}

// Power storage definition
interface PowerStorage {
  id: string
  name: string
  stored: number
  capacity: number
  status: 'charging' | 'discharging' | 'full' | 'empty'
  chargeRate: number
}

// Power consumer definition
interface PowerConsumer {
  id: string
  name: string
  draw: number
  priority: 1 | 2 | 3 | 4
  status: 'on' | 'off' | 'standby'
}

// Power state
interface PowerState {
  // Calculated values
  totalGeneration: number
  totalMaxGeneration: number
  totalConsumption: number
  powerBalance: number
  loadPercent: number
  // Storage
  storageWh: number
  storageCapacity: number
  storagePercent: number
  // Status
  status: 'nominal' | 'warning' | 'deficit' | 'critical'
  // Voltage (calculated from balance)
  voltage: number
  // Raw data
  sources: PowerSource[]
  storage: PowerStorage[]
  consumers: PowerConsumer[]
  activeDeviceCount: number
}

interface PowerManagerContextType extends PowerState {
  // Actions
  setDevicePower: (deviceId: string, state: 'on' | 'off') => void
  emergencyShutdown: () => void
  refreshPowerData: () => void
}

const PowerManagerContext = createContext<PowerManagerContextType | null>(null)

// Default power sources
const defaultSources: PowerSource[] = [
  { id: 'UEC-001', name: 'Unstable Energy Core', output: 150, maxOutput: 200, status: 'online', efficiency: 75, tier: 1 },
  { id: 'MFR-001', name: 'Microfusion Reactor', output: 500, maxOutput: 600, status: 'online', efficiency: 92, tier: 2 },
]

// Default storage
const defaultStorage: PowerStorage[] = [
  { id: 'BAT-001', name: 'Battery Pack', stored: 850, capacity: 1000, status: 'charging', chargeRate: 25 },
]

// Default consumers (matching the power command in commands.ts)
const defaultConsumers: PowerConsumer[] = [
  { id: 'CDC-001', name: 'Crystal Data Cache', draw: 15, priority: 1, status: 'on' },
  { id: 'HMS-001', name: 'Handmade Synthesizer', draw: 45, priority: 2, status: 'on' },
  { id: 'ECR-001', name: 'Echo Recorder', draw: 20, priority: 2, status: 'on' },
  { id: 'INT-001', name: 'Interpolator', draw: 30, priority: 2, status: 'on' },
  { id: 'AIC-001', name: 'AI Assistant Core', draw: 80, priority: 1, status: 'on' },
  { id: 'SCA-001', name: 'Supercomputer Array', draw: 150, priority: 3, status: 'on' },
  { id: 'EXD-001', name: 'Explorer Drone', draw: 35, priority: 3, status: 'standby' },
  { id: 'RMG-001', name: 'Resource Magnet', draw: 25, priority: 3, status: 'on' },
  { id: 'ATK-001', name: 'Abstractum Tank', draw: 10, priority: 1, status: 'on' },
  { id: 'EMC-001', name: 'Exotic Matter Contain.', draw: 120, priority: 1, status: 'on' },
  { id: 'VNT-001', name: 'Ventilation System', draw: 40, priority: 1, status: 'on' },
  { id: 'OSC-001', name: 'Oscilloscope Array', draw: 25, priority: 2, status: 'on' },
  { id: 'QAN-001', name: 'Quantum Analyzer', draw: 60, priority: 2, status: 'on' },
  { id: 'QSM-001', name: 'Quantum State Monitor', draw: 55, priority: 2, status: 'on' },
  { id: 'NET-001', name: 'Network Monitor', draw: 20, priority: 2, status: 'on' },
  { id: 'TMP-001', name: 'Temperature Monitor', draw: 5, priority: 1, status: 'on' },
  { id: 'DIM-001', name: 'Dimension Monitor', draw: 40, priority: 2, status: 'on' },
  { id: 'CPU-001', name: 'CPU Monitor', draw: 10, priority: 1, status: 'on' },
  { id: 'CLK-001', name: 'Lab Clock', draw: 2, priority: 1, status: 'on' },
  { id: 'MEM-001', name: 'Memory Monitor', draw: 8, priority: 1, status: 'on' },
  { id: 'AND-001', name: 'Anomaly Detector', draw: 45, priority: 2, status: 'on' },
  { id: 'QCP-001', name: 'Quantum Compass', draw: 30, priority: 3, status: 'on' },
  { id: 'TLP-001', name: 'Teleport Pad', draw: 200, priority: 4, status: 'standby' },
  { id: 'DGN-001', name: 'Diagnostics Console', draw: 35, priority: 1, status: 'on' },
  { id: 'THM-001', name: 'Thermal Manager', draw: 15, priority: 1, status: 'on' },
  { id: 'LCT-001', name: 'Precision Laser', draw: 75, priority: 3, status: 'standby' },
  { id: 'P3D-001', name: '3D Fabricator', draw: 90, priority: 3, status: 'standby' },
  { id: 'BTK-001', name: 'Basic Toolkit', draw: 5, priority: 2, status: 'on' },
  { id: 'MSC-001', name: 'Material Scanner', draw: 12, priority: 2, status: 'on' },
]

export function PowerManagerProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<PowerSource[]>(defaultSources)
  const [storage, setStorage] = useState<PowerStorage[]>(defaultStorage)
  const [consumers, setConsumers] = useState<PowerConsumer[]>(defaultConsumers)

  // Calculate derived values
  const totalGeneration = sources.reduce((sum, s) => s.status === 'online' ? sum + s.output : sum, 0)
  const totalMaxGeneration = sources.reduce((sum, s) => sum + s.maxOutput, 0)
  const activeConsumers = consumers.filter(c => c.status === 'on')
  const totalConsumption = activeConsumers.reduce((sum, c) => sum + c.draw, 0)
  const powerBalance = totalGeneration - totalConsumption
  const loadPercent = totalGeneration > 0 ? Math.round((totalConsumption / totalGeneration) * 100) : 0
  const storageWh = storage.reduce((sum, s) => sum + s.stored, 0)
  const storageCapacity = storage.reduce((sum, s) => sum + s.capacity, 0)
  const storagePercent = storageCapacity > 0 ? Math.round((storageWh / storageCapacity) * 100) : 0
  const activeDeviceCount = activeConsumers.length

  // Calculate voltage from power balance (base 120V, scales based on balance)
  const voltage = (() => {
    if (totalGeneration === 0) return 0
    const balancePercent = powerBalance / totalGeneration
    // Clamp between 80V and 150V
    return Math.max(80, Math.min(150, 120 + (balancePercent * 30)))
  })()

  // Determine status
  const status: PowerState['status'] = (() => {
    if (powerBalance < -100) return 'critical'
    if (powerBalance < 0) return 'deficit'
    if (loadPercent > 90) return 'warning'
    return 'nominal'
  })()

  // Actions
  const setDevicePower = useCallback((deviceId: string, state: 'on' | 'off') => {
    setConsumers(prev => prev.map(c =>
      c.id === deviceId ? { ...c, status: state } : c
    ))
  }, [])

  const emergencyShutdown = useCallback(() => {
    // Shut down all non-critical (P2, P3, P4) devices
    setConsumers(prev => prev.map(c =>
      c.priority > 1 ? { ...c, status: 'off' } : c
    ))
  }, [])

  const refreshPowerData = useCallback(() => {
    // In a real implementation, this would fetch from the server
    // For now, just trigger a re-render
    setSources([...sources])
  }, [sources])

  const value: PowerManagerContextType = {
    totalGeneration,
    totalMaxGeneration,
    totalConsumption,
    powerBalance,
    loadPercent,
    storageWh,
    storageCapacity,
    storagePercent,
    status,
    voltage,
    sources,
    storage,
    consumers,
    activeDeviceCount,
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

// Optional hook that returns null if not in provider (for components that can work without it)
export function usePowerManagerOptional() {
  return useContext(PowerManagerContext)
}

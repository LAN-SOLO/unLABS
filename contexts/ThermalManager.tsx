'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'

// Device load entry
interface DeviceLoad {
  id: string
  name: string
  load: number // 0-100
  heatOutput: number // watts equivalent (for calculation)
  lastUpdate: number
}

// Fan state
interface FanState {
  id: string
  label: string
  speed: number // 0-100
  rpm: number
  mode: 'AUTO' | 'LOW' | 'MED' | 'HIGH' | 'MANUAL'
  isOn: boolean
  coolingPower: number // watts equivalent (for calculation)
}

// Thermal zone
interface ThermalZone {
  id: string
  label: string
  temperature: number // Celsius
  targetTemp: number
  warningThreshold: number
  criticalThreshold: number
}

// Thermal manager state
interface ThermalState {
  // Overall panel temperature
  panelTemperature: number
  ambientTemperature: number

  // Thermal zones
  zones: {
    cpu: ThermalZone
    gpu: ThermalZone
    panel: ThermalZone
  }

  // Fans
  fans: {
    cpu: FanState
    gpu: FanState
  }

  // Device loads
  deviceLoads: Map<string, DeviceLoad>

  // Status
  overallStatus: 'nominal' | 'elevated' | 'warning' | 'critical'
  isOverheating: boolean
  performanceThrottle: number // 0-1, 1 = full performance, 0.5 = 50% throttled

  // Auto mode
  autoMode: boolean
}

// Context type
interface ThermalManagerContextType {
  state: ThermalState

  // Device registration
  registerDevice: (id: string, name: string, initialLoad?: number) => void
  unregisterDevice: (id: string) => void
  updateDeviceLoad: (id: string, load: number) => void

  // Fan control
  setFanSpeed: (fanId: 'cpu' | 'gpu', speed: number) => void
  setFanMode: (fanId: 'cpu' | 'gpu', mode: FanState['mode']) => void
  toggleFan: (fanId: 'cpu' | 'gpu', on: boolean) => void

  // Global controls
  setAutoMode: (enabled: boolean) => void
  emergencyCool: () => void

  // Status helpers
  getTemperatureColor: (temp: number) => string
  getStatusText: () => string
}

const ThermalManagerContext = createContext<ThermalManagerContextType | null>(null)

export function useThermalManager() {
  const context = useContext(ThermalManagerContext)
  if (!context) {
    throw new Error('useThermalManager must be used within a ThermalManagerProvider')
  }
  return context
}

// Optional hook that doesn't throw if context is missing (for components that may be outside provider)
export function useThermalManagerOptional() {
  return useContext(ThermalManagerContext)
}

// Default initial state
const createInitialState = (): ThermalState => ({
  panelTemperature: 28,
  ambientTemperature: 22,

  zones: {
    cpu: {
      id: 'cpu',
      label: 'CPU',
      temperature: 32,
      targetTemp: 45,
      warningThreshold: 55,
      criticalThreshold: 75,
    },
    gpu: {
      id: 'gpu',
      label: 'GPU',
      temperature: 28,
      targetTemp: 50,
      warningThreshold: 65,
      criticalThreshold: 85,
    },
    panel: {
      id: 'panel',
      label: 'PANEL',
      temperature: 30,
      targetTemp: 35,
      warningThreshold: 45,
      criticalThreshold: 55,
    },
  },

  fans: {
    cpu: {
      id: 'cpu',
      label: 'CPU',
      speed: 50,
      rpm: 2400,
      mode: 'AUTO',
      isOn: true,
      coolingPower: 30,
    },
    gpu: {
      id: 'gpu',
      label: 'GPU',
      speed: 45,
      rpm: 2200,
      mode: 'AUTO',
      isOn: true,
      coolingPower: 35,
    },
  },

  deviceLoads: new Map(),

  overallStatus: 'nominal',
  isOverheating: false,
  performanceThrottle: 1,

  autoMode: true,
})

interface ThermalManagerProviderProps {
  children: ReactNode
}

export function ThermalManagerProvider({ children }: ThermalManagerProviderProps) {
  const [state, setState] = useState<ThermalState>(createInitialState)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate total heat from devices
  const calculateTotalHeat = useCallback((loads: Map<string, DeviceLoad>): number => {
    let totalHeat = 0
    loads.forEach((device) => {
      // Heat output scales with load (base heat + load-dependent heat)
      const baseHeat = device.heatOutput * 0.1 // 10% idle heat
      const loadHeat = device.heatOutput * (device.load / 100) * 0.9
      totalHeat += baseHeat + loadHeat
    })
    return totalHeat
  }, [])

  // Calculate total cooling from fans
  const calculateTotalCooling = useCallback((fans: ThermalState['fans']): number => {
    let totalCooling = 0
    Object.values(fans).forEach((fan) => {
      if (fan.isOn) {
        // Cooling scales non-linearly with speed (higher speed = more efficient)
        const efficiency = Math.pow(fan.speed / 100, 1.2)
        totalCooling += fan.coolingPower * efficiency
      }
    })
    return totalCooling
  }, [])

  // Calculate target fan speed based on temperature
  const calculateTargetFanSpeed = useCallback((temp: number, targetTemp: number, warningThreshold: number): number => {
    if (temp <= targetTemp) {
      return 25 // Minimum speed
    }

    // Linear interpolation from target to warning
    const range = warningThreshold - targetTemp
    const excess = temp - targetTemp
    const ratio = Math.min(1, excess / range)

    // Speed ranges from 25% to 100%
    return 25 + ratio * 75
  }, [])

  // Register device
  const registerDevice = useCallback((id: string, name: string, initialLoad = 0) => {
    setState((prev) => {
      const newLoads = new Map(prev.deviceLoads)
      // Default heat output based on device type (simulated)
      let heatOutput = 15 // Default 15W
      if (name.toLowerCase().includes('reactor') || name.toLowerCase().includes('core')) heatOutput = 50
      else if (name.toLowerCase().includes('computer') || name.toLowerCase().includes('super')) heatOutput = 80
      else if (name.toLowerCase().includes('laser')) heatOutput = 40
      else if (name.toLowerCase().includes('printer') || name.toLowerCase().includes('fabricator')) heatOutput = 35

      newLoads.set(id, {
        id,
        name,
        load: initialLoad,
        heatOutput,
        lastUpdate: Date.now(),
      })
      return { ...prev, deviceLoads: newLoads }
    })
  }, [])

  // Unregister device
  const unregisterDevice = useCallback((id: string) => {
    setState((prev) => {
      const newLoads = new Map(prev.deviceLoads)
      newLoads.delete(id)
      return { ...prev, deviceLoads: newLoads }
    })
  }, [])

  // Update device load
  const updateDeviceLoad = useCallback((id: string, load: number) => {
    setState((prev) => {
      const newLoads = new Map(prev.deviceLoads)
      const device = newLoads.get(id)
      if (device) {
        newLoads.set(id, { ...device, load: Math.max(0, Math.min(100, load)), lastUpdate: Date.now() })
      }
      return { ...prev, deviceLoads: newLoads }
    })
  }, [])

  // Set fan speed
  const setFanSpeed = useCallback((fanId: 'cpu' | 'gpu', speed: number) => {
    setState((prev) => {
      const clampedSpeed = Math.max(0, Math.min(100, speed))
      const rpm = Math.round((clampedSpeed / 100) * 4000 + 800)

      return {
        ...prev,
        fans: {
          ...prev.fans,
          [fanId]: {
            ...prev.fans[fanId],
            speed: clampedSpeed,
            rpm,
            mode: 'MANUAL' as const,
          },
        },
      }
    })
  }, [])

  // Set fan mode
  const setFanMode = useCallback((fanId: 'cpu' | 'gpu', mode: FanState['mode']) => {
    setState((prev) => {
      let newSpeed = prev.fans[fanId].speed

      if (mode === 'LOW') newSpeed = 25
      else if (mode === 'MED') newSpeed = 50
      else if (mode === 'HIGH') newSpeed = 100
      // AUTO mode will be handled by thermal loop

      const rpm = Math.round((newSpeed / 100) * 4000 + 800)

      return {
        ...prev,
        fans: {
          ...prev.fans,
          [fanId]: {
            ...prev.fans[fanId],
            mode,
            speed: newSpeed,
            rpm,
          },
        },
      }
    })
  }, [])

  // Toggle fan
  const toggleFan = useCallback((fanId: 'cpu' | 'gpu', on: boolean) => {
    setState((prev) => ({
      ...prev,
      fans: {
        ...prev.fans,
        [fanId]: {
          ...prev.fans[fanId],
          isOn: on,
          rpm: on ? Math.round((prev.fans[fanId].speed / 100) * 4000 + 800) : 0,
        },
      },
    }))
  }, [])

  // Set auto mode
  const setAutoMode = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      autoMode: enabled,
      fans: {
        cpu: { ...prev.fans.cpu, mode: enabled ? 'AUTO' : prev.fans.cpu.mode },
        gpu: { ...prev.fans.gpu, mode: enabled ? 'AUTO' : prev.fans.gpu.mode },
      },
    }))
  }, [])

  // Emergency cool - max all fans
  const emergencyCool = useCallback(() => {
    setState((prev) => ({
      ...prev,
      fans: {
        cpu: { ...prev.fans.cpu, speed: 100, rpm: 4800, mode: 'HIGH', isOn: true },
        gpu: { ...prev.fans.gpu, speed: 100, rpm: 4800, mode: 'HIGH', isOn: true },
      },
    }))
  }, [])

  // Get temperature color
  const getTemperatureColor = useCallback((temp: number): string => {
    if (temp < 35) return 'var(--neon-cyan)'
    if (temp < 45) return 'var(--neon-green)'
    if (temp < 55) return 'var(--neon-amber)'
    return 'var(--neon-red)'
  }, [])

  // Get status text
  const getStatusText = useCallback((): string => {
    switch (state.overallStatus) {
      case 'nominal': return 'NOMINAL'
      case 'elevated': return 'ELEVATED'
      case 'warning': return 'WARNING'
      case 'critical': return 'CRITICAL'
      default: return 'UNKNOWN'
    }
  }, [state.overallStatus])

  // Main thermal simulation loop
  useEffect(() => {
    updateIntervalRef.current = setInterval(() => {
      setState((prev) => {
        // Calculate heat and cooling
        const totalHeat = calculateTotalHeat(prev.deviceLoads)
        const totalCooling = calculateTotalCooling(prev.fans)
        const netHeat = totalHeat - totalCooling

        // Temperature change rate (simplified thermal model)
        const tempDelta = netHeat * 0.01 // Scaling factor
        const ambientPull = (prev.ambientTemperature - prev.panelTemperature) * 0.02

        // Update panel temperature
        const newPanelTemp = Math.max(
          prev.ambientTemperature,
          Math.min(80, prev.panelTemperature + tempDelta + ambientPull + (Math.random() - 0.5) * 0.5)
        )

        // Update zone temperatures (with some variance)
        const cpuLoad = [...prev.deviceLoads.values()]
          .filter(d => d.name.toLowerCase().includes('cpu') || d.name.toLowerCase().includes('processor'))
          .reduce((sum, d) => sum + d.load, 50) / 100 // Default 50% if no CPU devices

        const gpuLoad = [...prev.deviceLoads.values()]
          .filter(d => d.name.toLowerCase().includes('gpu') || d.name.toLowerCase().includes('graphics'))
          .reduce((sum, d) => sum + d.load, 40) / 100 // Default 40%

        const cpuHeatFactor = 0.4 + cpuLoad * 0.6
        const gpuHeatFactor = 0.3 + gpuLoad * 0.7

        const newZones = {
          cpu: {
            ...prev.zones.cpu,
            temperature: Math.max(
              prev.ambientTemperature + 5,
              Math.min(90, prev.zones.cpu.temperature + (netHeat * 0.015 * cpuHeatFactor) + (Math.random() - 0.5) * 0.8)
            ),
          },
          gpu: {
            ...prev.zones.gpu,
            temperature: Math.max(
              prev.ambientTemperature + 3,
              Math.min(95, prev.zones.gpu.temperature + (netHeat * 0.012 * gpuHeatFactor) + (Math.random() - 0.5) * 0.6)
            ),
          },
          panel: {
            ...prev.zones.panel,
            temperature: newPanelTemp,
          },
        }

        // Calculate overall status
        let overallStatus: ThermalState['overallStatus'] = 'nominal'
        let isOverheating = false
        let performanceThrottle = 1

        Object.values(newZones).forEach((zone) => {
          if (zone.temperature >= zone.criticalThreshold) {
            overallStatus = 'critical'
            isOverheating = true
            performanceThrottle = Math.min(performanceThrottle, 0.5)
          } else if (zone.temperature >= zone.warningThreshold) {
            if (overallStatus !== 'critical') overallStatus = 'warning'
            performanceThrottle = Math.min(performanceThrottle, 0.75)
          } else if (zone.temperature >= zone.targetTemp + 5) {
            if (overallStatus === 'nominal') overallStatus = 'elevated'
          }
        })

        // Auto-adjust fan speeds if in AUTO mode
        let newFans = { ...prev.fans }

        if (prev.autoMode || prev.fans.cpu.mode === 'AUTO') {
          const targetCpuSpeed = calculateTargetFanSpeed(
            newZones.cpu.temperature,
            newZones.cpu.targetTemp,
            newZones.cpu.warningThreshold
          )
          // Smooth adjustment
          const currentCpuSpeed = prev.fans.cpu.speed
          const cpuSpeedDiff = targetCpuSpeed - currentCpuSpeed
          const newCpuSpeed = currentCpuSpeed + cpuSpeedDiff * 0.1 // Gradual change
          const cpuRpm = Math.round((newCpuSpeed / 100) * 4000 + 800)

          newFans.cpu = {
            ...newFans.cpu,
            speed: Math.round(newCpuSpeed),
            rpm: newFans.cpu.isOn ? cpuRpm : 0,
          }
        }

        if (prev.autoMode || prev.fans.gpu.mode === 'AUTO') {
          const targetGpuSpeed = calculateTargetFanSpeed(
            newZones.gpu.temperature,
            newZones.gpu.targetTemp,
            newZones.gpu.warningThreshold
          )
          const currentGpuSpeed = prev.fans.gpu.speed
          const gpuSpeedDiff = targetGpuSpeed - currentGpuSpeed
          const newGpuSpeed = currentGpuSpeed + gpuSpeedDiff * 0.1
          const gpuRpm = Math.round((newGpuSpeed / 100) * 4000 + 800)

          newFans.gpu = {
            ...newFans.gpu,
            speed: Math.round(newGpuSpeed),
            rpm: newFans.gpu.isOn ? gpuRpm : 0,
          }
        }

        // Emergency auto-increase if critical (override even manual mode)
        if (isOverheating) {
          if (newFans.cpu.isOn && newFans.cpu.speed < 90) {
            newFans.cpu = { ...newFans.cpu, speed: Math.min(100, newFans.cpu.speed + 5) }
          }
          if (newFans.gpu.isOn && newFans.gpu.speed < 90) {
            newFans.gpu = { ...newFans.gpu, speed: Math.min(100, newFans.gpu.speed + 5) }
          }
        }

        return {
          ...prev,
          panelTemperature: Math.round(newPanelTemp * 10) / 10,
          zones: newZones,
          fans: newFans,
          overallStatus,
          isOverheating,
          performanceThrottle,
        }
      })
    }, 1000) // Update every second

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [calculateTotalHeat, calculateTotalCooling, calculateTargetFanSpeed])

  const contextValue: ThermalManagerContextType = {
    state,
    registerDevice,
    unregisterDevice,
    updateDeviceLoad,
    setFanSpeed,
    setFanMode,
    toggleFan,
    setAutoMode,
    emergencyCool,
    getTemperatureColor,
    getStatusText,
  }

  return (
    <ThermalManagerContext.Provider value={contextValue}>
      {children}
    </ThermalManagerContext.Provider>
  )
}

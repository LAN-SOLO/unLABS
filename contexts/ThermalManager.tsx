"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  TERMINAL_CHASSIS_VOLUME_L,
  CHASSIS_HEAT_CAPACITY_J,
  getDeviceThermalSpec,
  deviceHeatCapacityJ,
  totalDeviceVolumeL,
  airGapL,
} from "@/lib/thermal/volumes";

// Device load entry
export interface DeviceLoad {
  id: string;
  name: string;
  load: number; // 0-100
  heatOutput: number; // watts at 100% load (peak); idle ≈ 10%
  /**
   * Optional instantaneous heat output in watts. When set, it overrides the
   * load-derived formula and is used directly as the joule budget for this
   * device. This is how PowerManager wires real per-device power draw into
   * the thermal model — almost all consumed electrical power becomes waste
   * heat in the chassis.
   */
  instantHeatW?: number;
  volumeL: number; // fixed enclosure volume
  heatCapacityJ: number; // J/K, derived from volume + mass factor
  temperature: number; // °C, per-device sub-zone temperature
  lastUpdate: number;
}

// Fan state
interface FanState {
  id: string;
  label: string;
  speed: number; // 0-100
  rpm: number;
  mode: "AUTO" | "LOW" | "MED" | "HIGH" | "MANUAL";
  isOn: boolean;
  coolingPower: number; // watts equivalent (for calculation)
}

// Thermal zone
interface ThermalZone {
  id: string;
  label: string;
  temperature: number; // Celsius
  targetTemp: number;
  warningThreshold: number;
  criticalThreshold: number;
}

// Thermal manager state
export interface ThermalState {
  // Overall chassis temperature
  panelTemperature: number;
  ambientTemperature: number;

  // Fixed chassis volume model
  chassisVolumeL: number;
  chassisHeatCapacityJ: number;

  // Thermal zones
  zones: {
    cpu: ThermalZone;
    gpu: ThermalZone;
    panel: ThermalZone;
  };

  // Fans
  fans: {
    cpu: FanState;
    gpu: FanState;
  };

  // Device loads
  deviceLoads: Map<string, DeviceLoad>;

  // Last simulation outputs (so the command can echo joules without recomputing)
  totalHeatW: number;
  totalCoolingW: number;
  netHeatW: number;

  // Status
  overallStatus: "nominal" | "elevated" | "warning" | "critical";
  isOverheating: boolean;
  performanceThrottle: number; // 0-1, 1 = full performance, 0.5 = 50% throttled

  // Auto mode
  autoMode: boolean;
}

// Context type
export interface ThermalManagerContextType {
  state: ThermalState;

  // Device registration
  registerDevice: (id: string, name: string, initialLoad?: number) => void;
  unregisterDevice: (id: string) => void;
  updateDeviceLoad: (id: string, load: number) => void;
  /**
   * Push a real-world power reading from the PowerManager into the thermal
   * model. Auto-registers the device if needed. `currentWatts` is treated
   * as instantaneous waste heat; `peakWatts` keeps the catalog peak in sync
   * so `thermal list` still shows a sensible "Q@100%" column and load %.
   */
  syncDevicePower: (id: string, currentWatts: number, peakWatts: number, name?: string) => void;

  // Fan control
  setFanSpeed: (fanId: "cpu" | "gpu", speed: number) => void;
  setFanMode: (fanId: "cpu" | "gpu", mode: FanState["mode"]) => void;
  toggleFan: (fanId: "cpu" | "gpu", on: boolean) => void;

  // Global controls
  setAutoMode: (enabled: boolean) => void;
  emergencyCool: () => void;

  // Inspection helpers used by the `thermal` terminal command
  listDevices: () => DeviceLoad[];
  getChassisInfo: () => {
    volumeL: number;
    deviceVolumeL: number;
    airGapL: number;
    heatCapacityJ: number;
  };

  // Status helpers
  getTemperatureColor: (temp: number) => string;
  getStatusText: () => string;
}

const ThermalManagerContext = createContext<ThermalManagerContextType | null>(null);

export function useThermalManager() {
  const context = useContext(ThermalManagerContext);
  if (!context) {
    throw new Error("useThermalManager must be used within a ThermalManagerProvider");
  }
  return context;
}

// Optional hook that doesn't throw if context is missing (for components that may be outside provider)
export function useThermalManagerOptional() {
  return useContext(ThermalManagerContext);
}

// Default initial state
const createInitialState = (): ThermalState => ({
  panelTemperature: 28,
  ambientTemperature: 22,

  chassisVolumeL: TERMINAL_CHASSIS_VOLUME_L,
  chassisHeatCapacityJ: CHASSIS_HEAT_CAPACITY_J,

  totalHeatW: 0,
  totalCoolingW: 0,
  netHeatW: 0,

  zones: {
    cpu: {
      id: "cpu",
      label: "CPU",
      temperature: 32,
      targetTemp: 45,
      warningThreshold: 55,
      criticalThreshold: 75,
    },
    gpu: {
      id: "gpu",
      label: "GPU",
      temperature: 28,
      targetTemp: 50,
      warningThreshold: 65,
      criticalThreshold: 85,
    },
    panel: {
      id: "panel",
      label: "PANEL",
      temperature: 30,
      targetTemp: 35,
      warningThreshold: 45,
      criticalThreshold: 55,
    },
  },

  fans: {
    cpu: {
      id: "cpu",
      label: "CPU",
      speed: 50,
      rpm: 2400,
      mode: "AUTO",
      isOn: true,
      coolingPower: 90,
    },
    gpu: {
      id: "gpu",
      label: "GPU",
      speed: 45,
      rpm: 2200,
      mode: "AUTO",
      isOn: true,
      coolingPower: 110,
    },
  },

  deviceLoads: new Map(),

  overallStatus: "nominal",
  isOverheating: false,
  performanceThrottle: 1,

  autoMode: true,
});

interface ThermalManagerProviderProps {
  children: ReactNode;
}

export function ThermalManagerProvider({ children }: ThermalManagerProviderProps) {
  const [state, setState] = useState<ThermalState>(createInitialState);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total heat from devices
  const calculateTotalHeat = useCallback((loads: Map<string, DeviceLoad>): number => {
    let totalHeat = 0;
    loads.forEach((device) => {
      if (device.instantHeatW !== undefined) {
        // Real-world power reading from PowerManager — use directly.
        totalHeat += device.instantHeatW;
      } else {
        // Fallback: scale catalog peak by simulated load (10% idle baseline).
        const baseHeat = device.heatOutput * 0.1;
        const loadHeat = device.heatOutput * (device.load / 100) * 0.9;
        totalHeat += baseHeat + loadHeat;
      }
    });
    return totalHeat;
  }, []);

  // Calculate total cooling from fans
  const calculateTotalCooling = useCallback((fans: ThermalState["fans"]): number => {
    let totalCooling = 0;
    Object.values(fans).forEach((fan) => {
      if (fan.isOn) {
        // Cooling scales non-linearly with speed (higher speed = more efficient)
        const efficiency = Math.pow(fan.speed / 100, 1.2);
        totalCooling += fan.coolingPower * efficiency;
      }
    });
    return totalCooling;
  }, []);

  // Calculate target fan speed based on temperature
  const calculateTargetFanSpeed = useCallback(
    (temp: number, targetTemp: number, warningThreshold: number): number => {
      if (temp <= targetTemp) {
        return 25; // Minimum speed
      }

      // Linear interpolation from target to warning
      const range = warningThreshold - targetTemp;
      const excess = temp - targetTemp;
      const ratio = Math.min(1, excess / range);

      // Speed ranges from 25% to 100%
      return 25 + ratio * 75;
    },
    [],
  );

  // Register device. If the id is in DEVICE_THERMAL_SPECS we use the catalog
  // values; otherwise we fall back to a small generic spec so unknown devices
  // still participate in the model.
  const registerDevice = useCallback((id: string, name: string, initialLoad = 0) => {
    setState((prev) => {
      const newLoads = new Map(prev.deviceLoads);
      const spec = getDeviceThermalSpec(id);
      const volumeL = spec?.volumeL ?? 0.5;
      const heatOutput = spec?.heatWatts ?? 15;
      const heatCapacityJ = spec ? deviceHeatCapacityJ(id) : volumeL * 1.225 * 1.005 * 8;

      newLoads.set(id, {
        id,
        name: spec?.name ?? name,
        load: initialLoad,
        heatOutput,
        volumeL,
        heatCapacityJ,
        temperature: prev.ambientTemperature + 4, // start a few °C above ambient
        lastUpdate: Date.now(),
      });
      return { ...prev, deviceLoads: newLoads };
    });
  }, []);

  // Unregister device
  const unregisterDevice = useCallback((id: string) => {
    setState((prev) => {
      const newLoads = new Map(prev.deviceLoads);
      newLoads.delete(id);
      return { ...prev, deviceLoads: newLoads };
    });
  }, []);

  // Update device load
  const updateDeviceLoad = useCallback((id: string, load: number) => {
    setState((prev) => {
      const newLoads = new Map(prev.deviceLoads);
      const device = newLoads.get(id);
      if (device) {
        // Manual override clears any instantaneous power reading so the
        // load-driven formula takes over again.
        const { instantHeatW: _drop, ...rest } = device;
        void _drop;
        newLoads.set(id, {
          ...rest,
          load: Math.max(0, Math.min(100, load)),
          lastUpdate: Date.now(),
        });
      }
      return { ...prev, deviceLoads: newLoads };
    });
  }, []);

  // Bridge real-world power draw (E/s ≈ W) into the thermal model.
  const syncDevicePower = useCallback(
    (id: string, currentWatts: number, peakWatts: number, name?: string) => {
      const key = id.toLowerCase();
      setState((prev) => {
        const newLoads = new Map(prev.deviceLoads);
        const existing = newLoads.get(key);
        const spec = getDeviceThermalSpec(key);
        const volumeL = spec?.volumeL ?? existing?.volumeL ?? 0.5;
        const heatCapacityJ = spec
          ? deviceHeatCapacityJ(key)
          : (existing?.heatCapacityJ ?? volumeL * 1.225 * 1.005 * 8);
        const peakW = Math.max(0.1, peakWatts);
        const currentW = Math.max(0, currentWatts);
        const load = Math.min(100, (currentW / peakW) * 100);
        newLoads.set(key, {
          id: key,
          name: existing?.name ?? spec?.name ?? name ?? key,
          load,
          heatOutput: peakW,
          instantHeatW: currentW,
          volumeL,
          heatCapacityJ,
          temperature: existing?.temperature ?? prev.ambientTemperature + 4,
          lastUpdate: Date.now(),
        });
        return { ...prev, deviceLoads: newLoads };
      });
    },
    [],
  );

  // Set fan speed
  const setFanSpeed = useCallback((fanId: "cpu" | "gpu", speed: number) => {
    setState((prev) => {
      const clampedSpeed = Math.max(0, Math.min(100, speed));
      const rpm = Math.round((clampedSpeed / 100) * 4000 + 800);

      return {
        ...prev,
        fans: {
          ...prev.fans,
          [fanId]: {
            ...prev.fans[fanId],
            speed: clampedSpeed,
            rpm,
            mode: "MANUAL" as const,
          },
        },
      };
    });
  }, []);

  // Set fan mode
  const setFanMode = useCallback((fanId: "cpu" | "gpu", mode: FanState["mode"]) => {
    setState((prev) => {
      let newSpeed = prev.fans[fanId].speed;

      if (mode === "LOW") newSpeed = 25;
      else if (mode === "MED") newSpeed = 50;
      else if (mode === "HIGH") newSpeed = 100;
      // AUTO mode will be handled by thermal loop

      const rpm = Math.round((newSpeed / 100) * 4000 + 800);

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
      };
    });
  }, []);

  // Toggle fan. Hard interlock: at least one fan must always be running, so
  // turning the last active fan off is silently ignored.
  const toggleFan = useCallback((fanId: "cpu" | "gpu", on: boolean) => {
    setState((prev) => {
      if (!on) {
        const otherId = fanId === "cpu" ? "gpu" : "cpu";
        if (!prev.fans[otherId].isOn) {
          // Refuse: would leave the chassis with zero airflow.
          return prev;
        }
      }
      return {
        ...prev,
        fans: {
          ...prev.fans,
          [fanId]: {
            ...prev.fans[fanId],
            isOn: on,
            rpm: on ? Math.round((prev.fans[fanId].speed / 100) * 4000 + 800) : 0,
          },
        },
      };
    });
  }, []);

  // Set auto mode
  const setAutoMode = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      autoMode: enabled,
      fans: {
        cpu: { ...prev.fans.cpu, mode: enabled ? "AUTO" : prev.fans.cpu.mode },
        gpu: { ...prev.fans.gpu, mode: enabled ? "AUTO" : prev.fans.gpu.mode },
      },
    }));
  }, []);

  // Emergency cool - max all fans
  const emergencyCool = useCallback(() => {
    setState((prev) => ({
      ...prev,
      fans: {
        cpu: { ...prev.fans.cpu, speed: 100, rpm: 4800, mode: "HIGH", isOn: true },
        gpu: { ...prev.fans.gpu, speed: 100, rpm: 4800, mode: "HIGH", isOn: true },
      },
    }));
  }, []);

  // Continuous blue → cyan → green → amber → red gradient.
  // Mapped over the operational range 20 °C – 90 °C. Anything outside the
  // range clamps to the endpoint colors. Returned as an `rgb(...)` string so
  // it can be assigned to `color` / `borderColor` / `backgroundColor` directly.
  const getTemperatureColor = useCallback((temp: number): string => {
    const min = 20;
    const max = 90;
    const t = Math.max(0, Math.min(1, (temp - min) / (max - min)));

    // 5 stops along the gradient: blue, cyan, green, amber, red
    const stops: Array<[number, [number, number, number]]> = [
      [0.0, [0, 170, 255]], // cool blue
      [0.25, [0, 229, 255]], // cyan
      [0.5, [105, 240, 174]], // green
      [0.75, [255, 191, 0]], // amber
      [1.0, [255, 64, 64]], // red
    ];

    // Find the bracketing stops and lerp between them
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) {
        lo = stops[i];
        hi = stops[i + 1];
        break;
      }
    }
    const span = hi[0] - lo[0];
    const local = span === 0 ? 0 : (t - lo[0]) / span;
    const r = Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * local);
    const g = Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * local);
    const b = Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * local);
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  // Inspection helpers used by the `thermal` terminal command
  const listDevices = useCallback((): DeviceLoad[] => {
    return [...state.deviceLoads.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [state.deviceLoads]);

  const getChassisInfo = useCallback(
    () => ({
      volumeL: state.chassisVolumeL,
      deviceVolumeL: totalDeviceVolumeL(),
      airGapL: airGapL(),
      heatCapacityJ: state.chassisHeatCapacityJ,
    }),
    [state.chassisVolumeL, state.chassisHeatCapacityJ],
  );

  // Get status text
  const getStatusText = useCallback((): string => {
    switch (state.overallStatus) {
      case "nominal":
        return "NOMINAL";
      case "elevated":
        return "ELEVATED";
      case "warning":
        return "WARNING";
      case "critical":
        return "CRITICAL";
      default:
        return "UNKNOWN";
    }
  }, [state.overallStatus]);

  // Main thermal simulation loop
  useEffect(() => {
    const TICK_MS = 1000;
    const dt = TICK_MS / 1000; // seconds per tick
    updateIntervalRef.current = setInterval(() => {
      setState((prev) => {
        // ── Energy balance (watts) ──────────────────────────────────
        const totalHeat = calculateTotalHeat(prev.deviceLoads); // W
        const totalCooling = calculateTotalCooling(prev.fans); // W
        const netHeat = totalHeat - totalCooling; // W

        // ── Chassis temperature ─────────────────────────────────────
        // ΔT = (Q · dt) / C   with C in J/K and Q in W (=J/s)
        // The chassis loses some heat to ambient via natural conduction.
        // Coefficient tuned so a fully off chassis returns to ambient in
        // ~30 s instead of the ~2 min the original 1.6 W/K gave us.
        const ambientLossW = (prev.panelTemperature - prev.ambientTemperature) * 4.0;
        const chassisNetW = netHeat - ambientLossW;
        const chassisDeltaT = (chassisNetW * dt) / prev.chassisHeatCapacityJ;
        const newPanelTemp = Math.max(
          prev.ambientTemperature,
          Math.min(80, prev.panelTemperature + chassisDeltaT + (Math.random() - 0.5) * 0.15),
        );

        // ── Per-device sub-zone temperatures ────────────────────────
        // Each registered device heats itself based on its own load and is
        // pulled towards chassis temperature by the airflow proportional to
        // average fan speed (couples cooling to fans without double counting).
        const avgFanSpeed =
          ((prev.fans.cpu.isOn ? prev.fans.cpu.speed : 0) +
            (prev.fans.gpu.isOn ? prev.fans.gpu.speed : 0)) /
          200; // 0..1
        // Stronger coupling so per-device sub-zones track the chassis quickly
        // — was 0.8 + s*4.5 (max ~5.3 W/K), now max ~12 W/K.
        const airflowCouplingW = 2.0 + avgFanSpeed * 10;

        const newDeviceLoads = new Map<string, DeviceLoad>();
        prev.deviceLoads.forEach((d) => {
          const generatedW =
            d.instantHeatW !== undefined
              ? d.instantHeatW
              : d.heatOutput * 0.1 + d.heatOutput * (d.load / 100) * 0.9;
          const couplingW = (d.temperature - newPanelTemp) * airflowCouplingW;
          const dDeltaT = ((generatedW - couplingW) * dt) / Math.max(1, d.heatCapacityJ);
          const newTemp = Math.max(prev.ambientTemperature, Math.min(110, d.temperature + dDeltaT));
          newDeviceLoads.set(d.id, { ...d, temperature: newTemp });
        });

        // ── CPU / GPU sub-zones ─────────────────────────────────────
        // Use the per-device temperatures if known, otherwise fall back to a
        // load-driven heuristic (keeps the panel UI alive even with no
        // devices registered).
        const cpuDev = newDeviceLoads.get("cpu");
        const gpuDev = newDeviceLoads.get("sca") || newDeviceLoads.get("aic");

        const cpuLoad = cpuDev ? cpuDev.load / 100 : 0.5;
        const gpuLoad = gpuDev ? gpuDev.load / 100 : 0.4;
        const cpuHeatFactor = 0.4 + cpuLoad * 0.6;
        const gpuHeatFactor = 0.3 + gpuLoad * 0.7;

        const newZones = {
          cpu: {
            ...prev.zones.cpu,
            temperature: cpuDev
              ? cpuDev.temperature
              : Math.max(
                  prev.ambientTemperature + 5,
                  Math.min(
                    90,
                    prev.zones.cpu.temperature +
                      netHeat * 0.015 * cpuHeatFactor +
                      (Math.random() - 0.5) * 0.8,
                  ),
                ),
          },
          gpu: {
            ...prev.zones.gpu,
            temperature: gpuDev
              ? gpuDev.temperature
              : Math.max(
                  prev.ambientTemperature + 3,
                  Math.min(
                    95,
                    prev.zones.gpu.temperature +
                      netHeat * 0.012 * gpuHeatFactor +
                      (Math.random() - 0.5) * 0.6,
                  ),
                ),
          },
          panel: {
            ...prev.zones.panel,
            temperature: newPanelTemp,
          },
        };

        // Calculate overall status
        let overallStatus: ThermalState["overallStatus"] = "nominal";
        let isOverheating = false;
        let performanceThrottle = 1;

        Object.values(newZones).forEach((zone) => {
          if (zone.temperature >= zone.criticalThreshold) {
            overallStatus = "critical";
            isOverheating = true;
            performanceThrottle = Math.min(performanceThrottle, 0.5);
          } else if (zone.temperature >= zone.warningThreshold) {
            if (overallStatus !== "critical") overallStatus = "warning";
            performanceThrottle = Math.min(performanceThrottle, 0.75);
          } else if (zone.temperature >= zone.targetTemp + 5) {
            if (overallStatus === "nominal") overallStatus = "elevated";
          }
        });

        // Auto-adjust fan speeds if in AUTO mode
        let newFans = { ...prev.fans };

        if (prev.autoMode || prev.fans.cpu.mode === "AUTO") {
          const targetCpuSpeed = calculateTargetFanSpeed(
            newZones.cpu.temperature,
            newZones.cpu.targetTemp,
            newZones.cpu.warningThreshold,
          );
          // Smooth adjustment
          const currentCpuSpeed = prev.fans.cpu.speed;
          const cpuSpeedDiff = targetCpuSpeed - currentCpuSpeed;
          const newCpuSpeed = currentCpuSpeed + cpuSpeedDiff * 0.35; // Faster gradual change so AUTO reacts within ~3 ticks
          const cpuRpm = Math.round((newCpuSpeed / 100) * 4000 + 800);

          newFans.cpu = {
            ...newFans.cpu,
            speed: Math.round(newCpuSpeed),
            rpm: newFans.cpu.isOn ? cpuRpm : 0,
          };
        }

        if (prev.autoMode || prev.fans.gpu.mode === "AUTO") {
          const targetGpuSpeed = calculateTargetFanSpeed(
            newZones.gpu.temperature,
            newZones.gpu.targetTemp,
            newZones.gpu.warningThreshold,
          );
          const currentGpuSpeed = prev.fans.gpu.speed;
          const gpuSpeedDiff = targetGpuSpeed - currentGpuSpeed;
          const newGpuSpeed = currentGpuSpeed + gpuSpeedDiff * 0.35;
          const gpuRpm = Math.round((newGpuSpeed / 100) * 4000 + 800);

          newFans.gpu = {
            ...newFans.gpu,
            speed: Math.round(newGpuSpeed),
            rpm: newFans.gpu.isOn ? gpuRpm : 0,
          };
        }

        // Emergency auto-increase if critical (override even manual mode)
        if (isOverheating) {
          if (newFans.cpu.isOn && newFans.cpu.speed < 90) {
            newFans.cpu = { ...newFans.cpu, speed: Math.min(100, newFans.cpu.speed + 5) };
          }
          if (newFans.gpu.isOn && newFans.gpu.speed < 90) {
            newFans.gpu = { ...newFans.gpu, speed: Math.min(100, newFans.gpu.speed + 5) };
          }
        }

        return {
          ...prev,
          panelTemperature: Math.round(newPanelTemp * 10) / 10,
          zones: newZones,
          fans: newFans,
          deviceLoads: newDeviceLoads,
          totalHeatW: Math.round(totalHeat * 10) / 10,
          totalCoolingW: Math.round(totalCooling * 10) / 10,
          netHeatW: Math.round(netHeat * 10) / 10,
          overallStatus,
          isOverheating,
          performanceThrottle,
        };
      });
    }, TICK_MS);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [calculateTotalHeat, calculateTotalCooling, calculateTargetFanSpeed]);

  const contextValue: ThermalManagerContextType = {
    state,
    registerDevice,
    unregisterDevice,
    updateDeviceLoad,
    syncDevicePower,
    setFanSpeed,
    setFanMode,
    toggleFan,
    setAutoMode,
    emergencyCool,
    listDevices,
    getChassisInfo,
    getTemperatureColor,
    getStatusText,
  };

  return (
    <ThermalManagerContext.Provider value={contextValue}>{children}</ThermalManagerContext.Provider>
  );
}

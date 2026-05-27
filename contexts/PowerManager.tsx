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

// Power units are E/s (Energy per second) as per GD_SPEC_device-power_v1_0.md

type PowerState = "full" | "idle" | "standby" | "offline";

interface PowerSource {
  id: string;
  name: string;
  tier: number;
  output: { full: number; idle: number; standby: number };
  currentState: PowerState;
  efficiency: number;
  startupCost: number;
}

interface PowerStorage {
  id: string;
  name: string;
  capacity: number;
  stored: number;
  chargeRate: number;
  dischargeRate: number;
  selfDischarge: number;
  status: "charging" | "discharging" | "full" | "empty" | "idle";
}

interface PowerConsumer {
  id: string;
  name: string;
  category: "heavy" | "medium" | "light";
  draw: { full: number; idle: number; standby: number };
  currentState: PowerState;
  priority: 1 | 2 | 3 | 4;
}

interface PowerSystemState {
  totalGeneration: number;
  totalMaxGeneration: number;
  totalConsumption: number;
  powerBalance: number;
  loadPercent: number;
  storageE: number;
  storageCapacity: number;
  storagePercent: number;
  status: "optimal" | "caution" | "critical" | "emergency";
  voltage: number;
  sources: PowerSource[];
  storage: PowerStorage[];
  consumers: PowerConsumer[];
  activeDeviceCount: number;
  totalDeviceCount: number;
  performanceThrottle: number;
  loadSheddingActive: boolean;
  shedDeviceIds: string[];
}

interface PowerManagerContextType extends PowerSystemState {
  setDevicePower: (deviceId: string, state: PowerState) => void;
  setSourceState: (sourceId: string, state: PowerState) => void;
  setPerformanceThrottle: (throttle: number) => void;
  emergencyShutdown: () => void;
  refreshPowerData: () => void;
}

const PowerManagerContext = createContext<PowerManagerContextType | null>(null);

// ── Default data ─────────────────────────────────────────────────────

const defaultSources: PowerSource[] = [
  {
    id: "UEC-001",
    name: "Unstable Energy Core",
    tier: 1,
    output: { full: 50, idle: 35, standby: 5 },
    currentState: "full",
    efficiency: 75,
    startupCost: 100,
  },
  {
    id: "MFR-001",
    name: "Microfusion Reactor",
    tier: 2,
    output: { full: 250, idle: 150, standby: 25 },
    currentState: "full",
    efficiency: 92,
    startupCost: 500,
  },
];

const defaultStorage: PowerStorage[] = [
  {
    id: "BAT-001",
    name: "Battery Pack",
    capacity: 5000,
    stored: 4250,
    chargeRate: 100,
    dischargeRate: 150,
    selfDischarge: 0.5,
    status: "idle",
  },
];

const defaultConsumers: PowerConsumer[] = [
  {
    id: "SCA-001",
    name: "Supercomputer Array",
    category: "heavy",
    draw: { full: 150, idle: 45, standby: 8 },
    currentState: "idle",
    priority: 3,
  },
  {
    id: "TLP-001",
    name: "Teleport Pad",
    category: "heavy",
    draw: { full: 100, idle: 15, standby: 3 },
    currentState: "standby",
    priority: 4,
  },
  {
    id: "QAN-001",
    name: "Quantum Analyzer",
    category: "heavy",
    draw: { full: 80, idle: 20, standby: 5 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "EMC-001",
    name: "Exotic Matter Contain.",
    category: "heavy",
    draw: { full: 75, idle: 40, standby: 40 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "P3D-001",
    name: "3D Fabricator",
    category: "heavy",
    draw: { full: 60, idle: 8, standby: 2 },
    currentState: "standby",
    priority: 3,
  },
  {
    id: "LCT-001",
    name: "Precision Laser",
    category: "heavy",
    draw: { full: 55, idle: 10, standby: 2 },
    currentState: "standby",
    priority: 3,
  },
  {
    id: "EXD-001",
    name: "Explorer Drone",
    category: "heavy",
    draw: { full: 40, idle: 15, standby: 1 },
    currentState: "standby",
    priority: 3,
  },
  {
    id: "AIC-001",
    name: "AI Assistant Core",
    category: "heavy",
    draw: { full: 35, idle: 12, standby: 3 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "QSM-001",
    name: "Quantum State Monitor",
    category: "medium",
    draw: { full: 22, idle: 7, standby: 1.5 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "INT-001",
    name: "Interpolator",
    category: "medium",
    draw: { full: 20, idle: 6, standby: 1 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "OSC-001",
    name: "Oscilloscope Array",
    category: "medium",
    draw: { full: 18, idle: 5, standby: 1 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "CDC-001",
    name: "Crystal Data Cache",
    category: "medium",
    draw: { full: 15, idle: 5, standby: 1 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "AND-001",
    name: "Anomaly Detector",
    category: "medium",
    draw: { full: 15, idle: 4, standby: 0.8 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "RMG-001",
    name: "Resource Magnet",
    category: "medium",
    draw: { full: 10, idle: 3, standby: 0.5 },
    currentState: "idle",
    priority: 3,
  },
  {
    id: "HMS-001",
    name: "Handmade Synthesizer",
    category: "medium",
    draw: { full: 8, idle: 3, standby: 0.5 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "ECR-001",
    name: "Echo Recorder",
    category: "medium",
    draw: { full: 6, idle: 2, standby: 0.3 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "VNT-001",
    name: "Ventilation System",
    category: "light",
    draw: { full: 4, idle: 2, standby: 0.5 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "THM-001",
    name: "Thermal Manager",
    category: "light",
    draw: { full: 4, idle: 1.5, standby: 0.3 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "DIM-001",
    name: "Dimension Monitor",
    category: "light",
    draw: { full: 4, idle: 1.5, standby: 0.4 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "MSC-001",
    name: "Material Scanner",
    category: "light",
    draw: { full: 3.5, idle: 1, standby: 0.2 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "NET-001",
    name: "Network Monitor",
    category: "light",
    draw: { full: 3.5, idle: 1.5, standby: 0.3 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "DGN-001",
    name: "Diagnostics Console",
    category: "light",
    draw: { full: 3, idle: 1, standby: 0.25 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "SPK-001",
    name: "Narrow Speaker",
    category: "light",
    draw: { full: 3, idle: 0.5, standby: 0.1 },
    currentState: "idle",
    priority: 3,
  },
  {
    id: "QCP-001",
    name: "Quantum Compass",
    category: "light",
    draw: { full: 2.5, idle: 0.8, standby: 0.2 },
    currentState: "idle",
    priority: 3,
  },
  {
    id: "PWR-001",
    name: "Power Management Sys.",
    category: "light",
    draw: { full: 2.5, idle: 1, standby: 0.2 },
    currentState: "full",
    priority: 1,
  },
  {
    id: "BTK-001",
    name: "Basic Toolkit",
    category: "light",
    draw: { full: 2, idle: 0.3, standby: 0.05 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "PWB-001",
    name: "Portable Workbench",
    category: "light",
    draw: { full: 3, idle: 0.8, standby: 0.15 },
    currentState: "idle",
    priority: 2,
  },
  {
    id: "CPU-001",
    name: "CPU Monitor",
    category: "light",
    draw: { full: 2, idle: 0.8, standby: 0.2 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "MEM-001",
    name: "Memory Monitor",
    category: "light",
    draw: { full: 1.8, idle: 0.6, standby: 0.15 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "TMP-001",
    name: "Temperature Monitor",
    category: "light",
    draw: { full: 1.5, idle: 0.8, standby: 0.2 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "ATK-001",
    name: "Abstractum Tank",
    category: "light",
    draw: { full: 1.5, idle: 0.3, standby: 0.05 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "PWD-001",
    name: "Power Display Panel",
    category: "light",
    draw: { full: 1, idle: 0.4, standby: 0.1 },
    currentState: "full",
    priority: 1,
  },
  {
    id: "CLK-001",
    name: "Lab Clock",
    category: "light",
    draw: { full: 1, idle: 0.5, standby: 0.1 },
    currentState: "idle",
    priority: 1,
  },
  {
    id: "VLT-001",
    name: "Volt Meter Display",
    category: "light",
    draw: { full: 0.8, idle: 0.3, standby: 0.1 },
    currentState: "full",
    priority: 1,
  },
];

// ── Initial state computation ────────────────────────────────────────

function computeInitialState(
  sources: PowerSource[],
  storage: PowerStorage[],
  consumers: PowerConsumer[],
): PowerSystemState {
  const totalGeneration = sources.reduce((sum, s) => {
    if (s.currentState === "offline") return sum;
    return sum + s.output[s.currentState] * (s.efficiency / 100);
  }, 0);
  const totalMaxGeneration = sources.reduce(
    (sum, s) => sum + s.output.full * (s.efficiency / 100),
    0,
  );
  const totalConsumption = consumers.reduce((sum, c) => {
    if (c.currentState === "offline") return sum;
    return sum + c.draw[c.currentState];
  }, 0);
  const powerBalance = totalGeneration - totalConsumption;
  const loadPercent =
    totalGeneration > 0 ? Math.round((totalConsumption / totalGeneration) * 100) : 0;
  const storageE = storage.reduce((sum, s) => sum + s.stored, 0);
  const storageCapacity = storage.reduce((sum, s) => sum + s.capacity, 0);
  const storagePercent = storageCapacity > 0 ? Math.round((storageE / storageCapacity) * 100) : 0;
  const activeDeviceCount = consumers.filter(
    (c) => c.currentState !== "offline" && c.currentState !== "standby",
  ).length;

  return {
    totalGeneration,
    totalMaxGeneration,
    totalConsumption,
    powerBalance,
    loadPercent,
    storageE,
    storageCapacity,
    storagePercent,
    status: "optimal",
    voltage: 120,
    sources,
    storage,
    consumers,
    activeDeviceCount,
    totalDeviceCount: consumers.length,
    performanceThrottle: 1,
    loadSheddingActive: false,
    shedDeviceIds: [],
  };
}

// ── Provider ─────────────────────────────────────────────────────────

export interface PowerManagerProviderProps {
  children: ReactNode;
  initialPowerState?: {
    sources?: { id: string; currentState: string }[];
    storage?: { id: string; stored: number }[];
    consumers?: { id: string; currentState: string }[];
  };
}

export function PowerManagerProvider({ children, initialPowerState }: PowerManagerProviderProps) {
  const [state, setState] = useState<PowerSystemState>(() => {
    let sources = defaultSources;
    let storage = defaultStorage;
    let consumers = defaultConsumers;

    if (initialPowerState?.sources) {
      sources = sources.map((s) => {
        const saved = initialPowerState.sources!.find((sv) => sv.id === s.id);
        return saved ? { ...s, currentState: saved.currentState as PowerState } : s;
      });
    }
    if (initialPowerState?.storage) {
      storage = storage.map((s) => {
        const saved = initialPowerState.storage!.find((sv) => sv.id === s.id);
        return saved ? { ...s, stored: saved.stored } : s;
      });
    }
    if (initialPowerState?.consumers) {
      consumers = consumers.map((c) => {
        const saved = initialPowerState.consumers!.find((sv) => sv.id === c.id);
        return saved ? { ...c, currentState: saved.currentState as PowerState } : c;
      });
    }

    return computeInitialState(sources, storage, consumers);
  });

  const throttleRef = useRef(1.0);

  // ── Tick loop (1s) ───────────────────────────────────────────────

  useEffect(() => {
    const TICK_MS = 1000;
    const dt = TICK_MS / 1000;

    const interval = setInterval(() => {
      setState((prev) => {
        const throttle = throttleRef.current;

        // 1. Generation (sources × efficiency)
        const totalGeneration = prev.sources.reduce((sum, s) => {
          if (s.currentState === "offline") return sum;
          return sum + s.output[s.currentState] * (s.efficiency / 100);
        }, 0);
        const totalMaxGeneration = prev.sources.reduce(
          (sum, s) => sum + s.output.full * (s.efficiency / 100),
          0,
        );

        // 2. Consumption (consumers × throttle for non-standby)
        let totalConsumption = 0;
        for (const c of prev.consumers) {
          if (c.currentState === "offline") continue;
          const raw = c.draw[c.currentState];
          totalConsumption += c.currentState === "standby" ? raw : raw * throttle;
        }

        // 3. Balance
        const balance = totalGeneration - totalConsumption;

        // 4. Battery update
        const bat = prev.storage[0];
        let newStored = bat.stored;
        if (balance > 0) {
          const chargeAmount = Math.min(balance, bat.chargeRate) * dt;
          newStored = Math.min(bat.capacity, newStored + chargeAmount);
        } else if (balance < 0) {
          const dischargeAmount = Math.min(Math.abs(balance), bat.dischargeRate) * dt;
          newStored = Math.max(0, newStored - dischargeAmount);
        }
        newStored = Math.max(0, newStored - bat.selfDischarge * dt);

        const batStatus: PowerStorage["status"] =
          newStored >= bat.capacity
            ? "full"
            : balance > 0
              ? "charging"
              : balance < 0 && newStored > 0
                ? "discharging"
                : newStored <= 0
                  ? "empty"
                  : "idle";

        const newStorage: PowerStorage[] = [
          { ...bat, stored: newStored, status: batStatus },
          ...prev.storage.slice(1),
        ];

        // 5. Load shedding (battery empty AND deficit)
        let newConsumers = prev.consumers;
        let shedDeviceIds: string[] = [];
        let loadSheddingActive = false;

        if (newStored <= 0 && balance < 0) {
          loadSheddingActive = true;
          const sheddable = prev.consumers
            .filter(
              (c) => c.priority > 1 && c.currentState !== "offline" && c.currentState !== "standby",
            )
            .sort((a, b) => {
              const aState = a.currentState as "full" | "idle" | "standby";
              const bState = b.currentState as "full" | "idle" | "standby";
              return b.priority - a.priority || b.draw[bState] - a.draw[aState];
            });

          let deficit = Math.abs(balance);
          const shedIds = new Set<string>();
          for (const c of sheddable) {
            if (deficit <= 0) break;
            const cState = c.currentState as "full" | "idle" | "standby";
            deficit -= c.draw[cState] * throttle;
            shedIds.add(c.id);
          }

          if (shedIds.size > 0) {
            shedDeviceIds = Array.from(shedIds);
            newConsumers = prev.consumers.map((c) =>
              shedIds.has(c.id) ? { ...c, currentState: "standby" as PowerState } : c,
            );
            // Recalculate consumption after shedding
            totalConsumption = 0;
            for (const c of newConsumers) {
              if (c.currentState === "offline") continue;
              const raw = c.draw[c.currentState];
              totalConsumption += c.currentState === "standby" ? raw : raw * throttle;
            }
          }
        }

        // 6. Voltage (sag above 80% load, extra sag if battery empty)
        let voltage = 120;
        if (totalGeneration > 0) {
          const loadFraction = totalConsumption / totalGeneration;
          if (loadFraction > 0.8) {
            const overloadFactor = Math.min(1, (loadFraction - 0.8) / 0.4);
            voltage = 120 * (1 - overloadFactor * 0.33);
          }
        } else {
          voltage = 0;
        }
        if (newStored <= 0) voltage *= 0.85;
        voltage = Math.max(60, Math.min(150, voltage));

        // 7. Status
        const powerBalance = totalGeneration - totalConsumption;
        const loadPercent =
          totalGeneration > 0 ? Math.round((totalConsumption / totalGeneration) * 100) : 0;
        let status: PowerSystemState["status"];
        if (loadSheddingActive) {
          status = "emergency";
        } else if (totalGeneration === 0) {
          status = "emergency";
        } else {
          const surplusPercent = (powerBalance / totalGeneration) * 100;
          if (surplusPercent > 20) status = "optimal";
          else if (surplusPercent >= 0) status = "caution";
          else if (surplusPercent > -20) status = "critical";
          else status = "emergency";
        }

        const storageE = newStored;
        const storageCapacity = bat.capacity;
        const storagePercent =
          storageCapacity > 0 ? Math.round((storageE / storageCapacity) * 100) : 0;
        const activeDeviceCount = newConsumers.filter(
          (c) => c.currentState !== "offline" && c.currentState !== "standby",
        ).length;

        return {
          ...prev,
          sources: prev.sources,
          storage: newStorage,
          consumers: newConsumers,
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
          activeDeviceCount,
          totalDeviceCount: newConsumers.length,
          performanceThrottle: throttle,
          loadSheddingActive,
          shedDeviceIds,
        };
      });
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────

  const setDevicePower = useCallback((deviceId: string, newState: PowerState) => {
    setState((prev) => ({
      ...prev,
      consumers: prev.consumers.map((c) =>
        c.id === deviceId ? { ...c, currentState: newState } : c,
      ),
    }));
  }, []);

  const setSourceState = useCallback((sourceId: string, newState: PowerState) => {
    setState((prev) => ({
      ...prev,
      sources: prev.sources.map((s) => (s.id === sourceId ? { ...s, currentState: newState } : s)),
    }));
  }, []);

  const setPerformanceThrottle = useCallback((throttle: number) => {
    throttleRef.current = Math.max(0, Math.min(1, throttle));
  }, []);

  const emergencyShutdown = useCallback(() => {
    setState((prev) => ({
      ...prev,
      consumers: prev.consumers.map((c) =>
        c.priority > 1 ? { ...c, currentState: "offline" as PowerState } : c,
      ),
    }));
  }, []);

  const refreshPowerData = useCallback(() => {
    setState((prev) => ({ ...prev }));
  }, []);

  const value: PowerManagerContextType = {
    ...state,
    setDevicePower,
    setSourceState,
    setPerformanceThrottle,
    emergencyShutdown,
    refreshPowerData,
  };

  return <PowerManagerContext.Provider value={value}>{children}</PowerManagerContext.Provider>;
}

export function usePowerManager() {
  const context = useContext(PowerManagerContext);
  if (!context) {
    throw new Error("usePowerManager must be used within a PowerManagerProvider");
  }
  return context;
}

export function usePowerManagerOptional() {
  return useContext(PowerManagerContext);
}

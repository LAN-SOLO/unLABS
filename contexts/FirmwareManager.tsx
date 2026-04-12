"use client";

import { createContext, useContext, useReducer, useCallback, useRef } from "react";
import type {
  FirmwareVersion,
  DeviceFirmwareState,
  FirmwareActions,
  FirmwareSaveData,
  FirmwareUpdatePhase,
} from "@/lib/firmware/types";
import { FIRMWARE_REGISTRY } from "@/lib/firmware/registry";

// ── State ─────────────────────────────────────────────────

interface FirmwareState {
  devices: Map<string, DeviceFirmwareState>;
}

type FirmwareAction =
  | { type: "SET_PHASE"; deviceId: string; phase: FirmwareUpdatePhase; progress: number }
  | {
      type: "APPLY_UPDATE";
      deviceId: string;
      newVersion: FirmwareVersion;
      previousVersion: FirmwareVersion;
    }
  | {
      type: "ROLLBACK";
      deviceId: string;
      restoredVersion: FirmwareVersion;
      rolledBackVersion: FirmwareVersion;
    }
  | { type: "SET_CHECKED"; deviceId: string }
  | { type: "HYDRATE"; data: FirmwareSaveData };

// ── Initial state builder ─────────────────────────────────

function buildInitialState(saved?: FirmwareSaveData): FirmwareState {
  const devices = new Map<string, DeviceFirmwareState>();

  for (const [deviceId, entry] of FIRMWARE_REGISTRY) {
    const savedEntry = saved?.[deviceId];
    devices.set(deviceId, {
      installedVersion: savedEntry?.installedVersion ?? { ...entry.firmware },
      previousVersion: savedEntry?.previousVersion ?? null,
      lastChecked: null,
      lastUpdated: savedEntry?.lastUpdated ?? null,
      updatePhase: "idle",
      updateProgress: 0,
    });
  }

  return { devices };
}

// ── Reducer ───────────────────────────────────────────────

function firmwareReducer(state: FirmwareState, action: FirmwareAction): FirmwareState {
  switch (action.type) {
    case "SET_PHASE": {
      const ds = state.devices.get(action.deviceId);
      if (!ds) return state;
      const next = new Map(state.devices);
      next.set(action.deviceId, {
        ...ds,
        updatePhase: action.phase,
        updateProgress: action.progress,
      });
      return { devices: next };
    }

    case "APPLY_UPDATE": {
      const ds = state.devices.get(action.deviceId);
      if (!ds) return state;
      const next = new Map(state.devices);
      next.set(action.deviceId, {
        ...ds,
        installedVersion: action.newVersion,
        previousVersion: action.previousVersion,
        lastUpdated: Date.now(),
        updatePhase: "complete",
        updateProgress: 100,
      });
      return { devices: next };
    }

    case "ROLLBACK": {
      const ds = state.devices.get(action.deviceId);
      if (!ds) return state;
      const next = new Map(state.devices);
      next.set(action.deviceId, {
        ...ds,
        installedVersion: action.restoredVersion,
        previousVersion: action.rolledBackVersion,
        lastUpdated: Date.now(),
        updatePhase: "idle",
        updateProgress: 0,
      });
      return { devices: next };
    }

    case "SET_CHECKED": {
      const ds = state.devices.get(action.deviceId);
      if (!ds) return state;
      const next = new Map(state.devices);
      next.set(action.deviceId, { ...ds, lastChecked: Date.now() });
      return { devices: next };
    }

    case "HYDRATE": {
      return buildInitialState(action.data);
    }

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────

const FirmwareManagerContext = createContext<FirmwareActions | null>(null);

export function useFirmwareManager(): FirmwareActions {
  const ctx = useContext(FirmwareManagerContext);
  if (!ctx) throw new Error("useFirmwareManager must be used within FirmwareManagerProvider");
  return ctx;
}

export function useFirmwareManagerOptional(): FirmwareActions | null {
  return useContext(FirmwareManagerContext);
}

// ── Provider ──────────────────────────────────────────────

interface FirmwareManagerProviderProps {
  children: React.ReactNode;
  initialState?: FirmwareSaveData;
}

export function FirmwareManagerProvider({ children, initialState }: FirmwareManagerProviderProps) {
  const [state, dispatch] = useReducer(firmwareReducer, initialState, buildInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const getDeviceState = useCallback((deviceId: string) => {
    return stateRef.current.devices.get(deviceId);
  }, []);

  const getAllStates = useCallback(() => {
    return stateRef.current.devices;
  }, []);

  const getInstalledVersion = useCallback((deviceId: string) => {
    return stateRef.current.devices.get(deviceId)?.installedVersion;
  }, []);

  const checkForUpdate = useCallback((deviceId: string) => {
    const ds = stateRef.current.devices.get(deviceId);
    const entry = FIRMWARE_REGISTRY.get(deviceId);
    if (!ds || !entry) {
      return { available: false, currentVersion: ds?.installedVersion.version ?? "unknown" };
    }

    dispatch({ type: "SET_CHECKED", deviceId });

    if (!entry.update) {
      return { available: false, currentVersion: ds.installedVersion.version };
    }

    // Compare installed version with available update
    const installed = ds.installedVersion.version;
    const updateVer = entry.update.version;
    if (installed === updateVer) {
      return { available: false, currentVersion: installed };
    }

    return {
      available: true,
      update: entry.update,
      currentVersion: installed,
      latestVersion: updateVer,
    };
  }, []);

  const getDevicesWithUpdates = useCallback(() => {
    const results: {
      deviceId: string;
      deviceName: string;
      currentVersion: string;
      updateVersion: string;
    }[] = [];
    for (const [deviceId, entry] of FIRMWARE_REGISTRY) {
      if (!entry.update) continue;
      const ds = stateRef.current.devices.get(deviceId);
      if (!ds) continue;
      if (ds.installedVersion.version !== entry.update.version) {
        results.push({
          deviceId,
          deviceName: entry.device_name,
          currentVersion: ds.installedVersion.version,
          updateVersion: entry.update.version,
        });
      }
    }
    return results;
  }, []);

  const applyUpdate = useCallback(async (deviceId: string): Promise<boolean> => {
    const ds = stateRef.current.devices.get(deviceId);
    const entry = FIRMWARE_REGISTRY.get(deviceId);
    if (!ds || !entry?.update) return false;
    if (ds.installedVersion.version === entry.update.version) return false;
    if (ds.updatePhase !== "idle" && ds.updatePhase !== "complete" && ds.updatePhase !== "failed")
      return false;

    const update = entry.update;

    // Phase 1: Download (2s)
    dispatch({ type: "SET_PHASE", deviceId, phase: "downloading", progress: 0 });
    await sleep(500);
    dispatch({ type: "SET_PHASE", deviceId, phase: "downloading", progress: 25 });
    await sleep(500);
    dispatch({ type: "SET_PHASE", deviceId, phase: "downloading", progress: 50 });
    await sleep(500);
    dispatch({ type: "SET_PHASE", deviceId, phase: "downloading", progress: 75 });
    await sleep(500);
    dispatch({ type: "SET_PHASE", deviceId, phase: "downloading", progress: 100 });

    // Phase 2: Verify (1.5s)
    dispatch({ type: "SET_PHASE", deviceId, phase: "verifying", progress: 0 });
    await sleep(750);
    dispatch({ type: "SET_PHASE", deviceId, phase: "verifying", progress: 50 });
    await sleep(750);
    dispatch({ type: "SET_PHASE", deviceId, phase: "verifying", progress: 100 });

    // Phase 3: Flash (2.5s)
    dispatch({ type: "SET_PHASE", deviceId, phase: "flashing", progress: 0 });
    await sleep(500);
    dispatch({ type: "SET_PHASE", deviceId, phase: "flashing", progress: 20 });
    await sleep(500);
    dispatch({ type: "SET_PHASE", deviceId, phase: "flashing", progress: 40 });
    await sleep(500);
    dispatch({ type: "SET_PHASE", deviceId, phase: "flashing", progress: 60 });
    await sleep(500);
    dispatch({ type: "SET_PHASE", deviceId, phase: "flashing", progress: 80 });
    await sleep(500);
    dispatch({ type: "SET_PHASE", deviceId, phase: "flashing", progress: 100 });

    // Phase 4: Reboot (2s)
    if (update.requires_reboot) {
      dispatch({ type: "SET_PHASE", deviceId, phase: "rebooting", progress: 0 });
      await sleep(1000);
      dispatch({ type: "SET_PHASE", deviceId, phase: "rebooting", progress: 50 });
      await sleep(1000);
      dispatch({ type: "SET_PHASE", deviceId, phase: "rebooting", progress: 100 });
    }

    // Complete: swap versions
    const newVersion: FirmwareVersion = {
      version: update.version,
      build: update.build,
      checksum: update.checksum,
      features: entry.firmware.features,
      securityPatch: update.build,
    };

    dispatch({
      type: "APPLY_UPDATE",
      deviceId,
      newVersion,
      previousVersion: { ...ds.installedVersion },
    });

    return true;
  }, []);

  const rollback = useCallback((deviceId: string): boolean => {
    const ds = stateRef.current.devices.get(deviceId);
    if (!ds || !ds.previousVersion) return false;

    dispatch({
      type: "ROLLBACK",
      deviceId,
      restoredVersion: { ...ds.previousVersion },
      rolledBackVersion: { ...ds.installedVersion },
    });

    return true;
  }, []);

  const toSaveData = useCallback((): FirmwareSaveData => {
    const data: FirmwareSaveData = {};
    for (const [deviceId, ds] of stateRef.current.devices) {
      const entry = FIRMWARE_REGISTRY.get(deviceId);
      if (!entry) continue;
      // Only save if version differs from default (was updated) or has a previous version
      if (ds.installedVersion.version !== entry.firmware.version || ds.previousVersion) {
        data[deviceId] = {
          installedVersion: ds.installedVersion,
          previousVersion: ds.previousVersion,
          lastUpdated: ds.lastUpdated,
        };
      }
    }
    return data;
  }, []);

  const actions: FirmwareActions = {
    getDeviceState,
    getAllStates,
    getInstalledVersion,
    checkForUpdate,
    getDevicesWithUpdates,
    applyUpdate,
    rollback,
    toSaveData,
  };

  return (
    <FirmwareManagerContext.Provider value={actions}>{children}</FirmwareManagerContext.Provider>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

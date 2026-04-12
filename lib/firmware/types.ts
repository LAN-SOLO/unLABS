// ── Firmware System Types ──────────────────────────────────

export interface FirmwareVersion {
  version: string;
  build: string;
  checksum: string;
  features: string[];
  securityPatch: string;
}

export interface FirmwareUpdate {
  version: string;
  build: string;
  checksum: string;
  changelog: string[];
  min_version: string;
  requires_reboot: boolean;
}

export interface DeviceFirmwareEntry {
  device_id: string;
  device_name: string;
  tier: number;
  firmware: FirmwareVersion;
  power: {
    full: number;
    idle: number;
    standby: number;
    category: string;
    priority: number;
    [key: string]: unknown;
  };
  update?: FirmwareUpdate;
}

export type FirmwareUpdatePhase =
  | "idle"
  | "checking"
  | "downloading"
  | "verifying"
  | "flashing"
  | "rebooting"
  | "complete"
  | "failed";

export interface DeviceFirmwareState {
  installedVersion: FirmwareVersion;
  previousVersion: FirmwareVersion | null;
  lastChecked: number | null;
  lastUpdated: number | null;
  updatePhase: FirmwareUpdatePhase;
  updateProgress: number;
}

export interface FirmwareActions {
  getDeviceState: (deviceId: string) => DeviceFirmwareState | undefined;
  getAllStates: () => Map<string, DeviceFirmwareState>;
  getInstalledVersion: (deviceId: string) => FirmwareVersion | undefined;
  checkForUpdate: (deviceId: string) => {
    available: boolean;
    update?: FirmwareUpdate;
    currentVersion: string;
    latestVersion?: string;
  };
  getDevicesWithUpdates: () => {
    deviceId: string;
    deviceName: string;
    currentVersion: string;
    updateVersion: string;
  }[];
  applyUpdate: (deviceId: string) => Promise<boolean>;
  rollback: (deviceId: string) => boolean;
  toSaveData: () => FirmwareSaveData;
}

export interface FirmwareSaveData {
  [deviceId: string]: {
    installedVersion: FirmwareVersion;
    previousVersion: FirmwareVersion | null;
    lastUpdated: number | null;
  };
}

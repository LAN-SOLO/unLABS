const STORAGE_KEY = "unlabs_panel_state";

export interface PanelSaveData {
  version: 1;
  timestamp: number;
  filesystem?: string;
  users?: string;
  themeIndex?: number;
  resources?: { [id: string]: { amount: number; isUnlocked: boolean; upgradeLevel?: number } };
  kernel?: import("@/lib/unos/kernel").KernelSerializedState;
  shell?: {
    config: import("@/lib/unos/shell").ShellConfig;
    aliases: [string, string][];
    env: [string, string][];
  };
  journal?: { entries: import("@/lib/unos/journal").JournalEntry[]; bootTime: number };
  cron?: { entries: import("@/lib/unos/cron").CronEntry[]; nextId: number };
  firmware?: {
    [deviceId: string]: {
      installedVersion: {
        version: string;
        build: string;
        checksum: string;
        features: string[];
        securityPatch: string;
      };
      previousVersion: {
        version: string;
        build: string;
        checksum: string;
        features: string[];
        securityPatch: string;
      } | null;
      lastUpdated: number | null;
    };
  };
  devices: {
    cdc: { isPowered: boolean; isExpanded?: boolean };
    uec: { isPowered: boolean; isExpanded?: boolean };
    bat: { isPowered: boolean; currentCharge: number; autoRegen: boolean; isExpanded?: boolean };
    hms: {
      isPowered: boolean;
      pulseValue: number;
      tempoValue: number;
      freqValue: number;
      waveformType: string;
      isExpanded?: boolean;
    };
    ecr: {
      isPowered: boolean;
      pulseValue: number;
      bloomValue: number;
      isRecording: boolean;
      isExpanded?: boolean;
    };
    ipl: { isPowered: boolean; isExpanded?: boolean };
    mfr: { isPowered: boolean; isExpanded?: boolean };
    aic: { isPowered: boolean; isLearning: boolean; isExpanded?: boolean };
    vnt: {
      isPowered: boolean;
      cpuFanSpeed: number;
      gpuFanSpeed: number;
      fanMode: string;
      isExpanded?: boolean;
    };
    sca: { isPowered: boolean; isExpanded?: boolean };
    exd: { isPowered: boolean; isDeployed: boolean; isExpanded?: boolean };
    emc?: { isPowered: boolean; isExpanded?: boolean };
    qsm?: { isPowered: boolean; isExpanded?: boolean };
    qua?: {
      isPowered: boolean;
      mode?: string;
      sensitivity?: number;
      depth?: number;
      frequency?: number;
      isExpanded?: boolean;
    };
    pwb?: { isPowered: boolean; isExpanded?: boolean };
    btk?: { isPowered: boolean; isExpanded?: boolean };
    rmg?: { isPowered: boolean; strength?: number; isExpanded?: boolean };
    msc?: { isPowered: boolean; isExpanded?: boolean };
    net?: { isPowered: boolean; bandwidth?: number; latencyMs?: number; isExpanded?: boolean };
    tmp?: { isPowered: boolean; temperature?: number; isExpanded?: boolean };
    dim?: { isPowered: boolean; dimension?: number; stability?: number; isExpanded?: boolean };
    cpu?: {
      isPowered: boolean;
      cores?: number;
      utilization?: number;
      frequency?: number;
      isExpanded?: boolean;
    };
    clk?: { isPowered: boolean; displayMode?: string; isExpanded?: boolean };
    mem?: {
      isPowered: boolean;
      totalMemory?: number;
      usedMemory?: number;
      displayMode?: string;
      isExpanded?: boolean;
    };
    and?: {
      isPowered: boolean;
      signalStrength?: number;
      anomaliesFound?: number;
      displayMode?: string;
      isExpanded?: boolean;
    };
    qcp?: {
      isPowered: boolean;
      anomalyDirection?: number;
      anomalyDistance?: number;
      displayMode?: string;
      isExpanded?: boolean;
    };
    tlp?: {
      isPowered: boolean;
      chargeLevel?: number;
      lastDestination?: string;
      displayMode?: string;
      isExpanded?: boolean;
    };
    lct?: {
      isPowered: boolean;
      laserPower?: number;
      precision?: number;
      displayMode?: string;
      isExpanded?: boolean;
    };
    p3d?: {
      isPowered: boolean;
      progress?: number;
      layerCount?: number;
      bedTemp?: number;
      displayMode?: string;
      isExpanded?: boolean;
    };
    spk?: {
      isPowered: boolean;
      volume?: number;
      isMuted?: boolean;
      filters?: { bass: boolean; mid: boolean; high: boolean };
      isExpanded?: boolean;
    };
    dgn?: { isPowered: boolean; category?: string; scanDepth?: number; isExpanded?: boolean };
    screwButtons?: {
      [key: string]: { unlocked: boolean; active: boolean; totalActiveTime: number };
    };
  };
}

export function savePanelState(data: PanelSaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadPanelState(): PanelSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return null;
    return parsed as PanelSaveData;
  } catch {
    return null;
  }
}

export function clearPanelState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Export the current game state as a downloadable JSON file.
 */
export function exportSaveFile(extra?: {
  username?: string;
  questState?: unknown;
  missionState?: unknown;
  resources?: unknown;
  episode?: string;
}): void {
  const panelState = loadPanelState();
  const saveFile = {
    _unlabs_save: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    username: extra?.username ?? "operator",
    panelState,
    questState: extra?.questState ?? null,
    missionState: extra?.missionState ?? null,
    resources: extra?.resources ?? null,
    episode: extra?.episode ?? null,
  };
  const json = JSON.stringify(saveFile, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `unlabs-save-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate an imported save file. Returns the panel state
 * and any extra data, or null if invalid.
 */
export function parseImportedSaveFile(json: string): {
  panelState: PanelSaveData | null;
  questState: unknown;
  missionState: unknown;
  resources: unknown;
  episode: string | null;
  username: string | null;
} | null {
  try {
    const data = JSON.parse(json);
    // Accept both raw PanelSaveData and wrapped save files
    if (data?._unlabs_save) {
      return {
        panelState: data.panelState ?? null,
        questState: data.questState ?? null,
        missionState: data.missionState ?? null,
        resources: data.resources ?? null,
        episode: data.episode ?? null,
        username: data.username ?? null,
      };
    }
    // Raw PanelSaveData (version: 1)
    if (data?.version === 1 && data?.devices) {
      return {
        panelState: data as PanelSaveData,
        questState: null,
        missionState: null,
        resources: null,
        episode: null,
        username: null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

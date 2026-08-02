import type { PanelSaveData } from "./panelState";

type Snap<T> = T | null | undefined;

/**
 * Minimal structural snapshots of per-device state. Both the terminal's
 * `deviceActions.getState()` results and the panel managers' context values
 * satisfy these shapes, so terminal saves and panel autosaves share one
 * builder and cannot drift apart.
 */
export interface PanelDeviceSnapshots {
  cdc?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  uec?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  bat?: Snap<{
    isPowered?: boolean;
    currentCharge?: number;
    autoRegen?: boolean;
    isExpanded?: boolean;
  }>;
  hms?: Snap<{
    isPowered?: boolean;
    pulseValue?: number;
    tempoValue?: number;
    freqValue?: number;
    waveformType?: string;
    isExpanded?: boolean;
  }>;
  ecr?: Snap<{
    isPowered?: boolean;
    pulseValue?: number;
    bloomValue?: number;
    isRecording?: boolean;
    isExpanded?: boolean;
  }>;
  ipl?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  mfr?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  aic?: Snap<{ isPowered?: boolean; isLearning?: boolean; isExpanded?: boolean }>;
  vnt?: Snap<{
    isPowered?: boolean;
    isExpanded?: boolean;
    cpuFan?: { speed?: number; mode?: string } | null;
    gpuFan?: { speed?: number } | null;
  }>;
  sca?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  exd?: Snap<{ isPowered?: boolean; isDeployed?: boolean; isExpanded?: boolean }>;
  qsm?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  emc?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  qua?: Snap<{
    isPowered?: boolean;
    mode?: string;
    sensitivity?: number;
    depth?: number;
    frequency?: number;
    isExpanded?: boolean;
  }>;
  pwb?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  btk?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  rmg?: Snap<{ isPowered?: boolean; strength?: number; isExpanded?: boolean }>;
  msc?: Snap<{ isPowered?: boolean; isExpanded?: boolean }>;
  net?: Snap<{
    isPowered?: boolean;
    bandwidth?: number;
    latencyMs?: number;
    isExpanded?: boolean;
  }>;
  tmp?: Snap<{ isPowered?: boolean; temperature?: number; isExpanded?: boolean }>;
  dim?: Snap<{
    isPowered?: boolean;
    dimension?: number;
    stability?: number;
    isExpanded?: boolean;
  }>;
  cpu?: Snap<{
    isPowered?: boolean;
    cores?: number;
    utilization?: number;
    frequency?: number;
    isExpanded?: boolean;
  }>;
  clk?: Snap<{ isPowered?: boolean; displayMode?: string; isExpanded?: boolean }>;
  mem?: Snap<{
    isPowered?: boolean;
    totalMemory?: number;
    usedMemory?: number;
    displayMode?: string;
    isExpanded?: boolean;
  }>;
  and?: Snap<{
    isPowered?: boolean;
    signalStrength?: number;
    anomaliesFound?: number;
    displayMode?: string;
    isExpanded?: boolean;
  }>;
  qcp?: Snap<{
    isPowered?: boolean;
    anomalyDirection?: number;
    anomalyDistance?: number;
    displayMode?: string;
    isExpanded?: boolean;
  }>;
  tlp?: Snap<{
    isPowered?: boolean;
    chargeLevel?: number;
    lastDestination?: string;
    displayMode?: string;
    isExpanded?: boolean;
  }>;
  lct?: Snap<{
    isPowered?: boolean;
    laserPower?: number;
    precision?: number;
    displayMode?: string;
    isExpanded?: boolean;
  }>;
  p3d?: Snap<{
    isPowered?: boolean;
    progress?: number;
    layerCount?: number;
    bedTemp?: number;
    displayMode?: string;
    isExpanded?: boolean;
  }>;
  spk?: Snap<{
    isPowered?: boolean;
    volume?: number;
    isMuted?: boolean;
    filters?: { bass: boolean; mid: boolean; high: boolean };
    isExpanded?: boolean;
  }>;
  dgn?: Snap<{
    isPowered?: boolean;
    category?: string;
    scanDepth?: number;
    isExpanded?: boolean;
  }>;
  screwButtons?: Snap<
    Record<string, { unlocked: boolean; active: boolean; totalActiveTime: number }>
  >;
}

/** Sections owned by non-device subsystems (terminal-side or shared). */
export interface PanelSaveSections {
  filesystem?: string;
  users?: string;
  resources?: PanelSaveData["resources"];
  firmware?: PanelSaveData["firmware"];
  kernel?: PanelSaveData["kernel"];
  shell?: PanelSaveData["shell"];
  journal?: PanelSaveData["journal"];
}

/**
 * Assemble a complete `PanelSaveData` blob. Sections the caller cannot
 * produce fall back to `base` (the previously stored blob), so a panel-side
 * save never clobbers terminal-owned sections and vice versa.
 */
export function buildPanelSaveData(
  devices: PanelDeviceSnapshots,
  sections: PanelSaveSections = {},
  base?: PanelSaveData | null,
): PanelSaveData {
  const {
    cdc,
    uec,
    bat,
    hms,
    ecr,
    ipl,
    mfr,
    aic,
    vnt,
    sca,
    exd,
    qsm,
    emc,
    qua,
    pwb,
    btk,
    rmg,
    msc,
    net,
    tmp,
    dim,
    cpu,
    clk,
    mem,
    and,
    qcp,
    tlp,
    lct,
    p3d,
    spk,
    dgn,
    screwButtons,
  } = devices;

  return {
    version: 1,
    timestamp: Date.now(),
    filesystem: sections.filesystem ?? base?.filesystem,
    users: sections.users ?? base?.users,
    themeIndex: base?.themeIndex,
    resources: sections.resources ?? base?.resources,
    kernel: sections.kernel ?? base?.kernel,
    shell: sections.shell ?? base?.shell,
    journal: sections.journal ?? base?.journal,
    cron: base?.cron,
    power: base?.power,
    thermal: base?.thermal,
    firmware: sections.firmware ?? base?.firmware,
    devices: {
      cdc: { isPowered: cdc?.isPowered ?? true, isExpanded: cdc?.isExpanded ?? true },
      uec: { isPowered: uec?.isPowered ?? true, isExpanded: uec?.isExpanded ?? true },
      bat: {
        isPowered: bat?.isPowered ?? true,
        currentCharge: bat?.currentCharge ?? 5000,
        autoRegen: bat?.autoRegen ?? true,
        isExpanded: bat?.isExpanded ?? true,
      },
      hms: {
        isPowered: hms?.isPowered ?? true,
        pulseValue: hms?.pulseValue ?? 35,
        tempoValue: hms?.tempoValue ?? 40,
        freqValue: hms?.freqValue ?? 37,
        waveformType: hms?.waveformType ?? "sine",
        isExpanded: hms?.isExpanded ?? true,
      },
      ecr: {
        isPowered: ecr?.isPowered ?? true,
        pulseValue: ecr?.pulseValue ?? 40,
        bloomValue: ecr?.bloomValue ?? 60,
        isRecording: ecr?.isRecording ?? false,
        isExpanded: ecr?.isExpanded ?? true,
      },
      ipl: { isPowered: ipl?.isPowered ?? true, isExpanded: ipl?.isExpanded ?? true },
      mfr: { isPowered: mfr?.isPowered ?? true, isExpanded: mfr?.isExpanded ?? true },
      aic: {
        isPowered: aic?.isPowered ?? true,
        isLearning: aic?.isLearning ?? true,
        isExpanded: aic?.isExpanded ?? true,
      },
      vnt: {
        isPowered: vnt?.isPowered ?? true,
        cpuFanSpeed: vnt?.cpuFan?.speed ?? 65,
        gpuFanSpeed: vnt?.gpuFan?.speed ?? 65,
        fanMode: vnt?.cpuFan?.mode ?? "AUTO",
        isExpanded: vnt?.isExpanded ?? true,
      },
      sca: { isPowered: sca?.isPowered ?? true, isExpanded: sca?.isExpanded ?? true },
      exd: {
        isPowered: exd?.isPowered ?? true,
        isDeployed: exd?.isDeployed ?? true,
        isExpanded: exd?.isExpanded ?? true,
      },
      qsm: { isPowered: qsm?.isPowered ?? true, isExpanded: qsm?.isExpanded ?? true },
      emc: { isPowered: emc?.isPowered ?? true, isExpanded: emc?.isExpanded ?? true },
      qua: {
        isPowered: qua?.isPowered ?? true,
        mode: qua?.mode ?? "ANOMALY",
        sensitivity: qua?.sensitivity ?? 65,
        depth: qua?.depth ?? 50,
        frequency: qua?.frequency ?? 40,
        isExpanded: qua?.isExpanded ?? true,
      },
      pwb: { isPowered: pwb?.isPowered ?? true, isExpanded: pwb?.isExpanded ?? true },
      btk: { isPowered: btk?.isPowered ?? true, isExpanded: btk?.isExpanded ?? true },
      rmg: {
        isPowered: rmg?.isPowered ?? true,
        strength: rmg?.strength ?? 45,
        isExpanded: rmg?.isExpanded ?? true,
      },
      msc: { isPowered: msc?.isPowered ?? true, isExpanded: msc?.isExpanded ?? true },
      net: {
        isPowered: net?.isPowered ?? true,
        bandwidth: net?.bandwidth ?? 2.4,
        latencyMs: net?.latencyMs ?? 12,
        isExpanded: net?.isExpanded ?? true,
      },
      tmp: {
        isPowered: tmp?.isPowered ?? true,
        temperature: tmp?.temperature ?? 28.4,
        isExpanded: tmp?.isExpanded ?? true,
      },
      dim: {
        isPowered: dim?.isPowered ?? true,
        dimension: dim?.dimension ?? 3.14,
        stability: dim?.stability ?? 98,
        isExpanded: dim?.isExpanded ?? true,
      },
      cpu: {
        isPowered: cpu?.isPowered ?? true,
        cores: cpu?.cores ?? 8,
        utilization: cpu?.utilization ?? 67,
        frequency: cpu?.frequency ?? 4.2,
        isExpanded: cpu?.isExpanded ?? true,
      },
      clk: {
        isPowered: clk?.isPowered ?? true,
        displayMode: clk?.displayMode ?? "local",
        isExpanded: clk?.isExpanded ?? true,
      },
      mem: {
        isPowered: mem?.isPowered ?? true,
        totalMemory: mem?.totalMemory ?? 16,
        usedMemory: mem?.usedMemory ?? 11.5,
        displayMode: mem?.displayMode ?? "usage",
        isExpanded: mem?.isExpanded ?? true,
      },
      and: {
        isPowered: and?.isPowered ?? true,
        signalStrength: and?.signalStrength ?? 67,
        anomaliesFound: and?.anomaliesFound ?? 3,
        displayMode: and?.displayMode ?? "waveform",
        isExpanded: and?.isExpanded ?? true,
      },
      qcp: {
        isPowered: qcp?.isPowered ?? true,
        anomalyDirection: qcp?.anomalyDirection ?? 127,
        anomalyDistance: qcp?.anomalyDistance ?? 42,
        displayMode: qcp?.displayMode ?? "compass",
        isExpanded: qcp?.isExpanded ?? true,
      },
      tlp: {
        isPowered: tlp?.isPowered ?? true,
        chargeLevel: tlp?.chargeLevel ?? 65,
        lastDestination: tlp?.lastDestination ?? "LAB-Ω",
        displayMode: tlp?.displayMode ?? "standard",
        isExpanded: tlp?.isExpanded ?? true,
      },
      lct: {
        isPowered: lct?.isPowered ?? true,
        laserPower: lct?.laserPower ?? 450,
        precision: lct?.precision ?? 0.01,
        displayMode: lct?.displayMode ?? "cutting",
        isExpanded: lct?.isExpanded ?? true,
      },
      p3d: {
        isPowered: p3d?.isPowered ?? true,
        progress: p3d?.progress ?? 67,
        layerCount: p3d?.layerCount ?? 234,
        bedTemp: p3d?.bedTemp ?? 60,
        displayMode: p3d?.displayMode ?? "plastic",
        isExpanded: p3d?.isExpanded ?? true,
      },
      spk: {
        isPowered: spk?.isPowered ?? true,
        volume: spk?.volume ?? 45,
        isMuted: spk?.isMuted ?? false,
        filters: spk?.filters ?? { bass: false, mid: true, high: false },
        isExpanded: spk?.isExpanded ?? true,
      },
      dgn: {
        isPowered: dgn?.isPowered ?? true,
        category: dgn?.category ?? "SYSTEMS",
        scanDepth: dgn?.scanDepth ?? 75,
        isExpanded: dgn?.isExpanded ?? true,
      },
      screwButtons: screwButtons
        ? Object.fromEntries(
            Object.entries(screwButtons).map(([k, v]) => [
              k,
              { unlocked: v.unlocked, active: v.active, totalActiveTime: v.totalActiveTime },
            ]),
          )
        : undefined,
    },
  };
}

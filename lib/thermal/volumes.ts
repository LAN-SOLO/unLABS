/**
 * Fixed thermal volume model for the _unOS chassis and devices.
 *
 * All volumes in liters (L). Heat capacity is computed assuming the enclosed
 * working medium is dry air at sea-level (≈ 1.225 g/L, c_p ≈ 1.005 J/g·K),
 * which gives a small but realistic thermal mass. Devices with denser
 * internals (reactors, supercomputers) get a multiplier to model heatsinks
 * and silicon mass.
 *
 * Numbers are intentionally fixed (not user-tweakable) so the simulation
 * stays reproducible across saves.
 */

/** Mini-tower chassis volume that hosts the panel + terminal hardware. */
export const TERMINAL_CHASSIS_VOLUME_L = 28;

/** Specific heat of dry air at room temp, J / (g · K). */
export const C_AIR = 1.005;
/** Density of dry air at sea level, g / L. */
export const RHO_AIR = 1.225;

/**
 * Effective heat capacity of an enclosure in J/K.
 *
 * J/K = volume_L · density_g/L · c_p_J/(g·K) · solidMassFactor
 *
 * `solidMassFactor` lumps in the silicon, PCB and heatsink contribution
 * relative to the air volume. 1.0 = pure air. 12 ≈ a PC chassis dominated
 * by metal heatsinks and a silicon die.
 */
export function heatCapacityJ(volumeLiters: number, solidMassFactor = 12): number {
  return volumeLiters * RHO_AIR * C_AIR * solidMassFactor;
}

/**
 * Per-device fixed volume (liters) and an internal heat output budget (watts
 * at 100 % load). The watts figure is what the simulation feeds into the
 * thermal model — see `ThermalManager.calculateTotalHeat`.
 *
 * Volumes are deliberately small: each device is a slot-in module inside
 * the chassis, not a free-standing appliance.
 */
export interface DeviceThermalSpec {
  id: string;
  name: string;
  volumeL: number;
  /** Watts dissipated at 100 % load. Idle ≈ 10 % of this. */
  heatWatts: number;
  /** Optional heatsink/silicon mass factor; defaults to 8. */
  solidMassFactor?: number;
}

/**
 * Catalog of every device the thermal subsystem knows about. Keyed by the
 * lowercase 3-letter device id used everywhere else in the codebase.
 */
export const DEVICE_THERMAL_SPECS: Record<string, DeviceThermalSpec> = {
  // ── Power & energy ────────────────────────────────────────────────
  uec: { id: "uec", name: "Energy Core", volumeL: 1.8, heatWatts: 65, solidMassFactor: 14 },
  bat: { id: "bat", name: "Battery Pack", volumeL: 2.2, heatWatts: 18 },
  mfr: { id: "mfr", name: "Microfusion Reactor", volumeL: 3.5, heatWatts: 95, solidMassFactor: 18 },
  ecr: { id: "ecr", name: "Echo Recorder", volumeL: 0.6, heatWatts: 8 },

  // ── Compute ───────────────────────────────────────────────────────
  cpu: { id: "cpu", name: "CPU", volumeL: 0.45, heatWatts: 95, solidMassFactor: 22 },
  mem: { id: "mem", name: "Memory", volumeL: 0.35, heatWatts: 18 },
  sca: {
    id: "sca",
    name: "Supercomputer Array",
    volumeL: 4.2,
    heatWatts: 180,
    solidMassFactor: 20,
  },
  aic: { id: "aic", name: "AI Assistant", volumeL: 0.9, heatWatts: 35 },
  qsm: { id: "qsm", name: "Quantum State Monitor", volumeL: 1.2, heatWatts: 28 },

  // ── Sensors / Monitors ────────────────────────────────────────────
  cdc: { id: "cdc", name: "Crystal Data Cache", volumeL: 0.7, heatWatts: 12 },
  hms: { id: "hms", name: "Handmade Synthesizer", volumeL: 0.5, heatWatts: 9 },
  ipl: { id: "ipl", name: "Interpolator", volumeL: 0.4, heatWatts: 7 },
  qua: { id: "qua", name: "Quantum Analyzer", volumeL: 1.0, heatWatts: 24 },
  emc: { id: "emc", name: "Exotic Matter Cont.", volumeL: 1.6, heatWatts: 32, solidMassFactor: 14 },
  net: { id: "net", name: "Network Monitor", volumeL: 0.3, heatWatts: 6 },
  tmp: { id: "tmp", name: "Temperature Monitor", volumeL: 0.2, heatWatts: 3 },
  dim: { id: "dim", name: "Dimension Monitor", volumeL: 0.4, heatWatts: 8 },
  and: { id: "and", name: "Anomaly Detector", volumeL: 0.5, heatWatts: 11 },
  qcp: { id: "qcp", name: "Quantum Compass", volumeL: 0.4, heatWatts: 7 },
  msc: { id: "msc", name: "Material Scanner", volumeL: 0.6, heatWatts: 14 },
  dgn: { id: "dgn", name: "Diagnostics", volumeL: 0.3, heatWatts: 5 },

  // ── Tools / Fabrication ───────────────────────────────────────────
  lct: { id: "lct", name: "Laser Cutter", volumeL: 1.4, heatWatts: 75, solidMassFactor: 16 },
  p3d: { id: "p3d", name: "3D Printer", volumeL: 1.8, heatWatts: 55, solidMassFactor: 14 },
  pwb: { id: "pwb", name: "Portable Workbench", volumeL: 0.8, heatWatts: 12 },
  btk: { id: "btk", name: "Basic Toolkit", volumeL: 0.5, heatWatts: 4 },
  rmg: { id: "rmg", name: "Resource Magnet", volumeL: 0.6, heatWatts: 22 },
  exd: { id: "exd", name: "Explorer Drone", volumeL: 0.9, heatWatts: 16 },
  tlp: { id: "tlp", name: "Teleport Pad", volumeL: 2.4, heatWatts: 60, solidMassFactor: 14 },

  // ── Misc ──────────────────────────────────────────────────────────
  spk: { id: "spk", name: "Speaker", volumeL: 0.25, heatWatts: 6 },
  clk: { id: "clk", name: "Lab Clock", volumeL: 0.15, heatWatts: 2 },
  vnt: { id: "vnt", name: "Ventilation", volumeL: 0.6, heatWatts: 5 },
};

/**
 * Sum of every device volume — i.e. how much of the chassis is "filled" by
 * known modules. The remainder is air gap that the fans push around.
 */
export function totalDeviceVolumeL(): number {
  return Object.values(DEVICE_THERMAL_SPECS).reduce((s, d) => s + d.volumeL, 0);
}

/**
 * Fraction of the chassis that is empty air. Useful for sanity checks and
 * the `thermal status` readout.
 */
export function airGapL(): number {
  return Math.max(0, TERMINAL_CHASSIS_VOLUME_L - totalDeviceVolumeL());
}

/** Look up a device's thermal spec, or undefined if unknown. */
export function getDeviceThermalSpec(id: string): DeviceThermalSpec | undefined {
  return DEVICE_THERMAL_SPECS[id.toLowerCase()];
}

/** Heat capacity (J/K) of a registered device, or 0 if unknown. */
export function deviceHeatCapacityJ(id: string): number {
  const spec = getDeviceThermalSpec(id);
  if (!spec) return 0;
  return heatCapacityJ(spec.volumeL, spec.solidMassFactor ?? 8);
}

/** Heat capacity (J/K) of the whole chassis, including a solid-mass factor. */
export const CHASSIS_HEAT_CAPACITY_J = heatCapacityJ(TERMINAL_CHASSIS_VOLUME_L, 10);
